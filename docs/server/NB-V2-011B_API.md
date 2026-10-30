# NB-V2-011B 서버 Dry Run API 계약

## 목적과 실행

`POST /api/drafts/review`는 로그인 사용자 확인 → 소유 저장 설계 조회 → version 1 정규화 → 저장 planner를 사용한 계획 재계산만 수행한다. Notion 호출·Supabase 쓰기·승인 등록은 하지 않는다. 기존 화면에는 새 버튼을 추가하지 않았다.

추가 npm 의존성은 없다. Node 24.x의 fetch·Request·Response를 사용한다. Vercel 진입점은 `api/drafts/review.mjs`의 Web-standard `fetch` export이며 기존 `vercel.json`과 정적 빌드는 유지한다. 공유 로직은 공개 빌드 밖의 `server/`에 둔다.

필수 서버 환경변수:

| 변수 | 값 |
| --- | --- |
| `SUPABASE_URL` | 기존 프로젝트 URL `https://pxkjxcryceqtjomgxyfe.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | 기존 `js/supabase-client.js`에 사용하는 Publishable Key |
| `REVIEW_ALLOWED_ORIGINS` | 선택. 쉼표로 구분한 정확한 origin. 기본값 `https://pplus-rouge.vercel.app` |

Secret/service_role/legacy JWT API key는 설정값으로 받지 않는다. 현재 프로젝트의 `sb_publishable_` 키만 허용한다. 서버는 `.env`나 Notion 토큰을 자동으로 읽지 않는다. 환경변수가 없으면 503 `server_not_configured`다. 원격 Vercel 환경변수는 이번 작업에서 등록하지 않았다.

로컬 검증용 `.env.review.local`을 직접 준비한다면 위 Supabase 공개 설정만 넣는다. 이 파일은 기존 `.env.*` 제외 규칙에 해당하며 저장소에 추가하지 않는다. 실제 사용자 JWT는 파일이나 채팅에 넣지 않는다.

```sh
node scripts/deployment/build-static.mjs
node --env-file=.env.review.local scripts/development/serve-review.mjs
```

`http://127.0.0.1:8787`에서 기존 공개 화면과 API를 함께 제공한다. 서버는 loopback에만 바인딩하고 정적 파일은 기존 26개 허용 목록에서만 제공한다. `server/`, API 소스, CLI, 문서, `.env`는 404다. 이 개발 서버가 Vercel 런타임을 완전히 재현하는 것은 아니다.

## 요청

```http
POST /api/drafts/review
Authorization: Bearer <현재 Supabase access token>
Content-Type: application/json
```

```json
{
  "draftId": "저장된 설계 UUID",
  "expectedUpdatedAt": "2026-10-30T01:02:03.123456+00:00",
  "expectedPlanHash": "직전 서버 응답의 64자리 SHA-256"
}
```

`draftId`만 필수다. 수정 시각과 해시는 선택이며 예시 문자열 대신 실제 직전 응답을 그대로 사용한다. 본문은 UTF-8 JSON 객체·최대 2,048바이트이고 위 세 필드만 허용한다. user_id·configuration·토큰·Formula·실행 JSON 같은 추가 필드는 400으로 거절한다. 데이터 조회의 소유자는 Auth 서버 결과에서만 정한다.

브라우저의 Origin이 있으면 API와 동일한 origin이면서 허용 목록에 있어야 한다. loopback 개발 주소는 허용한다. 다른 출처의 CORS는 제공하지 않는다. Origin이 없는 CLI도 Bearer 검증이 필수다. Cookie만으로 인증하지 않는다. Preview 사용 시 정확한 Preview origin을 별도로 설정하고 배포 검증해야 한다.

## 인증·조회 경로

1. Supabase Auth에 `GET /auth/v1/user`를 보내 사용자 ID를 확인한다. auth-js의 `getUser(jwt)`가 사용하는 동일한 서버 경로이며, 단순 JWT 해석이나 getSession 반환을 신뢰하지 않는다.
2. 같은 Bearer와 Publishable Key로 `GET /rest/v1/education_drafts`를 호출한다. `id=eq.<draftId>`, `user_id=eq.<검증된 사용자>`, `limit=1` 조건을 넣고 기존 RLS를 유지한다.
3. ID·소유자를 다시 비교하고 빈 결과·다른 소유자·없는 설계는 동일한 404 본문을 반환한다. 사용자 메타데이터·이메일·관리자 API를 사용하지 않는다.

요청별 closure에만 토큰을 보관한다. 자동 토큰 갱신·세션 저장·공유 인증 클라이언트·사용자별 캐시·로그는 없다. Supabase 호출은 두 GET뿐이며 redirect는 거절한다. 원격 호출당 8초, 요청 본문 읽기 5초와 원격 응답 크기 제한을 적용한다.

