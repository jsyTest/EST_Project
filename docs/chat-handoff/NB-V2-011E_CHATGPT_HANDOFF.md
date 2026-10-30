# [ChatGPT 전달용] NB-V2-011E Preview 설정·서버 검증 결과

**이번 결과는 Phase A 읽기 전용 조사와 승인 요청서입니다. 사용자의 별도 승인이 없어 Phase B를 실행하지 않았습니다. Preview 설정·배포·실계정 검증이 완료된 결과가 아닙니다.**

## 1. 최신 기준

- Git 시작·종료: `main / 2431571648f7ca647b690b27cd873a3117736090`, `변경 구현 12`.
- 시작 작업 트리 clean. 직전 011D 이후 커밋 차이는 011D 보고 문서뿐입니다.
- 프로젝트: pplus `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n`.
- 팀: PPLUS/pplus1 `team_gDF3LRSavShTKMmlQTNwqH51`.
- Git 연결: `jsyTest/EST_Project`.
- 최신 기존 Production: `dpl_6WaYPkv5fE1kvvv2YVEnPgkyBJJu`, READY, 현재와 같은 SHA·main·source git.
- 기존 배포 URL: `pplus-c6v0351l3-pplus1.vercel.app`.
- Production Branch의 이전 제공값 main과 실제 ref는 일치하나 현재 Dashboard 설정 원문은 미확인입니다. Root Directory·원격 Build/Output override 원문도 도구에 반환되지 않았습니다.
- 로컬 설정은 정적 build command와 public-dist를 유지합니다. 원격 framework null, Node 24.x입니다.

## 2. Shared와 필수 변수

정확한 프로젝트·팀의 decrypt=false 조회는 **envs=[] / hiddenProductionEnvCount=0**입니다.

| 이름 | 현재 상태 |
| --- | --- |
| `SUPABASE_URL` | 프로젝트 목록 없음. Shared가 제공하지 않는다면 Preview 등록 필요 |
| `SUPABASE_PUBLISHABLE_KEY` | 프로젝트 목록 없음. 같은 조건으로 기존 키 재사용 |
| `REVIEW_ALLOWED_ORIGINS` | 선택 변수. 실제 Preview URL 전 임의 등록하지 않음 |

