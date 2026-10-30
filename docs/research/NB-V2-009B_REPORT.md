# [NB-V2-009B 작업 보고서]

2026-10-30 KST. **완료: 승인된 개인 Notion 일반형 3DB·관계·계산·가상 7행 생성 및 실제 API 검증.** 웹 생성·다른 워크스페이스 복제는 이번 완료 범위에 포함하지 않는다.

## Git 및 파일

- 시작/종료: `main / d02b6c43f7b56f6c575b491325105331b183e2f6`. 과거 보고의 `b34f80b`와 달랐다. 시작 worktree는 깨끗했고 기존 009A 구현은 커밋된 상태였다.
- 종료: 이번 변경은 미커밋. 커밋·push·Vercel 배포 없음.
- 수정: `.gitignore`, `js/planner/plan.mjs`.
- 신규 실행기: `scripts/standard-notion/{plan,store,remote,verify,engine,cli,sample}.mjs`, `README.md`.
- 신규 검사: `scripts/notion-poc/tests/standard-execution.test.mjs`, `standard-fake.mjs`.
- 근거/문서: `docs/research/NB-V2-009B_input/`의 configuration·plan·fixture·target·dry-run JSON, 생성 검토안, 실제 API 결과 JSON, 자동 검사 결과 JSON, 본 보고서, ChatGPT 인계문.
- 비공개 실행 상태/승인: `.notion-standard-state/` (gitignore, manifest 0600). 공개 빌드 제외.

## 기존 계획 모델과 실행기

NB-V2-008B `planVersion:1` 및 사람/프로그램/신청기록 논리 ID를 재사용했다. `includeBothOperationTypes`, `selectionMetrics`는 명시적 선택 옵션이다. 기본형·기존 기본 호출을 유지했다. 임의 비율 DSL을 추가하지 않았다.

실험 입력은 운영 상태를 처음부터 Select로 지정했다. 실제 Status나 Status 그룹을 생성하지 않았다. 입력 항목은 성명·이메일·신청 동기이며, 이메일/동기는 빈 값으로 남겼다. 헤더만으로 사람을 추정하거나 중복 제거하지 않고, 승인된 가상 키 P01/P02로 연결했다.

입력·실행 대상을 해시로 고정하고 기본 DB 3개 → 원격 ID → 양방향 관계 → 계산 의존 순서 → 가상 행 → 원격 재조회 순으로 실행한다. 기존 일반형 계산에 선정 값 Formula와 선정 신청 건수 SUM Rollup을 선택적으로 추가했다. 내부 `count_all`을 API `count`로 변환한다. 선정 값 Formula를 먼저 생성해야 SUM Rollup이 참조할 수 있어 일괄 Rollup 선행 순서 대신 위상 순서를 적용했다. 실행하지 않는 Dry Run 요청 템플릿도 같은 순서/함수명으로 보완했다.

