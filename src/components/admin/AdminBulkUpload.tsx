'use client';

import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  Download,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Images,
  Play,
  RefreshCw,
} from 'lucide-react';
import { getAdminAuthHeaders } from '@/lib/adminAuth';

interface ValidatedPreviewRow {
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

interface ImportReport {
  totalRows: number;
  successfullyImported: number;
  failedRows: number;
  duplicateSkus: Array<{ rowNumber: number; sku: string; name: string; reason: string }>;
  missingImages: Array<{ rowNumber: number; sku: string; name: string; imageRef: string }>;
  invalidData: Array<{ rowNumber: number; sku: string; name: string; error: string }>;
}

interface AdminBulkUploadProps {
  onImportComplete: () => void;
}

export default function AdminBulkUpload({ onImportComplete }: AdminBulkUploadProps) {
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [uploadedImagesList, setUploadedImagesList] = useState<
    Array<{ originalName: string; url: string }>
  >([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const [isParsingSheet, setIsParsingSheet] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<ValidatedPreviewRow[]>([]);
  const [rowFilter, setRowFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    const toastId = toast.loading(`Downloading ${format.toUpperCase()} template...`);
    try {
      const res = await fetch(`/api/admin/bulk-upload?template=${format}`, {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) throw new Error('Template download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stepstyle-bulk-shoes-template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Sample ${format.toUpperCase()} template downloaded`, { id: toastId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Download failed', { id: toastId });
    }
  };

  const handleBulkImageOrZipUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingImages(true);
    const toastId = toast.loading('Uploading & extracting shoe images...');

    try {
      const formData = new FormData();
      formData.append('mode', 'upload_images');
      Array.from(files).forEach((file) => formData.append('files', file));

      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Image upload failed');
      }

      const nextMap = { ...imageMap, ...(data.imageMap || {}) };
      setImageMap(nextMap);
      setUploadedImagesList((prev) => [...prev, ...(data.uploadedList || [])]);

      if (data.rejected?.length > 0) {
        toast.error(`${data.rejected.length} file(s) skipped due to invalid format/size.`);
      }
      toast.success(`Matched & stored ${data.uploadedCount || 0} image(s)!`, { id: toastId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk image upload failed', {
        id: toastId,
      });
    } finally {
      setIsUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSpreadsheetUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsParsingSheet(true);
    setImportReport(null);
    const toastId = toast.loading(`Validating ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('mode', 'parse_validate');
      formData.append('file', file);
      formData.append('imageMap', JSON.stringify(imageMap));

      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Spreadsheet validation failed');
      }

      setUploadedFileName(data.fileName || file.name);
      setPreviewRows(data.rows || []);
      toast.success(
        `Validated ${data.summary?.totalRows || 0} rows (${data.summary?.validRows || 0} valid)`,
        { id: toastId }
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not parse file', {
        id: toastId,
      });
    } finally {
      setIsParsingSheet(false);
      if (sheetInputRef.current) sheetInputRef.current.value = '';
    }
  };

  // Inline correction handler for preview rows
  const updatePreviewCell = (
    rowIndex: number,
    field: keyof ValidatedPreviewRow,
    value: string | number
  ) => {
    setPreviewRows((prev) => {
      const copy = [...prev];
      const target = { ...copy[rowIndex] };

      if (field === 'price' || field === 'mrp' || field === 'stockQuantity') {
        target[field] = Number(value) || 0;
      } else if (field === 'sku') {
        target.sku = String(value).toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
      } else if (field === 'name') {
        target.name = String(value);
      } else if (field === 'category') {
        target.category = String(value);
      } else if (field === 'brand') {
        target.brand = String(value);
      } else if (field === 'imagePath') {
        target.imagePath = String(value);
        target.missingImage = !target.imagePath.trim();
      }

      // Re-run client validation
      const nextErrors: string[] = [];
      if (!target.name.trim()) nextErrors.push('Product Name is required');
      if (!target.sku.trim()) nextErrors.push('SKU is required');
      if (isNaN(target.price) || target.price <= 0) {
        nextErrors.push('Price must be > 0');
      }
      if (target.mrp < target.price) {
        target.mrp = target.price;
      }
      const otherSkus = new Set(
        copy
          .filter((_, i) => i !== rowIndex)
          .map((r) => r.sku.trim().toUpperCase())
          .filter(Boolean)
      );
      if (target.sku && otherSkus.has(target.sku.trim().toUpperCase())) {
        target.isDuplicateSku = true;
        nextErrors.push(`Duplicate SKU "${target.sku}" in batch`);
      } else {
        target.isDuplicateSku = false;
      }

      target.errors = nextErrors;
      target.isValid = nextErrors.length === 0;
      copy[rowIndex] = target;
      return copy;
    });
  };

  const handleExecuteImport = async () => {
    if (previewRows.length === 0) return;
    setIsImporting(true);
    setImportProgress(25);
    const toastId = toast.loading(`Importing ${previewRows.length} rows into catalog...`);

    const progressTimer = setInterval(() => {
      setImportProgress((p) => (p < 88 ? p + 12 : p));
    }, 250);

    try {
      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          mode: 'import',
          rows: previewRows,
          imageMap,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Import failed');
      }

      clearInterval(progressTimer);
      setImportProgress(100);
      setImportReport(data.report);
      toast.success(
        `Imported ${data.report.successfullyImported} shoes (${data.report.failedRows} failed)`,
        { id: toastId }
      );
      onImportComplete();
    } catch (err: unknown) {
      clearInterval(progressTimer);
      setImportProgress(0);
      toast.error(err instanceof Error ? err.message : 'Bulk import failed', {
        id: toastId,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadFailedRows = async (format: 'csv' | 'xlsx') => {
    const failed = previewRows.filter((r) => !r.isValid);
    if (failed.length === 0 && importReport) {
      // Synthesize failed rows from report if needed
      const reportFailed = [
        ...importReport.duplicateSkus.map((d) => ({
          rowNumber: d.rowNumber,
          name: d.name,
          sku: d.sku,
          brand: '',
          category: '',
          price: 0,
          mrp: 0,
          stockQuantity: 0,
          imagePath: '',
          errors: [d.reason],
        })),
        ...importReport.invalidData.map((d) => ({
          rowNumber: d.rowNumber,
          name: d.name,
          sku: d.sku,
          brand: '',
          category: '',
          price: 0,
          mrp: 0,
          stockQuantity: 0,
          imagePath: '',
          errors: [d.error],
        })),
      ];
      if (reportFailed.length === 0) return;
      await triggerFailedExport(reportFailed, format);
      return;
    }
    await triggerFailedExport(failed, format);
  };

  const triggerFailedExport = async (failedRows: unknown[], format: 'csv' | 'xlsx') => {
    try {
      const res = await fetch('/api/admin/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ mode: 'export_failed', failedRows, format }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stepstyle-failed-rows-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded failed rows (${format.toUpperCase()})`);
    } catch {
      toast.error('Could not download failed rows');
    }
  };

  const visibleRows = previewRows.filter((r) => {
    if (rowFilter === 'valid') return r.isValid;
    if (rowFilter === 'invalid') return !r.isValid;
    return true;
  });

  const validCount = previewRows.filter((r) => r.isValid).length;
  const invalidCount = previewRows.filter((r) => !r.isValid).length;
  const dupCount = previewRows.filter((r) => r.isDuplicateSku).length;
  const missingImgCount = previewRows.filter((r) => r.missingImage).length;

  return (
    <div className="space-y-6">
      {/* Step 1 & Step 2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Step 1: Sample Template */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Step 1 · Template
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Download Bulk Shoe Template
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Includes all 18 required & optional footwear columns with ready-to-use examples.
              </p>
            </div>
            <FileSpreadsheet className="w-6 h-6 text-indigo-600 shrink-0" />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
            <strong>Columns:</strong> Product Name, SKU, Brand, Category, Description, Price, MRP,
            Discount Percentage, Stock Quantity, Available Sizes, Available Colors, Product Image,
            Additional Images, Product Tags, Featured Product, Active / Inactive, Gender, Shoe Type.
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => handleDownloadTemplate('xlsx')}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadTemplate('csv')}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download CSV (.csv)</span>
            </button>
          </div>
        </div>

        {/* Step 2: Bulk Images or ZIP */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Step 2 · Media Assets
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Upload Shoe Images or ZIP Archive
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Name files after your SKU (e.g. <span className="font-mono break-all">STEP-RUN-901.jpg</span>) or exact filename used in the sheet.
              </p>
            </div>
            <Images className="w-6 h-6 text-indigo-600 shrink-0" />
          </div>

          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,.zip"
            onChange={(e) => handleBulkImageOrZipUpload(e.target.files)}
            className="hidden"
          />

          <button
            type="button"
            disabled={isUploadingImages}
            onClick={() => imageInputRef.current?.click()}
            className="w-full min-h-[84px] border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl bg-slate-50/70 hover:bg-indigo-50/30 p-4 flex flex-col items-center justify-center gap-1 text-xs cursor-pointer transition-colors text-center"
          >
            {isUploadingImages ? (
              <span className="font-semibold text-indigo-700">Uploading & extracting media...</span>
            ) : (
              <>
                <span className="font-semibold text-slate-900">
                  Select multiple shoe images or a .ZIP bundle
                </span>
                <span className="text-slate-500">
                  {uploadedImagesList.length > 0
                    ? `${uploadedImagesList.length} asset(s) uploaded and ready for SKU matching`
                    : 'Supports JPG, PNG, WEBP, GIF, and ZIP up to 50MB'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 3: Upload Spreadsheet & Validate */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Step 3 · Parse, Validate & Edit
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Upload Filled Excel (.xlsx) or CSV File
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {uploadedFileName
                ? `Loaded "${uploadedFileName}" — review rows below and fix any flagged cells inline.`
                : 'We validate SKUs, pricing, MRP, stock, and match uploaded images before touching the database.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={sheetInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleSpreadsheetUpload(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              disabled={isParsingSheet}
              onClick={() => sheetInputRef.current?.click()}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span>{isParsingSheet ? 'Validating...' : 'Upload Excel / CSV'}</span>
            </button>
          </div>
        </div>

        {/* Validation Preview */}
        {previewRows.length > 0 && (
          <div className="space-y-4">
            {/* Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Total Rows</span>
                <strong className="text-lg text-slate-900 tabular-nums">
                  {previewRows.length}
                </strong>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-700 block">Valid Rows</span>
                <strong className="text-lg text-emerald-800 tabular-nums">{validCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                <span className="text-rose-700 block">Invalid Rows</span>
                <strong className="text-lg text-rose-800 tabular-nums">{invalidCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-amber-800 block">Duplicate SKUs</span>
                <strong className="text-lg text-amber-900 tabular-nums">{dupCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                <span className="text-slate-600 block">Missing Images</span>
                <strong className="text-lg text-slate-900 tabular-nums">
                  {missingImgCount}
                </strong>
              </div>
            </div>

            {/* Filter & Import Trigger */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRowFilter('all')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                    rowFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All ({previewRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRowFilter('valid')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                    rowFilter === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Valid ({validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRowFilter('invalid')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-lg font-medium cursor-pointer whitespace-nowrap ${
                    rowFilter === 'invalid'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  Invalid ({invalidCount})
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDownloadFailedRows('csv')}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer whitespace-nowrap text-center"
                  >
                    Export Invalid Rows CSV
                  </button>
                )}
                <button
                  type="button"
                  disabled={isImporting || validCount === 0}
                  onClick={handleExecuteImport}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isImporting
                      ? 'Importing...'
                      : `Import ${validCount} Valid Product(s)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {isImporting && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Importing products into database...</span>
                  <span className="tabular-nums">{importProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mobile & Tablet Card Validator */}
            <div className="lg:hidden space-y-3 max-h-[540px] overflow-y-auto pr-0.5">
              {visibleRows.map((row) => {
                const actualIdx = previewRows.findIndex(
                  (r) => r.rowNumber === row.rowNumber
                );
                return (
                  <div
                    key={row.rowNumber}
                    className={`rounded-xl border p-3.5 space-y-3 ${
                      row.isValid
                        ? 'border-slate-200 bg-white'
                        : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">
                        Row #{row.rowNumber}
                      </span>
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-700 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          Error
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Product Name
                        </label>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            updatePreviewCell(actualIdx, 'name', e.target.value)
                          }
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          SKU
                        </label>
                        <input
                          type="text"
                          value={row.sku}
                          onChange={(e) =>
                            updatePreviewCell(actualIdx, 'sku', e.target.value)
                          }
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs font-mono border border-slate-200 rounded-lg bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Category
                        </label>
                        <input
                          type="text"
                          value={row.category}
                          onChange={(e) =>
                            updatePreviewCell(actualIdx, 'category', e.target.value)
                          }
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Price (₹)
                          </label>
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'price', e.target.value)
                            }
                            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Stock
                          </label>
                          <input
                            type="number"
                            value={row.stockQuantity}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'stockQuantity', e.target.value)
                            }
                            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs border border-slate-200 rounded-lg bg-white tabular-nums"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Image Path / Filename
                      </label>
                      <input
                        type="text"
                        value={row.imagePath}
                        onChange={(e) =>
                          updatePreviewCell(actualIdx, 'imagePath', e.target.value)
                        }
                        placeholder="Image URL or filename"
                        className="w-full min-h-[44px] px-3 py-2 text-base sm:text-xs font-mono border border-slate-200 rounded-lg bg-white"
                      />
                    </div>

                    {row.errors.length > 0 && (
                      <p className="text-xs text-rose-700 font-medium">
                        {row.errors.join(' · ')}
                      </p>
                    )}
                    {row.warnings.length > 0 && row.errors.length === 0 && (
                      <p className="text-xs text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{row.warnings[0]}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Editable Validation Table */}
            <div className="hidden lg:block border border-slate-200 rounded-xl overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Row</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Price (₹)</th>
                    <th className="py-2.5 px-3">Stock</th>
                    <th className="py-2.5 px-3">Image / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row) => {
                    const actualIdx = previewRows.findIndex(
                      (r) => r.rowNumber === row.rowNumber
                    );
                    return (
                      <tr
                        key={row.rowNumber}
                        className={row.isValid ? 'bg-white' : 'bg-rose-50/40'}
                      >
                        <td className="py-2 px-3 font-mono tabular-nums">
                          #{row.rowNumber}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'name', e.target.value)
                            }
                            className="w-44 px-2 py-1.5 text-xs border border-slate-200 rounded bg-white"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'sku', e.target.value)
                            }
                            className="w-32 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded bg-white"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.category}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'category', e.target.value)
                            }
                            className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded bg-white"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'price', e.target.value)
                            }
                            className="w-20 px-2 py-1.5 text-xs border border-slate-200 rounded bg-white tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={row.stockQuantity}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'stockQuantity', e.target.value)
                            }
                            className="w-16 px-2 py-1.5 text-xs border border-slate-200 rounded bg-white tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-3 min-w-[220px]">
                          <input
                            type="text"
                            value={row.imagePath}
                            onChange={(e) =>
                              updatePreviewCell(actualIdx, 'imagePath', e.target.value)
                            }
                            placeholder="Image URL or filename"
                            className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded bg-white mb-1"
                          />
                          {row.errors.length > 0 && (
                            <p className="text-[11px] text-rose-700 font-medium">
                              {row.errors.join(' · ')}
                            </p>
                          )}
                          {row.warnings.length > 0 && row.errors.length === 0 && (
                            <p className="text-[11px] text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{row.warnings[0]}</span>
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 4: Final Import Report */}
      {importReport && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Step 4 · Import Complete
              </span>
              <h3 className="text-lg font-bold text-slate-900">Final Bulk Import Report</h3>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {importReport.failedRows > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownloadFailedRows('csv')}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Download Failed CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadFailedRows('xlsx')}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Download Failed Excel
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onImportComplete}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Refresh Storefront</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Total Rows</span>
              <strong className="text-xl text-slate-900 tabular-nums">
                {importReport.totalRows}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-700 block">Imported</span>
              <strong className="text-xl text-emerald-800 tabular-nums">
                {importReport.successfullyImported}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
              <span className="text-rose-700 block">Failed Rows</span>
              <strong className="text-xl text-rose-800 tabular-nums">
                {importReport.failedRows}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-800 block">Duplicate SKUs</span>
              <strong className="text-xl text-amber-900 tabular-nums">
                {importReport.duplicateSkus.length}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600 block">Missing Images</span>
              <strong className="text-xl text-slate-900 tabular-nums">
                {importReport.missingImages.length}
              </strong>
            </div>
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
              <span className="text-rose-700 block">Invalid Data</span>
              <strong className="text-xl text-rose-800 tabular-nums">
                {importReport.invalidData.length}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
