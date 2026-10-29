# [ChatGPT 전달용] NB-V2-003 구현 결과 및 다음 개발 검토 요청

기준일 2026-10-29 / EST_Project. ChatGPT는 기획·검토, Codex는 구현·검증을 담당한다. 목표는 AI 없는 규칙 기반 교육 운영 Notion 대시보드 빌더다.

## 이전 상태와 이번 목표

V1은 HTML/CSS/바닐라 JS Mock 설계 화면이다. 별도 Node.js 22+ Notion CLI는 NB-V2-002A에서 개인 Free 테스트 DB 6개·가상 행 16개·관계/수식/롤업·출석률 75→100%를 실제 검증했다. 당시 로컬 검사 37개였다. Business Dashboard는 아직 미검증이다.

사용자는 Vercel 배포 완료·Supabase 미연결·개인 Free 개발·Business 검증 연기를 명시했다. 이번 목표는 옵션 색상, 네이버 폼/CSV 헤더 매핑·편집, Vercel 상태 점검이다. 시작은 main/8169eca clean, 종료도 같은 HEAD이며 커밋·push·배포는 하지 않았다.

## 실제 구현과 변경 파일

별도 mapping.html과 기존 입력 화면 링크를 추가했다. 브라우저에서 폼 질문·CSV 헤더를 분석하고 원본 질문/CSV/최종 Notion 이름을 구분해 편집한다. 기본 운영 속성은 새 폼 속성과 구분한다. 유형·대상 DB·CSV 연결·옵션명/색상/Status 그룹·포함 여부를 수정하고 속성/옵션을 추가할 수 있다. 검증·미리보기·모델/스키마 JSON 저장을 제공한다. 데이터는 메모리에만 두며 JSON 재불러오기 UI는 없다.

변경 파일:
- `docs/notion-poc/README.md`
- `index.html`
- `scripts/notion-poc/engine.mjs`
- `scripts/notion-poc/schema.mjs`
- `css/mapping.css`
- `docs/mapping/DEPLOYMENT_AUDIT.md`
- `docs/mapping/EXAMPLE_FORM.txt`
- `docs/mapping/EXAMPLE_HEADERS.csv`
- `docs/mapping/EXAMPLE_MAPPING_MODEL.json`
- `docs/mapping/NB-V2-003_CHATGPT_HANDOFF.md`
- `docs/mapping/NB-V2-003_REPORT.md`
- `docs/mapping/README.md`
- `js/mapping-ui.mjs`
- `js/mapping/csv.mjs`
- `js/mapping/model.mjs`
- `js/mapping/parse.mjs`
- `mapping.html`
- `scripts/notion-poc/mapping-dry-run.mjs`
- `scripts/notion-poc/tests/mapping.test.mjs`

주요 모듈은 js/mapping/model.mjs(표준 모델/검증/스키마/기존 옵션 보존/색상 대조), parse.mjs(폼/사전/병합), csv.mjs(첫 헤더 레코드), js/mapping-ui.mjs(편집), scripts/notion-poc/mapping-dry-run.mjs(공유 모델 CLI)다.

## 색상 구현 결과

허용 색상 10개만 사용한다. 접수 blue·선정 green·대기 yellow·미선정 gray·취소 red, 수료 green·미수료 red·수료 대기 yellow, 예정 gray·진행 중 blue·완료 green을 기본 추천한다. Select/Multi-select/Status에 사용자 색상을 지정할 수 있다. Status는 To-do/In progress/Complete의 옵션 배치만 지원하고 그룹 자체 변경은 제공하지 않는다.

기존 옵션 업데이트용 순수 함수는 모든 기존 옵션 ID를 보존하며 추천 색상이 기존 사용자 색상을 덮어쓰지 않게 한다. 명시적 사용자 색상 변경만 적용한다. 기존 옵션 이름 변경은 거부하고 Notion UI 처리로 남기며 중복/잘못된 색상/알 수 없는 ID도 막는다. 이 함수는 실제 PATCH 경로에 연결하지 않았다.

