import type { GroupConfig, Layer, LayerTransform } from '../types';

export interface TimelineVisibleRow {
  layer: Layer;
  depth: number;
  originalIndex: number;
  isGroup: boolean;
  childCount: number;
  ancestorGroupIds: string[];
}

const GROUP_PALETTE = [
  '#FF4D6D',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
];

export function defaultTransform(cx = 540, cy = 960): LayerTransform {
  return {
    position: { value: { x: cx, y: cy, z: 0 }, keyframes: [] },
    scale: { value: { x: 1, y: 1, z: 1 }, keyframes: [] },
    rotation: { value: { x: 0, y: 0, z: 0 }, keyframes: [] },
    opacity: { value: 100, keyframes: [] },
    anchorPoint: { value: { x: 0, y: 0, z: 0 }, keyframes: [] },
  };
}

/**
 * Returns ordered list of ancestor group IDs (from immediate group up to outermost root group),
 * safely avoiding infinite cycles.
 */
export function getAncestorGroupIds(layer: Layer, layerMap: Map<string, Layer>): string[] {
  const result: string[] = [];
  const visited = new Set<string>([layer.id]);
  let curGroupId = layer.groupId;

  while (curGroupId && !visited.has(curGroupId)) {
    visited.add(curGroupId);
    const grp = layerMap.get(curGroupId);
    if (!grp) break;
    result.push(grp.id);
    curGroupId = grp.groupId;
  }

  return result;
}

/**
 * Returns unified transform ancestor chain combining `parentId` rigging AND `groupId` nesting.
 * Immediate parentId chain is walked first, then any enclosing group chain not already visited.
 */
export function getEffectiveAncestorChain(layer: Layer, layerMap: Map<string, Layer>): Layer[] {
  const chain: Layer[] = [];
  const visited = new Set<string>([layer.id]);

  // 1. Walk explicit parentId / groupId chain cleanly
  let current: Layer | undefined = layer;
  while (current) {
    const nextId: string | undefined =
      current.parentId && !visited.has(current.parentId)
        ? current.parentId
        : current.groupId && !visited.has(current.groupId)
          ? current.groupId
          : undefined;

    if (!nextId) break;
    visited.add(nextId);
    const parentLayer = layerMap.get(nextId);
    if (!parentLayer) break;
    chain.push(parentLayer);
    current = parentLayer;
  }

  // 2. If layer had a groupId whose enclosing group wasn't reached via parentId chain, append it
  if (layer.groupId && !visited.has(layer.groupId)) {
    let curGroupId: string | undefined = layer.groupId;
    while (curGroupId && !visited.has(curGroupId)) {
      visited.add(curGroupId);
      const grp = layerMap.get(curGroupId);
      if (!grp) break;
      chain.push(grp);
      curGroupId = grp.groupId;
    }
  }

  return chain;
}

/**
 * Returns all direct + nested descendant layer IDs of a group.
 */
export function getDescendantLayerIds(groupId: string, layers: Layer[]): string[] {
  const descendants: string[] = [];
  const queue = [groupId];
  const visited = new Set<string>([groupId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const l of layers) {
      if (l.groupId === currentId && !visited.has(l.id)) {
        visited.add(l.id);
        descendants.push(l.id);
        if (l.type === 'group') {
          queue.push(l.id);
        }
      }
    }
  }

  return descendants;
}

/**
 * Direct children count of a group.
 */
export function getDirectChildCount(groupId: string, layers: Layer[]): number {
  let count = 0;
  for (const l of layers) {
    if (l.groupId === groupId) count++;
  }
  return count;
}

/**
 * Effective visibility considering layer + all ancestor groups & timing bounds.
 */
