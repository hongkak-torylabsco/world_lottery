# World Lottery v1.8.0 운영 배포 설계

공개 Pages는 `world-lottery.pages.dev`를 계속 사용합니다. 관리자 전용 프로젝트의 제안명은 `world-lottery-admin`입니다. 이 문서는 로컬 준비와 승인 후 작업을 설명합니다.

## 확인한 구조

- 저장소 루트에는 공개 HTML·JS·CSS, SEO·AdSense 파일, 집계 데이터가 있습니다. `functions/`에는 번호 생성, 문의, Q&A, 관리자 API와 관리자 HTML을 반환하는 핸들러가 있습니다. `lib/`에는 공용 HTTP 유틸리티와 관리자 JWT 검증기가 있습니다. `migrations/`의 0001~0004는 문의, Q&A, 속도 제한과 보관 스키마를 정의합니다. 번호 생성의 실제 엔진과 비공개 원자료는 별도 프로젝트에 있습니다.
- 4-1 읽기 전용 점검에서 공개 프로젝트 `world-lottery`의 Production 브랜치는 `main`이며 `FEEDBACK_DB` 바인딩과 운영 Turnstile 설정은 없었습니다. 운영 D1 `world-lottery-feedback-production`에는 0001~0004 적용이 확인됐고, 관리자 프로젝트 Production은 해당 DB를 사용 중입니다. 기존 Preview의 D1은 별도입니다.

## 격리된 패키지

저장소 루트에서 다음 로컬 명령을 실행합니다. 각 명령은 새 임시 스테이징 디렉터리를 출력합니다.

```powershell
$publicStage = node scripts/build-pages.cjs public
$adminStage = node scripts/build-pages.cjs admin
foreach ($stage in @($publicStage, $adminStage)) {
  Push-Location -LiteralPath $stage
  try {
    npx.cmd wrangler@4.160.0 pages functions build functions --outdir compiled --compatibility-date 2026-11-17
    if ($LASTEXITCODE -ne 0) { throw "Pages Functions build failed: $stage" }
  } finally {
    Pop-Location
  }
}
```

| 스테이징 | 정적 자산 | 번들 경로 |
| --- | --- | --- |
| `public` | 공개 페이지·문의·Q&A, 공용 CSS와 JS, 기존 SEO·AdSense, 집계 JSON 및 기존 호환 파일 | `/api/v1/generate`, `/api/v1/feedback`, `/api/v1/qa` |
| `admin` | 관리자 JS·CSS | `/admin/feedback`의 서버 렌더링 HTML, `/api/v1/admin-feedback` |

