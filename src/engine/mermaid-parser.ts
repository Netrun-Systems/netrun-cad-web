import type { FlowchartShapeKind } from './types';

export type MermaidDirection = 'TD' | 'TB' | 'LR' | 'RL' | 'BT';

export interface MermaidNode {
  id: string;
  label: string;
  shape: FlowchartShapeKind;
}

export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: 'solid' | 'dotted' | 'thick';
  arrow: boolean;
}

export interface MermaidSubgraph {
  id: string;
  title: string;
  nodeIds: string[];
}

export interface MermaidGraph {
  direction: MermaidDirection;
  nodes: Map<string, MermaidNode>;
  edges: MermaidEdge[];
  subgraphs: MermaidSubgraph[];
}

export class MermaidParseError extends Error {
  constructor(message: string, public line: number) {
    super(`Line ${line}: ${message}`);
    this.name = 'MermaidParseError';
  }
}

const NODE_PATTERNS: { open: string; close: string; shape: FlowchartShapeKind }[] = [
  { open: '[(',  close: ')]', shape: 'cylinder' },        // [(Label)]
  { open: '((',  close: '))', shape: 'ellipse' },         // ((Label))
  { open: '{{',  close: '}}', shape: 'hexagon' },         // {{Label}}
  { open: '[/',  close: '/]', shape: 'parallelogram' },   // [/Label/]
  { open: '[\\', close: '\\]', shape: 'parallelogram' },  // [\Label\]
  { open: '[',   close: ']',  shape: 'rectangle' },       // [Label]
  { open: '(',   close: ')',  shape: 'rounded' },         // (Label)
  { open: '{',   close: '}',  shape: 'diamond' },         // {Label}
  { open: '>',   close: ']',  shape: 'parallelogram' },   // >Label]  (asymmetric)
];

interface NodeMatch {
  id: string;
  shape: FlowchartShapeKind;
  label: string;
  consumed: number;
}

/** Try to match a node definition starting at offset. Returns null if input doesn't look like a node. */
function matchNode(input: string, offset: number): NodeMatch | null {
  let i = offset;
  while (i < input.length && /\s/.test(input[i])) i++;
  if (i >= input.length) return null;

  const idStart = i;
  while (i < input.length && /[A-Za-z0-9_-]/.test(input[i])) i++;
  if (i === idStart) return null;
  const id = input.slice(idStart, i);

  for (const pat of NODE_PATTERNS) {
    if (input.startsWith(pat.open, i)) {
      const inner = i + pat.open.length;
      const end = input.indexOf(pat.close, inner);
      if (end === -1) continue;
      let label = input.slice(inner, end);
      label = stripQuotes(label);
      return { id, shape: pat.shape, label, consumed: end + pat.close.length - offset };
    }
  }

  return { id, shape: 'rectangle', label: id, consumed: i - offset };
}

