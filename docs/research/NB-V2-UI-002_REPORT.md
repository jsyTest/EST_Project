# [NB-V2-UI-002 작업 보고서]

## 1. 판정

**A. 운영 사이트에 UI-001 로그인·관리자 기능이 유지됨 — 배포 파일, 서버 오류 응답, 자동 회귀 검사 기준.**

운영 배포 ID는 바뀌었지만 기능이 과거 코드로 되돌아간 것은 아니다. 현재 Git 커밋에 UI-001의 24개 변경 파일이 포함됐고, 운영 공개 파일 30개와 이전 검증 스냅샷이 모두 일치한다. 이번 정상 실계정 로그인·관리자 정보 표시·일반 사용자 거절·모바일 조작은 재검증하지 못했으므로 실제 사용자 흐름 전체의 성공을 새로 확정한 판정은 아니다. B의 누락 증거는 없으며, 발표 도메인 HTTP 접근에 Vercel 보호 차단도 없어 C에 해당하지 않는다.

확인일: 2026-10-30, 한국 시간. 상세 페이지 HTTP 검사 시각은 12:13경이다. 이 보고서는 해당 조사 시점의 상태이며, 이후 push/alias 변경까지 보장하지 않는다.

## 2. 현재 운영 도메인과 배포

| 항목 | 직접 조회 결과 |
| --- | --- |
| 발표 주소 | https://pplus-rouge.vercel.app |
| 현재 alias 배포 ID | dpl_8amt425dVN8K7opyB9jC6fKQtDaT |
| 배포 주소 | pplus-91xk6qq1k-pplus1.vercel.app |
| 상태 / target / source | READY / production / git |
| 저장소 / 브랜치 | jsyTest/EST_Project / main |
| Git SHA | 7671e47bda420f5acc769954ce83bf0538823aa0 |
| 커밋 제목 | 변경 구현 14 |
| 팀 / 프로젝트 | PPLUS / pplus |
| 이전 UI-001 배포 | dpl_GWwBGn1zgRPeauqHZtFi1Bq3deSo — 현재 발표 도메인의 배포와 다름 |

Vercel get_deployment의 도메인 조회와 지정 ID 조회, get_alias의 deploymentId가 일치했다. 이전 파일 스냅샷 배포와 새 Git 배포를 같은 배포로 취급하지 않았다. SUPABASE_URL·SUPABASE_PUBLISHABLE_KEY는 각각 preview+production 적용 범위임을 값 복호화 없이 재확인했다. 환경변수·alias·배포는 수정하지 않았다.

## 3. 로컬·원격 Git·스냅샷 비교

- 로컬 HEAD: 7671e47bda420f5acc769954ce83bf0538823aa0.
- 원격 main: git ls-remote로 읽은 값도 같은 SHA. 로컬 origin/main 역시 같은 값이었다. fetch·checkout·reset·clean은 하지 않았다.
- 작업 시작 시 git status는 clean이었다. UI-001의 미커밋 파일이 사라진 것이 아니라 커밋 7671e47에 24개 파일로 저장돼 있었다.
- 이전 0a1884b → 현재 7671e47 커밋에는 로그인·관리자 UI/API·권한 확인·빌드·개발 시연·회귀 테스트·UI-001 보고/인계문이 모두 포함됐다.
- 이전 배포 시 남긴 임시 manifest에 기록된 소스 42개를 로컬 파일 및 현재 Git tree와 바이트 단위로 비교: 42/42 일치, 차이 0.
- 동일 정렬·직렬화 방식으로 스냅샷 payload를 다시 구성한 SHA-256은 이전 보고와 동일했다: `3fc73f4341bc7e42d87b3c5680c07eb7f6185efacbd83e7d63538997df77aef6`.
- 운영 HTTP로 받은 공개 자원 30개는 이전 manifest의 SHA-1과 모두 일치했다. 따라서 이전 스냅샷·현재 로컬·Git·현재 공개 운영 자원의 내용이 연결된다.
- 위 SHA-256은 Vercel이 제공한 배포 전체 해시가 아니라 이전 42파일 스냅샷 payload의 재구성 해시다. 비공개 서버 전체를 운영 HTTP에서 내려받은 증거로 오해하지 않는다. 서버 부분은 Git 소스 메타데이터·커밋 내용·실제 API 응답으로 확인했다.

