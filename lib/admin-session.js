import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { ADMIN_COOKIE, getAdminUser, isAllowedAdmin, parseAdminIds } from './admin.mjs';

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

export async function sessionClient() {
  const store = await cookies();
  return createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(items) {
        // Server Components cannot write cookies; proxy refreshes them first.
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
      },
    },
  });
}

export const currentAdmin = cache(async () => {
  try {
    const client = await sessionClient();
    const { data, error } = await client.auth.getUser();
    if (!error && isAllowedAdmin(data.user, parseAdminIds(process.env.ADMIN_USER_IDS))) return data.user;
    // Existing one-hour sessions remain usable until their next sign-in.
    return getAdminUser((await cookies()).get(ADMIN_COOKIE)?.value);
  } catch {
    return null;
  }
});
