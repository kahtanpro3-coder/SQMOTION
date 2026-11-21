import { Project } from '../types';
import { EngineRenderer } from './renderer';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { encodeAnimatedGif } from './gifEncoder';

export interface ExportOptions {
  format?: 'mp4' | 'webm' | 'gif';
  quality?: 'high' | 'standard' | 'low';
  fps?: number;
  width?: number;
  height?: number;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  format: 'mp4' | 'webm' | 'gif';
  filename: string;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Export cancelled by user', 'AbortError');
  }
}

function sanitizeBaseName(name?: string): string {
  const cleaned = (name || 'SQMotion_Project')
    .trim()
    .toLowerCase()
    .replace(/[\s/\\?%*:|"<>]+/g, '_');
  return cleaned || 'sqmotion_project';
}

function isTransparentColor(bg?: string): boolean {
  return (
    bg === 'transparent' ||
    bg === '#00000000' ||
    bg === 'rgba(0,0,0,0)' ||
    /^#[0-9a-f]{6}00$/i.test(bg || '')
  );
}

function drawFittedFrame(
  projCanvas: HTMLCanvasElement,
  exportCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  origWidth: number,
  origHeight: number,
  backgroundColor: string | undefined,
  allowAlpha: boolean
) {
  exportCtx.clearRect(0, 0, width, height);
  const bgTransparent = isTransparentColor(backgroundColor);
  if (!bgTransparent || !allowAlpha) {
    exportCtx.fillStyle = bgTransparent ? '#000000' : backgroundColor || '#000000';
    exportCtx.fillRect(0, 0, width, height);
  }

  const scale = Math.min(width / origWidth, height / origHeight);
  const drawW = Math.round(origWidth * scale);
  const drawH = Math.round(origHeight * scale);
  const offsetX = Math.round((width - drawW) / 2);
  const offsetY = Math.round((height - drawH) / 2);

  exportCtx.drawImage(projCanvas, offsetX, offsetY, drawW, drawH);
}

/**
 * Find the best supported H.264 AVC encoder configuration via WebCodecs.
 */
async function selectSupportedAvcConfig(
  width: number,
  height: number,
  bitrate: number,
  framerate: number
): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') {
    return null;
  }

  const pixelsPerSec = width * height * framerate;
  // Level 5.2 (0x34) for 4K/120fps, 5.1 (0x33) for 1440p/4K, 5.0 (0x32), 4.2 (0x2a) for 1080p60, 4.0 (0x28), 3.1 (0x1f)
  const codecsHighRateFirst = [
    'avc1.640034', // High Profile L5.2
    'avc1.4d0034', // Main Profile L5.2
    'avc1.640033', // High Profile L5.1
    'avc1.4d0033', // Main Profile L5.1
    'avc1.640032', // High Profile L5.0
    'avc1.4d0032', // Main Profile L5.0
    'avc1.64002a', // High Profile L4.2
    'avc1.4d002a', // Main Profile L4.2
    'avc1.42002a', // Baseline L4.2
    'avc1.640028', // High Profile L4.0
    'avc1.42001f', // Baseline L3.1
    'avc1.42001e', // Baseline L3.0
  ];

  const codecsStandardFirst = [
    'avc1.4d002a', // Main L4.2
    'avc1.64002a', // High L4.2
    'avc1.640032', // High L5.0
    'avc1.4d0032', // Main L5.0
    'avc1.640033', // High L5.1
    'avc1.4d0033', // Main L5.1
    'avc1.640034', // High L5.2
    'avc1.42001f', // Baseline L3.1
    'avc1.640028', // High L4.0
    'avc1.42001e', // Baseline L3.0
  ];

  const candidateCodecs = pixelsPerSec > 1920 * 1080 * 60 ? codecsHighRateFirst : codecsStandardFirst;
  const accelModes: HardwareAcceleration[] = ['no-preference', 'prefer-software'];

  for (const hardwareAcceleration of accelModes) {
    for (const codec of candidateCodecs) {
      try {
        const cfg: VideoEncoderConfig = {
          codec,
          width,
          height,
          bitrate,
          framerate,
          hardwareAcceleration,
        };
        const support = await VideoEncoder.isConfigSupported(cfg);
        if (support && support.supported) {
          return support.config || cfg;
        }
      } catch {
        // try next
      }
    }
  }

  return null;
}

