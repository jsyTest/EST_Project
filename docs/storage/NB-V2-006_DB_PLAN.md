# NB-V2-006 원격 DB 적용 검토안

현재 상태: **사용자 명시 승인 후 원격 적용·카탈로그/익명 차단 확인 완료. 실계정 저장·복원/양방향 A-B 검증 완료. 프런트엔드 운영 미배포.** 승인 답변은 “승인 — 제안 SQL 적용 및 권한 검증”이다.

## 대상과 사전 조회

- 대상 프로젝트: `pxkjxcryceqtjomgxyfe`.
- 적용 전 public 테이블: 0개. 제안 트리거 함수와 동일한 이름의 기존 함수도 없음.
- 기본 테이블 권한에 anon/authenticated의 넓은 권한이 있어 이번 새 테이블에서 명시적으로 회수한다. 다른 테이블·전역 기본 권한은 변경하지 않는다.
- 적용 전 Data API GET은 HTTP 404 / PGRST205였다. 적용 후 같은 익명 GET은 HTTP 401 / 42501로 바뀌어 테이블 인식과 비로그인 차단을 확인했다. 실제 authenticated 사용자 CRUD는 별도 검증 대기다.

## 검토할 SQL

[database/education-drafts.sql](../../database/education-drafts.sql)

추가 객체는 테이블 1개, 복합 인덱스 1개, RLS 정책 3개, 트리거 함수 1개와 트리거 1개다. SQL은 새 객체 생성만 수행하며 같은 이름이 존재하면 덮어쓰지 않고 실패한다. 트랜잭션으로 적용한다.

| 컬럼 | 형식·역할 |
|---|---|
| id | UUID PK, DB 기본값 gen_random_uuid() |
| user_id | auth.users(id) FK, NOT NULL, DB 기본값 auth.uid(); Auth 사용자 삭제 시 cascade |
| title | 교육명, 공백 제외 1~80자 |
| configuration | JSONB; 입력값·매핑 설정, 객체/필수 구조/버전과 512 KiB 상한 검사 |
| schema_version | integer, 현재 1만 지원 |
| created_at | DB 생성 시각 |
| updated_at | DB 트리거가 갱신, 충돌 검사 기준 |

인덱스: `(user_id, updated_at DESC, id DESC)`. 목록은 내용 JSON 없이 25개씩 조회한다.

## 권한과 RLS

- RLS ENABLE + FORCE.
- PUBLIC/anon/authenticated의 기존 테이블 권한 회수.
- authenticated: SELECT, INSERT(title, configuration, schema_version), UPDATE(동일 3개 컬럼)만 허용.
- 브라우저에는 user_id/id/시각의 지정·변경 권한, DELETE/TRUNCATE 권한을 주지 않는다.
- SELECT: `(select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id`.
- INSERT: 동일 소유권 조건을 WITH CHECK로 검사.
- UPDATE: USING과 WITH CHECK 양쪽에서 같은 조건을 검사.
- 이메일/user_metadata/service_role을 클라이언트 소유권 판정에 사용하지 않는다.
- 트리거는 SECURITY INVOKER, 고정된 빈 search_path이며 소유자/id/created_at 변경도 거부한다. 함수 직접 실행 권한은 PUBLIC/anon/authenticated에서 회수한다.
- 기존 Supabase Auth, URL/메일 정책, 다른 스키마의 객체는 변경하지 않는다.

## 저장 형식과 사용자 흐름

`configuration.version = schema_version = 1`.

- requirements: educationName, purpose, requirements, basicItems, additionalItems.
- mapping: formText(질문 구조), encoding, columns(헤더만), model.properties(질문·속성명·유형·대상 DB·필수/선택 정보·연결 컬럼·옵션/색상/Status 그룹·확인 상태).
- 실제 구현된 직접 추가 속성도 저장한다.
- 응답 행·File·파일명·토큰·세션·생성 결과·새 KPI 편집 설정은 저장하지 않는다. 자유 입력란에 개인정보/토큰을 붙여넣는 내용을 자동으로 판별하는 기능은 아니다.
- v1의 누락된 선택 필드는 기본값으로 처리한다. 잘못된 JSON과 과거/미래 미지원 버전은 현재 편집 상태를 덮어쓰지 않고 거부한다. 향후 의미 있는 형식 변경은 버전 증가와 명시적 변환이 필요하다.
- 사용자별 sessionStorage 캐시가 입력 화면·매핑 화면 이동과 새로고침을 연결한다. 서버 영구 저장은 명시적인 저장 버튼으로만 수행한다.
- 로그아웃/계정 변경 시 기존 캐시와 화면 상태를 지운다. 진행 중 요청도 취소하고 늦게 온 응답을 표시하지 않는다.
- 서버 updated_at과 일치하는 행만 수정한다. 충돌하면 현재 편집을 유지하고 다시 열기/복사본 저장을 안내한다.
- 네트워크 오류에서 저장을 자동 재시도하지 않는다. 응답이 불명확하면 목록에서 반영 여부를 확인한 후 재시도한다.

## 적용 전 검증 결과

