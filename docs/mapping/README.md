# NB-V2-003 속성 매핑 사용 안내

기준일: 2026-10-29. 별도 `mapping.html`에서 질문·CSV 헤더를 분석하고 속성과 옵션 색상을 편집한다. AI API, 외부 업로드, 서버 저장, Notion 쓰기, Supabase 연결은 없다. 기존 V1의 입력/결과 화면과 고정 샘플 PoC는 유지한다.

## 화면 사용

1. 기존 입력 화면의 **폼·CSV 속성 매핑과 옵션 색상 설정** 링크를 연다. ES 모듈을 사용하므로 파일을 직접 여는 대신 VS Code Live Server 등 HTTP 정적 서버를 사용한다.
2. 번호가 있는 질문·입력 유형·선택지를 붙여넣거나 **가상 예시 넣기**를 누른다. `EXAMPLE_FORM.txt`와 `EXAMPLE_HEADERS.csv`도 가상 구조 예시다. 응답 데이터는 입력하지 않는다.
3. CSV를 선택하고 UTF-8/BOM 또는 EUC-KR/CP949 인코딩을 지정한다. **분석하고 매핑 추천**을 누른다. 다시 분석하면 현재 편집 결과가 교체된다. 분석 실패 시 이전 모델은 보존한다.
4. 교육 운영 기본 속성과 폼·CSV 속성을 구분해 검토한다. 원본 질문·원본 컬럼은 보존하고 Notion 이름·유형·저장 DB·CSV 연결·옵션명·색상·Status 그룹을 편집한다. 불필요한 속성/옵션을 제외하거나 속성/옵션을 추가할 수 있다.
5. 확인 필요 행의 이름·유형·단일/복수 선택·연결을 검토한 뒤 **확인 완료**를 누른다. 확인 완료는 구조 검사를 생략하지 않는다. 같은 DB 이름 충돌·제목 중복·옵션 중복·CSV 컬럼 중복 연결은 별도로 차단한다.
6. **검사하고 미리보기**로 새 데이터 소스용 스키마를 만든다. 수정하면 이전 미리보기를 무효화한다. 모델은 검토 중에도 JSON 저장할 수 있으며 스키마는 검사 통과 후 저장할 수 있다.

화면 상태는 메모리에만 있다. 새로고침/닫기 전에 필요한 JSON을 저장한다. 현재 JSON을 다시 화면에 불러오는 기능은 없다. Notion 생성 버튼은 구현하지 않았다.

## 색상과 기존 옵션

허용값은 `default, gray, brown, orange, yellow, green, blue, purple, pink, red`다. HEX는 스키마에 보낼 수 없다. UI의 색상 견본에 쓰는 HEX는 화면 표시용이다.

기본 추천:

| 용도 | 옵션 → 색상 |
| --- | --- |
| 선정 | 접수 blue / 선정 green / 대기 yellow / 미선정 gray / 취소 red |
| 수료 | 수료 green / 미수료 red / 수료 대기 yellow |
| 진행 | 예정 gray / 진행 중 blue / 완료 green / 취소 red |

진행 Status는 예정→To-do, 진행 중→In progress, 완료/취소→Complete를 기본값으로 한다. 그룹 자체의 이름/순서/색상 편집은 제공하지 않는다. 수료 상태 Select는 새 매핑 모델용 속성이다. 기존 PoC의 수료 checkbox와 수식은 변경하지 않았다.

`mergeExistingOptions(type, existingSchema, edits)`는 향후 기존 DB를 수정할 때 사용할 순수 변환 함수다. 현재 UI나 CLI에서 실제 PATCH를 수행하지 않는다. 기존 모든 옵션 ID를 포함하고, 추천 색상으로 기존 색상을 덮어쓰지 않는다. `colorSource: "user"`인 명시적 변경만 색상을 바꾼다. 새 옵션은 색상을 지정할 수 있다. 기존 옵션 이름 변경 요청은 Notion UI에서 처리하도록 거부하고, 중복/알 수 없는 ID/잘못된 색상/그룹도 거부한다. 기존 ID와 그룹은 생략/보존 규칙을 적용하며 삭제 기능을 노출하지 않는다. 향후 적용 직전에 최신 스키마를 다시 읽어 동시 변경 여부도 확인해야 한다.

`verifyOptionSchema(expectedProperties, actualProperties)`는 재조회된 이름·색상·Status 그룹 멤버십을 대조한다. 고정 PoC의 신규 Select에도 추천 색상을 넣고 생성 직후·전체 스키마 재조회에 이 검사를 연결했다. 이전 완료/부분 완료 run-id는 색상만 빠진 과거 코드 지문도 인식해 API 요청 없이 재사용한다. 기존 테스트 DB 색상을 일괄 변경하지 않는다.

