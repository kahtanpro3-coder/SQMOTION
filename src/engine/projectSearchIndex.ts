import { MOTION_PRESETS } from './presets';
import type {
  Layer,
  Project,
  ProjectSearchFilters,
  ProjectSearchResult,
  SearchEntityType,
} from '../types';

export interface SearchIndexDocument {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string;
  normalizedHaystack: string;
  tokens: string[];
  layerId?: string;
  layerName?: string;
  layerType?: Layer['type'];
  groupId?: string;
  effectId?: string;
  frame?: number;
  durationFrames?: number;
  isHidden?: boolean;
  isLocked?: boolean;
  isMissingAsset?: boolean;
}

/**
 * Normalizes Arabic & English text for smart search:
 * - removes Arabic diacritics (tashkeel)
 * - normalizes أ إ آ -> ا, ة -> ه, ى -> ي
 * - lowercases Latin text
 */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lightweight bounded Levenshtein distance for typo tolerance (edit distance <= 2).
 */
function boundedEditDistance(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function isLayerAssetMissing(layer: Layer): boolean {
  if ((layer.type === 'image' || layer.type === 'video') && (!layer.mediaUrl || layer.mediaUrl.trim() === '')) {
    return true;
  }
  if (layer.type === 'audio' && (!layer.audioConfig?.src || layer.audioConfig.src.trim() === '')) {
    return true;
  }
  if (
    layer.type === 'model3d' &&
    layer.model3dConfig?.format !== 'builtin' &&
    !layer.model3dConfig?.builtinPreset &&
    (!layer.model3dConfig?.modelUrl || layer.model3dConfig.modelUrl.trim() === '')
  ) {
    return true;
  }
  return false;
}

export class ProjectSearchIndex {
  private docs: SearchIndexDocument[] = [];
  private signature = '';

  public rebuildIfNeeded(project: Project): void {
    const nextSig = `${project.id}:${project.layers.length}:${project.layers
      .map((l) => `${l.id}:${l.name}:${l.visible}:${l.locked}:${l.effects.length}:${l.startFrame}:${l.durationFrames}:${l.groupId || ''}:${l.textConfig?.text || ''}`)
      .join('|')}`;
    if (nextSig === this.signature) return;
    this.signature = nextSig;
    this.build(project);
  }

  public build(project: Project): void {
    const docs: SearchIndexDocument[] = [];

    const addDoc = (doc: Omit<SearchIndexDocument, 'normalizedHaystack' | 'tokens'>, extraSearchText = '') => {
      const combined = normalizeSearchText(`${doc.title} ${doc.subtitle} ${extraSearchText}`);
      docs.push({
        ...doc,
        normalizedHaystack: combined,
        tokens: combined.split(' ').filter(Boolean),
      });
    };

    for (const layer of project.layers) {
      const missing = isLayerAssetMissing(layer);
      const isGroup = layer.type === 'group';

      addDoc(
        {
          id: `sr_layer_${layer.id}`,
          entityType: missing ? 'missing' : isGroup ? 'group' : 'layer',
          title: layer.name,
          subtitle: `${layer.type.toUpperCase()} · F${layer.startFrame}–${layer.startFrame + layer.durationFrames} (${layer.durationFrames}f)${missing ? ' · Missing Media' : ''}`,
          layerId: layer.id,
          layerName: layer.name,
          layerType: layer.type,
          groupId: layer.groupId,
          frame: layer.startFrame,
          durationFrames: layer.durationFrames,
          isHidden: !layer.visible,
          isLocked: layer.locked,
          isMissingAsset: missing,
        },
        `${layer.type} ${layer.blendMode} ${layer.textConfig?.text || ''} ${layer.textConfig?.fontFamily || ''}`
      );

      // Text content & Font entries
      if (layer.type === 'text' && layer.textConfig) {
        if (layer.textConfig.text) {
          addDoc({
            id: `sr_text_${layer.id}`,
            entityType: 'text',
            title: layer.textConfig.text.slice(0, 64),
            subtitle: `Text in "${layer.name}" · Font: ${layer.textConfig.fontFamily}`,
            layerId: layer.id,
            layerName: layer.name,
            layerType: layer.type,
            groupId: layer.groupId,
            frame: layer.startFrame,
            durationFrames: layer.durationFrames,
            isHidden: !layer.visible,
            isLocked: layer.locked,
          });
        }
        addDoc({
          id: `sr_font_${layer.id}`,
          entityType: 'font',
          title: layer.textConfig.fontFamily,
          subtitle: `Font used by "${layer.name}" (${layer.textConfig.fontSize}px)`,
          layerId: layer.id,
          layerName: layer.name,
          layerType: layer.type,
          groupId: layer.groupId,
          frame: layer.startFrame,
          durationFrames: layer.durationFrames,
          isHidden: !layer.visible,
          isLocked: layer.locked,
        });
      }

      // Media / Audio assets
      if (layer.type === 'image' || layer.type === 'video' || layer.type === 'model3d') {
        const assetLabel = layer.model3dConfig?.fileName || (layer.mediaUrl ? layer.mediaUrl.slice(0, 48) : 'Empty asset');
        addDoc({
          id: `sr_media_${layer.id}`,
          entityType: missing ? 'missing' : 'media',
          title: `${layer.name} (${layer.type})`,
          subtitle: missing ? 'Missing or unlinked media file' : assetLabel,
          layerId: layer.id,
          layerName: layer.name,
          layerType: layer.type,
          groupId: layer.groupId,
          frame: layer.startFrame,
          durationFrames: layer.durationFrames,
          isHidden: !layer.visible,
          isLocked: layer.locked,
          isMissingAsset: missing,
        });
      }

      if (layer.type === 'audio') {
        addDoc({
          id: `sr_audio_${layer.id}`,
          entityType: missing ? 'missing' : 'audio',
          title: layer.name,
          subtitle: `Audio Track · Vol ${Math.round((layer.audioConfig?.volume ?? 1) * 100)}%${layer.audioConfig?.muted ? ' · Muted' : ''}`,
          layerId: layer.id,
          layerName: layer.name,
          layerType: layer.type,
          groupId: layer.groupId,
          frame: layer.startFrame,
          durationFrames: layer.durationFrames,
          isHidden: !layer.visible,
          isLocked: layer.locked,
          isMissingAsset: missing,
        });
      }

      // Masks
      if (layer.mask?.maskLayerId) {
        addDoc({
          id: `sr_mask_${layer.id}`,
          entityType: 'mask',
          title: `Mask (${layer.mask.mode}) on "${layer.name}"`,
          subtitle: `Target mask layer: ${layer.mask.maskLayerId}`,
          layerId: layer.id,
          layerName: layer.name,
          layerType: layer.type,
          groupId: layer.groupId,
          frame: layer.startFrame,
          durationFrames: layer.durationFrames,
          isHidden: !layer.visible,
          isLocked: layer.locked,
        });
      }

      // Effects
      for (const fx of layer.effects) {
        addDoc(
          {
            id: `sr_fx_${layer.id}_${fx.id}`,
            entityType: 'effect',
            title: fx.name || fx.type,
            subtitle: `Effect on "${layer.name}" · ${fx.enabled ? 'Enabled' : 'Bypassed'}`,
            layerId: layer.id,
            layerName: layer.name,
            layerType: layer.type,
            groupId: layer.groupId,
            effectId: fx.id,
            frame: layer.startFrame,
            durationFrames: layer.durationFrames,
            isHidden: !layer.visible,
            isLocked: layer.locked,
          },
          `${fx.type} ${Object.keys(fx.params || {}).join(' ')}`
        );
      }

      // Keyframes
      const props: Array<[string, ReadonlyArray<{ id: string; frame: number; easing: string }>]> = [
        ['Position', layer.transform.position.keyframes],
        ['Scale', layer.transform.scale.keyframes],
        ['Rotation', layer.transform.rotation.keyframes],
        ['Opacity', layer.transform.opacity.keyframes],
        ['Anchor', layer.transform.anchorPoint.keyframes],
      ];
      for (const [propLabel, kfs] of props) {
        for (const kf of kfs) {
          addDoc({
            id: `sr_kf_${layer.id}_${kf.id}`,
            entityType: 'keyframe',
            title: `${propLabel} Keyframe @ F${kf.frame}`,
            subtitle: `"${layer.name}" · Easing: ${kf.easing}`,
            layerId: layer.id,
            layerName: layer.name,
            layerType: layer.type,
            groupId: layer.groupId,
            frame: kf.frame,
            durationFrames: layer.durationFrames,
            isHidden: !layer.visible,
            isLocked: layer.locked,
          });
        }
      }
    }

    // Motion Presets in catalog
    for (const preset of MOTION_PRESETS) {
      addDoc(
        {
          id: `sr_preset_${preset.id}`,
          entityType: 'preset',
          title: preset.name,
          subtitle: `${preset.nameAr} · Preset (${preset.category})`,
        },
        `${preset.nameAr} ${preset.description} ${preset.category}`
      );
    }

    this.docs = docs;
  }

  public getSuggestions(project: Project): string[] {
    const set = new Set<string>();
    for (const l of project.layers.slice(0, 6)) set.add(l.name);
    for (const l of project.layers) {
      for (const fx of l.effects) {
        set.add(fx.name || fx.type);
        if (set.size >= 10) break;
      }
      if (set.size >= 10) break;
    }
    return Array.from(set).slice(0, 8);
  }

  public search(
    project: Project,
    query: string,
    filters: ProjectSearchFilters
  ): ProjectSearchResult[] {
    this.rebuildIfNeeded(project);

    const normQuery = normalizeSearchText(query);
    const queryTokens = normQuery ? normQuery.split(' ').filter(Boolean) : [];
    const results: ProjectSearchResult[] = [];

    for (const doc of this.docs) {
      // Faceted filters
      if (filters.entityTypes.length > 0 && !filters.entityTypes.includes(doc.entityType)) continue;
      if (filters.layerTypes.length > 0 && (!doc.layerType || !filters.layerTypes.includes(doc.layerType))) continue;
      if (filters.groupId && doc.groupId !== filters.groupId && doc.layerId !== filters.groupId) continue;
      if (filters.visibility === 'visible' && doc.isHidden) continue;
      if (filters.visibility === 'hidden' && !doc.isHidden) continue;
      if (filters.lockState === 'locked' && !doc.isLocked) continue;
      if (filters.lockState === 'unlocked' && doc.isLocked) continue;
      if (filters.onlyMissing && !doc.isMissingAsset) continue;
      if (
        filters.minDurationFrames !== undefined &&
        (doc.durationFrames === undefined || doc.durationFrames < filters.minDurationFrames)
      ) {
        continue;
      }
      if (
        filters.maxDurationFrames !== undefined &&
        (doc.durationFrames === undefined || doc.durationFrames > filters.maxDurationFrames)
      ) {
        continue;
      }
      if (filters.frameRangeStart !== undefined || filters.frameRangeEnd !== undefined) {
        const startF = filters.frameRangeStart ?? 0;
        const endF = filters.frameRangeEnd ?? Infinity;
        if (doc.frame === undefined) continue;
        const docEnd = doc.entityType === 'keyframe' ? doc.frame : doc.frame + (doc.durationFrames ?? 0);
        if (docEnd < startF || doc.frame > endF) continue;
      }

      if (filters.effectName) {
        const fxNorm = normalizeSearchText(filters.effectName);
        if (!doc.normalizedHaystack.includes(fxNorm)) continue;
      }

      // Query scoring (exact / prefix / substring / fuzzy typo tolerance)
      let score = 0;
      const matchedTokens: string[] = [];

      if (queryTokens.length === 0) {
        score = 10;
      } else {
        const normTitle = normalizeSearchText(doc.title);
        if (normTitle === normQuery) score += 120;
        else if (normTitle.startsWith(normQuery)) score += 85;
        else if (normTitle.includes(normQuery)) score += 60;

        let allTokensMatched = true;
        for (const qt of queryTokens) {
          if (doc.normalizedHaystack.includes(qt)) {
            score += 30;
            matchedTokens.push(qt);
          } else {
            // Fuzzy typo tolerance
            let bestDist = 99;
            for (const dt of doc.tokens) {
              if (qt.length >= 3) {
                const dist = boundedEditDistance(qt, dt.slice(0, qt.length + 2), 2);
                if (dist < bestDist) bestDist = dist;
              }
            }
            if (bestDist <= 1) {
              score += 18;
              matchedTokens.push(qt);
            } else if (bestDist <= 2 && qt.length >= 5) {
              score += 10;
              matchedTokens.push(qt);
            } else {
              allTokensMatched = false;
            }
          }
        }
        if (!allTokensMatched && score < 25) continue;
      }

      if (doc.isMissingAsset) score += 5;

      results.push({
        id: doc.id,
        entityType: doc.entityType,
        title: doc.title,
        subtitle: doc.subtitle,
        layerId: doc.layerId,
        layerName: doc.layerName,
        layerType: doc.layerType,
        groupId: doc.groupId,
        effectId: doc.effectId,
        frame: doc.frame,
        durationFrames: doc.durationFrames,
        isHidden: doc.isHidden,
        isLocked: doc.isLocked,
        isMissingAsset: doc.isMissingAsset,
        score,
        matchedTokens,
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 120);
  }
}
