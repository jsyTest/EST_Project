# [ChatGPT 전달용] NB-V2-011C 실계정·서버 함수 검증 결과

Codex가 EST_Project의 기존 서버 Dry Run을 QA했습니다. **부분 완료이며, 실계정 인증·격리가 확인됐다고 판단하면 안 됩니다.** 코드·원격 설정 변경 없이 회귀 검사와 기존 배포의 읽기 전용 HTTP 확인을 수행했습니다.

## 1. 최신 상태

- 시작·종료 Git: `main / 12394c89de16cddfa4521d3f7d739e018f950434`, `변경 구현 10`.
- 시작 작업 트리 clean. 011B의 신규 10개 파일은 이미 커밋되어 있었습니다.
- Node `v24.22.1`.
- 이번에는 `docs/research/NB-V2-011C_REPORT.md`와 이 인계문만 추가했습니다. 기존 소스·설정·SQL·CLI·manifest 수정 없음.

## 2. 실제 계정 검증이 남은 이유

브라우저 도구에서 앱·탭을 조회할 수 없었고 browser access host unavailable 오류가 발생했습니다. 실제 테스트 계정 세션에 접근하지 못했습니다.

비밀번호·JWT를 요청하거나 임의 발급·출력·파일 저장·스크린샷·외부 서비스로 전달하지 않았습니다. 관리자 키나 Supabase 플러그인의 권한으로 사용자 인증 검사를 대신하지 않았습니다.

따라서 다음은 모두 **실계정 미검증**입니다.

- A의 본인 설계 API 200과 저장 planner·모듈·DB/속성/관계 수 비교.
- A→B 설계 거절과 없는 설계의 동일 응답.
- B 본인 조회 및 B→A 역방향.
- 실제 기본형·일반형·확장형·planner 없는 과거 v1 저장본.
- 실제 저장본 반복 해시와 수정 시각·기대 해시의 200/409 검사.

이전 006·010A의 실제 검증을 이번 서버 API의 성공으로 재사용하지 않았습니다. 특히 010A의 ‘설계 A/B’는 같은 사용자의 원본·복사본이므로 두 사용자 격리의 증거가 아닙니다.

## 3. 이번에 실제 확인한 로컬 HTTP·Supabase

기존 공개 URL·Publishable Key만 메모리 설정 객체로 제공한 로컬 서버에서 다음을 확인했습니다.

| 요청 | 결과 |
| --- | --- |
| GET `/api/drafts/review` | 405 `method_not_allowed` |
| 무인증 POST | 401 `auth_required` |
| 의도적으로 유효하지 않은 문자열로 POST | **401 `invalid_session`** |
| 미등록 경로·서버 소스 경로 | 404 |

실제 Supabase 네트워크 요청은 GET `/auth/v1/user` **1회**였습니다. Data API 조회는 없었고 쓰기도 0건입니다. 이는 가짜 토큰 거절 검사이며 정상 계정 인증 성공이 아닙니다.

## 4. Vercel 상태에서 새로 확인한 사실

현재 커밋이 이미 Production에 배포되어 있었습니다. 연결 플러그인으로 다음 메타데이터를 읽었습니다.

- 프로젝트 `pplus`, framework null, Node 24.x.
- 기존 배포 ID `dpl_4qkfLZuQA5pNjvhsokowcd3b5x3S`.
- 배포 URL `pplus-oogwrk92p-pplus1.vercel.app`.
- Production READY, main·동일 Git SHA.

**이번 작업에서 새 배포를 한 것이 아닙니다.** 기존 `https://pplus-rouge.vercel.app`에 인증정보 없는 읽기 전용 확인만 했습니다.

| 기존 Production 경로 | 실제 결과 |
| --- | --- |
| `/`, `/login.html`, `/mapping.html`, `/result.html` GET | HTML 200 |
| `/api/drafts/review` GET | JSON **405**, `Allow: POST` |
| review 무인증 POST | JSON **401 auth_required** |
| review 가짜 토큰 POST | JSON **503 server_not_configured** |
| 외부 Origin·cross-site POST | JSON **403 origin_not_allowed** |
| 미등록 `/api/not-registered` | 404 |
| server 소스·CLI·개발 문서·`/.env` | 모두 404 |
| `/api/drafts/review.mjs` | JSON 404. 소스 노출 아님 |

API 응답은 HTML fallback이 아니고 `mode=server-dry-run`, `webExecutionReady=false`, `notionExecution=not_executed`를 유지했습니다. 오류 응답의 private/no-store·Vary와 API CORS 허용 헤더 없음을 확인했습니다. 실제 개인 결과 200의 캐시는 미검증입니다.

이것은 **기존 원격 배포에서 `.mjs` Functions 진입점과 기본 라우팅이 동작한다는 실제 증거**입니다. 로컬 Vercel CLI 검사나 정상 사용자 조회 증거와 구분해야 합니다.

## 5. 발견한 설정 오류와 조치

재현: 기존 Production에 올바른 요청 형태와 가짜 Bearer 문자열을 보내면, Supabase Auth의 401까지 가지 못하고 **503 `server_not_configured`**가 반환됩니다.

현재 코드에서 이 오류는 `readConfiguration()`의 Supabase URL·Publishable Key 검사 실패를 뜻합니다. 값 누락인지 형식 오류인지, 어느 변수인지는 원문을 읽지 않아 확정하지 않았습니다. 동일 소스에 기존 공개 설정을 제공한 로컬 검사는 실제 Auth 401에 도달했습니다.

코드 수정·원격 설정 수정은 하지 않았습니다. 안전하게 차단하는 코드를 우회하거나 관리자 키·자동 기본값을 추가하지 않았습니다. **설정 오류는 미해결 상태**입니다.

