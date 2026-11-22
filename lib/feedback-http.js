const maxBodyBytes = 24 * 1024;
export const languages = new Set(['ko', 'en', 'ja', 'pt-BR']);
export const categories = new Set(['general', 'bug', 'rules', 'other']);

export function validId(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
}

export function pageOffset(url) {
  const raw = url.searchParams.get('offset') ?? '0';
  return /^\d{1,7}$/.test(raw) ? Number(raw) : null;
}
export function reply(status, body, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

export async function readJson(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let json = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(json + decoder.decode());
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        return undefined;
      }
      json += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
