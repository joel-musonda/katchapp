import { useState, useEffect, useRef, memo, useMemo, lazy, Suspense } from "react";
import { Hash, Heart, MessageSquare, Share, Bookmark, MoreHorizontal, Trash2, Send, Languages, Eye, Pencil } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { PostWithProfile } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { usePostViews } from "@/hooks/usePostViews";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { getNow } from "@/lib/utils";
import { getConfig } from "@/lib/config";
import { linkify } from "@/lib/linkify";
import { shareWithFallback } from "@/lib/nativeShare";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import EditPostDialog from "@/components/EditPostDialog";
import PostLikesDialog from "@/components/PostLikesDialog";
import DataSaverImage from "@/components/DataSaverImage";
import { CodeBlockWithPreview } from "./CodeBlockWithPreview";

const MarkdownContent = lazy(() => import("./MarkdownContent"));

interface PostCardProps {
  post: PostWithProfile;
  onLike: (postId: string, liked: boolean) => void;
  onBookmark: (postId: string, bookmarked: boolean) => void;
  onDelete?: (postId: string) => void;
  onPostEdited?: (postId: string, updated: {
    content: string;
    code: string;
    code_language: string | null;
    media_url: string | null;
    is_readme: boolean;
    tags: string[];
    edited_at: string | null;
  }) => void;
}

