import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const sources=await Promise.all(['auth-bootstrap.js','auth-core.js','auth.js'].map(file=>readFile(new URL(`../../../js/${file}`,import.meta.url),'utf8')));
class Element {
 constructor(id=''){this.id=id;this.value='';this.type='text';this.disabled=false;this.hidden=false;this.dataset={};this.textContent='';this.handlers={};this.attributes={};this.children=[];this.classes=new Set();this.classList={toggle:(name,enabled)=>enabled?this.classes.add(name):this.classes.delete(name)};}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
 focus(){this.focused=true;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;this.cleared=true;}
 querySelectorAll(){return this.controls??[];}
 async fire(type,event={}){for(const handler of this.handlers[type]??[])await handler({preventDefault(){},...event});}
}
export async function authUI({protectedPage=false,url='https://education.example/login.html',session=null,error=null,missingSdk=false,stored={}}={}) {
 const nodes={};const get=id=>nodes[id]??=new Element(id);
 for(const id of ['auth-email','auth-password','auth-confirmation','auth-message','auth-form','auth-title','auth-description','confirmation-field','password-help','auth-switch','auth-submit','auth-retry','auth-gate-message','auth-email-error','auth-password-error','auth-confirmation-error'])get(id);
 const toggles=[new Element(),new Element()];toggles[0].dataset.passwordToggle='auth-password';toggles[1].dataset.passwordToggle='auth-confirmation';
 get('auth-form').controls=[get('auth-email'),get('auth-password'),get('auth-confirmation'),get('auth-submit'),...toggles];
 const header=new Element(),main=new Element();const privateInput=new Element();privateInput.value='synthetic private draft';
 const doc={documentElement:{dataset:protectedPage?{authRequired:'true',authState:'checking'}:{authPage:'true',authState:'checking'}},title:'',getElementById:get,createElement:()=>new Element(),querySelector:()=>header,querySelectorAll:selector=>selector==='[data-password-toggle]'?toggles:selector==='main[data-auth-content]'?[main]:selector.includes('[data-auth-content]')?[privateInput]:[]};
 const pending=[],listeners={},navigations=[],requests=[],map=new Map(Object.entries(stored));let authCallback;
 const client={auth:{
  onAuthStateChange(fn){authCallback=fn;return {data:{subscription:{unsubscribe(){}}}};},
  async getSession(){return {data:{session},error};},
  async signInWithPassword(values){requests.push(['signin',values]);return {data:{session:{access_token:'synthetic',user:{id:'user-a',email:'learner@example.invalid'}}},error:null};},
  async signUp(values){requests.push(['signup',values]);return {data:{user:{id:'synthetic-user'},session:null},error:null};},
  async signOut(values){requests.push(['signout',values]);return {error:null};}
 }};
 const loc=new URL(url);loc.replace=value=>navigations.push(value);loc.reload=()=>navigations.push('reload');
 const context={document:doc,location:loc,URL,URLSearchParams,Promise,Event,console:{warn(){throw new Error('Unexpected console warning');},log(){throw new Error('Unexpected console log');}},setTimeout(fn,ms){if(ms!==20000)pending.push(fn);return 1;},clearTimeout(){},sessionStorage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},addEventListener(type,handler){(listeners[type]??=[]).push(handler);},dispatchEvent(event){for(const handler of listeners[event.type]??[])handler(event);},history:{replaceState(_a,_b,path){const next=new URL(path,loc.href);loc.href=next.href;}}};
 if(!missingSdk)context.supabaseClient=client;context.window=context;
 vm.createContext(context);for(const source of sources)vm.runInContext(source,context);
 async function flush(){for(let i=0;i<8;i++){await Promise.resolve();while(pending.length)pending.shift()();}}
 await flush();
 return {context,doc,nodes,header,main,privateInput,toggles,client,navigations,requests,storage:map,flush,emit(event,s){authCallback(event,s);}};
}
