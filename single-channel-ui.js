(() => {
  'use strict';
  window.QPCRSingleChannelUI = { create(ctx) {
    const { Q, state, $, esc, changed, markStale, renderSteps, renderPlate, renderPrint, selectedPlate, completeStep, flash } = ctx;
    const SC = window.QPCRSingleChannel, Exec = window.QPCRExecution;
    const nav = { active: false, approved: false, paused: true, blackout: true, key: '', lastCompleted: '' };
    const unit = n => n == null ? '未配置 / 未量程校验' : Q.volume(n) + ' µL';
    const phaseName = phase => phase === 'primer' ? '阶段 1 / 2：分装 Target 引物工作液' : phase === 'sampleMix' ? '阶段 2 / 2：分装 Sample Master Mix' : '本板完成检查';
    const field = (phase, name, label, placeholder = '', type = 'number') => `<label>${label}<input id="sc-${phase}-${name}" data-phase="${phase}" data-setting="${name}" type="${type}" ${type === 'number' ? 'min="0" step="any"' : ''} placeholder="${placeholder}"></label>`;
    $('singleChannelConfig').innerHTML = `<h2>单通道两液体体系</h2><p>根据引物分装和样品混合液分装两个阶段，优化孔板布局、移液顺序、吸液批次和孔位导航。体积取自上方真实配方；不自动修改化学组成。</p><label class="inline-check"><input id="scIncludeWater" type="checkbox">未启用独立 Mix 时，将配方中现有 Water 一并纳入引物工作液</label><p class="small">已启用独立 Primer / Assay Mix 的 assay 优先使用其选择；模板与通用 Mix 均归入 Sample Master Mix。各 assay 的样品侧配方必须相同。</p><div class="fields two"><label>SYBR 原液倍数（可选）<input id="scSybrStock" type="number" min="0" step="any" placeholder="例如 2"></label><label>要求的最终倍数（可选）<input id="scSybrFinal" type="number" min="0" step="any" placeholder="例如 1"></label></div>${['primer', 'sampleMix'].map(phase => `<details open><summary>${phase === 'primer' ? '引物工作液移液器与管架' : 'Sample Master Mix 移液器与管架'}</summary><div class="fields two">${field(phase,'name','移液器名称（可选）','','text')}${field(phase,'minVolume','最小可靠体积 µL')}${field(phase,'maxVolume','最大量程 µL')}${field(phase,'dispenseLimit','单次连续分液上限 µL')}${field(phase,'maxWells','每批最大孔数（可选）')}${field(phase,'deadVolume','每管死体积 µL')}${field(phase,'tubeCapacity','来源管容量 µL（可选）')}${field(phase,'rackRows','管架行数')}${field(phase,'rackColumns','管架列数')}<label>批次策略<select id="sc-${phase}-strategy" data-phase="${phase}" data-setting="strategy"><option value="spatial">空间分段优先</option><option value="capacity">量程优先（分区内连续任务）</option></select></label><label>吸头估算策略<select id="sc-${phase}-tipPolicy" data-phase="${phase}" data-setting="tipPolicy"><option value="unknown">不估算；按实验室 SOP</option><option value="perBatch">每批新头；限已验证的非接触连续分液</option><option value="perWell">每孔新头（每孔重新吸液）</option></select></label></div></details>`).join('')}<p class="small caution">普通单通道移液器不应默认具有可靠的连续分液能力。只有已按设备说明书/SOP 验证后才填写连续分液上限；参数缺失时仅提供孔位导航，吸液批次数不作精确承诺。触碰孔内液体后禁止回插来源管。</p><details><summary>根据浓度计算引物工作液（可选）</summary><label>选择 assay<select id="scCalcAssay"></select></label><div class="fields two">${['forwardStock','reverseStock','forwardFinal','reverseFinal'].map((key,i)=>`<label>${['F 原液浓度','R 原液浓度','F 最终反应浓度','R 最终反应浓度'][i]} µM<input id="scCalc-${key}" type="number" min="0" step="any"></label>`).join('')}<label>引物工作液每孔体积 µL<input id="scCalc-workingVolume" type="number" min="0" step="any"></label></div><button id="scCalculate" type="button" class="ghost">计算建议体积</button><button id="scApplyPrimer" type="button" class="ghost">将当前输入计算并应用到此 assay</button><p id="scCalcResult" class="small" aria-live="polite"></p><p class="small">所有浓度统一使用 µM（例如 0.2 µM = 200 nM）。应用会明确更新独立配方的 F/R 和水分配，保留模板及通用 Mix，随后须重新生成。不同 assay 的 Sample Mix 必须继续一致。</p></details>`;
    const dialog = document.createElement('div'); dialog.id = 'singleChannelNavigator'; dialog.className = 'sc-navigator'; dialog.hidden = true; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', '单通道加样导航');
    dialog.innerHTML = `<header class="sc-nav-header"><div><strong>加样导航模式</strong><p id="scNavPlate"></p></div><button id="scNavExit" type="button" class="ghost">退出导航</button></header><div class="sc-nav-body"><section class="sc-current"><p id="scNavPhase" class="sc-phase"></p><h2 id="scNavTitle"></h2><div id="scNavSource" class="sc-source-label"></div><div id="scNavMetrics" class="sc-metrics"></div><p id="scNavWells" class="sc-exact-wells"></p><p id="scNavRegions"></p><p id="scNavStatus" role="status" aria-live="polite"></p><div id="scConfirmations"><label><input id="scConfirmSource" type="checkbox">已确认当前来源管标签及管架位置</label><label><input id="scConfirmPhase" type="checkbox">已确认当前加样阶段与每孔体积</label><label><input id="scConfirmA1" type="checkbox">已确认孔板编号、方向及 A1</label></div><div class="compact-actions"><button id="scBegin" type="button" class="primary">确认并点亮本批</button><button id="scPause" type="button" class="ghost">暂停 / 继续</button><button id="scBlackout" type="button" class="ghost">熄灭孔板</button><button id="scReview" type="button" class="ghost">重新检查当前批次</button></div><button id="scComplete" type="button" class="primary big">确认本批已完成，进入下一批</button><button id="scTablet" type="button" class="ghost">打开同批次平板投光</button><p class="small caution">确认仅表示操作者手动确认，软件未检测真实液体。不要把接触孔内液体的吸头插回来源管，也不要接触其他孔的液体；疑似污染按实验室规范换头。</p></section><section><div id="scNavPlateView" class="sc-nav-plate"></div><p class="small">当前批次点亮；暗淡边框表示已手动确认的当前阶段孔位。384 使用 Q1 → Q2 → Q3 → Q4 分区。</p></section></div>`;
    document.body.append(dialog);
    function readSettings() {
      const cfg = SC.config({ settings: { singleChannel: state.singleChannelSettings } });
      cfg.includeWater = $('scIncludeWater').checked;
      cfg.sybrStockFold = $('scSybrStock').value === '' ? null : Number($('scSybrStock').value); cfg.sybrFinalFold = $('scSybrFinal').value === '' ? null : Number($('scSybrFinal').value);
      $('singleChannelConfig').querySelectorAll('[data-setting]').forEach(input => { cfg[input.dataset.phase][input.dataset.setting] = input.tagName === 'SELECT' || input.type === 'text' ? input.value : input.value === '' ? null : Number(input.value); });
      state.singleChannelSettings = cfg; return cfg;
    }
    function loadSettings() {
      const cfg = SC.config({ settings: { singleChannel: state.singleChannelSettings } });
      $('scIncludeWater').checked = cfg.includeWater; $('scSybrStock').value = cfg.sybrStockFold ?? ''; $('scSybrFinal').value = cfg.sybrFinalFold ?? '';
      $('singleChannelConfig').querySelectorAll('[data-setting]').forEach(input => { input.value = cfg[input.dataset.phase][input.dataset.setting] ?? ''; });
      showConfig();
    }
    function showConfig() {
      $('singleChannelConfig').hidden = $('layoutMode').value !== SC.MODE;
      const previous = $('scCalcAssay').value;
      const genes = state.geneRecords.filter(g => [...$('targets').value.split(/\r?\n/), ...$('references').value.split(/\r?\n/)].includes(g.name));
      $('scCalcAssay').innerHTML = genes.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join(''); if (genes.some(g => g.id === previous)) $('scCalcAssay').value = previous;
    }
    $('singleChannelConfig').querySelectorAll('[data-setting],#scIncludeWater,#scSybrStock,#scSybrFinal').forEach(input => input.addEventListener('input', () => { readSettings(); markStale('移液器、来源管或体系设置已修改，旧操作清单已失效。'); }));
    $('layoutMode').addEventListener('change', showConfig);
    function calculatePrimer(apply) {
      try {
        const p = ctx.readProject(), id = $('scCalcAssay').value;
        if (!id) throw Error('请先填写并选择 assay。');
        const assay = Q.assayProject(p, id), input = Object.fromEntries(['forwardStock','reverseStock','forwardFinal','reverseFinal','workingVolume'].map(k => [k, $('scCalc-' + k).value]));
        const calculated = SC.primerCalculation({ ...input, reactionVolume: assay.reactionVolume });
        $('scCalcResult').textContent = `每孔 F ${Q.volume(calculated.forward)} µL，R ${Q.volume(calculated.reverse)} µL，工作液补水 ${Q.volume(calculated.water)} µL；工作液合计 ${Q.volume(calculated.workingVolume)} µL。`;
        if (!apply) return;
        const keep = assay.recipe.components.filter(c => !['forward_primer','reverse_primer','water'].includes(c.role));
        const waterLeft = Q.round(Number(assay.reactionVolume) - keep.reduce((n,c)=>n+Number(c.volumePerReaction),0) - calculated.workingVolume);
        if (waterLeft < 0) throw Error('工作液体积与保留的模板/Mix 合计超过反应体积；未应用。');
        const components = [...keep, { id:'sc-forward',name:'Forward primer',role:'forward_primer',volumePerReaction:calculated.forward }, { id:'sc-reverse',name:'Reverse primer',role:'reverse_primer',volumePerReaction:calculated.reverse }, { id:'sc-primer-water',name:'Primer working water',role:'water',volumePerReaction:calculated.water }, { id:'sc-sample-water',name:'Sample mix water',role:'water',volumePerReaction:waterLeft }];
        state.assayRecipes[id] = { ...(state.assayRecipes[id] || {}), reactionVolume: assay.reactionVolume, recipe: { ...assay.recipe, components, assayPremix:{ ...(assay.recipe.assayPremix || {}),enabled:true,name:'Primer Working Mix',componentIds:['sc-forward','sc-reverse','sc-primer-water'] } } };
        markStale('已按明确输入更新当前 assay 配方，请核对样品侧一致性并重新生成。'); ctx.renderAssayChoices();
      } catch (e) { $('scCalcResult').textContent = e.message; }
    }
    $('scCalculate').onclick = () => calculatePrimer(false); $('scApplyPrimer').onclick = () => calculatePrimer(true);
    function ensureValid() {
      if (!state.result?.singleChannelPlan?.ok || !SC.isMode(state.project)) return false;
      try { for (const p of state.result.plates) Q.stepsFor(p,state.project); return true; } catch (e) { invalidate(); flash(e.message,'error'); return false; }
    }
    function current() { return state.result && Q.stepsFor(selectedPlate(),state.project)[state.step]; }
    function canOperate() { return ensureValid() && nav.active && nav.approved && !nav.paused && !nav.blackout && nav.key === Exec.stepKey(current()); }
    function resetConfirmation() { nav.approved = false; nav.paused = true; nav.blackout = true; ['scConfirmSource','scConfirmPhase','scConfirmA1'].forEach(id => { $(id).checked = false; }); }
    function syncBatch() { resetConfirmation(); if(nav.active) renderNavigation(); }
    function exit() { nav.active = false; resetConfirmation(); dialog.hidden = true; document.body.classList.remove('sc-navigating'); if (state.result && SC.isMode(state.project)) { renderSteps(); renderPlate(); } }
    function invalidate() { window.QPCRTabletGuide?.close(); nav.active = false; resetConfirmation(); dialog.hidden = true; document.body.classList.remove('sc-navigating'); if ($('scPlanStatus')) $('scPlanStatus').textContent = '方案已失效，请修正设置后重新生成。'; if ($('scOpenNavigator')) $('scOpenNavigator').disabled = true; }
    function open() {
      if (!ensureValid()) return flash('请先生成有效的单通道方案。','error');
      const earliest = state.result.plates.findIndex(p => Q.stepsFor(p,state.project).some(s=>!Exec.isComplete(state.execution,p.number,s)));
      if (earliest >= 0) state.plate = earliest;
      state.step = Exec.resumeIndex(state.execution,selectedPlate().number,Q.stepsFor(selectedPlate(),state.project)); state.tab = 'steps';
      nav.active = true; resetConfirmation(); dialog.hidden = false; document.body.classList.add('sc-navigating'); renderNavigation();
    }
    function renderNavigation() {
      if (!nav.active || !ensureValid()) return;
      const s = current(), plate = selectedPlate(); nav.key = Exec.stepKey(s);
      $('scNavPlate').textContent = `Plate ${plate.number} / ${state.result.plates.length} · ${state.project.plateType} 孔 · 本板步骤 ${state.step+1}/${Q.stepsFor(plate,state.project).length}`;
      $('scNavPhase').textContent = phaseName(s.phase); $('scNavTitle').textContent = s.sourceName || s.title;
      $('scNavSource').textContent = s.wells.length ? `${s.targetCode||s.sampleCode||'对照'} · 来源管 ${s.tubeId} · ${s.phase === 'primer' ? 'Primer Rack' : 'Sample Rack'} ${s.sourceRackPosition}` : '复核本板全部引物、样品与对照';
      $('scNavMetrics').innerHTML = s.wells.length ? `<div>每孔体积<strong>${unit(s.perWell)}</strong></div><div>本板此来源总孔数<strong>${s.totalWellCount}</strong></div><div>本批孔数<strong>${s.wells.length}</strong></div><div>本次吸液体积<strong>${unit(s.aspirateVolume)}</strong></div><div>${s.capacityVerified?'吸液':'导航'}批次<strong>${s.navigationBatchIndex}/${s.navigationBatchCount}</strong></div><div>剩余批次<strong>${s.navigationBatchCount-s.navigationBatchIndex}</strong></div>` : '';
      $('scNavWells').textContent = s.wells.length ? '本批真实孔位：' + s.wells.join(' → ') : '此检查步骤不点亮孔位。';
      $('scNavRegions').textContent = s.wells.length ? `${s.region} · ${s.path} · ${s.placementKinds.map(k=>({standard:'标准区',compact:'紧凑矩形',strip:'连续条带',control:'对照区'}[k]||k)).join('、')}` : '';
      const done = Exec.isComplete(state.execution,plate.number,s);
      $('scNavStatus').textContent = done ? '本步骤已手动确认完成。重新执行前请点“重新检查当前批次”。' : canOperate() ? '本批已确认，可以操作；完成后明确点击下方完成按钮。' : '当前熄灭：请核对三个确认项，再点“确认并点亮本批”。';
      $('scComplete').disabled = !canOperate() || done; $('scBegin').disabled = !['scConfirmSource','scConfirmPhase','scConfirmA1'].every(id=>$(id).checked) || done;
      $('scPause').textContent = nav.paused ? '继续（重新确认）' : '暂停'; $('scTablet').disabled = !canOperate() || !s.wells.length;
      const svg = ctx.buildPlateSvg(plate,state.project,false); $('scNavPlateView').replaceChildren(svg);
      const lit = new Set(canOperate() ? s.wells : []);
      const completed = new Set(Q.stepsFor(plate,state.project).filter(step=>step.phase===s.phase&&Exec.isComplete(state.execution,plate.number,step)).flatMap(step=>step.wells));
      for (const g of svg.querySelectorAll('g[data-well]')) { g.classList.toggle('highlighted',lit.has(g.dataset.well)); g.classList.toggle('sc-completed',completed.has(g.dataset.well)); }
      renderSteps();
    }
    function completeCurrent() {
      if (!canOperate()) return false;
      const s = current(), plate = selectedPlate(), key = plate.number+':'+Exec.stepKey(s);
      if (Exec.isComplete(state.execution,plate.number,s) || nav.lastCompleted===key) return false;
      Exec.complete(state.execution,plate.number,s); nav.lastCompleted=key; resetConfirmation();
      const list = Q.stepsFor(plate,state.project);
      if (state.step < list.length-1) state.step++;
      else if (state.plate < state.result.plates.length-1) { state.plate++; state.step=Exec.resumeIndex(state.execution,selectedPlate().number,Q.stepsFor(selectedPlate(),state.project)); }
      changed(); renderNavigation(); return true;
    }
    $('scNavExit').onclick = exit;
    ['scConfirmSource','scConfirmPhase','scConfirmA1'].forEach(id => $(id).onchange=()=>{ if(!$(id).checked){nav.approved=false;nav.paused=true;nav.blackout=true;} renderNavigation(); });
    $('scBegin').onclick=()=>{ if(!ensureValid()||!['scConfirmSource','scConfirmPhase','scConfirmA1'].every(id=>$(id).checked))return; nav.approved=true;nav.paused=false;nav.blackout=false;renderNavigation(); };
    $('scComplete').onclick=completeCurrent;
    $('scPause').onclick=()=>{resetConfirmation();renderNavigation();}; $('scBlackout').onclick=()=>{resetConfirmation();renderNavigation();};
    $('scReview').onclick=()=>{if(!ensureValid())return;Exec.reopen(state.execution,selectedPlate().number,current());nav.lastCompleted='';resetConfirmation();changed();renderNavigation();};
    $('scTablet').onclick=()=>{if(canOperate())$('tabletGuideButton').click();};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&nav.active){resetConfirmation();renderNavigation();}});
    function metrics(plan) { const m=plan.metrics;return `<p class="sc-plan-metrics">逐孔分液 <strong>${m.wellDispenses}</strong> 次；${m.aspirationBatches==null?'吸液批次数未量程校验':`吸液 <strong>${m.aspirationBatches}</strong> 批`}；导航 ${m.navigationBatches} 批；来源切换 ${m.sourceSwitches} 次；孔间路径 ${m.distance} 个网格步长；吸头 ${m.tips==null?'未估算':m.tips+' 个（策略估算）'}。</p><p class="small">${esc(m.method)} 路径不含管架往返，未估算实际秒数；吸头数与吸液批次数独立统计。</p>`; }
    function sourceCard(s) {return `<article class="mix-card"><h3>${esc(s.tubeId)} · ${esc(s.label)}</h3><p>${s.phase==='primer'?'Primer Rack':'Sample Rack'} <strong>${esc(s.rackPosition)}</strong> · 全实验 ${s.required} 孔 · 每孔 ${unit(s.perWell)}</p><p>理论需求 ${unit(s.requiredVolume)} · 建议配制 <strong>${unit(s.total)}</strong> · 余量 ${unit(s.extra)}（含死体积 ${unit(s.deadVolume)}，只加一次）</p><table class="data-table"><thead><tr><th>组分</th><th>每孔 µL</th><th>配制 µL</th></tr></thead><tbody>${s.components.map(c=>`<tr><td>${esc(c.name)}</td><td>${Q.volume(c.perReaction)}</td><td>${Q.volume(c.total)}</td></tr>`).join('')}</tbody></table></article>`;}
    function rackGrid(phase,sources,cfg) {const map=new Map(sources.filter(s=>s.phase===phase).map(s=>[s.rackPosition,s]));return `<div class="sc-rack-scroll"><div class="sc-rack-grid" style="grid-template-columns:repeat(${cfg.rackColumns},minmax(58px,1fr))">${Array.from({length:cfg.rackRows*cfg.rackColumns},(_,i)=>{const pos=String.fromCharCode(65+Math.floor(i/cfg.rackColumns))+(i%cfg.rackColumns+1),s=map.get(pos);return `<div class="sc-rack-cell ${s?'is-used':''}" title="${esc(s?.label||'空位')}"><small>${pos}</small><strong>${esc(s?.tubeId||'—')}</strong></div>`;}).join('')}</div></div>`;}
    function renderPlan() {
      if (!SC.isMode(state.project)||!state.result?.singleChannelPlan){$('singleChannelResult').hidden=true;return;}
      const plan=state.result.singleChannelPlan,cfg=SC.config(state.project);
      $('singleChannelResult').hidden=false; $('singleChannelResult').innerHTML=`<h2>单通道移液操作计划</h2><p id="scPlanStatus">最终实际孔位已检查；每个普通反应孔准确分装两种液体。</p>${metrics(plan)}<div class="compact-actions"><button id="scOpenNavigator" type="button" class="primary">打开加样导航模式</button>${[['layout','孔板与孔位明细'],['primer','引物分装检查单'],['sampleMix','样品分装检查单'],['racks','来源管架'],['all','全部操作单']].map(([key,label])=>`<button type="button" class="ghost" data-sc-print="${key}">打印${label}</button>`).join('')}</div>${['primer','sampleMix'].map(phase=>`<details><summary>${phase==='primer'?'Target Primer Working Mix Rack':'Sample Master Mix Rack'}</summary>${rackGrid(phase,plan.sources,cfg[phase])}</details>`).join('')}<details><summary>编辑来源管标签、位置与容量（修改后重新生成）</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>来源</th><th>管标签</th><th>管架位置</th><th>容量 µL（可选）</th><th>需求 / 配制 µL</th></tr></thead><tbody>${plan.sources.map((s,i)=>`<tr><td>${esc(s.label)}</td><td><input aria-label="${esc(s.label)} 管标签" data-source-index="${i}" data-source-field="tubeId" value="${esc(s.tubeId)}"></td><td><input aria-label="${esc(s.label)} 管架位置" data-source-index="${i}" data-source-field="rackPosition" value="${esc(s.rackPosition)}"></td><td><input aria-label="${esc(s.label)} 容量" data-source-index="${i}" data-source-field="capacity" type="number" min="0" step="any" value="${s.capacity??''}"></td><td>${Q.volume(s.requiredVolume)} / ${Q.volume(s.total)}</td></tr>`).join('')}</tbody></table></div><button id="scApplyRack" type="button" class="ghost">应用来源管设置并使旧清单失效</button></details>`;
      $('scOpenNavigator').onclick=open;
      $('singleChannelResult').querySelectorAll('[data-sc-print]').forEach(b=>b.onclick=()=>{if(ensureValid()){ctx.printSingle(b.dataset.scPrint);}});
      $('scApplyRack').onclick=()=>{const cfg=readSettings();$('singleChannelResult').querySelectorAll('[data-source-field]').forEach(input=>{const source=plan.sources[Number(input.dataset.sourceIndex)];if(!Object.hasOwn(cfg.sources,source.id))cfg.sources[source.id]={};cfg.sources[source.id][input.dataset.sourceField]=input.dataset.sourceField==='capacity'?(input.value===''?null:Number(input.value)):input.value.trim();});state.singleChannelSettings=cfg;markStale('来源管已修改，请重新生成并核对管架。');};
      $('mixCards').innerHTML=`<p class="small">下面按实际物理来源管配制；每管按全实验需求计算一次余量，避免按板重复计入。不同来源分别配制，不再逐孔拆加模板与 SYBR。</p>${plan.sources.map(sourceCard).join('')}`;
    }
    const chunks=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));
    function printPages(plates,kind='all',previewOnly=false) {
      const plan=state.result.singleChannelPlan,cfg=SC.config(state.project),orientation=ctx.printOrientation();
      const page=(title,content)=>`<article class="print-page sc-print-page ${window.QPCRView.printLayout(state.project.plateType,orientation).className}"><header class="print-header"><h1>${esc(title)}</h1><p>${esc(state.project.metadata.name)} · v${Q.APP_VERSION} · ${esc(state.project.metadata.date)} · ${esc(state.project.metadata.operator)}</p></header>${content}</article>`;
      const result=[];
      if(['layout','all'].includes(kind))for(const plate of plates){result.push(page(`最终孔板布局 · Plate ${plate.number} · ${state.project.plateType} 孔`,ctx.buildPlateSvg(plate,state.project,true).outerHTML+`<p>▲ A1；△ 主/其他内参；虚线框为紧凑区域；所有孔位来自最终分配。</p>`));if(previewOnly)continue;for(const group of chunks([...plate.wells].sort((a,b)=>a.well.localeCompare(b.well,undefined,{numeric:true})),26))result.push(page(`孔位明细 · Plate ${plate.number}`,`<table class="data-table"><thead><tr><th>Well</th><th>Sample / 对照</th><th>Target</th><th>重复</th><th>区域</th></tr></thead><tbody>${group.map(w=>`<tr><td>${w.well}</td><td>${esc(w.sample)} · ${w.type==='sample'?'S'+String(state.project.samples.indexOf(w.sample)+1).padStart(2,'0'):esc(w.type)}</td><td>${esc(w.gene)} · T${String(state.project.genes.findIndex(g=>g.id===w.geneId)+1).padStart(2,'0')}${w.geneType==='reference'?' △':''}</td><td>R${w.replicate}/${w.replicateTotal}</td><td>Q${SC.region(w.well,state.project.plateType)+1} · ${esc(w.placementKind)}</td></tr>`).join('')}</tbody></table>`));}
      for(const phase of ['primer','sampleMix'])if(['all',phase].includes(kind))for(const plate of plates)for(const group of chunks(plan.steps.filter(s=>s.plateId===plate.number&&s.phase===phase),6))result.push(page(`${phaseName(phase)} · Plate ${plate.number}`,`<table class="data-table"><thead><tr><th>来源 / 管架</th><th>体积 / 本板总孔</th><th>本批</th><th>真实孔位与顺序</th><th>完成</th></tr></thead><tbody>${group.map(s=>{const source=plan.sources.find(p=>p.id===s.sourceId);return `<tr><td>${esc(s.sourceName)}<br>${esc(s.tubeId)} · ${esc(s.sourceRackPosition)}<br>配制 ${unit(source.total)}</td><td>每孔 ${unit(s.perWell)}<br>本板 ${s.totalWellCount} 孔</td><td>${s.navigationBatchIndex}/${s.navigationBatchCount}<br>${s.wells.length} 孔<br>吸液 ${unit(s.aspirateVolume)}</td><td>${s.region} · ${esc(s.placementKinds.join('/'))}<br>${s.wells.join(' → ')}</td><td>□</td></tr>`;}).join('')}</tbody></table><p>□ 来源管及阶段已核对　□ Plate / A1 已核对；未知吸液批次仅为导航分段，须核对移液器量程。</p>`));
      if(['all','racks'].includes(kind))for(const phase of ['primer','sampleMix']){
        const device=cfg[phase],sources=plan.sources.filter(s=>s.phase===phase),map=new Map(sources.map(s=>[s.rackPosition,s]));
        for(let row=0;row<device.rackRows;row+=8)for(let col=0;col<device.rackColumns;col+=12){const cells=[];for(let r=row;r<Math.min(row+8,device.rackRows);r++){const columns=[];for(let c=col;c<Math.min(col+12,device.rackColumns);c++){const pos=String.fromCharCode(65+r)+(c+1),s=map.get(pos);columns.push(`<td>${pos}<br><strong>${esc(s?.tubeId||'—')}</strong></td>`);}cells.push('<tr>'+columns.join('')+'</tr>');}result.push(page(phase==='primer'?'Primer Mix Rack':'Sample Master Mix Rack',`<table class="sc-print-rack">${cells.join('')}</table><p>空位为 —；按下一页来源表核对全名和体积。</p>`));}
        for(const group of chunks(sources,16))result.push(page((phase==='primer'?'Primer Rack':'Sample Rack')+' 来源清单',`<table class="data-table"><thead><tr><th>管标签</th><th>位置</th><th>来源全名</th><th>孔数</th><th>需求 / 配制 µL</th></tr></thead><tbody>${group.map(s=>`<tr><td>${esc(s.tubeId)}</td><td>${esc(s.rackPosition)}</td><td>${esc(s.label)}</td><td>${s.required}</td><td>${Q.volume(s.requiredVolume)} / ${Q.volume(s.total)}</td></tr>`).join('')}</tbody></table>`));
      }
      return result.join('');
    }
    const api={nav,readSettings,loadSettings,showConfig,renderPlan,open,exit,invalidate,syncBatch,canOperate,ensureValid,completeCurrent,renderNavigation,printPages}; window.QPCRSingleChannelUI.current=api;loadSettings();return api;
  } };
})();
