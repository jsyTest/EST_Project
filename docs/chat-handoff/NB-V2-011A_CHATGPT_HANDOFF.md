# [ChatGPT 전달용] NB-V2-011A 웹 Notion 생성 아키텍처 검토 결과

아래 내용은 Codex가 EST_Project의 최신 소스·원격 메타데이터·공식 문서를 읽고 수행한 설계 조사 결과입니다. **웹 Notion 생성 기능을 구현하거나 OAuth·생성을 실제 실행한 결과가 아닙니다.**

## 1. 기준과 작업 범위

- 기준일: 2026-10-30.
- Git: 시작·종료 `main / 36db2f59f7da9d689cfa36a3d52432ddb362f793`. 시작 작업 트리 깨끗함.
- Production: `https://pplus-rouge.vercel.app`. Vercel 메타데이터에서 READY와 동일 커밋 확인. 이번에 운영 화면 재검사·배포 안 함.
- Supabase: 테이블 목록 조회에서 `public.education_drafts`, RLS 활성, 행 수 메타데이터 5 확인. 행 내용 조회·SQL 실행·DB/RLS 변경 안 함.
- 변경 파일은 이 인계 문서와 `docs/research/NB-V2-011A_REPORT.md` 두 개뿐. 소스·기존 문서·CLI·설계·Notion 자료 수정 없음.
- OAuth 시작, 연결 등록, 토큰 교환·갱신·철회, Notion 쓰기, commit·push·배포 없음. 실제 개인정보로 테스트하지 않음.

## 2. 핵심 판단

기존 정적 웹과 Supabase 로그인·설계 저장은 유지할 수 있습니다. 사용자별 OAuth, 서버의 소유권·승인 검증, 안전한 토큰 저장, 영구 실행 기록, 중단 후 복구 가능한 작업을 추가하는 구성이 적절합니다.

그러나 **현재 개인 CLI를 웹에서 그대로 호출하면 안 됩니다.** 개발자 개인 Notion 토큰은 공용 생성 권한이 될 수 없고, 파일 잠금은 여러 서버 사이에서 중복 생성을 막을 수 없습니다. 일반형 실제 생성 실험 성공도 범용 웹 실행 준비 완료를 의미하지 않습니다.

## 3. 현재 코드에서 재사용할 수 있는 부분

| 파일·기능 | 재사용 범위 | 제약 |
| --- | --- | --- |
| `js/drafts/model.mjs` | 설정 정규화·크기 제한·planner 저장 | configuration.version·schema_version 1 유지 |
| `js/drafts/repository.mjs` | 본인 설계 조회·저장·수정 충돌 처리 원리 | 서버 사용자 확인과 소유권 확인 추가 필요 |
| `js/planner/plan.mjs` | planVersion 1, 기본·일반·확장 계획과 계산 검증 | `createGenerationPlan(normalized, normalized.planner)`로 호출해야 함 |
| `scripts/basic-notion/*` | 기본형 컴파일, 정규 JSON·SHA-256, 승인·재조회 원리 | 개인 테스트 대상 제한·로컬 저장소에 결합 |
| `scripts/standard-notion/*` | 관계 연결·Rollup·Formula 변환·원격 검증 원리 | 모듈 없는 3DB·가상 7행을 요구. 빈 일반형 실행기 아님 |
| `scripts/notion-poc/client.mjs` | API 통신 기본 구조 | 사용자 토큰 주입·공유 요청 제한·쓰기 재시도 통제 필요 |
| 공개 빌드 | `public-dist`에 공개 자원만 허용 | 서버 토큰·CLI·실행 기록을 공개 출력에 포함하면 안 됨 |

현재 일반형 계획에는 실행기가 지원하지 않는 Status가 포함될 수 있습니다. 확장형·모듈 포함 계획도 현재 실행 범위 밖입니다. 지원하지 않는 내용을 임의 변환하거나 기본형으로 조용히 대체하지 말고 미지원으로 표시해야 합니다. 기존 개인 CLI와 승인·manifest 형식은 보존하고 별도 서버 어댑터를 검토합니다.

## 4. 실제 기술 검증과 과거 증거

이번에는 기존 소스를 가져와 가상 입력으로 순수 함수를 메모리에서 실행했습니다. 네트워크·파일 생성·DB 쓰기 없이 다음 결과를 확인했습니다.

