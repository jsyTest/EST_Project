# [ChatGPT 전달용] NB-V2-006 사용자별 교육 설계 저장 구현 결과

기준일: 2026-10-29 KST / EST_Project.

## 완료·부분 완료·미검증

완료: 저장·목록·열기·수정 저장·편집 상태 복원, 승인된 실제 DB 적용, 두 실제 계정의 양방향 Data API 격리 검증.
부분 완료: 배포 준비까지 했으며 프런트엔드는 운영 미배포.
미검증: 실제 휴대폰, 운영 주소의 NB-V2-006 동선, 실제 네트워크 장애 유발. 오류·타임아웃은 Mock으로 검증했다.

## Git·변경 범위

시작 main/2432420, 직전 NB-V2-005B 문서 3개 미추적.
작업 중 HEAD가 82aba7ce0683f7dc9dae6be21e43b0c55853c921로 바뀌었고 차이는 그 문서 3개뿐이었다. 이를 보존했다.
이번 변경은 로컬 미커밋이다. Codex가 커밋·push·Preview/Production 배포한 것은 없다.
현재 운영 기준은 pplus-rouge.vercel.app / main/82aba7c / READY다.

새 파일 중심:
js/drafts/{model,repository,workspace,ui}.mjs,
js/drafts-bootstrap.js,
css/drafts.css,
database/education-drafts.sql,
저장 기능/화면 테스트·helpers,
scripts/verification의 로컬 SQL·실계정 검증 도구,
docs/storage의 보고서·DB 검토안·증거.

입력/결과/매핑 HTML·app.js·mapping-ui.mjs·공개 빌드와 문서를 통합했다.
Auth 코어는 새 캐시 정리만 추가했고 supabase-client에는 요청별 데이터 클라이언트 팩토리를 추가했다.

## 저장·복원 기능

내 교육 설계 패널에서 새 설계, 명시적 저장, 기존 행 수정, 복사본, 25개 단위 목록/열기, 로딩·성공·실패를 제공한다.
기존 CSS 변수·보라색 디자인을 유지했다. 서버 자동 저장은 하지 않는다.

사용자별 sessionStorage 캐시가 화면 이동과 새로고침을 연결한다.
서버 설계는 편집 화면 초기화 전에 불러온다.
updated_at으로 수정 충돌을 검사하고 요청 중 추가 편집을 보존한다.
계정 변경/로그아웃 시 캐시·화면·요청을 정리하고 늦은 응답을 버린다.
요청 전후의 계정을 확인하고 JWT를 요청별로 고정하며, 인증 확인까지 포함한 전체 요청에 15초 제한을 둔다. 제한 이후 늦은 쓰기·자동 재시도는 하지 않는다.

저장 형식:
행 schema_version = configuration.version = 1.
requirements: 교육명·목적·추가 요구사항·기본/추가 모듈.
mapping: 폼 문항/편집 텍스트, CSV 헤더/인코딩/연결, 속성명/유형/DB/포함 여부/필수·선택, 옵션명/색상/Status 그룹, 직접 추가 속성/확인 상태.

CSV 응답 행·원본 파일·파일명·비밀번호·세션/Notion 토큰·생성 결과·미구현 KPI 편집 설정은 저장하지 않는다.
allowlist로 직렬화하며 자유 입력의 개인정보를 자동 판별하는 기능은 아니다.
누락된 v1 선택 필드는 기본값, 잘못된 JSON·미지원 과거/미래 버전은 편집을 보존하며 거부한다.

## 실제 DB 반영·RLS

프로젝트: pxkjxcryceqtjomgxyfe.
적용 전 public 테이블 0개를 확인했다.
사용자 “승인 — 제안 SQL 적용 및 권한 검증” 후 실제 적용했다.
Migration: nb_v2_006_education_drafts / 20261029080237.
승인 원본 SQL SHA-256:
118795793f7c76b6b0124c91a3bc9bd78fc4a2f322251a89e753fc69b88c97e9

education_drafts:
id UUID PK, user_id FK(auth.users, DB 기본 auth.uid()), title, configuration JSONB, schema_version, created_at, updated_at.
교육명 1~80자, JSON 구조/버전/512 KiB 검사.
소유자/시각 인덱스, 시각 갱신·소유권 불변 트리거를 추가했다.

RLS ENABLE + FORCE.
SELECT는 auth.uid()와 user_id 일치.
INSERT는 WITH CHECK.
UPDATE는 USING과 WITH CHECK 모두 같은 소유권 조건이다.

넓은 기본 테이블 권한을 회수하고 authenticated에는 SELECT 및 title/configuration/schema_version INSERT·UPDATE만 허용했다.
user_id/id/시각 지정·변경·DELETE/TRUNCATE는 허용하지 않는다.
이메일/user_metadata로 판정하지 않고 브라우저에는 Publishable Key만 사용한다.
트리거 함수는 SECURITY INVOKER이며 직접 실행 권한을 회수했다.

