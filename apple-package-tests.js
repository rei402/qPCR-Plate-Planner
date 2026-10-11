'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm'), cp = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = __dirname, bundle = path.join(root, 'releases', 'qPCR Plate Planner v2.1.2 Apple'), web = path.join(bundle, '网页部署文件');
const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'APPLE-PACKAGE-MANIFEST.json'), 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS APPLE ' + name); }
async function main() {
  await test('Apple 包与公开目录的 23 个运行文件均保持冻结字节', () => {
    assert.equal(manifest.runtimeFiles.length, 23);
    for (const file of manifest.runtimeFiles) {
      const bytes = fs.readFileSync(path.join(root, file));
      assert.ok(bytes.equals(fs.readFileSync(path.join(web, file))), file);
      assert.ok(bytes.equals(fs.readFileSync(path.join(root, 'ipad-site', 'dist', file))), file);
    }
    assert.equal(manifest.sourceZipSha256, hash(fs.readFileSync(path.join(root, 'releases', 'qPCR Plate Planner v2.1.2.zip'))));
  });
  await test('ZIP 每个文件和清单一致，不含私人记录、密钥或依赖', () => {
    const archive = cp.execFileSync('python', ['-c', 'import sys,zipfile,json,hashlib; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n.split("/",1)[1]:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}))', bundle + '.zip'], { encoding: 'utf8', windowsHide: true });
    const entries = JSON.parse(archive);
    for (const item of manifest.files) assert.equal(entries[item.path], item.sha256, item.path);
    assert.equal(Object.keys(entries).length, manifest.files.length + 1);
    assert.equal(entries['APPLE-PACKAGE-MANIFEST.json'], hash(fs.readFileSync(path.join(bundle, 'APPLE-PACKAGE-MANIFEST.json'))));
    assert.ok(!Object.keys(entries).some(n => /(?:node_modules|\.git\/|\.openai\/|_qPCR\.json$|\.(?:p12|jks|keystore)$)/i.test(n)));
    const recorded = fs.readFileSync(bundle + '.zip.sha256.txt', 'utf8').split(' ')[0];
    assert.equal(hash(fs.readFileSync(bundle + '.zip')), recorded);
  });
  await test('教程安装按钮直接打开软件，iPhone/iPad步骤与本地图片链接完整', () => {
    const guide = new JSDOM(fs.readFileSync(path.join(bundle, 'qPCR Plate Planner Apple 安装教程.html'), 'utf8'));
    assert.equal(guide.window.document.getElementById('open-app').href, manifest.appUrl);
    assert.notEqual(new URL(manifest.appUrl).pathname, '/qPCR%20Plate%20Planner%20Apple%20%E5%AE%89%E8%A3%85%E6%95%99%E7%A8%8B.html');
    for (const element of guide.window.document.querySelectorAll('nav a')) assert.ok(guide.window.document.querySelector(element.getAttribute('href')));
    for (const image of guide.window.document.querySelectorAll('img[src]')) assert.ok(fs.existsSync(path.join(bundle, image.getAttribute('src'))));
    const text = guide.window.document.body.textContent;
    for (const term of ['iPhone 安装步骤', 'iPad 安装步骤', '添加到主屏幕', '作为网页 App 打开', '断网', 'JSON', '打印', '不是 IPA']) assert.ok(text.includes(term), term);
    assert.equal(guide.window.document.querySelector('meta[name=viewport]').content, 'width=device-width,initial-scale=1');
    guide.window.close();
  });
  await test('安装阶段完整缓存，断网冷启动能返回软件 HTML 和核心脚本', async () => {
    const handlers = {}, stores = new Map(), origin = 'https://test.qpcr.invalid';
    let offline = false;
    const key = request => typeof request === 'string' ? new URL(request, origin + '/').href : request.url;
    const response = bytes => ({ ok: true, bytes, clone() { return response(this.bytes); } });
    const fetchFile = async request => {
      if (offline) throw Error('Network is offline');
      return response(fs.readFileSync(path.join(web, decodeURIComponent(new URL(key(request)).pathname.slice(1)))));
    };
    const caches = {
      async open(name) {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name);
        return { async addAll(requests) { for (const request of requests) store.set(key(request), await fetchFile(request)); }, async put(request, value) { store.set(key(request), value); } };
      },
      async match(request) { for (const store of stores.values()) if (store.has(key(request))) return store.get(key(request)); },
      async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); }
    };
    const context = { URL, Promise, caches, fetch: fetchFile, self: { location: { origin }, clients: { async claim() {} }, skipWaiting() {}, addEventListener(name, listener) { handlers[name] = listener; } } };
    vm.runInNewContext(fs.readFileSync(path.join(web, 'sw.js'), 'utf8'), context);
    let installing; handlers.install({ waitUntil(promise) { installing = promise; } }); await installing;
    offline = true;
    for (const file of ['qPCR Plate Planner.html', 'core.js', 'lab-layout.js', 'styles.css', 'icons/icon-192.png']) {
      let received; handlers.fetch({ request: { method: 'GET', url: new URL(encodeURI(file), origin + '/').href }, respondWith(promise) { received = promise; } });
      assert.ok((await received).bytes.equals(fs.readFileSync(path.join(web, file))), file);
    }
  });
  const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => { if (!e.message.includes('navigation')) errors.push(e); });
  const dom = await JSDOM.fromFile(path.join(web, 'qPCR Plate Planner.html'), { resources: 'usable', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
    w.__QPCR_TEST__ = true; w.confirm = () => true; w.alert = () => {};
    const data = new Map(); Object.defineProperty(w, 'localStorage', { value: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) } });
    w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () { w.__filename = this.download; };
  } });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('DOM load timeout')), 10000); dom.window.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true }); });
  try {
    const w = dom.window, api = w.QPCRTest, $ = id => w.document.getElementById(id);
    await test('Apple 包 96/384 排板和 JSON 恢复保持原孔位及三个默认设置', () => {
      for (const type of [96, 384]) {
        const project = w.QPCR.newProject(); project.plateType = type; api.setForm(project); api.generate(); assert.ok(api.state.result?.ok);
        const layout = JSON.stringify(api.snapshot().plateLayout); api.applyLoaded(api.snapshot()); assert.equal(JSON.stringify(api.snapshot().plateLayout), layout);
        assert.equal(api.state.project.settings.layoutMode, 'labPriorityHybrid'); assert.equal(api.state.project.settings.printOrientation, 'portrait'); assert.equal(api.state.project.settings.display.paletteId, 'vividScience');
        assert.equal($('printSheet').querySelectorAll('.occupied').length, api.state.result.plates[0].wells.length);
      }
    });
    await test('项目 JSON 下载和本机草稿链路可执行', () => { $('saveButton').click(); assert.match(w.__filename, /_qPCR\.json$/); assert.equal(api.persistDraft(), true); assert.equal(errors.length, 0, errors.map(e => e.message).join('\n')); });
  } finally { dom.window.close(); }
  console.log(`${passed}/${passed} Apple package checks passed (DOM + service-worker simulation; no physical Apple device test)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
