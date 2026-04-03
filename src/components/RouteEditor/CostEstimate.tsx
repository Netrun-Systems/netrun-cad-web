import { useState, useEffect, useCallback } from 'react';
import type { Route } from '../../engine/route-types';
import { UTILITY_COLORS } from '../../engine/route-types';
import api from '../../services/api';

interface CostEstimateProps {
  route: Route | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Rough fallback rates per foot by utility type */
const FALLBACK_RATES: Record<string, { material: number; labor: number; permit: number }> = {
  electrical: { material: 4, labor: 3, permit: 1 },
  plumbing: { material: 6, labor: 4.5, permit: 1.5 },
  hvac: { material: 8, labor: 5, permit: 2 },
  low_voltage: { material: 2.5, labor: 2, permit: 0.5 },
};

interface EstimateResult {
  materialsCost: number;
  laborCost: number;
  permitsCost: number;
  totalCost: number;
}

export default function CostEstimate({ route, isOpen, onClose }: CostEstimateProps) {
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const computeFallback = useCallback((r: Route): EstimateResult => {
    const rates = FALLBACK_RATES[r.utilityType] ?? FALLBACK_RATES.electrical;
    const len = r.totalLength;
    return {
      materialsCost: len * rates.material,
      laborCost: len * rates.labor,
      permitsCost: len * rates.permit,
      totalCost: len * (rates.material + rates.labor + rates.permit),
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !route || route.points.length < 2) {
      setEstimate(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setUsedFallback(false);

    api
      .quickEstimate({
        route_type: route.utilityType,
        length_feet: route.totalLength,
      })
      .then((data) => {
        if (cancelled) return;
        // Try to map the API response; fall back if fields missing
        const d = data as Record<string, number>;
        if (d.total_cost != null) {
          setEstimate({
            materialsCost: d.materials_cost ?? 0,
            laborCost: d.labor_cost ?? 0,
            permitsCost: d.permits_cost ?? 0,
            totalCost: d.total_cost,
          });
        } else {
          setUsedFallback(true);
          setEstimate(computeFallback(route));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setUsedFallback(true);
        setEstimate(computeFallback(route));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, route, computeFallback]);

  if (!isOpen) return null;

  const color = route ? UTILITY_COLORS[route.utilityType] : '#888';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-sm font-semibold text-gray-100">
              Cost Estimate
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {!route ? (
            <div className="text-sm text-gray-500 text-center py-6">
              No route selected
            </div>
          ) : loading ? (
            <div className="text-sm text-gray-400 text-center py-6">
              <div className="animate-spin w-5 h-5 border-2 border-gray-500 border-t-blue-400 rounded-full mx-auto mb-3" />
              Calculating...
            </div>
          ) : estimate ? (
            <div className="space-y-3">
              {/* Route summary */}
              <div className="flex justify-between text-xs text-gray-400">
                <span>Route: {route.name}</span>
                <span>{route.totalLength.toFixed(1)} ft</span>
              </div>

              {usedFallback && (
                <div className="text-[10px] text-amber-400 bg-amber-900/30 px-2 py-1 rounded">
                  Using local estimate (API unavailable)
                </div>
              )}

              {/* Cost breakdown */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Materials</span>
                  <span className="text-gray-200">
                    ${estimate.materialsCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Labor</span>
                  <span className="text-gray-200">
                    ${estimate.laborCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Permits</span>
                  <span className="text-gray-200">
                    ${estimate.permitsCost.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-gray-700 pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-gray-200">Total</span>
                  <span style={{ color }}>
                    ${estimate.totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-6">
              Unable to calculate estimate
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
