/**
 * InteriorPanel — a panel for placing interior architectural symbols on the canvas.
 *
 * Similar to PlantBrowser but for interior layout symbols (fixtures, furniture, doors).
 * Symbols are organized by room category. Click a symbol, then click the canvas to place.
 * Press R while placing to rotate 90°.
 */

import React, { useState, useEffect, useRef } from 'react';
import { INTERIOR_SYMBOLS, CATEGORY_LABELS, groupByCategory } from '../../data/interior-symbols';
import type { InteriorSymbolDef } from '../../data/interior-symbols';
import { renderInteriorSymbol } from '../../engine/interior-renderer';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface PlacingSymbol {
  key: string;
  def: InteriorSymbolDef;
  rotation: number;
}

interface InteriorPanelProps {
  /** Currently selected symbol being placed (null if none) */
  placingSymbol: PlacingSymbol | null;
  /** Called when user selects a symbol to place */
  onSelectSymbol: (symbol: PlacingSymbol | null) => void;
  /** Called to close the panel */
  onClose: () => void;
}

// ── Symbol preview canvas ─────────────────────────────────────────────────────

interface SymbolPreviewProps {
  symbolKey: string;
  def: InteriorSymbolDef;
  size?: number;
}

const SymbolPreview: React.FC<SymbolPreviewProps> = ({ def, size = 40 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx.clearRect(0, 0, size * dpr, size * dpr);
    ctx.scale(dpr, dpr);

    // Center and scale the symbol to fit within the preview canvas
    const padding = 4;
    const availW = size - padding * 2;
    const availH = size - padding * 2;
    const scaleX = availW / Math.max(def.width, 0.1);
    const scaleY = availH / Math.max(def.depth, 0.1);
    const scale = Math.min(scaleX, scaleY);

    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, scale);

    renderInteriorSymbol(ctx, def.shape, def.width, def.depth, '#8B7355', 0);
  }, [def, size]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded border border-cad-accent/30 bg-cad-bg/50 shrink-0"
      style={{ width: size, height: size }}
    />
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

export const InteriorPanel: React.FC<InteriorPanelProps> = ({
  placingSymbol,
  onSelectSymbol,
  onClose,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['bathroom', 'kitchen', 'living', 'bedroom', 'architectural', 'utility'])
  );

  const groups = groupByCategory();

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleSelectSymbol = (key: string, def: InteriorSymbolDef) => {
    if (placingSymbol?.key === key) {
      // Deselect
      onSelectSymbol(null);
    } else {
      onSelectSymbol({ key, def, rotation: 0 });
    }
  };

  // R key rotates selected symbol
  useEffect(() => {
    if (!placingSymbol) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onSelectSymbol({
          ...placingSymbol,
          rotation: (placingSymbol.rotation + 90) % 360,
        });
      }
      if (e.key === 'Escape') {
        onSelectSymbol(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [placingSymbol, onSelectSymbol]);

  return (
    <div className="absolute top-12 right-2 w-72 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">Interior Symbols</span>
        <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-xs">
          Close
        </button>
      </div>

      {/* Placing status */}
      {placingSymbol && (
        <div className="px-3 py-2 bg-amber-900/30 border-b border-amber-500/30 flex items-center justify-between">
          <div>
            <span className="text-amber-300 text-xs font-medium">
              Placing: {INTERIOR_SYMBOLS[placingSymbol.key]?.label}
            </span>
            <span className="text-amber-400/70 text-[10px] ml-2">
              {placingSymbol.rotation}° — R to rotate
            </span>
          </div>
          <button
            onClick={() => onSelectSymbol(null)}
            className="text-cad-dim hover:text-cad-text text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Symbol list */}
      <div className="overflow-y-auto flex-1">
        {Array.from(groups.entries()).map(([category, items]) => (
          <div key={category}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-cad-accent/10 hover:bg-cad-accent/20 transition-colors"
            >
              <span className="text-cad-dim text-[10px] uppercase tracking-wider font-medium">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </span>
              <span className="text-cad-dim/50 text-[10px]">
                {expandedCategories.has(category) ? '▲' : '▼'}
              </span>
            </button>

            {/* Symbols in category */}
            {expandedCategories.has(category) && (
              <div>
                {items.map(({ key, def }) => (
                  <button
                    key={key}
                    onClick={() => handleSelectSymbol(key, def)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                      placingSymbol?.key === key
                        ? 'bg-amber-900/30 border-l-2 border-amber-400'
                        : 'hover:bg-cad-accent/10'
                    }`}
                  >
                    <SymbolPreview symbolKey={key} def={def} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-cad-text text-xs font-medium truncate">
                        {def.label}
                      </div>
                      <div className="text-cad-dim text-[10px]">
                        {def.width}' × {def.depth}'
                      </div>
                    </div>
                    {placingSymbol?.key === key && (
                      <span className="text-amber-400 text-[10px]">placing</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 border-t border-cad-accent text-cad-dim text-[10px] text-center">
        Click symbol → click canvas to place · R to rotate
      </div>
    </div>
  );
};
