const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { test } = require('node:test');
const { onRequest } = require('../functions/api/v1/feedback.js');
const { onRequest: admin } = require('../functions/api/v1/admin-feedback.js');
const { onRequest: qa } = require('../functions/api/v1/qa.js');
const { onRequest: adminPage } = require('../functions/admin/feedback/index.js');

const origin = 'https://lottery.example';
const fields = { id: 'b71b57d3-42b1-4a03-bf30-308e80cdc424',
  type: 'question', lang: 'ja', message: '  質問です。  ', email: '', website: '', turnstileToken: 'test-token' };

const turnstile = { TURNSTILE_SITE_KEY: 'public-test-key', TURNSTILE_SECRET: 'test-secret',
  TURNSTILE_HOSTNAMES: 'lottery.example' };
const verified = { success: true, hostname: 'lottery.example', action: 'feedback' };

function migrate(db, ...files) {
  for (const file of files) db.exec(readFileSync(require.resolve('../migrations/' + file), 'utf8'));
}

function binding(db) {
  return {
    prepare: sql => ({
      bind: (...args) => ({
        all: () => ({ results: db.prepare(sql).all(...args) }),
        run: () => ({ meta: db.prepare(sql).run(...args) })
      })
    }),
    batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

function database(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  return db;
}

function setup(t) {
  const db = database(t);
  migrate(db, '0001_feedback.sql', '0002_feedback_moderation.sql', '0003_feedback_workflow.sql');
  return db;
}

function siteverify(t, result = verified) {
  return t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(options.body.get('secret'), turnstile.TURNSTILE_SECRET);
    return Response.json(result);
  });
}

function request(data, headers = {}) {
  return new Request(origin + '/api/v1/feedback', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  });
}

test('feedback persists a private, language-tagged submission and retries are idempotent', async t => {
  siteverify(t);
  const db = setup(t);
  const env = { ...turnstile, FEEDBACK_DB: binding(db) };
  const examples = [
    ['ko', 'general', '문의입니다'], ['en', 'bug', 'A question'],
    ['ja', 'rules', '質問です'], ['pt-BR', 'other', 'Uma pergunta']
  ];
  for (const [lang, category, message] of examples) {
    const id = crypto.randomUUID();
    const data = { ...fields, id, lang, category, message, title: '  ' + message + '  ' };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await onRequest({ request: request({ ...data, turnstileToken: crypto.randomUUID() }), env });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { id });
    }
    const rows = db.prepare('SELECT type, lang, category, title, message, email FROM feedback WHERE id = ?').all(id);
    assert.deepEqual(rows.map(row => ({ ...row })), [{ type: 'question', lang, category, title: message, message, email: null }]);
  }
});


test('feedback rejects read access, foreign origins, and invalid or oversized submissions', async () => {
  const env = { get FEEDBACK_DB() { assert.fail('Rejected input reached storage'); } };
  for (const [input, expected] of [
    [new Request(origin + '/api/v1/feedback', { method: 'DELETE' }), 405],
    [request(fields, { Origin: 'https://other.example' }), 403],
    [request(fields, { 'Content-Type': 'text/plain' }), 415],
    [request({ ...fields, type: 'other' }), 400],
    [request({ ...fields, category: 'invalid' }), 400],
    [request({ ...fields, title: 'x'.repeat(151) }), 400],
    [request({ ...fields, message: '   ' }), 400],
    [request({ ...fields, email: 'invalid' }), 400],
    [request({ ...fields, website: 'filled' }), 400],
    [request({ ...fields, message: 'a'.repeat(25000) }), 413]
  ]) {
    assert.equal((await onRequest({ request: input, env })).status, expected);
  }
});