/**
 * Optionally mix visible, unmuted audio & video tracks into a 48kHz stereo AudioBuffer for MP4 muxing.
 */
async function tryMixProjectAudio(
  project: Project,
  targetFps: number,
  totalFrames: number
): Promise<AudioBuffer | null> {
  if (typeof AudioEncoder === 'undefined' || typeof OfflineAudioContext === 'undefined') {
    return null;
  }

  const audioLayers = project.layers.filter((l) => {
    if (!l.visible) return false;
    if (l.audioConfig?.muted) return false;
    if (l.type === 'audio' && l.audioConfig?.src) return true;
    if (l.type === 'video' && l.mediaUrl) return true;
    return false;
  });

  if (audioLayers.length === 0) return null;

  try {
    const aacSupport = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    });
    if (!aacSupport?.supported) return null;
  } catch {
    return null;
  }

  const totalSec = Math.max(0.1, totalFrames / targetFps);
  const sampleRate = 48000;
  const length = Math.ceil(totalSec * sampleRate);

  try {
    const offline = new OfflineAudioContext(2, length, sampleRate);
    let scheduledCount = 0;

    for (const layer of audioLayers) {
      const src = layer.audioConfig?.src || layer.mediaUrl;
      if (!src) continue;

      try {
        const resp = await fetch(src, { mode: 'cors' });
        if (!resp.ok) continue;
        const arrBuf = await resp.arrayBuffer();
        const decoded = await offline.decodeAudioData(arrBuf);
        if (!decoded || decoded.duration <= 0) continue;

        const startSec = Math.max(0, layer.startFrame / targetFps);
        if (startSec >= totalSec) continue;

        const durSec = Math.min(
          totalSec - startSec,
          (layer.durationFrames ?? totalFrames) / targetFps,
          decoded.duration
        );
        if (durSec <= 0) continue;

        const source = offline.createBufferSource();
        source.buffer = decoded;

        const gain = offline.createGain();
        const vol = Math.max(0, Math.min(2, layer.audioConfig?.volume ?? 1));
        gain.gain.value = vol;

        source.connect(gain);
        gain.connect(offline.destination);
        source.start(startSec, 0, durSec);
        scheduledCount++;
      } catch {
        // Skip unreadable or silent tracks gracefully without breaking video export
      }
    }

    if (scheduledCount === 0) return null;
    return await offline.startRendering();
  } catch {
    return null;
  }
}

/**
 * Pixel-accurate, mobile-safe video/GIF exporter.
 * Uses WebCodecs VideoEncoder + mp4-muxer for MP4, pure LZW GIF89a for GIF,
 * and deterministic MediaRecorder capture for WebM/fallback.
 */
