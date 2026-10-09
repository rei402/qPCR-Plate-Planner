'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), os=require('node:os'), cp=require('node:child_process');
const Safety=require('./update-safety.js'), View=require('./presentation.js');
let passed=0;
function test(name,fn) { fn(); passed++; console.log('PASS REVIEW '+name); }
function harness(save=()=>true) {
  const events=[];
  const guard=Safety.create({saveDraft:()=>{events.push('save'); return save();},notify:message=>events.push(message),reload:()=>events.push('reload')});
  const worker={postMessage:message=>events.push(message.type)};
  return {events,guard,worker};
}
test('首次保存失败或抛错阻止激活与刷新',()=>{for(const save of [()=>false,()=>undefined,()=>{throw Error('quota');}]) { const h=harness(save); assert.equal(h.guard.request(h.worker),false); assert.ok(!h.events.includes('ACTIVATE_UPDATE')); assert.ok(!h.events.includes('reload')); assert.ok(h.events.some(e=>e.includes('已阻止'))); }});
test('显式更新在激活前及刷新前各保存一次',()=>{const h=harness(); assert.equal(h.guard.request(h.worker),true); assert.equal(h.guard.controllerChanged(),true); assert.deepEqual(h.events,['save','ACTIVATE_UPDATE','save','reload']);});
test('激活期间编辑的最新数据在刷新前保存',()=>{let draft='before',saved; const h=harness(()=>{saved=draft;return true;}); h.guard.request(h.worker); draft='after'; h.guard.controllerChanged(); assert.equal(saved,'after'); assert.equal(h.events.at(-1),'reload');});
test('刷新前保存失败保留页面，修复存储后可重试',()=>{let healthy=true; const h=harness(()=>healthy); h.guard.request(h.worker); healthy=false; assert.equal(h.guard.controllerChanged(),false); assert.ok(!h.events.includes('reload')); healthy=true; assert.equal(h.guard.request(null),true); assert.equal(h.events.at(-1),'reload'); assert.equal(h.events.filter(e=>e==='ACTIVATE_UPDATE').length,1);});
test('其它标签激活不会刷新当前实验',()=>{const h=harness(); assert.equal(h.guard.controllerChanged(),false); assert.deepEqual(h.events,[]);});
test('重复更新点击不重复发送激活消息',()=>{const h=harness(); h.guard.request(h.worker); assert.equal(h.guard.request(h.worker),false); assert.deepEqual(h.events,['save','ACTIVATE_UPDATE']);});
test('消息发送失败或无等待版本不刷新，可重新尝试',()=>{const h=harness(); assert.equal(h.guard.request(null),false); assert.equal(h.guard.request({postMessage(){throw Error('worker unavailable');}}),false); assert.ok(!h.events.includes('reload')); assert.equal(h.guard.request(h.worker),true);});
test('NTC 按本板实际孔位判断，其他及自定义检查项不变',()=>{const item='NTC 已最后加入'; assert.equal(View.checklistItem(item,[{type:'sample'}]).applicable,false); assert.equal(View.checklistItem(item,[{type:'ntc'}]).applicable,true); for(const label of ['确认封板','自定义 NTC 提示']) assert.deepEqual(View.checklistItem(label,[]),{applicable:true,label});});
test('启动程序搬到中文空格路径后可定位入口；缺文件明确失败',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'qPCR 启动测试 '));
  const exe=path.join(temp,'qPCR Plate Planner.exe'), html=path.join(temp,'qPCR Plate Planner.html');
  try { fs.copyFileSync(path.join(__dirname,'qPCR Plate Planner.exe'),exe); fs.writeFileSync(html,'<!doctype html>');
    const run=()=>cp.spawnSync(exe,['--self-test'],{cwd:os.tmpdir(),windowsHide:true,timeout:10000});
    assert.equal(run().status,0); fs.unlinkSync(html); assert.equal(run().status,2);
  } finally { for(const file of [exe,html]) if(fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(temp); }
});
console.log(`${passed}/${passed} review regression tests passed`);
