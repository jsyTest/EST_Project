# Supabase 연결

기준일: 2026-10-29.

입력·결과·매핑 화면에서 `@supabase/supabase-js@2`를 jsDelivr CDN으로 불러온 뒤 `js/supabase-client.js`를 실행한다. 두 스크립트는 `defer` 순서로 로드한다. 기존 화면과 처리 코드는 유지했다.

- 프로젝트: `https://pxkjxcryceqtjomgxyfe.supabase.co`
- 키: 사용자가 제공한 Publishable Key. Secret Key는 사용하지 않는다.
- CDN 전역: `window.supabase`.
- 공통 클라이언트: `window.supabaseClient`.
- NB-V2-005에서 이메일 인증 UI와 세션 저장·자동 갱신·URL 인증 처리를 추가했다. [현재 Auth 안내](auth/README.md)를 기준으로 한다.
- 기존 입력·CSV·매핑 결과를 Supabase에 자동 전송하거나 저장하지 않는다. 테이블·정책·사용자 계정도 생성하지 않았다.
- CDN/초기화 실패 시 인증 오류·다시 확인을 표시하고 보호 화면은 숨긴다. CDN 로딩은 인터넷 연결이 필요하다.

공식 근거: [CDN 설치](https://supabase.com/docs/reference/javascript/installing), [클라이언트 초기화](https://supabase.com/docs/reference/javascript/initializing), [Publishable Key](https://supabase.com/docs/guides/getting-started/api-keys).

1차 연결 작업에서 서버/배포 환경변수 변경이나 Vercel 재배포는 하지 않았다. 이 문서가 최신 Supabase 연결 상태이며, NB-V2-003 보고서의 미연결 기록은 당시 이력이다.

검증: CDN 다운로드와 제공 키를 사용한 읽기 전용 `/auth/v1/settings` 요청 모두 HTTP 200. 실제 CDN 브라우저 번들을 Node VM에서 실행해 클라이언트 생성·전역 이름 분리·중복 초기화 방지·SDK 누락 대응을 확인했다. 세 화면의 로드 순서를 확인했고 기존 자동 검사 60개도 통과했다. 1차의 브라우저 화면 조작 검사는 별도로 수행하지 않았다. 연결 확인 요청은 수동 검증에서만 실행했으며 페이지 로딩 시 자동 호출하지 않는다.

최신 NB-V2-005 구현/테스트와 미검증 항목은 [Auth 안내](auth/README.md), [작업 보고서](auth/NB-V2-005_REPORT.md), [ChatGPT 인계문](auth/NB-V2-005_CHATGPT_HANDOFF.md)에 기록한다.
