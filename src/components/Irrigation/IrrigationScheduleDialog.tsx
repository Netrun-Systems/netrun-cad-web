import React, { useMemo } from 'react';
import type { CADElement } from '../../engine/types';
import { generateIrrigationSchedule, IRRIGATION_HEADS } from '../../data/irrigation';

interface IrrigationScheduleDialogProps {
  elements: CADElement[];
  projectName?: string;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  rotor: 'Rotor', spray: 'Spray', drip: 'Drip', bubbler: 'Bubbler',
};

export const IrrigationScheduleDialog: React.FC<IrrigationScheduleDialogProps> = ({
  elements, projectName, onClose,
}) => {
  const summary = useMemo(() => generateIrrigationSchedule(elements), [elements]);

  // Residential 3/4" service typically delivers 8-15 GPM. Flag zones
  // that exceed 12 GPM as a warning — they may need to be split.
  const overCapacityZones = summary.rows.filter((r) => r.totalGpm > 12);

  const downloadCSV = () => {
    const header = ['Zone', 'Heads', ...IRRIGATION_HEADS.map((h) => TYPE_LABELS[h.type]), 'Total GPM'].join(',');
    const lines = summary.rows.map((r) => [
      r.zoneId,
      r.headCount,
      ...IRRIGATION_HEADS.map((h) => r.byType[h.type] ?? 0),
      r.totalGpm.toFixed(1),
    ].join(','));
    const csv = [
      header,
      ...lines,
      '',
      `# Total heads: ${summary.totalHeads}`,
      `# Total GPM (sum across zones): ${summary.totalGpm.toFixed(1)}`,
      `# Peak zone GPM: ${summary.peakZoneGpm.toFixed(1)}`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `irrigation-schedule-${(projectName ?? 'project').replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-cad-surface border border-cad-accent rounded-xl w-[640px] max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-cad-accent">
          <div>
            <h2 className="text-cad-text font-semibold text-lg">Irrigation Schedule</h2>
            {projectName && <p className="text-cad-dim text-xs mt-0.5">{projectName}</p>}
          </div>
          <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-xl leading-none px-2">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {summary.rows.length === 0 ? (
            <div className="text-cad-dim text-sm text-center py-12">
              <p className="mb-2">No irrigation heads placed yet.</p>
              <p className="text-xs">
                Open the Irrigation panel, pick a head type + zone, then click on the canvas to place heads.
                Coverage circles render at 20% opacity in the zone color so you can verify uniform coverage.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 text-xs">
                <span className="text-cad-dim">
                  <span className="text-cad-text font-semibold text-base mr-1">{summary.totalHeads}</span>heads
                </span>
                <span className="text-cad-dim/60">|</span>
                <span className="text-cad-dim">
                  <span className="text-cad-text font-semibold text-base mr-1">{summary.rows.length}</span>zones
                </span>
                <span className="text-cad-dim/60">|</span>
                <span className={summary.peakZoneGpm > 12 ? 'text-red-400' : summary.peakZoneGpm > 8 ? 'text-yellow-400' : 'text-green-400'}>
                  Peak {summary.peakZoneGpm.toFixed(1)} GPM
                </span>
              </div>

              <table className="w-full text-xs">
                <thead className="text-cad-dim uppercase tracking-wider text-[10px]">
                  <tr className="border-b border-cad-accent">
                    <th className="text-left py-2 pr-2 w-14">Zone</th>
                    <th className="text-left py-2 pr-2 w-14">Heads</th>
                    {IRRIGATION_HEADS.map((h) => (
                      <th key={h.type} className="text-right py-2 pr-2 w-16">{TYPE_LABELS[h.type]}</th>
                    ))}
                    <th className="text-right py-2 pr-2 w-20">GPM</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((row) => (
                    <tr key={row.zoneId} className="border-b border-cad-accent/30 hover:bg-cad-accent/10">
                      <td className="py-1.5 pr-2">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold"
                          style={{ backgroundColor: row.color }}
                        >{row.zoneId}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-cad-text font-mono">{row.headCount}</td>
                      {IRRIGATION_HEADS.map((h) => (
                        <td key={h.type} className="py-1.5 pr-2 text-cad-dim font-mono text-right">
                          {row.byType[h.type] ?? '—'}
                        </td>
                      ))}
                      <td className={`py-1.5 pr-2 font-mono text-right font-semibold ${row.totalGpm > 12 ? 'text-red-400' : row.totalGpm > 8 ? 'text-yellow-400' : 'text-cad-text'}`}>
                        {row.totalGpm.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {overCapacityZones.length > 0 && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-xs text-red-300">
                  <strong>⚠ Zone capacity warning:</strong> Zones {overCapacityZones.map((r) => r.zoneId).join(', ')} exceed 12 GPM. A typical residential 3/4&quot; service line delivers 8-15 GPM peak. Consider splitting these zones or selecting lower-flow heads.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-cad-accent">
          <button onClick={onClose} className="px-3 py-1.5 text-cad-dim hover:text-cad-text text-sm transition-colors">Close</button>
          <button
            onClick={downloadCSV}
            disabled={summary.rows.length === 0}
            className="px-3 py-1.5 bg-cad-highlight text-white rounded text-sm font-medium hover:bg-cad-highlight/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default IrrigationScheduleDialog;
