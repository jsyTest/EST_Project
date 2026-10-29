# NB-V2-002A 작업 보고서

**판정: 부분 완료.** 개인 Free에서 승인된 핵심 생성·관계·수식·KPI 재계산·도넛/표 구성 API 검증은 통과했다. Dashboard 및 추가 차트는 승인된 Free 계획에서 제외했다. Notion UI는 브라우저 연결 호스트를 사용할 수 없어 직접 확인하지 못했다. 회사 Business 검증 완료가 아니다.

## 1. 작업 ID 및 기준일

NB-V2-002A / 2026-10-29 / Asia/Seoul. 생성 run-id `nb-v2-002a`. 기존 엔진 manifest의 `taskId`는 NB-V2-002이며 이는 엔진 출처다. 이번 보고서 작업 ID와 실행 ID는 위 값을 사용한다.

## 2. 작업 시작 시 Git 상태

`main`, HEAD `2f20d6a` (`추가 구현 1`, 2026-10-29 13:49:02 +09:00), `origin/main` 추적, 최초 작업 트리 clean. 요청문에 적힌 이전 커밋 `d79e7c6` 이후 사용자 변경을 포함한 현재 코드를 기준으로 진행했다.

## 3. 작업 종료 시 Git 상태

`main`, HEAD `2f20d6a` 유지. 추적 파일 7개 수정, 신규 파일 5개. 커밋·푸시·배포 없음. 비밀 설정과 실행 manifest는 Git 제외 상태다. 기존 사용자 변경을 되돌리지 않았다.

## 4. 실제 변경 파일

- 수정: `docs/notion-poc/README.md`, `scripts/notion-poc/cli.mjs`, `engine.mjs`, `schema.mjs`, `verify.mjs`, `tests/fake-notion.mjs`, `tests/poc.test.mjs` (생략한 스크립트 경로는 `scripts/notion-poc/` 기준).
- 신규: `scripts/notion-poc/preflight.mjs`, `scripts/notion-poc/schema-repair.mjs`, `docs/notion-poc/NB-V2-002A_SETUP.md`, `docs/notion-poc/NB-V2-002A_REPORT.md`, `docs/notion-poc/NB-V2-002A_CHATGPT_HANDOFF.md`.
- 로컬 전용·Git 제외: `.env`, `.notion-poc-state/nb-v2-002a.json`. 비밀값은 문서에 포함하지 않는다.
- 미수정: 기존 V1 HTML/CSS/JS, `PROJECT_SPEC.md`, 기존 `docs/chat-handoff/` 인계문, NB-V2-002 당시 보고서/인계문.

변경 이유: 부모 읽기 확인, Free 보기 프로필, DB별 초기 스키마 확인, 고유 인원 계산 호환성 수정, 알려진 초기 스키마 실패만 이어가는 검증 경로, 실제 검증 결과 문서화. 실패 복구 후 남은 로컬 오류 검토 플래그도 해제하도록 정리했다. 이 플래그는 UI 검증 여부와 별개다.

## 5. 테스트 환경 종류

사용자가 선택한 **개인 Notion Free 테스트 전용 페이지**. 부모 제목 `NB-V2-002A 테스트`, 부모 page ID `4081f60f-fdfa-80dd-9435-dfd053c1d4b3`. API가 요금제를 판별했다고 주장하지 않는다. 사용자가 Free라고 명시한 환경에 Free 프로필을 적용했다.

사용자는 교육 1개·DB 6개·행 16개·도넛 최대 1개·표 3개와 생성한 AT04만 수정하는 범위를 확인한 뒤 `승인 — 위 테스트 범위로 생성·검증 실행`이라고 승인했다. 기존 자료 삭제는 승인·실행하지 않았다.

## 6. 실제 API 호출 여부

**실제 Notion REST API 호출 수행.** 지정 부모 GET, 페이지/DB/행 생성, 데이터 소스 속성 PATCH, 보기 생성/GET, 데이터 소스 query, AT04 PATCH를 수행했다. 쿼리는 POST 방식이지만 콘텐츠를 쓰는 요청은 아니다. 모의 테스트와 실제 실행을 구분한다. 전체 HTTP 호출 수를 별도 계수하지 않았으므로 수치를 추정하지 않는다.

## 7. Notion API 버전

