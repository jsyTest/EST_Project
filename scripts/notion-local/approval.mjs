import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {mkdir, lstat, open} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {reject} from '../../server/review-errors.mjs';
import {notionId} from '../../server/notion/test-configuration.mjs';
import {NOTION_VERSION} from '../../js/planner/catalog.mjs';

// Local-only tombstone, NOT a web execution ledger or proof of human approval.
// No runId, caller-supplied approval ID, token, or timestamp can change the binding.
const POLICY = 'pplus-personal-fixed-read-once-v1';
export async function consumeLocalApproval({directory, userId, configuration}) {
  const user = notionId(userId);
  const ids = ['workspaceId', 'botId', 'parentId'].map(k => notionId(configuration[k]));
  if (!user || ids.some(id => !id) || new Set(ids).size !== 3 || !isAbsolute(directory ?? '')) reject(503, 'local_approval_invalid');
  const parentId = ids[2];
  const binding = JSON.stringify([POLICY, NOTION_VERSION, user, ...ids, 'personal-private-test', 'GET:users/me:1', 'GET:fixed-parent:1', 2]);
  const digest = createHash('sha256').update(binding).digest('hex');
  let directoryHandle, record;
  try {
    await mkdir(directory, {mode: 0o700}).catch(e => {if (e.code !== 'EEXIST') throw e;});
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || info.uid !== process.getuid?.()) reject(503, 'local_approval_store_unsafe');
    directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const held = await directoryHandle.stat();
    if (held.ino !== info.ino || held.dev !== info.dev) reject(503, 'local_approval_store_unsafe');
    // O_EXCL is the cross-process claim. Even an empty/crashed record denies reuse.
    record = await open(join(directory, `${digest}.consumed`), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await record.writeFile(JSON.stringify({version: 1, policy: POLICY, consumed: true, maximumGets: 2}) + '\n');
    await record.sync();
    await directoryHandle.sync();
  } catch (error) {
    if (error.code === 'EEXIST') reject(409, 'local_approval_already_consumed');
    if (['local_approval_store_unsafe', 'local_approval_invalid'].includes(error.code)) throw error;
    reject(503, 'local_approval_store_failed');
  } finally {
    await record?.close().catch(() => {}); await directoryHandle?.close().catch(() => {});
  }
  let calls = 0, closed = false;
  const seen = new Set();
  return Object.freeze({
    get requestCount() {return calls;},
    close() {closed = true;},
    wrap(adapter) {
      if (typeof adapter !== 'function') reject(503, 'notion_remote_read_disabled');
      return async (address, options) => {
        const first = 'https://api.notion.com/v1/users/me', second = `https://api.notion.com/v1/pages/${parentId}`;
        // Reserve before dispatch; ambiguous results/errors consume their slot permanently.
        if (closed || calls >= 2 || seen.has(address) || options?.method !== 'GET' || options?.redirect !== 'error' || options?.body !== undefined ||
            (calls === 0 ? address !== first : address !== second)) reject(409, 'local_approval_budget_exhausted');
        seen.add(address); calls++;
        try {return await adapter(address, options);} catch {
          closed = true;
          if (options.signal?.aborted) reject(504, 'notion_timeout');
          reject(502, 'notion_unavailable');
        }
      };
    }
  });
}
