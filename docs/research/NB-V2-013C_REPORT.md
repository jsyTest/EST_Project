# [NB-V2-013C 작업 보고서] 개인 Notion 대상 식별 근거·연결 준비 확인

작성일: 2026-11-03, Asia/Seoul.

## 1. 판정

**기존 기록 조사 완료 / 실제 대상·사용자 확인 부분 미완료 / 실제 연결 준비 완료 아님.**

009A/009B의 비밀 아닌 자료에서 실제 사용 이력이 있는 Workspace·Bot 식별자와 서로 다른 테스트 부모 후보를 찾았다. 013B의 ‘식별 근거 미확보’는 이번 조사로 보완되지만, 현재 토큰·현재 접근 권한을 검증한 것은 아니다. 본인 Supabase 사용자 UUID는 검토한 안전한 자료에서 확인하지 못했다. 과거 자료를 이번 승인 목록으로 자동 등록하지 않았다.

사용자는 이번 질문에 **‘아직 확인하지 않았어요’**라고 답했다. 개인 공간·회사 분리·부모·공유/게시·Integration 접근·개인정보 부재 모두 현재 사용자 확인 전으로 기록한다. 실제 토큰 유형과 실제 연결 활성화 승인도 미확인·미승인이다.

## 2. Git 및 조사 범위

- 시작·종료: main / `59bbd1355d37bb3f20f34a93aece650c35b9fff4`.
- 시작 작업 트리 깨끗함. 013B의 이전 11파일은 이 커밋에 이미 포함돼 있었다. 이번 작업에서 커밋하지 않았다.
- 필요한 문서 두 개만 신규 작성. 제품 코드, 기존 문서, public-dist, 실행 기록, 자격 증명, 실행 중 서버 변경 없음.
- 비밀 파일·.env·토큰 저장소·Authorization·쿠키·비공개 manifest/승인 파일은 열지 않았다. 원격 플러그인·Supabase 사용자 조회도 하지 않았다.
- 읽은 범위: 002/002A 보고·설정 안내, 009A/B 보고·대상 JSON·비밀 아닌 결과 JSON, 013A/B 보고서, 관련 Supabase 저장 검증 문서, 기존 preflight 및 차단 entrypoint/입력기 소스.
- 사용자/대상 ID 원문은 새 문서나 대화에 재출력하지 않는다. 기존 파일의 경로·필드명과 일치 여부로 근거를 남긴다.

## 3. 네 식별자의 근거와 신뢰 수준

| 대상 | 기존 자료에서 확인한 사실 | 신뢰 및 이번 대상 상태 |
|---|---|---|
| PPLUS 사용자 UUID | 006/010A의 실계정·테스트 설계 검증 이력은 있지만, 검토한 비밀 아닌 자료에서 본인 Auth UUID를 특정하지 못함 | 값 미확정. 설계 행 ID나 모의 USER_A를 사용자 ID로 대체하지 않음 |
| Workspace ID | 009A target.workspaceId와 009B target.workspaceId가 일치. 009A LIVE_RESULT.target에도 동일 | 과거 식별 근거 확보. 현재 개인 공간/기존 연결 재사용에 대한 사용자 확인은 미완료 |
| 내부 Integration Bot user ID | 009A/009B target.botId가 일치. 009A LIVE_RESULT.target에도 동일. 당시 preflight의 self.id 및 bot.workspace_id 대조 경로와 실제 성공 보고가 있음 | 단순 설정 화면 ID 추측보다 강한 역사적 근거. 현재 입력할 토큰의 소유 Bot/유형·유효성은 미검증 |
| 기존 부모 페이지 ID | 002A·009A·009B의 서로 다른 기존 부모 기록이 있음. 009A/B 대상 ID는 서로 다르며, 009A는 LIVE_RESULT 및 REMOTE_METADATA.parentId와 일치 | 기존 후보 식별 가능. 이번 연결 대상으로 한 페이지를 선택·확인하는 단계는 미완료 |

