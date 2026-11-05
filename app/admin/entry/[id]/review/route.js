import { currentAdmin } from '../../../../../lib/admin-session';
import { dataClient } from '../../../../../lib/admin.mjs';
import { deliverEmail } from '../../../../../lib/email.mjs';

export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request, { params }) {
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get('origin'));
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
    sameOrigin = origin.host === request.headers.get('host') && origin.protocol === `${protocol}:`;
  } catch {}
  if (!sameOrigin) return Response.json({ error: 'Request origin not allowed.' }, { status: 403, headers });
  const user = await currentAdmin();
  if (!user) return Response.json({ error: 'Session expired. Refresh and sign in again.' }, { status: 401, headers });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Invalid registration.' }, { status: 400, headers });
  const input = await request.json().catch(() => null);
  if (!['approve','receipt','approval'].includes(input?.action)) return Response.json({ error: 'Invalid action.' }, { status: 400, headers });
  if (input.action === 'approve' && input.confirmReviewed !== true) return Response.json({ error: 'Confirm that the payment has been reviewed.' }, { status: 400, headers });
  try {
    const client = dataClient();
    const record = await client.from('brand_audit_registrations').select('id,payment_status').eq('id', id).maybeSingle();
    if (record.error) throw record.error;
    if (!record.data) return Response.json({ error: 'Registration not found.' }, { status: 404, headers });
    if (input.action === 'approve') {
      const result = await client.from('brand_audit_registrations').update({ payment_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq('id', id).eq('payment_status', 'pending');
      if (result.error) throw result.error;
    } else if (input.action === 'approval' && record.data.payment_status !== 'approved') {
      return Response.json({ error: 'Review and approve the payment before sending confirmation.' }, { status: 409, headers });
    }
    const kind = input.action === 'receipt' ? 'receipt' : 'approval';
    // Unique key preserves an existing job, including its sent status.
    const queued = await client.from('brand_audit_email_outbox').upsert({ registration_id: id, kind }, { onConflict: 'registration_id,kind', ignoreDuplicates: true });
    if (queued.error) throw queued.error;
    const delivery = await deliverEmail(client, id, kind);
    return Response.json({ ok: true, emailStatus: delivery.status }, { headers });
  } catch { return Response.json({ error: 'The action could not be completed. Refresh to check the current status. Ensure migration 003 is installed.' }, { status: 500, headers }); }
}
