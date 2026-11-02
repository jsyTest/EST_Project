import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, copyFile, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {compilePreview, MAX_PREVIEW_BYTES, PREVIEW_FLAGS} from '../../../server/notion/preview-plan.mjs';
import {createNotionPreviewHandler} from '../../../server/notion/preview-handler.mjs';
import {reviewSavedDraft} from '../../../server/review-plan.mjs';
import {emptyConfiguration, normalizeConfiguration} from '../../../js/drafts/model.mjs';
import {createPreviewController, renderPreview, mountPreview} from '../../../js/notion-preview.mjs';
import {createWorkspace} from '../../../js/drafts/workspace.mjs';
import {Element} from './helpers/browser.mjs';
import {USER_A, USER_B, storage} from './helpers/drafts-fixture.mjs';
import {startReviewServer} from '../../development/serve-review.mjs';
import {buildStatic, PUBLIC_FILES} from '../../deployment/build-static.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UPDATED = '2026-11-02T01:02:03.123456Z';
const ENV = {SUPABASE_URL: 'https://unit-preview.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_SYNTHETIC'};
function configuration(type = 'basic') {
  const c = emptyConfiguration(); c.requirements.educationName = '가상 교육'; c.planner.templateType = type;
  c.mapping.model.properties.push({localId: 'manual-title', origin: 'manual', name: '가상 항목', type: 'title', included: true, targetDb: 'applicants', mappingStatus: 'confirmed', options: []});
  return normalizeConfiguration(c);
}
const row = (type = 'basic', id = A, owner = USER_A) => ({id, user_id: owner, configuration: configuration(type), schema_version: 1, updated_at: UPDATED});
const input = r => ({draftId: r.id, expectedUpdatedAt: r.updated_at, expectedPlanHash: reviewSavedDraft(r).planHash});
function upstream(rows = [row()]) {
  const calls = [];
  const fetchImpl = async (address, options) => {
    const url = new URL(address); calls.push({url, method: options.method});
    assert.equal(url.origin, ENV.SUPABASE_URL); assert.equal(options.method, 'GET');
    const owner = options.headers.Authorization === 'Bearer test-A' ? USER_A : options.headers.Authorization === 'Bearer test-B' ? USER_B : null;
    if (!owner) return Response.json({secret: 'PRIVATE_UPSTREAM'}, {status: 401});
    if (url.pathname === '/auth/v1/user') return Response.json({id: owner});
    assert.equal(url.pathname, '/rest/v1/education_drafts'); assert.equal(url.searchParams.get('user_id'), `eq.${owner}`);
    return Response.json(rows.filter(r => r.user_id === owner && `eq.${r.id}` === url.searchParams.get('id')));
  };
  return {calls, fetchImpl};
}
function request(body = input(row()), {token = 'test-A', method = 'POST', headers = {}} = {}) {
  return new Request('http://127.0.0.1:8787/api/notion/plans/review', {method,
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers},
    ...(!['GET', 'HEAD'].includes(method) ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {})});
}
const handler = u => createNotionPreviewHandler({fetchImpl: u.fetchImpl, env: ENV});
async function code(response, status, error) {
  assert.equal(response.status, status); const body = await response.json();
  if (error) assert.equal(body.error.code, error);
  for (const [k, v] of Object.entries(PREVIEW_FLAGS)) assert.equal(body[k], v);
  assert.match(response.headers.get('Cache-Control'), /private, no-store/);
  return body;
}

