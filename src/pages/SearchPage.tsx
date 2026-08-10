import { useState, useEffect } from "react";
import { Search as SearchIcon, User, Hash, ArrowLeft, Send } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { PostWithProfile } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { usePostActions } from "@/hooks/usePostActions";
import { getNow } from "@/lib/utils";

function sanitizeSearchInput(val: string): string {
    return val.replace(/[%_(),."'\\]/g, "").trim();
}

function doesPostMatchSearch(post: Pick<PostWithProfile, "content" | "tags">, rawQuery: string): boolean {
    const sanitized = sanitizeSearchInput(rawQuery);
    if (!sanitized) return true;

    const normalizedQuery = sanitized.toLowerCase();
    const tagQuery = sanitized.replace("#", "");
    const tags = Array.isArray(post.tags) ? post.tags : [];

    const contentMatches = post.content.toLowerCase().includes(normalizedQuery);
    const tagMatches = tags.some((tag) => String(tag) === tagQuery);

    return contentMatches || tagMatches;
}

const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";
    const [searchTerm, setSearchTerm] = useState(query);
    const [results, setResults] = useState<{ profiles: any[], posts: PostWithProfile[] }>({ profiles: [], posts: [] });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"posts" | "users">("posts");
    const { user } = useAuth();
    const navigate = useNavigate();

    const performSearch = async (val: string) => {
        if (!val.trim()) {
            setResults({ profiles: [], posts: [] });
            return;
        }

        setLoading(true);
        try {
            const sanitized = sanitizeSearchInput(val);
            if (!sanitized.trim()) {
                setResults({ profiles: [], posts: [] });
                setLoading(false);
                return;
            }

            // 1. Search Profiles
            const { data: profiles } = await supabase
                .from("profiles")
                .select("*")
                .or(`username.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`)
                .limit(10);

            // 2. Search Posts
            const { data: postsData } = await (supabase
                .from("posts")
                .select(`
                    id, content, code, code_language, media_url, tags, created_at, edited_at, user_id, is_readme, views_count,
                    profiles ( username, display_name, avatar_url )
                `) as any)
                .or(`content.ilike.%${sanitized}%,tags.cs.{${sanitized.replace('#', '')}}`)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false })
                .limit(20);

            if (postsData) {
                const postIds = (postsData as any[]).map(p => p.id);

                const [{ data: likesData }, { data: commentsData }] = await Promise.all([
                    supabase.from("likes").select("post_id").in("post_id", postIds),
                    supabase.from("comments").select("post_id").in("post_id", postIds)
                ]);

                const likesCounts: Record<string, number> = {};
                (likesData || []).forEach((l: any) => {
                    likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
                });

                const commentsCounts: Record<string, number> = {};
                (commentsData || []).forEach((c: any) => {
                    commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
                });

                let userLikes = new Set<string>();
                let userBookmarks = new Set<string>();

                if (user) {
                    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
                        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
                        supabase.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds)
                    ]);
                    userLikes = new Set((myLikes || []).map(l => l.post_id));
                    userBookmarks = new Set((myBookmarks || []).map(b => b.post_id));
                }

                const enrichedPosts = postsData.map((p: any) => ({
                    ...p,
                    profiles: p.profiles as any,
                    views_count: Number(p.views_count || 0),
                    likes_count: likesCounts[p.id] || 0,
                    comments_count: commentsCounts[p.id] || 0,
                    user_liked: userLikes.has(p.id),
                    user_bookmarked: userBookmarks.has(p.id)
                })) as PostWithProfile[];

                setResults({
                    profiles: profiles || [],
                    posts: enrichedPosts
                });
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== query) {
                setSearchParams(searchTerm ? { q: searchTerm } : {});
            }
            if (searchTerm) {
                performSearch(searchTerm);
            } else {
                setResults({ profiles: [], posts: [] });
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (query && query !== searchTerm) {
            setSearchTerm(query);
        }
    }, [query]);

    const { toggleLike, toggleBookmark, deletePost } = usePostActions();

    const handleLike = (postId: string, currentlyLiked: boolean) => {
        if (!user) {
            toast.error("Please sign in to like posts");
            return;
        }
        toggleLike(postId, currentlyLiked);
        setResults(prev => ({
            ...prev,
            posts: prev.posts.map(p => p.id === postId ? {
                ...p,
                user_liked: !currentlyLiked,
                likes_count: currentlyLiked ? p.likes_count - 1 : p.likes_count + 1
            } : p)
        }));
    };

    const handleBookmark = (postId: string, currentlyBookmarked: boolean) => {
        if (!user) {
            toast.error("Please sign in to bookmark posts");
            return;
        }
        toggleBookmark(postId, currentlyBookmarked);
        setResults(prev => ({
            ...prev,
            posts: prev.posts.map(p => p.id === postId ? {
                ...p,
                user_bookmarked: !currentlyBookmarked
            } : p)
        }));
    };

    const handleDelete = async (postId: string) => {
        if (!user) return;
        try {
            await deletePost(postId);
            setResults(prev => ({
                ...prev,
                posts: prev.posts.filter(p => p.id !== postId)
            }));
        } catch (err) {
            toast.error("Failed to delete post");
        }
    };

    const handlePostEdited = (postId: string, updated: {
        content: string;
        code: string;
        code_language: string | null;
        media_url: string | null;
        is_readme: boolean;
        tags: string[];
        edited_at: string | null;
    }) => {
        setResults(prev => ({
            ...prev,
            posts: prev.posts
                .map((p) => p.id === postId ? { ...p, ...updated } : p)
                .filter((p) => doesPostMatchSearch(p, query)),
        }));
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors">
            <Helmet>
                <title>{query ? `Search: ${query} — Katchapp` : "Search — Katchapp"}</title>
            </Helmet>
            <Navbar />
            <main className="max-w-3xl mx-auto px-4 py-6">
                <div className="space-y-6">
                    {/* Search Header Bar */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors border border-zinc-200 dark:border-zinc-800"
                            title="Go back"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex-1 relative">
                            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
                            <input
                                type="text"
                                id="search-input"
                                name="search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search users, echoes, or #hashtags..."
                                className="w-full bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 pl-11 pr-4 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-sm font-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-6 border-b border-zinc-200 dark:border-zinc-800 px-2">
                        {(["posts", "users"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-sm font-semibold capitalize transition-all relative ${
                                    activeTab === tab
                                        ? "text-zinc-900 dark:text-zinc-100"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full"
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <FrogLoader className="text-sky-500" size={32} />
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Searching the abyss...</p>
                        </div>
                    ) : query ? (
                        <div className="space-y-4">
                            {activeTab === "posts" ? (
                                results.posts.length > 0 ? (
                                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-black shadow-sm divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {results.posts.map(post => (
                                            <PostCard
                                                key={post.id}
                                                post={post}
                                                onLike={handleLike}
                                                onBookmark={handleBookmark}
                                                onDelete={handleDelete}
                                                onPostEdited={handlePostEdited}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-12 text-center text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                                        No echoes found for "{query}"
                                    </div>
                                )
                            ) : (
                                results.profiles.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {results.profiles.map(profile => (
                                            <div
                                                key={profile.id}
                                                onClick={() => navigate(`/u/${profile.username}`)}
                                                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3.5 cursor-pointer bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm group"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 shadow-sm flex items-center justify-center font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                                                    {profile.avatar_url ? (
                                                        <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        profile.display_name[0].toUpperCase()
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:underline tracking-tight">{profile.display_name}</h4>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{profile.username}</p>
                                                </div>
                                                {user && user.id !== profile.user_id && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/whisper/${profile.username}`);
                                                        }}
                                                        className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-sky-500 hover:text-white transition-all shrink-0 text-zinc-600 dark:text-zinc-300 shadow-sm"
                                                        title="Whisper"
                                                    >
                                                        <Send size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-12 text-center text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                                        No users found for "{query}"
                                    </div>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center flex flex-col items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/30">
                            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                                <SearchIcon size={28} className="text-zinc-400 dark:text-zinc-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">Find what you're looking for</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
                                    Search for users, specific keywords, or use #hashtags to find trending topics.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SearchPage;