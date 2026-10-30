# [NB-V2-010A 작업 보고서]

작성일: 2026-10-30 KST. 상태: **로컬 구현·자동 검사·승인된 실제 Supabase 저장 및 브라우저 복원 검증 완료**.

## Git 및 범위

- 시작: `main / 4ba93c7aabca3110db441c1e9e677490ca59d330`, worktree clean.
- 종료 HEAD도 `4ba93c7aabca3110db441c1e9e677490ca59d330`. 이번 변경은 미커밋. 자동 커밋·push·Vercel 배포 없음.
- 수정: `js/drafts/model.mjs`, `js/drafts/workspace.mjs`, `js/mapping-ui.mjs`, `index.html`, `mapping.html`, `scripts/notion-poc/tests/helpers/browser.mjs`.
- 신규: `scripts/notion-poc/tests/planner-storage.test.mjs`, 본 보고서·인계문·실제 검증 범위 문서, `NB-V2-010A_EVIDENCE.json`, `NB-V2-010A_LIVE_RESULT.json`.

## 저장 내용

기존 `public.education_drafts.configuration`에 `planner`만 추가했다. `requirements`, `mapping`의 기존 정규화·저장 동작을 유지했다.

```json
{
  "planner": {
    "templateType": "extended",
    "enabledModules": ["attendance", "teams"],
    "repeatPrograms": true,
    "personHistory": true,
    "programStatistics": true,
    "multipleApplications": true
  }
}
```

구성: `basic/standard/extended`. 모듈: `participation/attendance/teams/projects/judging/completion/survey` 7개. 현재 화면에 있는 4개 추천 조건만 boolean으로 허용한다. 알 수 없는 구성·모듈, 중복 모듈, 잘못된 boolean은 거부한다. 추가 필드는 저장하지 않는다. 모듈 배열은 기존 화면 순서로 정규화한다.

직접 선택한 모듈만 저장하며 의존 모듈은 계획 엔진이 다시 계산한다. 전체 Dry Run, planId, Notion 요청 템플릿, 원격 ID/토큰, 실제 응답 행은 새 저장 범위에 넣지 않았다.

## version 1 및 기존 의미

- `configuration.version = schema_version = 1` 유지. SQL·테이블·컬럼·RLS 변경 없음.
- `planner` 없는 기존 설계: 기본형, 모듈 없음, 추천 조건 모두 false. 기존 행을 일괄 수정하지 않는다.
- 일부 선택 필드 누락도 해당 기본값 사용. 잘못된 형식은 오류로 처리하여 편집 내용을 유지한다.
- 기존 512 KiB 제한 유지. 새 설계 초기화에도 같은 기본값 적용.
- 기존 규칙상 일반형에서 출석/팀을 고르면 **확장형으로 자동 전환**된다. 이 화면 상태를 저장·복원한다. 일반형+모듈로 사용자가 다시 바꾼 경우에는 그 선택을 그대로 보존하고 기존 `EXTENDED_REQUIRED` 검증을 유지한다.

## 복원·계획 일치

저장 시 실제 화면의 planner 선택을 읽고, 화면 이동/새로고침에는 사용자별 sessionStorage의 같은 configuration을 사용한다. 서버에서 다른 설계를 열면 전체 configuration을 교체하여 이전 모듈/추천 조건이 섞이지 않는다. 복사본 저장에도 planner가 포함된다.

`planner` 편집도 workspace revision/dirty 판정에 포함했다. 저장 중 편집한 선택은 이전 서버 응답으로 덮어쓰지 않는다. 로그아웃/계정 변경에는 기존 Auth 정리와 함께 선택 컨트롤도 초기화한다.

복원 후 ‘DB 구성 미리보기’를 누르면 같은 설정으로 재계산한다. 동일 입력·선택의 전체 계획 JSON과 planId가 동일함을 검사했다. 미리보기 뒤 설정이 바뀌면 변경 안내와 함께 오래된 결과/다운로드를 무효화한다. 계획 엔진·기본형/일반형 실행기·승인된 manifest는 수정하지 않았다.

## 검사

