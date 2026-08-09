import { useCallback, useEffect, useRef } from 'react';

interface ConfettiPiece {
  x: number; y: number; vx: number; vy: number;
  rotation: number; rotationSpeed: number;
  width: number; height: number; color: string; life: number;
}

export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const piecesRef = useRef<ConfettiPiece[]>([]);

  const ensureCanvas = useCallback(() => {
    if (canvasRef.current) return canvasRef.current;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;
    return canvas;
  }, []);

  const fire = useCallback(() => {
    const canvas = ensureCanvas();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = ['#fff', '#ccc', '#888', '#ddd', '#aaa', '#eee'];
    const pieces = piecesRef.current;

    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      pieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        width: 4 + Math.random() * 6,
        height: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 120 + Math.random() * 60,
      });
    }

    if (animRef.current) return; // Already animating

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        p.life--;

        if (p.life <= 0) { pieces.splice(i, 1); continue; }

        const alpha = Math.min(1, p.life / 30);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }

      if (pieces.length > 0) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        animRef.current = 0;
        if (canvasRef.current) {
          canvasRef.current.remove();
          canvasRef.current = null;
        }
      }
    };

    animRef.current = requestAnimationFrame(animate);
  }, [ensureCanvas]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      canvasRef.current?.remove();
    };
  }, []);

  return fire;
}
