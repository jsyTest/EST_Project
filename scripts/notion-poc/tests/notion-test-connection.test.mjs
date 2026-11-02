import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, copyFile, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createTestConnectionHandler, CONNECTION_PATH, TARGET_PATH} from '../../../server/notion/test-connection.mjs';
import {readTestConfiguration, notionId} from '../../../server/notion/test-configuration.mjs';
import {createTestNotionReader} from '../../../server/notion/test-readonly.mjs';
import {createConnectionController, mountTestConnection} from '../../../js/notion-test-connection.mjs';
import {Element} from './helpers/browser.mjs';
import {USER_A, USER_B, storage} from './helpers/drafts-fixture.mjs';
import {createWorkspace} from '../../../js/drafts/workspace.mjs';
import {emptyConfiguration} from '../../../js/drafts/model.mjs';
import {buildStatic, PUBLIC_FILES} from '../../deployment/build-static.mjs';
import {startReviewServer} from '../../development/serve-review.mjs';

const WORKSPACE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', BOT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', PARENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENV = {SUPABASE_URL: 'https://unit-connection.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_SYNTHETIC',
  PPLUS_NOTION_TEST_USER_ID: USER_A, PPLUS_NOTION_TEST_WORKSPACE_ID: WORKSPACE, PPLUS_NOTION_TEST_BOT_ID: BOT,
  PPLUS_NOTION_TEST_PARENT_PAGE_ID: PARENT, PPLUS_NOTION_TEST_SCOPE: 'personal-private-test', PPLUS_NOTION_TEST_TOKEN: 'ntn_SYNTHETIC_NOT_A_REAL_CREDENTIAL'};
const bot = () => ({object: 'user', type: 'bot', id: BOT, bot: {workspace_id: WORKSPACE, workspace_name: 'PRIVATE_WORKSPACE'}});
const page = () => ({object: 'page', id: PARENT, archived: false, in_trash: false, is_locked: false, public_url: null,
  parent: {type: 'workspace', workspace: true}, properties: {title: {title: [{plain_text: 'PRIVATE_TITLE'}]}}});
function mock({self = bot(), target = page(), status = 200, env = ENV, enabled = true} = {}) {
  const authCalls = [], notionCalls = [];
  const authFetch = async (address, options) => {
    const url = new URL(address); authCalls.push(url.pathname);
    assert.equal(url.origin, ENV.SUPABASE_URL); assert.equal(url.pathname, '/auth/v1/user'); assert.equal(options.method, 'GET');
    const id = options.headers.Authorization === 'Bearer test-A' ? USER_A : options.headers.Authorization === 'Bearer test-B' ? USER_B : null;
    return Response.json(id ? {id, app_metadata: {pplus_role: 'admin'}, user_metadata: {user_id: USER_A}} : {message: 'PRIVATE_AUTH'}, {status: id ? 200 : 401});
  };
  const notionFetch = async (address, options) => {
    const url = new URL(address); notionCalls.push(url.pathname);
    assert.equal(url.origin, 'https://api.notion.com'); assert.ok(['/v1/users/me', `/v1/pages/${PARENT}`].includes(url.pathname));
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store'); assert.equal(options.body, undefined);
    assert.equal(options.headers['Notion-Version'], '2026-03-11'); assert.equal(options.headers.Authorization, `Bearer ${ENV.PPLUS_NOTION_TEST_TOKEN}`);
    return Response.json(status === 200 ? (url.pathname.endsWith('/me') ? self : target) : {message: 'PRIVATE_UPSTREAM', token: ENV.PPLUS_NOTION_TEST_TOKEN}, {status});
  };
  const handler = target => createTestConnectionHandler({target, env, authFetch, notionFetch, allowNotionNetwork: enabled});
  return {authCalls, notionCalls, handler, authFetch, notionFetch};
}
function request(target = false, {token = 'test-A', body = {}, headers = {}, query = '', method} = {}) {
  method ??= target ? 'POST' : 'GET';
  return new Request(`http://127.0.0.1:8796${target ? TARGET_PATH : CONNECTION_PATH}${query}`, {method,
    headers: {...(token ? {Authorization: `Bearer ${token}`} : {}), ...(target ? {'Content-Type': 'application/json'} : {}), ...headers},
    ...(!['GET', 'HEAD'].includes(method) ? {body: typeof body === 'string' ? body : JSON.stringify(body)} : {})});
}
async function result(response, status, code) {
  assert.equal(response.status, status); const body = await response.json(); if (code) assert.equal(body.error.code, code);
  assert.equal(body.webExecutionReady, false); assert.equal(body.notionExecution, 'not_executed'); assert.equal(body.notionWrites, 0); assert.equal(body.supabaseWrites, 0);
  assert.equal(body.creationPermissionVerified, false); assert.equal(body.privacyVerified, false); assert.equal(body.targetVerified, false);
  assert.match(response.headers.get('Cache-Control'), /private, no-store/); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_|ntn_SYNTHETIC|Bearer|SUPABASE_|PPLUS_NOTION_/);
  return body;
}

