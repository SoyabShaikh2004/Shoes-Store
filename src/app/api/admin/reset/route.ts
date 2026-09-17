import { NextRequest, NextResponse } from 'next/server';
import { resetProductsToDefault } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const products = await resetProductsToDefault();
    return NextResponse.json({
      success: true,
      message: 'Catalog reset to default template successfully',
      count: products.length,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset catalog' },
      { status: 500 }
    );
  }
}