UI-001 보고서의 ‘미커밋이어서 덮일 위험’은 작성 당시 상태다. 지금은 해당 구현이 main에 반영돼 그 특정 위험이 해소됐다. 최신 상태는 이 UI-002 보고를 우선한다. UI-001 문서는 역사 기록으로 수정하지 않았다.

## 4. 운영 화면·자원 검사

다음 7개 주소는 모두 200, text/html, 현재 로컬 파일과 내용 일치다: `/`, `/login.html`, `/login.html?mode=signup`, `/admin.html`, `/index.html`, `/mapping.html`, `/result.html`.

로그인 HTML/JS/CSS에서 PPLUS 브랜드·로그인/회원가입 모드·비밀번호 표시/숨기기·변경된 여백 스타일을 확인했다. 반복 노션 설계 도우미 제목·비밀번호 전송 기술 안내·이전 복구 버튼 문구는 없었다. 관리자 화면에는 대시보드·회원 관리·이용 현황·설정 메뉴가 있고, 기본 숨김 관리자 버튼과 서버 확인 스크립트가 포함돼 있다.

이 검사는 HTTP 파일·코드 확인이다. 브라우저에서 CSS를 실제로 배치한 결과를 시각 확인한 것은 아니다. signup query는 동일 HTML을 받지만 JS가 모드를 바꾸는 구조이며, 모드 동작은 자동 DOM 검사로 확인한다.

admin.html·index.html의 HTTP 200은 로그인·권한 통과를 뜻하지 않는다. 데이터 없는 정적 틀이고 보호된 내용은 클라이언트 게이트와 서버 API를 거친다. 실제 회원 정보나 관리자 비밀을 정적 HTML에 넣지 않았다.

## 5. 실제 Production API·공개 보안 검사

| 요청 | 실제 응답 |
| --- | --- |
| GET /api/admin/overview, 무인증 | 401 auth_required |
| GET /api/admin/overview, 가짜 Bearer | 401 invalid_session |
| GET /api/admin/overview, 외부 Origin | 403 origin_not_allowed |
| POST /api/admin/overview | 405 method_not_allowed |
| POST /api/drafts/review, 무인증 | 401 auth_required |
| POST /api/drafts/review, 가짜 Bearer | 401 invalid_session |

모두 앱의 JSON 오류 응답이며 `Cache-Control: private, no-store, max-age=0`을 확인했다. 가짜 토큰은 테스트용 문자열이고 실제 JWT를 수집·출력하지 않았다. server_not_configured 503은 재현되지 않았다. 외부 Origin의 403은 정상 일반 사용자의 admin_required 403 검증과 다르다.

다음은 실제 404였다: `/server/admin-overview.mjs`, `/scripts/development/admin-demo.mjs`, `/docs/chat-handoff/NB-V2-UI-001_CHATGPT_HANDOFF.md`, `/.env`, `/__demo/admin.html`, `/api/admin/unknown`. 공개 자원은 allowlist 30개만 확인했다. 테스트한 경로 범위의 결과이며 가능한 모든 비공개 경로를 탐색했다는 뜻은 아니다.

발표 도메인에서는 Vercel 로그인 보호 페이지/보호 리다이렉트에 막히지 않았다. 배포 고유 URL의 보호 동작을 앱 응답과 혼동하지 않았고 보호 설정도 바꾸지 않았다.

## 6. 발표 QA와 검증 수준

| 항목 | 이번 증거 / 한계 |
| --- | --- |
| 이메일 빈값·형식, 비밀번호 빈값·잘못된 로그인 | 기존 실제 코드에 모의 Auth·DOM을 제공한 자동 검사 통과. 운영 실제 입력은 미실행 |
| 비밀번호 표시/숨기기·회원가입 모드·확인 불일치 | 운영 소스 포함 확인 + 자동 검사. 실제 브라우저 조작 미실행 |
| 정상 로그인·이동·세션 유지·로그아웃 | 관련 자동 회귀 통과. 현재 Git 운영본의 실계정 재확인 불가 |
| 비로그인 관리자 버튼 숨김·직접 URL 보호 | 기본 숨김/게이트 코드 + 자동 검사. 운영 API 무인증 401 직접 확인 |
| 일반 사용자 버튼 숨김·API 403·직접 URL 정보 차단 | 모의 인증 검사 통과. 실제 일반 계정 세션 검증은 미실행 |
| 관리자 서버 확인 뒤 버튼·본인 정보 | 모의 인증 검사 통과. UI-001 당시 사용자 성공 확인은 과거 증거이며 이번 확인으로 재사용하지 않음 |
| 로그아웃·계정 변경·늦은 관리자 응답 제거 | 자동 모의 검사 통과. 운영 실계정 재검증 미실행 |
| 모바일 390/768/1280 등 화면 | 반응형 CSS 존재 확인, 실제 배치·터치·오류 줄바꿈·겹침 미검증 |
| 실제 서버 비밀번호 정책 | 미확인·미변경. 가입 로컬 8자 기준과 구분 |

