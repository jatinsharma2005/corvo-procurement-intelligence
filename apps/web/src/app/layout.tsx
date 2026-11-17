import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Sidebar } from '@/components/layout/sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Corvo Procurement Intelligence',
  description: 'Policy-driven procurement automation & intelligence platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className={`${inter.className} h-full antialiased text-slate-800`}>
        <Providers>
          <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
