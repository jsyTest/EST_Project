import { API_VERSION, normalizeId } from './config.mjs';
import { DATABASES, RELATIONS } from './schema.mjs';

// One known, explicitly rejected pre-seed schema from the first NB-V2-002A run.
// This is not a general resume path for failed or uncertain creations.
export const REPAIRABLE_SCHEMA_FINGERPRINT = 'b8aaa2f4e21dbc2dc8e5bc53631c5941b63b0606de9fa7e4f9558870ddd620a6';

export function validateSchemaRepairState(state, { parentId, runId, viewProfile }) {
  const failure = state.steps?.at(-1);
  if (state.runId !== runId || normalizeId(state.parentId) !== normalizeId(parentId) || state.apiVersion !== API_VERSION || state.viewProfile !== viewProfile) throw new Error('스키마 수정 실행의 대상이 다릅니다.');
  if (state.status !== 'failed' || state.fingerprint !== REPAIRABLE_SCHEMA_FINGERPRINT || failure?.name !== 'calculations: metrics batch 5' || failure.error?.status !== 400 || failure.error?.code !== 'validation_error') throw new Error('알려진 400 스키마 오류 상태만 이어갈 수 있습니다.');
  if (state.steps.some(s => s.status === 'uncertain' || s.status === 'in_progress') || state.schemaDiagnostics?.some(d => ['pending', 'uncertain'].includes(d.status))) throw new Error('응답이 불확실한 기록이 있어 자동으로 이어갈 수 없습니다.');
  if (state.views?.length || Object.keys(state.rows ?? {}).length !== Object.keys(DATABASES).length || Object.values(state.rows).some(rows => Object.keys(rows).length)) throw new Error('데이터나 보기가 이미 있으면 이 수정 경로를 사용할 수 없습니다.');
  if (Object.keys(state.databases ?? {}).sort().join() !== Object.keys(DATABASES).sort().join()) throw new Error('기존 DB 여섯 개를 확인할 수 없습니다.');
  normalizeId(state.page?.id);
  const ids = Object.values(state.databases).flatMap(db => [normalizeId(db.databaseId), normalizeId(db.dataSourceId)]);
  if (new Set(ids).size !== ids.length) throw new Error('DB/데이터 소스 ID 중복');
}

export async function verifyRepairSkeleton(client, state) {
  const parent = await client.get(`/v1/pages/${state.parentId}`);
  if (parent.in_trash || parent.archived || parent.is_locked || normalizeId(parent.id) !== normalizeId(state.parentId)) throw new Error('수정 대상 부모 접근 확인 실패');
  const page = await client.get(`/v1/pages/${state.page.id}`);
  if (normalizeId(page.parent?.page_id) !== normalizeId(state.parentId)) throw new Error('기존 생성 페이지가 승인한 부모 아래에 없습니다.');
  for (const [key, db] of Object.entries(state.databases)) {
    const database = await client.get(`/v1/databases/${db.databaseId}`);
    if (normalizeId(database.parent?.page_id) !== normalizeId(state.page.id) || !database.data_sources?.some(s => normalizeId(s.id) === normalizeId(db.dataSourceId))) throw new Error('기존 DB 소유 관계 불일치');
    const source = await client.get(`/v1/data_sources/${db.dataSourceId}`);
    if (normalizeId(source.parent?.database_id) !== normalizeId(db.databaseId)) throw new Error('기존 데이터 소스 부모 불일치');
    for (const [name, definition] of Object.entries(DATABASES[key].properties)) {
      if (source.properties?.[name]?.type !== Object.keys(definition)[0]) throw new Error('기존 기본 속성 불일치');
    }
    for (const r of RELATIONS) {
      const target = r.source === key ? { name: r.name, database: r.target } : r.reverse && r.target === key ? { name: r.reverse, database: r.source } : null;
      if (target && normalizeId(source.properties?.[target.name]?.relation?.data_source_id) !== normalizeId(state.databases[target.database].dataSourceId)) throw new Error('기존 관계형 대상 불일치');
    }
    if ((await client.queryAll(db.dataSourceId)).length) throw new Error('실제 데이터가 있는 DB는 이 수정 경로에서 이어가지 않습니다.');
  }
}
