/**
 * Parse a PLY file (ASCII) into Float32Arrays suitable for Three.js point cloud rendering.
 *
 * Uses the existing parsePLY() engine for header/vertex parsing, then converts
 * PLYVertex[] into compact typed arrays for GPU upload.
 *
 * For large files (>500K points), reservoir-samples down to 500K to keep
 * the WebGL frame budget reasonable on mid-range hardware.
 */

import { parsePLY, type PLYVertex } from './ply-import';

export interface PointCloudData {
  positions: Float32Array; // x,y,z interleaved (length = count * 3)
  colors: Float32Array | null; // r,g,b interleaved, normalized 0-1 (length = count * 3)
  count: number;
}

const MAX_RENDER_POINTS = 500_000;

/**
 * Read a PLY File object and return typed arrays for Three.js rendering.
 * Large files (>500K vertices) are downsampled via reservoir sampling.
 */
export async function parsePLYForThreeJS(file: File): Promise<PointCloudData> {
  const text = await file.text();
  const plyData = parsePLY(text);

  let vertices: PLYVertex[] = plyData.vertices;

  // Downsample if necessary
  if (vertices.length > MAX_RENDER_POINTS) {
    vertices = reservoirSample(vertices, MAX_RENDER_POINTS);
  }

  const count = vertices.length;
  const positions = new Float32Array(count * 3);
  const hasColor = plyData.hasColor;
  const colors = hasColor ? new Float32Array(count * 3) : null;

  for (let i = 0; i < count; i++) {
    const v = vertices[i];
    const off = i * 3;
    positions[off] = v.x;
    positions[off + 1] = v.y;
    positions[off + 2] = v.z;

    if (colors && hasColor) {
      // PLY colors are 0-255; normalize to 0-1 for Three.js
      colors[off] = (v.r ?? 128) / 255;
      colors[off + 1] = (v.g ?? 128) / 255;
      colors[off + 2] = (v.b ?? 128) / 255;
    }
  }

  return { positions, colors, count };
}

/**
 * Reservoir sampling — uniformly sample `k` items from `arr` without
 * allocating a copy of the full array up front.
 */
function reservoirSample<T>(arr: T[], k: number): T[] {
  const reservoir = arr.slice(0, k);
  for (let i = k; i < arr.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < k) {
      reservoir[j] = arr[i];
    }
  }
  return reservoir;
}
