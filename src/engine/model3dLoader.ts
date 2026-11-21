import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js';
import { KMZLoader } from 'three/examples/jsm/loaders/KMZLoader.js';
import { LWOLoader } from 'three/examples/jsm/loaders/LWOLoader.js';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js';
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { XYZLoader } from 'three/examples/jsm/loaders/XYZLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import JSZip from 'jszip';
import { Layer, BoneControl, CreatureRigType, ProjectSettings, EvaluatedCameraState } from '../types';

import {
  SavedModel3DRecord,
  SavedModelExtraFile,
  getModel3DFromLibrary,
} from '../utils/localLibraryDB';

export interface Loaded3DModelResult {
  modelUrl: string;
  format: string;
  fileName: string;
  hasBones: boolean;
  bones: BoneControl[];
  animationClips: string[];
  object: THREE.Object3D;
  meshCount: number;
  materialCount: number;
  hasTextures: boolean;
  thumbnailDataUrl?: string;
  persistenceData?: {
    mainBlob: Blob;
    mtlText?: string;
    extraFiles: SavedModelExtraFile[];
  };
}

interface CachedModelAsset {
  object: THREE.Object3D;
  clips: THREE.AnimationClip[];
  hasBones: boolean;
  bones: BoneControl[];
  boundingRadius: number;
}

interface CachedLayerScene {
  scene: THREE.Scene;
  pivot: THREE.Group;
  object: THREE.Object3D;
  shadowPlane?: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  activeClipIdx?: number;
  clips: THREE.AnimationClip[];
  bonesMap: Map<string, THREE.Bone>;
  boundingRadius: number;
  isFallback?: boolean;
}

// Persistent in-memory cache keyed by modelUrl and optional savedModelId
const modelAssetCache = new Map<string, CachedModelAsset>();
const modelAssetBySavedId = new Map<string, string>();
const hydratingSavedIds = new Set<string>();

// Per-layer live Three.js scenes
const modelSceneCache = new Map<string, CachedLayerScene>();

let offscreenRenderer: THREE.WebGLRenderer | null = null;
let offscreenCanvas: HTMLCanvasElement | null = null;
let sharedEnvMap: THREE.Texture | null = null;
let isSoftwareGlRenderer = false;
let modelHydrationNotifyCallback: (() => void) | null = null;

export function setModel3DHydrationNotifier(cb: (() => void) | null) {
  modelHydrationNotifyCallback = cb;
}

function getOffscreenRenderer(width: number, height: number): {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  envMap: THREE.Texture | null;
  isSoftwareGl: boolean;
} | null {
  if (typeof document === 'undefined') return null;

  if (!offscreenRenderer || !offscreenCanvas) {
    try {
      offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = Math.max(2, width);
      offscreenCanvas.height = Math.max(2, height);

      // Probe hardware vs software WebGL (SwiftShader / llvmpipe / Softpipe)
      try {
        const probeGl =
          offscreenCanvas.getContext('webgl2', { preserveDrawingBuffer: true }) ||
          offscreenCanvas.getContext('webgl', { preserveDrawingBuffer: true });
        if (probeGl) {
          const dbg = (probeGl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
          const rendererStr = dbg
            ? String((probeGl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
            : '';
          isSoftwareGlRenderer = /SwiftShader|llvmpipe|Softpipe/i.test(rendererStr);
        }
      } catch {
        isSoftwareGlRenderer = false;
      }

      offscreenRenderer = new THREE.WebGLRenderer({
        canvas: offscreenCanvas,
        alpha: true,
        antialias: !isSoftwareGlRenderer,
        preserveDrawingBuffer: true,
        powerPreference: isSoftwareGlRenderer ? 'default' : 'high-performance',
      });
      offscreenRenderer.setPixelRatio(isSoftwareGlRenderer ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      offscreenRenderer.outputColorSpace = THREE.SRGBColorSpace;
      offscreenRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      offscreenRenderer.toneMappingExposure = 1.12;
      offscreenRenderer.shadowMap.enabled = !isSoftwareGlRenderer;
      offscreenRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      offscreenRenderer.setClearColor(0x000000, 0);

      try {
        const pmrem = new THREE.PMREMGenerator(offscreenRenderer);
        const envScene = new RoomEnvironment();
        sharedEnvMap = pmrem.fromScene(envScene, 0.04).texture;
        envScene.dispose();
        pmrem.dispose();
      } catch {
        sharedEnvMap = null;
      }
    } catch {
      offscreenRenderer = null;
      offscreenCanvas = null;
      return null;
    }
  }

  const rw = Math.max(2, Math.round(width));
  const rh = Math.max(2, Math.round(height));
  if (offscreenCanvas.width !== rw || offscreenCanvas.height !== rh) {
    offscreenRenderer.setSize(rw, rh, false);
  }

  return {
    renderer: offscreenRenderer,
    canvas: offscreenCanvas,
    envMap: sharedEnvMap,
    isSoftwareGl: isSoftwareGlRenderer,
  };
}

/**
 * Standardize limb bone classification (Human biped vs Animal quadruped)
 */
export function classifyBone(name: string): {
  category: BoneControl['category'];
  labelAr: string;
  labelEn: string;
} {
  const lower = name.toLowerCase();

  if (lower.includes('head') || lower.includes('رأس') || lower.includes('skull')) {
    return { category: 'head', labelAr: 'الرأس', labelEn: 'Head' };
  }
  if (lower.includes('neck') || lower.includes('عنق') || lower.includes('رقبة')) {
    return { category: 'head', labelAr: 'الرقبة / العنق', labelEn: 'Neck' };
  }

  if (lower.includes('chest') || lower.includes('صدر') || lower.includes('breast')) {
    return { category: 'spine', labelAr: 'الصدر والقفص الصدري', labelEn: 'Chest' };
  }
  if (lower.includes('spine') || lower.includes('ظهر') || lower.includes('pelvis') || lower.includes('hips') || lower.includes('root')) {
    return { category: 'spine', labelAr: 'العمود الفقري / الحوض', labelEn: 'Spine / Pelvis' };
  }

  if (
    (lower.includes('left') || lower.includes('_l') || lower.includes('.l') || lower.startsWith('l_')) &&
    (lower.includes('arm') || lower.includes('shoulder') || lower.includes('hand') || lower.includes('elbow') || lower.includes('wrist') || lower.includes('forearm'))
  ) {
    if (lower.includes('hand') || lower.includes('wrist')) {
      return { category: 'arm_left', labelAr: 'اليد اليسرى / الكف', labelEn: 'Left Hand' };
    }
    if (lower.includes('elbow') || lower.includes('forearm')) {
      return { category: 'arm_left', labelAr: 'الساعد الأيسر (الكوع)', labelEn: 'Left Forearm' };
    }
    return { category: 'arm_left', labelAr: 'الذراع الأيسر / الكتف', labelEn: 'Left Arm' };
  }

  if (
    (lower.includes('right') || lower.includes('_r') || lower.includes('.r') || lower.startsWith('r_')) &&
    (lower.includes('arm') || lower.includes('shoulder') || lower.includes('hand') || lower.includes('elbow') || lower.includes('wrist') || lower.includes('forearm'))
  ) {
    if (lower.includes('hand') || lower.includes('wrist')) {
      return { category: 'arm_right', labelAr: 'اليد اليمنى / الكف', labelEn: 'Right Hand' };
    }
    if (lower.includes('elbow') || lower.includes('forearm')) {
      return { category: 'arm_right', labelAr: 'الساعد الأيمن (الكوع)', labelEn: 'Right Forearm' };
    }
    return { category: 'arm_right', labelAr: 'الذراع الأيمن / الكتف', labelEn: 'Right Arm' };
  }

  if (
    (lower.includes('left') || lower.includes('_l') || lower.includes('.l') || lower.startsWith('l_')) &&
    (lower.includes('leg') || lower.includes('thigh') || lower.includes('foot') || lower.includes('knee') || lower.includes('calf') || lower.includes('shin') || lower.includes('ankle') || lower.includes('toe'))
  ) {
    if (lower.includes('foot') || lower.includes('ankle') || lower.includes('paw')) {
      return { category: 'leg_left', labelAr: 'القدم اليسرى / المخلب', labelEn: 'Left Foot' };
    }
    if (lower.includes('knee') || lower.includes('calf') || lower.includes('shin')) {
      return { category: 'leg_left', labelAr: 'الساق اليسرى (الركبة)', labelEn: 'Left Knee' };
    }
    return { category: 'leg_left', labelAr: 'الفخذ الأيسر / الورك', labelEn: 'Left Thigh' };
  }

  if (
    (lower.includes('right') || lower.includes('_r') || lower.includes('.r') || lower.startsWith('r_')) &&
    (lower.includes('leg') || lower.includes('thigh') || lower.includes('foot') || lower.includes('knee') || lower.includes('calf') || lower.includes('shin') || lower.includes('ankle') || lower.includes('toe'))
  ) {
    if (lower.includes('foot') || lower.includes('ankle') || lower.includes('paw')) {
      return { category: 'leg_right', labelAr: 'القدم اليمنى / المخلب', labelEn: 'Right Foot' };
    }
    if (lower.includes('knee') || lower.includes('calf') || lower.includes('shin')) {
      return { category: 'leg_right', labelAr: 'الساق اليمنى (الركبة)', labelEn: 'Right Knee' };
    }
    return { category: 'leg_right', labelAr: 'الفخذ الأيمن / الورك', labelEn: 'Right Thigh' };
  }

  if (lower.includes('tail') || lower.includes('ذيل')) {
    return { category: 'tail', labelAr: 'الذيل', labelEn: 'Tail' };
  }

  return { category: 'other', labelAr: name, labelEn: name };
}

/**
 * Extract bones from an Object3D hierarchy
 */
export function extractBones(root: THREE.Object3D): {
  hasBones: boolean;
  bones: BoneControl[];
  bonesMap: Map<string, THREE.Bone>;
} {
  const bonesMap = new Map<string, THREE.Bone>();
  const bones: BoneControl[] = [];

  root.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      const bone = child as THREE.Bone;
      const bName = bone.name || `bone_${bones.length}`;
      if (!bonesMap.has(bName)) {
        bonesMap.set(bName, bone);
        const classification = classifyBone(bName);
        bones.push({
          name: bName,
          labelAr: classification.labelAr,
          labelEn: classification.labelEn,
          category: classification.category,
          rotation: {
            x: Math.round(THREE.MathUtils.radToDeg(bone.rotation.x)),
            y: Math.round(THREE.MathUtils.radToDeg(bone.rotation.y)),
            z: Math.round(THREE.MathUtils.radToDeg(bone.rotation.z)),
          },
        });
      }
    }
  });

  return {
    hasBones: bones.length > 0,
    bones,
    bonesMap,
  };
}

/**
 * Normalizes model size to fit a standardized bounding volume (~280 units)
 * and centers the geometric pivot cleanly at (0, 0, 0).
 */
export function centerAndNormalizeModel(object: THREE.Object3D, targetSize: number = 280): number {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return targetSize * 0.5;

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0 && Number.isFinite(maxDim)) {
    const scale = targetSize / maxDim;
    object.scale.multiplyScalar(scale);
  }

  object.updateMatrixWorld(true);
  const centeredBox = new THREE.Box3().setFromObject(object);
  const center = centeredBox.getCenter(new THREE.Vector3());
  if (Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z)) {
    object.position.sub(center);
  }

  object.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(object);
  const finalSphere = new THREE.Sphere();
  finalBox.getBoundingSphere(finalSphere);
  return Math.max(80, finalSphere.radius || targetSize * 0.5);
}

