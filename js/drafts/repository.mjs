import {DraftError, forSave, normalizeConfiguration} from './model.mjs';
const fields = 'id,user_id,title,configuration,schema_version,created_at,updated_at';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createDraftRepository({authClient, createDataClient, userId, requestTimeoutMs = 15000}) {
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs < 1) throw new DraftError('invalid_configuration');
  let revision = 0, disposed = false;
  const pending = new Set();
  const assertActive = observed => { if (disposed || observed !== revision) throw new DraftError('account_changed'); };
  async function run(request) {
    const observed = revision;
    assertActive(observed);
    const abort = new AbortController(); pending.add(abort);
    let rejectAbort;
    const canceled = new Promise((_, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(abort.signal.reason || new DraftError('request_timeout'));
    abort.signal.addEventListener('abort', onAbort, {once: true});
    const timeout = setTimeout(() => abort.abort(new DraftError('request_timeout')), requestTimeoutMs);
    function checkpoint() {
      assertActive(observed);
      if (abort.signal.aborted) throw abort.signal.reason || new DraftError('request_timeout');
    }
    async function execute() {
      // Bind every request to the token checked here; a later account switch cannot relabel an insert.
      const {data, error} = await authClient.auth.getSession();
      checkpoint();
      if (error) throw error;
      if (!data?.session?.access_token || data.session.user?.id !== userId) throw new DraftError('auth_required');
      const client = createDataClient(data.session.access_token);
      const result = await request(client, abort.signal);
      checkpoint();
      if (result.error) throw result.error;
      const latest = await authClient.auth.getSession();
      checkpoint();
      if (latest.error || !latest.data?.session?.access_token || latest.data.session.user?.id !== userId) throw new DraftError('account_changed');
      return result.data;
    }
    try {
      return await Promise.race([execute(), canceled]);
    } finally { clearTimeout(timeout); abort.signal.removeEventListener('abort', onAbort); pending.delete(abort); }
  }
  function readRow(row) {
    if (!row) throw new DraftError('not_found');
    if (row.user_id !== userId || !uuid.test(row.id) || typeof row.updated_at !== 'string') throw new DraftError('account_changed');
    return {id: row.id, title: row.title, updatedAt: row.updated_at, configuration: normalizeConfiguration(row.configuration, row.schema_version)};
  }
  return {
    async list(offset = 0) {
      if (!Number.isInteger(offset) || offset < 0) throw new DraftError('invalid_configuration');
      return await run((client, signal) => client.from('education_drafts').select('id,title,schema_version,updated_at')
        .eq('user_id', userId).order('updated_at', {ascending: false}).order('id', {ascending: false}).range(offset, offset + 24).abortSignal(signal));
    },
    async get(id) {
      if (!uuid.test(id)) throw new DraftError('not_found');
      return readRow(await run((client, signal) => client.from('education_drafts').select(fields).eq('id', id).eq('user_id', userId).maybeSingle().abortSignal(signal)));
    },
    async save(configuration, current = null) {
      const payload = forSave(configuration);
      if (current && (!uuid.test(current.id) || typeof current.updatedAt !== 'string')) throw new DraftError('invalid_configuration');
      const row = await run((client, signal) => {
        const table = client.from('education_drafts');
        const query = current
          ? table.update(payload).eq('id', current.id).eq('user_id', userId).eq('updated_at', current.updatedAt)
          : table.insert(payload); // user_id is assigned by auth.uid() in Postgres, never by the browser.
        return query.select(fields).maybeSingle().abortSignal(signal);
      });
      if (!row) throw new DraftError(current ? 'conflict' : 'not_found');
      return readRow(row);
    },
    dispose() { disposed = true; revision++; for (const abort of pending) abort.abort(new DraftError('account_changed')); pending.clear(); }
  };
}
