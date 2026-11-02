# [NB-V2-012 작업 보고서] Notion 생성 계획 웹 Dry Run

작성일: 2026-11-02 (Asia/Seoul)

## 1. 판정과 작업 범위

**로컬 구현 완료. 실제 본인 테스트 설계 읽기와 Chrome 결과 표시 확인. 미배포. Notion 연결·생성은 미구현.**

- 시작/종료 브랜치: `main`.
- 시작/종료 HEAD: `cb57fad31860464eb089194097af8d24c85b3206`.
- 시작 작업 트리: 깨끗함. 종료: 수정 8개·신규 코드/테스트 5개·신규 문서 2개, 모두 미커밋.
- checkout/reset/clean, commit/push, Vercel 조회·배포·설정 변경을 수행하지 않았다.
- Supabase 업무 데이터 쓰기·SQL·RLS·Auth 설정 변경 0건. Notion 요청·쓰기·토큰 조회 0건.
- 기존 로고 JPEG의 SHA-256이 HEAD와 일치한다: `c1f8a47e16a950e0aa55b5ded53818b576a14585f6e940006716ac07dd867d98`.

## 2. 조사 결과와 구현 결정

NB-V2-011 아키텍처·보고·인계 문서와 실제 코드를 확인했다. 기존 `/api/drafts/review`는 인증·소유권·마이크로초 시각·논리 계획 해시 검사를 이미 제공한다. 이 API의 요청/응답이나 기존 서버 파일은 변경하지 않았다.

현재 구조화된 Planner 편집은 `index.html`/`mapping.html`, 기존 V1 Mock 결과는 `result.html`에 있다. 요청대로 결과 화면에 패널을 추가하고, 같은 저장본을 검토할 수 있도록 입력·매핑 화면에도 동일 모듈을 적용했다. 별도 페이지나 실제 생성 버튼은 추가하지 않았다. V1 샘플의 교육생·출결·일정 구성과 서버의 신청 기반 계획을 명확히 구분한다.

## 3. 변경 파일

프로젝트 루트: `/Users/jsy/Desktop/EST_Project`.

신규:

- `api/notion/plans/review.mjs`: Vercel 네이티브 fetch 진입점.
- `server/notion/preview-handler.mjs`: 엄격한 요청 검사, 요청별 인증·소유권·충돌 검사.
- `server/notion/preview-plan.mjs`: 순수 변환, 지원 범위·차단 사유·확인 항목, 변환 해시.
- `js/notion-preview.mjs`: 미리보기 제어·텍스트 기반 렌더링·계정/설계/요청 상태 격리.
- `scripts/notion-poc/tests/notion-preview.test.mjs`: 신규 회귀 검사 36개.

수정:

- `index.html`, `mapping.html`, `result.html`: 접이식 패널과 브라우저 모듈 참조.
- `css/drafts.css`: 패널·옵션 색상 점·긴 해시 줄바꿈에 한정한 스타일.
- `js/drafts/ui.mjs`: 기존 workspace의 `subscribe`, 저장 없는 `captureForReview`를 노출.
- `scripts/deployment/build-static.mjs`: 브라우저 모듈 1개 allowlist 추가, 30→31개.
- `scripts/development/serve-review.mjs`: 신규 API 로컬 라우팅과 handler 주입 추가.
- `scripts/notion-poc/tests/admin-ui.test.mjs`: 실제 공개 파일 개수만 31개로 갱신. 기존 권한 테스트 유지.

문서:

- `docs/research/NB-V2-012_REPORT.md`.
- `docs/chat-handoff/NB-V2-012_CHATGPT_HANDOFF.md`.

## 4. 신규 API 계약

`POST /api/notion/plans/review`, `Content-Type: application/json`, `Authorization: Bearer …`.

필수 본문은 정확히 세 필드다: `draftId`(UUID), `expectedUpdatedAt`(최대 마이크로초 정밀도), `expectedPlanHash`(SHA-256 64자리). 필드 누락·추가를 모두 거절한다. configuration, 소유자, Notion 토큰·부모 페이지 ID·임의 요청·승인 플래그를 받지 않는다.

처리 순서: 크기/JSON/필드 검사 → Bearer 형식 검사 → 기존 읽기 전용 클라이언트로 현재 사용자 확인 → 소유자 조건을 포함해 `education_drafts` 조회 → version 1 정규화·계획 재계산 → 최신 저장 시각/해시 일치 검사 → 미리보기 변환.

