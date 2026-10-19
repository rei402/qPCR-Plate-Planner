(() => {
  'use strict';
  const Q = window.QPCR;
  const View = window.QPCRView;
  const Sel = window.QPCRSelection;
  const Colors = window.QPCRPlateColors;
  const Exec = window.QPCRExecution;
  const IO = window.QPCRProjectIO;
  const Single = window.QPCRSingleChannel;
  const $ = id => document.getElementById(id);
  const state = { project: null, result: null, plate: 0, step: 0, tab: 'mix', editorActive: false, selectedWells: new Set(), previewWells: new Set(), selectionAnchor: null, lastSelectedWell: null, hoverWells: new Set(), drag: null, dragFrame: 0, editHistory: { undo: [], redo: [] }, reservedDirty: false, selectedWell: '', presets: {}, checklist: Q.DEFAULT_CHECKLIST.map(g => [...g]), disabledChecklist: new Set(), premixSelectedIds: new Set(), premixWaste: null, premixExtra: null, componentCounter: 0, plateZoom: 1 };
  Object.assign(state, { sampleMetadata: Object.create(null), geneRecords: [], assaySelection: null, assayRecipes: Object.create(null), execution: null, dirty: false, draftTimer: 0, draftSaved: false });
  let capacityTimer = 0;
  let draftStorage; try { draftStorage = IO.draftStore(localStorage); } catch (_) { draftStorage = IO.draftStore({ getItem() { return null; }, setItem() { throw new Error('storage disabled'); }, removeItem() {} }); }
  const roleNames = { mastermix: '通用 Mix', forward_primer: '正向引物', reverse_primer: '反向引物', probe: '探针', water: '水', template: '模板', other: '其他' };
  const typeNames = { sample: 'Sample', ntc: 'NTC', noRT: 'No-RT', positive: 'Positive control', calibrator: '跨板校准' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = id => Number($(id).value);
  const fileName = value => String(value || '未命名实验').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  const { resolveGenes, renderSampleExtensions, renderAssayChoices, addOverrideRow, loadOverride, applyOverride, addRecipeRow, recipeFromForm, setRecipe, renderPremixOptions, renderRecipeSummary, updateSampleOptions, setControlsVisibility, readProject, setForm } = window.QPCRForms.create({ Q, state, $, IO, Colors, roleNames, esc, number, markStale: (...args) => markStale(...args), changed: (...args) => changed(...args), renderCapacity: (...args) => renderCapacity(...args), printOrientation: (...args) => printOrientation(...args), updateColorControls: (...args) => updateColorControls(...args), renderChecklistEditor: (...args) => renderChecklistEditor(...args), updatePrintPageStyle: (...args) => updatePrintPageStyle(...args), updateZoomControls: (...args) => updateZoomControls(...args), flash: (...args) => flash(...args) });
  const { buildPlateSvg, updateZoomControls, renderPlate, wellClick } = window.QPCRPlateRenderer.create({ Q, View, Sel, Colors, state, $, esc, typeNames, selectedPlate: (...args) => selectedPlate(...args), readProject: (...args) => readProject(...args), sampleCode: (...args) => sampleCode(...args), geneCode: (...args) => geneCode(...args), selectEditorItem: (...args) => selectEditorItem(...args), updateSelectionVisuals: (...args) => updateSelectionVisuals(...args), attachDragHandlers: (...args) => attachDragHandlers(...args) });
  const { printPage, scalePrintPreview, renderPrint, renderReagentPrint, reagentTable } = window.QPCRPrint.create({ Q, View, state, $, esc, buildPlateSvg: (...args) => buildPlateSvg(...args), selectedPlate: (...args) => selectedPlate(...args), updatePrintPageStyle: (...args) => updatePrintPageStyle(...args), printOrientation: (...args) => printOrientation(...args) });
  const singleUI = window.QPCRSingleChannelUI.create({ Q, state, $, esc, changed, markStale, renderSteps, renderPlate, renderPrint, selectedPlate, completeStep, flash, readProject, renderAssayChoices, printOrientation, buildPlateSvg: (p,project,forPrint) => buildPlateSvg(p,forPrint), printSingle: kind => { $('printSheet').innerHTML=singleUI.printPages(state.result.plates,kind); window.addEventListener('afterprint',()=>renderPrint(),{once:true}); window.print(); } });
  function printOrientation() { return document.querySelector('input[name="printOrientation"]:checked')?.value || Q.NEW_PROJECT_DEFAULTS.printOrientation; }
  function updatePrintPageStyle() { $('dynamic-print-page-style').textContent = View.printPageRule(Number($('plateType').value), printOrientation()); }

  function flash(message, kind = 'info') { $('validationMessages').innerHTML = `<div class="message ${kind}">${esc(message)}</div>`; }
  function storePreferences() {
    try {
      localStorage.setItem('qpcr-preferences-v1', JSON.stringify({ defaultsRevision: 1, paletteId: state.paletteId || Q.NEW_PROJECT_DEFAULTS.paletteId, plateType: $('plateType').value, replicates: $('replicates').value, wastePercent: $('wastePercent').value, minimumExtra: $('minimumExtra').value, minPipetteVolume: $('minPipetteVolume').value, pipette: $('pipette').value, layoutMode: $('layoutMode').value, referenceRowPreference:$('referenceRowPreference').value, allocationMode: $('allocationMode').value, printOrientation: printOrientation(), plateZoom: state.plateZoom, checklist: state.checklist, disabledChecklist: [...state.disabledChecklist] }));
    } catch (_) { /* 本地存储禁用时，核心功能仍可运行 */ }
  }
  function loadStorage() {
    try {
      state.presets = JSON.parse(localStorage.getItem('qpcr-presets-v1') || '{}');
      if (!state.presets || typeof state.presets !== 'object' || Array.isArray(state.presets)) state.presets = {};
      state.presets = Object.assign(Object.create(null),state.presets);
      const pref = JSON.parse(localStorage.getItem('qpcr-preferences-v1') || '{}');
      for (const key of ['plateType', 'replicates', 'wastePercent', 'minimumExtra', 'minPipetteVolume', 'pipette', 'referenceRowPreference', 'allocationMode']) if (pref[key] !== undefined && $(key)) $(key).value = pref[key];
      // Adopt revised defaults once; subsequently retain choices made with this profile.
      if (pref.defaultsRevision === 1) {
        if ([...$('layoutMode').options].some(option => option.value === pref.layoutMode)) $('layoutMode').value = pref.layoutMode;
        if (['landscape', 'portrait'].includes(pref.printOrientation)) document.querySelector(`input[name="printOrientation"][value="${pref.printOrientation}"]`).checked = true;
        if (Colors.palettes.some(p => p.id === pref.paletteId)) state.paletteId = pref.paletteId;
      }
      if ([1, 1.25, 1.5].includes(Number(pref.plateZoom))) state.plateZoom = Number(pref.plateZoom);
      if (Array.isArray(pref.checklist) && pref.checklist.length && pref.checklist.every(g => Array.isArray(g) && g.length && g.every(x => typeof x === 'string'))) state.checklist = pref.checklist;
      if (Array.isArray(pref.disabledChecklist) && pref.disabledChecklist.every(x => typeof x === 'string')) state.disabledChecklist = new Set(pref.disabledChecklist);
    } catch (_) { state.presets = Object.create(null); }
  }
  function savePresets() { try { localStorage.setItem('qpcr-presets-v1', JSON.stringify(state.presets)); } catch (_) { flash('浏览器无法保存本机预设；仍可导出项目 JSON。', 'warning'); } }

  function snapshot() { return { ...Q.saveObject(state.project || readProject(), state.result, state.execution), generated: !!state.result, navigation: { plate: state.plate, step: state.step } }; }
  function status() { $('projectStatus').textContent = `${state.dirty ? '● 有未导出的修改' : '✓ 项目已导出或载入'}${state.draftSaved ? ' · 本机草稿已保存' : state.pendingDraft ? ' · 请先恢复或丢弃旧草稿以启用自动保存' : ' · 本机草稿尚未保存'}`; }
  function persistDraft() {
    clearTimeout(state.draftTimer);
    if (state.pendingDraft) { state.draftSaved = false; status(); return false; }
    try { state.draftSaved = draftStorage.write(snapshot()); } catch (_) { state.draftSaved = false; }
    status(); return state.draftSaved;
  }
  function changed() { state.dirty = true; state.draftSaved = false; status(); clearTimeout(state.draftTimer); state.draftTimer = setTimeout(persistDraft, 250); }
  function syncChecklist() {
    if (state.project) { state.project.settings.checklist = state.checklist.map(g => [...g]); state.project.settings.disabledChecklist = [...state.disabledChecklist]; }
    storePreferences(); changed(); if (state.result) { renderChecks(); renderPrint(); }
  }
  function applyLoaded(value, regenerate = false) {
    // Validate the entire file and layout before touching the current form.
    const loaded = regenerate ? { project: Q.loadObject(value) } : Q.restoreObject(value);
    if (regenerate) { loaded.result = Q.generate(loaded.project); if (!loaded.result.ok) throw new Error(loaded.result.errors.join('；')); }
    const execution = Exec.create(loaded.project, loaded.result, regenerate ? null : loaded.execution);
    setForm(loaded.project); state.project = loaded.project; state.result = loaded.result; state.execution = execution; state.pendingDraft = null; $('draftNotice').hidden = true;
    state.plate = Math.max(0, Math.min(value.navigation?.plate || 0, loaded.result.plates.length - 1));
    state.step = Exec.resumeIndex(execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)); state.dirty = false;
    renderResults(); persistDraft(); flash(regenerate ? '项目已明确重新排板，执行进度已清空。' : '项目及原始孔位已恢复，执行进度已校验。', 'success');
  }
  function renderReagents() {
    if (!state.result) return;
    const summary = Q.reagentSummary(state.result.plates, state.project);
    $('reagentSummary').innerHTML = reagentTable(summary);
  }
  function rememberStep() { if (!state.result) return; Exec.cursor(state.execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)[state.step]); changed(); }
  function completeStep() { if (!state.result) return; if(Single.isMode(state.project)){singleUI.completeCurrent();return;} const steps = Q.stepsFor(selectedPlate(), state.project); Exec.complete(state.execution, selectedPlate().number, steps[state.step]); state.step = Math.min(state.step + 1, steps.length - 1); rememberStep(); renderSteps(); }
  function importSamples(text) {
    const rows = IO.parseTable(text); $('samples').value = rows.map(r => r.sample).join('\n');
    let next = Math.max(-1, ...Object.values(state.sampleMetadata).map(m => m.colorIndex ?? 0)) + 1;
    for (const r of rows) state.sampleMetadata[r.sample] = { ...(state.sampleMetadata[r.sample] || { id: 'sample-' + next, colorIndex: next++ }), group: r.group, biologicalReplicate: r.biologicalReplicate };
    updateSampleOptions(); markStale(); flash(`已导入 ${rows.length} 个样本，请重新生成。`, 'success');
  }

  function markStale(reason = '输入发生变化，原排板和 Mix 已隐藏，避免使用过期结果。') {
    singleUI.invalidate();
    window.QPCRTabletGuide?.close();
    $('tabletGuideButton').disabled = true;
    if (state.result) {
      state.result = null; state.project = null;
      state.execution = null;
      $('plateHeading').textContent = '设置已修改，请重新生成';
      $('plateView').innerHTML = `<div class="empty-state"><strong>需要重新生成孔板</strong><p>${esc(reason)}</p></div>`;
      $('mixCards').innerHTML = '<p class="muted">请重新生成。</p>';
      $('stepContent').innerHTML = '<p class="muted">请重新生成。</p>';
      $('checksContent').innerHTML = '<p class="muted">请重新生成。</p>';
      $('legend').replaceChildren(); $('plateSwitcher').hidden = true; $('printSheet').replaceChildren(); $('printPreview').innerHTML = '<p class="muted">请重新生成后查看打印预览。</p>'; $('reagentSummary').innerHTML = '<p class="muted">请重新生成。</p>'; $('progressSummary').replaceChildren();
    }
    scheduleCapacity(); storePreferences(); changed();
  }
  function labCapacity(metas,loads,capacity) {
    const standard=new Set(metas.flatMap(m=>m.standardSamples)), residual=new Set(metas.flatMap(m=>m.residualSamples));
    return `<span>标准区 ${standard.size} 个样品 / ${metas.reduce((n,m)=>n+m.standardWells,0)} 孔；剩余区 ${residual.size} 个样品 / ${metas.reduce((n,m)=>n+m.residualWells,0)} 孔（跨区域样品可分别计入）；对照 ${metas.reduce((n,m)=>n+m.controlWells,0)} 孔。</span><span>${loads.map((n,i)=>`Plate ${i+1}：${n}/${capacity} 孔，${(n/capacity*100).toFixed(1)}%`).join('；')}</span>`;
  }
  function scheduleCapacity() {
    clearTimeout(capacityTimer);
    $('capacity').textContent = '设置已变化，正在更新容量预检查…';
    capacityTimer = setTimeout(() => { capacityTimer = 0; if (!state.result) renderCapacity(); }, 300);
  }
  function renderCapacity() {
    clearTimeout(capacityTimer); capacityTimer = 0;
    const p = readProject();
    const plan = Q.capacityPlan(p), n = plan.ok ? plan.expected : Q.expectedCounts(p);
    let reserved = 0;
    try { reserved = Q.parseReserved(p.settings.reserved, p.plateType).length; }
    catch (e) { $('capacity').innerHTML = `<span class="error-text">${esc(e.message)}</span>`; return; }
    const available = p.plateType - reserved;
    if (available <= 0) { $('capacity').innerHTML = '<span class="error-text">没有可用孔。</span>'; return; }
    if (!plan.ok && p.settings.layoutMode === 'labPriorityHybrid') { $('capacity').innerHTML=`<strong>容量预检查</strong><span class="error-text">${plan.errors.map(esc).join('；')}</span>`; return; }
    const plates = plan.ok ? plan.plateCount : Math.ceil(n.total / available);
    const details=plan.layoutMetadata ? labCapacity(plan.layoutMetadata,plan.loads,available) : '';
    $('capacity').innerHTML = `<strong>容量预检查</strong><span>样本 ${p.samples.length}、assay ${p.genes.length}、技术重复 ${p.replicates}：样本反应 ${n.sample} 孔；NTC ${n.ntc}、No-RT ${n.noRT}、阳性 ${n.positive}、校准 ${n.calibrator}；合计 <strong>${n.total} 孔</strong>。</span><span>${p.plateType} 孔板保留 ${reserved} 孔，可用 ${available} 孔；预计 <strong>${Number.isFinite(plates) ? plates : '—'} 块板</strong>，全板可用孔使用率 ${Number.isFinite(n.total / available) ? (n.total / (available * plates) * 100).toFixed(1) : '—'}%。${p.controls.calibratorSample ? ' 校准孔已计入容量。' : ''}</span>${details}`;
  }

  function generate() {
    clearTimeout(capacityTimer); capacityTimer = 0;
    window.QPCRTabletGuide?.close();
    singleUI.invalidate();
    const project = readProject(), result = Q.generate(project);
    if (!result.ok) { state.result = null; state.project = null; $('tabletGuideButton').disabled = true; $('plateHeading').textContent = '无法生成'; $('plateView').innerHTML = '<div class="empty-state error-text">请修改左侧错误后重新生成。</div>'; $('mixCards').replaceChildren(); $('stepContent').replaceChildren(); $('checksContent').replaceChildren(); $('legend').replaceChildren(); $('plateSwitcher').hidden = true; $('printSheet').replaceChildren(); $('printPreview').innerHTML = '<p class="muted">请修正错误后查看打印预览。</p>'; $('validationMessages').innerHTML = result.errors.map(e => `<div class="message error">${esc(e)}</div>`).join(''); if (state.editorActive) renderPlate(); return; }
    state.project = project; state.result = result; state.plate = 0; state.step = 0; state.selectedWell = ''; state.reservedDirty = false; $('layoutStaleNotice').hidden = true;
    state.execution = Exec.create(project, result, state.execution); changed();
    $('validationMessages').innerHTML = `<div class="message success">✓ ${result.expected.total} 个反应已分配到 ${result.plates.length} 块孔板；一致性检查通过。</div>` + result.warnings.map(w => `<div class="message warning">⚠ ${esc(w)}</div>`).join('') + (result.infos || []).map(info => `<div class="message info">✓ ${esc(info)}</div>`).join('');
    renderResults();
  }
  function sampleCode(sample) { const i = state.project.samples.indexOf(sample); return i < 0 ? sample === 'NTC' ? 'NTC' : '对照' : 'S' + String(i + 1).padStart(2, '0'); }
  function geneCode(geneId) { const i = state.project.genes.findIndex(g => g.id === geneId); return 'T' + String(i + 1).padStart(2, '0'); }
  function selectedPlate() { return state.result?.plates[state.plate]; }
  function renderResults() {
    const p = selectedPlate();
    $('plateHeading').textContent = `Plate ${p.number} / ${state.result.plates.length} · ${state.project.plateType} 孔`;
    $('capacity').innerHTML = `<strong>✓ 排板完成</strong><span>总计 ${state.result.expected.total} 孔，${state.result.plates.length} 块板。NTC ${state.result.expected.ntc}、No-RT ${state.result.expected.noRT}、阳性 ${state.result.expected.positive}、校准 ${state.result.expected.calibrator} 孔。当前板 ${p.wells.length} / ${p.capacity} 个可用孔；保留 ${state.result.reserved.length} 孔。</span><span>布局候选：${p.sequence === 'sample' ? '按样品' : '按基因'} · ${{ singleChannelOptimized: String.fromCharCode(21333,36890,36947,31227,28082,20248,21270), labPriorityHybrid:'实验室优先布局', saved:'保存的原始孔位', horizontal: '横向', vertical: '纵向', serpentine: '蛇形', block: '区块' }[p.layout]}；所有反应、对照和 Mix 数量一致。</span>${p.layoutMetadata ? labCapacity(state.result.plates.map(x=>x.layoutMetadata),state.result.plates.map(x=>x.wells.length),p.capacity) : ''}`;
    const switcher = $('plateSwitcher'); switcher.hidden = state.result.plates.length < 2;
    switcher.innerHTML = state.result.plates.map((x, i) => `<button type="button" data-plate="${i}" class="${i === state.plate ? 'active' : ''}">Plate ${x.number} · ${x.wells.length} 孔</button>`).join('');
    switcher.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.plate = Number(b.dataset.plate); state.step = Exec.resumeIndex(state.execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)); state.selectedWell = ''; renderResults(); }));
    updateZoomControls(); renderPlate(); renderLegend(); renderMixes(); renderReagents(); renderSteps(); renderChecks(); renderPrint(); updateTabletEntry();
  }
  function updateTabletEntry() {
    const ready = !!state.result?.ok && !!selectedPlate() && Q.stepsFor(selectedPlate(), state.project).some(step => step.wells.length > 0);
    $('tabletGuideButton').disabled = !ready;
    const select = $('tabletGuidePlateSelect'), count = state.result?.plates.length || 0;
    $('tabletGuidePlateWrap').hidden = count < 2;
    if (count) { select.innerHTML = state.result.plates.map((plate, i) => `<option value="${i}">Plate ${plate.number}</option>`).join(''); select.value = String(state.plate); }
  }

  function editorType() { return Number($('plateType').value); }
  function currentReserved() { return new Set(Q.parseReserved($('reservedWells').value, editorType())); }
  function updateSelectionVisuals() {
    if (!state.editorActive) return;
    const svg = $('plateView').querySelector('svg'); if (!svg) return;
    let reserved; try { reserved = currentReserved(); } catch (e) { flash(e.message, 'error'); reserved = new Set(); }
    const summary = Sel.selectionSummary(state.selectedWells, reserved);
    $('selectionSummary').textContent = `已选择 ${summary.total} 个孔，其中 ${summary.available} 个可用、${summary.reserved} 个已保留`;
    for (const well of svg.querySelectorAll('g[data-well]')) {
      const id = well.dataset.well;
      well.classList.toggle('editor-selected', state.selectedWells.has(id));
      well.classList.toggle('editor-preview', state.previewWells.has(id));
      well.classList.toggle('editor-hover', state.hoverWells.has(id));
      const base = id + '，' + (reserved.has(id) ? '已保留' : well.classList.contains('occupied') ? '已分配反应' : '可用');
      well.setAttribute('aria-label', base + (state.selectedWells.has(id) ? '，当前选中' : ''));
      well.setAttribute('aria-pressed', String(state.selectedWells.has(id)));
    }
    for (const header of svg.querySelectorAll('[data-header-kind]')) {
      const kind = header.dataset.headerKind, value = header.dataset.headerValue;
      const wells = kind === 'all' ? Sel.allWells(editorType()) : kind === 'row' ? Sel.getRowWells(value, editorType()) : Sel.getColumnWells(value, editorType());
      const count = wells.filter(w => state.selectedWells.has(w)).length;
      header.classList.toggle('header-selected', count === wells.length);
      header.classList.toggle('header-partial', count > 0 && count < wells.length);
      header.setAttribute('aria-pressed', count === wells.length ? 'true' : count ? 'mixed' : 'false');
    }
    $('plateEditorToolbar').querySelector('[data-editor-action="reserve"]').disabled = !summary.available;
    $('plateEditorToolbar').querySelector('[data-editor-action="restore"]').disabled = !summary.reserved;
    $('plateEditorToolbar').querySelector('[data-editor-action="clear"]').disabled = !summary.total;
    $('plateEditorToolbar').querySelector('[data-editor-action="undo"]').disabled = !state.editHistory.undo.length;
    $('plateEditorToolbar').querySelector('[data-editor-action="redo"]').disabled = !state.editHistory.redo.length;
    $('wellDetails').textContent = summary.total ? `当前选择 ${summary.total} 个孔；选择状态仅用于编辑，不会写入项目或导出。` : '点击孔位、行号或列号开始选择；▲ A1 可选择全部。';
  }
  function selectEditorItem(kind, value, event = {}) {
    if (!state.editorActive) return;
    if (kind === 'all') { state.selectedWells = new Set(Sel.allWells(editorType())); state.selectionAnchor = null; state.lastSelectedWell = null; }
    else { const next = Sel.clickSelection(state.selectedWells, state.selectionAnchor, kind, value, event, editorType()); state.selectedWells = next.selected; state.selectionAnchor = next.anchor; state.lastSelectedWell = next.lastSelectedWell; }
    state.previewWells.clear(); updateSelectionVisuals();
  }
  function endDrag(svg, event, commit) {
    const drag = state.drag; if (!drag || drag.pointerId !== event.pointerId) return;
    if (state.dragFrame) { cancelAnimationFrame(state.dragFrame); state.dragFrame = 0; }
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    state.drag = null; state.previewWells.clear();
    if (commit) {
      if (drag.moved) {
        const target = wellAtPoint(svg, event.clientX, event.clientY, drag.type) || drag.target;
        const rect = Sel.getRectSelection(drag.start, target, drag.type);
        state.selectedWells = drag.additive ? Sel.addSelection(drag.original, rect) : Sel.replaceSelection(rect);
        state.selectionAnchor = { type: 'well', value: drag.start }; state.lastSelectedWell = target;
      } else selectEditorItem('well', drag.start, drag.modifiers);
    }
    updateSelectionVisuals();
  }
  function wellAtPoint(svg, x, y, type) {
    const matrix = svg.getScreenCTM(); if (!matrix) return null;
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    const local = point.matrixTransform(matrix.inverse()), cfg = View.PLATE_DISPLAY_CONFIG[type];
    const col = Math.max(1, Math.min(Q.COLS[type], Math.floor((local.x - cfg.marginX) / (cfg.wellWidth + cfg.horizontalGap)) + 1));
    const row = Math.max(0, Math.min(Q.ROWS[type] - 1, Math.floor((local.y - cfg.marginY) / (cfg.wellHeight + cfg.verticalGap))));
    return String.fromCharCode(65 + row) + col;
  }
  function attachDragHandlers(svg, type) {
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !state.editorActive) return;
      const well = event.target.closest('g[data-well]')?.dataset.well; if (!well) return;
      event.preventDefault(); svg.setPointerCapture(event.pointerId);
      state.drag = { pointerId: event.pointerId, svg, start: well, target: well, original: new Set(state.selectedWells), additive: !!(event.ctrlKey || event.metaKey), modifiers: { ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey }, x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, type, moved: false };
    });
    svg.addEventListener('pointermove', event => {
      const drag = state.drag; if (!drag || drag.pointerId !== event.pointerId) return;
      drag.x = event.clientX; drag.y = event.clientY;
      if (Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) > 3) drag.moved = true;
      if (!state.dragFrame) state.dragFrame = requestAnimationFrame(function frame() {
        state.dragFrame = 0; if (!state.drag) return;
        const view = $('plateView'), bounds = view.getBoundingClientRect(), edge = 32;
        let scrolled = false;
        if (drag.x >= bounds.left && drag.x <= bounds.right && drag.y >= bounds.top && drag.y <= bounds.bottom) {
          const speed = drag.x < bounds.left + edge ? -Math.ceil((bounds.left + edge - drag.x) / 4) : drag.x > bounds.right - edge ? Math.ceil((drag.x - (bounds.right - edge)) / 4) : 0;
          if (speed) { const before = view.scrollLeft; view.scrollLeft += speed; scrolled = view.scrollLeft !== before; }
        }
        const previous = drag.target;
        const target = wellAtPoint(svg, drag.x, drag.y, type);
        if (target && target !== drag.target) { drag.target = target; drag.moved = true; }
        if (drag.moved && (previous !== drag.target || scrolled || !state.previewWells.size)) { state.previewWells = new Set(Sel.getRectSelection(drag.start, drag.target, type)); updateSelectionVisuals(); }
        if (scrolled) state.dragFrame = requestAnimationFrame(frame);
      });
    });
    svg.addEventListener('pointerup', event => endDrag(svg, event, true));
    svg.addEventListener('pointercancel', event => endDrag(svg, event, false));
  }
  function applyReservedState(next, message) {
    $('reservedWells').value = Q.coordinates(editorType()).filter(x => next.has(x.well)).map(x => x.well).join(', ');
    state.reservedDirty = true; $('layoutStaleNotice').hidden = false;
    markStale('孔板可用孔设置已变化，当前排板需要重新生成。');
    $('plateHeading').textContent = '保留孔已修改 · 需要重新生成';
    renderPlate(); flash(message + ' 当前排板需要重新生成。', 'warning');
  }
  function editorAction(action) {
    if (!state.editorActive) return;
    if (action === 'done') { toggleEditor(); return; }
    let reserved; try { reserved = currentReserved(); } catch (e) { flash(e.message, 'error'); return; }
    if (action === 'all') state.selectedWells = new Set(Sel.allWells(editorType()));
    else if (action === 'reserved') state.selectedWells = new Set(reserved);
    else if (action === 'invert') state.selectedWells = Sel.invertSelection(state.selectedWells, editorType());
    else if (action === 'clear') { state.selectedWells.clear(); state.selectionAnchor = null; state.lastSelectedWell = null; }
    else if (action === 'reserve' || action === 'restore') {
      const next = Sel.applyReserved(reserved, state.selectedWells, action);
      const assigned = action === 'reserve' && state.result ? state.result.plates.flatMap(p => p.wells).filter(r => state.selectedWells.has(r.well) && !reserved.has(r.well)).length : 0;
      if (assigned && !window.confirm(`所选孔中有 ${assigned} 个当前已分配反应。设为保留后当前排板将失效，需要重新生成。继续吗？`)) return;
      const change = Sel.commitReserved(state.editHistory, reserved, next);
      if (change.changed) { state.editHistory = change.history; applyReservedState(change.reserved, action === 'reserve' ? '已将所选孔设为保留。' : '已将所选孔恢复可用。'); return; }
    } else if (action === 'undo' || action === 'redo') {
      const change = action === 'undo' ? Sel.undoReserved(state.editHistory, reserved) : Sel.redoReserved(state.editHistory, reserved);
      if (change.changed) { state.editHistory = change.history; applyReservedState(change.reserved, action === 'undo' ? '已撤销保留孔修改。' : '已重做保留孔修改。'); return; }
    }
    if (['all', 'reserved', 'invert'].includes(action)) { state.selectionAnchor = null; state.lastSelectedWell = null; }
    updateSelectionVisuals();
  }
  function toggleEditor() {
    state.editorActive = !state.editorActive;
    if (!state.editorActive) { if (state.dragFrame) cancelAnimationFrame(state.dragFrame); state.dragFrame = 0; if (state.drag?.svg.hasPointerCapture(state.drag.pointerId)) state.drag.svg.releasePointerCapture(state.drag.pointerId); state.drag = null; state.selectedWells.clear(); state.previewWells.clear(); state.hoverWells.clear(); state.selectionAnchor = null; state.lastSelectedWell = null; }
    $('reserveModeButton').textContent = state.editorActive ? '完成编辑' : '编辑孔板';
    $('reserveModeButton').setAttribute('aria-pressed', String(state.editorActive)); $('plateEditorToolbar').hidden = !state.editorActive;
    if (state.result || state.editorActive) renderPlate();
    else if (state.reservedDirty) $('plateView').innerHTML = '<div class="empty-state"><strong>需要重新生成孔板</strong><p>保留孔已修改；点击“重新生成孔板”更新排板。</p></div>';
    else $('plateView').innerHTML = '<div class="empty-state"><div class="empty-grid" aria-hidden="true">▦</div><strong>孔板将在此显示</strong><p>先核对样本、基因、反应体系和对照设置。</p></div>';
    $('plateView').classList.toggle('plate-editing', state.editorActive);
    if (!state.editorActive) $('wellDetails').textContent = '点击孔位可查看完整信息；▲ 表示 A1 方向。';
  }
  function renderLegend() {
    const display = state.project.settings.display;
    const swatch = index => `<span class="legend-swatch" style="background:${Colors.identityColor(index, display.paletteId, state.project.plateType).background};border-color:${Colors.identityColor(index, display.paletteId, state.project.plateType).border}"></span>`;
    $('legend').innerHTML = `<div><h3>样本编号${display.colorBy === 'sample' ? ' · 颜色' : ''}</h3>${state.project.samples.map((s, i) => `<div>${display.colorBy === 'sample' ? swatch(state.project.sampleMetadata[s]?.colorIndex ?? i) : ''}<strong>S${String(i + 1).padStart(2, '0')}</strong> ${esc(s)}</div>`).join('')}</div><div><h3>基因编号${display.colorBy === 'target' ? ' · 颜色' : ''}</h3>${state.project.genes.map((g, i) => `<div>${display.colorBy === 'target' ? swatch(g.colorIndex ?? i) : ''}<strong>T${String(i + 1).padStart(2, '0')}</strong> ${esc(g.name)} ${g.type === 'reference' ? '△ 内参' : ''}</div>`).join('')}</div><div><h3>孔位标记</h3><div>R1–R${state.project.replicates} = 技术重复</div><div>NTC = 无模板对照</div><div>NoRT = 无逆转录对照</div><div>PC = 阳性对照；CAL = 跨板校准</div><div>× = 保留孔；△ = 内参</div></div>`;
  }
  function updateColorControls() {
    $('platePalette').value = state.paletteId || Q.NEW_PROJECT_DEFAULTS.paletteId;
    document.querySelectorAll('[data-color-by]').forEach(button => { const active = button.dataset.colorBy === (state.colorBy || 'target'); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    const current = Colors.palette(state.paletteId);
    $('palettePreview').innerHTML = current.colors.slice(0, 6).map((_, i) => { const color = Colors.identityColor(i, current.id, Number($('plateType').value)); return `<span class="palette-dot" style="background:${color.background};border-color:${color.border}" title="颜色 ${i + 1}"></span>`; }).join('');
    $('paletteOptions').innerHTML = Colors.palettes.map(p => `<button type="button" data-palette="${p.id}" class="${p.id === current.id ? 'active' : ''}" aria-label="选择${p.name}"><span>${p.name}</span><span class="palette-preview">${p.colors.slice(0, 6).map((_, i) => { const color = Colors.identityColor(i, p.id, Number($('plateType').value)); return `<i class="palette-dot" style="background:${color.background};border-color:${color.border}"></i>`; }).join('')}</span></button>`).join('');
    $('paletteOptions').querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => { const gallery = button.closest('details'); $('platePalette').value = button.dataset.palette; setPlateColors(); gallery.open = false; }));
  }
  function setPlateColors() {
    state.colorBy = document.querySelector('[data-color-by].active')?.dataset.colorBy || 'target';
    state.paletteId = Colors.palette($('platePalette').value).id;
    if (state.project) { state.project.settings.display.colorBy = state.colorBy; state.project.settings.display.paletteId = state.paletteId; }
    updateColorControls();
    if (state.result) { renderPlate(); renderLegend(); renderPrint(); } storePreferences(); changed();
  }
  function renderMixes() {
    $('singleChannelResult').hidden=!Single.isMode(state.project);
    $('mixPanel').querySelector('h2').textContent=Single.isMode(state.project)?'两阶段来源混合液配制':'Master Mix 配制';
    $('mixPanel').querySelector('p.small').textContent=Single.isMode(state.project)?'按引物工作液和样品混合液的真实来源管配制；每管汇总全部孔板需求。':'每个 assay 单独配制。下列体积按当前孔板计算；跨板时请逐板核对。';
    if(Single.isMode(state.project)){singleUI.renderPlan();return;}
    const p = selectedPlate(), s = state.project.settings;
    $('mixCards').innerHTML = p.mixes.map(m => `<article class="mix-card"><div class="mix-card-head"><h3>${esc(m.gene.name)} ${m.gene.type === 'reference' ? '<span class="tag">内参</span>' : ''}</h3><span>${m.required} 孔 → 配制 ${m.prepare} 反应</span></div><p class="small">max(ceil(${m.required} × (1 + ${s.wastePercent}%)), ${m.required} + ${s.minimumExtra}) = <strong>${m.prepare}</strong>　·　孔位：${esc(m.wellRange)}</p>${m.premix ? `<div class="premix-block"><h4>${esc(m.gene.name)} ${esc(m.premix.name)} · 独立配制</h4><p class="small">最终 Mix 需要 ${m.premix.required} 反应份；独立 Mix 配制 ${m.premix.prepare} 反应份（含自身余量）。每份 ${Q.volume(m.premix.perReaction)} µL，配制总量 ${Q.volume(m.premix.total)} µL；转移 ${Q.volume(m.premix.transferTotal)} µL 到最终 Mix。</p><table><thead><tr><th>独立 Mix 组分</th><th>每份</th><th>配制总量</th></tr></thead><tbody>${m.premix.components.map(c => `<tr><td>${esc(c.displayName)}</td><td>${Q.volume(c.perReaction)} µL</td><td><strong>${Q.volume(c.total)} µL</strong></td></tr>`).join('')}</tbody></table></div><h4>Final Master Mix</h4>` : ''}<table><thead><tr><th>组分</th><th>每反应</th><th>本次配制</th></tr></thead><tbody>${m.components.map(c => `<tr><td>${esc(c.displayName)}</td><td>${Q.volume(c.perReaction)} µL</td><td><strong>${Q.volume(c.total)} µL</strong></td></tr>`).join('')}</tbody><tfoot><tr><th>Master Mix 合计</th><th>${Q.volume(m.totals.mix)} µL</th><th>${Q.volume(m.total)} µL</th></tr></tfoot></table><p class="mix-foot">每孔分液 <strong>${Q.volume(m.totals.mix)} µL Mix</strong>，之后加入 <strong>${Q.volume(m.totals.template)} µL Template / 对照材料</strong>。</p></article>`).join('');
  }
  function renderSteps() {
    const steps = Q.stepsFor(selectedPlate(), state.project);
    state.step = Math.min(state.step, steps.length - 1);
    const x = steps[state.step]; $('stepCounter').textContent = `步骤 ${x.index} / ${steps.length}`;
    $('stepContent').innerHTML = `<div class="step-card"><div class="step-kind">${x.kind === 'prepare-premix' ? '独立 Primer / Assay Mix' : x.kind === 'prepare-final' ? 'Final Master Mix' : x.kind === 'mix' ? 'MASTER MIX 分液' : x.kind === 'check' ? '完成检查' : 'TEMPLATE / 对照'}</div><h3>${esc(x.title)}</h3>${x.prepare ? `<div class="step-metrics"><div><small>配制反应份数</small><strong>${x.prepare}</strong></div><div><small>配制总体积</small><strong>${Q.volume(x.total)} µL</strong></div></div><ul class="step-ingredients">${x.components.map(c => `<li>${esc(c.displayName)}　<strong>${Q.volume(c.total)} µL</strong></li>`).join('')}</ul>` : ''}${x.wells.length ? `<div class="step-metrics"><div><small>每孔加入</small><strong>${Q.volume(x.perWell)} µL</strong></div><div><small>涉及孔数</small><strong>${x.wells.length}</strong></div><div><small>实际分液总量</small><strong>${Q.volume(x.total)} µL</strong></div></div><p><strong>孔位：</strong>${esc(x.range)}</p>` : ''}<p class="small">${esc(x.note)}</p></div>`;
    $('previousStep').disabled = state.step === 0;
    const done = Exec.isComplete(state.execution, selectedPlate().number, x);
    const completed = steps.filter(s => Exec.isComplete(state.execution, selectedPlate().number, s)).length;
    $('progressSummary').textContent = `Plate ${selectedPlate().number} 已完成 ${completed} / ${steps.length} 步 · 当前${done ? '已完成：' + state.execution.plates[selectedPlate().number].completed[Exec.stepKey(x)] : '待执行'}`;
    $('reopenStep').disabled = !done;
    $('nextStep').disabled = done && state.step === steps.length - 1;
    $('nextStep').textContent = state.step === steps.length - 1 ? '确认完成本板' : '完成并进入下一步';
    if(Single.isMode(state.project)){
      $('stepContent').innerHTML=`<div class="step-card"><div class="step-kind">${x.phase==='primer'?'阶段 1：引物工作液':x.phase==='sampleMix'?'阶段 2：Sample Master Mix':'本板完成检查'}</div><h3>${esc(x.title)}</h3>${x.wells.length?`<p>来源管 <strong>${esc(x.tubeId)}</strong> · 管架 ${esc(x.sourceRackPosition)} · 每孔 ${Q.volume(x.perWell)} µL</p><p>本板本来源 ${x.totalWellCount} 孔；本批 ${x.wells.length} 孔；${x.capacityVerified?'吸液':'导航'}批次 ${x.navigationBatchIndex}/${x.navigationBatchCount}；吸液体积 ${x.aspirateVolume==null?'未量程校验':Q.volume(x.aspirateVolume)+' µL'}</p><p>本批真实孔位：${x.wells.join(' → ')}</p>`:''}<p>${esc(x.note)}</p><button type="button" class="primary" id="scStepNavigator">打开加样导航并核对来源</button></div>`;
      $('scStepNavigator').onclick=()=>singleUI.open(); $('nextStep').disabled=!singleUI.canOperate()||done; $('previousStep').disabled=true; $('reopenStep').disabled=true;
      $('nextStep').textContent='确认本批已完成，进入下一批';
    }
    if (state.tab === 'steps') renderPlate();
  }
  function renderChecks() {
    const r = state.result, p = selectedPlate();
    $('checksContent').innerHTML = `<div class="check-summary"><div class="message success">✓ ${r.expected.total} 个反应唯一分配；每孔最多 1 个反应；保留孔为空；每个 Mix 数量与孔板一致。</div>${r.warnings.map(w => `<div class="message warning">⚠ ${esc(w)}</div>`).join('')}${(r.infos || []).map(info => `<div class="message info">✓ ${esc(info)}</div>`).join('')}</div><h3>当前板统计</h3><p>Plate ${p.number}：${p.wells.length} / ${p.capacity} 个可用孔；Sample ${p.wells.filter(x => x.type === 'sample').length}、NTC ${p.wells.filter(x => x.type === 'ntc').length}、No-RT ${p.wells.filter(x => x.type === 'noRT').length}、阳性 ${p.wells.filter(x => x.type === 'positive').length}、跨板校准 ${p.wells.filter(x => x.type === 'calibrator').length}。</p><h3>实验前复核</h3><div class="checklist-view">${state.checklist.map((group, gi) => `<div><h4>${esc(group[0])}</h4>${group.slice(1).filter((_, ii) => !state.disabledChecklist.has(gi + ':' + (ii + 1))).map(item => { const check = View.checklistItem(item, p.wells); return `<label><input type="checkbox" ${check.applicable ? '' : 'disabled'}> ${esc(check.label)}</label>`; }).join('')}</div>`).join('')}</div><p class="small">检查单勾选状态仅用于当前页面；打印时保留空框供手写。所有步骤请以本实验室 SOP 和试剂说明书为准。</p>`;
  }
  function renderChecklistEditor() {
    $('checklistEditor').innerHTML = state.checklist.map((group, gi) => `<div class="check-group"><strong>${esc(group[0])}</strong>${group.slice(1).map((item, ii) => `<label><input type="checkbox" data-group="${gi}" data-item="${ii + 1}" ${state.disabledChecklist.has(gi + ':' + (ii + 1)) ? '' : 'checked'}> ${esc(item)}</label>`).join('')}</div>`).join('');
    $('checklistEditor').querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      const key = input.dataset.group + ':' + input.dataset.item;
      if (input.checked) state.disabledChecklist.delete(key); else state.disabledChecklist.add(key);
      syncChecklist();
    }));
  }
  function showTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    for (const name of ['mix', 'steps', 'checks']) $(name + 'Panel').hidden = name !== tab;
    if (state.result) { renderPlate(); if (tab === 'steps') renderSteps(); }
  }
  function download(name, content, type) { const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function updatePresets() { $('presetSelect').innerHTML = '<option value="">选择预设</option>' + Object.keys(state.presets).sort().map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join(''); }

  function bind() {
    $('generateButton').addEventListener('click', generate);
    $('demoButton').addEventListener('click', () => { setForm(Q.demo()); generate(); });
    $('openButton').addEventListener('click', () => $('projectFile').click());
    $('projectFile').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try { applyLoaded(JSON.parse(await file.text()), $('openMode').value === 'regenerate'); }
      catch (e) { flash('打开项目失败：' + e.message, 'error'); }
      event.target.value = '';
    });
    $('saveButton').addEventListener('click', () => { if (state.reservedDirty) { flash('保留孔已修改，请先明确点击“重新生成孔板”再保存。', 'warning'); return; } if (!state.result) generate(); if (!state.result) return; const p = state.project; download(`${p.metadata.date || Q.localDate()}_${fileName(p.metadata.name)}_qPCR.json`, JSON.stringify(snapshot(), null, 2), 'application/json;charset=utf-8'); state.dirty = false; persistDraft(); });
    $('csvButton').addEventListener('click', () => { if (!state.result) { flash('请先生成孔板。', 'error'); return; } download('plate_layout.csv', Q.csv(state.result.plates, state.project), 'text/csv;charset=utf-8'); });
    $('printButton').addEventListener('click', () => { if (!state.result || !state.result.ok || !selectedPlate() || !selectedPlate().mixes.length) { flash('打印前检查未通过：请先成功生成孔板与 Mix。', 'error'); return; } renderPrint('current'); window.print(); });
    $('printAllButton').addEventListener('click', () => { if (!state.result || !state.result.ok) { flash('请先成功生成孔板与 Mix。', 'error'); return; } renderPrint('all'); window.addEventListener('afterprint', () => renderPrint('current'), { once: true }); window.print(); });
    $('reserveModeButton').addEventListener('click', toggleEditor);
    $('tabletGuideButton').addEventListener('click', () => {
      if (!state.result?.ok || state.reservedDirty || !selectedPlate()) { flash('请先成功生成并确认当前孔板。', 'error'); return; }
      const index = Number($('tabletGuidePlateSelect').value);
      if (!Number.isInteger(index) || !state.result.plates[index]) { flash('请选择有效孔板。', 'error'); return; }
      if (state.editorActive) toggleEditor();
      if (index !== state.plate) { state.plate = index; state.step = 0; renderResults(); }
      if(Single.isMode(state.project)&&!singleUI.canOperate())return flash('请先在加样导航模式确认当前来源管、阶段与 A1。','warning');
      const opened = window.QPCRTabletGuide?.open({ project: state.project, result: state.result, plateIndex: state.plate, stepIndex: state.step, onPlateChange: next => { state.plate = next; state.step = Exec.resumeIndex(state.execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)); renderResults(); return state.step; }, onStepComplete: (step, index) => { Exec.complete(state.execution, state.result.plates[index].number, step); changed(); }, isStepComplete: (step, index) => Exec.isComplete(state.execution, state.result.plates[index].number, step), onStepReopen: (step, index) => { Exec.reopen(state.execution, state.result.plates[index].number, step); changed(); renderSteps(); }, onStepChange: next => { state.step = next; rememberStep(); renderSteps(); } });
      if (!opened) flash('无法打开平板加样辅助：请检查排板和加样步骤。', 'error');
    });
    $('editorRegenerate').addEventListener('click', generate);
    $('plateEditorToolbar').addEventListener('click', event => { const action = event.target.closest('[data-editor-action]')?.dataset.editorAction; if (action) editorAction(action); });
    document.addEventListener('keydown', event => {
      if (!state.editorActive || event.target.isContentEditable || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
      const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
      if (event.key === 'Escape') { event.preventDefault(); editorAction('clear'); }
      else if (ctrl && key === 'a') { event.preventDefault(); editorAction('all'); }
      else if (ctrl && key === 'z') { event.preventDefault(); editorAction(event.shiftKey ? 'redo' : 'undo'); }
      else if (ctrl && key === 'y') { event.preventDefault(); editorAction('redo'); }
    });
    $('addComponent').addEventListener('click', () => { addRecipeRow(); renderPremixOptions(); markStale(); renderRecipeSummary(); });
    $('premixEnabled').addEventListener('change', () => { renderPremixOptions(); markStale(); renderRecipeSummary(); });
    document.querySelectorAll('input[name="printOrientation"]').forEach(input => input.addEventListener('change', () => { updatePrintPageStyle(); if (state.project) state.project.settings.printOrientation = printOrientation(); if (state.result) renderPrint(); storePreferences(); changed(); }));
    for (const [id, delta] of [['zoomOut', -0.25], ['zoomIn', 0.25]]) $(id).addEventListener('click', () => { state.plateZoom = Math.min(1.5, Math.max(1, Q.round(state.plateZoom + delta, 2))); updateZoomControls(); if (state.project) state.project.settings.display.plateZoom = state.plateZoom; if (state.result || state.editorActive) renderPlate(); storePreferences(); changed(); });
    $('platePalette').addEventListener('change', setPlateColors);
    document.querySelectorAll('[data-color-by]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-color-by]').forEach(b => b.classList.toggle('active', b === button)); setPlateColors(); }));
    window.addEventListener('resize', scalePrintPreview);
    $('savePreset').addEventListener('click', () => { const r = recipeFromForm(); if (!r.name) { flash('请先输入体系名称。', 'error'); return; } state.presets[r.name] = r; savePresets(); updatePresets(); $('presetSelect').value = r.name; flash('配方预设已保存在本机浏览器。', 'success'); });
    $('loadPreset').addEventListener('click', () => { const r = state.presets[$('presetSelect').value]; if (!r) { flash('请先选择一个配方预设。', 'error'); return; } setRecipe(r); markStale(); });
    $('deletePreset').addEventListener('click', () => { const name = $('presetSelect').value; if (!name) { flash('请先选择要删除的预设。', 'error'); return; } delete state.presets[name]; savePresets(); updatePresets(); flash('已删除本机配方预设。', 'info'); });
    $('previousStep').addEventListener('click', () => { if (state.result && state.step > 0) { state.step--; rememberStep(); renderSteps(); } });
    $('nextStep').addEventListener('click', completeStep);
    $('resumeProgress').addEventListener('click', () => { if (state.result) { state.step = Exec.resumeIndex(state.execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)); rememberStep(); renderSteps(); } });
    $('reopenStep').addEventListener('click', () => { if (state.result) { Exec.reopen(state.execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)[state.step]); changed(); renderSteps(); } });
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('resetChecklist').addEventListener('click', () => { state.checklist = Q.DEFAULT_CHECKLIST.map(g => [...g]); state.disabledChecklist.clear(); renderChecklistEditor(); syncChecklist(); });
    $('addChecklistItem').addEventListener('click', () => { const text = $('newChecklistItem').value.trim(); if (!text) { flash('请先输入检查项目。', 'error'); return; } state.checklist[state.checklist.length - 1].push(text); $('newChecklistItem').value = ''; renderChecklistEditor(); syncChecklist(); });
    // Only experiment design controls invalidate calculations. Navigation, display,
    // metadata and unapplied recipe editors have their own handlers.
    const qcDialog=$('qcDisableDialog');
    const closeQcDialog=()=>{ if (typeof qcDialog.close==='function') qcDialog.close(); else qcDialog.removeAttribute('open'); $('qcControlsEnabled').focus(); };
    $('qcDisableCancel').addEventListener('click',closeQcDialog);
    qcDialog.addEventListener('cancel',event=>{event.preventDefault();closeQcDialog();});
    $('qcDisableConfirm').addEventListener('click',()=>{
      closeQcDialog(); $('qcControlsEnabled').checked=false;
      $('ntcEnabled').checked=false; $('positiveEnabled').checked=false; $('noRTMode').value='off'; $('calibratorSample').value='';
      setControlsVisibility(); markStale(); generate();
    });
    $('qcControlsEnabled').addEventListener('change', () => {
      const enabled=$('qcControlsEnabled').checked;
      if (!enabled && ($('ntcEnabled').checked || $('positiveEnabled').checked || $('noRTMode').value!=='off' || $('calibratorSample').value)) {
        $('qcControlsEnabled').checked=true;
        if (typeof qcDialog.showModal==='function') qcDialog.showModal(); else qcDialog.setAttribute('open','');
        $('qcDisableCancel').focus(); return;
      }
      setControlsVisibility(); markStale();
    });
    const designIds = ['samples','targets','references','plateType','replicates','reactionVolume','ntcEnabled','ntcReplicates','ntcCustomReplicates','noRTMode','noRTSamples','positiveEnabled','positiveName','controlScope','noRTReplicates','positiveReplicates','recipeName','premixName','wastePercent','minimumExtra','minPipetteVolume','pipette','pipettePitch','layoutMode','primaryReferenceGene','referenceRowPreference','allocationMode','calibratorSample','reservedWells'];
    designIds.map($).forEach(el => {
      el.addEventListener('input', () => { if (el.id === 'samples') updateSampleOptions(); if (['plateType', 'noRTMode', 'positiveEnabled', 'ntcEnabled', 'ntcReplicates', 'ntcCustomReplicates', 'replicates'].includes(el.id)) setControlsVisibility(); if (el.id === 'plateType') { updatePrintPageStyle(); updateZoomControls(); updateColorControls(); state.selectedWells.clear(); state.selectionAnchor = null; state.editHistory = { undo: [], redo: [] }; } if (el.id === 'reactionVolume') renderRecipeSummary(); if (el.id === 'reservedWells') { state.reservedDirty = true; state.editHistory = { undo: [], redo: [] }; $('layoutStaleNotice').hidden = false; } markStale(); if (state.editorActive) renderPlate(); });
      el.addEventListener('change', () => { if (['samples','targets','references'].includes(el.id)) { updateSampleOptions(); renderAssayChoices(); } setControlsVisibility(); markStale(); if (state.editorActive) renderPlate(); });
    });
    ['experimentName','operator','experimentDate'].forEach(id => $(id).addEventListener('input', () => { if (state.project) { state.project.metadata = readProject().metadata; renderPrint(); } changed(); }));
    $('tabletGuidePlateSelect').addEventListener('change', () => { const index = Number($('tabletGuidePlateSelect').value); if (state.result?.plates[index]) { state.plate = index; state.step = Exec.resumeIndex(state.execution, selectedPlate().number, Q.stepsFor(selectedPlate(), state.project)); renderResults(); } });
    $('matrixEnabled').addEventListener('change', () => { state.assaySelection = $('matrixEnabled').checked ? readProject().samples.flatMap(sample => readProject().genes.map(g => ({ sample, geneId: g.id }))) : null; renderSampleExtensions(); markStale(); });
    ['matrixAll','matrixNone'].forEach(id => $(id).addEventListener('click', () => { const p = readProject(); state.assaySelection = id === 'matrixAll' ? p.samples.flatMap(sample => p.genes.map(g => ({ sample, geneId: g.id }))) : []; renderSampleExtensions(); markStale(); }));
    $('importSamples').addEventListener('click', () => { try { importSamples($('sampleTablePaste').value); } catch (e) { flash(e.message, 'error'); } });
    $('sampleTableFile').addEventListener('change', async event => { try { if (event.target.files[0]) importSamples(await event.target.files[0].text()); } catch (e) { flash(e.message, 'error'); } event.target.value = ''; });
    $('assayRecipeSelect').addEventListener('change', loadOverride); $('addOverrideComponent').addEventListener('click', () => addOverrideRow());
    $('applyAssayOverride').addEventListener('click', applyOverride); $('removeAssayOverride').addEventListener('click', () => { delete state.assayRecipes[$('assayRecipeSelect').value]; markStale(); renderAssayChoices(); });
    $('exportReagents').addEventListener('click', () => { if (!state.result) return flash('请先生成孔板。', 'error'); download('qPCR Plate Planner - 试剂汇总.csv', IO.summaryCSV(Q.reagentSummary(state.result.plates, state.project)), 'text/csv;charset=utf-8'); });
    $('printReagents').addEventListener('click', () => { if (!state.result) return flash('请先生成孔板。', 'error'); renderReagentPrint(); window.addEventListener('afterprint', () => renderPrint(), { once: true }); window.print(); });
    $('restoreDraft').addEventListener('click', () => { try { const d = state.pendingDraft || draftStorage.read(); if (!d) throw new Error('草稿已不存在。'); if (d.generated) applyLoaded(d); else { const p = Q.normalizeProject(d.project); state.pendingDraft = null; setForm(p); markStale(); } state.dirty = true; persistDraft(); $('draftNotice').hidden = true; } catch (e) { flash('恢复草稿失败：' + e.message, 'error'); } });
    $('discardDraft').addEventListener('click', () => { state.pendingDraft = null; draftStorage.clear(); $('draftNotice').hidden = true; state.draftSaved = false; status(); });
    window.addEventListener('beforeunload', event => { if (state.dirty) { persistDraft(); event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('pagehide', () => { if (state.dirty) persistDraft(); });
  }
  function init() {
    $('layoutMode').value = Q.NEW_PROJECT_DEFAULTS.layoutMode;
    document.querySelector(`input[name="printOrientation"][value="${Q.NEW_PROJECT_DEFAULTS.printOrientation}"]`).checked = true;
    state.colorBy = 'target'; state.paletteId = Q.NEW_PROJECT_DEFAULTS.paletteId;
    loadStorage(); setRecipe(Q.demo().recipe); $('experimentDate').value = Q.localDate();
    $('platePalette').innerHTML = Colors.palettes.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    updateColorControls();
    bind(); setControlsVisibility(); renderChecklistEditor(); updatePresets(); renderCapacity(); updatePrintPageStyle(); updateZoomControls();
    renderSampleExtensions(); renderAssayChoices(); $('projectStatus').textContent = '尚未生成或导出项目';
    state.pendingDraft = draftStorage.read();
    if (state.pendingDraft) { $('draftNotice').hidden = false; $('draftNoticeText').textContent = `发现本机草稿：${state.pendingDraft.project.metadata?.name || '未命名实验'}（${state.pendingDraft.savedAt || '未知时间'}）`; }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').then(reg => {
      const updates = window.QPCRUpdateSafety.create({ saveDraft: persistDraft, notify: message => flash(message, 'error'), reload: () => location.reload() });
      const offer = () => { if (reg.waiting) { $('updateNotice').hidden = false; $('applyUpdate').onclick = () => updates.request(reg.waiting); } };
      offer(); reg.addEventListener('updatefound', () => { const worker = reg.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(); }); });
      navigator.serviceWorker.addEventListener('controllerchange', () => updates.controllerChanged());
    }).catch(error => console.warn('离线缓存未启用', error));
    if (window.__QPCR_TEST__) window.QPCRTest = { state, readProject, setForm, generate, applyLoaded, snapshot, persistDraft, buildPlateSvg, renderPrint };
  }
  init();
})();
