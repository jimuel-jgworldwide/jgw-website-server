import { randomUUID } from 'node:crypto';
import { dataClient } from '../../../lib/admin.mjs';
import { jgwLogo } from '../../../lib/brand-assets.mjs';
import { gcashQr, paymentRegistrationId } from '../../../lib/payment-link.mjs';
import { InputError, readPaymentMethod, validateProof } from '../../../lib/registration.mjs';

export const runtime = 'nodejs';

function page(title, body, status = 200, showPayment = false) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | JG Worldwide</title>
  <style>
    :root{--ink:#000f13;--yellow:#ffcc01;--paper:#f4f5f1;--rule:#c9d0ce;--muted:#485658}
    *{box-sizing:border-box}
    body{margin:0;border-top:6px solid var(--yellow);background:var(--paper);color:var(--ink);font:1rem/1.55 Arial,sans-serif}
    .wrap{width:min(100% - 2.5rem,62rem);margin-inline:auto}
    header{background:white;border-bottom:1px solid var(--rule)}
    header .wrap{display:flex;align-items:center;min-height:76px}
    .logo{display:block;width:156px;max-height:46px;object-fit:contain;object-position:left center}
    main{padding-block:clamp(2rem,6vw,4.5rem)}
    h1,h2{margin:0;font-family:Georgia,serif;line-height:1.15;letter-spacing:-.025em}
    h1{font-size:clamp(2.15rem,5vw,3.4rem);text-wrap:balance}
    h2{font-size:1.55rem}
    p{margin:0} .event{margin-top:.75rem;color:var(--muted)}
    .status{max-width:56ch;margin-top:1.25rem}
    .payment-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:clamp(1.5rem,4vw,3rem);align-items:start;margin-top:2rem}
    .instructions{padding-top:1rem;border-top:1px solid var(--ink)}
    .fee{display:flex;align-items:baseline;gap:.55rem;margin:.65rem 0 1rem;color:var(--muted)}
    .fee strong{color:var(--ink);font-size:1.65rem}
    details{border-bottom:1px solid var(--rule)}
    summary{cursor:pointer;font-weight:700;padding:.75rem .125rem;min-height:48px}
    details p{padding:0 .125rem 1rem;overflow-wrap:anywhere}
    .qr{display:block;width:min(100%,240px);height:auto;margin:.25rem auto 1rem}
    form{min-width:0;background:white;border:1px solid var(--rule);border-radius:16px;padding:clamp(1rem,4vw,1.75rem)}
    label{display:block;margin-top:1.25rem;margin-bottom:.35rem;font-weight:700}
    select,input{display:block;width:100%;min-width:0;min-height:48px;border:1px solid #82918f;border-radius:8px;background:var(--paper);color:var(--ink);padding:.6rem .75rem;font:inherit}
    input[type=file]::file-selector-button{border:0;border-radius:6px;background:white;color:var(--ink);padding:.45rem .6rem;margin-right:.45rem;font:inherit;cursor:pointer}
    .hint{color:var(--muted);font-size:.875rem;margin-top:.4rem}
    button{width:100%;margin-top:1.25rem;min-height:48px;padding:.75rem 1.25rem;border:0;border-radius:100px;background:var(--yellow);color:var(--ink);font:700 1rem Arial,sans-serif;cursor:pointer}
    button:hover{background:#ffd637}
    :focus-visible{outline:2px solid var(--ink);outline-offset:3px}
    [role=alert]{color:#8c2118;background:#fff1ed;border-radius:8px;padding:.75rem;margin-top:1rem}
    a{color:inherit;text-underline-offset:3px}
    footer{border-top:1px solid var(--rule);padding-block:1rem;color:var(--muted);font-size:.9rem}
    @media(max-width:690px){.payment-grid{grid-template-columns:minmax(0,1fr)}}
  </style>
  </head><body>
    <header><div class="wrap"><img class="logo" src="${jgwLogo}" alt="JG Worldwide" width="156"></div></header>
    <main class="wrap"><h1>${title}</h1>${showPayment ? '<p class="event">Brand Audit · Friday, November 27, 2026</p>' : ''}
      ${showPayment ? body : `<div class="status">${body}</div>`}</main>
    <footer class="wrap">Need help? <a href="mailto:hello@jgworldwide.ph">hello@jgworldwide.ph</a></footer>
  </body></html>`, {
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
  return page('Complete your registration', `<div class="payment-grid">
    <section class="instructions" aria-labelledby="pay-heading">
      <h2 id="pay-heading">1. Make your payment</h2>
      <p class="fee"><strong>₱1,000</strong> per head</p>
      <details><summary>Pay with GCash</summary><a href="${gcashQr}" target="_blank" rel="noopener noreferrer" aria-label="Open full-size GCash QR"><img class="qr" src="${gcashQr}" alt="JG Worldwide GCash payment QR" width="240" height="462" loading="lazy"></a></details>
      <details><summary>Pay by Chinabank transfer</summary><p>JG Worldwide Incorporated<br>Account number: <strong>118800013365</strong></p></details>
    </section>
    <form method="post" enctype="multipart/form-data">
      <h2>2. Upload your receipt</h2>
      ${error ? `<p role="alert">${error}</p>` : ''}
      <label for="method">Payment method</label>
      <select id="method" name="payment_method" required><option value="">Choose a method</option><option>GCash</option><option>Bank transfer</option></select>
      <label for="proof">Payment receipt</label>
      <input id="proof" name="proof_of_payment" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-describedby="proof-hint" required>
      <p id="proof-hint" class="hint">PNG, JPEG, WebP or PDF · up to 3 MB</p>
      <button type="submit">Submit payment proof</button>
      <p class="hint">We’ll email your confirmation after verifying your payment.</p>
    </form></div>`, error ? 400 : 200, true);
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
