import type {
  AnimatableProperty,
  CopiedPropertiesBundle,
  Layer,
  LayerType,
  PropertyPreset,
  PropertyTransferMode,
  PropertyTransferSelection,
  ShaderEffect,
  Vector3D,
} from '../types';

const PRESETS_STORAGE_KEY = 'sqmotion_property_presets_v1';

export function createDefaultPropertySelection(sourceLayer?: Layer | null): PropertyTransferSelection {
  return {
    transform: {
      positionX: true,
      positionY: true,
      positionZ: true,
      scaleX: true,
      scaleY: true,
      scaleZ: true,
      rotationX: true,
      rotationY: true,
      rotationZ: true,
      anchorPoint: true,
      opacity: true,
      perspective3D: true,
    },
    animation: {
      keyframes: true,
      easingCurves: true,
      springSettings: true,
      motionPaths: true,
      timing: false,
      speed: true,
    },
    appearance: {
      fill: true,
      stroke: true,
      gradientAndColors: true,
      shadowsAndGlow: true,
      bordersAndCorner: true,
      typography: true,
    },
    effects: {
      allEffects: true,
      selectedEffectIds: sourceLayer ? sourceLayer.effects.map((e) => e.id) : [],
      effectOrder: true,
      effectParams: true,
      blendMode: true,
    },
    mask: {
      maskLayerAndMode: true,
    },
  };
}

export function createEmptyPropertySelection(): PropertyTransferSelection {
  return {
    transform: {
      positionX: false,
      positionY: false,
      positionZ: false,
      scaleX: false,
      scaleY: false,
      scaleZ: false,
      rotationX: false,
      rotationY: false,
      rotationZ: false,
      anchorPoint: false,
      opacity: false,
      perspective3D: false,
    },
    animation: {
      keyframes: false,
      easingCurves: false,
      springSettings: false,
      motionPaths: false,
      timing: false,
      speed: false,
    },
    appearance: {
      fill: false,
      stroke: false,
      gradientAndColors: false,
      shadowsAndGlow: false,
      bordersAndCorner: false,
      typography: false,
    },
    effects: {
      allEffects: false,
      selectedEffectIds: [],
      effectOrder: false,
      effectParams: false,
      blendMode: false,
    },
    mask: {
      maskLayerAndMode: false,
    },
  };
}

function cloneAnimVec3(
  prop: AnimatableProperty<Vector3D>,
  sel: {
    keyframes: boolean;
    easingCurves: boolean;
    springSettings: boolean;
  }
): AnimatableProperty<Vector3D> {
  const cloned: AnimatableProperty<Vector3D> = {
    value: { ...prop.value },
    keyframes: sel.keyframes
      ? prop.keyframes.map((kf) => ({
          ...kf,
          id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          value: { ...kf.value },
          easing: sel.easingCurves || sel.springSettings ? kf.easing : 'linear',
          bezierHandle: sel.easingCurves && kf.bezierHandle ? { ...kf.bezierHandle } : undefined,
        }))
      : [],
    expression: prop.expression,
    isAnimated: sel.keyframes ? prop.isAnimated : false,
  };
  return cloned;
}

function cloneAnimNum(
  prop: AnimatableProperty<number>,
  sel: {
    keyframes: boolean;
    easingCurves: boolean;
    springSettings: boolean;
  }
): AnimatableProperty<number> {
  return {
    value: prop.value,
    keyframes: sel.keyframes
      ? prop.keyframes.map((kf) => ({
          ...kf,
          id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          easing: sel.easingCurves || sel.springSettings ? kf.easing : 'linear',
          bezierHandle: sel.easingCurves && kf.bezierHandle ? { ...kf.bezierHandle } : undefined,
        }))
      : [],
    expression: prop.expression,
    isAnimated: sel.keyframes ? prop.isAnimated : false,
  };
}

/**
 * Extracts selected properties into a clean, self-contained CopiedPropertiesBundle.
 */
