import { NextRequest, NextResponse } from 'next/server';
import {
  createSupportMessageInDb,
  getSupportMessagesFromDb,
  updateSupportMessageInDb,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

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
      subject?: string;
      message?: string;
    };

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Please enter your name.' },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }
    if (subject.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Please enter a subject for your inquiry.' },
        { status: 400 }
      );
    }
    if (message.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please provide at least 10 characters describing your request.' },
        { status: 400 }
      );
    }

    const ticket = await createSupportMessageInDb({
      name,
      email,
      subject,
      message,
    });

    return NextResponse.json(
      {
        success: true,
        ticketNumber: ticket.ticketNumber,
        ticket,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unable to submit support inquiry right now.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const messages = await getSupportMessagesFromDb();
    return NextResponse.json(
      {
        success: true,
        messages,
        openCount: messages.filter((m) => m.status !== 'resolved').length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to load support messages.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok || !auth.admin) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      status?: 'open' | 'in_progress' | 'resolved';
      adminNote?: string;
    };

    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Support ticket ID is required.' },
        { status: 400 }
      );
    }

    const allowedStatuses = new Set(['open', 'in_progress', 'resolved']);
    const status =
      body.status && allowedStatuses.has(body.status) ? body.status : undefined;

    const updated = await updateSupportMessageInDb({
      id,
      status,
      adminNote: body.adminNote,
      handledByAdminName: auth.admin.name,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Support ticket not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ticket: updated });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update support ticket.' },
      { status: 500 }
    );
  }
}
