/**
 * Interior Renderer
 *
 * Renders architectural interior symbols in plan view on the HTML5 canvas.
 * All coordinates are in drawing feet; the caller applies ctx transforms
 * (translate + scale) before calling these functions.
 *
 * Each symbol is drawn centered at (0, 0) in its own coordinate space,
 * spanning from -width/2 to +width/2 and -depth/2 to +depth/2.
 * The caller translates to the placement position before calling.
 */

import type { InteriorSymbolShape } from '../data/interior-symbols';

// ── Drawing helpers ────────────────────────────────────────────────────────────

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0
) {
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// ── Symbol renderers ─────────────────────────────────────────────────────────

function drawToilet(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Tank (rectangle at the back)
  const tankH = d * 0.35;
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, tankH);
  ctx.stroke();
  // Bowl (oval in the front)
  const bowlY = -hd + tankH;
  const bowlH = d - tankH;
  ctx.beginPath();
  ctx.ellipse(0, bowlY + bowlH / 2, hw * 0.85, bowlH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSink(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Outer counter edge
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d);
  ctx.stroke();
  // Basin oval
  ctx.beginPath();
  ctx.ellipse(0, 0, hw * 0.7, hd * 0.7, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Drain dot
  ctx.beginPath();
  ctx.arc(0, 0, hd * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawBathtub(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Outer shell with rounded corners
  ctx.beginPath();
  rect(ctx, -hw, -hd, w, d, Math.min(hw, hd) * 0.3);
  ctx.stroke();
  // Inner tub outline
  const margin = Math.min(w, d) * 0.1;
  ctx.beginPath();
  rect(ctx, -hw + margin, -hd + margin, w - margin * 2, d - margin * 2, Math.min(hw, hd) * 0.2);
  ctx.stroke();
  // Faucet mark at the head end
  ctx.beginPath();
  ctx.arc(0, -hd + margin * 2, margin * 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawShower(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Outer square
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d);
  ctx.stroke();
  // Diagonal hatch lines (shower floor symbol)
  const step = Math.min(w, d) * 0.25;
  ctx.save();
  ctx.clip();
  for (let i = -w; i < w + d; i += step) {
    ctx.beginPath();
    ctx.moveTo(-hw + i, -hd);
    ctx.lineTo(-hw + i - d, hd);
    ctx.stroke();
  }
  ctx.restore();
  // Drain circle
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(hw, hd) * 0.12, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStove(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Base rectangle
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d);
  ctx.stroke();
  // 4 burner circles in 2×2 grid
  const bw = w * 0.28;
  const bd = d * 0.35;
  const offsets = [
    [-bw, -bd], [bw, -bd],
    [-bw, bd], [bw, bd],
  ];
  for (const [ox, oy] of offsets) {
    ctx.beginPath();
    ctx.arc(ox, oy, Math.min(w, d) * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRefrigerator(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Body
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d);
  ctx.stroke();
  // Handle line on one side
  const handleX = hw - w * 0.12;
  ctx.beginPath();
  ctx.moveTo(handleX, -hd * 0.5);
  ctx.lineTo(handleX, hd * 0.5);
  ctx.stroke();
}

function drawDoubleSink(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Counter
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d);
  ctx.stroke();
  // Left basin
  ctx.beginPath();
  ctx.ellipse(-hw * 0.5, 0, hw * 0.35, hd * 0.65, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Right basin
  ctx.beginPath();
  ctx.ellipse(hw * 0.5, 0, hw * 0.35, hd * 0.65, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawIsland(ctx: CanvasRenderingContext2D, w: number, d: number) {
  // Plain rectangle
  ctx.beginPath();
  ctx.rect(-w / 2, -d / 2, w, d);
  ctx.stroke();
}

function drawSofa(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  const armW = w * 0.1;
  // Back (top rectangle)
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d * 0.3);
  ctx.stroke();
  // Left arm
  ctx.beginPath();
  ctx.rect(-hw, -hd, armW, d);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.rect(hw - armW, -hd, armW, d);
  ctx.stroke();
  // Seat area outline
  ctx.beginPath();
  ctx.rect(-hw + armW, -hd + d * 0.3, w - armW * 2, d * 0.7);
  ctx.stroke();
}

function drawChair(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Seat square
  ctx.beginPath();
  ctx.rect(-hw, -hd + d * 0.25, w, d * 0.75);
  ctx.stroke();
  // Back arc
  ctx.beginPath();
  ctx.arc(0, -hd + d * 0.25, hw, Math.PI, 0, false);
  ctx.stroke();
}

function drawTable(ctx: CanvasRenderingContext2D, w: number, d: number) {
  ctx.beginPath();
  ctx.rect(-w / 2, -d / 2, w, d);
  ctx.stroke();
}

function drawBed(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  // Mattress outline
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, d);
  ctx.stroke();
  // Headboard line
  ctx.beginPath();
  ctx.moveTo(-hw, -hd + d * 0.1);
  ctx.lineTo(hw, -hd + d * 0.1);
  ctx.stroke();
  // Pillow bumps
  const pillowY = -hd + d * 0.05;
  const pillowCount = w >= 5 ? 2 : 1;
  const pillowW = (w * 0.4) / pillowCount;
  const pillowH = d * 0.07;
  for (let i = 0; i < pillowCount; i++) {
    const px = pillowCount === 2
      ? (i === 0 ? -hw * 0.45 : hw * 0.45)
      : 0;
    ctx.beginPath();
    ctx.ellipse(px, pillowY, pillowW / 2, pillowH, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawDesk(ctx: CanvasRenderingContext2D, w: number, d: number) {
  ctx.beginPath();
  ctx.rect(-w / 2, -d / 2, w, d);
  ctx.stroke();
}

function drawDoorArc(ctx: CanvasRenderingContext2D, w: number, _d: number) {
  // Door line from hinge point
  ctx.beginPath();
  ctx.moveTo(-w / 2, -w / 2);
  ctx.lineTo(w / 2, -w / 2);
  ctx.stroke();
  // Door panel (vertical from hinge)
  ctx.beginPath();
  ctx.moveTo(-w / 2, -w / 2);
  ctx.lineTo(-w / 2, w / 2);
  ctx.stroke();
  // Swing arc (quarter circle)
  ctx.beginPath();
  ctx.arc(-w / 2, -w / 2, w, 0, Math.PI / 2, false);
  ctx.stroke();
}

function drawDoorSlide(ctx: CanvasRenderingContext2D, w: number, _d: number) {
  const hw = w / 2;
  const trackH = w * 0.05;
  // Track channel
  ctx.beginPath();
  ctx.rect(-hw, -trackH, w, trackH * 2);
  ctx.stroke();
  // Door panel (left half, open position)
  ctx.beginPath();
  ctx.rect(-hw, -trackH * 3, w / 2, trackH * 2);
  ctx.stroke();
  // Arrow showing direction
  ctx.beginPath();
  ctx.moveTo(-hw * 0.2, -trackH * 4.5);
  ctx.lineTo(hw * 0.2, -trackH * 4.5);
  ctx.moveTo(hw * 0.1, -trackH * 5.2);
  ctx.lineTo(hw * 0.2, -trackH * 4.5);
  ctx.lineTo(hw * 0.1, -trackH * 3.8);
  ctx.stroke();
}

function drawWindow(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d > 0 ? d / 2 : 0.25;
  // Wall opening (outer edge)
  ctx.beginPath();
  ctx.rect(-hw, -hd, w, hd * 2);
  ctx.stroke();
  // Glass pane lines
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(hw, 0);
  ctx.stroke();
}

function drawStairs(ctx: CanvasRenderingContext2D, w: number, d: number) {
  const hw = w / 2;
  const hd = d / 2;
  const stepCount = 8;
  const stepH = d / stepCount;
  // Stair treads
  for (let i = 0; i < stepCount; i++) {
    const y = -hd + i * stepH;
    ctx.beginPath();
    ctx.moveTo(-hw, y);
    ctx.lineTo(hw, y);
    ctx.stroke();
  }
  // Side lines
  ctx.beginPath();
  ctx.moveTo(-hw, -hd);
  ctx.lineTo(-hw, hd);
  ctx.moveTo(hw, -hd);
  ctx.lineTo(hw, hd);
  ctx.stroke();
  // Direction arrow (up arrow)
  const ax = 0;
  const ay = hd - stepH * 1.5;
  ctx.beginPath();
  ctx.moveTo(ax, -hd + stepH * 0.5);
  ctx.lineTo(ax, ay);
  ctx.moveTo(ax - w * 0.12, ay - stepH * 0.5);
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + w * 0.12, ay - stepH * 0.5);
  ctx.stroke();
}

function drawWasherDryer(ctx: CanvasRenderingContext2D, w: number, d: number) {
  // Box
  ctx.beginPath();
  ctx.rect(-w / 2, -d / 2, w, d);
  ctx.stroke();
  // Circle (drum)
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, d) * 0.38, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, w: number, d: number) {
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(w, d) / 2, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Render an interior symbol centered at the canvas origin (0, 0) in drawing-space feet.
 * Caller must apply the view transform (translate to position, scale to zoom) before calling.
 *
 * @param ctx - Canvas 2D context (already in drawing-space coords)
 * @param shape - Symbol shape type from INTERIOR_SYMBOLS
 * @param width - Symbol width in feet
 * @param depth - Symbol depth in feet
 * @param color - Stroke color
 * @param rotation - Rotation in degrees (applied around center)
 */
export function renderInteriorSymbol(
  ctx: CanvasRenderingContext2D,
  shape: InteriorSymbolShape,
  width: number,
  depth: number,
  color = '#8B7355',
  rotation = 0
): void {
  ctx.save();
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 0.08; // ~1" in feet
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape) {
    case 'toilet':       drawToilet(ctx, width, depth);       break;
    case 'sink':         drawSink(ctx, width, depth);         break;
    case 'bathtub':      drawBathtub(ctx, width, depth);      break;
    case 'shower':       drawShower(ctx, width, depth);       break;
    case 'stove':        drawStove(ctx, width, depth);        break;
    case 'refrigerator': drawRefrigerator(ctx, width, depth); break;
    case 'dishwasher':   drawIsland(ctx, width, depth);       break; // plain rect
    case 'double-sink':  drawDoubleSink(ctx, width, depth);   break;
    case 'island':       drawIsland(ctx, width, depth);       break;
    case 'sofa':         drawSofa(ctx, width, depth);         break;
    case 'chair':        drawChair(ctx, width, depth);        break;
    case 'table':        drawTable(ctx, width, depth);        break;
    case 'bed':          drawBed(ctx, width, depth);          break;
    case 'desk':         drawDesk(ctx, width, depth);         break;
    case 'door-arc':     drawDoorArc(ctx, width, depth);      break;
    case 'door-slide':   drawDoorSlide(ctx, width, depth);    break;
    case 'window':       drawWindow(ctx, width, depth);       break;
    case 'stairs':       drawStairs(ctx, width, depth);       break;
    case 'washer':
    case 'dryer':        drawWasherDryer(ctx, width, depth);  break;
    case 'circle':       drawCircle(ctx, width, depth);       break;
    default:             drawTable(ctx, width, depth);        break;
  }

  ctx.restore();
}
