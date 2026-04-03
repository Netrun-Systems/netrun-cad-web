import { useState, useMemo } from 'react';
import type { UtilityType, Material } from '../../engine/route-types';
import { UTILITY_COLORS } from '../../engine/route-types';

interface MaterialSelectorProps {
  utilityType: UtilityType;
  onSelect: (material: Material) => void;
  isOpen: boolean;
  onClose: () => void;
}

const MOCK_MATERIALS: Material[] = [
  // Electrical
  { id: 'mat-e1', name: '14/2 Romex NM-B Wire', category: 'Wire', utilityType: 'electrical', unit: 'ft', pricePerUnit: 0.45, specs: { gauge: '14 AWG', conductors: '2 + ground', rating: '15A' } },
  { id: 'mat-e2', name: '12/2 Romex NM-B Wire', category: 'Wire', utilityType: 'electrical', unit: 'ft', pricePerUnit: 0.65, specs: { gauge: '12 AWG', conductors: '2 + ground', rating: '20A' } },
  { id: 'mat-e3', name: '3/4" EMT Conduit', category: 'Conduit', utilityType: 'electrical', unit: 'ft', pricePerUnit: 1.20, specs: { diameter: '3/4"', material: 'Steel', type: 'EMT' } },
  { id: 'mat-e4', name: '1" EMT Conduit', category: 'Conduit', utilityType: 'electrical', unit: 'ft', pricePerUnit: 1.85, specs: { diameter: '1"', material: 'Steel', type: 'EMT' } },

  // Plumbing
  { id: 'mat-p1', name: '1/2" Copper Pipe Type L', category: 'Pipe', utilityType: 'plumbing', unit: 'ft', pricePerUnit: 3.50, specs: { diameter: '1/2"', material: 'Copper', type: 'Type L' } },
  { id: 'mat-p2', name: '3/4" Copper Pipe Type L', category: 'Pipe', utilityType: 'plumbing', unit: 'ft', pricePerUnit: 5.25, specs: { diameter: '3/4"', material: 'Copper', type: 'Type L' } },
  { id: 'mat-p3', name: '2" PVC Pipe Schedule 40', category: 'Pipe', utilityType: 'plumbing', unit: 'ft', pricePerUnit: 1.80, specs: { diameter: '2"', material: 'PVC', schedule: '40' } },
  { id: 'mat-p4', name: '3/4" PEX Tubing', category: 'Tubing', utilityType: 'plumbing', unit: 'ft', pricePerUnit: 1.10, specs: { diameter: '3/4"', material: 'PEX-A', rating: '200 PSI' } },

  // HVAC
  { id: 'mat-h1', name: '6" Flex Duct Insulated', category: 'Ductwork', utilityType: 'hvac', unit: 'ft', pricePerUnit: 2.75, specs: { diameter: '6"', insulation: 'R-6', type: 'Flexible' } },
  { id: 'mat-h2', name: '8" Rigid Sheet Metal Duct', category: 'Ductwork', utilityType: 'hvac', unit: 'ft', pricePerUnit: 6.50, specs: { diameter: '8"', gauge: '26 ga', material: 'Galvanized' } },
  { id: 'mat-h3', name: '3/4" Copper Refrigerant Line', category: 'Refrigerant', utilityType: 'hvac', unit: 'ft', pricePerUnit: 4.20, specs: { diameter: '3/4"', material: 'Copper ACR', insulated: 'Yes' } },
  { id: 'mat-h4', name: '3/4" PVC Condensate Drain', category: 'Drain', utilityType: 'hvac', unit: 'ft', pricePerUnit: 0.95, specs: { diameter: '3/4"', material: 'PVC', schedule: '40' } },

  // Low Voltage
  { id: 'mat-lv1', name: 'Cat6 Ethernet Cable', category: 'Data', utilityType: 'low_voltage', unit: 'ft', pricePerUnit: 0.35, specs: { category: 'Cat6', type: 'UTP', rating: '550 MHz' } },
  { id: 'mat-lv2', name: 'Cat6A Shielded Cable', category: 'Data', utilityType: 'low_voltage', unit: 'ft', pricePerUnit: 0.65, specs: { category: 'Cat6A', type: 'STP', rating: '500 MHz' } },
  { id: 'mat-lv3', name: 'RG6 Coaxial Cable', category: 'Coax', utilityType: 'low_voltage', unit: 'ft', pricePerUnit: 0.28, specs: { type: 'RG6', impedance: '75 ohm', shield: 'Quad' } },
  { id: 'mat-lv4', name: '18/2 Thermostat Wire', category: 'Control', utilityType: 'low_voltage', unit: 'ft', pricePerUnit: 0.18, specs: { gauge: '18 AWG', conductors: '2', type: 'CL2' } },
];

export default function MaterialSelector({
  utilityType,
  onSelect,
  isOpen,
  onClose,
}: MaterialSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const byType = MOCK_MATERIALS.filter((m) => m.utilityType === utilityType);
    if (!search.trim()) return byType;
    const q = search.toLowerCase();
    return byType.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [utilityType, search]);

  const categories = useMemo(() => {
    return Array.from(new Set(filtered.map((m) => m.category)));
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: UTILITY_COLORS[utilityType] }}
            />
            <h3 className="text-sm font-semibold text-gray-100">
              Select Material
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-800">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="w-full px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500"
            autoFocus
          />
        </div>

        {/* Materials list */}
        <div className="flex-1 overflow-y-auto">
          {categories.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No materials found
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat}>
                <div className="px-4 py-1.5 bg-gray-850 text-[10px] font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-900">
                  {cat}
                </div>
                {filtered
                  .filter((m) => m.category === cat)
                  .map((material) => (
                    <button
                      key={material.id}
                      onClick={() => {
                        onSelect(material);
                        onClose();
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-800 transition-colors border-b border-gray-800/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-200 font-medium">
                          {material.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          ${material.pricePerUnit.toFixed(2)}/{material.unit}
                        </span>
                      </div>
                      {material.specs && (
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {Object.entries(material.specs)
                            .slice(0, 3)
                            .map(([key, val]) => (
                              <span
                                key={key}
                                className="text-[10px] text-gray-500"
                              >
                                {key}: {val}
                              </span>
                            ))}
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 text-[10px] text-gray-500 text-center">
          {filtered.length} materials available
        </div>
      </div>
    </div>
  );
}
