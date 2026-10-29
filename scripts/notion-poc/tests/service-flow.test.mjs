import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {screen,storage} from './helpers/browser.mjs';
test('service: authenticated input -> Mock result -> copy/edit -> refresh restores same user input',async()=>{
 const shared=storage();const input=await screen('input',shared);
 const title='가상 교육 <img src=x onerror="UNSAFE">';input.node('education-name').value=title;input.node('dashboard-purpose').value='가상 목적';input.node('additional-requirements').value='<script>UNSAFE</script>';
 input.basic.forEach(c=>c.checked=true);input.extra.find(c=>c.value==='completion').checked=true;
 await input.node('requirement-form').fire('submit');assert.equal(input.context.location.href,'result.html');
 const result=await screen('result',shared);assert.equal(result.node('result-content').hidden,false);assert.equal(result.node('result-education-name').textContent,title);assert.ok(result.node('database-list').children.length>1);assert.equal(result.created.some(e=>e.tagName==='img'||e.tagName==='script'),false);
 await result.node('copy-all-button').fire('click');await result.flush();assert.ok(result.copied[0].includes(title));assert.ok(result.copied[0].includes('<script>UNSAFE</script>'));
 await result.node('edit-button').fire('click');assert.equal(result.context.location.href,'index.html');
 const restored=await screen('input',shared);assert.equal(restored.node('education-name').value,title);assert.equal(restored.node('dashboard-purpose').value,'가상 목적');assert.equal(restored.basic.filter(c=>c.checked).length,3);assert.equal(restored.extra.find(c=>c.value==='completion').checked,true);
 const refreshed=await screen('result',shared);assert.equal(refreshed.node('result-education-name').textContent,title);
});
test('service: malformed/unknown stored input returns empty state instead of crashing result',async()=>{
 for(const value of ['not-json','null','[]',JSON.stringify({educationName:'가상 교육'}),JSON.stringify({educationName:'가상 교육',basicItems:['unknown-module'],additionalItems:[]})]) {
  const st=storage();st.setItem('aiNotionBuilderRequirements',value);const view=await screen('result',st);assert.equal(view.node('empty-state').hidden,false);assert.equal(view.node('result-content').hidden,true);
 }
});
test('service: failed storage write preserves form, reports error and prevents result navigation',async()=>{
 const st=storage();st.setItem=()=>{throw Object.assign(new Error('synthetic quota'),{name:'QuotaExceededError'});};const view=await screen('input',st);view.node('education-name').value='가상 교육';const before=view.context.location.href;
 await view.node('requirement-form').fire('submit');assert.equal(view.context.location.href,before);assert.equal(view.node('education-name').value,'가상 교육');assert.match(view.node('requirement-save-error').textContent,/저장하지 못/);
});
test('service: anonymous original pages do not restore or generate private work',async()=>{
 const st=storage();st.setItem('aiNotionBuilderRequirements',JSON.stringify({educationName:'가상 비공개',basicItems:[],additionalItems:[]}));
 const view=await screen('input',st,{valid:false});assert.equal(view.node('education-name').value,'');assert.equal(view.node('requirement-form').handlers.submit,undefined);
});
test('service: form/CSV mapping UI and user color correction compile a valid schema without persisting response rows',async()=>{
 const view=await screen('mapping');view.node('form-text').value='교육 안내\n1. 이메일\n단답형';view.node('csv-file').files=[new Blob(['\uFEFF이메일\nSYNTHETIC_RESPONSE_NOT_TO_STORE'])];
 await view.node('analyze').fire('click');assert.match(view.node('feedback').textContent,/질문 1개/);assert.ok(!view.node('csv-preview').textContent.includes('SYNTHETIC_RESPONSE'));
 const color=view.walk(view.node('mapping-rows').children).find(e=>e.attributes['aria-label']==='base-selection option-0 색상');color.value='pink';await color.fire('change');
 let row=view.walk(view.node('mapping-rows').children).find(e=>e.dataset.localId==='base-selection');const confirm=row.children.find(e=>e.tagName==='button'&&e.textContent==='확인 완료');await confirm.fire('click');await view.node('preview').fire('click');
 const output=JSON.parse(view.node('schema-preview').textContent);assert.equal(output.networkRequests,0);assert.equal(output.databases.applications.properties['선정 상태'].select.options[0].color,'pink');assert.equal(view.node('download-schema').disabled,false);assert.equal(view.st.values.size,0);
 // This standalone legacy fixture omits the workspace bootstrap; integrated restoration is covered in education-drafts-ui.test.mjs.
 const refreshed=await screen('mapping',view.st);assert.equal(refreshed.node('form-text').value,'');assert.ok(!refreshed.node('schema-preview').textContent.includes('pink'));
});
test('deployment: every local HTML asset reference resolves, including the shared result logo',async()=>{
 for(const file of ['index.html','result.html','mapping.html','login.html']) {
  const html=await readFile(new URL('../../../'+file,import.meta.url),'utf8');
  for(const match of html.matchAll(/<(?:script|img|link)\b[^>]*(?:src|href)="([^"]+)"/g))if(!/^https?:|^data:/.test(match[1]))await readFile(new URL('../../../'+match[1],import.meta.url));
 }
});
