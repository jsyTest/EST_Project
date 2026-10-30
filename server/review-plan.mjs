import {normalizeConfiguration} from '../js/drafts/model.mjs';
import {createGenerationPlan, validateGenerationPlan} from '../js/planner/plan.mjs';
import {digest, freezeBasicPlan, SUPPORTED_TYPES} from '../scripts/basic-notion/plan.mjs';
import {BASIC_TYPES, ROLLUP_FUNCTIONS} from '../scripts/standard-notion/plan.mjs';

export const REVIEW_VERSION = 1;
export const EXECUTION_FLAGS = Object.freeze({webExecutionReady: false, notionExecution: 'not_executed', notionRequests: 0, supabaseWrites: 0});
const issue = (code, message, extra = {}) => ({code, message, ...extra});

// Compare timestamps without truncating PostgreSQL microseconds to JS milliseconds.
export function timestamp(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const seconds = Date.parse(match[1] + match[3]) / 1000;
  return Number.isSafeInteger(seconds) ? BigInt(seconds) * 1000000n + BigInt((match[2] ?? '').padEnd(6, '0')) : null;
}

function assessCLI(plan) {
  const basic = {kind: 'basic_empty_database', schemaSupported: false, checkedBy: 'freezeBasicPlan', reasons: [], prerequisites: ['개인 테스트 대상·명시적 CLI 승인·원격 권한 검증은 별도 필요']};
  if (plan.templateType === 'basic') {
    try { freezeBasicPlan(plan); basic.schemaSupported = true; }
    catch (error) { basic.reasons.push(issue(error.code ?? 'invalid_plan', '현재 기본형 CLI의 계획 검사를 통과하지 못했습니다.')); }
  } else basic.reasons.push(issue('basic_template_only', '기본형 단일 DB 계획만 검사할 수 있습니다.'));

  const standard = {kind: 'standard_synthetic_7_rows_test', schemaSupported: false,
    checkedBy: 'informational_scope_inventory_not_executor_preflight',
    reasons: [], prerequisites: ['개인 전용 테스트 부모·별도 승인 필요', '가상 사람 2·프로그램 2·신청 3행과 고정 바인딩 필요', '빈 일반형 웹 실행기는 미구현']};
  if (plan.templateType !== 'standard' || plan.enabledModules.length) standard.reasons.push(issue('standard_template_only', '현재 일반형 CLI는 모듈 없는 일반형 3DB 테스트 전용입니다.'));
  const allowed = plan.templateType === 'basic' ? SUPPORTED_TYPES : [...BASIC_TYPES, 'relation', 'rollup', 'formula'];
  const unsupportedProperties = plan.properties.filter(p => !allowed.includes(p.type)).map(p => ({propertyId: p.id, type: p.type}));
  if (plan.templateType === 'standard') {
    if (unsupportedProperties.length) standard.reasons.push(issue('unsupported_property_type', 'Status·URL 등 실행기가 지원하지 않는 속성을 포함합니다.'));
    if (plan.properties.length > 100 || plan.databases.length !== 3 || plan.relations.length !== 2) standard.reasons.push(issue('unsupported_plan_scope', '현재 일반형 CLI의 DB·속성·관계 범위를 벗어납니다.'));
    if (plan.rollups.some(r => !Object.hasOwn(ROLLUP_FUNCTIONS, r.function)) || plan.formulas.some(f => !['relation_count', 'equals_option'].includes(f.ast?.op))) standard.reasons.push(issue('unsupported_calculation', '현재 일반형 CLI에서 확인하지 않은 계산입니다.'));
  }
  // A scope inventory must not certify the synthetic fixture or target preflight.
  standard.scopeCompatible = plan.dryRunValid === true && plan.templateType === 'standard' && standard.reasons.length === 0;
  standard.reasons.push(issue('synthetic_seven_rows_required', '가상 7행 테스트 제약이 있어 이 저장본만으로 일반형 실행 가능 판정을 하지 않습니다.'));
  return {availableTypes: ['basic_empty_database', 'standard_synthetic_7_rows_test'], basic, standard,
    unsupportedProperties, unsupportedModules: [...plan.enabledModules],
    extendedSupported: false, targetAndCredentialsVerified: false};
}

