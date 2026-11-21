import React, { useState, useRef, useEffect } from 'react';
import { Layer, Language, BezierHandle, EasingType, Mesh3DType } from '../types';
import { evaluateProperty, computeInfinitePerspective, getLayerWorldMatrix } from '../engine/interpolator';
import { MOTION_PRESETS } from '../engine/presets';
import {
  Move,
  RotateCw,
  Maximize2,
  Box,
  Diamond,
  Crosshair,
  Grid,
  MoreHorizontal,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RotateCcw,
  Link,
  Unlink,
  SkipBack,
  SkipForward,
  Copy,
  ClipboardPaste,
  Check,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Sparkles,
  Sun,
  Flame,
  Shield,
  Activity,
  Zap,
  Lock,
  Unlock,
} from 'lucide-react';
import { AlightBezierGraph } from './AlightBezierGraph';
import {
  copyCurveToClipboard,
  getCopiedCurveFromClipboard,
  subscribeToCurveClipboard,
  StoredCurve,
} from '../engine/curveClipboard';

interface AlightMoveTransformPadProps {
  layer: Layer;
  allLayers?: Layer[];
  lang: Language;
  currentFrame: number;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onUpdateLayers?: (updatedLayers: Layer[]) => void;
  onAddKeyframe: (layerId: string, propertyPath: string) => void;
  onSetCurrentFrame?: (frame: number) => void;
  onOpenGraphEditor?: () => void;
}

export type TransformMode = 'position' | 'rotation' | 'scale';

