'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Layers,
  ShoppingBag,
  Send,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowRight,
  Download,
  Shield,
  Factory,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
import { formatINR, formatNumber, formatDate, getRouteBadge, getStatusBadge } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.getDashboardSummary(),
  });

  const metrics = data?.metrics || {
    total_pr_lines: 0,
    total_requirements: 0,
    total_purchase_orders: 0,
    total_sourcing_requests: 0,
    total_procurement_value_inr: 0,
    pending_approvals: 0,
    active_policy_version: 'Unavailable',
  };

  const plantDist = data?.distributions?.plants || {};
  const routeDist = data?.distributions?.routes || {};

  const recentActivity = data?.recent_activity || [];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Executive Procurement Overview"
        subtitle="Policy-led decisions • Procurement telemetry and audit summary"
      >
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          title="Refresh telemetry"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </Header>

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Role-tailored Overview Banner */}
        {user?.role === 'ADMIN' ? (
          <div className="p-4 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-blue-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  ADMINISTRATOR PORTAL
                </span>
                <span className="text-xs text-slate-300">Logged in as {user.name}</span>
              </div>
              <div className="text-sm font-semibold">System Governance & Policy Management</div>
              <div className="text-xs text-slate-300">
                You have administrative authority to manage users, assign roles, control access status, and approve policy activations.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/users"
                className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold hover:bg-slate-100 transition-colors shadow-sm"
              >
                Manage Users &rarr;
              </Link>
              <Link
                href="/policies"
                className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
              >
                Policy Studio
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-slate-700">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  BUYER WORKSPACE
                </span>
                <span className="text-xs text-slate-300">Logged in as {user?.name || 'Buyer'}</span>
              </div>
              <div className="text-sm font-semibold">Procurement Intake & Decision Processing</div>
              <div className="text-xs text-slate-300">
                Intake purchase requisitions via conversational AI, upload PR batches, and review automated PO/SR routing.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/chat"
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-sm"
              >
                AI Intake Chat &rarr;
              </Link>
              <Link
                href="/workspace"
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-600 transition-colors"
              >
                PR Workspace
              </Link>
            </div>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Value */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Value Processed</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatINR(metrics.total_procurement_value_inr)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
              <span>Recorded procurement decisions</span>
            </div>
          </div>

          {/* PR Lines & Groups */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">PR Lines Clubbed</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatNumber(metrics.total_pr_lines)} <span className="text-sm font-normal text-slate-500">lines</span>
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <span>Clubbed into</span>
              <span className="font-semibold text-slate-700">{metrics.total_requirements} groups</span>
            </div>
          </div>

          {/* POs vs SRs */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Automated POs</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatNumber(metrics.total_purchase_orders)} <span className="text-sm font-normal text-slate-500">POs</span>
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <span className="font-semibold text-slate-700">{metrics.total_sourcing_requests} Sourcing Requests</span>
              <span>(RFQ / RFP)</span>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Action Items</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight flex items-baseline gap-2">
              <span>{metrics.pending_approvals}</span>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Requires Review
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              <Link href="/approvals" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                Open approvals workspace &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Launch & Batch Processing Hero */}
        <div className="bg-gradient-to-r from-[#0a1020] to-[#16223f] rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Corvo Policy-As-Data Architecture</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Deterministic Automated Procurement Pipeline
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Upload PR batches, process real-time employee requests, evaluate contract rate caps, and dynamically route orders according to Corvo Procurement Policy v5.0 with zero hardcoded logic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              <span>Upload PR batch</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
            >
              <Send className="w-4 h-4 text-blue-400" />
              <span>Raise Purchase Request</span>
            </Link>
          </div>
        </div>

        {/* Grid: Route Breakdown & Plant Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Procurement Route Breakdown */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Procurement Route Breakdown</h3>
                <p className="text-xs text-slate-500">Autonomous distribution of decisions generated by active policy</p>
              </div>
              <Link href="/workspace" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                View all &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.entries(routeDist).map(([route, count]) => {
                const badge = getRouteBadge(route);
                return (
                  <div key={route} className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                      {badge.label}
                    </div>
                    <div className="text-xl font-bold text-slate-900">{count}</div>
                    <div className="text-[11px] text-slate-400">
                      {route === 'CONTRACT_PO' && 'Rate contract ceiling applied'}
                      {route === 'SPOT_PO' && '< ₹2,00,000 threshold (365d history)'}
                      {route === 'EMERGENCY_PO' && 'Immediate expediting (≤ ₹5,00,000)'}
                      {route === 'RFQ' && '< ₹10,00,000 (3 quote solicitation)'}
                      {route === 'RFP' && '≥ ₹10,00,000 formal tender (5 quotes)'}
                      {route === 'CAPEX_SOURCING' && 'Asset capitalization (5 quotes)'}
                      {route === 'NEW_ITEM_SOURCING' && 'Catalog introduction'}
                      {route === 'NOT_PROCESSED' && 'Invalid / zero quantity'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plant Distribution & Policy Info */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-semibold text-slate-900">Plant Demarcation</h3>
              <p className="text-xs text-slate-500">Requirement consolidation isolated by operating plant</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    PUN1
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Pune Plant</div>
                    <div className="text-xs text-slate-500">Chakan Industrial Area</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">{plantDist.PUN1 || 0}</div>
                  <div className="text-[11px] text-slate-400">PR lines</div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    CHK1
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Chakan Assembly</div>
                    <div className="text-xs text-slate-500">Plant 2 Logistics Center</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">{plantDist.CHK1 || 0}</div>
                  <div className="text-[11px] text-slate-400">PR lines</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Active Policy:</span>
                <span className="font-semibold text-slate-800">{metrics.active_policy_version}</span>
              </div>
              <div className="flex justify-between">
                <span>Clubbing Window:</span>
                <span className="font-semibold text-slate-800">14 Days / ±7-Day Need-By</span>
              </div>
              <div className="flex justify-between">
                <span>PO Consolidation:</span>
                <span className="font-semibold text-slate-800">24-Hour Supplier Window</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Audit Activity Feed */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Compliance & Audit Activity</h3>
            </div>
            <Link href="/audit" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
              Audit logs &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((log: any, idx: number) => (
                <div key={log._id || idx} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-700">
                      {log.action}
                    </span>
                    <span className="font-medium text-slate-800">
                      {log.entity_type}: {log.entity_id}
                    </span>
                    <span className="text-slate-400">by {log.actor?.name || 'System'}</span>
                  </div>
                  <span className="text-slate-400">{formatDate(log.timestamp)}</span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Engine initialized. Evaluated against Corvo Procurement Policy v5.0.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
