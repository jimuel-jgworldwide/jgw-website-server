'use client';

import Link, { useLinkStatus } from 'next/link';
import { useFormStatus } from 'react-dom';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, Download, LoaderCircle, RefreshCw, Search, X } from 'lucide-react';
import { ProofPreview, ReviewPanel } from './payment-ui';

export function DetailsButton({ id, children, className = 'admin-view-link' }) {
  const dialog = useRef(null);
  const controller = useRef(null);
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function open() {
    dialog.current.showModal();
    setBusy(true); setError(''); setEntry(null);
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const response = await fetch(`/admin/entry/${id}`, { cache: 'no-store', signal: controller.current.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEntry(result.entry);
    } catch (e) { if (e.name !== 'AbortError') setError(e.message || 'Could not load registration.'); }
    finally { setBusy(false); }
  }
  const fields = entry ? [
    ['Full name', entry.full_name], ['Email', entry.email], ['Contact number', entry.contact_number],
    ['Company', entry.company], ['Job title / role', entry.job_title], ['Brand', entry.brand_name],
    ['Industry', entry.industry === 'Other' ? entry.industry_other : entry.industry], ['Website and social links', entry.website_social_links],
    ['Participants', entry.participants], ['Additional participants', entry.additional_participants],
    ['Fee', '₱1,000 per head'], ['Payment method', entry.payment_method],
    ['Information accuracy', entry.confirm_accuracy ? 'Confirmed' : 'Not confirmed'],
    ['Registration verification', entry.confirm_verification ? 'Confirmed' : 'Not confirmed'],
    ['Cancellation policy', entry.confirm_policy ? 'Confirmed' : 'Not confirmed'],
  ] : [];
  return <><button type="button" className={className} onClick={open}>{children}<ArrowUpRight size={16} aria-hidden="true" /></button>
    <dialog ref={dialog} className="admin-entry-dialog" aria-labelledby={`entry-title-${id}-${className}`} onClose={() => controller.current?.abort()} onClick={event => { if (event.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.current.close(); } }}>
      <header className="admin-dialog-header"><h2 id={`entry-title-${id}-${className}`}>{entry?.brand_name || 'Registration details'}</h2><button className="admin-dialog-close" aria-label="Close registration details" onClick={() => dialog.current.close()}><X size={22} /></button></header>
      <div className="admin-dialog-body" aria-busy={busy}>
        {busy && <div role="status"><span className="admin-sr-only">Loading registration</span>{Array.from({ length: 6 }, (_, i) => <div className="admin-skeleton-row" key={i}><div className="admin-skeleton" /><div className="admin-skeleton" /></div>)}</div>}
        {error && <div role="alert"><p className="admin-alert">{error}</p><button className="admin-control" onClick={open}>Try again</button></div>}
        {entry && <><p className="admin-dialog-date">Received {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(entry.created_at))}</p><ReviewPanel entry={entry} onUpdate={setEntry} /><dl>{fields.map(([label, value]) => <div className="admin-detail-row" key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl><div className="admin-dialog-proof">{entry.hasProof ? <ProofPreview id={entry.id} type={entry.proofType} /> : 'No payment proof uploaded.'}</div></>}
      </div>
    </dialog></>;
}

export function AdminFilters({ search, payment, size }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function apply(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const [key, value] of data) if (value) query.set(key, value);
    query.set('page', '1');
    startTransition(() => router.push(`/admin?${query}`));
  }
  return <form action="/admin" onSubmit={apply} className="admin-filters" aria-busy={pending}>
    <label className="admin-search"><Search size={17} aria-hidden="true" /><span className="admin-sr-only">Search registrations</span><input name="q" defaultValue={search} placeholder="Search brand, name, email…" maxLength={100} /></label>
    <label className="admin-select-label"><span className="admin-sr-only">Payment method</span><select name="payment" defaultValue={payment}><option value="">All payment methods</option><option>GCash</option><option>Bank transfer</option><option>On-site</option></select></label>
    <label className="admin-select-label"><span className="admin-sr-only">Rows per page</span><select name="size" defaultValue={size}><option value="25">25 per page</option><option value="50">50 per page</option><option value="100">100 per page</option></select></label>
    <button className="admin-control admin-filter-apply" disabled={pending} type="submit">{pending && <LoaderCircle className="admin-spin" size={16} />}{pending ? 'Loading…' : 'Apply'}</button>
  </form>;
}

function LinkIndicator() {
  const { pending } = useLinkStatus();
  return <span className="admin-link-indicator" aria-live="polite">{pending ? <><LoaderCircle className="admin-spin" size={16} /><span className="admin-sr-only">Loading page</span></> : <ArrowUpRight size={16} aria-hidden="true" />}</span>;
}

export function PendingLink({ children, ...props }) {
  return <Link prefetch={false} {...props}>{children}<LinkIndicator /></Link>;
}

export function SubmitButton({ children, pendingLabel = 'Loading…', ...props }) {
  const { pending } = useFormStatus();
  return <button {...props} type="submit" disabled={pending} aria-busy={pending}>{pending && <LoaderCircle size={16} className="admin-spin" aria-hidden="true" />}{pending ? pendingLabel : children}</button>;
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="admin-control" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={16} className={pending ? 'admin-spin' : ''} aria-hidden="true" />{pending ? 'Refreshing…' : 'Refresh'}</button>;
}

export function DownloadProof({ href }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    setBusy(true); setError('');
    try {
      const response = await fetch(href, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Refresh and sign in again.' : 'Download failed. Please try again.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'payment-proof';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <span><button type="button" className="admin-download" disabled={busy} onClick={download}>{busy ? <LoaderCircle className="admin-spin" size={16} /> : <Download size={16} />} {busy ? 'Downloading…' : 'Download proof'}</button>{error && <span className="admin-download-error" role="alert">{error}</span>}</span>;
}

export function SessionSync() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let active = true, checking = false;
    async function check() {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        const response = await fetch('/admin/session', { cache: 'no-store' });
        if (!response.ok) return;
        const { authenticated } = await response.json();
        if (!active) return;
        if (authenticated && pathname === '/admin/login') router.replace('/admin');
        if (!authenticated && pathname !== '/admin/login') router.replace('/admin/login');
      } catch { /* Keep the current screen during a temporary network failure. */ }
      finally { checking = false; }
    }
    const onPageShow = event => { if (event.persisted) { router.refresh(); check(); } };
    check();
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', check);
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => { active = false; clearInterval(interval); window.removeEventListener('pageshow', onPageShow); window.removeEventListener('focus', check); };
  }, [pathname, router]);
  return null;
}
