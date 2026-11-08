# NB-V2-013I — 기본 OFF 로컬 브리지 구현 및 가상 검증

작성일: 2026-11-08, Asia/Seoul.

## 결과

013H의 로컬 브리지 범위 구현과 가상 검증을 완료했다. 기본 모드는 blocked이며 import만으로 서버·인증·비밀 입력·원격 요청이 시작되지 않는다. 별도 실행 승인 receipt, 검토 패키지, 코드 digest, 승인된 로컬 SDK 소스 및 명시적 adapter가 없으면 시작되지 않는다. 실행 CLI나 자동 활성화 환경변수를 추가하지 않았다.

전체 Node **600/600 통과, 실패·취소·건너뜀 0**. 기존494개 + 신규106개이며 V1 256조합은 기존 검사에 포함된다. 가상 결과는 validationMode=simulation, mockTargetReadVerified=true, targetReadVerified=false로 표시한다. 실제 계정·Notion 성공 사례가 아니다.

원본 main/HEAD는 `f274ca4dfcfc10dd342442a845cacbfb385ba5a8`이다. 시작 작업 트리는 깨끗했다. 별도 작업 사본에서 구현·검사한 변경11파일을 원본에 반영했고 바이트 일치를 확인했다. main/HEAD 유지, 미커밋11파일이며 git diff --check도 통과했다. 최종 근거 JSON을 함께 제공한다. commit/push는 하지 않았다.

## 변경 파일 — 코드·검사9개, 문서2개

| 구분 | 파일 | 변경 내용 |
|---|---|---|
| 신규 | scripts/notion-local/two-get-server.mjs | 전용 loopback 서버, raw Host/Origin, 빈 POST, 비공개 런타임 자원, 연결 종료 취소, 일회용 종료 |
| 신규 | scripts/notion-local/two-get-controller.mjs | 기본차단, 입력 전후 서버 인증·소유권 대조, 소비 후 입력, 고정2GET 결합, 안전 응답 |
| 신규 | scripts/notion-local/two-get-package.mjs | 정확한 필드·UUID·대상·정책·버전·만료·패키지/코드 digest·승인 receipt 검증 |
| 신규 | scripts/notion-local/two-get-secret.mjs | 소비 후 token-only 숨김 TTY, 90초 상한, 취소·오류·신호 정리, raw/입력 흐름 복구 |
| 신규 | scripts/notion-local/two-get-browser.mjs | 정상 SDK 세션 전달, 토큰/사용자 변경·페이지 이탈·취소 fence, ID 없는 한국어 결과 |
| 수정 | scripts/notion-local/approval.mjs | 선택적 비밀 없는 감사 참조; 기존 안정된 소비 키 보존; 디스크 실패 검사용 io 주입 |
| 수정 | server/notion/test-readonly.mjs | 기본 false인 strictInternalIdentity 옵션; 새 controller는 엄격 검사 필수 |
| 신규 | scripts/notion-poc/tests/notion-two-get-controller.test.mjs | 승인·인증·소비·입력·예산·세션·실패·취소 가상 검사 |
| 신규 | scripts/notion-poc/tests/notion-two-get-server.test.mjs | 실제 임시 loopback HTTP, 전체 가상 흐름, 프로세스 경합, 가상 터미널 검사 |
| 신규 | docs/research/NB-V2-013I_REPORT.md | 이 보고서 |
| 신규 | docs/chat-handoff/NB-V2-013I_CHATGPT_HANDOFF.md | ChatGPT 전달문 |

## 검증한 동작

- receipt 없음·다른 코드/대상/정책/만료·가짜 승인·본문 주입은 비밀 입력과 Notion 전송 전에 차단한다. 기본 모드는 설정값이나 adapter가 있어도 열리지 않는다.
- 요청마다 기존 getUser 및 저장본 소유권 helper를 재사용한다. 입력 전후 합계 Supabase 최대6 GET(Auth4+고정 저장본2), Notion 최대2 GET 예산은 별개다. 시험에서는 전부 합성 응답이다. 관리자·metadata·브라우저 UUID로 인증을 대체하지 않는다.
- 소비 표식을 O_EXCL로 선점하고 파일/디렉터리 sync 후에만 입력한다. mkdir/open/write/file-sync/directory-sync 실패를 실제 임시 파일 I/O에 주입해 입력·전송0을 확인했다. 두 독립 프로세스에서도 입력 승자1개·총2회만 통과했다. 새 receipt로도 안정된 같은 범위를 다시 소비하지 못한다.
- 승인 예산에서 users/me 뒤 고정 부모만 각1회 예약한다. 첫 실패·불일치·unknown owner·개인 소유 형태·오류·429·크기 초과·유실은 부모 전 차단한다. 다른 URL/쓰기/redirect/세 번째 호출을 거절한다. 예약 수는 실제 원격 처리 성공 수가 아니다.
- 입력 중 취소/코드 변경/만료, 입력 후 세션 무효, 첫 요청 후 취소·만료·코드 변경, 응답 본문 읽기 중 취소를 검사했다. 소비 후 실패는 임시 시험 표식을 보존하고 자동 재시도하지 않는다. 시험 종료 후 임시 디렉터리는 정리했다. 기존 실제 소비 저장소를 조회·삭제하지 않았다.
- 완전한 HTTP body 수신은 취소로 오인하지 않는다. 정상 응답 전 res.close는 실제 임시 socket에서 취소로 전달됐다. 동일 프로세스 busy, 잘못된 Host/Origin·중복 Host/Origin·forwarded·chunked·메서드·경로·본문을 검사했다.
- 실제 PTY에 가상 문자열만 입력해 echo 비활성·원문 비출력·raw 복구·프로세스 정상 종료를 확인했다. 이 검사에서 발견한 입력 스트림 종료 처리를 수정했다. 실제 연결 토큰을 입력하지 않았다.
- 브라우저 모듈은 SDK/DOM 가상 객체로 검사했다. 세션 갱신·사용자 변경·로그아웃·페이지 이탈·취소·영구 대기 SDK 이후 이전 결과를 표시하지 않는다. 실제 로그인 브라우저의 E2E 성공으로 표현하지 않는다.
- 공개 빌드는 기존32파일 allowlist 그대로다. 배포 API·일반 개발 서버·mock-only 입력기·--live 차단·기존 Auth/DB/RLS는 수정하지 않았다. 테스트의 build 출력은 사본에서만 생성했다.

