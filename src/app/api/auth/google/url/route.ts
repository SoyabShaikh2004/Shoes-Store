import { NextRequest, NextResponse } from 'next/server';
import { resolveSafeAppOrigin, signOAuthState } from '@/lib/server/customerSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  const clientOrigin = req.nextUrl.searchParams.get('origin');
  const appOrigin = resolveSafeAppOrigin(req, clientOrigin);
  const redirectUri = `${appOrigin}/auth/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        configured: false,
        redirectUri,
        error:
          'Google Sign-In requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured in AI Studio Secrets.',
      },
      { status: 503 }
    );
  }

  const state = signOAuthState(redirectUri);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    access_type: 'online',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.json({
    configured: true,
    url: authUrl,
  });
}
