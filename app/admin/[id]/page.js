import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { signOut } from '../actions';
import AdminLogo from '../logo';
import { dataClient } from '../../../lib/admin.mjs';
import { currentAdmin } from '../../../lib/admin-session';
import { SubmitButton, PendingLink, DownloadProof } from '../ui';

export const dynamic = 'force-dynamic';

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function Detail({ label, value }) {
  return (
    <div className="admin-detail-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

export default async function RegistrationPage({ params }) {
  const user = await currentAdmin();
  if (!user) redirect('/admin/login');

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let row;
  try {
    const result = await dataClient()
      .from('brand_audit_registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (result.error) throw result.error;
    row = result.data;
  } catch {
    return <main className="admin-wrap admin-content"><p className="admin-alert" role="alert">This registration could not be loaded. Please try again.</p></main>;
  }
  if (!row) notFound();

  return (
    <main className="admin-main">
      <header className="admin-header">
        <div className="admin-wrap admin-header-inner">
          <Link href="/admin" aria-label="All Brand Audit registrations"><AdminLogo className="admin-header-logo" /></Link>
          <form action={signOut}><SubmitButton className="admin-signout" pendingLabel="Signing out…">Sign out</SubmitButton></form>
        </div>
      </header>
      <div className="admin-wrap admin-content admin-detail-content">
        <PendingLink className="admin-back" href="/admin">All registrations</PendingLink>
        <div className="admin-title-row">
          <div>
            <h1>{row.brand_name}</h1>
            <p>Received {dateFormatter.format(new Date(row.created_at))}</p>
          </div>
        </div>

        <section className="admin-detail-section" aria-labelledby="participant-heading">
          <h2 id="participant-heading">Participant</h2>
          <dl>
            <Detail label="Full name" value={row.full_name} />
            <Detail label="Email address" value={row.email} />
            <Detail label="Contact number" value={row.contact_number} />
            <Detail label="Company / organization" value={row.company} />
            <Detail label="Job title / role" value={row.job_title} />
          </dl>
        </section>

        <section className="admin-detail-section" aria-labelledby="brand-heading">
          <h2 id="brand-heading">Brand</h2>
          <dl>
            <Detail label="Business name" value={row.brand_name} />
            <Detail label="Industry" value={row.industry === 'Other' ? row.industry_other : row.industry} />
            <Detail label="Website and social links" value={row.website_social_links} />
          </dl>
        </section>

        <section className="admin-detail-section" aria-labelledby="reservation-heading">
          <h2 id="reservation-heading">Reservation and payment</h2>
          <dl>
            <Detail label="Participants" value={row.participants} />
            <Detail label="Additional participants" value={row.additional_participants} />
            <Detail label="Payment method" value={row.payment_method} />
            <Detail label="Workshop fee" value="₱1,000 per person" />
            <Detail label="Proof of payment" value={row.proof_path
              ? <DownloadProof href={`/admin/proof/${row.id}`} />
              : 'No proof uploaded'} />
          </dl>
        </section>

        <section className="admin-detail-section" aria-labelledby="agreement-heading">
          <h2 id="agreement-heading">Registration agreements</h2>
          <dl>
            <Detail label="Information is accurate" value={row.confirm_accuracy ? 'Confirmed' : 'Not confirmed'} />
            <Detail label="Verification required" value={row.confirm_verification ? 'Confirmed' : 'Not confirmed'} />
            <Detail label="Cancellation policy" value={row.confirm_policy ? 'Confirmed' : 'Not confirmed'} />
          </dl>
        </section>
      </div>
    </main>
  );
}
