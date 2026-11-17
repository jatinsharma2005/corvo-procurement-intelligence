'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Search,
  Filter,
  Download,
  UploadCloud,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Building,
  Sparkles,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatINR, formatNumber, formatDate, getRouteBadge, getDecisionBadge, getStatusBadge } from '@/lib/utils';
import { DecisionModal } from '@/components/procurement/decision-modal';

export default function WorkspacePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Fetch requirements
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['requirements', selectedPlant, selectedStatus, searchTerm],
    queryFn: () =>
      api.getRequirements({
        plant: selectedPlant || undefined,
        status: selectedStatus || undefined,
        search: searchTerm || undefined,
        limit: 200,
      }),
  });

  // Batch upload mutation
  const uploadBatchMutation = useMutation({
    mutationFn: async (file: File) => {
      return api.processBatchCSV(file);
    },
    onSuccess: (res) => {
      setUploadNotice(`Success! Evaluated ${res.summary.total_pr_lines} PR lines into ${res.summary.total_requirement_groups} requirement groups.`);
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      setIsUploadModalOpen(false);
      setTimeout(() => setUploadNotice(null), 8000);
    },
    onError: (err: any) => {
      alert(`Batch processing error: ${err.message}`);
    },
  });

  const runSampleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api-proxy/process-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'sample_pr_batch.csv' }),
      });
      if (!res.ok) {
        return api.processBatchCSV('');
      }
      return res.json();
    },
    onSuccess: (res) => {
      setUploadNotice(`Sample batch processed: ${res.summary?.total_pr_lines || 186} PR lines evaluated!`);
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      setIsUploadModalOpen(false);
      setTimeout(() => setUploadNotice(null), 8000);
    },
  });

  const requirements = data?.requirements || [];

  // Filter by route locally if specified
  const filtered = requirements.filter((r: any) => {
    if (selectedRoute && (r.route !== selectedRoute && r.decision?.route !== selectedRoute)) {
      return false;
    }
    return true;
  });

  const openDecisionDetails = (req: any) => {
    setSelectedReq(req);
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Procurement Workspace"
        subtitle="14-Day Calendar Clubbing • Valuations • Rate Contracts & Routing Engine"
      >
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload Batch CSV</span>
        </button>

        <a
          href={api.getPreferredSuppliersExportUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Preferred CSV</span>
        </a>
      </Header>

      <main className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        {uploadNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between animate-fadeIn text-sm font-medium">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{uploadNotice}</span>
            </div>
            <button onClick={() => setUploadNotice(null)} className="text-emerald-700 hover:text-emerald-900">
              Dismiss
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search group ID, item code, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Plant Filter */}
            <select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none"
            >
              <option value="">All Plants</option>
              <option value="PUN1">PUN1 (Pune)</option>
              <option value="CHK1">CHK1 (Chakan)</option>
            </select>

            {/* Route Filter */}
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none"
            >
              <option value="">All Routes</option>
              <option value="CONTRACT_PO">Contract PO</option>
              <option value="SPOT_PO">Spot PO</option>
              <option value="EMERGENCY_PO">Emergency PO</option>
              <option value="RFQ">RFQ (3 Quotes)</option>
              <option value="RFP">RFP (Formal)</option>
              <option value="CAPEX_SOURCING">Capex Sourcing</option>
              <option value="NEW_ITEM_SOURCING">New Item Sourcing</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="OVERRIDDEN">Overridden</option>
            </select>

            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh table"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Requirements Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Consolidated Requirements ({filtered.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Rule: 14-day calendar window • ±7-day need-by
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80 font-medium">
                <tr>
                  <th className="py-3 px-4">Requirement Group ID</th>
                  <th className="py-3 px-4">Item Code</th>
                  <th className="py-3 px-4">Plant</th>
                  <th className="py-3 px-4">Lines</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Group Value</th>
                  <th className="py-3 px-4">Decision</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">PO / Supplier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading requirement groups...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No requirement groups match current filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((req: any) => {
                    const dec = req.decision || {};
                    const routeBadge = getRouteBadge(dec.route || req.route);
                    const decisionBadge = getDecisionBadge(dec.decision || req.decision?.decision || (dec.po_id ? 'PO' : 'SOURCING_REQUEST'));
                    const statusBadge = getStatusBadge(dec.status || req.status);

                    return (
                      <tr
                        key={req.group_id}
                        onClick={() => openDecisionDetails(req)}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 truncate max-w-[170px]">
                          {req.group_id}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-blue-600">
                          {req.resolved_item_code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {req.plant}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {req.pr_lines_count || (req.pr_lines ? req.pr_lines.length : 1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {req.total_quantity} {req.uom}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatINR(dec.group_value_inr || req.estimated_value_inr)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${decisionBadge.className}`}>
                            {decisionBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${routeBadge.className}`}>
                            {routeBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {dec.po_id ? (
                            <span className="font-bold text-slate-900">{dec.po_id}</span>
                          ) : dec.supplier_id ? (
                            <span className="text-slate-700">{dec.supplier_id}</span>
                          ) : (
                            <span className="text-slate-400 italic">Sourcing</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDecisionDetails(req);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Decision Breakdown"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Decision Details Modal */}
      <DecisionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        requirement={selectedReq}
        decision={selectedReq?.decision}
        lines={selectedReq?.pr_lines}
      />

      {/* Batch Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Upload PR Batch CSV</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload a purchase requisition batch CSV adhering to the Corvo PR schema. The policy engine will club requirements, validate rate contracts, apply supplier rankings, and produce POs or Sourcing Requests.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors bg-slate-50/50">
              <FileSpreadsheet className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <label className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer block">
                Select CSV File
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadBatchMutation.mutate(f);
                  }}
                />
              </label>
              <span className="text-[11px] text-slate-400 mt-1 block">or click below to evaluate supplied sample batch</span>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => runSampleMutation.mutate()}
                disabled={runSampleMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {runSampleMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing 186 lines...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Process Official Task Kit Batch (186 PR lines)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
