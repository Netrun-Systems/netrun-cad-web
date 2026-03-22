import React, { useState, useMemo } from 'react';
import { PLANT_DATABASE, searchPlants } from '../../data/plants';
import type { Plant } from '../../data/plants';

interface PlantBrowserProps {
  selectedPlantId: string | null;
  onSelectPlant: (id: string) => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<Plant['type'], string> = {
  tree: 'Trees',
  shrub: 'Shrubs',
  perennial: 'Perennials',
  groundcover: 'Groundcovers',
  grass: 'Grasses',
  succulent: 'Succulents',
  vine: 'Vines',
};

const WATER_COLORS = {
  low: 'text-green-400',
  moderate: 'text-yellow-400',
  high: 'text-blue-400',
};

export const PlantBrowser: React.FC<PlantBrowserProps> = ({
  selectedPlantId,
  onSelectPlant,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<Plant['type'] | ''>('');

  const filtered = useMemo(() => {
    let results = query ? searchPlants(query) : PLANT_DATABASE;
    if (filterType) {
      results = results.filter((p) => p.type === filterType);
    }
    return results;
  }, [query, filterType]);

  // Group by type
  const grouped = useMemo(() => {
    const groups = new Map<string, Plant[]>();
    for (const plant of filtered) {
      const key = plant.type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(plant);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="absolute top-12 right-2 w-72 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">Plant Library</span>
        <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-xs">
          Close
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-cad-accent">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plants..."
          className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-1 text-cad-text text-xs outline-none focus:border-cad-highlight"
        />
        {/* Type filter */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <button
            onClick={() => setFilterType('')}
            className={`px-1.5 py-0.5 rounded text-[10px] ${
              !filterType ? 'bg-cad-accent text-white' : 'text-cad-dim hover:bg-cad-accent/20'
            }`}
          >
            All
          </button>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key as Plant['type'])}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                filterType === key ? 'bg-cad-accent text-white' : 'text-cad-dim hover:bg-cad-accent/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Plant list */}
      <div className="overflow-y-auto flex-1">
        {selectedPlantId && (
          <div className="px-3 py-2 bg-cad-highlight/10 border-b border-cad-accent">
            <div className="flex items-center justify-between">
              <span className="text-cad-highlight text-xs font-medium">Placing plant — click canvas</span>
              <button
                onClick={() => onSelectPlant(selectedPlantId)}
                className="text-cad-dim hover:text-cad-text text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {Array.from(grouped.entries()).map(([type, plants]) => (
          <div key={type}>
            <div className="px-3 py-1 bg-cad-accent/10 text-cad-dim text-[10px] uppercase tracking-wider font-medium">
              {TYPE_LABELS[type as Plant['type']] || type}
            </div>
            {plants.map((plant) => (
              <button
                key={plant.id}
                onClick={() => onSelectPlant(plant.id)}
                className={`w-full text-left px-3 py-1.5 flex items-start gap-2 transition-colors ${
                  selectedPlantId === plant.id
                    ? 'bg-cad-highlight/20'
                    : 'hover:bg-cad-accent/10'
                }`}
              >
                {/* Color dot representing canopy */}
                <div
                  className="w-4 h-4 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: plant.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-cad-text text-xs font-medium truncate">
                    {plant.commonName}
                  </div>
                  <div className="text-cad-dim text-[10px] italic truncate">
                    {plant.botanicalName}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] ${WATER_COLORS[plant.waterUse]}`}>
                      {plant.waterUse}
                    </span>
                    <span className="text-cad-dim text-[10px]">
                      {plant.matureWidth}'w x {plant.matureHeight}'h
                    </span>
                    <span className="text-cad-dim text-[10px]">
                      Z{plant.zones}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-cad-dim text-xs">
            No plants match your search.
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-cad-accent text-cad-dim text-[10px] text-center">
        {PLANT_DATABASE.length} plants in library
      </div>
    </div>
  );
};
