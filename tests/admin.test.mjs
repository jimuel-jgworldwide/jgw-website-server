import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedAdmin,
  normalizePage,
  parseAdminIds,
  proofMetadata,
} from '../lib/admin.mjs';

const adminId = 'f97ed9da-b30b-4745-9509-2762a81a317f';

test('only configured Supabase Auth user IDs can access admin data', () => {
  const ids = parseAdminIds(` ${adminId.toUpperCase()}, invalid, `);
  assert.deepEqual([...ids], [adminId]);
  assert.equal(isAllowedAdmin({ id: adminId }, ids), true);
  assert.equal(isAllowedAdmin({ id: 'e185114a-096a-42ae-b96d-dbe9dd7c629f' }, ids), false);
  assert.equal(isAllowedAdmin(null, ids), false);
});

test('pagination rejects malformed and unbounded page numbers', () => {
  assert.equal(normalizePage('2'), 2);
  for (const value of ['0', '-1', '2abc', '10000', 'Infinity', '']) {
    assert.equal(normalizePage(value), 1);
  }
});

test('proof responses use only known file types', () => {
  assert.deepEqual(proofMetadata('id/proof.pdf'), {
    contentType: 'application/pdf',
    filename: 'brand-audit-proof.pdf',
  });
  assert.deepEqual(proofMetadata('id/untrusted.html'), {
    contentType: 'application/octet-stream',
    filename: 'brand-audit-proof.bin',
  });
});
