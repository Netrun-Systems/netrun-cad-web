# TODO


## 🚨 EMERGENCY (P0) — 2026-05-17 — Infra Reconciliation Audit Required

**STOP** — before resuming normal roadmap work on this project, every
agent (human or AI) MUST audit this project against the canonical
incident report:

  - Local path: `boardroom/decisions/2026-05-17-INFRA_RECONCILIATION-multi-project-changes.md`
  - GitHub: https://github.com/Netrun-Systems/boardroom/blob/main/decisions/2026-05-17-INFRA_RECONCILIATION-multi-project-changes.md

Per-service checklist to run (gate on each item before resuming roadmap):

1. **Gemini / Vertex API** — does this service still call Gemini with
   the old shared `AIzaSy*` key, or with a per-service restricted
   key? `grep -rn 'AIzaSy[A-Za-z0-9_-]\{33\}' .` should return nothing.
2. **Runtime service account** — is this service on
   `<svc>-runtime-sa@gen-lang-client-0047375361.iam.gserviceaccount.com`
   or still on `default compute SA` / `devbox-sa`? Check via
   `gcloud run services describe <svc> --format='value(spec.template.spec.serviceAccountName)'`.
3. **Pulse JWT** (if this project hits `/capability/dispatch`) — must
   use `aud="pulse-frontend"`, `iss="pulse.netrunsystems.com"`, fetched
   fresh from `pulse-jwt-signing-key-production:latest`. The misleading
   "Signature verification failed" message is usually aud/iss
   mismatch, not the signing key.
4. **Cloud SQL** — is `DATABASE_URL` bound to a per-service secret
   (`<svc>-database-url`) or the shared `database-url`? Postgres
   password rotated 2026-05-06.
5. **Gmail OAuth** (if this project sends mail) — currently working
   because `netrun-gmail-campaign` was undeleted 2026-05-17, but a
   rotation to a Charlotte-owned OAuth client is pending.

After running the checklist, record findings in this project's docs/
(brief audit note: what changed for this project, what remains, the
verification commands run) **before** resuming any other todo item.

This task supersedes other in-progress items until completed.

---

Tracking what's left after the May 9-11, 2026 v1-completion sprint. Everything in the whitepaper §6.1 future-work list and every "Unimplemented CAD tool" no-op shipped during that sprint; what remains is genuinely v2 territory.

## v2 — features

These are next-version capabilities, not gaps in v1.

### Live multi-user collaboration

WebSocket / CRDT for multiple designers editing the same `.ncad` project at once. Last-write-wins and the auto-save 5-minute window get the job done for the single-user case but two designers in the same file today will overwrite each other.

Open questions before scoping: Yjs vs Automerge vs a custom delta protocol; presence indicators (cursors, selections); per-user undo stacks vs shared.

### Express backend + `@netrun/auth-client`

Currently the app is fully client-side; Google Identity Services owns auth and Drive owns persistence. Moving to an Express backend with the shared `@netrun/auth-client` would unlock RBAC, project-level sharing semantics outside Drive's per-file ACLs, and a place to put server-side rendered exports (PDF preview, headless DXF generation for plotters).

### Per-emitter scheduling controllers

The irrigation overlay currently models the static layout (heads + zones + GPM). A controller layer would add: zone runtime in minutes, controller program (start time, days), seasonal adjustment, sensor inputs (soil moisture, rain). Outputs would feed a real Hunter / Rain Bird / Rachio config export.

### Water budget against ETo

Pull USDA / CIMIS daily reference evapotranspiration for the project's lat/lng (basemap already has it) and compute zone runtime from coverage area + plant water-use coefficients (WUCOLS data already there) + ETo. Reports gallons/month/zone and flags zones that exceed the local water-use restrictions.

### Live multi-tenant block library

Custom blocks today sync per-Google-account via Drive. A team library — Allie's blocks shared with her crew — would need a server-side directory with per-team membership, public/private flags, and an upload moderation pass.

