// Generates lightweight in-memory PCM WAV Data/Blob URLs for built-in audio tracks,
// crisp offline SVG graphics, and procedural playable looping WebM video clips so
// Media (Photos & Videos) and Audio appear directly inside the app without opening device files.

export interface BuiltinAudioTrack {
  id: string;
  title: string;
  durationSec: number;
  durationLabel: string;
  gradient: string;
  tempoBpm: number;
  rootFreq: number;
  style: 'beat' | 'ambient' | 'bass' | 'cinematic' | 'lofi' | 'pulse' | 'trap' | 'sfx';
  waveformBars: number[];
}

export const BUILTIN_AUDIO_TRACKS: BuiltinAudioTrack[] = [
  {
    id: 'track-pulse-1',
    title: 'Neon Pulse Beat',
    durationSec: 12,
    durationLabel: '00:12',
    gradient: 'from-emerald-600/80 via-teal-800/85 to-slate-950',
    tempoBpm: 124,
    rootFreq: 110,
    style: 'beat',
    waveformBars: [25, 60, 42, 85, 55, 92, 48, 76, 35, 88, 62, 40, 74, 52, 90, 38],
  },
  {
    id: 'track-horizon-2',
    title: 'Over Horizon (Synth)',
    durationSec: 16,
    durationLabel: '00:16',
    gradient: 'from-sky-600/80 via-indigo-900/85 to-slate-950',
    tempoBpm: 110,
    rootFreq: 146.83,
    style: 'ambient',
    waveformBars: [35, 48, 72, 65, 80, 90, 68, 54, 76, 84, 62, 45, 70, 58, 42, 30],
  },
  {
    id: 'track-phonk-3',
    title: 'Deep 808 Bass',
    durationSec: 10,
    durationLabel: '00:10',
    gradient: 'from-violet-600/80 via-purple-900/85 to-zinc-950',
    tempoBpm: 135,
    rootFreq: 65.41,
    style: 'bass',
    waveformBars: [88, 42, 95, 38, 86, 52, 94, 34, 85, 46, 92, 40, 82, 50, 88, 36],
  },
  {
    id: 'track-rose-4',
    title: 'Velvet Lo-Fi',
    durationSec: 14,
    durationLabel: '00:14',
    gradient: 'from-rose-600/80 via-fuchsia-900/85 to-slate-950',
    tempoBpm: 88,
    rootFreq: 196,
    style: 'lofi',
    waveformBars: [32, 54, 46, 68, 74, 52, 60, 78, 48, 64, 72, 44, 58, 66, 40, 34],
  },
  {
    id: 'track-cinema-5',
    title: 'Cinematic Rise',
    durationSec: 10,
    durationLabel: '00:10',
    gradient: 'from-amber-600/80 via-orange-900/85 to-stone-950',
    tempoBpm: 96,
    rootFreq: 98,
    style: 'cinematic',
    waveformBars: [18, 24, 32, 40, 48, 56, 64, 72, 78, 84, 88, 92, 96, 86, 70, 45],
  },
  {
    id: 'track-cyber-6',
    title: 'Cyber Drift Arp',
    durationSec: 12,
    durationLabel: '00:12',
    gradient: 'from-cyan-600/80 via-blue-900/85 to-slate-950',
    tempoBpm: 128,
    rootFreq: 130.81,
    style: 'pulse',
    waveformBars: [52, 78, 44, 82, 60, 86, 48, 90, 56, 76, 42, 84, 62, 80, 50, 68],
  },
  {
    id: 'track-mint-7',
    title: 'Emerald Groove',
    durationSec: 14,
    durationLabel: '00:14',
    gradient: 'from-lime-600/75 via-emerald-900/85 to-neutral-950',
    tempoBpm: 118,
    rootFreq: 123.47,
    style: 'beat',
    waveformBars: [42, 74, 62, 86, 48, 78, 66, 90, 50, 72, 60, 84, 46, 76, 58, 40],
  },
  {
    id: 'track-dusk-8',
    title: 'Midnight Echo',
    durationSec: 16,
    durationLabel: '00:16',
    gradient: 'from-indigo-600/80 via-slate-900/90 to-black',
    tempoBpm: 100,
    rootFreq: 164.81,
    style: 'ambient',
    waveformBars: [28, 44, 60, 52, 70, 62, 76, 58, 68, 50, 74, 60, 48, 56, 42, 30],
  },
  {
    id: 'track-trap-9',
    title: 'Phonk Trap 808',
    durationSec: 12,
    durationLabel: '00:12',
    gradient: 'from-red-600/80 via-rose-950/90 to-black',
    tempoBpm: 142,
    rootFreq: 73.42,
    style: 'trap',
    waveformBars: [92, 36, 88, 64, 96, 40, 84, 70, 90, 38, 86, 58, 94, 44, 80, 52],
  },
  {
    id: 'track-aurora-10',
    title: 'Aurora Sky Pad',
    durationSec: 18,
    durationLabel: '00:18',
    gradient: 'from-teal-500/75 via-cyan-900/85 to-slate-950',
    tempoBpm: 84,
    rootFreq: 220,
    style: 'ambient',
    waveformBars: [24, 38, 54, 66, 74, 82, 76, 68, 60, 72, 80, 64, 52, 44, 36, 26],
  },
  {
    id: 'track-future-11',
    title: 'Future Bass Surge',
    durationSec: 12,
    durationLabel: '00:12',
    gradient: 'from-fuchsia-600/80 via-purple-900/85 to-slate-950',
    tempoBpm: 150,
    rootFreq: 116.54,
    style: 'pulse',
    waveformBars: [64, 90, 52, 88, 72, 94, 48, 86, 68, 92, 54, 84, 70, 88, 50, 76],
  },
  {
    id: 'track-arcade-12',
    title: 'Neon Synthwave',
    durationSec: 14,
    durationLabel: '00:14',
    gradient: 'from-pink-600/80 via-indigo-900/85 to-slate-950',
    tempoBpm: 120,
    rootFreq: 174.61,
    style: 'beat',
    waveformBars: [48, 72, 84, 60, 54, 88, 76, 66, 50, 82, 90, 62, 56, 84, 70, 44],
  },
  {
    id: 'track-sfx-impact-13',
    title: 'SFX Sub Boom',
    durationSec: 4,
    durationLabel: '00:04',
    gradient: 'from-orange-600/85 via-red-950/90 to-black',
    tempoBpm: 120,
    rootFreq: 55,
    style: 'sfx',
    waveformBars: [98, 92, 80, 68, 58, 48, 40, 32, 26, 20, 16, 12, 10, 8, 6, 4],
  },
  {
    id: 'track-sfx-whoosh-14',
    title: 'SFX Cyber Whoosh',
    durationSec: 3,
    durationLabel: '00:03',
    gradient: 'from-sky-500/85 via-cyan-950/90 to-black',
    tempoBpm: 140,
    rootFreq: 261.63,
    style: 'sfx',
    waveformBars: [12, 22, 38, 56, 78, 96, 84, 62, 44, 30, 20, 14, 10, 8, 6, 4],
  },
];

