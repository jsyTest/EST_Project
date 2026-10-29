# NB-V2-002 Notion 생성 PoC 실행 안내

기준일: 2026-10-29 / API: `2026-03-11` / 실제 Notion 연동: **개인 Free 핵심 생성·계산 검증 통과, 전체 부분 완료**

최신 결과는 [NB-V2-002A 보고서](NB-V2-002A_REPORT.md)와 [ChatGPT 인계문](NB-V2-002A_CHATGPT_HANDOFF.md)에 기록했다. 승인된 개인 테스트 부모 아래 교육 페이지 1개·DB 6개·행 16개·도넛 1개·표 보기 3개를 생성하고 API로 재조회했다. 출석률 75%→100%와 수료율 50%를 확인했다. Dashboard·추가 차트·실제 UI는 미검증이다. 기존 NB-V2-002 보고서는 당시 이력으로 보존한다.

기존 V1 화면은 그대로 사용한다. 이 PoC는 브라우저와 분리된 로컬 Node.js 실행기다. Node.js 22 이상이 필요하며, 이번 작업에서는 v24.22.1을 사용했다. 외부 npm 패키지·SDK 설치 없이 Node 내장 `fetch`, 파일 시스템, 테스트 러너를 사용한다. Notion 공식 SDK 예제의 REST 요청 구조를 참고했으며 버전 헤더를 직접 고정한다.

NB-V2-002A에서 사용자가 **개인 Notion Free 테스트 페이지**를 선택했다. 해당 환경은 [개인 Free 설정 안내](NB-V2-002A_SETUP.md)를 먼저 따른다. `preflight`는 지정 부모만 읽고, `--view-profile free`는 차트 1개와 표 3개만 요청하며 Dashboard·나머지 차트는 미검증으로 남긴다. 실제 생성은 대상 확인 후 별도 승인을 받는다.

## 1. 네트워크 호출 없이 확인

프로젝트 폴더에서 실행한다.

```sh
cd /Users/jsy/Desktop/EST_Project
node scripts/notion-poc/cli.mjs dry-run
node --test scripts/notion-poc/tests/*.test.mjs
```

명령 없이 실행해도 `dry-run`이다. Dry Run은 대상 페이지 설정 여부, 생성 스키마·관계·계산, 데이터 개수, 기대 KPI, 보기 개수를 출력한다. 네트워크 호출과 실행 상태 파일 생성을 하지 않는다. 토큰을 출력하지 않는다.

## 2. 실제 테스트를 위한 사용자 준비

1. 기존 교육 자료와 분리된 테스트 상위 페이지를 직접 정한다. 자동 탐색 기능은 없다.
2. 테스트 연결에 필요한 read/insert/update 권한을 부여하고 그 상위 페이지 접근을 허용한다. 실제 회사 자료 전체에 접근하도록 설정할 필요는 없다.
3. 테스트 계정의 Notion 요금제를 확인한다. Dashboard View는 공식 안내상 Business/Enterprise다. Free는 차트 개수 제한이 있다.
4. `.env.example`을 `.env`로 복사하고 **로컬 편집기에서만** 아래 두 값을 입력한다.

```sh
cp .env.example .env
```

- `NOTION_API_TOKEN`: 테스트 연결 토큰. 채팅에 붙여넣지 않는다.
- `NOTION_TEST_PARENT_PAGE_ID`: 명시적으로 승인한 테스트 상위 페이지 UUID. 하이픈 없는 32자리 ID도 허용한다. URL 자체를 넣으면 중단한다.

`.env`, `.env.*`와 `.notion-poc-state/`는 Git에서 제외한다. `.env.example`에는 빈 변수 선언만 있다. 토큰은 브라우저·소스·실행 기록에 저장하지 않는다. `.env`를 정적 호스팅에 업로드하지 않는다.

## 3. 실제 생성 실행

환경을 준비하고 Dry Run을 확인한 뒤, 아래 `<승인한-테스트-페이지-UUID>`를 실제 UUID로 바꾼다.

