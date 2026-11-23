import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAdminInDb,
  getAdminUsersFromDb,
  registerAdminInDb,
} from '@/lib/db/store';
import {
  buildAdminCookieHeader,
  clearAdminCookieHeader,
  requireAdmin,
  signAdminToken,
} from '@/lib/server/adminSession';
import type { AdminRole } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const users = await getAdminUsersFromDb();
  const fullUser = users.find((u) => u.id === auth.admin.id) || auth.admin;

  return NextResponse.json({
    authenticated: true,
    user: fullUser,
    admins: auth.admin.role === 'Super Admin' ? users : [fullUser],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password, name, role, passcode } = body;

    if (action === 'logout') {
      const res = NextResponse.json({ success: true });
      res.headers.set('Set-Cookie', clearAdminCookieHeader());
      return res;
    }

    if (action === 'login') {
      const result = await authenticateAdminInDb(email || '', password || '');
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: 'error' in result ? result.error : 'Invalid credentials' },
          { status: 401 }
        );
      }

      const token = signAdminToken({
        sub: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      });

      const res = NextResponse.json({
        success: true,
        user: result.user,
        token,
      });
      res.headers.set('Set-Cookie', buildAdminCookieHeader(token));
      return res;
    }

    if (action === 'signup') {
      const requiredPasscode = process.env.ADMIN_SIGNUP_PASSCODE?.trim();
      if (requiredPasscode && String(passcode || '').trim() !== requiredPasscode) {
        return NextResponse.json(
          { success: false, error: 'Invalid administrative signup passcode.' },
          { status: 403 }
        );
      }

      const validRoles: AdminRole[] = [
        'Super Admin',
        'Catalog Manager',
        'Inventory Admin',
        'Order Manager',
      ];
      const requestedRole: AdminRole = validRoles.includes(role)
        ? role
        : 'Catalog Manager';

      // Prevent self-assigning Super Admin unless authenticated as Super Admin or passcode matches
      const safeRole: AdminRole =
        requestedRole === 'Super Admin' && !requiredPasscode
          ? 'Catalog Manager'
          : requestedRole;

      const result = await registerAdminInDb({
        name: String(name || ''),
        email: String(email || ''),
        password: String(password || ''),
        role: safeRole,
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: 'error' in result ? result.error : 'Signup failed' },
          { status: 400 }
        );
      }

      const token = signAdminToken({
        sub: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      });

      const res = NextResponse.json({
        success: true,
        user: result.user,
        token,
      });
      res.headers.set('Set-Cookie', buildAdminCookieHeader(token));
      return res;
    }

    return NextResponse.json(
      { success: false, error: 'Invalid auth action.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
