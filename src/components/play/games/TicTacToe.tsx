import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useConfetti } from '@/hooks/useConfetti';

const checkWinner = (board: (string | null)[]): string | null => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(cell => cell !== null)) return 'draw';
  return null;
};

const TicTacToe = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const mySymbol = isHost ? 'X' : 'O';
  const peerSymbol = isHost ? 'O' : 'X';
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<string>('X');
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const fireConfetti = useConfetti();

  useEffect(() => {
    if (peerState) {
      setBoard(peerState.board);
      setCurrentTurn(peerState.currentTurn);
      if (peerState.scores) setScores(peerState.scores);
    }
  }, [peerState]);

  const winner = checkWinner(board);
  const isMyTurn = !winner && currentTurn === mySymbol;

  // Fire confetti on win
  useEffect(() => {
    if (winner === mySymbol) fireConfetti();
  }, [winner, mySymbol, fireConfetti]);

  const handleClick = (i: number) => {
    if (!isMyTurn || board[i]) return;
    const newBoard = [...board];
    newBoard[i] = mySymbol;
    const nextTurn = mySymbol === 'X' ? 'O' : 'X';

    const w = checkWinner(newBoard);
    const newScores = w && w !== 'draw' ? { ...scores, [w]: scores[w as 'X' | 'O'] + 1 } : scores;

    setBoard(newBoard);
    setCurrentTurn(nextTurn);
    if (w) setScores(newScores);

    onSendState({ board: newBoard, currentTurn: nextTurn, scores: newScores });
  };

  const resetGame = () => {
    const newBoard = Array(9).fill(null);
    setBoard(newBoard);
    setCurrentTurn('X');
    onSendState({ board: newBoard, currentTurn: 'X', scores });
  };

  const getStatusText = () => {
    if (winner === 'draw') return "It's a draw!";
    if (winner === mySymbol) return 'You win! 🎉';
    if (winner) return `${peerName} wins!`;
    return isMyTurn ? 'Your turn' : `${peerName}'s turn`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 gap-6">
      <div className="flex items-center gap-4 w-full max-w-sm justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">Tic Tac Toe</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">{myName} ({mySymbol})</p>
          <p className="text-2xl font-bold">{scores[mySymbol as 'X' | 'O']}</p>
        </div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center">
          <p className="text-muted-foreground">{peerName} ({peerSymbol})</p>
          <p className="text-2xl font-bold">{scores[peerSymbol as 'X' | 'O']}</p>
        </div>
      </div>

      <p className={`text-sm font-medium ${isMyTurn ? 'text-foreground' : 'text-muted-foreground'}`}>
        {getStatusText()}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => (
          <motion.button
            key={i}
            whileTap={isMyTurn && !cell ? { scale: 0.95 } : {}}
            onClick={() => handleClick(i)}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg border border-border bg-card flex items-center justify-center text-3xl sm:text-4xl font-bold transition-colors ${
              isMyTurn && !cell && !winner ? 'hover:bg-accent cursor-pointer' : 'cursor-default'
            }`}
          >
            {cell && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className={cell === 'X' ? 'text-foreground' : 'text-muted-foreground'}
              >
                {cell}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      {winner && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default TicTacToe;