실제 카탈로그·GRANT·정책·트리거를 확인했다.
Data API 익명 GET은 401/42501, 실제 사용자 저장/조회/수정은 성공했다. 노출 설정을 추가 변경하지 않았다.

## 실제 계정·브라우저 검증

사용자가 두 계정의 비밀번호를 직접 입력했다. 자격 증명·토큰을 추출하거나 보고서에 기록하지 않았다.

A의 NB-V2-006 E2E:
실제 저장·목적 수정·목록에서 열기·새 탭 서버 복원·새로고침·새 설계 초기화·기존 Mock 생성 확인.
폼 5문항, CSV 헤더 3개, 속성 9개(직접 추가 1개 포함), Applicant Label 속성명, 보라색 옵션을 저장·복원했다.
DB에서 가상 응답 표시자와 CSV 파일명 미포함을 확인했다.
로그아웃 시 새 패널·편집 데이터 숨김과 다른 로컬 탭 반영도 확인했다.
400×689 에뮬레이션에서 새 저장 패널을 확인했다. 마지막에는 계정 A의 검증 설계를 열어 두었다.

실제 RLS 전용 페이지는 user_id 필터 없이 실제 HTTP Data API에 요청했다.
B→A 8/8, A→B 8/8, 총 16개 통과:
타인 UUID SELECT 0행, 내 행 생성/사용, 내 행 조회/수정, 타인 UPDATE 차단, user_id 지정 INSERT 42501, 소유자 UPDATE 42501, schema_version=0 UPDATE 23514.
실제 DB에서도 검증 행 두 개의 소유자가 다르고 제목·버전이 보존됨을 확인했다.
삭제 요청은 하지 않았으며 삭제 차단은 실제 권한 조회와 로컬 SQL로 확인했다.

가상 검증 행은 A/B 각 1개 생성해 남겼다. 사용자가 별도로 만든 자료는 변경하지 않았다.
검증 HTML/Python 도구는 Production 빌드에 넣지 않았으며 완료 후 전용 로컬 경로를 닫았다.

## 자동 검사와 기존 기능

Node: 기존 103개 + 신규 26개 = 129개 통과, 실패/건너뜀 0.
V1 Mock 256개 모듈 조합 유지.
로컬 PGlite/Postgres SQL/RLS 13개 통과.
실제 CDN SDK 2.118.0의 고정 accessToken 헤더는 mock fetch로 확인했다.
129/13/16은 서로 다른 증거 묶음이며 하나의 자동 테스트 수로 합산하지 않는다.

기존 Auth 가입·로그인·로그아웃 흐름, V1 규칙/수식, 파서·CSV reader·색상 모델, Notion CLI·관계형·수식을 보존했다.
V1 결과는 기존 규칙으로 재생성한다. 매핑 저장이 Notion 자동 생성 웹 API 연동을 뜻하지 않는다.
공개 빌드는 18→24개로 확장했고 SQL·문서·테스트·비밀 파일·검증 도구는 제외했다.
로컬 HTTP 24개 정상, 내부 경로 6개 404, 참조 59개 누락 0.

## 남은 위험과 다음 단계

Security Advisor에는 이번 SQL 밖의 rls_auto_enable() 권한 경고 2개와 유출 비밀번호 보호 꺼짐 1개가 있다.
기존 함수는 SECURITY DEFINER/event_trigger이며 해당 실행 권한이 있음을 읽었으나 실제 RPC 호출 가능성은 시험하지 않았다. 신규 트리거 함수와 구분해야 한다.
기존 함수·Auth 설정은 승인 범위 밖이라 변경하지 않았다.

프런트엔드는 운영 미배포다. 새 Preview/Production에는 별도 승인이 필요하다.
실제 휴대폰·운영 배포 후 동선·실제 장애 유발은 미검증이다.
이후 기존 Advisor 경고 검토와 승인된 배포 검증, 개인 템플릿 라이브러리, 서버 측 Notion 웹 연동을 순서대로 검토할 수 있다.

ChatGPT는 NB-V2-006 결과를 기존 교육 운영 Notion 대시보드 빌더 기획과 비교해 주세요.

1. Supabase 교육 설계 저장·복원이 정상 구현됐는지 검토해 주세요.
2. RLS 정책이 사용자별 데이터 격리를 보장하는지 평가해 주세요.
3. CSV 매핑과 선택 옵션 색상이 정확히 복원되는지 확인해 주세요.
4. 기존 V1·Supabase Auth·Notion 생성 기능이 보존됐는지 확인해 주세요.
5. 실제 DB 반영과 Mock 테스트를 구분해 주세요.
6. 다음 단계인 개인 템플릿 라이브러리 및 Notion 생성 웹 연동의 우선순위를 제안해 주세요.
7. 보완이 필요하면 후속 Codex 작업 프롬프트를 작성할 수 있도록 문제를 정리해 주세요.

완료·부분 완료·미검증 상태를 구분하고 확인되지 않은 기능을 성공 처리하지 마세요.