공식 기준은 Notion-Version `2026-03-11`이다. [Database 생성](https://developers.notion.com/reference/create-a-database), [속성 수정](https://developers.notion.com/reference/update-data-source-properties), [공식 SDK Rollup 타입](https://github.com/makenotion/notion-sdk-js/blob/main/src/api-endpoints/common.ts)을 확인했다.

## 승인과 실제 원격 대상

사용자가 비공개 부모 페이지 생성 1건을 먼저 승인했다. 연결 추가 후 CLI 읽기 점검에서 개인 workspace·bot·부모 제목 일치와 하위 DB 0개를 확인했다. 이어 생성 검토안의 3DB·속성 16개·가상 행 7개·식별 문단 7개·최대 쓰기 21회에 대해 별도 명시적 승인을 받았다.

- 개인: `지승엽의 워크스페이스`, workspace `10e1f60f-fdfa-8128-b201-00037feeb155`
- 연결: `EST 개인 테스트`, bot `4081f60f-fdfa-8154-b4cc-002726360706`
- [새 테스트 부모](https://www.notion.so/4091f60ffdfa811188fcfa1ca8fed352): `4091f60f-fdfa-8111-88fc-fa1ca8fed352`
- runId: `nb-v2-009b-standard-001`; planId: `plan-2c9c6df959adeba9`
- planHash: `a25b2f58d230b94997459e4e701a4584daedbb8e36b9455db1b591dad7197440`
- requestHash: `c7be20bc6e5c4f0257986b2b113c1b45d8077df797fd94c339a14ee8bcdac7a9`

| 새 DB | database_id | data_source_id |
|---|---|---|
| 사람 | `a99088e9-4bd3-4f00-9c20-f1b9e3e60b29` | `a1380c53-b235-41c4-9af7-7b7ab8ba5007` |
| 프로그램 | `d33a5505-9ebf-4d64-b200-5dc105ccfb19` | `99942fed-ea80-4b22-b405-5a2dfb643dce` |
| 신청기록 | `ae16116a-6b4f-4ae3-9716-5aa7e8a1a9f3` | `9b34aee8-b9b0-48e1-963c-e37e9d218b0c` |

DB 표시명은 각각 `[TEST] NB-V2-009B 사람`, `[TEST] NB-V2-009B 프로그램`, `[TEST] NB-V2-009B 신청기록`이다. 속성은 사람 4개·프로그램 6개·신청기록 6개, 총 16개다.

## 양방향 관계와 계산

| 순방향 속성 | 원격 ID | 역방향 속성 | 원격 ID |
|---|---|---|---|
| 신청기록.사람 | `CFMX` | 사람.신청기록 | `I%3FjF` |
| 신청기록.프로그램 | `e_TK` | 프로그램.신청기록 | `LHkG` |

양쪽 Data Source의 대상 ID·서로의 synced_property_id·실제 이름·행 연결을 재조회했다. 역관계는 자동 생성된 속성의 ID로 이름만 변경했다. 관계를 중복 추가하지 않았다. 인코딩된 원격 속성 ID는 보존하고 비교할 때만 디코딩한다.

| 계산 속성 | 원격 ID | 검증한 정의와 값 |
|---|---|---|
| 사람.신청 건수 Formula | `q~vn` | `prop("신청기록").length()` → 가상 A 2, B 1 |
| 신청기록.선정 값 Formula | `Bfjb` | `if(prop("선정 상태") == "선정", 1, 0)` → AP01 1, AP02 0, AP03 1 |
| 프로그램.신청 건수 Rollup | `YoLo` | 역관계 → 신청기록 Title / API `count` → 2, 1 |
| 프로그램.선정 신청 건수 Rollup | `jRGN` | 역관계 → 선정 값 Formula / API `sum` → 2, 0 |

선정·운영 유형·운영 상태 Select의 이름/색상/옵션 개수/옵션 ID를 조회해 계획과 일치함을 검사했다. 임의 선택지 생성이나 기존 009A 옵션 변경 없음.

## 가상 행과 실제 결과

P01 가상 A, P02 가상 B, C01 가상 교육, C02 가상 해커톤을 생성했다. AP01=P01→C01 선정, AP02=P01→C02 미선정, AP03=P02→C01 선정이다. 각 행에 실행 식별용 문단 1개를 넣었다. 실제 개인정보는 넣지 않았다.

| 항목 | 예상 | 실제 Notion 재조회 |
|---|---|---|
| 고유 사람 / 신청기록 | 2 / 3 | 2 / 3 |
| 가상 A / B 신청 건수 | 2 / 1 | Formula 2 / 1 |
| 교육 / 해커톤 신청 건수 | 2 / 1 | Rollup 2 / 1 |
| 교육 / 해커톤 선정 건수 | 2 / 0 | Rollup 2 / 0 |
| 교육 / 해커톤 선정률 | 100% / 0% | **Notion 비율 속성 미생성. 원격 건수에서 로컬 산출 100% / 0%** |

최초 실제 검증: 2026-10-30 09:32:42 KST, **79/79 통과**. 전체 원격 ID·기대값·실제값·검사별 결과는 `NB-V2-009B_ACTUAL_RESULT.json`에 기록했다. 79는 API 요청 수가 아니라 검증 항목 수다.

## 쓰기·재실행·부분 실패

- 실제 CLI 쓰기 **18회**: DB POST 3 + 관계 PATCH 2 + 역관계 이름 PATCH 2 + Formula PATCH 2 + Rollup PATCH 2 + 행 POST 7. Data Source 이름은 이미 일치해 이름 PATCH 0회. 오류/불확실 상태 없이 완료했다.
- 별도 승인한 부모 페이지 1건 생성은 플러그인 작업이며 CLI 18회와 구분한다.
- 완료 실행을 쓰기 차단 클라이언트로 다시 실행: GET 46 + 읽기 query POST 3, **추가 쓰기 시도 0**, 원격 재검증 **79/79 통과**. 누적 쓰기 18→18 유지.
- run/parent 잠금, 해시·승인 바인딩, 단계 journal, 0600 atomic manifest로 중복을 방지한다. 시작한 쓰기는 읽기로만 확인하며 POST 응답 ID가 없으면 후보를 기록하고 자동 채택·재전송하지 않는다.
- DB 1개 생성 후 읽기 실패, 관계 PATCH 응답 유실, DB/행 POST 응답 유실, 400·권한 오류, 잘못된 스키마/계산값, 동시 실행 차단을 **모의 API로 검증**했다. 실제 장애를 원격에 유발한 테스트는 하지 않았다. 수동 삭제·롤백 없음.

## 자동 검사와 기존 기능

- Node **239/239 통과**: 기존 223개 + 신규 16개. V1 Mock 256개 조합 통과.
- 신규 검사는 실행 순서/원격 ID/2쌍 역관계/함수 변환/계산 정의/7행 연결/예상 집계/중복 방지/부분 재개/불확실 응답/소유권/권한/비밀 오류문자열 배제 등을 포함한다. 모의 계산은 Notion 호환성 증거로 취급하지 않았다.
- 공개 빌드 **26개 허용 파일** 검사 통과. CLI·테스트·문서·환경변수·manifest는 포함하지 않는다. 토큰 일치 검사에서 변경 파일·빌드·승인/manifest에 Notion 토큰 없음.
- `git diff --check` 통과. 기본형 실행기, Notion PoC, Supabase Auth·저장·매핑·색상·복원·V1 회귀 검사 통과. 기본형/PoC 실행기 파일은 변경하지 않았다.
- 실제 브라우저/UI·Supabase 로그인·저장 동선을 이번에 새로 수동 검증하지 않았다. 해당 보존 근거는 자동 회귀 검사 및 변경 범위다.
- 기존 002A/009A 원격 DB 쓰기 없음. 회사 공간 접근·복제 없음. Supabase DB/Auth/RLS/저장 JSON 스키마, Vercel 설정/배포 변경 없음. AI API 사용 없음.

## 미검증과 다음 작업

- 미검증: 다른 워크스페이스 복제, 복제 후 관계·수식 유지, 진정한 Status/그룹, 원격 선정률 Formula, 큰 데이터/페이지네이션 실환경, 실제 장애 후 재개, 웹 생성/OAuth/관리자 기능.
- REST만으로 모든 공유 권한을 증명하지 않는다. 비공개는 생성 방식과 사용자 확인에 근거한다. 연결의 이번 생성·수정 권한은 실제 작업으로 확인했다.
- 다음 순서: 분리된 테스트 B 확보 → 제한된 복제 검증 → 실제 사람 식별·중복 정책 확정 → 서버 비밀 관리/사용자별 권한/실행 승인·manifest 재개 설계를 포함한 웹 생성 → 이력·관리자 기능 검토. 회사 공간에 바로 적용하지 않는다.
