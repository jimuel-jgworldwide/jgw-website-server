// Runs against a local mock Auth/database service; never touches production data.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const id = 'f97ed9da-b30b-4745-9509-2762a81a317f';
const user = { id, aud: 'authenticated', email: 'admin@example.test' };
const rows = Array.from({ length: 30 }, (_, i) => ({ id: randomUUID(), created_at: new Date(2026, 9, 1, 10, i).toISOString(), full_name: `Test Person ${i}`, email: `test${i}@example.test`, brand_name: `Test Brand ${i}`, company: 'Test Company', payment_method: 'GCash', proof_path: null }));
let refreshes = 0, localLogouts = 0;
rows[0].proof_path = `${rows[0].id}/proof.png`;
function jwt(exp) {
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: id, exp, iat: Math.floor(Date.now() / 1000), aud: 'authenticated', session_id: randomUUID() })}.c2lnbmF0dXJl`;
}
const mock = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mock');
  res.setHeader('content-type', 'application/json');
  if (url.pathname.endsWith('/token')) {
    const refresh = url.searchParams.get('grant_type') === 'refresh_token';
    if (refresh) refreshes++;
    const expires = refresh ? 3600 : -60;
    res.end(JSON.stringify({ access_token: jwt(Math.floor(Date.now() / 1000) + expires), refresh_token: randomUUID(), expires_in: expires, expires_at: Math.floor(Date.now() / 1000) + expires, token_type: 'bearer', user }));
  } else if (url.pathname.endsWith('/user')) res.end(JSON.stringify(user));
  else if (url.pathname.endsWith('/logout')) { if (url.searchParams.get('scope') === 'local') localLogouts++; res.statusCode = 204; res.end(); }
  else if (url.pathname.startsWith('/storage/v1/object/')) { res.setHeader('content-type', 'image/png'); res.end(Buffer.from([137,80,78,71,13,10,26,10])); }
  else if (url.pathname.startsWith('/rest/v1/')) {
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 25);
    res.setHeader('content-range', `${offset}-${Math.min(offset + limit, rows.length) - 1}/${rows.length}`);
    const selected = url.searchParams.get('id')?.replace(/^eq\./, '');
    res.end(JSON.stringify(selected ? rows.filter(row => row.id === selected) : rows.slice(offset, offset + limit)));
  } else { res.statusCode = 404; res.end('{}'); }
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const appPort = 8876;
const base = `http://127.0.0.1:${appPort}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(appPort)], {
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'mock-key', SUPABASE_SECRET_KEY: 'mock-secret', ADMIN_USER_IDS: id },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', value => { logs += value; });
child.stderr.on('data', value => { logs += value; });
async function request(path, jar, options = {}) {
  const response = await fetch(base + path, { redirect: 'manual', ...options, headers: { Origin: base, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers } });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0], at = pair.indexOf('=');
    const key = pair.slice(0, at), value = pair.slice(at + 1);
    if (value) jar.set(key, value); else jar.delete(key);
  }
  return response;
}
async function action(path, jar, html, values = {}) {
  const name = html.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(name, 'Server Action is present');
  const body = new FormData(); body.set(name, '');
  Object.entries(values).forEach(([key, value]) => body.set(key, value));
  return request(path, jar, { method: 'POST', body });
}
try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(base + '/admin/login'); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  const first = new Map(), second = new Map();
  const unauth = await request('/admin', first);
  assert.equal(unauth.headers.get('location'), '/admin/login');
  assert.equal((await request(`/admin/proof/${rows[0].id}`, first)).status, 401);
  assert.equal((await request(`/admin/entry/${rows[0].id}`, first)).status, 401);
  assert.equal((await request(`/admin/entry/${rows[0].id}/review`, first, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', confirmReviewed: true }) })).status, 401);
  for (const jar of [first, second]) {
    const login = await (await request('/admin/login', jar)).text();
    const signedIn = await action('/admin/login', jar, login, { email: user.email, password: 'test-only' });
    assert.equal(signedIn.status, 303);
    assert.ok(jar.size > 0);
    const dashboard = await request('/admin', jar);
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /<table/);
    assert.match(dashboard.headers.get('cache-control'), /no-store/);
    const backToLogin = await request('/admin/login', jar);
    assert.equal(backToLogin.headers.get('location'), '/admin');
  }
  assert.ok(refreshes >= 2, 'expired sessions refreshed in proxy');
  const details = await request(`/admin/entry/${rows[0].id}`, first);
  assert.equal(details.status, 200);
  const payload = await details.json();
  assert.equal(payload.entry.id, rows[0].id);
  assert.equal(payload.entry.hasProof, true);
  assert.equal('proof_path' in payload.entry, false);
  const preview = await request(`/admin/proof/${rows[0].id}?preview=1`, first);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-disposition'), /^inline;/);
  assert.equal(preview.headers.get('content-type'), 'image/png');
  assert.match((await request(`/admin/proof/${rows[0].id}`, first)).headers.get('content-disposition'), /^attachment;/);
  assert.equal((await request(`/admin/entry/${rows[0].id}/review`, first, { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: '{}' })).status, 403);
  const secondPage = await (await request('/admin?page=2', first)).text();
  assert.match(secondPage, /26.*30 of 30 registrations/);
  const dashboard = await (await request('/admin', first)).text();
  await action('/admin', first, dashboard);
  assert.equal(localLogouts, 1);
  assert.equal((await request('/admin/session', first)).status, 200);
  assert.deepEqual(await (await request('/admin/session', first)).json(), { authenticated: false });
  assert.equal((await request('/admin', second)).status, 200);
  console.log('PASS: auth gates, persistent refresh, login redirect, table/pagination, no-store, independent browsers, local logout.');
} catch (error) {
  console.error(logs.slice(-5000)); throw error;
} finally {
  child.kill();
  mock.closeAllConnections(); mock.close();
}