- 기존 103개 + 새 저장/복원/화면/지연 테스트 26개 = 129개 통과, 실패/건너뜀 0.
- 실제 편집 핸들러를 사용한 가상 DOM에서 폼 입력·모듈·헤더 연결·속성명·색상 복원 확인.
- 로컬 PGlite/Postgres에 정확한 SQL을 실행하고 서로 다른 fixture 사용자로 RLS·GRANT 등 13개 검사 통과. 실제 Supabase Auth 계정 검증은 아니다.
- 실제 CDN SDK 2.118.0을 mock fetch로 실행해 요청별 고정 JWT 헤더 동작 확인. 추가 Auth 세션을 만들지 않는 accessToken 방식을 사용한다.
- 공개 빌드 24개, 로컬 HTTP 24개 정상/내부 경로 6개 404, 참조 59개 누락 0.
- 초기 브라우저 작업 보호 이후 native Chrome 접근이 복구되어 로컬 비로그인 이동을 확인했다. 이후 실제 로컬 로그인·저장·수정·복원과 두 계정 양방향 Data API 검사 16개를 완료했다.

## 재현 명령

```sh
node --test scripts/notion-poc/tests/*.test.mjs
node scripts/deployment/build-static.mjs
npm install --prefix /tmp/nb-v2-006-pg --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.5.13
node scripts/verification/education-drafts-rls.mjs /tmp/nb-v2-006-pg/node_modules/@electric-sql/pglite/dist/index.js
```

PGlite는 개발 확인용 /tmp 설치이며 제품·공개 빌드의 의존성이 아니다. 이 검증 스크립트는 원격 연결을 하지 않는다.

## 승인 후 실행 범위와 결과

1. 완료: 실행 직전 테이블/동명 함수/인덱스 미존재를 재조회했다.
2. 완료: 승인한 새 객체·권한·RLS를 migration 트랜잭션으로 적용했다.
3. 완료: 실제 카탈로그의 정책/컬럼 권한/트리거와 보안 Advisor를 확인했다.
4. 완료: Data API 인식과 익명 401/42501 차단을 확인했다. 노출 설정은 변경하지 않았다.
5. 완료: 사용자가 두 실제 계정으로 직접 로그인했고 저장·복원 및 양방향 Data API 검사 16개를 통과했다. 비밀번호/토큰은 추출하거나 기록하지 않았다.

Git 커밋·push·Vercel Preview/Production 배포, Auth 설정/테스트 계정 생성, 기존 데이터 삭제는 이 DB 적용 범위에 포함하지 않는다. 사용자 승인 전 원격 생성·수정은 하지 않는다.

## 실제 적용 기록

승인된 원본 SQL SHA-256: `118795793f7c76b6b0124c91a3bc9bd78fc4a2f322251a89e753fc69b88c97e9`.
MCP migration 이름: `nb_v2_006_education_drafts`. DDL 내용은 그대로 사용했고, BEGIN/COMMIT 바깥 래퍼는 migration 도구의 트랜잭션 관리에 맡겼다. 도구 결과 success=true.

실제 카탈로그에서 RLS/FORCE 모두 true, 정책 3개, 컬럼 쓰기 권한 3개, 소유자 지정/변경·DELETE·함수 직접 실행 권한 없음, 인덱스와 트리거를 확인했다. 카탈로그 조회 직후에는 행 0개였으며 이후 가상 검증 행을 계정 A/B 각 1개 생성했다. 두 실제 계정 양방향 Data API 검사 16개와 저장/수정/복원을 검증했다. 사용자가 별도로 만든 자료는 변경하지 않았다.

Security Advisor 경고는 신규 테이블/함수가 아니라 SQL 범위 밖의 `public.rls_auto_enable()` 권한 2개와 Auth 유출 비밀번호 보호 꺼짐 1개다. 카탈로그에서 해당 함수는 SECURITY DEFINER/event_trigger이며 두 역할에 실행 권한이 있음을 확인했다. RPC로 실제 실행 가능한지 시험하지 않았고 기존 함수·Auth 설정을 변경하지 않았다. 별도 검토 대상이다.

- [anon 함수 권한 경고](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [authenticated 함수 권한 경고](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PGlite](https://pglite.dev/docs/).

## 실제 HTTP RLS 검증 재현

검증 전용 HTML은 scripts/verification/education-drafts-api.html, 로컬 서버는 scripts/verification/serve-drafts-check.py다. 공개 빌드에는 포함하지 않는다. 기존 8766 서버를 중단한 뒤 해당 Python 스크립트를 실행하면 /__nb006_rls_check.html에서 사용할 수 있다. own/other에는 본인 소유 두 테스트 계정의 가상 설계 UUID만 지정한다. label=A 또는 B다. 삭제 요청은 하지 않는다. 토큰/비밀번호를 출력하지 않으며 user_id 클라이언트 필터 없이 격리를 검사한다.

이번 검증 후 전용 경로는 닫고 공개 빌드만 제공하는 기본 로컬 서버로 복원했다. 실제 휴대폰과 Production 새 UI는 검증하지 않았다.
