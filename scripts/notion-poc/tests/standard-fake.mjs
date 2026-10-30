import {FakeNotion,PARENT_ID} from './fake-notion.mjs';
import {rich} from '../../standard-notion/plan.mjs';
import {PERSONAL_WORKSPACE_ID} from '../../basic-notion/plan.mjs';
export const BOT='33333333-3333-4333-8333-333333333333';
export const standardTarget={kind:'personal-test',workspaceId:PERSONAL_WORKSPACE_ID,workspaceName:'가상 개인 공간',parentId:PARENT_ID,parentTitle:'NB-V2-009B 테스트',botId:BOT};
// Controlled synthetic responses for orchestration tests; not a Notion Formula interpreter.
export class StandardFake extends FakeNotion{
 constructor(){super();this.maxRetries=0;this.blocks=new Map();this.pages.get(PARENT_ID).properties={title:{type:'title',title:rich(standardTarget.parentTitle)}};}
 property(name,definition){const p=super.property(name,definition);for(const type of ['select','multi_select'])if(p[type])p[type].options=p[type].options.map((o,i)=>({...o,id:`${p.id}-o${i}`}));return p;}
 async get(path){
  if(path==='/v1/users/me'){this.record('GET',path);return {id:BOT,type:'bot',bot:{workspace_id:standardTarget.workspaceId,workspace_name:standardTarget.workspaceName}};}
  if(path.startsWith('/v1/blocks/')){this.record('GET',path);const id=path.split('/')[3];return {results:this.blocks.get(id)??[...this.databases.values()].filter(d=>d.parent.page_id===id).map(d=>({id:d.id,type:'child_database'})),has_more:false};}
  return super.get(path);
 }
 async post(path,body){const result=await super.post(path,body);if(path==='/v1/databases'){this.databases.get(result.id).description=body.description;this.sources.get(result.data_sources[0].id).title=[];}else this.blocks.set(result.id,structuredClone(body.children));return structuredClone(path==='/v1/databases'?this.databases.get(result.id):result);}
 async patch(path,body){if(body.title){this.record('PATCH',path,body);const s=this.sources.get(path.split('/').at(-1));s.title=body.title;return structuredClone(s);}return super.patch(path,body);}
 value(page,property,depth=0){if(depth>5)throw Error('mock cycle');const source=this.sources.get(page.parent.data_source_id),p=typeof property==='string'?Object.values(source.properties).find(p=>p.id===property):property;
  const stored=page.properties[p.id]??page.properties[p.name];if(stored)return {id:p.id,type:p.type,...structuredClone(stored)};
  if(p.type==='relation'){const target=this.sources.get(p.relation.data_source_id),back=p.relation.dual_property.synced_property_id;const related=[...this.pages.values()].filter(r=>r.parent.data_source_id===target.id&&(r.properties[back]?.relation??[]).some(ref=>ref.id===page.id));return {id:p.id,type:'relation',relation:related.map(r=>({id:r.id})),has_more:false};}
  const computed=(n,type)=>({id:p.id,type,[type]:{type:'number',number:this.wrongCalculation?-1:n}});
  if(p.type==='formula'){const expr=p.formula.expression;let match=expr.match(/^prop\("(.+)"\)\.length\(\)$/);if(match)return computed(this.value(page,source.properties[match[1]],depth+1).relation.length,'formula');match=expr.match(/^if\(prop\("(.+)"\) == "(.+)", 1, 0\)$/);if(match)return computed(this.value(page,source.properties[match[1]],depth+1).select?.name===match[2]?1:0,'formula');throw Error('unsupported mock expression');}
  if(p.type==='rollup'){const r=p.rollup,refs=this.value(page,r.relation_property_id,depth+1).relation;if(r.function==='count')return computed(refs.length,'rollup');if(r.function==='sum')return computed(refs.reduce((sum,ref)=>sum+this.value(this.pages.get(ref.id),r.rollup_property_id,depth+1).formula.number,0),'rollup');throw Error('unsupported mock rollup');}
  return {id:p.id,type:p.type,[p.type]:null};
 }
 async queryAll(id){this.record('READ_QUERY',id);const source=this.sources.get(id);return [...this.pages.values()].filter(p=>p.parent.data_source_id===id).map(p=>({...structuredClone(p),properties:Object.fromEntries(Object.values(source.properties).map(f=>[f.name,this.value(p,f)]))}));}
}
