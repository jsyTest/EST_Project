import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm, chmod, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {MOCK_ENV, runMockOnce, main} from '../../notion-local/once.mjs';
import {consumeLocalApproval} from '../../notion-local/approval.mjs';
import {readHiddenConfiguration} from '../../notion-local/hidden-input.mjs';
import {readTestConfiguration} from '../../../server/notion/test-configuration.mjs';
import {createTestNotionReader} from '../../../server/notion/test-readonly.mjs';
import {createTestConnectionHandler} from '../../../server/notion/test-connection.mjs';
import {PUBLIC_FILES} from '../../deployment/build-static.mjs';

const USER = MOCK_ENV.PPLUS_NOTION_TEST_USER_ID, TOKEN = MOCK_ENV.PPLUS_NOTION_TEST_TOKEN;
const CONFIG = readTestConfiguration(MOCK_ENV, USER), MODULE = new URL('../../notion-local/once.mjs', import.meta.url).href;
const approvalModule = new URL('../../notion-local/approval.mjs', import.meta.url).href;
const configModule = new URL('../../../server/notion/test-configuration.mjs', import.meta.url).href;
async function store(t) {const root = await mkdtemp(join(tmpdir(),'nb013b-')); t.after(()=>rm(root,{recursive:true,force:true})); return join(root,'claims');}
const claim = directory => consumeLocalApproval({directory,userId:USER,configuration:CONFIG});
function safe(value) {const text=JSON.stringify(value); for(const v of Object.values(MOCK_ENV)) if(v!=='personal-private-test') assert.ok(!text.includes(v)); assert.doesNotMatch(text,/Bearer|Authorization|notion\.so|PRIVATE_UPSTREAM/);}
function child(code, args=[]) {
  return new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',code,...args],{stdio:['ignore','pipe','pipe']}); let out='',err='';
    p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('error',reject);p.once('close',exit=>resolve({exit,out,err}));});
}
test('NB013B: one approval consumes at most two fixed GETs, and output/store contain no target values',async t=>{
  const directory=await store(t), result=await runMockOnce({env:{...MOCK_ENV},directory});
  assert.equal(result.simulatedGets,2);assert.equal(result.actualNotionRequests,0);assert.equal(result.target.botMatched,true);safe(result);
  const files=await readdir(directory);assert.equal(files.length,1);assert.match(files[0],/^[a-f0-9]{64}\.consumed$/);
  safe(await readFile(join(directory,files[0]),'utf8'));assert.equal((await stat(directory)).mode&0o777,0o700);
  assert.equal((await stat(join(directory,files[0]))).mode&0o777,0o600);
});
for(const [scenario,count] of [['first_failure',1],['bot_mismatch',1],['workspace_mismatch',1],['parent_mismatch',2],['timeout',1],['response_lost',1]])
test(`NB013B: ${scenario} stops without retry and permanently consumes approval`,async t=>{
  const directory=await store(t), result=await runMockOnce({env:{...MOCK_ENV},directory,scenario});assert.equal(result.simulatedGets,count);assert.ok(result.error);safe(result);
  if(scenario==='timeout')assert.equal(result.error.code,'notion_timeout');
  await assert.rejects(runMockOnce({env:{...MOCK_ENV},directory}),e=>e.code==='local_approval_already_consumed');
});
test('NB013B: simultaneous readers on one approval cannot exceed two dispatches',async t=>{
  const a=await claim(await store(t));let calls=0;
  const adapter=a.wrap(async address=>{calls++; return Response.json(address.endsWith('/me') ? {object:'user',type:'bot',id:CONFIG.botId,bot:{workspace_id:CONFIG.workspaceId}} :
    {object:'page',id:CONFIG.parentId,in_trash:false,archived:false,public_url:null,parent:{type:'workspace',workspace:true}});});
  const readers=[1,2].map(()=>createTestNotionReader({configuration:CONFIG,fetchImpl:adapter,allowNetwork:true}));
  const results=await Promise.allSettled(readers.map(r=>r.reviewTarget())); assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(calls,2);assert.equal(a.requestCount,2);a.close();
});
test('NB013B: reader cannot be retried or entered concurrently, including default-disabled failure',async()=>{
  const r=createTestNotionReader({configuration:CONFIG});const results=await Promise.allSettled([r.reviewTarget(),r.reviewTarget()]);
  assert.equal(results[0].reason.code,'notion_remote_read_disabled');assert.equal(results[1].reason.code,'notion_read_already_attempted');assert.equal(r.requestCount,0);
});
test('NB013B: two separate processes atomically consume only one target-bound approval',async t=>{
  const directory=await store(t);
  const code=`import {consumeLocalApproval} from ${JSON.stringify(approvalModule)};import {MOCK_ENV} from ${JSON.stringify(MODULE)};import {readTestConfiguration} from ${JSON.stringify(configModule)};
    try {await consumeLocalApproval({directory:process.argv[1],userId:MOCK_ENV.PPLUS_NOTION_TEST_USER_ID,configuration:readTestConfiguration(MOCK_ENV,MOCK_ENV.PPLUS_NOTION_TEST_USER_ID)});console.log('claimed');}
    catch(e){console.log(e.code==='local_approval_already_consumed'?'blocked':'failed');}`;
  const runs=await Promise.all([child(code,[directory]),child(code,[directory])]);assert.deepEqual(runs.map(r=>r.out.trim()).sort(),['blocked','claimed']);assert.ok(runs.every(r=>!r.err));
});
test('NB013B: abrupt child exit after pre-network claim survives restart and runId changes',async t=>{
  const directory=await store(t);
  const code=`import {consumeLocalApproval} from ${JSON.stringify(approvalModule)};import {MOCK_ENV} from ${JSON.stringify(MODULE)};import {readTestConfiguration} from ${JSON.stringify(configModule)};
    await consumeLocalApproval({directory:process.argv[1],userId:MOCK_ENV.PPLUS_NOTION_TEST_USER_ID,configuration:readTestConfiguration(MOCK_ENV,MOCK_ENV.PPLUS_NOTION_TEST_USER_ID)});process.exit(17);`;
  assert.equal((await child(code,[directory])).exit,17);
  for(const runId of ['first','different','another']) await assert.rejects(runMockOnce({env:{...MOCK_ENV},directory,runId}),e=>e.code==='local_approval_already_consumed');
});
test('NB013B: approval binding excludes token/ID presentation/runId and includes actual target/scope',async t=>{
  const directory=await store(t);await claim(directory);
  await assert.rejects(consumeLocalApproval({directory,userId:USER.toUpperCase(),configuration:{...CONFIG,token:'CHANGED_SYNTHETIC_TOKEN'},runId:'new'}),e=>e.code==='local_approval_already_consumed');
  const different=await consumeLocalApproval({directory,userId:USER,configuration:{...CONFIG,parentId:'55555555-5555-4555-8555-555555555555'}});
  different.close();assert.equal((await readdir(directory)).length,2);
});
test('NB013B: atomic tombstone exists before adapter and remains after uncertain response',async t=>{
  const directory=await store(t), a=await claim(directory);let calls=0;
  const wrapped=a.wrap(async()=>{calls++;assert.equal((await readdir(directory)).length,1);throw new Error(TOKEN);});
  await assert.rejects(wrapped('https://api.notion.com/v1/users/me',{method:'GET',redirect:'error'}),e=>e.code==='notion_unavailable'&&!e.message.includes(TOKEN));
  await assert.rejects(wrapped(`https://api.notion.com/v1/pages/${CONFIG.parentId}`,{method:'GET',redirect:'error'}));assert.equal(calls,1);
});
test('NB013B: zero-byte interrupted record also denies reuse',async t=>{
  const directory=await store(t);await claim(directory);const [name]=await readdir(directory);await writeFile(join(directory,name),'');
  await assert.rejects(claim(directory),e=>e.code==='local_approval_already_consumed');
});
test('NB013B: unsafe permissions, symlink store, wrong paths/writes all fail closed',async t=>{
  const directory=await store(t);await claim(directory);await chmod(directory,0o755);
  await assert.rejects(claim(directory),e=>e.code==='local_approval_store_unsafe');await chmod(directory,0o700);
  const alias=directory+'-link';await symlink(directory,alias);await assert.rejects(claim(alias),e=>e.code==='local_approval_store_unsafe');
  const a=await claim(await store(t));let calls=0;const adapter=a.wrap(async()=>{calls++;return Response.json({});});
  for(const [url,options] of [['https://evil.invalid/v1/users/me',{method:'GET',redirect:'error'}],['https://api.notion.com/v1/users/me',{method:'POST',redirect:'error'}],
    [`https://api.notion.com/v1/pages/${CONFIG.parentId}`,{method:'GET',redirect:'error'}]]) await assert.rejects(adapter(url,options));
  assert.equal(calls,0);a.close();
});
function terminal({raw=false,writeThrows=false}={}) {
  const input=new EventEmitter();Object.assign(input,{isTTY:true,isRaw:raw,pause(){this.paused=true;},resume(){this.paused=false;},setRawMode(v){this.isRaw=v;}});
  const output={isTTY:true,text:'',write(s){if(writeThrows)throw new Error(TOKEN);this.text+=s;}};
  return {input,output,signals:new EventEmitter()};
}
test('NB013B: six hidden values never echo; terminal/raw mode/listeners are restored',async()=>{
  const t=terminal(), pending=readHiddenConfiguration(t);for(const value of Object.values(MOCK_ENV))t.input.emit('data',Buffer.from(value+'\r'));
  const env=await pending;assert.deepEqual(env,MOCK_ENV);safe(t.output.text);assert.equal(t.input.isRaw,false);assert.equal(t.input.paused,true);
  assert.equal(t.input.listenerCount('data'),0);assert.equal(t.signals.listenerCount('SIGINT'),0);
});
for(const kind of ['ctrl-c','SIGINT','SIGTERM','SIGHUP','error','end','bad-control','too-long'])test(`NB013B: ${kind} restores terminal and clears partial input`,async()=>{
  const t=terminal(),pending=readHiddenConfiguration(t);t.input.emit('data',Buffer.from(TOKEN));
  if(kind==='ctrl-c')t.input.emit('data',Buffer.from('\x03'));
  else if(kind==='error')t.input.emit('error',new Error(TOKEN));
  else if(kind==='end')t.input.emit('end');else if(kind==='bad-control')t.input.emit('data',Buffer.from('\x1b'));
  else if(kind==='too-long')t.input.emit('data',Buffer.from('x'.repeat(513)));else t.signals.emit(kind);
  await assert.rejects(pending,e=>!e.message.includes(TOKEN));assert.equal(t.input.isRaw,false);assert.equal(t.input.listenerCount('data'),0);safe(t.output.text);
});
test('NB013B: output exception restores existing raw state without exposing exception text',async()=>{
  const t=terminal({raw:true,writeThrows:true});await assert.rejects(readHiddenConfiguration(t),e=>e.code==='local_input_failed'&&!e.message.includes(TOKEN));assert.equal(t.input.isRaw,true);
});
test('NB013B: main exits with safe synthetic summary and restored terminal',async t=>{
  const fixture=terminal(),directory=await store(t);const run=main({...fixture,args:['--mock'],directory});
  for(const v of Object.values(MOCK_ENV))fixture.input.emit('data',Buffer.from(v+'\r'));
  assert.equal(await run,0);safe(fixture.output.text);assert.equal(fixture.input.isRaw,false);
});
test('NB013B: main output exception cannot escape with a credential-bearing error',async()=>{
  const fixture=terminal({writeThrows:true});assert.equal(await main({...fixture,args:['--mock']}),1);assert.equal(fixture.input.isRaw,false);
});
test('NB013B: default/--live/arbitrary args reject before reading values or environment',async()=>{
  for(const args of [[],['--live'],['--mock','--live'],['--token','SYNTHETIC']]) {
    let reads=0;const output={write(){}};const input={get isTTY(){reads++;throw new Error('must not read');}};
    assert.equal(await main({args,input,output}),2);assert.equal(reads,0);
  }
});
test('NB013B: non-TTY and non-fixture credentials cannot run or claim approval',async t=>{
  await assert.rejects(readHiddenConfiguration({input:{isTTY:false},output:{isTTY:true}}),e=>e.code==='local_tty_required');
  const directory=await store(t);await assert.rejects(runMockOnce({env:{...MOCK_ENV,PPLUS_NOTION_TEST_TOKEN:'DIFFERENT_SYNTHETIC_TOKEN'},directory}),e=>e.code==='synthetic_input_required');
  await assert.rejects(readdir(directory),e=>e.code==='ENOENT');
});
test('NB013B: browser success and all upstream errors omit IDs, page URL, raw error and credential',async()=>{
  for(const status of [200,401,403,404,429,500]) {
    const handler=createTestConnectionHandler({target:true,env:{...MOCK_ENV,SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC'},
      authFetch:async()=>Response.json({id:USER}),allowNotionNetwork:true,notionFetch:async address=>Response.json(status===200?
        address.endsWith('/me')?{object:'user',type:'bot',id:CONFIG.botId,bot:{workspace_id:CONFIG.workspaceId}}:
        {object:'page',id:CONFIG.parentId,archived:false,in_trash:false,is_locked:false,public_url:null,parent:{type:'workspace',workspace:true}}:
        {message:TOKEN,url:`https://notion.so/${CONFIG.parentId}`,workspace_id:CONFIG.workspaceId},{status})});
    const response=await handler(new Request('http://localhost/api/notion/test-target/review',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC','Content-Type':'application/json'},body:'{}'}));
    safe(await response.json());
  }
});
test('NB013B: deployed entrypoints stay blocked and all local runner files remain private',async()=>{
  for(const path of ['api/notion/test-connection.mjs','api/notion/test-target/review.mjs']) {
    const source=await readFile(new URL('../../../'+path,import.meta.url),'utf8');assert.doesNotMatch(source,/allowNotionNetwork|notionFetch/);
  }
  assert.equal(PUBLIC_FILES.length,32);assert.ok(!PUBLIC_FILES.some(p=>p.startsWith('scripts/')||p.startsWith('server/')));
  const source=await readFile(new URL('../../notion-local/once.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/process\.env|fetch\(/);
});

// Native OS PTY test: only synthetic input is sent; child output is checked before summarizing.
for(const mode of ['success','ctrl-c','SIGTERM'])test(`NB013B native PTY: ${mode}, echo/raw restoration and no leaked input`,async t=>{
  const directory=await store(t), helper=fileURLToPath(new URL('./helpers/notion-local-pty.py',import.meta.url));
  const output=await new Promise((resolve,reject)=>{const p=spawn('python3',[helper,MODULE,directory,mode,process.execPath],{stdio:['ignore','pipe','pipe']});let out='',err='';
    p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('error',reject);p.once('close',exit=>resolve({exit,out,err}));});
  assert.equal(output.exit,0,output.err);const result=JSON.parse(output.out);assert.equal(result.noEcho,true);assert.equal(result.restored,true);assert.equal(result.networkCalls,0);
});
