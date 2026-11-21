import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, Keyframe, CollabMember } from '../types';
import { MODAL_EASE, PILL_SPRING } from './MotionPrimitives';
import { buildVisibleTimelineRows, shiftGroupTiming } from '../engine/groupUtils';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Layers as LayersIcon,
  Diamond,
  Scissors,
  Sparkles,
  Volume2,
  Type as TypeIcon,
  Square,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize2,
  CopyPlus,
  Target,
  Camera,
  Link,
  Image as ImageIcon,
  Video,
  Box,
  Folder,
  FolderOpen,
  FolderPlus,
  X,
} from 'lucide-react';

interface TimelineProps {
  project: Project;
  lang: Language;
  onSelectLayer: (id: string | null) => void;
  onSetCurrentFrame: (frame: number) => void;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onUpdateLayers?: (updatedLayers: Layer[], immediateHistory?: boolean) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onAddKeyframe: (layerId: string, propertyPath: string) => void;
  onDeleteKeyframe: (layerId: string, propertyPath: string, keyframeId: string) => void;
  onSplitLayer: (layerId: string, frame?: number) => void;
  onTrimStart?: (layerId: string, frame: number) => void;
  onTrimEnd?: (layerId: string, frame: number) => void;
  onTogglePlay?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isSideToolsOpen?: boolean;
  onToggleSideTools?: () => void;
  showAddModal?: boolean;
  onCloseAddModal?: () => void;
  onAddLayer?: (type: Layer['type'], customConfig?: any) => void;
  onOpenAddModal?: () => void;
  onOpenTemplates?: () => void;
  isSubViewOpen?: boolean;
  multiSelectedIds?: string[];
  onToggleMultiSelect?: (id: string) => void;
  onClearMultiSelect?: () => void;
  onGroupSelected?: () => void;
  collabMembers?: CollabMember[];
  localMemberId?: string;
}

