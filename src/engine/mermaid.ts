import type { CADElement, FlowchartShape, Connector, FlowchartShapeKind, DiagramContainer } from './types';
import { parseMermaid, type MermaidGraph, type MermaidDirection } from './mermaid-parser';
import { layoutMermaid } from './mermaid-layout';
import { routeConnector } from './connector-router';

interface ImportOptions {
  /** Translate the laid-out diagram so its top-left lands at this canvas point. */
  origin?: { x: number; y: number };
  /** Default layer for shapes (defaults to 'diagram'). */
  shapeLayer?: string;
  /** Default layer for connectors (defaults to 'connectors'). */
  connectorLayer?: string;
  /** Default fill / stroke colors */
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface MermaidImportResult {
  elements: CADElement[];
  bounds: { x: number; y: number; width: number; height: number };
  graph: MermaidGraph;
}

export { parseMermaid, MermaidParseError } from './mermaid-parser';
export type { MermaidGraph, MermaidDirection } from './mermaid-parser';

/** Parse a mermaid source string and return a list of CAD elements ready to add to the canvas. */
export function importMermaid(source: string, options: ImportOptions = {}): MermaidImportResult {
  const graph = parseMermaid(source);
  const layout = layoutMermaid(graph);
  const dx = (options.origin?.x ?? 0) - layout.bounds.x;
  const dy = (options.origin?.y ?? 0) - layout.bounds.y;
  const shapeLayer = options.shapeLayer ?? 'diagram';
  const connectorLayer = options.connectorLayer ?? 'connectors';
  const fill = options.fillColor ?? '#dbeafe';
  const stroke = options.strokeColor ?? '#1e3a8a';
  const strokeWidth = options.strokeWidth ?? 2;

  const elements: CADElement[] = [];
  const idMap = new Map<string, string>();
  const ts = Date.now();
  let counter = 0;
  const newId = (prefix: string) => `${prefix}-${ts}-${counter++}`;

  // Containers for subgraphs come first (so they render behind their children).
  for (const sg of graph.subgraphs) {
    const memberPositions = sg.nodeIds
      .map((id) => layout.nodePositions.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);
    if (memberPositions.length === 0) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of memberPositions) {
      minX = Math.min(minX, p.origin.x);
      minY = Math.min(minY, p.origin.y);
      maxX = Math.max(maxX, p.origin.x + p.width);
      maxY = Math.max(maxY, p.origin.y + p.height);
    }
    const padding = 24;
    const titleHeight = sg.title ? 24 : 0;
    const containerId = newId('container');
    const childIds: string[] = [];
    const container: DiagramContainer = {
      type: 'container',
      id: containerId,
      origin: { x: minX - padding + dx, y: minY - padding - titleHeight + dy },
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + titleHeight,
      layerId: shapeLayer,
      fillColor: '#f9fafb',
      strokeColor: '#9ca3af',
      strokeWidth,
      title: sg.title,
      containerType: 'group',
      childIds,
    };
    elements.push(container);
  }

  // Nodes
  for (const [nodeId, node] of graph.nodes) {
    const pos = layout.nodePositions.get(nodeId);
    if (!pos) continue;
    const id = newId('shape');
    idMap.set(nodeId, id);
    const shape: FlowchartShape = {
      type: 'flowchart-shape',
      id,
      shape: node.shape,
      origin: { x: pos.origin.x + dx, y: pos.origin.y + dy },
      width: pos.width,
      height: pos.height,
      layerId: shapeLayer,
      fillColor: fillForShape(node.shape, fill),
      strokeColor: stroke,
      strokeWidth,
      text: node.label,
      textColor: '#0f172a',
    };
    elements.push(shape);
  }

  // Edges
  for (const e of graph.edges) {
    const fromId = idMap.get(e.from);
    const toId = idMap.get(e.to);
    if (!fromId || !toId) continue;
    const id = newId('conn');
    const dashed = e.style === 'dotted';
    const connector: Connector = {
      type: 'connector',
      id,
      fromShapeId: fromId,
      toShapeId: toId,
      fromAnchor: 'auto',
      toAnchor: 'auto',
      routing: 'orthogonal',
      layerId: connectorLayer,
      strokeColor: stroke,
      strokeWidth: e.style === 'thick' ? strokeWidth * 2 : strokeWidth,
      endCap: e.arrow ? 'arrow' : 'none',
      label: e.label,
      metadata: dashed ? { dashPattern: [6, 4] } : undefined,
    };
    elements.push(routeConnector(connector, elements));
  }

  // Wire subgraph childIds (best-effort soft membership)
  for (const sg of graph.subgraphs) {
    for (const el of elements) {
      if (el.type !== 'container' || el.title !== sg.title) continue;
      el.childIds = sg.nodeIds.map((id) => idMap.get(id)).filter((x): x is string => !!x);
    }
  }

  const offsetBounds = {
    x: layout.bounds.x + dx,
    y: layout.bounds.y + dy,
    width: layout.bounds.width,
    height: layout.bounds.height,
  };

  return { elements, bounds: offsetBounds, graph };
}

function fillForShape(_shape: FlowchartShapeKind, fallback: string): string {
  return fallback;
}

// ── Export ─────────────────────────────────────────────────────────────────────

