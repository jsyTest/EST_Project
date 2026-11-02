# [ChatGPT 전달용] NB-V2-013 개인 Notion 테스트 연결 로컬 구현 결과

## 1. 결과 판정

**A. 로컬 연결 코드·모의 검사 완료, B. 실제 연결 준비 절차 문서화 완료입니다. C. 실제 연결은 승인 요청서만 작성하고 실행하지 않았습니다.**

- 로컬 구현 완료: 고정 개인 테스트 연결 API 2개, 서버 설정 검사·격리 읽기 어댑터, 기존 패널의 연결 상태 UI.
- 모의 검사 완료: 신규 45개를 포함해 전체 Node **407개 통과**, 실패·건너뜀 0. 기존 V1 256조합도 포함되어 통과.
- 실제 계정 읽기 확인: 기존 본인 Supabase 세션으로 연결 미설정 응답과 기본형·확장형 저장본 미리보기 확인.
- Notion 원격 미검증: 실제 토큰 조회·생성·설정과 Notion API 호출 모두 0건.
- 실제 Notion 쓰기 미실행: 생성·수정·삭제 0건.
- 운영 배포 미실행: Git commit/push·Vercel 배포/설정 변경 0건.

현재 상태를 ‘Notion 연결 완료’나 ‘Notion 생성 성공’으로 판단하면 안 됩니다.

## 2. Git과 기존 작업 보존

브랜치는 main, 시작·종료 HEAD는 `0ed8d36c4549dd775c36f11bf3368f6eca8181df`입니다. 시작 작업 트리는 깨끗했습니다.

직전 NB-V2-012 보고의 미커밋 15개 파일은 이후 위 커밋에 포함되어 있었습니다. 이번에는 그 추적 상태와 구현을 보존했으며 초기화·checkout/reset/clean·커밋·push하지 않았습니다.

종료 변경은 기존 6파일 수정, 신규 코드/테스트 7파일, 문서 2파일이며 미커밋 상태입니다.

## 3. 변경 파일

신규:

- /Users/jsy/Desktop/EST_Project/api/notion/test-connection.mjs
- /Users/jsy/Desktop/EST_Project/api/notion/test-target/review.mjs
- /Users/jsy/Desktop/EST_Project/server/notion/test-configuration.mjs
- /Users/jsy/Desktop/EST_Project/server/notion/test-readonly.mjs
- /Users/jsy/Desktop/EST_Project/server/notion/test-connection.mjs
- /Users/jsy/Desktop/EST_Project/js/notion-test-connection.mjs
- /Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-test-connection.test.mjs

수정:

- /Users/jsy/Desktop/EST_Project/js/notion-preview.mjs
- /Users/jsy/Desktop/EST_Project/css/drafts.css
- /Users/jsy/Desktop/EST_Project/scripts/deployment/build-static.mjs
- /Users/jsy/Desktop/EST_Project/scripts/development/serve-review.mjs
- /Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/admin-ui.test.mjs
- /Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-preview.test.mjs

저장 문서:

- /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-013_REPORT.md
- /Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013_CHATGPT_HANDOFF.md

## 4. 인증·설정·원격 차단

Supabase Auth의 현재 사용자 UUID를 서버에서 확인하고 승인된 UUID 1개와 비교합니다. 관리자 역할·이메일·user_metadata·클라이언트 user_id는 허용 근거가 아닙니다. 다른 사용자는 Notion 토큰을 읽기 전에 403으로 거절합니다. 승인 사용자 설정이 없으면 모두 설정 미완료로 차단합니다.

향후 설정할 서버 변수 이름만 정의했습니다. 실제 값은 설정하거나 출력하지 않았습니다.

- PPLUS_NOTION_TEST_USER_ID
- PPLUS_NOTION_TEST_WORKSPACE_ID
- PPLUS_NOTION_TEST_BOT_ID
- PPLUS_NOTION_TEST_PARENT_PAGE_ID
- PPLUS_NOTION_TEST_SCOPE
- PPLUS_NOTION_TEST_TOKEN

기존 CLI의 NOTION_API_TOKEN/NOTION_TEST_PARENT_PAGE_ID를 자동 재사용하지 않습니다. 실제 .env·토큰 값은 읽지 않았습니다. 서버 allowlist에는 개인 공간으로 사전 확인한 Workspace/Bot/비공개 부모만 넣어야 합니다. Workspace 이름으로 회사 여부를 추측하지 않습니다.

