# [ChatGPT 전달용] NB-V2-005B 배포 보안 및 검증 결과

EST_Project는 AI 없는 규칙 기반 Notion 교육 운영 대시보드 빌더다. 이번 작업은 신규 기능 개발 없이 공개 빌드·배포 보안과 기존 기능을 확인했다. 기준일은 2026-10-29(KST)다.

1. 이전 보고와 달라진 최신 상태

이전 4bff220 기준의 “public-dist는 로컬에만 있음”, “내부 CLI·문서 공개 중”이라는 상태는 현재와 다르다.

작업 시작 시 main/2432420f36368331228283dcb93000b2f90f89a8, 작업 폴더 clean이었다. GitHub main도 같은 SHA다. 이전 수정 16개 파일이 이 커밋에 포함돼 이미 Production에 반영돼 있었다. 이번 Codex 작업에서 커밋·push·배포한 것은 아니다.

Production: https://pplus-rouge.vercel.app
저장소/브랜치: jsyTest/EST_Project / main
배포 ID: dpl_EdowT9ZBoD5QnBogx67YFsWNdwv9
배포 URL: https://pplus-d1cvf58v9-pplus1.vercel.app
Source: Git/main/2432420, READY.

2. 빌드·정적 파일 제한

기존 build-static.mjs와 vercel.json을 수정하지 않고 검증했다. 공개 HTML 4개, CSS 3개, 브라우저 JS/MJS 10개, 로고 1개만 public-dist에 출력된다.

Auth CDN 로딩 순서와 네이버 폼·CSV·옵션 색상 모듈을 포함한다. 내부 CLI·문서·테스트·환경변수·실행 상태는 출력하지 않는다. 정적 참조 46개와 공개 파일 18개를 검사했고 누락 0개다.

현재 운영의 공개 파일 18개 모두 200이며 로컬 빌드와 바이트·SHA-256이 일치한다. 운영과 빌드의 공개 파일 차이 0개다. CDN은 200, 현재 해석 버전 2.118.0이며 기존 @2 주소를 유지했다.

현재 운영에서 아래 경로가 실제 404다.
/scripts/notion-poc/cli.mjs
/docs/auth/NB-V2-005_REPORT.md
/scripts/notion-poc/tests/deployment.test.mjs
/.env
/.git/config
/.notion-poc-state/nb-v2-002a.json
/vercel.json

따라서 현재 운영 별칭에서 확인한 내부 파일 공개 문제는 해결됐다. 알려진 비밀 설정 값과 sb_secret_ 표식은 공개 빌드에서 발견하지 못했다. 모든 과거 배포·원격 자원의 비밀값 부재를 보증하지 않는다. 이전 4bff220 배포 CLI 경로는 현재 302 SSO 보호 상태이며 파일 자체를 삭제한 것은 아니다.

3. Vercel·Preview 구분

인증된 설정 화면에서 Root Directory 빈 값(저장소 루트), Framework Other, Node 24.x를 확인했다. 프로젝트의 Build/Output override는 꺼져 있고 현재 Production Overrides에는 다음이 적용돼 있다.

Build Command: node scripts/deployment/build-static.mjs
Output Directory: public-dist

실제 빌드 로그의 18개 출력·Build Completed와 운영 파일을 함께 확인했다. SSO 보호를 해제하지 않았다.

조회된 Preview 배포는 0개다. 이번 Preview 생성·검증은 하지 않았다. 시작 시 코드가 이미 운영에 반영돼 있었고 새 코드 변경도 없어 기존 Production을 검증했다. 이를 Preview 성공이나 이번 배포 성공으로 바꾸어 표현하면 안 된다. 새 Preview·Production이 필요하면 대상·파일을 제시하고 별도 승인을 받아야 한다.

4. 실제 서비스·자동 검사

