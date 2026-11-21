export type Language = 'ar' | 'en';

export type LayerType = 
  | 'vector' 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'solid' 
  | 'camera' 
  | 'null' 
  | 'particle' 
  | 'audio' 
  | 'adjustment'
  | 'model3d'
  | 'group';

export type BlendMode = 
  | 'normal' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'add' 
  | 'difference' 
  | 'darken' 
  | 'lighten' 
  | 'color-dodge' 
  | 'soft-light';

export type EasingType = 
  | 'linear' 
  | 'hold' 
  | 'stepped' 
  | 'ease-in' 
  | 'ease-out' 
  | 'ease-in-out' 
  | 'bounce' 
  | 'elastic' 
  | 'spring' 
  | 'bezier' 
  | 'custom';

export interface BezierHandle {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  inTangent?: Vector2D;
  outTangent?: Vector2D;
  tangentMode?: 'auto' | 'continuous' | 'broken' | 'flat' | 'free' | 'linear';
}

export interface Keyframe<T> {
  id: string;
  frame: number;
  value: T;
  easing: EasingType;
  bezierHandle?: BezierHandle; // e.g. x1=0.25, y1=0.1, x2=0.25, y2=1.0
}

export interface AnimatableProperty<T> {
  value: T;
  keyframes: Keyframe<T>[];
  expression?: string; // e.g., "wiggle(5, 20)", "loop()", "time * 90"
  isAnimated?: boolean;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BezierPoint {
  x: number;
  y: number;
  handleIn?: Vector2D;
  handleOut?: Vector2D;
}

export type ShapeType =
  | 'circle'
  | 'rect'
  | 'polygon'
  | 'star'
  | 'bezierPath'
  | 'heart'
  | 'triangle'
  | 'plus'
  | 'cloud'
  | 'shield'
  | 'crescent'
  | 'lightning'
  | 'arrow'
  | 'flag'
  | 'drop'
  | 'speech'
  | 'ring';

export interface VectorShapeConfig {
  type: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  sides?: number; // for polygon/star
  innerRadiusRatio?: number; // for star
  pathPoints?: BezierPoint[]; // for bezier path
  width: number;
  height: number;
}

export interface TextConfig {
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  letterSpacing: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  animator?: {
    enabled: boolean;
    unit: 'character' | 'word' | 'line';
    effect: 'fade-slide' | 'scale-pop' | 'typewriter' | 'rotate-in';
    staggerFrames: number;
  };
}

export interface ParticleConfig {
  count: number;
  speed: number;
  size: number;
  sizeVariation: number;
  color: string;
  secondaryColor: string;
  spreadAngle: number;
  lifetime: number; // in frames
  gravity: number;
  wind: number;
  shape: 'circle' | 'star' | 'spark' | 'square';
}

export interface AudioConfig {
  src?: string;
  volume: number; // 0..1
  fadeInFrames?: number;
  fadeOutFrames?: number;
  muted: boolean;
  waveform?: number[];
}

export type EffectType = 
  | 'glow' 
  | 'blur' 
  | 'chromatic' 
  | 'glitch' 
  | 'bloom' 
  | 'colorGrading' 
  | 'vignette' 
  | 'wave' 
  | 'halftone' 
  | 'mirror'
  | 'tiles'
  | 'motionBlur'
  | 'oscillate'
  | 'pulse'
  | 'blink'
  | 'shake'
  | 'flip3d'
  | 'rays'
  | 'electric'
  | 'chroma'
  | 'fade'
  | 'squeeze'
  | 'findEdges'
  | 'pinchBulge'
  | 'copyBg'
  | 'curveText'
  | 'zoomBg'
  | 'motionStars'
  | 'spaceLines'
  | 'starfield'
  | (string & {});

export interface ShaderEffect {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  params: Record<string, number | string>;
}

export interface MaskConfig {
  maskLayerId: string; // Layer id to use as mask
  mode: 'alpha' | 'alpha-invert' | 'luma' | 'luma-invert';
}

export interface LayerTransform {
  position: AnimatableProperty<Vector3D>;
  scale: AnimatableProperty<Vector3D>;
  rotation: AnimatableProperty<Vector3D>; // degrees
  opacity: AnimatableProperty<number>; // 0 to 100
  anchorPoint: AnimatableProperty<Vector3D>;
}

export interface CameraConfig {
  cameraType?: '2d' | '3d';
  fov?: number; // field of view in degrees (e.g. 50 deg, default: 60)
  focalLength?: number; // in mm (e.g. 50mm)
  zoom?: number; // zoom factor (default: 1.0)
  focusDistance?: number; // in px
  aperture?: number;
}

export type Mesh3DType = 'plane' | 'cube' | 'extrusion' | 'sphere' | 'cylinder' | 'bend';

export type Mesh3DMaterial = 'chrome' | 'gold' | 'neon' | 'dark' | 'glass' | 'white' | 'custom';

export interface Mesh3DConfig {
  enabled: boolean;
  type: Mesh3DType;
  depth?: number; // 3D Extrusion depth or Cube depth (e.g. 10px .. 500px, default 60)
  bevel?: number; // Bevel radius / chamfer (e.g. 0 .. 20)
  material?: Mesh3DMaterial; // Chrome, Gold, Neon, Dark Titanium, Glossy White
  bendAngle?: number; // Bend curvature angle (-180 to 180 deg)
  bendAxis?: 'x' | 'y'; // Bend along X or Y
  roughness?: number; // 0 (shiny/mirror) to 1 (matte)
  metalness?: number; // 0 to 1
  specular?: number; // Specular highlight intensity (0 to 2)
  lightAngle?: number; // Direction of 3D light (0 to 360 deg)
  lightElevation?: number; // Light elevation (-90 to 90 deg)
  ambientIntensity?: number; // 0 to 1
  diffuseIntensity?: number; // 0 to 1
  sideColor?: string; // Custom side extrusion color
  bevelColor?: string; // Custom bevel highlight color
  castFloorShadow?: boolean; // 3D drop shadow on ground floor
  castFloorReflection?: boolean; // 3D mirror reflection on ground
  doubleSided?: boolean;
  wireframe?: boolean;
}

export type CreatureRigType = 'none' | 'biped' | 'quadruped';

export interface BoneControl {
  name: string;
  labelAr: string;
  labelEn: string;
  category: 'head' | 'spine' | 'arm_left' | 'arm_right' | 'leg_left' | 'leg_right' | 'tail' | 'other';
  rotation: { x: number; y: number; z: number }; // degrees pitch, yaw, roll
}

export interface Model3DConfig {
  savedModelId?: string;
  modelUrl?: string;
  fileName?: string;
  format?:
    | 'glb'
    | 'gltf'
    | 'vrm'
    | 'obj'
    | 'fbx'
    | 'stl'
    | 'dae'
    | 'ply'
    | '3ds'
    | '3mf'
    | 'amf'
    | 'kmz'
    | 'lwo'
    | 'usdz'
    | 'usd'
    | 'wrl'
    | 'vox'
    | 'pcd'
    | 'xyz'
    | 'zip'
    | 'builtin'
    | string;
  builtinPreset?: 'human' | 'wolf' | 'falcon' | 'mech';
  hasBones?: boolean;
  autoRigged?: boolean;
  creatureType?: CreatureRigType;
  bones?: BoneControl[];
  animationClips?: string[];
  activeClipIndex?: number;
  animationSpeed?: number;
  playingAnimation?: boolean;
  metallic?: number;
  roughness?: number;
  wireframe?: boolean;
  color?: string;
  lightAngle?: number;
  lightElevation?: number;
  ambientIntensity?: number;
  directionalIntensity?: number;
  castFloorShadow?: boolean;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  color: string; // UI label color
  startFrame: number;
  durationFrames: number;
  parentId?: string; // Null or other layer parenting
  mask?: MaskConfig;
  blendMode: BlendMode;
  
