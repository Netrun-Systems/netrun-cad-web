import React from 'react';
import type { CADElement, Layer } from '../../engine/types';

interface PropertyPanelProps {
  element: CADElement;
  layers: Layer[];
  onUpdate: (next: CADElement) => void;
  onDelete: () => void;
  onReorder: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  onClose: () => void;
}

const PIXELS_PER_FOOT = 48; // matches DEFAULT_GRID.pixelsPerUnit
const toFt = (px: number) => (px / PIXELS_PER_FOOT).toFixed(2);

/* --------------------------------------------------------------------- */
/*  Per-element body renderers                                            */
/* --------------------------------------------------------------------- */

function PositionReadout({ x, y }: { x: number; y: number }) {
  return (
    <div className="text-cad-dim text-xs font-mono">
      X <span className="text-cad-text">{toFt(x)}</span>
      &nbsp;&nbsp;Y <span className="text-cad-text">{toFt(y)}</span>
      &nbsp;<span className="text-cad-dim/60">FT</span>
    </div>
  );
}

function SizeReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-cad-dim text-xs font-mono">
      {label} <span className="text-cad-text">{value}</span>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-cad-dim text-xs uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function ColorField({
  value,
  onChange,
  allowClear,
}: {
  value: string;
  onChange: (next: string | undefined) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded"
      />
      {allowClear && value && (
        <button
          onClick={() => onChange(undefined)}
          className="text-cad-dim hover:text-cad-text text-xs px-1"
          title="Clear fill"
        >
          ×
        </button>
      )}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-16 bg-cad-bg text-cad-text text-xs px-1.5 py-0.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none"
      />
      {unit && <span className="text-cad-dim text-xs">{unit}</span>}
    </div>
  );
}

