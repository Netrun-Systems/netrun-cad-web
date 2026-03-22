import React from 'react';
import type { CADTool } from '../../engine/types';

interface CADToolbarProps {
  tool: CADTool;
  setTool: (tool: CADTool) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  gridEnabled: boolean;
  snapEnabled: boolean;
  toggleGrid: () => void;
  toggleSnap: () => void;
}

const CAD_TOOLS: { key: CADTool; label: string; shortcut: string }[] = [
  { key: 'select', label: 'Select (V)', shortcut: 'V' },
  { key: 'line', label: 'Line (L)', shortcut: 'L' },
  { key: 'rectangle', label: 'Rect (R)', shortcut: 'R' },
  { key: 'circle', label: 'Circle (C)', shortcut: 'C' },
  { key: 'dimension', label: 'Dim (D)', shortcut: 'D' },
];

const LINE_COLORS = ['#ffffff', '#88ccff', '#ff9800', '#4caf50', '#e94560', '#ffeb3b'];

export const CADToolbar: React.FC<CADToolbarProps> = ({
  tool,
  setTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  gridEnabled,
  snapEnabled,
  toggleGrid,
  toggleSnap,
}) => {
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg px-3 py-1.5 z-20">
      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        {CAD_TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              tool === t.key
                ? 'bg-cad-accent text-white'
                : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
            }`}
            title={t.label}
          >
            {t.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-cad-accent" />

      {/* Line color */}
      <div className="flex items-center gap-1">
        {LINE_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setStrokeColor(c)}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              strokeColor === c ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-cad-accent" />

      {/* Line width */}
      <div className="flex items-center gap-1">
        <span className="text-cad-dim text-xs">W:</span>
        <input
          type="range"
          min="1"
          max="8"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-16 h-1 accent-cad-highlight"
        />
        <span className="text-cad-text text-xs w-4">{strokeWidth}</span>
      </div>

      <div className="w-px h-6 bg-cad-accent" />

      {/* Grid/Snap toggles */}
      <button
        onClick={toggleGrid}
        className={`px-2 py-1 rounded text-xs ${
          gridEnabled ? 'bg-green-900/50 text-green-400' : 'text-cad-dim'
        }`}
      >
        Grid
      </button>
      <button
        onClick={toggleSnap}
        className={`px-2 py-1 rounded text-xs ${
          snapEnabled ? 'bg-blue-900/50 text-blue-400' : 'text-cad-dim'
        }`}
      >
        Snap
      </button>
    </div>
  );
};
