import crypto from 'crypto';
import { NextRequest } from 'next/server';

export const CUSTOMER_COOKIE_NAME = 'stepstyle_customer_session';

const globalForCustomerSession = globalThis as typeof globalThis & {
  __stepstyleCustomerSessionKey?: string;
};

function getCustomerSigningSecret(): string {
  const envSecret =
    process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  if (!globalForCustomerSession.__stepstyleCustomerSessionKey) {
    globalForCustomerSession.__stepstyleCustomerSessionKey = crypto
      .randomBytes(32)
      .toString('hex');
  }

  return globalForCustomerSession.__stepstyleCustomerSessionKey;
}

function signPayload<T extends object>(payload: T): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getCustomerSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyPayload<T>(token: string): T | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getCustomerSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export interface GoogleOAuthStatePayload {
  nonce: string;
  redirectUri: string;
  exp: number;
}

export function signOAuthState(redirectUri: string): string {
  const payload: GoogleOAuthStatePayload = {
    nonce: crypto.randomBytes(16).toString('hex'),
    redirectUri,
    exp: Date.now() + 1000 * 60 * 10, // 10 minutes
  };
  return signPayload(payload);
}

export function verifyOAuthState(stateToken: string): GoogleOAuthStatePayload | null {
  const decoded = verifyPayload<GoogleOAuthStatePayload>(stateToken);
  if (!decoded || !decoded.nonce || !decoded.redirectUri || decoded.exp < Date.now()) {
    return null;
  }
  return decoded;
}

export interface CustomerSessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  loginMethod: 'google';
  loginTime: string;
}

interface CustomerSessionTokenPayload extends CustomerSessionUser {
  exp: number;
}

export function signCustomerSessionToken(user: CustomerSessionUser): string {
  const payload: CustomerSessionTokenPayload = {
    ...user,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  return signPayload(payload);
}

export function verifyCustomerSessionToken(
  token: string
): CustomerSessionUser | null {
  const decoded = verifyPayload<CustomerSessionTokenPayload>(token);
  if (!decoded || !decoded.sub || !decoded.email || decoded.exp < Date.now()) {
    return null;
  }
  return {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    picture: decoded.picture,
    loginMethod: 'google',
    loginTime: decoded.loginTime,
  };
}

interface GoogleHandoffPayload {
  kind: 'google_handoff';
  user: CustomerSessionUser;
  exp: number;
}

export function signGoogleHandoffToken(user: CustomerSessionUser): string {
  const payload: GoogleHandoffPayload = {
    kind: 'google_handoff',
    user,
    exp: Date.now() + 1000 * 60 * 2, // 2 minutes
  };
  return signPayload(payload);
}

export function verifyGoogleHandoffToken(token: string): CustomerSessionUser | null {
  const decoded = verifyPayload<GoogleHandoffPayload>(token);
  if (
    !decoded ||
    decoded.kind !== 'google_handoff' ||
    !decoded.user?.email ||
    decoded.exp < Date.now()
  ) {
    return null;
  }
  return decoded.user;
}

export function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol || '';
  return proto.toLowerCase().includes('https');
}

export function buildCustomerCookieHeader(
  token: string,
  maxAgeSeconds = 60 * 60 * 24 * 7,
  isHttps = true
): string {
  if (isHttps) {
    return `${CUSTOMER_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=None; Partitioned`;
  }
  return `${CUSTOMER_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax`;
}

export function clearCustomerCookieHeader(isHttps = true): string {
  if (isHttps) {
    return `${CUSTOMER_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`;
  }
  return `${CUSTOMER_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function resolveSafeAppOrigin(req: NextRequest, clientOrigin?: string | null): string {
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (configuredAppUrl) {
    try {
      const parsed = new URL(configuredAppUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // ignore invalid APP_URL
    }
  }

  if (clientOrigin) {
    try {
      const parsed = new URL(clientOrigin);
      const isAllowedHost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.endsWith('.run.app');
      if (
        isAllowedHost &&
        (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      ) {
        return parsed.origin;
      }
    } catch {
      // ignore invalid clientOrigin
    }
  }

  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (forwardedHost) {
    const proto = isHttpsRequest(req) ? 'https' : 'http';
    return `${proto}://${forwardedHost}`;
  }

  return req.nextUrl.origin;
}
