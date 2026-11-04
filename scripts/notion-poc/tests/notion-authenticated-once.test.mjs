import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, rm, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createAuthenticatedMockHandler} from '../../notion-local/authenticated-once.mjs';
import {MOCK_ENV} from '../../notion-local/once.mjs';
import {LOCAL_READ_POLICY} from '../../notion-local/approval.mjs';
import {authenticateTestUser} from '../../../server/notion/test-auth.mjs';
import {createConnectionController} from '../../../js/notion-test-connection.mjs';
import {TARGET_PATH} from '../../../server/notion/test-connection.mjs';
import {PUBLIC_FILES} from '../../deployment/build-static.mjs';

const USER = MOCK_ENV.PPLUS_NOTION_TEST_USER_ID, OTHER = '99999999-9999-4999-8999-999999999999';
const ENV = {...MOCK_ENV,SUPABASE_URL:'https://authenticated-mock.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC'};
const TARGET = {userId:USER,workspaceId:MOCK_ENV.PPLUS_NOTION_TEST_WORKSPACE_ID,botId:MOCK_ENV.PPLUS_NOTION_TEST_BOT_ID,
  parentId:MOCK_ENV.PPLUS_NOTION_TEST_PARENT_PAGE_ID,scope:'personal-private-test',policy:LOCAL_READ_POLICY};
async function directory(t) {const root=await mkdtemp(join(tmpdir(),'nb013d-'));t.after(()=>rm(root,{recursive:true,force:true}));return join(root,'claims');}
function request({token='test-A',body={},signal,method='POST',origin,url=`http://127.0.0.1${TARGET_PATH}`}={}) {
  return new Request(url,{method,signal,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),'Content-Type':'application/json',...(origin?{Origin:origin}:{})},
    ...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify(body)})});
}
function fixture({env={...ENV},target={...TARGET},dir,scenario='success',auth}={}) {
  const calls=[];
  const authFetch=async(address,options)=>{calls.push(options.headers.Authorization);
    assert.equal(new URL(address).origin,ENV.SUPABASE_URL);assert.equal(new URL(address).pathname,'/auth/v1/user');
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    if(auth)return auth(address,options);
    const id=options.headers.Authorization==='Bearer test-A'?USER:options.headers.Authorization==='Bearer test-B'?OTHER:null;
    return Response.json(id?{id,app_metadata:{pplus_role:'admin'},email:'synthetic@example.invalid',user_metadata:{id:USER,user_id:USER}}:{message:'PRIVATE_AUTH'}, {status:id?200:401});};
  const handler=createAuthenticatedMockHandler({env,approvedTarget:target,directory:dir,mode:'mock',scenario,authFetch});
  return {handler,calls,env,authFetch};
}
async function safe(response,status,code) {
  assert.equal(response.status,status);const b=await response.json();if(code)assert.equal(b.error.code,code);
  assert.equal(b.validationMode,'mock');assert.equal(b.actualNotionRequests,0);assert.equal(b.notionRequests,0);assert.equal(b.notionWrites,0);
  assert.equal(b.targetReadVerified,false);assert.equal(b.webExecutionReady,false);assert.equal(b.notionExecution,'not_executed');
  assert.equal(b.remoteReadEnabled,false);assert.equal(b.privacyVerified,false);assert.equal(b.creationPermissionVerified,false);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  const serialized=JSON.stringify(b);for(const s of [...Object.values(MOCK_ENV).filter(s=>s!=='personal-private-test'),OTHER,'test-A','test-B'])assert.ok(!serialized.includes(s));
  assert.doesNotMatch(serialized,/PRIVATE_|Bearer|Authorization|workspaceId|botId|parentId|pageUrl|notion\.so|SUPABASE_|PPLUS_NOTION_/);
  return b;
}
async function notConsumed(dir) {await assert.rejects(readdir(dir),e=>e.code==='ENOENT');}

