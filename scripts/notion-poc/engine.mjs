import { createHash } from 'node:crypto';
import { API_VERSION, PAGE_TITLE, normalizeId, validateRunId } from './config.mjs';
import { DATABASES, RELATIONS, CALCULATIONS, validatePlan, relationPayload, buildViewSpecs } from './schema.mjs';
import { makeFixture, validateFixture, expectedKpis } from './fixture.mjs';
import { verifyEventually } from './verify.mjs';
import { NotionError } from './client.mjs';

const richText = value => [{ type: 'text', text: { content: value } }];
const title = value => ({ title: richText(value) });
const text = value => ({ rich_text: richText(value) });
const relation = ids => ({ relation: ids.map(id => ({ id })) });
const fingerprint = () => createHash('sha256').update(JSON.stringify({ DATABASES, RELATIONS, CALCULATIONS, fixture: makeFixture(), API_VERSION })).digest('hex');

export function dryRun(config) {
  validatePlan();
  const fixture = validateFixture(makeFixture());
  return {
    mode: 'dry-run', networkRequests: 0, apiVersion: API_VERSION,
    targetParent: config.parentId ?? '미설정 — 실제 실행 불가', pageTitle: PAGE_TITLE,
    databases: Object.entries(DATABASES).map(([key, value]) => ({ key, name: value.name, initialProperties: value.properties })),
    relations: RELATIONS, calculations: CALCULATIONS, fixtureCounts: Object.fromEntries(Object.entries(fixture).map(([key, rows]) => [key, rows.length])),
    expectedBaseline: expectedKpis(fixture), expectedAttendanceAfterChange: 100,
    views: { numberKpis: 4, recruitmentCharts: 2, courseChart: 1, tables: 3, dashboard: 1 },
    additionalDatabaseReason: '교육 전체 KPI를 운영 DB의 단일 행 계산과 분리해 검증하기 위한 집계 DB 1개 추가',
    mutationTest: '생성한 AT04의 결석을 출석으로 변경. 최종 상태는 출석률 100%.',
    limitations: ['실제 API 및 요금제 미검증', '미리 생성한 출석 4건을 예정 분모로 사용하는 PoC', '표 하단 계산 설정 제외', '같은 run-id의 실패 실행은 자동 재생성하지 않음']
  };
}

function sameId(a, b) { return normalizeId(a) === normalizeId(b); }

export function assertConfiguration(expected, actual, label = 'configuration') {
  for (const [key, value] of Object.entries(expected)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) assertConfiguration(value, actual?.[key], `${label}.${key}`);
    else if (actual?.[key] !== value) throw new Error(`View 설정 재조회 불일치: ${label}.${key}`);
  }
}

