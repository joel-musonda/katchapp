import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCommunityChat, CommunityMessage, BOT_REPLY_PREFIX } from "@/hooks/useCommunityChat";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Send, Trash2, Users, Ghost, Bot } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import { linkify } from "@/lib/linkify";
import ReactMarkdown from "react-markdown";
import WhisperLinkPreview from "@/components/WhisperLinkPreview";

function ChatInputForm({ sendMessage, isSending, user, navigate }: any) {
    const [messageText, setMessageText] = useState("");
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMessageText(val);
        
        const lowerVal = val.toLowerCase();
        if (
            lowerVal.endsWith("@") ||
            lowerVal.endsWith("@a") ||
            lowerVal.endsWith("@ai") ||
            lowerVal.endsWith("@b") ||
            lowerVal.endsWith("@bo") ||
            lowerVal.endsWith("@bot")
        ) {
            setShowMentionMenu(true);
        } else {
            setShowMentionMenu(false);
        }
    };

    const handleMentionSelect = (mention: "@ai" | "@bot") => {
        const baseText = messageText.replace(/@(?:ai|a|bot|bo|b)?$/i, "");
        setMessageText(baseText + mention + " ");
        setShowMentionMenu(false);
        inputRef.current?.focus();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setShowMentionMenu(false);
        if (!messageText.trim() || isSending) return;

        try {
            await sendMessage(messageText.trim());
            setMessageText("");
        } catch {
            // Error handled in hook
        }
    };

    return (
        <footer className="shrink-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 p-4 pb-safe relative transition-colors">
            <AnimatePresence>
                {showMentionMenu && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-4 mb-3 z-50 min-w-[220px]"
                    >
                        <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-lg overflow-hidden flex flex-col p-1.5 backdrop-blur-md">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 px-3 py-1 uppercase tracking-wider">Agents</span>
                            <button
                                type="button"
                                onClick={() => handleMentionSelect("@ai")}
                                className="flex items-center gap-3 p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left rounded-xl w-full group"
                            >
                                <div className="w-8 h-8 rounded-full border border-sky-500/20 bg-sky-500/10 flex items-center justify-center shrink-0 text-sky-500">
                                    <Ghost size={16} className="animate-pulse" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm leading-tight text-zinc-900 dark:text-zinc-100 group-hover:underline">Katchapp AI</span>
                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-none mt-0.5 font-mono">@ai</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleMentionSelect("@bot")}
                                className="flex items-center gap-3 p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left rounded-xl w-full group"
                            >
                                <div className="w-8 h-8 rounded-full border border-sky-500/20 bg-sky-500/10 flex items-center justify-center shrink-0 text-sky-500">
                                    <Bot size={16} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-sm leading-tight text-zinc-900 dark:text-zinc-100 group-hover:underline">Katchapp Bot</span>
                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-none mt-0.5 font-mono">@bot</span>
                                </div>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {user ? (
                <form onSubmit={handleSend} autoComplete="off" className="max-w-4xl mx-auto flex gap-3 items-center">
                    <input
                        type="text"
                        id="community-message-input"
                        name="community-message"
                        ref={inputRef}
                        value={messageText}
                        onChange={handleInputChange}
                        placeholder="Say something to the community..."
                        maxLength={500}
                        className="flex-1 bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-full py-2.5 px-4 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all text-sm font-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        enterKeyHint="send"
                    />
                    <button
                        type="submit"
                        disabled={!messageText.trim() || isSending}
                        className="rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 text-white px-5 h-10 flex items-center gap-2 font-semibold text-sm transition-all shadow-sm shrink-0"
                    >
                        {isSending ? <FrogLoader size={16} className="text-white" /> : <Send size={16} />}
                        <span className="hidden sm:inline">Send</span>
                    </button>
                </form>
            ) : (
                <div className="max-w-4xl mx-auto text-center">
                    <button
                        onClick={() => navigate("/auth")}
                        className="rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm px-6 py-2.5 transition-all shadow-sm"
                    >
                        Sign in to chat
                    </button>
                </div>
            )}
        </footer>
    );
}

