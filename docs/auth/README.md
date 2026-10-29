# NB-V2-005 Supabase Auth 사용·설정 안내

기준일: 2026-10-29. 기존 Supabase v2 CDN·Project URL·Publishable Key·단일 `window.supabaseClient`를 재사용한다. 로그인 기능이 추가되었으며 기존 연결 단계의 세션 비활성화 설정은 이번에 변경했다. Notion 웹 생성·업무 테이블·권한 역할·배포는 추가하지 않는다.

NB-V2-005A 최신 상태: 운영 Site URL과 Production/로컬 callback 2개는 승인 후 적용·재조회 완료했다. 현재 운영은 main/4bff220이며 기본 사용자 동선도 확인했다. 최신 결과는 [NB-V2-005A 보고서](../deployment/NB-V2-005A_REPORT.md)를 기준으로 한다. 아래 localhost 기록은 이전 확인 시점의 이력이다.

## 화면과 이동

| 경로 | 용도 |
| --- | --- |
| `login.html` | 이메일 로그인 |
| `login.html?mode=signup` | 이메일·비밀번호·확인을 받는 회원가입 |
| `login.html?confirmed=1` | 이메일 인증 복귀 후 SDK 세션 확인 |
| `index.html` | 인증된 사용자의 기존 입력 화면 |
| `result.html` | 인증된 사용자의 기존 Mock 결과 |
| `mapping.html` | 인증된 사용자의 기존 폼/CSV·색상 매핑 |

인증 전 보호 화면의 header/main/footer는 CSS로 숨긴다. 확인 중 상태·실패 시 다시 확인 링크를 표시한다. 비로그인 직접 진입은 로그인으로 이동한다. 인증이 확인된 뒤에만 기존 입력/결과/매핑 코드를 초기화한다. 로그인은 원래 `index.html`로 이동하며 외부 `next` 주소는 받지 않는다.

회원가입은 `signUp`, 로그인은 `signInWithPassword`, 로그아웃은 `signOut({scope:'local'})`를 사용한다. 사용자 객체만 있고 세션이 없으면 이메일 확인을 안내하고 로그인 완료로 처리하지 않는다. 중복 계정 존재를 추가로 밝히지 않는 가입 안내를 사용한다.

## 코드 구조

- `js/auth-bootstrap.js`: 헤드에서 ready Promise·오류 코드·콜백 여부만 준비한다. 토큰/원문 오류 설명은 별도로 복사하지 않는다. 20초 지연 시 안내/재시도를 제공한다.
- `js/supabase-client.js`: 기존 URL/Publishable Key·CDN namespace를 유지하고 클라이언트는 `window.supabaseClient`로 한 번만 생성한다. 세션 저장·자동 갱신·URL 인증 처리를 켜고 정적 브라우저용 implicit flow를 명시한다.
- `js/auth-core.js`: 입력 검사, 안전한 한국어 오류, draft owner 정리, 공유 클라이언트 Auth 제어·동시 요청/리스너/경쟁 상태 관리. 이벤트 콜백은 동기이며 UI 반영을 다음 작업으로 예약해 SDK 잠금 안에서 Auth 호출을 기다리지 않는다.
- `js/auth.js`: 로그인·가입 전환, 비밀번호 표시/숨기기·최종 값 지우기, 상태 확인, 보호 화면, 계정 이메일·로그아웃, 뒤로가기 캐시 재확인.
- `css/auth.css`: 기존 공통 CSS 변수/로고/버튼에 맞춘 인증 카드·반응형 상단 계정 UI·초기 가림.
- 기존 `js/app.js`, `js/mapping-ui.mjs`: 인증 ready를 기다리는 최소 연결과 로그아웃 시 메모리 입력 정리만 추가했다.

스크립트 순서: 헤드 bootstrap → v2 CDN(defer) → 기존 client(defer) → core(defer) → auth UI(defer) → 기존 app/deferred module. 기존 앱이 먼저 저장된 입력을 표시하는 것을 막는다.

## 입력·오류·세션

