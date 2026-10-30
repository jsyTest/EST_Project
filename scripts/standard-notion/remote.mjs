import {text} from '../basic-notion/plan.mjs';
import {PROTECTED_IDS,marker,rich,safeId,sameId,reject,fieldBy} from './plan.mjs';
export {text};
export const propSame=(a,b)=>{try{return typeof a==='string'&&typeof b==='string'&&decodeURIComponent(a)===decodeURIComponent(b);}catch{return a===b;}};
export const byId=(source,id)=>Object.values(source.properties??{}).find(p=>propSame(p.id,id));
export async function blockChildren(client,id){const blocks=[],seen=new Set();let cursor;do{const result=await client.get(`/v1/blocks/${id}/children?page_size=100${cursor?`&start_cursor=${encodeURIComponent(cursor)}`:''}`);if(!Array.isArray(result.results))reject('invalid_block_response');blocks.push(...result.results);if(blocks.length>1000)reject('inspection_limit');cursor=result.has_more?result.next_cursor:null;if(result.has_more&&(!cursor||seen.has(cursor)))reject('invalid_pagination');seen.add(cursor);}while(cursor);return blocks;}
export async function standardPreflight(client,target){
 const self=await client.get('/v1/users/me');if(self.type!=='bot'||!sameId(self.id,target.botId)||!sameId(self.bot?.workspace_id,target.workspaceId)||self.bot.workspace_name!==target.workspaceName)reject('connection_identity_mismatch');
 let id=target.parentId;const seen=new Set();for(let depth=0;depth<20;depth++){
  if(PROTECTED_IDS.has(id))reject('protected_parent_ancestry');if(seen.has(id))reject('parent_cycle');seen.add(id);
  const page=await client.get(`/v1/pages/${id}`);if(page.object!=='page'||!sameId(page.id,id)||page.archived||page.in_trash||page.is_locked)reject('parent_unavailable');
  if(depth===0&&text(Object.values(page.properties??{}).find(p=>p.type==='title'||p.title)?.title)!==target.parentTitle)reject('parent_title_mismatch');
  if(page.parent?.workspace===true)break;if(!page.parent?.page_id||depth===19)reject('unsupported_parent_ancestry');id=safeId(page.parent.page_id);
 }
 const databases=(await blockChildren(client,target.parentId)).filter(b=>b.type==='child_database').map(b=>safeId(b.id));
 return {parentId:target.parentId,workspaceId:target.workspaceId,botId:target.botId,databases,readAccessVerified:true,writeCapabilities:'not proven by read-only requests',mutations:0};
}
export async function ownedSource(client,prepared,state,sourceId){
 const db=prepared.spec.databases.find(d=>d.dataSourceLogicalId===sourceId);if(!db)reject('missing_source');const remote=state.databases[db.logicalId];if(!remote?.databaseId)reject('database_id_missing');
 const id=safeId(remote.databaseId);if(PROTECTED_IDS.has(id))reject('protected_remote_id');const database=await client.get(`/v1/databases/${id}`);
 if(database.object!=='database'||!sameId(database.id,id)||database.archived||database.in_trash||!sameId(database.parent?.page_id,prepared.target.parentId)||text(database.description)!==marker(prepared,db.logicalId))reject('database_ownership_mismatch');
 if(!Array.isArray(database.data_sources)||database.data_sources.length!==1)reject('data_source_count');const dataSourceId=safeId(database.data_sources[0].id);if(PROTECTED_IDS.has(dataSourceId)||remote.dataSourceId&&!sameId(remote.dataSourceId,dataSourceId))reject('data_source_binding_mismatch');
 const source=await client.get(`/v1/data_sources/${dataSourceId}`);if(source.object!=='data_source'||!sameId(source.id,dataSourceId)||!sameId(source.parent?.database_id,id)||source.archived||source.in_trash)reject('data_source_parent_mismatch');
 remote.dataSourceId=dataSourceId;remote.createdTime=database.created_time??remote.createdTime??null;
 return {database,source,sourceId,dataSourceId,databaseId:id};
}
export function bindFields(prepared,state,owned){for(const f of prepared.spec.fields.filter(f=>f.sourceId===owned.sourceId)){
 const p=owned.source.properties?.[f.name];if(p?.type===f.type){const previous=state.propertyIds[f.logicalId];if(previous&&!propSame(previous,p.id))reject('property_id_changed');state.propertyIds[f.logicalId]=p.id;}
}}
export function schemaMatches(prepared,state,owned,field){const p=byId(owned.source,state.propertyIds[field.logicalId])??owned.source.properties?.[field.name];if(p?.name!==field.name||p?.type!==field.type||!p.id)return false;
 if(field.options){const options=p[field.type]?.options;if(!Array.isArray(options)||options.length!==field.options.length||new Set(options.map(o=>o.id)).size!==options.length||!field.options.every(o=>options.some(a=>a.id&&a.name===o.name&&a.color===o.color)))return false;}
 return true;}
