# [NB-V2-006 작업 보고서]

기준일: 2026-10-29 KST.

## 1. 완료 판정

**교육 설계 저장·목록·열기·수정 저장, 매핑 복원, 승인된 원격 DB 적용, 로컬 브라우저 실계정 검증을 완료했다. 프런트엔드는 운영 미배포다.**

완료: 자동 검사 129개, 로컬 SQL/RLS 검사 13개, 실제 두 계정 Data API 검사 16개.
부분 완료: 배포 준비까지 했으며 Preview/Production 반영은 실행하지 않았다.
미검증: 실제 휴대폰, 운영 주소에서 NB-V2-006 화면, 실제 네트워크 차단/장애 유발. 네트워크 실패·타임아웃은 Mock으로 검증했다.

## 2. 시작·종료 Git 상태

시작: main/2432420f36368331228283dcb93000b2f90f89a8, 직전 NB-V2-005B 문서 3개 미추적.
작업 도중 HEAD가 82aba7ce0683f7dc9dae6be21e43b0c55853c921으로 바뀌었고 차이는 그 문서 3개뿐이었다. 이를 보존했다.
종료 기준: main/82aba7c, 이번 코드·SQL·문서는 미커밋.
Codex가 커밋·push·배포한 것은 없다.

## 3. 화면 구현과 저장 흐름

입력·결과·매핑 화면에 ‘내 교육 설계’를 추가했다.
새 설계, 명시적 저장, 기존 행 수정 저장, 복사본 저장, 25개 단위 목록/더 보기, 열기, 로딩·성공·실패 안내를 제공한다.
기존 CSS 변수와 보라색 디자인을 유지했다.

sessionStorage의 사용자별 편집 캐시가 화면 이동과 새로고침을 연결한다. 계정에 영구 보관하려면 저장 버튼을 눌러야 한다.
서버 설계 열기는 편집 화면 초기화 전에 완료한다.
updated_at으로 충돌을 검사하며 저장 요청 중 추가 편집을 덮어쓰지 않는다.
인증 확인·DB 응답·마지막 계정 확인 전체에 15초 제한을 적용했다. 늦게 인증이 끝나도 제한 이후 새 쓰기를 제출하지 않는다. 쓰기를 자동 재시도하지 않는다.

## 4. 저장 데이터·형식·복원

configuration.version과 행 schema_version은 1이다.

- 교육명·목적·추가 요구사항·기본/추가 모듈.
- 폼 문항 구조·편집 텍스트.
- CSV 헤더·인코딩·속성 연결.
- 속성명·유형·대상 DB·포함 여부·필수/선택 정보.
- Select/Multi-select 옵션명·색상·사용자 색상 지정·Status 그룹.
- 구현된 직접 추가 속성과 사용자 확인 상태.

CSV 응답 행·원본 파일·파일명·비밀번호·세션/Notion 토큰·생성 결과·미구현 KPI 편집 설정은 저장하지 않는다.
필드 allowlist로 직렬화한다. 자유 입력 내용에서 개인정보를 자동 식별하는 기능은 아니다.
v1 선택 필드 누락은 기본값으로 처리하고, 잘못된 JSON·미지원 과거/미래 버전은 현재 편집을 보존하며 거부한다.

실제 새 탭에서 서버 행을 열어 입력값·모듈·폼 텍스트·헤더 3개·컬럼 연결·Applicant Label 속성명·보라색 옵션·직접 추가 속성이 편집 컨트롤에 복원됨을 확인했다.
원본 File 선택은 비워 두고 헤더 구조만 복원한다.

## 5. 실제 Supabase 적용

대상: pxkjxcryceqtjomgxyfe.
적용 전: public 테이블 0개, 동명 함수/인덱스 없음, Data API GET 404/PGRST205.
사용자가 “승인 — 제안 SQL 적용 및 권한 검증”으로 승인했다.
MCP migration nb_v2_006_education_drafts / 20261029080237 적용 성공.

원본 SQL: database/education-drafts.sql
SHA-256: 118795793f7c76b6b0124c91a3bc9bd78fc4a2f322251a89e753fc69b88c97e9
DDL은 동일하며 바깥 BEGIN/COMMIT 래퍼는 migration 도구의 트랜잭션 관리에 맡겼다.

