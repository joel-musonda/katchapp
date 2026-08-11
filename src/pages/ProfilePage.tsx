import { useParams, useNavigate } from "react-router-dom";
import { compressImage } from "@/lib/imageCompression";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostWithProfile } from "@/hooks/usePosts";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import { Calendar, Send, Bookmark, Github, Twitter, Facebook, Globe, Play, Pause, Ban, Share, Upload, Trash2, MessageCircle, Sparkles } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import EditProfileDialog from "@/components/EditProfileDialog";
import FollowsList from "@/components/FollowsList";
import { PostSkeleton } from "@/components/ui/skeleton";
import { getNow } from "@/lib/utils";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import DataSaverImage from "@/components/DataSaverImage";
import { PageTransition } from "@/components/ui/PageTransition";
import { useFollow } from "@/hooks/useFollow";
import { usePostActions } from "@/hooks/usePostActions";
import { linkify } from "@/lib/linkify";
import { shareWithFallback } from "@/lib/nativeShare";

interface ProfileData {
    id: string;
    user_id: string;
    username: string;
    display_name: string;
    bio: string;
    avatar_url: string;
    banner_url: string;
    social_links?: Record<string, string>;
    fav_song?: any;
    created_at: string;
    banned_until?: string | null;
    ban_permanent?: boolean;
    ban_reason?: string | null;
    ban_scopes?: string[] | null;
}

interface ProfileAlbumPhoto {
    id: string;
    user_id: string;
    photo_url: string;
    storage_path: string;
    created_at: string;
}

const ProfileLoadingSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        {/* Full-width Banner Skeleton */}
        <div className="w-full h-48 sm:h-72 bg-slate-200 dark:bg-zinc-800" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-24 relative z-10 space-y-6">
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[2.5rem] p-6 sm:p-10 shadow-sm">
                <div className="flex justify-between items-end mb-5">
                    <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-white dark:border-zinc-900 bg-slate-300 dark:bg-zinc-700 shadow-xl" />
                    <div className="flex gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800" />
                        <div className="w-24 h-10 rounded-full bg-slate-200 dark:bg-zinc-800" />
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="w-48 h-7 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="w-28 h-4 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                </div>
                <div className="space-y-2 mt-4">
                    <div className="w-full max-w-md h-4 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                    <div className="w-3/4 max-w-sm h-4 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                </div>
                <div className="flex gap-6 mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="w-20 h-4 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                    <div className="w-20 h-4 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                </div>
            </div>

            {/* Album Gallery Skeleton */}
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-4">
                <div className="w-36 h-5 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="aspect-square bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
                    ))}
                </div>
            </div>

            {/* Posts Skeletons */}
            <div className="space-y-5">
                <PostSkeleton />
                <PostSkeleton />
            </div>
        </div>
    </div>
);

