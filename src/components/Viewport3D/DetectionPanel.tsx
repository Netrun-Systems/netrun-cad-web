import { useState } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MapPin,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Detection3D } from './ModelViewer3D';

/** Human-readable labels by feature_type prefix */
const typeLabels: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac: 'HVAC',
  structural: 'Structural',
  fixture: 'Fixture',
};

/** Tailwind dot-color classes by feature_type prefix */
const typeDotColors: Record<string, string> = {
  electrical: 'bg-amber-500',
  plumbing: 'bg-blue-500',
  hvac: 'bg-cyan-500',
  structural: 'bg-gray-500',
  fixture: 'bg-green-500',
};

function labelFor(featureType: string): string {
  const key = Object.keys(typeLabels).find((k) =>
    featureType.toLowerCase().startsWith(k),
  );
  return key ? typeLabels[key] : featureType;
}

function dotColorFor(featureType: string): string {
  const key = Object.keys(typeDotColors).find((k) =>
    featureType.toLowerCase().startsWith(k),
  );
  return key ? typeDotColors[key] : 'bg-gray-500';
}

function confidenceBadge(confidence: number): string {
  if (confidence >= 0.9) return 'bg-green-900/60 text-green-300';
  if (confidence >= 0.7) return 'bg-yellow-900/60 text-yellow-300';
  return 'bg-red-900/60 text-red-300';
}

/* ------------------------------------------------------------------ */

export interface DetectionPanelProps {
  detections: Detection3D[];
  selectedDetectionId: string | null;
  onDetectionSelect: (id: string) => void;
  onDetectionVisibilityChange?: (id: string, visible: boolean) => void;
  visibilityMap?: Record<string, boolean>;
}

export default function DetectionPanel({
  detections,
  selectedDetectionId,
  onDetectionSelect,
  onDetectionVisibilityChange,
  visibilityMap,
}: DetectionPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'type' | 'confidence' | 'position'>('type');
  const [sortAsc, setSortAsc] = useState(true);

  // Unique prefixes present in the dataset
  const detectionTypes = Array.from(
    new Set(detections.map((d) => labelFor(d.feature_type))),
  );

  // Filter
  const filtered = detections.filter((d) => {
    const label = labelFor(d.feature_type);
    const matchesSearch =
      d.feature_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedTypes.size === 0 || selectedTypes.has(label);
    return matchesSearch && matchesType;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'type':
        cmp = a.feature_type.localeCompare(b.feature_type);
        break;
      case 'confidence':
        cmp = a.confidence - b.confidence;
        break;
      case 'position':
        cmp =
          a.coordinates.x - b.coordinates.x ||
          a.coordinates.z - b.coordinates.z;
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  // Counts per label
  const countByLabel = detections.reduce<Record<string, number>>((acc, d) => {
    const lbl = labelFor(d.feature_type);
    acc[lbl] = (acc[lbl] || 0) + 1;
    return acc;
  }, {});

  const handleTypeToggle = (label: string) => {
    const next = new Set(selectedTypes);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setSelectedTypes(next);
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortAsc(!sortAsc);
    else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-100">
            Detections ({filtered.length})
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Filter'}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search detections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Type filter chips */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs font-medium text-gray-500 mb-2">
              Filter by type
            </div>
            <div className="flex flex-wrap gap-2">
              {detectionTypes.map((label) => (
                <button
                  key={label}
                  onClick={() => handleTypeToggle(label)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    selectedTypes.has(label) || selectedTypes.size === 0
                      ? 'bg-gray-700 text-gray-200'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${dotColorFor(label)}`}
                  />
                  {label}
                  <span className="text-gray-500">({countByLabel[label] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sort controls */}
      <div className="px-4 py-2 bg-gray-800/60 border-b border-gray-700 flex items-center gap-4 text-xs">
        <span className="text-gray-500">Sort by:</span>
        {(['type', 'confidence', 'position'] as const).map((field) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 ${
              sortBy === field
                ? 'text-cyan-400 font-medium'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {field.charAt(0).toUpperCase() + field.slice(1)}
            {sortBy === field &&
              (sortAsc ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              ))}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No detections found</p>
            {searchQuery && (
              <p className="text-sm mt-1">Try adjusting your search</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sorted.map((det) => {
              const isSelected = selectedDetectionId === det.id;
              const isVisible = visibilityMap?.[det.id] !== false;

              return (
                <div
                  key={det.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-900/30 border-l-2 border-cyan-500'
                      : 'hover:bg-gray-800 border-l-2 border-transparent'
                  }`}
                  onClick={() => onDetectionSelect(det.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${dotColorFor(
                          det.feature_type,
                        )}`}
                      />
                      <div>
                        <div className="font-medium text-sm text-gray-100">
                          {det.feature_type}
                        </div>
                        <div className="text-xs text-gray-500">
                          {labelFor(det.feature_type)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${confidenceBadge(
                          det.confidence,
                        )}`}
                      >
                        {(det.confidence * 100).toFixed(0)}%
                      </span>

                      {onDetectionVisibilityChange && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDetectionVisibilityChange(det.id, !isVisible);
                          }}
                          className={`p-1 rounded ${
                            isVisible
                              ? 'text-gray-400 hover:text-gray-200'
                              : 'text-gray-600 hover:text-gray-400'
                          }`}
                        >
                          {isVisible ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Coordinates */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      ({det.coordinates.x.toFixed(2)},{' '}
                      {det.coordinates.y.toFixed(2)},{' '}
                      {det.coordinates.z.toFixed(2)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div className="p-3 bg-gray-800/60 border-t border-gray-700">
        <div className="flex flex-wrap gap-3">
          {Object.entries(countByLabel).map(([label, count]) => (
            <div
              key={label}
              className="inline-flex items-center gap-1 text-xs text-gray-400"
            >
              <span
                className={`w-2 h-2 rounded-full ${dotColorFor(label)}`}
              />
              {label}: {count}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
