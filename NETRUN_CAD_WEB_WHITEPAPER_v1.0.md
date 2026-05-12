# Netrun CAD Web: Browser-Native CAD for Landscape Design and 3D Site Scan Workflows

## Technical Whitepaper v1.1

**Date**: May 11, 2026 (v1.1 closeout sprint)
**Author**: Daniel Garza, Founder and CEO, Netrun Systems
**Platform**: https://cad.netrunsystems.com (landscape mode) / https://survai.netrunsystems.com (construction mode)
**Repository**: /data/workspace/github/netrun-cad-web
**Status**: Production live (Cloud Run revision `netrun-cad-web-00028-ml4`, deployed May 12 02:33 UTC). v1 documented backlog is complete — every gap named in the original v1.0 §6.1 future-work list shipped during the May 9-11 closeout sprint.

---

## Changelog

### v1.1 — May 11, 2026 (v1 closeout sprint, 25 commits in 3 days)

The May 9-11 sprint closed every named v1 future-work item from the v1.0 §6.1 list, every "Unimplemented CAD tool" no-op, and the documented landscape-workflow gaps. Highlights, in shipping order:

- **May 9** — Production deploy mechanism cleaned up (Dockerfile build args wire `VITE_GOOGLE_*` from Secret Manager; previous deploys shipped with empty Google credentials). Google OAuth Console origin + redirect URI added (Daniel, in the GCP Console). COOP header `same-origin-allow-popups` set so the GIS popup can `postMessage` back. v1.0 whitepaper landed.
- **May 10** — DESIGN.md (Stitch design.md format) added. `.gcloudignore` cleanup makes Dockerfile build args the sole credential source.
- **May 11** — Bundle split + lazy-load (first-paint 733 KB gzip → 172 KB gzip, **77% reduction**). PropertyPanel + arrow-key nudge. Plant schedule auto-generation + RDP simplification on freehand DXF export. Polyline tool + resize via corner handles. Multi-select (shift-click + marquee). Arc + Ellipse tools. 4 advanced dimension tools (aligned, angular, radius, diameter). 3D viewer JSX wiring. Block library (8-block built-in catalog). Web Worker for OBJ + PLY parsing. Spline tool (closes the last "Unimplemented CAD tool" no-op). Custom blocks (define-from-selection, syncs across devices via Drive). Multi-resize via union bbox. Crossing-window marquee variant. Linear-vs-aligned dimension visual differentiation. Irrigation overlay (4 head types, 8 zones, GPM schedule with capacity warning).

After v1.1, the entire AutoCAD-alias-registry tool set is wired (no remaining `tool:*` no-ops in the executeCommand switch), the selection-editing surface is end-to-end (single + multi for select / move / nudge / resize / property-edit / reorder / delete / make-block), and the documented landscape deliverables (planting plan, plant schedule, irrigation schedule, scaled PDF) all generate from the canvas without leaving the browser tab.

### v1.0 — May 1, 2026

Initial release. 4 drawing modes (CAD / Draw / Color / Text), 88-alias AutoCAD LT command line, DXF/PDF/SVG/PNG export, GeoJSON/KML/OBJ/PLY/IFC import, Google Drive integration, Esri satellite basemap with Nominatim geocoding, plant database (24 SoCal species with WUCOLS IV ratings), hostname-based dual product mode (landscape vs construction).

---

## Executive Summary

Netrun CAD Web is a browser-native, Progressive Web Application (PWA) that unifies two complementary workflows in a single codebase: professional landscape design on iPad with Apple Pencil, and 3D site scan visualization with MEP (Mechanical, Electrical, Plumbing) detection output from the Survai pipeline. It is built in React 18 and TypeScript, served via Google Cloud Run, and runs entirely in the browser without a native app install.

The product was motivated by a concrete workflow problem. Professional landscape designers — including Allie Garza, Netrun's primary landscape user — need to move fluidly from a satellite basemap, to precise CAD geometry, to freehand planting sketches, to a print-ready scaled PDF, all on an iPad in the field. No existing tool covers this arc on iPad without forcing a switch between three or four applications. Simultaneously, Survai customers processing LiDAR and photogrammetric scans lacked a CAD-native view of the detection results that emerged from the ML pipeline; they received JSON but no visual, editable plan. Netrun CAD Web closes both gaps.

The application exposes four distinct drawing modes — CAD (precise geometry), Draw (Apple Pencil freehand), Color (watercolor/marker), and Text (architect lettering) — over a shared layer system and a unified HTML5 Canvas renderer. It imports GeoJSON, KML, DXF, OBJ, PLY, IFC, and GLB files and exports DXF R12 and scaled PDF. Project files in the .ncad format are stored on Google Drive. The Survai integration is implemented as a dedicated service layer (`src/services/survai.ts`) that connects to the Survai Cloud Run API, downloads processed scan data with YOLOv8 detections, and imports those detections directly into the CAD layer system.

The hostname-based product mode system (implemented in `src/App.tsx:22-29`) means the same built artifact serves both audiences: landscape designers at cad.netrunsystems.com reach the CAD canvas directly, while construction teams at survai.netrunsystems.com see the Survai-branded marketing landing page before entering the same canvas. The project is at 92% completion per PROJECT_INDEX.md (May 2, 2026) with Survai cloud integration in active development as the primary remaining milestone.

---

## Table of Contents

1. The Problem
2. Architecture
   - 2.1 Technology Stack and Build System
   - 2.2 Rendering Engine
   - 2.3 Four Drawing Modes
   - 2.4 CAD Engine and Command System
   - 2.5 Input Handling: PointerEvent API and Apple Pencil
   - 2.6 Layer System
   - 2.7 Import Pipeline
   - 2.8 Export Pipeline
   - 2.9 Survai Integration: Scan-to-Design Workflow
   - 2.10 Google Drive Integration
   - 2.11 GIS Basemap and Parcel Data
   - 2.12 Plant Database
   - 2.13 Hostname-Based Product Mode
   - 2.14 Offline and PWA Infrastructure
3. Production State
4. Differentiation
5. Pricing
6. Limitations and Future Work
7. References

---

## 1. The Problem

### 1.1 The Landscape Design Tool Gap on iPad

Professional landscape design work currently requires at least three disconnected tools: a CAD application for base plans (AutoCAD LT, Rhino, or LibreCAD), a sketching application for ideation (Procreate or Concepts), and an export step to produce client-ready PDFs. None of the CAD tools run natively on iPad with Apple Pencil at professional quality. AutoCAD Web exists but is subscription-locked, Windows-centric in its feature assumptions, and does not integrate freehand drawing as a first-class mode alongside precise geometry.

The practical result is that a landscape designer measuring a residential site must carry a laptop for the CAD phase, then transfer files to their iPad to sketch over the plan, then transfer back to export. Field measurement to client PDF is a multi-device, multi-application workflow with several format-translation steps in between.

