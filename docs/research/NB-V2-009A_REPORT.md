# [NB-V2-009A 작업 보고서]

2026-10-30 KST. **모의 구현 완료 / 승인된 기본형 DB 1개 실제 생성·readback 완료 / 미배포.**

## 1. 시작·종료 Git

시작 `main / b34f80b1215de7a19b5246ccb5b2c1f532336def` (`변경 구현 5`), 작업 트리 clean. 직전 008B는 사용자의 최신 커밋에 반영되어 있었다. 종료 커밋 동일. 기존 파일/미커밋 내용을 삭제하지 않았고 이번 변경만 미커밋이다.

## 2. 변경 파일

- 신규 `scripts/basic-notion/plan.mjs`: 기본형 제한·계획 동결·SHA-256·승인/대상 검증·API 요청 변환.
- 신규 `scripts/basic-notion/store.mjs`: 기존 RunStore를 재사용한 전용 잠금/내구 저장.
- 신규 `scripts/basic-notion/engine.mjs`: 사전 확인·생성·원격 ID 기록·readback·재실행/불명확 상태 처리.
- 신규 `scripts/basic-notion/cli.mjs`, `README.md`: dry-run/preflight/apply/resume/verify/inspect.
- 신규 `scripts/notion-poc/tests/basic-execution.test.mjs`: 모의/오류/CLI 검사 23개.
- `.gitignore`에 `.notion-generation-state/` 추가.
- 신규 생성 검토안·API 조사·본 보고서·ChatGPT 인계문·가상 입력/계획/대상/요청 설계·실제 결과/메타데이터/근거 JSON.

기존 웹 코드·저장 모델·Auth·Notion PoC·공개 빌드 허용 목록은 변경하지 않았다.

## 3. 실행기 구조

기존 `NotionClient`, `normalizeId`, `validateRunId`, `RunStore`를 재사용하고 실행 계층을 별도 디렉터리로 분리했다. 개인 workspace/bot ID·부모 제목·부모 계층·보호 ID를 검사한다. 부모 읽기만으로 Insert/Update capability나 공유 범위가 완전히 증명됐다고 표시하지 않는다.

생성 전에는 로컬 계획/승인 검사와 읽기 사전 확인을 수행한다. 부모 페이지 생성은 사용자의 별도 요청으로 MCP draft 1개를 먼저 만들었고, DB는 다시 구체 범위 승인을 받은 뒤 새 CLI로 생성했다.

## 4. 계획→요청 변환

planVersion 1의 basic 단일 DB/DS와 속성 목록을 고정한다. 생성 시 파서를 실행하거나 DB 구조를 다시 추천하지 않는다. planId와 별도로 전체 계획 SHA-256, 부모/run/요청을 포함한 requestHash를 승인에 결합한다.

`requestTemplates`를 실행하지 않고 properties/selectOptions의 허용된 정의만 변환한다. 전체 속성을 `POST /v1/databases`의 `initial_data_source.properties`에 포함한다. Title은 생성 시 처음부터 하나다. 새로운 DS 이름이 다를 때만 신규 소유 객체에 title PATCH를 허용하며 이번 실제 실행에서는 필요하지 않았다.

원래 `plan.json`의 Dry Run 플래그는 고정 스냅샷이므로 변경하지 않았다. 실제 성공은 실행 manifest 및 `NB-V2-009A_LIVE_RESULT.json`의 `verification.ok:true`로 구분한다.

## 5. 지원 속성

Title / Rich text / Email / Phone number / Number / Date / Checkbox / Select / Multi-select. 실행기 한도는 속성 1~100개, 선택 옵션 최대 100개다. 범위를 벗어나면 차단하며 잘라내지 않는다.

실제 API 확인 유형은 Title/Rich text/Email/Phone/Select/Multi-select 6종이다. Number/Date/Checkbox는 이번에는 모의 확인만 했다. URL은 공식 API에는 있지만 기존 계획 유형 계약까지 확장하지 않아 이번 실행기에서는 차단한다.

## 6. Status·색상 제한

Status는 이번 실행기에서 차단했다. 옵션/그룹의 실제 생성 검증을 완료했다고 표시하지 않으며 Select나 Text로 바꾸지 않는다. Relation/Rollup/Formula도 실행 범위 밖이다.

기존 허용 색상만 사용하고 옵션 이름/개수/색상·원격 옵션 ID를 readback했다. 이번 명시적 가상 폼의 옵션만 사용했으며 임의로 응답 값에서 선택지를 추정하지 않았다. 공식 API 근거와 이번 지원 제한은 `NB-V2-009A_API_NOTES.md`에 정리했다.

## 7. 실행 manifest