export function extractLayerProperties(
  source: Layer,
  selection: PropertyTransferSelection
): CopiedPropertiesBundle {
  const payload: CopiedPropertiesBundle['payload'] = {};
  const animSel = {
    keyframes: selection.animation.keyframes,
    easingCurves: selection.animation.easingCurves,
    springSettings: selection.animation.springSettings,
  };

  // 1. Transform & 3D
  const t = selection.transform;
  const anyTransform =
    t.positionX ||
    t.positionY ||
    t.positionZ ||
    t.scaleX ||
    t.scaleY ||
    t.scaleZ ||
    t.rotationX ||
    t.rotationY ||
    t.rotationZ ||
    t.anchorPoint ||
    t.opacity ||
    selection.animation.motionPaths;

  if (anyTransform) {
    payload.transform = {};
    if (t.positionX || t.positionY || t.positionZ || selection.animation.motionPaths) {
      payload.transform.position = cloneAnimVec3(source.transform.position, animSel);
    }
    if (t.scaleX || t.scaleY || t.scaleZ) {
      payload.transform.scale = cloneAnimVec3(source.transform.scale, animSel);
    }
    if (t.rotationX || t.rotationY || t.rotationZ) {
      payload.transform.rotation = cloneAnimVec3(source.transform.rotation, animSel);
    }
    if (t.anchorPoint) {
      payload.transform.anchorPoint = cloneAnimVec3(source.transform.anchorPoint, animSel);
    }
    if (t.opacity) {
      payload.transform.opacity = cloneAnimNum(source.transform.opacity, animSel);
    }
  }

  if (t.perspective3D) {
    payload.is3D = source.is3D;
    payload.fixedIn3D = source.fixedIn3D;
    payload.billboard = source.billboard;
    if (source.mesh3dConfig) {
      payload.mesh3dConfig = JSON.parse(JSON.stringify(source.mesh3dConfig));
    }
  }

  // 2. Timing & Speed
  if (selection.animation.timing) {
    payload.timing = {
      startFrame: source.startFrame,
      durationFrames: source.durationFrames,
    };
  }
  if (selection.animation.speed && source.timeScale !== undefined) {
    payload.timeScale = source.timeScale;
  }

  // 3. Appearance
  const a = selection.appearance;
  if (a.fill || a.stroke || a.gradientAndColors || a.shadowsAndGlow || a.bordersAndCorner || a.typography) {
    payload.appearance = {};
    if (a.fill) {
      payload.appearance.fill = source.vectorConfig?.fill ?? source.textConfig?.fill ?? source.solidColor;
      payload.appearance.solidColor = source.solidColor;
    }
    if (a.stroke) {
      payload.appearance.stroke = source.vectorConfig?.stroke ?? source.textConfig?.stroke;
      payload.appearance.strokeWidth = source.vectorConfig?.strokeWidth ?? source.textConfig?.strokeWidth;
    }
    if (a.bordersAndCorner) {
      payload.appearance.cornerRadius = source.vectorConfig?.cornerRadius;
    }
    if (a.typography && source.textConfig) {
      payload.appearance.fontFamily = source.textConfig.fontFamily;
      payload.appearance.fontSize = source.textConfig.fontSize;
      payload.appearance.letterSpacing = source.textConfig.letterSpacing;
      payload.appearance.lineHeight = source.textConfig.lineHeight;
      payload.appearance.align = source.textConfig.align;
    }
    if ((a.gradientAndColors || a.shadowsAndGlow || a.bordersAndCorner) && source.appearanceExtras) {
      payload.appearance.appearanceExtras = JSON.parse(JSON.stringify(source.appearanceExtras));
    }
  }

  // 4. Effects
  const fx = selection.effects;
  if (fx.allEffects || fx.selectedEffectIds.length > 0) {
    const selectedSet = new Set(fx.selectedEffectIds);
    const chosen = fx.allEffects
      ? source.effects
      : source.effects.filter((e) => selectedSet.has(e.id));
    payload.effects = chosen.map((e) => ({
      ...e,
      id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      params: fx.effectParams ? { ...e.params } : {},
    }));
  }
  if (fx.blendMode) {
    payload.blendMode = source.blendMode;
  }

  // 5. Mask
  if (selection.mask.maskLayerAndMode && source.mask) {
    payload.mask = { ...source.mask };
  }

  return {
    id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sourceLayerId: source.id,
    sourceLayerName: source.name,
    sourceLayerType: source.type,
    copiedAt: Date.now(),
    selection: JSON.parse(JSON.stringify(selection)),
    payload,
  };
}