function timeAgo(dateStr: string): string {
  const diff = getNow().getTime() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

const PostCard = memo(({ post, onLike, onBookmark, onDelete, onPostEdited }: PostCardProps) => {
  const { user } = useAuth();
  const { recordView } = usePostViews();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isLikesDialogOpen, setIsLikesDialogOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const [viewCount, setViewCount] = useState<number>(post.views_count || 0);

  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const initials = post.profiles?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const isOwner = user?.id === post.user_id;

  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [likeBurstId, setLikeBurstId] = useState(0);
  const likeAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (likeAnimationTimeoutRef.current !== null) window.clearTimeout(likeAnimationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setViewCount(Number(post.views_count || 0));
  }, [post.id, post.views_count]);

  useEffect(() => {
    const node = articleRef.current;
    if (!node) return;

    let observer: IntersectionObserver | null = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
        if (!hit) return;

        void recordView(post.id, "impression").then((count) => {
          if (typeof count === "number") setViewCount((prev) => Math.max(prev, count));
        });

        observer?.disconnect();
        observer = null;
      },
      { threshold: [0.5] }
    );

    observer.observe(node);
    return () => { observer?.disconnect(); };
  }, [post.id, recordView]);

  const isAlreadyEnglish = useMemo(() => {
    const text = post.content.trim();
    if (!text) return true;
    const hasOtherScripts = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/.test(text);
    return !hasOtherScripts;
  }, [post.content]);

  const rawContent = isShowingTranslation && translatedContent ? translatedContent : post.content;
  const isLongPost = rawContent.length > 300;
  const displayContent = isLongPost && !isTextExpanded ? rawContent.slice(0, 300) + '…' : rawContent;

  const codeLines = post.code?.split('\n') || [];
  const isLongCode = codeLines.length > 10;
  const truncatedCode = isLongCode ? codeLines.slice(0, 10).join('\n') + '\n…' : post.code;

  const handleTranslate = async () => {
    if (isShowingTranslation) {
      setIsShowingTranslation(false);
      return;
    }
    if (translatedContent) {
      setIsShowingTranslation(true);
      return;
    }
    try {
      setIsTranslating(true);
      const apiUrl = getConfig().VITE_LANG_SERVICE;
      const response = await fetch(`${apiUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: post.content, target: 'en' })
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTranslatedContent(data.translatedText);
      setIsShowingTranslation(true);
      toast.success("Translated to English");
    } catch {
      toast.error("Could not translate post.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLikeClick = () => {
    const willLike = !post.user_liked;
    onLike(post.id, post.user_liked);
    if (!willLike) return;

    setLikeBurstId((id) => id + 1);
    setIsLikeAnimating(true);
    if (likeAnimationTimeoutRef.current !== null) window.clearTimeout(likeAnimationTimeoutRef.current);
    likeAnimationTimeoutRef.current = window.setTimeout(() => setIsLikeAnimating(false), 520);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    const result = await shareWithFallback({ url });
    if (result === "copied") toast.success("Link copied!");
  };

  return (
    <article ref={articleRef} className="bg-white dark:bg-black border-b border-zinc-200/80 dark:border-zinc-800/80 p-4 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-950/40">
      <div className="flex gap-3.5">
        <button
          onClick={() => navigate(`/u/${post.profiles?.username}`)}
          className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden hover:opacity-90 transition-opacity text-zinc-900 dark:text-zinc-100 shadow-sm"
        >
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt={post.profiles.username} className="w-full h-full object-cover" loading="lazy" />
          ) : initials}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <button
                onClick={() => navigate(`/u/${post.profiles?.username}`)}
                className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-100 hover:underline truncate"
              >
                {post.profiles?.display_name || "Unknown"}
              </button>
              <span className="text-zinc-500 dark:text-zinc-400 text-sm font-normal truncate">@{post.profiles?.username || "?"}</span>
              <span className="text-zinc-400 dark:text-zinc-600 text-xs font-light">·</span>
              <span className="text-zinc-500 dark:text-zinc-400 text-xs font-normal">{timeAgo(post.created_at)}</span>
              {post.edited_at && <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">(edited)</span>}
            </div>

            {isOwner && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 bg-white dark:bg-zinc-900 p-1.5 z-50 min-w-[120px] shadow-xl rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => { setIsEditDialogOpen(true); setShowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 transition-colors"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { onDelete?.(post.id); setShowMenu(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isOwner && (
            <EditPostDialog
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
              post={post}
              onEdited={(updated) => onPostEdited?.(post.id, updated)}
            />
          )}

          {post.is_readme ? (
            <Suspense fallback={<div className="mt-3 p-4 flex justify-center"><FrogLoader size={20} /></div>}>
              <MarkdownContent content={displayContent} isLongPost={isLongPost} isTextExpanded={isTextExpanded} onToggleExpand={() => setIsTextExpanded(!isTextExpanded)} />
            </Suspense>
          ) : (
            <div className="mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-zinc-900 dark:text-zinc-100 font-normal">
              <p>{linkify(displayContent)}</p>
              {isLongPost && (
                <button type="button" onClick={() => setIsTextExpanded(!isTextExpanded)} className="text-sky-500 font-medium mt-1.5 hover:underline text-xs inline-block">
                  {isTextExpanded ? 'Show Less' : 'Show More'}
                </button>
              )}
            </div>
          )}

          {post.media_url && (
            <>
              <div
                onClick={() => setIsImagePreviewOpen(true)}
                className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-zinc-100 dark:bg-zinc-900 cursor-pointer block shadow-sm"
              >
                <DataSaverImage src={post.media_url} alt="Post content" className="w-full h-auto max-h-[500px] object-cover mx-auto" loading="lazy" />
              </div>
              <ImagePreviewDialog src={post.media_url} isOpen={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen} alt="Post content" />
            </>
          )}

          {post.code && (
            <CodeBlockWithPreview
              code={post.code}
              language={post.code_language || "javascript"}
              isExpanded={isCodeExpanded}
              onToggleExpand={() => setIsCodeExpanded(!isCodeExpanded)}
              isLongCode={isLongCode}
              truncatedCode={truncatedCode}
              isMarkdown={false}
            />
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  onClick={(e) => { e.stopPropagation(); navigate(`/search?q=${encodeURIComponent('#' + tag)}`); }}
                  className="text-xs font-medium text-sky-500 hover:underline cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Twitter-style action footer bar */}
          <div className="flex items-center justify-between mt-3 text-zinc-500 dark:text-zinc-400 max-w-md pt-1">
            <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 text-xs font-medium hover:text-sky-500 transition-colors group">
              <div className="p-2 rounded-full group-hover:bg-sky-500/10 transition-colors"><MessageSquare size={16} /></div>
              <span>{post.comments_count}</span>
            </Link>

            <button
              type="button"
              onClick={handleLikeClick}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors group ${post.user_liked ? "text-red-500" : "hover:text-red-500"}`}
            >
              <div className="p-2 rounded-full group-hover:bg-red-500/10 transition-colors">
                <Heart size={16} fill={post.user_liked ? "currentColor" : "none"} />
              </div>
              <span onClick={(e) => { e.stopPropagation(); setIsLikesDialogOpen(true); }}>{post.likes_count}</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs font-medium">
              <div className="p-2"><Eye size={16} /></div>
              <span>{viewCount}</span>
            </div>

            <button
              type="button"
              onClick={() => onBookmark(post.id, post.user_bookmarked)}
              className={`p-2 rounded-full hover:bg-amber-500/10 hover:text-amber-500 transition-colors ${post.user_bookmarked ? "text-amber-500" : ""}`}
            >
              <Bookmark size={16} fill={post.user_bookmarked ? "currentColor" : "none"} />
            </button>

            {!isAlreadyEnglish && (
              <button
                type="button"
                onClick={handleTranslate}
                disabled={isTranslating}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Translate"
              >
                {isTranslating ? <FrogLoader size={14} /> : <Languages size={16} />}
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-full hover:bg-sky-500/10 hover:text-sky-500 transition-colors"
            >
              <Share size={16} />
            </button>
          </div>

          <PostLikesDialog postId={post.id} isOpen={isLikesDialogOpen} onOpenChange={setIsLikesDialogOpen} />
        </div>
      </div>
    </article>
  );
});

export default PostCard;