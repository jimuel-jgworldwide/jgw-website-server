import { ADMIN_COOKIE, dataClient, getAdminUser, proofMetadata } from '../../../../lib/admin.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function GET(request, { params }) {
  const user = await getAdminUser(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!user) return new Response('Unauthorized', { status: 401, headers: noStore });

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response('Not found', { status: 404, headers: noStore });
  }

  try {
    const client = dataClient();
    const record = await client
      .from('brand_audit_registrations')
      .select('proof_path')
      .eq('id', id)
      .maybeSingle();
    if (record.error) throw record.error;
    if (!record.data?.proof_path) return new Response('Not found', { status: 404, headers: noStore });

    const file = await client.storage.from('brand-audit-proofs').download(record.data.proof_path);
    if (file.error || !file.data) throw file.error ?? new Error('Proof download failed');
    const { contentType, filename } = proofMetadata(record.data.proof_path);
    return new Response(file.data, {
      headers: {
        ...noStore,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return new Response('Proof could not be downloaded', { status: 500, headers: noStore });
  }
}
