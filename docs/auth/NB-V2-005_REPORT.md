# [NB-V2-005 작업 보고서]

**판정: 로컬 핵심 인증 구현·자동 검사·사용자 직접 실계정 검증 완료. 운영 배포/리다이렉트·직접 브라우저/모바일 시각 검사가 남아 있어 전체 범위는 부분 완료다.** 코드 존재, 모의/SDK 검사, 실제 API, 사용자 검증을 구분한다.

## 1. 작업 ID 및 기준일

NB-V2-005 / 2026-10-29 / Asia/Seoul. 기존 번호와 충돌 없음. Supabase 이메일 Auth 2차 구현이다.

## 2. 시작 Git 상태

`main / f469cd1` (`추가 구현 3`, 2026-10-29 15:17:27 +09:00). clean이 아니었다. 직전 1차 연결의 `index.html`, `mapping.html`, `result.html` 수정과 `js/supabase-client.js`, `docs/SUPABASE_SETUP.md` 신규 파일이 미커밋 상태였다. 이 5개 변경을 보존하고 그 위에 인증을 확장했다.

## 3. 종료 Git 상태

동일 브랜치/HEAD 유지. Git 기준 추적 수정 5개·신규 13개. 신규 수에는 이미 존재하던 1차 연결 파일 2개도 포함된다. 실제 이번 작업에서 새로 만든 파일은 11개다. 커밋·push·Vercel 배포·원격 설정 변경 없음.

## 4. 1차 Supabase 연결 확인

기존 URL·Publishable Key·v2 CDN·`window.supabaseClient` 재사용. CDN과 읽기 전용 `/auth/v1/settings` HTTP 200을 다시 확인했다. 이메일 가입 enabled, signup disabled=false, mailer autoconfirm=false. Site URL/전체 비밀번호 정책은 공개 API에 노출되지 않았다. 따라서 연결 선행 조건 확인 후 구현했다. URL·키를 다른 프로젝트 값으로 바꾸지 않았다.

## 5. 추가·수정 파일

- `index.html`
- `js/app.js`
- `js/mapping-ui.mjs`
- `mapping.html`
- `result.html`
- `css/auth.css`
- `docs/SUPABASE_SETUP.md`
- `docs/auth/NB-V2-005_CHATGPT_HANDOFF.md`
- `docs/auth/NB-V2-005_REPORT.md`
- `docs/auth/README.md`
- `js/auth-bootstrap.js`
- `js/auth-core.js`
- `js/auth.js`
- `js/supabase-client.js`
- `login.html`
- `scripts/notion-poc/tests/auth-ui-harness.mjs`
- `scripts/notion-poc/tests/auth-ui.test.mjs`
- `scripts/notion-poc/tests/auth.test.mjs`

기존 공통 CSS·V1 Mock·Notion 엔진/스키마/관계/수식·매핑 파서/색상 모델·기존 명세/이력은 미수정이다. app/mapping UI에는 인증 ready 대기·늦은 초기화 차단·메모리 정리만 추가했다. HTML은 보호 표시/안내·스크립트 순서·로그인 사용 안내를 추가했다.

## 6. 실제 구현 인증

이메일 회원가입/로그인/현재 기기 로그아웃, 형식/필수/가입 8자/확인 검사, 중복 제출 잠금, 로딩, 한국어 안전 오류, 인증 메일 안내, URL 오류 처리, 세션 복원/갱신 이벤트, 보호 화면 초기 가림/직접 접근 차단, 계정 변경/로그아웃의 임시 정보 정리. 소셜/비밀번호 재설정/관리자/업무 테이블/Notion 웹 쓰기는 미구현·제외다.

## 7. 클라이언트 재사용

CDN `window.supabase`와 단일 `window.supabaseClient`를 구분한다. 초기화 중복을 막고 기존 프로젝트 설정을 유지한다. `persistSession`, `autoRefreshToken`, `detectSessionInUrl`을 true로 바꾸고 정적 브라우저 implicit flow를 명시했다. Secret/service_role Key 없음. Auth core/UI는 이 인스턴스를 받아 호출한다.

## 8. UI 변경

`login.html`, `login.html?mode=signup`에 공통 보라색 변수·실제 로고·버튼 스타일을 재사용한 중앙 카드, 레이블/자동완성, 비밀번호 표시·숨기기, 확인 입력, Enter 제출, 처리 중 비활성화와 상태 안내를 구현했다. 보호 화면 상단에는 계정 이메일·로그아웃을 추가했다. CSS에는 좁은 화면 계정 생략/줄바꿈을 정의했지만 실제 모바일 시각 검사는 미수행이다.

