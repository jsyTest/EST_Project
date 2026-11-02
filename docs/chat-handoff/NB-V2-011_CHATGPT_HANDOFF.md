# [ChatGPT 전달용] NB-V2-011 Notion 자동 생성 웹 연동 설계 결과

## 1. 작업 판정

**기존 코드 조사·연동 설계·NB-V2-012 범위 정의는 완료했습니다. 실제 Notion 웹 생성은 미구현이며 이번에 생성하지 않았습니다.**

기준 Git은 main / b01fdb2f6f8e53e09fcff949b8cd135f9ed1d826, 시작 작업 트리는 clean이었습니다. 기존 011A~E/PoC/사용자 문서는 유지했습니다.

이번 추가 파일:

- /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-011_NOTION_WEB_ARCHITECTURE.md
- /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-011_REPORT.md
- /Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-011_CHATGPT_HANDOFF.md

제품 코드·테스트·이미지·SQL은 수정하지 않았습니다. 공식 문서별 근거와 코드 위치는 아키텍처 문서의 결정표·API 검토표에 연결했습니다.

## 2. 현재 구현을 정확히 구분한 결과

| 항목 | 현재 상태 |
| --- | --- |
| 저장 | education_drafts, configuration/schema version1, requirements+mapping+planner, 최대512KiB |
| Supabase 구조 | public 테이블 메타데이터 읽기로 education_drafts·RLS 활성·user_id→auth.users.id 확인. 행 내용은 읽지 않음 |
| 서버 검토 | POST /api/drafts/review는 본인 저장본 검증·요약·계획 해시 반환. 실제 실행 기능 아님 |
| 기본형 | 신청/참가1DB, 제한된 기본 속성의 빈 DB CLI 준비/실행 구조 |
| 일반형 | 사람/프로그램/신청기록3DB. 현재 CLI는 가상7행과 고정 바인딩이 필요한 테스트 실행기 |
| 확장형 | 모듈/관계/계산의 논리 Dry Run. 임의 사용자 설계 웹 실행 미지원 |
| 운영 필수3DB | 교육생·출석·일정 전체가 현재 planner에 연결된 상태가 아님. V1 Mock과 혼동 금지 |
| 사용자 정의 KPI | 편집/저장/임의 수식 실행 미구현 |
| OAuth·웹 실행 | 미구현 |

PROJECT_SPEC 앞부분은 과거 V1 기준이고 뒷부분은 후속 기획 메모였습니다. 현재 규칙 기반 제품을 AI API 생성 서비스로 해석하지 않았습니다.

특히 기본형·일반형·확장형이라는 명칭은 DB 개수/모듈 구성 기준입니다. 일반형3DB를 교육생·출석·일정3DB라고 바꿔 설명하면 안 됩니다.

## 3. 재사용과 새 개발

재사용할 부분:

- 기존 Supabase 사용자 재검증·본인 저장본 조회·RLS·변경 감지.
- version1 정규화, planner 생성/검증, 논리 참조, 계산 의존 순서.
- 기본형 허용 속성/옵션·색상 변환, canonical SHA-256, 동결 spec 원리.
- 일반형 역관계의 실제 ID 확인, Rollup/Formula 바인딩·readback 원리.
- CLI의 쓰기 전 기록·부분 실패·응답 유실·중복 방지 원칙.

새로 필요한 부분:

- 저장본→안전한 웹 생성 spec 변환 API와 지원 범위 표시.
- 본인 전용 테스트 연결/부모 allowlist와 서버 비밀 관리.
- 명시적 생성 승인, 영구 run/step, 원자적 승인 소비·동시성 제어.
- 웹용 원격 검증과 부분 성공/결과 링크 표시.
- 교육생·출석·일정 운영 프로파일과 KPI의 명확한 분모.
- 다중 사용자 공개 전 OAuth·암호화 토큰·철회/재연결 관리.

기존 CLI를 웹에서 셸로 호출하거나 개인 workspace 제한만 제거하지 않습니다. 기본/일반 실행기의 파일 Store·고정 부모·가상 행 검증은 웹 범용 실행기와 직접 호환되지 않습니다.

## 4. 제안 API와 승인 흐름

기존 입력/매핑/미리보기→저장→서버 본인 확인→저장본 재계산→지원 범위/생성 계획→연결·부모 확인→사용자 최종 승인→영구 단계 실행→원격 재조회·결과 링크 순서입니다.

| 단계 | API 제안 |
| --- | --- |
| 기존 | POST /api/drafts/review 유지 |
| 012 | POST /api/notion/plans/review |
| 013 | GET /api/notion/test-connection, POST /api/notion/test-target/review |
| 014 | runs/propose → runs/{id}/confirm → execute, GET 상태, 명시적 resume |