CUA 조회는 apps/browsers가 없고 native pipe/browser host unavailable 오류였다. 사용자는 이번 관리자 실계정 검사를 직접 확인하기 어렵고 일반 계정도 확인하지 못했다고 답했다. 새 계정·설계를 생성하거나 비밀번호·JWT·쿠키를 요청하지 않았다.

## 7. 자동 검사

`node --test scripts/notion-poc/tests/*.test.mjs`를 이번 작업에서 재실행했다.

- 319 tests, 319 pass, fail/cancelled/skipped/todo 모두 0.
- 실행 약 12.8초.
- V1 256개 모듈 조합 검사는 위 테스트 중 한 항목으로 포함돼 통과했다. 256개를 추가 Node test 수로 계산하지 않는다.
- 로그인·관리자 24개 신규 회귀, 기존 Auth·교육 설계 저장/복원·planner·매핑·색상·Notion CLI 모의 검사·공개 빌드 제한을 포함한다.
- 빌드 관련 검사는 생성된 public-dist/임시 fixture를 사용했다. 운영 영향 코드 변경은 없다.
- 실제 Supabase/Notion 쓰기를 수행한 테스트 결과가 아니며, 실제 계정별 API 성공/거절의 증거로 쓰지 않는다.

## 8. Git 보존 방안과 발표 범위

UI-001 구현 파일은 이미 현재 main 이력에 저장돼 있어 중복 커밋·재배포·롤백이 필요하지 않다. 기존 main과 로컬 코드 차이는 없고 현재 확인된 UI-001 병합 충돌도 없다. 이번에 새로 보존할 파일은 UI-002 보고서·인계문 두 개뿐이다.

비공개/로컬 파일 `.env*`의 실제 값 파일, 세션·토큰·쿠키, .notion-*-state, node_modules, public-dist, 임시 HTTP/테스트 로그는 커밋에서 제외한다. 현재 .gitignore와 공개 allowlist를 유지한다. 기존에 커밋된 비밀 없는 로컬 시연 소스는 개발도구로 남아 있으며 공개 배포에서는 제외된다.

안전한 후속 순서: 변경 diff·비밀 제외 확인 → 필요한 두 문서만 선택한 커밋 내용 검토 → 사용자 Git 승인 → push 전 원격 main 재조회·자동 Production 배포 여부 확인 → 배포가 허용된 시간에만 push → 실제 도메인·SHA 재검증. main push는 문서 변경만 있어도 Production 빌드를 유발할 수 있다. 문서만 별도 브랜치/PR에 보존하는 방안도 있으나 Preview 트리거 여부를 먼저 확인한다. 이번에는 어느 방법도 실행하지 않았다.

발표에서 접근 가능한 경로는 운영 로그인·회원가입·교육 설계 화면·관리자 메뉴다. 현재 정상 실계정 흐름은 미검증이므로 발표 직전 사람이 로그인→관리자→새로고침→로그아웃을 1회 확인하는 것이 최소 후속 조치다. 관리자 전체 회원·통계·역할 변경·Notion 웹 생성은 기존대로 미연결/미구현이며 완성 기능으로 시연하면 안 된다.

## 9. 변경 여부와 최종 결론

운영 영향 코드 수정 0, Git commit/push/checkout/reset/clean/fetch 0, Vercel 배포/롤백/alias/변수 변경 0, Supabase SQL/Auth/RLS/회원/역할 변경 0, Notion 요청/쓰기 0이다. 요청된 UI-002 Markdown 문서 두 개만 추가했다. 기존 추적 파일·UI-001 기록과 구현은 보존했다.

현재 파일·API·자동 검사 기준 판정은 A이며 자동 복구는 필요하지 않다. 남은 일은 실제 브라우저/모바일/일반 사용자 세션 확인과 새 문서의 승인된 Git 보존이다.