const cachedAudioUrls = new Map<string, string>();

export function getBuiltinAudioUrl(track: BuiltinAudioTrack): string {
  const existing = cachedAudioUrls.get(track.id);
  if (existing) return existing;

  const sampleRate = 22050;
  const totalSamples = Math.floor(sampleRate * track.durationSec);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard RIFF/WAVE header (16-bit mono PCM)
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const beatDuration = 60 / track.tempoBpm;
  const chordRatios = [1, 1.25, 1.5, 1.1892];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatPos = (t % beatDuration) / beatDuration;
    const barIndex = Math.floor(t / (beatDuration * 4));
    const chord = chordRatios[barIndex % chordRatios.length];
    const baseF = track.rootFreq * chord;

    let sample = 0;

    if (track.style === 'sfx') {
      const progress = t / track.durationSec;
      if (track.id.includes('impact')) {
        const pitch = 42 + 180 * Math.exp(-t * 9.5);
        const body = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 1.35);
        const crispNoise = (Math.sin(t * 9123.7) * 0.5 + Math.cos(t * 4731.1) * 0.5) * Math.exp(-t * 12) * 0.35;
        sample = body * 0.8 + crispNoise;
      } else {
        const bell = Math.sin(progress * Math.PI);
        const sweep = track.rootFreq * (0.4 + Math.sin(progress * Math.PI) * 2.2);
        const airy = Math.sin(t * 8191.3) * Math.cos(t * 3571.9) * 0.25 * bell;
        sample = Math.sin(2 * Math.PI * sweep * t) * 0.42 * bell + airy;
      }
    } else if (track.style === 'trap') {
      const subStep = (t % (beatDuration * 0.5)) / (beatDuration * 0.5);
      const kickEnv = Math.exp(-beatPos * 12);
      const kick = Math.sin(2 * Math.PI * (40 + 130 * Math.exp(-beatPos * 32)) * (t % beatDuration)) * kickEnv * 0.72;
      const bass808 = Math.tanh(Math.sin(2 * Math.PI * baseF * 0.65 * t) * 1.8) * 0.32;
      const hihat = (Math.sin(t * 17321.5) * Math.cos(t * 9817.3)) * Math.exp(-subStep * 28) * 0.16;
      const cowbell = Math.sin(2 * Math.PI * baseF * 4 * t) * Math.exp(-subStep * 10) * 0.2;
      sample = kick + bass808 + hihat + cowbell;
    } else if (track.style === 'beat' || track.style === 'bass') {
      const kickEnv = Math.exp(-beatPos * 14);
      const kickFreq = 45 + 115 * Math.exp(-beatPos * 28);
      const kick = Math.sin(2 * Math.PI * kickFreq * (t % beatDuration)) * kickEnv * 0.65;

      const sub = Math.sin(2 * Math.PI * (baseF * 0.5) * t) * 0.28;
      const arpNote = Math.floor((t / (beatDuration * 0.5)) % 4);
      const arpMul = [1, 1.5, 2, 1.25][arpNote];
      const lead =
        Math.sin(2 * Math.PI * baseF * 2 * arpMul * t) *
        Math.exp(-((t % (beatDuration * 0.5)) / (beatDuration * 0.5)) * 6) *
        0.22;
      sample = kick + sub + lead;
    } else if (track.style === 'cinematic') {
      const progress = t / track.durationSec;
      const swell = Math.sin(progress * Math.PI);
      const pad1 = Math.sin(2 * Math.PI * baseF * t);
      const pad2 = Math.sin(2 * Math.PI * (baseF * 1.5) * t) * 0.6;
      const pad3 = Math.sin(2 * Math.PI * (baseF * 2) * t) * 0.4;
      const pulse = 0.7 + 0.3 * Math.sin(2 * Math.PI * (1 / beatDuration) * t);
      sample = (pad1 + pad2 + pad3) * 0.26 * swell * pulse;
    } else if (track.style === 'lofi') {
      const kickEnv = Math.exp(-beatPos * 10);
      const softKick = Math.sin(2 * Math.PI * (50 + 70 * kickEnv) * (t % beatDuration)) * kickEnv * 0.38;
      const rhodes =
        (Math.sin(2 * Math.PI * baseF * t) +
          Math.sin(2 * Math.PI * baseF * 1.2 * t) * 0.6 +
          Math.sin(2 * Math.PI * baseF * 1.5 * t) * 0.5) *
        0.18;
      sample = softKick + rhodes;
    } else {
      const gate = track.style === 'pulse' ? 0.55 + 0.45 * Math.sin(2 * Math.PI * (2 / beatDuration) * t) : 1;
      const p1 = Math.sin(2 * Math.PI * baseF * t);
      const p2 = Math.sin(2 * Math.PI * (baseF * 1.502) * t) * 0.55;
      const p3 = Math.sin(2 * Math.PI * (baseF * 2.003) * t) * 0.35;
      sample = (p1 + p2 + p3) * 0.22 * gate;
    }

    const fadeIn = Math.min(1, t / 0.06);
    const fadeOut = Math.min(1, (track.durationSec - t) / 0.14);
    const clamped = Math.max(-0.95, Math.min(0.95, sample * fadeIn * fadeOut));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  cachedAudioUrls.set(track.id, url);
  return url;
}

