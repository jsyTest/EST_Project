import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseForm, mergeSources} from '../../../js/mapping/parse.mjs';
import {baseProperties, validateModel, compileSchema} from '../../../js/mapping/model.mjs';
import {describeColumns} from '../../../js/mapping/csv.mjs';
import {normalizeConfiguration} from '../../../js/drafts/model.mjs';
import {screen} from './helpers/browser.mjs';

const form = (type, name='신청 동기', options='') => parseForm(`1. ${name}\n${type}${options}`);
const confirmAll = view => Promise.all(view.node('mapping-rows').children.map(row =>
  row.children.find(n => n.tagName==='button' && n.textContent==='확인 완료').fire('click')));

test('NB007A: numbered form still separates source question counts from operational defaults', () => {
  const parsed = parseForm('1. 성명(*)\n단답형\n2. 이메일\n단답형');
  const model = mergeSources(parsed, []);
  assert.equal(parsed.properties.length, 2);
  assert.equal(model.properties.filter(p=>p.origin==='base').length, 3);
  assert.equal(validateModel(model).ok, true);
  assert.deepEqual(parsed.properties.map(p=>p.type), ['title','email']);
});
test('NB007A: unnumbered, empty and defaults-only input cannot compile', () => {
  for (const text of ['', '성명\n단답형\n이메일\n단답형']) {
    const parsed = parseForm(text);
    assert.equal(parsed.properties.length, 0);
    assert.throws(()=>mergeSources(parsed, []), /질문/);
  }
  const model={version:1,properties:baseProperties()};
  assert.equal(validateModel(model).ok, false);
  assert.throws(()=>compileSchema(model), /기본 운영 속성만/);
  model.properties.push({localId:'excluded',origin:'form',included:false});
  assert.equal(validateModel(model).ok, false);
});
test('NB007A: manual fields remain supported without introducing a storage schema change', () => {
  const model={version:1,properties:[...baseProperties(),{localId:'manual-0',origin:'manual',questionName:'',csvColumn:null,required:null,name:'메모',type:'rich_text',targetDb:'applicants',options:[],included:true,mappingStatus:'confirmed',reviewReasons:[]}]};
  const saved=normalizeConfiguration({version:1,requirements:{educationName:'가상 교육'},mapping:{formText:'',encoding:'utf-8',columns:[],model}});
  assert.equal(saved.version,1);
  assert.equal(compileSchema(saved.mapping.model).databases.applicants.properties['메모'].rich_text.constructor, Object);
});
test('NB007A: explicit long, descriptive and short text override a choice alias without fabricated options', () => {
  for (const type of ['장문형','서술형','주관식','단답형','입력 유형: 장문형']) {
    const p=form(type).properties[0];
    assert.equal(p.type,'rich_text',type);
    assert.deepEqual(p.options,[],type);
    assert.equal(p.cardinality,null,type);
    assert.equal(p.mappingStatus,'automatic',type);
  }
  assert.equal(parseForm('1. 신청 동기 / 장문형').properties[0].type,'rich_text');
  assert.equal(form('장문형','이메일').properties[0].type,'rich_text');
});
test('NB007A: explicit single and multiple choices override non-choice aliases and keep colors', () => {
  for(const [type,expected] of [['단일 선택','select'],['단일 선택형','select'],['복수 선택','multi_select'],['복수 선택형','multi_select'],['객관식 (복수)','multi_select']]) {
    const p=form(type,'교육 기대사항','\n- 출석\n- 결석').properties[0];
    assert.equal(p.type,expected,type);
    assert.deepEqual(p.options.map(o=>[o.name,o.color]),[['출석','green'],['결석','red']],type);
    assert.equal(p.mappingStatus,'automatic',type);
  }
});
test('NB007A: ambiguous and conflicting input types stay reviewable; missing choices never get invented', () => {
  for (const type of ['객관식','단일 선택','복수 선택','장문형\n복수 선택','단일 선택\n복수 선택']) {
    const p=form(type).properties[0];
    assert.equal(p.mappingStatus,'review',type);
    assert.deepEqual(p.options,[],type);
  }
  assert.equal(form('','새 질문').properties[0].mappingStatus,'review');
  assert.equal(form('장문형\n- 선택지처럼 보이는 설명').properties[0].options.length,0);
});
test('NB007A: CSV-only input remains valid after explicit review without a missing-form warning', () => {
  const parsed=parseForm('');
  assert.deepEqual(parsed.warnings,[]);
  const model=mergeSources(parsed,describeColumns(['이메일']));
  assert.equal(validateModel(model).ok,false);
  model.properties.find(p=>p.origin==='csv').mappingStatus='confirmed';
  assert.equal(compileSchema(model).databases.applicants.properties['이메일'].email.constructor,Object);
  assert.throws(()=>mergeSources(parseForm('번호 없는 질문'),describeColumns(['이메일'])),/폼에서 질문을 찾지 못/);
});
test('NB007A UI: zero recognized form questions report failure and disable schema download', async () => {
  const view=await screen('mapping');
  view.node('form-text').value='성명\n단답형\n이메일\n단답형';
  await view.node('analyze').fire('click');
  assert.match(view.node('feedback').textContent,/분석 실패.*폼에서 질문을 찾지 못/);
  await view.node('preview').fire('click');
  assert.match(view.node('validation').textContent,/기본 운영 속성만/);
  assert.equal(view.node('download-schema').disabled,true);
});
test('NB007A UI: valid CSV cannot hide a failed form; clearing the form permits CSV-only recovery', async () => {
  const view=await screen('mapping');
  view.node('form-text').value='번호 없는 이메일 질문';
  view.node('csv-file').files=[new Blob(['이메일\nDO_NOT_STORE_RESPONSE'])];
  await view.node('analyze').fire('click');
  assert.match(view.node('feedback').textContent,/분석 실패.*폼에서 질문/);
  await view.node('preview').fire('click');
  assert.equal(view.node('download-schema').disabled,true);
  view.node('form-text').value=''; await view.node('form-text').fire('input');
  await view.node('analyze').fire('click');
  assert.match(view.node('feedback').textContent,/폼 질문 0개 · CSV 컬럼 1개 · 기본 운영 속성 3개/);
  assert.doesNotMatch(view.node('feedback').textContent,/찾지 못/);
  await confirmAll(view); await view.node('preview').fire('click');
  assert.equal(view.node('download-schema').disabled,false);
  assert.ok(!view.node('schema-preview').textContent.includes('DO_NOT_STORE_RESPONSE'));
});
test('NB007A UI: failed reanalysis keeps edited mappings and source columns but invalidates a previous success', async () => {
  const view=await screen('mapping');
  view.node('form-text').value='1. 이메일\n단답형';
  view.node('csv-file').files=[new Blob(['이메일\n'])];
  await view.node('analyze').fire('click'); await view.node('preview').fire('click');
  assert.equal(view.node('download-schema').disabled,false);
  const color=view.walk(view.node('mapping-rows').children).find(n=>n.attributes['aria-label']==='base-selection option-0 색상');
  color.value='pink'; await color.fire('change'); await confirmAll(view);
  const before=view.node('csv-preview').textContent;
  view.node('form-text').value='번호 없는 잘못된 입력';
  view.node('csv-file').files=[new Blob(['다른 컬럼\n'])];
  await view.node('analyze').fire('click');
  assert.equal(view.node('csv-preview').textContent,before);
  const retained=view.walk(view.node('mapping-rows').children).find(n=>n.attributes['aria-label']==='base-selection option-0 색상');
  assert.equal(retained.value,'pink');
  await view.node('preview').fire('click'); assert.equal(view.node('download-schema').disabled,true);
});
test('NB007A UI: invalid restored form remains blocked even when its saved mapping is valid', async () => {
  const model=mergeSources(parseForm('1. 이메일\n단답형'),[]);
  const drafts={snapshot:()=>({configuration:{mapping:{formText:'번호 없는 질문',encoding:'utf-8',columns:[],model}}}),register(){},update(){},showError(){}};
  const view=await screen('mapping',undefined,{drafts});
  await view.node('preview').fire('click');
  assert.match(view.node('validation').textContent,/폼에서 질문을 찾지 못/);
  assert.equal(view.node('download-schema').disabled,true);
});
test('NB007A UI: editing source input invalidates downloaded schema and malformed CSV is not reported as success', async () => {
  const view=await screen('mapping');view.node('form-text').value='1. 이메일\n단답형';
  await view.node('analyze').fire('click');await view.node('preview').fire('click');
  assert.equal(view.node('download-schema').disabled,false);
  view.node('form-text').value='1. 신청 동기\n장문형'; await view.node('form-text').fire('input');
  assert.equal(view.node('download-schema').disabled,true);
  view.node('csv-file').files=[new Blob(['"닫히지 않음'])]; await view.node('analyze').fire('click');
  assert.match(view.node('feedback').textContent,/분석 실패.*인용부호/);
  await view.node('preview').fire('click'); assert.equal(view.node('download-schema').disabled,true);
});
test('NB007A CLI: an old defaults-only mapping cannot bypass the preview guard', async t => {
  const dir=await mkdtemp(join(tmpdir(),'nb007a-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'defaults.json');await writeFile(file,JSON.stringify({version:1,properties:baseProperties()}));
  const result=spawnSync(process.execPath,['scripts/notion-poc/mapping-dry-run.mjs',file],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/기본 운영 속성만/);assert.equal(result.stdout,'');
});
test('NB007A: user-facing action copy describes previews while V1 result behavior is retained', async () => {
  const input=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
  const output=await readFile(new URL('../../../result.html',import.meta.url),'utf8');
  assert.match(input,/설계안 미리보기/);assert.doesNotMatch(input,/AI 설계 생성/);
  assert.match(output,/규칙 기반 샘플 설계안/);assert.match(output,/실제 Notion DB를 생성하지 않습니다/);
  const view=await screen('input');view.node('education-name').value='회귀 교육';
  await view.node('requirement-form').fire('submit');assert.equal(view.context.location.href,'result.html');
});
