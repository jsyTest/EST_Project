# [NB-V2-UI-008 작업 보고서]

## 1. 결론

**추가 배포 불필요: UI-003~007은 이미 커밋되어 현재 Production에 포함되어 있다.** 이번 조사에서 배포하거나 Git 이력을 변경하지 않았다. 2026-11-02 15시대(KST) 조회 기준 로컬 HEAD·원격 main·운영 배포 SHA가 모두 `b0f6acd7c0a27228ac7f22f107870339274ea76f`다. 운영 공개 자원 30개도 로컬 소스·새 빌드와 바이트 단위로 일치한다.

따라서 UI-007이 미커밋이라는 과거 상태를 근거로 재커밋·재배포하면 불필요한 릴리스가 된다. **운영 반영 확인 완료 / 자동·HTTP 검사 통과 / 실계정 사용 검증 미완료**로 구분한다. 기존 시각 검토를 이번에 새로 수행했다고 주장하지 않는다.

## 2. Git 및 보존 상태

| 항목 | 직접 확인한 결과 |
| --- | --- |
| 시작 HEAD·브랜치 | main / b0f6acd7c0a27228ac7f22f107870339274ea76f |
| 원격 main | git ls-remote origin refs/heads/main 결과 동일 SHA |
| 시작 작업 트리 | clean, staged/미커밋/미추적 변경 없음 |
| UI-007 | b0f6acd(변경 구현 20)에 코드·테스트·문서 8개 포함 |
| UI-006 | 5a313cc(변경 구현 19)에 반영 |
| UI-005 | fbccb51(변경 구현 18)에 반영 |
| UI-004 | a4a71fe(변경 구현 17)에 반영 |
| UI-003 | 74412c7(변경 구현 16)에 반영 |
| 종료 상태 | HEAD/브랜치 동일, 이번 보고서·인계문 2개만 미추적 추가 |

커밋 이름만으로 판단하지 않고 각 커밋의 변경 파일과 현재 코드를 확인했다. 새 JPEG는 74412c7에 이미 들어갔고, a4a71fe에서 참조·빌드 구성이 정리되어 있다. UI 단계와 커밋 경계가 완전히 일치한다고 단정하지 않는다.

UI-007 커밋의 정확한 파일은 아래와 같다. **모두 이미 원격 main과 운영본에 들어 있으므로 새 커밋 대상이 아니다.**

1. admin.html
2. css/admin.css
3. css/auth.css
4. js/auth.js
5. scripts/notion-poc/tests/admin-ui.test.mjs
6. scripts/notion-poc/tests/auth-ui-harness.mjs
7. docs/research/NB-V2-UI-007_REPORT.md
8. docs/chat-handoff/NB-V2-UI-007_CHATGPT_HANDOFF.md

checkout/reset/clean/stash/commit/push/fetch는 수행하지 않았다. 원격 조회는 ls-remote만 사용했다.

### 저장소 위생과 배포 제외

- `.env`, `.env.*`(예시 파일 제외), node_modules, public-dist, Notion 실행 상태 폴더는 기존 .gitignore 대상이다. 기존 `.env.example`은 추적 중인 예시 파일이다.
- **루트 `.DS_Store`, `assets/.DS_Store`는 이미 추적되어 있으며 .gitignore에도 없다.** 과거 연구용 브라우저 PNG/JSON도 Git에 존재한다. 현재 새 배포용 변경으로 추가된 것은 없으며 임의 삭제·ignore 수정은 하지 않았다. 저장소 정리는 별도 검토 사항이다.
- 세션·토큰·실제 환경 파일·임시 로그를 새 커밋 후보로 추가하지 않았다. 이번 파일명 점검은 전체 Git 과거 이력의 비밀 탐지 감사와는 다르다.
- UI-005~007 캡처와 이번 검사 증거는 프로젝트 밖 `/Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/` 아래에 있다.
- 공개 빌드는 명시적 30개 allowlist만 사용한다. 기존 Git에 있는 문서·.DS_Store·캡처와 서버/CLI/상태/환경 파일은 정적 배포 출력에서 제외된다. 서버 Function 번들은 정적 공개 자원과 별도다.
- 향후 `git add .` 대신 승인된 파일만 명시적으로 stage해야 한다. 이미 추적된 파일에는 ignore 추가만으로 추적 해제가 되지 않는다. 이번에는 어느 파일도 stage하지 않았다.

