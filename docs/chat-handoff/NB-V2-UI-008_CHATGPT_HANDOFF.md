# [ChatGPT 전달용] NB-V2-UI-008 디자인 통합 검토 및 Production 배포 준비 결과

## 핵심 결론

**UI-003~007은 이미 현재 Production에 반영되어 있어 추가 배포가 필요하지 않습니다.** Codex는 이번에 커밋·push·배포하지 않았습니다. 과거 UI-007 보고 당시의 미커밋 상태와 이번 최신 상태를 구분했습니다.

자동 검사와 공개 파일 검증은 통과했습니다. 실제 관리자·일반 사용자 계정으로 로그인한 운영 동선은 이번에 확인하지 않아 **실계정 QA 대기**입니다.

## 1. 현재 Git·운영 상태

| 항목 | 확인 결과 |
| --- | --- |
| 로컬 브랜치/HEAD | main / b0f6acd7c0a27228ac7f22f107870339274ea76f |
| 원격 main | 동일 SHA, git ls-remote로 확인 |
| 운영 도메인 | https://pplus-rouge.vercel.app |
| 실제 연결 배포 ID | dpl_36UbJYfnQd4tpvw46AtaUivshgST |
| 배포 상태·소스 | Production / READY / Git, jsyTest/EST_Project의 main |
| 배포 SHA | b0f6acd7c0a27228ac7f22f107870339274ea76f |
| 공개 파일 비교 | 운영·로컬 소스·새 빌드 30개 모두 바이트 일치 |
| 작업 트리 | 시작 clean → 종료 시 이번 보고서·인계문 2개만 미추적 |

UI-003~006의 디자인은 74412c7/a4a71fe/fbccb51/5a313cc 이력과 현재 코드에서 확인했습니다. UI-007은 b0f6acd에 이미 커밋되어 있습니다.

UI-007의 정확한 8개 파일은 다음과 같습니다. 전부 이미 운영에 포함되어 새 커밋 대상이 아닙니다.

- admin.html
- css/admin.css
- css/auth.css
- js/auth.js
- scripts/notion-poc/tests/admin-ui.test.mjs
- scripts/notion-poc/tests/auth-ui-harness.mjs
- docs/research/NB-V2-UI-007_REPORT.md
- docs/chat-handoff/NB-V2-UI-007_CHATGPT_HANDOFF.md

## 2. 디자인·권한 보존 검토

- 일반 서비스: JPEG 심볼+PPLUS/기존 표시, 오른쪽 관리자 페이지(서버 승인 후에만)/이메일/로그아웃 구조 유지.
- 관리자: 브랜드, 오른쪽 서비스로 돌아가기(`/index.html`)/이메일/로그아웃. 관리자 자기 링크는 생성하지 않음.
- 명시적 복귀 버튼 1개, 사이드바는 대시보드·회원 관리·이용 현황·설정 4개. 브랜드의 기존 교육 설계 이동 링크 유지.
- 초기 관리자 링크 숨김, 서버 사용자·역할 확인, 본문 게이트, 권한 오류 차단, 계정 전환·로그아웃의 이전 상태 제거 유지.
- 424px 로그인 카드, JPEG+PPLUS, 눈 아이콘 flex 중앙 정렬, 폼 gap 8px, 모바일 KPI 2열과 상태 한 줄 유지.
- UI-001 Git 운영 기준 7671e47 이후 API/server/database, Auth 핵심·관리자 권한 모듈, drafts/planner/mapping, vercel.json 범위에 변경 없음. UI-007 auth.js 변경은 헤더 슬롯/링크 생성 부분.
- RLS·Supabase Auth 원격 설정은 이번에 변경하지 않았으며 실제 설정 전체를 재감사한 것은 아님.

## 3. 이번 실행한 검사

| 검사 | 결과와 증거 성격 |
| --- | --- |
| 전체 Node | 새 실행 326/326 통과, 실패·생략 0, 약 13.3초 |
| V1 | 전체 검사 안의 기존 256조합 새 실행 통과 |
| 로그인·관리자·계정 전환·저장·CLI | 기존 회귀 통과. 실제 계정 대신 사용하는 응답은 모의 검사로 구분 |
| 문법·차이 검사 | 주요 Auth/관리자 JS 문법, git diff --check 통과 |
| 공개 빌드 | allowlist 30개, 빌드/소스/운영 바이트 30/30 일치 |
| JPEG | 314×314, image/jpeg, 원본·빌드·운영 일치 |
| 내부 경로 | 운영 .env/.DS_Store/서버 소스/CLI/문서/로컬 시연/미등록 경로 404 |
| 운영 관리자 API | 무인증 401 auth_required, 무효 Bearer 401 invalid_session, 외부 Origin 403 |
| 운영 review API | 무인증 401, 유효한 형식의 가상 ID+무효 Bearer 401 invalid_session, 외부 Origin 403, GET 405 |

