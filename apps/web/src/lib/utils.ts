import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(val);
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN').format(val);
}

export function formatDate(d: string | Date | undefined | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getRouteBadge(route: string | undefined): { label: string; className: string } {
  switch (route) {
    case 'CONTRACT_PO':
      return { label: 'Contract PO', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'SPOT_PO':
      return { label: 'Spot PO', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'EMERGENCY_PO':
      return { label: 'Emergency PO', className: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'RFQ':
      return { label: 'RFQ (3 Quotes)', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'RFP':
      return { label: 'RFP (Formal)', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'CAPEX_SOURCING':
      return { label: 'Capex Sourcing', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'NEW_ITEM_SOURCING':
      return { label: 'New Item Sourcing', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    default:
      return { label: route || 'Unknown', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

export function getDecisionBadge(decision: string | undefined): { label: string; className: string } {
  switch (decision) {
    case 'PO':
      return { label: 'Purchase Order', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'SOURCING_REQUEST':
      return { label: 'Sourcing Request', className: 'bg-amber-100 text-amber-800 border-amber-300' };
    default:
      return { label: decision || '—', className: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}

export function getStatusBadge(status: string | undefined): { label: string; className: string } {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'PENDING_APPROVAL':
      return { label: 'Pending Approval', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'OVERRIDDEN':
      return { label: 'Overridden', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'REJECTED':
      return { label: 'Rejected', className: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { label: status || 'Pending', className: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}
