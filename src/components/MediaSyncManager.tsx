import React, { useEffect, useRef } from 'react';
import { Project } from '../types';

interface MediaSyncManagerProps {
  project: Project;
}

interface AudioTrackStatus {
  isPlaying: boolean;
  isStartingPlay: boolean;
  lastSeekTime: number;
  src: string;
}

const MediaSyncManagerBase: React.FC<MediaSyncManagerProps> = ({ project }) => {
  const audioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const statusMapRef = useRef<Map<string, AudioTrackStatus>>(new Map());

  useEffect(() => {
    const { layers, currentFrame, isPlaying, settings } = project;
    const currentAudioMap = audioMapRef.current;
    if (
      currentAudioMap.size === 0 &&
      !layers.some((l) => l.type === 'audio' && l.audioConfig?.src && l.visible)
    ) {
      return;
    }
    const currentStatusMap = statusMapRef.current;
    const fps = settings.fps || 30;
    const now = performance.now();

    // Only standalone 'audio' layers are managed here.
    // 'video' layers play their own native muxed audio directly on their <video> element in EngineRenderer
    // to prevent double-decoding, A/V desync, stuttering, and echoing.
    const activeMediaLayers = layers.filter(
      (l) => l.type === 'audio' && l.audioConfig?.src && l.visible
    );

    const activeLayerIds = new Set(activeMediaLayers.map((l) => l.id));

    // Pause & clean up elements for deleted or hidden layers
    currentAudioMap.forEach((audio, id) => {
      if (!activeLayerIds.has(id)) {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch (e) {}
        currentAudioMap.delete(id);
        currentStatusMap.delete(id);
      }
    });

    // Process active audio layers
    activeMediaLayers.forEach((layer) => {
      const src = layer.audioConfig?.src;
      if (!src) return;

      let audio = currentAudioMap.get(layer.id);
      let status = currentStatusMap.get(layer.id);

      if (!status) {
        status = { isPlaying: false, isStartingPlay: false, lastSeekTime: 0, src };
        currentStatusMap.set(layer.id, status);
      }

      if (!audio) {
        audio = new Audio();
        audio.preload = 'auto';
        if (src.startsWith('http://') || src.startsWith('https://')) {
          audio.crossOrigin = 'anonymous';
        }
        audio.src = src;
        audio.load();
        status.src = src;
        currentAudioMap.set(layer.id, audio);
      } else if (status.src !== src) {
        status.isPlaying = false;
        status.isStartingPlay = false;
        status.lastSeekTime = 0;
        status.src = src;
        audio.pause();
        audio.src = src;
        audio.load();
      }

      // Check volume & mute config
      const isMuted = layer.audioConfig?.muted ?? false;
      const volume = layer.audioConfig?.volume ?? 1;
      audio.muted = isMuted;
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));

      // Calculate frame bounds
      const layerDuration = layer.durationFrames ?? (settings.durationFrames || 90);
      const isActiveFrame =
        currentFrame >= layer.startFrame &&
        currentFrame < layer.startFrame + layerDuration;

      const relFrame = Math.max(0, currentFrame - layer.startFrame);
      const targetTime = relFrame / fps;
      const mediaDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity;
      const isPastMediaEnd = mediaDur < Infinity && targetTime >= mediaDur - 0.02;
      const clampedTarget = mediaDur < Infinity
        ? Math.max(0, Math.min(targetTime, Math.max(0, mediaDur - 0.03)))
        : Math.max(0, targetTime);

      if (isPlaying) {
        if (isActiveFrame && !isPastMediaEnd) {
          if (audio.paused) {
            // Never spam play() or reset currentTime while a play() Promise is still pending
            if (status.isStartingPlay) return;

            if (
              !audio.seeking &&
              audio.readyState >= 1 &&
              Math.abs(audio.currentTime - clampedTarget) > 0.15 &&
              now - status.lastSeekTime > 350
            ) {
              try {
                status.lastSeekTime = now;
                audio.currentTime = clampedTarget;
              } catch (e) {}
            }

            status.isStartingPlay = true;
            status.isPlaying = true;
            audio
              .play()
              .then(() => {
                if (status) {
                  status.isStartingPlay = false;
                  status.isPlaying = true;
                }
              })
              .catch(() => {
                if (status) {
                  status.isStartingPlay = false;
                  status.isPlaying = false;
                }
              });
          } else {
            // Already playing smoothly: only resync on major jump/loop (e.g. loop wrap or >0.65s drift) with cooldown
            const drift = Math.abs(audio.currentTime - clampedTarget);
            const isLoopWrap = clampedTarget < 0.2 && audio.currentTime > clampedTarget + 0.4;
            if (
              !audio.seeking &&
              !status.isStartingPlay &&
              (isLoopWrap || (drift > 0.65 && now - status.lastSeekTime > 750))
            ) {
              try {
                status.lastSeekTime = now;
                audio.currentTime = clampedTarget;
              } catch (e) {}
            }
          }
        } else {
          // Layer is outside its active frames or reached end of audio file
          if (!audio.paused) {
            try {
              audio.pause();
            } catch (e) {}
          }
          status.isPlaying = false;
          status.isStartingPlay = false;
        }
      } else {
        // Paused or timeline scrubbing mode
        if (!audio.paused) {
          try {
            audio.pause();
          } catch (e) {}
        }
        status.isPlaying = false;
        status.isStartingPlay = false;

        if (isActiveFrame && !isPastMediaEnd) {
          const drift = Math.abs(audio.currentTime - clampedTarget);
          if (drift > 0.08 && !audio.seeking && audio.readyState >= 1 && now - status.lastSeekTime > 80) {
            try {
              status.lastSeekTime = now;
              audio.currentTime = clampedTarget;
            } catch (e) {}
          }
        }
      }
    });
  }, [project.layers, project.currentFrame, project.isPlaying, project.settings.fps, project.settings.durationFrames]);

  // Clean up all audio nodes on unmount
  useEffect(() => {
    return () => {
      const currentAudioMap = audioMapRef.current;
      currentAudioMap.forEach((audio) => {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch (e) {}
      });
      currentAudioMap.clear();
      statusMapRef.current.clear();
    };
  }, []);

  return null;
};

export const MediaSyncManager = React.memo(MediaSyncManagerBase);

