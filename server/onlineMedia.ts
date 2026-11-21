import type { Express, Request, Response } from 'express';

export interface OnlineMediaResult {
  id: string;
  kind: 'image' | 'video';
  title: string;
  url: string;
  proxyUrl: string;
  thumbUrl: string;
  width?: number;
  height?: number;
  durationSec?: number;
  source: string;
  author?: string;
}

export interface OnlineAudioResult {
  id: string;
  title: string;
  artist?: string;
  url: string;
  proxyUrl: string;
  durationSec: number;
  durationLabel: string;
  source: string;
  artworkUrl?: string;
}

const USER_AGENT = 'SQMOTION-Editor/1.0 (+https://sqmotion.app)';

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  // Block private IPv4 ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  return false;
}

function makeProxyUrl(targetUrl: string): string {
  return `/api/online/proxy?url=${encodeURIComponent(targetUrl)}`;
}

function formatDurationLabel(sec: number): string {
  const s = Math.max(1, Math.round(sec || 15));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

async function searchOpenverseImages(query: string, page = 1): Promise<OnlineMediaResult[]> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page=${page}&page_size=18`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = Array.isArray(data?.results) ? data.results : [];
    const mapped: OnlineMediaResult[] = [];
    for (const item of results) {
      const imgUrl = typeof item.url === 'string' ? item.url : '';
      const thumbUrl = typeof item.thumbnail === 'string' ? item.thumbnail : imgUrl;
      if (!imgUrl.startsWith('https://')) continue;
      mapped.push({
        id: `ov-img-${String(item.id || mapped.length)}`,
        kind: 'image',
        title: String(item.title || query || 'Online Photo'),
        url: imgUrl,
        proxyUrl: makeProxyUrl(imgUrl),
        thumbUrl: thumbUrl.startsWith('https://') ? makeProxyUrl(thumbUrl) : makeProxyUrl(imgUrl),
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined,
        source: 'Openverse',
        author: typeof item.creator === 'string' ? item.creator : undefined,
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

async function searchWikimediaImages(query: string): Promise<OnlineMediaResult[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=14&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=720&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { pageid?: number; title?: string; imageinfo?: Array<Record<string, unknown>> }> };
    };
    const pages = Object.values(data?.query?.pages || {});
    const mapped: OnlineMediaResult[] = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = String(info.mime || '');
      if (!mime.startsWith('image/') || mime.includes('svg') || mime.includes('tiff')) continue;
      const fullUrl = String(info.thumburl || info.url || '');
      if (!fullUrl.startsWith('https://')) continue;
      const cleanTitle = String(page.title || '')
        .replace(/^File:/i, '')
        .replace(/\.[^.]+$/, '');
      mapped.push({
        id: `wm-img-${page.pageid || mapped.length}`,
        kind: 'image',
        title: cleanTitle || query,
        url: fullUrl,
        proxyUrl: makeProxyUrl(fullUrl),
        thumbUrl: makeProxyUrl(fullUrl),
        width: typeof info.thumbwidth === 'number' ? info.thumbwidth : undefined,
        height: typeof info.thumbheight === 'number' ? info.thumbheight : undefined,
        source: 'Wikimedia',
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

async function searchWikimediaVideos(query: string): Promise<OnlineMediaResult[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      `filetype:video ${query}`
    )}&gsrlimit=12&prop=imageinfo&iiprop=url|mime|size|mediatype&iiurlwidth=480&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { pageid?: number; title?: string; imageinfo?: Array<Record<string, unknown>> }> };
    };
    const pages = Object.values(data?.query?.pages || {});
    const mapped: OnlineMediaResult[] = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = String(info.mime || '');
      const videoUrl = String(info.url || '');
      if (!videoUrl.startsWith('https://')) continue;
      if (!mime.startsWith('video/') && !/\.(webm|mp4|ogv|mov)$/i.test(videoUrl)) continue;
      const thumbRaw = typeof info.thumburl === 'string' && info.thumburl.startsWith('https://') ? info.thumburl : '';
      const cleanTitle = String(page.title || '')
        .replace(/^File:/i, '')
        .replace(/\.[^.]+$/, '');
      const durationSec = typeof info.duration === 'number' && info.duration > 0 ? Math.round(info.duration) : 15;
      mapped.push({
        id: `wm-vid-${page.pageid || mapped.length}`,
        kind: 'video',
        title: cleanTitle || query,
        url: videoUrl,
        proxyUrl: makeProxyUrl(videoUrl),
        thumbUrl: thumbRaw ? makeProxyUrl(thumbRaw) : '',
        width: typeof info.width === 'number' ? info.width : undefined,
        height: typeof info.height === 'number' ? info.height : undefined,
        durationSec,
        source: 'Wikimedia Video',
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

async function searchOpenverseAudio(query: string, page = 1): Promise<OnlineAudioResult[]> {
  try {
    const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&page=${page}&page_size=14`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = Array.isArray(data?.results) ? data.results : [];
    const mapped: OnlineAudioResult[] = [];
    for (const item of results) {
      const audioUrl = typeof item.url === 'string' ? item.url : '';
      if (!audioUrl.startsWith('https://')) continue;
      const durMs = typeof item.duration === 'number' ? item.duration : 25000;
      const durSec = Math.max(2, Math.min(300, Math.round(durMs > 600 ? durMs / 1000 : durMs)));
      mapped.push({
        id: `ov-aud-${String(item.id || mapped.length)}`,
        title: String(item.title || query || 'Online Track'),
        artist: typeof item.creator === 'string' ? item.creator : 'Openverse CC',
        url: audioUrl,
        proxyUrl: makeProxyUrl(audioUrl),
        durationSec: durSec,
        durationLabel: formatDurationLabel(durSec),
        source: 'Openverse Audio',
        artworkUrl: typeof item.thumbnail === 'string' && item.thumbnail.startsWith('https://')
          ? makeProxyUrl(item.thumbnail)
          : undefined,
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

async function searchITunesAudio(query: string): Promise<OnlineAudioResult[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=12`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = Array.isArray(data?.results) ? data.results : [];
    const mapped: OnlineAudioResult[] = [];
    for (const item of results) {
      const previewUrl = typeof item.previewUrl === 'string' ? item.previewUrl : '';
      if (!previewUrl.startsWith('https://')) continue;
      const durSec = 30;
      mapped.push({
        id: `it-aud-${String(item.trackId || mapped.length)}`,
        title: String(item.trackName || query),
        artist: typeof item.artistName === 'string' ? item.artistName : undefined,
        url: previewUrl,
        proxyUrl: makeProxyUrl(previewUrl),
        durationSec: durSec,
        durationLabel: formatDurationLabel(durSec),
        source: 'Apple Preview',
        artworkUrl: typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : undefined,
      });
    }
    return mapped;
  } catch {
    return [];
  }
}

export function registerOnlineMediaRoutes(app: Express): void {
  app.get('/api/online/status', (_req: Request, res: Response) => {
    res.json({
      online: true,
      timestamp: Date.now(),
      providers: ['openverse', 'wikimedia', 'itunes', 'firestore'],
    });
  });

  app.get('/api/online/media', async (req: Request, res: Response) => {
    const q = String(req.query.q || 'cinematic abstract').trim() || 'cinematic abstract';
    const kind = String(req.query.kind || 'all');
    const page = Math.max(1, Number(req.query.page || 1) || 1);

    try {
      const tasks: Promise<OnlineMediaResult[]>[] = [];
      if (kind === 'all' || kind === 'image') {
        tasks.push(searchOpenverseImages(q, page), searchWikimediaImages(q));
      }
      if (kind === 'all' || kind === 'video') {
        tasks.push(searchWikimediaVideos(q));
      }
      const chunks = await Promise.all(tasks);
      const seen = new Set<string>();
      const items: OnlineMediaResult[] = [];
      for (const chunk of chunks) {
        for (const item of chunk) {
          if (seen.has(item.url)) continue;
          seen.add(item.url);
          items.push(item);
        }
      }
      res.json({ query: q, items: items.slice(0, 36) });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch online media',
        items: [],
      });
    }
  });

  app.get('/api/online/audio', async (req: Request, res: Response) => {
    const q = String(req.query.q || 'cinematic electronic').trim() || 'cinematic electronic';
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    try {
      const [ov, itunes] = await Promise.all([searchOpenverseAudio(q, page), searchITunesAudio(q)]);
      const seen = new Set<string>();
      const items: OnlineAudioResult[] = [];
      for (const item of [...ov, ...itunes]) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        items.push(item);
      }
      res.json({ query: q, items: items.slice(0, 24) });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch online audio',
        items: [],
      });
    }
  });

  // CORS-safe HTTPS media/audio/video proxy so WebGL, Canvas 2D & MP4 export never hit CORS taint
  app.get('/api/online/proxy', async (req: Request, res: Response) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).send('Missing url query parameter');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).send('Invalid URL');
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      res.status(400).send('Unsupported protocol');
      return;
    }

    if (isBlockedHostname(parsed.hostname)) {
      res.status(403).send('Blocked private host');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
      };
      if (typeof req.headers.range === 'string') {
        headers['Range'] = req.headers.range;
      }

      const upstream = await fetch(parsed.toString(), {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send('Upstream error');
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const isAllowedMedia =
        contentType.startsWith('image/') ||
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/') ||
        contentType === 'application/octet-stream' ||
        contentType === 'application/ogg';

      if (!isAllowedMedia) {
        res.status(415).send('Unsupported upstream media content-type');
        return;
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const arrayBuf = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (err) {
      res.status(502).send(err instanceof Error ? err.message : 'Proxy fetch error');
    }
  });
}
