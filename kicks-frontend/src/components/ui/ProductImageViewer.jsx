import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { NEUTRAL_PRODUCT_IMAGE } from './productImage';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_THRESHOLD = 60;

// Fullscreen product image viewer with wheel/pinch zoom, drag pan,
// swipe + keyboard navigation. Pure React + pointer events, no new deps.
export default function ProductImageViewer({ images = [], initialIndex = 0, alt = 'Product', onClose }) {
  const list = Array.isArray(images) ? images.filter((url) => typeof url === 'string' && url.trim()) : [];
  const [index, setIndex] = useState(() => (initialIndex >= 0 && initialIndex < list.length ? initialIndex : 0));
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState({});
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const closeRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const swipe = useRef(null);

  const count = list.length;
  const src = list[index] && !failed[index] ? list[index] : NEUTRAL_PRODUCT_IMAGE;

  const clampPan = useCallback((next, nextScale) => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return { x: 0, y: 0 };
    const maxX = Math.max(0, (img.clientWidth * nextScale - frame.clientWidth) / 2);
    const maxY = Math.max(0, (img.clientHeight * nextScale - frame.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  const goTo = useCallback((next) => {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [count]);

  const zoomBy = useCallback((factor) => {
    setScale((current) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * factor));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Focus management + Escape/arrows/zoom keys + body scroll lock.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') goTo(index + 1);
      else if (event.key === 'ArrowLeft') goTo(index - 1);
      else if (event.key === '+' || event.key === '=') zoomBy(1.25);
      else if (event.key === '-' || event.key === '_') zoomBy(0.8);
      else if (event.key === '0') resetZoom();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [goTo, index, onClose, resetZoom, zoomBy]);

  // Non-passive wheel zoom (React synthetic wheels are passive).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (event) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
      swipe.current = null;
    } else if (scale === 1) {
      swipe.current = { startX: event.clientX, deltaX: 0, active: true };
    }
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.distance > 0 && distance > 0) {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.current.scale * (distance / pinch.current.distance)));
        setScale(next);
        if (next === 1) setPan({ x: 0, y: 0 });
      }
      return;
    }
    if (pointers.current.size === 1) {
      if (scale > 1) {
        const first = swipe.current;
        const dx = first?.lastX !== undefined ? event.clientX - first.lastX : event.movementX || 0;
        const dy = first?.lastY !== undefined ? event.clientY - first.lastY : event.movementY || 0;
        swipe.current = { ...(first || {}), lastX: event.clientX, lastY: event.clientY };
        setPan((current) => clampPan({ x: current.x + dx, y: current.y + dy }, scale));
      } else if (swipe.current?.active) {
        swipe.current.deltaX = event.clientX - swipe.current.startX;
      }
    }
  };

  const onPointerUp = (event) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (swipe.current?.active && scale === 1) {
      if (swipe.current.deltaX <= -SWIPE_THRESHOLD) goTo(index + 1);
      else if (swipe.current.deltaX >= SWIPE_THRESHOLD) goTo(index - 1);
    }
    swipe.current = null;
  };

  const markFailed = () => setFailed((current) => ({ ...current, [index]: true }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} image viewer`}
      className="fixed inset-0 z-[90] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a8a8a8]" aria-live="polite">
          {count > 1 ? `${index + 1} / ${count}` : alt}
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => zoomBy(0.8)} disabled={scale <= MIN_SCALE} aria-label="Zoom out" className="kicks-icon-btn h-9 w-9 disabled:opacity-40">
            <ZoomOut size={15} />
          </button>
          <button type="button" onClick={() => zoomBy(1.25)} disabled={scale >= MAX_SCALE} aria-label="Zoom in" className="kicks-icon-btn h-9 w-9 disabled:opacity-40">
            <ZoomIn size={15} />
          </button>
          {scale > 1 && (
            <button type="button" onClick={resetZoom} aria-label="Reset zoom" className="kicks-icon-btn h-9 w-9">
              <RotateCcw size={15} />
            </button>
          )}
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close image viewer" className="kicks-icon-btn h-9 w-9">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={frameRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-14"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {count > 1 && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); goTo(index - 1); }}
            aria-label="Previous image"
            className="kicks-icon-btn absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 sm:left-4"
          >
            <ChevronLeft size={17} />
          </button>
        )}
        <img
          ref={imgRef}
          key={`${index}-${src}`}
          src={src}
          alt={`${alt} — image ${index + 1} of ${count}`}
          draggable={false}
          onError={(event) => { event.currentTarget.onerror = null; markFailed(); }}
          className="max-h-full max-w-full select-none rounded-[18px] object-contain transition-transform duration-150 ease-out"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'default' }}
        />
        {count > 1 && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); goTo(index + 1); }}
            aria-label="Next image"
            className="kicks-icon-btn absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 sm:right-4"
          >
            <ChevronRight size={17} />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {list.map((url, thumbIndex) => (
            <button
              key={`${url}-${thumbIndex}`}
              type="button"
              onClick={() => goTo(thumbIndex)}
              aria-label={`View image ${thumbIndex + 1}`}
              aria-current={thumbIndex === index ? 'true' : undefined}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border transition ${thumbIndex === index ? 'border-white/70' : 'border-white/10 opacity-60 hover:opacity-100'}`}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.opacity = '0.25'; }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
