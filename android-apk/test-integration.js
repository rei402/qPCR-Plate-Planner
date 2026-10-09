'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('../node_modules/jsdom');
const {Blob}=require('node:buffer');
const assets=process.argv[2]||path.join(__dirname,'build','assets','www');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS APK INTEGRATION '+name);};
(async()=>{
  const messages=[],errors=[],blobs=new Map(),vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
  const dom=await JSDOM.fromFile(path.join(assets,'qPCR Plate Planner.html'),{resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    w.__QPCR_TEST__=true;w.confirm=()=>true;w.alert=()=>{};w.Blob=Blob;
    const stored=new Map();Object.defineProperty(w,'localStorage',{value:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}});
    w.URL.createObjectURL=blob=>{const url='blob:qpcr/'+blobs.size;blobs.set(url,blob);return url;};w.URL.revokeObjectURL=url=>blobs.delete(url);
    w.fetch=async url=>({blob:async()=>{assert.ok(blobs.has(url),'Export blob was revoked too early');return blobs.get(url);}});
  }});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('APK DOM load timeout')),10000);dom.window.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});});
  const w=dom.window,$=id=>w.document.getElementById(id),api=w.QPCRTest;
  const port={postMessage:text=>messages.push(JSON.parse(text)),start(){}};w.dispatchEvent(new w.MessageEvent('message',{data:'qpcr-native-ready',ports:[port]}));
  try {
    for(const type of [96,384]) {
      test(type+' 孔 APK 入口可生成并保留三项新默认',()=>{const p=w.QPCR.newProject();p.plateType=type;api.setForm(p);api.generate();assert.ok(api.state.result?.ok);assert.equal(api.state.project.settings.layoutMode,'labPriorityHybrid');assert.equal(api.state.project.settings.printOrientation,'portrait');assert.equal(api.state.project.settings.display.paletteId,'vividScience');});
      const mapping=JSON.stringify(api.snapshot().plateLayout);$('saveButton').click();await new Promise(r=>setTimeout(r,10));
      test(type+' 孔 JSON 经实际导出按钮传入系统桥并可恢复原孔位',()=>{const request=messages.filter(m=>m.type==='save').at(-1);assert.ok(request.name.endsWith('.json'));const saved=JSON.parse(Buffer.from(request.base64,'base64').toString('utf8'));api.applyLoaded(saved);assert.equal(JSON.stringify(api.snapshot().plateLayout),mapping);});
    }
    $('csvButton').click();await new Promise(r=>setTimeout(r,10));
    test('实际 CSV 导出保留 BOM、表头和占用孔数据',()=>{const csv=messages.filter(m=>m.type==='save').at(-1);assert.equal(csv.name,'plate_layout.csv');const text=Buffer.from(csv.base64,'base64').toString('utf8');assert.ok(text.startsWith('\ufeff'));assert.match(text,/ReactionVolume_uL/);});
    test('实际打印按钮发送纵向 A4 系统打印请求',()=>{$('printButton').click();assert.equal(messages.at(-1).type,'print');assert.equal(messages.at(-1).orientation,'portrait');port.onmessage({data:'{"type":"afterprint"}'});assert.equal($('printSheet').querySelectorAll('.occupied').length,api.state.result.plates[0].wells.length);});
    test('切到后台触发草稿保存，包内脚本加载无异常',()=>{w.dispatchEvent(new w.Event('pagehide'));assert.equal(api.state.draftSaved,true);assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));});
  }finally{dom.window.close();}
  console.log(`${passed}/${passed} packaged APK DOM integration tests passed (not Android device testing)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
