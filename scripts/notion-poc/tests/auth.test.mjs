import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../../../js/auth-core.js',import.meta.url),'utf8');
const scope={URL,setTimeout};scope.window=scope;vm.runInNewContext(source,scope);const core=scope.ESTAuthCore;
const session=(id='user-a')=>({access_token:'synthetic-test-token',user:{id,email:'learner@example.invalid'}});
function setup({initial=null}={}) {
 const events=[],queue=[],calls=[];let callback,unsubscribed=0;
 const client={auth:{
  onAuthStateChange(cb){callback=cb;return {data:{subscription:{unsubscribe(){unsubscribed++;}}}};},
  async getSession(){calls.push(['getSession']);return {data:{session:initial},error:null};},
  async signInWithPassword(value){calls.push(['signInWithPassword',value]);return {data:{session:session()},error:null};},
  async signUp(value){calls.push(['signUp',value]);return {data:{user:{id:'synthetic-new-user'},session:null},error:null};},
  async signOut(value){calls.push(['signOut',value]);return {error:null};}
 }};
 const controller=core.createController({client,onSession:(s,event)=>events.push({session:s,event}),schedule:fn=>queue.push(fn)});
 return {client,controller,events,calls,queue,emit:(event,s)=>callback(event,s),flush(){while(queue.length)queue.shift()();},unsubscribed:()=>unsubscribed};
}
function storage(initial={}) {const map=new Map(Object.entries(initial));return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),map};}

