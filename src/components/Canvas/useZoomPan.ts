import { useCallback, useRef } from 'react';
import type { ViewState } from '../../engine/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

interface UseZoomPanProps {
  view: ViewState;
  setView: (view: ViewState) => void;
}

export function useZoomPan({ view, setView }: UseZoomPanProps) {
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const lastTouchDistRef = useRef<number | null>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom (trackpad) or ctrl+scroll
        const zoomFactor = 1 - e.deltaY * 0.01;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * zoomFactor));

        // Zoom toward cursor position
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newOffsetX = mouseX - ((mouseX - view.offsetX) * newZoom) / view.zoom;
        const newOffsetY = mouseY - ((mouseY - view.offsetY) * newZoom) / view.zoom;

        setView({ offsetX: newOffsetX, offsetY: newOffsetY, zoom: newZoom });
      } else {
        // Pan
        setView({
          offsetX: view.offsetX - e.deltaX,
          offsetY: view.offsetY - e.deltaY,
          zoom: view.zoom,
        });
      }
    },
    [view, setView]
  );

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      panStartRef.current = {
        x: clientX,
        y: clientY,
        offsetX: view.offsetX,
        offsetY: view.offsetY,
      };
    },
    [view]
  );

  const movePan = useCallback(
    (clientX: number, clientY: number) => {
      const start = panStartRef.current;
      if (!start) return;

      setView({
        offsetX: start.offsetX + (clientX - start.x),
        offsetY: start.offsetY + (clientY - start.y),
        zoom: view.zoom,
      });
    },
    [view.zoom, setView]
  );

  const endPan = useCallback(() => {
    panStartRef.current = null;
    lastTouchDistRef.current = null;
  }, []);

  const zoomTo = useCallback(
    (newZoom: number, centerX: number, centerY: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const newOffsetX = centerX - ((centerX - view.offsetX) * clamped) / view.zoom;
      const newOffsetY = centerY - ((centerY - view.offsetY) * clamped) / view.zoom;
      setView({ offsetX: newOffsetX, offsetY: newOffsetY, zoom: clamped });
    },
    [view, setView]
  );

  const resetView = useCallback(() => {
    setView({ offsetX: 0, offsetY: 0, zoom: 1 });
  }, [setView]);

  return {
    handleWheel,
    startPan,
    movePan,
    endPan,
    zoomTo,
    resetView,
    lastTouchDistRef,
  };
}
