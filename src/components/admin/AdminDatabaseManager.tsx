'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';
import { getAdminAuthHeaders, handleAdminUnauthorized } from '@/lib/adminAuth';
import { formatDateTimeIN } from '@/lib/orderTypes';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';

interface CollectionSummary {
  key: string;
  label: string;
  count: number;
}

interface DiagnosticsPayload {
  storageMode: 'mongodb' | 'local-json' | 'local-memory-fallback';
  dbPath: string;
  bundledWritable: boolean;
  memoryFallbackActive: boolean;
  fileSizeBytes: number;
  lastModifiedAt: string | null;
  version: number;
  collections: CollectionSummary[];
}

interface PreviewPayload {
  collection: string;
  label: string;
  totalCount: number;
  filteredCount: number;
  limit: number;
  offset: number;
  records: unknown[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminDatabaseManager({
  onDatabaseRestored,
}: {
  onDatabaseRestored?: () => void;
}) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string>('products');
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<{
    fileName: string;
    data: unknown;
    summary: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDatabaseState = useCallback(
    async (showToast = false) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          collection: selectedCollection,
          limit: String(limit),
          offset: String(offset),
        });
        if (debouncedSearch.trim()) {
          params.set('search', debouncedSearch.trim());
        }

        const res = await fetch(`/api/admin/database?${params.toString()}`, {
          credentials: 'include',
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (handleAdminUnauthorized(res.status, data?.error)) return;
        if (!res.ok || !data?.success) {
          toast.error(data?.error || 'Could not inspect local database');
          return;
        }

        setDiagnostics(data.diagnostics);
        setPreview(data.preview);
        if (showToast) toast.success('Database view refreshed');
      } catch {
        toast.error('Network error inspecting database');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedCollection, limit, offset, debouncedSearch]
  );

  useEffect(() => {
    void fetchDatabaseState();
  }, [fetchDatabaseState]);

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/admin/database?download=1', {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Failed to download backup');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stepstyle-database-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Database backup downloaded (credentials redacted)');
    } catch {
      toast.error('Could not export database snapshot');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePickSnapshotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
        toast.error('Invalid snapshot JSON: expected a StepStyle database export (version: 1).');
        return;
      }
      const productsCount = Array.isArray(parsed.products) ? parsed.products.length : 0;
      const ordersCount = Array.isArray(parsed.orders) ? parsed.orders.length : 0;
      const usersCount = Array.isArray(parsed.users) ? parsed.users.length : 0;

      setPendingSnapshot({
        fileName: file.name,
        data: parsed,
        summary: `${productsCount} products · ${ordersCount} orders · ${usersCount} customers`,
      });
    } catch {
      toast.error('Selected file is not valid JSON.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingSnapshot) return;
    setIsRestoring(true);
    try {
      const res = await fetch('/api/admin/database', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ snapshot: pendingSnapshot.data }),
      });
      const data = await res.json().catch(() => null);
      if (handleAdminUnauthorized(res.status, data?.error)) return;
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Failed to restore database snapshot');
        return;
      }

      toast.success('Local database restored successfully');
      setPendingSnapshot(null);
      notifyStorefrontChanged('all');
      onDatabaseRestored?.();
      await fetchDatabaseState();
    } catch {
      toast.error('Network error while restoring database');
    } finally {
      setIsRestoring(false);
    }
  };

  const totalFiltered = preview?.filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-5">
      {/* Header & Storage Diagnostics */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Local Database Explorer
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Super Admin Access</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect live collections, download sanitized JSON backups, or restore snapshots directly to local storage
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => void fetchDatabaseState(true)}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadBackup}
              className="flex-1 sm:flex-none min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Exporting...' : 'Download JSON Backup'}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore Snapshot</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handlePickSnapshotFile}
              className="hidden"
            />
          </div>
        </div>

        {diagnostics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                <span>Storage Mode</span>
              </div>
              <div className="mt-1 font-mono font-bold text-slate-900">
                {diagnostics.storageMode}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 sm:col-span-2 lg:col-span-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Active Database File
              </div>
              <div
                title={diagnostics.dbPath}
                className="mt-1 font-mono font-semibold text-slate-800 truncate"
              >
                {diagnostics.dbPath}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Snapshot Size
              </div>
              <div className="mt-1 font-mono font-bold text-slate-900 tabular-nums">
                {formatBytes(diagnostics.fileSizeBytes)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Last Modified
              </div>
              <div className="mt-1 font-medium text-slate-800 tabular-nums">
                {diagnostics.lastModifiedAt ? formatDateTimeIN(diagnostics.lastModifiedAt) : 'In Memory'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collection Selector & JSON Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-3 space-y-2 lg:space-y-1 h-fit min-w-0">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Database Collections
          </div>
          <div className="flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {(diagnostics?.collections || []).map((col) => {
              const active = selectedCollection === col.key;
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => {
                    setSelectedCollection(col.key);
                    setOffset(0);
                  }}
                  className={`shrink-0 lg:w-full min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-700 bg-slate-50 lg:bg-transparent hover:bg-slate-100 lg:hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{col.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[11px] tabular-nums ${
                      active ? 'bg-slate-800 text-slate-100' : 'bg-slate-200/70 lg:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {col.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col min-w-0">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {preview?.label || selectedCollection}
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
                Showing {preview?.records.length ?? 0} of {totalFiltered} matching records (password hashes redacted)
              </p>
            </div>
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter JSON records..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 text-base sm:text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Reading local database records...</p>
            </div>
          ) : !preview || preview.records.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No records found in this collection matching your filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {preview.records.map((rec, idx) => (
                <div key={idx} className="p-3.5 hover:bg-slate-50/60">
                  <pre className="text-[11px] leading-relaxed font-mono text-slate-800 whitespace-pre-wrap break-all overflow-x-auto bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                    {JSON.stringify(rec, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
                  aria-label="Previous records"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={offset + limit >= totalFiltered}
                  onClick={() => setOffset((o) => o + limit)}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
                  aria-label="Next records"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Restore Snapshot Confirmation Modal */}
      {pendingSnapshot && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-db-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-700">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 id="restore-db-title" className="text-base font-bold text-slate-900">
                  Confirm Database Restore
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingSnapshot(null)}
                aria-label="Cancel restore"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-600 space-y-2">
              <p>
                Restoring <strong>{pendingSnapshot.fileName}</strong> will replace current products,
                orders, and customer records in your local database.
              </p>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 break-words">
                {pendingSnapshot.summary}
              </div>
              <p className="text-[11px] text-slate-500">
                Existing admin login credentials and redacted customer password hashes are preserved automatically.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setPendingSnapshot(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => void handleConfirmRestore()}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {isRestoring ? 'Restoring...' : 'Restore Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