test('NB013: configured owner status is local-only; target read verifies only fixed identity and safe metadata', async () => {
  const m = mock(); const status = await result(await m.handler(false)(request()), 200);
  assert.equal(status.connectionStatus, 'configured'); assert.equal(status.targetReadVerified, false); assert.equal(m.notionCalls.length, 0);
  const b = await result(await m.handler(true)(request(true)), 200);
  assert.equal(b.connectionStatus, 'read_verified'); assert.equal(b.targetReadVerified, true); assert.equal(b.target.lockStatus, 'unlocked');
  assert.equal(b.notionRequests, 2); assert.deepEqual(m.notionCalls, ['/v1/users/me', `/v1/pages/${PARENT}`]);
  assert.equal(b.target.parentPageId, PARENT); assert.match(b.target.pageUrl, /^https:\/\/www.notion.so\/[a-f0-9]{32}$/);
});
test('NB013: default factory never contacts Notion even with complete configuration and an injected adapter', async () => {
  const m = mock();
  for (const target of [false, true]) {
    const handler = createTestConnectionHandler({target, env: ENV, authFetch: m.authFetch, notionFetch: m.notionFetch});
    const b = await result(await handler(request(target)), target ? 503 : 200, target ? 'notion_remote_read_disabled' : undefined);
    assert.equal(b.remoteReadEnabled, false); assert.equal(b.notionRequests, 0);
  }
  assert.equal(m.notionCalls.length, 0);
});
test('NB013: enable flag without an adapter is still closed; reader exposes no general request or write methods', async () => {
  const m = mock(), handler = createTestConnectionHandler({target: true, env: ENV, authFetch: m.authFetch, allowNotionNetwork: true});
  await result(await handler(request(true)), 503, 'notion_remote_read_disabled');
  const reader = createTestNotionReader({configuration: readTestConfiguration(ENV, USER_A)});
  assert.deepEqual(Object.keys(reader).sort(), ['requestCount', 'reviewTarget']);
  await assert.rejects(reader.reviewTarget(), e => e.code === 'notion_remote_read_disabled'); assert.equal(reader.requestCount, 0);
});
test('NB013: admin role and spoofed metadata never allow user B or expose config/target', async () => {
  let credentialReads = 0;
  const env = {...ENV}; Object.defineProperty(env, 'PPLUS_NOTION_TEST_TOKEN', {get() {credentialReads++; throw new Error('PRIVATE_CREDENTIAL');}});
  const m = mock({env});
  for (const target of [false, true]) {
    const b = await result(await m.handler(target)(request(target, {token: 'test-B'})), 403, 'test_user_not_allowed');
    assert.doesNotMatch(JSON.stringify(b), new RegExp(`${WORKSPACE}|${BOT}|${PARENT}`));
  }
  assert.equal(credentialReads, 0); assert.equal(m.notionCalls.length, 0);
});
for (const key of ['PPLUS_NOTION_TEST_USER_ID', 'PPLUS_NOTION_TEST_WORKSPACE_ID', 'PPLUS_NOTION_TEST_BOT_ID', 'PPLUS_NOTION_TEST_PARENT_PAGE_ID', 'PPLUS_NOTION_TEST_SCOPE', 'PPLUS_NOTION_TEST_TOKEN']) test(`NB013: missing ${key} fails before Notion request`, async () => {
  const env = {...ENV}; delete env[key]; const m = mock({env});
  await result(await m.handler(true)(request(true)), 503, 'test_connection_not_configured'); assert.equal(m.notionCalls.length, 0);
});
test('NB013: malformed IDs/scope/credential and legacy CLI names cannot activate the connection', () => {
  for (const [key, value] of [['PPLUS_NOTION_TEST_USER_ID', 'not-uuid'], ['PPLUS_NOTION_TEST_WORKSPACE_ID', 'https://notion.so/x'],
    ['PPLUS_NOTION_TEST_PARENT_PAGE_ID', '../people'], ['PPLUS_NOTION_TEST_SCOPE', 'company'], ['PPLUS_NOTION_TEST_TOKEN', 'unsafe\nheader']]) {
    assert.throws(() => readTestConfiguration({...ENV, [key]: value}, USER_A), e => e.code === 'test_connection_not_configured');
  }
  assert.throws(() => readTestConfiguration({NOTION_API_TOKEN: 'SYNTHETIC', NOTION_TEST_PARENT_PAGE_ID: PARENT}, USER_A));
  assert.equal(notionId(WORKSPACE.toUpperCase().replaceAll('-', '')), WORKSPACE); assert.equal(notionId('0'.repeat(32)), null);
});
for (const [kind, code, calls] of [['bot', 'notion_bot_mismatch', 1], ['workspace', 'notion_workspace_mismatch', 1], ['parent', 'notion_parent_mismatch', 2], ['person', 'notion_bot_mismatch', 1]]) test(`NB013: ${kind} identity mismatch stops subsequent reads`, async () => {
  const self = bot(), target = page();
  if (kind === 'bot') self.id = USER_B;
  if (kind === 'workspace') self.bot.workspace_id = USER_B;
  if (kind === 'parent') target.id = USER_B;
  if (kind === 'person') self.type = 'person';
  const m = mock({self, target}); await result(await m.handler(true)(request(true)), 403, code); assert.equal(m.notionCalls.length, calls);
});
for (const [field, code, status] of [['archived', 'notion_target_archived', 410], ['in_trash', 'notion_target_in_trash', 410], ['is_locked', 'notion_target_locked', 423]]) test(`NB013: ${field} target is rejected without mutation`, async () => {
  const target = {...page(), [field]: true}, m = mock({target}); await result(await m.handler(true)(request(true)), status, code); assert.equal(m.notionCalls.length, 2);
});
test('NB013: absent lock state stays unknown; partial status or public page cannot pass as private target', async () => {
  const target = page(); delete target.is_locked; const m = mock({target});
  const b = await result(await m.handler(true)(request(true)), 200); assert.equal(b.target.lockStatus, 'unknown'); assert.ok(b.limitations.some(s => /잠금/.test(s)));
  for (const altered of [{...page(), in_trash: undefined}, {...page(), is_locked: 'false'}, {...page(), public_url: 'https://private.invalid'}, {...page(), parent: {type: 'data_source_id', data_source_id: BOT}}]) {
    const n = mock({target: altered}); const response = await n.handler(true)(request(true)); assert.notEqual(response.status, 200);
    assert.doesNotMatch(await response.text(), /private.invalid/);
  }
});
for (const [upstreamStatus, httpStatus, code] of [[401,502,'notion_unauthorized'],[403,403,'notion_access_denied'],[404,404,'notion_target_not_found'],[429,429,'notion_rate_limited'],[500,502,'notion_unavailable'],[503,502,'notion_unavailable'],[302,502,'notion_unavailable']]) test(`NB013: Notion ${upstreamStatus} is safe, distinguishable and never retried`, async () => {
  const m = mock({status: upstreamStatus}); const b = await result(await m.handler(true)(request(true)), httpStatus, code);
  assert.equal(m.notionCalls.length, 1); assert.equal(b.notionRequests, 1);
});
test('NB013: malformed/oversized JSON, network exceptions and abort are sanitized', async () => {
  const m = mock();
  for (const fetchImpl of [async () => new Response('not-json'), async () => new Response(' '.repeat(131073)), async () => {throw new Error('PRIVATE_EXCEPTION');}]) {
    const handler = createTestConnectionHandler({target: true, env: ENV, authFetch: m.authFetch, notionFetch: fetchImpl, allowNotionNetwork: true});
    const response = await handler(request(true)); assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /PRIVATE_EXCEPTION/);
  }
  const abort = new AbortController(); abort.abort();
  const reader = createTestNotionReader({configuration: readTestConfiguration(ENV, USER_A), signal: abort.signal, allowNetwork: true, fetchImpl: async (_url, options) => {options.signal.throwIfAborted();}});
  await assert.rejects(reader.reviewTarget(), e => e.code === 'notion_timeout');
});
for (const field of ['pageId', 'parentPageId', 'url', 'path', 'method', 'user_id', 'token', 'configuration', 'approved']) test(`NB013: body injection ${field} is rejected before Auth/Notion`, async () => {
  const m = mock(); await result(await m.handler(true)(request(true, {body: {[field]: 'https://attacker.invalid'}})), 400, 'invalid_test_request');
  assert.equal(m.authCalls.length, 0); assert.equal(m.notionCalls.length, 0);
});
test('NB013: query/body/content-type/method/origin/bearer boundaries', async () => {
  const m = mock();
  for (const target of [false,true]) {
    await result(await m.handler(target)(request(target, {token: null})), 401, 'auth_required');
    await result(await m.handler(target)(request(target, {token: 'bad'})), 401, 'invalid_session');
    await result(await m.handler(target)(request(target, {query: '?pageId='+PARENT})), 400, 'invalid_test_request');
    await result(await m.handler(target)(request(target, {headers: {Origin: 'https://other.invalid'}})), 403, 'origin_not_allowed');
    await result(await m.handler(target)(request(target, {headers: {'sec-fetch-site': 'cross-site'}})), 403, 'origin_not_allowed');
    await result(await m.handler(target)(request(target, {method: 'DELETE'})), 405, 'method_not_allowed');
  }
  await result(await m.handler(true)(request(true, {body: '[]'})), 400, 'invalid_test_request');
  await result(await m.handler(true)(request(true, {body: 'no'})), 400, 'invalid_json');
  await result(await m.handler(true)(request(true, {body: ' '.repeat(257)})), 413, 'body_too_large');
  await result(await m.handler(true)(request(true, {headers: {'Content-Type': 'text/plain'}})), 415, 'json_required');
  await result(await m.handler(false)(request(false, {headers: {'Transfer-Encoding': 'chunked'}})), 400, 'invalid_test_request');
  assert.equal(m.notionCalls.length, 0);
});

