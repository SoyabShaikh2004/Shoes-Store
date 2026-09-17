import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Allowed image MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export async function POST(req: NextRequest) {
  try {
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const contentType = req.headers.get('content-type') || '';

    // Case 1: FormData upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const files: File[] = [];

      // Check single file "file"
      const singleFile = formData.get('file');
      if (singleFile instanceof File) {
        files.push(singleFile);
      }

      // Check multiple files "files"
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
        // Validate MIME type
        const mimeType = file.type || 'image/jpeg';
        if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
          return NextResponse.json(
            { success: false, error: `Unsupported file type: ${mimeType}` },
            { status: 400 }
          );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize original file name
        const originalName = file.name || 'shoe.jpg';
        const ext = path.extname(originalName).toLowerCase() || '.jpg';
        const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
        const fileName = `shoe-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${baseName}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        uploadedUrls.push(`/uploads/${fileName}`);
      }

      return NextResponse.json({
        success: true,
        url: uploadedUrls[0],
        urls: uploadedUrls,
      });
    }

    // Case 2: JSON payload with base64 dataUrl
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { base64, fileName: requestedName } = body;

      if (!base64 || typeof base64 !== 'string') {
        return NextResponse.json(
          { success: false, error: 'base64 string is required' },
          { status: 400 }
        );
      }

      // Parse data URI format: data:image/png;base64,...
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = '.jpg';

      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('svg')) ext = '.svg';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64, 'base64');
      }

      const cleanName = (requestedName || 'custom-shoe').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30);
      const fileName = `shoe-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${cleanName}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/${fileName}`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid content type' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in upload route:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
