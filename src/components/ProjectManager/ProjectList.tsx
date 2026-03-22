/**
 * ProjectList — modal showing recent .ncad projects from Google Drive.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { DriveFile } from '../../services/google-drive';
import { googleDrive } from '../../services/google-drive';

interface ProjectListProps {
  onOpen: (fileId: string) => void;
  onClose: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onOpen, onClose }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filtered, setFiltered] = useState<DriveFile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await googleDrive.listRecentProjects(30);
      setFiles(results);
      setFiltered(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(files.filter((f) => f.name.toLowerCase().includes(q)));
  }, [search, files]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cad-accent">
          <h2 className="text-cad-text font-semibold text-lg">Open Project</h2>
          <button
            onClick={onClose}
            className="text-cad-dim hover:text-cad-text transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-cad-accent">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-cad-bg border border-cad-accent rounded px-3 py-2 text-cad-text text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && (
            <div className="text-cad-dim text-sm text-center py-8">Loading projects from Drive...</div>
          )}
          {error && (
            <div className="text-red-400 text-sm text-center py-8">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-cad-dim text-sm text-center py-8">
              {search ? 'No projects match your search.' : 'No projects found in Google Drive.'}
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-1">
              {filtered.map((file) => (
                <button
                  key={file.id}
                  onClick={() => { onOpen(file.id); onClose(); }}
                  className="flex items-start justify-between px-4 py-3 rounded-lg border border-transparent hover:border-cad-accent hover:bg-cad-bg text-left transition-colors group"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-cad-text text-sm font-medium group-hover:text-white transition-colors">
                      {file.name}
                    </span>
                    {file.client && (
                      <span className="text-cad-dim text-xs">{file.client}</span>
                    )}
                  </div>
                  <span className="text-cad-dim text-xs shrink-0 ml-4 pt-0.5">
                    {formatDate(file.modifiedTime)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cad-accent flex items-center justify-between">
          <button
            onClick={load}
            disabled={loading}
            className="text-cad-dim hover:text-cad-text text-xs transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-cad-dim hover:text-cad-text text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
