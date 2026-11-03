# [NB-V2-013B 작업 보고서] 개인 Notion 사전 보안 보완·일회용 로컬 실행기

작성일: 2026-11-03 (Asia/Seoul)

## 1. 결론과 완료 범위

**로컬 보안 코드·가상 입력·모의 연결 검사 완료. 실제 대상 확정과 실제 연결 승인은 보류.**

승인 소비 기록, 실행 전체의 최대 2 GET 예산, 브라우저 응답 축약, 숨김 TTY 입력기를 구현했다. 실행기는 현재 `--mock`만 지원하고 공개된 고정 가상 값만 허용한다. 실제 자격 증명을 입력하거나 실제 연결용으로 사용하면 안 된다. 기본 실행 및 `--live`는 입력 전에 거절한다. 실제 fetch를 주입하는 경로는 추가하지 않았다.

실제 Notion API 요청·쓰기 0건, 실제 비밀 입력·출력·설정 0건, Supabase/Vercel 원격 변경 0건, commit/push 0건이다. 공식 문서 웹 조회는 Notion 업무 API 호출과 구분한다.

## 2. 시작·종료 Git 상태

- 브랜치: main.
- 시작·종료 HEAD: `83dc02d758eb45551e22c9c154da0390f6da8a26`.
- 시작 작업 트리: 깨끗함. NB-V2-013A의 두 문서는 이후 위 커밋에 이미 포함돼 있었다. 이번에 커밋한 것이 아니다.
- 기존 NB-V2-012/013 구현과 사용자 파일을 보존했다. reset/clean/checkout 사용 없음.
- 종료: 기존 파일 4개 수정, 코드·검사 5개와 문서 2개 신규, 총 11파일 미커밋.
- 기존 API entrypoint, Auth·RLS·DB·Planner·저장 모델·CLI 실행기·로고 원본 변경 없음.
- 이번 공개 빌드 명령으로 Git에서 제외된 public-dist만 재생성했다. 기존 개발 서버를 재시작하거나 Production을 조회·변경하지 않았다.

## 3. 변경 파일

기존 수정:

- `/Users/jsy/Desktop/EST_Project/server/notion/test-readonly.mjs`: reader 재진입/재시도 차단, 식별자 없는 요약 반환.
- `/Users/jsy/Desktop/EST_Project/server/notion/test-connection.mjs`: 명시적 안전 응답 projection, 승인 사용자 상태, 재승인 전 재시도 금지 안내.
- `/Users/jsy/Desktop/EST_Project/js/notion-test-connection.mjs`: Bot·Workspace·부모 일치 요약을 확인하는 최소 계약 수정.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-test-connection.test.mjs`: 기존 45개 검사 유지, 식별자 반환 기대값을 새 비노출 계약으로 변경.

신규:

- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/approval.mjs`: 대상·작업 범위에 결합한 원자적 소비 기록과 공유 요청 예산.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/hidden-input.mjs`: 여섯 값의 숨김 터미널 입력·복구·부분 입력 정리.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/once.mjs`: 기본 차단, 가상 값 전용 일회용 실행기. 실제 네트워크 adapter 없음.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-local-once.test.mjs`: 신규 34개 검사.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/helpers/notion-local-pty.py`: 설치된 Python 표준 라이브러리를 이용하는 OS PTY 보조 검사.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-013B_REPORT.md`.
- `/Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013B_CHATGPT_HANDOFF.md`.

## 4. 승인 전체 요청 제한

실행기는 설정 검증 후, reader/adapter 호출 전에 `consumeLocalApproval`을 완료해야 한다.

1. 정규화한 사용자 UUID·Workspace/Bot/부모 ID, 고정 개인 테스트 범위, API 버전, 고정 작업 정책, 경로별 1 GET/전체 2 GET 한도를 결합한다.
2. 결합값의 SHA-256으로 기록명을 정한다. runId·임의 승인 ID·토큰·시각은 결합값을 바꿀 수 없다. 임의의 새 실행 ID로 우회하는 옵션도 없다.
3. 로컬 소유자 전용 디렉터리(0700)의 소비 파일을 O_CREAT|O_EXCL|O_NOFOLLOW(0600)로 만든다. 디렉터리 소유자·권한·심볼릭 링크와 열린 디렉터리의 일치를 검사한다.
4. 소비 표식과 파일/디렉터리 sync가 성공한 후에만 adapter를 사용할 수 있다. 실패하면 네트워크 전 차단한다. 기존 파일은 내용이 비어 있어도 소비된 것으로 처리한다.
5. 기록 내용에는 버전·정책·consumed·최대 GET 수만 저장한다. 대상 원문·토큰·헤더·페이지 URL은 쓰지 않는다. 파일명의 해시는 암호화나 모든 상관관계 은닉을 의미하지 않는다.
6. 하나의 승인 객체에서 파생한 adapter들이 예산을 공유한다. 각 슬롯은 dispatch 전에 차감한다. 고정 호스트·GET·redirect:error·본문 없음, users/me 1회 후 고정 부모 1회만 허용한다.
7. reader가 Bot 및 Workspace 일치를 확인한 뒤에만 부모 조회로 진행한다. reader 자체도 동기적으로 첫 실행을 선점하여 재호출·동시 진입을 거절한다.
8. 오류·timeout·응답 유실에도 소비 파일을 보존한다. 실행기 finally에서 예산을 닫고 종료한다. 기록 삭제·초기화·재승인 생성·retry 옵션은 구현하지 않았다.

현재 CLI의 고정 기록 위치는 사용자 홈의 `.pplus-notion-mock-approval-v1`이다. 이번 검사에서는 이 위치를 쓰지 않고, 가상 값 전용 임시 디렉터리만 사용했다. 모듈의 directory 주입은 검사 및 향후 검토용이며 CLI 변경 옵션은 없다. 검사 종료 시 임시 fixture를 정리하는 것은 실제 승인 기록을 삭제하여 재시도하는 제품 기능이 아니다.

**제약:** 현재 정책은 같은 대상·범위의 재실행을 새 runId나 토큰으로도 영구 차단하는 보수적 구조다. 새로운 승인 갱신 기능은 없다. 별도 컴퓨터·다른 저장소·사용자가 기록을 삭제하거나 코드를 변경하는 경우까지 절대적으로 막을 수 없다. 신뢰할 수 있는 사용자 소유 POSIX 로컬 파일시스템을 전제로 하며, 악의적인 동일 OS 사용자/파일시스템 관리자나 네트워크 파일시스템까지 방어한다고 주장하지 않는다. 이 로컬 표식은 실제 사용자 승인 증명이나 NB-V2-014의 다중 사용자 영구 실행 이력이 아니다.

일반 웹 API에 영구 승인 DB를 연결한 것도 아니다. 기존 배포 entrypoint는 원격 adapter/opt-in 없이 그대로 차단되어 있다. 후속 실제 로컬 경로는 정상 Supabase 사용자 검증과 이 예산을 함께 결합해야 하며, 임의 factory opt-in을 안전한 배포 활성화 방법으로 사용해서는 안 된다.

## 5. 브라우저 응답 및 UI

reader와 handler 양쪽에서 Workspace ID·Bot ID·부모 ID·부모 URL을 제거했다. handler는 result 전체를 넘기지 않고 필요한 필드만 새 객체에 선택한다.

- 설정 준비·승인 사용자 상태, Bot/Workspace/부모 matched 여부.
- 보관/휴지통 여부, 잠금 unlocked/unknown, 웹 게시 안 됨 요약.
- 요청 수, 안전한 오류 코드, 읽기 확인에만 해당하는 상태.
- privacyVerified=false, creationPermissionVerified=false, webExecutionReady=false, notionExecution=not_executed 유지.

제목·개인정보·페이지 본문·Notion 원본 오류·헤더·토큰·환경변수 값은 반환하지 않는다. 잠금 필드 누락은 여전히 unknown이다. 웹 게시 안 됨은 상속/직접 공유 전체가 비공개임을 증명하지 않는다. 읽기 성공도 생성 권한 확인이 아니다.

브라우저는 세 matched 여부가 모두 true여야 읽기 검증 요약을 수용한다. 계정/설계 전환·로그아웃의 기존 상태 정리와 모든 no-store 헤더를 유지했다. 레이아웃·생성 버튼·OAuth 버튼은 추가하지 않았다. 이번 UI 검증은 모의 검사이며 실제 브라우저·실계정 검사는 실행하지 않았다.

## 6. 숨김 입력기와 실행 절차

여섯 설정 이름은 기존 TEST_ENV_NAMES 계약을 유지한다. 실제 값은 조회하거나 설정하지 않았다.

- 모든 필드를 TTY raw mode에서 화면 비표시로 입력한다. 입력 문자열은 명령행 인수·shell export·process.env·.env·파일·브라우저에 넣지 않는다.
- Ctrl-C 바이트, SIGINT/SIGTERM/SIGHUP, EOF, 잘못된 입력, 스트림/출력 예외에서 listener를 제거하고 원래 raw 상태를 복구한다. stdin은 pause하여 종료를 방해하지 않는다.
- 부분 입력을 정리하고 main의 finally에서 임시 env 객체의 필드를 삭제한다. stdout 오류도 원래 예외를 다시 출력하지 않는다.
- non-TTY·빈 필드·제어문자·과도한 길이를 거절한다. JS 문자열/버퍼의 메모리 완전 소거를 보장하지 않는다. SIGKILL·전원 상실·터미널 장치 고장 시 JS 복구 코드는 실행되지 않을 수 있다.
- 기본 실행은 입력하지 않고 차단한다. `--live`나 임의 인수도 입력 전에 거절한다. `--mock`에서만 소스에 공개된 MOCK_ENV와 정확히 같은 가상 값 여섯 개를 허용한다. 가상 UUID를 실제 allowlist나 환경설정에 저장하지 않는다.

가상 검사만 직접 확인하려면 프로젝트에서 아래 명령을 일반 로컬 터미널로 실행하고, 소스 MOCK_ENV의 공개 가상 값만 입력한다. 실제 ID/토큰은 넣지 않는다.

    node /Users/jsy/Desktop/EST_Project/scripts/notion-local/once.mjs --mock

같은 기본 기록 위치에서 두 번째 실행은 차단되는 것이 정상이다. 기록을 삭제하여 재시도하는 절차는 제공하지 않는다. 실제 연결을 하려면 별도 설계 검토·승인·구현이 필요하며, 현재 입력기를 실사용 가능으로 판정하지 않는다. 모의 실행은 Supabase 세션을 사용하거나 실제 사용자임을 인증하는 과정도 아니다.

## 7. 검사 결과

최종 전체 검사: **441 통과, 실패0, 건너뜀0, 취소0.** 기존 407 + 신규 34. V1 256조합을 포함한다. 기존 검사를 삭제/비활성화하지 않았다.

- 최종 명령은 `env -i`로 비밀 없는 새 프로세스 환경을 만들고 설치된 Node/Python의 PATH만 제공하여 전체 Node 검사를 실행했다. 기존 CLI의 환경 관련 검사에도 실제 비밀을 전달하지 않는다.
- 신규: 최대2·경로별1, 첫 실패/불일치 중단, timeout·응답 유실 후 차단, 두 OS 프로세스의 동시 승인 선점, 소비 후 child 종료/재시작, 새 runId·토큰으로 재사용 불가, 빈 소비 파일, 잘못된 권한·symlink·호스트·쓰기 거절.
- 신규: 성공·401/403/404/429/5xx 응답의 식별자/비밀 비노출, default/--live 차단, 입력/출력 예외, 취소·신호·listener 정리.
- 실제 OS PTY: 가상 입력 성공·Ctrl-C·SIGTERM 3개 시나리오에서 transcript에 입력값 없음, ECHO/ICANON 복구, 실제 fetch 호출0 확인. Python은 기존 설치본이며 신규 의존성 설치 없음.
- 기존 승인 사용자/다른 사용자 모의 격리, UI 계정/설계/로그아웃 정리, 저장/매핑/색상/관리자/API/Notion CLI 회귀 통과. 실제 두 계정 검증은 아니다.
- 공개 빌드32개, 누락/추가/소스 불일치0. 서버·실행기·문서·보안 설정은 allowlist 밖. 알려진 토큰 형식/서버 참조 스캔 발견0. 실제 비밀을 읽어 대조하거나 모든 종류의 비밀을 탐지한 검사는 아니다.
- Node 구문 검사 및 git diff --check 통과. JPEG 원본은 HEAD와 바이트 일치.
- 로그: `/private/tmp/nb-v2-013b-full.log`, 빌드 목록: `/private/tmp/nb-v2-013b-build.json`.

첫 제한 환경 검사에서는 기존 HTTP 테스트가 listen EPERM으로 실패했다. 코드 문제로 오판하거나 검사를 건너뛰지 않았으며, 허용된 로컬 포트 검사 환경에서 다시 실행해 통과했다. 출력 예외가 원문 오류로 전파되지 않게 보완한 뒤 최종 전체 검사를 재실행했다.

## 8. 대상 식별 근거 조사와 차단 사항

공식 Notion User 문서는 user.id와 bot.workspace_id를 구분한다. token owner 조회는 현재 토큰의 Bot 정보를 읽는 경로다. Integration 설정 화면의 ID가 Bot user ID와 같다고 확인해 주는 근거는 이번 조사에서 확보하지 못했다.

독립 확인 후보는 사용자가 이미 보유한 신뢰 가능한 과거 연결 등록 메타데이터 또는 확인 가능한 공식 관리 화면이다. OAuth token 응답에는 bot_id/workspace_id가 있지만, 현재 연결에 그런 기존 자료가 있는지 확인하지 않았고 새 OAuth/토큰 발급을 실행할 이유도 없다. 기존 기록에 비밀이 섞여 있으면 에이전트가 파일을 열어 찾는 방법을 사용하지 않는다.

공식 UI가 현재 계정에서 두 UUID를 안전하게 직접 보여 주는지도 확인하지 못했다. Workspace 이름, 페이지 URL의 ID, Integration 설정 URL의 ID를 각각 Workspace/Bot ID의 증거로 대체하지 않는다. 과거 CLI 승인도 현재 실행 승인으로 재사용하지 않는다.

따라서 **실제 사용자 UUID·Workspace·Bot·부모 식별자와 근거는 미확정**이다. 첫 users/me 응답으로 allowlist를 자동 등록하지 않는다. 기존 독립 자료가 없다면 후속 작업에서 `GET /v1/users/me` 최대1회의 별도 식별 확인만 제안할 수 있다. 그것은 새로운 읽기 범위/명시적 승인과 안전한 로컬 검토 절차가 필요하고, 부모 조회나 현재 최대2회 연결 승인에 몰래 추가하면 안 된다. 단일 응답을 관찰하는 것만으로 독립적인 대상 검증이 해결되는 것도 아니다. 오늘 실행하지 않았다.

## 9. 사용자 UI 확인 체크리스트 — 확인 여부만 전달

- [ ] 개인 Workspace이며 회사 공간과 분리되어 있다.
- [ ] 기존 부모가 개인 비공개 테스트 페이지다.
- [ ] 직접 공유·상속 권한·웹 게시 범위를 확인했다.
- [ ] 의도한 Integration과 그 접근 범위를 확인했다.
- [ ] 실제 업무 자료와 개인정보가 검증 대상에 없다.

값·토큰·페이지 내용·URL을 채팅에 보낼 필요가 없다. 확인 여부만 전달하면 된다. 이번 작업 중 확인 답변을 받거나 해당 UI를 직접 조사하지 않았으므로 모두 미확인이다. 공유/권한을 변경하지 않았다.

## 10. 다음 단계와 별도 승인 조건

1. 사용자 체크리스트 완료 여부와 대상 ID의 독립 근거를 로컬에서 확정한다. 부족하면 식별 확인만 별도 설계하고 중지한다.
2. 현재 mock-only 입력기에 실제 값을 입력하지 않는다. 향후 실제 연결용 경로는 실제 Supabase Auth 결과의 UUID 확인, 고정 공유 승인 저장소, 소비 기록/예산, 안전한 요약을 함께 결합해야 한다.
3. 대상과 절차가 확정된 뒤 실제 로컬 입력 및 users/me 최대1회 + 일치 시 고정 부모 최대1회에 대한 별도 명시적 승인을 받는다. 외부에는 정상 Authorization·API 버전·고정 부모 ID만 필요한 범위로 전달하며 교육생/폼/CSV 자료는 보내지 않는다.
4. 불일치·오류·timeout·불확실 응답은 종료하고 소비 기록을 보존한다. 새로운 승인 검토 없이 기록 삭제·runId 변경·자동 retry하지 않는다.
5. 쓰기·회사 공간·OAuth·Git·배포는 별도 범위다. NB-V2-014는 다중 사용자 영구 실행 기록·원자적 승인·중복 방지·부분 실패 복구가 준비된 뒤 검토한다.

이번 보완 완료는 실제 Notion 연결 성공이나 실제 연결 실행 승인을 뜻하지 않는다. 실제 대상·공유 확인 및 실제 연결용 인증 결합이 남아 있어 최종 실제 연결 승인 가능 상태는 아니다.

## 11. 공식 근거

- [Notion User](https://developers.notion.com/reference/user): Bot user ID와 Workspace ID의 구분.
- [Retrieve token bot user](https://developers.notion.com/reference/get-self): token owner 조회 경로.
- [Create token](https://developers.notion.com/reference/create-a-token): OAuth 응답의 bot_id/workspace_id; 새 발급/OAuth는 이번 범위가 아님.
- [Node filesystem](https://nodejs.org/api/fs.html): exclusive 생성, symlink 방지 flag 및 sync 동작. 로컬 파일시스템 한계를 함께 명시했다.
- [Node TTY](https://nodejs.org/api/tty.html): raw mode와 Ctrl-C 처리. 가상 OS PTY 검사로 실제 복구를 확인했다.
