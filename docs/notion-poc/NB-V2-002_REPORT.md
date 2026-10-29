# [NB-V2-002 작업 보고서]

## 1. 작업 ID 및 기준일

- NB-V2-002 / 2026-10-29, Asia/Seoul.
- V1을 보존하면서 AI 없는 규칙 기반 Notion 생성 PoC를 별도 구현.

## 2. 시작·종료 Git 상태

- 시작: main, origin/main 추적, HEAD d79e7c6a5ec967c225eecf36e0db43760bb47d47 (`추가 생성`), clean.
- 종료: 기존 추적 파일 수정 없음. 아래 신규 파일만 추가. 커밋·배포 없음.

## 3. 작업 상태

**부분 완료: 로컬 구현과 모의 검증 완료 / 실제 Notion 생성·검증 미실행.**

실행 환경의 NOTION_API_TOKEN, NOTION_TEST_PARENT_PAGE_ID가 없고 로컬 .env도 없었다. 개인·회사 콘텐츠를 탐색하거나 테스트 대상을 추측하지 않았다. 실제 Notion API 호출은 0회다. 공개 공식 문서 열람은 인증된 Notion 작업과 별개다.

## 4. 추가한 파일

- .gitignore
- .env.example
- scripts/notion-poc/config.mjs
- scripts/notion-poc/fixture.mjs
- scripts/notion-poc/schema.mjs
- scripts/notion-poc/client.mjs
- scripts/notion-poc/state.mjs
- scripts/notion-poc/verify.mjs
- scripts/notion-poc/engine.mjs
- scripts/notion-poc/cli.mjs
- scripts/notion-poc/tests/fake-notion.mjs
- scripts/notion-poc/tests/poc.test.mjs
- scripts/notion-poc/tests/v1-regression.test.mjs
- docs/notion-poc/README.md
- docs/notion-poc/NB-V2-002_REPORT.md
- docs/notion-poc/CHATGPT_HANDOFF.md

## 5. 구현 기능과 사용자 동작

기존 웹 화면에 새 버튼이나 토큰 입력을 추가하지 않았다. 별도 CLI에서 Dry Run·apply·inspect·verify를 실행한다.

기본 명령은 네트워크 호출 없는 Dry Run이다. 실제 생성에는 토큰, 명시적 테스트 부모 UUID, apply 명령, 같은 UUID의 --confirm-parent가 필요하다.

실행기는 지정한 부모만 GET으로 확인한 뒤 신규 테스트 교육 페이지, 운영 DB 5개, 전체 집계용 KPI DB 1개를 생성하도록 구현했다. 일반 속성→양방향 관계→계산 의존 순서→가상 행→검증→데이터 변경→재검증→보기 순서다. 실제로 실행한 것은 모의 API 경로뿐이다.

## 6. 스택 및 API 버전

- Node.js 22+ 내장 fetch·fs·node:test, ES modules. 개발 검증 런타임 v24.22.1.
- 외부 npm 의존성·프레임워크 전환 없음.
- REST API Notion-Version: 2026-03-11 고정.
- SDK를 설치하는 대신 공식 예제의 요청 구조를 사용하고 서버 측 헤더를 직접 설정했다.

