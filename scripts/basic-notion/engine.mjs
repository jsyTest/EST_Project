import {TASK,PROTECTED_IDS,prepareExecution,validateApproval,digest,text,safeId,sameId,reject,BasicError} from './plan.mjs';
import {GenerationStore} from './store.mjs';
const now=()=>new Date().toISOString();
function safeError(error){return {code:/^[a-z0-9_]{1,80}$/.test(error?.code??'')?error.code:'internal_error',status:Number.isInteger(error?.status)?error.status:null,uncertain:error?.uncertain===true};}
async function children(client,parentId){const ids=[],databases=[];let cursor;const seen=new Set();
 do{const result=await client.get(`/v1/blocks/${parentId}/children?page_size=100${cursor?`&start_cursor=${encodeURIComponent(cursor)}`:''}`);if(!Array.isArray(result.results))reject('invalid_children_response');
  for(const block of result.results){ids.push(block.id);if(block.type==='child_database')databases.push(safeId(block.id));}
  if(ids.length>1000)reject('parent_inspection_limit');cursor=result.has_more?result.next_cursor:null;if(result.has_more&&(!cursor||seen.has(cursor)))reject('invalid_pagination');seen.add(cursor);
 }while(cursor);return databases;
}
export async function basicPreflight(client,target){
 const self=await client.get('/v1/users/me');if(self.type!=='bot'||!sameId(self.id,target.botId)||self.bot?.workspace_name!==target.workspaceName||!sameId(self.bot?.workspace_id,target.workspaceId))reject('connection_identity_mismatch');
 let id=target.parentId;const seen=new Set();let parent;
 for(let depth=0;depth<20;depth++){
  if(PROTECTED_IDS.has(id))reject('protected_parent_ancestry');if(seen.has(id))reject('parent_ancestry_cycle');seen.add(id);
  const page=await client.get(`/v1/pages/${id}`);if(page.object!=='page'||!sameId(page.id,id)||page.archived||page.in_trash||page.is_locked)reject('parent_unavailable');
  if(!parent){parent=page;const title=Object.values(page.properties??{}).find(p=>p.type==='title'||Array.isArray(p.title))?.title;if(text(title)!==target.parentTitle)reject('parent_title_mismatch');}
  if(page.parent?.workspace===true)break;
  if(!page.parent?.page_id||depth===19)reject('unsupported_parent_ancestry');id=safeId(page.parent.page_id);
 }
 const databaseIds=await children(client,target.parentId);
 return {parent:{id:target.parentId,title:target.parentTitle,url:`https://www.notion.so/${target.parentId.replaceAll('-','')}`},botId:target.botId,workspaceName:self.bot.workspace_name,workspaceId:target.workspaceId,workspaceIdSource:'REST bot.workspace_id matched explicit personal workspace',readAccessVerified:true,insertUpdateCapabilities:'not proven by read requests; API response or connection settings required',privacy:'user-attested, not proven by REST',databaseIds,mutations:0};
}
function assertState(state,prepared){
 if(state.task!==TASK||state.runId!==prepared.runId||state.planHash!==prepared.spec.planHash||state.requestHash!==prepared.requestHash||digest(state.spec)!==digest(prepared.spec)||digest(state.target)!==digest(prepared.target))reject('run_binding_mismatch');
}
async function readOwned(client,prepared,state){
 const databaseId=safeId(state.remote?.databaseId);if(PROTECTED_IDS.has(databaseId))reject('protected_remote_id');
 const database=await client.get(`/v1/databases/${databaseId}`);
 if(database.object!=='database'||!sameId(database.id,databaseId)||!sameId(database.parent?.page_id,prepared.target.parentId)||text(database.description)!==prepared.marker||database.archived||database.in_trash)reject('created_database_ownership_mismatch');
 if(!Array.isArray(database.data_sources)||database.data_sources.length!==1)reject('initial_data_source_count');
 const dataSourceId=safeId(database.data_sources[0].id);if(state.remote?.dataSourceId&&!sameId(dataSourceId,state.remote.dataSourceId))reject('data_source_id_mismatch');
 const source=await client.get(`/v1/data_sources/${dataSourceId}`);
 if(source.object!=='data_source'||!sameId(source.id,dataSourceId)||!sameId(source.parent?.database_id,databaseId)||source.archived||source.in_trash)reject('data_source_parent_mismatch');
 return {database,source,databaseId,dataSourceId};
}
function compareSchema(prepared,owned,{checkSourceName=true}={}){
 const checks=[];const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});const {database,source}=owned,expected=prepared.spec.fields,actual=source.properties??{};
 check('database name',text(database.title)===prepared.spec.databaseName);
 if(checkSourceName)check('data source name',text(source.title)===prepared.spec.dataSourceName);
 check('property count',Object.keys(actual).length===expected.length);check('one title',Object.values(actual).filter(p=>p.type==='title').length===1);
 const propertyIds={},ids=new Set();
 for(const p of expected){const a=actual[p.name];check(`${p.logicalId}: name/type`,a?.name===p.name&&a?.type===p.type);check(`${p.logicalId}: remote ID`,typeof a?.id==='string'&&a.id.length>0&&!ids.has(a.id));if(a?.id){ids.add(a.id);propertyIds[p.logicalId]=a.id;}
  if(p.options){const options=a?.[p.type]?.options;check(`${p.logicalId}: option count`,Array.isArray(options)&&options.length===p.options.length);
   check(`${p.logicalId}: unique option IDs`,Array.isArray(options)&&new Set(options.map(o=>o.id)).size===options.length);
   for(const o of p.options)check(`${p.logicalId}: option ${o.name}`,options?.filter(a=>a.name===o.name&&a.color===o.color&&typeof a.id==='string'&&a.id.length>0).length===1);
  }
 }
 return {ok:checks.every(c=>c.ok),checks,propertyIds};
}
export async function verifyBasic(client,prepared,state){
 assertState(state,prepared);const owned=await readOwned(client,prepared,state),result=compareSchema(prepared,owned);
 const rows=await client.request('POST',`/v1/data_sources/${owned.dataSourceId}/query`,{page_size:1},{readOnly:true});
 result.checks.push({name:'empty structure; no response rows',ok:Array.isArray(rows.results)&&rows.results.length===0&&!rows.has_more});result.ok=result.checks.every(c=>c.ok);
 return {...result,verifiedAt:now(),databaseId:owned.databaseId,dataSourceId:owned.dataSourceId,databaseName:text(owned.database.title),dataSourceName:text(owned.source.title),url:`https://www.notion.so/${owned.databaseId.replaceAll('-','')}`,rowsReadForEmptinessOnly:true};
}
async function inspectUncertain(client,prepared){
 const candidates=[];for(const id of await children(client,prepared.target.parentId)){if(PROTECTED_IDS.has(id))continue;const db=await client.get(`/v1/databases/${id}`);if(sameId(db.parent?.page_id,prepared.target.parentId)&&text(db.description)===prepared.marker)candidates.push({databaseId:id,name:text(db.title),url:`https://www.notion.so/${id.replaceAll('-','')}`});}
 return {status:'manual_review',candidates,automaticallyAdopted:false,writeRequests:0};
}
export async function executeBasic({plan,target,runId,approval,client,store=new GenerationStore(runId),resume=false}){
 const prepared=prepareExecution(plan,target,runId),authorized=validateApproval(approval,prepared);
 if(!(store instanceof GenerationStore)||store.runId!==runId)reject('dedicated_store_required');
 if(client.maxRetries!==undefined&&client.maxRetries!==0)reject('write_retries_must_be_disabled');
 const registry=store.targetStore(prepared.target.parentId);await store.lock();let locked=false,state,index,postStarted=false,stateBound=false;
 try{
  await registry.lock();locked=true;state=await store.read();index=await registry.read();
  if(index&&(index.task!==TASK||!sameId(index.parentId,prepared.target.parentId)||!Array.isArray(index.attempts)))reject('invalid_target_registry');
  index??={task:TASK,parentId:prepared.target.parentId,attempts:[]};
  if(state)assertState(state,prepared);
  const attempt=index.attempts.find(a=>a.runId===runId);
  if(attempt&&(attempt.requestHash!==prepared.requestHash||attempt.planHash!==prepared.spec.planHash))reject('registry_binding_mismatch');
  if(attempt&&!state)reject('manifest_missing_after_attempt');
  if(state&&!attempt)reject('registry_missing_after_attempt');
  stateBound=Boolean(state);
  const preflight=await basicPreflight(client,prepared.target);
  if(state){
   if(state.status!=='verified'&&!resume)reject('explicit_resume_required');
   if(!state.remote?.databaseId){state.reconciliation=await inspectUncertain(client,prepared);state.status='manual_review';state.updatedAt=now();await store.save(state);return {...state,reusedExistingRun:true};}
   const verification=await verifyBasic(client,prepared,state);state.verification=verification;state.propertyIds=verification.propertyIds;state.remote.dataSourceId=verification.dataSourceId;state.status=verification.ok?'verified':'verification_failed';state.updatedAt=now();await store.save(state);attempt.status=state.status;attempt.databaseId=state.remote.databaseId;await registry.save(index);return {...state,reusedExistingRun:true};
  }
  if(index.attempts.some(a=>a.status!=='verified'))reject('unresolved_target_attempt');
  if(index.attempts.length&&!authorized.allowAdditionalCopy)reject('explicit_additional_copy_required');
  const known=index.attempts.map(a=>a.databaseId);if(preflight.databaseIds.some(id=>!known.some(k=>sameId(k,id))))reject('parent_contains_untracked_database');
  state={task:TASK,manifestVersion:1,runId,planId:prepared.spec.planId,planHash:prepared.spec.planHash,requestHash:prepared.requestHash,apiVersion:prepared.spec.apiVersion,target:prepared.target,spec:prepared.spec,approval:authorized,status:'prepared',remote:{databaseId:null,dataSourceId:null},propertyIds:{},steps:[],writeAttempts:0,startedAt:now(),updatedAt:now(),preflight};
  const registration={runId,planHash:state.planHash,requestHash:state.requestHash,status:'prepared',databaseId:null};index.attempts.push(registration);
  await store.save(state);await registry.save(index);
  async function persist(status){state.status=status;state.updatedAt=now();registration.status=status;registration.databaseId=state.remote.databaseId;await store.save(state);await registry.save(index);}
  state.steps.push({name:'create_database',status:'started',at:now()});state.writeAttempts++;await persist('creating');postStarted=true;
  const created=await client.post('/v1/databases',prepared.createBody);
  if(created.object!=='database')reject('invalid_create_response');
  state.remote.databaseId=safeId(created.id);state.steps.at(-1).status='response_received';await persist('database_created');
  if(Array.isArray(created.data_sources)&&created.data_sources.length===1){state.remote.dataSourceId=safeId(created.data_sources[0].id);await persist('database_created');}
  const owned=await readOwned(client,prepared,state);state.remote.dataSourceId=owned.dataSourceId;await persist('database_created');
  const initial=compareSchema(prepared,owned,{checkSourceName:false});if(!initial.ok){state.verification=initial;reject('initial_schema_mismatch');}
  if(text(owned.source.title)!==prepared.spec.dataSourceName){state.steps.push({name:'name_new_data_source',status:'started',at:now()});state.writeAttempts++;await persist('naming_data_source');await client.patch(`/v1/data_sources/${owned.dataSourceId}`,prepared.renameBody);state.steps.at(-1).status='response_received';await persist('data_source_named');}
  await persist('verification_pending');const verification=await verifyBasic(client,prepared,state);state.verification=verification;state.propertyIds=verification.propertyIds;
  await persist(verification.ok?'verified':'verification_failed');return state;
 }catch(error){
  if(state&&(postStarted||stateBound)){state.error=safeError(error);state.status=state.remote?.databaseId?(postStarted?'partial':'verification_failed'):error.uncertain===true||!(error.status>=400&&error.status<500)?'uncertain':'creation_rejected';state.updatedAt=now();
   const attempt=index?.attempts.find(a=>a.runId===runId);if(attempt){attempt.status=state.status;attempt.databaseId=state.remote.databaseId;}
   await store.save(state).catch(()=>{});if(index)await registry.save(index).catch(()=>{});
  }
  if(error instanceof BasicError)throw error;throw new BasicError(safeError(error).code);
 }finally{if(locked)await registry.unlock();await store.unlock();}
}
