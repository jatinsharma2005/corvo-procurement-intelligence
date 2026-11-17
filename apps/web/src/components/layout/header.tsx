'use client';

import React from 'react';
import Link from 'next/link';
import { Download, UploadCloud, Shield, Sparkles } from 'lucide-react';
import { api } from '@/lib/api-client';

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {children}

        {/* Policy Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>Policy v5.0 Active</span>
        </div>

        {/* Quick CSV Export */}
        <a
          href={api.getDecisionsExportUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </a>
      </div>
    </header>
  );
}
