# [NB-V2-011E 작업 보고서]

## 1. Phase A 결과

**읽기 전용 조사와 Preview 변경 승인 요청서 작성까지 완료했다. 별도 승인이 없어 Phase B는 실행하지 않고 종료한다.** 요청문 3절은 ‘사용자가 별도 메시지로 명시적 승인을 하기 전에는 Phase B를 실행하지 않는다’고 요구한다. 이 작업 지시문 자체를 변경 승인으로 사용하지 않았다.

현재 프로젝트 변수 0개·숨겨진 Production 변수 0개이며 Shared 연결은 여전히 미확인이다. 최신 Production에서 503이 재현됐다. 이번 Preview 변수 등록 0건, Preview 배포 0건이다. 실제 계정의 서버 검토 성공·격리·계획·해시는 미검증이다.

이번 파일 변경은 이 보고서와 ChatGPT 인계문 2개뿐이다. 코드·기존 문서·설정·원격 데이터는 변경하지 않았다.

## 2. 최신 Git·Vercel 상태

| 항목 | 실제 확인 결과 |
| --- | --- |
| 시작·종료 Git | `main / 2431571648f7ca647b690b27cd873a3117736090`, `변경 구현 12` |
| 시작 작업 트리 | clean. 직전 011D 이후 커밋 차이는 011D 보고서·인계문뿐 |
| 프로젝트 | `pplus`, `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n` |
| 소유 팀 | `PPLUS` / `pplus1`, `team_gDF3LRSavShTKMmlQTNwqH51` |
| Git 연결 | GitHub `jsyTest/EST_Project` |
| 최신 Production | `dpl_6WaYPkv5fE1kvvv2YVEnPgkyBJJu`, READY, source git |
| 기존 배포 URL | `pplus-c6v0351l3-pplus1.vercel.app` |
| 실제 배포 SHA·ref | 현재 Git과 같은 SHA / main |
| Production Branch | 이전 사용자 제공값 main과 실제 배포 ref는 일치. Dashboard 설정 원문은 도구에 없음 |
| Root Directory | 원격 정확한 값은 미확인. 빈 값이라고 추정하지 않음 |
| Build/Output | 로컬 `node scripts/deployment/build-static.mjs` / `public-dist`. 원격 override 값은 도구에 없음 |
| Framework·Node | 원격 null / 24.x |
| 로컬 CLI·브라우저 | vercel/vc 없음. 브라우저 host unavailable, 앱·탭 접근 불가 |

직전 배포 `dpl_BqwK...`를 최신으로 가정하지 않았다. 새 배포를 만들지 않고 현재 배포 메타데이터만 조회했다.

## 3. 변수·Shared·보호 설정

정확한 프로젝트·팀에서 decrypt=false로 목록 조회: `envs=[]`, `hiddenProductionEnvCount=0`.

| 이름 | 프로젝트 변수·적용 범위 | 등록 판단 |
| --- | --- | --- |
| `SUPABASE_URL` | 조회 항목 없음, target 없음 | 필수. 올바른 Shared가 없다면 Preview 전용 신규 등록 필요 |
| `SUPABASE_PUBLISHABLE_KEY` | 조회 항목 없음, target 없음 | 필수. 같은 조건으로 기존 키 재사용 |
| `REVIEW_ALLOWED_ORIGINS` | 조회 항목 없음 | 선택. 첫 Preview URL 미확정 상태에서 임의 origin을 등록하지 않음 |

