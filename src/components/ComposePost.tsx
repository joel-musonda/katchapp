import { useState, useEffect, useRef } from "react";
import { compressImage } from "@/lib/imageCompression";
import { useLocation } from "react-router-dom";
import { Code, ImageIcon, Send, X, FileText } from "lucide-react";
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

  // Cooldown countdown timer
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

  // Pre-fill from QnA Inbox answer flow
  const location = useLocation();
  useEffect(() => {
    const state = location.state as { qnaQuestion?: string } | null;
    if (state?.qnaQuestion) {
      setContent(`Q: "${state.qnaQuestion}"
sent with katchapp QnA

A: `);
      window.history.replaceState({}, document.title);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [location.state]);

  // Mention state
  const { suggestions, fetchSuggestions, clearSuggestions } = useMentions();
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);

  // Auto-expand textarea with limit
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
        toast.error("That's a heavy memory! Please keep images under 5MB.");
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

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFiles(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
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

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("We couldn't manifest your image. Please try again.");
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
    const newText = `${before}@${username} ${after}`;

    setContent(newText);
    setMentionSearch("");
    clearSuggestions();

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
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
      const postContent = isReadme
        ? content
        : content.replace(/#[\p{L}\p{N}_]+/gu, "").trim();

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

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/[0.02] dark:bg-zinc-900/40 border border-black/[0.06] rounded-2xl p-5 mb-6 transition-colors shadow-xs ${isDragging ? "border-black dark:border-white bg-black/[0.04]" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/15 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden text-black dark:text-white">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onPaste={handlePaste}
            placeholder={t("feed.whatAreYouBuilding")}
            id="post-content"
            name="content"
            className="w-full bg-transparent resize-none outline-none text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 min-h-[60px] custom-scrollbar"
            rows={2}
          />

          {isReadme && showPreview && (
            <div className="mt-3 p-4 rounded-2xl border border-black/[0.08] dark:border-white/10 bg-black/[0.01] dark:bg-zinc-900/50 max-h-[400px] overflow-y-auto prose-readme custom-scrollbar text-black dark:text-white">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkGemoji]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={highlighterTheme}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-xl my-4"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

          <MentionList
            suggestions={suggestions}
            onSelect={insertMention}
            containerRef={textareaRef}
          />

          <AnimatePresence>
            {mediaPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative mt-3 rounded-2xl border border-black/[0.08] dark:border-white/10 overflow-hidden max-h-[300px] bg-black/5 dark:bg-white/5"
              >
                <img src={getSafeUrl(mediaPreview)} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {showCode && (
            <div className="mt-3 relative">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-black/60 dark:text-white/60 uppercase tracking-wider">Code Snippet</span>
                <select
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  className="bg-black/5 dark:bg-white/10 text-black dark:text-white text-xs rounded-xl px-2.5 py-1.5 outline-none border border-black/10 dark:border-white/10 cursor-pointer"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="bash">Bash / Shell</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="sql">SQL</option>
                  <option value="markdown">Markdown</option>
                  <option value="text">Plain Text</option>
                </select>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste your code here..."
                id="post-code"
                name="code"
                className="w-full bg-black/[0.03] dark:bg-zinc-900/80 text-black dark:text-white font-mono text-xs p-3.5 rounded-2xl border border-black/[0.08] dark:border-white/10 resize-none outline-none min-h-[120px]"
                rows={4}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.06] dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                id="post-media"
                name="media"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60 transition-colors"
                title="Upload Image"
              >
                <ImageIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className={`p-2 rounded-full transition-colors ${showCode ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60"}`}
                title="Add Code"
              >
                <Code size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsReadme(!isReadme)}
                className={`p-2 rounded-full transition-colors ${isReadme ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/60"}`}
                title="Toggle README (Markdown)"
              >
                <FileText size={16} />
              </button>
              {isReadme && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border border-black/10 dark:border-white/10 uppercase tracking-tight transition-colors ${showPreview ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10 text-black/70 dark:text-white/70"}`}
                >
                  {showPreview ? "Editor" : "Preview"}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting || cooldown > 0}
              className="px-4 py-2 rounded-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90 text-xs font-semibold transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? <FrogLoader size={14} className="" /> : cooldown > 0 ? null : <Send size={14} />}
              {submitting ? "Posting..." : cooldown > 0 ? `Wait ${cooldown}s` : t("feed.castSpell")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ComposePost;