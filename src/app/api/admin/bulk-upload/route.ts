import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { promises as fs } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  BulkImportRowInput,
  bulkImportProductsTransactional,
  getProductsFromDb,
} from '@/lib/db/store';
import { requireAdmin } from '@/lib/server/adminSession';
import { resolveUploadStorage } from '@/lib/server/uploadStorage';

export const dynamic = 'force-dynamic';

const TEMPLATE_HEADERS = [
  'Product Name',
  'SKU',
  'Brand',
  'Category',
  'Description',
  'Price',
  'MRP',
  'Discount Percentage',
  'Stock Quantity',
  'Available Sizes',
  'Available Colors',
  'Product Image',
  'Additional Images',
  'Product Tags',
  'Featured Product',
  'Active / Inactive',
  'Gender',
  'Shoe Type',
];

const SAMPLE_ROWS = [
  {
    'Product Name': 'AeroStride Carbon Pro',
    SKU: 'STEP-RUN-901',
    Brand: 'StepStyle',
    Category: 'Running',
    Description: 'Lightweight marathon runner with responsive nitrogen foam midsole and breathable knit upper.',
    Price: 8999,
    MRP: 11999,
    'Discount Percentage': 25,
    'Stock Quantity': 45,
    'Available Sizes': '7, 8, 9, 10, 11',
    'Available Colors': 'Volt/Black, Triple White',
    'Product Image': '/images/Product1/HomeProduct.jpeg',
    'Additional Images': '/images/Product2/HomeProduct.webp',
    'Product Tags': 'Marathon, Breathable, Carbon',
    'Featured Product': 'Yes',
    'Active / Inactive': 'Active',
    Gender: 'Men',
    'Shoe Type': 'Running Shoes',
  },
  {
    'Product Name': 'Urban Court Low',
    SKU: 'STEP-CAS-902',
    Brand: 'StepStyle Originals',
    Category: 'Casual',
    Description: 'Everyday leather court sneaker with vulcanized rubber cupsole and memory foam footbed.',
    Price: 5499,
    MRP: 6999,
    'Discount Percentage': 21,
    'Stock Quantity': 60,
    'Available Sizes': '6, 7, 8, 9, 10',
    'Available Colors': 'Black/White, Navy/White',
    'Product Image': '/images/Product2/HomeProduct.webp',
    'Additional Images': '',
    'Product Tags': 'Lifestyle, Everyday, Leather',
    'Featured Product': 'No',
    'Active / Inactive': 'Active',
    Gender: 'Unisex',
    'Shoe Type': 'Sneakers',
  },
];

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB for ZIP/Excel
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image

function normalizeKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\.(jpg|jpeg|png|webp|gif)$/i, '')
    .replace(/[^a-z0-9]/g, '');
}

function escapeCsvCell(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function listExistingUploadLookup(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const storage = await resolveUploadStorage();
  const dirs = [
    { dir: storage.bulkDir, prefix: storage.bulkUrlPrefix },
    { dir: storage.baseDir, prefix: storage.baseUrlPrefix },
    { dir: path.resolve(process.cwd(), 'public/uploads/bulk'), prefix: '/uploads/bulk/' },
    { dir: path.resolve(process.cwd(), 'public/uploads'), prefix: '/uploads/' },
  ];

  for (const { dir, prefix } of dirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_IMAGE_EXTS.has(ext)) {
            const url = `${prefix}${entry.name}`;
            map[entry.name.toLowerCase()] = url;
            map[normalizeKey(entry.name)] = url;
          }
        }
      }
    } catch {
      // directory might not exist yet
    }
  }
  return map;
}

