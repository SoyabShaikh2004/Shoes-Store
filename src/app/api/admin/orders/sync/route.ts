import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ClientSyncOrderInput,
  reconcileClientOrdersTransactional,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Order Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await req.json()) as { orders?: unknown };
    if (!body || !Array.isArray(body.orders)) {
      return NextResponse.json(
        { success: false, error: 'orders array is required.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const sanitizedList = body.orders.slice(0, 100) as ClientSyncOrderInput[];
    const result = await reconcileClientOrdersTransactional(sanitizedList, {
      allowStatusPreservation: true,
    });

    if (result.importedCount > 0) {
      revalidatePath('/');
      revalidatePath('/products');
      revalidatePath('/products/[id]', 'page');
    }

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to synchronize orders';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
