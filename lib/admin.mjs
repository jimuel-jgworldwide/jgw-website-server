import { createClient } from '@supabase/supabase-js';

export const ADMIN_COOKIE = 'jgw_admin_session';
export const ADMIN_PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseAdminIds(value = '') {
  return new Set(
    value.split(',')
      .map(id => id.trim().toLowerCase())
      .filter(id => UUID.test(id)),
  );
}

export function isAllowedAdmin(user, ids) {
  return Boolean(user?.id && ids.has(user.id.toLowerCase()));
}

export function normalizePage(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,3}$/.test(value)) return 1;
  return Number(value);
}

export function proofMetadata(path) {
  const extension = typeof path === 'string' ? path.split('.').pop()?.toLowerCase() : '';
  const types = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
  };
  const safeExtension = Object.hasOwn(types, extension) ? extension : 'bin';
  return {
    contentType: types[safeExtension] ?? 'application/octet-stream',
    filename: `brand-audit-proof.${safeExtension}`,
  };
}

export function normalizeSearch(value) {
  return typeof value === 'string' ? value.slice(0, 100).replace(/[^\p{L}\p{N}\s@._-]/gu, '').trim() : '';
}

export function pageSize(value) {
  return ['25', '50', '100'].includes(value) ? Number(value) : ADMIN_PAGE_SIZE;
}

export function paginationWindow(page, total) {
  const pages = [...new Set([1, page - 1, page, page + 1, total])].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  return pages.flatMap((n, i) => i > 0 && n - pages[i - 1] > 1 ? [null, n] : [n]);
}

function supabaseOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  };
}

export function authClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase Auth configuration is missing');
  return createClient(url, key, supabaseOptions());
}

export function dataClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  return createClient(url, key, supabaseOptions());
}

export async function getAdminUser(accessToken) {
  const ids = parseAdminIds(process.env.ADMIN_USER_IDS);
  if (!accessToken || ids.size === 0) return null;
  try {
    const { data, error } = await authClient().auth.getUser(accessToken);
    if (error || !isAllowedAdmin(data.user, ids)) return null;
    return data.user;
  } catch {
    return null;
  }
}