근거: [속성 스키마](https://developers.notion.com/reference/property-object), [선택 옵션/Status 변경 규칙](https://developers.notion.com/reference/update-data-source-properties). 실제 Notion 색상 생성·수정은 이번에 실행하지 않았다.

## 폼 분석 규칙과 한계

`1. 질문`, `1) 질문`, `Q1. 질문`, `Q1: 질문`, `질문 1. 질문` 형태를 대상으로 한다. 질문 번호·원본 이름·원문·명시된 필수 표식을 보존한다. 선택지의 bullet/번호, 단일 선택·복수 선택 등의 명시적 표식을 읽는다. 단일/복수가 명확하지 않으면 확인 필요로 남긴다. 선행 안내문은 문항으로 만들지 않고 전체 원문과 함께 보존한다. 해석하지 못한 본문·중복 번호·알 수 없는 질문은 사용자 검토 대상이다.

성명, 연락처, 이메일, 연령대, 참여자 유형, 신청 과정, 신청 동기, 기대사항, 유입 경로, 선정 상태의 명시적 별칭 사전을 사용한다. 자연어 의미 추론을 하지 않는다. 모든 자유 형식 폼·안내문을 해석하는 도구가 아니다. 번호형 질문과 번호형 선택지가 충돌하거나 안내문이 선택지처럼 보이는 경우에는 원문과 결과를 직접 확인해야 한다. 모호한 복수 선택은 자동 확정하지 않는다.

폼의 필수 여부는 메타데이터다. Notion 속성의 필수 입력 제약으로 강제하지 않는다. 법적 동의 문항 등의 운영 의미도 자동 확정하지 않는다.

## CSV 처리와 병합

브라우저 `Blob.slice`로 최대 1 KiB씩 읽고 첫 CSV 레코드가 끝나면 중단한다. 레코드 최대 64 KiB. 마지막 청크에 응답 행의 일부 바이트가 포함될 수 있으나 헤더 종료 뒤 바이트는 디코딩/파싱/보존하지 않는다. 전체 파일을 읽거나 응답 행을 분석·로그·서버 업로드하지 않는다.

UTF-8/BOM, 명시적 EUC-KR/CP949(TextDecoder), 큰따옴표·쉼표·이스케이프 따옴표·따옴표 안 줄바꿈을 지원한다. 탭/세미콜론 구분 파일·자동 인코딩 감지·XLSX는 지원하지 않는다. 깨진 인코딩/닫히지 않은 따옴표/인용부호 뒤 잘못된 문자/64 KiB 초과는 오류다. 인용부호 뒤 공백도 느슨하게 보정하지 않는다.

각 컬럼의 위치 `index`, 원본 `original`, 정규화명 `normalized`, 오류 목록 `issues`를 유지한다. `성명(*)`, 필수 표식, 공백을 정규화하며 중복·빈 이름을 위치별로 남겨 직접 수정하도록 한다.

정확한 정규화 이름 또는 등록된 별칭이 유일하게 일치할 때만 연결한다. 예를 들어 원본 질문 `본 프로그램을 어떤 경로를 통해 알게 되셨나요?`와 CSV `유입 경로`를 Notion `유입 경로`로 추천한다. 후보가 여러 개거나 여러 문항이 같은 컬럼과 매칭되면 합치지 않고 확인 필요로 남긴다. CSV만 있는 컬럼은 선택지/유형을 확정할 근거가 부족하므로 사용자 확인을 요구한다. 교육 기본 속성과 동명의 폼 속성도 자동 흡수하지 않고 충돌을 표시한다.

## 표준 모델 → 검증 → 스키마

`js/mapping/model.mjs`는 브라우저·Node가 공유하는 ES 모듈이다.

- `localId`: 내부 속성 ID. 실제 Notion ID가 아니다.
- `origin`: base / form / csv / manual.
- `questionName`, `rawText`, `questionNumber`: 원본 질문과 문맥.
- `csvColumn`: 원본 컬럼명·인덱스·정규화 정보 또는 null.
- `name`, `type`, `targetDb`: 최종 속성명·지원 Notion 유형·저장 대상 키.
- `options`: localId / name / color / 선택적 colorSource / Status group.
- `mappingStatus`: automatic / review / confirmed. review 상태는 생성 스키마 출력을 막는다.
- `included`, `required`, `reviewReasons`: 사용 여부·폼 필수 메타데이터·확인 이유.

스키마 출력은 `mode: new-data-sources-only`, `networkRequests: 0`, DB별 `properties`와 원본 모델을 포함한다. 내부 ID를 API 속성/옵션 ID로 전송하지 않는다. 각 DB에 제목이 없으면 충돌 없는 기본 제목 속성을 보충한다. 이 스키마를 기존 PoC DB에 PATCH하는 것은 지원하지 않는다. 관계형·롤업·KPI와 사용자 정의 필드의 최종 결합도 후속 작업이다.

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node scripts/notion-poc/mapping-dry-run.mjs docs/mapping/EXAMPLE_MAPPING_MODEL.json
node scripts/notion-poc/cli.mjs dry-run --view-profile free
```

화면에서 저장한 `mapping-model.json`도 같은 mapping-dry-run CLI 입력으로 사용할 수 있다. 검증에 실패하면 종료 코드 1, 통과하면 0이다. Notion 토큰을 읽거나 API를 호출하지 않는다. 고정 샘플 apply 명령은 그대로이며 새 매핑 모델을 받아 실제 생성하는 기능은 아직 없다.

## 검증 상태

로컬 자동 검사와 별도로 Chrome에서 로컬 화면의 로딩·기본 속성·색상·그룹 편집 컨트롤 표시를 확인했다. 이후 브라우저 동시 사용 감지로 조작이 중단되어 파일 선택·편집·다운로드 전체 동선의 브라우저 검사는 완료하지 못했다. CSV/편집 모델/CLI는 자동 검사로 확인했다. 실제 Notion 반영·운영 배포는 미검증이다. 상세 결과는 작업 보고서와 인계문을 참고한다.