`.notion-generation-state/nb-v2-009a-basic-001.json`과 부모별 targets 등록부를 사용한다. 기존 `.notion-poc-state/`를 거부하며 덮어쓰지 않는다.

runId/planId/planHash/requestHash/부모/workspace/bot·동결 spec·원격 DB/DS ID·속성 ID·단계/시각·오류·검증 결과를 기록한다. 승인 파일은 별도 approvals 하위에 있다. 모두 Git에서 제외했다. 파일 0600, 디렉터리 0700, 파일 fsync→원자 rename→지원되는 디렉터리 fsync를 사용한다.

## 8. 중복 방지

run 잠금과 부모 단위 잠금·사전 등록을 적용했다. 같은 run에서 계획/대상이 바뀌면 거부한다. 다른 run이라도 같은 부모의 선행 실행이 불명확하면 거부한다. 명시적인 새 복사 승인이 없으면 같은 부모에 추가 DB를 만들지 않는다.

응답 유실 시 marker로 부모의 후보 DB를 찾아 보고하지만 자동 채택/생성하지 않는다. known ID의 resume은 조회만 수행한다. 이번 실제 동일 run 재호출은 쓰기 차단 클라이언트에서 **읽기 요청 6회·추가 쓰기 시도 0회**로 검증을 다시 통과했다.

## 9. 오류·재시도

기본형 이외·잘못된 버전·확인/차단 항목·Title/이름/유형/옵션 오류·잘못된 부모/연결·승인 불일치를 사전 차단한다. HTTP 4xx, 요청 제한, transport 불확실, 일부 생성 후 실패, 조회 실패, 스키마 불일치를 분리한다.

새 실행기의 maxRetries=0은 429도 자동 재시도하지 않는다. 기존 PoC 클라이언트의 정책은 변경하지 않았다. 실패 시 원격 자동 삭제/임의 수정 없음. 부분 실패 또는 불명확 실행은 상태를 보존하고 별도 검토한다. API 본문/헤더·원래 예외 메시지를 로그/manifest에 복사하지 않는다.

## 10. 실제 승인

부모 생성: 사용자가 ‘대신 생성해주면 안 돼?’라고 요청하여 빈 비공개 테스트 부모 1개를 생성했다. 이어 사용자가 ‘EST 개인 테스트’ 연결을 추가했다. 최초 REST 404는 연결 추가 후 해소됐다.

DB 생성: 코드/모의 검사/읽기 확인 및 생성 검토안 제공 후 사용자가 **‘승인 — 위 빈 DB 1개 생성·재조회 실행’**을 선택했다. 범위는 DB 1·초기 DS 1·속성 7·행 0·생성 POST 1+신규 DS 이름 PATCH 최대 1이었다. 실제 요청 해시가 검토안과 같은지 확인하고 비공개 승인 기록을 작성한 뒤 실행했다.

## 11. 실제 생성 위치·내용

