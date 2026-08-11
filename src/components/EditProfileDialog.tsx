import { useState, useEffect, useMemo, useRef } from "react";
import { compressImage } from "@/lib/imageCompression";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit3, Camera, Link as LinkIcon, ChevronDown, ChevronUp, Music, Search, Play, Pause, X } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getNow, getSafeUrl } from "@/lib/utils";
import DataSaverImage from "@/components/DataSaverImage";

interface EditProfileDialogProps {
    currentProfile: {
        display_name: string;
        bio: string;
        avatar_url: string | null;
        banner_url: string | null;
        social_links?: Record<string, string>;
        fav_song?: any;
    };
    onUpdate: () => void;
}

const MAX_DISPLAY_NAME = 40;
const MAX_BIO = 280;

const SOCIAL_PLATFORMS = [
    { id: "github", label: "GitHub", placeholder: "https://github.com/username" },
    { id: "twitter", label: "Twitter / X", placeholder: "https://x.com/username" },
    { id: "facebook", label: "Facebook", placeholder: "https://facebook.com/username" },
    { id: "website", label: "Website", placeholder: "https://yourwebsite.com" },
] as const;

const normalizeUrlInput = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

const isHttpUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const sanitizeSocialLinks = (links: Record<string, string>): Record<string, string> => {
    const cleaned = Object.entries(links).reduce<Record<string, string>>((acc, [key, value]) => {
        const normalized = normalizeUrlInput(String(value || ""));
        if (normalized) acc[key] = normalized;
        return acc;
    }, {});
    return cleaned;
};

const getSongIdentity = (song: any) => {
    if (!song) return null;
    return song.trackId || song.previewUrl || song.trackName || null;
};