test('NB013D: authenticated owner -> matching server target -> atomic consumption -> two synthetic GETs',async t=>{
  const dir=await directory(t), f=fixture({dir});const b=await safe(await f.handler(request()),200);
  assert.equal(b.approvedUser,true);assert.equal(b.mockTargetReadVerified,true);assert.equal(b.simulatedGets,2);assert.equal(b.target.botMatched,true);
  assert.equal(f.calls.length,1);assert.equal((await readdir(dir)).length,1);
});
for(const [token,status,code]of [[null,401,'auth_required'],['bad',401,'invalid_session'],['test-B',403,'test_user_not_allowed']])
test(`NB013D: ${code} cannot read Notion credentials or consume approval`,async t=>{
  const dir=await directory(t),env={...ENV};let reads=0;Object.defineProperty(env,'PPLUS_NOTION_TEST_TOKEN',{get(){reads++;throw Error('PRIVATE_TOKEN');}});
  const f=fixture({env,dir});await safe(await f.handler(request({token})),status,code);assert.equal(reads,0);await notConsumed(dir);
});
test('NB013D: email, admin role and user_metadata spoofing cannot authorize another UUID',async t=>{
  const dir=await directory(t),f=fixture({dir});await safe(await f.handler(request({token:'test-B'})),403,'test_user_not_allowed');await notConsumed(dir);
});
for(const [kind,status,code]of [['anonymous',401,'invalid_session'],['missing_id',401,'invalid_session'],['auth_503',502,'auth_unavailable'],['throw',502,'upstream_unavailable']])
test(`NB013D: ${kind} auth failure is closed before target credentials`,async t=>{
  const dir=await directory(t),env={...ENV};Object.defineProperty(env,'PPLUS_NOTION_TEST_TOKEN',{get(){throw Error('PRIVATE_TOKEN');}});
  const f=fixture({dir,env,auth:async()=>{if(kind==='throw')throw Error('PRIVATE_AUTH');return Response.json(kind==='anonymous'?{id:USER,is_anonymous:true}:kind==='missing_id'?{}:{message:'PRIVATE_AUTH'},{status:kind==='auth_503'?503:200});}});
  await safe(await f.handler(request()),status,code);await notConsumed(dir);
});
for(const field of ['userId','workspaceId','botId','parentId','scope','policy'])test(`NB013D: mismatched approved ${field} blocks before credential access`,async t=>{
  const dir=await directory(t),env={...ENV},target={...TARGET,[field]:['scope','policy'].includes(field)?'WRONG':OTHER};let reads=0;
  Object.defineProperty(env,'PPLUS_NOTION_TEST_TOKEN',{get(){reads++;throw Error('PRIVATE_TOKEN');}});
  const f=fixture({dir,env,target});await safe(await f.handler(request()),403,'local_target_not_approved');assert.equal(reads,0);await notConsumed(dir);
});
test('NB013D: no approved target is fail-closed; historical metadata is never auto-loaded',async t=>{
  const dir=await directory(t),f=fixture({dir,target:null});await safe(await f.handler(request()),403,'local_target_not_approved');await notConsumed(dir);
});
test('NB013D: a non-synthetic approved user cannot make the mock interface read a credential',async t=>{
  const dir=await directory(t),env={...ENV,PPLUS_NOTION_TEST_USER_ID:OTHER};let reads=0;
  Object.defineProperty(env,'PPLUS_NOTION_TEST_TOKEN',{get(){reads++;throw Error('PRIVATE_TOKEN');}});
  const f=fixture({dir,env,target:{...TARGET,userId:OTHER}});await safe(await f.handler(request({token:'test-B'})),400,'synthetic_input_required');assert.equal(reads,0);await notConsumed(dir);
});
test('NB013D: auth is request-local on account change and denied requests cannot reuse earlier success',async t=>{
  const dir=await directory(t),f=fixture({dir});await safe(await f.handler(request()),200);
  await safe(await f.handler(request({token:'test-B'})),403,'test_user_not_allowed');
  await safe(await f.handler(request({token:'bad'})),401,'invalid_session');
  await safe(await f.handler(request({token:null})),401,'auth_required');
  await safe(await f.handler(request()),409,'local_approval_already_consumed');assert.equal(f.calls.length,4);
});
test('NB013D: concurrent auth results do not mix user/token between requests',async t=>{
  const dir=await directory(t),f=fixture({dir});const results=await Promise.all([f.handler(request()),f.handler(request({token:'test-B'}))]);
  await safe(results[0],200);await safe(results[1],403,'test_user_not_allowed');assert.equal(f.calls.length,2);
});
test('NB013D: logout/abort during a late successful Auth response denies credentials and consumption',async t=>{
  const dir=await directory(t),abort=new AbortController();let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const env={...ENV};let reads=0;Object.defineProperty(env,'PPLUS_NOTION_TEST_TOKEN',{get(){reads++;throw Error('PRIVATE_TOKEN');}});
  const f=fixture({dir,env,auth:async()=>{started();await wait;return Response.json({id:USER});}});
  const pending=f.handler(request({signal:abort.signal}));await ready;abort.abort();release();await safe(await pending,401,'invalid_session');assert.equal(reads,0);await notConsumed(dir);
});
for(const [scenario,count]of [['first_failure',1],['bot_mismatch',1],['workspace_mismatch',1],['parent_mismatch',2],['timeout',1],['response_lost',1]])
test(`NB013D: ${scenario} cannot retry; consumed record persists`,async t=>{
  const dir=await directory(t),f=fixture({dir,scenario});const b=await safe(await f.handler(request()),422);assert.equal(b.simulatedGets,count);assert.equal(b.mockTargetReadVerified,false);
  await safe(await f.handler(request()),409,'local_approval_already_consumed');assert.equal((await readdir(dir)).length,1);
});
for(const field of ['user_id','approved','parentId','url','runId'])test(`NB013D: client ${field} cannot choose identity/approval/target`,async t=>{
  const dir=await directory(t),f=fixture({dir});await safe(await f.handler(request({body:{[field]:USER}})),400,'invalid_test_request');assert.equal(f.calls.length,0);await notConsumed(dir);
});
test('NB013D: mock interface is closed by default; live/adapter injection cannot activate it',async()=>{
  let calls=0;const authFetch=async()=>{calls++;throw Error('PRIVATE_AUTH');};
  for(const mode of [undefined,'live'])await safe(await createAuthenticatedMockHandler({env:ENV,authFetch,mode})(request()),503,'local_mock_only');
  assert.throws(()=>createAuthenticatedMockHandler({notionFetch:async()=>{}}),e=>e.code==='local_mock_only');assert.equal(calls,0);
});
test('NB013D: wrong method, route and external origin never reach auth',async t=>{
  const dir=await directory(t),f=fixture({dir});
  await safe(await f.handler(request({method:'GET'})),405,'method_not_allowed');
  await safe(await f.handler(request({url:'https://remote.invalid'+TARGET_PATH})),404,'route_not_found');
  await safe(await f.handler(request({origin:'https://evil.invalid'})),403,'origin_not_allowed');assert.equal(f.calls.length,0);await notConsumed(dir);
});
test('NB013D: common auth helper returns only server-verified UUID and rechecks each bearer',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return Response.json({id:USER,email:'PRIVATE_EMAIL',app_metadata:{pplus_role:'admin'},user_metadata:{user_id:OTHER}});};
  for(let i=0;i<2;i++)assert.deepEqual(await authenticateTestUser({request:request(),env:ENV,fetchImpl}),{id:USER});assert.equal(calls,2);
});
test('NB013D: two OS processes pass Auth but only one can consume the same approval',async t=>{
  const dir=await directory(t),module=new URL('../../notion-local/authenticated-once.mjs',import.meta.url).href;
  const code=`import {createAuthenticatedMockHandler} from ${JSON.stringify(module)};const options=${JSON.stringify({env:ENV,approvedTarget:TARGET,mode:'mock'})};options.directory=process.argv[1];options.authFetch=async()=>Response.json({id:options.env.PPLUS_NOTION_TEST_USER_ID});const handler=createAuthenticatedMockHandler(options);const r=await handler(new Request('http://127.0.0.1/api/notion/test-target/review',{method:'POST',headers:{Authorization:'Bearer SYNTHETIC','Content-Type':'application/json'},body:'{}'}));const v=await r.json();console.log(JSON.stringify({status:r.status,count:v.simulatedGets,error:v.error?.code}));`;
  const child=()=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',code,dir],{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('error',reject);p.once('close',exit=>resolve({exit,out,err}));});
  const results=await Promise.all([child(),child()]);assert.ok(results.every(r=>r.exit===0&&!r.err));const states=results.map(r=>JSON.parse(r.out));assert.deepEqual(states.map(v=>v.status).sort(),[200,409]);assert.equal(states.reduce((n,v)=>n+v.count,0),2);
});
for(const mode of ['same-user-new-token','different-user','logout'])test(`NB013D UI: late ${mode} response cannot restore previous connection state`,async()=>{
  let session={user:{id:USER},access_token:'SYNTHETIC_OLD'},release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r),states=[];
  const getSession=async()=>({data:{session}});
  const controller=createConnectionController({getSession,onChange:s=>states.push(s),fetchImpl:async()=>{started();await wait;return Response.json({connectionStatus:'configured',remoteReadEnabled:false,targetReadVerified:false,webExecutionReady:false,notionExecution:'not_executed',notionWrites:0,supabaseWrites:0,creationPermissionVerified:false,privacyVerified:false});}});
  const pending=controller.check();await ready;
  if(mode==='same-user-new-token')session.access_token='SYNTHETIC_NEW';
  else session=mode==='logout'?null:{user:{id:OTHER},access_token:'SYNTHETIC_NEW'};
  release();await pending;
  assert.equal(states.at(-1).status,'cleared');assert.ok(!states.some(s=>['configured','read_verified'].includes(s.status)));controller.dispose();
});
test('NB013D: deployment entries stay closed, private auth wrapper is never published/mounted',async()=>{
  for(const p of ['api/notion/test-connection.mjs','api/notion/test-target/review.mjs'])assert.doesNotMatch(await readFile(new URL('../../../'+p,import.meta.url),'utf8'),/allowNotionNetwork|notionFetch|authenticated-once/);
  const wrapper=await readFile(new URL('../../notion-local/authenticated-once.mjs',import.meta.url),'utf8');assert.doesNotMatch(wrapper,/process\.env|fetch\(/);
  assert.ok(!PUBLIC_FILES.some(p=>/test-auth|authenticated-once|notion-local/.test(p)));assert.equal(PUBLIC_FILES.length,32);
});
