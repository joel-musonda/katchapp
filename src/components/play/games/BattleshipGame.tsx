import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const GRID = 10;
type Cell = 'empty' | 'ship' | 'hit' | 'miss';
type Phase = 'placing' | 'playing' | 'done';
const SHIPS = [4, 3, 3, 2, 2];

const createGrid = (): Cell[] => Array(GRID * GRID).fill('empty');

const canPlace = (grid: Cell[], start: number, size: number, horizontal: boolean): boolean => {
  for (let i = 0; i < size; i++) {
    const r = Math.floor(start / GRID) + (horizontal ? 0 : i);
    const c = (start % GRID) + (horizontal ? i : 0);
    if (r >= GRID || c >= GRID) return false;
    if (grid[r * GRID + c] !== 'empty') return false;
  }
  return true;
};

const placeShip = (grid: Cell[], start: number, size: number, horizontal: boolean): Cell[] => {
  const g = [...grid];
  for (let i = 0; i < size; i++) {
    const r = Math.floor(start / GRID) + (horizontal ? 0 : i);
    const c = (start % GRID) + (horizontal ? i : 0);
    g[r * GRID + c] = 'ship';
  }
  return g;
};

const autoPlace = (): Cell[] => {
  let grid = createGrid();
  for (const size of SHIPS) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const h = Math.random() > 0.5;
      const start = Math.floor(Math.random() * 100);
      if (canPlace(grid, start, size, h)) {
        grid = placeShip(grid, start, size, h);
        placed = true;
      }
    }
  }
  return grid;
};

const BattleshipGame = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [myGrid, setMyGrid] = useState<Cell[]>(() => autoPlace());
  const [peerGrid, setPeerGrid] = useState<Cell[]>(() => createGrid());
  const [isMyTurn, setIsMyTurn] = useState(isHost);
  const [phase, setPhase] = useState<Phase>('playing');
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState({ me: 0, peer: 0 });

  useEffect(() => {
    if (!peerState) return;
    if (peerState.type === 'shot') {
      const { index } = peerState;
      setMyGrid(prev => {
        const g = [...prev];
        const wasShip = g[index] === 'ship';
        g[index] = wasShip ? 'hit' : 'miss';
        const allSunk = g.filter(c => c === 'ship').length === 0 && g.filter(c => c === 'hit').length > 0;
        if (allSunk) {
          setPhase('done');
          setWinner(peerName);
          setScores(s => ({ ...s, peer: s.peer + 1 }));
          onSendState({ type: 'result', result: wasShip ? 'hit' : 'miss', index, won: true });
        } else {
          onSendState({ type: 'result', result: wasShip ? 'hit' : 'miss', index, won: false });
        }
        return g;
      });
      setIsMyTurn(true);
    } else if (peerState.type === 'result') {
      setPeerGrid(prev => {
        const g = [...prev];
        g[peerState.index] = peerState.result;
        return g;
      });
      if (peerState.won) {
        setPhase('done');
        setWinner(myName);
        setScores(s => ({ ...s, me: s.me + 1 }));
      }
      setIsMyTurn(false);
    }
  }, [peerState, myName, peerName, onSendState]);

  const shoot = (index: number) => {
    if (!isMyTurn || phase === 'done' || peerGrid[index] !== 'empty') return;
    onSendState({ type: 'shot', index });
  };

  const resetGame = () => {
    const newGrid = autoPlace();
    setMyGrid(newGrid);
    setPeerGrid(createGrid());
    setIsMyTurn(isHost);
    setPhase('playing');
    setWinner(null);
    onSendState({ type: 'reset' });
  };

  useEffect(() => {
    if (peerState?.type === 'reset') {
      setMyGrid(autoPlace());
      setPeerGrid(createGrid());
      setIsMyTurn(isHost);
      setPhase('playing');
      setWinner(null);
    }
  }, [peerState, isHost]);

  const renderGrid = (grid: Cell[], isEnemy: boolean, onClick?: (i: number) => void) => (
    <div className="grid grid-cols-10 gap-0.5">
      {grid.map((cell, i) => (
        <button
          key={i}
          onClick={() => onClick?.(i)}
          disabled={!isEnemy || !isMyTurn || phase === 'done' || cell !== 'empty'}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-sm text-[10px] transition-colors ${
            cell === 'hit' ? 'bg-destructive text-destructive-foreground' :
            cell === 'miss' ? 'bg-muted' :
            cell === 'ship' && !isEnemy ? 'bg-foreground/30' :
            'bg-secondary hover:bg-accent'
          } ${isEnemy && cell === 'empty' && isMyTurn && phase !== 'done' ? 'cursor-crosshair' : ''}`}
        >
          {cell === 'hit' ? '×' : cell === 'miss' ? '·' : ''}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Battleship</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}><RotateCcw className="h-4 w-4" /></Button>
      </div>

      <p className={`text-sm font-medium ${isMyTurn && !winner ? 'text-foreground' : 'text-muted-foreground'}`}>
        {winner ? (winner === myName ? 'You win! 🎉' : `${peerName} wins!`) : isMyTurn ? 'Your turn — shoot!' : `${peerName}'s turn...`}
      </p>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">Enemy Waters</p>
          {renderGrid(peerGrid, true, shoot)}
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2">Your Fleet</p>
          {renderGrid(myGrid, false)}
        </div>
      </div>

      {winner && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default BattleshipGame;
