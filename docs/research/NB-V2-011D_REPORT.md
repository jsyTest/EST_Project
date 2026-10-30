# [NB-V2-011D 작업 보고서]

## 1. 결론

**프로젝트 수준 필수 환경변수가 조회되지 않는 사실과, 현재 Production이 Auth 호출 전 서버 설정 검사에서 차단되는 사실을 확인했다.** 프로젝트 변수 목록은 `envs=[]`, `hiddenProductionEnvCount=0`이다. 따라서 단순히 ‘Production 비밀 변수가 숨겨져서 목록이 빈 것’으로 설명되지는 않는다.

다만 팀 Shared 변수의 존재·프로젝트 연결·배포 당시 유효 설정은 확인하지 못했다. 현재 런타임에서 어느 필수 값이 누락됐거나 잘못됐는지, 과거에 설정했다가 삭제했는지까지 확정한 결과는 아니다. **‘모든 범위의 환경변수가 없다’거나 ‘URL 하나만 등록하면 해결된다’고 단정하지 않는다.**

최소 후속 조치는 Shared 메타데이터 확인 → 필요한 경우 pplus 프로젝트에 기존 Supabase 공개 설정 2개 등록 → 승인된 Preview 검증 → 별도 승인된 Production 새 배포다. 이미 유효한 Shared 설정이 있다면 중복 등록 전에 배포 시점·적용 환경부터 확인한다.

**진단·계획 작성 완료, 설정 해결 미완료, 실계정 미검증.** 코드·원격 설정을 수정하지 않았다.

## 2. Git·프로젝트·배포 확인

| 항목 | 이번 확인 결과 |
| --- | --- |
| 시작·종료 Git | `main / 5c2a0a6fdc8582ff8c66ff8c50d85971035e6c07`, `변경 구현 11` |
| 시작 작업 트리 | clean. 직전 011C 이후 커밋 차이는 011C 보고서·인계문뿐 |
| Vercel 프로젝트 | `pplus`, `prj_5Bxefw0g4RQLUSDXjui5do4tfC9n` |
| 소유 팀 | `PPLUS` / `pplus1` / `team_gDF3LRSavShTKMmlQTNwqH51` |
| Git 연결 | GitHub `jsyTest/EST_Project` |
| 현재 Production 배포 | `dpl_BqwK6eFsRHCuwxz4UKRYbLaoEJaB`, READY |
| 배포 URL | `pplus-3pnmekm7c-pplus1.vercel.app` |
| 실제 배포 SHA·ref | 현재 로컬과 같은 SHA / `main`, source `git` |
| Production 브랜치 설정 | 이전 사용자 제공값 main과 현재 배포 ref main은 일치. 현재 Dashboard 설정 원문은 도구에 반환되지 않음 |
| Root Directory | 현재 Dashboard 값은 도구에 반환되지 않아 미확인. 빈 값으로 추정하지 않음 |
| 로컬 빌드 설정 | framework null, `node scripts/deployment/build-static.mjs`, `public-dist` |
| 원격 framework·Node | null / 24.x |

실제 최근 배포가 Git에서 발생했다는 것은 확인했다. 현재 Git 자동 배포의 전체 필터·ignore 조건·Deploy Hook 설정까지 확인한 것은 아니다. 후속 작업에서 main push가 Production 배포를 일으킬 수 있음을 전제로 승인 전에 push하지 않는다.

## 3. 환경변수 조회와 한계

같은 프로젝트 ID·소유 팀으로 `filter_project_envs`를 **decrypt=false**로 호출했다. 오류·권한 거절이 아닌 정상 목록 응답이며 환경변수 값은 출력하지 않았다.

| 정확한 이름 | 프로젝트 목록 | 적용 환경 | Shared 연결 |
| --- | --- | --- | --- |
| `SUPABASE_URL` | 조회되지 않음 | 항목이 없어 target 확인 불가 | 미확인 |
| `SUPABASE_PUBLISHABLE_KEY` | 조회되지 않음 | 항목이 없어 target 확인 불가 | 미확인 |
| `REVIEW_ALLOWED_ORIGINS` | 조회되지 않음. 선택 변수 | 항목이 없어 target 확인 불가 | 미확인 |

