import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct, Product } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category') || '';
    const inStock = searchParams.get('inStock');

    const products = await getProducts(true);

    let filtered = products;

    if (search) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search) ||
        (p.brand && p.brand.toLowerCase().includes(search))
      );
    }

    if (category && category !== 'All') {
      filtered = filtered.filter(p => p.category === category);
    }

    if (inStock !== null && inStock !== undefined && inStock !== '') {
      const boolStock = inStock === 'true';
      filtered = filtered.filter(p => p.inStock === boolStock);
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      products: filtered,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      description,
      price,
      mrp,
      category,
      inStock,
      colors,
      sizes,
      imagePath,
      images,
      featured,
      brand,
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

    // Determine primary image
    const validImages: string[] = Array.isArray(images) ? images.filter(Boolean) : [];
    let finalImagePath = imagePath || '';
    if (!finalImagePath && validImages.length > 0) {
      finalImagePath = validImages[0];
    } else if (!finalImagePath) {
      finalImagePath = '/images/Empty-cart.jpg';
    }

    const productData: Omit<Product, 'id'> = {
      name: name.trim(),
      description: (description || '').trim(),
      price: numPrice,
      mrp: numMrp,
      category: (category || 'Casual').trim(),
      inStock: inStock === undefined ? true : Boolean(inStock),
      colors: Array.isArray(colors) && colors.length > 0 ? colors : ['Black', 'White'],
      sizes: Array.isArray(sizes) && sizes.length > 0 ? sizes.map(Number) : [7, 8, 9, 10, 11],
      imagePath: finalImagePath,
      images: validImages.length > 0 ? validImages : [finalImagePath],
      featured: Boolean(featured),
      brand: brand ? brand.trim() : 'StepStyle',
    };

    const created = await createProduct(productData);

    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      product: created,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
