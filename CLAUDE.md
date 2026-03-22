# netrun-cad-web

Web-based landscape design application with Apple Pencil support for iPad.
Live at: **cad.netrunsystems.com** (Google Cloud Run)

## Build & Run

```bash
npm install
npm run dev          # Vite dev server on port 5173
npm run build        # TypeScript check + production build
npm run typecheck    # TypeScript only (no build)
```

## Architecture

Standalone Vite + React SPA. NOT a Sigil plugin — the CAD canvas/drawing model is fundamentally different from admin CRUD interfaces.

### Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Canvas**: HTML5 Canvas 2D API (not SVG — performance with many strokes)
- **Freehand**: `perfect-freehand` (Tldraw's pressure-sensitive stroke library)
- **Build**: Vite 6
- **Storage**: localStorage (5-second auto-save) + Google Drive (.ncad project files)

### Four Modes

1. **CAD Mode** — precise measurements, snap-to-grid, layers, keyboard command aliases (AutoCAD LT-compatible)
2. **Draw Mode** — Apple Pencil freehand sketching on top of CAD layers (pressure-sensitive ink)
3. **Color Mode** — watercolor/marker brush for hand-coloring plans (pressure = opacity)
4. **Text Mode** — fine-tip pen for architect-style lettering

### Target Workflow
Allie's workflow: measure site → pull satellite basemap → CAD base plan → switch to drawing mode → sketch planting plans with Apple Pencil → hand-color → add architect-style handwriting → export print-ready PDF

---

## Project Structure

```
src/
├── main.tsx                          # App entry
├── App.tsx                           # Root component
├── components/
│   ├── Canvas/
│   │   ├── CADCanvas.tsx             # Main orchestration component (all mode/tool state)
│   │   ├── usePointerEvents.ts       # Mouse, touch, Apple Pencil (PointerEvent API)
│   │   ├── useCADTools.ts            # Line, rectangle, circle, dimension tools
│   │   ├── useDrawingTools.ts        # Freehand drawing with perfect-freehand
│   │   ├── useColorTools.ts          # Watercolor/marker brush presets and palette
│   │   ├── useLayers.ts              # Layer management (visibility, lock, opacity)
│   │   ├── useGrid.ts                # Snap-to-grid + measurement grid config
│   │   ├── useZoomPan.ts             # Pinch-to-zoom, two-finger pan, scroll zoom
│   │   └── renderer.ts               # Canvas 2D rendering engine
│   ├── Toolbar/
│   │   ├── ModeToolbar.tsx           # CAD / Draw / Color / Text mode switcher
│   │   ├── CADToolbar.tsx            # Line, rect, circle, dimension, snap, grid
│   │   ├── DrawToolbar.tsx           # Pen type, size, opacity, color picker
│   │   ├── ColorToolbar.tsx          # Brush type, landscape color palette
│   │   ├── LayerPanel.tsx            # Layer list with visibility/lock/opacity
│   │   ├── ImportExport.tsx          # DXF/PDF/GIS/Scan import-export toolbar
│   │   ├── GISImportModal.tsx        # GeoJSON/KML import dialog
│   │   └── ScanImportModal.tsx       # KIRI OBJ/PLY import dialog
│   ├── PlantPanel/
│   │   ├── PlantBrowser.tsx          # Searchable plant database browser
│   │   └── PlantSearch.tsx           # (reserved)
│   ├── Basemap/
│   │   ├── BasemapPanel.tsx          # Address search + basemap controls
│   │   └── BasemapRenderer.ts        # Esri tile fetching + canvas rendering
│   ├── CommandLine/
│   │   └── CommandLine.tsx           # AutoCAD-style command line (bottom bar)
│   ├── ContextMenu/
│   │   └── ContextMenu.tsx           # Right-click / long-press context menu
│   ├── StatusBar/
│   │   └── StatusBar.tsx             # Bottom strip: mode, tool, grid, zoom, element count
│   ├── ProjectManager/
│   │   ├── ProjectBar.tsx            # Google Drive project open/save/share
│   │   └── NewProjectDialog.tsx      # New project options dialog
│   └── HelpPanel/
│       └── HelpPanel.tsx             # Slide-out help panel (? key or button)
├── engine/
│   ├── types.ts                      # Core types: Point, Layer, Element union
│   ├── geometry.ts                   # Distance, snap, intersection math
│   ├── history.ts                    # Undo/redo stack
│   ├── commands.ts                   # 88 AutoCAD LT aliases + Netrun landscape extensions
│   ├── dxf-import.ts                 # DXF import (LINE, LWPOLYLINE, CIRCLE, ARC, TEXT)
│   ├── dxf-export.ts                 # DXF R12 export (all CAD elements)
│   ├── pdf-export.ts                 # PDF export with scale, page size, title block
│   ├── geojson-import.ts             # GeoJSON feature import → CAD elements
│   ├── kml-import.ts                 # KML/KMZ import → CAD elements
│   ├── obj-import.ts                 # Wavefront OBJ 3D scan → 2D projection
│   ├── ply-import.ts                 # PLY point cloud → 2D projection + contours
│   ├── scan-processor.ts             # Convex hull + contour generation from scan data
│   └── symbol-loader.ts              # 40 landscape plant symbols (generated from netrun-cad data)
├── services/
│   └── google-drive.ts               # Google Drive API: save, open, share, auto-save
├── data/
│   └── plants.ts                     # SoCal landscape plants with WUCOLS metadata
└── styles/
    └── globals.css                   # Tailwind + canvas-specific styles
```

---

## Features

### Command Line Interface
AutoCAD-style command line at the bottom. Full 88-alias registry in `src/engine/commands.ts`.
- Type any alias and press Enter (or just press the key — AutoCAD behavior)
- Tab for completions, Esc to cancel, Enter to repeat last command
- Categories: Draw, Modify, Edit, Display, Layer, Dimension, Text, Snap, File, Block, Landscape

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1 / 2 / 3 / 4 | Switch modes (CAD / Draw / Color / Text) |
| Enter | Focus command line / repeat last command |
| Escape | Cancel operation |
| V | Select tool (CAD mode) |
| L | Line tool (CAD mode) |
| R | Rectangle tool (CAD mode) |
| C | Circle tool (CAD mode) |
| D | Dimension tool (CAD mode) |
| G | Toggle grid (CAD mode) |
| S | Toggle snap (CAD mode) |
| ? | Open / close Help panel |
| F7 | Toggle grid |
| F8 | Toggle ortho mode |
| F2 / F3 | Toggle snap |
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Delete / Backspace | Remove last element |
| Cmd/Ctrl+0 | Reset view (zoom to fit) |

### GIS Basemap
- Esri World Imagery satellite tiles
- Address geocoding via Nominatim (OpenStreetMap)
- Tile caching for offline use
- Controlled by `BasemapPanel` and `BasemapRenderer`

### KIRI 3D Scan Import
- OBJ and PLY format support
- Top-down orthographic projection (3D → 2D plan view)
- Convex hull boundary auto-detection
- Elevation contour line generation
- Auto-decimation for large point clouds (>500k points)

### GeoJSON / KML Import
- GeoJSON features → CAD elements on GIS layer
- KML/KMZ polygon/linestring import
- Coordinate projection to canvas units

### DXF Import / Export
- Import: LINE, LWPOLYLINE, CIRCLE, ARC, SPLINE, TEXT, MTEXT, INSERT
- Export: DXF R12, compatible with AutoCAD LT, LibreCAD, most CAD software
- Freehand strokes export as polylines

### PDF Export
- Scale options: 1/4"=1', 1/8"=1', 1"=10', 1"=20', custom
- Page sizes: ARCH D (24×36"), ARCH E (36×48"), Letter, Legal, A1, A0
- Title block with project name, date, scale
- Portrait/landscape auto-detection

### Google Drive Integration
- Save / open .ncad project files (JSON: elements + layers + view + basemap)
- Share: generates view-only link
- Auto-save every 5 minutes when signed in

### Symbol Library
- 40 landscape plant symbols generated from netrun-cad data
- Symbols rendered at correct plan-view scale
- Placed via the Plant Browser panel

### Right-Click Context Menu
- Repeat last command
- Undo / Redo
- Pan / Zoom controls
- Delete last element
- Long-press (600ms) emulates right-click on iPad

### Status Bar
Bottom strip shows: mode, active tool, grid/snap state, active layer, cursor coordinates, zoom level, element count, Clear All button, Reset View button.

### Help Panel
Slide-out panel from the right side. Triggered by `?` key or the `?` button in the toolbar. Tabbed content: Quick Start, Keyboard Shortcuts, Tools Reference, Plant Database Guide, Import/Export, About. Includes full-text search across all help content.

### Project File Format (.ncad)
JSON structure:
```json
{
  "version": 1,
  "name": "project name",
  "elements": [...],
  "layers": [...],
  "view": { "offsetX": 0, "offsetY": 0, "zoom": 1 },
  "basemap": { "enabled": false, "lat": 0, "lng": 0, "zoom": 15, "provider": "esri-satellite" }
}
```

### Plant Database
Southern California and Ojai-adapted plants with WUCOLS IV water ratings:
- Common/botanical names, type, water use (VL/L/M/H), sun exposure
- USDA zones, mature dimensions
- Deer resistant, fire resistant, California native flags
- Canopy color for plan-view rendering

---

## Input Handling

Uses the PointerEvent API (unifies mouse, touch, Apple Pencil):
- `event.pressure` — Apple Pencil pressure (0-1)
- `event.tiltX / tiltY` — pencil angle for shading
- `getCoalescedEvents()` — high-frequency sampling for smooth strokes
- `touch-action: none` prevents browser gestures from interfering

Two-finger gestures handled separately in CADCanvas (pinch-zoom, two-finger pan).
Long-press (600ms, touch only) emulates right-click for iPad context menu.

---

## Deployment

- **URL**: cad.netrunsystems.com
- **Platform**: Google Cloud Run (gen-lang-client-0047375361, us-central1)
- **Registry**: us-central1-docker.pkg.dev/gen-lang-client-0047375361/charlotte-artifacts
- **CI/CD**: Cloud Build on push to main

---

## Future Work (Not Yet Implemented)

- Multi-user collaboration (WebSocket/CRDT)
- Element selection and property editing (move, resize selected elements)
- Express backend with full auth (@netrun/auth-client)
- Advanced dimension tools (aligned, angular, radius, diameter)
- Polyline, arc, ellipse, spline CAD tools
- Block library and symbol insertion
- Irrigation planning overlay
- Plant schedule auto-generation
- Print directly to connected plotter
