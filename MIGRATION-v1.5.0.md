# World Lottery v1.5.0

## v1.4.2 기준 동작

- `script.js`의 생성 버튼과 묶음 수 변경이 14개 게임의 생성 진입점입니다. 한 장은 비복원 추출을, 여러 장은 `lottery.js`의 조합 순위 비복원 샘플링을 사용합니다. 구매자가 고르는 별도 번호는 독립 번호 풀에서 추출하며, 추첨 전용 보너스는 조합에 포함하지 않습니다.
- `lottery.js`에는 당첨 확률 계산, 통계 표시, 오프라인 데이터 집계가 들어 있습니다.
- `script.js`는 생성 결과를 localStorage 기록과 즐겨찾기에 저장합니다. 공 표시, PNG, 공유, 클립보드는 동일한 구매 번호를 사용합니다. `index.html`은 생성 및 분석 스크립트를 불러오며 `style.css`는 공과 모바일 레이아웃을 담당합니다.
- `scripts/`는 공식 이력 검증·집계와 Chrome 회귀 테스트를 담당합니다. `test/`의 Node 테스트는 브라우저 파일의 생성 함수를 직접 가져오고, Chrome 테스트는 기존 저장 기록과 UI 동작을 검증합니다.

## 배포 구성

브라우저는 같은 출처의 `POST /api/v1/generate`에 게임 ID, 수량, 모드를 보냅니다. 공개 Pages Function인 `functions/api/v1/generate.js`는 `ENGINE` 서비스 바인딩으로 요청을 전달합니다. `_routes.json`은 API 경로에만 Function을 연결하므로 사이트 파일과 집계 JSON은 정적으로 제공됩니다. 응답의 `main`과 `extra`는 기존 기록 구조에 맞춰 저장합니다.

v1.4.x의 한국 생성기와 원본 이력 경로에는 캐시 교체용 안내 파일을 배포합니다. 두 파일에는 이전 코드나 회차 데이터가 들어 있지 않습니다.

- 공개 저장소의 정적 업로드는 `node scripts/build-pages.cjs`가 만든 임시 디렉터리를 사용합니다. 업로드 파일은 HTML, CSS, 공개 JS, AdSense·SEO 파일, 집계 JSON 및 라우팅 설정입니다. 미국 원본 추첨 JSON과 검증 스크립트는 오프라인 갱신용입니다.
- 별도 로컬 프로젝트 `../world-lottery-engine`의 `worker.mjs`가 API를 처리합니다. `engine.cjs`, `lottery.js`, `korea-lotto.js`, `games.json`, `data/kr-lotto645.json`은 Worker 번들 안에만 들어갑니다. Wrangler 설정, 가져오기·집계 스크립트와 엔진 테스트도 별도 프로젝트에 있습니다.
- 한국 Lotto의 회차별 추첨 데이터는 검증 후 Worker 빌드에 포함합니다. 공개 `data/analysis.json`에는 한국 및 미국 통계와 출처·기간 정보가 들어갑니다. 한국 데이터를 갱신할 때는 비공개 프로젝트에서 CSV를 가져오고 테스트한 뒤 `node scripts/export-summary.cjs`로 한국 집계 항목을 내보냅니다. 공개 JSON의 `kr-lotto-645` 항목만 교체하고 Worker와 집계 데이터의 기준일이 맞는지 확인합니다.

## 로컬 실행

Node.js와 Wrangler 4.160.0으로 검증했습니다. 아래 두 터미널을 각각 실행합니다. 운영 Worker 설정은 운영 출처만 허용하고, 첫 번째 명령은 로컬 실행에만 개발 출처를 지정합니다.

```powershell
cd ../world-lottery-engine
npx wrangler@4.160.0 dev --local --ip 127.0.0.1 --port 8787 --var 'ALLOWED_ORIGINS:http://127.0.0.1:8788,http://localhost:8788'
```