첫 Node 실행은 sandbox의 HTTP listen EPERM으로 2개가 실패했습니다. 같은 검사를 로컬 대기 권한이 있는 환경에서 재실행하여 전부 통과했습니다. 테스트나 제품 코드는 바꾸지 않았습니다.

review에 빈 JSON을 보낸 초기 요청은 입력 검사로 400이었습니다. 가상 UUID로 수정한 검사에서 Auth 401을 확인했습니다. 실제 계정 토큰이나 설계 ID는 사용하지 않았습니다.

기존 로컬 8795 서버는 서버 설정이 없는 상태여서 무효 Bearer 검사에서 503이었지만 **현재 운영은 401**입니다. 로컬 설정은 변경하지 않았습니다. 운영 API는 private/no-store이며 review의 webExecutionReady=false, notionExecution=not_executed, Notion 요청/DB 쓰기 0을 확인했습니다.

JPEG SHA-256: c1f8a47e16a950e0aa55b5ded53818b576a14585f6e940006716ac07dd867d98. 원본 바이트 변경 없음.

## 4. Vercel 설정·복구 확인의 한계

- pplus 프로젝트 ID: prj_5Bxefw0g4RQLUSDXjui5do4tfC9n, 팀 PPLUS(pplus1).
- SUPABASE_URL·SUPABASE_PUBLISHABLE_KEY는 모두 Preview+Production 범위, 브랜치 제한 없음. 값은 출력/변경하지 않음.
- vercel.json의 build-static → public-dist 구성과 실제 빌드 로그의 main/b0f6acd·entrypoint `.`·30개 출력·완료 확인.
- SSO all_except_custom_domains 활성, 비밀번호 보호·Trusted IP 비활성. 운영 도메인의 앱 응답을 실제 확인했고 보호를 해제하지 않음.
- 도구의 축약 응답에는 Root Directory/Production Branch/자동 배포 토글 전체가 없어 Dashboard 설정 전문은 미확인. 현재 main Git 배포의 운영 연결은 확인함.
- 롤백 후보 목록 조회는 Vercel API 403 권한 제한. CLI도 없어 설치하지 않음. 과거 UI-001 배포는 ID 직접 조회에서 READY였으나 롤백 적격/권한/실사용 정상 여부는 확정하지 않음.

