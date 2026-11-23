import { NextRequest, NextResponse } from 'next/server';
import { getProductById, updateProduct, deleteProduct } from '@/lib/data';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.sku !== undefined) updateData.sku = String(body.sku).trim();
    if (body.description !== undefined) updateData.description = String(body.description).trim();
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.mrp !== undefined) updateData.mrp = Number(body.mrp);
    if (body.category !== undefined) updateData.category = String(body.category).trim();
    if (body.inStock !== undefined) updateData.inStock = Boolean(body.inStock);
    if (body.stockQuantity !== undefined) {
      updateData.stockQuantity = Math.max(0, Math.floor(Number(body.stockQuantity) || 0));
    }
    if (body.colors !== undefined) {
      updateData.colors = Array.isArray(body.colors) ? body.colors : [];
    }
    if (body.sizes !== undefined) {
      updateData.sizes = Array.isArray(body.sizes) ? body.sizes.map(Number) : [];
    }
    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    }
    if (body.featured !== undefined) updateData.featured = Boolean(body.featured);
    if (body.brand !== undefined) updateData.brand = String(body.brand).trim();
    if (body.status !== undefined) {
      updateData.status = body.status === 'inactive' ? 'inactive' : 'active';
    }
    if (body.gender !== undefined) updateData.gender = String(body.gender);
    if (body.shoeType !== undefined) updateData.shoeType = String(body.shoeType).trim();

    if (body.images !== undefined) {
      const validImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
      updateData.images = validImages;
      if (validImages.length > 0 && !body.imagePath) {
        updateData.imagePath = validImages[0];
      }
    }
    if (body.imagePath !== undefined) {
      updateData.imagePath = String(body.imagePath);
    }

    if (
      typeof updateData.price === 'number' &&
      typeof updateData.mrp === 'number' &&
      updateData.mrp < updateData.price
    ) {
      return NextResponse.json(
        { success: false, error: 'MRP must be greater than or equal to selling price' },
        { status: 400 }
      );
    }

    const updated = await updateProduct(id, updateData);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Product not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product updated successfully',
      product: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    const isDuplicate = message.toLowerCase().includes('duplicate sku');
    return NextResponse.json(
      { success: false, error: message },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const deleted = await deleteProduct(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Product not found or could not be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Product #${id} deleted successfully`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
