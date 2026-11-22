const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { test } = require('node:test');
const { onRequest } = require('../functions/api/v1/feedback.js');
const { onRequest: admin } = require('../functions/api/v1/admin-feedback.js');
const { onRequest: qa } = require('../functions/api/v1/qa.js');
const { onRequest: adminPage } = require('../functions/admin/feedback/index.js');
const { default: retention } = require('../workers/feedback-retention/index.js');

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
        all: () => ({ success: true, results: db.prepare(sql).all(...args) }),
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
  migrate(db, '0001_feedback.sql', '0002_feedback_moderation.sql', '0003_feedback_workflow.sql',
    '0004_feedback_retention.sql');
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
  const email = 'operator@example.test';
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'local-key' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, issuer + '/cdn-cgi/access/certs');
    assert.equal(options.redirect, 'manual');
    return Response.json({ keys: [key] });
  });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  function token(changes = {}, header = {}, wrongSignature = false) {
    const body = encode({ alg: 'RS256', kid: key.kid, ...header }) + '.' +
      encode({ iss: issuer, aud: [aud], email, exp: Math.floor(Date.now() / 1000) + 300, type: 'app', ...changes });
    const signature = wrongSignature ? 'AAAA' : sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url');
    return body + '.' + signature;
  }
  return { token, env: { FEEDBACK_ACCESS_ISSUER: issuer, FEEDBACK_ACCESS_AUD: aud, FEEDBACK_ACCESS_ADMIN_EMAIL: email } };
}

test('administrator UI and API fail closed for invalid Access assertions', async t => {
  const { token, env } = access(t);
  const endpoint = (handler, path, assertion, config = env) => handler({
    request: new Request(origin + path, { headers: assertion ? { 'Cf-Access-Jwt-Assertion': assertion } : {} }),
    env: config
  });
  const now = Math.floor(Date.now() / 1000);
  for (const assertion of [undefined, 'malformed', token({}, {}, true), token({ aud: ['wrong'] }),
    token({ email: 'another@example.test' }), token({ email: undefined }),
    token({ iss: 'https://another.cloudflareaccess.com' }), token({ exp: now - 1 }),
    token({ exp: null }), token({ nbf: now + 3600 }), token({ type: 'org' }),
    token({}, { alg: 'none' }), token({}, { kid: 'unknown' })]) {
    assert.equal((await endpoint(admin, '/api/v1/admin-feedback', assertion)).status, 401);
    assert.equal((await endpoint(adminPage, '/admin/feedback/', assertion)).status, 401);
  }
  assert.equal((await endpoint(adminPage, '/admin/feedback/', token(), {})).status, 401);
  assert.equal((await endpoint(adminPage, '/admin/feedback/', token(), {
    ...env, FEEDBACK_ACCESS_ADMIN_EMAIL: undefined
  })).status, 401);
  assert.equal((await endpoint(admin, '/api/v1/admin-feedback', token(), {
    ...env, FEEDBACK_ACCESS_API_AUD: 'different-application'
  })).status, 401);
  const page = await endpoint(adminPage, '/admin/feedback/', token());
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('Cache-Control'), 'private, no-store');
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.match(await page.text(), /id="admin-filter"/);
  fetch.mock.mockImplementation(async () => Response.redirect('https://untrusted.example/certs'));
  assert.equal((await endpoint(adminPage, '/admin/feedback/', token())).status, 401);
});

