import test from 'node:test';
import assert from 'node:assert/strict';
import {screen} from './helpers/browser.mjs';
import {storage, auth, mockServer, configuration, USER_A} from './helpers/drafts-fixture.mjs';
import {createWorkspace} from '../../../js/drafts/workspace.mjs';
import {createDraftRepository} from '../../../js/drafts/repository.mjs';
import {initializeDrafts} from '../../../js/drafts/ui.mjs';
function adapter(workspace) {
  const captures = new Map();
  return {snapshot: workspace.snapshot, register: (section, fn) => captures.set(section, fn), update: workspace.update, showError(error) { throw error; }, capture() { for (const [section, fn] of captures) workspace.update(section, fn()); }};
}
test('draft UI: actual input/mapping handlers restore fields, modules, CSV bindings and colors from cloud row after cache reset', async () => {
  const st = storage(), work = createWorkspace({storage: st, userId: USER_A}), api = adapter(work);
  const input = await screen('input', st, {drafts: api}); input.node('education-name').value = '저장 복원 교육'; input.node('dashboard-purpose').value = '교육 목적'; input.node('additional-requirements').value = '운영 기준';
  input.basic.forEach(c => c.checked = c.value !== 'schedule'); input.extra.find(c => c.value === 'completion').checked = true;
  await input.node('requirement-form').fire('submit'); assert.equal(input.context.location.href, 'result.html');
  const mapping = await screen('mapping', st, {drafts: api}); mapping.node('form-text').value = '1. 이메일\n단답형'; mapping.node('csv-file').files = [new Blob(['이메일\nPRIVATE_RESPONSE_NOT_TO_SAVE'])];
  await mapping.node('analyze').fire('click');
  let nodes = mapping.walk(mapping.node('mapping-rows').children);
  const color = nodes.find(e => e.attributes['aria-label'] === 'base-selection option-0 색상'); color.value = 'purple'; await color.fire('change');
  nodes = mapping.walk(mapping.node('mapping-rows').children);
  const name = nodes.find(e => e.attributes['aria-label'] === 'form-0 속성명'); name.value = '연락 이메일 구조'; await name.fire('input');
  const repository = createDraftRepository({authClient: auth(), createDataClient: mockServer().createDataClient, userId: USER_A});
  const row = await repository.save(work.snapshot().configuration);
  assert.ok(!JSON.stringify(row).includes('PRIVATE_RESPONSE'));
  const freshStorage = storage(), opened = createWorkspace({storage: freshStorage, userId: USER_A}); opened.open(await repository.get(row.id));
  const restoredInput = await screen('input', freshStorage, {drafts: adapter(opened)});
  assert.equal(restoredInput.node('education-name').value, '저장 복원 교육'); assert.equal(restoredInput.node('dashboard-purpose').value, '교육 목적');
  assert.equal(restoredInput.basic.find(c => c.value === 'schedule').checked, false); assert.equal(restoredInput.extra.find(c => c.value === 'completion').checked, true);
  const restored = await screen('mapping', freshStorage, {drafts: adapter(opened)});
  nodes = restored.walk(restored.node('mapping-rows').children);
  assert.equal(restored.node('form-text').value, '1. 이메일\n단답형');
  assert.equal(nodes.find(e => e.attributes['aria-label'] === 'base-selection option-0 색상').value, 'purple');
  assert.equal(nodes.find(e => e.attributes['aria-label'] === 'form-0 속성명').value, '연락 이메일 구조');
  assert.equal(nodes.find(e => e.attributes['aria-label'] === 'form-0 CSV 컬럼').value, '0');
  assert.equal(restored.node('csv-file').files.length, 0); // Only headers are restored, never the original File/response rows.
  await restored.node('analyze').fire('click'); assert.match(restored.node('feedback').textContent, /CSV 컬럼 1개/);
});
test('draft UI: restored manual IDs remain unique and unsaved mapping survives ordinary screen refresh', async () => {
  const st = storage(), work = createWorkspace({storage: st, userId: USER_A});
  let view = await screen('mapping', st, {drafts: adapter(work)}); await view.node('add-field').fire('click');
  view = await screen('mapping', st, {drafts: adapter(createWorkspace({storage: st, userId: USER_A}))});
  await view.node('add-field').fire('click');
  const ids = view.node('mapping-rows').children.map(e => e.dataset.localId);
  assert.equal(ids.filter(id => id.startsWith('manual-')).length, 2); assert.equal(new Set(ids).size, ids.length);
});
async function toolbar(t, server = mockServer(), {url = 'https://education.example/index.html', st = storage()} = {}) {
  const view = await screen('none', st);
  view.context.supabaseClient = auth(); view.context.createEducationDataClient = server.createDataClient;
  view.context.confirm = () => true; view.context.location.href = url; view.context.history = {replaceState() {}};
  globalThis.window = view.context; globalThis.document = view.context.document;
  t.after(() => { delete globalThis.window; delete globalThis.document; });
  const api = await initializeDrafts();
  const root = view.node('draft-root'); const buttons = () => view.walk(root.children).filter(e => e.tagName === 'button');
  const click = async label => { const button = buttons().find(b => b.textContent === label); assert.ok(button, label); await button.fire('click'); };
  return {view, api, root, click, st, server};
}
test('draft UI: real toolbar saves/updates/lists/opens and creates a separate copy without unsafe HTML', async t => {
  const ui = await toolbar(t); ui.api.register('requirements', () => configuration('가상 <img onerror=x>').requirements);
  await ui.click('교육 설계 저장'); assert.match(ui.root.textContent, /교육 설계를 저장했습니다/); assert.equal(ui.server.rows.size, 1);
  await ui.click('교육 설계 저장'); assert.equal(ui.server.rows.size, 1);
  await ui.click('복사본 저장'); assert.equal(ui.server.rows.size, 2);
  await ui.click('목록 새로고침'); assert.ok(ui.root.textContent.includes('가상 <img onerror=x>'));
  await ui.click('열기'); assert.match(ui.view.context.location.href, /^index.html\?draft=/);
  assert.equal(ui.view.walk(ui.root.children).some(e => e.tagName === 'img'), false);
  await ui.click('새 교육 설계'); assert.equal(ui.api.snapshot().id, null); assert.equal(ui.api.snapshot().configuration.requirements.educationName, '');
});
test('draft UI: loading disables duplicate save; network error retains inputs and permits retry', async t => {
  const ui = await toolbar(t); ui.api.register('requirements', () => configuration('보존할 교육').requirements);
  let release; ui.server.delayNext(new Promise(resolve => { release = resolve; }));
  const saving = ui.click('교육 설계 저장'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.root.attributes['aria-busy'], 'true');
  const before = ui.server.requests.length; await ui.click('교육 설계 저장'); assert.equal(ui.server.requests.length, before);
  release(); await saving;
  ui.server.failNext({code: 'network_error'}); await ui.click('교육 설계 저장');
  assert.match(ui.root.textContent, /현재 편집 내용은 유지/); assert.equal(ui.api.snapshot().configuration.requirements.educationName, '보존할 교육');
  await ui.click('교육 설계 저장'); assert.match(ui.root.textContent, /저장했습니다/);
});
test('draft UI: logout clears toolbar/cache and rejects a late save response', async t => {
  const ui = await toolbar(t); ui.api.register('requirements', () => configuration('비공개').requirements);
  let release; ui.server.delayNext(new Promise(resolve => { release = resolve; }));
  const saving = ui.click('교육 설계 저장'); await new Promise(resolve => setImmediate(resolve));
  ui.view.dispatch('est-auth-cleared'); release(); await saving;
  assert.equal(ui.root.children.length, 0); assert.equal(ui.st.getItem('estEducationWorkspaceV1'), null); assert.throws(() => ui.api.snapshot(), {code: 'account_changed'});
});
test('draft UI: URL open loads server configuration before editor initialization', async t => {
  const server = mockServer(); const repository = createDraftRepository({authClient: auth(), createDataClient: server.createDataClient, userId: USER_A});
  const c = configuration('서버 설계'); c.mapping.model.properties[0].options[0].color = 'red';
  const row = await repository.save(c);
  const ui = await toolbar(t, server, {url: `https://education.example/index.html?draft=${row.id}`});
  assert.equal(ui.api.snapshot().configuration.requirements.educationName, '서버 설계');
  assert.equal(ui.api.snapshot().configuration.mapping.model.properties[0].options[0].color, 'red');
  assert.match(ui.root.textContent, /불러왔습니다/);
});
test('draft UI: unsupported saved version leaves current editor untouched', async t => {
  const server = mockServer(), repository = createDraftRepository({authClient: auth(), createDataClient: server.createDataClient, userId: USER_A});
  const row = await repository.save(configuration()); server.rows.get(row.id).schema_version = 0;
  const st = storage(); createWorkspace({storage: st, userId: USER_A}).update('requirements', configuration('현재 편집').requirements);
  const ui = await toolbar(t, server, {url: `https://education.example/index.html?draft=${row.id}`, st});
  assert.equal(ui.api.snapshot().configuration.requirements.educationName, '현재 편집'); assert.match(ui.root.textContent, /지원하지 않는 저장 형식/);
});
