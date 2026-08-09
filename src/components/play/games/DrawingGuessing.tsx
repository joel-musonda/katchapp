import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameProps } from '@/types/game';
import { ArrowLeft, Trash2 } from 'lucide-react';

const DRAW_WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'fish', 'bird',
  'flower', 'mountain', 'boat', 'plane', 'pizza', 'guitar', 'elephant', 'butterfly',
  'rainbow', 'castle', 'robot', 'dinosaur', 'rocket', 'umbrella', 'snowman',
  'balloon', 'bicycle', 'penguin', 'dragon', 'volcano', 'octopus', 'sandwich',
];
const COLORS = ['#f5f5f5', '#ef4444', '#3b82f6', '#22c55e', '#eab308'];
const CW = 400, CH = 300, TIME = 90;

type Stroke = { pts: { x: number; y: number }[]; c: string; s: number };

const DrawingGuessing = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [phase, setPhase] = useState<'setup' | 'drawing' | 'result'>('setup');
  const [isDrawer, setIsDrawer] = useState(isHost);
  const [word, setWord] = useState('');
  const [guess, setGuess] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [cur, setCur] = useState<Stroke | null>(null);
  const [color, setColor] = useState('#f5f5f5');
  const [timer, setTimer] = useState(TIME);
  const [scores, setScores] = useState({ me: 0, peer: 0 });
  const [guessed, setGuessed] = useState(false);
  const [opts, setOpts] = useState<string[]>([]);
  const [wrongMsg, setWrongMsg] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const sendRef = useRef(onSendState);
  const sentTimesUp = useRef(false);
  useEffect(() => { sendRef.current = onSendState; }, [onSendState]);

  useEffect(() => {
    if (phase === 'setup' && isDrawer) {
      const s = [...DRAW_WORDS].sort(() => Math.random() - 0.5);
      setOpts(s.slice(0, 3));
    }
  }, [phase, isDrawer]);

  useEffect(() => {
    if (phase !== 'drawing') return;
    sentTimesUp.current = false;
    const iv = setInterval(() => setTimer(t => t <= 1 ? 0 : t - 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (timer <= 0 && phase === 'drawing' && !sentTimesUp.current) {
      sentTimesUp.current = true;
      setPhase('result');
      if (isDrawer) sendRef.current({ t: 'timesup', w: word });
    }
  }, [timer, phase, isDrawer, word]);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CW, CH);
    const all = cur ? [...strokes, cur] : strokes;
    for (const st of all) {
      if (st.pts.length < 2) continue;
      ctx.beginPath(); ctx.strokeStyle = st.c; ctx.lineWidth = st.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.moveTo(st.pts[0].x, st.pts[0].y);
      for (let i = 1; i < st.pts.length; i++) ctx.lineTo(st.pts[i].x, st.pts[i].y);
      ctx.stroke();
    }
  }, [strokes, cur]);
  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (!peerState) return;
    if (peerState.t === 'startdraw') { setPhase('drawing'); setStrokes([]); setTimer(TIME); setGuessed(false); setIsDrawer(false); setWord(''); }
    if (peerState.t === 'stroke') setStrokes(p => [...p, peerState.stroke]);
    if (peerState.t === 'clear') setStrokes([]);
    if (peerState.t === 'correct') { setGuessed(true); setPhase('result'); setWord(peerState.w); setScores(s => ({ ...s, me: s.me + 1 })); }
    if (peerState.t === 'wrong') { setWrongMsg(true); setTimeout(() => setWrongMsg(false), 1000); }
    if (peerState.t === 'timesup') { setWord(peerState.w); setPhase('result'); }
    if (peerState.t === 'guess' && isDrawer) {
      if (peerState.text.toLowerCase() === word.toLowerCase()) {
        setGuessed(true); setPhase('result'); setScores(s => ({ ...s, peer: s.peer + 1 }));
        sendRef.current({ t: 'correct', w: word });
      } else sendRef.current({ t: 'wrong' });
    }
    if (peerState.t === 'next') { setPhase('setup'); setStrokes([]); setWord(''); setGuess(''); setGuessed(false); setIsDrawer(peerState.you); if (peerState.sc) setScores({ me: peerState.sc.peer, peer: peerState.sc.me }); }
  }, [peerState, isDrawer, word]);

  const selectWord = (w: string) => {
    setWord(w); setPhase('drawing'); setStrokes([]); setTimer(TIME); setIsDrawer(true);
    sendRef.current({ t: 'startdraw' });
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return null;
    const sx = CW / r.width, sy = CH / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: ((e as React.MouseEvent).clientX - r.left) * sx, y: ((e as React.MouseEvent).clientY - r.top) * sy };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer || phase !== 'drawing') return; e.preventDefault();
    const p = getPos(e); if (!p) return;
    drawingRef.current = true; setCur({ pts: [p], c: color, s: 3 });
  };
  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return; e.preventDefault();
    const p = getPos(e); if (!p) return;
    setCur(prev => prev ? { ...prev, pts: [...prev.pts, p] } : null);
  };
  const endDraw = () => {
    if (!drawingRef.current || !cur) return;
    drawingRef.current = false; setStrokes(p => [...p, cur]);
    sendRef.current({ t: 'stroke', stroke: cur }); setCur(null);
  };

  const submitGuess = () => {
    if (!guess.trim() || isDrawer) return;
    sendRef.current({ t: 'guess', text: guess.trim() }); setGuess('');
  };

  const next = () => {
    const nd = !isDrawer;
    setPhase('setup'); setStrokes([]); setWord(''); setGuess(''); setGuessed(false); setIsDrawer(nd);
    sendRef.current({ t: 'next', you: !nd, sc: scores });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-3">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Draw & Guess</h2>
        <div className="flex items-center gap-2 text-sm"><span>{scores.me}</span><span className="text-muted-foreground">:</span><span>{scores.peer}</span></div>
      </div>

      {phase === 'setup' && isDrawer && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Choose a word to draw</p>
          <div className="flex gap-2">{opts.map(w => <Button key={w} variant="outline" onClick={() => selectWord(w)}>{w}</Button>)}</div>
        </div>
      )}
      {phase === 'setup' && !isDrawer && <p className="text-muted-foreground">{peerName} is choosing a word...</p>}

      {(phase === 'drawing' || phase === 'result') && (
        <>
          <div className="flex items-center gap-4 text-sm">
            {isDrawer && <span className="font-mono bg-card px-2 py-1 rounded">{word}</span>}
            <span className="text-muted-foreground">⏱ {timer}s</span>
            <span className="text-muted-foreground">{isDrawer ? 'You draw' : 'Guess!'}</span>
          </div>
          <canvas ref={canvasRef} width={CW} height={CH}
            className="border border-border rounded-lg cursor-crosshair touch-none" style={{ maxWidth: '100%', height: 'auto' }}
            onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw} />
          {isDrawer && phase === 'drawing' && (
            <div className="flex items-center gap-2">
              {COLORS.map(c => <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 ${color===c?'border-foreground':'border-transparent'}`} style={{ backgroundColor: c }} />)}
              <Button variant="ghost" size="icon" onClick={() => { setStrokes([]); sendRef.current({ t: 'clear' }); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
          {!isDrawer && phase === 'drawing' && (
            <div className="flex gap-2 w-full max-w-sm">
              <Input value={guess} onChange={e => setGuess(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitGuess()} placeholder={wrongMsg ? 'Wrong! Try again...' : 'Type your guess...'} className="bg-card border-border" />
              <Button onClick={submitGuess}>Guess</Button>
            </div>
          )}
          {phase === 'result' && (
            <div className="text-center space-y-2">
              <p className="text-lg font-bold">{guessed ? (isDrawer ? `${peerName} guessed it!` : 'You got it! 🎉') : `Time's up! Word: ${word}`}</p>
              <Button onClick={next}>Next Round</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DrawingGuessing;
