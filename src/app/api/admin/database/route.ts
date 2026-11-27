import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  DatabaseCollectionKey,
  exportLocalDatabaseSnapshot,
  getLocalDatabaseCollectionPreview,
  getLocalDatabaseDiagnostics,
  restoreLocalDatabaseSnapshot,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin']);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get('download') === '1') {
      const snapshot = await exportLocalDatabaseSnapshot();
      const filename = `stepstyle-local-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      return new NextResponse(JSON.stringify(snapshot, null, 2), {
        status: 200,
        headers: {
          ...NO_STORE_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const diagnostics = await getLocalDatabaseDiagnostics();
    const collectionParam = (searchParams.get('collection') || 'products') as DatabaseCollectionKey;
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 25);
    const offset = Number(searchParams.get('offset') || 0);

    const preview = await getLocalDatabaseCollectionPreview(collectionParam, {
      search,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        success: true,
        diagnostics,
        preview,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to inspect local database.';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin']);
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  if (!isValidSameOriginPost(req)) {
    return NextResponse.json(
      { success: false, error: 'Invalid request origin.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await req.json()) as { snapshot?: unknown };
    if (!body || body.snapshot === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing database snapshot payload.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const diagnostics = await restoreLocalDatabaseSnapshot(body.snapshot);
    revalidatePath('/');
    revalidatePath('/products');

    return NextResponse.json(
      {
        success: true,
        message: 'Local database snapshot restored successfully.',
        diagnostics,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : 'Failed to restore local database snapshot.';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}
