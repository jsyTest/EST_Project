export class ReviewError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const reject = (status, code) => { throw new ReviewError(status, code); };

// Bound streamed input before decoding; Content-Length alone is not trustworthy.
export async function readLimited(stream, maxBytes, signal) {
  if (!stream) return '';
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, {once: true});
  try {
    if (signal?.aborted) throw new ReviewError(504, 'request_timeout');
    while (true) {
      const {done, value} = await reader.read();
      if (signal?.aborted) throw new ReviewError(504, 'request_timeout');
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); reject(413, 'body_too_large'); }
      chunks.push(value);
    }
    return new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks));
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
