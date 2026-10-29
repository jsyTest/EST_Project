import {COLORS,TYPES,GROUPS,DATABASE_KEYS,baseProperties,option,validateModel,compileSchema} from './mapping/model.mjs';
import {parseForm,mergeSources,formInputError} from './mapping/parse.mjs';
import {readCsvHeader} from './mapping/csv.mjs';
async function initializeMappingPage() {
if (document.documentElement.dataset.authRequired === 'true' && (!(await window.estAuth?.ready) || document.documentElement.dataset.authState !== 'authenticated')) return;
const drafts=window.estDraftsReady?await window.estDraftsReady:null;
if (document.documentElement.dataset.authRequired === 'true' && document.documentElement.dataset.authState !== 'authenticated') return;
const $=id=>document.getElementById(id);
const dbNames={applicants:'신청자 DB',courses:'과정 DB',applications:'과정별 신청기록 DB',enrollments:'수강 DB',attendance:'출석기록 DB'};
const typeNames={title:'제목',rich_text:'텍스트',phone_number:'전화번호',email:'이메일',number:'숫자',date:'날짜',checkbox:'체크박스',select:'단일 선택',multi_select:'복수 선택',status:'진행 상태 (Status)'};
const colorNames={default:'기본',gray:'회색',brown:'갈색',orange:'주황',yellow:'노랑',green:'초록',blue:'파랑',purple:'보라',pink:'분홍',red:'빨강'};
const swatches={default:'#ddd',gray:'#999',brown:'#a77954',orange:'#da8c43',yellow:'#d5b23b',green:'#509a6e',blue:'#4b8ec8',purple:'#946ac7',pink:'#cb77aa',red:'#cd6767'};
let model={version:1,properties:baseProperties()},columns=[],sequence=0,compiled=null,active=true,analysisError='';
if(drafts){
 const restored=drafts.snapshot().configuration.mapping;
 model=restored.model;columns=restored.columns;$('form-text').value=restored.formText;$('encoding').value=restored.encoding;
 $('csv-preview').textContent=columns.length?JSON.stringify(columns,null,2):'선택된 CSV 없음';
 $('raw-preview').textContent=restored.formText||'질문 원문 없음';
 drafts.register('mapping',captureMapping);
}
$('form-text').addEventListener('input',invalidate);
$('encoding').addEventListener('change',invalidate);
$('csv-file').addEventListener('change',invalidate);
function captureMapping(){return {formText:$('form-text').value,encoding:$('encoding').value,columns,model};}
function nextManualId(){let id;do{id=`manual-${sequence++}`;}while(model.properties.some(p=>p.localId===id||p.options.some(o=>o.localId===`option-${id}`)));return id;}
function syncDraft(){if(drafts&&active)try{drafts.update('mapping',captureMapping());}catch(error){drafts.showError(error);}}
window.addEventListener('est-auth-cleared',()=>{active=false;model={version:1,properties:[]};columns=[];compiled=null;},{once:true});
function el(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
function invalidate(){compiled=null;$('download-schema').disabled=true;$('schema-preview').textContent='편집 내용이 바뀌었습니다. 다시 검사해 주세요.';$('validation').replaceChildren();syncDraft();}
function mark(p){p.mappingStatus='review';invalidate();}
function input(value,label,change){const n=el('input');n.type='text';n.value=value??'';n.setAttribute('aria-label',label);n.addEventListener('input',()=>change(n.value));return n;}
function select(values,value,label,change){const n=el('select');n.setAttribute('aria-label',label);for(const [v,name] of values){const o=el('option',name);o.value=v;n.append(o);}n.value=value;n.addEventListener('change',()=>change(n.value));return n;}
function field(label,control){const n=el('label',label);n.append(control);return n;}
function button(text,fn){const b=el('button',text,'small-button');b.type='button';b.addEventListener('click',fn);return b;}
function render(){
 const root=$('mapping-rows');root.replaceChildren();
 for(const p of model.properties){
  const article=el('article',null,`mapping-row${p.included?'':' excluded'}`);article.dataset.localId=p.localId;
  const heading=el('div',null,'row-heading');heading.append(el('h3',p.origin==='base'?'교육 운영 기본 속성':p.origin==='form'?'폼 질문 속성':p.origin==='csv'?'CSV 속성':'직접 추가 속성'));
  const badge=el('span',p.mappingStatus==='automatic'?'자동 매핑':p.mappingStatus==='confirmed'?'확인 완료':'확인 필요',`status-label ${p.mappingStatus==='review'?'review-label':''}`);heading.append(badge);article.append(heading);
  const include=el('input');include.type='checkbox';include.checked=p.included;include.addEventListener('change',()=>{p.included=include.checked;invalidate();render();});const includeLabel=field('사용 ',include);includeLabel.className='inline-label';article.append(includeLabel);
  article.append(el('p',`원본 질문: ${p.questionName||'없음'}${p.questionNumber?` (질문 ${p.questionNumber})`:''} · 필수: ${p.required===true?'예':'확인 안 됨'}`,'source-detail'));
  const grid=el('div',null,'property-grid');
  grid.append(field('CSV 컬럼',select([['','연결 없음'],...columns.map(c=>[String(c.index),`${c.index+1}. ${c.original||'(빈 컬럼)'}`])],p.csvColumn?String(p.csvColumn.index):'',`${p.localId} CSV 컬럼`,value=>{p.csvColumn=value===''?null:{...columns.find(c=>c.index===Number(value))};mark(p);render();})));
  grid.append(field('Notion 속성명',input(p.name,`${p.localId} 속성명`,v=>{p.name=v;mark(p);badge.textContent='확인 필요';badge.classList.add('review-label');})));
  grid.append(field('Notion 속성 유형',select(TYPES.map(t=>[t,typeNames[t]]),p.type,`${p.localId} 유형`,v=>{p.type=v;if(v==='status')for(const o of p.options)o.group??='To-do';mark(p);render();})));
  grid.append(field('저장 대상 DB',select(DATABASE_KEYS.map(k=>[k,dbNames[k]]),p.targetDb,`${p.localId} 대상 DB`,v=>{p.targetDb=v;mark(p);render();})));article.append(grid);
  if(p.rawText){const details=el('details');details.append(el('summary','이 질문 원문'),el('pre',p.rawText));article.append(details);}
  if(p.reviewReasons?.length)article.append(el('p',p.reviewReasons.join(' · '),'review-reasons'));
  if(['select','multi_select','status'].includes(p.type)){
   article.append(el('h4','선택 옵션과 색상'));
   if(p.type==='status')article.append(el('p','Status는 To-do / In progress / Complete 그룹에 배치합니다. 그룹 자체의 이름·순서는 Notion에서 관리합니다.','option-help'));
   for(const o of p.options){const row=el('div',null,`option-editor ${p.type==='status'?'status-options':''}`);row.style.setProperty('--option-color',swatches[o.color]??swatches.default);
    row.append(input(o.name,`${p.localId} ${o.localId} 옵션명`,v=>{o.name=v;mark(p);badge.textContent='확인 필요';badge.classList.add('review-label');}));
    row.append(select(COLORS.map(c=>[c,colorNames[c]]),o.color,`${p.localId} ${o.localId} 색상`,v=>{o.color=v;o.colorSource='user';mark(p);render();}));
    if(p.type==='status')row.append(select(GROUPS.map(g=>[g,g]),o.group??'To-do',`${p.localId} ${o.localId} 그룹`,v=>{o.group=v;mark(p);render();}));
    row.append(button('옵션 제외',()=>{p.options=p.options.filter(x=>x!==o);mark(p);render();}));article.append(row);
   }
   article.append(button('옵션 추가',()=>{p.options.push(option('새 옵션',nextManualId()));if(p.type==='status')p.options.at(-1).group='To-do';mark(p);render();}));
  }
  article.append(button('확인 완료',()=>{p.mappingStatus='confirmed';p.reviewReasons=[];invalidate();render();}));root.append(article);
 }
}
$('sample').addEventListener('click',()=>{$('form-text').value='교육 신청 안내\n신청자 응답은 붙여넣지 마세요.\n\n1. 성명(*)\n단답형\n\n2. 참여자 유형\n단일 선택\n- 재직자\n- 구직자\n\n3. 신청 과정 선택\n복수 선택\n- Basic\n- Associate\n\n4. 본 프로그램을 어떤 경로를 통해 알게 되셨나요?\n객관식\n- 검색\n- 추천\n\n5. 교육에 기대하는 점\n장문형';invalidate();});
$('clear-csv').addEventListener('click',()=>{columns=[];$('csv-file').value='';for(const p of model.properties)if(p.csvColumn){p.csvColumn=null;p.mappingStatus='review';}invalidate();render();$('csv-preview').textContent='선택된 CSV 없음';});
$('analyze').addEventListener('click',async()=>{
 const b=$('analyze');b.disabled=true;
 try{const file=$('csv-file').files[0];const parsed=parseForm($('form-text').value);const formError=formInputError(parsed);if(formError)throw new Error(formError);const nextColumns=file?await readCsvHeader(file,{encoding:$('encoding').value}):columns;if(!active)return;const nextModel=mergeSources(parsed,nextColumns);columns=nextColumns;model=nextModel;analysisError='';invalidate();render();$('csv-preview').textContent=columns.length?JSON.stringify(columns,null,2):'선택된 CSV 없음';$('raw-preview').textContent=parsed.rawText||'질문 원문 없음';$('feedback').textContent=`분석 완료: 폼 질문 ${parsed.properties.length}개 · CSV 컬럼 ${columns.length}개 · 기본 운영 속성 ${model.properties.filter(p=>p.origin==='base').length}개. ${parsed.warnings.join(' ')}`;}
 catch(e){if(active){analysisError=e.message;invalidate();$('feedback').textContent=`분석 실패: ${e.message} 기존 매핑 결과는 보존했습니다. 입력을 수정한 뒤 다시 분석해 주세요.`;}}finally{b.disabled=false;}
});
$('add-field').addEventListener('click',()=>{model.properties.push({localId:nextManualId(),origin:'manual',questionName:'',csvColumn:null,name:'새 속성',type:'rich_text',targetDb:'applicants',options:[],included:true,mappingStatus:'review',reviewReasons:['이름과 유형을 확인하세요.']});invalidate();render();});
$('preview').addEventListener('click',()=>{const result=validateModel(model);let sourceError=analysisError;try{sourceError=formInputError(parseForm($('form-text').value))||sourceError;}catch(e){sourceError=e.message;}if(sourceError){result.ok=false;result.errors.unshift(sourceError);}$('validation').replaceChildren();for(const error of result.errors)$('validation').append(el('p',error,'validation-error'));if(!result.ok){compiled=null;$('download-schema').disabled=true;$('schema-preview').textContent='확인이 필요한 항목과 오류를 수정해 주세요.';return;}compiled=compileSchema(model);$('validation').append(el('p','검사 통과. 실제 Notion DB를 생성하지 않는 스키마 미리보기입니다.'));for(const warning of result.warnings)$('validation').append(el('p',warning));$('schema-preview').textContent=JSON.stringify(compiled,null,2);$('download-schema').disabled=false;});
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download-model').addEventListener('click',()=>download(model,'mapping-model.json'));
$('download-schema').addEventListener('click',()=>{if(compiled)download(compiled,'notion-schema-dry-run.json');});
render();
}
initializeMappingPage();
