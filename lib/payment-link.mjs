import { createHmac, timingSafeEqual } from 'node:crypto';

function signature(id) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Payment links are not configured.');
  return createHmac('sha256', secret).update(`brand-audit-payment:v1:${id}`).digest();
}

export function paymentUrl(id) {
  const origin = process.env.BRAND_AUDIT_PUBLIC_URL || 'https://jgw-website-server.vercel.app';
  return new URL(`/pay/${id}.${signature(id).toString('hex')}`, origin).href;
}

export function paymentRegistrationId(token) {
  const match = /^([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.([0-9a-f]{64})$/.exec(token);
  if (!match || !process.env.SUPABASE_SECRET_KEY) return null;
  return timingSafeEqual(signature(match[1]), Buffer.from(match[2], 'hex')) ? match[1] : null;
}

export const gcashQr = 'https://cdn.prod.website-files.com/654879169973ca2687439f30/6aeaed1707e61507e442eaae_viber_image_2026-11-04_16-21-06-517.jpg';
