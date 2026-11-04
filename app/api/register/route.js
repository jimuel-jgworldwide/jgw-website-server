import { createClient } from '@supabase/supabase-js';
import { handleOptions, handleRegistration } from '../../../lib/handler.mjs';

export const runtime = 'nodejs';

function allowedOrigins() {
  return new Set((process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean));
}

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function OPTIONS(request) {
  return handleOptions(request, allowedOrigins());
}

export async function POST(request) {
  return handleRegistration(request, {
    allowedOrigins: allowedOrigins(),
    getClient: serverClient,
  });
}
