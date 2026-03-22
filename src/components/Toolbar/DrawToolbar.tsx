import React from 'react';
import type { DrawBrush } from '../../engine/types';

interface DrawToolbarProps {
  brush: DrawBrush;
  setBrush: (brush: DrawBrush) => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
}

const DRAW_COLORS = [
  '#000000', '#333333', '#666666',
  '#1a237e', '#4a148c', '#b71c1c',
  '#1b5e20', '#e65100', '#795548',
];

const BRUSHES: { key: DrawBrush; label: string }[] = [
  { key: 'pen', label: 'Pen' },
  { key: 'pencil', label: 'Pencil' },
  { key: 'marker', label: 'Marker' },
];

export const DrawToolbar: React.FC<DrawToolbarProps> = ({
  brush,
  setBrush,
  color,
  setColor,
  size,
  setSize,
  opacity,
  setOpacity,
}) => {
  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg px-3 py-1.5 z-20">
      {/* Brush type */}
      <div className="flex items-center gap-1">
        {BRUSHES.map((b) => (
          <button
            key={b.key}
            onClick={() => setBrush(b.key)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              brush === b.key
                ? 'bg-cad-accent text-white'
                : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-cad-accent" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              color === c ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
          title="Custom color"
        />
      </div>

      <div className="w-px h-6 bg-cad-accent" />

      {/* Size */}
      <div className="flex items-center gap-1">
        <span className="text-cad-dim text-xs">Size:</span>
        <input
          type="range"
          min="1"
          max="24"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-16 h-1 accent-cad-highlight"
        />
        <span className="text-cad-text text-xs w-4">{size}</span>
      </div>

      <div className="w-px h-6 bg-cad-accent" />

      {/* Opacity */}
      <div className="flex items-center gap-1">
        <span className="text-cad-dim text-xs">Opacity:</span>
        <input
          type="range"
          min="10"
          max="100"
          value={opacity * 100}
          onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          className="w-16 h-1 accent-cad-highlight"
        />
        <span className="text-cad-text text-xs w-8">{(opacity * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};
