# [NB-V2-011C 작업 보고서]

## 1. 판정

**부분 완료: 회귀·공개 빌드·기존 Vercel 배포의 API 라우팅을 확인했고, Production의 서버 설정 오류를 발견했다. 실제 정상 계정의 인증·설계 격리는 세션에 접근할 수 없어 미검증이다.**

이번에는 새 기능이나 코드 수정이 없다. 두 보고 문서만 추가했다. Supabase 쓰기·SQL·RLS/Auth 설정 변경, Notion 요청, Git commit/push, Vercel Preview/Production 배포, CLI·npm 설치를 수행하지 않았다.

## 2. 최신 상태와 환경

| 항목 | 확인 결과 |
| --- | --- |
| 시작·종료 Git | `main / 12394c89de16cddfa4521d3f7d739e018f950434`, `변경 구현 10` |
| 시작 작업 트리 | clean. 011B의 신규 10개 파일은 이미 커밋된 상태 |
| Node | `v24.22.1` |
| 브라우저 | 앱·탭 목록 없음. browser access host unavailable / native pipe startup failed |
| Vercel CLI | PATH의 `vercel`·`vc`, 프로젝트 로컬 실행 파일 및 확인한 일반 설치 경로에서 찾지 못함 |
| 로컬 연결 | `.vercel/project.json` 확인되지 않음. 링크 생성·환경변수 다운로드 안 함 |
| Vercel 원격 프로젝트 | 연결 플러그인 읽기 조회: `pplus`, framework null, Node 24.x |
| 이미 존재하는 최신 배포 | `dpl_4qkfLZuQA5pNjvhsokowcd3b5x3S`, `pplus-oogwrk92p-pplus1.vercel.app`, Production READY, Git main·동일 SHA |

마지막 배포는 **작업 시작 시 이미 존재하던 배포**다. 이번에 배포한 것이 아니다. 기존 배포를 읽기 전용으로 검사한 결과와 로컬 Vercel CLI 검증을 구분한다.

## 3. 실계정 검증 결과

실제 사용자 세션을 가져오거나 새로 발급하지 않았다. 비밀번호·JWT를 요청하거나 출력·파일 저장·스크린샷·외부 서비스로 전송하지 않았다. 브라우저 세션이 없어 관리자 키·연결 플러그인의 권한으로 사용자를 대신하지도 않았다.

| 필수 시나리오 | 결과 |
| --- | --- |
| A 로그인 → A 소유 테스트 설계 API 200 | **미검증** |
| 저장 유형·모듈·DB/속성/관계 수의 실제 저장본 비교 | **미검증** |
| A → B 설계 404, 없는 설계와 동일 응답 | **실계정 미검증**. 기존 모의 검사는 통과 |
| B 로그인 → B 소유 설계·B → A 역방향 | **미검증** |
| 기본/일반/확장 저장본·planner 없는 과거 v1 | **실제 존재 여부·실계정 API 검사 미검증**. 모의 회귀 통과 |
| 실제 저장본 반복 해시·현재 시각·오래된 시각·해시 409 | **실계정 미검증**. 모의 회귀 통과 |

이전 006·010A의 실제 저장·격리 증거는 이번 서버 API의 실계정 성공 증거로 재사용하지 않았다. 특히 **010A의 ‘테스트 설계 A/B’는 같은 계정의 원본·복사본**이므로 서로 다른 사용자 A/B의 격리 검사로 사용할 수 없다.

## 4. 이번 실제 HTTP 검사

### 4.1 로컬 서버 → 실제 Supabase Auth

기존 공개 프런트엔드 설정에서 Supabase URL·Publishable Key만 읽어 메모리의 설정 객체로 전달했다. 환경 파일·Notion 토큰을 읽지 않았고 설정을 저장하지 않았다. 기존 Node 개발 서버를 loopback 임시 포트에서 실행하고 아래 요청 후 종료했다.

| 요청 | 실제 결과 |
| --- | --- |
| GET `/api/drafts/review` | 405 `method_not_allowed` |
| POST, 토큰 없음 | 401 `auth_required` |
| POST, 의도적으로 유효하지 않은 문자열 | **401 `invalid_session`** |
| GET `/api/not-registered` | 404 |
| GET `/server/drafts-review.mjs` | 404 |

실제 원격 Supabase 호출은 **GET `/auth/v1/user` 1회**였다. 정상 토큰이 아니어서 Data API 조회는 발생하지 않았다. 이는 실제 네트워크 연결과 인증 거절 확인이며 정상 계정 인증 성공이 아니다. 쓰기는 0건이다.

### 4.2 이미 존재하는 Production 배포

