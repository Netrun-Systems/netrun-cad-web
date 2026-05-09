import React, { useState, useMemo, useCallback } from 'react';
import type { CADElement } from '../../engine/types';
import { importMermaid, exportMermaid, MermaidParseError } from '../../engine/mermaid';

const SAMPLE = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
  C --> E((End))
  D --> E
`;

interface MermaidIOModalProps {
  elements: CADElement[];
  onImport: (elements: CADElement[]) => void;
  onClose: () => void;
}

export const MermaidIOModal: React.FC<MermaidIOModalProps> = ({ elements, onImport, onClose }) => {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [source, setSource] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const exported = useMemo(() => {
    try {
      return exportMermaid(elements);
    } catch (e) {
      return `%% Export failed: ${(e as Error).message}\ngraph TD\n`;
    }
  }, [elements]);

  const handleImport = useCallback(() => {
    setError(null);
    try {
      const result = importMermaid(source, { origin: { x: 100, y: 100 } });
      if (result.elements.length === 0) {
        setError('No nodes or edges found in source.');
        return;
      }
      onImport(result.elements);
      onClose();
    } catch (e) {
      const err = e as Error;
      if (e instanceof MermaidParseError) {
        setError(err.message);
      } else {
        setError(err.message ?? String(e));
      }
    }
  }, [source, onImport, onClose]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setError('Clipboard access denied.');
    }
  }, [exported]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-5 w-[640px] max-w-[92vw] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-cad-text font-semibold text-lg">Mermaid Diagrams</h2>
          <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-sm">Close</button>
        </div>

        <div className="flex gap-1 mb-3">
          <button
            onClick={() => { setTab('import'); setError(null); }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === 'import' ? 'bg-cad-accent text-white' : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
            }`}
          >
            Import (text → diagram)
          </button>
          <button
            onClick={() => { setTab('export'); setError(null); }}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === 'export' ? 'bg-cad-accent text-white' : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
            }`}
          >
            Export (diagram → text)
          </button>
        </div>

        {tab === 'import' && (
          <>
            <p className="text-cad-dim text-xs mb-2">
              Paste a Mermaid <code className="text-cad-text">graph</code> or <code className="text-cad-text">flowchart</code> definition.
              Supported: TD/TB/LR/RL/BT, node shapes (<code>[]</code>, <code>()</code>, <code>(())</code>, <code>{'{}'}</code>, <code>[()]</code>, <code>{'{{}}'}</code>, <code>[/.../]</code>),
              edges (<code>--&gt;</code>, <code>-.-&gt;</code>, <code>==&gt;</code>, with <code>|labels|</code>), and <code>subgraph</code> blocks.
            </p>
            <textarea
              value={source}
              onChange={(e) => { setSource(e.target.value); setError(null); }}
              spellCheck={false}
              className="w-full h-72 bg-cad-bg border border-cad-accent rounded p-3 text-cad-text text-sm font-mono outline-none focus:border-blue-400 resize-none"
              placeholder="graph TD&#10;  A --> B"
            />
            {error && (
              <div className="mt-2 text-red-400 text-xs">{error}</div>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => { setSource(SAMPLE); setError(null); }}
                className="px-3 py-1.5 text-cad-dim hover:text-cad-text text-xs transition-colors"
              >
                Reset to sample
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
              >
                Add to Canvas
              </button>
            </div>
          </>
        )}

        {tab === 'export' && (
          <>
            <p className="text-cad-dim text-xs mb-2">
              Mermaid representation of the current diagram (flowchart shapes, connectors, and group/swimlane containers).
              Updates live as you edit the canvas.
            </p>
            <textarea
              value={exported}
              readOnly
              spellCheck={false}
              className="w-full h-72 bg-cad-bg border border-cad-accent rounded p-3 text-cad-text text-sm font-mono outline-none resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={handleCopy}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors"
              >
                {copyStatus === 'copied' ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
