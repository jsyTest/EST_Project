(function (root) {
  'use strict';
  // Display state comes only from the server, never from client metadata or storage.
  root.PPLUSAdminAccess = {
    create: function ({fetchImpl, onClear, onResult}) {
      let revision = 0, pending = null;
      function clear() {
        revision++;
        if (pending) pending.abort();
        pending = null;
        onClear();
      }
      return {
        clear: clear,
        async refresh(session) {
          clear();
          if (!session || !session.access_token || !session.user || !session.user.id) return;
          const observed = revision, abort = new AbortController();
          pending = abort;
          const timeout = setTimeout(function () { abort.abort(); }, 8000);
          try {
            const response = await fetchImpl('/api/admin/overview', {
              method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: abort.signal,
              headers: {Authorization: 'Bearer ' + session.access_token, Accept: 'application/json'}
            });
            if (observed !== revision || abort.signal.aborted) return;
            if (response.status === 403) { onResult({state: 'denied'}); return; }
            if (!response.ok) throw new Error('role_unavailable');
            const body = await response.json();
            if (observed !== revision || abort.signal.aborted) return;
            if (body.viewer?.id !== session.user.id || body.viewer?.role !== 'admin') throw new Error('role_unverified');
            onResult({state: 'authorized', data: body});
          } catch {
            if (observed === revision) onResult({state: 'error'});
          } finally {
            clearTimeout(timeout);
            if (observed === revision) pending = null;
          }
        }
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
