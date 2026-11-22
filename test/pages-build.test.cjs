const assert = require('node:assert/strict');
const { readdirSync, readFileSync, rmSync } = require('node:fs');
const { join, relative } = require('node:path');
const { test } = require('node:test');
const { buildPages, stagePages } = require('../scripts/build-pages.cjs');

test('Pages artifacts contain public assets, preserve SEO, and exclude the engine and raw history', () => {
  const output = buildPages();
  try {
    assert.deepEqual(readdirSync(output).sort(), [
      '_redirects', '_routes.json', 'about.html', 'admin-feedback.css', 'admin-feedback.js', 'ads.txt', 'contact.html', 'contact.js',
      'data', 'guide.html', 'index.html', 'korea-lotto.js', 'lottery.js', 'privacy.html', 'qa.js',
      'questions', 'robots.txt', 'script.js', 'sitemap.xml', 'style.css'
    ]);
    assert.deepEqual(readdirSync(join(output, 'data')).sort(), ['analysis.json', 'kr-lotto645.json']);
    assert.deepEqual(JSON.parse(readFileSync(join(output, '_routes.json'), 'utf8')).include,
      ['/api/v1/generate', '/api/v1/feedback', '/api/v1/admin-feedback', '/api/v1/qa',
        '/admin/feedback', '/admin/feedback/*']);
    assert.equal(readFileSync(join(output, 'questions', 'index.html'), 'utf8'),
      readFileSync(join(__dirname, '..', 'qa.html'), 'utf8'));
    for (const file of ['_redirects', 'robots.txt', 'sitemap.xml', 'ads.txt']) {
      assert.deepEqual(readFileSync(join(output, file)), readFileSync(join(__dirname, '..', file)));
    }
    assert.equal(readFileSync(join(output, 'korea-lotto.js'), 'utf8'), '// Korea Lotto generation moved to the API.\n');
    assert.deepEqual(JSON.parse(readFileSync(join(output, 'data', 'kr-lotto645.json'))), { moved: true });
    for (const file of ['index.html', 'script.js', 'lottery.js', 'data/analysis.json']) {
      assert.doesNotMatch(readFileSync(join(output, file), 'utf8'),
        /\b(?:sampleLines|unrank|createRandomInt|replaceNumbers|generateFiltered|prepareSnapshot)\b|korea-lotto\.js|kr-lotto645\.json|api[_-]?key|sourceMappingURL/i);
    }
    const home = readFileSync(join(output, 'index.html'), 'utf8');
    assert.match(home, /google-site-verification/);
    assert.match(home, /pagead2\.googlesyndication\.com/);
    assert.match(home, /rel="canonical" href="https:\/\/world-lottery\.pages\.dev\/"/);
    const summary = JSON.parse(readFileSync(join(output, 'data/analysis.json')));
    assert.equal(summary['kr-lotto-645'].current.count, 260);
    assert.equal(summary['kr-lotto-645'].draws, undefined);
  } finally {
    rmSync(output, { recursive: true });
  }
});

test('production packages isolate public and administrator assets, routes and server source', () => {
  const publicStage = stagePages('public');
  const adminStage = stagePages('admin');
  const paths = directory => readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(directory, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort();
  const read = (stage, file) => readFileSync(join(stage, file), 'utf8');
  try {
    assert.deepEqual(paths(join(publicStage, 'functions')), [
      'api/v1/feedback.js', 'api/v1/generate.js', 'api/v1/qa.js'
    ]);
    assert.deepEqual(paths(join(publicStage, 'lib')), ['feedback-http.js']);
    assert.deepEqual(JSON.parse(read(publicStage, 'assets/_routes.json')).include,
      ['/api/v1/generate', '/api/v1/feedback', '/api/v1/qa']);
    assert.ok(paths(join(publicStage, 'assets')).includes('404.html'));
    assert.ok(!paths(join(publicStage, 'assets')).includes('qa.html'));
    assert.deepEqual(read(publicStage, 'assets/_redirects').trim().split(/\r?\n/),
      ['/qa /questions/ 301', '/qa/ /questions/ 301', '/qa.html /questions/ 301']);
    const questions = read(publicStage, 'assets/questions/index.html');
    assert.match(questions, /<title>[^<]+<\/title>/);
    assert.match(questions, /name="description" content="[^"]+"/);
    assert.match(questions, /name="robots" content="index, follow"/);
    assert.match(questions, /rel="canonical" href="https:\/\/world-lottery\.pages\.dev\/questions\/"/);
    const sitemap = read(publicStage, 'assets/sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/world-lottery\.pages\.dev\/questions\/<\/loc>/);
    assert.doesNotMatch(sitemap, /\/qa[</.]|\/admin[</-]/);
    for (const file of paths(join(publicStage, 'assets'))) {
      assert.doesNotMatch(file, /admin|functions|^lib\//);
      assert.doesNotMatch(read(publicStage, 'assets/' + file),
        /\/api\/v1\/admin-feedback|\/admin\/feedback|\.feedback-(?:edit|entry|text)\b/);
    }
    assert.deepEqual(paths(join(adminStage, 'assets')), [
      '404.html', '_routes.json', 'admin-feedback.css', 'admin-feedback.js'
    ]);
    assert.deepEqual(paths(join(adminStage, 'functions')), [
      'admin/feedback/index.js', 'api/v1/admin-feedback.js'
    ]);
    assert.deepEqual(paths(join(adminStage, 'lib')), ['feedback-access.js', 'feedback-http.js']);
    assert.deepEqual(JSON.parse(read(adminStage, 'assets/_routes.json')).include,
      ['/api/v1/admin-feedback', '/admin/feedback']);
    assert.match(read(adminStage, 'functions/admin/feedback/index.js'), /href="\/admin-feedback\.css"/);
    assert.match(read(adminStage, 'assets/admin-feedback.js'), /fetch\('\/api\/v1\/admin-feedback'/);
  } finally {
    rmSync(publicStage, { recursive: true });
    rmSync(adminStage, { recursive: true });
  }
});
