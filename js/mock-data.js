(function () {
  "use strict";

  const overviewProperties = [
    { name: "교육명", type: "제목", description: "교육별 독립 대시보드의 기준 이름" },
    { name: "시작일", type: "날짜", description: "교육 시작일" },
    { name: "종료일", type: "날짜", description: "교육 종료일" }
  ];

  const modules = {
    students: {
      label: "교육생",
      database: {
        id: "students",
        name: "교육생 DB",
        description: "해당 교육에 참여하는 교육생의 기본 상태를 관리합니다.",
        properties: [
          { name: "교육생", type: "제목", description: "교육생 식별용 이름(실제 구축 시 권한에 맞게 관리)" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "소속", type: "텍스트", description: "부서 또는 소속 구분" },
          { name: "참여 상태", type: "선택", description: "예정 / 참여 중 / 중도 이탈 / 수료" }
        ]
      },
      overviewRelation: { name: "교육생", type: "관계형", description: "교육생 DB 연결" },
      kpi: { title: "교육생 수", description: "연결된 교육생 전체 인원" },
      management: { title: "교육생 관리", description: "참여 상태와 소속을 기준으로 교육생 명단을 확인합니다." }
    },
    attendance: {
      label: "출결",
      database: {
        id: "attendance",
        name: "출결 DB",
        description: "교육생의 회차별 출결 상태를 한 건씩 기록합니다.",
        properties: [
          { name: "출결 기록", type: "제목", description: "예: 3회차 · 교육생 A" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "교육생", type: "관계형", description: "교육생 DB를 선택한 경우 교육생 DB와 연결" },
          { name: "교육일", type: "날짜", description: "출결 대상 회차의 교육일" },
          { name: "출결 상태", type: "선택", description: "출석 / 지각 / 결석" },
          { name: "출석 값", type: "수식", description: "출석이면 1, 그 외에는 0" }
        ]
      },
      overviewProperties: [
        { name: "출결 기록", type: "관계형", description: "출결 DB 연결" },
        { name: "전체 출결 건수", type: "롤업", description: "출결 기록 → 출결 기록 → 모두 세기" },
        { name: "출석 건수", type: "롤업", description: "출결 기록 → 출석 값 → 합계" },
        { name: "출석률", type: "수식", description: "출석 건수 ÷ 전체 출결 건수 × 100" }
      ],
      kpi: { title: "출석률", description: "전체 출결 기록 중 출석 처리된 비율" },
      management: { title: "출결 관리", description: "날짜와 교육생별 출결 상태를 기록하고 결석 내역을 확인합니다." }
    },
    schedule: {
      label: "일정",
      database: {
        id: "schedule",
        name: "일정 DB",
        description: "교육 회차와 주요 운영 일정을 관리합니다.",
        properties: [
          { name: "일정명", type: "제목", description: "회차 또는 운영 일정 이름" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "일시", type: "날짜", description: "시작·종료 일시" },
          { name: "일정 유형", type: "선택", description: "교육 / 과제 / 평가 / 운영" },
          { name: "완료", type: "체크박스", description: "일정 완료 여부" },
          { name: "완료 값", type: "수식", description: "완료이면 1, 미완료이면 0" }
        ]
      },
      overviewProperties: [
        { name: "교육 일정", type: "관계형", description: "일정 DB 연결" },
        { name: "전체 일정 수", type: "롤업", description: "교육 일정 → 일정명 → 모두 세기" },
        { name: "완료 일정 수", type: "롤업", description: "교육 일정 → 완료 값 → 합계" },
        { name: "교육 진행률", type: "수식", description: "완료 일정 수 ÷ 전체 일정 수 × 100" }
      ],
      kpi: { title: "교육 진행률", description: "전체 일정 중 완료된 일정의 비율" },
      management: { title: "일정 관리", description: "날짜순 캘린더와 완료 여부로 전체 교육 흐름을 확인합니다." }
    },
    assignments: {
      label: "과제",
      database: {
        id: "assignments",
        name: "과제 DB",
        description: "교육 과제와 제출·검토 상태를 관리합니다.",
        properties: [
          { name: "과제명", type: "제목", description: "과제 이름" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "교육생", type: "관계형", description: "교육생 DB를 선택한 경우 제출 대상과 연결" },
          { name: "마감일", type: "날짜", description: "제출 마감일" },
          { name: "제출 상태", type: "선택", description: "미제출 / 제출 / 검토 완료" },
          { name: "제출 여부 값", type: "수식", description: "제출 또는 검토 완료이면 1" }
        ]
      },
      overviewProperties: [
        { name: "과제", type: "관계형", description: "과제 DB 연결" },
        { name: "제출 과제 수", type: "롤업", description: "과제 → 제출 여부 값 → 합계" }
      ],
      kpi: { title: "과제 제출 현황", description: "미제출·제출·검토 완료 상태 요약" },
      management: { title: "과제 관리", description: "마감일과 제출 상태를 기준으로 미제출 과제를 확인합니다." }
    },
    evaluations: {
      label: "평가",
      database: {
        id: "evaluations",
        name: "평가 DB",
        description: "평가 항목과 교육생별 결과를 관리합니다.",
        properties: [
          { name: "평가 기록", type: "제목", description: "평가명과 대상 식별" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "교육생", type: "관계형", description: "교육생 DB를 선택한 경우 평가 대상과 연결" },
          { name: "평가일", type: "날짜", description: "평가 시행일" },
          { name: "점수", type: "숫자", description: "평가 점수" },
          { name: "평가 결과", type: "선택", description: "통과 / 재평가" }
        ]
      },
      overviewProperties: [
        { name: "평가 기록", type: "관계형", description: "평가 DB 연결" },
        { name: "평균 평가 점수", type: "롤업", description: "평가 기록 → 점수 → 평균" }
      ],
      kpi: { title: "평균 평가 점수", description: "연결된 평가 기록의 평균 점수" },
      management: { title: "평가 관리", description: "평가 점수와 통과 여부를 교육생별로 확인합니다." }
    },
    completion: {
      label: "수료",
      database: {
        id: "completion",
        name: "수료 DB",
        description: "교육생별 수료 조건과 최종 판정을 관리합니다.",
        properties: [
          { name: "수료 기록", type: "제목", description: "교육생별 수료 판정 기록" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "교육생", type: "관계형", description: "교육생 DB를 선택한 경우 교육생과 연결" },
          { name: "출석률", type: "숫자", description: "검토한 최종 출석률" },
          { name: "평가 점수", type: "숫자", description: "검토한 최종 평가 점수" },
          { name: "수료 상태", type: "선택", description: "검토 중 / 수료 / 미수료" }
        ]
      },
      overviewProperties: [
        { name: "수료 기록", type: "관계형", description: "수료 DB 연결" }
      ],
      kpi: { title: "수료 현황", description: "수료·미수료·검토 중 인원 요약" },
      management: { title: "수료 관리", description: "기준 충족 여부를 검토한 뒤 최종 수료 상태를 확정합니다." }
    },
    instructors: {
      label: "강사",
      database: {
        id: "instructors",
        name: "강사 DB",
        description: "강사 정보와 담당 교육 일정을 관리합니다.",
        properties: [
          { name: "강사명", type: "제목", description: "강사 식별 이름" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "담당 일정", type: "관계형", description: "일정 DB를 선택한 경우 담당 회차와 연결" },
          { name: "전문 분야", type: "다중 선택", description: "강의 분야" },
          { name: "연락 상태", type: "선택", description: "섭외 중 / 확정 / 안내 완료" }
        ]
      },
      overviewProperties: [
        { name: "강사", type: "관계형", description: "강사 DB 연결" }
      ],
      kpi: { title: "강사 확정 현황", description: "섭외·확정·안내 완료 상태 요약" },
      management: { title: "강사 관리", description: "강사별 담당 일정과 섭외 상태를 확인합니다." }
    },
    supplies: {
      label: "운영 물품",
      database: {
        id: "supplies",
        name: "운영 물품 DB",
        description: "교육 운영에 필요한 물품의 준비 상태를 관리합니다.",
        properties: [
          { name: "물품명", type: "제목", description: "준비할 물품 이름" },
          { name: "교육", type: "관계형", description: "교육 개요 DB와 연결" },
          { name: "필요 수량", type: "숫자", description: "필요한 전체 수량" },
          { name: "준비 수량", type: "숫자", description: "현재 준비된 수량" },
          { name: "준비 상태", type: "선택", description: "준비 전 / 준비 중 / 완료" },
          { name: "부족 수량", type: "수식", description: "필요 수량에서 준비 수량을 뺀 값" }
        ]
      },
      overviewProperties: [
        { name: "운영 물품", type: "관계형", description: "운영 물품 DB 연결" }
      ],
      kpi: { title: "물품 준비 현황", description: "준비 전·진행 중·완료 물품 요약" },
      management: { title: "운영 물품 관리", description: "필요 수량과 준비 수량을 비교해 부족 물품을 확인합니다." }
    }
  };

  const formulas = {
    attendanceValue: {
      id: "attendance-value",
      title: "출석 값",
      database: "출결 DB",
      description: "출결 상태가 ‘출석’이면 1을 반환해 교육 개요 DB에서 합계로 롤업합니다.",
      references: ["출결 상태"],
      formula: 'if(prop("출결 상태") == "출석", 1, 0)'
    },
    attendanceRate: {
      id: "attendance-rate",
      title: "출석률",
      database: "교육 개요 DB",
      description: "전체 출결 건수가 0일 때 오류를 피하고 출석 비율을 백분율 숫자로 계산합니다.",
      references: ["출석 건수", "전체 출결 건수"],
      formula: 'if(prop("전체 출결 건수") == 0, 0, round(prop("출석 건수") / prop("전체 출결 건수") * 100))'
    },
    scheduleValue: {
      id: "schedule-value",
      title: "완료 값",
      database: "일정 DB",
      description: "완료 체크 여부를 롤업 합계에 사용할 숫자로 바꿉니다.",
      references: ["완료"],
      formula: 'if(prop("완료"), 1, 0)'
    },
    progressRate: {
      id: "progress-rate",
      title: "교육 진행률",
      database: "교육 개요 DB",
      description: "전체 일정 중 완료된 일정의 비율을 백분율 숫자로 계산합니다.",
      references: ["완료 일정 수", "전체 일정 수"],
      formula: 'if(prop("전체 일정 수") == 0, 0, round(prop("완료 일정 수") / prop("전체 일정 수") * 100))'
    },
    assignmentValue: {
      id: "assignment-value",
      title: "제출 여부 값",
      database: "과제 DB",
      description: "제출 또는 검토 완료 상태를 제출한 과제로 계산합니다.",
      references: ["제출 상태"],
      formula: 'if(or(prop("제출 상태") == "제출", prop("제출 상태") == "검토 완료"), 1, 0)'
    },
    supplyShortage: {
      id: "supply-shortage",
      title: "부족 수량",
      database: "운영 물품 DB",
      description: "필요 수량보다 준비 수량이 많아도 음수가 나오지 않게 부족 수량을 계산합니다.",
      references: ["필요 수량", "준비 수량"],
      formula: 'max(prop("필요 수량") - prop("준비 수량"), 0)'
    }
  };

  window.MOCK_DASHBOARD_DATA = {
    overviewProperties,
    modules,
    formulas,
    basicOrder: ["students", "attendance", "schedule"],
    additionalOrder: ["assignments", "evaluations", "completion", "instructors", "supplies"],
    guideSteps: [
      {
        title: "교육용 노션 페이지 준비",
        description: "새 교육 전용 페이지를 만들고 교육명, 운영 기간, 담당자 등 기본 설명을 작성합니다."
      },
      {
        title: "데이터베이스 생성",
        description: "설계안의 DB 목록을 따라 교육 개요 DB부터 선택한 관리 항목의 DB까지 각각 생성합니다."
      },
      {
        title: "속성 설정",
        description: "각 DB 표에 제시된 속성명과 유형을 추가합니다. 실제 운영 규칙에 맞지 않는 항목은 적용 전에 검토합니다."
      },
      {
        title: "관계형·롤업 연결",
        description: "교육 개요 DB를 중심으로 개별 DB를 관계형으로 연결하고, 안내된 대상 속성과 계산 방식을 선택합니다."
      },
      {
        title: "수식 적용",
        description: "참조 속성명이 설계안과 같은지 확인한 뒤 복사한 예시 수식을 해당 수식 속성에 붙여 넣습니다."
      },
      {
        title: "메인 KPI와 상세 영역 구성",
        description: "페이지 상단에는 KPI를, 아래에는 DB의 필터된 보기와 캘린더·목록 보기를 배치해 운영 화면을 완성합니다."
      }
    ]
  };
})();