## 3. 코드와 동작 검토

| 요구사항 | 코드·이번 모의 검사 결과 | 실계정 운영 확인 |
| --- | --- | --- |
| 관리자 자기 링크 미생성 | js/auth.js에서 !adminPage 조건 안에서만 adminLink 생성 | 미실행 |
| 복귀 버튼 1개 | admin-service-return, /index.html, 오른쪽 auth-account | HTML 운영본 일치, 실제 클릭 미실행 |
| 사이드바 4개 | 대시보드·회원 관리·이용 현황·설정 | 실제 계정 메뉴 전환 미실행 |
| 일반 서비스 관리자 버튼 | index/mapping/result에서 기존 동적 생성 유지 | 모의 검사 통과, 실계정 미실행 |
| 확인 전 숨김 | 초기 hidden, 서버 authorized 결과일 때만 표시 | 모의 검사 통과 |
| 관리자 본문 검사 | admin state 게이트·서버 역할 검사 유지 | 일반 사용자 실계정 접근 미실행 |
| 이메일·로그아웃 | 기존 슬롯에 이메일/로그아웃 추가, 기존 이벤트 유지 | 계정 전환/지연 응답/로그아웃 모의 통과 |
| UI-003~006 디자인 | JPEG+PPLUS·424px 카드·눈 아이콘 flex 중앙·폼 gap 8px·모바일 KPI 2열/상태 한 줄 유지 | 이전 Chrome 검증·사용자 검토 이력, 이번 새 캡처 없음 |

관리자 헤더는 브랜드 → 오른쪽 복귀/이메일/로그아웃이다. 브랜드의 index.html 링크는 유지하며, 명시적 복귀 버튼만 1개다. 일반 서비스 헤더는 브랜드/기존 표시 → 권한 확인 후 관리자 페이지/이메일/로그아웃이다.

`git diff 7671e47 HEAD -- api server database js/drafts js/planner js/mapping js/admin-access.js js/admin-ui.mjs js/auth-core.js js/supabase-client.js vercel.json` 결과는 비어 있다. 이전 운영 기준 UI-001 Git 배포 이후 이 범위는 변경되지 않았다. UI-007의 js/auth.js 변경은 계정 슬롯 재사용과 링크 생성 조건이며 인증·로그아웃 요청 로직은 유지했다. RLS·Auth 원격 설정은 조회·변경하지 않았고, 실제 원격 설정 전체를 재감사한 것은 아니다.

## 4. 이번 새 테스트

전체 실행: `node --test scripts/notion-poc/tests/*.test.mjs`.

- 첫 sandbox 실행: 326개 중 324 통과, HTTP listen EPERM으로 2개 실패. 제품 동작 실패와 구분한다.
- 로컬 HTTP 대기가 허용된 환경에서 동일 명령 재실행: **326/326 통과**, 실패/취소/생략/todo 0, 약 13.3초.
- V1 256조합은 전체 검사에 포함된 기존 테스트로 이번에 다시 통과했다. 326개에 256개를 별도로 더해 집계하지 않는다.
- 로그인·회원가입·관리자 표시/숨김·직접 URL 차단·계정 전환·로그아웃·지연 응답·저장/매핑/planner·CLI 회귀 포함. 실제 계정 응답이 필요한 부분은 모의 검사다.
- JS 문법 검사(auth/auth-core/admin-access/admin-ui)·git diff --check 통과.
- 공개 빌드 30개, 소스→public-dist 바이트 일치 30/30, 소스→운영 HTTP 바이트 일치 30/30, 모두 HTTP 200.
- JPEG: assets/logo_1.jpeg, 314×314, image/jpeg, SHA-256 `c1f8a47e16a950e0aa55b5ded53818b576a14585f6e940006716ac07dd867d98`. 로컬 원본·빌드·운영 바이트 동일. 원본 수정 없음.

### 실제 HTTP 검사

