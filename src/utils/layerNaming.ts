import { Layer, Language } from '../types';

/**
 * Returns the sequential name for a new layer according to user rules:
 * - null: 1st is "null", 2nd is "null 1", 3rd is "null 2", etc.
 * - text: 1st is "نص" (or "Text"), 2nd is "نص 1", 3rd is "نص 2", etc.
 * - camera: 1st is "كاميرا" (or "Camera"), 2nd is "كاميرا 1", etc.
 * - vector/shapes: 1st is "شكل" (or "Shape"), 2nd is "شكل 1", etc.
 */
export function getNextLayerName(
  type: Layer['type'],
  existingLayers: Layer[],
  customName?: string,
  lang: Language = 'ar'
): string {
  if (customName && customName.trim().length > 0) {
    return customName.trim();
  }

  // Base names by type
  let baseName = '';
  if (type === 'null') {
    baseName = 'null';
  } else if (type === 'text') {
    baseName = lang === 'ar' ? 'نص' : 'Text';
  } else if (type === 'camera') {
    baseName = lang === 'ar' ? 'كاميرا' : 'Camera';
  } else if (type === 'solid') {
    baseName = lang === 'ar' ? 'خلفية' : 'Solid';
  } else if (type === 'particle') {
    baseName = lang === 'ar' ? 'جسيمات' : 'Particles';
  } else if (type === 'adjustment') {
    baseName = lang === 'ar' ? 'طبقة تعديل' : 'Adjustment';
  } else if (type === 'image') {
    baseName = lang === 'ar' ? 'صورة' : 'Image';
  } else if (type === 'video') {
    baseName = lang === 'ar' ? 'فيديو' : 'Video';
  } else if (type === 'audio') {
    baseName = lang === 'ar' ? 'صوت' : 'Audio';
  } else if (type === 'vector') {
    baseName = lang === 'ar' ? 'شكل' : 'Shape';
  } else if (type === 'model3d') {
    baseName = lang === 'ar' ? 'مجسم 3D' : '3D Model';
  } else {
    baseName = String(type);
  }

  const existingNamesLower = new Set(
    existingLayers.map((l) => (l.name || '').trim().toLowerCase())
  );

  // Check if baseName itself is already taken (e.g. "null")
  const baseNameLower = baseName.toLowerCase();
  const hasBase = existingNamesLower.has(baseNameLower);

  // Also check if any existing layer of this type exists
  const countSameType = existingLayers.filter((l) => l.type === type).length;

  if (!hasBase && countSameType === 0) {
    return baseName;
  }

  // Otherwise, find the lowest sequential number starting from 1: "null 1", "null 2", ...
  let num = 1;
  while (existingNamesLower.has(`${baseNameLower} ${num}`)) {
    num++;
  }

  return `${baseName} ${num}`;
}
