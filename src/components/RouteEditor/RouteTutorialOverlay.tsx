/**
 * RouteTutorialOverlay — guided tooltip shown the first time a user enters Route mode.
 * Persists dismissal in localStorage so it only appears once.
 */

import React, { useEffect, useState } from 'react';

export interface RouteTutorialOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
}

const STORAGE_KEY = 'survai_route_tutorial_seen';

const STEPS = [
  {
    label: 'Click to place waypoints',
    icon: (
      <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
        />
      </svg>
    ),
  },
  {
    label: 'Segments auto-connect with length',
    icon: (
      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="2" strokeWidth={1.5} />
        <circle cx="19" cy="12" r="2" strokeWidth={1.5} />
        <path strokeLinecap="round" strokeWidth={1.5} d="M7 12h10" />
        <path strokeLinecap="round" strokeWidth={1} d="M10 9.5l1-1.5h2l1 1.5" />
      </svg>
    ),
  },
  {
    label: 'Double-click or Enter to finish',
    icon: (
      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

export const RouteTutorialOverlay: React.FC<RouteTutorialOverlayProps> = ({
  isVisible,
  onDismiss,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Trigger slide-down animation after mount
      const timer = setTimeout(() => setMounted(true), 20);
      return () => clearTimeout(timer);
    }
    setMounted(false);
  }, [isVisible]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onDismiss();
  };

  return (
    <div
      className="absolute top-0 left-0 right-0 z-[40] flex items-center justify-center transition-transform duration-300 ease-out"
      style={{
        transform: mounted ? 'translateY(0)' : 'translateY(-100%)',
        background: 'rgba(17, 24, 39, 0.88)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div className="flex items-center gap-6 px-6 py-3 max-w-3xl w-full">
        {/* Steps */}
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 border border-gray-600">
              {step.icon}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-gray-400 text-xs font-bold">{i + 1}.</span>
              <span className="text-gray-200 text-xs whitespace-nowrap truncate">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <svg className="w-4 h-4 text-gray-600 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 ml-4 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default RouteTutorialOverlay;
