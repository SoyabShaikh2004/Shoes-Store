import { NextRequest, NextResponse } from 'next/server';
import { upsertCustomerInDb } from '@/lib/db/store';
import {
  buildCustomerCookieHeader,
  CustomerSessionUser,
  isHttpsRequest,
  signCustomerSessionToken,
  signGoogleHandoffToken,
  verifyOAuthState,
} from '@/lib/server/customerSession';

export const dynamic = 'force-dynamic';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPopupHtml(payload: Record<string, unknown>, fallbackText: string): string {
  const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StepStyle Sign-In</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 24px;
        text-align: center;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        max-width: 360px;
        width: 100%;
      }
      p { margin: 0; font-size: 14px; line-height: 1.5; color: #475569; }
    </style>
  </head>
  <body>
    <div class="card">
      <p>${escapeHtml(fallbackText)}</p>
    </div>
    <script>
      (function () {
        var msg = ${serialized};
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(msg, '*');
          window.close();
        } else {
          window.location.href = '/auth/login';
        }
      })();
    </script>
  </body>
</html>`;
}

export async function GET(req: NextRequest) {
  const oauthError = req.nextUrl.searchParams.get('error');
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (oauthError) {
    return new NextResponse(
      renderPopupHtml(
        {
          type: 'OAUTH_AUTH_ERROR',
          error:
            oauthError === 'access_denied'
              ? 'Google sign-in was cancelled.'
              : 'Google authentication failed. Please try again.',
        },
        'Google sign-in was cancelled. You can close this window.'
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  if (!code || !state) {
    return new NextResponse(
      renderPopupHtml(
        {
          type: 'OAUTH_AUTH_ERROR',
          error: 'Invalid Google sign-in callback parameters.',
        },
        'Invalid sign-in response. Please close this window and try again.'
      ),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  const verifiedState = verifyOAuthState(state);
  if (!verifiedState) {
    return new NextResponse(
      renderPopupHtml(
        {
          type: 'OAUTH_AUTH_ERROR',
          error: 'Sign-in session expired. Please try again.',
        },
        'Your sign-in request expired. Please close this window and try again.'
      ),
      {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return new NextResponse(
      renderPopupHtml(
        {
          type: 'OAUTH_AUTH_ERROR',
          error: 'Google OAuth credentials are not configured on the server.',
        },
        'Server configuration missing. You can close this window.'
      ),
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: verifiedState.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      return new NextResponse(
        renderPopupHtml(
          {
            type: 'OAUTH_AUTH_ERROR',
            error: 'Could not verify Google authorization code.',
          },
          'Could not complete Google sign-in. Please close this window and try again.'
        ),
        {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return new NextResponse(
        renderPopupHtml(
          {
            type: 'OAUTH_AUTH_ERROR',
            error: 'Missing access token from Google.',
          },
          'Could not complete Google sign-in. Please close this window and try again.'
        ),
        {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      return new NextResponse(
        renderPopupHtml(
          {
            type: 'OAUTH_AUTH_ERROR',
            error: 'Could not load your Google profile.',
          },
          'Could not load your Google profile. Please try again.'
        ),
        {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const profile = (await userInfoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email || profile.email_verified === false) {
      return new NextResponse(
        renderPopupHtml(
          {
            type: 'OAUTH_AUTH_ERROR',
            error: 'A verified Google email address is required to sign in.',
          },
          'Verified Google email required. Please close this window and try again.'
        ),
        {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const customerUser: CustomerSessionUser = {
      sub: profile.sub,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture,
      loginMethod: 'google',
      loginTime: new Date().toISOString(),
    };

    const handoff = signGoogleHandoffToken(customerUser);
    const sessionToken = signCustomerSessionToken(customerUser);

    try {
      await upsertCustomerInDb({
        name: customerUser.name,
        email: customerUser.email,
      });
    } catch {
      // non-fatal customer sync
    }

    const response = new NextResponse(
      renderPopupHtml(
        {
          type: 'OAUTH_AUTH_SUCCESS',
          handoff,
        },
        'Authentication successful. This window will close automatically.'
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );

    response.headers.set(
      'Set-Cookie',
      buildCustomerCookieHeader(sessionToken, 60 * 60 * 24 * 7, isHttpsRequest(req))
    );

    return response;
  } catch {
    return new NextResponse(
      renderPopupHtml(
        {
          type: 'OAUTH_AUTH_ERROR',
          error: 'Google authentication encountered an error. Please try again.',
        },
        'Sign-in error. Please close this window and try again.'
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}
