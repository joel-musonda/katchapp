import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, ArrowLeft, CheckCircle, MessageCircle } from "lucide-react";
import { FrogLoader, FullScreenFrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";

export default function QnaPage() {
  const { username } = useParams<{ username: string }>();
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Fetch target profile by username
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["qna-profile", username],
    queryFn: async () => {
      if (!username) throw new Error("No username");
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, bio")
        .eq("username", username.toLowerCase())
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!username,
  });

  const handleSubmit = async () => {
    const trimmed = question.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > 500) {
      setError("Question must be under 500 characters.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const { error: insertError } = await (supabase as any)
        .from("qna_questions")
        .insert({
          target_user_id: profile.user_id,
          question_text: trimmed,
        });
      if (insertError) throw insertError;

      setSubmitted(true);
      setQuestion("");
    } catch (err: any) {
      console.error("QnA submit error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <FullScreenFrogLoader />;
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-card border border-border/60 shadow-2xl rounded-3xl p-8 max-w-sm w-full backdrop-blur-2xl">
          <h2 className="text-xl font-bold tracking-tight mb-2">User Not Found</h2>
          <p className="text-muted-foreground text-sm mb-6">This user doesn't exist or their profile is unavailable.</p>
          <Link to="/" className="w-full inline-block rounded-xl bg-primary text-primary-foreground font-semibold text-sm py-3 px-4 shadow-lg shadow-primary/25 hover:opacity-95 transition-all">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const initials = profile.display_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground flex flex-col justify-between">
      <Helmet>
        <title>Ask @{profile.username} — katchapp</title>
        <meta name="description" content={`Send an anonymous question to ${profile.display_name || profile.username} on katchapp.`} />
        <meta property="og:title" content={`Ask @{profile.username} anonymously — katchapp`} />
        <meta property="og:description" content={`Send an anonymous question to ${profile.display_name || profile.username} on katchapp. They won't know who asked.`} />
        <meta property="og:image" content={profile.avatar_url || "/fav.jpg"} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`Ask @{profile.username} anonymously — katchapp`} />
        <meta name="twitter:description" content={`Send an anonymous question to ${profile.display_name || profile.username} on katchapp.`} />
        <meta name="twitter:image" content={profile.avatar_url || "/fav.jpg"} />
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-10 w-full flex-1 flex flex-col justify-center">
        {/* Back link */}
        <Link
          to={`/u/${profile.username}`}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/50 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-200 w-fit mb-6"
        >
          <ArrowLeft size={16} />
          View Profile
        </Link>

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/60 shadow-xl shadow-black/5 p-6 rounded-3xl text-center mb-6 backdrop-blur-2xl"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl font-bold mx-auto mb-4 overflow-hidden shadow-md">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
            ) : initials}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{profile.display_name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">@{profile.username}</p>

          <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <MessageCircle size={14} />
            <span>Ask me anything</span>
          </div>
        </motion.div>

        {/* Submit form or success */}
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border/60 shadow-xl shadow-black/5 p-8 rounded-3xl text-center backdrop-blur-2xl"
            >
              <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold tracking-tight mb-2">Question Sent!</h2>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Your question has been delivered anonymously to @{profile.username}. They may answer it on their feed.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3.5 shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all"
              >
                Ask Another Question
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border/60 shadow-xl shadow-black/5 p-6 sm:p-8 rounded-3xl backdrop-blur-2xl"
            >
              <label htmlFor="qna-question" className="block text-xs font-semibold text-muted-foreground mb-2">
                Your Question (Anonymous)
              </label>
              <textarea
                id="qna-question"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Type your question here..."
                className="w-full bg-background border border-input p-4 resize-none outline-none text-sm min-h-[140px] rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
                maxLength={500}
                rows={4}
              />
              <div className="flex items-center justify-between mt-4">
                <span className={`text-xs font-medium ${question.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                  {question.length}/500
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!question.trim() || submitting}
                  className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-5 py-3 shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? <FrogLoader size={16} /> : <Send size={16} />}
                  {submitting ? "Sending..." : "Send Question"}
                </button>
              </div>
              {error && (
                <p className="text-destructive text-xs font-medium mt-3 bg-destructive/10 px-3 py-2 rounded-xl border border-destructive/20">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Questions are submitted anonymously. Be kind. ❤️
        </p>
      </div>
    </div>
  );
}