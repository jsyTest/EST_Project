# [NB-V2-013D 작업 보고서] 사용자 인증·일회용 개인 Notion 모의 경로 결합

작성일: 2026-11-04, Asia/Seoul.

## 1. 결과

**로컬 인증 결합 및 모의 검증 완료. 실제 Supabase 계정·Notion 연결·운영 배포는 미실행.**

기존 서버 Auth 검증을 공통 함수로 추출해 기존 API와 새 비공개 모의 실행 경로에서 재사용한다. 인증된 사용자 UUID → 서버 승인 UUID → 승인 대상/작업 정책 → 가상 입력 제한 → 원자적 소비 → 최대2 모의 GET 순서로 결합했다. 가상 인증 성공을 실계정 성공으로 보고하지 않는다.

새 경로는 서버에 마운트하지 않은 함수 인터페이스다. mode 기본값은 blocked이며 mock만 지원한다. 실제 Notion fetch 옵션·CLI·버튼을 추가하지 않았고, 기존 once.mjs의 가상 입력만 허용하는 제약과 --live 차단도 그대로다.

## 2. 시작·종료 상태

- 브랜치 main, 시작·종료 HEAD `9bc0db7ed663e4698921a6c9f041313505c72d4b`.
- 시작 작업 트리 깨끗함. 013C의 두 문서는 위 커밋에 이미 포함되어 있었다. 이번 작업에서 커밋하지 않았다.
- 기존 파일3개 수정, 신규 코드/검사3개, 문서2개: 총8파일 미커밋.
- reset/clean/checkout·commit/push 없음. 사용자 변경·실제 데이터 보존.
- 프로젝트가 이번 실행의 쓰기 허용 목록 밖이어서 먼저 `/private/tmp/nb-v2-013d-work`의 검토 사본에서 구현·480개 검사를 마친 뒤, 지정8파일의 저장 권한만 요청했다.

## 3. 변경 파일

신규:

- `/Users/jsy/Desktop/EST_Project/server/notion/test-auth.mjs`: 요청마다 기존 createReadonlySupabase.getUser로 인증하고 승인 UUID 확인. 순수한 서버 내부 식별 결과만 반환.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/authenticated-once.mjs`: 인증·대상/정책·소비·모의 실행의 결합. 기본 차단, 실제 실행용 엔드포인트 아님.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-authenticated-once.test.mjs`: 신규39개 검사.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-013D_REPORT.md`.
- `/Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013D_CHATGPT_HANDOFF.md`.

수정:

- `/Users/jsy/Desktop/EST_Project/server/notion/test-connection.mjs`: 인증 helper 재사용. 기존 Origin/빈 본문/안전 응답 유틸을 비공개 로컬 모의 인터페이스와 공유. 기존 API 경로·본문·응답 계약 유지.
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/approval.mjs`: 기존 고정 정책 이름을 export하여 대상 정책 대조에 재사용. 소비 기록 binding·파일 포맷·해시·예산 로직 변경 없음.
- `/Users/jsy/Desktop/EST_Project/js/notion-test-connection.mjs`: 동일 사용자여도 access_token이 달라졌으면 지연된 응답을 폐기하고 상태 정리. 토큰 값 저장/출력 추가 없음.

기존 server/supabase-readonly.mjs, test-configuration.mjs, test-readonly.mjs, once.mjs, hidden-input.mjs, 배포 API entrypoint, 로그인 UI·저장·Planner·CLI·DB/RLS는 변경하지 않았다. 기존441개 검사 파일을 삭제/수정/비활성화하지 않았다.

## 4. 인증 검증과 승인 소비의 구분

공통 authenticateTestUser는 Bearer 존재/형식을 확인하고 기존 읽기 전용 클라이언트로 Auth `/auth/v1/user`를 요청한다. 인증 서버가 확인한 UUID만 반환하고 매 요청 새로 검증한다. JWT를 decode하여 신뢰하거나 이메일·관리자 역할·user_metadata·브라우저 user_id를 사용하지 않는다. 실제 UUID는 하드코딩하지 않았다.

승인 사용자 UUID가 없으면503, 다른 UUID면403, 세션이 없거나 거절되면401이다. 이 단계에서 Notion 토큰을 읽지 않는다. 요청 취소 시 늦은 Auth 결과가 오더라도 자격 증명/소비 전에 거절한다. helper에도 명시적인 Auth adapter를 요구하여 누락이 전역 fetch로 대체되지 않도록 했다. 기존 배포 API는 이전과 같이 자신의 Auth adapter를 전달한다.

