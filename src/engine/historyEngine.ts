import type {
  FrameHistoryState,
  HistoryCategory,
  HistoryDiffEntry,
  HistoryLayerPatch,
  Layer,
  LayerDiffItem,
  ProjectSettings,
  ProjectVersion,
  RecoveryTarget,
  VersionDiffSummary,
} from '../types';

const DB_NAME = 'sqmotion_history_v1';
const DB_VERSION = 1;
const STORE_MEDIA = 'media_pool';
const STORE_VERSIONS = 'project_versions';
const MAX_UNDO_STEPS = 250;
const MAX_UNPINNED_VERSIONS_DEFAULT = 25;

// ============================================================================
// DEDUPLICATED MEDIA POOL (Prevents duplicating large data: URLs in snapshots)
// ============================================================================

const memoryMediaPool = new Map<string, string>();

function fastContentHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `m_${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}_${input.length.toString(36)}`;
}

function openHistoryDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'hash' });
        }
        if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
          const store = db.createObjectStore(STORE_VERSIONS, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function putMediaToDB(hash: string, data: string): Promise<void> {
  memoryMediaPool.set(hash, data);
  const db = await openHistoryDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).put({ hash, data, updatedAt: Date.now() });
  } catch {
    // Ignore quota errors gracefully
  }
}

