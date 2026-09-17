import { NextRequest, NextResponse } from 'next/server';
import { getProductById, updateProduct, deleteProduct } from '@/lib/data';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Prepare update payload
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.description !== undefined) updateData.description = String(body.description).trim();
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.mrp !== undefined) updateData.mrp = Number(body.mrp);
    if (body.category !== undefined) updateData.category = String(body.category).trim();
    if (body.inStock !== undefined) updateData.inStock = Boolean(body.inStock);
    if (body.colors !== undefined) updateData.colors = Array.isArray(body.colors) ? body.colors : [];
    if (body.sizes !== undefined) updateData.sizes = Array.isArray(body.sizes) ? body.sizes.map(Number) : [];
    if (body.featured !== undefined) updateData.featured = Boolean(body.featured);
    if (body.brand !== undefined) updateData.brand = String(body.brand).trim();

    // Handle images
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

    // Validate MRP vs Price if both are being changed or present
    if (updateData.price && updateData.mrp && updateData.mrp < updateData.price) {
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
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
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
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to delete product' },
      { status: 500 }
    );
  }
}
