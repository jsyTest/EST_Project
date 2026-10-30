import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createReviewHandler, MAX_REQUEST_BYTES} from '../../../server/drafts-review.mjs';
import {reviewSavedDraft, timestamp} from '../../../server/review-plan.mjs';
import {startReviewServer} from '../../development/serve-review.mjs';
import {buildStatic} from '../../deployment/build-static.mjs';
import {emptyConfiguration, normalizeConfiguration} from '../../../js/drafts/model.mjs';
import {createGenerationPlan} from '../../../js/planner/plan.mjs';
import {digest, freezeBasicPlan} from '../../basic-notion/plan.mjs';
import {USER_A, USER_B} from './helpers/drafts-fixture.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UPDATED = '2026-10-30T01:02:03.123456+00:00';
const ENV = {SUPABASE_URL: 'https://unit-review.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_SYNTHETIC'};
function configuration(type = 'basic') {
  const c = emptyConfiguration();
  c.requirements.educationName = 'NB-V2-011B 가상 설계';
  c.mapping.model.properties.push({localId: 'manual-1', origin: 'manual', name: '가상 이름', type: 'title',
    included: true, mappingStatus: 'confirmed', targetDb: 'applicants', options: []});
  c.planner.templateType = type;
  return normalizeConfiguration(c);
}
const row = (id = A, user = USER_A, c = configuration()) => ({id, user_id: user, configuration: c, schema_version: 1, updated_at: UPDATED});
function upstream(rows = [row()]) {
  const calls = [];
  const fetchImpl = async (address, options) => {
    const url = new URL(address), token = options.headers.Authorization;
    calls.push({url, options});
    assert.equal(url.origin, ENV.SUPABASE_URL);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.apikey, ENV.SUPABASE_PUBLISHABLE_KEY);
    const user = token === 'Bearer test-A' ? USER_A : token === 'Bearer test-B' ? USER_B : null;
    if (!user) return Response.json({msg: 'PRIVATE_UPSTREAM_TOKEN'}, {status: 401});
    if (url.pathname === '/auth/v1/user') return Response.json({id: user, email: 'PRIVATE_EMAIL', user_metadata: {user_id: USER_B}});
    assert.equal(url.pathname, '/rest/v1/education_drafts');
    assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
    assert.equal(url.searchParams.get('select'), 'id,user_id,configuration,schema_version,updated_at');
    assert.equal(url.searchParams.get('limit'), '1');
    return Response.json(rows.filter(r => r.user_id === user && `eq.${r.id}` === url.searchParams.get('id')));
  };
  return {calls, fetchImpl};
}
function request(body = {draftId: A}, {token = 'test-A', method = 'POST', headers = {}, url = 'http://127.0.0.1:8787/api/drafts/review'} = {}) {
  return new Request(url, {method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...headers},
    ...(!['GET', 'HEAD'].includes(method) ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {})});
}
const handler = u => createReviewHandler({fetchImpl: u.fetchImpl, env: ENV});
async function expectCode(response, status, code) {
  assert.equal(response.status, status); const b = await response.json();
  assert.equal(b.error.code, code); assert.equal(b.webExecutionReady, false); assert.equal(b.notionExecution, 'not_executed'); return b;
}

