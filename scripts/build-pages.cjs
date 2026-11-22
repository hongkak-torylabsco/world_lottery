const { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const root = join(__dirname, '..');
const files = [
  'index.html', 'about.html', 'contact.html', 'guide.html', 'privacy.html',
  'script.js', 'contact.js', 'admin-feedback.js', 'qa.html', 'qa.js',
  'lottery.js', 'style.css', 'ads.txt', 'robots.txt', 'sitemap.xml',
  'data/analysis.json'
];

function buildPages() {
  const output = mkdtempSync(join(tmpdir(), 'world-lottery-pages-'));
  mkdirSync(join(output, 'data'));
  for (const file of files) copyFileSync(join(root, file), join(output, file));
  mkdirSync(join(output, 'questions'));
  copyFileSync(join(root, 'qa.html'), join(output, 'questions', 'index.html'));
  // Replace cached v1.4.x URLs with inert content during migration.
  writeFileSync(join(output, 'korea-lotto.js'), '// Korea Lotto generation moved to the API.\n');
  writeFileSync(join(output, 'data', 'kr-lotto645.json'), '{"moved":true}\n');
  writeFileSync(join(output, '_routes.json'), JSON.stringify({
    version: 1,
    include: ['/api/v1/generate', '/api/v1/feedback', '/api/v1/admin-feedback', '/api/v1/qa',
      '/admin/feedback', '/admin/feedback/*'],
    exclude: []
  }) + '\n');
  return output;
}

if (require.main === module) console.log(buildPages());
module.exports = { buildPages };
