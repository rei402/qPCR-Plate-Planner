(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRUpdateSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create({ saveDraft, notify, reload }) {
    let requested = false, ready = false;
    function saved() {
      try { if (saveDraft() === true) return true; } catch (_) { /* Fail closed. */ }
      notify('本机草稿未能保存，已阻止更新或刷新。请先恢复或丢弃待处理的旧草稿；若存储不可用，请导出项目并保留当前页面。');
      return false;
    }
    function request(worker) {
      if (requested) return false;
      if (!saved()) return false;
      if (ready) { reload(); return true; }
      if (!worker) { notify('更新尚未就绪，请稍后重试。'); return false; }
      requested = true;
      try { worker.postMessage({ type: 'ACTIVATE_UPDATE' }); return true; }
      catch (_) { requested = false; notify('无法应用更新；当前页面和实验数据已保留，请稍后重试。'); return false; }
    }
    function controllerChanged() {
      // Updates initiated in another tab never refresh this experiment.
      ready = true;
      if (!requested) return false;
      requested = false;
      if (!saved()) return false;
      reload(); return true;
    }
    return { request, controllerChanged };
  }
  return { create };
});
