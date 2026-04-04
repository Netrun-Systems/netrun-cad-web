/**
 * ShortcutBar — vertical strip of programmable thumb-sized shortcut buttons.
 *
 * Positioned on the left side of the screen (opposite the tool panel).
 * Default shortcuts map to common 2D CAD keyboard commands.
 * Each button is "programmable" — long-press to reassign from a picker.
 *
 * Buttons are 48x48 minimum (Apple HIG touch target) with clear labels.
 * The entire bar is collapsible via a toggle button.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Handedness } from '../../hooks/useHandedness';

// ── Shortcut definitions ──────────────────────────────────────────────────────

export interface ShortcutButton {
  id: string;
  label: string;        // Shown on the button (1-3 chars)
  tooltip: string;      // Full description
  action: string;       // executeCommand action ID
  icon?: string;        // Optional emoji/symbol
  category: string;     // For the reassignment picker
}

const ALL_SHORTCUTS: ShortcutButton[] = [
  // Tools
  { id: 'select', label: 'V', tooltip: 'Select / Move', action: 'tool:select', icon: '↖', category: 'Tools' },
  { id: 'line', label: 'L', tooltip: 'Line', action: 'tool:line', icon: '╲', category: 'Tools' },
  { id: 'rect', label: 'R', tooltip: 'Rectangle', action: 'tool:rectangle', icon: '▭', category: 'Tools' },
  { id: 'circle', label: 'C', tooltip: 'Circle', action: 'tool:circle', icon: '○', category: 'Tools' },
  { id: 'dim', label: 'D', tooltip: 'Dimension', action: 'tool:dimension', icon: '↔', category: 'Tools' },
  { id: 'move-tool', label: 'M', tooltip: 'Pan / Move View', action: 'tool:move', icon: '✥', category: 'Tools' },
  // Edit
  { id: 'undo', label: '↩', tooltip: 'Undo', action: 'edit:undo', icon: '↩', category: 'Edit' },
  { id: 'redo', label: '↪', tooltip: 'Redo', action: 'edit:redo', icon: '↪', category: 'Edit' },
  { id: 'delete', label: 'Del', tooltip: 'Delete', action: 'delete', icon: '🗑', category: 'Edit' },
  // View
  { id: 'grid', label: 'G', tooltip: 'Toggle Grid', action: 'view:grid', icon: '#', category: 'View' },
  { id: 'snap', label: 'S', tooltip: 'Toggle Snap', action: 'view:snap', icon: '⊕', category: 'View' },
  { id: 'zoom-fit', label: 'F', tooltip: 'Zoom to Fit', action: 'view:fit', icon: '⊡', category: 'View' },
  // Modes
  { id: 'mode-cad', label: '1', tooltip: 'CAD Mode', action: 'mode:cad', icon: '📐', category: 'Mode' },
  { id: 'mode-draw', label: '2', tooltip: 'Draw Mode', action: 'mode:draw', icon: '✏️', category: 'Mode' },
  { id: 'mode-color', label: '3', tooltip: 'Color Mode', action: 'mode:color', icon: '🎨', category: 'Mode' },
  { id: 'mode-text', label: '4', tooltip: 'Text Mode', action: 'mode:text', icon: '𝐀', category: 'Mode' },
  // File
  { id: 'save', label: '💾', tooltip: 'Save', action: 'file:save', icon: '💾', category: 'File' },
  { id: 'open', label: '📂', tooltip: 'Open', action: 'file:open', icon: '📂', category: 'File' },
  { id: 'export', label: 'PDF', tooltip: 'Export PDF', action: 'file:export-pdf', icon: '📄', category: 'File' },
  // Specialty
  { id: 'plants', label: '🌿', tooltip: 'Plant Browser', action: 'panel:plants', icon: '🌿', category: 'Panels' },
  { id: 'interior', label: '🪑', tooltip: 'Interior Symbols', action: 'panel:interior', icon: '🪑', category: 'Panels' },
  { id: 'survai', label: '☁️', tooltip: 'Survai Scans', action: 'panel:survai', icon: '☁️', category: 'Panels' },
  { id: 'files', label: '📁', tooltip: 'Project Files & Notes', action: 'panel:files', icon: '📁', category: 'Panels' },
  { id: 'history', label: '🕘', tooltip: 'Version History', action: 'panel:history', icon: '🕘', category: 'Panels' },
  { id: 'help', label: '?', tooltip: 'Help & Shortcuts', action: 'panel:help', icon: '?', category: 'Panels' },
  { id: 'escape', label: 'Esc', tooltip: 'Cancel / Deselect', action: 'escape', icon: '✕', category: 'Edit' },
];

// Default bar layout (what ships on first use)
const DEFAULT_SLOT_IDS = [
  'select', 'line', 'rect', 'circle', 'dim',
  'undo', 'redo', 'delete',
  'grid', 'snap',
  'escape',
];

const STORAGE_KEY = 'netrun-cad-shortcut-bar';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShortcutBarProps {
  hand: Handedness;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onExecuteAction: (action: string) => void;
  /** Currently active tool/mode for highlight */
  activeTool?: string;
  activeMode?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ShortcutBar: React.FC<ShortcutBarProps> = ({
  hand,
  collapsed,
  onToggleCollapse,
  onExecuteAction,
  activeTool,
  activeMode,
}) => {
  // Load slot config from localStorage
  const [slotIds, setSlotIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return DEFAULT_SLOT_IDS;
  });

  // Reassignment picker state
  const [editingSlotIdx, setEditingSlotIdx] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slotIds));
  }, [slotIds]);

  const shortcuts = slotIds.map(id => ALL_SHORTCUTS.find(s => s.id === id)).filter(Boolean) as ShortcutButton[];

  const handleTap = useCallback((action: string) => {
    onExecuteAction(action);
  }, [onExecuteAction]);

  const handleLongPressStart = useCallback((idx: number) => {
    longPressTimer.current = setTimeout(() => {
      setEditingSlotIdx(idx);
    }, 800);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const reassignSlot = useCallback((idx: number, newId: string) => {
    setSlotIds(prev => {
      const next = [...prev];
      next[idx] = newId;
      return next;
    });
    setEditingSlotIdx(null);
  }, []);

  const addSlot = useCallback((shortcutId: string) => {
    setSlotIds(prev => [...prev, shortcutId]);
  }, []);

  const removeSlot = useCallback((idx: number) => {
    setSlotIds(prev => prev.filter((_, i) => i !== idx));
    setEditingSlotIdx(null);
  }, []);

  const resetToDefaults = useCallback(() => {
    setSlotIds(DEFAULT_SLOT_IDS);
    setEditingSlotIdx(null);
  }, []);

  // Determine which side to show on (opposite of tool panel)
  const side = hand === 'right' ? 'left' : 'right';

  const isActive = (shortcut: ShortcutButton) => {
    if (shortcut.action.startsWith('tool:') && activeTool === shortcut.action.replace('tool:', '')) return true;
    if (shortcut.action.startsWith('mode:') && activeMode === shortcut.action.replace('mode:', '')) return true;
    return false;
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed z-30 min-w-[44px] min-h-[44px] flex items-center justify-center
                   bg-cad-surface/90 backdrop-blur-sm border border-cad-accent rounded-lg
                   text-cad-dim hover:text-cad-text hover:bg-cad-accent/30 transition-colors"
        style={{
          [side]: '8px',
          top: 'calc(40px + 8px)',
        }}
        title="Show shortcut bar"
        aria-label="Show shortcut bar"
      >
        ⌨
      </button>
    );
  }

  return (
    <>
      {/* Main shortcut bar */}
      <div
        className="fixed z-30 flex flex-col items-center gap-1 py-2 px-1
                   bg-cad-surface/90 backdrop-blur-sm border border-cad-accent/50 rounded-xl"
        style={{
          [side]: '6px',
          top: 'calc(40px + 6px)',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          /* Hide scrollbar for cleaner look */
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="min-w-[48px] min-h-[28px] flex items-center justify-center rounded-md
                     text-cad-dim hover:text-cad-text hover:bg-cad-accent/20 transition-colors text-xs"
          title="Hide shortcut bar"
          aria-label="Hide shortcut bar"
        >
          {side === 'left' ? '◀' : '▶'}
        </button>

        {/* Shortcut buttons */}
        {shortcuts.map((shortcut, idx) => (
          <button
            key={`${shortcut.id}-${idx}`}
            onClick={() => handleTap(shortcut.action)}
            onPointerDown={() => handleLongPressStart(idx)}
            onPointerUp={handleLongPressEnd}
            onPointerLeave={handleLongPressEnd}
            onContextMenu={(e) => { e.preventDefault(); setEditingSlotIdx(idx); }}
            className={`
              min-w-[48px] min-h-[48px] w-12 h-12 flex flex-col items-center justify-center
              rounded-xl transition-all select-none active:scale-90
              ${isActive(shortcut)
                ? 'bg-cad-highlight text-white shadow-lg shadow-cad-highlight/30'
                : 'text-cad-dim hover:text-cad-text hover:bg-cad-accent/30'
              }
            `}
            title={`${shortcut.tooltip} — long-press to reassign`}
            aria-label={shortcut.tooltip}
          >
            <span className="text-base leading-none">{shortcut.icon || shortcut.label}</span>
            <span className="text-[8px] leading-tight mt-0.5 opacity-60">{shortcut.label}</span>
          </button>
        ))}

        {/* Add button */}
        <button
          onClick={() => setEditingSlotIdx(-1)}
          className="min-w-[48px] min-h-[36px] w-12 flex items-center justify-center rounded-xl
                     text-cad-dim/40 hover:text-cad-dim hover:bg-cad-accent/20 transition-colors text-lg"
          title="Add shortcut button"
          aria-label="Add shortcut"
        >
          +
        </button>
      </div>

      {/* Reassignment picker overlay */}
      {editingSlotIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingSlotIdx(null)}
        >
          <div
            className="bg-cad-surface border border-cad-accent rounded-xl p-4 w-[340px] max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-cad-text font-semibold text-sm">
                {editingSlotIdx === -1 ? 'Add Shortcut' : `Reassign Button ${editingSlotIdx + 1}`}
              </h3>
              <div className="flex gap-2">
                {editingSlotIdx >= 0 && (
                  <button
                    onClick={() => removeSlot(editingSlotIdx)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
                <button
                  onClick={resetToDefaults}
                  className="text-xs text-cad-dim hover:text-cad-text"
                >
                  Reset All
                </button>
              </div>
            </div>

            {/* Group by category */}
            {['Tools', 'Edit', 'View', 'Mode', 'File', 'Panels'].map(cat => {
              const group = ALL_SHORTCUTS.filter(s => s.category === cat);
              return (
                <div key={cat} className="mb-3">
                  <div className="text-cad-dim text-[10px] uppercase tracking-wider mb-1">{cat}</div>
                  <div className="grid grid-cols-3 gap-1">
                    {group.map(s => {
                      const alreadyUsed = slotIds.includes(s.id) && (editingSlotIdx === -1 || slotIds[editingSlotIdx] !== s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            if (editingSlotIdx === -1) {
                              addSlot(s.id);
                            } else {
                              reassignSlot(editingSlotIdx, s.id);
                            }
                          }}
                          disabled={alreadyUsed}
                          className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-left transition-colors min-h-[44px]
                            ${alreadyUsed
                              ? 'opacity-30 cursor-not-allowed'
                              : 'hover:bg-cad-accent/30 cursor-pointer'
                            }
                          `}
                        >
                          <span className="text-base">{s.icon || s.label}</span>
                          <div>
                            <div className="text-cad-text text-xs font-medium">{s.tooltip}</div>
                            <div className="text-cad-dim text-[9px]">{s.label}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

export { ALL_SHORTCUTS };
