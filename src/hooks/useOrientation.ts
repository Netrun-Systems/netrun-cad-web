/**
 * useOrientation — detects portrait vs landscape orientation and touch capability.
 */

import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

export function useOrientation() {
  const [orientation, setOrientation] = useState<Orientation>(() =>
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
      ? 'portrait'
      : 'landscape'
  );

  const [isTouch, setIsTouch] = useState(() =>
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');

    const handler = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'portrait' : 'landscape');
    };

    // Initial check
    setOrientation(mql.matches ? 'portrait' : 'landscape');
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return { orientation, isTouch };
}