이메일 형식·필수 비밀번호·가입 시 8자 이상·확인 일치를 검사한다. 8자는 프런트엔드 최소 기준이며 실제 프로젝트의 전체 비밀번호 정책을 조회했다고 주장하지 않는다. 서버가 추가 문자/길이/유출 비밀번호 정책을 거절하면 `weak_password`를 한국어로 안내한다. 현재 공개 설정 API는 최소 길이·문자 정책을 노출하지 않았다.

비밀번호를 별도 DB·앱 저장소·로그에 저장하지 않는다. SDK 요청 처리 후와 페이지 이탈 시 입력값을 지운다. 인증 세션의 access/refresh token은 SDK가 브라우저 저장소로 관리한다. 이는 비밀번호 저장과 다르며 같은 origin에서 세션 복원을 가능하게 한다. 토큰을 보고서·콘솔에 출력하지 않는다.

`getSession()`으로 SDK 세션을 읽고 `onAuthStateChange`로 로그인/로그아웃/토큰 갱신을 반영한다. 구독은 하나만 등록하고 떠날 때 해제한다. BFCache 복원은 화면을 숨긴 상태로 다시 검사한다. 로그인/로그아웃과 늦은 초기 조회 결과가 경쟁하면 더 최신 인증 이벤트를 우선한다.

현재 기기 로그아웃 성공 후 입력 세션 키 `aiNotionBuilderRequirements`와 소유자 키 `estAuthDraftOwner`를 지우고, 폼/CSV 메모리·메인 DOM·계정 표시를 지운 뒤 로그인으로 이동한다. 다른 기기의 전체 로그아웃을 요청하지 않는다. 실패하면 성공으로 표시하지 않는다. 계정이 바뀌어도 기존 입력을 지우고 페이지를 다시 연다. 이전 로그인 기능이 없던 시점의 소유자 없는 임시 입력은 첫 인증 확인에서 지운다. 같은 사용자로 새로고침/화면 이동할 때는 소유자가 일치하는 입력을 유지한다.

## 실제 설정 확인 결과

읽기 전용 `/auth/v1/settings`:

- 이메일 가입 허용: 확인.
- 회원가입 비활성화: false.
- 이메일 자동 인증: false → 이메일 확인 필요.
- Site URL/Redirect URLs/전체 비밀번호 정책: 공개 API에 노출되지 않음.

사용자가 대시보드의 현재 Site URL이 `http://localhost:3000`이라고 확인했다. 이후 사용자가 요청한 로컬 Redirect URL 추가·저장과 실제 회원가입·이메일 인증 완료를 확인했다. 최종 allowlist 전체 값은 직접 조회하지 못했다. 프로젝트 인증 설정은 Codex가 변경하지 않았다.

## 로컬·Vercel URL 설정

현재 로컬 검증 주소:

- 로그인: `http://127.0.0.1:8766/login.html`
- 가입: `http://127.0.0.1:8766/login.html?mode=signup`
- 메일 복귀: `http://127.0.0.1:8766/login.html?confirmed=1`
- 메인: `http://127.0.0.1:8766/index.html`

Supabase Dashboard → Authentication → URL Configuration → Redirect URLs에 메일 복귀 주소를 추가/저장해야 한다. Site URL을 바꾸지 않고도 명시한 `emailRedirectTo`가 허용되면 이 로컬 주소로 돌아올 수 있다. 허용되지 않으면 현재 Site URL로 돌아갈 수 있어 localhost:3000 복귀 문제를 확인해야 한다. 브라우저의 `localhost`와 `127.0.0.1`은 저장소가 다르므로 테스트 중 하나를 일관되게 사용한다. `file://`로 열지 않는다.

기존 사용자 제공 Vercel 주소에 대한 검토 값:

- 대표 주소 후보: `https://pplus-jr6959pvz-pplus1.vercel.app/`
- 로그인: `https://pplus-jr6959pvz-pplus1.vercel.app/login.html`
- 가입: `https://pplus-jr6959pvz-pplus1.vercel.app/login.html?mode=signup`
- 메일 복귀 허용값: `https://pplus-jr6959pvz-pplus1.vercel.app/login.html?confirmed=1`
- 메인: `https://pplus-jr6959pvz-pplus1.vercel.app/index.html`

이 주소는 사용자가 알려준 기존 배포 주소다. 인증 코드가 배포되었다는 뜻이 아니다. 고정 운영 도메인이 따로 있으면 그 정확한 도메인으로 위 경로를 구성하고 Site URL도 실제 대표 주소로 설정해야 한다. 현재 localhost Site URL을 운영 설정 완료로 취급하지 않는다. Supabase 메일 템플릿이 기본 ConfirmationURL을 사용하는지도 확인한다. 사용자 정의 템플릿을 사용하면 RedirectTo 적용 여부를 별도로 점검한다.

이전 작업의 공개 Vercel 요청은 인증/SSO로 이동했다. 이번에는 Git push·운영 재배포·Vercel/Supabase 설정 변경을 하지 않았다. Git 연동이면 push가 배포로 이어질 수 있으므로 별도 승인 없이 수행하지 않는다.

근거: [가입](https://supabase.com/docs/reference/javascript/auth-signup), [인증 이벤트](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [세션](https://supabase.com/docs/reference/javascript/auth-getsession), [현재 기기 로그아웃](https://supabase.com/docs/reference/javascript/auth-signout), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [비밀번호 정책](https://supabase.com/docs/guides/auth/password-security).

## 검증·사용자 확인

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node --check js/auth.js
node --check js/auth-core.js
node --check js/auth-bootstrap.js
```

자동 검사 95개(기존 60+인증 관련 35)가 통과했다. 인증 검사는 순수 Auth 제어와 가상 DOM/SDK 응답을 사용한다. 실제 CDN SDK도 가상 HTTP 응답으로 로그인→저장→새 컨텍스트 복원→local 로그아웃을 검사했다. 이 결과를 실제 계정 로그인이나 브라우저 E2E 성공으로 취급하지 않는다.

브라우저 도구는 native 캡처 실패와 별도 브라우저 호스트 사용 불가를 반환했다. 사용자는 실제 회원가입·이메일 인증, 로그인 계정 표시, 새로고침 세션 유지, 로그아웃, 매핑 화면 직접 진입 차단을 직접 확인해 정상이라고 답했다. 이를 Codex의 직접 브라우저 관찰과 구분한다. 비밀번호는 채팅·소스·보고서에 전달하지 않았다.

확인 순서: Redirect URL 저장 → 본인 테스트 이메일로 가입 → 비밀번호 확인/오류 메시지 확인 → 메일 인증 → 메인 이동/계정 표시 → 새로고침 → 가상 교육 입력/결과/매핑 → 로그아웃 → index/result/mapping 직접 진입 차단 → 뒤로가기 → 재로그인. 모바일의 카드·계정 표시도 확인한다.

## 권한의 한계

정적 HTML/CSS/JS 가드는 화면 표시를 제어할 뿐 서버 자원 접근 권한을 부여하지 않는다. `getSession`의 브라우저 상태를 서버 권한 검증으로 사용하면 안 된다. Notion CLI는 계속 로컬 전용이며 웹 쓰기 API를 추가하지 않았다. 향후 서버에서 JWT/사용자 소유권·권한을 검증하고 업무 테이블을 도입할 때 RLS를 별도 설계해야 한다. 관리자·service_role·Secret Key·업무 데이터 테이블·비밀번호 재설정·소셜 로그인은 이번에 추가하지 않았다.

추가 실제 API 검사: 사용자 본인 테스트 계정에 무작위 오답 비밀번호로 한 번 로그인 요청하여 HTTP 400 / invalid_credentials / 세션 없음 확인. 실제 비밀번호는 사용·기록하지 않았다. 운영 Vercel 인증·모바일 시각·실제 만료 링크·실제 요청 제한/네트워크 장애 유발은 미검증이다.
