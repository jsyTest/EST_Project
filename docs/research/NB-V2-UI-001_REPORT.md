# [NB-V2-UI-001 작업 보고서]

## 결과와 승인 이력

로그인·회원가입 UX와 서버 권한 확인 기반 관리자 화면을 구현하고, 사용자의 후속 승인에 따라 Production 배포·본인 계정 관리자 부여·서버 변수 Production 적용을 완료했다. 사용자가 운영 주소에서 관리자 화면과 본인 정보가 표시됨을 확인했다. 전체 회원 관리·통계 기능은 미연결이다.

초기 로컬 전용 요청의 배포·관리자 부여 금지는 이후 사용자 지시로 해당 범위에 한해 변경됐다. 비밀번호 정책은 일반적인 로컬 8자 안내만 사용했으며 원격 Auth 정책은 변경하지 않았다. Git commit·push는 하지 않았다.

## 시작·종료 Git

- 브랜치/HEAD: `main / 0a1884bbf9c7a988165a94da83d3a5558c96f20f`, 변경 구현 13.
- 시작 clean → 종료 추적 파일 14개 수정, 신규 구현·테스트 8개와 보고 문서 2개.
- 기존 변경을 삭제·재설정하지 않았고 미커밋 파일을 그대로 유지했다. `git diff --check` 통과.
- 배포는 Git push 없이 로컬 파일 스냅샷을 사용했다. 현재 HEAD는 배포 원본 전체를 나타내지 않는다.

## 조사와 변경 전후

기존 `login.html`에서 로그인·회원가입 모드를 전환하고 Supabase 이메일·비밀번호 인증을 사용한다. 정상 로그인 뒤 index로 이동하며 세션 유지·로그아웃·교차 탭 상태 처리를 갖고 있었다. 기존 회원가입만 8자 로컬 검증을 했고 로그인에는 강제 길이가 없었다. 기존 관리자 API·역할 구조·회원 목록·비밀번호 재설정 기능은 찾지 못했다.

‘인증 연결 다시 확인’은 지연/오류 때 새로고침하는 복구 기능이라 ‘다시 시도’로 유지했다. 반복되던 ‘노션 설계 도우미’ 제목·일부 AI 제목과 비밀번호 전송 기술 설명을 제거하고 PPLUS 브랜드와 로그인/회원가입 제목으로 정리했다. 위쪽 여백·카드 간격·모바일 패딩·포커스·비밀번호 표시 버튼을 보완했다.

이메일 공란·형식, 비밀번호 공란, 인증 실패, 일시적 서버 오류를 요청 문구로 분리했다. 가입 확인 불일치·약한 비밀번호는 입력칸 가까이 표시하고 중복 가입은 계정 존재를 단정하지 않는 안내를 사용한다. 사용자 추가 지시에 따라 가입 로컬 기준 8자와 문자·숫자 조합 권장을 안내하며 실제 서버가 더 엄격하면 오류를 안내한다.

## 수정·추가 파일

| 범위 | 파일 |
| --- | --- |
| 로그인·인증 | login.html, css/auth.css, js/auth-bootstrap.js, js/auth-core.js, js/auth.js |
| 기존 화면 스크립트 로딩 | index.html, mapping.html, result.html |
| 관리자 UI 신규 | admin.html, css/admin.css, js/admin-access.js, js/admin-ui.mjs |
| 서버 | api/admin/overview.mjs 신규, server/admin-overview.mjs 신규, server/supabase-readonly.mjs 확장 |
| 빌드·개발 서버 | scripts/deployment/build-static.mjs, scripts/development/serve-review.mjs, scripts/development/admin-demo.mjs 신규 |
| 테스트 | scripts/notion-poc/tests/admin-ui.test.mjs 신규, auth-ui-harness.mjs, auth-ui.test.mjs, server-review.test.mjs |
| 문서 | docs/research/NB-V2-UI-001_REPORT.md, docs/chat-handoff/NB-V2-UI-001_CHATGPT_HANDOFF.md |

## 권한 구조와 관리자 계정

새 GET `/api/admin/overview`는 요청 Bearer로 Supabase Auth `/auth/v1/user`를 호출해 사용자를 재검증하고 `app_metadata.pplus_role === admin`만 허용한다. 누락·다른 값은 user이며 user_metadata·이메일·query·저장소를 판정에 사용하지 않는다. 캐시 금지·Origin 검사·요청별 사용자 상태·원격 오류 비공개를 적용했다. 앱에는 기존 Publishable Key만 사용한다.

브라우저 버튼은 서버 승인 전 숨기고 계정 전환·로그아웃·늦은 응답을 정리한다. 관리자 페이지는 복귀·포커스에서 재검사한다. API는 항상 재검사하지만 열린 화면에 역할 변경을 실시간 push하지 않는다. admin.html 자체는 공개 정적 틀이어서 200이며 실제 내용과 데이터는 별도 권한 확인으로 보호한다.

사용자가 승인한 기존 계정 `j0819j0819@gmail.com`, UUID `7c34a2c6-56ae-4735-a832-5cc765c83694`의 역할 1건을 연결된 관리 도구의 제한 SQL로 변경했다. 정확한 UUID·이메일·기존 user 조건으로 raw_app_meta_data의 pplus_role 키만 jsonb_set하여 다른 값을 보존했고 admin 재조회를 확인했다. 새 계정·비밀번호 변경·Auth DB role 변경·다른 사용자 변경은 없다. 브라우저에 관리자 키나 역할 변경 API를 추가하지 않았다.

## 관리자 화면의 실제 범위

