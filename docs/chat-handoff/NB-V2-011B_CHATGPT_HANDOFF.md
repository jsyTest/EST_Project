# [ChatGPT 전달용] NB-V2-011B 서버 Dry Run 구현 결과

아래는 Codex가 EST_Project에 수행한 NB-V2-011B 구현 결과입니다. **서버의 읽기 전용 검토 API를 구현했으며, 사용자별 Notion 연결이나 웹 실제 생성은 구현하지 않았습니다.** 실제 코드·모의 검증·실제 원격 검사·미검증을 구분해 주세요.

## 1. 기준과 작업 범위

- 시작·종료 Git: `main / 1c1ec152c28f838e93aaf55335518286eb13246f` (`변경 구현 9`). 011A의 `36db2f5` 이후 최신 커밋을 확인하고 작업했습니다.
- 시작 작업 트리는 clean, 종료 시 신규 파일 10개만 미추적 상태입니다. 기존 추적 파일은 수정하지 않았습니다.
- Node `v24.22.1`. 새 npm 의존성·프레임워크 전환 없음.
- Supabase 테이블·RLS·Auth 설정·저장된 설계, Notion 자료, Git commit·push, Vercel 설정·배포 변경 없음.

## 2. 구현한 API

`POST /api/drafts/review`

서버가 다음을 수행합니다.

1. Bearer 토큰·JSON 요청·본문 크기·허용 출처 확인.
2. Supabase Auth `GET /auth/v1/user`로 실제 사용자 확인.
3. 같은 사용자 JWT와 Publishable Key로 기존 `education_drafts` 조회.
4. 기존 RLS에 더해 설계 ID·소유자 조건과 반환 소유자 재확인.
5. configuration/schema version 1 정규화.
6. `createGenerationPlan(normalized, normalized.planner)`로 저장된 선택을 반영해 재계산.
7. 계획 오류·확인 항목·CLI 지원 제약·해시·변경 감지 결과 반환.

화면에 새 생성 버튼을 연결하지 않았습니다. 임시 편집 내용은 서버 저장본에 반영되지 않으며 저장된 설정만 검사합니다.

## 3. 추가 파일

| 파일 | 역할 |
| --- | --- |
| `api/drafts/review.mjs` | Vercel Node API 진입점 |
| `server/drafts-review.mjs` | 요청·인증·출처·응답 제어 |
| `server/supabase-readonly.mjs` | 요청별 Auth·본인 설계 GET |
| `server/review-plan.mjs` | 계획·CLI 지원 범위·SHA-256·저장본 비교 |
| `server/review-errors.mjs` | 안전한 오류·스트리밍 크기 제한 |
| `scripts/development/serve-review.mjs` | loopback HTTP 개발 서버 |
| `scripts/notion-poc/tests/server-review.test.mjs` | 신규 회귀 검사 40개 |
| `docs/server/NB-V2-011B_API.md` | 요청·응답·환경변수·수동 검증 계약 |
| `docs/research/NB-V2-011B_REPORT.md` | 작업 보고서 |
| `docs/chat-handoff/NB-V2-011B_CHATGPT_HANDOFF.md` | 이 인계문 |

기존 HTML·CSS·브라우저 JS, 저장 모델·planner·SQL·Notion CLI·vercel.json은 변경하지 않았습니다.

## 4. 인증과 사용자별 격리

