import { categories, languages, pageOffset, reply } from '../../../lib/feedback-http.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' }, { Allow: 'GET' });
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'ko';
  const offset = pageOffset(url);
  const category = url.searchParams.get('category') || '';
  const search = (url.searchParams.get('q') || '').trim();
  const id = url.searchParams.get('id');
  if (!languages.has(lang) || offset === null || (category && !categories.has(category))
    || search.length > 100 || (id !== null && !/^[1-9]\d{0,14}$/.test(id))) {
    return reply(400, { error: 'invalid_query' });
  }
  try {
    const { results } = await env.FEEDBACK_DB.prepare(
      `SELECT id, category, question, answer, published_at FROM public_qa
       WHERE status = 'published' AND lang = ?1 AND (?2 = '' OR category = ?2)
         AND (?3 = '' OR instr(lower(question), lower(?3)) OR instr(lower(answer), lower(?3)))
         AND (?4 IS NULL OR id = ?4)
       ORDER BY id DESC LIMIT 21 OFFSET ?5`
    ).bind(lang, category, search, id === null ? null : Number(id), id === null ? offset : 0).all();
    if (id !== null) return results.length ? reply(200, { item: results[0] }) : reply(404, { error: 'not_found' });
    return reply(200, { items: results.slice(0, 20), more: results.length > 20 });
  } catch {
    console.error('public_qa_storage_failed');
    return reply(503, { error: 'service_unavailable' });
  }
}
