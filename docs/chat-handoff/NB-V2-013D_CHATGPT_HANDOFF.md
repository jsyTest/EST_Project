# [ChatGPT 전달용] NB-V2-013D 사용자 인증·개인 Notion 일회용 모의 경로 결합 결과

## 1. 결론

**로컬 인증 결합과 모의 검증 완료. 실제 Supabase 계정 인증·Notion 연결·배포는 미실행입니다.**

서버에서 검증한 사용자 UUID를 승인 사용자·대상·정책과 대조한 뒤에만 일회용 승인 소비와 최대2 모의 GET으로 진행하도록 결합했습니다. 기존 mock 전용 입력기와 배포 API의 Notion 원격 차단을 유지했습니다.

신규 비공개 경로는 함수 인터페이스이며 서버에 마운트하지 않았습니다. 기본 mode는 blocked, mock만 지원하고 실제 Notion adapter·--live·생성/OAuth/실제 실행 버튼을 추가하지 않았습니다.

## 2. Git·변경 파일

- 작성일: 2026-11-04, Asia/Seoul.
- 시작·종료: main / `9bc0db7ed663e4698921a6c9f041313505c72d4b`.
- 시작 작업 트리 깨끗함. 이전013C 문서는 위 커밋에 이미 포함되어 있었습니다.
- 기존3파일 수정, 신규 코드/검사3파일, 문서2파일: 총8파일 미커밋.
- reset/clean/checkout, commit/push 없이 기존 작업을 보존했습니다.

수정:

- `/Users/jsy/Desktop/EST_Project/server/notion/test-connection.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/approval.mjs`
- `/Users/jsy/Desktop/EST_Project/js/notion-test-connection.mjs`

신규:

