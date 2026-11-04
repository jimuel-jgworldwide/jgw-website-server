'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_COOKIE,
  authClient,
  isAllowedAdmin,
  parseAdminIds,
} from '../../lib/admin.mjs';

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
  try {
    result = await authClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
  } catch {
    redirect('/admin/login?error=unavailable');
  }

  if (result.error || !result.data.session?.access_token ||
      !isAllowedAdmin(result.data.user, ids)) {
    redirect('/admin/login?error=invalid');
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, result.data.session.access_token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: Math.max(1, Math.min(result.data.session.expires_in ?? 3600, 3600)),
  });
  redirect('/admin');
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 0,
  });
  redirect('/admin/login');
}
