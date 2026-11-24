import { NextRequest, NextResponse } from 'next/server';
import {
  buildCustomerCookieHeader,
  clearCustomerCookieHeader,
  CUSTOMER_COOKIE_NAME,
  isHttpsRequest,
  signCustomerSessionToken,
  verifyCustomerSessionToken,
  verifyGoogleHandoffToken,
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
      email: user.email,
      name: user.name,
      picture: user.picture,
      loginMethod: user.loginMethod,
      loginTime: user.loginTime,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isValidSameOriginPost(req)) {
    return NextResponse.json({ success: false, error: 'Invalid origin.' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { action?: string; handoff?: string };

    if (body.action === 'logout') {
      const res = NextResponse.json({ success: true });
      res.headers.set('Set-Cookie', clearCustomerCookieHeader(isHttpsRequest(req)));
      return res;
    }

    if (!body.handoff || typeof body.handoff !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing Google sign-in token.' },
        { status: 400 }
      );
    }

    const user = verifyGoogleHandoffToken(body.handoff);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Google sign-in session expired. Please try again.' },
        { status: 401 }
      );
    }

    const sessionToken = signCustomerSessionToken(user);
    const res = NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
        loginMethod: user.loginMethod,
        loginTime: user.loginTime,
      },
    });

    res.headers.set(
      'Set-Cookie',
      buildCustomerCookieHeader(sessionToken, 60 * 60 * 24 * 7, isHttpsRequest(req))
    );

    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unable to complete Google sign-in.' },
      { status: 500 }
    );
  }
}