버전은 [Notion 버전 안내](https://developers.notion.com/reference/versioning) 및 [뷰 엔드포인트](https://developers.notion.com/reference/create-view)에서 재확인했다.

## 7. 실제 생성한 Notion 객체

**없음.** 아래 수량은 구현 계획 및 모의 API 실행에서 검증한 수량이다.

- 교육 페이지 1개.
- 신청자·과정·과정별 신청기록·수강·출석기록·교육 KPI DB: 6개.
- 가상 운영 행 15개 + KPI 요약 행 1개.
- 숫자 KPI 4개, 모집 차트 2개, 과정 차트 1개, 표 3개, Dashboard 1개.

KPI DB 추가 이유: 교육 전체 집계를 운영 기록과 분리하고, 숫자 KPI의 원본으로 사용할 1개 요약 행을 두기 위해서다. 전체 V2 DB 구성을 확정하는 변경은 아니다.

## 8. 실제 객체 ID·URL

실제 객체가 없으므로 공유할 실제 ID·URL도 없다. 테스트 대역이 생성한 ID·URL은 실제 결과로 보고하지 않는다.

향후 실제 실행 시 로컬 상태 파일에 페이지 ID, DB 컨테이너 ID, 데이터 소스 ID, 행 ID, 보기 ID 및 응답 URL을 구분해서 기록한다. URL을 추측해 만들지 않는다.

## 9. 관계형·롤업·수식

- 신청기록→신청자·과정.
- 수강→선정된 신청기록·신청자·과정.
- 출석기록→수강.
- 역방향 6개는 dual_property의 실제 synced_property_id를 받은 후 목표 이름으로 변경한다. Notion이 붙이는 이름을 추측하지 않는다.
- KPI 행은 신청자·신청기록·수강·출석기록 전체에 단방향으로 연결한다.
- 출석 인정 값·수료 값 수식을 만들고 롤업 sum과 관계 목록 수식으로 집계한다.
- 신청자·신청기록·선정 고유 인원·수강기록·수료기록·수료 고유 인원을 별도 속성으로 둔다.
- 초기와 변경 후 모두 실제 응답 행·관계·KPI를 비교하는 코드가 있다.

현재 고정 데이터셋 기준으로 의존 순서와 참조 검증은 통과했다. 실제 Notion 수식 파싱·계산은 미검증이다. 요청 형태는 [속성 스키마](https://developers.notion.com/reference/property-object)와 [속성 변경](https://developers.notion.com/reference/update-data-source-properties)을 참고했다.

## 10. KPI 예상·검증값

| 지표 | 예상 | 로컬 모의 실행 | 실제 Notion |
| --- | ---: | ---: | --- |
| 고유 신청자 | 3 | 3 | 미검증 |
| 과정별 신청기록 | 4 | 4 | 미검증 |
| 선정 고유 인원 | 2 | 2 | 미검증 |
| 수강기록 | 2 | 2 | 미검증 |
| 수료기록 | 1 | 1 | 미검증 |
| 수료 고유 인원 | 1 | 1 | 미검증 |
| 수강기록 기준 수료율 | 50% | 50% | 미검증 |
| 초기 출석률 | 75% | 75% | 미검증 |
| AT04 변경 후 출석률 | 100% | 100% | 미검증 |
| E01 / E02 초기 출석률 | 100% / 50% | 100% / 50% | 미검증 |
| C01 / C02 수강인원 | 2 / 0 | 2 / 0 | 미검증 |

모의 API의 계산기는 실제 수식 문자열을 실행하지 않는다. 테스트 대역의 관계 데이터를 읽어 검증 흐름을 시험한다. 따라서 이 표로 Notion 수식 호환성을 입증했다고 주장하지 않는다.

## 11. 차트·Dashboard

구현된 요청: 신청자 수·수강기록 수·수료 고유 인원·출석률 숫자 차트, 참여자 유형 도넛, 유입 경로 막대, 과정별 수강 현황 막대, 운영·수강·출석 표, Dashboard.

Dashboard에 [4, 3, 3] 위젯 행을 만드는 모의 요청·재조회 검증을 통과했다. 차트 설정은 이름만 아니라 집계 방식과 속성 ID도 재조회 비교한다.

API가 명시적으로 보기를 거절하면 실패로 기록한다. Dashboard가 거절되면 독립 보기를 시도하며 전체 상태는 partial이다. 화면 렌더링 확인을 API 응답 확인과 혼동하지 않도록 visualInspection=not_performed를 남긴다.

실제 생성·화면·요금제는 미검증이다. [공식 Views API](https://developers.notion.com/guides/data-apis/working-with-views) 및 [요금제 안내](https://www.notion.com/help/dashboards)를 참고했다. 표 하단 계산은 미구현이며 수동 또는 숫자 차트 대안이다.

## 12. 실제 수행한 명령과 결과

```sh
node --version
node scripts/notion-poc/cli.mjs dry-run
node --test scripts/notion-poc/tests/*.test.mjs
git diff --exit-code HEAD -- index.html result.html js/app.js js/mock-data.js css/style.css PROJECT_SPEC.md docs/chat-handoff/CHATGPT_DIRECTION_REVIEW_PROMPT.md .vscode/settings.json
git check-ignore .env .env.local .notion-poc-state/example.json
```

- Node v24.22.1.
- Dry Run exit 0, 네트워크 0회, DB 6개와 초기 기대값 3/4/2/1/50/75 확인.
- **테스트 29개 통과, 실패 0개.**
- 기존 추적 파일 diff 없음, exit 0.
- 실제 인증 파일과 상태 경로의 Git 제외 확인.

테스트는 환경변수 누락, UUID·부모 확인, 선정 상태와 복수 과정, 고유 인원 구분, 스키마 참조, 가상 생성 전체 흐름, 75→100 재계산, 권한 거부·휴지통 부모·단계 실패·응답 유실·중복 실행·손상 상태·잠금, 429 재시도·쓰기 5xx/네트워크 미재시도, 조회 페이지네이션, 비밀값 기록 방지, V1 256개 조합 회귀를 포함한다.

## 13. 미실행 테스트

토큰과 승인된 테스트 부모가 없어 실제 Notion 연결·생성·재조회·수식 실행·재계산·차트 표시·Dashboard 화면·실제 계정 권한과 요금제 검증은 실행하지 않았다. 브라우저 클립보드 실사용도 이번 실행에서 검증하지 않았다.

## 14. 오류와 해결

실제 API 오류는 발생하지 않았다. API 자체를 호출하지 않았다.

로컬 실패 경로에서 권한 오류는 쓰기 전 중단, 잘못된 KPI는 출석 변경 전 중단, 응답 유실은 uncertain 상태 기록 후 재생성 차단, 차트 거절은 실패 기록 및 가능한 표 보존을 확인했다.

구현 검토 중 선정 고유 인원을 수강기록에서 유도하면 의미가 섞일 수 있어, 선정된 신청기록의 신청자를 중복 제거하도록 분리했다. 차트 재조회도 유형만 비교하지 않고 집계 대상 속성 ID까지 비교하도록 보완했다.

## 15. 보안·권한·중복 실행

- 토큰은 환경변수에서 헤더로만 전달하고 응답 본문·헤더·토큰을 로그나 상태 파일에 남기지 않는다.
- API origin 고정, redirect 거부, 20초 요청 타임아웃.
- 지정 부모 하나만 조회하며 탐색·검색하지 않는다.
- 쓰기는 새로 생성한 페이지·DB·데이터 소스·행·보기에 한정한다. 출석 변경 전 행의 데이터 소스도 확인한다.
- 로컬 실행 잠금, 원자적 상태 저장, 요청 전 단계 기록.
- 완료/부분 완료 run-id 재실행은 추가 API 호출 없이 기존 결과 반환.
- 미완료·불확실·손상 상태는 생성 재시도를 차단.
- 429는 Retry-After에 따라 제한적으로 재시도. 쓰기 응답 유실·5xx는 임의 재시도하지 않는다.
- 자동 롤백·자동 삭제·분산 중복 방지를 주장하지 않는다.

[공식 제한 안내](https://developers.notion.com/reference/request-limits), [자격 증명 안내](https://developers.notion.com/guides/get-started/handling-api-keys)를 참고했다.

## 16. 기존 V1 영향

HTML·CSS·JS·기존 명세·이전 인계문·IDE 설정을 수정하지 않았다. V1의 선택 조합 256개와 수식 참조·텍스트 내보내기 회귀 검사를 통과했다. 기존에 확인했던 로고 누락·저장 예외 문제는 이번 PoC와 분리해 그대로 남겼다.

## 17. 문서 갱신

실행 안내, 이 작업 보고서, ChatGPT 인계문만 신규 작성했다. V1 명세를 덮어쓰거나 V2 전체를 구현 완료로 변경하지 않았다.

## 18. 사용자 추가 작업

승인할 테스트 부모와 연결을 준비하고 로컬 .env에 두 환경변수를 설정한다. 토큰을 채팅에 보내지 않는다. 지원 요금제를 확인한 뒤 Dry Run의 생성 대상과 AT04 변경을 검토하고 실제 apply를 실행한다. 구체적인 명령과 절차는 README.md에 있다.

## 19. 남은 위험과 제한

- 실제 API 계약·수식·계정 권한·요금제는 아직 검증하지 못했다.
- 응답 수식의 엄격한 문자열 비교가 정규화 차이로 중단될 수 있다.
- 고정 fixture 전용이며 대규모 관계 조회, 생성 실패 자동 재개, 여러 컴퓨터 간 잠금은 미구현이다.
- 예정 출석기록을 미리 만드는 임시 분모를 사용한다. 삭제·미기록·회차 변경 정책은 범용 설계가 아니다.
- 수강의 신청자·과정 관계가 신청기록과 어긋나지 않도록 향후 입력 경로에서도 검증해야 한다.
- 상태 파일을 지우거나 run-id를 바꾸면 중복 생성 방지를 우회할 수 있으므로 보존해야 한다.
- 완성된 웹 UI·CSV 입력·사용자 정의 편집기·Supabase·다중 사용자·배포는 범위 밖이다.

## 20. 다음 개발 추천

먼저 테스트 환경에서 현재 PoC의 실제 API 계약과 KPI·재계산·보기 결과를 검증한다. 실패하면 새 기능보다 해당 호환성 보완을 우선한다. 이후 CSV 안정 ID·중복·관계 보완 검증 → 재사용 가능한 규칙 명세 → 사용자 정의 KPI·템플릿 → 인증·저장·웹 UI 순서를 제안한다. 기존 확정 요구사항은 변경하지 않는다.