/**
 * Enhances all loaded meshes, normals, textures, and PBR properties without discarding original textures/colors.
 */
function finalizeModelDetails(root: THREE.Object3D): {
  meshCount: number;
  materialCount: number;
  hasTextures: boolean;
} {
  let meshCount = 0;
  let hasTextures = false;
  const materialSet = new Set<THREE.Material>();

  const ensureTexColorSpace = (tex: THREE.Texture | null | undefined, isColor: boolean) => {
    if (!tex) return;
    hasTextures = true;
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    if (offscreenRenderer) {
      try {
        tex.anisotropy = Math.min(8, offscreenRenderer.capabilities.getMaxAnisotropy());
      } catch {}
    }
    tex.needsUpdate = true;
  };

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshCount++;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (mesh.geometry && !mesh.geometry.attributes.normal) {
        mesh.geometry.computeVertexNormals();
      }

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const normalizedMats = mats.map((mat) => {
        if (!mat) {
          const fallback = new THREE.MeshStandardMaterial({
            color: mesh.geometry?.attributes?.color ? '#ffffff' : '#cbd5e1',
            vertexColors: Boolean(mesh.geometry?.attributes?.color),
            roughness: 0.35,
            metalness: 0.25,
            side: THREE.DoubleSide,
          });
          materialSet.add(fallback);
          return fallback;
        }

        materialSet.add(mat);
        const std = mat as THREE.MeshStandardMaterial;
        ensureTexColorSpace(std.map, true);
        ensureTexColorSpace(std.emissiveMap, true);
        ensureTexColorSpace(std.normalMap, false);
        ensureTexColorSpace(std.roughnessMap, false);
        ensureTexColorSpace(std.metalnessMap, false);
        ensureTexColorSpace(std.aoMap, false);
        ensureTexColorSpace(std.bumpMap, false);
        ensureTexColorSpace(std.alphaMap, false);

        if (std.aoMap && mesh.geometry?.attributes?.uv && !mesh.geometry.attributes.uv2) {
          mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv);
        }

        if (mesh.geometry?.attributes?.color && !std.map) {
          std.vertexColors = true;
        }

        // Cache original values for non-destructive inspector tuning
        if ((std as any).isMeshStandardMaterial || (std as any).isMeshPhysicalMaterial) {
          if (std.userData.__origMetalness === undefined) {
            std.userData.__origMetalness = std.metalness;
          }
          if (std.userData.__origRoughness === undefined) {
            std.userData.__origRoughness = std.roughness;
          }
          if (std.userData.__origColorHex === undefined && std.color) {
            std.userData.__origColorHex = `#${std.color.getHexString()}`;
          }
        }
        mat.needsUpdate = true;
        return mat;
      });

      mesh.material = Array.isArray(mesh.material) ? normalizedMats : normalizedMats[0];
    }
  });

  return {
    meshCount,
    materialCount: materialSet.size,
    hasTextures,
  };
}

/**
 * Procedural Auto-Rigging Engine for Living Creatures (Biped & Quadruped)
 * Automatically builds bones and computes vertex skin weights if model lacks a skeleton.
 */
