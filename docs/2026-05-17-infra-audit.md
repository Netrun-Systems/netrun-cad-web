# 2026-05-17 Infra Reconciliation Audit — netrun-cad-web

**Audit date**: 2026-05-18
**Auditor**: @security-engineer (autonomous board-dispatch from 2026-05-18-board-meeting.md)
**Incident reference**: project_charlotte_api_key_incident.md (May 13-15 GCP suspension, 53h)
**Cloud Run services covered**: netrun-cad-web

## Controls

| # | Control | Status | Evidence | Action |
|---|---------|--------|----------|--------|
| 1 | Gemini key | GREEN | `grep -rEn 'AIzaSy[A-Za-z0-9_-]{33}'` returned 0 matches. | None |
| 2 | Runtime SA | GREEN | netrun-cad-web -> `netrun-cad-web-runtime-sa@gen-lang-client-0047375361.iam.gserviceaccount.com`. | None |
| 3 | Pulse JWT | N/A | No `/capability/dispatch` usage. | — |
| 4 | DATABASE_URL | N/A | No env vars on the deployed service (frontend-only — talks to a backend API rather than a database directly). | — |
| 5 | Gmail OAuth | N/A | No mail-send code (grep returned 0). | — |

## Findings & Recommendations
- Clean. Frontend deployment — narrow surface. Active priority for Allie's landscape-CAD use (per `project_netrun_cad_allie.md`) — clean audit posture protects an active revenue SKU shipping in days.
- If a backend API tier is added, follow per-service SA + per-service DB secret pattern from the outset.

## Phase E readiness
MEDIUM. Frontend-only deployment is cheap to migrate. If paired with a future netrun-cad-api backend, migrate them as a unit.
