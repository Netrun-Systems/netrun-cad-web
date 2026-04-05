import React, { useEffect, useState, useCallback } from 'react';

/**
 * Non-intrusive offline indicator banner.
 * Shows at the top of the screen when the app loses connectivity.
 * Displays count of pending offline actions queued for sync.
 */
export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingActions, setPendingActions] = useState(0);

  const refreshQueueCount = useCallback(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'GET_QUEUE_COUNT' });
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Trigger the service worker to flush queued requests
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for messages from the service worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'QUEUE_COUNT') {
        setPendingActions(event.data.count);
      }
      if (event.data?.type === 'OFFLINE_QUEUE_FLUSHED') {
        setPendingActions((prev) => Math.max(0, prev - (event.data.count || 0)));
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Poll queue count periodically when offline
    const interval = setInterval(() => {
      if (!navigator.onLine) {
        refreshQueueCount();
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
      clearInterval(interval);
    };
  }, [refreshQueueCount]);

  if (!isOffline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[900] flex items-center justify-center gap-2
                 bg-amber-500/95 backdrop-blur-sm text-amber-950 text-sm font-medium
                 py-1.5 px-4 shadow-md"
      role="status"
      aria-live="polite"
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"
        />
      </svg>
      <span>
        You're offline — changes saved locally, will sync when connected
        {pendingActions > 0 && (
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-700/20 px-2 py-0.5 text-xs">
            {pendingActions} pending
          </span>
        )}
      </span>
    </div>
  );
};