- 기존 검사 239개 1차 통과.
- 최종 전체 Node **255/255 통과** = 기존 239 + 신규 16. V1 **256개 조합** 유지.
- 신규 16개 검사: 세 구성 유형 서버 모의 왕복/실제 편집 핸들러 복원, 7개 모듈, 추천 조건, 이전 v1, 잘못된 형식/크기, 복사본/초기화/A·B·이전 설계 격리, 화면 이동·새로고침, 계획 JSON/planId, 저장 중 편집, 실패/충돌, 로그아웃/계정 변경, 과거 009B 계획·요청 해시 불변.
- 실제 브라우저와 Node의 DOM 모의 실행은 구분한다. 위 서버 왕복 자동 검사는 **가상 Auth/Data API**이다.
- 공개 빌드 26개 허용 파일, 배포 보안 검사 2개, `git diff --check` 통과.
- DB SQL, Auth 코어/화면, 저장 repository, 계획 엔진/catalog, 기본형/일반형 실행기, vercel.json 9개 파일의 HEAD 대비 바이트 일치 확인.
- Supabase 구조 읽기 조회: 기존 education_drafts, RLS 활성, version 1 조건 유지. 승인 후 새 테스트 설계 2개에만 총 4회 데이터 쓰기를 실행했다.

## 실제 Supabase 검증

`NB-V2-010A_LIVE_TEST_PLAN.md`의 계정·범위를 사용자가 명시적으로 승인한 뒤 진행했다. 로컬 실제 Chrome 앱의 기존 Supabase SDK와 repository를 사용했고 가상 Auth/Data API 응답을 주입하지 않았다. 브라우저 연결 호스트가 사용 불가하여 Chrome 기본 화면 조작으로 검증했다. 비밀번호·세션·토큰을 읽어 내보내거나 기록하지 않았다.

| 새 가상 설계 | 실제 UUID | 최종 저장 상태 |
|---|---|---|
| NB-V2-010A 저장 테스트 A | `c829c444-dae7-4809-a9b3-b8cd4ff57da1` | 확장형, 출석·팀, 추천 조건 4개 true |
| NB-V2-010A 저장 테스트 B | `4ed7bd42-0db5-4ae2-a86c-f8a5d93140d1` | 복사본 저장, 기본형, 모듈 없음, 추천 조건 모두 false |

실제 쓰기 **4회**: A 기본형 INSERT → A 일반형 UPDATE → A 출석·팀 확장형 UPDATE → B 기본형 복사본 INSERT. 삭제·추가 수정·자동 재시도 없음. 테스트 설계는 남겼다.

확인한 실제 동작:

- A 기본형 저장 후 목록에서 다시 열기.
- A 일반형 및 4개 추천 조건 저장 후 서버에서 다시 열어 복원.
- 출석·팀 선택에 따른 기존 확장형 전환과 의존 참여·수강 자동 계산.
- A 확장형 저장 후 서버에서 다시 열기 및 브라우저 새로고침. 모듈·추천 조건 유지.
- 저장 전/서버 복원 후 재계산 planId 모두 **`plan-d75f72fd9a418a57`**. 두 화면 모두 DB 6개·속성 36개·관계 8개·Rollup 2개·Formula 3개·차단 오류 0개. 전체 JSON 동일성은 자동 검사로 확인했고, 실제 브라우저에서는 planId 및 요약을 확인했다.
- 가상 질문 2개·CSV 헤더 2개 연결 및 가상 A 선택지의 분홍색 복원.
- B 복사본을 만든 뒤 B→A→B를 서버에서 다시 열어 두 설정이 섞이지 않음 확인.
- 새 교육 설계 시작 시 빈 이름·기본형·모듈 없음·추천 조건 false 확인.
- 기존 version 1 설계의 읽기 전용 열기와 기본형 기본값 확인 후 새 설계로 전환. 기존 설계에는 저장하지 않음.
- 실제 Supabase Table Editor 읽기 조회: 데이터 행 3→5, A/B 서로 다른 UUID·schema_version 1. 기존 3개 행의 updated_at이 작업 전과 동일함 확인.

직접 관찰 항목 22개를 별도 `NB-V2-010A_LIVE_RESULT.json`에 기록했다. 이 수는 Node 자동 검사 수에 합산하지 않는다. 실제 다중 계정 전환·로그아웃·충돌 장애 유발은 하지 않았다.

## 원격 변경·미검증·다음 단계

SQL 실행, Supabase 구조/RLS/Auth 설정 변경, Notion 요청/생성/수정, Git 커밋·push, Vercel 운영 배포 없음. 기존 저장 설계와 Notion 결과를 보존했다.

미검증: 실제 계정 전환/로그아웃/동시 편집 장애, 모바일 실기기, Production 반영. 해당 항목은 자동/모의 검사와 구분한다. 기계 판독용 근거는 `NB-V2-010A_EVIDENCE.json`에 기록했다.

다음 순서: 필요 시 별도 Preview 검토 → 사용자별 Notion 웹 생성의 서버 비밀 관리·인증/소유권·실행 승인/해시·불확실 쓰기 재개·이력 설계를 별도 과제로 진행. 기존 CLI 승인 구조를 우회하지 않는다.
