// Color mode reuses the drawing tools with different brush defaults
// This hook provides color-mode-specific presets

import { useMemo } from 'react';
import type { ColorBrush } from '../../engine/types';

export interface ColorPreset {
  name: string;
  brush: ColorBrush;
  size: number;
  opacity: number;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Watercolor Light', brush: 'watercolor', size: 30, opacity: 0.3 },
  { name: 'Watercolor Medium', brush: 'watercolor', size: 20, opacity: 0.5 },
  { name: 'Marker Broad', brush: 'marker', size: 16, opacity: 0.7 },
  { name: 'Marker Fine', brush: 'marker', size: 8, opacity: 0.8 },
  { name: 'Fill', brush: 'fill', size: 40, opacity: 0.4 },
];

export const COLOR_PALETTE = [
  // Greens (foliage)
  '#2d5a27', '#4caf50', '#81c784', '#a5d6a7', '#c8e6c9',
  // Blues (water, sky)
  '#1565c0', '#42a5f5', '#90caf9',
  // Browns (earth, hardscape)
  '#5d4037', '#8d6e63', '#bcaaa4', '#d7ccc8',
  // Warm (flowers)
  '#e53935', '#ff7043', '#ffa726', '#ffee58', '#f48fb1',
  // Gray (stone, concrete)
  '#616161', '#9e9e9e', '#e0e0e0',
];

export function useColorTools() {
  const presets = useMemo(() => COLOR_PRESETS, []);
  const palette = useMemo(() => COLOR_PALETTE, []);

  return { presets, palette };
}