export function autoRigCreatureModel(
  root: THREE.Object3D,
  creatureType: CreatureRigType = 'biped'
): {
  hasBones: boolean;
  bones: BoneControl[];
} {
  if (creatureType === 'none') {
    return { hasBones: false, bones: [] };
  }

  const meshesToRig: THREE.Mesh[] = [];
  root.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && !(c as THREE.SkinnedMesh).isSkinnedMesh) {
      meshesToRig.push(c as THREE.Mesh);
    }
  });

  if (meshesToRig.length === 0) {
    const existing = extractBones(root);
    return { hasBones: existing.hasBones, bones: existing.bones };
  }

  root.updateMatrixWorld(true);
  const invRootMatrix = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const overallBox = new THREE.Box3().setFromObject(root);
  overallBox.applyMatrix4(invRootMatrix);

  const size = overallBox.getSize(new THREE.Vector3());
  const center = overallBox.getCenter(new THREE.Vector3());
  const minY = overallBox.min.y;
  const h = Math.max(1, size.y);
  const w = Math.max(1, size.x);
  const d = Math.max(1, size.z);

  interface BoneDef {
    name: string;
    labelAr: string;
    labelEn: string;
    category: BoneControl['category'];
    pos: THREE.Vector3;
    parentName?: string;
  }

  const defs: BoneDef[] = [];

  if (creatureType === 'biped') {
    defs.push(
      { name: 'root_pelvis', labelAr: 'الحوض والورك', labelEn: 'Pelvis', category: 'spine', pos: new THREE.Vector3(center.x, minY + h * 0.52, center.z) },
      { name: 'spine_mid', labelAr: 'العمود الفقري', labelEn: 'Spine', category: 'spine', pos: new THREE.Vector3(center.x, minY + h * 0.68, center.z), parentName: 'root_pelvis' },
      { name: 'chest_upper', labelAr: 'الصدر والكتفين', labelEn: 'Chest', category: 'spine', pos: new THREE.Vector3(center.x, minY + h * 0.82, center.z), parentName: 'spine_mid' },
      { name: 'neck', labelAr: 'العنق', labelEn: 'Neck', category: 'head', pos: new THREE.Vector3(center.x, minY + h * 0.90, center.z), parentName: 'chest_upper' },
      { name: 'head', labelAr: 'الرأس', labelEn: 'Head', category: 'head', pos: new THREE.Vector3(center.x, minY + h * 0.98, center.z), parentName: 'neck' },

      { name: 'arm_left_shoulder', labelAr: 'الكتف الأيسر', labelEn: 'Left Shoulder', category: 'arm_left', pos: new THREE.Vector3(center.x - w * 0.28, minY + h * 0.80, center.z), parentName: 'chest_upper' },
      { name: 'arm_left_elbow', labelAr: 'الساعد الأيسر', labelEn: 'Left Elbow', category: 'arm_left', pos: new THREE.Vector3(center.x - w * 0.44, minY + h * 0.62, center.z), parentName: 'arm_left_shoulder' },
      { name: 'arm_left_hand', labelAr: 'اليد اليسرى', labelEn: 'Left Hand', category: 'arm_left', pos: new THREE.Vector3(center.x - w * 0.52, minY + h * 0.45, center.z), parentName: 'arm_left_elbow' },

      { name: 'arm_right_shoulder', labelAr: 'الكتف الأيمن', labelEn: 'Right Shoulder', category: 'arm_right', pos: new THREE.Vector3(center.x + w * 0.28, minY + h * 0.80, center.z), parentName: 'chest_upper' },
      { name: 'arm_right_elbow', labelAr: 'الساعد الأيمن', labelEn: 'Right Elbow', category: 'arm_right', pos: new THREE.Vector3(center.x + w * 0.44, minY + h * 0.62, center.z), parentName: 'arm_right_shoulder' },
      { name: 'arm_right_hand', labelAr: 'اليد اليمنى', labelEn: 'Right Hand', category: 'arm_right', pos: new THREE.Vector3(center.x + w * 0.52, minY + h * 0.45, center.z), parentName: 'arm_right_elbow' },

      { name: 'leg_left_thigh', labelAr: 'الفخذ الأيسر', labelEn: 'Left Thigh', category: 'leg_left', pos: new THREE.Vector3(center.x - w * 0.16, minY + h * 0.46, center.z), parentName: 'root_pelvis' },
      { name: 'leg_left_knee', labelAr: 'الركبة اليسرى', labelEn: 'Left Knee', category: 'leg_left', pos: new THREE.Vector3(center.x - w * 0.16, minY + h * 0.24, center.z + d * 0.04), parentName: 'leg_left_thigh' },
      { name: 'leg_left_foot', labelAr: 'القدم اليسرى', labelEn: 'Left Foot', category: 'leg_left', pos: new THREE.Vector3(center.x - w * 0.16, minY + h * 0.05, center.z + d * 0.10), parentName: 'leg_left_knee' },

      { name: 'leg_right_thigh', labelAr: 'الفخذ الأيمن', labelEn: 'Right Thigh', category: 'leg_right', pos: new THREE.Vector3(center.x + w * 0.16, minY + h * 0.46, center.z), parentName: 'root_pelvis' },
      { name: 'leg_right_knee', labelAr: 'الركبة اليمنى', labelEn: 'Right Knee', category: 'leg_right', pos: new THREE.Vector3(center.x + w * 0.16, minY + h * 0.24, center.z + d * 0.04), parentName: 'leg_right_thigh' },
      { name: 'leg_right_foot', labelAr: 'القدم اليمنى', labelEn: 'Right Foot', category: 'leg_right', pos: new THREE.Vector3(center.x + w * 0.16, minY + h * 0.05, center.z + d * 0.10), parentName: 'leg_right_knee' }
    );
  } else {
    defs.push(
      { name: 'root_pelvis', labelAr: 'الحوض الخلفي', labelEn: 'Rear Pelvis', category: 'spine', pos: new THREE.Vector3(center.x, minY + h * 0.60, center.z - d * 0.25) },
      { name: 'spine_mid', labelAr: 'وسط الظهر', labelEn: 'Mid Spine', category: 'spine', pos: new THREE.Vector3(center.x, minY + h * 0.65, center.z), parentName: 'root_pelvis' },
      { name: 'chest_front', labelAr: 'الصدر الأمامي', labelEn: 'Front Chest', category: 'spine', pos: new THREE.Vector3(center.x, minY + h * 0.68, center.z + d * 0.28), parentName: 'spine_mid' },
      { name: 'neck', labelAr: 'العنق', labelEn: 'Neck', category: 'head', pos: new THREE.Vector3(center.x, minY + h * 0.80, center.z + d * 0.40), parentName: 'chest_front' },
      { name: 'head', labelAr: 'الرأس والفك', labelEn: 'Head & Jaw', category: 'head', pos: new THREE.Vector3(center.x, minY + h * 0.92, center.z + d * 0.52), parentName: 'neck' },

      { name: 'front_left_shoulder', labelAr: 'الكتف الأمامي الأيسر', labelEn: 'Front Left Shoulder', category: 'arm_left', pos: new THREE.Vector3(center.x - w * 0.25, minY + h * 0.58, center.z + d * 0.26), parentName: 'chest_front' },
      { name: 'front_left_knee', labelAr: 'الركبة الأمامية اليسرى', labelEn: 'Front Left Knee', category: 'arm_left', pos: new THREE.Vector3(center.x - w * 0.25, minY + h * 0.30, center.z + d * 0.26), parentName: 'front_left_shoulder' },
      { name: 'front_left_paw', labelAr: 'المخلب الأمامي الأيسر', labelEn: 'Front Left Paw', category: 'arm_left', pos: new THREE.Vector3(center.x - w * 0.25, minY + h * 0.05, center.z + d * 0.28), parentName: 'front_left_knee' },

      { name: 'front_right_shoulder', labelAr: 'الكتف الأمامي الأيمن', labelEn: 'Front Right Shoulder', category: 'arm_right', pos: new THREE.Vector3(center.x + w * 0.25, minY + h * 0.58, center.z + d * 0.26), parentName: 'chest_front' },
      { name: 'front_right_knee', labelAr: 'الركبة الأمامية اليمنى', labelEn: 'Front Right Knee', category: 'arm_right', pos: new THREE.Vector3(center.x + w * 0.25, minY + h * 0.30, center.z + d * 0.26), parentName: 'front_right_shoulder' },
      { name: 'front_right_paw', labelAr: 'المخلب الأمامي الأيمن', labelEn: 'Front Right Paw', category: 'arm_right', pos: new THREE.Vector3(center.x + w * 0.25, minY + h * 0.05, center.z + d * 0.28), parentName: 'front_right_knee' },

      { name: 'back_left_hip', labelAr: 'الورك الخلفي الأيسر', labelEn: 'Back Left Hip', category: 'leg_left', pos: new THREE.Vector3(center.x - w * 0.25, minY + h * 0.54, center.z - d * 0.25), parentName: 'root_pelvis' },
      { name: 'back_left_knee', labelAr: 'الركبة الخلفية اليسرى', labelEn: 'Back Left Knee', category: 'leg_left', pos: new THREE.Vector3(center.x - w * 0.25, minY + h * 0.28, center.z - d * 0.25), parentName: 'back_left_hip' },
      { name: 'back_left_paw', labelAr: 'المخلب الخلفي الأيسر', labelEn: 'Back Left Paw', category: 'leg_left', pos: new THREE.Vector3(center.x - w * 0.25, minY + h * 0.05, center.z - d * 0.25), parentName: 'back_left_knee' },

      { name: 'back_right_hip', labelAr: 'الورك الخلفي الأيمن', labelEn: 'Back Right Hip', category: 'leg_right', pos: new THREE.Vector3(center.x + w * 0.25, minY + h * 0.54, center.z - d * 0.25), parentName: 'root_pelvis' },
      { name: 'back_right_knee', labelAr: 'الركبة الخلفية اليمنى', labelEn: 'Back Right Knee', category: 'leg_right', pos: new THREE.Vector3(center.x + w * 0.25, minY + h * 0.28, center.z - d * 0.25), parentName: 'back_right_hip' },
      { name: 'back_right_paw', labelAr: 'المخلب الخلفي الأيمن', labelEn: 'Back Right Paw', category: 'leg_right', pos: new THREE.Vector3(center.x + w * 0.25, minY + h * 0.05, center.z - d * 0.25), parentName: 'back_right_knee' },

      { name: 'tail_base', labelAr: 'قاعدة الذيل', labelEn: 'Tail Base', category: 'tail', pos: new THREE.Vector3(center.x, minY + h * 0.58, center.z - d * 0.35), parentName: 'root_pelvis' },
      { name: 'tail_tip', labelAr: 'طرف الذيل', labelEn: 'Tail Tip', category: 'tail', pos: new THREE.Vector3(center.x, minY + h * 0.68, center.z - d * 0.55), parentName: 'tail_base' }
    );
  }

  const createdBones: THREE.Bone[] = [];
  const boneMap = new Map<string, THREE.Bone>();
  const boneRootPos = new Map<string, THREE.Vector3>();

  defs.forEach((d) => {
    const b = new THREE.Bone();
    b.name = d.name;
    boneMap.set(d.name, b);
    boneRootPos.set(d.name, d.pos.clone());
    createdBones.push(b);
  });

  defs.forEach((d) => {
    const b = boneMap.get(d.name)!;
    if (d.parentName && boneMap.has(d.parentName)) {
      const parent = boneMap.get(d.parentName)!;
      parent.add(b);
      const parentPos = boneRootPos.get(d.parentName)!;
      b.position.copy(d.pos).sub(parentPos);
    } else {
      b.position.copy(d.pos);
    }
  });

  const rootBone = boneMap.get('root_pelvis')!;
  root.add(rootBone);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(createdBones);

  meshesToRig.forEach((mesh) => {
    const geo = mesh.geometry.clone();
    if (!geo.attributes.position) return;

    // Bake mesh transform into root space so vertices align directly with root-attached skeleton
    const meshToRoot = new THREE.Matrix4().multiplyMatrices(invRootMatrix, mesh.matrixWorld);
    geo.applyMatrix4(meshToRoot);

    const posAttr = geo.attributes.position;
    const vertexCount = posAttr.count;
    const skinIndices = new Uint16Array(vertexCount * 4);
    const skinWeights = new Float32Array(vertexCount * 4);

    const v = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      v.fromBufferAttribute(posAttr, i);

      const dists: { index: number; distSq: number }[] = [];
      createdBones.forEach((b, bIdx) => {
        const bPos = boneRootPos.get(b.name);
        if (bPos) {
          dists.push({ index: bIdx, distSq: v.distanceToSquared(bPos) });
        }
      });
      dists.sort((a, b) => a.distSq - b.distSq);

      const top4 = dists.slice(0, 4);
      let totalInv = 0;
      const rawWeights = top4.map((item) => {
        const weight = 1.0 / (item.distSq + 0.001);
        totalInv += weight;
        return weight;
      });

      top4.forEach((item, slot) => {
        skinIndices[i * 4 + slot] = item.index;
        skinWeights[i * 4 + slot] = rawWeights[slot] / (totalInv || 1);
      });
    }

    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const origMat = mesh.material;
    const mat = Array.isArray(origMat)
      ? origMat.map((m) => m.clone())
      : origMat
      ? origMat.clone()
      : new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.4, metalness: 0.25 });

    const skinnedMesh = new THREE.SkinnedMesh(geo, mat);
    skinnedMesh.name = `${mesh.name || 'mesh'}_rigged`;
    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;

    root.add(skinnedMesh);
    skinnedMesh.bind(skeleton);

    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
  });

  const controls: BoneControl[] = defs.map((d) => ({
    name: d.name,
    labelAr: d.labelAr,
    labelEn: d.labelEn,
    category: d.category,
    rotation: { x: 0, y: 0, z: 0 },
  }));

  return {
    hasBones: true,
    bones: controls,
  };
}

