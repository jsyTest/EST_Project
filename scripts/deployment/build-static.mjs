import { copyFile, mkdir, readFile, rm, lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Only these browser assets belong in the public deployment output.
export const PUBLIC_FILES = [
  'index.html', 'login.html', 'result.html', 'mapping.html',
  'css/style.css', 'css/auth.css', 'css/mapping.css',
  'js/app.js', 'js/mock-data.js', 'js/supabase-client.js',
  'js/auth-bootstrap.js', 'js/auth-core.js', 'js/auth.js', 'js/mapping-ui.mjs',
  'js/mapping/model.mjs', 'js/mapping/parse.mjs', 'js/mapping/csv.mjs',
  'assets/logo_1.png'
];
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export async function buildStatic(projectRoot = ROOT) {
  const root = resolve(projectRoot);
  const output = join(root, 'public-dist');
  // Validate everything before replacing this generated output directory.
  for (const file of PUBLIC_FILES) {
    const metadata = await lstat(join(root, file));
    if (!metadata.isFile()) throw new Error(`Expected a regular public file: ${file}`);
  }
  for (const file of PUBLIC_FILES.filter(file => file.endsWith('.html'))) {
    const html = await readFile(join(root, file), 'utf8');
    for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*(?:src|href)="([^"]+)"/g)) {
      if (/^https?:|^data:/.test(match[1])) continue;
      if (!PUBLIC_FILES.includes(match[1])) throw new Error(`Unlisted browser asset: ${file} -> ${match[1]}`);
    }
  }
  const previous = await lstat(output).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (previous && !previous.isDirectory()) throw new Error('public-dist must be a generated directory, not a file or symlink.');
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of PUBLIC_FILES) {
    const destination = join(output, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(root, file), destination);
  }
  return { outputDirectory: 'public-dist', files: PUBLIC_FILES, count: PUBLIC_FILES.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildStatic().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
