import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminNotificationsFromDb,
  getAdminSyncSummaryFromDb,
  markAdminNotificationsReadInDb,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const [{ notifications, unreadCount }, syncSummary] = await Promise.all([
      getAdminNotificationsFromDb(50),
      getAdminSyncSummaryFromDb(),
    ]);

    return NextResponse.json(
      {
        success: true,
        notifications,
        unreadCount,
        totalOrders: syncSummary.totalOrders,
        totalCustomers: syncSummary.totalCustomers,
        latestOrderAt: syncSummary.latestOrderAt,
        latestCustomerAt: syncSummary.latestCustomerAt,
        syncSummary,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load admin notifications';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok || !auth.admin) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      id?: string;
      orderNumber?: string;
      all?: boolean;
    };

    if (body.action !== 'mark_read') {
      return NextResponse.json(
        { success: false, error: 'Unsupported notification action.' },
        { status: 400 }
      );
    }

    if (!body.all && !body.id && !body.orderNumber) {
      return NextResponse.json(
        { success: false, error: 'Specify id, orderNumber, or all: true.' },
        { status: 400 }
      );
    }

    const result = await markAdminNotificationsReadInDb({
      id: body.id ? String(body.id) : undefined,
      orderNumber: body.orderNumber ? String(body.orderNumber) : undefined,
      all: Boolean(body.all),
      adminName: auth.admin.name,
    });

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update notifications';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
