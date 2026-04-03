import type { UtilityType, Route } from '../../engine/route-types';
import { UTILITY_COLORS } from '../../engine/route-types';

interface RouteEditorPanelProps {
  activeUtilityType: UtilityType;
  onUtilityTypeChange: (type: UtilityType) => void;
  routes: Route[];
  onNewRoute: () => void;
  onEstimateCost: (route: Route) => void;
}

const UTILITY_LABELS: Record<UtilityType, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  low_voltage: 'Low Voltage',
};

const UTILITY_TYPES: UtilityType[] = ['electrical', 'plumbing', 'hvac', 'low_voltage'];

function statusBadge(status: Route['status']) {
  const styles: Record<Route['status'], string> = {
    draft: 'bg-gray-600 text-gray-200',
    calculated: 'bg-amber-700 text-amber-100',
    approved: 'bg-green-700 text-green-100',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function RouteEditorPanel({
  activeUtilityType,
  onUtilityTypeChange,
  routes,
  onNewRoute,
  onEstimateCost,
}: RouteEditorPanelProps) {
  return (
    <div className="space-y-3">
      {/* Utility type selector */}
      <div>
        <div className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
          Utility Type
        </div>
        <div className="grid grid-cols-4 gap-1">
          {UTILITY_TYPES.map((ut) => {
            const active = ut === activeUtilityType;
            return (
              <button
                key={ut}
                onClick={() => onUtilityTypeChange(ut)}
                className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded text-[10px] font-medium transition-colors ${
                  active
                    ? 'bg-gray-700 text-white ring-1 ring-gray-500'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: UTILITY_COLORS[ut] }}
                />
                {UTILITY_LABELS[ut]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={onNewRoute}
          className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          New Route
        </button>
      </div>

      {/* Routes list */}
      <div>
        <div className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
          Routes ({routes.length})
        </div>
        {routes.length === 0 ? (
          <div className="text-xs text-gray-500 italic py-3 text-center">
            No routes yet. Click "New Route" to start.
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {routes.map((route) => (
              <div
                key={route.id}
                className="flex items-center justify-between p-2 bg-gray-800 rounded hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: UTILITY_COLORS[route.utilityType] }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-gray-200 truncate">
                      {route.name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {route.points.length} pts &middot; {route.totalLength.toFixed(1)} ft
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {statusBadge(route.status)}
                  <button
                    onClick={() => onEstimateCost(route)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    title="Estimate cost"
                  >
                    $
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
