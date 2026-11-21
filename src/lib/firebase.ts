import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Layer, Project, ProjectSettings } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');

// Connection check on startup (per firebase-integration-rpc guidelines)
let lastFirestoreOnlineStatus: boolean | null = null;
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    lastFirestoreOnlineStatus = true;
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      lastFirestoreOnlineStatus = false;
      console.warn('Firestore client is offline.');
      return false;
    }
    // Permission error on /test/connection still proves live network reachability to Firestore servers
    lastFirestoreOnlineStatus = true;
    return true;
  }
}
testFirestoreConnection();

export function getLastFirestoreOnlineStatus(): boolean | null {
  return lastFirestoreOnlineStatus;
}

// Real authentication helpers
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await syncUserProfile(result.user, 'google');
  return result.user;
}

export async function loginWithFacebook() {
  const result = await signInWithPopup(auth, facebookProvider);
  await syncUserProfile(result.user, 'facebook');
  return result.user;
}

export async function registerWithEmail(email: string, pass: string, displayName: string) {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  await syncUserProfile(result.user, 'email', displayName);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string) {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  await syncUserProfile(result.user, 'email');
  return result.user;
}

export async function resetPassword(email: string) {
  return await sendPasswordResetEmail(auth, email);
}

export async function logoutUser() {
  return await signOut(auth);
}

export async function updateUserAvatar(photoURL: string) {
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL });
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await setDoc(userRef, { photoURL, updatedAt: serverTimestamp() }, { merge: true });
  }
}

