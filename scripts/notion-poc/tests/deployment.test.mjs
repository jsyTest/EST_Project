import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildStatic,PUBLIC_FILES} from '../../deployment/build-static.mjs';
const repository=fileURLToPath(new URL('../../../',import.meta.url));
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'est-public-build-'));t.after(()=>rm(root,{recursive:true,force:true}));for(const file of PUBLIC_FILES){await mkdir(dirname(join(root,file)),{recursive:true});await copyFile(join(repository,file),join(root,file));}return root;}
async function files(root,prefix=''){const list=[];for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){const path=prefix?`${prefix}/${entry.name}`:entry.name;if(entry.isDirectory())list.push(...await files(root,path));else list.push(path);}return list.sort();}
test('deployment: public output excludes private/source files and removes stale artifacts on rebuild',async t=>{
 const root=await fixture(t);
 for(const file of ['.env','docs/internal.md','scripts/notion-poc/cli.mjs','public-dist/docs/stale.md']){await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),'synthetic private content');}
 const result=await buildStatic(root);assert.equal(result.count,24);assert.deepEqual(await files(join(root,'public-dist')),[...PUBLIC_FILES].sort());
 assert.equal(await readFile(join(root,'public-dist/js/auth.js'),'utf8'),await readFile(join(repository,'js/auth.js'),'utf8'));
 const config=JSON.parse(await readFile(join(repository,'vercel.json'),'utf8'));assert.equal(config.outputDirectory,result.outputDirectory);assert.equal(config.buildCommand,'node scripts/deployment/build-static.mjs');
});
test('deployment: unknown public references fail before replacing the previous generated output',async t=>{
 const root=await fixture(t);await buildStatic(root);const before=await readFile(join(root,'public-dist/index.html'),'utf8');await writeFile(join(root,'index.html'),before+'\n<script src="scripts/notion-poc/cli.mjs"></script>');
 await assert.rejects(buildStatic(root),/Unlisted browser asset/);assert.equal(await readFile(join(root,'public-dist/index.html'),'utf8'),before);
});
