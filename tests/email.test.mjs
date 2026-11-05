import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationMessage, deliverEmail } from '../lib/email.mjs';

const entry = { id: 'test-id', email: 'person@example.test', full_name: '<script>name</script>', participants: '3+', payment_status: 'approved' };
test('receipt does not confirm payment and email HTML escapes supplied names', () => {
  const receipt = registrationMessage(entry, 'receipt');
  assert.match(receipt.text, /after your registration and payment have been verified/);
  assert.ok(!receipt.html.includes('<script>'));
  assert.match(receipt.html, /&lt;script&gt;/);
  assert.match(registrationMessage(entry, 'approval').text, /reviewed and approved/);
});

test('one claimed job sends once; failures remain retryable without touching registration', async () => {
  let claimed = false, sends = 0; const updates = [];
  const client = {
    async rpc() { if (claimed) return { data: [] }; claimed = true; return { data: [{ id: 'job', lease_token: 'lease' }] }; },
    from(table) {
      return {
        select() { return this; }, eq() { return this; }, single: async () => ({ data: entry }),
        update(values) { assert.equal(table, 'brand_audit_email_outbox'); updates.push(values); return this; },
        then(resolve) { resolve({ error: null }); },
      };
    },
  };
  const options = { configured: true, transport: { async sendMail() { sends++; return { accepted: [entry.email] }; } } };
  const results = await Promise.all([deliverEmail(client, 'test-id', 'receipt', options), deliverEmail(client, 'test-id', 'receipt', options)]);
  assert.equal(sends, 1); assert.ok(results.some(item => item.status === 'sent'));
  assert.equal(updates[0].status, 'sent');
  claimed = false;
  const failed = await deliverEmail(client, 'test-id', 'receipt', { configured: true, transport: { sendMail: async () => { throw new Error('smtp failure'); } } });
  assert.equal(failed.status, 'failed'); assert.equal(updates.at(-1).status, 'failed');
  assert.deepEqual(await deliverEmail(client, 'test-id', 'receipt', { configured: false }), { status: 'not_configured' });
});