공식 auth-js의 `getUser(jwt)`와 같은 Auth 서버 경로를 Node fetch로 호출합니다. 브라우저 user_id·이메일·user_metadata·단순 JWT 해석을 신뢰하지 않습니다. 익명 Auth 사용자도 거절합니다. [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [공식 auth-js 구현](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts)

DB GET에는 사용자 JWT·Publishable Key와 `id`, 검증된 `user_id`, `limit=1` 조건을 사용합니다. 관리자 API·Secret·service_role은 사용하지 않습니다. 기존 RLS를 유지하며 반환된 ID·소유자도 확인합니다. 타인 설계와 존재하지 않는 설계는 같은 404 본문을 반환합니다.

인증 정보는 요청별 closure에만 있고 공유 세션·토큰 갱신·인증 캐시는 없습니다. 실제 JWT·원격 오류 원문·스택을 로그나 응답에 출력하지 않습니다. Notion 토큰·환경 파일을 읽지 않습니다.

## 5. 요청·응답 계약

요청은 JSON `draftId`가 필수이며 `expectedUpdatedAt`, `expectedPlanHash`만 선택적으로 허용합니다. 임의 configuration·user_id·Notion token·Formula 등 추가 필드는 400으로 거절합니다. 본문 상한 2,048바이트를 실제 스트림에도 적용합니다.

응답에는 저장본 ID·수정 시각·버전, templateType, 명시 선택과 의존 모듈, 추천 결과, planVersion·planId·SHA-256, DB/DS/속성/관계/Rollup/Formula 수, 확인 항목·차단 오류·CLI 지원 범위가 포함됩니다.

전체 configuration·원본 폼·CSV 응답 행·파일·Notion 요청 템플릿은 반환하지 않습니다. 유효하지 않은 저장 형식은 422이며 계획 해시는 null입니다.

항상 다음 값을 유지합니다.

- `webExecutionReady: false`
- `notionExecution: "not_executed"`
- `notionRequests: 0`
- `supabaseWrites: 0`

## 6. 저장 모델·해시·변경 감지

기존 `configuration.version=1`, `schema_version=1`, `planVersion=1`을 유지합니다. 과거 설계에 planner가 없으면 기존 기본값을 적용합니다. 일반형·확장형을 planner 누락으로 기본형으로 바꾸지 않습니다.

정규 계획 JSON의 SHA-256은 기존 기본형 컴파일러의 planHash와 일치합니다. 동일 저장본의 논리 계획은 같은 해시를 반환합니다. 해시는 승인 토큰이 아닙니다.

예상 수정 시각·계획 해시가 현재와 다르면 409 `saved_draft_changed`로 재확인을 요구합니다. 수정 시각은 시간대 차이를 처리하고 PostgreSQL 마이크로초를 보존합니다. 제목·목적처럼 계획에 영향을 주지 않는 변경은 논리 해시가 같을 수 있으므로 저장본 전체 변경 감지에는 updatedAt도 필요합니다.

이 API는 생성 승인·예약·잠금 기능이 아닙니다. 검토 후 설계가 다시 수정될 수 있다는 전제를 유지합니다.

## 7. 계획 검증과 실제 실행의 구분

| 구분 | 구현 결과 |
| --- | --- |
| 계획 자체 | 정상·확인 필요·구조 오류와 유효성을 별도 반환 |
| 기본형 CLI | 기존 순수 `freezeBasicPlan`으로 검사. 통과는 스키마에 한정 |
| 일반형 CLI | 타입·관계·계산 지원 범위의 참고 검사. 실제 실행기 사전 검증 아님 |
| 일반형 가상 행 | 사람 2·프로그램 2·신청 3행, 고정 바인딩·개인 테스트 대상·별도 승인 필요. 빈 웹 실행 가능으로 표시하지 않음 |
| Status | 계획을 보존하면서 현재 CLI 미지원으로 표시 |
| URL | 기존 저장 모델에서 미지원. 422와 URL 미지원 사유 반환 |
| 속성 수·옵션 한도 | 기본형 컴파일러 거절을 숨기지 않음 |
| 확장형·모듈 | 계획 계산만 수행, 현재 실제 실행 미지원 |
| 웹 실행 준비 | 모든 계획 false. OAuth·토큰·부모·권한·승인 검증 없음 |

일반형의 `scopeCompatible`은 참고 판정입니다. 가상 행·대상·권한을 확인하지 않았으므로 `schemaSupported`는 false입니다. 지원하지 않는 속성을 삭제·변환하거나 기본형으로 대체하지 않았습니다.

## 8. 보안·공개 빌드·배포

- JSON 형식·허용 필드·UUID·예상 시각/해시 검증.
- 인증 401, 출처/저장소 권한 403, 타인/없는 설계 동일 404, 충돌 409, 구조 오류 422 구분.
- 원격 실패·요청 제한·시간 초과·서버 설정 누락을 안전한 오류로 반환.
- 모든 API 응답에 브라우저·CDN·Vercel CDN no-store와 `Vary: Authorization, Origin` 적용.
- 동일 출처·정확한 허용 목록 정책. 외부 CORS 허용 없음. Origin 없는 도구도 Bearer 필수.
- 원격 redirect 거절, 호출당 8초·본문 읽기 5초·원격 응답 크기 제한.
- 공개 빌드 26개 allowlist 유지. API·server·CLI·문서·비밀은 정적 출력에서 제외.

Vercel API는 공식 Node Web-standard 방식으로 추가했고 기존 정적 빌드 설정은 유지했습니다. [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js)

원격 Vercel 환경변수는 등록하지 않았습니다. 실제 Functions 번들·Preview 라우팅·캐시 헤더는 미검증입니다. Vercel CLI가 설치되지 않아 `vercel dev/build`도 실행하지 않았습니다. 분산 요청 제한/WAF 정책은 후속 검토 대상이며 원격 429 처리만으로 이를 구현했다고 판단하면 안 됩니다.

## 9. 검증 결과

| 검증 | 결과 | 증거 구분 |
| --- | --- | --- |
| 전체 Node 검사 | **295/295 통과**, 실패·취소·생략 0 | 실제 로컬 실행, 원격 응답은 mock |
| 기존 검사 | 255개 유지 | Auth·저장·매핑·색상·CLI 회귀 포함 |
| 신규 검사 | 40개 | 실제 API·정규화·계획 엔진 검사 |
| V1 Mock | 256조합 통과 | 실제 기존 회귀 검사 실행 |
| A/B 격리 | 동시 12요청에서 토큰·소유자·유형·해시 분리 | 모의 Auth·DB |
| planner·과거 v1 | 기본·일반·확장·모듈·추천·기본값 통과 | 모의 저장본과 실제 계획 엔진 |
| 변경·지원 제약 | 해시·마이크로초·409·확인 항목·구조 오류·Status·URL·가상 7행 제약 통과 | 로컬 코드·모의 원격 응답 |
| 실제 로컬 HTTP | API POST 200·GET 405, 주요 화면/자원 200, 내부 경로 404 | 실제 loopback 서버, Auth/DB는 mock |
| 실제 Supabase Auth | 가짜 토큰 GET 1회 → **401 invalid_session** | 실제 원격 HTTP. DB 조회 없음 |
| 실제 정상 계정·A/B 설계 조회 | **미검증** | 브라우저 도구 연결 불가로 인증 세션 없음 |
| 실제 브라우저·모바일·Vercel | **미검증** | 자동 UI 회귀·로컬 경로 검사와 구분 |

전체 명령은 `node --test scripts/notion-poc/tests/*.test.mjs`입니다. 최초 loopback 실행 제한은 승인 검토를 거친 로컬 실행으로 해결했습니다. 원격 쓰기 권한을 사용한 검사가 아닙니다.

실제 계정 토큰을 임의로 만들거나 비밀번호를 요청하지 않았습니다. API 계약 문서에 본인 테스트 계정과 기존 가상 설계로 직접 확인하는 방법을 적었고, 토큰을 출력·공유하지 않도록 안내했습니다.

## 10. 원격 변경과 남은 작업

- Supabase 원격 쓰기 **0건**, SQL·테이블·RLS·Auth 설정 변경 없음.
- 실제 원격 요청은 가짜 토큰 Auth GET 1건뿐. 정상 사용자 설계 조회 성공으로 기록하지 않음.
- Notion 요청·쓰기 **0건**. OAuth·페이지 검색·생성 승인·실행 이력·웹 생성 미구현.
- Git commit·push·Vercel Preview/Production 배포 없음.
- 기존 화면·저장·매핑·색상·CLI는 소스와 자동 회귀 기준으로 보존. 이번 실제 브라우저 동작까지 검증했다고 주장하지 않음.

다음 우선순위 제안:

1. 허가된 실제 테스트 계정으로 읽기 전용 본인/타인 설계 검증과 배포 전 Functions 검증.
2. OAuth 읽기 전용 PoC의 상태 검증·단기 거래·암호화 토큰 저장 책임 설계.
3. 별도 DB 적용 승인을 받은 연결 메타데이터·비밀 저장·영구 실행 이력 구현.
4. 구체적 생성 승인을 받은 빈 기본형 웹 생성, 이후 가상 행 없는 일반형 실행기.

이번에 OAuth나 새 테이블·영구 이력을 앞당겨 구현하지 않았습니다.

## 11. ChatGPT 검토 요청

ChatGPT는 NB-V2-011B 결과를 검토해 주세요.

1. 서버 사용자 인증과 설계 소유권 확인이 안전한지 평가해 주세요.
2. 기존 저장된 기본형·일반형·확장형 구성이 정확하게 반영되는지 확인해 주세요.
3. 서버 계획 해시와 저장본 변경 감지가 적절한지 검토해 주세요.
4. 실제 웹 생성 가능 상태와 계획 검증 결과가 구분되는지 확인해 주세요.
5. 기존 Supabase Auth·저장·매핑·색상·Notion CLI가 보존됐는지 평가해 주세요.
6. 실제 HTTP·Supabase 테스트와 모의 테스트를 구분해 주세요.
7. OAuth 읽기 전용 PoC와 영구 실행 이력 개발의 다음 우선순위를 제안해 주세요.

실제 구현·모의 검증·미검증을 구분해 주세요. 실제 정상 계정 조회와 Vercel 검증을 먼저 보완할지, OAuth PoC 설계를 진행할지 결정하고 다음 작은 Codex 작업 범위를 작성해 주세요. **서버 Dry Run 성공을 실제 Notion 웹 생성 완료로 판단하지 마세요.**
