(function (root) {
  "use strict";
  const MIN_PASSWORD_LENGTH = 8;
  const OWNER_KEY = "estAuthDraftOwner";
  const DRAFT_KEY = "aiNotionBuilderRequirements";

  function hasSession(session) {
    return Boolean(session && session.access_token && session.user && session.user.id);
  }

  function validateCredentials(mode, email, password, confirmation) {
    const errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
      errors.email = "올바른 이메일 주소를 입력해 주세요.";
    }
    if (!password) errors.password = "비밀번호를 입력해 주세요.";
    else if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = "회원가입 비밀번호는 8자 이상 입력해 주세요.";
    }
    if (mode === "signup" && password !== confirmation) errors.confirmation = "비밀번호 확인이 일치하지 않습니다.";
    return errors;
  }

  function errorMessage(error, operation) {
    const code = error && error.code;
    if (code === "request_in_progress") return "요청을 처리하고 있습니다. 잠시 기다려 주세요.";
    if (code === "sdk_unavailable") return "인증 연결을 준비하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.";
    if (code === "storage_unavailable") return "브라우저 저장소를 사용할 수 없습니다. 사이트 저장소를 허용한 뒤 다시 시도해 주세요.";
    if (code === "otp_expired" || code === "callback_error") return "인증 링크가 만료되었거나 유효하지 않습니다. 로그인하거나 회원가입 화면에서 다시 진행해 주세요.";
    if (code === "email_not_confirmed") return "이메일 인증을 먼저 완료한 뒤 로그인해 주세요.";
    if (code === "weak_password") return "프로젝트의 비밀번호 정책을 충족하지 못했습니다. 더 긴 비밀번호와 다양한 문자를 사용해 주세요.";
    if (code === "signup_disabled") return "현재 회원가입을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    if (error && (error.status === 429 || /rate_limit|too_many_requests/.test(code || ""))) return "요청이 너무 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.";
    if (error && (error.name === "AuthRetryableFetchError" || error.name === "TypeError" || error.name === "AbortError" || code === "network_error")) return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
    if (error && error.status >= 500) return "인증 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.";
    if (operation === "signout") return "로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.";
    if (operation === "signup") return "가입 요청을 완료하지 못했습니다. 입력 정보를 확인하거나 잠시 후 다시 시도해 주세요.";
    if (code === "invalid_credentials" || (error && error.status === 400)) return "이메일 또는 비밀번호를 확인해 주세요.";
    return "인증 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  function syncDraftOwner(storage, userId) {
    const previous = storage.getItem(OWNER_KEY);
    const changed = previous !== (userId || null);
    if (!userId || changed) storage.removeItem(DRAFT_KEY);
    if (userId) storage.setItem(OWNER_KEY, userId);
    else storage.removeItem(OWNER_KEY);
    return { changed: changed, previous: previous };
  }

  function pageUrl(path, href) {
    const url = new URL(path, href);
    if (!/^https?:$/.test(url.protocol)) throw { code: "unsupported_origin" };
    return url.href;
  }

  function confirmationUrl(href) {
    const url = new URL(pageUrl("login.html", href));
    url.search = "?confirmed=1";
    url.hash = "";
    return url.href;
  }

  function createController(options) {
    const client = options.client;
    const onSession = options.onSession || function () {};
    const schedule = options.schedule || function (fn) { setTimeout(fn, 0); };
    let subscription = null;
    let revision = 0;
    let disposed = false;
    let operation = null;
    let current = null;

    function publish(session, event) {
      if (disposed) return;
      current = hasSession(session) ? session : null;
      onSession(current, event);
    }

    function subscribe() {
      if (subscription || disposed) return;
      const result = client.auth.onAuthStateChange(function (event, session) {
        const observed = ++revision;
        if (operation === "signout" && event === "SIGNED_OUT") return;
        // Auth callbacks remain synchronous. UI work runs outside the SDK's lock.
        schedule(function () {
          if (observed !== revision || disposed) return;
          publish(session, event);
        });
      });
      subscription = result.data.subscription;
    }

    async function refresh() {
      if (!client || !client.auth) throw { code: "sdk_unavailable" };
      subscribe();
      const observed = revision;
      const result = await client.auth.getSession();
      if (result.error) throw result.error;
      if (!disposed && observed === revision) publish(result.data.session, "SESSION_CHECK");
      return current;
    }

    async function perform(name, request) {
      if (operation) return { data: null, error: { code: "request_in_progress" } };
      operation = name;
      try {
        const result = await request();
        if (result.error) return result;
        if (name === "signout") { revision++; publish(null, "SIGNED_OUT"); }
        else if (hasSession(result.data && result.data.session)) {
          revision++; publish(result.data.session, "SIGNED_IN");
        } else if (name === "signin") return { data: null, error: { code: "session_missing" } };
        return result;
      } catch (error) {
        return { data: null, error: error };
      } finally { operation = null; }
    }

    return {
      refresh: refresh,
      signIn: function (email, password) {
        return perform("signin", function () { return client.auth.signInWithPassword({ email: email, password: password }); });
      },
      signUp: function (email, password, redirect) {
        return perform("signup", function () { return client.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirect } }); });
      },
      signOut: function () {
        return perform("signout", function () { return client.auth.signOut({ scope: "local" }); });
      },
      dispose: function () {
        disposed = true;
        if (subscription) subscription.unsubscribe();
        subscription = null;
      }
    };
  }

  root.ESTAuthCore = {
    MIN_PASSWORD_LENGTH: MIN_PASSWORD_LENGTH,
    hasSession: hasSession,
    validateCredentials: validateCredentials,
    errorMessage: errorMessage,
    syncDraftOwner: syncDraftOwner,
    pageUrl: pageUrl,
    confirmationUrl: confirmationUrl,
    createController: createController
  };
})(typeof window !== "undefined" ? window : globalThis);