/**
 * Auto-rigs the live cached 3D model for a specific layer ID.
 */
export function autoRigLayerModel(
  layerId: string,
  creatureType: CreatureRigType
): { hasBones: boolean; bones: BoneControl[] } {
  const cached = modelSceneCache.get(layerId);
  if (!cached) {
    return { hasBones: false, bones: [] };
  }
  const rigged = autoRigCreatureModel(cached.object, creatureType);
  const extracted = extractBones(cached.object);
  cached.bonesMap = extracted.bonesMap;
  return rigged;
}

const SUPPORTED_MODEL_EXTENSIONS = [
  'glb',
  'gltf',
  'vrm',
  'fbx',
  'dae',
  'obj',
  'usdz',
  'usd',
  'usda',
  'usdc',
  '3ds',
  '3mf',
  'amf',
  'kmz',
  'lwo',
  'wrl',
  'vrml',
  'vox',
  'ply',
  'stl',
  'pcd',
  'xyz',
] as const;

const SUPPORTED_ASSET_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tga',
  '.bmp',
  '.gif',
  '.svg',
  '.exr',
  '.hdr',
  '.tif',
  '.tiff',
  '.dds',
  '.ktx2',
  '.ktx',
  '.bin',
  '.mtl',
];

function normalizeAssetPath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .trim();
}

function createBlobResolverManager(
  blobMap?: Map<string, string>
): { manager: THREE.LoadingManager; waitForLoads: () => Promise<void> } {
  const manager = new THREE.LoadingManager();
  manager.addHandler(/\.tga$/i, new TGALoader(manager));

  let hasStarted = false;
  let completed = false;
  const waiters: Array<() => void> = [];

  manager.onStart = () => {
    hasStarted = true;
    completed = false;
  };
  manager.onLoad = () => {
    completed = true;
    while (waiters.length > 0) {
      waiters.shift()?.();
    }
  };
  manager.onError = () => {
    // Allow manager.onLoad to eventually complete even if an optional texture failed
  };

  if (blobMap && blobMap.size > 0) {
    manager.setURLModifier((url) => {
      if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

      let decoded = url;
      try {
        decoded = decodeURIComponent(url);
      } catch {}

      const normalized = normalizeAssetPath(decoded);
      const lower = normalized.toLowerCase();
      const base = normalized.split('/').pop() || normalized;
      const baseLower = base.toLowerCase();

      const direct =
        blobMap.get(url) ||
        blobMap.get(decoded) ||
        blobMap.get(normalized) ||
        blobMap.get(lower) ||
        blobMap.get(base) ||
        blobMap.get(baseLower);

      if (direct) return direct;

      // Suffix fallback for relative nested subfolders (e.g. "../textures/albedo.png")
      const cleanSuffix = `/${baseLower}`;
      for (const [k, v] of blobMap.entries()) {
        const kLower = k.toLowerCase();
        if (kLower === lower || kLower.endsWith(`/${lower}`) || kLower.endsWith(cleanSuffix)) {
          return v;
        }
      }

      return url;
    });
  }

  const waitForLoads = () =>
    new Promise<void>((resolve) => {
      if (!blobMap || blobMap.size === 0 || completed) {
        resolve();
        return;
      }
      // Give synchronous/async texture requests a moment to register with manager
      setTimeout(() => {
        if (!hasStarted || completed) {
          resolve();
          return;
        }
        const timer = setTimeout(() => resolve(), 1500);
        waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      }, 45);
    });

  return { manager, waitForLoads };
}

/**
 * Generates a crisp studio 3D thumbnail image (data URL) of a loaded model for in-app library cards.
 */
export function generateModel3DThumbnail(object: THREE.Object3D): string {
  try {
    const bundle = getOffscreenRenderer(256, 256);
    if (!bundle) return '';
    const { renderer, canvas, envMap } = bundle;

    const previewScene = new THREE.Scene();
    if (envMap) previewScene.environment = envMap;

    previewScene.add(new THREE.AmbientLight(0xffffff, 0.85));
    previewScene.add(new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.65));

    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(260, 340, 360);
    previewScene.add(key);

    const fill = new THREE.DirectionalLight(0x38bdf8, 0.65);
    fill.position.set(-240, 120, 220);
    previewScene.add(fill);

    const clone = SkeletonUtils.clone(object);
    clone.rotation.set(0.18, -0.55, 0, 'YXZ');
    previewScene.add(clone);

    const cam = new THREE.PerspectiveCamera(32, 1, 10, 4000);
    cam.position.set(0, 10, 620);
    cam.lookAt(0, 0, 0);

    renderer.clear();
    renderer.render(previewScene, cam);

    const dataUrl = canvas.toDataURL('image/png');
    previewScene.clear();
    return dataUrl;
  } catch {
    return '';
  }
}

/**
 * Loads one or multiple files selected by the user:
 * - Single .zip package (with meshes, textures, .mtl, .bin)
 * - Single standalone 3D file (.glb, .gltf, .fbx, .obj, .stl, .dae, .ply, .usdz, etc.)
 * - Multiple loose files together (e.g. .obj + .mtl + textures, or .gltf + .bin + textures)
 */
