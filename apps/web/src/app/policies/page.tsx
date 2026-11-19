'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  FileCode2,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  GitCompare,
  Check,
  Calendar,
  FileText,
  Clock,
  History,
  Trash2,
  XCircle,
  Info,
  CheckCircle,
  Tag,
  FileCheck,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';

function formatCondition(cond: any): string {
  if (!cond) return 'Always applies';
  if (cond.all && Array.isArray(cond.all)) {
    return cond.all.map(formatCondition).join(' AND ');
  }
  if (cond.any && Array.isArray(cond.any)) {
    return `(${cond.any.map(formatCondition).join(' OR ')})`;
  }
  if (cond.field) {
    const fieldShort = cond.field.replace(/^(requirement|item|contract|history)\./, '');
    let opSymbol = cond.operator;
    if (cond.operator === 'eq') opSymbol = '==';
    else if (cond.operator === 'neq') opSymbol = '!=';
    else if (cond.operator === 'lt') opSymbol = '<';
    else if (cond.operator === 'lte') opSymbol = '<=';
    else if (cond.operator === 'gt') opSymbol = '>';
    else if (cond.operator === 'gte') opSymbol = '>=';

    let val = cond.value;
    if (typeof val === 'number' && val >= 1000) {
      val = `₹${val.toLocaleString('en-IN')}`;
    } else if (typeof val === 'string') {
      val = `'${val}'`;
    }
    return `${fieldShort} ${opSymbol} ${val}`;
  }
  return JSON.stringify(cond);
}

