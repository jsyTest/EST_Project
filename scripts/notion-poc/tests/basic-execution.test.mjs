import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {FakeNotion,PARENT_ID} from './fake-notion.mjs';
import {NotionError,NotionClient} from '../client.mjs';
import {emptyConfiguration} from '../../../js/drafts/model.mjs';
import {parseForm,mergeSources} from '../../../js/mapping/parse.mjs';
import {describeColumns} from '../../../js/mapping/csv.mjs';
import {createGenerationPlan} from '../../../js/planner/plan.mjs';
import {freezeBasicPlan,prepareExecution,normalizeTarget,PERSONAL_WORKSPACE_ID,rich} from '../../basic-notion/plan.mjs';
import {executeBasic,verifyBasic,basicPreflight} from '../../basic-notion/engine.mjs';
import {GenerationStore} from '../../basic-notion/store.mjs';

const BOT='33333333-3333-4333-8333-333333333333';
const target={kind:'personal-test',workspaceId:PERSONAL_WORKSPACE_ID,workspaceName:'가상 개인 공간',parentId:PARENT_ID,parentTitle:'NB-V2-009A 테스트',botId:BOT};
function plan(form='1. 성명\n단답형\n2. 이메일\n단답형\n3. 연락처\n단답형\n4. 신청 동기\n장문형\n5. 참여자 유형\n단일 선택\n- 가상 A\n- 가상 B\n6. 신청 과정 선택\n복수 선택\n- 가상 과정 1\n- 가상 과정 2',headers=[]){const c=emptyConfiguration();c.mapping.formText=form;c.mapping.columns=describeColumns(headers);c.mapping.model=mergeSources(parseForm(form),c.mapping.columns,{safeCsvDefaults:true});return createGenerationPlan(c);}
class BasicFake extends FakeNotion{
 constructor(){super();this.maxRetries=0;this.pages.get(PARENT_ID).properties={title:{type:'title',title:rich(target.parentTitle)}};this.loseCreate=false;this.failPatch=false;this.failSourceRead=false;this.rejectCreate=null;this.mismatch=false;}
 property(name,definition){const p=super.property(name,definition);for(const type of ['select','multi_select'])if(p[type])p[type].options=p[type].options.map((o,i)=>({...o,id:`${p.id}-option-${i}`}));return p;}
 async get(path){
  if(path==='/v1/users/me'){this.record('GET',path);return {id:BOT,type:'bot',bot:{workspace_id:PERSONAL_WORKSPACE_ID,workspace_name:target.workspaceName}};}
  if(path.startsWith('/v1/blocks/')){this.record('GET',path);const id=path.split('/')[3];return {results:[...this.databases.values()].filter(d=>d.parent.page_id===id).map(d=>({id:d.id,type:'child_database',child_database:{title:d.title[0].text.content}})),has_more:false};}
  if(path.startsWith('/v1/data_sources/')&&this.failSourceRead)throw new NotionError({status:503,code:'service_unavailable'});
  const result=await super.get(path);if(this.mismatch&&path.startsWith('/v1/data_sources/'))Object.values(result.properties).find(p=>p.type==='email').type='rich_text';return result;
 }
 async post(path,body){if(this.rejectCreate){this.record('POST',path,body);throw new NotionError({status:this.rejectCreate,code:this.rejectCreate===429?'rate_limited':'validation_error'});}const db=await super.post(path,body);const stored=this.databases.get(db.id);stored.description=body.description;const source=this.sources.get(stored.data_sources[0].id);source.title=[];if(this.loseCreate)throw new NotionError({code:'transport_or_response_error',uncertain:true});return structuredClone(stored);}
 async patch(path,body){this.record('PATCH',path,body);if(this.failPatch)throw new NotionError({code:'transport_or_response_error',uncertain:true});const source=this.sources.get(path.split('/').at(-1));source.title=body.title;return structuredClone(source);}
 async request(method,path,body,options){assert.equal(method,'POST');assert.equal(options.readOnly,true);this.record('READ_QUERY',path,body);return {results:[],has_more:false};}
}
async function setup(t){const directory=await mkdtemp(join(tmpdir(),'nb009a-'));t.after(()=>rm(directory,{recursive:true,force:true}));const p=plan(),runId='basic-test-1',prepared=prepareExecution(p,target,runId);return {plan:p,target,runId,store:new GenerationStore(runId,directory),client:new BasicFake(),approval:{task:'NB-V2-009A',approved:true,personalPrivatePageConfirmed:true,approvedAt:'2026-10-30T00:00:00Z',runId,parentId:PARENT_ID,workspaceId:PERSONAL_WORKSPACE_ID,botId:BOT,planHash:prepared.spec.planHash,requestHash:prepared.requestHash}};}
const posts=client=>client.calls.filter(c=>c.method==='POST'&&c.path==='/v1/databases');
function reapprove(args){const p=prepareExecution(args.plan,args.target,args.runId);args.approval={...args.approval,runId:args.runId,parentId:args.target.parentId,planHash:p.spec.planHash,requestHash:p.requestHash};}

