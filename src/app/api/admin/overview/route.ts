import { NextRequest, NextResponse } from 'next/server';
import { getAdminOverviewSnapshotFromDb } from '@/lib/db/store';
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
    const snapshot = await getAdminOverviewSnapshotFromDb();

    return NextResponse.json(
      {
        success: true,
        overview: snapshot.overview,
        orders: snapshot.orders,
        ordersCount: snapshot.orders.length,
        recentOrders: snapshot.recentOrders,
        productsCount: snapshot.productsCount,
        lowStockProducts: snapshot.lowStockProducts,
        categories: snapshot.categories,
        brands: snapshot.brands,
        customers: snapshot.customers,
        payments: snapshot.payments,
        shipping: snapshot.shipping,
        returns: snapshot.returns,
        refunds: snapshot.refunds,
        notifications: snapshot.notifications,
        adminNotifications: snapshot.adminNotifications,
        unreadNotificationsCount: snapshot.unreadNotificationsCount,
        openSupportCount: snapshot.openSupportCount,
        supportMessagesCount: snapshot.supportMessagesCount,
        admins:
          auth.admin.role === 'Super Admin'
            ? snapshot.admins
            : snapshot.admins.filter((a) => a.id === auth.admin.id),
        storageMode: snapshot.storageMode,
        lastPurgedAt: snapshot.lastPurgedAt,
        syncedAt: snapshot.syncedAt,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard overview';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
