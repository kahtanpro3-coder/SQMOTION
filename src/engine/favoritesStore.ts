import type {
  FavoriteFolder,
  FavoriteItem,
  FavoriteItemType,
  FavoritesState,
  LayerType,
} from '../types';

const STORAGE_KEY = 'sqmotion_favorites_v1';

const DEFAULT_FOLDERS: FavoriteFolder[] = [
  { id: 'all', name: 'Pinned & Core', nameAr: 'المثبتة والأساسية', color: '#FF4D6D', order: 0 },
  { id: 'fx', name: 'Effects & Looks', nameAr: 'التأثيرات والمظهر', color: '#8B5CF6', order: 1 },
  { id: 'motion', name: 'Motion & Curves', nameAr: 'الحركة والمنحنيات', color: '#3B82F6', order: 2 },
  { id: 'design', name: 'Fonts, Colors & Shapes', nameAr: 'الخطوط والألوان والأشكال', color: '#10B981', order: 3 },
];

const SEED_ITEMS: FavoriteItem[] = [
  {
    id: 'fav_seed_glow',
    refId: 'glow',
    type: 'effect',
    title: 'Cinema Glow',
    titleAr: 'توهج سينمائي',
    subtitle: 'Soft bloom & highlights',
    folderId: 'fx',
    pinned: true,
    order: 0,
    addedAt: Date.now() - 500000,
    useCount: 4,
    previewColor: '#F59E0B',
    compatibleLayerTypes: ['vector', 'text', 'image', 'video', 'solid', 'group'],
    payload: { effectType: 'glow', params: { radius: 22, intensity: 1.4, color: '#ffffff' } },
  },
  {
    id: 'fav_seed_blur',
    refId: 'blur',
    type: 'effect',
    title: 'Gaussian Blur',
    titleAr: 'ضبابية غاوسية',
    subtitle: 'Smooth depth blur',
    folderId: 'fx',
    pinned: false,
    order: 1,
    addedAt: Date.now() - 400000,
    useCount: 3,
    previewColor: '#3B82F6',
    compatibleLayerTypes: ['vector', 'text', 'image', 'video', 'solid', 'group'],
    payload: { effectType: 'blur', params: { radius: 14 } },
  },
  {
    id: 'fav_seed_pop',
    refId: 'pop_in',
    type: 'preset',
    title: 'Smooth Pop In',
    titleAr: 'ظهور مرن سريع',
    subtitle: 'Scale + opacity bounce',
    folderId: 'motion',
    pinned: true,
    order: 2,
    addedAt: Date.now() - 300000,
    useCount: 5,
    previewColor: '#FF4D6D',
    compatibleLayerTypes: ['vector', 'text', 'image', 'video', 'solid', 'group', 'model3d'],
    payload: { presetId: 'pop_in' },
  },
  {
    id: 'fav_seed_easing_snappy',
    refId: 'bezier_snappy',
    type: 'easing',
    title: 'Snappy Out',
    titleAr: 'منحنى سريع ناعم',
    subtitle: 'cubic(0.16, 1, 0.3, 1)',
    folderId: 'motion',
    pinned: true,
    order: 3,
    addedAt: Date.now() - 250000,
    useCount: 2,
    previewColor: '#06B6D4',
    compatibleLayerTypes: ['vector', 'text', 'image', 'video', 'solid', 'camera', 'null', 'group', 'model3d'],
    payload: { bezierHandle: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 } },
  },
  {
    id: 'fav_seed_font_cairo',
    refId: 'Cairo',
    type: 'font',
    title: 'Cairo Bold',
    titleAr: 'خط القاهرة',
    subtitle: 'Arabic + Latin Geometric',
    folderId: 'design',
    pinned: false,
    order: 4,
    addedAt: Date.now() - 200000,
    useCount: 3,
    previewColor: '#10B981',
    compatibleLayerTypes: ['text'],
    payload: { fontFamily: 'Cairo' },
  },
  {
    id: 'fav_seed_palette_neon',
    refId: 'palette_sunset_studio',
    type: 'palette',
    title: 'Sunset Cinema Palette',
    titleAr: 'لوحة غروب سينمائية',
    subtitle: '#FF4D6D · #F59E0B · #0F172A',
    folderId: 'design',
    pinned: false,
    order: 5,
    addedAt: Date.now() - 150000,
    useCount: 2,
    previewColor: '#FF4D6D',
    compatibleLayerTypes: ['vector', 'text', 'solid'],
    payload: { fill: '#FF4D6D', stroke: '#F59E0B', colors: ['#FF4D6D', '#F59E0B', '#0F172A'] },
  },
  {
    id: 'fav_seed_shape_star',
    refId: 'star',
    type: 'shape',
    title: '5-Point Star',
    titleAr: 'نجمة خماسية',
    subtitle: 'Vector Shape',
    folderId: 'design',
    pinned: false,
    order: 6,
    addedAt: Date.now() - 100000,
    useCount: 1,
    previewColor: '#F59E0B',
    payload: { shapeType: 'star', fill: '#F59E0B' },
  },
  {
    id: 'fav_seed_lut_teal',
    refId: 'lut_teal_orange',
    type: 'lut',
    title: 'Teal & Orange Grade',
    titleAr: 'تلوين سينمائي دافئ',
    subtitle: 'Color Grading LUT',
    folderId: 'fx',
    pinned: false,
    order: 7,
    addedAt: Date.now() - 90000,
    useCount: 1,
    previewColor: '#06B6D4',
    compatibleLayerTypes: ['image', 'video', 'adjustment', 'group'],
    payload: { effectType: 'colorGrading', params: { contrast: 1.15, saturation: 1.2, temperature: 12 } },
  },
];

