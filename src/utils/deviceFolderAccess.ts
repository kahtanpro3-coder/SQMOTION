import {
  getFolderHandle,
  saveFolderHandle,
  saveMediaToLibrary,
  saveAudioToLibrary,
  SavedMediaRecord,
  SavedAudioRecord,
} from './localLibraryDB';

export type DeviceLibraryScope = 'media' | 'audio';
export type DevicePermissionState = 'granted' | 'prompt' | 'none';

export interface DeviceMediaGalleryItem {
  id: string;
  kind: 'image' | 'video';
  name: string;
  url: string;
  posterUrl?: string;
  albumName?: string;
  durationSec?: number;
  durationLabel?: string;
  isUserSaved: boolean;
  fromFolderHandle?: boolean;
}

export interface DeviceAudioGalleryItem {
  id: string;
  title: string;
  durationSec: number;
  durationLabel: string;
  gradient: string;
  waveformBars: number[];
  url: string;
  isUserSaved: boolean;
  fromFolderHandle?: boolean;
}

type PermDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico|heic|heif|tiff?)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|avi|m4v|3gp|ogv)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|wma|amr|3ga)$/i;

const AUDIO_GRADIENTS = [
  'from-emerald-600/80 via-slate-800/90 to-zinc-950',
  'from-cyan-600/80 via-slate-800/90 to-zinc-950',
  'from-violet-600/80 via-slate-800/90 to-zinc-950',
  'from-amber-600/80 via-slate-800/90 to-zinc-950',
  'from-rose-600/80 via-slate-800/90 to-zinc-950',
];

export function supportsNativeDirectoryPicker(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker !== 'function') {
    return false;
  }
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

function deterministicWaveform(seedName: string): number[] {
  let h = 0;
  for (let i = 0; i < seedName.length; i++) {
    h = (h * 31 + seedName.charCodeAt(i)) | 0;
  }
  return Array.from({ length: 16 }, (_, idx) => {
    const v = Math.abs(Math.sin((h + idx * 17) * 0.37));
    return Math.round(28 + v * 68);
  });
}

function classifyMediaFile(file: File): 'image' | 'video' | null {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/') || IMAGE_EXT_RE.test(file.name)) return 'image';
  if (t.startsWith('video/') || VIDEO_EXT_RE.test(file.name)) return 'video';
  return null;
}

function isAudioFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  return t.startsWith('audio/') || AUDIO_EXT_RE.test(file.name);
}

const PERM_FLAG_PREFIX = 'sq_device_library_perm_';

export function markFallbackPermissionGranted(scope: DeviceLibraryScope): void {
  try {
    localStorage.setItem(`${PERM_FLAG_PREFIX}${scope}`, 'granted');
  } catch {}
}

export async function getDeviceLibraryPermissionState(scope: DeviceLibraryScope): Promise<{
  state: DevicePermissionState;
  folderName?: string;
  handle?: FileSystemDirectoryHandle;
}> {
  try {
    const saved = await getFolderHandle(scope);
    if (saved?.handle) {
      const dh = saved.handle as PermDirectoryHandle;
      if (typeof dh.queryPermission === 'function') {
        const perm = await dh.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          return { state: 'granted', folderName: saved.folderName, handle: saved.handle };
        }
        if (perm === 'prompt') {
          return { state: 'prompt', folderName: saved.folderName, handle: saved.handle };
        }
      } else {
        return { state: 'granted', folderName: saved.folderName, handle: saved.handle };
      }
    }
  } catch {}

  try {
    if (localStorage.getItem(`${PERM_FLAG_PREFIX}${scope}`) === 'granted') {
      return { state: 'granted' };
    }
  } catch {}

  return { state: 'none' };
}

export async function scanDirectoryHandleMedia(
  handle: FileSystemDirectoryHandle,
  maxItems: number = 120
): Promise<DeviceMediaGalleryItem[]> {
  const results: DeviceMediaGalleryItem[] = [];
  const rootAlbum = handle.name || 'Device';
  const walk = async (dir: FileSystemDirectoryHandle, depth: number, albumName: string) => {
    if (results.length >= maxItems || depth > 3) return;
    const permDir = dir as PermDirectoryHandle;
    if (typeof permDir.values !== 'function') return;
    for await (const entry of permDir.values()) {
      if (results.length >= maxItems) break;
      if (entry.kind === 'file') {
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.size > 160 * 1024 * 1024) continue;
          const kind = classifyMediaFile(file);
          if (!kind) continue;
          const url = URL.createObjectURL(file);
          results.push({
            id: `dir-media-${file.name}-${file.size}-${file.lastModified}`,
            kind,
            name: file.name,
            url,
            albumName,
            durationSec: kind === 'video' ? 15 : undefined,
            durationLabel: kind === 'video' ? '00:15' : undefined,
            isUserSaved: false,
            fromFolderHandle: true,
          });
        } catch {}
      } else if (entry.kind === 'directory' && depth < 3) {
        if (!entry.name.startsWith('.')) {
          await walk(entry as FileSystemDirectoryHandle, depth + 1, entry.name);
        }
      }
    }
  };

  await walk(handle, 0, rootAlbum);
  return results;
}