고정 PoC의 신규 Select에도 추천 색상을 넣고 실제 스키마 재조회에서 색상을 대조하도록 엔진을 보완했다. 과거 색상 없는 완료/부분 완료 실행 지문은 API 없이 재사용해 기존 DB를 변경하지 않는다. 기존 수료 checkbox·수식·관계는 유지했다. 새 화면의 수료 상태 Select는 신규 모델용이다.

## 폼·CSV 매핑 결과

번호형 질문·선택지·필수 표식·명시적 단일/복수 선택을 파싱한다. 성명/연락처/이메일/연령대/유형/과정/동기/기대사항/유입/선정의 사전을 사용한다. 불확실한 선택 수·알 수 없는 질문/본문은 확인 필요로 남기고 원문·안내문을 보존한다. 자유 형식 전체를 완벽하게 해석하는 기능이 아니다.

CSV는 브라우저에서 1 KiB 청크, 최대 헤더 64 KiB까지 읽고 첫 레코드에서 중단한다. 청크에 포함된 응답 바이트는 헤더 종료 뒤 디코딩/파싱/보존하지 않는다. UTF-8/BOM, 명시적 EUC-KR/CP949, 인용부호·쉼표·따옴표 안 줄바꿈을 처리하고 빈/중복 컬럼은 위치와 원본을 남긴다. 잘못된 인코딩/인용부호/크기 초과는 거부한다. 실제 응답 행 업로드·로그·삽입은 없다.

정확한 정규화명 또는 사전 별칭이 유일할 때만 추천 연결한다. 긴 유입 경로 질문↔CSV 유입 경로↔Notion 유입 경로 예시를 검사했다. 다중 후보나 여러 질문은 자동 합치지 않는다. CSV만 있는 속성은 사용자 확인이 필요하다.

가상 예시 질문 5개와 기본 속성 3개를 합한 8개 표준 속성이 4 DB용 스키마로 출력된다. 폼 필수 정보는 Notion 필수 제약이 아니라 메타데이터다.

## 엔진 연결과 검증 범위

입력→공유 표준 모델→유효성 검사→새 DB 스키마 JSON까지 연결했다. 내부 localId와 실제 Notion ID를 구분한다. DB별 제목이 없으면 충돌 없는 title을 보충하고 중복 제목/이름/옵션/CSV 연결을 검사한다. 확인 필요 행은 스키마 출력을 막는다.

출력은 mode=new-data-sources-only, networkRequests=0이다. 화면에서 저장한 모델을 mapping-dry-run CLI가 같은 모듈로 검사한다. 새 매핑을 실제 apply에 전달하거나 기존 DB에 PATCH하는 연결, 관계/KPI 결합·행 삽입은 미구현이다.