let activeFavoritesUid: string | undefined;

export function setActiveFavoritesUid(uid?: string): void {
  activeFavoritesUid = uid || undefined;
}

function getFavoritesStorageKey(uid?: string): string {
  const effectiveUid = uid || activeFavoritesUid;
  return effectiveUid
    ? `sqmotion_favorites_v2_${effectiveUid.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : STORAGE_KEY;
}

export function loadFavoritesState(uid?: string): FavoritesState {
  const key = getFavoritesStorageKey(uid);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as FavoritesState;
      if (Array.isArray(parsed.items) && Array.isArray(parsed.folders)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse failure
  }
  const initial: FavoritesState = {
    items: SEED_ITEMS,
    folders: DEFAULT_FOLDERS,
    recentIds: SEED_ITEMS.slice(0, 4).map((i) => i.id),
    updatedAt: Date.now(),
  };
  saveFavoritesState(initial, uid);
  return initial;
}

export function saveFavoritesState(state: FavoritesState, uid?: string): void {
  const key = getFavoritesStorageKey(uid);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

export function isItemFavorited(state: FavoritesState, type: FavoriteItemType, refId: string): boolean {
  return state.items.some((i) => i.type === type && i.refId === refId);
}

export function toggleFavoriteItem(
  state: FavoritesState,
  candidate: Omit<FavoriteItem, 'id' | 'order' | 'addedAt' | 'useCount'>
): FavoritesState {
  const existing = state.items.find((i) => i.type === candidate.type && i.refId === candidate.refId);
  let nextItems: FavoriteItem[];
  let nextRecent = state.recentIds;

  if (existing) {
    nextItems = state.items.filter((i) => i.id !== existing.id);
    nextRecent = state.recentIds.filter((id) => id !== existing.id);
  } else {
    const newItem: FavoriteItem = {
      ...candidate,
      id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      order: 0,
      addedAt: Date.now(),
      useCount: 0,
    };
    nextItems = [newItem, ...state.items.map((item, idx) => ({ ...item, order: idx + 1 }))];
  }

  const nextState: FavoritesState = {
    ...state,
    items: nextItems,
    recentIds: nextRecent,
    updatedAt: Date.now(),
  };
  saveFavoritesState(nextState);
  return nextState;
}

export function recordFavoriteUsage(state: FavoritesState, itemId: string): FavoritesState {
  const now = Date.now();
  const nextItems = state.items.map((i) =>
    i.id === itemId ? { ...i, useCount: i.useCount + 1, lastUsedAt: now } : i
  );
  const nextRecent = [itemId, ...state.recentIds.filter((id) => id !== itemId)].slice(0, 20);
  const nextState: FavoritesState = {
    ...state,
    items: nextItems,
    recentIds: nextRecent,
    updatedAt: now,
  };
  saveFavoritesState(nextState);
  return nextState;
}

export function togglePinFavorite(state: FavoritesState, itemId: string): FavoritesState {
  const nextItems = state.items.map((i) => (i.id === itemId ? { ...i, pinned: !i.pinned } : i));
  const nextState = { ...state, items: nextItems, updatedAt: Date.now() };
  saveFavoritesState(nextState);
  return nextState;
}

export function renameFavoriteItem(state: FavoritesState, itemId: string, title: string): FavoritesState {
  const trimmed = title.trim();
  if (!trimmed) return state;
  const nextItems = state.items.map((i) =>
    i.id === itemId ? { ...i, title: trimmed, titleAr: trimmed } : i
  );
  const nextState = { ...state, items: nextItems, updatedAt: Date.now() };
  saveFavoritesState(nextState);
  return nextState;
}

export function moveFavoriteToFolder(state: FavoritesState, itemId: string, folderId: string): FavoritesState {
  const nextItems = state.items.map((i) => (i.id === itemId ? { ...i, folderId } : i));
  const nextState = { ...state, items: nextItems, updatedAt: Date.now() };
  saveFavoritesState(nextState);
  return nextState;
}

export function reorderFavoriteItems(state: FavoritesState, sourceId: string, targetId: string): FavoritesState {
  if (sourceId === targetId) return state;
  const list = [...state.items].sort((a, b) => a.order - b.order);
  const srcIdx = list.findIndex((i) => i.id === sourceId);
  const dstIdx = list.findIndex((i) => i.id === targetId);
  if (srcIdx < 0 || dstIdx < 0) return state;
  const [moved] = list.splice(srcIdx, 1);
  list.splice(dstIdx, 0, moved);
  const reordered = list.map((item, idx) => ({ ...item, order: idx }));
  const nextState = { ...state, items: reordered, updatedAt: Date.now() };
  saveFavoritesState(nextState);
  return nextState;
}

export function createFavoriteFolder(state: FavoritesState, name: string, color = '#FF4D6D'): FavoritesState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const folder: FavoriteFolder = {
    id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    name: trimmed,
    nameAr: trimmed,
    color,
    order: state.folders.length,
  };
  const nextState = {
    ...state,
    folders: [...state.folders, folder],
    updatedAt: Date.now(),
  };
  saveFavoritesState(nextState);
  return nextState;
}

export function checkItemCompatibility(item: FavoriteItem, selectedLayerType?: LayerType | null): {
  status: 'compatible' | 'needs_layer' | 'incompatible' | 'missing';
} {
  if (!item.payload || Object.keys(item.payload).length === 0) {
    return { status: 'missing' };
  }
  // Items like shapes, stickers, templates create a new layer so they never need a selected layer
  if (['shape', 'sticker', 'template', 'brush'].includes(item.type)) {
    return { status: 'compatible' };
  }
  if (!selectedLayerType) {
    return { status: 'needs_layer' };
  }
  if (item.compatibleLayerTypes && !item.compatibleLayerTypes.includes(selectedLayerType)) {
    return { status: 'incompatible' };
  }
  return { status: 'compatible' };
}

export function exportFavoritesJSON(state: FavoritesState): string {
  return JSON.stringify({ format: 'sqmotion_favorites_v1', ...state }, null, 2);
}

export function importFavoritesJSON(current: FavoritesState, rawJson: string): { state: FavoritesState; importedCount: number } {
  const parsed = JSON.parse(rawJson) as Partial<FavoritesState>;
  const incomingItems = Array.isArray(parsed.items) ? parsed.items : [];
  const incomingFolders = Array.isArray(parsed.folders) ? parsed.folders : [];

  const folderMap = new Map(current.folders.map((f) => [f.id, f]));
  for (const f of incomingFolders) {
    if (f?.id && !folderMap.has(f.id)) folderMap.set(f.id, f);
  }

  const existingRefs = new Set(current.items.map((i) => `${i.type}:${i.refId}`));
  const newItems = incomingItems.filter((i) => i && i.type && i.refId && !existingRefs.has(`${i.type}:${i.refId}`));

  const mergedItems = [...newItems, ...current.items].map((item, idx) => ({ ...item, order: idx }));
  const nextState: FavoritesState = {
    items: mergedItems,
    folders: Array.from(folderMap.values()),
    recentIds: current.recentIds,
    updatedAt: Date.now(),
  };
  saveFavoritesState(nextState);
  return { state: nextState, importedCount: newItems.length };
}
