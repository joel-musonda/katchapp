import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const GUEST_VIEWER_STORAGE_KEY = "genjutsu_guest_viewer_id";
const MAX_SESSION_DEDUPE_KEYS = 5000;
const sessionAttemptedViews = new Map<string, number>();
let inMemoryGuestId: string | null = null;

function createGuestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateGuestViewerId(): string {
  if (inMemoryGuestId) return inMemoryGuestId;

  if (typeof window === "undefined") {
    inMemoryGuestId = createGuestId();
    return inMemoryGuestId;
  }

  try {
    const existing = window.localStorage.getItem(GUEST_VIEWER_STORAGE_KEY);
    if (existing) {
      inMemoryGuestId = existing;
      return existing;
    }
    const created = createGuestId();
    window.localStorage.setItem(GUEST_VIEWER_STORAGE_KEY, created);
    inMemoryGuestId = created;
    return created;
  } catch {
    inMemoryGuestId = createGuestId();
    return inMemoryGuestId;
  }
}

function buildViewerKey(userId?: string | null): string {
  if (userId) return `u:${userId}`;
  return `g:${getOrCreateGuestViewerId()}`;
}

function pruneSessionDedupe() {
  if (sessionAttemptedViews.size <= MAX_SESSION_DEDUPE_KEYS) return;
  const overflow = sessionAttemptedViews.size - MAX_SESSION_DEDUPE_KEYS;
  let removed = 0;
  for (const key of sessionAttemptedViews.keys()) {
    sessionAttemptedViews.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function usePostViews() {
  const { user } = useAuth();

  const recordView = useCallback(
    async (postId: string, trigger: "impression" | "detail_open"): Promise<number | null> => {
      if (!postId) return null;

      // Keep a persistent guest key even for authenticated users
      // so the backend can dedupe guest->login transitions.
      const guestViewerKey = buildViewerKey(null);
      const dedupeIdentity = user?.id ? `u:${user.id}` : guestViewerKey;
      const dedupeKey = `${dedupeIdentity}:${postId}:${trigger}`;

      if (sessionAttemptedViews.has(dedupeKey)) {
        return null;
      }

      sessionAttemptedViews.set(dedupeKey, Date.now());
      pruneSessionDedupe();

      try {
        const { data, error } = await (supabase as any).rpc("record_post_view", {
          p_post_id: postId,
          p_viewer_key: guestViewerKey,
          p_trigger: trigger,
        });

        if (error) {
          sessionAttemptedViews.delete(dedupeKey);
          return null;
        }

        const count = Number((data as any)?.views_count);
        return Number.isFinite(count) ? count : null;
      } catch {
        sessionAttemptedViews.delete(dedupeKey);
        return null;
      }
    },
    [user?.id],
  );

  return { recordView };
}
