# NB-V2-009A 기본형 실행기

브라우저/서버 공개 엔드포인트 없이 로컬 CLI만 사용한다. 기존 PoC 실행기와 저장 영역을 변경하지 않는다.

## 지원과 불변 조건

planVersion 1의 기본형 단일 DB, 단일 초기 DS, Title 1개, 속성 1~100개만 허용한다. Title/Rich text/Email/Phone number/Number/Date/Checkbox/Select/Multi-select를 지원한다. Status와 URL은 이번 실행 범위에서 차단한다. Relation/Rollup/Formula·일반/확장형·기존 DB 변경·확인 사항/차단 오류가 남은 계획도 거부한다.

계획을 새로 계산하지 않는다. 전체 계획의 SHA-256과 별도의 안전한 실행 spec을 고정한다. 실제 요청은 계획의 properties/selectOptions를 명시적으로 변환한다. plan.requestTemplates를 실행하지 않는다. 지원하지 않는 설정을 조용히 버리거나 유형을 바꾸지 않는다.

부모·개인 workspace ID·생성용 bot ID·부모 제목·runId·계획 해시·요청 해시가 승인과 일치해야 한다. 현재는 명시한 개인 워크스페이스만 허용한다. 부모의 002A 보호 ID/조상을 검사한다. REST 읽기는 Insert/Update capability나 공개 공유 범위를 완전히 증명하지 못한다. 비공개 부모는 사용자 요청으로 MCP draft 방식으로 만들었다.

## 명령

```sh
# 인증 없이 계획 변환만 확인
node scripts/basic-notion/cli.mjs dry-run --plan docs/research/NB-V2-009A_input/plan.json

# 대상과 runId까지 포함한 고정 요청 검토; 네트워크 없음
node scripts/basic-notion/cli.mjs dry-run --plan docs/research/NB-V2-009A_input/plan.json --target docs/research/NB-V2-009A_input/target.json --run-id nb-v2-009a-basic-001

# 읽기 전용 사전 확인
node --env-file=.env scripts/basic-notion/cli.mjs preflight --plan docs/research/NB-V2-009A_input/plan.json --target docs/research/NB-V2-009A_input/target.json --run-id nb-v2-009a-basic-001

# 로컬 실행 기록만 확인
node scripts/basic-notion/cli.mjs inspect --run-id nb-v2-009a-basic-001

# 이미 기록된 신규 DB의 읽기 재검증만 수행
node --env-file=.env scripts/basic-notion/cli.mjs verify --plan docs/research/NB-V2-009A_input/plan.json --target docs/research/NB-V2-009A_input/target.json --run-id nb-v2-009a-basic-001
```

`apply`/`resume`은 위 plan/target/run-id와 별도로 `--approval <private-approval.json> --confirm-request <full-request-sha256>`가 필요하다. 승인 파일은 검토안에 대한 실제 사용자 승인을 받은 뒤에만 작성한다. 단순 JSON 값은 사용자의 실제 승인을 대신하지 않는다. 토큰은 .env의 NOTION_API_TOKEN만 읽으며 기존 PoC 부모 환경변수는 이번 대상에 사용하지 않는다. 승인/상태 파일과 토큰은 공개 빌드·Git에 넣지 않는다.

`resume`은 알려진 ID를 읽기 검증할 뿐 생성/이름 PATCH를 반복하지 않는다. 응답 유실 시 부모의 marker로 후보를 찾지만 자동 채택하지 않는다. 생성 여부가 불명확하면 별도 검토가 필요하다. 사용자가 lock 파일을 임의로 지우거나 미완료 실행을 새 run으로 덮어쓰지 않도록 한다.

## 요청과 manifest

1. local run lock + 부모 단위 lock/등록부.
2. 사용자 승인·고정 spec·개인 연결·부모·기존 child DB 확인.
3. manifest/등록부를 fsync·원자 rename으로 사전 기록.
4. POST /v1/databases 한 번: initial_data_source에 전체 속성 포함.
5. 응답 DB/DS ID를 즉시 기록하고 부모·description marker·스키마를 읽어 확인.
6. 신규 DS 이름이 다를 때만 PATCH title 한 번. 기존 DB/DS는 수정하지 않음.
7. GET DB/DS 및 readOnly query(page_size=1)로 이름·속성·옵션/색상/ID·빈 구조 확인.

`.notion-generation-state/`의 파일 0600, 디렉터리 0700. 기존 RunStore의 잠금/JSON 읽기를 재사용하며 저장은 fsync/원자 rename을 추가했다. `.notion-poc-state/` 경로는 거부한다. 디렉터리 fsync가 지원되지 않는 OS에서는 파일 fsync와 원자 rename까지만 적용한다. 파일 시스템 자체 손상에 대한 절대적 복구 보장은 아니다.

HTTP 자동 재시도는 0이며 429도 멈춘다. 생성 후 실패하면 원격 객체를 자동 삭제하지 않는다. DB ID를 받은 뒤의 실패는 partial, 응답 유실은 uncertain, 명시적인 4xx 거절은 creation_rejected다. 두 경우 모두 POST를 자동 재시도하지 않는다. 같은 계획도 다른 부모/새 run으로 만들 수 있지만 명시적인 새 승인과, 같은 부모 추가 복사인 경우 allowAdditionalCopy 승인이 필요하다. 미해결 선행 실행은 새 run도 차단한다.

## 실제 확인과 남은 범위

이번 실제 REST 검증은 7속성의 빈 기본형 DB에서 Title/Rich text/Email/Phone/Select/Multi-select를 확인했다. Number/Date/Checkbox와 신규 DS 이름 PATCH 실패/재개 등은 모의 검사만 했다. 원래 Dry Run plan.json의 liveApiVerified:false는 고정 스냅샷이라 변경하지 않았다. 실제 실행 성공은 별도 manifest/result의 verification.ok로 기록한다.
