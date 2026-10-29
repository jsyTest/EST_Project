import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RunStore} from '../state.mjs';
import {NotionError} from '../client.mjs';
import {FakeNotion} from './fake-notion.mjs';
import {RUN_ID,LAB_TITLE,DATABASES,plan,createSource,verifyBundle,main} from '../copy-experiment.mjs';
const SOURCE_PARENT='22222222-2222-4222-8222-222222222222';

// Fixed-fixture arithmetic only. This is NOT evidence of Notion formula/API support.
class ExperimentFake extends FakeNotion {
  constructor(){super();this.pages.set(SOURCE_PARENT,{object:'page',id:SOURCE_PARENT,parent:{workspace:true},properties:{title:{title:[{text:{content:LAB_TITLE}}]}}});}
  async get(path){
    if(path.startsWith('/v1/blocks/')){this.record('GET',path);const id=path.split('/')[3];return {has_more:false,results:[...this.databases.values()].filter(d=>d.parent.page_id===id).map(d=>({type:'child_database',id:d.id}))};}
    return super.get(path);
  }
  property(name,definition){
    const p=super.property(name,definition);
    for(const type of ['select','status'])if(p[type]?.options){
      p[type].options=p[type].options.map((o,i)=>({...o,id:`${p.id}-${i}`}));
      if(type==='status')p.status.groups=['To-do','In progress','Complete'].map(name=>({id:`g-${name}`,name,option_ids:p.status.options.filter(o=>o.group===name).map(o=>o.id)}));
    }
    return p;
  }
  async patch(path,body){
    const result=await super.patch(path,body);
    const source=this.sources.get(path.split('/').at(-1));
    if(source)for(const p of Object.values(source.properties))if(p.rollup){
      const relation=source.properties[p.rollup.relation_property_name];
      p.rollup.relation_property_id=relation.id;
      p.rollup.rollup_property_id=this.sources.get(relation.relation.data_source_id).properties[p.rollup.rollup_property_name].id;
    }
    return source?structuredClone(source):result;
  }
  async queryAll(id){
    this.record('QUERY',id);
    const db=this.databases.get(this.sources.get(id).parent.database_id);
    const key=Object.keys(DATABASES).find(k=>DATABASES[k].name===db.title[0].text.content);
    const pages=[...this.pages.values()].filter(p=>p.parent?.data_source_id===id).map(p=>structuredClone(p));
    const apps=[...this.pages.values()].filter(p=>p.properties?.['신청명']);
    const number=(kind,n)=>({[kind]:{type:'number',number:n}});
    for(const p of pages){
      if(key==='applications')Object.assign(p.properties,{'신청 값':number('formula',1),'선정 값':number('formula',p.properties['선정 상태'].select.name==='선정'?1:0)});
      else {
        const linked=apps.filter(a=>a.properties[key==='people'?'사람':'프로그램'].relation.some(r=>r.id===p.id));
        const selected=linked.filter(a=>a.properties['선정 상태'].select.name==='선정').length;
        Object.assign(p.properties,{'신청기록':{type:'relation',has_more:false,relation:linked.map(a=>({id:a.id}))},'신청 건수':number('rollup',linked.length),'선정 건수':number('rollup',selected),[key==='people'?'선정 인원 값':'선정률']:number('formula',key==='people'?(selected?1:0):selected/linked.length*100)});
      }
    }
    return pages;
  }
}
async function setup(t){const directory=await mkdtemp(join(tmpdir(),'nb007b-'));t.after(()=>rm(directory,{recursive:true,force:true}));return {client:new ExperimentFake(),store:new RunStore(RUN_ID,directory),parentId:SOURCE_PARENT,confirmParent:SOURCE_PARENT};}

