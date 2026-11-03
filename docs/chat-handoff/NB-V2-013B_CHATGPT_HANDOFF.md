# [ChatGPT 전달용] NB-V2-013B 개인 Notion 연결 보안 보완 결과

## 1. 결론

**로컬 보안 보완 및 모의 검사 완료 / 실제 대상 확정·실제 연결 승인 보류.**

승인 소비 기록과 최대2 GET 예산, 대상 식별자 없는 응답, 숨김 입력기를 구현했습니다. 전체 Node **441개 통과(기존407 + 신규34)**, V1 256조합 유지입니다.

실행기는 현재 `--mock`에서 공개된 고정 가상 값만 받습니다. 기본 실행 및 `--live`는 입력 전에 차단하며 실제 Notion fetch는 없습니다. 실제 ID/토큰을 입력하거나 실제 연결용으로 사용하면 안 됩니다. 이 결과는 실제 Notion 연결 또는 생성 성공이 아닙니다.

## 2. Git 및 변경 파일

- 작성일: 2026-11-03, Asia/Seoul.
- 브랜치 main, 시작·종료 HEAD: `83dc02d758eb45551e22c9c154da0390f6da8a26`.
- 시작 작업 트리는 깨끗했습니다. 013A 문서는 위 커밋에 이미 포함되어 있었습니다.
- 기존 4파일 수정 + 신규 코드/검사5파일 + 신규 문서2파일, 총11파일 미커밋입니다.
- reset/clean/checkout, commit/push 없이 기존 작업을 보존했습니다.

수정 파일:

- `/Users/jsy/Desktop/EST_Project/server/notion/test-readonly.mjs`
- `/Users/jsy/Desktop/EST_Project/server/notion/test-connection.mjs`
- `/Users/jsy/Desktop/EST_Project/js/notion-test-connection.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-test-connection.test.mjs`

신규 코드·검사:

- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/approval.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/hidden-input.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/once.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-local-once.test.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/helpers/notion-local-pty.py`

신규 문서:

- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-013B_REPORT.md`
- `/Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013B_CHATGPT_HANDOFF.md`

## 3. 승인 전체의 요청 제한

사용자·Workspace·Bot·부모의 정규화된 식별자, 개인 테스트 범위, API 버전, 고정 작업 정책과 GET 한도를 결합한 해시로 소비 기록을 만듭니다. runId·임의 승인 ID·토큰·시각을 바꿔도 같은 대상의 기록을 재사용할 수 없습니다.

- 사용자 소유 로컬 디렉터리0700, 소비 파일0600.
- O_EXCL 기반 원자적 파일 생성, symlink·소유자·권한 검사.
- 소비 파일과 디렉터리 sync가 끝나기 전에는 adapter를 호출하지 않음.
- 기록에는 원문 ID·토큰·URL 대신 정책·소비 여부·상한만 저장. 파일명은 해시이며 암호화나 모든 상관관계 은닉을 뜻하지 않음.
- 공유 adapter 예산에서 dispatch 전에 GET을 차감.
- users/me 최대1회 → reader의 Bot/Workspace 일치 확인 → 고정 부모 최대1회, 총최대2회.
- reader 재진입·동시 실행·재시도 차단.
- 실패·timeout·응답 유실·프로세스 종료 후에도 소비 기록 보존. 빈 기록도 재사용 거절.
- 기록 삭제/초기화/재승인 발급/retry 기능 없음.

현재 CLI의 기본 소비 기록 위치는 사용자 홈의 `.pplus-notion-mock-approval-v1`입니다. 이번 검사는 가상 값용 임시 디렉터리에서만 수행했고 기본 홈 위치는 사용하지 않았습니다. 검사 fixture 정리는 실제 승인 기록을 지워 재시도하는 제품 기능이 아닙니다.

이 정책은 같은 대상의 새 승인 갱신도 자동 허용하지 않는 보수적인 구조입니다. 별도 컴퓨터·다른 저장소·사용자의 기록 삭제·코드 변경까지 절대적으로 막을 수 없습니다. 신뢰할 수 있는 POSIX 로컬 저장소 전제이며, 악의적인 동일 OS 사용자/관리자까지 방어한다고 주장하지 않습니다.

이 기록은 실제 사용자 승인 증명이나 NB-V2-014의 다중 사용자 영구 실행 이력을 대체하지 않습니다. 일반 웹 API에 영구 승인 DB를 붙인 것도 아닙니다. 배포용 API entrypoint의 원격 차단은 유지했습니다.

## 4. 응답 축약 및 UI 계약