export async function exportVideo(
  project: Project,
  options: ExportOptions = {},
  onProgress: (progress: number, status: string) => void
): Promise<ExportResult> {
  const signal = options.signal;
  throwIfAborted(signal);

  const targetFormat = options.format || 'mp4';
  const targetFps = Math.min(120, Math.max(1, options.fps || project.settings.fps || 60));

  const origWidth = Math.max(2, project.settings.width || 720);
  const origHeight = Math.max(2, project.settings.height || 1280);

  const rawWidth = options.width || origWidth;
  const rawHeight = options.height || origHeight;
  const width = Math.max(2, Math.round(rawWidth / 2) * 2);
  const height = Math.max(2, Math.round(rawHeight / 2) * 2);

  const totalFrames = Math.max(1, project.settings.durationFrames || 90);
  const baseName = sanitizeBaseName(project.settings.name);

  let bitrate = 6_000_000;
  const pixelCount = width * height;
  if (pixelCount <= 720 * 1280) {
    bitrate = options.quality === 'high' ? 6_500_000 : options.quality === 'low' ? 2_500_000 : 4_200_000;
  } else if (pixelCount <= 1080 * 1920) {
    bitrate = options.quality === 'high' ? 11_000_000 : options.quality === 'low' ? 5_000_000 : 8_000_000;
  } else if (pixelCount <= 1440 * 2560) {
    bitrate = options.quality === 'high' ? 16_000_000 : options.quality === 'low' ? 7_500_000 : 12_000_000;
  } else {
    bitrate = options.quality === 'high' ? 22_000_000 : options.quality === 'low' ? 10_000_000 : 16_000_000;
  }
  if (targetFps > 60) {
    bitrate = Math.round(bitrate * 1.25);
  }

  const projCanvas = document.createElement('canvas');
  projCanvas.width = origWidth;
  projCanvas.height = origHeight;
  const renderer = new EngineRenderer(projCanvas);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
  if (!exportCtx) {
    renderer.dispose();
    throw new Error('Could not initialize export 2D canvas context');
  }

  try {
    onProgress(2, 'جاري تحضير الخطوط والوسائط...');
    await renderer.preloadAssets(project.layers, true);
    throwIfAborted(signal);

    // =========================================================================
    // PATH 1: Animated GIF89a Export
    // =========================================================================
    if (targetFormat === 'gif') {
      const maxGifDim = options.quality === 'high' ? 600 : options.quality === 'low' ? 360 : 480;
      const gifScale = Math.min(1, maxGifDim / Math.max(width, height));
      const gifW = Math.max(2, Math.round((width * gifScale) / 2) * 2);
      const gifH = Math.max(2, Math.round((height * gifScale) / 2) * 2);
      exportCanvas.width = gifW;
      exportCanvas.height = gifH;

      const gifFps = Math.min(20, Math.max(8, targetFps));
      const totalDurationSec = totalFrames / targetFps;
      const gifFrameCount = Math.max(1, Math.min(240, Math.round(totalDurationSec * gifFps)));
      const delayCentiseconds = Math.max(3, Math.round(100 / gifFps));

      const gifFrames: Uint8ClampedArray[] = [];
      onProgress(6, 'بدء معالجة وتصدير الصورة المتحركة GIF...');

      for (let g = 0; g < gifFrameCount; g++) {
        throwIfAborted(signal);
        const srcFrame = Math.min(
          totalFrames - 1,
          Math.round((g / Math.max(1, gifFrameCount - 1)) * (totalFrames - 1))
        );

        await renderer.seekVideosForFrame(project.layers, srcFrame, project.settings);
        throwIfAborted(signal);

        renderer.render(
          project.settings,
          project.layers,
          srcFrame,
          null,
          false,
          false,
          'first_person',
          undefined,
          false,
          'full',
          false
        );

        drawFittedFrame(
          projCanvas,
          exportCtx,
          gifW,
          gifH,
          origWidth,
          origHeight,
          project.settings.backgroundColor,
          false
        );

        const imgData = exportCtx.getImageData(0, 0, gifW, gifH);
        gifFrames.push(imgData.data);

        const pct = Math.round(6 + ((g + 1) / gifFrameCount) * 86);
        if (g % 2 === 0 || g === gifFrameCount - 1) {
          onProgress(pct, `تجهيز إطار GIF ${g + 1} من ${gifFrameCount} (${pct}%)`);
          await new Promise((res) => setTimeout(res, 2));
        }
      }

      throwIfAborted(signal);
      onProgress(95, 'جاري ضغط وحفظ ملف GIF...');
      await new Promise((res) => setTimeout(res, 4));
      const gifBlob = encodeAnimatedGif(gifFrames, gifW, gifH, delayCentiseconds);

      onProgress(100, 'تم تصدير GIF بنجاح!');
      return {
        blob: gifBlob,
        format: 'gif',
        filename: `${baseName}.gif`,
      };
    }

    // =========================================================================
    // PATH 2: Hardware / Software WebCodecs + mp4-muxer for MP4
    // =========================================================================
    if (targetFormat === 'mp4') {
      const encoderConfig = await selectSupportedAvcConfig(width, height, bitrate, targetFps);
      throwIfAborted(signal);

      if (encoderConfig) {
        try {
          const mixedAudio = await tryMixProjectAudio(project, targetFps, totalFrames);
          throwIfAborted(signal);

          const hasAudio = Boolean(mixedAudio && mixedAudio.length > 0);
          const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
              codec: 'avc',
              width,
              height,
            },
            audio: hasAudio
              ? {
                  codec: 'aac',
                  numberOfChannels: 2,
                  sampleRate: 48000,
                }
              : undefined,
            fastStart: 'in-memory',
            firstTimestampBehavior: 'offset',
          });

          let encodeError: unknown = null;
          const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
              try {
                muxer.addVideoChunk(chunk, meta);
              } catch (err) {
                encodeError = err;
              }
            },
            error: (e) => {
              console.error('VideoEncoder error:', e);
              encodeError = e;
            },
          });

          videoEncoder.configure(encoderConfig);

          // Encode audio if mixed successfully
          let audioEncoder: AudioEncoder | null = null;
          if (hasAudio && mixedAudio && typeof AudioEncoder !== 'undefined') {
            try {
              audioEncoder = new AudioEncoder({
                output: (chunk, meta) => {
                  try {
                    muxer.addAudioChunk(chunk, meta);
                  } catch (err) {
                    console.warn('Audio mux warning:', err);
                  }
                },
                error: (e) => {
                  console.warn('AudioEncoder warning:', e);
                },
              });
              audioEncoder.configure({
                codec: 'mp4a.40.2',
                sampleRate: 48000,
                numberOfChannels: 2,
                bitrate: 128_000,
              });

              const ch0 = mixedAudio.getChannelData(0);
              const ch1 = mixedAudio.numberOfChannels > 1 ? mixedAudio.getChannelData(1) : ch0;
              const chunkSize = 1024;
              const totalSamples = mixedAudio.length;
              for (let offset = 0; offset < totalSamples; offset += chunkSize) {
                const count = Math.min(chunkSize, totalSamples - offset);
                const planar = new Float32Array(count * 2);
                planar.set(ch0.subarray(offset, offset + count), 0);
                planar.set(ch1.subarray(offset, offset + count), count);
                const audioData = new AudioData({
                  format: 'f32-planar',
                  sampleRate: 48000,
                  numberOfFrames: count,
                  numberOfChannels: 2,
                  timestamp: Math.round((offset / 48000) * 1_000_000),
                  data: planar,
                });
                audioEncoder.encode(audioData);
                audioData.close();
              }
            } catch (audioErr) {
              console.warn('Skipping audio track during export:', audioErr);
              try {
                audioEncoder?.close();
              } catch {}
              audioEncoder = null;
            }
          }

          onProgress(5, 'بدء معالجة وتصدير الإطارات...');

          try {
            for (let f = 0; f < totalFrames; f++) {
              throwIfAborted(signal);
              if (encodeError) throw encodeError;

              // Strict backpressure to avoid memory spikes on mobile & high-res
              while (videoEncoder.encodeQueueSize > 2) {
                throwIfAborted(signal);
                if (encodeError) throw encodeError;
                await new Promise((res) => setTimeout(res, 8));
              }

              await renderer.seekVideosForFrame(project.layers, f, project.settings);
              throwIfAborted(signal);

              renderer.render(
                project.settings,
                project.layers,
                f,
                null,
                false,
                false,
                'first_person',
                undefined,
                false,
                'full',
                false
              );

              drawFittedFrame(
                projCanvas,
                exportCtx,
                width,
                height,
                origWidth,
                origHeight,
                project.settings.backgroundColor,
                false
              );

              const timestampUs = Math.round((f * 1_000_000) / targetFps);
              let frame: VideoFrame;
              if (typeof createImageBitmap === 'function') {
                const bitmap = await createImageBitmap(exportCanvas);
                frame = new VideoFrame(bitmap, { timestamp: timestampUs });
                bitmap.close();
              } else {
                frame = new VideoFrame(exportCanvas, { timestamp: timestampUs });
              }

              const keyFrame = f % Math.max(1, targetFps * 2) === 0;
              videoEncoder.encode(frame, { keyFrame });
              frame.close();

              const pct = Math.round(5 + ((f + 1) / totalFrames) * 90);
              if (f % 2 === 0 || f === totalFrames - 1) {
                onProgress(pct, `جارٍ تصدير الإطار ${f + 1} من ${totalFrames} (${pct}%)`);
                await new Promise((res) => setTimeout(res, 2));
              }
            }

            throwIfAborted(signal);
            onProgress(96, 'جاري إتمام ملف الفيديو MP4...');
            await videoEncoder.flush();
            if (audioEncoder && audioEncoder.state !== 'closed') {
              await audioEncoder.flush();
            }
            muxer.finalize();

            const mp4Buffer = muxer.target.buffer;
            const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
            if (blob.size <= 0) {
              throw new Error('Generated MP4 buffer was empty');
            }

            onProgress(100, 'تم التصدير بنجاح!');
            return {
              blob,
              format: 'mp4',
              filename: `${baseName}.mp4`,
            };
          } finally {
            try {
              if (videoEncoder.state !== 'closed') videoEncoder.close();
            } catch {}
            try {
              if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close();
            } catch {}
          }
        } catch (webCodecsErr) {
          if ((webCodecsErr as Error)?.name === 'AbortError') throw webCodecsErr;
          console.warn('WebCodecs MP4 export fell back to MediaRecorder:', webCodecsErr);
        }
      }
    }

    // =========================================================================
    // PATH 3: MediaRecorder (WebM primary or safe fallback)
    // =========================================================================
    if (typeof MediaRecorder === 'undefined' || typeof exportCanvas.captureStream !== 'function') {
      throw new Error('هذا المتصفح لا يدعم تصدير الفيديو عبر WebCodecs أو MediaRecorder');
    }

    throwIfAborted(signal);

    const candidateMimes =
      targetFormat === 'mp4'
        ? [
            'video/mp4;codecs=avc1.42E01E',
            'video/mp4;codecs=avc1',
            'video/mp4',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
          ]
        : [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4;codecs=avc1',
            'video/mp4',
          ];

    let chosenMime = '';
    for (const m of candidateMimes) {
      try {
        if (MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      } catch {}
    }

    const actualFormat: 'mp4' | 'webm' = chosenMime.includes('mp4') ? 'mp4' : 'webm';
    const blobMime = actualFormat === 'mp4' ? 'video/mp4' : 'video/webm';

    return await new Promise<ExportResult>((resolve, reject) => {
      let stream: MediaStream;
      let recorder: MediaRecorder;
      let stopped = false;

      const onAbort = () => {
        if (stopped) return;
        stopped = true;
        try {
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch {}
        try {
          stream?.getTracks().forEach((t) => t.stop());
        } catch {}
        reject(new DOMException('Export cancelled by user', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        // Use manual requestFrame when supported so slow 3D frames don't drop
        const testTrackCheck = exportCanvas.captureStream(0);
        const videoTrack = testTrackCheck.getVideoTracks()[0] as MediaStreamTrack & {
          requestFrame?: () => void;
        };
        const supportsManualFrame = typeof videoTrack?.requestFrame === 'function';
        if (supportsManualFrame) {
          stream = testTrackCheck;
        } else {
          testTrackCheck.getTracks().forEach((t) => t.stop());
          stream = exportCanvas.captureStream(targetFps);
        }

        recorder = new MediaRecorder(stream, {
          mimeType: chosenMime || undefined,
          videoBitsPerSecond: bitrate,
        });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          if (signal) signal.removeEventListener('abort', onAbort);
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {}
          if (stopped) return;
          stopped = true;

          const blob = new Blob(chunks, { type: blobMime });
          if (blob.size <= 0) {
            reject(new Error('فشل تسجيل ملف الفيديو (الملف الناتج فارغ)'));
            return;
          }

          onProgress(100, 'تم التصدير بنجاح!');
          resolve({
            blob,
            format: actualFormat,
            filename: `${baseName}.${actualFormat}`,
          });
        };

        recorder.onerror = (err) => {
          if (signal) signal.removeEventListener('abort', onAbort);
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {}
          if (stopped) return;
          stopped = true;
          console.error('MediaRecorder error:', err);
          reject(err);
        };

        recorder.start(200);

        let currentFrame = 0;
        const intervalMs = Math.max(12, Math.round(1000 / Math.min(60, targetFps)));

        const renderStep = async () => {
          if (stopped || signal?.aborted) return;

          if (currentFrame >= totalFrames) {
            onProgress(98, 'جاري إنهاء وحفظ ملف الفيديو...');
            setTimeout(() => {
              if (!stopped && recorder.state !== 'inactive') {
                recorder.stop();
              }
            }, 280);
            return;
          }

          try {
            await renderer.seekVideosForFrame(project.layers, currentFrame, project.settings);
            if (stopped || signal?.aborted) return;

            renderer.render(
              project.settings,
              project.layers,
              currentFrame,
              null,
              false,
              false,
              'first_person',
              undefined,
              false,
              'full',
              false
            );

            drawFittedFrame(
              projCanvas,
              exportCtx,
              width,
              height,
              origWidth,
              origHeight,
              project.settings.backgroundColor,
              false
            );

            if (supportsManualFrame) {
              try {
                videoTrack.requestFrame?.();
              } catch {}
            }

            currentFrame++;
            const pct = Math.round((currentFrame / totalFrames) * 95);
            if (currentFrame % 2 === 0 || currentFrame === totalFrames) {
              onProgress(pct, `تسجيل الإطار ${currentFrame} من ${totalFrames} (${pct}%)`);
            }

            setTimeout(renderStep, intervalMs);
          } catch (stepErr) {
            if (!stopped) {
              stopped = true;
              try {
                if (recorder.state !== 'inactive') recorder.stop();
              } catch {}
              reject(stepErr);
            }
          }
        };

        renderStep();
      } catch (recorderErr) {
        if (signal) signal.removeEventListener('abort', onAbort);
        console.error('MediaRecorder initialization error:', recorderErr);
        reject(recorderErr);
      }
    });
  } finally {
    renderer.dispose();
    projCanvas.width = 1;
    projCanvas.height = 1;
    exportCanvas.width = 1;
    exportCanvas.height = 1;
  }
}

/**
 * Backward compatibility wrapper for exportVideoWebM
 */
export async function exportVideoWebM(
  project: Project,
  onProgress: (progress: number, status: string) => void
): Promise<Blob> {
  const result = await exportVideo(project, { format: 'webm' }, onProgress);
  return result.blob;
}

export function createProjectSQBlob(project: Project): { blob: Blob; filename: string } {
  const sqPayload = JSON.stringify(project, null, 2);
  const blob = new Blob([sqPayload], { type: 'application/octet-stream' });
  const filename = `${sanitizeBaseName(project.settings.name)}.sq`;
  return { blob, filename };
}

export function downloadProjectSQ(project: Project) {
  const { blob, filename } = createProjectSQBlob(project);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
    URL.revokeObjectURL(url);
  }, 1500);
}

