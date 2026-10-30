import {validateGenerationPlan} from '../../js/planner/plan.mjs';
import {API_VERSION,validateRunId} from '../notion-poc/config.mjs';
import {PERSONAL_WORKSPACE_ID,PROTECTED_IDS as BASIC_PROTECTED,digest,rich,safeId,sameId,reject} from '../basic-notion/plan.mjs';
export {digest,rich,safeId,sameId,reject};
export const TASK='NB-V2-009B',COMPILER_VERSION=1;
export const PROTECTED_IDS=new Set([...BASIC_PROTECTED,'4091f60f-fdfa-818b-b496-ceed30116dc6','a72bbd64-de62-4a95-a39b-e75ad5db01a1','d67da62e-98fc-4ec9-b16e-dff7ca76a8bc']);
export const ROLLUP_FUNCTIONS={count_all:'count',sum:'sum',average:'average'};
export const BASIC_TYPES=['title','rich_text','email','phone_number','number','date','checkbox','select','multi_select'];
export function normalizeStandardTarget(value){
 if(value?.kind!=='personal-test'||!sameId(value.workspaceId,PERSONAL_WORKSPACE_ID))reject('personal_workspace_required');
 const parentId=safeId(value.parentId);if(PROTECTED_IDS.has(parentId))reject('protected_parent');
 if(typeof value.parentTitle!=='string'||! /^(?:\[TEST\]\s*)?NB-V2-009B(?:\s|$)/.test(value.parentTitle)||value.parentTitle.length>100)reject('dedicated_parent_required');
 if(typeof value.workspaceName!=='string'||!value.workspaceName.trim())reject('workspace_name_required');
 return {kind:'personal-test',workspaceId:PERSONAL_WORKSPACE_ID,workspaceName:value.workspaceName,botId:safeId(value.botId),parentId,parentTitle:value.parentTitle};
}
export function prepareStandard(plan,target,runId,fixture){
 validateRunId(runId);let copy;try{copy=JSON.parse(JSON.stringify(plan));}catch{reject('invalid_plan');}
 if(copy?.planVersion!==1||copy.notionApiVersion!==API_VERSION||!/^plan-[a-f0-9]{16}$/.test(copy.planId??''))reject('invalid_plan_version');
 if(copy.templateType!=='standard'||copy.databases?.length!==3||copy.dataSources?.length!==3||copy.enabledModules?.length)reject('standard_template_only');
 let validation;try{validation=validateGenerationPlan(copy);}catch{reject('invalid_plan');}if(!validation.ok||copy.dryRunValid!==true||!Array.isArray(copy.blockingErrors)||copy.blockingErrors.length)reject('invalid_plan_structure');
 if(!Array.isArray(copy.confirmationItems)||copy.confirmationItems.some(c=>c.code!=='IDENTITY_POLICY_PENDING'))reject('confirmation_required');
 if(copy.statusOptions.length||copy.properties.some(p=>![...BASIC_TYPES,'relation','rollup','formula'].includes(p.type)))reject('unsupported_property_type');
 if(copy.properties.length>100||copy.relations.length!==2||copy.formulas.some(f=>!['relation_count','equals_option'].includes(f.ast.op)))reject('unsupported_plan_scope');
 if(copy.delta?.reuseDatabases?.length||copy.delta?.changedProperties?.length||copy.dataResolution?.rowsIncluded!==false||copy.unresolvedBindings?.resolved!==false)reject('new_objects_only');
 const databases=copy.databases.map(d=>({logicalId:d.id,key:d.key,name:d.name,dataSourceLogicalId:d.dataSourceId}));
 if(new Set(databases.map(d=>d.key)).size!==3||!['people','programs','applications'].every(key=>databases.some(d=>d.key===key)))reject('standard_database_keys');
 const fields=copy.properties.map(p=>{
  if(Object.keys(p).some(k=>!['id','dataSourceId','name','type','sourceRefs','origin','support'].includes(k)))reject('unsupported_property_configuration');
  const f={logicalId:p.id,sourceId:p.dataSourceId,name:p.name,type:p.type};
  if(['select','multi_select'].includes(p.type)){const o=copy.selectOptions.find(o=>o.propertyId===p.id);if(o.options.length>100||o.options.some(o=>Object.keys(o).some(k=>!['name','color','colorSource'].includes(k))))reject('unsupported_option_configuration');f.options=o.options.map(({name,color})=>({name,color}));}return f;
 });
 const formulas=copy.formulas.map(f=>({propertyId:f.propertyId,ast:f.ast,expression:f.expression}));
 const rollups=copy.rollups.map(r=>{if(!Object.hasOwn(ROLLUP_FUNCTIONS,r.function))reject('unsupported_rollup_function');return {propertyId:r.propertyId,relationPropertyId:r.relationPropertyId,targetPropertyId:r.targetPropertyId,logicalFunction:r.function,apiFunction:ROLLUP_FUNCTIONS[r.function]};});
 const relations=copy.relations.map(r=>({logicalId:r.id,sourceId:r.sourceDataSourceId,targetId:r.targetDataSourceId,propertyId:r.propertyId,reversePropertyId:r.reversePropertyId}));
 const spec={compilerVersion:COMPILER_VERSION,apiVersion:API_VERSION,planId:copy.planId,planHash:digest(copy),databases,fields,relations,rollups,formulas,calculationOrder:validation.calculationOrder};
 const binding=normalizeStandardTarget(target),testData=validateFixture(fixture,spec);
 const scope={databases:3,dataSources:3,relations:2,reverseRelations:2,rollups:rollups.length,formulas:formulas.length,rows:testData.people.length+testData.programs.length+testData.applications.length,parentPages:0,rowMarkerParagraphs:7,maxWrites:3+3+2+2+rollups.length+formulas.length+7};
 return {task:TASK,mode:'dry-run',runId,spec,target:binding,fixture:testData,fixtureHash:digest(testData),requestHash:digest({task:TASK,runId,spec,target:binding,fixture:testData,scope}),scope,networkRequests:0,resolvedConfirmations:copy.confirmationItems.map(c=>({code:c.code,basis:'explicit synthetic fixture IDs only; no real identity inference'})),selectionRate:{notionFormulaSupported:false,localCrossCheckOnly:true}};
}
export function validateFixture(value,spec){
 if(value?.kind!=='synthetic'||!Array.isArray(value.people)||!Array.isArray(value.programs)||!Array.isArray(value.applications)||value.people.length!==2||value.programs.length!==2||value.applications.length!==3)reject('synthetic_seven_rows_required');
 const row=(r,keys)=>{if(!r||Object.keys(r).some(k=>!keys.includes(k))||! /^[A-Z][A-Z0-9]{1,9}$/.test(r.key??'')||typeof r.title!=='string'||!r.title.startsWith('가상')||r.title.length>100)reject('invalid_synthetic_row');return {...r};};
 const fixture={kind:'synthetic',people:value.people.map(r=>row(r,['key','title'])),programs:value.programs.map(r=>row(r,['key','title','operationType','state'])),applications:value.applications.map(r=>row(r,['key','title','personKey','programKey','selection']))};
 const keys=[...fixture.people,...fixture.programs,...fixture.applications].map(r=>r.key);if(new Set(keys).size!==7)reject('duplicate_fixture_key');
 const field=id=>spec.fields.find(p=>p.logicalId===id);
 const selection=field('ds:applications:field:base-selection'),operation=field('ds:programs:operation-type'),state=field('ds:programs:field:base-progress');
 if(selection?.type!=='select'||operation?.type!=='select'||state?.type!=='select')reject('fixture_binding_required');
 for(const r of fixture.programs)if(!operation.options.some(o=>o.name===r.operationType)||!state.options.some(o=>o.name===r.state))reject('fixture_option_missing');
 for(const r of fixture.applications)if(!fixture.people.some(p=>p.key===r.personKey)||!fixture.programs.some(p=>p.key===r.programKey)||!selection.options.some(o=>o.name===r.selection))reject('fixture_relation_or_option');
 return fixture;
}
export function validateStandardApproval(approval,prepared){
 if(approval?.task!==TASK||approval.approved!==true||approval.syntheticFixtureApproved!==true||approval.personalPrivatePageConfirmed!==true||approval.runId!==prepared.runId||approval.planHash!==prepared.spec.planHash||approval.fixtureHash!==prepared.fixtureHash||approval.requestHash!==prepared.requestHash||!sameId(approval.parentId,prepared.target.parentId)||!Number.isFinite(Date.parse(approval.approvedAt??'')))reject('explicit_approval_required');
 return {approvedAt:approval.approvedAt,requestHash:approval.requestHash,syntheticFixtureApproved:true,personalPrivatePageConfirmed:true};
}
export const marker=(prepared,key)=>`${TASK} run:${prepared.runId} plan:${prepared.spec.planHash} object:${key}`;
export const fieldBy=(prepared,id)=>prepared.spec.fields.find(p=>p.logicalId===id);
export function createBody(prepared,database){return {parent:{type:'page_id',page_id:prepared.target.parentId},title:rich(database.name),description:rich(marker(prepared,database.logicalId)),is_inline:true,initial_data_source:{properties:Object.fromEntries(prepared.spec.fields.filter(f=>f.sourceId===database.dataSourceLogicalId&&BASIC_TYPES.includes(f.type)).map(f=>[f.name,{[f.type]:f.options?{options:f.options}:{}}]))}};}
export function expectedFixture(fixture){const personApplications=Object.fromEntries(fixture.people.map(p=>[p.key,fixture.applications.filter(a=>a.personKey===p.key).length]));const programs=Object.fromEntries(fixture.programs.map(p=>{const rows=fixture.applications.filter(a=>a.programKey===p.key),selected=rows.filter(a=>a.selection==='선정').length;return [p.key,{applications:rows.length,selected,rate:rows.length?selected/rows.length*100:0}];}));return {people:fixture.people.length,applications:fixture.applications.length,personApplications,programs};}
