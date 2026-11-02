# [NB-V2-013 작업 보고서] 개인 Notion 테스트 연결·읽기 사전검증 구조

작성일: 2026-11-02 (Asia/Seoul)

## 1. 완료 판정

**A. 로컬 코드·모의 검사 완료 / B. 실제 연결 준비 절차 문서화 완료 / C. 승인 요청서만 작성, 실제 연결 중지.**

실제 Notion 토큰 조회·생성·설정, Notion 원격 API 요청·쓰기, Vercel 변경을 하지 않았다. 현재 로컬은 Notion 연결 미설정·원격 읽기 비활성 상태다. 생성 성공이나 실제 Notion 연결 완료로 판정하지 않는다.

## 2. 시작·종료 상태와 이전 보고의 차이

- 브랜치: main. 시작·종료 HEAD: `0ed8d36c4549dd775c36f11bf3368f6eca8181df`.
- 시작 작업 트리는 깨끗했다. 직전 012 보고의 “미커밋 15파일”은 이후 `0ed8d36`에 커밋되어 있었다. 이번 작업에서 커밋하지 않았다.
- 종료: 기존 파일 수정 6개, 신규 코드/테스트 7개, 신규 문서 2개를 미커밋 상태로 남겼다.
- 011 설계·012 보고/코드/테스트, 기존 CLI config/README/사전검증 소스, Supabase 읽기 전용 인증 코드, Vercel 정적 출력+네이티브 API 구조를 확인했다.
- Vercel 원격 프로젝트/운영 alias는 재조회하지 않았다. 원격 배포 상태가 이번 로컬 코드와 같다고 가정하지 않는다.
- 기존 CLI의 `NOTION_API_TOKEN`, `NOTION_TEST_PARENT_PAGE_ID`는 소스상 이름과 사용 구조만 확인했다. .env·실제 토큰·프로세스 비밀 값은 읽지 않았다.
- 011 제안은 target review 본문에 설계/부모 ID를 포함했지만, 최신 013 요구에 따라 연결 검증은 저장 설계와 분리하고 **POST 본문을 빈 객체로 제한**했다. 실행 단계의 설계/해시 결합은 014 이후 별도 책임이다.

## 3. 변경 파일

프로젝트 루트: `/Users/jsy/Desktop/EST_Project`.

신규 코드·테스트:

- `api/notion/test-connection.mjs`: GET 진입점. 원격 활성화하지 않음.
- `api/notion/test-target/review.mjs`: POST 진입점. 원격 활성화하지 않음.
- `server/notion/test-configuration.mjs`: 단일 승인 사용자·Workspace·Bot·부모·개인 테스트 범위·토큰 설정 검사.
- `server/notion/test-readonly.mjs`: 고정 GET 두 종류만 갖는 격리 어댑터.
- `server/notion/test-connection.mjs`: 인증·Origin·입력·연결 상태·안전한 오류 응답.
- `js/notion-test-connection.mjs`: 명시적 상태 확인·대상 읽기 UI와 요청/계정/설계 상태 격리.
- `scripts/notion-poc/tests/notion-test-connection.test.mjs`: 신규 검사 45개.

기존 수정:

- `js/notion-preview.mjs`: 기존 패널에 연결 상태 모듈 추가, 계정 정리 연동.
- `css/drafts.css`: 연결 영역에 한정한 반응형 스타일.
- `scripts/deployment/build-static.mjs`: 브라우저 모듈 1개 추가, 공개 자원 31→32개.
- `scripts/development/serve-review.mjs`: 두 API 로컬 라우팅·주입 추가.
- `scripts/notion-poc/tests/admin-ui.test.mjs`, `scripts/notion-poc/tests/notion-preview.test.mjs`: 공개 자원 개수 32로 수정. 검사 삭제·비활성화 없음.

문서: `docs/research/NB-V2-013_REPORT.md`, `docs/chat-handoff/NB-V2-013_CHATGPT_HANDOFF.md`.