export interface BuiltinMediaItem {
  id: string;
  kind: 'image' | 'video';
  name: string;
  url: string;
  posterUrl?: string;
  durationSec?: number;
  durationLabel?: string;
  isUserSaved?: boolean;
}

const makeSvgUrl = (svgContent: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;

export const BUILTIN_MEDIA_GALLERY: BuiltinMediaItem[] = [
  {
    id: 'media-emerald-mesh',
    kind: 'image',
    name: 'Emerald Mesh',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#00E676"/><stop offset="45%" stop-color="#0B3B2E"/><stop offset="100%" stop-color="#090D10"/></radialGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="430" cy="420" r="165" fill="#00E5FF" opacity="0.24"/><circle cx="170" cy="180" r="110" fill="#34D399" opacity="0.18"/></svg>`
    ),
  },
  {
    id: 'media-cobalt-cards',
    kind: 'image',
    name: 'Cobalt Horizon',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0F172A"/><stop offset="50%" stop-color="#1D4ED8"/><stop offset="100%" stop-color="#020617"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><rect x="125" y="150" width="350" height="62" rx="18" fill="#60A5FA" opacity="0.75"/><rect x="125" y="240" width="350" height="62" rx="18" fill="#3B82F6" opacity="0.85"/><rect x="125" y="330" width="350" height="62" rx="18" fill="#2563EB"/><rect x="125" y="420" width="350" height="62" rx="18" fill="#93C5FD"/></svg>`
    ),
  },
  {
    id: 'media-magenta-dusk',
    kind: 'image',
    name: 'Magenta Dusk',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0%" stop-color="#F43F5E"/><stop offset="55%" stop-color="#4C0519"/><stop offset="100%" stop-color="#0B060D"/></radialGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="180" cy="430" r="145" fill="#A855F7" opacity="0.32"/></svg>`
    ),
  },
  {
    id: 'media-amber-sand',
    kind: 'image',
    name: 'Golden Sunset',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1C1917"/><stop offset="50%" stop-color="#9A3412"/><stop offset="100%" stop-color="#FDE68A"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="270" r="118" fill="#F59E0B" opacity="0.55"/><path d="M0 440 Q150 390 300 440 T600 440 V600 H0 Z" fill="#181210" opacity="0.65"/></svg>`
    ),
  },
  {
    id: 'media-violet-orbit',
    kind: 'image',
    name: 'Violet Orbit',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="g" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="#8B5CF6"/><stop offset="60%" stop-color="#1E1B4B"/><stop offset="100%" stop-color="#09090B"/></radialGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="300" r="185" fill="none" stroke="#C4B5FD" stroke-width="3" opacity="0.5"/><circle cx="300" cy="300" r="115" fill="none" stroke="#A78BFA" stroke-width="3" opacity="0.65"/></svg>`
    ),
  },
  {
    id: 'media-grid-plate',
    kind: 'image',
    name: 'Neon Perspective Grid',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#0B0E13"/><path d="M0 100H600M0 200H600M0 300H600M0 400H600M0 500H600M100 0V600M200 0V600M300 0V600M400 0V600M500 0V600" stroke="#00E676" stroke-opacity="0.25" stroke-width="2"/><circle cx="300" cy="300" r="110" fill="#00E676" fill-opacity="0.14"/></svg>`
    ),
  },
  {
    id: 'media-hud-frame',
    kind: 'image',
    name: 'Sci-Fi HUD Frame',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#050912"/><rect x="44" y="44" width="512" height="512" rx="22" fill="none" stroke="#00E5FF" stroke-opacity="0.45" stroke-width="3" stroke-dasharray="18 10"/><path d="M44 120V44H120M480 44H556V120M556 480V556H480M120 556H44V480" fill="none" stroke="#00E676" stroke-width="7" stroke-linecap="round"/><circle cx="300" cy="300" r="130" fill="none" stroke="#38BDF8" stroke-opacity="0.5" stroke-width="2"/><line x1="250" y1="300" x2="350" y2="300" stroke="#00E5FF" stroke-width="2"/><line x1="300" y1="250" x2="300" y2="350" stroke="#00E5FF" stroke-width="2"/></svg>`
    ),
  },
  {
    id: 'media-aurora-silk',
    kind: 'image',
    name: 'Aurora Wave Silk',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#062925"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#00E676"/><stop offset="50%" stop-color="#00E5FF"/><stop offset="100%" stop-color="#8B5CF6"/></linearGradient></defs><rect width="600" height="600" fill="url(#bg)"/><path d="M0 330 Q150 210 300 310 T600 260 V600 H0 Z" fill="url(#w)" opacity="0.45"/><path d="M0 400 Q180 310 350 390 T600 350 V600 H0 Z" fill="#00E5FF" opacity="0.25"/></svg>`
    ),
  },
  {
    id: 'media-bokeh-gold',
    kind: 'image',
    name: 'Golden Bokeh Lights',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#120B07"/><circle cx="140" cy="170" r="85" fill="#FBBF24" opacity="0.28"/><circle cx="430" cy="150" r="65" fill="#F59E0B" opacity="0.35"/><circle cx="320" cy="310" r="110" fill="#FDE68A" opacity="0.22"/><circle cx="170" cy="430" r="90" fill="#FB923C" opacity="0.3"/><circle cx="470" cy="410" r="78" fill="#FBBF24" opacity="0.26"/></svg>`
    ),
  },
  {
    id: 'media-prism-prism',
    kind: 'image',
    name: 'Chromatic Prism',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00E5FF"/><stop offset="50%" stop-color="#A855F7"/><stop offset="100%" stop-color="#EC4899"/></linearGradient></defs><rect width="600" height="600" fill="#09090F"/><polygon points="300,85 510,475 90,475" fill="none" stroke="url(#p)" stroke-width="10"/><polygon points="300,155 445,435 155,435" fill="url(#p)" opacity="0.22"/></svg>`
    ),
  },
  {
    id: 'media-eclipse-halo',
    kind: 'image',
    name: 'Solar Eclipse Halo',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="38%" stop-color="#000000"/><stop offset="46%" stop-color="#F97316"/><stop offset="65%" stop-color="#7C2D12" stop-opacity="0.45"/><stop offset="100%" stop-color="#050508"/></radialGradient></defs><rect width="600" height="600" fill="#050508"/><circle cx="300" cy="300" r="245" fill="url(#halo)"/></svg>`
    ),
  },
  {
    id: 'media-cyber-stripes',
    kind: 'image',
    name: 'Cyberpunk Stripes',
    url: makeSvgUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#0C0A18"/><g stroke="#38BDF8" stroke-opacity="0.28" stroke-width="6"><line x1="-100" y1="150" x2="250" y2="-100"/><line x1="-100" y1="270" x2="370" y2="-100"/><line x1="-100" y1="390" x2="490" y2="-100"/><line x1="-100" y1="510" x2="610" y2="-100"/><line x1="0" y1="620" x2="680" y2="30"/><line x1="120" y1="620" x2="680" y2="150"/><line x1="240" y1="620" x2="680" y2="270"/></g><circle cx="300" cy="300" r="120" fill="#F43F5E" opacity="0.22"/></svg>`
    ),
  },
];

