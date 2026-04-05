/**
 * ScaleConfirmDialog — shown after DXF import to let the user confirm
 * or adjust the drawing unit / scale factor before placing elements.
 */

import React, { useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScaleConfirmDialogProps {
  isOpen: boolean;
  onConfirm: (scaleFactor: number) => void;
  onCancel: () => void;
  detectedUnit: string;  // from DXF header or 'unknown'
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  elementCount: number;
  layerCount: number;
}

// ── Unit definitions ─────────────────────────────────────────────────────────

interface UnitOption {
  id: string;
  label: string;
  /** Multiply raw DXF coords by this to get feet (our internal unit) */
  toFeetFactor: number;
}

const UNIT_OPTIONS: UnitOption[] = [
  { id: 'feet',        label: 'Feet',        toFeetFactor: 1 },
  { id: 'inches',      label: 'Inches',      toFeetFactor: 1 / 12 },
  { id: 'meters',      label: 'Meters',      toFeetFactor: 3.28084 },
  { id: 'millimeters', label: 'Millimeters',  toFeetFactor: 0.00328084 },
];

/** Map detected DXF unit strings to our unit option IDs */
const DETECTED_UNIT_MAP: Record<string, string> = {
  feet: 'feet',
  inches: 'inches',
  meters: 'meters',
  millimeters: 'millimeters',
  centimeters: 'meters', // close enough — user can adjust
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function metersStr(valueFt: number): string {
  const m = valueFt / 3.28084;
  if (m < 1) return `${(m * 100).toFixed(1)}cm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m.toFixed(1)}m`;
}

function sizeHint(widthFt: number, heightFt: number): { text: string; color: string } {
  const avgM = ((widthFt + heightFt) / 2) / 3.28084;
  if (avgM < 0.5)  return { text: 'too small -- probably wrong', color: 'text-red-400' };
  if (avgM < 5)    return { text: 'small room', color: 'text-yellow-400' };
  if (avgM < 30)   return { text: 'room / small building', color: 'text-green-400' };
  if (avgM < 200)  return { text: 'building / site', color: 'text-green-400' };
  if (avgM < 2000) return { text: 'large building / campus', color: 'text-green-400' };
  return { text: 'very large -- check units', color: 'text-yellow-400' };
}

/** Guess the most likely unit from bounding box dimensions */
function guessUnit(
  rawWidth: number,
  rawHeight: number,
  detectedUnit: string,
): string {
  // If the DXF header told us, trust it
  const mapped = DETECTED_UNIT_MAP[detectedUnit];
  if (mapped) return mapped;

  // Heuristic: assume the drawing is a building (10m-200m).
  // Try each unit and pick the one that lands in the sweet spot.
  const avg = (rawWidth + rawHeight) / 2;

  for (const unit of UNIT_OPTIONS) {
    const avgFt = avg * unit.toFeetFactor;
    const avgM = avgFt / 3.28084;
    if (avgM >= 5 && avgM <= 300) return unit.id;
  }

  return 'feet'; // fallback
}

// ── Component ────────────────────────────────────────────────────────────────

export const ScaleConfirmDialog: React.FC<ScaleConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  detectedUnit,
  boundingBox,
  elementCount,
  layerCount,
}) => {
  const rawWidth = Math.abs(boundingBox.maxX - boundingBox.minX);
  const rawHeight = Math.abs(boundingBox.maxY - boundingBox.minY);

  const bestGuess = useMemo(
    () => guessUnit(rawWidth, rawHeight, detectedUnit),
    [rawWidth, rawHeight, detectedUnit],
  );

  const [selectedUnit, setSelectedUnit] = useState<string>(bestGuess);
  const [customScale, setCustomScale] = useState<string>('1');
  const [isCustom, setIsCustom] = useState(false);

  const scaleFactor = useMemo(() => {
    if (isCustom) {
      const v = parseFloat(customScale);
      return isNaN(v) || v <= 0 ? 1 : v;
    }
    const unit = UNIT_OPTIONS.find((u) => u.id === selectedUnit);
    return unit?.toFeetFactor ?? 1;
  }, [selectedUnit, isCustom, customScale]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[460px] shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700">
          <h2 className="text-gray-100 font-semibold text-base">Confirm Blueprint Scale</h2>
          <p className="text-gray-400 text-xs mt-1">
            {elementCount} element{elementCount !== 1 ? 's' : ''} across{' '}
            {layerCount} layer{layerCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Raw bounding box */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Drawing size (raw coordinates)</div>
            <div className="text-sm text-gray-200 font-mono">
              {rawWidth.toFixed(1)} x {rawHeight.toFixed(1)}
              {detectedUnit !== 'unknown' && (
                <span className="text-cyan-400 ml-2">({detectedUnit})</span>
              )}
            </div>
          </div>

          {/* Unit selector */}
          <div>
            <div className="text-xs text-gray-400 mb-2">Select drawing unit</div>
            <div className="grid grid-cols-2 gap-2">
              {UNIT_OPTIONS.map((unit) => {
                const widthFt = rawWidth * unit.toFeetFactor;
                const heightFt = rawHeight * unit.toFeetFactor;
                const hint = sizeHint(widthFt, heightFt);
                const isSelected = !isCustom && selectedUnit === unit.id;
                const isBest = unit.id === bestGuess;

                return (
                  <button
                    key={unit.id}
                    onClick={() => { setSelectedUnit(unit.id); setIsCustom(false); }}
                    className={`
                      text-left px-3 py-2.5 rounded-lg border transition-colors text-xs
                      ${isSelected
                        ? 'border-cyan-500 bg-cyan-950/40'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                      }
                    `}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium ${isSelected ? 'text-cyan-400' : 'text-gray-200'}`}>
                        {unit.label}
                      </span>
                      {isBest && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-medium">
                          likely
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {metersStr(widthFt)} x {metersStr(heightFt)}
                    </div>
                    <div className={`mt-0.5 ${hint.color}`}>{hint.text}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom scale */}
          <div className="bg-gray-800 rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCustom}
                onChange={(e) => setIsCustom(e.target.checked)}
                className="accent-cyan-500"
              />
              <span className="text-xs text-gray-300">Custom scale factor</span>
            </label>
            {isCustom && (
              <div className="mt-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.0001"
                  value={customScale}
                  onChange={(e) => setCustomScale(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <div className="text-[10px] text-gray-500 mt-1">
                  1 DXF unit = {scaleFactor.toFixed(4)} feet
                </div>
              </div>
            )}
          </div>

          {/* Resulting dimensions preview */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Result after scaling</div>
            <div className="text-sm text-gray-200 font-mono">
              {metersStr(rawWidth * scaleFactor)} x {metersStr(rawHeight * scaleFactor)}
            </div>
            {(() => {
              const hint = sizeHint(rawWidth * scaleFactor, rawHeight * scaleFactor);
              return <div className={`text-xs mt-0.5 ${hint.color}`}>{hint.text}</div>;
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(scaleFactor)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScaleConfirmDialog;