**설정이 있어도 기본 API는 Notion 네트워크를 호출하지 않습니다.** 두 entrypoint는 원격 허용 옵션과 실제 Notion fetch를 주입하지 않습니다. 환경변수·브라우저 입력만으로 원격 기능을 켤 수 없습니다. 모의 테스트에서만 명시적 factory 옵션과 모의 어댑터를 사용했습니다.

## 5. 신규 API 계약

### GET /api/notion/test-connection

query/body 없이 요청합니다. Bearer·Origin·Supabase 사용자·승인 UUID·서버 설정을 확인하고 ‘설정 준비 여부’만 반환합니다. 이 API의 Notion 요청은 항상 0건입니다. 설정 준비됨은 토큰 유효성이나 실제 연결 성공이 아닙니다.

### POST /api/notion/test-target/review

application/json의 빈 객체 {}만 받습니다. query·부모 ID·URL·API 경로·토큰·configuration·user_id·승인 플래그를 거절합니다. 입력은 256바이트로 제한합니다.

기본 상태에서는 notion_remote_read_disabled로 중지합니다. 향후 별도 승인된 로컬 opt-in에서만 다음 두 GET을 순서대로 수행할 수 있습니다.

1. 고정 /v1/users/me → 승인된 Bot ID·Workspace ID 일치 확인.
2. 고정 허용 부모 /v1/pages/{서버 부모 ID} → 페이지 ID·보관/휴지통·잠금·게시 상태 확인.

최대 2회이고 검색·사용자 목록·다른 페이지·조상·자식·DB·행을 조회하지 않습니다. 쓰기 메서드와 일반 request(path) 인터페이스가 없습니다. 리다이렉트·무한 재시도를 허용하지 않으며 요청별 8초, 응답 128KiB를 제한합니다.

011의 초기 제안에 있던 설계/부모 입력은 최신 013 요구에 맞게 제거했습니다. 저장 설계 검토 API는 기존대로 별도 유지하고, 실제 실행 단계의 설계·해시·승인 결합은 후속 작업입니다.

## 6. 반환 상태와 한계

모든 응답은 private/no-store 및 CDN no-store입니다. 토큰·환경변수 값·Authorization·페이지 제목/내용·원격 오류 상세는 노출하지 않습니다.

항상 다음 상태를 유지합니다:

    webExecutionReady: false
    notionExecution: "not_executed"
    notionWrites: 0
    supabaseWrites: 0
    targetVerified: false
    creationPermissionVerified: false
    privacyVerified: false

targetReadVerified는 제한된 읽기 확인만 의미합니다. 모의 읽기 성공의 notionRequests=2는 모의 어댑터 호출 수이며 실제 Notion API 호출이 아닙니다.

Notion 401은 PPLUS 세션 오류와 구분해 502 notion_unauthorized로, 403·404·429는 각각 별도 안전한 코드로 반환합니다. 5xx/통신/리다이렉트는 502, 식별자 불일치는 403, 보관·휴지통은 410, 잠금은 423으로 구분합니다. 자동 재시도하지 않습니다.

잠금 필드가 없으면 잠금 없음으로 가정하지 않고 unknown을 표시합니다. public_url=null은 웹 게시 안 됨의 증거이며 전체 공유 권한의 비공개 증명은 아닙니다. 읽기 성공은 향후 생성 권한의 증명이 아닙니다.

## 7. UI와 회귀

기존 Notion 생성 계획 패널에 ‘개인 Notion 테스트 연결’ 영역과 ‘연결 상태 확인’을 추가했습니다. 미확인·미설정·대상 아님·서버 설정 준비·확인 실패를 구분합니다. 원격 기능이 실제로 허용된 서버 응답에서만 읽기 전용 대상 확인 버튼이 나타납니다. 현재 기본 서버에서는 숨겨집니다.

생성·OAuth·실행 승인 버튼은 없습니다. 연결 확인 실패는 기존 설계 편집·검토를 막지 않습니다. 요청 순번·취소·계정 재확인·workspace 구독으로 지연된 결과를 버리고, 계정/로그아웃 시 내용을 제거합니다. 설계 변경 시 연결 상태도 미확인으로 초기화합니다.

기존 인증·관리자 권한·교육 설계 저장·매핑·색상·Planner·version 1·CLI/manifest/중복 방지 코드는 변경하지 않았습니다.

