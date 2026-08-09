import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const EMOJIS = ['🐶', '🐱', '🐼', '🦊', '🐸', '🐵', '🦄', '🐙'];

interface Card { emoji: string; matched: boolean; }

const genBoard = (): Card[] => {
  const cards = [...EMOJIS, ...EMOJIS].map(e => ({ emoji: e, matched: false }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};

const MemoryMatch = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const my = isHost ? 1 : 2;
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [currentP, setCurrentP] = useState(1);
  const [scores, setScores] = useState({ 1: 0, 2: 0 });
  const [checking, setChecking] = useState(false);
  const [started, setStarted] = useState(false);
  const sendRef = useRef(onSendState);
  useEffect(() => { sendRef.current = onSendState; }, [onSendState]);

  useEffect(() => {
    if (!peerState) return;
    if (peerState.t === 'init') { setCards(peerState.cards); setFlipped([]); setCurrentP(1); setScores({ 1: 0, 2: 0 }); setStarted(true); setChecking(false); }
    if (peerState.t === 'flip') setFlipped(peerState.flipped);
    if (peerState.t === 'match') { setCards(peerState.cards); setFlipped([]); setScores(peerState.scores); setChecking(false); }
    if (peerState.t === 'nomatch') { setFlipped([]); setCurrentP(peerState.cp); setChecking(false); }
  }, [peerState]);

  const startGame = () => {
    const b = genBoard();
    setCards(b); setFlipped([]); setCurrentP(1); setScores({ 1: 0, 2: 0 }); setStarted(true); setChecking(false);
    sendRef.current({ t: 'init', cards: b });
  };

  const flipCard = (i: number) => {
    if (currentP !== my || checking || cards[i].matched || flipped.includes(i) || flipped.length >= 2) return;
    const nf = [...flipped, i];
    setFlipped(nf);
    sendRef.current({ t: 'flip', flipped: nf });

    if (nf.length === 2) {
      setChecking(true);
      setTimeout(() => {
        if (cards[nf[0]].emoji === cards[nf[1]].emoji) {
          const nc = cards.map((c, idx) => idx === nf[0] || idx === nf[1] ? { ...c, matched: true } : c);
          const ns = { ...scores, [my]: scores[my as 1 | 2] + 1 };
          setCards(nc); setFlipped([]); setScores(ns); setChecking(false);
          sendRef.current({ t: 'match', cards: nc, scores: ns });
        } else {
          const np = my === 1 ? 2 : 1;
          setFlipped([]); setCurrentP(np); setChecking(false);
          sendRef.current({ t: 'nomatch', cp: np });
        }
      }, 1000);
    }
  };

  const gameOver = started && cards.length > 0 && cards.every(c => c.matched);
  const isMyTurn = currentP === my;

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Memory Match</h2>
        <Button variant="ghost" size="sm" onClick={startGame}><RotateCcw className="h-4 w-4" /></Button>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center"><p className="text-muted-foreground">{myName}</p><p className="text-2xl font-bold">{scores[my as 1 | 2]}</p></div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center"><p className="text-muted-foreground">{peerName}</p><p className="text-2xl font-bold">{scores[(my === 1 ? 2 : 1) as 1 | 2]}</p></div>
      </div>

      {!started && (
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Find all matching pairs!</p>
          {isHost ? <Button onClick={startGame}>Start Game</Button> : <p className="text-muted-foreground">Waiting for host...</p>}
        </div>
      )}

      {started && !gameOver && (
        <>
          <p className={`text-sm font-medium ${isMyTurn ? 'text-foreground' : 'text-muted-foreground'}`}>
            {isMyTurn ? 'Your turn' : `${peerName}'s turn`}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {cards.map((card, i) => (
              <motion.button
                key={i}
                onClick={() => flipCard(i)}
                whileTap={isMyTurn && !card.matched && !flipped.includes(i) ? { scale: 0.95 } : {}}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-border flex items-center justify-center text-2xl sm:text-3xl transition-all ${
                  card.matched ? 'bg-secondary/50 border-foreground/20' :
                  flipped.includes(i) ? 'bg-accent' :
                  isMyTurn ? 'bg-card hover:bg-accent cursor-pointer' : 'bg-card cursor-default'
                }`}
              >
                {(card.matched || flipped.includes(i)) ? (
                  <motion.span initial={{ rotateY: 90 }} animate={{ rotateY: 0 }}>{card.emoji}</motion.span>
                ) : (
                  <span className="text-muted-foreground text-lg">?</span>
                )}
              </motion.button>
            ))}
          </div>
        </>
      )}

      {gameOver && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <p className="text-2xl font-bold">
            {scores[1] > scores[2] ? (my === 1 ? '🏆 You win!' : `${peerName} wins!`) :
             scores[2] > scores[1] ? (my === 2 ? '🏆 You win!' : `${peerName} wins!`) : "It's a tie!"}
          </p>
          {isHost && <Button onClick={startGame}>Play Again</Button>}
        </motion.div>
      )}
    </div>
  );
};

export default MemoryMatch;
