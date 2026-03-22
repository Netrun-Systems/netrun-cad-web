import React, { useRef, useEffect, useCallback } from 'react';

export interface ContextMenuItem {
  label: string;
  action: string;
  disabled?: boolean;
  separator?: false;
}
export interface ContextMenuSeparator {
  separator: true;
}
export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  items,
  onAction,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp menu position so it doesn't go off-screen
  const safeX = Math.min(x, window.innerWidth - 200);
  const safeY = Math.min(y, window.innerHeight - items.length * 32 - 16);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleItemClick = useCallback(
    (action: string) => {
      onAction(action);
      onClose();
    },
    [onAction, onClose]
  );

  return (
    <div
      ref={menuRef}
      className="absolute z-50 rounded-lg overflow-hidden shadow-xl"
      style={{
        left: safeX,
        top: safeY,
        background: '#1a1a2e',
        border: '1px solid #2a2a4a',
        minWidth: '180px',
        fontFamily: "'Consolas', 'Courier New', monospace",
      }}
    >
      {items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return (
            <div
              key={`sep-${i}`}
              style={{ borderTop: '1px solid #2a2a4a', margin: '2px 0' }}
            />
          );
        }
        const menuItem = item as ContextMenuItem;
        return (
          <button
            key={menuItem.action}
            disabled={menuItem.disabled}
            onMouseDown={() => !menuItem.disabled && handleItemClick(menuItem.action)}
            className="w-full text-left px-4 py-2 text-xs transition-colors"
            style={{
              color: menuItem.disabled ? '#555577' : '#c8c8d0',
              background: 'transparent',
              cursor: menuItem.disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!menuItem.disabled)
                (e.currentTarget as HTMLButtonElement).style.background = '#1e3a5f';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {menuItem.label}
          </button>
        );
      })}
    </div>
  );
};