export function isEffectivelyVisible(
  layer: Layer,
  layerMap: Map<string, Layer>,
  currentFrame?: number
): boolean {
  if (!layer.visible) return false;
  if (
    currentFrame !== undefined &&
    (currentFrame < layer.startFrame || currentFrame >= layer.startFrame + layer.durationFrames)
  ) {
    return false;
  }

  const groupIds = getAncestorGroupIds(layer, layerMap);
  for (const gid of groupIds) {
    const grp = layerMap.get(gid);
    if (!grp) continue;
    if (!grp.visible) return false;
    if (
      currentFrame !== undefined &&
      (currentFrame < grp.startFrame || currentFrame >= grp.startFrame + grp.durationFrames)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Effective lock considering layer + all ancestor groups.
 */
export function isEffectivelyLocked(layer: Layer, layerMap: Map<string, Layer>): boolean {
  if (layer.locked) return true;
  const groupIds = getAncestorGroupIds(layer, layerMap);
  for (const gid of groupIds) {
    const grp = layerMap.get(gid);
    if (grp?.locked) return true;
  }
  return false;
}

/**
 * Builds the flat ordered list of rows to display in Timeline, respecting collapsed groups
 * and placing children cleanly indented under their parent group while preserving layer ordering.
 */
export function buildVisibleTimelineRows(layers: Layer[]): TimelineVisibleRow[] {
  const layerMap = new Map<string, Layer>();
  for (const l of layers) layerMap.set(l.id, l);

  const originalIndexMap = new Map<string, number>();
  layers.forEach((l, idx) => originalIndexMap.set(l.id, idx));

  const isHiddenByCollapsedAncestor = (layer: Layer): boolean => {
    const ancestors = getAncestorGroupIds(layer, layerMap);
    for (const gid of ancestors) {
      const grp = layerMap.get(gid);
      if (grp?.groupConfig?.collapsed) return true;
    }
    return false;
  };

  // Group children map preserving relative array order
  const childrenByGroup = new Map<string, Layer[]>();
  const topLevel: Layer[] = [];

  for (const l of layers) {
    if (l.groupId && layerMap.has(l.groupId)) {
      const list = childrenByGroup.get(l.groupId) || [];
      list.push(l);
      childrenByGroup.set(l.groupId, list);
    } else {
      topLevel.push(l);
    }
  }

  const rows: TimelineVisibleRow[] = [];
  const emitted = new Set<string>();

  const visit = (layer: Layer, depth: number, ancestorIds: string[]) => {
    if (emitted.has(layer.id)) return;
    emitted.add(layer.id);

    const isGroup = layer.type === 'group';
    const directChildren = childrenByGroup.get(layer.id) || [];

    if (!isHiddenByCollapsedAncestor(layer)) {
      rows.push({
        layer,
        depth,
        originalIndex: originalIndexMap.get(layer.id) ?? 0,
        isGroup,
        childCount: directChildren.length,
        ancestorGroupIds: ancestorIds,
      });
    }

    if (isGroup && !layer.groupConfig?.collapsed) {
      for (const child of directChildren) {
        visit(child, depth + 1, [...ancestorIds, layer.id]);
      }
    }
  };

  for (const item of topLevel) {
    visit(item, 0, []);
  }

  return rows;
}

/**
 * Creates a new group layer from a set of target layer IDs and updates children's groupId
 * + converts child world coordinates cleanly relative to the group's center pivot.
 */
export function createGroupFromLayers(
  layers: Layer[],
  targetLayerIds: string[],
  options: {
    name: string;
    canvasWidth: number;
    canvasHeight: number;
    color?: string;
    icon?: GroupConfig['icon'];
  }
): { layers: Layer[]; groupLayer: Layer } {
  const idSet = new Set(targetLayerIds);
  const selected = layers.filter((l) => idSet.has(l.id));

  if (selected.length === 0) {
    const emptyGroup = buildEmptyGroupLayer({
      name: options.name,
      cx: options.canvasWidth / 2,
      cy: options.canvasHeight / 2,
      durationFrames: 180,
      color: options.color,
      icon: options.icon,
    });
    return { layers: [emptyGroup, ...layers], groupLayer: emptyGroup };
  }

  // Compute bounding timing & average center
  let minStart = Infinity;
  let maxEnd = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  // Common parent group if all selected share the exact same groupId
  const commonParentGroupId = selected.every((l) => l.groupId && l.groupId === selected[0].groupId)
    ? selected[0].groupId
    : undefined;

  for (const l of selected) {
    minStart = Math.min(minStart, l.startFrame);
    maxEnd = Math.max(maxEnd, l.startFrame + l.durationFrames);
    if (l.transform?.position?.value) {
      sumX += l.transform.position.value.x;
      sumY += l.transform.position.value.y;
      count++;
    }
  }

  const centerX = count > 0 ? Math.round((sumX / count) * 10) / 10 : options.canvasWidth / 2;
  const centerY = count > 0 ? Math.round((sumY / count) * 10) / 10 : options.canvasHeight / 2;
  const groupStart = Number.isFinite(minStart) ? minStart : 0;
  const groupDuration = Number.isFinite(maxEnd) ? Math.max(10, maxEnd - groupStart) : 180;

  const groupLayer = buildEmptyGroupLayer({
    name: options.name,
    cx: centerX,
    cy: centerY,
    startFrame: groupStart,
    durationFrames: groupDuration,
    color: options.color,
    icon: options.icon,
    parentGroupId: commonParentGroupId,
  });

  // Shift selected direct layers into group-local coordinates
  const updatedLayers = layers.map((l) => {
    if (!idSet.has(l.id)) return l;
    // If another selected layer is already this layer's ancestor group, preserve hierarchy inside
    if (l.groupId && idSet.has(l.groupId)) {
      return l;
    }

    const prevPos = l.transform.position.value;
    const shiftedKfs = l.transform.position.keyframes.map((kf) => ({
      ...kf,
      value: {
        ...kf.value,
        x: kf.value.x - centerX,
        y: kf.value.y - centerY,
      },
    }));

    return {
      ...l,
      groupId: groupLayer.id,
      transform: {
        ...l.transform,
        position: {
          ...l.transform.position,
          value: {
            ...prevPos,
            x: prevPos.x - centerX,
            y: prevPos.y - centerY,
          },
          keyframes: shiftedKfs,
        },
      },
    };
  });

  // Insert group right before its earliest member in the layers array
  const firstMemberIndex = updatedLayers.findIndex((l) => idSet.has(l.id));
  const result = [...updatedLayers];
  result.splice(firstMemberIndex >= 0 ? firstMemberIndex : 0, 0, groupLayer);

  return { layers: result, groupLayer };
}

export function buildEmptyGroupLayer(opts: {
  name: string;
  cx: number;
  cy: number;
  startFrame?: number;
  durationFrames?: number;
  color?: string;
  icon?: GroupConfig['icon'];
  parentGroupId?: string;
}): Layer {
  const color = opts.color || GROUP_PALETTE[Math.floor(Math.random() * GROUP_PALETTE.length)];
  return {
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: opts.name,
    type: 'group',
    visible: true,
    locked: false,
    color,
    startFrame: opts.startFrame ?? 0,
    durationFrames: opts.durationFrames ?? 180,
    groupId: opts.parentGroupId,
    blendMode: 'normal',
    transform: defaultTransform(opts.cx, opts.cy),
    effects: [],
    groupConfig: {
      collapsed: false,
      icon: opts.icon || 'folder',
      color,
      composite: false,
      clipToBounds: false,
    },
  };
}

/**
 * Ungroups a group: promotes direct children up to the group's parentGroupId,
 * restores child position coordinates by adding the group's static offset, and removes the group.
 */
export function ungroupLayer(layers: Layer[], groupId: string): Layer[] {
  const group = layers.find((l) => l.id === groupId && l.type === 'group');
  if (!group) return layers;

  const gx = group.transform.position.value.x;
  const gy = group.transform.position.value.y;

  return layers
    .filter((l) => l.id !== groupId)
    .map((l) => {
      if (l.groupId !== groupId) return l;
      const nextPos = l.transform.position.value;
      const nextKfs = l.transform.position.keyframes.map((kf) => ({
        ...kf,
        value: {
          ...kf.value,
          x: kf.value.x + gx,
          y: kf.value.y + gy,
        },
      }));
      return {
        ...l,
        groupId: group.groupId,
        transform: {
          ...l.transform,
          position: {
            ...l.transform.position,
            value: {
              ...nextPos,
              x: nextPos.x + gx,
              y: nextPos.y + gy,
            },
            keyframes: nextKfs,
          },
        },
      };
    });
}

/**
 * Deep duplicates a group and all its descendants, remapping internal groupId / parentId / maskLayerId.
 */
export function duplicateGroupDeep(
  layers: Layer[],
  groupId: string,
  suffix = ' Copy'
): { layers: Layer[]; newGroupId: string | null } {
  const group = layers.find((l) => l.id === groupId && l.type === 'group');
  if (!group) return { layers, newGroupId: null };

  const descendantIds = getDescendantLayerIds(groupId, layers);
  const allIds = [groupId, ...descendantIds];
  const idMap = new Map<string, string>();
  const stamp = Date.now();

  allIds.forEach((oldId, i) => {
    idMap.set(oldId, `${oldId.startsWith('grp_') ? 'grp' : 'layer'}_${stamp}_${i}_${Math.random().toString(36).slice(2, 5)}`);
  });

  const clones: Layer[] = [];
  for (const oldId of allIds) {
    const src = layers.find((l) => l.id === oldId);
    if (!src) continue;
    const cloned: Layer = JSON.parse(JSON.stringify(src));
    cloned.id = idMap.get(oldId)!;
    if (oldId === groupId) {
      cloned.name = `${src.name}${suffix}`;
      // Slight offset for duplicated root group so user immediately sees it
      cloned.transform.position.value.x += 24;
      cloned.transform.position.value.y += 24;
    } else if (cloned.groupId && idMap.has(cloned.groupId)) {
      cloned.groupId = idMap.get(cloned.groupId);
    }
    if (cloned.parentId && idMap.has(cloned.parentId)) {
      cloned.parentId = idMap.get(cloned.parentId);
    }
    if (cloned.mask?.maskLayerId && idMap.has(cloned.mask.maskLayerId)) {
      cloned.mask.maskLayerId = idMap.get(cloned.mask.maskLayerId)!;
    }
    clones.push(cloned);
  }

  const insertIndex = layers.findIndex((l) => l.id === groupId);
  const nextLayers = [...layers];
  nextLayers.splice(insertIndex >= 0 ? insertIndex : 0, 0, ...clones);

  return { layers: nextLayers, newGroupId: idMap.get(groupId) || null };
}

/**
 * Deletes a group: either deletes all descendants (`deleteChildren = true`) or ungroups first.
 */
export function deleteGroup(layers: Layer[], groupId: string, deleteChildren: boolean): Layer[] {
  if (!deleteChildren) {
    return ungroupLayer(layers, groupId);
  }
  const removeIds = new Set<string>([groupId, ...getDescendantLayerIds(groupId, layers)]);
  return layers.filter((l) => !removeIds.has(l.id));
}

/**
 * Moves a layer into a target group (or removes from group if targetGroupId is undefined),
 * preventing circular group parenting.
 */
export function moveLayerToGroup(
  layers: Layer[],
  layerId: string,
  targetGroupId?: string
): Layer[] {
  if (layerId === targetGroupId) return layers;
  if (targetGroupId) {
    const descendants = getDescendantLayerIds(layerId, layers);
    if (descendants.includes(targetGroupId)) {
      // Prevent cycle
      return layers;
    }
  }
  return layers.map((l) => (l.id === layerId ? { ...l, groupId: targetGroupId } : l));
}

/**
 * Shifts a group's startFrame by deltaFrames AND shifts all descendants' startFrame + keyframes cleanly.
 */
export function shiftGroupTiming(
  layers: Layer[],
  groupId: string,
  newStartFrame: number,
  maxProjectFrames: number
): Layer[] {
  const group = layers.find((l) => l.id === groupId);
  if (!group) return layers;

  const clampedStart = Math.max(0, Math.min(maxProjectFrames - group.durationFrames, Math.round(newStartFrame)));
  const delta = clampedStart - group.startFrame;
  if (delta === 0) return layers;

  const affectedIds = new Set<string>([groupId, ...getDescendantLayerIds(groupId, layers)]);

  const shiftKeyframes = <T extends { frame: number }>(kfs: T[]): T[] =>
    kfs.map((kf) => ({ ...kf, frame: Math.max(0, kf.frame + delta) }));

  return layers.map((l) => {
    if (!affectedIds.has(l.id)) return l;
    const nextStart = Math.max(0, l.startFrame + delta);
    return {
      ...l,
      startFrame: nextStart,
      transform: {
        ...l.transform,
        position: { ...l.transform.position, keyframes: shiftKeyframes(l.transform.position.keyframes) },
        scale: { ...l.transform.scale, keyframes: shiftKeyframes(l.transform.scale.keyframes) },
        rotation: { ...l.transform.rotation, keyframes: shiftKeyframes(l.transform.rotation.keyframes) },
        opacity: { ...l.transform.opacity, keyframes: shiftKeyframes(l.transform.opacity.keyframes) },
        anchorPoint: { ...l.transform.anchorPoint, keyframes: shiftKeyframes(l.transform.anchorPoint.keyframes) },
      },
    };
  });
}
