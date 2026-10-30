# NB-V2-009A 실제 DB 생성 승인 검토안

2026-10-30 KST. **승인 전에 확정한 검토안. 이후 사용자가 동일 범위를 별도 승인했고 DB 1개 생성·재조회에 성공했다. 최종 결과는 작업 보고서/실제 결과 JSON에 기록한다.**

## 대상·이미 승인된 부모

- 개인 ‘지승엽의 워크스페이스’ (`10e1f60f-fdfa-8128-b201-00037feeb155`).
- 생성용 연결 ‘EST 개인 테스트’ (`4081f60f-fdfa-8154-b4cc-002726360706`). 실제 REST bot/workspace ID 일치를 읽기로 확인.
- 부모: [NB-V2-009A 테스트](https://www.notion.so/4091f60ffdfa818bb496ceed30116dc6), `4091f60f-fdfa-818b-b496-ceed30116dc6`.
- 이 빈 비공개 부모 페이지 1개는 사용자의 ‘대신 생성해주면 안 돼?’ 요청으로 MCP draft 방식 생성 완료. 본문 없음. 기존 002A의 자식이 아님. 사용자가 생성용 연결을 추가한 후 부모 읽기·제목·기존 DB 0개 확인 완료.
- 부모 생성 승인은 아래 DB 생성 승인과 구분했다. 이후 DB도 아래 고정 범위로 별도 승인·실행했다.

## 고정 계획과 실행

- runId: `nb-v2-009a-basic-001`
- planId: `plan-316dfc0fed39abe5`
- plan SHA-256: `5c97427997f9afc9af6f50196f6c6b411f6e07cbeeba3ba5f8cd7f093002f2ab`
- 대상/요청 SHA-256: `4a44b1da2a4921fcc9a33b6955624e1c1d907e50b7d6920f7b55a375a060552a`
- 입력: `NB-V2-009A_input/configuration-v1.json`. 실제 사용자가 제공한 모집 폼이 아니라 이번 검증용으로 작성한 **가상 질문·헤더·명시적 선택지**다. 교육생 응답 없음. 테스트 색상을 명시했다.
- 실행 계획: `NB-V2-009A_input/plan.json`. 기본형·확인/차단 0. 파서나 규칙을 생성 시 다시 실행하지 않는다.
- 전체 요청 설계: `NB-V2-009A_input/execution-review.json`.

## 생성할 빈 구조

DB / Data Source 이름: **[TEST] NB-V2-009A 기본형 신청**

| 속성 | 유형 | 명시된 옵션/색상 |
| --- | --- | --- |
| 성명 | Title | 없음 |
| 이메일 | Email | 없음 |
| 연락처 | Phone number | 없음 |
| 신청 동기 | Rich text | 없음 |
| 참여자 유형 | Select | 가상 일반 참가=purple / 가상 학생 참가=green |
| 신청 과정 | Multi-select | 가상 과정 A=blue / 가상 과정 B=purple |
| 선정 상태 | Select | 접수=blue / 선정=green / 대기=yellow / 미선정=gray / 취소=red |

- DB 1개·초기 DS 1개·속성 7개·응답 행 0개·추가 페이지 0개.
- 생성 POST 최대 1회. 처음부터 모든 속성을 initial_data_source에 포함한다.
- 생성된 DS 이름이 계획과 다르면 해당 신규 DS에 이름 PATCH 최대 1회. 이름이 이미 같으면 생략한다.
- 조회는 GET 부모/DB/DS, 빈 구조 확인용 POST query(page_size=1, readOnly=true). 행 생성 POST가 아니다. 반환 행의 내용은 저장/출력하지 않는다.
- 자동 재시도 0. 429도 이번 실행기에서는 멈춘다.
- 기존 002A 부모/페이지/6DB·회사 공간·Supabase·Vercel·Git 변경 없음.

## 실패와 제한

- DB 생성 후 조회/이름 설정 실패 시 빈 DB 1개가 남을 수 있다. 자동 삭제/새 DB 재생성 없음.
- 생성 응답 유실 시 부모의 설명 marker를 읽어 후보만 보고하며 자동 채택·재생성하지 않는다.
- 별도 `.notion-generation-state/`에 run/부모 잠금과 원자적 manifest/등록부를 먼저 기록한다.
- 동일 실행 재호출은 읽기 검증만 한다. 별도 복제 실행은 새로운 runId와 추가 승인 필요.
- 읽기 접근은 확인했지만 Insert/Update capability 자체는 읽기 결과만으로 증명할 수 없다.
- Notion MCP가 Free 블록 한도 도달과 임시 유예를 안내했다. 일반 REST 생성 가능 여부는 미검증이며 403 등으로 거절될 수 있다. 결제·요금제 변경이나 MCP DB 생성 우회는 하지 않는다.
- Status·URL·Relation/Rollup/Formula는 이번 실행기에서 차단한다. URL/Status가 Notion 전체에서 미지원이라는 뜻은 아니다.

## 준비 검사

Node **223 통과 / 실패·건너뜀 0**, 기존 200+신규 23. V1 256조합 유지. 공개 빌드 26개 파일 유지. 웹 생성 버튼·브라우저 토큰 노출 경로는 추가하지 않았다.

아래 쓰기는 요청문 8절에 따라 이 구체적 범위의 별도 승인을 받은 후에만 실행한다.