## 검사 실행과 코드 결합

작업 사본: `/Users/jsy/Documents/Codex/2026-11-04/referenced-chatgpt-conversation-this-is-an/work/nb013i/EST_Project`

명령: `node --test --test-reporter=tap scripts/notion-poc/tests/*.test.mjs`

Node v24.22.1. TAP 최종 집계600/600. 임시 loopback HTTP·자식 프로세스·PTY만 sandbox 예외로 실행했으며 업무 서비스 네트워크는 사용하지 않았다. 원본에 테스트를 재실행해 public-dist를 바꾸지 않고, 검사한 코드와 원본의 바이트 일치로 적용을 확인한다.

`computeCodeDigest()`의 명시된16파일 SHA-256: `af410c5aa2c2471673850970d75b4b4a74b4d2af374252a7508325388a17c1fc`

이 digest는 runtime5파일·기존 보안 helper/카탈로그·공개 client·신규 검사2파일에 결합된다. 문서·전체 Git 저장소·검사 로그의 포괄적인 서명이나 사람 승인의 암호학적 증명이 아니다. 코드 변경 후에는 digest와 실행 승인을 다시 검토해야 한다.

## 013H 대비 구체화와 한계

기존 SDK CDN 버전이 고정되지 않은 점을 고려해 새 서버는 CDN을 받지 않는다. 미래 운영자가 검토한 로컬 SDK 문자열을 명시적으로 제공하고 sdkDigest로 고정해야 한다. 공개 Supabase origin과 publishable key의 digest도 패키지에 결합했다. 기존 공개 client와 SDK 설정은 변경하지 않았고, 이번에는 SDK를 다운로드하거나 실제 브라우저에서 로딩하지 않았다. 현재 turnkey 실행 명령·실제 패키지·receipt를 제공하지 않는다.

strict identity는 응답 형태에 대한 보조 조건이다. 내부 연결에서 나온 실제 자격 증명이라는 출처를 증명하지 않는다. 기존 G의 연결·권한 관찰 이력과 운영자의 향후 출처 확인을 대체하지 않는다. 기존 토큰에 Read/Update/Insert 및 표시된 부모3개 접근이 남았다는 잔여 위험도 바꾸지 않는다.

이번에 F/G의 과거 실제 관찰을 재실행하지 않았다. 실제 PPLUS getUser·현재 소유자·현재 토큰 유효성·Notion 연결·공유/게시/개인정보 전체를 새로 확인한 결과가 아니다. 실제 실행에는 고정 ID의 승인된 로컬 등록, 테스트 코드/SDK 결합, 출처 확인, 별도 명시적 실행 승인이 여전히 필요하다. 토큰 값·JWT·실제 UUID를 이 보고서/로그에 기록하지 않았다.

항상 privacyVerified=false, creationPermissionVerified=false, writes0, webExecutionReady=false, notionExecution=not_executed를 유지한다. JS 메모리 완전 소거·SIGKILL 복구·다른 컴퓨터/삭제된 저장소를 넘어선 전역 잠금은 보장하지 않는다.

## 이번 미실행 및 다음 판단

실제 Supabase/Notion 요청0, 실제 토큰 조회·복사·입력0, 실제 승인/소비 기록 접근0, Notion 쓰기/권한 변경0, DB/Auth/RLS 변경0, 기존8796 서버 조작0, commit/push/배포/환경변수 변경0이다. 새 권한이나 연결도 추가하지 않았다.

사용자가 지금 해야 할 조작은 없다. ChatGPT는 이 구현과 가상 검사 결과를 검토하고 이후 단계만 결정하면 된다. 실제2GET·쓰기·배포 및 후속 구현은 자동 시작하지 않는다.
