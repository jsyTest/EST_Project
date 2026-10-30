import {normalizeConfiguration,normalizeMapping,emptyConfiguration} from '../drafts/model.mjs';
import {COLORS,TYPES,GROUPS,baseProperties,nameKey} from '../mapping/model.mjs';
import {PLAN_VERSION,NOTION_VERSION,TEMPLATE_NAMES,DB_NAMES,SELECTION_OPTIONS,MODULES,CAPABILITIES} from './catalog.mjs';

const ds=key=>`ds:${key}`,db=key=>`db:${key}`,pid=(key,property)=>`${ds(key)}:${property}`;
const issue=(code,message,ref=null)=>({code,message,...(ref?{ref}:{})});
const clone=value=>JSON.parse(JSON.stringify(value));
function canonical(value){return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
function logicalHash(value){let hash=14695981039346656037n;for(const c of canonical(value)){hash^=BigInt(c.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}return `plan-${hash.toString(16).padStart(16,'0')}`;}
const keyName=value=>String(value??'').normalize('NFKC').trim().toLowerCase();
export function adaptConfiguration(value){
 let configuration;
 if(value?.configuration)configuration=normalizeConfiguration(value.configuration,value.schema_version??1);
 else if(value?.mapping)configuration=normalizeConfiguration(value);
 else{
  configuration=emptyConfiguration();
  if(value?.model)configuration.mapping=normalizeMapping(value);
  else{
   const byIndex=new Map();for(const p of value?.properties??[])if(p.csvColumn){const old=byIndex.get(p.csvColumn.index);if(old&&old.original!==p.csvColumn.original)throw new Error('CSV index conflict');byIndex.set(p.csvColumn.index,p.csvColumn);}
   configuration.mapping=normalizeMapping({formText:'',encoding:'utf-8',columns:[...byIndex.values()].sort((a,b)=>a.index-b.index),model:value});
  }
 }
 // A strict allowlist deliberately excludes raw form bodies, CSV response rows, auth and tokens.
 return {configurationVersion:1,educationType:configuration.requirements.educationType,
  properties:configuration.mapping.model.properties.map(p=>({localId:p.localId,origin:p.origin,name:p.name,type:p.type,targetDb:p.targetDb,included:p.included,mappingStatus:p.mappingStatus,reviewReasons:p.reviewReasons,
   options:p.options.map(o=>({name:o.name,color:o.color,...(o.group?{group:o.group}:{}),...(o.colorSource?{colorSource:o.colorSource}:{})})),
   source:{localId:p.localId,origin:p.origin,questionNumber:p.questionNumber,questionName:p.questionName,csvColumn:p.csvColumn?{index:p.csvColumn.index,original:p.csvColumn.original}:null,originalTargetDb:p.targetDb}})),
  sourceCounts:{questions:configuration.mapping.model.properties.filter(p=>p.origin==='form').length,columns:configuration.mapping.columns.length}};
}
export function recommendTemplate(settings={}){
 const reasons=['repeatPrograms','personHistory','programStatistics','multipleApplications'].filter(k=>settings[k]===true);
 return {templateType:reasons.length?'standard':'basic',reasons,forcedByHeaders:false};
}
function formulaRefs(ast){return ast?.op==='relation_count'||ast?.op==='equals_option'?[ast.propertyId]:[];}
function formulaExpression(ast,properties){
 const p=properties.find(p=>p.id===ast.propertyId),prop=`prop(${JSON.stringify(p?.name??'')})`;
 if(ast.op==='relation_count')return `${prop}.length()`;
 if(ast.op==='equals_option')return `if(${prop} == ${JSON.stringify(ast.value)}, 1, 0)`;
 throw new Error('Unsupported formula operator');
}

export function createGenerationPlan(configuration,settings={}){
 const plan={planVersion:PLAN_VERSION,planId:null,mode:'dry-run',notionApiVersion:NOTION_VERSION,networkRequests:0,notionWrites:0,liveApiVerified:false,futureExecutorReady:false,
  educationType:'education',templateType:settings.templateType??'basic',enabledModules:[],requestedModules:[],
  databases:[],dataSources:[],properties:[],relations:[],rollups:[],formulas:[],selectOptions:[],statusOptions:[],
  warnings:[],blockingErrors:[],confirmationItems:[],executionPhases:[],capabilities:clone(CAPABILITIES),
  dataResolution:{rowsIncluded:false,identityDeduplication:'not_performed',relationRowLinking:'not_performed',calculatedValues:null},
  recommendations:recommendTemplate(settings)};
 let input;try{input=adaptConfiguration(configuration);}catch{plan.blockingErrors.push(issue('INVALID_CONFIGURATION','저장 형식 또는 설정을 확인해 주세요.'));return finalize(plan);}
 plan.educationType=input.educationType;plan.normalizedInput=input;
 if(plan.templateType==='auto')plan.templateType=plan.recommendations.templateType;
 if(!Object.hasOwn(TEMPLATE_NAMES,plan.templateType)){plan.blockingErrors.push(issue('UNSUPPORTED_TEMPLATE','지원하지 않는 구성 유형입니다.'));return finalize(plan);}
 const requested=settings.enabledModules??[];
 if(!Array.isArray(requested)||requested.some(id=>typeof id!=='string')){plan.blockingErrors.push(issue('INVALID_MODULES','모듈 ID 배열이 필요합니다.'));return finalize(plan);}
 plan.requestedModules=[...new Set(requested)].sort();
 const enabled=new Set();
 function enable(id){if(enabled.has(id))return;if(!Object.hasOwn(MODULES,id)){plan.blockingErrors.push(issue('UNSUPPORTED_MODULE','규칙에 없는 모듈입니다.',String(id)));return;}for(const dependency of MODULES[id].dependencies)enable(dependency);enabled.add(id);}
 for(const id of plan.requestedModules)enable(id);
 plan.enabledModules=[...enabled].sort();
 if(enabled.size&&plan.templateType!=='extended')plan.blockingErrors.push(issue('EXTENDED_REQUIRED','모듈을 추가하려면 확장형을 선택해 주세요.'));
 const databaseKeys=plan.templateType==='basic'?['applications']:['people','programs','applications'];
 if(plan.templateType==='extended')for(const id of enabled)for(const key of MODULES[id].databases)if(!databaseKeys.includes(key))databaseKeys.push(key);
 for(const key of databaseKeys){plan.databases.push({id:db(key),key,name:settings.databaseNames?.[key]??DB_NAMES[key],dataSourceId:ds(key),support:'automatic'});plan.dataSources.push({id:ds(key),databaseId:db(key),support:'automatic'});}
 function addProperty(key,property){const p={id:pid(key,property.key),dataSourceId:ds(key),name:property.name,type:property.type,sourceRefs:property.sourceRefs??[],origin:property.origin??'rule',support:['relation','rollup','formula','status'].includes(property.type)?'api_verification_required':'automatic'};plan.properties.push(p);
  if(['select','multi_select','status'].includes(p.type)){const config={propertyId:p.id,options:clone(property.options??[]),support:p.support};if(p.type==='status'){config.groupDefinitions='notion_ui_managed';config.support='api_verification_required';plan.statusOptions.push(config);}else plan.selectOptions.push(config);}
  return p;
 }
 const defaults=baseProperties();
 const edited=p=>{const original=defaults.find(o=>o.localId===p.localId);return p.mappingStatus==='confirmed'||p.options.some(o=>o.colorSource==='user')||!original||p.name!==original.name||p.type!==original.type||canonical(p.options.map(({name,color,group})=>({name,color,...(group?{group}:{})})))!==canonical(original.options.map(({name,color,group})=>({name,color,...(group?{group}:{})})));};
 for(const p of input.properties.filter(p=>p.included)){
  if(p.origin==='base'&&p.localId!=='base-selection'&&!(p.localId==='base-progress'&&plan.templateType!=='basic')&&!edited(p)){
   plan.warnings.push(issue('OPTIONAL_BASE_OMITTED',`${p.name}: 선택한 구성에 필요하지 않은 기본 속성은 추가하지 않았습니다.`,p.localId));continue;
  }
  let target='applications';
  if(plan.templateType!=='basic'){
   target={applicants:'people',courses:'programs',applications:'applications',enrollments:'enrollments',attendance:'attendance'}[p.targetDb];
   // Unknown form-specific questions/inflow belong to the application context.
   // Preserve explicitly confirmed/manual destinations instead of guessing user intent.
   const identityNames=['성명','이름','성함','연락처','전화번호','휴대전화','휴대폰 번호','이메일','이메일 주소','전자우편','연령대','나이대','참여자 유형','참여 유형'].map(nameKey);
   const sourceName=p.source.questionName||p.source.csvColumn?.original||p.name;
   if(p.targetDb==='applicants'&&p.mappingStatus!=='confirmed'&&p.origin!=='manual'&&!identityNames.includes(nameKey(sourceName)))target='applications';
   if(p.origin==='base'&&!databaseKeys.includes(target))target='applications';
  }
  if(!databaseKeys.includes(target)){plan.blockingErrors.push(issue('TARGET_MODULE_REQUIRED',`${p.name}: 선택한 저장 대상 DB에 필요한 모듈을 추가해 주세요.`,p.localId));continue;}
  addProperty(target,{key:`field:${p.localId}`,name:p.name,type:p.type,options:p.options,origin:'mapped',sourceRefs:[p.source]});
  if(p.mappingStatus==='review')plan.confirmationItems.push(issue('MAPPING_REVIEW',`${p.name}: ${p.reviewReasons.join(' · ')||'속성 설정 확인 필요'}`,pid(target,`field:${p.localId}`)));
 }
 if(!input.properties.some(p=>p.included&&p.origin!=='base'))plan.blockingErrors.push(issue('EMPTY_INPUT','분석한 질문·CSV 속성 또는 직접 추가 속성이 필요합니다.'));
 // No synthetic contact/name/date fields. The operational selection default is omitted if explicitly excluded.
 if(!input.properties.some(p=>p.localId==='base-selection'))addProperty('applications',{key:'selection',name:'모집·선정 상태',type:'select',options:SELECTION_OPTIONS});
 if(plan.templateType!=='basic')addProperty('programs',{key:'operation-type',name:'운영 유형',type:'select',options:[{name:plan.educationType==='hackathon'?'해커톤':'일반 교육',color:plan.educationType==='hackathon'?'purple':'blue'},...(settings.includeBothOperationTypes?[{name:plan.educationType==='hackathon'?'일반 교육':'해커톤',color:plan.educationType==='hackathon'?'blue':'purple'}]:[])]});
 if(plan.templateType==='extended')for(const id of enabled)for(const p of MODULES[id].properties)addProperty(p.db,{...p,key:`module:${id}:${p.key}`});
 // Every data source gets exactly one title; user title choices are preserved, duplicates block below.
 for(const key of databaseKeys){if(!plan.properties.some(p=>p.dataSourceId===ds(key)&&p.type==='title')){let name=key==='people'?'사람명':key==='programs'?'프로그램명':'이름';while(plan.properties.some(p=>p.dataSourceId===ds(key)&&keyName(p.name)===keyName(name)))name='_'+name;addProperty(key,{key:'title',name,type:'title'});}}
 function addRelation(r){const key=`relation:${r.source}:${r.target}:${r.name}`,reverseKey=`relation:${r.source}:${r.target}:${r.name}:reverse`;
  const forward=addProperty(r.source,{key,name:r.name,type:'relation'}),reverse=addProperty(r.target,{key:reverseKey,name:r.reverse,type:'relation'});
  plan.relations.push({id:`rel:${r.source}:${r.target}:${r.name}`,sourceDataSourceId:ds(r.source),targetDataSourceId:ds(r.target),propertyId:forward.id,reversePropertyId:reverse.id,type:'dual_property',remoteDataSourceId:null,support:'api_verification_required'});
 }
 if(plan.templateType!=='basic'){
  addRelation({source:'applications',target:'people',name:'사람',reverse:'신청기록'});
  addRelation({source:'applications',target:'programs',name:'프로그램',reverse:'신청기록'});
 }
 if(plan.templateType==='extended')for(const id of enabled)for(const r of MODULES[id].relations)addRelation(r);
 const propertyBy=(key,name)=>plan.properties.find(p=>p.dataSourceId===ds(key)&&p.name===name);
 const relationBy=(key,name)=>propertyBy(key,name)?.id;
 function addRollup(r){const p=addProperty(r.db,{key:`rollup:${r.key}`,name:r.name,type:'rollup'});
  const target=r.targetKey==='title'?plan.properties.find(p=>p.dataSourceId===ds(r.targetDb)&&p.type==='title'):plan.properties.find(p=>p.id===pid(r.targetDb,r.targetKey));
  plan.rollups.push({propertyId:p.id,relationPropertyId:relationBy(r.db,r.relationName)??null,targetPropertyId:target?.id??null,function:r.function,support:'api_verification_required',value:null});
 }
 function addFormula(r){const p=addProperty(r.db,{key:`formula:${r.key}`,name:r.name,type:'formula'});
  const ast={op:r.op,propertyId:r.relationName?relationBy(r.db,r.relationName):pid(r.db,r.propertyKey),...(r.value!==undefined?{value:r.value}:{})};
  plan.formulas.push({propertyId:p.id,ast,expression:formulaExpression(ast,plan.properties),support:'api_verification_required',value:null});
 }
 if(plan.templateType!=='basic'){
  addRollup({db:'programs',key:'applications',name:'신청 건수',relationName:'신청기록',targetDb:'applications',targetKey:'title',function:'count_all'});
  addFormula({db:'people',key:'applications',name:'신청 건수',op:'relation_count',relationName:'신청기록'});
  plan.confirmationItems.push(issue('IDENTITY_POLICY_PENDING','사람 식별·중복 제거 기준과 응답 행별 관계 연결은 아직 정하지 않았습니다. 헤더만으로 고유 사람을 확정하지 않습니다.'));
  plan.warnings.push(issue('NO_ROW_VALUES','사람 수·신청 건수·Rollup/Formula 값은 실제 응답 없이 계산 완료로 표시하지 않습니다.'));
 }
 if(settings.selectionMetrics===true){
  const selection=plan.properties.find(p=>p.dataSourceId===ds('applications')&&(p.id===pid('applications','selection')||p.sourceRefs.some(s=>s.localId==='base-selection')));
  const options=plan.selectOptions.find(o=>o.propertyId===selection?.id);
  if(plan.templateType==='basic'||selection?.type!=='select'||!options?.options.some(o=>o.name==='선정'))plan.blockingErrors.push(issue('SELECTION_METRIC_INPUT','일반형의 명시적인 선정 Select 옵션이 필요합니다.'));
  else{
   addFormula({db:'applications',key:'selected-value',name:'선정 값',op:'equals_option',propertyKey:selection.id.slice(ds('applications').length+1),value:'선정'});
   addRollup({db:'programs',key:'selected-applications',name:'선정 신청 건수',relationName:'신청기록',targetDb:'applications',targetKey:'formula:selected-value',function:'sum'});
  }
 }
 if(plan.templateType==='extended')for(const id of enabled){for(const r of MODULES[id].rollups)addRollup(r);for(const f of MODULES[id].formulas)addFormula(f);}
 if(enabled.has('teams'))plan.confirmationItems.push(issue('TEAM_IDENTITY_PENDING','팀 참여기록 수는 고유 인원수가 아닙니다. 동일인의 중복 참여·팀 배치 기준을 확인해야 합니다.'));
 const validation=validateGenerationPlan(plan);plan.blockingErrors.push(...validation.blockingErrors);plan.confirmationItems.push(...validation.confirmationItems);
 plan.executionPhases=[
  {id:'parent',name:'상위 페이지',logicalIds:['page:root'],remoteParentId:null},
  {id:'databases',name:'DB 및 초기 Data Source',logicalIds:plan.databases.map(p=>p.id)},
  {id:'properties',name:'기본 속성',logicalIds:plan.properties.filter(p=>!['relation','rollup','formula'].includes(p.type)).map(p=>p.id)},
  {id:'relations',name:'양방향 관계형',logicalIds:plan.relations.map(p=>p.id)},
  {id:'rollups',name:'Rollup',logicalIds:plan.rollups.map(p=>p.propertyId)},
  {id:'formulas',name:'Formula',logicalIds:validation.formulaOrder},
  {id:'options',name:'상태·선택 옵션·색상 재조회 검증',logicalIds:plan.selectOptions.concat(plan.statusOptions).map(p=>p.propertyId),note:'옵션은 기본 속성 단계에서 생성하고 이 단계에서 반환값을 검사합니다.'},
  {id:'verify',name:'구조·참조·계산 검증',logicalIds:plan.dataSources.map(p=>p.id),calculatedValues:'requires future rows; not evaluated'}
 ];
 if(settings.selectionMetrics===true){plan.executionPhases[4]={id:'calculations',name:'의존 순서 계산(선행 Formula → Rollup 포함)',logicalIds:validation.calculationOrder};plan.executionPhases[5]={id:'formula_verification',name:'Formula 표현식 재조회',logicalIds:validation.formulaOrder};}
 for(let i=0;i<plan.executionPhases.length;i++)plan.executionPhases[i].dependsOn=i?[plan.executionPhases[i-1].id]:[];
 plan.unresolvedBindings={parentPage:'page:root',databaseIds:plan.databases.map(p=>p.id),dataSourceIds:plan.dataSources.map(p=>p.id),propertyIds:plan.properties.map(p=>p.id),resolved:false};
 plan.delta=planDelta(settings.previousPlan,plan);
 if(settings.previousPlan)plan.warnings.push(issue('LOGICAL_REUSE_ONLY','재사용 표시는 이전 논리 계획과의 비교입니다. 실제 원격 객체 존재·권한·스키마 확인은 아직 하지 않았습니다.'));
 return finalize(plan);
}

export function validateGenerationPlan(plan){
 const errors=[],confirmations=[],formulaOrder=[],calculationOrder=[];
 const fail=(code,message,ref)=>errors.push(issue(code,message,ref));
 if(plan?.planVersion!==1||!['databases','dataSources','properties','relations','rollups','formulas','selectOptions','statusOptions','enabledModules'].every(k=>Array.isArray(plan[k])))return {ok:false,blockingErrors:[issue('PLAN_SHAPE','지원하지 않는 계획 형식입니다.')],confirmationItems:[],formulaOrder:[]};
 const ids=new Set();for(const item of [...plan.databases,...plan.dataSources,...plan.properties,...plan.relations]){if(!item||typeof item.id!=='string'||ids.has(item.id))fail('DUPLICATE_ID','논리 ID가 없거나 중복됩니다.',item?.id);else ids.add(item.id);}
 if([...plan.databases,...plan.dataSources,...plan.properties,...plan.relations,...plan.rollups,...plan.formulas,...plan.selectOptions,...plan.statusOptions].some(item=>!item||typeof item!=='object'))return {ok:false,blockingErrors:[issue('PLAN_SHAPE','계획 항목은 객체여야 합니다.')],confirmationItems:[],formulaOrder:[]};
 if(!['education','hackathon'].includes(plan.educationType)||!Object.hasOwn(TEMPLATE_NAMES,plan.templateType))fail('PLAN_TYPE','교육 유형 또는 구성 유형이 잘못됐습니다.');
 const sources=new Map(plan.dataSources.map(p=>[p.id,p])),properties=new Map(plan.properties.map(p=>[p.id,p]));
 for(const d of plan.databases){if(typeof d.name!=='string'||!d.name.trim()||d.name.length>100)fail('DATABASE_NAME','DB 이름은 1~100자여야 합니다.',d.id);if(sources.get(d.dataSourceId)?.databaseId!==d.id||plan.dataSources.filter(s=>s.databaseId===d.id).length!==1)fail('DATA_SOURCE_CONTAINER','DB와 초기 Data Source가 일대일로 연결되어야 합니다.',d.id);}
 for(const source of plan.dataSources){if(!plan.databases.some(d=>d.id===source.databaseId&&d.dataSourceId===source.id))fail('MISSING_DATABASE','Data Source의 부모 DB가 없습니다.',source.id);if(plan.properties.filter(p=>p.dataSourceId===source.id&&p.type==='title').length!==1)fail('TITLE_COUNT','Data Source마다 Title 속성이 정확히 하나여야 합니다.',source.id);}
 const names=new Set(),sourceColumns=new Set();
 for(const p of plan.properties){
  if(!sources.has(p.dataSourceId))fail('PROPERTY_TARGET','속성 대상 Data Source가 없습니다.',p.id);
  const key=`${p.dataSourceId}:${keyName(p.name)}`;
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>100)fail('PROPERTY_NAME','속성명은 1~100자여야 합니다.',p.id);
  if(names.has(key))fail('PROPERTY_COLLISION','같은 Data Source의 속성명이 충돌합니다.',p.id);names.add(key);
  if(![...TYPES,'relation','rollup','formula'].includes(p.type))fail('PROPERTY_TYPE','지원하지 않는 속성 유형입니다.',p.id);
  for(const source of p.sourceRefs??[])if(source.csvColumn){const column=source.csvColumn.index;if(sourceColumns.has(column))fail('CSV_REUSED','하나의 CSV 컬럼이 여러 속성에 중복 연결됐습니다.',p.id);sourceColumns.add(column);}
 }
 const relations=new Map();
 for(const r of plan.relations){const p=properties.get(r.propertyId),reverse=properties.get(r.reversePropertyId);
  if(!sources.has(r.sourceDataSourceId)||!sources.has(r.targetDataSourceId))fail('RELATION_TARGET','관계형 대상 Data Source가 없습니다.',r.id);
  if(r.type!=='dual_property'||p?.type!=='relation'||reverse?.type!=='relation'||p.dataSourceId!==r.sourceDataSourceId||reverse.dataSourceId!==r.targetDataSourceId)fail('RELATION_PAIR','양방향 관계 속성과 대상이 일치하지 않습니다.',r.id);
  for(const [propertyId,target]of [[r.propertyId,r.targetDataSourceId],[r.reversePropertyId,r.sourceDataSourceId]]){if(relations.has(propertyId))fail('RELATION_REUSED','관계 속성이 중복 정의됐습니다.',propertyId);relations.set(propertyId,target);}
 }
 for(const p of plan.properties.filter(p=>p.type==='relation'))if(!relations.has(p.id))fail('MISSING_RELATION','관계 속성에 연결 계획이 없습니다.',p.id);
 const definitions=new Map(),dependencies=new Map();
 for(const r of plan.rollups){const p=properties.get(r.propertyId),relation=properties.get(r.relationPropertyId),target=properties.get(r.targetPropertyId);
  if(definitions.has(r.propertyId))fail('CALCULATION_DUPLICATE','계산 속성 정의가 중복됩니다.',r.propertyId);definitions.set(r.propertyId,r);
  if(p?.type!=='rollup'||relation?.dataSourceId!==p?.dataSourceId||!relations.has(r.relationPropertyId)||target?.dataSourceId!==relations.get(r.relationPropertyId))fail('ROLLUP_TARGET','Rollup의 관계 또는 대상 속성이 올바르지 않습니다.',r.propertyId);
  if(!['sum','average','count_all'].includes(r.function))fail('ROLLUP_FUNCTION','현재 계획기가 지원하지 않는 Rollup 함수입니다.',r.propertyId);
  const numericFlag=target?.type==='formula'&&plan.formulas.some(f=>f.propertyId===target.id&&f.ast?.op==='equals_option');
  if(target?.type==='rollup'||target?.type==='formula'&&!numericFlag)fail('ROLLUP_CALCULATION_UNSUPPORTED','이 계획기는 숫자 equals_option 외의 계산 속성 중첩 Rollup을 지원하지 않습니다.',r.propertyId);
  if(['sum','average'].includes(r.function)&&target?.type!=='number'&&!numericFlag)fail('ROLLUP_NUMBER','숫자 집계에는 숫자 속성이 필요합니다.',r.propertyId);
  dependencies.set(r.propertyId,[r.targetPropertyId]);
 }
 for(const f of plan.formulas){const p=properties.get(f.propertyId),refs=formulaRefs(f.ast);
  if(definitions.has(f.propertyId))fail('CALCULATION_DUPLICATE','계산 속성 정의가 중복됩니다.',f.propertyId);definitions.set(f.propertyId,f);
  if(p?.type!=='formula'||!['relation_count','equals_option'].includes(f.ast?.op))fail('FORMULA_UNSUPPORTED','허용 목록에 없는 계산식입니다.',f.propertyId);
  for(const id of refs)if(!properties.has(id)||properties.get(id).dataSourceId!==p?.dataSourceId)fail('FORMULA_REFERENCE','Formula의 참조 속성이 없거나 다른 Data Source입니다.',f.propertyId);
  const target=properties.get(f.ast?.propertyId);
  if(f.ast?.op==='relation_count'&&target?.type!=='relation')fail('FORMULA_TYPE','관계 건수는 관계형 속성을 참조해야 합니다.',f.propertyId);
  if(f.ast?.op==='equals_option'){
   const config=plan.selectOptions.concat(plan.statusOptions).find(c=>c.propertyId===target?.id);
   if(!['select','status'].includes(target?.type)||!config?.options?.some(o=>o.name===f.ast.value))fail('FORMULA_OPTION','Formula가 참조하는 선택 속성·옵션이 없습니다.',f.propertyId);
  }
  try{if(f.expression!==formulaExpression(f.ast,plan.properties))fail('FORMULA_EXPRESSION','정의된 논리식과 실제 표현식이 다릅니다.',f.propertyId);}catch{fail('FORMULA_UNSUPPORTED','지원하지 않는 계산식입니다.',f.propertyId);}
  dependencies.set(f.propertyId,refs);
 }
 for(const p of plan.properties.filter(p=>['rollup','formula'].includes(p.type)))if(!definitions.has(p.id))fail('CALCULATION_MISSING','계산 속성 정의가 없습니다.',p.id);
 const visited=new Set(),active=new Set();function visit(id){if(active.has(id)){fail('CALCULATION_CYCLE','계산 참조가 순환합니다.',id);return;}if(visited.has(id))return;active.add(id);for(const dep of dependencies.get(id)??[])if(dependencies.has(dep))visit(dep);active.delete(id);visited.add(id);calculationOrder.push(id);if(properties.get(id)?.type==='formula')formulaOrder.push(id);}for(const id of dependencies.keys())visit(id);
 const optionIds=new Set();
 for(const [kind,configs]of [['select',plan.selectOptions],['status',plan.statusOptions]])for(const config of configs){const p=properties.get(config.propertyId);
  if(optionIds.has(config.propertyId))fail('OPTION_DUPLICATE','옵션 정의가 중복됩니다.',config.propertyId);optionIds.add(config.propertyId);
  if(!p||!(kind==='status'?p.type==='status':['select','multi_select'].includes(p.type)))fail('OPTION_PROPERTY','옵션과 속성 유형이 다릅니다.',config.propertyId);
  if(!Array.isArray(config.options)||!config.options.length){fail('OPTIONS_EMPTY','선택 옵션이 필요합니다.',config.propertyId);continue;}
  const options=new Set();for(const o of config.options){if(!o||typeof o!=='object'){fail('OPTION_NAME','옵션은 객체여야 합니다.',config.propertyId);continue;}if(typeof o.name!=='string'||!o.name.trim()||o.name.length>100||o.name.includes(',')||options.has(keyName(o.name)))fail('OPTION_NAME','옵션 이름이 잘못됐거나 중복됩니다.',config.propertyId);options.add(keyName(o.name));if(!COLORS.includes(o.color))fail('OPTION_COLOR','Notion에서 지원하지 않는 색상입니다.',config.propertyId);if(kind==='status'&&!GROUPS.includes(o.group))fail('STATUS_GROUP','지원하는 Status 그룹을 선택해 주세요.',config.propertyId);}
  if(kind==='status'&&config.groupDefinitions!=='notion_ui_managed')fail('STATUS_GROUP_DEFINITION','Status 그룹 정의 변경은 Notion UI 작업으로 분리해야 합니다.',config.propertyId);
 }
 for(const p of plan.properties.filter(p=>['select','multi_select','status'].includes(p.type)))if(!optionIds.has(p.id))fail('OPTIONS_MISSING','선택 속성의 옵션 정의가 없습니다.',p.id);
 for(const id of plan.enabledModules){if(!Object.hasOwn(MODULES,id)){fail('UNSUPPORTED_MODULE','지원하지 않는 모듈입니다.',id);continue;}for(const dep of MODULES[id].dependencies)if(!plan.enabledModules.includes(dep))fail('MODULE_DEPENDENCY','의존 모듈이 빠졌습니다.',id);for(const key of MODULES[id].requiredDatabases)if(!sources.has(ds(key)))fail('MODULE_DATABASE','모듈에 필요한 DB가 없습니다.',id);for(const spec of MODULES[id].requiredProperties){const p=spec.key==='title'?plan.properties.find(p=>p.dataSourceId===ds(spec.db)&&p.type==='title'):properties.get(pid(spec.db,`module:${id}:${spec.key}`));if(p?.type!==spec.type)fail('MODULE_PROPERTY','모듈 필수 속성이 없거나 유형이 다릅니다.',id);}}
 if(plan.templateType==='basic'&&(plan.databases.length!==1||plan.relations.length||plan.rollups.length||plan.formulas.length))fail('BASIC_SHAPE','기본형은 관계·계산 없는 단일 DB여야 합니다.');
 if(plan.templateType==='standard'&&plan.databases.length!==3)fail('STANDARD_SHAPE','일반형은 DB 3개여야 합니다.');
 if(plan.templateType!=='basic'){
  for(const key of ['people','programs','applications'])if(!sources.has(ds(key)))fail('STANDARD_DATABASE','일반형·확장형의 공통 DB가 없습니다.',key);
  for(const target of ['people','programs'])if(!plan.relations.some(r=>r.sourceDataSourceId===ds('applications')&&r.targetDataSourceId===ds(target)))fail('STANDARD_RELATION','사람·프로그램·신청의 공통 관계가 없습니다.',target);
 }
 if(plan.enabledModules.length&&plan.templateType!=='extended')fail('EXTENDED_REQUIRED','선택 모듈은 확장형에서만 사용할 수 있습니다.');
 for(const id of plan.enabledModules.filter(id=>Object.hasOwn(MODULES,id))){const module=MODULES[id];
  for(const r of module.relations)if(!plan.relations.some(actual=>actual.sourceDataSourceId===ds(r.source)&&actual.targetDataSourceId===ds(r.target)&&actual.propertyId===pid(r.source,`relation:${r.source}:${r.target}:${r.name}`)))fail('MODULE_RELATION','모듈에 필요한 관계가 없습니다.',id);
  for(const r of module.rollups)if(!plan.rollups.some(actual=>actual.propertyId===pid(r.db,`rollup:${r.key}`)))fail('MODULE_ROLLUP','모듈에 필요한 Rollup이 없습니다.',id);
  for(const f of module.formulas)if(!plan.formulas.some(actual=>actual.propertyId===pid(f.db,`formula:${f.key}`)))fail('MODULE_FORMULA','모듈에 필요한 Formula가 없습니다.',id);
 }
 return {ok:!errors.length,blockingErrors:errors,confirmationItems:confirmations,formulaOrder,calculationOrder};
}
function planDelta(previous,plan){
 const valid=previous&&previous.dryRunValid===true&&previous.blockingErrors?.length===0&&validateGenerationPlan(previous).ok;
 if(previous&&!valid)plan.blockingErrors.push(issue('INVALID_PREVIOUS_PLAN','이전 계획이 유효하지 않아 재사용 비교를 할 수 없습니다.'));
 const before=valid?previous:{databases:[],properties:[]};
 const descriptor=(source,p)=>({property:p,options:(source.selectOptions??[]).concat(source.statusOptions??[]).find(c=>c.propertyId===p.id),relation:(source.relations??[]).find(r=>r.propertyId===p.id||r.reversePropertyId===p.id),calculation:(source.formulas??[]).concat(source.rollups??[]).find(c=>c.propertyId===p.id)});
 return {scope:'logical-plan-only',createDatabases:plan.databases.filter(p=>!before.databases.some(o=>o.id===p.id)).map(p=>p.id),reuseDatabases:plan.databases.filter(p=>before.databases.some(o=>o.id===p.id)).map(p=>p.id),addProperties:plan.properties.filter(p=>!before.properties.some(o=>o.id===p.id)).map(p=>p.id),changedProperties:plan.properties.filter(p=>before.properties.some(o=>o.id===p.id&&canonical(descriptor(before,o))!==canonical(descriptor(plan,p)))).map(p=>p.id),removedLogicalIds:before.properties.filter(o=>!plan.properties.some(p=>p.id===o.id)).map(p=>p.id),automaticDeletion:false};
}
function finalize(plan){
 const unique=items=>items.filter((p,i)=>items.findIndex(o=>canonical(o)===canonical(p))===i);
 plan.blockingErrors=unique(plan.blockingErrors);plan.confirmationItems=unique(plan.confirmationItems);
 plan.summary={databases:plan.databases.length,properties:plan.properties.length,relations:plan.relations.length,rollups:plan.rollups.length,formulas:plan.formulas.length,
  automaticItems:1+plan.databases.length+plan.properties.filter(p=>p.support==='automatic').length,
  apiVerificationItems:plan.properties.filter(p=>p.support==='api_verification_required').length,
  manualUiCapabilities:['Status 그룹 정의 변경'],confirmationItems:plan.confirmationItems.length,blockingErrors:plan.blockingErrors.length};
 plan.dryRunValid=plan.blockingErrors.length===0;plan.executionState='not_executed';
 plan.requestTemplates=plan.dryRunValid?requestTemplates(plan):[];
 plan.planId=logicalHash(plan);return plan;
}
function requestTemplates(plan){
 const ref=id=>({logicalRef:id,resolution:'after_creation'}),pBy=id=>plan.properties.find(p=>p.id===id);
 const path=source=>({endpoint:'/v1/data_sources/{data_source_id}',data_source_id:ref(source)});
 const schema=p=>{const options=plan.selectOptions.concat(plan.statusOptions).find(c=>c.propertyId===p.id);return {[p.type]:options?{options:options.options.map(({name,color,group})=>({name,color,...(group?{group}:{})}))}:{}};};
 const patch=(p,definition)=>({phase:['relation','rollup','formula'].includes(p.type)?p.type+'s':'properties',method:'PATCH',...path(p.dataSourceId),body:{properties:{[p.name]:definition}},executable:false});
 const changed=id=>plan.delta.changedProperties.includes(id),added=id=>plan.delta.addProperties.includes(id);
 const reconcile=(p,definition)=>({phase:'properties',method:'GET',...path(p.dataSourceId),proposedChange:{propertyId:p.id,name:p.name,definition},requiresRemoteMerge:true,retainUnlistedOptions:true,automaticDeletion:false,executable:false});
 const propose=(p,definition)=>changed(p.id)?reconcile(p,definition):patch(p,definition);
 const reused=plan.databases.filter(d=>plan.delta.reuseDatabases.includes(d.id));
 const calculations=validateGenerationPlan(plan).calculationOrder.map(id=>{
  const r=plan.rollups.find(r=>r.propertyId===id);if(r)return {id,definition:{rollup:{relation_property_id:ref(r.relationPropertyId),rollup_property_id:ref(r.targetPropertyId),function:r.function==='count_all'?'count':r.function}}};
  const f=plan.formulas.find(f=>f.propertyId===id);return {id,definition:{formula:{expression:f.expression}}};
 });
 return [
  reused.length?{phase:'parent',method:'GET',endpoint:'/v1/pages/{page_id}',page_id:ref('page:root'),requiresExplicitRemoteBinding:true,executable:false}:
   {phase:'parent',method:'POST',endpoint:'/v1/pages',body:{parent:{type:'page_id',page_id:ref('external:parent_page_id')},properties:{title:{type:'title',title:[{type:'text',text:{content:plan.educationType==='hackathon'?'해커톤 운영':'교육 운영'}}]}}},bind:'page:root',executable:false},
  ...plan.databases.map(d=>{if(plan.delta.reuseDatabases.includes(d.id))return {phase:'databases',method:'GET',endpoint:'/v1/databases/{database_id}',database_id:ref(d.id),expectedName:d.name,verifyBeforeReuse:true,requiresExplicitRemoteBinding:true,bindInitialDataSource:d.dataSourceId,executable:false};const title=plan.properties.find(p=>p.dataSourceId===d.dataSourceId&&p.type==='title');return {phase:'databases',method:'POST',endpoint:'/v1/databases',body:{parent:{type:'page_id',page_id:ref('page:root')},title:[{type:'text',text:{content:d.name}}],initial_data_source:{properties:{[title.name]:{title:{}}}}},bind:{database:d.id,initialDataSource:d.dataSourceId},executable:false};}),
  ...reused.map(d=>({phase:'properties',method:'GET',...path(d.dataSourceId),bindExistingPropertyIds:true,verifyBeforeChanges:true,executable:false})),
  ...plan.properties.filter(p=>!['title','relation','rollup','formula'].includes(p.type)&&(added(p.id)||changed(p.id))).map(p=>propose(p,schema(p))),
  ...plan.relations.filter(r=>added(r.propertyId)||changed(r.propertyId)||changed(r.reversePropertyId)).map(r=>({...propose(pBy(r.propertyId),{relation:{data_source_id:ref(r.targetDataSourceId),type:'dual_property',dual_property:{}}}),bindReverseProperty:r.reversePropertyId,afterCreation:{retrieveBothDataSources:true,renameGeneratedReverseTo:pBy(r.reversePropertyId).name,verifyPair:true}})),
  ...calculations.filter(c=>added(c.id)||changed(c.id)).map(c=>propose(pBy(c.id),c.definition)),
  ...plan.dataSources.map(s=>({phase:'verify',method:'GET',...path(s.id),verify:['names','types','remote_ids','relation_pairs','options_colors_groups','calculation_definitions'],rowValues:'not_evaluated_without_rows',executable:false}))
 ];
}
