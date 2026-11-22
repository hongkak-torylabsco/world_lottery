const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');


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
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: String.raw`
      window.generationRequests = [];
      const sendFetch = window.fetch.bind(window);
      window.fetch = (url, options) => {
        if (url === '/api/v1/generate') generationRequests.push(JSON.parse(options.body));
        return sendFetch(url, options);
      };
      window.generateAndWait = async () => {
        const button = document.getElementById('btn-generate');
        button.click();
        for (let attempt = 0; button.disabled && attempt < 240; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (button.disabled) throw new Error('Generation request did not settle');
      };
    `
  });
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
    await generateAndWait();
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
  const generated = await evalPage(async () => {
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
        await generateAndWait();
        const row = document.querySelector('.result-row');
        const main = row.querySelectorAll('.main-balls .lotto-ball').length;
        const extra = row.querySelectorAll('.bonus-balls .lotto-ball').length;
        if (Boolean(extra) !== Boolean(row.querySelector('.bonus-divider')) ||
            Boolean(extra) !== Boolean(row.querySelector('.bonus-badge')) ||
            document.documentElement.scrollWidth > innerWidth) {
          throw new Error('Invalid result layout for ' + choice.value);
        }
        const request = generationRequests.at(-1);
        if (request.gameId !== choice.value ||
            request.mode !== (choice.value === 'kr-lotto-645' ? 'kr-statistical' : 'random')) {
          throw new Error('Invalid generation request for ' + choice.value);
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
    const mode = value => panel.querySelector('input[value="' + value + '"]');
    const defaultMode = panel.querySelector('input:checked')?.value ?? null;
    const overrides = panel.querySelectorAll('input[type=radio]').length;
    change('quantity-select', '1');
    await generateAndWait();
    const defaultRequest = generationRequests.at(-1).mode;
    const defaultNumbers = [...document.querySelectorAll('.result-row .lotto-ball')].map(ball => Number(ball.textContent));
    mode('random').click();
    change('quantity-select', '1');
    await generateAndWait();
    const randomMode = generationRequests.at(-1).mode;
    const randomNumbers = document.querySelectorAll('.result-row .lotto-ball').length;
    mode('filtered').click();
    const counts = [];
    for (const count of [1, 3, 5, 10]) {
      document.getElementById('btn-clear').click();
      change('quantity-select', String(count));
      await generateAndWait();
      if (generationRequests.at(-1).mode !== 'historical-filter') throw new Error('Missing filter mode');
      const saved = JSON.parse(localStorage.getItem('worldLottery.history.v1')).slice(0, count);
      const lines = saved.map(row => row.main);
      if (saved.some(row => row.gameId !== 'kr-lotto-645') ||
          saved.some(row => row.main.length !== 6 || row.bonus.length !== 0) ||
          new Set(lines.map(main => main.join(','))).size !== count) {
        throw new Error('Filtered Korea Lotto batch failed');
      }
      counts.push(document.querySelectorAll('.result-row').length);
    }
    return { hiddenOutsideKorea, defaultMode, defaultRequest, defaultNumbers, overrides,
      enabled: !mode('filtered').disabled, counts, randomNumbers, randomMode,
      results: document.getElementById('draw-analysis').innerText };
  });
  assert.ok(korean.hiddenOutsideKorea && korean.enabled);
  assert.equal(korean.defaultMode, null);
  assert.equal(korean.defaultRequest, 'kr-statistical');
  assert.equal(korean.defaultNumbers.length, 6);
  assert.equal(new Set(korean.defaultNumbers).size, 6);
  assert.ok(korean.defaultNumbers.every(n => Number.isInteger(n) && n >= 1 && n <= 45));
  assert.equal(korean.randomMode, 'random');
  assert.deepEqual(korean.counts, [1, 3, 5, 10]);
  assert.equal(korean.overrides, 2);
  assert.equal(korean.randomNumbers, 6);
  assert.match(korean.results, /COLD.*43 \(22\)/);
  console.log('Korea default statistical tickets and both existing overrides OK');

  const failure = await evalPage(async () => {
    const originalFetch = window.fetch;
    let resolveRequest;
    let calls = 0;
    window.fetch = (url, options) => {
      if (url !== '/api/v1/generate') return originalFetch(url, options);
      calls++;
      return new Promise(resolve => { resolveRequest = resolve; });
    };
    const generate = document.querySelector('#btn-generate');
    document.getElementById('btn-clear').click();
    generate.click();
    const busy = generate.disabled && generate.getAttribute('aria-busy') === 'true' &&
      generate.textContent.includes('번호 생성 중');
    generate.click();
    resolveRequest(new Response(null, { status: 500 }));
    while (generate.disabled) await new Promise(resolve => setTimeout(resolve, 10));
    const error = document.getElementById('toast').textContent;
    generate.click();
    const staleResponse = resolveRequest;
    const country = document.getElementById('country-select');
    country.value = 'US';
    country.dispatchEvent(new Event('change'));
    staleResponse(new Response(null, { status: 500 }));
    await new Promise(resolve => setTimeout(resolve, 30));
    window.fetch = originalFetch;
    return { busy, calls, error, rows: document.querySelectorAll('.result-row').length, recovered: !generate.disabled };
  });
  assert.deepEqual(failure, { busy: true, calls: 2, error: '번호를 생성하지 못했습니다. 다시 시도해 주세요.',
    rows: 0, recovered: true });
  console.log('API loading, duplicate-click prevention, localized errors and stale requests OK');

  for (const mode of ['random', 'filtered']) {
    await evalPage(`(() => {
      const country = document.getElementById('country-select');
      country.value = 'KR';
      country.dispatchEvent(new Event('change'));
      document.querySelector('input[name="korea-mode"][value="' + ${JSON.stringify(mode)} + '"]').click();
    })()`);
    await send('Page.reload');
    for (let i = 0; i < 80; i++) {
      if (await evalPage("document.querySelector('#korea-mode-panel')?.hidden === false")) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await evalPage("document.querySelector('input[name=korea-mode]:checked')?.value"), mode);
  }
  console.log('Explicit choices for both Korea modes survive reload');

  if (['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    const assertion = await fetch(new URL('/admin/feedback/', url), { redirect: 'manual' });
    assert.equal(assertion.status, 401);
    assert.match(await assertion.text(), /Access required/);
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        const fetchQa = window.fetch.bind(window);
        window.fetch = (url, options) => {
          if (!String(url).startsWith('/api/v1/qa?')) return fetchQa(url, options);
          const item = { id: 1, category: 'rules', question: '<b>Question</b>', answer: '<i>Answer</i>' };
          return Promise.resolve(Response.json(new URL(url, location.origin).searchParams.has('id')
            ? { item } : { items: [item], more: true }));
        };
      `
    });
    async function visit(path, selector) {
      await send('Page.navigate', { url: new URL(path, url).href });
      for (let attempt = 0; attempt < 60; attempt++) {
        if (await evalPage(selector)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.fail('Page did not render: ' + path);
    }
    for (const [lang, label] of [['ko', '분류'], ['en', 'Category'], ['ja', '分類'], ['pt-BR', 'Categoria'], ['fr', 'Category']]) {
      await visit('/contact?lang=' + lang,
        "location.search === " + JSON.stringify('?lang=' + lang) + " && document.querySelector('#contact-form')?.hidden === false");
      assert.equal(await evalPage("document.querySelector('#category-label').textContent"), label);
    }
    await visit('/questions/?lang=pt-BR&category=rules&q=Question',
      "document.querySelector('#qa-items h2 a')?.textContent === '<b>Question</b>'");
    const list = await evalPage(() => {
      const link = document.querySelector('#qa-items h2 a');
      return { detail: link.href, literal: !link.querySelector('b'), lang: document.documentElement.lang,
        filter: document.querySelector('#qa-filter').elements.category.value,
        next: document.getElementById('qa-next').getAttribute('href') };
    });
    assert.equal(list.lang, 'pt-BR');
    assert.equal(list.filter, 'rules');
    assert.equal(list.literal, true);
    assert.equal(new URLSearchParams(list.next).get('offset'), '20');
    assert.equal(new URLSearchParams(list.next).get('q'), 'Question');
    await visit(list.detail, "document.querySelector('#qa-items p')?.textContent === '<i>Answer</i>'");
    assert.equal(await evalPage("document.querySelector('#qa-items i') === null"), true);
    console.log('Contact locales, protected Pages route, and Q&A filters, pagination and literal rendering OK');
  }
}

async function main() {
  const executable = process.argv[2];
  const url = process.argv[3] || 'http://127.0.0.1:8788/';
  if (!executable) throw new Error('Pass the path to a Chromium executable');
  const profile = await mkdtemp(join(tmpdir(), 'lottery-chrome-'));
  const browser = spawn(executable, ['--headless', '--remote-debugging-pipe', '--no-first-run',
    '--disable-background-networking', '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ' + new URL(url).hostname, '--user-data-dir=' + profile],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const ended = once(browser, 'exit');
  const timeout = setTimeout(() => browser.kill(), 30000);
  try {
    await check(browser, url);
  } finally {
    clearTimeout(timeout);
    browser.kill();
    await ended;
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