reader와 handler에서 Workspace/Bot/부모 ID와 페이지 링크를 제거했습니다. handler는 원본 결과 전체를 반환하지 않고 필요한 필드만 선택합니다.

- 승인 사용자·설정 준비 상태.
- Bot/Workspace/부모 일치 여부.
- 제한된 부모 읽기 확인, 보관·휴지통·잠금·게시 상태 요약.
- GET 소비 수 및 안전한 오류 코드.

토큰·Authorization·환경변수 값·제목·페이지 내용·원본 응답/오류는 반환하지 않습니다. UI도 세 matched 값이 모두 true인지 확인하도록 최소 수정했습니다. 계정·설계 전환과 로그아웃 정리는 유지했습니다.

항상 webExecutionReady=false, notionExecution=not_executed, privacyVerified=false, creationPermissionVerified=false입니다. 잠금 필드가 없으면 unknown입니다. 웹 게시 안 됨은 전체 공유 권한의 비공개 증거가 아니며, 읽기 성공도 생성 권한 확인이 아닙니다.

## 5. 일회용 숨김 입력기

기존 여섯 설정 계약을 유지하되 값을 전역 환경변수나 파일에 저장하지 않습니다. 여섯 필드 모두 TTY 화면 비표시 입력이고, 프로세스 내부 객체에서만 사용합니다. 명령행 인수·.env·Git·브라우저·로그에 값을 넣지 않습니다.

Ctrl-C, SIGINT/SIGTERM/SIGHUP, EOF, 잘못된 입력, 스트림/출력 예외에서 터미널 상태와 listener를 정리합니다. main 종료 시 임시 env 필드를 삭제합니다. JS 문자열 메모리 완전 소거는 보장하지 않습니다. SIGKILL·전원 상실 등에서는 JS 복구가 실행되지 않을 수 있습니다.

현재 실행기는 `--mock`만 지원하고 MOCK_ENV의 고정 가상 값 이외에는 거절합니다. 실제 자격 증명·실제 사용자 인증을 처리하는 live 실행기는 아직 제공하지 않습니다. 모의 입력 안전성 확인과 실제 연결 사용 가능 판정은 구분합니다.

## 6. 검증 결과

- 최종 Node441/441 통과, 실패·건너뜀·취소0. 기존407개를 유지하고 신규34개 추가.
- V1 256조합 및 Auth·저장·매핑·색상·관리자·설계 미리보기/API·Notion CLI 회귀 통과.
- 두 별도 OS 프로세스가 동시에 실행해도 한 실행만 승인 소비.
- 소비 후 child 종료·재시작, runId/토큰 변경, 빈 소비 기록에서도 재사용 차단.
- 첫 실패 및 Bot/Workspace 불일치 시 부모 요청0. 부모 불일치도 추가 요청 없이 종료.
- timeout·응답 유실 후 자동 재시도 없음.
- 성공/실패 응답의 대상 식별자·URL·토큰 비노출 확인.
- 실제 OS PTY에서 가상 입력 정상 종료·Ctrl-C·SIGTERM의 입력 비표시와 ECHO/ICANON 복구 확인. 실제 fetch 호출0.
- 최종 전체 검사는 `env -i`의 비밀 없는 프로세스 환경에서 실행. 신규 설치 없이 기존 Node/Python 사용.
- 공개 빌드32개, 누락·추가·소스 불일치0. 서버·입력기·소비 기록·문서·환경 파일은 공개 목록 밖.
- 공개 자원의 알려진 비밀 형식/서버 참조 스캔 발견0. 모든 비밀 종류를 완전 탐지한 검사라는 뜻은 아님.
- 구문 검사·diff 공백 검사 통과, JPEG 원본 바이트 유지.

최초 제한 환경에서는 기존 로컬 HTTP 테스트가 listen EPERM으로 실패했습니다. 검사를 삭제하지 않고 허용된 로컬 포트 실행 환경에서 다시 검증해 통과했습니다. stdout 예외의 원문 오류가 전파되지 않도록 보완하고 최종 전체 검사를 재실행했습니다.

실제 Notion 원격 결과·실제 Supabase 두 계정·실제 브라우저 UI·모바일·Vercel 런타임 검증은 이번에 수행하지 않았습니다. 기존 사용자 격리와 UI 결과는 모의 검사입니다.

## 7. 실제 대상 식별과 공유 설정 — 미확정