export const AlightMoveTransformPad: React.FC<AlightMoveTransformPadProps> = ({
  layer,
  allLayers = [],
  lang,
  currentFrame,
  onUpdateLayer,
  onUpdateLayers,
  onAddKeyframe,
  onSetCurrentFrame,
  onOpenGraphEditor,
}) => {
  const [mode, setMode] = useState<TransformMode>('position');
  const [posTab, setPosTab] = useState<'xy' | 'z'>('xy');
  const [rotTab, setRotTab] = useState<'z' | 'x' | 'y' | 'depth'>('z');
  const [showCurveDrawer, setShowCurveDrawer] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragVisualDelta, setDragVisualDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [sync3DAll, setSync3DAll] = useState<boolean>(false); // Auto 3D Linking for all layers without manual parenting!
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const dragRafRef = useRef<number | null>(null);
  const pendingMoveCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const startRotRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const startScaleRef = useRef<{ x: number; y: number; z: number }>({ x: 100, y: 100, z: 100 });

  // Clipboard curve state
  const [clipboardCurve, setClipboardCurve] = useState<StoredCurve | null>(() => getCopiedCurveFromClipboard());
  const [padToast, setPadToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showPadToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setPadToast(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setPadToast(null);
    }, 2000);
  };

  useEffect(() => {
    return subscribeToCurveClipboard(() => {
      setClipboardCurve(getCopiedCurveFromClipboard());
    });
  }, []);

  // Custom bezier handle state
  const [bezierHandle, setBezierHandle] = useState<{ x1: number; y1: number; x2: number; y2: number }>({
    x1: 0.25,
    y1: 0.1,
    x2: 0.25,
    y2: 1.0,
  });

  // Fast shallow-structural clone for 60fps transform dragging (avoids expensive JSON.parse/stringify)
  const getFastTransformCopy = (): Layer => ({
    ...layer,
    transform: {
      ...layer.transform,
      position: {
        ...layer.transform.position,
        value: { ...layer.transform.position.value },
        keyframes: layer.transform.position.keyframes ? [...layer.transform.position.keyframes] : [],
      },
      rotation: {
        ...layer.transform.rotation,
        value: { ...layer.transform.rotation.value },
        keyframes: layer.transform.rotation.keyframes ? [...layer.transform.rotation.keyframes] : [],
      },
      scale: {
        ...layer.transform.scale,
        value: { ...layer.transform.scale.value },
        keyframes: layer.transform.scale.keyframes ? [...layer.transform.scale.keyframes] : [],
      },
    },
  });

  const getCopy = (): Layer => JSON.parse(JSON.stringify(layer));

  // Live evaluated values at currentFrame
  const evalPos = evaluateProperty(layer.transform.position, currentFrame, 30, layer.startFrame) as { x: number; y: number; z: number };
  const evalRot = evaluateProperty(layer.transform.rotation, currentFrame, 30, layer.startFrame) as { x: number; y: number; z: number };
  const evalScale = evaluateProperty(layer.transform.scale, currentFrame, 30, layer.startFrame) as { x: number; y: number; z: number };

  const relFrame = currentFrame - layer.startFrame;

  // Helper to cleanly update property value and keyframe at current frame without mutating shared objects
  const updatePropertyWithKeyframes = (prop: any, newValue: any, fallbackInitialVal?: any) => {
    const prevVal =
      typeof prop.value === 'object' && prop.value !== null ? { ...prop.value } : prop.value;
    const clonedVal = typeof newValue === 'object' && newValue !== null ? { ...newValue } : newValue;
    prop.value = clonedVal;
    if (!prop.keyframes) {
      prop.keyframes = [];
    } else {
      prop.keyframes = prop.keyframes.map((k: any) => ({ ...k }));
    }

    if (prop.keyframes.length > 0) {
      const existingKf = prop.keyframes.find((k: any) => Math.abs(k.frame - relFrame) < 0.5);
      if (existingKf) {
        existingKf.value = typeof newValue === 'object' && newValue !== null ? { ...newValue } : newValue;
      } else {
        // Auto-keyframing on modification if property is animated
        const isNull = layer.type === 'null';
        prop.keyframes.push({
          id: `kf-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          frame: relFrame,
          value: typeof newValue === 'object' && newValue !== null ? { ...newValue } : newValue,
          easing: isNull ? 'bezier' : 'linear',
          bezierHandle: isNull ? { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 } : undefined,
        });
        prop.keyframes.sort((a: any, b: any) => a.frame - b.frame);
      }
    } else if (relFrame > 0 && layer.type === 'null') {
      // Auto seed keyframe 0 and current frame keyframe with ultra-smooth Alight Motion curve
      const initialVal = fallbackInitialVal !== undefined ? fallbackInitialVal : prevVal;
      const clonedInit = typeof initialVal === 'object' && initialVal !== null ? { ...initialVal } : initialVal;
      prop.keyframes.push({
        id: `kf-${Date.now()}-0`,
        frame: 0,
        value: clonedInit,
        easing: 'bezier',
        bezierHandle: { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 },
      });
      prop.keyframes.push({
        id: `kf-${Date.now()}-1`,
        frame: relFrame,
        value: typeof newValue === 'object' && newValue !== null ? { ...newValue } : newValue,
        easing: 'bezier',
        bezierHandle: { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 },
      });
      prop.keyframes.sort((a: any, b: any) => a.frame - b.frame);
    }
  };

  // Direct 3D Rotation update helper
  const setDirect3DRotation = (rotX: number, rotY: number, rotZ: number) => {
    const copy = getFastTransformCopy();
    const newRot = {
      x: Math.round(rotX * 10) / 10,
      y: Math.round(rotY * 10) / 10,
      z: Math.round(rotZ * 10) / 10,
    };
    updatePropertyWithKeyframes(copy.transform.rotation, newRot);
    copy.is3D = true;
    copy.fixedIn3D = false;

    if (sync3DAll && allLayers.length > 0 && onUpdateLayers) {
      const deltaX = newRot.x - (evalRot?.x ?? 0);
      const deltaY = newRot.y - (evalRot?.y ?? 0);
      const deltaZ = newRot.z - (evalRot?.z ?? 0);
      const updatedAll = allLayers.map((l) => {
        if (l.id === layer.id) return copy;
        const lRot = evaluateProperty(l.transform.rotation, currentFrame, 30, l.startFrame) as any;
        const lRelFrame = currentFrame - l.startFrame;
        const lNewRot = {
          x: Math.round(((lRot?.x ?? 0) + deltaX) * 10) / 10,
          y: Math.round(((lRot?.y ?? 0) + deltaY) * 10) / 10,
          z: Math.round(((lRot?.z ?? 0) + deltaZ) * 10) / 10,
        };
        const lKfs = l.transform.rotation.keyframes
          ? l.transform.rotation.keyframes.map((k: any) =>
              Math.abs(k.frame - lRelFrame) < 0.5 ? { ...k, value: lNewRot } : k
            )
          : [];
        return {
          ...l,
          transform: {
            ...l.transform,
            rotation: {
              ...l.transform.rotation,
              value: lNewRot,
              keyframes: lKfs,
            },
          },
        };
      });
      onUpdateLayers(updatedAll);
    } else {
      onUpdateLayer(copy);
    }
  };

  // Direct Position / 3D Depth update helper
  const setDirectPosition = (newX: number, newY: number, newZ: number) => {
    const copy = getFastTransformCopy();
    const newPos = {
      x: Math.round(newX),
      y: Math.round(newY),
      z: Math.round(newZ),
    };
    updatePropertyWithKeyframes(copy.transform.position, newPos);

    if (sync3DAll && allLayers.length > 0 && onUpdateLayers) {
      const deltaX = newPos.x - (evalPos?.x ?? 0);
      const deltaY = newPos.y - (evalPos?.y ?? 0);
      const deltaZ = newPos.z - (evalPos?.z ?? 0);
      const updatedAll = allLayers.map((l) => {
        if (l.id === layer.id) return copy;
        const lPos = evaluateProperty(l.transform.position, currentFrame, 30, l.startFrame) as any;
        const lRelFrame = currentFrame - l.startFrame;
        const lNewPos = {
          x: Math.round((lPos?.x ?? 0) + deltaX),
          y: Math.round((lPos?.y ?? 0) + deltaY),
          z: Math.round((lPos?.z ?? 0) + deltaZ),
        };
        const lKfs = l.transform.position.keyframes
          ? l.transform.position.keyframes.map((k: any) =>
              Math.abs(k.frame - lRelFrame) < 0.5 ? { ...k, value: lNewPos } : k
            )
          : [];
        return {
          ...l,
          transform: {
            ...l.transform,
            position: {
              ...l.transform.position,
              value: lNewPos,
              keyframes: lKfs,
            },
          },
        };
      });
      onUpdateLayers(updatedAll);
    } else {
      onUpdateLayer(copy);
    }
  };

  // Direct scale update helper (supports infinite magnification and infinite micro-shrinking)
  const setDirectScale = (newScaleX: number, newScaleY?: number) => {
    const sX = Math.max(0.01, Math.round(newScaleX * 10) / 10);
    const sY = Math.max(0.01, Math.round((newScaleY ?? (lockAspect ? sX : (evalScale?.y ?? 100))) * 10) / 10);

    const copy = getFastTransformCopy();
    const prevX = evalScale?.x || copy.transform.scale.value.x || 100;
    const prevY = evalScale?.y ?? copy.transform.scale.value.y ?? 100;
    const prevZ = evalScale?.z ?? copy.transform.scale.value.z ?? 100;
    const sZ = lockAspect
      ? Math.max(0.01, Math.round(prevZ * (sX / Math.max(0.01, prevX)) * 10) / 10)
      : prevZ;
    if (
      (copy.transform.scale.keyframes?.length || 0) === 0 &&
      Math.abs(sX - prevX) < 0.001 &&
      Math.abs(sY - prevY) < 0.001 &&
      Math.abs(sZ - prevZ) < 0.001
    ) {
      return;
    }
    const newScale = {
      x: sX,
      y: sY,
      z: sZ,
    };
    updatePropertyWithKeyframes(copy.transform.scale, newScale);
    onUpdateLayer(copy);
  };

  // Direct 2D Rotation update helper
  const setDirect2DRotation = (rotZ: number) => {
    const copy = getFastTransformCopy();
    const newRot = {
      x: evalRot?.x ?? 0,
      y: evalRot?.y ?? 0,
      z: Math.round(rotZ * 10) / 10,
    };
    updatePropertyWithKeyframes(copy.transform.rotation, newRot);
    onUpdateLayer(copy);
  };

  // Node Video 3D Mesh config helper
  const updateMesh3DConfig = (patch: any) => {
    const copy = getCopy();
    const currentMesh = copy.mesh3dConfig || {
      enabled: true,
      type: 'cube',
      depth: 120,
      bevel: 3,
      bendAngle: 60,
      lightAngle: 45,
      lightElevation: 35,
      ambientIntensity: 0.4,
      diffuseIntensity: 0.6,
      specular: 0.8,
      roughness: 0.3,
      castFloorShadow: true,
      castFloorReflection: false,
    };
    copy.mesh3dConfig = { ...currentMesh, ...patch };
    onUpdateLayer(copy);
  };

  // Apply Node Video 3D motion preset helper
  const applyNodeVideo3DPreset = (presetId: string) => {
    const preset = MOTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const copy = preset.apply(getCopy());
    onUpdateLayer(copy);
    showPadToast(lang === 'ar' ? `✨ تم تطبيق تحريك 3D (${preset.nameAr || preset.name})` : `✨ Applied 3D Preset (${preset.name})`);
  };

  // Get active property target
  let activeProp: any = layer.transform.position;
  if (mode === 'rotation') activeProp = layer.transform.rotation;
  else if (mode === 'scale') activeProp = layer.transform.scale;

  const keyframes = activeProp?.keyframes || [];
  const sortedKeyframes = [...keyframes].sort((a: any, b: any) => a.frame - b.frame);

  const hasPosKeyframe = (layer.transform.position.keyframes || []).some((k) => Math.abs(k.frame - relFrame) < 0.5);
  const hasRotKeyframe = (layer.transform.rotation.keyframes || []).some((k) => Math.abs(k.frame - relFrame) < 0.5);
  const hasScaleKeyframe = (layer.transform.scale.keyframes || []).some((k) => Math.abs(k.frame - relFrame) < 0.5);

  const activeKeyframesCount = keyframes.length;
  const canShowCurves = activeKeyframesCount >= 2;

  // Auto close curve drawer if keyframes count dropped below 2
  useEffect(() => {
    if (!canShowCurves && showCurveDrawer) {
      setShowCurveDrawer(false);
    }
  }, [canShowCurves, showCurveDrawer]);

  // Load existing bezier handle when opening curve editor
  const handleOpenCurveDrawer = () => {
    if (sortedKeyframes.length >= 2) {
      let segIdx = sortedKeyframes.findIndex((k: any) => k.frame >= relFrame);
      if (segIdx <= 0) segIdx = 0;
      else segIdx = Math.min(sortedKeyframes.length - 2, segIdx - 1);
      setActiveSegmentIndex(segIdx);
      const targetKf = sortedKeyframes[segIdx];
      if (targetKf?.bezierHandle) {
        setBezierHandle(targetKf.bezierHandle);
      } else {
        setBezierHandle({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 });
      }
    }
    setShowCurveDrawer(true);
  };

  const handleSelectSegment = (segmentIndex: number) => {
    const clampedIndex = Math.max(0, Math.min(sortedKeyframes.length - 2, segmentIndex));
    setActiveSegmentIndex(clampedIndex);
    const targetKf = sortedKeyframes[clampedIndex];
    if (targetKf) {
      if (targetKf.bezierHandle) {
        setBezierHandle(targetKf.bezierHandle);
      } else {
        setBezierHandle({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 });
      }
    }
  };

  // All keyframe frames on this layer across all properties
  const allKeyframeFrames: number[] = Array.from(
    new Set([
      ...(layer.transform.position.keyframes || []).map((k) => layer.startFrame + k.frame),
      ...(layer.transform.rotation.keyframes || []).map((k) => layer.startFrame + k.frame),
      ...(layer.transform.scale.keyframes || []).map((k) => layer.startFrame + k.frame),
      ...(layer.transform.opacity.keyframes || []).map((k) => layer.startFrame + k.frame),
      ...(layer.transform.anchorPoint?.keyframes || []).map((k) => layer.startFrame + k.frame),
    ])
  ).sort((a, b) => a - b);

  const prevKeyframe = [...allKeyframeFrames].reverse().find((f) => f < currentFrame - 0.5);
  const nextKeyframe = allKeyframeFrames.find((f) => f > currentFrame + 0.5);

  const handlePrevKeyframe = () => {
    if (prevKeyframe !== undefined && onSetCurrentFrame) {
      onSetCurrentFrame(prevKeyframe);
    }
  };

  const handleNextKeyframe = () => {
    if (nextKeyframe !== undefined && onSetCurrentFrame) {
      onSetCurrentFrame(nextKeyframe);
    }
  };

  const applyCurveToKeyframe = (
    easing: any,
    handle?: { x1: number; y1: number; x2: number; y2: number },
    targetSegmentIndex?: number
  ) => {
    if (!canShowCurves) return;
    const copy = getCopy();
    let propToUpdate: any = copy.transform.position;
    if (mode === 'rotation') propToUpdate = copy.transform.rotation;
    else if (mode === 'scale') propToUpdate = copy.transform.scale;

    if (!propToUpdate.keyframes || propToUpdate.keyframes.length < 2) {
      return;
    }

    const sorted = [...propToUpdate.keyframes].sort((a: any, b: any) => a.frame - b.frame);
    const segIdx = targetSegmentIndex !== undefined ? targetSegmentIndex : activeSegmentIndex;
    const targetKf = sorted[Math.max(0, Math.min(sorted.length - 2, segIdx))];
    if (targetKf) {
      const realKf = propToUpdate.keyframes.find((k: any) => k.id === targetKf.id || Math.abs(k.frame - targetKf.frame) < 0.01);
      if (realKf) {
        realKf.easing = easing;
        if (handle) realKf.bezierHandle = JSON.parse(JSON.stringify(handle));
      }
    }
    onUpdateLayer(copy);
  };

  const handleApplyToAllSegments = (handle: BezierHandle, easing: EasingType) => {
    const copy = getCopy();
    let propToUpdate: any = copy.transform.position;
    if (mode === 'rotation') propToUpdate = copy.transform.rotation;
    else if (mode === 'scale') propToUpdate = copy.transform.scale;

    if (propToUpdate.keyframes) {
      propToUpdate.keyframes.forEach((kf: any) => {
        kf.easing = easing;
        kf.bezierHandle = JSON.parse(JSON.stringify(handle));
      });
      onUpdateLayer(copy);
    }
  };

  // Quick Copy/Paste on the Pad Bar
  const handleQuickCopyCurve = () => {
    if (sortedKeyframes.length >= 2) {
      const segKf = sortedKeyframes[Math.max(0, Math.min(sortedKeyframes.length - 2, activeSegmentIndex))];
      const handle = segKf?.bezierHandle || bezierHandle;
      const easing = segKf?.easing || 'bezier';
      copyCurveToClipboard(handle, easing);
      showPadToast(lang === 'ar' ? '📋 تم نسخ المنحنى!' : '📋 Curve Copied!');
    }
  };

  const handleQuickPasteCurve = () => {
    const copied = getCopiedCurveFromClipboard();
    if (!copied) {
      showPadToast(lang === 'ar' ? '⚠️ لا يوجد منحنى منسوخ' : '⚠️ No copied curve');
      return;
    }
    if (sortedKeyframes.length >= 2) {
      setBezierHandle(copied.handle);
      applyCurveToKeyframe(copied.easing, copied.handle, activeSegmentIndex);
      showPadToast(lang === 'ar' ? '📥 تم لصق المنحنى في الكي فريم!' : '📥 Curve Pasted to Keyframe!');
    }
  };

  // Pointer / Touch Handlers for the Touchpad area (60fps rAF coalescing + window-level tracking)
  const applyPadTransformAtPointer = (clientX: number, clientY: number) => {
    const totalDx = clientX - startPointerRef.current.x;
    const totalDy = clientY - startPointerRef.current.y;
    setDragVisualDelta({
      x: Math.max(-44, Math.min(44, totalDx * 0.35)),
      y: Math.max(-36, Math.min(36, totalDy * 0.35)),
    });
    const copy = getFastTransformCopy();

    if (mode === 'position') {
      if (posTab === 'xy') {
        const layersList = allLayers.length > 0 ? allLayers : [layer];
        const worldMat = getLayerWorldMatrix(layer, layersList, currentFrame, 30);
        const zPersp = copy.fixedIn3D
          ? 1
          : Math.max(1e-5, worldMat.perspectiveFactor || computeInfinitePerspective(1000, 1000 - (startPosRef.current.z || 0), 220));
        const quant = zPersp > 5 ? 100000 : 10;
        const newPos = {
          x: Math.round((startPosRef.current.x + (totalDx * 1.25) / zPersp) * quant) / quant,
          y: Math.round((startPosRef.current.y + (totalDy * 1.25) / zPersp) * quant) / quant,
          z: startPosRef.current.z,
        };
        copy.is3D = true;
        updatePropertyWithKeyframes(copy.transform.position, newPos);
        onUpdateLayer(copy);
      } else {
        // Infinite 3D Z-Depth & Penetration drag (no upper/lower limits, smooth progressive acceleration)
        const zDelta = -totalDy * 3.5 * (1 + Math.abs(totalDy) / 140);
        const newZ = Math.round((startPosRef.current.z + zDelta) * 10) / 10;
        const deltaPosZ = newZ - (evalPos?.z ?? 0);
        copy.is3D = true;
        copy.fixedIn3D = false;
        updatePropertyWithKeyframes(copy.transform.position, {
          x: startPosRef.current.x,
          y: startPosRef.current.y,
          z: newZ,
        });

        if (sync3DAll && allLayers.length > 0 && onUpdateLayers) {
          const updatedAll = allLayers.map((l) => {
            if (l.id === layer.id) return copy;
            if (deltaPosZ === 0) return l;
            const lRelFrame = currentFrame - l.startFrame;
            const lPos = evaluateProperty(l.transform.position, currentFrame, 30, l.startFrame) as any;
            const lNewPos = {
              x: lPos?.x ?? 0,
              y: lPos?.y ?? 0,
              z: Math.round(((lPos?.z ?? 0) + deltaPosZ) * 10) / 10,
            };
            const lKfs = l.transform.position.keyframes
              ? l.transform.position.keyframes.map((k: any) =>
                  Math.abs(k.frame - lRelFrame) < 0.5 ? { ...k, value: lNewPos } : k
                )
              : [];
            return {
              ...l,
              transform: {
                ...l.transform,
                position: {
                  ...l.transform.position,
                  value: lNewPos,
                  keyframes: lKfs,
                },
              },
            };
          });
          onUpdateLayers(updatedAll);
        } else {
          onUpdateLayer(copy);
        }
      }
    } else if (mode === 'rotation') {
      let deltaRotX = 0;
      let deltaRotY = 0;

      if (rotTab === 'z') {
        const newRotZ = Math.round((startRotRef.current.z + totalDx * 0.75) * 10) / 10;
        updatePropertyWithKeyframes(copy.transform.rotation, {
          x: startRotRef.current.x,
          y: startRotRef.current.y,
          z: newRotZ,
        });
        onUpdateLayer(copy);
      } else if (rotTab === 'x') {
        const newRotX = Math.round((startRotRef.current.x - totalDy * 0.75) * 10) / 10;
        deltaRotX = newRotX - (evalRot?.x ?? 0);
        updatePropertyWithKeyframes(copy.transform.rotation, {
          x: newRotX,
          y: startRotRef.current.y,
          z: startRotRef.current.z,
        });
        copy.is3D = true;
        copy.fixedIn3D = false;
      } else if (rotTab === 'y') {
        const newRotY = Math.round((startRotRef.current.y + totalDx * 0.75) * 10) / 10;
        deltaRotY = newRotY - (evalRot?.y ?? 0);
        updatePropertyWithKeyframes(copy.transform.rotation, {
          x: startRotRef.current.x,
          y: newRotY,
          z: startRotRef.current.z,
        });
        copy.is3D = true;
        copy.fixedIn3D = false;
      } else if (rotTab === 'depth') {
        const curDepth = copy.mesh3dConfig?.depth ?? 22;
        // Infinite 3D depth extrusion (no upper clamp)
        const newDepth = Math.max(0, Math.round(curDepth - totalDy * 0.8));
        const currentMesh = copy.mesh3dConfig || {
          enabled: true,
          type: 'plane',
          depth: 22,
          bevel: 2,
          material: 'chrome',
          lightAngle: 45,
          lightElevation: 35,
          ambientIntensity: 0.45,
          diffuseIntensity: 0.65,
          specular: 0.9,
          roughness: 0.2,
          castFloorShadow: true,
        };
        copy.mesh3dConfig = { ...currentMesh, depth: newDepth, enabled: true };
        copy.is3D = true;
        copy.fixedIn3D = false;
        onUpdateLayer(copy);
      }

      if (rotTab !== 'z') {
        if (sync3DAll && allLayers.length > 0 && onUpdateLayers) {
          const updatedAll = allLayers.map((l) => {
            if (l.id === layer.id) return copy;
            if (deltaRotX === 0 && deltaRotY === 0) return l;
            const lRelFrame = currentFrame - l.startFrame;
            const lRot = evaluateProperty(l.transform.rotation, currentFrame, 30, l.startFrame) as any;
            const lNewRot = {
              x: Math.round(((lRot?.x ?? 0) + deltaRotX) * 10) / 10,
              y: Math.round(((lRot?.y ?? 0) + deltaRotY) * 10) / 10,
              z: lRot?.z ?? 0,
            };
            const lKfs = l.transform.rotation.keyframes
              ? l.transform.rotation.keyframes.map((k: any) =>
                  Math.abs(k.frame - lRelFrame) < 0.5 ? { ...k, value: lNewRot } : k
                )
              : [];
            return {
              ...l,
              transform: {
                ...l.transform,
                rotation: {
                  ...l.transform.rotation,
                  value: lNewRot,
                  keyframes: lKfs,
                },
              },
            };
          });
          onUpdateLayers(updatedAll);
        } else {
          onUpdateLayer(copy);
        }
      }
    } else if (mode === 'scale') {
      // Infinite magnification and infinite shrinking with proportional exponential response
      const dragSens = (totalDx - totalDy) * 0.0075;
      const factor = Math.exp(dragSens);
      const newScaleX = Math.max(0.01, Math.round(startScaleRef.current.x * factor * 10) / 10);
      const newScaleY = lockAspect
        ? newScaleX
        : Math.max(0.01, Math.round(startScaleRef.current.y * factor * 10) / 10);
      const newScaleZ = lockAspect
        ? Math.max(0.01, Math.round((startScaleRef.current.z || 100) * factor * 10) / 10)
        : startScaleRef.current.z;
      const curScaleX = evalScale?.x ?? 100;
      const curScaleY = evalScale?.y ?? 100;
      const curScaleZ = evalScale?.z ?? 100;
      if (
        Math.abs(newScaleX - curScaleX) < 0.001 &&
        Math.abs(newScaleY - curScaleY) < 0.001 &&
        Math.abs(newScaleZ - curScaleZ) < 0.001
      ) {
        return;
      }
      updatePropertyWithKeyframes(copy.transform.scale, {
        x: newScaleX,
        y: newScaleY,
        z: newScaleZ,
      });
      onUpdateLayer(copy);
    }
  };

  const applyPadTransformRef = useRef(applyPadTransformAtPointer);
  applyPadTransformRef.current = applyPadTransformAtPointer;

  const handlePointerDown = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragVisualDelta({ x: 0, y: 0 });
    startPointerRef.current = { x: clientX, y: clientY };
    startPosRef.current = {
      x: evalPos?.x ?? 0,
      y: evalPos?.y ?? 0,
      z: evalPos?.z ?? layer.transform.position.value.z ?? 0,
    };
    startRotRef.current = {
      x: evalRot?.x ?? layer.transform.rotation.value.x ?? 0,
      y: evalRot?.y ?? layer.transform.rotation.value.y ?? 0,
      z: evalRot?.z ?? layer.transform.rotation.value.z ?? 0,
    };
    startScaleRef.current = {
      x: evalScale?.x ?? 100,
      y: evalScale?.y ?? 100,
      z: evalScale?.z ?? 100,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleWinMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      if ('touches' in e) {
        if (e.cancelable) e.preventDefault();
        if (e.touches.length === 0) return;
        pendingMoveCoordsRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
        pendingMoveCoordsRef.current = { x: e.clientX, y: e.clientY };
      }

      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          const coords = pendingMoveCoordsRef.current;
          if (coords && isDraggingRef.current) {
            applyPadTransformRef.current(coords.x, coords.y);
          }
        });
      }
    };

    const handleWinUp = () => {
      isDraggingRef.current = false;
      pendingMoveCoordsRef.current = null;
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setIsDragging(false);
      setDragVisualDelta({ x: 0, y: 0 });
    };

    window.addEventListener('mousemove', handleWinMove);
    window.addEventListener('touchmove', handleWinMove, { passive: false });
    window.addEventListener('mouseup', handleWinUp);
    window.addEventListener('touchend', handleWinUp);
    window.addEventListener('touchcancel', handleWinUp);

    return () => {
      window.removeEventListener('mousemove', handleWinMove);
      window.removeEventListener('touchmove', handleWinMove);
      window.removeEventListener('mouseup', handleWinUp);
      window.removeEventListener('touchend', handleWinUp);
      window.removeEventListener('touchcancel', handleWinUp);
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, [isDragging]);

  // Helper to add next movement keyframe 30 frames ahead (or customizable step)
  const handleAddNextMove = () => {
    const nextF = Math.min(layer.durationFrames, currentFrame + 30);
    if (onSetCurrentFrame) {
      onSetCurrentFrame(nextF);
    }
    const propPath =
      mode === 'position'
        ? 'transform.position'
        : mode === 'rotation'
        ? 'transform.rotation'
        : 'transform.scale';

    // Call add keyframe
    onAddKeyframe(layer.id, propPath);
    showPadToast(
      lang === 'ar'
        ? `✨ تمت إضافة حركة جديدة عند فريم ${nextF}`
        : `✨ New movement added at frame ${nextF}`
    );
  };

  // Helper to delete keyframe at current frame
  const handleDeleteCurrentKeyframe = (targetRelFrame?: number) => {
    const f = targetRelFrame !== undefined ? targetRelFrame : relFrame;
    const copy = getCopy();
    let propToUpdate: any = copy.transform.position;
    if (mode === 'rotation') propToUpdate = copy.transform.rotation;
    else if (mode === 'scale') propToUpdate = copy.transform.scale;

    if (propToUpdate && propToUpdate.keyframes) {
      const idx = propToUpdate.keyframes.findIndex((k: any) => Math.abs(k.frame - f) < 0.5);
      if (idx >= 0) {
        propToUpdate.keyframes.splice(idx, 1);
        onUpdateLayer(copy);
        showPadToast(lang === 'ar' ? '🗑️ تم حذف حركة الكي فريم' : '🗑️ Keyframe Deleted');
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-[#141517] text-slate-200 select-none overflow-hidden relative">
      {/* Pad Quick Toast */}
      {padToast && (
        <div className="absolute top-9 left-1/2 -translate-x-1/2 z-50 bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-bold text-[11px] px-3 py-1 rounded-full shadow-lg flex items-center gap-1 animate-scaleIn pointer-events-none">
          <Check className="w-3 h-3 stroke-[3]" />
          <span>{padToast}</span>
        </div>
      )}

      {/* Top Header Bar: Timecode, Layer Name, Keyframe Navigation, Add Keyframe, Copy/Paste Curve */}
      <div className="px-3 py-1 bg-[#191A1D] border-b border-white/[0.06] flex items-center justify-between text-xs font-mono">
        {/* Playhead Time */}
        <span className="text-slate-300 font-semibold tabular-nums tracking-wider">
          {Math.floor(currentFrame / 30)}:{(currentFrame % 30).toString().padStart(2, '0')}
        </span>

        {/* Selected Layer Box */}
        <div className="flex items-center gap-1.5 bg-[#222326] border border-white/[0.06] px-2.5 py-0.5 rounded-[7px] text-slate-200 text-[11px] font-sans">
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-semibold text-white truncate max-w-[95px]">{layer.name || 'Layer'}</span>
          <ChevronLeft className="w-3 h-3 text-slate-400" />
        </div>

        {/* Keyframe Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevKeyframe}
            disabled={prevKeyframe === undefined}
            className={`p-1 rounded-[7px] border flex items-center justify-center transition-all active:scale-90 ${
              prevKeyframe !== undefined
                ? 'bg-[#222326] hover:bg-[#2C2E33] text-slate-200 border-white/[0.08]'
                : 'bg-[#191A1D] text-slate-600 border-white/[0.04] cursor-not-allowed opacity-45'
            }`}
            title={lang === 'ar' ? `الانتقال للكي فريم السابق (${prevKeyframe !== undefined ? `فريم ${prevKeyframe}` : 'لا يوجد'})` : `Go to Previous Keyframe`}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-0.5 bg-[#222326] border border-white/[0.06] px-1 py-0.5 rounded-[6px] text-[9px] font-mono">
            <span className={`px-1 rounded ${hasPosKeyframe ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-bold' : 'text-slate-500'}`} title="Position Keyframe">P</span>
            <span className={`px-1 rounded ${hasRotKeyframe ? 'bg-amber-300 text-[#0D110F] font-bold' : 'text-slate-500'}`} title="Rotation Keyframe">R</span>
            <span className={`px-1 rounded ${hasScaleKeyframe ? 'bg-sky-300 text-[#0D110F] font-bold' : 'text-slate-500'}`} title="Scale Keyframe">S</span>
          </div>

          <button
            onClick={() => {
              if (mode === 'position') onAddKeyframe(layer.id, 'transform.position');
              else if (mode === 'rotation') onAddKeyframe(layer.id, 'transform.rotation');
              else if (mode === 'scale') onAddKeyframe(layer.id, 'transform.scale');
            }}
            className={`px-2 py-1 rounded-[7px] transition-all active:scale-95 flex items-center gap-1 text-[10px] font-semibold border cursor-pointer ${
              (mode === 'position' && hasPosKeyframe) || (mode === 'rotation' && hasRotKeyframe) || (mode === 'scale' && hasScaleKeyframe)
                ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] border-[var(--app-accent-bright)]'
                : 'bg-[#222326] hover:bg-[#2C2E33] text-[var(--app-accent-bright)] border-white/[0.08]'
            }`}
            title={
              (mode === 'position' && hasPosKeyframe) || (mode === 'rotation' && hasRotKeyframe) || (mode === 'scale' && hasScaleKeyframe)
                ? (lang === 'ar' ? 'حذف كي فريم الحالي' : 'Remove Keyframe')
                : (lang === 'ar' ? 'إضافة كي فريم منفصل للخاصية الحالية' : 'Add Keyframe to current property')
            }
          >
            <Diamond className={`w-3 h-3 ${((mode === 'position' && hasPosKeyframe) || (mode === 'rotation' && hasRotKeyframe) || (mode === 'scale' && hasScaleKeyframe)) ? 'fill-[var(--app-accent-contrast)]' : 'fill-[var(--app-accent-bright)]'}`} />
            <span>
              {mode === 'position' ? (lang === 'ar' ? (posTab === 'z' ? 'كي فريم Z' : 'كي فريم') : (posTab === 'z' ? 'KF Z' : 'KF')) : mode === 'rotation' ? (lang === 'ar' ? 'دوران' : 'Rot') : (lang === 'ar' ? 'حجم' : 'Scale')}
            </span>
          </button>

          <button
            onClick={handleAddNextMove}
            className="px-2 py-1 bg-[#222326] hover:bg-[#2C2E33] text-slate-100 border border-white/[0.08] rounded-[7px] text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            title={lang === 'ar' ? 'إضافة حركة جديدة (+30 فريم)' : 'Add Next Move (+30 frames)'}
          >
            <Plus className="w-3 h-3 stroke-[2.5] text-[var(--app-accent-bright)]" />
            <span>{lang === 'ar' ? 'حركة' : 'Move'}</span>
          </button>

          <button
            onClick={handleNextKeyframe}
            disabled={nextKeyframe === undefined}
            className={`p-1 rounded-[7px] border flex items-center justify-center transition-all active:scale-90 ${
              nextKeyframe !== undefined
                ? 'bg-[#222326] hover:bg-[#2C2E33] text-slate-200 border-white/[0.08]'
                : 'bg-[#191A1D] text-slate-600 border-white/[0.04] cursor-not-allowed opacity-45'
            }`}
            title={lang === 'ar' ? `الانتقال للكي فريم التالي (${nextKeyframe !== undefined ? `فريم ${nextKeyframe}` : 'لا يوجد'})` : `Go to Next Keyframe`}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Property-Specific Keyframe Ribbon (hidden when Curve Drawer already provides its own Segment bar) */}
      {!(showCurveDrawer && canShowCurves) && (
        <div className="px-3 py-1 bg-[#18191C] border-b border-white/[0.05] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[70%]">
            <span className="text-[10px] font-medium text-slate-400 shrink-0">
              {mode === 'position'
                ? (lang === 'ar' ? (posTab === 'z' ? 'حركات Z:' : 'المسار:') : (posTab === 'z' ? 'Z Moves:' : 'Path:'))
                : mode === 'rotation'
                ? (lang === 'ar' ? (rotTab === 'z' ? 'الزاوية:' : rotTab === 'x' ? 'إمالة X:' : 'دوران Y:') : 'Rotation:')
                : (lang === 'ar' ? 'الحجم:' : 'Scale:')
              }
            </span>
            {sortedKeyframes.length === 0 ? (
              <span className="text-[10px] text-slate-500">
                {lang === 'ar' ? 'اسحب اللوحة للتحريك' : 'Drag pad to move'}
              </span>
            ) : (
              sortedKeyframes.map((kf: any, i: number) => {
                const isCurrent = Math.abs(kf.frame - relFrame) < 0.5;
                return (
                  <div key={kf.id || i} className="flex items-center shrink-0">
                    <button
                      onClick={() => onSetCurrentFrame && onSetCurrentFrame(layer.startFrame + kf.frame)}
                      className={`px-1.5 py-0.5 rounded-[5px] text-[9px] font-mono font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                        isCurrent
                          ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] border-[var(--app-accent-bright)]'
                          : 'bg-[#222326] hover:bg-[#2C2E33] text-slate-300 border-white/[0.06]'
                      }`}
                      title={lang === 'ar' ? `حركة ${i + 1} عند فريم ${kf.frame} (${kf.easing})` : `Move ${i + 1} at Frame ${kf.frame}`}
                    >
                      <span>◆ {kf.frame}f</span>
                      <span className="opacity-70 text-[8px]">({kf.easing || 'lin'})</span>
                    </button>
                    {isCurrent && sortedKeyframes.length > 1 && (
                      <button
                        onClick={() => handleDeleteCurrentKeyframe(kf.frame)}
                        className="ml-0.5 p-0.5 hover:bg-rose-900/50 text-rose-400 hover:text-rose-200 rounded transition-colors"
                        title={lang === 'ar' ? 'حذف هذا الكي فريم' : 'Delete this keyframe'}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Curve Copy & Paste Buttons on Pad Ribbon */}
          {sortedKeyframes.length >= 2 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleQuickCopyCurve}
                className="px-1.5 py-0.5 bg-[#222326] hover:bg-[#2C2E33] text-slate-200 border border-white/[0.08] rounded-[5px] text-[9px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title={lang === 'ar' ? 'نسخ منحنى الكي فريم الحالي' : 'Copy Curve of current keyframe'}
              >
                <Copy className="w-2.5 h-2.5 text-[var(--app-accent-bright)]" />
                <span>{lang === 'ar' ? 'نسخ المنحنى' : 'Copy'}</span>
              </button>
              <button
                onClick={handleQuickPasteCurve}
                disabled={!clipboardCurve}
                className={`px-1.5 py-0.5 rounded-[5px] text-[9px] font-semibold flex items-center gap-1 transition-all active:scale-95 border ${
                  clipboardCurve
                    ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border-[var(--app-accent-border)] cursor-pointer'
                    : 'bg-[#1C1D20] text-slate-600 border-white/[0.04] opacity-45 cursor-not-allowed'
                }`}
                title={
                  clipboardCurve
                    ? (lang === 'ar' ? `لصق المنحنى (${clipboardCurve.name || 'Curve'})` : `Paste copied curve`)
                    : (lang === 'ar' ? 'انسخ منحنى أولاً' : 'No curve copied')
                }
              >
                <ClipboardPaste className="w-2.5 h-2.5" />
                <span>{lang === 'ar' ? 'لصق' : 'Paste'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Move & Transform Workspace OR Graph Editor */}
      {showCurveDrawer && canShowCurves ? (
        <AlightBezierGraph
          lang={lang}
          bezierHandle={bezierHandle}
          onChangeHandle={(handle, easingName) => {
            setBezierHandle(handle);
            applyCurveToKeyframe(easingName || 'bezier', handle, activeSegmentIndex);
          }}
          onClose={() => setShowCurveDrawer(false)}
          keyframes={sortedKeyframes}
          activeSegmentIndex={activeSegmentIndex}
          onSelectSegment={handleSelectSegment}
          onApplyToAllSegments={handleApplyToAllSegments}
          propertyName={mode}
        />
      ) : (
        <div className="relative p-2 flex items-center justify-between gap-2 bg-[#141517] overflow-y-auto overscroll-contain flex-1 min-h-0">
          {/* Left Toolbar (Mode Selection: 1. Position & 3D Z-Depth, 2. Rotation & 3D Pitch/Yaw, 3. Scale) */}
          <div className="flex flex-col gap-1.5 z-10 shrink-0">
            <button
              onClick={() => setMode('position')}
              className={`p-2 rounded-[10px] border transition-all flex items-center justify-center cursor-pointer ${
                mode === 'position'
                  ? 'bg-[#2C2E33] border-white/25 text-white'
                  : 'bg-[#1F2024] border-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-[#26282C]'
              }`}
              title={lang === 'ar' ? 'تحريك الموقع والعمق Z' : 'Move Position XY & Z-Depth'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 9 2 12 5 15" />
                <polyline points="9 5 12 2 15 5" />
                <polyline points="15 19 12 22 9 19" />
                <polyline points="19 9 22 12 19 15" />
                <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.7" />
                <line x1="12" y1="2" x2="12" y2="22" strokeWidth="1.7" />
              </svg>
            </button>

            <button
              onClick={() => setMode('rotation')}
              className={`p-2 rounded-[10px] border transition-all flex items-center justify-center cursor-pointer ${
                mode === 'rotation'
                  ? 'bg-[#2C2E33] border-white/25 text-white'
                  : 'bg-[#1F2024] border-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-[#26282C]'
              }`}
              title={lang === 'ar' ? 'الزاوية والتدوير 2D/3D' : 'Rotation & 3D Pitch/Yaw'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <polyline points="21 3 21 8 16 8" />
              </svg>
            </button>

            <button
              onClick={() => setMode('scale')}
              className={`p-2 rounded-[10px] border transition-all flex items-center justify-center cursor-pointer ${
                mode === 'scale'
                  ? 'bg-[#2C2E33] border-white/25 text-white'
                  : 'bg-[#1F2024] border-white/[0.05] text-slate-400 hover:text-slate-200 hover:bg-[#26282C]'
              }`}
              title={lang === 'ar' ? 'تكبير وتصغير الحجم' : 'Scale & Resize'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

          {/* Central Interactive Workspace */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 max-w-md mx-auto w-full">
            {/* 1. Mode: Position & 3D Z-Depth */}
            {mode === 'position' && (
              <div className="w-full flex flex-col gap-1.5">
                <div className="flex items-center gap-1 bg-[#1D1E21] p-1 rounded-[9px] border border-white/[0.05] w-full">
                  <button
                    onClick={() => setPosTab('xy')}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-[7px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      posTab === 'xy'
                        ? 'bg-[#2D2F34] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Move className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'تحريك XY' : 'XY Pan'}</span>
                  </button>
                  <button
                    onClick={() => setPosTab('z')}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-[7px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      posTab === 'z'
                        ? 'bg-[#2D2F34] text-[var(--app-accent-bright)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Box className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'العمق Z (3D)' : '3D Z-Depth'}</span>
                  </button>
                </div>

                {posTab === 'xy' ? (
                  <>
                    <div className="flex items-center justify-between bg-[#1D1E21] px-2.5 py-1.5 rounded-[9px] border border-white/[0.05]">
                      <div className="flex items-center gap-2.5 font-mono text-[11px] font-semibold text-slate-200 tabular-nums">
                        <span>X: {Math.round(evalPos?.x ?? 0)}</span>
                        <span>Y: {Math.round(evalPos?.y ?? 0)}</span>
                        <button
                          onClick={() => setPosTab('z')}
                          className="text-slate-200 hover:text-white flex items-center gap-1 font-mono bg-[#26282C] px-1.5 py-0.5 rounded-[5px] border border-white/[0.06] cursor-pointer"
                          title={lang === 'ar' ? 'انقر للتحكم في العمق Z' : 'Click to edit 3D Z'}
                        >
                          <span>Z: {Math.round(evalPos?.z ?? 0)}</span>
                          <span className="text-[8.5px] text-[var(--app-accent-bright)] font-bold">3D</span>
                        </button>
                      </div>
                      <button
                        onClick={() => setDirectPosition(640, 360, evalPos?.z ?? 0)}
                        className="px-2 py-0.5 bg-[#26282C] hover:bg-[#303338] border border-white/[0.06] rounded-[6px] text-[10px] font-medium text-slate-200 active:scale-95 cursor-pointer"
                      >
                        {lang === 'ar' ? 'توسيط' : 'Center'}
                      </button>
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePointerDown(e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                      }}
                      className={`relative min-h-[88px] w-full border bg-[#191A1D] rounded-[12px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors p-2.5 touch-none select-none group overflow-hidden ${
                        isDragging ? 'border-[rgba(var(--app-accent-bright-rgb),0.7)] bg-[#1D1F22]' : 'border-white/[0.07] hover:border-white/15'
                      }`}
                    >
                      {isDragging && (
                        <div
                          className="absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-[rgba(var(--app-accent-bright-rgb),0.35)] border-2 border-[var(--app-accent-bright)] pointer-events-none"
                          style={{ transform: `translate3d(${dragVisualDelta.x}px, ${dragVisualDelta.y}px, 0)` }}
                        />
                      )}
                      <div className="flex items-center justify-between w-full pointer-events-none">
                        <span className="text-slate-300 bg-[#25262A] px-2 py-0.5 rounded-[5px] text-[9.5px] font-mono">
                          XY PAN
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400">
                          ({Math.round(evalPos?.x ?? 0)}, {Math.round(evalPos?.y ?? 0)})
                        </span>
                      </div>

                      <p className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors text-center pointer-events-none my-auto">
                        {lang === 'ar' ? 'اسحب هنا لتحريك الطبقة (X, Y)' : 'Swipe here to move layer (X, Y)'}
                      </p>

                      <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500 pointer-events-none">
                        <span>-X ←</span>
                        <span>↑ -Y | +Y ↓</span>
                        <span>→ +X</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePointerDown(e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                    }}
                    className={`relative min-h-[120px] w-full border bg-[#191A1D] rounded-[12px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors p-3 touch-none select-none group overflow-hidden ${
                      isDragging ? 'border-[rgba(var(--app-accent-bright-rgb),0.7)]' : 'border-white/[0.07] hover:border-white/15'
                    }`}
                  >
                    {isDragging && (
                      <div
                        className="absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-[rgba(var(--app-accent-bright-rgb),0.35)] border-2 border-[var(--app-accent-bright)] pointer-events-none"
                        style={{ transform: `translate3d(0px, ${dragVisualDelta.y}px, 0)` }}
                      />
                    )}
                    <div className="flex items-center justify-between w-full pointer-events-none">
                      <span className="text-[var(--app-accent-bright)] bg-[#25262A] px-2 py-0.5 rounded-[5px] text-[9.5px] font-mono">
                        3D Z-DEPTH
                      </span>
                      <div className="flex items-center gap-2 pointer-events-auto">
                        <span className="text-[10px] font-mono font-semibold text-slate-300 tabular-nums bg-[#25262A] px-1.5 py-0.5 rounded">
                          {(() => {
                            const layersList = allLayers.length > 0 ? allLayers : [layer];
                            const wMat = getLayerWorldMatrix(layer, layersList, currentFrame, 30);
                            const dz = wMat.cameraDz ?? (1000 - (evalPos?.z ?? 0));
                            if (dz <= 6) {
                              return lang === 'ar' ? 'خلف الكاميرا' : 'Behind Cam';
                            }
                            const pFactor = wMat.perspectiveFactor
                              || computeInfinitePerspective(1000, dz, 16);
                            if (pFactor >= 10000) return `×${(pFactor / 1000).toFixed(1)}K`;
                            return `×${pFactor.toFixed(2)}`;
                          })()}
                        </span>
                        <span className="text-xs font-mono font-semibold text-white tabular-nums">
                          {(evalPos?.z ?? 0) > 0 ? '+' : ''}{Math.round(evalPos?.z ?? 0)}
                        </span>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={() => setDirectPosition(evalPos?.x ?? 0, evalPos?.y ?? 0, 0)}
                          className="px-2 py-0.5 bg-[#25262A] hover:bg-[#303338] border border-white/[0.06] rounded text-[10px] font-medium text-slate-200 cursor-pointer"
                          title={lang === 'ar' ? 'تصفير Z' : 'Reset Z'}
                        >
                          0
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors text-center pointer-events-none my-auto">
                      {lang === 'ar' ? 'اسحب للأعلى لتقريب Z | للأسفل للعمق -Z' : 'Swipe Up +Z | Swipe Down -Z depth'}
                    </p>

                    <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500 pointer-events-none">
                      <span>⬇ -Z</span>
                      <span>3D Z</span>
                      <span>+Z ⬆</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Mode: Rotation & 3D Orientation */}
            {mode === 'rotation' && (
              <div className="w-full flex flex-col gap-1.5">
                <div className="flex items-center gap-1 bg-[#1D1E21] p-1 rounded-[9px] border border-white/[0.05] w-full">
                  <button
                    onClick={() => setRotTab('z')}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-[7px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      rotTab === 'z' ? 'bg-[#2D2F34] text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'زاوية Z' : 'Angle Z'}</span>
                  </button>
                  <button
                    onClick={() => setRotTab('x')}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-[7px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      rotTab === 'x' ? 'bg-[#2D2F34] text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'إمالة X' : 'Pitch X'}</span>
                  </button>
                  <button
                    onClick={() => setRotTab('y')}
                    className={`flex-1 py-1 px-2 text-[11px] font-semibold rounded-[7px] transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      rotTab === 'y' ? 'bg-[#2D2F34] text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ArrowRight className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'دوران Y' : 'Yaw Y'}</span>
                  </button>
                </div>

                {rotTab === 'z' && (
                  <div className="w-full bg-[#191A1D] border border-white/[0.07] rounded-[12px] p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white font-mono tabular-nums">
                        {lang === 'ar' ? 'الزاوية Z:' : 'Angle Z:'} {Math.round(evalRot?.z ?? 0)}°
                      </span>
                      <button
                        onClick={() => setDirect2DRotation(0)}
                        className="px-2 py-0.5 bg-[#25262A] hover:bg-[#303338] border border-white/[0.06] rounded text-[10px] font-medium text-slate-200 cursor-pointer"
                      >
                        0°
                      </button>
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePointerDown(e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                      }}
                      className={`relative min-h-[82px] w-full border bg-[#141517] rounded-[10px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors p-2.5 touch-none select-none group overflow-hidden ${
                        isDragging ? 'border-[rgba(var(--app-accent-bright-rgb),0.7)]' : 'border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      {isDragging && (
                        <div
                          className="absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-[rgba(var(--app-accent-bright-rgb),0.35)] border-2 border-[var(--app-accent-bright)] pointer-events-none"
                          style={{ transform: `translate3d(${dragVisualDelta.x}px, 0px, 0)` }}
                        />
                      )}
                      <div className="flex items-center justify-between w-full pointer-events-none text-[10px] font-mono text-slate-400">
                        <span>ROTATION Z</span>
                        <span>{Math.round(evalRot?.z ?? 0)}°</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors text-center pointer-events-none my-auto">
                        {lang === 'ar' ? 'اسحب يميناً / يساراً لتدوير الزاوية' : 'Swipe left / right to rotate'}
                      </p>
                      <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500 pointer-events-none">
                        <span>↺ CCW</span>
                        <span>CW ↻</span>
                      </div>
                    </div>
                  </div>
                )}

                {rotTab === 'x' && (
                  <div className="w-full bg-[#191A1D] border border-white/[0.07] rounded-[12px] p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white font-mono tabular-nums">
                        {lang === 'ar' ? 'إمالة X (3D):' : '3D Pitch X:'} {Math.round(evalRot?.x ?? 0)}°
                      </span>
                      <button
                        onClick={() => setDirect3DRotation(0, evalRot?.y ?? 0, evalRot?.z ?? 0)}
                        className="px-2 py-0.5 bg-[#25262A] hover:bg-[#303338] border border-white/[0.06] rounded text-[10px] font-medium text-slate-200 cursor-pointer"
                      >
                        0°
                      </button>
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePointerDown(e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                      }}
                      className={`relative min-h-[82px] w-full border bg-[#141517] rounded-[10px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors p-2.5 touch-none select-none group overflow-hidden ${
                        isDragging ? 'border-[rgba(var(--app-accent-bright-rgb),0.7)]' : 'border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      {isDragging && (
                        <div
                          className="absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-[rgba(var(--app-accent-bright-rgb),0.35)] border-2 border-[var(--app-accent-bright)] pointer-events-none"
                          style={{ transform: `translate3d(0px, ${dragVisualDelta.y}px, 0)` }}
                        />
                      )}
                      <div className="flex items-center justify-between w-full pointer-events-none text-[10px] font-mono text-slate-400">
                        <span>3D PITCH X</span>
                        <span>{Math.round(evalRot?.x ?? 0)}°</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors text-center pointer-events-none my-auto">
                        {lang === 'ar' ? 'اسحب للأعلى / للأسفل للإمالة X' : 'Swipe up / down for 3D X tilt'}
                      </p>
                      <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500 pointer-events-none">
                        <span>⬇ Back</span>
                        <span>Front ⬆</span>
                      </div>
                    </div>
                  </div>
                )}

                {rotTab === 'y' && (
                  <div className="w-full bg-[#191A1D] border border-white/[0.07] rounded-[12px] p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white font-mono tabular-nums">
                        {lang === 'ar' ? 'دوران Y (3D):' : '3D Yaw Y:'} {Math.round(evalRot?.y ?? 0)}°
                      </span>
                      <button
                        onClick={() => setDirect3DRotation(evalRot?.x ?? 0, 0, evalRot?.z ?? 0)}
                        className="px-2 py-0.5 bg-[#25262A] hover:bg-[#303338] border border-white/[0.06] rounded text-[10px] font-medium text-slate-200 cursor-pointer"
                      >
                        0°
                      </button>
                    </div>

                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePointerDown(e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                      }}
                      className={`relative min-h-[82px] w-full border bg-[#141517] rounded-[10px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors p-2.5 touch-none select-none group overflow-hidden ${
                        isDragging ? 'border-[rgba(var(--app-accent-bright-rgb),0.7)]' : 'border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      {isDragging && (
                        <div
                          className="absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-[rgba(var(--app-accent-bright-rgb),0.35)] border-2 border-[var(--app-accent-bright)] pointer-events-none"
                          style={{ transform: `translate3d(${dragVisualDelta.x}px, 0px, 0)` }}
                        />
                      )}
                      <div className="flex items-center justify-between w-full pointer-events-none text-[10px] font-mono text-slate-400">
                        <span>3D YAW Y</span>
                        <span>{Math.round(evalRot?.y ?? 0)}°</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors text-center pointer-events-none my-auto">
                        {lang === 'ar' ? 'اسحب يميناً / يساراً للدوران Y' : 'Swipe left / right for 3D Y yaw'}
                      </p>
                      <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500 pointer-events-none">
                        <span>← Left</span>
                        <span>Right →</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Mode: Scale 2D */}
            {mode === 'scale' && (
              <div className="w-full bg-[#191A1D] border border-white/[0.07] rounded-[12px] p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-white tabular-nums">
                    <span>X: {Math.round(evalScale?.x ?? 100)}%</span>
                    <span>Y: {Math.round(evalScale?.y ?? 100)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setLockAspect(!lockAspect)}
                      className={`px-2 py-0.5 rounded-[6px] text-[10px] font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                        lockAspect
                          ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-border)] text-[var(--app-accent-bright)]'
                          : 'bg-[#25262A] border-white/[0.06] text-slate-400'
                      }`}
                      title={lockAspect ? 'نسبة ثابتة' : 'حر'}
                    >
                      {lockAspect ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                      <span>{lockAspect ? (lang === 'ar' ? 'مقفل' : 'Locked') : (lang === 'ar' ? 'حر' : 'Free')}</span>
                    </button>
                    <button
                      onClick={() => setDirectScale(100, 100)}
                      className="px-2 py-0.5 bg-[#25262A] hover:bg-[#303338] border border-white/[0.06] rounded text-[10px] font-medium text-slate-200 cursor-pointer"
                    >
                      100%
                    </button>
                  </div>
                </div>

                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePointerDown(e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className={`relative min-h-[82px] w-full border bg-[#141517] rounded-[10px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-colors p-2.5 touch-none select-none group overflow-hidden ${
                    isDragging ? 'border-[rgba(var(--app-accent-bright-rgb),0.7)]' : 'border-white/[0.06] hover:border-white/15'
                  }`}
                >
                  {isDragging && (
                    <div
                      className="absolute left-1/2 top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full bg-[rgba(var(--app-accent-bright-rgb),0.35)] border-2 border-[var(--app-accent-bright)] pointer-events-none"
                      style={{ transform: `translate3d(${dragVisualDelta.x}px, ${dragVisualDelta.y}px, 0)` }}
                    />
                  )}
                  <div className="flex items-center justify-between w-full pointer-events-none text-[10px] font-mono text-slate-400">
                    <span>SCALE</span>
                    <span>{Math.round(evalScale?.x ?? 100)}%</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-300 group-hover:text-white transition-colors text-center pointer-events-none my-auto">
                    {lang === 'ar' ? 'اسحب لتكبير أو تصغير الحجم' : 'Swipe to scale layer'}
                  </p>
                  <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-500 pointer-events-none">
                    <span>↙ Shrink</span>
                    <span>Grow ↗</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Toolbar (Curve Editor & Quick Actions) */}
          <div className="flex flex-col gap-1.5 z-10 shrink-0">
            {canShowCurves && (
              <button
                onClick={handleOpenCurveDrawer}
                className="p-2 rounded-[10px] border transition-all flex items-center justify-center bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border-[var(--app-accent-border)] text-[var(--app-accent-bright)] cursor-pointer"
                title={lang === 'ar' ? 'منحنيات الحركة والتسارع' : 'Easing Curves'}
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21 C 8 21, 16 3, 21 3" strokeWidth="2.2" />
                  <circle cx="3" cy="21" r="2" fill="currentColor" />
                  <circle cx="21" cy="3" r="2" fill="currentColor" />
                </svg>
              </button>
            )}

            <button
              className="p-2 bg-[#1F2024] hover:bg-[#26282C] border border-white/[0.05] rounded-[10px] text-slate-400 hover:text-white transition-all flex items-center justify-center"
              title={lang === 'ar' ? 'محاذاة نقطة الارتكاز' : 'Anchor Point'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <circle cx="12" cy="12" r="7" strokeWidth="1.7" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </button>

            <button
              className="p-2 bg-[#1F2024] hover:bg-[#26282C] border border-white/[0.05] rounded-[10px] text-slate-400 hover:text-white transition-all flex items-center justify-center"
              title={lang === 'ar' ? 'الشبكة والمحاذاة' : 'Grid'}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="4" strokeWidth="1.8" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
