export const API_VERSION = '2026-03-11';
export const API_ORIGIN = 'https://api.notion.com';
export const PAGE_TITLE = '[TEST] AI 노션 빌더 - 교육 운영 검증';

export function normalizeId(value, label = 'Notion ID') {
  const compact = String(value ?? '').trim().replaceAll('-', '');
  if (!/^[a-fA-F0-9]{32}$/.test(compact)) throw new Error(`${label}: UUID 형식이 필요합니다.`);
  return compact.toLowerCase().replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

export function readConfig(env = process.env, { live = false } = {}) {
  const token = env.NOTION_API_TOKEN?.trim();
  const rawParent = env.NOTION_TEST_PARENT_PAGE_ID?.trim();
  const parentId = rawParent ? normalizeId(rawParent, 'NOTION_TEST_PARENT_PAGE_ID') : null;
  if (live && !token) throw new Error('NOTION_API_TOKEN이 없습니다. 토큰은 채팅에 보내지 말고 로컬 환경변수로 설정하세요.');
  if (live && !parentId) throw new Error('NOTION_TEST_PARENT_PAGE_ID가 없습니다. 승인된 테스트 페이지 ID를 명시하세요.');
  return { token, parentId, apiVersion: API_VERSION };
}

export function validateRunId(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new Error('run-id는 영문 소문자·숫자·하이픈 1~64자여야 합니다.');
  return value;
}