조회 전체 항목 수 0, 숨겨진 Production 항목 수 0이며 별도 pagination도 반환되지 않았다. **현재 조회 가능한 프로젝트 목록 안에서는** 이름 오타·다른 prefix·환경 범위 차이를 비교할 항목 자체가 없다. 팀 Shared 목록까지 빈 것이라고 확대 해석하지 않는다.

현재 노출된 Shared 관련 조회 도구는 개별 변수의 복호화 값을 가져오는 방식이었다. 원문을 읽지 않고 연결 목록을 조사할 도구가 확인되지 않아 사용하지 않았다. 브라우저도 host unavailable로 접근할 수 없었다. Vercel CLI도 없으며 설치·link·env pull을 하지 않았다.

후속 읽기 확인 대상은 PPLUS Team Settings의 Shared 변수에서 **이름·target·linked project ID·수정 시각**, pplus의 연결된 Shared 변수 목록, Build/Deployment의 Root Directory·Production Branch다. 이름·범위만 기록하고 값을 출력하거나 내보내지 않는다. Shared는 연결된 프로젝트에만 적용되고, 같은 이름·환경에서는 프로젝트 값이 우선한다. [Vercel Shared 변수](https://vercel.com/docs/environment-variables/shared-environment-variables)

## 4. 배포·설정 시각 비교

| 메타데이터 | UTC | 한국 시각 |
| --- | --- | --- |
| 배포 생성 | 2026-10-30 01:49:00.911 | 2026-10-30 10:49:00.911 |
| 빌드 시작 | 2026-10-30 01:49:01.934 | 2026-10-30 10:49:01.934 |
| READY | 2026-10-30 01:49:06.388 | 2026-10-30 10:49:06.388 |
| 프로젝트 updatedAt | 2026-10-30 01:49:06.680 | 2026-10-30 10:49:06.680 |

프로젝트 updatedAt은 READY보다 292ms 늦지만 **환경변수 변경 시각이 아니다**. 변수 항목·Shared 수정 이력·배포별 환경 스냅샷이 없어 ‘배포 후 변수를 추가했다’ 또는 ‘배포 전 삭제했다’고 판단할 수 없다. Vercel 정책상 변수 변경은 기존 배포에 소급 적용되지 않는다. [Vercel 환경변수](https://vercel.com/docs/environment-variables)

## 5. 코드상 503 발생 조건과 검사 순서

확인 파일: `api/drafts/review.mjs`, `server/drafts-review.mjs`, `server/supabase-readonly.mjs`, `server/review-errors.mjs`.

처리 순서는 경로·메서드 → Origin → Bearer 형식 → 본문 → **readConfiguration** → Auth 사용자 조회 → 소유 설계 조회 → 계획·변경 검사다. 따라서 현재 503은 **Supabase 인증·RLS 검사 전** 오류다. 무인증 401은 설정 검사에 도달하지 않으므로 서버 설정이 정상이라는 증거가 아니다.

`server/supabase-readonly.mjs:5`의 조건:

- `SUPABASE_URL`을 URL로 해석하지 못하면 즉시 503. 두 값 모두 없을 때 이 검사가 먼저 실패한다.
- HTTPS, 허용된 `*.supabase.co` 호스트, 루트 경로여야 한다. 파싱 후 남은 비기본 port·사용자 정보·비밀번호·query·fragment가 있거나 다른 경로면 503이다.
- `SUPABASE_PUBLISHABLE_KEY`가 문자열이고 `sb_publishable_` 접두사와 허용 문자 패턴을 만족해야 한다. Secret/service_role/legacy JWT API key·키 끝 공백 등은 거절된다.
- `REVIEW_ALLOWED_ORIGINS`는 이 함수의 검사 대상이 아니다. 누락 시 기존 Production origin 기본값을 사용하는 선택 변수다. 이번 503의 직접 원인이 아니다.
- 이 검사는 **형식 검사**다. 형식이 유효한 URL·Publishable Key가 같은 프로젝트의 쌍인지 인증하지 않는다. 프로젝트 불일치만으로 이 함수가 503을 반환하는 것은 아니다.

기존 함수를 메모리에서 실행한 10개 사례: 두 값 누락·키 누락·이름 오타·HTTP URL·URL 하위 경로·키 공백·가상 Secret 키는 503, 기존 공개 설정·선택 Origin 누락·다른 프로젝트 모양 URL과의 문법상 조합은 형식 검사 통과였다. 네트워크 호출·파일·테스트 코드 추가는 없었다. 마지막 사례는 연결 가능성을 검증한 것이 아니다.

## 6. 확인된 사실과 추정 구분

| 후보 | 근거와 판정 |
| --- | --- |
| 필수 프로젝트 변수 누락 | **현재 프로젝트 목록에서 두 이름 모두 없음 확인**. 가장 먼저 조치 계획을 세울 근거 |
| 변수명 오타·다른 prefix | 정확한 이름만 읽는 코드 확인. 프로젝트 목록 전체가 비어 실제 오타 항목은 발견하지 못함 |
| URL·키 형식 오류 | 코드상 가능한 원인. 실제 런타임 값·Shared 값은 읽지 않아 개별 오류 미확정 |
| URL·키의 프로젝트 불일치 | 별도 점검 필요. 문법이 맞으면 readConfiguration은 통과하므로 이번 503 자체의 단독 설명이 아님 |
| Production 대신 Preview/Development만 설정 | 일반적인 가능성이지만 현재 프로젝트에는 비교할 target 항목이 없음. Shared target은 미확인 |
| Shared 미연결·잘못된 범위 | 미확인. 없다고 단정하지 않음 |
| 현재 배포에 설정 미반영 | 정책상 가능. 배포별 스냅샷·변수 이력이 없어 미확정 |
| 인증·RLS 오류 | **현재 503의 발생 단계와 다름**. 이 503을 보고 인증이나 RLS 실패로 판단하지 않음 |

결론은 ‘프로젝트 필수 변수 부재 + 현재 런타임 설정 검증 실패’까지다. Shared와 배포 이력을 확인하기 전 단일 필드의 누락·오타·삭제 이력을 확정하지 않는다.

## 7. Supabase 대상과 프런트엔드 관계

Supabase 프로젝트 메타데이터를 읽어 ref `pxkjxcryceqtjomgxyfe`, 이름 `PPLUS`, ACTIVE_HEALTHY, 리전 ap-northeast-2를 확인했다. 사용자 행·개인정보·테이블 내용은 조회하지 않았다.

실제 Production의 공개 `js/supabase-client.js`는 같은 ref를 가리킨다. 로컬 파일과 URL·Publishable Key가 같은지 메모리에서 비교해 둘 다 동일함을 확인하고 **일치 여부·프로젝트 ref·키 종류만 출력**했다. 원문 키·환경변수 값은 출력하지 않았다.

브라우저는 JS에 들어 있는 기존 공개 설정으로 연결하고, 서버는 별도로 `process.env`의 정확한 두 이름을 읽는다. 공개 JS가 정상 제공된다고 Vercel 서버 변수가 자동 등록되지 않는다. 서버는 브라우저 설정을 자동 fallback으로 사용하지 않는다. 서버 실제 값은 이번에 없거나 잘못된 상태로 차단되고 있어 동일 프로젝트 쌍인지 직접 비교할 수 없다.

새 Supabase 프로젝트·API 키 발급·RLS 해제·Auth 재구현은 필요하지 않다. 기존 프로젝트의 올바른 Publishable Key를 재사용하는 설정 조치로 접근한다.

## 8. 안전한 오류 해석

| 응답 | 검사 위치와 의미 |
| --- | --- |
| 503 `server_not_configured` | Auth 호출 전 URL·Publishable Key 구성 검증 실패 |
| 401 `auth_required` | Bearer 헤더 없음 또는 기대 형식 아님. 서버 설정·Auth 검증 전 |
| 401 `invalid_session` | 일반적으로 Auth 거절. 현재 코드는 Auth 401/403, 부적합 사용자 응답·익명 사용자, Data API 401도 이 코드로 묶음 |
| 403 `origin_not_allowed` | 인증 전 브라우저 출처/교차 사이트 검사 실패. Origin은 사용자 신원 증거가 아님 |
| 404 `draft_not_found` | 검증된 사용자로 조회한 설계가 없거나 본인 소유 아님. 둘은 같은 응답 |
| 409 `saved_draft_changed` | 본인 저장본을 읽은 뒤 기대 수정 시각·유효한 형식의 기대 해시가 다름 |

401 하나로 키·프로젝트 쌍이나 정상 사용자 인증을 모두 입증할 수 없다. 잘못된 해시 **형식**은 400이며, 409 검사는 64자리 등 올바른 형식이지만 다른 값을 보내야 한다.

## 9. 최소 후속 조치 계획 — 실행하지 않음

1. **메타데이터 보완:** Shared 이름·pplus 연결·target·수정 시각과 Dashboard Production Branch/Root Directory를 값 노출 없이 확인한다. 현재 변수 목록이 계속 빈지 재조회한다.
2. **분기:** 유효한 Shared가 이미 있다면 target·배포 시점을 확인하고 불필요한 중복 등록을 피한다. Shared가 없거나 이 프로젝트에 사용할 수 없다면 **pplus 프로젝트 수준** 두 변수를 등록하는 방식을 권장한다. 팀 전체 Shared를 수정해 다른 프로젝트에 영향을 주지 않는다.
3. **값 검증:** 기존 PPLUS 프로젝트의 URL과 기존 Publishable Key를 담당자가 안전하게 입력·대조한다. 이름·유효/무효·일치 여부만 기록한다. URL 경로·키 공백·prefix·프로젝트 쌍을 확인하고 Secret/service_role을 대안으로 쓰지 않는다.
4. **적용 환경:** 우선 승인된 전용 Preview와 Development에 필요한 최소 범위만 적용한다. 같은 Supabase 프로젝트를 사용한다면 Preview도 기존 데이터에 접근할 수 있음을 명시하고 허가된 테스트 계정·기존 가상 설계만 사용한다. Production 적용은 후속 별도 승인 범위다.
5. **Origin:** Preview는 실제 URL과 정확히 일치하는 허용 origin을 선택 변수에 추가한다. wildcard CORS·Origin 검사 우회는 하지 않는다. Production은 현재 기본 origin과 같다면 선택 변수 등록이 필수는 아니다. 환경별로 실제 사용할 origin만 포함한다.
6. **저장 수준:** URL·Publishable Key는 이미 브라우저에 공개되는 설정이므로 Vercel Config로 관리 가능하다. Vercel의 저장 유형 Secret과 Supabase의 Secret Key는 다른 개념이다. 어느 저장 유형을 선택하든 Supabase Secret/service_role을 넣지 않는다.
7. **Preview 검증:** 승인 후 검토한 정확한 Git SHA에서 Preview 1건을 만든다. main push로 간접 배포하지 않고 대상이 Preview인지 명시적으로 확인한다. 보호 기능은 유지한다. 외부 Origin 403, 무인증 401, 가짜 토큰 401, GET 405, 미등록·내부 경로 404, no-store와 실계정 QA를 검사한다.
8. **Production:** Preview 결과·환경변수 이름/범위·실제 SHA·롤백 대상을 제시한 뒤 별도 승인을 받고 새 Production 배포를 수행한다. 설정만 바꾸면 기존 배포가 해결된다고 판단하지 않는다.

Vercel의 변수 변경은 새 배포에 적용된다. Shared 변경도 기존 배포의 런타임 값을 즉시 고친다고 가정하지 않는다. [환경별 적용·새 배포 정책](https://vercel.com/docs/environment-variables)

예상 영향: 기존 프런트엔드·Auth URL·DB/RLS·Notion 자료는 그대로 두고 서버 review가 설정 검사 다음 단계로 진행한다. API가 동작하면 호출량이 늘 수 있어 기존 분산 요청 제한 과제는 남는다. 설정·재배포 승인에 실제 데이터 쓰기·OAuth는 포함하지 않는다.

되돌리기: Preview 실패 시 Production을 건드리지 않고 중단한다. Production 문제 시 승인한 이전 배포로 alias/promotion을 되돌리는 절차와 새 변수의 환경 범위 원복을 함께 준비한다. 변수 삭제·원복만으로 현재 배포의 값이 즉시 바뀌지 않는다. 현재 기준 배포로 돌아가면 기존 UI는 기준 상태로 복귀할 수 있으나 review 503도 다시 나타날 수 있으므로 ‘완전 정상 버전’이라고 부르지 않는다. Shared 전체 삭제·수정으로 롤백하지 않는다.

## 10. 후속 승인안 — 현재 승인 요청·실행 아님

- **Preview 승인안:** 팀 PPLUS의 pplus에 필요한 두 변수의 전용 Preview/Development 범위 등록 또는 기존 연결 정리, 필요한 Preview Origin 설정, 검토 SHA의 Preview 1건 및 읽기 전용 QA. Shared가 이미 유효하면 변경 수를 줄여 다시 제시한다. 코드·Supabase/Notion 쓰기·Production·Git push 제외.
- **Production 승인안:** 성공한 Preview 결과를 첨부해 pplus의 두 필수 변수 Production 범위 적용, 같은 검토 코드의 Production 새 배포 1건, 읽기 QA 및 지정한 기준 배포로의 롤백 범위를 별도로 승인받는다. 실제 변경 값은 공개 보고서에 넣지 않는다.

이 승인안은 향후 변경 전에 구체 대상·SHA·Preview URL·필요 변수 수를 최신 상태로 갱신할 계획이다. 이번 작업의 읽기 전용 허용을 변경 승인으로 해석하지 않는다.

## 11. 설정 해결 후 실계정 QA 준비

모든 항목은 **이번 미실행**이다. 실제로 다른 Supabase 사용자 A/B와 기존 가상 설계만 사용한다. 같은 계정의 설계 A/B를 계정 격리로 사용하지 않는다.

| 순서 | 기대 결과 |
| --- | --- |
| A 본인 설계 | 정상 검토 가능한 기존 설계로 200, 저장 유형·모듈·DB/속성/관계 수 일치 |
| A→B·없는 UUID | B가 실제 소유·존재를 확인한 설계로 404, 없는 UUID와 동일한 안전한 본문 |
| B 본인·B→A | B 본인 200, 허가된 역방향 교차 요청 404 |
| 실제 저장 유형 | 존재하는 기본/일반/확장만 검사. 없는 유형·planner 없는 과거 설계가 없으면 해당 항목 미검증 |
| 반복·현재 기준 | 반복 해시 동일, 현재 수정 시각·올바른 기대 해시 200 |
| 오래된 기준 | 오래된 수정 시각 409, 올바른 형식의 다른 해시 409. 실제 저장본 수정 없음 |
| 실행 상태 | 모든 경우 웹 준비 false, Notion 실행 not_executed |

신원 확인은 안전한 개발 브라우저에서 각 계정의 세션으로 수행하고 사용자 UUID가 다른지 **일치 여부만** 기록한다. JWT·비밀번호·원본 설정을 채팅·로그·파일·스크린샷/HAR로 전달하지 않는다. 실제 세션에 접근할 수 없다면 검사 미실행을 유지한다. 기존 011C 보고서의 안전한 수동 코드도 활용할 수 있다.

## 12. 검증·보존·미검증

이번에 실제 수행: Vercel/Supabase 프로젝트 메타데이터·환경변수 이름 목록 조회, Production 503 재현, 공개 JS의 연결 대상 비교, readConfiguration의 메모리 검사 10사례, 소스·Git 비교.

기존 전체 Node 295개·V1 256조합 통과는 **011C에서 실제 실행한 결과**다. 이후 커밋 차이가 문서뿐임을 확인했고 이번에는 전체 검사를 재실행하지 않았다. 코드 수정이 없는 읽기 진단을 새 회귀 성공으로 포장하지 않는다.

미검증: Shared 연결·현재 Dashboard Root/Production Branch 원문·환경 변경 이력·배포별 실제 값, 정상 계정 200·A/B 격리·실제 계획/409, Preview 수정·검증, 새 Production 해결, OAuth PoC.

종료 상태: HEAD 동일, 신규 보고서·인계문 2개만 추가. 환경변수 값 출력·등록·수정·삭제, 새 배포, Supabase 데이터/SQL/Auth/RLS 변경, Notion 요청, 코드 수정, commit/push, 계정·키 발급은 모두 수행하지 않았다.
