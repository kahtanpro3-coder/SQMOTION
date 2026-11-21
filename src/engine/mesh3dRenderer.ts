import { Layer, ProjectSettings, Mesh3DConfig, Mesh3DMaterial } from '../types';
import { computeInfinitePerspective, recoverEffectiveDz, LayerWorld3DMatrix } from './interpolator';
import { renderReal3DTextToCanvas } from './text3dRenderer';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

/**
 * 3D Euler rotation around X, Y, Z axes
 */
export function rotatePoint3D(p: Point3D, rotX: number, rotY: number, rotZ: number): Point3D {
  let x = p.x;
  let y = p.y;
  let z = p.z;

  // Roll (Z)
  if (rotZ !== 0) {
    const radZ = (rotZ * Math.PI) / 180;
    const cosZ = Math.cos(radZ);
    const sinZ = Math.sin(radZ);
    const nx = x * cosZ - y * sinZ;
    const ny = x * sinZ + y * cosZ;
    x = nx;
    y = ny;
  }

  // Pitch (X)
  if (rotX !== 0) {
    const radX = (rotX * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const ny = y * cosX - z * sinX;
    const nz = y * sinX + z * cosX;
    y = ny;
    z = nz;
  }

  // Yaw (Y)
  if (rotY !== 0) {
    const radY = (rotY * Math.PI) / 180;
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);
    const nx = x * cosY + z * sinY;
    const nz = -x * sinY + z * cosY;
    x = nx;
    z = nz;
  }

  return { x, y, z };
}

/**
 * Perspective Project a 3D point to 2D Screen Space using unbounded infinite Z perspective
 */
export function project3DToScreen(
  p: Point3D,
  screenWidth: number,
  screenHeight: number,
  fov: number = 1000
): ProjectedPoint {
  const cx = screenWidth / 2;
  const cy = screenHeight / 2;

  const perspective = computeInfinitePerspective(fov, fov - p.z, 16);

  return {
    x: cx + (p.x - cx) * perspective,
    y: cy + (p.y - cy) * perspective,
    scale: perspective,
    depth: p.z,
  };
}

/**
 * Perspective Project a local 3D rotated offset around an already perspective-projected layer center
 * (originX, originY, scaleX, scaleY, perspectiveFactor), without double-applying Z perspective,
 * while computing true 1-point vanishing-center (cx, cy) parallax and unbounded infinite Z foreshortening.
 */
export function projectLocalCorner3D(
  screenCenterX: number,
  screenCenterY: number,
  worldZ: number,
  centerPersp: number,
  screenRotatedOffset: Point3D,
  vanishX: number,
  vanishY: number,
  fov: number = 1000
): ProjectedPoint {
  const safePersp = Math.max(1e-7, Number.isFinite(centerPersp) ? centerPersp : 1.0);
  const dzCenter = recoverEffectiveDz(fov, safePersp, 16);
  const basePersp = computeInfinitePerspective(fov, dzCenter, 16);
  const localDepthUnscaled = screenRotatedOffset.z / safePersp;
  const vertexPersp = computeInfinitePerspective(fov, dzCenter - localDepthUnscaled, 16);
  const rawRelPersp = vertexPersp / Math.max(1e-7, basePersp);
  const relPersp = dzCenter < 24 ? Math.max(0.08, Math.min(6, rawRelPersp)) : Math.max(0.02, Math.min(25, rawRelPersp));

  const dxCenter = screenCenterX - vanishX;
  const dyCenter = screenCenterY - vanishY;

  return {
    x: vanishX + (dxCenter + screenRotatedOffset.x) * relPersp,
    y: vanishY + (dyCenter + screenRotatedOffset.y) * relPersp,
    scale: safePersp * relPersp,
    depth: worldZ + localDepthUnscaled,
  };
}

/**
 * Legacy helper kept for direct calls: unbounded infinite Z stationary projection.
 */
export function projectStationaryPoint3D(
  originX: number,
  originY: number,
  originZ: number,
  rotated: Point3D,
  fov: number = 1000
): ProjectedPoint {
  const totalZ = originZ + rotated.z;
  const perspective = computeInfinitePerspective(fov, fov - totalZ, 16);

  return {
    x: originX + rotated.x * perspective,
    y: originY + rotated.y * perspective,
    scale: perspective,
    depth: totalZ,
  };
}

/**
 * Material color palettes & shader properties
 */
export const MATERIAL_PALETTES: Record<
  Mesh3DMaterial,
  {
    sideBase: string;
    sideDark: string;
    sideHighlight: string;
    bevelColor: string;
    specularTint: string;
    defaultSpecular: number;
    defaultRoughness: number;
  }
> = {
  chrome: {
    sideBase: '#475569',
    sideDark: '#0f172a',
    sideHighlight: '#e2e8f0',
    bevelColor: '#ffffff',
    specularTint: 'rgba(255, 255, 255, 0.95)',
    defaultSpecular: 1.2,
    defaultRoughness: 0.15,
  },
  gold: {
    sideBase: '#b45309',
    sideDark: '#451a03',
    sideHighlight: '#fde047',
    bevelColor: '#fef08a',
    specularTint: 'rgba(254, 240, 138, 0.9)',
    defaultSpecular: 1.1,
    defaultRoughness: 0.2,
  },
  neon: {
    sideBase: '#0284c7',
    sideDark: '#082f49',
    sideHighlight: '#38bdf8',
    bevelColor: '#00e676',
    specularTint: 'rgba(56, 189, 248, 0.95)',
    defaultSpecular: 1.3,
    defaultRoughness: 0.1,
  },
  dark: {
    sideBase: '#1e293b',
    sideDark: '#090d16',
    sideHighlight: '#64748b',
    bevelColor: '#94a3b8',
    specularTint: 'rgba(226, 232, 240, 0.6)',
    defaultSpecular: 0.6,
    defaultRoughness: 0.4,
  },
  glass: {
    sideBase: '#64748b',
    sideDark: '#1e293b',
    sideHighlight: '#f8fafc',
    bevelColor: '#ffffff',
    specularTint: 'rgba(255, 255, 255, 0.95)',
    defaultSpecular: 1.5,
    defaultRoughness: 0.05,
  },
  white: {
    sideBase: '#94a3b8',
    sideDark: '#334155',
    sideHighlight: '#ffffff',
    bevelColor: '#ffffff',
    specularTint: 'rgba(255, 255, 255, 0.85)',
    defaultSpecular: 0.8,
    defaultRoughness: 0.25,
  },
  custom: {
    sideBase: '#334155',
    sideDark: '#0f172a',
    sideHighlight: '#cbd5e1',
    bevelColor: '#ffffff',
    specularTint: 'rgba(255, 255, 255, 0.8)',
    defaultSpecular: 0.8,
    defaultRoughness: 0.3,
  },
};

