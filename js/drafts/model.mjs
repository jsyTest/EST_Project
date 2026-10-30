import {COLORS, TYPES, GROUPS, DATABASE_KEYS, baseProperties} from '../mapping/model.mjs';
import {MODULES, TEMPLATE_NAMES} from '../planner/catalog.mjs';

export const SCHEMA_VERSION = 1;
export const WORKSPACE_KEY = 'estEducationWorkspaceV1';
export const MAX_BYTES = 524288;
const basic = ['students', 'attendance', 'schedule'];
const additional = ['assignments', 'evaluations', 'completion', 'instructors', 'supplies'];
export class DraftError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new DraftError(code); };
const object = v => v && typeof v === 'object' && !Array.isArray(v);
function text(v, max, fallback = '') {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string' || v.length > max) fail('invalid_configuration');
  return v;
}
function enumValue(v, allowed, fallback) {
  if (v === undefined && fallback !== undefined) return fallback;
  if (!allowed.includes(v)) fail('invalid_configuration');
  return v;
}
function strings(v, maxCount, maxLength) {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > maxCount) fail('invalid_configuration');
  return v.map(s => text(s, maxLength));
}
function modules(v, allowed, fallback) {
  if (v === undefined) return [...fallback];
  if (!Array.isArray(v) || v.length > allowed.length || new Set(v).size !== v.length || v.some(id => !allowed.includes(id))) fail('invalid_configuration');
  return [...v];
}
export function normalizeRequirements(value = {}) {
  if (!object(value)) fail('invalid_configuration');
  return {
    educationName: text(value.educationName, 80),
    educationType: enumValue(value.educationType, ['education', 'hackathon'], 'education'),
    purpose: text(value.purpose, 500),
    requirements: text(value.requirements, 1000),
    basicItems: modules(value.basicItems, basic, basic),
    additionalItems: modules(value.additionalItems, additional, [])
  };
}
// Persist explicit user choices only. Dependencies and generated plans are recomputed.
export function normalizePlannerSettings(value = {}) {
  if (!object(value)) fail('invalid_configuration');
  const selected = modules(value.enabledModules, Object.keys(MODULES), []);
  const settings = {
    templateType: enumValue(value.templateType, Object.keys(TEMPLATE_NAMES), 'basic'),
    enabledModules: Object.keys(MODULES).filter(id => selected.includes(id))
  };
  for (const key of ['repeatPrograms', 'personHistory', 'programStatistics', 'multipleApplications']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') fail('invalid_configuration');
    settings[key] = value[key] ?? false;
  }
  return settings;
}
function column(value) {
  if (!object(value) || !Number.isInteger(value.index) || value.index < 0 || value.index > 2047) fail('invalid_configuration');
  return {index: value.index, original: text(value.original, 65536), normalized: text(value.normalized, 65536), issues: strings(value.issues, 10, 200)};
}
export function emptyMapping() {
  return {formText: '', encoding: 'utf-8', columns: [], model: {version: 1, properties: baseProperties()}};
}
export function normalizeMapping(value = emptyMapping()) {
  if (!object(value) || !object(value.model) || value.model.version !== 1 || !Array.isArray(value.model.properties) || value.model.properties.length > 500) fail('invalid_configuration');
  if (!Array.isArray(value.columns) || value.columns.length > 2048) fail('invalid_configuration');
  const columns = value.columns.map(column);
  if (new Set(columns.map(c => c.index)).size !== columns.length) fail('invalid_configuration');
  const ids = new Set();
  const properties = value.model.properties.map(p => {
    if (!object(p)) fail('invalid_configuration');
    const localId = text(p.localId, 100);
    if (!localId || ids.has(localId)) fail('invalid_configuration');
    ids.add(localId);
    if (!Array.isArray(p.options) || p.options.length > 200) fail('invalid_configuration');
    const optionIds = new Set();
    const options = p.options.map(o => {
      if (!object(o)) fail('invalid_configuration');
      const id = text(o.localId, 100);
      if (!id || optionIds.has(id)) fail('invalid_configuration');
      optionIds.add(id);
      return {localId: id, name: text(o.name, 100), color: enumValue(o.color, COLORS),
        ...(o.group !== undefined ? {group: enumValue(o.group, GROUPS)} : {}),
        ...(o.colorSource !== undefined ? {colorSource: enumValue(o.colorSource, ['user'])} : {})};
    });
    let csvColumn = null;
    if (p.csvColumn != null) {
      const supplied = column(p.csvColumn);
      csvColumn = columns.find(c => c.index === supplied.index && c.original === supplied.original);
      if (!csvColumn) fail('invalid_configuration');
    }
    if (p.required != null && typeof p.required !== 'boolean') fail('invalid_configuration');
    if (typeof p.included !== 'boolean') fail('invalid_configuration');
    return {localId, origin: enumValue(p.origin, ['base', 'form', 'csv', 'manual']),
      questionName: text(p.questionName, 10000), questionNumber: text(p.questionNumber, 30),
      rawText: text(p.rawText, 100000), required: p.required ?? null,
      cardinality: p.cardinality == null ? null : enumValue(p.cardinality, ['single', 'multiple', 'unknown']),
      csvColumn: csvColumn ? {...csvColumn} : null, name: text(p.name, 100),
      type: enumValue(p.type, TYPES), targetDb: enumValue(p.targetDb, DATABASE_KEYS), options,
      included: p.included, mappingStatus: enumValue(p.mappingStatus, ['automatic', 'confirmed', 'review']),
      reviewReasons: strings(p.reviewReasons, 30, 500)};
  });
  // An allowlist prevents arbitrary response rows, File objects, tokens and derived payloads from being serialized.
  return {formText: text(value.formText, 100000), encoding: enumValue(value.encoding, ['utf-8', 'euc-kr'], 'utf-8'), columns, model: {version: 1, properties}};
}
export function normalizeConfiguration(value, version = SCHEMA_VERSION) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { fail('invalid_configuration'); }
  }
  if (version !== SCHEMA_VERSION || !object(value) || value.version !== SCHEMA_VERSION) fail('unsupported_version');
  const normalized = {version: SCHEMA_VERSION, requirements: normalizeRequirements(value.requirements), mapping: normalizeMapping(value.mapping),
    planner: normalizePlannerSettings(value.planner)};
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > MAX_BYTES) fail('configuration_too_large');
  return normalized;
}
export function emptyConfiguration() { return normalizeConfiguration({version: 1, requirements: {}, mapping: emptyMapping()}); }
export function forSave(value) {
  const configuration = normalizeConfiguration(value);
  const title = configuration.requirements.educationName.trim();
  if (!title) fail('title_required');
  configuration.requirements.educationName = title;
  return {title, configuration, schema_version: SCHEMA_VERSION};
}
export function errorMessage(error) {
  const code = error?.code;
  if (code === 'title_required') return '교육 입력 화면에서 교육명을 입력한 뒤 저장해 주세요.';
  if (code === 'analysis_required') return 'CSV 입력이 바뀌었습니다. 먼저 ‘입력 분석하기’를 누른 뒤 저장해 주세요. 응답 행은 저장하지 않습니다.';
  if (code === 'unsupported_version') return '지원하지 않는 저장 형식입니다. 현재 편집 내용은 유지했습니다.';
  if (code === 'invalid_configuration' || code === 'configuration_too_large') return '설정 형식이나 크기를 확인해 주세요. 현재 편집 내용은 유지했습니다.';
  if (code === 'conflict') return '다른 탭에서 이 설계가 변경됐습니다. 현재 내용을 복사하거나 새 설계로 저장한 뒤 최신 설계를 열어 주세요.';
  if (code === 'not_found') return '이 설계를 열 수 없습니다. 목록을 다시 확인해 주세요.';
  if (code === 'auth_required' || code === 'account_changed') return '로그인 상태가 변경됐습니다. 다시 로그인한 뒤 이용해 주세요.';
  if (code === 'storage_unavailable') return '브라우저 임시 저장소를 사용할 수 없습니다. 저장소 허용과 여유 공간을 확인해 주세요.';
  if (code === 'PGRST205' || code === '42P01' || code === '42501') return '설계 저장소가 아직 준비되지 않았거나 접근 권한이 없습니다. 현재 편집 내용은 유지했습니다.';
  return '저장소 응답을 확인하지 못했습니다. 현재 편집 내용은 유지했습니다. 저장 요청이었다면 목록에서 저장 여부를 확인한 뒤 다시 시도해 주세요.';
}
