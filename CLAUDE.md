# netrun-cad-web

Web-based landscape design application with Apple Pencil support for iPad.

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
- **Storage**: localStorage (future: Express backend + PostgreSQL)

### Four Modes

1. **CAD Mode** — precise measurements, snap-to-grid, layers, walls, paths (keyboard + mouse)
2. **Draw Mode** — Apple Pencil freehand sketching on top of CAD layers (pressure-sensitive ink)
3. **Color Mode** — watercolor/marker brush for hand-coloring plans (pressure = opacity)
4. **Text Mode** — fine-tip pen for architect-style lettering

### Target Workflow
Allie's workflow: measure site -> CAD base plan -> switch to drawing mode -> sketch planting plans with Apple Pencil -> hand-color -> add architect-style handwriting -> export print-ready PDF

### Project Structure

```
src/
├── main.tsx                     # App entry
├── App.tsx                      # Root component
├── components/
│   ├── Canvas/
│   │   ├── CADCanvas.tsx        # Main canvas component — all mode/tool orchestration
│   │   ├── usePointerEvents.ts  # Handles mouse, touch, AND Apple Pencil (PointerEvent API)
│   │   ├── useCADTools.ts       # Line, rectangle, circle, dimension tools
│   │   ├── useDrawingTools.ts   # Freehand drawing with perfect-freehand
│   │   ├── useColorTools.ts     # Watercolor/marker brush presets and palette
│   │   ├── useLayers.ts         # Layer management (visibility, lock, opacity)
│   │   ├── useGrid.ts           # Snap-to-grid + measurement grid config
│   │   ├── useZoomPan.ts        # Pinch-to-zoom, two-finger pan, scroll zoom
│   │   └── renderer.ts         # Canvas 2D rendering engine
│   ├── Toolbar/
│   │   ├── ModeToolbar.tsx      # CAD / Draw / Color / Text mode switcher
│   │   ├── CADToolbar.tsx       # Line, rect, circle, dimension, snap, grid
│   │   ├── DrawToolbar.tsx      # Pen type, size, opacity, color picker
│   │   ├── ColorToolbar.tsx     # Brush type, landscape color palette
│   │   └── LayerPanel.tsx       # Layer list with visibility/lock/opacity
│   └── PlantPanel/
│       ├── PlantBrowser.tsx     # Searchable plant database browser
│       └── PlantSearch.tsx      # (reserved)
├── engine/
│   ├── types.ts                 # Core types: Point, Layer, Element union
│   ├── geometry.ts              # Distance, snap, intersection math
│   ├── history.ts               # Undo/redo stack
│   ├── dxf-import.ts            # DXF import (placeholder)
│   ├── dxf-export.ts            # DXF export (placeholder)
│   └── pdf-export.ts            # PDF export (placeholder)
├── data/
│   └── plants.ts                # 24 SoCal landscape plants with metadata
└── styles/
    └── globals.css              # Tailwind + canvas-specific styles
```

### Input Handling

Uses the PointerEvent API which unifies mouse, touch, and Apple Pencil:
- `event.pressure` — Apple Pencil pressure (0-1)
- `event.tiltX / tiltY` — pencil angle for shading
- `getCoalescedEvents()` — high-frequency sampling for smooth strokes
- `touch-action: none` prevents browser gestures from interfering

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 1-4 | Switch modes (CAD/Draw/Color/Text) |
| V | Select tool |
| L | Line tool |
| R | Rectangle tool |
| C | Circle tool |
| G | Toggle grid |
| S | Toggle snap |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Delete/Backspace | Remove last element |
| Cmd+0 | Reset view |

### Plant Database

24 Southern California landscape plants with:
- Common/botanical names, type, water use, sun exposure
- USDA zones, mature dimensions
- Canopy color for plan-view rendering

### Future Work (not in MVP)
- DXF import/export
- PDF export with scale
- Express backend with auth (@netrun/auth-client)
- Cloud save (PostgreSQL via @netrun/db-config)
- Dimension tool mode
- Element selection and property editing
- Multi-user collaboration
