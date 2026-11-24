import crypto from 'crypto';
import { NextRequest } from 'next/server';
import type { AdminRole } from '@/lib/db/schema';
import { getAdminUserById } from '@/lib/db/store';

export const ADMIN_COOKIE_NAME = 'stepstyle_admin_token';

// Shared process-wide in-memory fallback key when ADMIN_SESSION_SECRET env var is not configured
const globalForAdminSession = globalThis as typeof globalThis & {
  __stepstyleAdminFallbackKey?: string;
};

if (!globalForAdminSession.__stepstyleAdminFallbackKey) {
  globalForAdminSession.__stepstyleAdminFallbackKey = crypto.randomBytes(32).toString('hex');
}

function getSigningSecret(): string {
  const envSecret = process.env.ADMIN_SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }
  return globalForAdminSession.__stepstyleAdminFallbackKey!;
}

export interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
  exp: number;
}

export function signAdminToken(payload: Omit<AdminTokenPayload, 'exp'>): string {
  const fullPayload: AdminTokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8')
    ) as AdminTokenPayload;
    if (!decoded.sub || !decoded.email || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: NextRequest): {
  token: string | null;
  source: 'header' | 'cookie' | null;
} {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return { token: authHeader.slice(7).trim(), source: 'header' };
  }

  const cookieToken = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }

  return { token: null, source: null };
}

function isSameOriginMutation(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  if (req.headers.get('x-requested-with') === 'XMLHttpRequest') {
    return true;
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return true; // server-to-server or curl without origin

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export interface AdminAuthResult {
  ok: boolean;
  admin?: { id: string; email: string; name: string; role: AdminRole };
  status?: number;
  error?: string;
}

export async function requireAdmin(
  req: NextRequest,
  allowedRoles?: AdminRole[]
): Promise<AdminAuthResult> {
  const { token, source } = extractTokenFromRequest(req);
  if (!token) {
    return { ok: false, status: 401, error: 'Admin authentication required.' };
  }

  if (source === 'cookie' && !isSameOriginMutation(req)) {
    return { ok: false, status: 403, error: 'Invalid request origin.' };
  }

  const decoded = verifyAdminToken(token);
  if (!decoded) {
    return { ok: false, status: 401, error: 'Invalid or expired admin session.' };
  }

  const dbAdmin = await getAdminUserById(decoded.sub);
  if (!dbAdmin || dbAdmin.status !== 'active') {
    return { ok: false, status: 403, error: 'Administrator account is inactive or missing.' };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(dbAdmin.role)) {
    return {
      ok: false,
      status: 403,
      error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
    };
  }

  return {
    ok: true,
    admin: {
      id: dbAdmin.id,
      email: dbAdmin.email,
      name: dbAdmin.name,
      role: dbAdmin.role,
    },
  };
}

export function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol || '';
  return proto.toLowerCase().includes('https');
}

export function buildAdminCookieHeader(
  token: string,
  maxAgeSeconds = 60 * 60 * 24 * 7,
  isHttps = true
): string {
  if (isHttps) {
    return `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=None; Partitioned`;
  }
  return `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax`;
}

export function clearAdminCookieHeader(isHttps = true): string {
  if (isHttps) {
    return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`;
  }
  return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
