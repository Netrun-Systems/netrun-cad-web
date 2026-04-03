/**
 * AppMenu — full-screen hamburger menu overlay.
 *
 * Contains all file operations, import/export, view settings, and preferences
 * that were previously crowding the top bar.
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import type { Handedness } from '../../hooks/useHandedness';
import type { CADElement, Layer, GridSettings } from '../../engine/types';
import type { BasemapState } from '../Basemap/BasemapRenderer';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AppMenuProps {
  open: boolean;
  onClose: () => void;

  // Hand preference
  hand: Handedness;
  onToggleHand: () => void;

  // File operations (delegated to ProjectBar callbacks)
  onNewProject: () => void;
  onOpenProject: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onShare: () => void;
  canShare: boolean;
  signedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;

  // Import/Export (triggers ImportExport modals)
  onImportDXF: () => void;
  onExportDXF: () => void;
  onExportPDF: () => void;
  onImportGIS: () => void;
  onImport3DScan: () => void;
  onImportSurvai: () => void;
  elementsCount: number;

  // View controls
  basemapEnabled: boolean;
  onToggleBasemap: () => void;
  onShowBasemapPanel: () => void;
  gridEnabled: boolean;
  snapEnabled: boolean;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;

  // Help
  onShowHelp: () => void;

  // Project files + history
  onShowProjectFiles: () => void;
  onShowRevisionHistory: () => void;

  // Clear
  onClearAll: () => void;

  // PWA install
  installPrompt: {
    canInstall: boolean;
    isInstalled: boolean;
    promptInstall: () => Promise<'accepted' | 'dismissed' | 'manual'>;
    isIOS: boolean;
    isSafari: boolean;
    needsManualInstall: boolean;
  };

  // UI panel visibility
  topBarHidden: boolean;
  onToggleTopBar: () => void;
  statusBarHidden: boolean;
  onToggleStatusBar: () => void;
  cmdLineHidden: boolean;
  onToggleCmdLine: () => void;
  shortcutBarCollapsed: boolean;
  onToggleShortcutBar: () => void;
  sidePanelCollapsed: boolean;
  onToggleSidePanel: () => void;
}

// ── Menu Section ──────────────────────────────────────────────────────────────

const MenuSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-cad-dim text-[10px] uppercase tracking-widest font-semibold mb-2 px-1">
      {title}
    </h3>
    <div className="space-y-0.5">
      {children}
    </div>
  </div>
);

const MenuItem: React.FC<{
  label: string;
  shortcut?: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}> = ({ label, shortcut, icon, onClick, disabled, danger, active }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-lg text-left transition-colors
      ${disabled
        ? 'opacity-40 cursor-not-allowed'
        : danger
          ? 'text-red-400 hover:bg-red-900/30'
          : active
            ? 'text-cad-highlight bg-cad-accent/20'
            : 'text-cad-text hover:bg-cad-accent/20'
      }
    `}
  >
    {icon && <span className="text-base w-6 text-center shrink-0">{icon}</span>}
    <span className="text-sm flex-1">{label}</span>
    {shortcut && (
      <span className="text-cad-dim text-[10px] font-mono">{shortcut}</span>
    )}
  </button>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const AppMenu: React.FC<AppMenuProps> = ({
  open,
  onClose,
  hand,
  onToggleHand,
  onNewProject,
  onOpenProject,
  onSave,
  onSaveAs,
  onShare,
  canShare,
  signedIn,
  onSignIn,
  onSignOut,
  onImportDXF,
  onExportDXF,
  onExportPDF,
  onImportGIS,
  onImport3DScan,
  onImportSurvai,
  elementsCount,
  basemapEnabled,
  onToggleBasemap,
  onShowBasemapPanel,
  gridEnabled,
  snapEnabled,
  onToggleGrid,
  onToggleSnap,
  onResetView,
  onZoomIn,
  onZoomOut,
  onShowHelp,
  onShowProjectFiles,
  onShowRevisionHistory,
  onClearAll,
  topBarHidden,
  onToggleTopBar,
  statusBarHidden,
  onToggleStatusBar,
  cmdLineHidden,
  onToggleCmdLine,
  shortcutBarCollapsed,
  onToggleShortcutBar,
  sidePanelCollapsed,
  onToggleSidePanel,
  installPrompt,
}) => {
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Wrap action to close menu after
  const action = useCallback(
    (fn: () => void) => () => {
      fn();
      onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      />

      {/* Menu panel */}
      <div
        className="fixed top-0 left-0 bottom-0 z-50 flex flex-col overflow-y-auto"
        style={{
          width: 'min(320px, 85vw)',
          background: '#0f0f1e',
          borderRight: '1px solid rgba(15, 52, 96, 0.6)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-cad-accent/50">
          <div className="flex items-center gap-2">
            <span className="text-cad-highlight font-bold text-sm tracking-wider">NETRUN CAD</span>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-cad-dim hover:text-cad-text transition-colors text-lg"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* Menu content */}
        <div className="flex-1 px-3 py-4">
          <MenuSection title="File">
            <MenuItem label="New Project" icon="📄" shortcut="Ctrl+N" onClick={action(onNewProject)} />
            <MenuItem label="Open from Drive" icon="📂" shortcut="Ctrl+O" onClick={action(onOpenProject)} />
            <MenuItem label="Save" icon="💾" shortcut="Ctrl+S" onClick={action(onSave)} />
            <MenuItem label="Save As..." icon="📋" shortcut="Ctrl+Shift+S" onClick={action(onSaveAs)} />
            <MenuItem label="Share" icon="🔗" onClick={action(onShare)} disabled={!canShare} />
            <MenuItem label="Project Files & Notes" icon="📁" onClick={action(onShowProjectFiles)} disabled={!signedIn} />
            <MenuItem label="Version History" icon="🕘" onClick={action(onShowRevisionHistory)} disabled={!signedIn} />
            <div className="h-px bg-cad-accent/30 my-1" />
            {!signedIn ? (
              <MenuItem label="Connect Google Drive" icon="☁️" onClick={action(onSignIn)} />
            ) : (
              <MenuItem label="Disconnect Drive" icon="☁️" onClick={action(onSignOut)} active />
            )}
          </MenuSection>

          <MenuSection title="Import">
            <MenuItem label="Import DXF" icon="📥" onClick={action(onImportDXF)} />
            <MenuItem label="Import GIS (GeoJSON/KML)" icon="🗺️" onClick={action(onImportGIS)} />
            <MenuItem label="Import 3D Scan" icon="📡" onClick={action(onImport3DScan)} />
            <MenuItem label="Survai Cloud Scan" icon="☁️" onClick={action(onImportSurvai)} />
          </MenuSection>

          <MenuSection title="Export">
            <MenuItem label="Export DXF" icon="📤" onClick={action(onExportDXF)} disabled={elementsCount === 0} />
            <MenuItem label="Export PDF" icon="🖨️" onClick={action(onExportPDF)} disabled={elementsCount === 0} />
          </MenuSection>

          <MenuSection title="View">
            <MenuItem
              label={basemapEnabled ? 'Basemap ON' : 'Basemap OFF'}
              icon="🛰️"
              onClick={action(onToggleBasemap)}
              active={basemapEnabled}
            />
            <MenuItem label="Basemap Settings" icon="⚙️" onClick={action(onShowBasemapPanel)} />
            <MenuItem
              label={`Grid ${gridEnabled ? 'ON' : 'OFF'}`}
              icon="🔲"
              shortcut="G / F7"
              onClick={action(onToggleGrid)}
              active={gridEnabled}
            />
            <MenuItem
              label={`Snap ${snapEnabled ? 'ON' : 'OFF'}`}
              icon="🧲"
              shortcut="S / F3"
              onClick={action(onToggleSnap)}
              active={snapEnabled}
            />
            <MenuItem label="Zoom In" icon="🔍" onClick={action(onZoomIn)} />
            <MenuItem label="Zoom Out" icon="🔍" onClick={action(onZoomOut)} />
            <MenuItem label="Reset View" icon="🔄" shortcut="Ctrl+0" onClick={action(onResetView)} />
          </MenuSection>

          <MenuSection title="Settings">
            <MenuItem
              label={`Hand: ${hand === 'right' ? 'Right panel' : 'Left panel'}`}
              icon={hand === 'right' ? '🤚' : '✋'}
              onClick={action(onToggleHand)}
            />
          </MenuSection>

          <MenuSection title="Show / Hide Panels">
            <MenuItem label={topBarHidden ? 'Show Top Bar' : 'Hide Top Bar'} icon="📏" onClick={action(onToggleTopBar)} active={!topBarHidden} />
            <MenuItem label={shortcutBarCollapsed ? 'Show Shortcut Bar' : 'Hide Shortcut Bar'} icon="⌨" onClick={action(onToggleShortcutBar)} active={!shortcutBarCollapsed} />
            <MenuItem label={sidePanelCollapsed ? 'Show Tool Panel' : 'Hide Tool Panel'} icon="🎛️" onClick={action(onToggleSidePanel)} active={!sidePanelCollapsed} />
            <MenuItem label={statusBarHidden ? 'Show Status Bar' : 'Hide Status Bar'} icon="📊" onClick={action(onToggleStatusBar)} active={!statusBarHidden} />
            <MenuItem label={cmdLineHidden ? 'Show Command Line' : 'Hide Command Line'} icon="⌨️" onClick={action(onToggleCmdLine)} active={!cmdLineHidden} />
          </MenuSection>

          <MenuSection title="Help">
            <MenuItem label="Help & Reference" icon="❓" shortcut="?" onClick={action(onShowHelp)} />
          </MenuSection>

          {/* Install to home screen */}
          {!installPrompt.isInstalled && (
            <MenuSection title="Install App">
              {installPrompt.canInstall ? (
                <MenuItem
                  label="Add to Home Screen"
                  icon="📲"
                  onClick={() => {
                    installPrompt.promptInstall();
                    onClose();
                  }}
                />
              ) : (
                <>
                  <MenuItem
                    label="Save to Home Screen"
                    icon="📲"
                    onClick={() => setShowInstallHelp(!showInstallHelp)}
                  />
                  {showInstallHelp && (
                    <div className="px-3 py-3 bg-cad-accent/10 rounded-lg mx-1 mt-1 space-y-2">
                      {installPrompt.isIOS ? (
                        <>
                          <p className="text-cad-text text-xs font-medium">On iPad / iPhone:</p>
                          <ol className="text-cad-dim text-xs space-y-1.5 list-decimal list-inside">
                            <li>Tap the <strong className="text-cad-text">Share</strong> button <span className="inline-block w-4 h-4 text-center border border-cad-accent rounded text-[10px] leading-4">↑</span> in Safari's toolbar</li>
                            <li>Scroll down and tap <strong className="text-cad-text">"Add to Home Screen"</strong></li>
                            <li>Tap <strong className="text-cad-text">"Add"</strong> in the top-right corner</li>
                          </ol>
                          <p className="text-cad-dim text-[10px] mt-2">The app will launch full-screen without browser bars, just like a native app.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-cad-text text-xs font-medium">In your browser:</p>
                          <ol className="text-cad-dim text-xs space-y-1.5 list-decimal list-inside">
                            <li>Tap the <strong className="text-cad-text">menu</strong> (three dots) in your browser</li>
                            <li>Tap <strong className="text-cad-text">"Add to Home Screen"</strong> or <strong className="text-cad-text">"Install App"</strong></li>
                            <li>Confirm by tapping <strong className="text-cad-text">"Install"</strong></li>
                          </ol>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </MenuSection>
          )}

          <div className="h-px bg-cad-accent/30 my-2" />

          <MenuItem
            label="Clear All Elements"
            icon="🗑️"
            onClick={action(onClearAll)}
            disabled={elementsCount === 0}
            danger
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center text-[10px] text-cad-dim/50 border-t border-cad-accent/30 shrink-0">
          Survai Construction
        </div>
      </div>
    </>
  );
};
