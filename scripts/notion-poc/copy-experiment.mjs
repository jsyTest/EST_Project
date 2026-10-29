// NB-V2-007B only: a fixed three-database experiment, not a generic builder.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {API_VERSION, normalizeId, readConfig} from './config.mjs';
import {NotionClient} from './client.mjs';
import {RunStore} from './state.mjs';
import {preflight} from './preflight.mjs';
import {relationPayload} from './schema.mjs';

export const RUN_ID='nb-v2-007b';
export const LAB_TITLE='[TEST] NB-V2-007B 실험실';
// Even adding a child to the old test page is avoided: a separate lab is required.
const PROTECTED_IDS=new Set(['4081f60f-fdfa-80dd-9435-dfd053c1d4b3','4081f60f-fdfa-818d-8a2a-e202f2531cc9','96016cd2-3280-43cc-a356-e6583b5c1ead','68e888d3-45ac-43bc-9c1f-2473b5de2a19','8834d429-460c-41aa-b542-67b256558882','1bc27dc2-a75a-42a5-abbb-2cfc3ada1f5b','bcbeee3e-1742-4e93-8c26-438f3d2e7d9e','c065661f-4d53-4f37-9fe6-f7c7e745e074']);
function newParent(id){const normalized=normalizeId(id,'별도 실험실 부모');if(PROTECTED_IDS.has(normalized))throw new Error('기존 NB-V2-002A 페이지/DB는 새 실험 부모로 사용할 수 없습니다.');return normalized;}
const rich=value=>[{type:'text',text:{content:value}}];
const title=value=>({title:rich(value)});
const text=value=>({rich_text:rich(value)});
const select=values=>({select:{options:values.map(([name,color])=>({name,color}))}});
const formula=expression=>({formula:{expression}});
const rollup=property=>({rollup:{relation_property_name:'신청기록',rollup_property_name:property,function:'sum'}});
export const DATABASES={
  people:{name:'사람 DB',properties:{'성명':{title:{}},'가상 식별자':{rich_text:{}},'참여 유형':select([['가상 재직자','blue'],['가상 학생','purple']])}},
  programs:{name:'프로그램 DB',properties:{'프로그램명':{title:{}},'가상 식별자':{rich_text:{}},'구분':select([['교육','blue'],['해커톤','purple']]),'진행 상태':{status:{options:[{name:'예정',color:'gray',group:'To-do'},{name:'진행 중',color:'blue',group:'In progress'},{name:'완료',color:'green',group:'Complete'}]}}}},
  applications:{name:'신청기록 DB',properties:{'신청명':{title:{}},'선정 상태':select([['접수','blue'],['선정','green'],['대기','yellow'],['미선정','gray']])}}
};
export const RELATIONS=[{source:'applications',name:'사람',target:'people',reverse:'신청기록'},{source:'applications',name:'프로그램',target:'programs',reverse:'신청기록'}];
export const CALCULATIONS=[
  {database:'applications',properties:{'신청 값':formula('1'),'선정 값':formula('if(prop("선정 상태") == "선정", 1, 0)')}},
  ...['people','programs'].map(database=>({database,properties:{'신청 건수':rollup('신청 값'),'선정 건수':rollup('선정 값')}})),
  {database:'people',properties:{'선정 인원 값':formula('if(prop("선정 건수") > 0, 1, 0)')}},
  {database:'programs',properties:{'선정률':formula('if(prop("신청 건수") == 0, 0, prop("선정 건수") / prop("신청 건수") * 100)')}}
];
export const FIXTURE={
  people:[{id:'P01',name:'가상 참가자 A',type:'가상 재직자'},{id:'P02',name:'가상 참가자 B',type:'가상 학생'}],
  programs:[{id:'C01',name:'가상 교육',type:'교육',status:'진행 중'},{id:'C02',name:'가상 해커톤',type:'해커톤',status:'예정'}],
  applications:[{id:'AP01',person:'P01',program:'C01',status:'선정'},{id:'AP02',person:'P01',program:'C02',status:'대기'},{id:'AP03',person:'P02',program:'C01',status:'선정'}]
};
const fingerprint=()=>createHash('sha256').update(JSON.stringify({DATABASES,RELATIONS,CALCULATIONS,FIXTURE,API_VERSION})).digest('hex');
export function plan() {
  return {task:'NB-V2-007B',mode:'dry-run',networkRequests:0,apiVersion:API_VERSION,runId:RUN_ID,parentId:'미지정 — 별도 실험실 페이지 생성 승인 및 연결 필요',labTitle:LAB_TITLE,
    pageTitle:'[TEST] NB-V2-007B 워크스페이스 복제 검증',pageCount:1,databaseCount:3,dataSourceCount:3,rowCount:7,
    databases:DATABASES,relations:RELATIONS,calculations:CALCULATIONS,fixture:FIXTURE,
    expected:{people:2,programs:2,applications:3,personApplications:{P01:2,P02:1},programApplications:{C01:2,C02:1},selectedPeople:2},
    approval:'생성 전에 별도 사용자 승인 필요. 기본 dry-run은 쓰지 않음',
    exclusions:['기존 002A 교육 페이지와 DB 6개 변경','회사 공간','공개 공유/초대/권한 변경','워크스페이스 생성','자동 복제','차트/대시보드']};
}
const sameId=(a,b)=>!!a&&!!b&&normalizeId(a)===normalizeId(b);
const valueNumber=p=>(p?.formula??p?.rollup)?.number??null;
const plain=(p,key)=>p?.[key]?.map(t=>t.plain_text??t.text?.content??'').join('')??'';
const relationIds=p=>p?.has_more?null:p?.relation?.map(r=>normalizeId(r.id)).sort()??null;