## 9. 로그인·세션 결과

`getSession`과 `onAuthStateChange`로 초기·변경·갱신을 반영한다. 이벤트 콜백은 동기로 끝내고 UI 작업을 예약한다. 구독 하나·떠날 때 해제·뒤로가기 캐시 재확인·늦은 초기 조회보다 최신 이벤트 우선·로그아웃 뒤 늦게 로드된 앱 초기화 차단을 구현/모의 검증했다.

사용자는 실제 로그인 후 메인 계정 표시와 새로고침 세션 유지가 정상이라고 확인했다. 실제 CDN SDK의 가상 HTTP 검사에서도 로그인→세션 저장→새 컨텍스트 복원을 통과했다. Codex가 실제 비밀번호를 받거나 직접 브라우저에서 관찰한 결과는 아니다.

## 10. 로그아웃 결과

`signOut({scope:'local'})` 사용. 성공 후 앱 sessionStorage·소유자·CSV/설계 메모리·메인 DOM·이메일 표시를 정리하고 로그인으로 이동한다. 실패는 성공으로 표시하지 않는다. 기존 소유자 없는 입력은 최초 인증에서 지우고 같은 사용자의 화면 이동/새로고침 입력은 유지한다. 계정 변경 시 이전 입력을 지운다.

사용자는 실제 로그아웃 후 로그인 화면 이동과 mapping.html 직접 진입 시 로그인 이동이 정상이라고 확인했다. 실패·교차 탭 이벤트·계정 변경·BFCache는 모의 검사다. 다른 기기 전체 로그아웃을 요청하지 않았다.

## 11. 이메일 인증 설정·검증

공개 설정상 이메일 확인 필요. 세션 없는 가입 응답은 로그인 완료로 처리하지 않고 메일 안내를 표시한다. 사용자 객체가 있어도 동일하다. callback은 현재 서비스 origin의 `login.html?confirmed=1`로 지정하고 SDK가 URL 인증을 처리한 뒤 실제 세션을 확인한다. callback 오류는 안전한 코드만 보관하고 URL hash/query의 인증 정보를 정리한다.

사용자가 로컬 Redirect URL 추가·저장, 본인 테스트 계정의 실제 회원가입·이메일 인증 완료를 확인했다. 최종 allowlist 전체 내용과 이메일 템플릿은 직접 조회하지 못했다. 실제 만료 링크는 유발하지 않았고 안전 오류 처리는 모의 검증했다.

## 12. Vercel·리다이렉트

마지막으로 사용자가 확인한 Site URL은 `http://localhost:3000`. 이후 로컬 메일 복귀 허용 주소를 추가했다고 확인했다. 로컬 실제 가입·인증은 사용자 검증 통과지만 운영 URL 설정 완료를 뜻하지 않는다.

- 로컬 로그인: `http://127.0.0.1:8766/login.html`
- 로컬 가입: `http://127.0.0.1:8766/login.html?mode=signup`
- 로컬 복귀 허용: `http://127.0.0.1:8766/login.html?confirmed=1`
- 기존 제공 배포의 복귀 후보: `https://pplus-jr6959pvz-pplus1.vercel.app/login.html?confirmed=1`

운영 전에 실제 고정 도메인을 확인하고 Site URL/Redirect URLs/메일 템플릿을 맞춰야 한다. 코드에는 localhost를 하드코딩한 가입 복귀 주소가 없다. 현재 페이지 origin/경로로 계산하며 외부 next 파라미터는 사용하지 않는다.

로컬은 정적 HTML+CDN+별도 Notion CLI. 로컬 Vercel 연결/Functions/설정 파일 없음, 원격 Git은 GitHub EST_Project다. 이전 공개 배포 조회는 인증/SSO로 이동했으며 이번 원격 설정·재배포는 수행하지 않았다. 운영 HTML 직접 접근/새 Auth의 Vercel 실행은 미검증이다.

## 13. 보안 주의점

비밀번호·실제 토큰·테스트 이메일을 소스/로그/보고서에 저장하지 않았다. 사용자 비밀번호는 직접 입력했다. 오류 원문을 UI/콘솔에 출력하지 않고 정해진 한국어 메시지로 처리한다. SDK 세션 저장은 비밀번호 저장과 구분한다. 앱 draft는 사용자 소유자를 검사한다. 인증 페이지는 no-referrer이고 URL 인증 값은 처리 후 지운다.