const CommunityChat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {
        messages,
        loadingMessages,
        onlineCount,
        sendMessage,
        deleteMessage,
        isSending,
        isAiThinking,
        isBotThinking,
    } = useCommunityChat();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isAiThinking, isBotThinking]);

    useEffect(() => {
        const selection = window.getSelection?.();
        if (selection && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    }, []);

    if (loadingMessages) {
        return (
            <div
                className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center select-none transition-colors"
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
            >
                <FrogLoader className="text-sky-500" size={32} />
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 animate-pulse pointer-events-none font-medium">Entering the community...</p>
            </div>
        );
    }

    return (
        <div className="h-[100svh] bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col overflow-hidden transition-colors">
            <Helmet>
                <title>Community Chat — katchapp</title>
                <meta name="description" content="Public community chat on Katchapp." />
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
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 text-sky-500 shadow-sm">
                                    <Users size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-sm -mb-0.5 text-zinc-900 dark:text-zinc-100 tracking-tight">Community Chat</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        {onlineCount} online
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
            </div>

            <main className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 space-y-4 scrollbar-hide flex flex-col">
                <div className="flex-1" />

                {/* System welcome message */}
                

                {messages && messages.length > 0 ? (
                    messages.map((msg: CommunityMessage) => {
                        const isAutomated = msg.is_ai_reply === true;
                        const isBot = isAutomated && msg.content.startsWith(BOT_REPLY_PREFIX);
                        const isAi = isAutomated && !isBot;
                        const displayContent = isBot
                            ? msg.content.slice(BOT_REPLY_PREFIX.length).trimStart()
                            : msg.content;
                        const isMe = msg.user_id === user?.id && !isAutomated;
                        
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex w-full min-w-0 ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-[70%] min-w-0 group">
                                    {!isMe && (
                                        <button
                                            onClick={() => !isAutomated && msg.profile?.username && navigate(`/u/${msg.profile.username}`)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden transition-all shadow-sm ${
                                                !isAutomated
                                                    ? "bg-zinc-200 dark:bg-zinc-800 hover:opacity-80 text-zinc-900 dark:text-zinc-100"
                                                    : "bg-sky-500 text-white cursor-default"
                                            }`}
                                        >
                                            {isBot ? (
                                                <Bot size={15} />
                                            ) : isAi ? (
                                                <Ghost size={15} />
                                            ) : msg.profile?.avatar_url ? (
                                                <img src={msg.profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                (msg.profile?.display_name?.[0] || "?").toUpperCase()
                                            )}
                                        </button>
                                    )}

                                    <div className={`px-4 py-3 text-sm rounded-2xl shadow-sm min-w-0 ${
                                        isMe
                                            ? "bg-sky-500 text-white rounded-br-sm"
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
                                    }`}>
                                        {!isMe && (
                                            <button
                                                onClick={() => !isAutomated && msg.profile && navigate(`/u/${msg.profile.username}`)}
                                                className={`text-xs font-semibold block mb-1 tracking-tight ${
                                                    isAutomated ? "text-sky-500 cursor-default pointer-events-none" : "text-zinc-700 dark:text-zinc-300 hover:underline"
                                                }`}
                                            >
                                                {isBot ? "Katchapp Bot" : isAi ? "Katchapp AI" : msg.profile ? `@${msg.profile.username}` : "Unknown"}
                                            </button>
                                        )}
                                        <div className="whitespace-pre-wrap break-words min-w-0 max-w-full leading-relaxed">
                                            {isAi ? (
                                                <ReactMarkdown
                                                    components={{
                                                        pre: ({ children }: any) => (
                                                            <div className="relative my-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 overflow-hidden shrink-0 max-w-full shadow-sm">
                                                                <div className="text-[11px] bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 font-mono text-zinc-500">Code Snippet</div>
                                                                <pre className="p-3.5 overflow-x-auto text-xs font-mono scrollbar-hide max-w-full">
                                                                    {children}
                                                                </pre>
                                                            </div>
                                                        ),
                                                        code: ({ children, className }: any) => {
                                                            const isInline = !className;
                                                            return isInline ? (
                                                                <code className="bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-xs font-mono">{children}</code>
                                                            ) : (
                                                                <code className={`${className} text-xs`}>{children}</code>
                                                            );
                                                        },
                                                        p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>,
                                                        ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                                        ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                                        li: ({ children }: any) => <li className="text-sm">{children}</li>,
                                                        a: ({ children, href }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline font-semibold">{children}</a>
                                                    }}
                                                >
                                                    {displayContent}
                                                </ReactMarkdown>
                                            ) : (
                                                <>
                                                    <p>
                                                        {linkify(displayContent, isMe)}
                                                    </p>
                                                    <WhisperLinkPreview content={displayContent} isMe={isMe} />
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] font-mono opacity-70 ${isMe ? "text-white/80" : "text-zinc-500 dark:text-zinc-400"}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {isMe && (
                                                <button
                                                    onClick={() => deleteMessage(msg.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                                                    title="Delete message"
                                                >
                                                    <Trash2 size={12} className="text-white/80 hover:text-white" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="py-16 text-center text-xs text-zinc-500 dark:text-zinc-400 italic flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 shadow-sm">
                            <Users size={18} className="opacity-40" />
                        </div>
                        No one has spoken yet. Break the silence.
                    </div>
                )}

                {/* AI Thinking Indicator */}
                {isAiThinking && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-[70%] mt-2">
                            <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center shrink-0 text-white shadow-sm">
                                <Ghost size={15} className="animate-pulse" />
                            </div>
                            <div className="px-4 py-3 text-sm rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-semibold text-sky-500 mb-1">Katchapp AI</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">Computing
                                    <span className="flex gap-1 pt-0.5 text-sky-500">
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                    </span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Bot Thinking Indicator */}
                {isBotThinking && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-[70%] mt-2">
                            <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center shrink-0 text-white shadow-sm">
                                <Bot size={15} className="animate-pulse" />
                            </div>
                            <div className="px-4 py-3 text-sm rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <p className="text-xs font-semibold text-sky-500 mb-1">Katchapp Bot</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">Processing command
                                    <span className="flex gap-1 pt-0.5 text-sky-500">
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                       <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                    </span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} className="h-4" />
            </main>

            <ChatInputForm sendMessage={sendMessage} isSending={isSending} user={user} navigate={navigate} />
        </div>
    );
};

export default CommunityChat;