새 createAuthenticatedMockHandler는 다음 순서다.

1. 명시적 mock 모드와 adapter 확인. 기본·live·Notion adapter 주입 옵션 거절.
2. HTTP loopback 주소·POST·Origin·빈 JSON 본문 검사. user_id·pageId·URL·runId·approved 입력 금지.
3. 서버 Auth 사용자 UUID와 서버 승인 사용자 UUID 비교.
4. 서버에서 제공한 approvedTarget의 사용자/Workspace/Bot/부모/scope/policy를 현재 서버 설정과 대조. null·불일치·정책 변경은 자격 증명 전에 거절.
5. 가상 대상만 허용. 실제/다른 대상은 토큰 읽기 전에 거절하고, 기존 MOCK_ENV와 같은 가상 입력만 기존 runMockOnce로 전달.
6. runMockOnce가 기존 consumeLocalApproval로 먼저 원자적 소비 기록을 남기고 고정 모의 users/me와 일치 시 부모 GET을 실행.
7. 안전한 모의 요약만 반환하고 임시 자격 증명 객체를 정리. 실패도 기록 보존.

approvedTarget은 서버 내부 주입 자료이며 브라우저가 제출하거나 역사적 JSON에서 자동 로딩하지 않는다. 이름에 approved가 있어도 실제 사용자 승인 증명은 아니다. 이번에는 가상 target만 주입했다. 009B는 실제 연결의 우선 후보로만 남아 있다.

기존 mock CLI 자체는 독립적인 가상 입력 검사로 유지한다. 인증 없이 실제 대상을 실행하는 경로가 열린 것은 아니다. 새 인증 결합 경로도 현재는 모의 전용이므로 실제 세션/Notion 사용을 지원한다고 판단하지 않는다.

## 5. 세션 변경·로그아웃·응답

서버는 인증 결과를 다른 요청에 캐시하지 않는다. A 인증 성공 후 B·무효·무인증 요청이 오면 각각 새로 검증/거절한다. 클라이언트는 요청 전후 사용자와 세션 access_token을 비교하며 변경 시 늦은 상태를 폐기한다. 기존 auth-cleared 이벤트와 요청 순번/취소도 유지한다.

이는 서버의 과거 인증 결과 재사용 방지와 클라이언트의 지연 상태 방지다. 이미 수락된 JWT를 로그아웃 순간 전 세계에서 즉시 무효화하는 기능을 추가한 것은 아니다. 기존 Supabase 세션 폐기/토큰 수명 정책은 유지되며, 이 정책을 변경하거나 실제 취소 효력을 실계정으로 검증하지 않았다.

기존 API는 식별자 없는 계약을 유지한다. 새 비공개 모의 응답은 validationMode=mock, mockTargetReadVerified, simulatedGets로 모의 결과를 표시한다. actualNotionRequests=0, notionRequests=0, remoteReadEnabled=false, targetReadVerified=false, webExecutionReady=false, notionExecution=not_executed다. 전체 비공개·생성 권한도 false/미검증이다.

UUID·대상 ID·URL·토큰·Authorization·설정 원문·upstream 원문은 응답/오류/로그에 반환하지 않는다. 알려진 오류 코드만 선택한다. 새 UI·생성/OAuth/실제 실행 버튼 및 공개 라우트는 추가하지 않았다.

## 6. 검사

격리 검토 사본 및 실제 프로젝트의 최종 전체 Node **480/480 통과**, 기존441 + 신규39. 실패·취소·건너뜀0. V1 256조합 포함. 요청 당시 토큰을 고정하여 같은 세션 객체 내부의 갱신도 검증한 뒤 실제 프로젝트 전체 검사를 재실행했다.

신규 검증:

- 정상 인증·UUID 일치, 무인증/잘못된 세션/익명/잘못된 사용자 응답/Auth 장애 거절.
- 다른 UUID가 관리자 역할·이메일·user_metadata를 제시해도 거절. 토큰 getter 미접근 및 소비 파일 부재 확인.
- 서버 승인 대상의 여섯 필드 각각 불일치, 승인 대상 없음, 비가상 대상 차단.
- 요청별 인증, A/B 동시 인증 응답 격리, Auth 지연 중 취소.
- 승인 재사용, 두 OS 프로세스의 인증 후 동시 실행에서 하나만 소비.
- 전체2 GET, 첫 요청 실패/Bot·Workspace 불일치 시 부모0, 부모 불일치, timeout/응답 유실 후 재시도 차단.
- 응답·오류의 비밀/대상 식별자 비노출, 기본/live 차단, 브라우저 임의 필드·외부 Origin·잘못된 메서드 거절.
- 동일 사용자 새 세션 토큰/다른 사용자/로그아웃 후 지연 UI 결과 제거.
- 배포 entrypoint 차단·비공개 파일 미포함.

가상 값만 사용했다. 실제 계정 토큰을 추출하지 않았으며 실제 Supabase/Notion 요청0이다. 전체 검사는 env -i의 비밀 없는 환경에서 실행하고 외부 응답은 모의 adapter, HTTP 검사는 loopback만 사용했다.

공개 빌드는 검토 사본에서32파일 생성 및 구문 검사 통과. 최종 프로젝트 공개 소스32개와 빌드 결과의 내용 불일치0, 알려진 비밀 형식/서버 참조 발견0, 원본 JPEG 바이트 유지도 확인했다. 이 패턴 검사를 모든 비밀 탐지 보장으로 표현하지 않는다. 프로젝트 public-dist나 기존 서버를 바꾸지 않았다. 첫 신규 검사에서 취소 오류의 상태 구분과405 응답의 모의 카운터 누락을 발견해 보완했고39개와 전체480개를 다시 통과했다. 자동 검사 외 실제 브라우저·모바일·실계정 QA는 미실행이다.

근거 로그: `/private/tmp/nb-v2-013d-project-full.log`(최종 프로젝트480개), `/private/tmp/nb-v2-013d-stage-full.log`, `/private/tmp/nb-v2-013d-focused.log`, `/private/tmp/nb-v2-013d-build.json`.

## 7. 실제 대상·권한 상태와 후속 조건

사용자가 전달한 ChatGPT 연결 도구 확인 결과는 개인 Workspace가 과거와 일치, 009A/B Private 부모와 009B의3DB 존재, 테스트 설계 A/B 소유자 동일이다. 이번 작업에서 그 원격 결과를 재조회하지 않았다. 플러그인의 Workspace 확인을 내부 Integration 토큰의 권한 증거로 바꾸지 않는다.

실제 설계 소유자 UUID와 현재 Auth 세션 UUID 대조, 이번 부모 최종 승인, 공유·상속·웹 게시, 현재 내부 Integration 토큰 유형·권한은 여전히 미검증이다. PAT도 Bot 조회를 사용할 수 있으므로 type=bot만으로 내부 Integration 토큰임을 확정하지 않는다. 실제 ID나 비밀을 코드/새 설정에 자동 등록하지 않았다.

다음 실제 읽기 단계 전에는 본인 세션과 승인 사용자 대조, Workspace/Bot/부모 고정, 내부 연결 토큰 출처 및 공유 범위 확인, 실제 연결용 경로의 별도 검토·구현, 실제 로컬 비밀 입력과 최대2 GET에 대한 명시적 승인이 필요하다. 현재 입력기/모의 handler를 실제 값으로 실행하면 안 된다.

실패 후 기록 보존·자동 재시도 금지 및 배포 entrypoint 차단을 계속 유지한다. 로컬 기록은 실제 승인 증명/다중 사용자 영구 DB가 아니며, NB-V2-014에 필요한 영구 실행 기록·원자적 승인·중복 방지·부분 실패 복구는 별도다.

## 8. 변경 여부와 공식 근거

실제 Notion 요청/쓰기0, 실제 Supabase API0, 실제 비밀 조회/입력/설정/출력0, DB·RLS·Auth 정책·계정/역할·업무 데이터 변경0, Git commit/push0, Vercel 배포·환경변수 변경0. 문서 조사에 사용한 공개 웹 요청은 업무 API 호출과 구분한다.

[Supabase getUser 공식 문서](https://supabase.com/docs/reference/javascript/auth-getuser)는 인증 서버 요청으로 검증한 사용자 정보를 권한 판정에 사용할 수 있음을 설명한다. 기존 같은 REST 경로를 재사용했다. changelog.md는 웹 도구에서 markdown 형식 제한으로 열리지 않았고, 이번에는 SDK 의존성·세션/DB 정책을 변경하지 않았다.
