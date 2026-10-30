import {WORKSPACE_KEY, DraftError, emptyConfiguration, normalizeConfiguration, normalizeRequirements, normalizeMapping, normalizePlannerSettings} from './model.mjs';
export function createWorkspace({storage, userId}) {
  let state = {id: null, updatedAt: null, dirty: false, configuration: emptyConfiguration()};
  let revision = 0, disposed = false;
  const listeners = new Set();
  const clone = value => structuredClone(value);
  const assertActive = () => { if (disposed) throw new DraftError('account_changed'); };
  let storageError = false;
  try {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.owner === userId) {
        state = {id: typeof cached.id === 'string' ? cached.id : null, updatedAt: typeof cached.updatedAt === 'string' ? cached.updatedAt : null,
          dirty: cached.dirty === true, configuration: normalizeConfiguration(cached.configuration)};
      } else storage.removeItem(WORKSPACE_KEY);
    } else if (storage.getItem('estAuthDraftOwner') === userId) {
      const legacy = storage.getItem('aiNotionBuilderRequirements');
      if (legacy) { state.configuration.requirements = normalizeRequirements(JSON.parse(legacy)); state.dirty = true; }
    }
  } catch {
    storageError = true;
    try { storage.removeItem(WORKSPACE_KEY); } catch { /* Keep the editor available when storage is blocked. */ }
  }
  function persist() {
    try {
      storage.setItem(WORKSPACE_KEY, JSON.stringify({...state, owner: userId}));
      storage.setItem('aiNotionBuilderRequirements', JSON.stringify(state.configuration.requirements));
      storageError = false;
    } catch { storageError = true; }
    for (const listener of listeners) listener(snapshot());
  }
  function snapshot() { assertActive(); return {...clone(state), revision, storageError}; }
  function update(section, value) {
    assertActive();
    const normalizers = {requirements: normalizeRequirements, mapping: normalizeMapping, planner: normalizePlannerSettings};
    if (!Object.hasOwn(normalizers, section)) throw new DraftError('invalid_configuration');
    const next = normalizers[section](value);
    if (JSON.stringify(state.configuration[section]) === JSON.stringify(next)) return;
    state.configuration[section] = next; state.dirty = true; revision++; persist();
  }
  return {
    snapshot, update,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    open(row) {
      assertActive();
      const configuration = normalizeConfiguration(row.configuration);
      state = {id: row.id, updatedAt: row.updatedAt, dirty: false, configuration}; revision++; persist();
    },
    saved(row, capturedRevision) {
      assertActive();
      // Preserve edits made while a request was in flight, but retain the server's new revision for the next update.
      state.id = row.id; state.updatedAt = row.updatedAt;
      if (capturedRevision === revision) { state.configuration = normalizeConfiguration(row.configuration); state.dirty = false; }
      persist();
    },
    reset({keepConfiguration = false} = {}) {
      assertActive(); state = {id: null, updatedAt: null, dirty: keepConfiguration, configuration: keepConfiguration ? state.configuration : emptyConfiguration()}; revision++; persist();
    },
    dispose() {
      disposed = true; revision++; state = null; listeners.clear();
      try { storage.removeItem(WORKSPACE_KEY); storage.removeItem('aiNotionBuilderRequirements'); } catch { /* Auth UI also clears its contents. */ }
    }
  };
}
