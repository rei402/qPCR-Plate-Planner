'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const root = __dirname, name = 'qPCR Plate Planner v2.1.2 Apple Deploy', bundle = path.join(root, 'releases', name), web = path.join(bundle, '网页部署文件'), zip = bundle + '.zip';
if (fs.existsSync(zip)) throw Error('Deployment package already exists; preserve it.');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const frozen = JSON.parse(fs.readFileSync(path.join(root, 'FREEZE-MANIFEST.json'), 'utf8'));
for (const file of frozen.files) if (digest(fs.readFileSync(path.join(root, file.path))) !== file.sha256) throw Error('Frozen source changed: ' + file.path);
const runtime = [...new Set([...fs.readFileSync(path.join(root, 'sw.js'), 'utf8').matchAll(/'\.\/([^']+)'/g)].map(m => decodeURIComponent(m[1])).concat('sw.js'))];
for (const file of runtime) { const target = path.join(web, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(root, file), target); }
fs.copyFileSync(path.join(root, 'ipad-site/dist/index.html'), path.join(web, 'index.html'));
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(bundle, 'LICENSE'));
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(web, 'LICENSE'));
fs.copyFileSync(path.join(root, 'APPLE-FREE-DEPLOY.md'), path.join(bundle, '免费部署教程.md'));
fs.writeFileSync(path.join(web, '.nojekyll'), '');
fs.writeFileSync(path.join(web, 'Apple 安装指南.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>qPCR Plate Planner · Apple 安装指南</title><link rel="icon" href="icons/icon.svg"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;max-width:760px;margin:35px auto;padding:0 22px;line-height:1.8;color:#183b63;background:#f4f7fa}a{color:#076c64;overflow-wrap:anywhere}.button{display:inline-block;background:#183b63;color:white;padding:12px 20px;border-radius:8px;text-decoration:none}li{margin:12px 0}h2{margin-top:28px}strong{color:#126757}img{width:70px;height:70px}</style></head><body><img src="icons/icon-192.png" alt="孔板图标"><h1>qPCR Plate Planner</h1><p>iPhone / iPad 主屏幕 App · v2.1.2</p><a id="open-app" class="button" href="./qPCR%20Plate%20Planner.html">打开本网站工具并安装</a><p><strong>请在工具的实验输入页面添加到主屏幕。</strong>此页面是安装说明。</p><h2>安装步骤</h2><ol><li>使用 Safari 打开上面的本网站工具链接。若从微信等 App 内进入，将链接复制到 Safari。</li><li>点击 Safari 分享按钮，选择“添加到主屏幕”。若找不到该项，在分享菜单底部检查“编辑操作”。</li><li>名称保留 qPCR Plate Planner；若显示“作为网页 App 打开”，开启它后点击“添加”。</li><li>从主屏幕孔板图标打开，首次保持联网并生成一次示例。</li><li>关闭网络，再从主屏幕重新打开软件，确认可以生成孔板和查看 Mix。缓存可能受到系统清理影响。</li></ol><h2>实验与记录</h2><p>输入样品、目标基因、内参和配方，核对容量后生成孔板。使用“保存项目 JSON”备份实验，并在系统“文件”App 确认文件存在；通过“打开项目”恢复原孔位。每台设备分别安装与校准，实验记录不自动跨设备同步。</p><h2>打印与投光</h2><p>打印前核对 A4 方向和分页。iPad 投光辅助需使用实体孔板核对 A1、四角及中央孔位，锁定后再加样。iPhone 通常不适合承载完整实体孔板。</p><h2>授权</h2><p>可免费使用、修改和自行部署，保留 <a href="./LICENSE">MIT 许可证及版权声明</a>。发布者：rei402。</p></body></html>\n`);
fs.writeFileSync(path.join(bundle, 'README.md'), '# qPCR Plate Planner · Apple 免费部署包\n\n将“网页部署文件”内部全部内容上传到自己的 HTTPS 静态网站。GitHub Pages 公开仓库可使用免费托管；具体步骤见“免费部署教程.md”。\n\n部署完成后在 Safari 打开自己的软件页面，分享 → 添加到主屏幕。安装说明页使用相对地址，保留在自己的站点内。MIT 许可证已包含，请保留。冻结核心 v2.1.2，发布者 rei402。\n');
const files = [];
function scan(dir, prefix = '') { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const relative = prefix + entry.name; if (entry.isDirectory()) scan(path.join(dir, entry.name), relative + '/'); else files.push({ path: relative, sha256: digest(fs.readFileSync(path.join(dir, entry.name))) }); } }
scan(bundle);
fs.writeFileSync(path.join(bundle, 'DEPLOY-MANIFEST.json'), JSON.stringify({ version: '2.1.2', deliveryDate: '2026-10-12', publisher: 'rei402', license: 'MIT', runtimeFilesUnchanged: true, runtimeFiles: runtime, files }, null, 2) + '\n');
cp.execFileSync('python', ['-c', 'import sys,pathlib,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"x",compression=zipfile.ZIP_DEFLATED); [z.write(p,root.name+"/"+p.relative_to(root).as_posix()) for p in sorted(root.rglob("*")) if p.is_file()]; z.close()', bundle, zip], { windowsHide: true });
const hash = digest(fs.readFileSync(zip)); fs.writeFileSync(zip + '.sha256.txt', hash + '  ' + path.basename(zip) + '\n');
console.log(JSON.stringify({ zip, sha256: hash, runtimeFiles: runtime.length }));
