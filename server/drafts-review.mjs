import {ReviewError, readLimited, reject} from './review-errors.mjs';
import {UUID, readConfiguration, createReadonlySupabase} from './supabase-readonly.mjs';
import {REVIEW_VERSION, EXECUTION_FLAGS, timestamp, reviewSavedDraft, assertCurrentSnapshot} from './review-plan.mjs';

export const MAX_REQUEST_BYTES = 2048;
const MESSAGES = {
  auth_required: '로그인한 뒤 다시 시도해 주세요.', invalid_session: '로그인 상태를 확인할 수 없습니다. 다시 로그인해 주세요.',
  draft_not_found: '이 설계를 열 수 없습니다.', draft_access_denied: '설계 저장소에 접근할 권한이 없습니다.',
  saved_draft_changed: '저장본이 변경됐습니다. 최신 설계를 열고 다시 확인해 주세요.',
  server_not_configured: '서버 연결 설정이 준비되지 않았습니다.', internal_error: '서버 검사를 완료하지 못했습니다.'
};
function response(status, body, extraHeaders = {}) {
  return Response.json({reviewVersion: REVIEW_VERSION, mode: 'server-dry-run', ...EXECUTION_FLAGS, ...body}, {
    status, headers: {'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store', Vary: 'Authorization, Origin', 'X-Content-Type-Options': 'nosniff', ...extraHeaders}
  });
}
function checkOrigin(request, env) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') reject(403, 'origin_not_allowed');
  const supplied = request.headers.get('origin');
  if (!supplied) return; // Non-browser clients still require a verified Bearer token.
  const url = new URL(request.url);
  const allowed = (env.REVIEW_ALLOWED_ORIGINS ?? 'https://pplus-rouge.vercel.app').split(',').map(v => v.trim());
  if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) allowed.push(url.origin);
  if (supplied !== url.origin || !allowed.includes(supplied)) reject(403, 'origin_not_allowed');
}
async function inputBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) reject(415, 'json_required');
  const size = request.headers.get('content-length');
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > MAX_REQUEST_BYTES)) reject(413, 'body_too_large');
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  let value;
  try { value = JSON.parse(await readLimited(request.body, MAX_REQUEST_BYTES, signal)); }
  catch (error) { if (error instanceof ReviewError) throw error; reject(400, 'invalid_json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['draftId', 'expectedUpdatedAt', 'expectedPlanHash'].includes(k))) reject(400, 'invalid_request');
  if (typeof value.draftId !== 'string' || !UUID.test(value.draftId)) reject(400, 'invalid_draft_id');
  if (value.expectedUpdatedAt !== undefined && timestamp(value.expectedUpdatedAt) === null) reject(400, 'invalid_snapshot');
  if (value.expectedPlanHash !== undefined && (typeof value.expectedPlanHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.expectedPlanHash))) reject(400, 'invalid_snapshot');
  return {...value, draftId: value.draftId.toLowerCase()};
}

export function createReviewHandler({fetchImpl = fetch, env = process.env} = {}) {
  return async function review(request) {
    try {
      if (new URL(request.url).pathname !== '/api/drafts/review') reject(404, 'route_not_found');
      if (request.method !== 'POST') return response(405, {error: {code: 'method_not_allowed', message: 'POST 요청을 사용해 주세요.'}}, {Allow: 'POST'});
      checkOrigin(request, env);
      const match = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization') ?? '');
      if (!match) reject(401, 'auth_required');
      const input = await inputBody(request);
      const client = createReadonlySupabase({configuration: readConfiguration(env), token: match[1], fetchImpl, signal: request.signal});
      const user = await client.getUser();
      const row = await client.getDraft(input.draftId, user.id);
      if (timestamp(row.updated_at) === null) reject(502, 'invalid_upstream_response');
      const result = reviewSavedDraft(row);
      const changed = assertCurrentSnapshot(input, result);
      if (changed.length) return response(409, {error: {code: 'saved_draft_changed', message: MESSAGES.saved_draft_changed},
        reviewStatus: 'stale', changed, draftId: result.draftId, updatedAt: result.updatedAt, planHash: result.planHash});
      return response(result.planValidation.status === 'structural_error' ? 422 : 200, result);
    } catch (error) {
      const known = error instanceof ReviewError;
      const code = known ? error.code : 'internal_error';
      return response(known ? error.status : 500, {reviewStatus: 'request_rejected', error: {code,
        message: MESSAGES[code] ?? '요청 또는 서버 연결 상태를 확인한 뒤 다시 시도해 주세요.'}});
    }
  };
}