  // Transform
  transform: LayerTransform;
  
  // Camera specific configuration
  cameraConfig?: CameraConfig;

  // Node Video 3D Mesh configuration
  mesh3dConfig?: Mesh3DConfig;

  // 3D Model & Creature Rigging configuration
  model3dConfig?: Model3DConfig;

  // Layer-specific content
  vectorConfig?: VectorShapeConfig;
  textConfig?: TextConfig;
  particleConfig?: ParticleConfig;
  audioConfig?: AudioConfig;
  solidColor?: string;
  mediaUrl?: string; // For image, video
  mediaAspect?: number;
  
  // Effects stack
  effects: ShaderEffect[];
  timeScale?: number;

  // Group configuration (when type === 'group') & parent group reference
  groupId?: string;
  groupConfig?: GroupConfig;

  // Appearance extra overrides (border/shadow/glow) for property transfer compatibility
  appearanceExtras?: {
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    glowColor?: string;
    glowIntensity?: number;
    borderColor?: string;
    borderWidth?: number;
    gradientColors?: string[];
    gradientAngle?: number;
  };

  // 3D Behavior & Stabilization
  is3D?: boolean; // When false, layer is 2D fixed HUD/screen plane and never moves/twists with 3D camera
  fixedIn3D?: boolean; // When true, layer stays fixed and doesn't move or twist with 3D movement
  billboard?: boolean; // When true, layer always faces camera upright without twisting
}

export interface GroupConfig {
  collapsed?: boolean;
  icon?: 'folder' | 'layers' | 'box' | 'sparkles' | 'video' | 'music' | 'type' | 'camera' | 'star';
  color?: string;
  composite?: boolean; // Render children into offscreen group buffer before applying group effects/mask/blendMode
  clipToBounds?: boolean;
  boundsWidth?: number;
  boundsHeight?: number;
}

export interface MotionPreset {
  id: string;
  name: string;
  nameAr: string;
  category: 'entrance' | 'exit' | 'loop' | 'transition' | 'particle';
  description: string;
  apply: (layer: Layer) => Layer;
}

export interface OrbitSettings {
  pitch: number; // Elevation angle in degrees (-85 to 85)
  yaw: number; // Azimuth angle in degrees (-180 to 180)
  distance: number; // Zoom/Distance multiplier (0.4 to 3.0)
  panX: number;
  panY: number;
  fixedLayers?: boolean; // Whether layers stay fixed/billboarded in 3D movement without twisting (default: true)
  lockLayersPosition?: boolean; // When true, layers stay anchored/fixed to screen center in 3D
}

export type CameraViewMode = 'first_person' | 'third_person';

export type PreviewQuality = 'auto' | 'full' | 'medium' | 'low';

export interface ProjectSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  backgroundColor: string;
  previewQuality?: PreviewQuality;
  settingsUpdatedAt?: number;
}

