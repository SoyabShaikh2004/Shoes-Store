import { NextRequest, NextResponse } from 'next/server';
import { resetProductsToDefault } from '@/lib/data';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const products = await resetProductsToDefault();
    return NextResponse.json({
      success: true,
      message: 'Catalog reset to default template successfully',
      count: products.length,
      products,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset catalog';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
