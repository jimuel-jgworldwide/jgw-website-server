import { redirect } from 'next/navigation';
import { FileCheck2, FileMinus2, Inbox } from 'lucide-react';
import { signOut } from './actions';
import AdminLogo from './logo';
import { currentAdmin } from '../../lib/admin-session';
import { dataClient, normalizePage, normalizeSearch, pageSize, paginationWindow } from '../../lib/admin.mjs';
import { SubmitButton, PendingLink, RefreshButton, AdminFilters, DetailsButton } from './ui';

export const dynamic = 'force-dynamic';
const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

export default async function AdminPage({ searchParams }) {
  const user = await currentAdmin();
  if (!user) redirect('/admin/login');
  const params = await searchParams;
  const page = normalizePage(params.page);
  const size = pageSize(params.size);
  const search = normalizeSearch(params.q);
  const payment = ['GCash', 'Bank transfer', 'On-site'].includes(params.payment) ? params.payment : '';
  const start = (page - 1) * size;
  function pageUrl(number) {
    const query = new URLSearchParams({ page: String(number), size: String(size) });
    if (search) query.set('q', search);
    if (payment) query.set('payment', payment);
    return `/admin?${query}`;
  }
  let rows = [], total = 0, loadError = false;
  try {
    let query = dataClient().from('brand_audit_registrations')
      .select('id,created_at,full_name,email,brand_name,company,payment_method,proof_path', { count: 'exact' });
    if (payment) query = query.eq('payment_method', payment);
    if (search) query = query.or(`full_name.ilike.%${search}%,brand_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, start + size - 1);
    if (result.error) throw result.error;
    rows = result.data ?? []; total = result.count ?? 0;
  } catch { loadError = true; }
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (!loadError && page > totalPages) redirect(pageUrl(totalPages));

  return <main className="admin-main">
    <header className="admin-header"><div className="admin-wrap admin-header-inner">
      <AdminLogo className="admin-header-logo" />
      <div className="admin-account"><span>{user.email}</span><form action={signOut}><SubmitButton className="admin-signout" pendingLabel="Signing out…">Sign out</SubmitButton></form></div>
    </div></header>
    <div className="admin-wrap admin-content">
      <div className="admin-title-row"><div><h1>Registrations</h1><p>Brand Audit workshop · November 27, 2026</p></div>
        <RefreshButton />
      </div>
      <section className="admin-table-panel" aria-label="Workshop registrations">
        <div className="admin-panel-heading"><h2>All submissions <span className="admin-count">{total}</span></h2><span>Newest first · Philippine time</span></div>
        <AdminFilters key={`${search}-${payment}-${size}`} search={search} payment={payment} size={size} />
        {loadError ? <div className="admin-table-empty"><p className="admin-alert" role="alert">Registrations could not be loaded. Try refreshing the page.</p><RefreshButton /></div>
          : rows.length === 0 ? <div className="admin-table-empty"><Inbox size={32} aria-hidden="true" /><h3>{search || payment ? 'No matching registrations' : 'No registrations yet'}</h3><p>{search || payment ? 'Try another search or clear your filters.' : 'New submissions will appear here.'}</p>{(search || payment) && <PendingLink className="admin-control" href="/admin">Clear filters</PendingLink>}</div>
          : <div className="admin-table-scroll" role="region" aria-label="Registrations table" tabIndex={0}><table className="admin-table"><caption className="admin-sr-only">Registration entries, newest first</caption>
            <thead><tr><th scope="col">Brand / company</th><th scope="col">Participant</th><th scope="col">Payment method</th><th scope="col">Payment proof</th><th scope="col">Received</th><th scope="col"><span className="admin-sr-only">Details</span></th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <th scope="row"><DetailsButton className="admin-brand-link" id={row.id}><span><strong>{row.brand_name}</strong><small>{row.company}</small></span></DetailsButton></th>
              <td><strong>{row.full_name}</strong><small>{row.email}</small></td>
              <td><span className="admin-payment-badge">{row.payment_method}</span></td>
              <td><span className={`admin-proof-badge ${row.proof_path ? 'has-proof' : ''}`}>{row.proof_path ? <FileCheck2 size={15} aria-hidden="true" /> : <FileMinus2 size={15} aria-hidden="true" />}{row.proof_path ? 'Attached' : 'Not uploaded'}</span></td>
              <td><time dateTime={row.created_at}>{dateFormatter.format(new Date(row.created_at))}</time></td>
              <td><DetailsButton id={row.id}>View<span className="admin-sr-only"> {row.brand_name}</span></DetailsButton></td>
            </tr>)}</tbody>
          </table></div>}
        {!loadError && <footer className="admin-table-footer"><p>{total ? `${start + 1}–${Math.min(start + size, total)} of ${total} registrations` : '0 registrations'}</p>
          <nav className="admin-page-controls" aria-label="Registration pages">
            {page > 1 ? <PendingLink className="admin-page-button" href={pageUrl(page - 1)}>Previous</PendingLink> : <span className="admin-page-button is-disabled" aria-disabled="true">Previous</span>}
            {paginationWindow(page, totalPages).map((number, index) => number === null ? <span key={`gap-${index}`} className="admin-page-gap">…</span> : <PendingLink key={number} className={`admin-page-button admin-page-number ${number === page ? 'is-current' : ''}`} href={pageUrl(number)} aria-current={number === page ? 'page' : undefined}>{number}</PendingLink>)}
            {page < totalPages ? <PendingLink className="admin-page-button" href={pageUrl(page + 1)}>Next</PendingLink> : <span className="admin-page-button is-disabled" aria-disabled="true">Next</span>}
          </nav>
        </footer>}
      </section>
    </div>
  </main>;
}
