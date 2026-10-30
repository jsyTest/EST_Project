import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';
import entry from '../../api/drafts/review.mjs';
import adminEntry from '../../api/admin/overview.mjs';
import {PUBLIC_FILES} from '../deployment/build-static.mjs';

const ROOT = fileURLToPath(new URL('../../public-dist/', import.meta.url));
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'};
export async function startReviewServer({port = 8787, reviewHandler = entry.fetch, adminHandler = adminEntry.fetch, publicRoot = ROOT, enableAdminDemo = false} = {}) {
  const server = createServer(async (req, res) => {
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/drafts/review' || url.pathname === '/api/admin/overview') {
        const abort = new AbortController();
        req.once('aborted', () => abort.abort());
        const request = new Request(url, {method: req.method, headers: req.headers, signal: abort.signal,
          ...(!['GET', 'HEAD'].includes(req.method) ? {body: Readable.toWeb(req), duplex: 'half'} : {})});
        const result = await (url.pathname === '/api/admin/overview' ? adminHandler : reviewHandler)(request);
        res.writeHead(result.status, Object.fromEntries(result.headers));
        res.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      if (enableAdminDemo && ['GET', 'HEAD'].includes(req.method) && ['/__demo/admin.html', '/__demo/admin-demo.mjs'].includes(url.pathname)) {
        let data;
        if (url.pathname.endsWith('.html')) {
          data = (await readFile(join(publicRoot, 'admin.html'), 'utf8'))
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
            .replace(/data-auth-state="checking"/, 'data-auth-state="authenticated"')
            .replace(/data-admin-state="checking"/, 'data-admin-state="authorized"')
            .replace(/data-admin-required="true"/, 'data-admin-required="false"')
            .replace('<title>관리자 페이지 | PPLUS</title>', '<title>로컬 관리자 UI 시연 | PPLUS</title>')
            .replace('<body class="admin-body">', '<body class="admin-body"><aside id="local-demo-notice" class="admin-demo-banner" role="note">로컬 UI 시연 · 모든 계정과 수치는 가상 예시입니다. 실제 관리자 기능이나 운영 통계가 아닙니다.</aside>')
            .replace(/(href|src)="((?:css|assets)\/[^\"]+)"/g, '$1="/$2"')
            .replaceAll('href="index.html"', 'href="/index.html"')
            .replace('</body>', '<script type="module" src="/__demo/admin-demo.mjs"></script></body>');
        } else data = await readFile(new URL('./admin-demo.mjs', import.meta.url));
        res.writeHead(200, {'Content-Type': url.pathname.endsWith('.html') ? mime['.html'] : mime['.mjs'], 'Cache-Control': 'no-store'});
        res.end(req.method === 'HEAD' ? undefined : data); return;
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
  startReviewServer({enableAdminDemo: true}).then(server => console.log(`Local review server: http://127.0.0.1:${server.address().port} — admin UI demo: /__demo/admin.html`)).catch(() => {
    console.error('Local review server could not start.'); process.exitCode = 1;
  });
}
