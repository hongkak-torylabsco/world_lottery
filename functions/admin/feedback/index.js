import { authorized } from '../../../lib/feedback-access.js';

const html = String.raw`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>문의 관리 | World Lottery</title>
  <link rel="stylesheet" href="/admin-feedback.css">
  <script src="/admin-feedback.js" defer></script>
</head>
<body>
  <main class="information-page">
    <article class="card information-content">
      <h1>문의 관리</h1>
      <form id="admin-filter" class="feedback-edit">
        <label>보기
          <select name="view">
            <option value="">문의</option>
            <option value="independent">독립 공개 Q&amp;A</option>
          </select>
        </label>
        <label>검색어 <input name="q" type="search" maxlength="100"></label>
        <label>문의 상태
          <select name="status">
            <option value="">전체</option>
            <option value="new">신규</option>
            <option value="in_progress">확인 중</option>
            <option value="resolved">답변 완료</option>
          </select>
        </label>
        <label>분류
          <select name="category">
            <option value="">전체</option>
            <option value="general">일반</option>
            <option value="bug">오류 신고</option>
            <option value="rules">복권 규칙</option>
            <option value="other">기타</option>
          </select>
        </label>
        <button type="submit" class="btn">검색</button>
      </form>
      <p id="admin-status" role="status"></p>
      <section aria-label="비공개 문의함">
        <a href="/cdn-cgi/access/logout">로그아웃</a>
        <div id="admin-items"></div>
        <nav class="information-nav" aria-label="문의 페이지 이동">
          <button type="button" class="btn" id="admin-prev" disabled>이전</button>
          <button type="button" class="btn" id="admin-next" disabled>다음</button>
        </nav>
      </section>
      <noscript><p>문의 관리를 사용하려면 JavaScript를 켜 주세요.</p></noscript>
    </article>
  </main>
  <template id="admin-item">
    <details class="feedback-entry">
      <summary class="feedback-text"></summary>
      <p data-private-meta></p>
      <p class="feedback-text" data-message></p>
      <p data-email></p>
      <form data-status-form>
        <label>문의 상태
          <select name="status">
            <option value="new">신규</option>
            <option value="in_progress">확인 중</option>
            <option value="resolved">답변 완료</option>
          </select>
        </label>
        <button class="btn" type="submit">상태 저장</button>
      </form>
      <form class="feedback-edit" data-review>
        <label>내부 메모 <textarea name="note" maxlength="3000" rows="3"></textarea></label>
        <label>비공개 답변 <textarea name="response" maxlength="3000" rows="4"></textarea></label>
        <p>이메일 답변은 운영자가 직접 보냅니다.</p>
        <button class="btn" type="submit">메모와 답변 저장</button>
      </form>
      <form class="feedback-edit" data-public-form hidden>
        <h3>공개용 질문과 답변</h3>
        <p data-publication></p>
        <label><input type="checkbox" name="privacyReviewed"> 질문과 답변에서 개인정보와 원본 접수 번호를 제거했음을 확인합니다.</label>
        <label>게시 언어
          <select name="lang">
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="pt-BR">Português (Brasil)</option>
          </select>
        </label>
        <label>공개 질문 <textarea name="question" required maxlength="500" rows="2"></textarea></label>
        <label>공개 답변 <textarea name="answer" required maxlength="3000" rows="4"></textarea></label>
        <div>
          <button class="btn btn-primary" type="submit">승인 및 공개</button>
          <button class="btn" type="submit" data-draft>공개 후보 저장</button>
          <button class="btn" type="button" data-unpublish hidden>공개 취소</button>
        </div>
      </form>
      <div class="feedback-edit" data-private-actions>
        <label><input type="checkbox" data-redact-content> 비공개 제목·내용·메모·답변도 지우기</label>
        <button class="btn" type="button" data-redact>개인정보 삭제</button>
        <button class="btn" type="button" data-delete>비공개 문의 삭제</button>
      </div>
      <p role="status" data-result></p>
    </details>
  </template>
</body>
</html>
`;

export async function onRequest({ request, env }) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow'
  };
  if (!await authorized(request, env)) return new Response('Access required', { status: 401, headers });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  }
  return new Response(request.method === 'HEAD' ? null : html, { headers });
}
