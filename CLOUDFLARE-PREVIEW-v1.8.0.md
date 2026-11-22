# World Lottery v1.8.0 Cloudflare Preview 실행 계획

검증 대상은 `feature/feedback-qa-v1.8.0`의 `c0f203a2a8b91a6d8b45847cddd4338a83fac165`입니다. 아래 원격 변경 명령은 리소스 생성 및 Preview 배포 승인을 받은 뒤 실행합니다.

## 읽기 전용 확인 결과

- `world-lottery`는 Git 연결이 없는 Pages 프로젝트입니다. 저장소 문서의 Direct Upload 절차와 일치합니다. Production 브랜치는 `main`이며, 확인 당시 Production 배포 ID는 `f7b8cc2e-1552-4baf-ae12-0d70db2cf655`입니다.
- 기존 Pages Production의 `ENGINE`은 `world-lottery-engine`, Preview의 `ENGINE`은 `world-lottery-engine-preview`입니다. 기존 Preview Worker의 허용 출처는 `https://v15-review.world-lottery.pages.dev`입니다. 두 Pages 환경 모두 현재 D1 바인딩이 없습니다.
- 기존 `world-lottery` 프로젝트의 모든 환경과 두 기존 Worker를 보존합니다. 새 Direct Upload 프로젝트에서 Preview 환경만 구성합니다. 새 프로젝트 이름, Worker 이름, 호스트와 D1 이름이 비어 있거나 이번 검증에 이미 할당됐는지 확인합니다. 호스트나 규칙이 운영 트래픽과 겹치거나 바인딩 대상이 모호하면 실행을 중단합니다.

## 리소스와 환경별 바인딩

| 항목 | 기존 운영 | v1.8.0 전용 Preview |
| --- | --- | --- |
| Pages 프로젝트 / 브랜치 | `world-lottery` / `main` | `world-lottery-v180-review` / `feature/feedback-qa-v1.8.0` |
| 새 프로젝트의 Production 브랜치 | 해당 없음 | `production-unused`로 지정하고 배포 대상에서 제외 |
| `ENGINE` 서비스 바인딩 | `world-lottery-engine` | `world-lottery-engine-v180-review` |
| `FEEDBACK_DB` D1 바인딩 | 현재 없음 | `world-lottery-feedback-v180-preview`의 신규 UUID |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES` | 기존 설정 보존 | 전용 위젯의 사이트 키, 암호화한 비밀 키, 승인된 정확한 검증 호스트 |
| `FEEDBACK_ACCESS_ISSUER`, `FEEDBACK_ACCESS_AUD` | 기존 설정 보존 | 승인된 Zero Trust 팀 발급자 및 전용 관리자 앱 AUD |
| `FEEDBACK_ACCESS_API_AUD` | 기존 설정 보존 | 관리자 화면과 API를 한 앱으로 보호하므로 미설정 |

검증 호스트는 활성 Cloudflare DNS 영역에서 새 호스트 하나를 선택합니다. 공개 문의·Q&A와 관리자를 같은 호스트에 두고 Access는 관리자 경로에만 적용합니다. Pages 대시보드에서 해당 호스트를 새 프로젝트의 Custom domain으로 등록한 뒤 프록시된 CNAME이 실제 Preview 브랜치 별칭을 가리키게 합니다. 예상 별칭은 `feature-feedback-qa-v1-8-0.world-lottery-v180-review.pages.dev`입니다. 배포 상세에 표시된 실제 별칭을 사용합니다. DNS 전파 후 호스트가 Preview 배포를 제공하는지 확인합니다. [Pages 브랜치 사용자 지정 도메인](https://developers.cloudflare.com/pages/how-to/custom-branch-aliases/)

## 승인 후 실행 순서

### 1. 계정과 소스 확인

저장소 루트에서 실행합니다. Wrangler 로그인 계정과 대상 계정을 확인하고 이 세션의 `CLOUDFLARE_ACCOUNT_ID`를 승인된 계정 ID로 설정합니다. 환경변수에 인증 정보가 있으면 승인된 계정과 일치하는지 확인하며 값을 출력하지 않습니다. 현재 운영 배포 ID와 설정을 읽기 전용으로 기록해 완료 후 비교합니다.

```powershell
$wr = 'wrangler@4.160.0'
$project = 'world-lottery-v180-review'
$branch = 'feature/feedback-qa-v1.8.0'
$sha = 'c0f203a2a8b91a6d8b45847cddd4338a83fac165'
$dbName = 'world-lottery-feedback-v180-preview'
$engineName = 'world-lottery-engine-v180-review'
if ($env:CLOUDFLARE_ACCOUNT_ID -notmatch '^[a-f0-9]{32}$') {
  throw '승인된 Cloudflare 계정 ID를 이 세션에 설정하세요.'
}
$reviewHost = Read-Host '승인된 신규 검증 호스트 입력'
if ($reviewHost -notmatch '^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$' -or
    $reviewHost -like '*.pages.dev') { throw '전용 사용자 지정 호스트를 확인하세요.' }
