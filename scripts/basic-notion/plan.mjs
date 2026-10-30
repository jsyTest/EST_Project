import {createHash} from 'node:crypto';
import {validateGenerationPlan} from '../../js/planner/plan.mjs';
import {API_VERSION,normalizeId,validateRunId} from '../notion-poc/config.mjs';
export const TASK='NB-V2-009A';
export const PERSONAL_WORKSPACE_ID='10e1f60f-fdfa-8128-b201-00037feeb155';
export const SUPPORTED_TYPES=['title','rich_text','email','phone_number','number','date','checkbox','select','multi_select'];
export const PROTECTED_IDS=new Set(['4081f60f-fdfa-80dd-9435-dfd053c1d4b3','4081f60f-fdfa-818d-8a2a-e202f2531cc9','96016cd2-3280-43cc-a356-e6583b5c1ead','68e888d3-45ac-43bc-9c1f-2473b5de2a19','8834d429-460c-41aa-b542-67b256558882','1bc27dc2-a75a-42a5-abbb-2cfc3ada1f5b','bcbeee3e-1742-4e93-8c26-438f3d2e7d9e','c065661f-4d53-4f37-9fe6-f7c7e745e074']);
export class BasicError extends Error{constructor(code){super(code);this.name='BasicError';this.code=code;}}
export const reject=code=>{throw new BasicError(code);};
export const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
export const rich=value=>[{type:'text',text:{content:value}}];
export const text=value=>(value??[]).map(t=>t.plain_text??t.text?.content??'').join('');
export function safeId(value){try{return normalizeId(value);}catch{reject('invalid_remote_id');}}
export function sameId(a,b){try{return normalizeId(a)===normalizeId(b);}catch{return false;}}
const only=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
export function freezeBasicPlan(plan){
 let frozen;try{frozen=JSON.parse(JSON.stringify(plan));}catch{reject('invalid_plan');}
 if(frozen?.planVersion!==1)reject('unsupported_plan_version');
 if(frozen.templateType!=='basic')reject('basic_template_only');
 if(!Array.isArray(frozen.properties)||frozen.properties.length<1||frozen.properties.length>100)reject('property_count_limit');
 if(frozen.properties.some(p=>!SUPPORTED_TYPES.includes(p?.type)))reject('unsupported_property_type');
 let result;try{result=validateGenerationPlan(frozen);}catch{reject('invalid_plan');}
 if(!result.ok)reject('invalid_plan_structure');
 if(frozen.mode!=='dry-run'||frozen.notionApiVersion!==API_VERSION||!/^plan-[a-f0-9]{16}$/.test(frozen.planId??''))reject('invalid_plan_identity');
 if(frozen.dryRunValid!==true||!Array.isArray(frozen.blockingErrors)||frozen.blockingErrors.length)reject('plan_blocked');
 if(!Array.isArray(frozen.confirmationItems)||frozen.confirmationItems.length)reject('confirmation_required');
 if(frozen.databases.length!==1||frozen.dataSources.length!==1||frozen.enabledModules.length||frozen.relations.length||frozen.rollups.length||frozen.formulas.length||frozen.statusOptions.length)reject('basic_template_only');
 if(frozen.dataResolution?.rowsIncluded!==false||frozen.dataResolution?.calculatedValues!==null)reject('rows_not_allowed');
 if(frozen.unresolvedBindings?.resolved!==false)reject('unexpected_remote_binding');
 if(frozen.delta?.reuseDatabases?.length||frozen.delta?.changedProperties?.length||frozen.delta?.removedLogicalIds?.length)reject('existing_database_changes_not_allowed');
 const database=frozen.databases[0],source=frozen.dataSources[0];
 if(database.dataSourceId!==source.id||source.databaseId!==database.id)reject('unresolved_reference');
 const fields=frozen.properties.map(p=>{
  if(!only(p,['id','dataSourceId','name','type','sourceRefs','origin','support'])||p.dataSourceId!==source.id)reject('unsupported_property_configuration');
  const field={logicalId:p.id,name:p.name,type:p.type};
  if(['select','multi_select'].includes(p.type)){
   const config=frozen.selectOptions.find(c=>c.propertyId===p.id);
   if(!only(config,['propertyId','options','support'])||config.options.length>100)reject('unsupported_option_configuration');
   field.options=config.options.map(o=>{if(!only(o,['name','color','colorSource']))reject('unsupported_option_configuration');return {name:o.name,color:o.color};});
  }
  return field;
 });
 const sourceName=source.name??database.name;if(typeof sourceName!=='string'||!sourceName.trim()||sourceName.length>100)reject('invalid_source_name');
 const spec={apiVersion:API_VERSION,planId:frozen.planId,planHash:digest(frozen),databaseLogicalId:database.id,dataSourceLogicalId:source.id,databaseName:database.name,dataSourceName:sourceName,fields};
 return JSON.parse(JSON.stringify(spec));
}
export function normalizeTarget(target){
 if(!target||target.kind!=='personal-test'||!sameId(target.workspaceId,PERSONAL_WORKSPACE_ID))reject('personal_workspace_required');
 const parentId=safeId(target.parentId),botId=safeId(target.botId);
 if(PROTECTED_IDS.has(parentId))reject('protected_parent');
 if(typeof target.parentTitle!=='string'||! /^(?:\[TEST\]\s*)?NB-V2-009A(?:\s|$)/.test(target.parentTitle)||target.parentTitle.length>100)reject('dedicated_parent_required');
 if(typeof target.workspaceName!=='string'||!target.workspaceName.trim()||target.workspaceName.length>100)reject('workspace_name_required');
 return {kind:'personal-test',workspaceId:PERSONAL_WORKSPACE_ID,workspaceName:target.workspaceName,parentId,parentTitle:target.parentTitle,botId};
}
export function prepareExecution(plan,target,runId){
 validateRunId(runId);const spec=freezeBasicPlan(plan),binding=normalizeTarget(target);
 const marker=`${TASK} run:${runId} plan-sha256:${spec.planHash}`;
 const properties=Object.fromEntries(spec.fields.map(p=>[p.name,{[p.type]:p.options?{options:p.options}:{}}]));
 const createBody={parent:{type:'page_id',page_id:binding.parentId},title:rich(spec.databaseName),description:rich(marker),is_inline:true,initial_data_source:{properties}};
 const renameBody={title:rich(spec.dataSourceName)};
 const requestHash=digest({apiVersion:API_VERSION,runId,spec,binding,createBody,renameBody});
 return {task:TASK,mode:'dry-run',runId,spec,target:binding,marker,requestHash,createBody,renameBody,scope:{databases:1,dataSources:1,createDatabasePosts:1,newDataSourceNamePatchesMax:1,rows:0,newPages:0,existingObjectsModified:0},networkRequests:0};
}
export function validateApproval(approval,prepared){
 if(approval?.approved!==true||approval.task!==TASK||approval.runId!==prepared.runId||approval.planHash!==prepared.spec.planHash||approval.requestHash!==prepared.requestHash||!sameId(approval.parentId,prepared.target.parentId)||!sameId(approval.workspaceId,prepared.target.workspaceId)||!sameId(approval.botId,prepared.target.botId)||approval.personalPrivatePageConfirmed!==true||!Number.isFinite(Date.parse(approval.approvedAt??'')))reject('explicit_approval_required');
 return {approvedAt:approval.approvedAt,requestHash:approval.requestHash,allowAdditionalCopy:approval.allowAdditionalCopy===true,personalPrivatePageConfirmed:true};
}
