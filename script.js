/**
 * World Lottery Number Generator
 * Accurate rules and pool logic as of November 11, 2026.
 */

(function () {
  'use strict';

  // 1. Countries definition
  // Requirement 4: Display country names without flag icons or two-letter prefixes.
  // Use 대한민국, United States, United Kingdom, Europe (Multi-country), 日本, Canada, Australia, Brasil, Singapore, South Africa.
  const COUNTRIES = [
    { id: 'KR', name: '대한민국', lang: 'ko' },
    { id: 'US', name: 'United States', lang: 'en' },
    { id: 'GB', name: 'United Kingdom', lang: 'en' },
    { id: 'EU', name: 'Europe (Multi-country)', lang: 'en' },
    { id: 'JP', name: '日本', lang: 'ja' },
    { id: 'CA', name: 'Canada', lang: 'en' },
    { id: 'AU', name: 'Australia', lang: 'en' },
    { id: 'BR', name: 'Brasil', lang: 'pt-BR' },
    { id: 'SG', name: 'Singapore', lang: 'en' },
    { id: 'ZA', name: 'South Africa', lang: 'en' }
  ];

  // 2. Lottery Game Definitions
  // 14 games across 10 countries as specified:
  // - Korea Lotto 6/45: 6/45 + 1 bonus (remaining main pool)
  // - US Powerball: 5/69 + 1/26 (independent pool)
  // - US Mega Millions: 5/70 + 1/24 (independent pool)
  // - UK Lotto: 6/59 + 1 bonus (remaining main pool)
  // - EuroMillions: 5/50 + 2/12 Lucky Stars (independent pool)
  // - EuroJackpot: 5/50 + 2/12 Euro Numbers (independent pool)
  // - Japan LOTO 6: 6/43 + 1 bonus (remaining main pool)
  // - Japan LOTO 7: 7/37 + 2 bonus (remaining main pool)
  // - Canada Lotto 6/49: 6/49 + 1 bonus (remaining main pool)
  // - Australia Oz Lotto: 7/47 + 3 supplementary (remaining main pool)
  // - Australia Powerball: 7/35 + 1/20 (independent pool)
  // - Brazil Mega-Sena: 6/60 no bonus
  // - Singapore TOTO: 6/49 + 1 additional (remaining main pool)
  // - South Africa PowerBall: 5/50 + 1/20 (independent pool)

  const GAMES = [
    {
      id: 'kr-lotto-645',
      countryId: 'KR',
      name: 'Korea Lotto 6/45',
      displayName: '로또 6/45 (Lotto 6/45)',
      main: { min: 1, max: 45, count: 6 },
      bonus: {
        type: 'remaining_main',
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'korea',
      rulesText: {
        en: '6 main numbers from 1 to 45 (no replacement) + 1 bonus ball from the remaining 39 numbers.',
        ko: '1부터 45까지 중 본번호 6개 추첨 (중복 없음) + 남은 39개 중 보너스 번호 1개 추첨.',
        ja: '1〜45の中から本数字6個（重複なし）＋ 残り39個からボーナス数字1個を抽選。',
        'pt-BR': '6 números principais de 1 a 45 (sem reposição) + 1 bola bônus do grupo restante de 39.'
      }
    },
    {
      id: 'us-powerball',
      countryId: 'US',
      name: 'US Powerball',
      displayName: 'Powerball',
      main: { min: 1, max: 69, count: 5 },
      bonus: {
        type: 'independent',
        min: 1,
        max: 26,
        count: 1,
        labelKey: 'powerball'
      },
      ballStyle: 'us-powerball',
      rulesText: {
        en: '5 white balls from 1 to 69 (no replacement) + 1 red Powerball from independent pool 1 to 26.',
        ko: '1부터 69까지 화이트볼 5개 (중복 없음) + 독립 풀 1부터 26까지 레드 파워볼 1개 추첨.',
        ja: '1〜69の中から白ボール5個（重複なし）＋ 1〜26の独立枠から赤のパワーボール1個。',
        'pt-BR': '5 bolas brancas de 1 a 69 (sem reposição) + 1 Powerball vermelha do grupo independente de 1 a 26.'
      }
    },
    {
      id: 'us-megamillions',
      countryId: 'US',
      name: 'US Mega Millions',
      displayName: 'Mega Millions',
      main: { min: 1, max: 70, count: 5 },
      bonus: {
        type: 'independent',
        min: 1,
        max: 24,
        count: 1,
        labelKey: 'megaball'
      },
      ballStyle: 'us-megamillions',
      rulesText: {
        en: '5 white balls from 1 to 70 (no replacement) + 1 golden Mega Ball from independent pool 1 to 24.',
        ko: '1부터 70까지 화이트볼 5개 (중복 없음) + 독립 풀 1부터 24까지 골드 메가볼 1개 추첨.',
        ja: '1〜70の中から白ボール5個（重複なし）＋ 1〜24の独立枠からゴールドのメガボール1個。',
        'pt-BR': '5 bolas brancas de 1 a 70 (sem reposição) + 1 Mega Ball dourada do grupo independente de 1 a 24.'
      }
    },
    {
      id: 'uk-lotto',
      countryId: 'GB',
      name: 'UK Lotto',
      displayName: 'UK Lotto',
      main: { min: 1, max: 59, count: 6 },
      bonus: {
        type: 'remaining_main',
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'uk-lotto',
      rulesText: {
        en: '6 main numbers from 1 to 59 (no replacement) + 1 bonus ball from the remaining 53 numbers.',
        ko: '1부터 59까지 본번호 6개 추첨 (중복 없음) + 남은 53개 중 보너스 번호 1개 추첨.',
        ja: '1〜59の中から本数字6個（重複なし）＋ 残り53個からボーナス数字1個を抽選。',
        'pt-BR': '6 números principais de 1 a 59 (sem reposição) + 1 bola bônus do grupo restante de 53.'
      }
    },
    {
      id: 'eu-euromillions',
      countryId: 'EU',
      name: 'EuroMillions',
      displayName: 'EuroMillions',
      main: { min: 1, max: 50, count: 5 },
      bonus: {
        type: 'independent',
        min: 1,
        max: 12,
        count: 2,
        labelKey: 'lucky_stars'
      },
      ballStyle: 'euromillions',
      rulesText: {
        en: '5 main numbers from 1 to 50 (no replacement) + 2 Lucky Stars from independent pool 1 to 12.',
        ko: '1부터 50까지 본번호 5개 (중복 없음) + 독립 풀 1부터 12까지 럭키 스타 2개 추첨.',
        ja: '1〜50の中から本数字5個（重複なし）＋ 1〜12の独立枠からラッキースター2個。',
        'pt-BR': '5 números principais de 1 a 50 (sem reposição) + 2 Estrelas da Sorte do grupo independente de 1 a 12.'
      }
    },
    {
      id: 'eu-eurojackpot',
      countryId: 'EU',
      name: 'EuroJackpot',
      displayName: 'EuroJackpot',
      main: { min: 1, max: 50, count: 5 },
      bonus: {
        type: 'independent',
        min: 1,
        max: 12,
        count: 2,
        labelKey: 'euro_numbers'
      },
      ballStyle: 'eurojackpot',
      rulesText: {
        en: '5 main numbers from 1 to 50 (no replacement) + 2 Euro Numbers from independent pool 1 to 12.',
        ko: '1부터 50까지 본번호 5개 (중복 없음) + 독립 풀 1부터 12까지 유로 넘버 2개 추첨.',
        ja: '1〜50の中から本数字5個（重複なし）＋ 1〜12の独立枠からユーロナンバー2個。',
        'pt-BR': '5 números principais de 1 a 50 (sem reposição) + 2 Números Euro do grupo independente de 1 a 12.'
      }
    },
    {
      id: 'jp-loto-6',
      countryId: 'JP',
      name: 'Japan LOTO 6',
      displayName: 'ロト6 (LOTO 6)',
      main: { min: 1, max: 43, count: 6 },
      bonus: {
        type: 'remaining_main',
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'japan',
      rulesText: {
        en: '6 main numbers from 1 to 43 (no replacement) + 1 bonus ball from the remaining 37 numbers.',
        ko: '1부터 43까지 본번호 6개 추첨 (중복 없음) + 남은 37개 중 보너스 번호 1개 추첨.',
        ja: '1〜43の中から本数字6個（重複なし）＋ 残り37個からボーナス数字1個を抽選。',
        'pt-BR': '6 números principais de 1 a 43 (sem reposição) + 1 bola bônus do grupo restante de 37.'
      }
    },
    {
      id: 'jp-loto-7',
      countryId: 'JP',
      name: 'Japan LOTO 7',
      displayName: 'ロト7 (LOTO 7)',
      main: { min: 1, max: 37, count: 7 },
      bonus: {
        type: 'remaining_main',
        count: 2,
        labelKey: 'bonus'
      },
      ballStyle: 'japan',
      rulesText: {
        en: '7 main numbers from 1 to 37 (no replacement) + 2 bonus balls from the remaining 30 numbers.',
        ko: '1부터 37까지 본번호 7개 추첨 (중복 없음) + 남은 30개 중 보너스 번호 2개 추첨.',
        ja: '1〜37の中から本数字7個（重複なし）＋ 残り30個からボーナス数字2個を抽選。',
        'pt-BR': '7 números principais de 1 a 37 (sem reposição) + 2 bolas bônus do grupo restante de 30.'
      }
    },
    {
      id: 'ca-lotto-649',
      countryId: 'CA',
      name: 'Canada Lotto 6/49',
      displayName: 'Lotto 6/49',
      main: { min: 1, max: 49, count: 6 },
      bonus: {
        type: 'remaining_main',
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'canada',
      rulesText: {
        en: '6 main numbers from 1 to 49 (no replacement) + 1 bonus ball from the remaining 43 numbers.',
        ko: '1부터 49까지 본번호 6개 추첨 (중복 없음) + 남은 43개 중 보너스 번호 1개 추첨.',
        ja: '1〜49の中から本数字6個（重複なし）＋ 残り43個からボーナス数字1個を抽選。',
        'pt-BR': '6 números principais de 1 a 49 (sem reposição) + 1 bola bônus do grupo restante de 43.'
      }
    },
    {
      id: 'au-oz-lotto',
      countryId: 'AU',
      name: 'Australia Oz Lotto',
      displayName: 'Oz Lotto',
      main: { min: 1, max: 47, count: 7 },
      bonus: {
        type: 'remaining_main',
        count: 3,
        labelKey: 'supplementary'
      },
      ballStyle: 'oz-lotto',
      rulesText: {
        en: '7 main numbers from 1 to 47 (no replacement) + 3 supplementary balls from the remaining 40 numbers.',
        ko: '1부터 47까지 본번호 7개 추첨 (중복 없음) + 남은 40개 중 추가 번호 3개 추첨.',
        ja: '1〜47の中から本数字7個（重複なし）＋ 残り40個から特別数字3個を抽選。',
        'pt-BR': '7 números principais de 1 a 47 (sem reposição) + 3 bolas suplementares do grupo restante de 40.'
      }
    },
    {
      id: 'au-powerball',
      countryId: 'AU',
      name: 'Australia Powerball',
      displayName: 'Powerball (Australia)',
      main: { min: 1, max: 35, count: 7 },
      bonus: {
        type: 'independent',
        min: 1,
        max: 20,
        count: 1,
        labelKey: 'powerball'
      },
      ballStyle: 'au-powerball',
      rulesText: {
        en: '7 main numbers from 1 to 35 (no replacement) + 1 Powerball from independent pool 1 to 20.',
        ko: '1부터 35까지 본번호 7개 (중복 없음) + 독립 풀 1부터 20까지 파워볼 1개 추첨.',
        ja: '1〜35の中から本数字7個（重複なし）＋ 1〜20の独立枠からパワーボール1個。',
        'pt-BR': '7 números principais de 1 a 35 (sem reposição) + 1 Powerball do grupo independente de 1 a 20.'
      }
    },
    {
      id: 'br-mega-sena',
      countryId: 'BR',
      name: 'Brazil Mega-Sena',
      displayName: 'Mega-Sena',
      main: { min: 1, max: 60, count: 6 },
      bonus: {
        type: 'none',
        count: 0,
        labelKey: null
      },
      ballStyle: 'megasena',
      rulesText: {
        en: '6 main numbers from 1 to 60 (no replacement, no bonus ball).',
        ko: '1부터 60까지 본번호 6개 추첨 (중복 없음, 보너스 공 없음).',
        ja: '1〜60の中から本数字6個（重複なし、ボーナス数字なし）。',
        'pt-BR': '6 números principais de 1 a 60 (sem reposição, sem bola bônus).'
      }
    },
    {
      id: 'sg-toto',
      countryId: 'SG',
      name: 'Singapore TOTO',
      displayName: 'TOTO',
      main: { min: 1, max: 49, count: 6 },
      bonus: {
        type: 'remaining_main',
        count: 1,
        labelKey: 'additional'
      },
      ballStyle: 'singapore',
      rulesText: {
        en: '6 main numbers from 1 to 49 (no replacement) + 1 additional ball from the remaining 43 numbers.',
        ko: '1부터 49까지 본번호 6개 추첨 (중복 없음) + 남은 43개 중 추가 번호 1개 추첨.',
        ja: '1〜49の中から本数字6個（重複なし）＋ 残り43個から追加数字1個を抽選。',
        'pt-BR': '6 números principais de 1 a 49 (sem reposição) + 1 bola adicional do grupo restante de 43.'
      }
    },
    {
      id: 'za-powerball',
      countryId: 'ZA',
      name: 'South Africa PowerBall',
      displayName: 'PowerBall',
      main: { min: 1, max: 50, count: 5 },
      bonus: {
        type: 'independent',
        min: 1,
        max: 20,
        count: 1,
        labelKey: 'powerball'
      },
      ballStyle: 'za-powerball',
      rulesText: {
        en: '5 main numbers from 1 to 50 (no replacement) + 1 PowerBall from independent pool 1 to 20.',
        ko: '1부터 50까지 본번호 5개 (중복 없음) + 독립 풀 1부터 20까지 파워볼 1개 추첨.',
        ja: '1〜50の中から本数字5個（重複なし）＋ 1〜20の独立枠からパワーボール1個。',
        'pt-BR': '5 números principais de 1 a 50 (sem reposição) + 1 PowerBall do grupo independente de 1 a 20.'
      }
    }
  ];

  // 3. Translations Dictionary
  // Requirement 3: Website title, introductory description, Country label, Lottery Name label remain in English at all times.
  // Requirement 5: Localize the remaining interface, including number units, according to selected country.
  const TRANSLATIONS = {
    en: {
      quantityLabel: 'Quantity',
      quantityUnits: {
        1: '1 set',
        3: '3 sets',
        5: '5 sets',
        10: '10 sets'
      },
      btnGenerate: 'Generate Numbers',
      btnCopyAll: 'Copy All Numbers',
      btnClear: 'Clear',
      resultsHeading: 'Generated Numbers',
      emptyState: 'Select your lottery and quantity above, then click "Generate Numbers".',
      lineLabel: 'Set',
      btnCopyLine: 'Copy',
      copiedLine: 'Copied!',
      toastCopiedAll: 'All numbers copied to clipboard!',
      toastCopiedLine: 'Set numbers copied to clipboard!',
      mainLabel: 'Main Numbers',
      ruleHeading: 'Official Draw Mechanics',
      ballLabels: {
        bonus: 'Bonus',
        powerball: 'Powerball',
        megaball: 'Mega Ball',
        lucky_stars: 'Lucky Stars',
        euro_numbers: 'Euro Numbers',
        supplementary: 'Supplementary',
        additional: 'Additional'
      }
    },
    ko: {
      quantityLabel: '생성 수량',
      quantityUnits: {
        1: '1게임',
        3: '3게임',
        5: '5게임',
        10: '10게임'
      },
      btnGenerate: '번호 생성하기',
      btnCopyAll: '전체 번호 복사',
      btnClear: '초기화',
      resultsHeading: '생성된 번호',
      emptyState: '상단에서 복권 종류와 수량을 선택한 후 "번호 생성하기" 버튼을 눌러주세요.',
      lineLabel: '게임',
      btnCopyLine: '복사',
      copiedLine: '복사됨!',
      toastCopiedAll: '전체 번호가 클립보드에 복사되었습니다!',
      toastCopiedLine: '해당 게임 번호가 클립보드에 복사되었습니다!',
      mainLabel: '메인 번호',
      ruleHeading: '공식 추첨 규칙',
      ballLabels: {
        bonus: '보너스',
        powerball: '파워볼',
        megaball: '메가볼',
        lucky_stars: '럭키 스타',
        euro_numbers: '유로 넘버',
        supplementary: '추가 번호',
        additional: '추가 번호'
      }
    },
    ja: {
      quantityLabel: '購入口数',
      quantityUnits: {
        1: '1口',
        3: '3口',
        5: '5口',
        10: '10口'
      },
      btnGenerate: '数字を生成する',
      btnCopyAll: '全件コピー',
      btnClear: 'クリア',
      resultsHeading: '生成結果',
      emptyState: '宝くじと購入口数を選択し、「数字を生成する」ボタンを押してください。',
      lineLabel: '口目',
      btnCopyLine: 'コピー',
      copiedLine: 'コピー完了!',
      toastCopiedAll: 'すべての数字がクリップボードにコピーされました！',
      toastCopiedLine: '選択した数字がクリップボードにコピーされました！',
      mainLabel: '本数字',
      ruleHeading: '公式抽選ルール',
      ballLabels: {
        bonus: 'ボーナス数字',
        powerball: 'パワーボール',
        megaball: 'メガボール',
        lucky_stars: 'ラッキースター',
        euro_numbers: 'ユーロナンバー',
        supplementary: '特別数字',
        additional: '追加数字'
      }
    },
    'pt-BR': {
      quantityLabel: 'Quantidade de Jogos',
      quantityUnits: {
        1: '1 jogo',
        3: '3 jogos',
        5: '5 jogos',
        10: '10 jogos'
      },
      btnGenerate: 'Gerar Números',
      btnCopyAll: 'Copiar Todos os Números',
      btnClear: 'Limpar',
      resultsHeading: 'Números Gerados',
      emptyState: 'Selecione a loteria e a quantidade acima, depois clique em "Gerar Números".',
      lineLabel: 'Jogo',
      btnCopyLine: 'Copiar',
      copiedLine: 'Copiado!',
      toastCopiedAll: 'Todos os números foram copiados para a área de transferência!',
      toastCopiedLine: 'Jogo copiado para a área de transferência!',
      mainLabel: 'Números Principais',
      ruleHeading: 'Regras Oficiais do Sorteio',
      ballLabels: {
        bonus: 'Bônus',
        powerball: 'Powerball',
        megaball: 'Mega Ball',
        lucky_stars: 'Estrelas da Sorte',
        euro_numbers: 'Números Euro',
        supplementary: 'Suplementares',
        additional: 'Adicional'
      }
    }
  };

  // 4. Secure Random Number Utilities
  // Cryptographically uniform integer in range [min, max]
  function getRandomInt(min, max) {
    if (min === max) return min;
    const range = max - min + 1;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      // Rejection sampling to avoid modulo bias
      const maxUint = 0xFFFFFFFF;
      const limit = maxUint - (maxUint % range);
      const buffer = new Uint32Array(1);
      let randVal;
      do {
        window.crypto.getRandomValues(buffer);
        randVal = buffer[0];
      } while (randVal >= limit);
      return min + (randVal % range);
    }
    return Math.floor(Math.random() * range) + min;
  }

  // Draw distinct numbers without replacement
  function drawDistinctFromPool(pool, count) {
    const poolCopy = pool.slice();
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (poolCopy.length === 0) break;
      const index = getRandomInt(0, poolCopy.length - 1);
      drawn.push(poolCopy[index]);
      poolCopy.splice(index, 1);
    }
    return {
      drawn: drawn.sort((a, b) => a - b),
      remaining: poolCopy
    };
  }

  function createRange(min, max) {
    const list = [];
    for (let i = min; i <= max; i++) {
      list.push(i);
    }
    return list;
  }

  // Draw single game line according to exact game specifications
  function generateGameLine(game) {
    // 1. Draw main numbers from 1..main.max without replacement
    const mainPool = createRange(game.main.min, game.main.max);
    const mainDraw = drawDistinctFromPool(mainPool, game.main.count);
    const mainNumbers = mainDraw.drawn;

    let bonusNumbers = [];
    if (game.bonus.type === 'remaining_main') {
      // Bonus numbers drawn from remaining pool of main numbers without replacement
      const bonusDraw = drawDistinctFromPool(mainDraw.remaining, game.bonus.count);
      bonusNumbers = bonusDraw.drawn;
    } else if (game.bonus.type === 'independent') {
      // Special balls drawn from independent pool [bonus.min, bonus.max] without replacement
      const bonusPool = createRange(game.bonus.min, game.bonus.max);
      const bonusDraw = drawDistinctFromPool(bonusPool, game.bonus.count);
      bonusNumbers = bonusDraw.drawn;
    }

    return {
      main: mainNumbers,
      bonus: bonusNumbers
    };
  }

  // 5. DOM Elements Cache
  let countrySelect = null;
  let gameSelect = null;
  let quantitySelect = null;
  let quantityLabel = null;
  let btnGenerate = null;
  let btnCopyAll = null;
  let btnClear = null;
  let ruleContainer = null;
  let ruleHeading = null;
  let ruleText = null;
  let resultsHeading = null;
  let resultsContainer = null;
  let emptyState = null;
  let liveRegion = null;
  let toast = null;

  function cacheDomElements() {
    if (typeof document === 'undefined') return false;
    countrySelect = document.getElementById('country-select');
    gameSelect = document.getElementById('game-select');
    quantitySelect = document.getElementById('quantity-select');
    quantityLabel = document.getElementById('quantity-label');
    btnGenerate = document.getElementById('btn-generate');
    btnCopyAll = document.getElementById('btn-copy-all');
    btnClear = document.getElementById('btn-clear');
    ruleContainer = document.getElementById('rule-container');
    ruleHeading = document.getElementById('rule-heading');
    ruleText = document.getElementById('rule-text');
    resultsHeading = document.getElementById('results-heading');
    resultsContainer = document.getElementById('results-container');
    emptyState = document.getElementById('empty-state');
    liveRegion = document.getElementById('live-region');
    toast = document.getElementById('toast');
    return Boolean(countrySelect && gameSelect);
  }

  let currentResults = [];
  let toastTimeout = null;

  // 6. Helpers
  function getCurrentCountry() {
    if (!countrySelect) return COUNTRIES[0];
    const id = countrySelect.value;
    return COUNTRIES.find(c => c.id === id) || COUNTRIES[0];
  }

  function getCurrentGame() {
    if (!gameSelect) return GAMES[0];
    const id = gameSelect.value;
    return GAMES.find(g => g.id === id) || GAMES[0];
  }

  function getI18n() {
    const country = getCurrentCountry();
    return TRANSLATIONS[country.lang] || TRANSLATIONS.en;
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  function announce(message) {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  // 7. UI Localization & Game Population
  function populateCountries() {
    countrySelect.innerHTML = '';
    COUNTRIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      // Requirement 4: Country names without flag icons or two-letter prefixes.
      opt.textContent = c.name;
      countrySelect.appendChild(opt);
    });
  }

  function updateGamesForCountry(selectedCountryId, preserveGameId) {
    const filteredGames = GAMES.filter(g => g.countryId === selectedCountryId);
    gameSelect.innerHTML = '';
    filteredGames.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.displayName;
      gameSelect.appendChild(opt);
    });

    if (preserveGameId && filteredGames.some(g => g.id === preserveGameId)) {
      gameSelect.value = preserveGameId;
    } else if (filteredGames.length > 0) {
      gameSelect.value = filteredGames[0].id;
    }
  }

  function updateInterfaceLocalization() {
    const country = getCurrentCountry();
    const game = getCurrentGame();
    const t = getI18n();

    // Set document lang attribute for accessibility
    document.documentElement.lang = country.lang;

    // Localize remaining interface (Requirement 5)
    // NOTE: Title, intro, Country label, Lottery Name label are KEPT IN ENGLISH (Requirement 3)
    if (quantityLabel) quantityLabel.textContent = t.quantityLabel;
    if (btnGenerate) btnGenerate.textContent = t.btnGenerate;
    if (btnCopyAll) btnCopyAll.textContent = t.btnCopyAll;
    if (btnClear) btnClear.textContent = t.btnClear;
    if (resultsHeading) resultsHeading.textContent = t.resultsHeading;
    if (ruleHeading) ruleHeading.textContent = t.ruleHeading;

    // Update quantity options with localized units
    const currentQty = quantitySelect.value || '5';
    const quantities = [1, 3, 5, 10];
    quantitySelect.innerHTML = '';
    quantities.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q;
      opt.textContent = t.quantityUnits[q] || `${q}`;
      if (String(q) === String(currentQty)) {
        opt.selected = true;
      }
      quantitySelect.appendChild(opt);
    });

    // Update rule text
    if (ruleText && game) {
      ruleText.textContent = game.rulesText[country.lang] || game.rulesText.en;
    }

    // Update empty state text if empty
    if (emptyState && currentResults.length === 0) {
      emptyState.textContent = t.emptyState;
    }

    // If there are already generated results, re-render them with new labels
    if (currentResults.length > 0) {
      renderResults(currentResults, false);
    }
  }

  // 8. Ball Styling Helpers
  function getBallClass(ballNumber, ballStyle, isBonus) {
    if (ballStyle === 'korea') {
      if (ballNumber <= 10) return 'ball-kr-1';
      if (ballNumber <= 20) return 'ball-kr-11';
      if (ballNumber <= 30) return 'ball-kr-21';
      if (ballNumber <= 40) return 'ball-kr-31';
      return 'ball-kr-41';
    }
    if (ballStyle === 'us-powerball') {
      return isBonus ? 'ball-powerball' : 'ball-standard-white';
    }
    if (ballStyle === 'us-megamillions') {
      return isBonus ? 'ball-megaball' : 'ball-standard-white';
    }
    if (ballStyle === 'euromillions') {
      return isBonus ? 'ball-star' : 'ball-eu-blue';
    }
    if (ballStyle === 'eurojackpot') {
      return isBonus ? 'ball-euro-gold' : 'ball-standard-white';
    }
    if (ballStyle === 'japan') {
      return isBonus ? 'ball-jp-bonus' : 'ball-jp-main';
    }
    if (ballStyle === 'canada') {
      return isBonus ? 'ball-ca-bonus' : 'ball-ca-main';
    }
    if (ballStyle === 'oz-lotto') {
      return isBonus ? 'ball-oz-supp' : 'ball-oz-main';
    }
    if (ballStyle === 'au-powerball') {
      return isBonus ? 'ball-au-power' : 'ball-au-main';
    }
    if (ballStyle === 'megasena') {
      return 'ball-megasena';
    }
    if (ballStyle === 'singapore') {
      return isBonus ? 'ball-sg-bonus' : 'ball-sg-main';
    }
    if (ballStyle === 'za-powerball') {
      return isBonus ? 'ball-za-power' : 'ball-za-main';
    }
    return isBonus ? 'ball-bonus' : 'ball-standard';
  }

  // 9. Results Rendering
  function renderResults(sets, animate = true) {
    currentResults = sets;
    resultsContainer.innerHTML = '';

    if (!sets || sets.length === 0) {
      emptyState.style.display = 'block';
      emptyState.textContent = getI18n().emptyState;
      btnCopyAll.disabled = true;
      return;
    }

    emptyState.style.display = 'none';
    btnCopyAll.disabled = false;

    const game = getCurrentGame();
    const country = getCurrentCountry();
    const t = getI18n();

    const bonusLabelText = game.bonus.labelKey ? (t.ballLabels[game.bonus.labelKey] || 'Bonus') : '';

    sets.forEach((set, index) => {
      const row = document.createElement('div');
      row.className = 'result-row';
      if (animate) {
        row.style.animationDelay = `${index * 0.06}s`;
      }

      // Line header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'result-row-header';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'result-line-title';

      // Format line label according to locale
      if (country.lang === 'ko') {
        titleSpan.textContent = `${index + 1}${t.lineLabel}`;
      } else if (country.lang === 'ja') {
        titleSpan.textContent = `${index + 1}${t.lineLabel}`;
      } else {
        titleSpan.textContent = `${t.lineLabel} ${index + 1}`;
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-copy-line';
      copyBtn.setAttribute('aria-label', `${t.btnCopyLine} (${titleSpan.textContent})`);
      copyBtn.innerHTML = `
        <svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path fill="currentColor" d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
        <span>${t.btnCopyLine}</span>
      `;

      copyBtn.addEventListener('click', () => {
        copySingleLine(game, set, index + 1, copyBtn);
      });

      headerDiv.appendChild(titleSpan);
      headerDiv.appendChild(copyBtn);
      row.appendChild(headerDiv);

      // Balls container
      const ballsWrapper = document.createElement('div');
      ballsWrapper.className = 'balls-wrapper';

      // Main balls group
      const mainGroup = document.createElement('div');
      mainGroup.className = 'balls-group main-balls';
      mainGroup.setAttribute('aria-label', t.mainLabel);

      set.main.forEach((num, ballIdx) => {
        const ball = document.createElement('span');
        ball.className = `lotto-ball ${getBallClass(num, game.ballStyle, false)}`;
        ball.textContent = num;
        if (animate) {
          ball.classList.add('ball-animate');
          ball.style.animationDelay = `${(index * 0.06) + (ballIdx * 0.04)}s`;
        }
        mainGroup.appendChild(ball);
      });
      ballsWrapper.appendChild(mainGroup);

      // Bonus / Supplementary balls group if applicable
      if (set.bonus && set.bonus.length > 0) {
        const divider = document.createElement('span');
        divider.className = 'bonus-divider';
        divider.textContent = '+';
        divider.setAttribute('aria-hidden', 'true');
        ballsWrapper.appendChild(divider);

        const bonusGroup = document.createElement('div');
        bonusGroup.className = 'balls-group bonus-balls';
        bonusGroup.setAttribute('aria-label', bonusLabelText);

        const bonusBadge = document.createElement('span');
        bonusBadge.className = 'bonus-badge';
        bonusBadge.textContent = bonusLabelText;
        bonusGroup.appendChild(bonusBadge);

        set.bonus.forEach((bNum, bIdx) => {
          const bBall = document.createElement('span');
          bBall.className = `lotto-ball ${getBallClass(bNum, game.ballStyle, true)}`;
          bBall.textContent = bNum;
          if (animate) {
            bBall.classList.add('ball-animate');
            bBall.style.animationDelay = `${(index * 0.06) + ((set.main.length + bIdx) * 0.04)}s`;
          }
          bonusGroup.appendChild(bBall);
        });

        ballsWrapper.appendChild(bonusGroup);
      }

      row.appendChild(ballsWrapper);
      resultsContainer.appendChild(row);
    });

    announce(`${sets.length} ${game.name} combinations generated.`);
  }

  // 10. Draw Action
  function handleGenerate() {
    const game = getCurrentGame();
    const count = parseInt(quantitySelect.value, 10) || 5;

    const sets = [];
    for (let i = 0; i < count; i++) {
      sets.push(generateGameLine(game));
    }

    renderResults(sets, true);
  }

  function handleClear() {
    currentResults = [];
    renderResults([], false);
    announce('Results cleared.');
  }

  // 11. Clipboard Copy Helpers
  function formatLineString(game, set, lineNum) {
    const t = getI18n();
    const country = getCurrentCountry();
    let prefix = '';
    if (country.lang === 'ko' || country.lang === 'ja') {
      prefix = `${lineNum}${t.lineLabel}: `;
    } else {
      prefix = `${t.lineLabel} ${lineNum}: `;
    }

    const mainStr = set.main.join(', ');
    if (set.bonus && set.bonus.length > 0) {
      const bLabel = game.bonus.labelKey ? (t.ballLabels[game.bonus.labelKey] || 'Bonus') : 'Bonus';
      const bonusStr = set.bonus.join(', ');
      return `${prefix}${mainStr} + [${bLabel}: ${bonusStr}]`;
    }
    return `${prefix}${mainStr}`;
  }

  function copySingleLine(game, set, lineNum, buttonElement) {
    const text = `${game.name} - ${formatLineString(game, set, lineNum)}`;
    navigator.clipboard.writeText(text).then(() => {
      const t = getI18n();
      showToast(t.toastCopiedLine);
      const span = buttonElement.querySelector('span');
      if (span) {
        const originalText = span.textContent;
        span.textContent = t.copiedLine;
        buttonElement.classList.add('copied');
        setTimeout(() => {
          span.textContent = originalText;
          buttonElement.classList.remove('copied');
        }, 1600);
      }
    }).catch(() => {
      fallbackCopy(text);
    });
  }

  function copyAllResults() {
    if (!currentResults || currentResults.length === 0) return;
    const game = getCurrentGame();
    const t = getI18n();
    const lines = [
      `World Lottery Number Generator - ${game.name}`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
      '----------------------------------------'
    ];

    currentResults.forEach((set, idx) => {
      lines.push(formatLineString(game, set, idx + 1));
    });

    lines.push('----------------------------------------');
    lines.push('Generated with verified mechanics (as of Nov 11, 2026).');

    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      showToast(t.toastCopiedAll);
    }).catch(() => {
      fallbackCopy(fullText);
    });
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(getI18n().toastCopiedAll);
    } catch (err) {
      alert('Unable to copy to clipboard.');
    }
    document.body.removeChild(textArea);
  }

  // 12. Event Listeners
  function initEvents() {
    countrySelect.addEventListener('change', () => {
      const selectedCountryId = countrySelect.value;
      updateGamesForCountry(selectedCountryId);
      updateInterfaceLocalization();
      // Clear past results when switching country for consistency
      handleClear();
    });

    gameSelect.addEventListener('change', () => {
      updateInterfaceLocalization();
      handleClear();
    });

    quantitySelect.addEventListener('change', () => {
      // If results are present, user might want to re-generate with new quantity
      if (currentResults.length > 0) {
        handleGenerate();
      }
    });

    btnGenerate.addEventListener('click', handleGenerate);
    btnCopyAll.addEventListener('click', copyAllResults);
    btnClear.addEventListener('click', handleClear);
  }

  // 13. Initialization
  function init() {
    if (typeof document === 'undefined') return;
    if (!cacheDomElements()) return;
    populateCountries();
    // Default: 대한민국 (KR)
    if (countrySelect) countrySelect.value = 'KR';
    updateGamesForCountry('KR');
    updateInterfaceLocalization();
    initEvents();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Export for test environments (Node.js unit tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      COUNTRIES,
      GAMES,
      TRANSLATIONS,
      getRandomInt,
      drawDistinctFromPool,
      generateGameLine,
      formatLineString
    };
  }
})();
