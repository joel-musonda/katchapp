-- =============================================================================
-- Migration: Add server-side cooldown rate limiting for posts and comments
-- 
-- Creates:
--   1. user_action_log table (tracks action timestamps for cooldown checks)
--   2. create_post() function (30s cooldown, idempotency)
--   3. create_comment() function (15s cooldown, idempotency)
--   4. Drops direct INSERT RLS policies on posts and comments
-- =============================================================================


-- =============================================================================
-- 1. USER_ACTION_LOG TABLE
-- =============================================================================

CREATE TABLE public.user_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,           -- 'post' or 'comment'
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on idempotency key per user (prevents duplicate submissions)
CREATE UNIQUE INDEX idx_user_action_idempotency 
  ON public.user_action_log (user_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Index for fast cooldown lookups
CREATE INDEX idx_user_action_lookup 
  ON public.user_action_log (user_id, action_type, created_at DESC);

ALTER TABLE public.user_action_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own action log (for UI cooldown display)
CREATE POLICY "Users can view own action log"
  ON public.user_action_log FOR SELECT USING ((select auth.uid()) = user_id);

-- No direct INSERT/UPDATE/DELETE policies — only via functions


-- =============================================================================
-- 2. CREATE_POST FUNCTION (30s cooldown)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_post(
  p_content TEXT,
  p_code TEXT DEFAULT '',
  p_tags TEXT[] DEFAULT '{}',
  p_media_url TEXT DEFAULT '',
  p_is_readme BOOLEAN DEFAULT false,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_last_action_at TIMESTAMPTZ;
  v_seconds_since_last NUMERIC;
  v_cooldown_seconds INT := 30;
  v_retry_after INT;
  v_new_post_id UUID;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- 2. Idempotency check: if this key was already used, return success (no duplicate)
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_action_log
      WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  -- 3. Per-user advisory lock (prevents concurrent requests bypassing cooldown)
  PERFORM pg_advisory_xact_lock(hashtext('post:' || v_user_id::text));

  -- 4. Check cooldown
  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'post';

  IF v_last_action_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_last_action_at));

    IF v_seconds_since_last < v_cooldown_seconds THEN
      v_retry_after := CEIL(v_cooldown_seconds - v_seconds_since_last)::INT;
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'message', 'Please wait before posting again',
        'retry_after', v_retry_after
      );
    END IF;
  END IF;

  -- 5. All checks passed — insert the post
  INSERT INTO public.posts (user_id, content, code, tags, media_url, is_readme)
  VALUES (v_user_id, p_content, p_code, p_tags, p_media_url, p_is_readme)
  RETURNING id INTO v_new_post_id;

  -- 6. Log the action
  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'post', COALESCE(p_idempotency_key, v_new_post_id::text));

  RETURN jsonb_build_object('success', true, 'post_id', v_new_post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 3. CREATE_COMMENT FUNCTION (15s cooldown)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_comment(
  p_post_id UUID,
  p_content TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_last_action_at TIMESTAMPTZ;
  v_seconds_since_last NUMERIC;
  v_cooldown_seconds INT := 15;
  v_retry_after INT;
  v_new_comment_id UUID;
BEGIN
  -- 1. Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- 2. Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_action_log
      WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  -- 3. Per-user advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('comment:' || v_user_id::text));

  -- 4. Check cooldown
  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'comment';

  IF v_last_action_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_last_action_at));

    IF v_seconds_since_last < v_cooldown_seconds THEN
      v_retry_after := CEIL(v_cooldown_seconds - v_seconds_since_last)::INT;
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'message', 'Please wait before commenting again',
        'retry_after', v_retry_after
      );
    END IF;
  END IF;

  -- 5. Verify the post exists
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) THEN
    RETURN jsonb_build_object('error', 'post_not_found', 'message', 'Post not found');
  END IF;

  -- 6. All checks passed — insert the comment
  INSERT INTO public.comments (post_id, user_id, content)
  VALUES (p_post_id, v_user_id, p_content)
  RETURNING id INTO v_new_comment_id;

  -- 7. Log the action
  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'comment', COALESCE(p_idempotency_key, v_new_comment_id::text));

  RETURN jsonb_build_object('success', true, 'comment_id', v_new_comment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- 4. BLOCK DIRECT INSERTS (drop old RLS policies)
-- =============================================================================

-- Remove direct INSERT policy on posts
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;

-- Remove direct INSERT policy on comments
DROP POLICY IF EXISTS "Users can create their own comments" ON public.comments;


-- =============================================================================
-- 5. CLEANUP: Auto-delete old action log entries (piggyback on existing cron)
-- =============================================================================

-- Clean up action log entries older than 48 hours (they're no longer needed
-- for cooldown checks after 30s, but keep some buffer for debugging)
CREATE OR REPLACE FUNCTION public.delete_expired_action_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_action_log
  WHERE created_at < now() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT cron.schedule('10 * * * *', 'SELECT public.delete_expired_action_logs()');
