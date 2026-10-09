(() => {
  'use strict';
  // Only this additional adapter differs from the frozen browser runtime.
  let port = null, nextId = 1;
  const queue = [], requests = new Map();
  function notice(message, kind = 'info') {
    const panel = document.getElementById('validationMessages');
    if (!panel) return;
    const node = document.createElement('div'); node.className = 'message ' + kind; node.textContent = message; panel.replaceChildren(node);
  }
  function send(message) {
    if (!port) { queue.push(message); return; }
    port.postMessage(JSON.stringify(message));
  }
  window.addEventListener('message', event => {
    if (event.data !== 'qpcr-native-ready' || !event.ports?.[0] || port) return;
    port = event.ports[0];
    port.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'afterprint') { window.dispatchEvent(new Event('afterprint')); return; }
        if (message.type !== 'save-result') return;
        requests.delete(message.id);
        notice(message.status === 'saved' ? '文件已保存：' + message.name : message.status === 'cancelled' ? '已取消文件保存；当前实验仍保留在本机草稿，请按需再次导出。' : '文件保存失败：' + (message.message || '请重试'), message.status === 'saved' ? 'success' : 'warning');
      } catch (_) { notice('无法读取系统操作结果。', 'warning'); }
    };
    port.start?.();
    while (queue.length) send(queue.shift());
  });
  function base64(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  }
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (...args) {
    if (!this.download || !this.href.startsWith('blob:')) return originalClick.apply(this, args);
    const id = nextId++, name = this.download;
    requests.set(id, name);
    fetch(this.href).then(response => response.blob()).then(async blob => {
      if (blob.size > 16 * 1024 * 1024) throw new Error('导出文件超过 16 MB。');
      send({ type: 'save', id, name, mime: blob.type || 'application/octet-stream', base64: base64(new Uint8Array(await blob.arrayBuffer())) });
    }).catch(error => { requests.delete(id); notice('导出失败：' + error.message, 'error'); });
  };
  window.print = () => send({ type: 'print', orientation: document.querySelector('input[name="printOrientation"]:checked')?.value || 'portrait' });
  // A frozen APK reads directly from assets and never updates through a server.
  if (navigator.serviceWorker) {
    try { navigator.serviceWorker.register = () => Promise.reject(new Error('APK 使用内置离线资源，无需 Service Worker。')); } catch (_) { /* Native loader also blocks sw.js. */ }
  }
  if (!navigator.wakeLock) {
    try {
      Object.defineProperty(navigator, 'wakeLock', {value:{request: async () => {
        const lock = new EventTarget(); lock.released = false;
        lock.release = async () => { if (!lock.released) { lock.released = true; send({type:'awake',enabled:false}); lock.dispatchEvent(new Event('release')); } };
        send({type:'awake',enabled:true}); return lock;
      }}});
    } catch (_) { /* Original browser fallback remains usable. */ }
  }
})();
