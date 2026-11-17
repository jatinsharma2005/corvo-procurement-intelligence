'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  FileEdit,
  ArrowRight,
  Shield,
  Layers,
  Award,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatINR, formatDate, getRouteBadge, getDecisionBadge, getStatusBadge } from '@/lib/utils';

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [selectedDecision, setSelectedDecision] = useState<any | null>(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    new_decision: 'PO' as 'PO' | 'SOURCING_REQUEST',
    new_route: 'SPOT_PO',
    new_supplier_id: '',
    reason: '',
  });
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Fetch decisions
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['approvals-decisions'],
    queryFn: () => api.getDecisions({ limit: 150 }),
  });

  const decisions = data?.decisions || [];

  // Filter pending vs approved/overridden
  const pendingDecisions = decisions.filter(
    (d: any) => d.status === 'PENDING_APPROVAL' || d.requires_approval
  );
  const historyDecisions = decisions.filter(
    (d: any) => d.status === 'APPROVED' || d.status === 'OVERRIDDEN'
  );

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return api.approveDecision(groupId);
    },
    onSuccess: (res) => {
      setFeedbackNotice(`Decision for ${res.decision?.group_id} approved successfully! PO / Sourcing Request registered.`);
      queryClient.invalidateQueries({ queryKey: ['approvals-decisions'] });
      setTimeout(() => setFeedbackNotice(null), 6000);
    },
    onError: (err: any) => {
      alert(`Approval error: ${err.message}`);
    },
  });

  // Override mutation
  const overrideMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDecision) return;
      if (!overrideForm.reason.trim()) {
        throw new Error('A detailed written justification is mandatory for compliance override.');
      }
      return api.overrideDecision(selectedDecision.group_id, overrideForm);
    },
    onSuccess: (res) => {
      setFeedbackNotice(`Decision for ${res?.decision?.group_id} overridden. Written justification logged in compliance audit trail.`);
      setIsOverrideOpen(false);
      setSelectedDecision(null);
      setOverrideForm({
        new_decision: 'PO',
        new_route: 'SPOT_PO',
        new_supplier_id: '',
        reason: '',
      });
      queryClient.invalidateQueries({ queryKey: ['approvals-decisions'] });
      setTimeout(() => setFeedbackNotice(null), 6000);
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  const handleOpenOverride = (decision: any) => {
    setSelectedDecision(decision);
    setOverrideForm({
      new_decision: decision.decision === 'PO' ? 'SOURCING_REQUEST' : 'PO',
      new_route: decision.route === 'CONTRACT_PO' ? 'SPOT_PO' : 'CONTRACT_PO',
      new_supplier_id: decision.supplier_id || '',
      reason: '',
    });
    setIsOverrideOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Buyer Approvals & Governance"
        subtitle="Review High-Value Requisitions • Execute Approvals • Mandatory Justified Overrides"
      />

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {feedbackNotice && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3 animate-fadeIn text-xs font-medium">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
        )}

        {/* Section 1: Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Action Required: Pending Buyer Review ({pendingDecisions.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Triggered by high valuation (&gt; ₹5,00,000) or emergency exception
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-4">Group ID</th>
                  <th className="py-3 px-4">Item Code</th>
                  <th className="py-3 px-4">Plant</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">Automated Recommendation</th>
                  <th className="py-3 px-4">Engine Reason</th>
                  <th className="py-3 px-4 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingDecisions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No pending decisions require buyer sign-off at this time.
                    </td>
                  </tr>
                ) : (
                  pendingDecisions.map((d: any) => {
                    const routeBadge = getRouteBadge(d.route);
                    const decisionBadge = getDecisionBadge(d.decision);
                    return (
                      <tr key={d.group_id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {d.group_id}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-blue-600">
                          {d.resolved_item_code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {d.plant}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatINR(d.group_value_inr)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${decisionBadge.className}`}>
                              {decisionBadge.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${routeBadge.className}`}>
                              {routeBadge.label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={d.reason}>
                          {d.reason}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => approveMutation.mutate(d.group_id)}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleOpenOverride(d)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
                          >
                            <FileEdit className="w-3.5 h-3.5 text-slate-500" />
                            <span>Override</span>
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

        {/* Section 2: Governance History (Approved & Overridden) */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Governance History & Overridden Decisions ({historyDecisions.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">Immutable Audit Trail</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-4">Group ID</th>
                  <th className="py-3 px-4">Item Code</th>
                  <th className="py-3 px-4">Plant</th>
                  <th className="py-3 px-4">Final Route</th>
                  <th className="py-3 px-4">Final Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Buyer Justification / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyDecisions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No decisions recorded in governance history yet.
                    </td>
                  </tr>
                ) : (
                  historyDecisions.slice(0, 30).map((d: any) => {
                    const statusBadge = getStatusBadge(d.status);
                    const routeBadge = getRouteBadge(d.route);
                    const hasOverride = d.override_details || d.status === 'OVERRIDDEN';

                    return (
                      <tr key={d.group_id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {d.group_id}
                        </td>
                        <td className="py-3 px-4 font-mono text-blue-600">
                          {d.resolved_item_code}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{d.plant}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${routeBadge.className}`}>
                            {routeBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatINR(d.group_value_inr)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-sm">
                          {hasOverride ? (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-[11px] text-purple-900">
                              <span className="font-semibold block">
                                Override by {d.override_details?.overridden_by || 'Buyer'}:
                              </span>
                              <span>&quot;{d.override_details?.reason || 'Management discretion'}&quot;</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              Approved as recommended by {d.approved_by || 'System'} on {formatDate(d.approved_at || d.updatedAt)}
                            </span>
                          )}
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

      {/* Mandatory Override Dialog */}
      {isOverrideOpen && selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Buyer Governance Override: {selectedDecision.group_id}
                </h3>
              </div>
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              <strong>Mandatory Compliance Notice:</strong> Overriding an automated policy decision requires a detailed, auditable written justification. All overrides are permanently recorded in the immutable audit trail.
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 font-semibold block mb-1">New Decision</label>
                  <select
                    value={overrideForm.new_decision}
                    onChange={(e) => setOverrideForm({ ...overrideForm, new_decision: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    <option value="PO">Issue Direct PO</option>
                    <option value="SOURCING_REQUEST">Route to Sourcing Request</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold block mb-1">New Route</label>
                  <select
                    value={overrideForm.new_route}
                    onChange={(e) => setOverrideForm({ ...overrideForm, new_route: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-medium"
                  >
                    <option value="CONTRACT_PO">CONTRACT_PO (Rate Contract)</option>
                    <option value="SPOT_PO">SPOT_PO (Single Quote)</option>
                    <option value="EMERGENCY_PO">EMERGENCY_PO (Expedited)</option>
                    <option value="RFQ">RFQ (3 Quotes)</option>
                    <option value="RFP">RFP (Formal Tender)</option>
                    <option value="CAPEX_SOURCING">CAPEX_SOURCING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-500 font-semibold block mb-1">
                  Supplier ID (Optional Override)
                </label>
                <input
                  type="text"
                  placeholder="e.g. S001 (Leave empty to keep default)"
                  value={overrideForm.new_supplier_id}
                  onChange={(e) => setOverrideForm({ ...overrideForm, new_supplier_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-900 font-bold block mb-1">
                  Written Justification / Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="State the exact procurement rationale (e.g. Critical machine breakdown at PUN1 requiring immediate spot procurement under plant head authorization)..."
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsOverrideOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => overrideMutation.mutate()}
                disabled={!overrideForm.reason.trim() || overrideMutation.isPending}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Confirm & Log Override</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
