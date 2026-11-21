const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join, extname } = require('node:path');

const root = join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function devTools(browser) {
  const pending = new Map();
  const commands = browser.stdio[3];
  const replies = browser.stdio[4];
  let id = 0;
  let buffered = '';
  replies.setEncoding('utf8');
  replies.on('data', chunk => {
    buffered += chunk;
    const messages = buffered.split('\0');
    buffered = messages.pop();
    for (const message of messages) {
      const response = JSON.parse(message);
      const listener = pending.get(response.id);
      if (!listener) continue;
      pending.delete(response.id);
      if (response.error) listener.reject(new Error(response.error.message));
      else listener.resolve(response.result);
    }
  });
  browser.once('exit', () => pending.forEach(({ reject }) => reject(new Error('Chrome exited'))));
  return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    commands.write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}

async function check(browser, url) {
  const command = devTools(browser);
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => command(method, params, sessionId);
  const evalPage = async fn => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression: typeof fn === 'string' ? fn : '(' + fn.toString() + ')()',
      awaitPromise: true, returnByValue: true
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  };
  await send('Page.enable');
  const legacy = {
    id: 'legacy', createdAt: 1710000000000, countryId: 'US', gameId: 'us-megamillions',
    main: [1, 7, 8, 9, 10], bonus: [25],
    rules: { displayName: 'Mega Millions', main: { min: 1, max: 70, count: 5 },
      bonus: { type: 'independent', min: 1, max: 25, count: 1, labelKey: 'megaball' } }
  };
  const legacyKorea = {
    id: 'legacy-korea', createdAt: 1700000000000, countryId: 'KR', gameId: 'kr-lotto-645',
    main: [1, 2, 3, 4, 5, 6], bonus: [45],
    rules: { displayName: 'Lotto 6/45', main: { min: 1, max: 45, count: 6 },
      bonus: { type: 'remaining_main', count: 1, labelKey: 'bonus' } }
  };
  const legacyRecords = [legacy, legacyKorea];
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const fixtures = ${JSON.stringify(legacyRecords)};
      localStorage.setItem('worldLottery.history.v1', JSON.stringify(fixtures));
      localStorage.setItem('worldLottery.favorites.v1', JSON.stringify(fixtures.map(fixture =>
        ({ ...fixture, favoritedAt: fixture.createdAt }))));
      window.errors = [];
      window.addEventListener('error', event => errors.push(event.message));
      window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    `
  });
  const navigation = await send('Page.navigate', { url });
  assert.equal(navigation.errorText, undefined, JSON.stringify(navigation));
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evalPage("Boolean(document.querySelector('#draw-analysis a'))")) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await evalPage("document.querySelector('#saved-list').children.length"), 2);
  assert.deepEqual(await evalPage("JSON.parse(localStorage.getItem('worldLottery.history.v1'))"), legacyRecords);

  const cases = [
    [320, 'KR', 'ko', '260', 90],
    [390, 'US', 'en', '783', 95],
    [768, 'JP', 'ja', '公式当せんデータを準備中', 0],
    [1280, 'BR', 'pt-BR', 'Dados oficiais dos sorteios em preparação', 0]
  ];
  for (const [width, country, lang, copy, meters] of cases) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const result = await evalPage(`(async () => {
      const select = document.querySelector('#country-select');
      select.value = ${JSON.stringify(country)};
      select.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve, 50));
      const history = document.querySelector('#draw-analysis');
      return { lang: document.documentElement.lang, text: history.innerText,
        meters: history.querySelectorAll('meter').length,
        overflow: document.documentElement.scrollWidth > innerWidth };
    })()`);
    assert.equal(result.lang, lang);
    assert.ok(result.text.includes(copy), result.text);
    assert.equal(result.meters, meters);
    assert.equal(result.overflow, false);
    const chart = await evalPage(async () => {
      const select = document.querySelector('#country-select');
      select.value = 'US';
      select.dispatchEvent(new Event('change'));
      await new Promise(resolve => setTimeout(resolve, 50));
      document.querySelectorAll('#draw-analysis details').forEach(details => { details.open = true; });
      const meters = [...document.querySelectorAll('#draw-analysis meter')];
      return { count: meters.length, fits: meters.every(meter => {
        const rect = meter.getBoundingClientRect();
        return rect.width > 0 && rect.right <= innerWidth;
      }),
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(chart, { count: 95, fits: true, overflow: false });
    console.log('Layout and localization OK:', width, lang);
  }

  const pending = await evalPage(async () => {
    const country = document.getElementById('country-select');
    const game = document.getElementById('game-select');
    const result = [];
    for (const option of country.options) {
      country.value = option.value;
      country.dispatchEvent(new Event('change'));
      for (const choice of game.options) {
        if (['kr-lotto-645', 'us-powerball', 'us-megamillions'].includes(choice.value)) continue;
        game.value = choice.value;
        game.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0));
        const area = document.getElementById('draw-analysis');
        result.push({
          id: choice.value, hasSource: Boolean(area.querySelector('a')),
          hasStatistics: Boolean(area.querySelector('meter, details')),
          ukOdds: choice.value === 'uk-lotto' ? document.getElementById('jackpot-odds').innerText : null
        });
      }
    }
    return result;
  });
  assert.equal(pending.length, 11);
  assert.ok(pending.every(game => game.hasSource && !game.hasStatistics));
  const ukOdds = pending.find(game => game.id === 'uk-lotto').ukOdds;
  assert.match(ukOdds, /Jackpot in at least one of the two rounds/);
  assert.match(ukOdds, /22,528,737\.25/);
  console.log('11 pending games and UK Lotto two-round odds OK');

  const actions = await evalPage(async () => {
    const change = (id, value) => {
      const select = document.getElementById(id);
      select.value = value;
      select.dispatchEvent(new Event('change'));
    };
    change('country-select', 'US');
    change('game-select', 'us-megamillions');
    change('quantity-select', '10');
    const oldShare = Object.getOwnPropertyDescriptor(navigator, 'share');
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    let clipboard;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { clipboard = text; } } });
    document.querySelector('#btn-generate').click();
    const resultRows = document.querySelectorAll('.result-row');
    const button = (row, name) => [...row.querySelectorAll('button')].find(item => item.textContent.trim() === name);
    const row = resultRows[0];
    row.querySelector('[data-favorite-id]').click();
    await document.fonts.ready;
    button(row, 'Share numbers').click();
    const currentClipboard = clipboard;
    let png, filename;
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = function (blob) { png = blob; return createObjectURL.call(URL, blob); };
    const clickAnchor = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) filename = this.download;
      else clickAnchor.call(this);
    };
    const save = button(row, 'Save image');
    save.click();
    while (save.getAttribute('aria-busy') === 'true') await new Promise(resolve => setTimeout(resolve, 10));
    const currentPng = png;
    const currentFilename = filename;
    const favorite = document.querySelector('#show-favorites');
    favorite.click();
    const savedRows = [...document.querySelectorAll('#saved-list .saved-record')];
    const oldKorea = savedRows.find(item => item.querySelector('strong').textContent.includes('Lotto 6/45'));
    const oldMega = savedRows.find(item => item.querySelector('.saved-extra')?.textContent.endsWith('25'));
    button(oldKorea, 'Share numbers').click();
    const legacyClipboard = clipboard;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    const legacyBalls = [];
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...args) {
      if (y === 410) legacyBalls.push(Number(value));
      return fillText.call(this, value, x, y, ...args);
    };
    const legacySave = button(oldKorea, 'Save image');
    legacySave.click();
    while (legacySave.getAttribute('aria-busy') === 'true') await new Promise(resolve => setTimeout(resolve, 10));
    CanvasRenderingContext2D.prototype.fillText = fillText;
    URL.createObjectURL = createObjectURL;
    HTMLAnchorElement.prototype.click = clickAnchor;
    let shared;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => { shared = payload; } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    button(row, 'Share numbers').click();
    await new Promise(resolve => setTimeout(resolve, 30));
    if (oldShare) Object.defineProperty(navigator, 'share', oldShare);
    const records = JSON.parse(localStorage.getItem('worldLottery.history.v1'));
    const favorites = JSON.parse(localStorage.getItem('worldLottery.favorites.v1'));
    const signature = async blob => blob && [...new Uint8Array(await blob.slice(0, 8).arrayBuffer())];
    return { rows: resultRows.length, records, favorites, clipboard: currentClipboard, filename: currentFilename,
      png: await signature(currentPng), legacyPng: await signature(png), legacyBalls, legacyClipboard,
      legacyExtra: oldKorea.querySelector('.saved-extra')?.textContent ?? null,
      megaExtra: oldMega?.querySelector('.saved-extra')?.textContent,
      shared: { title: shared?.title, mime: shared?.files?.[0]?.type },
      historical: [...document.querySelectorAll('#draw-analysis details')].some(details =>
        details.textContent.includes('5/70 + 1/25')),
      odds: document.querySelector('#jackpot-odds').innerText, errors: window.errors };
  });
  assert.equal(actions.rows, 10);
  assert.equal(actions.records.length, 12);
  assert.deepEqual(actions.records.slice(-2), legacyRecords);
  assert.equal(new Set(actions.records.slice(0, 10).map(row => JSON.stringify([row.main, row.bonus]))).size, 10);
  assert.equal(actions.favorites.length, 3);
  assert.match(actions.clipboard, /Mega Ball: \d+/);
  assert.match(actions.legacyClipboard, /^Lotto 6\/45\n[^\n]+: 1, 2, 3, 4, 5, 6\nhttps:/);
  assert.equal(actions.legacyExtra, null);
  assert.match(actions.megaExtra, /25$/);
  assert.deepEqual(actions.legacyBalls, [1, 2, 3, 4, 5, 6]);
  assert.match(actions.filename, /\.png$/);
  assert.deepEqual(actions.png, [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(actions.legacyPng, actions.png);
  assert.deepEqual(actions.shared, { title: 'Mega Millions', mime: 'image/png' });
  assert.equal(actions.historical, true);
  assert.match(actions.odds, /29,047,233\.6/);
  assert.deepEqual(actions.errors, []);
  console.log('Legacy storage, favorites, batch, odds, rule eras, PNG and share callbacks OK');

  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
  const generated = await evalPage(() => {
    const country = document.getElementById('country-select');
    const game = document.getElementById('game-select');
    const quantity = document.getElementById('quantity-select');
    const select = (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('change'));
    };
    const counts = {};
    select(quantity, '1');
    for (const option of country.options) {
      select(country, option.value);
      for (const choice of game.options) {
        select(game, choice.value);
        document.getElementById('btn-generate').click();
        const row = document.querySelector('.result-row');
        const main = row.querySelectorAll('.main-balls .lotto-ball').length;
        const extra = row.querySelectorAll('.bonus-balls .lotto-ball').length;
        if (Boolean(extra) !== Boolean(row.querySelector('.bonus-divider')) ||
            Boolean(extra) !== Boolean(row.querySelector('.bonus-badge')) ||
            document.documentElement.scrollWidth > innerWidth) {
          throw new Error('Invalid result layout for ' + choice.value);
        }
        counts[choice.value] = [main, extra];
      }
    }
    return counts;
  });
  assert.deepEqual(generated, {
    'kr-lotto-645': [6, 0], 'us-powerball': [5, 1], 'us-megamillions': [5, 1], 'uk-lotto': [6, 0],
    'eu-euromillions': [5, 2], 'eu-eurojackpot': [5, 2], 'jp-loto-6': [6, 0], 'jp-loto-7': [7, 0],
    'ca-lotto-649': [6, 0], 'au-oz-lotto': [7, 0], 'au-powerball': [7, 1], 'br-mega-sena': [6, 0],
    'sg-toto': [6, 0], 'za-powerball': [5, 1]
  });
  console.log('All 14 ticket layouts show the selected balls at 320px');

  const korean = await evalPage(async () => {
    const change = (id, value) => {
      const select = document.getElementById(id);
      select.value = value;
      select.dispatchEvent(new Event('change'));
      return select;
    };
    const panel = document.getElementById('korea-mode-panel');
    const hiddenOutsideKorea = panel.hidden;
    change('country-select', 'KR');
    const mode = document.getElementById('korea-mode');
    const defaultMode = mode.value;
    const official = await fetch('data/kr-lotto645.json').then(response => response.json());
    for (let i = 0; mode.options[1].disabled && i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    change('korea-mode', 'filtered');
    const counts = [];
    for (const count of [1, 3, 5, 10]) {
      change('quantity-select', String(count));
      document.getElementById('btn-generate').click();
      const saved = JSON.parse(localStorage.getItem('worldLottery.history.v1')).slice(0, count);
      const lines = saved.map(row => row.main);
      if (saved.some(row => row.gameId !== 'kr-lotto-645') ||
          saved.some(row => row.main.length !== 6 || row.bonus.length !== 0) ||
          lines.some(main => official.draws.some(draw => draw.main.filter(n => main.includes(n)).length > 4)) ||
          new Set(lines.map(main => main.join(','))).size !== count) {
        throw new Error('Filtered Korea Lotto batch failed');
      }
      counts.push(document.querySelectorAll('.result-row').length);
    }
    return { hiddenOutsideKorea, defaultMode, enabled: !mode.options[1].disabled, counts,
      metadata: document.getElementById('korea-mode-status').innerText,
      results: document.getElementById('draw-analysis').innerText };
  });
  assert.ok(korean.hiddenOutsideKorea && korean.enabled);
  assert.equal(korean.defaultMode, 'random');
  assert.deepEqual(korean.counts, [1, 3, 5, 10]);
  assert.match(korean.metadata, /분석 기준일.*분석 회차 수 260.*데이터 갱신일/);
  assert.match(korean.results, /COLD.*43 \(22\)/);
  console.log('Korea Lotto filter, metadata and default mode OK');

  for (const response of ["new Response(null, {status:404})", "new Response('{}')"]) {
    const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const original = window.fetch;
        window.fetch = (url, ...args) => url === 'data/kr-lotto645.json'
          ? Promise.resolve(${response}) : original(url, ...args);
      })()`
    });
    await send('Page.reload');
    const unavailable = "document.querySelector('#korea-mode-status')?.textContent.includes('필터를 사용할 수 없습니다.')";
    for (let i = 0; !(await evalPage(unavailable)) && i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(await evalPage(unavailable));
    const state = await evalPage(() => {
      const mode = document.getElementById('korea-mode');
      const disabled = mode.options[1].disabled;
      const generate = document.getElementById('btn-generate');
      mode.options[1].disabled = false;
      mode.value = 'filtered';
      generate.click();
      const filtered = document.querySelectorAll('.result-row').length;
      mode.value = 'random';
      generate.click();
      return { disabled, filtered, random: document.querySelectorAll('.result-row').length };
    });
    assert.deepEqual(state, { disabled: true, filtered: 0, random: 5 });
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
  console.log('Missing and invalid Korea data disable the filter without fallback');
}

async function main() {
  const executable = process.argv[2];
  if (!executable) throw new Error('Pass the path to a Chromium executable');
  const profile = await mkdtemp(join(tmpdir(), 'lottery-chrome-'));
  const server = createServer(async (req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url;
    const type = types[extname(path)];
    if (!type || !/^\/(data\/)?[\w.-]+$/.test(path)) return res.writeHead(404).end();
    try {
      res.writeHead(200, { 'Content-Type': type }).end(await readFile(join(root, path)));
    } catch {
      res.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const browser = spawn(executable, ['--headless', '--remote-debugging-pipe', '--no-first-run',
    '--disable-background-networking', '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--user-data-dir=' + profile],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const ended = once(browser, 'exit');
  const timeout = setTimeout(() => browser.kill(), 30000);
  try {
    await check(browser, 'http://127.0.0.1:' + server.address().port);
  } finally {
    clearTimeout(timeout);
    browser.kill();
    await ended;
    server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