- 개인 ‘지승엽의 워크스페이스’.
- 부모 [NB-V2-009A 테스트](https://www.notion.so/4091f60ffdfa818bb496ceed30116dc6).
- 생성 DB [TEST] NB-V2-009A 기본형 신청: [열기](https://www.notion.so/a72bbd64de624a95a39be75ad5db01a1).
- Notion 서버 created_time: `2026-10-30T00:08:33.996+00:00`, **2026-10-30 09:08:33.996 KST**.
- 속성 7개: 성명 Title, 이메일 Email, 연락처 Phone, 신청 동기 Rich text, 참여자 유형 Select, 신청 과정 Multi-select, 선정 상태 Select.
- 가상 선택지/헤더만 사용. 실제 이름·이메일·연락처·CSV 응답 행 삽입 없음.
- 에이전트 콘텐츠 쓰기는 MCP 부모 페이지 생성 1건과 REST DB 생성 POST 1회. DS 이름 PATCH는 0회. MCP 내부 HTTP 요청 수는 도구가 공개하지 않으므로 임의 합산하지 않는다.

## 12. 원격 ID

- runId: `nb-v2-009a-basic-001`
- planId: `plan-316dfc0fed39abe5`
- plan SHA-256: `5c97427997f9afc9af6f50196f6c6b411f6e07cbeeba3ba5f8cd7f093002f2ab`
- request SHA-256: `4a44b1da2a4921fcc9a33b6955624e1c1d907e50b7d6920f7b55a375a060552a`
- database_id: `a72bbd64-de62-4a95-a39b-e75ad5db01a1`
- data_source_id: `d67da62e-98fc-4ec9-b16e-dff7ca76a8bc`
- 속성 논리 ID→실제 ID 7개 매핑 기록. Title ID=`title`; URL 인코딩된 나머지 ID를 반환값 그대로 보존했다.

## 13. 읽기 재검증

**실제 API 검사 34/34 통과.** DB/DS 이름·부모/marker·초기 DS 개수·속성 개수/이름/유형/ID·Title 하나·선택 옵션 개수/이름/색상/고유 ID·행 0개를 확인했다. 부모/소유 관계 일부 검사는 실패 시 즉시 중단하는 guard이며 34개 목록 외에도 적용된다.

| 옵션 속성 | 실제 확인한 색상 |
| --- | --- |
| 선정 상태 | 접수 blue / 선정 green / 대기 yellow / 미선정 gray / 취소 red |
| 참여자 유형 | 가상 일반 참가 purple / 가상 학생 참가 green |
| 신청 과정 | 가상 과정 A blue / 가상 과정 B purple |

빈 구조 확인 query는 POST지만 readOnly=true, page_size=1의 조회다. 행을 쓰거나 반환 행 내용을 저장한 것이 아니다. 최초 완료와 쓰기 차단 재호출 모두 통과했다.

## 14. 기존 기능 회귀

기존 200개 Node 검사와 V1 Mock 256조합을 유지했다. 웹 코드·Auth·저장 모델/JSON·매핑·색상·공개 빌드 규칙·기존 CLI는 변경하지 않았다. 기존 002A 원격 객체에는 수정 요청을 보내지 않았다. 이번 작업에서 기존 002A 전체 130개 API 검사를 재실행한 것은 아니다.

## 15. 자동 검사

**223 통과 / 실패 0 / 건너뜀 0**: 기존 200+신규 23. 폼/CSV/결합 변환, 기본 유형/옵션, Status/URL 차단, 승인/Title/이름/색상 오류, 보호 경로/워크스페이스, manifest/잠금, 중복·응답 유실·부분 실패·readback·권한/429·CLI 무인증 Dry Run·오류 비밀값 배제 검사 포함.

공개 빌드 26개 파일 유지, `git diff --check`와 새 모듈 구문 검사 통과. 이번에는 프런트엔드를 수정하지 않아 별도 신규 브라우저 회귀를 실행하지 않았다. Notion 실제 화면을 직접 열어 시각 검사한 결과도 아니다.

## 16. 실제 API 결과·환경 제한

승인된 빈 기본형 DB 생성 성공, DB/DS/속성 ID·옵션/색상·빈 구조 검증 성공, 동일 실행 재호출 추가 쓰기 0.

Notion MCP는 부모 생성 때 Free 블록 한도 도달과 임시 유예를 안내했다. 그럼에도 이번 일반 REST DB 생성은 성공했다. 이 한 번의 성공을 향후 생성 가능성/플랜 제한 해소로 일반화하지 않는다. 요금제·공개 공유·초대는 변경하지 않았다.

## 17. Supabase·Vercel·Git

Supabase 원격 읽기/쓰기·Auth/RLS 변경 없음. Vercel Preview/Production 배포 없음. Git commit/push 없음. Notion 토큰은 기존 로컬 환경에서만 사용하고 브라우저/계획/보고서/로그에 넣지 않았다. 웹사이트 생성 버튼을 연결하지 않았다.

## 18. 미검증

- Number/Date/Checkbox의 실제 새 API 생성 결과.
- Status/URL 및 관계형·Rollup·Formula 실행, 일반/확장형 생성.
- 신규 DS 이름 PATCH의 실제 실행/실패/재개: 이번에는 불필요해 모의만 검사.
- 실제 네트워크 유실/프로세스 강제 종료/디스크 장애·실제 401/403/429: 모의로만 검사.
- 임의 과거 상태의 자동 복구/후보 DB 자동 채택·안전한 기존 DB 수정은 미구현.
- 실제 사용자 응답 가져오기·고유 사람 연결·웹 생성 API/OAuth·회사 복제·Notion UI 시각 검증.

## 19. 다음 단계

기본형 결과와 범위 제한을 먼저 검토한다. 다음 일반형 실행은 별도 승인 범위에서 DB/DS ID manifest를 3개로 확장하고, 역관계 생성/재조회/이름 설정과 Rollup/Formula 의존 순서를 검증한다. 기존 PoC를 그대로 대체하지 않는다.

승인된 가상 행으로 사람 2명/신청 3건·관계 양방향·실제 계산값을 비교한 뒤 확장 모듈을 검토한다. 웹 API/OAuth·사용자별 권한/작업 이력·토큰 보관·중복 요청 제어는 별도 설계한다. 회사 공간 복제는 여전히 별도 테스트 워크스페이스 확보 후의 독립 실험이다.