Shared의 변수명·환경·pplus 연결·충돌·최근 변경 시각은 **미확인**입니다. 복호화 원문 조회 도구는 사용하지 않았으며 브라우저 host도 unavailable입니다. CLI도 없습니다. Shared가 없다고 추측하지 않았습니다. 유효한 Shared가 있으면 중복 등록을 피하고, 프로젝트 값이 같은 이름·환경의 Shared보다 우선한다는 점을 고려합니다. [Shared 변수](https://vercel.com/docs/environment-variables/shared-environment-variables)

기존 브라우저 설정은 ref `pxkjxcryceqtjomgxyfe`를 가리키고 서버 형식 검사를 통과했습니다. Supabase 메타데이터의 기존 PPLUS·ACTIVE_HEALTHY와 일치합니다. 새 키 발급이 필요하다는 근거가 없어 기존 Publishable Key를 재사용할 계획입니다. 형식 통과를 실제 Auth 성공으로 해석하지 않습니다. 키 원문·실제 JWT는 출력하지 않았습니다.

## 3. 실제로 확인한 결과와 미실행

현재 Production의 가짜 토큰 review 요청은 **503 server_not_configured**였습니다. Auth 호출 전 설정 검사 실패이며 웹 준비 false·Notion not_executed를 유지합니다.

이번 Preview 변수 변경 **0건**, Preview 배포 **0건**, 새 Preview URL·ID **없음**입니다. 실제 Preview에서 503이 해소됐는지, Supabase Auth까지 도달했는지, A/B 계정·저장 planner·해시·409가 동작하는지는 모두 **미실행**입니다.

기존 Node 295개·V1 256조합 통과는 011C 실행 기록입니다. 이후 문서만 바뀌었고 이번 전체 검사를 재실행하지 않았습니다. 현재 공개 출력은 읽기 검사에서 정확히 26개 allowlist와 같고 서버·CLI·문서·환경 파일은 없었습니다.

## 4. 보호와 Origin의 제약

프로젝트 메타데이터는 Vercel Authentication 활성, deploymentType `all_except_custom_domains`입니다. Preview가 공개라고 가정하지 않습니다.

보호된 URL을 가져오는 현재 연결 도구는 임시 공유 링크를 생성할 수 있어 호출하지 않았습니다. CLI 설치·로그인·보호 해제·공유 링크·bypass secret·Trusted Sources 변경은 수행하지 않았고 아래 승인에도 포함하지 않습니다. 기존 인증으로 접근할 수 없으면 검증을 중단합니다.

또한 새 Preview origin은 현재 서버 허용 목록에 자동 포함되지 않습니다. 첫 배포 후 URL이 정해지면 브라우저 QA를 위해 정확한 Origin 설정과 추가 배포가 필요할 수 있습니다. **최초 승인 범위에 이를 자동 포함하지 않고 필요성·추가 변경을 보고한 뒤 중지합니다.** 변수 변경은 이전 배포에 소급 적용되지 않습니다. [환경변수 적용 정책](https://vercel.com/docs/environment-variables)

## 5. [NB-V2-011E Preview 변경 승인 요청서]

승인안 ID: **NB-V2-011E-PREVIEW-01**. 현재 승인: **없음**.

| 항목 | 요청 범위 |
| --- | --- |
| 프로젝트·팀 | pplus `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n` / PPLUS `team_gDF3LRSavShTKMmlQTNwqH51` |
| 환경 | **Preview만**. Production·Development·팀 Shared 제외 |
| 정확한 Git SHA | **`2431571648f7ca647b690b27cd873a3117736090`** |
| 방식 | 기존 Git 연결의 위 SHA로 Vercel API/MCP Preview 생성. Preview·SHA 고정을 보장할 수 없으면 실행 전 중지 |
| Git 변경 | 브랜치 생성·commit·push **0건** |
| 필수 변수 | pplus Preview에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` 최대 2개 신규 등록. 기존 PPLUS 공개 설정 재사용 |
| Shared | 미확인. 올바른 Shared면 등록 생략. 중복 여부를 판단할 수 없으면 쓰기 전에 중지 |
| 추가 Origin | **최초 0개**. 실제 URL 이후 필요하면 별도 승인 요청 |
| 배포 수 | **최대 1건**. 자동 재시도·두 번째 배포 제외 |
| 보호 | 기존 Vercel Authentication 유지. 공유 링크·bypass·보호 정책 변경 없음 |
| 데이터 | 허가된 서로 다른 계정의 기존 가상 설계만 읽기 |
| 허용할 원격 쓰기 | 승인 조건 충족 시 Preview 변수 최대 2개 신규 등록·Preview 생성 최대 1건 |
| 금지 | Supabase·Notion 쓰기, Production/Development/Shared 변경, Git 원격 변경, alias·승격·롤백·접근 권한 변경 |
| 중단·원복 | 실패·503 지속·보호 접근 불가·불확실한 생성 시 추가 변경/배포 없이 중지. 신규 변수 삭제 원복이 필요하면 ID·범위를 보고하고 별도 승인 요청 |

**승인 후에도 Shared 중복 여부·기존 권한의 보호 접근 경로·Preview와 SHA 고정 가능성을 확인해야 합니다. 확인할 수 없으면 변수 등록·배포 전에 중지합니다.** 미확인 조건을 성공으로 간주하는 승인이 아닙니다.

main을 기본 환경 추론에 맡기거나 latest commit으로 자동 치환하지 않습니다. 도구의 명확한 Preview 생성이 불가능하면 Git 브랜치/push 등 대안의 정확한 범위를 다시 제시합니다. 이번 승인안은 이를 허용하지 않습니다.

## 6. 승인 이후 검증 계획

기존 Vercel 인증으로 HTTP 접근이 가능할 때 먼저 GET 405, 무인증 401, 가짜 토큰의 실제 Auth 401, 외부 Origin 403, 내부·미등록 경로 404, no-store를 확인합니다. 프로그램용 Origin 없는 요청은 기존 API 계약을 이용하는 것이며 브라우저 Origin 검사를 우회하는 방법으로 사용하지 않습니다.

브라우저 QA에 Origin 추가가 필요하거나 두 번째 배포가 필요하면 자동 실행하지 않고 별도 승인 범위를 보고합니다. 보호 페이지의 401/403은 앱 인증 결과로 기록하지 않습니다.

실제 계정 세션과 필요한 Origin이 준비됐을 때만 다음을 확인합니다.

- A 본인 설계 200, A→B와 없는 설계의 동일한 안전한 404.
- 실제 다른 사용자 B의 본인 설계 200과 가능한 B→A 차단.
- 기존 저장 planner·모듈·추천 조건·개수 비교.
- 반복 해시 동일, 현재 기준 200, 오래된 시각·다른 유효 형식 해시 409.
- 웹 준비 false, Notion not_executed 유지.

같은 계정의 설계 A/B를 두 사용자 격리로 사용하지 않습니다. 새 계정·설계를 만들지 않고 실제 교육생 데이터는 사용하지 않습니다. 세션에 접근할 수 없으면 미실행으로 남기며 JWT·비밀번호·HAR·스크린샷을 공유하지 않습니다. 011C 보고서의 수동 절차도 Preview 보호·Origin 조건을 충족한 후 활용합니다.

## 7. 보존과 다음 결정

이번에는 작업 보고서·인계문 2개만 추가했습니다. 기존 코드·Auth·저장·구성 복원·CSV/색상·Notion CLI·manifest는 변경하지 않았습니다. Production 설정·배포·alias, Supabase 데이터/구조/Auth/RLS, Notion 요청, Git commit/push, 키/계정 발급은 모두 변경 0건입니다.

요청문 3절에 따라 **Phase A에서 종료하며 사용자의 별도 메시지 승인을 기다립니다.** 이 지시문만으로 변경을 승인받은 것이 아닙니다.

ChatGPT는 다음을 검토해 주세요.

1. Shared 연결이 여전히 미확인인 상태를 정확히 구분했나요?
2. Preview 변수 등록 전에 Shared 중복 확인을 조건으로 둔 범위가 적절한가요?
3. 별도 승인이 아직 없고 실제 변경·배포가 0건이라는 점을 확인해 주세요.
4. Preview 1건과 정확한 SHA, Git 변경 0건의 제약을 검토해 주세요.
5. 보호 접근·Origin 추가의 미해결 조건과 추가 승인 경계를 검토해 주세요.
6. 실제 Supabase Auth·A/B 격리·계획·해시는 미실행이라는 구분이 적절한가요?
7. Production·데이터 보존을 확인하고 OAuth 읽기 전용 PoC의 선행 조건을 정해 주세요.

사용자는 위 **NB-V2-011E-PREVIEW-01** 범위를 검토한 뒤 별도 메시지로 승인 여부를 결정해 주세요. Shared·보호 접근 등 조건이 해소되지 않으면 승인 후에도 쓰기 전에 중지합니다. Preview QA나 Notion 웹 생성이 완료됐다고 판단하지 마세요.