async function isZipMagicBytes(data: Blob | ArrayBuffer): Promise<boolean> {
  try {
    const headerBuf = data instanceof Blob ? await data.slice(0, 4).arrayBuffer() : data.slice(0, 4);
    if (headerBuf.byteLength < 4) return false;
    const bytes = new Uint8Array(headerBuf);
    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x01)
    );
  } catch {
    return false;
  }
}

export async function load3DModelFiles(files: File[]): Promise<Loaded3DModelResult> {
  if (!files || files.length === 0) {
    throw new Error('لم يتم اختيار أي ملف مجسم ثلاثي الأبعاد');
  }

  if (files.length === 1) {
    return await load3DModelFile(files[0]);
  }

  // Multi-file selection: locate main 3D model and resolve all companion textures, .mtl, .bin
  const blobMap = new Map<string, string>();
  const extraFiles: SavedModelExtraFile[] = [];
  const modelCandidates: Array<{ file: File; ext: string; priority: number }> = [];
  const mtlFiles: File[] = [];

  for (const f of files) {
    const baseName = normalizeAssetPath(f.name).split('/').pop() || f.name;
    const baseLower = baseName.toLowerCase();
    const ext = baseLower.split('.').pop() || '';

    if (ext === 'zip' || (await isZipMagicBytes(f))) {
      return await loadZipWithAssets(f);
    }

    if (ext === 'mtl') {
      mtlFiles.push(f);
      const url = URL.createObjectURL(f);
      blobMap.set(f.name, url);
      blobMap.set(baseName, url);
      blobMap.set(baseLower, url);
      extraFiles.push({ path: baseName, blob: f });
      continue;
    }

    const priority = SUPPORTED_MODEL_EXTENSIONS.indexOf(ext as any);
    if (priority !== -1) {
      modelCandidates.push({ file: f, ext, priority });
      continue;
    }

    // Textures, .bin buffers, or other sidecars
    if (SUPPORTED_ASSET_EXTENSIONS.some((assetExt) => baseLower.endsWith(assetExt))) {
      const url = URL.createObjectURL(f);
      blobMap.set(f.name, url);
      blobMap.set(baseName, url);
      blobMap.set(baseLower, url);
      extraFiles.push({ path: baseName, blob: f });
    }
  }

  if (modelCandidates.length === 0) {
    throw new Error('لم يتم العثور على ملف مجسم ثلاثي الأبعاد صالح ضمن الملفات المختارة');
  }

  modelCandidates.sort((a, b) => a.priority - b.priority);
  const mainModel = modelCandidates[0];
  const arrayBuffer = await mainModel.file.arrayBuffer();

  let mtlText: string | undefined;
  if (mainModel.ext === 'obj' && mtlFiles.length > 0) {
    const stem = mainModel.file.name.replace(/\.obj$/i, '').toLowerCase();
    const match =
      mtlFiles.find((m) => m.name.replace(/\.mtl$/i, '').toLowerCase() === stem) || mtlFiles[0];
    mtlText = await match.text();
  }

  const res = await loadModelBufferByExt(
    arrayBuffer,
    mainModel.file.name,
    mainModel.ext,
    mtlText,
    blobMap
  );
  res.persistenceData = {
    mainBlob: mainModel.file,
    mtlText,
    extraFiles,
  };
  return res;
}

/**
 * Loads ANY single 3D Model file (.glb, .gltf, .obj, .fbx, .stl, .dae, .ply, .usdz, .zip, etc.)
 */
export async function load3DModelFile(file: File): Promise<Loaded3DModelResult> {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'zip' || (await isZipMagicBytes(file))) {
    return await loadZipWithAssets(file);
  }

  const arrayBuffer = await file.arrayBuffer();
  const res = await loadModelBufferByExt(arrayBuffer, fileName, ext);
  res.persistenceData = {
    mainBlob: file,
    extraFiles: [],
  };
  return res;
}

/**
 * Restores a persisted 3D model record from IndexedDB into active Three.js scene caches.
 */
export async function load3DModelFromSavedRecord(
  record: SavedModel3DRecord
): Promise<Loaded3DModelResult> {
  const ext = (record.format || record.fileName.split('.').pop() || '').toLowerCase();
  const isZipRecord =
    ext === 'zip' ||
    record.fileName.toLowerCase().endsWith('.zip') ||
    (await isZipMagicBytes(record.mainBlob));

  if (isZipRecord) {
    const zipName = record.fileName.toLowerCase().endsWith('.zip')
      ? record.fileName
      : `${record.fileName}.zip`;
    const zipFile = new File([record.mainBlob], zipName, { type: 'application/zip' });
    const res = await loadZipWithAssets(zipFile);
    modelAssetBySavedId.set(record.id, res.modelUrl);
    return res;
  }

  const blobMap = new Map<string, string>();
  if (record.extraFiles && record.extraFiles.length > 0) {
    for (const extra of record.extraFiles) {
      const normalized = normalizeAssetPath(extra.path);
      const lower = normalized.toLowerCase();
      const baseName = normalized.split('/').pop() || normalized;
      const baseLower = baseName.toLowerCase();
      const url = URL.createObjectURL(extra.blob);
      blobMap.set(normalized, url);
      blobMap.set(lower, url);
      blobMap.set(baseName, url);
      blobMap.set(baseLower, url);
    }
  }

  const arrayBuffer = await record.mainBlob.arrayBuffer();
  const res = await loadModelBufferByExt(
    arrayBuffer,
    record.fileName,
    ext,
    record.mtlText,
    blobMap
  );
  modelAssetBySavedId.set(record.id, res.modelUrl);
  return res;
}

export function hydrateMissingModelFromDB(savedModelId: string): void {
  if (!savedModelId || hydratingSavedIds.has(savedModelId)) return;
  hydratingSavedIds.add(savedModelId);
  getModel3DFromLibrary(savedModelId)
    .then((record) => {
      if (!record) return null;
      return load3DModelFromSavedRecord(record);
    })
    .then((res) => {
      if (!res) return;
      modelAssetBySavedId.set(savedModelId, res.modelUrl);
      // Clear any fallback scenes referencing this savedModelId so next render uses real 3D model
      for (const [k, v] of modelSceneCache.entries()) {
        if (v.isFallback) {
          modelSceneCache.delete(k);
        }
      }
      if (modelHydrationNotifyCallback) {
        modelHydrationNotifyCallback();
      }
    })
    .catch(() => {})
    .finally(() => {
      hydratingSavedIds.delete(savedModelId);
    });
}

