# [ChatGPT 전달용] NB-V2-005 Supabase Auth 구현 결과 및 다음 개발 검토

기준일 2026-10-29 / EST_Project. ChatGPT가 기획·검토, Codex가 구현·검증을 담당한다. 목표는 AI 없는 규칙 기반 교육 운영 Notion 대시보드 빌더다.

## 기존 상태·이번 범위

V1은 HTML/CSS/바닐라 JS의 Mock 설계·결과/내보내기다. 별도 Node Notion CLI는 NB-V2-002A에서 개인 Free DB/관계/수식·출석률 75→100%를 실제 검증했다. NB-V2-003은 별도 폼·CSV 헤더 매핑/색상 편집/스키마 Dry Run을 구현했고 기존 검사는 60개였다. Business Dashboard·새 매핑의 실제 생성·Notion 웹 쓰기는 미완료다.

직전 Supabase 1차는 v2 CDN·별도 초기화 파일·Publishable Key로 단일 client를 연결하고 읽기 HTTP 200을 확인했다. 시작 main/f469cd1에는 1차 HTML 3개 수정과 client/안내 2개 신규가 미커밋 상태였다. 보존·재사용했다. 이번 종료도 같은 HEAD이며 커밋·push·운영 배포·원격 설정 변경은 없다.

이번은 이메일 가입·로그인·현재 기기 로그아웃·세션 유지·화면 보호다. React/Next.js·Secret/service_role·업무 테이블·RLS·소셜·비밀번호 재설정·Notion 웹 API는 추가하지 않았다.

## 파일·구조

Git 기준 수정 5개·신규 13개(신규 중 1차에서 이미 존재한 2개 포함).

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

공통 bootstrap(헤드) → v2 CDN(defer) → 기존 client(defer) → auth-core/deferred UI → 기존 app/module 순서다. window.supabase는 CDN namespace, window.supabaseClient는 재사용 client다. URL/Publishable Key는 기존 값을 유지했다. 기존 공통 CSS·색상/CSV 파서·Notion 엔진/스키마/계산은 미수정이다.

## 구현 결과

login.html과 login.html?mode=signup에서 이메일·비밀번호·확인, 입력 검사·처리 중 잠금·한국어 오류·비밀번호 표시/숨김·Enter 제출을 제공한다. 공통 보라색 변수·로고·버튼으로 중앙 카드와 반응형 계정 표시를 구성했다. 모바일 CSS는 있으나 실제 모바일 시각 검사는 미수행이다.

signup은 signUp, signin은 signInWithPassword, signout은 signOut({scope:'local'})다. 가입 user 객체만 있고 session이 없으면 로그인하지 않고 이메일 확인을 안내한다. 가입 중복 계정 존재를 추가로 노출하지 않는 안내를 사용한다. 프로젝트 공개 설정상 이메일 가입 허용/자동 인증 false를 확인했다. frontend 최소 8자를 검사하며 실제 서버의 전체 문자/길이 정책은 미확인이다. 추가 서버 정책은 weak_password 오류로 안내한다.

persistSession/autoRefreshToken/detectSessionInUrl=true, 정적 브라우저 implicit flow를 사용한다. getSession과 onAuthStateChange로 갱신하며 콜백은 동기로 끝내고 UI를 예약한다. 구독 중복·늦은 초기 조회·실패한 로그아웃 이벤트·로그아웃 뒤 늦은 앱 초기화가 잘못된 상태를 만들지 않게 검사했다.

index/result/mapping은 인증 확인 전 숨기고 비로그인 직접 진입을 login으로 보낸다. 인증 ready 이후에만 기존 앱을 초기화한다. 로그인 후 기존 index로 이동하며 외부 next를 사용하지 않는다. 페이지 캐시 복원은 숨긴 상태에서 세션을 재확인한다.

로그아웃 성공/계정 변경 시 sessionStorage의 앱 입력·소유자, 메인 DOM·계정 표시·폼/CSV 메모리를 지운다. 소유자 없는 과거 임시 입력도 최초 인증 때 제거한다. 같은 사용자의 페이지 이동/새로고침 입력은 유지한다. 로그아웃 실패는 성공으로 표시하지 않는다. 다른 기기 전체 로그아웃은 요청하지 않는다.

## 실제 검증과 모의 검증 구분

