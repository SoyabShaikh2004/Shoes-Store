import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOrdersAdmin,
  getAdminAnalyticsAndEntities,
  getAdminNotificationsFromDb,
  getAdminUsersFromDb,
  getProductsFromDb,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const [{ overview, orders }, entities, products, admins, adminNotifData] =
      await Promise.all([
        getAllOrdersAdmin({ sort: 'newest' }),
        getAdminAnalyticsAndEntities(),
        getProductsFromDb(true),
        getAdminUsersFromDb(),
        getAdminNotificationsFromDb(50),
      ]);

    return NextResponse.json({
      success: true,
      overview,
      recentOrders: orders.slice(0, 8),
      productsCount: products.length,
      lowStockProducts: products.filter((p) => (p.stockQuantity ?? 0) <= 10),
      ...entities,
      adminNotifications: adminNotifData.notifications,
      unreadNotificationsCount: adminNotifData.unreadCount,
      admins: auth.admin.role === 'Super Admin' ? admins : admins.filter((a) => a.id === auth.admin.id),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard overview';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
