/**
 * ProjectFilesPanel — slide-out panel showing:
 *   1. Client Notes (Google Doc) — open inline or in new tab
 *   2. Materials folder — upload photos, scans, PDFs; view/delete existing
 *
 * The Google Doc is created automatically on first project save.
 * Materials are uploaded to a "Materials" subfolder in the client's Drive folder.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { googleDrive } from '../../services/google-drive';

interface ProjectFilesPanelProps {
  open: boolean;
  onClose: () => void;
  clientName?: string;
  signedIn: boolean;
}

interface MaterialFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
}

const fileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
  if (mimeType.includes('dxf') || mimeType.includes('dwg') || mimeType.includes('cad')) return '📐';
  return '📎';
};

const formatSize = (bytes: string): string => {
  const b = parseInt(bytes || '0', 10);
  if (b === 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ProjectFilesPanel: React.FC<ProjectFilesPanelProps> = ({
  open,
  onClose,
  clientName,
  signedIn,
}) => {
  const [tab, setTab] = useState<'notes' | 'materials'>('notes');
  const [notesDocUrl, setNotesDocUrl] = useState<string | null>(null);
  const [notesDocId, setNotesDocId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load project structure when panel opens
  useEffect(() => {
    if (!open || !signedIn) return;
    setLoading(true);
    setError(null);

    googleDrive.ensureProjectStructure(clientName)
      .then(({ notesDocId, notesDocUrl }) => {
        setNotesDocId(notesDocId);
        setNotesDocUrl(notesDocUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Load materials list
    googleDrive.listMaterials(clientName)
      .then(setMaterials)
      .catch((err) => console.warn('Failed to load materials:', err));
  }, [open, signedIn, clientName]);

  const handleUpload = useCallback(async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await googleDrive.uploadMaterial(file, clientName);
      }
      // Refresh materials list
      const updated = await googleDrive.listMaterials(clientName);
      setMaterials(updated);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [clientName]);

  const handleDelete = useCallback(async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    try {
      await googleDrive.deleteMaterial(fileId);
      setMaterials((prev) => prev.filter((m) => m.id !== fileId));
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div
        className="w-[480px] max-w-[90vw] bg-cad-surface border-l border-cad-accent flex flex-col"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cad-accent/50">
          <div>
            <h2 className="text-cad-text font-semibold text-sm">Project Files</h2>
            <p className="text-cad-dim text-xs mt-0.5">{clientName || 'No client set'}</p>
          </div>
          <button onClick={onClose} className="text-cad-dim hover:text-cad-text min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cad-accent/50">
          {(['notes', 'materials'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-xs font-medium transition-colors min-h-[44px] ${
                tab === t
                  ? 'text-cad-highlight border-b-2 border-cad-highlight'
                  : 'text-cad-dim hover:text-cad-text'
              }`}
            >
              {t === 'notes' ? '📝 Client Notes' : `📁 Materials (${materials.length})`}
            </button>
          ))}
        </div>

        {!signedIn ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-cad-dim text-sm text-center">
              Sign in to Google Drive to access project files.
            </p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-cad-dim text-sm animate-pulse">Loading project files...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="mx-4 mt-3 px-3 py-2 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-xs">
                {error}
              </div>
            )}

            {/* ── Client Notes Tab ──────────────────────────────────────── */}
            {tab === 'notes' && (
              <div className="p-4 space-y-4">
                <p className="text-cad-dim text-xs">
                  A shared Google Doc for project team notes, site conditions, client preferences, and internal comments. Edits sync in real-time for all collaborators.
                </p>

                {notesDocUrl ? (
                  <>
                    {/* Embedded Google Doc viewer */}
                    <div className="rounded-lg overflow-hidden border border-cad-accent/50" style={{ height: 'calc(100vh - 280px)' }}>
                      <iframe
                        src={notesDocUrl.replace('/edit', '/edit?embedded=true')}
                        className="w-full h-full"
                        style={{ border: 'none', background: 'white' }}
                        title="Client Notes"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      />
                    </div>

                    {/* Open in new tab */}
                    <div className="flex gap-2">
                      <a
                        href={notesDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-600/30 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open in Google Docs
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="text-cad-dim text-xs">Save your project first to create the Client Notes document.</p>
                )}
              </div>
            )}

            {/* ── Materials Tab ─────────────────────────────────────────── */}
            {tab === 'materials' && (
              <div className="p-4 space-y-4">
                {/* Upload zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-cad-accent/50 rounded-lg p-4 text-center hover:border-cad-highlight/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.dxf,.dwg,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                    className="hidden"
                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  />
                  {uploading ? (
                    <span className="text-cad-dim text-sm animate-pulse">Uploading...</span>
                  ) : (
                    <>
                      <span className="text-2xl block mb-1">📤</span>
                      <p className="text-cad-text text-xs font-medium">Drop files here or tap to upload</p>
                      <p className="text-cad-dim text-[10px] mt-1">Photos, scans, PDFs, CAD files, documents</p>
                    </>
                  )}
                </div>

                {/* Materials list */}
                {materials.length === 0 ? (
                  <p className="text-cad-dim text-xs text-center py-6">No materials uploaded yet.</p>
                ) : (
                  <div className="space-y-1">
                    {materials.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-cad-accent/20 transition-colors group">
                        {/* Thumbnail or icon */}
                        {m.thumbnailLink ? (
                          <img
                            src={m.thumbnailLink}
                            alt=""
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <span className="text-xl w-10 h-10 flex items-center justify-center flex-shrink-0">
                            {fileIcon(m.mimeType)}
                          </span>
                        )}

                        {/* File info */}
                        <a
                          href={m.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0"
                        >
                          <div className="text-cad-text text-xs font-medium truncate hover:text-blue-300">{m.name}</div>
                          <div className="text-cad-dim text-[10px]">
                            {formatSize(m.size)} · {formatDate(m.modifiedTime)}
                          </div>
                        </a>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center text-cad-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
