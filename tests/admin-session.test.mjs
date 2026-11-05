import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';

const id = 'f97ed9da-b30b-4745-9509-2762a81a317f';
const user = { id, aud: 'authenticated', email: 'admin@example.test' };
function token(exp) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp, role: 'authenticated' })}.c2lnbmF0dXJl`;
}

test('SSR sessions persist, refresh in a new request, and local logout leaves another browser signed in', async () => {
  const calls = [];
  let expired = true;
  const mockFetch = async (input, options = {}) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/token')) {
      const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
      expired = false;
      return Response.json({ access_token: token(exp), refresh_token: 'refresh-per-browser', token_type: 'bearer', expires_in: exp - Math.floor(Date.now() / 1000), expires_at: exp, user });
    }
    if (url.includes('/user')) return Response.json(user);
    if (url.includes('/logout')) return new Response(null, { status: 204 });
    throw new Error(`Unexpected auth request ${url}`);
  };
  function client(jar) {
    return createServerClient('https://example.supabase.co', 'test-publishable', {
      global: { fetch: mockFetch },
      cookieOptions: { httpOnly: true, path: '/', maxAge: 2592000 },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: items => items.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)),
      },
    });
  }
  const firstBrowser = new Map();
  const signedIn = await client(firstBrowser).auth.signInWithPassword({ email: user.email, password: 'test' });
  assert.equal(signedIn.error, null);
  assert.ok(firstBrowser.size > 0, 'persistent cookie was written');
  const refreshed = await client(firstBrowser).auth.getUser();
  assert.equal(refreshed.data.user.id, id);
  assert.ok(calls.some(url => url.includes('grant_type=refresh_token')));
  const secondBrowser = new Map();
  await client(secondBrowser).auth.signInWithPassword({ email: user.email, password: 'test' });
  await client(firstBrowser).auth.signOut({ scope: 'local' });
  assert.equal(firstBrowser.size, 0);
  assert.ok(calls.some(url => url.includes('scope=local')));
  assert.equal((await client(secondBrowser).auth.getUser()).data.user.id, id);
});
