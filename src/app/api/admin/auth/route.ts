import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Seeded authorized super admin
const DEFAULT_SUPER_ADMIN = {
  id: 'admin-soyab-super',
  name: 'Soyab Shaikh',
  email: 'soyxbshxikh@gmail.com',
  password: 'Soyab@8830',
  role: 'Super Admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password, name, role } = body;

    if (action === 'login') {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        return NextResponse.json(
          { success: false, error: 'Email and password are required' },
          { status: 400 }
        );
      }

      // Check default super admin
      if (
        cleanEmail === DEFAULT_SUPER_ADMIN.email.toLowerCase() &&
        cleanPassword === DEFAULT_SUPER_ADMIN.password
      ) {
        return NextResponse.json({
          success: true,
          user: {
            id: DEFAULT_SUPER_ADMIN.id,
            name: DEFAULT_SUPER_ADMIN.name,
            email: DEFAULT_SUPER_ADMIN.email,
            role: DEFAULT_SUPER_ADMIN.role,
            status: DEFAULT_SUPER_ADMIN.status,
            createdAt: DEFAULT_SUPER_ADMIN.createdAt,
            lastLogin: new Date().toISOString(),
          },
        });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid admin email or password' },
        { status: 401 }
      );
    }

    if (action === 'signup') {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (name || '').trim();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanName || !cleanPassword) {
        return NextResponse.json(
          { success: false, error: 'Name, email, and password are required' },
          { status: 400 }
        );
      }

      if (cleanEmail === DEFAULT_SUPER_ADMIN.email.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'This super admin account already exists. Please sign in.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: `admin-${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          role: role || 'Catalog Manager',
          status: 'active',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid auth action' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Authentication error' },
      { status: 500 }
    );
  }
}
