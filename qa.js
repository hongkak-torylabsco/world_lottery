(async () => {
  const copy = {
    ko: ['공개 질문과 답변', '피드백 및 질문 보내기', '불러오는 중…', '표시할 질문이 없습니다.', '질문을 불러오지 못했습니다.', '이전', '다음', '페이지 이동', '검색어', '분류', '검색', '목록으로', '전체', '일반', '오류 신고', '복권 규칙', '기타'],
    en: ['Public Q&A', 'Send feedback or ask a question', 'Loading…', 'No questions found.', 'Could not load questions.', 'Previous', 'Next', 'Page navigation', 'Search term', 'Category', 'Search', 'Back to questions', 'All', 'General', 'Bug report', 'Lottery rules', 'Other'],
    ja: ['公開されている質問と回答', 'ご意見・ご質問を送る', '読み込み中…', '表示できる質問はありません。', '質問を読み込めませんでした。', '前へ', '次へ', 'ページ移動', '検索語', '分類', '検索', '一覧に戻る', 'すべて', '一般', '不具合報告', '宝くじのルール', 'その他'],
    'pt-BR': ['Perguntas e respostas públicas', 'Envie feedback ou faça uma pergunta', 'Carregando…', 'Nenhuma pergunta encontrada.', 'Não foi possível carregar as perguntas.', 'Anterior', 'Próxima', 'Navegação de páginas', 'Termo de busca', 'Categoria', 'Buscar', 'Voltar às perguntas', 'Todas', 'Geral', 'Relato de erro', 'Regras da loteria', 'Outro']
  };
  const query = new URLSearchParams(location.search);
  const requested = query.get('lang') || 'ko';
  const lang = Object.hasOwn(copy, requested) ? requested : 'en';
  const rawOffset = query.get('offset') || '0';
  const offset = /^\d{1,7}$/.test(rawOffset) ? Number(rawOffset) : 0;
  const id = query.get('id');
  const [title, contactText, loading, empty, error, previous, nextText, pages, searchLabel,
    categoryLabel, searchButton, backText, ...labels] = copy[lang];
  const categories = ['', 'general', 'bug', 'rules', 'other'];
  const category = categories.includes(query.get('category')) ? query.get('category') : '';
  const search = (query.get('q') || '').slice(0, 100);
  const base = { lang, q: search, category };
  const params = values => '?' + new URLSearchParams({ ...base, ...values }).toString();
  const get = key => document.getElementById('qa-' + key);
  const filter = get('filter');
  const status = get('status');
  const back = get('back');
  const pagination = get('pagination');
  const prev = get('prev');
  const next = get('next');
  document.documentElement.lang = lang;
  document.title = title + ' | World Lottery';
  get('title').textContent = title;
  get('contact').textContent = contactText;
  get('contact').href = '/contact.html?lang=' + lang;
  for (const link of document.querySelectorAll('a[hreflang]')) {
    link.href = params({ lang: link.hreflang });
    if (link.hreflang === lang) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  get('search-label').textContent = searchLabel;
  get('category-label').textContent = categoryLabel;
  get('search').textContent = searchButton;
  filter.elements.lang.value = lang;
  filter.elements.q.value = search;
  filter.elements.category.value = category;
  [...filter.elements.category.options].forEach((option, index) => { option.textContent = labels[index]; });
  pagination.setAttribute('aria-label', pages);
  prev.textContent = previous;
  next.textContent = nextText;
  prev.href = params({ offset: Math.max(0, offset - 20) });
  next.href = params({ offset: offset + 20 });
  back.textContent = backText;
  back.href = params({ offset });
  back.hidden = id === null;
  filter.hidden = id !== null;
  status.textContent = loading;

  try {
    const response = await fetch('/api/v1/qa' + params(id === null ? { offset } : { id }),
      { signal: AbortSignal.timeout(10000) });
    if (response.status === 404) {
      status.textContent = empty;
      return;
    }
    if (!response.ok) throw new Error('Public Q&A unavailable');
    const data = await response.json();
    const list = get('items');
    if (id !== null) {
      get('title').textContent = data.item.question;
      const answer = document.createElement('p');
      answer.className = 'feedback-text';
      answer.textContent = data.item.answer;
      list.append(answer);
      status.textContent = '';
      return;
    }
    for (const item of data.items) {
      const entry = get('item').content.cloneNode(true);
      const link = entry.querySelector('a');
      link.textContent = item.question;
      link.href = params({ id: item.id, offset });
      entry.querySelector('[data-category]').textContent = labels[categories.indexOf(item.category)];
      list.append(entry);
    }
    prev.hidden = offset === 0;
    next.hidden = !data.more;
    pagination.hidden = prev.hidden && next.hidden;
    status.textContent = data.items.length ? '' : empty;
  } catch {
    status.textContent = error;
  }
})();
