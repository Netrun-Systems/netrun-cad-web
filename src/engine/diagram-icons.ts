/**
 * Icon registry for diagram shapes.
 *
 * Each icon is a 24×24 viewBox SVG path. Hand-crafted geometric glyphs are bundled
 * by default. Official vendor archives (AWS / Azure / GCP) can be dropped into
 * public/icons/{vendor}/ at runtime and picked up via the loader (see icon-loader.ts).
 *
 * Why path-only? Path2D in browsers accepts SVG path d-strings directly, giving us
 * fast canvas rendering without rasterizing. The same string also embeds cleanly
 * into the SVG export. Multi-path / gradient icons can be added later by extending
 * IconData with a `markup` field.
 */

export type IconVendor = 'aws' | 'azure' | 'gcp' | 'generic' | 'custom';

export interface IconData {
  id: string;
  vendor: IconVendor;
  label: string;
  /** Path d-string drawn at viewBox (0 0 24 24). */
  path: string;
  /** Optional secondary path for two-tone glyphs (drawn under the main path). */
  underPath?: string;
  /** Default fill color. Vendor accent unless overridden. */
  color: string;
  /** Optional under-path color (defaults to color at 50% alpha). */
  underColor?: string;
}

const ICONS = new Map<string, IconData>();

export function registerIcon(data: IconData): void {
  ICONS.set(data.id, data);
}

export function registerIcons(data: IconData[]): void {
  for (const d of data) ICONS.set(d.id, d);
}

export function getIcon(id: string): IconData | undefined {
  return ICONS.get(id);
}

export function listIcons(vendor?: IconVendor): IconData[] {
  const out: IconData[] = [];
  for (const icon of ICONS.values()) {
    if (!vendor || icon.vendor === vendor) out.push(icon);
  }
  return out;
}

// ── Renderers ────────────────────────────────────────────────────────────────

const path2dCache = new Map<string, Path2D>();
const underPath2dCache = new Map<string, Path2D>();

function path2d(d: string, cache: Map<string, Path2D>): Path2D {
  let p = cache.get(d);
  if (!p) {
    p = new Path2D(d);
    cache.set(d, p);
  }
  return p;
}

/** Draw an icon onto a canvas context, centered at (cx, cy), at the given pixel size. */
export function drawIconCanvas(
  ctx: CanvasRenderingContext2D,
  iconId: string,
  cx: number,
  cy: number,
  size: number,
  colorOverride?: string
): boolean {
  const icon = ICONS.get(iconId);
  if (!icon) return false;
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);

  if (icon.underPath) {
    ctx.fillStyle = icon.underColor ?? `${icon.color}55`;
    ctx.fill(path2d(icon.underPath, underPath2dCache));
  }

  ctx.fillStyle = colorOverride ?? icon.color;
  ctx.fill(path2d(icon.path, path2dCache));

  ctx.restore();
  return true;
}

/** Emit SVG markup for an icon at a given x/y/size, suitable for embedding inside a parent <svg>. */
export function iconToSvgMarkup(
  iconId: string,
  x: number,
  y: number,
  size: number,
  colorOverride?: string
): string {
  const icon = ICONS.get(iconId);
  if (!icon) return '';
  const transform = `translate(${x},${y}) scale(${size / 24})`;
  const color = colorOverride ?? icon.color;
  let body = '';
  if (icon.underPath) {
    body += `<path d="${icon.underPath}" fill="${icon.underColor ?? color + '55'}"/>`;
  }
  body += `<path d="${icon.path}" fill="${color}"/>`;
  return `<g transform="${transform}">${body}</g>`;
}

// ── Vendor accent colors ─────────────────────────────────────────────────────

export const VENDOR_COLORS = {
  aws: '#FF9900',
  azure: '#0078D4',
  gcp: '#4285F4',
  gcp_red: '#EA4335',
  gcp_yellow: '#FBBC04',
  gcp_green: '#34A853',
  generic: '#374151',
} as const;
