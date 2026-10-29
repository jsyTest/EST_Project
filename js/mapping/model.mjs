export const COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
export const TYPES = ['title', 'rich_text', 'phone_number', 'email', 'number', 'date', 'checkbox', 'select', 'multi_select', 'status'];
export const DATABASE_KEYS = ['applicants', 'courses', 'applications', 'enrollments', 'attendance'];
export const GROUPS = ['To-do', 'In progress', 'Complete'];
export const RECOMMENDED = { '접수':'blue', '선정':'green', '대기':'yellow', '미선정':'gray', '취소':'red', '수료':'green', '미수료':'red', '수료 대기':'yellow', '예정':'gray', '진행 중':'blue', '완료':'green', '출석':'green', '결석':'red' };
export const normalizeName = value => String(value ?? '').normalize('NFKC').replace(/(?:\(\s*\*\s*\)|\[필수\]|\(필수\)|\*|필수\s*$)/g, '').replace(/\s+/g,' ').trim();
export const nameKey = value => normalizeName(value).toLocaleLowerCase('ko').replace(/\s/g,'');
const optionKey = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
export const option = (name, index, color) => ({ localId:`option-${index}`, name:name.trim(), color:color ?? RECOMMENDED[name.trim()] ?? 'default' });
export function baseProperties() {
 return [
  {localId:'base-selection', name:'선정 상태', type:'select', targetDb:'applications', names:['접수','선정','대기','미선정','취소']},
  {localId:'base-completion', name:'수료 상태', type:'select', targetDb:'enrollments', names:['수료','미수료','수료 대기']},
  {localId:'base-progress', name:'교육 진행 상태', type:'status', targetDb:'courses', names:['예정','진행 중','완료','취소']}
 ].map(p=> { const {names,...rest}=p; return {...rest,origin:'base',questionName:'',csvColumn:null,required:null,options:names.map((n,i)=>({...option(n,i),...(p.type==='status'?{group:n==='진행 중'?'In progress':['완료','취소'].includes(n)?'Complete':'To-do'}:{})})),included:true,mappingStatus:'automatic',reviewReasons:[]}; });
}
export function validateModel(model) {
 const errors=[]; const warning=[]; const ids=new Set(); const names=new Set(); const titles=new Set(); const columns=new Set();
 if (model?.version!==1 || !Array.isArray(model.properties)) return {ok:false,errors:['지원하지 않는 속성 모델입니다.'],warnings:[]};
 if(!model.properties.some(p=>p?.included&&p.origin!=='base'))errors.push('분석한 질문·CSV 속성 또는 직접 추가한 속성이 없습니다. 기본 운영 속성만으로는 미리보기를 만들 수 없습니다.');
 for(const p of model.properties) {
  if(!p || typeof p.localId!=='string' || ids.has(p.localId)) {errors.push('속성 식별자가 없거나 중복됩니다.');continue;} ids.add(p.localId);
  if(!p.included)continue;
  const label=p.name || p.localId; const key=`${p.targetDb}:${optionKey(p.name)}`;
  if(!DATABASE_KEYS.includes(p.targetDb))errors.push(`${label}: 저장 대상 DB 오류`);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>100)errors.push(`${label}: 속성명은 1~100자여야 합니다.`);
  if(names.has(key))errors.push(`${label}: 같은 DB의 속성명 충돌`); names.add(key);
  if(!TYPES.includes(p.type))errors.push(`${label}: 지원하지 않는 속성 유형`);
  if(p.type==='title') {if(titles.has(p.targetDb))errors.push(`${label}: DB마다 제목 속성은 하나여야 합니다.`);titles.add(p.targetDb);}
  if(p.mappingStatus!=='automatic'&&p.mappingStatus!=='confirmed')errors.push(`${label}: 사용자 확인 필요`);
  if(p.csvColumn!=null) {if(!Number.isInteger(p.csvColumn.index)||p.csvColumn.index<0||typeof p.csvColumn.original!=='string')errors.push(`${label}: CSV 원본 정보 오류`); if(columns.has(p.csvColumn.index))errors.push(`${label}: CSV 컬럼 중복 연결`);columns.add(p.csvColumn.index);}
  if(['select','multi_select','status'].includes(p.type)) {
   if(!Array.isArray(p.options)||!p.options.length){errors.push(`${label}: 선택 옵션이 필요합니다.`);continue;}
   const opts=new Set(), optIds=new Set();
   for(const o of p.options) {
    if(typeof o.name!=='string'||!o.name.trim()||o.name.includes(',')||o.name.length>100)errors.push(`${label}: 옵션명은 쉼표 없는 1~100자여야 합니다.`);
    if(opts.has(optionKey(o.name)))errors.push(`${label}: 중복 옵션명`);opts.add(optionKey(o.name));
    if(!o.localId||optIds.has(o.localId))errors.push(`${label}: 옵션 내부 ID 중복/누락`);optIds.add(o.localId);
    if(!COLORS.includes(o.color))errors.push(`${label}: 허용되지 않은 옵션 색상`);
    if(p.type==='status'&&!GROUPS.includes(o.group))errors.push(`${label}: Status 그룹 확인 필요`);
   }
  }
  if(p.required===true)warning.push(`${label}: 폼의 필수 정보는 메타데이터이며 Notion의 입력 필수 제약으로 강제하지 않습니다.`);
 }
 return {ok:!errors.length,errors,warnings:warning};
}
export function compileSchema(model) {
 const validation=validateModel(model); if(!validation.ok)throw new Error(validation.errors.join('\n'));
 const databases={};
 for(const p of model.properties.filter(p=>p.included)) {
  const db=databases[p.targetDb]??={properties:Object.create(null)};
  const config=['select','multi_select','status'].includes(p.type)?{options:p.options.map(o=>({name:o.name.trim(),color:o.color,...(p.type==='status'?{group:o.group}:{})}))}:{};
  db.properties[p.name.trim()]={[p.type]:config};
 }
 for(const db of Object.values(databases)) if(!Object.values(db.properties).some(p=>p.title)) {
  let name='이름'; while(Object.hasOwn(db.properties,name))name=`_${name}`;
  db.properties[name]={title:{}};
 }
 return {version:1,mode:'new-data-sources-only',networkRequests:0,databases,warnings:validation.warnings,sourceModel:model};
}
// Existing options must ALL be included in a Notion update. Internal IDs never go into API payloads.
export function mergeExistingOptions(type, existing, desired) {
 if(!['select','multi_select','status'].includes(type)||!Array.isArray(existing?.options)||existing.options.some(o=>!o.id||!o.name))throw new Error('ID가 있는 기존 선택 스키마가 필요합니다.');
 const result=existing.options.map(o=>({id:o.id,name:o.name,color:o.color}));
 const updates=new Set();
 for(const update of desired) {
  if(update.color!=null&&!COLORS.includes(update.color))throw new Error('허용되지 않은 옵션 색상');
  if(typeof update.name!=='string'||!update.name.trim()||update.name.includes(','))throw new Error('옵션 이름 오류');
  const updateKey=optionKey(update.name);
  if(updates.has(updateKey))throw new Error('중복 옵션 변경 요청');updates.add(updateKey);
  if(type==='status'&&update.group!=null&&!GROUPS.includes(update.group))throw new Error('Status 그룹 오류');
  const byId=update.notionId?result.find(o=>o.id===update.notionId):null;
  if(update.notionId&&!byId)throw new Error('알 수 없는 Notion 옵션 ID');
  if(byId&&optionKey(byId.name)!==optionKey(update.name))throw new Error('기존 옵션 이름 변경은 Notion 화면에서 처리하세요.');
  const found=byId??result.find(o=>optionKey(o.name)===optionKey(update.name));
  if(found) {if(update.colorSource==='user'&&update.color!=null)found.color=update.color;if(type==='status'&&update.group!=null)found.group=update.group;}
  else result.push({name:update.name.trim(),color:update.color??RECOMMENDED[update.name.trim()]??'default',...(type==='status'?{group:update.group??'To-do'}:{})});
 }
 const keys=result.map(o=>optionKey(o.name)); if(new Set(keys).size!==keys.length)throw new Error('중복 옵션명');
 return { [type]:{options:result.map(({id,name,color,group})=>({...(id?{id}:{name}),...(color?{color}:{}),...(group?{group}:{})}))} };
}
export function verifyOptionSchema(expected, actual) {
 for(const [name,definition] of Object.entries(expected)) {
  const type=Object.keys(definition)[0]; if(!['select','multi_select','status'].includes(type))continue;
  const remote=actual[name]?.[type]; if(!remote)throw new Error(`${name}: 선택 스키마 누락`);
  for(const o of definition[type].options) {
   const match=remote.options?.find(a=>a.name===o.name);
   if(!match||match.color!==o.color)throw new Error(`${name}.${o.name}: 옵션 색상 불일치`);
   if(type==='status'&&o.group&&!remote.groups?.some(g=>g.name===o.group&&g.option_ids.includes(match.id)))throw new Error(`${name}.${o.name}: 그룹 불일치`);
  }
 }
 return true;
}
