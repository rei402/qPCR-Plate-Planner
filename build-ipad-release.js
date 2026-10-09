'use strict';
// Repackage the frozen browser application without changing its runtime files.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=__dirname, frozen=path.join(root,'releases','qPCR Plate Planner v2.1.2');
const original=JSON.parse(fs.readFileSync(path.join(frozen,'FREEZE-MANIFEST.json'),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const file of original.files) if(hash(path.join(frozen,file.path))!==file.sha256) throw Error('Frozen source changed: '+file.path);
const sw=fs.readFileSync(path.join(frozen,'sw.js'),'utf8');
const files=[...new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>decodeURIComponent(m[1])).concat('sw.js'))];
const entries=files.map(file=>{const source=original.files.find(item=>item.path===file);if(!source) throw Error('Not in original freeze: '+file);return source;});
const site=path.join(root,'ipad-site'), dist=path.join(site,'dist');
fs.mkdirSync(dist,{recursive:true});
for(const file of files) { const target=path.join(dist,file); fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(frozen,file),target); }
// Hosting requires a directory root document. The software retains its named entry.
fs.writeFileSync(path.join(dist,'index.html'),'<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./qPCR%20Plate%20Planner.html"><title>qPCR Plate Planner</title><link rel="icon" href="icons/icon.svg"></head><body><a href="./qPCR%20Plate%20Planner.html">打开 qPCR Plate Planner v2.1.2</a></body></html>\n');
fs.mkdirSync(path.join(site,'.openai'),{recursive:true});
const hosting=path.join(site,'.openai','hosting.json');
const config=fs.existsSync(hosting)?JSON.parse(fs.readFileSync(hosting,'utf8')):{};
config.static={directory:'dist'}; fs.writeFileSync(hosting,JSON.stringify(config,null,2)+'\n');
const bundle=path.join(root,'releases','qPCR Plate Planner v2.1.2 iPad');
fs.mkdirSync(path.join(bundle,'网页部署文件'),{recursive:true});
for(const file of files.concat('index.html')) { const target=path.join(bundle,'网页部署文件',file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(dist,file),target); }
const manifest={tool:original.tool,version:original.version,distribution:'iPad / Safari / PWA',sourceZipSha256:hash(frozen+'.zip'),entry:original.entry,status:'frozen',runtimeFilesUnchanged:true,files:entries,hostingRoot:{path:'index.html',sha256:hash(path.join(dist,'index.html'))}};
fs.writeFileSync(path.join(bundle,'IPAD-FREEZE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({site,dist,bundle,runtimeFiles:files.length,sourceVersion:original.version}));
