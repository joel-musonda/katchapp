import { useState, useRef, useEffect } from "react";
import { compressImage } from "@/lib/imageCompression";
import { useParams, useNavigate } from "react-router-dom";
import { useWhispers, Whisper } from "@/hooks/useWhispers";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Send, ImageIcon, X, CheckCheck } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { linkify } from "@/lib/linkify";
import WhisperLinkPreview from "@/components/WhisperLinkPreview";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import DataSaverImage from "@/components/DataSaverImage";

const ChatPage = () => {
    const { username } = useParams<{ username: string }>();
    const [targetProfile, setTargetProfile] = useState<{ user_id: string; display_name: string; avatar_url: string | null; username: string } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [messageText, setMessageText] = useState("");
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
    const [activeLightboxImageUrl, setActiveLightboxImageUrl] = useState<string | null>(null);
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);

    // Fetch target profile first
    useEffect(() => {
        const fetchProfile = async () => {
            if (!username) return;
            try {
                setLoadingProfile(true);
                const { data, error } = await supabase
                    .from("profiles")
                    .select("user_id, display_name, avatar_url, username")
                    .eq("username", username.toLowerCase())
                    .single();

                if (error) throw error;
                if (!data) throw new Error("User not found");
                if (user && data.user_id === user.id) {
                    toast.error("You can't whisper to yourself!");
                    navigate("/whispers");
                    return;
                }
                setTargetProfile(data);
            } catch (err: any) {
                console.error("Profile load error:", err);
                toast.error("Character not found in the abyss");
                navigate("/whispers");
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
    }, [username, navigate, user]);

    const { messages, loadingMessages, sendMessage, isSending, setTyping, isOtherUserTyping } = useWhispers(targetProfile?.user_id);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOtherUserTyping]);

    useEffect(() => {
        const selection = window.getSelection?.();
        if (selection && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    }, []);

    useEffect(() => {
        return () => {
            if (selectedImagePreviewUrl) {
                URL.revokeObjectURL(selectedImagePreviewUrl);
            }
        };
    }, [selectedImagePreviewUrl]);

    const clearSelectedImage = () => {
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }
        setSelectedImageFile(null);
        setSelectedImagePreviewUrl(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const handleImageFile = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB.");
            return;
        }

        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }

        setSelectedImageFile(file);
        setSelectedImagePreviewUrl(URL.createObjectURL(file));
    };

    const uploadSelectedImage = async (): Promise<{ publicUrl: string; filePath: string } | null> => {
        if (!selectedImageFile || !user) return null;

        const compressedFile = await compressImage(selectedImageFile);
        const fileExt = compressedFile.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("whisper-media")
            .upload(filePath, compressedFile);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage.from("whisper-media").getPublicUrl(filePath);
        return { publicUrl: data.publicUrl, filePath };
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMessageText(value);

        if (!targetProfile || !user) return;

        setTyping(true);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
        }, 2000);
    };

    const handleComposerDragEnter = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
        if (!hasFiles) return;
        dragDepthRef.current += 1;
        setIsDraggingImage(true);
    };

    const handleComposerDragOver = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
        if (!hasFiles && isDraggingImage) {
            setIsDraggingImage(false);
            dragDepthRef.current = 0;
        }
    };

    const handleComposerDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingImage(false);
        }
    };

    const handleComposerDrop = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = 0;
        setIsDraggingImage(false);

        const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
        if (!hasFiles) return;
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        handleImageFile(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!messageText.trim() && !selectedImageFile) || isSending || isUploadingImage || !targetProfile) return;

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTyping(false);

        let uploadedPath: string | null = null;
        try {
            let mediaUrl: string | null = null;

            if (selectedImageFile) {
                setIsUploadingImage(true);
                const uploadResult = await uploadSelectedImage();
                if (uploadResult) {
                    mediaUrl = uploadResult.publicUrl;
                    uploadedPath = uploadResult.filePath;
                }
            }

            await sendMessage(messageText.trim(), mediaUrl);
            setMessageText("");
            clearSelectedImage();
        } catch (err) {
            if (uploadedPath) {
                await supabase.storage.from("whisper-media").remove([uploadedPath]).catch(() => { });
            }
        } finally {
            setIsUploadingImage(false);
        }
    };

    if (loadingProfile || loadingMessages) {
        return (
            <div
                className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center select-none transition-colors"
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
            >
                <FrogLoader className="text-sky-500" size={32} />
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 animate-pulse pointer-events-none font-medium">Whispering to the abyss...</p>
            </div>
        );
    }

    if (!targetProfile) return null;

    return (
        <div className="h-[100svh] bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col overflow-hidden transition-colors">
            <Helmet>
                <title>Whispering to {targetProfile.display_name} — genjutsu</title>
            </Helmet>
            <div className="shrink-0">
                <Navbar />
                <header className="z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (window.history.length > 2) {
                                        navigate(-1);
                                    } else {
                                        navigate("/whispers");
                                    }
                                }}
                                className="p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors border border-zinc-200 dark:border-zinc-800"
                                title="Go back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/u/${targetProfile.username}`)}
                                className="flex items-center gap-3 min-w-0 text-left rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 p-1.5 -m-1.5 transition-all group"
                                aria-label={`Open ${targetProfile.display_name}'s profile`}
                            >
                                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-sm text-zinc-900 dark:text-zinc-100">
                                    {targetProfile.avatar_url ? (
                                        <img src={targetProfile.avatar_url} alt={targetProfile.username} className="w-full h-full object-cover" loading="lazy" />
                                    ) : targetProfile.display_name[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-sm -mb-0.5 truncate group-hover:underline text-zinc-900 dark:text-zinc-100 tracking-tight">{targetProfile.display_name}</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{targetProfile.username}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </header>
            </div>

            <main className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 space-y-4 scrollbar-hide flex flex-col">
                <div className="flex-1" />
                {messages && messages.length > 0 ? (
                    messages.map((whisper: Whisper) => {
                        const isMe = whisper.sender_id === user?.id;
                        const hasText = typeof whisper.content === "string" && whisper.content.trim().length > 0;
                        const readReceiptClass = whisper.is_read ? "text-emerald-500" : "text-zinc-400 dark:text-zinc-500";
                        return (
                            <motion.div
                                key={whisper.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-3 text-sm rounded-2xl shadow-sm ${
                                    isMe
                                        ? "bg-sky-500 text-white rounded-br-sm"
                                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
                                }`}>
                                    {hasText ? (
                                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                                            {linkify(whisper.content)}
                                        </p>
                                    ) : null}
                                    {whisper.media_url ? (
                                        <button
                                            type="button"
                                            onClick={() => setActiveLightboxImageUrl(whisper.media_url)}
                                            className={`block w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 cursor-zoom-in ${hasText ? "mt-2.5" : ""}`}
                                            aria-label="Open whisper image"
                                        >
                                            <DataSaverImage
                                                src={whisper.media_url}
                                                alt="Whisper image"
                                                className="w-full max-h-72 object-cover"
                                                loading="lazy"
                                            />
                                        </button>
                                    ) : null}
                                    {hasText ? <WhisperLinkPreview content={whisper.content} isMe={isMe} /> : null}
                                    <span className={`text-[10px] mt-2 flex items-center gap-1.5 font-mono ${isMe ? "justify-end text-white/80" : "text-zinc-500 dark:text-zinc-400"}`}>
                                        <span className="opacity-70">{new Date(whisper.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {isMe ? (
                                            <CheckCheck
                                                size={14}
                                                strokeWidth={2.5}
                                                className={readReceiptClass}
                                                aria-label={whisper.is_read ? "Viewed" : "Sent"}
                                                role="img"
                                            />
                                        ) : null}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="py-20 text-center text-xs text-zinc-500 dark:text-zinc-400 italic flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center shadow-sm bg-zinc-50 dark:bg-zinc-900">
                            <Send size={16} className="opacity-40" />
                        </div>
                        This conversation is a void. Start whispering now.
                    </div>
                )}

                <AnimatePresence>
                    {isOtherUserTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="flex justify-start mb-2"
                        >
                            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-sm">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce" />
                                </div>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 italic">
                                    {targetProfile.display_name} is whispering...
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} className="h-4" />
            </main>

            <ImagePreviewDialog
                src={activeLightboxImageUrl}
                isOpen={!!activeLightboxImageUrl}
                onOpenChange={(open) => {
                    if (!open) setActiveLightboxImageUrl(null);
                }}
                alt="Whisper image preview"
            />

            <footer className={`shrink-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t p-4 pb-safe transition-colors ${
                isDraggingImage ? "border-sky-500 bg-sky-500/5" : "border-zinc-200 dark:border-zinc-800"
            }`}>
                <form
                    onSubmit={handleSend}
                    onDragEnter={handleComposerDragEnter}
                    onDragOver={handleComposerDragOver}
                    onDragLeave={handleComposerDragLeave}
                    onDrop={handleComposerDrop}
                    autoComplete="off"
                    className="max-w-4xl mx-auto space-y-3"
                >
                    {isDraggingImage ? (
                        <div className="text-center text-xs font-semibold text-sky-500 py-1">
                            Drop image to attach to this whisper
                        </div>
                    ) : null}
                    {selectedImagePreviewUrl ? (
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <DataSaverImage src={selectedImagePreviewUrl} alt="Selected whisper upload" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={clearSelectedImage}
                                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/80 dark:bg-black/80 hover:bg-white dark:hover:bg-black transition-colors shadow-sm text-zinc-700 dark:text-zinc-300"
                                aria-label="Remove selected image"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ) : null}

                    <div className="flex gap-3 items-center">
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageFile(e.target.files?.[0] || null)}
                        />

                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="h-10 w-10 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-all text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 shadow-sm"
                            title="Attach image"
                            aria-label="Attach image"
                        >
                            <ImageIcon size={18} />
                        </button>

                        <input
                            type="text"
                            id="whisper-message-input"
                            name="whisper-message"
                            value={messageText}
                            onChange={handleInputChange}
                            placeholder="Type a whisper... they vanish in 24h"
                            className="flex-1 bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 px-4 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-sm font-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            enterKeyHint="send"
                        />
                        <button
                            type="submit"
                            disabled={(!messageText.trim() && !selectedImageFile) || isSending || isUploadingImage}
                            className="rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 text-white px-5 h-10 flex items-center gap-2 font-semibold text-sm transition-all shadow-sm shrink-0"
                        >
                            {(isSending || isUploadingImage) ? <FrogLoader size={16} className="text-white" /> : <Send size={16} />}
                            <span className="hidden sm:inline">Whisper</span>
                        </button>
                    </div>
                </form>
            </footer>
        </div>
    );
};

export default ChatPage;