function mergeVec3Property(
  target: AnimatableProperty<Vector3D>,
  source: AnimatableProperty<Vector3D>,
  axes: { x: boolean; y: boolean; z: boolean },
  mode: PropertyTransferMode,
  includeKeyframes: boolean
): AnimatableProperty<Vector3D> {
  const nextVal: Vector3D = {
    x: axes.x ? source.value.x : target.value.x,
    y: axes.y ? source.value.y : target.value.y,
    z: axes.z ? source.value.z : target.value.z,
  };

  if (!includeKeyframes) {
    return { ...target, value: nextVal };
  }

  const mappedSourceKfs = source.keyframes.map((kf) => ({
    ...kf,
    id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    value: {
      x: axes.x ? kf.value.x : target.value.x,
      y: axes.y ? kf.value.y : target.value.y,
      z: axes.z ? kf.value.z : target.value.z,
    },
  }));

  if (mode === 'replace') {
    return { ...target, value: nextVal, keyframes: mappedSourceKfs, isAnimated: mappedSourceKfs.length > 0 };
  }

  // Merge: keep non-overlapping target keyframes, replace/add by frame
  const mergedMap = new Map<number, typeof mappedSourceKfs[number]>();
  for (const tkf of target.keyframes) mergedMap.set(tkf.frame, tkf);
  for (const skf of mappedSourceKfs) {
    const existing = mergedMap.get(skf.frame);
    if (existing) {
      mergedMap.set(skf.frame, {
        ...skf,
        value: {
          x: axes.x ? skf.value.x : existing.value.x,
          y: axes.y ? skf.value.y : existing.value.y,
          z: axes.z ? skf.value.z : existing.value.z,
        },
      });
    } else {
      mergedMap.set(skf.frame, skf);
    }
  }

  const sorted = Array.from(mergedMap.values()).sort((a, b) => a.frame - b.frame);
  return { ...target, value: nextVal, keyframes: sorted, isAnimated: sorted.length > 0 };
}

/**
 * Checks compatibility warnings/notes for target layer type without throwing or corrupting.
 */
export function getCompatibilityReport(
  targetType: LayerType,
  selection: PropertyTransferSelection
): { compatibleCount: number; skippedLabels: string[] } {
  const skippedLabels: string[] = [];
  let compatibleCount = 0;

  if (
    selection.transform.positionX ||
    selection.transform.positionY ||
    selection.transform.scaleX ||
    selection.transform.rotationZ ||
    selection.transform.opacity
  ) {
    compatibleCount++;
  }

  const supportsVisualAppearance = ['vector', 'text', 'solid', 'image', 'video', 'model3d', 'group'].includes(targetType);
  if (selection.appearance.fill || selection.appearance.stroke) {
    if (!supportsVisualAppearance) skippedLabels.push('Fill/Stroke');
    else compatibleCount++;
  }

  if (selection.appearance.typography) {
    if (targetType !== 'text') skippedLabels.push('Typography (Text-only)');
    else compatibleCount++;
  }

  const supportsEffectsAndMask = !['camera', 'null', 'audio'].includes(targetType);
  if (selection.effects.allEffects || selection.effects.selectedEffectIds.length > 0) {
    if (!supportsEffectsAndMask) skippedLabels.push('Visual Effects');
    else compatibleCount++;
  }
  if (selection.mask.maskLayerAndMode) {
    if (!supportsEffectsAndMask) skippedLabels.push('Mask');
    else compatibleCount++;
  }

  return { compatibleCount, skippedLabels };
}

/**
 * Safely applies a CopiedPropertiesBundle onto a target Layer respecting Replace vs Merge mode
 * and layer-type compatibility (Image, Video, Text, Vector, Audio, 3D, Camera, Group, Null).
 */
