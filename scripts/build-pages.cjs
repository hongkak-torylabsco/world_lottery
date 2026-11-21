const { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const root = join(__dirname, '..');
const files = [
  'index.html', 'about.html', 'contact.html', 'guide.html', 'privacy.html',
  'script.js', 'lottery.js', 'style.css', 'ads.txt', 'robots.txt', 'sitemap.xml',
  'data/analysis.json'
];

function buildPages() {
  const output = mkdtempSync(join(tmpdir(), 'world-lottery-pages-'));
  mkdirSync(join(output, 'data'));
  for (const file of files) copyFileSync(join(root, file), join(output, file));
  writeFileSync(join(output, '_routes.json'), JSON.stringify({
    version: 1,
    include: ['/api/v1/generate'],
    exclude: []
  }) + '\n');
  return output;
}

if (require.main === module) console.log(buildPages());
module.exports = { buildPages };