입력 2,048바이트, 전체 속성 최대 100개, 속성별 옵션 최대 100개, 응답 UTF-8 최대 262,144바이트로 제한한다. 초과 시 잘라서 성공 처리하지 않는다. 이 제한은 이번 미리보기의 제한이며 모든 Notion API 제한의 설명은 아니다.

성공 응답에는 `reviewVersion`, `executionPlanVersion`, `adapterVersion`, `notionApiVersion`, `draftId`, `updatedAt`, `planHash`, `compilationHash`, `templateType`, `reviewStatus`, `preview`, `coverage`, `blockers`, `confirmationItems`가 포함된다. `preview`에는 페이지명, DB/DS, 속성·옵션·색상, 양방향 관계, Rollup, Formula의 논리 참조와 의존 순서가 있다.

성공·오류 응답 모두 다음 값을 고정한다:

    webExecutionReady: false
    notionExecution: "not_executed"
    notionRequests: 0
    supabaseWrites: 0
    targetVerified: false

상태 코드는 정상 계획(미지원 기능 포함) 200, 잘못된 요청 400/413/415, 인증 401, Origin/권한 403, 타인·없는 설계 동일한 404, 저장본 충돌 409, 구조·미리보기 제한 422, 안전하게 축약된 서버 오류 5xx다. `Cache-Control: private, no-store, max-age=0`, CDN/Vercel CDN no-store, `Vary: Authorization, Origin`, nosniff를 적용한다. 교차 Origin 허용 헤더를 추가하지 않는다.

## 5. 변환·해시·보안

- `compilePreview`는 네트워크 호출 없이 저장본의 허용된 설정을 논리 계획으로 재계산한다. 기존 순수 계획 도구만 재사용하며 Notion 실행기·클라이언트는 호출하지 않는다.
- 기존 `reviewSavedDraft`의 canonical SHA-256 `planHash`를 유지한다.
- `updatedAt`은 기존 BigInt 마이크로초 비교를 재사용한다.
- `compilationHash`는 executionPlanVersion=1, adapterVersion=`notion-preview-v1`, Notion API 버전, 설계 ID·저장 시각·planHash·페이지명·안전한 preview spec·coverage·blockers·확인 항목을 canonical SHA-256으로 묶는다.
- 교육명만 바뀌면 기존 planHash가 같을 수 있지만 compilationHash가 바뀐다. 저장 시각만 1마이크로초 바뀌어도 compilationHash가 바뀐다. 해시는 권한이나 생성 승인 수단이 아니다.
- 원문 폼, CSV 행, questionName/rawText/sourceRefs, 사용자 작성 reviewReasons, 요청 템플릿, 토큰·세션, 원격 오류 상세는 응답에서 제외한다. 미리보기에 필요한 속성명·옵션명은 반환한다.
- 원격 ID를 만들지 않는다. `db:…`, `ds:…`, `page:root` 등은 로컬 논리 참조다. 원격 대상은 미확인이다.
- Formula→Rollup 등 계산 의존성은 기존 검증기의 `calculationOrder`로 단일 계산 단계를 구성한다.
- 브라우저 렌더러는 textContent와 DOM 생성만 사용한다. 옵션 색상은 고정 색상표에서만 선택한다.

## 6. 지원 범위

| 구분 | 이번 결과 | 실제 웹 실행 |
|---|---|---|
| 기본형 | 신청·참가 기록 1DB, 속성·옵션·색상 | 미지원 |
| 일반형 | 사람·프로그램·신청 3DB, 관계·계산의 논리 정의 | 미지원 |
| 확장형 | 기존 모듈 및 의존 모듈의 DB·관계·계산 표시 | 미지원 |
| 기본형 CLI | 지원 유형·확인 조건 충족 시 기존 순수 구조 검사 결과 제공 | 이 저장본 원격 실행은 미검증 |
| 일반형 CLI | 고정 가상 7행 전용 제약 안내; scopeCompatible과 실행 검증 구분 | 임의 저장본 실행기는 없음 |
| Status 등 CLI 미지원 유형 | coverage와 blocker에 표시; 정상 구조면 200 | 미지원 |
| 교육생·일정·교육생 KPI·사용자 정의 KPI | 미지원 범위를 명시 | 미지원 |
| V1 추가 항목 | 선택값을 coverage에 기록하고 직접 변환되지 않음을 안내 | 미지원 |