$currentBranch = git branch --show-current
if (($currentBranch -and $currentBranch -ne $branch) -or (git rev-parse HEAD) -ne $sha) {
  throw '검증 브랜치와 커밋을 확인하세요.'
}
if (git status --porcelain) { throw '검증 대상 코드의 작업 트리가 깨끗해야 합니다.' }
npx.cmd $wr whoami
npx.cmd $wr pages project list
npx.cmd $wr d1 list
```

이 실행 문서가 원본 작업 트리에 남아 있으면 저장소 루트에서 `git worktree add --detach "<새 로컬 작업 트리 경로>" c0f203a2a8b91a6d8b45847cddd4338a83fac165`를 실행하고 새 경로로 이동합니다. 검증 대상 코드가 변경되면 배포를 중단합니다.

### 2. Preview D1 생성 및 마이그레이션

대시보드에서 새 D1의 이름과 UUID를 기록합니다. 기존 Pages 및 Worker 바인딩과 UUID를 비교하고, 이미 다른 서비스에 연결된 DB이면 중단합니다. `d1 info`로 같은 계정의 이름과 UUID를 교차 확인한 뒤 원격 적용으로 넘어갑니다. [D1 마이그레이션](https://developers.cloudflare.com/d1/reference/migrations/)

```powershell
npx.cmd $wr d1 create $dbName --update-config=false
if ($LASTEXITCODE) { throw 'D1 생성 결과를 확인하세요.' }
$dbId = [guid]::Parse((Read-Host '대시보드에서 확인한 Preview D1 UUID')).ToString()
npx.cmd $wr d1 info $dbName --json
if ($LASTEXITCODE) { throw 'D1 조회 실패' }
if ((Read-Host '계정·DB 이름·UUID·격리를 대조한 뒤 UUID 재입력') -ne $dbId) {
  throw 'D1 대상 대조가 완료되지 않았습니다.'
}
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('wl-v180-' + [guid]::NewGuid())
$migrationDir = Join-Path $scratch 'migrations'
New-Item -ItemType Directory -Path $migrationDir | Out-Null
$migrationFiles = @('0001_feedback.sql','0002_feedback_moderation.sql','0003_feedback_workflow.sql')
foreach ($file in $migrationFiles) { Copy-Item "migrations/$file" $migrationDir -ErrorAction Stop }
$d1Config = Join-Path $scratch 'd1.json'
@{
  name = 'world-lottery-v180-d1-migrations'
  account_id = $env:CLOUDFLARE_ACCOUNT_ID
  compatibility_date = '2026-11-17'
  d1_databases = @(@{ binding = 'FEEDBACK_DB'; database_name = $dbName; database_id = $dbId; migrations_dir = 'migrations' })
} | ConvertTo-Json -Depth 6 | Set-Content -Encoding ASCII $d1Config
npx.cmd $wr d1 migrations list $dbName --config $d1Config --remote
```

첫 적용 전 목록이 `0001 → 0002 → 0003` 순서인지 확인합니다. 이 구성의 `database_id`에 검증 D1 UUID를 직접 지정하므로 `--remote`를 사용합니다. `--preview` 플래그를 붙이지 않습니다.

```powershell
npx.cmd $wr d1 migrations apply $dbName --config $d1Config --remote
if ($LASTEXITCODE) { throw '마이그레이션 결과를 확인하세요.' }
npx.cmd $wr d1 execute $dbName --config $d1Config --remote --command "SELECT name FROM d1_migrations ORDER BY id; SELECT name FROM sqlite_master WHERE type='table' AND name IN ('feedback','public_qa','feedback_rate') ORDER BY name;"
npx.cmd $wr d1 migrations list $dbName --config $d1Config --remote
```

이력에 세 파일이 순서대로 있고 대기 파일이 없는지 확인합니다. 실패하면 기록과 스키마를 확인한 뒤 같은 UUID를 지정해 남은 마이그레이션만 적용합니다.

### 3. Access, Turnstile 및 번호 생성 Worker

1. Zero Trust에서 Self-hosted 앱 하나를 만들고 승인된 검증 호스트에 `/admin/feedback`, `/admin/feedback/*`, `/api/v1/admin-feedback`를 등록합니다. 테스트 운영자만 허용하고, 페이지 로그인으로 발급된 앱 세션이 같은 호스트의 API 요청에도 적용되는지 확인합니다. 관리자 페이지 로그인으로 받은 쿠키가 API에도 전달되도록 Cookie Path Attribute를 끕니다. `FEEDBACK_ACCESS_ISSUER`는 `https://<팀>.cloudflareaccess.com`, `FEEDBACK_ACCESS_AUD`는 앱의 AUD입니다. 기존 Access 앱, 조직 정책과 운영 호스트 규칙은 그대로 둡니다. [Self-hosted Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) · [JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
2. Turnstile에서 전용 Managed 위젯을 만들고 승인된 검증 호스트만 등록합니다. 발급된 사이트 키와 비밀 키를 Pages Preview에 지정하고 `TURNSTILE_HOSTNAMES`에는 스킴 없이 동일한 호스트를 넣습니다. `TURNSTILE_SECRET`은 대시보드에서 암호화하여 저장합니다. 정상 접수와 만료·재사용 토큰 거부를 검증합니다. 서버는 Siteverify의 성공 여부, 호스트 및 `feedback` 액션을 확인합니다. [Turnstile 설정](https://developers.cloudflare.com/turnstile/get-started/) · [Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
3. 승인된 기존 엔진 소스에서 새 이름의 Worker를 생성합니다. 배포 전 소스 리비전과 파일 상태를 확인합니다. 임시 구성에서 이름, 허용 출처, 별도의 속도 제한 네임스페이스만 설정합니다. `workers_dev`와 `preview_urls`는 끄고 DNS 경로를 연결하지 않습니다. 검증 호스트 하나만 `ALLOWED_ORIGINS`에 넣습니다.

```powershell
$engineRoot = (Resolve-Path 'C:/Users/kimho/Projects/world-lottery-engine').Path
$engineConfig = Join-Path $scratch 'engine.json'
$rateNamespace = Read-Host '계정에서 기존 Worker와 공유하지 않는 숫자 Rate Limiting namespace ID'
if ($rateNamespace -notmatch '^[0-9]+$' -or $rateNamespace -eq '15001') {
  throw 'Preview 전용 namespace ID를 확인하세요.'
}
@{
  name = $engineName
  account_id = $env:CLOUDFLARE_ACCOUNT_ID
  main = (Join-Path $engineRoot 'worker.mjs')
  compatibility_date = '2026-11-17'
  workers_dev = $false
  preview_urls = $false
  vars = @{ ALLOWED_ORIGINS = "https://$reviewHost" }
  ratelimits = @(@{ name = 'GENERATE_LIMIT'; namespace_id = $rateNamespace; simple = @{ limit = 30; period = 10 } })
} | ConvertTo-Json -Depth 6 | Set-Content -Encoding ASCII $engineConfig
npx.cmd $wr deploy --config $engineConfig --dry-run --outdir (Join-Path $scratch 'engine-build')
if ($LASTEXITCODE) { throw 'Preview Worker 빌드 실패' }
# Dry run의 엔진 진입점과 바인딩을 확인한 뒤 실행
npx.cmd $wr deploy --config $engineConfig
```

### 4. Direct Upload, 호스트 연결 및 격리 확인

```powershell
npx.cmd $wr pages project create $project --production-branch production-unused --compatibility-date 2026-11-17
```

새 프로젝트의 **Settings → Bindings**와 **Variables and Secrets**에서 **Preview**를 선택해 위 표대로 설정합니다. `ENGINE` 이름이 새 전용 Worker이고 `FEEDBACK_DB` UUID가 마이그레이션 대상과 일치하는지 확인합니다. 새 프로젝트의 Production 바인딩은 비워 둡니다. 기존 프로젝트의 설정 화면과 혼동했거나 검증 리소스가 공용 바인딩에 연결된 경우 중단합니다. [Pages Functions 바인딩](https://developers.cloudflare.com/pages/functions/bindings/)

```powershell
node --test
if ($LASTEXITCODE) { throw '자동 테스트 실패' }
node scripts/update-draws.cjs --verify
if ($LASTEXITCODE) { throw '복권 데이터 검증 실패' }
$assets = node scripts/build-pages.cjs
if ($LASTEXITCODE -or !(Test-Path -LiteralPath $assets -PathType Container)) { throw 'Pages 산출물 생성 실패' }
npx.cmd $wr pages functions build functions --compatibility-date 2026-11-17 --outdir (Join-Path $scratch 'pages-functions')
if ($LASTEXITCODE) { throw 'Pages Functions 컴파일 실패' }
npx.cmd $wr pages deploy "$assets" --project-name $project --branch $branch --commit-hash $sha --commit-dirty=false
if ($LASTEXITCODE) { throw 'Preview 업로드 결과를 확인하세요.' }
npx.cmd $wr pages deployment list --project-name $project --environment preview
npx.cmd $wr pages deployment list --project-name $project --environment production
```

배포 상세에서 `preview` 환경, 브랜치, SHA를 확인합니다. 새 프로젝트의 Production 배포 목록은 비어 있어야 합니다. 사용자 지정 호스트를 새 브랜치 별칭에 연결하고 HTTPS 및 Access 보호를 검증합니다. 별칭과 해시 URL에서는 관리자 요청이 Access 정책 또는 Functions의 JWT 검증으로 거부되는지 확인합니다. 기존 운영 프로젝트의 Production 배포 ID, 바인딩 및 호스트가 시작 전과 동일한지도 확인합니다. [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) · [Preview 배포](https://developers.cloudflare.com/pages/configuration/preview-deployments/)

## 실행 검증

아래 요청은 검증 호스트를 사용합니다. 관리자 검사에는 `-L`을 사용하지 않아 인증 리디렉션과 상태 코드를 구분합니다. 브라우저 로그인 토큰과 쿠키를 출력하거나 보고서에 첨부하지 않습니다.

```powershell
$base = "https://$reviewHost"
curl.exe -fsS "$base/api/v1/feedback"
curl.exe -fsS "$base/api/v1/qa?lang=en"
foreach ($path in @('/admin/feedback','/admin/feedback/','/api/v1/admin-feedback')) {
  curl.exe -sS -o NUL -w "%{http_code} $path\n" "$base$path"
}
node scripts/browser-regression.cjs "C:/Program Files/Google/Chrome/Application/chrome.exe" "$base/"
```

- 공개 API가 응답하고 피드백 설정 응답에 사이트 키만 포함되는지 확인합니다. 로그인 세션이 없는 관리자 GET은 Access 로그인 리디렉션이나 `401`·`403`을 반환해야 합니다. 시크릿 브라우저에서 관리자 페이지 로그인, 허용된 계정의 성공, 미허용 계정의 거부, 로그인 후 같은 호스트 API 조회를 확인합니다.
- Chrome에서 한국어·영어·일본어·브라질 포르투갈어로 가상의 질문을 한 건씩 접수합니다. 실제 Turnstile 성공 후 접수 번호를 기록하고 Preview D1에서 해당 ID와 언어를 확인합니다. 만료 또는 재사용 토큰이 거부되고 새 레코드가 생기지 않는지 확인합니다.
- 운영자로 문의를 검색하고 상태, 내부 메모, 비공개 답변을 저장합니다. 가상 이메일·내부 메모와 다른 문구로 공개 Q&A 초안을 만듭니다. 공개 목록·검색·상세에서 비공개를 확인한 뒤 승인하여 노출을 확인합니다. 공개 응답의 필드를 확인하고 게시 취소 후 상세 요청이 `404`가 되는지 확인합니다.
- 테스트 문의에서 이메일 삭제, 비공개 본문·메모 삭제, 전체 삭제를 순서대로 확인합니다. 전체 삭제 후 연결된 Q&A도 사라지는지 확인합니다. 삭제 확인은 테스트 접수 ID와 상태로 기록합니다.
- 320px/390px에서 문의·Q&A·관리자 화면의 넘침과 키보드 포커스를 확인합니다. 기존 번호 생성기에서는 한국 기본 모드와 변경 모드, 다른 게임의 생성과 결과 표시를 확인합니다. 제공된 Chrome 회귀 스크립트는 원격 주소에서 번호 생성 회귀를 수행하므로 문의·Access·Q&A는 위 브라우저 절차로 따로 검증합니다.

접수 번호별 저장 여부는 아래 읽기 전용 쿼리로 확인합니다. 전체 삭제 후 같은 번호로 조회하면 결과가 비어 있어야 합니다.

```powershell
$receipt = [guid]::Parse((Read-Host '검증용 접수 번호')).ToString()
npx.cmd $wr d1 execute $dbName --config $d1Config --remote --command "SELECT id, lang, status FROM feedback WHERE id = '$receipt';"
```

## 운영자가 확정할 사항

- Preview 전용 호스트와 사용할 DNS 영역, 허가된 테스트 운영자 및 IdP, 시험 데이터 정리 책임자.
- 문의와 이메일 각각의 보관 기간 및 기산점.
- 접수 번호를 이용한 요청 채널과 대체 채널, 요청자의 본인 확인 방법, 삭제 처리 기한 및 완료 안내 방법.
- D1 백업과 복원 시 삭제 재적용, Access·Turnstile·애플리케이션 로그 및 외부 회신 메일에서의 개인정보 처리. 검증에는 가상 데이터만 사용하며 운영 보관 기간은 운영자 승인 후 확정합니다. [개인정보 운영 결정 사항](PRIVACY-OPERATIONS-v1.8.0.md)