async function getMediaFromDB(hash: string): Promise<string | undefined> {
  if (memoryMediaPool.has(hash)) return memoryMediaPool.get(hash);
  const db = await openHistoryDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const req = tx.objectStore(STORE_MEDIA).get(hash);
      req.onsuccess = () => {
        const val = (req.result as { data?: string } | undefined)?.data;
        if (val) memoryMediaPool.set(hash, val);
        resolve(val);
      };
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export function dehydrateState(state: FrameHistoryState): {
  dehydrated: FrameHistoryState;
  mediaHashes: string[];
} {
  const mediaHashes: string[] = [];
  const clonedLayers: Layer[] = JSON.parse(JSON.stringify(state.layers));
  const clonedSettings: ProjectSettings = JSON.parse(JSON.stringify(state.settings));

  const stashUrl = (url: string | undefined): string | undefined => {
    if (!url || url.length < 256) return url;
    const hash = fastContentHash(url);
    if (!mediaHashes.includes(hash)) mediaHashes.push(hash);
    if (!memoryMediaPool.has(hash)) {
      void putMediaToDB(hash, url);
    }
    return `__sq_ref__:${hash}`;
  };

  for (const layer of clonedLayers) {
    if (layer.mediaUrl) {
      layer.mediaUrl = stashUrl(layer.mediaUrl);
    }
    if (layer.audioConfig?.src) {
      layer.audioConfig.src = stashUrl(layer.audioConfig.src);
    }
    if (layer.model3dConfig?.modelUrl) {
      layer.model3dConfig.modelUrl = stashUrl(layer.model3dConfig.modelUrl);
    }
  }

  return {
    dehydrated: { layers: clonedLayers, settings: clonedSettings },
    mediaHashes,
  };
}

export async function rehydrateState(dehydrated: FrameHistoryState): Promise<FrameHistoryState> {
  const clonedLayers: Layer[] = JSON.parse(JSON.stringify(dehydrated.layers));
  const clonedSettings: ProjectSettings = JSON.parse(JSON.stringify(dehydrated.settings));

  const restoreUrl = async (val: string | undefined): Promise<string | undefined> => {
    if (!val || !val.startsWith('__sq_ref__:')) return val;
    const hash = val.slice('__sq_ref__:'.length);
    return (await getMediaFromDB(hash)) || '';
  };

  for (const layer of clonedLayers) {
    if (layer.mediaUrl) layer.mediaUrl = await restoreUrl(layer.mediaUrl);
    if (layer.audioConfig?.src) layer.audioConfig.src = await restoreUrl(layer.audioConfig.src);
    if (layer.model3dConfig?.modelUrl) {
      layer.model3dConfig.modelUrl = await restoreUrl(layer.model3dConfig.modelUrl);
    }
  }

  return { layers: clonedLayers, settings: clonedSettings };
}

export function rehydrateStateSync(dehydrated: FrameHistoryState): FrameHistoryState {
  const clonedLayers: Layer[] = JSON.parse(JSON.stringify(dehydrated.layers));
  const clonedSettings: ProjectSettings = JSON.parse(JSON.stringify(dehydrated.settings));

  const restoreSync = (val: string | undefined): string | undefined => {
    if (!val || !val.startsWith('__sq_ref__:')) return val;
    const hash = val.slice('__sq_ref__:'.length);
    return memoryMediaPool.get(hash) ?? val;
  };

  for (const layer of clonedLayers) {
    if (layer.mediaUrl) layer.mediaUrl = restoreSync(layer.mediaUrl);
    if (layer.audioConfig?.src) layer.audioConfig.src = restoreSync(layer.audioConfig.src);
    if (layer.model3dConfig?.modelUrl) {
      layer.model3dConfig.modelUrl = restoreSync(layer.model3dConfig.modelUrl);
    }
  }

  return { layers: clonedLayers, settings: clonedSettings };
}

// ============================================================================
// INCREMENTAL PROJECT DIFFING & PATCH APPLICATION
// ============================================================================

const LAYER_KEYS: Array<keyof Layer> = [
  'name',
  'type',
  'visible',
  'locked',
  'color',
  'startFrame',
  'durationFrames',
  'parentId',
  'groupId',
  'groupConfig',
  'mask',
  'blendMode',
  'transform',
  'cameraConfig',
  'mesh3dConfig',
  'model3dConfig',
  'vectorConfig',
  'textConfig',
  'particleConfig',
  'audioConfig',
  'solidColor',
  'mediaUrl',
  'mediaAspect',
  'effects',
  'timeScale',
  'appearanceExtras',
  'is3D',
  'fixedIn3D',
  'billboard',
];

function deepEqualJSON(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function inferHistoryCategory(
  prev: FrameHistoryState,
  next: FrameHistoryState
): { category: HistoryCategory; labelEn: string; labelAr: string; layerId?: string; layerName?: string } {
  const prevMap = new Map(prev.layers.map((l) => [l.id, l]));
  const nextMap = new Map(next.layers.map((l) => [l.id, l]));

  if (!deepEqualJSON(prev.settings, next.settings)) {
    return { category: 'settings', labelEn: 'Update Project Settings', labelAr: 'تعديل إعدادات المشروع' };
  }

  for (const l of next.layers) {
    if (!prevMap.has(l.id)) {
      if (l.type === 'group') {
        return { category: 'group', labelEn: `Create Group "${l.name}"`, labelAr: `إنشاء مجموعة "${l.name}"`, layerId: l.id, layerName: l.name };
      }
      return { category: 'layer', labelEn: `Add ${l.type} "${l.name}"`, labelAr: `إضافة طبقة "${l.name}"`, layerId: l.id, layerName: l.name };
    }
  }

  for (const l of prev.layers) {
    if (!nextMap.has(l.id)) {
      if (l.type === 'group') {
        return { category: 'group', labelEn: `Delete Group "${l.name}"`, labelAr: `حذف مجموعة "${l.name}"`, layerId: l.id, layerName: l.name };
      }
      return { category: 'layer', labelEn: `Delete "${l.name}"`, labelAr: `حذف طبقة "${l.name}"`, layerId: l.id, layerName: l.name };
    }
  }

  const prevOrder = prev.layers.map((l) => l.id);
  const nextOrder = next.layers.map((l) => l.id);
  if (!deepEqualJSON(prevOrder, nextOrder)) {
    return { category: 'order', labelEn: 'Reorder Layers', labelAr: 'تغيير ترتيب الطبقات' };
  }

  for (const nextL of next.layers) {
    const prevL = prevMap.get(nextL.id);
    if (!prevL) continue;
    if (!deepEqualJSON(prevL, nextL)) {
      if (!deepEqualJSON(prevL.effects, nextL.effects)) {
        return { category: 'effect', labelEn: `Edit Effects on "${nextL.name}"`, labelAr: `تعديل تأثيرات "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      if (!deepEqualJSON(prevL.mask, nextL.mask)) {
        return { category: 'mask', labelEn: `Edit Mask on "${nextL.name}"`, labelAr: `تعديل القناع لـ "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      if (!deepEqualJSON(prevL.textConfig, nextL.textConfig)) {
        return { category: 'text', labelEn: `Edit Text "${nextL.name}"`, labelAr: `تعديل النص "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      if (!deepEqualJSON(prevL.audioConfig, nextL.audioConfig)) {
        return { category: 'audio', labelEn: `Edit Audio "${nextL.name}"`, labelAr: `تعديل الصوت "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      if (!deepEqualJSON(prevL.cameraConfig, nextL.cameraConfig)) {
        return { category: 'camera', labelEn: `Edit Camera "${nextL.name}"`, labelAr: `تعديل الكاميرا "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      if (!deepEqualJSON(prevL.groupConfig, nextL.groupConfig) || prevL.groupId !== nextL.groupId) {
        return { category: 'group', labelEn: `Update Group "${nextL.name}"`, labelAr: `تعديل المجموعة "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      // Check keyframe count changes
      const countKf = (l: Layer) =>
        l.transform.position.keyframes.length +
        l.transform.scale.keyframes.length +
        l.transform.rotation.keyframes.length +
        l.transform.opacity.keyframes.length +
        l.transform.anchorPoint.keyframes.length;
      if (countKf(prevL) !== countKf(nextL)) {
        return { category: 'keyframe', labelEn: `Edit Keyframes "${nextL.name}"`, labelAr: `تعديل الإطارات المفتاحية "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
      }
      return { category: 'property', labelEn: `Edit "${nextL.name}"`, labelAr: `تعديل "${nextL.name}"`, layerId: nextL.id, layerName: nextL.name };
    }
  }

  return { category: 'property', labelEn: 'Edit Project', labelAr: 'تعديل المشروع' };
}

export function createIncrementalDiff(
  prevRaw: FrameHistoryState,
  nextRaw: FrameHistoryState,
  meta?: Partial<Pick<HistoryDiffEntry, 'category' | 'labelEn' | 'labelAr' | 'batchKey' | 'layerId' | 'layerName'>>
): HistoryDiffEntry | null {
  const { dehydrated: prev } = dehydrateState(prevRaw);
  const { dehydrated: next } = dehydrateState(nextRaw);

  const prevMap = new Map(prev.layers.map((l, idx) => [l.id, { layer: l, idx }]));
  const nextMap = new Map(next.layers.map((l, idx) => [l.id, { layer: l, idx }]));

  const layerPatches: HistoryLayerPatch[] = [];

  for (const [id, { layer: prevL, idx: prevIdx }] of prevMap.entries()) {
    const nextEntry = nextMap.get(id);
    if (!nextEntry) {
      layerPatches.push({
        op: 'remove',
        layerId: id,
        prevIndex: prevIdx,
        before: prevL as unknown as Record<string, unknown>,
      });
    } else {
      const beforeObj: Record<string, unknown> = {};
      const afterObj: Record<string, unknown> = {};
      let changed = false;
      for (const k of LAYER_KEYS) {
        const va = prevL[k];
        const vb = nextEntry.layer[k];
        if (!deepEqualJSON(va, vb)) {
          beforeObj[k] = va;
          afterObj[k] = vb;
          changed = true;
        }
      }
      if (changed) {
        layerPatches.push({
          op: 'update',
          layerId: id,
          before: beforeObj,
          after: afterObj,
        });
      }
    }
  }

  for (const [id, { layer: nextL, idx: nextIdx }] of nextMap.entries()) {
    if (!prevMap.has(id)) {
      layerPatches.push({
        op: 'add',
        layerId: id,
        index: nextIdx,
        after: nextL as unknown as Record<string, unknown>,
      });
    }
  }

  const prevOrder = prev.layers.map((l) => l.id);
  const nextOrder = next.layers.map((l) => l.id);
  const orderChanged = !deepEqualJSON(prevOrder, nextOrder);

  const settingsBefore: Partial<ProjectSettings> = {};
  const settingsAfter: Partial<ProjectSettings> = {};
  let settingsChanged = false;
  (Object.keys(next.settings) as Array<keyof ProjectSettings>).forEach((k) => {
    if (!deepEqualJSON(prev.settings[k], next.settings[k])) {
      (settingsBefore as Record<string, unknown>)[k] = prev.settings[k];
      (settingsAfter as Record<string, unknown>)[k] = next.settings[k];
      settingsChanged = true;
    }
  });

  if (layerPatches.length === 0 && !orderChanged && !settingsChanged) {
    return null;
  }

  const inferred = inferHistoryCategory(prev, next);
  return {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    category: meta?.category || inferred.category,
    labelEn: meta?.labelEn || inferred.labelEn,
    labelAr: meta?.labelAr || inferred.labelAr,
    layerId: meta?.layerId || inferred.layerId,
    layerName: meta?.layerName || inferred.layerName,
    batchKey: meta?.batchKey,
    layerPatches,
    layerOrderBefore: orderChanged ? prevOrder : undefined,
    layerOrderAfter: orderChanged ? nextOrder : undefined,
    settingsBefore: settingsChanged ? settingsBefore : undefined,
    settingsAfter: settingsChanged ? settingsAfter : undefined,
  };
}

export function applyHistoryDiff(
  currentRaw: FrameHistoryState,
  entry: HistoryDiffEntry,
  direction: 'undo' | 'redo'
): FrameHistoryState {
  const { dehydrated: state } = dehydrateState(currentRaw);
  const layerMap = new Map(state.layers.map((l) => [l.id, l]));

  if (direction === 'undo') {
    for (const p of entry.layerPatches) {
      if (p.op === 'add') {
        layerMap.delete(p.layerId);
      } else if (p.op === 'remove' && p.before) {
        layerMap.set(p.layerId, JSON.parse(JSON.stringify(p.before)) as Layer);
      } else if (p.op === 'update' && p.before) {
        const existing = layerMap.get(p.layerId);
        if (existing) {
          const updated = { ...existing } as Record<string, unknown>;
          for (const [k, v] of Object.entries(p.before)) {
            if (v === undefined) delete updated[k];
            else updated[k] = JSON.parse(JSON.stringify(v));
          }
          layerMap.set(p.layerId, updated as unknown as Layer);
        }
      }
    }

    let orderedLayers: Layer[];
    if (entry.layerOrderBefore) {
      orderedLayers = entry.layerOrderBefore
        .map((id) => layerMap.get(id))
        .filter((l): l is Layer => Boolean(l));
    } else {
      orderedLayers = Array.from(layerMap.values());
    }

    const nextSettings = entry.settingsBefore
      ? { ...state.settings, ...entry.settingsBefore }
      : state.settings;

    return rehydrateStateSync({ layers: orderedLayers, settings: nextSettings });
  } else {
    for (const p of entry.layerPatches) {
      if (p.op === 'add' && p.after) {
        layerMap.set(p.layerId, JSON.parse(JSON.stringify(p.after)) as Layer);
      } else if (p.op === 'remove') {
        layerMap.delete(p.layerId);
      } else if (p.op === 'update' && p.after) {
        const existing = layerMap.get(p.layerId);
        if (existing) {
          const updated = { ...existing } as Record<string, unknown>;
          for (const [k, v] of Object.entries(p.after)) {
            if (v === undefined) delete updated[k];
            else updated[k] = JSON.parse(JSON.stringify(v));
          }
          layerMap.set(p.layerId, updated as unknown as Layer);
        }
      }
    }

    let orderedLayers: Layer[];
    if (entry.layerOrderAfter) {
      orderedLayers = entry.layerOrderAfter
        .map((id) => layerMap.get(id))
        .filter((l): l is Layer => Boolean(l));
    } else {
      orderedLayers = Array.from(layerMap.values());
    }

    const nextSettings = entry.settingsAfter
      ? { ...state.settings, ...entry.settingsAfter }
      : state.settings;

    return rehydrateStateSync({ layers: orderedLayers, settings: nextSettings });
  }
}

export class ProjectUndoStack {
  public entries: HistoryDiffEntry[] = [];
  public cursor = -1; // index of the last applied diff; -1 means at base state
  private activeBatchKey: string | null = null;
  private maxSteps = MAX_UNDO_STEPS;

  public push(prev: FrameHistoryState, next: FrameHistoryState, meta?: Partial<HistoryDiffEntry>): boolean {
    const diff = createIncrementalDiff(prev, next, meta);
    if (!diff) return false;

    // Discard any future redo entries
    if (this.cursor < this.entries.length - 1) {
      this.entries = this.entries.slice(0, this.cursor + 1);
    }

    // Coalesce rapid edits sharing the same batchKey within 1200ms
    const last = this.entries[this.cursor];
    const effectiveBatch = meta?.batchKey || this.activeBatchKey;
    if (
      last &&
      effectiveBatch &&
      last.batchKey === effectiveBatch &&
      diff.timestamp - last.timestamp < 1200 &&
      last.layerPatches.length === 1 &&
      diff.layerPatches.length === 1 &&
      last.layerPatches[0].op === 'update' &&
      diff.layerPatches[0].op === 'update' &&
      last.layerPatches[0].layerId === diff.layerPatches[0].layerId
    ) {
      // Merge: keep original `before`, update `after`
      const mergedBefore = { ...last.layerPatches[0].before };
      for (const [k, v] of Object.entries(diff.layerPatches[0].before || {})) {
        if (!(k in mergedBefore)) mergedBefore[k] = v;
      }
      last.layerPatches[0].before = mergedBefore;
      last.layerPatches[0].after = { ...last.layerPatches[0].after, ...diff.layerPatches[0].after };
      last.timestamp = diff.timestamp;
      return true;
    }

    if (effectiveBatch) diff.batchKey = effectiveBatch;
    this.entries.push(diff);
    if (this.entries.length > this.maxSteps) {
      const trim = this.entries.length - this.maxSteps;
      this.entries = this.entries.slice(trim);
    }
    this.cursor = this.entries.length - 1;
    return true;
  }

  public beginBatch(key: string) {
    this.activeBatchKey = key;
  }

  public endBatch() {
    this.activeBatchKey = null;
  }

  public canUndo(): boolean {
    return this.cursor >= 0;
  }

  public canRedo(): boolean {
    return this.cursor < this.entries.length - 1;
  }

  public undo(current: FrameHistoryState): { nextState: FrameHistoryState; entry: HistoryDiffEntry } | null {
    if (!this.canUndo()) return null;
    const entry = this.entries[this.cursor];
    const nextState = applyHistoryDiff(current, entry, 'undo');
    this.cursor--;
    return { nextState, entry };
  }

  public redo(current: FrameHistoryState): { nextState: FrameHistoryState; entry: HistoryDiffEntry } | null {
    if (!this.canRedo()) return null;
    this.cursor++;
    const entry = this.entries[this.cursor];
    const nextState = applyHistoryDiff(current, entry, 'redo');
    return { nextState, entry };
  }

  public jumpToCursor(current: FrameHistoryState, targetCursor: number): FrameHistoryState {
    let state = current;
    const clamped = Math.max(-1, Math.min(this.entries.length - 1, targetCursor));
    while (this.cursor > clamped) {
      const res = this.undo(state);
      if (!res) break;
      state = res.nextState;
    }
    while (this.cursor < clamped) {
      const res = this.redo(state);
      if (!res) break;
      state = res.nextState;
    }
    return state;
  }

  public reset() {
    this.entries = [];
    this.cursor = -1;
    this.activeBatchKey = null;
  }
}

// ============================================================================
// VERSION MANAGEMENT (IndexedDB + LocalStorage fallback)
// ============================================================================

const LS_VERSIONS_PREFIX = 'sqmotion_versions_v1_';

async function loadVersionsRaw(projectId: string): Promise<ProjectVersion[]> {
  const db = await openHistoryDB();
  if (db) {
    try {
      const list = await new Promise<ProjectVersion[]>((resolve) => {
        const tx = db.transaction(STORE_VERSIONS, 'readonly');
        const idx = tx.objectStore(STORE_VERSIONS).index('projectId');
        const req = idx.getAll(projectId);
        req.onsuccess = () => resolve((req.result as ProjectVersion[]) || []);
        req.onerror = () => resolve([]);
      });
      return list.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      // Fallback below
    }
  }
  try {
    const raw = localStorage.getItem(`${LS_VERSIONS_PREFIX}${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectVersion[];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

async function saveVersionRecord(version: ProjectVersion): Promise<void> {
  const db = await openHistoryDB();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_VERSIONS, 'readwrite');
        tx.objectStore(STORE_VERSIONS).put(version);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    } catch {
      // Fallback below
    }
  }
  try {
    const existing = await loadVersionsRaw(version.projectId);
    const updated = [version, ...existing.filter((v) => v.id !== version.id)];
    localStorage.setItem(`${LS_VERSIONS_PREFIX}${version.projectId}`, JSON.stringify(updated.slice(0, 20)));
  } catch {
    // Ignore storage quota overflow
  }
}

export async function listProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  return loadVersionsRaw(projectId);
}

export async function createProjectVersion(params: {
  projectId: string;
  state: FrameHistoryState;
  name: string;
  description?: string;
  isAuto?: boolean;
  pinned?: boolean;
  maxUnpinned?: number;
}): Promise<ProjectVersion> {
  const { dehydrated, mediaHashes } = dehydrateState(params.state);
  const serialized = JSON.stringify(dehydrated);
  const version: ProjectVersion = {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId: params.projectId,
    name: params.name,
    description: params.description || '',
    createdAt: Date.now(),
    isAuto: Boolean(params.isAuto),
    pinned: Boolean(params.pinned),
    layerCount: dehydrated.layers.length,
    durationFrames: dehydrated.settings.durationFrames,
    byteSize: serialized.length,
    dehydratedState: dehydrated,
    mediaHashes,
  };

  await saveVersionRecord(version);
  await pruneUnpinnedVersions(params.projectId, params.maxUnpinned ?? MAX_UNPINNED_VERSIONS_DEFAULT);
  return version;
}

export async function updateProjectVersionMeta(
  projectId: string,
  versionId: string,
  patch: Partial<Pick<ProjectVersion, 'name' | 'description' | 'pinned'>>
): Promise<ProjectVersion[]> {
  const all = await loadVersionsRaw(projectId);
  const target = all.find((v) => v.id === versionId);
  if (target) {
    const updated = { ...target, ...patch };
    await saveVersionRecord(updated);
  }
  return loadVersionsRaw(projectId);
}

export async function deleteProjectVersion(projectId: string, versionId: string): Promise<ProjectVersion[]> {
  const db = await openHistoryDB();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_VERSIONS, 'readwrite');
        tx.objectStore(STORE_VERSIONS).delete(versionId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  }
  try {
    const raw = localStorage.getItem(`${LS_VERSIONS_PREFIX}${projectId}`);
    if (raw) {
      const parsed = (JSON.parse(raw) as ProjectVersion[]).filter((v) => v.id !== versionId);
      localStorage.setItem(`${LS_VERSIONS_PREFIX}${projectId}`, JSON.stringify(parsed));
    }
  } catch {
    // Ignore
  }
  return loadVersionsRaw(projectId);
}

export async function pruneUnpinnedVersions(projectId: string, maxUnpinned: number): Promise<void> {
  const all = await loadVersionsRaw(projectId);
  const unpinned = all.filter((v) => !v.pinned);
  if (unpinned.length <= maxUnpinned) return;
  const toDelete = unpinned.slice(maxUnpinned);
  for (const v of toDelete) {
    await deleteProjectVersion(projectId, v.id);
  }
}

export function getVersionStorageStats(versions: ProjectVersion[]) {
  let totalBytes = 0;
  const uniqueHashes = new Set<string>();
  let pinnedCount = 0;
  let autoCount = 0;
  for (const v of versions) {
    totalBytes += v.byteSize;
    if (v.pinned) pinnedCount++;
    if (v.isAuto) autoCount++;
    for (const h of v.mediaHashes) uniqueHashes.add(h);
  }
  return {
    versionCount: versions.length,
    pinnedCount,
    autoCount,
    totalBytes,
    dedupedMediaCount: uniqueHashes.size,
  };
}

// ============================================================================
// VERSION COMPARISON (Side-by-side & Diff Detector)
// ============================================================================

export function compareProjectStates(
  oldState: FrameHistoryState,
  newState: FrameHistoryState,
  oldLabel = 'Older',
  newLabel = 'Current'
): VersionDiffSummary {
  const oldMap = new Map(oldState.layers.map((l, idx) => [l.id, { layer: l, idx }]));
  const newMap = new Map(newState.layers.map((l, idx) => [l.id, { layer: l, idx }]));

  const layerDiffs: LayerDiffItem[] = [];
  let addedLayers = 0;
  let removedLayers = 0;
  let modifiedLayers = 0;
  let reorderedLayers = 0;

  const countKf = (l: Layer) =>
    l.transform.position.keyframes.length +
    l.transform.scale.keyframes.length +
    l.transform.rotation.keyframes.length +
    l.transform.opacity.keyframes.length +
    l.transform.anchorPoint.keyframes.length;

  for (const [id, { layer: nl, idx: newIdx }] of newMap.entries()) {
    const oldEntry = oldMap.get(id);
    if (!oldEntry) {
      addedLayers++;
      layerDiffs.push({
        layerId: id,
        layerName: nl.name,
        layerType: nl.type,
        status: 'added',
        changedPaths: ['created'],
        keyframeChanges: countKf(nl),
        effectChanges: nl.effects.length,
      });
      continue;
    }

    const ol = oldEntry.layer;
    const changedPaths: string[] = [];
    if (ol.name !== nl.name) changedPaths.push('name');
    if (ol.visible !== nl.visible) changedPaths.push('visible');
    if (ol.locked !== nl.locked) changedPaths.push('locked');
    if (ol.startFrame !== nl.startFrame || ol.durationFrames !== nl.durationFrames) changedPaths.push('timing');
    if (ol.blendMode !== nl.blendMode) changedPaths.push('blendMode');
    if (ol.groupId !== nl.groupId) changedPaths.push('group');
    if (!deepEqualJSON(ol.transform, nl.transform)) changedPaths.push('transform');
    if (!deepEqualJSON(ol.effects, nl.effects)) changedPaths.push('effects');
    if (!deepEqualJSON(ol.mask, nl.mask)) changedPaths.push('mask');
    if (!deepEqualJSON(ol.textConfig, nl.textConfig)) changedPaths.push('text');
    if (!deepEqualJSON(ol.vectorConfig, nl.vectorConfig)) changedPaths.push('vector');
    if (!deepEqualJSON(ol.audioConfig, nl.audioConfig)) changedPaths.push('audio');
    if (!deepEqualJSON(ol.cameraConfig, nl.cameraConfig)) changedPaths.push('camera');
    if (!deepEqualJSON(ol.mesh3dConfig, nl.mesh3dConfig)) changedPaths.push('3dMesh');

    const kfChanges = Math.abs(countKf(nl) - countKf(ol));
    const fxChanges = Math.abs(nl.effects.length - ol.effects.length) +
      (changedPaths.includes('effects') && nl.effects.length === ol.effects.length ? 1 : 0);

    if (changedPaths.length > 0) {
      modifiedLayers++;
      layerDiffs.push({
        layerId: id,
        layerName: nl.name,
        layerType: nl.type,
        status: 'modified',
        changedPaths,
        keyframeChanges: kfChanges,
        effectChanges: fxChanges,
      });
    } else if (oldEntry.idx !== newIdx) {
      reorderedLayers++;
      layerDiffs.push({
        layerId: id,
        layerName: nl.name,
        layerType: nl.type,
        status: 'reordered',
        changedPaths: [`order: ${oldEntry.idx + 1} -> ${newIdx + 1}`],
        keyframeChanges: 0,
        effectChanges: 0,
      });
    }
  }

  for (const [id, { layer: ol }] of oldMap.entries()) {
    if (!newMap.has(id)) {
      removedLayers++;
      layerDiffs.push({
        layerId: id,
        layerName: ol.name,
        layerType: ol.type,
        status: 'removed',
        changedPaths: ['removed'],
        keyframeChanges: countKf(ol),
        effectChanges: ol.effects.length,
      });
    }
  }

  const settingsChanges: Array<{ key: string; before: unknown; after: unknown }> = [];
  (Object.keys(newState.settings) as Array<keyof ProjectSettings>).forEach((k) => {
    if (!deepEqualJSON(oldState.settings[k], newState.settings[k])) {
      settingsChanges.push({
        key: String(k),
        before: oldState.settings[k],
        after: newState.settings[k],
      });
    }
  });

  return {
    oldVersionLabel: oldLabel,
    newVersionLabel: newLabel,
    addedLayers,
    removedLayers,
    modifiedLayers,
    reorderedLayers,
    settingsChanges,
    layerDiffs,
  };
}

// ============================================================================
// GRANULAR RECOVERY (Full Project, Layer, Effect, Specific Properties)
// ============================================================================

export async function applyVersionRecovery(
  currentState: FrameHistoryState,
  sourceVersion: ProjectVersion,
  target: RecoveryTarget
): Promise<FrameHistoryState> {
  const recovered = await rehydrateState(sourceVersion.dehydratedState);

  if (target.scope === 'project') {
    return recovered;
  }

  const sourceLayer = recovered.layers.find((l) => l.id === target.layerId);
  if (!sourceLayer) return currentState;

  if (target.scope === 'layer') {
    const exists = currentState.layers.some((l) => l.id === target.layerId);
    const nextLayers = exists
      ? currentState.layers.map((l) => (l.id === target.layerId ? JSON.parse(JSON.stringify(sourceLayer)) : l))
      : [JSON.parse(JSON.stringify(sourceLayer)), ...currentState.layers];
    return { ...currentState, layers: nextLayers };
  }

  if (target.scope === 'effect') {
    const sourceFx = sourceLayer.effects.find((fx) => fx.id === target.effectId);
    if (!sourceFx) return currentState;
    const nextLayers = currentState.layers.map((l) => {
      if (l.id !== target.layerId) return l;
      const clonedFx = JSON.parse(JSON.stringify(sourceFx));
      const exists = l.effects.some((fx) => fx.id === clonedFx.id);
      return {
        ...l,
        effects: exists
          ? l.effects.map((fx) => (fx.id === clonedFx.id ? clonedFx : fx))
          : [...l.effects, clonedFx],
      };
    });
    return { ...currentState, layers: nextLayers };
  }

  if (target.scope === 'properties') {
    const nextLayers = currentState.layers.map((l) => {
      if (l.id !== target.layerId) return l;
      const updated = { ...l };
      for (const pathKey of target.paths) {
        if (sourceLayer[pathKey] !== undefined) {
          (updated as Record<string, unknown>)[pathKey] = JSON.parse(JSON.stringify(sourceLayer[pathKey]));
        }
      }
      return updated;
    });
    return { ...currentState, layers: nextLayers };
  }

  return currentState;
}