test('auth: signup validates malformed email, empty password, minimum length and confirmation',()=>{
 assert.ok(core.validateCredentials('signup','bad-email','','').email);
 assert.ok(core.validateCredentials('signup','learner@example.invalid','','').password);
 assert.ok(core.validateCredentials('signup','learner@example.invalid','short','short').password);
 assert.ok(core.validateCredentials('signup','learner@example.invalid','fake-test-only','different').confirmation);
 assert.equal(Object.keys(core.validateCredentials('signup','learner@example.invalid','fake-test-only','fake-test-only')).length,0);
});
test('auth: login accepts existing short passwords without enforcing new-signup policy',()=>{
 assert.equal(Object.keys(core.validateCredentials('signin','learner@example.invalid','old','')).length,0);
});
test('auth: user object without a session is never treated as signed in',async()=>{
 const s=setup();await s.controller.refresh();const result=await s.controller.signUp('learner@example.invalid','fake-test-only','https://app.example/login.html?confirmed=1');
 assert.ok(result.data.user);assert.equal(result.data.session,null);assert.equal(s.events.length,1);assert.equal(s.events[0].session,null);
 assert.equal(core.hasSession({user:{id:'user'}}),false);
});
test('auth: signup calls shared client with email redirect; no database API',async()=>{
 const s=setup();await s.controller.signUp('learner@example.invalid','fake-test-only',core.confirmationUrl('https://education.example/tools/login.html?mode=signup'));
 assert.equal(s.calls[0][0],'signUp');assert.equal(s.calls[0][1].options.emailRedirectTo,'https://education.example/tools/login.html?confirmed=1');
 assert.equal(Object.keys(s.calls[0][1]).sort().join(','),'email,options,password');
});
test('auth: sign-in requires an actual session before emitting authenticated state',async()=>{
 const s=setup();await s.controller.signIn('learner@example.invalid','fake-test-only');assert.equal(s.events[0].session.user.id,'user-a');
 s.client.auth.signInWithPassword=async()=>({data:{user:{id:'user'},session:null},error:null});
 const failed=await s.controller.signIn('learner@example.invalid','fake-test-only');assert.equal(failed.error.code,'session_missing');assert.equal(s.events.length,1);
});
test('auth: signup with confirmation disabled can accept its returned session',async()=>{
 const s=setup();s.client.auth.signUp=async()=>({data:{session:session()},error:null});await s.controller.signUp('learner@example.invalid','fake-test-only','https://app.example/login.html');assert.equal(s.events[0].session.user.id,'user-a');
});
test('auth: restored session refresh does not duplicate subscriptions',async()=>{
 const s=setup({initial:session()});let registrations=0;const subscribe=s.client.auth.onAuthStateChange;s.client.auth.onAuthStateChange=cb=>{registrations++;return subscribe(cb);};
 await s.controller.refresh();await s.controller.refresh();assert.equal(registrations,1);assert.equal(s.events.at(-1).session.user.id,'user-a');
 s.controller.dispose();assert.equal(s.unsubscribed(),1);
});
test('auth: token refresh and cross-tab signed-out events update UI outside Auth callback',async()=>{
 const s=setup({initial:session()});await s.controller.refresh();const before=s.calls.length;
 assert.equal(s.emit('TOKEN_REFRESHED',session()),undefined);assert.equal(s.events.length,1);assert.equal(s.calls.length,before);
 s.flush();assert.equal(s.events.at(-1).event,'TOKEN_REFRESHED');
 s.emit('SIGNED_OUT',null);s.flush();assert.equal(s.events.at(-1).session,null);
});
test('auth: newer Auth event wins over a stale asynchronous getSession result',async()=>{
 const s=setup();let resolve;s.client.auth.getSession=()=>new Promise(r=>{resolve=r;});const pending=s.controller.refresh();
 s.emit('SIGNED_IN',session('new-user'));s.flush();resolve({data:{session:null},error:null});await pending;
 assert.equal(s.events.length,1);assert.equal(s.events[0].session.user.id,'new-user');
});
test('auth: sign-in success invalidates previously queued signed-out event',async()=>{
 const s=setup();await s.controller.refresh();s.emit('SIGNED_OUT',null);await s.controller.signIn('learner@example.invalid','fake-test-only');s.flush();assert.equal(s.events.at(-1).session.user.id,'user-a');
});
test('auth: concurrent submissions issue a single request',async()=>{
 const s=setup();let resolve;let requests=0;s.client.auth.signInWithPassword=()=>{requests++;return new Promise(r=>{resolve=r;});};
 const first=s.controller.signIn('learner@example.invalid','fake-test-only');const second=await s.controller.signIn('learner@example.invalid','fake-test-only');
 assert.equal(second.error.code,'request_in_progress');assert.equal(requests,1);resolve({data:{session:session()},error:null});await first;
});
test('auth: failed request unlocks controller for retry without exposing raw error message',async()=>{
 const s=setup();s.client.auth.signInWithPassword=async()=>{throw Object.assign(new Error('DO_NOT_DISPLAY_PASSWORD_OR_TOKEN'),{name:'TypeError'});};
 const result=await s.controller.signIn('learner@example.invalid','fake-test-only');assert.match(core.errorMessage(result.error),/네트워크/);assert.ok(!core.errorMessage(result.error).includes('DO_NOT_DISPLAY'));
 s.client.auth.signInWithPassword=async()=>({data:{session:session()},error:null});assert.equal((await s.controller.signIn('learner@example.invalid','fake-test-only')).error,null);
});
test('auth: sign-out is local and clears session only after success',async()=>{
 const s=setup({initial:session()});await s.controller.refresh();await s.controller.signOut();assert.equal(s.calls.at(-1)[1].scope,'local');assert.equal(s.events.at(-1).session,null);
});
test('auth: failed sign-out does not announce success, even if SDK emitted during the request',async()=>{
 const s=setup({initial:session()});await s.controller.refresh();s.client.auth.signOut=async()=>{s.emit('SIGNED_OUT',null);return {error:{status:503}};};
 const result=await s.controller.signOut();s.flush();assert.equal(result.error.status,503);assert.equal(s.events.length,1);assert.ok(s.events[0].session);
});
test('auth: disposed subscriptions cannot publish queued events',async()=>{
 const s=setup();await s.controller.refresh();s.emit('SIGNED_IN',session());s.controller.dispose();s.flush();assert.equal(s.events.length,1);
});
test('auth: request failures map to Korean without account-existence disclosure',()=>{
 assert.match(core.errorMessage({code:'invalid_credentials'}),/이메일 또는 비밀번호/);
 assert.match(core.errorMessage({code:'email_not_confirmed'}),/이메일 인증/);
 assert.match(core.errorMessage({code:'weak_password'},'signup'),/비밀번호 정책/);
 assert.match(core.errorMessage({status:429}),/너무 많/);
 assert.match(core.errorMessage({status:503}),/일시적인/);
 assert.match(core.errorMessage({code:'sdk_unavailable'}),/연결/);
 assert.equal(core.errorMessage({code:'user_already_exists'},'signup'),core.errorMessage({code:'email_exists'},'signup'));
});
test('auth: confirmation errors never expose URL error descriptions',()=>{
 assert.match(core.errorMessage({code:'otp_expired'}),/만료/);assert.match(core.errorMessage({code:'callback_error'}),/유효하지/);
 assert.ok(!core.errorMessage({message:'SECRET',code:'unexpected'}).includes('SECRET'));
});
test('auth: same user keeps draft, changed user and sign-out clear only owned app data',()=>{
 const st=storage({estAuthDraftOwner:'user-a',aiNotionBuilderRequirements:'synthetic draft','unrelated':'keep'});
 core.syncDraftOwner(st,'user-a');assert.equal(st.getItem('aiNotionBuilderRequirements'),'synthetic draft');
 core.syncDraftOwner(st,'user-b');assert.equal(st.getItem('aiNotionBuilderRequirements'),null);assert.equal(st.getItem('estAuthDraftOwner'),'user-b');
 st.setItem('aiNotionBuilderRequirements','second draft');core.syncDraftOwner(st,null);assert.equal(st.getItem('estAuthDraftOwner'),null);assert.equal(st.getItem('aiNotionBuilderRequirements'),null);assert.equal(st.getItem('unrelated'),'keep');
});
test('auth: legacy unowned draft is removed before first authenticated app initialization',()=>{
 const st=storage({aiNotionBuilderRequirements:'old unowned input'});core.syncDraftOwner(st,'user-a');assert.equal(st.getItem('aiNotionBuilderRequirements'),null);
});
test('auth: callback URL stays on current host and ignores arbitrary return parameters',()=>{
 assert.equal(core.confirmationUrl('https://education.example/login.html?next=https://evil.invalid#old'),'https://education.example/login.html?confirmed=1');
 assert.equal(core.pageUrl('index.html','https://education.example/tools/login.html?next=https://evil.invalid'),'https://education.example/tools/index.html');
 assert.throws(()=>core.confirmationUrl('file:///tmp/login.html'));
});
test('auth: protected HTML starts hidden and loads shared Auth before original app',async()=>{
 for(const page of ['index.html','result.html','mapping.html']) {
  const html=await readFile(new URL(`../../../${page}`,import.meta.url),'utf8');
  assert.match(html,/<html[^>]*data-auth-required="true"[^>]*data-auth-state="checking"/);
  assert.match(html,/<main data-auth-content/);assert.match(html,/css\/auth.css/);assert.match(html,/auth-gate-message/);
  const files=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(files.filter(f=>f==='js/supabase-client.js').length,1);
  assert.ok(files.indexOf('js/auth.js')>files.indexOf('js/supabase-client.js'));
  assert.ok(files.indexOf('js/auth.js')<files.indexOf(page==='mapping.html'?'js/mapping-ui.mjs':'js/app.js'));
 }
});
test('auth: bootstrap keeps safe callback flags, never token or error-description values',async()=>{
 const code=await readFile(new URL('../../../js/auth-bootstrap.js',import.meta.url),'utf8');
 const ctx={URLSearchParams,Promise,setTimeout:()=>1,document:{},location:{hash:'#access_token=PRIVATE_TEST_TOKEN&error=access_denied&error_code=otp_expired&error_description=PRIVATE_DESCRIPTION',search:''}};ctx.window=ctx;
 vm.runInNewContext(code,ctx);assert.equal(ctx.estAuth.callbackError,'otp_expired');assert.ok(!JSON.stringify(ctx.estAuth).includes('PRIVATE_'));
});
test('auth: delayed original app scripts cannot initialize after a sign-out',async()=>{
 for(const file of ['app.js','mapping-ui.mjs']) {
  let resolve;const ready=new Promise(r=>{resolve=r;});let accesses=0;
  const context={Promise,document:{body:{dataset:{page:'input'}},documentElement:{dataset:{authRequired:'true',authState:'checking'}},getElementById(){accesses++;throw new Error('Private DOM must not initialize after logout');}}};
  context.window={estAuth:{ready},MOCK_DASHBOARD_DATA:{}};
  const script=(await readFile(new URL(`../../../js/${file}`,import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
  vm.runInNewContext(script,context);assert.equal(accesses,0);context.document.documentElement.dataset.authState='anonymous';resolve(true);await ready;await Promise.resolve();assert.equal(accesses,0);
 }
});
