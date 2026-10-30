import {prepareStandard,validateStandardApproval,createBody,fieldBy,rich,safeId,sameId,reject,TASK,marker} from './plan.mjs';
import {StandardStore} from './store.mjs';
import {standardPreflight,ownedSource,bindFields,schemaMatches,relationPair,calculationMatches,ownedRow,rowBody,rowSource,text,blockChildren} from './remote.mjs';
import {assertBinding,verifyStandard} from './verify.mjs';
const now=()=>new Date().toISOString();
const safeError=e=>({code:/^[a-z0-9_]{1,80}$/.test(e?.code??'')?e.code:'internal_error',status:Number.isInteger(e?.status)?e.status:null,uncertain:e?.uncertain===true});
export async function executeStandard({plan,target,fixture,runId,approval,client,store=new StandardStore(runId),resume=false}){
 const p=prepareStandard(plan,target,runId,fixture),authorized=validateStandardApproval(approval,p);
 if(!(store instanceof StandardStore)||store.runId!==runId)reject('dedicated_store_required');
 if(client.maxRetries!==0)reject('write_retries_must_be_disabled');
 const registry=store.targetStore(p.target.parentId);await store.lock();let registryLocked=false,state,index,bound=false;
 try{
  await registry.lock();registryLocked=true;state=await store.read();index=await registry.read();
  if(index&&(index.task!==TASK||!sameId(index.parentId,p.target.parentId)||!Array.isArray(index.attempts)))reject('invalid_target_registry');
  index??={task:TASK,parentId:p.target.parentId,attempts:[]};
  const attempt=index.attempts.find(a=>a.runId===runId);
  if(state)assertBinding(state,p);
  if(attempt&&(!state||attempt.requestHash!==p.requestHash)||state&&!attempt)reject('registry_binding_mismatch');
  const preflight=await standardPreflight(client,p.target);
  if(state&&state.status!=='verified'&&!resume)reject('explicit_resume_required');
  if(!state){
   if(index.attempts.length)reject('target_already_attempted');if(preflight.databases.length)reject('parent_contains_untracked_database');
   state={task:TASK,manifestVersion:1,runId,planId:p.spec.planId,planHash:p.spec.planHash,requestHash:p.requestHash,spec:p.spec,target:p.target,fixture:p.fixture,fixtureHash:p.fixtureHash,approval:authorized,databases:{},propertyIds:{},rows:{},journal:{},writeAttempts:0,status:'prepared',startedAt:now(),preflight};
   index.attempts.push({runId,requestHash:p.requestHash,status:'prepared'});await store.save(state);await registry.save(index);
  }
  bound=true;
  const persist=async status=>{state.status=status;state.updatedAt=now();const a=index.attempts.find(a=>a.runId===runId);a.status=status;a.databases=state.databases;await store.save(state);await registry.save(index);};
  const checkChildren=async()=>{const ids=(await blockChildren(client,p.target.parentId)).filter(b=>b.type==='child_database').map(b=>b.id);if(ids.some(id=>!Object.values(state.databases).some(d=>sameId(d.databaseId,id))))reject('parent_contains_untracked_database');};
  // A recorded write is only reconciled by reads. Never resend it, even after a definite rejection.
  const step=async(key,probe,write)=>{
   const old=state.journal[key];
   if(old){if(await probe()){old.status='complete';state.lastCompletedStage=key;await persist('running');return;}reject('manual_review_required');}
   if(await probe())return;
   if(state.writeAttempts>=p.scope.maxWrites)reject('approved_write_limit');
   state.journal[key]={status:'started',at:now()};state.writeAttempts++;await persist('running');
   try{await write();state.journal[key].status='response_received';await persist('running');if(!await probe())reject('write_readback_mismatch');state.journal[key].status='complete';state.lastCompletedStage=key;await persist('running');}
   catch(e){state.journal[key].status=e.uncertain?'uncertain':'needs_readback';state.journal[key].error=safeError(e);await persist('partial');throw e;}
  };
  if(state.status==='verified'){state.verification=await verifyStandard(client,p,state);await persist(state.verification.ok?'verified':'verification_failed');return {...state,reusedExistingRun:true};}
  // Unknown POST outcome: inspect markers for the user, but never infer/adopt a new ID.
  const unknown=Object.entries(state.journal).find(([key])=>key.startsWith('db:')&&!state.databases[key.slice(3)]?.databaseId||key.startsWith('row:')&&!state.rows[key.slice(4)]?.pageId);
  if(unknown){const [key]=unknown,candidates=[];if(key.startsWith('db:')){for(const b of await blockChildren(client,p.target.parentId)){if(b.type!=='child_database')continue;const d=await client.get(`/v1/databases/${safeId(b.id)}`);if(text(d.description)===marker(p,key.slice(3)))candidates.push({databaseId:d.id});}}else{const sourceId=rowSource(p,key.slice(4)),o=await ownedSource(client,p,state,sourceId);for(const page of await client.queryAll(o.dataSourceId)){const blocks=await blockChildren(client,page.id);if(blocks.some(b=>b.type==='paragraph'&&text(b.paragraph.rich_text)===marker(p,key.slice(4))))candidates.push({pageId:page.id});}}state.reconciliation={key,candidates,automaticallyAdopted:false,writeRequests:0};await persist('manual_review');return state;}
  await checkChildren();
  for(const d of p.spec.databases){
   const probe=async()=>{if(!state.databases[d.logicalId]?.databaseId)return false;const o=await ownedSource(client,p,state,d.dataSourceLogicalId);bindFields(p,state,o);if(!p.spec.fields.filter(f=>f.sourceId===d.dataSourceLogicalId&& !['relation','rollup','formula'].includes(f.type)).every(f=>schemaMatches(p,state,o,f)))reject('initial_schema_mismatch');return true;};
   await step(`db:${d.logicalId}`,probe,async()=>{await checkChildren();const result=await client.post('/v1/databases',createBody(p,d));if(result.object!=='database')reject('invalid_create_response');state.databases[d.logicalId]={databaseId:safeId(result.id)};await persist('running');});
   await step(`name:${d.logicalId}`,async()=>text((await ownedSource(client,p,state,d.dataSourceLogicalId)).source.title)===d.name,async()=>{const o=await ownedSource(client,p,state,d.dataSourceLogicalId);await client.patch(`/v1/data_sources/${o.dataSourceId}`,{title:rich(d.name)});});
  }
  for(const r of p.spec.relations){
   await step(`relation:${r.logicalId}`,async()=>Boolean(await relationPair(client,p,state,r)),async()=>{const s=await ownedSource(client,p,state,r.sourceId),t=await ownedSource(client,p,state,r.targetId);await client.patch(`/v1/data_sources/${s.dataSourceId}`,{properties:{[fieldBy(p,r.propertyId).name]:{relation:{data_source_id:t.dataSourceId,type:'dual_property',dual_property:{}}}}});});
   await step(`reverse:${r.logicalId}`,async()=>{const pair=await relationPair(client,p,state,r);return pair?.reverse.name===fieldBy(p,r.reversePropertyId).name;},async()=>{const pair=await relationPair(client,p,state,r);await client.patch(`/v1/data_sources/${pair.target.dataSourceId}`,{properties:{[pair.reverse.id]:{name:fieldBy(p,r.reversePropertyId).name}}});});
  }
  for(const id of p.spec.calculationOrder){const f=fieldBy(p,id);
   await step(`calculation:${id}`,async()=>{const o=await ownedSource(client,p,state,f.sourceId);bindFields(p,state,o);return calculationMatches(p,state,o,id);},async()=>{const o=await ownedSource(client,p,state,f.sourceId),formula=p.spec.formulas.find(c=>c.propertyId===id),rollup=p.spec.rollups.find(c=>c.propertyId===id);const definition=formula?{formula:{expression:formula.expression}}:{rollup:{relation_property_id:state.propertyIds[rollup.relationPropertyId],rollup_property_id:state.propertyIds[rollup.targetPropertyId],function:rollup.apiFunction}};await client.patch(`/v1/data_sources/${o.dataSourceId}`,{properties:{[f.name]:definition}});});
  }
  for(const d of p.spec.databases){const o=await ownedSource(client,p,state,d.dataSourceLogicalId),actual=await client.queryAll(o.dataSourceId);if(actual.some(row=>!Object.values(state.rows).some(r=>sameId(r.pageId,row.id))))reject('untracked_rows');}
  for(const group of ['people','programs','applications'])for(const row of p.fixture[group])await step(`row:${row.key}`,async()=>Boolean(await ownedRow(client,p,state,row)),async()=>{await ownedSource(client,p,state,rowSource(p,row.key));const result=await client.post('/v1/pages',rowBody(p,state,row));if(result.object!=='page')reject('invalid_row_response');state.rows[row.key]={pageId:safeId(result.id),sourceId:rowSource(p,row.key)};await persist('running');});
  await persist('verification_pending');
  for(let attempt=0;attempt<3;attempt++){state.verification=await verifyStandard(client,p,state);if(state.verification.ok)break;}
  await persist(state.verification.ok?'verified':'verification_failed');return state;
 }catch(e){if(bound){state.error=safeError(e);state.status=e.code==='manual_review_required'?'manual_review':e.uncertain?'uncertain':'partial';state.updatedAt=now();const a=index.attempts.find(a=>a.runId===runId);a.status=state.status;await store.save(state);await registry.save(index);}reject(safeError(e).code);
 }finally{if(registryLocked)await registry.unlock();await store.unlock();}
}
