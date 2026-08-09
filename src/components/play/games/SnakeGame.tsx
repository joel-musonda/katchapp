import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const GRID = 20;
const CELL = 16;
type Dir = 'up' | 'down' | 'left' | 'right';
type Pt = { x: number; y: number };

const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

interface SnakeState {
  s1: Pt[]; s2: Pt[]; d1: Dir; d2: Dir;
  food: Pt; scores: { 1: number; 2: number };
  over: boolean; winner: number | null; started: boolean;
}

const randFood = (s1: Pt[], s2: Pt[]): Pt => {
  let f: Pt;
  do { f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }; }
  while (s1.some(p => p.x === f.x && p.y === f.y) || s2.some(p => p.x === f.x && p.y === f.y));
  return f;
};

const move = (s: Pt[], d: Dir): Pt[] => {
  const h = { ...s[0] };
  if (d === 'up') h.y--; else if (d === 'down') h.y++;
  else if (d === 'left') h.x--; else h.x++;
  return [h, ...s.slice(0, -1)];
};

const init = (): SnakeState => ({
  s1: [{ x: 4, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 10 }],
  s2: [{ x: 15, y: 10 }, { x: 16, y: 10 }, { x: 17, y: 10 }],
  d1: 'right', d2: 'left', food: { x: 10, y: 10 },
  scores: { 1: 0, 2: 0 }, over: false, winner: null, started: false,
});

const SnakeGame = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const my = isHost ? 1 : 2;
  const [st, setSt] = useState<SnakeState>(init());
  const ref = useRef(st);
  const sendRef = useRef(onSendState);
  useEffect(() => { ref.current = st; }, [st]);
  useEffect(() => { sendRef.current = onSendState; }, [onSendState]);

  useEffect(() => {
    if (!isHost || !st.started || st.over) return;
    const iv = setInterval(() => {
      const s = { ...ref.current };
      s.s1 = move(s.s1, s.d1);
      s.s2 = move(s.s2, s.d2);
      const h1 = s.s1[0], h2 = s.s2[0];
      if (h1.x === s.food.x && h1.y === s.food.y) {
        s.s1 = [h1, ...ref.current.s1]; s.scores[1]++; s.food = randFood(s.s1, s.s2);
      }
      if (h2.x === s.food.x && h2.y === s.food.y) {
        s.s2 = [h2, ...ref.current.s2]; s.scores[2]++; s.food = randFood(s.s1, s.s2);
      }
      const d1 = h1.x < 0 || h1.x >= GRID || h1.y < 0 || h1.y >= GRID ||
        s.s1.slice(1).some(p => p.x === h1.x && p.y === h1.y) ||
        s.s2.some(p => p.x === h1.x && p.y === h1.y);
      const d2 = h2.x < 0 || h2.x >= GRID || h2.y < 0 || h2.y >= GRID ||
        s.s2.slice(1).some(p => p.x === h2.x && p.y === h2.y) ||
        s.s1.some(p => p.x === h2.x && p.y === h2.y);
      if (d1 || d2) { s.over = true; s.winner = d1 && d2 ? null : d1 ? 2 : 1; }
      setSt(s); ref.current = s;
      sendRef.current({ ...s, t: 'state' });
    }, 150);
    return () => clearInterval(iv);
  }, [isHost, st.started, st.over]);

  useEffect(() => {
    if (!peerState) return;
    if (isHost && peerState.dir) {
      if (OPP[peerState.dir as Dir] !== ref.current.d2) ref.current.d2 = peerState.dir;
    } else if (!isHost && peerState.t === 'state') { setSt(peerState); ref.current = peerState; }
    else if (peerState.t === 'start') setSt(s => ({ ...s, started: true }));
    else if (peerState.t === 'reset') { const s = init(); setSt(s); ref.current = s; }
  }, [peerState, isHost]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const m: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const d = m[e.key]; if (!d) return; e.preventDefault();
      if (isHost) { if (OPP[d] !== ref.current.d1) ref.current.d1 = d; }
      else sendRef.current({ dir: d });
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isHost]);

  const start = () => { const s = { ...init(), started: true }; setSt(s); ref.current = s; sendRef.current({ t: 'start' }); };
  const reset = () => { const s = init(); setSt(s); ref.current = s; sendRef.current({ t: 'reset' }); };
  const cd = (d: Dir) => { if (isHost) { if (OPP[d] !== ref.current.d1) ref.current.d1 = d; } else sendRef.current({ dir: d }); };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Snake</h2>
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="text-center"><p className="text-muted-foreground">{myName}</p><p className="text-2xl font-bold">{st.scores[my as 1|2]}</p></div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center"><p className="text-muted-foreground">{peerName}</p><p className="text-2xl font-bold">{st.scores[(my===1?2:1) as 1|2]}</p></div>
      </div>
      <p className="text-sm text-muted-foreground">
        {!st.started ? 'Press Start' : st.over ? (st.winner === my ? 'You win! 🎉' : st.winner ? `${peerName} wins!` : 'Draw!') : 'Use arrow keys or buttons'}
      </p>
      {!st.started && !st.over && <Button onClick={start}>Start Game</Button>}
      <div className="border border-border bg-card relative" style={{ width: GRID * CELL, height: GRID * CELL }}>
        {st.s1.map((p, i) => <div key={`a${i}`} className={`absolute rounded-sm ${my===1?'bg-foreground':'bg-muted-foreground'}`} style={{ left: p.x*CELL, top: p.y*CELL, width: CELL-1, height: CELL-1, opacity: i===0?1:0.7 }} />)}
        {st.s2.map((p, i) => <div key={`b${i}`} className={`absolute rounded-sm ${my===2?'bg-foreground':'bg-muted-foreground'}`} style={{ left: p.x*CELL, top: p.y*CELL, width: CELL-1, height: CELL-1, opacity: i===0?1:0.7 }} />)}
        <div className="absolute rounded-full bg-foreground" style={{ left: st.food.x*CELL+2, top: st.food.y*CELL+2, width: CELL-5, height: CELL-5 }} />
      </div>
      <div className="grid grid-cols-3 gap-1 md:hidden">
        <div /><Button variant="outline" size="sm" onClick={() => cd('up')}>↑</Button><div />
        <Button variant="outline" size="sm" onClick={() => cd('left')}>←</Button>
        <Button variant="outline" size="sm" onClick={() => cd('down')}>↓</Button>
        <Button variant="outline" size="sm" onClick={() => cd('right')}>→</Button>
      </div>
      {st.over && <Button onClick={reset}>Play Again</Button>}
    </div>
  );
};

export default SnakeGame;
