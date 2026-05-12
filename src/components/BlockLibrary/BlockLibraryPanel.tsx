import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_CATALOG, type BlockDefinition } from '../../data/blocks';
import { loadCustomBlocks, deleteCustomBlock, type CustomBlockDefinition } from '../../data/custom-blocks';

interface BlockLibraryPanelProps {
  /** The currently armed block-to-place id (set when the user clicks one). */
  pendingBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<BlockDefinition['category'], string> = {
  furniture: 'Furniture',
  structural: 'Structural',
  hardscape: 'Hardscape',
  lighting: 'Lighting',
};

const CATEGORY_ORDER: BlockDefinition['category'][] = ['furniture', 'structural', 'hardscape', 'lighting'];

/* ------------------------------------------------------------------ */
/*  Tiny canvas thumbnail of a block                                    */
/* ------------------------------------------------------------------ */

function BlockThumbnail({ block, size = 56 }: { block: BlockDefinition; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Fit the block bbox into the thumbnail with a small margin
    const margin = 4;
    const target = size - margin * 2;
    const fit = Math.min(target / Math.max(block.bbox.width, 1), target / Math.max(block.bbox.height, 1));

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(fit, fit);

    for (const child of block.elements) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      switch (child.type) {
        case 'rectangle':
          ctx.strokeStyle = child.strokeColor;
          ctx.lineWidth = (child.strokeWidth ?? 1) / fit;
          if (child.fillColor) {
            ctx.fillStyle = child.fillColor;
            ctx.fillRect(child.origin.x, child.origin.y, child.width, child.height);
          }
          ctx.strokeRect(child.origin.x, child.origin.y, child.width, child.height);
          break;
        case 'circle':
          ctx.strokeStyle = child.strokeColor;
          ctx.lineWidth = (child.strokeWidth ?? 1) / fit;
          ctx.beginPath();
          ctx.arc(child.center.x, child.center.y, child.radius, 0, Math.PI * 2);
          if (child.fillColor) {
            ctx.fillStyle = child.fillColor;
            ctx.fill();
          }
          ctx.stroke();
          break;
        case 'line':
          ctx.strokeStyle = child.strokeColor;
          ctx.lineWidth = (child.strokeWidth ?? 1) / fit;
          ctx.beginPath();
          ctx.moveTo(child.p1.x, child.p1.y);
          ctx.lineTo(child.p2.x, child.p2.y);
          ctx.stroke();
          break;
        case 'polyline':
          if (child.points.length < 2) break;
          ctx.strokeStyle = child.strokeColor;
          ctx.lineWidth = (child.strokeWidth ?? 1) / fit;
          ctx.beginPath();
          ctx.moveTo(child.points[0].x, child.points[0].y);
          for (let i = 1; i < child.points.length; i++) ctx.lineTo(child.points[i].x, child.points[i].y);
          if (child.closed) ctx.closePath();
          ctx.stroke();
          break;
      }
    }
    ctx.restore();
  }, [block, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="bg-cad-bg rounded border border-cad-accent/40"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Panel                                                                */
/* ------------------------------------------------------------------ */

export const BlockLibraryPanel: React.FC<BlockLibraryPanelProps> = ({
  pendingBlockId,
  onSelectBlock,
  onClose,
}) => {
  const [filter, setFilter] = useState('');
  const [custom, setCustom] = useState<CustomBlockDefinition[]>(() => loadCustomBlocks());

  // Reload custom blocks when storage changes (the saver dispatches a
  // custom event so we don't poll).
  useEffect(() => {
    const reload = () => setCustom(loadCustomBlocks());
    window.addEventListener('netrun-cad-custom-blocks-changed', reload);
    return () => window.removeEventListener('netrun-cad-custom-blocks-changed', reload);
  }, []);

  const handleDeleteCustom = (blockId: string, name: string) => {
    if (!window.confirm(`Delete custom block "${name}"? Existing instances of this block in your drawings will render as a red X marker.`)) {
      return;
    }
    deleteCustomBlock(blockId);
  };

  const grouped = useMemo(() => {
    const matchedBuiltin = BLOCK_CATALOG.filter(
      (b) => !filter || b.name.toLowerCase().includes(filter.toLowerCase()) || b.id.includes(filter.toLowerCase()),
    );
    const matchedCustom = custom.filter(
      (b) => !filter || b.name.toLowerCase().includes(filter.toLowerCase()) || b.id.includes(filter.toLowerCase()),
    );
    const out: Record<BlockDefinition['category'], BlockDefinition[]> = {
      furniture: [], structural: [], hardscape: [], lighting: [],
    };
    for (const b of matchedBuiltin) out[b.category].push(b);
    for (const b of matchedCustom) out[b.category].push(b);
    return { byCategory: out, customMatches: matchedCustom };
  }, [filter, custom]);

  return (
    <div className="absolute top-12 right-2 w-72 max-h-[80vh] flex flex-col bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">Block Library</span>
        <button
          onClick={onClose}
          className="text-cad-dim hover:text-cad-text text-xs"
        >
          Close
        </button>
      </div>

      {/* Filter */}
      <div className="px-3 py-2 border-b border-cad-accent/40">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter blocks…"
          className="w-full bg-cad-bg text-cad-text text-xs px-2 py-1 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none"
        />
      </div>

      {/* Place-mode hint */}
      {pendingBlockId && (
        <div className="px-3 py-1.5 text-xs text-cad-highlight border-b border-cad-accent/40 bg-cad-highlight/10">
          Click on the canvas to place. Esc to cancel.
        </div>
      )}

      {/* Block grid by category — custom blocks marked with a delete affordance */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.byCategory[cat];
          if (items.length === 0) return null;
          const customCountInCat = items.filter((b) => 'custom' in b).length;
          return (
            <div key={cat}>
              <div className="text-cad-dim text-[10px] uppercase tracking-wider px-1 pb-1 flex justify-between">
                <span>{CATEGORY_LABEL[cat]}</span>
                {customCountInCat > 0 && (
                  <span className="text-cad-highlight/80">{customCountInCat} custom</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {items.map((block) => {
                  const isPending = pendingBlockId === block.id;
                  const isCustom = 'custom' in block;
                  return (
                    <div key={block.id} className="relative group">
                      <button
                        onClick={() => onSelectBlock(isPending ? null : block.id)}
                        title={`${block.name}${block.description ? ' — ' + block.description : ''}${isCustom ? ' (custom)' : ''}`}
                        className={`w-full flex flex-col items-center gap-1 p-1.5 rounded transition-colors ${
                          isPending
                            ? 'bg-cad-highlight/20 ring-2 ring-cad-highlight'
                            : 'hover:bg-cad-accent/30'
                        }`}
                      >
                        <BlockThumbnail block={block} />
                        <span className={`text-[10px] text-center leading-tight ${isCustom ? 'text-cad-highlight' : 'text-cad-text'}`}>
                          {block.name}
                        </span>
                      </button>
                      {isCustom && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCustom(block.id, block.name); }}
                          title="Delete custom block"
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-900/90 text-red-200 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {grouped.customMatches.length === 0 && BLOCK_CATALOG.length === 0 && (
          <div className="text-cad-dim text-xs italic px-1">No blocks match your filter.</div>
        )}
      </div>
    </div>
  );
};

export default BlockLibraryPanel;
