import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug?: string[] }> | { slug?: string[] } }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const segments = resolvedParams?.slug || [];

  if (
    !Array.isArray(segments) ||
    segments.length === 0 ||
    segments.some((s) => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\') || s.startsWith('.'))
  ) {
    return NextResponse.json({ error: 'Invalid upload path' }, { status: 400 });
  }

  const ext = path.extname(segments[segments.length - 1]).toLowerCase();
  const contentType = MIME_MAP[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const candidateRoots = [
    path.join(os.tmpdir(), 'stepstyle-uploads'),
    path.resolve(process.cwd(), 'public/uploads'),
  ];

  for (const root of candidateRoots) {
    const resolved = path.resolve(root, ...segments);
    if (!resolved.startsWith(root + path.sep)) {
      continue;
    }
    try {
      const data = await fs.readFile(resolved);
      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      // check next directory
    }
  }

  return NextResponse.json({ error: 'Uploaded file not found' }, { status: 404 });
}
