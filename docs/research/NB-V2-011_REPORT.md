# [NB-V2-011 작업 보고서] Notion 자동 생성 웹 연동 설계

2026-11-02. **조사·아키텍처·다음 단계 범위 확정 완료. 실제 웹 생성 기능은 미구현이다.**

## 1. Git 및 변경 범위

- 시작 main / b01fdb2f6f8e53e09fcff949b8cd135f9ed1d826, 작업 트리 clean.
- 이전 UI-010 기준 SHA와 달랐으며 이번에는 실제 최신 소스를 읽었다. 과거 011A~E/PoC 문서는 덮어쓰지 않았다.
- 제품 코드·테스트·JPEG·PROJECT_SPEC·SQL 수정 없음. 이번 추가는 요청한 아키텍처/보고서/인계문3개뿐이다.
- 종료 HEAD는 시작과 동일하며 추적 파일/staged 차이 없이 새 문서3개만 미추적 상태다.
- commit/push/checkout/reset/clean, Vercel 배포/설정, Supabase 데이터/Auth/RLS/권한, Notion token/데이터 생성·변경 없음.

## 2. 조사 범위와 현재 상태

PROJECT_SPEC.md, js/planner/{plan,catalog}.mjs, js/drafts/{model,repository}.mjs, server/{review-plan,drafts-review,supabase-readonly}.mjs, api/drafts/review.mjs, js/auth-core.js, js/supabase-client.js, database/education-drafts.sql, scripts/notion-poc/basic-notion/standard-notion 및 관련 회귀·과거 실증 문서를 읽었다.

PROJECT_SPEC 앞부분은 V1 Mock 기준, 뒷부분은 후속 기획이다. 현행 제품은 규칙 기반이며 AI API 생성이라고 보지 않았다.

| 확인 항목 | 실제 현재 상태 |
| --- | --- |
| 저장 | configuration/schema version1, requirements+mapping+planner, 최대512KiB |
| 현재 Supabase | public.education_drafts 1개, RLS 활성, user_id→auth.users.id, 주요 컬럼/형식 메타데이터 확인. 행 내용 미조회 |
| 소유권 | 현재 서버는 Auth /user 검증→본인JWT+RLS+id/user_id 필터→소유자 재대조 |
| 기본형 | 논리 신청/참가1DB. 기본형 CLI가 제한된9유형의 빈1DB를 준비·생성하는 구조 |
| 일반형 | 사람/프로그램/신청기록3DB. 현재 실행기는 고정 가상7행과 특정 속성 바인딩 필요 |
| 확장형 | 모듈 의존성·관계·계산의 논리 계획. 임의 사용자 설계 웹 실행 미지원 |
| 교육 운영 필수 | 교육생/일정은 V1 Mock·저장 선택과 현재 planner가 연결되지 않음. 출석은 확장형 논리 모듈이며 운영 필수3DB 완성 아님 |
| 서버 review | 요약/검증/planHash 반환. 전체 계획·원본·Notion payload 비반환, webExecutionReady=false |
| Notion 웹/OAuth | 미구현 |

원격 메타데이터 조회는 Supabase list_tables(public,verbose) 1회뿐이며 SQL/행 조회/계정 조회는 하지 않았다. RLS 세부 정책·GRANT의 원격 재감사까지 수행한 것은 아니다. 해당 제약은 로컬 SQL과 기존 코드 근거로 설명했다.

## 3. 주요 설계 결정

1. 정적 화면/기존 Node Functions/기존 review 계약을 유지하고 별도 POST /api/notion/plans/review를 제안했다.
2. 012는 저장본에서 서버가 생성 spec을 재계산·미리보기만 수행한다. 논리 planVersion1/저장 version1은 유지하고 executionPlanVersion/adapterVersion/compilationHash를 분리한다.
3. 제목/교육 페이지명까지 포함하는 변환 해시와 기존 논리 해시·마이크로초 updatedAt을 구분한다. 기존 planHash만으로 전체 저장본 변경이나 승인 여부를 판정하지 않는다.
4. 신청 모델을 교육생 모델로 자동 이름 변경하지 않는다. 필수 운영3DB의 누락을 표시하고 일반형3DB가 교육생/출석/일정이라고 오해하지 않게 한다.
5. 013/014는 명시한 본인 UUID1개+개인 workspace/bot+테스트 부모의 서버 연결 A를 사용한다. 관리자 전체 또는 다른 PPLUS 사용자에게 개인 token을 제공하지 않는다. 다중 사용자 공개 전 OAuth B가 필요하다.
6. 014 전에 별도 승인한 영구 run/step·원자적 승인·배타 제어가 필요하다. Vercel 임시 파일/메모리 잠금으로 기존 CLI manifest를 대체하지 않는다.
7. 최초 생성 후보는 새 교육 페이지1+빈 기본 DB/DS 각1, 행0·관계/계산/View0, 쓰기 최대3회다. 이는 후속 별도 승인안이며 이번 승인이 아니다.
8. 교육생/출석/일정 프로파일·선택 모듈·KPI/사용자 지표·OAuth는 후속 명세로 나눴다. 모집/선정 통계와 교육 운영 분모를 분리했다.