## 4. 서버 설정과 격리

다음은 **향후 사용할 이름만 정의**했다. 실제 값을 등록하거나 출력하지 않았다.

| 이름 | 용도 |
|---|---|
| PPLUS_NOTION_TEST_USER_ID | 허용된 Supabase 사용자 UUID 1개 |
| PPLUS_NOTION_TEST_WORKSPACE_ID | 승인된 개인 Workspace ID 1개 |
| PPLUS_NOTION_TEST_BOT_ID | 승인된 Integration/Bot ID 1개 |
| PPLUS_NOTION_TEST_PARENT_PAGE_ID | 승인된 기존 비공개 테스트 페이지 ID 1개 |
| PPLUS_NOTION_TEST_SCOPE | 서버의 개인·비공개 테스트 범위 표식 |
| PPLUS_NOTION_TEST_TOKEN | 서버 전용 자격 증명 |

기존 CLI 변수와 분리했다. UUID는 서버에서 정규화하고 URL/임의 경로를 ID로 받지 않는다. Supabase Auth가 확인한 사용자 UUID만 비교하며 이메일·user_metadata·관리자 역할은 사용하지 않는다. 다른 사용자면 다른 Notion 설정·토큰을 읽기 전에 403으로 거절한다. 승인 사용자 자체가 미설정이면 인증된 사용자도 설정 미완료로 차단한다.

Workspace/Bot/부모는 실제 GET 응답과 서버 allowlist를 비교한다. Workspace 이름을 권한이나 개인/회사 판정 근거로 사용하지 않는다. allowlist에 등록할 공간이 개인 공간인지 사용자가 먼저 확인해야 하며, 회사 공간을 승인 대상으로 넣어서는 안 된다.

**설정이 존재해도 기본 원격 요청은 차단된다.** API entrypoint는 `allowNotionNetwork`를 활성화하지 않고 Notion fetch도 전달하지 않는다. 환경변수나 브라우저 요청만으로 원격 읽기를 켤 수 없다. 테스트에서만 모의 어댑터와 명시적 factory 옵션으로 경로를 검증했다. 후속 실제 검증은 승인된 로컬 실행 구성에서만 별도 opt-in해야 한다.

## 5. API 계약

### GET /api/notion/test-connection

- query/body 없음. GET의 Content-Length·Transfer-Encoding 본문도 거절.
- Origin·Bearer 검증 후 Supabase `/auth/v1/user`로 사용자 재검증.
- 승인 사용자와 모든 서버 설정을 검사한다.
- 설정 준비 여부만 응답한다. 이 API 자체의 Notion 요청은 항상 0건이다.
- 설정 준비됨은 실제 연결·토큰 유효성·읽기/쓰기 권한 검증이 아니다.

### POST /api/notion/test-target/review

- `Content-Type: application/json`, 본문은 `{}`만 허용. query 없음. 최대 256바이트.
- 페이지 ID·URL·API path·user_id·configuration·토큰·승인 플래그를 받지 않는다.
- 동일한 인증/설정 검사 후, 원격 opt-in과 주입된 어댑터가 모두 있어야 고정 읽기를 진행한다.
- 기본 상태는 503 `notion_remote_read_disabled`, Notion 호출 0건이다.
- 향후 허용된 경우 GET `/v1/users/me` → Bot/Workspace 일치 → GET `/v1/pages/{고정 허용 부모}` 순서다. 최대 2건, 자동 재시도·검색·사용자 목록·조상/자식/행 조회 없음.

어댑터는 Notion 호스트와 두 경로만 사용한다. 일반 request/path 또는 쓰기 메서드를 노출하지 않는다. 리다이렉트 거절, 응답 128KiB 제한, 요청별 8초 제한, 캐시 금지를 적용한다. 429를 포함해 실패 시 자동 재시도하지 않는다.

