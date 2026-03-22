export interface Plant {
  id: string;
  commonName: string;
  botanicalName: string;
  type: 'tree' | 'shrub' | 'perennial' | 'groundcover' | 'grass' | 'succulent' | 'vine';
  waterUse: 'low' | 'moderate' | 'high';
  sunExposure: 'full-sun' | 'partial-shade' | 'full-shade';
  zones: string;
  matureWidth: number;  // feet
  matureHeight: number; // feet
  symbol: string; // CAD symbol character for plan view
  color: string;  // Typical canopy/foliage color for plan rendering
}

/** Curated Southern California landscape plant database */
export const PLANT_DATABASE: Plant[] = [
  // Trees
  { id: 'oak-coast-live', commonName: 'Coast Live Oak', botanicalName: 'Quercus agrifolia', type: 'tree', waterUse: 'low', sunExposure: 'full-sun', zones: '8-11', matureWidth: 40, matureHeight: 40, symbol: '🌳', color: '#2d5a27' },
  { id: 'jacaranda', commonName: 'Jacaranda', botanicalName: 'Jacaranda mimosifolia', type: 'tree', waterUse: 'moderate', sunExposure: 'full-sun', zones: '9-11', matureWidth: 30, matureHeight: 40, symbol: '🌳', color: '#7b68ee' },
  { id: 'olive', commonName: 'Olive Tree', botanicalName: 'Olea europaea', type: 'tree', waterUse: 'low', sunExposure: 'full-sun', zones: '8-11', matureWidth: 25, matureHeight: 30, symbol: '🌳', color: '#6b8e4e' },
  { id: 'citrus-lemon', commonName: 'Lemon Tree', botanicalName: 'Citrus limon', type: 'tree', waterUse: 'moderate', sunExposure: 'full-sun', zones: '9-11', matureWidth: 15, matureHeight: 20, symbol: '🌳', color: '#4a7c39' },
  { id: 'crape-myrtle', commonName: 'Crape Myrtle', botanicalName: 'Lagerstroemia indica', type: 'tree', waterUse: 'moderate', sunExposure: 'full-sun', zones: '7-10', matureWidth: 20, matureHeight: 25, symbol: '🌳', color: '#c94c75' },
  { id: 'palo-verde', commonName: 'Palo Verde', botanicalName: 'Parkinsonia florida', type: 'tree', waterUse: 'low', sunExposure: 'full-sun', zones: '8-11', matureWidth: 25, matureHeight: 30, symbol: '🌳', color: '#88a84e' },

  // Shrubs
  { id: 'lavender', commonName: 'English Lavender', botanicalName: 'Lavandula angustifolia', type: 'shrub', waterUse: 'low', sunExposure: 'full-sun', zones: '5-9', matureWidth: 3, matureHeight: 3, symbol: '🌿', color: '#9370db' },
  { id: 'rosemary', commonName: 'Rosemary', botanicalName: 'Salvia rosmarinus', type: 'shrub', waterUse: 'low', sunExposure: 'full-sun', zones: '7-11', matureWidth: 4, matureHeight: 4, symbol: '🌿', color: '#5a8a5a' },
  { id: 'manzanita', commonName: 'Manzanita', botanicalName: 'Arctostaphylos', type: 'shrub', waterUse: 'low', sunExposure: 'full-sun', zones: '7-10', matureWidth: 6, matureHeight: 6, symbol: '🌿', color: '#6b8e23' },
  { id: 'toyon', commonName: 'Toyon', botanicalName: 'Heteromeles arbutifolia', type: 'shrub', waterUse: 'low', sunExposure: 'full-sun', zones: '7-11', matureWidth: 8, matureHeight: 10, symbol: '🌿', color: '#3a6b35' },
  { id: 'sage-white', commonName: 'White Sage', botanicalName: 'Salvia apiana', type: 'shrub', waterUse: 'low', sunExposure: 'full-sun', zones: '8-11', matureWidth: 4, matureHeight: 5, symbol: '🌿', color: '#a8b8a0' },
  { id: 'pittosporum', commonName: 'Mock Orange', botanicalName: 'Pittosporum tobira', type: 'shrub', waterUse: 'moderate', sunExposure: 'partial-shade', zones: '8-11', matureWidth: 8, matureHeight: 10, symbol: '🌿', color: '#4a7a3a' },

  // Perennials
  { id: 'salvia-hot-lips', commonName: 'Hot Lips Salvia', botanicalName: 'Salvia microphylla', type: 'perennial', waterUse: 'low', sunExposure: 'full-sun', zones: '7-11', matureWidth: 3, matureHeight: 3, symbol: '🌸', color: '#e74c3c' },
  { id: 'agapanthus', commonName: 'Lily of the Nile', botanicalName: 'Agapanthus africanus', type: 'perennial', waterUse: 'moderate', sunExposure: 'full-sun', zones: '8-11', matureWidth: 2, matureHeight: 3, symbol: '🌸', color: '#4169e1' },
  { id: 'echinacea', commonName: 'Purple Coneflower', botanicalName: 'Echinacea purpurea', type: 'perennial', waterUse: 'moderate', sunExposure: 'full-sun', zones: '3-9', matureWidth: 2, matureHeight: 3, symbol: '🌸', color: '#da70d6' },
  { id: 'kangaroo-paw', commonName: 'Kangaroo Paw', botanicalName: 'Anigozanthos', type: 'perennial', waterUse: 'low', sunExposure: 'full-sun', zones: '9-11', matureWidth: 2, matureHeight: 3, symbol: '🌸', color: '#ff6347' },

  // Groundcovers
  { id: 'dymondia', commonName: 'Dymondia', botanicalName: 'Dymondia margaretae', type: 'groundcover', waterUse: 'low', sunExposure: 'full-sun', zones: '9-11', matureWidth: 3, matureHeight: 0.25, symbol: '🌱', color: '#7cba5c' },
  { id: 'creeping-thyme', commonName: 'Creeping Thyme', botanicalName: 'Thymus serpyllum', type: 'groundcover', waterUse: 'low', sunExposure: 'full-sun', zones: '4-9', matureWidth: 2, matureHeight: 0.25, symbol: '🌱', color: '#8fbc8f' },

  // Grasses
  { id: 'deer-grass', commonName: 'Deer Grass', botanicalName: 'Muhlenbergia rigens', type: 'grass', waterUse: 'low', sunExposure: 'full-sun', zones: '6-10', matureWidth: 4, matureHeight: 4, symbol: '🌾', color: '#bdb76b' },
  { id: 'blue-fescue', commonName: 'Blue Fescue', botanicalName: 'Festuca glauca', type: 'grass', waterUse: 'low', sunExposure: 'full-sun', zones: '4-8', matureWidth: 1, matureHeight: 1, symbol: '🌾', color: '#7ab0d4' },
  { id: 'fountain-grass', commonName: 'Fountain Grass', botanicalName: 'Pennisetum setaceum', type: 'grass', waterUse: 'low', sunExposure: 'full-sun', zones: '8-11', matureWidth: 3, matureHeight: 4, symbol: '🌾', color: '#c9a96e' },

  // Succulents
  { id: 'agave-blue', commonName: 'Blue Agave', botanicalName: 'Agave tequilana', type: 'succulent', waterUse: 'low', sunExposure: 'full-sun', zones: '9-11', matureWidth: 6, matureHeight: 5, symbol: '🪴', color: '#5f9ea0' },
  { id: 'aloe-vera', commonName: 'Aloe Vera', botanicalName: 'Aloe barbadensis', type: 'succulent', waterUse: 'low', sunExposure: 'full-sun', zones: '9-11', matureWidth: 2, matureHeight: 2, symbol: '🪴', color: '#6ab04c' },
  { id: 'aeonium', commonName: 'Aeonium', botanicalName: 'Aeonium arboreum', type: 'succulent', waterUse: 'low', sunExposure: 'partial-shade', zones: '9-11', matureWidth: 3, matureHeight: 3, symbol: '🪴', color: '#4a5a3a' },
];

export function searchPlants(query: string): Plant[] {
  const q = query.toLowerCase();
  return PLANT_DATABASE.filter(
    (p) =>
      p.commonName.toLowerCase().includes(q) ||
      p.botanicalName.toLowerCase().includes(q) ||
      p.type.includes(q) ||
      p.waterUse.includes(q) ||
      p.sunExposure.includes(q)
  );
}
