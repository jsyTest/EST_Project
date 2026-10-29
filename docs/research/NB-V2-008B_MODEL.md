# NB-V2-008B 생성 계획 계약

## 경계

`configuration.version:1` → `adaptConfiguration()` → 정규화된 출처/속성 → `createGenerationPlan()` → 구조 검사 → `planVersion:1` Dry Run.

기존 파서·저장 모델·Notion PoC 실행기는 교체하지 않는다. 새 모듈은 네트워크·Notion 클라이언트·환경변수·토큰을 사용하지 않는다. 입력 원문 본문·CSV 응답·인증 정보는 계획에 복사하지 않는다.

## 객체

- `planVersion`, 결정론적 `planId`: 저장 configuration.version과 독립. planId는 논리 내용의 비암호학적 해시이며 보안 식별자가 아니다.
- `educationType`, `templateType`, `requestedModules`, 의존성을 포함한 `enabledModules`.
- `databases`: 컨테이너 `db:people` 등의 안정 ID, 표시명, 초기 Data Source 참조.
- `dataSources`: `ds:people` 등의 안정 ID와 부모 DB.
- `properties`: ID·대상 DS·이름·유형·출처·지원 상태. 원본 questionNumber/questionName와 CSV index/original, 기존 targetDb를 추적.
- `relations`: 정/역 속성 ID와 양쪽 DS. 실제 ID는 null 또는 logicalRef로 남김.
- `rollups`, `formulas`: 논리 의존성과 제한된 식 정의. 실제 값은 null.
- `selectOptions`, `statusOptions`: 별도 정의. 원래 색상/선택지를 보존하고 지원하는 열거형만 허용.
- `warnings`: 생략한 선택 기본 속성 등 안내. `confirmationItems`: 의미/식별 기준 확인. `blockingErrors`: 구조적 생성 차단.
- `executionPhases`: 페이지 → DB/초기 DS → 기본 속성 → 관계 → Rollup → Formula → 옵션 재조회 → 최종 검증.
- `requestTemplates`: 향후 호출 정보. 모든 항목 executable=false이며 logicalRef는 실제 UUID가 아니다.
- `delta`: 논리적 생성/재사용/추가/변경/제거 후보. 자동 삭제 없음.

`dryRunValid`는 차단 오류 없음만 의미한다. 확인 사항·API 검증·권한 승인·원격 ID 바인딩을 마쳤다는 의미가 아니다. 기존 매핑 검사의 ‘확인 필요’를 구조 차단과 분리해 진단 JSON을 내보낼 수 있다.

## 구성과 배치

| 유형 | DB | 원칙 |
| --- | --- | --- |
| basic | 신청·참가 기록 1개 | 기본값. 포함한 입력을 하나로 합침. 필요한 Title 하나와 모집 기본 상태 외 연락처·날짜 등을 임의 추가하지 않음 |
| standard | 사람·프로그램·신청 3개 | 사람 정보/프로그램/신청 맥락 분리. 사람↔신청, 프로그램↔신청. 신청 건수 계산 계획 |
| extended | standard+선택 모듈 | 의존성 폐쇄 후 DB를 중복 없이 추가 |

기본형에서 기존 서로 다른 DB의 이름·Title이 충돌하면 조용히 변환하지 않고 차단한다. 일반형의 자동 추천 배치는 성명/이메일/연락처 등 사람 정보는 사람, 미확정 폼 고유 질문/유입 경로는 신청으로 둔다. 사용자가 확인 완료한 대상이나 직접 추가한 대상은 보존한다. 기존 출석/수강 대상 입력은 일반형에서 해당 DB가 없으면 필요한 모듈을 요구한다.

기존 기본 수료/진행 속성은 필요하지 않은 구성에서 생략을 안내한다. 사용자가 이름/유형/옵션/색상을 편집한 기본 속성은 보존한다. 기존 모집 상태의 대기=yellow 등도 임의 변경하지 않는다. 새 기본 모집 상태를 만드는 경우에만 접수 blue / 검토 중 yellow / 선정 green / 대기 purple / 미선정 gray / 취소 red를 제안한다.

## 모듈 계약

| ID | 직접 의존 | 추가 DB | 관계·계산 |
| --- | --- | --- | --- |
| participation | 없음 | 참여·수강 | 사람·프로그램·신청과 연결 |
| attendance | participation | 출석기록 | 참여·프로그램 연결, 기록 수 Rollup, 출석 인정 Formula |
| teams | participation | 팀 | 참여↔팀, 팀 참여기록 수 Formula |
| projects | teams | 프로젝트·제출물 | 팀 연결, 제출 기한/상태 |
| judging | projects | 심사·평가 | 제출물 연결, 점수·평균 Rollup |
| completion | participation | 수료·성과 | 참여 연결, 수료 상태·값 Formula |
| survey | participation | 설문·만족도 | 참여 연결, 만족도 숫자 |

각 계약은 ID, DB, 필수 속성, 의존 모듈, 관계, Rollup, Formula, 기본 상태, 충돌 조건을 가진다. 검증기가 누락을 검사한다. 점수 척도·출석률·자동 수료 판정·설문 문항 전체를 추정하지 않는다. 팀 참여기록 수와 고유 팀 인원수도 같다고 주장하지 않는다.

## 확장·저장·사용

`previousPlan`을 제공하면 공통 DB는 읽기/바인딩 대상으로 남기며 추가 DB만 POST 설계한다. 변경된 기존 속성은 원격 읽기/병합 제안으로 분리한다. 실제 원격 스키마가 같은지 검증하기 전에는 실행할 수 없다. 논리적 재사용은 원격 객체 존재의 증거가 아니다.

새 구성/모듈/추천 조건 선택은 미리보기용이다. 기존 계정 저장 JSON에는 추가하지 않으며 새로고침 후 기본형으로 돌아온다. 완성 계획은 JSON으로 내보내고, 같은 설정 파일로 재생성할 수 있다. 기존 이름·교육 유형·입력·매핑·색상 저장/복원은 그대로다.

CLI:

```sh
node scripts/generation-plan-dry-run.mjs docs/research/NB-V2-008B_examples/configuration-v1.json docs/research/NB-V2-008B_examples/standard-settings.json
```

기존 configuration v1, 저장 행의 configuration, 매핑 객체, mapping-model JSON을 입력받는다. 성공 exit 0, 차단 오류를 포함한 진단 JSON은 exit 2, 파일/JSON 오류는 exit 1. .env나 인증키가 필요 없다. 예제는 가상 질문과 헤더이며 응답 행은 없다.
