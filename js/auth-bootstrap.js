(function () {
  "use strict";
  if (window.estAuth) return;

  let settle;
  let settled = false;
  const ready = new Promise(function (resolve) { settle = resolve; });
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const hasError = hash.has("error") || hash.has("error_code") || query.has("error") || query.has("error_code");
  const code = hash.get("error_code") || query.get("error_code");
  // Keep only a safe error category; never retain the token or raw error description.
  window.estAuth = {
    ready: ready,
    callbackError: hasError ? (code === "otp_expired" ? "otp_expired" : "callback_error") : null,
    isCallback: hash.has("access_token") || query.has("code") || query.get("confirmed") === "1" || hasError,
    settle: function (authenticated) {
      if (!settled) { settled = true; settle(authenticated === true); }
    }
  };
  window.estAuth.watchdog = setTimeout(function () {
    if (document.documentElement.dataset.authState !== "checking") return;
    document.documentElement.dataset.authState = "error";
    const message = document.getElementById("auth-message") || document.getElementById("auth-gate-message");
    if (message) message.textContent = "인증 연결이 지연되고 있습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    const retry = document.getElementById("auth-retry");
    if (retry) {
      retry.hidden = false;
      retry.onclick = function () { window.location.reload(); };
    }
  }, 20000);
})();
