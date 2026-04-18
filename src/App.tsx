import React, { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { CADCanvas } from './components/Canvas/CADCanvas';
import { LandingPage } from './components/Landing/LandingPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Hostname-based product mode.
// cad.netrunsystems.com → landscape workflow (Allie's primary tool).
// survai.netrunsystems.com → Survai Construction.
// Anything else (localhost, preview URLs) → default to landscape for dev.
type AppMode = 'landscape' | 'construction';

function detectMode(): AppMode {
  if (typeof window === 'undefined') return 'landscape';
  const host = window.location.hostname;
  if (host.startsWith('survai.')) return 'construction';
  return 'landscape';
}

const MODE = detectMode();
const LAUNCH_KEY = MODE === 'construction' ? 'survai_app_launched' : 'cad_app_launched';

function hasLaunched(): boolean {
  try {
    return localStorage.getItem(LAUNCH_KEY) === 'true';
  } catch {
    return false;
  }
}

const App: React.FC = () => {
  // Landscape mode skips the Survai-branded landing entirely — Allie and other
  // landscape users go straight to the CAD canvas. Only construction mode
  // shows the LandingPage (Survai marketing page).
  const [showApp, setShowApp] = useState(MODE === 'landscape' ? true : hasLaunched);

  // Correct the document title at runtime. index.html carries "Survai
  // Construction" for PWA/manifest reasons; override for landscape mode.
  useEffect(() => {
    if (MODE === 'landscape') {
      document.title = 'Netrun CAD — Landscape Design';
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) appleTitle.setAttribute('content', 'Netrun CAD');
    }
  }, []);

  const handleLaunchApp = useCallback(() => {
    try {
      localStorage.setItem(LAUNCH_KEY, 'true');
    } catch {
      // localStorage unavailable — proceed anyway
    }
    setShowApp(true);
  }, []);

  const handleTryDemo = useCallback(() => {
    setShowApp(true);
  }, []);

  const handleStartTrial = useCallback((_tier: string) => {
    try {
      localStorage.setItem(LAUNCH_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
    setShowApp(true);
  }, []);

  if (!showApp) {
    return (
      <LandingPage
        onLaunchApp={handleLaunchApp}
        onTryDemo={handleTryDemo}
        onStartTrial={handleStartTrial}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CADCanvas />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
