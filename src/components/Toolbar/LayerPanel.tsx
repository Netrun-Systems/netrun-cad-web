import React from 'react';
import type { Layer } from '../../engine/types';

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onSetOpacity: (id: string, opacity: number) => void;
  onClose: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onSetOpacity,
  onClose,
}) => {
  const sorted = [...layers].sort((a, b) => b.order - a.order);

  return (
    <div className="absolute top-12 right-2 w-56 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">Layers</span>
        <button
          onClick={onClose}
          className="text-cad-dim hover:text-cad-text text-xs"
        >
          Close
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {sorted.map((layer) => (
          <div
            key={layer.id}
            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
              activeLayerId === layer.id
                ? 'bg-cad-accent/30'
                : 'hover:bg-cad-accent/10'
            }`}
            onClick={() => onSelectLayer(layer.id)}
          >
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: layer.color }}
            />

            {/* Name */}
            <span className="text-cad-text text-xs flex-1 truncate">
              {layer.name}
            </span>

            {/* Visibility */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(layer.id);
              }}
              className={`text-xs px-1 ${
                layer.visible ? 'text-green-400' : 'text-red-400'
              }`}
              title={layer.visible ? 'Hide' : 'Show'}
            >
              {layer.visible ? 'V' : 'H'}
            </button>

            {/* Lock */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(layer.id);
              }}
              className={`text-xs px-1 ${
                layer.locked ? 'text-yellow-400' : 'text-cad-dim'
              }`}
              title={layer.locked ? 'Unlock' : 'Lock'}
            >
              {layer.locked ? 'L' : 'U'}
            </button>

            {/* Opacity slider (small) */}
            <input
              type="range"
              min="0"
              max="100"
              value={layer.opacity * 100}
              onChange={(e) => {
                e.stopPropagation();
                onSetOpacity(layer.id, Number(e.target.value) / 100);
              }}
              className="w-10 h-1 accent-cad-highlight"
              title={`Opacity: ${(layer.opacity * 100).toFixed(0)}%`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
