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
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

export default function PolicyStudioPage() {
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
      queryClient.invalidateQueries({ queryKey: ['policy-active'] });
      queryClient.invalidateQueries({ queryKey: ['policies-all'] });
      setTimeout(() => setActivationNotice(null), 8000);
    },
    onError: (err: any) => {
      alert(`Activation error: ${err.message}`);
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
                    <td className="py-2.5 px-3 font-mono text-[11px] text-blue-600 max-w-xs truncate" title={JSON.stringify(rule.condition)}>
                      {JSON.stringify(rule.condition)}
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
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Policy Amendment Proposal: Version {proposalResult.draft_policy?.version}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Summary: {proposalResult.proposal?.amendment_summary || 'Policy rules update'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => approveMutation.mutate(proposalResult.draft_policy?.version)}
                disabled={approveMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Approve & Activate v{proposalResult.draft_policy?.version}</span>
              </button>
            </div>

            {/* Diff Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Active Rules */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Current Active ({activePolicy?.version})
                  </span>
                  <span className="text-[10px] text-slate-400">Baseline</span>
                </div>

                <div className="space-y-2 text-xs">
                  {(activePolicy?.rules || []).slice(0, 4).map((r: any) => (
                    <div key={r.rule_id} className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="font-semibold text-slate-800">{r.rule_id}: {r.description}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Route: {r.outcome?.route} • Thresholds
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposed New Rules */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Proposed Draft ({proposalResult.draft_policy?.version})
                  </span>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Ready for Activation
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {(proposalResult.draft_policy?.rules || []).slice(0, 4).map((r: any) => (
                    <div key={r.rule_id} className="p-2.5 rounded-lg bg-white border border-blue-200 space-y-1">
                      <div className="font-semibold text-blue-900">{r.rule_id}: {r.description}</div>
                      <div className="text-[11px] text-blue-600 font-mono">
                        Route: {r.outcome?.route} • Dynamic Evaluator
                      </div>
                    </div>
                  ))}
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
