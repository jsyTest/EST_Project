# NB-V2-005A 배포·인증 설정 검토안

기준일: 2026-10-29. **Git 커밋·push·Vercel 새 배포는 하지 않았다. 승인된 Supabase URL 변경은 브라우저에서 적용·새 탭 재조회 완료했다. 배포 승인은 받지 않았다.**

## 확인된 대상과 현재 상태

- 저장소: `jsyTest/EST_Project` (로컬 origin과 사용자 확인 일치).
- Production Branch: `main` (사용자 확인).
- Production: `https://pplus-rouge.vercel.app` (사용자 확인 + 공개 HTTPS 200).
- 기존 일회성 주소: `https://pplus-jr6959pvz-pplus1.vercel.app` (302 Vercel SSO). 이후 계정 배포 목록에서 main/8169eca의 이전 Production임을 확인했다. Preview가 아니다.
- 기준 커밋: `4bff220`. 공개 배포 대상 파일 18개가 이 커밋의 파일과 바이트 단위로 일치한다. 현재 배포의 대시보드 경로는 H8mMZAh6mBk4Vm2zdjktjUD5kdB8이며 Source main/4bff220355e63ee153fe6c947f09348fd2aa6ae2를 직접 확인했다.
- 기존 Auth는 이미 Production에 있다. 이번 로컬 수정은 미배포다.

## Supabase 설정: 현재 → 제안

대상 프로젝트: `pxkjxcryceqtjomgxyfe` / `https://pxkjxcryceqtjomgxyfe.supabase.co`.

사용자가 이번에 대시보드에서 확인한 최신 값:

| 항목 | 현재 | 변경 제안 |
| --- | --- | --- |
| Site URL | `http://localhost:3000` | `https://pplus-rouge.vercel.app` |
| Redirect URLs | 없음 | 아래 정확한 2개 주소 |

```text
https://pplus-rouge.vercel.app/login.html?confirmed=1
http://127.0.0.1:8766/login.html?confirmed=1
```

기존 NB-V2-005의 로컬 허용 주소 추가 보고와 현재 값이 다르다. 이번에 제공된 최신 값을 기준으로 기록하고 과거 보고를 현재 설정으로 간주하지 않는다. 이메일 인증 자동 완료는 false이며 이메일 확인 기능을 끄지 않는다. 메일 템플릿은 기본값이며 {{ .ConfirmationURL }} 링크를 사용함을 확인했고 변경하지 않았다. Preview 주소·와일드카드를 임의로 추가하지 않는다.

이 변경은 가입 확인 메일의 기본 복귀 위치를 localhost에서 실제 운영 도메인으로 바꾸고, 코드가 요청하는 정확한 Production/로컬 callback을 허용한다. 기존 로그인 계정·업무 데이터·비밀번호 정책은 변경 대상이 아니다. **사용자가 이 변경안에 대해 “Supabase 연결 기능 설치 후 Codex 변경 승인”이라고 답했다. 재승인은 요구하지 않는다. 연결 후 승인된 URL 설정만 실제 변경했고 새 탭에서 정확한 Site URL과 목록 2개를 재조회했다. 적용 완료다.**

## 로컬 배포 준비물

수정된 화면 동작:

1. `result.html`: 없는 로고 대신 기존 실제 로고 사용.
2. `js/app.js`: 잘못된 저장 입력은 빈 상태로 처리하고, 저장 실패 시 입력 유지·오류 표시·이동 중단.
3. `index.html`: 저장 실패 안내 영역.

확인된 공개 노출 수정 준비:

- 현재 Production은 `/scripts/notion-poc/cli.mjs`와 `/docs/auth/NB-V2-005_REPORT.md`를 HTTP 200으로 제공한다.
- `.env`, `.git/config`, 실행 manifest 경로는 404였고 확인한 응답에서 알려진 Notion 토큰/Secret Key 표식은 발견되지 않았다. 모든 원격 파일을 검사했다는 뜻은 아니다.
- 로컬 `scripts/deployment/build-static.mjs`는 허용한 브라우저 파일 18개만 `public-dist/`로 복사한다. 문서·CLI·테스트·비밀 설정·실행 상태는 출력에 없다.
- `vercel.json`: `framework: null`, Build Command `node scripts/deployment/build-static.mjs`, Output Directory `public-dist`.
- `.gitignore`: 생성 출력 폴더 제외.

