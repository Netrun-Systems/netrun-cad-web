/**
 * Import/Export toolbar — DXF import, DXF export, and PDF export.
 * Rendered as a row of buttons in the CAD toolbar area.
 */

import React, { useRef, useState, useCallback } from 'react';
import type { CADElement, Layer, DrawingState, GridSettings } from '../../engine/types';
import { importDXF } from '../../engine/dxf-import';
import { exportDXF } from '../../engine/dxf-export';
import { exportToPDF, SCALE_OPTIONS, PAGE_SIZES } from '../../engine/pdf-export';
import type { TitleBlockInfo, PDFExportOptions } from '../../engine/pdf-export';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ImportExportProps {
  elements: CADElement[];
  layers: Layer[];
  grid: GridSettings;
  onImport: (elements: CADElement[], newLayers: Layer[]) => void;
}

// ── PDF Settings Modal ────────────────────────────────────────────────────────

interface PDFModalProps {
  elements: CADElement[];
  layers: Layer[];
  grid: GridSettings;
  onClose: () => void;
}

const PDFModal: React.FC<PDFModalProps> = ({ elements, layers, grid, onClose }) => {
  const [scaleIdx, setScaleIdx] = useState(0);
  const [pageSizeIdx, setPageSizeIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [titleBlock, setTitleBlock] = useState<TitleBlockInfo>({
    projectName: '',
    drawnBy: '',
    sheetNumber: '1 of 1',
    date: new Date().toLocaleDateString(),
    scale: SCALE_OPTIONS[0].label.split(' ')[0] + ' = ' + SCALE_OPTIONS[0].label.split(' ')[2],
  });

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const opts: PDFExportOptions = {
        scaleOption: SCALE_OPTIONS[scaleIdx],
        pageSize: PAGE_SIZES[pageSizeIdx],
        titleBlock: {
          ...titleBlock,
          scale: SCALE_OPTIONS[scaleIdx].label.split('—')[0].trim(),
        },
        includeGrid: false,
      };
      await exportToPDF(elements, layers, grid, opts);
      onClose();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF export failed. Check console for details.');
    } finally {
      setGenerating(false);
    }
  }, [elements, layers, grid, scaleIdx, pageSizeIdx, titleBlock, onClose]);

  const field = (label: string, key: keyof TitleBlockInfo) => (
    <div className="flex flex-col gap-1">
      <label className="text-cad-dim text-xs">{label}</label>
      <input
        type="text"
        value={titleBlock[key]}
        onChange={(e) => setTitleBlock((prev) => ({ ...prev, [key]: e.target.value }))}
        className="bg-cad-bg border border-cad-accent rounded px-2 py-1 text-cad-text text-sm outline-none focus:border-blue-400"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-6 w-[480px] shadow-2xl">
        <h2 className="text-cad-text font-semibold text-lg mb-4">Export PDF</h2>

        {/* Scale */}
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-cad-dim text-xs">Scale</label>
          <select
            value={scaleIdx}
            onChange={(e) => setScaleIdx(Number(e.target.value))}
            className="bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none"
          >
            {SCALE_OPTIONS.map((s, i) => (
              <option key={i} value={i}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Page Size */}
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-cad-dim text-xs">Page Size</label>
          <select
            value={pageSizeIdx}
            onChange={(e) => setPageSizeIdx(Number(e.target.value))}
            className="bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none"
          >
            {PAGE_SIZES.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Title Block */}
        <div className="border border-cad-accent rounded-lg p-3 mb-4">
          <p className="text-cad-dim text-xs mb-3 uppercase tracking-wide">Title Block</p>
          <div className="grid grid-cols-2 gap-3">
            {field('Project Name', 'projectName')}
            {field('Drawn By', 'drawnBy')}
            {field('Sheet Number', 'sheetNumber')}
            {field('Date', 'date')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-cad-dim hover:text-cad-text text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {generating ? 'Generating...' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── DXF Import Scale Modal ────────────────────────────────────────────────────

interface DXFImportModalProps {
  file: File;
  onConfirm: (scale: number) => void;
  onCancel: () => void;
}

const DXFImportModal: React.FC<DXFImportModalProps> = ({ file, onConfirm, onCancel }) => {
  const [unit, setUnit] = useState<'feet' | 'inches' | 'meters'>('feet');

  const scaleForUnit = (u: string) => {
    if (u === 'inches') return 1 / 12;
    if (u === 'meters') return 3.28084;
    return 1; // feet → feet
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-6 w-[380px] shadow-2xl">
        <h2 className="text-cad-text font-semibold text-lg mb-2">Import DXF</h2>
        <p className="text-cad-dim text-sm mb-4 truncate">{file.name}</p>

        <div className="flex flex-col gap-1 mb-6">
          <label className="text-cad-dim text-xs">DXF Drawing Units</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as typeof unit)}
            className="bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none"
          >
            <option value="feet">Feet (most US landscape plans)</option>
            <option value="inches">Inches</option>
            <option value="meters">Meters</option>
          </select>
          <p className="text-cad-dim text-xs mt-1">
            This tells the importer how to scale the DXF coordinates to feet.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-cad-dim hover:text-cad-text text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(scaleForUnit(unit))}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const ImportExport: React.FC<ImportExportProps> = ({
  elements,
  layers,
  grid,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [importing, setImporting] = useState(false);

  // ── DXF Import ──────────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';
    setPendingFile(file);
  }, []);

  const handleImportConfirm = useCallback(
    async (scale: number) => {
      if (!pendingFile) return;
      setImporting(true);
      setPendingFile(null);
      try {
        const result = await importDXF(pendingFile, scale);
        onImport(result.elements, result.newLayers);
      } catch (err) {
        console.error('DXF import failed:', err);
        alert('DXF import failed. The file may be corrupt or unsupported.');
      } finally {
        setImporting(false);
      }
    },
    [pendingFile, onImport]
  );

  // ── DXF Export ──────────────────────────────────────────────────────────────

  const handleExportDXF = useCallback(() => {
    const state: DrawingState = {
      elements,
      layers,
      activeLayerId: layers[0]?.id ?? 'site',
      gridSettings: grid,
      view: { offsetX: 0, offsetY: 0, zoom: 1 },
    };
    exportDXF(state);
  }, [elements, layers, grid]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dxf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Button group */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          title="Import DXF file"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cad-surface/90 border border-cad-accent text-cad-text rounded-lg text-xs hover:bg-green-700/30 hover:border-green-500 transition-colors disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          {importing ? 'Importing...' : 'Import DXF'}
        </button>

        <button
          onClick={handleExportDXF}
          disabled={elements.length === 0}
          title="Export as DXF file"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cad-surface/90 border border-cad-accent text-cad-text rounded-lg text-xs hover:bg-blue-700/30 hover:border-blue-500 transition-colors disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Export DXF
        </button>

        <button
          onClick={() => setShowPDFModal(true)}
          disabled={elements.length === 0}
          title="Export print-ready PDF"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cad-surface/90 border border-cad-accent text-cad-text rounded-lg text-xs hover:bg-red-700/30 hover:border-red-500 transition-colors disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Export PDF
        </button>
      </div>

      {/* DXF import modal */}
      {pendingFile && (
        <DXFImportModal
          file={pendingFile}
          onConfirm={handleImportConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {/* PDF export modal */}
      {showPDFModal && (
        <PDFModal
          elements={elements}
          layers={layers}
          grid={grid}
          onClose={() => setShowPDFModal(false)}
        />
      )}
    </>
  );
};
