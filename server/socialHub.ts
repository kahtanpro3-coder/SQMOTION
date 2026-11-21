import fs from 'fs';
import path from 'path';
import express, { Express, NextFunction, Request, Response } from 'express';
import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyFirebaseIdToken } from './firebaseAuthVerify';

export interface SocialCreator {
  uid: string;
  displayName: string;
  handle: string;
  role: string;
  bio: string;
  location: string;
  photoURL: string;
  specialties: string[];
  followersCount: number;
  followingCount: number;
  videosCount: number;
  isPrivateAccount?: boolean;
  dmPrivacy?: 'everyone' | 'followers';
  online?: boolean;
  updatedAt: number;
}

export interface SocialFollowEdge {
  followerId: string;
  targetId: string;
  createdAt: number;
}

export interface SocialDmMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  text: string;
  videoId?: string;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  createdAt: number;
}

export interface SocialDmThread {
  id: string;
  participants: [string, string];
  lastMessage: string;
  updatedAt: number;
  messages: SocialDmMessage[];
}

export type SocialNotificationKind =
  | 'dm_message'
  | 'dm_reply'
  | 'room_reply'
  | 'follow'
  | 'video_comment'
  | 'video_like';

export interface SocialNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderHandle?: string;
  senderPhoto?: string;
  kind: SocialNotificationKind;
  threadId?: string;
  messageId?: string;
  roomId?: string;
  videoId?: string;
  textPreview: string;
  read: boolean;
  createdAt: number;
}

export interface SocialRoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderHandle?: string;
  text: string;
  videoUrl?: string;
  replyToId?: string;
  replyToSender?: string;
  replyToText?: string;
  reactions?: Record<string, string[]>;
  viewsCount?: number;
  createdAt: number;
}

export interface SocialRoom {
  id: string;
  kind: 'channel' | 'group';
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  memberIds: string[];
  membersCount: number;
  pinnedMessageId?: string | null;
  createdAt: number;
  updatedAt: number;
  messages: SocialRoomMessage[];
}

export interface SocialVideoComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface SocialVideoPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorPhoto: string;
  title: string;
  description: string;
  mediaType?: 'video' | 'image';
  mediaUrls?: string[];
  videoUrl: string;
  posterUrl?: string;
  tags: string[];
  likedBy: string[];
  likesCount: number;
  viewsCount: number;
  durationSec?: number;
  comments: SocialVideoComment[];
  createdAt: number;
}

interface SocialStore {
  creators: SocialCreator[];
  follows: SocialFollowEdge[];
  dmThreads: SocialDmThread[];
  rooms: SocialRoom[];
  videos: SocialVideoPost[];
  notifications: SocialNotification[];
  seededDemoReels?: boolean;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const SOCIAL_FILE = path.join(DATA_DIR, 'social-hub.json');

function safeId(raw: string, prefix = 'id'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 96);
  return cleaned || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function buildDmThreadId(uidA: string, uidB: string): string {
  const sorted = [safeId(uidA, 'u'), safeId(uidB, 'u')].sort();
  return `dm_${sorted[0]}__${sorted[1]}`;
}

class SocialHub {
  private store: SocialStore = {
    creators: [],
    follows: [],
    dmThreads: [],
    rooms: [],
    videos: [],
    notifications: [],
  };

  private wsClients = new Map<WebSocket, { uid: string }>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
    this.ensureDefaultCommunitySpaces();
    this.ensureDefaultDemoReels();
  }

