/**
 * annotation-export.ts — Export linked annotations for punch list PDF generation.
 *
 * Maps deviation IDs to their linked annotation descriptions, so the PDF
 * exporter can include field notes alongside each deviation entry.
 */

import type { CADElement, TextElement } from './types';
import type { LinkedAnnotation } from './annotation-linker';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find text elements near a stroke's center that might serve as a label.
 * Searches within a 150px radius of the stroke center.
 */
function findNearbyText(
  strokeId: string,
  allElements: CADElement[],
): string | null {
  const stroke = allElements.find((el) => el.id === strokeId);
  if (!stroke || stroke.type !== 'freehand') return null;

  // Compute stroke center
  let sumX = 0;
  let sumY = 0;
  for (const p of stroke.points) {
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / stroke.points.length;
  const cy = sumY / stroke.points.length;

  const SEARCH_RADIUS = 150;

  // Look for text elements near the stroke center
  const textElements = allElements.filter(
    (el): el is TextElement => el.type === 'text',
  );

  let closest: TextElement | null = null;
  let closestDist = Infinity;

  for (const te of textElements) {
    const dx = te.position.x - cx;
    const dy = te.position.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < SEARCH_RADIUS && d < closestDist) {
      closestDist = d;
      closest = te;
    }
  }

  return closest?.content ?? null;
}

/**
 * Extract a short deviation ID for display (e.g. "deviation-abc123" → "abc123").
 */
function shortDeviationId(deviationId: string): string {
  return deviationId.replace(/^deviation-/, '').slice(0, 8);
}

// ── Main export function ─────────────────────────────────────────────────────

/**
 * Build a map from deviation ID → list of annotation descriptions.
 *
 * For each linked annotation, generates a human-readable description.
 * If a text element exists near the stroke, its content is used as the note.
 * Otherwise a generic "Field annotation near deviation #{id}" is generated.
 *
 * @param elements - All canvas elements (needed to find nearby text labels)
 * @param links - Array of LinkedAnnotation links from the annotation linker
 * @returns Map from deviationId to an array of annotation description strings
 */
export function getLinkedAnnotations(
  elements: CADElement[],
  links: LinkedAnnotation[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const link of links) {
    const nearbyText = findNearbyText(link.strokeId, elements);

    const description = nearbyText
      ? `Field note: "${nearbyText}"`
      : `Field annotation near deviation #${shortDeviationId(link.deviationId)}`;

    const existing = result.get(link.deviationId) ?? [];
    existing.push(description);
    result.set(link.deviationId, existing);
  }

  return result;
}
