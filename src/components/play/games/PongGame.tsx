import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const GW = 400, GH = 280, PH = 60, PW = 8, BS = 10, WIN = 7;

interface PState {
  bx: number; by: number; bvx: number; bvy: number;
  p1: number; p2: number; s1: number; s2: number;
  started: boolean; over: boolean; winner: number | null;
}

const ini = (): PState => ({ bx: GW/2, by: GH/2, bvx: 3, bvy: 2, p1: GH/2-PH/2, p2: GH/2-PH/2, s1: 0, s2: 0, started: false, over: false, winner: null });

const PongGame = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const my = isHost ? 1 : 2;
  const [st, setSt] = useState(ini());
  const ref = useRef(st);
  const keys = useRef({ up: false, down: false });
  const sendRef = useRef(onSendState);
  const frameRef = useRef(0);
  useEffect(() => { ref.current = st; }, [st]);
  useEffect(() => { sendRef.current = onSendState; }, [onSendState]);

  useEffect(() => {
    if (!isHost || !st.started || st.over) return;
    const iv = setInterval(() => {
      const s = { ...ref.current };
      if (keys.current.up) s.p1 = Math.max(0, s.p1 - 5);
      if (keys.current.down) s.p1 = Math.min(GH - PH, s.p1 + 5);
      s.bx += s.bvx; s.by += s.bvy;
      if (s.by <= 0 || s.by >= GH - BS) s.bvy *= -1;
      if (s.bx <= PW + 10 && s.by + BS >= s.p1 && s.by <= s.p1 + PH) { s.bvx = Math.abs(s.bvx) * 1.05; s.bvy += (Math.random() - 0.5) * 2; }
      if (s.bx >= GW - PW - 10 - BS && s.by + BS >= s.p2 && s.by <= s.p2 + PH) { s.bvx = -Math.abs(s.bvx) * 1.05; s.bvy += (Math.random() - 0.5) * 2; }
      if (s.bx <= 0) { s.s2++; s.bx = GW/2; s.by = GH/2; s.bvx = 3; s.bvy = (Math.random()-0.5)*4; }
      if (s.bx >= GW) { s.s1++; s.bx = GW/2; s.by = GH/2; s.bvx = -3; s.bvy = (Math.random()-0.5)*4; }
      s.bvx = Math.max(-8, Math.min(8, s.bvx)); s.bvy = Math.max(-6, Math.min(6, s.bvy));
      if (s.s1 >= WIN || s.s2 >= WIN) { s.over = true; s.winner = s.s1 >= WIN ? 1 : 2; }
      setSt(s); ref.current = s;
      frameRef.current++;
      if (frameRef.current % 2 === 0) sendRef.current({ ...s, t: 'state' });
    }, 16);
    return () => clearInterval(iv);
  }, [isHost, st.started, st.over]);

  useEffect(() => {
    if (!peerState) return;
    if (isHost && peerState.py !== undefined) ref.current.p2 = peerState.py;
    else if (!isHost && peerState.t === 'state') { setSt(peerState); ref.current = peerState; }
    else if (peerState.t === 'start') setSt(s => ({ ...s, started: true }));
    else if (peerState.t === 'reset') { const s = ini(); setSt(s); ref.current = s; }
  }, [peerState, isHost]);

  useEffect(() => {
    const d = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'w') { keys.current.up = true; e.preventDefault(); } if (e.key === 'ArrowDown' || e.key === 's') { keys.current.down = true; e.preventDefault(); } };
    const u = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'w') keys.current.up = false; if (e.key === 'ArrowDown' || e.key === 's') keys.current.down = false; };
    window.addEventListener('keydown', d); window.addEventListener('keyup', u);
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
  }, []);

  useEffect(() => {
    if (isHost) return;
    const iv = setInterval(() => {
      let p = ref.current.p2;
      if (keys.current.up) p = Math.max(0, p - 5);
      if (keys.current.down) p = Math.min(GH - PH, p + 5);
      if (p !== ref.current.p2) { ref.current.p2 = p; sendRef.current({ py: p }); }
    }, 16);
    return () => clearInterval(iv);
  }, [isHost]);

  const start = () => { const s = { ...ini(), started: true }; setSt(s); ref.current = s; sendRef.current({ t: 'start' }); };
  const reset = () => { const s = ini(); setSt(s); ref.current = s; sendRef.current({ t: 'reset' }); };

  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = Math.max(0, Math.min(GH - PH, (e.touches[0].clientY - r.top) * (GH / r.height) - PH / 2));
    if (isHost) ref.current.p1 = y; else { ref.current.p2 = y; sendRef.current({ py: y }); }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Pong</h2>
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="text-center"><p className="text-muted-foreground">{isHost?myName:peerName}</p><p className="text-2xl font-bold">{st.s1}</p></div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center"><p className="text-muted-foreground">{isHost?peerName:myName}</p><p className="text-2xl font-bold">{st.s2}</p></div>
      </div>
      <p className="text-sm text-muted-foreground">
        {!st.started ? 'Press Start' : st.over ? (st.winner===my?'You win! 🎉':`${peerName} wins!`) : `First to ${WIN}`}
      </p>
      {!st.started && !st.over && <Button onClick={start}>Start Game</Button>}
      <div onTouchMove={handleTouch} className="border border-border bg-card relative overflow-hidden rounded-lg" style={{ width: GW, height: GH, maxWidth: '100%' }}>
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        <div className="absolute bg-foreground rounded-sm" style={{ left: 8, top: st.p1, width: PW, height: PH }} />
        <div className="absolute bg-muted-foreground rounded-sm" style={{ right: 8, top: st.p2, width: PW, height: PH }} />
        {st.started && <div className="absolute bg-foreground rounded-full" style={{ left: st.bx, top: st.by, width: BS, height: BS }} />}
      </div>
      <p className="text-xs text-muted-foreground">↑↓ keys or touch to move</p>
      {st.over && <Button onClick={reset}>Play Again</Button>}
    </div>
  );
};

export default PongGame;
