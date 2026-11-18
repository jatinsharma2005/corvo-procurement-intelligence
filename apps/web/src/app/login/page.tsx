'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        router.replace('/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [router, user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setLoading(true);
    try {
      const authenticated = await login(trimmedEmail, password);
      if (remember) {
        localStorage.setItem('corvo_remember_session', 'true');
      } else {
        sessionStorage.setItem('corvo_session_only', 'true');
      }
      if (authenticated.role === 'ADMIN') {
        router.replace('/dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_0.9fr] bg-slate-50">
      {/* Enterprise Left Hero (visible on desktop) */}
      <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between border-r border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 font-bold text-lg shadow-lg shadow-blue-500/20">
            C
          </span>
          <span className="font-bold text-xl tracking-tight">CORVO</span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
            v5.0
          </span>
        </Link>
        <div className="max-w-lg space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-300">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            GOVERNED ENTERPRISE ACCESS
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Intelligent procurement decisions under strict policy control.
          </h1>
          <p className="text-sm leading-7 text-slate-400">
            Deterministic policy evaluation, multi-factor supplier intelligence, automated contract
            ceiling tracking, and mandatory buyer audit trails in one unified platform.
          </p>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Corvo Policy Engine Online • Restricted Enterprise Access
        </div>
      </section>

      {/* Login Form Section (Mobile & Desktop) */}
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg lg:hidden mb-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white font-bold text-sm">
              C
            </span>
            <span>CORVO</span>
          </Link>

          <div>
            <div className="mb-4 inline-flex p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
              <LockKeyhole className="h-6 w-6 text-blue-700" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Sign In</h1>
            <p className="mt-1 text-xs text-slate-500">
              Sign in with your administrator or buyer credentials to access Corvo.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="email">
                Corporate Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                placeholder="name@corvo.internal"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-xs font-semibold text-slate-700"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-11 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Remember session</span>
              </label>
              <span className="text-slate-400 text-[11px]">Strict Role Governance</span>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium leading-relaxed"
              >
                {error}
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="h-11 w-full rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-200">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
            >
              &larr; Back to overview
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
