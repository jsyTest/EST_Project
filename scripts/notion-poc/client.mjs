import { API_ORIGIN, API_VERSION } from './config.mjs';

export class NotionError extends Error {
  constructor({ status, code, uncertain = false }) {
    // Do not persist or print response bodies, headers, or credentials.
    super(`Notion 요청 실패: ${status ?? 'network'}/${code}`);
    this.name = 'NotionError';
    Object.assign(this, { status, code, uncertain });
  }
}

export class NotionClient {
  constructor({ token, fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 20000, intervalMs = 350, maxRetries = 3 }) {
    if (!token) throw new Error('Notion 토큰이 필요합니다.');
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.timeoutMs = timeoutMs;
    this.intervalMs = intervalMs;
    this.maxRetries = maxRetries;
  }

  async request(method, path, body, { readOnly = method === 'GET' } = {}) {
    if (!path.startsWith('/v1/') || path.includes('://')) throw new Error('허용되지 않은 API 경로');
    for (let attempt = 0; ; attempt++) {
      await this.sleep(this.intervalMs);
      let response, result;
      try {
        response = await this.fetchImpl(`${API_ORIGIN}${path}`, {
          method, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs),
          headers: { Authorization: `Bearer ${this.token}`, 'Notion-Version': API_VERSION, 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        result = await response.json();
      } catch {
        if (readOnly && attempt < this.maxRetries) {
          await this.sleep(500 * 2 ** attempt);
          continue;
        }
        throw new NotionError({ code: 'transport_or_response_error', uncertain: !readOnly });
      }
      if (response.ok) {
        if (!result || typeof result !== 'object') throw new NotionError({ code: 'invalid_response', uncertain: !readOnly });
        return result;
      }
      // A rejected 429 can be retried. Never blindly repeat a write on 5xx/timeout.
      const retryable = response.status === 429 || (readOnly && [409, 500, 502, 503, 504, 529].includes(response.status));
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter === null ? NaN : Number(retryAfter);
        await this.sleep(Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 500 * 2 ** attempt);
        continue;
      }
      const code = /^[a-z_]+$/.test(result?.code ?? '') ? result.code : 'http_error';
      throw new NotionError({ status: response.status, code, uncertain: !readOnly && response.status >= 500 });
    }
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  patch(path, body) { return this.request('PATCH', path, body); }

  async queryAll(dataSourceId) {
    const pages = [];
    let cursor;
    const seen = new Set();
    do {
      const result = await this.request('POST', `/v1/data_sources/${dataSourceId}/query`, {
        page_size: 100, ...(cursor ? { start_cursor: cursor } : {})
      }, { readOnly: true });
      if (!Array.isArray(result.results)) throw new Error('조회 결과 형식 오류');
      pages.push(...result.results);
      cursor = result.has_more ? result.next_cursor : null;
      if (result.has_more && (!cursor || seen.has(cursor))) throw new Error('잘못된 페이지네이션');
      seen.add(cursor);
    } while (cursor);
    return pages;
  }
}
