import {mountTestConnection} from './notion-test-connection.mjs';

const FLAGS = {webExecutionReady: false, notionExecution: 'not_executed', notionRequests: 0, supabaseWrites: 0, targetVerified: false};
const OPTION_COLORS = {default: '#787774', gray: '#787774', brown: '#9F6B53', orange: '#D9730D', yellow: '#C29243', green: '#448361', blue: '#337EA9', purple: '#9065B0', pink: '#C14C8A', red: '#D44C47'};
const fail = code => Object.assign(new Error(code), {code});
const key = s => JSON.stringify([s.id, s.updatedAt, s.revision, s.dirty]);
export const previewMessage = code => ({
  save_required: '교육 설계를 먼저 저장한 뒤 검토해 주세요.',
  analysis_required: '변경한 CSV를 분석하고 교육 설계를 저장한 뒤 검토해 주세요.',
  saved_draft_changed: '저장본이 변경됐습니다. 내 교육 설계 목록에서 최신 설계를 다시 열고 검토해 주세요.',
  invalid_saved_plan: '저장한 설계의 속성·구성에 오류가 있습니다. 편집 화면에서 확인한 뒤 다시 저장해 주세요.',
  preview_limit_exceeded: '미리보기 범위(속성 100개·결과 256KiB)를 초과했습니다. 구성을 줄여 주세요.',
  auth_required: '다시 로그인한 뒤 검토해 주세요.', invalid_session: '로그인 상태를 확인할 수 없습니다. 다시 로그인해 주세요.',
  draft_not_found: '이 저장 설계를 열 수 없습니다. 내 교육 설계 목록을 확인해 주세요.',
  server_not_configured: '서버 검토 연결이 준비되지 않았습니다.',
  network_error: '서버 검토에 연결하지 못했습니다. 편집 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.'
}[code] ?? '검토를 완료하지 못했습니다. 로그인·저장 상태를 확인해 주세요.');

