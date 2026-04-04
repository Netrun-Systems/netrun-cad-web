/**
 * useInstallPrompt — captures the browser's beforeinstallprompt event
 * and exposes a trigger function for the "Add to Home Screen" menu item.
 *
 * Works on Chrome/Edge/Samsung Internet. Safari uses the native
 * "Add to Home Screen" flow (no JS API), so we show manual instructions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }
    // Also check iOS standalone
    if ((navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect install after prompt
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt.current = null;
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
        deferredPrompt.current = null;
      }
      return outcome;
    }
    // No deferred prompt available (Safari, Firefox) — return 'manual' to show instructions
    return 'manual';
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  return {
    canInstall,
    isInstalled,
    promptInstall,
    isIOS,
    isSafari,
    /** True if the native install prompt API is not available (Safari, Firefox) */
    needsManualInstall: !canInstall && !isInstalled,
  };
}