export function reviewSavedDraft(row) {
  let configuration;
  try { configuration = normalizeConfiguration(row.configuration, row.schema_version); }
  catch (error) {
    let saved = row.configuration;
    if (typeof saved === 'string') { try { saved = JSON.parse(saved); } catch { saved = null; } }
    const properties = saved?.mapping?.model?.properties;
    const unsupportedURL = Array.isArray(properties) && properties.some(p => p?.type === 'url');
    return {reviewStatus: 'structural_error', draftId: row.id, updatedAt: row.updated_at,
      schemaVersion: row.schema_version, configurationVersion: null, planVersion: null, planId: null, planHash: null,
      templateType: null, enabledModules: [], counts: null,
      planValidation: {status: 'structural_error', valid: false, confirmationItems: [], blockingErrors: [issue(
        ['unsupported_version', 'configuration_too_large'].includes(error.code) ? error.code : 'invalid_configuration', '저장 형식·버전·크기를 확인해 주세요.'),
        ...(unsupportedURL ? [issue('unsupported_saved_property_type', 'URL 유형은 현재 저장 모델과 CLI에서 지원하지 않습니다.', {type: 'url'})] : [])]},
      cliSupport: null, ...EXECUTION_FLAGS};
  }
  const plan = createGenerationPlan(configuration, configuration.planner);
  const validation = validateGenerationPlan(plan);
  const blockingErrors = [...plan.blockingErrors];
  for (const error of validation.blockingErrors) if (!blockingErrors.some(e => JSON.stringify(e) === JSON.stringify(error))) blockingErrors.push(error);
  const cliSupport = assessCLI(plan);
  const valid = blockingErrors.length === 0;
  const planStatus = !valid ? 'structural_error' : plan.confirmationItems.length ? 'confirmation_required' : 'valid';
  const unsupported = cliSupport.unsupportedProperties.length || plan.templateType === 'extended' ||
    (plan.templateType === 'basic' && !cliSupport.basic.schemaSupported && !plan.confirmationItems.length) ||
    (plan.templateType === 'standard' && !cliSupport.standard.scopeCompatible);
  return {reviewStatus: !valid ? 'structural_error' : unsupported ? 'unsupported_features' : planStatus,
    draftId: row.id, updatedAt: row.updated_at, schemaVersion: row.schema_version, configurationVersion: configuration.version,
    planVersion: plan.planVersion, planEngineVersion: 'plan-v1/review-v1', notionApiVersion: plan.notionApiVersion,
    templateType: plan.templateType, requestedModules: plan.requestedModules, enabledModules: plan.enabledModules,
    recommendations: plan.recommendations, planId: plan.planId, planHash: digest(plan), hashAlgorithm: 'SHA-256',
    hashScope: 'canonical_logical_plan_not_execution_approval',
    counts: {databases: plan.databases.length, dataSources: plan.dataSources.length, properties: plan.properties.length,
      relations: plan.relations.length, relationProperties: plan.properties.filter(p => p.type === 'relation').length,
      rollups: plan.rollups.length, formulas: plan.formulas.length, rows: 0},
    planValidation: {status: planStatus, valid, confirmationItems: plan.confirmationItems, blockingErrors},
    cliSupport, ...EXECUTION_FLAGS};
}

export function assertCurrentSnapshot(input, review) {
  const reasons = [];
  if (input.expectedUpdatedAt !== undefined && timestamp(input.expectedUpdatedAt) !== timestamp(review.updatedAt)) reasons.push('updated_at');
  if (input.expectedPlanHash !== undefined && input.expectedPlanHash.toLowerCase() !== review.planHash) reasons.push('plan_hash');
  return reasons;
}
