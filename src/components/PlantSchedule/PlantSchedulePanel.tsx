import React, { useMemo, useState } from 'react';
import type { CADElement } from '../../engine/types';
import { PLANT_DATABASE } from '../../data/plants';
import {
  generatePlantSchedule,
  downloadScheduleCSV,
  exportScheduleToPDF,
  type ScheduleRow,
} from '../../engine/plant-schedule';

interface PlantSchedulePanelProps {
  elements: CADElement[];
  projectName?: string;
  onClose: () => void;
}

const WATER_USE_COLOR: Record<ScheduleRow['waterUse'], string> = {
  low: 'text-green-400',
  moderate: 'text-yellow-400',
  high: 'text-red-400',
};

const TYPE_LABEL: Record<ScheduleRow['type'], string> = {
  tree: 'Tree',
  shrub: 'Shrub',
  perennial: 'Perennial',
  groundcover: 'Groundcover',
  grass: 'Grass',
  succulent: 'Succulent',
  vine: 'Vine',
};

export const PlantSchedulePanel: React.FC<PlantSchedulePanelProps> = ({
  elements,
  projectName,
  onClose,
}) => {
  const [exportingPdf, setExportingPdf] = useState(false);

  const summary = useMemo(
    () => generatePlantSchedule(elements, PLANT_DATABASE),
    [elements],
  );

  const lowPct = summary.totalPlacements > 0
    ? Math.round((summary.byWaterUse.low / summary.totalPlacements) * 100)
    : 0;

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportScheduleToPDF(summary, {
        projectName: projectName ?? 'Untitled Project',
        date: new Date().toLocaleDateString(),
      });
    } catch (err) {
      console.error('Schedule PDF export failed:', err);
      alert('PDF export failed. Check console for details.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-cad-surface border border-cad-accent rounded-xl w-[760px] max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cad-accent">
          <div>
            <h2 className="text-cad-text font-semibold text-lg">Plant Schedule</h2>
            {projectName && (
              <p className="text-cad-dim text-xs mt-0.5">{projectName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-cad-dim hover:text-cad-text text-xl leading-none px-2"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {summary.rows.length === 0 ? (
            <div className="text-cad-dim text-sm text-center py-12">
              <p className="mb-2">No plants placed yet.</p>
              <p className="text-xs">
                Open the Plant Browser, pick a species, and click on the canvas to place it.
                The schedule will populate as you build the design.
              </p>
            </div>
          ) : (
            <>
              {/* Summary chips */}
              <div className="flex items-center gap-3 mb-4 text-xs">
                <span className="text-cad-dim">
                  <span className="text-cad-text font-semibold text-base mr-1">{summary.totalPlacements}</span>
                  placements
                </span>
                <span className="text-cad-dim/60">|</span>
                <span className="text-cad-dim">
                  <span className="text-cad-text font-semibold text-base mr-1">{summary.totalSpecies}</span>
                  species
                </span>
                <span className="text-cad-dim/60">|</span>
                <span className={lowPct >= 75 ? 'text-green-400' : lowPct >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                  {lowPct}% low-water
                </span>
              </div>

              {/* Table */}
              <table className="w-full text-xs">
                <thead className="text-cad-dim uppercase tracking-wider text-[10px]">
                  <tr className="border-b border-cad-accent">
                    <th className="text-left py-2 pr-2 w-12">Qty</th>
                    <th className="text-left py-2 pr-2">Common</th>
                    <th className="text-left py-2 pr-2">Botanical</th>
                    <th className="text-left py-2 pr-2 w-20">Type</th>
                    <th className="text-left py-2 pr-2 w-16">Water</th>
                    <th className="text-left py-2 pr-2 w-20">W × H</th>
                    <th className="text-left py-2 pr-2 w-16">Zones</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr key={row.plantId} className="border-b border-cad-accent/30 hover:bg-cad-accent/10">
                      <td className="py-1.5 pr-2 text-cad-text font-mono">
                        <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ backgroundColor: row.color }} />
                        {row.count}
                      </td>
                      <td className="py-1.5 pr-2 text-cad-text">{row.commonName}</td>
                      <td className="py-1.5 pr-2 text-cad-dim italic">{row.botanicalName}</td>
                      <td className="py-1.5 pr-2 text-cad-dim">{TYPE_LABEL[row.type]}</td>
                      <td className={`py-1.5 pr-2 font-medium ${WATER_USE_COLOR[row.waterUse]}`}>
                        {row.waterUse}
                      </td>
                      <td className="py-1.5 pr-2 text-cad-dim font-mono">
                        {row.matureWidth}′ × {row.matureHeight}′
                      </td>
                      <td className="py-1.5 pr-2 text-cad-dim font-mono">{row.zones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer — actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-cad-accent">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-cad-dim hover:text-cad-text text-sm transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => downloadScheduleCSV(summary, `plant-schedule-${(projectName ?? 'project').replace(/\s+/g, '-').toLowerCase()}.csv`)}
            disabled={summary.rows.length === 0}
            className="px-3 py-1.5 bg-cad-accent text-cad-text rounded text-sm font-medium hover:bg-cad-accent/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportPdf}
            disabled={summary.rows.length === 0 || exportingPdf}
            className="px-3 py-1.5 bg-cad-highlight text-white rounded text-sm font-medium hover:bg-cad-highlight/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exportingPdf ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlantSchedulePanel;