Netrun CAD Web eliminates every transfer step. The designer starts with a satellite basemap pulled from Esri World Imagery, draws the site boundary using snap-to-grid CAD tools with a keyboard command system compatible with AutoCAD LT, switches to Draw mode to sketch planting plans freehand with the Apple Pencil, adds architect-style handwritten notes in Text mode, applies watercolor washes in Color mode for the client presentation version, and exports a scaled ARCH D PDF — without leaving the browser tab.

### 1.2 The Missing CAD View for Survai Scan Outputs

The Survai pipeline (`/data/workspace/github/Survai/CLAUDE.md`) transforms OBJ/PLY/GLB uploads from KIRI Engine (iOS LiDAR/photogrammetry) through a sequence of ML inference steps — YOLOv8 2D detection, PointNet++ 3D detection, route estimation, and material catalog matching — and produces structured JSON with MEP detection data, 3D bounding boxes, and confidence scores.

That JSON output, while machine-readable, is not usable by a construction professional or MEP planner without an application that can render it spatially. Previously, Survai customers received detection data through a React/Three.js 3D viewer (`Survai/CLAUDE.md:119-127`) capable of showing raw 3D mesh but not integrated with the CAD plan view that construction drawings require. There was no path from "Survai found 3 pipe runs and 7 electrical panels in this scan" to "here is a 2D plan annotated with those detections that I can mark up, measure, and export as DXF."

Netrun CAD Web provides that path. The SurvaiPanel component connects to the Survai API, downloads processed scans, projects them to plan view, and places ML detections as labeled CAD elements on named layers — enabling a construction professional to mark up, dimension, and export a detection-annotated plan directly from scan data.

### 1.3 Subscription Lock-in and Platform Dependency

AutoCAD LT and AutoCAD Web carry $440-$600/year subscription costs for small landscape practices. The feature set is tuned for mechanical and architectural CAD, not landscape workflows — plant databases, WUCOLS water ratings, and planting symbols are not built in. These tools also require a Windows machine for full functionality, which conflicts with the iPad-first workflow that has become standard for field work since the Apple Pencil gen 2 release.

---

## 2. Architecture

### 2.1 Technology Stack and Build System

The application is a standalone Single-Page Application (SPA). It is not a Sigil CMS plugin — the canvas/drawing model is architecturally incompatible with Sigil's CRUD admin interface paradigm. (`CLAUDE.md:17`)