  private ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(SOCIAL_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SOCIAL_FILE, 'utf8')) as Partial<SocialStore>;
        this.store = {
          creators: Array.isArray(parsed.creators) ? parsed.creators : [],
          follows: Array.isArray(parsed.follows) ? parsed.follows : [],
          dmThreads: Array.isArray(parsed.dmThreads) ? parsed.dmThreads : [],
          rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
          videos: Array.isArray(parsed.videos) ? parsed.videos : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
          seededDemoReels: Boolean(parsed.seededDemoReels),
        };
      }
    } catch (err) {
      console.warn('[SocialHub] Failed to read disk store:', err);
    }
  }

  private ensureDefaultCommunitySpaces() {
    const now = Date.now();
    if (!this.store.rooms.some((r) => r.id === 'chan_motion_showcase')) {
      this.store.rooms.push({
        id: 'chan_motion_showcase',
        kind: 'channel',
        name: 'قناة عروض الموشن',
        description: 'القناة الرسمية لمشاركة أحدث أعمال الموشن جرافيكس والمؤثرات البصرية.',
        ownerId: 'sq_studio_official',
        ownerName: 'SQMOTION Studio',
        memberIds: [],
        membersCount: 0,
        createdAt: now,
        updatedAt: now,
        messages: [],
      });
    }
    if (!this.store.rooms.some((r) => r.id === 'grp_creators_lounge')) {
      this.store.rooms.push({
        id: 'grp_creators_lounge',
        kind: 'group',
        name: 'مجموعة مصممي الموشن',
        description: 'مجموعة تفاعلية لتبادل الخبرات، الأسئلة، وتقييم المشاريع بين المصممين.',
        ownerId: 'sq_studio_official',
        ownerName: 'SQMOTION Studio',
        memberIds: [],
        membersCount: 0,
        createdAt: now,
        updatedAt: now,
        messages: [],
      });
    }
    this.recomputeCounts();
  }

  private ensureDefaultDemoReels() {
    if (this.store.seededDemoReels || this.store.videos.length > 0) {
      return;
    }
    const now = Date.now();

    const demoCreators: Array<Omit<SocialCreator, 'followersCount' | 'followingCount' | 'videosCount'>> = [
      {
        uid: 'demo_creator_sara',
        displayName: 'سارة الموشن',
        handle: 'sara_motion',
        role: 'مخرجة موشن جرافيكس',
        bio: 'تصميم مؤثرات نيون وانتقالات سينمائية بـ 60 إطار/ثانية.',
        location: 'الرياض',
        photoURL: '',
        specialties: ['Motion Graphics', 'Transitions', 'Neon'],
        online: true,
        updatedAt: now - 120000,
      },
      {
        uid: 'demo_creator_omar',
        displayName: 'عمر 3D',
        handle: 'omar_3d',
        role: 'مصمم ثلاثي أبعاد',
        bio: 'مشاهد جزيئات، محاكاة ضوئية، وتجارب بصرية تفاعلية.',
        location: 'دبي',
        photoURL: '',
        specialties: ['3D Motion', 'Shaders', 'Particles'],
        online: true,
        updatedAt: now - 240000,
      },
      {
        uid: 'sq_studio_official',
        displayName: 'SQMOTION Studio',
        handle: 'sq_studio',
        role: 'استوديو الحركة الرسمي',
        bio: 'نماذج وإلهام يومي لمبدعي الموشن جرافيكس والمونتاج.',
        location: 'Studio Hub',
        photoURL: '',
        specialties: ['Showreel', 'Color Grading', 'Typography'],
        online: true,
        updatedAt: now - 360000,
      },
    ];

    for (const dc of demoCreators) {
      if (!this.store.creators.some((c) => c.uid === dc.uid)) {
        this.store.creators.push({
          ...dc,
          followersCount: 0,
          followingCount: 0,
          videosCount: 0,
        });
      }
    }

    const demoReels: SocialVideoPost[] = [
      {
        id: 'demo_reel_neon_orbit',
        authorId: 'demo_creator_sara',
        authorName: 'سارة الموشن',
        authorHandle: 'sara_motion',
        authorPhoto: '',
        title: 'حركة المدار النيوني السلسة 9:16',
        description: 'عرض تجريبي بتدرجات لونية متفاعلة وإيقاع حركي متوازن لمشاريع الريلز.',
        mediaType: 'video',
        mediaUrls: ['/demo-reels/demo_motion_neon.mp4'],
        videoUrl: '/demo-reels/demo_motion_neon.mp4',
        tags: ['موشن', 'نيون', 'انتقالات'],
        likedBy: ['demo_creator_omar', 'sq_studio_official'],
        likesCount: 2,
        viewsCount: 148,
        durationSec: 6,
        comments: [
          {
            id: 'demo_cmt_1',
            authorId: 'demo_creator_omar',
            authorName: 'عمر 3D',
            text: 'انسيابية الألوان رهيبة جداً!',
            createdAt: now - 90000,
          },
        ],
        createdAt: now - 60000,
      },
      {
        id: 'demo_reel_particles_life',
        authorId: 'demo_creator_omar',
        authorName: 'عمر 3D',
        authorHandle: 'omar_3d',
        authorPhoto: '',
        title: 'محاكاة الجزيئات الذكية المتنامية',
        description: 'خوارزمية توليد بصري مستمرة لإنتاج خلفيات موشن ديناميكية عالية التباين.',
        mediaType: 'video',
        mediaUrls: ['/demo-reels/demo_motion_particles.mp4'],
        videoUrl: '/demo-reels/demo_motion_particles.mp4',
        tags: ['جزيئات', '3D', 'تصميم'],
        likedBy: ['demo_creator_sara'],
        likesCount: 1,
        viewsCount: 96,
        durationSec: 6,
        comments: [],
        createdAt: now - 180000,
      },
      {
        id: 'demo_reel_photo_carousel',
        authorId: 'sq_studio_official',
        authorName: 'SQMOTION Studio',
        authorHandle: 'sq_studio',
        authorPhoto: '',
        title: 'ألبوم تدرجات الإضاءة والهوية البصرية',
        description: 'اسحب أو انقر للتنقل بين لوحات الألوان الاحترافية الجاهزة لمشاريعك القادمة.',
        mediaType: 'image',
        mediaUrls: [
          '/demo-reels/demo_slide_1.png',
          '/demo-reels/demo_slide_2.png',
          '/demo-reels/demo_slide_3.png',
        ],
        videoUrl: '/demo-reels/demo_slide_1.png',
        tags: ['صور', 'ألوان', 'هوية'],
        likedBy: ['demo_creator_sara', 'demo_creator_omar'],
        likesCount: 2,
        viewsCount: 112,
        comments: [],
        createdAt: now - 240000,
      },
      {
        id: 'demo_reel_fractal_chroma',
        authorId: 'demo_creator_sara',
        authorName: 'سارة الموشن',
        authorHandle: 'sara_motion',
        authorPhoto: '',
        title: 'تدفق الألوان الكروماتي اللانهائي',
        description: 'انتقال لوني حلقي مناسب لخلفيات المقدمات البصرية والمؤثرات.',
        mediaType: 'video',
        mediaUrls: ['/demo-reels/demo_motion_fractal.mp4'],
        videoUrl: '/demo-reels/demo_motion_fractal.mp4',
        tags: ['ألوان', 'مؤثرات', 'فيديو'],
        likedBy: [],
        likesCount: 0,
        viewsCount: 74,
        durationSec: 6,
        comments: [],
        createdAt: now - 320000,
      },
    ];

    this.store.videos.push(...demoReels);
    this.store.seededDemoReels = true;
    this.recomputeCounts();
    this.schedulePersist();
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        this.ensureDirs();
        fs.writeFileSync(SOCIAL_FILE, JSON.stringify(this.store, null, 2), 'utf8');
      } catch (err) {
        console.warn('[SocialHub] Persist failed:', err);
      }
    }, 250);
  }

  private recomputeCounts() {
    for (const c of this.store.creators) {
      c.followersCount = this.store.follows.filter((f) => f.targetId === c.uid).length;
      c.followingCount = this.store.follows.filter((f) => f.followerId === c.uid).length;
      c.videosCount = this.store.videos.filter((v) => v.authorId === c.uid).length;
    }
    for (const r of this.store.rooms) {
      r.membersCount = r.memberIds.length;
    }
  }

  private broadcastAll(payload: Record<string, unknown>) {
    const raw = JSON.stringify(payload);
    for (const [ws] of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  private sendToUsers(uids: string[], payload: Record<string, unknown>) {
    const targetSet = new Set(uids);
    const raw = JSON.stringify(payload);
    for (const [ws, meta] of this.wsClients) {
      if (targetSet.has(meta.uid) && ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  private createAndPushNotification(input: {
    recipientId: string;
    senderId: string;
    senderName?: string;
    senderHandle?: string;
    senderPhoto?: string;
    kind: SocialNotificationKind;
    threadId?: string;
    messageId?: string;
    roomId?: string;
    videoId?: string;
    textPreview: string;
  }): SocialNotification | null {
    const rId = safeId(input.recipientId, 'u');
    const sId = safeId(input.senderId, 'u');
    if (!rId || !sId || rId === sId) return null;

    const senderCreator = this.store.creators.find((c) => c.uid === sId);
    const now = Date.now();
    const notif: SocialNotification = {
      id: safeId(`notif_${now}_${Math.random().toString(36).slice(2, 7)}`, 'notif'),
      recipientId: rId,
      senderId: sId,
      senderName: String(input.senderName || senderCreator?.displayName || 'Creator').slice(0, 120),
      senderHandle: String(input.senderHandle || senderCreator?.handle || '').slice(0, 48),
      senderPhoto: String(input.senderPhoto || senderCreator?.photoURL || '').slice(0, 200000),
      kind: input.kind,
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
      ...(input.roomId ? { roomId: input.roomId } : {}),
      ...(input.videoId ? { videoId: input.videoId } : {}),
      textPreview: String(input.textPreview || '').trim().slice(0, 400),
      read: false,
      createdAt: now,
    };

    this.store.notifications.unshift(notif);
    if (this.store.notifications.length > 1500) {
      this.store.notifications = this.store.notifications.slice(0, 1500);
    }
    this.schedulePersist();
    this.sendToUsers([rId], { type: 'social:notification', notification: notif });
    return notif;
  }

  public upsertCreator(input: Partial<SocialCreator> & { uid: string }): SocialCreator {
    const uid = safeId(input.uid, 'user');
    const now = Date.now();
    const existing = this.store.creators.find((c) => c.uid === uid);
    const onlineSet = new Set(Array.from(this.wsClients.values()).map((v) => v.uid));

    if (existing) {
      if (input.displayName) existing.displayName = input.displayName.slice(0, 120);
      if (input.handle !== undefined) existing.handle = input.handle.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48);
      if (input.role !== undefined) existing.role = input.role.slice(0, 80);
      if (input.bio !== undefined) existing.bio = input.bio.slice(0, 360);
      if (input.location !== undefined) existing.location = input.location.slice(0, 80);
      if (input.photoURL !== undefined) existing.photoURL = input.photoURL.slice(0, 200000);
      if (Array.isArray(input.specialties)) existing.specialties = input.specialties.slice(0, 8);
      if (typeof input.isPrivateAccount === 'boolean') existing.isPrivateAccount = input.isPrivateAccount;
      if (input.dmPrivacy === 'everyone' || input.dmPrivacy === 'followers') {
        existing.dmPrivacy = input.dmPrivacy;
      }
      existing.online = onlineSet.has(uid);
      existing.updatedAt = now;
      this.recomputeCounts();
      this.schedulePersist();
      this.broadcastAll({ type: 'social:creator_updated', creator: existing });
      return existing;
    }

    const created: SocialCreator = {
      uid,
      displayName: (input.displayName || 'Creator').slice(0, 120),
      handle: (input.handle || `user_${uid.slice(0, 6)}`).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48),
      role: (input.role || 'Motion Designer').slice(0, 80),
      bio: (input.bio || '').slice(0, 360),
      location: (input.location || '').slice(0, 80),
      photoURL: (input.photoURL || '').slice(0, 200000),
      specialties: Array.isArray(input.specialties) ? input.specialties.slice(0, 8) : [],
      followersCount: 0,
      followingCount: 0,
      videosCount: 0,
      isPrivateAccount: Boolean(input.isPrivateAccount),
      dmPrivacy: input.dmPrivacy === 'followers' ? 'followers' : 'everyone',
      online: onlineSet.has(uid),
      updatedAt: now,
    };
    this.store.creators.unshift(created);
    this.recomputeCounts();
    this.schedulePersist();
    this.broadcastAll({ type: 'social:creator_updated', creator: created });
    return created;
  }

  public searchCreators(queryText: string, viewerUid?: string): SocialCreator[] {
    const onlineSet = new Set(Array.from(this.wsClients.values()).map((v) => v.uid));
    const q = queryText.trim().toLowerCase();
    const list = this.store.creators.map((c) => {
      const canSeeFull =
        !c.isPrivateAccount ||
        c.uid === viewerUid ||
        (viewerUid ? this.store.follows.some((f) => f.followerId === viewerUid && f.targetId === c.uid) : false);
      if (canSeeFull) {
        return { ...c, online: onlineSet.has(c.uid) };
      }
      return {
        ...c,
        bio: '',
        location: '',
        online: onlineSet.has(c.uid),
      };
    });
    if (!q) return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
    return list
      .filter((c) => {
        const hay = `${c.displayName} ${c.handle} ${c.role} ${c.location} ${c.specialties.join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }

  public toggleFollow(followerId: string, targetId: string): { following: boolean; creator?: SocialCreator } {
    const fId = safeId(followerId, 'u');
    const tId = safeId(targetId, 'u');
    if (fId === tId) return { following: false };

    const idx = this.store.follows.findIndex((f) => f.followerId === fId && f.targetId === tId);
    let following = false;
    if (idx >= 0) {
      this.store.follows.splice(idx, 1);
      following = false;
    } else {
      this.store.follows.push({ followerId: fId, targetId: tId, createdAt: Date.now() });
      following = true;
    }
    this.recomputeCounts();
    this.schedulePersist();
    const targetCreator = this.store.creators.find((c) => c.uid === tId);
    const followerCreator = this.store.creators.find((c) => c.uid === fId);
    this.broadcastAll({
      type: 'social:follow_updated',
      followerId: fId,
      targetId: tId,
      following,
      targetCreator,
      followerCreator,
    });
    if (following) {
      this.createAndPushNotification({
        recipientId: tId,
        senderId: fId,
        senderName: followerCreator?.displayName,
        senderHandle: followerCreator?.handle,
        senderPhoto: followerCreator?.photoURL,
        kind: 'follow',
        textPreview: 'بدأ بمتابعتك الآن',
      });
    }
    return { following, creator: targetCreator };
  }

  public attachWebSocketServer(server: http.Server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      try {
        const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
        if (url.pathname !== '/ws/social') return;
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } catch {
        socket.destroy();
      }
    });

    wss.on('connection', async (ws, request) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      const verified = await verifyFirebaseIdToken(token);
      if (!verified) {
        ws.close(4001, 'Authentication required');
        return;
      }

      const uid = safeId(verified.uid, 'user');
      const name = (verified.name || url.searchParams.get('name') || 'Creator').slice(0, 120);

      this.wsClients.set(ws, { uid });
      const creator = this.store.creators.find((c) => c.uid === uid);
      if (creator) {
        creator.online = true;
        this.broadcastAll({ type: 'social:presence', uid, online: true });
      } else {
        this.upsertCreator({
          uid,
          displayName: name,
          photoURL: verified.picture || '',
        });
      }

      ws.send(JSON.stringify({ type: 'social:connected', uid }));

      ws.on('close', () => {
        this.wsClients.delete(ws);
        const stillOnline = Array.from(this.wsClients.values()).some((m) => m.uid === uid);
        if (!stillOnline) {
          const target = this.store.creators.find((c) => c.uid === uid);
          if (target) target.online = false;
          this.broadcastAll({ type: 'social:presence', uid, online: false });
        }
      });
    });
  }

  private async extractAuthUid(req: Request): Promise<string | null> {
    const authHeader = String(req.headers.authorization || '');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const verified = await verifyFirebaseIdToken(match[1]);
    return verified ? safeId(verified.uid, 'u') : null;
  }

  private requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const uid = await this.extractAuthUid(req);
    if (!uid) {
      res.status(401).json({ error: 'Authentication required for protected account access' });
      return;
    }
    (req as Request & { authUid: string }).authUid = uid;
    next();
  };

  public registerRoutes(app: Express) {
    // Creators search & upsert (upsert strictly bound to verified token uid)
    app.get('/api/social/creators', async (req: Request, res: Response) => {
      const viewerUid = await this.extractAuthUid(req);
      const q = String(req.query.q || '');
      res.json({ creators: this.searchCreators(q, viewerUid || undefined) });
    });

    app.post('/api/social/creators', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const body = req.body || {};
      const creator = this.upsertCreator({ ...body, uid: authUid });
      res.json({ creator });
    });

    // Notifications Inbox (strictly private to authenticated owner)
    app.get('/api/social/notifications', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const list = this.store.notifications
        .filter((n) => n.recipientId === authUid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 80);
      const unreadCount = list.filter((n) => !n.read).length;
      res.json({ notifications: list, unreadCount });
    });

    app.post('/api/social/notifications/read', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const { notificationId, threadId, all } = req.body || {};
      let changed = false;
      for (const n of this.store.notifications) {
        if (n.recipientId !== authUid || n.read) continue;
        if (all || (notificationId && n.id === notificationId) || (threadId && n.threadId === threadId)) {
          n.read = true;
          changed = true;
        }
      }
      if (changed) {
        this.schedulePersist();
        this.sendToUsers([authUid], {
          type: 'social:notifications_read',
          notificationId,
          threadId,
          all: Boolean(all),
        });
      }
      res.json({ ok: true });
    });

    // Followers graph
    app.get('/api/social/follows/:uid', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const followerIds = this.store.follows.filter((f) => f.targetId === authUid).map((f) => f.followerId);
      const followingIds = this.store.follows.filter((f) => f.followerId === authUid).map((f) => f.targetId);
      res.json({ followerIds, followingIds });
    });

    app.post('/api/social/follow', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const { targetId } = req.body || {};
      if (!targetId) {
        res.status(400).json({ error: 'targetId is required' });
        return;
      }
      const result = this.toggleFollow(authUid, targetId);
      res.json(result);
    });

    // Direct Messaging 1:1 (strictly private to participants & verified senderId)
    app.get('/api/social/dm/threads', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const threads = this.store.dmThreads
        .filter((t) => t.participants.includes(authUid))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      res.json({ threads });
    });

    app.post('/api/social/dm/send', this.requireAuth, (req: Request, res: Response) => {
      const sId = (req as Request & { authUid: string }).authUid;
      const { senderName, recipientId, text, videoId, replyToId, replyToSender, replyToText } =
        req.body || {};
      if (!recipientId || !String(text || '').trim()) {
        res.status(400).json({ error: 'recipientId and text are required' });
        return;
      }
      const rId = safeId(recipientId, 'u');
      const recipientCreator = this.store.creators.find((c) => c.uid === rId);
      if (recipientCreator?.dmPrivacy === 'followers' && rId !== sId) {
        const followsRecipient = this.store.follows.some(
          (f) => f.followerId === sId && f.targetId === rId
        );
        const threadExists = this.store.dmThreads.some(
          (t) => t.participants.includes(sId) && t.participants.includes(rId)
        );
        if (!followsRecipient && !threadExists) {
          res.status(403).json({
            error: 'This protected account only accepts new messages from followers',
          });
          return;
        }
      }

      const threadId = buildDmThreadId(sId, rId);
      let thread = this.store.dmThreads.find((t) => t.id === threadId);
      const now = Date.now();
      const cleanText = String(text).trim().slice(0, 2000);
      if (!thread) {
        thread = {
          id: threadId,
          participants: [sId, rId].sort() as [string, string],
          lastMessage: cleanText.slice(0, 180),
          updatedAt: now,
          messages: [],
        };
        this.store.dmThreads.unshift(thread);
      }
      const senderCreator = this.store.creators.find((c) => c.uid === sId);
      const resolvedSenderName = String(senderName || senderCreator?.displayName || 'Creator').slice(0, 120);
      const msg: SocialDmMessage = {
        id: safeId(`msg_${now}_${Math.random().toString(36).slice(2, 6)}`, 'msg'),
        threadId,
        senderId: sId,
        senderName: resolvedSenderName,
        text: cleanText,
        ...(videoId ? { videoId: safeId(String(videoId), 'vid') } : {}),
        ...(replyToId ? { replyToId: safeId(String(replyToId), 'msg') } : {}),
        ...(replyToSender ? { replyToSender: String(replyToSender).slice(0, 120) } : {}),
        ...(replyToText ? { replyToText: String(replyToText).slice(0, 240) } : {}),
        createdAt: now,
      };
      if (!thread.messages.some((m) => m.id === msg.id)) {
        thread.messages.push(msg);
      }
      thread.lastMessage = cleanText.slice(0, 180);
      thread.updatedAt = now;
      this.schedulePersist();
      this.sendToUsers([sId, rId], { type: 'social:dm_message', threadId, message: msg, thread });

      const notification = this.createAndPushNotification({
        recipientId: rId,
        senderId: sId,
        senderName: resolvedSenderName,
        senderHandle: senderCreator?.handle,
        senderPhoto: senderCreator?.photoURL,
        kind: replyToId ? 'dm_reply' : 'dm_message',
        threadId,
        messageId: msg.id,
        textPreview: cleanText,
      });

      res.json({ thread, message: msg, notification });
    });

    // Channels & Groups
    app.get('/api/social/rooms', (req: Request, res: Response) => {
      const kind = String(req.query.kind || 'all');
      const rooms = this.store.rooms
        .filter((r) => kind === 'all' || r.kind === kind)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      res.json({ rooms });
    });

    app.post('/api/social/rooms', this.requireAuth, (req: Request, res: Response) => {
      const cleanOwner = (req as Request & { authUid: string }).authUid;
      const { kind, name, description, ownerName } = req.body || {};
      if (!name || (kind !== 'channel' && kind !== 'group')) {
        res.status(400).json({ error: 'kind (channel|group) and name are required' });
        return;
      }
      const now = Date.now();
      const room: SocialRoom = {
        id: safeId(`${kind === 'channel' ? 'chan' : 'grp'}_${now}_${Math.random().toString(36).slice(2, 6)}`, 'room'),
        kind,
        name: String(name).trim().slice(0, 100),
        description: String(description || '').trim().slice(0, 400),
        ownerId: cleanOwner,
        ownerName: String(ownerName || 'Creator').slice(0, 120),
        memberIds: [cleanOwner],
        membersCount: 1,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      this.store.rooms.unshift(room);
      this.schedulePersist();
      this.broadcastAll({ type: 'social:room_updated', room });
      res.json({ room });
    });

    app.post('/api/social/rooms/:roomId/join', this.requireAuth, (req: Request, res: Response) => {
      const room = this.store.rooms.find((r) => r.id === req.params.roomId);
      const uid = (req as Request & { authUid: string }).authUid;
      if (!room || !uid) {
        res.status(404).json({ error: 'Room or user not found' });
        return;
      }
      const already = room.memberIds.includes(uid);
      if (already) {
        room.memberIds = room.memberIds.filter((id) => id !== uid);
      } else {
        room.memberIds.push(uid);
      }
      room.membersCount = room.memberIds.length;
      room.updatedAt = Date.now();
      this.schedulePersist();
      this.broadcastAll({ type: 'social:room_updated', room });
      res.json({ room, joined: !already });
    });

    app.post('/api/social/rooms/:roomId/messages', this.requireAuth, (req: Request, res: Response) => {
      const room = this.store.rooms.find((r) => r.id === req.params.roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      const cleanSender = (req as Request & { authUid: string }).authUid;
      const {
        senderName,
        senderHandle,
        text,
        videoUrl,
        replyToId,
        replyToSender,
        replyToText,
      } = req.body || {};
      if (!String(text || '').trim() && !String(videoUrl || '').trim()) {
        res.status(400).json({ error: 'text or videoUrl is required' });
        return;
      }
      // Broadcast channels: only owner posts (unless official community starter room)
      if (room.kind === 'channel' && room.ownerId !== 'sq_studio_official' && room.ownerId !== cleanSender) {
        res.status(403).json({ error: 'Only channel owner can broadcast posts' });
        return;
      }
      if (!room.memberIds.includes(cleanSender)) {
        room.memberIds.push(cleanSender);
        room.membersCount = room.memberIds.length;
      }
      const now = Date.now();
      const msg: SocialRoomMessage = {
        id: safeId(`rmsg_${now}_${Math.random().toString(36).slice(2, 6)}`, 'rmsg'),
        roomId: room.id,
        senderId: cleanSender,
        senderName: String(senderName || 'Creator').slice(0, 120),
        senderHandle: String(senderHandle || '').slice(0, 48),
        text: String(text || '').trim().slice(0, 2000),
        ...(videoUrl ? { videoUrl: String(videoUrl).slice(0, 500) } : {}),
        ...(replyToId ? { replyToId: safeId(String(replyToId), 'rmsg') } : {}),
        ...(replyToSender ? { replyToSender: String(replyToSender).slice(0, 120) } : {}),
        ...(replyToText ? { replyToText: String(replyToText).slice(0, 180) } : {}),
        reactions: {},
        viewsCount: 1,
        createdAt: now,
      };
      room.messages.push(msg);
      room.updatedAt = now;
      this.schedulePersist();
      this.broadcastAll({ type: 'social:room_message', roomId: room.id, message: msg, room });

      if (replyToId) {
        const targetMsg = room.messages.find((m) => m.id === replyToId);
        if (targetMsg && targetMsg.senderId !== cleanSender) {
          this.createAndPushNotification({
            recipientId: targetMsg.senderId,
            senderId: cleanSender,
            senderName: msg.senderName,
            senderHandle: msg.senderHandle,
            kind: 'room_reply',
            roomId: room.id,
            messageId: msg.id,
            textPreview: `${room.name}: ${msg.text || '🎬'}`,
          });
        }
      }

      res.json({ message: msg, room });
    });

    app.post('/api/social/rooms/:roomId/react', this.requireAuth, (req: Request, res: Response) => {
      const room = this.store.rooms.find((r) => r.id === req.params.roomId);
      const cleanUid = (req as Request & { authUid: string }).authUid;
      const { messageId, emoji } = req.body || {};
      const cleanEmoji = String(emoji || '').trim().slice(0, 8);
      if (!room || !messageId || !cleanEmoji) {
        res.status(400).json({ error: 'Invalid reaction request' });
        return;
      }
      const msg = room.messages.find((m) => m.id === messageId);
      if (!msg) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      if (!msg.reactions) msg.reactions = {};
      const current = Array.isArray(msg.reactions[cleanEmoji]) ? msg.reactions[cleanEmoji] : [];
      if (current.includes(cleanUid)) {
        const filtered = current.filter((id) => id !== cleanUid);
        if (filtered.length === 0) delete msg.reactions[cleanEmoji];
        else msg.reactions[cleanEmoji] = filtered;
      } else {
        msg.reactions[cleanEmoji] = [...current, cleanUid];
      }
      this.schedulePersist();
      this.broadcastAll({ type: 'social:room_updated', room });
      res.json({ room });
    });

    app.post('/api/social/rooms/:roomId/pin', this.requireAuth, (req: Request, res: Response) => {
      const room = this.store.rooms.find((r) => r.id === req.params.roomId);
      const cleanUid = (req as Request & { authUid: string }).authUid;
      const { messageId } = req.body || {};
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      if (room.kind === 'channel' && room.ownerId !== 'sq_studio_official' && room.ownerId !== cleanUid) {
        res.status(403).json({ error: 'Only channel owner can pin messages' });
        return;
      }
      room.pinnedMessageId = room.pinnedMessageId === messageId ? null : String(messageId || '');
      this.schedulePersist();
      this.broadcastAll({ type: 'social:room_updated', room });
      res.json({ room });
    });

    // Video & Photo binary upload (up to 150MB) + Range streaming
    const handleMediaUpload = (req: Request, res: Response) => {
      try {
        this.ensureDirs();
        const buf = req.body as Buffer;
        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          res.status(400).json({ error: 'Empty media payload' });
          return;
        }
        const ct = String(req.headers['content-type'] || '').toLowerCase();
        const rawFileName = decodeURIComponent(String(req.headers['x-file-name'] || '')).toLowerCase();
        const fileExt = path.extname(rawFileName);

        let ext = '.mp4';
        let mediaType: 'video' | 'image' = 'video';
        if (ct.includes('image/png') || fileExt === '.png') {
          ext = '.png';
          mediaType = 'image';
        } else if (ct.includes('image/webp') || fileExt === '.webp') {
          ext = '.webp';
          mediaType = 'image';
        } else if (ct.includes('image/gif') || fileExt === '.gif') {
          ext = '.gif';
          mediaType = 'image';
        } else if (ct.includes('image/avif') || fileExt === '.avif') {
          ext = '.avif';
          mediaType = 'image';
        } else if (ct.includes('image/heic') || ct.includes('image/heif') || fileExt === '.heic') {
          ext = '.heic';
          mediaType = 'image';
        } else if (ct.includes('image/') || ['.jpg', '.jpeg'].includes(fileExt)) {
          ext = '.jpg';
          mediaType = 'image';
        } else if (ct.includes('webm') || fileExt === '.webm') {
          ext = '.webm';
        } else if (ct.includes('quicktime') || fileExt === '.mov') {
          ext = '.mov';
        } else if (ct.includes('matroska') || fileExt === '.mkv') {
          ext = '.mkv';
        } else if (fileExt === '.m4v') {
          ext = '.m4v';
        }

        const prefix = mediaType === 'image' ? 'img' : 'vid';
        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        fs.writeFileSync(path.join(VIDEOS_DIR, filename), buf);
        const mediaUrl = `/api/social/videos/file/${filename}`;
        res.json({ videoUrl: mediaUrl, mediaUrl, mediaType, sizeBytes: buf.length });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      }
    };

    app.post(
      '/api/social/upload-video',
      this.requireAuth,
      express.raw({ type: ['video/*', 'image/*', 'application/octet-stream'], limit: '150mb' }),
      handleMediaUpload
    );

    app.post(
      '/api/social/upload-media',
      this.requireAuth,
      express.raw({ type: ['video/*', 'image/*', 'application/octet-stream'], limit: '150mb' }),
      handleMediaUpload
    );

    app.get('/api/social/videos/file/:filename', (req: Request, res: Response) => {
      const cleanName = path.basename(String(req.params.filename || '')).replace(/[^a-zA-Z0-9_.\-]/g, '');
      const fullPath = path.join(VIDEOS_DIR, cleanName);
      if (!cleanName || !fs.existsSync(fullPath)) {
        res.status(404).send('Media not found');
        return;
      }
      const stat = fs.statSync(fullPath);
      const total = stat.size;
      const lower = cleanName.toLowerCase();
      const mime = lower.endsWith('.webm')
        ? 'video/webm'
        : lower.endsWith('.mov')
        ? 'video/quicktime'
        : lower.endsWith('.mkv')
        ? 'video/x-matroska'
        : lower.endsWith('.m4v')
        ? 'video/x-m4v'
        : lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
        ? 'image/webp'
        : lower.endsWith('.gif')
        ? 'image/gif'
        : lower.endsWith('.avif')
        ? 'image/avif'
        : lower.endsWith('.heic')
        ? 'image/heic'
        : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'video/mp4';

      const range = req.headers.range;
      if (range && mime.startsWith('video/')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? Math.min(total - 1, parseInt(parts[1], 10)) : total - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
        });
        fs.createReadStream(fullPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': total,
          'Accept-Ranges': 'bytes',
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400',
        });
        fs.createReadStream(fullPath).pipe(res);
      }
    });

    // Video & Photo Feed CRUD, Like, Comment, View
    app.get('/api/social/videos', (_req: Request, res: Response) => {
      const videos = [...this.store.videos].sort((a, b) => b.createdAt - a.createdAt);
      res.json({ videos });
    });

    app.post('/api/social/videos', this.requireAuth, (req: Request, res: Response) => {
      const authUid = (req as Request & { authUid: string }).authUid;
      const {
        authorName,
        authorHandle,
        authorPhoto,
        title,
        description,
        mediaType,
        mediaUrls,
        videoUrl,
        posterUrl,
        tags,
        durationSec,
      } = req.body || {};
      const cleanMediaUrls: string[] = Array.isArray(mediaUrls)
        ? mediaUrls.map((u) => String(u || '').trim().slice(0, 1000)).filter(Boolean).slice(0, 10)
        : [];
      const primaryUrl = String(videoUrl || cleanMediaUrls[0] || '').trim().slice(0, 1000);
      if (!title || !primaryUrl) {
        res.status(400).json({ error: 'title and media URL are required' });
        return;
      }
      const inferredType: 'video' | 'image' =
        mediaType === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(primaryUrl)
          ? 'image'
          : 'video';
      const now = Date.now();
      const post: SocialVideoPost = {
        id: safeId(`vid_${now}_${Math.random().toString(36).slice(2, 6)}`, 'vid'),
        authorId: authUid,
        authorName: String(authorName || 'Creator').slice(0, 120),
        authorHandle: String(authorHandle || 'creator').slice(0, 48),
        authorPhoto: String(authorPhoto || '').slice(0, 200000),
        title: String(title).trim().slice(0, 140),
        description: String(description || '').trim().slice(0, 600),
        mediaType: inferredType,
        mediaUrls: cleanMediaUrls.length > 0 ? cleanMediaUrls : [primaryUrl],
        videoUrl: primaryUrl,
        posterUrl: posterUrl ? String(posterUrl).slice(0, 200000) : undefined,
        tags: Array.isArray(tags) ? tags.map((t) => String(t).slice(0, 32)).slice(0, 10) : [],
        likedBy: [],
        likesCount: 0,
        viewsCount: 0,
        durationSec: typeof durationSec === 'number' ? durationSec : undefined,
        comments: [],
        createdAt: now,
      };
      this.store.videos.unshift(post);
      this.recomputeCounts();
      this.schedulePersist();
      this.broadcastAll({ type: 'social:video_created', video: post });
      res.json({ video: post });
    });

    app.post('/api/social/videos/:videoId/like', this.requireAuth, (req: Request, res: Response) => {
      const vid = this.store.videos.find((v) => v.id === req.params.videoId);
      const uid = (req as Request & { authUid: string }).authUid;
      if (!vid || !uid) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }
      const hasLiked = vid.likedBy.includes(uid);
      if (hasLiked) {
        vid.likedBy = vid.likedBy.filter((id) => id !== uid);
      } else {
        vid.likedBy.push(uid);
        this.createAndPushNotification({
          recipientId: vid.authorId,
          senderId: uid,
          kind: 'video_like',
          videoId: vid.id,
          textPreview: `أعجب بمنشورك: ${vid.title}`,
        });
      }
      vid.likesCount = vid.likedBy.length;
      this.schedulePersist();
      this.broadcastAll({ type: 'social:video_updated', video: vid });
      res.json({ video: vid });
    });

    app.post('/api/social/videos/:videoId/view', (req: Request, res: Response) => {
      const vid = this.store.videos.find((v) => v.id === req.params.videoId);
      if (!vid) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }
      vid.viewsCount = (vid.viewsCount || 0) + 1;
      this.schedulePersist();
      res.json({ viewsCount: vid.viewsCount });
    });

    app.post('/api/social/videos/:videoId/comments', this.requireAuth, (req: Request, res: Response) => {
      const vid = this.store.videos.find((v) => v.id === req.params.videoId);
      const authUid = (req as Request & { authUid: string }).authUid;
      const { authorName, text } = req.body || {};
      if (!vid || !String(text || '').trim()) {
        res.status(400).json({ error: 'Video not found or empty comment' });
        return;
      }
      const comment: SocialVideoComment = {
        id: safeId(`cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, 'cmt'),
        authorId: authUid,
        authorName: String(authorName || 'Creator').slice(0, 120),
        text: String(text).trim().slice(0, 600),
        createdAt: Date.now(),
      };
      vid.comments.push(comment);
      this.schedulePersist();
      this.broadcastAll({ type: 'social:video_updated', video: vid });
      this.createAndPushNotification({
        recipientId: vid.authorId,
        senderId: authUid,
        senderName: comment.authorName,
        kind: 'video_comment',
        videoId: vid.id,
        textPreview: `${vid.title}: ${comment.text}`,
      });
      res.json({ comment, video: vid });
    });

    app.delete('/api/social/videos/:videoId', this.requireAuth, (req: Request, res: Response) => {
      const uid = (req as Request & { authUid: string }).authUid;
      const idx = this.store.videos.findIndex((v) => v.id === req.params.videoId);
      if (idx < 0) {
        res.status(404).json({ error: 'Video not found' });
        return;
      }
      if (this.store.videos[idx].authorId !== uid) {
        res.status(403).json({ error: 'Only author can delete video' });
        return;
      }
      const [removed] = this.store.videos.splice(idx, 1);
      this.recomputeCounts();
      this.schedulePersist();
      this.broadcastAll({ type: 'social:video_deleted', videoId: removed.id });
      res.json({ ok: true });
    });
  }
}

export const socialHub = new SocialHub();
