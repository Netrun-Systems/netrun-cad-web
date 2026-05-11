import { useCallback, useRef, useState } from 'react';
import type { CADTool, CADElement, CADLine, CADRectangle, CADCircle, CADDimension, CADPolyline, CADArc, CADEllipse, Point, GridSettings } from '../../engine/types';
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

  // For polyline tool: accumulate vertices across multiple clicks until
  // the user presses Enter/Esc. Lives in a ref so that mid-stream clicks
  // append without React state thrashing.
  const polylinePointsRef = useRef<Point[]>([]);

  // Arc tool — 3-click flow: start, end, hint-point-on-arc.
  const arcPhaseRef = useRef(0);
  const arcStartRef = useRef<Point | null>(null);
  const arcEndRef = useRef<Point | null>(null);

  // Advanced dimension tools share a small state machine. Phase tracks
  // how many clicks have been captured for the active dim flow.
  //   aligned/angular: 3 clicks
  //   radius/diameter: 2 clicks
  const dimAdvPhaseRef = useRef(0);
  const dimAdvA = useRef<Point | null>(null);
  const dimAdvB = useRef<Point | null>(null);

  /**
   * Build an arc from three points: start, end, and a hint point that
   * lies on the desired arc (determines the sweep direction). Returns
   * null when the points are collinear (no unique circle).
   */
  function arcFromThreePoints(p1: Point, p2: Point, p3: Point) {
    const m1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const m2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
    const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const d2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const pd1 = { x: -d1.y, y: d1.x }; // perpendicular bisector direction
    const pd2 = { x: -d2.y, y: d2.x };
    const denom = pd1.x * pd2.y - pd1.y * pd2.x;
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((m2.x - m1.x) * pd2.y - (m2.y - m1.y) * pd2.x) / denom;
    const center = { x: m1.x + t * pd1.x, y: m1.y + t * pd1.y };
    const radius = Math.hypot(p1.x - center.x, p1.y - center.y);
    if (!isFinite(radius) || radius < 1) return null;
    const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
    const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
    // Cross product of (p2-p1) × (p3-p1) tells us which side of the chord
    // the hint point sits on. Negative cross (canvas-Y-down) → hint is
    // visually above the chord → sweep CCW. Positive → CW. (Verified by
    // hand against several point configurations.)
    const cross = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    const counterclockwise = cross < 0;
    return { center, radius, startAngle, endAngle, counterclockwise };
  }

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

      // ─── Aligned dimension: 3 clicks (p1, p2, offset point) ────
      if (activeTool === 'dim-aligned') {
        const phase = dimAdvPhaseRef.current;
        if (phase === 0) {
          dimAdvA.current = point;
          dimAdvPhaseRef.current = 1;
          setPendingInput({ tool: 'dim-aligned', startPoint: point, phase: 1, prompt: 'Specify second measurement point:' });
          return;
        }
        if (phase === 1) {
          dimAdvB.current = point;
          dimAdvPhaseRef.current = 2;
          setPendingInput({ tool: 'dim-aligned', startPoint: dimAdvA.current!, secondPoint: point, phase: 2, prompt: 'Specify dimension line offset:' });
          return;
        }
        if (phase === 2) {
          const p1 = dimAdvA.current!;
          const p2 = dimAdvB.current!;
          const ang = angle(p1, p2);
          const perp = ang + Math.PI / 2;
          const dx = point.x - p1.x;
          const dy = point.y - p1.y;
          const offset = dx * Math.cos(perp) + dy * Math.sin(perp);
          const el: CADDimension = {
            type: 'dimension',
            dimStyle: 'aligned',
            id: genId('dim-aligned'),
            p1, p2,
            offset: Math.abs(offset) < 15 ? (offset < 0 ? -15 : 15) : offset,
            layerId: activeLayerId,
          };
          onElementCreated(el);
          dimAdvPhaseRef.current = 0;
          dimAdvA.current = null;
          dimAdvB.current = null;
          setPendingInput(null);
          onPreviewChange(null);
          return;
        }
        return;
      }

      // ─── Angular dimension: 3 clicks (ray-1 end, vertex, ray-2 end) ────
      if (activeTool === 'dim-angular') {
        const phase = dimAdvPhaseRef.current;
        if (phase === 0) {
          dimAdvA.current = point;
          dimAdvPhaseRef.current = 1;
          setPendingInput({ tool: 'dim-angular', startPoint: point, phase: 1, prompt: 'Specify the angle vertex:' });
          return;
        }
        if (phase === 1) {
          dimAdvB.current = point;
          dimAdvPhaseRef.current = 2;
          setPendingInput({ tool: 'dim-angular', startPoint: dimAdvA.current!, secondPoint: point, phase: 2, prompt: 'Specify the second ray endpoint:' });
          return;
        }
        if (phase === 2) {
          const a = dimAdvA.current!;
          const vtx = dimAdvB.current!;
          const b = point;
          const ra = Math.hypot(a.x - vtx.x, a.y - vtx.y);
          const rb = Math.hypot(b.x - vtx.x, b.y - vtx.y);
          const offset = Math.max(20, Math.min(ra, rb) * 0.7);
          const el: CADDimension = {
            type: 'dimension',
            dimStyle: 'angular',
            id: genId('dim-angular'),
            p1: a,
            p2: b,
            p3: vtx,
            offset,
            layerId: activeLayerId,
          };
          onElementCreated(el);
          dimAdvPhaseRef.current = 0;
          dimAdvA.current = null;
          dimAdvB.current = null;
          setPendingInput(null);
          onPreviewChange(null);
          return;
        }
        return;
      }

      // ─── Radius / Diameter dimension: 2 clicks (center, point on circle) ────
      if (activeTool === 'dim-radius' || activeTool === 'dim-diameter') {
        const phase = dimAdvPhaseRef.current;
        if (phase === 0) {
          dimAdvA.current = point;
          dimAdvPhaseRef.current = 1;
          setPendingInput({
            tool: activeTool,
            startPoint: point,
            phase: 1,
            prompt: activeTool === 'dim-radius' ? 'Specify a point on the circle (sets radius):' : 'Specify a point on the circle (sets diameter):',
          });
          return;
        }
        if (phase === 1) {
          const center = dimAdvA.current!;
          const el: CADDimension = {
            type: 'dimension',
            dimStyle: activeTool === 'dim-radius' ? 'radius' : 'diameter',
            id: genId(activeTool),
            p1: center,
            p2: point,
            offset: 20,
            layerId: activeLayerId,
          };
          onElementCreated(el);
          dimAdvPhaseRef.current = 0;
          dimAdvA.current = null;
          setPendingInput(null);
          onPreviewChange(null);
          return;
        }
        return;
      }

      // ─── Arc: 3-click flow (start, end, hint point on arc) ────
      if (activeTool === 'arc') {
        const phase = arcPhaseRef.current;
        if (phase === 0) {
          arcStartRef.current = point;
          arcPhaseRef.current = 1;
          setPendingInput({ tool: 'arc', startPoint: point, phase: 1, prompt: 'Specify arc end point:' });
          return;
        }
        if (phase === 1) {
          arcEndRef.current = point;
          arcPhaseRef.current = 2;
          setPendingInput({ tool: 'arc', startPoint: arcStartRef.current!, secondPoint: point, phase: 2, prompt: 'Specify a point on the arc (sets bulge direction):' });
          return;
        }
        if (phase === 2) {
          const built = arcFromThreePoints(arcStartRef.current!, arcEndRef.current!, point);
          if (built) {
            const el: CADArc = {
              type: 'arc',
              id: genId('arc'),
              center: built.center,
              radius: built.radius,
              startAngle: built.startAngle,
              endAngle: built.endAngle,
              counterclockwise: built.counterclockwise,
              layerId: activeLayerId,
              strokeColor,
              strokeWidth,
            };
            onElementCreated(el);
          }
          arcPhaseRef.current = 0;
          arcStartRef.current = null;
          arcEndRef.current = null;
          setPendingInput(null);
          onPreviewChange(null);
          return;
        }
        return;
      }

      // ─── Polyline: multi-click accumulation, finalized on Enter/Esc ────
      if (activeTool === 'polyline') {
        polylinePointsRef.current.push(point);
        const count = polylinePointsRef.current.length;
        setPendingInput({
          tool: 'polyline',
          startPoint: polylinePointsRef.current[0],
          mousePoint: point,
          phase: count,
          prompt:
            count === 1
              ? 'Specify next point or press Enter to finish:'
              : `Polyline: ${count} points — Enter to finish, Esc to cancel`,
        });
        return;
      }

      // ─── Standard tools (line, rectangle, circle, ellipse): click-based flow ────
      if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'ellipse') {
        if (!startPointRef.current) {
          // First click: set start point, enter awaiting mode
          startPointRef.current = point;

          const prompts: Record<string, string> = {
            line: 'Specify next point or type length:',
            rectangle: 'Specify opposite corner or type WxH:',
            circle: 'Specify radius point or type radius:',
            ellipse: 'Specify corner of ellipse bounding box:',
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
        case 'ellipse': {
          // Center+corner model — start is the center, end defines a
          // corner of the bounding rectangle, so rx = |dx|, ry = |dy|.
          const rx = Math.abs(dx);
          const ry = Math.abs(dy);
          if (rx < 1 || ry < 1) break;
          const el: CADEllipse = {
            type: 'ellipse',
            id: genId('ellipse'),
            center: start,
            rx,
            ry,
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

      // ─── Arc preview ──
      if (activeTool === 'arc') {
        const phase = arcPhaseRef.current;
        if (phase === 1 && arcStartRef.current) {
          // Phase 1: rubber-band line from start to cursor (chord preview)
          const preview: CADLine = {
            type: 'line',
            id: '__preview__',
            p1: arcStartRef.current,
            p2: point,
            layerId: activeLayerId,
            strokeColor: '#ff9800',
            strokeWidth: 1,
          };
          onPreviewChange(preview);
        }
        if (phase === 2 && arcStartRef.current && arcEndRef.current) {
          // Phase 2: full arc preview through start, end, and cursor
          const built = arcFromThreePoints(arcStartRef.current, arcEndRef.current, point);
          if (built) {
            const preview: CADArc = {
              type: 'arc',
              id: '__preview__',
              center: built.center,
              radius: built.radius,
              startAngle: built.startAngle,
              endAngle: built.endAngle,
              counterclockwise: built.counterclockwise,
              layerId: activeLayerId,
              strokeColor,
              strokeWidth,
            };
            onPreviewChange(preview);
          }
        }
        return;
      }

      // ─── Polyline preview: existing segments + live segment to cursor ──
      if (activeTool === 'polyline' && polylinePointsRef.current.length > 0) {
        const livePoints = [...polylinePointsRef.current, point];
        const preview: CADPolyline = {
          type: 'polyline',
          id: '__preview__',
          points: livePoints,
          layerId: activeLayerId,
          strokeColor,
          strokeWidth,
        };
        onPreviewChange(preview);
        setPendingInput((prev) => (prev ? { ...prev, mousePoint: point } : null));
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
        case 'ellipse': {
          const rx = Math.abs(point.x - start.x);
          const ry = Math.abs(point.y - start.y);
          if (rx < 1 || ry < 1) break;
          const preview: CADEllipse = {
            type: 'ellipse',
            id: '__preview__',
            center: start,
            rx,
            ry,
            layerId: activeLayerId,
            strokeColor,
            strokeWidth,
          };
          onPreviewChange(preview);
          break;
        }
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
    polylinePointsRef.current = [];
    arcPhaseRef.current = 0;
    arcStartRef.current = null;
    arcEndRef.current = null;
    dimAdvPhaseRef.current = 0;
    dimAdvA.current = null;
    dimAdvB.current = null;
    setPendingInput(null);
    onPreviewChange(null);
  }, [onPreviewChange]);

  /**
   * Commit the in-progress polyline. Called by CADCanvas on Enter (or any
   * other "finish" gesture). No-op if fewer than 2 points have been placed.
   */
  const commitPolyline = useCallback(() => {
    if (polylinePointsRef.current.length < 2) {
      polylinePointsRef.current = [];
      setPendingInput(null);
      onPreviewChange(null);
      return;
    }
    const el: CADPolyline = {
      type: 'polyline',
      id: genId('pline'),
      points: polylinePointsRef.current.slice(),
      layerId: activeLayerId,
      strokeColor,
      strokeWidth,
    };
    onElementCreated(el);
    polylinePointsRef.current = [];
    setPendingInput(null);
    onPreviewChange(null);
  }, [activeLayerId, strokeColor, strokeWidth, onElementCreated, onPreviewChange]);

  return {
    handleCADDown,
    handleCADMove,
    /** handleCADUp is no longer needed — tools use click-based flow */
    handleCADUp: useCallback(() => {}, []),
    pendingInput,
    handleNumericInput,
    cancelPending,
    commitPolyline,
  };
}
