const DB_NAME = 'sqmotion_fs_handles_v1';
const STORE_NAME = 'handles';
const EXPORT_DIR_KEY = 'export_directory';

interface FileSystemWritableLike {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableLike>;
}

export interface FileSystemDirectoryHandleLike {
  name: string;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  getDirectoryHandle?: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandleLike>;
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function savePickedDirectoryHandle(handle: FileSystemDirectoryHandleLike): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, EXPORT_DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IDB storage failures in private browsing
  }
}

export async function getPickedDirectoryHandle(): Promise<FileSystemDirectoryHandleLike | null> {
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemDirectoryHandleLike | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(EXPORT_DIR_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandleLike) || null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearPickedDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(EXPORT_DIR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // ignore
  }
}

export function canUseDirectoryPicker(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/**
 * Prompts the user to select their Movies / Videos directory (starting directly in 'videos'),
 * stores the handle in IndexedDB, and targets the `SQMOTION` subfolder inside it.
 */
export async function pickExportMoviesDirectory(): Promise<{
  handle: FileSystemDirectoryHandleLike;
  displayPath: string;
} | null> {
  if (!canUseDirectoryPicker()) return null;

  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (opts?: {
          id?: string;
          startIn?: string;
          mode?: 'read' | 'readwrite';
        }) => Promise<FileSystemDirectoryHandleLike>;
      }
    ).showDirectoryPicker;

    const dir = await picker({
      id: 'sqmotion_movies_dir',
      startIn: 'videos',
      mode: 'readwrite',
    });

    if (!dir?.name) return null;
    await savePickedDirectoryHandle(dir);

    const displayPath =
      dir.name.toUpperCase() === 'SQMOTION' ? `/${dir.name}` : `/${dir.name}/SQMOTION`;

    return { handle: dir, displayPath };
  } catch {
    return null;
  }
}

async function resolveTargetSubfolder(
  baseDir: FileSystemDirectoryHandleLike,
  subfolderName: string = 'SQMOTION'
): Promise<{ targetDir: FileSystemDirectoryHandleLike; folderPath: string }> {
  if (baseDir.name.toUpperCase() === subfolderName.toUpperCase()) {
    return { targetDir: baseDir, folderPath: `/${baseDir.name}` };
  }

  if (typeof baseDir.getDirectoryHandle === 'function') {
    try {
      const subDir = await baseDir.getDirectoryHandle(subfolderName, { create: true });
      return { targetDir: subDir, folderPath: `/${baseDir.name}/${subfolderName}` };
    } catch {
      // Fallback to baseDir if subfolder creation is denied
    }
  }

  return { targetDir: baseDir, folderPath: `/${baseDir.name}` };
}

export async function saveBlobToPickedDirectory(
  blob: Blob,
  filename: string,
  subfolderName: string = 'SQMOTION',
  handleOverride?: FileSystemDirectoryHandleLike
): Promise<{ saved: boolean; folderName?: string; folderPath?: string }> {
  const dir = handleOverride || (await getPickedDirectoryHandle());
  if (!dir) return { saved: false };

  try {
    if (typeof dir.queryPermission === 'function') {
      let perm = await dir.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && typeof dir.requestPermission === 'function') {
        perm = await dir.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') return { saved: false };
    }

    const { targetDir, folderPath } = await resolveTargetSubfolder(dir, subfolderName);
    const fileHandle = await targetDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true, folderName: targetDir.name, folderPath };
  } catch {
    return { saved: false };
  }
}

export async function saveBlobWithSystemSavePicker(
  blob: Blob,
  filename: string
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const savePicker = (
    window as unknown as {
      showSaveFilePicker?: (opts?: {
        id?: string;
        suggestedName?: string;
        startIn?: string;
      }) => Promise<FileSystemFileHandleLike>;
    }
  ).showSaveFilePicker;
  if (typeof savePicker !== 'function') return false;

  try {
    const fileHandle = await savePicker({
      id: 'sqmotion_movies_save',
      suggestedName: filename,
      startIn: 'videos',
    });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function canShareExportedFile(blob: Blob, filename: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareExportedFile(blob: Blob, filename: string): Promise<boolean> {
  if (!canShareExportedFile(blob, filename)) return false;
  try {
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
    await navigator.share({
      files: [file],
      title: filename,
    });
    return true;
  } catch {
    return false;
  }
}

export function triggerBrowserDownload(blobOrUrl: Blob | string, filename: string): void {
  const isString = typeof blobOrUrl === 'string';
  const finalName = filename.toLowerCase().startsWith('sqmotion')
    ? filename
    : `SQMOTION_${filename}`;
  const url = isString ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {
      // ignore
    }
    if (!isString) {
      URL.revokeObjectURL(url);
    }
  }, 1500);
}