async function loadModelBufferByExt(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  ext: string,
  mtlText?: string,
  blobMap?: Map<string, string>
): Promise<Loaded3DModelResult> {
  if (await isZipMagicBytes(arrayBuffer)) {
    const zipFile = new File([arrayBuffer], `${fileName || 'model'}.zip`, {
      type: 'application/zip',
    });
    return await loadZipWithAssets(zipFile);
  }

  const modelBlobUrl = URL.createObjectURL(new Blob([arrayBuffer]));
  const { manager, waitForLoads } = createBlobResolverManager(blobMap);

  let object: THREE.Object3D = new THREE.Group();
  let clips: THREE.AnimationClip[] = [];
  const lowerExt = ext.toLowerCase();

  if (lowerExt === 'glb' || lowerExt === 'gltf' || lowerExt === 'vrm') {
    const gltf: any = await new Promise((resolve, reject) => {
      const loader = new GLTFLoader(manager);
      loader.parse(arrayBuffer, '', resolve, reject);
    });
    object = gltf.scene || gltf.scenes?.[0] || new THREE.Group();
    clips = gltf.animations || [];
  } else if (lowerExt === 'obj') {
    const objLoader = new OBJLoader(manager);
    if (mtlText) {
      const mtlLoader = new MTLLoader(manager);
      const materialsCreator = mtlLoader.parse(mtlText, '');
      materialsCreator.preload();
      objLoader.setMaterials(materialsCreator);
    }
    const text = new TextDecoder().decode(arrayBuffer);
    object = objLoader.parse(text);
  } else if (lowerExt === 'fbx') {
    const loader = new FBXLoader(manager);
    const fbxGroup = loader.parse(arrayBuffer, '');
    object = fbxGroup;
    clips = fbxGroup.animations || [];
  } else if (lowerExt === 'stl') {
    const loader = new STLLoader(manager);
    const geometry = loader.parse(arrayBuffer);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const hasColors = Boolean(geometry.attributes.color);
    const material = new THREE.MeshStandardMaterial({
      color: hasColors ? '#ffffff' : '#e2e8f0',
      vertexColors: hasColors,
      roughness: 0.3,
      metalness: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = fileName;
    object = new THREE.Group();
    object.add(mesh);
  } else if (lowerExt === 'dae') {
    const loader = new ColladaLoader(manager);
    const text = new TextDecoder().decode(arrayBuffer);
    const collada = loader.parse(text, '');
    object = collada.scene || new THREE.Group();
    clips = (collada.scene as any)?.animations || (collada as any)?.animations || [];
  } else if (lowerExt === 'ply') {
    const loader = new PLYLoader(manager);
    const geometry = loader.parse(arrayBuffer);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const hasColors = Boolean(geometry.attributes.color);
    const hasFaces = Boolean(geometry.index) || (geometry.attributes.position?.count || 0) >= 3;
    object = new THREE.Group();
    if (hasFaces && geometry.attributes.normal) {
      const mat = new THREE.MeshStandardMaterial({
        color: hasColors ? '#ffffff' : '#cbd5e1',
        vertexColors: hasColors,
        roughness: 0.35,
        metalness: 0.3,
      });
      object.add(new THREE.Mesh(geometry, mat));
    } else {
      const mat = new THREE.PointsMaterial({
        size: 3,
        vertexColors: hasColors,
        color: hasColors ? '#ffffff' : '#38bdf8',
      });
      object.add(new THREE.Points(geometry, mat));
    }
  } else if (lowerExt === '3ds') {
    const loader = new TDSLoader(manager);
    object = loader.parse(arrayBuffer, '');
  } else if (lowerExt === '3mf') {
    const loader = new ThreeMFLoader(manager);
    object = loader.parse(arrayBuffer);
  } else if (lowerExt === 'amf') {
    const loader = new AMFLoader(manager);
    object = loader.parse(arrayBuffer);
  } else if (lowerExt === 'kmz') {
    const loader = new KMZLoader(manager);
    const kmz = loader.parse(arrayBuffer);
    object = kmz.scene || new THREE.Group();
    clips = (kmz.scene as any)?.animations || [];
  } else if (lowerExt === 'lwo') {
    const loader = new LWOLoader(manager);
    const lwo = loader.parse(arrayBuffer, '', fileName);
    const group = new THREE.Group();
    (lwo.meshes || []).forEach((m) => group.add(m));
    object = group;
  } else if (lowerExt === 'usdz' || lowerExt === 'usd' || lowerExt === 'usda' || lowerExt === 'usdc') {
    const loader = new USDLoader(manager);
    object = await new Promise<THREE.Group>((resolve, reject) => {
      try {
        const res = loader.parse(
          arrayBuffer,
          '',
          (grp) => resolve(grp),
          (err) => reject(err)
        );
        if (res && res.children.length > 0) {
          resolve(res);
        }
      } catch (e) {
        reject(e);
      }
    });
  } else if (lowerExt === 'wrl' || lowerExt === 'vrml') {
    const loader = new VRMLLoader(manager);
    const text = new TextDecoder().decode(arrayBuffer);
    object = loader.parse(text, '');
  } else if (lowerExt === 'vox') {
    const loader = new VOXLoader(manager);
    const vox = loader.parse(arrayBuffer);
    object = vox.scene || new THREE.Group();
  } else if (lowerExt === 'pcd') {
    const loader = new PCDLoader(manager);
    const points = loader.parse(arrayBuffer);
    if (points.material && (points.material as THREE.PointsMaterial).isPointsMaterial) {
      (points.material as THREE.PointsMaterial).size = Math.max(2, (points.material as THREE.PointsMaterial).size || 2);
    }
    object = points;
  } else if (lowerExt === 'xyz') {
    const loader = new XYZLoader(manager);
    const text = new TextDecoder().decode(arrayBuffer);
    const geometry: THREE.BufferGeometry = await new Promise((resolve) => {
      loader.parse(text, (geo) => resolve(geo));
    });
    const hasColors = Boolean(geometry.attributes.color);
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 3, vertexColors: hasColors, color: '#38bdf8' })
    );
    object = points;
  } else {
    // Fallback attempt via GLTF
    const gltf: any = await new Promise((resolve, reject) => {
      const loader = new GLTFLoader(manager);
      loader.parse(arrayBuffer, '', resolve, reject);
    });
    object = gltf.scene || gltf.scenes?.[0] || new THREE.Group();
    clips = gltf.animations || [];
  }

  // Wait for any referenced textures/buffers in blobMap to finish decoding
  await waitForLoads();

  // Normalize scale + pivot & polish textures, normals & shadows
  const boundingRadius = centerAndNormalizeModel(object, 280);
  const stats = finalizeModelDetails(object);
  const thumbnailDataUrl = generateModel3DThumbnail(object);

  const extractedBones = extractBones(object);
  const clipNames = clips.map((a, idx) => a.name || `Animation ${idx + 1}`);

  // Store full loaded asset + clips so layers & duplicates instantiate with all textures/details
  modelAssetCache.set(modelBlobUrl, {
    object,
    clips,
    hasBones: extractedBones.hasBones,
    bones: extractedBones.bones,
    boundingRadius,
  });

  return {
    modelUrl: modelBlobUrl,
    format: lowerExt || '3d',
    fileName,
    hasBones: extractedBones.hasBones,
    bones: extractedBones.bones,
    animationClips: clipNames,
    object,
    meshCount: stats.meshCount,
    materialCount: stats.materialCount,
    hasTextures: stats.hasTextures,
    thumbnailDataUrl,
  };
}

/**
 * Loads a ZIP package, extracts all textures, .bin buffers, .mtl materials, and main 3D model seamlessly.
 */
async function loadZipWithAssets(file: File): Promise<Loaded3DModelResult> {
  const zip = new JSZip();
  const unzipped = await zip.loadAsync(file);

  const blobMap = new Map<string, string>();
  const modelCandidates: Array<{ name: string; ext: string; file: JSZip.JSZipObject; priority: number }> = [];
  const mtlFiles: Array<{ name: string; file: JSZip.JSZipObject }> = [];

  const fileEntries = Object.keys(unzipped.files);
  for (const rawPath of fileEntries) {
    const entry = unzipped.files[rawPath];
    if (entry.dir) continue;

    // Skip macOS metadata & hidden double files
    const normalized = normalizeAssetPath(rawPath);
    const baseName = normalized.split('/').pop() || normalized;
    if (
      normalized.startsWith('__MACOSX/') ||
      normalized.includes('/__MACOSX/') ||
      baseName.startsWith('._')
    ) {
      continue;
    }

    const lower = normalized.toLowerCase();
    const baseLower = baseName.toLowerCase();

    if (lower.endsWith('.mtl')) {
      mtlFiles.push({ name: normalized, file: entry });
      const blob = await entry.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      blobMap.set(normalized, blobUrl);
      blobMap.set(lower, blobUrl);
      blobMap.set(baseName, blobUrl);
      blobMap.set(baseLower, blobUrl);
      continue;
    }

    if (SUPPORTED_ASSET_EXTENSIONS.some((assetExt) => lower.endsWith(assetExt))) {
      const blob = await entry.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      blobMap.set(normalized, blobUrl);
      blobMap.set(lower, blobUrl);
      blobMap.set(baseName, blobUrl);
      blobMap.set(baseLower, blobUrl);
      continue;
    }

    const ext = baseLower.split('.').pop() || '';
    const priority = SUPPORTED_MODEL_EXTENSIONS.indexOf(ext as any);
    if (priority !== -1) {
      modelCandidates.push({ name: normalized, ext, file: entry, priority });
    }
  }

  if (modelCandidates.length === 0) {
    throw new Error('لم يتم العثور على ملف مجسم ثلاثي الأبعاد صالح داخل ملف ZIP');
  }

  modelCandidates.sort((a, b) => a.priority - b.priority);
  const mainModel = modelCandidates[0];
  const modelBuffer = await mainModel.file.async('arraybuffer');

  let mtlText: string | undefined;
  if (mainModel.ext === 'obj' && mtlFiles.length > 0) {
    const stem = mainModel.name.replace(/\.obj$/i, '').toLowerCase();
    const matchingMtl =
      mtlFiles.find((m) => m.name.replace(/\.mtl$/i, '').toLowerCase() === stem) ||
      mtlFiles[0];
    mtlText = await matchingMtl.file.async('text');
  }

  const res = await loadModelBufferByExt(
    modelBuffer,
    mainModel.name.split('/').pop() || mainModel.name,
    mainModel.ext,
    mtlText,
    blobMap
  );
  res.persistenceData = {
    mainBlob: file,
    mtlText,
    extraFiles: [],
  };
  // Preserve original zip filename & format hint for archive reopening if needed
  if (file.name.toLowerCase().endsWith('.zip')) {
    res.fileName = res.fileName || file.name;
  }
  return res;
}

