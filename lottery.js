/* Shared combination math, draw validation, and analysis rendering. */
(function () {
  'use strict';

  function choose(n, k) {
    if (k < 0 || k > n) return 0n;
    let result = 1n;
    for (let i = 1; i <= Math.min(k, n - k); i++) {
      result = result * BigInt(n - i + 1) / BigInt(i);
    }
    return result;
  }

  function range(pool) {
    return Array.from({ length: pool.max - pool.min + 1 }, (_, i) => pool.min + i);
  }

  function drawExtraPool(rule) {
    const drawBonus = rule.drawBonus || (rule.bonus?.type === 'remaining_main' ? rule.bonus : null);
    return drawBonus ? { ...rule.main, count: drawBonus.count } : rule.playerSelectedExtra || (rule.bonus?.type === 'independent' ? rule.bonus : null);
  }

  function jackpotSpace(game) {
    const main = choose(range(game.main).length, game.main.count);
    const extra = game.playerSelectedExtra;
    return extra ? main * choose(range(extra).length, extra.count) : main;
  }

  function jackpotOdds(game, count) {
    const denominator = jackpotSpace(game);
    if (!Number.isSafeInteger(count) || count < 1 || BigInt(count) > denominator) throw new RangeError('Invalid ticket count');
    const numerator = BigInt(count);
    if (game.id === 'uk-lotto') {
      return { numerator: numerator * (2n * denominator - numerator), denominator: denominator ** 2n };
    }
    return { numerator, denominator };
  }

  function numberKey(numbers) {
    return numbers.slice().sort((a, b) => a - b).join(',');
  }

  function uniqueTickets(game, lines) {
    return new Set(lines.map(line => numberKey(line.main) +
      (game.playerSelectedExtra ? '|' + numberKey(line.bonus) : ''))).size;
  }

  function unrank(pool, count, rank) {
    const numbers = [];
    for (let i = 0; count > 0; i++) {
      const block = choose(pool.length - i - 1, count - 1);
      if (rank < block) {
        numbers.push(pool[i]);
        count--;
      } else {
        rank -= block;
      }
    }
    return numbers;
  }

  function sampleLines(game, count, randomInt) {
    const mainPool = range(game.main);
    const extraRule = game.playerSelectedExtra;
    const extraPool = extraRule ? range(extraRule) : [];
    const extraCount = extraRule?.count || 0;
    const extras = choose(extraPool.length, extraCount);
    const size = Number(choose(mainPool.length, game.main.count) * extras);
    if (!Number.isSafeInteger(size) ||
        !Number.isSafeInteger(count) || count < 1 || count > size) throw new RangeError('Invalid batch size');
    // Partial Fisher–Yates over combination ranks. Store only the cells that move.
    const swaps = new Map();
    const lines = [];
    for (let i = 0; i < count; i++) {
      const last = size - i - 1;
      let selected;
      if (last < 0xFFFFFFFF) {
        selected = randomInt(0, last);
      } else {
        // Use equally likely blocks of 32 bits, discarding the incomplete tail.
        const blockSize = 0x100000000;
        const blocks = Math.ceil((last + 1) / blockSize);
        do {
          selected = randomInt(0, blocks - 1) * blockSize +
            randomInt(0, 0xFFFF) * 0x10000 + randomInt(0, 0xFFFF);
        } while (selected > last);
      }
      const rank = BigInt(swaps.get(selected) ?? selected);
      swaps.set(selected, swaps.get(last) ?? last);
      swaps.delete(last);
      const main = unrank(mainPool, game.main.count, rank / extras);
      lines.push({ main, bonus: unrank(extraPool, extraCount, rank % extras) });
    }
    return lines;
  }

  function validNumbers(numbers, pool) {
    return Array.isArray(numbers) && numbers.length === pool.count && new Set(numbers).size === pool.count &&
      numbers.every(n => Number.isInteger(n) && n >= pool.min && n <= pool.max);
  }

  function summarize(draws, rule) {
    if (!draws.length) return null;
    const extra = drawExtraPool(rule);
    const main = range(rule.main).map(number => ({ number, count: 0 }));
    const bonus = extra ? range(extra).map(number => ({ number, count: 0 })) : null;
    const dates = new Set();
    for (const draw of draws) {
      if (dates.has(draw.date) || !validNumbers(draw.main, rule.main) ||
          !validNumbers(draw.bonus, extra || { count: 0 }) ||
          ((rule.drawBonus || rule.bonus?.type === 'remaining_main') && draw.bonus.some(n => draw.main.includes(n)))) {
        throw new Error('Invalid or duplicate draw ' + draw.date);
      }
      dates.add(draw.date);
      draw.main.forEach(n => main[n - rule.main.min].count++);
      draw.bonus.forEach(n => bonus[n - extra.min].count++);
    }
    const sortedDates = [...dates].sort();
    return { start: sortedDates[0], end: sortedDates.at(-1), count: draws.length, main, bonus };
  }

  function rankings(frequencies) {
    return {
      hot: frequencies.slice().sort((a, b) => b.count - a.count || a.number - b.number).slice(0, 5),
      cold: frequencies.slice().sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 5)
    };
  }

  const labels = {
    ko: {
      odds: '1등 당첨 확률',
      single: '1개 조합',
      batch: '같은 회차 · 서로 다른 구매 조합',
      reciprocal: '분의 1',
      history: '최근 5년 HOT / COLD',
      notice: '과거 출현 빈도는 미래 당첨을 예측하지 않습니다.',
      pending: '공식 당첨 데이터 준비 중',
      draws: '추첨 횟수',
      updated: '갱신일',
      source: '공식 데이터 출처',
      previous: '이전 규칙',
      frequency: '전체 번호 출현 빈도',
      rounds: '라운드당 확률',
      classic: 'Classic Draw 기준',
      configured: '설정된 번호 풀 기준'
    },
    en: {
      odds: 'Jackpot odds',
      single: 'Single entry',
      batch: 'Same draw · distinct entries',
      reciprocal: '1 in',
      history: 'Five-year HOT / COLD',
      notice: 'Past frequencies do not predict future draws.',
      pending: 'Official draw data in preparation',
      draws: 'Draws',
      updated: 'Updated',
      source: 'Official data source',
      previous: 'Previous rules',
      frequency: 'Frequency of every number',
      rounds: 'Jackpot in at least one of the two rounds',
      classic: 'Classic Draw',
      configured: 'Based on the configured number pools'
    },
    ja: {
      odds: '1等当せん確率',
      single: '1口',
      batch: '同じ抽せん回・異なる購入番号',
      reciprocal: '分の1',
      history: '直近5年の HOT / COLD',
      notice: '過去の出現頻度から将来の当せん番号は予測できません。',
      pending: '公式当せんデータを準備中',
      draws: '抽せん回数',
      updated: '更新日',
      source: '公式データ出典',
      previous: '旧ルール',
      frequency: '全数字の出現回数',
      rounds: '各ラウンドの確率',
      classic: 'Classic Draw の確率',
      configured: '設定された数字の範囲で計算'
    },
    'pt-BR': {
      odds: 'Chances do prêmio principal',
      single: 'Uma aposta',
      batch: 'Mesmo sorteio · apostas distintas',
      reciprocal: '1 em',
      history: 'HOT / COLD em cinco anos',
      notice: 'A frequência histórica não prevê sorteios futuros.',
      pending: 'Dados oficiais dos sorteios em preparação',
      draws: 'Sorteios',
      updated: 'Atualização',
      source: 'Fonte oficial',
      previous: 'Regras anteriores',
      frequency: 'Frequência de todos os números',
      rounds: 'Pr?mio principal em pelo menos uma das duas rodadas',
      classic: 'Classic Draw',
      configured: 'Com base nos grupos de números configurados'
    }
  };

  function element(tag, content, parent) {
    const node = document.createElement(tag);
    node.textContent = content;
    parent.append(node);
    return node;
  }

  function formatOdds(odds, lang, reciprocalLabel) {
    const { numerator, denominator } = odds;
    const percent = new Intl.NumberFormat(lang, { style: 'percent', maximumSignificantDigits: 8 })
      .format(Number(numerator) / Number(denominator));
    const divisor = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 })
      .format(Number(denominator) / Number(numerator));
    const reciprocal = lang === 'ko' || lang === 'ja' ? divisor + reciprocalLabel : reciprocalLabel + ' ' + divisor;
    return percent + ' · ' + (denominator % numerator ? '≈ ' : '') + reciprocal;
  }

  function renderOdds(game, lang, count, lines) {
    const target = document.getElementById('jackpot-odds');
    const t = labels[lang];
    target.replaceChildren();
    element('h2', t.odds, target);
    const scope = { 'uk-lotto': t.rounds, 'ca-lotto-649': t.classic, 'za-powerball': t.configured }[game.id];
    if (scope) element('p', scope, target);
    const actualCount = lines.length ? uniqueTickets(game, lines) : count;
    element('p', t.single + ' · ' + formatOdds(jackpotOdds(game, 1), lang, t.reciprocal), target);
    element('p', t.batch + ' (' + actualCount + ') · ' + formatOdds(jackpotOdds(game, actualCount), lang, t.reciprocal), target);
  }

  function renderPool(target, name, frequencies, frequencyLabel) {
    element('h4', name, target);
    const { hot, cold } = rankings(frequencies);
    for (const [label, rows] of [['HOT', hot], ['COLD', cold]]) {
      element('p', label + ' · ' + rows.map(row => row.number + ' (' + row.count + ')').join(', '), target);
    }
    const details = element('details', '', target);
    element('summary', name + ' · ' + frequencyLabel, details);
    const graph = element('ul', '', details);
    graph.className = 'frequency-graph';
    graph.setAttribute('aria-label', name);
    const max = Math.max(1, ...frequencies.map(row => row.count));
    for (const { number, count } of frequencies) {
      const row = element('li', '', graph);
      element('span', number, row);
      const meter = element('meter', '', row);
      meter.max = max;
      meter.value = count;
      meter.setAttribute('aria-label', name + ' ' + number);
      element('span', count, row);
    }
  }

  let historyRequest = 0;
  let archive;
  async function renderHistory(game, lang, mainLabel, ballLabels, gameEntry) {
    const request = ++historyRequest;
    const target = document.getElementById('draw-analysis');
    const t = labels[lang];
    target.replaceChildren();
    element('h2', t.history, target);
    element('p', t.notice, target);
    const content = element('div', '', target);
    try {
      if (!gameEntry) {
        archive ||= fetch('data/analysis.json').then(response => {
          if (!response.ok) throw new Error('Analysis unavailable');
          return response.json();
        }).catch(() => {
          archive = null;
          return {};
        });
      }
      const entry = gameEntry ? await gameEntry : (await archive)[game.id];
      if (request !== historyRequest) return;
      if (!entry?.current) element('p', t.pending, content);
      if (entry?.source) {
        const link = element('a', t.source + ' · ' + entry.source.name, element('p', '', content));
        link.href = entry.source.url;
      }
      if (!entry?.current) return;
      const format = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' });
      const date = value => format.format(new Date(value));
      element('p', t.updated + ' · ' + date(entry.updated), content);
      const renderPeriod = (period, parent) => {
        element('h3', (period.rule ? period.rule + ' ? ' : '') + date(period.start) + ' – ' + date(period.end) + ' · ' + t.draws + ' ' + period.count, parent);
        renderPool(parent, mainLabel, period.main, t.frequency);
        if (period.bonus) renderPool(parent, ballLabels[(game.playerSelectedExtra || game.drawBonus)?.labelKey], period.bonus, t.frequency);
      };
      renderPeriod(entry.current, content);
      if (entry.previous?.length) {
        const details = element('details', '', content);
        element('summary', t.previous, details);
        entry.previous.forEach(period => renderPeriod(period, details));
      }
    } catch {
      if (request === historyRequest) {
        content.replaceChildren();
        element('p', t.pending, content);
      }
    }
  }

  const api = { choose, jackpotOdds, uniqueTickets, sampleLines, summarize, rankings, renderOdds, renderHistory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.lotteryAnalysis = api;
})();