export async function scanDirectoryHandleAudio(
  handle: FileSystemDirectoryHandle,
  maxItems: number = 80
): Promise<DeviceAudioGalleryItem[]> {
  const results: DeviceAudioGalleryItem[] = [];
  const walk = async (dir: FileSystemDirectoryHandle, depth: number) => {
    if (results.length >= maxItems || depth > 3) return;
    const permDir = dir as PermDirectoryHandle;
    if (typeof permDir.values !== 'function') return;
    for await (const entry of permDir.values()) {
      if (results.length >= maxItems) break;
      if (entry.kind === 'file') {
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.size > 120 * 1024 * 1024) continue;
          if (!isAudioFile(file)) continue;
          const url = URL.createObjectURL(file);
          results.push({
            id: `dir-aud-${file.name}-${file.size}-${file.lastModified}`,
            title: file.name,
            durationSec: 15,
            durationLabel: '00:15',
            gradient: AUDIO_GRADIENTS[results.length % AUDIO_GRADIENTS.length],
            waveformBars: deterministicWaveform(file.name),
            url,
            isUserSaved: false,
            fromFolderHandle: true,
          });
        } catch {}
      } else if (entry.kind === 'directory' && depth < 3) {
        if (!entry.name.startsWith('.')) {
          await walk(entry as FileSystemDirectoryHandle, depth + 1);
        }
      }
    }
  };

  await walk(handle, 0);
  return results;
}

export interface AuthorizeDirectoryResult {
  status: 'granted' | 'cancelled' | 'fallback_needed';
  folderName?: string;
  mediaItems?: DeviceMediaGalleryItem[];
  audioItems?: DeviceAudioGalleryItem[];
}

/**
 * Requests user permission via native File System Access API (remembering existing directory handle if any).
 * If blocked (iframe/mobile browser) or unsupported, returns 'fallback_needed' synchronously from catch so UI
 * can fall back smoothly to folder/file permission picker.
 */
