import { NextRequest, NextResponse } from 'next/server';
import { getProductById, getProducts } from '@/lib/data';
import { getHeroBannersFromDb } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productIdParam = searchParams.get('productId');

    if (productIdParam) {
      const id = Number(productIdParam);
      if (isNaN(id) || id <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid productId' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const rawProduct = await getProductById(id);
      if (!rawProduct) {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      const product =
        rawProduct.category === 'Walking'
          ? { ...rawProduct, category: 'Running' }
          : rawProduct;

      return NextResponse.json(
        {
          success: true,
          product,
          timestamp: Date.now(),
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const [allProducts, heroBanners] = await Promise.all([
      getProducts(false),
      getHeroBannersFromDb(),
    ]);

    const products = allProducts
      .filter(
        (product) =>
          product.status !== 'inactive' &&
          product.inStock &&
          (product.stockQuantity ?? 1) > 0
      )
      .map((product) =>
        product.category === 'Walking'
          ? { ...product, category: 'Running' }
          : product
      );

    const categories = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean))
    );

    return NextResponse.json(
      {
        success: true,
        products,
        categories,
        heroBanners,
        timestamp: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load storefront data';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
