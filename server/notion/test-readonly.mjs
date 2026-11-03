import {readLimited, reject, ReviewError} from '../review-errors.mjs';
import {NOTION_VERSION} from '../../js/planner/catalog.mjs';
import {notionId} from './test-configuration.mjs';

export const MAX_NOTION_RESPONSE_BYTES = 131072;
// There is deliberately no generic request(path, method) or mutation method.
// Default construction cannot contact Notion even if a machine has existing credentials.
export function createTestNotionReader({configuration, fetchImpl, allowNetwork = false, signal}) {
  let requests = 0, started = false;
  async function getFixed(path) {
    if (allowNetwork !== true || typeof fetchImpl !== 'function') reject(503, 'notion_remote_read_disabled');
    const allowed = ['/v1/users/me', `/v1/pages/${configuration.parentId}`];
    if (!allowed.includes(path)) reject(400, 'invalid_test_target');
    const abort = AbortSignal.any([signal, AbortSignal.timeout(8000)].filter(Boolean));
    try {
      if (abort.aborted) reject(504, 'notion_timeout');
      requests++;
      const response = await fetchImpl(`https://api.notion.com${path}`, {method: 'GET', redirect: 'error', cache: 'no-store', signal: abort,
        headers: {Authorization: `Bearer ${configuration.token}`, 'Notion-Version': NOTION_VERSION, Accept: 'application/json'}});
      if (!response.ok) {
        // Discard upstream error text and headers; no retries, including 429.
        void response.body?.cancel().catch(() => {});
        if (response.status === 401) reject(502, 'notion_unauthorized');
        if (response.status === 403) reject(403, 'notion_access_denied');
        if (response.status === 404) reject(404, 'notion_target_not_found');
        if (response.status === 429) reject(429, 'notion_rate_limited');
        reject(502, 'notion_unavailable');
      }
      const body = await readLimited(response.body, MAX_NOTION_RESPONSE_BYTES, abort);
      let value; try { value = JSON.parse(body); } catch { reject(502, 'invalid_notion_response'); }
      return value;
    } catch (error) {
      if (error instanceof ReviewError && error.code !== 'body_too_large') throw error;
      if (abort.aborted) reject(504, 'notion_timeout');
      reject(502, 'notion_unavailable');
    }
  }
  return {
    get requestCount() { return requests; },
    async reviewTarget() {
      // Claim synchronously, including failures and concurrent calls. A reader is never reusable.
      if (started) reject(409, 'notion_read_already_attempted');
      started = true;
      const self = await getFixed('/v1/users/me');
      if (self?.object !== 'user' || self.type !== 'bot' || notionId(self.id) !== configuration.botId) reject(403, 'notion_bot_mismatch');
      if (notionId(self.bot?.workspace_id) !== configuration.workspaceId) reject(403, 'notion_workspace_mismatch');
      const page = await getFixed(`/v1/pages/${configuration.parentId}`);
      if (page?.object !== 'page' || notionId(page.id) !== configuration.parentId) reject(403, 'notion_parent_mismatch');
      if (page.archived === true) reject(410, 'notion_target_archived');
      if (page.in_trash === true) reject(410, 'notion_target_in_trash');
      if (page.in_trash !== false || (page.archived !== undefined && page.archived !== false)) reject(502, 'invalid_notion_response');
      if (page.is_locked === true) reject(423, 'notion_target_locked');
      if (page.is_locked !== undefined && page.is_locked !== false) reject(502, 'invalid_notion_response');
      if (page.public_url !== null) reject(403, 'notion_target_privacy_unconfirmed');
      const parent = page.parent;
      if (!(parent?.type === 'workspace' && parent.workspace === true) && !(parent?.type === 'page_id' && notionId(parent.page_id))) reject(422, 'notion_target_not_standalone_page');
      return {botMatched: true, workspaceMatched: true, parentMatched: true,
        archived: false, inTrash: false, lockStatus: page.is_locked === false ? 'unlocked' : 'unknown',
        publishStatus: 'not_published', privacyVerified: false, creationPermissionVerified: false, targetReadVerified: true};
    }
  };
}