export interface Project {
  id: string;
  settings: ProjectSettings;
  layers: Layer[];
  selectedLayerId: string | null;
  currentFrame: number;
  isPlaying: boolean;
  zoomLevel: number; // Viewport zoom 0.5 .. 3.0
  cameraViewMode?: CameraViewMode; // 'first_person' | 'third_person'
  orbitSettings?: OrbitSettings; // For 3rd person orbit view
  showDebugOverlay?: boolean;
  previewQuality?: PreviewQuality;
  activeTab: 'properties' | 'presets' | 'effects' | 'graph' | 'export';
  selectedPropertyPath?: string; // For graph editor e.g. "transform.position.x"
  updatedAt?: number;
  thumbnail?: string;
}

export interface FrameHistoryState {
  layers: Layer[];
  settings: ProjectSettings;
}

export interface EvaluatedTransform {
  position: Vector3D;
  scale: Vector3D;
  rotation: Vector3D;
  opacity: number;
  anchorPoint: Vector3D;
}

export interface EvaluatedCameraState {
  active: boolean;
  id?: string;
  name?: string;
  type: '2d' | '3d';
  position: Vector3D;
  rotation: Vector3D;
  zoom: number;
  fov: number;
  focalLength: number;
  focusDistance: number;
  parentChain: string[];
  worldMatrix?: number[];
  viewMatrix?: number[];
  projectionMatrix?: number[];
}

export interface EvaluatedLayerState {
  layer: Layer;
  localTransform: EvaluatedTransform;
  worldPosition: Vector3D;
  worldScale: Vector3D;
  worldRotation: Vector3D;
  worldOpacity: number;
  perspectiveFactor: number;
  parentChain: string[];
  isTransformOnly: boolean; // True for null layers or camera layers (never render pixels)
  // Projected screen bounds/affine coordinates for 1st person
  screenX: number;
  screenY: number;
  screenScaleX: number;
  screenScaleY: number;
  screenRotationZ: number;
  screenRotationX: number;
  screenRotationY: number;
  cameraDz?: number; // Signed distance in front of camera lens (>0 visible in front, <=0 behind camera)
}

export interface EvaluatedSceneState {
  frame: number;
  timeSec: number;
  fps: number;
  camera: EvaluatedCameraState;
  layers: Map<string, EvaluatedLayerState>;
  layerList: EvaluatedLayerState[];
}

// ============================================================================
// SYSTEM 01: PROJECT HISTORY & VERSION CONTROL TYPES
// ============================================================================

