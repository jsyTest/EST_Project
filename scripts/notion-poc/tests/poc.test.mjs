import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readConfig, API_VERSION, normalizeId } from '../config.mjs';
import { makeFixture, validateFixture, expectedKpis } from '../fixture.mjs';
import { validatePlan, CALCULATIONS, relationPayload } from '../schema.mjs';
import { NotionClient, NotionError } from '../client.mjs';
import { RunStore } from '../state.mjs';
import { dryRun, runPoc, assertConfiguration } from '../engine.mjs';
import { verifyRemote } from '../verify.mjs';
import { parseArgs } from '../cli.mjs';
import { FakeNotion, PARENT_ID } from './fake-notion.mjs';

const noSleep = async () => {};
async function setup(t, fakeOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'notion-poc-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new RunStore('test-run', directory);
  const client = new FakeNotion(fakeOptions);
  const config = { parentId: PARENT_ID, apiVersion: API_VERSION, token: 'local-test-only' };
  return { store, client, config, runId: 'test-run', confirmParent: PARENT_ID, verificationOptions: { attempts: 1, sleep: noSleep } };
}

test('live configuration requires token and explicit parent, dry run does not', () => {
  assert.equal(readConfig({}).parentId, null);
  assert.throws(() => readConfig({}, { live: true }), /NOTION_API_TOKEN/);
  assert.throws(() => readConfig({ NOTION_API_TOKEN: 'local-only' }, { live: true }), /NOTION_TEST_PARENT_PAGE_ID/);
  assert.throws(() => readConfig({ NOTION_TEST_PARENT_PAGE_ID: 'https://notion.so/anything' }), /UUID/);
  assert.equal(normalizeId(PARENT_ID.replaceAll('-', '')), PARENT_ID);
});
test('dry run validates the plan without credentials or network', () => {
  const plan = dryRun(readConfig({}));
  assert.equal(plan.networkRequests, 0);
  assert.equal(plan.databases.length, 6);
  assert.equal(plan.expectedBaseline.applicants, 3);
  assert.equal(plan.expectedBaseline.applications, 4);
  assert.equal(plan.expectedBaseline.completionRate, 50);
  assert.equal(plan.expectedBaseline.attendanceRate, 75);
});
test('CLI rejects unknown, duplicate, missing and path-traversal options', () => {
  assert.equal(parseArgs([]).command, 'dry-run');
  for (const args of [['delete'], ['apply', '--run-id'], ['apply', '--token', 'secret'], ['apply', '--run-id', '../x'], ['apply', '--run-id', 'x', '--run-id', 'y']]) assert.throws(() => parseArgs(args));
});
test('live CLI with missing environment exits before creating state', t => {
  const env = { ...process.env }; delete env.NOTION_API_TOKEN; delete env.NOTION_TEST_PARENT_PAGE_ID;
  const result = spawnSync(process.execPath, ['scripts/notion-poc/cli.mjs', 'apply', '--confirm-parent', PARENT_ID], { encoding: 'utf8', env });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOTION_API_TOKEN/);
});
test('fixture models per-course selection and prohibits unselected enrollment', () => {
  const fixture = makeFixture();
  validateFixture(fixture);
  assert.equal(fixture.applications.find(r => r.id === 'AP02').status, '미선정');
  fixture.enrollments.push({ id: 'E03', application: 'AP02', applicant: 'A01', course: 'C02', completed: false });
  assert.throws(() => validateFixture(fixture), /선정된/);
});
test('unique people, application counts and completion records are distinct', () => {
  const fixture = makeFixture();
  fixture.applications.find(r => r.id === 'AP02').status = '선정';
  fixture.enrollments.push({ id: 'E03', application: 'AP02', applicant: 'A01', course: 'C02', completed: true });
  validateFixture(fixture);
  const k = expectedKpis(fixture);
  assert.equal(k.applicants, 3); assert.equal(k.applications, 4);
  assert.equal(k.selectedPeople, 2); assert.equal(k.enrollments, 3);
  assert.equal(k.completions, 2); assert.equal(k.completedPeople, 1);
});
test('fixture rejects duplicate attendance and dangling references', () => {
  const fixture = makeFixture();
  fixture.attendance.push({ ...fixture.attendance[0], id: 'AT05' });
  assert.throws(() => validateFixture(fixture), /중복 출석/);
  fixture.attendance.pop(); fixture.applications[0].applicant = 'absent';
  assert.throws(() => validateFixture(fixture), /관계 대상/);
});
test('selected people are counted from applications, not from created enrollments', () => {
  const fixture = makeFixture();
  fixture.applications.find(r => r.id === 'AP04').status = '선정';
  assert.equal(expectedKpis(fixture).selectedPeople, 3);
  assert.equal(expectedKpis(fixture).enrollments, 2);
  assert.ok(CALCULATIONS.find(b => b.properties['선정 고유 인원']).properties['선정 고유 인원'].formula.expression.startsWith('prop("신청기록")'));
});
test('view verification checks aggregation property IDs, not just chart type', () => {
  const expected = { type: 'chart', chart_type: 'number', value: { aggregator: 'sum', property_id: 'p1' } };
  assert.doesNotThrow(() => assertConfiguration(expected, { ...expected, height: 'small' }));
  assert.throws(() => assertConfiguration(expected, { ...expected, value: { aggregator: 'sum', property_id: 'wrong' } }), /property_id/);
});
test('schema references and dependent calculation ordering are valid', () => {
  const schemas = validatePlan();
  assert.ok(schemas.enrollments['출석기록']);
  assert.ok(schemas.metrics['수료율'].formula);
  const original = CALCULATIONS[0].properties['출석 인정 값'].formula.expression;
  try {
    CALCULATIONS[0].properties['출석 인정 값'].formula.expression = 'prop("없는 속성")';
    assert.throws(() => validatePlan(), /참조 속성 없음/);
  } finally { CALCULATIONS[0].properties['출석 인정 값'].formula.expression = original; }
  assert.throws(() => relationPayload({ target: 'missing' }, {}), /data_source_id/);
});
test('parent confirmation mismatch performs no requests', async t => {
  const args = await setup(t);
  await assert.rejects(runPoc({ ...args, confirmParent: '22222222-2222-4222-8222-222222222222' }), /일치/);
  assert.equal(args.client.calls.length, 0);
});
test('permission denial on the explicit parent stops before any write', async t => {
  const args = await setup(t);
  args.client.get = async path => { args.client.record('GET', path); throw new NotionError({ status: 403, code: 'restricted_resource' }); };
  await assert.rejects(runPoc(args), /403/);
  assert.deepEqual(args.client.calls.map(c => [c.method, c.path]), [['GET', `/v1/pages/${PARENT_ID}`]]);
  assert.equal((await args.store.read()).status, 'failed');
});
test('an archived parent is rejected without searching for a different page', async t => {
  const args = await setup(t);
  args.client.pages.get(PARENT_ID).in_trash = true;
  await assert.rejects(runPoc(args), /상위 페이지/);
  assert.equal(args.client.calls.length, 1);
  assert.equal(args.client.calls[0].method, 'GET');
});
test('full simulated run verifies baseline, recalculation, six DBs and views', async t => {
  const args = await setup(t);
  const state = await runPoc(args);
  assert.equal(state.status, 'complete');
  assert.equal(Object.keys(state.databases).length, 6);
  assert.equal(Object.values(state.rows).reduce((sum, rows) => sum + Object.keys(rows).length, 0), 16);
  assert.equal(state.verification.baseline.actual.attendanceRate, 75);
  assert.equal(state.verification.afterChange.actual.attendanceRate, 100);
  assert.equal(state.verification.baseline.actual.completionRate, 50);
  assert.equal(state.views.length, 11);
  assert.ok(state.views.every(view => view.verified));
  const dashboard = args.client.views.get(state.views[0].id);
  assert.deepEqual(dashboard.configuration.rows.map(row => row.widgets.length), [4, 3, 3]);
  assert.equal((await verifyRemote(args.client, state)).ok, true);
  assert.equal(state.visualInspection, 'not_performed');
  const mutations = args.client.calls.filter(c => c.method === 'PATCH' && c.path.startsWith('/v1/pages/'));
  assert.deepEqual(mutations.map(c => c.path), [`/v1/pages/${state.rows.attendance.AT04.id}`]);
});
test('completed run is reused with zero additional API calls', async t => {
  const args = await setup(t); await runPoc(args);
  const count = args.client.calls.length;
  const repeated = await runPoc(args);
  assert.equal(repeated.reusedExistingRun, true);
  assert.equal(args.client.calls.length, count);
});
test('failed run preserves object IDs and refuses to recreate anything', async t => {
  const args = await setup(t, { failSeed: true });
  await assert.rejects(runPoc(args), /simulated seed/);
  const state = await args.store.read();
  assert.equal(state.status, 'failed'); assert.ok(state.page.id);
  assert.equal(Object.keys(state.databases).length, 6);
  const count = args.client.calls.length;
  await assert.rejects(runPoc(args), /未|미완료/);
  assert.equal(args.client.calls.length, count);
});
test('lost response after a creation marks uncertainty and prevents duplicate creation', async t => {
  const args = await setup(t);
  const post = args.client.post.bind(args.client);
  args.client.post = async (path, body) => {
    await post(path, body);
    throw new NotionError({ code: 'transport_or_response_error', uncertain: true });
  };
  await assert.rejects(runPoc(args), /Notion 요청 실패/);
  const state = await args.store.read();
  assert.equal(state.steps.at(-1).status, 'uncertain');
  assert.equal(state.requiresManualReview, true);
  const count = args.client.calls.length;
  await assert.rejects(runPoc(args), /미완료/);
  assert.equal(args.client.calls.length, count);
});
test('wrong KPI stops before mutation and never reports completion', async t => {
  const args = await setup(t, { wrongCalculation: true });
  await assert.rejects(runPoc(args), /초기 관계\/KPI 검증 실패/);
  const state = await args.store.read();
  assert.equal(state.verification.baseline.ok, false);
  assert.equal(state.attendanceChanged, false);
  assert.equal(state.status, 'failed');
});
test('Dashboard rejection is recorded and standalone views remain usable', async t => {
  const args = await setup(t, { rejectDashboard: true });
  const state = await runPoc(args);
  assert.equal(state.status, 'partial');
  assert.equal(state.views.length, 10);
  assert.ok(args.client.calls.filter(c => c.path === '/v1/views' && c.body.type !== 'dashboard').every(c => c.body.database_id && !c.body.view_id));
  assert.equal(state.verification.afterChange.ok, true);
});
test('chart rejection is a failed step, never a fabricated chart success', async t => {
  const state = await runPoc(await setup(t, { rejectChart: true }));
  assert.equal(state.status, 'partial');
  assert.equal(state.views.filter(view => view.type === 'chart').length, 0);
  assert.equal(state.views.filter(view => view.type === 'table').length, 3);
  assert.equal(state.steps.filter(step => step.status === 'failed').length, 7);
});
test('corrupt state and concurrent lock both block execution', async t => {
  const args = await setup(t);
  await args.store.lock();
  await assert.rejects(runPoc(args), /잠금/);
  await args.store.unlock();
  await writeFile(args.store.path, '{bad json');
  await assert.rejects(runPoc(args), /상태 파일/);
  assert.equal(args.client.calls.length, 0);
});
test('manifest contains no credential', async t => {
  const args = await setup(t); await runPoc(args);
  assert.ok(!(await readFile(args.store.path, 'utf8')).includes(args.config.token));
});

