'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=__dirname, url=process.argv[2];
if(!url||!url.startsWith('https://')) throw Error('Use the confirmed HTTPS deployment URL.');
const ipad=path.join(root,'releases','qPCR Plate Planner v2.1.2 iPad'),android=path.join(root,'releases','qPCR Plate Planner v2.1.2 Android');
if(fs.existsSync(android+'.zip')) throw Error('Frozen Android ZIP already exists; preserve it.');
const original=JSON.parse(fs.readFileSync(path.join(ipad,'IPAD-FREEZE-MANIFEST.json'),'utf8'));
for(const item of original.files.concat({path:'index.html'})) {const destination=path.join(android,'网页部署文件',item.path);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(ipad,'网页部署文件',item.path),destination);}
fs.writeFileSync(path.join(android,'ANDROID-FREEZE-MANIFEST.json'),JSON.stringify({...original,distribution:'Android / Chrome / PWA'},null,2)+'\n');
const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [folder,device,browser,install] of [[ipad,'iPad','Safari','点击分享 → 添加到主屏幕；若显示“作为网页 App 打开”，请开启。'],[android,'安卓手机','Chrome','点击菜单（⋮）→ 添加到主屏幕 / 安装应用；具体文字由浏览器版本决定。']]) {
  const steps=[`用 ${browser} 打开访问地址：${url}`,'首次需要联网；此地址公开访问，无需 ChatGPT 账号或登录。',install,'从主屏幕软件图标打开，再保持联网进入一次，待网页与离线缓存加载完成。切断网络重开确认后，再安排离线实验。','排板、Mix 计算、草稿与执行记录均在设备浏览器完成。请及时导出 JSON；缓存和本机草稿会受到设备存储清理影响。',`保存项目 JSON 或 CSV 后，使用系统“文件”/下载列表核对文件。若主屏幕模式未能保存，回到 ${browser} 打开同一地址再导出。`,'通过“打开项目”从文件选择器导入之前导出的 JSON。首次从电脑迁移时导出再导入；不同设备、Safari/Chrome 与主屏幕模式之间的草稿不自动同步。','打印使用系统分享/打印功能和浏览器打印入口，核对 A4 纵向分页后打印或保存 PDF。','孔板投光辅助建议使用足够大的平板屏幕；使用实物确认 A1、四角和中央孔位，再锁定。手机通常不能容纳完整实体孔板。','不需要 Windows EXE、APK、IPA 或 App Store 安装。ZIP 内网页部署文件供静态 HTTPS 托管/备份，直接在设备“文件”中预览 HTML 不能替代上述 Safari/Chrome 入口。'];
  const text=`# qPCR Plate Planner v2.1.2 · ${device} 冻结版\n\n访问地址：${url}\n\n`+steps.map((step,i)=>`${i+1}. ${step}`).join('\n\n')+'\n\n## 验证范围\n\n本包 23 个运行文件与原 v2.1.2 冻结版逐字节一致。原版 229 项测试通过，本次重新打包完成 6 项校验与 DOM 集成检查。未进行实体 iPad/安卓手机触控、系统文件下载、主屏幕离线启动及打印分页实测。请在使用设备上先完成一次示例生成、JSON 保存/恢复、离线重开及实际孔位校准。\n\n托管访问会向网站服务请求网页资源；工具本身不上传实验样本或计算结果。此站点公开访问，任何人均可通过链接使用软件；实验草稿仍只保存在使用者的设备浏览器。\n';
  fs.writeFileSync(path.join(folder,'使用说明.md'),text);
  fs.writeFileSync(path.join(folder,'qPCR Plate Planner 使用指南.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>qPCR Plate Planner · ${device} 使用指南</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:30px auto;padding:0 20px;line-height:1.7;color:#183b63}a{overflow-wrap:anywhere}li{margin-bottom:16px}</style></head><body><h1>qPCR Plate Planner v2.1.2</h1><p>${device} 使用指南</p><p><a href="${escape(url)}">点击打开软件</a></p><ol>${steps.map(step=>'<li>'+escape(step)+'</li>').join('')}</ol><p>本次完成自动化校验；实体设备的触控、文件保存、离线启动和打印仍需实测。</p></body></html>\n`);
  const packageFiles=[];
  function scan(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=prefix+entry.name;if(entry.isDirectory())scan(path.join(dir,entry.name),file+'/');else packageFiles.push({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,entry.name))).digest('hex')});}}
  scan(folder);fs.writeFileSync(path.join(folder,'PACKAGE-MANIFEST.json'),JSON.stringify({version:'2.1.2',device,url,files:packageFiles},null,2)+'\n');
  const zip=folder+'.zip';if(fs.existsSync(zip))throw Error('Frozen ZIP already exists: '+zip);
  const quote=value=>"'"+value.replace(/'/g,"''")+"'";
  cp.execFileSync('powershell.exe',['-NoLogo','-NoProfile','-Command',`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${quote(folder)},${quote(zip)},[System.IO.Compression.CompressionLevel]::Optimal,$true)`],{windowsHide:true,timeout:60000});
  const hash=crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');fs.writeFileSync(zip+'.sha256.txt',hash+'  '+path.basename(zip)+'\n');console.log(JSON.stringify({device,zip,sha256:hash,files:packageFiles.length+1}));
}
