import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {COLORS,baseProperties,option,validateModel,compileSchema,mergeExistingOptions,verifyOptionSchema} from '../../../js/mapping/model.mjs';
import {parseForm,mergeSources,recommend} from '../../../js/mapping/parse.mjs';
import {firstRecord,readCsvHeader,describeColumns} from '../../../js/mapping/csv.mjs';
import {DATABASES,RELATIONS,CALCULATIONS} from '../schema.mjs';
import {API_VERSION} from '../config.mjs';
import {makeFixture} from '../fixture.mjs';
import {runPoc} from '../engine.mjs';
import {RunStore} from '../state.mjs';
import {FakeNotion,PARENT_ID} from './fake-notion.mjs';
const model=()=>({version:1,properties:baseProperties()});
const csv=value=>readCsvHeader(new Blob([value]));

test('selection/completion/progress templates assign recommended allowed colors',()=>{
 const p=baseProperties();assert.deepEqual(p[0].options.map(o=>o.color),['blue','green','yellow','gray','red']);
 assert.deepEqual(p[1].options.map(o=>o.color),['green','red','yellow']);
 assert.deepEqual(p[2].options.map(o=>o.color),['gray','blue','green','red']);
 assert.equal(DATABASES.applications.properties['선정 상태'].select.options[0].color,'green');
});
test('select and multi-select compile edited user colors without internal IDs',()=>{
 const m=model();m.properties[0].options[0].color='pink';m.properties[1].type='multi_select';
 const s=compileSchema(m);assert.equal(s.networkRequests,0);
 assert.equal(s.databases.applications.properties['선정 상태'].select.options[0].color,'pink');
 assert.equal(s.databases.enrollments.properties['수료 상태'].multi_select.options[0].color,'green');
 assert.equal(s.databases.applications.properties['선정 상태'].select.options[0].localId,undefined);
});
test('invalid HEX colors and duplicate option names cannot compile',()=>{
 const m=model();m.properties[0].options[0].color='#ff0000';assert.throws(()=>compileSchema(m),/색상/);
 m.properties[0].options[0].color=COLORS[0];m.properties[0].options.push(option(' 선정 ',90));assert.throws(()=>compileSchema(m),/중복 옵션/);
});
test('status accepts fixed group membership but refuses arbitrary groups',()=>{
 const m=model();assert.equal(compileSchema(m).databases.courses.properties['교육 진행 상태'].status.options[1].group,'In progress');
 m.properties[2].options[0].group='임의 그룹';assert.throws(()=>compileSchema(m),/그룹/);
});
test('existing custom colors/options/IDs are retained; explicit edits change only requested color',()=>{
 const existing={options:[{id:'o1',name:'선정',color:'purple'},{id:'o2',name:'기타',color:'brown'}]};
 const value=mergeExistingOptions('select',existing,[{name:'선정',color:'green'},{name:'대기',color:'yellow'}]);
 assert.deepEqual(value.select.options,[{id:'o1',color:'purple'},{id:'o2',color:'brown'},{name:'대기',color:'yellow'}]);
 assert.equal(mergeExistingOptions('multi_select',existing,[{notionId:'o1',name:'선정',color:'red',colorSource:'user'}]).multi_select.options[0].color,'red');
});
test('existing-option rename/unknown IDs/duplicates fail without destructive replacement',()=>{
 const e={options:[{id:'one',name:'기존',color:'blue'}]};
 assert.throws(()=>mergeExistingOptions('select',e,[{notionId:'one',name:'변경'}]),/이름 변경/);
 assert.throws(()=>mergeExistingOptions('select',e,[{notionId:'bad',name:'기존'}]),/알 수 없는/);
 assert.throws(()=>mergeExistingOptions('select',e,[{name:'신규'},{name:' 신규 '}]),/중복/);
 assert.throws(()=>mergeExistingOptions('select',e,[{name:'기존',color:'cyan'}]),/색상/);
});
test('existing status keeps groups when omitted and checks explicit group edits',()=>{
 const e={options:[{id:'one',name:'시작',color:'blue'}]};
 assert.deepEqual(mergeExistingOptions('status',e,[{name:'끝',color:'green',group:'Complete'}]).status.options,[{id:'one',color:'blue'},{name:'끝',color:'green',group:'Complete'}]);
 assert.throws(()=>mergeExistingOptions('status',e,[{name:'끝',group:'새 그룹'}]),/그룹/);
});
test('remote schema verification checks returned option colors and status group membership',()=>{
 const expected={'상태':{status:{options:[{name:'완료',color:'green',group:'Complete'}]}}};
 const actual={'상태':{status:{options:[{id:'1',name:'완료',color:'green'}],groups:[{name:'Complete',option_ids:['1']}]}}};
 assert.equal(verifyOptionSchema(expected,actual),true);actual['상태'].status.options[0].color='red';assert.throws(()=>verifyOptionSchema(expected,actual),/색상/);
 actual['상태'].status.options[0].color='green';actual['상태'].status.groups[0].option_ids=[];assert.throws(()=>verifyOptionSchema(expected,actual),/그룹/);
});
test('form parser extracts question number, required marker, single/multiple options and leaves intro out',()=>{
 const p=parseForm('교육 신청 안내\n안내입니다.\n1. 성명(*)\n단답형\n2. 참여자 유형\n단일 선택\n- 재직자\n- 구직자\n3. 신청 과정 선택\n복수 선택\n□ Basic\n□ Associate');
 assert.equal(p.properties.length,3);assert.equal(p.properties[0].required,true);assert.equal(p.properties[0].type,'title');
 assert.equal(p.properties[1].type,'select');assert.equal(p.properties[2].type,'multi_select');assert.deepEqual(p.properties[2].options.map(o=>o.name),['Basic','Associate']);assert.equal(p.unparsed.length,2);
});
test('ambiguous cardinality, unknown questions and no recognizable questions remain reviewable',()=>{
 const p=parseForm('1. 신청 동기\n객관식\n- 업무\n- 관심\n2. 좋아하는 것은?\n설명입니다.');
 assert.equal(p.properties[0].mappingStatus,'review');assert.equal(p.properties[0].cardinality,'unknown');
 assert.equal(p.properties[1].mappingStatus,'review');assert.match(p.properties[1].rawText,/설명입니다/);
 assert.equal(parseForm('그냥 교육 안내문').properties.length,0);assert.equal(parseForm('그냥 교육 안내문').unparsed.length,1);
});
test('question and numbered choices are distinct for explicit choice blocks',()=>{
 const p=parseForm('1. 참여자 유형\n단일 선택\n1) 재직자\n2) 구직자\n2. 이메일\n단답형');
 assert.equal(p.properties.length,2);assert.deepEqual(p.properties[0].options.map(o=>o.name),['재직자','구직자']);
 assert.equal(p.properties[1].type,'email');
});
test('header parser supports Korean BOM, quoted commas, escaped quotes and embedded newlines',async()=>{
 const cols=await csv('\uFEFF성명(*),"소개, 한 줄","표현 ""예시""","질문\n설명"\r\n가상응답,ignored');
 assert.deepEqual(cols.map(c=>c.original),['성명(*)','소개, 한 줄','표현 "예시"','질문\n설명']);assert.equal(cols[0].normalized,'성명');
});
test('CSV duplicate/empty headers are retained by column index and flagged',async()=>{
 const cols=await csv('성명(*), 성명 ,,이메일\n');assert.equal(cols.length,4);
 assert.match(cols[0].issues[0],/중복/);assert.match(cols[2].issues[0],/빈 컬럼/);assert.equal(cols[1].index,1);
});
test('CSV malformed quotes, truncated encoding, invalid UTF-8 and size limit fail',async()=>{
 await assert.rejects(csv('"안 닫힘'),/인용부호/);await assert.rejects(csv('a"b,c\n'),/인용부호/);
 await assert.rejects(csv('"a" x,b\n'),/인용부호/);await assert.rejects(csv(''),/빈 CSV/);
 await assert.rejects(readCsvHeader(new Blob([Uint8Array.of(0xff,10)])),/인코딩/);
 await assert.rejects(csv('a'.repeat(65537)),/64 KiB/);
 assert.equal(firstRecord('a,b',{}),null);
});
test('EUC-KR/CP949 Korean header decoding is explicit, not guessed',async()=>{
 const bytes=Uint8Array.of(0xbc,0xba,0xb8,0xed,44,0xc0,0xcc,0xb8,0xde,0xc0,0xcf,10);
 const cols=await readCsvHeader(new Blob([bytes]),{encoding:'euc-kr'});assert.deepEqual(cols.map(c=>c.original),['성명','이메일']);
 await assert.rejects(readCsvHeader(new Blob([bytes]),{encoding:'utf-8'}),/인코딩/);
});
test('only bounded first-record slices are read; response rows never enter the model',async()=>{
 const requested=[];const bytes=new TextEncoder().encode('성명,이메일\n'+String.fromCharCode(255)+'SENTINEL_PRIVATE_RESPONSE'.repeat(10000));
 const file={size:bytes.length,slice(start,end){requested.push([start,end]);return new Blob([bytes.slice(start,end)]);}};
 const cols=await readCsvHeader(file);assert.equal(requested.length,1);assert.equal(requested[0][1],1024);assert.ok(!JSON.stringify(cols).includes('SENTINEL'));
 // Invalid encoding after a valid header must not fail header parsing.
 assert.equal((await readCsvHeader(new Blob([new TextEncoder().encode('성명\n'),Uint8Array.of(0xff)])))[0].original,'성명');
});
test('matching preserves separate original question/CSV names using exact alias rules',()=>{
 const form=parseForm('1. 본 프로그램을 어떤 경로를 통해 알게 되셨나요?\n단일 선택\n- 검색\n- 추천');
 const m=mergeSources(form,describeColumns(['유입 경로']));const p=m.properties.find(p=>p.origin==='form');
 assert.match(p.questionName,/본 프로그램/);assert.equal(p.csvColumn.original,'유입 경로');assert.equal(p.name,'유입 경로');assert.equal(p.mappingStatus,'automatic');
});
test('ambiguous columns/questions are not automatically collapsed',()=>{
 const m=mergeSources(parseForm('1. 성명\n단답형\n2. 이름\n단답형'),describeColumns(['성명']));
 assert.ok(m.properties.filter(p=>p.origin==='form').every(p=>p.csvColumn===null&&p.mappingStatus==='review'));
 assert.equal(m.properties.filter(p=>p.origin==='csv').length,1);
 const dup=mergeSources(parseForm('1. 성명\n단답형'),describeColumns(['성명','성명(*)']));assert.equal(dup.properties.find(p=>p.origin==='form').csvColumn,null);
});
test('manual corrections, exclusions and source-column uniqueness are validated',()=>{
 const m=mergeSources(parseForm('1. 알 수 없는 문항\n설명'),describeColumns(['기타']));assert.equal(validateModel(m).ok,false);
 for(const p of m.properties)if(p.mappingStatus==='review')p.mappingStatus='confirmed';
 assert.equal(validateModel(m).ok,true);
 const p=m.properties.find(p=>p.origin==='form');p.csvColumn={index:0,original:'기타'};assert.equal(validateModel(m).ok,false);
 m.properties.find(p=>p.origin==='csv').included=false;assert.equal(validateModel(m).ok,true);
});
test('title count/property name collisions and unsafe names are handled as data',()=>{
 const m=model();m.properties.push({...m.properties[0],localId:'other'});assert.throws(()=>compileSchema(m),/충돌/);
 const n=model();n.properties.push({localId:'x',name:'__proto__',type:'rich_text',targetDb:'applicants',included:true,mappingStatus:'confirmed'});
 const schema=compileSchema(n);assert.ok(Object.hasOwn(schema.databases.applicants.properties,'__proto__'));assert.ok(schema.databases.applicants.properties['이름'].title);
});
test('JSON round trip feeds the standalone no-network CLI with a valid standard model',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'mapping-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'mapping-model.json');await writeFile(file,JSON.stringify(model()));
 const result=spawnSync(process.execPath,['scripts/notion-poc/mapping-dry-run.mjs',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const out=JSON.parse(result.stdout);assert.equal(out.mode,'new-data-sources-only');assert.equal(out.networkRequests,0);assert.equal(Object.keys(out.databases).length,3);
});
test('completed pre-color PoC manifest is reused without API calls or color migration',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'mapping-legacy-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new RunStore('legacy',dir),client=new FakeNotion();
 const args={config:{parentId:PARENT_ID,apiVersion:API_VERSION,token:'test'},client,store,runId:'legacy',confirmParent:PARENT_ID,viewProfile:'free',verificationOptions:{attempts:1}};
 await runPoc(args);const s=await store.read();const db=structuredClone(DATABASES);
 for(const value of Object.values(db))for(const p of Object.values(value.properties))for(const o of p.select?.options??[])delete o.color;
 s.fingerprint=createHash('sha256').update(JSON.stringify({DATABASES:db,RELATIONS,CALCULATIONS,fixture:makeFixture(),API_VERSION,viewProfile:'free'})).digest('hex');await store.save(s);
 const before=client.calls.length;assert.equal((await runPoc(args)).reusedExistingRun,true);assert.equal(client.calls.length,before);
});
test('engine rejects changed option colors before creating another DB',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'mapping-color-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const client=new FakeNotion();const get=client.get.bind(client);
 client.get=async path=>{const result=await get(path);if(path.startsWith('/v1/data_sources/')){const prop=result.properties['참여자 유형'];if(prop)prop.select.options[0].color='red';}return result;};
 await assert.rejects(runPoc({config:{parentId:PARENT_ID},confirmParent:PARENT_ID,runId:'wrong-color',store:new RunStore('wrong-color',dir),client,viewProfile:'free'}),/옵션 색상 불일치/);
 assert.equal(client.calls.filter(c=>c.method==='POST'&&c.path==='/v1/databases').length,1);
});
