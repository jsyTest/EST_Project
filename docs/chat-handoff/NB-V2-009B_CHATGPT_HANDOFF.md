# [ChatGPT 전달용] NB-V2-009B 일반형 관계형 DB 생성 검증 결과

## 프로젝트와 이번 범위

EST_Project는 AI API 없이 규칙으로 교육·해커톤용 Notion DB 계획을 구성하는 서비스다. 기존 V1, Supabase Auth·사용자별 설계 저장/RLS, 폼·CSV 매핑, 옵션 색상, 별도 Notion CLI를 유지했다. 이번에는 웹 버튼 연결 없이 NB-V2-008B planVersion 1의 일반형 사람/프로그램/신청기록 3DB를 개인 Notion에서 실제 검증했다.

실제 시작 Git은 과거 보고와 달리 `main / d02b6c43f7b56f6c575b491325105331b183e2f6`, worktree clean이었다. 종료 커밋은 같고 이번 변경은 미커밋이다. Git 커밋·push·Vercel 배포 없음.

## 구현과 파일

수정: `.gitignore`, `js/planner/plan.mjs`. 신규: `scripts/standard-notion/{plan,store,remote,verify,engine,cli,sample}.mjs`, README, `scripts/notion-poc/tests/standard-execution.test.mjs`, `standard-fake.mjs`.

문서/근거: `docs/research/NB-V2-009B_input/`, `NB-V2-009B_CREATION_REVIEW.md`, `NB-V2-009B_ACTUAL_RESULT.json`, `NB-V2-009B_TEST_RESULT.json`, `NB-V2-009B_REPORT.md`. 비공개 승인/manifest는 gitignore된 `.notion-standard-state/`에 분리했다.

기존 논리 ID와 모델을 재사용했다. 두 운영 유형과 선정 집계는 명시적 옵션으로 추가했다. 내부 `count_all`→실제 API `count` 변환, 숫자 `equals_option` Formula 선행→SUM Rollup 순서, 계산 의존 순서의 Dry Run 템플릿을 보완했다. DSL은 `relation_count`, `equals_option`만 지원한다. 임의 비율 계산식은 추가하지 않았다. 운영 상태는 입력부터 Select로 지정했으며 진정한 Status 생성으로 보고하지 않는다.

## 승인과 실제 원격 생성

부모 생성과 DB/행 생성은 각각 명시적 사용자 승인을 받은 뒤 진행했다. 개인 `지승엽의 워크스페이스` (`10e1f60f-fdfa-8128-b201-00037feeb155`), 연결 `EST 개인 테스트`를 사용했다.

