import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PanelRimSheen,
  backdropVariants,
  bottomSheetVariants,
  staggerContainerVariants,
  staggerItemVariants,
  dropdownVariants,
  dropdownUpVariants,
  PILL_SPRING,
  centerModalVariants,
} from './MotionPrimitives';
import { Project, Language } from '../types';
import {
  exportVideo,
  exportCurrentFramePNG,
  createProjectSQBlob,
  ExportResult,
} from '../engine/exporter';
import {
  AppSettings,
  DefaultResolution,
  loadAppSettings,
  saveAppSettings,
} from '../utils/appSettings';
import { retimeProjectForFps } from '../utils/projectTiming';
import {
  canShareExportedFile,
  canUseDirectoryPicker,
  getPickedDirectoryHandle,
  pickExportMoviesDirectory,
  saveBlobToPickedDirectory,
  shareExportedFile,
  triggerBrowserDownload,
} from '../utils/exportDirectoryStore';
import {
  Download,
  X,
  XCircle,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Film,
  FolderCheck,
  FolderOpen,
  Share2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';

interface ExportModalProps {
  project: Project;
  lang: Language;
  appSettings?: AppSettings;
  onClose: () => void;
}

type AspectPreset = '16:9' | '9:16' | '1:1' | '4:5' | '4:3';

function getProjectAspect(settings: Project['settings']): AspectPreset {
  const w = settings.width || 720;
  const h = settings.height || 1280;
  const ratio = w / h;
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16';
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.1) return '4:5';
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
  return w >= h ? '16:9' : '9:16';
}

function getProjectResolution(settings: Project['settings']): DefaultResolution {
  const minDim = Math.min(settings.width || 720, settings.height || 1280);
  if (minDim >= 2000) return '4K';
  if (minDim >= 1400) return '1440p';
  if (minDim >= 1000) return '1080p';
  return '720p';
}

