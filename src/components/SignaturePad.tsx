import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
};

// Lightweight signature pad (no external dependency). Works with mouse and
// touch via Pointer Events. Draws on a high-DPI canvas.
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; className?: string }>(
  ({ onChange, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const hasInk = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    // Size the canvas backing store to its CSS size * DPR for crisp lines.
    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1f2937';
      }
    };

    useEffect(() => {
      setupCanvas();
      const handle = () => setupCanvas();
      window.addEventListener('resize', handle);
      return () => window.removeEventListener('resize', handle);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pos = (e: React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent) => {
      e.preventDefault();
      drawing.current = true;
      last.current = pos(e);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };

    const move = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !last.current) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      if (!hasInk.current) {
        hasInk.current = true;
        onChange?.(false);
      }
    };

    const end = (e: React.PointerEvent) => {
      drawing.current = false;
      last.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasInk.current = false;
        onChange?.(true);
      },
      isEmpty: () => !hasInk.current,
      toDataURL: () => canvasRef.current?.toDataURL('image/png') || '',
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className={className}
        style={{ touchAction: 'none', width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
      />
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
