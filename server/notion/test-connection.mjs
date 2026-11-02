import {createReadonlySupabase, readConfiguration} from '../supabase-readonly.mjs';
import {readLimited, reject, ReviewError} from '../review-errors.mjs';
import {readTestConfiguration} from './test-configuration.mjs';
import {createTestNotionReader} from './test-readonly.mjs';
import {NOTION_VERSION} from '../../js/planner/catalog.mjs';

export const CONNECTION_PATH = '/api/notion/test-connection';
export const TARGET_PATH = '/api/notion/test-target/review';
export const MAX_CONNECTION_REQUEST_BYTES = 256;
const flags = {webExecutionReady: false, notionExecution: 'not_executed', notionWrites: 0, supabaseWrites: 0,
  targetVerified: false, creationPermissionVerified: false, privacyVerified: false};
const messages = {
  test_connection_not_configured: '개인 Notion 연결 미설정', test_user_not_allowed: '테스트 연결 사용 대상이 아닙니다.',
  notion_remote_read_disabled: '서버 연결 설정은 준비됐지만 원격 읽기 검증은 아직 비활성화되어 있습니다.',
  auth_required: '로그인한 뒤 연결 상태를 확인해 주세요.', invalid_session: '다시 로그인한 뒤 확인해 주세요.',
  notion_unauthorized: 'Notion이 연결 자격 증명을 거절했습니다.', notion_access_denied: 'Notion 읽기 접근이 거절됐습니다.',
  notion_target_not_found: '승인된 테스트 페이지를 찾을 수 없거나 연결에 공유되지 않았습니다.',
  notion_rate_limited: 'Notion 요청 한도에 도달했습니다. 잠시 후 직접 다시 확인해 주세요.'
};
function respond(status, value, notionRequests, headers = {}) {
  return Response.json({connectionVersion: 1, notionApiVersion: NOTION_VERSION, ...value, ...flags, notionRequests}, {
    status, headers: {'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
      Vary: 'Authorization, Origin', 'X-Content-Type-Options': 'nosniff', ...headers}
  });
}
function originCheck(request, env) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') reject(403, 'origin_not_allowed');
  const origin = request.headers.get('origin'); if (!origin) return;
  const url = new URL(request.url), allowed = (env.REVIEW_ALLOWED_ORIGINS ?? 'https://pplus-rouge.vercel.app').split(',').map(s => s.trim());
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) allowed.push(url.origin);
  if (origin !== url.origin || !allowed.includes(origin)) reject(403, 'origin_not_allowed');
}
async function checkInput(request, target) {
  const url = new URL(request.url); if (url.search) reject(400, 'invalid_test_request');
  const size = request.headers.get('content-length');
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > MAX_CONNECTION_REQUEST_BYTES)) reject(413, 'body_too_large');
  if (!target) {
    if (request.body || request.headers.has('transfer-encoding') || (size !== null && Number(size) !== 0)) reject(400, 'invalid_test_request');
    return;
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) reject(415, 'json_required');
  let body;
  try { body = JSON.parse(await readLimited(request.body, MAX_CONNECTION_REQUEST_BYTES, AbortSignal.any([request.signal, AbortSignal.timeout(5000)]))); }
  catch (error) { if (error instanceof ReviewError) throw error; reject(400, 'invalid_json'); }
  // Target is fixed on the server. No page ID, URL, path, user, draft or credential input.
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length) reject(400, 'invalid_test_request');
}
export function createTestConnectionHandler({target = false, env = process.env, authFetch = fetch, notionFetch, allowNotionNetwork = false} = {}) {
  return async request => {
    let reader;
    try {
      if (new URL(request.url).pathname !== (target ? TARGET_PATH : CONNECTION_PATH)) reject(404, 'route_not_found');
      const method = target ? 'POST' : 'GET';
      if (request.method !== method) return respond(405, {error: {code: 'method_not_allowed', message: `${method} 요청을 사용해 주세요.`}}, 0, {Allow: method});
      originCheck(request, env); await checkInput(request, target);
      const bearer = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization') ?? '');
      if (!bearer) reject(401, 'auth_required');
      const client = createReadonlySupabase({configuration: readConfiguration(env), token: bearer[1], fetchImpl: authFetch, signal: request.signal});
      const user = await client.getUser();
      const configuration = readTestConfiguration(env, user.id);
      // The entrypoints never opt in. Tests inject synthetic adapters; future live opt-in needs separate approval.
      const remoteReadEnabled = allowNotionNetwork === true && typeof notionFetch === 'function';
      if (!target) return respond(200, {connectionStatus: 'configured', configured: true, remoteReadEnabled, targetReadVerified: false}, 0);
      reader = createTestNotionReader({configuration, fetchImpl: notionFetch, allowNetwork: remoteReadEnabled, signal: request.signal});
      const result = await reader.reviewTarget();
      return respond(200, {connectionStatus: 'read_verified', configured: true, remoteReadEnabled, targetReadVerified: true, target: result,
        limitations: ['읽기 성공은 생성 권한의 증명이 아닙니다.', '비공개 전체 공유 권한은 사용자가 별도로 확인해야 합니다.',
          ...(result.lockStatus === 'unknown' ? ['잠금 상태는 응답에서 확인할 수 없습니다.'] : [])]}, reader.requestCount);
    } catch (error) {
      const known = error instanceof ReviewError, code = known ? error.code : 'internal_error';
      return respond(known ? error.status : 500, {connectionStatus: code === 'test_connection_not_configured' ? 'not_configured' :
        code === 'test_user_not_allowed' ? 'not_eligible' : code === 'notion_remote_read_disabled' ? 'configured' : 'failed',
        targetReadVerified: false, remoteReadEnabled: false,
        error: {code, message: messages[code] ?? '연결 확인에 실패했습니다. 설정과 승인된 대상 정보를 확인해 주세요.'}}, reader?.requestCount ?? 0);
    }
  };
}