헤더 `Notion-Version: 2026-03-11` 고정. 로컬 Node.js v24.22.1, Node 22+ 지원, 외부 npm 패키지·AI API 없음. [공식 API 버전 안내](https://developers.notion.com/reference/versioning)를 확인했다.

## 8. 실행 명령과 테스트 방법

프로젝트 루트에서 실행했다. 아래 부모 ID는 비밀 토큰이 아니라 승인 대상 식별자다.

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node scripts/notion-poc/cli.mjs dry-run --view-profile free
node --env-file=.env scripts/notion-poc/cli.mjs preflight --view-profile free
node --env-file=.env scripts/notion-poc/cli.mjs apply --run-id nb-v2-002a --view-profile free --confirm-parent 4081f60f-fdfa-80dd-9435-dfd053c1d4b3
node --env-file=.env scripts/notion-poc/cli.mjs repair-schema --run-id nb-v2-002a --view-profile free --confirm-parent 4081f60f-fdfa-80dd-9435-dfd053c1d4b3
node --env-file=.env scripts/notion-poc/cli.mjs verify --run-id nb-v2-002a --view-profile free
```

최초 apply는 수식 스키마 400 오류로 종료 코드 1. 제한적 repair-schema는 기존 생성물을 재사용해 완료했고 Free의 계획된 생략 때문에 종료 코드 2/partial. 최종 verify는 종료 코드 0이다. verify는 CLI main을 호출해 출력만 필터링한 Node wrapper로 실행했으며 생성 코드는 호출하지 않았다.

로컬 검사: **37개 통과, 0개 실패**. 기존 29개 검사의 역할을 유지하고 부모/Free/수정 경로 검사를 추가했다. 수식/속성 정의가 바뀐 검사의 기대값은 새 구조에 맞췄다. 실제 baseline·afterChange·latestReadOnly는 각각 **130개 검사 통과**, 재조회 시도 각 1회였다.

## 9. 실제 생성 객체 수와 종류

새 교육 페이지 1개, DB 컨테이너 6개와 각 초기 데이터 소스 1개(총 6개), 행 페이지 16개, 명시적으로 추가한 View 4개(도넛 1·표 3). 16행은 신청자 3·과정 2·신청기록 4·수강 2·출석 4·KPI 1이다. DB 생성 시 생기는 기본 보기는 별도 추가 보기 수에 포함하지 않았다. Dashboard 0, 숫자 차트 0. 복구 시 교육 페이지와 DB를 새로 만들지 않았다.

## 10. 생성된 페이지 및 DB 링크와 ID

[생성한 교육 메인 페이지](https://app.notion.com/p/TEST-AI-4081f60ffdfa818d8a2ae202f2531cc9) — page ID `4081f60f-fdfa-818d-8a2a-e202f2531cc9`

| DB | DB 컨테이너 ID / 링크 | 데이터 소스 ID | 행 수 |
| --- | --- | --- | ---: |
| 신청자 | [96016cd2-3280-43cc-a356-e6583b5c1ead](https://app.notion.com/p/96016cd2328043cca356e6583b5c1ead) | `c802c581-080e-40a0-93a0-7d6f331e8021` | 3 |
| 과정 | [68e888d3-45ac-43bc-9c1f-2473b5de2a19](https://app.notion.com/p/68e888d345ac43bc9c1f2473b5de2a19) | `a3974216-3243-47c2-8cc3-7cb61566ce42` | 2 |
| 과정별 신청기록 | [8834d429-460c-41aa-b542-67b256558882](https://app.notion.com/p/8834d429460c41aab54267b256558882) | `7816f0b2-1e17-4079-bcc7-276acbef9930` | 4 |
| 수강 | [1bc27dc2-a75a-42a5-abbb-2cfc3ada1f5b](https://app.notion.com/p/1bc27dc2a75a42a5abbb2cfc3ada1f5b) | `b4808df3-0bab-44b9-b2af-5c1b7fc8cc13` | 2 |
| 출석기록 | [bcbeee3e-1742-4e93-8c26-438f3d2e7d9e](https://app.notion.com/p/bcbeee3e17424e938c26438f3d2e7d9e) | `8a6a9201-ae46-42e7-940f-6542b13e22e5` | 4 |
| 교육 KPI | [c065661f-4d53-4f37-9fe6-f7c7e745e074](https://app.notion.com/p/c065661f4d534f379fe6f7c7e745e074) | `49b178cf-d283-4d9a-a2ca-70b7defa2a7f` | 1 |

| 보기 | View ID / 링크 | API 재조회 |
| --- | --- | --- |
| type-chart | [4081f60f-fdfa-812e-960a-000cb8f5d1d5](https://app.notion.com/p/96016cd2328043cca356e6583b5c1ead?v=4081f60ffdfa812e960a000cb8f5d1d5) | 통과 |
| applicants-table | [4081f60f-fdfa-81c8-9753-000c34351cfc](https://app.notion.com/p/96016cd2328043cca356e6583b5c1ead?v=4081f60ffdfa81c89753000c34351cfc) | 통과 |
| applications-table | [4081f60f-fdfa-81d8-a2d3-000cfb903918](https://app.notion.com/p/8834d429460c41aab54267b256558882?v=4081f60ffdfa81d8a2d3000cfb903918) | 통과 |
| enrollments-table | [4081f60f-fdfa-8116-9140-000c5f357835](https://app.notion.com/p/1bc27dc2a75a42a5abbb2cfc3ada1f5b?v=4081f60ffdfa81169140000c5f357835) | 통과 |

식별자 구분: 교육 메인은 page ID, DB 링크는 DB 컨테이너 ID, 스키마/query 대상은 데이터 소스 ID, `?v=` 값은 View ID다. 링크는 기존 접근 권한이 있는 사용자용이며 공개 공유나 접근 권한 확대는 하지 않았다.

## 11. 관계형·롤업·수식 검증 결과

실제 데이터 소스의 속성 유형·선택 옵션·수식 문자열·관계 대상·롤업 함수를 재조회했다. 실제 행의 정방향/역방향 관계 ID와 부모, 선택·체크박스·날짜, 숫자/불리언 수식·롤업 결과를 확인했다. 양방향 관계 6개와 KPI용 단방향 관계 4개다.

- 신청자↔신청기록, 과정↔신청기록, 신청기록↔수강, 신청자↔수강, 과정↔수강, 수강↔출석.
- AP01·AP03만 E01·E02에 연결. AP02 미선정·AP04 취소에는 수강 없음.
- 출석 1/0 → 수강 출석 합계/예정 수 → 출석률. 수료 체크박스 → 수료 값 1/0 → 수료 건수.
- 선정 고유 인원: 신청기록의 선정 값 합계를 신청자별로 집계 → 0보다 크면 그 신청자는 1 → 전체 신청자 플래그 합산.
- 수료 고유 인원: 신청자별 수료 수강 건수를 1/0으로 변환 → 전체 신청자 플래그 합산. 수료기록 수와 사람 수를 별도로 둔다.

숫자는 로컬 JS 기대값으로 대체하지 않고 Notion의 formula/rollup 응답 숫자를 비교했다. 고유 인원은 신청자 행 하나가 한 사람이라는 전제다. 실데이터 중복 신청자 병합과 확장 사례는 아직 구현·실환경 검증하지 않았다.

## 12. KPI 기대값과 실제값

| KPI | 초기 기대 | 초기 실제 Notion | AT04 변경 후 기대 | 변경 후·최종 실제 Notion |
| --- | ---: | ---: | ---: | ---: |
| 고유 신청자 | 3 | 3 | 3 | 3 |
| 과정별 신청기록 | 4 | 4 | 4 | 4 |
| 선정 고유 인원 | 2 | 2 | 2 | 2 |
| 수강기록 | 2 | 2 | 2 | 2 |
| 수료기록 | 1 | 1 | 1 | 1 |
| 수료 고유 인원 | 1 | 1 | 1 | 1 |
| 수강기록 기준 수료율 | 50% | 50% | 50% | 50% |
| 인정 출석 / 예정 출석 | 3/4 | 3/4 | 4/4 | 4/4 |
| 전체 출석률 | 75% | 75% | 100% | 100% |
| E01 / E02 출석률 | 100% / 50% | 100% / 50% | 100% / 100% | 100% / 100% |
| C01 / C02 수강인원 | 2 / 0 | 2 / 0 | 2 / 0 | 2 / 0 |

비율 저장값은 0~100 숫자다. 수료율은 수료기록/수강기록이며, 수료 고유 인원/선정 인원을 분모·분자로 쓰는 별도 정책으로 바꾸지 않았다. 출석 분모는 미리 만든 예정 출석 4건이다.

## 13. 차트 생성 결과

참여자 유형 도넛 1개와 표 보기 3개를 생성하고 각 View의 유형·데이터 소스·설정(도넛 그룹/집계 속성 포함)을 GET으로 대조했다. 모두 verified=true. 실제 차트 그림·레이블·레이아웃·표 표시 열은 UI 미검증이다. Free의 차트 1개 범위에 맞춰 숫자 차트 4개·유입 경로 차트·과정별 차트는 호출하지 않았다. [공식 차트 안내](https://www.notion.com/help/charts).

## 14. Dashboard 생성 결과

**미실행·미검증.** 공식 안내상 Business/Enterprise 제공 기능이므로 승인된 Free 프로필에서 요청을 생략했다. Dashboard 실패 응답을 받은 것으로 기록하지 않는다. full 프로필 코드의 모의 검사는 통과했지만 Business 실환경 생성 성공 근거는 아니다. [공식 Dashboard 안내](https://www.notion.com/help/dashboards).

## 15. 메인 페이지에서 접근하는 방법

Dashboard는 생성하지 않아 Dashboard 진입 링크도 없다. 교육 메인 페이지 아래에 inline DB 6개를 생성한 구조와 소유 관계를 API로 확인했다. 실제 클릭 경로와 한 화면에서의 가독성은 사용자 확인 대기다.

화면 확인 순서:

1. 위 교육 메인 페이지를 연다. 아래 DB 6개가 표시되는지 확인한다.
2. 교육 KPI DB의 `교육 전체 집계`에서 신청자 3·수강 2·수료인원 1·수료율 50·출석률 100을 확인한다.
3. 신청자 DB의 참여자 유형 도넛 보기를 연다. 직접 링크는 위 type-chart다. 실제 도넛이 표시되는지 확인한다.
4. 신청자·과정별 신청기록·수강의 표 보기 링크를 확인한다. 신청기록 AP02 미선정/AP04 취소가 수강에 연결되지 않았는지 확인한다.
5. 출석기록 DB의 AT04가 출석이며 E02 출석률도 100인지 확인한다.

이 절차는 안내이며 실행 완료로 계산하지 않는다. 메인 페이지 하나에서 KPI와 운영 데이터를 쉽게 확인하는 최종 UX는 아직 승인·검증되지 않았다.

## 16. 데이터 수정 후 재계산

생성한 AT04 page ID `4081f60f-fdfa-816a-93bf-e4b7feafb9ea`의 부모를 확인한 뒤 출석 상태만 결석→출석으로 PATCH했다. 전체 출석은 3/4→4/4, 출석률 75→100, E02 50→100. 최종 데이터는 출석률 100%로 남겼다. baseline 14:24:43 KST, afterChange 14:24:49 KST, 최종 읽기 재검증 14:26:43 KST(2026-10-29). 수료율 등 다른 KPI는 그대로다.

## 17. 오류와 수정 사항

- 초기 네트워크 제한에 따른 전송 오류는 승인된 API 실행 환경에서 재확인했다.
- 부모 GET의 `404 object_not_found`는 사용자가 테스트 페이지에 연결을 추가한 뒤 같은 대상 읽기로 해소됐다. 인증을 우회하거나 다른 페이지를 검색하지 않았다.
- 첫 apply의 `calculations: metrics batch 5`가 `400 validation_error`로 거절됐다. 비밀값을 제외한 메시지는 `Type error with formula`. 기존 `선정 고유 인원`·`수료인원`의 관계 filter/map/unique 계열 식을 분리 진단했으며 두 식이 거절됐다. 이것만으로 Notion의 해당 함수 전반이 미지원이라고 단정하지 않는다.
- 숫자 보조 수식·신청자별 롤업·1/0 플래그 합산으로 변경하고 의존 순서를 9개 배치로 정리했다. 실제 API 수락·스키마 재조회·행별 및 전체 KPI 통과로 해결을 확인했다.
- `repair-schema`는 정확히 알려진 초기 코드 지문/400 실패, 불확실 단계 없음, 6 DB 식별자, 실제 DB가 비어 있음, 소유/관계 일치를 확인한 경우에만 기존 DB를 수정하고 입력을 이어간다. 새 교육/DB 생성·역관계 재생성·자동 삭제 없음. 원 오류·진단·복구 기록 보존.
- 성공 복구 후 `requiresManualReview`의 오래된 오류 플래그를 해제했다. Free 생략과 UI 미검증은 여전히 별도 기록이다.

## 18. 재실행·중복 방지

실제 `nb-v2-002a` manifest와 현재 설정을 읽고 모든 API 접근 시 예외를 던지는 client를 넣어 동일 run-id를 다시 호출했다. reusedExistingRun=true, API 호출 0회, 기존 partial 반환. 로컬 오류 플래그 정리 뒤에도 코드 지문에 영향 없는 변경이다. 실패한 run-id 자동 재생성 금지·응답 유실·잠금·알 수 없는 스키마 수정 거부 검사는 모의 테스트로 통과했다. 다른 컴퓨터에서 상태 파일 없이 중복 실행하는 문제는 이번 로컬 잠금의 보장 범위가 아니다.

## 19. 보안 및 접근 범위

토큰은 로컬 `.env`에서만 읽고 출력하지 않았다. `.env` 권한 0600, Git 제외. 상태 파일도 Git 제외하고 토큰을 저장하지 않는다. 요청 로그에는 토큰·전체 응답·계정 정보 없음. 사용자 정보 API·워크스페이스 검색·회사 자료 조회 없음. 읽기·삽입·수정 권한은 승인된 생성 요청의 성공으로 확인했으며 계정 전체 권한 범위를 조회했다고 주장하지 않는다. 지정 부모와 이번 생성물만 사용했다. 삭제·공개 공유·권한 변경 없음.

## 20. 기존 V1 회귀 검사

전체 로컬 테스트 37개 통과. V1 Mock의 모듈 조합 256개를 순회해 설계·내보내기 일관성을 확인했다. 기존 V1 입력/결과 HTML·CSS·JS는 diff 없음. 이는 실제 브라우저에서 입력·결과 전 경로를 수동 확인했다는 뜻은 아니다. 기존 누락 로고 파일 참조, 일부 localStorage 예외 처리는 이번 범위에서 수정하지 않았다.

## 21. 수행하지 못한 검사와 이유

- Notion UI: `The browser access host is unavailable`로 브라우저 도구 연결 불가. 도넛 표시·표 가독성·메인 클릭 동선·레이아웃은 사용자 확인 대기.
- Dashboard·숫자 차트 4·추가 차트 2: 승인된 Free 계획에서 제외. 실패로 가장하거나 회사 Business 성공으로 보고하지 않음.
- 대규모·복수 교육·동일인의 복수 수료 등 확장 실데이터, API 요금제 거절·강제 429/5xx·응답 유실의 실제 유발 검사는 미수행. 오류 처리는 모의 검사 범위다.
- V1 실제 브라우저 전체 흐름: 미실행. 코드 보존과 Mock 조합 검사로 회귀 범위를 제한했다.

## 22. 남은 문제

전체 상태 partial 유지. 최종 통합 Dashboard UX와 Business 실제 동작은 남아 있다. KPI DB는 PoC용이며 최종 설계 확정 아님. 수강의 신청자/과정 중복 관계는 향후 입력 시 일관성을 강제해야 한다. 신청자 ID 중복 제거, CSV 관계 연결, 사용자 정의 KPI·템플릿·서비스 연결은 미구현. 큰 관계 목록은 잘림을 감지해 실패하며 속성별 전체 페이지네이션 복구는 후속 과제다. 비밀 `.env`나 개인 상태 파일을 ChatGPT 자료로 업로드하지 않는다.

## 23. 다음 개발 단계 추천

우선 생성한 개인 페이지 화면 확인과 KPI 정의/분모 검토를 마무리한다. Business Dashboard는 추후 별도 승인된 환경에서 확인한다. 그다음 **CSV 관계 연결 → 교육 템플릿 → 사용자 정의 KPI 편집기** 순서를 추천한다. CSV 단계는 익명 샘플로 안정적인 신청자/과정 키, 선정→수강 검증, 중복/미연결 오류·Dry Run을 먼저 설계한다. 템플릿과 자유 KPI는 관계/집계 정책이 안정된 뒤 확장한다. 이번에는 어느 기능도 선행 구현하지 않았다.

근거 원본: Git 제외 로컬 manifest `.notion-poc-state/nb-v2-002a.json`의 스키마·생성 ID·진단 이력·각 130개 검증 결과. 문서는 그중 테스트 식별자와 집계 결과만 정리했다.
