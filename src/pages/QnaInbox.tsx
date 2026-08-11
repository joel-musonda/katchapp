import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import Navbar from "@/components/Navbar";
import { FrogLoader, FullScreenFrogLoader } from "@/components/ui/FrogLoader";
import { Trash2, MessageSquareReply, Inbox, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface QnaQuestion {
  id: string;
  question_text: string;
  is_answered: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function QnaInbox() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const { data: questions, isLoading } = useQuery({
    queryKey: ["qna-inbox", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("qna_questions")
        .select("id, question_text, is_answered, created_at")
        .eq("target_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QnaQuestion[];
    },
    enabled: !!user,
  });

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));

    try {
      const { error } = await (supabase as any)
        .from("qna_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["qna-inbox"] });
      toast.success("Question deleted.");
    } catch {
      toast.error("Couldn't delete question.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAnswer = async (q: QnaQuestion) => {
    // Mark as answered
    await (supabase as any)
      .from("qna_questions")
      .update({ is_answered: true })
      .eq("id", q.id);

    queryClient.invalidateQueries({ queryKey: ["qna-inbox"] });

    // Navigate to home feed with the question pre-filled in the composer
    navigate("/", {
      state: {
        qnaQuestion: q.question_text,
      },
    });
  };

  const handleCopyLink = () => {
    if (!profile?.username) return;
    const url = `${window.location.origin}/qna/${profile.username}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("QnA link copied!");
    }).catch(() => {
      toast.error("Couldn't copy link.");
    });
  };

  if (authLoading) {
    return <FullScreenFrogLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const unanswered = (questions || []).filter((q) => !q.is_answered);
  const answered = (questions || []).filter((q) => q.is_answered);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground">
      <Helmet>
        <title>QnA Inbox — katchapp</title>
        <meta name="description" content="View and answer anonymous questions on katchapp." />
      </Helmet>
      
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-6">
          
          {/* Header Card */}
          <div className="bg-card border border-border/60 shadow-xl shadow-black/5 p-6 rounded-3xl backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <Inbox size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">QnA Inbox</h1>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {unanswered.length} unanswered · {answered.length} answered
                </p>
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              className="rounded-xl bg-background border border-input text-foreground text-xs font-semibold py-3 px-4 flex items-center justify-center gap-2 hover:bg-muted/50 hover:border-border transition-all shadow-sm active:scale-[0.98]"
            >
              <LinkIcon size={14} className="text-muted-foreground" />
              Copy Your QnA Link
            </button>
          </div>

          {/* Questions list / Skeleton / Empty state */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-border/60 p-6 rounded-3xl animate-pulse space-y-4 shadow-sm">
                  <div className="h-4 bg-muted rounded-xl w-4/5" />
                  <div className="h-4 bg-muted rounded-xl w-2/5" />
                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <div className="h-3 bg-muted rounded-lg w-16" />
                    <div className="flex gap-2">
                      <div className="h-9 bg-muted rounded-xl w-20" />
                      <div className="h-9 bg-muted rounded-xl w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : unanswered.length === 0 && answered.length === 0 ? (
            <div className="bg-card border border-border/60 border-dashed p-12 text-center rounded-3xl shadow-sm backdrop-blur-2xl">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/60 flex items-center justify-center mx-auto mb-4 text-muted-foreground/60">
                <Inbox size={28} />
              </div>
              <p className="text-foreground text-base font-semibold mb-1">No questions yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Share your QnA link with friends or on your profile to start receiving anonymous questions!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Unanswered */}
              {unanswered.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold text-muted-foreground px-1 tracking-wider uppercase">
                    Unanswered ({unanswered.length})
                  </h2>
                  <AnimatePresence mode="popLayout">
                    {unanswered.map((q) => (
                      <motion.div
                        key={q.id}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-card border border-border/60 shadow-xl shadow-black/5 p-6 rounded-3xl backdrop-blur-2xl transition-all hover:border-primary/30"
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground font-normal">
                          {q.question_text}
                        </p>
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/50">
                          <span className="text-xs text-muted-foreground font-medium">
                            {timeAgo(q.created_at)}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(q.id)}
                              disabled={deletingIds.has(q.id)}
                              className="rounded-xl bg-background border border-input hover:border-destructive/40 text-muted-foreground hover:text-destructive text-xs font-medium px-3.5 py-2 transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                            <button
                              onClick={() => handleAnswer(q)}
                              className="rounded-xl bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 shadow-md shadow-primary/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center gap-1.5"
                            >
                              <MessageSquareReply size={13} />
                              Answer on Feed
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Answered */}
              {answered.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xs font-semibold text-muted-foreground px-1 tracking-wider uppercase">
                    Answered ({answered.length})
                  </h2>
                  {answered.map((q) => (
                    <div key={q.id} className="bg-card/60 border border-border/40 shadow-sm p-6 rounded-3xl opacity-70 backdrop-blur-xl">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words line-through decoration-muted-foreground/40 text-muted-foreground">
                        {q.question_text}
                      </p>
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40">
                        <span className="text-xs text-muted-foreground/80 font-medium">
                          {timeAgo(q.created_at)}
                        </span>
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deletingIds.has(q.id)}
                          className="rounded-xl bg-background border border-input hover:border-destructive/40 text-muted-foreground hover:text-destructive text-xs font-medium px-3.5 py-2 transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}