| 경로/요청 | Production | 로컬 8795 |
| --- | --- | --- |
| login.html 및 mode=signup | 200 | 회원가입 주소 200 |
| 공개 HTML·CSS·JS·JPEG 30개 | 200, 로컬과 일치 | 빌드 30개 검사 |
| /.env, /.DS_Store, /assets/.DS_Store | 404 | 404 |
| /server/drafts-review.mjs, /scripts/notion-poc/cli.mjs, /docs/research/NB-V2-UI-007_REPORT.md | 404 | 404 |
| /api/drafts/review.mjs, 임의 미등록 경로 | 404 | 404 |
| /__demo/admin.html | 404 | 기존 허용 시연 200 |
| /api/admin/overview 무인증 | 401 auth_required | 401 auth_required |
| 같은 API 유효하지 않은 Bearer 문자열 | 401 invalid_session | 503 server_not_configured |
| /api/drafts/review 무인증 POST | 401 auth_required | 401 auth_required |
| 같은 API 형식상 유효한 가상 draftId + 유효하지 않은 Bearer | 401 invalid_session | 503 server_not_configured |
| 두 API 외부 Origin | 403 origin_not_allowed | 403 origin_not_allowed |
| /api/drafts/review GET | 405 method_not_allowed | 405 method_not_allowed |

처음 review에 빈 JSON과 유효하지 않은 Bearer를 보낸 경우에는 400 invalid_draft_id였다. 입력 검사 순서상 정상이며, UUID 형식의 가상 ID로 다시 검사하여 위 401을 확인했다. 실제 설계 ID/계정은 사용하지 않았다. 로컬 서버 프로세스의 설정 미제공 503은 현재 Production 503이 아니다. 설정을 변경하지 않았다.

운영 API 응답은 private/no-store이며 review의 webExecutionReady=false, notionExecution=not_executed, notionRequests=0, supabaseWrites=0을 확인했다. 일반 사용자 실제 토큰의 관리자 403과 관리자 실제 200은 이번에 검증하지 않았다.

증거 파일: `/Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/NB-V2-UI-008/`의 node-tests.txt, public-and-http-check.json, api-valid-input-check.json. 실제 비밀번호·JWT·쿠키·환경변수 원문은 수집/저장하지 않았다. 검사에는 명시적으로 무효인 문자열만 사용했다.

## 5. Vercel 현재 상태

| 항목 | 조회 결과 |
| --- | --- |
| 프로젝트/팀 | pplus / PPLUS(pplus1) |
| 프로젝트 ID | prj_5Bxefw0g4RQLUSDXjui5do4tfC9n |
| 팀 ID | team_gDF3LRSavShTKMmlQTNwqH51 |
| 실제 도메인 연결 | pplus-rouge.vercel.app → dpl_36UbJYfnQd4tpvw46AtaUivshgST |
| 배포 URL | https://pplus-22kgesevi-pplus1.vercel.app |
| 배포 상태/소스 | Production / READY / git |
| 저장소·브랜치·SHA | jsyTest/EST_Project / main / b0f6acd7c0a27228ac7f22f107870339274ea76f |
| 배포 시작/READY | 2026-11-02 15:09:23 / 15:09:30 KST(메타데이터 기준) |
| Node/framework | 24.x / null |
| 빌드 | vercel.json: node scripts/deployment/build-static.mjs → public-dist. 실제 빌드 로그에서도 main/b0f6acd clone, entrypoint '.', public-dist, count 30, 완료 확인 |
| 환경변수 | SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY 모두 preview+production, gitBranch 제한 없음 |
| 숨겨진 Production 변수 수 | 도구 응답 0. 공유 변수 전체에 대한 별도 감사는 하지 않음 |
| 보호 | SSO enabled/all_except_custom_domains, passwordProtection=false, trustedIps=false |

환경변수 값은 보고하지 않는다. 기존 설정 변경은 0건이다. 운영 도메인 HTTP 응답은 앱의 200/401/403/404로 확인했으며 Vercel 보호 페이지로 오인하지 않았다. 배포 전용 URL의 SSO를 우회하거나 보호 설정을 변경하지 않았다.

