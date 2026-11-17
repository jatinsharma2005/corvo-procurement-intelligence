'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquareText,
  Layers,
  CheckCheck,
  BookOpen,
  FileText,
  Users,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Purchase Assistant', href: '/chat', icon: MessageSquareText, badge: 'AI Intake' },
  { name: 'Procurement Workspace', href: '/workspace', icon: Layers },
  { name: 'Approvals & Overrides', href: '/approvals', icon: CheckCheck },
  { name: 'Policy Studio', href: '/policies', icon: BookOpen },
  { name: 'Contract Register', href: '/contracts', icon: FileText },
  { name: 'Supplier Intelligence', href: '/suppliers', icon: Users },
  { name: 'Audit Trail', href: '/audit', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0a1020] text-slate-300 flex flex-col border-r border-slate-800/80 select-none shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/60 justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold tracking-wider shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            C
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
              CORVO
              <span className="text-[10px] font-medium tracking-normal px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                v5.0
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">Procurement Intelligence</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Core Platform
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full font-normal">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* System Status Footbar */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">Policy Engine Online</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">PUN1 / CHK1</span>
        </div>
        <div className="text-[11px] text-slate-400 leading-snug">
          Logged in as <span className="text-slate-200 font-medium">R. Sharma</span> (Buyer Lead)
        </div>
      </div>
    </aside>
  );
}
