import React, { useState, useCallback } from 'react';
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

function hasLaunched(): boolean {
  try {
    return localStorage.getItem('survai_app_launched') === 'true';
  } catch {
    return false;
  }
}

const App: React.FC = () => {
  const [showApp, setShowApp] = useState(hasLaunched);

  const handleLaunchApp = useCallback(() => {
    try {
      localStorage.setItem('survai_app_launched', 'true');
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
      localStorage.setItem('survai_app_launched', 'true');
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
