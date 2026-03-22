/**
 * ProjectBar — top bar with project name, client, Drive save status,
 * and New / Open / Save / Save As / Share / Export PDF to Drive buttons.
 *
 * This component is the integration point between the canvas state and
 * the Google Drive service.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { googleDrive } from '../../services/google-drive';
import type { NetrunCADProject, DriveFile } from '../../services/google-drive';
import type { CADElement, Layer, GridSettings } from '../../engine/types';
import type { BasemapState } from '../Basemap/BasemapRenderer';
import { NewProjectDialog } from './NewProjectDialog';
import type { NewProjectOptions } from './NewProjectDialog';
import { ProjectList } from './ProjectList';
import { ShareDialog } from './ShareDialog';

// ── Save status indicator ──────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const map: Record<SaveStatus, { text: string; cls: string }> = {
    idle: { text: '', cls: '' },
    unsaved: { text: 'Unsaved changes', cls: 'text-yellow-400' },
    saving: { text: 'Saving...', cls: 'text-cad-dim animate-pulse' },
    saved: { text: 'Saved to Drive', cls: 'text-green-400' },
    error: { text: 'Save failed', cls: 'text-red-400' },
  };
  const { text, cls } = map[status];
  return <span className={`text-xs ${cls}`}>{text}</span>;
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ProjectBarProps {
  elements: CADElement[];
  layers: Layer[];
  grid: GridSettings;
  basemap: BasemapState;
  onNewProject: (opts: NewProjectOptions) => void;
  onOpenProject: (project: NetrunCADProject) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ProjectBar: React.FC<ProjectBarProps> = ({
  elements,
  layers,
  grid,
  basemap,
  onNewProject,
  onOpenProject,
}) => {
  // Project meta
  const [projectName, setProjectName] = useState('Untitled Project');
  const [clientName, setClientName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [projectNotes, setProjectNotes] = useState('');

  // Drive state
  const [signedIn, setSignedIn] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<Partial<NetrunCADProject>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showOpenList, setShowOpenList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveRef = useRef<string>('');
  const elementsRef = useRef(elements);
  const layersRef = useRef(layers);
  const gridRef = useRef(grid);
  const basemapRef = useRef(basemap);

  // Keep refs current
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { basemapRef.current = basemap; }, [basemap]);

  // ── Drive auth ─────────────────────────────────────────────────────────────

  const handleSignIn = useCallback(async () => {
    try {
      await googleDrive.signIn();
      setSignedIn(true);
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    googleDrive.signOut();
    setSignedIn(false);
    setCurrentFileId(null);
    setSaveStatus('idle');
  }, []);

  // ── Build project snapshot ─────────────────────────────────────────────────

  const buildSnapshot = useCallback((): NetrunCADProject => {
    return googleDrive.buildProject(
      elementsRef.current,
      layersRef.current,
      gridRef.current,
      basemapRef.current,
      { name: projectName, client: clientName || undefined, notes: projectNotes || undefined },
      currentProject
    );
  }, [projectName, clientName, projectNotes, currentProject]);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!signedIn) {
      await handleSignIn();
    }
    setSaveStatus('saving');
    try {
      const project = buildSnapshot();
      const fileId = await googleDrive.saveProject(project, currentFileId ?? undefined);
      setCurrentFileId(fileId);
      setCurrentProject(project);
      lastSaveRef.current = JSON.stringify({ elements, layers });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
    }
  }, [signedIn, handleSignIn, buildSnapshot, currentFileId, elements, layers]);

  const handleSaveAs = useCallback(async () => {
    if (!signedIn) {
      await handleSignIn();
    }
    setSaveStatus('saving');
    try {
      const project = buildSnapshot();
      // Always create a new file (no fileId)
      const newFileId = await googleDrive.saveProject(project);
      setCurrentFileId(newFileId);
      setCurrentProject(project);
      lastSaveRef.current = JSON.stringify({ elements, layers });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save As failed:', err);
      setSaveStatus('error');
    }
  }, [signedIn, handleSignIn, buildSnapshot, elements, layers]);

  // ── Auto-save ──────────────────────────────────────────────────────────────

  // Mark unsaved when elements or layers change after initial load
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!signedIn || !currentFileId) return;

    const current = JSON.stringify({ elements, layers });
    if (current === lastSaveRef.current) return;

    setSaveStatus('unsaved');

    // Debounce auto-save at 30 seconds
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!currentFileId) return;
      try {
        setSaveStatus('saving');
        const project = buildSnapshot();
        await googleDrive.autoSave(project, currentFileId);
        setCurrentProject(project);
        lastSaveRef.current = JSON.stringify({ elements, layers });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('error');
      }
    }, 30_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, layers, signedIn, currentFileId]);

  // Save on window blur
  useEffect(() => {
    const handleBlur = () => {
      if (!signedIn || !currentFileId || saveStatus !== 'unsaved') return;
      void handleSave();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [signedIn, currentFileId, saveStatus, handleSave]);

  // ── Open ───────────────────────────────────────────────────────────────────

  const handleOpenFromDrive = useCallback(async (fileId: string) => {
    if (!signedIn) await handleSignIn();
    try {
      const project = await googleDrive.downloadProject(fileId);
      setCurrentFileId(fileId);
      setCurrentProject(project);
      setProjectName(project.name);
      setClientName(project.client ?? '');
      setProjectNotes(project.notes ?? '');
      lastSaveRef.current = JSON.stringify({ elements: project.elements, layers: project.layers });
      setSaveStatus('idle');
      onOpenProject(project);
    } catch (err) {
      console.error('Open failed:', err);
    }
  }, [signedIn, handleSignIn, onOpenProject]);

  const handleOpenPicker = useCallback(async () => {
    if (!signedIn) await handleSignIn();
    try {
      const { fileId, project } = await googleDrive.openProjectPicker();
      setCurrentFileId(fileId);
      setCurrentProject(project);
      setProjectName(project.name);
      setClientName(project.client ?? '');
      setProjectNotes(project.notes ?? '');
      lastSaveRef.current = JSON.stringify({ elements: project.elements, layers: project.layers });
      setSaveStatus('idle');
      onOpenProject(project);
    } catch (err: unknown) {
      // Picker cancelled is expected — not an error
      if (err instanceof Error && err.message !== 'Picker cancelled') {
        console.error('Open picker failed:', err);
      }
    }
  }, [signedIn, handleSignIn, onOpenProject]);

  // ── New project ────────────────────────────────────────────────────────────

  const handleNewProject = useCallback((opts: NewProjectOptions) => {
    setProjectName(opts.name);
    setClientName(opts.client);
    setProjectNotes('');
    setCurrentFileId(null);
    setCurrentProject({});
    setSaveStatus('idle');
    lastSaveRef.current = '';
    setShowNewDialog(false);
    onNewProject(opts);
  }, [onNewProject]);

  // ── Project name editing ───────────────────────────────────────────────────

  const handleNameClick = () => {
    setNameInput(projectName);
    setEditingName(true);
  };

  const handleNameBlur = () => {
    if (nameInput.trim()) setProjectName(nameInput.trim());
    setEditingName(false);
  };

  const handleNameKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (nameInput.trim()) setProjectName(nameInput.trim());
      setEditingName(false);
    }
    if (e.key === 'Escape') setEditingName(false);
  };

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 's' && !e.shiftKey) { e.preventDefault(); void handleSave(); }
      if (e.key === 's' && e.shiftKey) { e.preventDefault(); void handleSaveAs(); }
      if (e.key === 'o') { e.preventDefault(); void handleOpenPicker(); }
      if (e.key === 'n') { e.preventDefault(); setShowNewDialog(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleSaveAs, handleOpenPicker]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const btnBase =
    'flex items-center gap-1 px-2.5 py-1.5 bg-cad-surface/90 border border-cad-accent text-cad-text rounded-lg text-xs hover:bg-cad-accent/30 transition-colors disabled:opacity-40';

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Project name */}
        <div className="flex items-center gap-1 mr-1">
          {editingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKey}
              autoFocus
              className="bg-cad-bg border border-blue-400 rounded px-2 py-1 text-cad-text text-xs outline-none w-40"
            />
          ) : (
            <button
              onClick={handleNameClick}
              title="Click to rename project"
              className="text-xs text-cad-text hover:text-white font-medium truncate max-w-[140px]"
            >
              {projectName}
            </button>
          )}
          {clientName && (
            <span className="text-cad-dim text-xs">— {clientName}</span>
          )}
        </div>

        {/* Save status */}
        <SaveIndicator status={saveStatus} />

        {/* Separator */}
        <div className="w-px h-5 bg-cad-accent/50 mx-0.5" />

        {/* New */}
        <button
          onClick={() => setShowNewDialog(true)}
          title="New project (Ctrl+N)"
          className={btnBase}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>

        {/* Open */}
        <button
          onClick={() => signedIn ? setShowOpenList(true) : handleOpenPicker()}
          title="Open project from Drive (Ctrl+O)"
          className={btnBase}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          Open
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          title="Save to Drive (Ctrl+S)"
          className={`${btnBase} ${saveStatus === 'unsaved' ? 'border-yellow-500/60' : ''}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {saveStatus === 'saving' ? 'Saving...' : 'Save'}
        </button>

        {/* Save As */}
        <button
          onClick={handleSaveAs}
          disabled={saveStatus === 'saving'}
          title="Save as new file (Ctrl+Shift+S)"
          className={btnBase}
        >
          Save As
        </button>

        {/* Share */}
        {currentFileId && (
          <button
            onClick={() => setShowShareDialog(true)}
            title="Share with client"
            className={btnBase}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        )}

        {/* Separator */}
        <div className="w-px h-5 bg-cad-accent/50 mx-0.5" />

        {/* Google Drive auth button */}
        {!signedIn ? (
          <button
            onClick={handleSignIn}
            title="Connect Google Drive"
            className={`${btnBase} border-blue-500/50 hover:border-blue-400`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Connect Drive
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            title="Disconnect Google Drive"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-cad-surface/90 border border-green-600/50 text-green-400 rounded-lg text-xs hover:bg-red-700/20 hover:border-red-500/50 hover:text-red-400 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Drive
          </button>
        )}
      </div>

      {/* Dialogs */}
      {showNewDialog && (
        <NewProjectDialog
          onConfirm={handleNewProject}
          onCancel={() => setShowNewDialog(false)}
        />
      )}

      {showOpenList && signedIn && (
        <ProjectList
          onOpen={handleOpenFromDrive}
          onClose={() => setShowOpenList(false)}
        />
      )}

      {showShareDialog && currentFileId && (
        <ShareDialog
          fileId={currentFileId}
          projectName={projectName}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </>
  );
};
