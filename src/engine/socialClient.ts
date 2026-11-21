import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  auth,
  createFirestoreNotification,
  db,
  getAuthIdToken,
  handleFirestoreError,
  markFirestoreNotificationRead,
  OperationType,
  syncPublicCreatorToFirestore,
} from '../lib/firebase';

export interface ClientSocialCreator {
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

export interface ClientDmMessage {
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

export interface ClientDmThread {
  id: string;
  participants: [string, string];
  lastMessage: string;
  updatedAt: number;
  messages: ClientDmMessage[];
}

export type ClientSocialNotificationKind =
  | 'dm_message'
  | 'dm_reply'
  | 'room_reply'
  | 'follow'
  | 'video_comment'
  | 'video_like';

export interface ClientSocialNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderHandle?: string;
  senderPhoto?: string;
  kind: ClientSocialNotificationKind;
  threadId?: string;
  messageId?: string;
  roomId?: string;
  videoId?: string;
  textPreview: string;
  read: boolean;
  createdAt: number;
}

export interface ClientRoomMessage {
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

export interface ClientSocialRoom {
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
  messages: ClientRoomMessage[];
}

export interface ClientVideoComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface ClientSocialVideo {
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
  comments: ClientVideoComment[];
  createdAt: number;
}

export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5 crisp gentle ping
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.085);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.075, now + idx * 0.085 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.085 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.085);
      osc.stop(now + idx * 0.085 + 0.26);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // Audio playback blocked prior to user interaction
  }
}

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthIdToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}