프로젝트 도구의 축약 응답에 Root Directory/Production Branch/자동 배포 토글의 원문 설정은 나오지 않았다. **현재 main Git 배포가 운영에 연결된 사실과 빌드 entrypoint '.'는 확인했지만, Dashboard의 모든 자동 배포·Ignored Build 설정까지 확인했다고 주장하지 않는다.** 향후 main push는 Production 배포를 유발할 수 있는 작업으로 취급해야 한다.

롤백 후보 목록 조회는 Vercel API 403 forbidden(deploymentRollback 조회 권한 제한)이었다. Vercel CLI도 설치되어 있지 않아 무단 설치/대체 로그인은 하지 않았다. 과거 UI-001 배포 dpl_GWwBGn1zgRPeauqHZtFi1Bq3deSo는 ID 직접 조회에서 READY였지만, READY만으로 즉시 롤백 적격/권한/실사용 정상 여부를 보장할 수 없다. 과거 배포 객체의 alias 필드 대신 최신 get_alias 결과로 현재 연결을 판단했다.

## 6. 배포 방식 비교

| 방법 | 장점 | 위험/조건 | 판단 |
| --- | --- | --- | --- |
| A. 검토 파일 커밋 후 승인 시 main push | Git SHA로 소스·테스트·문서 재현 가능, 운영 SHA와 이력 연결 명확 | push가 자동 Production 갱신을 유발할 수 있음. 정확한 stage 목록·원격 main 재조회·별도 승인 필요 | 향후 변경의 기본 권장 방식. 이번 UI-007에는 이미 완료되어 추가 작업 불필요 |
| B. Git 유지 + 별도 Production 배포 | 긴급 시 특정 소스를 직접 배포 가능 | 미커밋 스냅샷이면 재현성 저하, 다음 main 배포가 덮을 수 있음. 승인 커밋/입력 해시 고정 필요 | 이번에는 비권장. 필요시에도 검토된 Git 커밋 기반 배포로 범위 고정 |

Vercel의 Production 브랜치 push/merge 자동 배포 정책: https://vercel.com/docs/git 및 https://vercel.com/docs/deployments/promoting-a-deployment . 커밋을 로컬에서 만드는 행위 자체는 원격 push와 다르지만, 이번에는 둘 다 금지 범위다. 문서만 main에 push하더라도 빌드 생략 설정이 확인되지 않았으므로 자동 배포 가능성을 전제로 승인받아야 한다.

## 7. 배포 후/현재 운영 실계정 체크리스트

이번에는 사용자 비밀번호/JWT/쿠키를 요구하지 않았다. 사용자가 자신의 브라우저에서 다음만 확인하면 된다.

1. 운영 로그인·회원가입을 열어 JPEG+PPLUS, 중앙 카드, 눈 아이콘과 빈값 오류를 확인한다. 새 가입은 만들지 않아도 된다.
2. 본인 관리자 계정으로 로그인하여 일반 서비스의 관리자 페이지·본인 이메일·로그아웃 순서를 확인한다.
3. 관리자 화면에서 오른쪽 서비스로 돌아가기 1개, 관리자 자기 링크 없음, 네 메뉴를 확인한다.
4. 휴대폰 너비에서 KPI 첫 두 카드 2열/운영 상태 한 줄, 헤더 겹침·가로 스크롤 없음을 확인한다.
5. 기존 본인 테스트 설계를 저장하지 않고 열어 값·모듈·매핑·색상 표시를 확인한다. 실제 저장은 별도 승인된 테스트 설계에서만 한다.
6. 복귀 버튼으로 교육 설계 화면 이동, 새로고침 후 세션 유지, 로그아웃 후 뒤로가기/관리자 직접 접속 시 정보가 사라지는지 확인한다.
7. 기존 일반 계정이 있으면 관리자 버튼 없음/직접 URL 정보 없음도 확인한다. 없는 계정을 임의 생성하지 않는다.

이전 UI-001/002 운영본과 비교하면 중앙 카드·JPEG 브랜드·눈 아이콘/폼 간격·모바일 KPI·복귀 단일화가 달라졌다. **현재 Production과 최신 로컬 공개 파일 사이에는 차이가 0개**이므로 앞으로 배포해야 이 변경이 생기는 것은 아니다.

