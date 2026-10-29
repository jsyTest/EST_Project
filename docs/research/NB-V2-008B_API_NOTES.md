# NB-V2-008B Notion API 조사

확인일: 2026-10-30 KST. 공식 문서 조사이며 새 계획의 실제 Notion API 실행 결과가 아니다.

| 대상 | 문서 근거와 계획 반영 | 이번 분류 |
| --- | --- | --- |
| 버전 | 문서 기준 `2026-03-11`. 기존 `scripts/notion-poc/config.mjs`도 동일. CLI 버전 변경 없음 | 계획 기준 확정, 새 API 실행 미검증 |
| Database / Data Source | 2025-09-03부터 컨테이너와 스키마/행 대상을 구분. 계획도 `db:*` / `ds:*` 분리 | 자동 계획 |
| DB 생성 | POST /v1/databases의 initial_data_source에 Title 스키마 배치. 생성 뒤 원격 ID 해석 필요 | 자동 계획, 실행 미검증 |
| 속성 | PATCH /v1/data_sources/{id}. 새 Title은 처음 만들고 이후 변환하지 않음 | 기본 유형 자동 계획 |
| Relation | 대상 data_source_id와 dual_property 사용. 생성된 역속성은 재조회·이름 설정·양방향 검증 필요 | 실제 API 검증 필요 |
| Rollup | 관계와 대상 속성의 원격 ID 해석 후 정의. 값은 행이 있어야 검증 가능 | 실제 API 검증 필요 |
| Formula | 허용된 논리식만 이름을 이스케이프해 표현식 생성. 존재하지 않는 참조 차단 | 실제 API 검증 필요 |
| Select / Multi-select | 허용 색상만 사용. 기존 옵션 변경은 재조회/병합을 요구하고 누락 옵션을 자동 삭제하지 않음 | 신규 정의 자동 계획 |
| Status | 옵션의 고정 그룹 소속은 계획. 그룹 자체 이름·순서·색상 변경은 Notion UI로 분리 | 옵션 API 검증 필요 / 그룹 정의 수동 UI |

공식 근거:

- [Versioning](https://developers.notion.com/reference/versioning)
- [2025-09-03 업그레이드](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03): 구형 database_id 중심 코드와 현재 data_source_id 사용의 차이.
- [Create a database](https://developers.notion.com/reference/create-a-database): 초기 Data Source를 포함하는 생성 요청.
- [Update a data source](https://developers.notion.com/reference/update-a-data-source): 스키마 갱신과 Title 제한.
- [Property schemas](https://developers.notion.com/reference/property-object): Relation, Rollup, Formula, 옵션/색상 구조.
- [Update data source properties](https://developers.notion.com/reference/update-data-source-properties): 기존 옵션 보존/변경과 Status 그룹의 UI 관리.

`automatic`은 규칙으로 요청 설계를 만들 수 있다는 뜻이다. 권한·부모 위치·워크스페이스 정책을 실제 검증했다는 뜻이 아니다. 모든 결과는 `liveApiVerified:false`, `futureExecutorReady:false`, `executionState:not_executed`다.

이번 계획기의 제한은 Notion 전체의 제한과 구분한다. 현재 Formula DSL은 relation_count / equals_option만 지원한다. Rollup 함수는 count_all / sum / average이며 계산 속성을 다시 Rollup하는 순서는 구현하지 않았다. 임의 수식·알 수 없는 모듈은 차단한다. Notion에서 다른 수식이 가능하더라도 이 계획기가 지원한다고 표시하지 않는다.
