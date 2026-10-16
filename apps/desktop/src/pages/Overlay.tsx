import { rectFromPoints, type Point, type Rect } from '@glint/capture-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { glint } from '../glint';

const LOUPE = 132;
const ZOOM = 8;

interface Frame {
  readonly url: string;
  readonly scale: number;
}

/**
 * The area picker for one display: the frozen screen, dimmed except for the selection, with a
 * crosshair, a magnifier and the size in pixels. Drag to capture; Enter or Space takes the whole
 * display; Escape cancels.
 */
export function Overlay({ displayId }: { displayId: string }) {
  const [frame, setFrame] = useState<Frame | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [anchor, setAnchor] = useState<Point | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const loupe = useRef<HTMLCanvasElement>(null);

  useEffect(
    () =>
      glint().on('overlay:frame', (next) => {
        if (next.displayId !== displayId) return;
        setAnchor(null);
        setPointer(null);
        setFrame({ url: next.url, scale: next.scale });
      }),
    [displayId],
  );

  const selection: Rect | null = anchor && pointer ? rectFromPoints(anchor, pointer) : null;

  const done = useCallback(
    (rect: Rect, whole = false) => {
      setFrame(null);
      void glint().invoke('overlay:select', { displayId, rect, whole });
    },
    [displayId],
  );
  const cancel = useCallback(() => {
    setFrame(null);
    void glint().invoke('overlay:cancel');
  }, []);

  useEffect(() => {
    if (!frame) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
      if (event.key === 'Enter' || event.key === ' ') {
        done({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [frame, cancel, done]);

  // The magnifier: the pixels around the pointer, drawn large and sharp, with the centre pixel marked.
  useEffect(() => {
    const canvas = loupe.current;
    const img = image.current;
    if (!canvas || !img || !pointer || !frame) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio;
    canvas.width = LOUPE * ratio;
    canvas.height = LOUPE * ratio;
    context.imageSmoothingEnabled = false;
    const cells = LOUPE / ZOOM;
    const sx = Math.floor(pointer.x * frame.scale - cells / 2);
    const sy = Math.floor(pointer.y * frame.scale - cells / 2);
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, sx, sy, cells, cells, 0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = ratio;
    const cell = ZOOM * ratio;
    const middle = Math.floor(cells / 2) * cell;
    context.strokeRect(middle, middle, cell, cell);
  }, [pointer, frame]);

  if (!frame) return <div className="h-screen w-screen bg-black" />;

  const px = (n: number) => Math.round(n * frame.scale);
  const loupeAt = pointer
    ? {
        left: pointer.x + LOUPE + 40 > window.innerWidth ? pointer.x - LOUPE - 24 : pointer.x + 24,
        top: pointer.y + LOUPE + 64 > window.innerHeight ? pointer.y - LOUPE - 48 : pointer.y + 24,
      }
    : null;

  return (
    <div
      data-testid="overlay"
      className="relative h-screen w-screen cursor-crosshair overflow-hidden select-none"
      onPointerMove={(event) => {
        setPointer({ x: event.clientX, y: event.clientY });
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          cancel();
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setAnchor({ x: event.clientX, y: event.clientY });
        setPointer({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) => {
        if (!anchor) return;
        done(rectFromPoints(anchor, { x: event.clientX, y: event.clientY }));
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <img
        ref={image}
        src={frame.url}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
        onLoad={() => void glint().invoke('overlay:ready', displayId)}
      />
      {/* Dimming everywhere but the selection: four boxes around it, or one over everything. */}
      {selection ? (
        <>
          <div
            className="absolute bg-black/45"
            style={{ left: 0, top: 0, right: 0, height: selection.y }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              left: 0,
              top: selection.y + selection.height,
              right: 0,
              bottom: 0,
            }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              left: 0,
              top: selection.y,
              width: selection.x,
              height: selection.height,
            }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              left: selection.x + selection.width,
              top: selection.y,
              right: 0,
              height: selection.height,
            }}
          />
          <div
            data-testid="selection"
            className="absolute outline outline-1 outline-white/90"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height,
            }}
          />
          <div
            className="absolute rounded-md bg-black/75 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums"
            style={{
              left: selection.x,
              top:
                selection.y + selection.height + 8 > window.innerHeight - 24
                  ? selection.y - 26
                  : selection.y + selection.height + 8,
            }}
          >
            {px(selection.width)} × {px(selection.height)}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-black/20" />
      )}
      {pointer && !anchor ? (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/50"
            style={{ left: pointer.x }}
          />
          <div
            className="pointer-events-none absolute right-0 left-0 h-px bg-white/50"
            style={{ top: pointer.y }}
          />
        </>
      ) : null}
      {pointer && loupeAt ? (
        <div
          className="pointer-events-none absolute flex flex-col items-center gap-1"
          style={loupeAt}
        >
          <canvas
            ref={loupe}
            className="rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-2 ring-white/80"
            style={{ width: LOUPE, height: LOUPE }}
          />
          <span className="rounded-md bg-black/75 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
            {px(pointer.x)}, {px(pointer.y)}
          </span>
        </div>
      ) : null}
      {!anchor ? (
        <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-[12px] text-white/90">
          Drag to capture an area · Enter for the whole screen · Esc to cancel
        </div>
      ) : null}
    </div>
  );
}