- `/Users/jsy/Desktop/EST_Project/server/notion/test-auth.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-local/authenticated-once.mjs`
- `/Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-authenticated-once.test.mjs`
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-013D_REPORT.md`
- `/Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013D_CHATGPT_HANDOFF.md`

## 3. 인증 검증 방식

새 authenticateTestUser는 기존 createReadonlySupabase.getUser를 요청마다 호출하여 서버가 검증한 UUID만 사용합니다. 기존 웹 연결 API도 이 helper를 재사용합니다. [Supabase getUser 공식 문서](https://supabase.com/docs/reference/javascript/auth-getuser)의 인증 서버 검증 원칙을 따릅니다.

- Bearer 없음/무효 세션/익명 사용자 거절.
- 인증 UUID와 서버 승인 UUID 일치 확인.
- 다른 사용자는 관리자 역할·이메일·user_metadata를 제시해도 거절.
- 브라우저 user_id·대상·승인 플래그 입력 거절.
- 인증 실패·사용자 불일치는 Notion 자격 증명을 읽거나 소비 파일을 만들기 전에 차단.
- 인증 결과를 요청 사이에 캐시하지 않으며, 취소된 요청의 늦은 Auth 결과도 거절.
- 실제 사용자 UUID 하드코딩 없음. 이번 검사에는 가상 UUID만 사용.

원격 Auth 결과를 모의 adapter로 제공해 검증한 것이며 실제 Supabase 계정의 성공 사례가 아닙니다. changelog.md는 웹 도구의 markdown 형식 제한으로 조회하지 못했고, SDK·Auth/DB 정책은 변경하지 않았습니다.

## 4. 일회용 소비 결합

새 createAuthenticatedMockHandler의 순서:

1. mock 모드·loopback·메서드·Origin·빈 본문 검사.
2. 현재 요청의 서버 Auth 검증 및 승인 사용자 UUID 비교.
3. 서버 approvedTarget의 사용자·Workspace·Bot·부모·범위·정책 대조.
4. 가상 대상/가상 입력만 허용. 비가상 대상은 토큰 읽기 전에 차단.
5. 기존 runMockOnce와 consumeLocalApproval로 원자적 승인 소비.
6. users/me 최대1회 → Bot/Workspace 일치 시 고정 부모 최대1회.
7. 안전한 모의 상태만 반환하고 임시 자격 증명 참조 정리.

기존 정책 상수를 export하여 대조에 재사용했습니다. 소비 binding·파일 형식·요청 예산은 변경하지 않았습니다. 동시 실행·재시작·runId 변경·실패 후 재사용 차단과 기록 보존을 유지합니다.

approvedTarget은 서버 내부 주입 자료입니다. 과거009A/B JSON을 자동 로딩하거나 이번 승인으로 승계하지 않았습니다. 실제 승인 증명도 아닙니다. 현재는 가상 target만 주입했고009B는 실제 단계의 후보로만 남겼습니다.

로컬 소비 기록은 사용자 승인 증명이나 다중 사용자 영구 실행 DB를 대체하지 않습니다. 기존 독립 mock CLI도 가상 입력 검사로 유지되며 실제 대상 실행 경로가 아닙니다.

## 5. 응답·UI·세션

새 비공개 모의 응답에는 validationMode=mock, mockTargetReadVerified, simulatedGets로 결과를 표시합니다. 실제 Notion 카운터는0이며 remoteReadEnabled=false, targetReadVerified=false, webExecutionReady=false, notionExecution=not_executed입니다. 모의 성공을 실제 읽기 성공으로 표시하지 않습니다.

사용자 UUID·Workspace/Bot/부모 ID·URL·토큰·Authorization·설정 원문·원격 원문은 반환하지 않습니다. 오류도 알려진 코드만 선택합니다. 기존 API 계약과 no-store 응답을 유지했습니다.

UI는 동일 사용자라도 access_token이 바뀌면 지연 응답을 폐기합니다. 다른 사용자·로그아웃 때의 상태 정리도 유지했습니다. 로그인·미리보기 화면의 레이아웃이나 버튼을 추가/개편하지 않았습니다.

이는 과거 인증 결과 재사용과 늦은 UI 상태를 막는 보완입니다. 기존 JWT를 로그아웃 순간 즉시 전역 무효화하는 기능을 추가한 것은 아니며, 실제 세션 취소 효력은 이번에 검증하지 않았습니다.

## 6. 자동 검사 결과

격리 검토 사본과 실제 프로젝트에서 **480/480 통과: 기존441 + 신규39**, 실패·취소·건너뜀0. V1 256조합 포함입니다. 같은 세션 객체의 토큰 갱신도 차단하도록 보완한 뒤 실제 프로젝트 전체 검사를 다시 통과했습니다.

신규 검사:

- 정상 인증/승인 UUID 일치, 인증 실패·익명·Auth 장애 거절.
- 다른 사용자와 관리자 역할만 있는 사용자 거절, Notion 토큰 getter 미접근.
- 승인 대상/정책 여섯 필드 불일치 및 대상 없음 차단.
- 요청별 인증, A/B 동시 인증 격리, Auth 지연 중 취소.
- 동일 승인 재사용 및 두 OS 프로세스 동시 실행 차단.
- 전체2 GET, 첫 실패/불일치 후 부모 요청0, timeout·응답 유실 후 재시도 없음.
- 비밀·대상 식별자 비노출, 기본/live 차단, 외부 Origin·임의 입력 거절.
- 동일 사용자 새 세션/다른 사용자/로그아웃 후 지연 UI 결과 폐기.
- 기존 배포 entrypoint 차단·공개 파일 목록 유지.

기존441개 검사 파일을 삭제·수정·비활성화하지 않았습니다. Auth·저장·매핑·색상·관리자·Notion 미리보기/API·CLI 회귀도 통과했습니다. 가상 인증 결과를 실계정 격리 증거로 사용하지 않습니다.

전체 검사는 비밀 없는 env -i 환경과 모의 adapter로 실행했고, HTTP 검사는 loopback만 사용했습니다. 공개 빌드는 검토 사본에서32파일 생성·구문 검사 통과했습니다. 최종 프로젝트 공개 소스와 빌드의 내용 불일치0, 알려진 비밀 형식/서버 참조 발견0, JPEG 원본 바이트 유지도 확인했습니다. 모든 비밀 종류를 완전 탐지한 검사라는 뜻은 아닙니다. 기존 프로젝트 public-dist와 실행 중 서버는 변경하지 않았습니다.

초기 신규 검사에서 취소 응답의 상태 구분과405 응답의 모의 카운터 누락을 발견해 수정한 뒤 전체 검사를 통과했습니다. 실제 브라우저·모바일·실계정 검사는 하지 않았습니다.

## 7. 실제 대상·권한 상태

사용자가 전달한 ChatGPT 연결 도구 확인 결과는 개인 Workspace의 과거 ID 일치,009A/B Private 부모 존재,009B의3DB,기존 설계A/B의 동일 user_id입니다. 이번 작업에서 원격 재조회를 수행하지 않았습니다.

아직 미확정·미검증:

- 설계 소유자 UUID와 현재 실제 Auth 세션의 직접 대조.
- 이번 테스트 부모의 최종 사용자 승인.
- 직접 공유·상속 권한·웹 게시 상태.
- 현재 내부 Integration 토큰 유형·유효성·권한.
- 전체 비공개 및 생성 권한.

플러그인의 Workspace 접근을 내부 Integration 권한 증거로 간주하지 않습니다. PAT도 Bot 조회를 사용할 수 있으므로 type=bot만으로 내부 Integration 토큰이라고 확정하지 않습니다.

## 8. 실제 읽기 단계 선행 조건과 변경 여부

다음 단계에는 본인 세션/승인 UUID 대조, 대상 고정, 내부 토큰 출처·공유 범위 확인, 실제 연결용 경로 검토·구현, 실제 로컬 비밀 입력 및 최대2 GET에 대한 별도 명시적 승인이 필요합니다. 현재 mock 경로에 실제 값을 입력하면 안 됩니다.

- 실제 Supabase API0, 실제 Notion 요청/쓰기0.
- 실제 비밀 조회·입력·설정·출력0.
- Supabase SQL·RLS·Auth 정책·업무 데이터·계정/역할 변경0.
- Git 로컬8파일 변경, commit/push0.
- Vercel 배포·환경변수 변경0.
- 기존 사용자 데이터·로고·저장 모델·Planner·CLI·배포 entrypoint 보존.

## 9. ChatGPT 검토·다음 작업 결정 요청

1. 서버 Auth 검증 UUID가 승인 사용자·대상·정책과 결합된 뒤에만 소비/모의 요청으로 진행하는지 검토해 주세요.
2. 다른 사용자·관리자 역할·브라우저 user_id로 우회할 수 없는지 평가해 주세요.
3. 승인 소비와 인증이 별개이며, 로컬 기록이 실제 승인 증명/다중 사용자 영구 DB를 대체하지 않는지 확인해 주세요.
4. 기존441개 및 신규39개 검사를 실계정 성공으로 오인하지 말고, 세션 변경·응답 지연·동시 실행 차단을 검토해 주세요.
5. mock-only·--live 차단·배포 API 원격 차단이 유지됐는지 확인해 주세요.
6. 실제 읽기 전 사용자 UUID 대조·부모 최종 승인·공유/게시·내부 토큰 유형 확인 중 무엇을 먼저 마칠지 결정해 주세요.
7. 실제 연결은 별도 명시적 승인 후에만 수행하고, NB-V2-014는 영구 실행 기록·원자적 승인·중복 방지·부분 실패 복구가 준비된 뒤 검토하도록 해 주세요.

완료는 로컬 인증 결합과 모의 검증입니다. 실계정 인증 대조·Notion 실제 연결·생성·운영 배포는 미검증 또는 미실행으로 유지해 주세요.
