# [NB-V2-005A 작업 보고서]

기준일: 2026-10-29 / Asia/Seoul.

**판정: 로컬 배포 준비·자동 회귀·승인된 Supabase URL 적용 완료. 실제 서비스 기본 동선은 사용자 확인 완료이며, 새 코드 배포·메일 실전 복귀·추가 화면 검증은 남아 전체는 부분 완료다.** 새 코드 커밋·push·Vercel 배포는 하지 않았다.

## 1. 시작·종료 Git 상태

시작 `main / 4bff220` (`추가 구현 4 (DB)`, 2026-10-29 15:43:01 +09:00), clean, 로컬 origin/main과 같음. 종료도 같은 브랜치·HEAD. Git 기준 추적 수정 6개·신규 10개. 커밋·push·브랜치 생성·배포 없음.

## 2. 기존 미커밋 변경 보존

NB-V2-005 당시의 미커밋 연결/인증 파일은 사용자가 기준 커밋에 포함했다. 이번 시작에는 미커밋 변경이 없었다. 과거 dirty 상태라고 가정하지 않았으며 사용자 인증 구현·Notion CLI·기존 문서 이력을 보존했다.

## 3. 실제 변경 파일

- `.gitignore`
- `docs/SUPABASE_SETUP.md`
- `docs/auth/README.md`
- `index.html`
- `js/app.js`
- `result.html`
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

새로 추가한 계정 확인 JSON과 최신 안내 문서 갱신은 설정 적용/검증 이력이다. 애플리케이션 코드·빌드 산출물은 기존 103개 검사 통과 시점과 같으며 Auth·Notion CLI는 미수정이다. public-dist 18개는 Git 제외다.

## 4. Vercel Production·Preview

인증된 Vercel 대시보드에서 프로젝트 pplus / 팀 pplus1 / Project ID prj_5Bxefw0g4RQLUSDXjui5do4tfC9n을 직접 확인했다. 연결 저장소는 jsyTest/EST_Project이며 현재 Production은 https://pplus-rouge.vercel.app 이다.

현재 Ready 배포: https://pplus-f946o20jk-pplus1.vercel.app
배포 상세: https://vercel.com/pplus1/pplus/H8mMZAh6mBk4Vm2zdjktjUD5kdB8
Source: main / 4bff220355e63ee153fe6c947f09348fd2aa6ae2, 생성 2026-10-29 15:43:07 +09:00. 공개 파일 18개와 기준 커밋의 바이트/해시 일치도 확인했다. 기존 Auth는 이미 배포돼 있다.

기존 pplus-jr6959pvz-pplus1.vercel.app은 Preview가 아니라 **이전 Production**이었다. 대시보드 경로 F7gyCrZfF3tj5KRrYUShEiECQzvG, Source main/8169eca795df22caef5ca70426bb035109703f11, 생성 2026-10-29 14:30:50 +09:00. 공개 요청은 여전히 SSO로 302 이동한다.

Vercel UI에 “To update your Production Deployment, push to the main branch.”가 표시된다. main push가 운영 변경으로 이어지는 연결을 확인했고 이번에는 push하지 않았다. Framework Other, Root Directory 빈 값(저장소 루트), Node 24.x를 읽었다. Build/Output override 세부값은 확정해서 읽지 못했으며 원격 설정은 변경하지 않았다.

## 5. Supabase URL 설정

프로젝트 pxkjxcryceqtjomgxyfe의 로그인된 Supabase Dashboard에서 변경 전 Site URL=http://localhost:3000, Redirect URLs 없음임을 직접 확인했다. 사용자의 기존 “Supabase 연결 기능 설치 후 Codex 변경 승인”에 따라 다음 값만 저장했다.

```text
Site URL: https://pplus-rouge.vercel.app
Redirect URLs:
https://pplus-rouge.vercel.app/login.html?confirmed=1
http://127.0.0.1:8766/login.html?confirmed=1
```

Site URL 저장 성공 안내를 확인했다. 복귀 URL 저장 후 화면이 비어 보여 새 탭에서 같은 설정 페이지를 재조회했고 Site URL과 Total URLs: 2, 정확한 두 주소를 확인했다. 중복 저장·추가 URL·와일드카드·비밀번호 정책 변경은 하지 않았다.

Supabase/Vercel/GitHub/Notion 플러그인 설치를 확인했고 계정 연결은 사용자가 완료했다고 알렸다. 현재 대화의 서비스 실행 도구는 표시되지 않아, 접근이 복구된 인증 브라우저로 실제 적용·검증했다. 연결 대기 상태가 더 이상 아니다.

