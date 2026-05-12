/**
 * Irrigation head catalog — types, default coverage radii, GPM (gallons
 * per minute) flow rates, and zone color palette.
 *
 * Numbers are landscape-industry typical defaults for residential systems:
 *   rotor   — Hunter PGP-style stream rotor, 15ft typical adjustable arc
 *   spray   — Rain Bird 1800-series fixed spray, 8ft full circle
 *   drip    — point-source emitter, 2ft wetted radius
 *   bubbler — flood bubbler, 4ft wetted radius
 *
 * GPM values are at typical 30-40 PSI residential pressure. The schedule
 * exporter uses these to estimate per-zone flow demand, which the user
 * compares against their water meter capacity (typically 8-15 GPM for
 * a residential 3/4" service line).
 */

const PIXELS_PER_FOOT = 48;

export interface IrrigationHeadSpec {
  type: import('../engine/types').IrrigationHeadType;
  label: string;
  description: string;
  /** Default coverage radius in feet. */
  defaultRadiusFt: number;
  /** Gallons per minute at typical residential pressure. */
  gpm: number;
  /** Symbol drawn at the head position (centered, ~6 px). */
  symbolColor: string;
}

export const IRRIGATION_HEADS: IrrigationHeadSpec[] = [
  {
    type: 'rotor',
    label: 'Rotor',
    description: 'Hunter PGP-style — 15 ft, ~4 GPM, rotates between two arc settings',
    defaultRadiusFt: 15,
    gpm: 4.0,
    symbolColor: '#2563eb',
  },
  {
    type: 'spray',
    label: 'Spray',
    description: 'Rain Bird 1800 — 8 ft fixed pattern, ~2 GPM, no moving parts',
    defaultRadiusFt: 8,
    gpm: 2.0,
    symbolColor: '#059669',
  },
  {
    type: 'drip',
    label: 'Drip Emitter',
    description: 'Point-source — 2 ft wetted radius, 0.5 GPM, used in beds + planters',
    defaultRadiusFt: 2,
    gpm: 0.5,
    symbolColor: '#7c3aed',
  },
  {
    type: 'bubbler',
    label: 'Bubbler',
    description: 'Flood bubbler — 4 ft, 1 GPM, used at tree wells + deep-rooted plants',
    defaultRadiusFt: 4,
    gpm: 1.0,
    symbolColor: '#ea580c',
  },
];

export function getIrrigationSpec(type: import('../engine/types').IrrigationHeadType): IrrigationHeadSpec {
  return IRRIGATION_HEADS.find((h) => h.type === type) ?? IRRIGATION_HEADS[0];
}

/** Convert default radius to canvas pixels. */
export function defaultRadiusPx(type: import('../engine/types').IrrigationHeadType): number {
  return getIrrigationSpec(type).defaultRadiusFt * PIXELS_PER_FOOT;
}

/* ------------------------------------------------------------------ */
/*  Zone palette                                                        */
/* ------------------------------------------------------------------ */

/** Color per zone. 8 zones — covers most residential designs. */
export const ZONE_COLORS: Record<number, string> = {
  1: '#3b82f6',  // blue
  2: '#22c55e',  // green
  3: '#eab308',  // yellow
  4: '#ef4444',  // red
  5: '#a855f7',  // purple
  6: '#ec4899',  // pink
  7: '#06b6d4',  // cyan
  8: '#f97316',  // orange
};

export function zoneColor(zoneId: number): string {
  return ZONE_COLORS[zoneId] ?? '#6b7280';
}

/* ------------------------------------------------------------------ */
/*  Schedule generation                                                  */
/* ------------------------------------------------------------------ */

export interface IrrigationScheduleRow {
  zoneId: number;
  color: string;
  headCount: number;
  byType: Record<string, number>;
  totalGpm: number;
}

export interface IrrigationSchedule {
  rows: IrrigationScheduleRow[];
  totalHeads: number;
  totalGpm: number;
  /** Max zone GPM — should fit within the supply line capacity (typ. 8-15). */
  peakZoneGpm: number;
}

export function generateIrrigationSchedule(
  elements: import('../engine/types').CADElement[],
): IrrigationSchedule {
  const heads = elements.filter(
    (el): el is import('../engine/types').CADIrrigationHead => el.type === 'irrigation',
  );
  const byZone = new Map<number, import('../engine/types').CADIrrigationHead[]>();
  for (const h of heads) {
    const arr = byZone.get(h.zoneId);
    if (arr) arr.push(h);
    else byZone.set(h.zoneId, [h]);
  }
  const rows: IrrigationScheduleRow[] = [];
  let peak = 0;
  for (const [zoneId, group] of [...byZone.entries()].sort((a, b) => a[0] - b[0])) {
    const byType: Record<string, number> = {};
    let gpm = 0;
    for (const h of group) {
      const spec = getIrrigationSpec(h.headType);
      byType[h.headType] = (byType[h.headType] ?? 0) + 1;
      gpm += spec.gpm;
    }
    if (gpm > peak) peak = gpm;
    rows.push({
      zoneId,
      color: zoneColor(zoneId),
      headCount: group.length,
      byType,
      totalGpm: gpm,
    });
  }
  return {
    rows,
    totalHeads: heads.length,
    totalGpm: rows.reduce((s, r) => s + r.totalGpm, 0),
    peakZoneGpm: peak,
  };
}
