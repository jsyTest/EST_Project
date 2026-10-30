const TITLES = {dashboard: '대시보드', members: '회원 관리', usage: '이용 현황', settings: '설정'};
export function createAdminView(document, {onLogout = () => {}} = {}) {
  const node = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[data-admin-tab]')];
  const sections = [...document.querySelectorAll('[data-admin-section]')];
  let members = [], connected = false;
  for (const tab of tabs) tab.addEventListener('click', () => {
    const key = tab.dataset.adminTab;
    if (!Object.hasOwn(TITLES, key)) return;
    for (const section of sections) section.hidden = section.dataset.adminSection !== key;
    for (const button of tabs) { if (button === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); }
    node('admin-view-name').textContent = TITLES[key];
  });
  function renderMembers() {
    const body = node('admin-members-body'); body.replaceChildren();
    const search = node('admin-member-search').value.trim().toLowerCase(), filter = node('admin-role-filter').value;
    const rows = members.filter(m => m.email.toLowerCase().includes(search) && (filter === 'all' || m.role === filter));
    node('admin-member-result').textContent = connected ? `검색 결과 ${rows.length}개` : '추후 연결 예정';
    if (!rows.length) {
      const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5;
      td.textContent = connected ? '검색 조건에 맞는 회원이 없습니다.' : '회원 목록 연결을 준비하고 있어요.';
      tr.append(td); body.append(tr); return;
    }
    for (const member of rows) {
      const tr = document.createElement('tr');
      for (const text of [member.email, member.joinedAt, member.role === 'admin' ? '관리자' : '일반 사용자', member.status]) {
        const td = document.createElement('td'); td.textContent = text; tr.append(td);
      }
      const td = document.createElement('td'), button = document.createElement('button');
      button.type = 'button'; button.disabled = true; button.textContent = '역할 변경'; button.title = '안전한 역할 관리 기능 연결 후 이용할 수 있습니다.';
      td.append(button); tr.append(td); body.append(tr);
    }
  }
  node('admin-member-search').addEventListener('input', renderMembers);
  node('admin-role-filter').addEventListener('change', renderMembers);
  node('admin-settings-logout').addEventListener('click', onLogout);
  return {
    render(data) {
      connected = data.connections.memberDirectory === true;
      members = connected && Array.isArray(data.members) ? data.members : [];
      node('admin-member-search').disabled = !connected;
      node('admin-role-filter').disabled = !connected;
      node('admin-member-count').textContent = data.statistics.members === null ? '—' : String(data.statistics.members);
      node('admin-draft-count').textContent = data.statistics.educationDrafts === null ? '—' : String(data.statistics.educationDrafts);
      node('admin-viewer-email').textContent = data.viewer.email || '이메일 정보 없음';
      node('admin-viewer-role').textContent = '관리자';
      node('admin-permission-status').textContent = '관리자 접근 확인 완료';
      renderMembers();
    },
    clear() {
      connected = false; members = [];
      node('admin-member-search').value = ''; node('admin-role-filter').value = 'all';
      node('admin-member-search').disabled = true; node('admin-role-filter').disabled = true;
      for (const id of ['admin-member-count', 'admin-draft-count', 'admin-viewer-email', 'admin-viewer-role']) node(id).textContent = '—';
      node('admin-permission-status').textContent = '확인 대기'; renderMembers();
    }
  };
}
if (typeof window !== 'undefined' && document.documentElement.dataset.adminRequired === 'true') {
  const view = createAdminView(document, {onLogout: () => window.dispatchEvent(new Event('pplus-logout-request'))});
  const update = () => { const result = window.pplusAdminState; if (result?.state === 'authorized') view.render(result.data); else view.clear(); };
  window.addEventListener('pplus-admin-change', update); update();
}
