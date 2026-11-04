import {ReviewError, readLimited, reject} from '../review-errors.mjs';
import {UUID, readConfiguration, createReadonlySupabase} from '../supabase-readonly.mjs';
import {readVerifiedOwnedDraft, OWNERSHIP_VERIFICATION} from '../draft-ownership.mjs';
import {timestamp, reviewSavedDraft, assertCurrentSnapshot} from '../review-plan.mjs';
import {compilePreview, PREVIEW_FLAGS, ADAPTER_VERSION, EXECUTION_PLAN_VERSION} from './preview-plan.mjs';

export const MAX_REQUEST_BYTES = 2048;
function response(status, body, headers = {}) {
  return Response.json({reviewVersion: 1, executionPlanVersion: EXECUTION_PLAN_VERSION, adapterVersion: ADAPTER_VERSION, ...body, ...PREVIEW_FLAGS}, {
    status, headers: {'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
      Vary: 'Authorization, Origin', 'X-Content-Type-Options': 'nosniff', ...headers}
  });
}
function checkOrigin(request, env) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') reject(403, 'origin_not_allowed');
  const origin = request.headers.get('origin');
  if (!origin) return;
  const url = new URL(request.url);
  const allowed = (env.REVIEW_ALLOWED_ORIGINS ?? 'https://pplus-rouge.vercel.app').split(',').map(v => v.trim());
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) allowed.push(url.origin);
  if (origin !== url.origin || !allowed.includes(origin)) reject(403, 'origin_not_allowed');
}
async function parseBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) reject(415, 'json_required');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) reject(413, 'body_too_large');
  let value;
  try { value = JSON.parse(await readLimited(request.body, MAX_REQUEST_BYTES, AbortSignal.any([request.signal, AbortSignal.timeout(5000)]))); }
  catch (error) { if (error instanceof ReviewError) throw error; reject(400, 'invalid_json'); }
  const fields = ['draftId', 'expectedUpdatedAt', 'expectedPlanHash'];
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length !== fields.length || fields.some(k => !Object.hasOwn(value, k))) reject(400, 'invalid_request');
  if (typeof value.draftId !== 'string' || !UUID.test(value.draftId)) reject(400, 'invalid_draft_id');
  if (timestamp(value.expectedUpdatedAt) === null || typeof value.expectedPlanHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.expectedPlanHash)) reject(400, 'invalid_snapshot');
  return {...value, draftId: value.draftId.toLowerCase()};
}
export function createNotionPreviewHandler({env = process.env, fetchImpl = fetch} = {}) {
  return async request => {
    try {
      if (new URL(request.url).pathname !== '/api/notion/plans/review') reject(404, 'route_not_found');
      if (request.method !== 'POST') return response(405, {error: {code: 'method_not_allowed', message: 'POST 요청을 사용해 주세요.'}}, {Allow: 'POST'});
      checkOrigin(request, env);
      const input = await parseBody(request);
      const bearer = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization') ?? '');
      if (!bearer) reject(401, 'auth_required');
      const client = createReadonlySupabase({configuration: readConfiguration(env), token: bearer[1], fetchImpl, signal: request.signal});
      const row = await readVerifiedOwnedDraft(client, input.draftId, request.signal);
      if (timestamp(row.updated_at) === null) reject(502, 'invalid_upstream_response');
      const review = reviewSavedDraft(row);
      if (!review.planValidation.valid) reject(422, 'invalid_saved_plan');
      if (assertCurrentSnapshot(input, review).length) reject(409, 'saved_draft_changed');
      return response(200, {...compilePreview(row), ...OWNERSHIP_VERIFICATION});
    } catch (error) {
      const known = error instanceof ReviewError;
      return response(known ? error.status : 500, {error: {code: known ? error.code : 'internal_error',
        message: known && error.code === 'saved_draft_changed' ? '저장본이 변경됐습니다. 최신 설계를 다시 열고 검토해 주세요.' : '요청과 로그인·저장 상태를 확인한 뒤 다시 시도해 주세요.'}});
    }
  };
}