const TimelineBase: React.FC<TimelineProps> = ({
  project,
  lang,
  onSelectLayer,
  onSetCurrentFrame,
  onUpdateLayer,
  onUpdateLayers,
  onDeleteLayer,
  onDuplicateLayer,
  onAddKeyframe,
  onDeleteKeyframe,
  onSplitLayer,
  onTrimStart,
  onTrimEnd,
  onTogglePlay,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isSideToolsOpen = false,
  onToggleSideTools,
  showAddModal = false,
  onCloseAddModal,
  onAddLayer,
  onOpenAddModal,
  onOpenTemplates,
  isSubViewOpen = false,
  multiSelectedIds = [],
  onToggleMultiSelect,
  onClearMultiSelect,
  onGroupSelected,
  collabMembers = [],
  localMemberId,
}) => {
  const [zoom, setZoom] = useState<number>(4); // pixels per frame
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Trimming / Clip dragging state (left/right trim handles)
  const [clipDrag, setClipDrag] = useState<{
    layerId: string;
    mode: 'move' | 'trim-start' | 'trim-end';
    startX: number;
    initialStartFrame: number;
    initialDurationFrames: number;
  } | null>(null);

  // 2D Layer Long-Press Drag (Up/Down reorder above/below layers + Left/Right timeline shift)
  const [layerDrag, setLayerDrag] = useState<{
    layerId: string;
    initialIndex: number;
    targetIndex: number;
    startX: number;
    startY: number;
    deltaX: number;
    deltaY: number;
    initialStartFrame: number;
    durationFrames: number;
    currentStartFrame: number;
    isDragging: boolean;
  } | null>(null);

  const layerDragRef = useRef(layerDrag);
  layerDragRef.current = layerDrag;

  const pendingLayerRef = useRef<{
    layerId: string;
    initialIndex: number;
    initialStartFrame: number;
    durationFrames: number;
    startX: number;
    startY: number;
    isTouch: boolean;
    timer: number;
  } | null>(null);

  // Keyframe long-press & drag-to-move state
  const [kfDrag, setKfDrag] = useState<{
    sourceLayerId: string;
    sourceRelFrame: number;
    sourceAbsFrame: number;
    currentAbsFrame: number;
    targetLayerId: string;
    types: string[];
    isDragging: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const kfDragRef = useRef(kfDrag);
  kfDragRef.current = kfDrag;

  const pendingKfRef = useRef<{
    layerId: string;
    relFrame: number;
    absFrame: number;
    types: string[];
    startX: number;
    startY: number;
    timer: number;
  } | null>(null);

  const justFinishedDragRef = useRef<boolean>(false);
  const markDragJustFinished = () => {
    justFinishedDragRef.current = true;
    window.setTimeout(() => {
      justFinishedDragRef.current = false;
    }, 180);
  };

  const [timelineToast, setTimelineToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const layerListRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const trackTapStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setTimelineToast(msg);
    toastTimeoutRef.current = window.setTimeout(() => setTimelineToast(null), 2500);
  };

  const totalFrames = project.settings.durationFrames;
  const fps = project.settings.fps;

  // Respect collapsed groups via hierarchical visible rows
  const visibleRows = React.useMemo(
    () => buildVisibleTimelineRows(project.layers),
    [project.layers]
  );

  useEffect(() => {
    if (!project.selectedLayerId || !trackContainerRef.current) return;
    const idx = visibleRows.findIndex((r) => r.layer.id === project.selectedLayerId);
    if (idx < 0) return;
    const raf = requestAnimationFrame(() => {
      if (!trackContainerRef.current) return;
      const targetTop = idx * 48;
      trackContainerRef.current.scrollTop = targetTop;
      if (layerListRef.current) {
        layerListRef.current.scrollTop = targetTop;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [project.selectedLayerId, visibleRows.length, isSubViewOpen]);

  const selectedLayer =
    project.layers.find((l) => l.id === project.selectedLayerId) ||
    (project.layers.length > 0 ? project.layers[0] : undefined);
  const selectedLayerKeyframes: number[] = selectedLayer
    ? Array.from(
        new Set([
          ...(selectedLayer.transform.position.keyframes || []).map((k) => selectedLayer.startFrame + k.frame),
          ...(selectedLayer.transform.rotation.keyframes || []).map((k) => selectedLayer.startFrame + k.frame),
          ...(selectedLayer.transform.scale.keyframes || []).map((k) => selectedLayer.startFrame + k.frame),
          ...(selectedLayer.transform.opacity.keyframes || []).map((k) => selectedLayer.startFrame + k.frame),
        ])
      ).sort((a, b) => a - b)
    : [];

  const prevKf = [...selectedLayerKeyframes].reverse().find((f) => f < project.currentFrame - 0.5);
  const nextKf = selectedLayerKeyframes.find((f) => f > project.currentFrame + 0.5);

  // Format frame into 00:00:00 (Hours:Minutes:Seconds / Frames)
  const formatTimecode = (frame: number) => {
    const totalSecs = Math.floor(frame / fps);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const f = frame % fps;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}:${pad(f)}`;
  };

  // Helper to format duration in seconds and frames (e.g. 1.50s / 45f)
  const formatDurationSecs = (frames: number) => {
    const secs = (frames / (fps || 30)).toFixed(2);
    return `${secs}s`;
  };

  // Helper to get authentic Alight Motion clip styling matching screenshot
  const getLayerClipStyle = (l: Layer, index: number = 0): { bg: string; isLight: boolean } => {
    if (l.color && l.color !== '#3B82F6' && l.color !== '#00E676' && l.color !== '#ffffff') {
      return { bg: l.color, isLight: false };
    }
    if (l.type === 'text') {
      // Warm matte golden-sand as shown in reference screenshot
      const textGolds = ['#E3B965', '#D9AE59', '#E7C172'];
      return { bg: textGolds[index % textGolds.length], isLight: true };
    }
    if (l.type === 'null') {
      const nullReds = ['#E06B6B', '#D95B5B', '#E57C7C'];
      return { bg: nullReds[index % nullReds.length], isLight: false };
    }
    if (l.type === 'audio') {
      const audioPurples = ['#9E78DC', '#8C65CE', '#AD89E6'];
      return { bg: audioPurples[index % audioPurples.length], isLight: false };
    }
    if (l.type === 'video' || l.type === 'image') {
      const cyanColors = ['#5BA9CE', '#4D9AC0', '#6AB7DA'];
      return { bg: cyanColors[index % cyanColors.length], isLight: true };
    }
    if (l.type === 'camera') {
      const cameraAmbers = ['#E59F54', '#DA9145', '#EDAC65'];
      return { bg: cameraAmbers[index % cameraAmbers.length], isLight: true };
    }
    if (l.type === 'model3d') {
      const modelCyans = ['#38BDF8', '#22D3EE', '#0EA5E9'];
      return { bg: modelCyans[index % modelCyans.length], isLight: true };
    }
    if (l.type === 'group') {
      return { bg: l.groupConfig?.color || '#38BDF8', isLight: false };
    }
    if (l.type === 'vector' || l.type === 'solid') {
      const shapeGreens = ['#67BA8E', '#58AC80', '#77C59C'];
      return { bg: shapeGreens[index % shapeGreens.length], isLight: true };
    }
    const generalPalette = ['#E3B965', '#67BA8E', '#5BA9CE', '#9E78DC', '#E06B6B'];
    return { bg: generalPalette[index % generalPalette.length], isLight: index === 0 || index === 1 || index === 2 };
  };

  // Keyframe drag finalization (strictly locked to sourceLayerId - never transfers to another layer)
  const finalizeKfDrag = () => {
    const activeDrag = kfDragRef.current;
    if (!activeDrag || !activeDrag.isDragging) {
      setKfDrag(null);
      return;
    }

    const { sourceLayerId, sourceRelFrame, currentAbsFrame } = activeDrag;
    const newAbsFrame = Math.max(0, Math.min(totalFrames - 1, currentAbsFrame));

    const sourceLayer = project.layers.find((l) => l.id === sourceLayerId);
    if (sourceLayer) {
      const copy: Layer = JSON.parse(JSON.stringify(sourceLayer));
      const oldStart = copy.startFrame;
      const oldEnd = copy.startFrame + copy.durationFrames - 1;

      if (newAbsFrame < oldStart) {
        // Keyframe moved before current layer start: expand same layer start backwards
        const shift = oldStart - newAbsFrame;
        copy.startFrame = newAbsFrame;
        copy.durationFrames += shift;

        const shiftPropKfs = (prop: any) => {
          if (prop && Array.isArray(prop.keyframes)) {
            prop.keyframes.forEach((k: any) => {
              if (Math.round(k.frame) === sourceRelFrame) {
                k.frame = 0;
              } else {
                k.frame += shift;
              }
            });
            const at0 = prop.keyframes.filter((k: any) => Math.round(k.frame) === 0);
            if (at0.length > 1) {
              const target = at0[at0.length - 1];
              prop.keyframes = prop.keyframes.filter((k: any) => Math.round(k.frame) !== 0);
              prop.keyframes.push(target);
            }
            prop.keyframes.sort((a: any, b: any) => a.frame - b.frame);
          }
        };

        shiftPropKfs(copy.transform.position);
        shiftPropKfs(copy.transform.rotation);
        shiftPropKfs(copy.transform.scale);
        shiftPropKfs(copy.transform.opacity);
        if (copy.transform.anchorPoint) shiftPropKfs(copy.transform.anchorPoint);
        if (copy.effects && Array.isArray(copy.effects)) {
          copy.effects.forEach((eff: any) => {
            if (eff.properties) {
              Object.values(eff.properties).forEach((p: any) => shiftPropKfs(p));
            }
          });
        }
      } else if (newAbsFrame > oldEnd) {
        // Keyframe moved beyond current layer end: expand same layer duration to encompass it
        copy.durationFrames = newAbsFrame - oldStart + 1;
        const newRelFrame = newAbsFrame - oldStart;

        const movePropKfs = (prop: any) => {
          if (prop && Array.isArray(prop.keyframes)) {
            prop.keyframes.forEach((k: any) => {
              if (Math.round(k.frame) === sourceRelFrame) {
                k.frame = newRelFrame;
              }
            });
            const atDest = prop.keyframes.filter((k: any) => Math.round(k.frame) === newRelFrame);
            if (atDest.length > 1) {
              const target = atDest[atDest.length - 1];
              prop.keyframes = prop.keyframes.filter((k: any) => Math.round(k.frame) !== newRelFrame);
              prop.keyframes.push(target);
            }
            prop.keyframes.sort((a: any, b: any) => a.frame - b.frame);
          }
        };

        movePropKfs(copy.transform.position);
        movePropKfs(copy.transform.rotation);
        movePropKfs(copy.transform.scale);
        movePropKfs(copy.transform.opacity);
        if (copy.transform.anchorPoint) movePropKfs(copy.transform.anchorPoint);
        if (copy.effects && Array.isArray(copy.effects)) {
          copy.effects.forEach((eff: any) => {
            if (eff.properties) {
              Object.values(eff.properties).forEach((p: any) => movePropKfs(p));
            }
          });
        }
      } else {
        // Within layer bounds (moving left or right cleanly)
        const newRelFrame = newAbsFrame - oldStart;

        const movePropKfs = (prop: any) => {
          if (prop && Array.isArray(prop.keyframes)) {
            prop.keyframes.forEach((k: any) => {
              if (Math.round(k.frame) === sourceRelFrame) {
                k.frame = newRelFrame;
              }
            });
            const atDest = prop.keyframes.filter((k: any) => Math.round(k.frame) === newRelFrame);
            if (atDest.length > 1) {
              const target = atDest[atDest.length - 1];
              prop.keyframes = prop.keyframes.filter((k: any) => Math.round(k.frame) !== newRelFrame);
              prop.keyframes.push(target);
            }
            prop.keyframes.sort((a: any, b: any) => a.frame - b.frame);
          }
        };

        movePropKfs(copy.transform.position);
        movePropKfs(copy.transform.rotation);
        movePropKfs(copy.transform.scale);
        movePropKfs(copy.transform.opacity);
        if (copy.transform.anchorPoint) movePropKfs(copy.transform.anchorPoint);
        if (copy.effects && Array.isArray(copy.effects)) {
          copy.effects.forEach((eff: any) => {
            if (eff.properties) {
              Object.values(eff.properties).forEach((p: any) => movePropKfs(p));
            }
          });
        }
      }

      onUpdateLayer(copy);
      onSelectLayer(copy.id);
      onSetCurrentFrame(newAbsFrame);
      showToast(
        lang === 'ar'
          ? `✨ تم تحريك الكي فريم في طبقته إلى الفريم ${newAbsFrame}`
          : `✨ Keyframe moved to frame ${newAbsFrame}`
      );
    }

    markDragJustFinished();
    setKfDrag(null);
  };

  const finalizeKfDragRef = useRef(finalizeKfDrag);
  finalizeKfDragRef.current = finalizeKfDrag;

  // Finalize 2D Layer Long-Press Drag (reorders Up/Down above/below layers + shifts StartFrame Left/Right)
  const finalizeLayerDrag = () => {
    const active = layerDragRef.current;
    if (!active || !active.isDragging) {
      setLayerDrag(null);
      return;
    }

    let layersCopy = [...project.layers];
    const fromIdx = layersCopy.findIndex((l) => l.id === active.layerId);
    if (fromIdx !== -1) {
      const targetVisualRow = visibleRows[active.targetIndex];
      let targetIdx = targetVisualRow
        ? layersCopy.findIndex((l) => l.id === targetVisualRow.layer.id)
        : Math.max(0, Math.min(layersCopy.length - 1, active.targetIndex));
      if (targetIdx < 0) targetIdx = Math.max(0, Math.min(layersCopy.length - 1, active.targetIndex));

      const moved = layersCopy[fromIdx];
      const timeDelta = active.currentStartFrame - moved.startFrame;

      if (fromIdx !== targetIdx) {
        const [spliced] = layersCopy.splice(fromIdx, 1);
        const adjustedTarget = Math.max(0, Math.min(layersCopy.length, targetIdx));
        layersCopy.splice(adjustedTarget, 0, spliced);
      }

      if (timeDelta !== 0) {
        if (moved.type === 'group') {
          layersCopy = shiftGroupTiming(layersCopy, moved.id, active.currentStartFrame, project.settings.durationFrames);
        } else {
          layersCopy = layersCopy.map((l) =>
            l.id === moved.id ? { ...l, startFrame: active.currentStartFrame } : l
          );
        }
      }

      if (onUpdateLayers) {
        onUpdateLayers(layersCopy, true);
      } else {
        const updatedSingle = layersCopy.find((l) => l.id === moved.id);
        if (updatedSingle) onUpdateLayer(updatedSingle);
      }

      const orderChanged = fromIdx !== targetIdx;
      const timeChanged = timeDelta !== 0;
      if (orderChanged || timeChanged) {
        showToast(
          lang === 'ar'
            ? orderChanged && timeChanged
              ? `✨ تم نقل "${moved.name}" وتغيير ترتيبها إلى الموضع ${targetIdx + 1}`
              : orderChanged
              ? `✨ تم نقل "${moved.name}" إلى الترتيب ${targetIdx + 1}`
              : `✨ تم تحريك "${moved.name}" إلى الفريم ${active.currentStartFrame}`
            : `✨ Moved "${moved.name}" (Row ${targetIdx + 1}, Frame ${active.currentStartFrame})`
        );
      }
    }

    markDragJustFinished();
    setLayerDrag(null);
  };

  const finalizeLayerDragRef = useRef(finalizeLayerDrag);
  finalizeLayerDragRef.current = finalizeLayerDrag;

  // Start long press timer on keyframe (activates after 190ms hold or immediate drag on the diamond)
  const startKeyframeLongPress = (
    clientX: number,
    clientY: number,
    layer: Layer,
    kf: { relFrame: number; absFrame: number; types: string[] }
  ) => {
    if (pendingKfRef.current) {
      clearTimeout(pendingKfRef.current.timer);
    }

    const timer = window.setTimeout(() => {
      if (pendingKfRef.current) {
        if (navigator.vibrate) navigator.vibrate(35);
        const p = pendingKfRef.current;
        setKfDrag({
          sourceLayerId: p.layerId,
          sourceRelFrame: p.relFrame,
          sourceAbsFrame: p.absFrame,
          currentAbsFrame: p.absFrame,
          targetLayerId: p.layerId,
          types: p.types,
          isDragging: true,
          startX: p.startX,
          startY: p.startY,
        });
        pendingKfRef.current = null;
      }
    }, 190);

    pendingKfRef.current = {
      layerId: layer.id,
      relFrame: kf.relFrame,
      absFrame: kf.absFrame,
      types: kf.types,
      startX: clientX,
      startY: clientY,
      timer,
    };
  };

  const latestCallbacksRef = useRef({ onSelectLayer, onSetCurrentFrame });
  latestCallbacksRef.current = { onSelectLayer, onSetCurrentFrame };

  // Start long press timer on a layer clip bar for 2D move (Up/Down layers & Left/Right time)
  const startLayerLongPress = (
    clientX: number,
    clientY: number,
    layer: Layer,
    originalIndex: number,
    isTouch: boolean
  ) => {
    if (pendingLayerRef.current) {
      clearTimeout(pendingLayerRef.current.timer);
    }

    const timer = window.setTimeout(() => {
      if (pendingLayerRef.current) {
        const p = pendingLayerRef.current;
        if (navigator.vibrate) navigator.vibrate(40);
        setLayerDrag({
          layerId: p.layerId,
          initialIndex: p.initialIndex,
          targetIndex: p.initialIndex,
          startX: p.startX,
          startY: p.startY,
          deltaX: 0,
          deltaY: 0,
          initialStartFrame: p.initialStartFrame,
          durationFrames: p.durationFrames,
          currentStartFrame: p.initialStartFrame,
          isDragging: true,
        });
        pendingLayerRef.current = null;
      }
    }, 220);

    pendingLayerRef.current = {
      layerId: layer.id,
      initialIndex: originalIndex,
      initialStartFrame: layer.startFrame,
      durationFrames: layer.durationFrames,
      startX: clientX,
      startY: clientY,
      isTouch,
      timer,
    };
  };

  // Global listeners to resolve pending long-presses cleanly before activation
  useEffect(() => {
    const handleGlobalPendingMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX === undefined || clientY === undefined) return;

      // Keyframe pending: moving > 4px activates keyframe left/right drag right away
      if (pendingKfRef.current && !kfDragRef.current?.isDragging) {
        const dist = Math.hypot(clientX - pendingKfRef.current.startX, clientY - pendingKfRef.current.startY);
        if (dist > 4) {
          clearTimeout(pendingKfRef.current.timer);
          if (navigator.vibrate) navigator.vibrate(25);
          const p = pendingKfRef.current;
          setKfDrag({
            sourceLayerId: p.layerId,
            sourceRelFrame: p.relFrame,
            sourceAbsFrame: p.absFrame,
            currentAbsFrame: p.absFrame,
            targetLayerId: p.layerId,
            types: p.types,
            isDragging: true,
            startX: p.startX,
            startY: p.startY,
          });
          pendingKfRef.current = null;
        }
      }

      // Layer pending:
      // - On touch: moving > 10px before 220ms cancels long-press so timeline scrolling stays natural
      // - On mouse: moving > 6px activates 2D layer drag immediately
      if (pendingLayerRef.current && !layerDragRef.current?.isDragging) {
        const p = pendingLayerRef.current;
        const dist = Math.hypot(clientX - p.startX, clientY - p.startY);
        if (p.isTouch && dist > 10) {
          clearTimeout(p.timer);
          pendingLayerRef.current = null;
        } else if (!p.isTouch && dist > 6) {
          clearTimeout(p.timer);
          const adjustedStartY = p.startY;
          setLayerDrag({
            layerId: p.layerId,
            initialIndex: p.initialIndex,
            targetIndex: p.initialIndex,
            startX: p.startX,
            startY: adjustedStartY,
            deltaX: clientX - p.startX,
            deltaY: clientY - adjustedStartY,
            initialStartFrame: p.initialStartFrame,
            durationFrames: p.durationFrames,
            currentStartFrame: p.initialStartFrame,
            isDragging: true,
          });
          pendingLayerRef.current = null;
        }
      }
    };

    const handleGlobalPendingUp = () => {
      if (pendingKfRef.current) {
        clearTimeout(pendingKfRef.current.timer);
        const p = pendingKfRef.current;
        pendingKfRef.current = null;
        if (!kfDragRef.current?.isDragging) {
          latestCallbacksRef.current.onSelectLayer(p.layerId);
          latestCallbacksRef.current.onSetCurrentFrame(p.absFrame);
          markDragJustFinished();
        }
      }

      if (pendingLayerRef.current) {
        clearTimeout(pendingLayerRef.current.timer);
        const p = pendingLayerRef.current;
        pendingLayerRef.current = null;
        if (!layerDragRef.current?.isDragging) {
          // Short tap on layer -> select & isolate this layer!
          latestCallbacksRef.current.onSelectLayer(p.layerId);
          markDragJustFinished();
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalPendingMove);
    window.addEventListener('touchmove', handleGlobalPendingMove, { passive: true });
    window.addEventListener('mouseup', handleGlobalPendingUp);
    window.addEventListener('touchend', handleGlobalPendingUp);
    window.addEventListener('touchcancel', handleGlobalPendingUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalPendingMove);
      window.removeEventListener('touchmove', handleGlobalPendingMove);
      window.removeEventListener('mouseup', handleGlobalPendingUp);
      window.removeEventListener('touchend', handleGlobalPendingUp);
      window.removeEventListener('touchcancel', handleGlobalPendingUp);
    };
  }, []);

  // Window listeners for smooth 60fps keyframe dragging (left/right using delta from drag start, NO scrollLeft feedback loop)
  useEffect(() => {
    if (!kfDrag?.isDragging) return;

    const handleWindowPointerMove = (e: MouseEvent | TouchEvent) => {
      const active = kfDragRef.current;
      if (!active || !active.isDragging) return;
      if ('touches' in e) {
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 0) return;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

      const deltaFrames = Math.round((clientX - active.startX) / zoom);
      const clampedFrame = Math.max(0, Math.min(totalFrames - 1, active.sourceAbsFrame + deltaFrames));

      setKfDrag((prev) =>
        prev
          ? {
              ...prev,
              currentAbsFrame: clampedFrame,
              targetLayerId: active.sourceLayerId,
            }
          : null
      );
    };

    const handleWindowPointerUp = () => {
      finalizeKfDragRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKfDrag(null);
        if (pendingKfRef.current) {
          clearTimeout(pendingKfRef.current.timer);
          pendingKfRef.current = null;
        }
      }
    };

    window.addEventListener('mousemove', handleWindowPointerMove);
    window.addEventListener('touchmove', handleWindowPointerMove, { passive: false });
    window.addEventListener('mouseup', handleWindowPointerUp);
    window.addEventListener('touchend', handleWindowPointerUp);
    window.addEventListener('touchcancel', handleWindowPointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleWindowPointerMove);
      window.removeEventListener('touchmove', handleWindowPointerMove);
      window.removeEventListener('mouseup', handleWindowPointerUp);
      window.removeEventListener('touchend', handleWindowPointerUp);
      window.removeEventListener('touchcancel', handleWindowPointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [kfDrag?.isDragging, zoom, totalFrames]);

  // Window listeners for 2D Layer Long-Press Drag (Up/Down reorder above/below layers + Left/Right timeline move)
  useEffect(() => {
    if (!layerDrag?.isDragging) return;
    const ROW_HEIGHT = 48;

    const handleLayerMove = (e: MouseEvent | TouchEvent) => {
      const active = layerDragRef.current;
      if (!active || !active.isDragging) return;
      if ('touches' in e) {
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 0) return;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - active.startX;
      const deltaY = clientY - active.startY;
      const deltaFrames = Math.round(deltaX / zoom);
      const maxStart = Math.max(0, totalFrames - active.durationFrames);
      const nextStartFrame = Math.max(0, Math.min(maxStart, active.initialStartFrame + deltaFrames));

      // Compute target row index accurately from rendered layer rows on screen
      const rowEls = Array.from(document.querySelectorAll('[data-layer-id]'));
      let nextTargetIdx = Math.max(0, Math.min(Math.max(0, rowEls.length - 1), active.initialIndex + Math.round(deltaY / ROW_HEIGHT)));
      if (rowEls.length > 0) {
        const firstRect = rowEls[0].getBoundingClientRect();
        const lastRect = rowEls[rowEls.length - 1].getBoundingClientRect();
        if (clientY <= firstRect.top) {
          nextTargetIdx = 0;
        } else if (clientY >= lastRect.bottom) {
          nextTargetIdx = rowEls.length - 1;
        } else {
          for (let i = 0; i < rowEls.length; i++) {
            const r = rowEls[i].getBoundingClientRect();
            if (clientY >= r.top && clientY <= r.bottom) {
              nextTargetIdx = i;
              break;
            }
          }
        }
      }

      setLayerDrag((prev) =>
        prev
          ? {
              ...prev,
              deltaX,
              deltaY,
              currentStartFrame: nextStartFrame,
              targetIndex: nextTargetIdx,
            }
          : null
      );
    };

    const handleLayerUp = () => {
      finalizeLayerDragRef.current();
    };

    const handleLayerKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLayerDrag(null);
      }
    };

    window.addEventListener('mousemove', handleLayerMove);
    window.addEventListener('touchmove', handleLayerMove, { passive: false });
    window.addEventListener('mouseup', handleLayerUp);
    window.addEventListener('touchend', handleLayerUp);
    window.addEventListener('touchcancel', handleLayerUp);
    window.addEventListener('keydown', handleLayerKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleLayerMove);
      window.removeEventListener('touchmove', handleLayerMove);
      window.removeEventListener('mouseup', handleLayerUp);
      window.removeEventListener('touchend', handleLayerUp);
      window.removeEventListener('touchcancel', handleLayerUp);
      window.removeEventListener('keydown', handleLayerKeyDown);
    };
  }, [layerDrag?.isDragging, zoom, totalFrames, project.layers.length]);

  // Handle playhead scrubber click / drag with stationary center playhead
  const handleScrubberMove = (clientX: number) => {
    if (!trackContainerRef.current) return;
    const rect = trackContainerRef.current.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const deltaFromCenter = clientX - center;
    const currentScroll = trackContainerRef.current.scrollLeft;
    const targetScroll = currentScroll + deltaFromCenter;
    const frame = Math.max(0, Math.min(totalFrames - 1, Math.round(targetScroll / zoom)));
    onSetCurrentFrame(frame);
  };

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (kfDrag?.isDragging || layerDrag?.isDragging) return;
    setIsScrubbing(true);
    handleScrubberMove(e.clientX);
  };

  const handleRulerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (kfDrag?.isDragging || layerDrag?.isDragging) return;
    setIsScrubbing(true);
    if (e.touches.length > 0) {
      handleScrubberMove(e.touches[0].clientX);
    }
  };

  // Window listeners for smooth scrubbing anywhere on screen
  useEffect(() => {
    if (!isScrubbing) return;
    const handleWindowMove = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.cancelable) e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleScrubberMove(clientX);
    };
    const handleWindowUp = () => {
      setIsScrubbing(false);
    };
    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('touchmove', handleWindowMove, { passive: false });
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('touchend', handleWindowUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('touchmove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
      window.removeEventListener('touchend', handleWindowUp);
    };
  }, [isScrubbing, zoom, totalFrames]);

  // Window listeners for trim handles (mouse & touch) with rAF coalescing + frame dedup + fast structural clone
  useEffect(() => {
    if (!clipDrag) return;
    let clipRafId: number | null = null;
    let pendingClientX: number | null = null;
    const initTarget = project.layers.find((l) => l.id === clipDrag.layerId);
    let lastCommittedStart = initTarget ? initTarget.startFrame : clipDrag.initialStartFrame;
    let lastCommittedDur = initTarget ? initTarget.durationFrames : clipDrag.initialDurationFrames;

    const applyClipTrim = (clientX: number) => {
      const deltaX = clientX - clipDrag.startX;
      const deltaFrames = Math.round(deltaX / zoom);
      const target = project.layers.find((l) => l.id === clipDrag.layerId);
      if (!target) return;

      let nextStart = target.startFrame;
      let nextDuration = target.durationFrames;
      let clampedDelta = 0;

      if (clipDrag.mode === 'trim-start') {
        const maxDelta = clipDrag.initialDurationFrames - 2;
        clampedDelta = Math.max(-clipDrag.initialStartFrame, Math.min(maxDelta, deltaFrames));
        nextStart = clipDrag.initialStartFrame + clampedDelta;
        nextDuration = clipDrag.initialDurationFrames - clampedDelta;
      } else if (clipDrag.mode === 'trim-end') {
        nextDuration = Math.max(2, Math.min(totalFrames - target.startFrame, clipDrag.initialDurationFrames + deltaFrames));
      } else if (clipDrag.mode === 'move') {
        const maxStart = totalFrames - target.durationFrames;
        nextStart = Math.max(0, Math.min(maxStart, clipDrag.initialStartFrame + deltaFrames));
      }

      if (nextStart === lastCommittedStart && nextDuration === lastCommittedDur) {
        return;
      }
      lastCommittedStart = nextStart;
      lastCommittedDur = nextDuration;

      const cloneTransform = () => {
        const pos = target.transform.position;
        const scale = target.transform.scale;
        const rot = target.transform.rotation;
        const op = target.transform.opacity;

        const mapKfs = (prop: any) => {
          if (!prop?.keyframes || prop.keyframes.length === 0) return prop;
          if (clipDrag.mode === 'trim-start') {
            return {
              ...prop,
              keyframes: prop.keyframes
                .map((k: any) => ({ ...k, frame: k.frame - clampedDelta }))
                .filter((k: any) => k.frame >= 0 && k.frame <= nextDuration),
            };
          }
          if (clipDrag.mode === 'trim-end') {
            return {
              ...prop,
              keyframes: prop.keyframes.filter((k: any) => k.frame <= nextDuration),
            };
          }
          return prop;
        };

        return clipDrag.mode === 'move'
          ? target.transform
          : {
              ...target.transform,
              position: mapKfs(pos),
              scale: mapKfs(scale),
              rotation: mapKfs(rot),
              opacity: mapKfs(op),
            };
      };

      if (clipDrag.mode === 'move' && target.type === 'group' && onUpdateLayers) {
        if (nextStart !== target.startFrame) {
          onUpdateLayers(shiftGroupTiming(project.layers, target.id, nextStart, project.settings.durationFrames), false);
        }
        return;
      }

      const copy: Layer = {
        ...target,
        startFrame: nextStart,
        durationFrames: nextDuration,
        transform: cloneTransform(),
      };

      onUpdateLayer(copy);
    };

    const scheduleTrimFlush = (clientX: number) => {
      pendingClientX = clientX;
      if (clipRafId !== null) return;
      clipRafId = requestAnimationFrame(() => {
        clipRafId = null;
        if (pendingClientX !== null) {
          applyClipTrim(pendingClientX);
        }
      });
    };

    const onWinMove = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) {
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 0) return;
        scheduleTrimFlush(e.touches[0].clientX);
      } else {
        scheduleTrimFlush(e.clientX);
      }
    };

    const onWinUp = () => {
      if (clipRafId !== null) {
        cancelAnimationFrame(clipRafId);
        clipRafId = null;
      }
      if (pendingClientX !== null) {
        applyClipTrim(pendingClientX);
        pendingClientX = null;
      }
      markDragJustFinished();
      setClipDrag(null);
    };

    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('touchmove', onWinMove, { passive: false });
    window.addEventListener('mouseup', onWinUp);
    window.addEventListener('touchend', onWinUp);
    window.addEventListener('touchcancel', onWinUp);

    return () => {
      if (clipRafId !== null) {
        cancelAnimationFrame(clipRafId);
        clipRafId = null;
      }
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('touchmove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
      window.removeEventListener('touchend', onWinUp);
      window.removeEventListener('touchcancel', onWinUp);
    };
  }, [clipDrag, zoom, totalFrames, project.layers]);

  // Keep tracks centered under the stationary white playhead as project.currentFrame changes
  useEffect(() => {
    if (!trackContainerRef.current) return;
    const targetScroll = Math.round(project.currentFrame * zoom);
    if (Math.abs(trackContainerRef.current.scrollLeft - targetScroll) > 1) {
      isProgrammaticScrollRef.current = true;
      trackContainerRef.current.scrollLeft = targetScroll;
      const raf = requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [project.currentFrame, zoom]);

  // Handle manual scroll (swiping horizontally or mouse wheel) to update currentFrame
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (layerListRef.current) {
      layerListRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    if (isProgrammaticScrollRef.current || kfDragRef.current?.isDragging || layerDragRef.current?.isDragging) return;
    const sl = e.currentTarget.scrollLeft;
    const frame = Math.max(0, Math.min(totalFrames - 1, Math.round(sl / zoom)));
    if (frame !== project.currentFrame) {
      onSetCurrentFrame(frame);
    }
  };

  const getLayerIcon = (type: Layer['type'], color?: string) => {
    switch (type) {
      case 'null':
        return (
          <div className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-400/60 flex items-center justify-center text-purple-400">
            <Target className="w-3 h-3 text-purple-400" />
          </div>
        );
      case 'camera':
        return (
          <div className="w-5 h-5 rounded-md bg-sky-500/20 border border-sky-400/60 flex items-center justify-center text-sky-400">
            <Camera className="w-3 h-3 text-sky-400" />
          </div>
        );
      case 'text':
        return (
          <div className="w-5 h-5 rounded-md bg-[#00E5FF]/20 border border-[#00E5FF]/60 flex items-center justify-center text-[#00E5FF] font-bold text-[10px]">
            T
          </div>
        );
      case 'vector':
        return (
          <div className="w-5 h-5 rounded-md bg-[#00E676]/20 border border-[#00E676]/60 flex items-center justify-center text-[#00E676]">
            <Square className="w-3 h-3 fill-[#00E676]" />
          </div>
        );
      case 'particle':
        return (
          <div className="w-5 h-5 rounded-md bg-orange-500/20 border border-orange-400/60 flex items-center justify-center text-orange-400">
            <Sparkles className="w-3 h-3 fill-orange-400" />
          </div>
        );
      case 'audio':
        return (
          <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-400">
            <Volume2 className="w-3 h-3" />
          </div>
        );
      case 'image':
        return (
          <div className="w-5 h-5 rounded-md bg-sky-500/20 border border-sky-400/60 flex items-center justify-center text-sky-400">
            <ImageIcon className="w-3 h-3" />
          </div>
        );
      case 'video':
        return (
          <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-400/60 flex items-center justify-center text-indigo-400">
            <Video className="w-3 h-3" />
          </div>
        );
      case 'model3d':
        return (
          <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-400">
            <Box className="w-3 h-3" />
          </div>
        );
      default:
        return (
          <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-400">
            <LayersIcon className="w-3 h-3" />
          </div>
        );
    }
  };

  return (
    <div
      dir="ltr"
      className={`${
        isSubViewOpen
          ? 'h-[416px] sm:h-[428px] max-h-[56dvh]'
          : 'h-[42dvh] md:h-72 lg:h-80'
      } bg-[#161719] border-t border-white/[0.04] flex flex-col select-none z-20 relative text-left shrink-0 transition-[height] duration-200`}
    >
      {/* 7-Icon Crisp Monochrome Transport Bar matching exact screenshot layout */}
      <div className="h-11 bg-[#101113] border-b border-white/[0.05] px-4 sm:px-8 flex items-center justify-between text-slate-100 select-none shrink-0">
        {/* 1. Corner-Frame Viewfinder Icon (Grid & View Tools) */}
        <button
          onClick={() => {
            if (onToggleSideTools) onToggleSideTools();
          }}
          className={`p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
            isSideToolsOpen ? 'text-[var(--app-accent-bright)]' : 'text-slate-100 hover:text-white'
          }`}
          title={lang === 'ar' ? 'عرض الشبكة والأدوات' : 'Toggle Grid & Tools'}
        >
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8V6a2 2 0 0 1 2-2h2" />
            <path d="M16 4h2a2 2 0 0 1 2 2v2" />
            <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
            <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
            <rect x="8.5" y="8.5" width="7" height="7" rx="1.2" />
          </svg>
        </button>

        {/* 2. Stacked Squares + Plus (Duplicate Selected / Add Layer) */}
        <button
          onClick={() => {
            if (selectedLayer) {
              onDuplicateLayer(selectedLayer.id);
              showToast(lang === 'ar' ? `✨ تم تكرار الطبقة: ${selectedLayer.name}` : `✨ Duplicated layer: ${selectedLayer.name}`);
            } else if (onOpenAddModal) {
              onOpenAddModal();
            }
          }}
          className="p-1.5 rounded-lg text-slate-100 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title={lang === 'ar' ? 'تكرار / إضافة طبقة' : 'Duplicate / Add Layer'}
        >
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="11" height="11" rx="2" />
            <path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" />
            <line x1="8.5" y1="11.2" x2="8.5" y2="15.8" />
            <line x1="6.2" y1="13.5" x2="10.8" y2="13.5" />
          </svg>
        </button>

        {/* 3. Previous Keyframe (|<) */}
        <button
          onClick={() => {
            if (prevKf !== undefined) {
              onSetCurrentFrame(prevKf);
            } else if (selectedLayer && project.currentFrame > selectedLayer.startFrame) {
              onSetCurrentFrame(selectedLayer.startFrame);
            } else {
              onSetCurrentFrame(0);
            }
          }}
          className="p-1.5 rounded-lg text-slate-100 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title={lang === 'ar' ? (prevKf !== undefined ? `الكي فريم السابق (${prevKf})` : 'الانتقال للبداية') : 'Previous Keyframe / Start'}
        >
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="6" x2="6" y2="18" />
            <polyline points="17 7 11 12 17 17" />
            <line x1="11.5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* 4. Center Play / Pause Triangle (Clean solid white triangle, no circle border) */}
        <button
          onClick={onTogglePlay}
          className="p-1.5 text-white hover:scale-110 active:scale-95 flex items-center justify-center transition-transform cursor-pointer"
          title={project.isPlaying ? (lang === 'ar' ? 'إيقاف مؤقت' : 'Pause') : (lang === 'ar' ? 'تشغيل' : 'Play')}
        >
          {project.isPlaying ? (
            <svg className="w-[20px] h-[20px] fill-white" viewBox="0 0 24 24">
              <rect x="6.5" y="5" width="3.8" height="14" rx="1" />
              <rect x="13.7" y="5" width="3.8" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-[20px] h-[20px] fill-white" viewBox="0 0 24 24">
              <polygon points="7,5 19,12 7,19" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* 5. Next Keyframe (>|) */}
        <button
          onClick={() => {
            if (nextKf !== undefined) {
              onSetCurrentFrame(nextKf);
            } else if (selectedLayer && project.currentFrame < selectedLayer.startFrame + selectedLayer.durationFrames) {
              onSetCurrentFrame(selectedLayer.startFrame + selectedLayer.durationFrames);
            } else {
              onSetCurrentFrame(totalFrames - 1);
            }
          }}
          className="p-1.5 rounded-lg text-slate-100 hover:text-white transition-all active:scale-95 flex items-center justify-center cursor-pointer"
          title={lang === 'ar' ? (nextKf !== undefined ? `الكي فريم التالي (${nextKf})` : 'الانتقال للنهاية') : 'Next Keyframe / End'}
        >
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="18" y2="18" />
            <polyline points="7 7 13 12 7 17" />
            <line x1="5" y1="12" x2="12.5" y2="12" />
          </svg>
        </button>

        {/* Group Selected / New Group */}
        {onGroupSelected && (
          <button
            type="button"
            onClick={onGroupSelected}
            className={`p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center cursor-pointer relative ${
              multiSelectedIds.length > 0
                ? 'text-sky-300 bg-sky-500/20 border border-sky-400/40'
                : 'text-slate-100 hover:text-sky-300'
            }`}
            title={
              multiSelectedIds.length > 0
                ? (lang === 'ar' ? `تجميع (${multiSelectedIds.length}) طبقات (Ctrl+G)` : `Group (${multiSelectedIds.length}) layers (Ctrl+G)`)
                : (lang === 'ar' ? 'تجميع الطبقة المحددة (Ctrl+G)' : 'Group Layer (Ctrl+G)')
            }
          >
            <FolderPlus className="w-[19px] h-[19px]" />
            {multiSelectedIds.length > 0 && (
              <span className="absolute -top-1 -right-1 px-1 rounded-full bg-sky-500 text-slate-950 font-mono font-bold text-[9px] leading-tight">
                {multiSelectedIds.length}
              </span>
            )}
          </button>
        )}

        {/* 6. Undo Curved Arrow */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
            canUndo
              ? 'text-slate-100 hover:text-white cursor-pointer active:scale-95'
              : 'text-slate-500/45 cursor-not-allowed'
          }`}
          title={lang === 'ar' ? 'تراجع (Undo)' : 'Undo'}
        >
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
          </svg>
        </button>

        {/* 7. Redo Curved Arrow */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
            canRedo
              ? 'text-slate-100 hover:text-white cursor-pointer active:scale-95'
              : 'text-slate-500/45 cursor-not-allowed'
          }`}
          title={lang === 'ar' ? 'إعادة (Redo)' : 'Redo'}
        >
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
          </svg>
        </button>
      </div>

      {/* Main Timeline Tracks */}
      <div className="flex-1 flex relative overflow-hidden bg-[#161719]" dir="ltr">
          {/* Stationary Center Themed Playhead Line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-[var(--app-accent-solid)] z-30 pointer-events-none">
            {/* Dark Charcoal Rounded Timecode Capsule Pill */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-[#232428] border border-white/[0.08] text-white font-mono font-bold text-[11px] px-2.5 py-[2px] rounded-full shadow-md whitespace-nowrap tabular-nums">
              {formatTimecode(project.currentFrame)}
            </div>
          </div>

          {/* Multi-Select Floating Bar (when Shift+Click selecting multiple layers) */}
          {multiSelectedIds.length > 0 && onGroupSelected && (
            <div className="absolute top-2 left-24 z-40 flex items-center gap-1.5 bg-[#12141B]/95 border border-sky-400/40 rounded-lg px-2.5 py-1 shadow-xl">
              <span className="text-[10.5px] font-bold text-sky-300 whitespace-nowrap">
                {lang === 'ar' ? `${multiSelectedIds.length} محدد` : `${multiSelectedIds.length} selected`}
              </span>
              <button
                type="button"
                onClick={onGroupSelected}
                className="px-2 py-0.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[10px] cursor-pointer whitespace-nowrap"
              >
                {lang === 'ar' ? 'تجميع' : 'Group'}
              </button>
              {onClearMultiSelect && (
                <button
                  type="button"
                  onClick={onClearMultiSelect}
                  className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  title={lang === 'ar' ? 'إلغاء التحديد' : 'Clear'}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Floating Left Eye & Group Collapse Pills Overlay */}
          <div
            ref={layerListRef}
            className={`absolute left-0 top-0 bottom-0 w-24 pt-8 overflow-y-hidden z-20 pointer-events-none select-none flex flex-col ${
              isSubViewOpen ? 'pb-[290px]' : project.selectedLayerId ? 'pb-[220px]' : ''
            }`}
          >
            {visibleRows.map(({ layer, depth, isGroup, isCollapsed }) => (
              <div
                key={layer.id}
                className="h-12 flex items-center shrink-0"
                style={{ paddingLeft: `${Math.min(depth, 3) * 8}px` }}
              >
                <div className="pointer-events-auto h-7 pl-2 pr-2 rounded-r-full bg-[#242529]/95 border border-l-0 border-white/[0.06] flex items-center gap-1.5 shadow-sm">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateLayer({ ...layer, visible: !layer.visible });
                    }}
                    className={`hover:text-white transition-colors cursor-pointer active:scale-95 ${
                      layer.visible ? 'text-slate-100' : 'text-slate-500'
                    }`}
                    title={layer.visible ? (lang === 'ar' ? 'إخفاء الطبقة' : 'Hide Layer') : (lang === 'ar' ? 'إظهار الطبقة' : 'Show Layer')}
                  >
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5 stroke-[1.9]" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 stroke-[1.9] text-slate-500" />
                    )}
                  </button>
                  {isGroup && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateLayer({
                          ...layer,
                          groupConfig: {
                            ...(layer.groupConfig || {}),
                            collapsed: !isCollapsed,
                          },
                        });
                      }}
                      className="text-sky-300 hover:text-white cursor-pointer"
                      title={isCollapsed ? (lang === 'ar' ? 'توسيع المجموعة' : 'Expand Group') : (lang === 'ar' ? 'طي المجموعة' : 'Collapse Group')}
                    >
                      {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Subtle Right-Edge Row Grip Affordance (≡) matching screenshot */}
          <div
            className={`absolute right-1.5 top-0 bottom-0 pt-8 overflow-hidden z-20 pointer-events-none select-none flex flex-col ${
              isSubViewOpen ? 'pb-[290px]' : project.selectedLayerId ? 'pb-[220px]' : ''
            }`}
          >
            {visibleRows.map(({ layer }) => (
              <div key={`grip-${layer.id}`} className="h-12 flex items-center justify-center shrink-0">
                <div className="flex flex-col gap-[2px] opacity-30">
                  <div className="w-2.5 h-[1px] bg-white rounded-full" />
                  <div className="w-2.5 h-[1px] bg-white rounded-full" />
                  <div className="w-2.5 h-[1px] bg-white rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Full-Width Scrollable Tracks Container */}
          <div
            ref={trackContainerRef}
            onScroll={handleScroll}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              trackTapStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: e.currentTarget.scrollLeft,
                scrollTop: e.currentTarget.scrollTop,
              };
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                trackTapStartRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  scrollLeft: e.currentTarget.scrollLeft,
                  scrollTop: e.currentTarget.scrollTop,
                };
              }
            }}
            onClick={(e) => {
              if (
                !project.selectedLayerId ||
                justFinishedDragRef.current ||
                layerDrag?.isDragging ||
                kfDrag?.isDragging ||
                clipDrag ||
                isScrubbing
              ) {
                return;
              }
              const start = trackTapStartRef.current;
              trackTapStartRef.current = null;
              if (start) {
                const movedX = Math.abs(e.clientX - start.x);
                const movedY = Math.abs(e.clientY - start.y);
                const scrolled =
                  Math.abs(e.currentTarget.scrollLeft - start.scrollLeft) > 4 ||
                  Math.abs(e.currentTarget.scrollTop - start.scrollTop) > 4;
                if (movedX > 8 || movedY > 8 || scrolled) return;
              }
              onSelectLayer(null);
            }}
            className={`w-full h-full relative bg-[#161719] scrollbar-none ${
              kfDrag?.isDragging || layerDrag?.isDragging || clipDrag
                ? 'overflow-hidden touch-none'
                : 'overflow-x-auto overflow-y-auto'
            }`}
          >
            {/* Floating Toast Notice */}
            <AnimatePresence>
              {timelineToast && (
                <motion.div
                  key="timeline-toast-pill"
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: PILL_SPRING }}
                  exit={{ opacity: 0, y: 8, scale: 0.92, transition: { duration: 0.14, ease: MODAL_EASE } }}
                  className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#16181D]/95 backdrop-blur-xl border border-[rgba(var(--app-accent-rgb),0.5)] text-[var(--app-accent-bright)] text-xs font-bold px-4 py-1.5 rounded-full shadow-xl z-50 pointer-events-none flex items-center gap-2"
                >
                  <span>{timelineToast}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              style={{
                width: `${totalFrames * zoom}px`,
                minWidth: `${totalFrames * zoom}px`,
                boxSizing: 'content-box',
                paddingLeft: '50%',
                paddingRight: '50%',
              }}
              className={`relative min-h-full ${
                isSubViewOpen ? 'pb-[290px]' : project.selectedLayerId ? 'pb-[220px]' : ''
              }`}
            >
              {/* Clean Minimal Top Ruler Ticks */}
              <div
                className="h-8 relative cursor-pointer flex items-start pt-1.5 select-none"
                onMouseDown={handleRulerMouseDown}
                onTouchStart={handleRulerTouchStart}
                onClick={(e) => e.stopPropagation()}
              >
                {Array.from({ length: Math.ceil(totalFrames / fps) * 10 + 1 }).map((_, tickIdx) => {
                  const f = (tickIdx * fps) / 10;
                  const isSec = tickIdx % 10 === 0;
                  const isHalfSec = tickIdx % 5 === 0 && !isSec;
                  const leftPx = f * zoom;
                  return (
                    <div
                      key={tickIdx}
                      className={`absolute top-1.5 ${
                        isSec
                          ? 'h-4 border-l border-white/30'
                          : isHalfSec
                          ? 'h-3 border-l border-white/20'
                          : 'h-2 border-l border-white/12'
                      }`}
                      style={{ left: `${leftPx}px` }}
                    />
                  );
                })}
              </div>

              {/* Keyframe Drag Laser Line Guide */}
              {kfDrag?.isDragging && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-[var(--app-accent-solid)] z-40 pointer-events-none shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.8)] flex flex-col items-center"
                  style={{ left: `${kfDrag.currentAbsFrame * zoom}px` }}
                >
                  <div className="sticky top-0 bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-mono font-bold text-[10px] px-2 py-0.5 rounded-b shadow-2xl whitespace-nowrap z-50">
                    {kfDrag.currentAbsFrame}f ({formatTimecode(kfDrag.currentAbsFrame)})
                  </div>
                </div>
              )}

              {/* Remote Collaborator Live Playheads */}
              {collabMembers
                .filter((m) => m.isOnline && m.id !== localMemberId && typeof m.currentFrame === 'number')
                .map((peer) => (
                  <div
                    key={`peer-cursor-${peer.id}`}
                    className="absolute top-0 bottom-0 w-[1.5px] z-30 pointer-events-none"
                    style={{ left: `${peer.currentFrame * zoom}px`, backgroundColor: peer.color }}
                  >
                    <div
                      className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-950 whitespace-nowrap shadow"
                      style={{ backgroundColor: peer.color }}
                    >
                      {peer.name}
                    </div>
                  </div>
                ))}

              {/* Layer Tracks */}
              {visibleRows.map(({ layer, depth, isGroup, isCollapsed, childCount }, visualIdx) => {
                const layerIdx = project.layers.findIndex((l) => l.id === layer.id);
                const isSelected = layer.id === project.selectedLayerId;
                const isMultiSelected = multiSelectedIds.includes(layer.id);
                const remotePeerOnLayer = collabMembers.find(
                  (m) => m.isOnline && m.id !== localMemberId && m.selectedLayerId === layer.id
                );
                const isLayerDraggingSelf = Boolean(layerDrag?.isDragging && layerDrag.layerId === layer.id);
                const activeStartFrame = isLayerDraggingSelf ? layerDrag!.currentStartFrame : layer.startFrame;
                const clipLeft = activeStartFrame * zoom;
                const clipWidth = layer.durationFrames * zoom;
                const clipStyle = getLayerClipStyle(layer, layerIdx >= 0 ? layerIdx : 0);

                const isLayerDropTarget = Boolean(
                  layerDrag?.isDragging &&
                    layerDrag.targetIndex === visualIdx &&
                    layerDrag.layerId !== layer.id
                );
                const isMovingUpOntoTarget = layerDrag ? layerDrag.targetIndex < layerDrag.initialIndex : false;
                const targetSlotLayer =
                  isLayerDraggingSelf && layerDrag ? visibleRows[layerDrag.targetIndex]?.layer : undefined;

                // Collect all unique keyframes for this layer
                const kfMap = new Map<number, string[]>();
                const collectKfs = (prop: any, typeName: string) => {
                  if (prop && Array.isArray(prop.keyframes)) {
                    prop.keyframes.forEach((k: any) => {
                      if (typeof k.frame === 'number') {
                        const f = Math.round(k.frame);
                        const list = kfMap.get(f) || [];
                        if (!list.includes(typeName)) list.push(typeName);
                        kfMap.set(f, list);
                      }
                    });
                  }
                };

                collectKfs(layer.transform.position, 'P');
                collectKfs(layer.transform.rotation, 'R');
                collectKfs(layer.transform.scale, 'S');
                collectKfs(layer.transform.opacity, 'O');

                if (layer.effects && Array.isArray(layer.effects)) {
                  layer.effects.forEach((eff: any) => {
                    if (eff.properties) {
                      Object.values(eff.properties).forEach((p: any) => {
                        collectKfs(p, 'FX');
                      });
                    }
                  });
                }

                const layerKeyframes = Array.from(kfMap.entries())
                  .map(([relFrame, types]) => ({
                    relFrame,
                    absFrame: layer.startFrame + relFrame,
                    types,
                  }))
                  .sort((a, b) => a.relFrame - b.relFrame);

                return (
                  <div
                    key={layer.id}
                    data-layer-id={layer.id}
                    className={`h-12 relative flex items-center transition-colors ${
                      isLayerDraggingSelf ? 'z-40' : ''
                    } ${isLayerDropTarget ? 'bg-[rgba(var(--app-accent-rgb),0.12)]' : ''}`}
                  >
                    {/* Vertical Reorder Drop Slot Indicator Line */}
                    {isLayerDropTarget && (
                      <div
                        className={`absolute inset-x-0 h-[2.5px] bg-[var(--app-accent-solid)] shadow-[0_0_10px_var(--app-accent-solid)] z-40 pointer-events-none ${
                          isMovingUpOntoTarget ? 'top-0' : 'bottom-0'
                        }`}
                      />
                    )}

                    {/* Alight Motion Matte Clip Bar with Vertical Alternating Blocks */}
                    <div
                      className={`absolute h-7 sm:h-8 rounded-[5px] flex items-center justify-between select-none ${
                        isLayerDraggingSelf
                          ? 'ring-2 ring-[var(--app-accent-solid)] shadow-[0_10px_28px_rgba(var(--app-accent-rgb),0.45)] z-50 cursor-grabbing opacity-95'
                          : isSelected
                          ? 'ring-2 ring-white/90 shadow-lg z-20 cursor-pointer transition-all'
                          : isMultiSelected
                          ? 'ring-2 ring-sky-400 shadow-lg z-20 cursor-pointer transition-all'
                          : 'shadow-sm opacity-95 hover:opacity-100 cursor-pointer transition-all'
                      }`}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                        backgroundColor: clipStyle.bg,
                        boxShadow: remotePeerOnLayer ? `0 0 0 2px ${remotePeerOnLayer.color}` : undefined,
                        transform: isLayerDraggingSelf
                          ? `translate3d(0px, ${layerDrag!.deltaY}px, 0) scale(1.02)`
                          : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (justFinishedDragRef.current || layerDrag?.isDragging || kfDrag?.isDragging || clipDrag) return;
                        if (e.shiftKey && onToggleMultiSelect) {
                          onToggleMultiSelect(layer.id);
                          return;
                        }
                        onSelectLayer(layer.id);
                      }}
                      onMouseDown={(e) => {
                        if (kfDrag?.isDragging || e.button !== 0) return;
                        e.stopPropagation();
                        startLayerLongPress(e.clientX, e.clientY, layer, visualIdx, false);
                      }}
                      onTouchStart={(e) => {
                        if (kfDrag?.isDragging) return;
                        e.stopPropagation();
                        if (e.touches.length > 0) {
                          startLayerLongPress(
                            e.touches[0].clientX,
                            e.touches[0].clientY,
                            layer,
                            visualIdx,
                            true
                          );
                        }
                      }}
                    >
                      {/* Subtle Vertical Alternating Block Segments (matches screenshot) */}
                      <div
                        className="absolute inset-0 pointer-events-none rounded-[5px] overflow-hidden"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            90deg,
                            rgba(255, 255, 255, 0.14) 0px,
                            rgba(255, 255, 255, 0.14) 16px,
                            transparent 16px,
                            transparent 32px
                          )`,
                        }}
                      />

                      {/* Left Trim Handle Edge */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectLayer(layer.id);
                          setClipDrag({
                            layerId: layer.id,
                            mode: 'trim-start',
                            startX: e.clientX,
                            initialStartFrame: layer.startFrame,
                            initialDurationFrames: layer.durationFrames,
                          });
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          if (e.touches.length > 0) {
                            onSelectLayer(layer.id);
                            setClipDrag({
                              layerId: layer.id,
                              mode: 'trim-start',
                              startX: e.touches[0].clientX,
                              initialStartFrame: layer.startFrame,
                              initialDurationFrames: layer.durationFrames,
                            });
                          }
                        }}
                        className="h-full w-3 absolute left-0 top-0 cursor-ew-resize hover:bg-black/15 rounded-l-[5px] z-30 touch-none"
                        title={lang === 'ar' ? 'قص أو تعديل بداية الطبقة' : 'Trim Start'}
                      />

                      {/* Clip Title inside Bar */}
                      <div
                        className="flex items-center gap-1.5 pointer-events-none z-10 truncate max-w-[75%]"
                        style={{ paddingLeft: `${12 + Math.min(depth, 3) * 10}px` }}
                      >
                        {isGroup && (
                          isCollapsed ? <Folder className="w-3.5 h-3.5 text-white shrink-0" /> : <FolderOpen className="w-3.5 h-3.5 text-white shrink-0" />
                        )}
                        <span
                          className={`text-[11px] font-bold truncate ${
                            clipStyle.isLight ? 'text-[#281E0B]' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
                          }`}
                        >
                          {layer.name}
                          {isGroup ? ` (${childCount})` : ''}
                        </span>
                        {remotePeerOnLayer && (
                          <span
                            className="px-1 py-0.2 rounded text-[8.5px] font-bold text-slate-950 shrink-0"
                            style={{ backgroundColor: remotePeerOnLayer.color }}
                          >
                            {remotePeerOnLayer.name}
                          </span>
                        )}
                      </div>

                      {/* Floating 2D Layer Move & Reorder HUD Badge */}
                      {isLayerDraggingSelf && layerDrag && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#14161A]/95 border border-[var(--app-accent-solid)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none z-50 flex items-center gap-1.5">
                          <span className="text-[var(--app-accent-bright)]">
                            {layerDrag.targetIndex < layerDrag.initialIndex
                              ? lang === 'ar'
                                ? `⬆ فوق: ${targetSlotLayer?.name || ''}`
                                : `⬆ Above: ${targetSlotLayer?.name || ''}`
                              : layerDrag.targetIndex > layerDrag.initialIndex
                              ? lang === 'ar'
                                ? `⬇ تحت: ${targetSlotLayer?.name || ''}`
                                : `⬇ Below: ${targetSlotLayer?.name || ''}`
                              : lang === 'ar'
                              ? '↕ تحريك يمين / يسار / فوق / تحت'
                              : '↕ Move Up / Down / Left / Right'}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-mono text-[var(--app-accent-bright)]">
                            {formatTimecode(layerDrag.currentStartFrame)} ({layerDrag.currentStartFrame}f)
                          </span>
                        </div>
                      )}

                      {/* Audio Waveform visualization if audio layer */}
                      {layer.type === 'audio' && (
                        <div className="absolute inset-x-8 inset-y-1 flex items-center gap-[2px] opacity-80 pointer-events-none overflow-hidden">
                          {Array.from({ length: 60 }).map((_, barIdx) => {
                            const h = Math.abs(Math.sin(barIdx * 0.42) * 14 + Math.cos(barIdx * 0.85) * 8) + 4;
                            return (
                              <div
                                key={barIdx}
                                className="w-[2px] bg-white rounded-full shrink-0 shadow-sm"
                                style={{ height: `${Math.min(22, h)}px` }}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Keyframe Diamond Markers directly on the layer bar (Strictly locked within own layer) */}
                      {layerKeyframes.map((kf) => {
                        const isBeingDragged =
                          kfDrag?.isDragging &&
                          kfDrag.sourceLayerId === layer.id &&
                          kfDrag.sourceRelFrame === kf.relFrame;

                        const displayRelFrame = isBeingDragged
                          ? kfDrag.currentAbsFrame - layer.startFrame
                          : kf.relFrame;
                        const kfLeft = displayRelFrame * zoom;
                        const isCurrent = Math.abs(project.currentFrame - (layer.startFrame + displayRelFrame)) < 0.5;

                        return (
                          <div
                            key={`kf-${layer.id}-${kf.relFrame}`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              startKeyframeLongPress(e.clientX, e.clientY, layer, kf);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              if (e.touches.length > 0) {
                                startKeyframeLongPress(e.touches[0].clientX, e.touches[0].clientY, layer, kf);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-7 h-7 flex items-center justify-center absolute top-1/2 -translate-y-1/2 -translate-x-1/2 select-none transition-transform cursor-grab active:cursor-grabbing ${
                              isBeingDragged ? 'z-50 scale-125' : 'z-30 hover:scale-125'
                            } group/kf`}
                            style={{ left: `${kfLeft}px`, touchAction: 'none' }}
                            title={`${lang === 'ar' ? 'اضغط مطولاً لتحريك الكي فريم يميناً أو يساراً' : 'Long press & drag keyframe left or right'} (${kf.absFrame}f)`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rotate-45 transition-all ${
                                isBeingDragged
                                  ? 'bg-[var(--app-accent-solid)] border-2 border-white shadow-[0_0_12px_var(--app-accent-solid)] scale-125'
                                  : isCurrent
                                  ? 'bg-white border-2 border-[#161719] shadow-md scale-110'
                                  : 'border-2 border-white/95 bg-[#161719]/60 shadow-sm'
                              }`}
                            />

                            {isBeingDragged ? (
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#14161A] border border-[var(--app-accent-solid)] text-white px-2 py-0.5 rounded-lg shadow-2xl flex items-center gap-1.5 whitespace-nowrap z-50 pointer-events-none text-[10px] font-bold">
                                <span className="text-[var(--app-accent-bright)]">↔ {kfDrag.currentAbsFrame}f</span>
                                <span className="text-slate-300 font-mono text-[9px]">{formatTimecode(kfDrag.currentAbsFrame)}</span>
                              </div>
                            ) : (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/95 border border-white/10 text-white text-[9px] font-mono px-2 py-0.5 rounded-md opacity-0 group-hover/kf:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-30 flex flex-col items-center gap-0.5">
                                <span>{kf.absFrame}f ({kf.types.join('')})</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Right Trim Handle Edge */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectLayer(layer.id);
                          setClipDrag({
                            layerId: layer.id,
                            mode: 'trim-end',
                            startX: e.clientX,
                            initialStartFrame: layer.startFrame,
                            initialDurationFrames: layer.durationFrames,
                          });
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          if (e.touches.length > 0) {
                            onSelectLayer(layer.id);
                            setClipDrag({
                              layerId: layer.id,
                              mode: 'trim-end',
                              startX: e.touches[0].clientX,
                              initialStartFrame: layer.startFrame,
                              initialDurationFrames: layer.durationFrames,
                            });
                          }
                        }}
                        className="h-full w-3 absolute right-0 top-0 cursor-ew-resize hover:bg-black/15 rounded-r-[5px] z-30 touch-none"
                        title={lang === 'ar' ? 'سحب وتعديل نهاية الطبقة' : 'Trim End'}
                      />

                      {/* Active Dragging Duration Tooltip */}
                      {clipDrag?.layerId === layer.id && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#14161A] text-[var(--app-accent-bright)] border border-[rgba(var(--app-accent-rgb),0.5)] text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xl whitespace-nowrap pointer-events-none z-40">
                          {formatDurationSecs(layer.durationFrames)} ({layer.durationFrames}f)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
    </div>
  );
};

export const Timeline = React.memo(TimelineBase);