test('administrator HTML and API accept only the audience for the actual production request URL', async t => {
  const { token, env } = access(t);
  const deploymentAudience = 'deployment-application';
  const config = { ...env, FEEDBACK_ACCESS_DEPLOYMENT_AUD: deploymentAudience, FEEDBACK_DB: binding(setup(t)) };
  const base = 'https://world-lottery-admin.pages.dev';
  const hash = 'https://7b786eff.world-lottery-admin.pages.dev';
  const defaultToken = token();
  const deploymentToken = token({ aud: [deploymentAudience] });
  const assertionWithBoth = token({ aud: [env.FEEDBACK_ACCESS_AUD, deploymentAudience] });
  for (const [handler, path] of [[adminPage, '/admin/feedback'], [admin, '/api/v1/admin-feedback']]) {
    const request = (origin, assertion, bindings = config) => handler({
      request: new Request(origin + path, {
        headers: {
          'Cf-Access-Jwt-Assertion': assertion,
          Host: '7b786eff.world-lottery-admin.pages.dev',
          'X-Forwarded-Host': 'world-lottery-admin.pages.dev'
        }
      }),
      env: bindings
    });
    assert.equal((await request(base, defaultToken)).status, 200);
    assert.equal((await request(hash, deploymentToken)).status, 200);
    assert.equal((await request('https://a-branch.world-lottery-admin.pages.dev', deploymentToken)).status, 200);
    assert.equal((await request(base, deploymentToken)).status, 401);
    assert.equal((await request(hash, defaultToken)).status, 401);
    assert.equal((await request(base, assertionWithBoth)).status, 401);
    assert.equal((await request(hash, assertionWithBoth)).status, 401);
    assert.equal((await request('https://world-lottery-admin.pages.dev.example.org', defaultToken)).status, 401);
    assert.equal((await request('https://nested.a.world-lottery-admin.pages.dev', deploymentToken)).status, 401);
    assert.equal((await request('http://world-lottery-admin.pages.dev', defaultToken)).status, 401);
    assert.equal((await request(base + ':8443', defaultToken)).status, 401);
    assert.equal((await request(base, defaultToken, { ...config, FEEDBACK_ACCESS_DEPLOYMENT_AUD: undefined })).status, 401);
    assert.equal((await request(hash, defaultToken, { ...config, FEEDBACK_ACCESS_DEPLOYMENT_AUD: env.FEEDBACK_ACCESS_AUD })).status, 401);
    assert.equal((await request(hash, defaultToken, { ...config, FEEDBACK_ACCESS_API_AUD: env.FEEDBACK_ACCESS_AUD })).status, 401);
  }
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

  const publication = { lang: 'en', question: 'Public question', answer: '  Public answer  ', privacyReviewed: true };
  assert.equal((await write({ ...publication, action: 'draft' })).status, 200);
  assert.deepEqual(await publicItems(), []);
  assert.equal((await view('&id=1')).status, 404);
  assert.equal((await write({ ...publication, action: 'publish', answer: '' })).status, 400);
  assert.equal((await write({ ...publication, action: 'publish', id: otherId })).status, 409);
  assert.equal((await write({ ...publication, action: 'publish', privacyReviewed: false })).status, 422);
  for (const question of ['private＠example.org', fields.id, 'Call +82 10-1234-5678']) {
    assert.equal((await write({ ...publication, action: 'publish', question })).status, 422);
  }
  assert.equal((await write({ ...publication, action: 'publish', answer: '<private original> copied' })).status, 409);
  assert.deepEqual(await publicItems(), []);
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
  assert.equal((await view('&id=1')).status, 200);
  assert.deepEqual((await (await list('?id=' + fields.id)).json()).items, []);
  const independent = (await (await list('?view=independent')).json()).items;
  assert.equal(independent[0].id, 1);
  assert.equal(independent[0].feedback_id, undefined);
  assert.equal((await write({ ...publication, id: 1, action: 'editIndependent', privacyReviewed: false })).status, 422);
  assert.equal((await write({ ...publication, id: 1, action: 'editIndependent', answer: 'Independent answer' })).status, 200);
  assert.equal((await (await view('&id=1')).json()).item.answer, 'Independent answer');
  assert.equal((await write({ action: 'removeIndependent', id: 1 })).status, 200);
  assert.equal((await view('&id=1')).status, 404);
  insert.run(fields.id, 'question', 'en', 'expired original', null, 'general');
  db.prepare("UPDATE feedback SET created_at = '2020-01-01 00:00:00' WHERE id = ?").run(fields.id);
  assert.deepEqual((await (await list('?id=' + fields.id)).json()).items, []);
  assert.equal((await write({ ...publication, action: 'publish' })).status, 409);
  assert.equal((await write({ action: 'review', note: '', response: '' })).status, 404);
  assert.equal((await write({ action: 'delete' })).status, 200);
});

