import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, getAdminUser, isAllowedAdmin, parseAdminIds } from './lib/admin.mjs';

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  let authenticated = false;
  if (url && key) {
    const client = createServerClient(url, key, {
      cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 2592000 },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Forward refreshed credentials to the page in this same request.
          const next = NextResponse.next({ request });
          response.cookies.getAll().forEach(cookie => next.cookies.set(cookie));
          response = next;
        },
      },
    });
    try {
      const { data, error } = await client.auth.getClaims();
      authenticated = !error && isAllowedAdmin({ id: data?.claims?.sub }, parseAdminIds(process.env.ADMIN_USER_IDS));
      if (!authenticated && request.cookies.has(ADMIN_COOKIE)) {
        authenticated = Boolean(await getAdminUser(request.cookies.get(ADMIN_COOKIE).value));
      }
    } catch { /* Pages fail closed if Auth is unavailable. */ }
  }
  const path = request.nextUrl.pathname;
  const isPage = path === '/admin' || path === '/admin/login' || /^\/admin\/[0-9a-f-]{36}$/i.test(path);
  if (isPage && ['GET', 'HEAD'].includes(request.method)) {
    const destination = authenticated && path === '/admin/login' ? '/admin'
      : !authenticated && path !== '/admin/login' ? '/admin/login' : null;
    if (destination) {
      const redirect = NextResponse.redirect(new URL(destination, request.url));
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      response = redirect;
    }
  }
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = { matcher: ['/admin/:path*'] };
