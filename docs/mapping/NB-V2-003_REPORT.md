# [NB-V2-003 작업 보고서]

**판정: 로컬 기능과 자동 검사 완료, 실제 Notion 색상 반영·웹 생성 연결·운영 배포 및 브라우저 전체 동선은 부분 완료/미검증.**

## 1. 작업 ID와 기준일

NB-V2-003 / 2026-10-29 / Asia/Seoul. AI 없는 규칙 기반 교육 운영 Notion 대시보드 자동 생성기의 입력 설정 확장 작업이다.

## 2. 시작·종료 Git 상태

시작: `main / 8169eca` (`추가 구현 2`, 2026-10-29 14:30:43 +09:00), 작업 트리 clean. 이전 NB-V2-002A가 사용자 커밋에 포함된 실제 코드를 기준으로 분석했다.

종료: 같은 브랜치/HEAD, 추적 파일 4개 수정·신규 15개. 사용자 기존 변경을 덮어쓰지 않았다. 커밋·push·배포 없음. 비밀 설정과 기존 실행 상태는 Git 제외 상태를 유지한다.

## 3. 수정·추가한 파일

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

`index.html`은 매핑 화면 링크 한 줄만 추가했다. `schema.mjs`는 신규 고정 샘플 Select 색상, `engine.mjs`는 색상 재조회와 과거 색상 없는 완료 지문 재사용을 반영했다. 나머지 구현은 별도 매핑 화면/모듈/CLI/검사/문서다. 기존 JS·결과 HTML·공통 CSS·수식·관계·fixture·V1 명세·과거 보고서는 미수정이다.

## 4. 실제 구현 기능

별도 `mapping.html`에 폼 텍스트 입력·가상 예시·CSV 선택/인코딩·컬럼 미리보기·원문·기본/폼/CSV/수동 속성 구분·편집·확인·제외·검증·모델/스키마 JSON 저장을 구현했다. 브라우저와 Node가 공통 표준 속성 모델을 사용한다. AI API·외부 업로드·localStorage 저장·서버 쓰기 엔드포인트 없음.

## 5. 선택 옵션 색상

Notion 허용 색상 10개만 검증한다. 선정(접수 blue/선정 green/대기 yellow/미선정 gray/취소 red), 수료(수료 green/미수료 red/수료 대기 yellow), 진행(예정 gray/진행 중 blue/완료 green/취소 red)을 추천한다. 새 Select/Multi-select/Status의 색상을 편집해 스키마로 출력한다. Status는 고정 3개 그룹 배치를 지원하며 그룹 자체 변경은 제공하지 않는다.

기존 옵션 업데이트용 순수 함수는 모든 기존 ID·옵션을 유지하고 추천값이 기존 색상을 덮어쓰지 않게 한다. 명시적 사용자 변경만 색상에 반영한다. 기존 옵션 이름 변경은 거부해 Notion UI에서 처리하도록 한다. 중복·알 수 없는 ID·잘못된 색상·그룹은 차단한다. 이 함수는 실제 PATCH 명령으로 연결하지 않았다.

실제 스키마 재조회 함수는 이름/색상/Status 그룹 멤버십을 비교할 수 있다. 고정 PoC의 신규 Select 생성 재조회에도 연결했다. 이번에는 실제 Notion 생성/색상 변경을 수행하지 않았으므로 API 반영 성공으로 보고하지 않는다. 기존 생성 DB 색상도 변경하지 않았다.

## 6. 네이버 폼 파싱 결과

번호가 있는 질문·질문명·선택지·명시적 필수 표식·단일/복수 선택을 추출한다. 성명/연락처/이메일/연령대/참여자 유형/신청 과정/동기/기대사항/유입 경로/선정 상태의 사전을 사용한다. 원문·선행 안내문·해석 실패 내용을 보존한다. 복수 선택이 명확하지 않거나 알 수 없는 질문/본문·번호 충돌은 확인 필요다. 모든 자유 형식 폼을 해석한다고 가정하지 않는다.

가상 예시에서 5개 질문과 선택지를 분석해 기본 속성 3개와 합한 8개 속성을 만들었다. 필수 정보는 메타데이터이며 Notion 필수 입력 강제가 아니다.

