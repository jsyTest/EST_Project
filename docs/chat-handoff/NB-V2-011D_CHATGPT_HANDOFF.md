# [ChatGPT 전달용] NB-V2-011D Production 설정 오류 진단 결과

Codex가 읽기 전용으로 조사했습니다. **진단과 최소 조치 계획 작성은 완료했지만 Production 설정은 해결하지 않았고, 실계정은 미검증입니다.**

## 1. 기준과 변경 범위

- Git 시작·종료: `main / 5c2a0a6fdc8582ff8c66ff8c50d85971035e6c07`, `변경 구현 11`.
- 시작 작업 트리 clean. 직전 011C 이후 커밋 차이는 보고 문서 2개뿐입니다.
- 이번 추가 파일: `docs/research/NB-V2-011D_REPORT.md`, `docs/chat-handoff/NB-V2-011D_CHATGPT_HANDOFF.md`.
- 코드·환경변수·배포·Supabase 데이터/SQL/Auth/RLS·Notion·Git commit/push 변경 없음. 비밀번호·실제 JWT·환경변수 원문 값 출력 없음.

## 2. 확인한 프로젝트와 배포

| 항목 | 확인 결과 |
| --- | --- |
| Vercel 프로젝트 | `pplus` / `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n` |
| 소유 팀 | `PPLUS` / `pplus1` / `team_gDF3LRSavShTKMmlQTNwqH51` |
| Git 연결 | GitHub `jsyTest/EST_Project` |
| 기존 최신 Production | `dpl_BqwK6eFsRHCuwxz4UKRYbLaoEJaB`, READY |
| 배포 URL | `pplus-3pnmekm7c-pplus1.vercel.app` |
| 실제 SHA·ref·source | 현재 Git과 같은 SHA / main / git |
| Root Directory | 현재 Dashboard 원문은 도구에 반환되지 않아 미확인 |
| Production Branch | 이전 제공값 main과 실제 배포 ref main은 일치. 현재 설정 원문은 미확인 |

최근 배포가 Git에서 생성됐다는 것은 확인했습니다. 현재 자동 배포 필터·ignore 조건·Deploy Hook 전체는 확인하지 못했습니다. 승인 전에 main push로 배포를 유발하지 않습니다.

배포 생성은 한국 시각 2026-10-30 10:49:00.911, READY는 10:49:06.388입니다. 프로젝트 updatedAt은 10:49:06.680이지만 환경변수 변경 시각이 아닙니다. 이 시각 차이를 ‘배포 후 환경변수 수정’ 증거로 사용하지 않았습니다.

## 3. 환경변수 목록에서 확인한 사실

정확한 프로젝트·팀으로 decrypt=false 목록 조회를 했습니다.

- `envs=[]`, 전체 반환 항목 **0개**.
- `hiddenProductionEnvCount=0`.
- 오류·권한 거절 응답이 아니며 별도 pagination 없음.

| 정확한 이름 | 프로젝트 목록 | 적용 환경 | Shared 연결 |
| --- | --- | --- | --- |
| `SUPABASE_URL` | 조회되지 않음 | 항목 없어 확인 불가 | 미확인 |
| `SUPABASE_PUBLISHABLE_KEY` | 조회되지 않음 | 항목 없어 확인 불가 | 미확인 |
| `REVIEW_ALLOWED_ORIGINS` | 조회되지 않음. 선택 변수 | 항목 없어 확인 불가 | 미확인 |

프로젝트 수준에서 필수 이름이 조회되지 않는 것은 확인했습니다. 그러나 팀 Shared 변수와 배포별 런타임 값까지 전부 없다고 단정하지 않습니다. 현재 Shared 도구는 개별 복호화 값 조회 방식이어서 사용하지 않았고, 연결 목록을 볼 브라우저도 unavailable이었습니다. CLI 설치·link·env pull도 하지 않았습니다.

