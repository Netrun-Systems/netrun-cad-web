/**
 * Demo project data — pre-built CAD elements simulating a completed
 * scan + blueprint + deviation analysis for a mechanical room (~15m x 10m).
 *
 * All positions are in canvas pixels (PIXELS_PER_FOOT = 48).
 * Conversion: meters * 3.28084 * 48 = pixels
 */

import type { CADElement, CADLine, CADCircle, TextElement } from '../engine/types';
import type { DeviationEntry } from '../engine/deviation-renderer';
import type { Detection3D } from '../components/Viewport3D/ModelViewer3D';

// ─── Constants ──────────────────────────────────────────────────────────────

const PIXELS_PER_FOOT = 48;
const METERS_TO_FEET = 3.28084;

/** Convert meters to canvas pixels */
function m(meters: number): number {
  return meters * METERS_TO_FEET * PIXELS_PER_FOOT;
}

let _id = 0;
function uid(prefix: string): string {
  return `demo-${prefix}-${++_id}`;
}

// ─── Export interface ───────────────────────────────────────────────────────

export interface DemoProject {
  blueprintElements: CADElement[];
  scanDetections: CADElement[];
  deviationElements: CADElement[];
  detection3D: Detection3D[];
  deviationEntries: DeviationEntry[];
}

// ─── Data builder ───────────────────────────────────────────────────────────

