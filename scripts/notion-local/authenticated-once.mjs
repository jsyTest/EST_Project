import {authenticateTestUser} from '../../server/notion/test-auth.mjs';
import {TARGET_PATH, originCheck, checkInput, respond} from '../../server/notion/test-connection.mjs';
import {TEST_ENV_NAMES, notionId} from '../../server/notion/test-configuration.mjs';
import {reject, ReviewError} from '../../server/review-errors.mjs';
import {LOCAL_READ_POLICY} from './approval.mjs';
import {runMockOnce, MOCK_ENV} from './once.mjs';

const targetKeys = ['userId','workspaceId','botId','parentId','scope','policy'];
function checkApprovedTarget(approved, env, user) {
  if (!approved || typeof approved !== 'object' || Array.isArray(approved) ||
      Object.keys(approved).length !== targetKeys.length || targetKeys.some(k => !Object.hasOwn(approved,k))) reject(403, 'local_target_not_approved');
  const expected = [user.id, env[TEST_ENV_NAMES.workspace], env[TEST_ENV_NAMES.bot], env[TEST_ENV_NAMES.parent]].map(notionId);
  const actual = ['userId','workspaceId','botId','parentId'].map(k => notionId(approved[k]));
  if (expected.some((id,i) => !id || id !== actual[i]) || approved.scope !== 'personal-private-test' ||
      env[TEST_ENV_NAMES.scope] !== approved.scope || approved.policy !== LOCAL_READ_POLICY) reject(403, 'local_target_not_approved');
}
const safeCodes = new Set(['auth_required','invalid_session','test_connection_not_configured','test_user_not_allowed',
  'server_not_configured','upstream_rate_limited','auth_unavailable','invalid_upstream_response','upstream_timeout','upstream_unavailable',
  'origin_not_allowed','invalid_test_request','body_too_large','json_required','invalid_json','request_timeout',
  'local_target_not_approved','synthetic_input_required','local_approval_invalid','local_approval_already_consumed',
  'local_approval_store_unsafe','local_approval_store_failed']);

// Private test interface, deliberately NOT mounted on a server or imported by deployment entries.
// Defaults are closed; only the synthetic executor exists. No live Notion adapter argument.
export function createAuthenticatedMockHandler(options = {}) {
  const keys = ['env','authFetch','approvedTarget','directory','mode','scenario'];
  if (Object.keys(options).some(k => !keys.includes(k))) reject(503, 'local_mock_only');
  const {env = {}, authFetch, approvedTarget, directory, mode = 'blocked', scenario = 'success'} = options;
  return async request => {
    let simulatedGets = 0;
    try {
      if (mode !== 'mock' || typeof authFetch !== 'function') reject(503, 'local_mock_only');
      const url = new URL(request.url);
      if (url.pathname !== TARGET_PATH || url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) reject(404, 'route_not_found');
      if (request.method !== 'POST') return respond(405, {validationMode:'mock', actualNotionRequests:0, simulatedGets:0,
        connectionStatus:'failed', remoteReadEnabled:false, targetReadVerified:false, mockTargetReadVerified:false,
        error:{code:'method_not_allowed'}}, 0, {Allow:'POST'});
      originCheck(request, env); await checkInput(request, true);
      // 1. Auth (fresh on every call), 2. server scope binding, 3. credential snapshot.
      const user = await authenticateTestUser({request, env, fetchImpl:authFetch});
      checkApprovedTarget(approvedTarget, env, user);
      if (request.signal.aborted) reject(401, 'invalid_session');
      // Non-synthetic targets cannot cause a credential read in this mock-only path.
      for (const key of Object.values(TEST_ENV_NAMES).filter(k => k !== TEST_ENV_NAMES.token)) {
        if (env[key] !== MOCK_ENV[key]) reject(400, 'synthetic_input_required');
      }
      const credentials = {};
      try {
        for (const key of Object.values(TEST_ENV_NAMES)) credentials[key] = env[key];
        // 4. Synthetic gate, 5. atomic consumption, 6. fixed synthetic reads (never real fetch).
        const result = await runMockOnce({env:credentials, directory, scenario, signal:request.signal});
        simulatedGets = result.simulatedGets;
        if (request.signal.aborted) reject(401, 'invalid_session');
        const target = result.target ? {botMatched:result.target.botMatched, workspaceMatched:result.target.workspaceMatched,
          parentMatched:result.target.parentMatched, lockStatus:result.target.lockStatus, archived:result.target.archived,
          inTrash:result.target.inTrash, publishStatus:result.target.publishStatus, privacyVerified:false, creationPermissionVerified:false} : undefined;
        return respond(result.error ? 422 : 200, {validationMode:'mock', actualNotionRequests:0, simulatedGets:result.simulatedGets,
          connectionStatus:result.error ? 'mock_failed' : 'mock_read_verified', approvedUser:true, configured:true,
          remoteReadEnabled:false, targetReadVerified:false, mockTargetReadVerified:!result.error, target,
          ...(result.error ? {error:{code:result.error.code}} : {})}, 0);
      } finally {for (const key of Object.keys(credentials)) delete credentials[key];}
    } catch (error) {
      const known = error instanceof ReviewError && (safeCodes.has(error.code) || ['local_mock_only','route_not_found'].includes(error.code));
      return respond(known ? error.status : 500, {validationMode:'mock', actualNotionRequests:0, simulatedGets,
        connectionStatus:'failed', remoteReadEnabled:false, targetReadVerified:false, mockTargetReadVerified:false,
        error:{code:known ? error.code : 'internal_error'}}, 0);
    }
  };
}
