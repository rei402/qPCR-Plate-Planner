'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = __dirname;
const version = '2.1.2';
const deliveryDate = '2026-10-12';
const frozen = path.join(root, 'releases', `qPCR Plate Planner v${version}`);
const bundle = path.join(root, 'releases', `qPCR Plate Planner v${version} Apple`);
const zip = bundle + '.zip';
const dist = path.join(root, 'ipad-site', 'dist');
const guideName = 'qPCR Plate Planner Apple 安装教程.html';
const appUrl = 'https://qpcr-plate-planner-ipad-v212.kumalovetutu.chatgpt.site/qPCR%20Plate%20Planner.html';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
if (fs.existsSync(zip)) throw Error('Apple delivery ZIP already exists; preserve it: ' + zip);
const manifest = JSON.parse(fs.readFileSync(path.join(frozen, 'FREEZE-MANIFEST.json'), 'utf8'));
for (const item of manifest.files) {
  if (sha256(fs.readFileSync(path.join(frozen, item.path))) !== item.sha256) throw Error('Frozen source changed: ' + item.path);
}
const sw = fs.readFileSync(path.join(frozen, 'sw.js'), 'utf8');
const runtime = [...new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(m => decodeURIComponent(m[1])).concat('sw.js'))];
fs.mkdirSync(path.join(bundle, '网页部署文件'), { recursive: true });
for (const file of runtime) {
  const source = path.join(frozen, file);
  if (!fs.existsSync(path.join(dist, file)) || !fs.readFileSync(path.join(dist, file)).equals(fs.readFileSync(source))) throw Error('Hosted runtime changed: ' + file);
  const destination = path.join(bundle, '网页部署文件', file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}
fs.copyFileSync(path.join(dist, 'index.html'), path.join(bundle, '网页部署文件', 'index.html'));
const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function inline(text) {
  return escape(text).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}
const markdown = fs.readFileSync(path.join(root, 'APPLE-INSTALL-GUIDE.md'), 'utf8');
const contents = [];
let body = '', list = '';
function closeList() { if (list) { body += `</${list}>`; list = ''; } }
for (const line of markdown.split(/\r?\n/)) {
  if (line.startsWith('# ')) continue;
  if (!line.trim()) { closeList(); continue; }
  if (line.startsWith('## ')) {
    closeList();
    const label = line.slice(3), id = `section-${contents.length + 1}`;
    contents.push({ label, id }); body += `<h2 id="${id}">${inline(label)}</h2>`; continue;
  }
  const numbered = line.match(/^\d+\. (.*)$/), bullet = line.match(/^- (.*)$/);
  if (numbered || bullet) {
    const kind = numbered ? 'ol' : 'ul';
    if (list !== kind) { closeList(); body += `<${kind}>`; list = kind; }
    body += `<li>${inline((numbered || bullet)[1])}</li>`;
  } else { closeList(); body += `<p>${inline(line)}</p>`; }
}
closeList();
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#183b63"><meta name="description" content="qPCR Plate Planner iPhone 和 iPad 主屏幕 App 安装、离线使用、JSON 保存与打印教程"><title>qPCR Plate Planner · Apple 安装教程</title><link rel="icon" href="icons/icon.svg"><style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#24374b;background:#f6f8fa;line-height:1.8;scroll-behavior:smooth}*{box-sizing:border-box}body{margin:0}a{color:#116969;text-underline-offset:3px;overflow-wrap:anywhere}header{background:#153b59;color:#fff;padding:52px max(20px,calc((100vw - 1120px)/2)) 40px}.brand{display:flex;align-items:center;gap:15px}.brand img{width:58px;height:58px}.brand small{color:#b9ddd8}.brand h1{font-size:clamp(25px,5vw,39px);line-height:1.3;margin:4px 0}header p{max-width:730px;color:#d5e7ef}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 20px;border:1px solid #99c7c5;border-radius:9px;font:inherit;font-weight:650;cursor:pointer;text-decoration:none;background:#fff;color:#153b59}.button.primary{background:#a4e0d3;border-color:#a4e0d3}.flow{display:flex;align-items:center;flex-wrap:wrap;gap:12px;color:#fff;font-size:14px}.flow span{display:flex;gap:7px;align-items:center}.flow svg{width:24px;height:26px;fill:none;stroke:currentColor;stroke-width:1.7}.notice{background:#e8f3ef;border-left:4px solid #328171;margin:0;padding:18px 24px}main{max-width:1120px;margin:28px auto 70px;display:grid;grid-template-columns:235px minmax(0,1fr);gap:40px;padding:0 20px}nav{position:sticky;top:20px;align-self:start;font-size:13px;max-height:calc(100vh - 40px);overflow:auto}nav a{display:block;padding:5px 8px;text-decoration:none;color:#486276}article{min-width:0}h2{font-size:23px;color:#153b59;border-bottom:1px solid #d8e3e9;padding-bottom:10px;margin:34px 0 17px;scroll-margin-top:20px}p{margin:12px 0}li{padding-left:3px;margin:8px 0}ol{padding-left:25px}ul{padding-left:22px}code{font-size:.92em;background:#e8eef2;padding:2px 5px;border-radius:3px;overflow-wrap:anywhere}footer{max-width:1120px;margin:auto;padding:18px 20px 35px;border-top:1px solid #d8e3e9;color:#5b7183;font-size:13px}@media(max-width:760px){header{padding:30px 20px}main{display:block}nav{position:static;max-height:none;display:flex;gap:6px;overflow:auto;margin-bottom:25px;padding-bottom:10px}nav a{white-space:nowrap;background:#fff;border:1px solid #dce7ec;border-radius:6px}h2{font-size:21px}.actions .button{flex:1}.notice{padding:14px 20px}article{font-size:15px}}@media print{@page{size:A4 portrait;margin:16mm}body{background:#fff;font-size:11pt}header{background:#fff;color:#153b59;padding:0}header p{color:#24374b}.actions,.flow,nav,.notice{display:none}main{display:block;margin:0;padding:0}h2{break-after:avoid;font-size:16pt}a{color:inherit}footer{margin-top:20px}.brand img{width:40px;height:40px}}
</style></head><body><header><div class="brand"><img src="icons/icon-192.png" alt="qPCR Plate Planner 孔板图标"><div><small>iPHONE / iPAD · 主屏幕 App</small><h1>把加样助手放到主屏幕</h1></div></div><p>qPCR Plate Planner v${version} · 一份分别适用于 iPhone 与 iPad 的安装、离线验证和实验记录保存教程。</p><div class="actions"><a class="button primary" id="open-app" href="${appUrl}">打开工具，开始安装</a><button class="button" type="button" onclick="window.print()">打印 / 保存教程 PDF</button></div><div class="flow"><span>① Safari 打开工具</span><span>→</span><span><svg viewBox="0 0 24 26" aria-label="分享图标"><path d="M7 9H3v15h18V9h-4M12 17V2m-5 5 5-5 5 5"/></svg>② 分享</span><span>→</span><span>③ 添加到主屏幕</span><span>→</span><span>④ 离线验证</span></div></header><p class="notice"><strong>先点“打开工具”，再添加到主屏幕。</strong>这里是安装教程；应将软件的实验输入页面添加为 App。当前提供 Safari 主屏幕网页 App，不是 IPA / App Store 安装包。</p><main><nav aria-label="教程目录">${contents.map(c => `<a href="#${c.id}">${escape(c.label)}</a>`).join('')}</nav><article>${body}</article></main><footer>qPCR Plate Planner · 发布者 rei402 · Apple 交付教程 ${deliveryDate} · 冻结核心 v${version}</footer></body></html>
`;
fs.writeFileSync(path.join(dist, guideName), html);
fs.writeFileSync(path.join(bundle, guideName), html);
fs.copyFileSync(path.join(root, 'APPLE-INSTALL-GUIDE.md'), path.join(bundle, '安装教程.md'));
for (const file of ['icons/icon-192.png', 'icons/icon.svg']) {
  const destination = path.join(bundle, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(frozen, file), destination);
}
fs.writeFileSync(path.join(bundle, 'README.md'), `# qPCR Plate Planner v${version} · Apple 主屏幕 App\n\n交付日期：${deliveryDate}。打开同目录“${guideName}”或“安装教程.md”查看安装步骤。\n\n软件入口：${appUrl}\n\n“网页部署文件”用于静态 HTTPS 托管或备份；请通过 Safari 在线安装主屏幕 App。ZIP 本身不是 IPA，不能直接点 ZIP 安装。核心运行文件与冻结版逐字节相同。\n`);
const fileEntries = [];
function scan(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) scan(path.join(directory, entry.name), relative + '/');
    else fileEntries.push({ path: relative, sha256: sha256(fs.readFileSync(path.join(directory, entry.name))) });
  }
}
scan(bundle);
fs.writeFileSync(path.join(bundle, 'APPLE-PACKAGE-MANIFEST.json'), JSON.stringify({ tool: 'qPCR Plate Planner', version, deliveryDate, distribution: 'iPhone / iPad / Safari Home Screen PWA', publisher: 'rei402', appUrl, sourceZipSha256: sha256(fs.readFileSync(frozen + '.zip')), runtimeFilesUnchanged: true, runtimeFiles: runtime, files: fileEntries }, null, 2) + '\n');
cp.execFileSync('python', ['-c', 'import sys,pathlib,zipfile; root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); z=zipfile.ZipFile(out,"x",compression=zipfile.ZIP_DEFLATED); [z.write(p,root.name+"/"+p.relative_to(root).as_posix()) for p in sorted(root.rglob("*")) if p.is_file()]; z.close()', bundle, zip], { windowsHide: true });
const hash = sha256(fs.readFileSync(zip));
fs.writeFileSync(zip + '.sha256.txt', hash + '  ' + path.basename(zip) + '\n');
console.log(JSON.stringify({ version, deliveryDate, runtimeFiles: runtime.length, zip, sha256: hash, guide: path.join(dist, guideName) }));