for (const type of ['basic', 'standard', 'extended']) test(`NB012: ${type} pure compilation is deterministic, bounded and never executable`, () => {
  const r = row(type); if (type === 'extended') r.configuration.planner.enabledModules = ['attendance', 'teams'];
  const p = compilePreview(r); assert.deepEqual(p, compilePreview(r));
  assert.equal(p.planHash, reviewSavedDraft(r).planHash); assert.match(p.compilationHash, /^[a-f0-9]{64}$/);
  assert.ok(Buffer.byteLength(JSON.stringify(p)) <= MAX_PREVIEW_BYTES);
  assert.equal(p.preview.databases.length, type === 'basic' ? 1 : type === 'standard' ? 3 : 6);
  assert.equal(p.preview.remoteIdsResolved, false); assert.equal(p.preview.rowsIncluded, false);
  if (type !== 'basic') assert.deepEqual(p.preview.databases.slice(0, 3).map(d => d.key), ['people', 'programs', 'applications']);
  if (type === 'extended') assert.ok(p.blockers.some(b => b.moduleId === 'attendance'));
  assert.equal(p.coverage.educationOperations.schedule, 'not_implemented');
  assert.ok(p.blockers.some(b => b.code === 'custom_kpi_not_implemented'));
  assert.doesNotMatch(JSON.stringify(p), /requestTemplates|remoteDataSourceId|sourceRefs|normalizedInput|formText/);
});
test('NB012: title and microsecond-only timestamp changes bind compilationHash independently of planHash', () => {
  const r = row(), before = compilePreview(r);
  r.configuration.requirements.educationName = '다른 교육';
  const title = compilePreview(r); assert.equal(title.planHash, before.planHash); assert.notEqual(title.compilationHash, before.compilationHash);
  r.updated_at = UPDATED.replace('123456', '123457');
  const time = compilePreview(r); assert.equal(time.planHash, title.planHash); assert.notEqual(time.compilationHash, title.compilationHash);
});
test('NB012: Select/Multi-select preserve option colors without source text or row values', () => {
  const r = row(); r.configuration.mapping.formText = 'PRIVATE_FORM';
  for (const type of ['select', 'multi_select']) r.configuration.mapping.model.properties.push({localId: type, origin: 'manual', name: type, type, included: true, targetDb: 'applications', mappingStatus: 'confirmed', rawText: 'PRIVATE_RAW', questionName: 'PRIVATE_QUESTION', options: [{localId: 'option-1', name: '옵션', color: 'purple', colorSource: 'user'}]});
  r.configuration.rows = ['PRIVATE_ROW']; r.configuration.token = 'PRIVATE_TOKEN';
  const p = compilePreview(r);
  for (const type of ['select', 'multi_select']) assert.deepEqual(p.preview.properties.find(p => p.name === type).options, [{name: '옵션', color: 'purple'}]);
  assert.doesNotMatch(JSON.stringify(p), /PRIVATE_|token|questionName|rawText/);
});
test('NB012: relation pairs and calculation references resolve only to logical properties in dependency order', () => {
  const r = row('extended'); r.configuration.planner.enabledModules = ['attendance', 'judging', 'completion'];
  const p = compilePreview(r).preview, ids = new Set(p.properties.map(p => p.id));
  for (const relation of p.relations) { assert.ok(ids.has(relation.propertyId)); assert.ok(ids.has(relation.reversePropertyId)); }
  for (const rollup of p.rollups) for (const k of ['propertyId', 'relationPropertyId', 'targetPropertyId']) assert.ok(ids.has(rollup[k]));
  for (const f of p.formulas) { assert.ok(ids.has(f.ast.propertyId)); assert.ok(p.steps.find(s => s.id === 'calculations').logicalIds.includes(f.propertyId)); }
  p.steps.forEach((step, index) => step.dependsOn.forEach(dep => assert.ok(p.steps.findIndex(s => s.id === dep) < index)));
});
test('NB012: legacy v1 planner defaults, structural failure and property count cap', () => {
  const legacy = row(); delete legacy.configuration.planner; assert.equal(compilePreview(legacy).templateType, 'basic');
  const invalid = row(); invalid.schema_version = 2; assert.throws(() => compilePreview(invalid), e => e.status === 422);
  const many = row(); for (let i = 0; i < 101; i++) many.configuration.mapping.model.properties.push({localId: `manual-${i}`, origin: 'manual', name: `추가${i}`, type: 'rich_text', included: true, mappingStatus: 'confirmed', targetDb: 'applications', options: []});
  assert.throws(() => compilePreview(many), e => e.code === 'preview_limit_exceeded');
});
test('NB012: bounded options and UTF-8 response bytes reject oversized previews without truncation', () => {
  const r = row();
  const property = (i, count) => ({localId: `options-${i}`, origin: 'manual', name: `선택${i}`, type: 'select', included: true, targetDb: 'applications', mappingStatus: 'confirmed',
    options: Array.from({length: count}, (_, n) => ({localId: `option-${n}`, name: `${n}-${'x'.repeat(80)}`, color: 'purple'}))});
  r.configuration.mapping.model.properties.push(property(0, 101));
  assert.throws(() => compilePreview(r), e => e.code === 'preview_limit_exceeded');
  r.configuration.mapping.model.properties = configuration().mapping.model.properties;
  for (let i = 0; i < 50; i++) r.configuration.mapping.model.properties.push(property(i, 60));
  assert.ok(Buffer.byteLength(JSON.stringify(normalizeConfiguration(r.configuration))) < 524288);
  assert.throws(() => compilePreview(r), e => e.code === 'preview_limit_exceeded');
});
test('NB012: user-authored review reasons stay private while confirmation codes remain visible', () => {
  const r = row(); r.configuration.mapping.model.properties.at(-1).mappingStatus = 'review';
  r.configuration.mapping.model.properties.at(-1).reviewReasons = ['PRIVATE_RAW_QUESTION'];
  const result = compilePreview(r); assert.ok(result.confirmationItems.some(i => i.code === 'MAPPING_REVIEW'));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_RAW_QUESTION/);
});
test('NB012: valid unsupported Status remains HTTP 200 and explicitly blocks CLI', async () => {
  const r = row('standard'), u = upstream([r]);
  const body = await code(await handler(u)(request(input(r))), 200);
  assert.ok(body.blockers.some(b => b.type === 'status')); assert.equal(body.coverage.cli.standard.schemaSupported, false);
  assert.ok(u.calls.every(c => c.method === 'GET'));
});
test('NB012: foreign and absent IDs have identical 404; B can read B but not A', async () => {
  const a = row(), b = row('basic', B, USER_B), u = upstream([a, b]), run = handler(u);
  const foreign = await code(await run(request(input(b))), 404, 'draft_not_found');
  const missing = await code(await run(request({...input(a), draftId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'})), 404, 'draft_not_found');
  assert.deepEqual(foreign, missing);
  await code(await run(request(input(b), {token: 'test-B'})), 200);
  await code(await run(request(input(a), {token: 'test-B'})), 404, 'draft_not_found');
});
for (const field of ['draftId', 'expectedUpdatedAt', 'expectedPlanHash']) test(`NB012: required ${field}`, async () => {
  const body = input(row()); delete body[field]; const u = upstream();
  await code(await handler(u)(request(body)), 400, 'invalid_request'); assert.equal(u.calls.length, 0);
});
for (const field of ['configuration', 'user_id', 'notionToken', 'parentId', 'requestBody', 'approved']) test(`NB012: reject client-controlled ${field}`, async () => {
  const u = upstream(); await code(await handler(u)(request({...input(row()), [field]: 'PRIVATE'})), 400, 'invalid_request'); assert.equal(u.calls.length, 0);
});
test('NB012: strict content type, JSON, size, UUID and hash validation', async () => {
  const run = handler(upstream());
  await code(await run(request('bad')), 400, 'invalid_json');
  await code(await run(request('{}', {headers: {'Content-Type': 'text/plain'}})), 415, 'json_required');
  await code(await run(request(' '.repeat(2049))), 413, 'body_too_large');
  await code(await run(request({...input(row()), draftId: 'invalid'})), 400, 'invalid_draft_id');
  await code(await run(request({...input(row()), expectedPlanHash: 'abc'})), 400, 'invalid_snapshot');
});
test('NB012: method, origin, missing/invalid authentication and per-request identity isolation', async () => {
  const u = upstream(), run = handler(u);
  await code(await run(request(undefined, {method: 'GET'})), 405, 'method_not_allowed');
  await code(await run(request(undefined, {headers: {Origin: 'https://other.example'}})), 403, 'origin_not_allowed');
  await code(await run(request(undefined, {token: null})), 401, 'auth_required');
  await code(await run(request(undefined, {token: 'bad'})), 401, 'invalid_session');
  const results = await Promise.all([run(request()), run(request(undefined, {token: 'test-B'}))]);
  assert.deepEqual(results.map(r => r.status), [200, 404]);
});
test('NB012: microsecond, plan hash and title-only conflicts; current snapshot succeeds', async () => {
  const r = row(), u = upstream([r]), run = handler(u), original = input(r);
  await code(await run(request({...original, expectedUpdatedAt: UPDATED.replace('123456', '123455')})), 409, 'saved_draft_changed');
  await code(await run(request({...original, expectedPlanHash: '0'.repeat(64)})), 409, 'saved_draft_changed');
  await code(await run(request(original)), 200);
  r.configuration.requirements.educationName = '새 제목'; r.updated_at = UPDATED.replace('123456', '123457');
  assert.equal(reviewSavedDraft(r).planHash, original.expectedPlanHash);
  await code(await run(request(original)), 409, 'saved_draft_changed');
});
test('NB012: structural 422 and safe upstream/internal errors contain no secrets', async () => {
  const r = row(); r.schema_version = 3;
  await code(await handler(upstream([r]))(request()), 422, 'invalid_saved_plan');
  const run = createNotionPreviewHandler({env: ENV, fetchImpl: async () => { throw new Error('PRIVATE_SECRET'); }});
  const body = await code(await run(request()), 502, 'upstream_unavailable'); assert.doesNotMatch(JSON.stringify(body), /PRIVATE/);
});

function controllerFixture() {
  const w = createWorkspace({storage: storage(), userId: USER_A});
  w.open({id: A, updatedAt: UPDATED, configuration: configuration()});
  const drafts = {...w, captureForReview: () => w.snapshot()};
  let user = USER_A, delay = null, failure = null; const states = [], calls = [];
  const fetchImpl = async (path, options) => {
    calls.push({path, body: JSON.parse(options.body)});
    if (path === '/api/drafts/review') return Response.json({draftId: w.snapshot().id, updatedAt: UPDATED, planHash: reviewSavedDraft(row()).planHash});
    if (delay) await delay;
    if (failure) return Response.json({error: {code: failure, message: 'PRIVATE_ERROR'}}, {status: 409});
    return Response.json(compilePreview(row()));
  };
  const c = createPreviewController({drafts, fetchImpl, getSession: async () => ({data: {session: user ? {user: {id: user}, access_token: 'SYNTHETIC'} : null}}), onChange: s => states.push(s)});
  return {w, drafts, c, states, calls, setUser: id => {user = id;}, hold(p) {delay = p;}, fail(code) {failure = code;}};
}
test('NB012 UI: two read-only requests bind the saved snapshot without auto-save', async () => {
  const f = controllerFixture(); await f.c.review();
  assert.equal(f.states.at(-1).status, 'ready'); assert.equal(f.calls.length, 2);
  assert.deepEqual(Object.keys(f.calls[1].body).sort(), ['draftId', 'expectedPlanHash', 'expectedUpdatedAt']);
  assert.equal(f.w.snapshot().dirty, false); f.c.dispose();
});
test('NB012 UI: unsaved, dirty and pending CSV inputs cannot request server preview', async () => {
  for (const mode of ['new', 'dirty', 'csv']) {
    const f = controllerFixture();
    if (mode === 'new') f.w.reset();
    if (mode === 'dirty') f.w.update('planner', {templateType: 'standard'});
    if (mode === 'csv') f.drafts.captureForReview = () => {throw {code: 'analysis_required'};};
    await f.c.review(); assert.equal(f.calls.length, 0); assert.equal(f.states.at(-1).status, 'error'); f.c.dispose();
  }
});
for (const mode of ['draft', 'edit', 'logout', 'account']) test(`NB012 UI: delayed result is discarded after ${mode}`, async () => {
  const f = controllerFixture(); let release; f.hold(new Promise(r => {release = r;}));
  const pending = f.c.review(); while (f.calls.length < 2) await Promise.resolve();
  if (mode === 'draft') f.w.open({id: B, updatedAt: UPDATED, configuration: configuration()});
  if (mode === 'edit') f.w.update('requirements', {educationName: '편집됨'});
  if (mode === 'logout') f.c.dispose();
  if (mode === 'account') f.setUser(USER_B);
  release(); await pending; assert.ok(!f.states.some(s => s.status === 'ready')); f.c.dispose();
});
test('NB012 UI: 409 and network errors preserve editors; saving invalidates an existing preview', async () => {
  const f = controllerFixture(), before = f.w.snapshot(); f.fail('saved_draft_changed');
  await f.c.review(); assert.match(f.states.at(-1).message, /최신 설계/); assert.doesNotMatch(f.states.at(-1).message, /PRIVATE/);
  assert.deepEqual(f.w.snapshot(), before); f.c.dispose();
  const next = controllerFixture(); await next.c.review();
  next.w.saved({id: A, updatedAt: UPDATED.replace('123456', '123457'), configuration: configuration()}, next.w.snapshot().revision);
  assert.equal(next.states.at(-1).status, 'idle'); next.c.dispose();
});
test('NB012 UI: superseded requests and a save response arriving after edits never restore a stale result', async () => {
  const f = controllerFixture(); let release; f.hold(new Promise(r => {release = r;}));
  const pending = f.c.review(); while (f.calls.length < 2) await Promise.resolve();
  const revision = f.w.snapshot().revision;
  f.w.update('requirements', {educationName: '요청 이후 수정'});
  f.w.saved({id: A, updatedAt: UPDATED.replace('123456', '123457'), configuration: configuration()}, revision);
  release(); await pending;
  assert.equal(f.w.snapshot().dirty, true); assert.equal(f.w.snapshot().configuration.requirements.educationName, '요청 이후 수정');
  assert.ok(!f.states.some(s => s.status === 'ready')); f.c.dispose();
});
test('NB012 UI: network rejection preserves configuration and offers retry without exposing exception text', async () => {
  const f = controllerFixture(), before = f.w.snapshot(), states = [];
  const c = createPreviewController({drafts: f.drafts, getSession: async () => ({data: {session: {user: {id: USER_A}, access_token: 'SYNTHETIC'}}}),
    fetchImpl: async () => {throw new Error('PRIVATE_NETWORK');}, onChange: s => states.push(s)});
  await c.review(); assert.match(states.at(-1).message, /편집 내용은 유지/); assert.doesNotMatch(states.at(-1).message, /PRIVATE_NETWORK/);
  assert.deepEqual(f.w.snapshot(), before); c.dispose(); f.c.dispose();
});
test('NB012 UI: text-only rendering handles markup and preserves options, support and dependencies', () => {
  const p = compilePreview(row('standard')); p.preview.page.name = '<img src=x onerror=alert(1)>';
  const root = new Element(); renderPreview(root, p, {createElement: tag => new Element(tag)});
  assert.match(root.textContent, /<img/); assert.equal(root.querySelectorAll('img').length, 0);
  assert.match(root.textContent, /웹 실행: 미지원/); assert.match(root.textContent, /관계·계산·의존 순서/);
  assert.match(root.textContent, /purple|blue|gray/);
});
test('NB012 UI: mount clears all rendered content on auth-cleared without credentials in DOM', async () => {
  const f = controllerFixture(), events = {}, root = new Element('details'); root.contains = () => false;
  const eventTarget = {addEventListener: (k, fn) => {events[k] = fn;}, removeEventListener: k => {delete events[k];}};
  const controller = mountPreview({root, drafts: f.drafts, getSession: async () => ({data: {session: {user: {id: USER_A}, access_token: 'SYNTHETIC'}}}),
    fetchImpl: async path => Response.json(path.includes('/drafts/') ? {draftId: A, updatedAt: UPDATED, planHash: reviewSavedDraft(row()).planHash} : compilePreview(row())),
    doc: {...eventTarget, createElement: tag => new Element(tag)}, win: eventTarget});
  await controller.review(); assert.match(root.textContent, /가상 교육/); assert.doesNotMatch(root.textContent, /SYNTHETIC/);
  events['est-auth-cleared'](); assert.equal(root.textContent, ''); f.c.dispose();
});
test('NB012: public assets include only browser preview; server source stays private and local routing works', async t => {
  // Keep this test's build isolated from older tests that rebuild public-dist.
  const root = await mkdtemp(join(tmpdir(), 'nb012-build-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const repository = fileURLToPath(new URL('../../../', import.meta.url));
  for (const file of PUBLIC_FILES) { await mkdir(dirname(join(root, file)), {recursive: true}); await copyFile(join(repository, file), join(root, file)); }
  const build = await buildStatic(root); assert.equal(build.count, 32); assert.ok(PUBLIC_FILES.includes('js/notion-preview.mjs'));
  assert.ok(!PUBLIC_FILES.some(p => p.startsWith('server/') || p.startsWith('api/')));
  for (const name of ['index', 'mapping', 'result']) {
    const html = await readFile(new URL(`../../../${name}.html`, import.meta.url), 'utf8');
    assert.equal((html.match(/data-notion-preview/g) ?? []).length, 1); assert.match(html, /src="js\/notion-preview.mjs"/);
  }
  const u = upstream(), server = await startReviewServer({port: 0, notionPreviewHandler: handler(u), publicRoot: join(root, 'public-dist')});
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/notion/plans/review`)).status, 405);
  assert.equal((await fetch(`${base}/api/notion/plans/review`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer test-A'}, body: JSON.stringify(input(row()))})).status, 200);
  for (const path of ['/server/notion/preview-plan.mjs', '/scripts/basic-notion/plan.mjs', '/.env', '/docs/internal.md']) assert.equal((await fetch(base + path)).status, 404);
  assert.equal((await fetch(`${base}/js/notion-preview.mjs`)).status, 200);
});
