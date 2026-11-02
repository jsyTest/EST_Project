import {UUID} from '../supabase-readonly.mjs';
import {reject} from '../review-errors.mjs';

// Separate from the CLI's NOTION_API_TOKEN/NOTION_TEST_PARENT_PAGE_ID. No file loading.
export const TEST_ENV_NAMES = Object.freeze({user: 'PPLUS_NOTION_TEST_USER_ID', workspace: 'PPLUS_NOTION_TEST_WORKSPACE_ID',
  bot: 'PPLUS_NOTION_TEST_BOT_ID', parent: 'PPLUS_NOTION_TEST_PARENT_PAGE_ID', scope: 'PPLUS_NOTION_TEST_SCOPE', token: 'PPLUS_NOTION_TEST_TOKEN'});
export function notionId(value) {
  if (typeof value !== 'string' || !/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value)) return null;
  const hex = value.replaceAll('-', '').toLowerCase();
  if (/^0{32}$/.test(hex)) return null;
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function readTestConfiguration(env, userId) {
  const approvedUser = env[TEST_ENV_NAMES.user];
  if (typeof approvedUser !== 'string' || !UUID.test(approvedUser) || approvedUser.replaceAll('-', '') === '0'.repeat(32)) reject(503, 'test_connection_not_configured');
  // Role/email/user_metadata do not grant access. Deny before reading any Notion credential.
  if (userId !== approvedUser.toLowerCase()) reject(403, 'test_user_not_allowed');
  const workspaceId = notionId(env[TEST_ENV_NAMES.workspace]), botId = notionId(env[TEST_ENV_NAMES.bot]), parentId = notionId(env[TEST_ENV_NAMES.parent]);
  if (!workspaceId || !botId || !parentId || new Set([workspaceId, botId, parentId]).size !== 3 || env[TEST_ENV_NAMES.scope] !== 'personal-private-test') reject(503, 'test_connection_not_configured');
  const token = env[TEST_ENV_NAMES.token];
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,512}$/.test(token)) reject(503, 'test_connection_not_configured');
  return Object.freeze({workspaceId, botId, parentId, token});
}