`https://pplus-rouge.vercel.app`에 인증정보 없이 GET 또는 검증용 POST를 보냈다. 테스트 POST는 콘텐츠 생성·저장 API가 아니라 읽기 전용 review 요청이다.

| 요청 | 실제 결과 |
| --- | --- |
| GET `/`, `/login.html`, `/mapping.html`, `/result.html` | 모두 HTML 200 |
| GET `/api/drafts/review` | **JSON 405**, `Allow: POST`, 코드 `method_not_allowed` |
| POST `/api/drafts/review`, 토큰 없음 | **JSON 401**, `auth_required` |
| POST `/api/drafts/review`, 가짜 토큰 | **JSON 503**, `server_not_configured` |
| POST, 외부 Origin 또는 Sec-Fetch-Site cross-site | 각각 **JSON 403**, `origin_not_allowed` |
| GET `/api/not-registered` | 404, HTML 성공 응답 아님 |
| GET `/server/drafts-review.mjs`, `/scripts/notion-poc/cli.mjs`, `/docs/server/NB-V2-011B_API.md`, `/.env` | 모두 404 |
| GET `/api/drafts/review.mjs` | JSON 404 `route_not_found`. 소스 노출 아님 |

API 응답에서 `mode=server-dry-run`, `webExecutionReady=false`, `notionExecution=not_executed`를 확인했다. Cache-Control은 `private, no-store, max-age=0`, CDN-Cache-Control은 `no-store`, Vary는 `Authorization, Origin`, API의 Access-Control-Allow-Origin은 없었다. 개인 결과 200의 실제 캐시 검증은 하지 못했다.

이 결과는 **기존 배포에서 `.mjs` Functions가 실행되고 API가 정적 HTML로 대체되지 않는다는 실제 증거**다. 브라우저의 로그인 동작·화면 사용성이나 인증된 설계 조회까지 검증한 것은 아니다. 정적 HTML에서 보인 CORS 헤더를 개인 API의 CORS 정책과 혼동하지 않는다.

## 5. 재현된 Production 문제와 수정 여부

1. 재현: 유효한 요청 형태의 `draftId`와 가짜 Bearer 문자열로 기존 Production review API 호출.
2. 기대: 올바른 서버 설정이라면 Supabase Auth 검증 후 401 `invalid_session`.
3. 실제: 503 `server_not_configured`.
4. 원인: 현재 코드의 `readConfiguration()`에서 서버의 URL·Publishable Key 검사가 실패한다. URL 누락·형식 오류 또는 키 누락·형식 오류 중 어느 것인지는 환경변수 원문을 읽지 않아 확정하지 않았다.
5. 비교: 동일 소스에 기존 공개 설정을 메모리로 제공한 로컬 요청은 실제 Supabase Auth 401까지 도달했다. 우선 확인할 대상은 배포 환경 설정이다.
6. 수정: **없음**. 원격 환경변수·배포 변경이 금지되어 있으며 코드가 오류를 숨기지 않고 안전하게 차단하고 있다. 우회 기본값·관리자 키를 추가하지 않았다.
7. 수정 후 재검증: **미실시**. 변경하지 않았으므로 해결 완료로 표시하지 않는다.

필요한 최소 확인 범위는 아래와 같다. 이번에는 확인용 원문 조회나 설정 등록을 실행하지 않았다.

| 변수 | 필요한 범위·조건 |
| --- | --- |
| `SUPABASE_URL` | Development·승인된 Preview·Production에서 기존 프로젝트 URL. 현재 코드는 HTTPS `*.supabase.co`의 루트 URL만 허용 |
| `SUPABASE_PUBLISHABLE_KEY` | 같은 프로젝트의 `sb_publishable_` 키. Secret/service_role/legacy JWT key 불허 |
| `REVIEW_ALLOWED_ORIGINS` | 기본 Production origin은 기존 코드에 있음. Preview는 정확한 Preview origin과 같은 출처 요청 조건 확인. loopback 개발 origin은 허용 |

