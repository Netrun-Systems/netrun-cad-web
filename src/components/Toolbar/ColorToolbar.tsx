import React from 'react';
import type { ColorBrush } from '../../engine/types';
import { COLOR_PALETTE } from '../Canvas/useColorTools';

interface ColorToolbarProps {
  brush: ColorBrush;
  setBrush: (brush: ColorBrush) => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
}

const BRUSHES: { key: ColorBrush; label: string }[] = [
  { key: 'watercolor', label: 'Watercolor' },
  { key: 'marker', label: 'Marker' },
  { key: 'fill', label: 'Fill' },
];

export const ColorToolbar: React.FC<ColorToolbarProps> = ({
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
    <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg px-3 py-1.5 z-20 max-w-[95vw] overflow-x-auto">
      {/* Brush type */}
      <div className="flex items-center gap-1 shrink-0">
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

      <div className="w-px h-6 bg-cad-accent shrink-0" />

      {/* Color palette */}
      <div className="flex items-center gap-0.5 flex-wrap max-w-[280px]">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-4 h-4 rounded-sm border transition-transform ${
              color === c ? 'border-white scale-125 z-10' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
          title="Custom color"
        />
      </div>

      <div className="w-px h-6 bg-cad-accent shrink-0" />

      {/* Size */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-cad-dim text-xs">Size:</span>
        <input
          type="range"
          min="4"
          max="60"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-14 h-1 accent-cad-highlight"
        />
        <span className="text-cad-text text-xs w-4">{size}</span>
      </div>

      <div className="w-px h-6 bg-cad-accent shrink-0" />

      {/* Opacity */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-cad-dim text-xs">Opacity:</span>
        <input
          type="range"
          min="5"
          max="100"
          value={opacity * 100}
          onChange={(e) => setOpacity(Number(e.target.value) / 100)}
          className="w-14 h-1 accent-cad-highlight"
        />
        <span className="text-cad-text text-xs w-8">{(opacity * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};
