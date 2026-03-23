/**
 * AlignmentEditor — floating toolbar for manually adjusting the scan-to-GIS alignment.
 *
 * Appears as a modal overlay mode when alignment needs correction.
 * Supports touch gestures on iPad (drag to move, pinch to scale).
 *
 * While active:
 *  - Single-finger drag moves the scan layer
 *  - Pinch (two-finger) scales the scan layer
 *  - Two-finger rotate rotates the scan layer
 *  - R key rotates by 90° increments
 *  - Accept locks the alignment
 *  - Reset reverts to auto-aligned state
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { AlignmentResult } from '../../engine/scan-gis-alignment';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AlignmentEditorProps {
  /** Current alignment state (auto-computed or user-modified) */
  alignment: AlignmentResult;
  /** Called when user accepts the alignment */
  onAccept: (alignment: AlignmentResult) => void;
  /** Called when user resets to the auto-computed alignment */
  onReset: () => void;
  /** Called when alignment is updated (for live preview) */
  onChange: (alignment: AlignmentResult) => void;
  /** The canvas element (to capture pointer events without blocking canvas pan) */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// ── Active sub-mode ────────────────────────────────────────────────────────────

type AdjustMode = 'move' | 'scale' | 'rotate';

// ── Component ─────────────────────────────────────────────────────────────────

export const AlignmentEditor: React.FC<AlignmentEditorProps> = ({
  alignment,
  onAccept,
  onReset,
  onChange,
  canvasRef,
}) => {
  const [adjustMode, setAdjustMode] = useState<AdjustMode>('move');

  // Drag state
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  // Pinch state
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  // Two-finger rotate state
  const rotateRef = useRef<{ angle: number; rotation: number } | null>(null);
  // Active pointers
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // ── Keyboard shortcut (R = rotate 90°) ──────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onChange({
          ...alignment,
          rotation: (alignment.rotation + 90) % 360,
          method: 'user-adjusted (R key rotate)',
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [alignment, onChange]);

  // ── Pointer event handlers on the canvas ────────────────────────────────────

  const getTwoFingerDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(b.x - a.x, b.y - a.y);

  const getTwoFingerAngle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);

  const handleCanvasPointerDown = useCallback(
    (e: PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 1 && adjustMode === 'move') {
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          offsetX: alignment.offsetX,
          offsetY: alignment.offsetY,
        };
      } else if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        const dist = getTwoFingerDist(pts[0], pts[1]);
        const angle = getTwoFingerAngle(pts[0], pts[1]);

        if (adjustMode === 'scale') {
          pinchRef.current = { dist, scale: alignment.scale };
        } else if (adjustMode === 'rotate') {
          rotateRef.current = { angle, rotation: alignment.rotation };
        }
      }
    },
    [alignment, adjustMode]
  );

  const handleCanvasPointerMove = useCallback(
    (e: PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 1 && dragStartRef.current && adjustMode === 'move') {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        onChange({
          ...alignment,
          offsetX: dragStartRef.current.offsetX + dx,
          offsetY: dragStartRef.current.offsetY + dy,
          method: 'user-adjusted (drag)',
        });
      } else if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());

        if (adjustMode === 'scale' && pinchRef.current) {
          const dist = getTwoFingerDist(pts[0], pts[1]);
          const scaleRatio = dist / pinchRef.current.dist;
          onChange({
            ...alignment,
            scale: Math.max(0.01, pinchRef.current.scale * scaleRatio),
            method: 'user-adjusted (pinch)',
          });
        } else if (adjustMode === 'rotate' && rotateRef.current) {
          const angle = getTwoFingerAngle(pts[0], pts[1]);
          const deltaAngle = angle - rotateRef.current.angle;
          onChange({
            ...alignment,
            rotation: (rotateRef.current.rotation + deltaAngle + 360) % 360,
            method: 'user-adjusted (two-finger rotate)',
          });
        }
      }
    },
    [alignment, adjustMode, onChange]
  );

  const handleCanvasPointerUp = useCallback((e: PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 1) {
      dragStartRef.current = null;
    }
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
      rotateRef.current = null;
    }
  }, []);

  // Attach pointer events to the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handleCanvasPointerDown);
    canvas.addEventListener('pointermove', handleCanvasPointerMove);
    canvas.addEventListener('pointerup', handleCanvasPointerUp);
    canvas.addEventListener('pointercancel', handleCanvasPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
      canvas.removeEventListener('pointermove', handleCanvasPointerMove);
      canvas.removeEventListener('pointerup', handleCanvasPointerUp);
      canvas.removeEventListener('pointercancel', handleCanvasPointerUp);
    };
  }, [canvasRef, handleCanvasPointerDown, handleCanvasPointerMove, handleCanvasPointerUp]);

  // ── Toolbar buttons ───────────────────────────────────────────────────────────

  const modeBtn = (mode: AdjustMode, label: string, title: string) => (
    <button
      key={mode}
      onClick={() => setAdjustMode(mode)}
      title={title}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        adjustMode === mode
          ? 'bg-amber-500 text-black'
          : 'bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Semi-transparent overlay hint that signals "alignment mode" */}
      <div
        className="absolute inset-0 z-40 pointer-events-none"
        style={{ outline: '3px dashed rgba(251,191,36,0.5)' }}
      />

      {/* Floating toolbar */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-cad-surface/95 backdrop-blur-sm border border-amber-500/60 rounded-xl px-4 py-3 shadow-2xl flex flex-col gap-3 min-w-[360px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-amber-400 font-semibold text-sm">Scan Alignment Mode</span>
            <span className="text-cad-dim text-xs ml-2">
              Confidence: {Math.round(alignment.confidence * 100)}%
            </span>
          </div>
          <span className="text-cad-dim/60 text-[10px]">{alignment.method}</span>
        </div>

        {/* Mode buttons */}
        <div className="flex items-center gap-2">
          {modeBtn('move', 'Move', 'Drag scan to reposition')}
          {modeBtn('scale', 'Scale', 'Pinch two fingers to resize')}
          {modeBtn('rotate', 'Rotate', 'Two-finger rotate, or R key for 90°')}
        </div>

        {/* Mode hint */}
        <div className="text-cad-dim text-[10px]">
          {adjustMode === 'move' && 'Drag on canvas to move the scan layer.'}
          {adjustMode === 'scale' && 'Pinch two fingers on canvas to scale. Current scale: ×' + alignment.scale.toFixed(3)}
          {adjustMode === 'rotate' && 'Two-finger rotate on canvas, or press R to rotate 90°. Current: ' + alignment.rotation.toFixed(1) + '°'}
        </div>

        {/* Accept / Reset */}
        <div className="flex gap-2 pt-1 border-t border-cad-accent/50">
          <button
            onClick={() => onAccept(alignment)}
            className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-medium transition-colors"
          >
            Accept Alignment
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text rounded text-xs transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
};
