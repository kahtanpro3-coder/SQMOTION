import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, BlendMode, ShaderEffect, EffectType } from '../types';
import { ONLINE_GOOGLE_FONTS, ensureGoogleFontLoaded } from '../utils/onlineFonts';
import {
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Link,
  Unlink,
  Camera,
  Box,
  Bone,
  Sparkles,
  ZoomIn,
  RotateCw,
  Sliders,
  LogOut,
  ClipboardCopy,
  FolderOpen,
  CopyPlus,
  Ungroup,
  Star,
  ArrowUpRight,
} from 'lucide-react';
import { AlightMoveTransformPad } from './AlightMoveTransformPad';
import { AlightEffectsView } from './AlightEffectsView';
import { AlightEffectsStudioModal } from './AlightEffectsStudioModal';
import { LayerParentModal } from './LayerParentModal';
import { Model3DRigInspector } from './Model3DRigInspector';
import { Text3DInspector } from './Text3DInspector';
import { SpaceStarsInspector } from './SpaceStarsInspector';
import { PrecisionRulerScrubber } from './PrecisionRulerScrubber';
import {
  MODAL_EASE,
  PANEL_SPRING,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface AlightSelectedInspectorProps {
  project: Project;
  lang: Language;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onUpdateLayers?: (updatedLayers: Layer[]) => void;
  onAddKeyframe: (layerId: string, propertyPath: string) => void;
  onSetCurrentFrame?: (frame: number) => void;
  onDeleteLayer: (layerId: string) => void;
  onSplitLayer: (layerId: string, frame: number) => void;
  onTrimStart: (layerId: string, frame: number) => void;
  onTrimEnd: (layerId: string, frame: number) => void;
  onCloseInspector: () => void;
  onOpenGraphEditor?: () => void;
  onAddLayer?: (type: Layer['type'], customConfig?: any) => void;
  onSelectLayer?: (layerId: string | null) => void;
  onSubViewChange?: (subView: SelectedSubView) => void;
  requestedSubView?: { view: SelectedSubView; token: number } | null;
  onOpenCopyPasteProps?: () => void;
  onGroupAction?: (action: 'ungroup' | 'select_children' | 'duplicate_group' | 'delete_with_children') => void;
}

export type SelectedSubView =
  | 'menu'
  | 'transform'
  | 'shape'
  | 'limbs'
  | 'text3d'
  | 'camera'
  | 'presets'
  | 'effects'
  | 'color'
  | 'border'
  | 'blending'
  | 'speed'
  | 'audio';

export const AlightSelectedInspector: React.FC<AlightSelectedInspectorProps> = ({
  project,
  lang,
  onUpdateLayer,
  onUpdateLayers,
  onAddKeyframe,
  onSetCurrentFrame,
  onDeleteLayer,
  onSplitLayer,
  onTrimStart,
  onTrimEnd,
  onCloseInspector,
  onOpenGraphEditor,
  onAddLayer,
  onSelectLayer,
  onSubViewChange,
  requestedSubView,
  onOpenCopyPasteProps,
  onGroupAction,
}) => {
  const [activeSubView, setActiveSubView] = useState<SelectedSubView>('menu');
  const [showParentModal, setShowParentModal] = useState<boolean>(false);
  const [showEffectsStudio, setShowEffectsStudio] = useState<boolean>(false);

  const isAr = lang === 'ar';
  const selectedLayer = project.layers.find((l) => l.id === project.selectedLayerId);

  useEffect(() => {
    setActiveSubView('menu');
  }, [project.selectedLayerId]);

  useEffect(() => {
    if (requestedSubView?.view) {
      setActiveSubView(requestedSubView.view);
    }
  }, [requestedSubView?.token]);

  useEffect(() => {
    onSubViewChange?.(activeSubView);
  }, [activeSubView, onSubViewChange]);

  if (!selectedLayer) return null;

  const getCopy = (): Layer => JSON.parse(JSON.stringify(selectedLayer));

  const handleTransformChange = (
    propName: 'position' | 'scale' | 'rotation' | 'anchorPoint',
    axis: 'x' | 'y' | 'z',
    val: number
  ) => {
    const prop = selectedLayer.transform[propName];
    const copy: Layer = {
      ...selectedLayer,
      transform: {
        ...selectedLayer.transform,
        [propName]: {
          ...prop,
          value: {
            ...prop.value,
            [axis]: val,
          },
        },
      },
    };
    onUpdateLayer(copy);
  };

  // Unused unused ShaderEffect import guard if needed by callers
  const _ensureEffect = (type: EffectType): ShaderEffect => ({
    id: `eff-${Date.now()}`,
    type,
    name: type,
    enabled: true,
    params: {},
  });
  void _ensureEffect;

  const parentLayer = selectedLayer.parentId
    ? project.layers.find((l) => l.id === selectedLayer.parentId)
    : undefined;

  const isNullLayer = selectedLayer.type === 'null';
  const isGroupLayer = selectedLayer.type === 'group';
  const isCameraLayer = selectedLayer.type === 'camera';
  const isModel3D = selectedLayer.type === 'model3d';
  const is3DText = selectedLayer.type === 'text' && Boolean(selectedLayer.mesh3dConfig?.enabled);
  const spaceStarsEffect = selectedLayer.effects?.find(
    (e) => e.type === 'motionStars' || e.type === 'starfield' || e.type === 'spaceLines'
  );
  const isSpaceLines = spaceStarsEffect?.type === 'spaceLines';

  const subViewTitle = (() => {
    switch (activeSubView) {
      case 'transform':
        return isAr ? 'تحريك وتحويل' : 'Move & Transform';
      case 'shape':
        if (isModel3D) return isAr ? 'العظام والأطراف 3D' : '3D Bones & Limbs';
        if (is3DText) return isAr ? 'إعدادات النص 3D' : '3D Text';
        if (spaceStarsEffect) {
          return isSpaceLines
            ? isAr
              ? 'تخصيص الخطوط'
              : 'Space Lines'
            : isAr
            ? 'تخصيص النجوم'
            : 'Space Stars';
        }
        if (selectedLayer.type === 'text') return isAr ? 'تحرير نص' : 'Edit Text';
        return isAr ? 'تحرير الشكل' : 'Edit Shape';
      case 'limbs':
        return isAr ? 'العظام والأطراف 3D' : '3D Bones & Limbs';
      case 'text3d':
        return isAr ? 'إعدادات النص 3D' : '3D Text Controls';
      case 'camera':
        return isAr ? 'خيارات الكاميرا' : 'Camera Options';
      case 'presets':
        return isAr ? 'قوالب الحركة' : 'Motion Presets';
      case 'color':
        return isAr ? 'اللون والتعبئة' : 'Color & Fill';
      case 'border':
        return isAr ? 'الحدود والظل' : 'Border & Shadow';
      case 'blending':
        return isAr ? 'خلط وتعتيم' : 'Blending & Opacity';
      case 'speed':
        return isAr ? 'السرعة' : 'Speed';
      case 'audio':
        return isAr ? 'الصوت' : 'Audio Level';
      default:
        return '';
    }
  })();

  const effectsCount = selectedLayer.effects?.length || 0;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCloseInspector();
        }
      }}
      className="w-full bg-[#141517] flex flex-col select-none text-slate-200 font-sans flex-1 min-h-0"
    >
      {/* Clean Matte Sub-View Header (matches video 01:06 / 01:14) */}
      <AnimatePresence initial={false}>
        {activeSubView !== 'menu' && activeSubView !== 'effects' && (
          <motion.div
            key="inspector-subview-header"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: PANEL_SPRING }}
            exit={{ opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.13, ease: MODAL_EASE } }}
            className="h-9 bg-[#191A1D] border-b border-white/[0.06] px-3 flex items-center justify-between shrink-0"
          >
            <button
              type="button"
              onClick={() => setActiveSubView('menu')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 hover:text-white transition-colors cursor-pointer"
            >
              {isAr ? <ArrowRight className="w-4 h-4 text-slate-200" /> : <ArrowLeft className="w-4 h-4 text-slate-200" />}
              <span>{subViewTitle}</span>
            </button>

            <div className="flex items-center gap-1.5">
              {activeSubView === 'transform' && (
                <button
                  type="button"
                  onClick={() => setActiveSubView('presets')}
                  className="px-2 py-0.5 rounded-md bg-[#25262A] hover:bg-[#2E3036] text-[10.5px] font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  {isAr ? 'قوالب الحركة' : 'Presets'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteLayer(selectedLayer.id)}
                className="p-1 text-slate-400 hover:text-rose-400 rounded-md transition-colors cursor-pointer"
                title={isAr ? 'حذف الطبقة' : 'Delete Layer'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onCloseInspector}
                className="px-2.5 py-0.5 rounded-md bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[var(--app-accent-border)] text-[10.5px] font-bold text-[var(--app-accent-bright)] flex items-center gap-1 transition-colors cursor-pointer"
                title={isAr ? 'الخروج من الطبقة' : 'Exit Layer'}
              >
                <LogOut className="w-3 h-3 shrink-0" />
                <span>{isAr ? 'خروج' : 'Exit'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="popLayout" initial={false}>
      {/* ================= MAIN MATTE DOCKED LAYER ACTION TOOLBAR ================= */}
      {activeSubView === 'menu' && (
        <motion.div
          key="inspector-menu"
          variants={staggerFastContainerVariants}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="p-2 sm:px-3 sm:py-2 space-y-1.5 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          {/* Row 1: 5 Slim Matte Quick-Action Strip matching f_3.jpg / f_6.jpg / f_52.jpg */}
          <motion.div variants={staggerItemVariants} className="grid grid-cols-5 gap-1.5">
            {/* 1. Speed */}
            <button
              type="button"
              onClick={() => setActiveSubView('speed')}
              className="h-9 bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.97] rounded-[8px] flex items-center justify-center text-slate-200 transition-all cursor-pointer"
              title={isAr ? 'السرعة' : 'Speed'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 17.5a8.5 8.5 0 1 1 13 0" />
                <line x1="12" y1="14" x2="15.8" y2="9.2" />
                <circle cx="12" cy="14" r="1.4" fill="currentColor" />
              </svg>
            </button>

            {/* 2. Trim Start */}
            <button
              type="button"
              onClick={() => onTrimStart(selectedLayer.id, project.currentFrame)}
              className="h-9 bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.97] rounded-[8px] flex items-center justify-center text-slate-200 transition-all cursor-pointer"
              title={isAr ? 'قص البداية عند المؤشر' : 'Trim Start to Playhead'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="4" x2="12" y2="20" />
                <path d="M19 7h-3.5M19 17h-3.5M19 7v10" opacity="0.55" strokeDasharray="2 2" />
                <path d="M5 7h4v10H5" />
              </svg>
            </button>

            {/* 3. Split */}
            <button
              type="button"
              onClick={() => onSplitLayer(selectedLayer.id, project.currentFrame)}
              className="h-9 bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.97] rounded-[8px] flex items-center justify-center text-slate-200 transition-all cursor-pointer"
              title={isAr ? 'تقسيم الطبقة' : 'Split Layer'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="4" x2="12" y2="20" />
                <path d="M5 7h4v10H5" />
                <path d="M19 7h-4v10h4" />
              </svg>
            </button>

            {/* 4. Trim End */}
            <button
              type="button"
              onClick={() => onTrimEnd(selectedLayer.id, project.currentFrame)}
              className="h-9 bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.97] rounded-[8px] flex items-center justify-center text-slate-200 transition-all cursor-pointer"
              title={isAr ? 'قص النهاية عند المؤشر' : 'Trim End to Playhead'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="4" x2="12" y2="20" />
                <path d="M5 7h3.5M5 17h3.5M5 7v10" opacity="0.55" strokeDasharray="2 2" />
                <path d="M19 7h-4v10h4" />
              </svg>
            </button>

            {/* 5. Audio Level */}
            <button
              type="button"
              onClick={() => setActiveSubView('audio')}
              className={`h-9 bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.97] rounded-[8px] flex items-center justify-center transition-all cursor-pointer ${
                isNullLayer || isCameraLayer ? 'text-slate-500' : 'text-slate-200'
              }`}
              title={isAr ? 'مستوى الصوت' : 'Sound Level'}
            >
              {selectedLayer.audioConfig?.muted || isNullLayer || isCameraLayer ? (
                <VolumeX className="w-[18px] h-[18px] stroke-[1.7]" />
              ) : (
                <Volume2 className="w-[18px] h-[18px] stroke-[1.7]" />
              )}
            </button>
          </motion.div>

          {/* Row 2+: Context-Aware Tile Grid matching f_6.jpg (Null = 2 tiles), f_52.jpg (Camera = 3 tiles), f_3.jpg (Visual = 2x3 tiles) */}
          {isNullLayer ? (
            <motion.div variants={staggerItemVariants} className="grid grid-cols-2 gap-1.5">
              {/* تحريك وتحويل */}
              <button
                type="button"
                onClick={() => setActiveSubView('transform')}
                className="h-[74px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" opacity="0.7" />
                  <path d="M12 3v18M3 12h18" />
                  <polyline points="9 5 12 2 15 5" />
                  <polyline points="9 19 12 22 15 19" />
                  <polyline points="5 9 2 12 5 15" />
                  <polyline points="19 9 22 12 19 15" />
                </svg>
                <span className="text-[11px] font-medium text-slate-300">
                  {isAr ? 'تحريك وتحويل' : 'Move & Transform'}
                </span>
              </button>

              {/* التأثيرات */}
              <button
                type="button"
                onClick={() => {
                  if (effectsCount === 0) setShowEffectsStudio(true);
                  else setActiveSubView('effects');
                }}
                className="relative h-[74px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {effectsCount > 0 && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/10 text-[9.5px] font-mono text-slate-200 tabular-nums">
                    {effectsCount}
                  </span>
                )}
                <Sparkles className="w-[22px] h-[22px] text-slate-100 stroke-[1.6]" />
                <span className="text-[11px] font-medium text-slate-300">
                  {isAr ? 'التأثيرات' : 'Effects'}
                </span>
              </button>
            </motion.div>
          ) : isCameraLayer ? (
            <motion.div variants={staggerItemVariants} className="grid grid-cols-3 gap-1.5">
              {/* تحريك وتحويل */}
              <button
                type="button"
                onClick={() => setActiveSubView('transform')}
                className="h-[74px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <svg className="w-[22px] h-[22px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" opacity="0.7" />
                  <path d="M12 3v18M3 12h18" />
                  <polyline points="9 5 12 2 15 5" />
                  <polyline points="9 19 12 22 15 19" />
                  <polyline points="5 9 2 12 5 15" />
                  <polyline points="19 9 22 12 19 15" />
                </svg>
                <span className="text-[11px] font-medium text-slate-300">
                  {isAr ? 'تحريك وتحويل' : 'Move & Transform'}
                </span>
              </button>

              {/* خيارات الكاميرا */}
              <button
                type="button"
                onClick={() => setActiveSubView('camera')}
                className="h-[74px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Camera className="w-[22px] h-[22px] text-slate-100 stroke-[1.65]" />
                <span className="text-[11px] font-medium text-slate-300">
                  {isAr ? 'خيارات الكاميرا' : 'Camera Options'}
                </span>
              </button>

              {/* التأثيرات */}
              <button
                type="button"
                onClick={() => {
                  if (effectsCount === 0) setShowEffectsStudio(true);
                  else setActiveSubView('effects');
                }}
                className="relative h-[74px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {effectsCount > 0 && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/10 text-[9.5px] font-mono text-slate-200 tabular-nums">
                    {effectsCount}
                  </span>
                )}
                <Sparkles className="w-[22px] h-[22px] text-slate-100 stroke-[1.6]" />
                <span className="text-[11px] font-medium text-slate-300">
                  {isAr ? 'التأثيرات' : 'Effects'}
                </span>
              </button>
            </motion.div>
          ) : isGroupLayer ? (
            <motion.div variants={staggerItemVariants} className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSubView('transform')}
                  className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Sliders className="w-[18px] h-[18px] text-slate-100 stroke-[1.65]" />
                  <span className="text-[10.5px] font-medium text-slate-300">
                    {isAr ? 'تحريك وتحويل' : 'Transform'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubView('blending')}
                  className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <FolderOpen className="w-[18px] h-[18px] text-slate-100 stroke-[1.65]" />
                  <span className="text-[10.5px] font-medium text-slate-300">
                    {isAr ? 'خلط وتعتيم' : 'Blend & Opacity'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (effectsCount === 0) setShowEffectsStudio(true);
                    else setActiveSubView('effects');
                  }}
                  className="relative h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  {effectsCount > 0 && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono text-slate-200 tabular-nums">
                      {effectsCount}
                    </span>
                  )}
                  <Sparkles className="w-[18px] h-[18px] text-slate-100 stroke-[1.6]" />
                  <span className="text-[10.5px] font-medium text-slate-300">
                    {isAr ? 'تأثيرات المجموعة' : 'Group FX'}
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const copy = getCopy();
                    const prevCfg = copy.groupConfig || { collapsed: false };
                    copy.groupConfig = { ...prevCfg, composite: !prevCfg.composite };
                    onUpdateLayer(copy);
                  }}
                  className={`h-7 px-2.5 rounded-[7px] text-[10.5px] font-medium cursor-pointer border transition-colors ${
                    Boolean(selectedLayer.groupConfig?.composite)
                      ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border-[var(--app-accent-border)]'
                      : 'bg-[#1D1E21] text-slate-400 border-white/10'
                  }`}
                >
                  {isAr ? 'تجميع التأثيرات (Buffer)' : 'Composite Buffer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const copy = getCopy();
                    const prevCfg = copy.groupConfig || { collapsed: false };
                    copy.groupConfig = { ...prevCfg, clipToBounds: !prevCfg.clipToBounds };
                    onUpdateLayer(copy);
                  }}
                  className={`h-7 px-2.5 rounded-[7px] text-[10.5px] font-medium cursor-pointer border transition-colors ${
                    selectedLayer.groupConfig?.clipToBounds
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : 'bg-[#1D1E21] text-slate-400 border-white/10'
                  }`}
                >
                  {isAr ? 'قص حسب الحدود' : 'Clip Bounds'}
                </button>
                {onGroupAction && (
                  <>
                    <button
                      type="button"
                      onClick={() => onGroupAction('duplicate_group')}
                      className="h-7 px-2.5 rounded-[7px] bg-[#1D1E21] hover:bg-[#26282C] text-slate-200 text-[10.5px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <CopyPlus className="w-3 h-3" />
                      <span>{isAr ? 'تكرار المجموعة' : 'Dup Group'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onGroupAction('ungroup')}
                      className="h-7 px-2.5 rounded-[7px] bg-[#1D1E21] hover:bg-[#26282C] text-amber-300 text-[10.5px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Ungroup className="w-3 h-3" />
                      <span>{isAr ? 'فك المجموعة' : 'Ungroup'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onGroupAction('delete_with_children')}
                      className="h-7 px-2.5 rounded-[7px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10.5px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{isAr ? 'حذف الكل' : 'Delete + Contents'}</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div variants={staggerItemVariants} className="grid grid-cols-3 gap-1.5">
              {/* Row 1, Tile 1: اللون والتعبئة */}
              <button
                type="button"
                onClick={() => setActiveSubView('color')}
                className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <svg className="w-[19px] h-[19px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 11l-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
                  <path d="M5 2l5 5" />
                  <path d="M2 13h15" />
                  <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
                </svg>
                <span className="text-[10.5px] font-medium text-slate-300">
                  {isAr ? 'اللون والتعبئة' : 'Color & Fill'}
                </span>
              </button>

              {/* Row 1, Tile 2: الحدود والظل */}
              <button
                type="button"
                onClick={() => setActiveSubView('border')}
                className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <svg className="w-[19px] h-[19px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
                </svg>
                <span className="text-[10.5px] font-medium text-slate-300">
                  {isAr ? 'الحدود والظل' : 'Border & Shadow'}
                </span>
              </button>

              {/* Row 1, Tile 3: خلط وتعتيم */}
              <button
                type="button"
                onClick={() => setActiveSubView('blending')}
                className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <svg className="w-[19px] h-[19px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 3 21 8.5 12 14 3 8.5 12 3" />
                  <polyline points="3 12.5 12 18 21 12.5" />
                  <polyline points="3 16.5 12 22 21 16.5" />
                </svg>
                <span className="text-[10.5px] font-medium text-slate-300">
                  {isAr ? 'خلط وتعتيم' : 'Blending & Opacity'}
                </span>
              </button>

              {/* Row 2, Tile 4: تحريك وتحويل */}
              <button
                type="button"
                onClick={() => setActiveSubView('transform')}
                className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <svg className="w-[19px] h-[19px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" opacity="0.7" />
                  <path d="M12 3v18M3 12h18" />
                  <polyline points="9 5 12 2 15 5" />
                  <polyline points="9 19 12 22 15 19" />
                  <polyline points="5 9 2 12 5 15" />
                  <polyline points="19 9 22 12 19 15" />
                </svg>
                <span className="text-[10.5px] font-medium text-slate-300">
                  {isAr ? 'تحريك وتحويل' : 'Move & Transform'}
                </span>
              </button>

              {/* Row 2, Tile 5: Contextual Edit Tile (Text / Shape / 3D Bones / 3D Text) */}
              <button
                type="button"
                onClick={() => {
                  if (isModel3D) setActiveSubView('limbs');
                  else if (is3DText) setActiveSubView('text3d');
                  else setActiveSubView('shape');
                }}
                className="h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                {isModel3D ? (
                  <Bone className="w-[19px] h-[19px] text-slate-100 stroke-[1.65]" />
                ) : is3DText ? (
                  <Box className="w-[19px] h-[19px] text-slate-100 stroke-[1.65]" />
                ) : spaceStarsEffect ? (
                  isSpaceLines ? (
                    <ArrowUpRight className="w-[19px] h-[19px] text-purple-300 stroke-[1.75]" />
                  ) : (
                    <Star className="w-[19px] h-[19px] text-cyan-300 stroke-[1.65]" />
                  )
                ) : selectedLayer.type === 'text' ? (
                  <span className="text-[16px] font-semibold tracking-tight text-slate-100 leading-none">
                    A<span className="text-[12px]">a</span>
                  </span>
                ) : (
                  <Sliders className="w-[19px] h-[19px] text-slate-100 stroke-[1.65]" />
                )}
                <span className="text-[10.5px] font-medium text-slate-300">
                  {isModel3D
                    ? isAr
                      ? 'العظام والأطراف'
                      : '3D Bones'
                    : is3DText
                    ? isAr
                      ? 'إعدادات 3D'
                      : '3D Text'
                    : spaceStarsEffect
                    ? isSpaceLines
                      ? isAr
                        ? 'تخصيص الخطوط'
                        : 'Space Lines'
                      : isAr
                      ? 'تخصيص النجوم'
                      : 'Space Stars'
                    : selectedLayer.type === 'text'
                    ? isAr
                      ? 'تحرير نص'
                      : 'Edit Text'
                    : isAr
                    ? 'تحرير الشكل'
                    : 'Edit Shape'}
                </span>
              </button>

              {/* Row 2, Tile 6: التأثيرات */}
              <button
                type="button"
                onClick={() => {
                  if (effectsCount === 0) setShowEffectsStudio(true);
                  else setActiveSubView('effects');
                }}
                className="relative h-[48px] bg-[#222326] hover:bg-[#2A2C30] active:scale-[0.98] rounded-[10px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                {effectsCount > 0 && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono text-slate-200 tabular-nums">
                    {effectsCount}
                  </span>
                )}
                <svg className="w-[19px] h-[19px] text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round">
                  <line x1="12" y1="3" x2="12" y2="21" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
                  <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
                  <circle cx="12" cy="12" r="2.2" fill="#141517" />
                </svg>
                <span className="text-[10.5px] font-medium text-slate-300">
                  {isAr ? 'التأثيرات' : 'Effects'}
                </span>
              </button>
            </motion.div>
          )}

          {/* Slim Compact Utility Row: Parent Link + 3D Stability + Quick Presets + Exit Layer */}
          <motion.div variants={staggerItemVariants} className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
            {/* Parent Link Button */}
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => setShowParentModal(true)}
                className={`h-7 px-2.5 rounded-[7px] text-[10.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer truncate ${
                  parentLayer
                    ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)]'
                    : 'bg-[#1D1E21] hover:bg-[#26282C] text-slate-300'
                }`}
              >
                <Link className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[130px]">
                  {parentLayer
                    ? `${isAr ? 'مرتبط بـ' : 'Parent:'} ${parentLayer.name}`
                    : isAr
                    ? 'ربط أبوي (Null)'
                    : 'Link Parent'}
                </span>
              </button>
              {parentLayer && (
                <button
                  type="button"
                  onClick={() => {
                    const copy = getCopy();
                    copy.parentId = undefined;
                    onUpdateLayer(copy);
                  }}
                  className="h-7 px-2 rounded-[7px] bg-[#1D1E21] hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 text-[10px] flex items-center gap-1 cursor-pointer"
                  title={isAr ? 'فك الارتباط' : 'Unlink'}
                >
                  <Unlink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 3D Stability / Quick Presets / Exit Layer */}
            <div className="flex flex-wrap items-center gap-1 shrink-0">
              {!isCameraLayer && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = getCopy();
                      copy.fixedIn3D = !copy.fixedIn3D;
                      onUpdateLayer(copy);
                    }}
                    className={`h-7 px-2 rounded-[7px] text-[10px] font-medium transition-colors cursor-pointer ${
                      selectedLayer.fixedIn3D
                        ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)]'
                        : 'bg-[#1D1E21] hover:bg-[#26282C] text-slate-400 hover:text-slate-200'
                    }`}
                    title={isAr ? 'تثبيت الطبقة خارج فضاء 3D' : 'Fix layer out of 3D space'}
                  >
                    {isAr ? 'تثبيت 3D' : 'Fixed 3D'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = getCopy();
                      copy.billboard = !copy.billboard;
                      onUpdateLayer(copy);
                    }}
                    className={`h-7 px-2 rounded-[7px] text-[10px] font-medium transition-colors cursor-pointer ${
                      selectedLayer.billboard
                        ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)]'
                        : 'bg-[#1D1E21] hover:bg-[#26282C] text-slate-400 hover:text-slate-200'
                    }`}
                    title={isAr ? 'مواجهة الكاميرا دائماً' : 'Face camera (Billboard)'}
                  >
                    {isAr ? 'منع الالتفاف' : 'Billboard'}
                  </button>
                </>
              )}
              {onOpenCopyPasteProps && (
                <button
                  type="button"
                  onClick={onOpenCopyPasteProps}
                  className="h-7 px-2 rounded-[7px] bg-[#1D1E21] hover:bg-[#26282C] text-[var(--app-accent-bright)] text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                  title={isAr ? 'نسخ ولصق خصائص الطبقة' : 'Copy & Paste Properties'}
                >
                  <ClipboardCopy className="w-3 h-3 shrink-0" />
                  <span>{isAr ? 'نسخ الخصائص' : 'Copy Props'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSubView('presets')}
                className="h-7 px-2 rounded-[7px] bg-[#1D1E21] hover:bg-[#26282C] text-slate-300 text-[10px] font-medium cursor-pointer"
              >
                {isAr ? 'حركة سريعة' : 'Presets'}
              </button>
              <button
                type="button"
                onClick={onCloseInspector}
                className="h-7 px-2.5 rounded-[7px] bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[var(--app-accent-border)] text-[var(--app-accent-bright)] text-[10.5px] font-bold flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                title={isAr ? 'الخروج من الطبقة' : 'Exit Layer'}
              >
                <LogOut className="w-3 h-3 shrink-0" />
                <span>{isAr ? 'خروج من الطبقة' : 'Exit Layer'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* SUB-VIEW 1: MOVE & TRANSFORM */}
      {activeSubView === 'transform' && (
        <motion.div
          key="inspector-transform"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="flex-1 flex flex-col min-h-0"
        >
          <AlightMoveTransformPad
            layer={selectedLayer}
            allLayers={project.layers}
            lang={lang}
            currentFrame={project.currentFrame}
            onUpdateLayer={onUpdateLayer}
            onUpdateLayers={onUpdateLayers}
            onAddKeyframe={onAddKeyframe}
            onSetCurrentFrame={onSetCurrentFrame}
            onOpenGraphEditor={onOpenGraphEditor}
          />
        </motion.div>
      )}

      {/* SUB-VIEW: CAMERA OPTIONS */}
      {activeSubView === 'camera' && (
        <motion.div
          key="inspector-camera"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-3 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-300" />
                <span>{isAr ? 'البعد البؤري / الزوم (FOV)' : 'Camera FOV / Zoom'}</span>
              </span>
              <span className="font-mono text-slate-100 font-semibold tabular-nums">
                {Math.round(selectedLayer.transform.scale.value.x || 100)}%
              </span>
            </div>
            <PrecisionRulerScrubber
              value={selectedLayer.transform.scale.value.x || 100}
              min={30}
              max={200}
              step={1}
              decimals={0}
              unit="%"
              defaultValue={100}
              ariaLabel={isAr ? 'البعد البؤري' : 'Camera FOV'}
              onChange={(val) => {
                const next = Math.round(val);
                if (next === Math.round(selectedLayer.transform.scale.value.x || 100)) return;
                const copy: Layer = {
                  ...selectedLayer,
                  transform: {
                    ...selectedLayer.transform,
                    scale: {
                      ...selectedLayer.transform.scale,
                      value: {
                        ...selectedLayer.transform.scale.value,
                        x: next,
                        y: next,
                      },
                    },
                  },
                };
                onUpdateLayer(copy);
              }}
            />
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 2: EDIT SHAPE / TEXT */}
      {activeSubView === 'shape' && (
        <motion.div
          key="inspector-shape"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-3 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          {selectedLayer.vectorConfig ? (
            <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{isAr ? 'العرض' : 'Width'}</span>
                  <span className="font-mono text-slate-100 tabular-nums">{selectedLayer.vectorConfig.width}px</span>
                </div>
                <PrecisionRulerScrubber
                  value={selectedLayer.vectorConfig.width}
                  min={20}
                  max={1000}
                  step={1}
                  decimals={0}
                  unit="px"
                  defaultValue={200}
                  ariaLabel={isAr ? 'العرض' : 'Width'}
                  onChange={(val) => {
                    const nextW = Math.round(val);
                    if (!selectedLayer.vectorConfig || nextW === selectedLayer.vectorConfig.width) return;
                    onUpdateLayer({
                      ...selectedLayer,
                      vectorConfig: {
                        ...selectedLayer.vectorConfig,
                        width: nextW,
                      },
                    });
                  }}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{isAr ? 'الارتفاع' : 'Height'}</span>
                  <span className="font-mono text-slate-100 tabular-nums">{selectedLayer.vectorConfig.height}px</span>
                </div>
                <PrecisionRulerScrubber
                  value={selectedLayer.vectorConfig.height}
                  min={20}
                  max={1000}
                  step={1}
                  decimals={0}
                  unit="px"
                  defaultValue={200}
                  ariaLabel={isAr ? 'الارتفاع' : 'Height'}
                  onChange={(val) => {
                    const nextH = Math.round(val);
                    if (!selectedLayer.vectorConfig || nextH === selectedLayer.vectorConfig.height) return;
                    onUpdateLayer({
                      ...selectedLayer,
                      vectorConfig: {
                        ...selectedLayer.vectorConfig,
                        height: nextH,
                      },
                    });
                  }}
                />
              </div>
            </div>
          ) : selectedLayer.textConfig ? (
            <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-3">
              <textarea
                rows={2}
                dir="auto"
                value={selectedLayer.textConfig.text || ''}
                placeholder={isAr ? 'اكتب النص هنا...' : 'Type text here...'}
                onChange={(e) => {
                  const copy = getCopy();
                  if (copy.textConfig) copy.textConfig.text = e.target.value;
                  onUpdateLayer(copy);
                }}
                className="w-full bg-[#141517] border border-white/10 p-2.5 rounded-lg text-sm font-medium text-white focus:outline-none focus:border-[var(--app-accent-bright)] font-['Cairo',sans-serif]"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 block">
                    {isAr ? 'الخط' : 'Font Family'}
                  </span>
                  <select
                    value={selectedLayer.textConfig.fontFamily || 'Cairo'}
                    onChange={(e) => {
                      const val = e.target.value;
                      const copy = getCopy();
                      if (copy.textConfig) copy.textConfig.fontFamily = val;
                      onUpdateLayer(copy);
                      const cleanFamily = val.replace(/['"]/g, '').split(',')[0].trim();
                      ensureGoogleFontLoaded(cleanFamily).then((loaded) => {
                        if (loaded) {
                          const refreshed = getCopy();
                          if (refreshed.textConfig) refreshed.textConfig.fontFamily = val;
                          onUpdateLayer(refreshed);
                        }
                      });
                    }}
                    className="w-full bg-[#141517] border border-white/10 p-2 rounded-lg text-xs font-medium text-slate-100 focus:outline-none"
                  >
                    <option value="'Reem Kufi', sans-serif">Reem Kufi</option>
                    <option value="'Aref Ruqaa', serif">Aref Ruqaa</option>
                    <option value="'Lalezar', cursive">Lalezar</option>
                    <option value="'Gulzar', serif">Gulzar</option>
                    <option value="'Marhey', cursive">Marhey</option>
                    <option value="Cairo">Cairo</option>
                    <option value="Tajawal">Tajawal</option>
                    <option value="Amiri">Amiri</option>
                    <option value="Alexandria">Alexandria</option>
                    <option value="Almarai">Almarai</option>
                    <option value="Readex Pro">Readex Pro</option>
                    <option value="Changa">Changa</option>
                    <option value="Vazirmatn">Vazirmatn</option>
                    <optgroup label={isAr ? 'خطوط Google عبر الإنترنت' : 'Online Google Fonts'}>
                      {ONLINE_GOOGLE_FONTS.map((f) => (
                        <option key={f.family} value={f.family}>
                          {isAr ? f.labelAr : f.labelEn}
                        </option>
                      ))}
                    </optgroup>
                    <option value="sans-serif">System Sans</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-400 block">
                    {isAr ? 'المحاذاة' : 'Alignment'}
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-[#141517] p-1 rounded-lg border border-white/10">
                    {(['right', 'center', 'left'] as const).map((al) => (
                      <button
                        key={al}
                        type="button"
                        onClick={() => {
                          const copy = getCopy();
                          if (copy.textConfig) copy.textConfig.align = al;
                          onUpdateLayer(copy);
                        }}
                        className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                          (selectedLayer.textConfig?.align || 'right') === al
                            ? 'bg-[#2E3036] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {al === 'right' ? (isAr ? 'يمين' : 'Right') : al === 'center' ? (isAr ? 'وسط' : 'Center') : isAr ? 'يسار' : 'Left'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{isAr ? 'حجم الخط' : 'Font Size'}</span>
                    <span className="font-mono text-slate-100 tabular-nums">{selectedLayer.textConfig.fontSize}px</span>
                  </div>
                  <PrecisionRulerScrubber
                    value={selectedLayer.textConfig.fontSize}
                    min={12}
                    max={200}
                    step={0.5}
                    decimals={1}
                    unit="px"
                    defaultValue={48}
                    ariaLabel={isAr ? 'حجم الخط' : 'Font Size'}
                    onChange={(val) => {
                      const copy = getCopy();
                      if (copy.textConfig) copy.textConfig.fontSize = Math.round(val * 10) / 10;
                      onUpdateLayer(copy);
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{isAr ? 'سمك الحد' : 'Stroke Width'}</span>
                    <span className="font-mono text-slate-100 tabular-nums">{selectedLayer.textConfig.strokeWidth || 0}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <PrecisionRulerScrubber
                        value={selectedLayer.textConfig.strokeWidth || 0}
                        min={0}
                        max={20}
                        step={0.25}
                        decimals={1}
                        unit="px"
                        defaultValue={0}
                        ariaLabel={isAr ? 'سمك الحد' : 'Stroke Width'}
                        onChange={(val) => {
                          const copy = getCopy();
                          if (copy.textConfig) copy.textConfig.strokeWidth = val;
                          onUpdateLayer(copy);
                        }}
                      />
                    </div>
                    <input
                      type="color"
                      value={selectedLayer.textConfig.stroke || '#ffffff'}
                      onChange={(e) => {
                        const copy = getCopy();
                        if (copy.textConfig) copy.textConfig.stroke = e.target.value;
                        onUpdateLayer(copy);
                      }}
                      className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer shrink-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : selectedLayer.type === 'model3d' ? (
            <Model3DRigInspector layer={selectedLayer} lang={lang} onUpdateLayer={onUpdateLayer} />
          ) : is3DText ? (
            <Text3DInspector layer={selectedLayer} lang={lang} onUpdateLayer={onUpdateLayer} />
          ) : spaceStarsEffect ? (
            <SpaceStarsInspector
              layer={selectedLayer}
              effect={spaceStarsEffect}
              lang={lang}
              onUpdateLayer={onUpdateLayer}
              onAddKeyframe={onAddKeyframe}
            />
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs">
              {isAr ? 'لا توجد إعدادات شكل قابلة للتعديل لهذا العنصر' : 'No shape settings for this layer type'}
            </div>
          )}
        </motion.div>
      )}

      {/* SUB-VIEW LIMBS */}
      {activeSubView === 'limbs' && (
        <motion.div
          key="inspector-limbs"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-2 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <Model3DRigInspector layer={selectedLayer} lang={lang} onUpdateLayer={onUpdateLayer} />
        </motion.div>
      )}

      {/* SUB-VIEW TEXT3D */}
      {activeSubView === 'text3d' && (
        <motion.div
          key="inspector-text3d"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-2 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <Text3DInspector layer={selectedLayer} lang={lang} onUpdateLayer={onUpdateLayer} />
        </motion.div>
      )}

      {/* SUB-VIEW 3: PRESETS */}
      {activeSubView === 'presets' && (
        <motion.div
          key="inspector-presets"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-2 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const copy = getCopy();
                copy.transform.scale.keyframes = [
                  { id: `k-${Date.now()}-1`, frame: 0, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' },
                  { id: `k-${Date.now()}-2`, frame: 25, value: { x: 165, y: 165, z: 100 }, easing: 'ease-out' },
                ];
                onUpdateLayer(copy);
              }}
              className="p-3 bg-[#222326] hover:bg-[#2A2C30] rounded-[10px] flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4 text-[var(--app-accent-bright)]" />
              <span>{isAr ? 'تقريب سريع (Zoom In)' : 'Zoom In'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const copy = getCopy();
                copy.transform.rotation.keyframes = [
                  { id: `k-${Date.now()}-1`, frame: 0, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' },
                  { id: `k-${Date.now()}-2`, frame: 30, value: { x: 0, y: 0, z: 360 }, easing: 'ease-out' },
                ];
                onUpdateLayer(copy);
              }}
              className="p-3 bg-[#222326] hover:bg-[#2A2C30] rounded-[10px] flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-slate-200" />
              <span>{isAr ? 'دوران كامل 360°' : 'Full Spin'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 4: EFFECTS */}
      {activeSubView === 'effects' && (
        <motion.div
          key="inspector-effects"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="flex-1 flex flex-col min-h-0"
        >
          <AlightEffectsView
            project={project}
            lang={lang}
            selectedLayer={selectedLayer}
            onUpdateLayer={onUpdateLayer}
            onBack={() => setActiveSubView('menu')}
            onExitLayer={onCloseInspector}
            onAddKeyframe={onAddKeyframe}
          />
        </motion.div>
      )}

      {/* SUB-VIEW 5: COLOR & FILL */}
      {activeSubView === 'color' && (
        <motion.div
          key="inspector-color"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-3 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{isAr ? 'لون التعبئة' : 'Fill Color'}</span>
              <input
                type="color"
                value={
                  selectedLayer.vectorConfig?.fill ||
                  selectedLayer.textConfig?.fill ||
                  selectedLayer.solidColor ||
                  (spaceStarsEffect?.params?.color ? String(spaceStarsEffect.params.color) : '#ffffff')
                }
                onChange={(e) => {
                  const copy = getCopy();
                  if (copy.vectorConfig) copy.vectorConfig.fill = e.target.value;
                  if (copy.textConfig) copy.textConfig.fill = e.target.value;
                  if (copy.type === 'solid') copy.solidColor = e.target.value;
                  const starFx = copy.effects?.find(
                    (ef) => ef.type === 'motionStars' || ef.type === 'starfield' || ef.type === 'spaceLines'
                  );
                  if (starFx) starFx.params.color = e.target.value;
                  onUpdateLayer(copy);
                }}
                className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
              />
            </div>

            {spaceStarsEffect && (
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>
                  {isSpaceLines
                    ? isAr
                      ? 'اللون الثانوي للخطوط'
                      : 'Secondary Line Color'
                    : isAr
                    ? 'اللون الثانوي للنجوم'
                    : 'Secondary Star Color'}
                </span>
                <input
                  type="color"
                  value={String(spaceStarsEffect.params?.secondaryColor || '#F1F5F9')}
                  onChange={(e) => {
                    const copy = getCopy();
                    const starFx = copy.effects?.find(
                      (ef) => ef.type === 'motionStars' || ef.type === 'starfield' || ef.type === 'spaceLines'
                    );
                    if (starFx) starFx.params.secondaryColor = e.target.value;
                    onUpdateLayer(copy);
                  }}
                  className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {['#FFFFFF', '#000000', '#5EEB9A', '#38BDF8', '#F59E0B', '#EC4899', '#A855F7', '#EF4444'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const copy = getCopy();
                    if (copy.vectorConfig) copy.vectorConfig.fill = c;
                    if (copy.textConfig) copy.textConfig.fill = c;
                    if (copy.type === 'solid') copy.solidColor = c;
                    const starFx = copy.effects?.find(
                      (ef) => ef.type === 'motionStars' || ef.type === 'starfield' || ef.type === 'spaceLines'
                    );
                    if (starFx) starFx.params.color = c;
                    onUpdateLayer(copy);
                  }}
                  className="w-8 h-8 rounded-full border border-white/15 hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 6: BORDER & SHADOW */}
      {activeSubView === 'border' && (
        <motion.div
          key="inspector-border"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-3 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>{isAr ? 'سماكة الحدود' : 'Stroke Width'}</span>
              <span className="font-mono tabular-nums text-slate-100">
                {selectedLayer.vectorConfig?.strokeWidth ?? selectedLayer.textConfig?.strokeWidth ?? 0}px
              </span>
            </div>

            <PrecisionRulerScrubber
              value={selectedLayer.vectorConfig?.strokeWidth ?? selectedLayer.textConfig?.strokeWidth ?? 0}
              min={0}
              max={30}
              step={0.5}
              decimals={1}
              unit="px"
              defaultValue={0}
              ariaLabel={isAr ? 'سماكة الحدود' : 'Stroke Width'}
              onChange={(val) => {
                const copy = getCopy();
                if (copy.vectorConfig) copy.vectorConfig.strokeWidth = val;
                if (copy.textConfig) copy.textConfig.strokeWidth = val;
                onUpdateLayer(copy);
              }}
            />
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 7: BLENDING & OPACITY */}
      {activeSubView === 'blending' && (
        <motion.div
          key="inspector-blending"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-2.5 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">{isAr ? 'التعتيم' : 'Opacity'}</span>
              <span className="font-mono text-slate-100 tabular-nums">
                {Math.round(selectedLayer.transform.opacity.value)}%
              </span>
            </div>

            <PrecisionRulerScrubber
              value={selectedLayer.transform.opacity.value}
              min={0}
              max={100}
              step={0.5}
              decimals={1}
              unit="%"
              defaultValue={100}
              ariaLabel={isAr ? 'التعتيم' : 'Opacity'}
              onChange={(val) => {
                const copy = getCopy();
                copy.transform.opacity.value = val;
                onUpdateLayer(copy);
              }}
            />
          </div>

          <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-300 shrink-0">
              {isAr ? 'وضع المزج' : 'Blend Mode'}
            </span>

            <select
              value={selectedLayer.blendMode}
              onChange={(e) => onUpdateLayer({ ...getCopy(), blendMode: e.target.value as BlendMode })}
              className="bg-[#141517] border border-white/10 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
            >
              <option value="normal">{isAr ? 'عادي (Normal)' : 'Normal'}</option>
              <option value="multiply">{isAr ? 'ضرب (Multiply)' : 'Multiply'}</option>
              <option value="screen">{isAr ? 'شاشة (Screen)' : 'Screen'}</option>
              <option value="overlay">{isAr ? 'تراكب (Overlay)' : 'Overlay'}</option>
              <option value="add">{isAr ? 'إضافة (Add)' : 'Add'}</option>
              <option value="difference">{isAr ? 'الفرق (Difference)' : 'Difference'}</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 8: SPEED */}
      {activeSubView === 'speed' && (
        <motion.div
          key="inspector-speed"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-2.5 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="grid grid-cols-4 gap-2">
            {[0.25, 0.5, 1, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const copy = getCopy();
                  copy.timeScale = s;
                  onUpdateLayer(copy);
                }}
                className={`py-2.5 rounded-[10px] text-xs font-mono font-semibold transition-all cursor-pointer ${
                  (selectedLayer.timeScale || 1) === s
                    ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)]'
                    : 'bg-[#222326] text-slate-300 hover:bg-[#2A2C30]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* SUB-VIEW 9: AUDIO */}
      {activeSubView === 'audio' && (
        <motion.div
          key="inspector-audio"
          initial={{ opacity: 0, x: isAr ? -44 : 44, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
          exit={{ opacity: 0, x: isAr ? 24 : -24, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
          className="p-3 space-y-2.5 flex-1 overflow-y-auto overscroll-contain max-w-2xl mx-auto w-full"
        >
          <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>{isAr ? 'مستوى الصوت' : 'Volume'}</span>
              <span className="font-mono tabular-nums text-slate-100">
                {Math.round((selectedLayer.audioConfig?.volume ?? 1) * 100)}%
              </span>
            </div>

            <PrecisionRulerScrubber
              value={selectedLayer.audioConfig?.volume ?? 1}
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              defaultValue={1}
              ariaLabel={isAr ? 'مستوى الصوت' : 'Volume'}
              onChange={(val) => {
                const copy = getCopy();
                if (!copy.audioConfig) {
                  copy.audioConfig = { src: copy.mediaUrl || '', volume: 1, muted: false };
                }
                copy.audioConfig.volume = val;
                onUpdateLayer(copy);
              }}
            />
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Effects Browser Modal */}
      <AnimatePresence>
        {showEffectsStudio && (
          <AlightEffectsStudioModal
            project={project}
            lang={lang}
            selectedLayer={selectedLayer}
            onUpdateLayer={onUpdateLayer}
            onClose={() => {
              setShowEffectsStudio(false);
              if (selectedLayer.effects && selectedLayer.effects.length > 0) {
                setActiveSubView('effects');
              }
            }}
            onAddKeyframe={onAddKeyframe}
          />
        )}
      </AnimatePresence>

      {/* Direct Layer Parenting Modal */}
      <LayerParentModal
        isOpen={showParentModal}
        onClose={() => setShowParentModal(false)}
        selectedLayer={selectedLayer}
        layers={project.layers}
        lang={lang}
        onUpdateLayer={onUpdateLayer}
        onAddLayer={onAddLayer}
        onSelectLayer={onSelectLayer}
      />
    </div>
  );
};
