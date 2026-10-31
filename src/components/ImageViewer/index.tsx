import React, { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./styles.module.css";

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.25;

type View = { scale: number; x: number; y: number };
type Point = { x: number; y: number };

const FITTED: View = { scale: 1, x: 0, y: 0 };

function clamp(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

// Zooms about a point given relative to the stage centre, so whatever is under
// the cursor or between the fingers stays where it is.
function zoomAbout(view: View, nextScale: number, at: Point): View {
  const scale = clamp(nextScale);
  if (scale === MIN_SCALE) return FITTED;
  const ratio = scale / view.scale;
  return { scale, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

/** A thumbnail that opens its image full screen, with zoom and pan. */
export default function ImageViewer({
  src,
  alt,
  children,
}: {
  /** The full-size image to show. */
  src: string;
  /** Read out for the image, and used to label the open button. */
  alt: string;
  /** What to show in the page, normally the image itself. */
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={alt ? `Expand image: ${alt}` : "Expand image"}
      >
        {children}
      </button>
      {open && <Viewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Viewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const [view, setView] = useState<View>(FITTED);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // A native listener, because React's wheel handler is passive and cannot
  // stop the page behind the dialog from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = fromCentre(stage, event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? STEP : 1 / STEP;
      setView((current) => zoomAbout(current, current.scale * factor, at));
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => setView((current) => zoomAbout(current, current.scale * factor, { x: 0, y: 0 }));

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };

    if (pointers.current.size === 1) {
      setView((current) =>
        current.scale === MIN_SCALE
          ? current
          : { ...current, x: current.x + next.x - previous.x, y: current.y + next.y - previous.y },
      );
    } else if (pointers.current.size === 2) {
      const [other] = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      const stage = event.currentTarget;
      const at = fromCentre(stage, (next.x + other.x) / 2, (next.y + other.y) / 2);
      if (before > 0) setView((current) => zoomAbout(current, current.scale * (after / before), at));
    }

    pointers.current.set(event.pointerId, next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "+" || event.key === "=") zoomBy(STEP);
    else if (event.key === "-") zoomBy(1 / STEP);
    else if (event.key === "0") setView(FITTED);
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-label={alt || "Image"} onClose={onClose} onKeyDown={onKeyDown}>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => zoomBy(1 / STEP)} disabled={view.scale === MIN_SCALE} aria-label="Zoom out">
          −
        </button>
        <span className={styles.level} aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <button type="button" onClick={() => zoomBy(STEP)} disabled={view.scale === MAX_SCALE} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => setView(FITTED)} aria-label="Fit to screen">
          Fit
        </button>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close">
          ×
        </button>
      </div>
      <div
        ref={stageRef}
        className={styles.stage}
        data-zoomed={view.scale > MIN_SCALE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={styles.image}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
      </div>
    </dialog>
  );
}

function fromCentre(stage: HTMLElement, clientX: number, clientY: number): Point {
  const box = stage.getBoundingClientRect();
  return { x: clientX - (box.left + box.width / 2), y: clientY - (box.top + box.height / 2) };
}
