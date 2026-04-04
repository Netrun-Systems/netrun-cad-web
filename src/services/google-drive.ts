/**
 * Google Drive service for Netrun CAD.
 *
 * Uses Google Identity Services (GIS) for OAuth and the Drive Picker API for
 * the native Google Drive file browser. All file operations run client-side —
 * no custom backend needed.
 *
 * Setup:
 *   Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in a .env.local file.
 *   The OAuth consent screen must allow https://cad.netrunsystems.com and
 *   http://localhost:5173 as authorized JavaScript origins.
 */

import type { CADElement, Layer, GridSettings } from '../engine/types';
import type { BasemapState } from '../components/Basemap/BasemapRenderer';

// ── Config ─────────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';

const GOOGLE_API_KEY =
  (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) || '';

// Returns true if Drive credentials are configured (non-empty)
export const isDriveConfigured = () => !!GOOGLE_CLIENT_ID && !!GOOGLE_API_KEY;

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

const NCAD_MIME_TYPE = 'application/x-netrun-cad';
const NCAD_EXTENSION = '.ncad';
const FOLDER_NAME = 'Netrun CAD Projects';

// ── Project file format ────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface FreehandPoint extends Point {
  pressure: number;
}

export interface NetrunCADProject {
  version: '1.0';
  name: string;
  client?: string;
  address?: string;
  created: string;
  modified: string;
  scale: string;

  layers: Layer[];
  elements: CADElement[];

  basemap?: {
    enabled: boolean;
    lat: number;
    lng: number;
    zoom: number;
    provider: string;
  };

  notes?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  client?: string;
  modifiedTime: string;
  webViewLink?: string;
}