두 패키지에는 명시적 `_routes.json`과 `404.html`이 있습니다. 파일 허용 목록으로 각 스테이징의 `functions/`와 `lib/`를 따로 구성합니다. 공개 번들에 관리자 핸들러와 JWT 검증기가 들어가지 않습니다. 승인 후 각 스테이징 디렉터리를 현재 작업 디렉터리로 삼아 Wrangler에 `assets`를 업로드 디렉터리로 지정합니다. Wrangler는 같은 스테이징의 `functions/`를 자동 컴파일합니다. `compiled/`는 사전 컴파일 검증용입니다. 단일 `--outfile` 방식의 출력은 Wrangler의 업로드용 multipart 형식이므로 정적 자산 디렉터리에 복사하면 안 됩니다. 저장소 루트에서 업로드하면 원본의 결합형 Functions를 참조할 수 있으므로 운영 작업 디렉터리로 사용하지 않습니다. 인자 없는 기존 빌드는 레거시 Preview 절차 전용입니다. [Pages Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) · [Wrangler Pages 명령](https://developers.cloudflare.com/workers/wrangler/commands/pages/) · [라우팅](https://developers.cloudflare.com/pages/functions/routing/)

## 인증, 바인딩 및 권한

| 대상 | Production 설정 |
| --- | --- |
| 공개 Pages | 기존 `ENGINE` Service Binding 보존. 새 `FEEDBACK_DB`는 승인된 운영 피드백 D1 UUID. `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES=world-lottery.pages.dev`는 승인된 운영 위젯 값. |
| 관리자 Pages | 같은 UUID를 `FEEDBACK_DB`로 연결. `FEEDBACK_ACCESS_ISSUER=https://shiny-tooth-c825.cloudflareaccess.com`, `FEEDBACK_ACCESS_AUD`는 기본 호스트 앱 AUD, `FEEDBACK_ACCESS_DEPLOYMENT_AUD`는 배포 주소 와일드카드 앱 AUD, `FEEDBACK_ACCESS_ADMIN_EMAIL=torylabs.co@gmail.com`. UI와 API는 요청 호스트에 해당하는 동일 AUD를 검증합니다. |
| 별도 삭제 Worker | 승인된 동일 UUID의 `FEEDBACK_DB`. UTC Cron만 사용합니다. HTTP 라우트, `workers.dev`, Worker Preview URL을 끕니다. |

새 관리자 Pages 프로젝트의 기본 호스트 전체를 Access로 보호하고, 허용 정책에 이메일 하나만 등록합니다. 이름이 이미 사용 중이면 실제 할당 호스트를 확인합니다. Direct Upload는 해당 프로젝트의 실제 Production 브랜치만 지정합니다. 관리자 Preview가 필요해지면 별칭과 해시 URL에 대한 Access 보호를 먼저 확인하고 운영 D1과 운영 AUD를 연결하지 않습니다. 관리자 UI·API는 같은 호스트이며, 기존 인증 코드는 모든 API 메서드에서 D1 접근 전에 JWT 및 이메일을 확인합니다. 공개 GET은 Q&A의 게시 상태와 공개 필드만 조회합니다. 직접 공유한 D1 바인딩은 DB 전체에 SQL을 실행할 수 있는 런타임 권한입니다. 공개 코드의 제한된 SQL과 HTTP 라우팅은 사용자 접근 경계이며, 테이블 권한을 분리하려면 별도의 제한된 Worker 인터페이스가 필요합니다. [Pages Access 설정](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain) · [Pages 바인딩](https://developers.cloudflare.com/pages/functions/bindings/) · [JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## 개인정보 1년 보관 및 자동 삭제

[0004 마이그레이션](migrations/0004_feedback_retention.sql)은 운영 D1에 적용됐습니다. [삭제 Worker](workers/feedback-retention/index.js)는 운영에서 매시간 실행됩니다. 확인한 예약 실행 3회는 성공했고 각각 0건을 삭제했습니다. 공개 처리방침 네 언어에 이 운영 상태를 반영했습니다.

1. **게시물 독립화.** 0004는 문의 외래 키를 nullable로 바꾸면서 연결된 초안에 대한 CASCADE를 유지합니다. 기존 게시물의 ID·내용·언어·분류·시각과 ID 할당 순서를 보존하지만, 개인정보 검토 이력이 없으므로 초안으로 전환합니다. 만료 전 재검토해 게시할 수 있습니다. 독립 Q&A는 관리자 화면의 별도 보기에서 공개 ID로 관리합니다. 독립 게시물의 공개 취소는 해당 게시물을 삭제합니다.
2. **개인정보 검토.** 게시·수정은 운영자의 검토 확인을 요구합니다. 서버는 전화번호·이메일·UUID 형태를 검사하고, 연결된 게시물은 문의 이메일·접수 ID·원문 등과 비교합니다. 이 검사는 일부 복사 사례를 차단하며, 이름·주소·식별 가능한 맥락·변형된 개인정보를 사람이 검토해야 합니다. 공개 응답은 공개 ID·분류·질문·답변·게시 시각을 반환합니다. 문의 삭제 요청이 공개 글에도 해당하면 게시를 먼저 취소하고 문의를 삭제합니다. 이미 분리된 글은 독립 보기에서 수정하거나 취소합니다.
3. **만료 및 원자적 삭제.** 생성 열 `expires_at`에 접수 UTC 시각 기준으로 다음 해 같은 시각을 계산합니다. 2월 29일은 다음 해 2월 28일을 사용합니다. 수정·게시로 만료가 연장되지 않습니다. UTC 매시 정각의 예약 시각을 기준으로 100행씩 최대 10회 삭제합니다. 각 DELETE의 DB 트리거는 검토된 게시물의 연결을 해제하며, 같은 문장 안에서 문의 행과 남은 연결 초안이 삭제됩니다. 수동 문의 삭제에도 동일한 트리거가 적용됩니다. 만료된 문의는 관리자 목록·게시·상태·답변 편집에서 제외하고, 명시적 삭제·공개 취소는 허용합니다.
4. **실패·재시도·로그.** 실패하면 현재 SQL 배치를 롤백하고 회차를 중단합니다. 먼저 성공한 배치는 유지됩니다. 다음 시간의 실행이 남은 만료 행을 다시 고르므로 재실행이 멱등적입니다. Worker의 애플리케이션 로그는 확정 삭제 건수와 고정 결과 코드만 기록합니다. Workers 호출 로그와 추적은 꺼 둡니다. 오류나 상한 도달이 반복되면 운영자가 만료 대기 건수를 확인합니다. 속도 제한 기록은 기존 문의 API의 버킷 정리 규칙을 따르며 운영 중 접수가 없을 때의 별도 정리 기준은 아래 개인정보 문서를 따릅니다.
5. **복구·외부 사본.** D1 Time Travel은 플랜에 따라 최근 7일 또는 30일의 과거 데이터를 복구할 수 있습니다. 복원 후 트래픽을 재개하기 전에 만료 삭제와 삭제 요청을 재적용합니다. 메일·로그·별도 내보내기는 추가 정책 범위입니다. [개인정보 운영 정책](PRIVACY-OPERATIONS-v1.8.0.md) · [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

로컬 테스트는 실제 마이그레이션·Worker·Pages 핸들러로 윤일과 만료 경계, 한도, 실패·재실행, 독립 게시물 보존 및 개인정보 패턴 차단을 검증합니다. 운영 승인 후에는 Access와 운영 스케줄을 별도로 검증합니다.

## 승인 후 마이그레이션과 Worker 배포

1. 대상 계정과 운영 UUID를 확인하고 D1 마이그레이션 적용 이력 및 복구 지점을 기록합니다. 새 DB에서는 0001 → 0002 → 0003 → 0004 순서로 적용합니다. 0003까지 적용된 DB는 0004만 적용합니다. 기존 미검토 게시물이 있다면 새 공개 조회를 열기 전에 재검토 계획을 잡습니다. 적용 중 해당 DB 사용 서비스의 쓰기를 중지하거나 유지보수 창을 사용합니다.
2. [Worker 구성](workers/feedback-retention/wrangler.jsonc)을 운영 배포용으로 복사하고 로컬 UUID·DB 이름을 승인된 운영 값으로 교체합니다. 복사 위치에 맞춰 엔트리 파일 및 migrations 경로를 확인합니다. 마이그레이션 대상은 명시한 운영 구성과 `FEEDBACK_DB`로 확인한 후에만 `wrangler d1 migrations apply FEEDBACK_DB --config <운영-구성> --remote`를 실행합니다. 0004 적용 후 FK 검사와 실제 공개·관리자 패키지를 검증합니다. 로컬 원본 구성의 확인 명령은 README에 있습니다.
3. Worker 단계 배포 시 운영 구성에 먼저 `"triggers": { "crons": [] }`를 두고 HTTP·Preview 라우트가 비활성인지 확인한 뒤 `wrangler deploy --config <운영-구성>`를 실행합니다. 격리된 DB에서의 삭제 검증과 운영 승인을 마치면 `0 * * * *`를 구성에 복원해 재배포합니다. 이 두 번째 배포가 Cron을 활성화합니다. 첫 회차의 상태와 삭제 건수를 확인합니다.
4. Worker 장애 시 먼저 운영 구성의 Cron 목록을 비우고 재배포하여 예약 실행을 중지합니다. 이미 커밋된 배치는 코드 롤백으로 복구되지 않습니다. 스키마 롤백이 필요한 경우 0004 이전 상태로의 D1 복구는 별도 승인 작업입니다. 쓰기를 중지하고 복구 지점 이후 작업의 손실 범위를 확인한 뒤, 복구로 되살아날 수 있는 만료 데이터와 삭제 요청을 재적용합니다. 0004 이전 관리자 코드에는 새 게시 검토 기능이 없으므로 0004 상태에서 관리자 배포를 되돌릴 때는 호환 버전을 사용하거나 관리자 접근을 중지합니다.

## 승인 후 순서와 롤백

1. 운영 사이트의 현재 배포 ID, Production 바인딩, Access 보호 범위를 기록합니다. 신규 운영 D1 생성과 마이그레이션, 관리자 Pages 생성과 호스트 전체 Access 설정, 운영 Turnstile 설정, 별도 Cron Worker 생성을 각각 승인받습니다.
2. 운영 D1 스키마 적용 및 복구 절차를 승인받습니다. 신규 관리자 호스트에 Access를 먼저 적용합니다. 빈 프로젝트에서 차단 확인이 어려우면 운영 D1 연결 없이 무데이터 Production 검증 배포로 먼저 확인합니다. 이후 허용·비허용 계정과 JWT, 관리자 UI와 동일 출처 API를 검증합니다. 운영 D1 연결은 Production 배포로 한정합니다.
3. 격리된 환경의 가상 데이터로 삭제 동작을 확인하고 별도 승인으로 운영 예약 실행을 활성화합니다. 운영 실행을 확인한 뒤 공개 처리방침의 자동 삭제 상태를 갱신하고 패키지를 다시 빌드합니다. 공개 패키지 배포를 승인받아 업로드합니다. 번호 생성, 비로그인 문의·Turnstile, 승인 Q&A, 관리자 URL 및 자산의 GET 404와 관리자 API POST의 정적 405, canonical·robots·사이트맵·AdSense를 검증합니다.
4. 장애 시 공개 Pages를 기록한 정상 배포로 롤백합니다. 관리자 Access는 유지하면서 관리자 배포를 직전 정상 버전으로 되돌리거나 접근을 중지합니다. 스키마와 호환되는 패키지만 재사용합니다. 삭제 오류는 먼저 Cron을 일시 중지하고 만료 대기량을 확인합니다. Pages 롤백과 D1 복구는 별개입니다. D1 복구는 데이터 손실 범위와 삭제 재적용 절차를 검토하고 별도로 승인받습니다. 롤백 후 번호 생성, 공개 라우트, 관리자 차단 및 D1 연결을 재확인합니다. [Pages 롤백](https://developers.cloudflare.com/pages/configuration/rollbacks/)
