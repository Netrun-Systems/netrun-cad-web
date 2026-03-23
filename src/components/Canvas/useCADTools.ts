import { useCallback, useRef, useState } from 'react';
import type { CADTool, CADElement, CADLine, CADRectangle, CADCircle, CADDimension, Point, GridSettings } from '../../engine/types';
import { snapToGrid, distance, angle } from '../../engine/geometry';

let nextId = 1;
function genId(prefix: string) {
  return `${prefix}-${nextId++}-${Date.now()}`;
}

/**
 * State for awaiting numerical input from the command line.
 * When set, the command line shows a prompt and captures typed values.
 */
export interface PendingInput {
  tool: CADTool;
  startPoint: Point;
  /** For dimension tool: stores both measurement points before offset placement */
  secondPoint?: Point;
  /** Phase of multi-click tools (dimension uses 3 clicks) */
  phase: number;
  /** Last known mouse position for angle calculation */
  mousePoint?: Point;
  /** Prompt to display in command line */
  prompt: string;
}

/**
 * Parse user-typed dimension input.
 * Supports: "12" = 12 units, "12.5" = 12.5 units,
 * "12,6" or "12'6\"" = 12ft 6in (converted to feet as decimal)
 * "10x8" = width x height (for rectangle)
 */
export function parseNumericInput(input: string, unit: string): { value: number; width?: number; height?: number } | null {
  const trimmed = input.trim();

  // Rectangle: "10x8" or "10X8"
  const rectMatch = trimmed.match(/^([\d.]+)\s*[xX]\s*([\d.]+)$/);
  if (rectMatch) {
    const w = parseFloat(rectMatch[1]);
    const h = parseFloat(rectMatch[2]);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      return { value: 0, width: w, height: h };
    }
    return null;
  }

  // Feet-inches: "12'6\"" or "12'6" or "12'-6\""
  const feetInchMatch = trimmed.match(/^(\d+)['\u2032]\s*-?\s*(\d+(?:\.\d+)?)["\u2033]?$/);
  if (feetInchMatch) {
    const feet = parseInt(feetInchMatch[1], 10);
    const inches = parseFloat(feetInchMatch[2]);
    return { value: feet + inches / 12 };
  }

  // Comma notation for feet-inches: "12,6" = 12'6"
  if (unit === 'ft') {
    const commaMatch = trimmed.match(/^(\d+)\s*,\s*(\d+(?:\.\d+)?)$/);
    if (commaMatch) {
      const feet = parseInt(commaMatch[1], 10);
      const inches = parseFloat(commaMatch[2]);
      return { value: feet + inches / 12 };
    }
  }

  // Plain number: "12" or "12.5"
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0) {
    return { value: num };
  }

  return null;
}

interface UseCADToolsProps {
  activeTool: CADTool;
  activeLayerId: string;
  grid: GridSettings;
  strokeColor: string;
  strokeWidth: number;
  orthoMode: boolean;
  onElementCreated: (element: CADElement) => void;
  onPreviewChange: (preview: CADElement | null) => void;
}