가입 메일 템플릿을 읽기 전용 확인했다. 기본 템플릿을 사용하며 링크는 {{ .ConfirmationURL }}이다. 메일 템플릿·SMTP는 변경하지 않았다. URL 적용과 별개로 실제 새 메일 수신/클릭 복귀는 아직 미검증이다.

## 6. 로그인·가입·로그아웃

기존 인증 UI·단일 client·세션 처리 코드는 그대로다. 이번 실제 사이트에서 사용자가 로그인→교육명 입력 화면→테스트 교육 설계 결과→요구사항 수정 시 교육명 복원→로그아웃 후 뒤로가도 로그인 화면 표시를 단계별로 명확히 확인했다. 이는 사용자 직접 검증이며 Codex의 직접 화면 조작 테스트와 구분한다.

가입·메일·세션 유지의 이전 로컬 실계정 성공은 NB-V2-005 이력으로 보존한다. 이번 URL 적용 후 새 회원가입/메일 발송·클릭은 수행하지 않았다. 새 계정 생성·비밀번호 입력을 Codex가 하지 않았다.

## 7. 이메일 인증·세션 유지

callback은 현재 origin의 login.html?confirmed=1로 계산되고 외부 next 파라미터를 사용하지 않는다. 세션 없는 가입은 이메일 확인 안내로 남는다. 세션 복원·토큰 갱신·오류·중복 제출·교차 이벤트는 기존 자동 검사 범위다.

Production/로컬 callback 허용 목록과 운영 Site URL은 이제 저장 후 재조회로 검증 완료다. 기본 ConfirmationURL 메일 템플릿도 확인했다. 실제 메일 수신/링크 클릭 후 Production 세션 복귀와 이번 Production 새로고침 세션 유지의 별도 재확인은 미검증으로 남긴다.

## 8. 기존 서비스 전체 동선

새 가상 DOM 검사로 인증 후 입력→Mock 결과→전체 설계 복사→입력 수정→같은 사용자 새로고침 복원을 확인했다. 원문 HTML 태그 모양 입력도 textContent로 출력되며 HTML sink를 사용하지 않는다.

폼+CSV 헤더 분석→선택 옵션 색상 수정→확인→유효한 스키마 미리보기를 실제 UI 핸들러와 가상 DOM으로 검사했다. 응답 행이 출력 모델로 들어가지 않는 기존 검사도 통과한다. 브라우저 E2E/운영 사용자 확인과는 구분한다.

V1 입력은 같은 계정의 sessionStorage로 유지한다. 매핑 UI 편집값은 메모리 전용이며 이동/새로고침 유지가 미구현이다. 새 저장 기능을 앞당겨 추가하거나 테스트 성공으로 처리하지 않았다. 로그아웃/다른 계정의 이전 작업 정리는 기존 Auth 모의 검사다.

## 9. 모바일·교차 탭·뒤로가기

실제 사이트에서 로그아웃 후 브라우저 뒤로가기를 눌러도 로그인 화면이 보인다는 사용자 확인을 받았다. 이는 뒤로가기 기본 동작 확인이며 브라우저 내부 BFCache의 모든 조건을 검증한 것은 아니다.

모바일/다중 탭은 “다 되는 것 같다”는 일반 의견이었으므로 항목별 완료로 처리하지 않았다. 기존 가상 DOM의 교차 Auth 이벤트·BFCache·계정 전환 검사는 통과했다. 이전에는 브라우저 도구가 시간 초과였으나 이번 연결 후 native Chrome 접근은 복구됐다. 이를 통해 Supabase/Vercel 계정 설정만 직접 확인했고 실제 비밀번호 로그인/모바일 조작은 하지 않았다.

## 10. 보안 점검

공개 브라우저 코드의 Publishable Key 유지, Secret/service_role·Notion 토큰 추가 없음. 확인한 공개 응답에서 알려진 Notion 토큰/Secret Key 표식 없음. 비밀번호·실제 토큰·개인 테스트 계정을 보고서에 남기지 않았다. DOM은 textContent/요소 생성 방식이며 임의 외부 인증 복귀 파라미터는 없다. 소유자별 sessionStorage 정리를 유지한다.

**실제 공개 노출 확인:** Production의 `/scripts/notion-poc/cli.mjs`, `/docs/auth/NB-V2-005_REPORT.md`가 200으로 제공된다. 이는 CLI가 서버에서 실행되거나 웹 쓰기 API가 있다는 뜻은 아니다. `.env`, `.git/config`, `.notion-poc-state/nb-v2-002a.json`은 404였다. 모든 원격 파일/로그의 비밀값 부재를 보증한 것은 아니다.

