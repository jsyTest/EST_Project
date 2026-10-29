import test from 'node:test';
import assert from 'node:assert/strict';
import {authUI} from './auth-ui-harness.mjs';
const signedIn={access_token:'synthetic',user:{id:'user-a',email:'learner@example.invalid'}};
test('auth UI: anonymous direct protected-page entry redirects without revealing content',async()=>{
 const s=await authUI({protectedPage:true,url:'https://education.example/result.html'});
 assert.equal(s.doc.documentElement.dataset.authState,'anonymous');assert.equal(s.main.cleared,true);assert.equal(s.privateInput.value,'');assert.equal(s.navigations[0],'https://education.example/login.html');assert.equal(await s.context.estAuth.ready,false);
});
test('auth UI: signup mismatch focuses invalid confirmation and makes no Auth request',async()=>{
 const s=await authUI({url:'https://education.example/login.html?mode=signup'});const n=s.nodes;
 assert.equal(n['confirmation-field'].hidden,false);n['auth-email'].value='learner@example.invalid';n['auth-password'].value='synthetic-password';n['auth-confirmation'].value='mismatch';
 await n['auth-form'].fire('submit');assert.equal(s.requests.length,0);assert.equal(n['auth-confirmation'].focused,true);assert.match(n['auth-confirmation-error'].textContent,/일치/);
});
test('auth UI: signup without session displays mail confirmation, clears passwords and stays on form',async()=>{
 const s=await authUI({url:'https://education.example/login.html?mode=signup'});const n=s.nodes;n['auth-email'].value='learner@example.invalid';n['auth-password'].value='synthetic-password';n['auth-confirmation'].value='synthetic-password';
 await n['auth-form'].fire('submit');assert.equal(s.requests.length,1);assert.match(n['auth-message'].textContent,/이메일 인증/);assert.equal(s.navigations.length,0);assert.equal(n['auth-password'].value,'');assert.equal(n['auth-confirmation'].value,'');assert.equal(n['auth-submit'].disabled,false);
});
test('auth UI: duplicate submit is ignored while pending, successful login navigates to original main',async()=>{
 const s=await authUI();const n=s.nodes;let complete;let calls=0;s.client.auth.signInWithPassword=()=>{calls++;return new Promise(resolve=>{complete=resolve;});};
 n['auth-email'].value='learner@example.invalid';n['auth-password'].value='synthetic-password';const pending=n['auth-form'].fire('submit');
 assert.equal(n['auth-submit'].disabled,true);await n['auth-form'].fire('submit');assert.equal(calls,1);
 complete({data:{session:signedIn},error:null});await pending;assert.equal(s.navigations[0],'https://education.example/index.html');assert.equal(n['auth-password'].value,'');
});
test('auth UI: missing SDK fails closed with actionable retry and no app access',async()=>{
 const s=await authUI({missingSdk:true});assert.equal(s.doc.documentElement.dataset.authState,'error');assert.match(s.nodes['auth-message'].textContent,/인증 연결/);assert.equal(s.nodes['auth-submit'].disabled,true);assert.equal(s.nodes['auth-retry'].hidden,false);
});
test('auth UI: expired confirmation link is sanitized and shown as safe Korean error',async()=>{
 const s=await authUI({url:'https://education.example/login.html#error=access_denied&error_code=otp_expired&error_description=PRIVATE_DESCRIPTION'});
 assert.match(s.nodes['auth-message'].textContent,/만료/);assert.ok(!s.nodes['auth-message'].textContent.includes('PRIVATE_'));assert.equal(s.context.location.hash,'');assert.equal(s.navigations.length,0);
});
test('auth UI: cross-tab logout hides email and removes sensitive content and owned draft',async()=>{
 const s=await authUI({protectedPage:true,url:'https://education.example/mapping.html',session:signedIn,stored:{estAuthDraftOwner:'user-a',aiNotionBuilderRequirements:'synthetic draft'}});
 assert.equal(s.doc.documentElement.dataset.authState,'authenticated');assert.equal(s.storage.get('aiNotionBuilderRequirements'),'synthetic draft');
 s.emit('SIGNED_OUT',null);await s.flush();assert.equal(s.doc.documentElement.dataset.authState,'anonymous');assert.equal(s.main.cleared,true);assert.equal(s.storage.has('aiNotionBuilderRequirements'),false);
 assert.equal(s.header.children[0].children[0].textContent,'');assert.equal(s.navigations.at(-1),'https://education.example/login.html');
});
test('auth UI: failed local sign-out keeps authenticated screen and shows failure',async()=>{
 const s=await authUI({protectedPage:true,url:'https://education.example/index.html',session:signedIn});s.client.auth.signOut=async()=>({error:{status:403}});
 const [email,button,message]=s.header.children[0].children;await button.fire('click');assert.equal(s.doc.documentElement.dataset.authState,'authenticated');assert.match(message.textContent,/로그아웃하지 못/);assert.equal(button.disabled,false);assert.equal(email.textContent,'learner@example.invalid');assert.equal(s.navigations.length,0);
});
test('auth UI: password visibility is accessible and reset after failed login',async()=>{
 const s=await authUI();const n=s.nodes;await s.toggles[0].fire('click');assert.equal(n['auth-password'].type,'text');assert.equal(s.toggles[0].attributes['aria-pressed'],'true');
 s.client.auth.signInWithPassword=async()=>({error:{code:'invalid_credentials',message:'PRIVATE_SERVICE_DETAIL'},data:null});n['auth-email'].value='learner@example.invalid';n['auth-password'].value='synthetic-password';
 await n['auth-form'].fire('submit');assert.match(n['auth-message'].textContent,/이메일 또는 비밀번호/);assert.ok(!n['auth-message'].textContent.includes('PRIVATE_'));assert.equal(n['auth-password'].value,'');assert.equal(n['auth-password'].type,'password');assert.equal(s.navigations.length,0);
});
test('auth UI: failed session read keeps protected content hidden and offers retry',async()=>{
 const s=await authUI({protectedPage:true,url:'https://education.example/index.html',error:{name:'AuthRetryableFetchError'}});assert.equal(s.doc.documentElement.dataset.authState,'error');assert.match(s.nodes['auth-gate-message'].textContent,/네트워크/);assert.equal(s.nodes['auth-retry'].hidden,false);assert.equal(s.navigations.length,0);
});
test('auth UI: back-forward cache stays hidden until the session is rechecked',async()=>{
 const s=await authUI({protectedPage:true,url:'https://education.example/result.html',session:signedIn});s.context.dispatchEvent({type:'pagehide',persisted:true});assert.equal(s.doc.documentElement.dataset.authState,'checking');
 s.client.auth.getSession=async()=>({data:{session:null},error:null});s.context.dispatchEvent({type:'pageshow',persisted:true});assert.equal(s.doc.documentElement.dataset.authState,'checking');await s.flush();assert.equal(s.doc.documentElement.dataset.authState,'anonymous');assert.equal(s.main.cleared,true);assert.equal(s.navigations.at(-1),'https://education.example/login.html');
});
test('auth UI: switching accounts removes previous page data before navigation',async()=>{
 const s=await authUI({protectedPage:true,url:'https://education.example/mapping.html',session:signedIn,stored:{estAuthDraftOwner:'user-a',aiNotionBuilderRequirements:'synthetic previous draft'}});
 s.emit('SIGNED_IN',{access_token:'synthetic-second',user:{id:'user-b',email:'other@example.invalid'}});await s.flush();assert.equal(s.storage.has('aiNotionBuilderRequirements'),false);assert.equal(s.main.cleared,true);assert.equal(s.navigations.at(-1),'https://education.example/index.html');
});