export async function exportCurrentFramePNG(
  project: Project,
  currentFrame: number = 0,
  targetWidth?: number,
  targetHeight?: number
): Promise<{ dataUrl: string; blob: Blob; filename: string }> {
  const origWidth = Math.max(2, project.settings.width || 720);
  const origHeight = Math.max(2, project.settings.height || 1280);
  const width = Math.max(2, targetWidth || origWidth);
  const height = Math.max(2, targetHeight || origHeight);

  const projCanvas = document.createElement('canvas');
  projCanvas.width = origWidth;
  projCanvas.height = origHeight;
  const renderer = new EngineRenderer(projCanvas);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d');
  if (!exportCtx) {
    renderer.dispose();
    throw new Error('Could not initialize PNG export canvas');
  }

  try {
    await renderer.preloadAssets(project.layers, true);
    await renderer.seekVideosForFrame(project.layers, currentFrame, project.settings);
    renderer.render(
      project.settings,
      project.layers,
      currentFrame,
      null,
      false,
      false,
      'first_person',
      undefined,
      false,
      'full',
      false
    );

    drawFittedFrame(
      projCanvas,
      exportCtx,
      width,
      height,
      origWidth,
      origHeight,
      project.settings.backgroundColor,
      true
    );

    const dataUrl = exportCanvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    });

    const filename = `${sanitizeBaseName(project.settings.name)}_frame.png`;
    return { dataUrl, blob, filename };
  } finally {
    renderer.dispose();
    projCanvas.width = 1;
    projCanvas.height = 1;
    exportCanvas.width = 1;
    exportCanvas.height = 1;
  }
}
