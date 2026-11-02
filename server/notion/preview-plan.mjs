import {normalizeConfiguration} from '../../js/drafts/model.mjs';
import {createGenerationPlan, validateGenerationPlan} from '../../js/planner/plan.mjs';
import {MODULES} from '../../js/planner/catalog.mjs';
import {digest} from '../../scripts/basic-notion/plan.mjs';
import {reviewSavedDraft} from '../review-plan.mjs';
import {reject} from '../review-errors.mjs';

export const EXECUTION_PLAN_VERSION = 1;
export const ADAPTER_VERSION = 'notion-preview-v1';
export const MAX_PREVIEW_BYTES = 262144;
export const MAX_PROPERTIES = 100;
export const PREVIEW_FLAGS = Object.freeze({webExecutionReady: false, notionExecution: 'not_executed', notionRequests: 0, supabaseWrites: 0, targetVerified: false});
const issue = (code, message, extra = {}) => ({code, message, ...extra});
const pick = (value, keys) => Object.fromEntries(keys.filter(k => value[k] !== undefined).map(k => [k, value[k]]));

// Pure projection: no API client, target binding, credentials, rows or request templates.
export function compilePreview(row) {
  const review = reviewSavedDraft(row);
  if (!review.planValidation.valid) reject(422, 'invalid_saved_plan');
  const configuration = normalizeConfiguration(row.configuration, row.schema_version);
  const plan = createGenerationPlan(configuration, configuration.planner);
  const validation = validateGenerationPlan(plan);
  if (!validation.ok) reject(422, 'invalid_saved_plan');
  if (plan.properties.length > MAX_PROPERTIES || [...plan.selectOptions, ...plan.statusOptions].some(c => c.options.length > 100)) reject(422, 'preview_limit_exceeded');
  const optionMap = new Map([...plan.selectOptions, ...plan.statusOptions].map(c => [c.propertyId, c.options]));
  const preview = {
    page: {logicalId: 'page:root', name: configuration.requirements.educationName || '새 교육 설계'},
    databases: plan.databases.map(d => pick(d, ['id', 'key', 'name', 'dataSourceId'])),
    dataSources: plan.dataSources.map(d => pick(d, ['id', 'databaseId'])),
    properties: plan.properties.map(p => ({...pick(p, ['id', 'dataSourceId', 'name', 'type']),
      ...(optionMap.has(p.id) ? {options: optionMap.get(p.id).map(o => pick(o, ['name', 'color', 'group']))} : {})})),
    relations: plan.relations.map(r => pick(r, ['id', 'sourceDataSourceId', 'targetDataSourceId', 'propertyId', 'reversePropertyId', 'type'])),
    rollups: plan.rollups.map(r => pick(r, ['propertyId', 'relationPropertyId', 'targetPropertyId', 'function'])),
    formulas: plan.formulas.map(f => ({propertyId: f.propertyId, ast: pick(f.ast, ['op', 'propertyId', 'value']), expression: f.expression})),
    // One DAG-ordered calculation stage also handles Formula -> Rollup dependencies.
    steps: [
      {id: 'parent', logicalIds: ['page:root'], dependsOn: []},
      {id: 'databases', logicalIds: plan.databases.flatMap(d => [d.id, d.dataSourceId]), dependsOn: ['parent']},
      {id: 'properties', logicalIds: plan.properties.filter(p => !['relation', 'rollup', 'formula'].includes(p.type)).map(p => p.id), dependsOn: ['databases']},
      {id: 'relations', logicalIds: plan.relations.map(r => r.id), dependsOn: ['properties']},
      {id: 'calculations', logicalIds: validation.calculationOrder, dependsOn: ['relations']},
      {id: 'verify', logicalIds: plan.dataSources.map(d => d.id), dependsOn: ['calculations']}
    ],
    counts: review.counts, rowsIncluded: false, remoteIdsResolved: false
  };
  const coverage = {
    logicalDesign: 'represented', cli: review.cliSupport, webExecution: 'not_implemented',
    modules: plan.enabledModules.map(id => ({id, name: MODULES[id].name, logicalDesign: 'represented', cliVerified: false, webExecution: 'not_implemented'})),
    educationOperations: {requestedBasicItems: configuration.requirements.basicItems, students: 'not_implemented', attendance: plan.enabledModules.includes('attendance') ? 'logical_only' : 'not_in_plan', schedule: 'not_implemented'},
    metrics: {applicationCounts: plan.templateType === 'basic' ? 'not_in_plan' : 'logical_only', selectedStudentKpis: 'not_implemented', userDefinedKpis: 'not_implemented'},
    v1OnlyFeatures: [...configuration.requirements.additionalItems],
    distinction: '일반형은 사람·프로그램·신청 3DB입니다. 선정 교육생·출석·일정 3DB가 아닙니다. 모집 통계는 선정 교육생 KPI가 아닙니다.'
  };
  const blockers = [issue('web_execution_not_implemented', '웹 실행기는 아직 연결되지 않았습니다.', {scope: 'web_execution'}),
    issue('education_operations_not_implemented', '선정 교육생·일정 DB와 교육생 KPI는 현재 생성 계획의 지원 범위 밖입니다.', {scope: 'education_operations'}),
    issue('custom_kpi_not_implemented', '사용자 정의 KPI 편집·변환은 아직 지원하지 않습니다.', {scope: 'education_operations'})];
  for (const p of review.cliSupport.unsupportedProperties) blockers.push(issue('cli_property_not_supported', '현재 CLI에서 지원하지 않는 속성 유형입니다.', {scope: 'cli', ...p}));
  for (const module of coverage.modules) blockers.push(issue('module_web_execution_not_supported', `${module.name}: 논리 계획만 제공하며 웹 실행은 지원하지 않습니다.`, {scope: 'web_execution', moduleId: module.id}));
  for (const id of coverage.v1OnlyFeatures) blockers.push(issue('v1_feature_not_compiled', 'V1 미리보기 항목은 Notion DB로 변환되지 않습니다.', {scope: 'education_operations', featureId: id}));
  if (plan.templateType === 'standard') blockers.push(issue('standard_cli_fixture_only', '일반형 CLI는 고정된 가상 7행 검증용입니다. 저장본의 웹 실행 가능 판정이 아닙니다.', {scope: 'cli'}));
  // Do not reflect free-form question text or user-authored review reasons.
  const confirmationItems = plan.confirmationItems.map(c => issue(c.code,
    c.code === 'MAPPING_REVIEW' ? '해당 속성의 매핑·유형·옵션을 확인해 주세요.' :
      c.code === 'IDENTITY_POLICY_PENDING' ? '사람 식별·중복 제거와 행별 관계 연결 기준 확인이 필요합니다.' : '관계·집계의 의미를 확인해 주세요.',
    c.ref ? {ref: c.ref} : {}));
  const binding = {executionPlanVersion: EXECUTION_PLAN_VERSION, adapterVersion: ADAPTER_VERSION, notionApiVersion: plan.notionApiVersion,
    draftId: row.id, updatedAt: row.updated_at, planHash: review.planHash, pageName: preview.page.name, preview, coverage, blockers, confirmationItems};
  const result = {reviewVersion: 1, ...binding, compilationHash: digest(binding), templateType: plan.templateType,
    reviewStatus: plan.templateType === 'extended' || review.cliSupport.unsupportedProperties.length ? 'unsupported_features' : confirmationItems.length ? 'confirmation_required' : 'reviewed', ...PREVIEW_FLAGS};
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_PREVIEW_BYTES) reject(422, 'preview_limit_exceeded');
  return result;
}