export function applyPropertiesToLayer(
  target: Layer,
  bundle: CopiedPropertiesBundle,
  mode: PropertyTransferMode = 'replace'
): Layer {
  const next: Layer = JSON.parse(JSON.stringify(target));
  const sel = bundle.selection;
  const p = bundle.payload;
  const includeKf = sel.animation.keyframes || sel.animation.motionPaths;

  // 1. Transform
  if (p.transform) {
    if (p.transform.position && (sel.transform.positionX || sel.transform.positionY || sel.transform.positionZ || sel.animation.motionPaths)) {
      next.transform.position = mergeVec3Property(
        next.transform.position,
        p.transform.position,
        {
          x: sel.transform.positionX || sel.animation.motionPaths,
          y: sel.transform.positionY || sel.animation.motionPaths,
          z: sel.transform.positionZ,
        },
        mode,
        includeKf
      );
    }

    if (p.transform.scale && (sel.transform.scaleX || sel.transform.scaleY || sel.transform.scaleZ)) {
      next.transform.scale = mergeVec3Property(
        next.transform.scale,
        p.transform.scale,
        {
          x: sel.transform.scaleX,
          y: sel.transform.scaleY,
          z: sel.transform.scaleZ,
        },
        mode,
        includeKf
      );
    }

    if (p.transform.rotation && (sel.transform.rotationX || sel.transform.rotationY || sel.transform.rotationZ)) {
      next.transform.rotation = mergeVec3Property(
        next.transform.rotation,
        p.transform.rotation,
        {
          x: sel.transform.rotationX,
          y: sel.transform.rotationY,
          z: sel.transform.rotationZ,
        },
        mode,
        includeKf
      );
    }

    if (p.transform.anchorPoint && sel.transform.anchorPoint) {
      next.transform.anchorPoint = mergeVec3Property(
        next.transform.anchorPoint,
        p.transform.anchorPoint,
        { x: true, y: true, z: true },
        mode,
        includeKf
      );
    }

    if (p.transform.opacity && sel.transform.opacity) {
      if (!includeKf) {
        next.transform.opacity = { ...next.transform.opacity, value: p.transform.opacity.value };
      } else if (mode === 'replace') {
        next.transform.opacity = JSON.parse(JSON.stringify(p.transform.opacity));
      } else {
        const merged = new Map<number, typeof next.transform.opacity.keyframes[number]>();
        for (const k of next.transform.opacity.keyframes) merged.set(k.frame, k);
        for (const k of p.transform.opacity.keyframes) {
          merged.set(k.frame, { ...k, id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
        }
        next.transform.opacity = {
          value: p.transform.opacity.value,
          keyframes: Array.from(merged.values()).sort((a, b) => a.frame - b.frame),
          isAnimated: merged.size > 0,
        };
      }
    }
  }

  // 2. 3D / Perspective
  if (sel.transform.perspective3D && next.type !== 'audio') {
    if (p.is3D !== undefined) next.is3D = p.is3D;
    if (p.fixedIn3D !== undefined) next.fixedIn3D = p.fixedIn3D;
    if (p.billboard !== undefined) next.billboard = p.billboard;
    if (p.mesh3dConfig && ['vector', 'text', 'image', 'video', 'solid'].includes(next.type)) {
      next.mesh3dConfig =
        mode === 'merge' && next.mesh3dConfig
          ? ({ ...next.mesh3dConfig, ...p.mesh3dConfig } as Layer['mesh3dConfig'])
          : (JSON.parse(JSON.stringify(p.mesh3dConfig)) as Layer['mesh3dConfig']);
    }
  }

  // 3. Timing & Speed
  if (p.timing && sel.animation.timing) {
    next.startFrame = p.timing.startFrame;
    next.durationFrames = p.timing.durationFrames;
  }
  if (p.timeScale !== undefined && sel.animation.speed) {
    next.timeScale = p.timeScale;
  }

  // 4. Appearance (safely mapped per layer type)
  if (p.appearance) {
    const app = p.appearance;
    if (next.type === 'vector' && next.vectorConfig) {
      if (sel.appearance.fill && app.fill) next.vectorConfig.fill = app.fill;
      if (sel.appearance.stroke && app.stroke) next.vectorConfig.stroke = app.stroke;
      if (sel.appearance.stroke && app.strokeWidth !== undefined) next.vectorConfig.strokeWidth = app.strokeWidth;
      if (sel.appearance.bordersAndCorner && app.cornerRadius !== undefined) {
        next.vectorConfig.cornerRadius = app.cornerRadius;
      }
    } else if (next.type === 'text' && next.textConfig) {
      if (sel.appearance.fill && app.fill) next.textConfig.fill = app.fill;
      if (sel.appearance.stroke && app.stroke) next.textConfig.stroke = app.stroke;
      if (sel.appearance.stroke && app.strokeWidth !== undefined) next.textConfig.strokeWidth = app.strokeWidth;
      if (sel.appearance.typography) {
        if (app.fontFamily) next.textConfig.fontFamily = app.fontFamily;
        if (app.fontSize !== undefined) next.textConfig.fontSize = app.fontSize;
        if (app.letterSpacing !== undefined) next.textConfig.letterSpacing = app.letterSpacing;
        if (app.lineHeight !== undefined) next.textConfig.lineHeight = app.lineHeight;
        if (app.align) next.textConfig.align = app.align;
      }
    } else if (next.type === 'solid' && sel.appearance.fill && (app.solidColor || app.fill)) {
      next.solidColor = app.solidColor || app.fill;
    } else if (next.type === 'model3d' && next.model3dConfig && sel.appearance.fill && app.fill) {
      next.model3dConfig.color = app.fill;
    }

    if (app.appearanceExtras && !['audio', 'camera', 'null'].includes(next.type)) {
      next.appearanceExtras =
        mode === 'merge' && next.appearanceExtras
          ? { ...next.appearanceExtras, ...app.appearanceExtras }
          : JSON.parse(JSON.stringify(app.appearanceExtras));
    }
  }

  // 5. Effects & Blend Mode
  const supportsEffects = !['camera', 'null', 'audio'].includes(next.type);
  if (supportsEffects) {
    if (p.effects) {
      const clonedEffects: ShaderEffect[] = p.effects.map((fx) => ({
        ...fx,
        id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        params: { ...fx.params },
      }));

      if (mode === 'replace') {
        next.effects = clonedEffects;
      } else {
        // Merge: update matching effect types, append new ones
        const merged = [...next.effects];
        for (const incoming of clonedEffects) {
          const idx = merged.findIndex((e) => e.type === incoming.type);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], enabled: incoming.enabled, params: { ...merged[idx].params, ...incoming.params } };
          } else {
            merged.push(incoming);
          }
        }
        next.effects = merged;
      }
    }
    if (p.blendMode && sel.effects.blendMode) {
      next.blendMode = p.blendMode;
    }
  }

  // 6. Mask
  if (p.mask && sel.mask.maskLayerAndMode && supportsEffects && p.mask.maskLayerId !== next.id) {
    next.mask = { ...p.mask };
  }

  return next;
}

