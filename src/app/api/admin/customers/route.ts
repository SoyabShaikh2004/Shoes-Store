import { NextRequest, NextResponse } from 'next/server';
import { getAdminCustomersFromDb } from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    let customers = await getAdminCustomersFromDb();

    if (search) {
      customers = customers.filter((c) => {
        const matchFields = [
          c.name,
          c.phone,
          c.email,
          c.defaultAddress || '',
          c.defaultPincode || '',
          c.lastOrderNumber || '',
          ...c.orders.map((o) => o.orderNumber),
        ];
        return matchFields.some((val) => val.toLowerCase().includes(search));
      });
    }

    return NextResponse.json({
      success: true,
      customers,
      totalCustomers: customers.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load customers';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