export function getScopedProfileStorageKey(uid: string): string {
  return `sqmotion_creator_profile_v2_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function getScopedProjectsStorageKey(uid: string): string {
  return `sqmotion_projects_v3_${uid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export async function getAuthIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export interface UserProfileData {
  uid: string;
  displayName: string;
  handle: string;
  role: string;
  bio: string;
  location: string;
  website: string;
  email: string;
  photoURL: string;
  bannerURL: string;
  specialties: string[];
  provider: string;
  isPro: boolean;
  isPrivateAccount: boolean;
  dmPrivacy: 'everyone' | 'followers';
}

export async function loadUserProfile(uid?: string): Promise<UserProfileData | null> {
  const targetUid = uid || auth.currentUser?.uid;
  if (!targetUid) return null;
  const path = `users/${targetUid}`;
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    const current = auth.currentUser;
    if (!snap.exists()) {
      return {
        uid: targetUid,
        displayName: current?.displayName || 'Creator',
        handle: (current?.email?.split('@')[0] || 'creator').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48),
        role: 'Motion Designer',
        bio: '',
        location: '',
        website: '',
        email: current?.email || '',
        photoURL: current?.photoURL || '',
        bannerURL: '',
        specialties: ['Motion Graphics', 'Keyframe Animation'],
        provider: current?.providerData?.[0]?.providerId || 'email',
        isPro: true,
        isPrivateAccount: false,
        dmPrivacy: 'everyone',
      };
    }
    const d = snap.data();
    return {
      uid: String(d.uid || targetUid),
      displayName: String(d.displayName || current?.displayName || 'Creator'),
      handle: String(d.handle || ''),
      role: String(d.role || 'Motion Designer'),
      bio: String(d.bio || ''),
      location: String(d.location || ''),
      website: String(d.website || ''),
      email: String(d.email || current?.email || ''),
      photoURL: String(d.photoURL || current?.photoURL || ''),
      bannerURL: String(d.bannerURL || ''),
      specialties: Array.isArray(d.specialties) ? d.specialties.map(String).slice(0, 8) : [],
      provider: String(d.provider || 'email'),
      isPro: Boolean(d.isPro ?? true),
      isPrivateAccount: Boolean(d.isPrivateAccount ?? false),
      dmPrivacy: d.dmPrivacy === 'followers' ? 'followers' : 'everyone',
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function saveUserProfileDetails(
  updates: Partial<Omit<UserProfileData, 'uid'>>
): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const path = `users/${uid}`;
  try {
    const sanitizedDisplayName = (updates.displayName ?? auth.currentUser.displayName ?? 'Creator')
      .trim()
      .slice(0, 120) || 'Creator';

    const authUpdate: { displayName: string; photoURL?: string } = {
      displayName: sanitizedDisplayName,
    };
    if (
      updates.photoURL !== undefined &&
      updates.photoURL.startsWith('http') &&
      updates.photoURL.length <= 1800
    ) {
      authUpdate.photoURL = updates.photoURL;
    }
    await updateProfile(auth.currentUser, authUpdate).catch(() => {});

    const cleanHandle =
      updates.handle !== undefined
        ? updates.handle.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48)
        : undefined;

    const payload: Record<string, unknown> = {
      uid,
      displayName: sanitizedDisplayName,
      updatedAt: serverTimestamp(),
    };
    if (cleanHandle !== undefined) payload.handle = cleanHandle;
    if (updates.role !== undefined) payload.role = updates.role.slice(0, 80);
    if (updates.bio !== undefined) payload.bio = updates.bio.slice(0, 360);
    if (updates.location !== undefined) payload.location = updates.location.slice(0, 80);
    if (updates.website !== undefined) payload.website = updates.website.slice(0, 200);
    if (updates.photoURL !== undefined) payload.photoURL = updates.photoURL.slice(0, 200000);
    if (updates.bannerURL !== undefined) payload.bannerURL = updates.bannerURL.slice(0, 200000);
    if (updates.specialties !== undefined) {
      payload.specialties = updates.specialties.map((s) => String(s).slice(0, 40)).slice(0, 8);
    }
    if (typeof updates.isPrivateAccount === 'boolean') {
      payload.isPrivateAccount = updates.isPrivateAccount;
    }
    if (updates.dmPrivacy === 'everyone' || updates.dmPrivacy === 'followers') {
      payload.dmPrivacy = updates.dmPrivacy;
    }

    await setDoc(doc(db, 'users', uid), payload, { merge: true });
    await syncPublicCreatorToFirestore({
      uid,
      displayName: sanitizedDisplayName,
      handle: cleanHandle,
      role: updates.role,
      bio: updates.bio,
      location: updates.location,
      photoURL: updates.photoURL,
      specialties: updates.specialties,
      isPrivateAccount: updates.isPrivateAccount,
      dmPrivacy: updates.dmPrivacy,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

export async function syncPublicCreatorToFirestore(data: {
  uid: string;
  displayName: string;
  handle?: string;
  role?: string;
  bio?: string;
  location?: string;
  photoURL?: string;
  specialties?: string[];
  followersCount?: number;
  followingCount?: number;
  videosCount?: number;
  isPrivateAccount?: boolean;
  dmPrivacy?: 'everyone' | 'followers';
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== data.uid) return;
  const path = `public_creators/${data.uid}`;
  try {
    const payload: Record<string, unknown> = {
      uid: data.uid,
      displayName: (data.displayName || 'Creator').slice(0, 120),
      updatedAt: Date.now(),
    };
    if (data.handle !== undefined) {
      payload.handle = data.handle.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48);
    }
    if (data.role !== undefined) payload.role = data.role.slice(0, 80);
    if (data.bio !== undefined) payload.bio = data.bio.slice(0, 360);
    if (data.location !== undefined) payload.location = data.location.slice(0, 80);
    if (data.photoURL !== undefined) payload.photoURL = data.photoURL.slice(0, 200000);
    if (Array.isArray(data.specialties)) {
      payload.specialties = data.specialties.map((s) => String(s).slice(0, 40)).slice(0, 8);
    }
    if (typeof data.followersCount === 'number') payload.followersCount = data.followersCount;
    if (typeof data.followingCount === 'number') payload.followingCount = data.followingCount;
    if (typeof data.videosCount === 'number') payload.videosCount = data.videosCount;
    if (typeof data.isPrivateAccount === 'boolean') payload.isPrivateAccount = data.isPrivateAccount;
    if (data.dmPrivacy === 'everyone' || data.dmPrivacy === 'followers') payload.dmPrivacy = data.dmPrivacy;
    await setDoc(doc(db, 'public_creators', data.uid), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createFirestoreNotification(input: {
  id?: string;
  recipientId: string;
  senderId: string;
  senderName?: string;
  senderHandle?: string;
  senderPhoto?: string;
  kind: 'dm_message' | 'dm_reply' | 'room_reply' | 'follow' | 'video_comment' | 'video_like';
  threadId?: string;
  messageId?: string;
  roomId?: string;
  videoId?: string;
  textPreview: string;
  createdAt?: number;
}): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== input.senderId) return;
  const rId = sanitizeDocumentId(input.recipientId);
  const sId = sanitizeDocumentId(input.senderId);
  if (!rId || !sId || rId === sId) return;
  const notifId = sanitizeDocumentId(
    input.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const path = `users/${rId}/notifications/${notifId}`;
  try {
    await setDoc(doc(db, 'users', rId, 'notifications', notifId), {
      id: notifId,
      recipientId: rId,
      senderId: sId,
      senderName: String(input.senderName || auth.currentUser.displayName || 'Creator').slice(0, 120),
      senderHandle: String(input.senderHandle || '').slice(0, 48),
      senderPhoto: String(input.senderPhoto || '').slice(0, 200000),
      kind: input.kind,
      ...(input.threadId ? { threadId: String(input.threadId).slice(0, 128) } : {}),
      ...(input.messageId ? { messageId: String(input.messageId).slice(0, 128) } : {}),
      ...(input.roomId ? { roomId: String(input.roomId).slice(0, 128) } : {}),
      ...(input.videoId ? { videoId: String(input.videoId).slice(0, 128) } : {}),
      textPreview: String(input.textPreview || '').trim().slice(0, 400) || 'إشعار جديد',
      read: false,
      createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markFirestoreNotificationRead(
  userId: string,
  notifId: string
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) return;
  const safeUid = sanitizeDocumentId(userId);
  const safeNotifId = sanitizeDocumentId(notifId);
  const path = `users/${safeUid}/notifications/${safeNotifId}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'notifications', safeNotifId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateUserProfileDetails(displayName: string, photoURL?: string) {
  await saveUserProfileDetails({
    displayName,
    ...(photoURL !== undefined ? { photoURL } : {}),
  });
}

async function syncUserProfile(user: FirebaseUser, providerType: string, customName?: string) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const displayName = (user.displayName || customName || 'Creator').slice(0, 120);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        provider: providerType,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        isPro: true,
      });
    } else {
      await setDoc(
        userRef,
        {
          displayName,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('Sync user profile notice:', path, err);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: Array<{ providerId: string; email: string | null }>;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore notice:', JSON.stringify(errInfo));
}

function sanitizeDocumentId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return cleaned || `item_${Date.now()}`;
}

function stripUndefinedDeep<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return val;
}

function sanitizeLayersForCloud(layers: Layer[]): Layer[] {
  const cloned = JSON.parse(JSON.stringify(layers || [])) as Layer[];
  return stripUndefinedDeep(
    cloned.slice(0, 200).map((layer) => {
      const next = { ...layer };
      if (typeof next.mediaUrl === 'string' && (next.mediaUrl.startsWith('blob:') || next.mediaUrl.length > 60000)) {
        delete next.mediaUrl;
      }
      if (next.audioConfig?.src && (next.audioConfig.src.startsWith('blob:') || next.audioConfig.src.length > 60000)) {
        next.audioConfig = { ...next.audioConfig, src: '' };
      }
      if (next.model3dConfig?.modelUrl && (next.model3dConfig.modelUrl.startsWith('blob:') || next.model3dConfig.modelUrl.length > 60000)) {
        next.model3dConfig = { ...next.model3dConfig, modelUrl: '' };
      }
      return next;
    })
  );
}

export async function syncFavoritesToCloud(favoritesPayload: object): Promise<void> {
  if (!auth.currentUser) return;
  const path = `users/${auth.currentUser.uid}/favorites/library`;
  try {
    const payload = stripUndefinedDeep(favoritesPayload as Record<string, unknown>);
    await setDoc(
      doc(db, 'users', auth.currentUser.uid, 'favorites', 'library'),
      {
        ...payload,
        uid: auth.currentUser.uid,
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadFavoritesFromCloud(): Promise<Record<string, unknown> | null> {
  if (!auth.currentUser) return null;
  const path = `users/${auth.currentUser.uid}/favorites/library`;
  try {
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'favorites', 'library'));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function syncProjectToCloud(project: Project): Promise<boolean> {
  if (!auth.currentUser) return false;
  const safeId = sanitizeDocumentId(project.id);
  const path = `users/${auth.currentUser.uid}/projects/${safeId}`;
  try {
    const safeLayers = sanitizeLayersForCloud(project.layers);
    const safeSettings = stripUndefinedDeep(project.settings);
    const docPayload: Record<string, unknown> = {
      id: safeId,
      ownerId: auth.currentUser.uid,
      name: (project.settings.name || 'Untitled Project').slice(0, 160),
      settings: safeSettings,
      layers: safeLayers,
      layerCount: safeLayers.length,
      updatedAt: project.updatedAt || Date.now(),
      syncedAt: serverTimestamp(),
    };
    if (project.thumbnail && project.thumbnail.length <= 180000) {
      docPayload.thumbnail = project.thumbnail;
    }
    await setDoc(doc(db, 'users', auth.currentUser.uid, 'projects', safeId), docPayload, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

export async function loadCloudProjects(): Promise<Project[]> {
  if (!auth.currentUser) return [];
  const path = `users/${auth.currentUser.uid}/projects`;
  try {
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'projects'),
      orderBy('updatedAt', 'desc'),
      limit(40)
    );
    const snap = await getDocs(q);
    const projects: Project[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.settings && Array.isArray(data.layers)) {
        projects.push({
          id: String(data.id || docSnap.id),
          settings: data.settings as ProjectSettings,
          layers: data.layers as Layer[],
          selectedLayerId: null,
          currentFrame: 0,
          isPlaying: false,
          zoomLevel: 1,
          activeTab: 'properties',
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
          thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
        });
      }
    });
    return projects;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function deleteProjectFromCloud(projectId: string): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeDocumentId(projectId);
  const path = `users/${auth.currentUser.uid}/projects/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'projects', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export interface CommunityTemplateItem {
  id: string;
  authorId: string;
  authorName: string;
  name: string;
  description: string;
  createdAt: number;
  project: Project;
}

export async function publishCommunityTemplate(
  project: Project,
  description = ''
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!auth.currentUser) {
    return { ok: false, error: 'Sign in required' };
  }
  const safeId = sanitizeDocumentId(`tmpl_${project.id}_${Date.now()}`);
  const path = `community_templates/${safeId}`;
  try {
    const safeLayers = sanitizeLayersForCloud(project.layers).slice(0, 80);
    const safeSettings = stripUndefinedDeep(project.settings);
    const now = Date.now();
    await setDoc(doc(db, 'community_templates', safeId), {
      id: safeId,
      authorId: auth.currentUser.uid,
      authorName: (auth.currentUser.displayName || auth.currentUser.email || 'Creator').slice(0, 120),
      name: (project.settings.name || 'Community Motion').slice(0, 120),
      description: description.slice(0, 400),
      settings: safeSettings,
      layers: safeLayers,
      createdAt: now,
      updatedAt: now,
      syncedAt: serverTimestamp(),
    });
    return { ok: true, id: safeId };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    return { ok: false, error: err instanceof Error ? err.message : 'Publish failed' };
  }
}

export async function loadCommunityTemplates(): Promise<CommunityTemplateItem[]> {
  const path = 'community_templates';
  try {
    const q = query(collection(db, 'community_templates'), orderBy('createdAt', 'desc'), limit(24));
    const snap = await getDocs(q);
    const list: CommunityTemplateItem[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.settings && Array.isArray(data.layers)) {
        const proj: Project = {
          id: `tmpl-${docSnap.id}`,
          settings: data.settings as ProjectSettings,
          layers: data.layers as Layer[],
          selectedLayerId: null,
          currentFrame: 0,
          isPlaying: false,
          zoomLevel: 1,
          activeTab: 'properties',
          updatedAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        };
        list.push({
          id: docSnap.id,
          authorId: String(data.authorId || ''),
          authorName: String(data.authorName || 'Creator'),
          name: String(data.name || proj.settings.name || 'Template'),
          description: String(data.description || ''),
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          project: proj,
        });
      }
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function deleteCommunityTemplate(templateId: string): Promise<boolean> {
  if (!auth.currentUser) return false;
  const safeId = sanitizeDocumentId(templateId);
  const path = `community_templates/${safeId}`;
  try {
    await deleteDoc(doc(db, 'community_templates', safeId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
}

export { onAuthStateChanged };
export type { FirebaseUser };