일반형은 교육생·출석·일정 3DB가 아니다. 신청 건수는 고유 교육생 수나 선정 교육생 KPI가 아니다. 사용자 정의 KPI를 저장된 것처럼 가정하거나 임의 생성하지 않았다.

## 7. UI·상태 처리

- 세 기존 화면의 `Notion 생성 계획` 패널에 “현재는 Notion 생성 계획을 미리 확인하는 단계입니다. 실제 Notion 페이지나 데이터베이스는 생성되지 않습니다.”를 표시한다.
- `저장된 설계 검토`만 제공한다. 먼저 기존 API에서 저장본 planHash를 얻고, 새 API에 필수 세 필드로 요청한다.
- 새 설계·미저장 수정·분석하지 않은 CSV를 거절한다. capture는 편집 상태를 기존 workspace에 반영할 뿐 원격 저장하지 않는다.
- workspace 구독과 입력 이벤트로 기존 결과를 무효화한다. 저장 응답 이후에도 사용자 편집이 있으면 기존 dirty 상태 보존 동작을 유지한다.
- 설계 ID·저장 시각·로컬 revision·dirty·요청 순번과 인증 사용자 ID를 확인한다. 늦은 이전 설계 결과와 계정 변경 결과는 표시하지 않는다.
- 로그아웃 이벤트에 DOM과 요청을 정리한다. 409는 최신 저장본 다시 열기 안내, 통신 실패는 기존 입력 유지·재시도 안내를 표시한다.
- UI-003~007의 인증·로고·헤더·관리자 화면과 서버 역할 판정 코드는 수정하지 않았다.

## 8. 자동 검사

