'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitCommit,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

export default function AuditPage() {
  const [filterType, setFilterType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.getAuditLogs(100),
  });

  const logs = data?.logs || [];

  const filteredLogs = logs.filter((l: any) => {
    if (filterType && l.entity_type !== filterType) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        l.entity_id?.toLowerCase().includes(s) ||
        l.action?.toLowerCase().includes(s) ||
        l.actor?.name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Compliance & Audit Trail"
        subtitle="Immutable Log of Decision Approvals, Justified Overrides, Policy Activations & Batch Runs"
      />

      <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail by ID or actor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium focus:bg-white focus:outline-none"
            >
              <option value="">All Entities</option>
              <option value="DECISION">Decisions (Approvals & Overrides)</option>
              <option value="POLICY">Policy Updates</option>
              <option value="CONTRACT">Contract Registrations</option>
              <option value="PURCHASE_REQUEST">Purchase Requests</option>
            </select>

            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Audit Event History ({filteredLogs.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">Tamper-evident ISO 9001 / SOC 2 Ready</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity ID</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Event Details & Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No audit events recorded for current filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any, idx: number) => (
                    <tr key={log._id || idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('en-GB')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {log.entity_type}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            log.action === 'APPROVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'OVERRIDE'
                              ? 'bg-purple-100 text-purple-800'
                              : log.action === 'ACTIVATE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.entity_id}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-semibold block">{log.actor?.name || 'System'}</span>
                        <span className="text-[10px] text-slate-400">{log.actor?.role || 'SYSTEM'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-md">
                        {log.details?.reason ? (
                          <div className="bg-purple-50/70 border border-purple-200 rounded p-1.5 text-[11px] text-purple-900">
                            <strong>Reason:</strong> {log.details.reason}
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-slate-500">
                            {JSON.stringify(log.details)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