```sh
node --env-file=.env scripts/notion-poc/cli.mjs dry-run
node --env-file=.env scripts/notion-poc/cli.mjs apply --run-id nb-v2-002 --confirm-parent <승인한-테스트-페이지-UUID>
```

`apply`와 환경변수에 일치하는 `--confirm-parent`가 모두 있어야 생성한다. 위 명령은 실제 Notion에 다음 객체를 추가하고, 이 실행이 만든 출석 행 하나만 변경한다.

- 테스트 교육 페이지 1개.
- 운영 DB 5개: 신청자·과정·과정별 신청기록·수강·출석기록.
- 전체 집계용 교육 KPI DB 1개.
- 가상 운영 행 15개 + 교육 KPI 행 1개.
- 양방향 관계 6개, KPI용 단방향 관계 4개.
- 롤업·수식 및 기대값 확인.
- 숫자 차트 4개, 모집 차트 2개, 과정별 차트 1개, 표 3개, Dashboard 1개 생성 시도.
- AT04 결석 → 출석 변경 후 출석률 75% → 100% 확인.

최종 출석 데이터는 변경된 **100% 상태**로 남는다. 자동 복원·삭제·롤백 기능은 없다. 다른 기존 페이지·DB를 수정하거나 삭제하지 않는다.

초기 KPI가 틀리면 출석 변경과 보기 생성 전에 중단한다. 차트·Dashboard 요청이 명시적으로 400/403/404로 거절되면 실패 단계를 기록하고 가능한 나머지를 보존한다. 이를 자동으로 '요금제 미지원'이라고 단정하지 않는다. 잘못된 요청이나 권한 문제일 수도 있다. Dashboard가 거절되면 각 DB에 독립 보기를 시도한다. API 응답 유실·쓰기 5xx 등 성공 여부가 불확실한 오류는 전체 실행을 중단한다.

## 4. 상태·결과 확인

```sh
node scripts/notion-poc/cli.mjs inspect --run-id nb-v2-002
node --env-file=.env scripts/notion-poc/cli.mjs verify --run-id nb-v2-002
```

- 상태 파일: `.notion-poc-state/nb-v2-002.json`.
- 담는 정보: 생성 단계·상태·ID·응답 URL·기대값·실제값·검사 결과.
- `inspect`: 로컬 기록만 읽는다. Notion 현재 상태를 다시 확인한 것은 아니다.
- `verify`: 같은 테스트 상위 페이지 설정을 확인하고, 저장된 생성 데이터 소스만 재조회해 관계와 KPI를 검증한다. Notion 콘텐츠는 변경하지 않는다. 최신 조회 결과는 로컬 기록에 저장한다.
- 종료 코드: 0 정상, 1 오류·안전 중단, 2 Free의 계획된 생략·일부 보기 실패 또는 재검증 불일치. 따라서 Free 생성의 종료 코드 2만으로 API 실패를 뜻하지 않는다.
- `complete`: API 경로의 구성·계산·재계산 검증이 통과했다는 뜻이며 화면을 직접 확인했다는 뜻은 아니다. `visualInspection`은 `not_performed`다.
- 모의 테스트 통과와 실제 API 검증을 구분한다. 이번 실제 실행은 `nb-v2-002a`, 상태는 `partial`이며 초기·변경 후·최종 읽기 전용 재검증 모두 통과했다.

같은 run-id의 완료/부분 완료 기록이 있으면 API를 다시 호출하지 않고 기존 결과를 반환한다. 최신 상태는 `verify`로 확인한다. 실패·실행 중·불확실 기록이 있으면 재생성을 거부한다. run-id를 바꾸면 새 교육을 만들 수 있으므로 **실패를 우회하려고 run-id를 바꾸지 않는다.**

잠금이 남거나 실행 기록을 해석하기 어려우면 상태를 보존하고 먼저 조사한다. 상태 파일 삭제, 새 ID 발급, 자동 재시작을 복구 방식으로 사용하지 않는다. 여러 컴퓨터 사이의 중복 실행은 이 로컬 잠금으로 방지되지 않는다.

