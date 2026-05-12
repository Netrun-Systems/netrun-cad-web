# Netrun CAD Web

Browser-native CAD for landscape design and 3D site-scan workflows. Runs on iPad with Apple Pencil; same build serves the construction-mode `survai.netrunsystems.com` deployment via hostname routing.

**Live**: [cad.netrunsystems.com](https://cad.netrunsystems.com) · [survai.netrunsystems.com](https://survai.netrunsystems.com)

## Why

Three problems in one app:

1. **Landscape design on iPad has no good answer.** AutoCAD Web is subscription-locked and Windows-centric. Procreate sketches don't measure. The professional workflow today is: laptop for CAD → iPad for sketches → laptop again for export. Three devices, several format conversions, dropped state at every handoff.
2. **3D site scans don't have a CAD-native view.** KIRI Engine produces OBJ/PLY meshes. The Survai pipeline runs YOLOv8 + PointNet++ inference and emits MEP detection JSON. Without a CAD client that ingests both, contractors get raw point clouds and JSON they can't mark up.
3. **Both workflows want a single tool.** A landscape designer measuring a site, a contractor placing irrigation heads on a scan, and a site team annotating MEP detections all want the same surface — fullscreen canvas, Apple Pencil, dimensioning, layers, schedule export.

Netrun CAD Web is that tool.

## Quick start

```bash
npm install
npm run dev          # Vite dev server on port 5173
npm run typecheck    # tsc --noEmit
npm run build        # production build to dist/
```

For a real local build with Google Drive credentials, copy `.env.example` to `.env.local` and fill in your `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` from the GCP Console (APIs & Services → Credentials).

## What's in the box

**Drawing**
- 8 CAD primitives: line, rectangle, circle, polyline, arc (3-point), ellipse, spline (Catmull-Rom), dimension
- 5 dimension styles: linear, aligned, angular, radius, diameter
- 4 drawing modes: CAD (precise), Draw (Apple Pencil freehand), Color (watercolor/marker), Text (architect lettering)
- Layer system with visibility, lock, opacity per layer
- 88-alias AutoCAD LT-compatible command line

**Selection + editing**
- Click-select, shift-click toggle, marquee selection (window left-to-right, crossing right-to-left)
- Drag-to-move, arrow-key nudge (10× with shift)
- Resize via corner handles (single + multi-element via union bbox)
- Per-type property panel (color, width, fill, layer, content, dimensions, etc.)
- Z-order reorder, multi-element delete

**Reusable content**
- Plant database (24 SoCal-adapted species with WUCOLS IV water ratings)
- Block library (8 built-in landscape blocks: bench, table, gazebo, pergola, planter, gate, stepping stone, path light)
- Custom blocks (define your own from selection, syncs across devices via Drive)
- Irrigation overlay (4 head types, 8 zones, coverage circles, GPM schedule)

**Import**
- DXF (R12+, including LWPOLYLINE, ARC, SPLINE, INSERT)
- IFC (BIM models — walls, doors, windows, slabs, columns, MEP fittings)
- OBJ / PLY (3D scans from KIRI Engine, parsed off-thread via Web Worker)
- GeoJSON / KML / KMZ (GIS data)
- Esri World Imagery satellite basemap with Nominatim address geocoding
- Survai cloud scans (when configured)

**Export**
- DXF R12 (compatible with AutoCAD LT, LibreCAD, most CAD)
- Scaled PDF (ARCH D, ARCH E, Letter, Tabloid; 1/4″=1′ through 1″=10′)
- SVG
- PNG (screen-resolution raster)
- Plant schedule (CSV + PDF with WUCOLS verdict)
- Irrigation schedule (CSV with per-zone GPM totals)
- Annotation export (Survai detection markup)

**Storage**
- Google Drive (`.ncad` JSON files, auto-save every 5 min when signed in)
- localStorage fallback (offline / unauthenticated)
- Custom blocks sync via Drive across the user's devices

**Deployment**
- Google Cloud Run (`gen-lang-client-0047375361`, `us-central1`)
- Container registry: `us-central1-docker.pkg.dev/gen-lang-client-0047375361/charlotte-artifacts`
- Build is manual via `gcloud builds submit` + `gcloud run deploy` (no auto-trigger)
- COOP header `same-origin-allow-popups` required for the Google OAuth popup flow (set in `nginx.conf`)

## Architecture at a glance

```
src/
├── App.tsx                    # Hostname-based mode switch (landscape vs construction)
├── components/
│   ├── Canvas/                # The fullscreen drawing surface + tools
│   │   ├── CADCanvas.tsx      # Orchestrator — owns mode/tool state, dispatches pointer events
│   │   ├── usePointerEvents.ts
│   │   ├── useCADTools.ts     # Per-tool accumulators (line, rect, circle, polyline, arc, ellipse, spline, dim)
│   │   ├── useDrawingTools.ts # Apple Pencil freehand
│   │   ├── useColorTools.ts
│   │   ├── useLayers.ts
│   │   ├── useGrid.ts
│   │   ├── useZoomPan.ts
│   │   └── renderer.ts        # Canvas 2D rendering for every element type
│   ├── Toolbar/               # Mode + tool toolbars, layer panel, import/export modal
│   ├── PropertyPanel/         # Per-element editor + multi-select group editor
│   ├── PlantPanel/            # Plant database browser
│   ├── BlockLibrary/          # 8 built-in + custom block library, MakeBlockDialog
│   ├── Irrigation/            # IrrigationPanel + IrrigationScheduleDialog
│   ├── PlantSchedule/         # Plant schedule modal (CSV + PDF export)
│   ├── BlueprintPanel/        # IFC import + scan-vs-blueprint deviation
│   ├── SurvaiPanel/           # Cloud scan import from Survai API
│   ├── Viewport3D/            # ModelViewer3D — Three.js point cloud + MEP detections (lazy)
│   └── Landing/               # Survai-mode marketing landing page
├── engine/                    # Pure functions, no React
│   ├── types.ts               # CADElement union: line, rect, circle, polyline, arc, ellipse,
│   │                          # spline, dimension, freehand, text, plant, interior-symbol,
│   │                          # block, irrigation, flowchart-shape, container, connector
│   ├── geometry.ts            # distance, snap, intersection
│   ├── selection.ts           # hit-test, bounding box, move, scale, marquee, union bbox
│   ├── spline.ts              # Catmull-Rom → Bezier conversion
│   ├── dxf-import.ts / dxf-export.ts
│   ├── ifc-import.ts          # web-ifc lazy-loaded; ~3 MB WASM only fetched on first IFC
│   ├── obj-import.ts / ply-import.ts          # Pure parsers
│   ├── scan-parser-worker.ts  # Promise-based wrapper around the Web Worker
│   ├── pdf-export.ts          # jsPDF lazy-loaded
│   ├── svg-renderer.ts        # SVG export for every element type
│   ├── plant-schedule.ts      # WUCOLS-aware grouping + CSV/PDF
│   └── commands.ts            # 88-alias AutoCAD LT command registry
├── workers/
│   └── scan-parser.worker.ts  # OBJ + PLY parsing off the main thread
├── data/
│   ├── plants.ts              # SoCal landscape plant database
│   ├── blocks.ts              # Built-in block catalog
│   ├── custom-blocks.ts       # localStorage + Drive sync for user-defined blocks
│   ├── irrigation.ts          # Head specs, zone palette, GPM schedule
│   └── interior-symbols.ts    # Furniture / fixture / appliance symbols
├── services/
│   ├── google-drive.ts        # GIS auth + Drive API (projects, custom blocks)
│   ├── survai.ts              # Survai API client
│   ├── api.ts / parcel-lookup.ts / push-notifications.ts / offline-storage.ts
└── styles/globals.css
```

The architectural rule: `src/engine/` is pure (no React, no DOM-only APIs); `src/components/` is the UI layer; `src/services/` wraps external APIs; `src/data/` is static catalogs. The engine functions can run in a Web Worker context (which is exactly what `scan-parser.worker.ts` does for OBJ/PLY parsing).

## Performance

- First-paint critical-path JS: **172 KB gzipped** (515 KB raw)
- Lazy chunks fetched only on demand:
  - `vendor-three` (286 KB gzip) — when 3D viewer renders
  - `vendor-pdf` (119 KB gzip) — when user exports PDF
  - `vendor-ifc` (414 KB gzip, includes ~3 MB WASM) — when user imports an IFC file
  - `scan-parser.worker` — when user imports OBJ/PLY
  - `ModelViewer3D` — when 3D viewer is opened
- OBJ/PLY parsing for >500 K-vertex KIRI scans runs in a Web Worker, no main-thread freeze
- Bundle splitting drops `manualChunks` configured in `vite.config.ts`

## Hostname-based mode

The same built artifact serves two distinct product experiences:

| Hostname | Mode | Default user | Landing |
|---|---|---|---|
| `cad.netrunsystems.com` | Landscape | Landscape designer | Skip — canvas loads immediately |
| `survai.netrunsystems.com` | Construction | Construction / MEP planner | Survai-branded marketing page first |

Detection in `src/App.tsx:detectMode()` — checks `window.location.hostname.startsWith('survai.')`. PWA manifest, default layers, primary panels, and the document title all branch on this.

## Status

- Production: live on Cloud Run, COOP header configured, Google Drive auth working
- v1 documented backlog: complete — see [CHANGELOG section in the whitepaper](./NETRUN_CAD_WEB_WHITEPAPER_v1.0.md) for the per-feature delivery log
- v2 backlog: see [TODO.md](./TODO.md)
- Design system: see [DESIGN.md](./DESIGN.md)

## License

Internal — Netrun Systems. Not currently published.