// Request-scoped identity and workspace fence. No credentials escape this closure.
export function createPreviewController({drafts, getSession, fetchImpl = fetch, onChange = () => {}}) {
  let sequence = 0, disposed = false, abort, owner = null, edited = false;
  function invalidate({editing = false} = {}) {
    sequence++; abort?.abort(); edited = editing;
    if (!disposed) onChange({status: 'idle', blocked: edited || !drafts.snapshot().id || drafts.snapshot().dirty});
  }
  const unsubscribe = drafts.subscribe(() => invalidate({editing: drafts.snapshot().dirty}));
  async function review() {
    if (disposed) return;
    let snapshot;
    try {
      snapshot = drafts.captureForReview();
      if (!snapshot.id || !snapshot.updatedAt || snapshot.dirty || edited) throw fail('save_required');
    } catch (error) { onChange({status: 'error', message: previewMessage(error.code)}); return; }
    const ticket = ++sequence, capturedKey = key(snapshot);
    abort?.abort(); abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]);
    const current = () => !disposed && ticket === sequence && key(drafts.snapshot()) === capturedKey;
    onChange({status: 'loading'});
    try {
      const result = await getSession();
      if (!current()) return;
      const session = result?.data?.session;
      if (result?.error || !session?.user?.id || !session.access_token) throw fail('auth_required');
      if (owner && owner !== session.user.id) { dispose(); return; }
      owner = session.user.id;
      async function post(path, body) {
        const response = await fetchImpl(path, {method: 'POST', cache: 'no-store', signal,
          headers: {'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`}, body: JSON.stringify(body)});
        if (!current()) return null;
        const text = await response.text();
        if (text.length > 524288) throw fail('network_error');
        let value; try { value = JSON.parse(text); } catch { throw fail('network_error'); }
        if (!response.ok) throw fail(value.error?.code ?? 'network_error');
        return value;
      }
      const first = await post('/api/drafts/review', {draftId: snapshot.id, expectedUpdatedAt: snapshot.updatedAt});
      if (!current() || !first) return;
      if (first.draftId !== snapshot.id || first.updatedAt !== snapshot.updatedAt || !/^[a-f0-9]{64}$/i.test(first.planHash)) throw fail('saved_draft_changed');
      const preview = await post('/api/notion/plans/review', {draftId: snapshot.id, expectedUpdatedAt: snapshot.updatedAt, expectedPlanHash: first.planHash});
      if (!current() || !preview) return;
      const latest = await getSession();
      if (!current()) return;
      if (latest?.error || latest?.data?.session?.user?.id !== owner) { dispose(); return; }
      if (preview.draftId !== snapshot.id || preview.updatedAt !== snapshot.updatedAt || preview.planHash !== first.planHash ||
        Object.entries(FLAGS).some(([k, v]) => preview[k] !== v) || !preview.preview || !preview.coverage) throw fail('network_error');
      onChange({status: 'ready', result: preview});
    } catch (error) {
      if (current()) onChange({status: 'error', message: previewMessage(error.code ?? 'network_error')});
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; sequence++; abort?.abort(); unsubscribe(); owner = null;
    onChange({status: 'cleared'});
  }
  return {review, invalidate, dispose};
}

export function renderPreview(root, value, doc = document) {
  root.replaceChildren();
  const add = (parent, tag, text, cls) => { const n = doc.createElement(tag); n.textContent = text; if (cls) n.className = cls; parent.append(n); return n; };
  const {preview, coverage} = value;
  add(root, 'h3', preview.page.name);
  add(root, 'p', `DB ${preview.counts.databases}개 · 속성 ${preview.counts.properties}개 · 관계 ${preview.counts.relations}쌍 · 롤업 ${preview.counts.rollups}개 · 수식 ${preview.counts.formulas}개`);
  add(root, 'p', '아래 내용은 서버에서 확인한 저장본입니다. V1 Mock 결과와 구분되며 실제 행과 계산값은 포함하지 않습니다.', 'draft-help');
  for (const db of preview.databases) {
    const details = add(root, 'details', ''); add(details, 'summary', db.name);
    add(details, 'p', `논리 DB: ${db.id} · Data Source: ${db.dataSourceId}`, 'draft-help');
    const list = add(details, 'ul', '');
    for (const p of preview.properties.filter(p => p.dataSourceId === db.dataSourceId)) {
      const item = add(list, 'li', `${p.name} — ${p.type}`);
      for (const o of p.options ?? []) {
        const chip = add(item, 'span', `${o.name} (${o.color})`, 'notion-option');
        chip.style.setProperty('--notion-option-color', Object.hasOwn(OPTION_COLORS, o.color) ? OPTION_COLORS[o.color] : OPTION_COLORS.default);
      }
    }
  }
  const structure = add(root, 'details', ''); add(structure, 'summary', '관계·계산·의존 순서');
  const names = new Map(preview.properties.map(p => [p.id, p.name]));
  const dbNames = new Map(preview.databases.map(d => [d.dataSourceId, d.name]));
  for (const r of preview.relations) add(structure, 'p', `${dbNames.get(r.sourceDataSourceId)} ↔ ${dbNames.get(r.targetDataSourceId)} · ${names.get(r.propertyId)} / ${names.get(r.reversePropertyId)}`);
  for (const r of preview.rollups) add(structure, 'p', `Rollup ${names.get(r.propertyId)}: ${names.get(r.relationPropertyId)} → ${names.get(r.targetPropertyId)} (${r.function})`);
  for (const f of preview.formulas) add(structure, 'p', `Formula ${names.get(f.propertyId)}: ${f.expression}`);
  add(structure, 'p', preview.steps.map(s => s.id).join(' → '));
  const support = add(root, 'section', ''); add(support, 'h3', '지원 상태');
  add(support, 'p', '논리 설계: 표현됨 · 웹 실행: 미지원 · 대상 페이지: 미확인');
  add(support, 'p', coverage.cli.basic.schemaSupported ? '현재 기본형 CLI의 구조 검사를 통과했습니다. 이 저장본의 원격 실행을 검증한 결과는 아닙니다.' : 'CLI 지원 범위를 벗어나거나 사용자 확인이 필요한 항목이 있습니다.');
  if (value.templateType !== 'basic') add(support, 'p', '과거 일반형 CLI 검증은 사람·프로그램·신청 3DB와 고정 가상 7행에 한정됩니다.');
  add(support, 'p', coverage.distinction);
  const blocked = add(support, 'ul', ''); for (const b of value.blockers) add(blocked, 'li', b.message);
  add(support, 'h3', '확인 필요');
  const confirmations = add(support, 'ul', '');
  if (!value.confirmationItems.length) add(confirmations, 'li', '추가 확인 항목이 없습니다. 실제 생성은 지원하지 않습니다.');
  for (const item of value.confirmationItems) add(confirmations, 'li', `${names.get(item.ref) ? `${names.get(item.ref)}: ` : ''}${item.message}`);
  add(root, 'p', `계획 해시: ${value.planHash}\n변환 해시: ${value.compilationHash}`, 'notion-hash');
}

export function mountPreview({root, drafts, getSession, fetchImpl, doc = document, win = window}) {
  const make = (tag, text) => { const n = doc.createElement(tag); n.textContent = text; return n; };
  root.replaceChildren();
  const summary = make('summary', 'Notion 생성 계획');
  const notice = make('p', '현재는 Notion 생성 계획을 미리 확인하는 단계입니다. 실제 Notion 페이지나 데이터베이스는 생성되지 않습니다.');
  const button = make('button', '저장된 설계 검토'); button.type = 'button'; button.className = 'button button-secondary';
  const status = make('p', '저장한 설계를 기준으로 검토합니다. 변경한 내용은 먼저 저장해 주세요.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const output = make('div', ''); output.className = 'notion-preview-output';
  const connectionRoot = make('section', ''); connectionRoot.className = 'notion-test-connection';
  root.append(summary, notice, connectionRoot, button, status, output);
  const connection = mountTestConnection({root: connectionRoot, getSession, fetchImpl, drafts, doc, win});
  const controller = createPreviewController({drafts, getSession, fetchImpl, onChange(state) {
    output.replaceChildren(); button.disabled = state.status === 'loading' || state.blocked === true;
    if (state.status === 'cleared') { root.replaceChildren(); cleanup(); return; }
    if (state.status === 'loading') status.textContent = '저장된 설계를 서버에서 검토하고 있습니다…';
    else if (state.status === 'ready') { status.textContent = '저장본 검토를 마쳤습니다. 실제 Notion 요청과 저장소 쓰기는 발생하지 않았습니다.'; renderPreview(output, state.result, doc); }
    else if (state.status === 'error') status.textContent = state.message;
    else status.textContent = '저장한 설계를 기준으로 검토합니다. 변경한 내용은 먼저 저장해 주세요.';
  }});
  const edit = event => { if (!root.contains(event.target)) controller.invalidate({editing: true}); };
  const clear = () => controller.dispose();
  function cleanup() { connection.dispose(); doc.removeEventListener('input', edit); doc.removeEventListener('change', edit); win.removeEventListener('est-auth-cleared', clear); }
  doc.addEventListener('input', edit); doc.addEventListener('change', edit); win.addEventListener('est-auth-cleared', clear);
  button.addEventListener('click', () => controller.review());
  controller.invalidate();
  return controller;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  void (async () => {
    const root = document.querySelector('[data-notion-preview]');
    if (!root || !(await window.estAuth?.ready)) return;
    const drafts = await window.estDraftsReady;
    if (!drafts || document.documentElement.dataset.authState !== 'authenticated') return;
    mountPreview({root, drafts, getSession: () => window.supabaseClient.auth.getSession()});
  })().catch(() => { /* Auth and draft panels retain their existing error UI. */ });
}