function SliderField({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 accent-cad-highlight"
      />
      <span className="text-cad-text text-xs font-mono w-8 text-right">{value}</span>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*  Element-specific body rendering                                       */
/* --------------------------------------------------------------------- */

function renderElementBody(
  element: CADElement,
  onUpdate: (next: CADElement) => void,
): React.ReactNode {
  switch (element.type) {
    case 'line':
      return (
        <>
          <PositionReadout x={element.p1.x} y={element.p1.y} />
          <PositionReadout x={element.p2.x} y={element.p2.y} />
          <FieldRow label="Color">
            <ColorField value={element.strokeColor} onChange={(v) => onUpdate({ ...element, strokeColor: v ?? '#ffffff' })} />
          </FieldRow>
          <FieldRow label="Width">
            <SliderField value={element.strokeWidth} onChange={(v) => onUpdate({ ...element, strokeWidth: v })} min={1} max={8} />
          </FieldRow>
        </>
      );

    case 'dimension':
      return (
        <>
          <PositionReadout x={element.p1.x} y={element.p1.y} />
          <PositionReadout x={element.p2.x} y={element.p2.y} />
          <FieldRow label="Offset">
            <NumberField value={element.offset} onChange={(v) => onUpdate({ ...element, offset: v })} step={1} unit="px" />
          </FieldRow>
          <FieldRow label="Label">
            <input
              type="text"
              value={element.label ?? ''}
              placeholder="auto"
              onChange={(e) => onUpdate({ ...element, label: e.target.value || undefined })}
              className="flex-1 bg-cad-bg text-cad-text text-xs px-1.5 py-0.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none max-w-[8rem]"
            />
          </FieldRow>
        </>
      );

    case 'rectangle':
      return (
        <>
          <PositionReadout x={element.origin.x} y={element.origin.y} />
          <SizeReadout label="W" value={`${toFt(element.width)} FT`} />
          <SizeReadout label="H" value={`${toFt(element.height)} FT`} />
          <FieldRow label="Stroke">
            <ColorField value={element.strokeColor} onChange={(v) => onUpdate({ ...element, strokeColor: v ?? '#ffffff' })} />
          </FieldRow>
          <FieldRow label="Fill">
            <ColorField value={element.fillColor ?? ''} allowClear onChange={(v) => onUpdate({ ...element, fillColor: v })} />
          </FieldRow>
          <FieldRow label="Width">
            <SliderField value={element.strokeWidth} onChange={(v) => onUpdate({ ...element, strokeWidth: v })} min={1} max={8} />
          </FieldRow>
        </>
      );

    case 'circle':
      return (
        <>
          <PositionReadout x={element.center.x} y={element.center.y} />
          <SizeReadout label="R" value={`${toFt(element.radius)} FT`} />
          <FieldRow label="Stroke">
            <ColorField value={element.strokeColor} onChange={(v) => onUpdate({ ...element, strokeColor: v ?? '#ffffff' })} />
          </FieldRow>
          <FieldRow label="Fill">
            <ColorField value={element.fillColor ?? ''} allowClear onChange={(v) => onUpdate({ ...element, fillColor: v })} />
          </FieldRow>
          <FieldRow label="Width">
            <SliderField value={element.strokeWidth} onChange={(v) => onUpdate({ ...element, strokeWidth: v })} min={1} max={8} />
          </FieldRow>
          <FieldRow label="Radius">
            <NumberField value={Number(toFt(element.radius))} onChange={(v) => onUpdate({ ...element, radius: v * PIXELS_PER_FOOT })} min={0.1} step={0.1} unit="FT" />
          </FieldRow>
        </>
      );

    case 'freehand':
      return (
        <>
          <SizeReadout label="Points" value={String(element.points.length)} />
          <FieldRow label="Color">
            <ColorField value={element.color} onChange={(v) => onUpdate({ ...element, color: v ?? '#ffffff' })} />
          </FieldRow>
          <FieldRow label="Size">
            <SliderField value={element.size} onChange={(v) => onUpdate({ ...element, size: v })} min={1} max={32} />
          </FieldRow>
          <FieldRow label="Opacity">
            <SliderField value={Math.round(element.opacity * 100)} onChange={(v) => onUpdate({ ...element, opacity: v / 100 })} min={5} max={100} />
          </FieldRow>
        </>
      );

    case 'text':
      return (
        <>
          <PositionReadout x={element.position.x} y={element.position.y} />
          <FieldRow label="Text">
            <input
              type="text"
              value={element.content}
              onChange={(e) => onUpdate({ ...element, content: e.target.value })}
              className="flex-1 bg-cad-bg text-cad-text text-xs px-1.5 py-0.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none"
            />
          </FieldRow>
          <FieldRow label="Color">
            <ColorField value={element.color} onChange={(v) => onUpdate({ ...element, color: v ?? '#ffffff' })} />
          </FieldRow>
          <FieldRow label="Size">
            <NumberField value={element.fontSize} onChange={(v) => onUpdate({ ...element, fontSize: v })} min={6} max={144} unit="px" />
          </FieldRow>
          <FieldRow label="Rotate">
            <NumberField value={element.rotation} onChange={(v) => onUpdate({ ...element, rotation: v })} min={-360} max={360} unit="°" />
          </FieldRow>
        </>
      );

    case 'plant':
      return (
        <>
          <PositionReadout x={element.position.x} y={element.position.y} />
          <SizeReadout label="Plant" value={element.plantId} />
          <FieldRow label="Scale">
            <SliderField value={Math.round(element.scale * 100)} onChange={(v) => onUpdate({ ...element, scale: v / 100 })} min={25} max={400} />
          </FieldRow>
        </>
      );

    case 'interior-symbol':
      return (
        <>
          <PositionReadout x={element.position.x} y={element.position.y} />
          <SizeReadout label="Symbol" value={element.symbolKey} />
          <FieldRow label="Width">
            <NumberField value={element.width} onChange={(v) => onUpdate({ ...element, width: v })} min={0.1} step={0.1} unit="FT" />
          </FieldRow>
          <FieldRow label="Depth">
            <NumberField value={element.depth} onChange={(v) => onUpdate({ ...element, depth: v })} min={0.1} step={0.1} unit="FT" />
          </FieldRow>
          <FieldRow label="Rotate">
            <NumberField value={element.rotation} onChange={(v) => onUpdate({ ...element, rotation: v })} min={-360} max={360} unit="°" />
          </FieldRow>
          <FieldRow label="Color">
            <ColorField value={element.color ?? ''} allowClear onChange={(v) => onUpdate({ ...element, color: v })} />
          </FieldRow>
        </>
      );

    default:
      // flowchart-shape, container, connector — diagram-mode, no editor in v1
      return (
        <div className="text-cad-dim text-xs italic">
          No editor for {element.type} elements yet.
        </div>
      );
  }
}

/* --------------------------------------------------------------------- */
/*  Friendly type label                                                   */
/* --------------------------------------------------------------------- */

function elementLabel(element: CADElement): string {
  switch (element.type) {
    case 'line': return 'Line';
    case 'rectangle': return 'Rectangle';
    case 'circle': return 'Circle';
    case 'dimension': return 'Dimension';
    case 'freehand': return 'Freehand Stroke';
    case 'text': return 'Text';
    case 'plant': return 'Plant';
    case 'interior-symbol': return 'Interior Symbol';
    case 'flowchart-shape': return 'Flowchart Shape';
    case 'container': return 'Container';
    case 'connector': return 'Connector';
    default: return 'Element';
  }
}

/* --------------------------------------------------------------------- */
/*  Default export                                                        */
/* --------------------------------------------------------------------- */

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  layers,
  onUpdate,
  onDelete,
  onReorder,
  onClose,
}) => {
  const layerOptionsSorted = [...layers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="absolute bottom-10 right-2 w-64 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">{elementLabel(element)}</span>
        <button
          onClick={onClose}
          className="text-cad-dim hover:text-cad-text text-xs"
          title="Deselect (Esc)"
        >
          ×
        </button>
      </div>

      {/* Body — element-specific properties */}
      <div className="px-3 py-2 space-y-1">
        {renderElementBody(element, onUpdate)}

        {/* Layer is universal */}
        <FieldRow label="Layer">
          <select
            value={element.layerId}
            onChange={(e) => onUpdate({ ...element, layerId: e.target.value } as CADElement)}
            className="bg-cad-bg text-cad-text text-xs px-1.5 py-0.5 rounded border border-cad-accent/50 focus:border-cad-highlight outline-none flex-1 max-w-[8rem]"
          >
            {layerOptionsSorted.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </FieldRow>
      </div>

      {/* Reorder + Delete */}
      <div className="px-3 py-2 border-t border-cad-accent flex items-center gap-1">
        <button
          onClick={() => onReorder('back')}
          className="px-2 py-1 text-cad-dim hover:text-cad-text hover:bg-cad-accent/30 rounded text-xs transition-colors"
          title="Send to back"
        >
          ⇊
        </button>
        <button
          onClick={() => onReorder('backward')}
          className="px-2 py-1 text-cad-dim hover:text-cad-text hover:bg-cad-accent/30 rounded text-xs transition-colors"
          title="Send backward"
        >
          ↓
        </button>
        <button
          onClick={() => onReorder('forward')}
          className="px-2 py-1 text-cad-dim hover:text-cad-text hover:bg-cad-accent/30 rounded text-xs transition-colors"
          title="Bring forward"
        >
          ↑
        </button>
        <button
          onClick={() => onReorder('front')}
          className="px-2 py-1 text-cad-dim hover:text-cad-text hover:bg-cad-accent/30 rounded text-xs transition-colors"
          title="Bring to front"
        >
          ⇈
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded text-xs transition-colors"
          title="Delete (Del / Backspace)"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default PropertyPanel;
