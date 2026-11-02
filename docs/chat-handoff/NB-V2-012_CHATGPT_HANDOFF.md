# [ChatGPT 전달용] NB-V2-012 Notion 생성 계획 웹 Dry Run 구현 결과

## 1. 결론

PPLUS의 저장된 교육 설계를 서버에서 검증하고 Notion 생성 계획을 웹에서 미리보는 기능을 로컬 구현했습니다.

- **완료:** 신규 읽기 전용 API, 순수 계획 변환기, 기존 결과·입력·매핑 화면의 검토 패널, 자동 회귀 검사.
- **실계정 확인:** 기존 본인 테스트 설계 1개를 읽어 index/result 화면에서 검토 결과와 동일 해시를 확인했습니다.
- **부분 검증:** Chrome 데스크톱과 390×844 반응형 화면을 직접 확인했습니다. 실제 모바일 기기 검증은 아닙니다.
- **미검증:** 실제 두 사용자 간 신규 API 격리, 기본형·일반형 저장본의 실계정 검토, Vercel 배포 런타임.
- **미배포:** Git commit/push, Preview/Production 배포를 하지 않았습니다.
- **실행 미구현:** Notion 연결·토큰 조회·실제 생성은 수행하지 않았습니다.

## 2. Git과 변경 파일

시작/종료 브랜치 main, HEAD는 모두 `cb57fad31860464eb089194097af8d24c85b3206`입니다. 시작 작업 트리는 깨끗했고, 종료 시 수정 파일 8개·신규 코드/테스트 5개·문서 2개를 미커밋 상태로 남겼습니다. 기존 작업을 초기화하거나 덮어쓰지 않았습니다.

신규 파일:

- /Users/jsy/Desktop/EST_Project/api/notion/plans/review.mjs
- /Users/jsy/Desktop/EST_Project/server/notion/preview-handler.mjs
- /Users/jsy/Desktop/EST_Project/server/notion/preview-plan.mjs
- /Users/jsy/Desktop/EST_Project/js/notion-preview.mjs
- /Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/notion-preview.test.mjs

수정 파일:

- /Users/jsy/Desktop/EST_Project/index.html
- /Users/jsy/Desktop/EST_Project/mapping.html
- /Users/jsy/Desktop/EST_Project/result.html
- /Users/jsy/Desktop/EST_Project/css/drafts.css
- /Users/jsy/Desktop/EST_Project/js/drafts/ui.mjs
- /Users/jsy/Desktop/EST_Project/scripts/deployment/build-static.mjs
- /Users/jsy/Desktop/EST_Project/scripts/development/serve-review.mjs
- /Users/jsy/Desktop/EST_Project/scripts/notion-poc/tests/admin-ui.test.mjs

문서:

- /Users/jsy/Desktop/EST_Project/docs/research/NB-V2-012_REPORT.md
- /Users/jsy/Desktop/EST_Project/docs/chat-handoff/NB-V2-012_CHATGPT_HANDOFF.md

## 3. API와 보안

새 API는 POST /api/notion/plans/review입니다. 요청 본문은 draftId, expectedUpdatedAt, expectedPlanHash 세 필드가 모두 필수이며 다른 필드는 거절합니다.

브라우저의 configuration·user_id·Notion 토큰·부모 ID·임의 요청 본문·승인 플래그를 받지 않습니다. 기존 읽기 전용 Supabase 클라이언트로 Bearer 사용자를 확인하고, 사용자 UUID로 소유자를 제한하여 저장 설계를 조회합니다. 타인 설계와 없는 설계는 같은 404를 반환합니다.

저장본을 version 1로 정규화하고 계획을 재계산한 뒤 마이크로초 저장 시각과 논리 계획 해시를 비교합니다. 불일치는 409입니다. 기존 /api/drafts/review의 코드와 요청·응답 계약은 변경하지 않았습니다.

입력 최대 2,048바이트, 전체 속성 최대 100개, 속성별 옵션 최대 100개, 응답 UTF-8 최대 262,144바이트로 제한합니다. 초과 결과를 잘라서 성공 처리하지 않습니다.

