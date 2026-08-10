import { Users, Hash, Bug, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { getNow } from "@/lib/utils";

interface SuggestedProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  is_following?: boolean;
}

interface SidebarProps {
  onAction?: () => void;
}

const Sidebar = ({ onAction }: SidebarProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isHome = location.pathname === "/";
  const [suggestedDevs, setSuggestedDevs] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  // Use TanStack Query for trending tags
  const { data: rawTrendingTags, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["trending-tags"],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("tags")
        .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      if (!posts) return [];

      const counts: Record<string, number> = {};
      posts.forEach(p => {
        (p.tags || []).forEach((t: string) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });

      return Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    staleTime: 1000 * 60 * 5,
    enabled: isHome,
  });
  const trendingTags = rawTrendingTags ?? [];

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!isHome) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        let query = supabase
          .from("profiles")
          .select("*")
          .limit(30);

        if (user) {
          query = query.neq("user_id", user.id);
        }

        const { data: profiles, error: profilesError } = await query;
        if (profilesError) throw profilesError;

        if (profiles) {
          let candidates = profiles as SuggestedProfile[];

          if (user) {
            const { data: follows } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", user.id);

            const followedSet = new Set((follows || []).map(f => f.following_id));
            setFollowingIds(followedSet);
            candidates = candidates.filter(p => !followedSet.has(p.user_id));
          }

          const shuffled = [...candidates].sort(() => 0.5 - Math.random());
          setSuggestedDevs(shuffled.slice(0, 3));
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user, isHome]);

  const handleFollow = async (targetUserId: string) => {
    if (!user) {
      toast.error("Please sign in to follow users");
      return;
    }

    try {
      const isFollowing = followingIds.has(targetUserId);

      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);

        if (error) throw error;

        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
        toast.success("Unfollowed user");
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        if (error) throw error;

        setFollowingIds(prev => new Set(prev).add(targetUserId));
        toast.success("Following user");
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Failed to update follow status");
    }
  };

  return (
    <aside className="space-y-4">
      {isHome && (
        <>
          {/* Who to follow card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 transition-colors"
          >
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
              <Users size={16} className="text-sky-500" />
              {t("sidebar.whoToFollow")}
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-md w-2/3"></div>
                      <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/3"></div>
                    </div>
                    <div className="w-16 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {suggestedDevs.length > 0 ? (
                    suggestedDevs.map((dev) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={dev.user_id}
                        className="flex items-center gap-3 min-w-0"
                      >
                        <button
                          onClick={() => { navigate(`/u/${dev.username}`); onAction?.(); }}
                          className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden hover:opacity-80 transition-opacity text-zinc-900 dark:text-zinc-100"
                        >
                          {dev.avatar_url ? (
                            <img src={dev.avatar_url} alt={dev.username} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            dev.display_name.substring(0, 2).toUpperCase()
                          )}
                        </button>
                        <button
                          onClick={() => { navigate(`/u/${dev.username}`); onAction?.(); }}
                          className="flex-1 min-w-0 text-left group"
                        >
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                            {dev.display_name}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">@{dev.username}</p>
                        </button>
                        <button
                          onClick={() => handleFollow(dev.user_id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            followingIds.has(dev.user_id)
                              ? "border border-zinc-300 dark:border-zinc-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 text-zinc-700 dark:text-zinc-300"
                              : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 shadow-sm"
                          }`}
                        >
                          {followingIds.has(dev.user_id) ? t("sidebar.following") : t("sidebar.follow")}
                        </button>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-2 text-center">{t("sidebar.noSuggestions")}</p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Trending card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 transition-colors"
          >
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
              <Hash size={16} className="text-sky-500" />
              {t("sidebar.trending")}
            </h3>
            <div className="space-y-1">
              {isLoadingTrending ? (
                <div className="animate-pulse space-y-3 py-1">
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/2"></div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/3"></div>
                </div>
              ) : trendingTags.length > 0 ? (
                trendingTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => { navigate(`/search?q=${encodeURIComponent('#' + tag)}`); onAction?.(); }}
                    className="block w-full text-left group p-2 rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <p className="text-xs text-zinc-500 font-medium">Trending in tech</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline">#{tag}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{count} {t("sidebar.echoesIn24h")}</p>
                  </button>
                ))
              ) : (
                <p className="text-xs text-zinc-500 py-3 text-center italic">{t("sidebar.abyssQuiet")}</p>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Footer info & links card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 transition-colors"
      >
        <div className="flex flex-wrap justify-center items-center gap-x-1 gap-y-1 text-xs font-semibold text-zinc-500">
          <Link to="/about" onClick={() => onAction?.()} className="hover:text-sky-500 transition-colors px-1">{t("sidebar.about")}</Link>
          <span>·</span>
          <Link to="/terms" onClick={() => onAction?.()} className="hover:text-sky-500 transition-colors px-1">{t("sidebar.terms")}</Link>
          <span>·</span>
          <Link to="/privacy" onClick={() => onAction?.()} className="hover:text-sky-500 transition-colors px-1">{t("sidebar.privacy")}</Link>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1.5 text-xs">
          <a
            href={`https://github.com/iamovi/genjutsu/issues/new?template=bug_report.yml&title=${encodeURIComponent("[BUG]: ")}&environment=${encodeURIComponent(`- Page: ${window.location.href}\n- User Agent: ${navigator.userAgent}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.()}
            className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-sky-500 transition-colors font-medium"
          >
            <Bug size={14} />
            {t("sidebar.reportBug")}
          </a>
          <span>·</span>
          <a
            href="https://github.com/iamovi/genjutsu/issues/new?template=feature_request.yml"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onAction?.()}
            className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-sky-500 transition-colors font-medium"
          >
            <Lightbulb size={14} />
            {t("sidebar.requestFeature")}
          </a>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
          {t("sidebar.copyright")}
        </p>
      </motion.div>
    </aside>
  );
};

export default Sidebar;