검사 명령:
- node --test scripts/notion-poc/tests/*.test.mjs
- node scripts/notion-poc/mapping-dry-run.mjs docs/mapping/EXAMPLE_MAPPING_MODEL.json
- node scripts/notion-poc/cli.mjs dry-run --view-profile free

결과: 60개 통과/0실패(기존 37+신규 23). V1 Mock 256개 조합 포함. 기존 실제 nb-v2-002a manifest도 API 0회 재사용을 확인했다. 이번 Notion 콘텐츠 API 호출/쓰기 0회이며 실제 색상 반영을 검증한 것은 아니다.

Chrome에서 로컬 화면 로딩·기본 색상/그룹 컨트롤 표시를 확인했다. 이후 사용자 브라우저 동시 활동 감지로 조작 검사가 중단돼 파일 선택/편집/다운로드 전체 브라우저 동선·모바일 시각 검사는 미검증이다. 처리 로직의 자동 검사를 브라우저 E2E 성공으로 간주하지 말아 달라.

## Vercel·Supabase·보안

제공 URL https://pplus-jr6959pvz-pplus1.vercel.app 은 공개 HTTPS 요청에서 302 Vercel 인증/SSO로 이동했다. 운영 화면·배포 커밋·기능은 미확인이다. 로컬은 정적 V1/매핑 화면+별도 Node CLI이고 Functions/api/package.json/vercel.json/.vercel/project.json은 없다. origin은 GitHub EST_Project다. Vercel Git 연결/Production Branch/빌드·출력 폴더/환경변수/자동 배포는 로컬만으로 확인하지 못했다. Git push가 배포로 이어질 수 있으므로 이번에는 push하지 않았다.

Supabase는 코드/설정/의존성에 적용하지 않았다. 외부 계정의 프로젝트 존재 여부와 저장소 연결은 별개다. AI API·로그인·공개 쓰기 API·회사 데이터 접근·Business 테스트·운영 설정 변경도 없다.

.env/실행 상태는 Git 제외, 토큰은 웹 코드에 넣지 않았다. 운영 산출물까지 안전하다고 확인한 것은 아니다. 향후 서버 전용 비밀과 환경 분리, 인증/대상 소유권/입력 검사/요청 제한, 영구 실행 상태/중복 방지 설계가 필요하다. 로컬 파일 잠금을 서버리스 영구 상태로 사용할 수 있다고 가정하면 안 된다. Hobby의 회사/상업적 이용 조건도 실사용 전에 검토해야 한다.

## 기존 기능 영향·남은 위험·추천

V1 JS/공통 CSS/결과 화면·기존 수식/관계/fixture는 보존했다. index에는 링크 한 줄만 추가했다. 기존 V1 실제 브라우저 전체 경로는 재검증하지 않았다. 과거 V1 로고/localStorage 문제는 범위를 넓혀 수정하지 않았다.

완료: 로컬 색상 모델·폼/CSV 헤더 분석·매핑 편집 UI 코드·검증·스키마 Dry Run·자동 검사·점검 문서.
부분 완료/미검증: 브라우저 전체 동선·실제 Notion 색상/Status·Vercel 운영 상태.
미구현: 새 매핑의 실제 생성 연결·CSV 관계 연결·템플릿 저장·KPI 편집기·인증/웹 생성·JSON 재불러오기.

먼저 가상 입력으로 화면 동선과 스키마 정책을 검토하고, 별도 승인된 신규 개인 테스트에서 색상/Status API 검증을 권한다. 그다음 안정 키/오류 미리보기를 갖춘 CSV 관계 연결→기본 교육 템플릿을 추천한다. 웹 생성은 비밀·인증·영구 실행 기록 설계를 선행하고 사용자 정의 KPI는 관계/분모 정책이 안정된 뒤 확장하길 제안한다. Business 검증을 이번 선결 조건으로 요구하지 않는다.

위 내용은 Codex가 실제 프로젝트에서 수행한 NB-V2-003 작업 결과입니다.

ChatGPT는 지금까지 확정한 AI 없는 규칙 기반 교육 운영 Notion 대시보드 빌더의 요구사항과 비교해 주세요.

1. 이번 구현이 정상적으로 진행되었는지 검토해 주세요.
2. 선택 옵션 색상 기능이 올바르게 구현되었는지 확인해 주세요.
3. 네이버 폼과 CSV 매핑 기능이 기존 기획에 맞는지 검토해 주세요.
4. 기존 V1과 Notion 생성 엔진의 기능이 보존되었는지 확인해 주세요.
5. Vercel 배포 환경에 보안상 문제가 없는지 검토해 주세요.
6. 완료·부분 완료·미완료 기능을 구분해 주세요.
7. 다음에 CSV 관계 연결, 기본 교육 템플릿, 사용자 정의 KPI, 웹 생성 기능 중 무엇을 우선할지 제안해 주세요.
8. 문제가 있다면 Codex 수정 프롬프트를 작성할 수 있도록 정리해 주세요.

실제 구현과 검증을 구분하고, 확인되지 않은 내용을 완료로 판단하지 마세요.