다음 확인 범위를 별도 작업으로 제안합니다.

- `SUPABASE_URL`: 기존 프로젝트의 HTTPS Supabase 루트 URL.
- `SUPABASE_PUBLISHABLE_KEY`: 같은 프로젝트의 `sb_publishable_` 키. Secret/service_role 사용 금지.
- Development·Preview·Production 적용 범위 확인. Preview는 정확한 `REVIEW_ALLOWED_ORIGINS`와 동일 출처 조건도 확인.
- 환경변수 변경은 기존 배포에 소급 적용되지 않으므로, 필요 시 설정 수정과 **별도 승인된 새 배포** 후 재검증.

이번에는 원격 환경변수를 등록·변경하지 않았습니다. [Vercel 환경변수 적용 방식](https://vercel.com/docs/environment-variables)

## 6. 로컬 Vercel·빌드 검증 범위

`vercel`·`vc` CLI와 `.vercel/project.json`이 확인되지 않았습니다. 무단 설치·link·pull·배포를 하지 않았고 **로컬 `vercel dev/build`는 미검증**입니다.

기존 설정은 framework null, buildCommand `node scripts/deployment/build-static.mjs`, outputDirectory `public-dist`입니다. 로컬 공개 빌드를 직접 실행해 **정확히 26개 allowlist 파일**만 출력되고 api/server/scripts/docs/.env가 제외되는 것을 확인했습니다.

Root Directory와 Dashboard의 Build/Output override 값은 플러그인 응답에 없어 정확한 현재값을 확인하지 못했습니다. 비어 있다고 추정하지 않았습니다. `.mjs`와 Web-standard fetch는 공식 지원 방식이며 기존 배포에서도 실제 응답을 확인했습니다. [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js)

## 7. 자동 검사·보안·기존 기능

- 전체 Node **295/295 통과**, 실패·취소·생략 0.
- V1 Mock **256조합 통과**.
- 기존 40개 서버 회귀 포함: 모의 A/B 동시 12요청, planner·과거 v1·계획 해시·200/409·지원 제약 통과.
- Auth·DB·CLI의 원격 응답은 mock입니다. 로컬 모의 API 200을 실계정 200으로 표기하지 않았습니다.
- 요청별 사용자 재확인·같은 JWT의 소유자 조건·기존 RLS 경로 유지. 실제 RLS 정책 재조회와 두 계정 검증은 수행하지 못했습니다.
- Origin은 출처 검사이고 Bearer는 사용자 검증입니다. 서로 대신하지 않습니다.
- 임의 configuration 거절, 캐시 금지, 원격 오류 상세 비공개, 해시를 승인 토큰으로 사용하지 않는 구조를 확인했습니다.
- 기존 Auth·저장·매핑·색상·planner·Notion CLI·manifest 소스는 변경하지 않았습니다. 실제 브라우저 사용성·모바일은 미검증입니다.

## 8. 원격 변경과 안전한 후속 검증

- Supabase INSERT/UPDATE/DELETE·SQL·테이블·RLS·Auth 설정 변경 **0건**.
- Notion 요청·쓰기 **0건**. OAuth·웹 생성·이력 기능 추가 없음.
- Git commit/push·Vercel 새 배포·설정 변경·npm/CLI 설치 **없음**.

작업 보고서에 실제 계정용 안전한 수동 절차와 복사 가능한 로컬 검사 코드를 작성했습니다. 기존 가상 설계만 사용하여 본인 200, B 설계와 없는 설계 404, 반복 해시, 현재 시각 200, 오래된 시각·틀린 기대 해시 409를 확인하도록 했습니다. JWT는 브라우저 메모리에서만 사용하고 결과에는 상태·유형·개수·비교 결과만 남깁니다.

없는 유형을 검사하려고 새 설계·계정을 만들지 않습니다. B의 설계 존재·소유 확인 없이 두 계정 격리를 성공 처리하지 않습니다. 이 수동 절차는 **아직 실행된 결과가 아닙니다**.

## 9. 다음 결정 요청

OAuth 읽기 전용 PoC의 문서 설계는 논의할 수 있지만, 실제 사용자 인증·설계 격리가 완료됐다고 보고 구현 검증 단계를 통과시키면 안 됩니다. 우선 개발 세션에서 실계정 읽기 검증을 마치고, 별도 승인 범위로 Production 환경 설정과 필요한 재배포를 처리하는 것을 권장합니다.

ChatGPT는 다음을 평가해 주세요.

1. 실제 사용자 인증과 본인 설계 검증은 아직 미검증이라는 구분이 정확한가요?
2. 실제 두 계정의 접근 분리 검증을 위해 어떤 증거가 더 필요한가요?
3. 저장 planner 반영은 모의 회귀와 실계정 확인 중 어디까지 완료됐나요?
4. 계획·해시·변경 감지의 실계정 보완 순서는 적절한가요?
5. 기존 원격 Functions 라우팅 확인과 로컬 Vercel CLI 미검증을 적절히 구분했나요?
6. 기존 Auth·저장·Notion CLI가 보존됐는지 평가해 주세요.
7. OAuth 읽기 전용 PoC로 넘어가기 전 실계정 세션·환경 설정 중 무엇을 먼저 해결해야 하나요?

**Production의 `server_not_configured` 확인·해결 승인과 실계정 QA를 다음 작은 작업으로 분리할지 결정하고 후속 Codex 프롬프트를 작성해 주세요. 실제 확인·모의 검사·미검증을 구분하며 Notion 웹 생성 성공으로 판단하지 마세요.**