## 7. CSV 헤더 매핑 결과

브라우저에서 1 KiB 청크를 순서대로 읽으며 첫 레코드 종료 시 중단한다. 최대 헤더 64 KiB. 청크에 딸려온 응답 행 바이트는 디코딩/파싱/보존하지 않는다. 전체 파일 읽기·응답 업로드·로그 없음.

UTF-8/BOM·명시적 EUC-KR/CP949·한국어·인용부호 안 쉼표/줄바꿈·이스케이프 따옴표를 검사했다. 빈/중복 컬럼은 원본과 인덱스를 유지해 표시하고 잘못된 인용부호·인코딩·큰 헤더는 거부한다. TSV·세미콜론·XLSX·자동 인코딩 감지는 미지원이다.

정확한 정규화명 또는 사전 별칭이 유일할 때만 추천 연결한다. 원본 질문/원본 CSV/최종 Notion 이름을 구분한다. 예시의 긴 유입 경로 질문과 CSV `유입 경로`가 연결됐으며 다중 후보·중복 문항은 자동 병합하지 않는다. CSV 단독 항목은 사용자 확인 대상이다.

## 8. 사용자 수정 항목

Notion 속성명·유형·DB·CSV 연결·선택 옵션 이름/추가/제외·옵션 색상·Status 그룹·속성 사용 여부·수동 속성 추가. 사용자 확인 후에도 중복 이름/제목/컬럼 연결·잘못된 옵션은 구조 검증으로 막는다. 수정 시 스키마 미리보기를 무효화한다. 편집 결과는 메모리에만 있으며 모델/스키마 JSON을 저장할 수 있다. JSON을 UI로 재불러오는 기능은 없다.

## 9. Notion 엔진 연결 범위

입력→표준 모델→유효성 검사→DB별 스키마 생성까지 구현했다. `localId`와 실제 Notion ID를 분리한다. 제목이 없는 새 DB에는 충돌 없는 기본 title을 보충한다. `mode: new-data-sources-only / networkRequests: 0`를 출력한다.

`mapping-dry-run.mjs`가 UI에서 저장한 모델을 같은 모듈로 검증한다. 가상 모델 8개 속성은 4 DB용 스키마를 출력했다. 기존 고정 샘플 생성·수식·관계·재계산은 보존했다. 이전 실제 `nb-v2-002a` manifest도 재사용=true/API 0회로 확인했다.

**새 사용자 매핑을 실제 생성 apply에 넘기는 연결은 미구현이다.** 기존 PoC DB에 새 모델을 PATCH하지 않으며 관계·KPI 결합/행 삽입도 하지 않는다.

## 10. Vercel 점검

사용자 제공 URL `https://pplus-jr6959pvz-pplus1.vercel.app`에 읽기 전용 HTTPS 요청을 수행했다. HTTP 302와 Vercel 인증/SSO 이동을 확인해 배포 HTML·커밋·기능은 확인하지 못했다.

로컬은 정적 V1/매핑 화면 + 별도 Node CLI다. api/Functions·package.json·vercel.json·.vercel/project.json이 없다. Git origin은 GitHub EST_Project이며 Vercel의 연결 여부·빌드/출력 폴더·Production Branch·자동 배포·운영 환경변수는 미확인이다. Git 연동이면 push가 배포로 이어질 수 있어 이번에는 push하지 않았다.

로컬 웹 코드에 토큰·공개 Notion 쓰기 API는 없다. 운영 산출물의 노출 여부는 별도 확인해야 한다. 향후 토큰은 서버 전용·환경별 분리, 인증/대상 권한/입력 검사/요청 제한이 필요하며 로컬 파일 상태를 서버리스 영구 저장으로 간주하면 안 된다. Hobby의 회사/상업적 이용 조건도 실사용 전 검토해야 한다. 상세 근거와 확인 방법은 `DEPLOYMENT_AUDIT.md`.

## 11. Supabase

