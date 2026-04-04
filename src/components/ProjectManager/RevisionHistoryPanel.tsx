/**
 * RevisionHistoryPanel — browse and restore previous versions of the project.
 *
 * Uses the Google Drive Revisions API to list every saved state.
 * Manual saves (Ctrl+S) are pinned and never auto-pruned.
 * Auto-saves (30s interval) create revisions that may be pruned by Drive after 30 days.
 *
 * Users can:
 *   - Preview any revision (see element count, timestamp, who saved)
 *   - Restore a revision (creates a new revision with the old content)
 *   - Pin/unpin revisions to prevent auto-pruning
 */

import React, { useState, useEffect, useCallback } from 'react';
import { googleDrive } from '../../services/google-drive';
import type { NetrunCADProject } from '../../services/google-drive';

interface Revision {
  id: string;
  modifiedTime: string;
  size: string;
  keepForever: boolean;
  lastModifyingUser?: { displayName: string; photoLink?: string };
}

interface RevisionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  fileId: string | null;
  signedIn: boolean;
  onRestore: (project: NetrunCADProject) => void;
}

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  if (d.toDateString() === now.toDateString()) {
    return 'Today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatSize = (bytes: string): string => {
  const b = parseInt(bytes || '0', 10);
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

export const RevisionHistoryPanel: React.FC<RevisionHistoryPanelProps> = ({
  open,
  onClose,
  fileId,
  signedIn,
  onRestore,
}) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ revId: string; project: NetrunCADProject } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !signedIn || !fileId) return;
    setLoading(true);
    setError(null);
    googleDrive.listRevisions(fileId)
      .then(setRevisions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, signedIn, fileId]);

  const handlePreview = useCallback(async (revId: string) => {
    if (!fileId) return;
    try {
      setPreview(null);
      const project = await googleDrive.downloadRevision(fileId, revId);
      setPreview({ revId, project });
    } catch (err: any) {
      setError(err.message || 'Preview failed');
    }
  }, [fileId]);

  const handleRestore = useCallback(async (revId: string) => {
    if (!fileId) return;
    if (!confirm('Restore this version? Your current work will be saved as a revision first.')) return;

    setRestoring(revId);
    setError(null);
    try {
      const project = await googleDrive.restoreRevision(fileId, revId);
      onRestore(project);
      // Refresh revision list (restore creates a new revision)
      const updated = await googleDrive.listRevisions(fileId);
      setRevisions(updated);
      setPreview(null);
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setRestoring(null);
    }
  }, [fileId, onRestore]);

  const handleTogglePin = useCallback(async (rev: Revision) => {
    if (!fileId) return;
    try {
      if (rev.keepForever) {
        await googleDrive.unpinRevision(fileId, rev.id);
      } else {
        await googleDrive.pinRevision(fileId, rev.id);
      }
      setRevisions((prev) =>
        prev.map((r) => r.id === rev.id ? { ...r, keepForever: !r.keepForever } : r)
      );
    } catch (err: any) {
      setError(err.message || 'Pin/unpin failed');
    }
  }, [fileId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl w-[520px] max-w-[90vw] max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cad-accent/50 shrink-0">
          <div>
            <h2 className="text-cad-text font-semibold text-sm">Version History</h2>
            <p className="text-cad-dim text-xs mt-0.5">
              {revisions.length} revision{revisions.length !== 1 ? 's' : ''} saved to Google Drive
            </p>
          </div>
          <button onClick={onClose} className="text-cad-dim hover:text-cad-text min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-xs shrink-0">
            {error}
          </div>
        )}

        {!signedIn || !fileId ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-cad-dim text-sm text-center">
              {!signedIn ? 'Sign in to Google Drive to view history.' : 'Save your project first to enable version history.'}
            </p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-cad-dim text-sm animate-pulse">Loading revision history...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-1">
              {revisions.map((rev, idx) => {
                const isCurrent = idx === 0;
                const isPreviewing = preview?.revId === rev.id;

                return (
                  <div key={rev.id} className="group">
                    <div
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer ${
                        isPreviewing ? 'bg-blue-900/30 border border-blue-500/50' : 'hover:bg-cad-accent/20'
                      }`}
                      onClick={() => handlePreview(rev.id)}
                    >
                      {/* Pin indicator */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePin(rev); }}
                        className={`min-w-[28px] min-h-[28px] flex items-center justify-center rounded text-xs transition-colors ${
                          rev.keepForever
                            ? 'text-yellow-400 hover:text-yellow-300'
                            : 'text-cad-dim/30 hover:text-cad-dim opacity-0 group-hover:opacity-100'
                        }`}
                        title={rev.keepForever ? 'Pinned (click to unpin)' : 'Pin this version'}
                      >
                        {rev.keepForever ? '📌' : '📌'}
                      </button>

                      {/* Revision info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-cad-text text-xs font-medium">
                            {isCurrent ? 'Current version' : formatDate(rev.modifiedTime)}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">LATEST</span>
                          )}
                          {rev.keepForever && (
                            <span className="text-[9px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">PINNED</span>
                          )}
                        </div>
                        <div className="text-cad-dim text-[10px] mt-0.5">
                          {formatSize(rev.size)}
                          {rev.lastModifyingUser && ` · ${rev.lastModifyingUser.displayName}`}
                        </div>
                      </div>

                      {/* Restore button */}
                      {!isCurrent && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestore(rev.id); }}
                          disabled={restoring === rev.id}
                          className="min-w-[44px] min-h-[36px] px-3 py-1.5 bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-600/30 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        >
                          {restoring === rev.id ? '...' : 'Restore'}
                        </button>
                      )}
                    </div>

                    {/* Preview details */}
                    {isPreviewing && preview && (
                      <div className="mx-3 mb-2 p-3 bg-cad-bg rounded-lg border border-cad-accent/30 text-xs">
                        <div className="grid grid-cols-2 gap-2 text-cad-dim">
                          <div>
                            <span className="text-cad-dim/60">Project:</span>{' '}
                            <span className="text-cad-text">{preview.project.name}</span>
                          </div>
                          <div>
                            <span className="text-cad-dim/60">Client:</span>{' '}
                            <span className="text-cad-text">{preview.project.client || '—'}</span>
                          </div>
                          <div>
                            <span className="text-cad-dim/60">Elements:</span>{' '}
                            <span className="text-cad-text">{preview.project.elements?.length || 0}</span>
                          </div>
                          <div>
                            <span className="text-cad-dim/60">Layers:</span>{' '}
                            <span className="text-cad-text">{preview.project.layers?.length || 0}</span>
                          </div>
                          <div>
                            <span className="text-cad-dim/60">Scale:</span>{' '}
                            <span className="text-cad-text">{preview.project.scale || '—'}</span>
                          </div>
                          <div>
                            <span className="text-cad-dim/60">Modified:</span>{' '}
                            <span className="text-cad-text">{formatDate(preview.project.modified)}</span>
                          </div>
                        </div>
                        {!isCurrent && (
                          <button
                            onClick={() => handleRestore(rev.id)}
                            disabled={restoring === rev.id}
                            className="mt-3 w-full py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            {restoring === rev.id ? 'Restoring...' : `Restore this version (${preview.project.elements?.length || 0} elements)`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {revisions.length === 0 && (
                <p className="text-cad-dim text-xs text-center py-8">No revisions yet. Save your project to start tracking versions.</p>
              )}
            </div>

            {/* Footer info */}
            <div className="px-5 py-3 border-t border-cad-accent/30 text-cad-dim text-[10px] shrink-0">
              <p>Manual saves (Ctrl+S) are pinned and kept forever. Auto-saves may be pruned by Google Drive after 30 days.</p>
              <p className="mt-1">Restoring a version saves your current work first, then applies the old version as a new revision.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
