# Supabase 연결

기준일: 2026-10-29.

NB-V2-006 최신 상태: 사용자 승인 후 education_drafts 테이블·RLS·최소 컬럼 권한을 실제 적용했다. 저장/목록/복원 UI는 로컬 구현이며 아직 운영 미반영이다. 자동 검사 129개, 로컬 SQL 검사 13개, 두 실제 계정 Data API 검사 16개를 통과했다. 로컬 브라우저 저장·복원도 확인했다. [저장 기능 보고서](storage/NB-V2-006_REPORT.md)를 기준으로 한다.

입력·결과·매핑 화면에서 `@supabase/supabase-js@2`를 jsDelivr CDN으로 불러온 뒤 `js/supabase-client.js`를 실행한다. 두 스크립트는 `defer` 순서로 로드한다. 기존 화면과 처리 코드는 유지했다.

- 프로젝트: `https://pxkjxcryceqtjomgxyfe.supabase.co`
- 키: 사용자가 제공한 Publishable Key. Secret Key는 사용하지 않는다.
- CDN 전역: `window.supabase`.
- 공통 Auth 클라이언트: `window.supabaseClient`. NB-V2-006의 `window.createEducationDataClient(token)`은 요청별 JWT를 사용하는 데이터 전용 클라이언트이며 추가 Auth 세션을 만들지 않는다.
- NB-V2-005에서 이메일 인증 UI와 세션 저장·자동 갱신·URL 인증 처리를 추가했다. [현재 Auth 안내](auth/README.md)를 기준으로 한다.
- 서버 자동 저장은 하지 않는다. NB-V2-006의 저장 버튼은 교육 입력·질문/헤더·매핑 설정만 education_drafts에 저장한다. CSV 응답·파일·비밀번호/토큰은 설계 데이터에 포함하지 않는다. 새 Auth 사용자 계정은 생성하지 않았다.
- CDN/초기화 실패 시 인증 오류·다시 확인을 표시하고 보호 화면은 숨긴다. CDN 로딩은 인터넷 연결이 필요하다.

공식 근거: [CDN 설치](https://supabase.com/docs/reference/javascript/installing), [클라이언트 초기화](https://supabase.com/docs/reference/javascript/initializing), [Publishable Key](https://supabase.com/docs/guides/getting-started/api-keys).

1차 연결 작업에서 서버/배포 환경변수 변경이나 Vercel 재배포는 하지 않았다. 이 문서가 최신 Supabase 연결 상태이며, NB-V2-003 보고서의 미연결 기록은 당시 이력이다.

검증: CDN 다운로드와 제공 키를 사용한 읽기 전용 `/auth/v1/settings` 요청 모두 HTTP 200. 실제 CDN 브라우저 번들을 Node VM에서 실행해 클라이언트 생성·전역 이름 분리·중복 초기화 방지·SDK 누락 대응을 확인했다. 세 화면의 로드 순서를 확인했고 기존 자동 검사 60개도 통과했다. 1차의 브라우저 화면 조작 검사는 별도로 수행하지 않았다. 연결 확인 요청은 수동 검증에서만 실행했으며 페이지 로딩 시 자동 호출하지 않는다.

최신 NB-V2-005 구현/테스트와 미검증 항목은 [Auth 안내](auth/README.md), [작업 보고서](auth/NB-V2-005_REPORT.md), [ChatGPT 인계문](auth/NB-V2-005_CHATGPT_HANDOFF.md)에 기록한다.

NB-V2-005A: 승인된 운영 Site URL·복귀 URL 2개를 저장·재조회했다. [현재 배포·설정 보고서](deployment/NB-V2-005A_REPORT.md)를 참고한다. 해당 보고 시점에는 새 코드가 미배포였다. 이후 NB-V2-005B에서 운영 반영을 확인했으며 NB-V2-006 UI의 배포는 아직 하지 않았다.
