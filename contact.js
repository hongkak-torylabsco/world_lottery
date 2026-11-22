(() => {
  const copy = {
    ko: {
      title: '피드백 및 질문', home: '번호 생성기', about: '사이트 소개', guide: '이용 안내', privacy: '개인정보처리방침',
      intro: '오류를 제보하거나 개선을 제안하고, 사이트 이용에 대해 질문할 수 있습니다. 제출 내용은 운영자가 확인합니다.',
      type: '유형', feedback: '피드백', question: '질문', email: '답변 받을 이메일 (선택)', message: '내용',
      note: '최대 3,000자까지 입력할 수 있습니다. 비밀번호나 복권 사진 같은 민감한 정보는 보내지 마세요.',
      submit: '보내기', issues: '공개 GitHub 이슈 보기', qa: '공개 질문과 답변', sending: '보내는 중…',
      verification: '보안 확인을 완료한 뒤 다시 보내 주세요.', checking: '보안 확인을 기다리는 중입니다.',
      success: '접수 번호', receiptTitle: '전송 완료', done: '완료', invalid: '내용과 이메일 주소를 확인해 주세요.',
      failure: '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    },
    en: {
      title: 'Feedback & Questions', home: 'Number generator', about: 'About', guide: 'Guide', privacy: 'Privacy policy',
      intro: 'Report a bug, suggest an improvement, or ask a question about the site. The site operator reviews submissions privately.',
      type: 'Type', feedback: 'Feedback', question: 'Question', email: 'Email for a reply (optional)', message: 'Message',
      note: 'Use up to 3,000 characters. Please leave out sensitive information such as passwords or lottery ticket photos.',
      submit: 'Send', issues: 'View public GitHub issues', qa: 'Public Q&A', sending: 'Sending…',
      verification: 'Complete the security check and try again.', checking: 'Waiting for the security check.',
      success: 'Reference', receiptTitle: 'Submission received', done: 'Done', invalid: 'Check your message and email address.',
      failure: 'Your submission could not be saved. Please try again in a moment.'
    },
    ja: {
      title: 'ご意見・ご質問', home: '番号ジェネレーター', about: 'サイトについて', guide: '利用ガイド', privacy: 'プライバシーポリシー',
      intro: '不具合の報告、改善の提案、サイトの使い方に関する質問を送信できます。内容はサイト運営者が確認します。',
      type: '種類', feedback: 'ご意見', question: 'ご質問', email: '返信先メールアドレス（任意）', message: '内容',
      note: '3,000文字まで入力できます。パスワードや宝くじ券の写真などの機密情報は送信しないでください。',
      submit: '送信', issues: 'GitHub の公開 Issue を見る', qa: '公開されている質問と回答', sending: '送信中…',
      verification: 'セキュリティ確認を完了してから、もう一度送信してください。', checking: 'セキュリティ確認を待っています。',
      success: '受付番号', receiptTitle: '送信完了', done: '完了', invalid: '内容とメールアドレスを確認してください。',
      failure: '送信を受け付けられませんでした。しばらくしてからもう一度お試しください。'
    },
    'pt-BR': {
      title: 'Feedback e perguntas', home: 'Gerador de números', about: 'Sobre', guide: 'Guia', privacy: 'Política de privacidade',
      intro: 'Relate um problema, sugira uma melhoria ou faça uma pergunta sobre o site. A equipe do site analisa os envios em particular.',
      type: 'Tipo', feedback: 'Feedback', question: 'Pergunta', email: 'E-mail para resposta (opcional)', message: 'Mensagem',
      note: 'Use até 3.000 caracteres. Evite dados confidenciais, como senhas ou fotos de bilhetes de loteria.',
      submit: 'Enviar', issues: 'Ver issues públicas no GitHub', qa: 'Perguntas e respostas públicas', sending: 'Enviando…',
      verification: 'Conclua a verificação de segurança e tente novamente.', checking: 'Aguardando a verificação de segurança.',
      success: 'Protocolo', receiptTitle: 'Envio recebido', done: 'Concluir', invalid: 'Confira a mensagem e o endereço de e-mail.',
      failure: 'Não foi possível registrar seu envio. Tente novamente em instantes.'
    }
  };

  const extra = {
    ko: ['분류', '제목 (선택)', '일반', '오류 신고', '복권 규칙', '기타', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'],
    en: ['Category', 'Subject (optional)', 'General', 'Bug report', 'Lottery rules', 'Other', 'Too many requests. Please try again later.'],
    ja: ['分類', '件名（任意）', '一般', '不具合報告', '宝くじのルール', 'その他', 'リクエストが多すぎます。しばらくしてから再度お試しください。'],
    'pt-BR': ['Categoria', 'Assunto (opcional)', 'Geral', 'Relato de erro', 'Regras da loteria', 'Outro', 'Muitas solicitações. Tente novamente mais tarde.']
  };
  const form = document.getElementById('contact-form');
  const fields = document.getElementById('contact-fields');
  const status = document.getElementById('contact-status');
  const submit = document.getElementById('contact-submit');
  const receiptDialog = document.getElementById('contact-receipt');
  const receiptReference = document.getElementById('receipt-reference');
  const links = document.querySelectorAll('a[lang]');
  const labels = {
    'contact-title': 'title', 'home-link': 'home', 'about-link': 'about', 'guide-link': 'guide', 'privacy-link': 'privacy',
    'contact-intro': 'intro', 'type-label': 'type', 'email-label': 'email', 'message-label': 'message',
    'contact-note': 'note', 'contact-submit': 'submit', 'public-issues': 'issues', 'public-qa': 'qa',
    'receipt-title': 'receiptTitle', 'receipt-done': 'done'
  };
  let lang;
  let submissionId;
  let submissionLanguage;
  let state;
  let receipt;
  let siteKey;
  let widget;
  let turnstileToken;

  function renderStatus() {
    const message = state === 'rate' ? extra[lang][6] : copy[lang][state];
    status.textContent = state === 'success' ? `${message} · ${receipt}` : message || '';
    if (state === 'success') receiptReference.textContent = status.textContent;
  }

  function renderLanguage() {
    const requested = new URLSearchParams(location.search).get('lang') || location.hash.slice(1) || 'ko';
    const nextLanguage = Object.hasOwn(copy, requested) ? requested : 'en';
    const languageChanged = lang !== nextLanguage;
    lang = nextLanguage;
    const translation = copy[lang];
    document.documentElement.lang = lang;
    document.title = `${translation.title} | World Lottery`;
    for (const [id, key] of Object.entries(labels)) document.getElementById(id).textContent = translation[key];
    const privacy = document.getElementById('privacy-link');
    privacy.href = lang === 'ko' ? 'privacy.html' : `privacy.html#${lang}`;
    document.getElementById('public-qa').href = `/questions/?lang=${lang}`;
    for (const option of form.elements.type.options) option.textContent = translation[option.value];
    const [category, subject, ...options] = extra[lang];
    document.getElementById('category-label').textContent = category;
    document.getElementById('subject-label').textContent = subject;
    [...form.elements.category.options].forEach((option, index) => { option.textContent = options[index]; });
    for (const link of links) {
      if (link.lang === lang) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    renderStatus();
    if (languageChanged && widget !== undefined) renderVerification();
  }

  function clearVerification() {
    turnstileToken = undefined;
    submit.disabled = true;
  }

  function renderVerification() {
    clearVerification();
    if (widget !== undefined) window.turnstile.remove(widget);
    widget = window.turnstile.render('#contact-verification', {
      sitekey: siteKey,
      action: 'feedback',
      language: lang,
      size: 'flexible',
      'response-field': false,
      callback(token) {
        turnstileToken = token;
        submit.disabled = false;
        if (state === 'checking') {
          state = undefined;
          renderStatus();
        }
      },
      'expired-callback': clearVerification,
      'error-callback': () => {
        clearVerification();
        state = 'verification';
        renderStatus();
      }
    });
  }

  async function loadVerification() {
    state = 'checking';
    renderStatus();
    function showVerificationFailure() {
      state = 'failure';
      renderStatus();
    }
    try {
      const response = await fetch('/api/v1/feedback', { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Feedback unavailable');
      ({ siteKey } = await response.json());
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = () => {
        try {
          renderVerification();
        } catch {
          showVerificationFailure();
        }
      };
      script.onerror = showVerificationFailure;
      document.head.append(script);
    } catch {
      showVerificationFailure();
    }
  }

  for (const link of links) {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', link.href);
      renderLanguage();
    });
  }
  window.addEventListener('popstate', renderLanguage);
  document.getElementById('receipt-done').addEventListener('click', () => {
    receiptDialog.close();
    location.assign('/index.html');
  });
  form.addEventListener('input', () => {
    submissionId = undefined;
    if (turnstileToken || state === 'success') state = undefined;
    renderStatus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (fields.disabled || !turnstileToken) return;
    const values = Object.fromEntries(new FormData(form));
    const invalidField = !values.message.trim() ? form.elements.message
      : form.elements.email.validity.typeMismatch ? form.elements.email : null;
    if (invalidField) {
      state = 'invalid';
      renderStatus();
      invalidField.focus();
      return;
    }

    try {
      if (!submissionId) {
        submissionId = crypto.randomUUID();
        submissionLanguage = lang;
      }
      fields.disabled = true;
      state = 'sending';
      renderStatus();
      const response = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, id: submissionId, lang: submissionLanguage, turnstileToken }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (response.ok && result.id === submissionId) {
        receipt = result.id;
        form.reset();
        submissionId = undefined;
        state = 'success';
      } else {
        state = result.error === 'verification_failed' ? 'verification'
          : response.status === 429 ? 'rate' : [400, 413].includes(response.status) ? 'invalid' : 'failure';
      }
    } catch {
      state = 'failure';
    } finally {
      fields.disabled = false;
      clearVerification();
      window.turnstile.reset(widget);
      renderStatus();
      if (state === 'success') receiptDialog.showModal();
    }
  });

  renderLanguage();
  form.hidden = false;
  loadVerification();
})();
