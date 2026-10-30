# [NB-V2-011B 작업 보고서]

## 1. 결과와 상태

로그인 사용자 검증 → 본인 저장 설계 조회 → 저장 planner 반영 → 계획 재계산 → CLI 지원 범위 검사 API를 로컬 구현했다. API와 추가 회귀 검사는 통과했다. **실제 계정 A/B로 저장 설계를 읽는 검증과 Vercel 원격 Functions 검증은 미검증**이다. 웹 Notion 생성 기능이 완성된 결과가 아니다.

- 시작·종료 Git: `main / 1c1ec152c28f838e93aaf55335518286eb13246f` (`변경 구현 9`).
- 시작 작업 트리: clean. 직전 011A 기준 `36db2f5`에서 이후 커밋된 최신 상태를 기준으로 작업했다.
- 종료 작업 트리: 아래 신규 파일 10개만 미추적 상태로 추가. 기존 추적 파일 수정 없음.
- 실행 환경: Node `v24.22.1`, 추가 npm 의존성 없음.
- Supabase DB·RLS·Auth 설정 변경, Notion 쓰기, Git commit·push, Vercel 설정·배포 없음.

## 2. 추가 파일

| 파일 | 역할 |
| --- | --- |
| `api/drafts/review.mjs` | Vercel Node Web-standard API 진입점 |
| `server/drafts-review.mjs` | 요청·출처·인증 헤더 검증, API 흐름·안전한 응답 |
| `server/supabase-readonly.mjs` | 요청별 Auth·소유 저장본 GET 전용 연결 |
| `server/review-plan.mjs` | 설정 정규화, 계획·지원 범위·해시·변경 감지 |
| `server/review-errors.mjs` | 오류 계약·스트리밍 크기 제한 |
| `scripts/development/serve-review.mjs` | loopback 전용 실제 HTTP 개발 서버 |
| `scripts/notion-poc/tests/server-review.test.mjs` | 신규 회귀 검사 40개 |
| `docs/server/NB-V2-011B_API.md` | 요청·응답·설정·실계정 수동 확인 계약 |
| `docs/research/NB-V2-011B_REPORT.md` | 이 보고서 |
| `docs/chat-handoff/NB-V2-011B_CHATGPT_HANDOFF.md` | 독립적인 ChatGPT 인계문 |

기존 HTML·CSS·브라우저 JS, 저장 모델·repository, planner, CLI, SQL, `vercel.json`은 변경하지 않았다. 빌드가 재생성한 `public-dist`는 기존 제외 대상이다.

## 3. API와 인증

경로: `POST /api/drafts/review`.

필수 요청은 `Authorization: Bearer <access token>`과 JSON `draftId`다. 선택 필드는 `expectedUpdatedAt`, `expectedPlanHash`다. 그 외 필드는 거절한다. 본문 상한은 2,048바이트이며 Content-Length 검사뿐 아니라 실제 스트림 읽기에도 적용한다.

