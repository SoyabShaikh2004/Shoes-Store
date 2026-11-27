import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifySuperAdminPasswordAndPurgeOldDataInDb } from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin']);
  if (!auth.ok || !auth.admin) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Super Admin authentication required.' },
      { status: auth.status || 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!password.trim()) {
      return NextResponse.json(
        { success: false, error: 'Super Admin password is required to delete old data.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const result = await verifySuperAdminPasswordAndPurgeOldDataInDb({
      adminId: auth.admin.id,
      password,
    });

    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status, headers: NO_STORE_HEADERS }
      );
    }

    revalidatePath('/admin');
    revalidatePath('/track-order');
    revalidatePath('/account');
    revalidatePath('/');

    return NextResponse.json(
      {
        success: true,
        purged: result.purged,
        lastPurgedAt: result.lastPurgedAt,
        storageMode: result.storageMode,
        message:
          'All old orders, customers, payments, and support tickets have been permanently deleted.',
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to purge old transactional data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