이번에 실제 계정/모바일 하드웨어로 위 흐름을 실행하지 않았다. 이전 Chrome 4해상도 정적 모형/시연 검증은 UI-007 기록이며 이번 운영 실계정 증거로 대체하지 않는다.

## 8. 승인 요청서 — 작성 후 중지

### 권장 승인안: 현재 운영본 유지, 추가 릴리스 없음

| 승인 항목 | 정확한 범위 |
| --- | --- |
| 대상 | pplus / https://pplus-rouge.vercel.app |
| 현재 운영 SHA | b0f6acd7c0a27228ac7f22f107870339274ea76f |
| 포함할 새 기능 변경 파일 | 없음. UI-007의 위 8개는 이미 포함됨 |
| 이번 새 문서 | docs/research/NB-V2-UI-008_REPORT.md, docs/chat-handoff/NB-V2-UI-008_CHATGPT_HANDOFF.md. 로컬 보관만, stage/commit/push 제외 |
| 예상 commit/push/배포 | 모두 0회. 현재 배포 dpl_36UbJYfnQd4tpvw46AtaUivshgST 유지 |
| 자동 배포 영향 | 이 안은 push하지 않아 트리거하지 않음. 향후 문서 push도 별도 승인 필요 |
| 테스트 | 새 326/326·V1 256조합·공개 30/30 바이트 일치·내부 경로 404·운영 API 거절 계약 통과 |
| 운영 데이터 | 변경 없음. 실제 계정 사용 체크는 사용자 브라우저에서 진행, 저장 쓰기는 별도 승인 범위에서만 |
| 복구 | 이번 새 배포가 없어 새 롤백 불필요. 실제 이상 발견 시 자동 복구 없이 증거와 후보를 확인해 별도 승인 요청 |
| 미검증 위험 | 실계정 관리자/일반 사용자·저장/로그아웃·실제 모바일, 자동 배포 설정 전문, 롤백 적격/실행 권한 미확인 |

**사용자 결정 요청: 추가 배포 없이 현재 운영본을 유지하고 위 실계정 체크리스트를 진행하는 방안을 승인해 주세요.** 이는 Production 변경 승인이 아니다.

사용자가 동일 소스의 재배포를 명시적으로 원한다면 별도 승인 대상은 pplus의 Git 커밋 b0f6acd7c0a27228ac7f22f107870339274ea76f 기반 Production 새 배포 1회와 도메인 자동 연결이다. 새 코드 파일/커밋/push/환경변수/데이터 변경은 0개다. 실행 직전 원격 main·alias·승인 SHA를 다시 읽고, 현재 배포 보존 및 롤백 적격/권한을 먼저 확인해야 한다. 확인 실패 또는 운영 SHA 변동 시 중지하고 새 승인안을 작성한다. 현재는 이 선택을 권장하지 않으며 **승인받거나 실행하지 않았다.**

향후 실제 새 코드 릴리스가 필요하면 A 방식으로 승인 파일만 커밋하고, 테스트·Preview와 Production 전환 범위를 구분해 승인받는다. 새로 배포한 버전이 장애를 일으키면 보존된 검증 배포로 복구하는 승인안을 별도로 제시한다. UI 릴리스에는 DB 변경이 없어 데이터 마이그레이션 롤백은 포함하지 않는다. Vercel Instant Rollback은 적격 후보·권한 확인 후 수행하며 자동 도메인 할당의 후속 상태도 재확인해야 한다: https://vercel.com/docs/instant-rollback .

## 9. 변경 여부와 최종 판정

이번 변경은 보고서·인계문 2개와 프로젝트 밖 로컬 검사 증거뿐이다. 재생성된 public-dist는 기존 ignored 출력이며 소스와 같았다. 앱 코드/테스트/JPEG 수정 없음, Git commit/push/이력 변경 0, Vercel 배포/alias/환경변수 변경 0, Supabase 데이터/Auth/RLS/역할 변경 0, Notion 요청/쓰기 0이다. 무효 Bearer 검사에 따른 기존 서버 Auth 읽기 요청은 있었지만 실사용자 정보는 읽지 않았다.

**사전점검 완료, 추가 릴리스 불필요, 실계정 QA 대기. 승인 요청서 작성 후 작업을 중지한다.**
