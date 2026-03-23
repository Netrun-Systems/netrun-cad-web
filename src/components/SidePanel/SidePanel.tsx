/**
 * SidePanel — right-side (or left-side) tool palette, Procreate/Photoshop style.
 *
 * Contains:
 *  - Mode switcher (CAD/Draw/Color/Text)
 *  - Tool settings (changes based on active mode)
 *  - Collapsible accordion sections (Layers, Plants, Interior, Survai)
 *
 * In portrait mode, collapses to a narrow icon strip (56px).
 * In landscape mode, full width (220px).
 */

import React, { useState } from 'react';
import type { Orientation } from '../../hooks/useOrientation';
import type { Handedness } from '../../hooks/useHandedness';
import type { AppMode, CADTool, DrawBrush, ColorBrush, Layer, GridSettings } from '../../engine/types';
import { COLOR_PALETTE } from '../Canvas/useColorTools';

// ── Side Panel Width Constants ────────────────────────────────────────────────

export const SIDE_PANEL_WIDTH_LANDSCAPE = 220;
export const SIDE_PANEL_WIDTH_PORTRAIT = 56;
export const SIDE_PANEL_WIDTH_COLLAPSED = 0;

// ── Props ─────────────────────────────────────────────────────────────────────

interface SidePanelProps {
  // Layout
  orientation: Orientation;
  hand: Handedness;
  collapsed: boolean;
  onToggleCollapse: () => void;

  // Mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // CAD tools
  cadTool: CADTool;
  setCadTool: (tool: CADTool) => void;
  cadStrokeColor: string;
  setCadStrokeColor: (color: string) => void;
  cadStrokeWidth: number;
  setCadStrokeWidth: (width: number) => void;
  gridEnabled: boolean;
  snapEnabled: boolean;
  toggleGrid: () => void;
  toggleSnap: () => void;

  // Draw tools
  drawBrush: DrawBrush;
  setDrawBrush: (brush: DrawBrush) => void;
  penColor: string;
  setPenColor: (color: string) => void;
  penSize: number;
  setPenSize: (size: number) => void;
  penOpacity: number;
  setPenOpacity: (opacity: number) => void;

  // Color tools
  colorBrush: ColorBrush;
  setColorBrush: (brush: ColorBrush) => void;
  colorColor: string;
  setColorColor: (color: string) => void;
  colorSize: number;
  setColorSize: (size: number) => void;
  colorOpacity: number;
  setColorOpacity: (opacity: number) => void;

  // Text
  textInput: string;
  setTextInput: (text: string) => void;

  // Layers
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onSetOpacity: (id: string, opacity: number) => void;

  // Panel toggles
  onTogglePlants: () => void;
  onToggleInterior: () => void;
  onToggleSurvai: () => void;
  showPlantPanel: boolean;
  showInteriorPanel: boolean;
  showSurvaiPanel: boolean;
  selectedPlantId: string | null;
  placingInteriorSymbol: boolean;
}

// ── Mode definitions ──────────────────────────────────────────────────────────

const MODES: { key: AppMode; label: string; shortcut: string; icon: string }[] = [
  { key: 'cad', label: 'CAD', shortcut: '1', icon: '📐' },
  { key: 'draw', label: 'Draw', shortcut: '2', icon: '✏️' },
  { key: 'color', label: 'Color', shortcut: '3', icon: '🎨' },
  { key: 'text', label: 'Text', shortcut: '4', icon: '𝐀' },
];

const CAD_TOOLS: { key: CADTool; label: string; shortcut: string }[] = [
  { key: 'select', label: 'Select', shortcut: 'V' },
  { key: 'line', label: 'Line', shortcut: 'L' },
  { key: 'rectangle', label: 'Rect', shortcut: 'R' },
  { key: 'circle', label: 'Circle', shortcut: 'C' },
  { key: 'dimension', label: 'Dim', shortcut: 'D' },
];

const LINE_COLORS = ['#ffffff', '#88ccff', '#ff9800', '#4caf50', '#e94560', '#ffeb3b'];

const DRAW_COLORS = [
  '#000000', '#333333', '#666666',
  '#1a237e', '#4a148c', '#b71c1c',
  '#1b5e20', '#e65100', '#795548',
];

const DRAW_BRUSHES: { key: DrawBrush; label: string }[] = [
  { key: 'pen', label: 'Pen' },
  { key: 'pencil', label: 'Pencil' },
  { key: 'marker', label: 'Marker' },
];

const COLOR_BRUSHES: { key: ColorBrush; label: string }[] = [
  { key: 'watercolor', label: 'Water' },
  { key: 'marker', label: 'Marker' },
  { key: 'fill', label: 'Fill' },
];

// ── Accordion section ─────────────────────────────────────────────────────────

