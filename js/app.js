(function () {
  "use strict";

  const STORAGE_KEY = "aiNotionBuilderRequirements";
  const page = document.body.dataset.page;
  const data = window.MOCK_DASHBOARD_DATA;
  let toastTimer;
  let currentDesign = null;
  let drafts = null;

  function readSavedRequirements() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
          || typeof parsed.educationName !== "string" || !parsed.educationName.trim()
          || !Array.isArray(parsed.basicItems) || !Array.isArray(parsed.additionalItems)
          || !parsed.basicItems.every((id) => data.basicOrder.includes(id))
          || !parsed.additionalItems.every((id) => data.additionalOrder.includes(id))) return null;
      return {
        educationName: parsed.educationName,
        purpose: typeof parsed.purpose === "string" ? parsed.purpose : "",
        requirements: typeof parsed.requirements === "string" ? parsed.requirements : "",
        basicItems: parsed.basicItems,
        additionalItems: parsed.additionalItems
      };
    } catch (error) {
      return null;
    }
  }

  function saveRequirements(requirements) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(requirements));
      return true;
    } catch {
      return false;
    }
  }

  function selectedValues(form, name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(
      (input) => input.value
    );
  }

  function initializeInputPage() {
    const form = document.getElementById("requirement-form");
    const educationName = document.getElementById("education-name");
    const nameError = document.getElementById("education-name-error");
    const saveError = document.getElementById("requirement-save-error");
    const saved = drafts ? drafts.snapshot().configuration.requirements : readSavedRequirements();

    if (saved) {
      educationName.value = saved.educationName || "";
      form.elements.purpose.value = saved.purpose || "";
      form.elements.requirements.value = saved.requirements || "";
      restoreCheckboxes(form, "basicItems", saved.basicItems);
      restoreCheckboxes(form, "additionalItems", saved.additionalItems);
    }

    function captureRequirements() {
      return {
        educationName: educationName.value,
        purpose: form.elements.purpose.value,
        requirements: form.elements.requirements.value,
        basicItems: selectedValues(form, "basicItems"),
        additionalItems: selectedValues(form, "additionalItems")
      };
    }
    if (drafts) {
      drafts.register('requirements', captureRequirements);
      const update = function () {
        try { drafts.update('requirements', captureRequirements()); }
        catch (error) { drafts.showError(error); }
      };
      form.addEventListener('input', update);
      form.addEventListener('change', update);
    }

    educationName.addEventListener("input", function () {
      educationName.removeAttribute("aria-invalid");
      nameError.textContent = "";
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      saveError.textContent = "";
      const name = educationName.value.trim();

      if (!name) {
        educationName.setAttribute("aria-invalid", "true");
        nameError.textContent = "교육명을 입력한 뒤 설계를 생성해 주세요.";
        educationName.focus();
        return;
      }

      const requirements = {
        educationName: name,
        purpose: form.elements.purpose.value.trim(),
        requirements: form.elements.requirements.value.trim(),
        basicItems: selectedValues(form, "basicItems"),
        additionalItems: selectedValues(form, "additionalItems")
      };

      if (!saveRequirements(requirements)) {
        saveError.textContent = "입력 내용을 브라우저에 저장하지 못했습니다. 사이트 저장소를 허용하거나 여유 공간을 확인한 뒤 다시 시도해 주세요.";
        return;
      }
      if (drafts) drafts.update('requirements', requirements);
      window.location.href = "result.html";
    });
  }

  function restoreCheckboxes(form, name, values) {
    if (!Array.isArray(values)) return;
    form.querySelectorAll(`input[name="${name}"]`).forEach(function (input) {
      input.checked = values.includes(input.value);
    });
  }

  function createElement(tag, options) {
    const element = document.createElement(tag);
    const config = options || {};

    if (config.className) element.className = config.className;
    if (config.text !== undefined) element.textContent = config.text;
    if (config.attributes) {
      Object.entries(config.attributes).forEach(function ([name, value]) {
        element.setAttribute(name, value);
      });
    }
    return element;
  }

  function buildDesign(requirements) {
    const selectedIds = [
      ...data.basicOrder.filter((id) => requirements.basicItems.includes(id)),
      ...data.additionalOrder.filter((id) => requirements.additionalItems.includes(id))
    ];
    const modules = selectedIds.map((id) => data.modules[id]);
    const overview = {
      id: "overview",
      name: "교육 개요 DB",
      description: "해당 교육의 기준 정보와 메인 KPI용 집계 속성을 관리합니다.",
      properties: data.overviewProperties.slice()
    };

    modules.forEach(function (module) {
      if (module.overviewRelation) overview.properties.push(module.overviewRelation);
      if (module.overviewProperties) overview.properties.push(...module.overviewProperties);
    });

    const databases = [overview, ...modules.map((module) => cleanDatabase(module.database, requirements))];
    const relations = buildRelations(requirements, modules);
    const formulas = buildFormulas(requirements);
    const kpis = modules.map((module) => module.kpi);
    const management = modules.map((module) => module.management);

    if (kpis.length === 0) {
      kpis.push({ title: "교육 기본 정보", description: "교육명과 시작일·종료일을 우선 배치합니다." });
    }
    if (management.length === 0) {
      management.push({
        title: "교육 개요",
        description: "교육 개요 DB의 기본 속성을 표 보기로 배치하고 필요한 관리 항목을 다시 선택합니다."
      });
    }

    return {
      requirements,
      databases,
      relations,
      formulas,
      kpis,
      management,
      guideSteps: data.guideSteps
    };
  }

  function cleanDatabase(database, requirements) {
    const copy = {
      id: database.id,
      name: database.name,
      description: database.description,
      properties: database.properties.slice()
    };

    if (!requirements.basicItems.includes("students")) {
      copy.properties = copy.properties.filter((property) => property.name !== "교육생");
    }
    if (!requirements.basicItems.includes("schedule") && copy.id === "instructors") {
      copy.properties = copy.properties.filter((property) => property.name !== "담당 일정");
    }
    return copy;
  }

  function buildRelations(requirements, modules) {
    const relations = modules.map(function (module) {
      const overviewRelationName = module.overviewRelation
        ? module.overviewRelation.name
        : module.overviewProperties[0].name;
      return {
        title: `교육 개요 DB ↔ ${module.database.name}`,
        description: `교육 개요 DB에서 ‘${overviewRelationName}’ 관계형 속성을 만들고 ${module.database.name}을 연결합니다. 각 ${module.database.name}의 ‘교육’ 속성에는 해당 교육 개요 항목을 지정합니다.`
      };
    });

    if (requirements.basicItems.includes("attendance")) {
      relations.push({
        title: "출석률 롤업 설정",
        description: "교육 개요 DB의 ‘전체 출결 건수’는 출결 기록을 모두 세고, ‘출석 건수’는 출결 DB의 ‘출석 값’을 합계로 집계합니다."
      });
    }
    if (requirements.basicItems.includes("schedule")) {
      relations.push({
        title: "교육 진행률 롤업 설정",
        description: "교육 개요 DB의 ‘전체 일정 수’는 일정명을 모두 세고, ‘완료 일정 수’는 일정 DB의 ‘완료 값’을 합계로 집계합니다."
      });
    }
    if (requirements.basicItems.includes("students")) {
      ["attendance", "assignments", "evaluations", "completion"].forEach(function (id) {
        const isSelected = requirements.basicItems.includes(id) || requirements.additionalItems.includes(id);
        if (isSelected) {
          relations.push({
            title: `교육생 DB ↔ ${data.modules[id].database.name}`,
            description: `${data.modules[id].database.name}의 ‘교육생’ 관계형 속성에서 교육생 DB의 대상 교육생을 연결합니다.`
          });
        }
      });
    }
    if (
      requirements.additionalItems.includes("instructors") &&
      requirements.basicItems.includes("schedule")
    ) {
      relations.push({
        title: "강사 DB ↔ 일정 DB",
        description: "강사 DB의 ‘담당 일정’ 관계형 속성에서 일정 DB의 담당 회차를 연결해 강사별 일정을 확인합니다."
      });
    }

    if (relations.length === 0) {
      relations.push({
        title: "추가 연결 없음",
        description: "현재 선택한 관리 항목이 없어 교육 개요 DB만 사용합니다. 필요한 항목을 선택하면 관계형 연결 안내가 추가됩니다."
      });
    }
    return relations;
  }

  function buildFormulas(requirements) {
    const formulas = [];
    if (requirements.basicItems.includes("attendance")) {
      formulas.push(data.formulas.attendanceValue, data.formulas.attendanceRate);
    }
    if (requirements.basicItems.includes("schedule")) {
      formulas.push(data.formulas.scheduleValue, data.formulas.progressRate);
    }
    if (requirements.additionalItems.includes("assignments")) {
      formulas.push(data.formulas.assignmentValue);
    }
    if (requirements.additionalItems.includes("supplies")) {
      formulas.push(data.formulas.supplyShortage);
    }
    return formulas;
  }

  function initializeResultPage() {
    const requirements = drafts ? drafts.snapshot().configuration.requirements : readSavedRequirements();
    const emptyState = document.getElementById("empty-state");
    const resultContent = document.getElementById("result-content");

    if (!requirements || !requirements.educationName) {
      emptyState.hidden = false;
      resultContent.hidden = true;
      return;
    }

    currentDesign = buildDesign(requirements);
    emptyState.hidden = true;
    resultContent.hidden = false;
    renderResult(currentDesign);
    bindResultActions();
  }

  function renderResult(design) {
    document.title = `${design.requirements.educationName} 설계 결과 | AI 노션 빌더`;
    document.getElementById("result-education-name").textContent = design.requirements.educationName;
    document.getElementById("result-summary").textContent =
      `${design.databases.length}개 데이터베이스와 ${design.formulas.length}개 예시 수식으로 구성된 교육별 독립 대시보드 설계 샘플입니다.`;
    document.getElementById("database-count").textContent = `총 ${design.databases.length}개 DB`;

    renderOverview(design);
    renderCards("kpi-list", design.kpis, "kpi");
    renderCards("management-list", design.management, "management");
    renderDatabases(design.databases);
    renderNumberedList("relation-list", design.relations, "relation");
    renderFormulas(design.formulas);
    renderNumberedList("guide-list", design.guideSteps, "guide");
  }

  function renderOverview(design) {
    const labels = design.requirements.basicItems.map((id) => data.modules[id].label);
    const additionalLabels = design.requirements.additionalItems.map((id) => data.modules[id].label);
    const items = [
      ["교육명", design.requirements.educationName],
      ["사용 목적", design.requirements.purpose || "입력하지 않음"],
      ["기본 관리 항목", labels.length ? labels.join(", ") : "선택하지 않음"],
      ["추가 관리 항목", additionalLabels.length ? additionalLabels.join(", ") : "선택하지 않음"],
      ["추가 요구사항", design.requirements.requirements || "입력하지 않음"],
      ["처리 방식", "선택 항목 기반 Mock 결과 · 자유 입력 의미 분석 없음"]
    ];
    const list = document.getElementById("request-overview-list");
    list.replaceChildren();

    items.forEach(function ([term, description]) {
      const wrapper = createElement("div", { className: "overview-item" });
      wrapper.append(createElement("dt", { text: term }), createElement("dd", { text: description }));
      list.append(wrapper);
    });
  }

  function renderCards(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    items.forEach(function (item, index) {
      const card = createElement("article", {
        className: type === "kpi" ? "kpi-card" : "management-card"
      });
      if (type === "kpi") {
        card.append(createElement("span", { className: "kpi-index", text: `KPI ${String(index + 1).padStart(2, "0")}` }));
      }
      card.append(createElement("h4", { text: item.title }), createElement("p", { text: item.description }));
      container.append(card);
    });
  }

  function renderDatabases(databases) {
    const container = document.getElementById("database-list");
    container.replaceChildren();

    databases.forEach(function (database, index) {
      const details = createElement("details", { className: "database-card" });
      if (index === 0) details.open = true;
      const summary = createElement("summary");
      const titleWrap = createElement("div", { className: "database-title-wrap" });
      const titleText = createElement("div");
      titleText.append(
        createElement("h3", { text: database.name }),
        createElement("p", { text: `${database.properties.length}개 속성 · ${database.description}` })
      );
      titleWrap.append(
        createElement("span", { className: "database-number", text: String(index + 1).padStart(2, "0") }),
        titleText
      );
      summary.append(titleWrap);

      const tableWrap = createElement("div", { className: "property-table-wrap" });
      const table = createElement("table", { className: "property-table" });
      const thead = createElement("thead");
      const headRow = createElement("tr");
      ["속성명", "유형", "설명"].forEach((label) => headRow.append(createElement("th", { text: label })));
      thead.append(headRow);
      const tbody = createElement("tbody");

      database.properties.forEach(function (property) {
        const row = createElement("tr");
        const nameCell = createElement("td", { text: property.name });
        const typeCell = createElement("td");
        typeCell.append(createElement("span", { className: "type-chip", text: property.type }));
        row.append(nameCell, typeCell, createElement("td", { text: property.description }));
        tbody.append(row);
      });
      table.append(thead, tbody);
      tableWrap.append(table);
      details.append(summary, tableWrap);
      container.append(details);
    });
  }

  function renderNumberedList(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.replaceChildren();
    items.forEach(function (item, index) {
      const listItem = createElement("li", { className: `${type}-item` });
      const content = createElement("div");
      content.append(createElement("h3", { text: item.title }), createElement("p", { text: item.description }));
      listItem.append(
        createElement("span", { className: "list-number", text: String(index + 1).padStart(2, "0") }),
        content
      );
      container.append(listItem);
    });
  }

  function renderFormulas(formulas) {
    const container = document.getElementById("formula-list");
    container.replaceChildren();

    if (formulas.length === 0) {
      const empty = createElement("div", { className: "formula-card" });
      empty.append(
        createElement("h3", { text: "현재 선택 항목에 필요한 예시 수식이 없습니다." }),
        createElement("p", {
          className: "formula-references",
          text: "출결, 일정, 과제 또는 운영 물품을 선택하면 관련 수식이 표시됩니다."
        })
      );
      container.append(empty);
      return;
    }

    formulas.forEach(function (formula) {
      const card = createElement("article", { className: "formula-card" });
      const header = createElement("div", { className: "formula-header" });
      const text = createElement("div");
      text.append(
        createElement("h3", { text: `${formula.database} · ${formula.title}` }),
        createElement("p", { text: formula.description })
      );
      const button = createElement("button", {
        className: "button button-secondary formula-copy-button",
        text: "수식 복사",
        attributes: { type: "button", "data-formula-id": formula.id }
      });
      header.append(text, button);
      card.append(
        header,
        createElement("code", { className: "formula-code", text: formula.formula }),
        createElement("p", {
          className: "formula-references",
          text: `참조 속성: ${formula.references.join(", ")}`
        })
      );
      container.append(card);
    });
  }

  function bindResultActions() {
    ["copy-all-button", "copy-all-button-bottom"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", copyFullDesign);
    });
    ["edit-button", "edit-button-bottom"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", function () {
        window.location.href = "index.html";
      });
    });
    document.getElementById("regenerate-button").addEventListener("click", function () {
      currentDesign = buildDesign(currentDesign.requirements);
      renderResult(currentDesign);
      bindFormulaCopyButtons();
      showToast("현재 입력값으로 Mock 설계를 다시 생성했습니다.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    bindFormulaCopyButtons();
  }

  function bindFormulaCopyButtons() {
    document.querySelectorAll(".formula-copy-button").forEach(function (button) {
      button.addEventListener("click", function () {
        const formula = currentDesign.formulas.find(
          (item) => item.id === button.dataset.formulaId
        );
        if (!formula || !formula.formula) {
          showToast("복사할 수식이 없습니다.", true);
          return;
        }
        copyText(formula.formula).then(function (success) {
          showToast(success ? `‘${formula.title}’ 수식을 복사했습니다.` : "수식을 복사하지 못했습니다.", !success);
        });
      });
    });
  }

  function copyFullDesign() {
    if (!currentDesign) {
      showToast("복사할 설계 결과가 없습니다.", true);
      return;
    }
    const text = designToText(currentDesign);
    if (!text.trim()) {
      showToast("복사할 설계 결과가 없습니다.", true);
      return;
    }
    copyText(text).then(function (success) {
      showToast(success ? "전체 설계 결과를 복사했습니다." : "설계 결과를 복사하지 못했습니다.", !success);
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textarea = createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }

  function showToast(message, isError) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function designToText(design) {
    const req = design.requirements;
    const basic = req.basicItems.map((id) => data.modules[id].label).join(", ") || "선택하지 않음";
    const additional = req.additionalItems.map((id) => data.modules[id].label).join(", ") || "선택하지 않음";
    const lines = [
      `[${req.educationName} 노션 대시보드 설계안]`,
      "※ 선택 항목 기반 Mock 샘플입니다. 노션 적용 전 검토해 주세요.",
      "",
      "1. 입력 요구사항",
      `- 교육명: ${req.educationName}`,
      `- 사용 목적: ${req.purpose || "입력하지 않음"}`,
      `- 기본 관리 항목: ${basic}`,
      `- 추가 관리 항목: ${additional}`,
      `- 추가 요구사항: ${req.requirements || "입력하지 않음"}`,
      "- 처리 방식: 자유 입력 의미 분석 없이 선택 항목에 따라 구성된 Mock 결과",
      "",
      "2. 메인 KPI 제안"
    ];

    design.kpis.forEach((item) => lines.push(`- ${item.title}: ${item.description}`));
    lines.push("", "3. 상세 운영 관리 영역");
    design.management.forEach((item) => lines.push(`- ${item.title}: ${item.description}`));
    lines.push("", "4. 데이터베이스 설계");
    design.databases.forEach(function (database) {
      lines.push(`\n[${database.name}] ${database.description}`);
      database.properties.forEach(function (property) {
        lines.push(`- ${property.name} (${property.type}): ${property.description}`);
      });
    });
    lines.push("", "5. 관계형·롤업 설정");
    design.relations.forEach((item, index) => lines.push(`${index + 1}. ${item.title}: ${item.description}`));
    lines.push("", "6. 계산 수식");
    if (design.formulas.length === 0) lines.push("- 현재 선택 항목에 필요한 예시 수식 없음");
    design.formulas.forEach(function (formula) {
      lines.push(
        `\n[${formula.database} · ${formula.title}]`,
        `설명: ${formula.description}`,
        `참조 속성: ${formula.references.join(", ")}`,
        `수식: ${formula.formula}`
      );
    });
    lines.push("", "7. 노션 구축 가이드");
    design.guideSteps.forEach((step, index) => lines.push(`${index + 1}. ${step.title}: ${step.description}`));
    return lines.join("\n");
  }

  async function initializePage() {
    if (window.estDraftsReady) drafts = await window.estDraftsReady;
    if (document.documentElement?.dataset.authRequired === "true" && document.documentElement.dataset.authState !== "authenticated") return;
    if (page === "input") initializeInputPage();
    if (page === "result") initializeResultPage();
    window.addEventListener?.("est-auth-cleared", function () { currentDesign = null; }, { once: true });
  }

  if (document.documentElement?.dataset.authRequired === "true") {
    window.estAuth?.ready.then(function (authenticated) {
      if (authenticated && document.documentElement.dataset.authState === "authenticated") initializePage();
    });
  } else initializePage();
})();
