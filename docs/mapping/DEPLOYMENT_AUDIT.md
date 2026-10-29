# NB-V2-003 Vercel 배포·보안 점검

기준일: 2026-10-29. 사용자가 Vercel 배포 완료와 Supabase 미연결을 명시했다. 이번 작업은 읽기 전용 점검이며 운영 설정·환경변수·배포·Git push를 수행하지 않았다.

## 확인된 사실과 미확인 항목

| 항목 | 결과 / 근거 |
| --- | --- |
| 로컬 Git | main, 시작 HEAD 8169eca(추가 구현 2), 최초 clean |
| 원격 저장소 | origin: https://github.com/jsyTest/EST_Project.git |
| 로컬 웹 구조 | index.html / result.html, CSS/JS 정적 파일. 이번 mapping.html도 정적 ES 모듈 |
| 서버 Functions | 로컬에 api/ 또는 Functions 구현, package.json, vercel.json 없음 |
| Vercel 로컬 연결 | .vercel/project.json 없음. 프로젝트/팀/배포 설정을 로컬에서 확인할 수 없음 |
| Notion 웹 연동 | 없음. 실제 호출은 Node CLI에만 있으며 웹 입력·결과는 기존 Mock, 새 화면은 스키마 Dry Run |
| Supabase | 코드·의존성·설정·브라우저 호출에 적용 없음. 이번에도 연결하지 않음 |
| 제공 URL | https://pplus-jr6959pvz-pplus1.vercel.app |
| 공개 응답 | HTTPS 읽기 요청에서 HTTP 302, Vercel 인증/SSO 경로로 이동. 인증 nonce는 보고서에 보존하지 않음 |
| 운영 화면/배포 커밋 | 인증 전 응답만 확인했으므로 현재 배포 HTML·실행 기능·로컬 HEAD 일치 여부 미검증 |
| Git 자동 배포 | 저장소 Git remote만 확인. Vercel Git 연결·Production Branch·자동 배포 설정은 미확인 |
| 원격 환경변수/아티팩트 | 조회하지 않았으며 안전성을 증명한 것이 아님 |

Git 연동을 사용하면 branch push/Production Branch 변경이 배포로 이어질 수 있다. 이번에는 커밋·push·재배포를 하지 않았다. 사용자는 Vercel 프로젝트의 Settings → Git과 해당 Deployment의 Source/Commit, Build and Deployment의 Root/Output Directory를 읽어 실제 연결을 확인할 수 있다. 설정 변경은 이번 작업에 포함하지 않는다. [공식 Git 배포 안내](https://vercel.com/docs/git).

## 현재 코드의 보안 범위

- 신규 매핑 화면은 외부 fetch·업로드·localStorage 저장·Notion 토큰 입력을 하지 않는다. 폼 원문·CSV 헤더만 메모리에 두고 사용자가 JSON으로 내려받을 수 있다. 실제 응답 행을 넣지 않는 입력 범위다.
- CSV는 첫 레코드가 끝나는 청크에서 중단하며 응답 바이트를 파싱/디코딩/저장하지 않는다. 파일명·응답 행 로그를 남기지 않는다.
- .env와 .notion-poc-state는 Git 제외이며 로컬 토큰을 공개 웹 코드에 넣지 않았다. .env 제외 여부만으로 이미 배포한 아티팩트가 안전하다고 단정하지 않는다.
- 기존 PoC의 쓰기 명령은 로컬 CLI로 유지하고 공개 HTTP 쓰기 엔드포인트를 만들지 않았다. 테스트 부모 확인·실행 상태·중복 방지 장치를 유지했다.
- 로컬 새 화면은 UI 텍스트를 textContent/DOM 요소로 표시한다. 질문/컬럼명을 HTML로 삽입하지 않는다.
- 루트 전체를 무분별하게 정적 산출물로 배포하면 내부 문서/CLI 소스가 포함될 수 있다. 실제 Root/Output Directory와 산출물을 추후 확인해야 한다. 비밀 파일·실행 상태를 정적 산출물에 복사하지 않고 공개 웹 파일만 내보내는 구성을 권한다. 이번에는 Vercel 설정을 변경하지 않았다.

## 웹 생성 기능 전에 필요한 설계

1. Notion 토큰은 서버 전용 비밀 환경변수/보안 저장소로 관리한다. 클라이언트 JS·HTML·소스맵·공개 접두사 변수·정적 JSON에 주입하지 않는다. 환경변수는 Production/Preview/Development를 분리하고 Preview에 회사 토큰을 공유하지 않는다. [Vercel 환경변수](https://vercel.com/docs/environment-variables).
2. 서버 생성 기능에 인증·사용자별 연결 소유권·승인 대상 확인·유효성 검사·요청 제한을 설계한다. 인증 없는 공개 쓰기 API를 만들지 않는다. 현재 이 기능은 미구현이다.
3. CLI의 로컬 상태 파일/잠금을 서버리스 영구 실행 기록으로 사용하지 않는다. 영구 상태·작업 ID·중복 방지·부분 실패 복구는 별도 저장소/작업 실행 구조가 필요하다. Supabase가 유일한 선택지는 아니며 이번에 임의로 연결하지 않았다. [Functions 런타임](https://vercel.com/docs/functions/runtimes).
4. Vercel Hobby는 공식 안내상 개인·비상업적 용도에 한정된다. 현재 계정 요금제는 확인하지 않았으며, 회사 실사용 전에 요금제와 사용 조건을 검토해야 한다. [Hobby 안내](https://vercel.com/docs/plans/hobby).

현재 로컬 코드의 역할은 정적 설계·매핑 화면과 별도 로컬 생성 CLI다. Vercel 배포 완료를 웹 Notion 생성 완료로 취급하지 않는다.