const AccordionSection: React.FC<{
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
  isPortrait: boolean;
}> = ({ title, icon, isOpen, onToggle, badge, children, isPortrait }) => {
  if (isPortrait) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-full h-11 min-h-[44px] text-cad-dim hover:text-cad-text hover:bg-cad-accent/20 transition-colors relative"
        title={title}
      >
        <span className="text-base">{icon}</span>
        {badge && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cad-highlight" />
        )}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 min-h-[44px] text-left hover:bg-cad-accent/20 transition-colors"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-cad-text font-medium flex-1">{title}</span>
        {badge && (
          <span className="text-[10px] text-cad-highlight font-medium">{badge}</span>
        )}
        <span className="text-cad-dim text-xs">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="px-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Divider ───────────────────────────────────────────────────────────────────

const Divider: React.FC = () => (
  <div className="mx-2 my-1 h-px bg-cad-accent/50" />
);

// ── Component ─────────────────────────────────────────────────────────────────

export const SidePanel: React.FC<SidePanelProps> = ({
  orientation,
  hand,
  collapsed,
  onToggleCollapse,
  mode,
  setMode,
  cadTool,
  setCadTool,
  cadStrokeColor,
  setCadStrokeColor,
  cadStrokeWidth,
  setCadStrokeWidth,
  gridEnabled,
  snapEnabled,
  toggleGrid,
  toggleSnap,
  drawBrush,
  setDrawBrush,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  penOpacity,
  setPenOpacity,
  colorBrush,
  setColorBrush,
  colorColor,
  setColorColor,
  colorSize,
  setColorSize,
  colorOpacity,
  setColorOpacity,
  textInput,
  setTextInput,
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onSetOpacity,
  onTogglePlants,
  onToggleInterior,
  onToggleSurvai,
  showPlantPanel,
  showInteriorPanel,
  showSurvaiPanel,
  selectedPlantId,
  placingInteriorSymbol,
}) => {
  const isPortrait = orientation === 'portrait';
  const [openSection, setOpenSection] = useState<string | null>('layers');

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const panelWidth = collapsed
    ? SIDE_PANEL_WIDTH_COLLAPSED
    : isPortrait
      ? SIDE_PANEL_WIDTH_PORTRAIT
      : SIDE_PANEL_WIDTH_LANDSCAPE;

  // Positioning based on handedness — starts below top bar (40px)
  const positionStyle: React.CSSProperties = {
    [hand === 'right' ? 'right' : 'left']: 0,
    top: '40px',
    bottom: 0,
    width: `${panelWidth}px`,
    transition: 'width 200ms ease-out, transform 200ms ease-out',
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed z-30 min-w-[44px] min-h-[44px] flex items-center justify-center
                   bg-cad-surface/90 backdrop-blur-sm border border-cad-accent rounded-lg
                   text-cad-dim hover:text-cad-text hover:bg-cad-accent/30 transition-colors"
        style={{
          [hand === 'right' ? 'right' : 'left']: '8px',
          top: 'calc(40px + 50%)',
          transform: 'translateY(-50%)',
        }}
        title={`Show tool panel (${hand === 'right' ? 'left' : 'right'} side)`}
        aria-label="Show tool panel"
      >
        {hand === 'right' ? '◀' : '▶'}
      </button>
    );
  }

  const sorted = [...layers].sort((a, b) => b.order - a.order);

  return (
    <div
      className="fixed z-30 flex flex-col bg-cad-surface/95 backdrop-blur-sm overflow-hidden"
      style={{
        ...positionStyle,
        borderLeft: hand === 'right' ? '1px solid rgba(15, 52, 96, 0.8)' : 'none',
        borderRight: hand === 'left' ? '1px solid rgba(15, 52, 96, 0.8)' : 'none',
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center min-h-[36px] text-cad-dim hover:text-cad-text
                   hover:bg-cad-accent/20 transition-colors shrink-0"
        title="Hide tool panel"
        aria-label="Hide tool panel"
      >
        <span className="text-xs">
          {hand === 'right' ? '▶' : '◀'} {!isPortrait && 'Hide'}
        </span>
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* ── Mode Switcher ─────────────────────────────────────────────── */}
        <div className={`${isPortrait ? 'flex flex-col items-center gap-0.5 px-0.5 py-1' : 'grid grid-cols-2 gap-1 px-2 py-2'}`}>
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`
                flex items-center justify-center gap-1.5 rounded-lg transition-all
                min-w-[44px] min-h-[44px]
                ${isPortrait ? 'w-11 h-11' : 'px-2 py-2'}
                ${mode === m.key
                  ? 'bg-cad-highlight text-white shadow-lg shadow-cad-highlight/20'
                  : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/30'
                }
              `}
              title={`${m.label} mode (${m.shortcut})`}
              aria-label={`${m.label} mode`}
            >
              <span className={isPortrait ? 'text-base' : 'text-sm'}>{m.icon}</span>
              {!isPortrait && <span className="text-xs font-medium">{m.label}</span>}
            </button>
          ))}
        </div>

        <Divider />

        {/* ── Tool Settings (mode-specific) ─────────────────────────────── */}
        {mode === 'cad' && (
          <div className={isPortrait ? 'flex flex-col items-center gap-0.5 px-0.5 py-1' : 'px-2 py-2'}>
            {/* CAD tool buttons */}
            <div className={isPortrait ? 'flex flex-col items-center gap-0.5' : 'grid grid-cols-3 gap-1 mb-3'}>
              {CAD_TOOLS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setCadTool(t.key)}
                  className={`
                    flex items-center justify-center rounded-md transition-colors
                    min-w-[44px] min-h-[44px]
                    ${isPortrait ? 'w-11 h-11' : 'px-1 py-2'}
                    ${cadTool === t.key
                      ? 'bg-cad-accent text-white'
                      : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
                    }
                  `}
                  title={`${t.label} (${t.shortcut})`}
                  aria-label={t.label}
                >
                  <span className="text-[10px] font-medium">{isPortrait ? t.shortcut : t.label}</span>
                </button>
              ))}
            </div>

            {!isPortrait && (
              <>
                {/* Line color */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">Color</span>
                  <div className="flex flex-wrap gap-1">
                    {LINE_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCadStrokeColor(c)}
                        className={`w-6 h-6 min-w-[24px] min-h-[24px] rounded-full border-2 transition-transform ${
                          cadStrokeColor === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Stroke color ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Line width */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">
                    Width: {cadStrokeWidth}
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={cadStrokeWidth}
                    onChange={(e) => setCadStrokeWidth(Number(e.target.value))}
                    className="w-full h-1 accent-cad-highlight"
                  />
                </div>

                {/* Grid/Snap toggles */}
                <div className="flex gap-1">
                  <button
                    onClick={toggleGrid}
                    className={`flex-1 px-2 py-2 min-h-[44px] rounded-md text-xs font-medium transition-colors ${
                      gridEnabled ? 'bg-green-900/50 text-green-400' : 'text-cad-dim hover:text-cad-text'
                    }`}
                    aria-label={`Grid ${gridEnabled ? 'on' : 'off'}`}
                  >
                    Grid {gridEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={toggleSnap}
                    className={`flex-1 px-2 py-2 min-h-[44px] rounded-md text-xs font-medium transition-colors ${
                      snapEnabled ? 'bg-blue-900/50 text-blue-400' : 'text-cad-dim hover:text-cad-text'
                    }`}
                    aria-label={`Snap ${snapEnabled ? 'on' : 'off'}`}
                  >
                    Snap {snapEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'draw' && (
          <div className={isPortrait ? 'flex flex-col items-center gap-0.5 px-0.5 py-1' : 'px-2 py-2'}>
            {/* Brush type */}
            <div className={isPortrait ? 'flex flex-col items-center gap-0.5' : 'flex gap-1 mb-3'}>
              {DRAW_BRUSHES.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setDrawBrush(b.key)}
                  className={`
                    flex items-center justify-center rounded-md transition-colors
                    min-w-[44px] min-h-[44px]
                    ${isPortrait ? 'w-11 h-11' : 'flex-1 px-1 py-2'}
                    ${drawBrush === b.key
                      ? 'bg-cad-accent text-white'
                      : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
                    }
                  `}
                  aria-label={b.label}
                >
                  <span className="text-[10px] font-medium">{isPortrait ? b.label[0] : b.label}</span>
                </button>
              ))}
            </div>

            {!isPortrait && (
              <>
                {/* Colors */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">Color</span>
                  <div className="flex flex-wrap gap-1">
                    {DRAW_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        className={`w-6 h-6 min-w-[24px] min-h-[24px] rounded-full border-2 transition-transform ${
                          penColor === c ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Pen color ${c}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      title="Custom color"
                    />
                  </div>
                </div>

                {/* Size */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">
                    Size: {penSize}
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={penSize}
                    onChange={(e) => setPenSize(Number(e.target.value))}
                    className="w-full h-1 accent-cad-highlight"
                  />
                </div>

                {/* Opacity */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">
                    Opacity: {(penOpacity * 100).toFixed(0)}%
                  </span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={penOpacity * 100}
                    onChange={(e) => setPenOpacity(Number(e.target.value) / 100)}
                    className="w-full h-1 accent-cad-highlight"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'color' && (
          <div className={isPortrait ? 'flex flex-col items-center gap-0.5 px-0.5 py-1' : 'px-2 py-2'}>
            {/* Brush type */}
            <div className={isPortrait ? 'flex flex-col items-center gap-0.5' : 'flex gap-1 mb-3'}>
              {COLOR_BRUSHES.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setColorBrush(b.key)}
                  className={`
                    flex items-center justify-center rounded-md transition-colors
                    min-w-[44px] min-h-[44px]
                    ${isPortrait ? 'w-11 h-11' : 'flex-1 px-1 py-2'}
                    ${colorBrush === b.key
                      ? 'bg-cad-accent text-white'
                      : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
                    }
                  `}
                  aria-label={b.label}
                >
                  <span className="text-[10px] font-medium">{isPortrait ? b.label[0] : b.label}</span>
                </button>
              ))}
            </div>

            {!isPortrait && (
              <>
                {/* Color palette */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">Palette</span>
                  <div className="flex flex-wrap gap-0.5">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColorColor(c)}
                        className={`w-5 h-5 min-w-[20px] min-h-[20px] rounded-sm border transition-transform ${
                          colorColor === c ? 'border-white scale-125 z-10' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={colorColor}
                      onChange={(e) => setColorColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                      title="Custom color"
                    />
                  </div>
                </div>

                {/* Size */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">
                    Size: {colorSize}
                  </span>
                  <input
                    type="range"
                    min="4"
                    max="60"
                    value={colorSize}
                    onChange={(e) => setColorSize(Number(e.target.value))}
                    className="w-full h-1 accent-cad-highlight"
                  />
                </div>

                {/* Opacity */}
                <div className="mb-3">
                  <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">
                    Opacity: {(colorOpacity * 100).toFixed(0)}%
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={colorOpacity * 100}
                    onChange={(e) => setColorOpacity(Number(e.target.value) / 100)}
                    className="w-full h-1 accent-cad-highlight"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'text' && !isPortrait && (
          <div className="px-2 py-2">
            <span className="text-cad-dim text-[10px] uppercase tracking-wider block mb-1">Text</span>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type text..."
              className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-2 text-cad-text text-xs outline-none focus:border-blue-400 min-h-[44px]"
            />
            <p className="text-cad-dim text-[10px] mt-1">Click canvas to place</p>
          </div>
        )}

        <Divider />

        {/* ── Accordion Sections ─────────────────────────────────────────── */}

        {/* Layers */}
        <AccordionSection
          title="Layers"
          icon="📑"
          isOpen={openSection === 'layers'}
          onToggle={() => toggleSection('layers')}
          isPortrait={isPortrait}
        >
          <div className="max-h-48 overflow-y-auto">
            {sorted.map((layer) => (
              <div
                key={layer.id}
                className={`flex items-center gap-1.5 px-1.5 py-1 cursor-pointer transition-colors rounded ${
                  activeLayerId === layer.id
                    ? 'bg-cad-accent/30'
                    : 'hover:bg-cad-accent/10'
                }`}
                onClick={() => onSelectLayer(layer.id)}
              >
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="text-cad-text text-[10px] flex-1 truncate">
                  {layer.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                  className={`min-w-[24px] min-h-[24px] flex items-center justify-center text-[10px] rounded ${
                    layer.visible ? 'text-green-400' : 'text-red-400'
                  }`}
                  title={layer.visible ? 'Hide' : 'Show'}
                  aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name} layer`}
                >
                  {layer.visible ? 'V' : 'H'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                  className={`min-w-[24px] min-h-[24px] flex items-center justify-center text-[10px] rounded ${
                    layer.locked ? 'text-yellow-400' : 'text-cad-dim'
                  }`}
                  title={layer.locked ? 'Unlock' : 'Lock'}
                  aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name} layer`}
                >
                  {layer.locked ? 'L' : 'U'}
                </button>
              </div>
            ))}
          </div>
        </AccordionSection>

        {/* Plants */}
        <AccordionSection
          title="Plants"
          icon="🌿"
          isOpen={showPlantPanel}
          onToggle={onTogglePlants}
          badge={selectedPlantId ? 'placing' : undefined}
          isPortrait={isPortrait}
        >
          <p className="text-cad-dim text-[10px]">Plant browser opens as overlay</p>
        </AccordionSection>

        {/* Interior */}
        <AccordionSection
          title="Interior"
          icon="🪑"
          isOpen={showInteriorPanel}
          onToggle={onToggleInterior}
          badge={placingInteriorSymbol ? 'placing' : undefined}
          isPortrait={isPortrait}
        >
          <p className="text-cad-dim text-[10px]">Interior panel opens as overlay</p>
        </AccordionSection>

        {/* Survai */}
        <AccordionSection
          title="Survai"
          icon="☁️"
          isOpen={showSurvaiPanel}
          onToggle={onToggleSurvai}
          isPortrait={isPortrait}
        >
          <p className="text-cad-dim text-[10px]">Survai panel opens as overlay</p>
        </AccordionSection>
      </div>
    </div>
  );
};
