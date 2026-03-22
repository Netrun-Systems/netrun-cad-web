/**
 * PLY (Stanford Polygon Format) import — ASCII variant only.
 * KIRI Engine exports ASCII PLY. Binary PLY is noted as unsupported.
 *
 * Returns raw vertices for further processing by scan-processor.
 */

export interface PLYVertex {
  x: number;
  y: number;
  z: number;
  r?: number; // 0-255
  g?: number;
  b?: number;
}

export interface PLYData {
  vertices: PLYVertex[];
  vertexCount: number;
  hasColor: boolean;
  warnings: string[];
}

interface PLYProperty {
  type: string;
  name: string;
}

/**
 * Parse an ASCII PLY file text.
 * Handles the header to discover vertex count and property layout,
 * then reads vertex data rows.
 */
export function parsePLY(plyText: string): PLYData {
  const warnings: string[] = [];
  const vertices: PLYVertex[] = [];

  // Split into lines, normalizing line endings
  const lines = plyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let lineIdx = 0;

  // ── Header parsing ──────────────────────────────────────────────────────────

  if (lines[lineIdx]?.trim() !== 'ply') {
    throw new Error('Not a PLY file — first line must be "ply"');
  }
  lineIdx++;

  let format = '';
  let vertexCount = 0;
  const vertexProperties: PLYProperty[] = [];
  let inVertexElement = false;
  let headerDone = false;

  while (lineIdx < lines.length) {
    const line = lines[lineIdx].trim();
    lineIdx++;
    if (!line || line.startsWith('comment')) continue;

    const parts = line.split(/\s+/);

    if (parts[0] === 'format') {
      format = parts[1];
      if (format !== 'ascii') {
        throw new Error(`PLY format "${format}" is not supported — only ASCII PLY is supported`);
      }
    } else if (parts[0] === 'element') {
      inVertexElement = parts[1] === 'vertex';
      if (inVertexElement) {
        vertexCount = parseInt(parts[2], 10);
        if (isNaN(vertexCount)) {
          throw new Error('PLY header: invalid vertex count');
        }
      }
    } else if (parts[0] === 'property') {
      if (inVertexElement) {
        // property [list] type name  or  property type name
        if (parts[1] === 'list') {
          // Skip list properties (face data) — not needed for vertices
        } else {
          vertexProperties.push({ type: parts[1], name: parts[2] });
        }
      }
    } else if (parts[0] === 'end_header') {
      headerDone = true;
      break;
    }
  }

  if (!headerDone) {
    throw new Error('PLY file has no "end_header" line');
  }

  if (vertexCount === 0) {
    warnings.push('PLY file reports 0 vertices');
    return { vertices: [], vertexCount: 0, hasColor: false, warnings };
  }

  // Find property indices
  const xIdx = vertexProperties.findIndex((p) => p.name === 'x');
  const yIdx = vertexProperties.findIndex((p) => p.name === 'y');
  const zIdx = vertexProperties.findIndex((p) => p.name === 'z');

  if (xIdx === -1 || yIdx === -1 || zIdx === -1) {
    throw new Error('PLY vertex element is missing x, y, or z properties');
  }

  const rIdx = vertexProperties.findIndex((p) => p.name === 'red' || p.name === 'r');
  const gIdx = vertexProperties.findIndex((p) => p.name === 'green' || p.name === 'g');
  const bIdx = vertexProperties.findIndex((p) => p.name === 'blue' || p.name === 'b');
  const hasColor = rIdx !== -1 && gIdx !== -1 && bIdx !== -1;

  const propCount = vertexProperties.length;

  // ── Data parsing ────────────────────────────────────────────────────────────

  let parsed = 0;
  while (lineIdx < lines.length && parsed < vertexCount) {
    const line = lines[lineIdx].trim();
    lineIdx++;
    if (!line) continue;

    const parts = line.split(/\s+/);
    if (parts.length < propCount) {
      warnings.push(`Row ${parsed}: too few values (expected ${propCount}, got ${parts.length}) — skipped`);
      continue;
    }

    const x = parseFloat(parts[xIdx]);
    const y = parseFloat(parts[yIdx]);
    const z = parseFloat(parts[zIdx]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      warnings.push(`Row ${parsed}: non-numeric x/y/z — skipped`);
      continue;
    }

    const vertex: PLYVertex = { x, y, z };
    if (hasColor) {
      vertex.r = parseInt(parts[rIdx], 10);
      vertex.g = parseInt(parts[gIdx], 10);
      vertex.b = parseInt(parts[bIdx], 10);
    }

    vertices.push(vertex);
    parsed++;
  }

  if (parsed < vertexCount) {
    warnings.push(`Expected ${vertexCount} vertices but only read ${parsed}`);
  }

  return {
    vertices,
    vertexCount: vertices.length,
    hasColor,
    warnings,
  };
}
