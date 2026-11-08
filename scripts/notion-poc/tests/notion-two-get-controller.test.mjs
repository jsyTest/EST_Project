import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,lstat,open,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createTwoGetController} from '../../notion-local/two-get-controller.mjs';
import {packageDigest,sourceDigest,computeCodeDigest,validateReviewedReadPackage} from '../../notion-local/two-get-package.mjs';
import {consumeLocalApproval,LOCAL_READ_POLICY} from '../../notion-local/approval.mjs';
import {promptApprovedNotionToken} from '../../notion-local/two-get-secret.mjs';
import {mountLocalTwoGet} from '../../notion-local/two-get-browser.mjs';
import {createTestNotionReader} from '../../../server/notion/test-readonly.mjs';
import {NOTION_VERSION} from '../../../js/planner/catalog.mjs';

const U='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222',
  B='33333333-3333-4333-8333-333333333333',P='44444444-4444-4444-8444-444444444444',D='55555555-5555-4555-8555-555555555555';
const OTHER='99999999-9999-4999-8999-999999999999',ORIGIN='http://127.0.0.1:8796',NOW=1900000000000;
const ENV={SUPABASE_URL:'https://synthetic-two-get.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC'};
const SECRET='SYNTHETIC_TOKEN_NOT_A_REAL_CREDENTIAL';
const CODE=await computeCodeDigest();
function pkg(){return {version:1,userId:U,workspaceId:W,botId:B,parentId:P,draftId:D,scope:'personal-private-test',policy:LOCAL_READ_POLICY,
  apiVersion:NOTION_VERSION,origin:ORIGIN,codeDigest:CODE,sdkDigest:sourceDigest('SYNTHETIC SDK'),supabaseOrigin:ENV.SUPABASE_URL,
  publishableKeyDigest:sourceDigest(ENV.SUPABASE_PUBLISHABLE_KEY),expiresAt:NOW+240000,credentialKind:'internal-connection',
  acceptBroaderPermissions:true,evidence:'NB-V2-013F-G'};}
const receipt=p=>({version:1,approved:true,packageDigest:packageDigest(p),codeDigest:CODE,expiresAt:NOW+200000,approvalRef:'approval-synthetic'});
function req({signal,body='{}',headers={},method='POST',url=ORIGIN+'/__local/notion-2get/review'}={}){
  return new Request(url,{method,signal,headers:{Host:'127.0.0.1:8796',Origin:ORIGIN,Authorization:'Bearer SYNTHETIC_SESSION','Content-Type':'application/json',...headers},body});}
