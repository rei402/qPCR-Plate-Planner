'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const root=__dirname, releaseInfo=require('./VERSION.json'), version=releaseInfo.version;
const releases=path.join(root,'releases'), folder=path.join(releases,'qPCR Plate Planner v'+version), zip=folder+'.zip';
if(fs.existsSync(folder)||fs.existsSync(zip))throw Error('版本交付包已存在，不覆盖已有包；请先明确新版本号。');
cp.execFileSync(process.execPath,[path.join(root,'build-launcher.js')],{cwd:root,stdio:'inherit'});
const reports=[];
for(const suite of ['tests.js','release-tests.js','ui-tests.js','lab-layout-tests.js','lab-ui-tests.js','review-tests.js','single-channel-tests.js','single-channel-ui-tests.js']) {
  const output=cp.execFileSync(process.execPath,[path.join(root,suite)],{cwd:root,encoding:'utf8',timeout:60000});
  const summary=output.trim().split(/\r?\n/).at(-1); console.log(suite+': '+summary); reports.push({suite,summary,output});
}
const frozenAt=new Date().toISOString();
const testReport='# 交付版测试报告\n\n版本：'+version+'；执行时间：'+frozenAt+'\n\n'+reports.map(r=>'## '+r.suite+'\n\n'+r.summary+'\n\n```text\n'+r.output+'```\n').join('\n')+'\nDOM 测试使用 jsdom。真实浏览器六场景的独立执行记录见 BROWSER-ACCEPTANCE-RESULTS.json 和 SINGLE-CHANNEL-UPGRADE.md。触屏、全屏、系统打印分页与实体孔板校准仍须设备复核。\n';
fs.writeFileSync(path.join(root,'TEST-REPORT.md'),testReport);
// Explicit allowlist: never include private experiments, .Rhistory or node_modules.
const files=['qPCR Plate Planner.exe','launcher.cs','build-launcher.js','review-tests.js','update-safety.js','DEVICE-CHECKLIST.md','qPCR Plate Planner.html','styles.css','print.css','tablet-guide.css','core.js','lab-layout.js','plate-colors.js','presentation.js','selection.js','tablet-guide-core.js','tablet-guide.js','execution.js','project-io.js','form-controller.js','plate-renderer.js','print-controller.js','app.js','manifest.json','sw.js','README.md','CHANGELOG.md','VERSION.json','TEST-REPORT.md','tests.html','tests.js','release-tests.js','ui-tests.js','lab-layout-tests.js','lab-ui-tests.js','LAB-LAYOUT-REPORT.md','package.json','package-lock.json','generate_icons.py','build-release.js','verify-release.js','创建工具快捷方式.ps1','创建工具快捷方式.cmd','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/qPCR Plate Planner.ico','examples/example-project.json','examples/premix-example-project.json','examples/sample-table.tsv','examples/v2-project.json'];
files.push('LICENSE','single-channel.js','single-channel-ui.js','single-channel.css','single-channel-tests.js','single-channel-ui-tests.js','browser-acceptance.html','browser-acceptance.js','SINGLE-CHANNEL-GUIDE.md','SINGLE-CHANNEL-UPGRADE.md','BROWSER-ACCEPTANCE-RESULTS.json');
const manifest={tool:'qPCR Plate Planner',version,status:releaseInfo.status,frozenAt,entry:'qPCR Plate Planner.html',windowsEntry:'qPCR Plate Planner.exe',tests:reports.map(({suite,summary})=>({suite,summary})),files:files.map(file=>({path:file,size:fs.statSync(path.join(root,file)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}))};
const manifestText=JSON.stringify(manifest,null,2)+'\n'; fs.writeFileSync(path.join(root,'FREEZE-MANIFEST.json'),manifestText);
fs.mkdirSync(folder,{recursive:true});
for(const file of files) { const target=path.join(folder,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(path.join(root,file),target); }
fs.writeFileSync(path.join(folder,'FREEZE-MANIFEST.json'),manifestText);
cp.execFileSync(process.execPath,[path.join(root,'verify-release.js'),folder],{stdio:'inherit'});
const quote=value=>"'"+value.replace(/'/g,"''")+"'";
if(!path.resolve(zip).startsWith(path.resolve(releases)+path.sep)) throw Error('Release path escapes workspace');
if(fs.existsSync(zip)) fs.unlinkSync(zip);
// Built-in .NET compression avoids a dependency on PowerShell Archive modules.
cp.execFileSync('powershell.exe',['-NoLogo','-NoProfile','-Command',`$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${quote(folder)}, ${quote(zip)}, [System.IO.Compression.CompressionLevel]::Optimal, $true)`],{windowsHide:true,timeout:60000});
const checksum=crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(zip+'.sha256.txt',checksum+'  '+path.basename(zip)+'\n');
console.log('Frozen release: '+zip); console.log('SHA256: '+checksum);
