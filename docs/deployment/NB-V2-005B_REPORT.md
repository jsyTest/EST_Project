# [NB-V2-005B 작업 보고서]

기준일: 2026-10-29, Asia/Seoul.

## 판정

공개 빌드·자동 검사·현재 Production의 파일 제한 검증을 완료했다. 새 비밀번호 로그인, URL 변경 후 새 가입 메일의 실제 인증 복귀, 실제 휴대폰 확인은 사용자 확인 대기다. 전체 인증 검증까지 모두 완료한 상태는 아니다.

## 최신 Git·배포 상태

- 시작: main / 2432420f36368331228283dcb93000b2f90f89a8, 작업 폴더 clean.
- GitHub main도 git ls-remote로 같은 SHA 확인.
- 이전 기준 4bff220에서 2432420으로 변경됐으며 NB-V2-005A 공개 빌드와 수정 사항이 이미 커밋·운영 반영돼 있었다.
- Production: https://pplus-rouge.vercel.app
- 실제 배포: dpl_EdowT9ZBoD5QnBogx67YFsWNdwv9 / pplus-d1cvf58v9-pplus1.vercel.app
- Source: Git / main / 2432420, 상태 READY. 이번 Codex 작업에서 커밋·push·배포하지 않았다.

## 변경 파일과 기존 기능 보존

이번 변경은 아래 문서·증거 3개뿐이다.

- docs/deployment/NB-V2-005B_REPORT.md
- docs/deployment/NB-V2-005B_CHATGPT_HANDOFF.md
- docs/deployment/NB-V2-005B_EVIDENCE.json

제품 코드, 빌드 설정, Auth, V1, 매핑, Notion CLI·관계형·수식은 수정하지 않았다. Supabase 테이블·RLS·원격 설정 변경도 없다. public-dist는 기존 빌드로 재생성한 Git 제외 산출물이다.

## 공개 빌드 검사