education_drafts: id UUID PK, user_id UUID FK(auth.users, DB 기본 auth.uid()), title, configuration JSONB, schema_version, created_at, updated_at.
교육명 1~80자, JSON 구조·버전·512 KiB 상한을 검사한다.
소유자/시각 복합 인덱스와 시각 갱신·소유권 불변 트리거를 추가했다.

Codex가 만든 가상 검증 행은 A의 NB-V2-006 E2E와 B의 NB-V2-006 RLS B 각 1개다. 삭제하지 않았다. 사용자가 별도로 만든 설계는 건드리지 않았다.

## 6. RLS·GRANT·Data API

실제 카탈로그에서 RLS/FORCE 모두 true, 정책 3개, 인덱스·트리거를 확인했다.

- SELECT: auth.uid()가 있고 user_id와 일치.
- INSERT: 동일 조건 WITH CHECK.
- UPDATE: 기존 행 USING과 변경 후 WITH CHECK 모두 동일 소유권 조건.

기본 테이블 권한을 회수하고 authenticated에 SELECT 및 title/configuration/schema_version의 INSERT·UPDATE만 허용했다.
user_id/id/시각 지정·변경과 DELETE/TRUNCATE는 허용하지 않는다.
user_id는 DB가 정한다. 이메일/user_metadata로 권한을 판정하지 않는다.
트리거 함수는 SECURITY INVOKER이며 anon/authenticated의 직접 실행 권한이 없다.

실제 익명 Data API GET은 401/42501로 차단됐다. authenticated의 정상 저장/조회/수정은 실제 브라우저에서 성공했다. Data API 인식을 확인했으며 노출 설정을 추가 변경하지 않았다.

## 7. 실제 두 계정 격리 검증

사용자가 각 계정 비밀번호를 직접 입력했다. 자격 증명·JWT를 보고서나 테스트 로그에 복사하지 않았다.
로컬 전용 검증 페이지에서 user_id 필터 없이 실제 Data API에 요청했다.
B→A 8/8, A→B 8/8, 총 16개 통과:

다른 계정 UUID 조회 0개, 내 행 생성/기존 행 사용, 내 행 조회, 내 행 수정, 타인 행 수정 차단, 임의 소유자 INSERT 42501, 소유자 변경 UPDATE 42501, schema_version=0 수정 23514.

실제 DB에서 검증 행 2개의 소유자가 서로 다르고 타인 수정 시도 뒤 제목·버전이 보존됨을 확인했다.
DELETE 요청은 보내지 않았다. 삭제 차단은 실제 권한 조회와 로컬 SQL 검사로 확인했다.
검증 HTML/Python 서버는 공개 빌드에 포함하지 않았고, 완료 후 전용 로컬 경로를 닫았다.

## 8. 자동·로컬 SQL 검사

- Node 자동 검사: 기존 103개 + 신규 26개 = 129개 통과, 실패/건너뜀 0.
- V1 256개 모듈 조합 유지.
- Mock 저장/열기/수정/복사/목록/새로고침, 실제 편집 핸들러의 복원, 계정 전환, 늦은 응답, 충돌, JSON/버전, 저장소/네트워크/타임아웃 검사.
- 로컬 PGlite 0.5.13/Postgres에서 제안 SQL과 RLS·컬럼 권한 등 13개 검사 통과.
- 실제 CDN SDK 2.118.0의 요청별 accessToken 헤더를 mock fetch로 확인.

로컬 SQL·Mock 결과와 실제 Supabase HTTP 결과는 각각 기록했다.
129/13/16은 서로 다른 검증 묶음이며 단일 자동 테스트 수로 합산하지 않는다.

## 9. 기존 기능·브라우저 검증

기존 Auth 가입/로그인/로그아웃 흐름, V1 규칙/수식, 매핑 파서·CSV reader·색상 모델, Notion CLI·관계형·수식을 보존했다.
Auth 코어에는 새 캐시 정리만 추가했다. 요청별 데이터 클라이언트는 추가 Auth 세션을 만들지 않는다.

