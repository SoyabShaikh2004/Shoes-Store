import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/adminSession';
import {
  getHeroBannersFromDb,
  updateHeroBannersInDb,
  resetHeroBannersInDb,
} from '@/lib/db/store';

export const dynamic = 'force-dynamic';

function isValidImageInput(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return false;
}

function isValidRelativeLink(link: string): boolean {
  const trimmed = link.trim();
  return trimmed.startsWith('/') && !trimmed.startsWith('//');
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const banners = await getHeroBannersFromDb();
    return NextResponse.json({ success: true, banners });
  } catch (error) {
    console.error('Error reading hero banners:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load hero banners' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const rawSlides = body?.banners;

    if (!Array.isArray(rawSlides) || rawSlides.length !== 3) {
      return NextResponse.json(
        { success: false, error: 'Exactly 3 homepage hero banners are required.' },
        { status: 400 }
      );
    }

    for (let i = 0; i < 3; i++) {
      const slide = rawSlides[i];
      if (!slide || typeof slide.image !== 'string' || !isValidImageInput(slide.image)) {
        return NextResponse.json(
          {
            success: false,
            error: `Slide ${i + 1} needs a valid uploaded image (/uploads/... or /images/...) or https:// URL.`,
          },
          { status: 400 }
        );
      }
      if (!slide.link || typeof slide.link !== 'string' || !isValidRelativeLink(slide.link)) {
        return NextResponse.json(
          {
            success: false,
            error: `Slide ${i + 1} destination link must be a valid internal store path starting with "/".`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await updateHeroBannersInDb(
      rawSlides.map((s, idx) => ({
        id: `slide-${idx + 1}`,
        image: String(s.image).trim(),
        alt: String(s.alt || `StepStyle Hero Shoe Slide ${idx + 1}`).trim(),
        link: String(s.link).trim(),
      }))
    );

    revalidatePath('/');
    return NextResponse.json({ success: true, banners: updated });
  } catch (error) {
    console.error('Error saving hero banners:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save hero banners' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const defaults = await resetHeroBannersInDb();
    revalidatePath('/');
    return NextResponse.json({ success: true, banners: defaults });
  } catch (error) {
    console.error('Error resetting hero banners:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset hero banners' },
      { status: 500 }
    );
  }
}