/**
 * Apply bone rotations to live Three.js scene
 */
export function applyBoneRotations(
  object: THREE.Object3D,
  bones: BoneControl[]
): void {
  if (!bones || bones.length === 0) return;

  const boneMap = new Map<string, THREE.Bone>();
  object.traverse((c) => {
    if ((c as THREE.Bone).isBone) {
      boneMap.set(c.name, c as THREE.Bone);
    }
  });

  bones.forEach((b) => {
    const bone = boneMap.get(b.name);
    if (bone) {
      bone.rotation.x = THREE.MathUtils.degToRad(b.rotation.x || 0);
      bone.rotation.y = THREE.MathUtils.degToRad(b.rotation.y || 0);
      bone.rotation.z = THREE.MathUtils.degToRad(b.rotation.z || 0);
    }
  });
}

function buildLayerScene(
  object: THREE.Object3D,
  clips: THREE.AnimationClip[],
  boundingRadius: number,
  envMap: THREE.Texture | null,
  isFallback: boolean = false
): CachedLayerScene {
  const scene = new THREE.Scene();
  if (envMap) {
    scene.environment = envMap;
  }

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
  keyLight.position.set(280, 380, 380);
  keyLight.castShadow = !isSoftwareGlRenderer;
  const shadowSize = isSoftwareGlRenderer ? 512 : 1024;
  keyLight.shadow.mapSize.width = shadowSize;
  keyLight.shadow.mapSize.height = shadowSize;
  // Tight orthographic frustum around normalized ~280-unit models
  keyLight.shadow.camera.left = -220;
  keyLight.shadow.camera.right = 220;
  keyLight.shadow.camera.top = 220;
  keyLight.shadow.camera.bottom = -220;
  keyLight.shadow.camera.near = 40;
  keyLight.shadow.camera.far = 1400;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
  fillLight.position.set(-280, 140, 260);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfde68a, 0.45);
  rimLight.position.set(0, -220, -300);
  scene.add(rimLight);

  const shadowPlaneGeo = new THREE.PlaneGeometry(1400, 1400);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.34 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -boundingRadius * 0.95;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const pivot = new THREE.Group();
  pivot.add(object);
  scene.add(pivot);

  const extracted = extractBones(object);

  let mixer: THREE.AnimationMixer | undefined;
  if (clips.length > 0) {
    mixer = new THREE.AnimationMixer(object);
    mixer.clipAction(clips[0]).play();
  }

  return {
    scene,
    pivot,
    object,
    shadowPlane,
    mixer,
    activeClipIdx: 0,
    clips,
    bonesMap: extracted.bonesMap,
    boundingRadius,
    isFallback,
  };
}

/**
 * Get or initialize cached Three.js scene for a layer
 */
export function getOrCreateSceneForLayer(layer: Layer): CachedLayerScene | null {
  const modelConfig = layer.model3dConfig;
  const cacheKey = layer.id;

  const rendererBundle = getOffscreenRenderer(256, 256);
  const envMap = rendererBundle?.envMap || sharedEnvMap;

  let cached = modelSceneCache.get(cacheKey);

  // Resolve asset either directly by modelUrl or via persisted savedModelId mapping
  const resolvedUrl =
    (modelConfig?.modelUrl && modelAssetCache.has(modelConfig.modelUrl)
      ? modelConfig.modelUrl
      : modelConfig?.savedModelId
      ? modelAssetBySavedId.get(modelConfig.savedModelId)
      : undefined) || undefined;
  const asset = resolvedUrl ? modelAssetCache.get(resolvedUrl) : undefined;

  if (cached && cached.isFallback && asset) {
    modelSceneCache.delete(cacheKey);
    cached = undefined;
  }

  if (!cached) {
    let obj: THREE.Object3D;
    let clips: THREE.AnimationClip[] = [];
    let boundingRadius = 140;
    let isFallback = false;

    if (asset) {
      obj = SkeletonUtils.clone(asset.object);
      clips = asset.clips;
      boundingRadius = asset.boundingRadius;
    } else {
      isFallback = true;
      if (modelConfig?.savedModelId) {
        hydrateMissingModelFromDB(modelConfig.savedModelId);
      }
      const fallbackGroup = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(160, 160, 160),
        new THREE.MeshStandardMaterial({
          color: '#38BDF8',
          roughness: 0.3,
          metalness: 0.6,
          wireframe: true,
        })
      );
      fallbackGroup.add(box);
      obj = fallbackGroup;
    }

    cached = buildLayerScene(obj, clips, boundingRadius, envMap, isFallback);
    modelSceneCache.set(cacheKey, cached);
  } else if (envMap && !cached.scene.environment) {
    cached.scene.environment = envMap;
  }

  // Update lighting, materials, animation clip, and bones dynamically
  if (modelConfig) {
    const ambient = cached.scene.children.find((c) => c instanceof THREE.AmbientLight) as THREE.AmbientLight | undefined;
    if (ambient) ambient.intensity = modelConfig.ambientIntensity ?? 0.75;

    const dirLight = cached.scene.children.find((c) => c instanceof THREE.DirectionalLight) as THREE.DirectionalLight | undefined;
    if (dirLight) {
      dirLight.intensity = modelConfig.directionalIntensity ?? 1.55;
      dirLight.castShadow = !isSoftwareGlRenderer && modelConfig.castFloorShadow !== false;
      const angleRad = THREE.MathUtils.degToRad(modelConfig.lightAngle ?? 45);
      const elevRad = THREE.MathUtils.degToRad(modelConfig.lightElevation ?? 45);
      const dist = 500;
      dirLight.position.set(
        dist * Math.cos(angleRad) * Math.cos(elevRad),
        dist * Math.sin(elevRad),
        dist * Math.sin(angleRad) * Math.cos(elevRad)
      );
    }

    // Active animation clip selection
    if (cached.mixer && cached.clips.length > 0) {
      const targetIdx = Math.max(0, Math.min(cached.clips.length - 1, modelConfig.activeClipIndex ?? 0));
      if (cached.activeClipIdx !== targetIdx) {
        cached.mixer.stopAllAction();
        cached.mixer.clipAction(cached.clips[targetIdx]).play();
        cached.activeClipIdx = targetIdx;
      }
    }

    // Apply non-destructive PBR overrides only when explicitly modified
    cached.object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          const m = mat as THREE.MeshStandardMaterial;
          if (m && (m.isMeshStandardMaterial || (m as any).isMeshPhysicalMaterial)) {
            if (modelConfig.metallic !== undefined) {
              m.metalness = modelConfig.metallic;
            } else if (m.userData.__origMetalness !== undefined) {
              m.metalness = m.userData.__origMetalness;
            }

            if (modelConfig.roughness !== undefined) {
              m.roughness = modelConfig.roughness;
            } else if (m.userData.__origRoughness !== undefined) {
              m.roughness = m.userData.__origRoughness;
            }

            if (modelConfig.wireframe !== undefined) {
              m.wireframe = modelConfig.wireframe;
            }

            if (modelConfig.color) {
              m.color.set(modelConfig.color);
            } else if (m.userData.__origColorHex) {
              m.color.set(m.userData.__origColorHex);
            }
          }
        });
      }
    });

    if (modelConfig.bones && modelConfig.bones.length > 0) {
      applyBoneRotations(cached.object, modelConfig.bones);
    }
  }

  return cached;
}

/**
 * Register a newly uploaded 3D model into the cache for a layer
 */
export function registerModelForLayer(
  layerId: string,
  object: THREE.Object3D,
  clips: THREE.AnimationClip[] = []
): { hasBones: boolean; bones: BoneControl[] } {
  const rendererBundle = getOffscreenRenderer(256, 256);
  const envMap = rendererBundle?.envMap || sharedEnvMap;
  const built = buildLayerScene(object, clips, 140, envMap, false);
  modelSceneCache.set(layerId, built);
  const extracted = extractBones(object);
  return {
    hasBones: extracted.hasBones,
    bones: extracted.bones,
  };
}

export interface Model3DCameraSpace {
  worldX: number;
  worldY: number;
  worldZ: number;
  worldScaleX: number;
  worldScaleY: number;
  worldScaleZ: number;
  worldRotX: number;
  worldRotY: number;
  worldRotZ: number;
  camera: EvaluatedCameraState;
}