export function useCADTools({
  activeTool,
  activeLayerId,
  grid,
  strokeColor,
  strokeWidth,
  orthoMode,
  onElementCreated,
  onPreviewChange,
}: UseCADToolsProps) {
  const startPointRef = useRef<Point | null>(null);
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);

  // For dimension tool: track clicks
  const dimPhaseRef = useRef(0);
  const dimP1Ref = useRef<Point | null>(null);
  const dimP2Ref = useRef<Point | null>(null);

  /** Apply ortho constraint: snap angle to nearest 90 degrees */
  const applyOrtho = useCallback((start: Point, end: Point): Point => {
    if (!orthoMode) return end;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    // Determine dominant axis
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: end.x, y: start.y };
    } else {
      return { x: start.x, y: end.y };
    }
  }, [orthoMode]);

  /** Calculate endpoint given start, angle direction (from mouse), and exact length in units */
  const calcEndpoint = useCallback((start: Point, mouseDir: Point, lengthUnits: number): Point => {
    let ang = angle(start, mouseDir);

    // If ortho mode, snap to nearest 90 degrees
    if (orthoMode) {
      const snap90 = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
      ang = snap90;
    }

    const lengthPx = lengthUnits * grid.pixelsPerUnit;
    return {
      x: start.x + Math.cos(ang) * lengthPx,
      y: start.y + Math.sin(ang) * lengthPx,
    };
  }, [orthoMode, grid.pixelsPerUnit]);

  const handleCADDown = useCallback(
    (rawPoint: Point) => {
      const point = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;

      // ─── Dimension tool: multi-click sequence ──────────────────────────
      if (activeTool === 'dimension') {
        const phase = dimPhaseRef.current;

        if (phase === 0) {
          // First click: first measurement point
          dimP1Ref.current = point;
          dimPhaseRef.current = 1;
          setPendingInput({
            tool: 'dimension',
            startPoint: point,
            phase: 1,
            prompt: 'Specify second point:',
          });
          return;
        }

        if (phase === 1) {
          // Second click: second measurement point
          dimP2Ref.current = point;
          dimPhaseRef.current = 2;
          setPendingInput({
            tool: 'dimension',
            startPoint: dimP1Ref.current!,
            secondPoint: point,
            phase: 2,
            prompt: 'Specify dimension line offset:',
          });
          return;
        }

        if (phase === 2) {
          // Third click: offset distance
          const p1 = dimP1Ref.current!;
          const p2 = dimP2Ref.current!;
          const ang = angle(p1, p2);
          const perpAngle = ang + Math.PI / 2;

          // Calculate signed offset from the line to the click point
          const dx = point.x - p1.x;
          const dy = point.y - p1.y;
          const offset = dx * Math.cos(perpAngle) + dy * Math.sin(perpAngle);

          const el: CADDimension = {
            type: 'dimension',
            id: genId('dim'),
            p1,
            p2,
            offset: Math.max(Math.abs(offset), 15), // minimum 15px offset
            layerId: activeLayerId,
          };

          // Determine sign: if click is on the "wrong" side, negate
          if (offset < 0) {
            el.offset = -el.offset;
          }

          onElementCreated(el);
          onPreviewChange(null);

          // Reset dimension state
          dimPhaseRef.current = 0;
          dimP1Ref.current = null;
          dimP2Ref.current = null;
          setPendingInput(null);
          return;
        }

        return;
      }

      // ─── Standard tools (line, rectangle, circle): click-based flow ────
      if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
        if (!startPointRef.current) {
          // First click: set start point, enter awaiting mode
          startPointRef.current = point;

          const prompts: Record<string, string> = {
            line: 'Specify next point or type length:',
            rectangle: 'Specify opposite corner or type WxH:',
            circle: 'Specify radius point or type radius:',
          };

          setPendingInput({
            tool: activeTool,
            startPoint: point,
            phase: 1,
            mousePoint: point,
            prompt: prompts[activeTool] || 'Specify next point:',
          });
          return;
        }

        // Second click: finalize with drawn position (existing behavior)
        const end = applyOrtho(startPointRef.current, point);
        finalizeElement(startPointRef.current, end);
        startPointRef.current = null;
        setPendingInput(null);
        onPreviewChange(null);
      }
    },
    [activeTool, grid, activeLayerId, strokeColor, strokeWidth, onElementCreated, onPreviewChange, applyOrtho]
  );

  /** Create the final element from two points */
  const finalizeElement = useCallback(
    (start: Point, end: Point) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;

      // Don't create zero-size elements
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

      switch (activeTool) {
        case 'line': {
          const el: CADLine = {
            type: 'line',
            id: genId('line'),
            p1: start,
            p2: end,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onElementCreated(el);
          break;
        }
        case 'rectangle': {
          const w = end.x - start.x;
          const h = end.y - start.y;
          const el: CADRectangle = {
            type: 'rectangle',
            id: genId('rect'),
            origin: { x: w < 0 ? end.x : start.x, y: h < 0 ? end.y : start.y },
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
    },
    [activeTool, activeLayerId, strokeColor, strokeWidth, onElementCreated]
  );

  const handleCADMove = useCallback(
    (rawPoint: Point) => {
      const point = grid.snap ? snapToGrid(rawPoint, grid) : rawPoint;

      // ─── Dimension tool preview ────────────────────────────────────────
      if (activeTool === 'dimension') {
        const phase = dimPhaseRef.current;

        if (phase === 1 && dimP1Ref.current) {
          // Preview line from p1 to cursor
          const preview: CADLine = {
            type: 'line',
            id: '__preview__',
            p1: dimP1Ref.current,
            p2: point,
            layerId: activeLayerId,
            strokeColor: '#ff9800',
            strokeWidth: 1,
          };
          onPreviewChange(preview);
        }

        if (phase === 2 && dimP1Ref.current && dimP2Ref.current) {
          // Preview full dimension with offset tracking cursor
          const p1 = dimP1Ref.current;
          const p2 = dimP2Ref.current;
          const ang = angle(p1, p2);
          const perpAngle = ang + Math.PI / 2;
          const dx = point.x - p1.x;
          const dy = point.y - p1.y;
          let offset = dx * Math.cos(perpAngle) + dy * Math.sin(perpAngle);
          if (Math.abs(offset) < 15) offset = offset >= 0 ? 15 : -15;

          const preview: CADDimension = {
            type: 'dimension',
            id: '__preview__',
            p1,
            p2,
            offset,
            layerId: activeLayerId,
          };
          onPreviewChange(preview);
        }

        return;
      }

      // ─── Standard tools: preview while mouse moves ─────────────────────
      const start = startPointRef.current;
      if (!start) return;

      const constrained = applyOrtho(start, point);

      // Update pending input with current mouse position
      setPendingInput((prev) =>
        prev ? { ...prev, mousePoint: constrained } : null
      );

      switch (activeTool) {
        case 'line': {
          const preview: CADLine = {
            type: 'line',
            id: '__preview__',
            p1: start,
            p2: constrained,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onPreviewChange(preview);
          break;
        }
        case 'rectangle': {
          const w = constrained.x - start.x;
          const h = constrained.y - start.y;
          const preview: CADRectangle = {
            type: 'rectangle',
            id: '__preview__',
            origin: { x: w < 0 ? constrained.x : start.x, y: h < 0 ? constrained.y : start.y },
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
          const dx = constrained.x - start.x;
          const dy = constrained.y - start.y;
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
    [activeTool, activeLayerId, strokeColor, strokeWidth, grid, onPreviewChange, applyOrtho]
  );

  /**
   * Handle numeric input from the command line while a tool is awaiting a value.
   * Returns true if the input was consumed, false if it should be treated as a command.
   */
  const handleNumericInput = useCallback(
    (input: string): boolean => {
      if (!pendingInput) return false;
      const parsed = parseNumericInput(input, grid.unit);
      if (!parsed) return false;

      const { tool, startPoint, mousePoint, phase } = pendingInput;

      // ─── Line: typed length ──────────────────────────────────────────
      if (tool === 'line' && phase === 1) {
        const dirPoint = mousePoint || { x: startPoint.x + 1, y: startPoint.y };
        const endpoint = calcEndpoint(startPoint, dirPoint, parsed.value);
        const el: CADLine = {
          type: 'line',
          id: genId('line'),
          p1: startPoint,
          p2: endpoint,
          layerId: activeLayerId,
          strokeColor,
          strokeWidth,
        };
        onElementCreated(el);
        startPointRef.current = null;
        setPendingInput(null);
        onPreviewChange(null);
        return true;
      }

      // ─── Rectangle: typed WxH ──────────────────────────────────────
      if (tool === 'rectangle' && phase === 1) {
        if (parsed.width !== undefined && parsed.height !== undefined) {
          // Explicit width x height
          const wPx = parsed.width * grid.pixelsPerUnit;
          const hPx = parsed.height * grid.pixelsPerUnit;

          // Determine direction from mouse position
          const dirX = (mousePoint && mousePoint.x >= startPoint.x) ? 1 : -1;
          const dirY = (mousePoint && mousePoint.y >= startPoint.y) ? 1 : -1;

          const origin = {
            x: dirX >= 0 ? startPoint.x : startPoint.x - wPx,
            y: dirY >= 0 ? startPoint.y : startPoint.y - hPx,
          };

          const el: CADRectangle = {
            type: 'rectangle',
            id: genId('rect'),
            origin,
            width: wPx,
            height: hPx,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onElementCreated(el);
        } else {
          // Single number: square
          const sizePx = parsed.value * grid.pixelsPerUnit;
          const el: CADRectangle = {
            type: 'rectangle',
            id: genId('rect'),
            origin: startPoint,
            width: sizePx,
            height: sizePx,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onElementCreated(el);
        }
        startPointRef.current = null;
        setPendingInput(null);
        onPreviewChange(null);
        return true;
      }

      // ─── Circle: typed radius ────────────────────────────────────────
      if (tool === 'circle' && phase === 1) {
        const radiusPx = parsed.value * grid.pixelsPerUnit;
        const el: CADCircle = {
          type: 'circle',
          id: genId('circle'),
          center: startPoint,
          radius: radiusPx,
          layerId: activeLayerId,
          strokeColor,
          strokeWidth,
        };
        onElementCreated(el);
        startPointRef.current = null;
        setPendingInput(null);
        onPreviewChange(null);
        return true;
      }

      // ─── Dimension: typed offset ────────────────────────────────────
      if (tool === 'dimension' && phase === 2 && pendingInput.secondPoint) {
        const offsetPx = parsed.value * grid.pixelsPerUnit;
        const el: CADDimension = {
          type: 'dimension',
          id: genId('dim'),
          p1: startPoint,
          p2: pendingInput.secondPoint,
          offset: offsetPx,
          layerId: activeLayerId,
        };
        onElementCreated(el);
        dimPhaseRef.current = 0;
        dimP1Ref.current = null;
        dimP2Ref.current = null;
        setPendingInput(null);
        onPreviewChange(null);
        return true;
      }

      return false;
    },
    [pendingInput, grid, activeLayerId, strokeColor, strokeWidth, calcEndpoint, onElementCreated, onPreviewChange]
  );

  /** Cancel current tool operation */
  const cancelPending = useCallback(() => {
    startPointRef.current = null;
    dimPhaseRef.current = 0;
    dimP1Ref.current = null;
    dimP2Ref.current = null;
    setPendingInput(null);
    onPreviewChange(null);
  }, [onPreviewChange]);

  return {
    handleCADDown,
    handleCADMove,
    /** handleCADUp is no longer needed — tools use click-based flow */
    handleCADUp: useCallback(() => {}, []),
    pendingInput,
    handleNumericInput,
    cancelPending,
  };
}
