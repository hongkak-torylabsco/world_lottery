const assert = require('node:assert/strict');
const { test } = require('node:test');
const { GAMES, validRecord, validateTickets } = require('../script.js');
const { choose, uniqueTickets, jackpotOdds, rankings, summarize } = require('../lottery.js');
const { buildEntry, fiveYearsBefore } = require('../scripts/update-draws.cjs');

const expected = {
  'kr-lotto-645': [45, 6, 0, 0, 8145060n],
  'us-powerball': [69, 5, 26, 1, 292201338n],
  'us-megamillions': [70, 5, 24, 1, 290472336n],
  'uk-lotto': [59, 6, 0, 0, 45057474n],
  'eu-euromillions': [50, 5, 12, 2, 139838160n],
  'eu-eurojackpot': [50, 5, 12, 2, 139838160n],
  'jp-loto-6': [43, 6, 0, 0, 6096454n],
  'jp-loto-7': [37, 7, 0, 0, 10295472n],
  'ca-lotto-649': [49, 6, 0, 0, 13983816n],
  'au-oz-lotto': [47, 7, 0, 0, 62891499n],
  'au-powerball': [35, 7, 20, 1, 134490400n],
  'br-mega-sena': [60, 6, 0, 0, 50063860n],
  'sg-toto': [49, 6, 0, 0, 13983816n],
  'za-powerball': [50, 5, 16, 1, 33900160n]
};

test('all 14 games preserve public purchase rules and odds', () => {
  assert.equal(GAMES.length, Object.keys(expected).length);
  for (const game of GAMES) {
    const [mainMax, mainCount, extraMax, extraCount, space] = expected[game.id];
    assert.deepEqual([game.main.max, game.main.count, game.playerSelectedExtra?.max || 0,
      game.playerSelectedExtra?.count || 0], [mainMax, mainCount, extraMax, extraCount]);
    for (const count of [1, 3, 5, 10]) {
      const n = BigInt(count);
      assert.deepEqual(jackpotOdds(game, count), game.id === 'uk-lotto'
        ? { numerator: space ** 2n - (space - n) ** 2n, denominator: space ** 2n }
        : { numerator: n, denominator: space });
    }
  }
  assert.equal(choose(100, 50), 100891344545564193334812497256n);
});

test('odds count unique ticket combinations', () => {
  const game = { main: { min: 1, max: 3, count: 2 }, drawBonus: { count: 1 } };
  assert.throws(() => jackpotOdds(game, 4), RangeError);
  const variants = [{ main: [2, 1], bonus: [2] }, { main: [1, 2], bonus: [3] }];
  assert.equal(uniqueTickets(game, variants), 1);
  assert.equal(uniqueTickets({ ...game, playerSelectedExtra: { min: 1, max: 3, count: 1 } }, variants), 2);
});

test('official snapshot totals and tie-breaks are reproducible', () => {
  const archive = require('../data/analysis.json');
  const powerball = archive['us-powerball'].current;
  assert.equal(powerball.count, 783);
  assert.deepEqual(rankings(powerball.main).hot.map(({ number }) => number), [33, 64, 21, 36, 37]);
  assert.equal(powerball.main.reduce((sum, row) => sum + row.count, 0), 5 * powerball.count);
  assert.equal(powerball.bonus.reduce((sum, row) => sum + row.count, 0), powerball.count);
  const mega = archive['us-megamillions'];
  assert.equal(mega.current.start, '2025-04-08');
  assert.equal(mega.previous[0].end, '2025-04-04');
  assert.equal(mega.current.bonus.length, 24);
  assert.equal(mega.previous[0].bonus.length, 25);
  assert.equal(Object.values(archive).filter(entry => entry.status === 'pending').length, 11);
});

test('missing, duplicate, malformed and out-of-era draws are rejected', () => {
  const game = GAMES.find(entry => entry.id === 'us-megamillions');
  const snapshot = require('../data/us-megamillions.json');
  const build = draws => buildEntry(game, {}, draws, snapshot.through, snapshot.updated, [2, 5]);
  assert.throws(() => build(snapshot.draws.slice(1)), /schedule mismatch/);
  assert.throws(() => build([...snapshot.draws, snapshot.draws[0]]), /Unexpected draw/);
  assert.throws(() => summarize([{ date: '2025-04-08', main: [1, 2, 3, 4, 5], bonus: [25] }], game), /Invalid/);
  assert.equal(summarize([], game), null);
  assert.equal(fiveYearsBefore('2028-02-29'), '2023-02-28');
  const ranks = rankings([{ number: 3, count: 0 }, { number: 2, count: 1 }, { number: 1, count: 0 }]);
  assert.deepEqual(ranks.cold.map(row => row.number), [1, 3, 2]);
});

test('legacy records use their own rule snapshot and unchanged data fields', () => {
  const game = GAMES.find(entry => entry.id === 'us-megamillions');
  const record = {
    id: 'old-id', countryId: 'US', gameId: game.id, createdAt: 1710000000000,
    main: [1, 7, 8, 9, 10], bonus: [25],
    rules: { displayName: game.displayName, main: game.main, bonus: { ...game.playerSelectedExtra, type: 'independent', max: 25 } }
  };
  assert.ok(validRecord(record, 'history'));
  assert.ok(validRecord({ ...record, favoritedAt: record.createdAt }, 'favorites'));
  assert.equal(validRecord(record, 'favorites'), false);
});

test('API tickets must match the public rules, order and requested batch', () => {
  const game = GAMES.find(entry => entry.id === 'us-powerball');
  const ticket = { main: [1, 2, 3, 4, 5], extra: [26] };
  const payload = { success: true, gameId: game.id, generatedAt: '2026-11-21T00:00:00Z', tickets: [ticket] };
  assert.deepEqual(validateTickets(payload, game, 1), [{ main: ticket.main, bonus: ticket.extra }]);
  for (const invalid of [
    { ...payload, gameId: 'kr-lotto-645' },
    { ...payload, generatedAt: 'unknown' },
    { ...payload, tickets: [{ ...ticket, extra: [27] }] },
    { ...payload, tickets: [{ ...ticket, main: [1, 2, 4, 3, 5] }] },
    { ...payload, tickets: [null] }
  ]) assert.equal(validateTickets(invalid, game, 1), null);
  assert.equal(validateTickets({ ...payload, tickets: [ticket, ticket, ticket] }, game, 3), null);
});