/**
 * Compute lighting factor based on face normal, light direction, ambient and specular
 */
export function computeFaceLighting(
  normal: Point3D,
  lightAngleDeg: number = 45,
  lightElevationDeg: number = 35,
  ambient: number = 0.35,
  diffuse: number = 0.65,
  specular: number = 0.8,
  roughness: number = 0.2
): { brightness: number; specularIntensity: number; fresnel: number } {
  // Light vector in 3D
  const radAngle = (lightAngleDeg * Math.PI) / 180;
  const radElev = (lightElevationDeg * Math.PI) / 180;
  const lx = Math.cos(radAngle) * Math.cos(radElev);
  const ly = -Math.sin(radElev);
  const lz = -Math.sin(radAngle) * Math.cos(radElev);

  // Normalize light
  const lLen = Math.hypot(lx, ly, lz) || 1;
  const nlx = lx / lLen;
  const nly = ly / lLen;
  const nlz = lz / lLen;

  // Normalize normal
  const nLen = Math.hypot(normal.x, normal.y, normal.z) || 1;
  const nx = normal.x / nLen;
  const ny = normal.y / nLen;
  const nz = normal.z / nLen;

  // Dot product (Lambertian diffuse)
  const dot = Math.max(0, nx * nlx + ny * nly + nz * nlz);
  const brightness = Math.min(1.8, ambient + diffuse * dot);

  // Specular (Blinn-Phong)
  const vz = -1; // view ray pointing along -Z towards viewer
  const hx = nlx;
  const hy = nly;
  const hz = nlz + vz;
  const hLen = Math.hypot(hx, hy, hz) || 1;
  const specDot = Math.max(0, nx * (hx / hLen) + ny * (hy / hLen) + nz * (hz / hLen));
  const shininess = Math.max(4, Math.round((1 - Math.min(0.95, roughness)) * 48));
  const specularIntensity = Math.pow(specDot, shininess) * specular;

  // Fresnel rim factor (highlights on grazing edges)
  const viewDot = Math.max(0, -nz);
  const fresnel = Math.pow(1 - viewDot, 3) * 0.5;

  return { brightness, specularIntensity, fresnel };
}

/**
 * Maps a source canvas onto an arbitrary 3D perspective quad defined by a 3D projector function.
 * Uses an NxN bilinear mesh subdivision into pairs of triangles.
 * Produces authentic projective foreshortening with zero shear distortion.
 */
export function renderSubdividedPerspectiveImage(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  toScreen: (lx: number, ly: number, lz: number) => ProjectedPoint,
  zOffset: number = 0,
  gridCols: number = 8,
  gridRows: number = 8
): void {
  const colStep = sourceWidth / gridCols;
  const rowStep = sourceHeight / gridRows;

  // Pre-calculate grid vertex projected points
  const gridPts: ProjectedPoint[][] = [];
  for (let r = 0; r <= gridRows; r++) {
    const rowPts: ProjectedPoint[] = [];
    const ly = (r / gridRows - 0.5) * sourceHeight;
    for (let c = 0; c <= gridCols; c++) {
      const lx = (c / gridCols - 0.5) * sourceWidth;
      rowPts.push(toScreen(lx, ly, zOffset));
    }
    gridPts.push(rowPts);
  }

  const viewMargin = 120;
  const maxViewX = Math.max(2000, (ctx.canvas?.width || 1280) * 2) + viewMargin;
  const maxViewY = Math.max(2000, (ctx.canvas?.height || 1280) * 2) + viewMargin;

  // Render each quad as two triangles with viewport frustum culling & finite matrix guards
  for (let r = 0; r < gridRows; r++) {
    const sy0 = r * rowStep;
    const sy1 = (r + 1) * rowStep;
    const sh = sy1 - sy0;

    for (let c = 0; c < gridCols; c++) {
      const sx0 = c * colStep;
      const sx1 = (c + 1) * colStep;
      const sw = sx1 - sx0;

      const p00 = gridPts[r][c];
      const p10 = gridPts[r][c + 1];
      const p01 = gridPts[r + 1][c];
      const p11 = gridPts[r + 1][c + 1];

      if (
        !Number.isFinite(p00.x) || !Number.isFinite(p00.y) ||
        !Number.isFinite(p10.x) || !Number.isFinite(p10.y) ||
        !Number.isFinite(p01.x) || !Number.isFinite(p01.y) ||
        !Number.isFinite(p11.x) || !Number.isFinite(p11.y)
      ) {
        continue;
      }

      const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
      const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
      const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
      const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);

      if (maxX < -viewMargin || minX > maxViewX || maxY < -viewMargin || minY > maxViewY) {
        continue;
      }

      // Triangle 1: p00 -> p10 -> p01
      const a1 = (p10.x - p00.x) / sw;
      const b1 = (p10.y - p00.y) / sw;
      const c1 = (p01.x - p00.x) / sh;
      const d1 = (p01.y - p00.y) / sh;
      const e1 = p00.x - a1 * sx0 - c1 * sy0;
      const f1 = p00.y - b1 * sx0 - d1 * sy0;

      if (Number.isFinite(a1) && Number.isFinite(b1) && Number.isFinite(c1) && Number.isFinite(d1) && Number.isFinite(e1) && Number.isFinite(f1)) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.clip();
        ctx.transform(a1, b1, c1, d1, e1, f1);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();
      }

      // Triangle 2: p10 -> p11 -> p01
      const a2 = (p11.x - p01.x) / sw;
      const b2 = (p11.y - p01.y) / sw;
      const c2 = (p11.x - p10.x) / sh;
      const d2 = (p11.y - p10.y) / sh;
      const e2 = p11.x - a2 * sx1 - c2 * sy1;
      const f2 = p11.y - b2 * sx1 - d2 * sy1;

      if (Number.isFinite(a2) && Number.isFinite(b2) && Number.isFinite(c2) && Number.isFinite(d2) && Number.isFinite(e2) && Number.isFinite(f2)) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.clip();
        ctx.transform(a2, b2, c2, d2, e2, f2);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();
      }
    }
  }
}