```sh
node scripts/deployment/build-static.mjs
node --test scripts/notion-poc/tests/*.test.mjs
```

로컬 빌드·103개 검사 통과. 계정에서 Framework Other, 빈 Root Directory(저장소 루트), Node 24.x를 확인했다. Build/Output override 세부값은 미확인이다. 향후 Vercel이 이 저장소 루트를 사용하고 repo 설정을 적용하는지 Preview에서 먼저 확인해야 한다. 실제 서비스의 파일 경로·Auth 설정·CDN은 유지한다. SPA 전체 경로 재작성이나 새 Functions는 추가하지 않는다.

## 배포할 공개 파일

HTML: index.html, login.html, result.html, mapping.html.
CSS: style.css, auth.css, mapping.css.
JS: app.js, mock-data.js, supabase-client.js, auth-bootstrap.js, auth-core.js, auth.js, mapping-ui.mjs, mapping/model.mjs, mapping/parse.mjs, mapping/csv.mjs.
이미지: assets/logo_1.png.

정확한 경로·해시는 함께 저장한 `NB-V2-005A_PUBLIC_MANIFEST.json`을 참고한다. 이 manifest는 배포 출력 안에 넣지 않는다.

## 승인 후 안전한 Preview 절차

1. Production에 연결된 main에 바로 push하지 않는다. main push가 자동 Production 배포로 이어질 수 있다.
2. 사용자에게 실제 대상 프로젝트/팀·배포 ID·원격 Root Directory/빌드 설정을 확인받는다. 계정 연결이 없으면 이 단계는 수동 확인이다.
3. 사용자 승인 범위에 따라 현재 검토된 소스로 Preview를 만든다. 별도 브랜치 생성·커밋·push를 이용한다면 그 작업도 명시적 승인에 포함한다. CLI/연결 도구 직접 배포도 배포 승인이 필요하다.
4. 발급된 실제 Preview URL을 확인한다. 그 전에는 URL을 만들어내지 않는다. 이메일 검증이 필요하면 그 URL의 `/login.html?confirmed=1` 하나를 추가하는 별도 설정 승인을 받는다.
5. 18개 파일·정적 경로·새로고침·Auth·메일 복귀·Mock/매핑·모바일·교차 탭을 검증하고 내부 문서/CLI가 404인지 확인한다.
6. Preview 통과 뒤 Production 승격/재배포를 별도로 승인받는다. 이번 문서만으로 Production 변경 권한이 생기지 않는다.

## 예상 영향과 복구

- 정상 입력/결과/매핑·인증 UI 경로는 동일하다.
- 잘못된 저장 입력은 오류 대신 빈 결과로, 저장소 실패는 오류 안내로 바뀐다.
- 다음 올바른 출력 배포부터 내부 문서·CLI URL은 404가 되어야 한다. 브라우저용 웹 파일은 계속 제공한다.
- 배포 전 현재 Production Deployment ID를 계정에서 기록한다. 문제 발생 시 그 배포를 재승격/롤백하고 확인된 Git 소스와 비교한다. 현재 복구 기준 배포 경로 H8mMZAh6mBk4Vm2zdjktjUD5kdB8은 확보했으며, 실제 롤백은 하지 않았다.
- Supabase 설정의 변경 전 복구 값은 localhost Site URL/빈 목록이다. 로컬/운영 메일 복귀를 끊을 수 있으므로 롤백도 영향 검토·승인 후 한다. 코드 배포 롤백만으로 Supabase 설정이 되돌아가지는 않는다.

근거: [Vercel Git 배포](https://vercel.com/docs/git), [Vercel 저장소 설정](https://vercel.com/docs/project-configuration/vercel-json), [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
