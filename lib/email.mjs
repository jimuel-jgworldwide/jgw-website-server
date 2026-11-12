import nodemailer from 'nodemailer';
import { paymentUrl } from './payment-link.mjs';
import { jgwLogo } from './brand-assets.mjs';

export function emailConfigured() { return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD); }
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

export function registrationMessage(entry, kind) {
  const approved = kind === 'approval';
  const link = !approved && entry.payment_method === null ? paymentUrl(entry.id) : null;
  const heading = approved ? 'Your registration is confirmed.' : 'Registration received.';
  const message = approved
    ? 'Your payment has been reviewed and approved. Your slot for Brand Audit: Let’s Get You Ready for 2027 is confirmed.'
    : 'Thank you for registering for Brand Audit: Let’s Get You Ready for 2027. Your registration has been received. Your slot will be confirmed after your registration and payment have been verified.';
  const details = `Friday, November 27, 2026\n1907, One Park Drive, BGC, Taguig\nFee: ₱1,000 per head\nParticipants: ${entry.participants}\nReference: ${entry.id}`;
  const paymentText = link ? `\n\nTo complete your registration, pay ₱1,000 via GCash or bank transfer and upload your receipt using your private link:\n${link}` : '';
  const paymentHtml = link ? `
    <tr><td style="padding:24px 24px 4px">
      <p style="margin:0 0 8px;font:bold 18px/1.4 Arial,sans-serif">Complete your registration</p>
      <p style="margin:0 0 16px">Pay ₱1,000 via GCash or bank transfer, then upload your receipt using your private link.</p>
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td bgcolor="#ffcc01" style="border-radius:8px">
          <a href="${escape(link)}" style="display:block;padding:14px 18px;color:#000f13;font-weight:bold;text-decoration:none">View payment instructions</a>
        </td>
      </tr></table>
    </td></tr>` : '';
  const eventRows = [
    ['Date', 'Friday, November 27, 2026'],
    ['Venue', '1907, One Park Drive, BGC, Taguig'],
    ['Workshop fee', '₱1,000 per head'],
    ['Participants', entry.participants],
  ].map(([label, value]) => `<tr>
    <td valign="top" style="padding:7px 14px 7px 0;color:#485658;font-size:14px">${label}</td>
    <td valign="top" style="padding:7px 0;font-weight:bold;font-size:14px">${escape(value)}</td>
  </tr>`).join('');
  return {
    subject: approved ? 'Your Brand Audit registration is confirmed' : 'We received your Brand Audit registration',
    text: `Hi ${entry.full_name},\n\n${message}\n\n${details}${paymentText}\n\nQuestions? Reply to this email.\nJG Worldwide`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;background:#f4f5f1;color:#000f13">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f5f1" style="width:100%">
        <tr><td align="center" style="padding:24px 12px">
          <!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;border-top:6px solid #ffcc01;color:#000f13;font:16px/1.55 Arial,sans-serif;text-align:left">
            <tr><td style="padding:24px 24px 0"><img src="${jgwLogo}" width="152" alt="JG Worldwide" style="display:block;width:152px;height:auto;border:0;color:#000f13;font-weight:bold"></td></tr>
            <tr><td style="padding:24px 24px 0">
              <h1 style="margin:0 0 16px;font:bold 30px/1.15 Georgia,serif;color:#000f13">${heading}</h1>
              <p style="margin:0 0 8px">Hi ${escape(entry.full_name)},</p>
              <p style="margin:0">${escape(message)}</p>
            </td></tr>
            ${paymentHtml}
            <tr><td style="padding:24px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f5f1" style="width:100%;border-radius:8px"><tr>
                <td style="padding:16px">
                  <p style="margin:0 0 4px;font:bold 18px/1.4 Arial,sans-serif">Workshop details</p>
                  <table role="presentation" cellpadding="0" cellspacing="0">${eventRows}</table>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="border-top:1px solid #c9d0ce;padding:16px 24px 24px;color:#485658;font-size:13px;overflow-wrap:anywhere">
              <p style="margin:0 0 6px">Reference: ${escape(entry.id)}</p>
              <p style="margin:0">Questions? Reply to this email.</p>
            </td></tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td></tr>
      </table>
    </body></html>`,
  };
}

export async function deliverEmail(client, registrationId, kind, { transport, configured = emailConfigured() } = {}) {
  if (!configured) return { status: 'not_configured' };
  const claimed = await client.rpc('claim_brand_audit_email', { registration: registrationId, email_kind: kind });
  if (claimed.error) throw new Error('email_queue_unavailable');
  const job = claimed.data?.[0];
  if (!job) return { status: 'already_sent_or_busy' };
  let accepted = false;
  try {
    const { data: entry, error } = await client.from('brand_audit_registrations').select('*').eq('id', registrationId).single();
    if (error || !entry || (kind === 'approval' && entry.payment_status !== 'approved')) throw new Error('email_registration_unavailable');
    const sender = transport ?? nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
    });
    const result = await sender.sendMail({
      from: { name: 'JG Worldwide', address: process.env.GMAIL_USER },
      replyTo: process.env.GMAIL_USER,
      to: entry.email,
      messageId: `<brand-audit-${job.id}@jgworldwide.ph>`,
      ...registrationMessage(entry, kind),
    });
    if (!result.accepted?.length) throw new Error('email_not_accepted');
    accepted = true;
    const saved = await client.from('brand_audit_email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id).eq('lease_token', job.lease_token);
    if (saved.error) return { status: 'delivery_uncertain' };
    return { status: 'sent' };
  } catch {
    if (!accepted) await client.from('brand_audit_email_outbox').update({ status: 'failed', last_error: 'Sending failed. Check Gmail settings or sending limits, then retry.' }).eq('id', job.id).eq('lease_token', job.lease_token);
    return { status: accepted ? 'delivery_uncertain' : 'failed' };
  }
}
