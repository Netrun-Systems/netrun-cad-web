/**
 * ProjectDashboard — full-screen overlay showing all user projects
 * with thumbnails, status badges, search/filter, and sort options.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectInfo {
  id: string;
  name: string;
  lastModified: string;
  elementCount: number;
  scanCount: number;
  deviationCount: number;
  thumbnail?: string; // data URL from canvas snapshot
  status: 'draft' | 'scanned' | 'compared' | 'reported';
}

export interface ProjectDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (project: ProjectInfo) => void;
  onNewProject: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'survai_projects';

export function loadProjects(): ProjectInfo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectInfo[];
  } catch {
    return [];
  }
}

export function saveProjects(projects: ProjectInfo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function relativeDate(isoString: string): string {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return new Date(isoString).toLocaleDateString();
}

const STATUS_COLORS: Record<ProjectInfo['status'], string> = {
  draft: 'bg-gray-600 text-gray-200',
  scanned: 'bg-cyan-700 text-cyan-100',
  compared: 'bg-yellow-700 text-yellow-100',
  reported: 'bg-green-700 text-green-100',
};

type SortKey = 'recent' | 'name' | 'status';

// ── Component ────────────────────────────────────────────────────────────────

export default function ProjectDashboard({
  isOpen,
  onClose,
  onOpenProject,
  onNewProject,
}: ProjectDashboardProps) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  // Load projects from localStorage on open
  useEffect(() => {
    if (isOpen) {
      setProjects(loadProjects());
    }
  }, [isOpen]);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, editingId]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = projects;

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        result = [...result].sort(
          (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
        );
        break;
      case 'name':
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'status': {
        const order: Record<string, number> = { draft: 0, scanned: 1, compared: 2, reported: 3 };
        result = [...result].sort(
          (a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0),
        );
        break;
      }
    }

    return result;
  }, [projects, search, sortBy]);

  // Actions
  const handleRename = useCallback(
    (id: string) => {
      const name = editName.trim();
      if (!name) {
        setEditingId(null);
        return;
      }
      const updated = projects.map((p) => (p.id === id ? { ...p, name } : p));
      setProjects(updated);
      saveProjects(updated);
      setEditingId(null);
    },
    [projects, editName],
  );

  const handleDuplicate = useCallback(
    (project: ProjectInfo) => {
      const dup: ProjectInfo = {
        ...project,
        id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${project.name} (copy)`,
        lastModified: new Date().toISOString(),
      };
      const updated = [dup, ...projects];
      setProjects(updated);
      saveProjects(updated);
    },
    [projects],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      saveProjects(updated);
    },
    [projects],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0b0b1a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold text-gray-100 tracking-wide">My Projects</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            + New Project
          </button>
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-gray-100 transition-colors text-xl"
            aria-label="Close dashboard"
          >
            ×
          </button>
        </div>
      </div>

      {/* Search and Sort bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800/50 shrink-0">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-600"
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span>Sort:</span>
          {(['recent', 'name', 'status'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-1 rounded ${
                sortBy === key
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-400 hover:text-gray-200'
              } transition-colors capitalize`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
            {projects.length === 0 ? (
              <>
                <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-sm">No projects yet</p>
                <button
                  onClick={() => {
                    onNewProject();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
                >
                  Create your first project
                </button>
              </>
            ) : (
              <p className="text-sm">No projects match "{search}"</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-colors group"
              >
                {/* Thumbnail */}
                <div
                  className="h-32 bg-gray-950 flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    onOpenProject(project);
                    onClose();
                  }}
                >
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <svg
                      className="w-12 h-12 text-gray-800"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3 space-y-2">
                  {/* Project name */}
                  {editingId === project.id ? (
                    <input
                      ref={editRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(project.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full px-2 py-1 bg-gray-800 border border-cyan-600 rounded text-sm text-gray-100 focus:outline-none"
                    />
                  ) : (
                    <h3
                      className="text-sm font-medium text-gray-100 truncate cursor-pointer hover:text-cyan-400 transition-colors"
                      onClick={() => {
                        setEditingId(project.id);
                        setEditName(project.name);
                      }}
                      title="Click to rename"
                    >
                      {project.name}
                    </h3>
                  )}

                  {/* Last modified */}
                  <p className="text-[10px] text-gray-500">
                    {relativeDate(project.lastModified)}
                  </p>

                  {/* Stats row */}
                  <p className="text-[10px] text-gray-400">
                    {project.elementCount} elements · {project.scanCount} scans · {project.deviationCount} deviations
                  </p>

                  {/* Status + actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${
                        STATUS_COLORS[project.status]
                      }`}
                    >
                      {project.status}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          onOpenProject(project);
                          onClose();
                        }}
                        className="p-1.5 rounded text-gray-400 hover:text-cyan-400 hover:bg-gray-800 transition-colors"
                        title="Open"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDuplicate(project)}
                        className="p-1.5 rounded text-gray-400 hover:text-yellow-400 hover:bg-gray-800 transition-colors"
                        title="Duplicate"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 text-center text-[10px] text-gray-600 border-t border-gray-800/50 shrink-0">
        {projects.length} project{projects.length !== 1 ? 's' : ''} · Stored in browser
      </div>
    </div>
  );
}