SDK 설치 없이 Node fetch로 `GET /auth/v1/user`를 호출한다. 이는 공식 auth-js `getUser(jwt)`의 서버 검증 경로와 동일하며 토큰을 로컬 해석해 사용자를 신뢰하지 않는다. 사용자 이메일·user_metadata·브라우저 user_id는 사용하지 않는다. 익명 Auth 사용자도 이 API에서는 거절한다. [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [공식 auth-js 소스](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts)

같은 사용자 Bearer와 Publishable Key로 기존 `education_drafts`를 GET한다. `id`, 검증된 `user_id`, `limit=1`을 적용하고 반환된 소유자와 ID를 다시 확인한다. 기존 RLS를 그대로 적용하며 관리자 API·Secret·service_role을 쓰지 않는다. 타인 설계와 없는 설계는 같은 404 상태·본문이다. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

서버 환경변수는 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, 선택적인 `REVIEW_ALLOWED_ORIGINS`다. 현재 Supabase 호스트 형태와 `sb_publishable_` 키만 허용하고 Secret/legacy JWT API key는 거절한다. 요청별 closure에 토큰을 묶어 공유 세션·토큰 갱신·인증 캐시를 만들지 않았다. Notion 환경변수나 토큰 파일을 읽지 않는다.

## 4. 저장 모델과 계획 일관성

`normalizeConfiguration(row.configuration, row.schema_version)` 후 반드시 `createGenerationPlan(normalized, normalized.planner)`를 호출한다. 기존 version 1, schema_version 1, planVersion 1을 유지한다. 과거 planner 누락은 기존 정규화 기본값인 basic·모듈 없음·추천 조건 false로 처리한다.

응답은 유형·선택 모듈·의존 모듈·추천 결과, DB/DS/속성/관계/Rollup/Formula 수, 확인 필요 항목·차단 오류, planId·SHA-256을 포함한다. 원본 설정·폼 본문·CSV 응답 행·파일·Notion 요청 템플릿·JWT는 반환하지 않는다.

해시는 기존 순수 `digest`를 이용한 정규 JSON 계획 SHA-256이며 기본형 컴파일러의 planHash와 동일하다. 실행 승인 토큰이 아니다. 저장본 수정 시각은 마이크로초를 보존해 비교한다. 제공된 예상 시각·해시가 다르면 409 `saved_draft_changed`와 달라진 기준을 반환한다. 계획에 영향을 주지 않는 제목·목적 수정은 논리 계획 해시가 같을 수 있으므로 저장본 전체 변경 감지는 updatedAt도 사용해야 한다.

저장본을 읽은 뒤 다시 수정될 가능성을 잠그지 않는다. 이번 결과는 특정 조회 시점의 검토이며 생성 승인·예약이 아니다.

## 5. 계획 정상과 실행 준비의 구분

| 항목 | 구현 |
| --- | --- |
| 계획 검증 | `valid`, `confirmation_required`, `structural_error`와 구조적 유효성을 별도 반환 |
| 종합 검토 | 구조 오류 → 미지원 기능 → 확인 필요 → 정상 순서. 미지원 상세는 별도 유지 |
| 기본형 CLI | 기존 순수 `freezeBasicPlan`을 직접 사용. 통과는 스키마 검사만 의미 |
| 일반형 CLI | 기존 exported 타입·Rollup 함수와 소스 범위로 참고 목록 검사. 실제 executor preflight로 인증하지 않음 |
| 일반형 제약 | 3DB·모듈 없음, 가상 사람 2·프로그램 2·신청 3행 및 고정 바인딩 필요. 저장본만으로 실행 가능 판정하지 않음 |
| Status | 원래 계획을 유지하면서 현재 CLI 미지원 속성으로 반환 |
| URL | 기존 저장 모델도 미지원이므로 422 구조 오류와 URL 미지원 사유 반환 |
| 확장형·모듈 | 계획은 계산하되 현재 CLI 실제 생성 미지원 표시 |
| 기본형 속성 수·옵션 제한 | 컴파일러 거절을 미지원 사유로 표시. 조용히 제거·변환하지 않음 |
| 웹 준비·실행 | 모든 결과 `webExecutionReady=false`, `notionExecution=not_executed` |

일반형 `scopeCompatible`은 참고용 범위 판정이며 가상 행·대상·권한 검증이 아니다. `schemaSupported`는 일반형에서 false로 유지한다. 기본형이 통과해도 Notion 연결·부모·승인 검증을 완료한 것이 아니다. 기존 CLI 실행 함수나 Notion client는 호출하지 않았다.

## 6. 오류·캐시·출처·배포

- 401: 토큰 없음·거절·만료 응답·익명 Auth. 403: 출처 또는 저장소 권한 거절. 404: 타인/없는 설계 동일 응답.
- 400/413/415: 입력 형식·추가 필드·크기·콘텐츠 유형. 409: 오래된 저장본. 422: 잘못된 저장 형식·계획 구조.
- 429: 원격 요청 제한. 502/503/504: 원격 실패·설정 누락·시간 초과. 예상하지 못한 예외는 상세를 숨긴 500.
- 모든 API 응답에 브라우저·일반 CDN·Vercel CDN no-store, `Vary: Authorization, Origin` 적용.
- 브라우저 Origin은 API와 같은 출처이면서 허용 목록에 있어야 함. Cross-site 요청 차단, CORS 허용 헤더 없음. Origin 없는 도구도 Bearer 필수.
- 원격 redirect 거절, 원격 호출당 8초·본문 읽기 5초 제한, 원격 응답 크기 제한. 서버 코드에 사용자 토큰·응답 원문 로그 없음.
- 공개 빌드는 기존 allowlist 26개 유지. API·server·CLI·문서·비밀은 정적 출력에 포함되지 않음.
- `api/drafts/review.mjs`는 공식 Node 런타임의 root api Web-standard 방식. 기존 `framework:null`, buildCommand·outputDirectory 유지. [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js)

분산 요청 제한/WAF 설정은 구현하지 않았다. 원격 429를 안전하게 전달하는 것과 서비스 자체의 요청 제한은 다르다. 실제 Preview의 환경변수·번들·경로·응답 헤더와 부하 검증이 배포 전 필요하다. Vercel CLI가 설치되어 있지 않아 네이티브 `vercel dev/build`는 실행하지 않았으며 무단 설치·프로젝트 연결·배포 설정 변경을 하지 않았다.

## 7. 검증 결과

| 검사 | 결과 | 구분 |
| --- | --- | --- |
| Node 전체 회귀 | **295/295 통과**, 실패·취소·생략 0 | 실제 로컬 실행, 원격 서비스는 mock |
| 신규 검사 | 40개 | 실제 코드·메모리 Auth/Data API 응답 |
| 기존 검사 | 255개 유지 | 기존 Auth·저장·매핑·색상·CLI 회귀 포함 |
| V1 | 256개 조합 통과 | 기존 회귀 검사 실행 |
| A/B 요청 격리 | 동시 12요청, 토큰·소유자·유형·해시 격리 | 모의 Auth·Data API |
| 저장본·planner | basic/standard/extended·모듈 의존성·추천·과거 v1·해시 일관성 통과 | 모의 DB, 실제 계획 엔진 |
| 오류·지원 범위 | 무인증·거절·만료 응답·403/404·본문·스키마·충돌·Status·URL·가상 7행 등 통과 | 모의 원격 응답 |
| 실제 로컬 HTTP | POST 200, GET 405, 기존 주요 화면·자원 200, 내부 경로 404 | 실제 loopback 소켓. Auth/DB는 mock |
| 실제 Supabase Auth | 가짜 토큰 GET `/auth/v1/user` **1회**, 401 `invalid_session` 확인 | 실제 원격 Auth HTTP. DB 조회 없음 |
| 실제 정상 계정·A/B 저장본 조회 | **미검증** | 브라우저 도구가 연결되지 않아 세션을 사용할 수 없음 |
| 구문 검사·Git | 새 서버/진입점 구문 정상, 기존 추적 파일 diff 없음 | 실제 로컬 검사 |

전체 검사 명령: `node --test scripts/notion-poc/tests/*.test.mjs`.

최초 로컬 소켓 검사는 샌드박스의 listen 제한으로 실패했으나 승인 검토를 거친 루프백 실행으로 재검증하여 통과했다. 실제 원격 쓰기를 허용한 것이 아니다. 테스트 작성 중 발견한 URL 모델 제한·Status 그룹 값·컴파일 한도 분류를 바로잡은 뒤 최종 전체 검사를 다시 통과했다.

실제 브라우저 UI·모바일 검사는 이번에 수행하지 않았다. 기존 화면 소스는 변경하지 않았고 기존 자동 UI 검사와 실제 로컬 정적 경로로 회귀를 확인했다. 이것을 실제 Supabase 저장·복원이나 Vercel Production 화면 검증으로 표기하지 않는다.

## 8. 원격 변경과 남은 작업

- 이번 코드 경로와 실제 검증의 Supabase 쓰기: **0건**. 실제 원격 호출은 가짜 토큰 Auth GET 1건뿐.
- Notion 요청·쓰기: **0건**. OAuth·토큰·페이지·생성 기능 없음.
- 테이블·SQL·RLS·Auth 설정·Git commit/push·Vercel 원격 설정/배포: **모두 없음**.
- 실제 정상 테스트 계정 조회, A/B ID 교차 접근, 만료된 진짜 JWT, 실제 원격 네트워크 중단, Vercel 함수 번들·Preview는 미검증.
- 수동 확인 방법·환경변수·응답 계약은 `docs/server/NB-V2-011B_API.md`에 정리했다. 토큰을 채팅에 보내거나 로그에 남기지 않도록 안내했다.

다음 우선순위는 ① 승인된 테스트 계정의 읽기 전용 조회와 배포 전 로컬/Preview 검증, ② OAuth 읽기 전용 PoC의 단기 거래·비밀 저장 구조 검토, ③ 별도 승인을 받은 연결·실행 기록 저장, ④ 빈 기본형 웹 실제 생성 순서다. OAuth/영구 이력/실제 생성은 이번 범위에 추가하지 않았다.
