import {DraftError, errorMessage} from './model.mjs';
import {createDraftRepository} from './repository.mjs';
import {createWorkspace} from './workspace.mjs';

export async function initializeDrafts() {
  if (!(await window.estAuth?.ready) || document.documentElement.dataset.authState !== 'authenticated') return null;
  const result = await window.supabaseClient.auth.getSession();
  if (result.error || !result.data?.session?.user?.id || document.documentElement.dataset.authState !== 'authenticated') return null;
  const workspace = createWorkspace({storage: window.sessionStorage, userId: result.data.session.user.id});
  const repository = createDraftRepository({authClient: window.supabaseClient, createDataClient: window.createEducationDataClient, userId: result.data.session.user.id});
  const root = document.querySelector('[data-drafts-root]');
  const captures = new Map();
  let disposed = false, busy = false, offset = 0, hasMore = false, listLoaded = false;
  function element(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function button(label, action) {
    const node = element('button', label, 'button button-secondary'); node.type = 'button';
    node.addEventListener('click', action); return node;
  }
  const heading = element('h2', '내 교육 설계');
  const current = element('p', '', 'draft-current');
  const status = element('p', '', 'draft-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const actions = element('div', undefined, 'draft-actions');
  const list = element('ul', undefined, 'draft-list');
  const listDetails = element('details'); listDetails.append(element('summary', '저장된 교육 설계 목록'), list);
  const more = button('더 불러오기', () => loadList(false)); more.hidden = true; listDetails.append(more);
  const save = button('교육 설계 저장', () => saveCurrent(false)); save.className = 'button button-primary';
  const copy = button('복사본 저장', () => saveCurrent(true));
  const refresh = button('목록 새로고침', () => { listDetails.open = true; return loadList(true); });
  listDetails.addEventListener('toggle', () => {
    if (listDetails.open && !listLoaded && !busy) return loadList(true);
  });
  const fresh = button('새 교육 설계', () => {
    if (busy || !discardApproved()) return;
    workspace.reset(); window.location.href = 'index.html';
  });
  actions.append(save);
  const extraActions = element('details');
  const extraButtons = element('div', undefined, 'draft-actions'); extraButtons.append(copy, fresh, refresh);
  extraActions.append(element('summary', '목록·복사본·새 설계'), extraButtons,
    element('p', '교육 설정·질문·CSV 헤더와 매핑만 저장합니다. 실제 응답·개인정보·토큰을 입력하지 마세요. 저장 버튼을 눌러야 계정에 보관됩니다.', 'draft-help'), listDetails);
  root.append(heading, current, actions, status, extraActions);
  function show(message, failed = false) {
    if (disposed) return;
    status.textContent = message; status.classList.toggle('draft-error', failed);
  }
  function renderState(state) {
    if (disposed) return;
    current.textContent = `${state.configuration.requirements.educationName || '새 교육 설계'} · ${state.id ? '저장된 설계' : '새 설계'}${state.dirty ? ' · 저장하지 않은 변경 있음' : ''}${state.storageError ? ' · 브라우저 임시 저장 불가' : ''}`;
  }
  workspace.subscribe(renderState); renderState(workspace.snapshot());
  function setBusy(value) {
    busy = value; root.setAttribute('aria-busy', String(value));
    root.querySelectorAll('button').forEach(node => { node.disabled = value; });
  }
  function capture(saving = false) { for (const [section, read] of captures) workspace.update(section, read({saving})); }
  function discardApproved() { capture(); return !workspace.snapshot().dirty || window.confirm('저장하지 않은 변경 내용이 있습니다. 현재 내용을 바꾸시겠습니까?'); }
  async function saveCurrent(asCopy) {
    if (busy || disposed) return;
    try {
      capture(true); const state = workspace.snapshot(); setBusy(true); show('교육 설계를 저장하고 있습니다…');
      const row = await repository.save(state.configuration, !asCopy && state.id ? state : null);
      if (disposed) return;
      workspace.saved(row, state.revision);
      show(workspace.snapshot().dirty ? '저장했습니다. 저장 요청 중 편집한 내용은 한 번 더 저장해 주세요.' : '교육 설계를 저장했습니다.');
      await loadList(true, true);
    } catch (error) { show(errorMessage(error), true); }
    finally { if (!disposed) setBusy(false); }
  }
  async function loadList(reset, duringSave = false) {
    if ((busy && !duringSave) || disposed) return;
    if (!duringSave) { setBusy(true); show('교육 설계 목록을 불러오고 있습니다…'); }
    try {
      const nextOffset = reset ? 0 : offset;
      const rows = await repository.list(nextOffset);
      if (disposed) return;
      if (reset) list.replaceChildren();
      if (!rows.length && nextOffset === 0) list.append(element('li', '저장된 교육 설계가 없습니다.'));
      for (const row of rows) {
        const item = element('li');
        item.append(element('span', row.title, 'draft-list-title'), element('small', new Date(row.updated_at).toLocaleString('ko-KR')));
        item.append(button('열기', () => {
          if (busy || !discardApproved()) return;
          window.location.href = `index.html?draft=${encodeURIComponent(row.id)}`;
        })); list.append(item);
      }
      offset = nextOffset + rows.length; hasMore = rows.length === 25; more.hidden = !hasMore;
      listLoaded = true;
      if (!duringSave) show('내 교육 설계 목록을 불러왔습니다.');
    } catch (error) { show(duringSave ? '설계는 저장했지만 목록을 새로 불러오지 못했습니다. 목록 새로고침을 눌러 주세요.' : errorMessage(error), true); }
    finally { if (!disposed && !duringSave) setBusy(false); }
  }
  window.addEventListener('est-auth-cleared', () => {
    disposed = true; repository.dispose(); workspace.dispose(); captures.clear(); root.replaceChildren();
  }, {once: true});
  const api = {
    snapshot: () => workspace.snapshot(),
    register(section, read) { if (!disposed) captures.set(section, read); },
    update(section, value) { if (!disposed) workspace.update(section, value); },
    showError(error) { show(errorMessage(error), true); }
  };
  const url = new URL(window.location.href), id = url.searchParams.get('draft');
  if (id) {
    setBusy(true); show('저장된 교육 설계를 불러오고 있습니다…');
    try {
      const row = await repository.get(id);
      if (disposed) return null;
      workspace.open(row); show('교육 입력과 매핑 설정을 불러왔습니다.');
      url.searchParams.delete('draft'); window.history.replaceState(null, '', url.pathname + url.search);
    } catch (error) { show(errorMessage(error), true); }
    finally { if (!disposed) setBusy(false); }
  }
  if (disposed) throw new DraftError('account_changed');
  // Loading the list is explicit; a missing remote table never blocks the existing local builder.
  return api;
}