function stripQuotes(s: string): string {
  const trimmed = s.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

interface EdgeMatch {
  style: 'solid' | 'dotted' | 'thick';
  arrow: boolean;
  label?: string;
  consumed: number;
}

/** Match an edge operator at offset. Handles ---, -->, -.->, ==>, --label--> and -->|label|. */
function matchEdge(input: string, offset: number): EdgeMatch | null {
  let i = offset;
  while (i < input.length && /\s/.test(input[i])) i++;
  if (i >= input.length) return null;

  // Form 1: ==> or === (thick)
  if (input.startsWith('==>', i)) return { style: 'thick', arrow: true, consumed: 3 + (i - offset) };
  if (input.startsWith('===', i)) return { style: 'thick', arrow: false, consumed: 3 + (i - offset) };

  // Form 2: -.- or -.-> (dotted) — also -..- with one or more dots
  const dottedArrow = /^-\.+->/y;
  dottedArrow.lastIndex = i;
  const dArrow = dottedArrow.exec(input);
  if (dArrow) return { style: 'dotted', arrow: true, consumed: dArrow[0].length + (i - offset) };
  const dottedLine = /^-\.+-/y;
  dottedLine.lastIndex = i;
  const dLine = dottedLine.exec(input);
  if (dLine) return { style: 'dotted', arrow: false, consumed: dLine[0].length + (i - offset) };

  // Form 3: -- label --> or -- label ---
  if (input.startsWith('--', i) && !input.startsWith('-->', i) && !input.startsWith('---', i)) {
    const labelStart = i + 2;
    const labelEnd = findSubstring(input, labelStart, ['-->', '---']);
    if (labelEnd > 0) {
      const label = input.slice(labelStart, labelEnd).trim();
      const op = input.slice(labelEnd, labelEnd + 3);
      return {
        style: 'solid',
        arrow: op === '-->',
        label: stripQuotes(label),
        consumed: labelEnd + 3 - offset,
      };
    }
  }

  // Form 4: --> or ---
  if (input.startsWith('-->', i)) {
    const after = i + 3;
    // Optional |label|
    if (input[after] === '|') {
      const labelEnd = input.indexOf('|', after + 1);
      if (labelEnd > 0) {
        const label = input.slice(after + 1, labelEnd).trim();
        return { style: 'solid', arrow: true, label: stripQuotes(label), consumed: labelEnd + 1 - offset };
      }
    }
    return { style: 'solid', arrow: true, consumed: 3 + (i - offset) };
  }
  if (input.startsWith('---', i)) return { style: 'solid', arrow: false, consumed: 3 + (i - offset) };

  return null;
}

function findSubstring(input: string, from: number, needles: string[]): number {
  let best = -1;
  for (const n of needles) {
    const idx = input.indexOf(n, from);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

function stripComments(line: string): string {
  // Mermaid uses `%%` for line comments
  const commentIdx = line.indexOf('%%');
  return commentIdx === -1 ? line : line.slice(0, commentIdx);
}

/** Parse a mermaid graph/flowchart source into a structured graph. */
export function parseMermaid(source: string): MermaidGraph {
  const lines = source.split(/\r?\n/);
  const nodes = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const subgraphs: MermaidSubgraph[] = [];
  let direction: MermaidDirection = 'TD';
  let headerSeen = false;
  const subgraphStack: MermaidSubgraph[] = [];
  let subgraphCounter = 0;

  const ensureNode = (id: string, shape: FlowchartShapeKind = 'rectangle', label?: string): MermaidNode => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, shape, label: label ?? id };
      nodes.set(id, node);
    } else if (label !== undefined && (node.label === node.id || node.shape === 'rectangle')) {
      // Upgrade node when a later occurrence has more info
      if (label) node.label = label;
      if (shape !== 'rectangle') node.shape = shape;
    }
    if (subgraphStack.length > 0) {
      const sg = subgraphStack[subgraphStack.length - 1];
      if (!sg.nodeIds.includes(id)) sg.nodeIds.push(id);
    }
    return node;
  };

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const raw = stripComments(lines[lineNo]).trim();
    if (!raw) continue;

    if (!headerSeen) {
      const headerMatch = raw.match(/^(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)/i);
      if (headerMatch) {
        const dir = headerMatch[1].toUpperCase() as MermaidDirection;
        direction = dir === 'TB' ? 'TD' : dir;
        headerSeen = true;
        continue;
      }
      // Tolerate sources without an explicit header — assume TD
      headerSeen = true;
    }

    if (/^subgraph\b/i.test(raw)) {
      const m = raw.match(/^subgraph\s+(.+)$/i);
      const title = m ? stripQuotes(m[1].trim()) : `Group ${subgraphs.length + 1}`;
      const sg: MermaidSubgraph = { id: `sg-${++subgraphCounter}`, title, nodeIds: [] };
      subgraphs.push(sg);
      subgraphStack.push(sg);
      continue;
    }
    if (/^end\b/i.test(raw)) {
      subgraphStack.pop();
      continue;
    }

    // Skip styling directives we don't model
    if (/^(?:style|classDef|class|linkStyle|click)\b/i.test(raw)) continue;
    // Skip direction-only lines inside subgraphs ("direction LR")
    if (/^direction\s+/i.test(raw)) continue;

    // Try to parse a chain: NODE [edge NODE]+
    const firstNode = matchNode(raw, 0);
    if (!firstNode) continue;
    let cursor = firstNode.consumed;
    let prevId = firstNode.id;
    ensureNode(firstNode.id, firstNode.shape, firstNode.label === firstNode.id ? undefined : firstNode.label);

    while (cursor < raw.length) {
      const edge = matchEdge(raw, cursor);
      if (!edge) break;
      cursor += edge.consumed;
      const nextNode = matchNode(raw, cursor);
      if (!nextNode) {
        throw new MermaidParseError('expected node after edge operator', lineNo + 1);
      }
      cursor += nextNode.consumed;
      ensureNode(nextNode.id, nextNode.shape, nextNode.label === nextNode.id ? undefined : nextNode.label);
      edges.push({
        from: prevId,
        to: nextNode.id,
        label: edge.label,
        style: edge.style,
        arrow: edge.arrow,
      });
      prevId = nextNode.id;
    }
  }

  return { direction, nodes, edges, subgraphs };
}