test('public Q&A paginates published answers within the selected language', async t => {
  const db = setup(t);
  const feedback = db.prepare("INSERT INTO feedback (id, type, lang, message) VALUES (?, 'question', ?, 'private')");
  const publication = db.prepare(
    "INSERT INTO public_qa (feedback_id, lang, question, answer, status, privacy_reviewed_at) VALUES (?, ?, ?, 'answer', ?, ?)"
  );
  for (let index = 1; index <= 23; index++) {
    const id = crypto.randomUUID();
    const language = index === 22 ? 'en' : 'pt-BR';
    feedback.run(id, language);
    publication.run(id, language, 'Question ' + index, index === 23 ? 'draft' : 'published',
      index === 23 ? null : '2026-11-22 00:00:00');
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

test('retention migration preserves legacy content and makes only reviewed publications eligible to survive deletion', async t => {
  const db = database(t);
  migrate(db, '0001_feedback.sql', '0002_feedback_moderation.sql', '0003_feedback_workflow.sql');
  db.exec(`
    INSERT INTO feedback (id, type, lang, message, created_at) VALUES
      ('legacy', 'question', 'en', 'original', '2024-02-29 12:34:56'),
      ('future', 'question', 'en', 'another', '2025-02-28 12:34:56');
    INSERT INTO public_qa (id, feedback_id, lang, question, answer)
      VALUES (7, 'legacy', 'en', 'Legacy question', 'Legacy answer'),
             (42, 'future', 'en', 'Deleted question', 'Deleted answer');
    DELETE FROM public_qa WHERE id = 42;
  `);
  migrate(db, '0004_feedback_retention.sql');
  assert.equal(db.prepare("SELECT expires_at FROM feedback WHERE id = 'legacy'").get().expires_at, '2025-02-28 12:34:56');
  assert.deepEqual({ ...db.prepare('SELECT id, question, status, privacy_reviewed_at FROM public_qa').get() },
    { id: 7, question: 'Legacy question', status: 'draft', privacy_reviewed_at: null });
  assert.equal(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'public_qa'").get().seq, 42);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  const response = await qa({ request: new Request(origin + '/api/v1/qa?lang=en'), env: { FEEDBACK_DB: binding(db) } });
  assert.deepEqual((await response.json()).items, []);
  assert.throws(() => db.exec("UPDATE public_qa SET feedback_id = 'missing' WHERE id = 7"), /FOREIGN KEY/);
  assert.throws(() => db.exec("UPDATE public_qa SET status = 'published' WHERE id = 7"), /CHECK/);
});

test('scheduled retention uses UTC anniversaries, including leap day and the exact expiry boundary', async t => {
  const db = setup(t);
  const receipts = [
    ['ordinary', '2024-02-28 00:00:00', '2025-02-28 00:00:00'],
    ['leap', '2024-02-29 00:00:00', '2025-02-28 00:00:00'],
    ['just-after', '2024-02-29 00:00:01', '2025-02-28 00:00:01'],
    ['future-receipt', '2026-03-01 00:00:00', '2027-03-01 00:00:00']
  ];
  const insert = db.prepare(
    "INSERT INTO feedback (id, type, lang, message, created_at) VALUES (?, 'question', 'en', 'synthetic', ?)"
  );
  for (const [id, received, expiry] of receipts) {
    insert.run(id, received);
    assert.equal(db.prepare('SELECT expires_at FROM feedback WHERE id = ?').get(id).expires_at, expiry);
  }
  const log = t.mock.method(console, 'log', () => {});
  const env = { FEEDBACK_DB: binding(db) };
  const run = timestamp => retention.scheduled({ scheduledTime: Date.parse(timestamp) }, env);
  const ids = () => db.prepare('SELECT id FROM feedback ORDER BY id').all().map(row => row.id);
  await run('2025-02-28T08:59:59.999+09:00');
  assert.deepEqual(ids(), receipts.map(([id]) => id).sort());
  await run('2025-02-28T09:00:00+09:00');
  assert.deepEqual(ids(), ['future-receipt', 'just-after']);
  await run('2025-02-28T00:00:01Z');
  assert.deepEqual(ids(), ['future-receipt']);
  assert.deepEqual(log.mock.calls.map(call => call.arguments[0]), [0, 2, 1].map(deleted => ({ deleted, code: 'ok' })));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('scheduled retention bounds batches and atomically detaches reviewed publications before deleting private records', async t => {
  const db = setup(t);
  db.exec(`
    INSERT INTO feedback (id, type, lang, title, message, email, internal_note, operator_answer, created_at) VALUES
      ('reviewed', 'question', 'en', 'private title', 'private original', 'private@example.test', 'private note', 'private reply', '2025-11-22 10:00:00'),
      ('draft', 'question', 'en', '', 'private original', NULL, '', '', '2025-11-22 10:00:00'),
      ('fresh', 'question', 'en', '', 'still retained', NULL, '', '', '2025-11-22 10:00:01');
    INSERT INTO public_qa (id, feedback_id, lang, category, question, answer, status, privacy_reviewed_at) VALUES
      (1, 'reviewed', 'en', 'general', 'Public question', 'Public answer', 'published', CURRENT_TIMESTAMP),
      (2, 'draft', 'en', 'general', 'private draft', 'Draft answer', 'draft', NULL);
    WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < 1001)
    INSERT INTO feedback (id, type, lang, message, created_at)
      SELECT 'z' || n, 'feedback', 'en', 'private bulk', '2025-11-22 10:00:00' FROM numbers;
    CREATE TRIGGER simulated_delete_error AFTER DELETE ON feedback WHEN OLD.id = 'reviewed'
    BEGIN SELECT RAISE(ABORT, 'private failure detail'); END;
  `);
  const storage = binding(db);
  const prepare = t.mock.method(storage, 'prepare');
  const log = t.mock.method(console, 'log', () => {});
  const error = t.mock.method(console, 'error', () => {});
  const run = () => retention.scheduled({ scheduledTime: Date.parse('2026-11-22T10:00:00Z') }, { FEEDBACK_DB: storage });
  await assert.rejects(run, /^Error: feedback_retention_failed$/);
  assert.deepEqual(error.mock.calls[0].arguments, [{ deleted: 0, code: 'feedback_retention_failed' }]);
  assert.equal(db.prepare('SELECT feedback_id FROM public_qa WHERE id = 1').get().feedback_id, 'reviewed');
  assert.equal(db.prepare('SELECT count(*) AS count FROM feedback').get().count, 1004);
  db.exec('DROP TRIGGER simulated_delete_error');
  const beforeFirstRun = prepare.mock.callCount();
  await run();
  assert.equal(prepare.mock.callCount() - beforeFirstRun, 10);
  assert.equal(db.prepare('SELECT count(*) AS count FROM feedback').get().count, 4);
  await run();
  await run();
  assert.deepEqual(log.mock.calls.map(call => call.arguments[0]),
    [1000, 3, 0].map(deleted => ({ deleted, code: 'ok' })));
  assert.deepEqual(db.prepare('SELECT id FROM feedback').all().map(row => row.id), ['fresh']);
  assert.deepEqual(db.prepare('SELECT id, feedback_id FROM public_qa').all().map(row => ({ ...row })),
    [{ id: 1, feedback_id: null }]);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  const view = async query => (await qa({
    request: new Request(origin + '/api/v1/qa?lang=en' + query),
    env: { FEEDBACK_DB: storage }
  })).json();
  const [{ items }, { item }] = await Promise.all([view(''), view('&id=1')]);
  assert.deepEqual(items, [item]);
  assert.equal(item.answer, 'Public answer');
  assert.doesNotMatch(JSON.stringify(item), /private|feedback_id|reviewed/);
  assert.deepEqual((await view('&q=private%40example.test')).items, []);
});
