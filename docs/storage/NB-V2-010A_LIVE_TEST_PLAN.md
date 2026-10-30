# NB-V2-010A 실제 저장 검증 범위

상태: 로컬 구현·Node 255개(기존 239+신규 16) 통과. 사용자가 아래 테스트 계정·새 가상 설계 2개 검증을 명시적으로 승인했고, 실제 검증 완료. INSERT 2회+새 A UPDATE 2회, 총 4회. 근거: `NB-V2-010A_LIVE_RESULT.json`.

## 대상

- Supabase `PPLUS` / `pxkjxcryceqtjomgxyfe` / 기존 `public.education_drafts`
- 기존 본인 테스트 계정 A (`j0819j0819@gmail.com`); 비밀번호를 채팅/기록에 받지 않는다.
- 로컬 `http://127.0.0.1:8766/`의 별도 새 Chrome 탭. 운영 배포 아님.
- 신규 가상 설계 `NB-V2-010A 저장 테스트 A`, `NB-V2-010A 저장 테스트 B` **최대 2개**.
- 기존 설계의 내용을 수정·삭제하지 않는다. 기존 목록 조회는 허용된 읽기다.

## 구체 순서와 쓰기 상한

1. 새 설계 상태 확인 후 A의 교육명·가상 질문/헤더를 입력하고 기본형 저장: INSERT 1회.
2. A를 일반형과 추천 조건으로 바꿔 저장: A UPDATE 1회.
3. 출석·팀을 선택하면 기존 규칙대로 확장형 전환. A를 저장: A UPDATE 1회.
4. 저장된 목록에서 A를 다시 열고 새로고침하여 선택값·가상 입력·매핑 복원 확인. 미리보기 재계산.
5. 현재 입력을 B 이름·기본형·모듈 미선택·추천 조건 해제로 바꾼 뒤 **복사본 저장**: B INSERT 1회. A에는 저장하지 않는다.
6. 저장 목록에서 A/B를 번갈아 열어 선택 혼합이 없는지 확인. 새 설계의 기본값 초기화도 확인한다.

최대 쓰기 4회: 신규 설계 INSERT 2회 + 새 A 설계 UPDATE 2회. 실제 쓰기가 불명확한 네트워크 오류가 나면 자동 재시도하지 않고 목록 확인 후 중단한다. 잘못된 입력을 고치기 위한 추가 쓰기가 필요하면 범위를 먼저 보고한다.

## 저장 내용

`configuration.version = schema_version = 1`. 기존 requirements/mapping 유지 및 `planner` 추가:

```json
{
  "templateType": "extended",
  "enabledModules": ["attendance", "teams"],
  "repeatPrograms": true,
  "personHistory": true,
  "programStatistics": true,
  "multipleApplications": true
}
```

가상 질문·CSV 헤더만 사용한다. 실제 응답·교육생 개인정보·비밀번호·세션·Notion 토큰은 저장하지 않는다. 전체 Dry Run/요청 템플릿도 저장하지 않는다.

SQL/테이블/컬럼/RLS/Auth 설정 변경, 기존 사용자 설계 변경, Notion 요청, Git 커밋·push, Vercel 배포는 하지 않는다. 검증용 가상 설계 2개는 삭제하지 않고 남긴다. 실제 계정 변경·로그아웃·충돌 유발은 사용자 작업에 영향을 주지 않도록 자동/모의 검사 결과와 구분한다.