/**
 * Render any 2D layer or canvas with authentic 3D perspective projective warping,
 * depth foreshortening, specular lighting, and 3D extruded edge thickness.
 */
export function renderReal3DPerspectivePlane(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  effWorldMat: {
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
    perspectiveOverride?: number;
  },
  anchorX: number,
  anchorY: number,
  settings: ProjectSettings,
  contentCanvas: HTMLCanvasElement,
  contentWidth: number,
  contentHeight: number,
  overrideDepth?: number
): void {
  const hasExplicitMesh = Boolean(layer.mesh3dConfig && layer.mesh3dConfig.enabled);
  const meshConfig = layer.mesh3dConfig || {
    enabled: false,
    type: 'plane',
    depth: 0,
    bevel: 0,
    material: 'chrome',
    lightAngle: 45,
    lightElevation: 35,
    ambientIntensity: 0.45,
    diffuseIntensity: 0.65,
    specular: 0.5,
    roughness: 0.25,
    castFloorShadow: false,
  };

  const matType = meshConfig.material || 'chrome';
  const palette = MATERIAL_PALETTES[matType] || MATERIAL_PALETTES.chrome;

  const rawDepth = overrideDepth !== undefined
    ? overrideDepth
    : (hasExplicitMesh ? (meshConfig.depth ?? 18) : 0);
  const depth = hasExplicitMesh ? Math.max(2, rawDepth * (effWorldMat.scaleZ || 1)) : 0;
  const halfD = depth / 2;

  const lightAngle = meshConfig.lightAngle ?? 45;
  const lightElevation = meshConfig.lightElevation ?? 35;
  const ambient = meshConfig.ambientIntensity ?? 0.55;
  const diffuse = meshConfig.diffuseIntensity ?? 0.55;
  const specular = meshConfig.specular ?? palette.defaultSpecular;
  const roughness = meshConfig.roughness ?? palette.defaultRoughness;

  const fov = Math.max(150, effWorldMat.perspectiveOverride ?? 1000);
  const vanishX = settings.width / 2;
  const vanishY = settings.height / 2;
  const centerPersp = effWorldMat.perspectiveFactor ?? computeInfinitePerspective(fov, fov - effWorldMat.z, 16);

  // Project local coordinates to screen with single-pass infinite Z perspective & vanishing-center parallax
  const toScreen = (lx: number, ly: number, lz: number): ProjectedPoint => {
    const ax = lx - anchorX;
    const ay = ly - anchorY;

    const sx = ax * effWorldMat.scaleX;
    const sy = ay * effWorldMat.scaleY;
    const sz = lz * centerPersp;

    const rotated = rotatePoint3D(
      { x: sx, y: sy, z: sz },
      effWorldMat.rotationX,
      effWorldMat.rotationY,
      effWorldMat.rotationZ
    );

    return projectLocalCorner3D(
      effWorldMat.x,
      effWorldMat.y,
      effWorldMat.z,
      centerPersp,
      rotated,
      vanishX,
      vanishY,
      fov
    );
  };

  const halfW = contentWidth / 2;
  const halfH = contentHeight / 2;

  // Compute normal for front face (+Z pointing towards camera/screen)
  const frontNormal = rotatePoint3D(
    { x: 0, y: 0, z: 1 },
    effWorldMat.rotationX,
    effWorldMat.rotationY,
    effWorldMat.rotationZ
  );

  const isFrontFacing = frontNormal.z >= -0.02;

  // 1. Draw 3D Extruded Edges (Only when 3D mesh extrusion is explicitly enabled)
  if (hasExplicitMesh && depth > 1) {
    const pTL_f = toScreen(-halfW, -halfH, halfD);
    const pTR_f = toScreen(halfW, -halfH, halfD);
    const pBR_f = toScreen(halfW, halfH, halfD);
    const pBL_f = toScreen(-halfW, halfH, halfD);

    const pTL_b = toScreen(-halfW, -halfH, -halfD);
    const pTR_b = toScreen(halfW, -halfH, -halfD);
    const pBR_b = toScreen(halfW, halfH, -halfD);
    const pBL_b = toScreen(-halfW, halfH, -halfD);

    const sideFaces = [
      // Right edge (+X)
      {
        pts: [pTR_b, pTR_f, pBR_f, pBR_b] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint],
        normal: rotatePoint3D({ x: 1, y: 0, z: 0 }, effWorldMat.rotationX, effWorldMat.rotationY, effWorldMat.rotationZ),
        color: palette.sideHighlight,
      },
      // Left edge (-X)
      {
        pts: [pTL_f, pTL_b, pBL_b, pBL_f] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint],
        normal: rotatePoint3D({ x: -1, y: 0, z: 0 }, effWorldMat.rotationX, effWorldMat.rotationY, effWorldMat.rotationZ),
        color: palette.sideBase,
      },
      // Top edge (-Y)
      {
        pts: [pTL_f, pTR_f, pTR_b, pTL_b] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint],
        normal: rotatePoint3D({ x: 0, y: -1, z: 0 }, effWorldMat.rotationX, effWorldMat.rotationY, effWorldMat.rotationZ),
        color: palette.sideHighlight,
      },
      // Bottom edge (+Y)
      {
        pts: [pBL_b, pBR_b, pBR_f, pBL_f] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint],
        normal: rotatePoint3D({ x: 0, y: 1, z: 0 }, effWorldMat.rotationX, effWorldMat.rotationY, effWorldMat.rotationZ),
        color: palette.sideDark,
      },
    ];

    // Filter to faces pointing towards the camera (tested via 2D screen cross-product area and normal.z)
    const visibleSides = sideFaces.filter((f) => {
      const p0 = f.pts[0];
      const p1 = f.pts[1];
      const p2 = f.pts[2];
      const screenArea = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
      return screenArea > 0.05 || f.normal.z >= -0.05;
    });
    visibleSides.sort((a, b) => {
      const depthA = (a.pts[0].depth + a.pts[1].depth + a.pts[2].depth + a.pts[3].depth) / 4;
      const depthB = (b.pts[0].depth + b.pts[1].depth + b.pts[2].depth + b.pts[3].depth) / 4;
      return depthB - depthA;
    });

    visibleSides.forEach((side) => {
      const { brightness, specularIntensity } = computeFaceLighting(
        side.normal,
        lightAngle,
        lightElevation,
        ambient,
        diffuse,
        specular,
        roughness
      );

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(side.pts[0].x, side.pts[0].y);
      ctx.lineTo(side.pts[1].x, side.pts[1].y);
      ctx.lineTo(side.pts[2].x, side.pts[2].y);
      ctx.lineTo(side.pts[3].x, side.pts[3].y);
      ctx.closePath();

      ctx.fillStyle = side.color;
      ctx.fill();

      // Side lighting overlay
      const shade = Math.max(0, Math.min(0.85, 1 - brightness));
      if (shade > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${shade * 0.7})`;
        ctx.fill();
      }
      if (specularIntensity > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, specularIntensity * 0.4)})`;
        ctx.fill();
      }

      ctx.strokeStyle = palette.bevelColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    });
  }

  // 2. Draw Front or Back Face with True Bilinear Perspective Subdivision
  const renderZ = isFrontFacing ? halfD : -halfD;
  const faceNormal = isFrontFacing ? frontNormal : rotatePoint3D({ x: 0, y: 0, z: -1 }, effWorldMat.rotationX, effWorldMat.rotationY, effWorldMat.rotationZ);

  const { brightness, specularIntensity } = computeFaceLighting(
    faceNormal,
    lightAngle,
    lightElevation,
    ambient,
    diffuse,
    specular,
    roughness
  );

  // 8x8 subdivision grid for butter-smooth perspective warping
  renderSubdividedPerspectiveImage(
    ctx,
    contentCanvas,
    contentWidth,
    contentHeight,
    toScreen,
    renderZ,
    8,
    8
  );

  // 3. Dynamic 3D lighting sheen & shadow on front face (only when explicit 3D mesh material is enabled)
  if (hasExplicitMesh) {
    ctx.save();
    const p0 = toScreen(-halfW, -halfH, renderZ);
    const p1 = toScreen(halfW, -halfH, renderZ);
    const p2 = toScreen(halfW, halfH, renderZ);
    const p3 = toScreen(-halfW, halfH, renderZ);

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.clip();

    if (!isFrontFacing) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fill();
    }

    // Directional diffuse shade
    if (brightness < 0.95) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(1 - brightness) * 0.4})`;
      ctx.fill();
    }

    // Directional specular gleam
    if (specularIntensity > 0.05) {
      ctx.fillStyle = palette.specularTint.replace(/[\d\.]+\)$/, `${Math.min(0.5, specularIntensity * 0.45)})`);
      ctx.fill();
    }

    // Front face beveled edge highlight
    if (isFrontFacing && (meshConfig.bevel ?? 0) > 0) {
      ctx.strokeStyle = palette.bevelColor;
      ctx.lineWidth = Math.max(0.8, (meshConfig.bevel ?? 2) * p0.scale * 0.7);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 4. Floor Shadow directly anchored under element position (single-pass Z scale via effWorldMat.scaleX)
  const floorY = settings.height * 0.9;
  if (hasExplicitMesh && (meshConfig.castFloorShadow ?? true) && effWorldMat.y < floorY) {
    const sDist = Math.max(10, floorY - effWorldMat.y);
    const shadowAlpha = Math.max(0.04, Math.min(0.35, 1 - sDist / 800));
    const shadowScale = Math.max(0.3, 1 - sDist / 1200);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      effWorldMat.x,
      floorY,
      Math.max(15, halfW * effWorldMat.scaleX * shadowScale),
      Math.max(6, halfW * effWorldMat.scaleX * 0.28 * shadowScale),
      (effWorldMat.rotationY * Math.PI) / 180,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha * (effWorldMat.opacity ?? 1)})`;
    ctx.filter = 'blur(10px)';
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Render complete Node Video / Alight Motion 3D Mesh (Extrusion, Cube, Bend, Cylinder, Sphere)
 */