대시보드 카드·회원 관리 컬럼·검색/필터 UI·이용 현황·본인 계정 설정을 구현했다. 전체 회원 목록·설계 통계·오류/실행 이력은 연결하지 않아 ‘— / 추후 연결 예정’으로 표시한다. 목록 미연결 시 검색/필터도 비활성이며 역할 관리 버튼·계정 삭제/정지는 구현하지 않았다. Notion 웹 생성은 미구현, CLI는 별도 기능으로 안내한다.

처음 만든 가상 회원 3명·설계 6개 로컬 시연은 loopback 개발 서버에서만 선택적으로 제공한다. 실제 관리자 페이지의 query 우회는 없고 가상 시연 코드·라우트는 운영 업로드·공개 빌드에서 제외했다. 운영 `/__demo/admin.html`은 404다.

## 운영 설정·배포

- 대상: PPLUS 팀 `team_gDF3LRSavShTKMmlQTNwqH51`, pplus 프로젝트 `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n`.
- 기존 Production: `dpl_9xoqEynHC26CdK5C5s8gZDnnTt5z`.
- 새 Production: `dpl_GWwBGn1zgRPeauqHZtFi1Bq3deSo`, **READY**, `https://pplus-rouge.vercel.app` 연결 확인.
- 불변 배포 주소: `https://pplus-48kmvpbyp-pplus1.vercel.app` — 기존 배포 보호 설정 적용 가능. 발표는 기존 운영 주소 사용.
- 기존 SUPABASE_URL·SUPABASE_PUBLISHABLE_KEY 두 변수의 target만 preview → preview+production으로 수정·재조회. 값 출력·변경, 새 키 발급 없음.
- vercel.json 유지: Node 24.x 프로젝트, build-static.mjs, public-dist. 배포 소스 42개/727,599 bytes, 공개 출력 30개. 소스 스냅샷 SHA-256 `3fc73f4341bc7e42d87b3c5680c07eb7f6185efacbd83e7d63538997df77aef6`.
- 소스·자산은 inline 파일 API로 업로드했다. 빌드 완료·도메인 연결·파일 일치 확인. Preview 배포·보호 설정 변경·CLI/의존성 설치 없음.

## 테스트와 운영 QA

| 구분 | 결과 |
| --- | --- |
| 전체 Node | 319/319, 기존 295 + 신규 24, 실패·취소·생략 0 |
| 최종 소규모 UI 보완 | 관련 24개 재통과 |
| V1 Mock | 256조합 통과 |
| 신규 권한 회귀 | 기본/위조 역할·일반 사용자 거절·admin 허용·역할 회수·동시 사용자·늦은 응답·로그아웃 등을 모의 Auth/DOM로 검증 |
| 공개 빌드 | 30개 allowlist, 내부 문서·서버·실행기·환경·가상 시연 제외 |
| 운영 공개 자원 | 30개 전부 200, 로컬 소스 SHA-1 일치 |
| 운영 비공개/미등록 경로 | server/admin-overview.mjs, scripts/development/admin-demo.mjs, 인계문, .env, __demo/admin.html, api/admin/unknown 모두 404 |
| 운영 관리자 API | 무인증 401 auth_required, 가짜 토큰 401 invalid_session, 외부 Origin 403, POST 405; Cache-Control private,no-store |
| 운영 기존 review API | 무인증 401, 가짜 토큰 401 invalid_session. 이전 server_not_configured 503 해소 확인 |
| 실제 계정 | 사용자가 운영 주소에서 본인 계정 재로그인 후 관리자 화면·설정의 본인 정보 표시 확인 |
| 실제 브라우저 직접 확인 | 도구 browser host unavailable로 데스크톱·모바일 직접 조작/시각 확인 불가 |

전체 테스트 명령은 `node --test scripts/notion-poc/tests/*.test.mjs`다. 기존 review 계약·저장·매핑·색상·planner·Notion CLI 회귀를 유지했다. 정상 계정의 관리자 API 200 원시 응답을 직접 수집한 것은 아니며 사용자 화면 확인으로 구분한다. 실제 일반 계정의 403·권한 회수·다중 화면 크기·교차 탭·새 가입/인증 메일·실제 비밀번호 정책·전체 런타임 오류 로그 감사는 미검증이다.

## 실제 변경·미변경 구분과 발표 경로

실제 원격 변경: 본인 Auth 역할 메타데이터 1건, Vercel 변수 target 2건, Production 배포 1건. 기존 교육 설계·업무 테이블·SQL 스키마·RLS·Auth 비밀번호/URL 설정·Notion 데이터는 변경하지 않았다. Git commit·push 0건. Notion 요청 0건.

발표: `https://pplus-rouge.vercel.app/login.html` → 본인 계정 로그인 → 상단 관리자 페이지 → 대시보드/회원 관리/이용 현황/설정. 실제 회원·통계는 추후 연결 예정임을 설명한다. 사용자가 실제 관리자 화면·본인 프로필까지 확인했다.

## 남은 문제·복구·다음 작업

이번 소스가 미커밋이므로 main의 과거 코드가 push되면 Git 자동 배포가 이번 화면을 덮을 수 있다. 변경 파일을 보존하고 후속 승인 범위에서 Git 반영을 정리해야 한다. 배포만 되돌려도 관리자 역할·변수 target은 별도로 남는다. 필요 시 이전 Production 배포로 복구하고, 별도 승인 아래 본인 pplus_role과 변수 scope를 원래대로 복구할 수 있다. 이번에는 복구·권한 회수를 수행하지 않았다.

우선순위는 실제 일반 사용자 차단·모바일 QA → 소스 Git 보존 → 별도 최소 권한 회원 목록/통계 API 설계다. 전체 회원 관리를 위해 기존 education_drafts RLS를 완화하지 않는다. 실제 관리자 화면 접근 완료를 Notion 웹 생성·회원 관리 전체 완성으로 보고하지 않는다.
