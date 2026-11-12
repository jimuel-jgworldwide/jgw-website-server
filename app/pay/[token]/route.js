import { randomUUID } from 'node:crypto';
import { dataClient } from '../../../lib/admin.mjs';
import { gcashQr, paymentRegistrationId } from '../../../lib/payment-link.mjs';
import { InputError, readPaymentMethod, validateProof } from '../../../lib/registration.mjs';

export const runtime = 'nodejs';

function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | JG Worldwide</title>
  <style>
    *{box-sizing:border-box}body{margin:0;border-top:6px solid #ffcc01;background:#f4f5f1;color:#000f13;font:1rem/1.55 system-ui,sans-serif}
    main{max-width:42rem;margin:clamp(1rem,5vw,4rem) auto;padding:clamp(1rem,5vw,2.5rem);background:white}
    h1{font:700 clamp(1.8rem,5vw,2.5rem)/1.1 Georgia,serif}h2{font-size:1.15rem}details,form{border-top:1px solid #d7dddd;padding-block:1rem}
    summary{cursor:pointer;font-weight:700}img{display:block;max-width:100%;height:auto;margin-block:1rem}
    label,select,input{display:block;margin-block:.5rem}select,input{max-width:100%;min-height:44px;font:inherit}
    button{margin-top:1rem;min-height:48px;padding:.75rem 1.25rem;border:0;border-radius:100px;background:#ffcc01;color:#000f13;font:700 1rem system-ui;cursor:pointer}
    [role=alert]{color:#9a2118}a{color:inherit}
  </style>
  <main><strong>JG Worldwide · Brand Audit</strong><h1>${title}</h1>${body}</main></html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https://cdn.prod.website-files.com; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

const received = () => page('Payment proof received', '<p>We’ll review your payment and email your confirmation once it’s verified.</p>');
const unavailable = () => page('Payment link unavailable', '<p>Check the link in your email or contact <a href="mailto:hello@jgworldwide.ph">hello@jgworldwide.ph</a> for help.</p>', 404);

function paymentForm(error = '') {
  return page('Complete your registration', `<p><strong>₱1,000 per head.</strong> Pay by GCash or bank transfer, then upload your receipt below.</p>
    <details><summary>GCash payment QR</summary><img src="${gcashQr}" alt="JG Worldwide GCash payment QR" width="280"></details>
    <details><summary>Chinabank transfer details</summary><p>JG Worldwide Incorporated<br>Account number: <strong>118800013365</strong></p></details>
    <form method="post" enctype="multipart/form-data">
      <h2>Upload proof of payment</h2>
      ${error ? `<p role="alert">${error}</p>` : ''}
      <label for="method">Payment method</label>
      <select id="method" name="payment_method" required><option value="">Choose a method</option><option>GCash</option><option>Bank transfer</option></select>
      <label for="proof">Payment receipt (PNG, JPEG, WebP or PDF, up to 3 MB)</label>
      <input id="proof" name="proof_of_payment" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required>
      <button type="submit">Submit payment proof</button>
    </form>`, error ? 400 : 200);
}

async function lookup(client, id) {
  const { data, error } = await client.from('brand_audit_registrations')
    .select('payment_method,payment_status,proof_path').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(_request, { params }) {
  const id = paymentRegistrationId((await params).token);
  if (!id) return unavailable();
  try {
    const entry = await lookup(dataClient(), id);
    if (entry?.proof_path) return received();
    return entry && entry.payment_method === null && entry.payment_status === 'pending' ? paymentForm() : unavailable();
  } catch {
    return page('Payment page temporarily unavailable', '<p>Please try again in a moment.</p>', 503);
  }
}

export async function POST(request, { params }) {
  const { token } = await params;
  const id = paymentRegistrationId(token);
  if (!id) return unavailable();
  if (Number(request.headers.get('content-length')) > 4 * 1024 * 1024) return paymentForm('Choose a receipt under 3 MB.');
  try {
    const client = dataClient();
    const entry = await lookup(client, id);
    if (entry?.proof_path) return received();
    if (!entry || entry.payment_method !== null || entry.payment_status !== 'pending') return unavailable();
    const form = await request.formData().catch(() => null);
    if (!form) return paymentForm('Choose a payment method and a receipt to upload.');
    const method = readPaymentMethod(form);
    const proof = await validateProof(form.get('proof_of_payment'));
    if (!proof) return paymentForm('Choose a receipt to upload.');
    const path = `${id}/${randomUUID()}.${proof.extension}`;
    const bucket = client.storage.from('brand-audit-proofs');
    const uploaded = await bucket.upload(path, proof.buffer, { contentType: proof.mimeType, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const saved = await client.from('brand_audit_registrations')
      .update({ payment_method: method, proof_path: path })
      .eq('id', id).is('payment_method', null).is('proof_path', null).eq('payment_status', 'pending')
      .select('id').maybeSingle();
    if (saved.error) {
      // A connection failure may occur after the write commits. Check before removing the file.
      const current = await lookup(client, id);
      if (current?.proof_path === path) return received();
      await bucket.remove([path]);
      throw saved.error;
    }
    if (!saved.data) {
      await bucket.remove([path]);
      return (await lookup(client, id))?.proof_path ? received() : unavailable();
    }
    return received();
  } catch (error) {
    if (error instanceof InputError) return paymentForm(error.message);
    return page('Could not save payment proof', '<p>Open the link from your email again to check whether your receipt was received or to retry.</p>', 503);
  }
}
