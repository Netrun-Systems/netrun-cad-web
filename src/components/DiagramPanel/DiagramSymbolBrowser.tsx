import React, { useState, useMemo } from 'react';
import { SYMBOL_LIBRARIES, type DiagramSymbol, type SymbolLibraryId } from '../../data/diagram-symbols';
import { getIcon } from '../../engine/diagram-icons';

interface DiagramSymbolBrowserProps {
  onPlaceSymbol: (symbol: DiagramSymbol) => void;
  onClose: () => void;
}

function ShapePreview({ symbol, size = 56 }: { symbol: DiagramSymbol; size?: number }) {
  const { shape, defaultFill, iconRef, iconColor } = symbol;
  const w = size;
  const h = size * 0.7;
  const cx = w / 2;
  const cy = h / 2;
  const fill = defaultFill ?? '#dbeafe';
  const stroke = '#1e3a8a';

  let body: React.ReactElement | null = null;
  switch (shape) {
    case 'rectangle':
      body = <rect x="2" y="2" width={w - 4} height={h - 4} fill={fill} stroke={stroke} strokeWidth="1.5" />;
      break;
    case 'rounded':
      body = <rect x="2" y="2" width={w - 4} height={h - 4} rx="6" ry="6" fill={fill} stroke={stroke} strokeWidth="1.5" />;
      break;
    case 'ellipse':
      body = <ellipse cx={cx} cy={cy} rx={(w - 4) / 2} ry={(h - 4) / 2} fill={fill} stroke={stroke} strokeWidth="1.5" />;
      break;
    case 'diamond':
      body = <polygon points={`${cx},2 ${w - 2},${cy} ${cx},${h - 2} 2,${cy}`} fill={fill} stroke={stroke} strokeWidth="1.5" />;
      break;
    case 'parallelogram':
      body = <polygon points={`${w * 0.2},2 ${w - 2},2 ${w * 0.8},${h - 2} 2,${h - 2}`} fill={fill} stroke={stroke} strokeWidth="1.5" />;
      break;
    case 'cylinder':
      body = (
        <g>
          <ellipse cx={cx} cy={6} rx={(w - 4) / 2} ry={4} fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d={`M 2 6 L 2 ${h - 6} A ${(w - 4) / 2} 4 0 0 0 ${w - 2} ${h - 6} L ${w - 2} 6`} fill={fill} stroke={stroke} strokeWidth="1.5" />
        </g>
      );
      break;
    case 'hexagon':
      body = <polygon points={`${w * 0.15},2 ${w * 0.85},2 ${w - 2},${cy} ${w * 0.85},${h - 2} ${w * 0.15},${h - 2} 2,${cy}`} fill={fill} stroke={stroke} strokeWidth="1.5" />;
      break;
  }

  // Icon overlay rendered centered
  const icon = iconRef ? getIcon(iconRef) : undefined;
  const iconSize = Math.min(w, h) * 0.55;
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2;
  const color = iconColor ?? icon?.color ?? '#1e3a8a';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {body}
      {icon && (
        <g transform={`translate(${iconX},${iconY}) scale(${iconSize / 24})`}>
          {icon.underPath && <path d={icon.underPath} fill={icon.underColor ?? `${color}55`} />}
          <path d={icon.path} fill={color} />
        </g>
      )}
    </svg>
  );
}

export const DiagramSymbolBrowser: React.FC<DiagramSymbolBrowserProps> = ({ onPlaceSymbol, onClose }) => {
  const [activeLib, setActiveLib] = useState<SymbolLibraryId>('flowchart');
  const [query, setQuery] = useState('');

  const activeSymbols = useMemo(() => {
    if (query) {
      const q = query.toLowerCase();
      return SYMBOL_LIBRARIES.flatMap((lib) => lib.symbols).filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.id.includes(q) ||
          (s.group ?? '').toLowerCase().includes(q)
      );
    }
    return SYMBOL_LIBRARIES.find((lib) => lib.id === activeLib)?.symbols ?? [];
  }, [activeLib, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DiagramSymbol[]>();
    for (const s of activeSymbols) {
      const key = s.group ?? (query ? SYMBOL_LIBRARIES.find((l) => l.id === s.library)?.label ?? 'Other' : 'Other');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return groups;
  }, [activeSymbols, query]);

  return (
    <div className="absolute top-12 right-2 w-80 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-lg z-30 shadow-xl max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cad-accent">
        <span className="text-cad-text text-sm font-medium">Symbol Libraries</span>
        <button onClick={onClose} className="text-cad-dim hover:text-cad-text text-xs">Close</button>
      </div>

      {/* Library tabs */}
      <div className="flex gap-1 px-2 pt-2 border-b border-cad-accent">
        {SYMBOL_LIBRARIES.map((lib) => (
          <button
            key={lib.id}
            onClick={() => { setActiveLib(lib.id); setQuery(''); }}
            className={`flex-1 px-2 py-1.5 rounded-t text-[11px] font-medium transition-colors ${
              !query && activeLib === lib.id
                ? 'bg-cad-accent text-white'
                : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
            }`}
            title={lib.description}
          >
            {lib.label}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-b border-cad-accent">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across all libraries..."
          className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-1 text-cad-text text-xs outline-none focus:border-cad-highlight"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {activeSymbols.length === 0 && (
          <div className="text-cad-dim text-xs px-2 py-4 text-center">No symbols match.</div>
        )}
        {[...grouped.entries()].map(([groupName, symbols]) => (
          <div key={groupName} className="mb-3">
            <div className="text-cad-dim text-[10px] uppercase tracking-wider px-1 mb-1">{groupName}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {symbols.map((s) => (
                <button
                  key={`${s.library}-${s.id}`}
                  onClick={() => onPlaceSymbol(s)}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded border border-cad-accent/40 hover:border-cad-highlight hover:bg-cad-accent/20 transition-colors"
                  title={s.description}
                >
                  <ShapePreview symbol={s} />
                  <span className="text-cad-text text-[11px] font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
