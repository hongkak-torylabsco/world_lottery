import { authorized } from '../../../lib/feedback-access.js';
import { categories, languages, pageOffset, readJson, reply, validId } from '../../../lib/feedback-http.js';

const statuses = new Set(['new', 'in_progress', 'resolved']);

async function list(url, db, input = '') {
  const offset = pageOffset(url);
  const id = url.searchParams.get('id');
  const status = url.searchParams.get('status') || '';
  const category = url.searchParams.get('category') || '';
  const search = typeof input === 'string' ? input.trim() : null;
  if (offset === null || (id !== null && !validId(id)) || (status && !statuses.has(status))
    || (category && !categories.has(category)) || search === null || search.length > 100) {
    return reply(400, { error: 'invalid_query' });
  }
  const { results } = await db.prepare(
    `SELECT f.*, q.lang AS public_lang, q.question, q.answer, q.status AS publication
     FROM feedback f LEFT JOIN public_qa q ON q.feedback_id = f.id
     WHERE (?1 IS NULL OR f.id = ?1) AND (?2 = '' OR f.status = ?2)
       AND (?3 = '' OR f.category = ?3)
       AND (?4 = '' OR instr(lower(f.title), lower(?4)) OR instr(lower(f.message), lower(?4))
         OR instr(lower(coalesce(f.email, '')), lower(?4)) OR instr(f.id, ?4))
     ORDER BY f.created_at DESC, f.id DESC LIMIT 21 OFFSET ?5`
  ).bind(id, status, category, search, offset).all();
  return reply(200, { items: results.slice(0, 20), more: results.length > 20 });
}

function text(value, limit, required = false) {
  return typeof value === 'string' && !value.includes('\0') && value.length <= limit && (!required || value.trim());
}

function change(db, { id, action, status, lang, question, answer, note, response, includeMessage }) {
  switch (action) {
    case 'status':
      if (statuses.has(status)) return db.prepare(
        'UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(status, id);
      break;
    case 'review':
      if (text(note, 3000) && text(response, 3000)) return db.prepare(
        'UPDATE feedback SET internal_note = ?, operator_answer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(note.trim(), response.trim(), id);
      break;
    case 'delete':
      return db.prepare('DELETE FROM feedback WHERE id = ?').bind(id);
    case 'redact':
      if (typeof includeMessage === 'boolean') return db.prepare(
        `UPDATE feedback SET email = NULL, title = CASE WHEN ?1 THEN '' ELSE title END,
           message = CASE WHEN ?1 THEN '' ELSE message END,
           internal_note = CASE WHEN ?1 THEN '' ELSE internal_note END,
           operator_answer = CASE WHEN ?1 THEN '' ELSE operator_answer END,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?2`
      ).bind(Number(includeMessage), id);
      break;
    case 'unpublish':
      return db.prepare(
        "UPDATE public_qa SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE feedback_id = ?"
      ).bind(id);
    case 'draft':
    case 'publish':
      if (languages.has(lang) && text(question, 500, true) && text(answer, 3000, true)) return db.prepare(
        `INSERT INTO public_qa (feedback_id, lang, category, question, answer, status, created_at, updated_at)
         SELECT id, ?1, category, ?2, ?3, ?4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         FROM feedback WHERE id = ?5 AND type = 'question'
         ON CONFLICT(feedback_id) DO UPDATE SET lang = excluded.lang, category = excluded.category,
           question = excluded.question, answer = excluded.answer, status = excluded.status,
           published_at = CASE WHEN excluded.status = 'published' AND public_qa.status = 'draft'
             THEN CURRENT_TIMESTAMP ELSE public_qa.published_at END, updated_at = CURRENT_TIMESTAMP
         WHERE excluded.status = 'published' OR public_qa.status = 'draft'`
      ).bind(lang, question.trim(), answer.trim(), action === 'publish' ? 'published' : 'draft', id);
  }
}

export async function onRequest({ request, env }) {
  if (!await authorized(request, env, env.FEEDBACK_ACCESS_API_AUD || env.FEEDBACK_ACCESS_AUD)) {
    return reply(401, { error: 'unauthorized' });
  }
  const url = new URL(request.url);
  const db = env.FEEDBACK_DB;
  try {
    if (request.method === 'GET') return await list(url, db);
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
    if (request.headers.get('Origin') !== url.origin) return reply(403, { error: 'forbidden' });
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, { error: 'unsupported_media_type' });
    }
    if (!request.body) return reply(400, { error: 'invalid_change' });
    let data;
    try {
      data = await readJson(request.body);
    } catch {
      return reply(400, { error: 'invalid_change' });
    }
    if (data === undefined) return reply(413, { error: 'payload_too_large' });
    if (data?.action === 'search') return await list(url, db, data.q);
    if (!validId(data?.id)) return reply(400, { error: 'invalid_change' });
    const statement = change(db, data);
    if (!statement) return reply(400, { error: 'invalid_change' });
    const result = await statement.run();
    return result.meta.changes ? reply(200, { success: true }) : reply(404, { error: 'not_found' });
  } catch {
    console.error('feedback_admin_storage_failed');
    return reply(503, { error: 'service_unavailable' });
  }
}
