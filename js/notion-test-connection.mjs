const messages = {
  test_connection_not_configured: '개인 Notion 연결 미설정 · 실제 토큰 설정과 원격 확인은 별도 승인이 필요합니다.',
  test_user_not_allowed: '테스트 연결 사용 대상이 아닙니다.',
  notion_remote_read_disabled: '서버 연결 설정 준비됨 · 원격 읽기 검증은 아직 비활성화되어 있습니다.',
  auth_required: '다시 로그인한 뒤 확인해 주세요.', invalid_session: '다시 로그인한 뒤 확인해 주세요.',
  notion_unauthorized: 'Notion 연결 확인 실패 · Notion이 자격 증명을 거절했습니다.',
  notion_access_denied: 'Notion 연결 확인 실패 · 읽기 접근이 거절됐습니다.',
  notion_target_not_found: '승인된 테스트 페이지를 찾을 수 없거나 연결에 공유되지 않았습니다.',
  notion_target_locked: '테스트 페이지가 잠겨 있어 대상 검증을 중지했습니다.',
  notion_target_archived: '보관된 테스트 페이지는 사용할 수 없습니다.', notion_target_in_trash: '휴지통의 테스트 페이지는 사용할 수 없습니다.',
  notion_rate_limited: 'Notion 요청 한도에 도달했습니다. 자동 재시도하지 않습니다.',
  network_error: '연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
};
const message = code => messages[code] ?? '연결 확인 실패 · 설정과 승인된 테스트 대상 정보를 확인해 주세요.';
export function createConnectionController({getSession, fetchImpl = fetch, drafts, onChange = () => {}}) {
  let ticket = 0, disposed = false, owner = null, abort;
  const unsubscribe = drafts?.subscribe(() => reset());
  function reset() { ticket++; abort?.abort(); if (!disposed) onChange({status: 'unchecked'}); }
  async function check(target = false) {
    if (disposed) return;
    const captured = ++ticket; abort?.abort(); abort = new AbortController();
    const current = () => !disposed && captured === ticket;
    onChange({status: 'loading'});
    try {
      const result = await getSession(); if (!current()) return;
      const session = result?.data?.session;
      if (result?.error || !session?.user?.id || !session.access_token) throw {code: 'auth_required'};
      const requestToken = session.access_token;
      if (owner && owner !== session.user.id) { dispose(); return; } owner = session.user.id;
      const response = await fetchImpl(target ? '/api/notion/test-target/review' : '/api/notion/test-connection', {
        method: target ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
        headers: {Authorization: `Bearer ${requestToken}`, ...(target ? {'Content-Type': 'application/json'} : {})},
        ...(target ? {body: '{}'} : {})
      });
      if (!current()) return;
      const text = await response.text(); if (text.length > 16384) throw {code: 'network_error'};
      let value; try { value = JSON.parse(text); } catch { throw {code: 'network_error'}; }
      const latest = await getSession(); if (!current()) return;
      if (latest?.error || latest?.data?.session?.user?.id !== owner || latest?.data?.session?.access_token !== requestToken) { dispose(); return; }
      if (!response.ok) throw {code: value.error?.code ?? 'network_error'};
      if (value.webExecutionReady !== false || value.notionExecution !== 'not_executed' || value.notionWrites !== 0 || value.supabaseWrites !== 0 || value.creationPermissionVerified !== false || value.privacyVerified !== false) throw {code: 'network_error'};
      if (!target && value.connectionStatus === 'configured' && value.targetReadVerified === false) {
        onChange({status: 'configured', remoteReadEnabled: value.remoteReadEnabled === true}); return;
      }
      if (target && value.connectionStatus === 'read_verified' && value.targetReadVerified === true && value.target?.botMatched === true && value.target?.workspaceMatched === true && value.target?.parentMatched === true && value.target?.creationPermissionVerified === false && value.target?.privacyVerified === false) {
        onChange({status: 'read_verified', lockStatus: value.target.lockStatus}); return;
      }
      throw {code: 'network_error'};
    } catch (error) { if (current()) onChange({status: 'failed', message: message(error.code ?? 'network_error')}); }
  }
  function dispose() { if (disposed) return; disposed = true; ticket++; abort?.abort(); unsubscribe?.(); owner = null; onChange({status: 'cleared'}); }
  return {check, reset, dispose};
}

export function mountTestConnection({root, getSession, fetchImpl, drafts, doc = document, win = window}) {
  const make = (tag, text) => {const e = doc.createElement(tag); e.textContent = text; return e;};
  const title = make('h3', '개인 Notion 테스트 연결');
  const status = make('p', '연결 상태 미확인 · 실제 Notion 연결은 아직 검증되지 않았습니다.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const check = make('button', '연결 상태 확인'); check.type = 'button'; check.className = 'button button-secondary';
  const target = make('button', '읽기 전용 대상 확인'); target.type = 'button'; target.className = 'button button-secondary'; target.hidden = true;
  const help = make('p', '개인 테스트용입니다. 읽기 성공은 생성 권한이나 전체 비공개 공유 상태의 증명이 아닙니다.'); help.className = 'draft-help';
  root.append(title, status, check, target, help);
  const controller = createConnectionController({getSession, fetchImpl, drafts, onChange(state) {
    check.disabled = target.disabled = state.status === 'loading'; target.hidden = true;
    if (state.status === 'cleared') {root.replaceChildren(); win.removeEventListener('est-auth-cleared', clear); return;}
    if (state.status === 'loading') status.textContent = '연결 상태를 확인하고 있습니다…';
    else if (state.status === 'configured') {status.textContent = `서버 연결 설정 준비됨 · ${state.remoteReadEnabled ? '대상 페이지는 아직 미검증입니다.' : '원격 읽기 검증은 비활성화되어 있습니다.'}`; target.hidden = !state.remoteReadEnabled;}
    else if (state.status === 'read_verified') status.textContent = `읽기 전용 대상 검증 완료 · ${state.lockStatus === 'unlocked' ? '잠금 없음 확인.' : '잠금 상태는 미확인입니다.'} 실제 생성은 지원하지 않습니다.`;
    else if (state.status === 'failed') status.textContent = state.message;
    else status.textContent = '연결 상태 미확인 · 실제 Notion 연결은 아직 검증되지 않았습니다.';
  }});
  const clear = () => controller.dispose(); win.addEventListener('est-auth-cleared', clear);
  check.addEventListener('click', () => controller.check()); target.addEventListener('click', () => controller.check(true));
  return controller;
}