이를 줄이기 위해 `public-dist`에 명시한 브라우저 파일 18개만 복사한다. 내부 문서·CLI·테스트·설정/실행 상태는 출력에 없다. 이 보호는 아직 로컬 준비물이며 현재 Production의 노출을 제거한 것은 아니다. 다음 승인된 배포에서 확인해야 한다. 업무 테이블·RLS·Notion 서버 쓰기 API 없음. 화면 가드와 서버 권한 검증을 구분한다.

## 11. 자동 테스트

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node scripts/deployment/build-static.mjs
```

**103개 통과 / 0실패**: 기존 95+서비스/자원 6+공개 빌드 2. V1 256개 모듈 조합 포함. 공개 빌드는 18개 파일만 출력하며 오래된 출력의 내부 파일도 제거한다. 허용되지 않은 참조는 이전 출력을 교체하기 전에 거부한다. 첫 신규 매핑 검사의 실패는 테스트가 교체 전의 분리된 DOM 노드를 선택한 문제였으며 현재 노드를 선택하도록 테스트를 수정했다. 제품 매핑 코드를 바꾸지 않았다.

## 12. 실제 배포 여부

이번 작업의 Git 커밋·push·Vercel 새 배포·원격 환경변수 변경은 없다. 기존 운영 배포를 대시보드/공개 HTTP로 읽기 조회했다. **기존 승인에 따른 Supabase Site URL·Redirect URLs 변경만 실제 적용·재조회했다.**

새로운 vercel.json은 framework=null, Build Command=node scripts/deployment/build-static.mjs, Output Directory=public-dist이며 로컬 빌드만 검증했다. Vercel Root Directory는 저장소 루트이고 Node 24.x/Other를 확인했다. 이 설정으로 실제 Preview가 빌드되는지는 아직 미검증이며 새 배포 승인은 받지 않았다.

## 13. 발생 오류·수정

- result.html의 없는 logo_1-transparent.png 참조 → 기존 logo_1.png로 수정.
- 저장 JSON에 기본/추가 항목 배열이 없거나 잘못된 모듈이면 TypeError → 형식/허용 ID 확인 후 잘못된 입력은 빈 상태 처리.
- 저장소 quota 예외가 입력 제출을 중단 → 저장 실패를 잡아 입력 유지·오류 표시·결과 이동 중단.
- 내부 문서/CLI 정적 노출 → 로컬 공개 파일 allowlist 빌드·vercel.json 준비. Production 제거는 미완료.
- 인증/Notion CLI/매핑 기능을 다시 구현하지 않았다.

## 14. 미검증

URL 변경 후 실제 새 가입 메일의 수신·클릭 복귀, 이번 Production 새로고침 세션의 별도 재확인, 전체 CSV 편집의 실제 화면 동선·모바일·교차 탭·다른 실계정 전환, 새 Preview/수정본 Production 배포, 원격 Build/Output override의 세부값이 남아 있다. 실제 429/장애/만료 링크 유발도 미수행이다.

승인 URL 적용·기본 템플릿·현재 배포/커밋·이전 배포 환경과 기본 사용자 동선은 더 이상 미확인/연결 대기로 표시하지 않는다. 내부 문서·CLI 노출을 줄이는 새 출력 빌드는 여전히 로컬에만 있다.

## 15. 다음 단계

승인된 Supabase URL 적용과 설정 재조회는 완료했다. 다음은 별도 승인된 Preview에서 공개 출력/내부 경로 404·Auth 메일 복귀·모바일·교차 탭을 검증하고, 통과 후 Production 승인을 받는 단계다. 현재 운영 복구 기준 배포는 대시보드 경로 H8mMZAh6mBk4Vm2zdjktjUD5kdB8의 4bff220이다. Git/배포 승인은 별도로 필요하다.

증거: NB-V2-005A_REMOTE_EVIDENCE.json(공개 HTTPS·해시·보안), NB-V2-005A_PUBLIC_MANIFEST.json(로컬 출력 18개), NB-V2-005A_ACCOUNT_VERIFICATION.json(계정 UI 재조회·실제 적용값·배포/템플릿·사용자 확인). 응답 원문·인증 nonce·실제 토큰·개인 계정 이메일은 기록하지 않았다. 이후 사용자별 교육 설정·템플릿 저장을 소유권/RLS와 함께 설계한다.