const EditProfileDialog = ({ currentProfile, onUpdate }: EditProfileDialogProps) => {
    const [displayName, setDisplayName] = useState(currentProfile.display_name);
    const [bio, setBio] = useState(currentProfile.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatar_url || "");
    const [bannerUrl, setBannerUrl] = useState(currentProfile.banner_url || "");
    const [socialLinks, setSocialLinks] = useState<Record<string, string>>(currentProfile.social_links || {});
    const [favSong, setFavSong] = useState<any>(currentProfile.fav_song || null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
    const [showUrls, setShowUrls] = useState(false);
    const [showSocials, setShowSocials] = useState(false);
    const [showMusic, setShowMusic] = useState(false);
    const [songQuery, setSongQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [hasSearchedSongs, setHasSearchedSongs] = useState(false);
    const [open, setOpen] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previewAttemptIdRef = useRef(0);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const initialDisplayName = currentProfile.display_name || "";
    const initialBio = currentProfile.bio || "";
    const initialAvatarUrl = currentProfile.avatar_url || "";
    const initialBannerUrl = currentProfile.banner_url || "";
    const initialSocialLinks = useMemo(
        () => sanitizeSocialLinks(currentProfile.social_links || {}),
        [currentProfile.social_links],
    );
    const initialSongIdentity = getSongIdentity(currentProfile.fav_song);

    const trimmedDisplayName = displayName.trim();
    const displayNameCount = displayName.length;
    const bioCount = bio.length;

    const normalizedAvatarUrl = normalizeUrlInput(avatarUrl);
    const normalizedBannerUrl = normalizeUrlInput(bannerUrl);
    const normalizedSocialLinks = useMemo(() => sanitizeSocialLinks(socialLinks), [socialLinks]);

    const avatarUrlError = normalizedAvatarUrl && !isHttpUrl(normalizedAvatarUrl)
        ? "Please enter a valid http(s) URL."
        : "";
    const bannerUrlError = normalizedBannerUrl && !isHttpUrl(normalizedBannerUrl)
        ? "Please enter a valid http(s) URL."
        : "";

    const socialLinkErrors = useMemo(() => {
        return Object.entries(normalizedSocialLinks).reduce<Record<string, string>>((acc, [key, value]) => {
            if (value && !isHttpUrl(value)) {
                acc[key] = "Please enter a valid http(s) URL.";
            }
            return acc;
        }, {});
    }, [normalizedSocialLinks]);

    const hasValidationErrors = Boolean(
        avatarUrlError ||
        bannerUrlError ||
        Object.keys(socialLinkErrors).length > 0
    );

    const hasUnsavedChanges = useMemo(() => {
        const socialChanged =
            JSON.stringify(normalizedSocialLinks) !== JSON.stringify(initialSocialLinks);

        return (
            trimmedDisplayName !== initialDisplayName ||
            bio !== initialBio ||
            normalizedAvatarUrl !== initialAvatarUrl ||
            normalizedBannerUrl !== initialBannerUrl ||
            socialChanged ||
            getSongIdentity(favSong) !== initialSongIdentity ||
            !!avatarFile ||
            !!bannerFile
        );
    }, [
        trimmedDisplayName,
        initialDisplayName,
        bio,
        initialBio,
        normalizedAvatarUrl,
        initialAvatarUrl,
        normalizedBannerUrl,
        initialBannerUrl,
        normalizedSocialLinks,
        initialSocialLinks,
        favSong,
        initialSongIdentity,
        avatarFile,
        bannerFile,
    ]);

    const canSubmit = hasUnsavedChanges && !hasValidationErrors && trimmedDisplayName.length > 0 && !submitting;

    useEffect(() => {
        if (open) {
            setDisplayName(currentProfile.display_name);
            setBio(currentProfile.bio || "");
            setAvatarUrl(currentProfile.avatar_url || "");
            setBannerUrl(currentProfile.banner_url || "");
            setSocialLinks(currentProfile.social_links || {});
            setFavSong(currentProfile.fav_song || null);
            setShowMusic(Boolean(currentProfile.fav_song));
            setShowSocials(Object.values(currentProfile.social_links || {}).some((value) => String(value || "").trim() !== ""));
            setShowUrls(false);
            setSearchResults([]);
            setSongQuery("");
            setHasSearchedSongs(false);
            setAvatarFile(null);
            setBannerFile(null);
            setAvatarPreviewUrl(null);
            setBannerPreviewUrl(null);
            setUploadingAvatar(false);
            setUploadingBanner(false);
        } else {
            if (audioRef.current) {
                previewAttemptIdRef.current += 1;
                audioRef.current.pause();
                audioRef.current = null;
                setPlayingPreview(null);
            }
        }

        return () => {
            if (audioRef.current) {
                previewAttemptIdRef.current += 1;
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        };
    }, [avatarPreviewUrl]);

    useEffect(() => {
        return () => {
            if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
        };
    }, [bannerPreviewUrl]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setOpen(true);
            return;
        }

        if (submitting) return;
        if (hasUnsavedChanges) {
            const shouldDiscard = window.confirm("You have unsaved changes. Discard them?");
            if (!shouldDiscard) return;
        }
        setOpen(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, bucket: 'avatars' | 'banners') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please choose a valid image file.");
            e.target.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("That file is a bit too heavy! Please keep it under 2MB.");
            e.target.value = "";
            return;
        }

        const isAvatar = bucket === 'avatars';
        const previewUrl = URL.createObjectURL(file);

        if (isAvatar) {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
            setAvatarFile(file);
            setAvatarPreviewUrl(previewUrl);
            setAvatarUrl("");
        } else {
            if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
            setBannerFile(file);
            setBannerPreviewUrl(previewUrl);
            setBannerUrl("");
        }
        e.target.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trimmedDisplayName) {
            toast.error("Display name is required");
            return;
        }
        if (!hasUnsavedChanges) {
            toast.message("No changes to save.");
            return;
        }
        if (hasValidationErrors) {
            toast.error("Please fix the invalid URL fields before saving.");
            return;
        }

        try {
            setSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            let finalAvatarUrl = normalizedAvatarUrl;
            let finalBannerUrl = normalizedBannerUrl;

            const uploadFile = async (file: File, bucket: 'avatars' | 'banners') => {
                const compressedFile = await compressImage(file, {
                    maxWidthOrHeight: bucket === 'avatars' ? 400 : 1080,
                    maxSizeMB: bucket === 'avatars' ? 0.2 : 0.5,
                });
                const fileExt = compressedFile.name.split('.').pop();
                const filePath = `${user.id}/${Math.random()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, compressedFile);
                if (uploadError) throw uploadError;
                return supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
            };

            const uploadPromises = [];
            
            if (avatarFile) {
                setUploadingAvatar(true);
                uploadPromises.push(
                    uploadFile(avatarFile, 'avatars')
                        .then(url => {
                            finalAvatarUrl = url;
                        })
                        .finally(() => setUploadingAvatar(false))
                );
            }
            if (bannerFile) {
                setUploadingBanner(true);
                uploadPromises.push(
                    uploadFile(bannerFile, 'banners')
                        .then(url => {
                            finalBannerUrl = url;
                        })
                        .finally(() => setUploadingBanner(false))
                );
            }

            if (uploadPromises.length > 0) {
                await Promise.all(uploadPromises);
            }

            const cleanupOldFile = async (oldUrl: string | null, newUrl: string | null, bucket: 'avatars' | 'banners') => {
                const bucketUrl = supabase.storage.from(bucket).getPublicUrl('').data.publicUrl;
                if (oldUrl && oldUrl.includes(bucketUrl) && oldUrl !== newUrl) {
                    const oldPath = oldUrl.split(`${bucket}/`).pop();
                    if (oldPath) {
                        await supabase.storage.from(bucket).remove([oldPath]);
                    }
                }
            };

            await Promise.all([
                cleanupOldFile(currentProfile.avatar_url, finalAvatarUrl, 'avatars'),
                cleanupOldFile(currentProfile.banner_url, finalBannerUrl, 'banners')
            ]);

            const { error } = await supabase
                .from("profiles")
                .update({
                    display_name: trimmedDisplayName,
                    bio: bio.trim(),
                    avatar_url: finalAvatarUrl,
                    banner_url: finalBannerUrl,
                    social_links: normalizedSocialLinks,
                    fav_song: favSong,
                    updated_at: getNow().toISOString(),
                })
                .eq("user_id", user.id);

            if (error) throw error;

            toast.success("Profile updated successfully!");
            setOpen(false);
            onUpdate();
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast.error("Something went wrong while updating your identity. Please try again.");
        } finally {
            setSubmitting(false);
            setUploadingAvatar(false);
            setUploadingBanner(false);
        }
    };

    const searchSongs = async () => {
        if (!songQuery.trim()) return;
        setSearching(true);
        setHasSearchedSongs(true);
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(songQuery)}&entity=song&limit=20`);
            const data = await response.json();
            setSearchResults((data.results || []).filter((song: any) => song?.trackId));
        } catch (error) {
            console.error("Error searching songs:", error);
            toast.error("Failed to search songs");
        } finally {
            setSearching(false);
        }
    };

    const togglePreview = async (previewUrl?: string) => {
        if (!previewUrl) {
            toast.error("No preview available for this song.");
            return;
        }
        if (playingPreview === previewUrl) {
            previewAttemptIdRef.current += 1;
            audioRef.current?.pause();
            setPlayingPreview(null);
        } else {
            if (audioRef.current) {
                previewAttemptIdRef.current += 1;
                audioRef.current.pause();
            }
            const audio = new Audio(previewUrl);
            audioRef.current = audio;
            const attemptId = ++previewAttemptIdRef.current;
            audio.onended = () => {
                if (attemptId !== previewAttemptIdRef.current) return;
                setPlayingPreview(null);
            };
            setPlayingPreview(previewUrl);

            try {
                await audio.play();
            } catch (error: any) {
                if (attemptId !== previewAttemptIdRef.current) return;
                if (error?.name !== "AbortError") {
                    console.error("Preview playback failed:", error);
                    toast.error("Couldn't play song preview.");
                }
                setPlayingPreview(null);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <button className="rounded-xl bg-secondary hover:bg-muted border border-input text-foreground font-semibold flex items-center gap-2 text-xs sm:text-sm px-4 py-2.5 transition-all shadow-sm active:scale-[0.98] whitespace-nowrap">
                    <Edit3 size={16} /> Edit Profile
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl w-full h-full sm:h-[90vh] rounded-none sm:rounded-3xl bg-card border border-border/60 shadow-2xl p-0 overflow-hidden flex flex-col backdrop-blur-2xl [&>button:last-child]:hidden">
                <DialogDescription className="sr-only">Update your display name, bio, social links, and profile images.</DialogDescription>
                <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background overflow-hidden">
                    {/* Top Navigation Bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-card/80 backdrop-blur-xl shrink-0 z-10">
                        <button
                            type="button"
                            onClick={() => handleOpenChange(false)}
                            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-xl hover:bg-muted/50"
                        >
                            Cancel
                        </button>
                        <DialogTitle className="text-base font-bold tracking-tight">Edit Profile</DialogTitle>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="rounded-xl bg-primary text-primary-foreground font-semibold px-5 py-2.5 shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? <FrogLoader size={16} /> : "Save Changes"}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_420px] gap-8 p-6 sm:p-10">
                            {/* Left Column: Visual Previews */}
                            <div className="space-y-6">
                                <Label className="font-bold text-base block mb-2 text-foreground">Profile Appearance</Label>
                                <div className="bg-card border border-border/60 rounded-3xl shadow-xl shadow-black/5 overflow-hidden backdrop-blur-2xl">
                                    {/* Banner Preview */}
                                    <div className="h-44 sm:h-72 w-full bg-muted relative group overflow-hidden border-b border-border/40">
                                        {(bannerPreviewUrl || bannerUrl) ? (
                                            <img src={getSafeUrl(bannerPreviewUrl || bannerUrl)} alt="Banner" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-medium bg-muted/40">
                                                No Banner Image
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                            <button
                                                type="button"
                                                onClick={() => bannerInputRef.current?.click()}
                                                disabled={uploadingBanner}
                                                className="p-4 bg-background/90 text-foreground shadow-xl rounded-2xl hover:bg-background transition-all transform scale-95 group-hover:scale-100 flex items-center gap-2 font-medium text-xs"
                                            >
                                                {uploadingBanner ? <FrogLoader size={20} /> : <Camera size={20} />}
                                                <span>Change Banner</span>
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            ref={bannerInputRef}
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, 'banners')}
                                        />
                                    </div>

                                    {/* Avatar Preview */}
                                    <div className="flex sm:block p-6 pt-0">
                                        {/* Mobile / Inline avatar */}
                                        <div className="sm:hidden flex justify-center -mt-14 pb-2 w-full">
                                            <div className="relative group w-24 h-24 rounded-2xl border-4 border-background bg-muted overflow-hidden shadow-xl">
                                                {(avatarPreviewUrl || avatarUrl) ? (
                                                    <img src={getSafeUrl(avatarPreviewUrl || avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-muted text-muted-foreground">
                                                        {displayName[0]?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => avatarInputRef.current?.click()}
                                                        disabled={uploadingAvatar}
                                                        className="p-2.5 bg-background/90 text-foreground shadow-lg rounded-xl hover:bg-background transition-all"
                                                    >
                                                        {uploadingAvatar ? <FrogLoader size={16} /> : <Camera size={16} />}
                                                    </button>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    ref={avatarInputRef}
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(e, 'avatars')}
                                                />
                                            </div>
                                        </div>
                                        {/* Desktop overlapping avatar */}
                                        <div className="hidden sm:block relative h-16">
                                            <div className="absolute -top-16 left-6">
                                                <div className="relative group w-32 h-32 rounded-2xl border-4 border-background bg-muted overflow-hidden shadow-2xl">
                                                    {(avatarPreviewUrl || avatarUrl) ? (
                                                        <img src={getSafeUrl(avatarPreviewUrl || avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-muted text-muted-foreground">
                                                            {displayName[0]?.toUpperCase() || "?"}
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => avatarInputRef.current?.click()}
                                                            disabled={uploadingAvatar}
                                                            className="p-3 bg-background/90 text-foreground shadow-xl rounded-xl hover:bg-background transition-all transform scale-95 group-hover:scale-100"
                                                        >
                                                            {uploadingAvatar ? <FrogLoader size={20} /> : <Camera size={20} />}
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        ref={avatarInputRef}
                                                        accept="image/*"
                                                        onChange={(e) => handleFileUpload(e, 'avatars')}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Profile Info */}
                            <div className="space-y-6 lg:sticky lg:top-0 h-fit">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label htmlFor="displayName" className="font-semibold text-sm text-foreground">Display Name</Label>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {displayNameCount}/{MAX_DISPLAY_NAME}
                                        </span>
                                    </div>
                                    <Input
                                        id="displayName"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        maxLength={MAX_DISPLAY_NAME}
                                        className="rounded-2xl border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                        placeholder="What should we call you?"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Keep it short and recognizable.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label htmlFor="bio" className="font-semibold text-sm text-foreground">Bio</Label>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {bioCount}/{MAX_BIO}
                                        </span>
                                    </div>
                                    <Textarea
                                        id="bio"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        maxLength={MAX_BIO}
                                        className="rounded-2xl border border-input bg-background p-4 text-sm min-h-[140px] resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                        placeholder="Write something about yourself..."
                                    />
                                </div>

                                {/* Social Links Section */}
                                <div className="pt-4 border-t border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setShowSocials(!showSocials)}
                                        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all p-3 rounded-xl hover:bg-muted/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <LinkIcon size={14} className="text-muted-foreground" />
                                            <span>{showSocials ? "Hide Social Platforms" : "Add Social Platforms"}</span>
                                        </div>
                                        {showSocials ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showSocials && (
                                        <div className="mt-3 space-y-4 p-5 bg-card border border-border/60 rounded-2xl shadow-sm animate-in slide-in-from-top-3 duration-200 backdrop-blur-xl">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Paste full links. If you omit protocol, <code className="text-primary font-semibold">https://</code> will be added automatically.
                                            </p>
                                            {SOCIAL_PLATFORMS.map((platform) => (
                                                <div key={platform.id} className="space-y-1.5">
                                                    <Label htmlFor={platform.id} className="text-xs font-semibold text-muted-foreground">
                                                        {platform.label}
                                                    </Label>
                                                    <Input
                                                        id={platform.id}
                                                        value={socialLinks[platform.id] || ""}
                                                        onChange={(e) => setSocialLinks(prev => ({ ...prev, [platform.id]: e.target.value }))}
                                                        className="rounded-xl border border-input bg-background h-10 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        placeholder={platform.placeholder}
                                                    />
                                                    {socialLinkErrors[platform.id] && (
                                                        <p className="text-xs text-destructive font-medium mt-1">{socialLinkErrors[platform.id]}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Favorite Song Section */}
                                <div className="pt-4 border-t border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setShowMusic(!showMusic)}
                                        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all p-3 rounded-xl hover:bg-muted/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Music size={14} className="text-muted-foreground" />
                                            <span>{favSong ? "Change Profile Music" : "Add Profile Music"}</span>
                                        </div>
                                        {showMusic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showMusic && (
                                        <div className="mt-3 space-y-4 p-5 bg-card border border-border/60 rounded-2xl shadow-sm animate-in slide-in-from-top-3 duration-200 backdrop-blur-xl">
                                            {favSong && (
                                                <div className="flex items-center gap-3 p-3 bg-background border border-border/60 rounded-2xl mb-3 shadow-sm">
                                                    <DataSaverImage src={favSong.artworkUrl100} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-xs truncate text-foreground">{favSong.trackName}</p>
                                                        <p className="text-[11px] text-muted-foreground truncate">{favSong.artistName}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFavSong(null)}
                                                        className="p-2 hover:bg-muted text-muted-foreground hover:text-destructive rounded-xl transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        value={songQuery}
                                                        onChange={(e) => setSongQuery(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchSongs())}
                                                        className="rounded-xl border border-input bg-background pl-9 text-xs h-10 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                        placeholder="Search artists or songs..."
                                                    />
                                                    <Music className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={searchSongs}
                                                    disabled={searching}
                                                    className="rounded-xl bg-primary text-primary-foreground px-4 h-10 flex items-center justify-center shadow-md shadow-primary/20 hover:opacity-95 disabled:opacity-50 transition-all"
                                                >
                                                    {searching ? <FrogLoader size={16} /> : <Search size={16} />}
                                                </button>
                                            </div>

                                            <div className="space-y-2 mt-3 max-h-60 overflow-y-auto pr-1">
                                                {hasSearchedSongs && !searching && searchResults.length === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center py-4">
                                                        No songs found. Try another keyword.
                                                    </p>
                                                )}
                                                {searchResults.map((song) => (
                                                    <div
                                                        key={song.trackId}
                                                        className="flex items-center gap-3 p-2.5 bg-background border border-border/40 rounded-xl hover:border-primary/40 transition-all cursor-pointer group shadow-sm"
                                                        onClick={() => setFavSong(song)}
                                                    >
                                                        <div className="relative w-10 h-10 shrink-0">
                                                            <DataSaverImage src={song.artworkUrl100} className="w-full h-full rounded-lg object-cover shadow-sm" alt="" />
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    togglePreview(song.previewUrl);
                                                                }}
                                                                disabled={!song.previewUrl}
                                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-lg disabled:opacity-60 disabled:cursor-not-allowed backdrop-blur-[1px]"
                                                            >
                                                                {playingPreview === song.previewUrl ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                                            </button>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-xs truncate text-foreground">{song.trackName}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{song.artistName}</p>
                                                        </div>
                                                        {favSong?.trackId === song.trackId && (
                                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse mr-1" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* URL Toggles */}
                                <div className="pt-4 border-t border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setShowUrls(!showUrls)}
                                        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all p-3 rounded-xl hover:bg-muted/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <LinkIcon size={14} className="text-muted-foreground" />
                                            <span>{showUrls ? "Hide Advanced Settings" : "Show Advanced: Edit via URL"}</span>
                                        </div>
                                        {showUrls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showUrls && (
                                        <div className="mt-3 space-y-4 p-5 bg-card border border-border/60 rounded-2xl shadow-sm animate-in slide-in-from-top-3 duration-200 backdrop-blur-xl">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                You can paste direct image links. If protocol is missing, <code className="text-primary font-semibold">https://</code> will be added automatically.
                                            </p>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="avatarUrl" className="text-xs font-semibold text-muted-foreground">Custom Avatar URL</Label>
                                                <Input
                                                    id="avatarUrl"
                                                    value={avatarUrl}
                                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                                    className="rounded-xl border border-input bg-background h-10 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                    placeholder="https://example.com/avatar.png"
                                                />
                                                {avatarUrlError && (
                                                    <p className="text-xs text-destructive font-medium mt-1">{avatarUrlError}</p>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="bannerUrl" className="text-xs font-semibold text-muted-foreground">Custom Banner URL</Label>
                                                <Input
                                                    id="bannerUrl"
                                                    value={bannerUrl}
                                                    onChange={(e) => setBannerUrl(e.target.value)}
                                                    className="rounded-xl border border-input bg-background h-10 text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                                    placeholder="https://example.com/banner.png"
                                                />
                                                {bannerUrlError && (
                                                    <p className="text-xs text-destructive font-medium mt-1">{bannerUrlError}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditProfileDialog;