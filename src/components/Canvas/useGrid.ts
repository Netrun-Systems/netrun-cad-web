import { useState, useCallback } from 'react';
import type { GridSettings } from '../../engine/types';
import { DEFAULT_GRID } from '../../engine/types';

export function useGrid() {
  const [grid, setGrid] = useState<GridSettings>(DEFAULT_GRID);

  const toggleGrid = useCallback(() => {
    setGrid((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const toggleSnap = useCallback(() => {
    setGrid((prev) => ({ ...prev, snap: !prev.snap }));
  }, []);

  const setGridSize = useCallback((size: number) => {
    setGrid((prev) => ({ ...prev, size }));
  }, []);

  const setSnapSize = useCallback((snapSize: number) => {
    setGrid((prev) => ({ ...prev, snapSize }));
  }, []);

  const setUnit = useCallback((unit: GridSettings['unit']) => {
    setGrid((prev) => ({ ...prev, unit }));
  }, []);

  const setScale = useCallback((pixelsPerUnit: number) => {
    setGrid((prev) => ({ ...prev, pixelsPerUnit }));
  }, []);

  return {
    grid,
    toggleGrid,
    toggleSnap,
    setGridSize,
    setSnapSize,
    setUnit,
    setScale,
  };
}
