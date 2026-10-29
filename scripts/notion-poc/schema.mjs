import { normalizeId } from './config.mjs';
import { RECOMMENDED } from '../../js/mapping/model.mjs';

const text = () => ({ rich_text: {} });
const select = names => ({ select: { options: names.map(name => ({ name, color: RECOMMENDED[name] ?? 'default' })) } });
const formula = expression => ({ formula: { expression } });
const rollup = (relation, property) => ({ rollup: { relation_property_name: relation, rollup_property_name: property, function: 'sum' } });

export const DATABASES = {
  applicants: { name: '신청자 DB', properties: { '가상 이름': { title: {} }, '신청자 ID': text(), '참여자 유형': select(['재직자', '구직자']), '유입 경로': select(['검색', '추천']) } },
  courses: { name: '과정 DB', properties: { '과정명': { title: {} }, '과정 ID': text() } },
  applications: { name: '과정별 신청기록 DB', properties: { '신청기록 ID': { title: {} }, '선정 상태': select(['선정', '미선정', '취소']) } },
  enrollments: { name: '수강 DB', properties: { '수강기록 ID': { title: {} }, '수료': { checkbox: {} } } },
  attendance: { name: '출석기록 DB', properties: { '출석기록 ID': { title: {} }, '교육일': { date: {} }, '출석 상태': select(['출석', '결석']) } },
  metrics: { name: '교육 KPI DB', properties: { '이름': { title: {} } } }
};

// Reverse property IDs are read from Notion's dual_property response and renamed.
// Do not guess the name automatically assigned by Notion.
export const RELATIONS = [
  { source: 'applications', name: '신청자', target: 'applicants', reverse: '신청기록' },
  { source: 'applications', name: '과정', target: 'courses', reverse: '신청기록' },
  { source: 'enrollments', name: '신청기록', target: 'applications', reverse: '수강' },
  { source: 'enrollments', name: '신청자', target: 'applicants', reverse: '수강' },
  { source: 'enrollments', name: '과정', target: 'courses', reverse: '수강' },
  { source: 'attendance', name: '수강', target: 'enrollments', reverse: '출석기록' },
  { source: 'metrics', name: '신청자', target: 'applicants' },
  { source: 'metrics', name: '신청기록', target: 'applications' },
  { source: 'metrics', name: '수강', target: 'enrollments' },
  { source: 'metrics', name: '출석기록', target: 'attendance' }
];

// These batches are topologically ordered. Relations exist before calculations.
export const CALCULATIONS = [
  { database: 'attendance', properties: {
    '출석 인정 여부': formula('prop("출석 상태") == "출석"'),
    '출석 인정 값': formula('if(prop("출석 상태") == "출석", 1, 0)')
  } },
  { database: 'applications', properties: {
    '선정 값': formula('if(prop("선정 상태") == "선정", 1, 0)')
  } },
  { database: 'enrollments', properties: {
    '출석 건수': rollup('출석기록', '출석 인정 값'),
    '예정 건수': formula('prop("출석기록").length()'),
    '수료 값': formula('if(prop("수료"), 1, 0)')
  } },
  { database: 'enrollments', properties: {
    '출석률': formula('if(prop("예정 건수") == 0, 0, prop("출석 건수") / prop("예정 건수") * 100)')
  } },
  { database: 'applicants', properties: {
    '선정 신청 건수': rollup('신청기록', '선정 값'),
    '수료 수강 건수': rollup('수강', '수료 값')
  } },
  { database: 'applicants', properties: {
    '선정 인원 값': formula('if(prop("선정 신청 건수") > 0, 1, 0)'),
    '수료 인원 값': formula('if(prop("수료 수강 건수") > 0, 1, 0)')
  } },
  { database: 'courses', properties: {
    '수강인원': formula('prop("수강").length()'),
    '수료건수': rollup('수강', '수료 값')
  } },
  { database: 'metrics', properties: {
    '신청자 수': formula('prop("신청자").length()'),
    '신청기록 수': formula('prop("신청기록").length()'),
    '선정 고유 인원': rollup('신청자', '선정 인원 값'),
    '수강기록 수': formula('prop("수강").length()'),
    '수료기록 수': rollup('수강', '수료 값'),
    '수료인원': rollup('신청자', '수료 인원 값'),
    '출석 건수': rollup('출석기록', '출석 인정 값'),
    '예정 건수': formula('prop("출석기록").length()')
  } },
  { database: 'metrics', properties: {
    '수료율': formula('if(prop("수강기록 수") == 0, 0, prop("수료기록 수") / prop("수강기록 수") * 100)'),
    '출석률': formula('if(prop("예정 건수") == 0, 0, prop("출석 건수") / prop("예정 건수") * 100)')
  } }
];

export const METRIC_PROPERTIES = {
  applicants: '신청자 수', applications: '신청기록 수', selectedPeople: '선정 고유 인원',
  enrollments: '수강기록 수', completions: '수료기록 수', completedPeople: '수료인원',
  completionRate: '수료율', attendanceCount: '출석 건수', attendanceTotal: '예정 건수', attendanceRate: '출석률'
};