자동: node --test scripts/notion-poc/tests/*.test.mjs → 95개 통과/0실패. 기존 60+Auth core/guard 23+가상 DOM UI 12. V1 Mock 256개 조합 포함. 실제 CDN SDK도 가상 HTTP로 로그인→세션 저장→새 컨텍스트 복원→local 로그아웃을 검사했다. 이를 실계정/브라우저 성공과 혼동하면 안 된다.

실제 네트워크: CDN/공개 설정 HTTP 200. 본인 테스트 계정에 무작위 오답 비밀번호를 한 번 보내 HTTP 400/invalid_credentials/세션 없음 확인. 실제 비밀번호는 받거나 기록하지 않았다.

사용자 직접 검증 완료:
- 로컬 Redirect URL 추가·저장
- 실제 본인 이메일 회원가입·메일 인증
- 로그인 후 메인 상단 계정 표시
- 새로고침 후 로그인 유지
- 로그아웃 후 로그인 화면 이동
- mapping.html 직접 진입 시 로그인 화면 이동

Codex 직접 브라우저 검증은 도구의 화면 캡처 실패/브라우저 호스트 사용 불가로 수행하지 못했다. 사용자 확인 결과와 구분해 기록했다. 실제 만료 링크·429/네트워크/5xx·교차 탭·BFCache·모바일·인증 후 V1 전체 수동 동선은 미검증이며 해당 로직은 모의 검사다.

## Vercel·리다이렉트

사용자가 확인한 Site URL은 http://localhost:3000 이었다. 이후 다음 로컬 복귀 주소 추가와 실제 가입/인증 성공을 확인했다.
http://127.0.0.1:8766/login.html?confirmed=1

로컬 로그인/가입은 같은 origin의 login.html, login.html?mode=signup이고 메인은 index.html이다. 코드의 emailRedirectTo는 현재 페이지 주소 기준으로 계산한다. localhost/127.0.0.1은 다른 저장소이므로 테스트 중 origin을 일관되게 사용해야 한다.

기존 사용자 제공 배포 주소의 복귀 후보:
https://pplus-jr6959pvz-pplus1.vercel.app/login.html?confirmed=1

이 주소에 새 Auth가 배포된 것은 아니다. 운영 고정 도메인·Site URL·Redirect URLs·메일 템플릿·최종 allowlist는 추가 확인해야 한다. 현재 localhost 기본값을 운영 설정 완료로 처리하지 말아 달라. Vercel Git 연결/빌드 설정은 로컬에서 확인할 정보가 없고 과거 공개 조회는 인증/SSO로 이동했다. 이번 설정 변경·push·배포는 하지 않았다.

## 보안·기존 기능·남은 위험

Publishable Key만 사용한다. 비밀번호·실제 토큰·테스트 계정 정보는 보고서/소스/앱 로그에 저장하지 않는다. 오류 원문을 출력하지 않는다. SDK가 세션 token을 브라우저 저장소로 관리하는 것과 비밀번호 저장을 구분한다. URL 인증 값은 처리 후 제거하고 referrer를 제한했다.

정적 화면 가드와 getSession 브라우저 상태는 서버 권한 검증이 아니다. Notion CLI는 계속 로컬 전용이며 Auth가 Notion 쓰기/관리자 권한을 부여하지 않는다. 향후 서버 JWT·사용자 소유권 검증과 업무 테이블 RLS가 별도로 필요하다.

기존 Mock/결과/폼·CSV/색상/Notion 계산은 보존하고 인증 전 초기화만 막았다. 이전 V1 로고 참조/일부 localStorage 예외 문제는 범위를 넓혀 수정하지 않았다.

로컬 핵심 인증 구현·사용자 실계정 확인은 완료다. 운영 배포/리다이렉트와 직접 브라우저/모바일 검증이 남아 전체는 부분 완료다. 다음은 운영 고정 URL/인증 설정 검토·별도 승인된 배포/모바일 검증, 이후 사용자별 교육 설정·템플릿 저장을 소유권/RLS와 함께 설계하는 순서를 추천한다. Notion 웹 생성은 서버 권한·영구 실행 상태·중복 방지 설계 뒤 진행해야 한다.

위 내용은 Codex가 실제 프로젝트에서 수행한 Supabase Auth 2차 구현 결과입니다.

ChatGPT는 지금까지 합의한 AI 없는 규칙 기반 교육 운영 Notion 대시보드 빌더의 기획 및 개발 이력과 비교해 주세요.

1. Supabase Auth 구현이 정상적으로 완료됐는지 검토해 주세요.
2. 회원가입·로그인·로그아웃·세션 유지 기능을 각각 평가해 주세요.
3. 기존 V1과 Notion PoC의 기능이 보존됐는지 확인해 주세요.
4. 로그인 UI가 기존 서비스의 디자인과 일관되는지 검토해 주세요.
5. 보안과 권한 관리에서 위험한 부분이 없는지 확인해 주세요.
6. Vercel 배포와 인증 리다이렉트가 올바른지 평가해 주세요.
7. 완료·부분 완료·미완료 항목을 구분해 주세요.
8. 이후 사용자별 템플릿 저장, 교육 운영 설정 저장, Notion 생성 기능의 웹 연동 등 다음 개발 우선순위를 제안해 주세요.
9. 보완이 필요하다면 다음 Codex 수정 프롬프트를 작성할 수 있도록 문제를 정리해 주세요.

실제 구현과 테스트 결과를 구분하고, 확인되지 않은 내용을 완료 처리하지 마세요.
