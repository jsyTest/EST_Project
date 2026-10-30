import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import entry from '../../api/drafts/review.mjs';
import {PUBLIC_FILES} from '../deployment/build-static.mjs';

const ROOT = fileURLToPath(new URL('../../public-dist/', import.meta.url));
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png'};
export async function startReviewServer({port = 8787, reviewHandler = entry.fetch, publicRoot = ROOT} = {}) {
  const server = createServer(async (req, res) => {
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/drafts/review') {
        const abort = new AbortController();
        req.once('aborted', () => abort.abort());
        const request = new Request(url, {method: req.method, headers: req.headers, signal: abort.signal,
          ...(!['GET', 'HEAD'].includes(req.method) ? {body: Readable.toWeb(req), duplex: 'half'} : {})});
        const result = await reviewHandler(request);
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['GET', 'HEAD'].includes(req.method) || !PUBLIC_FILES.includes(path)) {
        res.writeHead(404, {'Cache-Control': 'no-store'}); res.end(); return;
      }
      const data = await readFile(join(publicRoot, path));
      const extension = path.slice(path.lastIndexOf('.'));
      res.writeHead(200, {'Content-Type': mime[extension] ?? 'application/octet-stream', 'Cache-Control': 'no-store'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      if (!res.headersSent) res.writeHead(503, {'Cache-Control': 'no-store'});
      res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startReviewServer().then(server => console.log(`Local review server: http://127.0.0.1:${server.address().port}`)).catch(() => {
    console.error('Local review server could not start.'); process.exitCode = 1;
  });
}
