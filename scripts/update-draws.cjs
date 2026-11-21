const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync, renameSync } = require('node:fs');
const { join } = require('node:path');
const { GAMES } = require('../script.js');
const { summarize } = require('../lottery.js');
const korea = require('../korea-lotto.js');

const dir = join(__dirname, '..', 'data');
const sources = {
  'kr-lotto-645': ['동행복권', 'https://www.dhlottery.co.kr/lt645/winNumber'],
  'us-powerball': ['New York State Gaming Commission', 'https://data.ny.gov/d/d6yy-54nr', 'd6yy-54nr', [1, 3, 6]],
  'us-megamillions': ['New York State Gaming Commission', 'https://data.ny.gov/d/5xaw-6ayf', '5xaw-6ayf', [2, 5]],
  'uk-lotto': ['The National Lottery', 'https://www.national-lottery.co.uk/results/lotto/draw-history'],
  'eu-euromillions': ['FDJ', 'https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/historique'],
  'eu-eurojackpot': ['LOTTO.de', 'https://www.lotto.de/eurojackpot/zahlen'],
  'jp-loto-6': ['みずほ銀行', 'https://www.mizuhobank.co.jp/takarakuji/check/loto/backnumber/index.html'],
  'jp-loto-7': ['みずほ銀行', 'https://www.mizuhobank.co.jp/takarakuji/check/loto/backnumber/index.html'],
  'ca-lotto-649': ['WCLC', 'https://www.wclc.com/display-on/display-on-downloads/lotto-649-since-inception.htm'],
  'au-oz-lotto': ['The Lott', 'https://www.thelott.com/oz-lotto/results'],
  'au-powerball': ['The Lott', 'https://www.thelott.com/powerball/results'],
  'br-mega-sena': ['CAIXA', 'https://loterias.caixa.gov.br/Paginas/mega-sena.aspx'],
  'sg-toto': ['Singapore Pools', 'https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx'],
  'za-powerball': ['Sizekhaya', 'https://sizekhaya.co.za/']
};

const migration = '2025-04-08';
const dateKey = date => date.toISOString().slice(0, 10);
const utc = date => new Date(date + 'T00:00:00Z');

function checkDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+utc(date)) || dateKey(utc(date)) !== date) {
    throw new Error('Invalid date: ' + date);
  }
}

function fiveYearsBefore(date) {
  const year = Number(date.slice(0, 4)) - 5;
  return year + (date.endsWith('-02-29') ? '-02-28' : date.slice(4));
}

function buildEntry(game, source, draws, through, updated, weekdays) {
  checkDate(through);
  checkDate(updated);
  if (through > updated) throw new Error('Cutoff is after the update date');
  const start = fiveYearsBefore(through);
  const actualDates = new Set();
  for (const { date } of draws) {
    checkDate(date);
    if (date < start || date > through || actualDates.has(date)) throw new Error('Unexpected draw: ' + date);
    actualDates.add(date);
  }
  for (let day = utc(start); day <= utc(through); day.setUTCDate(day.getUTCDate() + 1)) {
    const expected = weekdays.includes(day.getUTCDay());
    if (expected !== actualDates.has(dateKey(day))) throw new Error(game.id + ': schedule mismatch on ' + dateKey(day));
  }
  const changed = game.id === 'us-megamillions';
  const current = summarize(draws.filter(row => !changed || row.date >= migration), game);
  const legacyRule = { ...game, playerSelectedExtra: { ...game.playerSelectedExtra, max: 25 } };
  const legacy = changed ? summarize(draws.filter(row => row.date < migration), legacyRule) : null;
  return { status: current ? 'verified' : 'pending', source, updated, through,
    windowStart: start, current, previous: legacy ? [{ ...legacy, rule: '5/70 + 1/25' }] : [] };
}

function download(dataset, game, through) {
  const url = new URL('https://data.ny.gov/resource/' + dataset + '.json');
  url.searchParams.set('$where', "draw_date between '" + fiveYearsBefore(through) + "T00:00:00' and '" + through + "T23:59:59'");
  url.searchParams.set('$order', 'draw_date ASC');
  url.searchParams.set('$limit', '2000');
  const rows = JSON.parse(execFileSync('curl', ['--fail', '--silent', '--show-error', '--max-time', '30', url.href],
    { encoding: 'utf8' }));
  if (!Array.isArray(rows) || rows.length === 2000) throw new Error('Unexpected or truncated archive');
  return rows.map(row => {
    const numbers = row.winning_numbers.trim().split(/\s+/).map(Number);
    const separateBall = game.id === 'us-megamillions';
    if (numbers.length !== (separateBall ? 5 : 6)) throw new Error('Unexpected number columns on ' + row.draw_date);
    if (separateBall) numbers.push(Number(row.mega_ball));
    return { date: row.draw_date.slice(0, 10), main: numbers.slice(0, 5).sort((a, b) => a - b), bonus: numbers.slice(5) };
  });
}

function writeJson(name, value) {
  const path = join(dir, name + '.json');
  writeFileSync(path + '.tmp', JSON.stringify(value) + '\n');
  renameSync(path + '.tmp', path);
}

function run(mode, cutoff) {
  if (!['--download', '--verify', '--rebuild'].includes(mode)) throw new Error('Use --download YYYY-MM-DD, --verify, or --rebuild');
  if (mode === '--download') checkDate(cutoff);
  const analysis = {};
  const snapshots = {};
  for (const game of GAMES) {
    const [name, url, dataset, weekdays] = sources[game.id];
    const source = { name, url };
    if (game.id === korea.gameId) {
      const snapshot = JSON.parse(readFileSync(join(dir, 'kr-lotto645.json'), 'utf8'));
      analysis[game.id] = korea.prepareSnapshot(snapshot).entry;
      continue;
    }
    if (!dataset) {
      analysis[game.id] = { status: 'pending', source };
      continue;
    }
    const snapshot = mode === '--download'
      ? { updated: dateKey(new Date()), through: cutoff, draws: download(dataset, game, cutoff) }
      : JSON.parse(readFileSync(join(dir, game.id + '.json'), 'utf8'));
    analysis[game.id] = buildEntry(game, source, snapshot.draws, snapshot.through, snapshot.updated, weekdays);
    if (mode === '--download') snapshots[game.id] = snapshot;
  }
  if (mode === '--verify') {
    if (JSON.stringify(analysis) !== JSON.stringify(JSON.parse(readFileSync(join(dir, 'analysis.json'), 'utf8')))) {
      throw new Error('Published analysis does not match the snapshots');
    }
  } else {
    mkdirSync(dir, { recursive: true });
    for (const [id, snapshot] of Object.entries(snapshots)) writeJson(id, snapshot);
    writeJson('analysis', analysis);
  }
  console.log('Verified analysis and source metadata for ' + GAMES.length + ' games.');
}

if (require.main === module) run(...process.argv.slice(2));
module.exports = { buildEntry, fiveYearsBefore, run };
