# [ChatGPT 전달용] NB-V2-010A 구성 선택 저장·복원 결과

## 목적과 현재 상태

EST_Project의 기존 Supabase 교육 설계에 누락된 DB 구성 유형·7개 확장 모듈·4개 추천 조건을 저장·복원하도록 보완했다. 신규 기능/모듈을 추가하지 않았다.

기준 Git: `main / 4ba93c7aabca3110db441c1e9e677490ca59d330`, 시작 worktree clean. 이번 변경은 미커밋이며 push·배포하지 않았다.

상태: **로컬 구현·자동 검사 및 사용자 승인된 실제 Supabase 저장/브라우저 복원 검증 완료.**

## 변경과 저장 형식

수정: `js/drafts/model.mjs`, `js/drafts/workspace.mjs`, `js/mapping-ui.mjs`, `index.html`, `mapping.html`, 모의 화면 검사 helper. 신규: `scripts/notion-poc/tests/planner-storage.test.mjs`, 보고서·인계문·실제 검증안.

기존 `education_drafts.configuration`에 다음 작은 `planner`만 추가했다:

```json
{"templateType":"extended","enabledModules":["attendance","teams"],"repeatPrograms":true,"personHistory":true,"programStatistics":true,"multipleApplications":true}
```

`configuration.version = schema_version = 1`, requirements/mapping 및 512 KiB 제한 유지. SQL·테이블·컬럼·RLS·Auth 변경 없음. 전체 계획/요청 템플릿/토큰/응답 행을 저장하지 않는다. 직접 선택한 모듈만 저장하며 의존 모듈은 재계산한다.

planner가 없는 기존 v1은 기본형·모듈 없음·추천 조건 false로 연다. 알 수 없는 모듈·형식/중복/비boolean은 거부한다. 기존 행 일괄 수정 없음.

중요: 기존 UI는 일반형에서 모듈을 선택하면 확장형으로 바뀐다. 이 의미를 유지했다. 모듈이 있는 상태에서 사용자가 일반형으로 다시 바꾸면 선택 자체는 보존하고 기존 계획 오류를 표시한다. 이를 유효한 일반형 계획으로 성공 처리하지 않는다.

## 동작 및 검사

화면의 현재 선택을 저장·복원하고 sessionStorage에도 사용자별로 유지한다. 새 설계 초기화, 복사본 저장, A/B 및 이전 설계 간 전체 상태 교체, Auth 변경 시 정리, 저장 중 추가 편집의 revision 보호에 planner를 연결했다.

복원 후 미리보기 버튼으로 동일 계획을 재계산한다. 기존 planVersion 1 계획 엔진/Notion 실행기·승인 해시·manifest는 수정하지 않았다. 설정을 바꾸면 이전 미리보기를 무효화하고 재계산 안내를 표시한다.

- Node **255/255**(기존 239+신규 16), V1 **256개 조합** 통과.
- 세 구성 유형/7개 모듈/추천 조건/이전 v1/복사·초기화·격리/새로고침·이동/전체 계획 JSON·planId/매핑·색상/저장 중 편집/실패·충돌/Auth/기존 009B 해시 불변 검사.
- 위 저장 자동 검사는 **가상 Auth·Data API 및 모의 DOM**이다. 실제 Supabase나 실제 브라우저 성공으로 표시하지 않는다.
- 공개 빌드 허용 파일 26개 및 보안 검사, diff 검사 통과. 기존 Auth/repository/SQL/계획 엔진/CLI/Vercel 설정 파일 불변 확인.
- Supabase 읽기 메타데이터에서 기존 테이블·RLS 활성·version 1 조건 확인. SQL 실행 없음.

## 실제 검증과 남은 사항

실제 검증안의 계정·새 가상 설계 2개·최대 4회 쓰기를 사용자가 명시적으로 승인한 뒤 검증했다. 실제 Chrome 앱의 기존 SDK/repository를 사용했으며 가상 Auth/Data API를 주입하지 않았다. 연결 호스트 사용 불가로 Chrome 기본 화면 조작을 사용했다. 비밀번호·토큰을 추출/기록하지 않았다.

- A UUID `c829c444-dae7-4809-a9b3-b8cd4ff57da1`: 기본형 추가 → 일반형 수정 → 출석·팀 확장형 수정, 4개 추천 조건 true.
- B UUID `4ed7bd42-0db5-4ae2-a86c-f8a5d93140d1`: 기본형·모듈 없음·추천 조건 false로 복사본 추가.
- 실제 쓰기 합계 **INSERT 2 + 새 A UPDATE 2 = 4회**. 삭제/재시도/기존 설계 수정 없음.
- 기본형·일반형·확장형을 저장하고 목록에서 서버 내용을 다시 열었다. 일반형 추천 조건, 확장형 출석·팀과 추천 조건, 새로고침 복원을 확인했다.
- 확장형 저장 전/복원 후 planId **`plan-d75f72fd9a418a57`** 일치. 요약도 DB 6/속성 36/관계 8/Rollup 2/Formula 3/차단 오류 0으로 일치. 실제 전체 JSON을 비교했다고 주장하지 않으며, 전체 JSON 동일성은 자동 검사 결과다.
- CSV 연결 2개와 분홍색 선택지 복원 확인. B→A→B 선택 격리와 새 설계 기본값 초기화 확인.
- Supabase Table Editor에서 행 3→5, 새 A/B의 서로 다른 UUID 및 schema_version 1, 기존 3개 행의 updated_at 불변 확인. 기존 v1 설계도 읽기 전용으로 열어 기본값을 확인했고 저장하지 않았다.
- 직접 관찰 22개는 `docs/storage/NB-V2-010A_LIVE_RESULT.json`. Node 255개와 별도다.

미검증: 실제 계정 전환/로그아웃/동시 편집 장애, Production/모바일 실기기. 이 항목들의 가상 테스트 결과를 실제 검증으로 바꾸지 않았다. 승인된 새 테스트 데이터 4회 쓰기 외 SQL/스키마/RLS/Auth 설정/Notion 변경 및 배포 없음. 검사 근거: `docs/storage/NB-V2-010A_EVIDENCE.json`.

다음은 필요 시 별도 Preview 검토이며, 웹 Notion 생성은 별도로 서버 비밀·사용자 권한·승인 계획/해시·중복 생성 방지·불확실 응답/재개·사용자별 이력을 설계해야 한다. 이번 저장 보완을 웹 생성 완료로 해석하지 않는다.

> ChatGPT는 NB-V2-010A 작업 결과를 검토해 주세요.
>
> 1. 기본형·일반형·확장형 선택이 정상 저장되는지 확인해 주세요.
> 2. 확장 모듈과 추천 조건이 정확히 복원되는지 평가해 주세요.
> 3. 기존 version 1 설계와 호환되는지 검토해 주세요.
> 4. 실제 Supabase 저장 검증과 가상 테스트를 구분해 주세요.
> 5. 기존 Auth·매핑·색상·Notion 실행기가 보존됐는지 확인해 주세요.
> 6. 추가 SQL 없이 구현했는지 확인해 주세요.
> 7. 이후 사용자별 Notion 웹 생성 기능 개발에 필요한 사항을 정리해 주세요.
>
> 완료·부분 완료·미검증을 구분해 보고해 주세요.
