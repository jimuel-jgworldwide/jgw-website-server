import { randomUUID } from 'node:crypto';
import { InputError, parseRegistration, validateProof } from './registration.mjs';

const BUCKET = 'brand-audit-proofs';
const TABLE = 'brand_audit_registrations';
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

function isAllowed(request, allowedOrigins) {
  const origin = request.headers.get('origin');
  return origin && allowedOrigins.has(origin) ? origin : null;
}

function response(status, body, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

export function handleOptions(request, allowedOrigins) {
  const origin = isAllowed(request, allowedOrigins);
  if (!origin) return response(403, { error: 'Origin not allowed.' }, null);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    },
  });
}

export async function handleRegistration(request, { allowedOrigins, getClient, afterSave, logError = console.error }) {
  const origin = isAllowed(request, allowedOrigins);
  if (!origin) return response(403, { error: 'Origin not allowed.' }, null);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) {
    return response(415, { error: 'Please submit the form with a file-capable request.' }, origin);
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return response(413, { error: 'The submission is too large. Use a receipt under 3 MB.' }, origin);
  }

  let savedPath = null;
  let client = null;
  try {
    const form = await request.formData();
    // Quietly discard automated submissions that fill this hidden field.
    if (form.get('company_website')) {
      return response(201, { ok: true, registrationId: randomUUID() }, origin);
    }
    const { data, proof } = parseRegistration(form);
    const verifiedProof = await validateProof(proof);
    client = getClient();
    const id = randomUUID();

    if (verifiedProof) {
      savedPath = `${id}/${randomUUID()}.${verifiedProof.extension}`;
      const { error } = await client.storage.from(BUCKET).upload(
        savedPath,
        verifiedProof.buffer,
        { contentType: verifiedProof.mimeType, upsert: false },
      );
      if (error) throw new Error('proof_upload_failed');
    }

    const { error } = await client.from(TABLE).insert({
      id,
      ...data,
      proof_path: savedPath,
    });
    if (error) throw new Error('registration_insert_failed');
    if (afterSave) {
      try { await afterSave(client, id); }
      catch { logError('Brand Audit receipt email is queued or needs attention.'); }
    }
    return response(201, { ok: true, registrationId: id }, origin);
  } catch (error) {
    if (savedPath && client) {
      try {
        const { error: cleanupError } = await client.storage.from(BUCKET).remove([savedPath]);
        if (cleanupError) logError('Brand Audit receipt cleanup failed:', cleanupError.message);
      } catch {
        logError('Brand Audit receipt cleanup failed.');
      }
    }
    if (error instanceof InputError) {
      return response(400, { error: error.message }, origin);
    }
    logError('Brand Audit submission failed:', error instanceof Error ? error.message : 'unknown');
    return response(500, { error: 'We could not save your registration. Please try again.' }, origin);
  }
}
