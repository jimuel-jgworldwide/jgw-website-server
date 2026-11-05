'use server';

import { cookies } from 'next/headers';
import { redirect, RedirectType } from 'next/navigation';
import {
  ADMIN_COOKIE,
  isAllowedAdmin,
  parseAdminIds,
} from '../../lib/admin.mjs';
import { sessionClient } from '../../lib/admin-session';

export async function signIn(formData) {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' ||
      email.length > 254 || password.length > 256 || !email.trim() || !password) {
    redirect('/admin/login?error=invalid');
  }

  const ids = parseAdminIds(process.env.ADMIN_USER_IDS);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || ids.size === 0) {
    redirect('/admin/login?error=setup');
  }

  let result;
  const client = await sessionClient();
  try {
    result = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  } catch {
    redirect('/admin/login?error=unavailable');
  }

  if (result.error || !result.data.session?.access_token ||
      !isAllowedAdmin(result.data.user, ids)) {
    await client.auth.signOut({ scope: 'local' });
    redirect('/admin/login?error=invalid');
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, '', { path: '/admin', maxAge: 0 });
  redirect('/admin', RedirectType.replace);
}

export async function signOut() {
  const client = await sessionClient();
  await client.auth.signOut({ scope: 'local' });
  const cookieStore = await cookies();
  cookieStore.getAll().filter(({ name }) => /^sb-.*-auth-token(?:\.\d+)?$/.test(name))
    .forEach(({ name }) => cookieStore.set(name, '', { path: '/', maxAge: 0 }));
  cookieStore.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 0,
  });
  redirect('/admin/login', RedirectType.replace);
}