test('NB009A: form/CSV/combined basic plans convert without recomputing structure or inventing options',()=>{
 for(const p of [plan(),plan('',['이메일','메모']),plan('1. 이메일\n단답형',['이메일'])]){const spec=freezeBasicPlan(p);assert.equal(spec.fields.length,p.properties.length);assert.deepEqual(spec.fields.map(p=>p.name),p.properties.map(p=>p.name));}
 const p=plan();const before=JSON.stringify(p);const request=prepareExecution(p,target,'basic-1');assert.equal(JSON.stringify(p),before);assert.equal(Object.keys(request.createBody.initial_data_source.properties).length,p.properties.length);assert.ok(request.createBody.initial_data_source.properties['성명'].title);assert.ok(request.createBody.initial_data_source.properties['이메일'].email);assert.ok(request.createBody.initial_data_source.properties['연락처'].phone_number);assert.ok(request.createBody.initial_data_source.properties['신청 동기'].rich_text);assert.equal(request.scope.rows,0);
});
test('NB009A: Number/Date/Checkbox definitions and Select/Multi-select colors survive conversion',()=>{
 const p=plan();for(const type of ['number','date','checkbox'])p.properties.push({id:`ds:applications:manual-${type}`,dataSourceId:'ds:applications',name:type,type,sourceRefs:[],origin:'manual',support:'automatic'});
 const selected=p.selectOptions.find(o=>o.propertyId.endsWith('form-4'));selected.options[0].color='pink';const body=prepareExecution(p,target,'basic-1').createBody;
 for(const type of ['number','date','checkbox'])assert.deepEqual(body.initial_data_source.properties[type],{[type]:{}});assert.equal(body.initial_data_source.properties['참여자 유형'].select.options[0].color,'pink');assert.equal(body.initial_data_source.properties['신청 과정'].multi_select.options.length,2);
});
test('NB009A: unsupported Status/URL/relation, arbitrary settings and unsupported version are never silently converted',()=>{
 for(const type of ['status','url','relation']){const p=plan();p.properties[0].type=type;assert.throws(()=>freezeBasicPlan(p),{code:'unsupported_property_type'});}
 const p=plan();p.properties[0].format='percent';assert.throws(()=>freezeBasicPlan(p),{code:'unsupported_property_configuration'});p.planVersion=2;assert.throws(()=>freezeBasicPlan(p),{code:'unsupported_plan_version'});
});
test('NB009A: general/extended, pending confirmations, missing Title, duplicate names and invalid colors block before any client call',()=>{
 for(const type of ['standard','extended']){const p=plan();p.templateType=type;assert.throws(()=>freezeBasicPlan(p),{code:'basic_template_only'});}
 const confirmation=plan();confirmation.confirmationItems.push({code:'pending'});assert.throws(()=>freezeBasicPlan(confirmation),{code:'confirmation_required'});
 const title=plan();title.properties.find(p=>p.type==='title').type='rich_text';assert.throws(()=>freezeBasicPlan(title),{code:'invalid_plan_structure'});
 const duplicate=plan();duplicate.properties[1].name=duplicate.properties[0].name;assert.throws(()=>freezeBasicPlan(duplicate),{code:'invalid_plan_structure'});
 const color=plan();color.selectOptions[0].options[0].color='#FFFFFF';assert.throws(()=>freezeBasicPlan(color),{code:'invalid_plan_structure'});
});
test('NB009A: missing approval or changed target/hash makes zero remote calls and writes no manifest',async t=>{
 const args=await setup(t);await assert.rejects(executeBasic({...args,approval:null}),{code:'explicit_approval_required'});await assert.rejects(executeBasic({...args,approval:{...args.approval,requestHash:'changed'}}),{code:'explicit_approval_required'});assert.equal(args.client.calls.length,0);assert.equal(await args.store.read(),null);
});
test('NB009A: protected PoC locations and state directory, wrong workspace and bot are rejected',async t=>{
 assert.throws(()=>normalizeTarget({...target,parentId:'4081f60f-fdfa-80dd-9435-dfd053c1d4b3'}),{code:'protected_parent'});assert.throws(()=>normalizeTarget({...target,workspaceId:PARENT_ID}),{code:'personal_workspace_required'});assert.throws(()=>new GenerationStore('basic-1','/tmp/.notion-poc-state/new'),{code:'protected_state_directory'});
 const args=await setup(t);const get=args.client.get.bind(args.client);args.client.get=async path=>path==='/v1/users/me'?{id:BOT,type:'bot',bot:{workspace_id:PARENT_ID,workspace_name:target.workspaceName}}:get(path);await assert.rejects(executeBasic(args),{code:'connection_identity_mismatch'});assert.equal(posts(args.client).length,0);
});
test('NB009A: protected ancestor and untracked child DB prevent any generation',async t=>{
 const args=await setup(t);args.client.pages.get(PARENT_ID).parent={page_id:'4081f60f-fdfa-80dd-9435-dfd053c1d4b3'};await assert.rejects(executeBasic(args),{code:'protected_parent_ancestry'});assert.equal(posts(args.client).length,0);
 args.client.pages.get(PARENT_ID).parent={workspace:true};const prepared=prepareExecution(args.plan,target,args.runId);await args.client.post('/v1/databases',prepared.createBody);const before=posts(args.client).length;await assert.rejects(executeBasic(args),{code:'parent_contains_untracked_database'});assert.equal(posts(args.client).length,before);
});
test('NB009A: successful run persists DB/DS/property IDs, exact readback, metadata marker and private atomic manifest',async t=>{
 const args=await setup(t),state=await executeBasic(args);assert.equal(state.status,'verified');assert.ok(state.verification.ok);assert.equal(Object.keys(state.propertyIds).length,args.plan.properties.length);assert.ok(state.remote.databaseId);assert.ok(state.remote.dataSourceId);assert.equal(posts(args.client).length,1);assert.equal(args.client.calls.filter(c=>c.method==='PATCH').length,1);assert.ok(args.client.calls.some(c=>c.method==='READ_QUERY'));assert.equal((await stat(args.store.path)).mode&0o777,0o600);assert.equal((await args.store.read()).planHash,state.planHash);
});
test('NB009A: same verified execution rechecks remotely without repeating any write',async t=>{
 const args=await setup(t);await executeBasic(args);const before=args.client.calls.filter(c=>['POST','PATCH'].includes(c.method)).length;const result=await executeBasic(args);assert.equal(result.status,'verified');assert.equal(result.reusedExistingRun,true);assert.equal(args.client.calls.filter(c=>['POST','PATCH'].includes(c.method)).length,before);
});
test('NB009A: changed plan or parent cannot reuse an old run manifest',async t=>{
 const args=await setup(t);await executeBasic(args);args.plan.properties.find(p=>p.type==='email').name='변경 이메일';reapprove(args);const before=posts(args.client).length;await assert.rejects(executeBasic(args),{code:'run_binding_mismatch'});assert.equal(posts(args.client).length,before);assert.equal((await args.store.read()).status,'verified');
});
test('NB009A: create response loss records uncertainty and readonly reconciliation never adopts/recreates automatically',async t=>{
 const args=await setup(t);args.client.loseCreate=true;await assert.rejects(executeBasic(args),{code:'transport_or_response_error'});assert.equal((await args.store.read()).status,'uncertain');assert.equal(posts(args.client).length,1);args.client.loseCreate=false;
 await assert.rejects(executeBasic(args),{code:'explicit_resume_required'});const result=await executeBasic({...args,resume:true});assert.equal(result.status,'manual_review');assert.equal(result.reconciliation.candidates.length,1);assert.equal(result.reconciliation.automaticallyAdopted,false);assert.equal(posts(args.client).length,1);
});
test('NB009A: partial naming failure retains IDs and resume only reads even when naming is still unresolved',async t=>{
 const args=await setup(t);args.client.failPatch=true;await assert.rejects(executeBasic(args),{code:'transport_or_response_error'});const partial=await args.store.read();assert.equal(partial.status,'partial');assert.ok(partial.remote.databaseId);assert.ok(partial.remote.dataSourceId);
 args.client.failPatch=false;const before=args.client.calls.filter(c=>c.method==='PATCH').length;const resumed=await executeBasic({...args,resume:true});assert.equal(resumed.status,'verification_failed');assert.equal(posts(args.client).length,1);assert.equal(args.client.calls.filter(c=>c.method==='PATCH').length,before);
});
test('NB009A: a lost PATCH response can be verified on resume without repeating the PATCH',async t=>{
 const args=await setup(t);const patch=args.client.patch.bind(args.client);args.client.patch=async(path,body)=>{await patch(path,body);throw new NotionError({code:'transport_or_response_error',uncertain:true});};await assert.rejects(executeBasic(args));const before=args.client.calls.filter(c=>c.method==='PATCH').length;const resumed=await executeBasic({...args,resume:true});assert.equal(resumed.status,'verified');assert.equal(args.client.calls.filter(c=>c.method==='PATCH').length,before);assert.equal(posts(args.client).length,1);
});
test('NB009A: post-create read failure keeps remote DB ID and never retries creation',async t=>{
 const args=await setup(t);args.client.failSourceRead=true;await assert.rejects(executeBasic(args),{code:'service_unavailable'});const state=await args.store.read();assert.ok(state.remote.databaseId);assert.equal(state.status,'partial');args.client.failSourceRead=false;const before=posts(args.client).length;await executeBasic({...args,resume:true});assert.equal(posts(args.client).length,before);
});
test('NB009A: mismatched remote schema is partial, and no cleanup or repair write is attempted',async t=>{
 const args=await setup(t);args.client.mismatch=true;await assert.rejects(executeBasic(args),{code:'initial_schema_mismatch'});const state=await args.store.read();assert.equal(state.status,'partial');assert.equal(state.verification.ok,false);assert.equal(args.client.calls.filter(c=>c.method==='PATCH').length,0);assert.equal(posts(args.client).length,1);
});
test('NB009A: ownership marker/parent changes and unexpected Data Sources are never accepted on readback',async t=>{
 const args=await setup(t);const state=await executeBasic(args),prepared=prepareExecution(args.plan,target,args.runId);args.client.databases.get(state.remote.databaseId).description=rich('foreign');await assert.rejects(verifyBasic(args.client,prepared,state),{code:'created_database_ownership_mismatch'});
 args.client.databases.get(state.remote.databaseId).description=rich(prepared.marker);args.client.databases.get(state.remote.databaseId).data_sources.push({id:PARENT_ID});await assert.rejects(verifyBasic(args.client,prepared,state),{code:'initial_data_source_count'});
});
test('NB009A: option colors/counts/IDs and nonempty rows cause verification failure',async t=>{
 const args=await setup(t);const state=await executeBasic(args),prepared=prepareExecution(args.plan,target,args.runId),source=args.client.sources.get(state.remote.dataSourceId),selection=source.properties['선정 상태'].select.options;
 selection[0].color='pink';assert.equal((await verifyBasic(args.client,prepared,state)).ok,false);selection[0].color='blue';selection[1].id=selection[0].id;assert.equal((await verifyBasic(args.client,prepared,state)).ok,false);
 args.client.request=async()=>({results:[{private:'SYNTHETIC_RESPONSE_DO_NOT_PERSIST'}],has_more:false});const result=await verifyBasic(args.client,prepared,state);assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_RESPONSE'));
});
test('NB009A: run lock, shared parent lock and missing/corrupt manifest/registry block duplicate creation',async t=>{
 const args=await setup(t);await args.store.lock();await assert.rejects(executeBasic(args),{code:'run_locked'});await args.store.unlock();const registry=args.store.targetStore(PARENT_ID);await registry.lock();await assert.rejects(executeBasic(args),{code:'run_locked'});await registry.unlock();assert.equal(posts(args.client).length,0);
 await writeFile(args.store.path,'{bad');await assert.rejects(executeBasic(args));assert.equal(posts(args.client).length,0);
});
test('NB009A: new copy requires separate explicit approval and unresolved prior attempt always blocks another run',async t=>{
 const args=await setup(t);await executeBasic(args);const next={...args,runId:'basic-test-2',store:new GenerationStore('basic-test-2',args.store.directory)};reapprove(next);await assert.rejects(executeBasic(next),{code:'explicit_additional_copy_required'});next.approval.allowAdditionalCopy=true;await executeBasic(next);assert.equal(posts(args.client).length,2);
 const uncertain={...args,runId:'basic-test-3',store:new GenerationStore('basic-test-3',args.store.directory)};reapprove(uncertain);uncertain.approval.allowAdditionalCopy=true;args.client.loseCreate=true;await assert.rejects(executeBasic(uncertain));const last={...args,runId:'basic-test-4',store:new GenerationStore('basic-test-4',args.store.directory)};reapprove(last);last.approval.allowAdditionalCopy=true;await assert.rejects(executeBasic(last),{code:'unresolved_target_attempt'});
});
test('NB009A: same logical plan can run in a separate explicitly approved parent',async t=>{
 const args=await setup(t);await executeBasic(args);const parent='44444444-4444-4444-8444-444444444444';args.client.pages.set(parent,{object:'page',id:parent,parent:{workspace:true},properties:{title:{type:'title',title:rich(target.parentTitle)}}});const next={...args,runId:'basic-test-2',store:new GenerationStore('basic-test-2',args.store.directory),target:{...target,parentId:parent}};reapprove(next);assert.equal((await executeBasic(next)).status,'verified');assert.equal(posts(args.client).length,2);
});
test('NB009A: 401/403 parent failure produces zero create calls, POST 400/429 is never repeated',async t=>{
 for(const status of [401,403]){const args=await setup(t);const get=args.client.get.bind(args.client);args.client.get=async path=>{if(path.startsWith('/v1/pages/'))throw new NotionError({status,code:'restricted_resource'});return get(path);};await assert.rejects(executeBasic(args));assert.equal(posts(args.client).length,0);}
 for(const status of [400,429]){const args=await setup(t);args.client.rejectCreate=status;await assert.rejects(executeBasic(args));assert.equal(posts(args.client).length,1);assert.equal((await args.store.read()).status,'creation_rejected');await assert.rejects(executeBasic(args),{code:'explicit_resume_required'});assert.equal(posts(args.client).length,1);}
});
test('NB009A: transport client with retries enabled is rejected and sensitive exception text is never persisted',async t=>{
 const args=await setup(t);args.client.maxRetries=3;await assert.rejects(executeBasic(args),{code:'write_retries_must_be_disabled'});assert.equal(args.client.calls.length,0);args.client.maxRetries=0;
 args.client.post=async()=>{throw Error('SYNTHETIC_TOKEN_NEVER_LOG');};await assert.rejects(executeBasic(args),{code:'internal_error'});assert.ok(!(await readFile(args.store.path,'utf8')).includes('SYNTHETIC_TOKEN'));
});
test('NB009A CLI: Dry Run needs no token, unauthorized apply has no state or network, invalid arguments fail safely',async t=>{
 const args=await setup(t);const file=join(args.store.directory,'plan.json');await writeFile(file,JSON.stringify(args.plan));
 const env={PATH:process.env.PATH};const dry=spawnSync(process.execPath,['scripts/basic-notion/cli.mjs','dry-run','--plan',file],{encoding:'utf8',env});assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).networkRequests,0);
 const live=spawnSync(process.execPath,['scripts/basic-notion/cli.mjs','apply','--plan',file],{encoding:'utf8',env});assert.notEqual(live.status,0);assert.equal(await args.store.read(),null);assert.ok(!live.stderr.includes('SYNTHETIC_TOKEN'));
 const invalid=spawnSync(process.execPath,['scripts/basic-notion/cli.mjs','delete','--plan',file],{encoding:'utf8',env});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/unknown_command/);
});
