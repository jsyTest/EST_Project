import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createAdminHandler} from '../../../server/admin-overview.mjs';
import {createAdminView} from '../../../js/admin-ui.mjs';
import {startReviewServer} from '../../development/serve-review.mjs';
import {buildStatic, PUBLIC_FILES} from '../../deployment/build-static.mjs';
import {authUI} from './auth-ui-harness.mjs';
import {Element} from './helpers/browser.mjs';

const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://admin-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY'};
const user=(id=A,role='user')=>({id,email:'test@example.invalid',app_metadata:{pplus_role:role}});
const session={access_token:'test-A',user:{id:A,email:'test@example.invalid'}};
function authServer(getUser=()=>user()) {
  const calls=[];
  return {calls,handler:createAdminHandler({env,fetchImpl:async(url,options)=>{
    calls.push({url:new URL(url),options});
    assert.equal(options.method,'GET'); assert.equal(new URL(url).pathname,'/auth/v1/user'); assert.equal(options.redirect,'error');
    const result=await getUser(options.headers.Authorization);
    return result instanceof Response?result:Response.json(result);
  }})};
}
function request({token='test-A',method='GET',query='',headers={}}={}) {
  return new Request('http://127.0.0.1:8787/api/admin/overview'+query,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...headers}});
}
const data=()=>({viewer:{id:A,email:'admin@example.invalid',role:'admin'},statistics:{members:null,educationDrafts:null},members:[],connections:{memberDirectory:false},capabilities:{changeRoles:false}});
const authorized=()=>({status:200,ok:true,json:async()=>data()});
const adminLink=s=>s.header.children[0].children.find(n=>n.textContent==='관리자 페이지');

