export function makeFixture() {
  return {
    applicants: [
      { id: 'A01', name: '신청자 1', type: '재직자', channel: '검색' },
      { id: 'A02', name: '신청자 2', type: '구직자', channel: '추천' },
      { id: 'A03', name: '신청자 3', type: '재직자', channel: '검색' }
    ],
    courses: [{ id: 'C01', name: 'Basic 과정' }, { id: 'C02', name: 'Associate 과정' }],
    applications: [
      { id: 'AP01', applicant: 'A01', course: 'C01', status: '선정' },
      { id: 'AP02', applicant: 'A01', course: 'C02', status: '미선정' },
      { id: 'AP03', applicant: 'A02', course: 'C01', status: '선정' },
      { id: 'AP04', applicant: 'A03', course: 'C02', status: '취소' }
    ],
    enrollments: [
      { id: 'E01', application: 'AP01', applicant: 'A01', course: 'C01', completed: true },
      { id: 'E02', application: 'AP03', applicant: 'A02', course: 'C01', completed: false }
    ],
    attendance: [
      { id: 'AT01', enrollment: 'E01', date: '2026-10-01', status: '출석' },
      { id: 'AT02', enrollment: 'E01', date: '2026-10-02', status: '출석' },
      { id: 'AT03', enrollment: 'E02', date: '2026-10-01', status: '출석' },
      { id: 'AT04', enrollment: 'E02', date: '2026-10-02', status: '결석' }
    ]
  };
}

export function validateFixture(f) {
  for (const [key, rows] of Object.entries(f)) {
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`${key}: 중복 식별자`);
  }
  const index = key => new Map(f[key].map(row => [row.id, row]));
  const applicants = index('applicants'), courses = index('courses'), applications = index('applications');
  const enrollments = index('enrollments');
  for (const row of f.applications) {
    if (!applicants.has(row.applicant) || !courses.has(row.course)) throw new Error('신청 관계 대상 없음');
  }
  const pairs = new Set();
  for (const row of f.enrollments) {
    const app = applications.get(row.application);
    if (!app || app.status !== '선정' || app.applicant !== row.applicant || app.course !== row.course) {
      throw new Error('선정된 과정별 신청에만 수강을 생성할 수 있습니다.');
    }
    const pair = `${row.applicant}:${row.course}`;
    if (pairs.has(pair)) throw new Error('중복 수강');
    pairs.add(pair);
  }
  const attendanceKeys = new Set();
  for (const row of f.attendance) {
    if (!enrollments.has(row.enrollment) || !['출석', '결석'].includes(row.status)) throw new Error('잘못된 출석 기록');
    const key = `${row.enrollment}:${row.date}`;
    if (attendanceKeys.has(key)) throw new Error('같은 날짜의 중복 출석');
    attendanceKeys.add(key);
  }
  return f;
}

export function expectedKpis(f) {
  const completed = f.enrollments.filter(row => row.completed);
  return {
    applicants: new Set(f.applicants.map(row => row.id)).size,
    applications: f.applications.length,
    selectedPeople: new Set(f.applications.filter(row => row.status === '선정').map(row => row.applicant)).size,
    enrollments: f.enrollments.length,
    completions: completed.length,
    completedPeople: new Set(completed.map(row => row.applicant)).size,
    completionRate: f.enrollments.length ? completed.length / f.enrollments.length * 100 : 0,
    attendanceCount: f.attendance.filter(row => row.status === '출석').length,
    attendanceTotal: f.attendance.length,
    attendanceRate: f.attendance.length ? f.attendance.filter(row => row.status === '출석').length / f.attendance.length * 100 : 0
  };
}