// Procedural Video Generator (real playable WebM Blob URLs generated once in memory)
interface VideoBlueprint {
  id: string;
  name: string;
  durationSec: number;
  durationLabel: string;
  drawFrame: (ctx: CanvasRenderingContext2D, w: number, h: number, tNorm: number) => void;
}

const VIDEO_BLUEPRINTS: VideoBlueprint[] = [
  {
    id: 'video-neon-tunnel',
    name: 'نفق نيون متحرك',
    durationSec: 2.5,
    durationLabel: '00:03',
    drawFrame: (ctx, w, h, t) => {
      ctx.fillStyle = '#070B12';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < 8; i++) {
        const p = (t + i / 8) % 1;
        const radius = 18 + p * (Math.min(w, h) * 0.55);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * Math.PI * 2 + i * 0.25);
        ctx.strokeStyle = i % 2 === 0 ? '#00E676' : '#00E5FF';
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
        ctx.lineWidth = 4 + p * 6;
        ctx.beginPath();
        ctx.roundRect(-radius, -radius, radius * 2, radius * 2, radius * 0.25);
        ctx.stroke();
        ctx.restore();
      }
    },
  },
  {
    id: 'video-cosmic-warp',
    name: 'سفر فضائي نجوم',
    durationSec: 2.5,
    durationLabel: '00:03',
    drawFrame: (ctx, w, h, t) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.65);
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(1, '#020408');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 65; i++) {
        const angle = (i * 137.5 * Math.PI) / 180;
        const progress = ((t + (i % 17) / 17) * 1.0) % 1;
        const dist = progress * (w * 0.62);
        const x = w / 2 + Math.cos(angle) * dist;
        const y = h / 2 + Math.sin(angle) * dist;
        const prevDist = Math.max(0, dist - 22 * progress);
        const px = w / 2 + Math.cos(angle) * prevDist;
        const py = h / 2 + Math.sin(angle) * prevDist;
        ctx.strokeStyle = i % 3 === 0 ? '#38BDF8' : '#FFFFFF';
        ctx.globalAlpha = Math.sin(progress * Math.PI);
        ctx.lineWidth = 1.5 + progress * 2.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'video-aurora-waves',
    name: 'موجات الشفق القطبي',
    durationSec: 2.5,
    durationLabel: '00:03',
    drawFrame: (ctx, w, h, t) => {
      ctx.fillStyle = '#040914';
      ctx.fillRect(0, 0, w, h);

      const colors = ['#00E676', '#00E5FF', '#A855F7'];
      colors.forEach((col, idx) => {
        ctx.save();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.34;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 24) {
          const phase = t * Math.PI * 2 + (x / w) * Math.PI * 2 + idx * 1.4;
          const y = h * (0.48 + idx * 0.1) + Math.sin(phase) * 42;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    },
  },
  {
    id: 'video-pulse-eq',
    name: 'حلقة نبض صوتي',
    durationSec: 2.5,
    durationLabel: '00:03',
    drawFrame: (ctx, w, h, t) => {
      ctx.fillStyle = '#09090F';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const bars = 28;
      const baseR = Math.min(w, h) * 0.22;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        const amp = 14 + 34 * Math.abs(Math.sin(t * Math.PI * 4 + i * 0.55));
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + amp);
        const y2 = cy + Math.sin(angle) * (baseR + amp);
        ctx.strokeStyle = i % 2 === 0 ? '#F43F5E' : '#38BDF8';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.fillStyle = '#00E676';
      ctx.globalAlpha = 0.22 + 0.2 * Math.sin(t * Math.PI * 4);
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },
];

let cachedVideoClipsPromise: Promise<BuiltinMediaItem[]> | null = null;

function renderBlueprintPosterUrl(bp: VideoBlueprint): string {
  try {
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 360;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    bp.drawFrame(ctx, 360, 360, 0.35);
    return c.toDataURL('image/png');
  } catch {
    return '';
  }
}

async function recordBlueprintToVideo(bp: VideoBlueprint): Promise<BuiltinMediaItem | null> {
  if (
    typeof document === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  ) {
    return null;
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const supportedMime = mimeCandidates.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  if (!supportedMime) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const posterUrl = renderBlueprintPosterUrl(bp);
  const fps = 20;
  const totalFrames = Math.round(bp.durationSec * fps);
  const frameDelayMs = Math.round(1000 / fps);

  return await new Promise<BuiltinMediaItem | null>((resolve) => {
    try {
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: supportedMime,
        videoBitsPerSecond: 900_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onerror = () => resolve(null);
      recorder.onstop = () => {
        try {
          stream.getTracks().forEach((tr) => tr.stop());
        } catch {}
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(chunks, { type: supportedMime });
        const url = URL.createObjectURL(blob);
        resolve({
          id: bp.id,
          kind: 'video',
          name: bp.name,
          url,
          posterUrl,
          durationSec: bp.durationSec,
          durationLabel: bp.durationLabel,
        });
      };

      bp.drawFrame(ctx, 360, 360, 0);
      recorder.start();

      let frame = 0;
      const tick = () => {
        frame++;
        if (frame >= totalFrames) {
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            resolve(null);
          }
          return;
        }
        bp.drawFrame(ctx, 360, 360, frame / totalFrames);
        setTimeout(tick, frameDelayMs);
      };
      setTimeout(tick, frameDelayMs);
    } catch {
      resolve(null);
    }
  });
}

export function getBuiltinVideoClips(): Promise<BuiltinMediaItem[]> {
  if (cachedVideoClipsPromise) return cachedVideoClipsPromise;
  cachedVideoClipsPromise = Promise.all(VIDEO_BLUEPRINTS.map(recordBlueprintToVideo)).then((items) =>
    items.filter((x): x is BuiltinMediaItem => Boolean(x))
  );
  return cachedVideoClipsPromise;
}
