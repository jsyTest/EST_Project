import {emptyConfiguration} from '../../../../js/drafts/model.mjs';
export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';
export function storage() {
  const values = new Map();
  return {values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k)};
}
export function mockServer() {
  const rows = new Map(), requests = []; let sequence = 0, failure = null, delay = null;
  function createDataClient(token) {
    const owner = token === 'token-A' ? USER_A : token === 'token-B' ? USER_B : null;
    return {from(table) {
      if (table !== 'education_drafts') throw new Error('Unexpected table');
      let operation = 'select', payload, single = false, columns = '*', range = [0, 24]; const filters = [];
      const q = {
        select(value) { columns = value; return q; }, insert(value) { operation = 'insert'; payload = structuredClone(value); return q; },
        update(value) { operation = 'update'; payload = structuredClone(value); return q; },
        eq(key, value) { filters.push([key, value]); return q; }, order() { return q; },
        range(first, last) { range = [first, last]; return q; }, maybeSingle() { single = true; return q; }, abortSignal() { return q; },
        async then(resolve, reject) {
          try {
            requests.push({owner, operation, payload, filters});
            if (delay) { const wait = delay; delay = null; await wait; }
            if (failure) { const error = failure; failure = null; return resolve({data: null, error}); }
            if (!owner) return resolve({data: null, error: {code: '42501'}});
            let found = [...rows.values()].filter(row => row.user_id === owner && filters.every(([k, v]) => row[k] === v));
            if (operation === 'insert') {
              if ('user_id' in payload) return resolve({data: null, error: {code: '42501'}});
              const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
              const time = new Date(1700000000000 + sequence * 1000).toISOString();
              const row = {id, user_id: owner, created_at: time, updated_at: time, ...payload}; rows.set(id, row); found = [row];
            } else if (operation === 'update') {
              found = found.map(row => { const updated = {...row, ...payload, updated_at: new Date(1700000000000 + ++sequence * 1000).toISOString()}; rows.set(row.id, updated); return updated; });
            }
            let data = found.slice(range[0], range[1] + 1);
            if (columns !== '*' && !columns.includes('configuration')) data = data.map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]])));
            return resolve({data: structuredClone(single ? data[0] ?? null : data), error: null});
          } catch (error) { if (reject) reject(error); else throw error; }
        }
      }; return q;
    }};
  }
  return {rows, requests, createDataClient, failNext(error) { failure = error; }, delayNext(promise) { delay = promise; }};
}
export function auth(user = USER_A) {
  let id = user;
  return {switch(next) { id = next; }, auth: {async getSession() {
    return {data: {session: id ? {user: {id}, access_token: id === USER_A ? 'token-A' : 'token-B'} : null}, error: null};
  }}};
}
export function configuration(title = '가상 교육') { const c = emptyConfiguration(); c.requirements.educationName = title; return c; }
