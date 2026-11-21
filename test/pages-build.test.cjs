const assert = require('node:assert/strict');
const { readdirSync, readFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { buildPages } = require('../scripts/build-pages.cjs');

test('Pages artifacts contain public assets, preserve SEO, and exclude the engine and raw history', () => {
  const output = buildPages();
  try {
    assert.deepEqual(readdirSync(output).sort(), [
      '_routes.json', 'about.html', 'ads.txt', 'contact.html', 'data', 'guide.html',
      'index.html', 'korea-lotto.js', 'lottery.js', 'privacy.html', 'robots.txt', 'script.js', 'sitemap.xml', 'style.css'
    ]);
    assert.deepEqual(readdirSync(join(output, 'data')).sort(), ['analysis.json', 'kr-lotto645.json']);
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