function uiFixture() {
  let user = USER_A, release, deferred = false;
  const promise = new Promise(r => {release = r;}), states = [], calls = [];
  const drafts = createWorkspace({storage: storage(), userId: USER_A});
  drafts.open({id: PARENT, updatedAt: '2026-11-02T00:00:00.123456Z', configuration: emptyConfiguration()});
  const getSession = async () => ({data: {session: user ? {user: {id: user}, access_token: 'SYNTHETIC_UI'} : null}});
  const fetchImpl = async (path, options) => {calls.push({path, options}); if (deferred) await promise; return Response.json({connectionStatus: 'configured', remoteReadEnabled: false, targetReadVerified: false,
    webExecutionReady: false, notionExecution: 'not_executed', notionWrites: 0, supabaseWrites: 0, creationPermissionVerified: false, privacyVerified: false});};
  const controller = createConnectionController({getSession, fetchImpl, drafts, onChange: s => states.push(s)});
  return {controller, getSession, fetchImpl, states, calls, drafts, hold() {deferred = true;}, release, switch(id) {user = id;}};
}
test('NB013 UI: explicit status GET sends no config or target; configured is not connected', async () => {
  const f = uiFixture(); assert.equal(f.calls.length, 0); await f.controller.check();
  assert.equal(f.states.at(-1).status, 'configured'); assert.equal(f.states.at(-1).remoteReadEnabled, false);
  assert.equal(f.calls[0].options.method, 'GET'); assert.equal(f.calls[0].options.body, undefined); f.controller.dispose();
});
for (const mode of ['account', 'logout', 'draft']) test(`NB013 UI: delayed ${mode} result is removed`, async () => {
  const f = uiFixture(); f.hold(); const task = f.controller.check(); while (!f.calls.length) await Promise.resolve();
  if (mode === 'account') f.switch(USER_B);
  if (mode === 'logout') f.controller.dispose();
  if (mode === 'draft') f.drafts.reset();
  f.release(); await task; assert.ok(!f.states.some(s => s.status === 'configured')); f.controller.dispose();
});
test('NB013 UI: not-configured/denied/upstream failures never echo upstream text', async () => {
  for (const code of ['test_connection_not_configured', 'test_user_not_allowed', 'notion_unauthorized', 'notion_remote_read_disabled', 'notion_rate_limited']) {
    const f = uiFixture(), states = [];
    const c = createConnectionController({getSession: f.getSession, onChange: s => states.push(s), fetchImpl: async () => Response.json({error: {code, message: 'PRIVATE_RESPONSE'}}, {status: 503})});
    await c.check(); assert.equal(states.at(-1).status, 'failed'); assert.doesNotMatch(states.at(-1).message, /PRIVATE_RESPONSE/); c.dispose(); f.controller.dispose();
  }
});
test('NB013 UI: target POST sends empty object; missing lock remains explicitly unverified and does not become execution approval', async () => {
  const f = uiFixture(), states = [], calls = [];
  const c = createConnectionController({getSession: f.getSession, onChange: s => states.push(s), fetchImpl: async (path, options) => {
    calls.push({path, options}); return Response.json({connectionStatus: 'read_verified', targetReadVerified: true, webExecutionReady: false, notionExecution: 'not_executed', notionWrites: 0, supabaseWrites: 0,
      creationPermissionVerified: false, privacyVerified: false, target: {lockStatus: 'unknown', creationPermissionVerified: false, privacyVerified: false}});
  }});
  await c.check(true); assert.equal(calls[0].options.body, '{}'); assert.equal(calls[0].options.method, 'POST'); assert.equal(states.at(-1).lockStatus, 'unknown');
  c.dispose(); f.controller.dispose();
});
test('NB013 UI: rendered controls are minimal and auth-cleared removes status', async () => {
  const f = uiFixture(), events = {}, root = new Element('section');
  const win = {addEventListener: (k, fn) => {events[k] = fn;}, removeEventListener: k => {delete events[k];}};
  const c = mountTestConnection({root, getSession: f.getSession, fetchImpl: f.fetchImpl, drafts: f.drafts, doc: {createElement: tag => new Element(tag)}, win});
  assert.match(root.textContent, /연결 상태 미확인/); await c.check(); assert.match(root.textContent, /서버 연결 설정 준비됨/);
  assert.equal(root.querySelectorAll('button')[1].hidden, true); assert.doesNotMatch(root.textContent, /SYNTHETIC|OAuth|생성 실행/);
  events['est-auth-cleared'](); assert.equal(root.textContent, ''); f.controller.dispose();
});
test('NB013: local HTTP and public allowlist exclude all connection configuration/adapter files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nb013-public-')); t.after(() => rm(root, {recursive: true, force: true}));
  const repository = fileURLToPath(new URL('../../../', import.meta.url));
  for (const file of PUBLIC_FILES) {await mkdir(dirname(join(root, file)), {recursive:true}); await copyFile(join(repository,file),join(root,file));}
  const built = await buildStatic(root); assert.equal(built.count, 32); assert.ok(PUBLIC_FILES.includes('js/notion-test-connection.mjs'));
  const m = mock({enabled:false}), server = await startReviewServer({port:0, publicRoot:join(root,'public-dist'),testConnectionHandler:m.handler(false),testTargetHandler:m.handler(true)});
  t.after(() => new Promise(resolve => {server.closeAllConnections();server.close(resolve);})); const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+CONNECTION_PATH)).status,401); assert.equal((await fetch(base+TARGET_PATH)).status,405);
  const response = await fetch(base+CONNECTION_PATH,{headers:{Authorization:'Bearer test-A'}}); assert.equal(response.status,200);
  for(const path of ['/server/notion/test-configuration.mjs','/server/notion/test-readonly.mjs','/api/notion/test-connection.mjs','/.env','/docs/research/NB-V2-013_REPORT.md']) assert.equal((await fetch(base+path)).status,404);
  const browser = await(await fetch(base+'/js/notion-test-connection.mjs')).text(); assert.doesNotMatch(browser,/PPLUS_NOTION_TEST_TOKEN|api.notion.com|NOTION_API_TOKEN/);
  assert.equal(m.notionCalls.length,0);
});
