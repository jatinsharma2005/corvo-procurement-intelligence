'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './layout/sidebar';
import { useAuth } from './auth-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user } = useAuth();
  const publicPage = pathname === '/' || pathname === '/login';

  if (publicPage) return <>{children}</>;
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading Corvo...</div>;
  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
