'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Award,
  Search,
  Filter,
  Download,
  Star,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { api } from '@/lib/api-client';
import { formatINR, formatNumber } from '@/lib/utils';

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedItemCode, setSelectedItemCode] = useState('ITM-1011');
  const [asOfDate, setAsOfDate] = useState('2026-11-01');

  // Fetch all suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', searchTerm, categoryFilter],
    queryFn: () =>
      api.getSuppliers({
        search: searchTerm || undefined,
        category: categoryFilter || undefined,
      }),
  });

  // Fetch dynamic rankings for selected item code
  const { data: rankingsData, isFetching: isRankingsFetching } = useQuery({
    queryKey: ['supplier-rankings', selectedItemCode, asOfDate],
    queryFn: () => api.getSupplierRankings(selectedItemCode, asOfDate),
  });

  const suppliers = suppliersData?.suppliers || [];
  const rankings = rankingsData?.rankings || [];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Header
        title="Supplier Intelligence & Preferred Rankings"
        subtitle="48 Vetted Suppliers • 5-Factor Weighted Performance Matrix • Reference Pricing"
      >
        <a
          href={api.getPreferredSuppliersExportUrl(asOfDate)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Preferred CSV</span>
        </a>
      </Header>

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Top Interactive Tool: Preferred Supplier Ranking Engine */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Preferred Supplier Ranking Calculator
                </h3>
                <p className="text-xs text-slate-500">
                  Weights: PO Freq (25%) • Recency (25%) • Contract (15%) • On-Time (20%) • Quality (15%)
                </p>
              </div>
            </div>

            {/* Item & As-of Date Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                  Catalog Item Code
                </label>
                <select
                  value={selectedItemCode}
                  onChange={(e) => setSelectedItemCode(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-blue-600 focus:bg-white focus:outline-none"
                >
                  <option value="ITM-1011">ITM-1011 — Deep Groove Bearing 6308</option>
                  <option value="ITM-1014">ITM-1014 — Tapered Roller Bearing 32210</option>
                  <option value="ITM-1025">ITM-1025 — Helical Gearbox 50:1</option>
                  <option value="ITM-1036">ITM-1036 — Solenoid Valve 24V DC</option>
                  <option value="ITM-1056">ITM-1056 — PLC Controller Unit 32-IO</option>
                  <option value="ITM-1065">ITM-1065 — Safety Goggles Clear Anti-fog</option>
                  <option value="ITM-1068">ITM-1068 — Nitrile Chemical Gloves XL</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                  Evaluation As-Of Date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ranking Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {rankings.map((rankItem: any) => (
              <div
                key={rankItem.supplier_id}
                className={`p-5 rounded-xl border relative transition-all ${
                  rankItem.rank === 1
                    ? 'border-amber-300 bg-amber-50/30 shadow-md ring-1 ring-amber-200'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        rankItem.rank === 1
                          ? 'bg-amber-500 text-white'
                          : rankItem.rank === 2
                          ? 'bg-slate-400 text-white'
                          : 'bg-amber-700/60 text-white'
                      }`}
                    >
                      #{rankItem.rank}
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {rankItem.supplier_id}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                    Score: {rankItem.total_score} / 100
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-800 truncate mb-1">
                  {rankItem.name}
                </div>

                <div className="text-xs text-slate-500 mb-4 flex items-baseline justify-between border-b border-slate-100 pb-3">
                  <span>Reference Price:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatINR(rankItem.reference_price)}
                  </span>
                </div>

                {/* Score Breakdown Bars */}
                <div className="space-y-2 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>PO Frequency (max 25):</span>
                    <span className="font-semibold text-slate-800">{rankItem.scores?.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recency (max 25):</span>
                    <span className="font-semibold text-slate-800">{rankItem.scores?.recency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contract History (15):</span>
                    <span className="font-semibold text-slate-800">{rankItem.scores?.contract}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>On-Time Delivery (20):</span>
                    <span className="font-semibold text-slate-800">{rankItem.scores?.on_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality Rating (15):</span>
                    <span className="font-semibold text-slate-800">{rankItem.scores?.quality}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-mono truncate">
                  Source: {rankItem.source}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Master Supplier Directory Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Supplier Directory ({suppliers.length} Active Suppliers)
              </h3>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter suppliers by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
                <tr>
                  <th className="py-3 px-4">Supplier ID</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Categories</th>
                  <th className="py-3 px-4">On-Time %</th>
                  <th className="py-3 px-4">Quality Score</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.slice(0, 30).map((s: any) => (
                  <tr key={s.supplier_id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {s.supplier_id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{s.city}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {(s.categories || []).join(', ')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {s.on_time_pct}%
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{s.quality_rating} / 5.0</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