012 새 API는 draftId·expectedUpdatedAt·expectedPlanHash만 받으며 세 값 모두 필요합니다. 브라우저 configuration/user_id/Notion token/임의 요청 템플릿을 받지 않습니다. 기존 review의 입력·출력 계약은 유지합니다.

새 응답은 안전한 DB/속성/색상/관계/계산·미지원 요약, executionPlanVersion, adapterVersion, compilationHash, 대상 미검증 상태를 포함합니다. 원문 폼·rawText·CSV 응답·세션은 반환하지 않습니다. 항상 webExecutionReady=false, notionExecution=not_executed, Notion 요청/쓰기0입니다.

기존 planHash는 논리 계획 해시이며 교육명만 수정하면 같을 수 있습니다. 마이크로초 updatedAt과 교육 페이지명/변환 spec/어댑터 버전을 포함한 compilationHash를 구분합니다. 실제 승인에는 사용자·설계 snapshot·연결 revision·workspace/bot·부모·요청 hash·만료/nonce까지 결합해야 합니다. planHash나 approved=true만으로 생성하지 않습니다.

생성 전에는 새 원격ID를 모르므로 승인 해시는 논리 요청·바인딩 규칙을 고정합니다. 단계 직전 검증한 실제ID를 치환한 payload 해시를 기록합니다. 중복 판단에는 runId/nonce를 제외한 별도 의미 식별값을 사용해 새 runId 우회도 막아야 합니다.

## 5. 연결 방식 권장

013/014는 A: 명시한 본인 Supabase UUID1개와 개인 테스트 workspace/bot/부모만 허용하는 서버 연결을 권장합니다. 관리자라는 이유만으로 허용하거나 다른 관리자/사용자에게 개발자 token을 공유하지 않습니다. 회사 공간은 제외합니다.

여러 사용자에게 생성 기능을 공개하기 전에는 B: 사용자별 OAuth를 구현해야 합니다. 시작 본인·state·브라우저 거래를 결합하고 callback 후 동일 로그인 사용자로 완료합니다. token은 서버 전용 암호화 저장, 갱신/철회/재연결은 연결별로 관리하며 권한 revision 변경 시 대기 승인을 무효화합니다.

Supabase Publishable Key는 공개 클라이언트 설정이며 Notion 비밀이나 소유권 검증의 대용이 아닙니다. 현재 서버 환경변수나 token을 새로 만들거나 조회·변경하지 않았습니다.

## 6. 도메인·지원 범위

- 모집의 사람/신청 통계와 선정 후 교육생 운영 KPI를 분리합니다.
- 기존 출석/팀/프로젝트/심사 모듈을 일반 교육의 일정/과제/평가와 자동으로 동일시하지 않습니다.
- 운영 목표는 교육별 독립 페이지+교육생/출석/일정3DB입니다. 다만 012에서는 현재 계획을 변환하고 미구현 운영 요소를 coverage/blockers로 표시합니다.
- 강사·운영 물품·임의 지표는 현재 지원한다고 표시하지 않습니다.
- 빈 DB는 KPI 미산출입니다. 수식 정의 재조회와 실제 값 계산 성공은 별개입니다.
- 014 첫 실험은 새 교육 페이지1+빈 기본 DB/DS 각1, 행0·관계/계산/View0, 필요할 때 새 DS 이름 PATCH 최대1회입니다. 최대 쓰기3회라는 구체 제안은 후속 별도 승인 대상입니다.
- 이1DB 실험은 교육 운영 필수3DB가 완성됐다는 의미가 아닙니다.

## 7. 중복·실패·실행 기록

014 전에 별도 승인한 영구 run/step 저장이 필요합니다. 기존 education_drafts에 token/실행 이력을 넣지 않습니다. Vercel 임시 파일이나 메모리 잠금을 영구 기록으로 쓰지 않습니다.

단계별 쓰기 시작을 먼저 영구 저장하고 반환 ID를 즉시 기록합니다. 응답 유실·타임아웃·불명확503 후 자동 재전송/삭제/새 runId 재생성은 금지합니다. 후보는 읽기로 대조하고 자동 채택하지 않으며, 재개는 동일 spec의 미시작 단계만 명시적으로 허용합니다.

partial·uncertain·manual_review·verification_failed를 구분하고 확인된 객체 ID·링크와 미완료 단계를 보여줍니다. 202 응답이나 브라우저 종료 뒤 백그라운드 완료를 보장하지 않습니다.

## 8. 이번 검증과 과거 실증