최종 검사:

    node --test --test-concurrency=1 scripts/notion-poc/tests/*.test.mjs

**407/407 통과**, 기존 362개 + 신규 45개입니다. V1 256조합, 기존 API 계약, 관리자/저장/매핑/CLI 회귀도 포함됩니다. 신규 검사는 UUID·비밀 누락·식별자 불일치·페이지 상태·Notion 오류·주입·기본 원격 차단·지연 응답·로그아웃을 다룹니다. 실제 Notion 검증으로 표시하지 않습니다.

공개 빌드는 31→32개이며 추가 공개 파일은 브라우저 연결 UI 모듈 하나입니다. 서버 설정/어댑터·CLI·.env·문서는 공개되지 않습니다. 로컬 HTTP 비공개 경로 404, JS 구문 검사, git diff --check, 원본 JPEG 일치 검사를 통과했습니다.

## 8. 실제 Supabase 읽기·Chrome 검증

[로컬 화면](http://127.0.0.1:8796/index.html)에서 기존 본인 세션을 재사용했습니다. 서버에는 기존 공개 Supabase 설정만 메모리로 전달하고 Notion 설정은 넣지 않았습니다. 실제 토큰을 읽거나 설정하지 않았습니다.

이번 실제 확인:

- 연결 상태 GET: ‘개인 Notion 연결 미설정’ 표시. 실제 연결 성공 아님.
- 기존 확장형 ‘NB-V2-010A 저장 테스트 A’: index/mapping에서 6DB·속성36·관계8쌍·Rollup2·Formula3, 기존 두 해시 일치.
- 기존 기본형 ‘NB-V2-010A 저장 테스트 B’: 1DB·속성4·관계/계산0.
- 세 번째 기존 ‘NB-V2-006 E2E’도 화면에 기본형으로 표시됨을 확인. 이번에 접근한 본인 테스트 목록에 일반형은 없어 새 데이터를 만들지 않았습니다.
- A→B 설계 전환 시 이전 계획 결과·연결 상태 제거 확인. 같은 사용자의 설계 전환이며 두 사용자 격리 증거가 아닙니다.
- mapping.html에서 Chrome 390×844 및 360×780 반응형 캡처 확인. 새 연결 안내·버튼·계획 카드가 캡처 범위에서 겹치거나 가로로 잘리지 않았습니다.
- QA 서버 종료 시 Notion 어댑터 호출 카운터 0을 확인했습니다. 이후 최신 코드의 차단 서버를 8796에 다시 실행했고 기존 8795도 유지했습니다.

비밀번호·JWT·쿠키를 추출하거나 출력하지 않았습니다. 실제 계정의 업무 데이터 저장·수정·삭제도 하지 않았습니다.

캡처 6장은 다음 디렉터리에 있습니다. 모두 전체 Chrome 창 JPEG 2940×1666px이며, 모바일 파일은 창 안의 에뮬레이션을 보여줍니다.

/Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/

- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/index-unconfigured-extended-desktop.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/mapping-extended-support-desktop.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/mapping-390x844-support.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/mapping-390x844-unconfigured.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/mapping-360x780-unconfigured.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-013/basic-existing-draft-desktop.jpg

## 9. 미검증·원격 변경 여부

- 실제 Notion 토큰 유효성·Bot/Workspace/부모 일치·읽기 권한·실제 오류: 전부 미검증.
- 승인 UUID를 실제로 설정하지 않아 실계정 허용/다른 사용자 거절 비교는 미실행이며 모의 검사만 통과했습니다.
- 일반형 실계정, 실제 서로 다른 사용자, 실제 로그아웃 중 지연 결과: 미검증.
- 실제 모바일 기기·scrollWidth 수치 측정, result 화면의 이번 추가 영역 시각 검토: 미실행. result 통합은 자동 검사로 확인했습니다.
- 로컬 관리자 handler에는 별도 연결 설정을 주입하지 않아 관리자 버튼 실사용 QA로 판정하지 않았습니다. 기존 자동 회귀는 통과했습니다.
- Vercel 운영 alias/배포 상태는 이번에 재조회하지 않았으며 원격 빌드·런타임도 미검증입니다.
- Supabase SQL·RLS·Auth 정책·역할·업무 데이터 변경0, Notion API 요청/쓰기0, Git commit/push0, Vercel 조회/배포/설정 변경0입니다.

요청 0건 기록은 이번 수행 동작·코드 차단·모의 검사·로컬 어댑터 카운터의 근거입니다. 원격 전체 로그를 감사했다는 뜻은 아닙니다. 공식 개발자 문서 조회는 업무 API 호출과 별개입니다.

## 10. 별도 승인 요청서 — 현재 미승인·미실행

사용자 요청 9절에 따라 이번에는 A/B까지만 수행하고 이 요청서를 작성한 뒤 중지합니다.

1. 대상: 사용자가 확인한 본인 Supabase UUID 1개·개인 Workspace 1개·Bot 1개·기존 비공개 테스트 부모 1개. 실제 대상 값은 아직 이 기능에 확정·설정하지 않았습니다. 회사 공간과 다른 사용자 공간은 제외합니다.
2. 선행 확인: 사용자가 부모의 비공개 공유 범위와 지정 연결의 읽기 접근을 직접 확인해야 합니다. 페이지 생성·공개 공유·초대·새 권한 부여는 이 승인 요청에 포함하지 않습니다.
3. 설정 요청 범위: 위 여섯 서버 설정을 로컬에서만 제공합니다. 사용자가 보안 입력 수단으로 토큰을 직접 넣고, 에이전트는 원문을 수집하지 않습니다. 값은 채팅·명령행 인수·Git·보고서에 기록하지 않습니다. 토큰 신규 발급/교체는 포함하지 않습니다.
4. 활성화 요청 범위: 한 번의 승인된 로컬 실행에서만 실제 fetch와 원격 opt-in을 주입합니다. 배포 API entrypoint의 기본 차단은 유지합니다.
5. 원격 요청 상한: users/me GET 1회와 일치 시 고정 부모 GET 1회, 총 최대 2회입니다. 오류·불일치 시 중지하며 자동 재시도·추가 탐색·쓰기를 하지 않습니다.
6. 영향: Notion에 자격 증명과 고정 부모 ID가 정상 인증 요청으로 전달됩니다. Supabase는 현재 사용자 인증 GET만 사용합니다. 업무 데이터·Git·Vercel·Supabase 설정 변경은 없습니다.
7. 종료: 임시 opt-in 서버를 종료하고 로컬 자격 증명을 제거한 뒤 차단 서버로 복귀합니다. Notion 생성물이 없어 삭제·롤백은 없습니다.
8. 승인 조건: 정확한 개인 대상 식별자와 로컬 보안 입력 방법을 먼저 확정한 뒤 위 설정·최대2회 읽기에 대한 별도 명시적 승인을 받아야 합니다. 이 문서나 이전 CLI 승인을 현재 연결 승인으로 간주하지 않습니다.

현재 대상 값이 미확정이고 별도 승인도 없으므로 실제 연결을 실행하지 않습니다.

## 11. 공식 근거와 ChatGPT의 다음 판단 요청

서버 사용자 재검증은 [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)의 기존 경로를 재사용했습니다. Bot/Workspace 식별은 [Notion token owner](https://developers.notion.com/reference/get-self)와 [User object](https://developers.notion.com/reference/user), 페이지 상태와 게시 여부는 [Retrieve page](https://developers.notion.com/reference/retrieve-a-page)와 [Page object](https://developers.notion.com/reference/page)를 참고했습니다. 잠금 필드 누락은 확인된 것으로 추정하지 않습니다.

ChatGPT는 다음을 검토하고 다음 작은 작업을 결정해 주세요.

1. 단일 승인 사용자·고정 Workspace/Bot/부모·기본 원격 차단 구조가 적절한가요?
2. 설정 준비, 제한된 읽기 확인, 전체 비공개 ACL, 생성 권한을 정확히 구분했나요?
3. 실제 Supabase 기본형/확장형 읽기와 모의 Notion 검증을 분리해 평가해 주세요.
4. 실제 두 사용자 격리·일반형 저장본 QA를 먼저 보완할지, 위 승인 요청의 대상 확정부터 할지 결정해 주세요.
5. 실제 토큰 설정·최대2회 읽기는 별도 승인 작업으로 유지해 주세요.
6. NB-V2-014는 연결 확인 외에도 영구 run/step 기록, 원자적 승인, 소유권·동시 실행 제어, 중복 생성 방지, 불확실 응답·부분 실패 복구가 준비된 뒤에만 진행하도록 범위를 정해 주세요.

완료·모의 확인·실계정 확인·미검증을 구분하고, 이번 결과를 실제 Notion 연결·생성 또는 운영 배포 성공으로 판단하지 마세요.
