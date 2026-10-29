import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as model from '../../../js/mapping/model.mjs';
import * as parsing from '../../../js/mapping/parse.mjs';
import * as csv from '../../../js/mapping/csv.mjs';
const app=await readFile(new URL('../../../js/app.js',import.meta.url),'utf8');
const mock=await readFile(new URL('../../../js/mock-data.js',import.meta.url),'utf8');
const mapping=(await readFile(new URL('../../../js/mapping-ui.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.value='';this.checked=false;this.files=[];this.hidden=false;this.handlers={};this.ownText='';this.className='';this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};}
 set textContent(value){this.ownText=String(value);this.children=[];}
 get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');}
 set innerHTML(_v){throw new Error('Unsafe HTML sink');}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.ownText='';this.children=children;}
 setAttribute(k,v){this.attributes[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())]=v;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
 focus(){this.focused=true;}
 async fire(type){for(const handler of this.handlers[type]??[])await handler({preventDefault(){}});}
}
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};};
async function screen(page,st=storage(),{valid=true}={}) {
 const ids={},created=[],callbacks={},copied=[];const node=id=>ids[id]??=new Element();
 const basic=['students','attendance','schedule'].map(value=>Object.assign(new Element('input'),{name:'basicItems',value}));
 const extra=['assignments','evaluations','completion','instructors','supplies'].map(value=>Object.assign(new Element('input'),{name:'additionalItems',value}));
 const form=node('requirement-form');form.elements={purpose:node('dashboard-purpose'),requirements:node('additional-requirements')};
 form.querySelectorAll=selector=>{const group=selector.includes('basicItems')?basic:extra;return selector.endsWith(':checked')?group.filter(c=>c.checked):group;};
 const walk=nodes=>nodes.flatMap(n=>[n,...walk(n.children)]);
 const document={body:{dataset:{page}},documentElement:{dataset:{authRequired:'true',authState:valid?'authenticated':'anonymous'}},getElementById:node,createElement(tag){const e=new Element(tag);created.push(e);return e;},querySelectorAll(selector){return created.filter(e=>e.className.split(' ').includes(selector.slice(1)));}};
 const context={document,sessionStorage:st,URL,Blob,TextDecoder,Promise,...model,...parsing,...csv,navigator:{clipboard:{async writeText(text){copied.push(text);}}},isSecureContext:true,location:{href:'https://education.example/'+(page==='input'?'index.html':page==='result'?'result.html':'mapping.html')},scrollTo(){},setTimeout:()=>1,clearTimeout(){},addEventListener(type,callback){(callbacks[type]??=[]).push(callback);},estAuth:{ready:Promise.resolve(valid)}};
 context.window=context;vm.createContext(context);vm.runInContext(mock,context);
 if(page==='mapping'){node('encoding').value='utf-8';vm.runInContext(mapping,context);}else vm.runInContext(app,context);
 async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
 await flush();return {context,node,ids,created,basic,extra,st,copied,walk,flush,dispatch(type){for(const fn of callbacks[type]??[])fn();}};
}

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
 // The current product explicitly keeps mapping drafts in memory; refresh persistence is not implemented.
 const refreshed=await screen('mapping',view.st);assert.equal(refreshed.node('form-text').value,'');assert.ok(!refreshed.node('schema-preview').textContent.includes('pink'));
});
test('deployment: every local HTML asset reference resolves, including the shared result logo',async()=>{
 for(const file of ['index.html','result.html','mapping.html','login.html']) {
  const html=await readFile(new URL('../../../'+file,import.meta.url),'utf8');
  for(const match of html.matchAll(/<(?:script|img|link)\b[^>]*(?:src|href)="([^"]+)"/g))if(!/^https?:|^data:/.test(match[1]))await readFile(new URL('../../../'+match[1],import.meta.url));
 }
});
