# [ChatGPT 전달용] NB-V2-005A 인증 배포 준비 및 검증 결과

기준일 2026-10-29 / EST_Project. ChatGPT가 기획·검토, Codex가 구현·테스트를 담당한다. 이번은 기존 Auth의 배포 준비·회귀 점검이며 인증 재개발이 아니다.

## 시작 상태와 중요한 최신 사실

main/4bff220 clean으로 시작했다. 이전 미커밋 Supabase/Auth 구현은 사용자가 이 커밋에 포함했다. 현재도 같은 HEAD이며 커밋·push·배포하지 않았다.

사용자가 확인한 실제 Production은 https://pplus-rouge.vercel.app 이고 연결 저장소는 jsyTest/EST_Project, Production Branch는 main이다. 공개 브라우저 파일 18개가 HTTP 200이며 기준 커밋 파일과 바이트/해시가 일치한다. **기존 NB-V2-005 Auth는 이미 Production에 있다.** 인증된 Vercel 대시보드에서도 현재 배포의 Ready 상태와 Source main/4bff220355e63ee153fe6c947f09348fd2aa6ae2를 확인했다. 배포 대시보드 경로는 H8mMZAh6mBk4Vm2zdjktjUD5kdB8, 배포 URL은 pplus-f946o20jk-pplus1.vercel.app이다.

기존 pplus-jr6959pvz-pplus1.vercel.app은 확인한 페이지 모두 Vercel SSO로 302 이동한다. 계정의 배포 목록에서 이 주소가 main/8169eca의 이전 Production임을 확인했다. Preview가 아니다. 새 Preview도 만들지 않았다. main push가 Production 배포를 유발할 수 있어 push하지 않았다.

## 실제 변경 파일과 결과

- `.gitignore`
- `index.html`
- `js/app.js`
- `result.html`
- `docs/SUPABASE_SETUP.md`
- `docs/auth/README.md`
- `docs/deployment/NB-V2-005A_ACCOUNT_VERIFICATION.json`
- `docs/deployment/NB-V2-005A_CHATGPT_HANDOFF.md`
- `docs/deployment/NB-V2-005A_DEPLOYMENT_PLAN.md`
- `docs/deployment/NB-V2-005A_PUBLIC_MANIFEST.json`
- `docs/deployment/NB-V2-005A_REMOTE_EVIDENCE.json`
- `docs/deployment/NB-V2-005A_REPORT.md`
- `scripts/deployment/build-static.mjs`
- `scripts/notion-poc/tests/deployment.test.mjs`
- `scripts/notion-poc/tests/service-flow.test.mjs`
- `vercel.json`

- result.html: 없는 로고 파일 참조를 기존 실제 로고로 수정.
- js/app.js: 저장 입력 형식·허용 모듈 확인, 잘못된 입력은 빈 상태. 저장 실패는 잡아서 입력 유지/오류 표시/이동 중단.
- index.html: 저장 실패 안내 영역.
- 로컬 Vercel 설정과 공개 빌드: node scripts/deployment/build-static.mjs → public-dist, 웹 파일 18개만 출력. 생성물은 Git 제외.
- 서비스 흐름/보안·공개 빌드 회귀 검사와 문서/증거 작성.

Auth 코드·CDN/키·공통 CSS·매핑 파서/색상 모델·Notion CLI/관계/수식은 미수정이다. 사용자별 설정 저장·템플릿·업무 테이블/RLS·Notion 웹 쓰기는 추가하지 않았다.

## 실제 보안 확인과 배포 차이

Production은 내부 CLI `/scripts/notion-poc/cli.mjs`와 작업 보고서 `/docs/auth/NB-V2-005_REPORT.md`도 200으로 제공한다. CLI가 서버 쓰기 API로 실행된다는 의미는 아니다. 확인한 .env/Git 설정/실행 manifest 경로는 404였고, 검사한 응답에서 알려진 Notion 토큰/Secret Key 표식은 발견하지 못했다. 전체 원격 자원의 비밀값 부재를 보증하지 않는다.

이를 줄이는 public-dist allowlist 빌드와 vercel.json을 로컬에 준비했다. framework=null, Build Command=node scripts/deployment/build-static.mjs, Output Directory=public-dist이다. 내부 문서/CLI/테스트/비밀 설정/실행 상태는 출력하지 않는다. HTML·CSS·브라우저 JS·기존 로고만 포함한다. 실제 배포는 하지 않았으므로 **현재 Production의 내부 경로 노출은 아직 남아 있다.**

현재 Production과 로컬 웹 파일 차이는 index.html, result.html, js/app.js 3개다. 나머지 공개 파일 15개는 같다. 새 빌드 설정·테스트·문서는 로컬 준비물이다.

## Supabase 설정·승인 상태

프로젝트 pxkjxcryceqtjomgxyfe. 변경 전 값은 로그인된 대시보드에서 Site URL=http://localhost:3000, Redirect URLs 없음으로 직접 확인했다. 기본 가입 확인 메일 템플릿은 {{ .ConfirmationURL }} 링크를 사용하며 변경하지 않았다. 공개 Auth 설정은 이메일 허용·자동 인증 false다.

승인 후 실제 적용·재조회한 설정:

```text
Site URL: https://pplus-rouge.vercel.app
Redirect URLs:
https://pplus-rouge.vercel.app/login.html?confirmed=1
http://127.0.0.1:8766/login.html?confirmed=1
```

사용자는 “Supabase 연결 기능 설치 후 Codex 변경 승인”이라고 답했다. 플러그인 설치 확인 후 인증된 브라우저로 승인된 URL만 저장했다. 새 탭에서 정확한 Site URL과 두 Redirect URLs가 유지되는 것을 확인했다. 서비스 실행 도구는 현재 대화에 표시되지 않아 브라우저를 사용했다. Git/배포/메일 템플릿/와일드카드는 승인 범위가 아니다. 운영 메일 복귀를 검증 완료로 처리하면 안 된다.

사용자 추가 확인: 실제 Production에서 로그인 후 교육명 입력 화면 표시, `테스트 교육` 입력 후 설계 결과 화면 표시, 요구사항 수정 시 교육명 복원까지 확인했다. 로그아웃 후 뒤로가기를 눌러도 로그인 화면이 보이는 것까지 사용자 확인을 받았다.

## 테스트와 미검증 구분

node --test scripts/notion-poc/tests/*.test.mjs → 103개 통과/0실패.
기존 95+서비스/정적 자원 6+공개 빌드 2. V1 256개 조합 포함.
node scripts/deployment/build-static.mjs → 공개 파일 18개 출력 통과.

가상 DOM에서 인증 후 입력→Mock 결과→복사→입력 수정→새로고침 복원과 폼/CSV→색상 편집→스키마 미리보기를 확인했다. HTML 모양 사용자 입력을 textContent로 출력하고 잘못된 저장/실패도 처리한다. 모의 검사는 브라우저 E2E가 아니다.

매핑 편집값은 여전히 메모리 전용이므로 이동/새로고침 유지는 미구현이다. V1 입력의 같은 사용자 sessionStorage 유지와 구분한다. 로그아웃·계정 전환·BFCache·Auth 장애·중복 제출은 기존 모의 검사 범위다.

이번에 native Chrome 접근이 복구되어 Supabase/Vercel 계정 설정을 직접 확인했다. 실제 서비스의 로그인→교육명 입력→설계 결과→수정 시 교육명 복원→로그아웃 후 뒤로가기 차단은 사용자가 단계별로 확인했다. 모바일/교차 탭은 일반 의견만 받아 개별 완료로 처리하지 않았다. URL 변경 후 실제 새 메일의 수신·클릭 복귀와 이번 Production의 새로고침 세션 재확인은 남아 있다. 이전 로컬 검증을 운영 검증으로 옮겨 적지 않았다.

## 현재 판정과 다음 단계

로컬 배포 준비·자동 검사 103개·승인된 Supabase 설정 적용·기본 사용자 동선 확인은 완료했다. 새 코드 배포·메일 실전 복귀·추가 화면 검증은 남아 전체는 부분 완료다. 업무 테이블·서버 쓰기 API·RLS는 없다. 정적 UI 가드가 서버 권한 검증이라고 가정하지 않는다.

Vercel 프로젝트는 pplus1/pplus, Project ID prj_5Bxefw0g4RQLUSDXjui5do4tfC9n이다. Framework Other, Root Directory 빈 값(저장소 루트), Node 24.x와 main push의 Production 배포 안내를 확인했다. Build/Output override 세부값은 미확인이다. 계정 설정/배포 증거는 NB-V2-005A_ACCOUNT_VERIFICATION.json에 기록했다. Supabase URL 설정 외 원격 변경, Git 커밋·push·새 배포는 없다.

다음은 별도 승인된 Preview에서 공개 출력/내부 경로 404·Auth/메일/모바일·교차 탭을 검증하는 단계다. Production 승격은 별도 승인이 필요하다. 배포 계획에 변경 파일·사용자 영향·이전 배포 재승격과 Supabase 설정 복구의 차이를 기록했다. 다음 기능 개발은 사용자별 교육 설정·템플릿 저장을 소유권/RLS와 함께 설계하는 단계다.

위 내용은 Codex가 실제 프로젝트에서 수행한 NB-V2-005A 작업 결과입니다.

ChatGPT는 지금까지 확정한 AI 없는 규칙 기반 Notion 교육 운영 대시보드 빌더의 요구사항과 비교해 주세요.

1. 기존 Supabase Auth 기능이 정상 유지됐는지 평가해 주세요.
2. Vercel 배포와 이메일 인증 리다이렉트 구성이 적절한지 검토해 주세요.
3. 실제 배포된 기능과 로컬에서만 구현된 기능을 구분해 주세요.
4. 보안상 문제가 있는지 확인해 주세요.
5. 기존 V1·CSV 매핑·Notion PoC가 보존됐는지 검토해 주세요.
6. 다음 작업인 사용자별 교육 설정·템플릿 저장 기능의 개발 우선순위를 제안해 주세요.
7. 추가 수정이 필요하면 후속 Codex 프롬프트를 작성할 수 있도록 문제를 정리해 주세요.

완료·부분 완료·미검증을 구분하고 확인되지 않은 기능을 성공 처리하지 마세요.
