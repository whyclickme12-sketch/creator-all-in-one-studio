/* 시작점 — 각 탭 초기화 · 서비스 워커 등록 */
(function () {
  'use strict';
  var CAS = window.CAS;

  function safe(name, fn) {
    try { fn(); } catch (e) {
      console.error('[init] ' + name + ' 실패:', e);
    }
  }

  CAS.boot = function () {
    if (CAS._booted) return;
    CAS._booted = true;
    safe('core', CAS.init);
    safe('analyzer', function () { CAS.analyzer && CAS.analyzer.init(); });
    safe('script', function () { CAS.scriptStudio && CAS.scriptStudio.init(); });
    safe('thumbnail', function () { CAS.thumbnailStudio && CAS.thumbnailStudio.init(); });
    safe('cut', function () { CAS.cutEditor && CAS.cutEditor.init(); });
    safe('sw', function () {
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
    });
    console.log('올인원 유튜브 스튜디오 준비 완료 · v1.0.9');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', CAS.boot);
  else CAS.boot();
})();
