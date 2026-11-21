import type {
  AnimatableProperty,
  Keyframe,
  Layer,
  Project,
  ProjectSettings,
} from '../types';

function scaleKeyframes<T>(keyframes: Keyframe<T>[] | undefined, ratio: number): Keyframe<T>[] {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return keyframes || [];
  return keyframes
    .map((kf) => ({
      ...kf,
      frame: Math.max(0, Math.round((kf.frame || 0) * ratio)),
    }))
    .sort((a, b) => a.frame - b.frame);
}

function scaleAnimatableProp<T>(
  prop: AnimatableProperty<T>,
  ratio: number
): AnimatableProperty<T> {
  if (!prop) return prop;
  return {
    ...prop,
    keyframes: scaleKeyframes(prop.keyframes, ratio),
  };
}

/**
 * Proportionally rescales all frame-indexed properties across every layer
 * so real-world timing in seconds stays identical when changing FPS.
 */
export function retimeLayersForFps(
  layers: Layer[],
  oldFps: number,
  newFps: number
): Layer[] {
  const safeOldFps = Math.max(1, Number(oldFps) || 60);
  const safeNewFps = Math.max(1, Number(newFps) || 60);
  if (safeOldFps === safeNewFps) return layers;

  const ratio = safeNewFps / safeOldFps;
  const invRatio = safeOldFps / safeNewFps;

  return layers.map((layer) => {
    const nextStartFrame = Math.max(0, Math.round((layer.startFrame || 0) * ratio));
    const nextDurationFrames = Math.max(1, Math.round((layer.durationFrames || 1) * ratio));

    const nextTransform = layer.transform
      ? {
          position: scaleAnimatableProp(layer.transform.position, ratio),
          scale: scaleAnimatableProp(layer.transform.scale, ratio),
          rotation: scaleAnimatableProp(layer.transform.rotation, ratio),
          opacity: scaleAnimatableProp(layer.transform.opacity, ratio),
          anchorPoint: scaleAnimatableProp(layer.transform.anchorPoint, ratio),
        }
      : layer.transform;

    const nextTextConfig =
      layer.textConfig && layer.textConfig.animator
        ? {
            ...layer.textConfig,
            animator: {
              ...layer.textConfig.animator,
              staggerFrames: Math.max(
                1,
                Math.round((layer.textConfig.animator.staggerFrames || 2) * ratio)
              ),
            },
          }
        : layer.textConfig;

    const nextParticleConfig = layer.particleConfig
      ? {
          ...layer.particleConfig,
          lifetime: Math.max(1, Math.round((layer.particleConfig.lifetime || 60) * ratio)),
          speed: (layer.particleConfig.speed || 0) * invRatio,
          gravity: (layer.particleConfig.gravity || 0) * invRatio,
          wind: (layer.particleConfig.wind || 0) * invRatio,
        }
      : layer.particleConfig;

    const nextAudioConfig = layer.audioConfig
      ? {
          ...layer.audioConfig,
          fadeInFrames:
            typeof layer.audioConfig.fadeInFrames === 'number'
              ? Math.max(0, Math.round(layer.audioConfig.fadeInFrames * ratio))
              : layer.audioConfig.fadeInFrames,
          fadeOutFrames:
            typeof layer.audioConfig.fadeOutFrames === 'number'
              ? Math.max(0, Math.round(layer.audioConfig.fadeOutFrames * ratio))
              : layer.audioConfig.fadeOutFrames,
        }
      : layer.audioConfig;

    return {
      ...layer,
      startFrame: nextStartFrame,
      durationFrames: nextDurationFrames,
      transform: nextTransform,
      textConfig: nextTextConfig,
      particleConfig: nextParticleConfig,
      audioConfig: nextAudioConfig,
    };
  });
}

/**
 * Updates project FPS while preserving exact total duration in seconds,
 * playhead position in seconds, and every layer/keyframe timing.
 */
export function retimeProjectForFps(
  project: Project,
  nextFps: number,
  nextSettingsPartial?: Partial<ProjectSettings>
): Project {
  const safeOldFps = Math.max(1, Number(project.settings.fps) || 60);
  const safeNewFps = Math.max(1, Number(nextFps) || safeOldFps);

  const mergedSettings: ProjectSettings = {
    ...project.settings,
    ...nextSettingsPartial,
    fps: safeNewFps,
  };

  if (safeNewFps === safeOldFps) {
    return {
      ...project,
      settings: mergedSettings,
    };
  }

  const ratio = safeNewFps / safeOldFps;
  const baseDurationFrames = Math.max(1, Number(project.settings.durationFrames) || 90);
  const nextDurationFrames = Math.max(1, Math.round(baseDurationFrames * ratio));
  const nextCurrentFrame = Math.min(
    nextDurationFrames - 1,
    Math.max(0, Math.round((project.currentFrame || 0) * ratio))
  );

  return {
    ...project,
    settings: {
      ...mergedSettings,
      durationFrames: nextDurationFrames,
    },
    currentFrame: nextCurrentFrame,
    layers: retimeLayersForFps(project.layers, safeOldFps, safeNewFps),
  };
}
