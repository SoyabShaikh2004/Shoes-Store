import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateCustomerInDb,
  authenticateCustomerViaOtpInDb,
  registerCustomerInDb,
  resetCustomerPasswordInDb,
  upsertCustomerInDb,
} from '@/lib/db/store';
import {
  buildCustomerCookieHeader,
  clearCustomerCookieHeader,
  CUSTOMER_COOKIE_NAME,
  CustomerSessionUser,
  isHttpsRequest,
  signCustomerSessionToken,
  verifyCustomerSessionToken,
} from '@/lib/server/customerSession';

export const dynamic = 'force-dynamic';

function isValidSameOriginPost(req: NextRequest): boolean {
  if (req.headers.get('x-requested-with') === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function buildCookieResponse(
  req: NextRequest,
  sessionUser: CustomerSessionUser,
  extra?: Record<string, unknown>
) {
  const token = signCustomerSessionToken(sessionUser);
  const res = NextResponse.json({
    success: true,
    user: {
      id: sessionUser.sub,
      name: sessionUser.name,
      email: sessionUser.email,
      phone: sessionUser.phone || '',
      loginMethod: sessionUser.loginMethod,
      loginTime: sessionUser.loginTime,
    },
    ...(extra || {}),
  });
  res.headers.set(
    'Set-Cookie',
    buildCustomerCookieHeader(token, 60 * 60 * 24 * 7, isHttpsRequest(req))
  );
  return res;
}

export async function GET(req: NextRequest) {
  const cookieToken = req.cookies.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!cookieToken) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  const user = verifyCustomerSessionToken(cookieToken);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.sub,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      picture: user.picture,
      loginMethod: user.loginMethod,
      loginTime: user.loginTime,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isValidSameOriginPost(req)) {
    return NextResponse.json({ success: false, error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      name?: string;
      email?: string;
      phone?: string;
      identifier?: string;
      password?: string;
      newPassword?: string;
    };

    const action = String(body.action || 'sync_profile');

    if (action === 'logout') {
      const res = NextResponse.json({ success: true });
      res.headers.set('Set-Cookie', clearCustomerCookieHeader(isHttpsRequest(req)));
      return res;
    }

    if (action === 'signup') {
      const result = await registerCustomerInDb({
        name: String(body.name || ''),
        email: body.email ? String(body.email) : undefined,
        phone: body.phone ? String(body.phone) : undefined,
        identifier: body.identifier ? String(body.identifier) : undefined,
        password: String(body.password || ''),
      });
      if (result.success === false) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.status }
        );
      }
      return buildCookieResponse(req, {
        sub: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone !== 'N/A' ? result.user.phone : undefined,
        loginMethod: 'password',
        loginTime: new Date().toISOString(),
      });
    }

    if (action === 'login') {
      const result = await authenticateCustomerInDb({
        identifier: String(body.identifier || body.email || body.phone || ''),
        password: String(body.password || ''),
      });
      if (result.success === false) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.status }
        );
      }
      return buildCookieResponse(req, {
        sub: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone !== 'N/A' ? result.user.phone : undefined,
        loginMethod: 'password',
        loginTime: new Date().toISOString(),
      });
    }

    if (action === 'otp_login') {
      const result = await authenticateCustomerViaOtpInDb({
        identifier: body.identifier ? String(body.identifier) : undefined,
        phone: body.phone ? String(body.phone) : undefined,
        email: body.email ? String(body.email) : undefined,
        name: body.name ? String(body.name) : undefined,
      });
      if (result.success === false) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.status }
        );
      }
      return buildCookieResponse(req, {
        sub: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone !== 'N/A' ? result.user.phone : undefined,
        loginMethod: 'otp',
        loginTime: new Date().toISOString(),
      });
    }

    if (action === 'reset_password') {
      const result = await resetCustomerPasswordInDb({
        identifier: String(body.identifier || body.email || body.phone || ''),
        newPassword: String(body.newPassword || body.password || ''),
      });
      if (result.success === false) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.status }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Password updated successfully.',
      });
    }

    // Default: profile sync
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';

    if (!rawEmail && rawPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'A valid email or 10-digit phone number is required.' },
        { status: 400 }
      );
    }

    await upsertCustomerInDb({
      name: rawName || undefined,
      email: rawEmail || undefined,
      phone: rawPhone.length === 10 ? rawPhone : undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to process customer authentication request.' },
      { status: 500 }
    );
  }
}
