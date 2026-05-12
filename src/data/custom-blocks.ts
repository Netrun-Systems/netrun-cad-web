/**
 * User-defined blocks. Persisted in localStorage under the current
 * browser/device. Cross-device sync is a future Drive integration; for
 * v1, blocks live where they were created.
 *
 * The schema is intentionally a superset of BlockDefinition (`custom`
 * + `createdAt`) so the same render/selection/DXF code paths handle
 * built-in and custom blocks without per-source branching.
 */

import type { BlockDefinition } from './blocks';
import { registerCustomBlockResolver } from './blocks';
import type { CADElement, Point } from '../engine/types';
import { getBoundingBox, moveElement } from '../engine/selection';
import { googleDrive } from '../services/google-drive';

const STORAGE_KEY = 'netrun-cad-custom-blocks';
const STORAGE_VERSION = 1;

export interface CustomBlockDefinition extends BlockDefinition {
  custom: true;
  createdAt: number;
}

interface StorageEnvelope {
  version: number;
  blocks: CustomBlockDefinition[];
}

/* ------------------------------------------------------------------ */
/*  Persistence                                                         */
/* ------------------------------------------------------------------ */

export function loadCustomBlocks(): CustomBlockDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StorageEnvelope;
    if (parsed.version !== STORAGE_VERSION) return [];
    return Array.isArray(parsed.blocks) ? parsed.blocks : [];
  } catch {
    return [];
  }
}

export function saveCustomBlocks(blocks: CustomBlockDefinition[]): void {
  try {
    const envelope: StorageEnvelope = { version: STORAGE_VERSION, blocks };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    // Notify any listeners so the panel can refresh without polling.
    window.dispatchEvent(new CustomEvent('netrun-cad-custom-blocks-changed'));
    // Push to Drive in the background if signed in. Debounced via
    // pendingPush so a flurry of edits (rare for blocks but cheap to
    // protect against) coalesces into a single upload.
    schedulePushToDrive();
  } catch {
    // localStorage can throw on quota exceeded or in private browsing.
    // Failures here aren't fatal — block creation just doesn't persist.
  }
}

/* ------------------------------------------------------------------ */
/*  Drive sync                                                          */
/* ------------------------------------------------------------------ */

let pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePushToDrive(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushCustomBlocksToDrive().catch(() => {
      // Silent — Drive isn't required, localStorage is the source of truth
    });
  }, 1500);
}

/**
 * Push the current local custom-block set to Drive. No-op if not signed
 * in. Caller doesn't await — fire-and-forget; failures are silent.
 */
export async function pushCustomBlocksToDrive(): Promise<void> {
  if (!googleDrive.isSignedIn()) return;
  const blocks = loadCustomBlocks();
  const envelope: StorageEnvelope = { version: STORAGE_VERSION, blocks };
  await googleDrive.saveCustomBlocks(JSON.stringify(envelope));
}

/**
 * Pull the Drive custom-block set and merge with local. Last-write-wins
 * by createdAt for id collisions; new blocks from either side are kept.
 * Called once on Drive sign-in; safe to call again any time. Returns
 * the number of blocks added or updated locally.
 */
export async function pullCustomBlocksFromDrive(): Promise<number> {
  if (!googleDrive.isSignedIn()) return 0;
  const remoteText = await googleDrive.loadCustomBlocks();
  if (!remoteText) return 0; // first-time sign-in on this device, no remote yet
  let remoteBlocks: CustomBlockDefinition[];
  try {
    const parsed = JSON.parse(remoteText) as StorageEnvelope;
    if (parsed.version !== STORAGE_VERSION) return 0;
    remoteBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  } catch {
    return 0;
  }
  const local = loadCustomBlocks();
  const localById = new Map(local.map((b) => [b.id, b]));
  let changedCount = 0;
  for (const remote of remoteBlocks) {
    const existing = localById.get(remote.id);
    if (!existing) {
      localById.set(remote.id, remote);
      changedCount++;
    } else if (remote.createdAt > existing.createdAt) {
      localById.set(remote.id, remote);
      changedCount++;
    }
  }
  if (changedCount > 0) {
    // Save merged set, but skip the Drive push in saveCustomBlocks to
    // avoid an immediate re-upload of what we just downloaded.
    const merged = Array.from(localById.values());
    const envelope: StorageEnvelope = { version: STORAGE_VERSION, blocks: merged };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      window.dispatchEvent(new CustomEvent('netrun-cad-custom-blocks-changed'));
    } catch {
      // ignore
    }
  }
  return changedCount;
}

export function addCustomBlock(definition: CustomBlockDefinition): void {
  const existing = loadCustomBlocks();
  saveCustomBlocks([...existing, definition]);
}

export function deleteCustomBlock(blockId: string): void {
  const existing = loadCustomBlocks();
  saveCustomBlocks(existing.filter((b) => b.id !== blockId));
}

// Register with the BlockDefinition lookup so getBlock() searches both
// catalogs. Module-load side effect — runs once per page load.
registerCustomBlockResolver((blockId) => loadCustomBlocks().find((b) => b.id === blockId));

/* ------------------------------------------------------------------ */
/*  Block creation from selection                                       */
/* ------------------------------------------------------------------ */

export interface MakeBlockOptions {
  name: string;
  category: BlockDefinition['category'];
  description?: string;
}

export interface MakeBlockResult {
  definition: CustomBlockDefinition;
  /** The bbox center of the original selection — where the block instance
   *  should be placed if the caller wants to replace the selection with
   *  a single instance reference. */
  insertionPoint: Point;
}

/**
 * Build a CustomBlockDefinition from the user's selected elements.
 * The block's local origin (0,0) is the bbox center of the selection;
 * each element's coordinates get translated relative to that origin so
 * the block can be re-inserted anywhere on the canvas.
 *
 * Block elements that don't have a clean translation (text, plant, block-
 * inside-block) are silently dropped — most landscape blocks the user
 * builds will be made of lines, rectangles, circles, and polylines, all
 * of which moveElement handles cleanly.
 */
export function makeBlockFromSelection(
  elements: CADElement[],
  options: MakeBlockOptions,
): MakeBlockResult {
  if (elements.length === 0) {
    throw new Error('Cannot make a block from an empty selection');
  }

  // Bounding box of the whole selection — center becomes the insertion point
  const bboxes = elements.map(getBoundingBox);
  const minX = Math.min(...bboxes.map((b) => b.x));
  const minY = Math.min(...bboxes.map((b) => b.y));
  const maxX = Math.max(...bboxes.map((b) => b.x + b.width));
  const maxY = Math.max(...bboxes.map((b) => b.y + b.height));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const translated: CADElement[] = elements
    .filter((el) => el.type !== 'block') // no nested blocks in v1
    .map((el, i) => {
      const moved = moveElement(el, -cx, -cy);
      return {
        ...moved,
        // Re-id within the block's local id space; layer goes to 'block'
        // so the block render path (which ignores layer visibility and uses
        // the child's strokeColor directly) handles it consistently.
        id: `${'block-elem'}-${i}`,
        layerId: 'block',
      } as CADElement;
    });

  const id = `custom-${Date.now()}`;
  const definition: CustomBlockDefinition = {
    id,
    name: options.name,
    category: options.category,
    description: options.description,
    custom: true,
    createdAt: Date.now(),
    elements: translated,
    bbox: { width: maxX - minX, height: maxY - minY },
  };

  return { definition, insertionPoint: { x: cx, y: cy } };
}
