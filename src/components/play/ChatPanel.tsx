import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { ChatMessage } from '@/types/game';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  peerTyping: boolean;
  onTyping: (isTyping: boolean) => void;
}

const ChatPanel = ({ messages, onSendMessage, peerTyping, onTyping }: ChatPanelProps) => {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, peerTyping]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleTyping = useCallback((value: string) => {
    setText(value);
    onTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 1000);
  }, [onTyping]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
    onTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="gum-card flex flex-col items-center justify-center py-10 text-muted-foreground/70">
            <p className="text-xs">No messages yet</p>
            <p className="text-[10px] mt-1">Start the conversation.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-[3px] px-3 py-2 text-sm border-2 ${
                msg.isMe 
                  ? 'bg-primary text-primary-foreground border-border' 
                  : 'bg-card text-foreground border-border'
              }`}>
                {!msg.isMe && <p className="text-[10px] font-semibold opacity-60 mb-0.5">{msg.sender}</p>}
                <p className="break-words leading-relaxed">{msg.text}</p>
                <p className={`text-[10px] mt-1 ${msg.isMe ? 'text-primary-foreground/40' : 'text-muted-foreground/50'}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {peerTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-secondary rounded-[3px] border-2 border-border px-3 py-2 text-sm text-muted-foreground/60 flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </motion.div>
        )}
      </div>
      <div className="border-t-2 border-border p-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          className="bg-background border-2 border-border rounded-[3px] focus-visible:ring-0"
        />
        <Button 
          size="icon" 
          onClick={handleSend} 
          disabled={!text.trim()}
          className="gum-btn bg-primary text-primary-foreground shrink-0 h-10 w-10 px-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatPanel;
