/**
 * WelcomeModal — shown once to first-time visitors.
 * Highlights core Survai Construction features and offers trial / demo CTAs.
 */

import React from 'react';
import type { DemoProject } from '../../data/demo-project';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrial: () => void;
  onDemo: () => void;
  onLoadDemo?: (project: DemoProject) => void;
}

const FEATURES = [
  {
    title: 'Scan & Detect',
    desc: 'ML-powered MEP detection from 3D scans — electrical outlets, pipes, HVAC, and more.',
    icon: (
      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
  {
    title: 'Compare Plans',
    desc: 'Import DXF blueprints and find deviations between planned and actual — automatically.',
    icon: (
      <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    title: 'Estimate Costs',
    desc: 'Route estimation with material pricing — plan MEP routes and get real cost breakdowns.',
    icon: (
      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onStartTrial,
  onDemo,
  onLoadDemo,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70]"
        onClick={onClose}
        style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)' }}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
        <div
          className="relative w-full max-w-lg rounded-xl border border-gray-700 shadow-2xl"
          style={{ background: '#111827' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center
                       text-gray-400 hover:text-white transition-colors text-xl z-10"
            aria-label="Close"
          >
            &times;
          </button>

          {/* Header */}
          <div className="text-center pt-8 pb-4 px-6">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome to Survai Construction</h2>
            <p className="text-gray-400 text-sm">
              From 3D scan to construction plan — powered by ML.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="px-6 space-y-3 mb-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 items-start rounded-lg p-3 bg-gray-800/60 border border-gray-700/50"
              >
                <div className="shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <h3 className="text-white text-sm font-semibold mb-0.5">{f.title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="px-6 pb-6 space-y-2">
            <button
              onClick={onStartTrial}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => {
                if (onLoadDemo) {
                  import('../../data/demo-project').then(({ loadDemoProject }) => {
                    onLoadDemo(loadDemoProject());
                  });
                }
                onDemo();
              }}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-600"
            >
              Try Demo
            </button>
          </div>

          {/* Footer */}
          <div className="text-center pb-4 text-gray-500 text-[10px]">
            14-day free trial on all plans. No credit card required.
          </div>
        </div>
      </div>
    </>
  );
};

export default WelcomeModal;
