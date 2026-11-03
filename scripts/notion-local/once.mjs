import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readTestConfiguration, TEST_ENV_NAMES} from '../../server/notion/test-configuration.mjs';
import {createTestNotionReader} from '../../server/notion/test-readonly.mjs';
import {consumeLocalApproval} from './approval.mjs';
import {readHiddenConfiguration} from './hidden-input.mjs';
import {reject} from '../../server/review-errors.mjs';

// Only published SYNTHETIC fixtures are accepted by this executable. Never enter real values.
export const MOCK_ENV = Object.freeze({
  PPLUS_NOTION_TEST_USER_ID: '11111111-1111-4111-8111-111111111111',
  PPLUS_NOTION_TEST_WORKSPACE_ID: '22222222-2222-4222-8222-222222222222',
  PPLUS_NOTION_TEST_BOT_ID: '33333333-3333-4333-8333-333333333333',
  PPLUS_NOTION_TEST_PARENT_PAGE_ID: '44444444-4444-4444-8444-444444444444',
  PPLUS_NOTION_TEST_SCOPE: 'personal-private-test',
  PPLUS_NOTION_TEST_TOKEN: 'SYNTHETIC_LOCAL_INPUT_NOT_A_REAL_TOKEN'
});
const failures = new Set(['first_failure', 'bot_mismatch', 'workspace_mismatch', 'parent_mismatch', 'timeout', 'response_lost']);
function writeSafe(output, text) {try {output.write(text); return true;} catch {return false;}}
export async function runMockOnce({env, directory, scenario = 'success', signal} = {}) {
  // No live flag or real fetch exists in this runner. Ambient configuration is never consulted.
  if (!env || Object.keys(env).length !== 6 || Object.entries(MOCK_ENV).some(([k,v]) => env[k] !== v) ||
      (scenario !== 'success' && !failures.has(scenario))) reject(400, 'synthetic_input_required');
  const configuration = readTestConfiguration(env, env[TEST_ENV_NAMES.user]);
  const approval = await consumeLocalApproval({directory, userId: env[TEST_ENV_NAMES.user], configuration});
  let reader;
  const simulatedAbort = new AbortController();
  try {
    const mockAdapter = async (address, options) => {
      if (scenario === 'response_lost') throw new Error('SYNTHETIC_LOST_RESPONSE');
      if (scenario === 'timeout') {simulatedAbort.abort(); options.signal.throwIfAborted();}
      if (scenario === 'first_failure') return Response.json({}, {status: 429});
      if (address.endsWith('/me')) return Response.json({object:'user', type:'bot',
        id: scenario === 'bot_mismatch' ? MOCK_ENV.PPLUS_NOTION_TEST_PARENT_PAGE_ID : configuration.botId,
        bot:{workspace_id:scenario === 'workspace_mismatch' ? MOCK_ENV.PPLUS_NOTION_TEST_PARENT_PAGE_ID : configuration.workspaceId}});
      return Response.json({object:'page', id:scenario === 'parent_mismatch' ? configuration.botId : configuration.parentId,
        archived:false, in_trash:false, is_locked:false, public_url:null, parent:{type:'workspace',workspace:true}});
    };
    reader = createTestNotionReader({configuration, allowNetwork:true, fetchImpl:approval.wrap(mockAdapter),
      signal:AbortSignal.any([signal, simulatedAbort.signal].filter(Boolean))});
    const target = await reader.reviewTarget();
    return {mode:'mock', actualNotionRequests:0, notionWrites:0, simulatedGets:approval.requestCount, target,
      privacyVerified:false, creationPermissionVerified:false, webExecutionReady:false, notionExecution:'not_executed'};
  } catch (error) {
    const codes = new Set(['notion_rate_limited','notion_bot_mismatch','notion_workspace_mismatch','notion_parent_mismatch','notion_timeout','notion_unavailable']);
    return {mode:'mock', actualNotionRequests:0, notionWrites:0, simulatedGets:approval.requestCount,
      error:{code:codes.has(error.code) ? error.code : 'local_read_failed'}, webExecutionReady:false, notionExecution:'not_executed'};
  } finally {approval.close(); reader = null;}
}

export async function main({args = process.argv.slice(2), input = process.stdin, output = process.stdout,
  signals = process, directory = join(homedir(), '.pplus-notion-mock-approval-v1')} = {}) {
  // Argument validation precedes all input/config reads. Defaults and --live are blocked.
  if (args.length !== 1 || args[0] !== '--mock') {
    writeSafe(output, '원격 연결 차단. --mock 가상 입력 검사만 지원합니다. 실제 값은 입력하지 마세요.\n'); return 2;
  }
  let env;
  try {
    env = await readHiddenConfiguration({input, output, signals});
    const result = await runMockOnce({env, directory});
    return writeSafe(output, JSON.stringify(result) + '\n') && !result.error ? 0 : 1;
  } catch (error) {
    const codes = new Set(['local_input_cancelled','local_input_failed','local_tty_required','synthetic_input_required',
      'local_approval_already_consumed','local_approval_store_unsafe','local_approval_store_failed','local_approval_invalid']);
    writeSafe(output, JSON.stringify({error:{code:codes.has(error.code) ? error.code : 'local_run_failed'}, actualNotionRequests:0}) + '\n'); return 1;
  } finally {
    if (env) for (const key of Object.keys(env)) delete env[key]; env = null;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then(code => {process.exitCode = code;}).catch(() => {process.exitCode = 1;});
