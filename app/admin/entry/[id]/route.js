import { currentAdmin } from '../../../../lib/admin-session';
import { dataClient } from '../../../../lib/admin.mjs';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request, { params }) {
  if (!await currentAdmin()) return Response.json({ error: 'Your session expired. Refresh and sign in again.' }, { status: 401, headers });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: 'Registration not found.' }, { status: 404, headers });
  try {
    const { data, error } = await dataClient().from('brand_audit_registrations').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: 'Registration not found.' }, { status: 404, headers });
    const { proof_path, ...entry } = data;
    return Response.json({ entry: { ...entry, hasProof: Boolean(proof_path) } }, { headers });
  } catch { return Response.json({ error: 'Could not load this registration. Please try again.' }, { status: 500, headers }); }
}
