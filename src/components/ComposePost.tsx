import { useState, useEffect, useRef } from "react";
import { compressImage } from "@/lib/imageCompression";
import { useLocation } from "react-router-dom";
import { Code, ImageIcon, Send, X, FileText, Smile, Calendar, MapPin, BarChart2 } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { useMentions } from "@/hooks/useMentions";
import { motion, AnimatePresence } from "framer-motion";
import MentionList from "./MentionList";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "./theme-provider";
import { getSafeUrl } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ComposePostProps {
  onPost: (content: string, code: string, codeLanguage: string, tags: string[], media_url?: string, is_readme?: boolean) => Promise<void>;
}

const ComposePost = ({ onPost }: ComposePostProps) => {
  const [content, setContent] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [isReadme, setIsReadme] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useProfile();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const currentTheme = theme === "system" 
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  const highlighterTheme = currentTheme === "dark" ? vscDarkPlus : oneLight;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const location = useLocation();
  useEffect(() => {
    const state = location.state as { qnaQuestion?: string } | null;
    if (state?.qnaQuestion) {
      setContent(`Q: "${state.qnaQuestion}"\nsent with katchapp QnA\n\nA: `);
      window.history.replaceState({}, document.title);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [location.state]);

  const { suggestions, fetchSuggestions, clearSuggestions } = useMentions();
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 400);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 400 ? "auto" : "hidden";
    }
  }, [content]);

  const extractTags = (text: string): string[] => {
    const matches = text.match(/#([\p{L}\p{N}_]+)/gu);
    return matches ? matches.map((t) => t.slice(1).toLowerCase()) : [];
  };

  const handleFiles = (file: File | null) => {
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Please keep images under 5MB.");
        return;
      }
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files?.[0] || null);
  };

  const uploadMedia = async (): Promise<string | null> => {
    if (!mediaFile) return null;
    try {
      const compressedFile = await compressImage(mediaFile);
      const fileExt = compressedFile.name.split(".").pop();
      const filePath = `${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("We couldn't upload your image. Please try again.");
      return null;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionSearch(query);
      setMentionIndex(cursorPosition - query.length - 1);
      fetchSuggestions(query);
    } else {
      setMentionSearch("");
      clearSuggestions();
    }
  };

  const insertMention = (username: string) => {
    if (mentionIndex === -1) return;
    const before = content.substring(0, mentionIndex);
    const after = content.substring(mentionIndex + mentionSearch.length + 1);
    setContent(`${before}@${username} ${after}`);
    setMentionSearch("");
    clearSuggestions();
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    try {
      let mediaUrl = "";
      if (mediaFile) {
        const uploadedUrl = await uploadMedia();
        if (uploadedUrl) mediaUrl = uploadedUrl;
      }

      const tags = extractTags(content);
      const postContent = isReadme ? content : content.replace(/#[\p{L}\p{N}_]+/gu, "").trim();

      await onPost(postContent || content, code, codeLanguage, tags, mediaUrl, isReadme);

      setContent("");
      setCode("");
      setCodeLanguage("javascript");
      setIsReadme(false);
      setShowPreview(false);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaPreview(null);
    } catch (err: any) {
      if (err?.message?.startsWith("COOLDOWN:")) {
        const seconds = parseInt(err.message.split(":")[1], 10);
        setCooldown(seconds);
      }
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const initials = profile?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="bg-white dark:bg-black border-b border-zinc-200/80 dark:border-zinc-800/80 p-4 transition-colors">
      <div className="flex gap-3.5">
        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden text-zinc-900 dark:text-zinc-100 shadow-sm">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            placeholder="What is happening?!"
            className="w-full bg-transparent resize-none outline-none text-[17px] font-normal tracking-tight text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 min-h-[54px] pt-1.5"
            rows={2}
          />

          <MentionList suggestions={suggestions} onSelect={insertMention} containerRef={textareaRef} />

          <AnimatePresence>
            {mediaPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[300px] bg-zinc-100 dark:bg-zinc-900 shadow-sm"
              >
                <img src={getSafeUrl(mediaPreview)} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors backdrop-blur-sm"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {showCode && (
            <div className="mt-3 relative">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Code Snippet</span>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium rounded-xl px-3 py-1.5 outline-none border border-zinc-200 dark:border-zinc-800 cursor-pointer shadow-sm"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="bash">Bash</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                </select>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste your code here..."
                className="w-full bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-xs p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 resize-none outline-none min-h-[120px]"
                rows={4}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
            <div className="flex items-center gap-1 text-sky-500">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-sky-500/10 transition-colors"
                title="Media"
              >
                <ImageIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className={`p-2 rounded-full transition-colors ${showCode ? "bg-sky-500/20 text-sky-600" : "hover:bg-sky-500/10"}`}
                title="Code"
              >
                <Code size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsReadme(!isReadme)}
                className={`p-2 rounded-full transition-colors ${isReadme ? "bg-sky-500/20 text-sky-600" : "hover:bg-sky-500/10"}`}
                title="Markdown / README"
              >
                <FileText size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting || cooldown > 0}
              className="px-5 py-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 text-sm font-bold tracking-tight transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? <FrogLoader size={14} /> : null}
              {submitting ? "Posting..." : cooldown > 0 ? `Wait ${cooldown}s` : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposePost;