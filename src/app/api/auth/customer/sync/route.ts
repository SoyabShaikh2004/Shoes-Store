import { NextRequest, NextResponse } from 'next/server';
import { upsertCustomerInDb } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

function isValidSameOriginPost(req: NextRequest): boolean {
  if (req.headers.get('x-requested-with') === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isValidSameOriginPost(req)) {
    return NextResponse.json({ success: false, error: 'Invalid request origin.' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      phone?: string;
    };

    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';

    if (!rawEmail && rawPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'A valid email or 10-digit phone number is required.' },
        { status: 400 }
      );
    }

    await upsertCustomerInDb({
      name: rawName || undefined,
      email: rawEmail || undefined,
      phone: rawPhone.length === 10 ? rawPhone : undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to sync customer profile.' },
      { status: 500 }
    );
  }
}
