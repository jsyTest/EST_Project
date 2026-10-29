import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {normalizeConfiguration, forSave, WORKSPACE_KEY, errorMessage} from '../../../js/drafts/model.mjs';
import {createDraftRepository} from '../../../js/drafts/repository.mjs';
import {createWorkspace} from '../../../js/drafts/workspace.mjs';
import {parseForm, mergeSources} from '../../../js/mapping/parse.mjs';
import {describeColumns} from '../../../js/mapping/csv.mjs';
import {USER_A, USER_B, storage, mockServer, auth, configuration} from './helpers/drafts-fixture.mjs';
const repo = (server, client = auth(), userId = USER_A) => createDraftRepository({authClient: client, createDataClient: server.createDataClient, userId});
function mappingConfiguration() {
  const c = configuration();
  const formText = '1. 참여자 유형\n단일 선택\n- 재직자\n- 구직자';
  const columns = describeColumns(['참여자 유형']);
  c.mapping = {formText, encoding: 'utf-8', columns, model: mergeSources(parseForm(formText), columns)};
  const p = c.mapping.model.properties.find(p => p.origin === 'form'); p.name = '사용자 지정 유형'; p.options[0].color = 'purple'; p.options[0].colorSource = 'user';
  c.mapping.model.properties.push({localId: 'manual-9', origin: 'manual', questionName: '', csvColumn: null, name: '사용자 메모', type: 'rich_text', targetDb: 'courses', options: [], included: true, mappingStatus: 'confirmed', reviewReasons: []});
  return c;
}
test('drafts: allowlisted configuration retains mappings, custom properties/options/colors and excludes response/token/file fields', () => {
  const c = mappingConfiguration(); c.responseRows = ['PRIVATE_RESPONSE']; c.access_token = 'PRIVATE_TOKEN'; c.mapping.file = new Blob(['PRIVATE_FILE']); c.mapping.model.properties[0].responses = ['PRIVATE_RESPONSE'];
  const clean = normalizeConfiguration(c), json = JSON.stringify(clean);
  assert.ok(!json.includes('PRIVATE_')); assert.equal(clean.mapping.model.properties.find(p => p.origin === 'form').options[0].color, 'purple');
  assert.equal(clean.mapping.model.properties.at(-1).name, '사용자 메모');
  assert.equal(clean.mapping.columns[0].original, '참여자 유형'); assert.equal(clean.mapping.model.properties.find(p => p.origin === 'form').name, '사용자 지정 유형');
});
test('drafts: malformed JSON, unsupported old/future versions and invalid options fail safely', () => {
  for (const value of ['not-json', 'null', '[]', '{}']) assert.throws(() => normalizeConfiguration(value));
  for (const version of [0, 2, '1']) assert.throws(() => normalizeConfiguration(configuration(), version), {code: 'unsupported_version'});
  const c = configuration(); c.mapping.model.properties[0].options[0].color = 'unknown'; assert.throws(() => normalizeConfiguration(c), {code: 'invalid_configuration'});
  assert.match(errorMessage({code: 'unsupported_version'}), /현재 편집 내용은 유지/);
});
test('drafts: v1 missing optional mapping/default fields is safely normalized without inventing KPI settings', () => {
  const c = normalizeConfiguration({version: 1, requirements: {educationName: '기존 설계'}});
  assert.equal(c.mapping.model.properties.length, 3); assert.equal(c.requirements.basicItems.length, 3); assert.equal('kpiSettings' in c, false);
  assert.throws(() => forSave(configuration(' ')), {code: 'title_required'});
});
test('drafts: rejects duplicate identities, unknown modules, oversized configuration and orphan CSV links', () => {
  let c = configuration(); c.mapping.model.properties.push(c.mapping.model.properties[0]); assert.throws(() => normalizeConfiguration(c));
  c = configuration(); c.requirements.basicItems.push('unimplemented'); assert.throws(() => normalizeConfiguration(c));
  c = configuration(); c.mapping.formText = 'x'.repeat(100001); assert.throws(() => normalizeConfiguration(c));
  c = mappingConfiguration(); c.mapping.columns = []; assert.throws(() => normalizeConfiguration(c));
});
test('drafts: insert/list/open/update roundtrip uses server owner and updates same row', async () => {
  const server = mockServer(), repository = repo(server);
  let row = await repository.save(mappingConfiguration());
  assert.equal(server.requests[0].payload.user_id, undefined); assert.equal((await repository.list()).length, 1);
  let opened = await repository.get(row.id); assert.equal(opened.configuration.mapping.model.properties.find(p => p.origin === 'form').options[0].color, 'purple');
  opened.configuration.requirements.purpose = '수정 목적';
  row = await repository.save(opened.configuration, opened);
  assert.equal(server.rows.size, 1); assert.equal((await repository.get(row.id)).configuration.requirements.purpose, '수정 목적');
});
test('drafts: anonymous repository operations are blocked before any Data API call', async () => {
  const server = mockServer(), repository = repo(server, auth(null));
  await assert.rejects(repository.list(), {code: 'auth_required'}); await assert.rejects(repository.save(configuration()), {code: 'auth_required'});
  assert.equal(server.requests.length, 0);
});
test('drafts: simulated A/B isolation on listing, known IDs and updates', async () => {
  const server = mockServer(), a = repo(server), b = repo(server, auth(USER_B), USER_B);
  const row = await b.save(configuration('B 비공개'));
  assert.equal((await a.list()).length, 0); await assert.rejects(a.get(row.id), {code: 'not_found'});
  await assert.rejects(a.save(configuration('변조'), row), {code: 'conflict'});
  assert.equal((await b.get(row.id)).title, 'B 비공개');
});
test('drafts: ownership injection is removed from application payload', async () => {
  const server = mockServer(), repository = repo(server); const c = configuration(); c.user_id = USER_B;
  await repository.save(c);
  assert.equal(server.requests[0].payload.user_id, undefined); assert.equal([...server.rows.values()][0].user_id, USER_A);
});
test('drafts: stale update conflicts instead of overwriting another tab', async () => {
  const server = mockServer(), repository = repo(server), row = await repository.save(configuration());
  await repository.save(configuration('최신'), row);
  await assert.rejects(repository.save(configuration('과거'), row), {code: 'conflict'});
  assert.equal((await repository.get(row.id)).title, '최신');
});
test('drafts: account change before request and logout during response reject stale results', async () => {
  const server = mockServer(), client = auth(), repository = repo(server, client);
  client.switch(USER_B); await assert.rejects(repository.list(), {code: 'auth_required'}); assert.equal(server.requests.length, 0);
  client.switch(USER_A); let release; server.delayNext(new Promise(resolve => { release = resolve; }));
  const request = repository.list(); await new Promise(resolve => setImmediate(resolve)); repository.dispose(); release();
  await assert.rejects(request, {code: 'account_changed'});
});
test('drafts: request data client retains original captured JWT across account change', async () => {
  const server = mockServer(), client = auth();
  const repository = createDraftRepository({authClient: client, userId: USER_A, createDataClient(token) { client.switch(USER_B); return server.createDataClient(token); }});
  await assert.rejects(repository.save(configuration()), {code: 'account_changed'});
  assert.equal([...server.rows.values()][0].user_id, USER_A);
});
test('drafts: missing table/network/save errors propagate without automatic retries', async () => {
  const server = mockServer(), repository = repo(server);
  for (const code of ['PGRST205', 'network_error', '42501']) {
    server.failNext({code}); const before = server.requests.length;
    await assert.rejects(repository.save(configuration()), {code}); assert.equal(server.requests.length, before + 1);
    assert.ok(!errorMessage({code, message: 'PRIVATE_SERVER_DETAIL'}).includes('PRIVATE_SERVER_DETAIL'));
  }
});
test('drafts: paged lists do not fetch configuration and invalid stored version cannot overwrite editor', async () => {
  const server = mockServer(), repository = repo(server);
  for (let i = 0; i < 26; i++) await repository.save(configuration('교육 '+i));
  assert.equal((await repository.list()).length, 25); assert.equal((await repository.list(25)).length, 1); assert.equal('configuration' in (await repository.list())[0], false);
  const first = [...server.rows.values()][0]; first.schema_version = 0;
  await assert.rejects(repository.get(first.id), {code: 'unsupported_version'});
});
test('drafts: saved workspace restores mapping/education after refresh and explicit cloud reload', async () => {
  const st = storage(), work = createWorkspace({storage: st, userId: USER_A}); const c = mappingConfiguration();
  work.update('requirements', c.requirements); work.update('mapping', c.mapping);
  const repository = repo(mockServer()); const before = work.snapshot(); const row = await repository.save(before.configuration); work.saved(row, before.revision);
  const refreshed = createWorkspace({storage: st, userId: USER_A}); assert.equal(refreshed.snapshot().id, row.id); assert.equal(refreshed.snapshot().dirty, false);
  assert.equal(refreshed.snapshot().configuration.mapping.model.properties.find(p => p.origin === 'form').options[0].color, 'purple');
  const cleanStorage = storage(), opened = createWorkspace({storage: cleanStorage, userId: USER_A}); opened.open(await repository.get(row.id));
  assert.deepEqual(opened.snapshot().configuration, refreshed.snapshot().configuration);
});
test('drafts: cache rejects another user and logout removes all education data', async () => {
  const st = storage(), a = createWorkspace({storage: st, userId: USER_A}); a.update('requirements', configuration('A 전용').requirements);
  const b = createWorkspace({storage: st, userId: USER_B}); assert.equal(b.snapshot().configuration.requirements.educationName, '');
  b.dispose(); assert.equal(st.getItem(WORKSPACE_KEY), null); assert.equal(st.getItem('aiNotionBuilderRequirements'), null); assert.throws(() => b.snapshot(), {code: 'account_changed'});
  const code = await readFile(new URL('../../../js/auth-core.js', import.meta.url), 'utf8'); const root = {}; vm.runInNewContext(code, {window: root});
  st.setItem('estAuthDraftOwner', USER_A); st.setItem(WORKSPACE_KEY, 'private'); root.ESTAuthCore.syncDraftOwner(st, USER_B); assert.equal(st.getItem(WORKSPACE_KEY), null);
});
test('drafts: edits during save survive completion and can be saved on next revision', async () => {
  const st = storage(), work = createWorkspace({storage: st, userId: USER_A}); work.update('requirements', configuration('첫 이름').requirements);
  const before = work.snapshot(); work.update('requirements', configuration('저장 중 수정').requirements);
  const row = await repo(mockServer()).save(before.configuration); work.saved(row, before.revision);
  assert.equal(work.snapshot().configuration.requirements.educationName, '저장 중 수정'); assert.equal(work.snapshot().dirty, true); assert.equal(work.snapshot().id, row.id);
});
test('drafts: legacy same-user input migrates and storage failure preserves in-memory editing', () => {
  const st = storage(); st.setItem('estAuthDraftOwner', USER_A); st.setItem('aiNotionBuilderRequirements', JSON.stringify(configuration('이전 입력').requirements));
  assert.equal(createWorkspace({storage: st, userId: USER_A}).snapshot().configuration.requirements.educationName, '이전 입력');
  const blocked = {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }};
  const work = createWorkspace({storage: blocked, userId: USER_A}); work.update('requirements', configuration('계속 편집').requirements);
  assert.equal(work.snapshot().configuration.requirements.educationName, '계속 편집'); assert.equal(work.snapshot().storageError, true);
});
test('drafts: timeout covers blocked initial Auth and never submits a late write', async () => {
  const server = mockServer(); let release;
  const client = {auth: {getSession: () => new Promise(resolve => { release = resolve; })}};
  const repository = createDraftRepository({authClient: client, createDataClient: server.createDataClient, userId: USER_A, requestTimeoutMs: 10});
  await assert.rejects(repository.save(configuration()), {code: 'request_timeout'});
  release(await auth().auth.getSession()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(server.requests.length, 0);
});
test('drafts: timeout after committed write releases UI promise without retrying or publishing late success', async () => {
  const server = mockServer(); let calls = 0, release;
  const client = {auth: {getSession: () => ++calls === 1 ? auth().auth.getSession() : new Promise(resolve => { release = resolve; })}};
  const repository = createDraftRepository({authClient: client, createDataClient: server.createDataClient, userId: USER_A, requestTimeoutMs: 10});
  await assert.rejects(repository.save(configuration()), {code: 'request_timeout'});
  assert.equal(server.rows.size, 1); assert.equal(server.requests.length, 1);
  release(await auth().auth.getSession()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(server.requests.length, 1);
});
