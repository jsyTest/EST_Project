(function () {
  "use strict";

  // The CDN owns window.supabase; the application client uses a separate name.
  if (window.supabaseClient) return;

  const supabaseUrl = "https://pxkjxcryceqtjomgxyfe.supabase.co";
  const supabasePublishableKey = "sb_publishable_pB4tyyiFnwVARzTf0qG1sw_lpvuc7E-";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.warn("Supabase SDK를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.");
    return;
  }

  try {
    const supabaseClient = window.supabase.createClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "implicit"
        }
      }
    );

    window.supabaseClient = supabaseClient;
    // A request-scoped data client uses the captured user's JWT without creating another Auth session.
    window.createEducationDataClient = function (accessToken) {
      return window.supabase.createClient(supabaseUrl, supabasePublishableKey, {
        accessToken: async function () { return accessToken; }
      });
    };
  } catch {
    console.warn("Supabase 클라이언트를 초기화하지 못했습니다. 인증 화면에서 다시 시도해 주세요.");
  }
})();