응답에는 connectionVersion, API 버전, connectionStatus, remoteReadEnabled, targetReadVerified, 안전한 오류 코드와 요청 횟수만 포함한다. 검증 성공 시 승인 대상 식별자·서버가 만든 정규 페이지 링크·제한 사항을 해당 소유자에게만 반환한다. 제목·멤버·페이지 내용·원격 오류 본문·헤더·자격 증명은 반환하지 않는다.

항상 webExecutionReady=false, notionExecution=not_executed, notionWrites=0, supabaseWrites=0, targetVerified=false, creationPermissionVerified=false, privacyVerified=false다. `targetReadVerified`는 제한된 읽기 확인에만 쓰며 생성 승인과 구분한다. 모의 성공은 notionRequests=2지만 실제 이번 Notion API 요청은 0건이다.

모든 응답은 private/no-store, CDN/Vercel CDN no-store, Vary Authorization/Origin, nosniff다. CORS 허용 범위를 추가하지 않았다.

## 6. 대상 상태와 오류

고정 페이지 ID 일치, in_trash/archived, 공개 게시 상태, 일반 페이지 부모 구조를 검사한다. 잠금 true는 거절하고, 잠금 필드가 없으면 false로 가정하지 않고 unknown과 제한 안내를 반환한다. `public_url=null`은 웹 게시 안 됨의 증거일 뿐 전체 공유 ACL의 비공개 증명이 아니다. 읽기 성공을 쓰기 capability로 판정하지 않는다.

| 원인 | 로컬 API 상태/코드 |
|---|---|
| PPLUS 세션 없음/무효 | 401 auth_required / invalid_session |
| 승인 UUID 아님 | 403 test_user_not_allowed |
| 설정 누락·형식 오류 | 503 test_connection_not_configured |
| 원격 읽기 비활성 | 503 notion_remote_read_disabled |
| Notion 401 | 502 notion_unauthorized; PPLUS 재로그인 오류와 구분 |
| Notion 403 / 404 / 429 | 403 notion_access_denied / 404 notion_target_not_found / 429 notion_rate_limited |
| Notion 5xx·리다이렉트·통신 오류 | 502 notion_unavailable |
| Bot/Workspace/부모 ID 불일치 | 403의 별도 mismatch 코드 |
| 보관·휴지통 / 잠금 / 지원하지 않는 부모 | 410 / 423 / 422 |

## 7. UI

기존 index/mapping/result의 생성 계획 패널 안에 ‘개인 Notion 테스트 연결’ 영역만 추가했다. 기본은 미확인이고 ‘연결 상태 확인’을 눌러 GET 결과를 확인한다. 미설정, 대상 아님, 설정 준비, 실패를 구분한다. 서버가 원격 읽기 가능 상태를 반환할 때만 ‘읽기 전용 대상 확인’이 나타나며, 현재 기본 서버에서는 숨겨진다. 생성·OAuth·실행 승인 버튼은 없다.

요청 순번·취소·인증 사용자 재확인·workspace 구독으로 늦은 응답을 버린다. 설계 전환/편집 시 연결 상태는 미확인으로 초기화되고 기존 계획 검토 결과도 기존 012 방식으로 제거된다. 로그아웃 시 DOM·요청·구독을 정리한다. 사용자 입력과 원격 오류 메시지를 HTML로 삽입하지 않는다.

## 8. 테스트와 실제 확인

최종 실행: `node --test --test-concurrency=1 scripts/notion-poc/tests/*.test.mjs`.

**407개 통과 / 실패·건너뜀 0**: 기존 362개 + 신규 45개. V1 256조합도 이 전체 검사에 포함되어 통과했다. 공개 빌드 32개, 구문 검사, diff 공백 검사, 서버/설정/CLI/.env/문서 비공개 경로 404를 확인했다. 원본 JPEG는 HEAD와 바이트 해시가 일치한다.