- node --test scripts/notion-poc/tests/*.test.mjs: 103개 통과, 실패·건너뜀 0.
- node scripts/deployment/build-static.mjs: 공개 파일 18개 출력.
- HTML·CSS·JS 참조 46개 확인: 누락 0, 심볼릭 링크 0.
- HTML 4개, CSS 3개, 브라우저 JS/MJS 10개, 로고 1개만 포함.
- Auth CDN → 클라이언트 → Auth 코드 로딩 순서와 매핑 모듈 포함 확인.
- Supabase CDN 실제 HTTP 200, 현재 응답 버전 2.118.0. 기존 @2 주소는 유지했다.
- 알려진 로컬 Notion/비밀 설정 값과 sb_secret_ 표식을 공개 출력에서 발견하지 못했다. 모든 종류의 비밀값 부재를 보증하는 검사는 아니다.

## Vercel 설정·Preview

인증된 설정 화면에서 확인했다.

- Framework: Other, Root Directory: 빈 값 = 저장소 루트, Node: 24.x.
- 프로젝트 화면의 Build/Output override는 꺼져 있다.
- 현재 Production Overrides: Build Command=node scripts/deployment/build-static.mjs, Output Directory=public-dist.
- 실제 빌드 로그에서도 public-dist, 파일 18개, Build Completed를 확인했다.
- 조회된 Preview 배포 0개. 이번 Preview는 미생성·미검증이다.
- 시작 시 같은 소스가 이미 Production이었고 코드 변경이 없어 중복 배포 없이 기존 운영 배포를 검증했다. 이것을 Preview 통과로 기록하지 않는다.
- SSO 설정을 변경하거나 임시 공유 링크를 만들지 않았다. 향후 새 Preview/Production 생성은 승인 후 진행한다.

## 실제 공개 경로 검사

운영 공개 파일 18개가 모두 HTTP 200이며 로컬 빌드와 바이트·SHA-256이 일치한다. 공개 파일 차이 0개.

다음 경로는 운영에서 실제 HTTP 404다.

- /scripts/notion-poc/cli.mjs
- /docs/auth/NB-V2-005_REPORT.md
- /scripts/notion-poc/tests/deployment.test.mjs
- /.env
- /.git/config
- /.notion-poc-state/nb-v2-002a.json
- /vercel.json

이전 보고에서 200이던 CLI·문서가 현재 404로 바뀌었다. 이전 4bff220 배포의 CLI 경로는 302 Vercel SSO로 이동했다. 이전 배포의 파일 자체를 삭제한 것은 아니다.

## 실제 브라우저 검증

Production의 기존 로그인 세션으로 직접 확인했다.

- 메인 표시 → 가상 교육 NB-V2-005B 설계 생성 → 결과 표시.
- 결과 새로고침 후 로그인·설계 유지, 요구사항 수정 후 교육명 복원.
- 매핑 화면 로딩, 폼 예시 5개 분석.
- 가상 UTF-8 BOM CSV의 3개 헤더가 질문에 매핑됨.
- 선택 옵션의 파랑 → 보라 변경 반영.
- 로그아웃 → 로그인 화면, 뒤로가기 후에도 로그인 화면.
- 이미 열려 있던 다른 탭에도 로그아웃 반영.
- 로그아웃 상태에서 mapping.html 직접 접근 시 로그인 화면.
- 400×689 화면 에뮬레이션에서 메인 상단·매핑 CSV 입력·로그인 기본 배치 시각 확인. 실제 휴대폰 검증은 아니다.

비밀번호를 입력한 새 로그인과 최종 CSV 스키마 다운로드 전체 동선은 이번에 직접 재검증하지 않았다. 기존 103개 자동 검사에는 관련 모의 동작·컴파일 검사가 포함된다. 매핑 편집의 새로고침 유지는 기존처럼 미구현이다.

## Supabase 설정

로그인된 Dashboard를 새 탭에서 조회했다. 기준과 정확히 일치해 변경하지 않았다.

Site URL: https://pplus-rouge.vercel.app
Redirect URLs (정확히 2개):
- https://pplus-rouge.vercel.app/login.html?confirmed=1
- http://127.0.0.1:8766/login.html?confirmed=1

Preview 인증 복귀 URL·와일드카드는 추가하지 않았다. Preview에서 가입 메일 복귀까지 시험하려면 해당 Preview의 정확한 callback과 정책 변경 범위를 먼저 확인·승인받아야 한다.

## 오류·남은 확인·배포 주의점

- Python HTTPS 검사에서 로컬 인증서 저장소 오류가 발생해 시스템 인증서를 사용하는 curl로 전환했다. 인증서 검증을 끄지 않았다.
- 새 비밀번호 로그인, 변경 후 새 가입 메일 수신·클릭·운영 복귀, 실제 휴대폰은 사용자 확인 대기.
- Preview 실제 실행은 미수행. 새 Preview 승인 전 배포하지 않는다.
- main push는 자동 Production 배포로 연결돼 있다. 현재 Deployment Checks는 미설정이다. 설정을 바꾸지는 않았다.
- @2 CDN은 고정 패치 버전이 아니므로 향후 SDK 변경 영향이 남는다. 이번 Auth 보존 범위에서 주소를 변경하지 않았다.
- 이전 4bff220으로 무조건 롤백하면 내부 파일 공개 문제가 다시 생길 수 있다.
- 현재 서비스는 정적 화면 가드이며 사용자별 업무 데이터 권한은 아직 없다. 다음 저장 기능에는 소유권과 RLS 검증이 필요하다.

이번 작업의 신규 배포는 없으며, 2432420의 기존 Production 반영을 실제 검증한 결과다. 상세 상태·해시는 NB-V2-005B_EVIDENCE.json에 기록했다.

참고: [Vercel 정적 설정](https://vercel.com/docs/project-configuration/vercel-json), [Supabase 인증 복귀 URL](https://supabase.com/docs/guides/auth/redirect-urls).
