import test from 'node:test';
import assert from 'node:assert/strict';
import { InputError, parseRegistration, validateProof } from '../lib/registration.mjs';

function validForm() {
  const form = new FormData();
  const fields = {
    full_name: '  Jane Doe  ',
    email: ' jane@example.com ',
    contact_number: '+63 917 123 4567',
    company: 'Example Inc.',
    job_title: 'Founder',
    brand_name: 'Example Brand',
    industry: 'Technology',
    website_social_links: 'https://example.com',
    participants: '1',
    payment_method: 'GCash',
    confirm_accuracy: 'yes',
    confirm_verification: 'yes',
    confirm_policy: 'yes',
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

test('normalizes a valid single-participant registration', () => {
  const { data, proof } = parseRegistration(validForm());
  assert.equal(data.full_name, 'Jane Doe');
  assert.equal(data.email, 'jane@example.com');
  assert.equal(data.participants, '1');
  assert.equal(data.additional_participants, null);
  assert.equal(data.industry_other, null);
  assert.equal(proof, null);
});

test('accepts the short form and defaults to one participant without invented details', () => {
  const form = validForm();
  for (const key of ['contact_number', 'company', 'job_title', 'industry', 'website_social_links', 'participants']) form.delete(key);
  const { data } = parseRegistration(form);
  assert.equal(data.participants, '1');
  assert.equal(data.brand_name, 'Example Brand');
  for (const key of ['contact_number', 'company', 'job_title', 'industry', 'website_social_links']) assert.equal(data[key], null);
});

test('requires extra names when registering more than one person', () => {
  const form = validForm();
  form.set('participants', '2');
  assert.throws(() => parseRegistration(form), InputError);
  form.set('additional_participants', 'John Doe');
  assert.equal(parseRegistration(form).data.additional_participants, 'John Doe');
});

test('requires industry detail when Other is selected', () => {
  const form = validForm();
  form.set('industry', 'Other');
  assert.throws(() => parseRegistration(form), InputError);
  form.set('industry_other', 'Education');
  assert.equal(parseRegistration(form).data.industry_other, 'Education');
});

test('rejects missing agreement, on-site payment, and invalid payment choices', () => {
  const form = validForm();
  form.delete('confirm_policy');
  assert.throws(() => parseRegistration(form), InputError);
  form.set('confirm_policy', 'yes');
  form.set('payment_method', 'On-site');
  assert.throws(() => parseRegistration(form), InputError);
  form.set('payment_method', 'crypto');
  assert.throws(() => parseRegistration(form), InputError);
});

test('accepts a real PNG receipt and rejects a spoofed PNG', async () => {
  const header = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  const valid = new File([header], 'receipt.png', { type: 'image/png' });
  assert.equal((await validateProof(valid)).extension, 'png');
  const fake = new File(['not a png'], 'fake.png', { type: 'image/png' });
  await assert.rejects(() => validateProof(fake), InputError);
});

test('rejects receipts over 3 MB', async () => {
  const large = new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });
  await assert.rejects(() => validateProof(large), InputError);
});