test('NB011B: missing Authorization is rejected before any network/config access', async () => {
  const u = upstream(); await expectCode(await handler(u)(request(undefined, {token: null})), 401, 'auth_required'); assert.equal(u.calls.length, 0);
});
for (const token of ['invalid', 'expired']) test(`NB011B: ${token} Auth response rejects and never queries drafts`, async () => {
  const u = upstream(); await expectCode(await handler(u)(request(undefined, {token})), 401, 'invalid_session'); assert.equal(u.calls.length, 1);
});
test('NB011B: user A retrieves own saved configuration without returning private fields', async () => {
  const c = configuration(); c.mapping.formText = 'PRIVATE_FORM_BODY'; c.mapping.model.properties[0].rawText = 'PRIVATE_RAW_TEXT';
  c.rows = ['PRIVATE_RESPONSE_ROW']; c.notionToken = 'PRIVATE_NOTION_TOKEN';
  const u = upstream([row(A, USER_A, c)]), r = await handler(u)(request()), b = await r.json();
  assert.equal(r.status, 200); assert.equal(b.draftId, A); assert.equal(b.templateType, 'basic');
  assert.equal(b.cliSupport.basic.schemaSupported, true); assert.equal(b.webExecutionReady, false);
  assert.equal(b.notionExecution, 'not_executed'); assert.equal(b.counts.rows, 0);
  assert.equal(b.notionRequests, 0); assert.equal(b.supabaseWrites, 0);
  assert.doesNotMatch(JSON.stringify(b), /PRIVATE_|test-A|user_metadata|requestTemplates|formText|rawText|configuration"/);
  assert.equal(u.calls.length, 2);
});
test('NB011B: foreign ID and absent ID return indistinguishable 404 responses', async () => {
  const u = upstream([row(), row(B, USER_B)]), run = handler(u);
  const foreign = await run(request({draftId: B})), absent = await run(request({draftId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));
  assert.equal(foreign.status, 404); assert.equal(absent.status, 404); assert.deepEqual(await foreign.json(), await absent.json());
});
test('NB011B: defense-in-depth rejects an upstream row with the wrong owner/id', async () => {
  for (const bad of [row(A, USER_B), row(B, USER_A)]) {
    const u = upstream(), original = u.fetchImpl;
    u.fetchImpl = (url, options) => new URL(url).pathname.startsWith('/rest/') ? Promise.resolve(Response.json([bad])) : original(url, options);
    await expectCode(await handler(u)(request()), 404, 'draft_not_found');
  }
});
for (const body of [{draftId: 'wrong'}, {}, {draftId: A, user_id: USER_B}, {draftId: A, configuration: {}}, {draftId: A, notionToken: 'forbidden'}, {draftId: A, formula: 'forbidden'}, [], null]) test(`NB011B: rejects malformed/extra body fields ${JSON.stringify(body)}`, async () => {
  const u = upstream(), r = await handler(u)(request(JSON.stringify(body))); assert.equal(r.status, 400); assert.equal(u.calls.length, 0);
});
test('NB011B: streamed body limit applies without Content-Length', async () => {
  const u = upstream(); await expectCode(await handler(u)(request(' '.repeat(MAX_REQUEST_BYTES + 1))), 413, 'body_too_large'); assert.equal(u.calls.length, 0);
});
test('NB011B: rejects oversized declared length, malformed UTF8/JSON and non-JSON content', async () => {
  const u = upstream(), run = handler(u);
  await expectCode(await run(request({}, {headers: {'Content-Length': '999999'}})), 413, 'body_too_large');
  await expectCode(await run(request('{')), 400, 'invalid_json');
  await expectCode(await run(new Request('http://127.0.0.1:8787/api/drafts/review', {method: 'POST', headers: {Authorization: 'Bearer test-A', 'Content-Type': 'application/json'}, body: new Uint8Array([0xff])})), 400, 'invalid_json');
  await expectCode(await run(request({}, {headers: {'Content-Type': 'text/plain'}})), 415, 'json_required');
  assert.equal(u.calls.length, 0);
});
test('NB011B: wrong method/path and browser cross-origin requests never reach Supabase', async () => {
  const u = upstream(), run = handler(u);
  const r = await run(request(undefined, {method: 'GET'})); assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'POST');
  await expectCode(await run(request({}, {url: 'http://127.0.0.1:8787/api/other'})), 404, 'route_not_found');
  await expectCode(await run(request({}, {headers: {Origin: 'https://foreign.example'}})), 403, 'origin_not_allowed');
  await expectCode(await run(request({}, {headers: {'Sec-Fetch-Site': 'cross-site'}})), 403, 'origin_not_allowed');
  assert.equal(u.calls.length, 0);
});
test('NB011B: same-origin browser and CLI requests work; responses prevent every cache layer', async () => {
  const u = upstream(), r = await handler(u)(request(undefined, {headers: {Origin: 'http://127.0.0.1:8787'}}));
  assert.equal(r.status, 200);
  for (const key of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) assert.match(r.headers.get(key), /no-store/);
  assert.equal(r.headers.get('vary'), 'Authorization, Origin'); assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});
test('NB011B: production origin allowlist is exact; preview requires explicit configuration', async () => {
  const u = upstream();
  const preview = 'https://preview.example';
  await expectCode(await handler(u)(request(undefined, {url: preview + '/api/drafts/review', headers: {Origin: preview}})), 403, 'origin_not_allowed');
  const configured = createReviewHandler({fetchImpl: u.fetchImpl, env: {...ENV, REVIEW_ALLOWED_ORIGINS: preview}});
  assert.equal((await configured(request(undefined, {url: preview + '/api/drafts/review', headers: {Origin: preview}}))).status, 200);
});
for (const type of ['basic', 'standard', 'extended']) test(`NB011B: saved ${type} planner and recommendation conditions are retained`, async () => {
  const c = configuration(type); c.planner.repeatPrograms = true; c.planner.personHistory = true;
  if (type === 'extended') c.planner.enabledModules = ['attendance', 'teams'];
  const u = upstream([row(A, USER_A, c)]), r = await handler(u)(request()), b = await r.json();
  assert.equal(r.status, 200); assert.equal(b.templateType, type); assert.equal(b.planVersion, 1);
  assert.ok(b.recommendations.reasons.includes('repeatPrograms')); assert.ok(b.recommendations.reasons.includes('personHistory'));
  if (type === 'extended') { assert.deepEqual(b.requestedModules, ['attendance', 'teams']); assert.ok(b.enabledModules.includes('participation')); assert.equal(b.counts.databases, 6); }
  assert.equal(b.webExecutionReady, false); assert.equal(b.notionExecution, 'not_executed');
});
test('NB011B: legacy v1 without planner has the identical default plan and no mutation', () => {
  const c = configuration(); delete c.planner; const r = row(A, USER_A, c), before = structuredClone(r);
  const result = reviewSavedDraft(r); assert.equal(result.templateType, 'basic');
  assert.equal(result.planHash, reviewSavedDraft(row()).planHash); assert.deepEqual(r, before);
});
test('NB011B: logical SHA256 is stable and exactly matches basic compiler hash', async () => {
  const r = row(), plan = createGenerationPlan(normalizeConfiguration(r.configuration), r.configuration.planner), u = upstream([r]), run = handler(u);
  const first = await (await run(request())).json(), again = await (await run(request())).json();
  assert.equal(first.planHash, digest(plan)); assert.equal(first.planHash, freezeBasicPlan(plan).planHash);
  assert.equal(first.planHash, again.planHash); assert.match(first.planHash, /^[a-f0-9]{64}$/);
  assert.equal(first.planId, plan.planId); assert.match(first.hashScope, /not_execution_approval/);
});
test('NB011B: expected snapshots accept equivalent timezones and preserve microseconds', async () => {
  const u = upstream(), run = handler(u), hash = reviewSavedDraft(row()).planHash;
  assert.equal((await run(request({draftId: A, expectedUpdatedAt: '2026-10-30T10:02:03.123456+09:00', expectedPlanHash: hash}))).status, 200);
  const changed = await expectCode(await run(request({draftId: A, expectedUpdatedAt: '2026-10-30T01:02:03.123455Z'})), 409, 'saved_draft_changed');
  assert.deepEqual(changed.changed, ['updated_at']);
  assert.notEqual(timestamp(UPDATED), timestamp('2026-10-30T01:02:03.123Z'));
});
test('NB011B: old plan hash or modified planner reports stale instead of an approval', async () => {
  const c = configuration('extended'), oldHash = reviewSavedDraft(row()).planHash;
  const u = upstream([row(A, USER_A, c)]), r = await handler(u)(request({draftId: A, expectedPlanHash: oldHash}));
  const b = await expectCode(r, 409, 'saved_draft_changed'); assert.deepEqual(b.changed, ['plan_hash']); assert.equal(b.reviewStatus, 'stale');
});
test('NB011B: invalid snapshot timestamp/hash is rejected before authentication upstream', async () => {
  const u = upstream();
  for (const extra of [{expectedPlanHash: 'not-a-hash'}, {expectedUpdatedAt: 'yesterday'}, {expectedUpdatedAt: null}]) await expectCode(await handler(u)(request({draftId: A, ...extra})), 400, 'invalid_snapshot');
  assert.equal(u.calls.length, 0);
});
test('NB011B: mapping confirmation and invalid duplicate property names remain visible', () => {
  const c = configuration(); c.mapping.model.properties.at(-1).mappingStatus = 'review'; c.mapping.model.properties.at(-1).reviewReasons = ['확인 필요'];
  const pending = reviewSavedDraft(row(A, USER_A, c)); assert.equal(pending.planValidation.status, 'confirmation_required');
  assert.ok(pending.planValidation.confirmationItems.some(x => x.code === 'MAPPING_REVIEW')); assert.equal(pending.cliSupport.basic.schemaSupported, false);
  c.mapping.model.properties.push({...structuredClone(c.mapping.model.properties.at(-1)), localId: 'manual-2', type: 'rich_text', mappingStatus: 'confirmed'});
  const invalid = reviewSavedDraft(row(A, USER_A, c)); assert.equal(invalid.planValidation.status, 'structural_error');
  assert.ok(invalid.planValidation.blockingErrors.some(x => x.code === 'PROPERTY_COLLISION'));
});
test('NB011B: structural errors are returned as 422 rather than successful execution', async () => {
  const c = configuration('standard'); c.planner.enabledModules = ['teams'];
  const u = upstream([row(A, USER_A, c)]), r = await handler(u)(request()), b = await r.json();
  assert.equal(r.status, 422); assert.ok(b.planValidation.blockingErrors.some(x => x.code === 'EXTENDED_REQUIRED')); assert.equal(b.templateType, 'standard');
});
test('NB011B: invalid JSON configuration and unknown schema versions produce safe structural errors', async () => {
  for (const bad of [{...row(), configuration: '{PRIVATE_BROKEN'}, {...row(), schema_version: 2}, {...row(), configuration: {version: 1, planner: {templateType: 'UNKNOWN'}}}]) {
    const r = await handler(upstream([bad]))(request()), b = await r.json();
    assert.equal(r.status, 422); assert.equal(b.reviewStatus, 'structural_error'); assert.equal(b.planHash, null);
    assert.doesNotMatch(JSON.stringify(b), /PRIVATE_BROKEN|UNKNOWN/); assert.equal(b.webExecutionReady, false);
  }
});
for (const type of ['url', 'status']) test(`NB011B: ${type} is never silently converted or omitted`, () => {
  const c = configuration(); c.mapping.model.properties.push({...structuredClone(c.mapping.model.properties.at(-1)), localId: 'unsupported', name: '미지원 속성', type,
    options: type === 'status' ? [{localId: 's', name: '대기', color: 'gray', group: 'To-do'}] : []});
  const b = reviewSavedDraft(row(A, USER_A, c));
  if (type === 'url') {
    assert.equal(b.reviewStatus, 'structural_error');
    assert.ok(b.planValidation.blockingErrors.some(e => e.code === 'unsupported_saved_property_type' && e.type === 'url'));
    return;
  }
  assert.equal(b.cliSupport.basic.schemaSupported, false); assert.ok(b.cliSupport.unsupportedProperties.some(p => p.type === type));
  assert.equal(b.reviewStatus, 'unsupported_features');
});
test('NB011B: standard fixture limitation, relations and calculations are distinguished from web readiness', () => {
  const c = configuration('standard'), b = reviewSavedDraft(row(A, USER_A, c));
  assert.equal(b.counts.databases, 3); assert.equal(b.counts.relations, 2); assert.equal(b.counts.relationProperties, 4);
  assert.ok(b.counts.rollups > 0); assert.ok(b.counts.formulas > 0);
  assert.ok(b.cliSupport.standard.reasons.some(x => x.code === 'synthetic_seven_rows_required'));
  assert.equal(b.cliSupport.standard.schemaSupported, false); assert.equal(b.webExecutionReady, false);
  assert.ok(b.cliSupport.unsupportedProperties.some(p => p.type === 'status'));
});
test('NB011B: a valid plan exceeding basic CLI property limits is marked unsupported', () => {
  const c = configuration();
  for (let i = 0; i < 101; i++) c.mapping.model.properties.push({...structuredClone(c.mapping.model.properties.at(-1)), localId: `many-${i}`, name: `가상 추가 ${i}`, type: 'rich_text'});
  const b = reviewSavedDraft(row(A, USER_A, c));
  assert.equal(b.planValidation.valid, true); assert.equal(b.reviewStatus, 'unsupported_features');
  assert.equal(b.cliSupport.basic.reasons[0].code, 'property_count_limit');
});
test('NB011B: anonymous Auth users and cancelled upstream requests cannot read drafts', async () => {
  const u = upstream(); u.fetchImpl = async () => Response.json({id: USER_A, is_anonymous: true});
  await expectCode(await handler(u)(request()), 401, 'invalid_session');
  const abort = new AbortController(); abort.abort();
  const req = new Request(request(), {signal: abort.signal});
  await expectCode(await handler(upstream())(req), 504, 'request_timeout');
});
test('NB011B: simultaneous A/B requests never mix JWTs, owners, templates or hashes', async () => {
  const u = upstream([row(), row(B, USER_B, configuration('extended'))]), original = u.fetchImpl;
  u.fetchImpl = async (url, options) => { await new Promise(r => setTimeout(r, options.headers.Authorization.endsWith('A') ? 5 : 1)); return original(url, options); };
  const run = handler(u), pairs = await Promise.all(Array.from({length: 12}, (_, i) => run(request({draftId: i % 2 ? B : A}, {token: i % 2 ? 'test-B' : 'test-A'})).then(r => r.json())));
  for (const [i, b] of pairs.entries()) { assert.equal(b.draftId, i % 2 ? B : A); assert.equal(b.templateType, i % 2 ? 'extended' : 'basic'); }
  assert.equal(new Set(pairs.filter((_, i) => i % 2 === 0).map(b => b.planHash)).size, 1);
});
test('NB011B: upstream permission, rate, outage, malformed response and expired data JWT are sanitized', async () => {
  for (const [stage, status, expected, code] of [['auth', 500, 502, 'auth_unavailable'], ['auth', 429, 429, 'upstream_rate_limited'], ['draft', 403, 403, 'draft_access_denied'], ['draft', 401, 401, 'invalid_session'], ['draft', 500, 502, 'draft_store_unavailable']]) {
    const u = upstream(), original = u.fetchImpl;
    u.fetchImpl = (url, options) => (new URL(url).pathname.includes(stage === 'auth' ? '/auth/' : '/rest/')) ? Promise.resolve(Response.json({error: 'PRIVATE_STACK_JWT'}, {status})) : original(url, options);
    const b = await expectCode(await handler(u)(request()), expected, code); assert.doesNotMatch(JSON.stringify(b), /PRIVATE_STACK/);
  }
  await expectCode(await createReviewHandler({env: ENV, fetchImpl: async () => { throw new Error('PRIVATE_EXCEPTION'); }})(request()), 502, 'upstream_unavailable');
  await expectCode(await createReviewHandler({env: ENV, fetchImpl: async () => new Response('invalid')})(request()), 502, 'invalid_upstream_response');
});
test('NB011B: missing env and privileged keys are refused without reading any Notion credential', async () => {
  const u = upstream();
  for (const env of [{}, {...ENV, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_FORBIDDEN'}, {...ENV, SUPABASE_PUBLISHABLE_KEY: 'eyJservice_role'}, {...ENV, SUPABASE_URL: 'https://foreign.example'}]) await expectCode(await createReviewHandler({env, fetchImpl: u.fetchImpl})(request()), 503, 'server_not_configured');
  const env = new Proxy(ENV, {get(target, key) { assert.doesNotMatch(String(key), /NOTION|SECRET|SERVICE_ROLE/); return target[key]; }});
  assert.equal((await createReviewHandler({env, fetchImpl: u.fetchImpl})(request())).status, 200);
});
test('NB011B: actual localhost HTTP review and static allowlist keep internal sources inaccessible', async t => {
  await buildStatic();
  const u = upstream(), server = await startReviewServer({port: 0, reviewHandler: handler(u)});
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(origin + '/api/drafts/review', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer test-A', Origin: origin}, body: JSON.stringify({draftId: A})});
  assert.equal(r.status, 200); assert.equal((await r.json()).templateType, 'basic');
  assert.equal((await fetch(origin + '/api/drafts/review')).status, 405);
  for (const path of ['/index.html', '/login.html', '/result.html', '/mapping.html', '/js/supabase-client.js', '/css/mapping.css']) assert.equal((await fetch(origin + path)).status, 200);
  for (const path of ['/server/drafts-review.mjs', '/api/drafts/review.mjs', '/scripts/notion-poc/cli.mjs', '/docs/research/NB-V2-011A_REPORT.md', '/.env']) assert.equal((await fetch(origin + path)).status, 404);
  assert.equal(u.calls.filter(c => c.url.hostname.includes('notion')).length, 0); assert.ok(u.calls.every(c => c.options.method === 'GET'));
});
test('NB011B: public build still has 26 assets and excludes API/server/CLI sources', async () => {
  // Build in the repository using its tested allowlist, inspect output without exposing server code.
  const result = await buildStatic(); assert.equal(result.count, 26);
  assert.ok(result.files.every(f => !/^(api|server|scripts|docs)\//.test(f)));
  assert.equal((await readdir(new URL('../../../public-dist/', import.meta.url))).includes('api'), false);
  const source = await readFile(new URL('../../../api/drafts/review.mjs', import.meta.url), 'utf8'); assert.match(source, /createReviewHandler/);
});
