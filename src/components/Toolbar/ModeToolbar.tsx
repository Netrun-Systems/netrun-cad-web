import React from 'react';
import type { AppMode } from '../../engine/types';

interface ModeToolbarProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const MODES: { key: AppMode; label: string; shortcut: string; icon: string }[] = [
  { key: 'cad', label: 'CAD', shortcut: '1', icon: '📐' },
  { key: 'draw', label: 'Draw', shortcut: '2', icon: '✏️' },
  { key: 'color', label: 'Color', shortcut: '3', icon: '🎨' },
  { key: 'text', label: 'Text', shortcut: '4', icon: '𝐀' },
];

export const ModeToolbar: React.FC<ModeToolbarProps> = ({ mode, setMode }) => {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg px-2 py-1 z-20">
      <span className="text-cad-dim text-xs mr-2 font-medium tracking-wider">NETRUN CAD</span>
      {MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={`
            px-3 py-1.5 rounded-md text-sm font-medium transition-all
            ${mode === m.key
              ? 'bg-cad-highlight text-white shadow-lg shadow-cad-highlight/20'
              : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/30'
            }
          `}
          title={`${m.label} mode (${m.shortcut})`}
        >
          <span className="mr-1">{m.icon}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
};
