import React, { useState, useEffect, useCallback, useRef } from 'react';
import { COMMANDS } from '../../engine/commands';

// ─── Tab types ────────────────────────────────────────────────────────────────
type HelpTab =
  | 'quickstart'
  | 'shortcuts'
  | 'tools'
  | 'plants'
  | 'importexport'
  | 'about';

interface TabDef {
  id: HelpTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'quickstart',    label: 'Quick Start' },
  { id: 'shortcuts',     label: 'Keyboard Shortcuts' },
  { id: 'tools',         label: 'Tools Reference' },
  { id: 'plants',        label: 'Plant Database' },
  { id: 'importexport',  label: 'Import / Export' },
  { id: 'about',         label: 'About' },
];

// ─── Command category display config ─────────────────────────────────────────
const CATEGORY_ORDER: Array<{ key: string; label: string }> = [
  { key: 'draw',      label: 'Draw' },
  { key: 'modify',    label: 'Modify' },
  { key: 'edit',      label: 'Edit' },
  { key: 'display',   label: 'Display / View' },
  { key: 'layer',     label: 'Layer' },
  { key: 'dimension', label: 'Dimension' },
  { key: 'text',      label: 'Text' },
  { key: 'snap',      label: 'Snap / Settings' },
  { key: 'file',      label: 'File' },
  { key: 'block',     label: 'Block / Insert' },
  { key: 'landscape', label: 'Landscape (Netrun)' },
];

// ─── Searchable content index ─────────────────────────────────────────────────
// Each entry: { tab, text } — used for cross-tab search
const buildSearchIndex = (): Array<{ tab: HelpTab; text: string }> => {
  const index: Array<{ tab: HelpTab; text: string }> = [];

  // Commands tab
  for (const cmd of COMMANDS) {
    index.push({
      tab: 'shortcuts',
      text: `${cmd.aliases.join(' ')} ${cmd.description} ${cmd.category}`,
    });
  }

  // Static text — quick start
  index.push({ tab: 'quickstart', text: 'quick start cad mode draw mode color mode text mode modes overview line rectangle circle dimension select scan blueprint compare deviation route mep' });
  index.push({ tab: 'quickstart', text: 'save open project google drive how to upload scan import blueprint export report construction workflow' });

  // Tools
  index.push({ tab: 'tools', text: 'cad tools line rectangle circle dimension select draw mode pen brush watercolor marker color mode text font' });
  index.push({ tab: 'plants', text: 'plant database wucols water use vl l m h sun deer fire icon search place landscape' });
  index.push({ tab: 'importexport', text: 'dxf import export pdf gis geojson kml satellite kiri scan obj ply google drive auto-save share' });
  index.push({ tab: 'about', text: 'netrun cad version built by netrun systems ojai california open source gplv2 mit github allie' });

  return index;
};

const SEARCH_INDEX = buildSearchIndex();

