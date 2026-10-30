# NB-V2-009A API 범위

2026-10-30 KST. 기존 `2026-03-11` 버전을 유지했다. 아래 공식 문서를 확인했고 지원되는 계획만 별도 변환한다.

- [Database 생성](https://developers.notion.com/reference/create-a-database): page 부모, title, initial_data_source.properties를 사용. Insert content capability 필요. 이번 실제 요청은 전체 7속성을 한 POST에 포함했다.
- [속성 구조](https://developers.notion.com/reference/property-object): 기본 빈 설정 객체와 Select/Multi-select 옵션/색상을 변환. 원격 속성 ID는 반환된 인코딩을 그대로 보존한다.
- [Data Source 조회](https://developers.notion.com/reference/retrieve-a-data-source): DS 부모/스키마 readback.
- [Data Source 갱신](https://developers.notion.com/reference/update-a-data-source): 새 DS의 이름이 다를 때 title PATCH만 계획. 이번에는 처음부터 이름이 같아 호출하지 않았다.
- [옵션/Status 갱신](https://developers.notion.com/reference/update-data-source-properties): Status 옵션의 고정 그룹 소속과 그룹 정의 자체의 UI 관리를 구분. 이번 실행기는 Status를 지원한다고 표시하지 않고 차단한다.
- [상태 코드](https://developers.notion.com/reference/status-codes), [요청 제한](https://developers.notion.com/reference/request-limits): 권한/인증·validation·rate limit·transport 오류를 구분한다. 이번 새 실행기의 maxRetries=0은 기존 PoC의 429 재시도 정책보다 보수적이며 기존 클라이언트 코드를 바꾸지 않았다.

| 유형 | 이번 실행기 | 이번 실제 API 확인 |
| --- | --- | --- |
| Title / Rich text / Email / Phone number | 지원 | 빈 DB 스키마 실제 확인 |
| Select / Multi-select | 지원, 최대 옵션 100·허용 색상만 | 옵션 이름·색상·ID 실제 확인 |
| Number / Date / Checkbox | 지원 | 모의 검사만 |
| URL | 차단 | 미검증. API에는 있으나 현재 계획 유형 계약 확장까지 하지 않음 |
| Status | 차단 | 미검증. 세부 그룹/옵션 검증을 완료한 것으로 표현하지 않음 |
| Relation / Rollup / Formula | 범위 밖 차단 | 이번 작업 미실행 |

URL/Status가 Notion 자체에서 불가능하다는 뜻이 아니다. 현재 단계의 제한이며 Text/Select로 조용히 바꾸지 않는다. 향후 범위를 넓히려면 계획 모델·입력 편집·변환·검증·승인을 함께 확장해야 한다.
