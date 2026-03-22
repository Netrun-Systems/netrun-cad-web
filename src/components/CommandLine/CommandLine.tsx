import React, { useRef, useEffect, useCallback, useState } from 'react';
import { getCompletions, findCommand, type Command } from '../../engine/commands';

export interface CommandLineProps {
  /** Current prompt text shown in the command line (e.g. "Specify first point:") */
  prompt: string;
  /** Last 3 executed commands for scrollback display */
  history: string[];
  /** Whether the command line should be visible */
  visible: boolean;
  /** Whether the input should be focused (controlled externally by Enter key) */
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  onExecute: (input: string) => void;
  onCancel: () => void;
}

export const CommandLine: React.FC<CommandLineProps> = ({
  prompt,
  history,
  visible,
  focused,
  onFocusChange,
  onExecute,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [completions, setCompletions] = useState<Command[]>([]);
  const [completionIndex, setCompletionIndex] = useState(-1);

  // Focus the input when the focused prop changes
  useEffect(() => {
    if (focused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focused]);

  // Update completions as user types
  const updateCompletions = useCallback((text: string) => {
    if (text.length === 0) {
      setCompletions([]);
      setCompletionIndex(-1);
      return;
    }
    const matches = getCompletions(text);
    setCompletions(matches);
    setCompletionIndex(-1);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      updateCompletions(v);
    },
    [updateCompletions]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setValue('');
        setCompletions([]);
        setCompletionIndex(-1);
        onCancel();
        inputRef.current?.blur();
        onFocusChange(false);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          onExecute(trimmed);
          setValue('');
          setCompletions([]);
          setCompletionIndex(-1);
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (completions.length === 0) return;

        const nextIndex = (completionIndex + 1) % completions.length;
        setCompletionIndex(nextIndex);
        const alias = completions[nextIndex].aliases[0];
        setValue(alias);
        updateCompletions(alias);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (completions.length > 0) {
          const prevIndex =
            completionIndex <= 0 ? completions.length - 1 : completionIndex - 1;
          setCompletionIndex(prevIndex);
          const alias = completions[prevIndex].aliases[0];
          setValue(alias);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (completions.length > 0) {
          const nextIndex = (completionIndex + 1) % completions.length;
          setCompletionIndex(nextIndex);
          const alias = completions[nextIndex].aliases[0];
          setValue(alias);
        }
        return;
      }
    },
    [value, completions, completionIndex, onExecute, onCancel, onFocusChange, updateCompletions]
  );

  const handleFocus = useCallback(() => {
    onFocusChange(true);
  }, [onFocusChange]);

  const handleBlur = useCallback(() => {
    // Small delay so click-on-completion works before blur fires
    setTimeout(() => {
      onFocusChange(false);
      setCompletions([]);
      setCompletionIndex(-1);
    }, 150);
  }, [onFocusChange]);

  const handleCompletionClick = useCallback(
    (cmd: Command) => {
      const alias = cmd.aliases[0];
      setValue(alias);
      setCompletions([]);
      setCompletionIndex(-1);
      inputRef.current?.focus();
    },
    []
  );

  if (!visible) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 select-none"
      style={{ fontFamily: "'Consolas', 'Courier New', monospace" }}
    >
      {/* Tab-completion dropdown — renders above the command bar */}
      {completions.length > 0 && (
        <div
          className="absolute bottom-full left-0 right-0 border-t border-cad-accent overflow-hidden"
          style={{ background: '#12121f', maxHeight: '120px', overflowY: 'auto' }}
        >
          {completions.slice(0, 8).map((cmd, i) => (
            <div
              key={cmd.action + cmd.aliases[0]}
              onMouseDown={() => handleCompletionClick(cmd)}
              className="px-4 py-0.5 text-xs cursor-pointer flex items-center gap-3"
              style={{
                background: i === completionIndex ? '#1e3a5f' : 'transparent',
                color: i === completionIndex ? '#ffffff' : '#9ca3af',
              }}
            >
              <span style={{ color: '#00d4aa', minWidth: '80px' }}>
                {cmd.aliases.join(', ').toUpperCase()}
              </span>
              <span>{cmd.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scrollback area — last 3 commands */}
      <div
        style={{ background: '#1a1a2e', borderTop: '1px solid #2a2a4a' }}
        className="px-4 pt-1 pb-0"
      >
        {history.slice(-3).map((h, i) => (
          <div key={i} className="text-xs leading-4" style={{ color: '#555577' }}>
            {h}
          </div>
        ))}
      </div>

      {/* Command input bar */}
      <div
        className="flex items-center gap-2 px-4 py-1.5"
        style={{ background: '#1a1a2e', borderTop: '1px solid #2a2a4a' }}
      >
        {/* Prompt label */}
        <span className="text-xs whitespace-nowrap" style={{ color: '#00d4aa', minWidth: '100px' }}>
          {prompt}
        </span>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Type a command or alias…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none text-xs"
          style={{
            color: '#ffffff',
            caretColor: '#00d4aa',
            fontFamily: 'inherit',
          }}
          // Right-click paste is native — no special handling needed
        />

        {/* Hint: Tab to complete */}
        {value.length > 0 && completions.length > 0 && (
          <span className="text-xs opacity-40" style={{ color: '#9ca3af' }}>
            Tab
          </span>
        )}
      </div>
    </div>
  );
};

/** Height in pixels consumed by the command line bar (scrollback + input) */
export const COMMAND_LINE_HEIGHT = 72; // px — used by canvas to avoid overlap
