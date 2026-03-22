import { useState, useCallback } from 'react';
import type { Layer } from '../../engine/types';
import { DEFAULT_LAYERS } from '../../engine/types';

export function useLayers() {
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('site');

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  }, []);

  const toggleLayerLock = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
    );
  }, []);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  }, []);

  const addLayer = useCallback((name: string, color: string) => {
    const id = `layer-${Date.now()}`;
    setLayers((prev) => [
      ...prev,
      {
        id,
        name,
        visible: true,
        locked: false,
        opacity: 1,
        color,
        order: prev.length,
      },
    ]);
    setActiveLayerId(id);
  }, []);

  const removeLayer = useCallback(
    (layerId: string) => {
      setLayers((prev) => {
        const filtered = prev.filter((l) => l.id !== layerId);
        if (activeLayerId === layerId && filtered.length > 0) {
          setActiveLayerId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeLayerId]
  );

  return {
    layers,
    activeLayerId,
    setActiveLayerId,
    toggleLayerVisibility,
    toggleLayerLock,
    setLayerOpacity,
    addLayer,
    removeLayer,
  };
}
