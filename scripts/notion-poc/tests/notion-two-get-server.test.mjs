import test from 'node:test';
import assert from 'node:assert/strict';
import {request,createServer} from 'node:http';
import {connect} from 'node:net';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startTwoGetServer} from '../../notion-local/two-get-server.mjs';
import {twoGetResponse,createTwoGetController} from '../../notion-local/two-get-controller.mjs';
import {sourceDigest,computeCodeDigest,packageDigest} from '../../notion-local/two-get-package.mjs';
import {LOCAL_READ_POLICY} from '../../notion-local/approval.mjs';
import {NOTION_VERSION} from '../../../js/planner/catalog.mjs';
import {PUBLIC_FILES} from '../../deployment/build-static.mjs';

// Only temporary loopback sockets and synthetic adapters are used. No fetch to remote hosts.
const ORIGIN='http://127.0.0.1:0',PAGE='/__local/notion-2get',SDK='/* SYNTHETIC SDK: no executable remote client */';
async function fixture(t,options={}){
  let reviews=0,cancels=0;
  const signals=new EventEmitter(),p={sdkDigest:sourceDigest(SDK),packageDigest:'synthetic',supabaseOrigin:'https://synthetic.supabase.co'};
  const controller={authorize:async()=>p,cancel(){cancels++;},get busy(){return false;},
    review:async()=>{reviews++;return twoGetResponse(200,{validationMode:'simulation'});},...options};
  const handle=await startTwoGetServer({controller,sdkSource:SDK,expectedOrigin:ORIGIN,signals});
  t.after(()=>handle.close());
  return {handle,p,controller,signals,reviews:()=>reviews,cancels:()=>cancels};
}
function send(f,{method='GET',path=PAGE,headers={},body}={}){
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:f.handle.address.port,method,path,
      headers:{Host:'127.0.0.1:0',Connection:'close',...(method==='POST'?{Origin:ORIGIN,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body??'{}')}:{}),...headers}},res=>{
      let data='';res.setEncoding('utf8');res.on('data',v=>data+=v);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,data}));
    });req.on('error',reject);req.end(body??(method==='POST'?'{}':undefined));
  });
}
test('NB013I server: importing/default start has no listener, unapproved startup stays closed',async()=>{
  await assert.rejects(startTwoGetServer(),/local_execution_blocked/);
  await assert.rejects(startTwoGetServer({controller:{authorize:async()=>({sdkDigest:sourceDigest(SDK)})}}),/local_sdk_invalid/);
  await assert.rejects(startTwoGetServer({controller:{authorize:async()=>{throw Error('blocked');}},sdkSource:SDK}),/blocked/);
});
test('NB013I public build: all five bridge modules remain outside the unchanged 32-file allowlist',()=>{
  assert.equal(PUBLIC_FILES.length,32);
  for(const file of ['server','controller','package','secret','browser'])assert.ok(!PUBLIC_FILES.includes('scripts/notion-local/two-get-'+file+'.mjs'));
});
test('NB013I server: only private runtime assets; local SDK hash and CSP enforce reviewed assets',async t=>{
  const f=await fixture(t);
  for(const path of [PAGE,PAGE+'/sdk.js',PAGE+'/client.js',PAGE+'/browser.mjs']){
    const r=await send(f,{path});assert.equal(r.status,200);assert.match(r.headers['cache-control'],/private, no-store/);
    assert.equal(r.headers['x-frame-options'],'DENY');assert.equal(r.headers['referrer-policy'],'no-referrer');
    assert.match(r.headers['content-security-policy'],/default-src 'none'/);assert.doesNotMatch(r.headers['content-security-policy'],/unsafe-inline|unsafe-eval|cdn/);
    if(path===PAGE){assert.match(r.data,/lang="ko"/);assert.doesNotMatch(r.data,/https:\/\//);}
    if(path.endsWith('/sdk.js'))assert.equal(r.data,SDK);
  }
  for(const path of ['/','/index.html','/.env','/api/notion/test-connection',PAGE+'?x=1',PAGE+'/review?x=1'])assert.notEqual((await send(f,{path})).status,200);
  assert.equal(f.reviews(),0);
});
for(const [name,headers]of [
  ['foreign-host',{Host:'evil.invalid'}],['localhost-alias',{Host:'localhost:0'}],['wrong-origin',{Origin:'https://evil.invalid'}],
  ['null-origin',{Origin:'null'}],['forwarded',{Forwarded:'for=127.0.0.1'}],['x-forwarded',{'X-Forwarded-Host':'127.0.0.1:0'}],
  ['cross-site',{'Sec-Fetch-Site':'cross-site'}]
])test(`NB013I server: ${name} never reaches controller`,async t=>{
  const f=await fixture(t),r=await send(f,{method:'POST',path:PAGE+'/review',headers});assert.equal(r.status,403);assert.equal(f.reviews(),0);
});
for(const body of ['{"approved":true}','{"token":"SYNTHETIC"}','[]','null','{','x'.repeat(257)])
test(`NB013I server: rejected body length ${body.length} is not accepted or echoed`,async t=>{
  const f=await fixture(t),r=await send(f,{method:'POST',path:PAGE+'/review',body});assert.equal(r.status,400);assert.equal(f.reviews(),0);assert.doesNotMatch(r.data,/SYNTHETIC/);
});
test('NB013I server: missing Origin/content type, foreign methods and forwarded GET stay closed',async t=>{
  const f=await fixture(t);
  for(const headers of [{'Content-Type':'text/plain'}]){
    assert.equal((await send(f,{method:'POST',path:PAGE+'/review',headers})).status,400);
  }
  assert.equal((await send(f,{method:'PUT',path:PAGE+'/review'})).status,404);
  assert.equal((await send(f,{headers:{'X-Forwarded-For':'127.0.0.1'}})).status,403);assert.equal(f.reviews(),0);
});
async function raw(f,text){return new Promise((resolve,reject)=>{
  const s=connect(f.handle.address.port,'127.0.0.1');let out='';s.on('connect',()=>s.end(text));s.on('data',v=>out+=v);s.on('error',reject);s.on('end',()=>resolve(out));
});}
test('NB013I server: duplicate Host / duplicate Origin / missing Origin / chunked requests fail before controller',async t=>{
  const f=await fixture(t);
  for(const headers of [
    'Host: 127.0.0.1:0\r\nHost: 127.0.0.1:0\r\nOrigin: '+ORIGIN+'\r\nContent-Length: 2',
    'Host: 127.0.0.1:0\r\nOrigin: '+ORIGIN+'\r\nOrigin: '+ORIGIN+'\r\nContent-Length: 2',
    'Host: 127.0.0.1:0\r\nContent-Length: 2',
    'Host: 127.0.0.1:0\r\nOrigin: '+ORIGIN+'\r\nTransfer-Encoding: chunked'
  ]){
    const r=await raw(f,'POST '+PAGE+'/review HTTP/1.1\r\n'+headers+'\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{}');
    assert.match(r,/HTTP\/1\.1 (400|403)/);
  }assert.equal(f.reviews(),0);
});
test('NB013I server: complete request body is not treated as disconnect; response closes one-shot server',async t=>{
  let body,signal;
  const f=await fixture(t,{review:async req=>{body=await req.text();signal=req.signal;assert.equal(signal.aborted,false);return twoGetResponse(200,{validationMode:'simulation'});}});
  const r=await send(f,{method:'POST',path:PAGE+'/review'});assert.equal(r.status,200);assert.equal(body,'{}');assert.equal(signal.aborted,false);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.handle.server.listening,false);assert.ok(f.cancels()>0);assert.equal(f.signals.eventNames().length,0);
});
test('NB013I server: disconnect after complete body aborts the in-flight review',async t=>{
  let ready,aborted;const started=new Promise(r=>ready=r),done=new Promise(r=>aborted=r);
  const f=await fixture(t,{review:async req=>{ready();await new Promise(r=>req.signal.addEventListener('abort',r,{once:true}));aborted();return twoGetResponse(408);}});
  const s=connect(f.handle.address.port,'127.0.0.1');s.on('error',()=>{});
  await new Promise(r=>s.once('connect',r));s.write('POST '+PAGE+'/review HTTP/1.1\r\nHost: 127.0.0.1:0\r\nOrigin: '+ORIGIN+'\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}');
  await started;s.destroy();await done;assert.ok(f.cancels()>=0);
});
test('NB013I server: busy requests do not enter the controller or close active work',async t=>{
  const f=await fixture(t,{busy:true});const r=await send(f,{method:'POST',path:PAGE+'/review'});
  assert.equal(r.status,409);assert.equal(f.reviews(),0);assert.equal(f.handle.server.listening,true);
});
test('NB013I server: occupied port is left intact and no alternate listener is created',async t=>{
  const existing=createServer((_q,s)=>s.end('synthetic existing server'));await new Promise(r=>existing.listen(0,'127.0.0.1',r));t.after(()=>existing.close());
  const p={sdkDigest:sourceDigest(SDK)};
  await assert.rejects(startTwoGetServer({controller:{authorize:async()=>p,cancel(){}},sdkSource:SDK,
    expectedOrigin:'http://127.0.0.1:'+existing.address().port,signals:new EventEmitter()}),/local_port_unavailable/);
  assert.equal(existing.listening,true);
});
test('NB013I HTTP integration: empty POST reaches fresh Auth / owner / consumption / input / two GETs then stops',async t=>{
  const root=await mkdtemp(join(tmpdir(),'nb013i-http-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const ids=[1,2,3,4,5].map(n=>String(n).repeat(8)+'-'+String(n).repeat(4)+'-4'+String(n).repeat(3)+'-8'+String(n).repeat(3)+'-'+String(n).repeat(12)),[u,w,b,p,d]=ids;
  const code=await computeCodeDigest(),now=1900000000000,key='sb_publishable_SYNTHETIC',host='https://synthetic.supabase.co',events=[];
  const pkg={version:1,userId:u,workspaceId:w,botId:b,parentId:p,draftId:d,scope:'personal-private-test',policy:LOCAL_READ_POLICY,
    apiVersion:NOTION_VERSION,origin:ORIGIN,codeDigest:code,sdkDigest:sourceDigest(SDK),supabaseOrigin:host,publishableKeyDigest:sourceDigest(key),
    expiresAt:now+60000,credentialKind:'internal-connection',acceptBroaderPermissions:true,evidence:'NB-V2-013F-G'};
  const receipt={version:1,approved:true,packageDigest:packageDigest(pkg),codeDigest:code,expiresAt:pkg.expiresAt,approvalRef:'approval-synthetic'};
  const controller=createTwoGetController({mode:'approved-local',reviewPackage:pkg,receipt,directory:join(root,'claims'),expectedOrigin:ORIGIN,
    baseEnv:{SUPABASE_URL:host,SUPABASE_PUBLISHABLE_KEY:key},now:()=>now,
    authFetch:async url=>{const auth=new URL(url).pathname==='/auth/v1/user';events.push(auth?'auth':'draft');return Response.json(auth?{id:u}:[{id:d,user_id:u}]);},
    getToken:async()=>{assert.equal((await readdir(join(root,'claims'))).length,1);events.push('input');return 'SYNTHETIC_TOKEN_ONLY_NOT_REAL';},
    notionFetch:async url=>{events.push('notion');return Response.json(url.endsWith('/me')?{object:'user',id:b,type:'bot',bot:{workspace_id:w,owner:{type:'workspace',workspace:true}}}:
      {object:'page',id:p,archived:false,in_trash:false,is_locked:false,public_url:null,parent:{type:'workspace',workspace:true}});}});
  const handle=await startTwoGetServer({controller,sdkSource:SDK,expectedOrigin:ORIGIN,signals:new EventEmitter()});t.after(()=>handle.close());
  const r=await send({handle},{method:'POST',path:PAGE+'/review',headers:{Authorization:'Bearer SYNTHETIC_SESSION'}}),value=JSON.parse(r.data);
  assert.equal(r.status,200);assert.equal(value.mockTargetReadVerified,true);assert.equal(value.targetReadVerified,false);assert.equal(value.notionDispatches,2);assert.equal(value.supabaseGets,6);
  assert.deepEqual(events,['auth','auth','draft','input','auth','auth','draft','notion','notion']);
  for(const id of ids)assert.ok(!r.data.includes(id));assert.doesNotMatch(r.data,/SYNTHETIC/);assert.equal(handle.server.listening,false);
});
function child(code,args=[]){return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,['--input-type=module','-e',code,...args],{stdio:['ignore','pipe','pipe']});let out='',err='';
  p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.on('error',reject);p.on('close',status=>status===0?resolve(JSON.parse(out)):reject(Error('synthetic child failed: '+status+' '+err)));
});}
test('NB013I process: two independent controllers share stable O_EXCL consumption',async t=>{
  const root=await mkdtemp(join(tmpdir(),'nb013i-process-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const controllerURL=new URL('../../notion-local/two-get-controller.mjs',import.meta.url).href,
    packageURL=new URL('../../notion-local/two-get-package.mjs',import.meta.url).href,
    approvalURL=new URL('../../notion-local/approval.mjs',import.meta.url).href,
    catalogURL=new URL('../../../js/planner/catalog.mjs',import.meta.url).href;
  const code=`import {createTwoGetController} from ${JSON.stringify(controllerURL)};
import {computeCodeDigest,sourceDigest,packageDigest} from ${JSON.stringify(packageURL)};
import {LOCAL_READ_POLICY} from ${JSON.stringify(approvalURL)};import {NOTION_VERSION} from ${JSON.stringify(catalogURL)};
const ids=[1,2,3,4,5].map(n=>String(n).repeat(8)+'-'+String(n).repeat(4)+'-4'+String(n).repeat(3)+'-8'+String(n).repeat(3)+'-'+String(n).repeat(12));
const [u,w,b,p,d]=ids,c=await computeCodeDigest(),origin='http://127.0.0.1:8796',key='sb_publishable_SYNTHETIC',host='https://synthetic.supabase.co';
const pkg={version:1,userId:u,workspaceId:w,botId:b,parentId:p,draftId:d,scope:'personal-private-test',policy:LOCAL_READ_POLICY,apiVersion:NOTION_VERSION,origin,codeDigest:c,sdkDigest:sourceDigest('synthetic'),supabaseOrigin:host,publishableKeyDigest:sourceDigest(key),expiresAt:Date.now()+60000,credentialKind:'internal-connection',acceptBroaderPermissions:true,evidence:'NB-V2-013F-G'};
const receipt={version:1,approved:true,packageDigest:packageDigest(pkg),codeDigest:c,expiresAt:pkg.expiresAt,approvalRef:'approval-synthetic'};let inputs=0,gets=0;
const controller=createTwoGetController({mode:'approved-local',reviewPackage:pkg,receipt,directory:process.argv[1]+'/claims',baseEnv:{SUPABASE_URL:host,SUPABASE_PUBLISHABLE_KEY:key},
authFetch:async url=>Response.json(String(url).includes('/auth/')?{id:u}:[{id:d,user_id:u}]),getToken:async()=>{inputs++;return 'SYNTHETIC_TOKEN_NOT_A_CREDENTIAL';},
notionFetch:async()=>Response.json(++gets===1?{object:'user',id:b,type:'bot',bot:{workspace_id:w,owner:{type:'workspace',workspace:true}}}:{object:'page',id:p,archived:false,in_trash:false,is_locked:false,public_url:null,parent:{type:'workspace',workspace:true}})});
const result=await controller.review(new Request(origin+'/__local/notion-2get/review',{method:'POST',headers:{Host:'127.0.0.1:8796',Origin:origin,Authorization:'Bearer SYNTHETIC_SESSION','Content-Type':'application/json'},body:'{}'}));console.log(JSON.stringify({status:result.status,inputs,gets}));`;
  const results=await Promise.all([child(code,[root]),child(code,[root])]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(results.reduce((s,r)=>s+r.inputs,0),1);assert.equal(results.reduce((s,r)=>s+r.gets,0),2);assert.equal((await readdir(join(root,'claims'))).length,1);
});
test('NB013I TTY: real pseudo-terminal disables echo and restores terminal after synthetic input',async()=>{
  const secretURL=new URL('../../notion-local/two-get-secret.mjs',import.meta.url).href;
  const script=`import {promptApprovedNotionToken} from ${JSON.stringify(secretURL)};
await promptApprovedNotionToken({authorization:{approved:true,consumed:true}});console.log('RESTORED:'+String(process.stdin.isRaw===false));`;
  const driver=`import os,pty,sys,select,time,termios,json,signal
pid,fd=pty.fork()
if pid==0: os.execv(sys.argv[1],[sys.argv[1],'--input-type=module','-e',sys.argv[2]])
data=b'';sent=False;hidden=False;deadline=time.monotonic()+8
try:
 while time.monotonic()<deadline:
  if not select.select([fd],[],[],0.1)[0]: continue
  try: chunk=os.read(fd,4096)
  except OSError: break
  if not chunk: break
  data+=chunk
  if not sent and b': ' in data:
   hidden=not bool(termios.tcgetattr(fd)[3]&termios.ECHO)
   os.write(fd,b'SYNTHETIC_TOKEN_ONLY_NOT_REAL' + bytes([13]));sent=True
 else: os.kill(pid,signal.SIGKILL)
 _,status=os.waitpid(pid,0)
 print(json.dumps({'ok':status==0,'hidden':hidden,'echoed':b'SYNTHETIC_TOKEN_ONLY_NOT_REAL' in data,'restored':b'RESTORED:true' in data}))
finally: os.close(fd)
`;
  const result=await new Promise((resolve,reject)=>{
    const p=spawn('python3',['-c',driver,process.execPath,script],{stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',v=>out+=v);
    p.on('error',reject);p.on('close',status=>status===0?resolve(JSON.parse(out)):reject(Error('synthetic PTY driver failed')));
  });assert.deepEqual(result,{ok:true,hidden:true,echoed:false,restored:true});
});