node --test scripts/notion-poc/tests/*.test.mjs: 103개 통과, 실패·건너뜀 0.
기존 V1 256개 조합, Auth·매핑·Notion 관련 자동 검사를 유지했다.

현재 Production에서 Codex가 기존 로그인 세션으로 직접 확인한 항목:
- 메인 → 가상 교육 설계 결과 → 새로고침 후 세션·결과 유지 → 수정 시 교육명 복원.
- 매핑 화면, 폼 질문 예시 5개 분석, 가상 CSV 헤더 3개 매핑.
- 선택 옵션 색상 변경 반영.
- 로그아웃, 뒤로가기 차단, 다른 기존 탭의 로그아웃 반영.
- 로그아웃 후 매핑 직접 접근 시 로그인 화면.
- 400×689 에뮬레이션에서 메인 상단·매핑 CSV 입력·로그인 기본 배치.

새 비밀번호 로그인은 이번에 수행하지 않았고, 새 가입 메일의 실제 수신·클릭 복귀와 실제 휴대폰 검증은 사용자 확인 대기다. 모바일 에뮬레이션을 실제 휴대폰 전체 검증으로 취급하지 말아야 한다. 최종 CSV 스키마 다운로드 전체 동선은 이번 직접 재검증 범위에 포함하지 않았다. 자동 검사와 실제 브라우저 검증을 구분한다.

매핑 편집값은 메모리 전용이며 새로고침 유지가 아직 없다. V1 입력 sessionStorage와 구분한다.

5. Supabase 현재 설정

인증된 Dashboard의 새 탭에서 정확한 값을 조회했고 기준과 일치해 변경하지 않았다.

Site URL: https://pplus-rouge.vercel.app
Redirect URLs (2개):
https://pplus-rouge.vercel.app/login.html?confirmed=1
http://127.0.0.1:8766/login.html?confirmed=1

Preview callback·와일드카드는 추가하지 않았다. Preview 메일 복귀 검증이 필요하면 정확한 callback과 허용 정책을 사전 확인·승인해야 한다. URL 목록 일치만으로 실제 메일 클릭 검증을 완료 처리하지 말아야 한다.

6. 이번 변경·남은 위험·다음 기능

이번 변경 파일은 아래 문서·증거 3개다.
docs/deployment/NB-V2-005B_REPORT.md
docs/deployment/NB-V2-005B_CHATGPT_HANDOFF.md
docs/deployment/NB-V2-005B_EVIDENCE.json

제품 코드, Auth, V1, 폼·CSV·색상, Notion CLI·관계형·수식은 수정하지 않았다. 업무 테이블·RLS·새 기능을 추가하지 않았다. Git 커밋·push·새 배포·원격 설정 변경도 없다.

공개 파일 제한의 현재 운영 반영은 검증 완료다. Preview 실검증, 새 비밀번호 로그인·새 인증 메일 복귀·실제 휴대폰은 남아 있다. main push 자동 운영 배포와 Deployment Checks 미설정, @2 CDN의 향후 변경 영향을 검토해야 한다. 과거 4bff220으로 롤백하면 공개 파일 문제가 되살아날 수 있다.

다음 저장 기능은 auth.uid()에 연결된 소유권·테이블·RLS와 사용자 간 격리 검증을 먼저 설계하고, 교육 설정 저장/복원, 템플릿 저장/적용 순서로 검토할 수 있다. 이번에는 구현하지 않았다.

ChatGPT는 NB-V2-005B 작업이 정상적으로 진행됐는지 검토해 주세요.

공개 파일 제한, 기존 서비스 기능 유지, Supabase 인증, Preview·Production 배포 상태를 확인해 주세요.

실제 검증과 미검증을 구분하고, Production 배포에 남은 위험을 정리해 주세요.

이후 Supabase 사용자별 교육 설정 저장과 템플릿 기능 개발을 위한 우선순위를 제안해 주세요.

필요하다면 다음 Codex 개발 프롬프트를 작성할 수 있도록 상태를 상세히 정리해 주세요.