function resolveImageReference(
  ref: string,
  sku: string,
  imageMap: Record<string, string>,
  existingLookup: Record<string, string>
): { resolved: string; missing: boolean } {
  const trimmed = ref.trim();
  const combined = { ...existingLookup, ...imageMap };

  if (!trimmed) {
    // Attempt matching by SKU automatically
    const skuKey = normalizeKey(sku);
    if (skuKey && combined[skuKey]) {
      return { resolved: combined[skuKey], missing: false };
    }
    return { resolved: '', missing: true };
  }

  // Already a web URL or valid local public path
  if (
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('/uploads/') ||
    /^https?:\/\//i.test(trimmed)
  ) {
    return { resolved: trimmed, missing: false };
  }

  const baseName = path.basename(trimmed).toLowerCase();
  const normBase = normalizeKey(baseName);
  const skuKey = normalizeKey(sku);

  if (combined[baseName]) return { resolved: combined[baseName], missing: false };
  if (combined[normBase]) return { resolved: combined[normBase], missing: false };
  if (skuKey && combined[skuKey]) return { resolved: combined[skuKey], missing: false };

  return { resolved: trimmed, missing: true };
}

function parseListField(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  return String(val ?? '')
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSizesField(val: unknown): number[] {
  return parseListField(val)
    .map((s) => Number(s.replace(/[^0-9.]/g, '')))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 18);
}

function parseBoolField(val: unknown, defaultValue = false): boolean {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return defaultValue;
  return ['yes', 'true', '1', 'active', 'y', 'featured'].includes(s);
}

function parseGenderField(val: unknown): 'Men' | 'Women' | 'Unisex' | 'Kids' {
  const s = String(val ?? '').trim().toLowerCase();
  if (s.startsWith('w') || s.includes('female')) return 'Women';
  if (s.startsWith('u')) return 'Unisex';
  if (s.startsWith('k') || s.includes('child') || s.includes('youth')) return 'Kids';
  return 'Men';
}

export interface ValidatedPreviewRow {
  rowNumber: number;
  name: string;
  sku: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  stockQuantity: number;
  sizes: number[];
  colors: string[];
  imagePath: string;
  additionalImages: string[];
  tags: string[];
  featured: boolean;
  status: 'active' | 'inactive';
  gender: 'Men' | 'Women' | 'Unisex' | 'Kids';
  shoeType: string;
  isValid: boolean;
  isDuplicateSku: boolean;
  missingImage: boolean;
  errors: string[];
  warnings: string[];
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const template = searchParams.get('template') || 'xlsx';

