import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/server/adminSession';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per image

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const uploadDir = path.resolve(process.cwd(), 'public/uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files: File[] = [];

      const singleFile = formData.get('file');
      if (singleFile instanceof File) {
        files.push(singleFile);
      }

      const multiFiles = formData.getAll('files');
      for (const f of multiFiles) {
        if (f instanceof File && !files.includes(f)) {
          files.push(f);
        }
      }

      if (files.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No files uploaded' },
          { status: 400 }
        );
      }

      const uploadedUrls: string[] = [];

      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { success: false, error: `File "${file.name}" exceeds 5MB limit.` },
            { status: 400 }
          );
        }

        const mimeType = (file.type || '').toLowerCase();
        const originalName = path.basename(file.name || 'shoe.jpg');
        const ext = (path.extname(originalName).toLowerCase() || '.jpg').replace(
          /[^a-z0-9.]/g,
          ''
        );

        if (!ALLOWED_EXTS.has(ext) || (mimeType && !ALLOWED_MIME_TYPES.has(mimeType))) {
          return NextResponse.json(
            {
              success: false,
              error: `Unsupported image format for "${originalName}". Allowed: JPG, PNG, WEBP, GIF.`,
            },
            { status: 400 }
          );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const baseName = path
          .basename(originalName, ext)
          .replace(/[^a-zA-Z0-9_-]/g, '-')
          .slice(0, 30);
        const fileName = `shoe-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}-${baseName}${ext}`;
        const resolvedPath = path.resolve(uploadDir, fileName);

        if (!resolvedPath.startsWith(uploadDir + path.sep)) {
          return NextResponse.json(
            { success: false, error: 'Invalid upload file path' },
            { status: 400 }
          );
        }

        await fs.writeFile(resolvedPath, buffer);
        uploadedUrls.push(`/uploads/${fileName}`);
      }

      return NextResponse.json({
        success: true,
        url: uploadedUrls[0],
        urls: uploadedUrls,
      });
    }

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { base64, fileName: requestedName } = body;

      if (!base64 || typeof base64 !== 'string') {
        return NextResponse.json(
          { success: false, error: 'base64 string is required' },
          { status: 400 }
        );
      }

      const matches = base64.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i);
      if (!matches || matches.length !== 3) {
        return NextResponse.json(
          { success: false, error: 'Invalid image data URI format.' },
          { status: 400 }
        );
      }

      const mimeType = matches[1].toLowerCase();
      let ext = '.jpg';
      if (mimeType.includes('png')) ext = '.png';
      else if (mimeType.includes('webp')) ext = '.webp';
      else if (mimeType.includes('gif')) ext = '.gif';

      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > MAX_FILE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Image size exceeds 5MB limit.' },
          { status: 400 }
        );
      }

      const cleanName = String(requestedName || 'custom-shoe')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 30);
      const fileName = `shoe-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}-${cleanName}${ext}`;
      const resolvedPath = path.resolve(uploadDir, fileName);

      if (!resolvedPath.startsWith(uploadDir + path.sep)) {
        return NextResponse.json(
          { success: false, error: 'Invalid upload file path' },
          { status: 400 }
        );
      }

      await fs.writeFile(resolvedPath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/${fileName}`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid content type' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload image';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
