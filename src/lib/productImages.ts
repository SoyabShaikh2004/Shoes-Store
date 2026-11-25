export interface ProductImageLike {
  id: number;
  imagePath?: string;
  images?: string[];
}

const SEEDED_HOME_FORMATS: Record<number, string> = {
  1: '.jpeg',
  2: '.webp',
  3: '.webp',
  4: '.webp',
  5: '.webp',
  6: '.webp',
  7: '.webp',
  8: '.webp',
  9: '.webp',
  10: '.jpg',
  11: '.jpg',
  12: '.jpg',
  13: '.jpg',
  14: '.jpg',
  15: '.jpg',
  16: '.jpeg',
  17: '.png',
  18: '.jpg',
  19: '.jpeg',
  20: '.png',
};

const SEEDED_GALLERY_FORMATS: Record<
  number,
  { home: string; slide1: string; slide2: string; slide3: string; slide3NoHyphen?: boolean }
> = {
  1: { home: '.jpeg', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  2: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.jpg' },
  3: { home: '.webp', slide1: '.webp', slide2: '.jpg', slide3: '.jpg' },
  4: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  5: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  6: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  7: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  8: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  9: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
  10: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  11: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  12: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  13: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  14: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  15: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  16: { home: '.jpeg', slide1: '.png', slide2: '.jpeg', slide3: '.jpeg' },
  17: { home: '.png', slide1: '.png', slide2: '.png', slide3: '.png' },
  18: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
  19: { home: '.jpeg', slide1: '.png', slide2: '.jpeg', slide3: '.jpeg', slide3NoHyphen: true },
  20: { home: '.png', slide1: '.png', slide2: '.png', slide3: '.png' },
};

const FILE_EXT_RE = /\.(jpg|jpeg|png|webp|svg|gif)$/i;

export function isDirectImageSrc(src?: string): boolean {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/api/uploads/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    FILE_EXT_RE.test(trimmed)
  );
}

function isProductFolderPath(src?: string): boolean {
  if (!src) return false;
  const trimmed = src.trim().replace(/\/+$/, '');
  return trimmed.startsWith('/images/Product') && !FILE_EXT_RE.test(trimmed);
}

export function resolveProductImage(product: ProductImageLike): string {
  const validGallery = (product.images || []).filter((img) => isDirectImageSrc(img));
  if (validGallery.length > 0) {
    return validGallery[0].trim();
  }

  const rawPath = (product.imagePath || '').trim();
  if (isDirectImageSrc(rawPath)) {
    return rawPath;
  }

  const folderCandidate =
    rawPath && isProductFolderPath(rawPath)
      ? rawPath.replace(/\/+$/, '')
      : product.images?.[0] && isProductFolderPath(product.images[0])
      ? product.images[0].trim().replace(/\/+$/, '')
      : '';

  if (folderCandidate) {
    const ext = SEEDED_HOME_FORMATS[product.id] || '.jpg';
    return `${folderCandidate}/HomeProduct${ext}`;
  }

  return '/images/Empty-cart.jpg';
}

export function resolveProductGallery(product: ProductImageLike): string[] {
  const validGallery = (product.images || [])
    .map((s) => (s || '').trim())
    .filter((img) => isDirectImageSrc(img));

  if (validGallery.length > 0) {
    return validGallery;
  }

  const rawPath = (product.imagePath || '').trim();
  if (isDirectImageSrc(rawPath)) {
    return [rawPath];
  }

  const folderCandidate =
    rawPath && isProductFolderPath(rawPath)
      ? rawPath.replace(/\/+$/, '')
      : product.images?.[0] && isProductFolderPath(product.images[0])
      ? product.images[0].trim().replace(/\/+$/, '')
      : '';

  if (folderCandidate) {
    const format = SEEDED_GALLERY_FORMATS[product.id] || {
      home: '.webp',
      slide1: '.webp',
      slide2: '.webp',
      slide3: '.webp',
    };
    const slide3Path = format.slide3NoHyphen
      ? `${folderCandidate}/Slide3${format.slide3}`
      : `${folderCandidate}/Slide-3${format.slide3}`;
    return [
      `${folderCandidate}/HomeProduct${format.home}`,
      `${folderCandidate}/Slide-1${format.slide1}`,
      `${folderCandidate}/Slide-2${format.slide2}`,
      slide3Path,
    ];
  }

  return ['/images/Empty-cart.jpg'];
}
