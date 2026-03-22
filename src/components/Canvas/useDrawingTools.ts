import { useCallback, useRef } from 'react';
import type { StrokePoint, FreehandStroke, DrawBrush, ColorBrush } from '../../engine/types';

let nextId = 1;
function genId(prefix: string) {
  return `${prefix}-${nextId++}-${Date.now()}`;
}

interface UseDrawingToolsProps {
  activeLayerId: string;
  brush: DrawBrush | ColorBrush;
  color: string;
  size: number;
  opacity: number;
  onStrokeCreated: (stroke: FreehandStroke) => void;
  onLiveStroke: (points: StrokePoint[]) => void;
}

export function useDrawingTools({
  activeLayerId,
  brush,
  color,
  size,
  opacity,
  onStrokeCreated,
  onLiveStroke,
}: UseDrawingToolsProps) {
  const pointsRef = useRef<StrokePoint[]>([]);

  const handleDrawStart = useCallback(
    (point: StrokePoint) => {
      pointsRef.current = [point];
      onLiveStroke([point]);
    },
    [onLiveStroke]
  );

  const handleDrawMove = useCallback(
    (point: StrokePoint) => {
      pointsRef.current.push(point);
      onLiveStroke([...pointsRef.current]);
    },
    [onLiveStroke]
  );

  const handleDrawEnd = useCallback(() => {
    const points = pointsRef.current;
    if (points.length < 2) {
      pointsRef.current = [];
      onLiveStroke([]);
      return;
    }

    const stroke: FreehandStroke = {
      type: 'freehand',
      id: genId('stroke'),
      points: [...points],
      layerId: activeLayerId,
      color,
      size,
      opacity,
      brush,
    };

    onStrokeCreated(stroke);
    pointsRef.current = [];
    onLiveStroke([]);
  }, [activeLayerId, brush, color, size, opacity, onStrokeCreated, onLiveStroke]);

  return { handleDrawStart, handleDrawMove, handleDrawEnd };
}
