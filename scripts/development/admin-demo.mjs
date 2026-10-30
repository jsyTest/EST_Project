// Local loopback demo only. Never copied into public-dist or loaded by admin.html.
import {createAdminView} from '/js/admin-ui.mjs';
const banner = document.getElementById('local-demo-notice');
const data = {
  viewer: {id: 'local-demo', email: 'admin@example.invalid', role: 'admin'},
  statistics: {members: 3, educationDrafts: 6}, connections: {memberDirectory: true},
  members: [
    {email: 'admin@example.invalid', joinedAt: '2026-10-30', role: 'admin', status: '가상 예시'},
    {email: 'learner.one@example.invalid', joinedAt: '2026-10-29', role: 'user', status: '가상 예시'},
    {email: 'learner.two@example.invalid', joinedAt: '2026-10-28', role: 'user', status: '가상 예시'}
  ]
};
const view = createAdminView(document, {onLogout: () => { banner.textContent = '로컬 UI 시연입니다. 실제 로그인·로그아웃은 실행하지 않습니다.'; }});
view.render(data);
document.getElementById('admin-session-label').textContent = '가상 예시';
document.getElementById('admin-permission-status').textContent = '실제 권한 검증 아님';
document.getElementById('admin-member-note').textContent = '가상 예시 · 실제 통계 아님';
document.getElementById('admin-draft-note').textContent = '가상 예시 · 실제 통계 아님';
document.getElementById('admin-members-description').textContent = '회원 검색·필터 UI를 확인하기 위한 가상 데이터입니다.';
