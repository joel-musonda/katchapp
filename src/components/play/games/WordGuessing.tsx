import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameProps } from '@/types/game';
import { ArrowLeft } from 'lucide-react';

const WORDS: Record<string, string[]> = {
  Animals: ['elephant', 'giraffe', 'penguin', 'dolphin', 'kangaroo', 'octopus', 'cheetah', 'flamingo'],
  Countries: ['australia', 'brazil', 'canada', 'denmark', 'ethiopia', 'finland', 'germany', 'hungary'],
  Foods: ['chocolate', 'spaghetti', 'pancakes', 'avocado', 'blueberry', 'sandwich', 'mushroom', 'cinnamon'],
  Sports: ['basketball', 'swimming', 'baseball', 'football', 'volleyball', 'gymnastics', 'badminton', 'wrestling'],
};

const MAX_WRONG = 6;
const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');

const WordGuessing = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'result'>('setup');
  const [word, setWord] = useState('');
  const [guessed, setGuessed] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [isChooser, setIsChooser] = useState(isHost);
  const [scores, setScores] = useState({ me: 0, peer: 0 });

  useEffect(() => {
    if (!peerState) return;
    if (peerState.t === 'word') { setWord(peerState.w); setCategory(peerState.c); setGuessed([]); setPhase('playing'); setIsChooser(false); }
    if (peerState.t === 'guess') setGuessed(p => [...p, peerState.l]);
    if (peerState.t === 'next') { setPhase('setup'); setWord(''); setGuessed([]); setIsChooser(peerState.you); if (peerState.sc) setScores({ me: peerState.sc.peer, peer: peerState.sc.me }); }
  }, [peerState]);

  const setWordForGame = (cat: string) => {
    const ws = WORDS[cat];
    const w = wordInput.trim().toLowerCase() || ws[Math.floor(Math.random() * ws.length)];
    setWord(w); setCategory(cat); setPhase('playing'); setIsChooser(true);
    onSendState({ t: 'word', w, c: cat });
  };

  const guessLetter = (l: string) => {
    if (isChooser || guessed.includes(l) || phase !== 'playing') return;
    setGuessed(p => [...p, l]);
    onSendState({ t: 'guess', l });
  };

  const wrong = guessed.filter(l => !word.includes(l));
  const won = word && word.split('').every(l => guessed.includes(l));
  const lost = wrong.length >= MAX_WRONG;
  const over = won || lost;

  useEffect(() => {
    if (over && phase === 'playing') {
      setPhase('result');
      if (won && !isChooser) setScores(s => ({ ...s, me: s.me + 1 }));
      if (won && isChooser) setScores(s => ({ ...s, peer: s.peer + 1 }));
    }
  }, [over, phase, won, isChooser]);

  const next = () => {
    const nc = !isChooser;
    setPhase('setup'); setWord(''); setWordInput(''); setGuessed([]); setIsChooser(nc);
    onSendState({ t: 'next', you: !nc, sc: scores });
  };

  const display = word.split('').map(l => guessed.includes(l) || over ? l : '_').join(' ');

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Word Guessing</h2>
        <div className="flex items-center gap-2 text-sm"><span>{scores.me}</span><span className="text-muted-foreground">:</span><span>{scores.peer}</span></div>
      </div>

      {phase === 'setup' && isChooser && (
        <div className="space-y-4 text-center max-w-sm">
          <p className="text-sm text-muted-foreground">Choose a category (optionally enter custom word)</p>
          <Input value={wordInput} onChange={e => setWordInput(e.target.value)} placeholder="Custom word (optional)" maxLength={20} className="bg-card border-border" />
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(WORDS).map(c => <Button key={c} variant="outline" onClick={() => setWordForGame(c)}>{c}</Button>)}
          </div>
        </div>
      )}
      {phase === 'setup' && !isChooser && <p className="text-muted-foreground">{peerName} is choosing a word...</p>}

      {(phase === 'playing' || phase === 'result') && (
        <>
          <p className="text-xs text-muted-foreground">Category: {category}</p>
          <div className="text-3xl h-10 flex items-center">{'💀'.repeat(wrong.length)}{'❤️'.repeat(MAX_WRONG - wrong.length)}</div>
          <p className="font-mono text-3xl tracking-widest">{display}</p>
          {isChooser && phase === 'playing' && <p className="text-sm text-muted-foreground">Waiting for {peerName}...</p>}
          {!isChooser && phase === 'playing' && (
            <div className="flex flex-wrap gap-1 max-w-sm justify-center">
              {ALPHA.map(l => (
                <button key={l} onClick={() => guessLetter(l)} disabled={guessed.includes(l)}
                  className={`w-9 h-9 rounded border border-border text-sm font-medium transition-colors ${guessed.includes(l) ? (word.includes(l) ? 'bg-foreground text-primary-foreground' : 'bg-secondary opacity-30') : 'bg-card hover:bg-accent'} disabled:cursor-default`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {phase === 'result' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3">
              <p className="text-lg font-bold">
                {won ? (isChooser ? `${peerName} guessed it!` : 'You got it! 🎉') : (isChooser ? "They didn't get it!" : `The word was: ${word}`)}
              </p>
              <Button onClick={next}>Next Round</Button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};

export default WordGuessing;