실제 브라우저에서 저장·수정·목록 열기·새 탭/새로고침·새 설계 초기화·Mock 결과 생성·로그아웃 시 화면 숨김과 다른 탭 반영을 확인했다.
400×689 에뮬레이션에서 저장 패널과 버튼 배치도 확인했다. 실제 휴대폰 검증은 아니다.
마지막에는 계정 A로 검증 설계를 열어 두었다.

## 10. 공개 빌드·Vercel

공개 출력은 기존 18개 + CSS 1개·bootstrap 1개·모듈 4개 = 24개다.
로컬 HTTP에서 공개 파일 24개가 빌드와 일치하고 내부 경로 6개는 404, 정적 참조 59개 누락 0.
SQL·문서·테스트·검증 페이지·환경 파일은 공개 빌드에서 제외한다.

현재 Production 조회 기준: pplus-rouge.vercel.app / main/82aba7c / READY.
이번 UI는 미배포이며 Preview·Production 배포·Git 커밋/push를 하지 않았다.
원격 변경은 승인된 DB 객체·권한·정책·migration 및 가상 검증 행뿐이다. Auth URL·메일 정책·계정 생성·기존 자료 삭제는 하지 않았다.

## 11. 오류·보안 Advisor·미검증

초기 창 활성화/브라우저 관찰 과정에서 저장 완료 UI를 바로 확인하지 못했으나 DB에는 반영돼 있었다. 중복 INSERT를 재시도하지 않고 같은 행을 다시 열어 후속 저장 완료를 확인했다. 이후 전체 요청의 지연 제한을 보강하고 마지막 실제 수정 저장도 확인했다.

Security Advisor 경고 3개는 이번 SQL 밖의 public.rls_auto_enable() 실행 권한 2개와 유출 비밀번호 보호 꺼짐 1개다.
기존 함수는 SECURITY DEFINER/event_trigger이며 해당 역할의 실행 권한이 있다. 실제 RPC 호출 가능성을 시험하지 않았고 기존 함수·Auth 설정을 변경하지 않았다.
신규 education_drafts 함수의 권한과 구분해 별도 검토해야 한다.

- [anon 실행 권한 경고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [authenticated 실행 권한 경고](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

실제 휴대폰, 운영 배포 후 동선, 실제 장애 강제 유발은 미검증이다. 저장 응답이 불명확하면 목록을 확인한 후 재시도하도록 안내한다. 브라우저 저장소가 막히면 임시 복원을 보장하지 못하므로 오류를 표시한다.

## 12. 다음 단계

기존 Advisor 경고를 별도 범위로 검토하고, 승인된 Preview에서 배포 동선을 확인한 후 별도 Production 승인을 받는다.
이후 개인 템플릿 저장/적용을 우선 검토하고, Notion 웹 연동은 서버 측 토큰·권한·중복 실행 방지 설계를 포함한 별도 작업으로 진행한다.
회사 공유·관리자·실제 개인정보·AI·Business Dashboard 기능은 이번 범위 밖이다.

## 파일 목록

- css/drafts.css
- database/education-drafts.sql
- docs/SUPABASE_SETUP.md
- docs/auth/README.md
- docs/storage/NB-V2-006_CHATGPT_HANDOFF.md
- docs/storage/NB-V2-006_DB_PLAN.md
- docs/storage/NB-V2-006_EVIDENCE.json
- docs/storage/NB-V2-006_REMOTE_VERIFICATION.json
- docs/storage/NB-V2-006_REPORT.md
- index.html
- js/app.js
- js/auth-core.js
- js/drafts-bootstrap.js
- js/drafts/model.mjs
- js/drafts/repository.mjs
- js/drafts/ui.mjs
- js/drafts/workspace.mjs
- js/mapping-ui.mjs
- js/supabase-client.js
- mapping.html
- result.html
- scripts/deployment/build-static.mjs
- scripts/notion-poc/tests/deployment.test.mjs
- scripts/notion-poc/tests/education-drafts-ui.test.mjs
- scripts/notion-poc/tests/education-drafts.test.mjs
- scripts/notion-poc/tests/helpers/browser.mjs
- scripts/notion-poc/tests/helpers/drafts-fixture.mjs
- scripts/notion-poc/tests/service-flow.test.mjs
- scripts/verification/education-drafts-api.html
- scripts/verification/education-drafts-rls.mjs
- scripts/verification/serve-drafts-check.py
