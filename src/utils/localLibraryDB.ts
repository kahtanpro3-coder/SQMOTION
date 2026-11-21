// Persistent IndexedDB asset library for user-imported Media (Photos & Videos), Audio Tracks, and 3D Models.
// Ensures uploaded files appear and remain usable inside the app without re-opening the device file manager.

export interface SavedMediaRecord {
  id: string;
  kind: 'image' | 'video';
  name: string;
  blob: Blob;
  albumName?: string;
  posterDataUrl?: string;
  durationSec?: number;
  durationLabel?: string;
  createdAt: number;
}

export interface SavedAudioRecord {
  id: string;
  title: string;
  blob: Blob;
  durationSec: number;
  durationLabel: string;
  gradient: string;
  waveformBars: number[];
  createdAt: number;
}

export interface SavedModelExtraFile {
  path: string;
  blob: Blob;
}

export interface SavedModel3DRecord {
  id: string;
  name: string;
  fileName: string;
  format: string;
  mainBlob: Blob;
  mtlText?: string;
  extraFiles?: SavedModelExtraFile[];
  thumbnailDataUrl?: string;
  hasBones: boolean;
  animationClips: string[];
  meshCount?: number;
  materialCount?: number;
  createdAt: number;
}

export interface SavedFolderHandleRecord {
  scope: 'media' | 'audio';
  handle: FileSystemDirectoryHandle;
  folderName: string;
  updatedAt: number;
}

const DB_NAME = 'sq_motion_library_v1';
const DB_VERSION = 2;
const STORE_MEDIA = 'media';
const STORE_AUDIO = 'audio';
const STORE_MODELS3D = 'models3d';
const STORE_FOLDER_HANDLES = 'folderHandles';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openLibraryDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_MODELS3D)) {
          db.createObjectStore(STORE_MODELS3D, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FOLDER_HANDLES)) {
          db.createObjectStore(STORE_FOLDER_HANDLES, { keyPath: 'scope' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function putRecord<T>(storeName: string, record: T): Promise<void> {
  const db = await openLibraryDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function getAllRecords<T extends { createdAt?: number }>(storeName: string): Promise<T[]> {
  const db = await openLibraryDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => {
        const items = (req.result as T[]) || [];
        items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(items);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function getRecordById<T>(storeName: string, id: string): Promise<T | null> {
  const db = await openLibraryDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function deleteRecordById(storeName: string, id: string): Promise<void> {
  const db = await openLibraryDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export const saveMediaToLibrary = (record: SavedMediaRecord) => putRecord(STORE_MEDIA, record);
export const listMediaFromLibrary = () => getAllRecords<SavedMediaRecord>(STORE_MEDIA);
export const deleteMediaFromLibrary = (id: string) => deleteRecordById(STORE_MEDIA, id);

export const saveAudioToLibrary = (record: SavedAudioRecord) => putRecord(STORE_AUDIO, record);
export const listAudioFromLibrary = () => getAllRecords<SavedAudioRecord>(STORE_AUDIO);
export const deleteAudioFromLibrary = (id: string) => deleteRecordById(STORE_AUDIO, id);

export const saveModel3DToLibrary = (record: SavedModel3DRecord) => putRecord(STORE_MODELS3D, record);
export const listModels3DFromLibrary = () => getAllRecords<SavedModel3DRecord>(STORE_MODELS3D);
export const getModel3DFromLibrary = (id: string) => getRecordById<SavedModel3DRecord>(STORE_MODELS3D, id);
export const deleteModel3DFromLibrary = (id: string) => deleteRecordById(STORE_MODELS3D, id);

export const saveFolderHandle = (record: SavedFolderHandleRecord) =>
  putRecord(STORE_FOLDER_HANDLES, record);
export const getFolderHandle = (scope: 'media' | 'audio') =>
  getRecordById<SavedFolderHandleRecord>(STORE_FOLDER_HANDLES, scope);
export const deleteFolderHandle = (scope: 'media' | 'audio') =>
  deleteRecordById(STORE_FOLDER_HANDLES, scope);

