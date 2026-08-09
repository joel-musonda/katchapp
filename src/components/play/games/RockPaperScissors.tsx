import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft } from 'lucide-react';

type Choice = 'rock' | 'paper' | 'scissors';

const CHOICES: { id: Choice; emoji: string; label: string }[] = [
  { id: 'rock', emoji: '🪨', label: 'Rock' },
  { id: 'paper', emoji: '📄', label: 'Paper' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors' },
];

const getResult = (a: Choice, b: Choice): 'win' | 'lose' | 'draw' => {
  if (a === b) return 'draw';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) return 'win';
  return 'lose';
};

const RockPaperScissors = ({ peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [peerChoice, setPeerChoice] = useState<Choice | null>(null);
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ me: 0, peer: 0 });
  const [phase, setPhase] = useState<'choosing' | 'reveal'>('choosing');
  const bestOf = 5;
  const processedRound = useRef(0);

  useEffect(() => {
    if (!peerState) return;
    if (peerState.choice && phase === 'choosing') {
      setPeerChoice(peerState.choice);
    }
    if (peerState.nextRound && peerState.round !== round) {
      setMyChoice(null);
      setPeerChoice(null);
      setPhase('choosing');
      setRound(peerState.round);
      processedRound.current = 0;
      if (peerState.reset) {
        setScores({ me: 0, peer: 0 });
      }
    }
  }, [peerState, phase, round]);

  useEffect(() => {
    if (myChoice && peerChoice && phase === 'choosing' && processedRound.current !== round) {
      processedRound.current = round;
      setPhase('reveal');
      const result = getResult(myChoice, peerChoice);
      if (result === 'win') setScores(s => ({ ...s, me: s.me + 1 }));
      else if (result === 'lose') setScores(s => ({ ...s, peer: s.peer + 1 }));
    }
  }, [myChoice, peerChoice, phase, round]);

  const handleChoice = (choice: Choice) => {
    if (phase !== 'choosing' || myChoice) return;
    setMyChoice(choice);
    onSendState({ choice });
  };

  const nextRound = () => {
    const newRound = round + 1;
    setMyChoice(null);
    setPeerChoice(null);
    setPhase('choosing');
    setRound(newRound);
    processedRound.current = 0;
    onSendState({ nextRound: true, round: newRound });
  };

  const resetGame = () => {
    setMyChoice(null);
    setPeerChoice(null);
    setPhase('choosing');
    setRound(1);
    setScores({ me: 0, peer: 0 });
    processedRound.current = 0;
    onSendState({ nextRound: true, round: 1, reset: true });
  };

  const result = myChoice && peerChoice ? getResult(myChoice, peerChoice) : null;
  const gameOver = scores.me >= Math.ceil(bestOf / 2) || scores.peer >= Math.ceil(bestOf / 2);

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 gap-6">
      <div className="flex items-center gap-4 w-full max-w-sm justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">Rock Paper Scissors</h2>
        <span className="text-sm text-muted-foreground">Best of {bestOf}</span>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">{myName}</p>
          <p className="text-2xl font-bold">{scores.me}</p>
        </div>
        <span className="text-muted-foreground">Round {round}</span>
        <div className="text-center">
          <p className="text-muted-foreground">{peerName}</p>
          <p className="text-2xl font-bold">{scores.peer}</p>
        </div>
      </div>

      {phase === 'choosing' && !gameOver && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {myChoice ? `Waiting for ${peerName}...` : 'Make your choice'}
          </p>
          <div className="flex gap-4">
            {CHOICES.map((c) => (
              <motion.button
                key={c.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleChoice(c.id)}
                disabled={!!myChoice}
                className={`w-24 h-24 rounded-xl border border-border bg-card flex flex-col items-center justify-center gap-1 transition-all ${
                  myChoice === c.id ? 'border-foreground bg-accent' : 'hover:bg-accent'
                } disabled:cursor-default`}
              >
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {phase === 'reveal' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center gap-8">
            <div className="text-center">
              <span className="text-5xl">{CHOICES.find(c => c.id === myChoice)?.emoji}</span>
              <p className="text-sm text-muted-foreground mt-2">You</p>
            </div>
            <span className="text-2xl font-bold text-muted-foreground">vs</span>
            <div className="text-center">
              <span className="text-5xl">{CHOICES.find(c => c.id === peerChoice)?.emoji}</span>
              <p className="text-sm text-muted-foreground mt-2">{peerName}</p>
            </div>
          </div>
          <p className="text-lg font-bold">
            {result === 'win' && '🎉 You win this round!'}
            {result === 'lose' && `${peerName} wins this round!`}
            {result === 'draw' && "It's a draw!"}
          </p>
          {!gameOver && <Button onClick={nextRound}>Next Round</Button>}
        </motion.div>
      )}

      {gameOver && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <p className="text-2xl font-bold">
            {scores.me > scores.peer ? '🏆 You win the match!' : `${peerName} wins the match!`}
          </p>
          <Button onClick={resetGame}>Play Again</Button>
        </motion.div>
      )}
    </div>
  );
};

export default RockPaperScissors;
