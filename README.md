# world_lottery

## v1.4 로컬 테스트

```sh
node --test
node scripts/update-draws.cjs --verify
node scripts/browser-regression.cjs "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

브라우저 테스트는 Chrome과 임시 로컬 HTTP 서버를 사용합니다. 사이트를 직접 열 때도 HTTP로 제공해야 당첨 데이터 JSON을 읽을 수 있습니다. Cloudflare Pages는 `data/`를 포함한 정적 파일을 그대로 제공합니다.

## 공식 당첨 데이터

| 게임 | 공식 출처와 확보 현황 |
| --- | --- |
| 한국 로또 6/45 | [동행복권 당첨 결과](https://www.dhlottery.co.kr/lt645/winNumber). 사용자 제공 공식 CSV에서 최근 5년 구간을 추출. 해당 CSV의 재배포 라이선스는 미확인. |
| 미국 Powerball | [New York State Gaming Commission](https://data.ny.gov/d/d6yy-54nr). 정규 추첨 확보. Double Play는 별도 게임으로 제외. |
| 미국 Mega Millions | [New York State Gaming Commission](https://data.ny.gov/d/5xaw-6ayf). 정규 추첨 확보. [2025년 4월 8일 규칙 변경](https://www.megamillions.com/News/2025/New-Mega-Millions%C2%AE-arrives-in-April.aspx)을 기준으로 Mega Ball 25개 시기와 24개 시기를 분리. |
| UK Lotto | [The National Lottery 결과](https://www.national-lottery.co.uk/results/lotto/draw-history). 5년 이력 및 [2026년 두 라운드 전환](https://www.allwyn.co.uk/insights/double-your-luck-delivers-new-lotto-creates-three-millionaires-in-first-weekend-and-over-3-1-million-winners-in-opening-draws) 전후의 추첨 단위와 재사용 조건 확인 필요. |
| EuroMillions | [FDJ ZIP 아카이브](https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/historique). 다운로드 제공을 확인했으며 보호되는 데이터베이스의 사용 범위는 추가 확인 필요. [FDJ 고지](https://www.fdj.fr/informations/reglements/app-webview) |
| EuroJackpot | [LOTTO.de 아카이브](https://www.lotto.de/eurojackpot/zahlen). 날짜별 이력 제공을 확인했으며 일괄 수집 및 재사용 조건 확인 필요. [2022년 3월 25일 2/10 → 2/12](https://www.lotto.de/eurojackpot/produktaenderung-2022) |
| 일본 LOTO 6 | [미즈호은행 과거 결과](https://www.mizuhobank.co.jp/takarakuji/check/loto/backnumber/index.html). HTML 표 이력 제공을 확인했으며 재사용과 자동 수집 조건 확인 필요. |
| 일본 LOTO 7 | [미즈호은행 과거 결과](https://www.mizuhobank.co.jp/takarakuji/check/loto/backnumber/index.html). HTML 표 이력 제공을 확인했으며 재사용과 자동 수집 조건 확인 필요. |
| 캐나다 Lotto 6/49 | [WCLC 이력](https://www.wclc.com/display-on/display-on-downloads/lotto-649-since-inception.htm). [WCLC 게시 정보 재배포 조건](https://www.wclc.com/mobile/content/wclc/legal.htm) 확인에 따라 미수록. |
| 호주 Oz Lotto | [The Lott 결과](https://www.thelott.com/oz-lotto/results). [공개 안내는 최근 10회](https://help.thelott.com/hc/en-us/articles/115002824553-How-can-I-find-historical-results). 장기 수집 및 재사용 확인 필요. |
| 호주 Powerball | [The Lott 결과](https://www.thelott.com/powerball/results). [공개 안내는 최근 10회](https://help.thelott.com/hc/en-us/articles/115002824553-How-can-I-find-historical-results). 장기 수집 및 재사용 확인 필요. |
| 브라질 Mega-Sena | [CAIXA 결과 다운로드](https://loterias.caixa.gov.br/Paginas/mega-sena.aspx). 공식 내보내기를 확인했으며 재배포와 자동 수집 조건 확인 필요. |
| 싱가포르 TOTO | [Singapore Pools 결과](https://www.singaporepools.com.sg/en/product/sr/Pages/toto_results.aspx). 공식 회차별 결과를 확인했으며 5년 일괄 이력과 재사용 조건 확인 필요. |
| 남아공 PowerBall | [Sizekhaya](https://sizekhaya.co.za/). 운영사 전환 전후 자료를 연결할 공식 이력과 현재 운영사 규정 확인 필요. |

뉴욕주 데이터는 카탈로그의 개별 라이선스가 미지정이며, [OPEN-NY 이용 조건 및 API 사용 안내](https://ny.github.io/open-data-handbook/publicuse.html)를 근거로 출처를 표시하고 추첨일과 번호 필드만 정규화합니다. 당첨 결과에 차이가 있으면 뉴욕 복권 추첨 부서의 인증 기록이 우선합니다.

```sh
node scripts/update-draws.cjs --download 2026-11-19
node scripts/update-draws.cjs --verify
```

Node.js와 curl을 사용합니다. 날짜는 뉴욕 추첨일 기준으로 원본 API에 결과가 올라온 범위 내에서 선택합니다. 수록본은 2026년 11월 21일에 확보했으며, 두 게임의 공개 데이터로 검증 가능한 공통 마감일인 2026년 11월 19일까지 5년을 조회했습니다. 갱신 시 각 게임의 추첨 요일과 번호 범위를 검증합니다. 하나라도 예정 회차가 빠졌으면 갱신이 중단됩니다. 분석 기간 표시는 실제 첫 회차와 마지막 회차 기준입니다.

GitHub Actions에서는 수동 실행 또는 cron으로 다운로드와 오프라인 검증을 수행할 수 있습니다. API 게시 지연을 감안한 마감일로 조회하고, 검증한 JSON을 검토용 아티팩트나 PR로 제공하는 방식이 가능합니다. 현재 워크플로는 등록되어 있지 않습니다. [GitHub Actions 트리거 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

## 확률 계산

1등 기준 구매 조합 수는 본번호 조합 수에 독립 추가 번호 조합 수를 곱한 값입니다. 같은 풀에서 추첨하는 보너스는 1등 판정에 포함되지 않습니다. 같은 회차에 서로 다른 N개 구매 조합의 1등 확률은 일반적으로 `N / 전체 구매 조합 수`입니다. 생성 묶음에서 본번호가 같고 시뮬레이션 보너스만 다른 경우 한 구매 조합으로 계산합니다.

UK Lotto는 두 라운드 중 최소 한 번 맞힐 확률로 계산합니다. 캐나다 Lotto 6/49는 Classic Draw의 6/6을 계산하며, 별도 Gold Ball Draw는 발행 번호 수에 따라 달라집니다. 남아공 PowerBall은 [Capitec 판매 약관](https://www.capitecbank.co.za/globalassets/pages/home/personal/lotto/lotto-terms-and-conditions-.pdf)의 5/50 + 1/16에 근거한 계산값입니다.

## v1.4.1 한국 로또 6/45

```sh
node scripts/update-draws.cjs --verify
node --test
```

가져오기 스크립트는 전체 CSV의 숫자, 날짜, 회차 연속성을 검사합니다. 한국 날짜로 계산한 5년 창에서 회차, 추첨일, 본번호, 보너스만 JSON에 저장합니다. 토요일 21시 전에는 직전 날짜까지의 데이터를 분석합니다. 원본 CSV와 상금·판매액 필드는 저장소 데이터에 포함되지 않습니다. 2026-11-21 갱신본의 조회 마감일은 2026-11-20이며, 실제 분석 범위는 991~1250회(2021-11-27~2026-11-14)입니다. 동행복권 사이트 약관(2025-07-29 시행)의 지식재산권 관련 조항을 확인했으며, 당첨번호 CSV에 적용되는 별도 공개 재배포 라이선스는 확인되지 않았습니다. [동행복권 사이트 이용약관](https://m.dhlottery.co.kr/trms/home)

