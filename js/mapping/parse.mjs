import {normalizeName,nameKey,option,baseProperties} from './model.mjs';
const RULES=[
 ['성명',['성명','이름','성함'], 'title','applicants'],
 ['연락처',['연락처','전화번호','휴대전화','휴대폰 번호'],'phone_number','applicants'],
 ['이메일',['이메일','이메일 주소','전자우편'],'email','applicants'],
 ['연령대',['연령대','나이대'],'select','applicants'],
 ['참여자 유형',['참여자 유형','참여 유형'],'select','applicants'],
 ['신청 과정',['신청 과정','신청 과정 선택','참여 희망 과정'],'select','applications'],
 ['신청 동기',['신청 동기','지원 동기'],'select','applications'],
 ['교육 기대사항',['교육에 기대하는 점','교육 기대사항'],'rich_text','applications'],
 ['유입 경로',['유입 경로','본 프로그램을 어떤 경로를 통해 알게 되셨나요?','본 프로그램을 어떤 경로를 통해 알게 되셨나요'],'select','applicants'],
 ['선정 상태',['선정 상태'],'select','applications']
];
export function recommend(name) {
 const rule=RULES.find(r=>r[1].some(a=>nameKey(a)===nameKey(name)));
 return rule?{name:rule[0],type:rule[2],targetDb:rule[3],rule:rule[0]}:{name:normalizeName(name),type:'rich_text',targetDb:'applicants',rule:null};
}
export function parseForm(text) {
 if(text.length>100000)throw new Error('질문 텍스트는 100,000자 이내로 입력하세요.');
 const lines=text.replace(/\r\n?/g,'\n').split('\n'); const questions=[]; const unparsed=[]; let current;
 for(let i=0;i<lines.length;i++) {
  const line=lines[i].trim(); if(!line)continue;
  const match=line.match(/^(?:Q\s*|질문\s*)?(\d+)\s*([.)])\s*(.*)$/i)??line.match(/^Q\s*(\d+)\s*(:)\s*(.+)$/i);
  const numberedOption=match?.[2]===')'&&current&&/객관식|선택|체크박스/.test(current.body.join(' '));
  if(match&&!numberedOption) {
   let label=match[3]; if(!label&&i+1<lines.length)label=lines[++i].trim();
   current={number:match[1],label,raw:[line,...(match[3]?[]:[label])],body:[]}; questions.push(current);
  } else if(current) {current.body.push(line);current.raw.push(line);} else unparsed.push(line);
 }
 const properties=questions.map((q,index)=> {
  const rec=recommend(q.label); const all=q.raw.join('\n');
  const multiple=/복수\s*선택|여러\s*개|다중\s*선택|체크박스/.test(all);
  const single=/단일\s*선택|하나만|한\s*개만|객관식\s*\(단일\)/.test(all);
  const choice=multiple||single||/객관식|선택형|드롭다운/.test(all)||['select','multi_select'].includes(rec.type);
  const options=[]; const unknown=[];
  for(const line of q.body) {
   if(/^(?:\[?필수\]?|선택|단답형|장문형|주관식|객관식(?:\s*\(.*\))?|복수\s*선택|단일\s*선택|체크박스|드롭다운|답변을 입력해?\s*주세요[.!]?)$/.test(line))continue;
   const bullet=line.match(/^(?:[-•●○□☐✓✔]|\d+\))\s*(.+)$/);
   if(bullet) options.push(bullet[1].trim());
   else if(choice&&!/[.!?。]$/.test(line)&&line.length<80&&!/안내|동의|문의|기간|필수|선택/.test(line))options.push(line);
   else unknown.push(line);
  }
  const reasons=[];
  if(!rec.rule)reasons.push('등록되지 않은 질문명');
  if(choice&&!multiple&&!single)reasons.push('단일/복수 선택 여부 확인');
  if(choice&&!options.length)reasons.push('선택지 확인 필요');
  if(unknown.length)reasons.push('해석하지 못한 본문 확인');
  if(new Set(options.map(nameKey)).size!==options.length)reasons.push('중복 선택지');
  const type=choice?(multiple?'multi_select':'select'):rec.type;
  return {localId:`form-${index}`,origin:'form',questionNumber:q.number,questionName:q.label,rawText:all,csvColumn:null,name:rec.name,type,targetDb:rec.targetDb,required:/\*|\[필수\]|\(필수\)/.test(q.label)||q.body.some(line=>/^(?:필수|\[필수\])$/.test(line))?true:null,cardinality:multiple?'multiple':single?'single':choice?'unknown':null,options:options.map((n,i)=>option(n,i)),included:true,mappingStatus:reasons.length?'review':'automatic',reviewReasons:reasons};
 });
 const numbers=questions.map(q=>q.number);
 if(new Set(numbers).size!==numbers.length)properties.forEach(p=>{p.mappingStatus='review';p.reviewReasons.push('질문 번호 중복 확인');});
 return {properties,rawText:text,unparsed,warnings:[...(unparsed.length?['질문 앞 안내문은 속성으로 만들지 않았습니다. 원문을 확인하세요.']:[]),...(!questions.length?['번호가 있는 질문을 찾지 못했습니다. 원문을 유지하고 속성을 직접 추가하세요.']:[])]};
}
export function mergeSources(form,columns) {
 const properties=structuredClone(form.properties??[]);const used=new Set();
 const columnKeys=columns.map(c=>nameKey(c.original));
 for(const p of properties) {
  const exact=columns.filter(c=>nameKey(c.original)===nameKey(p.questionName));
  const alias=columns.filter(c=>recommend(c.original).rule&&recommend(c.original).rule===recommend(p.questionName).rule);
  const candidates=exact.length?exact:alias;
  const competitors=properties.filter(other=> other!==p&&candidates.some(c=>nameKey(other.questionName)===nameKey(c.original)||(recommend(c.original).rule&&recommend(other.questionName).rule===recommend(c.original).rule)));
  if(candidates.length===1&&!competitors.length&&columnKeys.filter(k=>k===nameKey(candidates[0].original)).length===1) {
   const c=candidates[0];p.csvColumn={...c};used.add(c.index);
   if(c.issues?.length){p.mappingStatus='review';p.reviewReasons.push(...c.issues);}
  } else if(candidates.length) {p.mappingStatus='review';p.reviewReasons.push('CSV 후보가 중복되거나 모호함: 직접 연결 필요');}
 }
 for(const c of columns.filter(c=>!used.has(c.index))) {
  const rec=recommend(c.original);
  properties.push({localId:`csv-${c.index}`,origin:'csv',questionName:'',csvColumn:{...c},name:rec.name||`빈 컬럼 ${c.index+1}`,type:rec.type,targetDb:rec.targetDb,required:null,options:[],included:true,mappingStatus:'review',reviewReasons:[...(c.issues??[]),'CSV 헤더만으로 입력 유형·선택지를 확정할 수 없음']});
 }
 // Operational defaults remain separate; a form's same-named field must be reviewed, never silently absorbed.
 const all=[...baseProperties(),...properties];
 for(const p of all) if(all.some(o=>o!==p&&o.targetDb===p.targetDb&&nameKey(o.name)===nameKey(p.name))) {p.mappingStatus='review';p.reviewReasons.push('같은 DB의 속성명 충돌: 이름 수정 또는 제외 필요');}
 return {version:1,source:{formRaw:form.rawText??'',unparsed:form.unparsed??[],warnings:form.warnings??[]},properties:all};
}
