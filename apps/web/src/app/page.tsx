'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, Bot, CheckCircle2, FileCheck2, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';

const features = [
  ['AI-assisted purchase intake', 'Conversational PR capture and item clarification'],
  ['Policy decision engine', 'Deterministic evaluation against the active procurement policy'],
  ['Requirement clubbing', 'Plant and 14-day window grouping of compatible requests'],
  ['Contract management', 'Rate contracts, ceiling tracking and signed PDF extraction'],
  ['Supplier intelligence', 'Multi-factor preferred supplier rankings'],
  ['Buyer approvals', 'Review, approve or document procurement overrides'],
];

export default function LandingPage() {
  const [open, setOpen] = useState(false);
  const nav = [['Features', '#features'], ['How it works', '#workflow'], ['About', '#about']];
  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-sm text-white">C</span>
            <span>CORVO</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            {nav.map(([label, href]) => <a key={href} href={href} className="text-sm text-slate-600 hover:text-slate-950">{label}</a>)}
            <Link href="/login" className="text-sm font-medium text-slate-700">Log in</Link>
            <Link href="/login" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Get started</Link>
          </div>
          <button className="rounded-lg p-2.5 text-slate-700 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
        </div>
        {open && <div className="border-t border-slate-200 px-4 py-3 md:hidden">
          {nav.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)} className="block py-2 text-sm">{label}</a>)}
          <Link href="/login" className="mt-2 block rounded-lg bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white">Get started</Link>
        </div>}
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:py-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Policy-driven procurement intelligence</div>
          <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Smarter procurement. Faster decisions. Complete control.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Transform purchase requests into intelligent procurement decisions with automated policy evaluation, supplier intelligence, contract management and complete audit visibility.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white">Get started <ArrowRight className="h-4 w-4" /></Link>
            <a href="#features" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Explore features</a>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <div className="mb-4 flex items-center justify-between"><span className="text-sm font-semibold">Procurement workspace</span><span className="text-[10px] text-emerald-300">Policy v5.0 active</span></div>
            <div className="grid grid-cols-2 gap-2">
              {[['Purchase requests','Live'],['Policy evaluation','Complete'],['Supplier ranking','Ready'],['Audit trail','Recorded']].map(([a,b]) => <div key={a} className="rounded-md border border-slate-800 bg-slate-900 p-3"><div className="text-[11px] text-slate-400">{a}</div><div className="mt-1 text-sm font-semibold">{b}</div></div>)}
            </div>
            <div className="mt-3 rounded-md border border-slate-800 bg-slate-900 p-3"><div className="flex justify-between text-xs"><span>Requirement group REQ-1042</span><span className="text-emerald-300">CONTRACT PO</span></div><div className="mt-3 h-1.5 rounded bg-slate-800"><div className="h-full w-4/5 rounded bg-blue-500" /></div></div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold">One controlled workflow from request to decision</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Corvo combines policy rules, procurement master data and operational approval workflows.</p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, text]) => <div key={title} className="bg-white p-5"><CheckCircle2 className="h-5 w-5 text-blue-700" /><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="mt-7 grid gap-3 md:grid-cols-6">
          {['Purchase request','Intelligent processing','Policy evaluation','Supplier selection','Buyer review','Procurement decision'].map((step, i) => <div key={step} className="relative rounded-lg border border-slate-200 bg-white p-4"><span className="text-xs font-bold text-blue-700">0{i+1}</span><p className="mt-2 text-sm font-semibold">{step}</p></div>)}
        </div>
      </section>

      <section id="about" className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-2">
          <div><h2 className="text-2xl font-bold">Built for two roles</h2><p className="mt-3 text-sm leading-7 text-slate-600">Administrators govern users, policies and contracts. Procurement buyers process requests, review decisions and export results.</p></div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-slate-200 p-4"><ShieldCheck className="h-5 w-5 text-blue-700" /><h3 className="mt-2 text-sm font-semibold">Administrator</h3><p className="mt-1 text-xs text-slate-500">Governance and access control</p></div><div className="rounded-lg border border-slate-200 p-4"><Users className="h-5 w-5 text-blue-700" /><h3 className="mt-2 text-sm font-semibold">Procurement Buyer</h3><p className="mt-1 text-xs text-slate-500">Requests, decisions and sourcing</p></div></div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between"><div className="font-semibold text-white">CORVO Procurement Intelligence</div><div className="flex gap-5 text-xs"><a href="#features">Features</a><a href="#workflow">How it works</a><Link href="/login">Log in</Link></div></div>
      </footer>
    </main>
  );
}
