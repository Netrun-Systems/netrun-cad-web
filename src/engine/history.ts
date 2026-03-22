import type { CADElement } from './types';

const MAX_HISTORY = 100;

export interface HistoryState {
  past: CADElement[][];
  present: CADElement[];
  future: CADElement[][];
}

export function createHistory(initial: CADElement[]): HistoryState {
  return { past: [], present: [...initial], future: [] };
}

export function pushState(history: HistoryState, next: CADElement[]): HistoryState {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return { past, present: [...next], future: [] };
}

export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history;
  const prev = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: prev,
    future: [history.present, ...history.future],
  };
}

export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
