import type { MermaidGraph, MermaidDirection } from './mermaid-parser';
import type { FlowchartShapeKind, Point } from './types';

const SHAPE_DEFAULTS: Record<FlowchartShapeKind, { width: number; height: number }> = {
  rectangle:     { width: 160, height: 80 },
  rounded:       { width: 160, height: 80 },
  ellipse:       { width: 140, height: 90 },
  diamond:       { width: 150, height: 110 },
  parallelogram: { width: 150, height: 80 },
  cylinder:      { width: 120, height: 110 },
  hexagon:       { width: 150, height: 90 },
};

const LAYER_GAP = 120;
const NODE_GAP = 60;
const ORIGIN_OFFSET = 80;

export interface LayoutResult {
  /** Map from node id to its top-left position and computed size. */
  nodePositions: Map<string, { origin: Point; width: number; height: number }>;
  /** Total bounding box of the laid-out diagram. */
  bounds: { x: number; y: number; width: number; height: number };
}

/** Compute node positions for a mermaid graph using a layered Sugiyama-lite algorithm. */
export function layoutMermaid(graph: MermaidGraph): LayoutResult {
  const { direction, nodes, edges } = graph;

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }
  for (const e of edges) {
    if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
    outgoing.get(e.from)!.push(e.to);
    incoming.get(e.to)!.push(e.from);
  }

  // Compute layer index for each node via longest-path from sources.
  const layer = new Map<string, number>();
  const sources: string[] = [];
  for (const id of nodes.keys()) {
    if ((incoming.get(id) ?? []).length === 0) sources.push(id);
  }
  if (sources.length === 0 && nodes.size > 0) sources.push(nodes.keys().next().value!);

  // Topological-ish traversal — handle cycles by capping at nodes.size depth.
  for (const s of sources) layer.set(s, 0);
  let progressed = true;
  let iters = 0;
  while (progressed && iters++ < nodes.size + 1) {
    progressed = false;
    for (const e of edges) {
      const fromLayer = layer.get(e.from) ?? 0;
      const target = (layer.get(e.to) ?? -1);
      if (fromLayer + 1 > target) {
        layer.set(e.to, fromLayer + 1);
        progressed = true;
      }
    }
  }
  // Any unvisited node lands in layer 0
  for (const id of nodes.keys()) {
    if (!layer.has(id)) layer.set(id, 0);
  }

  // Group node ids by layer in declaration order
  const layerGroups = new Map<number, string[]>();
  for (const id of nodes.keys()) {
    const l = layer.get(id) ?? 0;
    if (!layerGroups.has(l)) layerGroups.set(l, []);
    layerGroups.get(l)!.push(id);
  }
  const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);

  // Within each layer, attempt simple barycenter ordering for fewer crossings (one pass).
  for (const l of sortedLayers) {
    if (l === 0) continue;
    const group = layerGroups.get(l)!;
    const prevGroup = layerGroups.get(l - 1) ?? [];
    const prevIndex = new Map(prevGroup.map((id, i) => [id, i]));
    group.sort((a, b) => {
      const aBar = avgIndex(incoming.get(a) ?? [], prevIndex);
      const bBar = avgIndex(incoming.get(b) ?? [], prevIndex);
      return aBar - bBar;
    });
  }

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const layerCount = sortedLayers.length;
  // Determine layer dimensions for each layer (max width or max height across nodes in that layer)
  const layerSpans: number[] = [];
  const layerCrossSpans: number[] = [];
  for (const l of sortedLayers) {
    const ids = layerGroups.get(l)!;
    let span = 0;
    let cross = 0;
    for (const id of ids) {
      const node = nodes.get(id)!;
      const sz = SHAPE_DEFAULTS[node.shape];
      if (isHorizontal) {
        span = Math.max(span, sz.width);
        cross += sz.height;
      } else {
        span = Math.max(span, sz.height);
        cross += sz.width;
      }
    }
    cross += NODE_GAP * Math.max(0, ids.length - 1);
    layerSpans.push(span);
    layerCrossSpans.push(cross);
  }
  const maxCross = layerCrossSpans.length === 0 ? 0 : Math.max(...layerCrossSpans);

  const nodePositions = new Map<string, { origin: Point; width: number; height: number }>();

  let layerOffset = ORIGIN_OFFSET;
  for (let i = 0; i < sortedLayers.length; i++) {
    const l = sortedLayers[i];
    const ids = layerGroups.get(l)!;
    const span = layerSpans[i];

    let crossOffset = ORIGIN_OFFSET + (maxCross - layerCrossSpans[i]) / 2;
    for (const id of ids) {
      const node = nodes.get(id)!;
      const sz = SHAPE_DEFAULTS[node.shape];
      let x: number;
      let y: number;
      if (direction === 'TD') {
        x = crossOffset;
        y = layerOffset;
      } else if (direction === 'BT') {
        x = crossOffset;
        y = ORIGIN_OFFSET + (layerCount - 1 - i) * (LAYER_GAP) + (i > 0 ? sumLayers(layerSpans, i) : 0);
        // Simplified: just invert layer order
        y = ORIGIN_OFFSET + (layerCount - 1 - i) * (Math.max(...layerSpans) + LAYER_GAP);
      } else if (direction === 'LR') {
        x = layerOffset;
        y = crossOffset;
      } else {
        x = ORIGIN_OFFSET + (layerCount - 1 - i) * (Math.max(...layerSpans) + LAYER_GAP);
        y = crossOffset;
      }
      nodePositions.set(id, { origin: { x, y }, width: sz.width, height: sz.height });
      crossOffset += (isHorizontal ? sz.height : sz.width) + NODE_GAP;
    }
    layerOffset += span + LAYER_GAP;
  }

  // Compute overall bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of nodePositions.values()) {
    if (pos.origin.x < minX) minX = pos.origin.x;
    if (pos.origin.y < minY) minY = pos.origin.y;
    if (pos.origin.x + pos.width > maxX) maxX = pos.origin.x + pos.width;
    if (pos.origin.y + pos.height > maxY) maxY = pos.origin.y + pos.height;
  }
  const bounds = isFinite(minX)
    ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    : { x: 0, y: 0, width: 0, height: 0 };

  return { nodePositions, bounds };
}

function sumLayers(layerSpans: number[], upTo: number): number {
  let total = 0;
  for (let i = 0; i < upTo; i++) total += layerSpans[i] + LAYER_GAP;
  return total;
}

function avgIndex(predecessors: string[], indexMap: Map<string, number>): number {
  if (predecessors.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const p of predecessors) {
    const idx = indexMap.get(p);
    if (idx !== undefined) {
      sum += idx;
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function shapeDefaults(): typeof SHAPE_DEFAULTS {
  return SHAPE_DEFAULTS;
}

export function getDirection(graph: MermaidGraph): MermaidDirection {
  return graph.direction;
}
