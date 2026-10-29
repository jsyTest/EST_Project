import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {emptyConfiguration,normalizeConfiguration} from '../../../js/drafts/model.mjs';
import {parseForm,mergeSources} from '../../../js/mapping/parse.mjs';
import {describeColumns} from '../../../js/mapping/csv.mjs';
import {createGenerationPlan,validateGenerationPlan,adaptConfiguration,recommendTemplate} from '../../../js/planner/plan.mjs';
import {MODULES,SELECTION_OPTIONS} from '../../../js/planner/catalog.mjs';
import {API_VERSION} from '../config.mjs';
import {screen} from './helpers/browser.mjs';
const config=(form='1. 이메일\n단답형',headers=[])=>{const c=emptyConfiguration();c.requirements.educationName='가상 교육';c.mapping.columns=describeColumns(headers);c.mapping.formText=form;c.mapping.model=mergeSources(parseForm(form),c.mapping.columns,{safeCsvDefaults:true});return c;};
const standard=()=>createGenerationPlan(config(),{templateType:'standard'});
const errors=plan=>validateGenerationPlan(plan).blockingErrors.map(e=>e.code);

test('NB008B: all three input paths default to exactly one DB, one Title, no relations/KPI or fabricated contacts',()=>{
 for(const c of [config(),config('',['이메일','메모']),config('1. 이메일\n단답형',['이메일'])]){
  const p=createGenerationPlan(c);assert.equal(p.dryRunValid,true);assert.equal(p.databases.length,1);assert.equal(p.dataSources.length,1);assert.equal(p.properties.filter(p=>p.type==='title').length,1);assert.equal(p.relations.length,0);assert.equal(p.rollups.length,0);assert.equal(p.formulas.length,0);assert.ok(!p.properties.some(p=>['성명','연락처','신청 일시'].includes(p.name)));assert.equal(p.properties.filter(p=>p.sourceRefs.some(s=>s.origin!=='base')).length,c.mapping.model.properties.filter(p=>p.origin!=='base').length);
 }
});
test('NB008B: general form/CSV mapping preserves original provenance and contains no duplicate matched field',()=>{
 const p=createGenerationPlan(config('1. 이메일 주소\n단답형',['이메일','메모']));
 const field=p.properties.find(p=>p.sourceRefs.some(s=>s.origin==='form'));
 assert.equal(field.sourceRefs[0].questionName,'이메일 주소');assert.equal(field.sourceRefs[0].csvColumn.original,'이메일');assert.equal(p.properties.filter(p=>p.name==='이메일').length,1);
});
test('NB008B: standard routing keeps identity in people and form-specific/inflow fields in applications, honoring confirmed overrides',()=>{
 const c=config('1. 이메일\n단답형\n2. 추가 메모\n장문형\n3. 유입 경로\n단일 선택\n- 검색\n- 추천');
 const p=createGenerationPlan(c,{templateType:'standard'});assert.equal(p.properties.find(p=>p.sourceRefs.some(s=>s.localId==='form-0')).dataSourceId,'ds:people');assert.equal(p.properties.find(p=>p.sourceRefs.some(s=>s.localId==='form-1')).dataSourceId,'ds:applications');assert.equal(p.properties.find(p=>p.sourceRefs.some(s=>s.localId==='form-2')).dataSourceId,'ds:applications');
 c.mapping.model.properties.find(p=>p.localId==='form-1').mappingStatus='confirmed';const explicit=createGenerationPlan(c,{templateType:'standard'});assert.equal(explicit.properties.find(p=>p.sourceRefs.some(s=>s.localId==='form-1')).dataSourceId,'ds:people');
});
test('NB008B: standard plan separates people/programs/applications and wires reciprocal data-source references',()=>{
 const p=standard();assert.equal(p.dryRunValid,true);assert.deepEqual(p.databases.map(p=>p.key),['people','programs','applications']);assert.equal(p.relations.length,2);
 for(const r of p.relations){assert.ok(r.targetDataSourceId.startsWith('ds:'));assert.equal(p.properties.find(p=>p.id===r.reversePropertyId).dataSourceId,r.targetDataSourceId);assert.equal(r.remoteDataSourceId,null);}
 assert.ok(p.confirmationItems.some(i=>i.code==='IDENTITY_POLICY_PENDING'));assert.equal(p.dataResolution.calculatedValues,null);
});
test('NB008B: the synthetic 2-person/3-application example distinguishes people from repeated applications without claiming import',()=>{
 const people=[{id:'P1'},{id:'P2'}],programs=[{id:'C1'},{id:'C2'}],applications=[{person:'P1',program:'C1'},{person:'P1',program:'C2'},{person:'P2',program:'C1'}];
 assert.equal(people.length,2);assert.equal(applications.length,3);assert.equal(applications.filter(a=>a.person==='P1').length,2);assert.equal(programs.length,2);
 const p=standard();assert.ok(p.formulas.some(f=>f.ast.op==='relation_count'));assert.ok(p.rollups.some(r=>r.function==='count_all'));assert.equal(p.dataResolution.rowsIncluded,false);assert.equal(p.dataResolution.identityDeduplication,'not_performed');assert.ok(!JSON.stringify(p).includes('P1'));
});
test('NB008B: education/hackathon share stable IDs and default basic shape; explicit program type changes only a known operational option',()=>{
 const c=config();c.requirements.educationType='hackathon';const basic=createGenerationPlan(c);assert.equal(basic.databases.length,1);assert.equal(basic.educationType,'hackathon');
 const p=createGenerationPlan(c,{templateType:'standard'}),normal=standard();assert.deepEqual(p.relations,normal.relations);assert.equal(p.selectOptions.find(o=>o.propertyId==='ds:programs:operation-type').options[0].name,'해커톤');
});
test('NB008B: teams and attendance resolve participation dependencies and modules are idempotent',()=>{
 for(const id of ['teams','attendance']){
  const p=createGenerationPlan(config(),{templateType:'extended',enabledModules:[id,id]});assert.equal(p.dryRunValid,true);assert.ok(p.enabledModules.includes('participation'));assert.ok(p.databases.some(d=>d.key==='enrollments'));assert.equal(new Set(p.databases.map(d=>d.id)).size,p.databases.length);
 }
 const team=createGenerationPlan(config(),{templateType:'extended',enabledModules:['teams']});assert.ok(team.formulas.some(f=>f.propertyId==='ds:teams:formula:member-count'));
});
test('NB008B: all seven module contracts produce a valid dependency graph and mechanically required components',()=>{
 const p=createGenerationPlan(config(),{templateType:'extended',enabledModules:Object.keys(MODULES)});assert.equal(p.dryRunValid,true);assert.equal(p.databases.length,10);
 const damaged=structuredClone(p);damaged.enabledModules=damaged.enabledModules.filter(id=>id!=='participation');assert.ok(errors(damaged).includes('MODULE_DEPENDENCY'));
 const missing=structuredClone(p);const relation=missing.relations.find(r=>r.sourceDataSourceId==='ds:attendance');missing.relations=missing.relations.filter(r=>r!==relation);missing.properties=missing.properties.filter(p=>![relation.propertyId,relation.reversePropertyId].includes(p.id));assert.ok(errors(missing).includes('MODULE_RELATION'));
 assert.equal(typeof MODULES.teams.conflictConditions[0],'object');
});
test('NB008B: unsupported module/free sentence and incompatible basic+module are blocking',()=>{
 assert.ok(createGenerationPlan(config(),{templateType:'extended',enabledModules:['자유롭게 새 DB를 만들어 줘']}).blockingErrors.some(e=>e.code==='UNSUPPORTED_MODULE'));
 assert.ok(createGenerationPlan(config(),{enabledModules:['teams']}).blockingErrors.some(e=>e.code==='EXTENDED_REQUIRED'));
});
test('NB008B: nonexistent relation database and wrong reverse target are blocked',()=>{
 const p=standard();p.relations[0].targetDataSourceId='ds:missing';assert.ok(errors(p).includes('RELATION_TARGET'));
 const reverse=standard();reverse.properties.find(p=>p.id===reverse.relations[0].reversePropertyId).dataSourceId='ds:programs';assert.ok(errors(reverse).includes('RELATION_PAIR'));
});
test('NB008B: missing relation, wrong Rollup target, nonnumeric aggregate and unimplemented nested aggregate block',()=>{
 const p=standard();p.rollups[0].relationPropertyId='missing';assert.ok(errors(p).includes('ROLLUP_TARGET'));
 const wrong=standard();wrong.rollups[0].targetPropertyId=wrong.properties.find(p=>p.dataSourceId==='ds:people'&&p.type==='title').id;assert.ok(errors(wrong).includes('ROLLUP_TARGET'));
 const numeric=standard();numeric.rollups[0].function='sum';assert.ok(errors(numeric).includes('ROLLUP_NUMBER'));
 const nested=standard();nested.rollups[0].targetPropertyId=nested.formulas[0].propertyId;assert.ok(errors(nested).includes('ROLLUP_CALCULATION_UNSUPPORTED'));
});
test('NB008B: missing Formula reference, arbitrary expression/operator and nonexistent option are blocked',()=>{
 const p=standard();p.formulas[0].ast.propertyId='missing';assert.ok(errors(p).includes('FORMULA_REFERENCE'));
 const tampered=standard();tampered.formulas[0].expression='prop("숨은 속성")';assert.ok(errors(tampered).includes('FORMULA_EXPRESSION'));
 const unsupported=standard();unsupported.formulas[0].ast.op='eval';assert.ok(errors(unsupported).includes('FORMULA_UNSUPPORTED'));
 const option=createGenerationPlan(config(),{templateType:'extended',enabledModules:['attendance']});option.formulas.find(f=>f.ast.op==='equals_option').ast.value='추정 옵션';assert.ok(errors(option).includes('FORMULA_OPTION'));
});
test('NB008B: collapsing two user titles into basic blocks rather than discarding or silently converting a title',()=>{
 const c=config();const email=c.mapping.model.properties.find(p=>p.origin==='form');email.type='title';const second=structuredClone(email);second.localId='manual-title';second.origin='manual';second.name='과정 제목';second.targetDb='courses';second.csvColumn=null;c.mapping.model.properties.push(second);
 assert.ok(createGenerationPlan(c).blockingErrors.some(e=>e.code==='TITLE_COUNT'));assert.equal(createGenerationPlan(c,{templateType:'standard'}).dryRunValid,true);
});
test('NB008B: name collision in one DS blocks; same name in different DS is legal and source IDs remain distinct',()=>{
 const c=config();const p=c.mapping.model.properties.find(p=>p.origin==='form');p.name='동일 이름';const other=structuredClone(p);other.localId='manual-0';other.origin='manual';other.targetDb='applications';other.csvColumn=null;c.mapping.model.properties.push(other);
 assert.ok(createGenerationPlan(c).blockingErrors.some(e=>e.code==='PROPERTY_COLLISION'));const standard=createGenerationPlan(c,{templateType:'standard'});assert.equal(standard.dryRunValid,true);assert.equal(new Set(standard.properties.filter(p=>p.name==='동일 이름').map(p=>p.id)).size,2);
});
test('NB008B: user exclusion, names, types and color edits survive without mutating stored configuration',()=>{
 const c=config();const selection=c.mapping.model.properties.find(p=>p.localId==='base-selection');selection.name='사용자 모집 상태';selection.type='multi_select';selection.options[0].color='pink';selection.options[0].colorSource='user';const before=JSON.stringify(c);
 const p=createGenerationPlan(c);assert.equal(JSON.stringify(c),before);const field=p.properties.find(p=>p.name==='사용자 모집 상태');assert.equal(field.type,'multi_select');assert.equal(p.selectOptions.find(o=>o.propertyId===field.id).options[0].color,'pink');
 selection.included=false;assert.ok(!createGenerationPlan(c).properties.some(p=>p.sourceRefs.some(s=>s.localId==='base-selection')));
});
test('NB008B: new default status palette is distinct from old user/default palette and allowed colors/groups are enforced',()=>{
 const c=config();c.mapping.model.properties=c.mapping.model.properties.filter(p=>p.localId!=='base-selection');const p=createGenerationPlan(c);assert.deepEqual(p.selectOptions.find(o=>o.propertyId==='ds:applications:selection').options,SELECTION_OPTIONS);assert.equal(SELECTION_OPTIONS.find(o=>o.name==='대기').color,'purple');
 const invalid=standard();invalid.selectOptions[0].options[0].color='#ffffff';assert.ok(errors(invalid).includes('OPTION_COLOR'));
 const status=standard();assert.ok(status.statusOptions.length);status.statusOptions[0].options[0].group='임의 그룹';assert.ok(errors(status).includes('STATUS_GROUP'));
 const group=standard();group.statusOptions[0].groupDefinitions='rename automatically';assert.ok(errors(group).includes('STATUS_GROUP_DEFINITION'));
});
test('NB008B: review confirmations permit a diagnostic Dry Run while structural errors block it',()=>{
 const c=config('1. 새 문항\n입력 안내');const p=createGenerationPlan(c);assert.equal(p.dryRunValid,true);assert.ok(p.confirmationItems.some(i=>i.code==='MAPPING_REVIEW'));
 const missingOptions=config('1. 참여자 유형\n단일 선택');assert.ok(createGenerationPlan(missingOptions).blockingErrors.some(e=>e.code==='OPTIONS_EMPTY'));
});
test('NB008B: deterministic output, unchanged original model and stable IDs across DB display renames',()=>{
 const c=config();const settings={templateType:'extended',enabledModules:['attendance','teams']};const a=createGenerationPlan(c,settings),b=createGenerationPlan(c,settings);assert.deepEqual(a,b);
 const renamed=createGenerationPlan(c,{...settings,databaseNames:{people:'이름을 바꾼 사람 DB'}});assert.deepEqual(a.relations,renamed.relations);assert.deepEqual(a.properties,renamed.properties);assert.notEqual(a.planId,renamed.planId);
});
test('NB008B: module expansion adds logical DBs/properties and reuses the three standard DBs without automatic deletion',()=>{
 const previous=standard();const p=createGenerationPlan(config(),{templateType:'extended',enabledModules:['teams'],previousPlan:previous});assert.equal(p.dryRunValid,true);assert.equal(p.delta.reuseDatabases.length,3);assert.equal(p.delta.createDatabases.length,2);assert.equal(p.delta.automaticDeletion,false);assert.ok(p.warnings.some(w=>w.code==='LOGICAL_REUSE_ONLY'));
 const invalid=createGenerationPlan(config(),{templateType:'extended',enabledModules:['unknown']});const rejected=createGenerationPlan(config(),{previousPlan:invalid});assert.ok(rejected.blockingErrors.some(e=>e.code==='INVALID_PREVIOUS_PLAN'));assert.deepEqual(rejected.delta.reuseDatabases,[]);
});
test('NB008B: delta detects changed options/colors without recreating an existing logical database',()=>{
 const c=config(),before=createGenerationPlan(c);c.mapping.model.properties.find(p=>p.localId==='base-selection').options[0].color='pink';
 const after=createGenerationPlan(c,{previousPlan:before});assert.deepEqual(after.delta.createDatabases,[]);assert.ok(after.delta.changedProperties.includes('ds:applications:field:base-selection'));assert.ok(!after.requestTemplates.some(r=>r.method==='POST'&&r.endpoint==='/v1/databases'));assert.ok(after.requestTemplates.some(r=>r.requiresRemoteMerge&&r.retainUnlistedOptions));assert.ok(!after.requestTemplates.some(r=>r.method==='PATCH'&&r.body?.properties?.['선정 상태']));
});
test('NB008B: expansion request templates create only added databases and read existing containers before reuse',()=>{
 const p=createGenerationPlan(config(),{templateType:'extended',enabledModules:['teams'],previousPlan:standard()});
 assert.equal(p.requestTemplates.filter(r=>r.method==='POST'&&r.endpoint==='/v1/databases').length,2);assert.equal(p.requestTemplates.filter(r=>r.verifyBeforeReuse).length,3);assert.ok(!p.requestTemplates.some(r=>r.method==='POST'&&r.endpoint==='/v1/pages'));
});
test('NB008B: all 128 module selections have complete required properties and stable dependency resolution',()=>{
 const names=Object.keys(MODULES);for(let mask=0;mask<128;mask++){const enabledModules=names.filter((_,i)=>mask&(1<<i));const p=createGenerationPlan(config(),{templateType:'extended',enabledModules});assert.equal(p.dryRunValid,true,JSON.stringify({enabledModules,errors:p.blockingErrors}));assert.deepEqual(p,createGenerationPlan(config(),{templateType:'extended',enabledModules:[...enabledModules].reverse()}));}
});
test('NB008B: recommendations use explicit operational settings, never infer identity or force 3DB from headers',()=>{
 assert.equal(recommendTemplate().templateType,'basic');assert.equal(createGenerationPlan(config('',['사람별 이력','과정 통계'])).databases.length,1);
 assert.equal(recommendTemplate({repeatPrograms:true}).templateType,'standard');assert.equal(createGenerationPlan(config(),{repeatPrograms:true}).databases.length,1);assert.equal(createGenerationPlan(config(),{templateType:'auto',personHistory:true}).databases.length,3);
});
test('NB008B: v1 adapter accepts old missing education type and exports no raw rows/password/session/unknown fields',()=>{
 const c=config();delete c.requirements.educationType;c.mapping.csvText='SYNTHETIC_PRIVATE_ROW';c.password='SYNTHETIC_PASSWORD';c.session={access_token:'SYNTHETIC_TOKEN'};c.mapping.responseRows=[['SYNTHETIC_RESPONSE']];
 const adapted=adaptConfiguration(c),p=createGenerationPlan(c);assert.equal(adapted.configurationVersion,1);assert.equal(p.planVersion,1);assert.equal(p.educationType,'education');assert.doesNotMatch(JSON.stringify(p),/SYNTHETIC_|responseRows|access_token|password|formRaw/);assert.equal(normalizeConfiguration(c).version,1);
 assert.equal(createGenerationPlan({version:99}).dryRunValid,false);assert.equal(validateGenerationPlan(null).ok,false);assert.equal(validateGenerationPlan({...p,properties:[null]}).ok,false);
});
test('NB008B: eight phases and unbound API templates never claim execution or computed values',()=>{
 const p=standard();assert.equal(p.notionApiVersion,API_VERSION);assert.equal(p.executionPhases.length,8);assert.equal(p.unresolvedBindings.resolved,false);assert.equal(p.executionState,'not_executed');assert.equal(p.liveApiVerified,false);assert.equal(p.futureExecutorReady,false);assert.ok(p.requestTemplates.every(t=>t.executable===false));assert.ok(p.requestTemplates.some(t=>t.body?.initial_data_source));assert.ok(p.requestTemplates.some(t=>t.body?.properties?.['사람']?.relation?.data_source_id?.logicalRef==='ds:people'));assert.ok(p.formulas.every(f=>f.value===null));assert.ok(p.rollups.every(r=>r.value===null));
});
test('NB008B: planner does not use fetch or any Notion client and CLI exports valid/blocked results without credentials',async t=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden');};try{assert.equal(standard().notionWrites,0);}finally{globalThis.fetch=old;}
 const directory=await mkdtemp(join(tmpdir(),'nb008b-'));t.after(()=>rm(directory,{recursive:true,force:true}));const file=join(directory,'config.json');await writeFile(file,JSON.stringify(config()));
 const result=spawnSync(process.execPath,['scripts/generation-plan-dry-run.mjs',file],{encoding:'utf8',env:{PATH:process.env.PATH}});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).networkRequests,0);
 await writeFile(file,JSON.stringify(emptyConfiguration()));const blocked=spawnSync(process.execPath,['scripts/generation-plan-dry-run.mjs',file],{encoding:'utf8'});assert.equal(blocked.status,2);assert.equal(JSON.parse(blocked.stdout).dryRunValid,false);
 for(const path of ['js/planner/catalog.mjs','js/planner/plan.mjs'])assert.doesNotMatch(await readFile(path,'utf8'),/fetch\s*\(|NotionClient|https:\/\/api\.notion/);
});
test('NB008B UI: default cards show one DB, old schema remains a compatibility export, standard and module plans are selectable',async()=>{
 const v=await screen('mapping');v.node('form-text').value='1. 이메일\n단답형';await v.node('analyze').fire('click');await v.node('preview').fire('click');assert.equal(v.node('db-preview').children.length,1);assert.equal(JSON.parse(v.node('plan-json').textContent).databases.length,1);assert.equal(v.node('download-plan').disabled,false);assert.ok(JSON.parse(v.node('schema-preview').textContent).databases.applicants);
 v.node('template-type').value='standard';await v.node('template-type').fire('change');assert.equal(v.node('download-plan').disabled,true);await v.node('preview').fire('click');assert.equal(v.node('db-preview').children.length,3);assert.match(v.node('plan-summary').textContent,/사람 식별/);
 v.node('module-teams').checked=true;await v.node('module-teams').fire('change');assert.equal(v.node('template-type').value,'extended');await v.node('preview').fire('click');assert.ok(JSON.parse(v.node('plan-json').textContent).enabledModules.includes('participation'));
});
test('NB008B UI: review-only fields still export a diagnostic plan, while structural errors are marked blocking',async()=>{
 const v=await screen('mapping');v.node('form-text').value='1. 새 문항\n입력 안내';await v.node('analyze').fire('click');await v.node('preview').fire('click');
 const p=JSON.parse(v.node('plan-json').textContent);assert.equal(p.dryRunValid,true);assert.ok(p.confirmationItems.length);assert.equal(v.node('download-plan').disabled,false);assert.equal(v.node('download-schema').disabled,true);
 v.node('template-type').value='standard';await v.node('template-type').fire('change');assert.equal(v.node('db-preview').children.length,0);assert.equal(v.node('plan-details').children.length,0);
});
