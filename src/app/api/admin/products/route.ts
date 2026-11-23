import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct, Product } from '@/lib/data';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category') || '';
    const inStock = searchParams.get('inStock');

    const products = await getProducts(true);

    let filtered = products;

    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search) ||
          (p.sku && p.sku.toLowerCase().includes(search)) ||
          (p.brand && p.brand.toLowerCase().includes(search))
      );
    }

    if (category && category !== 'All') {
      filtered = filtered.filter((p) => p.category === category);
    }

    if (inStock !== null && inStock !== undefined && inStock !== '') {
      const boolStock = inStock === 'true';
      filtered = filtered.filter((p) => p.inStock === boolStock);
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      products: filtered,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();

    const {
      name,
      sku,
      description,
      price,
      mrp,
      category,
      inStock,
      stockQuantity,
      colors,
      sizes,
      tags,
      imagePath,
      images,
      featured,
      brand,
      status,
      gender,
      shoeType,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product name is required' },
        { status: 400 }
      );
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid selling price (₹) is required' },
        { status: 400 }
      );
    }

    const numMrp = mrp ? Number(mrp) : Math.round(numPrice * 1.25);
    if (isNaN(numMrp) || numMrp < numPrice) {
      return NextResponse.json(
        { success: false, error: 'MRP must be greater than or equal to selling price' },
        { status: 400 }
      );
    }

    const validImages: string[] = Array.isArray(images) ? images.filter(Boolean) : [];
    let finalImagePath = imagePath || '';
    if (!finalImagePath && validImages.length > 0) {
      finalImagePath = validImages[0];
    } else if (!finalImagePath) {
      finalImagePath = '/images/Empty-cart.jpg';
    }

    const productData: Omit<Product, 'id'> = {
      sku: sku ? String(sku).trim() : undefined,
      name: name.trim(),
      description: (description || '').trim(),
      price: numPrice,
      mrp: numMrp,
      category: (category || 'Casual').trim(),
      inStock: inStock === undefined ? true : Boolean(inStock),
      stockQuantity:
        stockQuantity !== undefined ? Math.max(0, Number(stockQuantity) || 0) : undefined,
      colors: Array.isArray(colors) && colors.length > 0 ? colors : ['Black', 'White'],
      sizes: Array.isArray(sizes) && sizes.length > 0 ? sizes.map(Number) : [7, 8, 9, 10, 11],
      tags: Array.isArray(tags) ? tags.map(String) : undefined,
      imagePath: finalImagePath,
      images: validImages.length > 0 ? validImages : [finalImagePath],
      featured: Boolean(featured),
      brand: brand ? String(brand).trim() : 'StepStyle',
      status: status === 'inactive' ? 'inactive' : 'active',
      gender:
        gender === 'Women' || gender === 'Unisex' || gender === 'Kids' ? gender : 'Men',
      shoeType: shoeType ? String(shoeType).trim() : undefined,
    };

    const created = await createProduct(productData);

    return NextResponse.json(
      {
        success: true,
        message: 'Product created successfully',
        product: created,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create product';
    const isDuplicate = message.toLowerCase().includes('duplicate sku');
    return NextResponse.json(
      { success: false, error: message },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
