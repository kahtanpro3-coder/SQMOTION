import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, Layer } from '../types';
import { auth, getScopedProjectsStorageKey } from '../lib/firebase';
import {
  PANEL_SPRING,
  backdropVariants,
  bottomSheetVariants,
  dropdownVariants,
  staggerContainerVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';
import {
  X,
  Square,
  Circle,
  Star,
  Triangle,
  Heart,
  Sparkles,
  Volume2,
  Palette,
  Upload,
  Music,
  Image as ImageIcon,
  Video,
  ThumbsUp,
  Flag,
  Check,
  Shield,
  Snowflake,
  Droplet,
  MessageSquare,
  Plus,
  Compass,
  Bookmark,
  Cloud,
  Moon,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Hexagon,
  Plane,
  Pin,
  Puzzle,
  Zap,
  Grid,
  Flower2,
  CircleDot,
  Camera,
  Sliders,
  Box,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Play,
  Pause,
  Link2,
  Trash2,
  FolderOpen,
  ShieldCheck,
  RefreshCw,
  Globe,
  Search,
} from 'lucide-react';
import {
  load3DModelFiles,
  load3DModelFromSavedRecord,
} from '../engine/model3dLoader';
import {
  BUILTIN_AUDIO_TRACKS,
  BUILTIN_MEDIA_GALLERY,
  BuiltinMediaItem,
  getBuiltinAudioUrl,
  getBuiltinVideoClips,
} from '../utils/synthAudio';
import {
  SavedModel3DRecord,
  saveMediaToLibrary,
  listMediaFromLibrary,
  deleteMediaFromLibrary,
  saveAudioToLibrary,
  listAudioFromLibrary,
  deleteAudioFromLibrary,
  saveModel3DToLibrary,
  listModels3DFromLibrary,
  deleteModel3DFromLibrary,
} from '../utils/localLibraryDB';
import {
  DevicePermissionState,
  getDeviceLibraryPermissionState,
  scanDirectoryHandleMedia,
  scanDirectoryHandleAudio,
  requestDeviceDirectoryAuthorization,
  ingestDeviceFilesToInAppGallery,
  supportsNativeDirectoryPicker,
  extractVideoPosterAndDuration,
} from '../utils/deviceFolderAccess';

interface SessionMediaItem extends BuiltinMediaItem {
  durationSec?: number;
  albumName?: string;
}

const MediaVideoTile: React.FC<{
  url: string;
  initialPoster?: string;
  initialDurationLabel?: string;
  alt: string;
  onResolved?: (posterUrl?: string, durationSec?: number, durationLabel?: string) => void;
}> = ({ url, initialPoster, initialDurationLabel, alt, onResolved }) => {
  const [poster, setPoster] = useState<string | undefined>(initialPoster);
  const [durLabel, setDurLabel] = useState<string | undefined>(initialDurationLabel);

  useEffect(() => {
    setPoster(initialPoster);
  }, [initialPoster]);

  useEffect(() => {
    setDurLabel(initialDurationLabel);
  }, [initialDurationLabel]);

  useEffect(() => {
    if (initialPoster && initialDurationLabel && initialDurationLabel !== 'VIDEO') return;
    let active = true;
    extractVideoPosterAndDuration(url).then((res) => {
      if (!active) return;
      if (res.posterUrl) setPoster(res.posterUrl);
      if (res.durationLabel) setDurLabel(res.durationLabel);
      if (res.posterUrl || res.durationSec) {
        onResolved?.(res.posterUrl, res.durationSec, res.durationLabel);
      }
    });
    return () => {
      active = false;
    };
  }, [url, initialPoster, initialDurationLabel]);

  return (
    <>
      {poster ? (
        <img
          src={poster}
          alt={alt}
          loading="lazy"
          draggable={false}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#23262D] via-[#191B20] to-[#121316] flex items-center justify-center">
          <Video className="w-5 h-5 text-slate-500/70" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/15 pointer-events-none flex items-center justify-center">
        <Play className="w-4 h-4 text-white/95 fill-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
      <span className="absolute bottom-0.5 start-1 text-[9px] font-mono font-semibold text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none tabular-nums">
        {durLabel && durLabel !== 'VIDEO' ? durLabel : '00:15'}
      </span>
    </>
  );
};

interface SessionAudioItem {
  id: string;
  title: string;
  durationSec: number;
  durationLabel: string;
  gradient: string;
  waveformBars: number[];
  url: string;
  isUserSaved?: boolean;
}

const formatAudioDuration = (sec: number): string => {
  if (!Number.isFinite(sec) || sec <= 0) return '00:15';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface AlightAddModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  onAddLayer: (type: Layer['type'], customConfig?: any) => string | void;
  onUpdateLayerDuration?: (layerId: string, durationSeconds: number) => void;
  onOpenTemplates?: () => void;
  onOpenExport?: () => void;
  onChangeAspectRatio?: (width: number, height: number) => void;
}

type SubView = 'main' | 'media' | 'shapes' | 'audio' | 'elements' | 'presets';

export const AlightAddModal: React.FC<AlightAddModalProps> = ({
  isOpen,
  lang,
  onClose,
  onAddLayer,
  onUpdateLayerDuration,
  onOpenTemplates,
}) => {
  const [subView, setSubView] = useState<SubView>('main');
  const [shapePage, setShapePage] = useState<number>(0);
  const [mediaUrlInput, setMediaUrlInput] = useState<string>('');
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [loadingModelProgress, setLoadingModelProgress] = useState<string>('');
  const [modelError, setModelError] = useState<string | null>(null);
  const [showMediaUrlBox, setShowMediaUrlBox] = useState<boolean>(false);
  const [selectedMediaAlbum, setSelectedMediaAlbum] = useState<string>('all');
  const [expandMediaAll, setExpandMediaAll] = useState<boolean>(false);
  const [expandAudioAll, setExpandAudioAll] = useState<boolean>(false);
  const [sessionMedia, setSessionMedia] = useState<SessionMediaItem[]>([]);
  const [deviceFolderMedia, setDeviceFolderMedia] = useState<SessionMediaItem[]>([]);
  const [projectSavedMedia, setProjectSavedMedia] = useState<SessionMediaItem[]>([]);
  const [builtinVideos, setBuiltinVideos] = useState<BuiltinMediaItem[]>([]);
  const [loadingBuiltinVideos, setLoadingBuiltinVideos] = useState<boolean>(false);
  const [sessionAudio, setSessionAudio] = useState<SessionAudioItem[]>([]);
  const [deviceFolderAudio, setDeviceFolderAudio] = useState<SessionAudioItem[]>([]);
  const [savedModels3D, setSavedModels3D] = useState<SavedModel3DRecord[]>([]);
  const [isModelDragOver, setIsModelDragOver] = useState<boolean>(false);
  const [previewAudioId, setPreviewAudioId] = useState<string | null>(null);

  // Permission-based device gallery state
  const [mediaPermState, setMediaPermState] = useState<DevicePermissionState>('none');
  const [audioPermState, setAudioPermState] = useState<DevicePermissionState>('none');
  const [mediaFolderName, setMediaFolderName] = useState<string>('');
  const [audioFolderName, setAudioFolderName] = useState<string>('');
  const [mediaPermDismissed, setMediaPermDismissed] = useState<boolean>(false);
  const [audioPermDismissed, setAudioPermDismissed] = useState<boolean>(false);
  const [isRequestingDevicePerm, setIsRequestingDevicePerm] = useState<boolean>(false);
  const [galleryNotice, setGalleryNotice] = useState<{
    scope: 'media' | 'audio';
    count: number;
    latestMedia?: SessionMediaItem;
    latestAudio?: SessionAudioItem;
  } | null>(null);

  // Live Internet Stock Media & Audio Discovery
  const [mediaSourceTab, setMediaSourceTab] = useState<'library' | 'online'>('library');
  const [onlineMediaQuery, setOnlineMediaQuery] = useState<string>('neon cyberpunk');
  const [onlineMediaKind, setOnlineMediaKind] = useState<'all' | 'image' | 'video'>('all');
  const [onlineMediaResults, setOnlineMediaResults] = useState<Array<{
    id: string;
    kind: 'image' | 'video';
    title: string;
    url: string;
    proxyUrl: string;
    thumbUrl: string;
    durationSec?: number;
    source: string;
  }>>([]);
  const [loadingOnlineMedia, setLoadingOnlineMedia] = useState<boolean>(false);

  const [audioSourceTab, setAudioSourceTab] = useState<'library' | 'online'>('library');
  const [onlineAudioQuery, setOnlineAudioQuery] = useState<string>('cinematic electronic');
  const [onlineAudioResults, setOnlineAudioResults] = useState<Array<{
    id: string;
    title: string;
    artist?: string;
    url: string;
    proxyUrl: string;
    durationSec: number;
    durationLabel: string;
    source: string;
  }>>([]);
  const [loadingOnlineAudio, setLoadingOnlineAudio] = useState<boolean>(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaGridRef = useRef<HTMLDivElement>(null);
  const audioGridRef = useRef<HTMLDivElement>(null);
  const libraryHydratedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaGalleryPermInputRef = useRef<HTMLInputElement>(null);
  const mediaFolderFallbackInputRef = useRef<HTMLInputElement>(null);
  const audioGalleryPermInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  const supportsFolderInput =
    typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input');

  const isAr = lang === 'ar';

  const stopAudioPreview = () => {
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      } catch {}
      previewAudioRef.current = null;
    }
    setPreviewAudioId(null);
  };

  // Hydrate persistent in-app library (Media, Audio, 3D Models, Permission Handles) + generate built-in video clips once
  useEffect(() => {
    if (!isOpen) {
      stopAudioPreview();
      return;
    }

    setSubView('main');
    setModelError(null);
    setShowMediaUrlBox(false);
    setGalleryNotice(null);

    const fetchOnlineMedia = async (q: string, kind: 'all' | 'image' | 'video') => {
      setLoadingOnlineMedia(true);
      try {
        const res = await fetch(`/api/online/media?q=${encodeURIComponent(q)}&kind=${kind}`);
        const data = await res.json();
        setOnlineMediaResults(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setOnlineMediaResults([]);
      } finally {
        setLoadingOnlineMedia(false);
      }
    };
    void fetchOnlineMedia;

    if (!libraryHydratedRef.current) {
      libraryHydratedRef.current = true;

      listMediaFromLibrary().then((records) => {
        if (records.length > 0) {
          setSessionMedia(
            records.map((r) => ({
              id: r.id,
              kind: r.kind,
              name: r.name,
              url: URL.createObjectURL(r.blob),
              posterUrl: r.posterDataUrl,
              albumName: r.albumName,
              durationSec: r.durationSec,
              durationLabel: r.durationLabel,
              isUserSaved: true,
            }))
          );
        }
      });

      // Also collect persistent media URLs from the signed-in user's scoped projects
      try {
        const uid = auth.currentUser?.uid;
        const storedProjs = uid ? localStorage.getItem(getScopedProjectsStorageKey(uid)) : null;
        if (storedProjs) {
          const parsed = JSON.parse(storedProjs);
          if (Array.isArray(parsed)) {
            const seenUrls = new Set<string>();
            const collected: SessionMediaItem[] = [];
            parsed.forEach((proj: any) => {
              if (!Array.isArray(proj?.layers)) return;
              proj.layers.forEach((layer: any) => {
                if ((layer?.type === 'image' || layer?.type === 'video') && typeof layer.mediaUrl === 'string') {
                  const u = layer.mediaUrl;
                  if (!u || u.startsWith('blob:') || seenUrls.has(u)) return;
                  seenUrls.add(u);
                  collected.push({
                    id: `proj-media-${collected.length}-${layer.id}`,
                    kind: layer.type === 'video' ? 'video' : 'image',
                    name: layer.name || (layer.type === 'video' ? 'Video' : 'Image'),
                    url: u,
                    albumName: isAr ? 'المشاريع' : 'Projects',
                    durationSec: layer.type === 'video' ? 15 : undefined,
                    durationLabel: layer.type === 'video' ? '00:15' : undefined,
                  });
                }
              });
            });
            if (collected.length > 0) {
              setProjectSavedMedia(collected);
            }
          }
        }
      } catch {}

      listAudioFromLibrary().then((records) => {
        if (records.length > 0) {
          setSessionAudio(
            records.map((r) => ({
              id: r.id,
              title: r.title,
              durationSec: r.durationSec,
              durationLabel: r.durationLabel,
              gradient: r.gradient,
              waveformBars: r.waveformBars,
              url: URL.createObjectURL(r.blob),
              isUserSaved: true,
            }))
          );
        }
      });

      listModels3DFromLibrary().then((records) => {
        if (records.length > 0) {
          setSavedModels3D(records);
        }
      });

      setLoadingBuiltinVideos(true);
      getBuiltinVideoClips()
        .then((clips) => {
          setBuiltinVideos(clips);
        })
        .finally(() => {
          setLoadingBuiltinVideos(false);
        });
    }

    // Check saved folder permissions cleanly on modal open
    getDeviceLibraryPermissionState('media').then((info) => {
      setMediaPermState(info.state);
      if (info.folderName) setMediaFolderName(info.folderName);
      if (info.state === 'granted' && info.handle) {
        scanDirectoryHandleMedia(info.handle).then((items) => {
          if (items.length > 0) setDeviceFolderMedia(items);
        });
      }
    });
    getDeviceLibraryPermissionState('audio').then((info) => {
      setAudioPermState(info.state);
      if (info.folderName) setAudioFolderName(info.folderName);
      if (info.state === 'granted' && info.handle) {
        scanDirectoryHandleAudio(info.handle).then((items) => {
          if (items.length > 0) setDeviceFolderAudio(items);
        });
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (subView !== 'audio') {
      stopAudioPreview();
    }
  }, [subView]);

  const handleRequestDeviceGalleryAccess = async (
    scope: 'media' | 'audio',
    forceNewPicker: boolean = false
  ) => {
    // Check directory picker support synchronously BEFORE any async await so mobile/iframe browsers
    // retain transient user activation when opening the system photo/audio picker.
    if (!supportsNativeDirectoryPicker()) {
      if (scope === 'media') {
        mediaGalleryPermInputRef.current?.click();
      } else {
        audioGalleryPermInputRef.current?.click();
      }
      return;
    }

    setIsRequestingDevicePerm(true);
    try {
      const res = await requestDeviceDirectoryAuthorization(scope, forceNewPicker);
      if (res.status === 'granted') {
        if (scope === 'media') {
          setMediaPermState('granted');
          setMediaPermDismissed(false);
          if (res.folderName) setMediaFolderName(res.folderName);
          if (res.mediaItems && res.mediaItems.length > 0) {
            setDeviceFolderMedia(res.mediaItems);
            setGalleryNotice({
              scope: 'media',
              count: res.mediaItems.length,
              latestMedia: res.mediaItems[0],
            });
          }
        } else {
          setAudioPermState('granted');
          setAudioPermDismissed(false);
          if (res.folderName) setAudioFolderName(res.folderName);
          if (res.audioItems && res.audioItems.length > 0) {
            setDeviceFolderAudio(res.audioItems);
            setGalleryNotice({
              scope: 'audio',
              count: res.audioItems.length,
              latestAudio: res.audioItems[0],
            });
          }
        }
      } else if (res.status === 'fallback_needed') {
        if (scope === 'media') {
          mediaGalleryPermInputRef.current?.click();
        } else {
          audioGalleryPermInputRef.current?.click();
        }
      }
    } finally {
      setIsRequestingDevicePerm(false);
    }
  };

  const handleGalleryPermFallbackChange = async (
    scope: 'media' | 'audio',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    setIsRequestingDevicePerm(true);
    try {
      const { mediaItems, audioItems } = await ingestDeviceFilesToInAppGallery(files, scope);
      if (scope === 'media') {
        setMediaPermState('granted');
        setMediaPermDismissed(false);
        setSelectedMediaAlbum('all');
        if (mediaItems.length > 0) {
          setDeviceFolderMedia((prev) => [...mediaItems, ...prev]);
          setGalleryNotice({
            scope: 'media',
            count: mediaItems.length,
            latestMedia: mediaItems[0],
          });
          requestAnimationFrame(() => {
            if (mediaGridRef.current) mediaGridRef.current.scrollTop = 0;
          });
        }
      } else {
        setAudioPermState('granted');
        setAudioPermDismissed(false);
        if (audioItems.length > 0) {
          setDeviceFolderAudio((prev) => [...audioItems, ...prev]);
          setGalleryNotice({
            scope: 'audio',
            count: audioItems.length,
            latestAudio: audioItems[0],
          });
          requestAnimationFrame(() => {
            if (audioGridRef.current) audioGridRef.current.scrollTop = 0;
          });
          // Probe actual audio durations in the background
          audioItems.forEach((item) => {
            const probe = new Audio();
            probe.preload = 'metadata';
            probe.onloadedmetadata = () => {
              const dur = probe.duration;
              probe.onloadedmetadata = null;
              if (Number.isFinite(dur) && dur > 0.1) {
                const label = formatAudioDuration(dur);
                setDeviceFolderAudio((prev) =>
                  prev.map((a) => (a.id === item.id ? { ...a, durationSec: dur, durationLabel: label } : a))
                );
              }
            };
            probe.src = item.url;
          });
        }
      }
    } finally {
      setIsRequestingDevicePerm(false);
    }
  };

  const processSelected3DModelFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    try {
      setModelError(null);
      setIsLoadingModel(true);
      setLoadingModelProgress(
        isAr
          ? 'جارٍ تحليل وقراءة المجسم بجميع تفاصيله والخامات والعظام...'
          : 'Loading full 3D model geometry, materials, textures & rig...'
      );
      const result = await load3DModelFiles(files);
      const cleanName = result.fileName.replace(/\.[^/.]+$/, '') || (isAr ? 'مجسم 3D' : '3D Model');

      const savedId = `model3d-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      if (result.persistenceData) {
        const record: SavedModel3DRecord = {
          id: savedId,
          name: cleanName,
          fileName: result.fileName,
          format: result.format,
          mainBlob: result.persistenceData.mainBlob,
          mtlText: result.persistenceData.mtlText,
          extraFiles: result.persistenceData.extraFiles,
          thumbnailDataUrl: result.thumbnailDataUrl,
          hasBones: result.hasBones,
          animationClips: result.animationClips,
          meshCount: result.meshCount,
          materialCount: result.materialCount,
          createdAt: Date.now(),
        };
        setSavedModels3D((prev) => [record, ...prev]);
        // Persist in background so IndexedDB limits/locks never block timeline insertion
        saveModel3DToLibrary(record).catch(() => {});
      }

      onAddLayer('model3d', {
        name: cleanName,
        is3D: true,
        fixedIn3D: false,
        model3dConfig: {
          savedModelId: result.persistenceData ? savedId : undefined,
          modelUrl: result.modelUrl,
          fileName: result.fileName,
          format: result.format,
          hasBones: result.hasBones,
          autoRigged: false,
          creatureType: result.hasBones ? 'none' : 'biped',
          bones: result.bones,
          animationClips: result.animationClips,
          activeClipIndex: 0,
          animationSpeed: 1,
          castFloorShadow: true,
          ambientIntensity: 0.75,
          directionalIntensity: 1.5,
        },
      });
      onClose();
    } catch (err: any) {
      console.error('Error loading 3D model:', err);
      setModelError(
        err?.message || (isAr ? 'حدث خطأ أثناء تحميل المجسم ثلاثي الأبعاد' : 'Error loading 3D model')
      );
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (e.target) e.target.value = '';
    await processSelected3DModelFiles(files);
  };

  const handleAddSaved3DModel = async (record: SavedModel3DRecord) => {
    try {
      setModelError(null);
      setIsLoadingModel(true);
      setLoadingModelProgress(
        isAr ? `جارٍ تجهيز "${record.name}" بجميع تفاصيله...` : `Preparing "${record.name}"...`
      );
      const result = await load3DModelFromSavedRecord(record);
      onAddLayer('model3d', {
        name: record.name,
        is3D: true,
        fixedIn3D: false,
        model3dConfig: {
          savedModelId: record.id,
          modelUrl: result.modelUrl,
          fileName: result.fileName,
          format: result.format,
          hasBones: result.hasBones,
          autoRigged: false,
          creatureType: result.hasBones ? 'none' : 'biped',
          bones: result.bones,
          animationClips: result.animationClips,
          activeClipIndex: 0,
          animationSpeed: 1,
          castFloorShadow: true,
          ambientIntensity: 0.75,
          directionalIntensity: 1.5,
        },
      });
      onClose();
    } catch (err: any) {
      setModelError(err?.message || (isAr ? 'تعذر تحميل المجسم المحفوظ' : 'Failed to load saved model'));
    } finally {
      setIsLoadingModel(false);
    }
  };

  const handleAdd3DText = () => {
    onAddLayer('text', {
      name: isAr ? 'نص ثلاثي الأبعاد' : '3D Text',
      is3D: true,
      fixedIn3D: false,
      is3dText: true,
      rotation: { x: 8, y: -16, z: 0 },
      textConfig: {
        text: isAr ? 'نص ثلاثي الأبعاد' : '3D CREATIVE TEXT',
        fontSize: 64,
        fontFamily: 'Cairo',
        fill: '#FFFFFF',
        stroke: '#F59E0B',
        strokeWidth: 0,
        letterSpacing: 2,
        lineHeight: 1.2,
        align: 'center',
      },
      mesh3dConfig: {
        enabled: true,
        type: 'extrusion',
        depth: 50,
        bevel: 5,
        material: 'gold',
        roughness: 0.2,
        metalness: 0.85,
        specular: 1.5,
        lightAngle: 45,
        lightElevation: 35,
        ambientIntensity: 0.45,
        diffuseIntensity: 0.8,
        castFloorShadow: true,
        castFloorReflection: false,
      },
    });
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    files.forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const mimeType = file.type || '';
      const isVideo =
        mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v|3gp|ogv)$/i.test(file.name);
      const isAudio =
        mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(file.name);
      const layerId = `layer-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;

      if (isVideo) {
        const recordId = `user-vid-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;
        const defaultDur = 15;
        let persistedToDb = false;
        const persistVideoRecord = (durationSec: number, durationLabel: string) => {
          if (persistedToDb) return;
          persistedToDb = true;
          saveMediaToLibrary({
            id: recordId,
            kind: 'video',
            name: file.name,
            blob: file,
            durationSec,
            durationLabel,
            createdAt: Date.now() - idx,
          }).catch(() => {});
        };

        setSessionMedia((prev) => [
          {
            id: recordId,
            kind: 'video',
            name: file.name,
            url,
            durationSec: defaultDur,
            durationLabel: 'VIDEO',
            isUserSaved: true,
          },
          ...prev,
        ]);
        // Add immediately & synchronously to timeline (never wait for mobile metadata events)
        onAddLayer('video', {
          id: layerId,
          mediaUrl: url,
          name: file.name,
          durationSeconds: defaultDur,
          audioConfig: { src: url, volume: 1, muted: false },
        });

        // Probe actual duration in background and persist video blob once after metadata settles or fallback timeout
        const tempVid = document.createElement('video');
        tempVid.preload = 'metadata';
        tempVid.muted = true;
        tempVid.playsInline = true;
        let settled = false;
        const cleanupTemp = () => {
          if (settled) return;
          settled = true;
          tempVid.onloadedmetadata = null;
          tempVid.onerror = null;
          try {
            tempVid.removeAttribute('src');
            tempVid.load();
          } catch {}
        };
        const timeout = window.setTimeout(() => {
          cleanupTemp();
          persistVideoRecord(defaultDur, 'VIDEO');
        }, 1500);
        tempVid.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          const vidDuration = tempVid.duration;
          cleanupTemp();
          if (Number.isFinite(vidDuration) && vidDuration > 0.1) {
            const label = formatAudioDuration(vidDuration);
            onUpdateLayerDuration?.(layerId, vidDuration);
            window.setTimeout(() => persistVideoRecord(vidDuration, label), 60);
            setSessionMedia((prev) =>
              prev.map((m) =>
                m.id === recordId ? { ...m, durationSec: vidDuration, durationLabel: label } : m
              )
            );
          } else {
            window.setTimeout(() => persistVideoRecord(defaultDur, 'VIDEO'), 60);
          }
        };
        tempVid.onerror = () => {
          window.clearTimeout(timeout);
          cleanupTemp();
          window.setTimeout(() => persistVideoRecord(defaultDur, 'VIDEO'), 60);
        };
        tempVid.src = url;
      } else if (isAudio) {
        const recordId = `user-aud-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;
        const defaultDur = 15;
        const gradient = 'from-emerald-600/80 via-slate-800/90 to-zinc-950';
        const waveformBars = [35, 65, 50, 82, 46, 88, 60, 74, 40, 85, 58, 70, 44, 78, 52, 36];
        saveAudioToLibrary({
          id: recordId,
          title: file.name,
          blob: file,
          durationSec: defaultDur,
          durationLabel: formatAudioDuration(defaultDur),
          gradient,
          waveformBars,
          createdAt: Date.now() - idx,
        }).catch(() => {});
        setSessionAudio((prev) => [
          {
            id: recordId,
            title: file.name,
            durationSec: defaultDur,
            durationLabel: formatAudioDuration(defaultDur),
            gradient,
            waveformBars,
            url,
            isUserSaved: true,
          },
          ...prev,
        ]);
        // Add immediately & synchronously to timeline
        onAddLayer('audio', {
          id: layerId,
          audioConfig: { src: url, volume: 1, muted: false },
          name: file.name,
          durationSeconds: defaultDur,
        });

        const tempAud = new Audio();
        tempAud.preload = 'metadata';
        let settled = false;
        const cleanupTemp = () => {
          if (settled) return;
          settled = true;
          tempAud.onloadedmetadata = null;
          tempAud.onerror = null;
          try {
            tempAud.removeAttribute('src');
            tempAud.load();
          } catch {}
        };
        const timeout = window.setTimeout(cleanupTemp, 4500);
        tempAud.onloadedmetadata = () => {
          window.clearTimeout(timeout);
          const audDuration = tempAud.duration;
          cleanupTemp();
          if (Number.isFinite(audDuration) && audDuration > 0.1) {
            const label = formatAudioDuration(audDuration);
            onUpdateLayerDuration?.(layerId, audDuration);
            saveAudioToLibrary({
              id: recordId,
              title: file.name,
              blob: file,
              durationSec: audDuration,
              durationLabel: label,
              gradient,
              waveformBars,
              createdAt: Date.now() - idx,
            }).catch(() => {});
            setSessionAudio((prev) =>
              prev.map((a) =>
                a.id === recordId ? { ...a, durationSec: audDuration, durationLabel: label } : a
              )
            );
          }
        };
        tempAud.onerror = () => {
          window.clearTimeout(timeout);
          cleanupTemp();
        };
        tempAud.src = url;
      } else {
        const recordId = `user-img-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`;
        saveMediaToLibrary({
          id: recordId,
          kind: 'image',
          name: file.name,
          blob: file,
          createdAt: Date.now() - idx,
        }).catch(() => {});
        setSessionMedia((prev) => [
          {
            id: recordId,
            kind: 'image',
            name: file.name,
            url,
            isUserSaved: true,
          },
          ...prev,
        ]);
        onAddLayer('image', { id: layerId, mediaUrl: url, name: file.name });
      }
    });

    onClose();
  };

  const togglePreviewTrack = (trackId: string, url: string) => {
    if (previewAudioId === trackId) {
      stopAudioPreview();
      return;
    }
    stopAudioPreview();
    const audioEl = new Audio(url);
    audioEl.loop = false;
    audioEl.onended = () => setPreviewAudioId(null);
    audioEl.play().catch(() => {});
    previewAudioRef.current = audioEl;
    setPreviewAudioId(trackId);
  };

  const shapesGrid = [
    {
      id: 'thumbsup',
      labelAr: 'إعجاب',
      icon: <ThumbsUp className="w-5 h-5 text-[#00E676]" />,
      action: () => onAddLayer('vector', { type: 'heart', width: 340, height: 340, fill: '#00E676', stroke: '#00FF87', strokeWidth: 4 }),
    },
    {
      id: 'flag',
      labelAr: 'علم',
      icon: <Flag className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'rect', width: 380, height: 240, fill: '#38BDF8', stroke: '#60A5FA', strokeWidth: 2 }),
    },
    {
      id: 'check',
      labelAr: 'موافق',
      icon: <Check className="w-5 h-5 text-[#00E676]" />,
      action: () => onAddLayer('vector', { type: 'circle', width: 340, height: 340, fill: '#00E676', stroke: '#00FF87', strokeWidth: 4 }),
    },
    {
      id: 'shield',
      labelAr: 'درع',
      icon: <Shield className="w-5 h-5 text-[#38BDF8]" />,
      action: () => onAddLayer('vector', { type: 'shield', width: 320, height: 380, fill: '#38BDF8', stroke: '#60A5FA', strokeWidth: 3 }),
    },
    {
      id: 'snowflake',
      labelAr: 'ثلج',
      icon: <Snowflake className="w-5 h-5 text-cyan-300" />,
      action: () => onAddLayer('vector', { type: 'star', sides: 6, width: 340, height: 340, innerRadiusRatio: 0.3, fill: '#67E8F9', stroke: '#A5F3FC', strokeWidth: 3 }),
    },
    {
      id: 'drop',
      labelAr: 'قطرة',
      icon: <Droplet className="w-5 h-5 text-blue-400" />,
      action: () => onAddLayer('vector', { type: 'drop', width: 280, height: 380, fill: '#60A5FA', stroke: '#93C5FD', strokeWidth: 3 }),
    },
    {
      id: 'speech',
      labelAr: 'محادثة',
      icon: <MessageSquare className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'speech', width: 380, height: 260, fill: '#1E293B', stroke: '#38BDF8', strokeWidth: 4 }),
    },
    {
      id: 'triangle',
      labelAr: 'مثلث',
      icon: <Triangle className="w-5 h-5 text-amber-400" />,
      action: () => onAddLayer('vector', { type: 'triangle', width: 340, height: 340, fill: '#F59E0B', stroke: '#FCD34D', strokeWidth: 4 }),
    },
    {
      id: 'ring',
      labelAr: 'حلقة',
      icon: <CircleDot className="w-5 h-5 text-[#00E676]" />,
      action: () => onAddLayer('vector', { type: 'ring', width: 340, height: 340, fill: '#00E676', stroke: '#00FF87', strokeWidth: 2 }),
    },
    {
      id: 'plus',
      labelAr: 'زائد',
      icon: <Plus className="w-5 h-5 text-[#00FF87]" />,
      action: () => onAddLayer('vector', { type: 'plus', width: 340, height: 340, fill: '#00FF87' }),
    },
    {
      id: 'square',
      labelAr: 'مربع',
      icon: <Square className="w-5 h-5 fill-slate-200 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'rect', width: 340, height: 340, fill: '#FFFFFF' }),
    },
    {
      id: 'circle',
      labelAr: 'دائرة',
      icon: <Circle className="w-5 h-5 fill-slate-200 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'circle', width: 340, height: 340, fill: '#FFFFFF' }),
    },
    {
      id: 'pointer',
      labelAr: 'مؤشر',
      icon: <Compass className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'arrow', width: 360, height: 260, fill: '#38BDF8' }),
    },
    {
      id: 'bookmark',
      labelAr: 'علامة',
      icon: <Bookmark className="w-5 h-5 text-rose-400" />,
      action: () => onAddLayer('vector', { type: 'rect', width: 240, height: 360, cornerRadius: 8, fill: '#F43F5E' }),
    },
    {
      id: 'diamond',
      labelAr: 'ماسة',
      icon: <Square className="w-5 h-5 text-cyan-400 rotate-45" />,
      action: () => onAddLayer('vector', { type: 'polygon', sides: 4, width: 340, height: 340, fill: '#22D3EE' }),
    },
    {
      id: 'arrow-r',
      labelAr: 'سهم',
      icon: <ArrowRight className="w-5 h-5 text-emerald-400" />,
      action: () => onAddLayer('vector', { type: 'arrow', width: 360, height: 240, fill: '#10B981' }),
    },
    {
      id: 'cloud',
      labelAr: 'سحابة',
      icon: <Cloud className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'cloud', width: 380, height: 240, fill: '#94A3B8' }),
    },
    {
      id: 'moon',
      labelAr: 'هلال',
      icon: <Moon className="w-5 h-5 text-amber-300" />,
      action: () => onAddLayer('vector', { type: 'crescent', width: 340, height: 340, fill: '#FCD34D' }),
    },
    {
      id: 'arrow-ur',
      labelAr: 'سهم مائل',
      icon: <ArrowUpRight className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'arrow', width: 360, height: 240, fill: '#00E676' }),
    },
    {
      id: 'flower',
      labelAr: 'زهرة',
      icon: <Flower2 className="w-5 h-5 text-pink-400" />,
      action: () => onAddLayer('vector', { type: 'star', sides: 8, width: 340, height: 340, innerRadiusRatio: 0.6, fill: '#F472B6' }),
    },
    {
      id: 'hexagon',
      labelAr: 'سداسي',
      icon: <Hexagon className="w-5 h-5 text-amber-400" />,
      action: () => onAddLayer('vector', { type: 'polygon', sides: 6, width: 340, height: 340, fill: '#F59E0B' }),
    },
    {
      id: 'plane',
      labelAr: 'طائرة',
      icon: <Plane className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'triangle', width: 340, height: 340, fill: '#38BDF8' }),
    },
    {
      id: 'pin',
      labelAr: 'دبوس',
      icon: <Pin className="w-5 h-5 text-rose-400" />,
      action: () => onAddLayer('vector', { type: 'circle', width: 340, height: 340, fill: '#F43F5E' }),
    },
    {
      id: 'puzzle',
      labelAr: 'لغز',
      icon: <Puzzle className="w-5 h-5 text-amber-400" />,
      action: () => onAddLayer('vector', { type: 'rect', width: 340, height: 340, cornerRadius: 16, fill: '#F59E0B' }),
    },
    {
      id: 'lightning',
      labelAr: 'برق',
      icon: <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />,
      action: () => onAddLayer('vector', { type: 'lightning', width: 260, height: 380, fill: '#FBBF24' }),
    },
    {
      id: 'heart',
      labelAr: 'قلب',
      icon: <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />,
      action: () => onAddLayer('vector', { type: 'heart', width: 340, height: 340, fill: '#EC4899' }),
    },
    {
      id: 'grid',
      labelAr: 'شبكة',
      icon: <Grid className="w-5 h-5 text-slate-200" />,
      action: () => onAddLayer('vector', { type: 'rect', width: 360, height: 260, fill: '#334155' }),
    },
    {
      id: 'star-5',
      labelAr: 'نجمة',
      icon: <Star className="w-5 h-5 text-amber-400 fill-amber-400" />,
      action: () => onAddLayer('vector', { type: 'star', sides: 5, width: 340, height: 340, fill: '#F59E0B' }),
    },
  ];

  // Staggered spring animation variants matching MotionPrimitives
  const containerVariants = staggerContainerVariants;
  const itemVariants = staggerItemVariants;

  const CategoryChevron = () =>
    isAr ? (
      <ChevronLeft className="w-3.5 h-3.5 text-slate-400/80" />
    ) : (
      <ChevronRight className="w-3.5 h-3.5 text-slate-400/80" />
    );

  const subViewTitles: Record<Exclude<SubView, 'main'>, string> = {
    media: isAr ? 'الوسائط' : 'Media',
    shapes: isAr ? 'الشكل' : 'Shapes',
    audio: isAr ? 'مقطع صوتي' : 'Audio',
    elements: isAr ? 'العنصر / المشروع' : 'Objects & Elements',
    presets: isAr ? 'النموذج' : 'Templates',
  };

  return (
    <>
      {/* Persistent hidden file inputs kept outside AnimatePresence & backdrop so .click() never bubbles to onClose and onChange is never lost on mobile */}
      <div className="hidden" onClick={(e) => e.stopPropagation()}>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,video/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif,.mp4,.mov,.webm,.mkv,.m4v,.3gp"
          multiple
          onClick={(e) => e.stopPropagation()}
          onChange={handleFileUpload}
        />
        <input
          type="file"
          ref={audioFileInputRef}
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.opus,.weba,.wma,.amr,.3ga"
          multiple
          onClick={(e) => e.stopPropagation()}
          onChange={handleFileUpload}
        />
        <input
          type="file"
          ref={mediaGalleryPermInputRef}
          accept="image/*,video/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.heic,.heif,.mp4,.mov,.webm,.mkv,.m4v,.3gp"
          multiple
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleGalleryPermFallbackChange('media', e)}
        />
        <input
          type="file"
          ref={(el) => {
            mediaFolderFallbackInputRef.current = el;
            if (el) {
              el.setAttribute('webkitdirectory', '');
              el.setAttribute('directory', '');
            }
          }}
          multiple
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleGalleryPermFallbackChange('media', e)}
        />
        <input
          type="file"
          ref={audioGalleryPermInputRef}
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.opus,.weba,.wma,.amr,.3ga"
          multiple
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleGalleryPermFallbackChange('audio', e)}
        />
        <input
          type="file"
          ref={modelFileInputRef}
          multiple
          onClick={(e) => e.stopPropagation()}
          onChange={handleModelUpload}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="editor-add-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-40 flex flex-col justify-end pb-[76px] sm:pb-[82px] px-3 select-none overflow-hidden gpu-layer"
          >
            {/* Ambient radial bottom glow matching active theme */}
            <div
              className="absolute bottom-0 inset-x-0 h-80 pointer-events-none filter blur-3xl"
              style={{
                background:
                  'linear-gradient(to top, rgba(var(--app-accent-rgb), 0.14), rgba(var(--app-accent-secondary-rgb), 0.08), rgba(var(--app-accent-tertiary-rgb), 0.05), transparent)',
              }}
            />

            {/* ================= 240HZ FLOATING BOTTOM SHEET ================= */}
          <motion.div
            key="editor-add-sheet"
            dir={isAr ? 'rtl' : 'ltr'}
            variants={bottomSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              willChange: 'transform, opacity',
              transform: 'translate3d(0,0,0)',
              boxShadow:
                '0 24px 60px rgba(0,0,0,0.85), 0 0 32px rgba(var(--app-accent-rgb), 0.09), inset 0 1px 1px rgba(255,255,255,0.12)',
            }}
            className="w-full max-w-lg mx-auto bg-[#17181A]/[0.98] border border-white/[0.08] rounded-[22px] p-3.5 sm:p-4 text-white relative overflow-hidden gpu-layer"
          >
            {/* Top Rim Light Sweep matching active theme */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] overflow-hidden pointer-events-none">
              <div
                className="w-1/2 h-full animate-panel-light-sweep"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(var(--app-accent-bright-rgb), 0.78), rgba(var(--app-accent-secondary-rgb), 0.75), rgba(var(--app-accent-tertiary-rgb), 0.7))',
                }}
              />
            </div>

            {/* Specular Inner Sheen */}
            <div className="absolute top-0 inset-x-4 h-14 bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-transparent rounded-t-[20px] pointer-events-none" />

            {/* 3D Model Loading Overlay */}
            {isLoadingModel && (
              <div className="absolute inset-0 bg-[#141518]/92 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[rgba(var(--app-accent-rgb),0.15)] border border-[rgba(var(--app-accent-bright-rgb),0.5)] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[var(--app-accent-bright)] animate-spin" />
                </div>
                <p className="text-xs font-bold text-slate-200">{loadingModelProgress}</p>
              </div>
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              {subView === 'main' ? (
                <motion.div
                  key="main-grid"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="relative z-10 space-y-2.5"
                >
                  {/* Header: "إضافة" */}
                  <motion.div variants={itemVariants} className="flex items-center justify-between px-1 pb-0.5">
                    <h3 className="text-[15px] font-bold text-white tracking-tight">
                      {isAr ? 'إضافة' : 'Add'}
                    </h3>
                  </motion.div>

                  {/* Row 1: 4 Equal Cards — الوسائط | النص | الشكل | مقطع صوتي */}
                  <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2">
                    {/* 1. الوسائط (Media) */}
                    <button
                      type="button"
                      onClick={() => setSubView('media')}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <span className={`absolute top-1.5 ${isAr ? 'left-1.5' : 'right-1.5'} opacity-75 group-hover:opacity-100 transition-opacity`}>
                        <CategoryChevron />
                      </span>
                      <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="4" width="15" height="12" rx="2" />
                        <path d="M3 8v10a2 2 0 0 0 2 2h12" />
                        <polygon points="12,8 16,10 12,12" fill="currentColor" stroke="none" />
                      </svg>
                      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'الوسائط' : 'Media'}
                      </span>
                    </button>

                    {/* 2. النص (Text) */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddLayer('text');
                        onClose();
                      }}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <span className="text-[18px] font-semibold tracking-tight text-slate-100 leading-none">
                        A<span className="text-[13px] align-super font-medium">a</span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'النص' : 'Text'}
                      </span>
                    </button>

                    {/* 3. الشكل (Shapes) */}
                    <button
                      type="button"
                      onClick={() => setSubView('shapes')}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <span className={`absolute top-1.5 ${isAr ? 'left-1.5' : 'right-1.5'} opacity-75 group-hover:opacity-100 transition-opacity`}>
                        <CategoryChevron />
                      </span>
                      <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="7.5" cy="7.5" r="3" />
                        <polygon points="16.5,4.5 20,10.5 13,10.5" />
                        <rect x="4.5" y="13.5" width="6" height="6" rx="1" />
                        <polygon points="16.5,13.5 19.5,15.7 18.4,19.3 14.6,19.3 13.5,15.7" />
                      </svg>
                      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'الشكل' : 'Shape'}
                      </span>
                    </button>

                    {/* 4. مقطع صوتي (Audio) */}
                    <button
                      type="button"
                      onClick={() => setSubView('audio')}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <span className={`absolute top-1.5 ${isAr ? 'left-1.5' : 'right-1.5'} opacity-75 group-hover:opacity-100 transition-opacity`}>
                        <CategoryChevron />
                      </span>
                      <Music className="w-[21px] h-[21px] text-slate-100 stroke-[1.65]" />
                      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'مقطع صوتي' : 'Audio'}
                      </span>
                    </button>
                  </motion.div>

                  {/* Row 2: 4 Equal Cards — رسم يدوي | رسم الخط المتجه | العنصر / المشروع | النموذج */}
                  <motion.div variants={itemVariants} className="grid grid-cols-4 gap-2">
                    {/* 5. رسم يدوي (Free Draw) */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddLayer('vector', { type: 'bezierPath', stroke: '#00E676', strokeWidth: 3 });
                        onClose();
                      }}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L10 16l-4 1 1-4 9.5-9.5z" />
                        <path d="M4 20c3-2 6 2 9 0s5-2 7 0" />
                      </svg>
                      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'رسم يدوي' : 'Free Draw'}
                      </span>
                    </button>

                    {/* 6. رسم الخط المتجه (Vector Path) */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddLayer('vector', { type: 'polygon', sides: 5, fill: '#00E676' });
                        onClose();
                      }}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                        <path d="M2 2l7.586 7.586" />
                        <circle cx="11" cy="11" r="2" />
                      </svg>
                      <span className="text-[10.5px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'رسم الخط المتجه' : 'Vector Draw'}
                      </span>
                    </button>

                    {/* 7. العنصر / المشروع (Element / Objects) */}
                    <button
                      type="button"
                      onClick={() => setSubView('elements')}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <span className={`absolute top-1.5 ${isAr ? 'left-1.5' : 'right-1.5'} opacity-75 group-hover:opacity-100 transition-opacity`}>
                        <CategoryChevron />
                      </span>
                      <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="9.5,5.5 15.5,16.5 3.5,16.5" />
                        <circle cx="15.5" cy="14" r="4.5" />
                      </svg>
                      <span className="text-[10.5px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'العنصر / المشروع' : 'Object / Element'}
                      </span>
                    </button>

                    {/* 8. النموذج (Template) */}
                    <button
                      type="button"
                      onClick={() => setSubView('presets')}
                      className="relative h-[68px] bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[12px] flex flex-col items-center justify-center gap-1.5 px-1 transition-all cursor-pointer group"
                    >
                      <span className={`absolute top-1.5 ${isAr ? 'left-1.5' : 'right-1.5'} opacity-75 group-hover:opacity-100 transition-opacity`}>
                        <CategoryChevron />
                      </span>
                      <svg className="w-[21px] h-[21px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2.5" />
                        <line x1="4" y1="10" x2="20" y2="10" />
                        <line x1="12" y1="10" x2="12" y2="20" />
                      </svg>
                      <span className="text-[11px] font-medium text-slate-200 truncate max-w-full">
                        {isAr ? 'النموذج' : 'Template'}
                      </span>
                    </button>
                  </motion.div>

                  {/* Row 3: 3 Compact Horizontal Action Bars — الكاميرا | فارغ | مجموعة فارغة */}
                  <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2">
                    {/* 9. الكاميرا (Camera) */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddLayer('camera', { name: isAr ? 'كاميرا 3D' : '3D Camera' });
                        onClose();
                      }}
                      className="h-10 bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[11px] flex items-center justify-center gap-1.5 px-2 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-slate-200 stroke-[1.7] shrink-0" />
                      <span className="text-[11.5px] font-medium text-slate-200 truncate">
                        {isAr ? 'الكاميرا' : 'Camera'}
                      </span>
                      {/* Signature subtle dark/themed lens sphere badge */}
                      <span
                        aria-hidden="true"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(var(--app-accent-bright-rgb), 0.55), var(--app-accent-deep), #0f172a)',
                          borderColor: 'rgba(var(--app-accent-bright-rgb), 0.45)',
                          boxShadow: '0 0 6px rgba(var(--app-accent-rgb), 0.3)',
                        }}
                        className="w-3.5 h-3.5 rounded-full border shrink-0"
                      />
                    </button>

                    {/* 10. فارغ (Blank / Empty Null) */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddLayer('null', { name: isAr ? 'فارغ' : 'Blank' });
                        onClose();
                      }}
                      className="h-10 bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[11px] flex items-center justify-center gap-1.5 px-2 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                        <line x1="6" y1="18" x2="18" y2="6" />
                      </svg>
                      <span className="text-[11.5px] font-medium text-slate-200 truncate">
                        {isAr ? 'فارغ' : 'Null'}
                      </span>
                    </button>

                    {/* 11. مجموعة فارغة (Empty Group) */}
                    <button
                      type="button"
                      onClick={() => {
                        onAddLayer('group', { name: isAr ? 'مجموعة جديدة' : 'New Group', color: '#38BDF8' });
                        onClose();
                      }}
                      className="h-10 bg-[#222326] hover:bg-[#2A2C30] active:scale-95 rounded-[11px] flex items-center justify-center gap-1.5 px-2 transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-slate-200 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 2.5">
                        <rect x="4" y="4" width="16" height="16" rx="2.5" />
                      </svg>
                      <span className="text-[11px] font-medium text-slate-200 truncate">
                        {isAr ? 'مجموعة فارغة' : 'Empty Group'}
                      </span>
                    </button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key={`subview-${subView}`}
                  initial={{ opacity: 0, x: isAr ? -48 : 48, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
                  exit={{ opacity: 0, x: isAr ? 28 : -28, scale: 0.96, transition: { duration: 0.13, ease: [0.22, 1, 0.36, 1] } }}
                  className="relative z-10 space-y-3"
                >
                  {/* Sub-view Header with Back Button */}
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <button
                      type="button"
                      onClick={() => setSubView('main')}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#222326] hover:bg-[#2E3035] text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                    >
                      {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                      <span>{subViewTitles[subView]}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {subView === 'media' && (
                        <>
                          {supportsFolderInput && (
                            <button
                              type="button"
                              onClick={() =>
                                supportsNativeDirectoryPicker()
                                  ? handleRequestDeviceGalleryAccess('media', mediaPermState === 'granted')
                                  : mediaFolderFallbackInputRef.current?.click()
                              }
                              disabled={isRequestingDevicePerm}
                              className="h-7 px-2 rounded-lg bg-[#222326] hover:bg-[#2E3035] text-slate-200 text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title={isAr ? 'مزامنة مجلد من الجهاز' : 'Sync device folder'}
                            >
                              {isRequestingDevicePerm ? (
                                <Loader2 className="w-3.5 h-3.5 text-[var(--app-accent-bright)] animate-spin" />
                              ) : (
                                <FolderOpen className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
                              )}
                              <span className="hidden sm:inline">{isAr ? 'مجلد' : 'Folder'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const nextTab = mediaSourceTab === 'online' ? 'library' : 'online';
                              setMediaSourceTab(nextTab);
                              if (nextTab === 'online' && onlineMediaResults.length === 0) {
                                setLoadingOnlineMedia(true);
                                fetch(`/api/online/media?q=${encodeURIComponent(onlineMediaQuery)}&kind=${onlineMediaKind}`)
                                  .then((r) => r.json())
                                  .then((d) => setOnlineMediaResults(Array.isArray(d?.items) ? d.items : []))
                                  .catch(() => {})
                                  .finally(() => setLoadingOnlineMedia(false));
                              }
                            }}
                            className={`h-7 px-2 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                              mediaSourceTab === 'online'
                                ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                                : 'bg-[#222326] hover:bg-[#2E3035] border-white/[0.06] text-slate-200'
                            }`}
                            title={isAr ? 'البحث عن صور وفيديو من الإنترنت' : 'Search Online Stock Media'}
                          >
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                            <span>{isAr ? 'الإنترنت' : 'Online'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => mediaGalleryPermInputRef.current?.click()}
                            className="h-7 px-2 rounded-lg bg-[#222326] hover:bg-[#2E3035] text-slate-200 text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title={isAr ? 'إضافة صور وفيديو للمعرض الداخلي' : 'Import to in-app gallery'}
                          >
                            <Plus className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
                            <span>{isAr ? 'استيراد' : 'Import'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowMediaUrlBox((v) => !v)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              showMediaUrlBox
                                ? 'bg-[#32343A] text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                            title={isAr ? 'إضافة عبر رابط' : 'Add from URL'}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        aria-label={isAr ? 'إغلاق' : 'Close'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {modelError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs font-medium">
                      {modelError}
                    </div>
                  )}

                  {/* SUB-VIEW: SHAPES */}
                  {subView === 'shapes' && (
                    <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-0.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={`shapes-page-${shapePage}`}
                          variants={staggerFastContainerVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, transition: { duration: 0.09 } }}
                          className="grid grid-cols-6 sm:grid-cols-7 gap-2"
                        >
                          {shapesGrid.map((s) => (
                            <motion.button
                              key={s.id}
                              variants={staggerItemVariants}
                              whileTap={{ scale: 0.9 }}
                              type="button"
                              onClick={() => {
                                s.action();
                                onClose();
                              }}
                              className="h-11 bg-[#222326] hover:bg-[rgba(var(--app-accent-rgb),0.18)] border border-white/[0.05] hover:border-[var(--app-accent-bright)] rounded-xl flex items-center justify-center transition-colors group cursor-pointer"
                              title={s.labelAr}
                            >
                              <div className="group-hover:scale-110 transition-transform">{s.icon}</div>
                            </motion.button>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                      <div className="flex justify-center items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setShapePage(0)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            shapePage === 0 ? 'bg-[var(--app-accent-bright)] w-4' : 'bg-slate-600 w-1.5'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShapePage(1)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            shapePage === 1 ? 'bg-[var(--app-accent-bright)] w-4' : 'bg-slate-600 w-1.5'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW: MEDIA — Authentic Alight Motion Split In-App Gallery (Album Sidebar + 4-Col Scrollable Grid) */}
                  {subView === 'media' && (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {showMediaUrlBox && (
                          <motion.div
                            variants={dropdownVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="bg-[#222326] p-1.5 rounded-xl border border-white/[0.06] flex gap-1.5"
                          >
                            <input
                              type="url"
                              value={mediaUrlInput}
                              onChange={(e) => setMediaUrlInput(e.target.value)}
                              placeholder="https://... (Image / Video URL)"
                              className="flex-1 bg-[#141518] border border-white/10 px-2.5 py-1 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-[var(--app-accent-bright)]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!mediaUrlInput) return;
                                const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrlInput);
                                const safeUrl = /^https?:\/\//i.test(mediaUrlInput)
                                  ? `/api/online/proxy?url=${encodeURIComponent(mediaUrlInput)}`
                                  : mediaUrlInput;
                                onAddLayer(isVideo ? 'video' : 'image', { mediaUrl: safeUrl });
                                setMediaUrlInput('');
                                onClose();
                              }}
                              className="px-3 py-1 bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-bold rounded-lg text-xs cursor-pointer"
                            >
                              {isAr ? 'إضافة' : 'Add'}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {mediaSourceTab === 'online' ? (
                        <div className="space-y-2">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setLoadingOnlineMedia(true);
                              fetch(`/api/online/media?q=${encodeURIComponent(onlineMediaQuery)}&kind=${onlineMediaKind}`)
                                .then((r) => r.json())
                                .then((d) => setOnlineMediaResults(Array.isArray(d?.items) ? d.items : []))
                                .catch(() => setOnlineMediaResults([]))
                                .finally(() => setLoadingOnlineMedia(false));
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-2.5" />
                              <input
                                type="text"
                                value={onlineMediaQuery}
                                onChange={(e) => setOnlineMediaQuery(e.target.value)}
                                placeholder={isAr ? 'ابحث في الإنترنت (مثال: neon, nature, space)...' : 'Search online photos & videos...'}
                                className="w-full ps-8 pe-3 py-1.5 rounded-lg bg-[#141518] border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                              />
                            </div>
                            <select
                              value={onlineMediaKind}
                              onChange={(e) => setOnlineMediaKind(e.target.value as 'all' | 'image' | 'video')}
                              className="h-8 px-2 rounded-lg bg-[#1D1E22] border border-white/10 text-[11px] text-slate-200"
                            >
                              <option value="all">{isAr ? 'الكل' : 'All'}</option>
                              <option value="image">{isAr ? 'صور' : 'Photos'}</option>
                              <option value="video">{isAr ? 'فيديو' : 'Videos'}</option>
                            </select>
                            <button
                              type="submit"
                              disabled={loadingOnlineMedia}
                              className="h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              {loadingOnlineMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isAr ? 'بحث' : 'Go')}
                            </button>
                          </form>

                          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                            {['neon city', 'abstract 3d', 'space galaxy', 'nature sunset', 'minimal texture', 'fire sparks'].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  setOnlineMediaQuery(tag);
                                  setLoadingOnlineMedia(true);
                                  fetch(`/api/online/media?q=${encodeURIComponent(tag)}&kind=${onlineMediaKind}`)
                                    .then((r) => r.json())
                                    .then((d) => setOnlineMediaResults(Array.isArray(d?.items) ? d.items : []))
                                    .catch(() => {})
                                    .finally(() => setLoadingOnlineMedia(false));
                                }}
                                className="px-2 py-0.5 rounded-md bg-[#222326] hover:bg-[#2E3036] border border-white/10 text-[10px] text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>

                          <div className="h-[235px] overflow-y-auto pr-0.5">
                            {loadingOnlineMedia ? (
                              <div className="h-full flex items-center justify-center gap-2 text-xs text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                <span>{isAr ? 'جاري البحث عبر الإنترنت...' : 'Searching online library...'}</span>
                              </div>
                            ) : onlineMediaResults.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                                {isAr ? 'اكتب كلمة للبحث عن صور وفيديوهات مجانية' : 'Search above for free online stock media'}
                              </div>
                            ) : (
                              <div className="grid grid-cols-4 gap-1.5">
                                {onlineMediaResults.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      if (item.kind === 'video') {
                                        onAddLayer('video', {
                                          mediaUrl: item.proxyUrl,
                                          name: item.title,
                                          durationSeconds: item.durationSec || 15,
                                          audioConfig: { src: item.proxyUrl, volume: 1, muted: false },
                                        });
                                      } else {
                                        onAddLayer('image', { mediaUrl: item.proxyUrl, name: item.title });
                                      }
                                      onClose();
                                    }}
                                    className="aspect-square rounded-[6px] overflow-hidden relative bg-[#1D1E21] border border-white/10 hover:border-sky-400 group cursor-pointer"
                                    title={`${item.title} (${item.source})`}
                                  >
                                    {item.kind === 'video' ? (
                                      <MediaVideoTile
                                        url={item.proxyUrl}
                                        initialPoster={item.thumbUrl || undefined}
                                        initialDurationLabel={item.durationSec ? formatAudioDuration(item.durationSec) : 'VIDEO'}
                                        alt={item.title}
                                      />
                                    ) : (
                                      <img
                                        src={item.thumbUrl || item.proxyUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                                      />
                                    )}
                                    <span className="absolute top-1 start-1 px-1 py-0.2 rounded bg-black/70 text-[8px] font-mono text-sky-300">
                                      {item.source}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                      (() => {
                        const seenKeys = new Set<string>();
                        const combinedDeviceAndSaved: SessionMediaItem[] = [];
                        [...deviceFolderMedia, ...sessionMedia, ...projectSavedMedia].forEach((m) => {
                          const key = `${m.kind}:${m.name}:${m.url.slice(0, 64)}`;
                          if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            combinedDeviceAndSaved.push(m);
                          }
                        });

                        const builtinAll: SessionMediaItem[] = [
                          ...builtinVideos.map((v) => ({
                            ...v,
                            albumName: isAr ? 'مكتبة التطبيق' : 'App Library',
                          })),
                          ...BUILTIN_MEDIA_GALLERY.map((img) => ({
                            ...img,
                            albumName: isAr ? 'مكتبة التطبيق' : 'App Library',
                          })),
                        ];

                        const allMediaPool: SessionMediaItem[] = [
                          ...combinedDeviceAndSaved,
                          ...builtinAll,
                        ];

                        // Extract unique folder/album names
                        const albumCounts = new Map<string, number>();
                        allMediaPool.forEach((m) => {
                          if (m.albumName) {
                            albumCounts.set(m.albumName, (albumCounts.get(m.albumName) || 0) + 1);
                          }
                        });
                        const customAlbums = Array.from(albumCounts.entries());

                        const filteredMedia = allMediaPool.filter((item) => {
                          if (selectedMediaAlbum === 'all') return true;
                          if (selectedMediaAlbum === 'video') return item.kind === 'video';
                          if (selectedMediaAlbum === 'image') return item.kind === 'image';
                          return item.albumName === selectedMediaAlbum;
                        });

                        const showCompactSyncChip =
                          combinedDeviceAndSaved.length === 0 &&
                          mediaPermState !== 'granted' &&
                          !mediaPermDismissed;

                        return (
                          <div className="space-y-1.5">
                            {/* Slim non-blocking sync bar only if no device/saved media yet */}
                            <AnimatePresence>
                              {showCompactSyncChip && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.16 }}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--app-accent-surface)] border border-[rgba(var(--app-accent-rgb),0.35)] text-[10.5px]"
                                >
                                  <span className="text-[var(--app-accent-light)] truncate font-medium">
                                    {isAr
                                      ? 'أظهر صور وفيديوهات جهازك هنا دون فتح الملفات كل مرة'
                                      : 'Sync device photos & videos here once'}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleRequestDeviceGalleryAccess('media', false)}
                                      className="px-2 py-0.5 rounded-md bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] text-[10px] font-extrabold cursor-pointer"
                                    >
                                      {isAr ? 'مزامنة الآن' : 'Sync'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMediaPermDismissed(true)}
                                      className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                                      aria-label={isAr ? 'إخفاء' : 'Dismiss'}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {galleryNotice?.scope === 'media' && galleryNotice.count > 0 && (
                              <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-[var(--app-accent-surface)] border border-[rgba(var(--app-accent-rgb),0.4)] text-[10.5px] text-[var(--app-accent-light)]">
                                <span className="truncate font-medium">
                                  {isAr
                                    ? `تم تحميل ${galleryNotice.count} عنصر في المعرض الداخلي`
                                    : `Loaded ${galleryNotice.count} items into gallery`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setGalleryNotice(null)}
                                  className="text-slate-300 hover:text-white cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {loadingBuiltinVideos && builtinVideos.length === 0 && (
                              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#222326] text-[10px] text-slate-300">
                                <Loader2 className="w-3 h-3 text-[var(--app-accent-bright)] animate-spin shrink-0" />
                                <span>
                                  {isAr ? 'جارٍ تجهيز معاينة مقاطع الفيديو...' : 'Preparing video previews...'}
                                </span>
                              </div>
                            )}

                            {/* Split Alight Motion Layout: Vertical Album Sidebar + 4-Col Gallery Grid */}
                            <div
                              className={`flex gap-1.5 transition-all duration-200 ${
                                expandMediaAll ? 'h-[60dvh] max-h-[520px]' : 'h-[245px] sm:h-[265px]'
                              }`}
                            >
                              {/* Start Sidebar Column (Grid Toggle + Album Selector matching video) */}
                              <div className="w-[74px] sm:w-[82px] shrink-0 flex flex-col gap-1.5 min-h-0">
                                {/* Top Square Grid / Expand Button */}
                                <button
                                  type="button"
                                  onClick={() => setExpandMediaAll((prev) => !prev)}
                                  className={`h-[66px] rounded-[9px] flex flex-col items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer border ${
                                    expandMediaAll
                                      ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.5)] text-[var(--app-accent-bright)]'
                                      : 'bg-[#222326] hover:bg-[#2B2D32] border-white/[0.05] text-slate-100'
                                  }`}
                                  title={expandMediaAll ? (isAr ? 'تصغير العرض' : 'Collapse') : (isAr ? 'توسيع العرض' : 'Expand')}
                                >
                                  <LayoutGrid className="w-5 h-5 stroke-[1.75]" />
                                  <span className="text-[9.5px] font-semibold">
                                    {expandMediaAll ? (isAr ? 'تصغير' : 'Less') : (isAr ? 'توسيع' : 'Expand')}
                                  </span>
                                </button>

                                {/* Scrollable Albums / Categories Stack */}
                                <div className="flex-1 overflow-y-auto scrollbar-none space-y-1 pr-0.5 min-h-0">
                                  {(
                                    [
                                      { id: 'all', label: isAr ? 'الكل' : 'All', count: allMediaPool.length },
                                      {
                                        id: 'video',
                                        label: isAr ? 'فيديو' : 'Video',
                                        count: allMediaPool.filter((m) => m.kind === 'video').length,
                                      },
                                      {
                                        id: 'image',
                                        label: isAr ? 'صور' : 'Photos',
                                        count: allMediaPool.filter((m) => m.kind === 'image').length,
                                      },
                                    ] as const
                                  ).map((tab) => {
                                    const active = selectedMediaAlbum === tab.id;
                                    return (
                                      <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedMediaAlbum(tab.id)}
                                        className={`w-full py-2 px-1.5 rounded-[8px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer border ${
                                          active
                                            ? 'bg-[#2E3036] border-white/15 text-white'
                                            : 'bg-[#1D1E22] hover:bg-[#25262B] border-transparent text-slate-400 hover:text-slate-200'
                                        }`}
                                      >
                                        <span className="text-[11px] font-bold truncate max-w-full">
                                          {tab.label}
                                        </span>
                                        <span className="text-[9px] font-mono opacity-65 tabular-nums">
                                          {tab.count}
                                        </span>
                                      </button>
                                    );
                                  })}

                                  {customAlbums.map(([album, count]) => {
                                    const active = selectedMediaAlbum === album;
                                    return (
                                      <button
                                        key={album}
                                        type="button"
                                        onClick={() => setSelectedMediaAlbum(album)}
                                        className={`w-full py-2 px-1 rounded-[8px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer border ${
                                          active
                                            ? 'bg-[#2E3036] border-white/15 text-white'
                                            : 'bg-[#1D1E22] hover:bg-[#25262B] border-transparent text-slate-400 hover:text-slate-200'
                                        }`}
                                        title={album}
                                      >
                                        <span className="text-[10px] font-semibold truncate max-w-full px-0.5">
                                          {album}
                                        </span>
                                        <span className="text-[8.5px] font-mono opacity-60 tabular-nums">
                                          {count}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 4-Column Edge-to-Edge Thumbnail Grid */}
                              <div
                                ref={mediaGridRef}
                                className="flex-1 min-w-0 overflow-y-auto overscroll-contain pr-0.5"
                              >
                                <div className="grid grid-cols-4 gap-1">
                                  {filteredMedia.map((item) => (
                                    <div
                                      key={item.id}
                                      className="aspect-square rounded-[5px] overflow-hidden relative bg-[#1D1E21] group"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (item.kind === 'video') {
                                            onAddLayer('video', {
                                              mediaUrl: item.url,
                                              name: item.name,
                                              durationSeconds: item.durationSec,
                                              audioConfig: { src: item.url, volume: 1, muted: false },
                                            });
                                          } else {
                                            onAddLayer('image', { mediaUrl: item.url, name: item.name });
                                          }
                                          onClose();
                                        }}
                                        className="w-full h-full relative block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent-bright)]"
                                        title={item.name}
                                      >
                                        {item.kind === 'video' ? (
                                          <MediaVideoTile
                                            url={item.url}
                                            initialPoster={item.posterUrl}
                                            initialDurationLabel={item.durationLabel}
                                            alt={item.name}
                                            onResolved={(posterUrl, durationSec, durationLabel) => {
                                              setSessionMedia((prev) =>
                                                prev.map((m) =>
                                                  m.id === item.id
                                                    ? {
                                                        ...m,
                                                        posterUrl: posterUrl || m.posterUrl,
                                                        durationSec: durationSec || m.durationSec,
                                                        durationLabel: durationLabel || m.durationLabel,
                                                      }
                                                    : m
                                                )
                                              );
                                            }}
                                          />
                                        ) : (
                                          <img
                                            src={item.url}
                                            alt={item.name}
                                            loading="lazy"
                                            draggable={false}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                                          />
                                        )}
                                      </button>

                                      {item.isUserSaved && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteMediaFromLibrary(item.id);
                                            setSessionMedia((prev) => prev.filter((m) => m.id !== item.id));
                                            setDeviceFolderMedia((prev) => prev.filter((m) => m.id !== item.id));
                                          }}
                                          className="absolute top-1 end-1 z-10 w-5 h-5 rounded-md bg-black/70 hover:bg-rose-600 text-white/85 hover:text-white flex items-center justify-center opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                                          title={isAr ? 'حذف من المكتبة' : 'Remove'}
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}

                                  {/* Quick Add Card at end of grid */}
                                  <button
                                    type="button"
                                    onClick={() => mediaGalleryPermInputRef.current?.click()}
                                    className="aspect-square rounded-[5px] bg-[#222326] hover:bg-[#2B2D32] border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-slate-300 transition-colors cursor-pointer"
                                    title={isAr ? 'إضافة المزيد من الجهاز' : 'Add more from device'}
                                  >
                                    <Plus className="w-5 h-5 text-[var(--app-accent-bright)]" />
                                    <span className="text-[9px] font-semibold text-center px-1 leading-tight">
                                      {isAr ? 'إضافة' : 'Add'}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW: AUDIO — Permission-based direct device audio + built-in gradient waveform tracks */}
                  {subView === 'audio' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="text-[10.5px] text-slate-400 truncate">
                          {isAr
                            ? 'اضغط للاستماع و + لإضافته مباشرة للتايم لاين'
                            : 'Tap to preview, + to add directly to timeline'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const nextTab = audioSourceTab === 'online' ? 'library' : 'online';
                              setAudioSourceTab(nextTab);
                              if (nextTab === 'online' && onlineAudioResults.length === 0) {
                                setLoadingOnlineAudio(true);
                                fetch(`/api/online/audio?q=${encodeURIComponent(onlineAudioQuery)}`)
                                  .then((r) => r.json())
                                  .then((d) => setOnlineAudioResults(Array.isArray(d?.items) ? d.items : []))
                                  .catch(() => {})
                                  .finally(() => setLoadingOnlineAudio(false));
                              }
                            }}
                            className={`h-7 px-2 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                              audioSourceTab === 'online'
                                ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                                : 'bg-[#222326] hover:bg-[#2E3035] border-white/[0.08] text-slate-200'
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                            <span>{isAr ? 'صوتيات الإنترنت' : 'Online Audio'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDeviceGalleryAccess('audio', audioPermState === 'granted')}
                            disabled={isRequestingDevicePerm}
                            className={`h-7 px-2 rounded-lg text-[10.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              audioPermState === 'granted'
                                ? 'bg-[var(--app-accent-surface)] border border-[rgba(var(--app-accent-rgb),0.4)] text-[var(--app-accent-bright)] hover:bg-[var(--app-accent-surface-hover)]'
                                : 'bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)]'
                            }`}
                            title={
                              audioFolderName
                                ? `${isAr ? 'مجلد الصوتيات:' : 'Folder:'} ${audioFolderName}`
                                : isAr
                                ? 'السماح بعرض صوتيات الجهاز مباشرة'
                                : 'Allow device audio access'
                            }
                          >
                            {isRequestingDevicePerm ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : audioPermState === 'granted' ? (
                              <RefreshCw className="w-3 h-3" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {audioPermState === 'granted'
                                ? isAr
                                  ? 'تحديث الجهاز'
                                  : 'Sync Device'
                                : isAr
                                ? 'السماح بالصوتيات'
                                : 'Allow Audio'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => audioFileInputRef.current?.click()}
                            className="h-7 px-2.5 rounded-lg bg-[#222326] hover:bg-[#2E3036] border border-white/[0.08] text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
                            <span>{isAr ? 'رفع مباشر' : 'Upload'}</span>
                          </button>
                        </div>
                      </div>

                      {audioSourceTab === 'online' ? (
                        <div className="space-y-2">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              setLoadingOnlineAudio(true);
                              fetch(`/api/online/audio?q=${encodeURIComponent(onlineAudioQuery)}`)
                                .then((r) => r.json())
                                .then((d) => setOnlineAudioResults(Array.isArray(d?.items) ? d.items : []))
                                .catch(() => setOnlineAudioResults([]))
                                .finally(() => setLoadingOnlineAudio(false));
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-2.5" />
                              <input
                                type="text"
                                value={onlineAudioQuery}
                                onChange={(e) => setOnlineAudioQuery(e.target.value)}
                                placeholder={isAr ? 'ابحث عن موسيقى أو مؤثرات صوتية عبر الإنترنت...' : 'Search online music & SFX...'}
                                className="w-full ps-8 pe-3 py-1.5 rounded-lg bg-[#141518] border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={loadingOnlineAudio}
                              className="h-8 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                            >
                              {loadingOnlineAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isAr ? 'بحث' : 'Search')}
                            </button>
                          </form>

                          <div className="h-[210px] overflow-y-auto space-y-1.5 pr-0.5">
                            {loadingOnlineAudio ? (
                              <div className="h-full flex items-center justify-center gap-2 text-xs text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                <span>{isAr ? 'جاري البحث عن الصوتيات...' : 'Searching online audio...'}</span>
                              </div>
                            ) : onlineAudioResults.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                                {isAr ? 'اكتب اسماً أو نوع موسيقى للبحث' : 'Search for tracks or sound effects'}
                              </div>
                            ) : (
                              onlineAudioResults.map((track) => {
                                const isPreviewing = previewAudioId === track.id;
                                return (
                                  <div
                                    key={track.id}
                                    className={`p-2 rounded-xl bg-[#1D1E22] border flex items-center justify-between gap-2 ${
                                      isPreviewing ? 'border-sky-400' : 'border-white/10'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => togglePreviewTrack(track.id, track.proxyUrl)}
                                      className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0 cursor-pointer"
                                    >
                                      {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-white truncate">{track.title}</div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {track.artist || track.source} · {track.durationLabel}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        stopAudioPreview();
                                        onAddLayer('audio', {
                                          audioConfig: {
                                            src: track.proxyUrl,
                                            volume: 1,
                                            muted: false,
                                          },
                                          name: track.title,
                                          durationSeconds: track.durationSec,
                                        });
                                        onClose();
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>{isAr ? 'إضافة' : 'Add'}</span>
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ) : (
                        <>

                      {/* Direct Device Audio Permission Card */}
                      <AnimatePresence>
                        {audioPermState !== 'granted' && !audioPermDismissed && (
                          <motion.div
                            variants={staggerItemVariants}
                            initial="hidden"
                            animate="visible"
                            exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                            style={{
                              background:
                                'linear-gradient(135deg, var(--app-accent-surface), #1C2124, #17181B)',
                            }}
                            className="rounded-xl border border-[rgba(var(--app-accent-rgb),0.35)] p-3 space-y-2.5 shadow-lg overflow-hidden"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-[rgba(var(--app-accent-rgb),0.15)] border border-[rgba(var(--app-accent-rgb),0.4)] flex items-center justify-center shrink-0">
                                <Music className="w-4.5 h-4.5 text-[var(--app-accent-bright)]" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <h4 className="text-xs font-bold text-white">
                                  {audioPermState === 'prompt'
                                    ? isAr
                                      ? 'تجديد السماح بعرض صوتيات جهازك'
                                      : 'Resume Access to Device Audio'
                                    : isAr
                                    ? 'السماح بعرض المقاطع الصوتية من الجهاز مباشرة'
                                    : 'Allow Direct Access to Device Audio'}
                                </h4>
                                <p className="text-[10.5px] text-slate-300 leading-relaxed">
                                  {isAr
                                    ? 'اسمح للتطبيق بالوصول إلى الصوتيات في جهازك لتظهر هنا مباشرة وتستطيع تشغيلها وإضافتها للتايم لاين فوراً.'
                                    : 'Allow the app to show your device audio tracks directly inside the app for instant preview and timeline insertion.'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRequestDeviceGalleryAccess('audio', false)}
                                disabled={isRequestingDevicePerm}
                                className="flex-1 h-8 px-3 rounded-lg bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                {isRequestingDevicePerm ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isAr ? 'السماح بعرض الصوتيات' : 'Allow & Show Audio'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAudioPermDismissed(true)}
                                className="h-8 px-2.5 rounded-lg bg-[#222326] hover:bg-[#2C2E33] text-[10.5px] font-medium text-slate-300 transition-colors cursor-pointer"
                              >
                                {isAr ? 'لاحقاً' : 'Later'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {(() => {
                        const builtInCards: SessionAudioItem[] = BUILTIN_AUDIO_TRACKS.map((t) => ({
                          id: t.id,
                          title: t.title,
                          durationSec: t.durationSec,
                          durationLabel: t.durationLabel,
                          gradient: t.gradient,
                          waveformBars: t.waveformBars,
                          url: getBuiltinAudioUrl(t),
                        }));

                        const seenTitles = new Set<string>();
                        const deviceAndSavedAudio: SessionAudioItem[] = [];
                        [...deviceFolderAudio, ...sessionAudio].forEach((a) => {
                          if (!seenTitles.has(a.title)) {
                            seenTitles.add(a.title);
                            deviceAndSavedAudio.push(a);
                          }
                        });

                        const allAudio = [...deviceAndSavedAudio, ...builtInCards];

                        return (
                          <div className="space-y-2">
                            {galleryNotice?.scope === 'audio' && galleryNotice.count > 0 && (
                              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--app-accent-surface)] border border-[rgba(var(--app-accent-rgb),0.4)] text-[10.5px] text-[var(--app-accent-light)]">
                                <span className="truncate font-medium">
                                  {isAr
                                    ? `تم إظهار ${galleryNotice.count} صوتيات — اضغط + للإضافة`
                                    : `Loaded ${galleryNotice.count} audio tracks — tap + to add`}
                                </span>
                                {galleryNotice.latestAudio && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const track = galleryNotice.latestAudio!;
                                      stopAudioPreview();
                                      onAddLayer('audio', {
                                        audioConfig: {
                                          src: track.url,
                                          volume: 1,
                                          muted: false,
                                        },
                                        name: track.title,
                                        durationSeconds: track.durationSec,
                                      });
                                      onClose();
                                    }}
                                    className="px-2 py-0.5 rounded bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] text-[10px] font-extrabold shrink-0 cursor-pointer"
                                  >
                                    {isAr ? 'إضافة للتايم لاين' : 'Add to Timeline'}
                                  </button>
                                )}
                              </div>
                            )}

                            <div
                              ref={audioGridRef}
                              className={`grid grid-cols-4 sm:grid-cols-5 gap-1.5 overflow-y-auto pr-0.5 transition-all ${
                                expandAudioAll ? 'max-h-[315px]' : 'max-h-[205px]'
                              }`}
                            >
                            {/* First slot: "عرض الكل" */}
                            <button
                              type="button"
                              onClick={() => setExpandAudioAll((prev) => !prev)}
                              className="aspect-square rounded-[6px] bg-[#222326] hover:bg-[#2B2D32] flex flex-col items-center justify-center gap-1.5 text-slate-200 transition-colors cursor-pointer"
                            >
                              <LayoutGrid className="w-5 h-5 text-slate-200 stroke-[1.6]" />
                              <span className="text-[10px] font-medium">
                                {expandAudioAll ? (isAr ? 'تصغير' : 'Less') : (isAr ? 'عرض الكل' : 'View All')}
                              </span>
                            </button>

                            {allAudio.map((track) => {
                              const isPreviewing = previewAudioId === track.id;
                              return (
                                <div
                                  key={track.id}
                                  className={`aspect-square rounded-[6px] overflow-hidden relative flex flex-col justify-between bg-gradient-to-br ${track.gradient} select-none group ${
                                    isPreviewing ? 'ring-2 ring-[var(--app-accent-bright)]' : ''
                                  }`}
                                >
                                  {track.isUserSaved && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (previewAudioId === track.id) stopAudioPreview();
                                        deleteAudioFromLibrary(track.id);
                                        setSessionAudio((prev) => prev.filter((a) => a.id !== track.id));
                                        setDeviceFolderAudio((prev) => prev.filter((a) => a.id !== track.id));
                                      }}
                                      className="absolute top-1 left-1 z-30 w-4 h-4 rounded bg-black/70 hover:bg-rose-600 text-white/85 hover:text-white flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title={isAr ? 'حذف' : 'Remove'}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  )}

                                  {/* Upper Preview Zone: Title, Duration, Waveform, Play/Pause on tap */}
                                  <button
                                    type="button"
                                    onClick={() => togglePreviewTrack(track.id, track.url)}
                                    className="flex-1 w-full p-1.5 flex flex-col justify-between text-start relative cursor-pointer"
                                    title={track.title}
                                  >
                                    <div className="w-full space-y-0.5 relative z-10">
                                      <span className="block text-[9px] font-bold text-white leading-tight truncate drop-shadow-sm">
                                        {track.title}
                                      </span>
                                      <span className="block text-[8px] font-mono text-white/80 tabular-nums leading-none">
                                        {track.durationLabel}
                                      </span>
                                    </div>

                                    {/* Center Waveform Graphic */}
                                    <div className="w-full h-5 flex items-center justify-center gap-[1.5px] opacity-85 relative z-10">
                                      {track.waveformBars.map((h, idx) => (
                                        <span
                                          key={idx}
                                          style={{ height: `${Math.max(18, Math.round(h * 0.85))}%` }}
                                          className={`w-[2px] rounded-full transition-all ${
                                            isPreviewing ? 'bg-[var(--app-accent-bright)]' : 'bg-white/80'
                                          }`}
                                        />
                                      ))}
                                    </div>

                                    {isPreviewing && (
                                      <span className="absolute bottom-1 left-1 z-20 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center text-[var(--app-accent-bright)]">
                                        <Pause className="w-2.5 h-2.5 fill-current" />
                                      </span>
                                    )}
                                  </button>

                                  {/* Bottom + Add Strip */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      stopAudioPreview();
                                      onAddLayer('audio', {
                                        audioConfig: {
                                          src: track.url,
                                          volume: 1,
                                          muted: false,
                                        },
                                        name: track.title,
                                        durationSeconds: track.durationSec,
                                      });
                                      onClose();
                                    }}
                                    className="h-[22px] w-full bg-black/40 hover:bg-black/60 border-t border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
                                    title={isAr ? `إضافة ${track.title}` : `Add ${track.title}`}
                                  >
                                    <Plus className="w-3.5 h-3.5 stroke-[2.4]" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })()}
                        </>
                      )}
                    </div>
                  )}

                  {/* SUB-VIEW: ELEMENTS / OBJECTS */}
                  {subView === 'elements' && (
                    <motion.div
                      variants={staggerFastContainerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-2.5 max-h-[270px] overflow-y-auto pr-0.5"
                    >
                      <motion.div variants={staggerItemVariants} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            onAddLayer('solid');
                            onClose();
                          }}
                          className="p-2.5 bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.05] hover:border-amber-400/50 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <Palette className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="font-bold truncate">{isAr ? 'خلفية ملونة Solid' : 'Solid Color'}</span>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            onAddLayer('adjustment', { name: isAr ? 'طبقة تعديل' : 'Adjustment Layer' });
                            onClose();
                          }}
                          className="p-2.5 bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.05] hover:border-pink-400/50 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <Sliders className="w-4 h-4 text-pink-400 shrink-0" />
                          <span className="font-bold truncate">{isAr ? 'طبقة تعديل' : 'Adjustment'}</span>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            onAddLayer('particle', { shape: 'spark', color: '#00E676', secondaryColor: '#00E5FF' });
                            onClose();
                          }}
                          className="p-2.5 bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.05] hover:border-emerald-400/50 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-[#00E676] shrink-0" />
                          <span className="font-bold truncate">{isAr ? 'الجسيمات الضوئية' : 'Particles'}</span>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            onAddLayer('particle', {
                              name: isAr ? 'نجوم فضائية' : 'Space Stars',
                              particleConfig: {
                                shape: 'circle',
                                count: 0,
                                speed: 0,
                                size: 4,
                                sizeVariation: 2,
                                color: '#FFFFFF',
                                secondaryColor: '#F1F5F9',
                                lifetime: 60,
                                spreadAngle: 360,
                                gravity: 0,
                                wind: 0,
                              },
                              effects: [
                                {
                                  id: `eff-stars-${Date.now()}`,
                                  type: 'motionStars',
                                  name: isAr ? 'نجوم فضائية' : 'Space Stars',
                                  enabled: true,
                                  params: {
                                    starShape: 'mixed',
                                    count: 280,
                                    starSize: 4.0,
                                    sizeVariation: 100,
                                    brightness: 1.0,
                                    glow: 0,
                                    twinkle: 0,
                                    starRotation: 0,
                                    spinSpeed: 0,
                                    reactivity: 1.0,
                                    speed: 0,
                                    floatSpeed: 0,
                                    floatAmount: 0,
                                    trailLength: 0,
                                    spread: 100,
                                    color: '#FFFFFF',
                                    secondaryColor: '#F1F5F9',
                                  },
                                },
                              ],
                            });
                            onClose();
                          }}
                          className="p-2.5 bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.05] hover:border-cyan-400/50 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <Star className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="font-bold truncate">{isAr ? 'نجوم فضائية' : 'Space Stars'}</span>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={() => {
                            onAddLayer('particle', {
                              name: isAr ? 'خطوط فضائية' : 'Space Lines',
                              particleConfig: {
                                shape: 'circle',
                                count: 0,
                                speed: 0,
                                size: 3,
                                sizeVariation: 2,
                                color: '#38BDF8',
                                secondaryColor: '#FFFFFF',
                                lifetime: 60,
                                spreadAngle: 360,
                                gravity: 0,
                                wind: 0,
                              },
                              effects: [
                                {
                                  id: `eff-lines-${Date.now()}`,
                                  type: 'spaceLines',
                                  name: isAr ? 'خطوط فضائية' : 'Space Lines',
                                  enabled: true,
                                  params: {
                                    lineStyle: 'mixed',
                                    lineCapStyle: 'glow',
                                    count: 220,
                                    lineLength: 90,
                                    lineThickness: 2.5,
                                    lengthVariation: 100,
                                    brightness: 1.0,
                                    glow: 20,
                                    twinkle: 0,
                                    lineRotation: 0,
                                    spinSpeed: 0,
                                    reactivity: 1.0,
                                    speed: 0,
                                    floatSpeed: 0,
                                    floatAmount: 0,
                                    spread: 100,
                                    color: '#38BDF8',
                                    secondaryColor: '#FFFFFF',
                                  },
                                },
                              ],
                            });
                            onClose();
                          }}
                          className="p-2.5 bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.05] hover:border-purple-400/50 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="font-bold truncate">{isAr ? 'خطوط فضائية' : 'Space Lines'}</span>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          type="button"
                          onClick={handleAdd3DText}
                          className="p-2.5 bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.05] hover:border-amber-400/50 rounded-xl flex items-center gap-2 text-xs cursor-pointer transition-colors"
                        >
                          <Box className="w-4 h-4 text-amber-300 shrink-0" />
                          <span className="font-bold truncate">{isAr ? 'نص مجسم 3D' : '3D Extruded Text'}</span>
                        </motion.button>
                      </motion.div>

                      {/* 3D Model Importer (All Formats, Multi-File Textures + ZIP + Saved In-App Models) */}
                      <motion.div variants={staggerItemVariants} className="pt-2 border-t border-white/[0.06] space-y-2.5">
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsModelDragOver(true);
                          }}
                          onDragLeave={() => setIsModelDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsModelDragOver(false);
                            const dropped: File[] = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
                            if (dropped.length > 0) {
                              processSelected3DModelFiles(dropped);
                            }
                          }}
                          className={`rounded-xl border transition-all ${
                            isModelDragOver
                              ? 'border-[var(--app-accent-bright)] bg-[rgba(var(--app-accent-rgb),0.15)]'
                              : 'border-white/[0.08] bg-[#222326]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => modelFileInputRef.current?.click()}
                            className="w-full py-2.5 px-3 hover:bg-[#2C2E33] rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Upload className="w-3.5 h-3.5 text-[var(--app-accent-bright)] shrink-0" />
                              <span>
                                {isAr ? 'رفع مجسم 3D' : 'Upload 3D Model'}
                              </span>
                            </div>
                            <span className="text-[10px] font-normal text-slate-400">
                              {isAr
                                ? 'يدعم GLB, GLTF, FBX, OBJ+MTL, DAE, STL, USDZ, ZIP مع الخامات والصور'
                                : 'Supports GLB, GLTF, FBX, OBJ+MTL, DAE, STL, USDZ, ZIP with textures'}
                            </span>
                          </button>
                        </div>

                        {savedModels3D.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between px-0.5">
                              <span className="text-[10.5px] font-bold text-slate-300">
                                {isAr
                                  ? `المجسمات المحفوظة في التطبيق (${savedModels3D.length})`
                                  : `Saved 3D Models (${savedModels3D.length})`}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                              {savedModels3D.map((model) => (
                                <motion.div
                                  key={model.id}
                                  whileTap={{ scale: 0.96 }}
                                  className="relative rounded-xl bg-[#1E2024] border border-white/[0.07] hover:border-[rgba(var(--app-accent-bright-rgb),0.5)] overflow-hidden group transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleAddSaved3DModel(model)}
                                    className="w-full text-start flex flex-col cursor-pointer"
                                    title={model.name}
                                  >
                                    <div className="w-full aspect-square bg-[#121418] flex items-center justify-center overflow-hidden relative">
                                      {model.thumbnailDataUrl ? (
                                        <img
                                          src={model.thumbnailDataUrl}
                                          alt={model.name}
                                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-150"
                                        />
                                      ) : (
                                        <Box className="w-7 h-7 text-[var(--app-accent-bright)] opacity-80" />
                                      )}
                                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-mono uppercase text-[var(--app-accent-light)]">
                                        {model.format}
                                      </span>
                                      {model.hasBones && (
                                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-[rgba(var(--app-accent-rgb),0.2)] border border-[rgba(var(--app-accent-bright-rgb),0.4)] text-[8px] text-[var(--app-accent-light)] font-bold">
                                          Rig
                                        </span>
                                      )}
                                    </div>
                                    <div className="p-1.5">
                                      <div className="text-[10px] font-bold text-slate-100 truncate">
                                        {model.name}
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteModel3DFromLibrary(model.id);
                                      setSavedModels3D((prev) => prev.filter((m) => m.id !== model.id));
                                    }}
                                    className="absolute top-1 right-1 z-10 w-5 h-5 rounded-md bg-black/75 hover:bg-rose-600 text-white/85 hover:text-white flex items-center justify-center opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title={isAr ? 'حذف المجسم' : 'Delete Model'}
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  )}

                  {/* SUB-VIEW: PRESETS / TEMPLATES */}
                  {subView === 'presets' && (
                    <motion.div
                      variants={staggerFastContainerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-2.5"
                    >
                      <motion.p variants={staggerItemVariants} className="text-xs text-slate-300">
                        {isAr ? 'اختر من مكتبة القوالب الجاهزة للبدء بسرعة:' : 'Browse motion templates to start quickly:'}
                      </motion.p>
                      {onOpenTemplates && (
                        <motion.button
                          variants={staggerItemVariants}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => {
                            onOpenTemplates();
                            onClose();
                          }}
                          style={{
                            boxShadow: '0 0 16px rgba(var(--app-accent-rgb), 0.35)',
                          }}
                          className="w-full py-2.5 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-extrabold rounded-xl text-xs cursor-pointer"
                        >
                          {isAr ? 'فتح مكتبة القوالب الجاهزة' : 'Open Motion Templates'}
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};
