import {ReviewError, reject} from './review-errors.mjs';
import {readConfiguration, createReadonlySupabase} from './supabase-readonly.mjs';

export function createAdminHandler({env = process.env, fetchImpl = fetch} = {}) {
  return async function adminOverview(request) {
    const json = (status, body, headers = {}) => Response.json(body, {status, headers: {
      'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store', Vary: 'Authorization, Origin', 'X-Content-Type-Options': 'nosniff', ...headers
    }});
    try {
      if (new URL(request.url).pathname !== '/api/admin/overview') reject(404, 'route_not_found');
      if (request.method !== 'GET') return json(405, {error: {code: 'method_not_allowed', message: '이 요청은 사용할 수 없습니다.'}}, {Allow: 'GET'});
      const origin = request.headers.get('origin'), url = new URL(request.url);
      const allowed = (env.REVIEW_ALLOWED_ORIGINS ?? 'https://pplus-rouge.vercel.app').split(',').map(v => v.trim());
      if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) allowed.push(url.origin);
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && (origin !== url.origin || !allowed.includes(origin)))) reject(403, 'origin_not_allowed');
      const bearer = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization') ?? '');
      if (!bearer) reject(401, 'auth_required');
      if (url.search) reject(400, 'invalid_request');
      const client = createReadonlySupabase({configuration: readConfiguration(env), token: bearer[1], fetchImpl, signal: request.signal});
      const viewer = await client.getAdminIdentity();
      if (viewer.role !== 'admin') reject(403, 'admin_required');
      // No privileged users/list or cross-owner table reads. Null means not connected.
      return json(200, {viewer, statistics: {members: null, educationDrafts: null}, members: [],
        connections: {memberDirectory: false, draftStatistics: false, errorHistory: false, generationHistory: false},
        capabilities: {changeRoles: false, deleteAccounts: false, notionWebGeneration: false},
        service: {adminPermission: 'verified', notionWebGeneration: 'not_implemented', notionCLI: 'separate_local_tool'}});
    } catch (error) {
      const status = error instanceof ReviewError ? error.status : 500;
      const code = error instanceof ReviewError ? error.code : 'internal_error';
      return json(status, {error: {code, message: status === 401 ? '로그인한 뒤 다시 이용해 주세요.' : status === 403 ? '이 페이지에 접근할 권한이 없습니다.' : '권한을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'}});
    }
  };
}