이번 실행의 고유 인원 집계 수식 두 개는 실제 API에서 `400 validation_error / Type error with formula`로 거절됐다. 신청자별 숫자 보조 수식·롤업 합산으로 수정했다. 기존 생성 페이지와 DB를 보존하고, 알려진 코드 지문·명시적 400 실패·빈 DB·부모/관계 일치·응답 유실 없음이 확인된 경우만 `repair-schema`로 이어갈 수 있다. 일반 실패 재시작 기능은 아니다. 데이터나 보기가 이미 있거나 상태가 불확실하면 거부한다.

```sh
# 이번 NB-V2-002A의 알려진 초기 스키마 오류 전용. 현재 완료 기록에는 재생성하지 않는다.
node --env-file=.env scripts/notion-poc/cli.mjs repair-schema --run-id nb-v2-002a --view-profile free --confirm-parent <승인한-테스트-페이지-UUID>
node --env-file=.env scripts/notion-poc/cli.mjs verify --run-id nb-v2-002a --view-profile free
```

## 5. 데이터와 임시 KPI 정책

- 신청자: A01, A02, A03.
- 과정: C01 Basic, C02 Associate.
- 신청: AP01 A01/C01 선정, AP02 A01/C02 미선정, AP03 A02/C01 선정, AP04 A03/C02 취소.
- 수강: E01=AP01, E02=AP03. E01 수료, E02 미수료.
- 출석: E01은 출석 2건, E02는 출석 1건·결석 1건.
- 예정된 출석 4건을 미리 생성하고 분모로 사용한다. 범용 회차·시간·중도 참여 모델은 이번 범위가 아니다.

| 지표 | 초기 기대값 | AT04 변경 후 |
| --- | ---: | ---: |
| 고유 신청자 | 3 | 3 |
| 신청기록 | 4 | 4 |
| 선정 고유 인원 | 2 | 2 |
| 수강기록 | 2 | 2 |
| 수료기록 | 1 | 1 |
| 수료 고유 인원 | 1 | 1 |
| 수강기록 기준 수료율 | 50 | 50 |
| 인정 출석 / 예정 | 3 / 4 | 4 / 4 |
| 전체 출석률 | 75 | 100 |
| E01 출석률 | 100 | 100 |
| E02 출석률 | 50 | 100 |
| C01 / C02 수강인원 | 2 / 0 | 2 / 0 |

비율은 0~100 숫자로 저장한다. 모집·수료 집계의 사람 수와 기록 수를 별도 속성으로 둔다. 수강의 신청자·과정 관계는 신청기록 관계와 함께 보관하고 fixture 검증에서 일치시킨다. 이는 고유 인원 집계와 과정별 보기를 단순화하기 위한 PoC 선택이며, 향후 입력 기능에도 같은 일관성 검사가 필요하다.

선정 인원은 신청기록의 `선정 값`(1/0)을 신청자별로 합산한 뒤 `선정 인원 값`(1/0)을 전체 합산한다. 수료인원도 신청자별 `수료 수강 건수`를 1/0으로 바꿔 전체 합산한다. 같은 사람이 여러 과정에 참여해도 사람 수를 중복 합산하지 않는 구조다. 현재 실환경 검증은 위 고정 fixture이며, 동일인의 복수 수료 등 확장 사례는 별도 실제 검증이 필요하다.

## 6. 구조와 검증 한계

| 파일 | 역할 |
| --- | --- |
| scripts/notion-poc/config.mjs | 고정 API 버전·환경변수·ID 검사 |
| scripts/notion-poc/fixture.mjs | 익명 데이터·선정 관계 검증·JS 기대 KPI |
| scripts/notion-poc/schema.mjs | 스키마·관계·계산 의존 순서·보기 요청 |
| scripts/notion-poc/client.mjs | REST 호출·타임아웃·제한 처리·조회 페이지네이션 |
| scripts/notion-poc/state.mjs | 실행 잠금·원자적 상태 저장 |
| scripts/notion-poc/engine.mjs | 생성·역방향 속성 이름 확인·데이터 입력·검증·보기 |
| scripts/notion-poc/verify.mjs | 실제 응답의 행·관계·KPI 비교와 제한된 재조회 |
| scripts/notion-poc/cli.mjs | Dry Run·실행·상태·재검증 명령 |
| scripts/notion-poc/preflight.mjs | 지정한 부모 페이지의 이름·ID·읽기 접근만 확인 |
| scripts/notion-poc/schema-repair.mjs | 알려진 초기 400 스키마 오류만 기존 빈 DB에서 이어가기 전 검증 |
| scripts/notion-poc/tests/ | 모의 API·오류 경로·V1 회귀 검사 |