export function useSocialNetwork(identity: {
  uid: string;
  displayName: string;
  handle: string;
  role: string;
  bio: string;
  location: string;
  photoURL: string;
  specialties: string[];
  isPrivateAccount?: boolean;
  dmPrivacy?: 'everyone' | 'followers';
  isActive: boolean;
}) {
  const [creators, setCreators] = useState<ClientSocialCreator[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [dmThreads, setDmThreads] = useState<ClientDmThread[]>([]);
  const [rooms, setRooms] = useState<ClientSocialRoom[]>([]);
  const [videos, setVideos] = useState<ClientSocialVideo[]>([]);
  const [notifications, setNotifications] = useState<ClientSocialNotification[]>([]);
  const [latestToastNotification, setLatestToastNotification] =
    useState<ClientSocialNotification | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushIncomingNotification = useCallback(
    (incoming: ClientSocialNotification, shouldAlert: boolean) => {
      if (!incoming?.id || incoming.recipientId !== identity.uid) return;

      setNotifications((prev) => {
        const exists = prev.some((n) => n.id === incoming.id);
        if (exists) {
          return prev.map((n) => (n.id === incoming.id ? { ...n, ...incoming } : n));
        }
        return [incoming, ...prev]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 80);
      });

      const isFresh =
        shouldAlert &&
        !incoming.read &&
        !seenNotifIdsRef.current.has(incoming.id) &&
        incoming.createdAt >= mountedAtRef.current - 5000;

      seenNotifIdsRef.current.add(incoming.id);

      if (isFresh) {
        playNotificationChime();
        setLatestToastNotification(incoming);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setLatestToastNotification((cur) => (cur?.id === incoming.id ? null : cur));
        }, 9000);
      }
    },
    [identity.uid]
  );

  const dismissToastNotification = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLatestToastNotification(null);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!identity.uid) return;
    setLoading(true);
    try {
      const [cRes, fRes, dmRes, rRes, vRes, nRes] = await Promise.all([
        authFetch('/api/social/creators').then((r) => (r.ok ? r.json() : { creators: [] })),
        authFetch(`/api/social/follows/${encodeURIComponent(identity.uid)}`).then((r) =>
          r.ok ? r.json() : { followerIds: [], followingIds: [] }
        ),
        authFetch('/api/social/dm/threads').then((r) =>
          r.ok ? r.json() : { threads: [] }
        ),
        authFetch('/api/social/rooms').then((r) => (r.ok ? r.json() : { rooms: [] })),
        authFetch('/api/social/videos').then((r) => (r.ok ? r.json() : { videos: [] })),
        authFetch('/api/social/notifications').then((r) =>
          r.ok ? r.json() : { notifications: [] }
        ),
      ]);

      let mergedCreators: ClientSocialCreator[] = Array.isArray(cRes.creators) ? cRes.creators : [];
      let mergedVideos: ClientSocialVideo[] = Array.isArray(vRes.videos) ? vRes.videos : [];
      let mergedRooms: ClientSocialRoom[] = Array.isArray(rRes.rooms) ? rRes.rooms : [];

      try {
        const [fsCreatorsSnap, fsVideosSnap, fsRoomsSnap] = await Promise.all([
          getDocs(query(collection(db, 'public_creators'), orderBy('updatedAt', 'desc'), limit(40))),
          getDocs(query(collection(db, 'social_videos'), orderBy('createdAt', 'desc'), limit(40))),
          getDocs(query(collection(db, 'social_rooms'), orderBy('updatedAt', 'desc'), limit(30))),
        ]);

        const cMap = new Map<string, ClientSocialCreator>();
        for (const c of mergedCreators) cMap.set(c.uid, c);
        fsCreatorsSnap.forEach((d) => {
          const v = d.data() as Partial<ClientSocialCreator>;
          if (v.uid && !cMap.has(v.uid)) {
            cMap.set(v.uid, {
              uid: v.uid,
              displayName: v.displayName || 'Creator',
              handle: v.handle || '',
              role: v.role || 'Motion Designer',
              bio: v.isPrivateAccount && v.uid !== identity.uid ? '' : v.bio || '',
              location: v.isPrivateAccount && v.uid !== identity.uid ? '' : v.location || '',
              photoURL: v.photoURL || '',
              specialties: Array.isArray(v.specialties) ? v.specialties : [],
              followersCount: v.followersCount || 0,
              followingCount: v.followingCount || 0,
              videosCount: v.videosCount || 0,
              isPrivateAccount: Boolean(v.isPrivateAccount),
              dmPrivacy: v.dmPrivacy === 'followers' ? 'followers' : 'everyone',
              updatedAt: v.updatedAt || Date.now(),
            });
          }
        });
        mergedCreators = Array.from(cMap.values());

        const vMap = new Map<string, ClientSocialVideo>();
        for (const v of mergedVideos) vMap.set(v.id, v);
        fsVideosSnap.forEach((d) => {
          const v = d.data() as Partial<ClientSocialVideo>;
          if (v.id && v.videoUrl && !vMap.has(v.id)) {
            const isImg = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(v.videoUrl);
            vMap.set(v.id, {
              id: v.id,
              authorId: v.authorId || '',
              authorName: v.authorName || 'Creator',
              authorHandle: v.authorHandle || '',
              authorPhoto: v.authorPhoto || '',
              title: v.title || 'Motion Post',
              description: v.description || '',
              mediaType: isImg ? 'image' : 'video',
              mediaUrls: [v.videoUrl],
              videoUrl: v.videoUrl,
              posterUrl: v.posterUrl,
              tags: Array.isArray(v.tags) ? v.tags : [],
              likedBy: Array.isArray(v.likedBy) ? v.likedBy : [],
              likesCount: v.likesCount || 0,
              viewsCount: v.viewsCount || 0,
              durationSec: v.durationSec,
              comments: [],
              createdAt: v.createdAt || Date.now(),
            });
          }
        });
        mergedVideos = Array.from(vMap.values()).sort((a, b) => b.createdAt - a.createdAt);

        const rMap = new Map<string, ClientSocialRoom>();
        for (const r of mergedRooms) rMap.set(r.id, r);
        fsRoomsSnap.forEach((d) => {
          const r = d.data() as Partial<ClientSocialRoom>;
          if (r.id && r.name && !rMap.has(r.id)) {
            rMap.set(r.id, {
              id: r.id,
              kind: r.kind === 'channel' ? 'channel' : 'group',
              name: r.name,
              description: r.description || '',
              ownerId: r.ownerId || '',
              ownerName: r.ownerName || 'Creator',
              memberIds: Array.isArray(r.memberIds) ? r.memberIds : [],
              membersCount: r.membersCount || 0,
              createdAt: r.createdAt || Date.now(),
              updatedAt: r.updatedAt || Date.now(),
              messages: [],
            });
          }
        });
        mergedRooms = Array.from(rMap.values());
      } catch {
        // Firestore read optional if offline
      }

      setCreators(mergedCreators);
      setFollowerIds(Array.isArray(fRes.followerIds) ? fRes.followerIds : []);
      setFollowingIds(Array.isArray(fRes.followingIds) ? fRes.followingIds : []);
      setDmThreads(Array.isArray(dmRes.threads) ? dmRes.threads : []);
      setRooms(mergedRooms);
      setVideos(mergedVideos);

      if (Array.isArray(nRes.notifications)) {
        const serverNotifs = nRes.notifications as ClientSocialNotification[];
        serverNotifs.forEach((n) => seenNotifIdsRef.current.add(n.id));
        setNotifications((prev) => {
          const map = new Map<string, ClientSocialNotification>();
          for (const item of prev) map.set(item.id, item);
          for (const item of serverNotifs) map.set(item.id, item);
          return Array.from(map.values())
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 80);
        });
      }
    } finally {
      setLoading(false);
    }
  }, [identity.uid]);

  // Reset per-account social state immediately on account switch/sign-out
  useEffect(() => {
    mountedAtRef.current = Date.now();
    seenNotifIdsRef.current = new Set();
    setLatestToastNotification(null);
    if (!identity.isActive || !identity.uid) {
      setCreators([]);
      setFollowerIds([]);
      setFollowingIds([]);
      setDmThreads([]);
      setRooms([]);
      setVideos([]);
      setNotifications([]);
      setWsConnected(false);
    }
  }, [identity.uid, identity.isActive]);

  // Persistent authenticated WebSocket + Firestore live notifications listener while signed in
  useEffect(() => {
    if (!identity.isActive || !identity.uid) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Register / sync verified creator profile
    authFetch('/api/social/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: identity.displayName,
        handle: identity.handle,
        role: identity.role,
        bio: identity.bio,
        location: identity.location,
        photoURL: identity.photoURL,
        specialties: identity.specialties,
        isPrivateAccount: Boolean(identity.isPrivateAccount),
        dmPrivacy: identity.dmPrivacy === 'followers' ? 'followers' : 'everyone',
      }),
    }).catch(() => {});

    if (auth.currentUser && auth.currentUser.uid === identity.uid) {
      syncPublicCreatorToFirestore({
        uid: identity.uid,
        displayName: identity.displayName,
        handle: identity.handle,
        role: identity.role,
        bio: identity.bio,
        location: identity.location,
        photoURL: identity.photoURL,
        specialties: identity.specialties,
        isPrivateAccount: Boolean(identity.isPrivateAccount),
        dmPrivacy: identity.dmPrivacy === 'followers' ? 'followers' : 'everyone',
      }).catch(() => {});
    }

    refreshAll();

    const connectWs = async () => {
      const idToken = await getAuthIdToken();
      if (cancelled || !idToken) return;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/social?token=${encodeURIComponent(
        idToken
      )}&name=${encodeURIComponent(identity.displayName)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setWsConnected(true);
      };
      ws.onclose = () => {
        if (!cancelled) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 4000);
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data || '{}'));
          if (msg.type === 'social:creator_updated' && msg.creator) {
            setCreators((prev) => {
              const exists = prev.some((c) => c.uid === msg.creator.uid);
              return exists
                ? prev.map((c) => (c.uid === msg.creator.uid ? msg.creator : c))
                : [msg.creator, ...prev];
            });
          } else if (msg.type === 'social:presence') {
            setCreators((prev) =>
              prev.map((c) => (c.uid === msg.uid ? { ...c, online: Boolean(msg.online) } : c))
            );
          } else if (msg.type === 'social:follow_updated') {
            if (msg.followerId === identity.uid) {
              setFollowingIds((prev) =>
                msg.following
                  ? prev.includes(msg.targetId)
                    ? prev
                    : [...prev, msg.targetId]
                  : prev.filter((id) => id !== msg.targetId)
              );
            }
            if (msg.targetId === identity.uid) {
              setFollowerIds((prev) =>
                msg.following
                  ? prev.includes(msg.followerId)
                    ? prev
                    : [...prev, msg.followerId]
                  : prev.filter((id) => id !== msg.followerId)
              );
            }
            if (msg.targetCreator || msg.followerCreator) {
              setCreators((prev) =>
                prev.map((c) => {
                  if (msg.targetCreator && c.uid === msg.targetCreator.uid) return msg.targetCreator;
                  if (msg.followerCreator && c.uid === msg.followerCreator.uid) return msg.followerCreator;
                  return c;
                })
              );
            }
          } else if (msg.type === 'social:dm_message' && msg.thread) {
            setDmThreads((prev) => {
              const others = prev.filter((t) => t.id !== msg.thread.id);
              return [msg.thread, ...others];
            });
          } else if (msg.type === 'social:notification' && msg.notification) {
            pushIncomingNotification(msg.notification as ClientSocialNotification, true);
          } else if (msg.type === 'social:notifications_read') {
            setNotifications((prev) =>
              prev.map((n) => {
                if (
                  msg.all ||
                  (msg.notificationId && n.id === msg.notificationId) ||
                  (msg.threadId && n.threadId === msg.threadId)
                ) {
                  return { ...n, read: true };
                }
                return n;
              })
            );
          } else if (msg.type === 'social:room_updated' && msg.room) {
            setRooms((prev) => {
              const exists = prev.some((r) => r.id === msg.room.id);
              return exists
                ? prev.map((r) => (r.id === msg.room.id ? msg.room : r))
                : [msg.room, ...prev];
            });
          } else if (msg.type === 'social:room_message' && msg.room) {
            setRooms((prev) => prev.map((r) => (r.id === msg.room.id ? msg.room : r)));
          } else if (msg.type === 'social:video_created' && msg.video) {
            setVideos((prev) =>
              prev.some((v) => v.id === msg.video.id) ? prev : [msg.video, ...prev]
            );
          } else if (msg.type === 'social:video_updated' && msg.video) {
            setVideos((prev) => prev.map((v) => (v.id === msg.video.id ? msg.video : v)));
          } else if (msg.type === 'social:video_deleted') {
            setVideos((prev) => prev.filter((v) => v.id !== msg.videoId));
          }
        } catch {
          // ignore malformed frames
        }
      };
    };

    connectWs();

    // Real-time Firestore listener on private user notifications inbox
    const notifQuery = query(
      collection(db, 'users', identity.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubFsNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const raw = change.doc.data() as Partial<ClientSocialNotification>;
            if (raw.id && raw.recipientId === identity.uid && raw.senderId) {
              const normalized: ClientSocialNotification = {
                id: String(raw.id),
                recipientId: String(raw.recipientId),
                senderId: String(raw.senderId),
                senderName: String(raw.senderName || 'Creator'),
                senderHandle: raw.senderHandle ? String(raw.senderHandle) : undefined,
                senderPhoto: raw.senderPhoto ? String(raw.senderPhoto) : undefined,
                kind: (raw.kind as ClientSocialNotificationKind) || 'dm_message',
                threadId: raw.threadId ? String(raw.threadId) : undefined,
                messageId: raw.messageId ? String(raw.messageId) : undefined,
                roomId: raw.roomId ? String(raw.roomId) : undefined,
                videoId: raw.videoId ? String(raw.videoId) : undefined,
                textPreview: String(raw.textPreview || ''),
                read: Boolean(raw.read),
                createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
              };
              pushIncomingNotification(normalized, change.type === 'added' && !normalized.read);
            }
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${identity.uid}/notifications`);
      }
    );

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      unsubFsNotifs();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [identity.isActive, identity.uid]);

  const markNotificationRead = useCallback(
    async (opts: { notificationId?: string; threadId?: string; all?: boolean }) => {
      if (!identity.uid) return;

      const toMark = notifications.filter((n) => {
        if (n.read) return false;
        if (opts.all) return true;
        if (opts.notificationId && n.id === opts.notificationId) return true;
        if (opts.threadId && n.threadId === opts.threadId) return true;
        return false;
      });

      if (toMark.length === 0 && !opts.all) return;

      setNotifications((prev) =>
        prev.map((n) => {
          if (
            opts.all ||
            (opts.notificationId && n.id === opts.notificationId) ||
            (opts.threadId && n.threadId === opts.threadId)
          ) {
            return { ...n, read: true };
          }
          return n;
        })
      );

      setLatestToastNotification((cur) => {
        if (!cur) return null;
        if (
          opts.all ||
          (opts.notificationId && cur.id === opts.notificationId) ||
          (opts.threadId && cur.threadId === opts.threadId)
        ) {
          return null;
        }
        return cur;
      });

      await authFetch('/api/social/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      }).catch(() => {});

      for (const n of toMark) {
        markFirestoreNotificationRead(identity.uid, n.id).catch(() => {});
      }
    },
    [identity.uid, notifications]
  );

  const searchCreators = useCallback(async (q: string) => {
    const res = await authFetch(`/api/social/creators?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data.creators) ? data.creators : [];
    setCreators(list);
    return list as ClientSocialCreator[];
  }, []);

  const toggleFollow = useCallback(
    async (targetId: string) => {
      const res = await authFetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setFollowingIds((prev) =>
        data.following
          ? prev.includes(targetId)
            ? prev
            : [...prev, targetId]
          : prev.filter((id) => id !== targetId)
      );
      if (data.creator) {
        setCreators((prev) => prev.map((c) => (c.uid === data.creator.uid ? data.creator : c)));
      }

      if (auth.currentUser && auth.currentUser.uid === identity.uid) {
        const path = `public_creators/${targetId}/followers/${identity.uid}`;
        try {
          if (data.following) {
            await setDoc(doc(db, 'public_creators', targetId, 'followers', identity.uid), {
              followerId: identity.uid,
              targetId,
              followerName: identity.displayName.slice(0, 120),
              followerHandle: identity.handle.slice(0, 48),
              followerPhoto: identity.photoURL.slice(0, 200000),
              createdAt: Date.now(),
            });
            await createFirestoreNotification({
              recipientId: targetId,
              senderId: identity.uid,
              senderName: identity.displayName,
              senderHandle: identity.handle,
              senderPhoto: identity.photoURL,
              kind: 'follow',
              textPreview: 'بدأ بمتابعتك الآن',
            });
          } else {
            await deleteDoc(doc(db, 'public_creators', targetId, 'followers', identity.uid));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
    },
    [identity.uid, identity.displayName, identity.handle, identity.photoURL]
  );

  const sendDirectMessage = useCallback(
    async (
      recipientId: string,
      text: string,
      videoId?: string,
      replyTo?: { id: string; senderName: string; text: string }
    ) => {
      const res = await authFetch('/api/social/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: identity.displayName,
          recipientId,
          text,
          videoId,
          ...(replyTo
            ? {
                replyToId: replyTo.id,
                replyToSender: replyTo.senderName,
                replyToText: replyTo.text,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to send message');
      }
      const data = await res.json();
      if (data.thread) {
        setDmThreads((prev) => [data.thread, ...prev.filter((t) => t.id !== data.thread.id)]);
      }

      if (auth.currentUser && auth.currentUser.uid === identity.uid && data.thread && data.message) {
        const threadPath = `dm_threads/${data.thread.id}`;
        try {
          await setDoc(
            doc(db, 'dm_threads', data.thread.id),
            {
              id: data.thread.id,
              participants: data.thread.participants,
              lastMessage: data.thread.lastMessage,
              updatedAt: data.thread.updatedAt,
            },
            { merge: true }
          );
          await setDoc(doc(db, 'dm_threads', data.thread.id, 'messages', data.message.id), {
            id: data.message.id,
            senderId: identity.uid,
            senderName: identity.displayName.slice(0, 120),
            text: data.message.text,
            ...(videoId ? { videoId } : {}),
            ...(replyTo
              ? {
                  replyToId: replyTo.id,
                  replyToSender: replyTo.senderName.slice(0, 120),
                  replyToText: replyTo.text.slice(0, 240),
                }
              : {}),
            createdAt: data.message.createdAt,
          });
          await createFirestoreNotification({
            id: data.notification?.id,
            recipientId,
            senderId: identity.uid,
            senderName: identity.displayName,
            senderHandle: identity.handle,
            senderPhoto: identity.photoURL,
            kind: replyTo ? 'dm_reply' : 'dm_message',
            threadId: data.thread.id,
            messageId: data.message.id,
            textPreview: data.message.text,
            createdAt: data.message.createdAt,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, threadPath);
        }
      }
      return data.thread as ClientDmThread;
    },
    [identity.uid, identity.displayName, identity.handle, identity.photoURL]
  );

  const createRoom = useCallback(
    async (kind: 'channel' | 'group', name: string, description: string) => {
      const res = await authFetch('/api/social/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name,
          description,
          ownerName: identity.displayName,
        }),
      });
      if (!res.ok) throw new Error('Failed to create room');
      const data = await res.json();
      if (data.room) {
        setRooms((prev) => [data.room, ...prev.filter((r) => r.id !== data.room.id)]);
        if (auth.currentUser && auth.currentUser.uid === identity.uid) {
          const rPath = `social_rooms/${data.room.id}`;
          try {
            await setDoc(doc(db, 'social_rooms', data.room.id), {
              id: data.room.id,
              kind: data.room.kind,
              name: data.room.name,
              description: data.room.description,
              ownerId: identity.uid,
              ownerName: identity.displayName.slice(0, 120),
              memberIds: data.room.memberIds,
              membersCount: data.room.membersCount,
              createdAt: data.room.createdAt,
              updatedAt: data.room.updatedAt,
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, rPath);
          }
        }
      }
      return data.room as ClientSocialRoom;
    },
    [identity.uid, identity.displayName]
  );

  const toggleJoinRoom = useCallback(async (roomId: string) => {
    const res = await authFetch(`/api/social/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.room) {
      setRooms((prev) => prev.map((r) => (r.id === data.room.id ? data.room : r)));
    }
  }, []);

  const sendRoomMessage = useCallback(
    async (
      roomId: string,
      text: string,
      videoUrl?: string,
      replyTo?: { id: string; senderName: string; text: string }
    ) => {
      const res = await authFetch(`/api/social/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: identity.displayName,
          senderHandle: identity.handle,
          text,
          videoUrl,
          ...(replyTo
            ? {
                replyToId: replyTo.id,
                replyToSender: replyTo.senderName,
                replyToText: replyTo.text,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to post message');
      }
      const data = await res.json();
      if (data.room) {
        setRooms((prev) => prev.map((r) => (r.id === data.room.id ? data.room : r)));
      }
    },
    [identity.displayName, identity.handle]
  );

  const toggleRoomReaction = useCallback(
    async (roomId: string, messageId: string, emoji: string) => {
      const res = await authFetch(`/api/social/rooms/${encodeURIComponent(roomId)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.room) {
        setRooms((prev) => prev.map((r) => (r.id === data.room.id ? data.room : r)));
      }
    },
    []
  );

  const togglePinRoomMessage = useCallback(
    async (roomId: string, messageId: string) => {
      const res = await authFetch(`/api/social/rooms/${encodeURIComponent(roomId)}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.room) {
        setRooms((prev) => prev.map((r) => (r.id === data.room.id ? data.room : r)));
      }
    },
    []
  );

  const uploadAndPublishVideo = useCallback(
    async (params: {
      title: string;
      description: string;
      tags: string[];
      mediaType?: 'video' | 'image';
      file?: File | null;
      files?: File[];
      externalUrl?: string;
      externalUrls?: string[];
      posterUrl?: string;
      durationSec?: number;
      onProgress?: (percent: number) => void;
    }) => {
      const token = await getAuthIdToken();
      const uploadedUrls: string[] = [];
      let detectedType: 'video' | 'image' | undefined = params.mediaType;

      const filesToUpload =
        params.files && params.files.length > 0
          ? params.files.slice(0, 10)
          : params.file
          ? [params.file]
          : [];

      const totalBytes = filesToUpload.reduce((sum, f) => sum + Math.max(1, f.size), 0);
      let completedBytes = 0;

      const uploadSingleFile = (f: File) =>
        new Promise<{ url?: string; mediaType?: 'video' | 'image' }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/social/upload-media');
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
          const mime =
            f.type ||
            (/\.(png|jpe?g|webp|gif|avif|heic)$/i.test(f.name)
              ? 'image/jpeg'
              : detectedType === 'image'
              ? 'image/jpeg'
              : 'video/mp4');
          xhr.setRequestHeader('Content-Type', mime);
          xhr.setRequestHeader('x-file-name', encodeURIComponent(f.name || 'media'));

          xhr.upload.onprogress = (ev) => {
            if (params.onProgress && totalBytes > 0) {
              const currentLoaded = ev.lengthComputable
                ? Math.min(f.size, ev.loaded)
                : f.size * 0.5;
              const pct = Math.min(
                98,
                Math.round(((completedBytes + currentLoaded) / totalBytes) * 100)
              );
              params.onProgress(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const upData = JSON.parse(xhr.responseText || '{}');
                resolve({
                  url: upData.mediaUrl || upData.videoUrl,
                  mediaType: upData.mediaType,
                });
              } catch {
                reject(new Error('Invalid server response'));
              }
            } else {
              let msg = `Upload failed (${xhr.status})`;
              try {
                const errJson = JSON.parse(xhr.responseText || '{}');
                if (errJson.error) msg = errJson.error;
              } catch {
                // ignore
              }
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(f);
        });

      for (const f of filesToUpload) {
        const upData = await uploadSingleFile(f);
        completedBytes += Math.max(1, f.size);
        if (upData.url) uploadedUrls.push(upData.url);
        if (!detectedType && upData.mediaType) {
          detectedType = upData.mediaType;
        }
      }

      params.onProgress?.(99);

      const extList = (params.externalUrls && params.externalUrls.length > 0
        ? params.externalUrls
        : params.externalUrl
        ? [params.externalUrl]
        : []
      )
        .map((u) => u.trim())
        .filter(Boolean);

      const mediaUrls = [...uploadedUrls, ...extList].slice(0, 10);
      const finalVideoUrl = mediaUrls[0] || '';

      if (!finalVideoUrl) {
        throw new Error('Media file is required');
      }

      const finalType: 'video' | 'image' =
        detectedType === 'image' || /\.(png|jpe?g|webp|gif|avif|heic)(\?|$)/i.test(finalVideoUrl)
          ? 'image'
          : 'video';

      const res = await authFetch('/api/social/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: identity.displayName,
          authorHandle: identity.handle,
          authorPhoto: identity.photoURL,
          title: params.title,
          description: params.description,
          mediaType: finalType,
          mediaUrls,
          videoUrl: finalVideoUrl,
          posterUrl: params.posterUrl,
          tags: params.tags,
          durationSec: params.durationSec,
        }),
      });
      if (!res.ok) throw new Error('Publish failed');
      params.onProgress?.(100);
      const data = await res.json();
      if (data.video) {
        setVideos((prev) => [data.video, ...prev.filter((v) => v.id !== data.video.id)]);
        if (auth.currentUser && auth.currentUser.uid === identity.uid) {
          const vPath = `social_videos/${data.video.id}`;
          try {
            await setDoc(doc(db, 'social_videos', data.video.id), {
              id: data.video.id,
              authorId: identity.uid,
              authorName: data.video.authorName,
              authorHandle: data.video.authorHandle,
              authorPhoto: data.video.authorPhoto,
              title: data.video.title,
              description: data.video.description,
              videoUrl: data.video.videoUrl,
              tags: data.video.tags,
              likedBy: [],
              likesCount: 0,
              commentsCount: 0,
              viewsCount: 0,
              createdAt: data.video.createdAt,
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, vPath);
          }
        }
      }
      return data.video as ClientSocialVideo;
    },
    [identity.uid, identity.displayName, identity.handle, identity.photoURL]
  );

  const toggleLikeVideo = useCallback(async (videoId: string) => {
    const res = await authFetch(`/api/social/videos/${encodeURIComponent(videoId)}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.video) {
      setVideos((prev) => prev.map((v) => (v.id === data.video.id ? data.video : v)));
    }
  }, []);

  const addVideoComment = useCallback(
    async (videoId: string, text: string) => {
      const res = await authFetch(`/api/social/videos/${encodeURIComponent(videoId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: identity.displayName,
          text,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.video) {
        setVideos((prev) => prev.map((v) => (v.id === data.video.id ? data.video : v)));
      }
    },
    [identity.displayName]
  );

  const deleteVideo = useCallback(
    async (videoId: string) => {
      const res = await authFetch(`/api/social/videos/${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      if (auth.currentUser && auth.currentUser.uid === identity.uid) {
        deleteDoc(doc(db, 'social_videos', videoId)).catch(() => {});
      }
    },
    [identity.uid]
  );

  const registerVideoView = useCallback(async (videoId: string) => {
    const res = await fetch(`/api/social/videos/${encodeURIComponent(videoId)}/view`, {
      method: 'POST',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.viewsCount === 'number') {
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, viewsCount: data.viewsCount } : v))
      );
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return {
    creators,
    followerIds,
    followingIds,
    dmThreads,
    rooms,
    videos,
    notifications,
    unreadCount,
    latestToastNotification,
    dismissToastNotification,
    markNotificationRead,
    wsConnected,
    loading,
    refreshAll,
    searchCreators,
    toggleFollow,
    sendDirectMessage,
    createRoom,
    toggleJoinRoom,
    sendRoomMessage,
    toggleRoomReaction,
    togglePinRoomMessage,
    uploadAndPublishVideo,
    toggleLikeVideo,
    addVideoComment,
    deleteVideo,
    registerVideoView,
  };
}
