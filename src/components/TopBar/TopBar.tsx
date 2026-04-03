/**
 * TopBar — thin top bar (40px) with only essential controls.
 *
 * Layout: [hamburger] [project name + save status] ---- [basemap] [help] [hand toggle]
 *
 * Everything else moves to the hamburger menu or side panel.
 */

import React from 'react';
import type { Handedness } from '../../hooks/useHandedness';

// ── Constants ─────────────────────────────────────────────────────────────────

export const TOP_BAR_HEIGHT = 40;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  // Menu
  onOpenMenu: () => void;

  // Project
  projectName: string;
  saveStatus: string;

  // Basemap
  basemapEnabled: boolean;
  onToggleBasemap: () => void;

  // Help
  onShowHelp: () => void;

  // Hand preference
  hand: Handedness;
  onToggleHand: () => void;

  // 3D viewer toggle
  show3D?: boolean;
  onToggle3D?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TopBar: React.FC<TopBarProps> = ({
  onOpenMenu,
  projectName,
  saveStatus,
  basemapEnabled,
  onToggleBasemap,
  onShowHelp,
  hand,
  onToggleHand,
  show3D,
  onToggle3D,
}) => {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 flex items-center px-2 gap-2"
      style={{
        height: `${TOP_BAR_HEIGHT}px`,
        background: 'rgba(15, 15, 35, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(15, 52, 96, 0.6)',
      }}
    >
      {/* Hamburger menu button */}
      <button
        onClick={onOpenMenu}
        className="min-w-[44px] min-h-[36px] flex items-center justify-center rounded-md
                   text-cad-dim hover:text-cad-text hover:bg-cad-accent/20 transition-colors"
        title="Menu"
        aria-label="Open menu"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="17" y2="1" />
          <line x1="1" y1="7" x2="17" y2="7" />
          <line x1="1" y1="13" x2="17" y2="13" />
        </svg>
      </button>

      {/* Project name + save status */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-cad-text text-xs font-medium truncate max-w-[200px]">
          {projectName}
        </span>
        {saveStatus && saveStatus !== 'idle' && (
          <span
            className={`text-[10px] shrink-0 ${
              saveStatus === 'saved'
                ? 'text-green-400'
                : saveStatus === 'saving'
                  ? 'text-cad-dim animate-pulse'
                  : saveStatus === 'unsaved'
                    ? 'text-yellow-400'
                    : saveStatus === 'error'
                      ? 'text-red-400'
                      : 'text-cad-dim'
            }`}
          >
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'unsaved' && 'Unsaved'}
            {saveStatus === 'error' && 'Save failed'}
          </span>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Basemap toggle */}
        <button
          onClick={onToggleBasemap}
          className={`min-w-[44px] min-h-[36px] flex items-center justify-center rounded-md text-xs transition-colors ${
            basemapEnabled
              ? 'text-blue-300 bg-blue-900/30 hover:bg-blue-900/50'
              : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
          }`}
          title={basemapEnabled ? 'Basemap ON' : 'Basemap OFF'}
          aria-label={`Basemap ${basemapEnabled ? 'on' : 'off'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>

        {/* 3D viewer toggle */}
        {onToggle3D && (
          <button
            onClick={onToggle3D}
            className={`min-w-[44px] min-h-[36px] flex items-center justify-center rounded-md text-xs font-bold transition-colors ${
              show3D
                ? 'text-emerald-300 bg-emerald-900/30 hover:bg-emerald-900/50'
                : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/20'
            }`}
            title={show3D ? '3D View ON' : '3D View OFF'}
            aria-label={`3D view ${show3D ? 'on' : 'off'}`}
          >
            3D
          </button>
        )}

        {/* Help */}
        <button
          onClick={onShowHelp}
          className="min-w-[44px] min-h-[36px] flex items-center justify-center rounded-md
                     text-cad-dim hover:text-cad-text hover:bg-cad-accent/20 transition-colors font-bold text-sm"
          title="Help & Reference (?)"
          aria-label="Help"
        >
          ?
        </button>

        {/* Hand toggle */}
        <button
          onClick={onToggleHand}
          className="min-w-[44px] min-h-[36px] flex items-center justify-center rounded-md
                     text-cad-dim hover:text-cad-text hover:bg-cad-accent/20 transition-colors text-sm"
          title={`Panel on ${hand === 'right' ? 'right' : 'left'} — click to swap`}
          aria-label={`Move panel to ${hand === 'right' ? 'left' : 'right'} side`}
        >
          {hand === 'right' ? '🤚' : '✋'}
        </button>
      </div>
    </div>
  );
};
