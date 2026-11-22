(() => {
  const status = document.getElementById('admin-status');
  const items = document.getElementById('admin-items');
  const template = document.getElementById('admin-item');
  const filter = document.getElementById('admin-filter');
  const prev = document.getElementById('admin-prev');
  const next = document.getElementById('admin-next');
  const categories = { general: '일반', bug: '오류 신고', rules: '복권 규칙', other: '기타' };
  let offset = 0;
  let filters = {};
  let loading = false;

  async function api(path = '', data) {
    const options = { signal: AbortSignal.timeout(12000), redirect: 'manual', cache: 'no-store' };
    if (data) {
      options.headers = { 'Content-Type': 'application/json' };
      options.method = 'POST';
      options.body = JSON.stringify(data);
    }
    const response = await fetch('/api/v1/admin-feedback' + path, options);
    if (response.status === 401 || response.status === 403 || response.type === 'opaqueredirect') {
      items.replaceChildren();
      status.textContent = 'Access 로그인 세션을 확인하려면 페이지를 새로고침해 주세요.';
      throw new Error('Access session unavailable');
    }
    if (!response.ok) throw new Error('Admin request failed');
    return response.json();
  }

  function showItem(item) {
    const entry = template.content.cloneNode(true);
    const details = entry.querySelector('details');
    const type = item.type === 'question' ? '질문' : '피드백';
    entry.querySelector('summary').textContent = item.title || type;
    entry.querySelector('[data-private-meta]').textContent =
      [type, categories[item.category], item.lang, item.created_at + ' UTC', item.id].join(' · ');
    entry.querySelector('[data-message]').textContent = item.message;
    const email = entry.querySelector('[data-email]');
    email.textContent = item.email || '답변 이메일 미제공';
    const statusForm = entry.querySelector('[data-status-form]');
    const review = entry.querySelector('[data-review]');
    const publicForm = entry.querySelector('[data-public-form]');
    const unpublish = entry.querySelector('[data-unpublish]');
    const draft = entry.querySelector('[data-draft]');
    const result = entry.querySelector('[data-result]');
    const entryStatus = entry.querySelector('[data-publication]');
    const controls = details.querySelectorAll('input, select, textarea, button');

    async function save(data, done) {
      controls.forEach(control => { control.disabled = true; });
      result.textContent = '저장 중…';
      try {
        await api('', { ...data, id: item.id });
        result.textContent = '저장했습니다.';
        done?.();
      } catch {
        result.textContent = '저장하지 못했습니다. 세션을 확인한 뒤 다시 시도해 주세요.';
      } finally {
        controls.forEach(control => { control.disabled = false; });
      }
    }

    statusForm.elements.status.value = item.status;
    statusForm.addEventListener('submit', event => {
      event.preventDefault();
      save({ action: 'status', status: statusForm.elements.status.value }, () => {
        if (filters.status && filters.status !== statusForm.elements.status.value) loadPage(offset);
      });
    });
    review.elements.note.value = item.internal_note;
    review.elements.response.value = item.operator_answer;
    review.addEventListener('submit', event => {
      event.preventDefault();
      save({ action: 'review', ...Object.fromEntries(new FormData(review)) });
    });

    function publication(published) {
      unpublish.hidden = !published;
      draft.hidden = published;
      entryStatus.textContent = published ? '게시 중' : '비공개';
    }

    if (item.type === 'question') {
      publicForm.hidden = false;
      publicForm.elements.lang.value = item.public_lang || item.lang;
      publicForm.elements.question.value = item.question || '';
      publicForm.elements.answer.value = item.answer || '';
      publication(item.publication === 'published');
      publicForm.addEventListener('submit', event => {
        event.preventDefault();
        const action = event.submitter === draft ? 'draft' : 'publish';
        if (action === 'publish' && !confirm('작성한 공개 질문과 답변을 게시하시겠습니까?')) return;
        save({ action, ...Object.fromEntries(new FormData(publicForm)) }, () => publication(action === 'publish'));
      });
      unpublish.addEventListener('click', () => save({ action: 'unpublish' }, () => publication(false)));
    }
    entry.querySelector('[data-redact]').addEventListener('click', () => {
      const includeMessage = details.querySelector('[data-redact-content]').checked;
      const target = includeMessage ? '이메일과 비공개 제목·내용·메모·답변' : '이메일';
      if (!confirm(target + '을(를) 삭제하시겠습니까?')) return;
      save({ action: 'redact', includeMessage }, () => {
        details.remove();
        loadPage(offset);
      });
    });
    entry.querySelector('[data-delete]').addEventListener('click', () => {
      if (!confirm('문의와 연결된 Q&A를 삭제하시겠습니까?')) return;
      save({ action: 'delete' }, () => {
        details.remove();
        loadPage(offset);
      });
    });
    items.append(entry);
  }

  async function loadPage(target) {
    if (loading) return;
    loading = true;
    status.textContent = '문의함을 불러오는 중…';
    let retry = false;
    try {
      const { q = '', ...selected } = filters;
      const data = await api('?' + new URLSearchParams({ ...selected, offset: target }), { action: 'search', q });
      if (!data.items.length && target > 0) {
        retry = true;
        return;
      }
      offset = target;
      items.replaceChildren();
      data.items.forEach(showItem);
      prev.disabled = offset === 0;
      next.disabled = !data.more;
      status.textContent = data.items.length ? '' : '표시할 문의가 없습니다.';
    } catch {
      status.textContent = '문의함을 불러오지 못했습니다. Access 로그인 상태를 확인해 주세요.';
    } finally {
      loading = false;
      if (retry) loadPage(0);
    }
  }

  filter.addEventListener('submit', event => {
    event.preventDefault();
    if (loading) return;
    filters = Object.fromEntries(new FormData(filter));
    loadPage(0);
  });
  prev.addEventListener('click', () => loadPage(offset - 20));
  next.addEventListener('click', () => loadPage(offset + 20));
  window.addEventListener('pagehide', () => items.replaceChildren());
  window.addEventListener('pageshow', event => { if (event.persisted) loadPage(offset); });
  loadPage(0);
})();
