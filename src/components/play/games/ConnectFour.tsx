import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const ROWS = 6;
const COLS = 7;

const createBoard = (): number[][] =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const checkWin = (board: number[][], row: number, col: number, player: number): boolean => {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    let count = 1;
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) count++;
      else break;
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) count++;
      else break;
    }
    if (count >= 4) return true;
  }
  return false;
};

const ConnectFour = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const myPlayer = isHost ? 1 : 2;
  const peerPlayer = isHost ? 2 : 1;
  const [board, setBoard] = useState(createBoard());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState<number | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [scores, setScores] = useState({ 1: 0, 2: 0 });
  const [lastDrop, setLastDrop] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    if (peerState) {
      setBoard(peerState.board);
      setCurrentPlayer(peerState.currentPlayer);
      setWinner(peerState.winner);
      setIsDraw(peerState.isDraw || false);
      if (peerState.scores) setScores(peerState.scores);
      if (peerState.lastDrop) setLastDrop(peerState.lastDrop);
    }
  }, [peerState]);

  const isMyTurn = !winner && !isDraw && currentPlayer === myPlayer;

  const dropPiece = (col: number) => {
    if (!isMyTurn) return;
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === 0) { row = r; break; }
    }
    if (row === -1) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = myPlayer;
    const nextPlayer = myPlayer === 1 ? 2 : 1;

    let newWinner: number | null = null;
    let newDraw = false;
    if (checkWin(newBoard, row, col, myPlayer)) {
      newWinner = myPlayer;
    } else if (newBoard.every(r => r.every(c => c !== 0))) {
      newDraw = true;
    }

    const newScores = newWinner
      ? { ...scores, [newWinner]: scores[newWinner as 1 | 2] + 1 }
      : scores;

    setBoard(newBoard);
    setCurrentPlayer(nextPlayer);
    setWinner(newWinner);
    setIsDraw(newDraw);
    setScores(newScores);
    setLastDrop({ row, col });

    onSendState({
      board: newBoard, currentPlayer: nextPlayer, winner: newWinner,
      isDraw: newDraw, scores: newScores, lastDrop: { row, col },
    });
  };

  const resetGame = () => {
    const newBoard = createBoard();
    setBoard(newBoard);
    setCurrentPlayer(1);
    setWinner(null);
    setIsDraw(false);
    setLastDrop(null);
    onSendState({
      board: newBoard, currentPlayer: 1, winner: null,
      isDraw: false, scores, lastDrop: null,
    });
  };

  const getStatusText = () => {
    if (isDraw) return "It's a draw!";
    if (winner === myPlayer) return 'You win! 🎉';
    if (winner) return `${peerName} wins!`;
    return isMyTurn ? 'Your turn' : `${peerName}'s turn`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">Connect Four</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-foreground" />
            <span className="text-muted-foreground">{myName}</span>
          </div>
          <p className="text-2xl font-bold">{scores[myPlayer as 1 | 2]}</p>
        </div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">{peerName}</span>
          </div>
          <p className="text-2xl font-bold">{scores[peerPlayer as 1 | 2]}</p>
        </div>
      </div>

      <p className={`text-sm font-medium ${isMyTurn ? 'text-foreground' : 'text-muted-foreground'}`}>
        {getStatusText()}
      </p>

      <div className="bg-card border border-border rounded-xl p-2 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              onClick={() => dropPiece(c)}
              disabled={!isMyTurn || board[0][c] !== 0}
              className="h-6 rounded text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-0 disabled:cursor-default"
            >
              ↓
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-border bg-background flex items-center justify-center"
              >
                {cell !== 0 && (
                  <motion.div
                    initial={
                      lastDrop?.row === r && lastDrop?.col === c
                        ? { y: -(r + 1) * 48, opacity: 0 }
                        : { scale: 0 }
                    }
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${
                      cell === 1 ? 'bg-foreground' : 'bg-muted-foreground'
                    }`}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {(winner || isDraw) && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default ConnectFour;