각 결정의 코드 위치·공식 API 근거·요청/응답·실패 상태·예정 파일/검사는 NB-V2-011_NOTION_WEB_ARCHITECTURE.md에 상세히 작성했다.

## 4. 공식 문서 확인

- 코드의 2026-03-11 헤더와 최신 업그레이드 안내를 비교했다. 기존 DS 스키마 생성/갱신 패턴은 유지하고 무근거 재작성은 하지 않는다. [업그레이드 안내](https://developers.notion.com/guides/get-started/upgrade-guide-2026-03-11)
- Database/DS·Page·관계/계산·선택 옵션/색상·Status 그룹 한계를 구분했다. [DB/DS](https://developers.notion.com/guides/data-apis/working-with-databases), [스키마 갱신](https://developers.notion.com/reference/update-data-source-properties)
- View/Dashboard는 공식 API가 존재하지만 현재 범용 planner/웹 지원과는 별개다. 과거 표/도넛 검증을 Dashboard 성공으로 처리하지 않았다. [Views](https://developers.notion.com/guides/data-apis/working-with-views)
- 연결/워크스페이스별 제한·Retry-After·불명확503·블록 제한은 후속 서버 오류 계약에 반영했다. 구 PoC 클라이언트의 원문 오류 전체 저장은 제안하지 않았다. [요청 제한](https://developers.notion.com/reference/request-limits), [블록 제한](https://developers.notion.com/reference/workspace-block-limits)
- 연결 권한과 페이지 공유·OAuth/갱신/철회를 구분했다. 읽기 성공이 쓰기 권한/전체 ACL 증명이 아니다. [권한](https://developers.notion.com/reference/capabilities), [OAuth](https://developers.notion.com/guides/get-started/authorization)
- 일부 Markdown/거대 참조 페이지의 도구 읽기 실패는 정상 HTML 가이드/현행 참조/인덱스로 보완했다. 이 문서 조사는 Notion API 실호출 검증이 아니다.

## 5. 이번 기술 검증

임시 스크립트에서 기존 순수 함수만 실행했다. fetch는 호출 즉시 실패하도록 막았고 실제 시도0이었다. 제품 파일/사용자 설정/manifest를 쓰지 않았다.

| 검사 | 결과 |
| --- | --- |
| 기존 승인 가상 기본형 설정→freezeBasicPlan | 빈1DB/7속성 준비 성공 |
| planner requestTemplates | 모두 executable=false |
| 기본 상태를 포함한 일반형 | 실행기 unsupported_property_type |
| 일반형에 fixture 미제공 | synthetic_seven_rows_required |
| 승인용 명시 가상 fixture | 3DB/7행 준비 성공. 실행 안 함 |
| 출석+팀 확장형 | 6DB·attendance/participation/teams 3모듈. 일정/독립 students DB 없음 |
| 저장 planner 생략/전달 | 생략 basic, 명시 extended |
| review 플래그/해시 | webExecutionReady=false, not_executed, 기존 canonical 해시 일치 |
| 교육명만 수정 | planHash 동일할 수 있음, updatedAt 1마이크로초 차이 검출 |
| V1 기본 항목 선택 | 현재 planner의 운영 DB 생성에 자동 반영되지 않음 |
| fetch 금지 검사 | 네트워크 시도0 |

**11개 검사 통과.** 전체 Node/V1/브라우저/실계정 검사를 새로 실행하지 않았다. 이전326개 통과는 이전 기록이며 이번11개와 합산하지 않는다. 임시 증거: /private/tmp/pplus-nb011-pure-check.json.

## 6. 기존 실제 실증과 이번 미검증

과거 보고/근거를 읽은 결과: 009A 기본형 빈1DB/7속성 readback34항목, 009B 가상3DB/7행79항목, 002A 고정6DB/16행 및 출석75→100 재계산130항목·표3/도넛1 이력이 있다. 이번 원격 재조회는 아니다.

기본형9유형 중 과거 실제 생성 유형은6종이며 Number/Date/Checkbox는 당시 모의 검사였다. 일반형 선정률은 Notion 비율 속성이 아닌 원격 건수 기반 로컬 계산이었다. Dashboard/회사 복제/임의 사용자 설계 생성/OAuth/서버 실행 이력·분산 잠금은 미검증 또는 미구현이다.

## 7. 다음 단계와 안전 범위

NB-V2-012를 권장한다. 새 읽기 전용 변환 API·미리보기 패널·미지원 표시·본인 저장본/수정 충돌/계정 전환/비밀 비반환 검사까지다. 신규SQL/Notion 연결/쓰기/배포/자유 KPI 편집/교육 운영3DB 추가는 제외한다. 013의 서버 비밀 설정과 014의 영구 기록 DB 적용·실제 생성·배포는 각각 구체 범위로 별도 승인받아야 한다.

이번 Notion REST/MCP 요청0·Notion 쓰기0, 원격 서비스/운영 데이터 변경0, Git commit/push0·Vercel 배포/설정0·환경변수 변경0이다. Supabase 메타데이터 읽기1회와 공식 문서 조회는 변경 작업이 아니다.

산출물:

- docs/research/NB-V2-011_NOTION_WEB_ARCHITECTURE.md
- docs/research/NB-V2-011_REPORT.md
- docs/chat-handoff/NB-V2-011_CHATGPT_HANDOFF.md
