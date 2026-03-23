import React from 'react';
import type { AppMode, CADTool, GridSettings, Layer } from '../../engine/types';

export interface StatusBarProps {
  mode: AppMode;
  cadTool: CADTool;
  grid: GridSettings;
  layers: Layer[];
  activeLayerId: string;
  cursorX: number;
  cursorY: number;
  zoom: number;
  elementCount: number;
  orthoMode?: boolean;
  /** Context-aware prompt for the user (e.g. "Click to set first point") */
  prompt?: string;
  onClearAll: () => void;
  onResetView: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  mode,
  cadTool,
  grid,
  layers,
  activeLayerId,
  cursorX,
  cursorY,
  zoom,
  elementCount,
  onClearAll,
  onResetView,
  orthoMode,
  prompt,
}) => {
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  // Convert canvas units to feet for display
  const toFeet = (px: number) =>
    ((px / (grid.pixelsPerUnit || 48)) * (grid.unit === 'ft' ? 1 : 1)).toFixed(2);

  return (
    <div
      className="flex items-center justify-between px-4 py-1 text-xs w-full"
      style={{
        background: 'rgba(26, 26, 46, 0.95)',
        borderTop: '1px solid #2a2a4a',
        fontFamily: "'Consolas', 'Courier New', monospace",
        height: '28px',
      }}
    >
      {/* Left cluster — coordinates + mode/tool */}
      <div className="flex items-center gap-5">
        {/* Cursor coordinates */}
        <span style={{ color: '#9ca3af' }}>
          X <span style={{ color: '#ffffff' }}>{toFeet(cursorX)}</span>
          &nbsp;&nbsp;Y <span style={{ color: '#ffffff' }}>{toFeet(cursorY)}</span>
          &nbsp;<span style={{ color: '#555577' }}>{grid.unit.toUpperCase()}</span>
        </span>

        <span style={{ color: '#555577' }}>|</span>

        {/* Mode */}
        <span style={{ color: '#9ca3af' }}>
          MODE&nbsp;
          <span style={{ color: '#00d4aa', fontWeight: 600 }}>{mode.toUpperCase()}</span>
        </span>

        {/* CAD tool — only in cad mode */}
        {mode === 'cad' && (
          <>
            <span style={{ color: '#555577' }}>|</span>
            <span style={{ color: '#9ca3af' }}>
              TOOL&nbsp;
              <span style={{ color: '#ffffff' }}>{cadTool.toUpperCase()}</span>
            </span>
          </>
        )}

        <span style={{ color: '#555577' }}>|</span>

        {/* Active layer */}
        <span style={{ color: '#9ca3af' }}>
          LAYER&nbsp;
          <span
            style={{
              color: activeLayer?.color ?? '#ffffff',
              fontWeight: 600,
            }}
          >
            {activeLayer?.name ?? activeLayerId}
          </span>
        </span>

        <span style={{ color: '#555577' }}>|</span>

        {/* Grid status */}
        <span style={{ color: '#9ca3af' }}>
          GRID&nbsp;
          <span style={{ color: grid.enabled ? '#4ade80' : '#f87171' }}>
            {grid.enabled ? 'ON' : 'OFF'}
          </span>
        </span>

        <span style={{ color: '#555577' }}>|</span>

        {/* Snap status */}
        <span style={{ color: '#9ca3af' }}>
          SNAP&nbsp;
          <span style={{ color: grid.snap ? '#4ade80' : '#f87171' }}>
            {grid.snap ? 'ON' : 'OFF'}
          </span>
        </span>

        <span style={{ color: '#555577' }}>|</span>

        {/* Ortho status */}
        <span style={{ color: '#9ca3af' }}>
          ORTHO&nbsp;
          <span style={{ color: orthoMode ? '#4ade80' : '#f87171' }}>
            {orthoMode ? 'ON' : 'OFF'}
          </span>
        </span>

        {/* Context-aware prompt */}
        {prompt && (
          <>
            <span style={{ color: '#555577' }}>|</span>
            <span style={{ color: '#ff9800', fontStyle: 'italic' }}>
              {prompt}
            </span>
          </>
        )}
      </div>

      {/* Right cluster — zoom + element count + actions */}
      <div className="flex items-center gap-4">
        <span style={{ color: '#9ca3af' }}>
          ZOOM&nbsp;<span style={{ color: '#ffffff' }}>{(zoom * 100).toFixed(0)}%</span>
        </span>

        <span style={{ color: '#9ca3af' }}>
          EL&nbsp;<span style={{ color: '#ffffff' }}>{elementCount}</span>
        </span>

        <button
          onClick={onResetView}
          className="text-xs transition-colors"
          style={{ color: '#9ca3af' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ffffff')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#9ca3af')}
        >
          Reset View
        </button>

        <span style={{ color: '#555577' }}>|</span>

        <button
          onClick={onClearAll}
          className="text-xs transition-colors"
          style={{ color: '#f87171' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#fca5a5')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#f87171')}
        >
          Clear All
        </button>
      </div>
    </div>
  );
};
