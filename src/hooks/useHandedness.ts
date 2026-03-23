/**
 * useHandedness — persists left/right hand preference to localStorage.
 *
 * 'right' = palette on right side (default — right-handed pencil users control with left hand)
 * 'left'  = palette on left side  (left-handed pencil users control with right hand)
 */

import { useState, useCallback, useEffect } from 'react';

export type Handedness = 'left' | 'right';

const STORAGE_KEY = 'netrun-cad-handedness';

export function useHandedness(): [Handedness, (h: Handedness) => void, () => void] {
  const [hand, setHandState] = useState<Handedness>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'left' || stored === 'right') return stored;
    } catch { /* ignore */ }
    return 'right';
  });

  const setHand = useCallback((h: Handedness) => {
    setHandState(h);
    try {
      localStorage.setItem(STORAGE_KEY, h);
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setHand(hand === 'right' ? 'left' : 'right');
  }, [hand, setHand]);

  return [hand, setHand, toggle];
}