export function loadDemoProject(): DemoProject {
  _id = 0; // reset for deterministic IDs

  const blueprintElements: CADElement[] = [];
  const scanDetections: CADElement[] = [];
  const deviationElements: CADElement[] = [];
  const deviationEntries: DeviationEntry[] = [];
  const detection3D: Detection3D[] = [];

  // Room origin at (2m, 2m) — room is 15m wide x 10m tall
  const ox = m(2);
  const oy = m(2);
  const rw = m(15);
  const rh = m(10);

  // ── BLUEPRINT LAYER: Wall outlines ────────────────────────────────────────

  const wallColor = '#9ca3af';
  const wallWidth = 3;

  // 4 walls forming the room rectangle
  const walls: CADLine[] = [
    { type: 'line', id: uid('wall'), p1: { x: ox, y: oy }, p2: { x: ox + rw, y: oy }, layerId: 'blueprint', strokeColor: wallColor, strokeWidth: wallWidth },
    { type: 'line', id: uid('wall'), p1: { x: ox + rw, y: oy }, p2: { x: ox + rw, y: oy + rh }, layerId: 'blueprint', strokeColor: wallColor, strokeWidth: wallWidth },
    { type: 'line', id: uid('wall'), p1: { x: ox + rw, y: oy + rh }, p2: { x: ox, y: oy + rh }, layerId: 'blueprint', strokeColor: wallColor, strokeWidth: wallWidth },
    { type: 'line', id: uid('wall'), p1: { x: ox, y: oy + rh }, p2: { x: ox, y: oy }, layerId: 'blueprint', strokeColor: wallColor, strokeWidth: wallWidth },
  ];
  blueprintElements.push(...walls);

  // ── BLUEPRINT: 8 pipe runs (P-SEGMENT layer — domestic water + drain) ─────

  const pipeColor = '#3b82f6';
  const pipeWidth = 2;

  // 4 horizontal cold water supply pipes along north wall
  for (let i = 0; i < 4; i++) {
    const py = oy + m(1.5 + i * 0.6);
    blueprintElements.push({
      type: 'line', id: uid('pipe'), layerId: 'plumbing-route',
      p1: { x: ox + m(1), y: py }, p2: { x: ox + m(12), y: py },
      strokeColor: pipeColor, strokeWidth: pipeWidth,
    });
  }

  // 4 vertical drain pipes (south side)
  for (let i = 0; i < 4; i++) {
    const px = ox + m(3 + i * 3);
    blueprintElements.push({
      type: 'line', id: uid('pipe'), layerId: 'plumbing-route',
      p1: { x: px, y: oy + m(6) }, p2: { x: px, y: oy + m(9) },
      strokeColor: pipeColor, strokeWidth: pipeWidth,
    });
  }

  // ── BLUEPRINT: 4 HVAC duct runs (M-DUCT layer) ───────────────────────────

  const ductColor = '#06b6d4';
  const ductWidth = 3;

  // 2 horizontal ducts across ceiling
  blueprintElements.push(
    { type: 'line', id: uid('duct'), layerId: 'hvac-route', p1: { x: ox + m(0.5), y: oy + m(4.5) }, p2: { x: ox + m(14.5), y: oy + m(4.5) }, strokeColor: ductColor, strokeWidth: ductWidth },
    { type: 'line', id: uid('duct'), layerId: 'hvac-route', p1: { x: ox + m(0.5), y: oy + m(5.5) }, p2: { x: ox + m(14.5), y: oy + m(5.5) }, strokeColor: ductColor, strokeWidth: ductWidth },
  );
  // 2 vertical supply/return branches
  blueprintElements.push(
    { type: 'line', id: uid('duct'), layerId: 'hvac-route', p1: { x: ox + m(7), y: oy + m(0.5) }, p2: { x: ox + m(7), y: oy + m(4.5) }, strokeColor: ductColor, strokeWidth: ductWidth },
    { type: 'line', id: uid('duct'), layerId: 'hvac-route', p1: { x: ox + m(10), y: oy + m(5.5) }, p2: { x: ox + m(10), y: oy + m(9.5) }, strokeColor: ductColor, strokeWidth: ductWidth },
  );

  // ── BLUEPRINT: 6 electrical outlet positions ──────────────────────────────

  const outletColor = '#f59e0b';
  const outletPositions = [
    { x: ox + m(2), y: oy + m(0.5) },
    { x: ox + m(5), y: oy + m(0.5) },
    { x: ox + m(8), y: oy + m(0.5) },
    { x: ox + m(11), y: oy + m(0.5) },
    { x: ox + m(14), y: oy + m(5) },
    { x: ox + m(14), y: oy + m(8) },
  ];

  for (const pos of outletPositions) {
    blueprintElements.push({
      type: 'circle', id: uid('outlet'), layerId: 'electrical-route',
      center: pos, radius: m(0.15),
      strokeColor: outletColor, strokeWidth: 1.5,
    });
  }

  // ── BLUEPRINT: 3 fixture positions (water heater, sink, electrical panel) ─

  const fixtureColor = '#10b981';
  const fixtures = [
    { center: { x: ox + m(1.5), y: oy + m(8) }, radius: m(0.5), label: 'Water Heater' },
    { center: { x: ox + m(5), y: oy + m(8) }, radius: m(0.35), label: 'Utility Sink' },
    { center: { x: ox + m(13), y: oy + m(1.5) }, radius: m(0.4), label: 'Elec. Panel' },
  ];

  for (const f of fixtures) {
    blueprintElements.push({
      type: 'circle', id: uid('fixture'), layerId: 'blueprint',
      center: f.center, radius: f.radius,
      strokeColor: fixtureColor, strokeWidth: 2,
    });
    blueprintElements.push({
      type: 'text', id: uid('fixture-label'), layerId: 'blueprint',
      position: { x: f.center.x, y: f.center.y + f.radius + 8 },
      content: f.label, fontSize: 10, fontFamily: 'monospace',
      color: fixtureColor, rotation: 0,
    } as TextElement);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCAN DETECTION LAYER — matching elements with slight offsets
  // ═══════════════════════════════════════════════════════════════════════════

  const scanColor = '#ff6e40';
  const smallOffset = m(0.02); // ~20mm offset — realistic installation tolerance

  // Scan walls (slightly offset)
  for (const wall of walls) {
    scanDetections.push({
      ...wall,
      id: uid('scan-wall'),
      layerId: 'scan',
      strokeColor: scanColor,
      p1: { x: wall.p1.x + smallOffset, y: wall.p1.y + smallOffset * 0.5 },
      p2: { x: wall.p2.x + smallOffset, y: wall.p2.y - smallOffset * 0.5 },
    });
  }

  // Scan pipes — most match, 2 intentionally misplaced (POSITION_DEVIATION)
  // First 6 pipes match closely
  const bpPipes = blueprintElements.filter(
    (e) => e.type === 'line' && e.layerId === 'plumbing-route',
  ) as CADLine[];

  for (let i = 0; i < bpPipes.length; i++) {
    const pipe = bpPipes[i];
    const isMisplaced = i === 2 || i === 5; // pipe index 2 and 5 are misplaced
    const offset = isMisplaced ? m(0.35) : m(0.015); // 350mm vs 15mm

    scanDetections.push({
      type: 'line', id: uid('scan-pipe'), layerId: 'scan',
      p1: { x: pipe.p1.x + offset, y: pipe.p1.y + offset * 0.3 },
      p2: { x: pipe.p2.x + offset, y: pipe.p2.y + offset * 0.3 },
      strokeColor: scanColor, strokeWidth: pipeWidth,
    });

    // Build deviation entries for misplaced pipes
    if (isMisplaced) {
      const planned: [number, number] = [
        (pipe.p1.x + pipe.p2.x) / 2 / m(1),
        (pipe.p1.y + pipe.p2.y) / 2 / m(1),
      ];
      const actual: [number, number, number] = [
        planned[0] + 0.35,
        0.5,
        planned[1] + 0.35 * 0.3,
      ];
      deviationEntries.push({
        id: `dev-pipe-${i}`,
        deviation_type: 'POSITION_DEVIATION',
        severity: 'CRITICAL',
        distance_mm: 350,
        planned_position: planned,
        actual_position: actual,
        planned_type: 'pipe_segment',
        actual_type: 'pipe_segment',
        message: `Pipe run #${i + 1} installed 350mm from planned position`,
      });

      // Deviation element: red line from planned to actual center
      const pMid = { x: (pipe.p1.x + pipe.p2.x) / 2, y: (pipe.p1.y + pipe.p2.y) / 2 };
      const aMid = { x: pMid.x + offset, y: pMid.y + offset * 0.3 };
      deviationElements.push({
        type: 'line', id: uid('dev-line'), layerId: 'deviations',
        p1: pMid, p2: aMid,
        strokeColor: '#ef4444', strokeWidth: 2,
      });
      deviationElements.push({
        type: 'text', id: uid('dev-label'), layerId: 'deviations',
        position: { x: (pMid.x + aMid.x) / 2, y: (pMid.y + aMid.y) / 2 - 10 },
        content: '350 mm', fontSize: 11, fontFamily: 'monospace',
        color: '#ef4444', rotation: 0,
      } as TextElement);
    }
  }

  // Scan HVAC ducts — all match closely
  const bpDucts = blueprintElements.filter(
    (e) => e.type === 'line' && e.layerId === 'hvac-route',
  ) as CADLine[];

  for (const duct of bpDucts) {
    scanDetections.push({
      type: 'line', id: uid('scan-duct'), layerId: 'scan',
      p1: { x: duct.p1.x + smallOffset * 0.8, y: duct.p1.y - smallOffset * 0.5 },
      p2: { x: duct.p2.x - smallOffset * 0.8, y: duct.p2.y + smallOffset * 0.5 },
      strokeColor: scanColor, strokeWidth: ductWidth,
    });
  }

  // Scan outlets — 5 match, 1 is TYPE_MISMATCH (outlet #3 detected as plumbing valve)
  for (let i = 0; i < outletPositions.length; i++) {
    const pos = outletPositions[i];
    if (i === 3) {
      // TYPE_MISMATCH: blueprint says outlet, scan detected plumbing valve
      scanDetections.push({
        type: 'circle', id: uid('scan-valve'), layerId: 'scan',
        center: { x: pos.x + smallOffset, y: pos.y + smallOffset },
        radius: m(0.12),
        strokeColor: '#3b82f6', strokeWidth: 1.5, // plumbing color
      });
      deviationEntries.push({
        id: 'dev-type-mismatch-1',
        deviation_type: 'TYPE_MISMATCH',
        severity: 'WARNING',
        distance_mm: 0,
        planned_position: [pos.x / m(1), pos.y / m(1)],
        actual_position: [(pos.x + smallOffset) / m(1), 0.3, (pos.y + smallOffset) / m(1)],
        planned_type: 'electrical_outlet',
        actual_type: 'plumbing_valve',
        message: 'Expected electrical outlet, detected plumbing valve',
      });
      deviationElements.push({
        type: 'circle', id: uid('dev-type'), layerId: 'deviations',
        center: { x: pos.x + smallOffset, y: pos.y + smallOffset },
        radius: m(0.25), strokeColor: '#eab308', strokeWidth: 2,
      });
      deviationElements.push({
        type: 'text', id: uid('dev-type-label'), layerId: 'deviations',
        position: { x: pos.x + m(0.3), y: pos.y - 8 },
        content: 'Plan: outlet / Actual: valve', fontSize: 10, fontFamily: 'monospace',
        color: '#eab308', rotation: 0,
      } as TextElement);
    } else {
      scanDetections.push({
        type: 'circle', id: uid('scan-outlet'), layerId: 'scan',
        center: { x: pos.x + smallOffset * 0.5, y: pos.y - smallOffset * 0.3 },
        radius: m(0.15),
        strokeColor: scanColor, strokeWidth: 1.5,
      });
    }
  }

  // Scan fixtures — water heater & sink match; panel matches
  for (const f of fixtures) {
    scanDetections.push({
      type: 'circle', id: uid('scan-fixture'), layerId: 'scan',
      center: { x: f.center.x + smallOffset, y: f.center.y - smallOffset * 0.7 },
      radius: f.radius * 0.95,
      strokeColor: scanColor, strokeWidth: 2,
    });
  }

  // ── EXTRA_IN_SCAN: detected element not in blueprint ──────────────────────

  const extraPos = { x: ox + m(9), y: oy + m(7.5) };
  scanDetections.push({
    type: 'circle', id: uid('scan-extra'), layerId: 'scan',
    center: extraPos, radius: m(0.2),
    strokeColor: scanColor, strokeWidth: 2,
  });
  deviationEntries.push({
    id: 'dev-extra-1',
    deviation_type: 'EXTRA_IN_SCAN',
    severity: 'WARNING',
    distance_mm: 0,
    planned_position: null,
    actual_position: [extraPos.x / m(1), 0.4, extraPos.y / m(1)],
    planned_type: null,
    actual_type: 'unknown_fitting',
    message: 'Detected fitting not present in blueprint — verify field installation',
  });
  deviationElements.push({
    type: 'circle', id: uid('dev-extra'), layerId: 'deviations',
    center: extraPos, radius: m(0.3),
    strokeColor: '#f97316', strokeWidth: 2,
  });
  deviationElements.push({
    type: 'text', id: uid('dev-extra-label'), layerId: 'deviations',
    position: { x: extraPos.x + m(0.35), y: extraPos.y - 6 },
    content: 'EXTRA: unknown fitting', fontSize: 10, fontFamily: 'monospace',
    color: '#f97316', rotation: 0,
  } as TextElement);

  // ── MISSING_IN_SCAN: blueprint outlet #5 (14m, 5m) not detected ───────────

  const missingPos = outletPositions[4]; // outlet at (14m, 5m)
  deviationEntries.push({
    id: 'dev-missing-1',
    deviation_type: 'MISSING_IN_SCAN',
    severity: 'CRITICAL',
    distance_mm: 0,
    planned_position: [missingPos.x / m(1), missingPos.y / m(1)],
    actual_position: null,
    planned_type: 'electrical_outlet',
    actual_type: null,
    message: 'Planned electrical outlet not detected in scan — verify installation',
  });
  deviationElements.push({
    type: 'circle', id: uid('dev-missing'), layerId: 'deviations',
    center: missingPos, radius: m(0.25),
    strokeColor: '#ef4444', strokeWidth: 2,
    metadata: { dashPattern: [6, 4] },
  });
  deviationElements.push({
    type: 'text', id: uid('dev-missing-label'), layerId: 'deviations',
    position: { x: missingPos.x + m(0.3), y: missingPos.y - 6 },
    content: 'MISSING: electrical outlet', fontSize: 10, fontFamily: 'monospace',
    color: '#ef4444', rotation: 0,
  } as TextElement);

  // Add MATCH entries for elements that matched correctly
  const matchCount = 18; // walls + most pipes + ducts + outlets + fixtures that matched
  for (let i = 0; i < matchCount; i++) {
    deviationEntries.push({
      id: `dev-match-${i}`,
      deviation_type: 'MATCH',
      severity: 'OK',
      distance_mm: Math.round(Math.random() * 20 + 5), // 5-25mm — within tolerance
      planned_position: null,
      actual_position: null,
      planned_type: 'element',
      actual_type: 'element',
      message: 'Element matches within tolerance',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3D DETECTION DATA
  // ═══════════════════════════════════════════════════════════════════════════

  // Pipe detections
  for (let i = 0; i < 8; i++) {
    const isHoriz = i < 4;
    detection3D.push({
      id: `det3d-pipe-${i}`,
      feature_type: 'plumbing_pipe',
      confidence: 0.88 + Math.random() * 0.1,
      coordinates: isHoriz
        ? { x: 6 + i * 0.5, y: 0.5 + i * 0.2, z: 1.5 + i * 0.6 }
        : { x: 3 + (i - 4) * 3, y: 0.3, z: 7.5 },
    });
  }

  // HVAC detections
  for (let i = 0; i < 4; i++) {
    detection3D.push({
      id: `det3d-duct-${i}`,
      feature_type: 'hvac_duct',
      confidence: 0.91 + Math.random() * 0.07,
      coordinates: { x: 2 + i * 3.5, y: 2.8, z: i < 2 ? 4.5 : 5.5 },
    });
  }

  // Outlet detections
  for (const [i, pos] of outletPositions.entries()) {
    if (i === 4) continue; // missing in scan
    detection3D.push({
      id: `det3d-outlet-${i}`,
      feature_type: i === 3 ? 'plumbing_valve' : 'electrical_outlet',
      confidence: i === 3 ? 0.72 : 0.85 + Math.random() * 0.1,
      coordinates: { x: pos.x / m(1), y: 1.2, z: pos.y / m(1) },
    });
  }

  // Fixture detections
  for (const [i, f] of fixtures.entries()) {
    detection3D.push({
      id: `det3d-fixture-${i}`,
      feature_type: 'fixture_' + ['water_heater', 'sink', 'panel'][i],
      confidence: 0.93 + Math.random() * 0.05,
      coordinates: { x: f.center.x / m(1), y: 0.6, z: f.center.y / m(1) },
    });
  }

  // Extra detection (not in blueprint)
  detection3D.push({
    id: 'det3d-extra-1',
    feature_type: 'unknown_fitting',
    confidence: 0.65,
    coordinates: { x: extraPos.x / m(1), y: 0.4, z: extraPos.y / m(1) },
  });

  return {
    blueprintElements,
    scanDetections,
    deviationElements,
    detection3D,
    deviationEntries,
  };
}
