import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
}

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedProjectId: string | null = null;
function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
    cachedProjectId = String(raw.projectId || '').trim();
  } catch {
    cachedProjectId = '';
  }
  return cachedProjectId;
}

let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function fetchPublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certsExpiresAt > now && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    if (Object.keys(cachedCerts).length > 0) return cachedCerts;
    throw new Error(`Failed to fetch Firebase auth certs (${res.status})`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cc = res.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.max(60, parseInt(maxAgeMatch[1], 10)) : 3600;
  cachedCerts = certs;
  certsExpiresAt = now + maxAgeSec * 1000;
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

function decodeBase64UrlBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  return Buffer.from(padded, 'base64');
}

export async function verifyFirebaseIdToken(
  token: string | undefined | null
): Promise<VerifiedFirebaseUser | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  try {
    const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
    const payload = decodeBase64UrlJson<{
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      auth_time?: number;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    }>(parts[1]);

    if (header.alg !== 'RS256' || !header.kid) return null;

    const projectId = getFirebaseProjectId();
    if (!projectId) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 30) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) return null;

    let certs = await fetchPublicCerts(false);
    let cert = certs[header.kid];
    if (!cert) {
      certs = await fetchPublicCerts(true);
      cert = certs[header.kid];
    }
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const signatureBuf = decodeBase64UrlBuffer(parts[2]);
    const isValidSig = verifier.verify(cert, signatureBuf);
    if (!isValidSig) return null;

    return {
      uid: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}