Shared 변수의 정확한 이름·target·pplus 연결·프로젝트 변수 충돌·최근 변경 시각은 **미확인**이다. 현재 Shared 도구는 개별 복호화 원문 조회 방식이라 사용하지 않았다. 브라우저·CLI로 메타데이터를 보완할 수도 없었다. Shared가 있거나 없다고 추정하지 않는다. 유효한 Shared가 있으면 불필요한 중복 등록을 하지 않으며, 같은 이름·환경의 프로젝트 변수가 Shared보다 우선한다. [Vercel Shared 변수](https://vercel.com/docs/environment-variables/shared-environment-variables)

원격 보호 메타데이터:

- `ssoProtection.enabled=true`, `deploymentType=all_except_custom_domains`.
- Password Protection·Trusted IP는 비활성 메타데이터. 이를 Preview가 공개라는 뜻으로 해석하지 않는다.
- 보호된 Preview의 실제 접근은 별도 인증 확인이 필요하다. Vercel 로그인 페이지의 401/403과 앱 JSON의 401/403을 구분해야 한다.
- 현재 연결 도구 `get_access_to_vercel_url`과 `web_fetch_vercel_url`은 임시 공유 링크를 생성할 수 있어 호출하지 않았다. 링크 생성도 이번 읽기 전용 범위에 넣지 않았다.

기존 Vercel 인증을 사용하는 보호 접근 경로를 우선한다. `vercel curl`은 후보지만 현재 CLI가 없다. CLI 설치·login/link·보호 해제·Trusted Sources 변경·bypass secret·공유 링크 생성은 아래 승인안에 포함하지 않는다. [Vercel 인증을 사용하는 HTTP 도구](https://vercel.com/docs/cli/curl)

## 4. 기존 서버 설정·Supabase 대상

`server/supabase-readonly.mjs`의 필수 이름은 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`다. 기존 브라우저 공개 설정을 메모리에서 읽어 형식 검사를 통과함을 확인했다. ref는 `pxkjxcryceqtjomgxyfe`이며 Supabase 메타데이터의 PPLUS·ACTIVE_HEALTHY와 일치했다. 사용자 데이터는 읽지 않았다.

기존 키는 재사용 후보이며 **새 키 발급이 필요하다는 근거는 없다**. 형식 통과는 키의 원격 유효성·프로젝트 쌍 검증 성공을 뜻하지 않는다. 실제 Auth 도달 확인은 Phase B의 검증 대상이다. 키 원문은 출력하지 않았고 새 키를 발급하지 않았다. Secret/service_role·Notion 토큰은 사용하지 않는다.

현재 Production의 읽기 전용 review API에 가짜 토큰을 보내 **503 `server_not_configured`**를 재확인했다. `webExecutionReady=false`, `notionExecution=not_executed`였다. Auth 호출 전 구성 검증 실패이며 이번에 실제 Supabase 사용자 인증을 검증한 것이 아니다.

## 5. 첫 Preview의 Origin·접근 제약

기존 `checkOrigin()`은 브라우저 Origin이 API origin과 같으면서 허용 목록에도 있어야 통과한다. 기본 목록은 Production origin이며 새 Preview origin을 자동으로 허용하지 않는다. 따라서 **첫 배포의 URL을 얻었다고 즉시 브라우저 실계정 QA가 가능한 것은 아니다**.

이번 승인 요청은 필수 변수 최대 2개와 Preview 최대 1건으로 제한한다. 실제 Preview URL이 없는 지금은 추가 Origin 0개를 요청한다. 첫 Preview에서는 적법하게 인증된 프로그램용 HTTP 접근이 가능할 때, 원래 API가 허용하는 Origin 없는 서버 요청으로 음성 인증 검사를 진행할 수 있다. 이 방법을 브라우저의 Origin 검사를 우회하는 방법으로 사용하지 않는다.

브라우저 검증에 정확한 Origin 등록이 필요해지면 URL·변수 변경·추가 배포 필요성을 보고하고 멈춘다. 현재 승인안에 Origin 등록이나 두 번째 배포가 포함됐다고 해석하지 않는다. 변수 변경은 기존 배포에 소급 적용되지 않는다. [Vercel 환경변수 적용 정책](https://vercel.com/docs/environment-variables)

Preview 생성 방식도 사전 확인한다. 연결된 Git의 정확한 SHA를 쓰는 Vercel API/MCP Preview 생성이 우선 후보다. 공식 API 문서는 target 생략·브랜치 추론 설명이 함께 있어 **main을 넘기고 기본값에 맡기는 방식으로 실행하지 않는다**. 실제 도구가 Preview와 SHA를 확실히 고정할 수 있는지 확인한 뒤 사용한다. 불가능하면 Git 브랜치/push 등 대체 범위를 새로 제시하고 중지한다. create 호출로 기능을 시험하지 않는다. [배포 API 계약](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)

## 6. [NB-V2-011E Preview 변경 승인 요청서]

승인안 ID: **NB-V2-011E-PREVIEW-01**. 현재 승인 상태: **별도 승인 없음**.

| 항목 | 요청할 구체 범위 |
| --- | --- |
| 대상 프로젝트 | pplus `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n` |
| 대상 팀 | PPLUS `team_gDF3LRSavShTKMmlQTNwqH51` |
| 대상 환경 | **Preview만**. Production·Development·팀 전체 Shared 변경 제외 |
| 대상 Git SHA | **`2431571648f7ca647b690b27cd873a3117736090`**. latest 자동 치환 금지 |
| 배포 방식 | 기존 GitHub 연결의 해당 SHA를 Vercel API/MCP로 Preview 생성하는 방식. Preview 고정이 확인되지 않으면 실행 중지 |
| Git 변경 | 브랜치 생성·commit·push **0건**. 필요해지면 별도 범위·승인 요청 |
| 필수 변수 | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` 최대 2개, pplus 프로젝트 Preview target만 신규 등록 |
| 값 출처 | 기존 PPLUS 프로젝트의 공개 설정·기존 Publishable Key 재사용. 원문은 보고·로그에 남기지 않음 |
| Shared 연결 | 미확인. 올바른 Shared가 확인되면 해당 등록 생략. 확인되지 않아 중복 여부를 판단할 수 없으면 변경 전에 중지 |
| 새 등록 필요성 | 프로젝트 목록에서는 두 항목 모두 없음. Shared 미제공이 확인될 때 변수별 신규 등록 필요 |
| 추가 Origin | **최초 0개**. 실제 Preview URL 확인 후 브라우저 검사에 필요하면 별도 변경·추가 배포 승인 요청 |
| 배포 수 | **Preview 생성 요청 최대 1건**, 자동 재시도·두 번째 배포 없음 |
| 보호 | 기존 Vercel Authentication 설정 유지. 공개 공유 링크·bypass secret·보호 정책 변경 0건 |
| 데이터 접근 | 허가된 서로 다른 테스트 계정의 기존 가상 설계만 읽기. 새 계정·설계·실제 교육생 데이터 사용 금지 |
| 허용할 원격 쓰기 | 승인 조건 충족 시 pplus Preview 변수 최대 2개 신규 등록과 Preview 생성 최대 1건만 |
| 금지할 원격 쓰기 | Supabase/Notion 전부, Production/Development/Shared 설정, Git 원격 변경, alias·승격·롤백·접근 권한 변경 |
| Build 설정 | 기존 Root·Build·Output 설정을 임의 override하지 않음 |
| 중단·원복 | 실패·불확실한 생성·503 지속·보호 접근 불가 시 추가 변경/배포 없이 중지. 신규 변수 ID·실패 범위만 기록하고 삭제 원복이 필요하면 별도 승인 요청. Production rollback은 하지 않음 |

**승인 후에도 쓰기 전 확인할 조건:** Shared 중복 여부, 보호된 URL을 기존 권한으로 검사할 수 있는 경로, Preview·SHA 고정 가능성. 조건을 확인할 수 없다면 변수 등록·배포 전에 중지한다. 이 승인안은 미확인 조건을 해결한 것으로 간주하지 않는다.

사용자가 값 입력을 직접 해야 하는 경우 Vercel의 해당 프로젝트 Preview 설정 화면에서 입력하도록 안내한다. 값을 채팅에 붙여넣으라고 요청하지 않는다. 프로젝트 target에 Production을 함께 선택하지 않는다. 기존 변수·Shared를 upsert로 덮어쓰지 않는다.

## 7. 별도 승인 후의 검사표 — 이번 미실행

| 단계 | 기대 결과·중단 조건 |
| --- | --- |
| 배포 메타데이터 | Preview와 승인 SHA 일치, Production alias 이동 없음. 예상과 다르면 성공 처리하지 않음 |
| 보호 접근 | 기존 Vercel 인증으로 접근. 보호 페이지 401/403을 앱 결과로 계산하지 않음 |
| GET review | 앱 JSON 405, Allow POST |
| 무인증 POST | 앱 JSON 401 auth_required |
| 가짜 토큰 POST | 실제 Supabase Auth 도달 후 401 invalid_session. 계속 503이면 미해결 |
| 외부 Origin | 앱 JSON 403 origin_not_allowed |
| 미등록·내부 경로 | API·server·CLI·docs·환경 파일 경로 404 |
| 캐시 | 오류·정상 개인 응답 모두 no-store. 실제 정상 200이 없으면 정상 응답 항목 미검증 |
| 실제 A/B | A 본인 200·A→B/없는 ID 동일 404, B 본인 200·가능한 B→A 차단 |
| 실제 계획 | 기존 저장 planner·모듈·추천·개수 일치, 반복 해시 동일, 현재 기준 200·오래된 시각/다른 유효 형식 해시 409 |
| 미실행 상태 | 웹 준비 false·Notion not_executed 유지 |

현재 브라우저 세션에 접근할 수 없어 실제 계정 검사는 미실행이다. 같은 계정의 설계 A/B를 두 사용자로 취급하지 않는다. 011C 보고서의 안전한 수동 검사를 활용하되 Preview에서는 실제 Origin 허용과 보호 인증이 먼저 해결돼야 한다. JWT·비밀번호·HAR·스크린샷·원본 설정은 수집·공유하지 않는다.

## 8. 자동 검사·공개 파일·보존

- 기존 Node 295개·V1 Mock 256조합 통과는 011C의 실제 실행 기록이다. 이후 변경이 문서뿐임을 확인했고 이번 Phase A에서는 전체 테스트를 재실행하지 않았다.
- 현재 생성된 공개 출력은 **26개**, allowlist와 정확히 일치, api/server/scripts/docs/.env 출력 0개임을 읽기 검사했다. 빌드 설정을 바꾸지 않았다.
- Auth·저장·구성 복원·폼/CSV·옵션·색상·V1·Notion CLI·manifest·중복 방지 코드는 변경하지 않았다.
- 실제 Preview·실계정·브라우저 회귀가 수행됐다고 주장하지 않는다.

## 9. Phase A 종료 상태

사용자 별도 승인 없음. Preview 변수 변경 **0건**, Preview 배포 **0건**, 새 Preview URL·ID **없음**, Preview 503 해소·정상 Supabase Auth·A/B·계획·해시 검증 **미실행**. 기존 Production 503은 남아 있다.

Production 설정·배포·alias 변경 0건, Supabase 데이터/구조/Auth/RLS 변경 0건, Notion 요청 0건, 코드·Git commit/push·키/계정 발급·CLI 설치·공유 링크 생성 0건이다.

다음 단계는 승인 요청서에 대한 사용자의 별도 결정과 Shared·보호 접근·배포 방식의 미확인 조건 보완이다. 실제 인증·격리가 검증되기 전 OAuth 읽기 전용 PoC의 준비 완료로 판단하지 않는다.
