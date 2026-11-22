const { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');

const root = join(__dirname, '..');
const files = [
  'index.html', 'about.html', 'contact.html', 'guide.html', 'privacy.html',
  'script.js', 'contact.js', 'qa.js',
  'lottery.js', 'style.css', 'ads.txt', 'robots.txt', 'sitemap.xml', '_redirects',
  'data/analysis.json'
];

const publicRoutes = ['/api/v1/generate', '/api/v1/feedback', '/api/v1/qa'];
const adminRoutes = ['/api/v1/admin-feedback', '/admin/feedback'];
const adminAssets = ['admin-feedback.js', 'admin-feedback.css'];

function copyFiles(output, paths) {
  for (const file of paths) {
    const target = join(output, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
}

function writePublicAssets(output) {
  copyFiles(output, files);
  mkdirSync(join(output, 'questions'));
  copyFileSync(join(root, 'qa.html'), join(output, 'questions', 'index.html'));
  // Replace cached v1.4.x URLs with inert content during migration.
  writeFileSync(join(output, 'korea-lotto.js'), '// Korea Lotto generation moved to the API.\n');
  writeFileSync(join(output, 'data', 'kr-lotto645.json'), '{"moved":true}\n');
}

function writeRoutes(output, include) {
  writeFileSync(join(output, '_routes.json'), JSON.stringify({ version: 1, include, exclude: [] }) + '\n');
}

// Preserve the existing combined build contract for the existing Preview workflow.
function buildPages() {
  const output = mkdtempSync(join(tmpdir(), 'world-lottery-pages-'));
  writePublicAssets(output);
  copyFiles(output, adminAssets);
  writeRoutes(output, [...publicRoutes.slice(0, 2), adminRoutes[0], publicRoutes[2],
    adminRoutes[1], '/admin/feedback/*']);
  return output;
}

function stagePages(target) {
  if (target !== 'public' && target !== 'admin') throw new Error('Expected public or admin');
  const output = mkdtempSync(join(tmpdir(), 'world-lottery-' + target + '-'));
  const assets = join(output, 'assets');
  const isPublic = target === 'public';
  if (isPublic) writePublicAssets(assets);
  else copyFiles(assets, adminAssets);
  // Pages serves index.html for unknown paths without a top-level 404.html.
  writeFileSync(join(assets, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>404</title><h1>Page not found</h1></html>\n');
  writeRoutes(assets, isPublic ? publicRoutes : adminRoutes);
  const handlers = isPublic
    ? ['functions/api/v1/generate.js', 'functions/api/v1/feedback.js', 'functions/api/v1/qa.js']
    : ['functions/api/v1/admin-feedback.js', 'functions/admin/feedback/index.js', 'lib/feedback-access.js'];
  copyFiles(output, [...handlers, 'lib/feedback-http.js']);
  return output;
}

if (require.main === module) {
  if (process.argv.length > 3) throw new Error('Expected a single build target');
  console.log(process.argv[2] ? stagePages(process.argv[2]) : buildPages());
}
module.exports = { buildPages, stagePages };
