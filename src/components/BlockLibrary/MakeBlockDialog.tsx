import React, { useState } from 'react';
import type { CADElement } from '../../engine/types';
import type { BlockDefinition } from '../../data/blocks';
import { addCustomBlock, makeBlockFromSelection } from '../../data/custom-blocks';

interface MakeBlockDialogProps {
  /** The currently selected elements that will compose the block. */
  elements: CADElement[];
  onClose: () => void;
  /** Called after the block is saved. The caller may choose to replace
   *  the current selection with a single CADBlockInstance reference at
   *  the returned insertion point. */
  onCreated: (blockId: string, insertionPoint: { x: number; y: number }) => void;
}

const CATEGORIES: Array<{ value: BlockDefinition['category']; label: string }> = [
  { value: 'furniture',  label: 'Furniture' },
  { value: 'structural', label: 'Structural' },
  { value: 'hardscape',  label: 'Hardscape' },
  { value: 'lighting',   label: 'Lighting' },
];

export const MakeBlockDialog: React.FC<MakeBlockDialogProps> = ({ elements, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BlockDefinition['category']>('furniture');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canSave = name.trim().length > 0 && elements.length >= 2;

  const handleSave = () => {
    if (!canSave) return;
    try {
      const result = makeBlockFromSelection(elements, {
        name: name.trim(),
        category,
        description: description.trim() || undefined,
      });
      addCustomBlock(result.definition);
      onCreated(result.definition.id, result.insertionPoint);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-cad-surface border border-cad-accent rounded-xl w-[440px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-cad-accent flex items-center justify-between">
          <h2 className="text-cad-text font-semibold text-lg">Make Block from Selection</h2>
          <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-xl leading-none px-2">×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-cad-dim text-xs">
            <span className="text-cad-text font-mono">{elements.length}</span> selected element{elements.length === 1 ? '' : 's'} will be saved as a reusable block. The block&apos;s insertion point will be the bbox center of the current selection.
          </div>

          <div>
            <label className="text-cad-dim text-xs uppercase tracking-wider block mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Patio Table Set"
              className="w-full bg-cad-bg text-cad-text text-sm px-2 py-1.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none"
            />
          </div>

          <div>
            <label className="text-cad-dim text-xs uppercase tracking-wider block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BlockDefinition['category'])}
              className="w-full bg-cad-bg text-cad-text text-sm px-2 py-1.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-cad-dim text-xs uppercase tracking-wider block mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 6′ table + 4 chairs, granite top"
              className="w-full bg-cad-bg text-cad-text text-sm px-2 py-1.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs">{error}</div>
          )}

          <div className="text-cad-dim text-[10px] italic">
            Custom blocks live in this browser&apos;s storage. Cross-device sync via Google Drive is on the roadmap.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-cad-accent">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-cad-dim hover:text-cad-text text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 bg-cad-highlight text-white rounded text-sm font-medium hover:bg-cad-highlight/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Block
          </button>
        </div>
      </div>
    </div>
  );
};

export default MakeBlockDialog;