// Reads only IDs in the supplied experiment manifest. It never searches a workspace.
export async function verifyBundle(client,state,{selection={}}={}) {
  const checks=[];const check=(name,actual,expected)=>checks.push({name,actual:actual??null,expected,passed:JSON.stringify(actual)===JSON.stringify(expected)});
  const page=await client.get(`/v1/pages/${normalizeId(state.page.id)}`);
  check('bundle parent',sameId(page.parent?.page_id,state.parentId),true);
  check('bundle active',!page.archived&&!page.in_trash,true);
  check('three distinct DBs',new Set(Object.values(state.databases).map(d=>normalizeId(d.databaseId))).size,3);
  check('three distinct data sources',new Set(Object.values(state.databases).map(d=>normalizeId(d.dataSourceId))).size,3);
  const children=await client.get(`/v1/blocks/${normalizeId(state.page.id)}/children?page_size=100`);
  check('bundle child list not truncated',children.has_more,false);
  check('bundle contains exactly these three DBs',children.results.filter(b=>b.type==='child_database').map(b=>normalizeId(b.id)).sort(),Object.values(state.databases).map(d=>normalizeId(d.databaseId)).sort());
  const schemas={},rows={};
  for(const [key,definition] of Object.entries(DATABASES)) {
    const db=state.databases[key];const container=await client.get(`/v1/databases/${normalizeId(db.databaseId)}`);
    check(`${key} parent`,sameId(container.parent?.page_id,state.page.id),true);
    check(`${key} one data source`,container.data_sources?.map(d=>normalizeId(d.id)),[normalizeId(db.dataSourceId)]);
    const source=await client.get(`/v1/data_sources/${normalizeId(db.dataSourceId)}`);schemas[key]=source;
    const expectedNames=[...Object.keys(definition.properties),...RELATIONS.filter(r=>r.source===key).map(r=>r.name),...RELATIONS.filter(r=>r.target===key).map(r=>r.reverse),...CALCULATIONS.filter(b=>b.database===key).flatMap(b=>Object.keys(b.properties))];
    check(`${key} property names`,Object.keys(source.properties).sort(),expectedNames.sort());
    check(`${key} data source parent`,sameId(source.parent?.database_id,db.databaseId),true);
    for(const [name,config] of Object.entries(definition.properties)) {
      const type=Object.keys(config)[0],actual=source.properties[name];check(`${key}.${name} type`,actual?.type,type);
      if(['select','status'].includes(type)) {
        check(`${key}.${name} options`,actual?.[type]?.options.map(o=>[o.name,o.color]).sort(),config[type].options.map(o=>[o.name,o.color]).sort());
        if(type==='status')for(const option of config.status.options){const remote=actual.status.options.find(o=>o.name===option.name);check(`${key}.${name}.${option.name} group`,!!actual.status.groups?.some(g=>g.name===option.group&&g.option_ids.includes(remote?.id)),true);}
      }
    }
    rows[key]=await client.queryAll(db.dataSourceId);
    check(`${key} row count`,rows[key].length,FIXTURE[key].length);
    check(`${key} row IDs`,rows[key].map(r=>normalizeId(r.id)).sort(),Object.values(state.rows[key]).map(r=>normalizeId(r.id)).sort());
    for(const row of rows[key])check(`${key} row parent ${row.id}`,sameId(row.parent?.data_source_id,db.dataSourceId),true);
  }
  const remote=(key,id)=>rows[key].find(r=>sameId(r.id,state.rows[key][id].id));
  const id=(key,keyId)=>normalizeId(state.rows[key][keyId].id);
  for(const r of RELATIONS) {
    const source=schemas[r.source].properties[r.name],reverse=schemas[r.target].properties[r.reverse];
    check(`${r.name} type`,source?.type,'relation');check(`${r.name} target`,sameId(source?.relation?.data_source_id,state.databases[r.target].dataSourceId),true);
    check(`${r.name} two-way`,source?.relation?.type,'dual_property');
    check(`${r.reverse}.${r.target} target`,sameId(reverse?.relation?.data_source_id,state.databases[r.source].dataSourceId),true);
    check(`${r.name} reverse ID`,source?.relation?.dual_property?.synced_property_id,reverse?.id);
    check(`${r.name} reverse backlink`,reverse?.relation?.dual_property?.synced_property_id,source?.id);
  }
  for(const batch of CALCULATIONS)for(const [name,config] of Object.entries(batch.properties)) {
    const actual=schemas[batch.database].properties[name],type=Object.keys(config)[0];check(`${batch.database}.${name} type`,actual?.type,type);
    if(type==='formula')check(`${batch.database}.${name} expression`,actual?.formula?.expression,config.formula.expression);
    else {
      check(`${batch.database}.${name} function`,actual?.rollup?.function,'sum');
      check(`${batch.database}.${name} relation`,actual?.rollup?.relation_property_id,schemas[batch.database].properties['신청기록']?.id);
      check(`${batch.database}.${name} property`,actual?.rollup?.rollup_property_id,schemas.applications.properties[config.rollup.rollup_property_name]?.id);
    }
  }
  for(const a of FIXTURE.applications){const p=remote('applications',a.id)?.properties,status=selection[a.id]??a.status;
    check(`${a.id} title`,plain(p?.['신청명'],'title'),a.id);check(`${a.id} person`,relationIds(p?.['사람']),[id('people',a.person)]);
    check(`${a.id} program`,relationIds(p?.['프로그램']),[id('programs',a.program)]);check(`${a.id} status`,p?.['선정 상태']?.select?.name,status);
    check(`${a.id} count value`,valueNumber(p?.['신청 값']),1);check(`${a.id} selected value`,valueNumber(p?.['선정 값']),status==='선정'?1:0);
  }
  const counts={};
  for(const key of ['people','programs'])for(const f of FIXTURE[key]) {
    const p=remote(key,f.id)?.properties,apps=FIXTURE.applications.filter(a=>a[key==='people'?'person':'program']===f.id);
    const selected=apps.filter(a=>(selection[a.id]??a.status)==='선정').length;
    check(`${f.id} identity`,plain(p?.['가상 식별자'],'rich_text'),f.id);
    check(`${f.id} title`,plain(p?.[key==='people'?'성명':'프로그램명'],'title'),f.name);
    check(`${f.id} type`,p?.[key==='people'?'참여 유형':'구분']?.select?.name,f.type);
    if(key==='programs')check(`${f.id} status`,p?.['진행 상태']?.status?.name,f.status);
    check(`${f.id} reverse rows`,relationIds(p?.['신청기록']),apps.map(a=>id('applications',a.id)).sort());
    check(`${f.id} application count`,valueNumber(p?.['신청 건수']),apps.length);check(`${f.id} selected count`,valueNumber(p?.['선정 건수']),selected);
    check(`${f.id} calculated value`,valueNumber(p?.[key==='people'?'선정 인원 값':'선정률']),key==='people'?(selected?1:0):selected/apps.length*100);
    counts[f.id]={applications:valueNumber(p?.['신청 건수']),selected:valueNumber(p?.['선정 건수'])};
  }
  return {ok:checks.every(c=>c.passed),checkedAt:new Date().toISOString(),checks,counts,
    actual:{people:rows.people.length,programs:rows.programs.length,applications:rows.applications.length,selectedPeople:rows.people.reduce((n,r)=>n+(valueNumber(r.properties['선정 인원 값'])??0),0)}};
}
async function verifyEventually(client,state) {
  let result;for(let attempt=0;attempt<3;attempt++){result=await verifyBundle(client,state);if(result.ok)return result;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500));}return result;
}
export async function createSource({client,store,parentId,confirmParent,verify=verifyEventually}) {
  const sourceParent=newParent(parentId);
  if(!sameId(confirmParent,sourceParent)||store.runId!==RUN_ID)throw new Error('별도 개인 테스트 부모와 고정 run-id 확인이 필요합니다.');
  await store.lock();let state;
  try {
    const previous=await store.read();
    if(previous){
      if(previous.taskId!=='NB-V2-007B'||previous.runId!==RUN_ID||!sameId(previous.parentId,sourceParent)||previous.fingerprint!==fingerprint())throw new Error('기존 실행과 계획이 다릅니다. 재생성하지 마세요.');
      if(previous.status==='source_verified')return {...previous,reusedExistingRun:true};
      throw new Error('미완료·실패·불확실 실행이 있습니다. 기록을 보존하고 수동 확인하세요.');
    }
    const parent=await preflight(client,sourceParent);if(parent.parent.title!==LAB_TITLE)throw new Error('별도 NB-V2-007B 실험실 제목을 확인할 수 없습니다.');
    state={taskId:'NB-V2-007B',runId:RUN_ID,parentId:sourceParent,apiVersion:API_VERSION,fingerprint:fingerprint(),status:'running',steps:[],databases:{},rows:{},startedAt:new Date().toISOString()};
    await store.save(state);
    const step=async(name,operation)=>{
      const event={name,status:'in_progress'};state.steps.push(event);await store.save(state);
      try{await operation();event.status='done';await store.save(state);}
      catch(error){event.status=error.uncertain?'uncertain':'failed';event.error={name:error.name,code:error.code??'local_or_validation_error',uncertain:error.uncertain===true};throw error;}
    };
    await step('create isolated bundle page',async()=>{
      const p=await client.post('/v1/pages',{parent:{page_id:sourceParent},properties:{title:title(plan().pageTitle)},children:[{object:'block',type:'paragraph',paragraph:{rich_text:rich('NB-V2-007B / nb-v2-007b / 가상 데이터 전용. 세 DB 전체를 한 묶음으로 복제하세요. 기존 NB-V2-002A 자료와 독립된 실험입니다.')}}]});state.page={id:normalizeId(p.id),url:p.url};
    });
    for(const [key,definition] of Object.entries(DATABASES))await step(`create ${key}`,async()=>{
      const d=await client.post('/v1/databases',{parent:{page_id:state.page.id},title:rich(definition.name),is_inline:true,initial_data_source:{properties:definition.properties}});
      state.databases[key]={databaseId:normalizeId(d.id),dataSourceId:normalizeId(d.data_sources?.[0]?.id),url:d.url};state.rows[key]={};
      const actual=await client.get(`/v1/data_sources/${state.databases[key].dataSourceId}`);
      for(const [name,config] of Object.entries(definition.properties))if(actual.properties[name]?.type!==Object.keys(config)[0])throw new Error('초기 속성 유형 불일치');
    });
    for(const r of RELATIONS)await step(`relation ${r.name}`,async()=>{
      const s=await client.patch(`/v1/data_sources/${state.databases[r.source].dataSourceId}`,{properties:{[r.name]:relationPayload(r,state.databases)}});
      const reverse=s.properties[r.name]?.relation?.dual_property?.synced_property_id;if(!reverse)throw new Error('역방향 속성 ID 누락');
      await client.patch(`/v1/data_sources/${state.databases[r.target].dataSourceId}`,{properties:{[reverse]:{name:r.reverse}}});
    });
    for(const [i,batch] of CALCULATIONS.entries())await step(`calculations ${i}`,()=>client.patch(`/v1/data_sources/${state.databases[batch.database].dataSourceId}`,{properties:batch.properties}));
    const props={
      people:r=>({'성명':title(r.name),'가상 식별자':text(r.id),'참여 유형':{select:{name:r.type}}}),
      programs:r=>({'프로그램명':title(r.name),'가상 식별자':text(r.id),'구분':{select:{name:r.type}},'진행 상태':{status:{name:r.status}}}),
      applications:r=>({'신청명':title(r.id),'선정 상태':{select:{name:r.status}},'사람':{relation:[{id:state.rows.people[r.person].id}]},'프로그램':{relation:[{id:state.rows.programs[r.program].id}]}})
    };
    for(const [key,rows] of Object.entries(FIXTURE))for(const r of rows)await step(`seed ${r.id}`,async()=>{
      const p=await client.post('/v1/pages',{parent:{data_source_id:state.databases[key].dataSourceId},properties:props[key](r)});state.rows[key][r.id]={id:normalizeId(p.id),url:p.url};
    });
    await step('verify source',async()=>{state.sourceVerification=await verify(client,state);if(!state.sourceVerification.ok)throw new Error('원본 검증 실패. 생성물을 보존하고 중단합니다.');});
    state.status='source_verified';await store.save(state);return state;
  }catch(error){if(state){state.status='failed';await store.save(state);}throw error;}finally{await store.unlock();}
}
export async function main(args=process.argv.slice(2)) {
  const command=args[0]??'dry-run';
  if(!['dry-run','preflight','apply','verify-source'].includes(command))throw new Error('dry-run / preflight / apply / verify-source만 지원합니다.');
  if(command==='apply'?(args.length!==3||args[1]!=='--confirm-parent'):args.length>1)throw new Error('명령 인자가 잘못되었습니다.');
  if(command==='dry-run'){console.log(JSON.stringify(plan(),null,2));return;}
  const config=readConfig(process.env,{live:true});
  const parentId=newParent(process.env.NOTION_COPY_PARENT_PAGE_ID);
  const client=new NotionClient({token:config.token}),store=new RunStore(RUN_ID);
  let result;
  if(command==='preflight')result=await preflight(client,parentId);
  else if(command==='apply')result=await createSource({client,store,parentId,confirmParent:args[2]});
  else {const state=await store.read();if(state?.taskId!=='NB-V2-007B'||state.status!=='source_verified'||!sameId(state.parentId,parentId))throw new Error('검증 완료된 원본 실행 기록이 필요합니다.');result=await verifyBundle(client,state);if(!result.ok)process.exitCode=2;}
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