export default function PolicyStudioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amendmentText, setAmendmentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposalResult, setProposalResult] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  // Fetch policies
  const { data: policiesData, refetch } = useQuery({
    queryKey: ['policies-all'],
    queryFn: () => api.getPolicies(),
  });

  const { data: activePolicyData } = useQuery({
    queryKey: ['policy-active'],
    queryFn: () => api.getActivePolicy(),
  });

  const activePolicy = activePolicyData?.policy;
  const policiesList = policiesData?.policies || [];

  // Propose Amendment Mutation (Text)
  const draftMutation = useMutation({
    mutationFn: async (text: string) => {
      return api.submitPolicyDraft(text);
    },
    onSuccess: (res) => {
      setProposalResult(res);
      queryClient.invalidateQueries({ queryKey: ['policies-all'] });
    },
    onError: (err: any) => {
      alert(`Error proposing amendment: ${err.message}`);
    },
  });

  // Propose Amendment Mutation (File PDF)
  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      return api.uploadPolicyAmendment(file);
    },
    onSuccess: (res) => {
      setProposalResult(res);
      queryClient.invalidateQueries({ queryKey: ['policies-all'] });
    },
    onError: (err: any) => {
      alert(`PDF parsing error: ${err.message}`);
    },
  });

  // Approve Policy Mutation
  const approveMutation = useMutation({
    mutationFn: async (version: string) => {
      return api.approvePolicy(version);
    },
    onSuccess: (res) => {
      setActivationNotice(`Policy ${res.policy.version} successfully approved & activated into runtime!`);
      setProposalResult(null);
      setAmendmentText('');
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['policy-active'] });
      queryClient.invalidateQueries({ queryKey: ['policies-all'] });
      setTimeout(() => setActivationNotice(null), 8000);
    },
    onError: (err: any) => {
      alert(`Activation error: ${err.message}`);
    },
  });

  // Reject Draft Policy Mutation
  const rejectMutation = useMutation({
    mutationFn: async (version: string) => {
      return api.rejectPolicyDraft(version);
    },
    onSuccess: (res, version) => {
      setActivationNotice(`Draft policy ${version} was successfully discarded.`);
      setProposalResult(null);
      setSelectedFile(null);
      setAmendmentText('');
      queryClient.invalidateQueries({ queryKey: ['policies-all'] });
      setTimeout(() => setActivationNotice(null), 6000);
    },
    onError: (err: any) => {
      alert(`Reject draft error: ${err.message}`);
    },
  });

  const handleProposeText = () => {
    if (!amendmentText.trim()) return;
    draftMutation.mutate(amendmentText.trim());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadPdfMutation.mutate(file);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Policy Management Studio"
        subtitle="Policy-as-Data Architecture • Deterministic AST Rules • Zero-Code Behavioral Modification"
      />

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {activationNotice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 animate-fadeIn text-xs font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{activationNotice}</span>
          </div>
        )}

        {/* Hero Section: Active Policy Info */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
                  CURRENT RUNTIME ACTIVE
                </span>
                <span className="text-xs text-slate-400">Effective from {formatDate(activePolicy?.effective_date || '2026-11-01')}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                {activePolicy?.title || 'Corvo Procurement Policy v5.0'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Version: <span className="font-mono font-semibold text-slate-700">{activePolicy?.version || 'v5.0'}</span> • Status: <span className="font-semibold text-emerald-700">{activePolicy?.status || 'ACTIVE'}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">
                {activePolicy?.rules?.length || 9} Deterministic Rules Active
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {activePolicy?.description ||
              'Official procurement governance policy governing item valuations, 14-day calendar clubbing windows, rate contract thresholds, and preferred supplier algorithms.'}
          </p>

          {/* Rules Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Rule ID</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Condition Logic</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activePolicy?.rules || []).map((rule: any) => (
                  <tr key={rule.rule_id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {rule.rule_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {rule.description}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 max-w-xs truncate" title={formatCondition(rule.conditions)}>
                      {formatCondition(rule.conditions)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {rule.outcome?.decision}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700">
                        {rule.outcome?.route}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {rule.priority}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Amendment Upload & Natural Language Text Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Method A: Text Amendment Input */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Amend Policy Via Natural Language</span>
            </div>
            <p className="text-xs text-slate-500">
              Type the policy amendment instructions. The AI policy adapter will convert your text into pure deterministic AST rules with zero source code changes.
            </p>

            <textarea
              rows={4}
              value={amendmentText}
              onChange={(e) => setAmendmentText(e.target.value)}
              placeholder="e.g. Increase spot purchase threshold from ₹50,000 to ₹1,00,000 for Pune plant with immediate effect."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />

            <button
              onClick={handleProposeText}
              disabled={!amendmentText.trim() || draftMutation.isPending}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {draftMutation.isPending ? (
                <span>Generating AST Proposal...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Propose Amendment & Preview Diff</span>
                </>
              )}
            </button>
          </div>

          {/* Method B: Upload PDF Document */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              <span>Upload Amended Policy Document (PDF)</span>
            </div>
            <p className="text-xs text-slate-500">
              Upload a signed policy PDF amendment or Corvo Procurement Policy circular. The engine will extract the text, analyze modifications, and generate an actionable diff.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
              <FileText className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <label className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer block">
                {selectedFile ? selectedFile.name : 'Select Policy PDF File'}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <span className="text-[11px] text-slate-400 mt-1 block">Supports signed amendment PDFs</span>
            </div>

            {uploadPdfMutation.isPending && (
              <div className="text-center text-xs text-indigo-600 font-medium">
                Parsing PDF & extracting clauses...
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Side-by-Side Diff & Activation Proposal */}
        {proposalResult && (
          <div className="bg-white rounded-2xl border-2 border-blue-400 p-6 shadow-lg space-y-6 animate-fadeIn">
            {/* Header & Actions */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Policy Amendment Proposal: Version {proposalResult.draft_policy?.version}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                      {proposalResult.draft_policy?.status || 'DRAFT'}
                    </span>
                    {proposalResult.validation?.isValid !== false ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Validation Passed
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Validation Failed
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>
                      Document: <span className="font-mono font-semibold text-slate-700">{proposalResult.proposal?.document_reference || proposalResult.draft_policy?.document_number || 'CORVO-PROC-POL-04'}</span>
                    </span>
                    <span>
                      Effective: <span className="font-semibold text-slate-700">{formatDate(proposalResult.draft_policy?.effective_date)}</span>
                    </span>
                    {proposalResult.proposal?.approved_by && (
                      <span>
                        Approved by: <span className="font-semibold text-slate-700">{proposalResult.proposal.approved_by}</span>
                        {proposalResult.proposal.approval_date && ` (${formatDate(proposalResult.proposal.approval_date)})`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                {user?.role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => rejectMutation.mutate(proposalResult.draft_policy?.version)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      className="px-4 py-2.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Discard this draft policy amendment"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>{rejectMutation.isPending ? 'Discarding...' : 'Reject Draft'}</span>
                    </button>

                    <button
                      onClick={() => approveMutation.mutate(proposalResult.draft_policy?.version)}
                      disabled={approveMutation.isPending || rejectMutation.isPending || proposalResult.validation?.isValid === false}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>{approveMutation.isPending ? 'Activating...' : `Approve & Activate v${proposalResult.draft_policy?.version}`}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Executive Summary Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Info className="w-4 h-4 text-blue-600" />
                <span>Executive Amendment Summary</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {proposalResult.draft_policy?.amendment_summary || proposalResult.proposal?.amendment_summary || 'Policy rules update.'}
              </p>
            </div>

            {/* Clause-by-Clause Breakdown (A1, A2, A3) */}
            {proposalResult.proposal?.clauses && proposalResult.proposal.clauses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>Amended Policy Clauses ({proposalResult.proposal.clauses.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {proposalResult.proposal.clauses.map((clause: any) => (
                    <div
                      key={clause.id}
                      className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] font-mono">
                            {clause.id}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-indigo-800">
                            {clause.clause_reference}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{clause.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-normal">{clause.description}</p>
                      </div>
                      {clause.reason && (
                        <div className="pt-2 border-t border-indigo-100/80 text-[10px] text-indigo-900/80 italic">
                          Reason: {clause.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Side-by-Side Diff Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Active Rules */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Current Active Baseline ({activePolicy?.version || 'v5.0'})
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {activePolicy?.rules?.length || 0} Rules
                  </span>
                </div>

                <div className="space-y-2 text-xs max-h-[600px] overflow-y-auto pr-1">
                  {(activePolicy?.rules || []).map((r: any) => (
                    <div key={r.rule_id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {r.clause} • {r.rule_id}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px]">
                          Priority {r.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium">{r.description}</p>
                      <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 truncate" title={formatCondition(r.conditions)}>
                        {formatCondition(r.conditions)}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="text-slate-500">Route: <span className="font-mono font-semibold text-slate-700">{r.outcome?.route}</span></span>
                        <span className="text-slate-500">Decision: <span className="font-semibold text-slate-700">{r.outcome?.decision}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposed New Rules */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Proposed Draft Rules ({proposalResult.draft_policy?.version})
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold">
                    {proposalResult.draft_policy?.rules?.length || 0} Rules
                  </span>
                </div>

                <div className="space-y-2 text-xs max-h-[600px] overflow-y-auto pr-1">
                  {(proposalResult.draft_policy?.rules || []).map((r: any) => {
                    const baselineRule = (activePolicy?.rules || []).find((b: any) => b.rule_id === r.rule_id);
                    const isNew = !baselineRule;
                    const isModified =
                      baselineRule &&
                      (baselineRule.description !== r.description ||
                        JSON.stringify(baselineRule.conditions) !== JSON.stringify(r.conditions) ||
                        JSON.stringify(baselineRule.outcome) !== JSON.stringify(r.outcome));

                    return (
                      <div
                        key={r.rule_id}
                        className={`p-3 rounded-xl space-y-1.5 shadow-xs border transition-all ${
                          isNew
                            ? 'bg-emerald-50/80 border-emerald-300'
                            : isModified
                            ? 'bg-amber-50/80 border-amber-300'
                            : 'bg-white border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-[11px]">
                              {r.clause} • {r.rule_id}
                            </span>
                            {isNew && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px]">
                                + NEW RULE
                              </span>
                            )}
                            {isModified && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white font-bold text-[9px]">
                                MODIFIED
                              </span>
                            )}
                            {!isNew && !isModified && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px]">
                                UNCHANGED
                              </span>
                            )}
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-white/80 text-slate-700 font-mono text-[9px] border border-slate-200">
                            Priority {r.priority}
                          </span>
                        </div>
                        <p className={`text-[11px] font-medium ${isNew ? 'text-emerald-950' : isModified ? 'text-amber-950' : 'text-slate-800'}`}>
                          {r.description}
                        </p>
                        <div className="text-[10px] font-mono text-blue-700 bg-white/90 p-1.5 rounded border border-blue-100 truncate" title={formatCondition(r.conditions)}>
                          {formatCondition(r.conditions)}
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          <span className="text-slate-600">Route: <span className="font-mono font-bold text-slate-900">{r.outcome?.route}</span></span>
                          <span className="text-slate-600">Decision: <span className="font-bold text-slate-900">{r.outcome?.decision}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Version History */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Policy Version History</h3>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {policiesList.map((p: any) => (
              <div key={p.version} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800">{p.version}</span>
                  <span className="text-slate-600 font-medium">{p.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-slate-400">
                  Effective: {formatDate(p.effective_date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
