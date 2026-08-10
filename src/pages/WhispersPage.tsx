import { motion } from "framer-motion";
import { useWhispers } from "@/hooks/useWhispers";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { Send, ArrowLeft, LogIn, Users } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { Helmet } from "react-helmet-async";

const WhispersPage = () => {
    const { user } = useAuth();
    const { conversations, loadingConversations } = useWhispers();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors">
            <Helmet>
                <title>Whispers — genjutsu</title>
                <meta name="description" content="Direct ephemeral messages on Genjutsu." />
            </Helmet>
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    if (window.history.length > 2) {
                                        navigate(-1);
                                    } else {
                                        navigate("/");
                                    }
                                }}
                                className="p-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors border border-zinc-200 dark:border-zinc-800"
                                title="Go back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Whispers</h1>
                        </div>

                        {loadingConversations ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <FrogLoader className="text-sky-500" size={32} />
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Loading whispers...</p>
                            </div>
                        ) : !user ? (
                            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center flex flex-col items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/30">
                                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                                    <LogIn size={28} className="text-zinc-400 dark:text-zinc-500" />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">Identity unknown</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                        Sign in to see your whispers and start new ephemeral conversations.
                                    </p>
                                    <button
                                        onClick={() => navigate("/auth")}
                                        className="mt-6 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm px-6 py-2.5 flex items-center gap-2 mx-auto transition-all shadow-sm"
                                    >
                                        <LogIn size={16} />
                                        Get Started
                                    </button>
                                </div>
                            </div>
                        ) : conversations && conversations.length > 0 ? (
                            <div className="space-y-3">
                                {/* Pinned Community Chat */}
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => navigate("/whispers/community")}
                                    className="rounded-2xl border border-sky-200 dark:border-sky-900/50 p-4 flex items-center gap-4 cursor-pointer bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/50 dark:hover:bg-sky-900/30 transition-all group shadow-sm"
                                >
                                    <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0 text-sky-500">
                                        <Users size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:underline tracking-tight">Community Chat</h4>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic truncate mt-0.5">Public room — everyone can join</p>
                                    </div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                </motion.div>

                                {conversations.map((conv) => (
                                    <motion.div
                                        key={conv.user_id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => navigate(`/whisper/${conv.username}`)}
                                        className={`rounded-2xl border p-4 flex items-center gap-4 cursor-pointer transition-all group shadow-sm ${
                                            conv.has_unread
                                                ? "border-sky-500/40 bg-sky-50/30 dark:bg-sky-950/10 hover:bg-sky-50/60 dark:hover:bg-sky-950/20"
                                                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                        }`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-base shrink-0 overflow-hidden shadow-sm text-zinc-900 dark:text-zinc-100">
                                            {conv.avatar_url ? (
                                                <img src={conv.avatar_url} alt={conv.username} className="w-full h-full object-cover" loading="lazy" />
                                            ) : conv.display_name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className={`truncate tracking-tight text-sm ${conv.has_unread ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-semibold text-zinc-900 dark:text-zinc-100"} group-hover:underline`}>
                                                    {conv.display_name}
                                                </h4>
                                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap font-mono">
                                                    {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className={`text-xs truncate italic ${conv.has_unread ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-500 dark:text-zinc-400"}`}>
                                                "{conv.last_message.substring(0, 60)}"
                                            </p>
                                        </div>
                                        {conv.has_unread && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0 animate-pulse" />
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center flex flex-col items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/30">
                                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                                    <Send size={28} className="text-zinc-400 dark:text-zinc-500" />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">Silence in the abyss...</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                        You haven't sent any whispers yet. Messages vanish after 24 hours. Silence is your cover.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
                                        <button
                                            onClick={() => navigate("/whispers/community")}
                                            className="rounded-full bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm px-5 py-2.5 flex items-center gap-2 justify-center transition-all shadow-sm"
                                        >
                                            <Users size={16} />
                                            Join Community Chat
                                        </button>
                                        <button
                                            onClick={() => navigate("/search")}
                                            className="text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-full px-5 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300 shadow-sm"
                                        >
                                            Find someone to chat with
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
};

export default WhispersPage;