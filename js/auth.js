(function () {
  "use strict";
  const state = window.estAuth;
  const core = window.ESTAuthCore;
  if (!state || state.started) return;
  state.started = true;
  const html = document.documentElement;
  const protectedPage = html.dataset.authRequired === "true";
  const loginPage = html.dataset.authPage === "true";
  const byId = function (id) { return document.getElementById(id); };
  const client = window.supabaseClient;
  let authenticatedUser = null;
  let formBusy = false;
  let mode = new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "signin";
  let logoutButton;
  let accountEmail;
  let accountError;
  let controller;
  let initialCheck = true;

  function showMessage(text, success) {
    const node = byId(loginPage ? "auth-message" : "auth-gate-message");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("success", Boolean(success));
  }

  function setFormBusy(busy) {
    formBusy = busy;
    if (!loginPage) return;
    byId("auth-form").setAttribute("aria-busy", String(busy));
    byId("auth-form").querySelectorAll("input, button").forEach(function (node) { node.disabled = busy; });
    byId("auth-switch").disabled = busy;
    byId("auth-submit").textContent = busy ? "처리 중…" : mode === "signup" ? "회원가입" : "로그인";
  }

  function clearPasswords() {
    if (!loginPage) return;
    ["auth-password", "auth-confirmation"].forEach(function (id) {
      byId(id).value = "";
      byId(id).type = "password";
    });
    document.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      button.textContent = "표시";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", button.dataset.passwordToggle === "auth-password" ? "비밀번호 표시" : "비밀번호 확인 표시");
    });
  }

  function clearSensitiveUI() {
    window.dispatchEvent(new Event("est-auth-cleared"));
    document.querySelectorAll("[data-auth-content] input, [data-auth-content] textarea").forEach(function (input) { input.value = ""; });
    document.querySelectorAll("main[data-auth-content]").forEach(function (main) { main.replaceChildren(); });
    if (accountEmail) accountEmail.textContent = "";
  }

  function cleanCallbackUrl() {
    if (!state.isCallback) return;
    const url = new URL(window.location.href);
    url.hash = "";
    ["code", "error", "error_code", "error_description", "confirmed"].forEach(function (key) { url.searchParams.delete(key); });
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  function fail(error) {
    clearTimeout(state.watchdog);
    cleanCallbackUrl();
    html.dataset.authState = "error";
    showMessage(core ? core.errorMessage(error) : "인증 파일을 불러오지 못했습니다. 새로고침해 주세요.");
    const retry = byId("auth-retry");
    if (retry) retry.hidden = false;
    if (loginPage) setFormBusy(true);
  }

  function handleSession(session) {
    clearTimeout(state.watchdog);
    cleanCallbackUrl();
    const valid = core.hasSession(session);
    const userId = valid ? session.user.id : null;
    try { core.syncDraftOwner(window.sessionStorage, userId); }
    catch { fail({ code: "storage_unavailable" }); return; }

    if (!valid) {
      const wasAuthenticated = authenticatedUser !== null;
      authenticatedUser = null;
      html.dataset.authState = "anonymous";
      if (protectedPage) {
        clearSensitiveUI();
        state.settle(false);
        window.location.replace(core.pageUrl("login.html", window.location.href));
        return;
      }
      if (loginPage) {
        setFormBusy(false);
        if (state.callbackError) showMessage(core.errorMessage({ code: state.callbackError }));
        else if (initialCheck && state.isCallback) showMessage("인증 후 로그인 상태를 확인하지 못했습니다. 이메일과 비밀번호로 로그인해 주세요.");
        else if (initialCheck) showMessage("");
        else if (wasAuthenticated) showMessage("로그아웃되었습니다.", true);
      }
      initialCheck = false;
      return;
    }

    if (authenticatedUser && authenticatedUser !== userId) {
      html.dataset.authState = "checking";
      clearSensitiveUI();
      window.location.replace(core.pageUrl("index.html", window.location.href));
      return;
    }
    authenticatedUser = userId;
    if (loginPage) {
      if (state.callbackError) {
        showMessage(core.errorMessage({ code: state.callbackError }));
        setFormBusy(false);
        return;
      }
      clearPasswords();
      showMessage("로그인되었습니다. 메인 화면으로 이동합니다.", true);
      window.location.replace(core.pageUrl("index.html", window.location.href));
      return;
    }
    if (accountEmail) accountEmail.textContent = session.user.email || "로그인된 계정";
    html.dataset.authState = "authenticated";
    state.settle(true);
    initialCheck = false;
  }

  function renderMode() {
    const signup = mode === "signup";
    byId("auth-title").textContent = signup ? "회원가입" : "로그인";
    document.title = (signup ? "회원가입" : "로그인") + " | AI 노션 빌더";
    byId("auth-description").textContent = signup ? "이메일 계정을 만들고 교육 운영 설계를 시작하세요." : "이메일로 로그인하고 교육 운영 설계를 이어가세요.";
    byId("confirmation-field").hidden = !signup;
    byId("auth-confirmation").required = signup;
    byId("auth-password").autocomplete = signup ? "new-password" : "current-password";
    byId("password-help").textContent = signup ? "8자 이상 입력해 주세요. 프로젝트의 추가 비밀번호 정책도 적용됩니다." : "비밀번호는 안전하게 인증 서버로 전송됩니다.";
    byId("auth-switch").textContent = signup ? "이미 계정이 있나요? 로그인" : "처음이신가요? 회원가입";
    ["email", "password", "confirmation"].forEach(function (field) {
      byId("auth-" + field).removeAttribute("aria-invalid");
      byId("auth-" + field + "-error").textContent = "";
    });
    clearPasswords();
    setFormBusy(formBusy);
  }

  function initializeForm() {
    renderMode();
    byId("auth-switch").addEventListener("click", function () {
      if (formBusy) return;
      mode = mode === "signin" ? "signup" : "signin";
      const url = new URL(window.location.href);
      if (mode === "signup") url.searchParams.set("mode", "signup"); else url.searchParams.delete("mode");
      window.history.replaceState(null, "", url.pathname + url.search);
      showMessage("");
      renderMode();
    });
    document.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        const input = byId(button.dataset.passwordToggle);
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        button.textContent = visible ? "숨기기" : "표시";
        button.setAttribute("aria-pressed", String(visible));
        button.setAttribute("aria-label", (input.id === "auth-password" ? "비밀번호 " : "비밀번호 확인 ") + (visible ? "숨기기" : "표시"));
      });
    });
    byId("auth-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (formBusy || !controller) return;
      const email = byId("auth-email").value.trim();
      const errors = core.validateCredentials(mode, email, byId("auth-password").value, byId("auth-confirmation").value);
      let firstInvalid;
      ["email", "password", "confirmation"].forEach(function (field) {
        const input = byId("auth-" + field);
        byId("auth-" + field + "-error").textContent = errors[field] || "";
        if (errors[field]) { input.setAttribute("aria-invalid", "true"); firstInvalid = firstInvalid || input; }
        else input.removeAttribute("aria-invalid");
      });
      if (firstInvalid) { firstInvalid.focus(); return; }
      state.callbackError = null;
      state.isCallback = false;
      setFormBusy(true);
      showMessage(mode === "signup" ? "가입 요청을 처리하고 있습니다." : "로그인하고 있습니다.");
      try {
        const result = mode === "signup"
          ? await controller.signUp(email, byId("auth-password").value, core.confirmationUrl(window.location.href))
          : await controller.signIn(email, byId("auth-password").value);
        if (result.error) showMessage(core.errorMessage(result.error, mode));
        else if (mode === "signup" && !core.hasSession(result.data && result.data.session)) {
          showMessage("가입 요청을 처리했습니다. 이메일 인증이 필요한 경우 받은 메일의 링크를 확인한 뒤 로그인해 주세요. 이미 가입했다면 로그인 화면을 이용해 주세요.", true);
        }
      } catch (error) { showMessage(core.errorMessage(error, mode)); }
      finally { clearPasswords(); setFormBusy(false); }
    });
  }

  function initializeAccount() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const account = document.createElement("div");
    account.className = "auth-account";
    accountEmail = document.createElement("span");
    accountEmail.className = "auth-account-email";
    logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "button button-quiet";
    logoutButton.textContent = "로그아웃";
    accountError = document.createElement("p");
    accountError.className = "auth-account-error";
    accountError.setAttribute("role", "status");
    account.append(accountEmail, logoutButton, accountError);
    header.append(account);
    logoutButton.addEventListener("click", async function () {
      if (logoutButton.disabled) return;
      logoutButton.disabled = true;
      logoutButton.textContent = "로그아웃 중…";
      accountError.textContent = "";
      const result = await controller.signOut();
      if (result.error) {
        accountError.textContent = core.errorMessage(result.error, "signout");
        logoutButton.disabled = false;
        logoutButton.textContent = "로그아웃";
      }
    });
  }

  async function checkSession() {
    html.dataset.authState = "checking";
    showMessage("로그인 상태를 확인하고 있습니다.");
    if (loginPage) setFormBusy(true);
    try { await controller.refresh(); }
    catch (error) { fail(error); }
  }

  const retry = byId("auth-retry");
  if (retry) retry.onclick = function () { window.location.reload(); };
  if (!core || !client || !client.auth) { fail({ code: "sdk_unavailable" }); return; }
  controller = core.createController({ client: client, onSession: handleSession });
  if (loginPage) { initializeForm(); setFormBusy(true); }
  if (protectedPage) initializeAccount();
  checkSession();
  window.addEventListener("pagehide", function (event) {
    if (protectedPage) html.dataset.authState = "checking";
    clearPasswords();
    if (!event.persisted) controller.dispose();
  });
  window.addEventListener("pageshow", function (event) { if (event.persisted) checkSession(); });
})();
