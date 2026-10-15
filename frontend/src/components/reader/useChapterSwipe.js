import { useEffect, useLayoutEffect, useRef } from 'react';

const LOCK_DISTANCE = 10; // px before a gesture is classified as horizontal or vertical
const COMMIT_RATIO = 0.22; // share of the surface width that commits on release
const COMMIT_VELOCITY = 0.45; // px/ms flick that commits a shorter drag
const MIN_FLICK = 32; // px a flick must still travel
const EDGE_ZONE = 0.16; // share of the viewport width on each side that acts as a tap zone
const TAP_MS = 320;
const RUBBER_BAND = 0.22; // resistance when there is no chapter in that direction
const SPRING = 'var(--ease-spring)';

const hasTextSelection = () => Boolean(window.getSelection()?.toString().trim());
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
 * Horizontal chapter swipe on a touch/pen surface. The content follows the finger through an
 * inline transform (no React render per frame), commits past a distance or velocity threshold
 * and springs back otherwise. Vertical scrolling stays native: the surface sets
 * `touch-action: pan-y`, so a vertical pan ends in pointercancel, which the hook ignores.
 * Text selection and mouse input never start a swipe. Short taps in the outer viewport edges
 * move one chapter, like turning a page. `resetKey` (the chapter) clears the offset before paint.
 */
export function useChapterSwipe(ref, { enabled, canPrev, canNext, onCommit, resetKey }) {
  const latest = useRef({ canPrev, canNext, onCommit });
  useEffect(() => {
    latest.current = { canPrev, canNext, onCommit };
  });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.transition = '';
    node.style.transform = '';
    node.style.opacity = '';
  }, [ref, resetKey, enabled]);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return undefined;
    let gesture = null;
    let leaving = 0;

    const paint = (offset, transition = 'none') => {
      node.style.transition = transition;
      node.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : '';
      node.style.opacity = offset
        ? String(Math.max(0.5, 1 - Math.abs(offset) / (node.offsetWidth * 1.4)))
        : '';
    };
    const springBack = () => paint(0, `transform 420ms ${SPRING}, opacity 420ms ${SPRING}`);
    const allowed = (direction) =>
      direction === 'next' ? latest.current.canNext : latest.current.canPrev;
    const commit = (direction, offset) => {
      if (prefersReducedMotion()) {
        paint(0);
        latest.current.onCommit(direction);
        return;
      }
      const out =
        (direction === 'next' ? -1 : 1) * Math.max(node.offsetWidth * 0.45, Math.abs(offset));
      node.style.transition = `transform 180ms ${SPRING}, opacity 180ms ${SPRING}`;
      node.style.transform = `translate3d(${out}px, 0, 0)`;
      node.style.opacity = '0';
      leaving = window.setTimeout(() => {
        leaving = 0;
        latest.current.onCommit(direction);
      }, 170);
    };

    const onDown = (event) => {
      if (event.pointerType === 'mouse' || !event.isPrimary || leaving) return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: event.timeStamp,
        locked: false,
        offset: 0,
        samples: [[event.timeStamp, event.clientX]],
      };
    };
    const onMove = (event) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.locked) {
        if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
        if (Math.abs(dy) >= Math.abs(dx) * 0.8 || hasTextSelection()) {
          gesture = null;
          return;
        }
        gesture.locked = true;
        node.setPointerCapture?.(event.pointerId);
      }
      const direction = dx < 0 ? 'next' : 'prev';
      gesture.offset = allowed(direction) ? dx : dx * RUBBER_BAND;
      gesture.samples = [...gesture.samples.slice(-4), [event.timeStamp, event.clientX]];
      paint(gesture.offset);
    };
    const onEnd = (event) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const current = gesture;
      gesture = null;
      if (!current.locked) {
        const tap =
          event.type === 'pointerup' &&
          event.timeStamp - current.start < TAP_MS &&
          Math.abs(event.clientX - current.x) < LOCK_DISTANCE &&
          Math.abs(event.clientY - current.y) < LOCK_DISTANCE &&
          !hasTextSelection();
        if (!tap) return;
        const zone =
          event.clientX < innerWidth * EDGE_ZONE
            ? 'prev'
            : event.clientX > innerWidth * (1 - EDGE_ZONE)
              ? 'next'
              : null;
        if (zone && allowed(zone)) commit(zone, 0);
        return;
      }
      const [firstAt, firstX] = current.samples[0];
      const [lastAt, lastX] = current.samples.at(-1);
      const velocity = lastAt > firstAt ? (lastX - firstX) / (lastAt - firstAt) : 0;
      const direction = current.offset < 0 ? 'next' : 'prev';
      const far = Math.abs(current.offset) > node.offsetWidth * COMMIT_RATIO;
      const flick =
        Math.abs(velocity) > COMMIT_VELOCITY &&
        Math.sign(velocity) === Math.sign(current.offset) &&
        Math.abs(current.offset) > MIN_FLICK;
      if (event.type === 'pointerup' && allowed(direction) && (far || flick)) {
        commit(direction, current.offset);
      } else springBack();
    };

    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onEnd);
    node.addEventListener('pointercancel', onEnd);
    return () => {
      window.clearTimeout(leaving);
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onEnd);
      node.removeEventListener('pointercancel', onEnd);
    };
  }, [ref, enabled]);
}
