import { useCallback, useRef } from 'react';
import type { CADTool, CADElement, CADLine, CADRectangle, CADCircle, Point, GridSettings } from '../../engine/types';
import { snapToGrid } from '../../engine/geometry';

let nextId = 1;
function genId(prefix: string) {
  return `${prefix}-${nextId++}-${Date.now()}`;
}

interface UseCADToolsProps {
  activeTool: CADTool;
  activeLayerId: string;
  grid: GridSettings;
  strokeColor: string;
  strokeWidth: number;
  onElementCreated: (element: CADElement) => void;
  onPreviewChange: (preview: CADElement | null) => void;
}

export function useCADTools({
  activeTool,
  activeLayerId,
  grid,
  strokeColor,
  strokeWidth,
  onElementCreated,
  onPreviewChange,
}: UseCADToolsProps) {
  const startPointRef = useRef<Point | null>(null);

  const handleCADDown = useCallback(
    (rawPoint: Point) => {
      const point = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;
      startPointRef.current = point;
    },
    [grid]
  );

  const handleCADMove = useCallback(
    (rawPoint: Point) => {
      const start = startPointRef.current;
      if (!start) return;

      const point = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;

      switch (activeTool) {
        case 'line': {
          const preview: CADLine = {
            type: 'line',
            id: '__preview__',
            p1: start,
            p2: point,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onPreviewChange(preview);
          break;
        }
        case 'rectangle': {
          const w = point.x - start.x;
          const h = point.y - start.y;
          const preview: CADRectangle = {
            type: 'rectangle',
            id: '__preview__',
            origin: { x: w < 0 ? point.x : start.x, y: h < 0 ? point.y : start.y },
            width: Math.abs(w),
            height: Math.abs(h),
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onPreviewChange(preview);
          break;
        }
        case 'circle': {
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          const radius = Math.sqrt(dx * dx + dy * dy);
          const preview: CADCircle = {
            type: 'circle',
            id: '__preview__',
            center: start,
            radius,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onPreviewChange(preview);
          break;
        }
      }
    },
    [activeTool, activeLayerId, strokeColor, strokeWidth, grid, onPreviewChange]
  );

  const handleCADUp = useCallback(
    (rawPoint: Point) => {
      const start = startPointRef.current;
      if (!start) return;

      const point = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;
      onPreviewChange(null);

      // Don't create zero-size elements
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        startPointRef.current = null;
        return;
      }

      switch (activeTool) {
        case 'line': {
          const el: CADLine = {
            type: 'line',
            id: genId('line'),
            p1: start,
            p2: point,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onElementCreated(el);
          break;
        }
        case 'rectangle': {
          const w = point.x - start.x;
          const h = point.y - start.y;
          const el: CADRectangle = {
            type: 'rectangle',
            id: genId('rect'),
            origin: { x: w < 0 ? point.x : start.x, y: h < 0 ? point.y : start.y },
            width: Math.abs(w),
            height: Math.abs(h),
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onElementCreated(el);
          break;
        }
        case 'circle': {
          const radius = Math.sqrt(dx * dx + dy * dy);
          const el: CADCircle = {
            type: 'circle',
            id: genId('circle'),
            center: start,
            radius,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onElementCreated(el);
          break;
        }
      }

      startPointRef.current = null;
    },
    [activeTool, activeLayerId, strokeColor, strokeWidth, grid, onPreviewChange, onElementCreated]
  );

  return { handleCADDown, handleCADMove, handleCADUp };
}