정상 구조에 미지원 기능이 있으면 지원 범위를 포함한 200, 구조·변환 제한 오류는 422, 나머지는 400/413/415·401·403·404·409·5xx로 구분합니다. 모든 응답은 private/no-store 및 CDN no-store입니다. 내부 오류 상세를 반환하지 않습니다.

성공·오류 모두 다음 상태를 고정합니다:

    webExecutionReady: false
    notionExecution: "not_executed"
    notionRequests: 0
    supabaseWrites: 0
    targetVerified: false

## 4. 계획 변환과 해시

서버 순수 변환기는 교육 페이지명, DB/Data Source, 속성 이름·유형, Select/Multi-select 옵션과 색상, 관계·Rollup·Formula, 의존 순서, coverage/blockers/confirmationItems를 만듭니다.

원문 폼·CSV 응답 행·questionName/rawText/sourceRefs·사용자가 작성한 reviewReasons·세션/토큰·Notion 요청 템플릿은 제외합니다. 필요한 속성명·옵션명만 표시합니다. db:…, ds:…, page:root는 논리 참조이며 원격 ID를 만들어 넣지 않습니다.

- planHash: 기존 canonical SHA-256 논리 계획 해시 유지.
- updatedAt: 기존 BigInt 마이크로초 비교 유지.
- compilationHash: executionPlanVersion=1, adapterVersion=notion-preview-v1, API 버전, 저장 설계 ID·변경 시각·planHash·페이지명·안전한 spec·지원 범위·차단/확인 항목의 결정적 SHA-256.

같은 저장본은 같은 변환 해시를 반환합니다. 제목 또는 저장 시각만 바뀌어 기존 planHash가 같더라도 compilationHash는 달라집니다. 해시를 권한 검사나 생성 승인으로 사용하지 않습니다. nonce·승인 저장·실행 기능은 구현하지 않았습니다.

## 5. 지원 범위

- 기본형: 신청·참가 기록 1DB의 논리 구조와 속성·옵션·색상.
- 일반형: 사람·프로그램·신청 3DB의 관계·계산 계획. 교육생·출석·일정 3DB가 아닙니다.
- 확장형: 기존 선택 모듈과 의존 모듈의 DB·관계·계산을 표시하고 웹 실행 미지원 blocker를 제공합니다.
- 기본형 CLI: 기존 순수 구조 검사 결과를 표시하며, 이번 저장본의 원격 실행 검증을 의미하지 않습니다.
- 일반형 CLI: 고정 가상 7행 전용 제약을 명시합니다. 임의 저장본의 웹 실행이 가능하다고 판정하지 않습니다.
- Status 등 CLI 미지원 유형, V1 추가 항목, 선정 교육생·일정·교육생 KPI·사용자 정의 KPI는 coverage/blockers에 표시합니다.
- 신청 통계를 선정 교육생 KPI로 표현하지 않습니다. 실제 행·계산값은 포함하지 않습니다.
- 모든 구성의 실제 웹 실행은 미지원입니다.

## 6. UI와 상태 관리

기존 result.html 안에 접이식 ‘Notion 생성 계획’을 추가했습니다. 구조화된 Planner 편집 화면인 index.html과 mapping.html에도 같은 모듈을 적용했습니다. 별도 페이지나 생성 실행 버튼은 없습니다.

사용자는 저장된 본인 설계를 열고 ‘저장된 설계 검토’를 누릅니다. 먼저 기존 서버 검토에서 planHash를 얻은 뒤 새 API에 세 필드로 요청합니다.

안내 문구:

> 현재는 Notion 생성 계획을 미리 확인하는 단계입니다. 실제 Notion 페이지나 데이터베이스는 생성되지 않습니다.

새 설계·미저장 편집·분석하지 않은 CSV는 검토를 막습니다. 자동 저장은 하지 않습니다. 편집·저장·설계 전환 시 기존 결과를 무효화하고, 설계 ID·저장 시각·로컬 revision·요청 순번·사용자 ID로 늦은 결과를 차단합니다. 로그아웃 시 요청과 표시 내용을 정리합니다. 409는 최신 설계 다시 열기, 통신 오류는 입력 유지·재시도로 안내합니다.

