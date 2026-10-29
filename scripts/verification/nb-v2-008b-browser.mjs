// Run against the public build served on 127.0.0.1:8878 and a separate temporary
// headless Chrome profile with --remote-debugging-port=9338. No remote Auth/DB calls.
// Auth and education_drafts responses below are TEST DOUBLES, not Supabase evidence.
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8878',cdpBase='http://127.0.0.1:9338';
const evidenceDir=new URL('../../docs/research/NB-V2-008B_browser/',import.meta.url);
await mkdir(evidenceDir,{recursive:true});
const fixture=(await readFile(new URL('../notion-poc/tests/helpers/drafts-fixture.mjs',import.meta.url),'utf8'))
 .replace(/^import.*\n/gm,'').replace(/^export /gm,'')
 .replace('let sequence = 0,','let sequence = Number(localStorage.getItem("test-sequence")||0),')
 .replaceAll('rows.set(id, row);','rows.set(id, row); localStorage.setItem("test-sequence",String(sequence));')
 .replaceAll('rows.set(row.id, updated);','rows.set(row.id, updated); localStorage.setItem("test-sequence",String(sequence));');
const stub=`(()=>{${fixture}
 const server=mockServer();
 for(const [id,row] of JSON.parse(localStorage.getItem('test-rows')||'[]'))server.rows.set(id,row);
 const set=server.rows.set.bind(server.rows);server.rows.set=(id,row)=>{set(id,row);localStorage.setItem('test-rows',JSON.stringify([...server.rows]));return server.rows;};
 const callbacks=[];
 const session=()=>localStorage.getItem('test-anonymous')?null:{user:{id:USER_A,email:'synthetic-long-test-account@example.invalid'},access_token:'token-A'};
 window.__testServer=server;
 window.supabaseClient={auth:{
  async getSession(){return {data:{session:session()},error:null};},
  onAuthStateChange(fn){callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}};},
  async signOut(){localStorage.setItem('test-anonymous','1');callbacks.forEach(fn=>fn('SIGNED_OUT',null));return {error:null};},
  async signInWithPassword(){localStorage.removeItem('test-anonymous');return {data:{session:session()},error:null};}
 }};
 window.createEducationDataClient=server.createDataClient;
})();`;
const target=await (await fetch(cdpBase+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let sequence=0;const pending=new Map(),errors=[],external=[];
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
ws.onmessage=async event=>{
 const m=JSON.parse(event.data);
 if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(JSON.stringify(m.error)));else p?.resolve(m.result);return;}
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+(m.params.exceptionDetails.exception?.description??''));
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;
  try{
   if(request.url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'))await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from(stub).toString('base64')});
   else if(request.url.startsWith(base+'/')||request.url==='about:blank')await send('Fetch.continueRequest',{requestId});
   else{external.push(request.url);await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
  }catch(error){errors.push(error.message);}
 }
};
await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function wait(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out: '+expression);}
async function navigate(path){await send('Page.navigate',{url:base+'/'+path});await wait('document.readyState === "complete"');}
const ready=()=>wait('document.documentElement.dataset.authState === "authenticated" && document.querySelector("#analyze") && !document.querySelector("#analyze").disabled && window.estDraftsReady');
const set=(id,value,event='input')=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const button=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)});if(!b)throw Error('Missing button');b.click();})()`);
const colorSelector=JSON.stringify('[aria-label="base-selection option-0 색상"]');
async function capturePlan(name){await evaluate('document.querySelector("#output-title").scrollIntoView({block:"start",behavior:"instant"})');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(name+'.png',evidenceDir),Buffer.from(shot.data,'base64'));}
const result={backend:'mock Auth and in-browser mock education_drafts; all nonlocal network intercepted',checks:[],widths:[],notionWrites:0,supabaseRequests:0};
const check=(name,actual)=>{assert.ok(actual,name);result.checks.push({name,passed:true});};
try{
 await navigate('login.html');await evaluate('localStorage.removeItem("test-anonymous")');
 await navigate('index.html');await ready();await wait('document.querySelector("#mapping-rows article")');
 await evaluate('localStorage.removeItem("test-rows");localStorage.removeItem("test-sequence");sessionStorage.clear()');await navigate('index.html');await ready();await wait('document.querySelector("#mapping-rows article")');
 check('home opens unified input; advanced and V1 collapsed',await evaluate('document.querySelector("h1").textContent.includes("새 Notion DB")&&!document.querySelector("#advanced-settings").open&&!document.querySelector("#legacy-settings").open'));
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await set('education-name','가상 해커톤');await set('education-type','hackathon','change');
 await set('form-text','1. 신청 동기\n장문형');await click('analyze');await wait('document.querySelector("#feedback").textContent.includes("분석 완료")');await click('preview');
 check('form-only real browser preview',await evaluate('!document.querySelector("#download-schema").disabled&&document.querySelector("#db-preview").children.length>0'));
 check('NB008B default plan is a single DB with no relations',await evaluate('(()=>{const p=JSON.parse(document.querySelector("#plan-json").textContent);return p.databases.length===1&&p.relations.length===0&&p.notionWrites===0&&document.querySelector("#db-preview").children.length===1})()'));
 await capturePlan('plan-basic');
 const downloadDirectory=await mkdtemp('/tmp/nb008b-download-');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDirectory});
 await click('download-plan');let downloaded;
 for(let i=0;i<100;i++){try{downloaded=JSON.parse(await readFile(downloadDirectory+'/notion-generation-plan-dry-run.json','utf8'));break;}catch{await new Promise(resolve=>setTimeout(resolve,50));}}
 check('NB008B actual downloaded JSON matches the displayed plan without response rows or credentials',Boolean(downloaded)&&downloaded.planId===await evaluate('JSON.parse(document.querySelector("#plan-json").textContent).planId')&&!/access_token|SYNTHETIC_PRIVATE_RESPONSE/.test(JSON.stringify(downloaded)));
 await set('template-type','standard','change');await click('preview');
 check('NB008B standard plan has 3 DBs and reciprocal logical references',await evaluate('(()=>{const p=JSON.parse(document.querySelector("#plan-json").textContent);return p.dryRunValid&&p.databases.length===3&&p.relations.length===2&&p.formulas[0].value===null&&p.confirmationItems.some(c=>c.code==="IDENTITY_POLICY_PENDING")})()'));
 await capturePlan('plan-standard');
 await evaluate('(()=>{const e=document.querySelector("#module-teams");e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));})()');await click('preview');
 check('NB008B team module resolves participation and reuses core DB keys',await evaluate('(()=>{const p=JSON.parse(document.querySelector("#plan-json").textContent);return p.dryRunValid&&p.databases.length===5&&p.enabledModules.includes("participation")&&p.enabledModules.includes("teams")})()'));
 await evaluate('(()=>{const e=document.querySelector("#module-attendance");e.checked=true;e.dispatchEvent(new Event("change",{bubbles:true}));})()');await click('preview');
 check('NB008B attendance module plans a valid relation/rollup/formula graph',await evaluate('(()=>{const p=JSON.parse(document.querySelector("#plan-json").textContent);return p.dryRunValid&&p.databases.length===6&&p.rollups.length>=2&&p.formulas.length>=3&&p.requestTemplates.every(t=>t.executable===false)})()'));
 await capturePlan('plan-extended');
 const planId=await evaluate('JSON.parse(document.querySelector("#plan-json").textContent).planId');await click('preview');
 check('NB008B repeated preview is deterministic',await evaluate('JSON.parse(document.querySelector("#plan-json").textContent).planId')===planId);
 await set('education-type','hackathon','change');await click('preview');
 check('NB008B hackathon is reflected without actual execution',await evaluate('(()=>{const p=JSON.parse(document.querySelector("#plan-json").textContent);return p.educationType==="hackathon"&&p.executionState==="not_executed"&&p.networkRequests===0})()'));
 await evaluate('for(const e of document.querySelectorAll("[id^=module-]"))e.checked=false');await set('template-type','basic','change');
 await set('form-text','');await set('csv-mode','text','change');
 await set('csv-text','\uFEFF이메일,"긴 컬럼명 '+ '가상'.repeat(80)+'"\r\nSYNTHETIC_PRIVATE_RESPONSE,IGNORE');
 await button('교육 설계 저장');await wait('document.querySelector(".draft-status").textContent.includes("먼저")');
 check('saving unanalysed CSV is blocked before mock data insert',await evaluate('window.__testServer.rows.size===0'));
 await click('analyze');await wait('document.querySelector("#feedback").textContent.includes("CSV 컬럼 2개")');await click('preview');
 check('CSV text-only preview uses headers; no response in storage/model',await evaluate('!document.querySelector("#download-schema").disabled&&!document.querySelector("#csv-text").value.includes("SYNTHETIC_PRIVATE_RESPONSE")&&!sessionStorage.getItem("estEducationWorkspaceV1").includes("SYNTHETIC_PRIVATE_RESPONSE")&&!document.querySelector("#schema-preview").textContent.includes("SYNTHETIC_PRIVATE_RESPONSE")'));
 for(const width of [390,768,960,1280,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate('document.querySelector("#advanced-settings").open=true');
  const geometry=await evaluate(`(()=>{
   const root=document.documentElement,header=document.querySelector('.site-header').getBoundingClientRect(),intro=document.querySelector('.intro').getBoundingClientRect();
   const controls=[...document.querySelectorAll('main input,main select,main textarea,main button')].filter(e=>e.checkVisibility());
   const overlap=(a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1};
   const headerItems=[...document.querySelector('.site-header').children];
   return {viewport:innerWidth,scrollWidth:root.scrollWidth,introPosition:getComputedStyle(document.querySelector('.intro')).position,headerHeight:header.height,overflowControls:controls.filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1}).length,controlOverlaps:controls.reduce((n,a,i)=>n+controls.slice(i+1).filter(b=>overlap(a,b)).length,0),headerOverlaps:headerItems.reduce((n,a,i)=>n+headerItems.slice(i+1).filter(b=>overlap(a,b)).length,0),hiddenDraftPanel:document.querySelector('.draft-panel').getBoundingClientRect().top>document.querySelector('#form-text').getBoundingClientRect().top};
  })()`);
  assert.ok(geometry.scrollWidth<=width+1,JSON.stringify(geometry));assert.equal(geometry.overflowControls,0,JSON.stringify(geometry));assert.equal(geometry.controlOverlaps,0,JSON.stringify(geometry));assert.equal(geometry.headerOverlaps,0,JSON.stringify(geometry));assert.equal(geometry.introPosition,'static');assert.equal(geometry.hiddenDraftPanel,true);
  await evaluate('document.querySelector("#form-text").scrollIntoView({block:"start",behavior:"instant"})');
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(`width-${width}.png`,evidenceDir),Buffer.from(shot.data,'base64'));
  if(width===390||width===1280){await evaluate('document.querySelector("#advanced-settings").scrollIntoView({block:"start",behavior:"instant"})');const advanced=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(`advanced-${width}.png`,evidenceDir),Buffer.from(advanced.data,'base64'));}
  result.widths.push({width,...geometry,passed:true});
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate('document.querySelector("#advanced-settings").open=false');
 check('advanced details can close/open',await evaluate('!document.querySelector("#advanced-settings").open'));
 await evaluate('document.querySelector("#advanced-settings").open=true');
 await evaluate(`(()=>{const s=document.querySelector(${colorSelector});s.value="pink";s.dispatchEvent(new Event("change",{bubbles:true}));})()`);
 await button('교육 설계 저장');await wait('document.querySelector(".draft-status").textContent.includes("저장했습니다")');
 check('browser save retains education type and edited colors (mock server)',await evaluate('(()=>{const row=[...window.__testServer.rows.values()][0];return row.configuration.requirements.educationType==="hackathon"&&row.configuration.mapping.model.properties[0].options[0].color==="pink"&&!JSON.stringify(row).includes("SYNTHETIC_PRIVATE_RESPONSE")})()'));
 const savedId=await evaluate('[...window.__testServer.rows.keys()][0]');
 await evaluate('sessionStorage.removeItem("estEducationWorkspaceV1")');await navigate('index.html?draft='+savedId);await ready();await wait(`document.querySelector(${colorSelector})?.value==="pink"`);
 check('cloud-open with local cache removed restores input/type/headers/colors (mock server)',await evaluate('document.querySelector("#education-name").value==="가상 해커톤"&&document.querySelector("#education-type").value==="hackathon"&&document.querySelector("#csv-text").value.includes("이메일")'));
 await navigate('mapping.html');await ready();await wait(`document.querySelector(${colorSelector})?.value==="pink"`);
 check('mapping route and refresh retain editor state',await evaluate('document.querySelector("#education-type").value==="hackathon"'));
 await set('form-text','1. 이메일\n단답형');await set('csv-mode','text','change');await set('csv-text','이메일,메모');await click('analyze');await wait('document.querySelector("#feedback").textContent.includes("폼 질문 1개")');await click('preview');
 check('combined source merges email and keeps extra Text column',await evaluate('(()=>{const m=JSON.parse(document.querySelector("#schema-preview").textContent).sourceModel;return m.properties.filter(p=>p.origin==="form").length===1&&m.properties.filter(p=>p.origin==="csv").length===1})()'));
 await set('csv-text','이메일,이메일');await click('analyze');await wait('document.querySelector("#feedback").textContent.includes("분석 완료")');await click('preview');
 check('duplicate structural conflicts block preview and expose advanced',await evaluate('document.querySelector("#download-schema").disabled&&document.querySelector("#advanced-settings").open&&/중복|충돌/.test(document.querySelector("#review-items").textContent)'));
 await set('csv-text','"잘못된 CSV');await click('analyze');await wait('document.querySelector("#feedback").textContent.includes("분석 실패")');
 check('malformed CSV failure is visible',await evaluate('/인용부호/.test(document.querySelector("#feedback").textContent)'));
 // A real browser File is assigned to the existing file input; only synthetic rows.
 await set('form-text','');await set('csv-mode','file','change');
 await evaluate('(()=>{const dt=new DataTransfer();dt.items.add(new File(["이메일,메모\\nSYNTHETIC_FILE_RESPONSE,IGNORE"],"synthetic.csv",{type:"text/csv"}));const input=document.querySelector("#csv-file");input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');
 await click('analyze');await wait('document.querySelector("#feedback").textContent.includes("분석 완료")');await click('preview');
 check('real browser CSV file-only header preview',await evaluate('!document.querySelector("#download-schema").disabled&&!document.querySelector("#schema-preview").textContent.includes("SYNTHETIC_FILE_RESPONSE")'));
 await navigate('index.html');await ready();await wait('document.querySelector("#requirement-form")');
 await evaluate('document.querySelector("#legacy-settings").open=true;document.querySelector("#requirement-form").requestSubmit()');await wait('location.pathname.endsWith("result.html")&&document.querySelector("#result-content")&&!document.querySelector("#result-content").hidden');
 check('V1 result navigation preserved',await evaluate('document.querySelector("#result-education-name").textContent==="가상 해커톤"'));
 await click('edit-button');await ready();await wait('document.querySelector("#education-name").value==="가상 해커톤"');
 check('V1 edit returns to unified input without losing name/type',await evaluate('document.querySelector("#education-type").value==="hackathon"'));
 await button('로그아웃');await wait('location.pathname.endsWith("login.html")&&document.documentElement.dataset.authState==="anonymous"');
 await navigate('mapping.html');await wait('location.pathname.endsWith("login.html")');
 check('logout clears workspace and direct protected route redirects (mock Auth)',await evaluate('sessionStorage.getItem("estEducationWorkspaceV1")===null'));
 for(const path of ['scripts/notion-poc/cli.mjs','docs/research/NB-V2-008B_REPORT.md','.env']){const response=await fetch(base+'/'+path);assert.equal(response.status,404);result.checks.push({name:'public build excludes '+path,passed:true});}
 assert.deepEqual(errors,[],'browser runtime errors');assert.deepEqual(external,[],'unexpected external requests');
 result.runtimeErrors=errors;result.blockedUnexpectedExternalRequests=external;result.passed=true;
 await writeFile(new URL('result.json',evidenceDir),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}catch(error){result.passed=false;result.error=error.stack;result.runtimeErrors=errors;await writeFile(new URL('result.json',evidenceDir),JSON.stringify(result,null,2)+'\n');throw error;}
finally{ws.close();}
