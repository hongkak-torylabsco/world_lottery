const assert = require('node:assert/strict');
const { readdirSync, readFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { buildPages } = require('../scripts/build-pages.cjs');

test('Pages artifacts contain public assets, preserve SEO, and exclude the engine and raw history', () => {
  const output = buildPages();
  try {
    assert.deepEqual(readdirSync(output).sort(), [
      '_routes.json', 'about.html', 'admin-feedback.js', 'ads.txt', 'contact.html', 'contact.js',
      'data', 'guide.html', 'index.html', 'korea-lotto.js', 'lottery.js', 'privacy.html', 'qa.html', 'qa.js',
      'questions', 'robots.txt', 'script.js', 'sitemap.xml', 'style.css'
    ]);
    assert.deepEqual(readdirSync(join(output, 'data')).sort(), ['analysis.json', 'kr-lotto645.json']);
    assert.deepEqual(JSON.parse(readFileSync(join(output, '_routes.json'), 'utf8')).include,
      ['/api/v1/generate', '/api/v1/feedback', '/api/v1/admin-feedback', '/api/v1/qa',
        '/admin/feedback', '/admin/feedback/*']);
    assert.equal(readFileSync(join(output, 'questions', 'index.html'), 'utf8'),
      readFileSync(join(output, 'qa.html'), 'utf8'));
    for (const file of ['robots.txt', 'sitemap.xml', 'ads.txt']) {
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