적용하지 않았다. 로컬 코드·의존성·설정에 연결 없음. 사용자 계정에 프로젝트가 존재하는지와 이 저장소가 연결됐는지는 별개이며 외부 Supabase 상태를 검증 대상으로 삼지 않았다.

## 12. 테스트 명령·결과

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node scripts/notion-poc/mapping-dry-run.mjs docs/mapping/EXAMPLE_MAPPING_MODEL.json
node scripts/notion-poc/cli.mjs dry-run --view-profile free
```

전체 **60개 통과 / 0실패**. 기존 37개 + 신규 23개. 색상·Status·보존·이름 변경/중복 거부·폼·CSV·인코딩·최소 읽기·매핑 모호성·수정/제외·JSON→CLI·이전 지문 재사용·색상 불일치 시 다음 DB 생성 중단을 확인했다.

Chrome에서 로컬 화면 로딩과 기본 색상/그룹 편집 컨트롤 표시를 확인했다. 이후 브라우저 동시 사용 감지로 조작이 중단돼 분석 클릭·파일 선택·편집·다운로드의 전체 브라우저 동선은 미검증이다. 해당 데이터 처리 로직은 자동 검사 범위이며 이를 브라우저 E2E 성공과 혼동하지 않는다.

## 13. 기존 V1 회귀

V1 모듈 조합 256개를 포함해 기존 검사가 계속 통과했다. 기존 JS·공통 CSS·결과 HTML과 Mock 생성은 미수정이다. 입력 HTML에 진입 링크 한 줄만 추가했다. V1 전체 브라우저 조작은 이번에 재검증하지 않았다. 기존 로고 참조·일부 localStorage 예외 문제를 이번 범위로 넓혀 수정하지 않았다.

## 14. 실제 Notion API 호출

이번 작업의 콘텐츠 API 호출 **0회**, 실제 쓰기 0회. 공식 문서 조회와 Vercel HTTPS 점검은 수행했다. 실제 색상 반영은 미검증이며 과거 NB-V2-002A의 75→100% 성공은 이전 작업 이력이다. Business Dashboard 테스트·회사 데이터 접근 없음.

## 15. 오류·수정

- 기본 네트워크에서 Vercel DNS가 제한돼 승인된 읽기 요청으로 재확인했고 302 인증 이동을 확인했다. 인증을 우회하지 않았다.
- 브라우저 연결 호스트는 사용 불가였지만 native Chrome으로 로컬 화면은 열었다. 후속 조작은 사용자 동시 활동으로 중단돼 미검증으로 남겼다.
- 색상 추가가 코드 지문을 바꿔 과거 실행 재사용을 막을 수 있어, 완료/부분 완료 상태에서만 과거 색상 없는 동일 계획 지문을 허용했다. 실패 상태 자동 재시작은 허용하지 않는다. 실제 이전 manifest와 모의 검사에서 0 API 재사용을 확인했다.
- CSV 청크를 통째로 디코딩하면 응답 행의 잘못된 인코딩에 영향받을 수 있어 헤더 종료까지만 디코딩하도록 구성하고 회귀 검사했다.

## 16. 미완료·미검증

실제 Notion 색상/Status 반영, 편집 UI 전체 브라우저 동선·모바일 시각 검사, Vercel 운영 화면/커밋/환경변수/빌드 산출물/자동 배포, 새 모델의 실제 생성·관계/KPI 연결, JSON 재불러오기. 임의 폼 해석·대규모 실데이터도 보장하지 않는다. 현재 미검증을 완료로 표시하지 않았다.

## 17. 다음 추천

우선 화면에서 가상 예시·CSV·편집·저장을 확인하고 Notion 스키마 출력 정책을 검토한다. 이어서 승인된 신규 테스트 범위의 색상/Status API 검증, 안정 키와 오류 미리보기를 갖춘 CSV 관계 연결, 기본 교육 템플릿 순서를 추천한다. 웹 생성 기능은 인증·비밀 관리·영구 실행 상태를 먼저 설계한 뒤 연결하고 사용자 정의 KPI는 관계/분모 정책이 안정된 뒤 진행한다. Business 테스트를 이번 단계의 선결 조건으로 요구하지 않는다.