test('NB007B: fixed dry-run has three DBs, seven fictional rows, distinct people/application counts and zero network',()=>{
  const p=plan();assert.equal(p.networkRequests,0);assert.equal(p.databaseCount,3);assert.equal(p.rowCount,7);
  assert.equal(p.fixture.people.length,2);assert.equal(p.fixture.applications.length,3);assert.deepEqual(p.expected.personApplications,{P01:2,P02:1});
  assert.equal(p.fixture.applications.filter(a=>a.person==='P01').length,2);
});
test('NB007B: parent mismatch is rejected before a read or write',async t=>{
  const args=await setup(t);await assert.rejects(createSource({...args,confirmParent:'11111111-1111-4111-8111-111111111111'}),/부모/);assert.equal(args.client.calls.length,0);assert.equal(await args.store.read(),null);
});
test('NB007B: the existing 002A page cannot be used even as a parent for new content',async t=>{
  const args=await setup(t),old='4081f60f-fdfa-80dd-9435-dfd053c1d4b3';
  await assert.rejects(createSource({...args,parentId:old,confirmParent:old}),/기존 NB-V2-002A/);assert.equal(args.client.calls.length,0);
});
test('NB007B: fixed source creates a separate bundle and verifies schema/relations/fixture using mock calculations',async t=>{
  const args=await setup(t);const state=await createSource(args);
  assert.equal(state.status,'source_verified');assert.equal(state.sourceVerification.ok,true);
  assert.deepEqual(state.sourceVerification.actual,{people:2,programs:2,applications:3,selectedPeople:2});
  assert.equal(args.client.calls.filter(c=>c.method==='POST'&&c.path==='/v1/databases').length,3);
  const pages=args.client.calls.filter(c=>c.method==='POST'&&c.path==='/v1/pages');assert.equal(pages.length,8);
  assert.equal(pages.filter(c=>c.body.parent.page_id===SOURCE_PARENT).length,1);
  assert.equal(args.client.calls.some(c=>c.path?.includes('4081f60f-fdfa-818d-8a2a-e202f2531cc9')),false);
  assert.equal(JSON.stringify(state).includes('token'),false);
});
test('NB007B: completed source is reused with zero further requests',async t=>{
  const args=await setup(t);await createSource(args);const before=args.client.calls.length;
  assert.equal((await createSource(args)).reusedExistingRun,true);assert.equal(args.client.calls.length,before);
});
test('NB007B: lost create response preserves uncertainty and refuses all automatic recreation',async t=>{
  const args=await setup(t),post=args.client.post.bind(args.client);
  args.client.post=async(path,body)=>{await post(path,body);throw new NotionError({code:'transport_or_response_error',uncertain:true});};
  await assert.rejects(createSource(args),/Notion 요청 실패/);
  const state=await args.store.read();assert.equal(state.status,'failed');assert.equal(state.steps[0].status,'uncertain');
  const before=args.client.calls.length;await assert.rejects(createSource(args),/미완료/);assert.equal(args.client.calls.length,before);
});
test('NB007B: source verification uses reads only and detects original/outside references without following them',async t=>{
  const args=await setup(t),state=await createSource(args);args.client.calls=[];
  args.client.sources.get(state.databases.applications.dataSourceId).properties['사람'].relation.data_source_id='c802c581-080e-40a0-93a0-7d6f331e8021';
  const result=await verifyBundle(args.client,state);assert.equal(result.ok,false);assert.equal(result.checks.find(c=>c.name==='사람 target').passed,false);
  assert.ok(args.client.calls.every(c=>['GET','QUERY'].includes(c.method)));
  assert.ok(args.client.calls.every(c=>!c.path?.includes('c802c581-080e-40a0-93a0-7d6f331e8021')));
});
test('NB007B: verification detects one-way relations, changed colors and changed formula expressions',async t=>{
  const args=await setup(t),state=await createSource(args);
  const apps=args.client.sources.get(state.databases.applications.dataSourceId).properties;
  apps['사람'].relation.type='single_property';apps['선정 상태'].select.options[0].color='red';apps['선정 값'].formula.expression='0';
  const result=await verifyBundle(args.client,state);assert.equal(result.ok,false);
  for(const name of ['사람 two-way','applications.선정 상태 options','applications.선정 값 expression'])assert.equal(result.checks.find(c=>c.name===name).passed,false,name);
});
test('NB007B: wrong calculated values fail verification even when schema and page counts match',async t=>{
  const args=await setup(t),state=await createSource(args),query=args.client.queryAll.bind(args.client);
  args.client.queryAll=async id=>{const rows=await query(id);if(id===state.databases.people.dataSourceId)rows[0].properties['신청 건수'].rollup.number=99;return rows;};
  const result=await verifyBundle(args.client,state);assert.equal(result.ok,false);assert.equal(result.checks.find(c=>c.name==='P01 application count').passed,false);
});
test('NB007B: unexpected properties and extra child databases are detected instead of counting manifest entries only',async t=>{
  const args=await setup(t),state=await createSource(args);
  args.client.sources.get(state.databases.people.dataSourceId).properties['예상 밖 속성']={type:'rich_text',rich_text:{}};
  args.client.databases.set('33333333-3333-4333-8333-333333333333',{id:'33333333-3333-4333-8333-333333333333',parent:{page_id:state.page.id}});
  const result=await verifyBundle(args.client,state);assert.equal(result.ok,false);
  assert.equal(result.checks.find(c=>c.name==='people property names').passed,false);
  assert.equal(result.checks.find(c=>c.name==='bundle contains exactly these three DBs').passed,false);
});
test('NB007B: CLI refuses unrecognized commands, stray arguments and unconfirmed apply',async()=>{
  for(const args of [['duplicate'],['apply'],['dry-run','--force']])await assert.rejects(main(args));
});
