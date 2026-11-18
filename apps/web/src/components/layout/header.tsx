'use client';

import React from 'react';
import { Download, Shield, Menu } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSidebar } from './sidebar-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  const { toggle } = useSidebar();

  return (
    <header className="min-h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 md:px-8 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-label="Open navigation menu"
          className="lg:hidden p-3 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="w-full sm:w-auto flex items-center gap-2 sm:gap-3 shrink sm:shrink-0 flex-wrap sm:flex-nowrap justify-end">
        {children}

        {/* Policy Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium whitespace-nowrap shrink-0">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>Policy v5.0 Active</span>
        </div>

        {/* Quick CSV Export */}
        <button
          type="button"
          onClick={async () => {
            try {
              await api.downloadDecisionsCsv();
            } catch (error) {
              window.alert(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
          className="inline-flex min-h-11 items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden xs:inline">Export CSV</span>
        </button>
      </div>
    </header>
  );
}