여기서 역사적 근거란 수정 가능한 저장소 문서·실행 결과·검증 코드의 교차 일관성이다. 서로 다른 외부 기관이 발행한 증명이나 현재 API 재검증, 암호학적으로 서명된 증거는 아니다. 같은 저장소의 복제 자료를 완전히 독립적인 신뢰 원천 두 개로 과장하지 않는다.

### 정확한 로컬 근거 위치

- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009A_input/target.json`: workspaceId, botId, parentId, workspaceName, parentTitle.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009B_input/target.json`: 동일한 필드. A/B의 workspaceId·botId는 같고 parentId는 다름.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009A_LIVE_RESULT.json`: target의 세 ID 일치, status=verified, verification.ok=true.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009A_REMOTE_METADATA.json`: parentId 일치. databaseId는 생성된 DB의 ID이며 부모나 Bot ID가 아님.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009B_REPORT.md`: ‘승인과 실제 원격 대상’에 개인 공간·연결 이름·Bot·부모와 당시 실제 검사 보고.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009B_ACTUAL_RESULT.json`: status=verified와 실제 검증 시각. 이 파일의 생성 DB/DS/행 ID를 Bot/Workspace ID로 사용하지 않음.
- `/Users/jsy/Desktop/EST_Project/docs/notion-poc/NB-V2-002A_REPORT.md`: 테스트 환경의 부모와 생성된 교육 메인 페이지를 구분한 기록. 둘은 다른 객체임.

소스 근거:

- `/Users/jsy/Desktop/EST_Project/scripts/basic-notion/engine.mjs:11`: basicPreflight가 users/me의 type·self.id·bot.workspace_id와 명시 target을 비교함.
- `/Users/jsy/Desktop/EST_Project/scripts/standard-notion/remote.mjs:7`: standardPreflight의 동일한 identity 비교.

당시 실행 성공 보고와 코드 경로를 연결해 역사적 후보로 인정한 것이며, 오늘 이 함수를 실행한 것은 아니다. 두 기존 preflight는 조상 페이지·하위 블록도 조회하므로 향후 ‘총2 GET’ 실험에 그대로 호출하면 안 된다.

### 후보 부모의 구분

- 002A: 기존 6DB·가상16행 실험의 부모. 새 연결의 기본 대상으로 자동 재사용하지 않음.
- 009A: 기본형 1DB 실험의 부모. 빈 신청 DB를 만들었던 이력이며 현재 빈 상태를 보장하지 않음.
- 009B: 일반형 3DB·가상7행 실험의 부모. 가장 최근의 관련 실제 실험 후보로 제시했지만 사용자가 이번 대상으로 확정하지 않음.

현재는 세 후보 중 누구도 승인된 새 부모로 고정하지 않았다. 새 부모 생성이나 권한 변경도 하지 않는다. 사용자가 기존 009B 후보를 확인하는 것이 우선 안내 경로이며, 부적합하면 멈추고 후보를 재검토한다.

## 4. 공식 문서와 토큰 유형

