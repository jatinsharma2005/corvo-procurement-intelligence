'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Shield,
  Clock,
  Building,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatINR, formatDate } from '@/lib/utils';

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const [extractedContract, setExtractedContract] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Fetch contracts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contracts-list'],
    queryFn: () => api.getContracts(),
  });

  const contracts = data?.contracts || [];

  // PDF Upload Mutation
  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      return api.uploadContractPDF(file);
    },
    onSuccess: (res) => {
      setExtractedContract(res.extracted_contract);
    },
    onError: (err: any) => {
      alert(`Contract extraction error: ${err.message}`);
    },
  });

  // Save Contract Mutation
  const saveContractMutation = useMutation({
    mutationFn: async (contract: any) => {
      return api.saveContract(contract);
    },
    onSuccess: (res) => {
      setSaveNotice(`Contract ${res.contract?.contract_id} successfully added to register!`);
      setExtractedContract(null);
      queryClient.invalidateQueries({ queryKey: ['contracts-list'] });
      setTimeout(() => setSaveNotice(null), 6000);
    },
    onError: (err: any) => {
      alert(`Error saving contract: ${err.message}`);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPdfMutation.mutate(file);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Rate Contracts & Ceiling Tracking"
        subtitle="10 Register Rate Contracts • 2 Discovered Signed PDFs • Real-Time Value Cap Monitoring"
      />

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {saveNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-fadeIn text-xs font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}

        {/* Section 1: Contracts Register Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Active Rate Contracts Register ({contracts.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Deterministic ceiling enforcement across batch runs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-4">Contract ID</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Validity Period</th>
                  <th className="py-3 px-4">Value Cap (INR)</th>
                  <th className="py-3 px-4">Consumed (INR)</th>
                  <th className="py-3 px-4 w-48">Ceiling Consumption</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Items Covered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map((c: any) => {
                  const cap = c.value_cap || 1;
                  const consumed = c.consumed_value || 0;
                  const pct = Math.min(100, Math.round((consumed / cap) * 100));

                  let barColor = 'bg-emerald-500';
                  if (pct >= 90) barColor = 'bg-rose-500';
                  else if (pct >= 70) barColor = 'bg-amber-500';

                  return (
                    <tr key={c.contract_id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {c.contract_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {c.supplier_name || c.supplier_id}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {c.supplier_id}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(c.start_date)} — {formatDate(c.end_date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatINR(c.value_cap)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {formatINR(consumed)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                            <span>{pct}%</span>
                            <span>Remaining: {formatINR(Math.max(0, cap - consumed))}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {c.lines?.length || 0} catalog items
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Signed Contract PDF Discovery & Extraction */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Signed Contract PDF Discovery & Extraction Engine
              </h3>
            </div>
            <span className="text-xs text-slate-500">Automatic PDF Text & Table Parser</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            Corvo scans supplied contract PDFs to discover signed agreements not yet formally registered in ERP. It extracts supplier identifiers, validity horizons, financial value caps, and agreed line unit prices.
          </p>

          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:border-blue-400 transition-colors max-w-xl">
            <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <label className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer block">
              Upload Signed Contract PDF
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <span className="text-[11px] text-slate-400 mt-1 block">
              e.g. RC-2026-031 (Pneumatic Point) or RC-2026-033 (Infoline Systems)
            </span>
          </div>

          {/* Extracted Contract Preview Card */}
          {extractedContract && (
            <div className="p-5 rounded-2xl bg-blue-50/60 border-2 border-blue-200 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-blue-900">
                    Extracted Contract: {extractedContract.contract_id}
                  </h4>
                </div>
                <button
                  onClick={() => saveContractMutation.mutate(extractedContract)}
                  disabled={saveContractMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Save into Register</span>
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Supplier</span>
                  <span className="font-bold text-slate-900">{extractedContract.supplier_name} ({extractedContract.supplier_id})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Validity</span>
                  <span className="font-semibold text-slate-800">{formatDate(extractedContract.start_date)} to {formatDate(extractedContract.end_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Financial Cap</span>
                  <span className="font-bold text-blue-700">{formatINR(extractedContract.value_cap)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Lines Covered</span>
                  <span className="font-semibold text-slate-800">{extractedContract.lines?.length || 0} items</span>
                </div>
              </div>

              {/* Lines Table */}
              <div className="border border-blue-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-50 text-blue-900 font-semibold border-b border-blue-100">
                    <tr>
                      <th className="py-2 px-3">Item Code</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3">Agreed Unit Price (INR)</th>
                      <th className="py-2 px-3">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {(extractedContract.lines || []).map((l: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">{l.item_code}</td>
                        <td className="py-2 px-3 text-slate-700">{l.item_description || '—'}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{formatINR(l.rate)}</td>
                        <td className="py-2 px-3 text-slate-600">{l.uom || 'EA'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