main push는 Production 자동 배포를 유발할 수 있으므로 문서만 push하더라도 별도 승인이 필요합니다. [Vercel Git 배포 정책](https://vercel.com/docs/git)

## 5. 배포 방식 판단과 Git 보존

향후 변경에는 **A: 검토한 파일만 커밋하고 승인 시 main push**를 권장합니다. 소스·검사·운영 SHA를 재현하기 쉽습니다. 로컬 커밋과 원격 push는 구분해야 하며, 이번에는 둘 다 수행하지 않았습니다.

B: 별도 Production 배포는 미커밋 스냅샷과 다음 main 배포의 불일치 위험이 있습니다. 필요하더라도 검토된 Git SHA를 고정해야 합니다. 이번에는 A도 B도 추가 실행할 필요가 없습니다.

루트와 assets의 .DS_Store 및 과거 연구 캡처가 **이미 Git에 추적 중**입니다. 공개 30개 빌드에서는 제외되고 해당 운영 경로도 404입니다. 이번에 임의 삭제/ignore 수정하지 않았으며, 별도 저장소 정리 과제로 남깁니다. 실제 환경 파일·세션·토큰·새 캡처·임시 로그를 이번 커밋 후보에 넣지 않았습니다. 전체 Git 과거 이력의 비밀 탐지 감사까지 수행한 것은 아닙니다.

## 6. 사용자 실계정 확인 체크리스트

현재 운영 주소에서 사용자가 자신의 브라우저로 확인합니다. 비밀번호·JWT·쿠키를 전달할 필요는 없습니다.

1. 로그인·회원가입의 JPEG+PPLUS, 중앙 카드, 눈 아이콘, 빈값 오류 확인. 새 계정 생성 불필요.
2. 본인 관리자 로그인 후 일반 서비스의 관리자 버튼·이메일·로그아웃 순서 확인.
3. 관리자 화면의 복귀 버튼 1개·자기 링크 없음·사이드바 네 메뉴 확인.
4. 모바일 KPI 2열+상태 한 줄, 헤더 겹침·가로 스크롤 없음 확인.
5. 기존 본인 테스트 설계를 열어 값·모듈·매핑·색상 확인. 저장 쓰기는 별도 승인된 테스트 범위에서만 수행.
6. 서비스 복귀·새로고침 세션 유지·로그아웃 후 관리자 정보 제거 확인.
7. 기존 일반 계정이 있다면 관리자 버튼 없음·관리자 직접 URL 정보 차단 확인.

실계정 운영 로그인/관리자 200/일반 사용자 403/실제 저장·불러오기/로그아웃·모바일 하드웨어는 이번에 미검증입니다. UI-007의 Chrome 정적 모형/시연 캡처는 이전 검증이며 이번에 새로 캡처했다고 보고하지 않습니다.

## 7. 승인 요청서와 작업 중지

**권장안: 현재 운영본 유지, 추가 배포 없이 위 실계정 QA 진행.**

- 대상: pplus / https://pplus-rouge.vercel.app
- 유지할 배포: dpl_36UbJYfnQd4tpvw46AtaUivshgST
- 현재 SHA: b0f6acd7c0a27228ac7f22f107870339274ea76f
- 새 기능 변경 파일: 없음. UI-007의 8개 파일은 이미 포함됨.
- 새 로컬 문서: docs/research/NB-V2-UI-008_REPORT.md, docs/chat-handoff/NB-V2-UI-008_CHATGPT_HANDOFF.md. 이번 승인안에서도 commit/push 대상 아님.
- commit/push/배포/환경변수/운영 데이터 변경: 모두 0회.
- 복구: 새 배포가 없어 이번 작업으로 인한 롤백 불필요. 실제 이상이 발견되면 후보·권한·증거부터 확인하고 별도 복구 승인 요청.
- 남은 위험: 실계정 QA, 자동 배포 설정 전문, 실제 롤백 적격/권한 미확인.

사용자가 동일 커밋 재배포를 원한다면 별도 승인 범위는 **pplus의 위 Git SHA 기반 Production 배포 1회와 운영 도메인 자동 연결**, 새 코드/커밋/push/환경변수/데이터 변경 0개입니다. 현재는 비권장·미승인·미실행입니다. 실행 전 SHA/alias 재확인과 현 운영 배포 보존·롤백 적격/권한 확인이 필요하며, 확인 불가/상태 변동 시 중지하고 새 승인안을 작성해야 합니다. [Vercel 복구 정책](https://vercel.com/docs/instant-rollback)

**승인 요청: 추가 배포 없이 현재 운영본을 유지하고 위 사용자 실계정 체크를 진행하는 방안을 승인해 주세요.** 이는 Production 변경 승인이 아닙니다. NB-V2-UI-008 8절에 따라 승인안 작성 후 중지했습니다. 이전 UI 승인·디자인 검토를 배포 승인으로 사용하지 않았습니다.

## 8. 산출물·변경 여부

- 보고서: /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-UI-008_REPORT.md
- 인계문: /Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-UI-008_CHATGPT_HANDOFF.md
- 새 검사 증거: /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/NB-V2-UI-008/
- 앱 코드·테스트·JPEG 수정 없음. Git commit/push/이력 변경, Vercel 배포/alias/환경변수, Supabase 데이터/Auth/RLS/역할, Notion 요청/쓰기 모두 0건.
- 공개 빌드의 ignored 출력은 로컬 재생성했고 소스와 일치. 무효 Bearer 검사에 따른 기존 서버 Auth 읽기는 있었으나 실제 사용자 정보/비밀을 수집하지 않음.

## ChatGPT 검토 및 다음 작업 결정 요청

1. UI-007 미커밋이라는 과거 상태와 현재 Git·운영 SHA 일치를 구분했는지 검토해 주세요.
2. 추가 배포 없이 현재 운영본을 유지하는 판단이 적절한지 평가해 주세요.
3. 326개 자동 검사·30개 운영 파일 비교와 실계정 미검증을 구분해 주세요.
4. 관리자 버튼·단일 복귀·네 메뉴·인증/권한 보호가 보존됐는지 검토해 주세요.
5. .DS_Store/연구 캡처의 기존 Git 추적과 공개 빌드 제외를 구분하고 별도 정리 우선순위를 제안해 주세요.
6. 롤백 조회 권한·자동 배포 설정·실계정 QA의 남은 위험을 평가해 주세요.
7. 다음 작은 작업을 운영 실계정 QA로 할지 결정해 주세요. 재배포·Git 보존 작업이 필요하다면 정확한 범위를 정해 사용자에게 별도 승인받을 후속 프롬프트를 작성해 주세요.

확인하지 않은 실계정 기능을 완료 처리하지 말고, 이번 작업에서 Production을 새로 배포했다고 판단하지 마세요.
