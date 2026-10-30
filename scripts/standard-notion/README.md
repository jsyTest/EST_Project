# NB-V2-009B 일반형 실행기

NB-V2-008B `planVersion:1`의 사람/프로그램/신청기록 계획을 별도 개인 테스트 부모에 실행하는 CLI다. 웹 생성 API가 아니다. 기본형 실행기와 상태 디렉터리를 분리했다.

`plan.mjs`: 허용 타입·DSL·가상 7행·대상 검증 및 해시 고정.
`engine.mjs`: run/parent 잠금, 내구성 manifest, 단계별 실행/읽기 재개.
`remote.mjs`: 소유권·원격 ID·양방향 관계 바인딩.
`verify.mjs`: 실제 스키마·옵션 색상·관계·계산값 대조.
`cli.mjs`: dry-run/preflight/apply/resume/verify/inspect.

```sh
node scripts/standard-notion/cli.mjs dry-run \
  --plan docs/research/NB-V2-009B_input/plan.json \
  --target docs/research/NB-V2-009B_input/target.json \
  --fixture docs/research/NB-V2-009B_input/fixture.json \
  --run-id nb-v2-009b-standard-001
```

실제 명령은 로컬 `.env`의 `NOTION_API_TOKEN`만 사용한다. 토큰을 명령 인자·승인 JSON·manifest·공개 빌드에 넣지 않는다. `node --env-file=.env ... preflight`는 읽기 전용이다. apply/resume는 사용자 명시적 승인 후 별도 비공개 승인 JSON(`task,approved,runId,parentId,planHash,fixtureHash,requestHash,approvedAt,syntheticFixtureApproved,personalPrivatePageConfirmed`)과 `--confirm-request` 전체 해시가 필요하다. 임의로 승인 JSON을 만드는 것은 승인이 아니다.

manifest 기본 위치 `.notion-standard-state/` (gitignore), 파일 0600, 디렉터리 0700. 기존 두 실행기의 상태 디렉터리는 금지한다. 같은 run 재실행은 검증 완료 상태면 읽기만 한다. 부분 실행은 명시적 resume로 시작하지 않은 단계만 계속할 수 있다. 이미 시작된 쓰기는 읽기로만 확인하며 기대값이 없거나 충돌하면 멈춘다. 생성 POST의 ID가 없으면 후보를 조회하되 자동 채택·재전송하지 않는다. 사용자가 원격 구조를 편집했다면 자동 복구/삭제하지 않는다.

내부 `count_all`은 API `count`로 변환한다. 현재 Formula DSL은 `relation_count`, `equals_option` 두 개다. 숫자 equals_option → SUM Rollup 의존성만 허용하며 선정률 Formula는 구현하지 않는다. 비율은 원격 건수에서 로컬로 산출한다. 실제 원격 검증과 모의 검증을 구분한다.

API 기준: Notion-Version `2026-03-11`. [속성 객체](https://developers.notion.com/reference/property-object), [Data Source 속성 수정](https://developers.notion.com/reference/update-data-source-properties), [Database 생성](https://developers.notion.com/reference/create-a-database), [공식 SDK Rollup 함수 타입](https://github.com/makenotion/notion-sdk-js/blob/main/src/api-endpoints/common.ts), [요청 제한](https://developers.notion.com/reference/request-limits)을 확인했다. 350ms 요청 간격, 자동 재시도 0회. query POST는 읽기다.