네트워크 금지 상태에서 기존 순수 함수 검사11개를 통과했습니다.

- 기존 가상 기본형7속성 컴파일 성공, 템플릿 executable=false.
- 일반형 Status 차단, 가상 fixture 누락 시 차단.
- 명시 가상7행을 준 일반형은 준비만 성공. 생성은 안 함.
- 출석+팀 확장형은6DB/의존3모듈이며 독립 교육생·일정DB 없음.
- 저장 planner를 명시 전달해야 하며 생략하면 basic으로 계산됨.
- review 비실행 플래그/해시 유지.
- 제목만 수정 시 같은 planHash라도 updatedAt 차이 검출.
- V1 기본 선택값이 현재 운영DB로 자동 변환되지 않음.
- fetch 시도0.

이전 보고에서 기본형 빈1DB·일반형 가상3DB/7행·구 PoC6DB/16행/KPI 재계산·표/도넛의 실제 이력을 확인했습니다. 이번 원격 재검증은 아닙니다. 일반형 선정률은 원격 건수 기반 로컬 계산이며 Notion 비율 속성 생성 성공이 아닙니다.

전체 Node/V1·실계정 로그인·현재 Notion 권한·웹 생성·OAuth·Dashboard·회사 복제는 이번에 실행하지 않았습니다. 기존 검사 통과 수를 이번 검사 수와 합산하지 않았습니다.

## 9. 다음 구현 단계

**NB-V2-012 범위:** 새 읽기 전용 변환 API, 기존 미리보기 안의 서버 검토 패널, 미지원 표시, 소유권·snapshot·해시·비밀 비반환·계정 전환 회귀입니다. 신규SQL/Notion 연결/쓰기/배포/운영3DB 추가/자유 KPI 편집은 제외합니다.

예정 파일은 api/notion/plans/review.mjs, server/notion/preview-plan.mjs·preview-handler.mjs, js/notion-preview.mjs와 테스트입니다. index/mapping·패널 CSS·공개 allowlist·로컬 개발 라우트는 필요한 최소 변경만 제안했습니다.

완료 기준은 저장본에서 안전한 계획 미리보기가 생성되고 본인/타인·없는 설계·변경 충돌·과거 version1·모듈/옵션·미지원·지연 응답·공개 빌드 회귀가 통과하며 Notion 요청/쓰기0인 것입니다. 실제 Supabase 검사는 기존 승인된 본인 테스트 설계 읽기만 사용하고 모의 검사와 구분합니다.

013의 서버 비밀 설정, 014의 기록 DB 적용·실제 생성·배포는 각각 별도 승인해야 합니다. 교육 운영3DB/KPI와 OAuth는 다음 독립 단계입니다.

## 10. 변경 여부·산출물

- 제품 코드/테스트/이미지/기존 문서 변경0.
- Notion REST/MCP 요청0·쓰기0, 회사 연결0, token 생성/출력/공유0.
- Supabase는 테이블 메타데이터 읽기1회뿐이며 데이터/Auth/RLS/권한 변경0.
- Git commit/push0, Vercel 배포/설정0, 환경변수 변경0.
- 설계 문서3개만 로컬 저장했습니다.
- 종료 Git HEAD는 시작과 같고 추적 파일/staged 차이 없이 새 문서3개만 미추적 상태입니다.
- 상세 설계: /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-011_NOTION_WEB_ARCHITECTURE.md
- 작업 보고서: /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-011_REPORT.md
- 인계문: /Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-011_CHATGPT_HANDOFF.md

## ChatGPT 최종 검토·다음 작업 결정 요청

1. 기존 신청 중심 계획과 교육 운영 필수3DB의 차이를 적절히 분리했는지 검토해 주세요.
2. 개인1계정 제한 실험과 다중 사용자 OAuth를 구분한 보안 구조를 평가해 주세요.
3. planHash/updatedAt/compilationHash/실제 승인 계약이 변경·중복 실행을 안전하게 구분하는지 검토해 주세요.
4. 012를 쓰기 없는 계획 변환·미지원 표시로 한정한 범위를 검토하고 다음 Codex 프롬프트를 작성해 주세요.
5. 영구 실행 기록·원자적 승인·대상 검증 없이014로 넘어가지 않도록 선행 조건을 확인해 주세요.
6. 과거 실제 API 실증·이번11개 순수 검사·아직 미구현인 웹/OAuth/운영 KPI를 구분해 주세요.

**설계 완료를 실제 웹 생성 성공으로 판단하지 말고, 후속 구현과 원격 쓰기/DB 적용/배포는 각각 정해진 범위로 승인받아 진행해 주세요.**