function mapTargetFormat(target: AppSettings['defaultExportTarget']): {
  exportType: 'video' | 'gif' | 'sq' | 'png';
  videoContainer: 'mp4' | 'webm';
} {
  if (target === 'webm') return { exportType: 'video', videoContainer: 'webm' };
  if (target === 'gif') return { exportType: 'gif', videoContainer: 'mp4' };
  if (target === 'png') return { exportType: 'png', videoContainer: 'mp4' };
  if (target === 'sq') return { exportType: 'sq', videoContainer: 'mp4' };
  return { exportType: 'video', videoContainer: 'mp4' };
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  lang,
  appSettings: propAppSettings,
  onClose,
}) => {
  const [liveSettings, setLiveSettings] = useState<AppSettings>(
    () => propAppSettings || loadAppSettings()
  );

  useEffect(() => {
    if (propAppSettings) setLiveSettings(propAppSettings);
  }, [propAppSettings]);

  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail;
      if (detail) setLiveSettings(detail);
    };
    window.addEventListener('sqmotion-settings-changed', onSettingsChanged);
    return () => window.removeEventListener('sqmotion-settings-changed', onSettingsChanged);
  }, []);

  const appChangedMoreRecently =
    liveSettings.settingsExportUpdatedAt > (project.settings.settingsUpdatedAt || 0);

  const initialFormat = mapTargetFormat(liveSettings.defaultExportTarget);

  const [exportType, setExportType] = useState<'video' | 'gif' | 'sq' | 'png'>(
    initialFormat.exportType
  );
  const [videoContainer, setVideoContainer] = useState<'mp4' | 'webm'>(
    initialFormat.videoContainer
  );

  const [projectName, setProjectName] = useState<string>(
    project.settings.name || 'SQMotion_Project'
  );

  const [selectedAspect, setSelectedAspect] = useState<AspectPreset>(() => {
    if (appChangedMoreRecently && liveSettings.defaultExportAspect !== 'auto') {
      return liveSettings.defaultExportAspect;
    }
    if (
      liveSettings.defaultExportAspect !== 'auto' &&
      !(project.settings.settingsUpdatedAt && project.settings.settingsUpdatedAt > liveSettings.settingsExportUpdatedAt)
    ) {
      return liveSettings.defaultExportAspect;
    }
    return getProjectAspect(project.settings);
  });

  const [selectedResolution, setSelectedResolution] = useState<DefaultResolution>(() =>
    appChangedMoreRecently
      ? liveSettings.defaultResolution
      : getProjectResolution(project.settings)
  );

  const [selectedFps, setSelectedFps] = useState<number>(() =>
    appChangedMoreRecently
      ? liveSettings.defaultFps
      : project.settings.fps || liveSettings.defaultFps || 60
  );

  const [selectedQuality, setSelectedQuality] = useState<'high' | 'standard' | 'low'>(
    () => liveSettings.defaultExportQuality || 'high'
  );

  // Sync automatically if appSettings changes while modal is open
  const prevUpdatedAtRef = useRef<number>(liveSettings.settingsExportUpdatedAt);
  useEffect(() => {
    if (liveSettings.settingsExportUpdatedAt !== prevUpdatedAtRef.current) {
      prevUpdatedAtRef.current = liveSettings.settingsExportUpdatedAt;
      const mapped = mapTargetFormat(liveSettings.defaultExportTarget);
      setExportType(mapped.exportType);
      setVideoContainer(mapped.videoContainer);
      setSelectedQuality(liveSettings.defaultExportQuality);
      setSelectedResolution(liveSettings.defaultResolution);
      setSelectedFps(liveSettings.defaultFps);
      setSelectedAspect(
        liveSettings.defaultExportAspect !== 'auto'
          ? liveSettings.defaultExportAspect
          : getProjectAspect(project.settings)
      );
    }
  }, [liveSettings, project.settings]);

  // Dropdown menus open/close states
  const [openResDropdown, setOpenResDropdown] = useState<boolean>(false);
  const [openFpsDropdown, setOpenFpsDropdown] = useState<boolean>(false);
  const [openQualityDropdown, setOpenQualityDropdown] = useState<boolean>(false);

  // Render process states
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pngPreview, setPngPreview] = useState<{
    dataUrl: string;
    blob: Blob;
    filename: string;
  } | null>(null);
  const [savedFolderMsg, setSavedFolderMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  const replaceDownloadUrl = (nextUrl: string | null) => {
    if (activeUrlRef.current && activeUrlRef.current !== nextUrl) {
      try {
        URL.revokeObjectURL(activeUrlRef.current);
      } catch {}
    }
    activeUrlRef.current = nextUrl;
    setDownloadUrl(nextUrl);
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (activeUrlRef.current) {
        try {
          URL.revokeObjectURL(activeUrlRef.current);
        } catch {}
      }
    };
  }, []);

  // Calculate resolution dimensions (always even for H.264 MP4)
  const getCalculatedDimensions = (aspect: AspectPreset, res: DefaultResolution) => {
    let baseShort = 1080;
    if (res === '720p') baseShort = 720;
    else if (res === '1080p') baseShort = 1080;
    else if (res === '1440p') baseShort = 1440;
    else if (res === '4K') baseShort = 2160;

    let w = 1080;
    let h = 1920;

    switch (aspect) {
      case '16:9':
        w = Math.round((baseShort * 16) / 9);
        h = baseShort;
        break;
      case '9:16':
        w = baseShort;
        h = Math.round((baseShort * 16) / 9);
        break;
      case '1:1':
        w = baseShort;
        h = baseShort;
        break;
      case '4:5':
        w = baseShort;
        h = Math.round((baseShort * 5) / 4);
        break;
      case '4:3':
        w = Math.round((baseShort * 4) / 3);
        h = baseShort;
        break;
    }

    return {
      width: Math.max(2, Math.round(w / 2) * 2),
      height: Math.max(2, Math.round(h / 2) * 2),
    };
  };

  const calculatedDim = getCalculatedDimensions(selectedAspect, selectedResolution);

  const [hasLinkedMoviesDir, setHasLinkedMoviesDir] = useState<boolean>(false);

  useEffect(() => {
    getPickedDirectoryHandle().then((h) => {
      setHasLinkedMoviesDir(Boolean(h));
    });
  }, []);

  const handleLinkMoviesFolder = async () => {
    const picked = await pickExportMoviesDirectory();
    if (picked) {
      setHasLinkedMoviesDir(true);
      const updated: AppSettings = {
        ...liveSettings,
        savePath: picked.displayPath,
        settingsExportUpdatedAt: Date.now(),
      };
      setLiveSettings(updated);
      saveAppSettings(updated);
      return picked.handle;
    }
    return null;
  };

  const saveExportedBlob = async (blob: Blob, filename: string) => {
    setSavedFolderMsg(null);
    let dirResult = await saveBlobToPickedDirectory(blob, filename, 'SQMOTION');

    if (!dirResult.saved && canUseDirectoryPicker()) {
      const pickedHandle = await handleLinkMoviesFolder();
      if (pickedHandle) {
        dirResult = await saveBlobToPickedDirectory(blob, filename, 'SQMOTION', pickedHandle);
      }
    }

    if (dirResult.saved) {
      setSavedFolderMsg(
        lang === 'ar'
          ? `تم الحفظ بنجاح داخل مجلد ${dirResult.folderPath || 'Movies/SQMOTION'}/${filename}`
          : `Saved directly to ${dirResult.folderPath || 'Movies/SQMOTION'}/${filename}`
      );
      return;
    }

    triggerBrowserDownload(blob, filename);
    setSavedFolderMsg(
      lang === 'ar'
        ? `تم تنزيل الملف (${filename.toLowerCase().startsWith('sqmotion') ? filename : `SQMOTION_${filename}`}) — المسار المستهدف: ${liveSettings.savePath}`
        : `Downloaded ${filename} (Target: ${liveSettings.savePath})`
    );
  };

  const handleApplyAppSettings = () => {
    const mapped = mapTargetFormat(liveSettings.defaultExportTarget);
    setExportType(mapped.exportType);
    setVideoContainer(mapped.videoContainer);
    setSelectedQuality(liveSettings.defaultExportQuality);
    setSelectedResolution(liveSettings.defaultResolution);
    setSelectedFps(liveSettings.defaultFps);
    setSelectedAspect(
      liveSettings.defaultExportAspect !== 'auto'
        ? liveSettings.defaultExportAspect
        : getProjectAspect(project.settings)
    );
    replaceDownloadUrl(null);
    setPngPreview(null);
    setExportError(null);
  };

  const handleStartExport = async () => {
    setExportError(null);
    setSavedFolderMsg(null);

    if (exportType === 'sq') {
      const sqProject: Project = retimeProjectForFps(
        {
          ...project,
          settings: {
            ...project.settings,
            name: projectName,
            width: calculatedDim.width,
            height: calculatedDim.height,
          },
        },
        selectedFps
      );
      const { blob, filename } = createProjectSQBlob(sqProject);
      await saveExportedBlob(blob, filename);
      onClose();
      return;
    }

    if (exportType === 'png') {
      setIsRendering(true);
      setProgress(25);
      setStatusText(lang === 'ar' ? 'جارٍ تصدير الإطار بجودة كاملة...' : 'Rendering full-res PNG frame...');
      try {
        const res = await exportCurrentFramePNG(
          {
            ...project,
            settings: {
              ...project.settings,
              name: projectName,
            },
          },
          project.currentFrame || 0,
          calculatedDim.width,
          calculatedDim.height
        );
        setPngPreview(res);
        setIsRendering(false);
      } catch (err) {
        console.error('PNG Export error:', err);
        setExportError(
          lang === 'ar'
            ? 'تعذر تصدير الصورة، تحقق من الوسائط وحاول مجدداً.'
            : 'Failed to export PNG frame.'
        );
        setIsRendering(false);
      }
      return;
    }

    // Video (MP4 / WebM) or GIF Render Flow
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const targetContainer: 'mp4' | 'webm' | 'gif' =
      exportType === 'gif' ? 'gif' : videoContainer;

    setIsRendering(true);
    setProgress(0);
    replaceDownloadUrl(null);
    setExportResult(null);
    setStatusText(
      lang === 'ar'
        ? `جارٍ تهيئة محرك التصدير (${targetContainer.toUpperCase()} · ${selectedFps} FPS)...`
        : `Initializing ${targetContainer.toUpperCase()} encoder (${selectedFps} FPS)...`
    );

    try {
      const exportProject: Project = retimeProjectForFps(
        {
          ...project,
          settings: {
            ...project.settings,
            name: projectName,
          },
        },
        selectedFps
      );

      const result = await exportVideo(
        exportProject,
        {
          format: targetContainer,
          quality: selectedQuality,
          fps: selectedFps,
          width: calculatedDim.width,
          height: calculatedDim.height,
          signal: controller.signal,
        },
        (p, status) => {
          setProgress(p);
          setStatusText(status);
        }
      );

      const url = URL.createObjectURL(result.blob);
      setExportResult(result);
      replaceDownloadUrl(url);
      setIsRendering(false);
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        setStatusText(lang === 'ar' ? 'تم إلغاء التصدير.' : 'Export cancelled.');
        setIsRendering(false);
        return;
      }
      console.error('Export error:', err);
      const errMsg = err instanceof Error && err.message ? err.message : '';
      setExportError(
        lang === 'ar'
          ? `فشل التصدير${errMsg ? `: ${errMsg}` : '، يرجى المحاولة بصيغة أو دقة أخرى.'}`
          : `Export failed${errMsg ? `: ${errMsg}` : ', please try another resolution or format.'}`
      );
      setIsRendering(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelExport = () => {
    abortControllerRef.current?.abort();
    setIsRendering(false);
  };

  const targetSettingsLabel = `${liveSettings.defaultExportTarget.toUpperCase()} · ${liveSettings.defaultResolution} · ${liveSettings.defaultFps} FPS`;

  return (
    <motion.div
      key="export-modal-backdrop"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={() => {
        if (!isRendering) onClose();
      }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col justify-end select-none overflow-hidden gpu-layer"
      style={AMBIENT_BACKDROP_STYLE}
    >
      <AmbientModalGlow />

      <motion.div
        key="export-modal-panel"
        variants={bottomSheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        style={{
          willChange: 'transform, opacity',
          transform: 'translate3d(0,0,0)',
          boxShadow:
            '0 -25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(var(--app-accent-rgb), 0.1), inset 0 1px 1px rgba(255,255,255,0.2)',
        }}
        className="bg-[#0D0E13]/[0.98] border-t border-x border-white/15 rounded-t-[38px] w-full max-w-lg mx-auto p-5 sm:p-6 pb-8 text-white relative max-h-[92vh] overflow-y-auto overflow-x-hidden custom-scrollbar gpu-layer"
      >
        <PanelRimSheen roundedClass="rounded-t-[36px]" />

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 relative z-10"
        >
          {/* Synced Settings Target Banner */}
          {!isRendering && !downloadUrl && !pngPreview && (
            <motion.div
              variants={staggerItemVariants}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[var(--app-accent-surface)] border border-[var(--app-accent-border)] text-[11px]"
            >
              <button
                type="button"
                onClick={handleApplyAppSettings}
                className="px-2.5 py-1 rounded-lg bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black text-[10px] hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                {lang === 'ar' ? 'استهداف الإعدادات' : 'Sync Settings'}
              </button>
              <div className="flex items-center gap-1.5 min-w-0 text-right">
                <span className="truncate font-bold text-slate-200">
                  {lang === 'ar' ? `هدف الإعدادات: ${targetSettingsLabel}` : `Settings Target: ${targetSettingsLabel}`}
                </span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--app-accent-bright)] shrink-0" />
              </div>
            </motion.div>
          )}

          {/* Top Segmented Format Pills: [ فيديو | GIF | ملف .sq | إطار PNG ] */}
          <motion.div
            variants={staggerItemVariants}
            className="bg-[#15171E]/90 border border-white/10 p-1 rounded-full flex items-center justify-between gap-1 w-full max-w-md mx-auto shadow-inner relative"
          >
            {(
              [
                { id: 'png', label: lang === 'ar' ? 'إطار PNG' : 'Frame PNG' },
                { id: 'sq', label: lang === 'ar' ? 'ملف .sq' : '.sq Project' },
                { id: 'gif', label: 'GIF' },
                { id: 'video', label: lang === 'ar' ? `فيديو ${videoContainer.toUpperCase()}` : `Video ${videoContainer.toUpperCase()}` },
              ] as const
            ).map((fmt) => {
              const active = exportType === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  disabled={isRendering}
                  onClick={() => {
                    setExportType(fmt.id);
                    replaceDownloadUrl(null);
                    setPngPreview(null);
                    setExportError(null);
                  }}
                  className={`relative flex-1 py-1.5 rounded-full text-xs font-black transition-colors text-center cursor-pointer disabled:opacity-50 ${
                    active ? 'text-[var(--app-accent-contrast)]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="exportFormatIndicator"
                      style={{ boxShadow: '0 0 12px var(--app-accent-glow)' }}
                      className="absolute inset-0 bg-[var(--app-accent-solid)] rounded-full"
                      transition={PILL_SPRING}
                    />
                  )}
                  <span className="relative z-10">{fmt.label}</span>
                </button>
              );
            })}
          </motion.div>

          {/* Project Name Field with Clear Button & Underline */}
          <motion.div
            variants={staggerItemVariants}
            className="pt-1 pb-1 border-b border-white/15 flex items-center justify-between gap-2 px-1 focus-within:border-[var(--app-accent-bright)] transition-colors"
          >
            <div className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => setProjectName('')}
                className="text-slate-400 hover:text-white active:scale-90 transition-all cursor-pointer"
                title="Clear"
              >
                <XCircle className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="SQMotion_Project"
                className="bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-slate-500 focus:outline-none w-full"
              />
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)]">
              {exportType === 'sq'
                ? 'SQ'
                : exportType === 'gif'
                ? 'GIF'
                : exportType === 'png'
                ? 'PNG'
                : videoContainer.toUpperCase()}
            </span>
          </motion.div>

          {/* Aspect Ratio Selector Buttons */}
          {!isRendering && !downloadUrl && !pngPreview && (
            <motion.div variants={staggerItemVariants} className="flex items-center justify-between gap-1.5 py-1 px-1">
              <button
                type="button"
                onClick={() => setSelectedAspect(getProjectAspect(project.settings))}
                className="w-9 h-9 rounded-xl bg-[#15171E] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-[var(--app-accent-border)] shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={lang === 'ar' ? 'استعادة أبعاد المشروع' : 'Reset to project aspect'}
              >
                <Edit3 className="w-4 h-4" />
              </button>

              {(['4:3', '1:1', '4:5', '9:16', '16:9'] as const).map((aspect) => (
                <button
                  key={aspect}
                  type="button"
                  onClick={() => setSelectedAspect(aspect)}
                  style={selectedAspect === aspect ? { boxShadow: '0 0 12px var(--app-accent-glow)' } : undefined}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    selectedAspect === aspect
                      ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)]'
                      : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {aspect}
                </button>
              ))}
            </motion.div>
          )}

          {/* Settings Rows */}
          {!isRendering && !downloadUrl && !pngPreview && (
            <motion.div variants={staggerItemVariants} className="space-y-3 pt-1">
              {/* Row 0: صيغة الفيديو (Container Format MP4 / WebM) */}
              {exportType === 'video' && (
                <div className="flex items-center justify-between gap-4 relative">
                  <div className="flex items-center gap-1.5 w-44 sm:w-48 bg-[#15171E] p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setVideoContainer('mp4')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        videoContainer === 'mp4'
                          ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>MP4 (H.264)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoContainer('webm')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        videoContainer === 'webm'
                          ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] shadow-sm font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>WebM</span>
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-xs sm:text-sm font-extrabold text-white">
                      {lang === 'ar' ? 'صيغة الفيديو' : 'Video Format'}
                    </div>
                    <div className="text-[10px] text-[var(--app-accent-bright)] font-medium">
                      {lang === 'ar' ? 'متوافق مع كل المنصات والهواتف' : 'Universal MP4 container'}
                    </div>
                  </div>
                </div>
              )}

              {/* Row 1: الدقة (Resolution) */}
              <div className="flex items-center justify-between gap-4 relative">
                <div className="relative w-44 sm:w-48">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenResDropdown(!openResDropdown);
                      setOpenFpsDropdown(false);
                      setOpenQualityDropdown(false);
                    }}
                    className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                    <span>
                      {selectedResolution === '1440p'
                        ? '1440p (QHD)'
                        : selectedResolution === '1080p'
                        ? '1080p (FHD)'
                        : selectedResolution === '720p'
                        ? '720p (HD)'
                        : '4K (UHD)'}
                    </span>
                  </button>

                  <AnimatePresence>
                    {openResDropdown && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-11 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                      >
                        {(['1080p', '720p', '1440p', '4K'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setSelectedResolution(r);
                              setOpenResDropdown(false);
                            }}
                            className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                              selectedResolution === r
                                ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black'
                                : 'text-slate-300'
                            }`}
                          >
                            <span className="font-mono text-[11px] text-slate-400">
                              {r === '1440p' ? 'QHD' : r === '1080p' ? 'FHD' : r === '720p' ? 'HD' : 'UHD'}
                            </span>
                            <span>{r}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-extrabold text-white">
                    {lang === 'ar' ? 'الدقة' : 'Resolution'}
                  </div>
                  <div className="text-[10px] text-[var(--app-accent-bright)] font-mono">
                    {calculatedDim.width} × {calculatedDim.height}
                  </div>
                </div>
              </div>

              {/* Row 2: معدل الإطار (Frame Rate) */}
              <div className="flex items-center justify-between gap-4 relative">
                <div className="relative w-44 sm:w-48">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFpsDropdown(!openFpsDropdown);
                      setOpenResDropdown(false);
                      setOpenQualityDropdown(false);
                    }}
                    className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                    <span className="font-mono text-[var(--app-accent-light)]">
                      {selectedFps} FPS {selectedFps >= 60 ? '⚡' : ''}
                    </span>
                  </button>

                  <AnimatePresence>
                    {openFpsDropdown && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-11 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                      >
                        {[120, 60, 30, 24].map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setSelectedFps(f);
                              setOpenFpsDropdown(false);
                            }}
                            className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                              selectedFps === f
                                ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black'
                                : 'text-slate-300'
                            }`}
                          >
                            <span className="font-mono text-[11px] text-slate-400">
                              {f === 120 ? 'Ultra Smooth' : f === 60 ? 'Smooth 60fps' : f === 30 ? 'Standard' : 'Cinema 24fps'}
                            </span>
                            <span className="font-mono">{f} FPS</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-extrabold text-white">
                    {lang === 'ar' ? 'معدل الإطار والسلاسة' : 'Frame Rate & Smoothness'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {selectedFps >= 60
                      ? lang === 'ar'
                        ? 'حركة فائقة النعومة والانسيابية'
                        : 'High frame-rate fluidity'
                      : lang === 'ar'
                      ? 'معدل إطارات قياسي'
                      : 'Standard frame rate'}
                  </div>
                </div>
              </div>

              {/* Row 3: الجودة ومعدل البت (Quality & Bitrate) */}
              <div className="flex items-center justify-between gap-4 relative">
                <div className="relative w-44 sm:w-48">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenQualityDropdown(!openQualityDropdown);
                      setOpenResDropdown(false);
                      setOpenFpsDropdown(false);
                    }}
                    className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                    <span>
                      {selectedQuality === 'high'
                        ? lang === 'ar'
                          ? 'جودة فائقة (High)'
                          : 'High Quality'
                        : selectedQuality === 'standard'
                        ? lang === 'ar'
                          ? 'جودة قياسية'
                          : 'Standard'
                        : lang === 'ar'
                        ? 'توفير مساحة'
                        : 'Economy'}
                    </span>
                  </button>

                  <AnimatePresence>
                    {openQualityDropdown && (
                      <motion.div
                        variants={dropdownUpVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute bottom-full mb-1.5 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                      >
                        {[
                          { id: 'high', title: lang === 'ar' ? 'جودة فائقة (High Bitrate)' : 'High Bitrate (Ultra HD)' },
                          { id: 'standard', title: lang === 'ar' ? 'جودة قياسية (Standard)' : 'Standard Bitrate' },
                          { id: 'low', title: lang === 'ar' ? 'توفير حجم (Economy)' : 'Economy Size' },
                        ].map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => {
                              setSelectedQuality(q.id as 'high' | 'standard' | 'low');
                              setOpenQualityDropdown(false);
                            }}
                            className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                              selectedQuality === q.id
                                ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black'
                                : 'text-slate-300'
                            }`}
                          >
                            <span>{q.title}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="text-right">
                  <div className="text-xs sm:text-sm font-extrabold text-white">
                    {lang === 'ar' ? 'الجودة ومعدل البت' : 'Quality & Bitrate'}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    {canUseDirectoryPicker() && (
                      <button
                        type="button"
                        onClick={handleLinkMoviesFolder}
                        className="text-[10px] font-bold text-[var(--app-accent-bright)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>
                          {hasLinkedMoviesDir
                            ? lang === 'ar'
                              ? 'مجلد Movies/SQMOTION مربوط ✓'
                              : 'Movies/SQMOTION Linked ✓'
                            : lang === 'ar'
                            ? 'تحديد مجلد Movies'
                            : 'Link Movies'}
                        </span>
                      </button>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" dir="ltr">
                      {liveSettings.savePath}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Banner */}
          {exportError && !isRendering && (
            <motion.div
              variants={centerModalVariants}
              initial="hidden"
              animate="visible"
              className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2.5"
            >
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="flex-1 text-right">{exportError}</span>
            </motion.div>
          )}

          {/* Live Rendering Progress State */}
          {isRendering && (
            <motion.div
              variants={centerModalVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4 text-center py-6 bg-[#15171E] border border-white/10 rounded-2xl p-4"
            >
              <Loader2
                style={{ filter: 'drop-shadow(0 0 12px var(--app-accent-glow))' }}
                className="w-9 h-9 text-[var(--app-accent-bright)] animate-spin mx-auto"
              />
              <div className="space-y-1">
                <p className="font-extrabold text-sm text-white">{statusText}</p>
                <p className="text-xs text-[var(--app-accent-bright)] font-mono font-bold">{progress}%</p>
              </div>
              <div className="w-full bg-[#0C0D12] h-3 rounded-full overflow-hidden border border-white/10 p-0.5 shadow-inner">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${progress}%`,
                    background: 'var(--app-accent-grad)',
                    boxShadow: '0 0 10px var(--app-accent-glow)',
                  }}
                />
              </div>
              <span className="block text-[11px] text-slate-400 font-medium">
                {(() => {
                  const exportFrameCount = Math.max(
                    1,
                    Math.round(
                      (project.settings.durationFrames || 90) *
                        (selectedFps / Math.max(1, project.settings.fps || 60))
                    )
                  );
                  return lang === 'ar'
                    ? `جارٍ معالجة ${exportFrameCount} إطار بدقة ${calculatedDim.width}×${calculatedDim.height} وسرعة ${selectedFps} FPS...`
                    : `Rendering ${exportFrameCount} frames at ${calculatedDim.width}×${calculatedDim.height} @ ${selectedFps} FPS...`;
                })()}
              </span>
              <button
                type="button"
                onClick={handleCancelExport}
                className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء التصدير' : 'Cancel Export'}
              </button>
            </motion.div>
          )}

          {/* Render Complete: Video or GIF Preview */}
          {downloadUrl && exportResult && (
            <motion.div
              variants={centerModalVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4 text-center py-4 bg-[#15171E] border border-[var(--app-accent-border)] rounded-2xl p-4"
            >
              <div className="w-full max-h-56 overflow-hidden rounded-xl border border-white/10 bg-black flex items-center justify-center">
                {exportResult.format === 'gif' ? (
                  <img
                    src={downloadUrl}
                    alt="Exported GIF Preview"
                    className="max-w-full max-h-56 object-contain rounded-lg"
                  />
                ) : (
                  <video
                    src={downloadUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="max-w-full max-h-56 object-contain rounded-lg"
                  />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-[var(--app-accent-bright)]">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="font-black text-base text-white">
                    {lang === 'ar'
                      ? `اكتمل تصدير ${exportResult.format.toUpperCase()} بنجاح!`
                      : `${exportResult.format.toUpperCase()} Export Completed!`}
                  </p>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {calculatedDim.width} × {calculatedDim.height} @ {selectedFps} FPS ({exportResult.format.toUpperCase()})
                </p>
              </div>

              {savedFolderMsg && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                  <FolderCheck className="w-4 h-4 shrink-0" />
                  <span>{savedFolderMsg}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => saveExportedBlob(exportResult.blob, exportResult.filename)}
                  style={{ boxShadow: '0 0 20px var(--app-accent-glow)' }}
                  className="w-full py-3.5 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[3]" />
                  <span>
                    {lang === 'ar'
                      ? `حفظ في Movies / SQMOTION (${exportResult.format.toUpperCase()})`
                      : `Save to Movies / SQMOTION (${exportResult.format.toUpperCase()})`}
                  </span>
                </button>

                {canShareExportedFile(exportResult.blob, exportResult.filename) && (
                  <button
                    type="button"
                    onClick={() => shareExportedFile(exportResult.blob, exportResult.filename)}
                    className="w-full py-2.5 bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[var(--app-accent-border)] text-[var(--app-accent-bright)] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'حفظ في المعرض / مشاركة (Movies)' : 'Save to Gallery / Share'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const { blob, filename } = createProjectSQBlob(project);
                    saveExportedBlob(blob, filename);
                  }}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ نسخة احتياطية من المشروع (.sq)' : 'Save Backup (.sq)'}
                </button>
              </div>
            </motion.div>
          )}

          {/* PNG Frame Preview Mode */}
          {pngPreview && (
            <motion.div
              variants={centerModalVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4 text-center py-4 bg-[#15171E] border border-[var(--app-accent-border)] rounded-2xl p-4"
            >
              <div className="aspect-video w-full max-h-48 overflow-hidden rounded-xl border border-white/10 bg-black flex items-center justify-center">
                <img
                  src={pngPreview.dataUrl}
                  alt="Export Frame Preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              {savedFolderMsg && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                  <FolderCheck className="w-4 h-4 shrink-0" />
                  <span>{savedFolderMsg}</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => saveExportedBlob(pngPreview.blob, pngPreview.filename)}
                  style={{ boxShadow: '0 0 20px var(--app-accent-glow)' }}
                  className="w-full py-3 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[3]" />
                  <span>{lang === 'ar' ? 'حفظ في Movies / SQMOTION (PNG)' : 'Save to Movies / SQMOTION (PNG)'}</span>
                </button>
                {canShareExportedFile(pngPreview.blob, pngPreview.filename) && (
                  <button
                    type="button"
                    onClick={() => shareExportedFile(pngPreview.blob, pngPreview.filename)}
                    className="w-full py-2.5 bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[var(--app-accent-border)] text-[var(--app-accent-bright)] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'حفظ في المعرض / مشاركة' : 'Save to Gallery / Share'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Bottom Create / Export Action Button */}
          {!isRendering && !downloadUrl && !pngPreview && (
            <motion.div variants={staggerItemVariants} className="pt-2 flex items-center justify-between gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStartExport}
                style={{ boxShadow: '0 0 24px var(--app-accent-glow)' }}
                className="w-full py-3.5 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer animate-neon-green-glow"
              >
                <Film className="w-4 h-4 stroke-[3]" />
                <span>
                  {exportType === 'video'
                    ? lang === 'ar'
                      ? `تصدير فيديو ${videoContainer.toUpperCase()}`
                      : `Export ${videoContainer.toUpperCase()} Video`
                    : exportType === 'gif'
                    ? lang === 'ar'
                      ? 'تصدير صورة متحركة GIF'
                      : 'Export Animated GIF'
                    : exportType === 'sq'
                    ? lang === 'ar'
                      ? 'تصدير ملف .sq'
                      : 'Export .sq'
                    : lang === 'ar'
                    ? 'تصدير صورة الإطار PNG'
                    : 'Export Frame PNG'}
                </span>
              </motion.button>
            </motion.div>
          )}

          {/* Bottom Centered Close (X) Button */}
          <motion.div variants={staggerItemVariants} className="flex items-center justify-center pt-1">
            <button
              type="button"
              onClick={() => {
                if (isRendering) handleCancelExport();
                onClose();
              }}
              className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full active:scale-90 transition-all p-1.5 cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