```powershell
# 공개 저장소 루트에서 실행
$assets = node scripts/build-pages.cjs
npx wrangler@4.160.0 pages dev "$assets" --ip 127.0.0.1 --port 8788 --compatibility-date 2026-11-17 --service ENGINE=world-lottery-engine
```

Pages는 `http://127.0.0.1:8788/`에서 열립니다. Wrangler에 `ENGINE … local [connected]`가 표시되는지 확인합니다. 정적 파일 수정 후 빌드 디렉터리를 다시 생성합니다.

```powershell
# 공개 저장소
node --test
node scripts/update-draws.cjs --verify
node scripts/browser-regression.cjs "C:/Program Files/Google/Chrome/Application/chrome.exe"

# 비공개 프로젝트
cd ../world-lottery-engine
node --test
npx wrangler@4.160.0 deploy --dry-run --outdir "$env:TEMP/world-lottery-engine-dry-run"
```

## 승인 후 운영 배포

1. 비공개 GitHub 저장소 생성과 Worker·Pages 설정 변경의 승인을 받습니다. 비공개 저장소의 공개 범위와 배포 계정 권한을 확인합니다.
2. 별도 이름의 검증용 Worker를 먼저 배포하고 Pages Preview의 `ENGINE` 바인딩으로 연결합니다. 검증용 Worker의 `ALLOWED_ORIGINS`에는 실제 사용할 Preview 별칭만 등록합니다. 정적 응답과 생성 API, 오류 응답, 응답 캐시 방지, 요청 제한, 한국 필터의 CPU 사용량을 확인합니다.
3. 비공개 저장소에서 운영 Worker를 배포합니다. 공개 Worker URL과 Preview URL을 끄고, 기존 Pages 프로젝트의 **Production** 환경에 서비스 바인딩 `ENGINE → world-lottery-engine`을 추가합니다. `ALLOWED_ORIGINS`는 `https://world-lottery.pages.dev`로 지정합니다. 배포 자격 증명은 로컬 인증 또는 CI 비밀 저장소에 둡니다.
4. 공개 저장소 루트에서 `node scripts/build-pages.cjs`를 실행하고, 출력 경로를 `npx wrangler@4.160.0 pages deploy "<출력 경로>" --project-name world-lottery --branch main`에 전달합니다. Wrangler가 루트의 공개 Pages Function을 함께 컴파일합니다. 기존 Pages 프로젝트의 인증 태그·광고 설정은 유지합니다.
5. Production URL에서 API 연동, 14개 게임 및 정적 파일을 재검증합니다. 문제 시 기존 정상 Pages 배포로 롤백하고, Worker 버전과 바인딩 상태를 함께 점검합니다.

## 제한과 비용

API는 서비스 바인딩 뒤에 있으며 Pages API 경로는 공개입니다. 허용 출처 검사 외에 Cloudflare Rate Limiting 바인딩으로 IP별·Cloudflare 위치별 10초당 30건을 제한합니다. 이는 근사 제한이며 CORS는 인증 기능이 아닙니다. 트래픽 남용이 확인되면 Turnstile을 별도로 검토합니다. 요청 본문은 1 KiB, 묶음은 최대 10개입니다. 응답에는 `Cache-Control: no-store`를 적용합니다.

Cloudflare Workers Free는 Pages Functions와 합산해 하루 100,000건과 요청당 CPU 10ms를 제공합니다. API 경로만 Function을 호출하며 정적 요청은 무료입니다. 유료 Standard의 기본료는 월 US$5이고, 서비스 바인딩에는 별도 요청 요금이 없으며 양쪽 CPU 사용량이 합산됩니다. 운영 트래픽과 한국 필터 CPU를 측정한 뒤 무료 한도 내 운영 여부를 판단합니다. [Pages 요금](https://developers.cloudflare.com/pages/functions/pricing/) · [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/) · [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/) · [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) · [Pages 서비스 바인딩](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings)