export function renderNodeVideoMesh3D(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  effWorldMat: {
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
    perspectiveOverride?: number;
  },
  anchorX: number,
  anchorY: number,
  settings: ProjectSettings,
  contentCanvas: HTMLCanvasElement,
  contentWidth: number,
  contentHeight: number,
  text3DCameraSpace?: Parameters<typeof renderReal3DTextToCanvas>[6]
): void {
  const meshConfig = layer.mesh3dConfig || {
    enabled: true,
    type: 'extrusion',
    depth: 60,
    bevel: 3,
    material: 'chrome',
    lightAngle: 45,
    lightElevation: 35,
    ambientIntensity: 0.4,
    diffuseIntensity: 0.7,
    specular: 1.1,
    roughness: 0.15,
  };

  const meshType = meshConfig.type || 'extrusion';
  const rawDepth = meshConfig.depth !== undefined ? meshConfig.depth : 60;
  const depth = Math.max(4, rawDepth * (effWorldMat.scaleZ || 1));
  const halfD = depth / 2;
  const halfW = (contentWidth / 2) * effWorldMat.scaleX;
  const halfH = (contentHeight / 2) * effWorldMat.scaleY;

  const matType = meshConfig.material || 'chrome';
  const palette = MATERIAL_PALETTES[matType] || MATERIAL_PALETTES.chrome;

  const lightAngle = meshConfig.lightAngle ?? 45;
  const lightElevation = meshConfig.lightElevation ?? 35;
  const ambient = meshConfig.ambientIntensity ?? 0.4;
  const diffuse = meshConfig.diffuseIntensity ?? 0.7;
  const specular = meshConfig.specular ?? palette.defaultSpecular;
  const roughness = meshConfig.roughness ?? palette.defaultRoughness;
  const bevelRadius = meshConfig.bevel ?? 3;

  const fov = Math.max(150, effWorldMat.perspectiveOverride ?? 1000);
  const vanishX = settings.width / 2;
  const vanishY = settings.height / 2;
  const centerPersp = effWorldMat.perspectiveFactor ?? computeInfinitePerspective(fov, fov - effWorldMat.z, 16);

  // Helper to transform local 3D vertex to Screen Space with single-pass infinite Z perspective
  const toScreen = (lx: number, ly: number, lz: number): ProjectedPoint => {
    const rotated = rotatePoint3D(
      { x: lx, y: ly, z: lz * centerPersp },
      effWorldMat.rotationX,
      effWorldMat.rotationY,
      effWorldMat.rotationZ
    );

    return projectLocalCorner3D(
      effWorldMat.x,
      effWorldMat.y,
      effWorldMat.z,
      centerPersp,
      rotated,
      vanishX,
      vanishY,
      fov
    );
  };

  // ================= 0. TRUE 3D PERSPECTIVE PLANE =================
  if (meshType === 'plane') {
    renderReal3DPerspectivePlane(
      ctx,
      layer,
      effWorldMat,
      anchorX,
      anchorY,
      settings,
      contentCanvas,
      contentWidth,
      contentHeight
    );
    return;
  }

  // ================= 1. TRUE 3D EXTRUDED TEXT & MULTI-SLICE EXTRUSION =================
  if (meshType === 'extrusion' || (meshType as string) === 'text3d') {
    if (layer.type === 'text') {
      const renderedReal3D = renderReal3DTextToCanvas(
        ctx,
        layer,
        effWorldMat,
        anchorX,
        anchorY,
        settings,
        text3DCameraSpace
      );
      if (renderedReal3D) {
        return;
      }
    }

    const frontZ = halfD;
    const backZ = -halfD;

    const pFrontCenter = toScreen(0, 0, frontZ);
    const pBackCenter = toScreen(0, 0, backZ);

    const deltaX = pFrontCenter.x - pBackCenter.x;
    const deltaY = pFrontCenter.y - pBackCenter.y;
    const projectedDepthPx = Math.hypot(deltaX, deltaY);

    // Determine number of depth slices based on visual depth distance (1.2px per slice for smooth continuous metal sides)
    const numSlices = Math.max(16, Math.min(80, Math.ceil(projectedDepthPx / 1.2)));

    // Compute Face Normal for Front Cap (+Z points toward viewer)
    const frontNormal = rotatePoint3D(
      { x: 0, y: 0, z: 1 },
      effWorldMat.rotationX,
      effWorldMat.rotationY,
      effWorldMat.rotationZ
    );

    // Is the layer facing toward camera?
    const isFrontFacing = frontNormal.z >= -0.08;
    const isLookingFromBack = frontNormal.z < -0.08;

    // Lighting factors for front and sides
    const frontLighting = computeFaceLighting(
      frontNormal,
      lightAngle,
      lightElevation,
      ambient,
      diffuse,
      specular,
      roughness
    );

    const sideNormal: Point3D = {
      x: projectedDepthPx > 0.1 ? deltaX / projectedDepthPx : 0,
      y: projectedDepthPx > 0.1 ? deltaY / projectedDepthPx : 0,
      z: frontNormal.z,
    };
    const sideLighting = computeFaceLighting(
      sideNormal,
      lightAngle,
      lightElevation,
      ambient,
      diffuse,
      specular * 0.7,
      roughness + 0.1
    );

    // Order slices: If front-facing, draw from back (t=0) to front (t=1). If looking from back, draw front (t=1) to back (t=0).
    const startT = isLookingFromBack ? 1 : 0;
    const endT = isLookingFromBack ? 0 : 1;
    const step = isLookingFromBack ? -1 : 1;

    // 1. Draw Depth Slices (Extruded Sides)
    const sideBaseColor = meshConfig.sideColor || palette.sideBase;
    const sideDarkColor = palette.sideDark;
    const sideHighlightColor = palette.sideHighlight;

    for (let i = (isLookingFromBack ? numSlices : 0); isLookingFromBack ? i >= 0 : i <= numSlices; i += step) {
      const t = i / numSlices;
      const currentZ = backZ + t * (frontZ - backZ);

      // 4 corners of current slice in 3D
      const cTL = toScreen(-halfW, -halfH, currentZ);
      const cTR = toScreen(halfW, -halfH, currentZ);
      const cBR = toScreen(halfW, halfH, currentZ);
      const cBL = toScreen(-halfW, halfH, currentZ);

      const a = (cTR.x - cTL.x) / contentWidth;
      const b = (cTR.y - cTL.y) / contentWidth;
      const c = (cBL.x - cTL.x) / contentHeight;
      const d = (cBL.y - cTL.y) / contentHeight;
      const e = cTL.x;
      const f = cTL.y;

      ctx.save();
      ctx.transform(a, b, c, d, e, f);

      if (i === (isLookingFromBack ? 0 : numSlices)) {
        // FRONT CAP (or BACK CAP if flipped): Full Crisp Content with Metallic Specular Sheen & Chamfer Bevel
        ctx.drawImage(contentCanvas, 0, 0);

        // Specular Gleam Overlay (Sweep reflection across metal face)
        if (frontLighting.specularIntensity > 0.04 || frontLighting.fresnel > 0.05) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';

          // Create angled metallic reflection streak
          const sheenAngleRad = (lightAngle * Math.PI) / 180;
          const sheenCenterOffset = (effWorldMat.rotationY * 2.5 + effWorldMat.rotationX * 1.5) % contentWidth;
          const gradX0 = contentWidth * 0.5 + Math.cos(sheenAngleRad) * 150 + sheenCenterOffset;
          const gradY0 = contentHeight * 0.5 - Math.sin(sheenAngleRad) * 150;
          const gradX1 = contentWidth * 0.5 - Math.cos(sheenAngleRad) * 150 + sheenCenterOffset;
          const gradY1 = contentHeight * 0.5 + Math.sin(sheenAngleRad) * 150;

          const metalGrad = ctx.createLinearGradient(gradX0, gradY0, gradX1, gradY1);
          const sheenAlpha = Math.min(0.85, (frontLighting.specularIntensity + frontLighting.fresnel) * 0.8);
          metalGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          metalGrad.addColorStop(0.35, `rgba(255, 255, 255, ${sheenAlpha * 0.2})`);
          metalGrad.addColorStop(0.5, palette.specularTint.replace(/[\d\.]+\)$/, `${sheenAlpha})`));
          metalGrad.addColorStop(0.65, `rgba(255, 255, 255, ${sheenAlpha * 0.3})`);
          metalGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = metalGrad;
          ctx.fillRect(0, 0, contentWidth, contentHeight);

          // Ambient depth tone
          if (frontLighting.brightness < 0.95) {
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.6, 1 - frontLighting.brightness)})`;
            ctx.fillRect(0, 0, contentWidth, contentHeight);
          }

          ctx.restore();
        }

        // Beveled Chamfer Edge Highlight
        if (bevelRadius > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.strokeStyle = meshConfig.bevelColor || palette.bevelColor;
          ctx.lineWidth = bevelRadius;
          ctx.globalAlpha = Math.min(0.9, 0.4 + frontLighting.specularIntensity * 0.5);
          ctx.strokeRect(0, 0, contentWidth, contentHeight);
          ctx.restore();
        }
      } else {
        // SIDE DEPTH SLICE: Metallic shaded depth layer
        ctx.drawImage(contentCanvas, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';

        // Gradient lighting along depth (contact shadow at back t=0, brighter near front t=1)
        const depthShade = (1 - t) * 0.65; // Back is darker
        const sideLightFactor = Math.max(0.2, Math.min(1.4, sideLighting.brightness * (0.6 + t * 0.5)));

        ctx.fillStyle = sideDarkColor;
        ctx.fillRect(0, 0, contentWidth, contentHeight);

        // Metallic reflection on side
        const sideGrad = ctx.createLinearGradient(0, 0, contentWidth, contentHeight);
        sideGrad.addColorStop(0, sideBaseColor);
        sideGrad.addColorStop(0.5, sideHighlightColor);
        sideGrad.addColorStop(1, sideDarkColor);

        ctx.globalAlpha = Math.min(0.9, 0.45 + depthShade);
        ctx.fillStyle = sideGrad;
        ctx.fillRect(0, 0, contentWidth, contentHeight);

        // Dark ambient occlusion at back
        if (t < 0.8) {
          ctx.globalAlpha = (1 - t) * 0.75;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, contentWidth, contentHeight);
        }

        ctx.restore();
      }

      ctx.restore();
    }

    return;
  }

  // Helper to draw a textured or shaded quadrilateral face
  const drawFace = (
    pts: [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint],
    normal: Point3D,
    isFront: boolean = false,
    faceColor?: string
  ) => {
    const rotNorm = rotatePoint3D(
      normal,
      effWorldMat.rotationX,
      effWorldMat.rotationY,
      effWorldMat.rotationZ
    );

    // Backface culling
    if (!meshConfig.doubleSided && rotNorm.z > 0.05 && !isFront) {
      return;
    }

    const { brightness, specularIntensity } = computeFaceLighting(
      rotNorm,
      lightAngle,
      lightElevation,
      ambient,
      diffuse,
      specular,
      roughness
    );

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();

    if (isFront) {
      // Front face
      ctx.save();
      ctx.clip();

      const a = (pts[1].x - pts[0].x) / contentWidth;
      const b = (pts[1].y - pts[0].y) / contentWidth;
      const c = (pts[3].x - pts[0].x) / contentHeight;
      const d = (pts[3].y - pts[0].y) / contentHeight;
      const e = pts[0].x;
      const f = pts[0].y;

      ctx.transform(a, b, c, d, e, f);
      ctx.drawImage(contentCanvas, 0, 0);

      // Specular highlight sheen overlay
      if (specularIntensity > 0.05) {
        ctx.fillStyle = palette.specularTint.replace(/[\d\.]+\)$/, `${Math.min(0.85, specularIntensity)})`);
        ctx.fillRect(0, 0, contentWidth, contentHeight);
      }

      ctx.restore();
    } else {
      // Side / Back Face
      const baseColor = faceColor || (layer.solidColor || palette.sideBase);
      ctx.fillStyle = baseColor;
      ctx.fill();

      // Light & Shadow Shade Overlay
      const shadeAlpha = Math.max(0, Math.min(0.85, 1 - brightness));
      const lightAlpha = Math.max(0, Math.min(0.8, brightness - 1));

      if (shadeAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${shadeAlpha})`;
        ctx.fill();
      }
      if (lightAlpha > 0 || specularIntensity > 0.05) {
        ctx.fillStyle = palette.specularTint.replace(/[\d\.]+\)$/, `${Math.min(0.75, lightAlpha + specularIntensity)})`);
        ctx.fill();
      }
    }

    // Beveled Face Border
    if (bevelRadius > 0) {
      ctx.strokeStyle = meshConfig.bevelColor || palette.bevelColor;
      ctx.lineWidth = Math.max(1, bevelRadius * pts[0].scale);
      ctx.stroke();
    }

    ctx.restore();
  };

  // ================= 2. 3D CUBE MESH =================
  if (meshType === 'cube') {
    const cSize = Math.max(halfW, halfH);
    const d = depth || cSize * 2;
    const hD = d / 2;

    const p0 = toScreen(-halfW, -halfH, -hD);
    const p1 = toScreen(halfW, -halfH, -hD);
    const p2 = toScreen(halfW, halfH, -hD);
    const p3 = toScreen(-halfW, halfH, -hD);

    const p4 = toScreen(-halfW, -halfH, hD);
    const p5 = toScreen(halfW, -halfH, hD);
    const p6 = toScreen(halfW, halfH, hD);
    const p7 = toScreen(-halfW, halfH, hD);

    const faces = [
      { pts: [p0, p1, p2, p3] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint], normal: { x: 0, y: 0, z: -1 }, isFront: true },
      { pts: [p5, p4, p7, p6] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint], normal: { x: 0, y: 0, z: 1 }, isFront: false, color: palette.sideDark },
      { pts: [p4, p5, p1, p0] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint], normal: { x: 0, y: -1, z: 0 }, isFront: false, color: palette.sideHighlight },
      { pts: [p3, p2, p6, p7] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint], normal: { x: 0, y: 1, z: 0 }, isFront: false, color: palette.sideDark },
      { pts: [p4, p0, p3, p7] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint], normal: { x: -1, y: 0, z: 0 }, isFront: false, color: palette.sideBase },
      { pts: [p1, p5, p6, p2] as [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint], normal: { x: 1, y: 0, z: 0 }, isFront: false, color: palette.sideHighlight },
    ];

    faces.sort((a, b) => {
      const avgA = (a.pts[0].depth + a.pts[1].depth + a.pts[2].depth + a.pts[3].depth) / 4;
      const avgB = (b.pts[0].depth + b.pts[1].depth + b.pts[2].depth + b.pts[3].depth) / 4;
      return avgB - avgA;
    });

    faces.forEach((f) => drawFace(f.pts, f.normal, f.isFront, f.color));
    return;
  }

  // ================= 3. 3D BEND / CURVED SCREEN =================
  if (meshType === 'bend') {
    const numSlices = 24;
    const bendAngle = (meshConfig.bendAngle ?? 50) * (Math.PI / 180);
    const radius = contentWidth / Math.max(0.1, Math.abs(bendAngle));

    const sliceW = contentWidth / numSlices;
    const slices: Array<{
      pts: [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint];
      sourceX: number;
      sourceW: number;
      depth: number;
      normal: Point3D;
    }> = [];

    for (let i = 0; i < numSlices; i++) {
      const u0 = (i / numSlices) - 0.5;
      const u1 = ((i + 1) / numSlices) - 0.5;

      const a0 = u0 * bendAngle;
      const a1 = u1 * bendAngle;

      const lx0 = Math.sin(a0) * radius;
      const lz0 = (1 - Math.cos(a0)) * radius * Math.sign(bendAngle || 1);

      const lx1 = Math.sin(a1) * radius;
      const lz1 = (1 - Math.cos(a1)) * radius * Math.sign(bendAngle || 1);

      const pTL = toScreen(lx0, -halfH, lz0);
      const pTR = toScreen(lx1, -halfH, lz1);
      const pBR = toScreen(lx1, halfH, lz1);
      const pBL = toScreen(lx0, halfH, lz0);

      const midAngle = (a0 + a1) / 2;
      const normal: Point3D = {
        x: -Math.sin(midAngle),
        y: 0,
        z: -Math.cos(midAngle),
      };

      slices.push({
        pts: [pTL, pTR, pBR, pBL],
        sourceX: i * sliceW,
        sourceW: sliceW,
        depth: (pTL.depth + pTR.depth + pBR.depth + pBL.depth) / 4,
        normal,
      });
    }

    slices.sort((a, b) => b.depth - a.depth);

    slices.forEach((s) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      ctx.lineTo(s.pts[1].x, s.pts[1].y);
      ctx.lineTo(s.pts[2].x, s.pts[2].y);
      ctx.lineTo(s.pts[3].x, s.pts[3].y);
      ctx.closePath();
      ctx.clip();

      const a = (s.pts[1].x - s.pts[0].x) / s.sourceW;
      const b = (s.pts[1].y - s.pts[0].y) / s.sourceW;
      const c = (s.pts[3].x - s.pts[0].x) / contentHeight;
      const d = (s.pts[3].y - s.pts[0].y) / contentHeight;
      const e = s.pts[0].x - s.sourceX * a;
      const f = s.pts[0].y - s.sourceX * b;

      ctx.transform(a, b, c, d, e, f);
      ctx.drawImage(contentCanvas, 0, 0);

      const rotNorm = rotatePoint3D(s.normal, effWorldMat.rotationX, effWorldMat.rotationY, effWorldMat.rotationZ);
      const { brightness, specularIntensity } = computeFaceLighting(rotNorm, lightAngle, lightElevation, ambient, diffuse, specular, roughness);

      if (brightness < 1) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.6, 1 - brightness)})`;
        ctx.fillRect(s.sourceX, 0, s.sourceW, contentHeight);
      }
      if (specularIntensity > 0.05) {
        ctx.fillStyle = palette.specularTint.replace(/[\d\.]+\)$/, `${Math.min(0.6, specularIntensity)})`);
        ctx.fillRect(s.sourceX, 0, s.sourceW, contentHeight);
      }

      ctx.restore();
    });
    return;
  }

  // ================= 4. 3D PLANE (DEFAULT) =================
  const p0 = toScreen(-halfW, -halfH, 0);
  const p1 = toScreen(halfW, -halfH, 0);
  const p2 = toScreen(halfW, halfH, 0);
  const p3 = toScreen(-halfW, halfH, 0);
  drawFace([p0, p1, p2, p3], { x: 0, y: 0, z: -1 }, true);
}

/**
 * Render Ground Floor Shadow and Mirror Reflection in 3D Space
 */
export function renderNodeVideoFloorFX(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  effWorldMat: {
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
  contentCanvas: HTMLCanvasElement,
  contentWidth: number,
  contentHeight: number
): void {
  const meshConfig = layer.mesh3dConfig;
  if (!meshConfig) return;

  const floorY = settings.height * 0.82;
  const shadowDist = Math.max(10, floorY - effWorldMat.y);
  const halfW = (contentWidth / 2) * effWorldMat.scaleX;
  const halfH = (contentHeight / 2) * effWorldMat.scaleY;

  const isReal3DText =
    layer.type === 'text' &&
    meshConfig.enabled &&
    (meshConfig.type === 'extrusion' || (meshConfig.type as string) === 'text3d');

  // 1. 3D Floor Shadow (Real 3D text already renders its own WebGL ShadowMaterial floor shadow)
  if (!isReal3DText && meshConfig.castFloorShadow && effWorldMat.y < floorY) {
    const shadowScale = Math.max(0.2, 1 - shadowDist / 800);
    const shadowAlpha = Math.max(0.05, 0.45 * (1 - shadowDist / 600) * effWorldMat.opacity);
    const zScale = effWorldMat.perspectiveFactor || computeInfinitePerspective(1000, 1000 - effWorldMat.z, 220);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      effWorldMat.x,
      settings.height / 2 + (floorY - settings.height / 2) * zScale,
      Math.max(15, halfW * shadowScale),
      Math.max(6, halfW * 0.28 * shadowScale),
      (effWorldMat.rotationY * Math.PI) / 180,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.filter = 'blur(10px)';
    ctx.fill();
    ctx.restore();
  }

  // 2. 3D Floor Mirror Reflection
  if (meshConfig.castFloorReflection && effWorldMat.y < floorY) {
    const zScale = effWorldMat.perspectiveFactor || computeInfinitePerspective(1000, 1000 - effWorldMat.z, 220);
    const reflectionScreenY = effWorldMat.y + Math.max(0, (floorY - effWorldMat.y) * 2);

    ctx.save();
    ctx.globalAlpha = 0.25 * effWorldMat.opacity;
    ctx.translate(effWorldMat.x, reflectionScreenY);
    ctx.scale(effWorldMat.scaleX, -effWorldMat.scaleY * 0.85);
    ctx.rotate((-effWorldMat.rotationZ * Math.PI) / 180);

    // Draw flipped content
    ctx.drawImage(contentCanvas, -contentWidth / 2, -contentHeight / 2);

    // Gradient fade towards bottom of reflection
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createLinearGradient(0, -contentHeight / 2, 0, contentHeight / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(-contentWidth / 2, -contentHeight / 2, contentWidth, contentHeight);

    ctx.restore();
  }
}

/**
 * Projects a layer-local coordinate `(lx, ly)` to Canvas screen space matching EngineRenderer's transform pipeline.
 */
export function projectLayerLocalToScreen(
  lx: number,
  ly: number,
  worldMat: LayerWorld3DMatrix,
  anchorX: number,
  anchorY: number,
  settings: ProjectSettings
): { x: number; y: number } {
  const has3D = Math.abs(worldMat.rotationX || 0) > 0.05 || Math.abs(worldMat.rotationY || 0) > 0.05;
  const sx = (lx - anchorX) * worldMat.scaleX;
  const sy = (ly - anchorY) * worldMat.scaleY;

  if (has3D) {
    const rotated = rotatePoint3D(
      { x: sx, y: sy, z: 0 },
      worldMat.rotationX || 0,
      worldMat.rotationY || 0,
      worldMat.rotationZ || 0
    );
    return projectLocalCorner3D(
      worldMat.x,
      worldMat.y,
      worldMat.z,
      worldMat.perspectiveFactor || 1,
      rotated,
      settings.width / 2,
      settings.height / 2,
      1000
    );
  }

  const rotRad = ((worldMat.rotationZ || 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  return {
    x: worldMat.x + (sx * cosR - sy * sinR),
    y: worldMat.y + (sx * sinR + sy * cosR),
  };
}

/**
 * Converts a Canvas screen coordinate `(mx, my)` into layer-local coordinates `(lx, ly)`
 * by inverting rotation, scale, perspective (via local Jacobian in 3D), and anchorPoint.
 */
export function unprojectScreenToLayerLocal(
  mx: number,
  my: number,
  worldMat: LayerWorld3DMatrix,
  anchorX: number,
  anchorY: number,
  settings: ProjectSettings
): { x: number; y: number } {
  const has3D = Math.abs(worldMat.rotationX || 0) > 0.05 || Math.abs(worldMat.rotationY || 0) > 0.05;
  if (!has3D) {
    const rotRad = ((worldMat.rotationZ || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const dx = mx - worldMat.x;
    const dy = my - worldMat.y;
    const unrotX = dx * cosR + dy * sinR;
    const unrotY = -dx * sinR + dy * cosR;
    return {
      x: unrotX / (worldMat.scaleX || 1) + anchorX,
      y: unrotY / (worldMat.scaleY || 1) + anchorY,
    };
  }

  // Numerical 2D Newton-Raphson inversion against projectLayerLocalToScreen for arbitrary 3D tilt
  let lx = anchorX;
  let ly = anchorY;
  for (let iter = 0; iter < 6; iter++) {
    const p0 = projectLayerLocalToScreen(lx, ly, worldMat, anchorX, anchorY, settings);
    const errX = mx - p0.x;
    const errY = my - p0.y;
    if (Math.abs(errX) + Math.abs(errY) < 0.05) break;

    const px = projectLayerLocalToScreen(lx + 1, ly, worldMat, anchorX, anchorY, settings);
    const py = projectLayerLocalToScreen(lx, ly + 1, worldMat, anchorX, anchorY, settings);
    const j00 = px.x - p0.x;
    const j10 = px.y - p0.y;
    const j01 = py.x - p0.x;
    const j11 = py.y - p0.y;
    const det = j00 * j11 - j01 * j10;
    if (Math.abs(det) < 1e-6) break;

    lx += (j11 * errX - j01 * errY) / det;
    ly += (-j10 * errX + j00 * errY) / det;
  }
  return { x: lx, y: ly };
}
