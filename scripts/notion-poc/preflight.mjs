import { normalizeId, API_VERSION } from './config.mjs';

// Read exactly the supplied parent; never search a workspace or query users.
// A successful read does NOT prove insert/update capability or the account plan.
export async function preflight(client, parentId) {
  const expected = normalizeId(parentId, '테스트 상위 페이지');
  const page = await client.get(`/v1/pages/${expected}`);
  if (page.object !== 'page' || normalizeId(page.id) !== expected || page.in_trash || page.archived || page.is_locked) {
    throw new Error('지정한 테스트 상위 페이지를 사용할 수 없습니다.');
  }
  const title = Object.values(page.properties ?? {}).find(p => p.type === 'title' || Array.isArray(p.title))?.title ?? [];
  return {
    mode: 'preflight', apiVersion: API_VERSION, mutations: 0,
    parent: { id: expected, title: title.map(t => t.plain_text ?? t.text?.content ?? '').join(''), url: page.url ?? null },
    readAccessVerified: true,
    insertUpdateCapabilities: '읽기 요청으로는 확인하지 못함',
    workspacePlan: '사용자가 선택한 환경이며 API 조회로 확인하지 않음',
    creationApproval: '별도 사용자 승인 필요'
  };
}