API 생성 순서: 부모 확인 → 새 페이지 → 6 DB와 초기 데이터 소스 → 관계형(자동 생성 역방향 ID를 조회해 이름 변경) → 의존 순서대로 롤업·수식 → 스키마 재조회 → 16행 → 초기 계산 확인 → 생성한 AT04 변경 → 재계산 확인 → 보기·Dashboard 재조회.

현재 검증은 고정된 작은 fixture 전용이다. 큰 관계 목록이 응답에서 잘리면 성공 처리하지 않는다. 조회 결과의 모든 페이지를 읽지만, 대규모 관계 속성별 페이지네이션과 복구는 후속 범위다. Notion 수식 응답이 서버에서 다른 표현으로 정규화되면 수식 문자열의 엄격한 재조회 검사가 중단될 수 있다. 이 경우 실제 응답을 보고 호환성을 보완해야 한다.

모의 API는 전송·생성 순서·실패 처리를 시험하기 위한 테스트 대역이며, **Notion 수식 엔진이나 실제 API의 대체 검증이 아니다.** 이번 개인 Free 환경에서는 실제 읽기·삽입·수정과 수식·KPI·도넛/표 구성 재조회를 통과했다. Business 기능·다른 요금제의 오류·차트 화면 표시는 미검증이다.

NB-V2-002A에서는 두 번째 DB를 만들기 전에 첫 DB의 데이터 소스와 초기 스키마를 확인하도록 보완했다. 별도 사용자 일시정지·실패 자동 재개를 추가한 것은 아니다. 별도 생성하는 표 3개는 신청자·과정별 신청기록·수강이다. 과정·출석 DB의 기본 표 보기는 그대로 존재한다. Free용 보기가 성공해도 전체 상태는 partial이며, 미실행 Dashboard와 숫자 차트를 성공으로 기록하지 않는다. run-id 지문에는 보기 프로필도 포함하므로, 같은 실행을 full/free로 바꿔 중복 생성하지 않는다.

로그에는 응답 본문과 토큰을 남기지 않는다. 오류는 HTTP 상태와 오류 코드만 기록한다. 진단을 위해 토큰·전체 응답을 채팅에 출력하지 않는다. 추가 설명이 필요하면 테스트 계정에서 비밀값을 제거한 오류 정보를 별도로 확인한다.

## 7. 공식 문서

API 버전과 DB/데이터 소스 구분은 [버전 안내](https://developers.notion.com/reference/versioning), [DB 생성](https://developers.notion.com/reference/create-database)을 기준으로 했다.

관계형·롤업·수식 요청은 [속성 스키마](https://developers.notion.com/reference/property-object)와 [속성 변경](https://developers.notion.com/reference/update-data-source-properties)을 참고했다.

뷰·차트·숫자·Dashboard는 [뷰 생성](https://developers.notion.com/reference/create-view), [뷰 설정](https://developers.notion.com/guides/data-apis/working-with-views)을 참고했다. 전체 Dashboard rows 직접 쓰기와 표 하단 계산 설정은 구현하지 않는다.

제한·토큰 관리·요금제는 [요청 제한](https://developers.notion.com/reference/request-limits), [토큰 보안](https://developers.notion.com/guides/get-started/handling-api-keys), [Dashboard 제공 범위](https://www.notion.com/help/dashboards), [차트 제공 범위](https://www.notion.com/help/charts)를 참고했다.