정적 화면 가드는 서버 권한 검증이 아니다. SDK 브라우저 세션을 Notion 쓰기 권한이나 관리자 권한으로 사용하지 않는다. 기존 Notion CLI는 로컬이며 웹 API·업무 데이터 테이블·RLS 정책은 추가하지 않았다. 향후 서버 JWT/소유권 검사와 RLS 설계가 별도로 필요하다.

## 14. 기존 기능 회귀

기존 60개 검사와 V1 모듈 256개 조합이 계속 통과한다. 입력/결과/내보내기/폼·CSV/색상 모델/Notion fixture·계산을 보존했다. 인증 이후의 앱 초기화·로그아웃 메모리 정리만 연결했다. 실제 로그인 후 V1 전체 입력/결과/CSV 기능을 브라우저에서 끝까지 수동 확인한 것은 아니므로 미검증으로 남긴다.

## 15. 테스트 명령·실제 결과

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node --check js/auth.js
node --check js/auth-core.js
node --check js/auth-bootstrap.js
node --check js/supabase-client.js
```

**95개 통과/0실패**(기존 60+Auth core/guard 23+가상 DOM UI 12). 가상 SDK/DOM 검사는 실제 브라우저가 아니다. 별도 실제 CDN SDK+가상 HTTP 검사로 단일 namespace·로그인/세션 복원/local 로그아웃·비밀번호 미저장을 확인했다.

실제 네트워크: CDN/공개 Auth 설정 HTTP 200, 사용자 본인 테스트 계정에 무작위 오답 비밀번호로 한 번 요청해 **HTTP 400 / invalid_credentials / 세션 생성 없음** 확인. 실제 비밀번호는 사용하지 않았다. 실제 회원가입·메일 인증·로그인·새로고침·로그아웃·직접 접근 차단은 사용자 직접 실행/확인 결과다. 계정 삭제·데이터 테이블/Notion 쓰기 없음.

## 16. 미검증과 이유

native Chrome 도구는 화면 캡처 실패(-3811), 별도 브라우저는 host unavailable을 반환했다. 따라서 Codex 직접 브라우저 관찰·모바일 시각 검사·다중 탭 실동작·BFCache 실동작은 미수행이다. 핵심 실제 화면 흐름은 사용자 확인으로 보완했다. 운영 배포/최종 설정·메일 템플릿·전체 비밀번호 정책·실제 만료 링크·실제 429/네트워크 장애/서비스 5xx 유발도 미검증이다. 해당 오류 경로는 모의 검사다.

## 17. 오류·해결

1차 연결은 로그인용 세션 기능이 꺼져 있어 요구 범위에 맞게 켰다. 기존 사용자 변경과 client를 재사용했다. CDN 실패는 보호 화면을 열어두지 않고 오류·재시도로 바꿨다. Site URL이 localhost 기본값이라 사용자에게 정확한 로컬 Redirect URL 추가를 안내했고 사용자가 가입/인증을 완료했다. 동기 Auth 이벤트에서 비동기 Auth를 기다리지 않도록 예약 처리했다. 늦은 session 조회·로그아웃 실패 이벤트·늦은 앱 로딩이 상태를 뒤집지 않도록 검사했다.

## 18. 남은 위험

브라우저 저장소/XSS 방어와 인증 토큰 보호를 계속 유지해야 한다. 현재 화면 가드는 서버 권한/RLS가 아니며 사용자 데이터의 영구 격리·보관 기능도 없다. 운영 Site URL·allowlist·배포 검증이 남아 있다. frontend 최소 8자 외 서버 비밀번호 정책은 응답으로 처리하며 전체 설정은 미확인이다. CDN @2는 v2 최신 버전으로 갱신되는 방식이다. 기존 V1의 로고 참조/일부 localStorage 예외는 범위를 넓혀 수정하지 않았다.

## 19. 다음 개발 추천

운영 고정 도메인과 인증 URL 설정을 확인하고 별도 승인된 배포/실제 모바일 검증을 진행한다. 이후 사용자별 교육 운영 설정/템플릿 저장을 데이터 모델·소유권·RLS와 함께 설계한다. Notion 웹 생성은 서버 JWT·연결 소유권·권한·영구 작업 상태·중복 방지를 선행한다. 전체 KPI 편집·소셜·비밀번호 재설정·Business 테스트는 이번 작업에 앞당겨 넣지 않았다.
