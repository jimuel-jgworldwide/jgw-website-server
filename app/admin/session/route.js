import { currentAdmin } from '../../../lib/admin-session';

export async function GET() {
  return Response.json({ authenticated: Boolean(await currentAdmin()) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
