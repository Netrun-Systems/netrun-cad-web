import { useCallback, useRef, useState, type ReactNode } from 'react';

export type ViewMode = 'cad-only' | 'split' | '3d-only';

export interface SplitViewProps {
  children: ReactNode;       // left panel (CAD canvas)
  rightPanel: ReactNode;     // right panel (3D viewport)
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

const MIN_PCT = 30;
const MAX_PCT = 70;

export default function SplitView({
  children,
  rightPanel,
  mode,
  onModeChange,
}: SplitViewProps) {
  const [leftPct, setLeftPct] = useState(60);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  /* ---- drag handlers ---- */

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    },
    [],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  /* ---- mode buttons ---- */

  const modeButton = (m: ViewMode, label: string) => (
    <button
      key={m}
      onClick={() => onModeChange(m)}
      className={`px-2 py-0.5 text-xs rounded transition-colors ${
        mode === m
          ? 'bg-gray-600 text-gray-100'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );

  /* ---- render ---- */

  return (
    <div className="flex flex-col h-full w-full bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700 bg-gray-900/80">
        {modeButton('cad-only', 'CAD')}
        {modeButton('split', 'Split')}
        {modeButton('3d-only', '3D')}
      </div>

      {/* Panels */}
      <div ref={containerRef} className="flex flex-1 min-h-0 relative">
        {mode === 'cad-only' && (
          <div className="w-full h-full">{children}</div>
        )}

        {mode === '3d-only' && (
          <div className="w-full h-full">{rightPanel}</div>
        )}

        {mode === 'split' && (
          <>
            {/* Left (CAD) */}
            <div
              className="h-full overflow-hidden"
              style={{ width: `${leftPct}%` }}
            >
              {children}
            </div>

            {/* Divider */}
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="w-1 flex-shrink-0 bg-gray-700 hover:bg-cyan-600 cursor-col-resize transition-colors"
            />

            {/* Right (3D) */}
            <div
              className="h-full overflow-hidden"
              style={{ width: `${100 - leftPct}%` }}
            >
              {rightPanel}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