const SHAPE_TO_MERMAID: Record<FlowchartShapeKind, { open: string; close: string }> = {
  rectangle:     { open: '[',   close: ']'  },
  rounded:       { open: '(',   close: ')'  },
  ellipse:       { open: '((',  close: '))' },
  diamond:       { open: '{',   close: '}'  },
  parallelogram: { open: '[/',  close: '/]' },
  cylinder:      { open: '[(',  close: ')]' },
  hexagon:       { open: '{{',  close: '}}' },
};

interface ExportOptions {
  direction?: MermaidDirection;
  /** Include only diagram elements (skip CAD lines, freehand, etc.). Default true. */
  diagramOnly?: boolean;
}

/** Render a list of CAD elements as a mermaid graph source string. */
export function exportMermaid(elements: CADElement[], options: ExportOptions = {}): string {
  const direction = options.direction ?? inferDirection(elements);
  const diagramOnly = options.diagramOnly ?? true;

  const shapes = elements.filter((el): el is FlowchartShape => el.type === 'flowchart-shape');
  const connectors = elements.filter((el): el is Connector => el.type === 'connector');
  const containers = elements.filter((el): el is DiagramContainer => el.type === 'container');

  if (shapes.length === 0 && connectors.length === 0) {
    return diagramOnly ? '%% No diagram elements to export\ngraph TD\n' : 'graph TD\n';
  }

  const idAlias = new Map<string, string>();
  let counter = 0;
  const aliasFor = (id: string) => {
    let a = idAlias.get(id);
    if (!a) {
      a = nodeAlias(counter++);
      idAlias.set(id, a);
    }
    return a;
  };

  const lines: string[] = [`graph ${direction}`];

  // Render shape declarations (first occurrence; subsequent edge references use the alias only)
  const declared = new Set<string>();
  const renderNodeRef = (shape: FlowchartShape): string => {
    const alias = aliasFor(shape.id);
    if (declared.has(shape.id)) return alias;
    declared.add(shape.id);
    const wrap = SHAPE_TO_MERMAID[shape.shape];
    const label = quoteLabel(shape.text ?? alias);
    return `${alias}${wrap.open}${label}${wrap.close}`;
  };

  // Group connectors that share fromShape so we can chain when reasonable
  const shapesById = new Map(shapes.map((s) => [s.id, s]));
  const containerMembers = new Map<string, string[]>(); // containerId -> shapeId[]
  for (const c of containers) {
    if (c.childIds && c.childIds.length > 0) containerMembers.set(c.id, c.childIds);
  }
  const shapeToContainer = new Map<string, string>();
  for (const [cid, ids] of containerMembers) {
    for (const id of ids) shapeToContainer.set(id, cid);
  }

  // Subgraph blocks
  for (const c of containers) {
    if (c.containerType !== 'group' && c.containerType !== 'swimlane-h' && c.containerType !== 'swimlane-v') continue;
    if (!c.childIds || c.childIds.length === 0) continue;
    const title = c.title ? `subgraph ${quoteLabel(c.title)}` : `subgraph ${aliasFor(c.id)}`;
    lines.push('');
    lines.push(`  ${title}`);
    for (const childId of c.childIds) {
      const s = shapesById.get(childId);
      if (!s) continue;
      lines.push(`    ${renderNodeRef(s)}`);
    }
    lines.push('  end');
  }

  // Edges
  for (const c of connectors) {
    const from = shapesById.get(c.fromShapeId);
    const to = shapesById.get(c.toShapeId);
    if (!from || !to) continue;
    const fromExpr = renderNodeRef(from);
    const toExpr = renderNodeRef(to);
    const op = edgeOp(c);
    const labelPart = c.label ? `|${quoteLabel(c.label)}|` : '';
    lines.push(`  ${fromExpr} ${op}${labelPart} ${toExpr}`);
  }

  // Any shapes never referenced by an edge — emit standalone declarations
  for (const s of shapes) {
    if (declared.has(s.id)) continue;
    if (shapeToContainer.has(s.id)) continue;
    lines.push(`  ${renderNodeRef(s)}`);
  }

  return lines.join('\n') + '\n';
}

function nodeAlias(n: number): string {
  // a, b, c, ..., z, aa, ab, ... — Mermaid-friendly identifiers
  let s = '';
  let v = n;
  do {
    s = String.fromCharCode(97 + (v % 26)) + s;
    v = Math.floor(v / 26) - 1;
  } while (v >= 0);
  return s;
}

function quoteLabel(text: string): string {
  if (/[[\](){}|#"\\]/.test(text) || /\s/.test(text)) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function edgeOp(c: Connector): string {
  const dotted = c.metadata?.dashPattern && c.metadata.dashPattern.length > 0;
  const arrow = c.endCap === 'arrow' || c.startCap === 'arrow';
  if (dotted) return arrow ? '-.->' : '-.-';
  if (c.strokeWidth >= 4) return arrow ? '==>' : '===';
  return arrow ? '-->' : '---';
}

function inferDirection(elements: CADElement[]): MermaidDirection {
  // If shapes are wider apart horizontally than vertically, use LR; otherwise TD.
  const shapes = elements.filter((el) => el.type === 'flowchart-shape') as FlowchartShape[];
  if (shapes.length < 2) return 'TD';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.origin.x);
    maxX = Math.max(maxX, s.origin.x + s.width);
    minY = Math.min(minY, s.origin.y);
    maxY = Math.max(maxY, s.origin.y + s.height);
  }
  return (maxX - minX) > (maxY - minY) * 1.4 ? 'LR' : 'TD';
}
