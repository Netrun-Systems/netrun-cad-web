import { useCallback, useRef } from 'react';
import type { StrokePoint } from '../../engine/types';

export interface PointerState {
  isDown: boolean;
  points: StrokePoint[];
  pointerId: number | null;
}

interface UsePointerEventsProps {
  onStrokeStart: (point: StrokePoint) => void;
  onStrokeMove: (point: StrokePoint) => void;
  onStrokeEnd: () => void;
  getCanvasPoint: (e: PointerEvent) => StrokePoint;
}

export function usePointerEvents({
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  getCanvasPoint,
}: UsePointerEventsProps) {
  const stateRef = useRef<PointerState>({
    isDown: false,
    points: [],
    pointerId: null,
  });

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      // Only track one pointer for drawing
      if (stateRef.current.isDown) return;

      const canvas = e.target as HTMLCanvasElement;
      canvas.setPointerCapture(e.pointerId);

      stateRef.current.isDown = true;
      stateRef.current.pointerId = e.pointerId;
      stateRef.current.points = [];

      const point = getCanvasPoint(e);
      stateRef.current.points.push(point);
      onStrokeStart(point);
    },
    [onStrokeStart, getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!stateRef.current.isDown || e.pointerId !== stateRef.current.pointerId) return;

      // Coalesced events for smoother strokes (Apple Pencil sends many events)
      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ce of events) {
        const point = getCanvasPoint(ce);
        stateRef.current.points.push(point);
        onStrokeMove(point);
      }
    },
    [onStrokeMove, getCanvasPoint]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (e.pointerId !== stateRef.current.pointerId) return;

      stateRef.current.isDown = false;
      stateRef.current.pointerId = null;
      onStrokeEnd();
    },
    [onStrokeEnd]
  );

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    stateRef,
  };
}
