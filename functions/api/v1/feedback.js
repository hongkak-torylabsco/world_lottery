import { categories, languages, readJson, reply, validId } from '../../../lib/feedback-http.js';

async function allowSubmission(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.TURNSTILE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bucket = Math.floor(Date.now() / 600000);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode('feedback-rate:' + bucket + ':' + ip));
  const identifier = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const db = env.FEEDBACK_DB;
  const [result] = await db.batch([
    db.prepare(
      `INSERT INTO feedback_rate (identifier, bucket, hits) VALUES (?, ?, 1)
       ON CONFLICT(identifier, bucket) DO UPDATE SET hits = hits + 1 WHERE hits < 10`
    ).bind(identifier, bucket),
    db.prepare('DELETE FROM feedback_rate WHERE bucket < ?').bind(bucket - 1)
  ]);
  return result.meta.changes > 0;
}
const types = new Set(['feedback', 'question']);
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const hostnames = (env.TURNSTILE_HOSTNAMES ?? '').split(',').map(host => host.trim());
  const configured = env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET && hostnames.includes(url.hostname);
  if (request.method === 'GET') {
    return configured ? reply(200, { siteKey: env.TURNSTILE_SITE_KEY }) : reply(503, { error: 'service_unavailable' });
  }
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
  if (request.headers.get('Origin') !== url.origin) return reply(403, { error: 'forbidden' });
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply(415, { error: 'unsupported_media_type' });
  }
  if (!request.body) return reply(400, { error: 'invalid_submission' });

  let data;
  try {
    data = await readJson(request.body);
  } catch {
    return reply(400, { error: 'invalid_submission' });
  }
  if (data === undefined) return reply(413, { error: 'payload_too_large' });

  const { id, type, lang, message, email, website, turnstileToken, category = 'general', title = '' } = data ?? {};
  if (!validId(id)
    || !types.has(type) || !languages.has(lang) || !categories.has(category) || website !== ''
    || typeof title !== 'string' || title.length > 150 || title.includes('\0')
    || typeof message !== 'string' || !message.trim() || message.length > 3000 || message.includes('\0')
    || typeof email !== 'string' || email.length > 254
    || email.includes('\0')
    || (email.trim() && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*$/.test(email.trim()))) {
    return reply(400, { error: 'invalid_submission' });
  }

  if (!configured) return reply(503, { error: 'service_unavailable' });
  if (typeof turnstileToken !== 'string' || !turnstileToken || turnstileToken.length > 2048) {
    return reply(403, { error: 'verification_failed' });
  }
  try {
    if (!await allowSubmission(request, env)) return reply(429, { error: 'rate_limited' }, { 'Retry-After': '600' });
  } catch {
    console.error('feedback_storage_failed');
    return reply(503, { error: 'service_unavailable' });
  }
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: turnstileToken }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return reply(503, { error: 'service_unavailable' });
    const result = await response.json();
    if (result?.success !== true || result.action !== 'feedback' || result.hostname !== url.hostname) {
      return reply(403, { error: 'verification_failed' });
    }
  } catch {
    return reply(503, { error: 'service_unavailable' });
  }

  try {
    await env.FEEDBACK_DB.prepare(
      `INSERT INTO feedback (id, type, lang, message, email, category, title, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING`
    ).bind(id, type, lang, message.trim(), email.trim() || null, category, title.trim()).run();
    return reply(200, { id });
  } catch {
    console.error('feedback_storage_failed');
    return reply(503, { error: 'service_unavailable' });
  }
}
