import React from 'react';
import type { CADElement, Layer } from '../../engine/types';

interface MultiPropertyPanelProps {
  elements: CADElement[];
  layers: Layer[];
  /** Set the layerId of every selected element. */
  onLayerChange: (layerId: string) => void;
  /** Set a stroke/fill/text color uniformly across compatible elements. */
  onColorChange: (color: string) => void;
  onDeleteAll: () => void;
  /** Triggered by the "Make Block" button. The parent opens MakeBlockDialog. */
  onMakeBlock: () => void;
  onClose: () => void;
}

/* ---------------------------------------------------------------- */

const TYPE_LABEL: Record<string, string> = {
  line: 'Lines',
  rectangle: 'Rectangles',
  circle: 'Circles',
  polyline: 'Polylines',
  dimension: 'Dimensions',
  freehand: 'Strokes',
  text: 'Text',
  plant: 'Plants',
  'interior-symbol': 'Symbols',
  'flowchart-shape': 'Shapes',
  container: 'Containers',
  connector: 'Connectors',
};

function elementTypeBreakdown(elements: CADElement[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const el of elements) counts.set(el.type, (counts.get(el.type) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

/* ---------------------------------------------------------------- */

export const MultiPropertyPanel: React.FC<MultiPropertyPanelProps> = ({
  elements,
  layers,
  onLayerChange,
  onColorChange,
  onDeleteAll,
  onMakeBlock,
  onClose,
}) => {
  const breakdown = elementTypeBreakdown(elements);
  const layerOptionsSorted = [...layers].sort((a, b) => a.name.localeCompare(b.name));

  // Detect if all selected elements share the same layerId — when they do,
  // pre-select that in the dropdown; otherwise leave it empty so the user
  // makes an explicit choice.
  const sharedLayer = elements.every((el) => el.layerId === elements[0]?.layerId)
    ? elements[0]?.layerId
    : '';

  return (
    <div className="absolute bottom-10 right-2 w-64 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">{elements.length} elements</span>
        <button
          onClick={onClose}
          className="text-cad-dim hover:text-cad-text text-xs"
          title="Deselect (Esc)"
        >
          ×
        </button>
      </div>

      {/* Body — type breakdown + group ops */}
      <div className="px-3 py-2 space-y-2">
        <div className="text-cad-dim text-xs space-y-0.5">
          {breakdown.map(([type, count]) => (
            <div key={type} className="flex justify-between">
              <span>{TYPE_LABEL[type] ?? type}</span>
              <span className="text-cad-text font-mono">{count}</span>
            </div>
          ))}
        </div>

        {/* Layer */}
        <div className="flex items-center justify-between gap-2 py-1 border-t border-cad-accent/30 pt-2">
          <span className="text-cad-dim text-xs uppercase tracking-wider">Layer</span>
          <select
            value={sharedLayer}
            onChange={(e) => onLayerChange(e.target.value)}
            className="bg-cad-bg text-cad-text text-xs px-1.5 py-0.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none flex-1 max-w-[8rem]"
          >
            {!sharedLayer && <option value="">(mixed)</option>}
            {layerOptionsSorted.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Color (applied across types — strokeColor for shapes, color for freehand/text) */}
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-cad-dim text-xs uppercase tracking-wider">Color</span>
          <input
            type="color"
            onChange={(e) => onColorChange(e.target.value)}
            className="w-6 h-6 rounded"
            title="Apply color to every selected element"
          />
        </div>
      </div>

      {/* Footer — bulk ops */}
      <div className="px-3 py-2 border-t border-cad-accent flex items-center gap-1">
        <button
          onClick={onMakeBlock}
          className="px-2 py-1 text-cad-text hover:bg-cad-accent/40 rounded text-xs transition-colors"
          title="Save selection as a reusable block"
        >
          Make Block
        </button>
        <div className="flex-1" />
        <button
          onClick={onDeleteAll}
          className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded text-xs transition-colors"
          title="Delete all selected (Del / Backspace)"
        >
          Delete All
        </button>
      </div>
    </div>
  );
};

export default MultiPropertyPanel;
