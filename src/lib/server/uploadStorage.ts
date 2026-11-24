import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export interface UploadStorageTarget {
  baseDir: string;
  bulkDir: string;
  baseUrlPrefix: string;
  bulkUrlPrefix: string;
  isTempFallback: boolean;
}

const globalForUploads = globalThis as typeof globalThis & {
  __stepstyleUploadTarget?: UploadStorageTarget;
};

async function testWritableDir(dirPath: string): Promise<boolean> {
  const probePath = path.join(dirPath, `.write-probe-${process.pid}-${Date.now()}`);
  try {
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(probePath, '');
    await fs.unlink(probePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveUploadStorage(): Promise<UploadStorageTarget> {
  if (globalForUploads.__stepstyleUploadTarget) {
    return globalForUploads.__stepstyleUploadTarget;
  }

  const publicUploadsDir = path.resolve(process.cwd(), 'public/uploads');
  const publicWritable = await testWritableDir(publicUploadsDir);

  if (publicWritable) {
    const target: UploadStorageTarget = {
      baseDir: publicUploadsDir,
      bulkDir: path.join(publicUploadsDir, 'bulk'),
      baseUrlPrefix: '/uploads/',
      bulkUrlPrefix: '/uploads/bulk/',
      isTempFallback: false,
    };
    globalForUploads.__stepstyleUploadTarget = target;
    return target;
  }

  const tmpUploadsDir = path.join(os.tmpdir(), 'stepstyle-uploads');
  await fs.mkdir(tmpUploadsDir, { recursive: true });
  const target: UploadStorageTarget = {
    baseDir: tmpUploadsDir,
    bulkDir: path.join(tmpUploadsDir, 'bulk'),
    baseUrlPrefix: '/api/uploads/',
    bulkUrlPrefix: '/api/uploads/bulk/',
    isTempFallback: true,
  };
  globalForUploads.__stepstyleUploadTarget = target;
  return target;
}
