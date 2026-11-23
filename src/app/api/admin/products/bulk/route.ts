import { NextRequest, NextResponse } from 'next/server';
import {
  BulkProductActionPayload,
  bulkMutateProductsTransactional,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as BulkProductActionPayload;
    if (!body || !body.action || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Action and at least one selected product ID are required.' },
        { status: 400 }
      );
    }

    const result = await bulkMutateProductsTransactional(body);

    return NextResponse.json({
      success: true,
      affectedCount: result.affectedCount,
      message: `Bulk action applied to ${result.affectedCount} product(s).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk product action failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
