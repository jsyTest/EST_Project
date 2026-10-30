# [ChatGPT 전달용] NB-V2-009A 기본형 Notion DB 실행기 및 실제 생성 검증 결과

## 판정

**모의 구현과 승인된 개인 Notion 기본형 DB 1개 실제 생성/readback을 완료했습니다. 미배포이며 웹 생성 버튼은 연결하지 않았습니다.**

Git 시작/종료는 main / b34f80b1215de7a19b5246ccb5b2c1f532336def입니다. 시작 clean, 이전 008B는 최신 커밋에 반영되어 있었습니다. 이번 변경만 미커밋이고 commit/push는 하지 않았습니다.

## 구현

새 scripts/basic-notion/{plan,store,engine,cli}.mjs와 README, 신규 검사·검토/결과 문서를 추가했습니다. 기존 NotionClient/RunStore/ID 검증을 재사용합니다. .gitignore에는 별도 .notion-generation-state/만 추가했습니다. 웹 코드·계획 생성기·저장 모델·기존 PoC 실행기를 변경하지 않았습니다.

008B planVersion 1 기본형을 입력받아 DB 1개·초기 DS 1개·Title 1개의 요청을 만듭니다. 생성 시 파서/추천을 다시 실행하지 않습니다. 전체 계획 SHA-256과 run/부모/요청 SHA-256을 실제 승인에 결합합니다. 계획의 requestTemplates를 그대로 실행하지 않고 지원 필드만 명시적으로 변환합니다.

지원 유형은 Title/Rich text/Email/Phone/Number/Date/Checkbox/Select/Multi-select입니다. Status·URL·Relation/Rollup/Formula·일반/확장형·확인/차단이 남은 계획·기존 DB 변경은 차단합니다. URL/Status가 Notion 자체에서 불가능하다는 의미는 아닙니다. 최대 속성/옵션 수와 허용 색상을 검사하고 unsupported 설정을 조용히 버리지 않습니다.

## 승인과 실제 대상

사용자가 부모도 대신 만들라고 요청하여 개인 공간에 MCP draft 방식의 빈 비공개 ‘NB-V2-009A 테스트’ 페이지 1개를 만들었습니다. 사용자가 생성용 연결 ‘EST 개인 테스트’를 추가한 뒤 REST bot/workspace/부모/빈 상태를 읽기 확인했습니다. 초기 404는 연결 추가 후 해소됐습니다.

그 후 가상 폼·CSV로 만든 속성 7개, 빈 DB 1개, 생성 POST 1회+신규 DS 이름 PATCH 최대 1회, 행 0의 구체 검토안을 제공했습니다. 사용자는 ‘승인 — 위 빈 DB 1개 생성·재조회 실행’을 선택했습니다. 승인 해시와 실제 요청 일치를 확인한 후 실행했습니다.

- 개인 워크스페이스: 지승엽의 워크스페이스
- 부모: https://www.notion.so/4091f60ffdfa818bb496ceed30116dc6
- DB: [TEST] NB-V2-009A 기본형 신청
- DB 링크: https://www.notion.so/a72bbd64de624a95a39be75ad5db01a1
- database_id: a72bbd64-de62-4a95-a39b-e75ad5db01a1
- data_source_id: d67da62e-98fc-4ec9-b16e-dff7ca76a8bc
- runId: nb-v2-009a-basic-001
- planId: plan-316dfc0fed39abe5
- plan SHA-256: 5c97427997f9afc9af6f50196f6c6b411f6e07cbeeba3ba5f8cd7f093002f2ab
- request SHA-256: 4a44b1da2a4921fcc9a33b6955624e1c1d907e50b7d6920f7b55a375a060552a
- Notion 서버 생성 시각: 2026-10-30 09:08:33.996 KST

## 실제 속성·색상 확인

| 속성 | 실제 유형·옵션 |
| --- | --- |
| 성명 | Title |
| 이메일 | Email |
| 연락처 | Phone number |
| 신청 동기 | Rich text |
| 참여자 유형 | Select: 가상 일반 참가 purple / 가상 학생 참가 green |
| 신청 과정 | Multi-select: 가상 과정 A blue / 가상 과정 B purple |
| 선정 상태 | Select: 접수 blue / 선정 green / 대기 yellow / 미선정 gray / 취소 red |

실제 사람/연락처/이메일·CSV 응답 행은 넣지 않았습니다. 가상 질문·헤더와 명시적 가상 선택지를 구조 검증에 사용했습니다.