// ─── Props ────────────────────────────────────────────────────────────────────
interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const HelpPanel: React.FC<HelpPanelProps> = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('quickstart');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  // Derive which tabs match a search query
  const matchingTabs = useCallback(
    (q: string): Set<HelpTab> => {
      if (!q) return new Set(TABS.map((t) => t.id));
      const lower = q.toLowerCase();
      const result = new Set<HelpTab>();
      for (const entry of SEARCH_INDEX) {
        if (entry.text.toLowerCase().includes(lower)) {
          result.add(entry.tab);
        }
      }
      return result;
    },
    []
  );

  const visibleTabs = matchingTabs(search);

  // Auto-switch to first matching tab when search changes
  useEffect(() => {
    if (search && !visibleTabs.has(activeTab)) {
      const first = TABS.find((t) => visibleTabs.has(t.id));
      if (first) setActiveTab(first.id);
    }
  }, [search, visibleTabs, activeTab]);

  // ── Shortcut filter helper ─────────────────────────────────────────────────
  const filteredCommands = (categoryKey: string) => {
    const cmds = COMMANDS.filter((c) => c.category === categoryKey);
    if (!search) return cmds;
    const lower = search.toLowerCase();
    return cmds.filter(
      (c) =>
        c.aliases.some((a) => a.includes(lower)) ||
        c.description.toLowerCase().includes(lower)
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.35)' }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: '400px',
          background: '#14141f',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.1rem' }}>?</span>
            <span className="font-semibold text-white text-sm tracking-wide">
              Help &amp; Reference
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg leading-none px-1"
            aria-label="Close help panel"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help..."
            className="w-full bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none border-b border-gray-700 pb-1 focus:border-gray-400 transition-colors"
          />
        </div>

        {/* Tab bar */}
        <div
          className="flex shrink-0 overflow-x-auto"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {TABS.filter((t) => !search || visibleTabs.has(t.id)).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 py-2 text-xs whitespace-nowrap transition-colors shrink-0"
              style={{
                color: activeTab === tab.id ? '#a78bfa' : 'rgba(155,155,175,0.7)',
                borderBottom: activeTab === tab.id ? '2px solid #a78bfa' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          {activeTab === 'quickstart' && <QuickStartTab search={search} />}
          {activeTab === 'shortcuts' && (
            <ShortcutsTab search={search} filteredCommands={filteredCommands} />
          )}
          {activeTab === 'tools' && <ToolsTab search={search} />}
          {activeTab === 'plants' && <PlantsTab search={search} />}
          {activeTab === 'importexport' && <ImportExportTab search={search} />}
          {activeTab === 'about' && <AboutTab />}
        </div>
      </div>
    </>
  );
};

// ─── Section heading ──────────────────────────────────────────────────────────
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3
    className="text-xs font-semibold uppercase tracking-wider mb-2 mt-5 first:mt-0"
    style={{ color: '#a78bfa' }}
  >
    {children}
  </h3>
);

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-gray-400 text-xs leading-relaxed mb-2">{children}</p>
);

const Step: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <div className="flex gap-2 mb-2">
    <span
      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
      style={{ background: '#3b1d8a', color: '#a78bfa' }}
    >
      {n}
    </span>
    <span className="text-gray-400 text-xs leading-relaxed">{children}</span>
  </div>
);

const KbdCell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code
    className="text-xs px-1.5 py-0.5 rounded font-mono"
    style={{ background: '#1e1e2e', color: '#e2e8f0', border: '1px solid #3b3b5a' }}
  >
    {children}
  </code>
);