모의 검사는 승인 UUID·관리자 B 거절·토큰 누락·다른 Workspace/Bot/부모·잠금/보관/삭제/게시·Notion 오류·큰/잘못된 JSON·임의 ID/URL/경로 주입·기본 원격 차단·GET만·지연 응답/계정/설계/로그아웃 정리를 검증했다. 실제 Notion 응답으로 표시하지 않는다.

실계정 읽기:

- 8796을 기존 브라우저 세션을 유지한 채 새 로컬 서버로 재시작했다. 서버에는 기존 공개 Supabase 설정만 메모리로 전달하고 Notion 설정은 전달하지 않았다.
- 본인 세션으로 GET 연결 상태에서 ‘개인 Notion 연결 미설정’ 확인. 실제 Notion 연결 성공이 아니다.
- 기존 확장형 ‘NB-V2-010A 저장 테스트 A’: index/mapping에서 6DB·속성36·관계8쌍·Rollup2·Formula3 및 기존 두 해시 일치 확인.
- 기존 기본형 ‘NB-V2-010A 저장 테스트 B’: 1DB·속성4·관계/계산0 확인.
- 기존 ‘NB-V2-006 E2E’도 화면에 기본형으로 표시됨을 확인했다. 접근한 세 테스트 설계 중 일반형이 없어 실제 일반형 검토는 하지 않았다. 새 설계 생성·기존 저장 버튼 사용 없음.
- A→B 전환에서 이전 결과와 연결 상태 초기화 확인. 이는 같은 사용자의 설계 격리이며 두 사용자 격리 증거가 아니다.
- mapping에서 Chrome 390×844, 360×780 반응형 화면의 새 연결 안내·버튼·미리보기 줄바꿈을 직접 확인했다. 캡처 범위에 겹침/가로 잘림이 보이지 않았다. 실제 모바일 기기·scrollWidth 수치 검사는 하지 않았다.
- QA 서버 종료 시 주입된 Notion 어댑터 호출 카운터 **0**을 확인했고, 마지막 GET 경계 보완 코드를 반영한 차단 서버를 다시 8796에 실행했다. 8795는 유지했다.
- 비밀번호·JWT·쿠키·실제 Notion 토큰을 추출하거나 출력하지 않았다.

캡처 6개(JPEG 전체 Chrome 창 2940×1666; 모바일은 창 안의 에뮬레이션):

`/Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/`

- index-unconfigured-extended-desktop.jpg
- mapping-extended-support-desktop.jpg
- mapping-390x844-support.jpg
- mapping-390x844-unconfigured.jpg
- mapping-360x780-unconfigured.jpg
- basic-existing-draft-desktop.jpg

## 9. 미검증과 보존

실제 Notion identity/페이지/토큰 유효성·권한·에러는 전부 미검증이다. 실제 승인 UUID 설정도 하지 않아 실계정 승인 대상/다른 사용자 비교는 미실행이다. 두 계정·로그아웃 중 지연 상태는 모의 검사만 통과했다. 일반형 실계정, 실제 모바일, Vercel 원격 빌드/런타임도 미검증이다. result 화면의 이번 UI 변경은 자동 검사로 확인했고 이번 시각 검증은 index/mapping에서 수행했다.

기존 관리자 handler에는 별도 로컬 연결 설정을 주입하지 않아 실제 관리자 버튼 QA로 판정하지 않았다. 관리자·Auth·저장·매핑·CLI 회귀는 자동 검사에서 통과했다. 기존 Auth·RLS·schema/configuration/plan version·CLI/manifest/중복 방지 코드는 변경하지 않았다.

Supabase 업무 데이터 쓰기·정책 변경0, Notion API 요청/쓰기0, Git commit/push0, Vercel 조회/배포/설정 변경0이다. 원격 전체 로그를 감사했다는 뜻은 아니며, 이번 수행 동작·읽기 전용 코드·모의 메서드 강제 검사·로컬 어댑터 카운터에 대한 기록이다. 공식 개발자 문서 조회는 Notion 업무 API 호출과 별개다.

## 10. 실제 연결 준비 절차와 별도 승인 요청서 — 미승인·미실행