/**
 * Renders the 3D Model directly to the target canvas 2D context
 * with exact world scale, PBR studio IBL reflections, bones & animations, and full camera-space depth piercing.
 */
export function renderModel3DToCanvas(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  effMat: {
    x: number;
    y: number;
    z: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    opacity: number;
    perspectiveFactor?: number;
  },
  settings: ProjectSettings,
  currentFrame: number,
  fps: number = 30,
  orbitOverride?: {
    pitch: number;
    yaw: number;
    scale: number;
    screenX: number;
    screenY: number;
  },
  cameraSpace?: Model3DCameraSpace
): void {
  const modelData = getOrCreateSceneForLayer(layer);
  if (!modelData) return;

  const targetW = Math.max(2, Math.round(settings.width));
  const targetH = Math.max(2, Math.round(settings.height));
  const maxTexDim = isSoftwareGlRenderer ? 960 : 1280;
  const downScale = Math.min(1, maxTexDim / Math.max(targetW, targetH));
  const renderW = Math.max(2, Math.round(targetW * downScale));
  const renderH = Math.max(2, Math.round(targetH * downScale));

  const bundle = getOffscreenRenderer(renderW, renderH);
  if (!bundle) return;
  const { renderer, canvas } = bundle;

  const { scene, pivot, shadowPlane, mixer, boundingRadius } = modelData;

  // Advance embedded skeletal/morph animation clip if enabled
  if (mixer && layer.model3dConfig?.playingAnimation !== false) {
    const relFrame = Math.max(0, currentFrame - (layer.startFrame || 0));
    const timeInSec = relFrame / Math.max(1, fps);
    mixer.setTime(timeInSec * (layer.model3dConfig?.animationSpeed ?? 1.0));
  }

  const NEAR_CLIP = 4;
  let camera: THREE.PerspectiveCamera;
  let enablePierceDoubleSide = false;

  if (!orbitOverride && cameraSpace) {
    const cx = targetW * 0.5;
    const cy = targetH * 0.5;
    const cam = cameraSpace.camera;
    const use3DCam = cam.active && cam.type === '3d';
    const use2DCam = cam.active && cam.type === '2d';
    const baseFov = use3DCam ? (cam.fov || 1000) : 1000;
    const camZoom = cam.active ? Math.max(0.01, cam.zoom || 1) : 1;
    const effectiveFocal = baseFov * camZoom;

    const camPosX = cam.active ? cam.position.x - cx : 0;
    const camPosY = cam.active ? -(cam.position.y - cy) : 0;
    const camPosZ = use3DCam ? cam.position.z + baseFov : baseFov;

    const camEuler = use3DCam
      ? new THREE.Euler(
          THREE.MathUtils.degToRad(cam.rotation.x),
          THREE.MathUtils.degToRad(-cam.rotation.y),
          THREE.MathUtils.degToRad(-cam.rotation.z),
          'YXZ'
        )
      : use2DCam
      ? new THREE.Euler(0, 0, THREE.MathUtils.degToRad(-cam.rotation.z), 'YXZ')
      : new THREE.Euler(0, 0, 0, 'YXZ');

    const camQuat = new THREE.Quaternion().setFromEuler(camEuler);
    const invCamQuat = camQuat.clone().invert();

    const wx = cameraSpace.worldX - cx;
    const wy = -(cameraSpace.worldY - cy);
    const wz = cameraSpace.worldZ;

    const localPos = new THREE.Vector3(wx - camPosX, wy - camPosY, wz - camPosZ).applyQuaternion(invCamQuat);

    const itemQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(-cameraSpace.worldRotX),
        THREE.MathUtils.degToRad(cameraSpace.worldRotY),
        THREE.MathUtils.degToRad(-cameraSpace.worldRotZ),
        'YXZ'
      )
    );

    const sx = Math.max(1e-4, Math.min(1e5, cameraSpace.worldScaleX));
    const sy = Math.max(1e-4, Math.min(1e5, cameraSpace.worldScaleY));
    const sz = Math.max(1e-4, Math.min(1e5, cameraSpace.worldScaleZ || 1));

    const viewDist = -localPos.z;
    const modelRadiusWorld = Math.max(1, boundingRadius * Math.max(sx, sy, sz));

    // Model has completely pierced past camera.near behind the lens -> exit cleanly
    if (viewDist + modelRadiusWorld <= NEAR_CLIP) {
      return;
    }

    // Inside pierce proximity: enable DoubleSide so camera flying through sees interior terrain/walls cleanly
    enablePierceDoubleSide = viewDist <= modelRadiusWorld * 1.45;

    pivot.position.copy(localPos);
    pivot.quaternion.copy(invCamQuat).multiply(itemQuat);
    pivot.scale.set(sx, sy, sz);

    if (shadowPlane) {
      const showShadow =
        layer.model3dConfig?.castFloorShadow !== false && viewDist > boundingRadius * sy * 0.65 + 30;
      shadowPlane.visible = showShadow;
      if (showShadow) {
        const shadowLocal = new THREE.Vector3(
          wx - camPosX,
          wy - boundingRadius * 0.95 * sy - camPosY,
          wz - camPosZ
        ).applyQuaternion(invCamQuat);
        shadowPlane.position.copy(shadowLocal);
        shadowPlane.quaternion.copy(invCamQuat);
      }
    }

    const vFovDeg = THREE.MathUtils.radToDeg(2 * Math.atan((targetH * 0.5) / Math.max(10, effectiveFocal)));
    const farClip = Math.max(120000, Math.abs(viewDist) + modelRadiusWorld * 4 + 20000);
    camera = new THREE.PerspectiveCamera(
      Math.max(0.2, Math.min(172, vFovDeg)),
      targetW / targetH,
      NEAR_CLIP,
      farClip
    );
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
  } else {
    const posX = (orbitOverride ? orbitOverride.screenX : effMat.x) - targetW * 0.5;
    const posY = -((orbitOverride ? orbitOverride.screenY : effMat.y) - targetH * 0.5);
    pivot.position.set(posX, posY, 0);

    const layerQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(-effMat.rotationX),
        THREE.MathUtils.degToRad(effMat.rotationY),
        THREE.MathUtils.degToRad(-effMat.rotationZ),
        'YXZ'
      )
    );

    if (orbitOverride && (orbitOverride.pitch !== 0 || orbitOverride.yaw !== 0)) {
      const orbitQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(-orbitOverride.pitch),
          THREE.MathUtils.degToRad(orbitOverride.yaw),
          0,
          'YXZ'
        )
      );
      pivot.quaternion.copy(orbitQuat).multiply(layerQuat);
    } else {
      pivot.quaternion.copy(layerQuat);
    }

    const orbitScale = orbitOverride ? orbitOverride.scale : 1;
    const sx = Math.max(1e-4, Math.min(1e5, effMat.scaleX * orbitScale));
    const sy = Math.max(1e-4, Math.min(1e5, effMat.scaleY * orbitScale));
    const sz = Math.max(1e-4, Math.min(1e5, (effMat.scaleZ || 1) * orbitScale));
    pivot.scale.set(sx, sy, sz);

    if (shadowPlane) {
      const showShadow = !orbitOverride && layer.model3dConfig?.castFloorShadow !== false;
      shadowPlane.visible = showShadow;
      shadowPlane.position.set(posX, posY - boundingRadius * 0.95 * sy, 0);
      shadowPlane.quaternion.identity();
    }

    const maxExtent = boundingRadius * Math.max(sx, sy, sz);
    const camDist = Math.max(1000, maxExtent + 450);
    const vFovDeg = THREE.MathUtils.radToDeg(2 * Math.atan((targetH * 0.5) / camDist));

    camera = new THREE.PerspectiveCamera(
      Math.max(0.2, Math.min(165, vFovDeg)),
      targetW / targetH,
      10,
      camDist * 10
    );
    camera.position.set(0, 0, camDist);
    camera.lookAt(0, 0, 0);
  }

  modelData.object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m.userData.__origSide === undefined) {
          m.userData.__origSide = m.side;
        }
        const desiredSide = enablePierceDoubleSide ? THREE.DoubleSide : m.userData.__origSide;
        if (m.side !== desiredSide) {
          m.side = desiredSide;
          m.needsUpdate = true;
        }
      }
    }
  });

  renderer.clear();
  renderer.render(scene, camera);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, effMat.opacity));
  ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || 'source-over';
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  ctx.restore();
}
