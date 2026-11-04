# NB-V2-013F 실계정 인증과 소유권 검증 결과

2026-11-04 Asia/Seoul. 원본 기준 main / 6500f561461f9e927ecff01c84857a6708089af2. 시작 작업 트리는 깨끗했으며 commit/push·배포는 하지 않았습니다.

## 실제로 확인한 것

기존 Chrome 로그인과 기존 두 API로 NB-V2-006 E2E, NB-V2-010A 저장 테스트 B, NB-V2-010A 저장 테스트 A를 각각 검토했습니다. 세 저장본 모두 서버 Auth /user와 사용자로 제한된 저장본 GET이 성공했고, 서버 내부 UUID 대조가 통과했습니다. 실제 UUID·JWT·쿠키·Authorization 값은 추출하거나 기록하지 않았습니다.

각 설계에서 /api/drafts/review와 /api/notion/plans/review가 200을 반환했습니다. 총 6개 검토 응답에서 serverAuthVerified=true, draftOwnerVerified=true, notionRequests=0, supabaseWrites=0을 확인했습니다. 승인 UUID 후보 원문을 다시 조회하거나 allowlist에 등록한 것은 아닙니다. A/B를 하나의 원자적 요청으로 검사한 것은 아니며, 같은 기존 로그인에서 각 요청의 인증·소유자를 함께 대조했습니다. 두 사용자 실계정 격리는 모의 검사 범위입니다.

Notion 앱의 009B 공유 화면에는 본인만 표시됐고 일반 사용 권한은 ‘초대받은 사용자만’, 본문에는 ‘본인만 접근할 수 있음’이 표시됐습니다. 게시 탭은 ‘웹에 게시’ 안내와 ‘게시’ 버튼 상태였습니다. 현재 009B 부모는 웹에 게시되지 않은 상태로 확인했습니다. 별도의 상속 권한 목록과 하위 DB별 공유 전체는 확인하지 않았습니다.

009B 본문에는 3DB와 가상 사람 2행·가상 프로그램 2행·가상 신청 3행이 보였습니다. 보이는 이메일·신청 동기 칸은 비어 있었습니다. 숨은 속성·행 상세·첨부·댓글까지 감사한 것은 아니므로 민감정보 전체 부재는 확정하지 않습니다.

페이지 메뉴의 ‘연결 1’과 최종 편집자 ‘EST 개인 테스트’ 표시는 확인했습니다. 연결 상세 목록이 열리지 않아 현재 내부 Integration의 이름·유형·Content access·Bot ID는 미확인입니다. 최종 편집자는 현재 연결 권한의 증명이 아닙니다. ChatGPT Notion 커넥터는 별도 연결이며, fetch 결과의 기준 시각은 2026-10-30으로 표시됐습니다.

## 코드와 검사

기존 검토 API의 Auth와 저장본 조회를 요청마다 수행하는 공통 소유권 검사로 묶었습니다. 취소된 요청은 Auth 전후·저장본 조회 후 차단하고, 성공 응답에는 UUID 대신 확인 여부 두 개만 추가합니다. 브라우저는 두 API의 확인 응답을 요구하고, 같은 사용자라도 세션 토큰이 바뀌면 이전 결과를 버립니다. 실제 인증·소유권 일치는 Notion 실행 승인이나 내부 연결 확인을 뜻하지 않습니다.

작업 사본에서 전체 Node 494/494 통과. 기존 480개와 신규 14개입니다. 최초 전체 검사 1건 실패는 사본에 과거 009B 검사 자료 4개를 누락한 결과였으며, 해당 비밀 아닌 자료를 보완한 뒤 전체 검사를 재실행했습니다. 테스트는 가상 Auth/DB/Notion 응답을 사용했고 실계정 확인과 구분합니다.

기존 mock-only, --live 차단, 원자적 승인 소비·총 2GET 예산 모의 검사는 유지합니다. 새 공개 진단 API·OAuth·실행 버튼·실제 Notion adapter는 추가하지 않았습니다.

## 남은 조건

- 별도로 표시되는 상속 권한 및 하위 DB별 공유 범위.
- 의도한 내부 Integration의 현재 Workspace·Content access와 009B 범위.
- 숨은 내용까지 포함한 민감정보 부재.
- 실제 Notion 토큰·Bot·부모 검증은 별도 승인 전까지 미실행.

현재 실제 Notion 연결 승인 가능 상태는 아닙니다. 사용자의 추가 클릭은 지금 필요하지 않습니다.

## 실행 경계와 산출물

원본 폴더의 쓰기 제한 때문에 구현·검사는 먼저 허용된 작업 사본에서 수행했습니다. 적용용 패치는 아래 6개 코드·검사 파일과 이 보고서·인계문을 포함합니다. 원본에 실제 반영됐는지는 최종 Git 상태로 확인합니다.

- server/draft-ownership.mjs 신규
- server/drafts-review.mjs 수정
- server/notion/preview-handler.mjs 수정
- js/notion-preview.mjs 수정
- scripts/notion-poc/tests/draft-ownership.test.mjs 신규
- scripts/notion-poc/tests/notion-preview.test.mjs 수정
- docs/research/NB-V2-013F_REPORT.md 신규
- docs/chat-handoff/NB-V2-013F_CHATGPT_HANDOFF.md 신규

검증용 임시 서버는 127.0.0.1:8796에서 기존 검토 API만 제공하며 Notion 경로는 차단했습니다. 서버의 외부 요청은 기존 공개 설정의 Supabase 호스트에서 Auth/저장본 GET만 허용합니다. .env나 Notion 자격 증명은 읽지 않았습니다. 앱의 정상 세션 전송을 사용했고 에이전트가 토큰 값을 열어보지 않았습니다.

실제 Notion REST 요청·쓰기, 공유/Integration 권한 변경, Supabase 데이터/정책 변경, 승인 기록 소비, Git commit/push, Vercel 배포/환경변수 변경은 하지 않았습니다. Notion 앱·커넥터 자체의 정상 내부 통신까지 0건이라고 주장하지 않습니다.

인증 원칙은 [Supabase getUser 공식 문서](https://supabase.com/docs/reference/javascript/auth-getuser)를 확인했습니다. changelog.md는 도구의 text/markdown 제한으로 가져오지 못했고 SDK·Auth 정책은 변경하지 않았습니다.
