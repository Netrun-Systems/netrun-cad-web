import React from 'react';
import { IRRIGATION_HEADS, ZONE_COLORS, defaultRadiusPx, type IrrigationHeadSpec } from '../../data/irrigation';
import type { IrrigationHeadType } from '../../engine/types';

interface IrrigationPanelProps {
  /** The currently armed head + zone — set by clicking in this panel,
   *  consumed by CADCanvas's pointer-down to drop the head on canvas. */
  pending: { headType: IrrigationHeadType; zoneId: number } | null;
  onArm: (next: { headType: IrrigationHeadType; zoneId: number } | null) => void;
  onOpenSchedule: () => void;
  onClose: () => void;
}

const ZONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

export const IrrigationPanel: React.FC<IrrigationPanelProps> = ({
  pending, onArm, onOpenSchedule, onClose,
}) => {
  const handleHeadClick = (spec: IrrigationHeadSpec) => {
    const zoneId = pending?.zoneId ?? 1;
    if (pending?.headType === spec.type) {
      onArm(null);
    } else {
      onArm({ headType: spec.type, zoneId });
    }
  };

  const handleZoneClick = (zoneId: number) => {
    if (pending) onArm({ ...pending, zoneId });
    else onArm({ headType: 'spray', zoneId });
  };

  return (
    <div className="absolute top-12 right-2 w-72 max-h-[80vh] flex flex-col bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">Irrigation</span>
        <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-xs">Close</button>
      </div>

      {pending && (
        <div className="px-3 py-1.5 text-xs text-cad-highlight border-b border-cad-accent/40 bg-cad-highlight/10">
          Click on canvas to place {pending.headType} (Zone {pending.zoneId}). Esc to cancel.
        </div>
      )}

      {/* Head types */}
      <div className="px-3 py-2 border-b border-cad-accent/40">
        <div className="text-cad-dim text-[10px] uppercase tracking-wider pb-1">Head Type</div>
        <div className="space-y-1">
          {IRRIGATION_HEADS.map((spec) => {
            const isPending = pending?.headType === spec.type;
            return (
              <button
                key={spec.type}
                onClick={() => handleHeadClick(spec)}
                title={spec.description}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  isPending ? 'bg-cad-highlight/20 ring-1 ring-cad-highlight' : 'hover:bg-cad-accent/30'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
                  style={{ backgroundColor: spec.symbolColor }}
                >
                  {spec.label.charAt(0)}
                </span>
                <span className="text-cad-text flex-1 text-left">{spec.label}</span>
                <span className="text-cad-dim font-mono">{spec.defaultRadiusFt}′ • {spec.gpm} GPM</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone picker */}
      <div className="px-3 py-2 border-b border-cad-accent/40">
        <div className="text-cad-dim text-[10px] uppercase tracking-wider pb-1">Zone</div>
        <div className="grid grid-cols-8 gap-1">
          {ZONE_IDS.map((z) => {
            const isPending = pending?.zoneId === z;
            return (
              <button
                key={z}
                onClick={() => handleZoneClick(z)}
                className={`aspect-square rounded text-[10px] font-bold text-white transition-transform ${
                  isPending ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: ZONE_COLORS[z] }}
                title={`Zone ${z}`}
              >
                {z}
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule shortcut */}
      <div className="px-3 py-2">
        <button
          onClick={onOpenSchedule}
          className="w-full px-3 py-1.5 bg-cad-accent text-cad-text rounded text-xs font-medium hover:bg-cad-accent/70 transition-colors"
        >
          Open Schedule (per-zone GPM)
        </button>
      </div>
    </div>
  );
};

export default IrrigationPanel;
