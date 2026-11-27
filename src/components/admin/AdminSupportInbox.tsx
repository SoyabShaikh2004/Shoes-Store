'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Inbox,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  MessageSquare,
  Mail,
  Send,
  Loader2,
} from 'lucide-react';
import { getAdminAuthHeaders, handleAdminUnauthorized } from '@/lib/adminAuth';
import { formatDateTimeIN } from '@/lib/orderTypes';
import type { SupportMessageRecord } from '@/lib/db/schema';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

function ticketBadgeStyle(status: SupportMessageRecord['status']): string {
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function ticketStatusLabel(status: SupportMessageRecord['status']): string {
  if (status === 'resolved') return 'Resolved';
  if (status === 'in_progress') return 'In Progress';
  return 'Open';
}

export default function AdminSupportInbox({
  onTicketsUpdated,
}: {
  onTicketsUpdated?: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchMessages = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/contact', {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (handleAdminUnauthorized(res.status, data?.error)) return;
      if (res.ok && data?.success) {
        const list = (data.messages || []) as SupportMessageRecord[];
        setMessages(list);
        const initialDrafts: Record<string, string> = {};
        for (const item of list) {
          initialDrafts[item.id] = item.adminNote || '';
        }
        setNoteDrafts(initialDrafts);
        if (showToast) toast.success('Support inbox refreshed');
      }
    } catch {
      toast.error('Could not load support tickets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const handleUpdateTicket = async (
    id: string,
    nextStatus: SupportMessageRecord['status'],
    adminNote?: string
  ) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/contact', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id,
          status: nextStatus,
          adminNote: adminNote !== undefined ? adminNote : noteDrafts[id] || '',
        }),
      });
      const data = await res.json().catch(() => null);
      if (handleAdminUnauthorized(res.status, data?.error)) return;
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Could not update ticket');
        return;
      }
      setMessages((prev) => prev.map((m) => (m.id === id ? data.message : m)));
      toast.success(`Ticket updated to "${ticketStatusLabel(nextStatus)}"`);
      onTicketsUpdated?.();
    } catch {
      toast.error('Network error updating support ticket');
    } finally {
      setSavingId(null);
    }
  };

  const openCount = messages.filter((m) => m.status === 'open').length;
  const inProgressCount = messages.filter((m) => m.status === 'in_progress').length;
  const resolvedCount = messages.filter((m) => m.status === 'resolved').length;

  const filtered = messages.filter((m) => {
    if (filter !== 'all' && m.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.ticketNumber.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header & Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Customer Support Inbox
              </h2>
              <p className="text-xs text-slate-500">
                Persisted tickets from the Storefront Contact Us form stored in your local database
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchMessages(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Inbox</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Tickets</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {messages.length}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200">
            <div className="text-[11px] font-semibold text-rose-700 uppercase">Open</div>
            <div className="text-xl font-bold text-rose-800 tabular-nums mt-0.5">{openCount}</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
            <div className="text-[11px] font-semibold text-amber-700 uppercase">In Progress</div>
            <div className="text-xl font-bold text-amber-800 tabular-nums mt-0.5">
              {inProgressCount}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase">Resolved</div>
            <div className="text-xl font-bold text-emerald-800 tabular-nums mt-0.5">
              {resolvedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: `All (${messages.length})` },
              { id: 'open', label: `Open (${openCount})` },
              { id: 'in_progress', label: `In Progress (${inProgressCount})` },
              { id: 'resolved', label: `Resolved (${resolvedCount})` },
            ] as Array<{ id: StatusFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket ID, email, subject..."
            className="w-full min-h-[44px] pl-9 pr-3 py-2 text-base sm:text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading support tickets...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No support tickets found</p>
          <p className="text-xs text-slate-500">
            Messages sent through the storefront Contact Us form appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((ticket) => {
            const isSaving = savingId === ticket.id;
            return (
              <div
                key={ticket.id}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${ticketBadgeStyle(
                          ticket.status
                        )}`}
                      >
                        {ticketStatusLabel(ticket.status)}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {formatDateTimeIN(ticket.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {ticket.subject}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{ticket.name}</span>
                      <a
                        href={`mailto:${ticket.email}?subject=${encodeURIComponent(
                          `Re: [${ticket.ticketNumber}] ${ticket.subject}`
                        )}`}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:underline break-all"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{ticket.email}</span>
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isSaving || ticket.status === 'in_progress'}
                      onClick={() => void handleUpdateTicket(ticket.id, 'in_progress')}
                      className="flex-1 sm:flex-none min-h-[44px] px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Mark In Progress</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || ticket.status === 'resolved'}
                      onClick={() => void handleUpdateTicket(ticket.id, 'resolved')}
                      className="flex-1 sm:flex-none min-h-[44px] px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 whitespace-pre-line">
                  {ticket.message}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={noteDrafts[ticket.id] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                    }
                    placeholder="Add internal resolution note or response log..."
                    className="flex-1 min-h-[44px] px-3 py-2 text-base sm:text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleUpdateTicket(ticket.id, ticket.status)}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
                  </button>
                </div>

                {ticket.handledByAdminName && (
                  <p className="text-[11px] text-slate-500">
                    Last updated by <strong>{ticket.handledByAdminName}</strong> ·{' '}
                    {formatDateTimeIN(ticket.updatedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