  if (template === 'csv') {
    const lines = [
      TEMPLATE_HEADERS.map(escapeCsvCell).join(','),
      ...SAMPLE_ROWS.map((row) =>
        TEMPLATE_HEADERS.map((h) =>
          escapeCsvCell((row as Record<string, unknown>)[h])
        ).join(',')
      ),
    ];
    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="stepstyle-bulk-shoes-template.csv"',
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: TEMPLATE_HEADERS });
  XLSX.utils.book_append_sheet(wb, ws, 'Shoes Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="stepstyle-bulk-shoes-template.xlsx"',
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Catalog Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // 1. Multipart upload: either bulk images/ZIP OR Excel/CSV file
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const mode = String(formData.get('mode') || 'parse_validate');

      // 1A. Bulk image or ZIP archive upload
      if (mode === 'upload_images') {
        const storage = await resolveUploadStorage();
        const bulkUploadDir = storage.bulkDir;
        await fs.mkdir(bulkUploadDir, { recursive: true });

        const files = formData.getAll('files').filter((f): f is File => f instanceof File);
        const single = formData.get('file');
        if (single instanceof File && !files.includes(single)) files.push(single);

        if (files.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Please select image files or a .zip archive.' },
            { status: 400 }
          );
        }

        const uploadedMap: Record<string, string> = {};
        const uploadedList: Array<{ originalName: string; url: string }> = [];
        const rejected: Array<{ name: string; reason: string }> = [];

        for (const file of files) {
          if (file.size > MAX_UPLOAD_BYTES) {
            rejected.push({ name: file.name, reason: 'Exceeds 50MB size limit' });
            continue;
          }

          const ext = path.extname(file.name).toLowerCase();

          // Handle ZIP archive of shoe images
          if (ext === '.zip') {
            const arrayBuf = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuf);

            for (const [entryPath, zipEntry] of Object.entries(zip.files)) {
              if (zipEntry.dir) continue;
              // Skip macOS metadata & hidden files
              const baseName = path.basename(entryPath);
              if (entryPath.includes('__MACOSX') || baseName.startsWith('.')) continue;

              // Path traversal check
              if (entryPath.includes('..') || path.isAbsolute(entryPath)) {
                rejected.push({ name: entryPath, reason: 'Unsafe archive path' });
                continue;
              }

              const entryExt = path.extname(baseName).toLowerCase();
              if (!ALLOWED_IMAGE_EXTS.has(entryExt)) {
                rejected.push({
                  name: baseName,
                  reason: 'Not a valid image (.jpg, .jpeg, .png, .webp, .gif)',
                });
                continue;
              }

              const buf = await zipEntry.async('nodebuffer');
              if (buf.length > MAX_IMAGE_BYTES) {
                rejected.push({ name: baseName, reason: 'Image exceeds 5MB limit' });
                continue;
              }

              const safeBase = path
                .basename(baseName, entryExt)
                .replace(/[^a-zA-Z0-9_-]/g, '-')
                .slice(0, 40);
              const outName = `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 7)}-${safeBase}${entryExt}`;
              const resolvedDest = path.resolve(bulkUploadDir, outName);

              if (!resolvedDest.startsWith(bulkUploadDir + path.sep)) {
                rejected.push({ name: baseName, reason: 'Invalid destination path' });
                continue;
              }

              await fs.writeFile(resolvedDest, buf);
              const publicUrl = `${storage.bulkUrlPrefix}${outName}`;
              uploadedMap[baseName.toLowerCase()] = publicUrl;
              uploadedMap[normalizeKey(baseName)] = publicUrl;
              uploadedList.push({ originalName: baseName, url: publicUrl });
            }
            continue;
          }

          // Handle direct image file
          if (!ALLOWED_IMAGE_EXTS.has(ext)) {
            rejected.push({
              name: file.name,
              reason: 'Unsupported file type. Upload JPG, PNG, WEBP, GIF, or ZIP.',
            });
            continue;
          }

          if (file.size > MAX_IMAGE_BYTES) {
            rejected.push({ name: file.name, reason: 'Image exceeds 5MB limit' });
            continue;
          }

          const baseName = path.basename(file.name);
          const safeBase = path
            .basename(baseName, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .slice(0, 40);
          const outName = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}-${safeBase}${ext}`;
          const resolvedDest = path.resolve(bulkUploadDir, outName);

          if (!resolvedDest.startsWith(bulkUploadDir + path.sep)) {
            rejected.push({ name: baseName, reason: 'Invalid destination path' });
            continue;
          }

          const buf = Buffer.from(await file.arrayBuffer());
          await fs.writeFile(resolvedDest, buf);
          const publicUrl = `${storage.bulkUrlPrefix}${outName}`;
          uploadedMap[baseName.toLowerCase()] = publicUrl;
          uploadedMap[normalizeKey(baseName)] = publicUrl;
          uploadedList.push({ originalName: baseName, url: publicUrl });
        }

        return NextResponse.json({
          success: true,
          uploadedCount: uploadedList.length,
          uploadedList,
          imageMap: uploadedMap,
          rejected,
        });
      }

      // 1B. Parse and Validate Excel (.xlsx) or CSV file
      const sheetFile = formData.get('file');
      if (!(sheetFile instanceof File)) {
        return NextResponse.json(
          { success: false, error: 'Please upload a valid .xlsx or .csv file.' },
          { status: 400 }
        );
      }

      if (sheetFile.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Spreadsheet file exceeds 50MB limit.' },
          { status: 400 }
        );
      }

      const sheetExt = path.extname(sheetFile.name).toLowerCase();
      if (!['.xlsx', '.xls', '.csv'].includes(sheetExt)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid file "${sheetFile.name}". Only .xlsx, .xls, and .csv files are allowed.`,
          },
          { status: 400 }
        );
      }

      let imageMap: Record<string, string> = {};
      const imageMapRaw = formData.get('imageMap');
      if (typeof imageMapRaw === 'string' && imageMapRaw.trim()) {
        try {
          imageMap = JSON.parse(imageMapRaw);
        } catch {
          imageMap = {};
        }
      }

      const buffer = Buffer.from(await sheetFile.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return NextResponse.json(
          { success: false, error: 'The uploaded spreadsheet contains no sheets.' },
          { status: 400 }
        );
      }

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[firstSheetName],
        { defval: '' }
      );

      if (rawRows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'The uploaded spreadsheet has no product rows.' },
          { status: 400 }
        );
      }

      const existingProducts = await getProductsFromDb(true);
      const existingSkus = new Set(
        existingProducts.map((p) => p.sku.trim().toUpperCase())
      );
      const seenBatchSkus = new Set<string>();
      const existingImageLookup = await listExistingUploadLookup();

      const previewRows: ValidatedPreviewRow[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const raw = rawRows[i];
        const rowNumber = i + 2; // Excel 1-indexed + header row

        // Skip completely empty rows cleanly with validation note if partial
        const valuesEmpty = Object.values(raw).every(
          (v) => String(v ?? '').trim() === ''
        );
        if (valuesEmpty) {
          previewRows.push({
            rowNumber,
            name: '',
            sku: '',
            brand: 'StepStyle',
            category: 'Casual',
            description: '',
            price: 0,
            mrp: 0,
            discountPercentage: 0,
            stockQuantity: 0,
            sizes: [7, 8, 9, 10],
            colors: ['Black/White'],
            imagePath: '',
            additionalImages: [],
            tags: [],
            featured: false,
            status: 'active',
            gender: 'Men',
            shoeType: 'Sneakers',
            isValid: false,
            isDuplicateSku: false,
            missingImage: true,
            errors: ['Empty row — no product data provided'],
            warnings: [],
          });
          continue;
        }

        const getField = (keys: string[]): string => {
          for (const k of keys) {
            if (raw[k] !== undefined && String(raw[k]).trim() !== '') {
              return String(raw[k]).trim();
            }
          }
          // Case-insensitive header match
          const lowerMap = new Map(
            Object.entries(raw).map(([rk, rv]) => [rk.trim().toLowerCase(), rv])
          );
          for (const k of keys) {
            const v = lowerMap.get(k.toLowerCase());
            if (v !== undefined && String(v).trim() !== '') {
              return String(v).trim();
            }
          }
          return '';
        };

        const name = getField(['Product Name', 'Name', 'Title']);
        const rawSku = getField(['SKU', 'Product SKU']);
        const sku = rawSku.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
        const brand = getField(['Brand']) || 'StepStyle';
        const category = getField(['Category']) || 'Casual';
        const description = getField(['Description', 'Product Description']);
        const priceRaw = getField(['Price', 'Selling Price']).replace(/[₹,\s]/g, '');
        const priceNum = priceRaw ? Number(priceRaw) : NaN;
        const mrpRaw = getField(['MRP', 'Original Price']).replace(/[₹,\s]/g, '');
        const discRaw = getField(['Discount Percentage', 'Discount %', 'Discount']).replace(
          /[%\s]/g,
          ''
        );
        const stockRaw = getField(['Stock Quantity', 'Stock', 'Quantity']).replace(/[,\s]/g, '');
        const sizes = parseSizesField(getField(['Available Sizes', 'Sizes']));
        const colors = parseListField(getField(['Available Colors', 'Colors']));
        const rawPrimaryImage = getField(['Product Image', 'Image', 'Main Image']);
        const rawExtraImages = parseListField(
          getField(['Additional Images', 'Gallery Images'])
        );
        const tags = parseListField(getField(['Product Tags', 'Tags']));
        const featured = parseBoolField(getField(['Featured Product', 'Featured']), false);
        const activeVal = getField(['Active / Inactive', 'Status']).toLowerCase();
        const status: 'active' | 'inactive' =
          activeVal === 'inactive' || activeVal === 'no' || activeVal === 'false'
            ? 'inactive'
            : 'active';
        const gender = parseGenderField(getField(['Gender']));
        const shoeType = getField(['Shoe Type', 'Type']) || category;

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!name) errors.push('Product Name is required');
        if (!sku) errors.push('SKU is required');

        let isDuplicateSku = false;
        if (sku) {
          if (existingSkus.has(sku)) {
            isDuplicateSku = true;
            errors.push(`Duplicate SKU "${sku}" already exists in catalog`);
          } else if (seenBatchSkus.has(sku)) {
            isDuplicateSku = true;
            errors.push(`Duplicate SKU "${sku}" appears earlier in this file`);
          }
          seenBatchSkus.add(sku);
        }

        if (isNaN(priceNum) || priceNum <= 0) {
          errors.push('Price must be a valid number greater than 0');
        }

        const mrpNum = mrpRaw ? Number(mrpRaw) : priceNum > 0 ? Math.round(priceNum * 1.25) : 0;
        if (mrpRaw && (isNaN(mrpNum) || mrpNum < priceNum)) {
          errors.push('MRP must be greater than or equal to Price');
        }

        const parsedDisc = discRaw ? Number(discRaw) : NaN;
        if (discRaw && (isNaN(parsedDisc) || parsedDisc < 0 || parsedDisc > 95)) {
          errors.push('Discount Percentage must be between 0 and 95');
        }
        const discountNum =
          discRaw && !isNaN(parsedDisc)
            ? Math.min(95, Math.max(0, parsedDisc))
            : mrpNum > priceNum && priceNum > 0
            ? Math.round(((mrpNum - priceNum) / mrpNum) * 100)
            : 0;

        const stockQty = stockRaw !== '' ? Number(stockRaw) : 25;
        if (
          stockRaw !== '' &&
          (isNaN(stockQty) || stockQty < 0 || !Number.isInteger(stockQty))
        ) {
          errors.push('Stock Quantity must be a non-negative integer');
        }

        const imgCheck = resolveImageReference(
          rawPrimaryImage,
          sku,
          imageMap,
          existingImageLookup
        );
        if (imgCheck.missing) {
          warnings.push(
            rawPrimaryImage
              ? `Image "${rawPrimaryImage}" not found in uploaded images (fallback placeholder will be used unless uploaded)`
              : 'No Product Image specified (upload matching image or use placeholder)'
          );
        }

        const resolvedAdditional = rawExtraImages
          .map(
            (ref) =>
              resolveImageReference(ref, '', imageMap, existingImageLookup).resolved
          )
          .filter(Boolean);

        previewRows.push({
          rowNumber,
          name,
          sku,
          brand,
          category,
          description,
          price: isNaN(priceNum) ? 0 : priceNum,
          mrp: isNaN(mrpNum) ? 0 : mrpNum,
          discountPercentage: isNaN(discountNum) ? 0 : discountNum,
          stockQuantity: isNaN(stockQty) ? 25 : stockQty,
          sizes: sizes.length > 0 ? sizes : [7, 8, 9, 10, 11],
          colors: colors.length > 0 ? colors : ['Black/White'],
          imagePath: imgCheck.resolved,
          additionalImages: resolvedAdditional,
          tags: tags.length > 0 ? tags : [category, brand],
          featured,
          status,
          gender,
          shoeType,
          isValid: errors.length === 0,
          isDuplicateSku,
          missingImage: imgCheck.missing,
          errors,
          warnings,
        });
      }

      return NextResponse.json({
        success: true,
        fileName: sheetFile.name,
        summary: {
          totalRows: previewRows.length,
          validRows: previewRows.filter((r) => r.isValid).length,
          invalidRows: previewRows.filter((r) => !r.isValid).length,
          duplicateSkus: previewRows.filter((r) => r.isDuplicateSku).length,
          missingImages: previewRows.filter((r) => r.missingImage).length,
        },
        rows: previewRows,
      });
    }

    // 2. JSON actions: import validated rows OR export failed rows report
    if (contentType.includes('application/json')) {
      const body = await req.json();

      if (body.mode === 'import') {
        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (rows.length === 0) {
          return NextResponse.json(
            { success: false, error: 'No rows submitted for import.' },
            { status: 400 }
          );
        }

        const existingLookup = await listExistingUploadLookup();
        const imageMap: Record<string, string> = body.imageMap || {};

        const mappedRows: BulkImportRowInput[] = rows.map((r: ValidatedPreviewRow) => {
          const imgCheck = resolveImageReference(
            r.imagePath || '',
            r.sku || '',
            imageMap,
            existingLookup
          );
          return {
            rowNumber: Number(r.rowNumber) || 0,
            name: String(r.name || ''),
            sku: String(r.sku || ''),
            brand: String(r.brand || 'StepStyle'),
            category: String(r.category || 'Casual'),
            description: String(r.description || ''),
            price: Number(r.price) || 0,
            mrp: Number(r.mrp) || Number(r.price) || 0,
            discountPercentage: Number(r.discountPercentage) || 0,
            stockQuantity: Number(r.stockQuantity) || 0,
            sizes: Array.isArray(r.sizes) ? r.sizes.map(Number) : [7, 8, 9, 10],
            colors: Array.isArray(r.colors) ? r.colors.map(String) : ['Black/White'],
            imagePath: imgCheck.resolved,
            additionalImages: Array.isArray(r.additionalImages) ? r.additionalImages : [],
            tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
            featured: Boolean(r.featured),
            status: r.status === 'inactive' ? 'inactive' : 'active',
            gender: r.gender || 'Men',
            shoeType: String(r.shoeType || r.category || 'Sneakers'),
            missingImage: imgCheck.missing,
          };
        });

        const report = await bulkImportProductsTransactional(mappedRows);

        revalidatePath('/');
        revalidatePath('/products');
        revalidatePath('/products/[id]', 'page');

        return NextResponse.json({
          success: true,
          report,
        });
      }

      if (body.mode === 'export_failed') {
        const failedRows = Array.isArray(body.failedRows) ? body.failedRows : [];
        const format = body.format === 'xlsx' ? 'xlsx' : 'csv';

        const exportData = failedRows.map((r: ValidatedPreviewRow) => ({
          'Row Number': r.rowNumber,
          'Product Name': r.name,
          SKU: r.sku,
          Brand: r.brand,
          Category: r.category,
          Price: r.price,
          MRP: r.mrp,
          'Stock Quantity': r.stockQuantity,
          'Product Image': r.imagePath,
          'Validation Errors': (r.errors || []).join('; '),
        }));

        if (format === 'csv') {
          const headers = Object.keys(
            exportData[0] || {
              'Row Number': '',
              'Product Name': '',
              SKU: '',
              Brand: '',
              Category: '',
              Price: '',
              MRP: '',
              'Stock Quantity': '',
              'Product Image': '',
              'Validation Errors': '',
            }
          );
          const lines = [
            headers.map(escapeCsvCell).join(','),
            ...exportData.map((row: Record<string, unknown>) =>
              headers.map((h) => escapeCsvCell(row[h])).join(',')
            ),
          ];
          return new NextResponse(lines.join('\n'), {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="stepstyle-failed-rows-${Date.now()}.csv"`,
            },
          });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Failed Rows');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="stepstyle-failed-rows-${Date.now()}.xlsx"`,
          },
        });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported request mode.' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Bulk upload error:', error);
    const message = error instanceof Error ? error.message : 'Bulk upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