// ── Global type augments for Google APIs ──────────────────────────────────────

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function gapiLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (window.gapi) {
      resolve();
      return;
    }
    // Poll for gapi (loaded async)
    const interval = setInterval(() => {
      if (window.gapi) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

function googleLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (window.google?.accounts) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

// ── GoogleDriveService ─────────────────────────────────────────────────────────

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private gapiReady = false;

  // ── Initialization ────────────────────────────────────────────────────────

  /** Load gapi client and initialize the Drive API. */
  private async initGapi(): Promise<void> {
    if (this.gapiReady) return;
    await gapiLoaded();
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('client:picker', {
        callback: resolve,
        onerror: reject,
      });
    });
    await window.gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    this.gapiReady = true;
  }

  /** Initialize the GIS token client (only once). */
  private async initTokenClient(): Promise<void> {
    await googleLoaded();
    if (this.tokenClient) return;
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // set per-request below
    });
  }

  /** Request an access token. Resolves when the user grants (or has already granted). */
  private requestToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        this.accessToken = response.access_token;
        resolve(this.accessToken!);
      };

      if (this.accessToken) {
        // Already have a token — try a prompt-less refresh
        this.tokenClient.requestAccessToken({ prompt: '' });
      } else {
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Sign in with Google and obtain Drive access. */
  async signIn(): Promise<void> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      throw new Error('Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY.');
    }
    await this.initGapi();
    await this.initTokenClient();
    await this.requestToken();
  }

  /** True if the user is currently signed in. */
  isSignedIn(): boolean {
    return this.accessToken !== null;
  }

  /** Sign out / revoke the current token. */
  signOut(): void {
    if (this.accessToken) {
      window.google?.accounts?.oauth2?.revoke(this.accessToken);
    }
    this.accessToken = null;
  }

  // ── Folder management ──────────────────────────────────────────────────────

  /**
   * Find or create the "Netrun CAD Projects" root folder, then a client
   * sub-folder if a clientName is provided. Returns the target folder ID.
   */
  private async ensureFolder(clientName?: string): Promise<string> {
    const token = this.accessToken!;

    // Find or create root folder
    const rootQuery = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`
      )}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const rootData = await rootQuery.json();
    let rootFolderId: string;

    if (rootData.files && rootData.files.length > 0) {
      rootFolderId = rootData.files[0].id;
    } else {
      const create = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });
      const data = await create.json();
      rootFolderId = data.id;
    }

    if (!clientName) return rootFolderId;

    // Find or create client sub-folder
    const clientQuery = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='${clientName}' and '${rootFolderId}' in parents and trashed=false`
      )}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const clientData = await clientQuery.json();

    if (clientData.files && clientData.files.length > 0) {
      return clientData.files[0].id;
    }

    const createClient = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: clientName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      }),
    });
    const clientFolder = await createClient.json();
    return clientFolder.id;
  }

  // ── File serialization ─────────────────────────────────────────────────────

  /** Build a NetrunCADProject from current canvas state. */
  buildProject(
    elements: CADElement[],
    layers: Layer[],
    grid: GridSettings,
    basemap: BasemapState | null,
    projectMeta: { name: string; client?: string; address?: string; notes?: string },
    existing?: Partial<NetrunCADProject>
  ): NetrunCADProject {
    const now = new Date().toISOString();
    return {
      version: '1.0',
      name: projectMeta.name,
      client: projectMeta.client,
      address: projectMeta.address,
      notes: projectMeta.notes,
      created: existing?.created ?? now,
      modified: now,
      scale: `${grid.pixelsPerUnit}px = 1 ${grid.unit}`,
      layers,
      elements,
      basemap: basemap
        ? {
            enabled: basemap.enabled,
            lat: basemap.centerLat,
            lng: basemap.centerLng,
            zoom: basemap.tileZoom,
            provider: basemap.provider,
          }
        : undefined,
    };
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  /**
   * Save a project to Drive. Creates a new file or updates an existing one.
   * Returns the file ID.
   */
  async saveProject(project: NetrunCADProject, fileId?: string, pin = false): Promise<string> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const content = JSON.stringify(project, null, 2);
    const fileName = project.name + NCAD_EXTENSION;
    const folderId = await this.ensureFolder(project.client);

    if (fileId) {
      // Update existing file — Drive auto-creates a new revision
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': NCAD_MIME_TYPE,
        },
        body: content,
      });

      // Pin the new revision on manual saves so it's never auto-pruned
      if (pin) {
        try {
          const revisions = await this.listRevisions(fileId);
          if (revisions.length > 0) {
            await this.pinRevision(fileId, revisions[0].id);
          }
        } catch { /* pinning is non-critical */ }
      }

      return fileId;
    }

    // Create new file using multipart upload
    const boundary = 'ncad_boundary_' + Date.now();
    const metadata = JSON.stringify({
      name: fileName,
      mimeType: NCAD_MIME_TYPE,
      parents: [folderId],
    });

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      `Content-Type: ${NCAD_MIME_TYPE}`,
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Drive upload failed: ${err.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    return data.id as string;
  }

  /**
   * Auto-save to an existing file ID (silent, no picker).
   * Used for the periodic 30-second auto-save.
   */
  async autoSave(project: NetrunCADProject, fileId: string): Promise<void> {
    await this.saveProject(project, fileId);
  }

  // ── Revision history (version control via Drive Revisions API) ─────────

  /**
   * List all revisions of a .ncad file.
   * Each revision represents a saved state that can be restored.
   */
  async listRevisions(fileId: string): Promise<Array<{
    id: string;
    modifiedTime: string;
    size: string;
    keepForever: boolean;
    lastModifyingUser?: { displayName: string; photoLink?: string };
  }>> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime,size,keepForever,lastModifyingUser)&pageSize=100`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    const data = await response.json();
    return (data.revisions || []).reverse(); // newest first
  }

  /**
   * Download and parse a specific revision of a .ncad file.
   * Used for preview and restore.
   */
  async downloadRevision(fileId: string, revisionId: string): Promise<NetrunCADProject> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(`Failed to download revision: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Pin a revision so Google Drive never auto-prunes it.
   * Useful for marking milestone saves (manual Ctrl+S).
   */
  async pinRevision(fileId: string, revisionId: string): Promise<void> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepForever: true }),
      },
    );
  }

  /**
   * Unpin a revision (allow Drive to auto-prune it).
   */
  async unpinRevision(fileId: string, revisionId: string): Promise<void> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepForever: false }),
      },
    );
  }

  /**
   * Restore a file to a specific revision by downloading the old content
   * and saving it as a new revision (preserving history).
   */
  async restoreRevision(fileId: string, revisionId: string): Promise<NetrunCADProject> {
    const project = await this.downloadRevision(fileId, revisionId);
    // Save the old content as a new revision (so restore itself is in the history)
    project.modified = new Date().toISOString();
    await this.saveProject(project, fileId);
    return project;
  }

  // ── Project folder structure ────────────────────────────────────────────

  /**
   * Ensure the full project folder structure exists:
   *   Netrun CAD Projects / {client} /
   *     ├── Materials/        ← photos, scans, reference docs
   *     └── Client Notes      ← Google Doc for team notes
   *
   * Returns { clientFolderId, materialsFolderId, notesDocId, notesDocUrl }
   */
  async ensureProjectStructure(clientName?: string): Promise<{
    clientFolderId: string;
    materialsFolderId: string;
    notesDocId: string;
    notesDocUrl: string;
  }> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');
    const token = this.accessToken;
    const clientFolderId = await this.ensureFolder(clientName);

    // Find or create Materials subfolder
    const matQuery = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='Materials' and '${clientFolderId}' in parents and trashed=false`
      )}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const matData = await matQuery.json();
    let materialsFolderId: string;

    if (matData.files?.length > 0) {
      materialsFolderId = matData.files[0].id;
    } else {
      const create = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Materials',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [clientFolderId],
        }),
      });
      const folder = await create.json();
      materialsFolderId = folder.id;
    }

    // Find or create Client Notes Google Doc
    const displayName = clientName || 'Project';
    const notesDocName = `${displayName} — Notes`;
    const notesQuery = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType='application/vnd.google-apps.document' and name='${notesDocName}' and '${clientFolderId}' in parents and trashed=false`
      )}&fields=files(id,webViewLink)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const notesData = await notesQuery.json();
    let notesDocId: string;
    let notesDocUrl: string;

    if (notesData.files?.length > 0) {
      notesDocId = notesData.files[0].id;
      notesDocUrl = notesData.files[0].webViewLink;
    } else {
      // Create a Google Doc with starter template
      const createDoc = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: notesDocName,
          mimeType: 'application/vnd.google-apps.document',
          parents: [clientFolderId],
        }),
      });
      const doc = await createDoc.json();
      notesDocId = doc.id;
      notesDocUrl = doc.webViewLink;
    }

    return { clientFolderId, materialsFolderId, notesDocId, notesDocUrl };
  }

  /**
   * Upload a file (photo, scan, PDF, etc.) to the Materials subfolder.
   * Returns { id, name, webViewLink }.
   */
  async uploadMaterial(
    file: File,
    clientName?: string,
  ): Promise<{ id: string; name: string; webViewLink: string }> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const { materialsFolderId } = await this.ensureProjectStructure(clientName);

    const boundary = 'material_' + Date.now();
    const metadata = JSON.stringify({
      name: file.name,
      parents: [materialsFolderId],
    });

    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      `Content-Type: ${file.type || 'application/octet-stream'}`,
      '',
    ].join('\r\n');

    const endPart = `\r\n--${boundary}--`;
    const body = new Blob([metaPart, file, endPart]);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Material upload failed: ${err.error?.message ?? response.statusText}`);
    }

    return response.json();
  }

  /**
   * List files in the Materials subfolder.
   */
  async listMaterials(clientName?: string): Promise<Array<{
    id: string;
    name: string;
    mimeType: string;
    size: string;
    modifiedTime: string;
    webViewLink: string;
    thumbnailLink?: string;
  }>> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const { materialsFolderId } = await this.ensureProjectStructure(clientName);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `'${materialsFolderId}' in parents and trashed=false`
      )}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    const data = await response.json();
    return data.files || [];
  }

  /**
   * Delete a material file from Drive.
   */
  async deleteMaterial(fileId: string): Promise<void> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
  }

  // ── Companion file exports (DXF + PNG alongside .ncad) ──────────────────

  /**
   * Upload or update a companion file (DXF or PNG) in the same Drive folder.
   * Uses name-based matching to find existing companion files for updates.
   */
  async saveCompanionFile(
    content: Blob | string,
    filename: string,
    mimeType: string,
    clientName?: string,
  ): Promise<string> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const folderId = await this.ensureFolder(clientName);
    const isString = typeof content === 'string';
    const blob = isString ? new Blob([content], { type: mimeType }) : content;

    // Check if companion file already exists in the folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name='${filename}' and '${folderId}' in parents and trashed=false`
      )}&fields=files(id)&spaces=drive`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    const searchData = await searchRes.json();
    const existingId = searchData.files?.[0]?.id;

    if (existingId) {
      // Update existing companion file
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': mimeType,
        },
        body: blob,
      });
      return existingId;
    }

    // Create new companion file
    const boundary = 'companion_' + Date.now();
    const metadata = JSON.stringify({
      name: filename,
      mimeType,
      parents: [folderId],
    });

    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      '',
    ].join('\r\n');

    const endPart = `\r\n--${boundary}--`;
    const body = new Blob([metaPart, blob, endPart]);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Companion upload failed: ${err.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    return data.id as string;
  }

  // ── Open ───────────────────────────────────────────────────────────────────

  /**
   * Show the Google Drive Picker for .ncad files.
   * Resolves with { fileId, project } when the user selects a file.
   */
  async openProjectPicker(): Promise<{ fileId: string; project: NetrunCADProject }> {
    await this.initGapi();
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const fileId = await new Promise<string>((resolve, reject) => {
      const view = new window.google.picker.DocsView()
        .setMimeTypes(NCAD_MIME_TYPE)
        .setIncludeFolders(false);

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(this.accessToken!)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setTitle('Open Netrun CAD Project')
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            resolve(data.docs[0].id);
          } else if (data.action === window.google.picker.Action.CANCEL) {
            reject(new Error('Picker cancelled'));
          }
        })
        .build();

      picker.setVisible(true);
    });

    const project = await this.downloadProject(fileId);
    return { fileId, project };
  }

  /** Download and parse a .ncad file by Drive file ID. */
  async downloadProject(fileId: string): Promise<NetrunCADProject> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const text = await response.text();
    return JSON.parse(text) as NetrunCADProject;
  }

  // ── List recent projects ───────────────────────────────────────────────────

  /** List .ncad files in the user's Drive (most recently modified first). */
  async listRecentProjects(maxResults = 20): Promise<DriveFile[]> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const query = `mimeType='${NCAD_MIME_TYPE}' and trashed=false`;
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?` +
        new URLSearchParams({
          q: query,
          orderBy: 'modifiedTime desc',
          pageSize: String(maxResults),
          fields: 'files(id,name,modifiedTime,webViewLink,properties)',
        }),
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Failed to list projects: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.files ?? []).map((f: any) => ({
      id: f.id,
      name: (f.name as string).replace(NCAD_EXTENSION, ''),
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    }));
  }

  // ── Share ──────────────────────────────────────────────────────────────────

  /** Share a file with a collaborator. */
  async shareFile(
    fileId: string,
    email: string,
    role: 'reader' | 'commenter' | 'writer'
  ): Promise<void> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'user',
          role,
          emailAddress: email,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Share failed: ${err.error?.message ?? response.statusText}`);
    }
  }

  /** Get a shareable link for a file (makes it accessible to anyone with the link). */
  async getShareableLink(fileId: string): Promise<string> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    // Grant anyone with the link reader access
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'anyone', role: 'reader' }),
    });

    // Retrieve the web view link
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    return data.webViewLink as string;
  }

  // ── PDF export to Drive ────────────────────────────────────────────────────

  /**
   * Upload a PDF blob to Drive.
   * Places it in the same client folder as the project.
   * Returns the file ID.
   */
  async exportPDFToDrive(pdfBlob: Blob, filename: string, clientName?: string): Promise<string> {
    if (!this.accessToken) throw new Error('Not signed in to Google Drive');

    const folderId = await this.ensureFolder(clientName);
    const boundary = 'pdf_boundary_' + Date.now();
    const metadata = JSON.stringify({
      name: filename.endsWith('.pdf') ? filename : filename + '.pdf',
      mimeType: 'application/pdf',
      parents: [folderId],
    });

    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: application/pdf',
      '',
    ].join('\r\n');

    const endPart = `\r\n--${boundary}--`;
    const body = new Blob([metaPart, pdfBlob, endPart]);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`PDF upload failed: ${err.error?.message ?? response.statusText}`);
    }

    const data = await response.json();
    return data.id as string;
  }
}

// Export a singleton
export const googleDrive = new GoogleDriveService();
