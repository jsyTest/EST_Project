import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as model from '../../../../js/mapping/model.mjs';
import * as parsing from '../../../../js/mapping/parse.mjs';
import * as csv from '../../../../js/mapping/csv.mjs';
import * as planner from '../../../../js/planner/plan.mjs';
import * as catalog from '../../../../js/planner/catalog.mjs';
const app=await readFile(new URL('../../../../js/app.js',import.meta.url),'utf8');
const mock=await readFile(new URL('../../../../js/mock-data.js',import.meta.url),'utf8');
const mapping=(await readFile(new URL('../../../../js/mapping-ui.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
export class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.value='';this.checked=false;this.files=[];this.hidden=false;this.handlers={};this.ownText='';this.className='';this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};}
 set textContent(value){this.ownText=String(value);this.children=[];}
 get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');}
 set innerHTML(_v){throw new Error('Unsafe HTML sink');}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.ownText='';this.children=children;}
 setAttribute(k,v){this.attributes[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())]=v;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
 querySelectorAll(selector){const walk=nodes=>nodes.flatMap(n=>[n,...walk(n.children)]);return walk(this.children).filter(n=>n.tagName===selector);}
 focus(){this.focused=true;}
 async fire(type){for(const handler of this.handlers[type]??[])await handler({preventDefault(){}});}
}
export const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};};
export async function screen(page,st=storage(),{valid=true,drafts}={}) {
 const ids={},created=[],callbacks={},copied=[];const node=id=>ids[id]??=new Element();
 const basic=['students','attendance','schedule'].map(value=>Object.assign(new Element('input'),{name:'basicItems',value}));
 const extra=['assignments','evaluations','completion','instructors','supplies'].map(value=>Object.assign(new Element('input'),{name:'additionalItems',value}));
 const form=node('requirement-form');form.elements={purpose:node('dashboard-purpose'),requirements:node('additional-requirements')};
 form.querySelectorAll=selector=>{const group=selector.includes('basicItems')?basic:extra;return selector.endsWith(':checked')?group.filter(c=>c.checked):group;};
 const walk=nodes=>nodes.flatMap(n=>[n,...walk(n.children)]);
 const document={body:{dataset:{page:page==='unified'?'input':page}},documentElement:{dataset:{authRequired:'true',authState:valid?'authenticated':'anonymous'}},getElementById:node,createElement(tag){const e=new Element(tag);created.push(e);return e;},querySelector(selector){return selector==='[data-drafts-root]'?node('draft-root'):null;},querySelectorAll(selector){return created.filter(e=>e.className.split(' ').includes(selector.slice(1)));}};
 const context={document,sessionStorage:st,URL,Blob,TextDecoder,Promise,...model,...parsing,...csv,...planner,...catalog,navigator:{clipboard:{async writeText(text){copied.push(text);}}},isSecureContext:true,location:{href:'https://education.example/'+(page==='input'?'index.html':page==='result'?'result.html':'mapping.html')},scrollTo(){},setTimeout:()=>1,clearTimeout(){},addEventListener(type,callback){(callbacks[type]??=[]).push(callback);},estAuth:{ready:Promise.resolve(valid)}};
 if(drafts)context.estDraftsReady=Promise.resolve(drafts);context.window=context;vm.createContext(context);vm.runInContext(mock,context);
 if(page==='mapping'||page==='unified'){node('encoding').value='utf-8';node('csv-mode').value='file';if(page==='unified')vm.runInContext(app,context);vm.runInContext(mapping,context);}else vm.runInContext(app,context);
 async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
 await flush();return {context,node,ids,created,basic,extra,st,copied,walk,flush,dispatch(type){for(const fn of callbacks[type]??[])fn();}};
}