부모: [NB-V2-009B 테스트](https://www.notion.so/4091f60ffdfa811188fcfa1ca8fed352)

| DB 표시명 | database_id | data_source_id |
|---|---|---|
| [TEST] NB-V2-009B 사람 | a99088e9-4bd3-4f00-9c20-f1b9e3e60b29 | a1380c53-b235-41c4-9af7-7b7ab8ba5007 |
| [TEST] NB-V2-009B 프로그램 | d33a5505-9ebf-4d64-b200-5dc105ccfb19 | 99942fed-ea80-4b22-b405-5a2dfb643dce |
| [TEST] NB-V2-009B 신청기록 | ae16116a-6b4f-4ae3-9716-5aa7e8a1a9f3 | 9b34aee8-b9b0-48e1-963c-e37e9d218b0c |

runId `nb-v2-009b-standard-001`, planId `plan-2c9c6df959adeba9`, planHash `a25b2f58d230b94997459e4e701a4584daedbb8e36b9455db1b591dad7197440`, requestHash `c7be20bc6e5c4f0257986b2b113c1b45d8077df797fd94c339a14ee8bcdac7a9`.

속성 총 16개: 사람 4, 프로그램 6, 신청기록 6. 신청기록.사람 `CFMX` ↔ 사람.신청기록 `I%3FjF`, 신청기록.프로그램 `e_TK` ↔ 프로그램.신청기록 `LHkG`. 양쪽 DS 대상·실제 속성 ID·상호 synced_property_id·이름·행 연결을 재조회했다. 자동 역관계 ID로 이름만 바꿨고 역관계를 따로 추가하지 않았다. 전체 원격 속성·행 ID는 실제 결과 JSON에 있다.

## 실제 Notion 계산 결과

가상 사람 P01=A/P02=B, 프로그램 C01=교육/C02=해커톤, 신청 AP01=A→교육 선정/AP02=A→해커톤 미선정/AP03=B→교육 선정을 생성했다. 실제 개인정보·CSV 응답은 사용하지 않았고, 이메일/동기 값은 비웠다. 행마다 식별 문단 1개, 총 7개를 넣었다.

| 항목 | 예상 | 실제 API 재조회 |
|---|---|---|
| 사람 / 신청 | 2 / 3 | 2 / 3 |
| A / B 신청 수 | 2 / 1 | relation_count Formula 2 / 1 |
| AP01 / AP02 / AP03 선정 값 | 1 / 0 / 1 | equals_option Formula 1 / 0 / 1 |
| 교육 / 해커톤 신청 수 | 2 / 1 | count Rollup 2 / 1 |
| 교육 / 해커톤 선정 수 | 2 / 0 | sum Rollup 2 / 0 |
| 교육 / 해커톤 선정률 | 100% / 0% | 원격 건수로 로컬 계산 100% / 0%; Notion 비율 속성은 없음 |

Formula 정의는 `prop("신청기록").length()`, `if(prop("선정 상태") == "선정", 1, 0)`이다. 두 Rollup은 이름 대신 원격 관계/대상 속성 ID로 연결했다. 옵션 이름·색상·개수·고유 옵션 ID도 계획과 일치했다. API 버전 `2026-03-11`.

## 안전장치와 검증 구분

- **실제 API**: 첫 검증 79/79 통과. 같은 완료 실행을 쓰기 차단 상태로 재검증하여 79/79 통과. 재실행 GET 46회·읽기 query POST 3회·추가 쓰기 시도 0회. 79는 요청 수가 아닌 검사 항목 수다.
- **실제 쓰기**: CLI 18회(DB POST 3, 관계 PATCH 2, 역관계 이름 PATCH 2, Formula PATCH 2, Rollup PATCH 2, 행 POST 7). 승인 상한 21회 이내. DS 이름은 일치해 별도 PATCH 0회. 별도 승인한 부모 페이지 생성 1건은 플러그인 작업으로 구분한다. 실제 실행 오류 없음.
- **모의/로컬**: Node 239/239(기존 223+신규 16), V1 256개 조합 통과. DB 1개 생성 후 읽기 실패 재개, 관계 PATCH 응답 유실, DB/행 POST 응답 유실 시 재POST 금지, 잘못된 스키마/계산/권한/승인/타깃/잠금을 검사했다. 실제 장애를 원격에 유발하지 않았다.
- run/parent 잠금, plan/target/fixture/approval 해시, 단계 journal, atomic 0600 manifest를 사용한다. 시작한 쓰기는 읽기로만 확인한다. ID 없는 생성 응답 유실은 후보만 기록하고 자동 채택·재전송하지 않는다. 삭제·롤백 없음.
- 공개 빌드 허용 파일 26개와 경로 검사 통과. CLI·문서·테스트·환경변수·상태는 제외. 변경 파일/빌드/manifest의 Notion 토큰 일치 0건. 기본형/PoC 코드 변경 없음.

## 보존·미검증·우선순위

기존 V1·기본형·Supabase Auth/저장/매핑/옵션 색상/복원·Notion PoC의 자동 회귀 검사는 통과했다. 이번에 브라우저/Supabase 운영 로그인·저장을 새로 수동 검증하지 않았다. Supabase DB/Auth/RLS/저장 JSON 구조, Vercel 설정/배포는 변경하지 않았다. 기존 002A·009A 원격 DB 변경과 회사 공간 접근 없음.

완료: 승인 범위의 3DB·2쌍 관계·2 Rollup·2 Formula·7 가상 행·실제 재조회·읽기 전용 재실행.

미검증/범위 밖: 다른 워크스페이스 복제, 진정한 Status/그룹, 원격 선정률 Formula, 실제 장애 복구, 대량 데이터, 웹 생성/OAuth/관리자. 비공개 권한은 생성 방식/사용자 확인에 근거하며 REST만으로 모든 공유 권한을 증명하지 않는다.

권고 순서: 분리된 B 테스트 공간 확보 후 복제 보존 검증 → 실제 사람 식별/중복 정책 → 서버 비밀·사용자별 권한·실행 승인/재개 설계를 포함한 웹 생성 → 생성 이력 및 필요에 따른 관리자 기능. 현재 CLI 검증을 웹 생성 완료로 확대 해석하지 말아 주세요.

> 위 내용은 Codex가 EST_Project에서 수행한 NB-V2-009B 결과입니다.
>
> ChatGPT는 다음 사항을 검토해 주세요.
>
> 1. 일반형 DB 3개가 실제 Notion에 생성됐는지 확인해 주세요.
> 2. 관계형과 역방향 연결이 정확하게 구성됐는지 평가해 주세요.
> 3. Rollup·Formula가 실제 Notion에서 동작하는지 검토해 주세요.
> 4. 사람 수와 신청 건수 등 통계 계산이 정확한지 확인해 주세요.
> 5. 원격 ID manifest와 중복 생성 방지가 적절한지 평가해 주세요.
> 6. 기존 기본형 실행기·V1·Supabase Auth·저장·매핑 기능이 보존됐는지 확인해 주세요.
> 7. 실제 API 검증과 모의 테스트를 구분해 주세요.
> 8. 향후 워크스페이스 복제, 웹 생성 기능, 관리자 기능의 개발 우선순위를 제안해 주세요.
>
> 완료·부분 완료·미검증을 구분하고 실제 수행하지 않은 작업은 성공으로 기록하지 마세요.
