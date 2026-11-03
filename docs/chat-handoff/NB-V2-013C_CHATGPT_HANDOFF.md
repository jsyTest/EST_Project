# [ChatGPT 전달용] NB-V2-013C 개인 Notion 대상 식별·연결 준비 확인 결과

## 1. 결론

**조사 완료 / 역사적 Notion 식별 후보 확보 / 현재 대상 확정 및 실제 연결 준비 미완료.**

009A·009B의 비밀 아닌 자료에서 동일한 Workspace ID와 Bot user ID, 서로 다른 기존 테스트 부모 ID를 찾았습니다. 단순 임의 값이나 Integration 설정 URL에서 추정한 값이 아닙니다. 다만 과거 기록의 발견은 이번 대상 선택·토큰 유형·현재 권한·실행 승인을 뜻하지 않습니다.

사용자는 이번 Notion UI 확인 질문에 **‘아직 확인하지 않았어요’**라고 답했습니다. 확인되지 않은 항목을 완료 처리하지 않았습니다. 실제 Notion 요청·토큰 입력·코드 변경·배포는 하지 않았습니다.

## 2. Git와 산출물

- 작성일: 2026-11-03, Asia/Seoul.
- 시작·종료: main / `59bbd1355d37bb3f20f34a93aece650c35b9fff4`.
- 시작 작업 트리는 깨끗했습니다. 이전 013B의 11파일은 위 커밋에 이미 포함돼 있었습니다.
- 이번 변경은 다음 문서2개 신규 작성뿐입니다. 기존 코드·작업·문서를 초기화하지 않았습니다.
  - `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-013C_REPORT.md`
  - `/Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-013C_CHATGPT_HANDOFF.md`

## 3. 네 대상의 확인 가능 여부

| 대상 | 조사 결과 | 이번 연결 상태 |
|---|---|---|
| 본인 Supabase 사용자 UUID | 검토한 안전한 자료에서 특정하지 못함. 과거 실계정 검사 이력은 있음 | 미확정. 본인이 로컬에서 확인하고 향후 실제 서버 인증 결과와 대조 필요 |
| 개인 Workspace ID | 009A/B target과 009A 실제 결과에서 일치 | 역사적 후보 확보. 현재 개인 공간·이번 사용 확인 전 |
| 내부 Integration Bot user ID | 009A/B target과 009A 실제 결과에서 일치. 당시 users/me 대조 코드와 성공 보고 존재 | 역사적 후보 확보. 현재 토큰의 Bot/유형·유효성 미검증 |
| 기존 테스트 부모 페이지 ID | 002A·009A·009B 후보 존재. A/B는 다른 부모이며 A의 실제 결과·원격 메타데이터도 일치 | 이번 대상으로 한 부모를 채택·사용자 확인하는 단계 미완료 |

실제 ID 원문은 새 문서·채팅에 재출력하지 않았습니다. 설계 행 ID나 모의 USER_A를 실제 사용자 UUID로 사용하지 않았습니다. 가상 값을 실제 allowlist에 저장하거나 과거 대상을 자동 승인하지 않았습니다.

## 4. 근거와 신뢰 수준

확인한 로컬 자료:

- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009A_input/target.json`: workspaceId, botId, parentId.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009B_input/target.json`: 같은 필드. Workspace/Bot은 A와 같고 부모는 다릅니다.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009A_LIVE_RESULT.json`: target 일치, status=verified, verification.ok=true.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009A_REMOTE_METADATA.json`: parentId 일치. databaseId를 부모/Bot ID와 혼동하지 않았습니다.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009B_REPORT.md`: 개인 공간·‘EST 개인 테스트’·Bot·부모와 당시 실제 검사 보고.
- `/Users/jsy/Desktop/EST_Project/docs/research/NB-V2-009B_ACTUAL_RESULT.json`: 당시 실제 검증 완료 기록.
- `/Users/jsy/Desktop/EST_Project/docs/notion-poc/NB-V2-002A_REPORT.md`: 별도 부모와 생성된 교육 페이지를 구분한 기록.

`/Users/jsy/Desktop/EST_Project/scripts/basic-notion/engine.mjs:11` 및 `/Users/jsy/Desktop/EST_Project/scripts/standard-notion/remote.mjs:7`에서 당시 preflight가 users/me의 self.id와 bot.workspace_id를 명시 target과 비교하는 경로를 확인했습니다. 오늘 이 코드를 실행한 것은 아닙니다.

이는 과거 실제 검증 보고·입력·결과·코드 사이의 일관성입니다. 현재 원격 검증이나 서명된 증거는 아니고, 같은 저장소의 자료를 서로 독립적인 외부 증명으로 과장하지 않습니다.

013A/B에서 확보하지 못했던 역사적 Bot/Workspace 근거를 이번에 찾았다는 것이 진전입니다. 과거 승인을 이번 실행 승인으로 승계한 것은 아닙니다.

## 5. 공식 문서에서 확인한 차이

내부 Integration은 한 Workspace의 별도 Bot 권한을 사용하며 공유받은 부모 하위에도 접근할 수 있습니다. PAT는 생성한 실제 사용자의 권한을 사용합니다. 이번 지정 내부 연결을 PAT로 대체해서는 안 됩니다. [내부 연결](https://developers.notion.com/guides/connections-and-tokens/internal-connections), [PAT](https://developers.notion.com/guides/connections-and-tokens/personal-access-tokens).

내부 연결에서는 users/me의 self.id를 Bot ID로, bot.workspace_id를 Workspace ID로 비교합니다. **PAT도 해당 조회의 Bot 정보를 사용할 수 있으므로 type=bot만으로 내부 Integration 토큰임을 입증하지 못합니다.** 토큰 접두사나 이름만으로도 유형을 확정하지 않습니다. [User 정의](https://developers.notion.com/reference/user), [users/me](https://developers.notion.com/reference/get-self), [PAT 권한 설명](https://developers.notion.com/guides/connections-and-tokens/personal-access-tokens).

002A에는 Internal connections의 ‘EST 개인 테스트’를 사용하라는 안내가 있습니다. 이는 과거 의도한 유형의 근거이며 현재 입력할 실제 토큰 유형 확인은 아닙니다. Secret을 열지 않고 사용자가 내부 연결 목록·Workspace·접근 범위를 확인해야 합니다.

관리 화면의 연결 이름·Workspace·capabilities·Content access는 확인 대상으로 안내할 수 있습니다. 모든 관리 화면에서 Workspace/Bot UUID를 직접 얻을 수 있다는 근거는 없으며, Integration 설정 URL ID를 Bot user ID로 바꾸어 쓰지 않습니다.

## 6. 부모 후보와 사용자 확인

002A는 6DB·가상16행, 009A는 기본형1DB, 009B는 일반형3DB·가상7행 실험의 기존 부모입니다. 현재 자료와 권한 상태는 직접 조회하지 않았습니다.

사용자에게 가장 최근 관련 후보인 기존 ‘NB-V2-009B 테스트’의 확인을 안내했지만 아직 확인 전입니다. 자동 선택·등록하지 않았고 새 페이지도 만들지 않았습니다.

사용자가 직접 할 일:

1. 개인 Workspace를 선택하고 회사 공간과 분리됐는지 확인합니다.
2. 기존 테스트 부모의 위치·제목·페이지 종류를 확인합니다. 하위 DB/생성된 교육 페이지와 혼동하지 않습니다.
3. 직접 공유·상속 공유·웹 게시 상태를 각각 확인합니다.
4. Developer portal의 Internal connections에서 의도한 연결과 Workspace를 확인합니다. Secret 표시/복사나 토큰 발급은 하지 않습니다.
5. 부모 Connections와 Content access의 허용 범위를 확인합니다. 권한이 없거나 과도해도 이번에는 변경하지 않습니다.
6. 회사 자료와 실제 교육생 개인정보가 없는지 본인이 확인합니다.

답변은 각 항목의 ‘확인/미확인/불일치’만 전달하면 됩니다. ID·토큰·URL·페이지 내용은 채팅에 보내지 않습니다. 현재 사용자 답변은 ‘아직 확인하지 않았어요’이므로 여섯 항목 모두 확인 전입니다. 이후 확인 완료 답변도 실제 연결 실행 승인으로 취급하지 않습니다.

## 7. 별도 식별 GET이 필요한가?

**현재는 별도 식별 GET을 먼저 추가할 필요가 있다고 보지 않습니다.** 기존 Bot/Workspace 근거를 검토하고 사용자 UI 확인·후보 채택부터 완료하는 것이 우선입니다. 현재 최초 API 응답으로 승인 목록을 자동 생성하는 구조가 아닙니다.

기존 자료가 부적절하거나 다른 연결을 선택한다면 미확정으로 중지합니다. 그때만 users/me 최대1회·부모 조회0회·목록/검색/쓰기0회의 별도 식별 계획을 제안할 수 있습니다. 새로운 명시적 승인과 안전한 로컬 입력·사용자 검토가 필요하며 이번에 구현하거나 실행하지 않았습니다.

추가 식별1회와 이후 연결2회를 하나의 ‘최대2회 승인’으로 섞지 않습니다. 별도 조회도 독립적인 사람의 대상 확인을 대신하지 못합니다.

## 8. 실제 연결용 구현의 선행 조건

- 본인 사용자 UUID를 로컬에서 확인하고 실제 Supabase getUser 결과와 대조.
- Workspace/Bot 후보의 근거 검토 및 부모 한 개의 사용자 선택·공유 확인.
- 현재 사용할 자격 증명이 의도한 내부 Integration에서 나온 것인지 확인. PAT 대체 금지.
- 현재 mock-only 입력기에 실제 값을 넣지 않음.
- 미래의 별도 승인된 로컬 경로에서 인증 사용자·고정 대상·소비 기록·요청 예산을 결합. 입력한 UUID만으로 인증하지 않음.
- 전송 전 원자적 승인 소비, users/me1회 + 일치 시 부모1회, 승인 전체 최대2 GET.
- 실패·timeout·불확실 응답 후 자동 retry 금지, 기록 보존.
- 배포 entrypoint 원격 차단 유지. 기존 CLI preflight는 조상/하위 블록도 조회하므로 2 GET 실험에 그대로 재사용 금지.

실제 연결용 코드의 설계는 가능하지만, 현재 모든 조건이 충족돼 바로 활성화할 수 있는 상태는 아닙니다. 우선 사용자 확인과 UUID·후보 채택을 마친 뒤 작은 인증 결합 구현 작업을 별도 요청하는 것이 적절합니다. 이번에는 코드 변경을 하지 않았습니다.

## 9. 검증과 변경 여부

- 이번 직접 검증: 비밀 아닌 기록의 ID 형식/일치 비교, 관련 소스·공식 문서 조사, 사용자 확인 상태 수신.
- Node441개와 V1 256조합 통과는 013B의 이전 결과이며 이번에 재실행하지 않았습니다.
- 코드·기존 문서·빌드·서버 프로세스 변경0, 신규 문서2개만 작성.
- 실제 Notion API 요청·쓰기0, 토큰 조회·입력·설정·출력0.
- Supabase 운영 데이터·SQL·Auth·RLS·계정/역할 변경0.
- Git commit/push0, Vercel 배포·설정 변경0.
- 현재 읽기 권한·토큰 유효성·전체 비공개·생성 권한·실계정 인증 결합은 미검증입니다.

## 10. ChatGPT 검토 및 다음 작업 결정 요청

1. 009A/B의 Workspace·Bot 근거를 이번 연결의 역사적 후보로 인정할 수 있는지 검토해 주세요. 과거 실행 승인을 현재 승인으로 간주하지 마세요.
2. 본인 UUID·부모 선택·사용자 공유 확인·실제 토큰 유형이 아직 미확정임을 확인해 주세요.
3. type=bot 또는 토큰 접두사만으로 내부 Integration과 PAT를 구분하지 않도록 후속 조건을 검토해 주세요.
4. 별도 식별 GET을 추가하기 전에 기존 근거 검토와 사용자 UI 확인을 우선하는 판단이 적절한지 평가해 주세요.
5. 다음 작업은 사용자 확인·대상 고정을 먼저 마무리할지, 그 이후 인증 결합 로컬 경로를 어떤 작은 범위로 구현할지 결정해 주세요.
6. 실제 보안 입력·최대2 GET 연결 검증은 대상과 경로 확정 후 별도 명시적 승인을 받도록 해 주세요. 현재 mock 실행기에 실제 토큰을 넣도록 안내하지 마세요.

대상 미확정을 실제 연결 준비 완료로 판단하지 마세요. 실제 연결·토큰 입력·Notion 쓰기·배포는 이번에 실행하지 않았습니다.
