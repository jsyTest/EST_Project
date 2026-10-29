(function () {
  'use strict';
  if (window.estDraftsReady) return;
  window.estDraftsReady = import('./drafts/ui.mjs').then(module => module.initializeDrafts()).catch(function () {
    // Failure of the optional cloud toolbar must not prevent the existing editor from opening.
    function showFailure() {
      const node = document.querySelector('[data-drafts-root]');
      if (node) node.textContent = '교육 설계 저장 기능을 준비하지 못했습니다. 새로고침해 주세요.';
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showFailure, {once: true});
    else showFailure();
    return null;
  });
})();