[공식 User 문서](https://developers.notion.com/reference/user)는 Bot user ID와 bot.workspace_id를 구분합니다. [users/me 문서](https://developers.notion.com/reference/get-self)는 토큰 소유 Bot 조회 경로입니다. Integration 설정 화면 ID와 Bot user ID가 같다는 근거는 확보하지 못했습니다.

기존의 신뢰 가능한 연결 등록 메타데이터나 공식 관리 화면에서 독립 근거를 확인해야 합니다. [OAuth token 응답](https://developers.notion.com/reference/create-a-token)에는 bot_id/workspace_id가 있지만 현재 연결의 기존 자료가 있다는 뜻은 아니며, 새 OAuth/토큰 발급은 하지 않았습니다.

현재 실제 사용자 UUID·Workspace·Bot·부모 값과 독립 근거는 모두 미확정입니다. 실제 값·기존 비밀 파일을 읽지 않았고 가상 UUID를 실제 allowlist에 저장하지 않았습니다. Workspace 이름·페이지 ID·Integration 설정 URL을 잘못 대체 근거로 쓰지 않습니다. 첫 응답으로 allowlist를 자동 생성하지 않습니다.

독립 자료가 없다면 users/me 최대1회의 별도 식별 확인 단계를 제안할 수 있지만, 새로운 범위와 명시적 승인이 먼저 필요합니다. 부모 읽기를 포함한 기존 최대2회 승인에 이를 추가하거나 자동 실행하면 안 됩니다. 응답 관찰만으로 독립 검증이 해결되는 것도 아닙니다.

사용자 확인 체크리스트는 다음과 같으며 현재 모두 미확인입니다. 값이나 페이지 내용 없이 확인 여부만 전달하면 됩니다.

- [ ] 개인 Workspace이며 회사 공간과 분리되어 있음.
- [ ] 부모가 기존 개인 비공개 테스트 페이지임.
- [ ] 직접 공유·상속 권한·웹 게시 범위를 확인함.
- [ ] 의도한 Integration과 접근 범위를 확인함.
- [ ] 실제 업무 자료와 개인정보가 없음.

## 8. 변경 여부와 남은 조건

- Git: 로컬11파일 변경, commit/push0.
- Vercel: 배포·환경변수·alias 변경0, 원격 재조회 없음.
- Supabase: SQL·RLS·Auth·업무 데이터·계정/역할 변경0. 이번 실계정 검사 없음.
- Notion: 실제 API 요청0, 쓰기0, 권한 변경0.
- 실제 비밀 조회·입력·설정·출력0. 검사에는 공개 가상 값만 사용.
- 기존 API entrypoint 원격 차단, 로고·기존 설계/저장/인증 기능 유지. public-dist만 로컬 재생성.

실제 연결 전에는 대상 ID의 독립 근거와 사용자 UI 확인을 완료하고, 정상 Supabase Auth 결과를 일회용 소비 기록·고정 대상·요청 예산과 결합하는 실제 연결용 경로를 별도로 검토해야 합니다. 현재 mock-only 입력기에 실제 값을 넣으면 안 됩니다.

그 후에만 실제 보안 입력 및 users/me 최대1회 + 일치 시 고정 부모 최대1회에 대한 별도 명시적 승인을 요청합니다. 불일치·오류·불확실 응답은 중단하고 기록을 보존해야 합니다. 회사 공간·추가 탐색·OAuth·쓰기·배포는 포함하지 않습니다.

## 9. ChatGPT 검토 및 다음 작업 결정 요청

1. 로컬 소비 기록과 예산이 승인 전체 최대2 GET, 동시 실행·재시작·runId 변경 차단 요구를 충족하는지 검토해 주세요.
2. 대상 ID/URL과 비밀이 응답·오류·로그·터미널에 노출되지 않는지, UI 계약이 맞는지 평가해 주세요.
3. 가상 입력 및 실제 OS PTY 검증을 실제 Notion 연결 검증과 명확히 구분해 주세요.
4. 실제 대상 ID의 독립 근거와 사용자 공유 확인이 미완료이므로 현재 실제 연결 승인을 보류해야 하는지 확인해 주세요.
5. 다음 작업을 ‘대상 식별 근거 확보’와 ‘인증을 결합한 실제 로컬 실행 경로 설계’ 중 어느 범위부터 진행할지 결정해 주세요. 현재 실행기에 실제 토큰을 입력하도록 지시하지 마세요.
6. NB-V2-014는 영구 실행 기록·원자적 승인·중복 방지·부분 실패 복구와 별도 쓰기 승인이 준비된 뒤 진행하도록 확인해 주세요.

완료는 로컬 보안 구현·모의 검사입니다. 실제 대상 확정은 미완료, 실제 연결·생성·운영 배포는 미실행입니다. 확인되지 않은 항목을 성공으로 판단하지 마세요.
