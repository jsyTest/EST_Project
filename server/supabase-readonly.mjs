import {readLimited, reject, ReviewError} from './review-errors.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readConfiguration(env) {
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch { reject(503, 'server_not_configured'); }
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  // This feature deliberately cannot run with a service_role/Secret/legacy JWT key.
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) reject(503, 'server_not_configured');
  return {origin: url.origin, key};
}

export function createReadonlySupabase({configuration, token, fetchImpl = fetch, signal}) {
  // Per-request closure. Never keep the user's token in a shared client/session.
  const {origin, key} = configuration;
  async function get(path, stage) {
    const abort = AbortSignal.any([signal, AbortSignal.timeout(8000)].filter(Boolean));
    try {
      const response = await fetchImpl(new URL(path, origin), {
        method: 'GET', redirect: 'error', cache: 'no-store', signal: abort,
        headers: {apikey: key, Authorization: `Bearer ${token}`, Accept: 'application/json'}
      });
      if (response.status === 401 || (stage === 'auth' && response.status === 403)) reject(401, 'invalid_session');
      if (response.status === 403) reject(403, 'draft_access_denied');
      if (response.status === 429) reject(429, 'upstream_rate_limited');
      if (!response.ok) reject(502, stage === 'auth' ? 'auth_unavailable' : 'draft_store_unavailable');
      const body = await readLimited(response.body, 1048576, abort);
      try { return JSON.parse(body); } catch { reject(502, 'invalid_upstream_response'); }
    } catch (error) {
      if (error instanceof ReviewError && error.code !== 'body_too_large') throw error;
      if (abort.aborted) reject(504, 'upstream_timeout');
      reject(502, 'upstream_unavailable');
    }
  }
  async function verifiedUser() {
    const user = await get('/auth/v1/user', 'auth');
    if (!UUID.test(user?.id ?? '') || user.is_anonymous === true) reject(401, 'invalid_session');
    return user;
  }
  return {
    // Same Auth /user request used by auth-js getUser(jwt); never decode-and-trust a JWT.
    async getUser() {
      const user = await verifiedUser();
      return {id: user.id.toLowerCase()};
    },
    async getAdminIdentity() {
      const user = await verifiedUser();
      return {id: user.id.toLowerCase(), email: typeof user.email === 'string' ? user.email : '',
        role: user.app_metadata?.pplus_role === 'admin' ? 'admin' : 'user'};
    },
    async getDraft(draftId, userId) {
      const query = new URLSearchParams({
        select: 'id,user_id,configuration,schema_version,updated_at',
        id: `eq.${draftId}`, user_id: `eq.${userId}`, limit: '1'
      });
      const rows = await get(`/rest/v1/education_drafts?${query}`, 'draft');
      if (!Array.isArray(rows) || rows.length > 1) reject(502, 'invalid_upstream_response');
      const row = rows[0];
      // Defense in depth in addition to JWT + Data API RLS + the explicit filter.
      if (!row || typeof row.id !== 'string' || typeof row.user_id !== 'string' ||
          row.id.toLowerCase() !== draftId || row.user_id.toLowerCase() !== userId) reject(404, 'draft_not_found');
      return row;
    }
  };
}
