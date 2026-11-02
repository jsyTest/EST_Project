# NB-V2-011 — PPLUS Notion 자동 생성 웹 연동 아키텍처

2026-11-02 조사. **설계 문서이며 웹 실행 기능 구현/배포/생성 완료 보고가 아니다.** 기준 Git: main / b01fdb2f6f8e53e09fcff949b8cd135f9ed1d826. 기존 NB-V2-011A~E는 보존하며 이 문서는 그 위에 현재 요구사항을 보완한다.

## 1. 주요 결정과 근거

| 결정 | 이유/코드 근거 | 공식 근거 |
| --- | --- | --- |
| 정적 웹+기존 Node API 유지 | api/drafts/review.mjs:1의 기존 Web Request/Response 진입점 재사용. 전체 프레임워크 전환 불필요 | [Vercel Node Runtime](https://vercel.com/docs/functions/runtimes/node-js) |
| 기존 review 계약 보존, 별도 변환 API 추가 | server/review-plan.mjs:45는 요약만 반환하며 원본/템플릿 비노출이 기존 테스트 계약 | [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) |
| NB-012는 쓰기 없는 컴파일·미지원 표시 | js/planner/plan.mjs:42의 planVersion 1을 유지하고 별도 executionPlanVersion으로 구분 | [Database/Data Source 구조](https://developers.notion.com/guides/data-apis/working-with-databases) |
| NB-013/014는 본인 1계정 개인 테스트 연결 A | 기본형/일반형 CLI의 개인 공간 제약을 웹 공용 권한으로 확대하지 않음 | [Notion capabilities](https://developers.notion.com/reference/capabilities) |
| 다중 사용자 공개 전에는 OAuth B 필요 | PPLUS 로그인과 Notion 승인 계정/워크스페이스는 별개의 소유 관계 | [Notion OAuth](https://developers.notion.com/guides/get-started/authorization) |
| 기존 CLI 안전장치 보존, 서버 어댑터 분리 | basic/standard engine의 전용 Store instanceof·파일 잠금·고정 task/부모 규칙은 서버와 직접 호환되지 않음 | [Vercel Functions](https://vercel.com/docs/functions/runtimes/node-js) |
| 생성 전 영구 실행 기록·원자적 승인 소비 필수 | 응답 유실·프로세스 중단 후 같은 POST 재전송 금지 원칙 유지 | [Notion 요청/재시도](https://developers.notion.com/reference/request-limits) |
| 모집 모델과 교육 운영 모델 분리 | catalog의 people/programs/applications와 V1 students/attendance/schedule은 다른 모델 | PROJECT_SPEC.md 9.4~9.5 및 아래 5절 |

## 2. 현재 구현 조사

### 저장·인증

- PROJECT_SPEC.md 1~8절은 오래된 V1 Mock 기준, 9절은 후속 기획 메모다. 그 안의 AI/로그인 없음/서버 없음 문구를 현재 구현으로 해석하지 않는다. 이번 사용자 요구와 최신 코드가 현재 조사 기준이다.
- js/auth-core.js는 브라우저 세션·로그인 이벤트를 관리한다. 브라우저 표시/세션의 존재는 서버 실행 권한 증거로 사용하지 않는다.
- js/supabase-client.js는 CDN의 window.supabase와 분리한 supabaseClient, 공개 Publishable Key를 사용한다. Publishable Key는 비밀이 아니고 사용자 소유권을 대신하지 않는다. 기존 Auth 설정은 수정하지 않는다.
- js/drafts/model.mjs:108은 configuration.version=1, schema_version=1, 최대 524288바이트 정규화. requirements(교육명/목적/기본·추가 선택), mapping(폼 질문/헤더/속성/옵션·색상), planner(유형/모듈/추천 조건)만 저장한다. 실제 CSV 행·Notion 토큰·실행 기록은 넣지 않는다.
- js/drafts/repository.mjs는 사용자별 JWT를 요청에 고정하고 user_id·updated_at 조건으로 조회/수정한다.
- Supabase pxkjxcryceqtjomgxyfe의 public 스키마를 list_tables(verbose)로 읽기 조회했다. education_drafts 1개, id/user_id UUID·title text·configuration JSONB·schema_version integer·created_at/updated_at timestamptz·RLS 활성·user_id→auth.users.id FK를 확인했다. 행 내용은 읽지 않았다.
- database/education-drafts.sql에는 소유자 SELECT/INSERT/UPDATE 정책, UPDATE USING/WITH CHECK, user_id 기본값 auth.uid(), 소유권·ID 변경 방지, 제한된 컬럼 GRANT가 있다. 이번에 실제 원격 정책/GRANT 전체를 재조회한 것은 아니다. 신규 테이블/SQL 적용은 없다.

### 논리 계획(planVersion 1)

js/planner/plan.mjs의 생성기는 configuration과 settings를 별도 인자로 받는다. 반드시 createGenerationPlan(normalized, normalized.planner)로 호출한다.

- 식별/상태: planVersion, planId, notionApiVersion, templateType, educationType, requestedModules/enabledModules.
- 구조: databases, dataSources, properties, selectOptions/statusOptions, relations, rollups, formulas.
- 검증: blockingErrors, confirmationItems, warnings, dryRunValid, summary.
- 순서: executionPhases, dependsOn, 계산 의존성 위상 순서, unresolvedBindings.
- 요청 예시: requestTemplates는 전부 executable=false인 논리 참조 템플릿이다. API 요청으로 그대로 재생하면 안 된다.
- 안전 상태: mode=dry-run, notionWrites/networkRequests=0, futureExecutorReady=false, dataResolution.rowsIncluded=false. 자동 표시(automatic)는 계획 분류이며 실제 웹 생성 성공을 뜻하지 않는다.
- planId는 FNV 계열 64비트 논리 ID이며 승인용 해시가 아니다. server/review-plan.mjs가 canonical JSON의 SHA-256 planHash를 따로 만든다. 이 역시 승인 토큰이 아니다.
- 수식 AST 허용 연산은 relation_count/equals_option뿐이다. 임의 Formula·사용자 정의 KPI 편집은 현재 구현되지 않았다.
- 저장 planner는 templateType/enabledModules와 추천 조건4개만 허용한다. PoC samplePlan의 databaseNames/includeBothOperationTypes/selectionMetrics는 별도 호출 옵션이며 현재 사용자 저장 설정이 아니다. 사용자별 DB 이름/KPI 설정이 이미 저장된다고 가정하지 않는다.

### 서버 review의 현재 입력·출력

POST /api/drafts/review: JSON 최대 2048바이트. draftId 필수, expectedUpdatedAt/expectedPlanHash 선택. user_id/configuration/Notion 토큰 등 추가 필드는 거절한다. server/drafts-review.mjs:42→supabase-readonly.mjs가 요청별 Bearer로 Auth /user 확인 후 같은 JWT+기존 RLS로 본인 저장본만 읽는다. 타인/없는 설계는 같은 404다.

응답은 reviewVersion/mode/reviewStatus, draftId/updatedAt, 저장·계획 버전, templateType/모듈, counts, planValidation, cliSupport, planId/planHash다. 전체 configuration/원본 폼/CSV 응답/요청 템플릿은 반환하지 않는다. 구조 오류 422, 저장본 불일치 409, 정상/확인 필요/미지원 요약 200. 모든 경로에서 webExecutionReady=false, notionExecution=not_executed, notionRequests=0, supabaseWrites=0. private/no-store 유지.

updated_at은 PostgreSQL 마이크로초를 보존하여 비교한다. **교육명/목적처럼 논리 계획에 반영되지 않는 수정은 planHash가 같을 수 있으므로 updatedAt 검사를 생략하면 안 된다.** 결과에는 이 둘을 함께 표시한다. 근거: server/review-plan.mjs:11/84, docs/server/NB-V2-011B_API.md.

### CLI 재사용 범위와 차단 요소

| 코드 | 재사용할 내용 | 그대로 웹 실행할 수 없는 이유 |
| --- | --- | --- |
| basic-notion/plan.mjs:17 | 허용 유형 검증, 선택 옵션·색상 변환, canonical/digest, 동결 spec | 실제 대상 검사는 task 009A·개인 workspace·부모 제목·보호 ID에 고정 |
| basic-notion/engine.mjs:61 | 승인 결합, 쓰기 전 기록, 생성 ID 즉시 저장, 재조회, 불확실 POST 중단 | 전용 파일 Store 요구, 기존 부모 아래 DB만 생성하며 교육별 새 상위 페이지 생성은 미포함 |
| standard-notion/plan.mjs:17 | 3DB 논리 참조/관계/계산 순서, count_all→count 변환 | 가상 사람2·프로그램2·신청3행, 고정 필드 바인딩 필수. 임의 저장 설계용 빈 3DB 실행기가 아님 |
| standard-notion/remote.mjs·verify.mjs | 역관계 실제 ID, 속성 바인딩·옵션/계산 readback 원리 | 검증의 가상 식별자·행 수·선정 값·원격 소유 marker가 고정 |
| notion-poc/client.mjs | API 버전 헤더, 경로 제한, 비밀 제외 오류, 읽기 query와 쓰기 구분 | 인스턴스별 350ms 대기는 웹 동시 실행 전체 제한이 아님. 최신 오류 안전 필드 추가 해석 필요 |
| notion-poc/schema/engine/fixture | 교육 KPI·관계·View 실험 자료 | 고정 6DB/16행, AT04 변경까지 수행. 사용자 계획 실행기로 호출하면 안 됨 |
| 각 store.mjs | 원자적 저장·잠금의 설계 원칙 | Vercel 임시 파일/프로세스 잠금은 여러 인스턴스의 영구 기록·동시성 제어를 대체 못함 |

기본형은 Title/Rich text/Email/Phone/Number/Date/Checkbox/Select/Multi-select의 제한된 빈 1DB만 컴파일한다. Status·URL·관계/계산·모듈·미확인 항목은 거절한다. 일반형은 모듈 없는 3DB와 가상 7행용이다. 확장형은 논리 Dry Run이며 현재 웹/CLI 일반 실행은 미지원이다.

## 3. 공식 API와 최신 구조 비교

조회일 2026-11-02. 아래의 공식 지원과 PPLUS 구현/원격 검증 상태는 다르다.

| 항목 | 공식 구조·검토 결론 | PPLUS에 대한 판단 |
| --- | --- | --- |
| API 버전 | 2026-03-11: after→position, archived→in_trash, transcription→meeting_notes. [업그레이드 안내](https://developers.notion.com/guides/get-started/upgrade-guide-2026-03-11) | catalog/config 헤더 일치. 현재 쓰기에 archived/after를 보내는 경로는 찾지 못함. archived를 읽는 호환 가드는 in_trash도 검사하므로 제거할 필요 없음 |
| Database/Data Source | DB는 컨테이너, DS는 스키마와 행의 기준. POST /v1/databases의 initial_data_source로 초기 DS를 함께 생성. 추가 DS는 POST /v1/data_sources. [구조](https://developers.notion.com/guides/data-apis/working-with-databases), [DB 생성](https://developers.notion.com/reference/create-database), [DS 생성](https://developers.notion.com/reference/create-a-data-source) | 기존 초기 DS 방식 유지. DB UUID를 relation의 DS UUID 자리에 넣지 않음. 첫 DB 생성 후 같은 초기 DS를 중복 생성하지 않음 |
| Page | 교육 페이지는 승인 부모 page_id 아래 제목/블록으로 생성, 데이터 행은 data_source_id 아래 스키마에 맞는 값으로 생성. [페이지 내용](https://developers.notion.com/guides/data-apis/working-with-page-content), [공식 생성 참조](https://developers.notion.com/reference/post-page) | PoC에 패턴 존재. 웹 첫 실행은 교육 하위 페이지 1개+빈 DB만, 교육생 행 삽입 없음 |
| Relation/Rollup/Formula | DS 스키마 PATCH, 관계 DS 공유 필요, relation→참조 속성→계산 순서 및 반환 ID 검증. Formula는 정의를 쓰며 계산 결과 값을 임의로 쓰는 기능이 아님. [속성](https://developers.notion.com/reference/property-object), [스키마 갱신](https://developers.notion.com/reference/update-data-source-properties) | 기존 관계·AST/허용 계산 원리 재사용. 이름만으로 역관계 추측 금지. 교육 운영 수식/자유 KPI는 새 검증 필요 |
| Select/Multi-select | 옵션명/색상을 스키마로 지정. 기존 옵션 변경은 전체 유지 목록/ID를 고려. Status 그룹 정의 변경은 UI 작업. [옵션·스키마 갱신](https://developers.notion.com/reference/update-data-source-properties) | 기존 옵션·색상 보존. Status→Select 자동 치환 금지. API가 지원해도 현재 CLI 미지원은 계속 표시 |
| View/Dashboard | Views API에 table/chart/dashboard와 위젯 배치가 공식 존재. [Views](https://developers.notion.com/guides/data-apis/working-with-views), [생성](https://developers.notion.com/reference/create-view) | API 불가능이라고 쓰지 않음. 002A에서 표/도넛 검증 이력, 범용 planner/웹은 아직 미지원 |
| 상품 제약 | Dashboard는 Business/Enterprise, Free 차트 1개. [Dashboard 안내](https://www.notion.com/en-gb/help/dashboards), [차트 안내](https://www.notion.com/help/charts) | 테스트 공간의 현재 플랜·남은 차트 수는 이번 미조회. 자동 Dashboard/차트는 014 제외 |
| 접근 권한 | 연결 capability와 페이지 공유가 모두 필요, 부모 공유는 하위 콘텐츠에도 영향. [권한](https://developers.notion.com/reference/capabilities) | 읽기 성공으로 Insert/Update·비공개 전체 ACL을 증명하지 않음. 승인되지 않은 회사 공간은 대상 아님 |

문서 도구에서 일부 .md/거대 Page 참조 읽기가 실패하여 정상 HTML 가이드/현행 DB 참조/공식 인덱스와 코드·과거 증거를 교차 확인했다. 불확실한 실제 응답 모양을 시험 성공으로 보고하지 않는다. 구 create-a-database 참조와 현행 create-database 참조를 구분했다.

### 요청 제한·실패 정책

공식 문서는 연결별 60초 예산(일반 플랜180, Business/Enterprise600), 별도 workspace 공유 제한·DS query 제한, 429/529의 Retry-After, 최대 payload 500KB 등을 설명한다. 쓰기 503에 committed_resource_id/retry_guidance가 포함될 수 있다. [요청 제한·재시도](https://developers.notion.com/reference/request-limits)

설계 정책은 공식 일반 재시도보다 보수적이다. 014의 콘텐츠 쓰기는 maxRetries=0을 유지하고 429/529도 자동 재전송하지 않는다. 읽기는 제한된 대기/횟수/시간 상한과 연결·workspace 단위 조정기를 사용한다. 타임아웃/5xx/JSON 불명확 상태에서 쓰기 성공 여부를 추정하지 않는다. NotionClient의 기존 안전장치를 지우지 않고, 추후 서버 전용 오류 어댑터에서 code/status/retryAfter/블록 제한·committed ID처럼 검증된 필드만 보존한다. 전체 응답 본문/헤더는 저장하지 않는다.

Free 블록 제한은 호출 속도 제한과 다르며 restricted_resource의 block_creation 안내가 있을 수 있다. 연결 종류·워크스페이스 조건에 따라 적용되므로 과거 002A 유예/009B 성공을 현재 생성 가능성으로 일반화하지 않는다. 플랜 우회용 연결 전환·자동 삭제는 금지한다. [공식 블록 제한](https://developers.notion.com/reference/workspace-block-limits)

## 4. 제안 아키텍처와 API

기존 입력→매핑/미리보기→저장 → 브라우저 JWT → 서버 Auth 확인+본인 저장본 조회 → 논리 계획 재계산 → 서버 실행 spec 변환 → 대상 연결/페이지 확인 → 구체 실행 제안 → 사용자 최종 승인 → 영구 실행 기록/단계 실행 → 원격 readback/결과 링크.

### API 단계별 계약(전부 신규 제안인 것은 명시)

| API | 단계 | 입력/출력·제약 |
| --- | --- | --- |
| POST /api/drafts/review | 기존 | 현재 계약 유지. 저장본/논리 계획 요약·SHA-256 확보 |
| POST /api/notion/plans/review | 012 신규 | draftId, expectedUpdatedAt, expectedPlanHash 세 필드만. 후자 둘도 이 새 API에서는 필수. 저장본으로 재계산, 아래 안전한 미리보기만 반환 |
| GET /api/notion/test-connection | 013 신규 | 지정 소유자만, env 연결의 비밀 없는 활성/워크스페이스/페이지 메타데이터 |
| POST /api/notion/test-target/review | 013 신규 | draftId/저장시각/해시/명시 parentPageId. 서버 allowlist와 비교 후 본인 연결로 읽기 확인. 생성 불가 상태 반환 |
| POST /api/notion/runs/propose | 014 신규 | 저장본·compilationHash·connectionId/revision·parentPageId. 동결 spec/요청 순서/최대 쓰기·부모·만료를 영구 저장한 실행 제안 |
| POST /api/notion/runs/{id}/confirm | 014 신규 | 본인 runId·requestHash·동의. 서버에서 소유/만료/현재 저장본/연결/대상 재확인 후 승인 상태를 원자적으로 소비. 이 경로에서는 아직 Notion 쓰기 없음 |
| POST /api/notion/runs/{id}/execute | 014 신규 | 승인된 동일 run만 실행. 제한된 단계 await→ID/결과 영구 기록 후 반환. 임의 configuration/요청 템플릿 수신 금지 |
| GET /api/notion/runs/{id} | 014 신규 | 본인 상태·완료/미완료 단계·안전한 코드·확인된 링크. 다른 사용자 run은 없는 run과 같은404 |
| POST /api/notion/runs/{id}/resume | 014 신규 | 사용자 재확인 후 동일 snapshot의 미시작 단계만 허용. 시작됨/불확실 단계는 조회만 하고 수동 검토로 중단 |

URI의 runId/connectionId/Notion ID를 소유권 증거로 신뢰하지 않는다. 매 요청 Supabase 사용자 재검증, 소유 설계/연결/run 대조, same-origin 최소 CORS, body 크기/필드 allowlist, private/no-store 적용. 사용자 ID는 Auth 결과로 결정하고 이메일/user_metadata를 권한에 쓰지 않는다. 근거: server/supabase-readonly.mjs:16 및 [getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

### 012 미리보기 응답 계약

    {
      "executionPlanVersion": 1,
      "adapterVersion": "notion-preview-v1",
      "draftId": "본인 설계 UUID",
      "sourceUpdatedAt": "서버 저장본 마이크로초 시각",
      "sourcePlanHash": "기존 review의 canonical plan SHA-256",
      "compilationHash": "제목·실행 spec·어댑터/API 버전을 포함한 별도 SHA-256",
      "profile": "recruitment-basic-v1 또는 preview-only",
      "support": {"status": "preview_supported 또는 blocked", "blockers": [], "warnings": []},
      "pageTitle": "저장한 교육명",
      "databases": [], "properties": [], "relations": [], "calculations": [],
      "steps": [{"id": "page:root", "operation": "create_education_page", "dependsOn": [], "executable": false}],
      "operationalCoverage": {"students": "not_implemented", "attendance": "logical_only_or_missing", "schedule": "not_implemented"},
      "target": {"verified": false, "parentPageId": null},
      "approvalAvailable": false, "webExecutionReady": false,
      "notionExecution": "not_executed", "notionRequests": 0, "supabaseWrites": 0
    }

위 배열은 계약 설명이며 구현된 응답 예시가 아니다. properties는 이름/유형/선택지·색상/필요한 논리 ID만 반환하고 rawText/formText/sourceRefs의 질문 원문/CSV 응답/세션/토큰은 반환하지 않는다. 기존 review의 비공개 필드 계약은 보존하고 새 API에서 안전한 항목만 투영한다. 200은 미리보기 응답 성공이며 실제 생성 가능 증명이 아니다. 구조 오류422, 저장본 차이409, 인증401, 소유 불명404, 대상 정책 거부403을 구분한다.

preview_supported는 해당 모집 스키마의 미리보기 변환을 지원한다는 뜻이다. executionCompileSupported와 operationalCoverage.status를 별도로 두고, 차단 항목에는 scope(execution_profile 또는 education_operations)를 넣는다. 운영 필수3DB 미구현을 숨기지 않으면서 제한된 모집 기본형 실험과 운영 서비스 완성 여부를 혼동하지 않는다. 일반형/확장형은 안전한 구조 요약은 표시하되 현재 실행 컴파일 미지원으로 남긴다.

서버는 기존 API를 내부 HTTP로 재호출하지 않는다. 동일한 Auth/소유자 조회·정규화·reviewSavedDraft/assertCurrentSnapshot을 내부 재사용한다. 기존 review는 전체 plan을 반환하지 않으므로 본인 row에서 planner 인자를 명시하여 재계산한다. 브라우저가 보낸 requestTemplates를 실행하지 않는다.

## 5. 생성 계획 변환과 교육 운영 모델

### 현재 모델과 목표의 구분

| 항목 | 현재 구현 | 후속 교육 운영 프로파일 |
| --- | --- | --- |
| 독립 교육 페이지 | planner의 논리 단계, 구 PoC의 고정 생성. 기본/일반 CLI는 기존 부모 사용 | 승인 테스트 부모 아래 run 전용 교육 페이지1개 |
| 교육생 | people은 신청자 포함 인물, enrollments는 참여 기록. V1 students는 Mock | 선정 후 해당 교육의 참여자1건을 나타내는 students. 신청자 전체 자동 이전 금지 |
| 출석 | 확장형 attendance+participation 논리 계획, 구 PoC 고정 출석 | students와 schedule에 연결하는 attendance. 행 없이 실제 출석률 표시 금지 |
| 일정 | V1 Mock/requirements.basicItems에는 있지만 현재 planner에는 DB 정의 없음 | schedule: 회차/기간/완료 등의 빈 스키마 |
| 과제 | projects는 팀 제출물. 일반 교육 과제와 동일하지 않음 | assignments→students/schedule, 제출 기록은 필요에 따라 별도 설계 |
| 평가 | judging은 프로젝트 심사 | 평가 대상·척도를 확정한 교육 평가로 별도 변환 |
| 수료 | completion의 논리 DB/equals_option | 선정 교육생의 수료 조건·분모 확정 후 사용 |
| 강사/운영 물품 | V1 Mock만 존재, 현재 planner 정의 없음 | instructors/supplies 및 필요한 일정 관계를 후속 정의 |
| 사용자 정의 지표 | 편집·저장·임의 AST 실행 미구현 | 허용 AST·입력 유형·분모·참조·0나누기 규칙을 별도 구현 |

**NB-012에서 미구현 운영 DB를 암묵적으로 추가하지 않는다.** 현재 모집 계획을 충실히 변환하고 운영 필수 교육생/출석/일정의 누락을 coverage/blockers에 표시한다. 운영 프로파일 전체는 미완성이다. 014의 빈1DB는 입력 스키마 연결 기술 실험이며 교육 운영3DB 완료가 아니다.

후속 운영 프로파일의 최소 스키마 제안은 다음과 같다. 아직 현재 저장 모델/CLI에 구현된 항목이 아니다.

| 논리 DB | 제안 기본 속성 | 의존 관계 |
| --- | --- | --- |
| students | 교육생 Title, 교육생 관리ID Rich text, 참여 상태 Select | 선정 후 교육 참여 기록만, 다른 교육의 인물 DB와 자동 공유하지 않음 |
| schedule | 일정명 Title, 일정 기간 Date, 차시 Number, 완료 Checkbox | 교육별 회차/운영 일정. 모집 프로그램 DB를 이름만 바꿔 대체하지 않음 |
| attendance | 출석기록 Title, 출석 상태 Select, 교육생 Relation, 일정 Relation | students와 schedule을 먼저 생성한 뒤 DS ID로 연결 |

옵션 이름/색상은 운영 프로파일 제안으로 별도 확인받고 현재 사용자 Status/옵션을 덮어쓰지 않는다. 사용자 DB 이름·추가 KPI 저장 기능이 필요하면 후속 저장 계약을 설계하며 현재 version1에서 지원한다고 표시하지 않는다. 상위 페이지 자체에 DB 전체 집계 Formula가 있는 것처럼 만들지 않는다. 교육 전체 KPI를 위해 집계 DB/행을 추가한다면 필수3DB와 별도의 선택 범위·추가 객체 수·승인에 포함해야 한다.

후속 운영 프로파일은 필수3DB를 독립 교육 페이지 안에 배치하고 다른 교육 DB를 자동 공유하지 않는다. 기본 DB→기본 속성/선택 색상→관계 ID 해결→선행 Formula→Rollup/후행 Formula의 실제 의존 순서→선택 View→정의 readback 순서다. Formula를 참조하는 Rollup이 있으므로 모든 Rollup을 모든 Formula보다 먼저 만드는 순서를 고정하지 않고 calculationOrder를 사용한다.

컴파일러는 논리 DB/DS/속성 ID→실제 ID 바인딩을 별도로 관리한다. DS당 Title1개, 중복 이름, 고립·순환 참조, 계산 유형·단위, 허용 색상, API/실행기 크기 제한을 검사한다. 미지원 항목을 삭제하거나 유형을 바꿔 통과시키지 않는다. 기존 원격 스키마 변경은 초기 범위 밖이다.

### KPI 도메인 규칙

- 모집: 신청 인원·신청 건수·선정 건수는 별개다. 중복 제거 기준이 없으면 고유 인원 계산 완료로 표시하지 않는다.
- 교육 운영: 선정 후 유효 참여 기록만 모집단으로 사용한다. 출석률은 인정 출석/대상 회차 기록, 수료율은 수료 인원/대상 참여자, 진행률은 완료 일정/대상 일정이다. 지각·취소·미래 회차·휴강 포함 규칙은 후속 확정한다.
- 빈 DB의 실제 값은 미산출이다. 정의 readback과 실제 행을 이용한 계산값 검증을 구분하고, 0%나 성공으로 꾸미지 않는다.
- 002A의 분모는 미리 만든 출석4건이라는 PoC 전제다. 009B의 선정률은 Notion 비율 Formula가 아니라 원격 건수 기반 로컬 계산이다. 임의 운영 KPI로 일반화하지 않는다.
- 사용자 정의 지표는 이름/대상 도메인/AST/참조/집계 단위/분모/빈 상태를 향후 계약으로 설계한다. 현재 version1에 이미 존재한다고 가정하지 않는다.

## 6. 연결 A/B와 비밀 관리

| 관점 | A: 개인 테스트 | B: 사용자별 OAuth |
| --- | --- | --- |
| 허용 대상 | 본인 Supabase UUID1개+개인 workspace/bot+테스트 부모1개 | Auth 확인 사용자와 개별 승인·연결을 결합 |
| 서버 비밀 | NOTION_API_TOKEN 등 서버 환경값. 브라우저 반환 금지 | access/refresh token을 서버 전용 영역에서 인증 암호화, 키는 DB와 분리하고 키ID/교체 관리 |
| 격리 | 관리자라는 이유만으로 허용하지 않음. 다른 사용자/관리자403, 회사 공간 거부 | connection.user_id와 실행/결과 소유자 대조. workspace ID만으로 공유 금지 |
| 초기 저장 | token은 env, owner/workspace/bot/부모는 서버 allowlist | private 연결 테이블과 비밀 없는 메타데이터, grant_revision/status |
| 권장 | 013→014 제한 실험에 채택 | 여러 사용자에게 생성 기능을 공개하기 전 구현 |

A의 예정 환경 이름은 NOTION_API_TOKEN, NOTION_TEST_PARENT_PAGE_ID, PPLUS_NOTION_TEST_OWNER_USER_ID, PPLUS_NOTION_TEST_WORKSPACE_ID, PPLUS_NOTION_TEST_BOT_ID다. 현재 등록 여부는 조회하지 않았고 값을 생성·등록·변경하지 않는다. 실제 사용할 배포 환경만 별도 승인받는다. 기존 Supabase URL/Publishable Key는 비밀키나 Notion 권한 대용이 아니다.

013은 UUID를 정규화하고 임의 URL을 fetch하지 않는다. 부모는 allowlist와 완전 일치해야 한다. trash/lock/예상 제목/연결 identity를 확인한다. 필요한 조상 메타데이터 조회도 사전 승인 범위에 포함하고 광범위 workspace 검색·회사 연결·기존 행 조회는 하지 않는다. 비공개 여부는 사용자 확인 사항이며 REST 읽기로 전체 ACL을 증명하지 않는다. 읽기 성공을 쓰기 capability 검증으로 표시하지 않고 시험 쓰기도 하지 않는다.

B의 흐름은 public connection OAuth다. 시작POST의 Supabase 본인 확인→짧은 만료 state/브라우저 거래 결합→고정 callback에서 한 번만 code 교환→동일 본인의 현재 JWT로 완료POST→연결 활성화 순서다. callback에 SPA JWT가 자동 전달된다고 가정하지 않는다. state/거래 nonce는 원자적으로 소비하고 계정 변경·임의 redirect를 거부한다. [공식 승인 흐름](https://developers.notion.com/guides/get-started/authorization)

갱신은 연결 단위로 직렬화하고 새 access/refresh 쌍을 함께 저장한다. 해제는 로컬 연결부터 비활성화하여 새 실행/다음 단계를 차단한 뒤 서버에서 철회를 시도한다. 재연결·권한 변경은 grant_revision을 바꿔 대기 승인을 무효화한다. Notion에서 철회되거나401/권한 소실이 확인되면 재연결을 요구한다. 기존 DB 자동 삭제나 모든 token의 일괄 실효를 추정하지 않는다. [갱신](https://developers.notion.com/reference/refresh-a-token), [철회](https://developers.notion.com/reference/revoke-token)

token/code/secret은 로그·URL·configuration·공개 빌드·실행 spec에 저장하지 않는다. 암호문 테이블을 브라우저가 직접 SELECT하지 못하게 하고 API는 연결ID/활성 상태만 반환한다. 회사 관리자 제한을 개인 token이나 복제로 우회하지 않는다. 회사 복제 성공은 미검증이다.

## 7. 승인·영구 기록·중복 및 실패

### 최초 쓰기 전 승인

사용자는 DB/속성/색상/관계/계산/제외 항목, 부모, 교육 페이지명, 행0개, 최대 쓰기 수를 보고 최종 클릭한다. 서버 발행 run 제안에 userId/draftId/sourceUpdatedAt/sourcePlanHash/compilationHash/adapterVersion/API version/connectionId+grantRevision/workspace+bot/parentId/논리 요청 목록과 바인딩 규칙의 requestHash/만료/nonce를 결합한다. 새 객체 ID는 승인 전에는 모르므로 실제 HTTP 바이트 해시를 미리 안다고 표현하지 않는다. 각 단계 직전에 검증된 ID로만 치환하고 실제 payload_hash를 기록하며 승인된 논리 요청 이외의 변경을 거부한다. 클라이언트 approved=true나 planHash만으로 승인하지 않는다.

014의 최초 쓰기 직전에 저장본·소유자·연결·부모를 재검증하고 달라지면409 또는 재확인으로 돌아간다. 시작 후 spec은 동결하고 새 편집을 섞지 않는다. 재개 때 저장본이 달라지면 자동 재컴파일하지 않고 부분 성공 상태에서 중지한다. 최종 승인 전 Notion 콘텐츠 쓰기0건을 보장하는 경로 분리가 필요하다.

### 필요한 저장 구조(이번에는 생성하지 않음)

- 012/013에는 기존 education_drafts면 충분하다. 설계JSON에 토큰·실행 이력을 추가하지 않는다.
- 014 전에는 notion_generation_runs와 notion_generation_steps에 해당하는 영구 저장2개가 필요하다. run에 승인 snapshot/만료/소비 상태도 두어 처음부터 승인 전용 테이블을 추가하지 않는다.
- run: user_id, draft_id, source_updated_at, plan_hash, compilation_hash, request_hash, connection/grant revision, workspace/parent/root IDs, immutable spec, status, approval, idempotency_key, lease/fencing revision, safe error, timestamps.
- step: run_id, logical step ID, payload_hash, depends_on, started_at, state, returned IDs, verification, safe error. UNIQUE(run_id, step_id), 사용자+idempotency key 유일성, 같은 의미의 미해결 생성에 대한 부모/연결 단위 배타 제어가 필요하다.
- 중복 판단용 semantic_fingerprint는 사용자/설계 snapshot/compilationHash/연결 revision/부모로 계산하고 runId·nonce를 제외한다. 새 runId로도 미해결 작업을 우회할 수 없게 한다. 정상 완료 후 의도적 추가 복사는 별도 사용자 승인으로 구분한다.
- 브라우저의 run/step 임의 변경을 막고 좁은 권한의 서버 실행 경로만 승인/상태를 갱신한다. 신규 기록은 RLS 활성·클라이언트 쓰기 GRANT 없음·본인 결과만 반환을 기본으로 검토한다. 서버 쓰기 역할도 전역 BYPASSRLS가 아닌 지정 기록 범위 최소 권한으로 설계한다. API 본인 확인과 별개로 소유권/RLS/GRANT를 검증한다. 기존 review의 Publishable Key+본인JWT 읽기를 관리자 키로 대체하지 않는다. 실행 기록용 서버 인증/DB 권한은014의 별도 승인·보안 검토 사항이다.
- OAuth 때는 private notion_connections와 만료 있는 OAuth 거래 저장을 추가 검토한다. 현재 존재하는 테이블이라고 가정하지 않는다. education_drafts를 실행 이력표로 재사용하지 않는다.

쓰기 시작 기록을 영구 저장한 ACK 전에는 Notion을 호출하지 않는다. 반환 ID를 즉시 저장하고 저장 실패도 uncertain으로 처리한다. 분산 lease 만료 후 다른 worker가 시작됨/불확실 POST를 재전송하면 안 된다. 원격 결과가 불명확한 상황에서 exactly-once를 보장한다고 표현하지 않는다.

초기 실험은 한 HTTP 요청 안에서 적은 단계를 await하고 기록까지 마친다. 202가 백그라운드 완료를 뜻하지 않는다. 응답 후 미await 작업이 계속 살아 있거나 GET 상태 poll이 쓰기를 진행한다고 설계하지 않는다. 큰 작업의 영구 worker/queue/workflow는 후속 승인 범위다. 로그아웃의 UI/결과 제거와 실행 취소·원격 롤백은 구분한다.

### 상태와 복구

proposed→approved→running→verification_pending→verified. 일부 생성은partial, 결과 불명확은uncertain, 후보 검토는manual_review, 정의 불일치는verification_failed, 시작 전 거부는blocked다. 알려진 root/DB/DS/property ID, 완료/미시작/불확실 단계를 표시한다.

쓰기 timeout/5xx/503→자동 재전송 금지→기존ID·marker·부모로 읽기 대조한다. 공식 committed_resource_id도 검증 후보일 뿐 본인/부모/marker/반환 내용 확인 없이 채택하지 않는다. 후보가 없어도 생성되지 않았다고 단정하지 않는다. 시작 기록 있는 단계는 읽기만 하고, 사용자 재확인 후 동일 spec의 미시작 단계만 진행한다. 자동 삭제·새 runId로 조용한 재생성·임의 계획 변경은 금지한다. 의도적 복사본은 별도 제안/재승인이 필요하다.

## 8. 최소 화면

현재 구조화된 plan은 index/mapping 쪽에 있고 result.html은 V1 Mock 결과다. 012는 기존 DB 구성 미리보기에 서버 검토 패널1개를 추가한다. V1 result에서 접근하면 저장 설계ID를 검증해 같은 기능으로 연결하고 sessionStorage의 V1 내용을 임의 실행하지 않는다.

표시 순서는 저장 상태/서버 시각→DB/속성/색상/관계/계산/미지원→연결 상태→부모 확인→최종 승인(012/013 비활성)→진행 단계→검증 링크/부분 성공이다. 여러 새 화면은 불필요하다. 편집 후 오래된 검토를 무효화하고 저장/재검토를 안내한다. 계정 변경·로그아웃·지연 응답으로 이전 결과가 복원되지 않아야 한다.

## 9. 단계별 구현 계획

### NB-V2-012: 웹 Dry Run(다음 확정 범위)

선행 조건: 기존 Auth/저장/RLS/review 계약 유지, 교육 운영3DB 미구현 표시 정책. Notion 연결/환경변수/SQL/배포는 제외한다.

예정 추가: api/notion/plans/review.mjs, server/notion/preview-plan.mjs, server/notion/preview-handler.mjs, js/notion-preview.mjs, 대응 회귀 테스트/문서. 예정 수정: index.html/mapping.html, 관련 패널 CSS, scripts/deployment/build-static.mjs, 필요한 로컬 개발 라우트. 기존 review 출력·CLI 실행기·저장 version1은 바꾸지 않는다. 새 공개JS1개가 추가되면 allowlist 개수는 의도한 차이만 반영하고 서버/비밀 비공개 규칙을 유지한다.

테스트: 본인/타인/없는 설계404, 무인증401/출처403, 추가 configuration/부모/token 거부, 과거 version1/누락 planner, 마이크로초409, 해시 불일치, 제목만 변경, 기본7속성·색상/이름 보존, Status/일반형 fixture/확장형/일정/KPI 미지원 표시, 동일 snapshot의 compilationHash 일치, rawText/토큰 비반환, 저장/계정 변경 중 지연 응답 폐기, 실행기 호출/Notion fetch0·Supabase 쓰기0, 기존 전체Node/V1 256·CLI·공개 빌드 회귀를 확인한다. 브라우저 모의 검사와 실제 Supabase를 구분한다. 실계정은 사용자가 직접 로그인한 기존 테스트 설계를 읽기만 한다.

완료 기준: 저장 설계→서버 변환→미리보기/미지원 표시 연결, 항상 webExecutionReady=false·승인/실행 비활성·Notion 요청/쓰기0. 새 교육 운영3DB·KPI 편집은 구현하지 않는다.

### NB-V2-013: 개인 테스트 연결 읽기

선행 조건: 012 완료, 본인UUID/workspace/bot/전용 부모 확정, 필요한 서버 비밀의 저장 위치/적용 환경 별도 승인. 쓰기는 금지한다.

예정 파일: api/notion/test-connection.mjs, api/notion/test-target/review.mjs, server/notion/test-connection.mjs, 연결 상태UI/검사. owner 외403, 위조 부모/회사workspace/URL SSRF 거부,404/철회/불일치, 읽기만·쓰기0·token 비공개를 검증한다. 읽기 가능과 쓰기 capability·전체 비공개 ACL 증명을 구분한다.

완료 기준: 지정 본인만 지정 부모를 읽는 근거와 미확인 쓰기 권한 표시, 실행 비활성. 모든 관리자에게 개인 token을 공유하지 않는다.

### NB-V2-014: 제한된 실제 생성

선행 조건: 013, 영구 run/step·소유권·원자적 승인/배타 제어, 정확한 payload/최대 쓰기/대상 별도 승인, Vercel 실행 시간/경로/비밀 비공개 검증. DB 적용과 Preview/Production도 각각 별도 승인이다.

첫 실험 후보는 승인 부모 아래 새 교육 페이지1+기본 속성의 빈 DB1+초기 DS1, 행0, 관계/계산/View0이다. 새 DS 이름 PATCH가 필요하면 최대1회만 한다. 새 root를 만들기 때문에 기존 CLI apply를 그대로 호출하지 않는다. 쓰기 최대3회(페이지POST1+DB POST1+이름PATCH 최대1)를 최종 제안에서 확정한다. 실패하면 부분 생성물을 보존하고 중지한다. 교육 운영 필수3DB 완료와는 다른 기술 실험이다.

예정 파일: server/notion/executor.mjs, run-store.mjs, remote-verify.mjs, runs API, 승인UI, 별도 검토한 DB migration안과 회귀. 다중 클릭/새 runId 우회/프로세스 종료/ID 저장 실패/응답 유실/권한 철회/429·503/부분 성공/재개/소유자/만료/해시 변조를 모의 검사한 뒤 승인 범위만 실제 생성·재조회한다.

완료 기준: 승인 대상만 생성, ID/속성/색상/부모/빈 상태 readback, 동일 run 재호출 추가쓰기0, 부분 실패 표시, 불명확 요청 재전송0. 유형별 실제 API 검사와 모의 검사를 구분한다.

### 후속 단계

교육 운영 프로파일(교육생/출석/일정)의 입력 계약·분모 확정→빈3DB/관계→허용 KPI→선택 모듈→OAuth/비밀 저장·재연결→다중 사용자 공개 순서를 권장한다. 템플릿/회사 복제를 권한 해결책으로 대체하지 않는다. 사용자 정의 지표는 별도 명세·호환성 판단이 필요하다.

## 10. 이번 검증과 한계

기존 순수 함수를 네트워크 금지 fetch 아래에서11개 검사했다. 기본형7속성 컴파일, 템플릿 실행 불가, 일반형Status 거부, fixture 누락 거부, 가상7행 준비, 출석/팀 확장6DB/의존3모듈, settings 명시 필요, review 비실행 플래그, 제목만 수정 시 같은 해시지만 updatedAt 차이 검출, V1기본 선택이 운영DB로 자동 변환되지 않음, fetch 시도0을 확인했다.

과거 실증은 보고서/근거 파일을 읽은 것이며 이번 원격 재실행이 아니다. 009A는 빈1DB/7속성/34항목, 009B는 고정3DB/가상7행/79항목, 002A는 고정6DB/16행/출석75→100/130항목과 표3·도넛1의 보고가 있다. Dashboard는 미실행이며 웹/OAuth/임의 사용자 설계의 원격 생성은 미구현이다.

이번 전체Node/V1/실계정 로그인/Notion REST·MCP/실제 생성/회사 연결/배포는 실행하지 않았다. Supabase는 public 테이블 메타데이터 읽기1회만 수행했다. 코드·원본 이미지·기존 문서·데이터를 변경하지 않고 새 설계/보고/인계문3개만 저장한다.

종료 Git HEAD는 시작과 같고 추적 파일/staged 차이는 없다. 새 문서3개만 미추적 상태다.
