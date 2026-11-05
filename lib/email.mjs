import nodemailer from 'nodemailer';

export function emailConfigured() { return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD); }
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

export function registrationMessage(entry, kind) {
  const approved = kind === 'approval';
  const heading = approved ? 'Your registration is confirmed.' : 'Registration received.';
  const message = approved
    ? 'Your payment has been reviewed and approved. Your slot for Brand Audit: Let’s Get You Ready for 2027 is confirmed.'
    : 'Thank you for registering for Brand Audit: Let’s Get You Ready for 2027. Your registration has been received. Your slot will be confirmed after your registration and payment have been verified.';
  const details = `Friday, November 27, 2026\n1907, One Park Drive, BGC, Taguig\nFee: ₱1,000 per head\nParticipants: ${entry.participants}\nReference: ${entry.id}`;
  return {
    subject: approved ? 'Your Brand Audit registration is confirmed' : 'We received your Brand Audit registration',
    text: `Hi ${entry.full_name},\n\n${message}\n\n${details}\n\nQuestions? Reply to this email.\nJG Worldwide`,
    html: `<div style="background:#f4f5f1;padding:32px 16px;font-family:Arial,sans-serif;color:#000f13"><div style="max-width:600px;margin:auto;background:white;border-top:6px solid #ffcc01;padding:32px"><p style="font-weight:bold">JG Worldwide</p><h1 style="font-family:Georgia,serif;font-size:30px">${heading}</h1><p>Hi ${escape(entry.full_name)},</p><p style="line-height:1.7">${escape(message)}</p><div style="white-space:pre-line;background:#f4f5f1;padding:20px;line-height:1.7">${escape(details)}</div><p style="line-height:1.7">Questions? Reply to this email.</p></div></div>`,
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