const ProfilePage = () => {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [posts, setPosts] = useState<PostWithProfile[]>([]);
    const [bookmarks, setBookmarks] = useState<PostWithProfile[]>([]);
    const [albumPhotos, setAlbumPhotos] = useState<ProfileAlbumPhoto[]>([]);
    const [albumUploading, setAlbumUploading] = useState(false);
    const [albumDeletingIds, setAlbumDeletingIds] = useState<Set<string>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playAttemptIdRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const disposeAudio = (resetUi = true) => {
        if (!audioRef.current) return;

        playAttemptIdRef.current += 1;
        const audio = audioRef.current;
        audio.onplay = null;
        audio.onpause = null;
        audio.ontimeupdate = null;
        audio.onended = null;
        audio.pause();
        audio.src = "";
        audio.load();
        audioRef.current = null;

        if (resetUi) {
            setIsPlaying(false);
            setProgress(0);
        }
    };

    const ensureAudio = () => {
        if (!profile?.fav_song?.previewUrl) return null;
        if (audioRef.current) return audioRef.current;

        const audio = new Audio(profile.fav_song.previewUrl);
        audio.ontimeupdate = () => {
            if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
                setProgress(0);
                return;
            }
            setProgress((audio.currentTime / audio.duration) * 100);
        };
        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);
        audio.onended = () => {
            setIsPlaying(false);
            setProgress(0);
        };

        audioRef.current = audio;
        return audio;
    };

    const togglePlay = async () => {
        const audio = ensureAudio();
        if (!audio) return;

        const currentlyPlaying = !audio.paused && !audio.ended;
        if (currentlyPlaying) {
            playAttemptIdRef.current += 1;
            audio.pause();
        } else {
            const attemptId = ++playAttemptIdRef.current;
            setIsPlaying(true);
            try {
                await audio.play();
            } catch (error: any) {
                if (attemptId !== playAttemptIdRef.current) return;
                if (error?.name !== "AbortError") {
                    console.error("Audio playback failed:", error);
                    toast.error("Couldn't play song preview.");
                }
                if (audio.paused || audio.ended) {
                    setIsPlaying(false);
                }
            }
        }
    };

    useEffect(() => {
        disposeAudio();
    }, [profile?.fav_song?.previewUrl]);

    useEffect(() => {
        return () => {
            disposeAudio(false);
        };
    }, []);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"posts" | "bookmarks">("posts");

    const [followsModalOpen, setFollowsModalOpen] = useState(false);
    const [followsModalType, setFollowsModalType] = useState<"followers" | "following">("followers");
    const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
    const [isAlbumPreviewOpen, setIsAlbumPreviewOpen] = useState(false);
    const [selectedAlbumPhotoUrl, setSelectedAlbumPhotoUrl] = useState<string | null>(null);
    const albumInputRef = useRef<HTMLInputElement>(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    const { isFollowing, toggleFollow, stats, refresh: refreshFollows } = useFollow(profile?.user_id);

    const handleShareProfile = async () => {
        if (!profile?.username) return;

        const url = `${window.location.origin}/u/${profile.username}`;
        const title = `${profile.display_name} (@${profile.username}) on Katchapp`;
        const baseText = profile.bio?.trim() || `Check out @${profile.username} on Katchapp.`;
        const text = baseText.length > 140 ? `${baseText.slice(0, 137)}...` : baseText;

        const result = await shareWithFallback({ title, text, url });
        if (result === "copied") {
            toast.success("Profile link copied to clipboard!");
        } else if (result === "failed") {
            toast.error("Couldn't share this profile right now.");
        }
    };

    const fetchData = async () => {
        if (!username) return;

        try {
            setLoading(true);
            setAlbumPhotos([]);

            const { data: p, error: pError } = await supabase
                .from("profiles")
                .select("*")
                .eq("username", username.toLowerCase())
                .single();

            if (pError) throw pError;
            if (!p) throw new Error("Profile not found");
            setProfile(p as unknown as ProfileData);

            const { data: albumData, error: albumError } = await supabase
                .from("profile_album_photos")
                .select("id, user_id, photo_url, storage_path, created_at")
                .eq("user_id", (p as any).user_id)
                .order("created_at", { ascending: false });

            if (albumError) {
                console.error("Error fetching profile album:", albumError);
                setAlbumPhotos([]);
            } else {
                setAlbumPhotos((albumData || []) as ProfileAlbumPhoto[]);
            }

            const { data: postsData } = await (supabase
                .from("posts")
                .select(`
                  id, content, code, code_language, media_url, tags, created_at, edited_at, user_id, is_readme, views_count,
                  profiles ( username, display_name, avatar_url )
                `) as any)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .eq("user_id", (p as any).user_id)
                .order("created_at", { ascending: false });

            if (postsData && p) {
                const postIds = (postsData as any[]).map(post => post.id);

                const [{ data: likesData }, { data: commentsData }] = await Promise.all([
                    supabase.from("likes").select("post_id").in("post_id", postIds),
                    supabase.from("comments").select("post_id").in("post_id", postIds),
                ]);

                const likesCounts: Record<string, number> = {};
                (likesData || []).forEach((l: any) => {
                    likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
                });

                const commentsCounts: Record<string, number> = {};
                (commentsData || []).forEach((c: any) => {
                    commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
                });

                let userLikes: Set<string> = new Set();
                let userBookmarks: Set<string> = new Set();

                if (user) {
                    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
                        supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
                        supabase.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds),
                    ]);
                    userLikes = new Set((myLikes || []).map((l: any) => l.post_id));
                    userBookmarks = new Set((myBookmarks || []).map((b: any) => b.post_id));
                }

                const enriched = postsData.map(post => ({
                    ...post,
                    profiles: post.profiles as any,
                    views_count: Number((post as any).views_count || 0),
                    likes_count: likesCounts[post.id] || 0,
                    user_liked: userLikes.has(post.id),
                    user_bookmarked: userBookmarks.has(post.id),
                    comments_count: commentsCounts[post.id] || 0
                } as PostWithProfile));
                setPosts(enriched);
            }

        } catch (err: any) {
            console.error("Error fetching profile:", err);
            toast.error("Profile not found");
            navigate("/");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [username, user?.id]);

    const fetchBookmarks = async () => {
        if (!user || !profile || user.id !== profile.user_id) return;

        try {
            const { data: bookmarkRows } = await supabase
                .from("bookmarks")
                .select("post_id")
                .eq("user_id", user.id);

            if (!bookmarkRows || bookmarkRows.length === 0) {
                setBookmarks([]);
                return;
            }

            const postIds = bookmarkRows.map((b: any) => b.post_id);

            const { data: postsData } = await (supabase
                .from("posts")
                .select(`
                    id, content, code, code_language, media_url, tags, created_at, edited_at, user_id, is_readme, views_count,
                    profiles ( username, display_name, avatar_url )
                `) as any)
                .in("id", postIds)
                .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false });

            if (!postsData || postsData.length === 0) {
                setBookmarks([]);
                return;
            }

            const activePostIds = (postsData as any[]).map(p => p.id);

            const [{ data: likesData }, { data: commentsData }] = await Promise.all([
                supabase.from("likes").select("post_id").in("post_id", activePostIds),
                supabase.from("comments").select("post_id").in("post_id", activePostIds),
            ]);

            const likesCounts: Record<string, number> = {};
            (likesData || []).forEach((l: any) => {
                likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
            });

            const commentsCounts: Record<string, number> = {};
            (commentsData || []).forEach((c: any) => {
                commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
            });

            const [{ data: myLikes }] = await Promise.all([
                supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", activePostIds),
            ]);
            const userLikes = new Set((myLikes || []).map((l: any) => l.post_id));

            const enriched = postsData.map(post => ({
                ...post,
                profiles: post.profiles as any,
                views_count: Number((post as any).views_count || 0),
                likes_count: likesCounts[post.id] || 0,
                user_liked: userLikes.has(post.id),
                user_bookmarked: true,
                comments_count: commentsCounts[post.id] || 0
            } as PostWithProfile));

            setBookmarks(enriched);
        } catch (err) {
            console.error("Error fetching bookmarks:", err);
        }
    };

    useEffect(() => {
        if (activeTab === "bookmarks" && profile && user?.id === profile.user_id) {
            fetchBookmarks();
        }
    }, [activeTab, profile?.user_id, user?.id]);

    const handleAlbumUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;
        if (!user || !profile || user.id !== profile.user_id) {
            toast.error("You can only edit your own album.");
            return;
        }
        if (albumPhotos.length >= 5) {
            toast.error("Album is full. Delete a photo before uploading a new one.");
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file.");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("That image is too large. Please keep it under 2MB.");
            return;
        }

        const compressedFile = await compressImage(file);
        const fileExt = compressedFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

        setAlbumUploading(true);
        try {
            const { error: uploadError } = await supabase.storage
                .from("profile-album")
                .upload(filePath, compressedFile);
            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage.from("profile-album").getPublicUrl(filePath);
            const photoUrl = publicData.publicUrl;

            const { data: insertedPhoto, error: insertError } = await supabase
                .from("profile_album_photos")
                .insert({
                    user_id: user.id,
                    photo_url: photoUrl,
                    storage_path: filePath,
                })
                .select("id, user_id, photo_url, storage_path, created_at")
                .single();

            if (insertError) {
                await supabase.storage.from("profile-album").remove([filePath]);
                if ((insertError.message || "").includes("album_limit_exceeded")) {
                    toast.error("Album is full. Delete a photo before uploading a new one.");
                    return;
                }
                throw insertError;
            }

            setAlbumPhotos((prev) => [insertedPhoto as ProfileAlbumPhoto, ...prev].slice(0, 5));
            toast.success("Photo added to your album.");
        } catch (error) {
            console.error("Error uploading album photo:", error);
            toast.error("Couldn't upload photo right now. Please try again.");
        } finally {
            setAlbumUploading(false);
        }
    };

    const handleAlbumDelete = async (photo: ProfileAlbumPhoto) => {
        if (!user || !profile || user.id !== profile.user_id) {
            toast.error("You can only edit your own album.");
            return;
        }
        if (albumDeletingIds.has(photo.id)) return;

        setAlbumDeletingIds((prev) => {
            const next = new Set(prev);
            next.add(photo.id);
            return next;
        });

        try {
            const { error: removeError } = await supabase.storage
                .from("profile-album")
                .remove([photo.storage_path]);
            if (removeError) throw removeError;

            const { error: deleteError } = await supabase
                .from("profile_album_photos")
                .delete()
                .eq("id", photo.id)
                .eq("user_id", user.id);
            if (deleteError) throw deleteError;

            setAlbumPhotos((prev) => prev.filter((item) => item.id !== photo.id));
            toast.success("Photo deleted from album.");
        } catch (error) {
            console.error("Error deleting album photo:", error);
            toast.error("Couldn't delete photo. Please try again.");
        } finally {
            setAlbumDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(photo.id);
                return next;
            });
        }
    };

    const openAlbumPreview = (photoUrl: string) => {
        setSelectedAlbumPhotoUrl(photoUrl);
        setIsAlbumPreviewOpen(true);
    };

    const { toggleLike, toggleBookmark, deletePost } = usePostActions();

    const handleLike = async (postId: string, currentlyLiked: boolean) => {
        if (!user) {
            toast.error("Please sign in to like posts");
            return;
        }

        toggleLike(postId, currentlyLiked);
        setPosts((prev) =>
            prev.map((p) => {
                if (p.id === postId) {
                    return {
                        ...p,
                        user_liked: !currentlyLiked,
                        likes_count: currentlyLiked ? p.likes_count - 1 : p.likes_count + 1,
                    };
                }
                return p;
            })
        );
    };

    const handleBookmark = async (postId: string, currentlyBookmarked: boolean) => {
        if (!user) {
            toast.error("Please sign in to bookmark posts");
            return;
        }

        toggleBookmark(postId, currentlyBookmarked);
        setPosts((prev) =>
            prev.map((p) => {
                if (p.id === postId) {
                    return { ...p, user_bookmarked: !currentlyBookmarked };
                }
                return p;
            })
        );
        if (currentlyBookmarked) {
            setBookmarks((prev) => prev.filter((p) => p.id !== postId));
        } else {
            setBookmarks((prev) =>
                prev.map((p) => p.id === postId ? { ...p, user_bookmarked: true } : p)
            );
        }
    };

    const handleDelete = async (postId: string) => {
        if (!user) return;
        try {
            await deletePost(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
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
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...updated } : p));
        setBookmarks((prev) => prev.map((p) => p.id === postId ? { ...p, ...updated } : p));
    };

    const initials = profile?.display_name?.substring(0, 2).toUpperCase() || "??";
    const isOwnProfile = user?.id === profile?.user_id;
    const hasActiveBan = !!(
        isOwnProfile &&
        profile &&
        (profile.ban_permanent || (profile.banned_until && new Date(profile.banned_until) > getNow()))
    );

    const normalizedScopes = Array.from(
        new Set(
            (Array.isArray(profile?.ban_scopes) ? profile.ban_scopes : [])
                .filter((scope): scope is string => typeof scope === "string")
                .map((scope) => scope.toLowerCase())
        )
    );

    const isGlobalRestriction = normalizedScopes.length === 0;
    const blockedActions = isGlobalRestriction
        ? [
            "Create posts",
            "Write comments",
            "Like and unlike posts",
            "Bookmark and unbookmark posts",
            "Follow and unfollow users",
            "Send whispers",
        ]
        : [
            ...(normalizedScopes.includes("post") ? ["Create posts"] : []),
            ...(normalizedScopes.includes("comment") ? ["Write comments"] : []),
            ...(normalizedScopes.includes("social") ? ["Like/bookmark/follow interactions"] : []),
            ...(normalizedScopes.includes("message") ? ["Send whispers"] : []),
        ];
    const blockedActionsDisplay = blockedActions.length > 0
        ? blockedActions
        : ["Restricted actions are configured by admin."];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 font-sans tracking-tight antialiased transition-colors selection:bg-sky-500 selection:text-white">
            {profile && (
                <Helmet>
                    <title>{profile.display_name} (@{profile.username}) — Katchapp</title>
                    <meta name="description" content={profile.bio || `Check out ${profile.display_name}'s profile on Katchapp.`} />
                    <meta property="og:title" content={`${profile.display_name} (@{profile.username}) — Katchapp`} />
                    <meta property="og:description" content={profile.bio || `Check out ${profile.display_name}'s profile on Katchapp.`} />
                    <meta property="og:image" content={profile.avatar_url || "/fav.jpg"} />
                </Helmet>
            )}
            <Navbar />

            {/* Full-width Cover Image Banner */}
            {!loading && profile && (
                <div className="w-full h-48 sm:h-72 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 relative overflow-hidden flex items-center justify-center">
                    {profile.banner_url ? (
                        <img
                            src={profile.banner_url}
                            alt="Banner"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 opacity-40 text-sky-600 dark:text-sky-400">
                            <Sparkles size={36} />
                            <span className="text-xs font-semibold uppercase tracking-widest">Katchapp Creator</span>
                        </div>
                    )}
                </div>
            )}

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10 -mt-16 sm:-mt-24">
                <PageTransition className="grid grid-cols-1 gap-8">
                    <div className="space-y-6 min-w-0">
                        {loading ? (
                            <ProfileLoadingSkeleton />
                        ) : !profile ? (
                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-12 text-center text-slate-500 shadow-sm">
                                Profile not found.
                            </div>
                        ) : (
                            <>
                                {/* Modern Minimalist Profile Header Card */}
                                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[2.5rem] p-6 sm:p-10 shadow-lg transition-all">
                                    <div className="flex justify-between items-end mb-5">
                                        <div
                                            onClick={() => profile.avatar_url && setIsAvatarPreviewOpen(true)}
                                            className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-white dark:border-zinc-900 bg-white dark:bg-zinc-800 flex items-center justify-center text-3xl sm:text-4xl font-black tracking-tighter shadow-xl overflow-hidden transition-transform hover:scale-105 ${profile.avatar_url ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            {profile.avatar_url ? (
                                                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
                                            ) : initials}
                                        </div>
                                        {profile.avatar_url && (
                                            <ImagePreviewDialog
                                                src={profile.avatar_url}
                                                isOpen={isAvatarPreviewOpen}
                                                onOpenChange={setIsAvatarPreviewOpen}
                                                alt={`${profile.display_name}'s avatar`}
                                            />
                                        )}

                                        <div className="flex items-center gap-2.5">
                                            {isOwnProfile ? (
                                                <div className="flex items-center gap-2.5">
                                                    <button
                                                        onClick={handleShareProfile}
                                                        className="p-3 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white rounded-full transition-all border border-slate-200/80 dark:border-zinc-700/80 shadow-sm hover:scale-105"
                                                        title="Share profile"
                                                    >
                                                        <Share size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/qna/${profile.username}`)}
                                                        className="px-4 py-3 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md hover:bg-sky-50 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 rounded-full text-xs font-semibold transition-all border border-slate-200/80 dark:border-zinc-700/80 shadow-sm flex items-center gap-2 hover:scale-105"
                                                        title="Ask me anything"
                                                    >
                                                        <MessageCircle size={15} className="text-sky-500" />
                                                        Ask me anything
                                                    </button>
                                                    <EditProfileDialog
                                                        currentProfile={{
                                                            display_name: profile.display_name,
                                                            bio: profile.bio,
                                                            avatar_url: profile.avatar_url,
                                                            banner_url: profile.banner_url,
                                                            social_links: profile.social_links,
                                                            fav_song: profile.fav_song
                                                        }}
                                                        onUpdate={fetchData}
                                                    >
                                                        <button className="px-5 py-3 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-md shadow-sky-500/25 transition-all hover:scale-105 flex items-center gap-2">
                                                            <Sparkles size={14} />
                                                            Edit Profile
                                                        </button>
                                                    </EditProfileDialog>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2.5">
                                                    <button
                                                        onClick={() => {
                                                            if (!user) {
                                                                toast.error("Please sign in to send messages");
                                                                return;
                                                            }
                                                            navigate(`/whisper/${profile.username}`);
                                                        }}
                                                        className="p-3 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white rounded-full transition-all border border-slate-200/80 dark:border-zinc-700/80 shadow-sm hover:scale-105"
                                                        title="Whisper"
                                                    >
                                                        <Send size={18} />
                                                    </button>
                                                    <button
                                                        onClick={handleShareProfile}
                                                        className="p-3 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white rounded-full transition-all border border-slate-200/80 dark:border-zinc-700/80 shadow-sm hover:scale-105"
                                                        title="Share profile"
                                                    >
                                                        <Share size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/qna/${profile.username}`)}
                                                        className="px-4 py-3 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-md hover:bg-sky-50 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 rounded-full text-xs font-semibold transition-all border border-slate-200/80 dark:border-zinc-700/80 shadow-sm flex items-center gap-2 hover:scale-105"
                                                        title="Ask me anything"
                                                    >
                                                        <MessageCircle size={15} className="text-sky-500" />
                                                        Ask me anything
                                                    </button>
                                                    <button
                                                        onClick={toggleFollow}
                                                        className={`px-6 py-3 rounded-full text-xs font-semibold transition-all shadow-md hover:scale-105 ${isFollowing ? 'bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-300 dark:hover:bg-zinc-700' : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/25'}`}
                                                    >
                                                        {isFollowing ? 'Following' : 'Follow'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {hasActiveBan && (
                                        <div className="my-5">
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 flex items-start gap-3.5 text-red-600 dark:text-red-400">
                                                <div className="bg-red-500 text-white p-2.5 rounded-2xl shrink-0 shadow-md">
                                                    <Ban size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold">Account Restricted</h3>
                                                    {profile.ban_permanent ? (
                                                        <p className="text-xs mt-0.5">
                                                            Ban type: <strong className="font-semibold">Permanent</strong>
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs mt-0.5">
                                                            Ban type: <strong className="font-semibold">Temporary</strong> until <strong className="font-semibold">{new Date(profile.banned_until as string).toLocaleString()}</strong>.
                                                        </p>
                                                    )}
                                                    {profile.ban_reason && (
                                                        <p className="text-xs mt-0.5">
                                                            Reason: <strong className="font-semibold">{profile.ban_reason}</strong>
                                                        </p>
                                                    )}
                                                    <div className="mt-2.5">
                                                        <p className="text-xs font-medium">You currently cannot:</p>
                                                        <ul className="mt-1 text-xs list-disc ml-4 space-y-0.5">
                                                            {blockedActionsDisplay.map((action) => (
                                                                <li key={action}>{action}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                            {profile.display_name}
                                        </h1>
                                        <p className="text-sm font-medium text-sky-600 dark:text-sky-400">@{profile.username}</p>
                                    </div>

                                    <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-300 max-w-2xl whitespace-pre-wrap font-normal">
                                        {profile.bio ? linkify(profile.bio) : "No bio yet."}
                                    </p>

                                    {profile.social_links && Object.values(profile.social_links).some(link => link) && (
                                        <div className="flex flex-wrap gap-2.5 mt-5">
                                            {Object.entries(profile.social_links).map(([platform, link]) => {
                                                if (!link) return null;

                                                const formattedLink = link.startsWith('http') ? link : `https://${link}`;
                                                const icons: Record<string, any> = {
                                                    github: Github,
                                                    twitter: Twitter,
                                                    facebook: Facebook,
                                                    website: Globe
                                                };
                                                const Icon = icons[platform] || Globe;

                                                return (
                                                    <a
                                                        key={platform}
                                                        href={formattedLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-2 bg-slate-100/80 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 hover:text-sky-500 dark:hover:text-sky-400 rounded-xl transition-all hover:scale-105 border border-slate-200/80 dark:border-zinc-700/50 flex items-center gap-2 text-xs font-semibold shadow-sm"
                                                        title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                                                    >
                                                        <Icon size={16} />
                                                        <span className="capitalize">{platform}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {profile.fav_song && (
                                        <div className="mt-6">
                                            <div className="inline-flex items-center gap-3.5 px-4 py-3 bg-slate-50 dark:bg-zinc-800/50 backdrop-blur-md border border-slate-200/80 dark:border-zinc-700/80 rounded-2xl shadow-sm">
                                                <div className="relative group shrink-0">
                                                    <DataSaverImage
                                                        src={profile.fav_song.artworkUrl100}
                                                        className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 animate-spin-slow"
                                                        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                                                        alt=""
                                                    />
                                                    <button
                                                        onClick={togglePlay}
                                                        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                                    >
                                                        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                                    </button>
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex gap-1 items-end h-3 mb-1">
                                                        {[1, 2, 3, 4, 5].map(i => (
                                                            <div
                                                                key={i}
                                                                className={`w-1 bg-sky-500 rounded-full transition-all duration-300 ${isPlaying ? 'animate-music-bar' : 'h-1'}`}
                                                                style={{ animationDelay: `${i * 0.15}s` }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-xs font-bold truncate max-w-[240px] text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                                                        {profile.fav_song.trackName}
                                                        <span className="w-1 h-1 rounded-full bg-slate-400" />
                                                        <span className="opacity-70 font-normal">{profile.fav_song.artistName}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-6 mt-6 text-xs font-medium text-slate-500 dark:text-zinc-400">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} />
                                            <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 mt-5 pt-5 border-t border-slate-100 dark:border-zinc-800/80">
                                        <button
                                            onClick={() => {
                                                setFollowsModalType("following");
                                                setFollowsModalOpen(true);
                                            }}
                                            className="hover:opacity-80 flex items-center gap-1.5 text-sm transition-opacity"
                                        >
                                            <span className="font-extrabold text-slate-900 dark:text-white">{stats.following}</span>
                                            <span className="text-slate-500 dark:text-zinc-400 font-medium">Following</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setFollowsModalType("followers");
                                                setFollowsModalOpen(true);
                                            }}
                                            className="hover:opacity-80 flex items-center gap-1.5 text-sm transition-opacity"
                                        >
                                            <span className="font-extrabold text-slate-900 dark:text-white">{stats.followers}</span>
                                            <span className="text-slate-500 dark:text-zinc-400 font-medium">Followers</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Album Section */}
                                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Album Gallery</h2>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                                                Persistent showcase photos.
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full text-slate-600 dark:text-zinc-300">
                                            {albumPhotos.length}/5
                                        </span>
                                    </div>

                                    {isOwnProfile && (
                                        <div className="mt-5">
                                            <input
                                                ref={albumInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleAlbumUpload}
                                            />
                                            <button
                                                onClick={() => albumInputRef.current?.click()}
                                                disabled={albumUploading || albumPhotos.length >= 5}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-sky-500/20"
                                            >
                                                {albumUploading ? <FrogLoader className="" size={16} /> : <Upload size={15} />}
                                                {albumPhotos.length >= 5 ? "Album Full (5/5)" : "Upload Photo"}
                                            </button>
                                        </div>
                                    )}

                                    {albumPhotos.length === 0 ? (
                                        <div className="mt-5 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center text-xs text-slate-400 font-medium">
                                            No album photos yet.
                                        </div>
                                    ) : (
                                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                            {albumPhotos.map((photo) => {
                                                const isDeleting = albumDeletingIds.has(photo.id);
                                                return (
                                                    <div key={photo.id} className="relative group rounded-2xl overflow-hidden border border-slate-200/80 dark:border-zinc-800 aspect-square shadow-sm">
                                                        <button
                                                            onClick={() => openAlbumPreview(photo.photo_url)}
                                                            className="w-full h-full hover:opacity-95 transition-opacity"
                                                            title="Open photo"
                                                        >
                                                            <DataSaverImage
                                                                src={photo.photo_url}
                                                                alt={`${profile.display_name} album photo`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                        {isOwnProfile && (
                                                            <button
                                                                onClick={() => handleAlbumDelete(photo)}
                                                                disabled={isDeleting}
                                                                className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-colors disabled:opacity-60 shadow-sm"
                                                                title="Delete photo"
                                                            >
                                                                {isDeleting ? <FrogLoader className="" size={14} /> : <Trash2 size={14} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Tabs & Posts */}
                                <div className="space-y-5">
                                    {isOwnProfile ? (
                                        <div className="flex border-b border-slate-200 dark:border-zinc-800/80">
                                            {(["posts", "bookmarks"] as const).map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveTab(tab)}
                                                    className={`flex-1 sm:flex-none px-6 py-3.5 text-sm font-semibold capitalize transition-all relative flex items-center justify-center gap-2 ${activeTab === tab ? "text-sky-500 dark:text-sky-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
                                                >
                                                    {tab === "bookmarks" && <Bookmark size={15} />}
                                                    {tab}
                                                    {activeTab === tab && (
                                                        <motion.div
                                                            layoutId="profileTab"
                                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full"
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <h2 className="font-bold text-lg tracking-tight px-1 text-slate-900 dark:text-white">Posts</h2>
                                    )}

                                    {activeTab === "posts" ? (
                                        posts.length === 0 ? (
                                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-12 text-center text-slate-400 text-sm font-medium shadow-sm">
                                                No posts yet.
                                            </div>
                                        ) : (
                                            posts.map((post, index) => (
                                                <div
                                                    key={post.id}
                                                    className="animate-fade-in"
                                                    style={{ animationDelay: `${(index % 10) * 50}ms`, animationFillMode: "both" }}
                                                >
                                                    <PostCard
                                                        post={post}
                                                        onLike={handleLike}
                                                        onBookmark={handleBookmark}
                                                        onDelete={handleDelete}
                                                        onPostEdited={handlePostEdited}
                                                    />
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        bookmarks.length === 0 ? (
                                            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl p-12 text-center flex flex-col items-center gap-3 shadow-sm">
                                                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                                                    <Bookmark size={28} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">No bookmarks yet</h3>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                                                        Save posts to find them later.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            bookmarks.map((post, index) => (
                                                <div
                                                    key={post.id}
                                                    className="animate-fade-in"
                                                    style={{ animationDelay: `${(index % 10) * 50}ms`, animationFillMode: "both" }}
                                                >
                                                    <PostCard
                                                        post={post}
                                                        onLike={handleLike}
                                                        onBookmark={handleBookmark}
                                                        onDelete={handleDelete}
                                                        onPostEdited={handlePostEdited}
                                                    />
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </PageTransition>
            </main>

            <ImagePreviewDialog
                src={selectedAlbumPhotoUrl}
                isOpen={isAlbumPreviewOpen}
                onOpenChange={(open) => {
                    setIsAlbumPreviewOpen(open);
                    if (!open) setSelectedAlbumPhotoUrl(null);
                }}
                alt={profile ? `${profile.display_name}'s album photo` : "Album photo"}
            />

            {profile && (
                <FollowsList
                    userId={profile.user_id}
                    type={followsModalType}
                    isOpen={followsModalOpen}
                    onOpenChange={setFollowsModalOpen}
                    onAction={refreshFollows}
                />
            )}
        </div>
    );
};

export default ProfilePage;