const self=()=>({object:'user',id:B,type:'bot',bot:{workspace_id:W,owner:{type:'workspace',workspace:true}}});
const page=()=>({object:'page',id:P,archived:false,in_trash:false,is_locked:false,public_url:null,parent:{type:'workspace',workspace:true}});
async function fixture(t,overrides={}){
  const root=await mkdtemp(join(tmpdir(),'nb013i-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'claims'),p=pkg(),r=receipt(p),events=[];
  const counters={auth:0,draft:0,secret:0,notion:0};
  const authFetch=async(address,options)=>{
    const url=new URL(address);assert.equal(url.origin,ENV.SUPABASE_URL);assert.equal(options.method,'GET');
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    if(url.pathname==='/auth/v1/user'){
      counters.auth++;events.push('auth');return Response.json({id:U});
    }
    assert.equal(url.pathname,'/rest/v1/education_drafts');assert.equal(url.searchParams.get('id'),'eq.'+D);
    assert.equal(url.searchParams.get('user_id'),'eq.'+U);counters.draft++;events.push('draft');return Response.json([{id:D,user_id:U}]);
  };
  const notionFetch=async(address,options)=>{
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert.equal(options.headers.Authorization,'Bearer '+SECRET);
    counters.notion++;events.push('notion');return Response.json(address.endsWith('/me')?self():page());
  };
  const getToken=async()=>{
    counters.secret++;events.push('secret');assert.equal((await readdir(directory)).length,1);return SECRET;
  };
  const options={mode:'approved-local',reviewPackage:p,receipt:r,directory,baseEnv:ENV,authFetch,notionFetch,getToken,
    now:()=>NOW,digestProvider:async()=>CODE,consume:async o=>{events.push('consume');return consumeLocalApproval(o);},...overrides};
  return {root,directory,p,r,events,counters,options,controller:createTwoGetController(options)};
}
async function safe(response,status,code){
  assert.equal(response.status,status);const b=await response.json();if(code)assert.equal(b.error.code,code);
  assert.equal(b.webExecutionReady,false);assert.equal(b.notionWrites,0);assert.equal(b.supabaseWrites,0);
  assert.equal(b.privacyVerified,false);assert.equal(b.creationPermissionVerified,false);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  for(const value of [U,W,B,P,D,SECRET,'SYNTHETIC_SESSION','PRIVATE_'])assert.ok(!JSON.stringify(b).includes(value));return b;
}
test('NB013I: complete injected-adapter flow authenticates twice, consumes before input, limits two GETs',async t=>{
  const f=await fixture(t),b=await safe(await f.controller.review(req()),200);
  assert.deepEqual(f.counters,{auth:4,draft:2,secret:1,notion:2});assert.equal(b.notionDispatches,2);assert.equal(b.supabaseGets,6);
  assert.equal(b.validationMode,'simulation');assert.equal(b.targetReadVerified,false);assert.equal(b.mockTargetReadVerified,true);
  assert.ok(f.events.indexOf('consume')<f.events.indexOf('secret'));assert.ok(f.events.lastIndexOf('draft')<f.events.indexOf('notion'));
  const record=await readFile(join(f.directory,(await readdir(f.directory))[0]),'utf8');assert.match(record,/'?packageDigest/);
  assert.ok(!record.includes(U)&&!record.includes(SECRET));await safe(await f.controller.review(req()),409,'local_already_attempted');
});
test('NB013I: default blocked ignores ambient-looking configuration and never inspects credentials',async()=>{
  let calls=0;const f=()=>{calls++;throw Error('PRIVATE_');};
  const controller=createTwoGetController({baseEnv:new Proxy({},{get:f}),authFetch:f,notionFetch:f,getToken:f,digestProvider:f});
  await safe(await controller.review(req()),503,'local_execution_blocked');assert.equal(calls,0);
});
for(const field of ['userId','workspaceId','botId','parentId','draftId','policy','codeDigest','sdkDigest','origin','credentialKind','acceptBroaderPermissions','expiresAt'])
test(`NB013I: tampered ${field} fails before Auth, consumption, input and dispatch`,async t=>{
  const f=await fixture(t);f.p[field]=field==='expiresAt'?NOW-1:field==='acceptBroaderPermissions'?false:'invalid';
  await f.controller.review(req());assert.deepEqual(f.counters,{auth:0,draft:0,secret:0,notion:0});await assert.rejects(readdir(f.directory));
});
for(const value of [undefined,{}, {approved:true}])test(`NB013I: absent or forged receipt cannot authorize input (${JSON.stringify(value)})`,async t=>{
  const f=await fixture(t,{receipt:value});await f.controller.review(req());assert.equal(f.counters.auth,0);assert.equal(f.counters.secret,0);
});
test('NB013I: canonical digest ignores key order, rejects extra/accessor fields, code digest binds dependencies',async()=>{
  const p=pkg(),r=receipt(p);assert.equal(packageDigest(p),packageDigest(Object.fromEntries(Object.entries(p).reverse())));
  assert.equal(await computeCodeDigest(),CODE);
  assert.throws(()=>validateReviewedReadPackage({reviewPackage:{...p,approved:true},receipt:r,codeDigest:CODE,now:NOW}));
  let reads=0;const bad={...p};Object.defineProperty(bad,'userId',{enumerable:true,get(){reads++;return U;}});
  assert.throws(()=>validateReviewedReadPackage({reviewPackage:bad,receipt:r,codeDigest:CODE,now:NOW}));assert.equal(reads,0);
});
for(const kind of ['expired','anonymous','other-admin','wrong-owner','checkpoint-user-switch'])test(`NB013I: ${kind} denies before secret or Notion`,async t=>{
  let n=0;const f=await fixture(t,{authFetch:async address=>{
    if(new URL(address).pathname==='/auth/v1/user')return Response.json({id:(kind==='other-admin'||kind==='checkpoint-user-switch'&&++n===2)?OTHER:U,
      is_anonymous:kind==='anonymous',app_metadata:{pplus_role:'admin'},user_metadata:{user_id:U}},{status:kind==='expired'?401:200});
    return Response.json([{id:D,user_id:kind==='wrong-owner'?OTHER:U}]);
  }});const response=await f.controller.review(req());assert.notEqual(response.status,200);assert.equal(f.counters.secret,0);assert.equal(f.counters.notion,0);
});
for(const body of ['{"approved":true}','{"userId":"x"}','{"draftId":"x"}','[]','null','{',' '.repeat(257)])
test(`NB013I: body injection/size rejected (${body.length})`,async t=>{
  const f=await fixture(t);await f.controller.review(req({body}));assert.equal(f.counters.auth,0);assert.equal(f.counters.secret,0);
});
for(const stage of ['mkdir','open','write','file-sync','directory-sync'])test(`NB013I: actual store ${stage} failure leaves secret/dispatch zero`,async t=>{
  const io={mkdir:async(...args)=>{if(stage==='mkdir')throw Error('PRIVATE_DISK');return mkdir(...args);},lstat,
    open:async(...args)=>{
      const record=String(args[0]).endsWith('.consumed');if(stage==='open'&&record)throw Error('PRIVATE_DISK');
      const h=await open(...args);return {stat:()=>h.stat(),close:()=>h.close(),writeFile:async(...a)=>{if(stage==='write')throw Error('PRIVATE_DISK');return h.writeFile(...a);},
        sync:async()=>{if(stage===(record?'file-sync':'directory-sync'))throw Error('PRIVATE_DISK');return h.sync();}};
    }};
  const f=await fixture(t,{consume:o=>consumeLocalApproval({...o,io})});
  await safe(await f.controller.review(req()),503,'local_approval_store_failed');assert.equal(f.counters.secret,0);assert.equal(f.counters.notion,0);
  if(['write','file-sync','directory-sync'].includes(stage))assert.equal((await readdir(f.directory)).length,1);
});
test('NB013I: new controller / changed receipt cannot bypass stable consumed scope',async t=>{
  const f=await fixture(t);await safe(await f.controller.review(req()),200);
  f.r.approvalRef='approval-new';f.r.expiresAt-=1;
  await safe(await createTwoGetController(f.options).review(req()),409,'local_approval_already_consumed');assert.equal(f.counters.secret,1);
});
test('NB013I: concurrent controller instances share one OS claim and only one input / two dispatches',async t=>{
  const f=await fixture(t);const responses=await Promise.all([f.controller.review(req()),createTwoGetController(f.options).review(req())]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.counters.secret,1);assert.equal(f.counters.notion,2);
});
for(const shape of ['missing-owner','person-owner','wrong-workspace','wrong-bot','contradictory','invalid-json','oversized','401','429','503','lost'])
test(`NB013I: identity / first response ${shape} never dispatches parent`,async t=>{
  let calls=0;const f=await fixture(t,{notionFetch:async()=>{
    calls++;if(shape==='lost')throw Error('PRIVATE_UPSTREAM');
    if(/^\d+$/.test(shape))return Response.json({secret:'PRIVATE_UPSTREAM'},{status:Number(shape)});
    if(shape==='invalid-json')return new Response('{');if(shape==='oversized')return new Response('x'.repeat(131073));
    const s=self();if(shape==='missing-owner')delete s.bot.owner;if(shape==='person-owner')s.bot.owner={type:'user',user:{id:U}};
    if(shape==='wrong-workspace')s.bot.workspace_id=OTHER;if(shape==='wrong-bot')s.id=OTHER;
    if(shape==='contradictory')s.bot.owner.user={id:U};return Response.json(s);
  }});const r=await f.controller.review(req()),b=await r.json();assert.notEqual(r.status,200);assert.equal(calls,1);assert.equal(b.notionDispatches,1);
  assert.ok(!JSON.stringify(b).includes('PRIVATE_'));assert.equal((await readdir(f.directory)).length,1);
});
for(const field of ['archived','in_trash','is_locked','public_url'])test(`NB013I: unsuitable parent ${field} is not corrected or retried`,async t=>{
  let calls=0;const f=await fixture(t,{notionFetch:async()=>Response.json(++calls===1?self():{...page(),[field]:field==='public_url'?'https://private.invalid':true})});
  const r=await f.controller.review(req());assert.notEqual(r.status,200);assert.equal(calls,2);assert.equal((await readdir(f.directory)).length,1);
});
test('NB013I: cancellation during secret wait, late secret, and new attempt preserve tombstone',async t=>{
  let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const f=await fixture(t,{getToken:async()=>{started();await wait;return SECRET;}}),abort=new AbortController();
  const pending=f.controller.review(req({signal:abort.signal}));await ready;abort.abort();const r=await pending;
  await safe(r,408,'local_cancelled');release();assert.equal(f.counters.notion,0);assert.equal((await readdir(f.directory)).length,1);
});
test('NB013I: same process busy does not consume twice',async t=>{
  let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const f=await fixture(t,{getToken:async()=>{started();await wait;return SECRET;}});const pending=f.controller.review(req());await ready;
  await safe(await f.controller.review(req()),409,'local_busy');release();await safe(await pending,200);
});
test('NB013I: expiry / reviewed code change during input prevents any Notion request',async t=>{
  let clock=NOW,code=CODE;const f=await fixture(t,{now:()=>clock,digestProvider:async()=>code,getToken:async()=>{clock+=300000;code='a'.repeat(64);return SECRET;}});
  const r=await f.controller.review(req());assert.notEqual(r.status,200);assert.equal(f.counters.notion,0);assert.equal((await readdir(f.directory)).length,1);
});
test('NB013I: overall deadline cancels ignoring adapters without waiting for their resolution',async t=>{
  let expire,started;const ready=new Promise(r=>started=r);let calls=0;
  const f=await fixture(t,{setTimer:cb=>{expire=cb;return 1;},clearTimer:()=>{},authFetch:async()=>{calls++;started();return new Promise(()=>{});}});
  const pending=f.controller.review(req());await ready;expire();const r=await pending;assert.equal((await r.json()).error.code,'local_deadline');assert.equal(calls,1);
});
for(const stop of ['cancel','code-change','expiry','throw'])test(`NB013I: ${stop} after first dispatch cannot cause a parent request`,async t=>{
  const abort=new AbortController();let code=CODE,clock=NOW,calls=0;
  const f=await fixture(t,{digestProvider:async()=>code,now:()=>clock,notionFetch:async()=>{
    calls++;if(stop==='cancel')abort.abort();if(stop==='code-change')code='a'.repeat(64);if(stop==='expiry')clock+=300000;
    if(stop==='throw')throw Error('PRIVATE_RESPONSE_LOST');return Response.json(self());
  }});
  const r=await f.controller.review(req({signal:abort.signal}));assert.notEqual(r.status,200);assert.equal(calls,1);
  assert.equal((await readdir(f.directory)).length,1);assert.equal(f.counters.secret,1);
});
test('NB013I: revoked server session after input retains consumption and sends zero Notion requests',async t=>{
  let auth=0;const f=await fixture(t,{authFetch:async url=>{
    if(new URL(url).pathname==='/auth/v1/user')return Response.json({id:U},{status:++auth===3?401:200});
    return Response.json([{id:D,user_id:U}]);
  }});
  await safe(await f.controller.review(req()),401,'invalid_session');assert.equal(f.counters.secret,1);assert.equal(f.counters.notion,0);assert.equal((await readdir(f.directory)).length,1);
});
test('NB013I: abort while reading first response body cancels stream and never reaches parent',async t=>{
  let ready,cancelled=false,calls=0;const started=new Promise(r=>ready=r),abort=new AbortController();
  const f=await fixture(t,{notionFetch:async()=>{calls++;return new Response(new ReadableStream({pull(){ready();},cancel(){cancelled=true;}},{highWaterMark:0}));}});
  const pending=f.controller.review(req({signal:abort.signal}));await started;abort.abort();await safe(await pending,408,'local_cancelled');
  await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(cancelled,true);assert.equal((await readdir(f.directory)).length,1);
});
test('NB013I: legacy reader keeps default shape compatibility; strict reader requires workspace owner',async()=>{
  for(const strict of [false,true]){
    let calls=0;const reader=createTestNotionReader({configuration:{workspaceId:W,botId:B,parentId:P,token:SECRET},allowNetwork:true,strictInternalIdentity:strict,
      fetchImpl:async()=>{calls++;const s=self();delete s.bot.owner;return Response.json(calls===1?s:page());}});
    if(strict)await assert.rejects(reader.reviewTarget(),e=>e.code==='notion_internal_identity_unconfirmed');else await reader.reviewTarget();assert.equal(calls,strict?1:2);
  }
});
test('NB013I: shared budget reserves before dispatch, rejects third/redirect/writes/other parent',async t=>{
  const f=await fixture(t),configuration={workspaceId:W,botId:B,parentId:P};
  const budget=await consumeLocalApproval({directory:f.directory,userId:U,configuration});let calls=0;
  const go=budget.wrap(async()=>{calls++;return Response.json({});});
  const options={method:'GET',redirect:'error'};
  for(const [url,o]of [['https://evil.invalid',options],['https://api.notion.com/v1/users/me',{method:'POST',redirect:'error'}],
    ['https://api.notion.com/v1/users/me',{method:'GET',redirect:'follow'}]])await assert.rejects(go(url,o));
  await go('https://api.notion.com/v1/users/me',options);await assert.rejects(go('https://api.notion.com/v1/pages/'+OTHER,options));
  await go('https://api.notion.com/v1/pages/'+P,options);await assert.rejects(go('https://api.notion.com/v1/users/me',options));assert.equal(calls,2);
});

function tty(){const input=new PassThrough(),output={isTTY:true,text:'',write(s){this.text+=s;}},signals=new EventEmitter();
  input.isTTY=true;input.isRaw=false;input.setRawMode=v=>{input.isRaw=v;};return {input,output,signals};}
for(const end of ['success','ctrl-c','abort','timeout','end','error','non-ascii'])test(`NB013I TTY: ${end} never echoes input and restores listeners`,async()=>{
  const f=tty(),abort=new AbortController();let timeout;
  const pending=promptApprovedNotionToken({...f,signal:abort.signal,authorization:{approved:true,consumed:true},setTimer:cb=>{timeout=cb;return 1;},clearTimer:()=>{}});
  const caught=pending.then(value=>({value}),error=>({error}));
  if(end==='success')f.input.write(SECRET+'\r');if(end==='ctrl-c')f.input.write('\x03');if(end==='abort')abort.abort();if(end==='timeout')timeout();
  if(end==='end')f.input.end();if(end==='error')f.input.emit('error',Error('PRIVATE_TTY'));if(end==='non-ascii')f.input.write('비밀');
  const result=await caught;if(end==='success')assert.equal(result.value,SECRET);else assert.ok(result.error);
  assert.ok(!f.output.text.includes(SECRET)&&!f.output.text.includes('PRIVATE_'));assert.equal(f.input.isRaw,false);
  assert.equal(f.input.listenerCount('data'),0);assert.equal(f.signals.eventNames().length,0);
});
test('NB013I TTY: no authorization / non-TTY never prompts',()=>{
  const f=tty();assert.throws(()=>promptApprovedNotionToken(f));assert.equal(f.output.text,'');
  f.input.isTTY=false;assert.throws(()=>promptApprovedNotionToken({...f,authorization:{approved:true,consumed:true}}));assert.equal(f.output.text,'');
});
function browserFixture(){
  const win=new EventTarget(),runButton=new EventTarget(),cancelButton=new EventTarget(),output={textContent:''};
  let change,session={user:{id:U},access_token:'SYNTHETIC_SESSION'},release,started,unsubscribed=0;
  const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);
  const sdk={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>{change=fn;return {data:{subscription:{unsubscribe(){unsubscribed++;}}}};}}};
  const value={webExecutionReady:false,notionExecution:'not_executed',notionWrites:0,supabaseWrites:0,privacyVerified:false,creationPermissionVerified:false,
    serverAuthVerified:true,draftOwnerVerified:true,notionDispatches:2,validationMode:'simulation',target:{botMatched:true,workspaceMatched:true,parentMatched:true}};
  const controller=mountLocalTwoGet({sdk,output,runButton,cancelButton,win,fetchImpl:async(_p,o)=>{assert.equal(o.method,'POST');assert.equal(o.body,'{}');started();await wait;return Response.json(value);}});
  return {controller,ready,release,output,win,runButton,change:e=>change(e),rotate(){session.access_token='SYNTHETIC_NEW';},logout(){session=null;},value,unsubscribed:()=>unsubscribed};
}
for(const kind of ['success','token-event','token-no-event','logout','pagehide','explicit-cancel','bad-response'])test(`NB013I browser: ${kind} safely fences results`,async()=>{
  const f=browserFixture(),pending=f.controller.review();await f.ready;
  if(kind==='token-event'){f.rotate();f.change('TOKEN_REFRESHED');}if(kind==='token-no-event')f.rotate();if(kind==='logout')f.logout();
  if(kind==='pagehide')f.win.dispatchEvent(new Event('pagehide'));if(kind==='explicit-cancel')f.controller.cancel();
  if(kind==='bad-response')f.value.target.parentMatched=false;
  f.release();await pending;
  if(kind==='success')assert.match(f.output.textContent,/가상 검사/);else assert.doesNotMatch(f.output.textContent,/마쳤습니다/);
  assert.ok(!f.output.textContent.includes('SYNTHETIC'));assert.ok(f.unsubscribed()>0);assert.equal(f.runButton.disabled,true);f.controller.dispose();
});
test('NB013I browser: cancellation returns and cleans listeners even when SDK never resolves',async()=>{
  let timeout,unsubscribed=0,gets=0;
  const output={textContent:''},win=new EventTarget(),runButton=new EventTarget(),cancelButton=new EventTarget();
  const sdk={auth:{getSession:()=>new Promise(()=>{}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){unsubscribed++;}}}})}};
  const f=mountLocalTwoGet({sdk,output,win,runButton,cancelButton,fetchImpl:async()=>{gets++;throw Error();},
    setTimer:cb=>{timeout=cb;return 1;},clearTimer:()=>{}});
  const pending=f.review();timeout();await pending;assert.equal(gets,0);assert.equal(unsubscribed,1);assert.match(output.textContent,/취소/);
});
test('NB013I: invalid audit descriptor fails before opening the local store',async()=>{
  let reads=0;const audit={codeDigest:CODE,approvalRef:'approval-synthetic'};
  Object.defineProperty(audit,'packageDigest',{enumerable:true,get(){reads++;return CODE;}});
  await assert.rejects(consumeLocalApproval({directory:'/synthetic-never-opened',userId:U,configuration:{workspaceId:W,botId:B,parentId:P},audit}),e=>e.code==='local_approval_invalid');assert.equal(reads,0);
});
