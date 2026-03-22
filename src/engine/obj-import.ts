/**
 * OBJ file import — text-based 3D format from KIRI Engine.
 *
 * Parses vertices (v) and faces (f) only. Ignores materials, normals, UVs.
 * Returns raw vertex array for further processing by scan-processor.
 */

export interface OBJVertex {
  x: number;
  y: number;
  z: number;
}

export interface OBJFace {
  /** Indices into the vertex array (0-based after conversion from 1-based OBJ). */
  indices: number[];
}

export interface OBJData {
  vertices: OBJVertex[];
  faces: OBJFace[];
  vertexCount: number;
  faceCount: number;
  warnings: string[];
}

/**
 * Parse an OBJ file text and return vertices + faces.
 * Memory-efficient: processes line by line.
 */
export function parseOBJ(objText: string): OBJData {
  const vertices: OBJVertex[] = [];
  const faces: OBJFace[] = [];
  const warnings: string[] = [];

  const lines = objText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const directive = parts[0];

    if (directive === 'v') {
      // Vertex: v x y z [w]
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        warnings.push(`Line ${i + 1}: invalid vertex — skipped`);
        continue;
      }
      vertices.push({ x, y, z });
    } else if (directive === 'f') {
      // Face: f v1 v2 v3 ... or f v1/vt1/vn1 ...
      // Convert 1-based OBJ indices to 0-based
      const indices: number[] = [];
      let valid = true;
      for (let j = 1; j < parts.length; j++) {
        const raw = parts[j].split('/')[0]; // strip texture/normal refs
        const idx = parseInt(raw, 10);
        if (isNaN(idx)) {
          warnings.push(`Line ${i + 1}: invalid face index "${parts[j]}" — face skipped`);
          valid = false;
          break;
        }
        // OBJ supports negative indices (relative to current vertex count)
        const resolved = idx > 0 ? idx - 1 : vertices.length + idx;
        indices.push(resolved);
      }
      if (valid && indices.length >= 3) {
        faces.push({ indices });
      }
    }
    // Silently ignore: vt, vn, vp, usemtl, mtllib, o, g, s, l
  }

  return {
    vertices,
    faces,
    vertexCount: vertices.length,
    faceCount: faces.length,
    warnings,
  };
}