// ============================================================================
// PROPERTY PRESETS LIBRARY (CRUD, Folders, Export/Import JSON)
// ============================================================================

export function loadPropertyPresets(): PropertyPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePropertyPresets(presets: PropertyPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore quota overflow
  }
}

export function addPropertyPreset(
  name: string,
  folder: string,
  bundle: CopiedPropertiesBundle,
  nameAr?: string
): PropertyPreset[] {
  const existing = loadPropertyPresets();
  const preset: PropertyPreset = {
    id: `ppreset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Custom Preset',
    nameAr: nameAr?.trim(),
    folder: folder.trim() || 'General',
    createdAt: Date.now(),
    bundle: JSON.parse(JSON.stringify(bundle)),
  };
  const next = [preset, ...existing];
  savePropertyPresets(next);
  return next;
}

export function deletePropertyPreset(id: string): PropertyPreset[] {
  const next = loadPropertyPresets().filter((p) => p.id !== id);
  savePropertyPresets(next);
  return next;
}

export function exportPropertyPresetsJSON(presets: PropertyPreset[]): string {
  return JSON.stringify({ format: 'sqmotion_property_presets_v1', exportedAt: Date.now(), presets }, null, 2);
}

export function importPropertyPresetsJSON(jsonText: string): { presets: PropertyPreset[]; addedCount: number } {
  const parsed = JSON.parse(jsonText) as { presets?: PropertyPreset[] } | PropertyPreset[];
  const incoming = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.presets) ? parsed.presets : [];
  const existing = loadPropertyPresets();
  const existingIds = new Set(existing.map((p) => p.id));
  const valid = incoming.filter((p) => p && p.id && p.bundle && !existingIds.has(p.id));
  const next = [...valid, ...existing];
  savePropertyPresets(next);
  return { presets: next, addedCount: valid.length };
}
