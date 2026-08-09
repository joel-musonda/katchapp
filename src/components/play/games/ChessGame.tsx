import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Chess } from 'chess.js';

const PIECE_UNICODE: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const ChessGame = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const myColor = isHost ? 'w' : 'b';
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const game = useMemo(() => {
    try { return new Chess(fen); } catch { return new Chess(); }
  }, [fen]);

  useEffect(() => {
    if (peerState?.fen) {
      setFen(peerState.fen);
      setSelectedSquare(null);
      setLegalMoves([]);
      if (peerState.lastMove) setLastMove(peerState.lastMove);
    }
  }, [peerState]);

  const isMyTurn = game.turn() === myColor;

  const handleSquareClick = (square: string) => {
    if (game.isGameOver() || !isMyTurn) return;

    if (selectedSquare) {
      try {
        const chess = new Chess(fen);
        const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) {
          const newFen = chess.fen();
          setFen(newFen);
          setLastMove({ from: selectedSquare, to: square });
          onSendState({ fen: newFen, lastMove: { from: selectedSquare, to: square } });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
      } catch { /* invalid move */ }
    }

    const piece = game.get(square as any);
    if (piece && piece.color === myColor) {
      setSelectedSquare(square);
      const moves = game.moves({ square: square as any, verbose: true });
      setLegalMoves(moves.map((m: any) => m.to));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const resetGame = () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    setFen(startFen);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    onSendState({ fen: startFen, lastMove: null });
  };

  const getStatus = () => {
    if (game.isCheckmate()) return game.turn() === myColor ? `${peerName} wins by checkmate!` : 'Checkmate! You win! 🎉';
    if (game.isDraw()) return "Draw!";
    if (game.isCheck()) return isMyTurn ? 'You are in check!' : `${peerName} is in check!`;
    return isMyTurn ? 'Your turn' : `${peerName}'s turn`;
  };

  const displayRanks = myColor === 'b' ? [...RANKS].reverse() : RANKS;
  const displayFiles = myColor === 'b' ? [...FILES].reverse() : FILES;

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold">Chess</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <p className={`text-sm font-medium ${isMyTurn ? 'text-foreground' : 'text-muted-foreground'}`}>
        {getStatus()}
      </p>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-8">
          {displayRanks.map(rank =>
            displayFiles.map(file => {
              const square = `${file}${rank}`;
              const piece = game.get(square as any);
              const fileIdx = FILES.indexOf(file);
              const rankIdx = RANKS.indexOf(rank);
              const isLight = (fileIdx + rankIdx) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegal = legalMoves.includes(square);
              const isLast = lastMove?.from === square || lastMove?.to === square;

              return (
                <button
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-2xl sm:text-3xl relative transition-colors ${
                    isSelected ? 'bg-foreground/20' :
                    isLast ? 'bg-foreground/10' :
                    isLight ? 'bg-muted/50' : 'bg-secondary'
                  }`}
                >
                  {isLegal && !piece && <div className="absolute w-2 h-2 rounded-full bg-foreground/30" />}
                  {isLegal && piece && <div className="absolute inset-1 border-2 border-foreground/30 rounded-full" />}
                  {piece && (
                    <span className={piece.color === 'w' ? 'text-foreground' : 'text-muted-foreground'}>
                      {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {game.isGameOver() && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default ChessGame;
