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
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';
import { useAuth } from '@/components/auth-provider';

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

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const items = user?.role === 'ADMIN'
    ? [...navItems, { name: 'User Management', href: '/users', icon: Users }]
    : navItems;

  return (
    <>
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/60 justify-between shrink-0">
        <Link
          href="/dashboard"
          onClick={() => onClose?.()}
          className="flex items-center gap-3 group"
        >
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Core Platform
        </div>
        {items.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onClose?.()}
              className={cn(
                'flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span className="truncate">{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full font-normal whitespace-nowrap shrink-0 ml-2">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* System Status Footbar */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-slate-300">Policy Engine Online</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">PUN1 / CHK1</span>
        </div>
        <div className="text-[11px] text-slate-400 leading-snug">
          Logged in as <span className="text-slate-200 font-medium">{user?.name}</span> ({user?.role === 'ADMIN' ? 'Administrator' : 'Buyer'})
        </div>
        <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
          <LogOut className="h-3.5 w-3.5" />Sign out
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile/small tablets) */}
      <aside className="hidden lg:flex w-64 bg-[#0a1020] text-slate-300 flex-col border-r border-slate-800/80 select-none shrink-0 min-h-screen">
        <NavContent />
      </aside>

      {/* Mobile Drawer (visible only when isOpen is true on mobile) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={close}
          />
          {/* Slide-out panel */}
          <aside className="relative w-72 max-w-[85vw] bg-[#0a1020] text-slate-300 flex flex-col border-r border-slate-800/80 shadow-2xl z-10 select-none h-full">
            <NavContent onClose={close} />
          </aside>
        </div>
      )}
    </>
  );
}