Shared의 이름·target·pplus 연결·수정 시각은 후속 읽기 확인이 필요합니다. Shared는 프로젝트 연결이 필요하며 동일 이름·환경에서는 프로젝트 변수가 우선합니다. [Vercel Shared 변수](https://vercel.com/docs/environment-variables/shared-environment-variables)

## 4. 503의 정확한 위치와 남은 불확실성

현재 Production에 같은 안전한 가짜 Bearer 요청을 보내 **503 `server_not_configured`**를 다시 확인했습니다. `webExecutionReady=false`, `notionExecution=not_executed`도 유지됩니다.

처리 순서는 경로/메서드 → Origin → Bearer 형식 → 본문 → **서버 설정 검사** → Supabase Auth → 본인 설계 조회입니다. 이번 503은 Auth·RLS 호출 전입니다.

`readConfiguration()`의 실패 조건:

- `SUPABASE_URL` 누락·해석 불가.
- HTTPS·허용 Supabase 호스트·루트 경로 조건 불충족, 금지된 port/사용자 정보/query/fragment 등.
- `SUPABASE_PUBLISHABLE_KEY` 누락·비문자열·허용 prefix/문자 패턴 불일치. 키 공백·Secret/service_role/legacy JWT key 불허.

`REVIEW_ALLOWED_ORIGINS`는 선택 변수이고 이 검사의 대상이 아닙니다. 이번 503을 해결하려고 반드시 등록해야 하는 값이 아닙니다.

메모리 검사 10사례로 누락·오타·URL/키 형식 오류가 503을 만들고 기존 공개 설정은 통과함을 확인했습니다. 형식이 맞는 다른 프로젝트 URL·키 조합도 로컬 형식 검사를 통과할 수 있으므로 **프로젝트 불일치 자체가 이번 503의 단독 원인은 아닙니다.** 실제 연결 단계에서 별도 확인해야 합니다.

따라서 확인된 원인은 ‘프로젝트 필수 변수 부재와 현재 런타임 설정 검사 실패’까지입니다. Shared 값·배포 스냅샷을 보지 않아 URL/키 중 어느 실효 값이 누락·오류인지, 과거 삭제·미반영 이력이 있는지까지 확정하지 않았습니다.

## 5. Supabase 연결 대상

Supabase 메타데이터에서 기존 ref `pxkjxcryceqtjomgxyfe`, 이름 `PPLUS`, ACTIVE_HEALTHY를 확인했습니다. 사용자 데이터는 조회하지 않았습니다.

실제 웹사이트의 공개 `js/supabase-client.js`는 이 프로젝트를 가리키며 로컬 URL·Publishable Key와 동일했습니다. 값은 메모리에서만 비교하고 프로젝트 ref·키 종류·일치 여부만 출력했습니다.

브라우저는 기존 JS의 공개 설정을 사용하고 서버는 `process.env`의 별도 두 이름을 읽습니다. **브라우저 연결이 정상이어도 서버 환경변수가 자동 등록되지 않습니다.** 새 프로젝트·새 키 발급·Auth 재구현·RLS 해제는 필요하지 않습니다.

## 6. 오류 응답 해석

| 응답 | 의미 |
| --- | --- |
| 503 `server_not_configured` | Auth 호출 전 필수 서버 설정 미충족 |
| 401 `auth_required` | Bearer 없음/형식 오류. 서버 설정 검증 전 |
| 401 `invalid_session` | 보통 Auth 거절. 현재 코드는 Auth 401/403·부적합/익명 사용자·Data API 401도 포함 |
| 403 `origin_not_allowed` | 인증 전 출처 검사 실패 |
| 404 `draft_not_found` | 없는 설계 또는 본인 소유 아님을 동일하게 처리 |
| 409 `saved_draft_changed` | 소유 저장본과 기대 시각·유효 형식의 해시가 다름 |

무인증 401은 서버 설정 정상의 증거가 아니며, invalid_session 401만으로 키·프로젝트 쌍과 정상 계정 인증을 입증할 수도 없습니다. 잘못된 해시 형식은 400이므로 409 QA에는 올바른 형식의 다른 해시를 사용해야 합니다.

## 7. 최소 수정 계획 — 아직 실행하지 않음

1. Shared 이름·target·프로젝트 연결·시각과 배포 설정 원문을 읽기 확인합니다.
2. Shared가 유효하면 중복 등록보다 적용 범위·배포 시점을 먼저 확인합니다. 사용할 Shared가 없다면 **pplus 프로젝트 수준의 두 필수 변수** 등록을 권장합니다. 팀 전체 공유 값을 바꾸지 않습니다.
3. 기존 PPLUS URL·Publishable Key의 형식과 프로젝트 쌍을 안전하게 대조합니다. Secret/service_role·자동 fallback은 추가하지 않습니다.
4. 별도 승인 후 전용 Preview/Development 최소 범위와 필요한 정확한 Preview Origin을 설정하고 검토 SHA의 Preview 1건을 검증합니다. Production은 아직 변경하지 않습니다.
5. Preview에서 가짜 토큰 401, 무인증 401, 외부 Origin 403, GET 405, 내부/미등록 경로 404, no-store와 실계정 QA를 확인합니다. 보호 기능은 해제하지 않습니다.
6. Preview 결과를 제시한 뒤 **Production 변수 적용과 새 Production 배포를 별도로 승인**받습니다.

Vercel 환경변수 변경은 기존 배포에 소급 적용되지 않습니다. 새 배포가 필요합니다. [Vercel 적용 환경·배포 정책](https://vercel.com/docs/environment-variables)

Preview도 같은 Supabase 프로젝트를 쓰면 기존 데이터에 접근할 수 있으므로 허가된 계정과 가상 설계만 읽습니다. 기존 DB·Auth URL·RLS·Notion 자료는 바꾸지 않습니다. 공개 설정은 Vercel Config로 관리할 수 있으며 Vercel 저장 유형 Secret과 Supabase Secret Key는 다른 개념입니다.

롤백은 Preview 실패 시 중단, Production 실패 시 승인된 이전 배포 복귀와 변수 범위 원복을 준비합니다. 변수 원복만으로 현재 배포가 즉시 바뀌지는 않습니다. 현재 기준 배포는 503이 남아 있어 이를 완전 정상 버전이라고 부르지 않습니다. Shared 전체 삭제로 되돌리지 않습니다.

## 8. 실제 계정 QA와 승인 범위

실제로 서로 다른 Supabase 사용자 A/B와 기존 테스트 설계만 사용합니다. 같은 계정의 설계 A/B를 두 사용자로 취급하지 않습니다. 다음은 모두 이번 **미실행**입니다.

- A 본인 200, 저장 planner·유형·모듈·개수 일치.
- B가 실제 존재·소유를 확인한 설계에 A로 접근 시 404, 없는 UUID도 동일한 안전한 404.
- B 본인 200과 가능한 B→A 거절.
- 존재하는 기본/일반/확장·과거 v1만 검사. 없는 유형은 미검증 유지.
- 반복 해시 동일, 현재 시각·올바른 기대 해시 200, 오래된 시각·다른 해시 409.
- 웹 준비 false·Notion 실행 not_executed 유지.

JWT·비밀번호는 개발 브라우저 메모리에서만 사용하고 공유하지 않습니다. 세션에 접근할 수 없으면 실계정 미검증을 유지합니다.

후속 승인안은 두 단계입니다. ① pplus의 필요한 Preview/Development 변수·Origin과 Preview 1건·읽기 QA, ② 성공 증거를 검토한 뒤 Production 변수·새 배포 1건·읽기 QA·지정 롤백 범위. 실제 변경 전에 대상 SHA·환경·변수 수를 최신 정보로 구체화해야 합니다. **이번에는 승인을 요청하거나 변경을 실행하지 않았습니다.**

## 9. 보존·검증 상태와 ChatGPT 결정 요청

전체 295개·V1 256조합 통과는 011C의 실행 결과입니다. 이후 문서만 바뀌었고 이번에는 전체 검사를 재실행하지 않았습니다. 이번 증거는 메타데이터·현재 503·공개 연결 대상·10개 순수 설정 검사입니다.

환경변수 등록/수정/삭제·배포·코드·Supabase 데이터/구조/Auth/RLS·Notion 요청·commit/push·계정/키 발급은 모두 수행하지 않았습니다. **Production 설정 해결 완료나 실제 정상 계정 성공으로 처리하지 마세요.**

ChatGPT는 다음을 검토하고 다음 작은 작업을 결정해 주세요.

1. 프로젝트 필수 변수 부재와 런타임 설정 검사 실패까지 특정했으며 Shared·배포 이력은 미확인이라는 구분이 적절한가요?
2. 필수 변수 이름·선택 Origin·환경별 적용 계획이 정확한가요?
3. 기존 Publishable Key만 사용하고 Secret/service_role 없이 해결하는 계획이 적절한가요?
4. Shared 연결 확인 후 전용 Preview에서 안전하게 검증할 수 있나요?
5. Production 변수 적용·새 배포·롤백에 필요한 별도 승인 범위를 검토해 주세요.
6. 실제 다른 A/B 계정의 세션·기존 설계를 확보하기 전 QA를 미검증으로 유지해야 하나요?
7. 설정 해결과 실제 인증·격리 확인 중 OAuth 읽기 전용 PoC로 넘어가기 위한 선행 조건을 정해 주세요.

필요하면 **Shared 메타데이터 보완과 Preview 설정·검증을 우선하는 후속 Codex 프롬프트**를 작성해 주세요. Production은 Preview 증거와 별도 승인 전까지 변경하지 않도록 범위를 명시해 주세요.