export function validateViewProfile(profile) {
  if (!['full', 'free'].includes(profile)) throw new Error('view-profile은 full 또는 free여야 합니다.');
  return profile;
}

export function viewCounts(profile = 'full') {
  validateViewProfile(profile);
  return profile === 'free'
    ? { numberKpis: 0, recruitmentCharts: 1, courseChart: 0, tables: 3, dashboard: 0 }
    : { numberKpis: 4, recruitmentCharts: 2, courseChart: 1, tables: 3, dashboard: 1 };
}

export function selectViewSpecs(specs, profile = 'full') {
  validateViewProfile(profile);
  return profile === 'free' ? specs.filter(spec => spec.type === 'table' || spec.key === 'type-chart') : specs;
}

export function relationPayload(relation, databases) {
  const dataSourceId = normalizeId(databases[relation.target]?.dataSourceId, '관계 대상 data_source_id');
  return { relation: { data_source_id: dataSourceId,
    ...(relation.reverse ? { type: 'dual_property', dual_property: {} } : { type: 'single_property', single_property: {} }) } };
}

export function validatePlan() {
  const schemas = structuredClone(Object.fromEntries(Object.entries(DATABASES).map(([key, value]) => [key, value.properties])));
  for (const relation of RELATIONS) {
    if (!schemas[relation.source] || !schemas[relation.target]) throw new Error('정의되지 않은 관계 대상');
    if (schemas[relation.source][relation.name]) throw new Error('중복 관계 속성');
    schemas[relation.source][relation.name] = { relation: { target: relation.target } };
    if (relation.reverse) {
      if (schemas[relation.target][relation.reverse]) throw new Error('중복 역방향 속성');
      schemas[relation.target][relation.reverse] = { relation: { target: relation.source } };
    }
  }
  for (const batch of CALCULATIONS) {
    const schema = schemas[batch.database];
    for (const [name, definition] of Object.entries(batch.properties)) {
      if (schema[name]) throw new Error(`중복 계산 속성: ${name}`);
      if (definition.formula) {
        // current.prop(...) resolves in a related data source, not in this one.
        for (const match of definition.formula.expression.matchAll(/(?<!\.)\bprop\("([^"]+)"\)/g)) {
          if (!schema[match[1]]) throw new Error(`수식 참조 속성 없음: ${name} -> ${match[1]}`);
        }
        const root = definition.formula.expression.match(/(?<!\.)\bprop\("([^"]+)"\)/)?.[1];
        const related = schema[root]?.relation?.target;
        for (const match of definition.formula.expression.matchAll(/current\.prop\("([^"]+)"\)/g)) {
          if (!related || !schemas[related][match[1]]) throw new Error(`관계 수식 참조 오류: ${name} -> ${match[1]}`);
        }
      }
      if (definition.rollup) {
        const r = definition.rollup;
        const target = schema[r.relation_property_name]?.relation?.target;
        if (!target || !schemas[target][r.rollup_property_name]) throw new Error(`롤업 참조 오류: ${name}`);
      }
      schema[name] = definition;
    }
  }
  return schemas;
}

export function buildViewSpecs(databases, schemas) {
  const id = (db, name) => {
    const value = schemas[db]?.properties?.[name]?.id;
    if (!value) throw new Error(`보기 속성 ID 없음: ${db}.${name}`);
    return value;
  };
  const number = (name, property) => ({ key: `kpi-${property}`, database: 'metrics', name,
    type: 'chart', configuration: { type: 'chart', chart_type: 'number', value: { aggregator: 'sum', property_id: id('metrics', property) } } });
  const grouped = (key, database, name, property, chartType) => ({ key, database, name, type: 'chart', configuration: {
    type: 'chart', chart_type: chartType, x_axis: { type: 'select', property_id: id(database, property), sort: { type: 'manual' } }, y_axis: { aggregator: 'count' }
  } });
  return [
    number('신청자 수', '신청자 수'), number('수강기록 수', '수강기록 수'), number('수료인원 (고유)', '수료인원'), number('출석률 (%)', '출석률'),
    grouped('type-chart', 'applicants', '신청자 참여자 유형', '참여자 유형', 'donut'),
    grouped('channel-chart', 'applicants', '신청자 유입 경로', '유입 경로', 'column'),
    { key: 'course-chart', database: 'courses', name: '과정별 수강 현황', type: 'chart', configuration: {
      type: 'chart', chart_type: 'column', x_axis_property_id: id('courses', '과정명'), y_axis_property_id: id('courses', '수강인원')
    } },
    { key: 'applicants-table', database: 'applicants', name: '신청자 관리', type: 'table' },
    { key: 'applications-table', database: 'applications', name: '과정별 신청기록', type: 'table' },
    { key: 'enrollments-table', database: 'enrollments', name: '수강 관리', type: 'table' },
  ].map(spec => ({ ...spec, data_source_id: normalizeId(databases[spec.database].dataSourceId) }));
}