export async function relationPair(client,prepared,state,r){
 const source=await ownedSource(client,prepared,state,r.sourceId),target=await ownedSource(client,prepared,state,r.targetId),f=fieldBy(prepared,r.propertyId);
 const forward=source.source.properties?.[f.name];if(!forward)return null;
 if(forward.type!=='relation'||forward.relation?.type!=='dual_property'||!sameId(forward.relation.data_source_id,target.dataSourceId))reject('relation_target_mismatch');
 const reverse=byId(target.source,forward.relation.dual_property?.synced_property_id);
 if(reverse?.type!=='relation'||reverse.relation?.type!=='dual_property'||!sameId(reverse.relation.data_source_id,source.dataSourceId)||!propSame(reverse.relation.dual_property?.synced_property_id,forward.id))reject('relation_reverse_mismatch');
 for(const [logicalId,remoteId]of [[r.propertyId,forward.id],[r.reversePropertyId,reverse.id]]){if(state.propertyIds[logicalId]&&!propSame(state.propertyIds[logicalId],remoteId))reject('property_id_changed');state.propertyIds[logicalId]=remoteId;}
 return {source,target,forward,reverse};
}
export function calculationMatches(prepared,state,owned,id){const f=fieldBy(prepared,id);const p=byId(owned.source,state.propertyIds[id])??owned.source.properties?.[f.name];if(p?.name!==f.name||p?.type!==f.type)return false;
 const formula=prepared.spec.formulas.find(c=>c.propertyId===id);if(formula)return p.formula?.expression===formula.expression;
 const rollup=prepared.spec.rollups.find(c=>c.propertyId===id);return Boolean(rollup&&p.rollup?.function===rollup.apiFunction&&propSame(p.rollup.relation_property_id,state.propertyIds[rollup.relationPropertyId])&&propSame(p.rollup.rollup_property_id,state.propertyIds[rollup.targetPropertyId]));}
export function rowSource(prepared,rowKey){for(const [key,rows]of Object.entries(prepared.fixture))if(Array.isArray(rows)&&rows.some(r=>r.key===rowKey))return prepared.spec.databases.find(d=>d.key===key)?.dataSourceLogicalId;reject('unknown_fixture_key');}
export async function ownedRow(client,prepared,state,row){const remote=state.rows[row.key];if(!remote?.pageId)return null;const sourceId=rowSource(prepared,row.key),owned=await ownedSource(client,prepared,state,sourceId),page=await client.get(`/v1/pages/${safeId(remote.pageId)}`);
 if(page.object!=='page'||!sameId(page.id,remote.pageId)||page.in_trash||page.archived||!sameId(page.parent?.data_source_id,owned.dataSourceId))reject('row_parent_mismatch');
 const blocks=await blockChildren(client,remote.pageId);if(blocks.length!==1||blocks[0].type!=='paragraph'||text(blocks[0].paragraph?.rich_text)!==marker(prepared,row.key))reject('row_marker_mismatch');return {page,sourceId};}
export function rowBody(prepared,state,row){const sourceId=rowSource(prepared,row.key),db=prepared.spec.databases.find(d=>d.dataSourceLogicalId===sourceId),title=prepared.spec.fields.find(f=>f.sourceId===sourceId&&f.type==='title');const properties={[state.propertyIds[title.logicalId]]:{title:rich(row.title)}};
 const set=(id,value)=>{if(!state.propertyIds[id])reject('property_binding_missing');properties[state.propertyIds[id]]=value;};
 if(db.key==='programs'){set('ds:programs:operation-type',{select:{name:row.operationType}});set('ds:programs:field:base-progress',{select:{name:row.state}});}
 if(db.key==='applications'){
  set('ds:applications:field:base-selection',{select:{name:row.selection}});
  for(const r of prepared.spec.relations){const key=r.targetId==='ds:people'?row.personKey:row.programKey;if(!state.rows[key]?.pageId)reject('row_relation_binding_missing');set(r.propertyId,{relation:[{id:safeId(state.rows[key].pageId)}]});}
 }
 return {parent:{data_source_id:state.databases[db.logicalId].dataSourceId},properties,children:[{object:'block',type:'paragraph',paragraph:{rich_text:rich(marker(prepared,row.key))}}]};}