**Frontend stack:**
- React 18 with TypeScript (strict mode)
- Tailwind CSS for UI chrome
- Vite 6 as build tool and dev server (port 5173)
- `@tanstack/react-query` for API state management (`src/App.tsx:1`)
- `perfect-freehand` (Tldraw's pressure-sensitive stroke library) for freehand drawing

**Canvas:** HTML5 Canvas 2D API (`CanvasRenderingContext2D`), not SVG. The choice is deliberate: SVG has per-element DOM overhead that becomes visible above a few hundred elements; Canvas 2D is a single rasterized surface that handles thousands of strokes and geometry elements without per-element memory cost. (`CLAUDE.md:22`)

**Storage:**
- `localStorage` for 5-second auto-save during offline/unauthenticated sessions
- Google Drive for `.ncad` project files when the user is signed in (`src/services/google-drive.ts:6-12`)

**Deployment:**
- Google Cloud Run (project `gen-lang-client-0047375361`, region `us-central1`)
- Container registry: `us-central1-docker.pkg.dev/gen-lang-client-0047375361/charlotte-artifacts`
- CI/CD: Cloud Build triggered on push to main (`CLAUDE.md:229`)

**Build commands:**
```
npm install
npm run dev          # Vite dev server on port 5173
npm run build        # TypeScript check + production build
npm run typecheck    # TypeScript only (no build)
```

### 2.2 Rendering Engine

All visual output passes through a single rendering function in `src/components/Canvas/renderer.ts`. The renderer operates on a flat list of `CADElement` objects and the current `ViewState` (offsetX, offsetY, zoom). It does not maintain its own state — the application shell calls `renderAll()` on every React render pass that touches the element list or viewport.

The `CADElement` union type (`src/engine/types.ts:131-139`) covers eight element variants:

```
CADLine | CADRectangle | CADCircle | CADDimension |
FreehandStroke | TextElement | PlantPlacement | InteriorSymbolPlacement
```

`FreehandStroke` elements carry an array of `StrokePoint` objects (`src/engine/types.ts:8-12`) each storing `x`, `y`, `pressure`, `tiltX`, and `tiltY`. The renderer passes this array through `perfect-freehand`'s `getStroke()` to compute a variable-width SVG path, then fills that path on the canvas — producing the tapered ink quality of a real pen rather than a uniform-width line.

Inference lines (AutoCAD-style snap assist) and the snap indicator are rendered as a separate pass via `src/engine/inference.ts`, which is imported by `CADCanvas.tsx:23-28`. This separation means snap visualization never enters the element list and is not exported.

Layer visibility and opacity are resolved per-element at render time: each `CADElement` carries a `layerId` string; the renderer looks up the corresponding `Layer` record and skips the element if `visible === false` or applies `layer.opacity` to the canvas context before drawing.

### 2.3 Four Drawing Modes

Mode switching is handled at the top level of `CADCanvas.tsx`. The `AppMode` type (`src/engine/types.ts:15`) defines five values: `'cad' | 'draw' | 'color' | 'text' | 'route'`. The keyboard bindings `1` through `4` switch between CAD, Draw, Color, and Text; `route` mode is engaged internally by the route editor workflow.

**CAD Mode**

Precise geometry tools: line, rectangle, circle, and dimension. Snap-to-grid and ortho mode (F8) constrain cursor movement. The dimension tool generates `CADDimension` elements that render with extension lines, arrows, and a formatted measurement label. All CAD tools are driven by the `useCADTools` hook (`src/components/Canvas/useCADTools.ts`), which listens to the global pointer event stream and accumulates click points until the minimum point count for the active tool is satisfied.

**Draw Mode**

Freehand sketching using the `perfect-freehand` library with `getStroke()` called on each pointer-move event. The resulting variable-width path is accumulated as a `FreehandStroke` in the element list. Pressure data from `event.pressure` controls stroke width in real-time. Pen presets (pen, pencil, marker) are available from `DrawToolbar.tsx`, each with different size and opacity defaults.

The `useDrawingTools` hook (`src/components/Canvas/useDrawingTools.ts`) manages stroke accumulation and calls the `onStrokeEnd` callback to finalize each stroke into the element list with a UUID.

**Color Mode**

Watercolor/marker brush presets tuned for landscape plan coloring. The landscape color palette in `ColorToolbar.tsx` includes plant-appropriate greens, browns, and blues. Pressure maps to opacity rather than width, so a light pencil touch produces a translucent wash while a firm stroke saturates.

**Text Mode**

Fine-tip pen cursor with architect-style lettering behavior. `TextElement` (`src/engine/types.ts:96-105`) stores content, font family, font size, rotation, and position. The default font is selected to mimic hand-lettered architectural text.

### 2.4 CAD Engine and Command System

The CAD engine lives in `src/engine/`. The core components are:

**`commands.ts`** — The 88-alias AutoCAD LT 2014 command registry. Each `Command` object (`src/engine/commands.ts:4-10`) carries an alias list, an internal action ID, a description, a `requiresPoints` count, and a category string. Categories are: draw, modify, edit, display, layer, dimension, text, snap, file, block, landscape. The Landscape category adds Netrun-specific commands (plant placement, irrigation) beyond the standard AutoCAD set.

The command line at the bottom of the canvas (`src/components/CommandLine/CommandLine.tsx`) accepts typed aliases and dispatches them to `executeCommand()` in `CADCanvas.tsx`. The behavior matches AutoCAD LT: press a key alias to immediately activate the tool, Tab for completions, Esc to cancel, Enter to repeat the last command. (`CLAUDE.md:107-112`)

Key single-letter bindings active in CAD mode: `L` (line), `R` (rectangle), `C` (circle), `D` (dimension), `G` (toggle grid), `S` (toggle snap), `V` (select). (`CLAUDE.md:115-134`)

**`geometry.ts`** — Distance computation, snap-to-grid quantization, endpoint snap, intersection detection.

**`history.ts`** — Undo/redo stack implemented as a pure value array of `CADElement[]` snapshots. `createHistory()`, `pushState()`, `undo()`, `redo()` are the only four exports; the history object is held in a `useRef` in `CADCanvas.tsx` to avoid triggering React re-renders on every edit.

**`selection.ts`** — `findElementAt()` for hit-testing on click (accounts for element type and current zoom level), `moveElement()` for translate transforms, `getBoundingBox()` for multi-select bounding rectangle computation.

**`inference.ts`** — AutoCAD-style inference line computation: horizontal, vertical, and 45-degree guide lines anchored to the last placed point. Also computes the snap indicator (the yellow circle) at the nearest snappable point within threshold distance.

### 2.5 Input Handling: PointerEvent API and Apple Pencil

All pointer input is unified through the W3C PointerEvent API rather than separate mouse and touch event handlers. (`CLAUDE.md:212`) This means a single handler covers:

- Desktop mouse (pressure = 0.5 constant)
- iPad touch (pressure = 0 for finger, variable for Apple Pencil)
- Apple Pencil gen 1 and 2 (pressure 0-1, tiltX/tiltY for angle)

The `usePointerEvents` hook (`src/components/Canvas/usePointerEvents.ts`) captures the pointer on `pointerdown` via `canvas.setPointerCapture(e.pointerId)`, ensuring that strokes are tracked even if the pointer exits the canvas bounds mid-stroke. The hook also calls `e.getCoalescedEvents()` on move events to sample all intermediate positions reported by the Pencil at its full 240Hz input rate, rather than just the events that survived React's event batching.

Two-finger gestures (pinch-zoom, two-finger pan) are handled separately in `CADCanvas.tsx` via touch event tracking, distinct from the pointer capture that handles single-pointer drawing. This separation prevents accidental stroke creation when the user intends to zoom.

Long-press (600ms on touch-only input) emulates right-click for the context menu, since iPads have no right mouse button. (`CLAUDE.md:219`)

`touch-action: none` is set on the canvas element to prevent browser-native scroll and zoom from intercepting pointer events. (`CLAUDE.md:215`)

The complete `StrokePoint` type captured per event:
```typescript
// src/engine/types.ts:8-12
export interface StrokePoint extends Point {
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  timestamp?: number;
}
```

### 2.6 Layer System

The `Layer` type (`src/engine/types.ts:141-149`) stores: id, name, visible (boolean), locked (boolean), opacity (0-1), default color, and order (integer for z-ordering).

The `useLayers` hook (`src/components/Canvas/useLayers.ts`) manages the layer list. The `LayerPanel.tsx` component renders per-layer toggles for visibility and lock state and a slider for opacity.

New projects are initialized with a set of default layers relevant to the active product mode. In landscape mode, default layers include: site boundary, hardscape, planting, notes, and basemap. In construction mode (Survai), the scan import pipeline adds a `scan` layer (raw point cloud projection), a `plants` layer (vegetation detections), and a `site` layer (structural detections) automatically when a scan is imported.

The layer-to-detection mapping is defined in `src/services/survai.ts:336-354` (`detectionToLayerId()`):
- YOLOv8 labels containing `tree`, `shrub`, `plant`, or `vegetation` map to the `plants` layer
- Labels containing `wall`, `structure`, `building`, `fence`, `door`, `window`, `fixture`, `outlet`, or `switch` map to the `site` layer
- All other labels fall through to the `scan` layer

### 2.7 Import Pipeline

The import pipeline converts external file formats into `CADElement[]` arrays. All parsers are pure TypeScript functions that run in the main thread (no WebWorkers currently, flagged as a future optimization for large point clouds).

**DXF Import (`src/engine/dxf-import.ts`)**
Parses AutoCAD DXF R12 and later. Supported entity types: LINE, LWPOLYLINE, CIRCLE, ARC, SPLINE, TEXT, MTEXT, INSERT. (`CLAUDE.md:155`) Layer assignments in the DXF are preserved as new layers in the application layer system. Unsupported entity types are skipped with a warning.

**GeoJSON Import (`src/engine/geojson-import.ts`)**
GeoJSON `Feature` and `FeatureCollection` objects. Geometry types Polygon, LineString, and MultiLineString are converted to `CADLine` sequences on a new `gis` layer. Coordinates are projected from WGS84 longitude/latitude to canvas units at a configurable scale. (`CLAUDE.md:149-151`)

**KML/KMZ Import (`src/engine/kml-import.ts`)**
KML `<Polygon>` and `<LineString>` elements. The parser extracts coordinate arrays from KML XML and runs the same projection logic as the GeoJSON importer.

**OBJ Import (`src/engine/obj-import.ts`)**
Wavefront OBJ 3D mesh. Reads vertex (`v`) and face (`f`) records. The 3D vertex array is passed to `scan-processor.ts` for projection to plan view.

**PLY Import (`src/engine/ply-import.ts`)**
Stanford PLY point cloud (ASCII and binary-little-endian formats). Reads `element vertex` count, `property float x/y/z`, and optionally `property uchar red/green/blue`. Large point clouds (>500K points) are automatically decimated by taking every Nth vertex to keep the plan-view element count manageable. (`CLAUDE.md:147`)

**Scan Processor (`src/engine/scan-processor.ts`)**
Takes the raw 3D vertex array from OBJ or PLY import and produces 2D CAD elements via:
1. Axis projection: drop the Y axis (up in KIRI's coordinate system), use X and Z as the plan-view X and Y.
2. Unit scaling: KIRI exports in meters; the default `scaleFactor` is 3.28084 (meters to feet). (`scan-processor.ts:28`)
3. Output mode selection (`ScanOutputMode`): `pointCloud` (dot per vertex), `boundary` (convex hull as `CADLine`), `contours` (elevation contour lines at configurable intervals), or `all`. (`scan-processor.ts:22`)
4. Convex hull via a Graham scan implementation producing the boundary polygon.
5. Contour generation: bins vertices by quantized elevation, then traces polyline segments at each contour interval.

**IFC Import (`src/engine/ifc-import.ts`)**
Industry Foundation Classes (BIM) format, parsed in-browser using the `web-ifc` library. IFC type constants are mapped to CAD layers via `IFC_LAYER_MAP` (`ifc-import.ts:20-30`): walls to `ifc-wall`, doors to `ifc-door`, windows to `ifc-window`, flow segments (pipes) to `ifc-pipe`, flow fittings to `ifc-fitting`, flow terminals to `ifc-terminal`, slabs to `ifc-slab`, columns to `ifc-column`. IFC coordinates are in meters and are converted to feet at 3.28084. (`ifc-import.ts:14`)

**Scan-GIS Alignment (`src/engine/scan-gis-alignment.ts`)**
When both a KIRI point cloud and a GIS parcel boundary exist in the canvas, this module computes the affine transformation (scale + translation + 0/90/180/270 degree rotation) that best aligns the scan bounding box to the parcel boundary. The alignment is offered to the user via the `AlignmentEditor` component and applied via `applyAlignment()`. Confidence is reported as a 0-1 ratio based on the aspect ratio similarity between the scan and parcel bounding boxes. (`scan-gis-alignment.ts:1-35`)

**Interior Layout (`src/components/InteriorPanel/`)**
Interior symbols (furniture, fixtures, appliances) are placed as `InteriorSymbolPlacement` elements (`src/engine/types.ts:117-130`). Width, depth, and rotation are stored per symbol; the renderer scales and rotates the symbol glyph accordingly.

### 2.8 Export Pipeline

**DXF Export (`src/engine/dxf-export.ts`)**
Produces DXF R12 format compatible with AutoCAD LT, LibreCAD, and most CAD software. All `CADLine`, `CADRectangle`, `CADCircle`, and `CADDimension` elements are exported as their DXF equivalents. `FreehandStroke` elements are converted to LWPOLYLINE entities with one vertex per stroke point — this is the mechanism by which Apple Pencil sketches become vector objects in downstream tools. (`CLAUDE.md:157-158`)

**PDF Export (`src/engine/pdf-export.ts`)**
Uses jsPDF (`pdf-export.ts:7`) to produce a scaled PDF suitable for printing on a large-format plotter. Scale options are defined as ratios of paper inches per drawing foot (`pdf-export.ts:18-23`):

| Scale Label | Ratio | Use Case |
|-------------|-------|----------|
| 1/4" = 1' (1:48) | 0.25 | Residential detail |
| 1/8" = 1' (1:96) | 0.125 | Residential overview |
| 1/16" = 1' (1:192) | 1/16 | Large sites |
| 1" = 10' (1:120) | 0.1 | Site plans |

Page size options (`pdf-export.ts:32-37`): ARCH D (24x36"), ARCH E (36x48"), Tabloid (11x17"), Letter (8.5x11"). A title block is rendered with project name, drawn-by, sheet number, date, and scale. Portrait/landscape orientation is auto-detected from the drawing extents.

**PNG Export (`src/engine/png-export.ts`)**
Canvas `toDataURL('image/png')` for quick screen-resolution raster export when a scaled print is not needed.

**Annotation Export (`src/engine/annotation-export.ts`)**
Exports Survai detection annotations in a structured format for downstream consumption by construction documentation tools.

### 2.9 Survai Integration: Scan-to-Design Workflow

This is the primary remaining development milestone for netrun-cad-web (PROJECT_INDEX.md row 23, Sprint 10). The integration is implemented in two layers:

**Service Layer (`src/services/survai.ts`)**

The service layer is production-ready code that establishes the API contract between netrun-cad-web and the Survai Cloud Run backend. Key characteristics:

- API base URL resolved from `VITE_SURVAI_API_URL` env var; falls back to `http://localhost:8000` in development. (`survai.ts:19-21`)
- Bearer token auth via `VITE_SURVAI_TOKEN`. Absent token allows unauthenticated requests (local dev). (`survai.ts:23-25`)
- 15-second request timeout on all API calls; 60-second timeout on model file downloads; 120-second timeout on scan uploads. (`survai.ts:28`, `survai.ts:263`, `survai.ts:307`)
- `SurvaiUnavailableError` is thrown for network-level failures (service down, CORS); `SurvaiApiError` for non-200 HTTP responses. The panel catches `SurvaiUnavailableError` and shows a graceful fallback — the rest of the app continues normally. (`survai.ts:32-50`, `SurvaiPanel.tsx:19`)
- Polling with configurable interval and max attempts: `pollUntilDone()` checks `/scans/{id}/progress` every 2 seconds with up to 150 attempts (5 minutes). (`survai.ts:216-239`)
- `detectionToLayerId()` maps YOLOv8 `feature_type` strings to the three CAD layer targets. (`survai.ts:336-354`)
- `detectionLabel()` formats a detection as `"tree (87%)"` for use as a `TextElement` label in the canvas. (`survai.ts:360-363`)

The Survai API endpoints consumed:
```
GET  /scans                    → listScans()
GET  /scans/{id}/status        → getScanStatus()
GET  /scans/{id}/detections    → merged into getScanStatus() when completed
GET  /scans/{id}/progress      → pollUntilDone()
GET  {model_url}               → downloadScan() — signed GCS URL or relative path
POST /scans/upload             → uploadScan() — multipart/form-data
```
Source: `src/services/survai.ts:179-327`

**UI Layer (`src/components/SurvaiPanel/SurvaiPanel.tsx`)**

The `SurvaiPanel` component renders two tabs:

- **My Scans tab**: Lists all scans for the authenticated user. Completed scans show a thumbnail (if available) and an "Import to Canvas" button. Processing scans show an animated five-step progress indicator. The five steps — Upload, Mesh Processing, ML Detection, Route Estimation, Complete — are defined in `PROCESSING_STEPS` at `SurvaiPanel.tsx:69-75` and map to progress percentage ranges from the Survai API.
- **Upload tab**: Drag-and-drop or file picker interface for sending a new OBJ/PLY/GLB file to Survai for processing.

On "Import to Canvas", the panel executes the following sequence:
1. Downloads the processed model file from Survai (`downloadScan()`)
2. Parses the file via `parseOBJ()` or `parsePLY()` based on filename extension
3. Runs `processScan()` to project the 3D point cloud to plan view and generate boundary/contour elements
4. Places each detection from the Survai JSON as a labeled `TextElement` on the appropriate layer, using `detectionToLayerId()` and `detectionLabel()`
5. Calls `onImport(elements, newLayers)` — the same callback interface used by the local `ScanImportModal` — to add the elements to the live canvas
Source: `SurvaiPanel.tsx:1-19`

**Integration with the Survai Backend**

The Survai backend (`/data/workspace/github/Survai/CLAUDE.md`) runs as a GCP Cloud Run service in the same GCP project. The ML pipeline orchestrator (`Survai/CLAUDE.md:94`) coordinates: OBJ/PLY/GLB import, UV extraction, YOLOv8 2D detection with SAM segmentation, PointNet++ 3D detection, detection fusion, route estimation, material catalog matching, and JSON/CSV/GeoJSON export. The 19 MEP catalog CSV files covering NEC, IPC, ASHRAE, TIA/EIA, and ENERGY STAR standards (`Survai/CLAUDE.md:157-159`) provide the material selection data that backs the route estimation output.

netrun-cad-web consumes only the final detection JSON from this pipeline — it does not execute any ML inference itself. The Survai API abstracts the split-worker architecture (`Survai/CLAUDE.md:83-91`) away from the CAD client; whether inference runs inline or on a separate ML worker container is transparent to netrun-cad-web.

**Scan-GIS Alignment for Construction Workflows**

When a construction user imports a scan and also has a GIS parcel loaded (via GeoJSON/KML or the Esri basemap), the `scan-gis-alignment.ts` module provides automatic alignment. The alignment editor (`src/components/AlignmentEditor/AlignmentEditor.tsx`) presents the computed transform with a confidence indicator and allows the user to accept or adjust before applying. This is particularly useful for MEP planning, where the scan must be geo-referenced correctly before distances and positions can be dimensioned.

### 2.10 Google Drive Integration

The Google Drive integration (`src/services/google-drive.ts`) uses the Google Identity Services (GIS) for OAuth and the Drive Picker API for the native file browser. All file operations are client-side — no custom backend is involved.

OAuth scopes: `https://www.googleapis.com/auth/drive.file` (access only to files created by this app). (`google-drive.ts:28`)

The `.ncad` file format uses MIME type `application/x-netrun-cad` (`google-drive.ts:31`) and is stored in a `Netrun CAD Projects` folder created automatically on first save. (`google-drive.ts:33`)

The `NetrunCADProject` interface (`google-drive.ts:46-62`) is the on-disk schema version 1.0:
```
version, name, client, address, created, modified, scale,
layers[], elements[], basemap?, gridSettings?, view?
```

Auto-save runs every 5 minutes when the user is signed into Google Drive. (`CLAUDE.md:167`)

The authorized JavaScript origins for the OAuth client include `https://cad.netrunsystems.com` and `http://localhost:5173`. Adding `cad.netrunsystems.com` to the GCP Console credential is a pending Daniel-only action (PROJECT_INDEX.md DANIEL TIME QUEUE item 11) that gates Google Drive save/share in the production deployment.

A `share` operation generates a view-only Drive link for the `.ncad` file, suitable for sending to a client for review. (`CLAUDE.md:168`)

### 2.11 GIS Basemap and Parcel Data

**Satellite Basemap**

The `BasemapRenderer.ts` (`src/components/Basemap/BasemapRenderer.ts`) fetches Esri World Imagery tiles at the configured zoom level and composites them underneath the CAD elements on the canvas. Tiles are cached in memory for the session. The `BasemapPanel.tsx` provides an address search field backed by Nominatim (OpenStreetMap geocoding API) — the user types a property address and the basemap centers on that parcel. (`CLAUDE.md:137-141`)

**Parcel Lookup**

The `src/services/parcel-lookup.ts` service handles APN (Assessor's Parcel Number) lookups and parcel boundary queries, enabling the scan-GIS alignment workflow to reference the legal parcel boundary when aligning a site scan.

**GIS Layer Visibility**

The basemap and parcel boundary are toggled independently of the drawing layers. This allows the designer to use the satellite image as a tracing reference during the site measurement phase, then hide it for the client presentation layer.

### 2.12 Plant Database

`src/data/plants.ts` contains a curated database of Southern California and Ojai-adapted landscape plants (`plants.ts:16`). Each `Plant` record carries:

- Common name and botanical name
- Plant type: tree, shrub, perennial, groundcover, grass, succulent, vine
- WUCOLS IV water use classification: low, moderate, high
- Sun exposure: full-sun, partial-shade, full-shade
- USDA hardiness zone range
- Mature width and height in feet
- A CAD symbol character and canopy color for plan-view rendering

(`src/data/plants.ts:1-13`)

The plant database includes representatives from all major landscape categories appropriate for Southern California: oaks, olives, jacarandas, lavender, rosemary, manzanita, California native shrubs, Mediterranean perennials, succulents, and ornamental grasses.

Plants are placed on the canvas via the `PlantBrowser` panel (`src/components/PlantPanel/PlantBrowser.tsx`) as `PlantPlacement` elements (`src/engine/types.ts:107-115`). The `symbol-loader.ts` engine generates 40 landscape plant symbols derived from the netrun-cad desktop application's symbol set. (`CLAUDE.md:93`)

### 2.13 Hostname-Based Product Mode

The same built application artifact serves two distinct product experiences via hostname detection in `src/App.tsx:22-29`:

```typescript
// src/App.tsx:21-28
type AppMode = 'landscape' | 'construction';

function detectMode(): AppMode {
  if (typeof window === 'undefined') return 'landscape';
  const host = window.location.hostname;
  if (host.startsWith('survai.')) return 'construction';
  return 'landscape';
}
```

The behavioral differences between modes:

| Aspect | Landscape Mode (cad.netrunsystems.com) | Construction Mode (survai.netrunsystems.com) |
|--------|----------------------------------------|----------------------------------------------|
| Landing page | Skipped — canvas loads immediately | Survai-branded marketing landing page shown first |
| Document title | "Netrun CAD — Landscape Design" | "Survai Construction" (from PWA manifest) |
| Default layers | Site, hardscape, planting, notes | Site, scan, MEP, annotations |
| Primary user | Landscape designer (Allie) | Construction professional, MEP planner |
| Key panels | Plant browser, basemap, KIRI scan | Survai panel, alignment editor, route editor |

The single-codebase dual-mode approach means product updates ship to both audiences simultaneously and infrastructure costs are not doubled.

### 2.14 Offline and PWA Infrastructure

The application is a Progressive Web Application. The PWA manifest (`public/manifest.json`) configures name, icons, display mode, and start URL for the two product modes. Service worker registration enables installation to the iPad home screen, after which the core application shell and cached tile data are available offline.

`src/services/offline-storage.ts` manages the local persistence layer, supplementing `localStorage` for larger project data when Drive sync is unavailable.

Push notifications (`src/services/push-notifications.ts`) are used by the `SurvaiPanel` to alert the user when a cloud scan finishes processing. The notification is sent via `sendLocalNotification()` when `pollUntilDone()` resolves. (`SurvaiPanel.tsx:46-47`)

---

## 3. Production State

| Aspect | State |
|--------|-------|
| Hosting | Google Cloud Run, us-central1, project gen-lang-client-0047375361 |
| Container registry | us-central1-docker.pkg.dev/gen-lang-client-0047375361/charlotte-artifacts |
| Primary URL | https://cad.netrunsystems.com |
| Construction URL | https://survai.netrunsystems.com (same Cloud Run service, hostname routing) |
| HTTP status | 200 OK (verified May 1, 2026) |
| CI/CD | Cloud Build on push to main |
| Database | None — client-side only (localStorage + Google Drive) |
| Last commit | Phase C complete — IFC import, project dashboard, 3D mesh rendering, offline mode (commit `c6bce53`, git log) |
| Completion | 92% (PROJECT_INDEX.md row 23, updated May 2, 2026) |
| Primary users | Allie Garza (landscape design) + Survai customers (construction, MEP) |
| Paid customer count | Internal revenue SKU — not yet tracking paid seat count |
| Google Drive OAuth | cad.netrunsystems.com authorized origin pending GCP Console update (DANIEL TIME QUEUE item 11) |

**Production Health History (March 25, 2026):** netrun-cad-web listed as production service "Netrun CAD" returning 200 OK in the full 17-service health table (PROJECT_INDEX.md Production Health table, row 11).

---

## 4. Differentiation

The landscape and construction professional CAD market has four categories of alternatives, each with a distinct limitation profile relative to netrun-cad-web.

### Direct Comparison Table

| Capability | Netrun CAD Web | AutoCAD Web | DraftSight (Web) | Concepts (iPad) | OnShape |
|------------|----------------|-------------|------------------|-----------------|---------|
| iPad + Apple Pencil freehand | Native first-class mode | Limited touch, no pressure | No Apple Pencil support | Freehand only, no CAD | No freehand |
| CAD precision tools | Line, rect, circle, dim + 88 AutoCAD aliases | Full AutoCAD feature set | Full DraftSight set | None | Full parametric CAD |
| Freehand over CAD layers | Same canvas, same layers | Not supported | Not supported | Freehand only | Not supported |
| Pressure-sensitive watercolor | Built-in Color mode | Not available | Not available | Yes | No |
| Plant database + WUCOLS | 20+ SoCal plants built in | None | None | None | None |
| Survai / 3D scan import | OBJ, PLY, IFC, GLB — direct import | DXF only | DXF only | No import | STEP/IGES only |
| MEP detection visualization | From Survai API (YOLOv8 detections) | Not available | Not available | Not available | Not available |
| Satellite basemap (Esri) | Built in, Nominatim geocoding | Requires Autodesk account | Not built in | Not available | Not available |
| GeoJSON / KML import | Both supported | Not available | Not available | Not available | Not available |
| Google Drive storage | Native .ncad format | Autodesk cloud only | DraftSight cloud only | iCloud only | OnShape cloud |
| PDF export with scale | ARCH D, E, Letter, Tabloid | Yes (subscription) | Yes (subscription) | Basic only | Yes (subscription) |
| DXF export | DXF R12 | DXF R2018 | DXF full | Not available | DXF/STEP/IGES |
| Offline / PWA | Full offline after first load | Requires connectivity | Requires connectivity | Yes (native app) | Requires connectivity |
| Subscription cost | No per-seat fee (internal SKU) | $440-600/year | $149-449/year | $9.99/year | $1,500+/year |
| Landscape-specific workflow | Complete (measure → CAD → sketch → color → PDF) | None | None | Sketching step only | None |
| Construction / MEP workflow | Survai scan integration, IFC import, route editor | Manual DXF workflow | Manual DXF workflow | None | Parametric, no scan |

### Key Differentiators (Non-Marketing)

**Unified mode canvas.** Competing tools force the user to choose between precise CAD and freehand sketching by switching applications. Netrun CAD Web places all four modes over a single shared layer system. The site boundary drawn in CAD mode is the reference geometry that the Apple Pencil planting sketch in Draw mode overlays. There is no file transfer between steps.

**Survai scan-to-plan pipeline.** No other landscape or light construction CAD tool has a direct API integration with a 3D LiDAR scan processing service that outputs YOLOv8 MEP detections. The workflow — scan site with iPhone, process in Survai, open CAD app, find detections already placed on correct layers — has no equivalent in any alternative listed above.

**IFC import in a browser.** IFC (Industry Foundation Classes) is the international standard for BIM data exchange. Parsing IFC in a browser without a native install or backend server is architecturally nontrivial; `web-ifc` makes it possible, and the layer mapping in `ifc-import.ts:20-30` provides a CAD-ready floor plan from a BIM model in seconds.

**Southern California native plant database with WUCOLS IV ratings.** AutoCAD, DraftSight, and OnShape have no plant data whatsoever. The WUCOLS IV water-use classifications (very low / low / moderate / high) matter for California landscaping — a design presented to a homeowner without water use context is an incomplete professional deliverable in a drought-aware market.

---

## 5. Pricing

Netrun CAD Web is currently an internal revenue SKU. Allie Garza uses it for paid landscape design client work, generating revenue for Netrun Systems through the design services she delivers. There is no public subscription page at this time.

The pricing model for external customers is under evaluation. The hostname-based dual-mode architecture supports differentiated pricing between the landscape product (cad.netrunsystems.com) and the Survai construction product (survai.netrunsystems.com). The `src/components/Pricing/` directory contains a pricing page component and the `src/services/api.ts` service includes Stripe checkout session integration (`src/services/api.ts` — established in commit `12287c8: Add pricing page, account management, and Stripe checkout integration`).

When the Survai cloud scan integration milestone is complete, the expected pricing model is:

- **Landscape CAD**: Per-seat annual subscription for landscape professionals; includes plant database, Apple Pencil modes, Google Drive sync, DXF/PDF export.
- **Survai Construction**: Seat license bundled with Survai API access; priced per organization to align with Survai's per-scan processing cost model.

No specific price points are committed in this document. Any published pricing will be set and announced by Daniel Garza.

---

## 6. Limitations and Future Work

### 6.1 Resolved in v1.1 (May 9-11, 2026 closeout sprint)

Every gap named in v1.0 §6.1 shipped during the May 9-11 sprint. They are listed here for changelog visibility:

- **Google Drive OAuth** — Daniel added `cad.netrunsystems.com` and `survai.netrunsystems.com` to the GCP Console OAuth client (both authorized JS origins and authorized redirect URIs). Dockerfile build args + Secret Manager wiring inject `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` into the production bundle (previous deploys shipped them empty). `nginx.conf` sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` so the GIS popup can `postMessage` back to the opener. Drive save / share / open works end-to-end in production.
- **Element selection and property editing** — `PropertyPanel` (per-type editor) and `MultiPropertyPanel` (group editor) ship. Selection supports click + shift-click toggle + window/crossing marquee. Drag-to-move + arrow-nudge work for single and multi. Resize handles render around the bbox (single) or union bbox (multi). Reorder, delete, layer-change, color-change all wired.
- **Freehand DXF stroke bloat** — iterative Ramer-Douglas-Peucker simplification (1.5 canvas-px tolerance, well below pen thickness) cuts 480-vertex strokes to a fraction with no visible quality loss.
- **Advanced dimension tools** — aligned, angular (3-point), radius (2-point), diameter (2-point) all wired. CADDimension grew a `dimStyle` field and optional `p3` (angular vertex). Linear dimensions also got the AutoCAD DIMLINEAR projection (drops to dominant axis + reports projected length).
- **Polyline, arc, ellipse, spline CAD tools** — all four shipped with full pipeline coverage (types, selection, render, SVG, DXF, useCADTools accumulation, PropertyPanel). The "Unimplemented CAD tools" no-op block is empty for the documented list.
- **Block library + symbol insertion** — built-in 8-block landscape catalog (bench, table+chairs, planter, gazebo, pergola, stepping stone, gate, path light) plus user-defined custom blocks (define-from-selection, persists to localStorage, syncs cross-device via Drive).
- **Irrigation planning overlay** — 4 head types (rotor 15ft / spray 8ft / drip 2ft / bubbler 4ft) with industry-typical GPM rates (4 / 2 / 0.5 / 1), 8 color-coded zones, translucent coverage discs at 20% fill, IrrigationPanel for placement, IrrigationScheduleDialog with per-zone GPM totals (capacity-warning banner if any zone exceeds 12 GPM = typical residential 3/4″ service peak).
- **Plant schedule auto-generation** — `generatePlantSchedule(elements, PLANT_DATABASE)` groups by botanical, sums coverage, bins by water-use category. Renders as a modal table with summary chips (placements / species / % low-water). CSV download via Blob; PDF export via the lazy-loaded jsPDF chunk. PDF includes a WUCOLS verdict line (✓ "qualifies as water-wise design" at 75%+ low-water).

### 6.2 Resolved scaling concerns

- **Large point clouds (>500K vertices)** — OBJ + PLY parsing moved into a Web Worker (`src/workers/scan-parser.worker.ts`); the main thread stays responsive during import. Three callers (ScanImportModal, SurvaiPanel, pointcloud-loader) updated to use the Promise-based wrapper at `src/engine/scan-parser-worker.ts`.
- **First-paint critical-path JS** — Vite `manualChunks` split + lazy `React.lazy` for ModelViewer3D + dynamic `import()` for web-ifc and jsPDF cut first-paint from 4.45 MB raw / 733 KB gzip to 515 KB raw / 172 KB gzip (**77% smaller**). The 3.6 MB web-ifc WASM, 1 MB three.js bundle, and 360 KB jsPDF chunk are now fetched only when the user triggers their respective features.

The renderer-redraws-everything concern from v1.0 §6.2 is unchanged — at >5,000 elements low-zoom the 60fps target may not hold on older iPad hardware. Dirty-region invalidation is on the v2 list.

### 6.3 Open in v2 (see `TODO.md`)

What's left after the v1.1 sprint is genuinely v2 territory — not gaps in the v1 surface:

- **Live multi-user collaboration** (WebSocket / CRDT) — single-user `.ncad` files; two designers editing the same project simultaneously will still overwrite each other.
- **Express backend + `@netrun/auth-client`** — the app is fully client-side; auth is Google Identity Services only.
- **DXF SPLINE entity** — splines export as a 12-vertex-per-segment polyline approximation today; the real DXF SPLINE carries knot vectors + weights.
- **DXF BLOCK + INSERT entities** — block instances export as resolved geometry today; real BLOCKS section + INSERT entities would let downstream CAD edit-in-place.
- **Multi-rotate** — multi-resize works; rotation handle on the union bbox is the v2 piece.
- **Per-emitter scheduling controllers** — irrigation models the static layout (heads, zones, GPM); v2 would add zone runtimes + controller programs (start time, days, seasonal adjustment, rain sensors).
- **ETo-based water budget** — pull USDA / CIMIS daily reference evapotranspiration for the project's lat/lng (basemap already has it) and compute zone runtime from coverage area + plant water-use coefficients (WUCOLS data already there) + ETo. Reports gallons/month/zone; flags zones that exceed local water-use restrictions.
- **Live team-shared block library** — custom blocks today sync per-Google-account via Drive; team-level sharing needs a server-side directory.
- **IFC + DXF Web Worker parsing** — OBJ + PLY moved off-thread; IFC and DXF parsing still run on the main thread (~50 ms typical, up to several seconds for very large commercial IFC).
- **Plotter direct-print over LAN** + **PDF title-block templates** — current PDF export has a built-in title block; allowing user-uploaded templates and direct plotter output unlock printshop-style workflows.
- **Export integrations** — IrrigationPro, Hunter Centralus, Rain Bird IQ, Land F/X, DynaSCAPE.

The full v2 backlog with scoping notes lives in `TODO.md`.

### 6.4 Survai cloud integration

`SurvaiPanel` and the `src/services/survai.ts` API client are production-ready. The remaining work is wiring `VITE_SURVAI_API_URL` and `VITE_SURVAI_TOKEN` into the Cloud Run deployment, which requires a Survai authentication token to be provisioned in GCP Secret Manager (decisions about per-org vs per-seat auth models pending). When that lands, an end-to-end "iPhone scan → Survai inference → CAD plan with detection markup" flow goes live in the construction-mode deployment.

---

## 7. References

### Source Code (file:line)

- `netrun-cad-web/CLAUDE.md:1-7` — project overview, live URL, stack summary
- `netrun-cad-web/CLAUDE.md:17` — standalone SPA, not Sigil plugin
- `netrun-cad-web/CLAUDE.md:22-25` — HTML5 Canvas 2D (not SVG), perfect-freehand, Vite 6, localStorage + Google Drive
- `netrun-cad-web/CLAUDE.md:37-101` — full project directory tree with component descriptions
- `netrun-cad-web/CLAUDE.md:107-112` — command line behavior (AutoCAD compatibility)
- `netrun-cad-web/CLAUDE.md:137-141` — GIS basemap (Esri tiles, Nominatim geocoding)
- `netrun-cad-web/CLAUDE.md:143-148` — KIRI 3D scan import (OBJ/PLY, convex hull, contours, decimation)
- `netrun-cad-web/CLAUDE.md:149-151` — GeoJSON/KML import
- `netrun-cad-web/CLAUDE.md:155-158` — DXF import entity types; DXF R12 export
- `netrun-cad-web/CLAUDE.md:159-164` — PDF export scales, page sizes, title block
- `netrun-cad-web/CLAUDE.md:165-169` — Google Drive .ncad format, auto-save
- `netrun-cad-web/CLAUDE.md:212-219` — PointerEvent API, Apple Pencil, two-finger gestures, long-press, touch-action
- `netrun-cad-web/CLAUDE.md:225-231` — deployment (Cloud Run, Cloud Build)
- `netrun-cad-web/CLAUDE.md:236-244` — documented future work
- `netrun-cad-web/src/App.tsx:16-54` — hostname-based product mode detection, title override
- `netrun-cad-web/src/engine/types.ts:1-160` — complete type system (Point, StrokePoint, AppMode, all CADElement variants, Layer, ViewState, GridSettings)
- `netrun-cad-web/src/engine/commands.ts:1-10` — Command interface definition
- `netrun-cad-web/src/engine/commands.ts:14-60` — AutoCAD LT 2014 alias table (Draw and Modify sections)
- `netrun-cad-web/src/engine/scan-processor.ts:1-55` — ScanProcessOptions, ScanOutputMode, projection logic, contour generation
- `netrun-cad-web/src/engine/scan-gis-alignment.ts:1-35` — AlignmentResult type, bounding box alignment strategy
- `netrun-cad-web/src/engine/ifc-import.ts:1-40` — IFC layer mapping, metres-to-feet conversion
- `netrun-cad-web/src/engine/pdf-export.ts:1-50` — ScaleOption, PageSizeOption definitions
- `netrun-cad-web/src/services/survai.ts:1-364` — complete Survai service layer
- `netrun-cad-web/src/services/survai.ts:19-25` — API URL and token config
- `netrun-cad-web/src/services/survai.ts:32-50` — error types (SurvaiUnavailableError, SurvaiApiError)
- `netrun-cad-web/src/services/survai.ts:55-85` — SurvaiScan and Detection types
- `netrun-cad-web/src/services/survai.ts:216-239` — pollUntilDone polling loop
- `netrun-cad-web/src/services/survai.ts:336-363` — detectionToLayerId, detectionLabel
- `netrun-cad-web/src/services/google-drive.ts:1-33` — OAuth scope, MIME type, folder name
- `netrun-cad-web/src/services/google-drive.ts:46-62` — NetrunCADProject schema v1.0
- `netrun-cad-web/src/components/Canvas/CADCanvas.tsx:1-60` — orchestration component imports (all hooks, panels, services)
- `netrun-cad-web/src/components/Canvas/usePointerEvents.ts:1-50` — pointer capture, setPointerCapture
- `netrun-cad-web/src/components/SurvaiPanel/SurvaiPanel.tsx:1-80` — panel description, processing steps, tab layout
- `netrun-cad-web/src/data/plants.ts:1-50` — Plant interface, PLANT_DATABASE curated entries

### External Project Cross-References

- `Survai/CLAUDE.md:64-109` — full pipeline architecture (KIRI Engine → FastAPI orchestrator → YOLOv8/PointNet++/SAM → MEP catalogs)
- `Survai/CLAUDE.md:83-91` — split worker architecture (inline vs remote ML_WORKER_MODE)
- `Survai/CLAUDE.md:104-117` — backend module map (API routes, processing, DB, storage, auth)
- `Survai/CLAUDE.md:119-127` — Survai frontend (Three.js 3D viewer, React Query, React Router)
- `Survai/CLAUDE.md:157-159` — 19 MEP catalog CSVs (NEC, IPC, ASHRAE, TIA/EIA, ENERGY STAR)

### Portfolio Registry

- `boardroom/PROJECT_INDEX.md:94` — netrun-cad-web row: "Primary CAD interface project (React/TS, iPad + Apple Pencil) AND Survai frontend — unified web client for both landscape CAD and 3D MEP scan workflows", Prod/Active, 92%
- `boardroom/PROJECT_INDEX.md:90` — Survai row: "Live MEP detection — 3D scan (LiDAR/YOLOv8) → UE5 MEP planning pipeline. Frontend integration via netrun-cad-web (primary CAD interface).", Prod/Active, 60%
- `boardroom/PROJECT_INDEX.md:93` — netrun-cad (desktop) row: "secondary/desktop role since netrun-cad-web is now primary interface", Dev/Active, 70%

### Git History (60-day log, selected commits)

| Commit | Description |
|--------|-------------|
| `1b97091` | feat: hostname-based product mode — landscape on cad.netrunsystems.com |
| `6158e25` | feat: Product landing page for survai.netrunsystems.com |
| `c6bce53` | feat: Phase C complete — IFC import, project dashboard, 3D mesh rendering, offline mode |
| `64541ca` | feat: Phase B complete — email share, route tutorial, recent projects, linked annotations, push notifications |
| `12287c8` | feat: Add pricing page, account management, and Stripe checkout integration |
| `713a71b` | feat: Add Google federated login — single sign-in for Drive + Survai API |
| `b185ae9` | feat: Merge Netrun CAD + Survai into unified construction CAD platform |
| `b902384` | feat: Add Survai cloud scan integration plugin |
| `a950579` | feat: Add AutoCAD LT 2014 command line, 88 aliases, context menu, and status bar |
| `32f4c64` | Add Google Drive integration for project file management |
| `c6f6270` | feat: Add GIS basemaps, GeoJSON/KML import, and KIRI 3D scan import |
| `0e56ae8` | feat: DXF import/export, PDF export, and landscape symbol library |
| `584917f` | feat: Initialize netrun-cad-web — landscape design app with Apple Pencil support |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| .ncad | Netrun CAD project file format (JSON, MIME type `application/x-netrun-cad`) |
| APN | Assessor's Parcel Number — the unique identifier for a parcel of land in California county records |
| ARCH D | Architectural drawing sheet size: 24 x 36 inches |
| ARCH E | Architectural drawing sheet size: 36 x 48 inches |
| CADElement | The union type covering all drawable element variants in the Netrun CAD engine |
| CRDT | Conflict-free Replicated Data Type — the data structure approach used for collaborative real-time editing (planned, not implemented) |
| DXF | Drawing Exchange Format — AutoCAD's interoperable CAD file format |
| GIS | Geographic Information System |
| IFC | Industry Foundation Classes — international standard for BIM data exchange (ISO 16739) |
| KIRI Engine | iOS LiDAR and photogrammetry app used to scan sites before Survai processing |
| MEP | Mechanical, Electrical, Plumbing — the building systems detected and routed by the Survai ML pipeline |
| OBJ | Wavefront Object — 3D mesh file format output by KIRI Engine |
| PLY | Stanford Triangle Format / Polygon File Format — point cloud format output by KIRI Engine |
| PWA | Progressive Web Application — a web app installable on device with offline capability |
| WUCOLS IV | Water Use Classification of Landscape Species, 4th edition — UC Davis water-use rating system used in California landscaping |

---

## Appendix B: API Contract Summary (Survai Integration)

The following endpoints are consumed by netrun-cad-web from the Survai Cloud Run backend. The Survai API is defined by `Survai/backend/api/routes/` and validated by `src/services/survai.ts`.

```
GET  /scans
     → SurvaiScan[]   (listScans)

GET  /scans/{id}/status
     → { id, filename, status, progress, message, model_url, thumbnail_url }

GET  /scans/{id}/detections
     → { detections: Detection[] }
     Detection: { id, feature_type, confidence, coordinates: {x,y,z},
                  bounding_box?, metadata? }

GET  /scans/{id}/progress
     → { status, progress: 0-100, message }

POST /scans/upload
     Content-Type: multipart/form-data
     body: file (OBJ | PLY | GLB)
     → { id | scan_id }

GET  {model_url}
     Signed GCS URL or relative API path
     → ArrayBuffer (OBJ or PLY file bytes)
```

Auth: `Authorization: Bearer {VITE_SURVAI_TOKEN}`. Requests without the token attempt unauthenticated access (development only).

Timeout policy: 15s for status/list endpoints; 60s for model download; 120s for upload. Retry: caller-managed (SurvaiPanel retries on SurvaiUnavailableError with user notification).