// ─── Quick Start Tab ──────────────────────────────────────────────────────────
const QuickStartTab: React.FC<{ search: string }> = () => (
  <div>
    <SectionHeading>Construction Workflow</SectionHeading>

    <Step n={1}>
      <strong className="text-gray-300">Upload a Scan</strong> — Tap the scan icon to upload a 3D scan from KIRI Engine (OBJ/PLY). Survai's ML detects electrical outlets, pipes, HVAC, and more.
    </Step>
    <Step n={2}>
      <strong className="text-gray-300">Import Your Blueprint</strong> — Type <KbdCell>BP</KbdCell> in the command line or use the menu to upload a DXF/DWG blueprint. It appears as a locked reference layer.
    </Step>
    <Step n={3}>
      <strong className="text-gray-300">Run Comparison</strong> — Hit Compare to find deviations between your plans and reality. Color-coded markers show what's different.
    </Step>
    <Step n={4}>
      <strong className="text-gray-300">Export Report</strong> — Export the deviation report as DXF for AutoCAD, or PDF for your project files.
    </Step>
    <Step n={5}>
      <strong className="text-gray-300">Draw Routes</strong> — Switch to Route mode (type <KbdCell>RT</KbdCell>) to plan MEP routes with material cost estimation.
    </Step>

    <SectionHeading>4 Modes Overview</SectionHeading>
    <div className="space-y-2 mb-4">
      {[
        { icon: '📐', name: 'CAD Mode', key: '1', desc: 'Precise lines, rectangles, circles, dimensions. Snap-to-grid. Measured in feet.' },
        { icon: '✏️', name: 'Draw Mode', key: '2', desc: 'Apple Pencil freehand sketching — pressure-sensitive ink on top of CAD layers.' },
        { icon: '🎨', name: 'Color Mode', key: '3', desc: 'Watercolor and marker brushes. Press lightly for transparent washes.' },
        { icon: 'T', name: 'Text Mode', key: '4', desc: 'Place typed text or architect-style annotations anywhere on the plan.' },
      ].map((m) => (
        <div
          key={m.name}
          className="flex gap-3 rounded-lg p-2"
          style={{ background: '#1e1e2e' }}
        >
          <span className="text-lg w-6 text-center shrink-0">{m.icon}</span>
          <div>
            <div className="text-white text-xs font-medium mb-0.5">
              {m.name} <KbdCell>{m.key}</KbdCell>
            </div>
            <div className="text-gray-500 text-xs">{m.desc}</div>
          </div>
        </div>
      ))}
    </div>

    <SectionHeading>Keyboard Shortcuts</SectionHeading>
    <div className="space-y-1 mb-4">
      {[
        ['V / L / R / C / D', 'Select / Line / Rect / Circle / Dim'],
        ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / Redo'],
        ['Esc', 'Cancel current operation'],
        ['F7 / G', 'Toggle grid'],
        ['F8', 'Toggle ortho mode'],
      ].map(([key, desc]) => (
        <div key={key} className="flex justify-between text-xs">
          <KbdCell>{key}</KbdCell>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>

    <SectionHeading>How to Save / Open Projects</SectionHeading>
    <Para>Your drawing auto-saves locally every 5 seconds — no button needed.</Para>
    <Para>
      For cloud save, click the <strong className="text-gray-300">Google Drive</strong> button in the
      top toolbar. Sign in once and your projects save to Drive automatically.
    </Para>
    <Para>To open a saved project: click the folder icon in the ProjectBar and pick from the list.</Para>

    <SectionHeading>Common Gestures (iPad)</SectionHeading>
    <div className="space-y-1">
      {[
        ['Pinch', 'Zoom in / out'],
        ['Two-finger drag', 'Pan the view'],
        ['Long-press', 'Right-click context menu'],
        ['Apple Pencil', 'Draw or place elements'],
      ].map(([gesture, desc]) => (
        <div key={gesture} className="flex justify-between text-xs">
          <span className="text-gray-300">{gesture}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Shortcuts Tab ────────────────────────────────────────────────────────────
const ShortcutsTab: React.FC<{
  search: string;
  filteredCommands: (cat: string) => typeof COMMANDS;
}> = ({ filteredCommands }) => (
  <div>
    <Para>
      Type any alias in the command line at the bottom and press Enter, or press the
      key directly while the canvas is focused (AutoCAD behavior).
    </Para>

    {/* Built-in keyboard shortcuts */}
    <SectionHeading>Built-in Keyboard Shortcuts</SectionHeading>
    <table className="w-full text-xs mb-4">
      <tbody>
        {[
          ['1 / 2 / 3 / 4', 'Switch modes (CAD / Draw / Color / Text)'],
          ['Enter', 'Focus command line / repeat last command'],
          ['Escape', 'Cancel current operation'],
          ['Ctrl+Z', 'Undo'],
          ['Ctrl+Shift+Z', 'Redo'],
          ['Delete / Backspace', 'Remove last element'],
          ['Ctrl+0', 'Reset view (zoom to fit)'],
          ['F7', 'Toggle grid'],
          ['F8', 'Toggle ortho mode'],
          ['F2 / F3', 'Toggle snap'],
          ['G (CAD mode)', 'Toggle grid'],
          ['S (CAD mode)', 'Toggle snap'],
          ['V / L / R / C / D', 'Select / Line / Rect / Circle / Dim (CAD mode)'],
          ['? (command line)', 'Show command help'],
        ].map(([key, desc]) => (
          <tr key={key}>
            <td className="pr-3 pb-1.5 align-top whitespace-nowrap">
              <KbdCell>{key}</KbdCell>
            </td>
            <td className="pb-1.5 text-gray-400 align-top">{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>

    {/* AutoCAD command aliases by category */}
    {CATEGORY_ORDER.map(({ key, label }) => {
      const cmds = filteredCommands(key);
      if (cmds.length === 0) return null;
      return (
        <div key={key}>
          <SectionHeading>{label}</SectionHeading>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr style={{ color: 'rgba(155,155,175,0.5)' }}>
                <th className="text-left pb-1 font-normal w-28">Alias(es)</th>
                <th className="text-left pb-1 font-normal">Description</th>
              </tr>
            </thead>
            <tbody>
              {cmds.map((cmd) => (
                <tr key={cmd.action}>
                  <td className="pr-3 pb-1 align-top whitespace-nowrap">
                    <KbdCell>{cmd.aliases.slice(0, 2).join(' / ').toUpperCase()}</KbdCell>
                  </td>
                  <td className="pb-1 text-gray-400 align-top">{cmd.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    })}
  </div>
);

// ─── Tools Reference Tab ──────────────────────────────────────────────────────
const ToolsTab: React.FC<{ search: string }> = () => (
  <div>
    <SectionHeading>CAD Mode Tools</SectionHeading>
    <div className="space-y-2 mb-4">
      {[
        { name: 'Line', alias: 'L', desc: 'Click two points. Shows length in feet as you draw. Keep clicking to chain lines.' },
        { name: 'Rectangle', alias: 'R', desc: 'Click two corners. Diagonal snaps to grid.' },
        { name: 'Circle', alias: 'C', desc: 'Click center, then drag to radius. Shows diameter.' },
        { name: 'Dimension', alias: 'D', desc: 'Click two points to annotate a distance. Text auto-scales.' },
        { name: 'Select / Pan', alias: 'V', desc: 'Drag to pan the view. Click elements to select (future: property editing).' },
      ].map((t) => (
        <div key={t.name} className="rounded p-2" style={{ background: '#1e1e2e' }}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white text-xs font-medium">{t.name}</span>
            <KbdCell>{t.alias}</KbdCell>
          </div>
          <p className="text-gray-500 text-xs">{t.desc}</p>
        </div>
      ))}
    </div>

    <SectionHeading>Draw Mode</SectionHeading>
    <div className="space-y-1 mb-4">
      {[
        ['Pen', 'Fine pressure-sensitive ink. Great for architectural linework.'],
        ['Brush', 'Softer stroke with tapered ends. For sketching planting areas.'],
        ['Marker', 'Bold constant-width stroke. For callouts and labels.'],
        ['Highlighter', 'Wide semi-transparent stroke. For marking zones.'],
      ].map(([name, desc]) => (
        <div key={name} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-20 shrink-0">{name}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>
    <Para>Pen size and opacity are adjustable in the Draw toolbar. Pressure from Apple Pencil controls both width and opacity automatically.</Para>

    <SectionHeading>Color Mode</SectionHeading>
    <div className="space-y-1 mb-4">
      {[
        ['Watercolor', 'Light washes. Press harder for richer color. Transparent layers blend naturally.'],
        ['Marker', 'Opaque fill. Flat color with slight variation at edges.'],
      ].map(([name, desc]) => (
        <div key={name} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-20 shrink-0">{name}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>
    <Para>The landscape color palette (greens, browns, blues, grays) is pre-loaded. You can also pick any custom color.</Para>

    <SectionHeading>Text Mode</SectionHeading>
    <Para>Type in the text box at the top, then tap the canvas to place it. The text appears in architect-style handwriting font.</Para>
    <Para>Font size is fixed at 14pt canvas units (scales with zoom). Text sits on the Text layer and can be toggled on/off.</Para>
  </div>
);

// ─── Plant Database Tab ───────────────────────────────────────────────────────
const PlantsTab: React.FC<{ search: string }> = () => (
  <div>
    <SectionHeading>Searching and Placing Plants</SectionHeading>
    <Step n={1}>Click <strong className="text-gray-300">Plants</strong> in the top toolbar (or type <KbdCell>PLANT</KbdCell> in the command line).</Step>
    <Step n={2}>Search by common name, botanical name, or type (tree, shrub, groundcover).</Step>
    <Step n={3}>Click a plant card to select it. The toolbar shows "placing".</Step>
    <Step n={4}>Click anywhere on the canvas to place the plant symbol at that location.</Step>
    <Step n={5}>Click a different plant to switch, or click the same plant to deselect (stop placing).</Step>

    <SectionHeading>Water Use Ratings (WUCOLS)</SectionHeading>
    <Para>Water ratings follow the WUCOLS IV standard — California's regional plant water use guide.</Para>
    <div className="space-y-1.5 mb-4">
      {[
        { code: 'VL', label: 'Very Low', desc: 'Established plants need no supplemental water. Native chaparral and desert species.' },
        { code: 'L', label: 'Low', desc: 'Occasional deep watering once established. Most California natives.' },
        { code: 'M', label: 'Moderate', desc: 'Regular water in summer. Mediterranean and drought-tolerant ornamentals.' },
        { code: 'H', label: 'High', desc: 'Frequent watering needed. Tropical, fruiting plants, or non-adapted species.' },
      ].map((r) => (
        <div key={r.code} className="flex gap-3 text-xs">
          <span
            className="shrink-0 w-7 h-7 rounded flex items-center justify-center font-bold text-xs"
            style={{ background: '#1e1e2e', color: '#a78bfa' }}
          >
            {r.code}
          </span>
          <div>
            <div className="text-gray-300 font-medium">{r.label}</div>
            <div className="text-gray-500">{r.desc}</div>
          </div>
        </div>
      ))}
    </div>

    <SectionHeading>Plant Card Icons</SectionHeading>
    <div className="space-y-1 mb-4">
      {[
        ['Sun icon', 'Sun exposure: Full Sun / Part Shade / Shade'],
        ['Water drop', 'WUCOLS water use rating (VL / L / M / H)'],
        ['Deer icon', 'Deer resistant — important for Ojai hillsides'],
        ['Flame icon', 'Fire resistant — good for defensible space zones'],
        ['Leaf icon', 'California native — qualifies for MWELO rebates'],
      ].map(([icon, desc]) => (
        <div key={icon} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-24 shrink-0">{icon}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>

    <SectionHeading>Layer Convention for Planting Plans</SectionHeading>
    <div className="space-y-1">
      {[
        ['Planting', 'Plant symbols and placement points'],
        ['Site', 'Property boundary, structures, existing trees'],
        ['Hardscape', 'Paths, patios, walls, DG areas'],
        ['Irrigation', 'Drip lines, spray heads, valve boxes'],
        ['Drawing', 'Apple Pencil sketches (freehand)'],
        ['Color', 'Watercolor fills and washes'],
        ['Text', 'Labels, plant schedule, notes'],
        ['GIS', 'Satellite basemap and property data'],
        ['Scan', 'KIRI 3D scan contours and boundary'],
      ].map(([layer, desc]) => (
        <div key={layer} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-20 shrink-0">{layer}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Import / Export Tab ──────────────────────────────────────────────────────
const ImportExportTab: React.FC<{ search: string }> = () => (
  <div>
    <SectionHeading>DXF Import</SectionHeading>
    <Para>Open a DXF file from desktop AutoCAD or LibreCAD. Supported entities: LINE, LWPOLYLINE, CIRCLE, ARC, SPLINE, TEXT, MTEXT, INSERT (blocks as points).</Para>
    <Para>Units are auto-detected from the DXF header. Inches, feet, and metric are all supported. Elements import onto their original layers.</Para>

    <SectionHeading>DXF Export</SectionHeading>
    <Para>Exports all CAD elements as standard DXF R12. Lines, rectangles, circles, and dimensions are exported natively. Freehand strokes export as polylines. Compatible with AutoCAD LT, LibreCAD, and most CAD software.</Para>

    <SectionHeading>PDF Export</SectionHeading>
    <Para>Click <strong className="text-gray-300">Export PDF</strong> in the toolbar. Options include:</Para>
    <div className="space-y-1 mb-4">
      {[
        ['Scale', '1/4" = 1\', 1/8" = 1\', 1" = 10\', 1" = 20\', custom'],
        ['Page size', 'ARCH D (24×36"), ARCH E (36×48"), Letter, Legal, A1, A0'],
        ['Title block', 'Includes project name, date, scale, and Netrun branding'],
        ['Orientation', 'Portrait or landscape, auto-detected from drawing bounds'],
      ].map(([label, desc]) => (
        <div key={label} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-20 shrink-0">{label}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>

    <SectionHeading>GIS Import (GeoJSON / KML)</SectionHeading>
    <Para>Import property boundaries, parcel data, or survey data from GIS sources. Supported formats: GeoJSON (.geojson, .json) and KML/KMZ (.kml, .kmz).</Para>
    <Para>Features import onto the GIS layer. Coordinates are projected to canvas units at the current basemap scale. Works best with the satellite basemap enabled.</Para>

    <SectionHeading>Satellite Basemap</SectionHeading>
    <Para>Click <strong className="text-gray-300">Basemap ON</strong> at the top right. Type a property address or coordinates. The Esri World Imagery tiles load behind your drawing.</Para>
    <Para>Geocoding uses Nominatim (OpenStreetMap). For best accuracy, include the full address with city and state. Pinch to zoom, two-finger drag to align with site features.</Para>

    <SectionHeading>KIRI 3D Scan Import</SectionHeading>
    <Step n={1}>Scan the site with KIRI Engine on your iPhone. Export the scan as OBJ or PLY.</Step>
    <Step n={2}>In Survai Construction, click <strong className="text-gray-300">Import 3D Scan</strong> and select the file.</Step>
    <Step n={3}>The scan is projected to a flat 2D plan view (top-down orthographic).</Step>
    <Step n={4}>A convex hull boundary is drawn automatically on the Scan layer.</Step>
    <Step n={5}>Elevation contour lines are generated from the point cloud height data.</Step>
    <Para>OBJ and PLY formats are both supported. Large scans (&gt;500k points) are automatically decimated for performance.</Para>

    <SectionHeading>Google Drive</SectionHeading>
    <Para>Click <strong className="text-gray-300">Drive</strong> in the ProjectBar. Sign in with your Google account.</Para>
    <div className="space-y-1 mb-4">
      {[
        ['Save', 'Saves the current drawing as a .ncad file in your Drive (Survai folder)'],
        ['Open', 'Browse and open any .ncad file from your Drive'],
        ['Share', 'Creates a view-only link to share with clients or contractors'],
        ['Auto-save', 'When signed in, saves automatically every 5 minutes'],
      ].map(([action, desc]) => (
        <div key={action} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-16 shrink-0">{action}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>
    <Para>Project files (.ncad) are JSON and include all elements, layers, view state, and basemap settings.</Para>
  </div>
);

// ─── About Tab ────────────────────────────────────────────────────────────────
const AboutTab: React.FC = () => (
  <div>
    <div className="text-center py-4 mb-4">
      <div className="text-2xl font-bold text-white mb-1">Survai Construction</div>
      <div className="text-gray-500 text-xs">CAD + 3D Scan Integration</div>
    </div>

    <SectionHeading>Built By</SectionHeading>
    <Para><strong className="text-gray-300">Netrun Systems</strong> — Ojai, California</Para>
    <Para>Daniel Garza, Founder &amp; CEO. netrun.net · cad.netrunsystems.com</Para>

    <SectionHeading>License</SectionHeading>
    <Para>
      The web edition (this app) is open source under the{' '}
      <strong className="text-gray-300">MIT License</strong>.
    </Para>
    <Para>
      The desktop edition (LibreCAD fork) is licensed under{' '}
      <strong className="text-gray-300">GPLv2</strong>, inherited from LibreCAD.
    </Para>

    <SectionHeading>Source Code</SectionHeading>
    <Para>
      Web app:{' '}
      <span className="text-purple-400 font-mono text-xs">github.com/Netrun-Systems/netrun-cad-web</span>
    </Para>
    <Para>
      Desktop app:{' '}
      <span className="text-purple-400 font-mono text-xs">github.com/Netrun-Systems/netrun-cad</span>
    </Para>

    <SectionHeading>Technology</SectionHeading>
    <div className="space-y-1 mb-4">
      {[
        ['React 18 + TypeScript', 'Component framework'],
        ['HTML5 Canvas 2D API', 'Rendering engine (not SVG — performance)'],
        ['perfect-freehand', 'Pressure-sensitive stroke library (Tldraw)'],
        ['Vite 6', 'Build tooling'],
        ['Google Drive API', 'Cloud project storage'],
        ['Esri World Imagery', 'Satellite basemap tiles'],
        ['Nominatim', 'Address geocoding (OpenStreetMap)'],
      ].map(([tech, desc]) => (
        <div key={tech} className="flex gap-2 text-xs">
          <span className="text-gray-300 w-36 shrink-0">{tech}</span>
          <span className="text-gray-500">{desc}</span>
        </div>
      ))}
    </div>

    <SectionHeading>Deployment</SectionHeading>
    <Para>
      Hosted on <strong className="text-gray-300">Google Cloud Run</strong> at{' '}
      <span className="text-purple-400 font-mono text-xs">cad.netrunsystems.com</span>
    </Para>
    <Para>Auto-deployed on push to main via Cloud Build.</Para>

    <SectionHeading>Plant Database</SectionHeading>
    <Para>Southern California and Ojai-adapted species. Water data sourced from WUCOLS IV (UC ANR). Deer and fire resistance data from UC Cooperative Extension and CAL FIRE defensible space guidelines.</Para>

    <div
      className="mt-6 pt-4 text-center text-xs"
      style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(155,155,175,0.5)' }}
    >
      Built with love for Allie
      <br />
      Netrun Systems · Ojai, CA · 2025
    </div>
  </div>
);