사용자 요청 9절에 따라 A/B까지만 완료하고 다음 요청서를 남긴 뒤 중지한다.

1. **먼저 확정할 대상:** 본인 Supabase 테스트 UUID 1개, 개인 Workspace 1개, Bot 1개, 기존 비공개 테스트 부모 페이지 1개. 실제 값은 아직 이 기능에 설정하지 않았다. 회사 공간·다른 사용자·기존 개인 토큰의 공용 사용은 제외한다.
2. **권한 확인:** 사용자가 Notion에서 해당 부모의 비공개/공유 대상과 지정 연결의 읽기 접근을 직접 확인한다. 페이지 생성·공개 공유·초대·권한 확장은 이 요청서 범위에 포함하지 않는다. 준비가 안 되어 있으면 별도 범위를 먼저 확정한다.
3. **요청할 설정:** 위 여섯 서버 설정을 로컬에서만 제공한다. 사용자가 보안 입력 수단으로 토큰을 직접 넣고 에이전트는 원문을 수집하지 않는다. 채팅·명령행 인수·Git·보고서에 값을 기록하지 않는다. 실제 토큰의 생성/교체는 포함하지 않는다.
4. **요청할 활성화:** 승인된 한 번의 로컬 읽기 검증에만 factory의 원격 opt-in과 실제 fetch를 제공한다. 배포 API entrypoint의 기본 차단은 유지한다. 설정만으로 활성화됐다고 가정하지 않는다.
5. **허용 요청:** GET /v1/users/me 최대1회 + Bot/Workspace 일치 시 고정 부모 GET 최대1회. 총 최대2회, 불일치/오류 시 중지. 재시도·추가 탐색·조상·자식·DB·행 조회0, 쓰기0.
6. **노출/변경 영향:** Notion으로 자격 증명과 고정 부모 ID가 정상 인증 요청에 사용된다. Supabase는 현재 사용자 인증 GET만 한다. 업무 데이터·Git·Vercel·Supabase 설정은 변경하지 않는다.
7. **종료/되돌리기:** 로컬 opt-in 서버 종료, 임시 로컬 자격 증명 제거, 차단 서버로 복귀. 객체가 생성되지 않으므로 Notion 삭제·롤백 없음.
8. **승인 조건:** 실제 개인 대상 식별자와 로컬 보안 입력 방법을 먼저 확정한 후, 위 설정·최대2회 읽기에 대해 별도 명시적 승인을 받는다. 이 문서 작성이나 이전 CLI 승인을 실제 연결 승인으로 간주하지 않는다.

**현재는 대상 값이 미확정이고 승인도 없으므로 어떤 실제 연결도 실행하지 않는다.** NB-V2-014는 이 읽기 확인 외에도 영구 run/step 기록, 원자적 승인·소유권·중복 방지·부분 실패 재확인 설계와 별도 쓰기 승인이 준비된 뒤에만 진행한다.

## 11. 공식 근거

- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser): 서버가 Auth로 사용자를 확인하는 기존 경로를 재사용했다. Supabase changelog.md는 웹 도구의 markdown 형식 제한으로 열리지 않았으며, 이번에는 SDK/API 계약·Auth 정책을 변경하지 않았다.
- [Notion token owner](https://developers.notion.com/reference/get-self): 고정 users/me 읽기 경로.
- [Notion User](https://developers.notion.com/reference/user): Bot 식별자와 bot의 workspace_id 비교 근거. 이름은 권한 근거로 사용하지 않는다.
- [Notion Retrieve page](https://developers.notion.com/reference/retrieve-a-page), [Page object](https://developers.notion.com/reference/page): 고정 페이지 조회와 in_trash/archived/public_url의 의미. 확인한 Page 필드 표는 잠금 필드의 항상 반환을 보장하지 않아 누락은 unknown으로 처리했다. 비공개 전체 ACL·쓰기 권한은 별도 확인 사항이다.