export async function runPoc({ config, runId, confirmParent, client, store, onProgress = () => {}, verificationOptions }) {
  validateRunId(runId);
  if (!config.parentId || !confirmParent || !sameId(config.parentId, confirmParent)) throw new Error('명시적 --confirm-parent 값이 테스트 상위 페이지와 일치해야 합니다.');
  validatePlan();
  const fixture = validateFixture(makeFixture());
  await store.lock();
  let state;
  try {
    const previous = await store.read();
    if (previous) {
      if (previous.runId !== runId || !sameId(previous.parentId, config.parentId) || previous.fingerprint !== fingerprint()) throw new Error('기존 실행의 대상 또는 코드가 다릅니다. 상태를 보존하고 별도 검토하세요.');
      if (['complete', 'partial'].includes(previous.status)) return { ...previous, reusedExistingRun: true };
      throw new Error('이 run-id에 미완료 실행이 있습니다. 중복 생성 방지를 위해 중단합니다. inspect/verify로 확인하세요.');
    }
    state = {
      taskId: 'NB-V2-002', runId, apiVersion: API_VERSION, parentId: config.parentId, fingerprint: fingerprint(),
      startedAt: new Date().toISOString(), status: 'running', steps: [], databases: {}, rows: {}, views: [], verification: {}, attendanceChanged: false
    };
    await store.save(state);
    const step = async (name, operation, { optional = false } = {}) => {
      const event = { name, status: 'in_progress', startedAt: new Date().toISOString() };
      state.steps.push(event);
      await store.save(state); // Durable marker BEFORE any write request.
      onProgress(name);
      try {
        const result = await operation();
        Object.assign(event, { status: 'done', endedAt: new Date().toISOString() });
        await store.save(state);
        return result;
      } catch (error) {
        event.status = error.uncertain ? 'uncertain' : 'failed';
        event.error = { name: error.name, code: error.code ?? 'local_or_validation_error', status: error.status ?? null, uncertain: error.uncertain === true };
        await store.save(state);
        if (optional && error instanceof NotionError && [400, 403, 404].includes(error.status)) return null;
        throw error;
      }
    };
    await step('preflight: 지정한 상위 페이지 확인', async () => {
      const parent = await client.get(`/v1/pages/${config.parentId}`);
      if (parent.object !== 'page' || !sameId(parent.id, config.parentId) || parent.in_trash || parent.archived || parent.is_locked) throw new Error('테스트 상위 페이지를 사용할 수 없습니다.');
      state.parentVerified = true;
    });
    await step('create: 테스트 교육 페이지', async () => {
      const page = await client.post('/v1/pages', {
        parent: { type: 'page_id', page_id: config.parentId }, properties: { title: title(PAGE_TITLE) },
        children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(`NB-V2-002 / run-id: ${runId} / 가상 데이터 전용. 마지막 검증에서 출석률이 75%에서 100%로 변경됩니다.`) } }]
      });
      state.page = { id: normalizeId(page.id), url: page.url ?? null };
      const actual = await client.get(`/v1/pages/${state.page.id}`);
      if (!sameId(actual.parent?.page_id, config.parentId)) throw new Error('생성 페이지의 부모 불일치');
    });
    for (const [key, schema] of Object.entries(DATABASES)) {
      await step(`create: ${schema.name}`, async () => {
        const db = await client.post('/v1/databases', {
          parent: { type: 'page_id', page_id: state.page.id }, title: richText(schema.name), is_inline: true,
          initial_data_source: { properties: schema.properties }
        });
        state.databases[key] = { databaseId: normalizeId(db.id), url: db.url ?? null };
        state.databases[key].dataSourceId = normalizeId(db.data_sources?.[0]?.id, '생성된 data_source_id');
        state.rows[key] = {};
        const remoteDb = await client.get(`/v1/databases/${state.databases[key].databaseId}`);
        if (!sameId(remoteDb.parent?.page_id, state.page.id)) throw new Error('생성 DB의 부모 불일치');
      });
    }
    for (const r of RELATIONS) {
      await step(`relation: ${r.source}.${r.name}`, async () => {
        const schema = await client.patch(`/v1/data_sources/${state.databases[r.source].dataSourceId}`, { properties: { [r.name]: relationPayload(r, state.databases) } });
        if (r.reverse) {
          const property = schema.properties?.[r.name];
          const reverseId = property?.relation?.dual_property?.synced_property_id;
          if (!reverseId) throw new Error('Notion이 역방향 속성 ID를 반환하지 않았습니다. 이름을 추측하지 않고 중단합니다.');
          await client.patch(`/v1/data_sources/${state.databases[r.target].dataSourceId}`, { properties: { [reverseId]: { name: r.reverse } } });
        }
      });
    }
    for (const [index, batch] of CALCULATIONS.entries()) await step(`calculations: ${batch.database} batch ${index + 1}`, () => client.patch(`/v1/data_sources/${state.databases[batch.database].dataSourceId}`, { properties: batch.properties }));

    const schemas = {};
    await step('verify: 실제 스키마 재조회', async () => {
      const expectedSchemas = validatePlan();
      for (const [key, db] of Object.entries(state.databases)) {
        schemas[key] = await client.get(`/v1/data_sources/${db.dataSourceId}`);
        if (!sameId(schemas[key].parent?.database_id, db.databaseId)) throw new Error('데이터 소스/DB ID 불일치');
        for (const [name, definition] of Object.entries(expectedSchemas[key])) {
          const actual = schemas[key].properties?.[name];
          const expectedType = Object.keys(definition)[0];
          if (!actual?.id || actual.type !== expectedType) throw new Error(`스키마 유형 불일치: ${key}.${name}`);
          if (definition.formula && actual.formula?.expression !== definition.formula.expression) throw new Error(`수식 재조회 불일치: ${key}.${name}`);
          if (definition.relation && !sameId(actual.relation?.data_source_id, state.databases[definition.relation.target].dataSourceId)) throw new Error(`관계 대상 불일치: ${key}.${name}`);
          if (definition.select) {
            const expectedOptions = definition.select.options.map(o => o.name).sort();
            const actualOptions = actual.select?.options?.map(o => o.name).sort();
            if (JSON.stringify(expectedOptions) !== JSON.stringify(actualOptions)) throw new Error(`선택 옵션 재조회 불일치: ${key}.${name}`);
          }
          if (definition.rollup && actual.rollup?.function !== definition.rollup.function) throw new Error(`롤업 집계 함수 재조회 불일치: ${key}.${name}`);
        }
      }
      state.schemaVerified = true;
    });
    const ref = (db, id) => {
      const row = state.rows[db][id];
      if (!row) throw new Error(`아직 생성되지 않은 행: ${db}.${id}`);
      return row.id;
    };
    const values = {
      applicants: row => ({ '가상 이름': title(row.name), '신청자 ID': text(row.id), '참여자 유형': { select: { name: row.type } }, '유입 경로': { select: { name: row.channel } } }),
      courses: row => ({ '과정명': title(row.name), '과정 ID': text(row.id) }),
      applications: row => ({ '신청기록 ID': title(row.id), '신청자': relation([ref('applicants', row.applicant)]), '과정': relation([ref('courses', row.course)]), '선정 상태': { select: { name: row.status } } }),
      enrollments: row => ({ '수강기록 ID': title(row.id), '신청기록': relation([ref('applications', row.application)]), '신청자': relation([ref('applicants', row.applicant)]), '과정': relation([ref('courses', row.course)]), '수료': { checkbox: row.completed } }),
      attendance: row => ({ '출석기록 ID': title(row.id), '수강': relation([ref('enrollments', row.enrollment)]), '교육일': { date: { start: row.date } }, '출석 상태': { select: { name: row.status } } })
    };
    for (const [key, rows] of Object.entries(fixture)) {
      for (const row of rows) await step(`seed: ${key}.${row.id}`, async () => {
        const created = await client.post('/v1/pages', { parent: { type: 'data_source_id', data_source_id: state.databases[key].dataSourceId }, properties: values[key](row) });
        state.rows[key][row.id] = { id: normalizeId(created.id), url: created.url ?? null };
      });
    }
    await step('seed: 교육 전체 KPI 행', async () => {
      const created = await client.post('/v1/pages', { parent: { type: 'data_source_id', data_source_id: state.databases.metrics.dataSourceId }, properties: {
        '이름': title('교육 전체 집계'),
        ...Object.fromEntries(RELATIONS.filter(r => r.source === 'metrics').map(r => [r.name, relation(Object.values(state.rows[r.target]).map(row => row.id))]))
      } });
      state.rows.metrics.summary = { id: normalizeId(created.id), url: created.url ?? null };
    });
    await step('verify: 초기 KPI 75%', async () => {
      state.verification.baseline = await verifyEventually(client, state, verificationOptions);
      if (!state.verification.baseline.ok) throw new Error('초기 관계/KPI 검증 실패. 상태 파일에서 실제값을 확인하세요.');
    });
    await step('mutation: 생성한 AT04만 결석 → 출석', async () => {
      const id = ref('attendance', 'AT04');
      const page = await client.get(`/v1/pages/${id}`);
      if (!sameId(page.parent?.data_source_id, state.databases.attendance.dataSourceId)) throw new Error('변경 대상이 생성한 출석 DB에 속하지 않습니다.');
      await client.patch(`/v1/pages/${id}`, { properties: { '출석 상태': { select: { name: '출석' } } } });
      state.attendanceChanged = true;
    });
    await step('verify: 변경 후 KPI 100%', async () => {
      state.verification.afterChange = await verifyEventually(client, state, verificationOptions);
      if (!state.verification.afterChange.ok) throw new Error('변경 후 관계/KPI 재검증 실패');
    });
    let dashboardId;
    await step('view: Dashboard 생성', async () => {
      const view = await client.post('/v1/views', { database_id: state.databases.metrics.databaseId, data_source_id: state.databases.metrics.dataSourceId, name: '교육 운영 대시보드', type: 'dashboard' });
      dashboardId = normalizeId(view.id);
      const record = { key: 'dashboard', id: dashboardId, type: 'dashboard', url: view.url ?? null, verified: false };
      state.views.push(record);
      const actual = await client.get(`/v1/views/${dashboardId}`);
      if (actual.type !== 'dashboard') throw new Error('Dashboard 재조회 유형 불일치');
      record.verified = true;
    }, { optional: true });
    const groups = new Map();
    for (const [index, spec] of buildViewSpecs(state.databases, schemas).entries()) {
      await step(`view: ${spec.name}`, async () => {
        const bucket = index < 4 ? 0 : index < 7 ? 1 : 2;
        const existing = groups.has(bucket);
        const view = await client.post('/v1/views', {
          ...(dashboardId ? { view_id: dashboardId, placement: existing ? { type: 'existing_row', row_index: groups.get(bucket) } : { type: 'new_row' } } : { database_id: state.databases[spec.database].databaseId }),
          data_source_id: spec.data_source_id, name: spec.name, type: spec.type,
          ...(spec.configuration ? { configuration: spec.configuration } : {})
        });
        if (dashboardId && !existing) groups.set(bucket, groups.size);
        const record = { key: spec.key, id: normalizeId(view.id), type: spec.type, url: view.url ?? null, verified: false };
        state.views.push(record);
        const actual = await client.get(`/v1/views/${record.id}`);
        if (actual.type !== spec.type || !sameId(actual.data_source_id, spec.data_source_id)) throw new Error('View 재조회 대상 또는 유형 불일치');
        if (spec.configuration) assertConfiguration(spec.configuration, actual.configuration);
        record.verified = true;
      }, { optional: true });
    }
    if (dashboardId) await step('verify: Dashboard 위젯 재조회', async () => {
      const view = await client.get(`/v1/views/${dashboardId}`);
      const ids = view.configuration?.rows?.flatMap(row => row.widgets.map(widget => normalizeId(widget.view_id))) ?? [];
      if (view.configuration?.rows?.some(row => row.widgets.length > 4)) throw new Error('Dashboard 행당 위젯 제한 불일치');
      for (const widget of state.views.filter(v => v.key !== 'dashboard')) if (!ids.includes(widget.id)) throw new Error('생성한 위젯이 Dashboard에 없습니다.');
      state.dashboardLayoutVerified = true;
    });
    state.status = state.steps.some(event => event.status === 'failed') ? 'partial' : 'complete';
    state.endedAt = new Date().toISOString();
    state.visualInspection = 'not_performed';
    await store.save(state);
    return state;
  } catch (error) {
    if (state) {
      state.status = 'failed';
      state.endedAt = new Date().toISOString();
      state.requiresManualReview = true;
      await store.save(state);
    }
    throw error;
  } finally { await store.unlock(); }
}
