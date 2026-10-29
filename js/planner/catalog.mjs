// Planner-only contracts. These definitions never call Notion or import its client.
export const PLAN_VERSION=1;
export const NOTION_VERSION='2026-03-11';
export const TEMPLATE_NAMES={basic:'기본형 · 신청/참가 DB 1개',standard:'일반형 · 사람/프로그램/신청 3DB',extended:'확장형 · 일반형+선택 모듈'};
export const DB_NAMES={applications:'신청·참가 기록',people:'사람',programs:'프로그램·과정',enrollments:'참여·수강',attendance:'출석기록',teams:'팀',projects:'프로젝트·제출물',evaluations:'심사·평가',completions:'수료·성과',surveys:'설문·만족도'};
export const SELECTION_OPTIONS=[['접수','blue'],['검토 중','yellow'],['선정','green'],['대기','purple'],['미선정','gray'],['취소','red']].map(([name,color])=>({name,color}));
const field=(key,name,type,options)=>({key,name,type,...(options?{options:options.map(([name,color])=>({name,color}))}:{})});
const relation=(source,target,name,reverse)=>({source,target,name,reverse});
export const MODULES={
 participation:{name:'참여·수강 관리',dependencies:[],databases:['enrollments'],
  properties:[{db:'enrollments',...field('state','참여 상태','select',[['예정','gray'],['참여 중','blue'],['완료','green'],['취소','red']])}],
  relations:[relation('enrollments','people','사람','참여기록'),relation('enrollments','programs','프로그램','참여기록'),relation('enrollments','applications','신청기록','참여기록')],rollups:[],formulas:[]},
 attendance:{name:'출석 관리',dependencies:['participation'],databases:['attendance'],
  properties:[{db:'attendance',...field('date','출석 일자','date')},{db:'attendance',...field('state','출석 상태','select',[['출석','green'],['결석','red']])}],
  relations:[relation('attendance','enrollments','참여기록','출석기록'),relation('attendance','programs','프로그램','출석기록')],
  rollups:[{db:'enrollments',key:'attendance-count',name:'출석기록 수',relationName:'출석기록',targetDb:'attendance',targetKey:'title',function:'count_all'}],
  formulas:[{db:'attendance',key:'recognized',name:'출석 인정 값',op:'equals_option',propertyKey:'module:attendance:state',value:'출석'}]},
 teams:{name:'팀 관리',dependencies:['participation'],databases:['teams'],
  properties:[{db:'teams',...field('state','팀 상태','select',[['구성 중','yellow'],['활동 중','blue'],['종료','gray']])}],
  relations:[relation('enrollments','teams','팀','참여기록')],rollups:[],
  formulas:[{db:'teams',key:'member-count',name:'팀 참여기록 수',op:'relation_count',relationName:'참여기록'}]},
 projects:{name:'프로젝트·제출물',dependencies:['teams'],databases:['projects'],
  properties:[{db:'projects',...field('deadline','제출 기한','date')},{db:'projects',...field('state','제출 상태','select',[['준비 중','gray'],['제출','green'],['미제출','red']])}],
  relations:[relation('projects','teams','팀','제출물')],rollups:[],formulas:[]},
 judging:{name:'심사·평가',dependencies:['projects'],databases:['evaluations'],
  properties:[{db:'evaluations',...field('score','점수','number')},{db:'evaluations',...field('state','심사 상태','select',[['대기','purple'],['평가 중','blue'],['완료','green']])}],
  relations:[relation('evaluations','projects','제출물','심사기록')],
  rollups:[{db:'projects',key:'average-score',name:'평균 심사 점수',relationName:'심사기록',targetDb:'evaluations',targetKey:'module:judging:score',function:'average'}],formulas:[]},
 completion:{name:'수료·성과',dependencies:['participation'],databases:['completions'],
  properties:[{db:'completions',...field('state','수료 상태','select',[['수료','green'],['미수료','red'],['수료 대기','yellow']])}],
  relations:[relation('completions','enrollments','참여기록','수료기록')],rollups:[],
  formulas:[{db:'completions',key:'completed',name:'수료 값',op:'equals_option',propertyKey:'module:completion:state',value:'수료'}]},
 survey:{name:'설문·만족도',dependencies:['participation'],databases:['surveys'],
  properties:[{db:'surveys',...field('satisfaction','만족도','number')}],
  relations:[relation('surveys','enrollments','참여기록','설문기록')],rollups:[],formulas:[]}
};
// Required keys and dependency/conflict rules are part of each machine-readable contract.
for(const [id,module] of Object.entries(MODULES)){
 module.id=id;module.requiredProperties=module.databases.map(db=>({db,key:'title',type:'title'})).concat(module.properties);
 module.conflictConditions=[{code:'EXTENDED_REQUIRED',field:'templateType',equals:'extended'},{code:'PROPERTY_COLLISION',uniqueBy:['dataSourceId','normalizedPropertyName']},{code:'MODULE_DEPENDENCY',requiresAll:module.dependencies}];
 module.requiredDatabases=[...new Set(['people','programs','applications',...module.databases])];
 module.defaultStates=module.properties.filter(p=>p.options).map(p=>({db:p.db,key:p.key,options:p.options}));
}
export const CAPABILITIES={
 automatic:['parent_page','database_and_initial_data_source','title','rich_text','email','phone_number','number','date','checkbox','select','multi_select'],
 api_verification_required:['relation','rollup','formula','status'],
 manual_ui:['status_group_definition_rename_reorder_color'],
 unsupported:['arbitrary_formula_expression','unknown_module','response_row_import','identity_deduplication','dashboard','remote_execution']
};
