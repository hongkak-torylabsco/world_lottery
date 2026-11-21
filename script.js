/**
 * World Lottery Number Generator
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
  // - Korea Lotto 6/45: 6/45
  // - US Powerball: 5/69 + 1/26 (independent pool)
  // - US Mega Millions: 5/70 + 1/24 (independent pool)
  // - UK Lotto: 6/59
  // - EuroMillions: 5/50 + 2/12 Lucky Stars (independent pool)
  // - EuroJackpot: 5/50 + 2/12 Euro Numbers (independent pool)
  // - Japan LOTO 6: 6/43
  // - Japan LOTO 7: 7/37
  // - Canada Lotto 6/49: 6/49
  // - Australia Oz Lotto: 7/47
  // - Australia Powerball: 7/35 + 1/20 (independent pool)
  // - Brazil Mega-Sena: 6/60
  // - Singapore TOTO: 6/49
  // - South Africa PowerBall: 5/50 + 1/16 (independent pool)

  const GAMES = [
    {
      id: 'kr-lotto-645',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: '동행복권', url: 'https://m.dhlottery.co.kr/lt645/intro' },
          { name: '동행복권 추첨 결과', url: 'https://www.dhlottery.co.kr/lt645/winNumber' }
        ]
      },
      countryId: 'KR',
      name: 'Korea Lotto 6/45',
      displayName: '로또 6/45 (Lotto 6/45)',
      main: { min: 1, max: 45, count: 6 },
      drawBonus: {
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'korea'
    },
    {
      id: 'us-powerball',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'Powerball', url: 'https://www.powerball.com/' }
        ]
      },
      countryId: 'US',
      name: 'US Powerball',
      displayName: 'Powerball',
      main: { min: 1, max: 69, count: 5 },
      playerSelectedExtra: {
        min: 1,
        max: 26,
        count: 1,
        labelKey: 'powerball'
      },
      ballStyle: 'us-powerball',
      rulesText: {
        en: '5 white balls from 1 to 69 (no replacement) + 1 red Powerball from independent pool 1 to 26.',
        ko: '1부터 69까지 화이트볼 5개 (중복 없음) + 독립 풀 1부터 26까지 레드 파워볼 1개 선택.',
        ja: '1〜69の中から白ボール5個（重複なし）＋ 1〜26の独立枠から赤のパワーボール1個。',
        'pt-BR': '5 bolas brancas de 1 a 69 (sem reposição) + 1 Powerball vermelha do grupo independente de 1 a 26.'
      }
    },
    {
      id: 'us-megamillions',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'Mega Millions', url: 'https://www.megamillions.com/How-To-Play.aspx' }
        ]
      },
      countryId: 'US',
      name: 'US Mega Millions',
      displayName: 'Mega Millions',
      main: { min: 1, max: 70, count: 5 },
      playerSelectedExtra: {
        min: 1,
        max: 24,
        count: 1,
        labelKey: 'megaball'
      },
      ballStyle: 'us-megamillions',
      rulesText: {
        en: '5 white balls from 1 to 70 (no replacement) + 1 golden Mega Ball from independent pool 1 to 24.',
        ko: '1부터 70까지 화이트볼 5개 (중복 없음) + 독립 풀 1부터 24까지 골드 메가볼 1개 선택.',
        ja: '1〜70の中から白ボール5個（重複なし）＋ 1〜24の独立枠からゴールドのメガボール1個。',
        'pt-BR': '5 bolas brancas de 1 a 70 (sem reposição) + 1 Mega Ball dourada do grupo independente de 1 a 24.'
      }
    },
    {
      id: 'uk-lotto',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'Allwyn', url: 'https://www.allwyn.co.uk/insights/it-could-be-you-and-it-could-be-you-lotto-enters-exciting-new-chapter-under-allwyn' },
          { name: 'Gambling Commission', url: 'https://assets.ctfassets.net/j16ev64qyf6l/7jITNNjF4D2gj8yQHRz6Ov/c5cbf75c339e30a55a3d3bd1a7dd54e6/Section_6_Licence_Lotto_-_June_2026.pdf' }
        ]
      },
      countryId: 'GB',
      name: 'UK Lotto',
      displayName: 'UK Lotto',
      main: { min: 1, max: 59, count: 6 },
      drawBonus: {
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'uk-lotto',
      rulesText: {
        en: 'The same ticket numbers enter both rounds.',
        ko: '구매한 같은 번호로 두 라운드에 모두 참여합니다.',
        ja: '購入した同じ数字で2ラウンドに参加します。',
        'pt-BR': 'Os mesmos números da aposta entram nas duas rodadas.'
      }
    },
    {
      id: 'eu-euromillions',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'FDJ', url: 'https://cdn-media.fdj.fr/static/contrib/files/pdf/2025-03-reglement-euromillions.pdf' }
        ]
      },
      countryId: 'EU',
      name: 'EuroMillions',
      displayName: 'EuroMillions',
      main: { min: 1, max: 50, count: 5 },
      playerSelectedExtra: {
        min: 1,
        max: 12,
        count: 2,
        labelKey: 'lucky_stars'
      },
      ballStyle: 'euromillions',
      rulesText: {
        en: '5 main numbers from 1 to 50 (no replacement) + 2 Lucky Stars from independent pool 1 to 12.',
        ko: '1부터 50까지 본번호 5개 (중복 없음) + 독립 풀 1부터 12까지 럭키 스타 2개 선택.',
        ja: '1〜50の中から本数字5個（重複なし）＋ 1〜12の独立枠からラッキースター2個。',
        'pt-BR': '5 números principais de 1 a 50 (sem reposição) + 2 Estrelas da Sorte do grupo independente de 1 a 12.'
      }
    },
    {
      id: 'eu-eurojackpot',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'LOTTO.de', url: 'https://www.lotto.de/eurojackpot/spielregeln' },
          { name: 'Eurojackpot', url: 'https://www.eurojackpot.com/en/results/' }
        ]
      },
      countryId: 'EU',
      name: 'EuroJackpot',
      displayName: 'EuroJackpot',
      main: { min: 1, max: 50, count: 5 },
      playerSelectedExtra: {
        min: 1,
        max: 12,
        count: 2,
        labelKey: 'euro_numbers'
      },
      ballStyle: 'eurojackpot',
      rulesText: {
        en: '5 main numbers from 1 to 50 (no replacement) + 2 Euro Numbers from independent pool 1 to 12.',
        ko: '1부터 50까지 본번호 5개 (중복 없음) + 독립 풀 1부터 12까지 유로 넘버 2개 선택.',
        ja: '1〜50の中から本数字5個（重複なし）＋ 1〜12の独立枠からユーロナンバー2個。',
        'pt-BR': '5 números principais de 1 a 50 (sem reposição) + 2 Números Euro do grupo independente de 1 a 12.'
      }
    },
    {
      id: 'jp-loto-6',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: '宝くじ公式サイト', url: 'https://www.takarakuji-official.jp/kuji/loto/loto6/introduction2.html' }
        ]
      },
      countryId: 'JP',
      name: 'Japan LOTO 6',
      displayName: 'ロト6 (LOTO 6)',
      main: { min: 1, max: 43, count: 6 },
      drawBonus: {
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'japan'
    },
    {
      id: 'jp-loto-7',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'みずほ銀行', url: 'https://www.mizuhobank.co.jp/takarakuji/products/loto7/index.html' },
          { name: '宝くじ公式サイト', url: 'https://www.takarakuji-official.jp/news/pdf/791.pdf' }
        ]
      },
      countryId: 'JP',
      name: 'Japan LOTO 7',
      displayName: 'ロト7 (LOTO 7)',
      main: { min: 1, max: 37, count: 7 },
      drawBonus: {
        count: 2,
        labelKey: 'bonus'
      },
      ballStyle: 'japan'
    },
    {
      id: 'ca-lotto-649',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'ILC / OLG', url: 'https://www.olg.ca/content/dam/olg/web/product/rules-game-conditions/Lotto_649_Game_Conditions-EN_in_effect_Jan_22_2024.pdf' }
        ]
      },
      countryId: 'CA',
      name: 'Canada Lotto 6/49',
      displayName: 'Lotto 6/49',
      main: { min: 1, max: 49, count: 6 },
      drawBonus: {
        count: 1,
        labelKey: 'bonus'
      },
      ballStyle: 'canada',
      rulesText: {
        en: 'For the separate Gold Ball Draw, the lottery automatically assigns a 10-digit number.',
        ko: '별도 Gold Ball Draw의 10자리 번호는 복권 운영사가 자동으로 부여합니다.',
        ja: '別のGold Ball Draw用の10桁番号は運営元が自動で割り当てます。',
        'pt-BR': 'A loteria atribui automaticamente um número de 10 dígitos para o sorteio separado Gold Ball Draw.'
      }
    },
    {
      id: 'au-oz-lotto',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'The Lott', url: 'https://help.thelott.com/hc/en-us/articles/4416863329689-How-do-I-play-the-Oz-Lotto-game' }
        ]
      },
      countryId: 'AU',
      name: 'Australia Oz Lotto',
      displayName: 'Oz Lotto',
      main: { min: 1, max: 47, count: 7 },
      drawBonus: {
        count: 3,
        labelKey: 'supplementary'
      },
      ballStyle: 'oz-lotto'
    },
    {
      id: 'au-powerball',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'The Lott', url: 'https://help.thelott.com/hc/en-us/articles/4416863320217-How-do-I-play-the-Powerball-game' }
        ]
      },
      countryId: 'AU',
      name: 'Australia Powerball',
      displayName: 'Powerball (Australia)',
      main: { min: 1, max: 35, count: 7 },
      playerSelectedExtra: {
        min: 1,
        max: 20,
        count: 1,
        labelKey: 'powerball'
      },
      ballStyle: 'au-powerball',
      rulesText: {
        en: '7 main numbers from 1 to 35 (no replacement) + 1 Powerball from independent pool 1 to 20.',
        ko: '1부터 35까지 본번호 7개 (중복 없음) + 독립 풀 1부터 20까지 파워볼 1개 선택.',
        ja: '1〜35の中から本数字7個（重複なし）＋ 1〜20の独立枠からパワーボール1個。',
        'pt-BR': '7 números principais de 1 a 35 (sem reposição) + 1 Powerball do grupo independente de 1 a 20.'
      }
    },
    {
      id: 'br-mega-sena',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'Loterias CAIXA', url: 'https://loterias.caixa.gov.br/Paginas/mega-sena.aspx' },
          { name: 'CAIXA – Regras dos Sorteios', url: 'https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx' }
        ]
      },
      countryId: 'BR',
      name: 'Brazil Mega-Sena',
      displayName: 'Mega-Sena',
      main: { min: 1, max: 60, count: 6 },
      ballStyle: 'megasena',
      rulesText: {
        en: 'Choose 6 to 20 numbers from 1 to 60. This generator uses the minimum 6-number entry. The draw selects 6 distinct numbers with no bonus ball.',
        ko: '구매 시 1~60 중 6~20개를 선택할 수 있습니다. 이 사이트는 최소 방식인 6개를 생성합니다. 추첨에서는 중복 없이 6개를 뽑으며 보너스 번호는 없습니다.',
        ja: '購入時は1〜60から6〜20個を選びます。このサイトでは最少の6個を生成します。抽せんでは重複なしで6個を選び、ボーナス数字はありません。',
        'pt-BR': 'Marque de 6 a 20 números de 1 a 60. Este gerador usa a aposta mínima de 6 números. São sorteados 6 números distintos, sem bola bônus.'
      }
    },
    {
      id: 'sg-toto',
      rulesReview: {
        checkedOn: '2026-11-20',
        sources: [
          { name: 'Singapore Pools', url: 'https://www.singaporepools.com.sg/en/rules/Pages/pdf/toto-game-rules.pdf' }
        ]
      },
      countryId: 'SG',
      name: 'Singapore TOTO',
      displayName: 'TOTO',
      main: { min: 1, max: 49, count: 6 },
      drawBonus: {
        count: 1,
        labelKey: 'additional'
      },
      ballStyle: 'singapore'
    },
    {
      id: 'za-powerball',
      rulesReview: {
        checkedOn: '2026-11-20',
        operatorRulesUnverified: true,
        sources: [
          { name: 'Sizekhaya', url: 'https://sizekhaya.co.za/' },
          { name: 'Capitec', url: 'https://www.capitecbank.co.za/globalassets/pages/home/personal/lotto/lotto-terms-and-conditions-.pdf' }
        ]
      },
      countryId: 'ZA',
      name: 'South Africa PowerBall',
      displayName: 'PowerBall',
      main: { min: 1, max: 50, count: 5 },
      playerSelectedExtra: {
        min: 1,
        max: 16,
        count: 1,
        labelKey: 'powerball'
      },
      ballStyle: 'za-powerball',
      rulesText: {
        en: '5 main numbers from 1 to 50 (no replacement) + 1 PowerBall from a separate pool of 1 to 16.',
        ko: '1~50에서 본번호 5개(중복 없음)와 별도 번호 풀 1~16에서 파워볼 1개를 선택합니다.',
        ja: '1〜50から異なる本数字5個と、別枠の1〜16からパワーボール1個を選びます。',
        'pt-BR': 'Escolha 5 números distintos de 1 a 50 e 1 PowerBall de um grupo separado de 1 a 16.'
      }
    }
  ];

  // 3. Translations Dictionary
  // Requirement 3: Website title, introductory description, Country label, Lottery Name label remain in English at all times.
  // Requirement 5: Localize the remaining interface, including number units, according to selected country.
  const TRANSLATIONS = {
    en: {
      saved: {
        heading: "Saved numbers",
        history: "History",
        favorites: "Favorites",
        clear: "Clear history",
        confirmClear: "Clear history? Favorites will be kept.",
        emptyHistory: "No generation history yet.",
        emptyFavorites: "No favorites yet.",
        add: "Add to favorites",
        remove: "Remove from favorites",
        delete: "Delete history entry",
        cleared: "History cleared. Favorites kept.",
        deleted: "History entry deleted. Any favorite is kept.",
        added: "Favorite added.",
        removed: "Favorite removed. History is unchanged.",
        full: "Favorites are full (100). Remove one to save another.",
        storageWarning: "Browser storage is unavailable or contains unreadable data. Some changes may last only until you close or reload this page.",
        favoritedOn: "Favorited"
      },
      configTitle: 'Lottery Configuration',
      footerNav: 'Site information',
      footerLinks: ['About', 'Guide', 'Privacy', 'Contact'],
      footerIndependence: 'World Lottery is an independent service with no affiliation to official lottery operators.',
      footerResponsible: 'Generating numbers does not improve your odds. Follow local age limits and set a spending limit.',
      resultsGenerated: count => `Lottery sets generated: ${count}.`,
      generating: 'Generating…',
      generationFailed: 'Could not generate numbers. Try again.',
      rateLimited: 'Too many requests. Wait a moment and try again.',
      resultsCleared: 'Results cleared.',
      toastCopyFailed: 'Unable to copy the numbers to the clipboard.',
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
      ruleHeading: 'Ticket Selection Rules',
      pickExtra: label => `The ticket includes both the main numbers and the separate ${label} selection.`,
      pickMain: ({ count, min, max }) => 'Choose ' + count + ' distinct main numbers from ' + min + ' to ' + max + '.',
      drawOnly: label => 'The lottery draws the ' + label + ' separately.',
      sourceLabel: 'Sources',
      checkedLabel: 'Checked',
      operatorRulesUnverified: 'Operator rules unverified. The number ranges come from Capitec’s ticket terms.',
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
      saved: {
        heading: "저장된 번호",
        history: "생성 기록",
        favorites: "즐겨찾기",
        clear: "기록 전체 삭제",
        confirmClear: "일반 기록을 모두 삭제할까요? 즐겨찾기는 유지됩니다.",
        emptyHistory: "아직 생성 기록이 없습니다.",
        emptyFavorites: "아직 즐겨찾기가 없습니다.",
        add: "즐겨찾기 등록",
        remove: "즐겨찾기 해제",
        delete: "기록 삭제",
        cleared: "일반 기록을 삭제했습니다. 즐겨찾기는 유지됩니다.",
        deleted: "기록을 삭제했습니다. 즐겨찾기에 등록된 조합은 유지됩니다.",
        added: "즐겨찾기에 등록했습니다.",
        removed: "즐겨찾기를 해제했습니다. 일반 기록은 그대로입니다.",
        full: "즐겨찾기는 최대 100개까지 저장할 수 있습니다. 기존 항목을 해제한 뒤 다시 시도하세요.",
        storageWarning: "브라우저 저장소에 접근할 수 없거나 일부 데이터를 읽을 수 없습니다. 일부 변경은 페이지를 닫거나 새로고침하면 사라질 수 있습니다.",
        favoritedOn: "즐겨찾기 등록"
      },
      configTitle: '복권 설정',
      footerNav: '사이트 안내',
      footerLinks: ['사이트 소개', '이용 안내', '개인정보처리방침', '문의 안내'],
      footerIndependence: 'World Lottery는 공식 복권 운영사와 관계없는 독립 서비스입니다.',
      footerResponsible: '번호 생성은 당첨 확률을 높이지 않습니다. 지역의 연령 제한을 지키고, 지출 한도를 정해 이용하세요.',
      resultsGenerated: count => `번호를 ${count}게임 생성했습니다.`,
      generating: '번호 생성 중…',
      generationFailed: '번호를 생성하지 못했습니다. 다시 시도해 주세요.',
      rateLimited: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      resultsCleared: '결과를 초기화했습니다.',
      toastCopyFailed: '번호를 클립보드에 복사하지 못했습니다.',
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
      ruleHeading: '구매 번호 선택 규칙',
      pickExtra: label => `구매할 때 본번호와 별도 번호(${label})를 모두 선택합니다.`,
      pickMain: ({ count, min, max }) => min + '~' + max + '에서 서로 다른 본번호 ' + count + '개를 선택합니다.',
      drawOnly: label => label + '는 운영사가 추첨에서 별도로 뽑습니다.',
      sourceLabel: '출처',
      checkedLabel: '확인일',
      operatorRulesUnverified: '운영사 규칙 원문 미검증. 번호 범위는 Capitec 판매 약관에서 확인했습니다.',
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
      saved: {
        heading: "保存した数字",
        history: "生成履歴",
        favorites: "お気に入り",
        clear: "履歴をすべて削除",
        confirmClear: "履歴をすべて削除しますか？ お気に入りは残ります。",
        emptyHistory: "生成履歴はまだありません。",
        emptyFavorites: "お気に入りはまだありません。",
        add: "お気に入りに追加",
        remove: "お気に入りから解除",
        delete: "履歴を削除",
        cleared: "履歴を削除しました。お気に入りは残ります。",
        deleted: "履歴を削除しました。お気に入りに登録した組み合わせは残ります。",
        added: "お気に入りに追加しました。",
        removed: "お気に入りを解除しました。履歴はそのままです。",
        full: "お気に入りの上限は100件です。追加するには既存の項目を解除してください。",
        storageWarning: "ブラウザの保存領域にアクセスできないか、一部のデータを読み込めません。ページを閉じたり再読み込みしたりすると、一部の変更が失われることがあります。",
        favoritedOn: "お気に入り登録"
      },
      configTitle: '宝くじの設定',
      footerNav: 'サイト案内',
      footerLinks: ['サイトについて', '利用ガイド', 'プライバシー', 'お問い合わせ'],
      footerIndependence: 'World Lotteryは、公式の宝くじ運営元と関係のない独立したサービスです。',
      footerResponsible: '数字を生成しても当せん確率は上がりません。地域の年齢制限を守り、購入予算を決めてください。',
      resultsGenerated: count => `${count}口分の数字を生成しました。`,
      generating: '生成中…',
      generationFailed: '数字を生成できませんでした。もう一度お試しください。',
      rateLimited: 'リクエストが多すぎます。しばらくしてからお試しください。',
      resultsCleared: '生成結果をクリアしました。',
      toastCopyFailed: '数字をクリップボードにコピーできませんでした。',
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
      ruleHeading: '購入時の数字選択ルール',
      pickExtra: label => `購入時は本数字と別枠の数字（${label}）の両方を選びます。`,
      pickMain: ({ count, min, max }) => min + '〜' + max + 'から異なる本数字' + count + '個を選びます。',
      drawOnly: label => '「' + label + '」は運営元が別に抽せんします。',
      sourceLabel: '出典',
      checkedLabel: '確認日',
      operatorRulesUnverified: '運営元の規則原文は未確認です。数字の範囲はCapitecの販売規約で確認しました。',
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
      saved: {
        heading: "Números salvos",
        history: "Histórico",
        favorites: "Favoritos",
        clear: "Limpar histórico",
        confirmClear: "Limpar o histórico? Os favoritos serão mantidos.",
        emptyHistory: "Ainda não há jogos no histórico.",
        emptyFavorites: "Ainda não há favoritos.",
        add: "Adicionar aos favoritos",
        remove: "Remover dos favoritos",
        delete: "Excluir do histórico",
        cleared: "Histórico limpo. Os favoritos foram mantidos.",
        deleted: "Jogo excluído do histórico. Se estiver nos favoritos, continuará salvo lá.",
        added: "Adicionado aos favoritos.",
        removed: "Removido dos favoritos. O histórico permanece igual.",
        full: "O limite é de 100 favoritos. Remova um para adicionar outro.",
        storageWarning: "O armazenamento do navegador está indisponível ou contém dados ilegíveis. Algumas alterações podem se perder ao fechar ou recarregar a página.",
        favoritedOn: "Adicionado aos favoritos"
      },
      configTitle: 'Configuração da loteria',
      footerNav: 'Informações do site',
      footerLinks: ['Sobre', 'Guia', 'Privacidade', 'Contato'],
      footerIndependence: 'O World Lottery é um serviço independente, sem vínculo com as operadoras oficiais de loteria.',
      footerResponsible: 'Gerar números não aumenta a chance de ganhar. Respeite a idade mínima local e defina um limite de gastos.',
      resultsGenerated: count => `Jogos gerados: ${count}.`,
      generating: 'Gerando…',
      generationFailed: 'Não foi possível gerar os números. Tente novamente.',
      rateLimited: 'Muitas solicitações. Aguarde um momento e tente novamente.',
      resultsCleared: 'Resultados limpos.',
      toastCopyFailed: 'Não foi possível copiar os números para a área de transferência.',
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
      ruleHeading: 'Regras de Seleção da Aposta',
      pickExtra: label => `Na aposta, escolha os números principais e também a seleção separada de ${label}.`,
      pickMain: ({ count, min, max }) => 'Escolha ' + count + ' números principais distintos de ' + min + ' a ' + max + '.',
      drawOnly: label => 'O sorteio determina separadamente os números de “' + label + '”.',
      sourceLabel: 'Fontes',
      checkedLabel: 'Data da consulta',
      operatorRulesUnverified: 'Regulamento da operadora não verificado. Os intervalos foram consultados nos termos de venda do Capitec.',
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

  const lottery = typeof module !== "undefined" && module.exports
    ? require("./lottery.js") : window.lotteryAnalysis;

  // 5. DOM Elements Cache
  let countrySelect = null;
  let gameSelect = null;
  let quantitySelect = null;
  let quantityLabel = null;
  let btnGenerate = null;
  let btnCopyAll = null;
  let btnClear = null;
  let ruleHeading = null;
  let ruleText = null;
  let ruleSources = null;
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
    ruleHeading = document.getElementById('rule-heading');
    ruleText = document.getElementById('rule-text');
    ruleSources = document.getElementById('rule-sources');
    resultsHeading = document.getElementById('results-heading');
    resultsContainer = document.getElementById('results-container');
    emptyState = document.getElementById('empty-state');
    liveRegion = document.getElementById('live-region');
    toast = document.getElementById('toast');
    return Boolean(countrySelect && gameSelect);
  }

  let currentResults = [];
  let activeGeneration = null;
  const generationPath = '/api/v1/generate';
  const koreaGameId = 'kr-lotto-645';
  const koreaModeKey = 'worldLottery.koreaMode.v1';
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
    document.getElementById('config-title').textContent = t.configTitle;
    btnGenerate.querySelector('span').textContent = activeGeneration ? t.generating : t.btnGenerate;
    btnCopyAll.querySelector('span').textContent = t.btnCopyAll;
    btnClear.querySelector('span').textContent = t.btnClear;
    if (resultsHeading) resultsHeading.textContent = t.resultsHeading;
    if (ruleHeading) ruleHeading.textContent = t.ruleHeading;

    const footerNav = document.getElementById('footer-nav');
    footerNav.setAttribute('aria-label', t.footerNav);
    footerNav.querySelectorAll('a').forEach((link, index) => {
      link.textContent = t.footerLinks[index];
      link.hash = country.lang === 'ko' ? '' : country.lang;
    });
    document.getElementById('footer-independence').textContent = t.footerIndependence;
    document.getElementById('footer-responsible').textContent = t.footerResponsible;

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

    updateRules(game, country.lang, t);
    updateKoreaMode(game, country.lang);
    lottery.renderHistory(game, country.lang, t.mainLabel, t.ballLabels);

    // Update empty state text if empty
    if (emptyState && currentResults.length === 0) {
      emptyState.textContent = t.emptyState;
    }
  }

  function updateRules(game, lang, t) {
    const { playerSelectedExtra, drawBonus, rulesReview } = game;
    const paragraphs = [];
    if (drawBonus) paragraphs.push(t.pickMain(game.main));
    if (game.rulesText) paragraphs.push(game.rulesText[lang] || game.rulesText.en);
    if (playerSelectedExtra) paragraphs.push(t.pickExtra(t.ballLabels[playerSelectedExtra.labelKey]));
    if (drawBonus) paragraphs.push(t.drawOnly(t.ballLabels[drawBonus.labelKey]));
    if (rulesReview.operatorRulesUnverified) paragraphs.push(t.operatorRulesUnverified);
    ruleText.textContent = paragraphs.join(' ');

    const date = document.createElement('time');
    date.dateTime = rulesReview.checkedOn;
    date.textContent = new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeZone: 'UTC'
    }).format(new Date(rulesReview.checkedOn));

    ruleSources.replaceChildren(`${t.sourceLabel} · `);
    rulesReview.sources.forEach(({ name, url }, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = name;
      if (index > 0) ruleSources.append(' / ');
      ruleSources.append(link);
    });
    ruleSources.append(` · ${t.checkedLabel} `, date);
  }

  function getExtraLabel(game, t) {
    const extra = game.playerSelectedExtra || (game.bonus?.type === 'independent' ? game.bonus : null);
    return extra ? t.ballLabels[extra.labelKey] || t.ballLabels.bonus : '';
  }

  const SAVED_LIMIT = 100;
  const SAVED_KEYS = {
    history: 'worldLottery.history.v1',
    favorites: 'worldLottery.favorites.v1'
  };
  const saved = { history: [], favorites: [] };
  const storageWarnings = new Set();
  const unsavedLists = new Set();
  let savedView = 'history';
  let recordSequence = 0;

  function createRecord(game, line) {
    const createdAt = Date.now();
    return {
      id: window.crypto?.randomUUID?.() || `${createdAt}-${++recordSequence}-${Math.random().toString(36).slice(2)}`,
      createdAt,
      countryId: game.countryId,
      gameId: game.id,
      ...line,
      rules: {
        displayName: game.displayName,
        main: { ...game.main },
        // Keep the existing storage format for ticket snapshots.
        bonus: game.playerSelectedExtra
          ? { ...game.playerSelectedExtra, type: 'independent' }
          : { type: 'none', count: 0, labelKey: null }
      }
    };
  }

  function validTimestamp(value) {
    return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
  }

  function validPool(numbers, pool) {
    return Array.isArray(numbers) && pool &&
      Number.isSafeInteger(pool.min) && Number.isSafeInteger(pool.max) &&
      Number.isSafeInteger(pool.count) && numbers.length === pool.count &&
      new Set(numbers).size === numbers.length &&
      numbers.every(number => Number.isSafeInteger(number) && number >= pool.min && number <= pool.max);
  }

  function validRecord(record, list) {
    if (!record || typeof record.id !== 'string' || !record.id ||
        !validTimestamp(record.createdAt) ||
        (list === 'favorites' && !validTimestamp(record.favoritedAt)) ||
        typeof record.countryId !== 'string' || typeof record.gameId !== 'string' ||
        typeof record.rules?.displayName !== 'string' || !validPool(record.main, record.rules.main)) {
      return false;
    }
    const bonus = record.rules.bonus;
    if (!bonus || !Array.isArray(record.bonus)) return false;
    if (bonus.type === 'none') return bonus.count === 0 && record.bonus.length === 0;
    if (typeof bonus.labelKey !== 'string') return false;
    if (bonus.type === 'independent') return validPool(record.bonus, bonus);
    return bonus.type === 'remaining_main' &&
      validPool(record.bonus, { ...record.rules.main, count: bonus.count }) &&
      record.bonus.every(number => !record.main.includes(number));
  }

  function readSavedList(list) {
    if (unsavedLists.has(list)) return;
    try {
      const raw = window.localStorage.getItem(SAVED_KEYS[list]);
      const entries = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(entries)) throw new TypeError('Invalid saved numbers');
      const ids = new Set();
      saved[list] = entries.filter(entry => {
        if (!validRecord(entry, list) || ids.has(entry.id)) return false;
        ids.add(entry.id);
        return true;
      }).sort((a, b) => list === 'history' ? b.createdAt - a.createdAt : b.favoritedAt - a.favoritedAt).slice(0, SAVED_LIMIT);
      if (saved[list].length === entries.length) storageWarnings.delete(list);
      else storageWarnings.add(list);
    } catch {
      storageWarnings.add(list);
    }
  }

  function writeSavedList(list, records) {
    saved[list] = records;
    try {
      window.localStorage.setItem(SAVED_KEYS[list], JSON.stringify(records));
      unsavedLists.delete(list);
      storageWarnings.delete(list);
    } catch {
      unsavedLists.add(list);
      storageWarnings.add(list);
    }
  }

  function setFavoriteButton(button) {
    const active = saved.favorites.some(record => record.id === button.dataset.favoriteId);
    const label = getI18n().saved[active ? 'remove' : 'add'];
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.firstElementChild.textContent = active ? '★' : '☆';
  }

  function createFavoriteButton(record) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'saved-button favorite-button';
    button.dataset.favoriteId = record.id;
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);
    setFavoriteButton(button);
    button.addEventListener('click', () => {
      const t = getI18n().saved;
      readSavedList('favorites');
      const favorites = saved.favorites;
      const active = favorites.some(entry => entry.id === record.id);
      if (!active && favorites.length >= SAVED_LIMIT) {
        renderSaved();
        showToast(t.full);
        return;
      }
      writeSavedList('favorites', active
        ? favorites.filter(entry => entry.id !== record.id)
        : [{ ...record, favoritedAt: Date.now() }, ...favorites]);
      renderSaved();
      announce(t[active ? 'removed' : 'added']);
    });
    return button;
  }

  function removeHistory(id) {
    const t = getI18n().saved;
    readSavedList('history');
    if (id === undefined && !window.confirm(t.confirmClear)) return;
    writeSavedList('history', id === undefined ? [] : saved.history.filter(record => record.id !== id));
    renderSaved();
    announce(t[id === undefined ? 'cleared' : 'deleted']);
  }

  function renderSaved() {
    const t = getI18n();
    const list = document.getElementById('saved-list');
    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    const historyButton = document.getElementById('show-history');
    const favoritesButton = document.getElementById('show-favorites');
    const clearButton = document.getElementById('clear-history');
    const isHistory = savedView === 'history';
    document.getElementById('saved-heading').textContent = t.saved.heading;
    historyButton.textContent = t.saved.history;
    favoritesButton.textContent = t.saved.favorites;
    historyButton.setAttribute('aria-pressed', String(isHistory));
    favoritesButton.setAttribute('aria-pressed', String(!isHistory));
    clearButton.textContent = t.saved.clear;
    clearButton.hidden = !isHistory;
    clearButton.disabled = saved.history.length === 0;
    if (clearButton.disabled && document.activeElement === clearButton) historyButton.focus();

    const warning = document.getElementById('saved-warning');
    warning.hidden = storageWarnings.size === 0;
    warning.textContent = warning.hidden ? '' : t.saved.storageWarning;
    const entries = saved[savedView];
    const empty = document.getElementById('saved-empty');
    empty.hidden = entries.length !== 0;
    empty.textContent = t.saved[isHistory ? 'emptyHistory' : 'emptyFavorites'];
    const formatter = new Intl.DateTimeFormat(getCurrentCountry().lang, { dateStyle: 'medium', timeStyle: 'short' });
    list.replaceChildren(...entries.map(record => renderSavedRecord(record, t, formatter, isHistory)));

    resultsContainer.querySelectorAll('[data-favorite-id]').forEach(setFavoriteButton);
    if (focused) {
      const replacement = Array.from(list.querySelectorAll('button')).find(button =>
        (focused.dataset.favoriteId && button.dataset.favoriteId === focused.dataset.favoriteId) ||
        (focused.dataset.deleteId && button.dataset.deleteId === focused.dataset.deleteId));
      (replacement || (isHistory ? historyButton : favoritesButton)).focus({ preventScroll: true });
    }
  }

  function renderSavedRecord(record, t, formatter, isHistory) {
    const item = document.createElement('li');
    item.className = 'saved-record';
    const heading = document.createElement('strong');
    const country = COUNTRIES.find(entry => entry.id === record.countryId);
    heading.textContent = `${country?.name || record.countryId} · ${record.rules.displayName}`;
    const numbers = document.createElement('p');
    numbers.textContent = `${t.mainLabel} · ${record.main.join(', ')}`;
    const extraLabel = getExtraLabel(record.rules, t);
    if (extraLabel && record.bonus.length) {
      const extra = document.createElement('span');
      extra.className = 'saved-extra';
      extra.textContent = `${extraLabel} · ${record.bonus.join(', ')}`;
      numbers.append(extra);
    }
    const dates = document.createElement('p');
    dates.className = 'saved-dates';
    const created = document.createElement('time');
    created.dateTime = new Date(record.createdAt).toISOString();
    created.textContent = formatter.format(record.createdAt);
    dates.append(created);
    if (!isHistory) {
      const favorited = document.createElement('time');
      favorited.dateTime = new Date(record.favoritedAt).toISOString();
      favorited.textContent = formatter.format(record.favoritedAt);
      dates.append(` · ${t.saved.favoritedOn} `, favorited);
    }
    const controls = document.createElement('div');
    controls.className = 'saved-actions';
    controls.append(createFavoriteButton(record), ...createExportButtons(record, t));
    if (isHistory) {
      const remove = document.createElement('button');
      remove.className = 'saved-button';
      remove.type = 'button';
      remove.dataset.deleteId = record.id;
      remove.textContent = t.saved.delete;
      remove.addEventListener('click', () => removeHistory(record.id));
      controls.append(remove);
    }
    item.append(heading, numbers, dates, controls);
    return item;
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
    renderOdds();
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

    const bonusLabelText = getExtraLabel(game, t);

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
      const actions = document.createElement('div');
      actions.className = 'saved-actions';
      actions.append(createFavoriteButton(set), copyBtn, ...createExportButtons(set, t));
      headerDiv.appendChild(actions);
      row.appendChild(headerDiv);

      // Balls container
      const ballsWrapper = document.createElement('div');
      ballsWrapper.className = 'balls-wrapper';

      // Main balls group
      const mainGroup = document.createElement('div');
      mainGroup.className = 'balls-group main-balls';
      mainGroup.setAttribute('role', 'group');
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

      // Separate numbers selected on the ticket.
      if (bonusLabelText && set.bonus.length) {
        const divider = document.createElement('span');
        divider.className = 'bonus-divider';
        divider.textContent = '+';
        divider.setAttribute('aria-hidden', 'true');
        ballsWrapper.appendChild(divider);

        const bonusGroup = document.createElement('div');
        bonusGroup.className = 'balls-group bonus-balls';
        bonusGroup.setAttribute('role', 'group');
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

      row.append(ballsWrapper);
      resultsContainer.appendChild(row);
    });

    announce(t.resultsGenerated(sets.length));
  }

  const koreaModeLabels = {
    ko: {
      title: '생성 방식', random: '일반 무작위 생성', filtered: '최근 당첨번호 유사 조합 제외'
    },
    en: {
      title: 'Generation mode', random: 'Uniform random', filtered: 'Exclude combinations similar to past draws'
    },
    ja: {
      title: '生成方式', random: '一様なランダム生成', filtered: '過去の当せん数字に近い組み合わせを除外'
    },
    'pt-BR': {
      title: 'Modo de geração', random: 'Geração aleatória uniforme', filtered: 'Excluir combinações semelhantes a sorteios anteriores'
    }
  };

  function updateKoreaMode(game, lang) {
    const panel = document.getElementById('korea-mode-panel');
    panel.hidden = game.id !== koreaGameId;
    if (panel.hidden) return;

    const labels = koreaModeLabels[lang];
    document.getElementById('korea-mode-label').textContent = labels.title;
    for (const option of panel.querySelectorAll('input[name="korea-mode"]')) {
      option.nextElementSibling.textContent = labels[option.value];
    }
  }

  function restoreKoreaMode() {
    const options = document.querySelectorAll('input[name="korea-mode"]');
    let saved;
    try {
      saved = window.localStorage.getItem(koreaModeKey);
    } catch {
      // Use the default when browser storage is unavailable.
    }
    for (const option of options) option.checked = option.value === saved;
  }

  // 10. Draw Action
  function renderOdds() {
    const count = Number(quantitySelect.value);
    lottery.renderOdds(getCurrentGame(), getCurrentCountry().lang, count, currentResults);
  }

  function setGenerationBusy(busy) {
    btnGenerate.disabled = busy;
    btnGenerate.setAttribute('aria-busy', String(busy));
    btnGenerate.querySelector('span').textContent = busy ? getI18n().generating : getI18n().btnGenerate;
  }

  function cancelGeneration() {
    if (!activeGeneration) return;
    activeGeneration.abort();
    activeGeneration = null;
    setGenerationBusy(false);
  }

  function validateTickets(payload, game, count) {
    if (payload?.success !== true || payload.gameId !== game.id ||
        typeof payload.generatedAt !== 'string' || !Number.isFinite(Date.parse(payload.generatedAt)) ||
        !Array.isArray(payload.tickets) || payload.tickets.length !== count) return null;
    const extraRule = game.playerSelectedExtra || { min: 1, max: 1, count: 0 };
    const sorted = (values, pool) => validPool(values, pool) &&
      values.every((n, index) => index === 0 || n > values[index - 1]);
    if (!payload.tickets.every(ticket => sorted(ticket?.main, game.main) && sorted(ticket.extra, extraRule))) return null;
    const lines = payload.tickets.map(({ main, extra }) => ({ main, bonus: extra }));
    return lottery.uniqueTickets(game, lines) === count ? lines : null;
  }

  async function handleGenerate(recordHistory) {
    if (activeGeneration) return;
    const game = getCurrentGame();
    const count = Number(quantitySelect.value);
    let mode = 'random';
    if (game.id === koreaGameId) {
      const selected = document.querySelector('input[name="korea-mode"]:checked')?.value;
      mode = { filtered: 'historical-filter', random: 'random' }[selected] || 'kr-statistical';
    }
    const controller = new AbortController();
    activeGeneration = controller;
    setGenerationBusy(true);
    announce(getI18n().generating);
    const timeout = setTimeout(() => controller.abort(), 12000);
    let failure;
    try {
      const response = await fetch(generationPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ gameId: game.id, ticketCount: count, mode })
      });
      if (!response.ok) {
        if (response.status === 429) failure = getI18n().rateLimited;
        throw new Error('Generation API failed');
      }
      const lines = validateTickets(await response.json(), game, count);
      if (activeGeneration !== controller) return;
      if (!lines) throw new Error('Invalid tickets');
      const sets = lines.map(line => createRecord(game, line));
      if (recordHistory) {
        readSavedList('history');
        writeSavedList('history', [...sets.slice().reverse(), ...saved.history].slice(0, SAVED_LIMIT));
        renderSaved();
      }
      renderResults(sets, true);
    } catch {
      if (activeGeneration !== controller) return;
      const message = failure || getI18n().generationFailed;
      announce(message);
      showToast(message);
    } finally {
      clearTimeout(timeout);
      if (activeGeneration === controller) {
        activeGeneration = null;
        setGenerationBusy(false);
      }
    }
  }

  function handleClear() {
    cancelGeneration();
    currentResults = [];
    renderResults([], false);
    announce(getI18n().resultsCleared);
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
    const bLabel = getExtraLabel(game, t);
    if (bLabel && set.bonus.length) {
      const bonusStr = set.bonus.join(', ');
      return `${prefix}${mainStr} + [${bLabel}: ${bonusStr}]`;
    }
    return `${prefix}${mainStr}`;
  }

  async function copySingleLine(game, set, lineNum, buttonElement) {
    const text = `${game.name} - ${formatLineString(game, set, lineNum)}`;
    const copied = await copyText(text);
    const t = getI18n();
    showToast(copied ? t.toastCopiedLine : t.toastCopyFailed);

    if (!copied || !buttonElement.isConnected) return;
    const span = buttonElement.querySelector('span');
    span.textContent = t.copiedLine;
    buttonElement.classList.add('copied');
    setTimeout(() => {
      span.textContent = t.btnCopyLine;
      buttonElement.classList.remove('copied');
    }, 1600);
  }

  async function copyAllResults() {
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
    lines.push(`${t.ruleHeading} · ${t.checkedLabel} ${game.rulesReview.checkedOn}`);
    if (game.rulesReview.operatorRulesUnverified) lines.push(t.operatorRulesUnverified);

    const copied = await copyText(lines.join('\n'));
    showToast(copied ? t.toastCopiedAll : t.toastCopyFailed);
  }

  const EXPORT_SITE = 'https://world-lottery.pages.dev/';
  const EXPORT_FONTS = {
    ko: '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK KR", sans-serif',
    ja: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans CJK JP", sans-serif',
    en: 'system-ui, sans-serif',
    'pt-BR': 'system-ui, sans-serif'
  };
  const EXPORT_LABELS = {
    ko: {
      save: '이미지 저장', share: '번호 공유', canceled: '공유를 취소했습니다.',
      shareFailed: '번호를 공유하지 못했습니다.', generating: '이미지를 생성하는 중입니다.',
      saveFailed: '이미지를 저장하지 못했습니다.', unavailable: '공유 기능을 사용할 수 없습니다.',
      copy: '텍스트 복사', saved: 'PNG 다운로드를 시작했습니다.'
    },
    en: {
      save: 'Save image', share: 'Share numbers', canceled: 'Sharing canceled.',
      shareFailed: 'Unable to share the numbers.', generating: 'Creating the image…',
      saveFailed: 'Unable to save the image.', unavailable: 'Sharing is unavailable.',
      copy: 'Copy text', saved: 'PNG download started.'
    },
    ja: {
      save: '画像を保存', share: '数字を共有', canceled: '共有をキャンセルしました。',
      shareFailed: '数字を共有できませんでした。', generating: '画像を作成しています。',
      saveFailed: '画像を保存できませんでした。', unavailable: '共有機能を利用できません。',
      copy: 'テキストをコピー', saved: 'PNGのダウンロードを開始しました。'
    },
    'pt-BR': {
      save: 'Salvar imagem', share: 'Compartilhar números', canceled: 'Compartilhamento cancelado.',
      shareFailed: 'Não foi possível compartilhar os números.', generating: 'Gerando imagem…',
      saveFailed: 'Não foi possível salvar a imagem.', unavailable: 'O compartilhamento está indisponível.',
      copy: 'Copiar texto', saved: 'Download do PNG iniciado.'
    }
  };

  function createExportButtons(record, t) {
    const lang = getCurrentCountry().lang;
    const labels = EXPORT_LABELS[lang];
    const name = record.rules.displayName;
    const extra = record.bonus.length ? getExtraLabel(record.rules, t) : '';
    const text = [name, `${t.mainLabel}: ${record.main.join(', ')}`];
    if (extra) text.push(`${extra}: ${record.bonus.join(', ')}`);
    const share = { title: name, text: text.join('\n'), url: EXPORT_SITE };
    const fileDate = new Date(record.createdAt).toISOString().split('T')[0].replace(/-/g, '');
    const fileSlug = record.gameId.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70);
    const filename = `world-lottery-${fileSlug || 'numbers'}-${fileDate}.png`;
    const copyShareText = async () => {
      const copied = await copyText(`${share.text}\n${share.url}`);
      showToast(copied ? t.toastCopiedLine : t.toastCopyFailed);
    };
    const button = (label, task, download = false) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'btn-copy-line';
      control.setAttribute('aria-label', `${label} · ${name} · ${record.main.join(', ')}`);
      if (download) {
        control.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M11 3h2v10l4-4 1.4 1.4L12 17l-6.4-6.6L7 9l4 4V3zM4 18h2v2h12v-2h2v4H4z"/></svg>';
      }
      control.append(label);
      control.addEventListener('click', async () => {
        if (control.getAttribute('aria-busy') === 'true') return;
        control.setAttribute('aria-busy', 'true');
        try {
          await task();
        } finally {
          control.removeAttribute('aria-busy');
        }
      });
      return control;
    };

    const saveButton = button(labels.save, async () => {
      announce(labels.generating);
      try {
        await document.fonts?.ready;
        const canvas = drawExportImage(record, lang, t.mainLabel, extra);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG encoding failed');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        try {
          link.click();
        } finally {
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        showToast(labels.saved);
      } catch {
        showToast(labels.saveFailed);
      } finally {
        announce('');
      }
    }, true);

    const shareButton = button(labels.share, async () => {
      announce('');
      if (typeof navigator.share !== 'function') {
        announce(labels.unavailable);
        await copyShareText();
        return;
      }
      let payload = share;
      if (typeof navigator.canShare === 'function' && document.fonts?.status === 'loaded') {
        try {
          // Encode synchronously to keep the original click's transient activation.
          const canvas = drawExportImage(record, lang, t.mainLabel, extra);
          const encoded = canvas.toDataURL('image/png').split(',')[1];
          const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
          const filePayload = { ...share, files: [new File([bytes], filename, { type: 'image/png' })] };
          if (navigator.canShare(filePayload)) payload = filePayload;
        } catch {
          // The text payload remains available when file encoding or validation fails.
        }
      }
      try {
        await navigator.share(payload);
      } catch (error) {
        if (error.name === 'AbortError') {
          announce(labels.canceled);
        } else {
          showToast(labels.shareFailed);
        }
      }
    });

    const buttons = [saveButton, shareButton];
    if (typeof navigator.share !== 'function') buttons.push(button(labels.copy, copyShareText));
    return buttons;
  }

  function drawExportImage(record, lang, mainLabel, extraLabel) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    canvas.lang = lang;
    const ctx = canvas.getContext('2d');
    const country = COUNTRIES.find(entry => entry.id === record.countryId);
    const game = GAMES.find(entry => entry.id === record.gameId);
    const font = EXPORT_FONTS[lang];
    const text = (value, x, y, size, color, maxWidth, weight = 700) => {
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.fillText(value, x, y, maxWidth);
    };

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(32, 32, 1136, 566);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(32, 32, 1136, 6);
    text('World Lottery Number Generator', 72, 105, 28, '#bae6fd', 1056);
    text(country?.name || record.countryId, 72, 159, 27, '#cbd5e1', 1056, 500);
    text(record.rules.displayName, 72, 229, 52, '#ffffff', 1056);

    const swatch = document.createElement('span');
    swatch.hidden = true;
    document.body.append(swatch);
    const drawNumbers = (numbers, label, x, width, isBonus) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, 272, width, 220);
      text(label, x + 22, 320, 26, '#e2e8f0', width - 44);
      const step = Math.min(114, (width - 36) / Math.max(1, numbers.length));
      const radius = Math.min(42, step * 0.43);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      numbers.forEach((number, index) => {
        swatch.className = getBallClass(number, game?.ballStyle, isBonus);
        const background = getComputedStyle(swatch).backgroundImage;
        const center = x + 18 + (index + 0.5) * step;
        ctx.fillStyle = background.match(/rgba?\([^)]+\)/)?.[0] || '#e2e8f0';
        ctx.beginPath();
        ctx.arc(center, 410, radius, 0, 2 * Math.PI);
        ctx.fill();
        text(String(number), center, 410, Math.min(34, radius), '#0f172a', radius * 1.65);
      });
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    };
    try {
      drawNumbers(record.main, mainLabel, 72, extraLabel ? 730 : 1056, false);
      if (extraLabel) drawNumbers(record.bonus, extraLabel, 822, 306, true);
    } finally {
      swatch.remove();
    }
    const date = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(record.createdAt);
    text(date, 72, 557, 24, '#cbd5e1', 500, 500);
    ctx.textAlign = 'right';
    text(new URL(EXPORT_SITE).hostname, 1128, 557, 25, '#bae6fd', 500);
    return canvas;
  }

  async function copyText(text) {
    try {
      const clipboard = navigator.clipboard;
      if (typeof clipboard?.writeText === 'function') {
        await clipboard.writeText(text);
        return true;
      }
    } catch {
      // Clipboard access may be blocked. Try the selection-based copy below.
    }

    if (typeof document.execCommand !== 'function') return false;

    const previousFocus = document.activeElement;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.readOnly = true;
    textArea.tabIndex = -1;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    try {
      textArea.focus({ preventScroll: true });
      textArea.select();
      return document.execCommand('copy') === true;
    } catch {
      return false;
    } finally {
      textArea.remove();
      if (previousFocus?.isConnected && previousFocus !== document.body) {
        previousFocus.focus({ preventScroll: true });
      }
    }
  }

  // 12. Event Listeners
  function initEvents() {
    countrySelect.addEventListener('change', () => {
      const selectedCountryId = countrySelect.value;
      updateGamesForCountry(selectedCountryId);
      updateInterfaceLocalization();
      renderSaved();
      // Clear past results when switching country for consistency
      handleClear();
    });

    gameSelect.addEventListener('change', () => {
      updateInterfaceLocalization();
      handleClear();
    });

    quantitySelect.addEventListener('change', () => {
      cancelGeneration();
      // If results are present, user might want to re-generate with new quantity
      if (currentResults.length > 0) {
        handleGenerate(false);
      } else {
        renderOdds();
      }
    });

    btnGenerate.addEventListener('click', () => handleGenerate(true));
    document.getElementById('korea-mode-panel').addEventListener('change', event => {
      if (event.target.name !== 'korea-mode' || !event.target.checked) return;
      try {
        window.localStorage.setItem(koreaModeKey, event.target.value);
      } catch {
        // Keep the current choice in the page if storage is unavailable.
      }
      handleClear();
    });
    btnCopyAll.addEventListener('click', copyAllResults);
    btnClear.addEventListener('click', handleClear);
    document.getElementById('show-history').addEventListener('click', () => {
      savedView = 'history';
      renderSaved();
    });
    document.getElementById('show-favorites').addEventListener('click', () => {
      savedView = 'favorites';
      renderSaved();
    });
    document.getElementById('clear-history').addEventListener('click', () => removeHistory());
    window.addEventListener('storage', event => {
      const lists = Object.keys(SAVED_KEYS).filter(list => event.key === null || event.key === SAVED_KEYS[list]);
      if (lists.length) {
        lists.forEach(readSavedList);
        renderSaved();
      }
    });
  }

  // 13. Initialization
  function init() {
    if (typeof document === 'undefined') return;
    if (!cacheDomElements()) return;
    populateCountries();
    // Default: 대한민국 (KR)
    if (countrySelect) countrySelect.value = 'KR';
    updateGamesForCountry('KR');
    restoreKoreaMode();
    updateInterfaceLocalization();
    Object.keys(SAVED_KEYS).forEach(readSavedList);
    renderSaved();
    initEvents();
    renderOdds();
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
      validRecord,
      validateTickets,
      formatLineString
    };
  }
})();