test('UI001 API: unauthenticated request is denied without Auth/network calls',async()=>{
  const s=authServer();const r=await s.handler(request({token:null}));assert.equal(r.status,401);assert.equal(s.calls.length,0);
});
for(const role of [undefined,'user','ADMIN','owner',true])test(`UI001 API: missing/unknown role fails closed (${role})`,async()=>{
  const s=authServer(()=>({...user(),app_metadata:role===undefined?{}:{pplus_role:role},user_metadata:{pplus_role:'admin'}}));
  const r=await s.handler(request());assert.equal(r.status,403);assert.equal((await r.json()).error.code,'admin_required');assert.equal(s.calls.length,1);
});
test('UI001 API: verified app_metadata admin gets only own profile and unconnected states',async()=>{
  const s=authServer(()=>({...user(A,'admin'),password:'PRIVATE',user_metadata:{secret:'PRIVATE'},app_metadata:{pplus_role:'admin',other:'PRIVATE'}}));
  const r=await s.handler(request()), b=await r.json();assert.equal(r.status,200);assert.equal(b.viewer.role,'admin');assert.equal(b.viewer.id,A);
  assert.deepEqual(b.members,[]);assert.equal(b.statistics.members,null);assert.equal(b.statistics.educationDrafts,null);assert.equal(b.capabilities.changeRoles,false);
  assert.doesNotMatch(JSON.stringify(b),/PRIVATE|app_metadata|test-A|access_token/);assert.equal(s.calls.length,1);
  for(const name of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])assert.match(r.headers.get(name),/no-store/);
  assert.equal(r.headers.get('access-control-allow-origin'),null);
});
test('UI001 API: live role is checked on every request rather than trusting a cached JWT role',async()=>{
  let role='admin';const s=authServer(()=>user(A,role));assert.equal((await s.handler(request())).status,200);
  role='user';assert.equal((await s.handler(request())).status,403);assert.equal(s.calls.length,2);
});
test('UI001 API: invalid/anonymous Auth is denied, upstream errors never reveal details',async()=>{
  for(const [reply,status]of [[Response.json({message:'PRIVATE'},{status:401}),401],[{...user(A,'admin'),is_anonymous:true},401],[Response.json({message:'PRIVATE'},{status:500}),502]]){
    const r=await authServer(()=>reply).handler(request());assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE/);
  }
});
test('UI001 API: methods, query spoofing and foreign origins do not become admin access',async()=>{
  const s=authServer(()=>user(A,'admin'));
  assert.equal((await s.handler(request({method:'POST'}))).status,405);
  assert.equal((await s.handler(request({query:'?role=admin&user_id='+B}))).status,400);
  assert.equal((await s.handler(request({headers:{Origin:'https://foreign.example'}}))).status,403);
  assert.equal(s.calls.length,0);
});
test('UI001 API: concurrent users have independent token/profile state',async()=>{
  const s=authServer(async token=>{await new Promise(r=>setTimeout(r,token.endsWith('A')?3:1));return token.endsWith('A')?user(A,'admin'):user(B,'user');});
  const result=await Promise.all([s.handler(request()),s.handler(request({token:'test-B'}))]);
  assert.equal(result[0].status,200);assert.equal((await result[0].json()).viewer.id,A);assert.equal(result[1].status,403);
});
test('UI001 API: missing server config fails closed without any administrator key',async()=>{
  const handler=createAdminHandler({env:{},fetchImpl:()=>{throw new Error('must not call');}});
  assert.equal((await handler(request())).status,503);
});
test('UI001 navigation: normal users cannot make an admin menu from client metadata or URL',async()=>{
  const s=await authUI({protectedPage:true,url:'https://education.example/index.html?role=admin',session:{...session,user:{...session.user,app_metadata:{pplus_role:'admin'},user_metadata:{pplus_role:'admin'}}}});
  assert.equal(adminLink(s).hidden,true);assert.equal(s.doc.documentElement.dataset.authState,'authenticated');
});
test('UI001 navigation: admin link stays hidden until the server confirms identity and role',async()=>{
  let complete;const s=await authUI({protectedPage:true,session,roleFetch:()=>new Promise(r=>complete=r)});
  assert.equal(adminLink(s).hidden,true);complete(authorized());await s.flush();
  assert.equal(adminLink(s).hidden,false);assert.equal(s.doc.documentElement.dataset.adminState,'authorized');
});
test('UI001 navigation: late admin response after logout cannot restore menu or content',async()=>{
  let complete;const s=await authUI({protectedPage:true,adminPage:true,url:'https://education.example/admin.html',session,roleFetch:()=>new Promise(r=>complete=r)});
  s.emit('SIGNED_OUT',null);await s.flush();complete(authorized());await s.flush();
  assert.equal(adminLink(s).hidden,true);assert.notEqual(s.doc.documentElement.dataset.adminState,'authorized');assert.equal(s.main.cleared,true);
});
test('UI001 guard: anonymous admin URL redirects and ordinary account remains denied',async()=>{
  const anonymous=await authUI({protectedPage:true,adminPage:true,url:'https://education.example/admin.html'});
  assert.equal(anonymous.navigations.at(-1),'https://education.example/login.html');
  const ordinary=await authUI({protectedPage:true,adminPage:true,url:'https://education.example/admin.html',session});
  assert.equal(ordinary.doc.documentElement.dataset.adminState,'denied');assert.match(ordinary.nodes['admin-access-message'].textContent,/관리자만/);assert.equal(adminLink(ordinary).hidden,true);
});
test('UI001 guard: role failure hides privileged UI while the ordinary app stays authenticated',async()=>{
  const s=await authUI({protectedPage:true,session,roleFetch:async()=>{throw new Error('PRIVATE_AUTH_DETAIL');}});
  assert.equal(s.doc.documentElement.dataset.authState,'authenticated');assert.equal(s.doc.documentElement.dataset.adminState,'error');assert.equal(adminLink(s).hidden,true);
});
test('UI001 guard: admin page focus rechecks role and revocation hides the menu',async()=>{
  let admin=true;const s=await authUI({protectedPage:true,adminPage:true,url:'https://education.example/admin.html',session,roleFetch:async()=>admin?authorized():{status:403,ok:false}});
  assert.equal(adminLink(s).hidden,false);admin=false;s.context.dispatchEvent(new Event('focus'));await s.flush();
  assert.equal(adminLink(s).hidden,true);assert.equal(s.doc.documentElement.dataset.adminState,'denied');
});
test('UI001 login: exact input and temporary-error messages, existing short passwords still work',async()=>{
  const s=await authUI(), n=s.nodes;
  await n['auth-form'].fire('submit');assert.equal(n['auth-email-error'].textContent,'이메일을 입력해 주세요.');
  n['auth-email'].value='invalid';await n['auth-form'].fire('submit');assert.equal(n['auth-email-error'].textContent,'올바른 이메일 주소를 입력해 주세요.');
  n['auth-email'].value='test@example.invalid';await n['auth-form'].fire('submit');assert.equal(n['auth-password-error'].textContent,'비밀번호를 입력해 주세요.');
  n['auth-password'].value='old';s.client.auth.signInWithPassword=async()=>({error:{status:503,message:'PRIVATE'},data:null});
  await n['auth-form'].fire('submit');assert.equal(n['auth-message'].textContent,'로그인에 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
  n['auth-password'].value='old';s.client.auth.signInWithPassword=async()=>({error:{code:'invalid_credentials'},data:null});await n['auth-form'].fire('submit');assert.equal(n['auth-message'].textContent,'이메일 또는 비밀번호를 확인해 주세요.');
});
test('UI001 signup: local eight-character rule, inline server weakness and neutral duplicate response',async()=>{
  const s=await authUI({url:'https://education.example/login.html?mode=signup'}), n=s.nodes;
  assert.match(n['password-help'].textContent,/8자/);n['auth-email'].value='test@example.invalid';n['auth-password'].value='short';n['auth-confirmation'].value='short';
  await n['auth-form'].fire('submit');assert.match(n['auth-password-error'].textContent,/8자/);assert.equal(s.requests.length,0);
  s.client.auth.signUp=async()=>({data:null,error:{code:'weak_password',message:'PRIVATE'}});n['auth-password'].value='long-enough';n['auth-confirmation'].value='long-enough';
  await n['auth-form'].fire('submit');assert.match(n['auth-password-error'].textContent,/비밀번호 정책/);assert.equal(n['auth-password'].attributes['aria-invalid'],'true');assert.equal(n['auth-password'].value,'');
});
test('UI001 login brand/help and recovery are concise and accessible',async()=>{
  const s=await authUI();assert.equal(s.doc.title,'로그인 | PPLUS');assert.equal(s.nodes['password-help'].hidden,true);
  const html=await readFile(new URL('../../../login.html',import.meta.url),'utf8');assert.doesNotMatch(html,/노션 설계 도우미|안전하게 인증 서버|인증 연결 다시 확인/);
  assert.match(html,/PPLUS/);assert.match(html,/aria-label="비밀번호 표시"/);assert.match(html,/id="auth-retry"[^>]*hidden>다시 시도/);
});

function adminDocument(){
  const nodes={}, node=id=>nodes[id]??=new Element();
  const tabs=['dashboard','members','usage','settings'].map(key=>{const el=new Element('button');el.dataset.adminTab=key;return el;});
  const sections=tabs.map(t=>{const el=new Element('section');el.dataset.adminSection=t.dataset.adminTab;return el;});
  const document={getElementById:node,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='[data-admin-tab]'?tabs:sections};
  node('admin-role-filter').value='all';return {document,node,tabs,sections};
}
test('UI001 admin view: real unavailable statistics are dashes, never invented zeroes',()=>{
  const d=adminDocument(),view=createAdminView(d.document);view.render(data());
  assert.equal(d.node('admin-member-count').textContent,'—');assert.equal(d.node('admin-draft-count').textContent,'—');assert.equal(d.node('admin-member-search').disabled,true);
  assert.match(d.node('admin-members-body').textContent,/준비/);view.clear();assert.equal(d.node('admin-viewer-email').textContent,'—');
});
test('UI001 local example view: menus, search/filter, disabled role actions and settings logout',async()=>{
  const d=adminDocument();let logouts=0;const view=createAdminView(d.document,{onLogout:()=>logouts++});
  const example={...data(),statistics:{members:2,educationDrafts:3},connections:{memberDirectory:true},members:[{email:'a@example.invalid',role:'admin',joinedAt:'예시 날짜',status:'가상 예시'},{email:'b@example.invalid',role:'user',joinedAt:'예시 날짜',status:'가상 예시'}]};
  view.render(example);assert.equal(d.node('admin-members-body').children.length,2);assert.equal(d.node('admin-members-body').children[0].children[4].children[0].disabled,true);
  d.node('admin-role-filter').value='user';await d.node('admin-role-filter').fire('change');assert.equal(d.node('admin-members-body').children.length,1);assert.match(d.node('admin-members-body').textContent,/b@example.invalid/);
  d.node('admin-member-search').value='none';await d.node('admin-member-search').fire('input');assert.match(d.node('admin-members-body').textContent,/없습니다/);
  await d.tabs[3].fire('click');assert.equal(d.sections[3].hidden,false);assert.equal(d.sections[0].hidden,true);assert.equal(d.node('admin-view-name').textContent,'설정');
  await d.node('admin-settings-logout').fire('click');assert.equal(logouts,1);
});
test('UI001 local demo is opt-in, no Auth SDK, excluded from public output; admin API remains protected',async t=>{
  const build=await buildStatic();assert.equal(build.count,30);assert.ok(!PUBLIC_FILES.some(p=>p.includes('demo')||p.startsWith('server/')||p.startsWith('api/')));
  const off=await startReviewServer({port:0}), on=await startReviewServer({port:0,enableAdminDemo:true});
  t.after(async()=>{for(const s of [off,on]){s.closeAllConnections();await new Promise(r=>s.close(r));}});
  const offURL=`http://127.0.0.1:${off.address().port}`, onURL=`http://127.0.0.1:${on.address().port}`;
  assert.equal((await fetch(offURL+'/__demo/admin.html')).status,404);
  const html=await(await fetch(onURL+'/__demo/admin.html')).text();assert.match(html,/모든 계정과 수치는 가상 예시/);assert.doesNotMatch(html,/supabase-client|cdn.jsdelivr|auth-bootstrap|data-admin-required="true"/);
  assert.equal((await fetch(onURL+'/__demo/admin-demo.mjs')).status,200);
  const real=await(await fetch(onURL+'/admin.html?demo=1&role=admin')).text();assert.match(real,/data-admin-required="true"/);assert.doesNotMatch(real,/admin-demo.mjs/);
  assert.equal((await fetch(onURL+'/api/admin/overview')).status,401);
  for(const path of ['/server/admin-overview.mjs','/scripts/development/admin-demo.mjs','/.env'])assert.equal((await fetch(onURL+path)).status,404);
});
