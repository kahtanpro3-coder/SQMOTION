import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  FirebaseUser,
  getScopedProfileStorageKey,
  loadUserProfile,
} from '../lib/firebase';
import { useSocialNetwork } from '../engine/socialClient';
import type { Language } from '../types';

export interface SocialIdentitySnapshot {
  uid: string;
  displayName: string;
  handle: string;
  role: string;
  bio: string;
  location: string;
  photoURL: string;
  specialties: string[];
  isPrivateAccount: boolean;
  dmPrivacy: 'everyone' | 'followers';
}

export type SocialContextValue = ReturnType<typeof useSocialNetwork> & {
  identity: SocialIdentitySnapshot;
  refreshIdentity: () => void;
};

const SocialContext = createContext<SocialContextValue | null>(null);

function readScopedIdentity(user: FirebaseUser | null, lang: Language): SocialIdentitySnapshot {
  if (!user) {
    return {
      uid: '',
      displayName: lang === 'ar' ? 'زائر' : 'Guest',
      handle: 'guest',
      role: '',
      bio: '',
      location: '',
      photoURL: '',
      specialties: [],
      isPrivateAccount: true,
      dmPrivacy: 'followers',
    };
  }

  let parsed: Partial<SocialIdentitySnapshot> = {};
  try {
    const raw = localStorage.getItem(getScopedProfileStorageKey(user.uid));
    if (raw) parsed = JSON.parse(raw);
  } catch {
    // ignore storage errors
  }

  const displayName =
    parsed.displayName?.trim() ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    (lang === 'ar' ? 'مبدع الموشن' : 'Motion Creator');

  const handle =
    parsed.handle?.trim() ||
    (user.email
      ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase()
      : '') ||
    `creator_${user.uid.slice(-5)}`;

  return {
    uid: user.uid,
    displayName,
    handle,
    role: parsed.role?.trim() || (lang === 'ar' ? 'مخرج ومصمم حركة' : 'Motion Designer'),
    bio: parsed.bio?.trim() || '',
    location: parsed.location?.trim() || '',
    photoURL: parsed.photoURL || user.photoURL || '',
    specialties: Array.isArray(parsed.specialties) ? parsed.specialties : ['Motion Graphics'],
    isPrivateAccount: Boolean(parsed.isPrivateAccount),
    dmPrivacy: parsed.dmPrivacy === 'followers' ? 'followers' : 'everyone',
  };
}

export const SocialProvider: React.FC<{
  user: FirebaseUser | null;
  lang: Language;
  children: React.ReactNode;
}> = ({ user, lang, children }) => {
  const [identityTick, setIdentityTick] = useState(0);

  // Sync user's latest private profile from Firestore into their scoped local cache when signing in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadUserProfile(user.uid).then((remote) => {
      if (cancelled || !remote) return;
      try {
        localStorage.setItem(
          getScopedProfileStorageKey(user.uid),
          JSON.stringify({
            displayName: remote.displayName,
            handle: remote.handle,
            role: remote.role,
            bio: remote.bio,
            location: remote.location,
            website: remote.website,
            photoURL: remote.photoURL,
            bannerURL: remote.bannerURL,
            specialties: remote.specialties,
            isPrivateAccount: remote.isPrivateAccount,
            dmPrivacy: remote.dmPrivacy,
          })
        );
        setIdentityTick((t) => t + 1);
      } catch {
        // ignore quota errors
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    const onProfileChanged = () => setIdentityTick((t) => t + 1);
    window.addEventListener('sqmotion:profileChanged', onProfileChanged);
    return () => window.removeEventListener('sqmotion:profileChanged', onProfileChanged);
  }, []);

  const identity = useMemo(
    () => readScopedIdentity(user, lang),
    [user?.uid, user?.displayName, user?.photoURL, lang, identityTick]
  );

  const social = useSocialNetwork({
    ...identity,
    isActive: Boolean(user && identity.uid),
  });

  const value = useMemo<SocialContextValue>(
    () => ({
      ...social,
      identity,
      refreshIdentity: () => setIdentityTick((t) => t + 1),
    }),
    [social, identity]
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
};

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    throw new Error('useSocial must be used within SocialProvider');
  }
  return ctx;
}
