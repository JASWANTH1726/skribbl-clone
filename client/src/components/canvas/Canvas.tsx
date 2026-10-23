import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { DrawPoint, DrawStroke, DrawTool } from '@skribbl/shared';
import { Eraser, Paintbrush, RotateCcw, Trash2 } from 'lucide-react';

interface CanvasProps {
  isDrawer: boolean;
  drawerName?: string | null;
}

const PALETTE = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3',
  '#880015', '#b97a57', '#ed1c24', '#ffaec9',
  '#ff7f27', '#ffc90e', '#fff200', '#efe4b0',
  '#22b14c', '#b5e61d', '#00a2e8', '#99d9ea',
  '#3f48cc', '#7092be', '#a349a4', '#c8bfe7'
];

const BRUSH_SIZES = [3, 6, 12, 24];

export const Canvas: React.FC<CanvasProps> = ({ isDrawer, drawerName }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { socket } = useSocket();

  const [tool, setTool] = useState<DrawTool>('brush');
  const [color, setColor] = useState<string>('#000000');
  const [size, setSize] = useState<number>(6);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Local stroke history
  const strokesRef = useRef<DrawStroke[]>([]);
  const currentRemoteStrokeRef = useRef<{ tool: DrawTool; color: string; size: number; points: DrawPoint[] } | null>(null);

  // Redraw entire canvas from stroke history
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderStroke = (stroke: { tool: DrawTool; color: string; size: number; points: DrawPoint[] }) => {
      if (stroke.points.length === 0) return;

      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.size;
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;

      const first = stroke.points[0];
      const startX = first.x * canvas.width;
      const startY = first.y * canvas.height;
      ctx.moveTo(startX, startY);

      if (stroke.points.length === 1) {
        ctx.lineTo(startX + 0.1, startY + 0.1);
      } else {
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
        }
      }
      ctx.stroke();
    };

    strokesRef.current.forEach(renderStroke);

    if (currentRemoteStrokeRef.current) {
      renderStroke(currentRemoteStrokeRef.current);
    }
  }, []);

  // Handle canvas sizing
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const targetWidth = Math.floor(rect.width);
      const targetHeight = Math.floor(rect.height);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        redraw();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [redraw]);

  // Socket event listeners for viewer drawing sync
  useEffect(() => {
    if (!socket) return;

    const handleDrawStart = (data: any) => {
      currentRemoteStrokeRef.current = {
        tool: data.tool || 'brush',
        color: data.color || '#000000',
        size: data.size || 6,
        points: [{ x: data.x, y: data.y }]
      };
      redraw();
    };

    const handleDrawMove = (data: any) => {
      if (currentRemoteStrokeRef.current) {
        currentRemoteStrokeRef.current.points.push({ x: data.x, y: data.y });
        redraw();
      }
    };

    const handleDrawEnd = () => {
      if (currentRemoteStrokeRef.current) {
        strokesRef.current.push({
          id: `remote_${Date.now()}`,
          ...currentRemoteStrokeRef.current
        });
        currentRemoteStrokeRef.current = null;
        redraw();
      }
    };

    const handleDrawData = (stroke: DrawStroke) => {
      // Make sure stroke is recorded
      const exists = strokesRef.current.some(s => s.id === stroke.id);
      if (!exists) {
        strokesRef.current.push(stroke);
        redraw();
      }
    };

    const handleClear = () => {
      strokesRef.current = [];
      currentRemoteStrokeRef.current = null;
      redraw();
    };

    const handleSync = (strokes: DrawStroke[]) => {
      strokesRef.current = strokes;
      redraw();
    };

    socket.on('draw_start', handleDrawStart);
    socket.on('draw_move', handleDrawMove);
    socket.on('draw_end', handleDrawEnd);
    socket.on('draw_data', handleDrawData);
    socket.on('canvas_clear', handleClear);
    socket.on('canvas_sync', handleSync);

    return () => {
      socket.off('draw_start', handleDrawStart);
      socket.off('draw_move', handleDrawMove);
      socket.off('draw_end', handleDrawEnd);
      socket.off('draw_data', handleDrawData);
      socket.off('canvas_clear', handleClear);
      socket.off('canvas_sync', handleSync);
    };
  }, [socket, redraw]);

  // Pointer event handlers for drawer
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): DrawPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !socket) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const pt = getCanvasCoords(e);
    const newStroke: DrawStroke = {
      id: `local_${Date.now()}`,
      tool,
      color,
      size,
      points: [pt]
    };

    strokesRef.current.push(newStroke);
    redraw();

    socket.emit('draw_start', {
      x: pt.x,
      y: pt.y,
      color,
      size,
      tool
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawing || !socket) return;
    const pt = getCanvasCoords(e);

    const current = strokesRef.current[strokesRef.current.length - 1];
    if (current) {
      current.points.push(pt);
      redraw();
    }

    socket.emit('draw_move', { x: pt.x, y: pt.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawing || !socket) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    setIsDrawing(false);
    socket.emit('draw_end');
  };

  const handleClearCanvas = () => {
    if (!isDrawer || !socket) return;
    strokesRef.current = [];
    redraw();
    socket.emit('canvas_clear');
  };

  const handleUndo = () => {
    if (!isDrawer || !socket) return;
    strokesRef.current.pop();
    redraw();
    socket.emit('draw_undo');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111b2e] shadow-2xl shadow-black/20">
      {/* Canvas Drawing Surface */}
      <div ref={containerRef} className="relative flex-1 cursor-crosshair overflow-hidden bg-[#fffdf7]">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full touch-none block"
        />

        {!isDrawer && (
          <div className="absolute left-3 top-3 flex items-center space-x-2 rounded-full border border-slate-700/30 bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"></span>
            <span>{drawerName ? `${drawerName} is drawing...` : 'Watching drawer...'}</span>
          </div>
        )}
      </div>

      {/* Drawer Toolbar */}
      {isDrawer && (
        <div className="canvas-toolbar flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#111b2e] p-3">
          {/* Tools & Sizes */}
          <div className="canvas-tool-controls flex flex-wrap items-center gap-1">
            <button
              onClick={() => setTool('brush')}
              aria-label="Brush tool"
              aria-pressed={tool === 'brush'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border p-2 transition ${
                tool === 'brush'
                  ? 'border-sky-200/50 bg-sky-300/20 text-sky-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
              }`}
              title="Brush tool"
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              aria-label="Eraser tool"
              aria-pressed={tool === 'eraser'}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-lg border p-2 transition ${
                tool === 'eraser'
                  ? 'border-sky-200/50 bg-sky-300/20 text-sky-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
              }`}
              title="Eraser tool"
            >
              <Eraser className="w-4 h-4" />
            </button>

            {/* Brush Sizes */}
            <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
              {BRUSH_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  aria-label={`Brush size ${s}px`}
                  aria-pressed={size === s}
                  className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border transition ${
                    size === s ? 'border-sky-300 bg-white/[0.08]' : 'border-transparent hover:bg-white/[0.06]'
                  }`}
                  title={`Brush size ${s}px`}
                >
                  <span
                    className="rounded-full bg-white"
                    style={{ width: `${Math.min(18, s + 3)}px`, height: `${Math.min(18, s + 3)}px` }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div className="canvas-color-palette flex max-w-[280px] flex-wrap gap-1">
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool('brush');
                }}
                aria-label={`Color ${c}`}
                aria-pressed={color === c && tool === 'brush'}
                className={`min-h-11 min-w-11 rounded-md border transition ${
                  color === c && tool === 'brush'
                    ? 'z-10 scale-110 border-white ring-2 ring-sky-200'
                      : 'border-white/10 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* Undo & Clear */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleUndo}
              className="flex min-h-11 items-center space-x-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              title="Undo last stroke"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleClearCanvas}
              className="flex min-h-11 items-center space-x-1 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/20"
              title="Clear entire canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
