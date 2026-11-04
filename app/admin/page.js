import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signOut } from './actions';
import {
  ADMIN_COOKIE,
  ADMIN_PAGE_SIZE,
  dataClient,
  getAdminUser,
  normalizePage,
} from '../../lib/admin.mjs';

export const dynamic = 'force-dynamic';

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

export default async function AdminPage({ searchParams }) {
  const accessToken = (await cookies()).get(ADMIN_COOKIE)?.value;
  const user = await getAdminUser(accessToken);
  if (!user) redirect('/admin/login');

  const page = normalizePage((await searchParams).page);
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  let rows = [];
  let total = 0;
  let loadError = false;
  try {
    const result = await dataClient()
      .from('brand_audit_registrations')
      .select('id,created_at,full_name,brand_name,company,payment_method,proof_path', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, start + ADMIN_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    rows = result.data ?? [];
    total = result.count ?? 0;
  } catch {
    loadError = true;
  }

  return (
    <main className="admin-main">
      <header className="admin-header">
        <div className="admin-wrap admin-header-inner">
          <span className="admin-brand">JG Worldwide</span>
          <form action={signOut}><button className="admin-signout" type="submit">Sign out</button></form>
        </div>
      </header>
      <div className="admin-wrap admin-content">
        <div className="admin-title-row">
          <div>
            <h1>Brand Audit registrations</h1>
            <p>Workshop submissions, newest first.</p>
          </div>
          {!loadError && <span className="admin-count">{total} {total === 1 ? 'entry' : 'entries'}</span>}
        </div>

        {loadError ? (
          <p className="admin-alert" role="alert">Registrations could not be loaded. Check the Supabase table and server settings.</p>
        ) : rows.length === 0 ? (
          <p className="admin-empty">{page === 1 ? 'No registrations yet.' : 'No entries on this page.'}</p>
        ) : (
          <>
            <div className="admin-list-labels" aria-hidden="true">
              <span>Received</span><span>Brand</span><span>Participant</span><span>Payment</span><span>Proof</span><span />
            </div>
            <ul className="admin-list">
              {rows.map(row => (
                <li key={row.id}>
                  <Link className="admin-entry" href={`/admin/${row.id}`}>
                    <time dateTime={row.created_at}>{dateFormatter.format(new Date(row.created_at))}</time>
                    <span className="admin-entry-brand"><strong>{row.brand_name}</strong><small>{row.company}</small></span>
                    <span>{row.full_name}</span>
                    <span>{row.payment_method}</span>
                    <span className="admin-proof-state">{row.proof_path ? 'Attached' : 'None'}</span>
                    <span className="admin-entry-view">View</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loadError && total > ADMIN_PAGE_SIZE && (
          <nav className="admin-pagination" aria-label="Registration pages">
            {page > 1 ? <Link href={`/admin?page=${page - 1}`}>Previous</Link> : <span />}
            <span>Page {page} of {Math.ceil(total / ADMIN_PAGE_SIZE)}</span>
            {start + ADMIN_PAGE_SIZE < total ? <Link href={`/admin?page=${page + 1}`}>Next</Link> : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}
