import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOptions, handleRegistration } from '../lib/handler.mjs';

const ORIGIN = 'https://www.jgworldwide.ph';
const allowedOrigins = new Set([ORIGIN]);

function validForm(withProof = false) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    full_name: 'Jane Doe', email: 'jane@example.com', contact_number: '+63 917 123 4567',
    company: 'Example Inc.', job_title: 'Founder', brand_name: 'Example Brand',
    industry: 'Technology', website_social_links: 'https://example.com',
    participants: '1', payment_method: 'On-site', confirm_accuracy: 'yes',
    confirm_verification: 'yes', confirm_policy: 'yes',
  })) form.set(key, value);
  if (withProof) {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    form.set('proof_of_payment', new File([png], 'receipt.png', { type: 'image/png' }));
  }
  return form;
}

function request(origin, form) {
  return new Request('https://api.example.test/api/register', {
    method: 'POST', headers: { origin }, body: form,
  });
}

function fakeClient({ insertError = null } = {}) {
  const calls = [];
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload(path, buffer) {
            calls.push(['upload', bucket, path, buffer.length]);
            return { error: null };
          },
          async remove(paths) {
            calls.push(['remove', bucket, paths]);
            return { error: null };
          },
        };
      },
    },
    from(table) {
      return {
        async insert(row) {
          calls.push(['insert', table, row]);
          return { error: insertError };
        },
      };
    },
  };
  return { client, calls };
}

test('rejects an origin outside the Webflow allowlist', async () => {
  let called = false;
  const response = await handleRegistration(request('https://elsewhere.test', validForm()), {
    allowedOrigins, getClient: () => { called = true; },
  });
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test('preflight allows the configured Webflow origin', async () => {
  const response = handleOptions(new Request('https://api.example.test/api/register', {
    method: 'OPTIONS', headers: { origin: ORIGIN },
  }), allowedOrigins);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN);
});

test('stores a validated registration without returning personal data', async () => {
  const { client, calls } = fakeClient();
  const response = await handleRegistration(request(ORIGIN, validForm()), {
    allowedOrigins, getClient: () => client,
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(body.registrationId);
  assert.equal(JSON.stringify(body).includes('jane@example.com'), false);
  assert.equal(calls[0][0], 'insert');
  assert.equal(calls[0][2].proof_path, null);
});

test('removes a private receipt if database insert fails', async () => {
  const { client, calls } = fakeClient({ insertError: new Error('database unavailable') });
  const response = await handleRegistration(request(ORIGIN, validForm(true)), {
    allowedOrigins, getClient: () => client, logError: () => {},
  });
  assert.equal(response.status, 500);
  assert.deepEqual(calls.map(call => call[0]), ['upload', 'insert', 'remove']);
  assert.equal((await response.json()).error.includes('database unavailable'), false);
});

test('returns a helpful validation error without contacting Supabase', async () => {
  const form = validForm();
  form.delete('email');
  let called = false;
  const response = await handleRegistration(request(ORIGIN, form), {
    allowedOrigins, getClient: () => { called = true; },
  });
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.match((await response.json()).error, /email/i);
});