내부 Integration은 한 Workspace에 속한 별도 Bot 권한으로 동작하며 공유받은 부모의 하위 페이지에도 접근할 수 있다. PAT는 생성한 실제 사용자의 페이지 권한으로 동작하므로 현재의 ‘지정 내부 Integration’ 범위를 PAT로 대체하면 안 된다. [내부 연결 문서](https://developers.notion.com/guides/connections-and-tokens/internal-connections), [PAT 문서](https://developers.notion.com/guides/connections-and-tokens/personal-access-tokens).

users/me는 토큰 관련 User를 반환하는 경로다. 내부 연결 검증에서는 self.id를 Bot user ID로, bot.workspace_id를 Workspace ID로 비교한다. **PAT도 이 조회 경로의 Bot 정보를 사용할 수 있으므로 type=bot 하나만으로 내부 Integration 토큰이라고 증명하지 못한다.** 토큰 접두사·연결 이름만으로도 유형을 확정하지 않는다. [User 정의](https://developers.notion.com/reference/user), [users/me](https://developers.notion.com/reference/get-self), [PAT 권한 설명](https://developers.notion.com/guides/connections-and-tokens/personal-access-tokens).

002A 설정 문서에는 ‘Internal connections’의 ‘EST 개인 테스트’를 사용하도록 안내한 이력이 있다. 이는 의도한 연결 유형의 역사적 근거이며, 오늘 실제 토큰을 그곳에서 가져왔거나 현재 유효하다는 확인이 아니다. 토큰을 보지 않고 사용자가 연결 목록·유형·Workspace·Content access를 확인해야 한다. Secret 표시/복사·토큰 발급·연결 추가·Edit access 저장은 이번 범위가 아니다.

공식 문서가 확인해 주는 관리 화면 항목은 내부 연결 목록, Workspace 선택, Configuration의 capabilities, Content access의 대상 범위다. Bot user UUID나 Workspace UUID가 모든 관리 화면에 직접 표시된다는 근거는 확보하지 못했다. Integration 설정 URL의 ID를 Bot user ID로 사용하지 않는다.

부모는 Notion에서 Workspace와 페이지 위치·제목을 확인하고, 필요한 경우 사용자 본인이 로컬에서 페이지 링크의 page ID를 기존 target.parentId와 대조한다. 링크의 DB ID·View ID를 혼동하지 않는다. 링크·ID·페이지 내용은 채팅에 제출하지 않는다. 지정 page ID를 조회하는 것은 읽기 가능 여부 확인이지 전체 공유 ACL/생성 권한 증명이 아니다. [페이지 조회 문서](https://developers.notion.com/reference/retrieve-a-page).

## 5. 별도 식별 GET 필요 여부

**현재는 별도 식별 GET을 먼저 추가할 필요가 있다고 판단하지 않는다.** Bot/Workspace 후보는 이미 역사적 실제 검증 자료에서 확보했으므로, 사용자 확인과 근거 수용 여부를 먼저 정하면 된다. 이번 실험의 최초 응답으로 allowlist를 자동 만드는 방식은 아니다.

이전 자료를 신뢰할 수 없거나 다른 Integration을 사용하려는 경우에는 후보가 미확정인 상태로 중지한다. 그때만 별도 식별 단계의 `GET /v1/users/me` 최대1회·부모 조회0회·검색/목록/쓰기0회 계획을 새로 제안할 수 있다. 토큰 유형·개인 공간·보안 입력 절차·원자적 1회 소비·로컬 비밀 아닌 메타데이터의 사용자 검토가 선행 조건이다. 수집값은 자동 승인하지 않고 사용자 검토와 이후 별도 승인으로 고정해야 한다.

추가 식별 조회를 나중의 연결 승인2회에 숨겨 넣거나 ‘식별1 + 연결2’를 한 승인으로 계산하지 않는다. 추가 GET도 사람의 독립 확인을 대신하지 못한다. 이번에는 이런 조회 코드·토큰 입력·실행을 모두 하지 않았다.

## 6. 사용자가 직접 확인할 절차

사용자가 Notion UI에서 확인만 하며, 불일치가 있으면 변경하지 말고 중지한다.

1. Workspace 선택 메뉴에서 개인 공간을 선택한다. 회사 Workspace·회사 팀 공간과 분리돼 있는지 확인한다.
2. 기존 ‘NB-V2-009B 테스트’ 부모를 열어 제목뿐 아니라 위치와 페이지 종류를 확인한다. 생성된 하위 DB나 교육 페이지와 혼동하지 않는다.
3. 공유 메뉴에서 직접 공유와 상속된 범위, 웹 게시 상태를 각각 확인한다. ‘웹 게시 꺼짐’만으로 비공개 전체가 확인됐다고 판단하지 않는다.
4. Developer portal의 Internal connections에서 의도한 ‘EST 개인 테스트’와 연결 Workspace를 확인한다. PAT 목록을 대체 경로로 사용하지 않고 Secret은 표시/복사하지 않는다.
5. 부모의 Connections 및 포털 Content access에서 의도한 연결과 허용 범위를 확인한다. 부모 하위 접근까지 고려한다. 접근이 없거나 과도하면 Add connection·Edit access로 바꾸지 말고 ‘확인 필요’로 답한다.
6. 테스트 범위에 회사 업무 자료나 실제 교육생 개인정보가 없는지 본인이 확인한다. 에이전트에게 내용을 보내지 않는다.

답변 예: ‘개인 공간·회사 분리 확인 / 부모 확인 / 공유·게시 확인 / 내부 연결 유형·범위 확인 / 업무 자료·개인정보 없음 확인’. 모르는 항목은 ‘미확인’, 다른 점이 있으면 ‘불일치’로만 답하면 된다. 값·토큰·URL은 필요하지 않다.

이번 실제 답변은 ‘아직 확인하지 않았어요’다. 따라서 어떤 항목도 사용자 확인 완료로 바꾸지 않았다. 이 확인 응답이 나중에 도착하더라도 실제 연결 실행 승인으로 간주하지 않는다.

## 7. 다음 실연결 단계의 선행 조건과 구현 가능 여부

준비를 위한 설계는 진행할 수 있으나, 이번 지시에서는 실제 연결용 코드 구현·활성화를 하지 않았다. 현재 모든 선행 조건이 충족된 상태도 아니다.

- 본인 UUID: 사용자가 본인 Auth 정보를 로컬에서 확인하고 향후 서버 getUser 결과와 비교. 이메일·관리자 역할·설계 행 ID로 대체 금지.
- 대상 고정: 역사적 Workspace/Bot 근거를 검토하고 부모 한 개를 사용자 확인 후 로컬 승인 설정에 고정. 현재 자동 등록0.
- 유형: 내부 Integration의 출처와 현재 개인 Workspace를 사용자 UI에서 확인. PAT·플러그인 연결·다른 토큰으로 대체 금지.
- 보안 입력: 현재 mock-only 입력기에 실제 값을 넣지 않음. 미래의 별도 승인된 경로에서만 숨김 로컬 입력과 임시 참조 정리 사용.
- 인증 결합: 실제 Supabase 인증 결과의 사용자 UUID와 로컬 승인 소비 기록/고정 대상/예산을 같은 실행에 결합. 입력한 UUID만으로 본인 인증 금지.
- 승인: 실제 토큰 로컬 입력 및 users/me1회 + 일치 시 고정 부모1회, 전체 최대2 GET에 별도 명시적 승인 필요.
- 실패 처리: 전송 전 원자적 승인 소비, 실패/timeout/불확실 응답 후 기록 보존, 자동 retry·runId 변경·기록 삭제로 재시도 금지.
- 배포: 기존 배포 entrypoint 원격 차단 유지. 기존 CLI preflight의 탐색 경로 재사용 금지. 회사 공간·쓰기·OAuth·배포는 별도 범위.

현재 실제 연결용 구현에 바로 착수하는 것보다 사용자 UI 확인·본인 UUID·후보 채택을 먼저 마무리하는 것이 적절하다. 이후 작은 로컬 인증 결합 구현 범위를 별도 요청으로 정할 수 있다. 구현 허용과 실제 네트워크 실행 승인은 분리한다.

## 8. 검증·변경·미검증

- 이번 직접 수행: 문서/비밀 아닌 메타데이터 읽기, 후보 ID 형식·일치 관계 비교, 관련 소스 읽기, 공식 문서 조사, 사용자 확인 상태 수신, 두 문서 작성.
- 441 Node 및 V1 256조합은 013B의 과거 실행 결과다. 문서 조사 단계인 이번에는 재실행하지 않았다. 빌드·브라우저·계정 인증·Notion 실요청도 실행하지 않았다.
- 실제 Notion API 요청/쓰기0, 실제 비밀 조회/입력/설정/출력0, Supabase 운영 데이터·Auth·RLS 변경0, Git commit/push0, Vercel 배포·설정 변경0.
- 미검증: 본인 UUID, 현재 개인 공간·공유·게시·Integration 범위, 실제 입력할 토큰 유형·유효성, 현재 읽기 권한, 실제 Supabase 인증과 소비 기록의 결합, 전체 비공개·생성 권한.
- 산출물은 이 보고서와 `/Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013C_CHATGPT_HANDOFF.md`다. 대상 미확정을 ‘연결 준비 완료’로 표시하지 않는다.
