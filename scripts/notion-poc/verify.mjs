import { normalizeId } from './config.mjs';
import { makeFixture, expectedKpis } from './fixture.mjs';
import { METRIC_PROPERTIES, RELATIONS } from './schema.mjs';

const listIds = property => {
  if (property?.type !== 'relation' || property.has_more) throw new Error('관계 값이 없거나 잘렸습니다. 전체 속성 조회가 필요합니다.');
  return property.relation.map(value => normalizeId(value.id)).sort();
};
const numberValue = property => {
  const value = property?.formula ?? property?.rollup;
  return value?.type === 'number' && Number.isFinite(value.number) ? value.number : null;
};

export async function verifyRemote(client, state, { changed = state.attendanceChanged === true } = {}) {
  const fixture = makeFixture();
  if (changed) fixture.attendance.find(row => row.id === 'AT04').status = '출석';
  const expected = expectedKpis(fixture);
  const checks = [];
  const check = (name, actual, wanted) => {
    const equal = typeof wanted === 'number' ? typeof actual === 'number' && Math.abs(actual - wanted) < 1e-7 : JSON.stringify(actual) === JSON.stringify(wanted);
    checks.push({ name, expected: wanted, actual: actual ?? null, passed: equal });
  };
  const rows = {}, byId = {};
  for (const [key, database] of Object.entries(state.databases)) {
    rows[key] = await client.queryAll(database.dataSourceId);
    const expectedRows = state.rows[key];
    check(`${key}: row IDs`, rows[key].map(row => normalizeId(row.id)).sort(), Object.values(expectedRows).map(row => normalizeId(row.id)).sort());
    byId[key] = new Map(rows[key].map(row => [normalizeId(row.id), row]));
    for (const row of rows[key]) check(`${key}: parent ${row.id}`, row.parent?.data_source_id ? normalizeId(row.parent.data_source_id) : null, normalizeId(database.dataSourceId));
  }
  const remote = (key, id) => byId[key].get(normalizeId(state.rows[key][id].id));
  const pageId = (key, id) => normalizeId(state.rows[key][id].id);
  const relation = (key, rowId, property, expectedIds) => {
    let actual;
    try { actual = listIds(remote(key, rowId)?.properties[property]); }
    catch { actual = null; }
    check(`${key}.${rowId}.${property}`, actual, expectedIds.slice().sort());
  };
  for (const row of fixture.applications) {
    relation('applications', row.id, '신청자', [pageId('applicants', row.applicant)]);
    relation('applications', row.id, '과정', [pageId('courses', row.course)]);
    check(`${row.id}: selection`, remote('applications', row.id)?.properties['선정 상태']?.select?.name, row.status);
    relation('applications', row.id, '수강', fixture.enrollments.filter(e => e.application === row.id).map(e => pageId('enrollments', e.id)));
  }
  for (const row of fixture.applicants) {
    const p = remote('applicants', row.id)?.properties;
    check(`${row.id}: name`, p?.['가상 이름']?.title?.map(t => t.plain_text ?? t.text?.content ?? '').join(''), row.name);
    check(`${row.id}: applicant ID`, p?.['신청자 ID']?.rich_text?.map(t => t.plain_text ?? t.text?.content ?? '').join(''), row.id);
    check(`${row.id}: participant type`, p?.['참여자 유형']?.select?.name, row.type);
    check(`${row.id}: acquisition channel`, p?.['유입 경로']?.select?.name, row.channel);
    relation('applicants', row.id, '신청기록', fixture.applications.filter(a => a.applicant === row.id).map(a => pageId('applications', a.id)));
    relation('applicants', row.id, '수강', fixture.enrollments.filter(e => e.applicant === row.id).map(e => pageId('enrollments', e.id)));
  }
  for (const row of fixture.enrollments) {
    const p = remote('enrollments', row.id)?.properties;
    relation('enrollments', row.id, '신청기록', [pageId('applications', row.application)]);
    relation('enrollments', row.id, '신청자', [pageId('applicants', row.applicant)]);
    relation('enrollments', row.id, '과정', [pageId('courses', row.course)]);
    const attendance = fixture.attendance.filter(a => a.enrollment === row.id);
    relation('enrollments', row.id, '출석기록', attendance.map(a => pageId('attendance', a.id)));
    check(`${row.id}: completed`, p?.['수료']?.checkbox, row.completed);
    check(`${row.id}: attendance count`, numberValue(p?.['출석 건수']), attendance.filter(a => a.status === '출석').length);
    check(`${row.id}: attendance total`, numberValue(p?.['예정 건수']), attendance.length);
    check(`${row.id}: attendance rate`, numberValue(p?.['출석률']), attendance.filter(a => a.status === '출석').length / attendance.length * 100);
  }
  for (const row of fixture.courses) {
    const enrolled = fixture.enrollments.filter(e => e.course === row.id);
    relation('courses', row.id, '신청기록', fixture.applications.filter(a => a.course === row.id).map(a => pageId('applications', a.id)));
    relation('courses', row.id, '수강', enrolled.map(e => pageId('enrollments', e.id)));
    check(`${row.id}: enrollments`, numberValue(remote('courses', row.id)?.properties['수강인원']), enrolled.length);
    check(`${row.id}: completions`, numberValue(remote('courses', row.id)?.properties['수료건수']), enrolled.filter(e => e.completed).length);
  }
  for (const row of fixture.attendance) {
    const p = remote('attendance', row.id)?.properties;
    relation('attendance', row.id, '수강', [pageId('enrollments', row.enrollment)]);
    check(`${row.id}: status`, p?.['출석 상태']?.select?.name, row.status);
    check(`${row.id}: attendance date`, p?.['교육일']?.date?.start, row.date);
    check(`${row.id}: accepted`, p?.['출석 인정 여부']?.formula?.boolean, row.status === '출석');
    check(`${row.id}: accepted value`, numberValue(p?.['출석 인정 값']), row.status === '출석' ? 1 : 0);
  }
  for (const r of RELATIONS.filter(r => r.source === 'metrics')) relation('metrics', 'summary', r.name, Object.values(state.rows[r.target]).map(row => normalizeId(row.id)));
  const actual = {};
  for (const [key, property] of Object.entries(METRIC_PROPERTIES)) {
    actual[key] = numberValue(remote('metrics', 'summary')?.properties[property]);
    check(`KPI: ${property}`, actual[key], expected[key]);
  }
  return { ok: checks.every(check => check.passed), checkedAt: new Date().toISOString(), phase: changed ? 'after-attendance-change' : 'baseline', expected, actual, checks };
}

export async function verifyEventually(client, state, { attempts = 8, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    result = await verifyRemote(client, state);
    result.attempts = attempt;
    if (result.ok) return result;
    if (attempt < attempts) await sleep(1000);
  }
  return result;
}