test('feedback reports storage failures without issuing a receipt', async t => {
  siteverify(t);
  const log = t.mock.method(console, 'error', () => {});
  const storage = binding(setup(t));
  const response = await onRequest({ request: request(fields), env: { ...turnstile, FEEDBACK_DB: {
    ...storage,
    prepare(sql) {
      if (sql.includes('INSERT INTO feedback (')) throw new Error('Simulated insert failure');
      return storage.prepare(sql);
    }
  } } });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'service_unavailable' });
  assert.deepEqual(log.mock.calls[0].arguments, ['feedback_storage_failed']);
});

test('feedback exposes only the sitekey and rejects missing, replayed, and mis-scoped Turnstile tokens', async t => {
  const db = setup(t);
  const env = { ...turnstile, FEEDBACK_DB: binding(db) };
  const config = await onRequest({ request: new Request(origin + '/api/v1/feedback'), env });
  assert.deepEqual(await config.json(), { siteKey: turnstile.TURNSTILE_SITE_KEY });
  assert.equal((await onRequest({ request: request(fields), env: {} })).status, 503);
  assert.equal((await onRequest({ request: request({ ...fields, turnstileToken: '' }), env })).status, 403);
  const verify = siteverify(t);
  for (const result of [
    { success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...verified, hostname: 'other.example' },
    { ...verified, action: 'login' }
  ]) {
    verify.mock.mockImplementation(async () => Response.json(result));
    assert.equal((await onRequest({ request: request(fields), env })).status, 403);
  }
  verify.mock.mockImplementation(async () => { throw new Error('network failure'); });
  assert.equal((await onRequest({ request: request(fields), env })).status, 503);
  assert.equal(db.prepare('SELECT count(*) AS n FROM feedback').get().n, 0);
});

test('rate limit is atomic and rejects submissions before Siteverify', async t => {
  const clock = t.mock.method(Date, 'now', () => 600000 * 100);
  const verify = siteverify(t);
  const db = setup(t);
  const env = { ...turnstile, FEEDBACK_DB: binding(db) };
  const submit = ip => onRequest({ request: request({ ...fields, id: crypto.randomUUID() }, { 'CF-Connecting-IP': ip }), env });
  const results = await Promise.all(Array.from({ length: 11 }, () => submit('192.0.2.1')));
  assert.equal(results.filter(response => response.status === 200).length, 10);
  assert.equal(results.find(response => response.status === 429).headers.get('Retry-After'), '600');
  assert.equal(verify.mock.calls.length, 10);
  assert.equal((await submit('192.0.2.2')).status, 200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM feedback_rate').get().n, 2);
  assert.ok(db.prepare('SELECT identifier FROM feedback_rate').all().every(row => !row.identifier.includes('192.0.2')));
  clock.mock.mockImplementation(() => 600000 * 102);
  assert.equal((await submit('192.0.2.1')).status, 200);
  assert.equal(db.prepare('SELECT count(*) AS n FROM feedback_rate').get().n, 1);
});

function access(t) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const issuer = 'https://lottery.cloudflareaccess.com';
  const aud = 'admin-test-audience';
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'local-key' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, issuer + '/cdn-cgi/access/certs');
    assert.equal(options.redirect, 'error');
    return Response.json({ keys: [key] });
  });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  function token(changes = {}, header = {}, wrongSignature = false) {
    const body = encode({ alg: 'RS256', kid: key.kid, ...header }) + '.' +
      encode({ iss: issuer, aud: [aud], exp: Math.floor(Date.now() / 1000) + 300, type: 'app', ...changes });
    const signature = wrongSignature ? 'AAAA' : sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
    return body + '.' + signature;
  }
  return { token, env: { FEEDBACK_ACCESS_ISSUER: issuer, FEEDBACK_ACCESS_AUD: aud } };
}