최종 실행:

    node --test --test-concurrency=1 scripts/notion-poc/tests/*.test.mjs

**362개 통과 / 실패 0 / 건너뜀 0**: 기존 326개 + 신규 36개. V1 256조합 검사가 이 전체 검사에 포함되어 통과했다.

추가 검사는 기본/일반/확장 변환, 색상, 참조·의존성, 과거 v1, 제목·마이크로초·해시 충돌, A/B 양방향 모의 격리, 필수 필드·금지 필드·크기·JSON·Origin·Auth·에러 축약, 텍스트 렌더링, 입력·계정·설계 전환·로그아웃·늦은 저장/네트워크 응답, 공개 경로 차단을 다룬다. 모의 fetch는 Supabase GET만 허용하고 다른 도메인·메서드 사용 시 실패한다.

공개 빌드 31개, HTML 참조 검사, 실제 localhost API 200/GET 405, 서버·CLI·환경파일·문서 404, 신규/관련 JS 구문 검사와 `git diff --check`를 통과했다. 기존 Auth·저장·매핑·색상·CLI 테스트도 전체 실행에 포함됐다.

발견/수정 사항:

1. 첫 집중 검사에서 옵션 가상 자료에 필수 localId가 누락되어 422가 발생했다. 실제 저장 모델에 맞게 테스트 자료를 수정했다.
2. 첫 전체 병렬 검사에서 기존/신규 테스트가 같은 public-dist를 재생성하며 조회 503 및 빌드 실패가 발생했다. 신규 테스트의 빌드를 독립 임시 폴더로 바꾸고, 기존 테스트의 공유 폴더 간섭은 최종 전체 순차 실행으로 피했다. 기존 공유 빌드 테스트를 병렬 실행하면 간섭 가능성은 여전히 있다.

## 9. 실계정·Chrome 검증

기존 8795 서버는 유지하고 8796에 새 읽기 전용 서버를 실행했다. 저장소의 기존 공개 Supabase URL/Publishable Key만 해당 두 검토 handler에 메모리로 전달했다. 환경 파일·Vercel 환경변수는 변경하지 않았다. 사용자 브라우저의 정상 로그인 세션을 애플리케이션이 내부적으로 사용했다. 비밀번호·JWT·쿠키를 추출·출력하지 않았다.

실제 확인:

- Chrome에서 `http://127.0.0.1:8796/index.html` 정상 로그인 화면/기존 세션 사용.
- 본인 목록의 기존 `NB-V2-010A 저장 테스트 A` 열기. 원격 저장 버튼 미사용.
- 새 검토 패널 완료 표시. 실제 결과: **6DB / 속성 36 / 관계 8쌍 / Rollup 2 / Formula 3**.
- 참여·수강·출석·팀 DB 및 미지원 안내 표시.
- 반복 검토와 `result.html` 이동 후 재검토에서 동일 해시 확인.
- planHash: `f11571f3ed7b13c013514b1e4475cbca7b8235c9b6123d9354ba8f4a30029a0f`.
- compilationHash: `fe11ae5f1a2bc38aa96cc4fff296f0ea867c6881e5b07f130f581200ff405f45`.
- 완료 UI는 기존/신규 API의 성공 응답과 스냅샷·실행 비활성 플래그 검사 후에만 표시된다. Network 패널의 토큰/응답 원문은 열지 않았다.
- 데스크톱 현재 Chrome 창과 DevTools **390×844 반응형 보기**에서 실제 저장본을 확인했다. 이는 실제 모바일 기기 검증이 아니다.
- 옵션 색상 점·텍스트, DB 카드, 안내·긴 논리 ID·해시 줄바꿈에 캡처 범위상 겹침·가로 잘림은 보이지 않았다. scrollWidth 수치 검사는 하지 않았다. DevTools는 일반 보기로 복원했다.

캡처는 모두 JPEG, 전체 Chrome 창 2940×1666px이다. 모바일 파일은 해당 전체 창 안의 390×844 에뮬레이션을 보여주며 원본 파일 자체가 390×844인 것은 아니다.

캡처 디렉터리: `/Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-012/`.

- `real-extended-summary.jpg`
- `real-extended-support.jpg`
- `real-result-options-desktop.jpg`
- `real-result-mobile-390x844-options.jpg`
- `real-result-mobile-390x844-support.jpg`

이 이미지는 Finder/미리보기로 열고 ChatGPT에 첨부할 수 있다. Git/공개 빌드에 포함되지 않는다.

별도로 8797에 원격 호출 없는 가상 렌더러 서버를 준비했으나, 실제 인증 세션 검증이 가능해져 가상 화면 캡처는 수행하지 않았고 해당 서버는 종료했다. 이를 실계정 근거로 사용하지 않는다. 실제 검토용 8796과 기존 8795 서버는 유지했다.

## 10. 미검증·남은 조건

- 실제 두 Supabase 사용자 간 신규 API 접근 격리: 이번에는 미검증. 자동 검사만 양방향 통과. 같은 계정의 테스트 설계 A/B는 사용자 격리 증거가 아니다.
- 실제 기본형·일반형 저장본의 신규 API 검토, 실제 409 충돌/실계정 전환·로그아웃 중 지연 결과: 미검증, 자동 검사로만 확인. 이를 위해 기존 저장본을 수정하지 않았다.
- mapping.html의 신규 패널 실제 화면: 자동 검사만 확인. index/result 실제 화면은 확인했다.
- 실제 모바일 기기, 고정 1440×900·1280×800·360×780 화면: 이번에는 미검증.
- 로컬 관리자 API는 이 검토 전용 서버의 기본 process 환경에 연결 설정을 주입하지 않았으므로 관리자 링크 실사용 검증 대상으로 삼지 않았다. 기존 관리자 코드/테스트는 보존했다.
- Vercel 원격 빌드·Functions 런타임·Preview/Production: 미검증/미배포. 정적 빌드 및 로컬 네이티브 fetch 라우팅은 확인했다.
- 원격 전체 DB 감사/요청 로그를 열지 않았으며, 쓰기 0건은 이번 수행 동작·읽기 전용 코드·메서드 강제 모의 검사에 대한 기록이다.

## 11. NB-V2-013 제안

다음 작은 범위는 개인 테스트 사용자 UUID·워크스페이스·비공개 테스트 부모를 명시적으로 제한하는 읽기 전용 연결 확인이다. 사용자별 설계 소유권과 별개로, 다른 사용자가 개인 공용 토큰을 사용할 수 없도록 서버에서 차단해야 한다.

토큰의 서버 전용 관리와 공개 빌드 제외, 테스트 대상 권한 재조회, 연결 미준비/접근 거절 UI, 타 사용자 차단 테스트를 먼저 정의한다. 이번 작업에서는 토큰을 조회하거나 설정하지 않았다. 연결·원격 쓰기·배포 승인은 후속 범위로 분리한다. 생성 승인/nonce/실행 이력/중복 방지는 NB-V2-014 이후 별도 설계·승인이 필요하다. compilationHash를 승인 토큰으로 사용하지 않는다.
