import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "The five boxing wizards jump quickly",
  "Sphinx of black quartz judge my vow",
  "Two driven jocks help fax my big quiz",
  "Jackdaws love my big sphinx of quartz",
  "The jay pig fox dwelt on a farm quiz",
  "Watch Jeopardy! Alex Trebek's fun quiz",
  "Crazy Frederick bought many very exquisite opals",
  "We promptly judged antique ivory buckles for the prize",
  "A mad boxer shot a quick gloved jab to the jaw",
  "The job requires pluck and zeal from the young wage earner",
  "Just keep examining every low bid quoted for zinc etchings",
  "How razorback-jumping frogs can level six piqued gymnasts",
];

const TypingRace = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [sentence, setSentence] = useState('');
  const [input, setInput] = useState('');
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [myWpm, setMyWpm] = useState(0);
  const [peerProgress, setPeerProgress] = useState(0);
  const [peerWpm, setPeerWpm] = useState(0);
  const [myFinished, setMyFinished] = useState(false);
  const [peerFinished, setPeerFinished] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState({ me: 0, peer: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Host picks the sentence
  useEffect(() => {
    if (isHost && !sentence) {
      const s = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
      setSentence(s);
      onSendState({ type: 'sentence', sentence: s });
    }
  }, [isHost, sentence, onSendState]);

  useEffect(() => {
    if (!peerState) return;
    if (peerState.type === 'sentence') {
      setSentence(peerState.sentence);
      setInput('');
      setStarted(false);
      setMyFinished(false);
      setPeerFinished(false);
      setWinner(null);
    } else if (peerState.type === 'progress') {
      setPeerProgress(peerState.progress);
    } else if (peerState.type === 'finished') {
      setPeerFinished(true);
      setPeerWpm(peerState.wpm);
      setPeerProgress(100);
    } else if (peerState.type === 'reset') {
      const s = peerState.sentence || SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
      setSentence(s);
      setInput('');
      setStarted(false);
      setMyFinished(false);
      setPeerFinished(false);
      setWinner(null);
      setPeerProgress(0);
      setPeerWpm(0);
      setMyWpm(0);
    }
  }, [peerState]);

  useEffect(() => {
    if (myFinished && peerFinished) {
      const w = myWpm > peerWpm ? myName : myWpm < peerWpm ? peerName : 'tie';
      setWinner(w);
      if (w === myName) setScores(s => ({ ...s, me: s.me + 1 }));
      else if (w === peerName) setScores(s => ({ ...s, peer: s.peer + 1 }));
    }
  }, [myFinished, peerFinished, myWpm, peerWpm, myName, peerName]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!started) {
      setStarted(true);
      setStartTime(Date.now());
    }
    setInput(val);

    const progress = Math.round((val.length / sentence.length) * 100);
    onSendState({ type: 'progress', progress: Math.min(progress, 100) });

    if (val === sentence) {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      const words = sentence.split(' ').length;
      const wpm = Math.round(words / elapsed);
      setMyWpm(wpm);
      setMyFinished(true);
      onSendState({ type: 'finished', wpm });
    }
  };

  const resetGame = () => {
    const s = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    setSentence(s);
    setInput('');
    setStarted(false);
    setMyFinished(false);
    setPeerFinished(false);
    setWinner(null);
    setPeerProgress(0);
    setPeerWpm(0);
    setMyWpm(0);
    onSendState({ type: 'reset', sentence: s });
  };

  const myProgress = sentence ? Math.min(Math.round((input.length / sentence.length) * 100), 100) : 0;

  // Highlight correct/wrong chars
  const renderSentence = () => {
    if (!sentence) return null;
    return (
      <p className="text-lg font-mono leading-relaxed">
        {sentence.split('').map((char, i) => {
          let cls = 'text-muted-foreground/40';
          if (i < input.length) {
            cls = input[i] === char ? 'text-foreground' : 'text-destructive underline';
          }
          return <span key={i} className={cls}>{char}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-5">
      <div className="flex items-center gap-4 w-full max-w-lg justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Typing Race</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}><RotateCcw className="h-4 w-4" /></Button>
      </div>

      <div className="flex items-center gap-8 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">{myName}</p>
          <p className="text-2xl font-bold">{scores.me}</p>
        </div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center">
          <p className="text-muted-foreground">{peerName}</p>
          <p className="text-2xl font-bold">{scores.peer}</p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="w-full max-w-lg space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 truncate">{myName}</span>
          <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div animate={{ width: `${myProgress}%` }} className="h-full bg-foreground rounded-full" />
          </div>
          {myFinished && <span className="text-xs font-mono font-bold">{myWpm} WPM</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 truncate">{peerName}</span>
          <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div animate={{ width: `${peerProgress}%` }} className="h-full bg-muted-foreground rounded-full" />
          </div>
          {peerFinished && <span className="text-xs font-mono font-bold">{peerWpm} WPM</span>}
        </div>
      </div>

      {winner && (
        <p className="text-sm font-medium">
          {winner === 'tie' ? "It's a tie!" : winner === myName ? 'You win! 🎉' : `${peerName} wins!`}
        </p>
      )}

      <div className="w-full max-w-lg bg-card border border-border rounded-xl p-4">
        {renderSentence()}
      </div>

      <input
        ref={inputRef}
        value={input}
        onChange={handleInput}
        disabled={myFinished || !sentence}
        placeholder={sentence ? 'Start typing...' : 'Waiting for sentence...'}
        className="w-full max-w-lg h-12 px-4 bg-secondary border border-border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
        autoFocus
      />

      {winner && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default TypingRace;