test('administrator UI and API fail closed for invalid Access assertions', async t => {
  const { token, env } = access(t);
  const endpoint = (handler, path, assertion, config = env) => handler({
    request: new Request(origin + path, { headers: assertion ? { 'Cf-Access-Jwt-Assertion': assertion } : {} }),
    env: config
  });
  const now = Math.floor(Date.now() / 1000);
  for (const assertion of [undefined, 'malformed', token({}, {}, true), token({ aud: ['wrong'] }),
    token({ iss: 'https://another.cloudflareaccess.com' }), token({ exp: now - 1 }),
    token({ exp: null }), token({ nbf: now + 3600 }), token({ type: 'org' }),
    token({}, { alg: 'none' }), token({}, { kid: 'unknown' })]) {
    assert.equal((await endpoint(admin, '/api/v1/admin-feedback', assertion)).status, 401);
    assert.equal((await endpoint(adminPage, '/admin/feedback/', assertion)).status, 401);
  }
  assert.equal((await endpoint(adminPage, '/admin/feedback/', token(), {})).status, 401);
  assert.equal((await endpoint(admin, '/api/v1/admin-feedback', token(), {
    ...env, FEEDBACK_ACCESS_API_AUD: 'different-application'
  })).status, 401);
  const page = await endpoint(adminPage, '/admin/feedback/', token());
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('Cache-Control'), 'private, no-store');
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.match(await page.text(), /id="admin-filter"/);
});

test('additive migration preserves existing private and published records', t => {
  const db = database(t);
  migrate(db, '0001_feedback.sql', '0002_feedback_moderation.sql');
  db.prepare("INSERT INTO feedback (id, type, lang, message, email, status) VALUES (?, 'question', 'ja', 'original', 'private@example.org', 'resolved')").run(fields.id);
  db.prepare("INSERT INTO public_qa (feedback_id, lang, question, answer) VALUES (?, 'en', 'published question', 'published answer')").run(fields.id);
  migrate(db, '0003_feedback_workflow.sql');
  const row = db.prepare('SELECT * FROM feedback').get();
  assert.equal(row.message, 'original');
  assert.equal(row.status, 'resolved');
  assert.equal(row.email, 'private@example.org');
  assert.equal(row.updated_at, row.created_at);
  assert.deepEqual({ ...db.prepare('SELECT id, question, answer, status FROM public_qa').get() },
    { id: 1, question: 'published question', answer: 'published answer', status: 'published' });
});