export async function requestDeviceDirectoryAuthorization(
  scope: DeviceLibraryScope,
  forceNewPicker: boolean = false
): Promise<AuthorizeDirectoryResult> {
  try {
    if (!forceNewPicker) {
      const existing = await getFolderHandle(scope);
      if (existing?.handle) {
        const dh = existing.handle as PermDirectoryHandle;
        const perm =
          typeof dh.requestPermission === 'function'
            ? await dh.requestPermission({ mode: 'read' })
            : 'granted';
        if (perm === 'granted') {
          if (scope === 'media') {
            const mediaItems = await scanDirectoryHandleMedia(existing.handle);
            return { status: 'granted', folderName: existing.folderName, mediaItems };
          } else {
            const audioItems = await scanDirectoryHandleAudio(existing.handle);
            return { status: 'granted', folderName: existing.folderName, audioItems };
          }
        }
      }
    }

    const showPicker = (window as unknown as {
      showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;

    if (typeof showPicker !== 'function') {
      return { status: 'fallback_needed' };
    }

    const handle = await showPicker({
      id: scope === 'media' ? 'sq_media_folder' : 'sq_audio_folder',
      mode: 'read',
    });

    await saveFolderHandle({
      scope,
      handle,
      folderName: handle.name || (scope === 'media' ? 'Media' : 'Audio'),
      updatedAt: Date.now(),
    });
    markFallbackPermissionGranted(scope);

    if (scope === 'media') {
      const mediaItems = await scanDirectoryHandleMedia(handle);
      return { status: 'granted', folderName: handle.name, mediaItems };
    } else {
      const audioItems = await scanDirectoryHandleAudio(handle);
      return { status: 'granted', folderName: handle.name, audioItems };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    return { status: 'fallback_needed' };
  }
}

/**
 * Ingests scanned/selected folder or multi-selection files directly into the in-app IndexedDB library
 * so they appear immediately inside the app gallery across sessions without re-entering device files.
 */
export async function ingestDeviceFilesToInAppGallery(
  files: File[],
  scope: DeviceLibraryScope,
  maxItems: number = 120
): Promise<{
  mediaItems: DeviceMediaGalleryItem[];
  audioItems: DeviceAudioGalleryItem[];
}> {
  const mediaItems: DeviceMediaGalleryItem[] = [];
  const audioItems: DeviceAudioGalleryItem[] = [];
  const limited = files.slice(0, maxItems);

  for (let i = 0; i < limited.length; i++) {
    const file = limited[i];
    if (scope === 'media') {
      // Mobile photo pickers can occasionally return an empty MIME type without an extension
      let kind = classifyMediaFile(file);
      if (!kind && (!file.type || file.type === 'application/octet-stream') && !isAudioFile(file)) {
        kind = 'image';
      }
      if (!kind) continue;

      // Derive album name from webkitRelativePath if imported via directory picker
      const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      const pathParts = relPath.split('/').filter(Boolean);
      const albumName =
        pathParts.length >= 2
          ? pathParts[pathParts.length - 2]
          : undefined;

      const id = `dev-media-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      const url = URL.createObjectURL(file);
      const record: SavedMediaRecord = {
        id,
        kind,
        name: file.name,
        blob: file,
        albumName,
        durationSec: kind === 'video' ? 15 : undefined,
        durationLabel: kind === 'video' ? '00:15' : undefined,
        createdAt: Date.now() - i,
      };
      saveMediaToLibrary(record).catch(() => {});
      mediaItems.push({
        id,
        kind,
        name: file.name,
        url,
        albumName,
        durationSec: record.durationSec,
        durationLabel: record.durationLabel,
        isUserSaved: true,
      });
    } else {
      const hasMediaExt = Boolean(classifyMediaFile(file));
      const acceptAsAudio =
        isAudioFile(file) || ((!file.type || file.type === 'application/octet-stream') && !hasMediaExt);
      if (!acceptAsAudio) continue;
      const id = `dev-aud-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      const url = URL.createObjectURL(file);
      const gradient = AUDIO_GRADIENTS[i % AUDIO_GRADIENTS.length];
      const waveformBars = deterministicWaveform(file.name);
      const record: SavedAudioRecord = {
        id,
        title: file.name,
        blob: file,
        durationSec: 15,
        durationLabel: '00:15',
        gradient,
        waveformBars,
        createdAt: Date.now() - i,
      };
      saveAudioToLibrary(record).catch(() => {});
      audioItems.push({
        id,
        title: file.name,
        durationSec: 15,
        durationLabel: '00:15',
        gradient,
        waveformBars,
        url,
        isUserSaved: true,
      });
    }
  }

  markFallbackPermissionGranted(scope);
  return { mediaItems, audioItems };
}

// Concurrency-limited poster & duration extractor for instant lag-free video gallery thumbnails
const posterCache = new Map<string, { posterUrl?: string; durationSec?: number; durationLabel?: string }>();
const posterInflight = new Map<string, Promise<{ posterUrl?: string; durationSec?: number; durationLabel?: string }>>();

const formatDur = (sec: number): string => {
  if (!Number.isFinite(sec) || sec <= 0) return '00:15';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function extractVideoPosterAndDuration(
  url: string
): Promise<{ posterUrl?: string; durationSec?: number; durationLabel?: string }> {
  const cached = posterCache.get(url);
  if (cached) return Promise.resolve(cached);

  const existing = posterInflight.get(url);
  if (existing) return existing;

  const job = new Promise<{ posterUrl?: string; durationSec?: number; durationLabel?: string }>((resolve) => {
    if (typeof document === 'undefined' || !url) {
      resolve({});
      return;
    }

    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';

    let finished = false;
    let durationSec: number | undefined;
    let durationLabel: string | undefined;

    const finish = (posterUrl?: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      vid.onloadedmetadata = null;
      vid.onseeked = null;
      vid.onerror = null;
      try {
        vid.removeAttribute('src');
        vid.load();
      } catch {}
      const res = { posterUrl, durationSec, durationLabel };
      posterCache.set(url, res);
      posterInflight.delete(url);
      resolve(res);
    };

    const timer = window.setTimeout(() => finish(undefined), 2800);

    vid.onloadedmetadata = () => {
      if (Number.isFinite(vid.duration) && vid.duration > 0.1) {
        durationSec = vid.duration;
        durationLabel = formatDur(vid.duration);
      }
      try {
        const seekTarget = vid.duration && Number.isFinite(vid.duration)
          ? Math.min(0.4, vid.duration * 0.2)
          : 0.2;
        vid.currentTime = seekTarget;
      } catch {
        finish(undefined);
      }
    };

    vid.onseeked = () => {
      try {
        const w = Math.min(240, vid.videoWidth || 240);
        const h = Math.min(240, vid.videoHeight || 240);
        if (w > 0 && h > 0) {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(vid, 0, 0, w, h);
            const dataUrl = c.toDataURL('image/jpeg', 0.65);
            finish(dataUrl);
            return;
          }
        }
      } catch {}
      finish(undefined);
    };

    vid.onerror = () => finish(undefined);
    vid.src = url;
  });

  posterInflight.set(url, job);
  return job;
}

