import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseForm,mergeSources} from '../../../js/mapping/parse.mjs';
import {readCsvTextHeader,describeColumns,csvHeaderText} from '../../../js/mapping/csv.mjs';
import {compileSchema,summarizeModel} from '../../../js/mapping/model.mjs';
import {emptyConfiguration,normalizeConfiguration,forSave} from '../../../js/drafts/model.mjs';
import {createWorkspace} from '../../../js/drafts/workspace.mjs';
import {createDraftRepository} from '../../../js/drafts/repository.mjs';
import {auth,mockServer,USER_A,storage} from './helpers/drafts-fixture.mjs';
import {screen} from './helpers/browser.mjs';

function adapter(work){const captures=new Map();return {snapshot:work.snapshot,register:(k,fn)=>captures.set(k,fn),update:work.update,showError:e=>{throw e;},capture(){for(const [k,fn]of captures)work.update(k,fn({saving:true}));}};}
async function csvText(view,text){view.node('csv-mode').value='text';await view.node('csv-mode').fire('change');view.node('csv-text').value=text;await view.node('csv-text').fire('input');await view.node('analyze').fire('click');}
const countSchema=s=>Object.values(s.databases).reduce((n,db)=>n+Object.keys(db.properties).length,0);

test('NB008A: CSV text shares BOM, quoted comma, escaped quote and multiline first-record semantics',async()=>{
 const columns=await readCsvTextHeader('\uFEFF이메일,"소개, 한 줄","표현 ""예시""","질문\n설명"\r\nSYNTHETIC_RESPONSE');
 assert.deepEqual(columns.map(c=>c.original),['이메일','소개, 한 줄','표현 "예시"','질문\n설명']);
 assert.deepEqual(await readCsvTextHeader(csvHeaderText(columns)),columns);
 assert.ok(!JSON.stringify(columns).includes('SYNTHETIC_RESPONSE'));
 for(const text of ['','"안 닫힘','a"b,c','"a" x,b','a'.repeat(65537)])await assert.rejects(readCsvTextHeader(text));
});
test('NB008A: opt-in safe CSV uses Text for unknown/choice aliases, Email/Phone for known headers, no inferred options',()=>{
 const m=mergeSources(parseForm(''),describeColumns(['메모','참여자 유형','이메일','연락처']),{safeCsvDefaults:true});
 const csv=m.properties.filter(p=>p.origin==='csv');
 assert.deepEqual(csv.map(p=>p.type),['rich_text','rich_text','email','phone_number']);
 assert.ok(csv.every(p=>p.mappingStatus==='automatic'&&p.options.length===0));
 assert.equal(compileSchema(m).networkRequests,0);
});
test('NB008A: combined input matches confident aliases and does not collapse duplicate headers/questions',()=>{
 const merged=mergeSources(parseForm('1. 이메일 주소\n단답형\n2. 신청 동기\n장문형'),describeColumns(['이메일','신청 동기','메모']),{safeCsvDefaults:true});
 assert.equal(merged.properties.filter(p=>p.origin==='csv').length,1);
 assert.equal(merged.properties.find(p=>p.localId==='form-0').csvColumn.index,0);
 assert.equal(compileSchema(merged).databases.applications.properties['신청 동기'].rich_text.constructor,Object);
 for(const columns of [['이메일',' 이메일 '],['성명','이름']]){
  const m=mergeSources(parseForm(''),describeColumns(columns),{safeCsvDefaults:true});
  assert.throws(()=>compileSchema(m),/충돌|확인|제목/);
 }
 const ambiguous=mergeSources(parseForm('1. 성명\n단답형\n2. 이름\n단답형'),describeColumns(['성명']),{safeCsvDefaults:true});
 assert.ok(ambiguous.properties.filter(p=>p.origin==='form').every(p=>!p.csvColumn&&p.mappingStatus==='review'));
});
test('NB008A: summary final count matches compiled schema including base/implicit titles and merged sources',()=>{
 const columns=describeColumns(['이메일','메모']);
 const m=mergeSources(parseForm('1. 이메일\n단답형'),columns,{safeCsvDefaults:true});
 const s=summarizeModel(m,columns);
 assert.equal(s.questions,1);assert.equal(s.columns,2);assert.equal(s.base,3);assert.equal(s.review,0);
 assert.equal(s.recommended,countSchema(compileSchema(m)));assert.equal(s.implicitTitles,4);
 m.properties.find(p=>p.origin==='csv').included=false;
 const next=summarizeModel(m,columns);assert.equal(next.excluded,1);assert.equal(next.recommended,countSchema(compileSchema(m)));
});
test('NB008A: long CSV header keeps the original, bounds suggested names, and detects truncation collisions',()=>{
 const prefix='가'.repeat(101),columns=describeColumns([prefix]);
 const m=mergeSources(parseForm(''),columns,{safeCsvDefaults:true});
 const p=m.properties.find(p=>p.origin==='csv');assert.equal(p.name.length,100);assert.equal(p.csvColumn.original,prefix);
 const c=emptyConfiguration();c.mapping={formText:'',encoding:'utf-8',columns,model:m};assert.equal(normalizeConfiguration(c).mapping.columns[0].original,prefix);assert.ok(compileSchema(m));
 const conflict=mergeSources(parseForm(''),describeColumns([prefix+'A',prefix+'B']),{safeCsvDefaults:true});assert.throws(()=>compileSchema(conflict),/충돌/);
});
test('NB008A UI: form-only and CSV file-only can preview without irrelevant input or per-column confirmations',async()=>{
 for(const kind of ['form','file']){
  const v=await screen('mapping');
  if(kind==='form')v.node('form-text').value='1. 신청 동기\n장문형';
  else v.node('csv-file').files=[new Blob(['이메일,자유 메모\nSYNTHETIC_RESPONSE,IGNORE'])];
  await v.node('analyze').fire('click');await v.node('preview').fire('click');
  assert.equal(v.node('download-schema').disabled,false,kind);
  assert.ok(!v.node('schema-preview').textContent.includes('SYNTHETIC_RESPONSE'));
  assert.match(v.node('preview-state').textContent,/미리보기 가능/);
 }
});
test('NB008A UI: CSV text only uses header and discards visible response rows after success',async()=>{
 const v=await screen('mapping');await csvText(v,'\uFEFF이메일,"메모, 내용"\nSYNTHETIC_RESPONSE,IGNORE');
 assert.equal(v.node('csv-file-fields').hidden,true);assert.equal(v.node('csv-text-fields').hidden,false);
 await v.node('preview').fire('click');assert.equal(v.node('download-schema').disabled,false);
 for(const id of ['csv-text','csv-preview','schema-preview'])assert.ok(!(v.node(id).value+v.node(id).textContent).includes('SYNTHETIC_RESPONSE'));
 assert.match(v.node('review-items').textContent,/Text 권장/);
 assert.equal(v.node('advanced-settings').open,undefined);
});
test('NB008A UI: combined input, unmatched safe CSV and explicit single/multiple types retain source structure',async()=>{
 const v=await screen('mapping');v.node('form-text').value='1. 참여자 유형\n단일 선택\n- 재직자\n- 구직자\n2. 신청 과정\n복수 선택\n- Basic\n- Associate';
 await csvText(v,'참여자 유형,신청 과정,메모');await v.node('preview').fire('click');
 const s=JSON.parse(v.node('schema-preview').textContent);
 assert.equal(s.sourceModel.properties.filter(p=>p.origin==='form').length,2);assert.equal(s.sourceModel.properties.filter(p=>p.origin==='csv').length,1);
 assert.ok(s.databases.applicants.properties['참여자 유형'].select);assert.ok(s.databases.applications.properties['신청 과정'].multi_select);
});
test('NB008A UI: malformed CSV/zero questions and valid CSV with unrecognized form remain blocked',async()=>{
 const v=await screen('mapping');
 await csvText(v,'"잘못된 CSV');assert.match(v.node('feedback').textContent,/분석 실패/);
 await v.node('preview').fire('click');assert.equal(v.node('download-schema').disabled,true);
 v.node('form-text').value='번호 없는 폼';await csvText(v,'이메일');assert.match(v.node('feedback').textContent,/폼에서 질문/);
 v.node('form-text').value='';await csvText(v,'');assert.match(v.node('feedback').textContent,/분석 실패/);
});
test('NB008A UI: duplicate columns require structural correction, confirmation alone cannot hide name conflicts',async()=>{
 const v=await screen('mapping');await csvText(v,'이메일, 이메일 ');
 await v.node('preview').fire('click');assert.equal(v.node('download-schema').disabled,true);assert.equal(v.node('advanced-settings').open,true);
 assert.match(v.node('review-items').textContent,/중복|충돌/);
 for(const row of v.node('mapping-rows').children)await row.children.find(n=>n.tagName==='button'&&n.textContent==='확인 완료').fire('click');
 await v.node('preview').fire('click');assert.equal(v.node('download-schema').disabled,true);
 assert.match(v.node('analysis-summary').textContent,/필수 확인 속성2개/);
});
test('NB008A: saving pending CSV changes is blocked rather than reporting an older header as newly saved',async()=>{
 const work=createWorkspace({storage:storage(),userId:USER_A}),api=adapter(work),v=await screen('mapping',undefined,{drafts:api});
 await csvText(v,'이메일');api.capture();
 v.node('csv-text').value='새 메모\nSYNTHETIC_PRIVATE_RESPONSE';await v.node('csv-text').fire('input');
 assert.throws(()=>api.capture(),{code:'analysis_required'});assert.ok(!JSON.stringify(work.snapshot()).includes('SYNTHETIC_PRIVATE_RESPONSE'));
 await v.node('analyze').fire('click');api.capture();assert.equal(work.snapshot().configuration.mapping.columns[0].original,'새 메모');
});
test('NB008A UI: unmatched sources are explained without blocking safe Text preview',async()=>{
 const v=await screen('mapping');v.node('form-text').value='1. 이메일\n단답형';await csvText(v,'연락처,메모');
 await v.node('preview').fire('click');assert.equal(v.node('download-schema').disabled,false);
 assert.match(v.node('review-items').textContent,/일치하는 CSV 컬럼이 없어/);assert.match(v.node('review-items').textContent,/일치하는 폼 질문이 없어/);
});
test('NB008A UI: changed source cannot reuse old preview even when the old mapping itself is valid',async()=>{
 const v=await screen('mapping');await csvText(v,'이메일');await v.node('preview').fire('click');assert.equal(v.node('download-schema').disabled,false);
 v.node('csv-text').value='메모';await v.node('csv-text').fire('input');await v.node('preview').fire('click');
 assert.equal(v.node('download-schema').disabled,true);assert.match(v.node('validation').textContent,/再|다시 분석/);
});
test('NB008A UI: input changing during asynchronous CSV read never replaces the current editor with stale results',async()=>{
 const v=await screen('mapping');let release;
 const read=new Promise(resolve=>{release=resolve;});const bytes=new TextEncoder().encode('이메일');
 v.node('csv-file').files=[{size:bytes.length,slice(){return {arrayBuffer:()=>read};}}];
 const pending=v.node('analyze').fire('click');v.node('form-text').value='1. 신청 동기\n장문형';await v.node('form-text').fire('input');release(bytes.buffer);await pending;
 assert.match(v.node('feedback').textContent,/분석 중 입력/);assert.equal(v.node('mapping-rows').children.length,3);
});
test('NB008A: v1 stored format gains optional education type without DB/schema changes or loss of legacy fields',()=>{
 const old=emptyConfiguration();delete old.requirements.educationType;old.requirements.educationName='가상 교육';
 const current=normalizeConfiguration(old);assert.equal(current.version,1);assert.equal(current.requirements.educationType,'education');
 current.requirements.educationType='hackathon';assert.equal(forSave(current).configuration.requirements.educationType,'hackathon');
 assert.throws(()=>normalizeConfiguration({...current,requirements:{...current.requirements,educationType:'unsupported'}}),{code:'invalid_configuration'});
});
test('NB008A integrated UI: save/open/refresh preserves CSV headers, names, colors, modules and education type without response rows',async()=>{
 const st=storage(),work=createWorkspace({storage:st,userId:USER_A}),api=adapter(work);
 const v=await screen('unified',st,{drafts:api});v.node('education-name').value='가상 해커톤';await v.node('education-name').fire('input');v.node('education-type').value='hackathon';await v.node('education-type').fire('change');
 v.node('dashboard-purpose').value='가상 목적';v.extra.find(c=>c.value==='completion').checked=true;
 await csvText(v,'이메일,메모\nSYNTHETIC_PRIVATE_RESPONSE,IGNORE');
 let nodes=v.walk(v.node('mapping-rows').children);
 const color=nodes.find(n=>n.attributes['aria-label']==='base-selection option-0 색상');color.value='pink';await color.fire('change');
 const name=v.walk(v.node('mapping-rows').children).find(n=>n.attributes['aria-label']==='csv-1 속성명');name.value='추가 메모';await name.fire('input');api.capture();
 const server=mockServer(),repo=createDraftRepository({authClient:auth(),createDataClient:server.createDataClient,userId:USER_A});const row=await repo.save(work.snapshot().configuration);
 assert.ok(!JSON.stringify(row).includes('SYNTHETIC_PRIVATE_RESPONSE'));assert.ok(!st.getItem('estEducationWorkspaceV1').includes('SYNTHETIC_PRIVATE_RESPONSE'));
 const fresh=createWorkspace({storage:storage(),userId:USER_A});fresh.open(await repo.get(row.id));
 const restored=await screen('unified',undefined,{drafts:adapter(fresh)});
 assert.equal(restored.node('education-type').value,'hackathon');assert.equal(restored.node('education-name').value,'가상 해커톤');assert.equal(restored.node('dashboard-purpose').value,'가상 목적');assert.equal(restored.extra.find(c=>c.value==='completion').checked,true);
 nodes=restored.walk(restored.node('mapping-rows').children);assert.equal(nodes.find(n=>n.attributes['aria-label']==='csv-1 속성명').value,'추가 메모');assert.equal(nodes.find(n=>n.attributes['aria-label']==='base-selection option-0 색상').value,'pink');
 assert.deepEqual((await readCsvTextHeader(restored.node('csv-text').value)).map(c=>c.original),['이메일','메모']);
 await restored.node('requirement-form').fire('submit');assert.equal(restored.context.location.href,'result.html');assert.equal(fresh.snapshot().configuration.requirements.educationType,'hackathon');
});
test('NB008A UI: restored source edited before analysis stays blocked after refresh; manual fields and auth guard remain supported',async()=>{
 const work=createWorkspace({storage:storage(),userId:USER_A});const v=await screen('mapping',undefined,{drafts:adapter(work)});
 v.node('form-text').value='1. 이메일\n단답형';await v.node('analyze').fire('click');v.node('form-text').value='1. 신청 동기\n장문형';await v.node('form-text').fire('input');
 const restored=await screen('mapping',undefined,{drafts:adapter(work)});await restored.node('preview').fire('click');assert.equal(restored.node('download-schema').disabled,true);
 const anonymous=await screen('mapping',undefined,{valid:false});assert.equal(anonymous.node('analyze').handlers.click,undefined);
 const manual=await screen('mapping');await manual.node('add-field').fire('click');const row=manual.node('mapping-rows').children.at(-1);await row.children.find(n=>n.tagName==='button'&&n.textContent==='확인 완료').fire('click');await manual.node('preview').fire('click');assert.equal(manual.node('download-schema').disabled,false);
});
test('NB008A HTML: both entry routes expose unified input, collapsed advanced settings and a retained legacy V1 path',async()=>{
 for(const file of ['index.html','mapping.html']){
  const html=await readFile(new URL('../../../'+file,import.meta.url),'utf8');
  assert.match(html,/새 Notion DB 구성하기/);assert.match(html,/id="csv-text"/);assert.match(html,/id="analysis-summary"/);assert.match(html,/<details id="advanced-settings" class="[^"]*">/);assert.match(html,/js\/mapping-ui.mjs/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,file);
 }
 const index=await readFile(new URL('../../../index.html',import.meta.url),'utf8');assert.match(index,/id="legacy-settings"/);assert.match(index,/id="requirement-form"/);
});