| 검사 | 이번 결과 |
| --- | --- |
| 기본형 컴파일 | 유효, 속성 7개 |
| 일반형 계획의 현재 실행기 전달 | `unsupported_property_type` |
| 확장형·출석·팀 선택 | 계획 유효, 의존 모듈 포함 3모듈·6DB. 실행기는 `standard_template_only` |
| 빈 일반형 실행 준비 | `synthetic_seven_rows_required` |
| 다른 워크스페이스 대상 | `personal_workspace_required` |
| 009B 승인 요청 재계산 | 기존 요청 해시와 같음 |
| 저장 planner 전달 | 생략하면 basic, 전달하면 저장된 extended |

과거 NB-V2-009A의 개인 빈 1DB 생성, 009B의 3DB·관계·계산·가상 7행 생성 기록을 참고했습니다. 010A 증거에는 Node 255개·V1 256조합과 실제 저장·복원 결과가 있습니다. **이번에 전체 테스트·브라우저·실제 Notion 생성을 재실행하지 않았습니다.** 회사 테스트 B 복제는 여전히 실제 검증되지 않았습니다.

## 5. 사용자별 OAuth와 보안 설계

공식 public connection OAuth를 사용하면 사용자마다 자신이 승인한 워크스페이스·페이지 범위로 연결할 수 있습니다. 같은 워크스페이스의 다른 사용자도 각자 승인이 필요합니다. 연결 등록의 Any workspace/Selected workspaces 범위는 생성 후 변경할 수 없으므로 개발·운영 앱 구분을 검토해야 합니다. 회사 관리자 제한은 이 승인과 별개입니다. [Notion 공식 연결 방식](https://developers.notion.com/guides/get-started/public-connections)

제안하는 연결 흐름:

1. 현재 Supabase JWT로 서버에 연결 시작 요청. 서버가 `getUser(jwt)`로 본인을 확인합니다.
2. 사용자와 연결된 단기·일회 state, 브라우저 난수, 고정 callback을 사용합니다. 서버 전용 거래 저장소와 HttpOnly 쿠키로 확인합니다.
3. callback에서 코드 교환 후 토큰을 서버에 암호화해 임시 보관합니다. URL·브라우저·로그에 토큰을 반환하지 않습니다.
4. 현재 SPA의 JWT는 callback에 자동 전달되지 않습니다. 화면 복귀 후 현재 JWT로 완료 요청을 보내 시작 사용자와 일치할 때만 연결을 활성화합니다. 중간에 계정 A→B로 바뀌면 B에 연결하지 않습니다.
5. 공급자의 사용자·workspace·bot 정보와 검증된 Supabase ID를 연결합니다. 이메일 일치나 클라이언트 user_id를 소유권 증거로 사용하지 않습니다.

토큰 갱신은 연결별로 직렬화하고 access/refresh 새 쌍을 원자적으로 저장합니다. 재승인·권한 변경은 승인 버전을 올립니다. 연결 해제는 우선 새 작업을 중지하고 서버에서 철회를 시도합니다. 이미 생성한 DB는 삭제하지 않습니다. 철회의 정확한 범위와 실제 회전·실패 처리는 PoC에서 확인해야 합니다. [공식 승인 흐름](https://developers.notion.com/guides/get-started/authorization), [토큰 갱신](https://developers.notion.com/reference/refresh-a-token), [토큰 철회](https://developers.notion.com/reference/revoke-token)

페이지 목록 검색은 완전하거나 즉시 갱신된 접근 목록이 아닙니다. 새로고침·페이지 링크 입력을 제공하고 선택 후 서버가 본인 연결로 재조회합니다. 읽기 가능만으로 쓰기 가능을 보장하지 않습니다. [검색 제약](https://developers.notion.com/reference/search-optimizations-and-limitations)

## 6. 제안 서버 API와 승인 조건

Vercel Node API를 기존 정적 화면 옆에 추가하고 전체 프런트엔드 재개발은 피합니다. 프로젝트는 현재 Node 24.x 설정이지만 실제 Functions 빌드·라우팅·요금제·실행 시간·Workflow 적용 비용은 별도 검증이 필요합니다.

- OAuth 시작·callback·완료, 본인 연결 목록·해제 API.
- 본인 연결의 페이지 검색 API.
- 소유 설계를 읽고 지원 범위·계획을 재계산하는 review API.
- 일회 승인·idempotency key를 소비해 run을 등록하는 생성 API.
- 본인 run 상태·결과 조회와 제한된 재개 API.

서버는 기존 RLS를 이용해 소유 설계를 읽고, 서버 권한을 쓰는 작업에서도 소유권을 명시적으로 검사합니다. 브라우저의 임의 Notion 요청·Formula·토큰을 실행하지 않습니다. [Supabase 서버 사용자 확인](https://supabase.com/docs/reference/javascript/auth-getuser)

승인 대상은 사용자·설계 ID/버전·연결/권한 버전·정확한 부모·API/컴파일러 버전·최소 실행 사양의 SHA-256·행 수·쓰기 범위·만료·일회 식별자를 포함합니다. planId만으로 승인하지 않습니다. 승인 직전 저장본 변경은 재확인하고, 승인 후 편집은 이미 확정된 실행을 덮어쓰지 않습니다.

첫 실제 생성 후보는 ‘선택 부모 아래 새 결과 페이지 1개 + 빈 기본형 DB 1개·행 0개’입니다. 이는 향후 별도 승인 범위이며 아직 구현·생성하지 않았습니다.

## 7. 추가 DB 필요성

교육 설정은 기존 `education_drafts`로 충분합니다. 테이블 구조·version 1·RLS 변경은 필요하지 않습니다. 다만 전체 웹 생성에 필요한 비밀과 실행의 근거를 사용자 편집 configuration에 넣으면 안 됩니다.

| 제안 저장 책임 | 주요 내용 |
| --- | --- |
| 연결 메타데이터 `notion_connections` | 소유자, workspace·bot, 상태, 권한 버전, 비밀 저장 참조 |
| 실행 이력 `notion_generation_runs` | 원본 설계, 확정 사양·해시, 승인·중복 키, 단계·원격 ID·링크·오류·재개·잠금 버전 |
| 서버 전용 자격 증명 | 암호화 토큰 쌍·키와 회전 버전 |
| 단기 OAuth 거래 | state 해시·사용자·만료·일회 소비·대기 연결 |

전체를 Supabase 테이블로 보관하면 공개 메타데이터/실행 2개와 private 비밀/거래 2개, 예를 들어 총 4개가 될 수 있습니다. Vault·외부 단기 저장소에 따라 물리 구조는 달라집니다. 이는 **설계안**이며 새 테이블·SQL은 이번에 만들지 않았습니다. 최초의 서버 Dry Run 단계에는 새 테이블이 0개입니다.

브라우저는 본인에게 공개해도 되는 메타데이터·이력만 읽고 생성·상태 갱신은 서버만 수행합니다. 암호화 키 분리와 복호화 권한 제한이 필요하며 Secret/service_role은 서버에서도 소유권 확인을 생략하는 근거가 아닙니다. [Vault 보안 구조](https://supabase.com/docs/guides/database/vault)

## 8. 중복·실패·지속 실행

로컬 manifest를 영구 run·단계 기록으로 옮기는 새 경로가 필요합니다. DB 고유 제약, 원자적 상태 전이, 잠금 버전, 단계별 요청 해시로 중복을 제어합니다. 작업 등록과 전달 사이 실패도 재조정할 수 있어야 합니다. 큐에 사용자 JWT를 장기 저장하지 않습니다.

Notion POST가 성공했지만 응답·기록을 잃은 경우는 불확실 상태로 남깁니다. 알려진 ID는 재조회하고, 모르는 ID는 수동 검토하며 자동 재POST·자동 삭제·후보 자동 채택을 하지 않습니다. 부분 결과의 링크를 보존하고 확인된 미실행 단계만 재개합니다.

공유 요청 제한, Retry-After, 503 쓰기의 불확실성을 처리해야 합니다. 기존 통신 모듈의 자동 재시도를 생성에 그대로 적용하지 않습니다. Free 블록 한도·관리자 거절·요청 제한을 구분합니다. [Notion 요청 제한](https://developers.notion.com/reference/request-limits), [블록 한도](https://developers.notion.com/reference/workspace-block-limits)

긴 작업은 202 등록 후 상태 조회 흐름을 권장합니다. Workflow/Queue는 후보지만 자동 재시도로 외부 생성의 exactly-once가 보장되지는 않습니다. 실행 기록이 재전달된 단계의 재생성을 막아야 합니다. 실제 도입·장애 복구·비용은 미검증입니다. [Workflows](https://vercel.com/docs/workflows), [Queues](https://vercel.com/docs/queues)

## 9. UX와 회사 경로

기본 흐름은 로그인 → 저장 설계 → Notion 연결 → 부모 선택 → 간단한 구성 확인·명시적 승인 → 상태·결과 링크입니다. 기존 연결·최근 부모를 제안하여 반복 조작을 줄이되 승인과 접근 확인은 유지합니다. 기본형은 1DB·주요 속성·행 0개만 간단히, 일반형은 3DB 연결 그림으로, 확장형은 실제 지원 전 미리보기로 표시합니다. 실제 클릭 수·사용성·모바일은 아직 측정하지 않았습니다.

| 회사 적용 경로 | 판단 |
| --- | --- |
| 개인 생성 후 수동 복제 | 회사 연결이 어려울 때 검토할 수 있으나 회사 정책·관계·권한·외부 참조 검증 필요. 현재 성공 보장 불가 |
| 회사 OAuth 승인 후 직접 생성 | 관리자와 페이지 권한이 허용하면 복제 과정을 줄일 수 있음. 현재 실제 검증 없음 |
| 템플릿·CSV | 수동 대안. CSV만으로 관계·계산·색상 복원 불가. 자동 내보내기 기능이 구현됐다고 간주하면 안 됨 |

개별 DB 복제와 전체 묶음 복제는 별도로 검증해야 합니다. 회사 테스트 B가 없어서 007B의 복제는 실제 수행되지 않았습니다. 회사 자료를 개인 공간으로 옮기는 실험도 포함하지 않습니다. [공간 간 이동](https://www.notion.com/help/transfer-content-to-another-account), [관계와 CSV 제약](https://www.notion.com/help/relations-and-rollups)

## 10. 권장하는 다음 작은 작업

**NB-V2-011B: 인증된 서버 Dry Run·실행 가능 범위 검사**를 먼저 제안합니다.

- 현재 Supabase JWT의 서버 검증과 소유 설계 조회.
- 저장 planner를 정확히 전달하여 계획·SHA-256·미지원 사유 재계산.
- 클라이언트가 전달한 임의 설정 대신 서버 저장본을 기준으로 사용.
- 비로그인 401, 타인 설계 거절, 동일 해시 일관성, 저장본 변경 감지 검증.
- 현재 지원하지 않는 일반형·확장형을 실제 생성 가능으로 표시하지 않음.
- 새 테이블·SQL·OAuth·Notion 호출·실제 생성·기존 CLI 수정·무단 배포 제외.

그다음 OAuth 읽기 전용 PoC → 영구 이력·내구 실행과 빈 기본형 실제 생성 → 가상 행 없는 일반형 → 확장형 순서가 적절합니다. 토큰 저장/거래 DB 적용과 각 실제 생성·배포는 구체 검토 후 승인할 별도 범위입니다.

## 11. ChatGPT 검토 요청

ChatGPT는 NB-V2-011A 결과를 기존 교육·해커톤용 Notion DB 빌더 기획과 비교해 주세요.

1. 사용자별 Notion OAuth와 회사 정책·페이지 범위의 제약을 적절히 구분했는지 검토해 주세요.
2. Supabase 사용자·저장 설계·연결·승인된 실행 계획의 소유권 연결이 안전한지 평가해 주세요.
3. 기존 CLI의 재사용 범위와 일반형 가상 행·Status·확장형 미지원 제약을 확인해 주세요.
4. 연결 정보·암호화 토큰·실행 이력·단기 거래의 저장 책임과 추가 DB 필요성을 검토해 주세요.
5. 중복 생성·불확실한 POST·부분 실패·재개 구조에 빠진 위험을 정리해 주세요.
6. 회사 복제·직접 생성·템플릿/CSV 대안에서 실제 확인과 가설을 구분해 주세요.
7. 다음 작업을 ‘인증된 서버 Dry Run’으로 제한할지 결정하고, 합의한 작은 범위의 Codex 프롬프트를 작성해 주세요.

소스·읽기 전용 조회·순수 함수 확인은 완료, 웹 생성 아키텍처는 설계안, OAuth/회사 복제/웹 실제 생성/분산 장애 복구는 미검증입니다. **실제로 확인되지 않은 기능을 완료로 판단하지 마세요.**
