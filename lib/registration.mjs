export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

const INDUSTRIES = new Set([
  'Beauty & Personal Care', 'Food & Beverages', 'Fashion & Lifestyle',
  'Retail & E-commerce', 'Health & Wellness', 'Professional Services',
  'Technology', 'Other',
]);
const PARTICIPANT_COUNTS = new Set(['1', '2', '3+']);
const PAYMENT_METHODS = new Set(['GCash', 'Bank transfer']);
const MAX_PROOF_BYTES = 3 * 1024 * 1024;

function readText(form, key, label, maxLength, required = true) {
  const value = form.get(key);
  if (value !== null && typeof value !== 'string') {
    throw new InputError(`Please check ${label}.`);
  }
  const text = (value ?? '').trim();
  if (required && !text) throw new InputError(`Please enter ${label}.`);
  if (text.length > maxLength) throw new InputError(`${label} is too long.`);
  return text;
}

export function parseRegistration(form) {
  const full_name = readText(form, 'full_name', 'your full name', 120);
  const email = readText(form, 'email', 'your email address', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError('Please enter a valid email address.');
  }
  const contact_number = readText(form, 'contact_number', 'your contact number', 40, false) || null;
  if (contact_number && contact_number.replace(/\D/g, '').length < 7) {
    throw new InputError('Please enter a valid contact number.');
  }
  const company = readText(form, 'company', 'your company or organization', 160, false) || null;
  const job_title = readText(form, 'job_title', 'your job title or role', 120, false) || null;
  const brand_name = readText(form, 'brand_name', 'your brand or business name', 160);
  const industry = readText(form, 'industry', 'your industry', 80, false) || null;
  if (industry && !INDUSTRIES.has(industry)) throw new InputError('Please choose an industry.');
  const industry_other = industry === 'Other'
    ? readText(form, 'industry_other', 'your industry', 120)
    : null;
  const website_social_links = readText(form, 'website_social_links', 'your website or social links', 2000, false) || null;
  const deferred = form.get('payment_step') === 'later';
  const participants = deferred ? '1' : readText(form, 'participants', 'the participant count', 3, false) || '1';
  if (!PARTICIPANT_COUNTS.has(participants)) {
    throw new InputError('Please choose the number of participants.');
  }
  const additional_participants = participants === '1'
    ? null
    : readText(form, 'additional_participants', 'the additional participant names', 1000);
  const payment_method = deferred ? null : readPaymentMethod(form);
  if (deferred && form.get('signup_agreement') !== 'yes') {
    throw new InputError('Please confirm the registration agreement.');
  }
  if (!deferred) for (const key of ['confirm_accuracy', 'confirm_verification', 'confirm_policy']) {
    if (form.get(key) !== 'yes') throw new InputError('Please confirm all registration agreements.');
  }

  const rawProof = deferred ? null : form.get('proof_of_payment');
  const proof = rawProof && typeof rawProof === 'object' && rawProof.size > 0 ? rawProof : null;

  return {
    data: {
      full_name, email, contact_number, company, job_title, brand_name,
      industry, industry_other, website_social_links, participants,
      additional_participants, payment_method,
      confirm_accuracy: true, confirm_verification: true, confirm_policy: true,
    },
    proof,
  };
}

export function readPaymentMethod(form) {
  const payment_method = readText(form, 'payment_method', 'a payment method', 30);
  if (!PAYMENT_METHODS.has(payment_method)) {
    throw new InputError('Please choose a payment method.');
  }
  return payment_method;
}

export async function validateProof(file) {
  if (!file) return null;
  if (file.size > MAX_PROOF_BYTES) {
    throw new InputError('Proof of payment must be 3 MB or smaller.');
  }
  if (file.size === 0 || typeof file.arrayBuffer !== 'function') {
    throw new InputError('Please choose a valid proof-of-payment file.');
  }
  const extensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  const extension = extensions[file.type];
  if (!extension) {
    throw new InputError('Proof of payment must be a PNG, JPEG, WebP, or PDF file.');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  const isPdf = buffer.toString('ascii', 0, 5) === '%PDF-';
  const matches = { png: isPng, jpg: isJpeg, webp: isWebp, pdf: isPdf };
  if (!matches[extension]) {
    throw new InputError('The selected proof-of-payment file does not match its file type.');
  }
  return { buffer, extension, mimeType: file.type };
}