Vercel 환경변수 변경은 기존 배포에 소급 적용되지 않으므로, 향후 실제 해결에는 **환경변수 확인·필요 시 수정과 별도 승인된 새 배포**가 필요하다. 이번 작업에서 실행하지 않는다. [Vercel 환경변수와 적용 환경](https://vercel.com/docs/environment-variables)

## 6. Vercel 빌드·라우팅 사전 검토

| 항목 | 로컬/공식 근거 | 실제 확인·제약 |
| --- | --- | --- |
| Framework | `framework:null` | 원격 메타데이터도 null |
| Build Command | `node scripts/deployment/build-static.mjs` | 로컬 직접 실행 성공. Dashboard override 값은 플러그인 응답에 없음 |
| Output Directory | `public-dist` | 로컬 정확히 26개 allowlist. 원격 설정 원문은 미확인 |
| Root Directory | 저장소 루트에 api·server·js·vercel.json이 함께 존재 | Dashboard의 정확한 값은 플러그인에 반환되지 않아 미검증. 비어 있다고 추측하지 않음 |
| Functions | `api/drafts/review.mjs`의 Web-standard fetch export | 기존 원격 배포의 JSON 405/401/503 응답으로 실제 진입점 실행 확인 |
| `.mjs` 지원 | 공식 Node 문서의 지원 방식 | 현재 배포에서 동작 확인 |
| 정적 화면·API 분리 | 전체 경로를 index.html로 보내는 rewrite 없음 | 실제 주요 HTML 200, API JSON, 미등록 경로 404 |
| 네이티브 로컬 Vercel | CLI·프로젝트 연결 없음 | `vercel dev/build` 미실행. 설치·link·pull하지 않음 |

공식 근거: [Node Functions와 `.mjs`](https://vercel.com/docs/functions/runtimes/node-js), [Root Directory·Build·Output 설정](https://vercel.com/docs/builds/configure-a-build). 현재 구조를 재설계하거나 정적 배포 설정을 바꾸어야 한다는 오류는 확인하지 못했다.

## 7. 보안 검토

| 확인 항목 | 결과와 증거 범위 |
| --- | --- |
| 매 요청 사용자 재확인 | Auth 서버 GET 경로 유지. 실제 가짜 토큰 거절과 모의 회귀 통과. 정상 계정 미검증 |
| 요청 간 JWT/ID 혼합 | 요청별 closure·동일 토큰의 DB GET·소유자 조건 유지. 동시 모의 12요청 통과 |
| RLS | 기존 사용자 JWT로 Data API를 사용하며 관리자 우회 없음. 정책 파일 수정·SQL 실행 없음. 실제 RLS 정책 재조회·계정 격리 검증은 안 함 |
| Origin/Bearer | Origin은 브라우저 출처 검사이고 사용자 증거가 아님. Origin 없는 도구도 Bearer 필요. 기존 Production에서 외부 출처 403 확인 |
| 캐시 | 소스·모의 응답·Production 오류 응답의 no-store 확인. 실제 개인 200 응답 미검증 |
| 임의 configuration | 허용 필드는 ID·예상 시각·해시뿐. 추가 필드 거절 회귀 통과 |
| 오류 상세 | 원격 본문·스택을 반환하지 않는 경로 유지. 실제 503도 일반 코드만 노출 |
| 해시 | 생성 승인 토큰이 아니며 실행 API 자체가 없음 |
| 토큰·비밀 | 실제 JWT/비밀번호를 취득·기록하지 않음. 정적 출력에 비밀 파일 없음 |

분산 요청 제한/WAF와 실제 정상 계정의 Data API 검증은 여전히 별도 과제다. getUser 방식은 서버 네트워크 검증이라는 공식 설명을 확인했다. [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)

## 8. 자동 검사와 기존 기능

- `node --test scripts/notion-poc/tests/*.test.mjs`: **295/295 통과**, 실패·취소·생략 0.
- V1 Mock: **256조합 통과**.
- 기존 011B의 40개 회귀를 포함해 Auth·저장·매핑·색상·planner·CLI·공개 빌드 검사가 유지됐다. Auth·DB·Notion 실행기 회귀의 원격 응답은 mock이다.
- 공개 빌드 직접 실행: **26개**, 실제 출력 목록이 allowlist와 정확히 같고 api/server/scripts/docs/.env 출력 0개.
- 실제 로컬 소켓의 모의 정상 API 200과 정적 경로 검사는 기존 295개 안에 포함된다. 이것을 실계정 성공으로 표시하지 않는다.
- 기존 소스·SQL·설정·manifest는 수정하지 않았다. 생성된 public-dist와 테스트 임시 파일은 기존 제외 대상이다.

## 9. 실계정 안전 확인 절차 — 아직 실행하지 않음

1. 허가된 본인 테스트 계정 A/B와 이미 존재하는 가상 설계 UUID를 준비한다. B 소유 설계는 B의 화면에서 실제 존재·소유를 먼저 확인한다. 010A의 설계 A/B 이름만으로 서로 다른 계정이라고 가정하지 않는다.
2. 로컬 서버에 기존 Supabase URL·Publishable Key만 설정한다. 기존 `.env` 전체를 출력하거나 Notion/Secret 키를 읽지 않는다. 설정 방법은 `docs/server/NB-V2-011B_API.md` 참조. 환경 준비는 사용자가 별도로 수행할 단계다.
3. `node scripts/deployment/build-static.mjs` 후 기존 개발 서버 `node scripts/development/serve-review.mjs`를 실행한다. `http://127.0.0.1:8787/login.html`에서 직접 로그인한다. 다른 origin의 로그인은 자동 공유되지 않는다.
4. 본인 테스트 UUID로 아래 코드를 같은 출처의 개발자 도구에서 실행한다. 세션은 메모리에서만 사용하고 표시하지 않는다. Network 기록/HAR·스크린샷으로 토큰을 공유하지 않는다.

```javascript
await (async () => {
  const ownId = '본인 기존 가상 설계 UUID';
  const foreignId = ''; // B에서 존재·소유를 확인한 UUID. 없으면 빈 값 유지.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(ownId) || (foreignId && !uuid.test(foreignId))) throw new Error('테스트 UUID를 확인해 주세요.');
  const {data, error} = await window.supabaseClient.auth.getSession();
  if (error || !data.session) throw new Error('같은 로컬 화면에서 먼저 로그인해 주세요.');
  const call = async (id, extra = {}) => {
    const response = await fetch('/api/drafts/review', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`},
      body: JSON.stringify({draftId: id, ...extra})
    });
    return {status: response.status, body: await response.json()};
  };
  const first = await call(ownId);
  if (first.status !== 200) {
    console.log({test: 'own', status: first.status, code: first.body.error?.code});
    return;
  }
  const repeated = await call(ownId);
  const current = await call(ownId, {expectedUpdatedAt: first.body.updatedAt, expectedPlanHash: first.body.planHash});
  const staleTime = await call(ownId, {expectedUpdatedAt: '1970-01-01T00:00:00Z'});
  const wrongHash = await call(ownId, {expectedPlanHash: first.body.planHash === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64)});
  console.log({test: 'own_review', status: first.status, templateType: first.body.templateType,
    modules: first.body.enabledModules, counts: first.body.counts,
    webExecutionReady: first.body.webExecutionReady, notionExecution: first.body.notionExecution,
    repeatedHashEqual: repeated.status === 200 && repeated.body.planHash === first.body.planHash,
    currentSnapshotStatus: current.status, staleTimeStatus: staleTime.status, wrongHashStatus: wrongHash.status});
  if (foreignId) {
    if (foreignId.toLowerCase() === ownId.toLowerCase()) throw new Error('같은 UUID를 타인 설계로 검사할 수 없습니다.');
    const foreign = await call(foreignId), missing = await call(crypto.randomUUID());
    console.log({test: 'foreign_and_missing', foreignStatus: foreign.status, missingStatus: missing.status,
      sameSafe404: foreign.status === 404 && missing.status === 404 && JSON.stringify(foreign.body) === JSON.stringify(missing.body)});
  } else console.log({test: 'foreign', result: '미검증 — 다른 계정 테스트 UUID 없음'});
})();
```

5. 기대값은 own 200, 저장된 유형·모듈·개수 일치, 웹 준비 false·미실행, 반복 해시 동일, currentSnapshot 200, staleTime/wrongHash 409다. 성공 조건과 일치하지 않으면 결과를 그대로 보고한다.
6. 이미 존재하는 기본형·일반형·확장형 테스트 설계에 대해 ownId만 바꿔 반복한다. 없는 유형은 미검증으로 남기며 새 설계를 만들지 않는다. planner가 없는 과거 설계인지 별도 확인되지 않으면 legacy 검사도 미검증이다.
7. B 세션이 허가되어 있으면 B의 본인 200과 B→A 404를 같은 방식으로 확인한다. UI의 평소 계정 전환만 이용하고 비밀번호·토큰은 공유하지 않는다. 새 계정·행·수정 요청은 만들지 않는다.
8. 정상·유형·개수·상태·동일 여부만 기록하고 원본 설정·세션·토큰은 보고서에 붙이지 않는다. 본 절차는 **현재 수행된 검증 결과가 아니다**.

## 10. 남은 과제와 OAuth 준비 상태

우선순위는 ① 개발 세션에서 실제 정상 계정·A/B·저장본 검증, ② Production 서버 설정 확인 및 필요한 변경/재배포의 별도 승인, ③ 승인 후 원격 정상 인증·조회 재검증이다. 로컬 Vercel CLI 설치·연결은 필요성이 합의된 경우에만 별도 진행한다.

OAuth 읽기 전용 PoC의 문서 설계는 논의할 수 있지만, 실제 인증·소유권 검증 완료를 전제로 구현 단계가 통과했다고 판단해서는 안 된다. 영구 실행 이력·Notion 생성 기능은 이번에 진행하지 않았다.

최종 상태: 문서 2개만 추가. 기존 소스 diff 없음. Supabase 쓰기 0건, Notion 요청 0건, 원격 환경 변경·새 배포·commit/push 0건.