### Export integrations

- IrrigationPro — direct push of the irrigation schedule + DXF
- Hunter Centralus / Rain Bird IQ — controller program export
- Land F/X / DynaSCAPE — landscape-design DXF compatibility profiles
- Plotter direct-print over LAN

## v2 — engineering polish

These are quality-of-implementation items where v1 ships a working version and v2 would do it more thoroughly.

### DXF SPLINE entity

Splines currently export as a 12-vertex-per-segment polyline approximation. The real DXF SPLINE entity carries knot vectors + weights — bigger lift but lossless round-trip with AutoCAD.

### DXF BLOCK / INSERT entities

Block instances currently export as resolved geometry (each instance's child elements with the transform pre-baked). A real BLOCKS section + INSERT entities would let downstream CAD tools see the block boundary and edit-in-place. Also enables a separate AutoCAD .dwg file per block for re-use across drawings.

### Per-quadrant arc bbox

The arc bbox helper uses the full circle bbox today — slightly larger than the actual arc, no functional impact, but the selection highlight rectangle is bigger than necessary. Tight per-quadrant bbox is straightforward but wasn't worth the complexity for v1.

### Tighter spline bbox

Same idea as arc — the spline bbox is computed from a 12-sample sweep. Catmull-Rom can technically overshoot the control points at high tension, and the sample-based bbox may miss the actual extremum. Analytic curve-extremum solving would be tighter.

### Multi-rotate

Multi-resize landed; multi-rotate didn't. Would need a rotation handle on the union bbox (a small circle above the top-center handle) that rotates every selected element about the union centroid.

### Free-rotate single elements

Right now the only rotatable elements via PropertyPanel are text, ellipse, and interior-symbol. Adding a rotation field to lines, rectangles, polylines etc. is small. The "rotate around a point you click" gesture is a natural follow-up.

### Web Worker for IFC + DXF parsing

OBJ/PLY parsing moved to a worker. IFC and DXF parsing still run on the main thread — they're typically smaller (~50 ms for a residential floor plan) so the freeze is barely perceptible, but on a large commercial IFC model you'd feel it. Same pattern as `scan-parser.worker.ts` would apply.

### Crossing-window for diagram mode

Marquee selection in the canvas works for both window and crossing modes. Diagram mode (flowchart shapes, connectors) currently only supports the window form.

### Zone-area calculator for irrigation

The irrigation schedule reports GPM but not the area each zone covers. A calculator that sums the coverage-disc areas per zone (with overlap deduplication) would give designers a quick "this zone covers 1,400 sq ft" readout that maps to the actual water demand.

### iPad-specific PWA install banner

The `beforeinstallprompt` event is preventDefault'd today (a benign console warning). A polished install flow would show a custom button when the event fires, then call `prompt()` on click.

## Reported issues

None outstanding from the May 9-11 sprint. Console output during the sign-in flow shows two informational warnings from `gapi.loaded_0` about Cross-Origin-Opener-Policy migration; both are GIS preparing for FedCM and don't affect functionality.

## Scope-of-work backlog (needs design conversation)

Items where the technical scope is clear but a product decision needs to land first:

- **Irrigation valve symbols + manifold layout.** Heads alone don't make an installable plan; valves and the supply-line topology are the rest of the picture. Industry-standard symbols exist (NEMA / ASPE) but choosing a subset is a product call.
- **Plant water budget.** Combine plant water-use class (WUCOLS) + irrigation zone + monthly ETo into a per-month gallons-per-plant calculator. Useful for SoCal compliance reports; needs an ETo data source decision (CIMIS for California, NOAA for elsewhere).
- **Detail callouts (with bubble + linework).** The dimension tools handle measurements; a "callout" tool would draw a leader from a point in plan to a labeled bubble for keyed details. Standard architectural convention; small to add.
- **Title block templates.** PDF export has a built-in title block today. Allowing user-uploaded title-block templates would let firms with established branding standards reuse them.
