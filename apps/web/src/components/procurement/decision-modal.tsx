'use client';

import React from 'react';
import {
  X,
  Shield,
  Layers,
  ShoppingBag,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  DollarSign,
  FileText,
} from 'lucide-react';
import { formatINR, formatDate, getRouteBadge, getDecisionBadge, getStatusBadge } from '@/lib/utils';

interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirement: any;
  decision: any;
  lines?: any[];
}

export function DecisionModal({
  isOpen,
  onClose,
  requirement,
  decision,
  lines = [],
}: DecisionModalProps) {
  if (!isOpen || !requirement) return null;

  const routeBadge = getRouteBadge(decision?.route || requirement.route);
  const decisionBadge = getDecisionBadge(decision?.decision || requirement.decision?.decision);
  const statusBadge = getStatusBadge(decision?.status || requirement.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {requirement.group_id}
                </h2>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${decisionBadge.className}`}>
                  {decisionBadge.label}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${routeBadge.className}`}>
                  {routeBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Plant: <span className="font-semibold text-slate-700">{requirement.plant}</span> • Item:{' '}
                <span className="font-semibold text-slate-700">{requirement.resolved_item_code}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Policy Evaluation Clause & Reason */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Policy Engine Explanation (Corvo Policy {decision?.policy_version || 'v5.0'})</span>
              </div>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                Deterministic AST
              </span>
            </div>
            <p className="text-slate-800 font-medium leading-relaxed">
              {decision?.reason || requirement.decision?.reason || 'Evaluation complete according to policy thresholds.'}
            </p>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Total Quantity</span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {requirement.total_quantity} {requirement.uom}
              </div>
              <span className="text-[10px] text-slate-400">Clubbed across lines</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Unit Price</span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {decision?.unit_price ? formatINR(decision.unit_price) : 'Via RFQ/RFP'}
              </div>
              <span className="text-[10px] text-slate-400">
                {decision?.decision === 'PO' ? 'Contract / Catalog Rate' : 'To be bid'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Group Value (INR)</span>
              <div className="text-base font-bold text-blue-600 mt-1">
                {formatINR(decision?.group_value_inr || requirement.estimated_value_inr)}
              </div>
              <span className="text-[10px] text-slate-400">Threshold valuation</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-semibold text-slate-500">PO Reference</span>
              <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                {decision?.po_id || '—'}
              </div>
              <span className="text-[10px] text-slate-400">
                {decision?.po_id ? 'Consolidated PO' : 'Sourcing Request'}
              </span>
            </div>
          </div>

          {/* Supplier Award & Ranking Details */}
          {decision?.supplier_id && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Assigned Supplier: {decision.supplier_name || decision.supplier_id}</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {decision.supplier_id}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ranked #1 using Corvo 5-factor scoring (PO Frequency 25%, Recency 25%, Contract 15%, On-Time 20%, Quality 15%).
              </p>
            </div>
          )}

          {/* Suggested Sourcing Suppliers */}
          {decision?.suggested_supplier_ids && decision.suggested_supplier_ids.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                <span>Suggested Sourcing Suppliers (RFQ / RFP Candidates)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {decision.suggested_supplier_ids.map((sId: string, idx: number) => (
                  <span
                    key={sId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-medium border border-slate-200"
                  >
                    <span className="text-[10px] text-blue-600 font-bold">#{idx + 1}</span>
                    <span>{sId}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Constituent PR Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Constituent Purchase Request Lines ({lines.length || requirement.pr_lines?.length || 1})</span>
              </h4>
              <span className="text-[11px] text-slate-400">14-Day Calendar Window</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="py-2 px-3">PR Number</th>
                    <th className="py-2 px-3">Line</th>
                    <th className="py-2 px-3">Need-By Date</th>
                    <th className="py-2 px-3">Quantity</th>
                    <th className="py-2 px-3">Requester</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(lines.length > 0 ? lines : requirement.pr_lines || []).map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">
                        {line.pr_no || `PR-2026-00${idx + 1}`}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{line.pr_line || 1}</td>
                      <td className="py-2 px-3 text-slate-600">{formatDate(line.need_by_date)}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {line.quantity} {line.uom || requirement.uom}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{line.requester || 'Engineering'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