**실제 API 검사 34/34 통과**: DB/DS 이름, 속성 개수/이름/유형/ID, Title 하나, 옵션/색상/고유 ID, 빈 구조. 부모·소유 marker·DS 소속도 확인했습니다. 실제 REST 쓰기는 DB 생성 POST 1회였고 DS 이름이 이미 같아 PATCH는 0회입니다. 부모 페이지 MCP 생성은 별도 승인된 1건입니다.

## manifest·중복 방지

별도 .notion-generation-state/에 run/부모별 잠금과 등록부를 사용합니다. 파일 0600·디렉터리 0700, 사전 기록·파일 fsync·원자 rename을 적용했습니다. 승인·상태 파일은 Git에서 제외합니다. 기존 .notion-poc-state/는 거부합니다.

계획/run/대상 해시·원격 DB/DS ID·논리/원격 속성 ID 매핑·단계·검증·오류를 보관합니다. POST 응답 유실은 불명확 상태로 기록하고, 부모 marker 후보를 읽더라도 자동 채택/재생성하지 않습니다. 같은 run의 resume은 알려진 ID를 읽기 검증할 뿐 쓰기를 반복하지 않습니다. 새 복사는 새 run과 별도 승인, 같은 부모의 추가 복사 허용이 필요합니다. 미해결 선행 실행은 차단합니다.

이번 실제 동일 run 재호출을 쓰기 차단 클라이언트로 수행했고 읽기 요청 6회, 추가 쓰기 시도 0회, 34개 검사 재통과를 확인했습니다. query는 readOnly POST이며 행 생성이 아닙니다.

008B plan.json의 Dry Run 플래그는 동결된 입력이라 변경하지 않았습니다. 실제 성공은 별도 실행 manifest/result의 verification.ok:true에 기록했습니다.

## 검사·보존·한계

- Node 223 통과 / 실패·건너뜀 0: 기존 200+신규 23.
- V1 Mock 256조합 유지, 기존 Auth/저장/매핑/색상/CLI 검사 통과.
- 공개 빌드 26개 유지. 새 실행기는 브라우저 자원에 포함하지 않음.
- 기존 002A·회사 자료 수정 요청 없음. 기존 002A 전체 API 검사를 이번에 다시 한 것은 아님.
- Supabase 원격 조회/변경·Auth/RLS 변경 없음. Vercel 배포·Git commit/push 없음.
- 토큰은 기존 로컬 환경에서만 사용. 계획/로그/문서/브라우저에 넣지 않음.
- 새 프런트엔드 수정이 없어 신규 브라우저 회귀/Notion UI 시각 검증은 수행하지 않음.

Number/Date/Checkbox와 신규 DS 이름 PATCH, 실제 통신 유실/디스크 장애/401/403/429 처리는 이번에는 모의만 검사했습니다. Status/URL·3DB 관계/계산·응답 가져오기·웹 생성/OAuth·회사 복제는 미실행/미구현입니다.

부모 생성 때 MCP의 Free 블록 한도·유예 안내가 있었지만 이번 REST DB 생성은 성공했습니다. 향후 제한이 해소됐다고 일반화하지 않았고 요금제는 변경하지 않았습니다.

## 다음 단계

제한된 기본형 결과를 먼저 검토한 뒤 일반형을 별도 승인 범위로 확장하는 것을 권고합니다. 원격 ID manifest 3DB 확장, 역관계 재조회/이름 설정, Rollup/Formula 의존 순서, 승인된 가상 2명/3신청의 실제 값 비교가 필요합니다. 웹 API/OAuth·이력/토큰·중복 요청 제어와 회사 복제는 독립 과제입니다.

> 위 내용은 Codex가 EST_Project에서 수행한 NB-V2-009A 결과입니다.
>
> ChatGPT는 다음 내용을 검토해 주세요.
>
> 1. NB-V2-008B 계획을 실제 Notion API 요청으로 정확하게 변환했는지 평가해 주세요.
> 2. 기본형 DB 1개 생성이 실제로 확인됐는지 검토해 주세요.
> 3. 속성·옵션·색상 생성 및 readback 결과를 확인해 주세요.
> 4. 원격 ID manifest와 중복 생성 방지가 안전한지 평가해 주세요.
> 5. 기존 Supabase Auth·저장·폼/CSV 매핑·색상·Notion PoC를 보존했는지 확인해 주세요.
> 6. 모의 테스트와 실제 API 검증을 구분해 주세요.
> 7. 다음 단계인 일반형 3DB 관계형·Rollup·Formula 생성의 준비 상태와 위험을 정리해 주세요.
> 8. 사용자별 웹 생성 API와 회사 워크스페이스 복제 검증을 위한 향후 과제를 제안해 주세요.
>
> 실행하지 않은 생성·검증 항목은 반드시 미실행 또는 미검증으로 분류해 주세요.