속성명 등은 textContent로 표시하고 옵션 색상은 고정 색상표로만 렌더링합니다. UI-003~007의 로그인·브랜드·헤더·관리자 디자인과 권한 코드는 변경하지 않았습니다.

## 7. 자동 검사 결과

이번 최종 실행:

    node --test --test-concurrency=1 scripts/notion-poc/tests/*.test.mjs

**362개 통과, 실패 0, 건너뜀 0**입니다. 기존 326개와 신규 36개이며, V1 256조합 검사도 전체 실행에 포함되어 통과했습니다.

확인 범위: 세 구성 변환, 옵션 색상, 관계·계산 참조, 과거 v1, 제목·마이크로초·해시 변경, 요청 필드/크기/Origin/Auth, A/B 양방향 모의 격리, 텍스트 렌더링, 계정·설계 전환/로그아웃/지연 저장 및 통신 응답, 기존 API·Auth·저장·매핑·색상·Notion CLI 회귀입니다.

공개 빌드는 30→31개로 변경됐습니다. 추가 공개 파일은 브라우저용 js/notion-preview.mjs 하나입니다. 서버·API 소스·CLI·문서·환경 파일은 제외됩니다. localhost에서 새 API POST 200, GET 405와 비공개 파일 404를 확인했고, 구문 검사·git diff --check·원본 JPEG 일치 검사를 통과했습니다.

첫 집중 검사에서는 옵션 가상 자료의 localId 누락을 수정했습니다. 첫 전체 병렬 검사에서는 여러 테스트가 같은 public-dist를 재생성해 실패했습니다. 새 테스트의 빌드를 별도 임시 폴더로 분리하고 최종 전체 순차 실행으로 통과를 확인했습니다. 기존 공유 빌드 테스트의 병렬 실행 간섭 가능성은 남아 있습니다.

## 8. 실제 계정과 Chrome 검증

새 로컬 주소는 [로컬 교육 설계 화면](http://127.0.0.1:8796/index.html)입니다. 기존 8795 서버는 유지했습니다. 검토 handler에 기존 공개 Supabase 설정을 메모리로 전달했으며 환경 파일·원격 변수는 변경하지 않았습니다.

Chrome의 정상 로그인 세션으로 기존 본인 ‘NB-V2-010A 저장 테스트 A’를 열었습니다. 저장 버튼을 누르지 않았습니다. index.html과 result.html에서 서버 검토 완료를 확인했습니다.

실제 반환 결과:

- 확장형, DB 6개, 속성 36개, 관계 8쌍, Rollup 2개, Formula 3개.
- 사람·프로그램·신청·참여/수강·출석·팀 구성과 웹 실행 미지원 안내 표시.
- 반복 검토 및 결과 화면 이동 후 두 해시 일치.
- planHash: f11571f3ed7b13c013514b1e4475cbca7b8235c9b6123d9354ba8f4a30029a0f
- compilationHash: fe11ae5f1a2bc38aa96cc4fff296f0ea867c6881e5b07f130f581200ff405f45

완료 UI는 두 API 성공 응답·스냅샷·실행 비활성 플래그 검사 후 표시됩니다. 비밀번호·JWT·쿠키를 추출하거나 Network 패널에서 인증 원문을 열지 않았습니다.

실제 Chrome 데스크톱과 DevTools 390×844 반응형 보기에서 카드·옵션 색상 점·안내·긴 ID/해시 줄바꿈을 직접 검토했습니다. 캡처 범위에서 겹침과 가로 잘림은 보이지 않았습니다. scrollWidth 수치 측정과 실제 모바일 기기 검증은 하지 않았습니다.

캡처 파일은 JPEG이며 전체 Chrome 창 2940×1666px입니다. 모바일 파일은 그 창 안의 390×844 에뮬레이션을 보여줍니다.

- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-012/real-extended-summary.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-012/real-extended-support.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-012/real-result-options-desktop.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-012/real-result-mobile-390x844-options.jpg
- /Users/jsy/Documents/Codex/2026-11-02/pplus-ui-005-http-127-0/screenshots/nb-v2-012/real-result-mobile-390x844-support.jpg

Finder/미리보기로 열거나 ChatGPT에 첨부할 수 있습니다. 캡처는 Git·공개 빌드에 포함하지 않았습니다. 별도 가상 렌더러 서버는 종료했고 가상 화면을 실계정 증거로 사용하지 않았습니다. 실제 검토용 8796과 기존 8795 서버는 유지했습니다.

## 9. 미검증과 남은 위험

- 실제 서로 다른 두 Supabase 사용자 사이의 신규 API 격리는 미검증이며 모의 검사만 통과했습니다. 같은 계정의 설계 A/B를 사용자 격리 증거로 보지 않습니다.
- 실제 기본형·일반형 저장본, 실제 409 충돌·계정 전환/로그아웃 중 지연 응답은 미검증입니다. 기존 데이터를 수정해 테스트하지 않았습니다.
- mapping.html 신규 패널의 실제 시각 검토는 미검증이며 자동 검사로만 확인했습니다.
- 실제 모바일 기기 및 고정 1440×900·1280×800·360×780 검증은 수행하지 않았습니다.
- 로컬 검토 전용 서버의 관리자 handler에는 연결 설정을 주입하지 않아 관리자 버튼의 실사용 QA는 하지 않았습니다. 기존 코드·자동 검사는 유지됐습니다.
- Vercel 빌드·Functions 배포 런타임·운영 UI 반영은 미검증/미배포입니다.
- Notion 대상·토큰·권한은 확인하지 않았습니다. compilationHash는 생성 승인 증거가 아닙니다.

## 10. 변경하지 않은 원격 환경

- Supabase education_drafts 업무 데이터 쓰기 0건, SQL·RLS·Auth 설정·역할 변경 0건.
- Notion API 요청·쓰기·토큰 조회 0건.
- Git commit/push 0건, HEAD 유지.
- Vercel 조회·배포·환경변수·alias 변경 0건.
- 기존 인증·관리자 권한 검사·configuration/schema version 1·Planner planVersion 1·저장·매핑·색상·CLI·manifest는 보존했습니다.

쓰기 0건은 이번 수행 동작·읽기 전용 코드·메서드 강제 모의 검사에 대한 기록입니다. 원격 서비스 전체 요청 로그를 감사했다는 뜻은 아닙니다.

## 11. ChatGPT 검토와 다음 작업 결정 요청

1. 저장된 본인 설계만 검토하는 API와 기존 API 계약 보존이 적절한지 검토해 주세요.
2. planHash·마이크로초 updatedAt·compilationHash의 역할 및 생성 승인과의 구분을 평가해 주세요.
3. 일반형 신청 도메인과 교육생·출석·일정 운영 도메인의 구분, 미지원 모듈/KPI 표시가 충분한지 확인해 주세요.
4. 실제 확장형 1개 검증, 자동 모의 검사, 미검증 실계정 항목을 구분해 주세요.
5. 실제 두 계정 격리·기본/일반형 실계정 QA를 먼저 보완할지, NB-V2-013 읽기 전용 개인 테스트 연결로 진행할지 결정해 주세요.
6. NB-V2-013은 개인 테스트 사용자 UUID·워크스페이스·비공개 부모 페이지 제한, 서버 전용 자격 증명 관리, 읽기 전용 접근 확인, 다른 사용자 차단까지만 제안합니다. 실행은 비활성화하고 토큰 설정·원격 변경·배포는 별도 승인 범위로 정해 주세요.
7. 실제 생성 승인·실행 기록·중복 방지·부분 실패 관리는 NB-V2-014 이후로 분리해 주세요.

완료·부분 검증·미검증을 구분하고, 이번 결과를 실제 Notion 생성 성공이나 운영 배포 완료로 판단하지 마세요.