근거: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [공식 auth-js 구현](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js). Changelog도 확인했으며 신규 테이블 노출 기본값 변경을 이유로 기존 권한을 임의 수정하지 않았다. [Supabase 변경 이력](https://supabase.com/changelog)

## 응답

정상·확인 필요·지원 범위 밖 계획은 200으로 결과를 반환하되 아래 상태를 구분한다. 구조 오류는 422이며 지원하지 않는 저장 버전은 계획을 만들지 않는다.

| 항목 | 의미 |
| --- | --- |
| `reviewVersion`, `mode` | 검토 응답 버전 1, `server-dry-run` |
| `reviewStatus` | `valid`, `confirmation_required`, `unsupported_features`, `structural_error`. 충돌은 `stale`, 일반 요청 오류는 `request_rejected` |
| `draftId`, `updatedAt` | 검토한 본인 저장본 |
| `schemaVersion`, `configurationVersion` | 기존 저장 버전. 유효 저장본은 둘 다 1 |
| `planVersion`, `planEngineVersion`, `notionApiVersion` | 논리 계획 버전 1, 서버 검토 식별 버전, 현재 Notion API 버전 |
| `templateType`, `requestedModules`, `enabledModules` | 저장한 유형·명시 선택·의존성 포함 활성 모듈 |
| `recommendations` | 저장한 추천 조건으로 재계산한 추천 |
| `planId`, `planHash`, `hashScope` | 기존 논리 ID와 정규 JSON SHA-256. 실행 승인 토큰이 아님 |
| `counts` | DB·Data Source·속성·관계 쌍·관계 속성·Rollup·Formula 수, 행 0 |
| `planValidation` | 계획 자체의 상태, 구조적 유효성, 확인 필요 항목·차단 오류 |
| `cliSupport` | 기본형 컴파일 검사, 일반형 테스트 전용 범위와 전제 조건, 미지원 속성·모듈 |
| `webExecutionReady` | 모든 경우 `false` |
| `notionExecution` | 모든 경우 `not_executed` |
| `notionRequests`, `supabaseWrites` | 이 코드 경로의 두 값은 모두 0 |

기본형 `schemaSupported=true`는 `freezeBasicPlan` 통과만 뜻한다. 대상 페이지·권한·토큰·승인은 검증하지 않았다. 일반형 `scopeCompatible`은 소스에서 확인한 범위 목록의 참고 판정이며 실제 실행기 사전 검증이 아니다. 가상 7행·고정 바인딩이 필요하므로 일반형 `schemaSupported`는 항상 false다. 확장형과 모듈 생성은 미지원이다.

Status는 계획에는 남겨두고 CLI 미지원으로 보고한다. URL은 기존 저장 모델이 허용하지 않으므로 422로 거절하면서 URL 미지원 사유도 반환한다. 속성 수 100개 초과 등 기본형 컴파일 제약도 숨기지 않는다. 어떤 유형도 자동 변환·제거하지 않는다.

전체 configuration·계획 JSON·원본 폼 텍스트·CSV 응답 행·원본 파일·Notion 요청 템플릿·JWT는 반환하지 않는다. 확인 메시지에는 정상적인 속성명 등 설정 정보가 들어갈 수 있으므로 응답은 개인 정보로 취급한다.

## 변경 감지와 오류

동일 논리 계획의 SHA-256은 기존 기본형 컴파일러의 해시와 같다. updated_at은 시간대가 달라도 같은 순간이면 같게 비교하고 PostgreSQL 마이크로초를 보존한다. expectedUpdatedAt·expectedPlanHash 중 제공된 값이 다르면 409 `saved_draft_changed`, 현재 시각·해시·달라진 기준을 반환한다. 해시는 논리 계획만 대상으로 하므로 계획에 영향을 주지 않는 제목·목적 수정까지 감지하려면 updatedAt도 보내야 한다. 이번 검토 이후 저장이 다시 바뀔 수 있으며 이것은 실행 승인이나 원자적 생성 예약이 아니다.

| HTTP | 예 |
| --- | --- |
| 400 | 잘못된 ID·JSON·추가 필드·수정 시각·해시 |
| 401 | 토큰 없음·유효하지 않음·만료·익명 사용자 |
| 403 | 출처 거절 또는 저장소 권한 거절 |
| 404 | 없는 설계·타인 설계, 또는 다른 API 경로 |
| 405 | POST 이외. `Allow: POST` |
| 409 | 저장본 변경 |
| 413 / 415 | 본문 초과 / JSON 이외 |
| 422 | 저장 형식·계획 구조 오류 |
| 429 | Supabase 요청 제한 |
| 502 / 503 / 504 | 원격 실패·잘못된 응답 / 서버 설정 없음 / 시간 초과 |
| 500 | 예상하지 못한 내부 오류. 상세 내용 비공개 |

모든 API 응답에 Cache-Control·CDN-Cache-Control·Vercel-CDN-Cache-Control의 no-store와 `Vary: Authorization, Origin`을 설정한다. 서버 오류 본문에 원격 오류 문자열·스택·토큰을 넣지 않는다.

## 실제 계정의 수동 읽기 전용 확인

이번 자동 브라우저 도구는 연결되지 않아 실제 계정 A/B 조회는 미검증이다. 승인된 본인 테스트 계정으로 로컬 `login.html`에서 로그인한 뒤, 기존 가상 테스트 설계의 UUID만 사용한다. 새 설계를 만들거나 기존 설계를 수정할 필요가 없다.

아래 코드는 로그인한 같은 출처의 개발자 도구에서 실행하는 예시다. 토큰을 콘솔에 출력하거나 복사하지 않는다. placeholder를 본인 테스트 설계 ID로 바꾼다.

```javascript
const {data: reviewSession} = await window.supabaseClient.auth.getSession();
if (!reviewSession.session) throw new Error('먼저 로컬에서 로그인해 주세요.');
const reviewResponse = await fetch('/api/drafts/review', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${reviewSession.session.access_token}`
  },
  body: JSON.stringify({draftId: '본인 가상 테스트 설계 UUID'})
});
console.log(reviewResponse.status, await reviewResponse.json());
```

다른 허가된 테스트 계정의 가상 설계 ID는 동일한 404가 되어야 한다. 실제 계정 간 권한 검증은 승인된 테스트 대상에서만 하고 결과가 나오기 전 성공으로 기록하지 않는다.

배포 전 남은 과제: Vercel의 실제 Functions 번들·라우팅·서버 환경변수·Preview 캐시 헤더 검증, 분산 요청 제한/WAF 정책, 실제 계정 A/B·네트워크 중단 검증. 인메모리 제한을 분산 제한처럼 주장하지 않는다. 이번에는 원격 설정·Preview·Production을 변경하지 않았다.