const reply = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });
test('HTTP request pins the version, keeps credentials in headers, and refuses redirects', async () => {
  let options;
  const client = new NotionClient({ token: 'private-local-test', sleep: noSleep, fetchImpl: async (url, init) => { options = init; return reply(200, { object: 'page' }); } });
  await client.get(`/v1/pages/${PARENT_ID}`);
  assert.equal(options.headers['Notion-Version'], API_VERSION);
  assert.equal(options.redirect, 'error');
  assert.equal(options.body, undefined);
  assert.equal(options.headers.Authorization, 'Bearer private-local-test');
});
test('429 respects Retry-After and retries a rejected write', async () => {
  const waits = []; let calls = 0;
  const client = new NotionClient({ token: 'local', intervalMs: 0, sleep: async ms => waits.push(ms), fetchImpl: async () => ++calls === 1 ? reply(429, { code: 'rate_limited' }, { 'retry-after': '2' }) : reply(200, { id: PARENT_ID }) });
  await client.post('/v1/pages', {});
  assert.equal(calls, 2); assert.ok(waits.includes(2000));
});
test('read requests retry 503 but unknown write results do not', async () => {
  let reads = 0, writes = 0;
  const readClient = new NotionClient({ token: 'local', sleep: noSleep, fetchImpl: async () => ++reads === 1 ? reply(503, { code: 'service_unavailable' }) : reply(200, {}) });
  await readClient.get('/v1/pages/x'); assert.equal(reads, 2);
  const writeClient = new NotionClient({ token: 'local', sleep: noSleep, fetchImpl: async () => { writes++; return reply(503, { code: 'service_unavailable' }); } });
  await assert.rejects(writeClient.post('/v1/pages', {}), e => e instanceof NotionError && e.uncertain);
  assert.equal(writes, 1);
});
test('network failure on a write is uncertain and never automatically retried', async () => {
  let calls = 0;
  const client = new NotionClient({ token: 'local', sleep: noSleep, fetchImpl: async () => { calls++; throw new Error('private token must not be echoed'); } });
  await assert.rejects(client.post('/v1/pages', {}), e => e.uncertain && !e.message.includes('private token'));
  assert.equal(calls, 1);
});
test('401/403 are not retried and server response messages are not leaked', async () => {
  for (const status of [401, 403]) {
    let calls = 0;
    const client = new NotionClient({ token: 'hidden-value', sleep: noSleep, fetchImpl: async () => { calls++; return reply(status, { code: 'restricted_resource', message: 'hidden-value' }); } });
    await assert.rejects(client.get('/v1/pages/x'), e => e.status === status && !e.message.includes('hidden-value'));
    assert.equal(calls, 1);
  }
});
test('query follows all cursors and rejects repeated pagination cursors', async () => {
  let calls = 0;
  const client = new NotionClient({ token: 'local', sleep: noSleep, fetchImpl: async () => ++calls === 1 ? reply(200, { results: [{ id: '1' }], has_more: true, next_cursor: 'opaque' }) : reply(200, { results: [{ id: '2' }], has_more: false }) });
  assert.equal((await client.queryAll(PARENT_ID)).length, 2);
  client.fetchImpl = async () => reply(200, { results: [], has_more: true, next_cursor: 'same' });
  await assert.rejects(client.queryAll(PARENT_ID), /ページ|페이지네이션/);
});