test('admin workflow gates drafts, separates private fields, and supports search, redaction, and deletion', async t => {
  const db = setup(t);
  const { token, env: config } = access(t);
  const env = { ...config, FEEDBACK_DB: binding(db) };
  const otherId = crypto.randomUUID();
  const insert = db.prepare('INSERT INTO feedback (id, type, lang, message, email, category) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run(fields.id, 'question', 'ja', '<private original>', 'private@example.org', 'rules');
  insert.run(otherId, 'feedback', 'ja', '<private feedback>', null, 'bug');
  const adminUrl = origin + '/api/v1/admin-feedback';
  const assertion = token();
  const list = (query = '') => admin({ request: new Request(adminUrl + query, {
    headers: { 'Cf-Access-Jwt-Assertion': assertion }
  }), env });
  const write = (data, query = '', requestOrigin = origin) => admin({ request: new Request(adminUrl + query, {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Cf-Access-Jwt-Assertion': assertion, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: fields.id, ...data })
  }), env });
  const view = query => qa({ request: new Request(origin + '/api/v1/qa?lang=en' + query), env });
  const publicItems = async (query = '') => (await (await view(query)).json()).items;
  const inbox = await list('?id=' + fields.id);
  assert.equal(inbox.headers.get('Cache-Control'), 'no-store');
  const [item] = (await inbox.json()).items;
  assert.equal(item.email, 'private@example.org');
  assert.equal(item.status, 'new');
  assert.equal((await write({ action: 'status', status: 'resolved' }, '', 'https://other.example')).status, 403);
  assert.equal((await write({ action: 'status', status: 'invalid' })).status, 400);
  assert.equal((await write({ action: 'status', status: 'resolved' })).status, 200);
  assert.equal((await write({ action: 'review', note: 'private note', response: 'private answer' })).status, 200);
  assert.equal((await write({ action: 'review', note: 'a'.repeat(25000), response: '' })).status, 413);
  const search = await write({ action: 'search', q: 'private@example.org' }, '?status=resolved&category=rules');
  const [reviewed] = (await search.json()).items;
  assert.equal(reviewed.internal_note, 'private note');
  assert.equal(reviewed.operator_answer, 'private answer');
  const literal = "' OR 1=1 --";
  assert.deepEqual((await (await write({ action: 'search', q: literal })).json()).items, []);

  const publication = { lang: 'en', question: 'Public question', answer: '  Public answer  ' };
  assert.equal((await write({ ...publication, action: 'draft' })).status, 200);
  assert.deepEqual(await publicItems(), []);
  assert.equal((await view('&id=1')).status, 404);
  assert.equal((await write({ ...publication, action: 'publish', answer: '' })).status, 400);
  assert.equal((await write({ ...publication, action: 'publish', id: otherId })).status, 404);
  assert.equal((await write({ ...publication, action: 'publish' })).status, 200);
  const [published] = await publicItems('&category=rules&q=PUBLIC');
  assert.deepEqual(published, { id: 1, category: 'rules', question: 'Public question', answer: 'Public answer',
    published_at: published.published_at });
  assert.deepEqual(await publicItems('&category=bug'), []);
  assert.deepEqual(await publicItems('&q=' + encodeURIComponent(literal)), []);
  assert.deepEqual(await publicItems('&offset=20'), []);
  assert.deepEqual((await (await view('&id=1')).json()).item, published);
  assert.equal((await write({ action: 'unpublish' })).status, 200);
  assert.equal((await view('&id=1')).status, 404);
  assert.deepEqual(await publicItems(), []);
  assert.equal((await write({ ...publication, action: 'publish', answer: 'Edited public answer' })).status, 200);
  assert.equal((await publicItems())[0].answer, 'Edited public answer');
  assert.equal((await write({ action: 'redact', includeMessage: false })).status, 200);
  const retained = db.prepare('SELECT status, message, email FROM feedback WHERE id = ?').get(fields.id);
  assert.deepEqual({ ...retained }, { status: 'resolved', message: '<private original>', email: null });
  assert.equal((await write({ action: 'redact', includeMessage: true })).status, 200);
  const cleared = db.prepare('SELECT message, internal_note, operator_answer FROM feedback WHERE id = ?').get(fields.id);
  assert.deepEqual({ ...cleared }, { message: '', internal_note: '', operator_answer: '' });
  assert.equal((await write({ action: 'delete' })).status, 200);
  assert.equal((await view('&id=1')).status, 404);
  assert.deepEqual((await (await list('?id=' + fields.id)).json()).items, []);
});

test('public Q&A paginates published answers within the selected language', async t => {
  const db = setup(t);
  const feedback = db.prepare("INSERT INTO feedback (id, type, lang, message) VALUES (?, 'question', ?, 'private')");
  const publication = db.prepare(
    "INSERT INTO public_qa (feedback_id, lang, question, answer, status) VALUES (?, ?, ?, 'answer', ?)"
  );
  for (let index = 1; index <= 23; index++) {
    const id = crypto.randomUUID();
    const language = index === 22 ? 'en' : 'pt-BR';
    feedback.run(id, language);
    publication.run(id, language, 'Question ' + index, index === 23 ? 'draft' : 'published');
  }
  const env = { FEEDBACK_DB: binding(db) };
  const page = async offset => {
    const request = new Request(origin + '/api/v1/qa?lang=pt-BR&offset=' + offset);
    return (await qa({ request, env })).json();
  };
  const first = await page(0);
  assert.equal(first.more, true);
  assert.equal(first.items.length, 20);
  assert.equal(first.items[0].id, 21);
  const second = await page(20);
  assert.equal(second.more, false);
  assert.deepEqual(second.items.map(item => item.id), [1]);
});
