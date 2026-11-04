import {createReadonlySupabase, readConfiguration, UUID} from '../supabase-readonly.mjs';
import {reject} from '../review-errors.mjs';
import {TEST_ENV_NAMES} from './test-configuration.mjs';

// Request-local only. No decoded JWT, role, email, user_metadata or supplied user_id.
export async function authenticateTestUser({request, env, fetchImpl}) {
  const bearer = /^Bearer ([A-Za-z0-9._~-]{1,8192})$/i.exec(request.headers.get('authorization') ?? '');
  if (!bearer) reject(401, 'auth_required');
  if (request.signal.aborted) reject(401, 'invalid_session');
  if (typeof fetchImpl !== 'function') reject(503, 'auth_unavailable');
  const client = createReadonlySupabase({configuration: readConfiguration(env), token: bearer[1], fetchImpl, signal: request.signal});
  let user;
  try {user = await client.getUser();} catch (error) {
    if (request.signal.aborted) reject(401, 'invalid_session');
    throw error;
  }
  // Some test adapters ignore abort. Never allow a cancelled auth result to reach credentials.
  if (request.signal.aborted) reject(401, 'invalid_session');
  const allowed = env[TEST_ENV_NAMES.user];
  if (typeof allowed !== 'string' || !UUID.test(allowed) || /^0+$/.test(allowed.replaceAll('-', ''))) reject(503, 'test_connection_not_configured');
  if (user.id !== allowed.toLowerCase()) reject(403, 'test_user_not_allowed');
  return Object.freeze({id: user.id});
}