export type HistoryCategory =
  | 'layer'
  | 'property'
  | 'effect'
  | 'keyframe'
  | 'easing'
  | 'mask'
  | 'text'
  | 'audio'
  | 'order'
  | 'camera'
  | 'settings'
  | 'group'
  | 'restore'
  | 'collab';

export interface HistoryLayerPatch {
  op: 'add' | 'remove' | 'update' | 'reorder';
  layerId: string;
  index?: number;
  prevIndex?: number;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface HistoryDiffEntry {
  id: string;
  timestamp: number;
  category: HistoryCategory;
  labelEn: string;
  labelAr: string;
  layerId?: string;
  layerName?: string;
  batchKey?: string;
  layerPatches: HistoryLayerPatch[];
  layerOrderBefore?: string[];
  layerOrderAfter?: string[];
  settingsBefore?: Partial<ProjectSettings>;
  settingsAfter?: Partial<ProjectSettings>;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: number;
  isAuto: boolean;
  pinned: boolean;
  layerCount: number;
  durationFrames: number;
  byteSize: number;
  /** Compact serialized state where large media URLs are replaced by deduped hashes */
  dehydratedState: {
    layers: Layer[];
    settings: ProjectSettings;
  };
  mediaHashes: string[];
}

export interface LayerDiffItem {
  layerId: string;
  layerName: string;
  layerType: LayerType;
  status: 'added' | 'removed' | 'modified' | 'reordered' | 'unchanged';
  changedPaths: string[];
  keyframeChanges: number;
  effectChanges: number;
}

export interface VersionDiffSummary {
  oldVersionLabel: string;
  newVersionLabel: string;
  addedLayers: number;
  removedLayers: number;
  modifiedLayers: number;
  reorderedLayers: number;
  settingsChanges: Array<{ key: string; before: unknown; after: unknown }>;
  layerDiffs: LayerDiffItem[];
}

export type RecoveryTarget =
  | { scope: 'project' }
  | { scope: 'layer'; layerId: string }
  | { scope: 'effect'; layerId: string; effectId: string }
  | { scope: 'properties'; layerId: string; paths: Array<'transform' | 'effects' | 'mask' | 'textConfig' | 'vectorConfig' | 'audioConfig' | 'cameraConfig' | 'mesh3dConfig' | 'appearanceExtras'> };

// ============================================================================
// SYSTEM 02: ADVANCED PROPERTY COPY & PASTE TYPES
// ============================================================================

export type PropertyCategory = 'transform' | 'animation' | 'appearance' | 'effects' | 'mask';

export type PropertyTransferMode = 'replace' | 'merge';

export interface PropertyTransferSelection {
  transform: {
    positionX: boolean;
    positionY: boolean;
    positionZ: boolean;
    scaleX: boolean;
    scaleY: boolean;
    scaleZ: boolean;
    rotationX: boolean;
    rotationY: boolean;
    rotationZ: boolean;
    anchorPoint: boolean;
    opacity: boolean;
    perspective3D: boolean;
  };
  animation: {
    keyframes: boolean;
    easingCurves: boolean;
    springSettings: boolean;
    motionPaths: boolean;
    timing: boolean;
    speed: boolean;
  };
  appearance: {
    fill: boolean;
    stroke: boolean;
    gradientAndColors: boolean;
    shadowsAndGlow: boolean;
    bordersAndCorner: boolean;
    typography: boolean;
  };
  effects: {
    allEffects: boolean;
    selectedEffectIds: string[];
    effectOrder: boolean;
    effectParams: boolean;
    blendMode: boolean;
  };
  mask: {
    maskLayerAndMode: boolean;
  };
}

export interface CopiedPropertiesBundle {
  id: string;
  sourceLayerId: string;
  sourceLayerName: string;
  sourceLayerType: LayerType;
  copiedAt: number;
  selection: PropertyTransferSelection;
  payload: {
    transform?: Partial<LayerTransform>;
    mesh3dConfig?: Partial<Mesh3DConfig>;
    is3D?: boolean;
    fixedIn3D?: boolean;
    billboard?: boolean;
    timing?: { startFrame: number; durationFrames: number };
    timeScale?: number;
    appearance?: {
      solidColor?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      fontFamily?: string;
      fontSize?: number;
      letterSpacing?: number;
      lineHeight?: number;
      align?: 'left' | 'center' | 'right';
      appearanceExtras?: Layer['appearanceExtras'];
    };
    effects?: ShaderEffect[];
    blendMode?: BlendMode;
    mask?: MaskConfig;
  };
}

export interface PropertyPreset {
  id: string;
  name: string;
  nameAr?: string;
  folder: string;
  createdAt: number;
  bundle: CopiedPropertiesBundle;
}

// ============================================================================
// SYSTEM 04: FAVORITES & QUICK ACCESS TYPES
// ============================================================================

export type FavoriteItemType =
  | 'effect'
  | 'transition'
  | 'preset'
  | 'font'
  | 'shape'
  | 'sticker'
  | 'animation'
  | 'easing'
  | 'palette'
  | 'lut'
  | 'brush'
  | 'template';

export interface FavoriteItem {
  id: string;
  refId: string;
  type: FavoriteItemType;
  title: string;
  titleAr: string;
  subtitle?: string;
  folderId: string;
  pinned?: boolean;
  order: number;
  addedAt: number;
  lastUsedAt?: number;
  useCount: number;
  previewColor?: string;
  compatibleLayerTypes?: LayerType[];
  payload?: Record<string, unknown>;
}

export interface FavoriteFolder {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  order: number;
}

export interface FavoritesState {
  items: FavoriteItem[];
  folders: FavoriteFolder[];
  recentIds: string[];
  updatedAt: number;
}

// ============================================================================
// SYSTEM 05: ADVANCED PROJECT SEARCH TYPES
// ============================================================================

export type SearchEntityType =
  | 'layer'
  | 'group'
  | 'effect'
  | 'text'
  | 'font'
  | 'media'
  | 'audio'
  | 'mask'
  | 'keyframe'
  | 'preset'
  | 'missing';

export interface ProjectSearchFilters {
  entityTypes: SearchEntityType[];
  layerTypes: LayerType[];
  groupId?: string;
  effectName?: string;
  visibility?: 'all' | 'visible' | 'hidden';
  lockState?: 'all' | 'locked' | 'unlocked';
  onlyMissing?: boolean;
  minDurationFrames?: number;
  maxDurationFrames?: number;
  frameRangeStart?: number;
  frameRangeEnd?: number;
}

export interface ProjectSearchResult {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string;
  layerId?: string;
  layerName?: string;
  layerType?: LayerType;
  groupId?: string;
  effectId?: string;
  frame?: number;
  durationFrames?: number;
  isHidden?: boolean;
  isLocked?: boolean;
  isMissingAsset?: boolean;
  score: number;
  matchedTokens: string[];
}

// ============================================================================
// SYSTEM 06: COLLABORATIVE EDITING TYPES
// ============================================================================

export type CollabRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export interface CollabPermissions {
  canEditLayers: boolean;
  canDeleteLayers: boolean;
  canEditEffects: boolean;
  canEditSettings: boolean;
  canComment: boolean;
  canResolveComments: boolean;
  canApproveChanges: boolean;
  canManageTeam: boolean;
}

export interface CollabMember {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
  role: CollabRole;
  permissions: CollabPermissions;
  online: boolean;
  lastSeenAt: number;
  selectedLayerId?: string | null;
  currentFrame?: number;
}

export interface CollabCommentReply {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  mentions: string[];
  createdAt: number;
}

export interface CollabComment {
  id: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  mentions: string[];
  frame?: number;
  layerId?: string;
  layerName?: string;
  status: 'open' | 'resolved' | 'approved' | 'rejected';
  createdAt: number;
  updatedAt: number;
  replies: CollabCommentReply[];
}

export interface CollabActivityItem {
  id: string;
  actorId: string;
  actorName: string;
  actorColor: string;
  action: string;
  detail: string;
  createdAt: number;
}

export type CollabSyncStatus = 'disconnected' | 'connecting' | 'synced' | 'syncing' | 'offline_queued' | 'error';

export interface CollabOperation {
  opId: string;
  roomCode: string;
  actorId: string;
  lamport: number;
  timestamp: number;
  type:
    | 'layer:upsert'
    | 'layer:delete'
    | 'layers:replace'
    | 'settings:update'
    | 'project:sync';
  layerId?: string;
  layer?: Layer;
  layers?: Layer[];
  settings?: ProjectSettings;
  summary?: string;
}

export interface CollabWorkspaceState {
  roomCode: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  lamport: number;
  members: CollabMember[];
  comments: CollabComment[];
  activity: CollabActivityItem[];
  projectSnapshot: {
    layers: Layer[];
    settings: ProjectSettings;
  };
}

