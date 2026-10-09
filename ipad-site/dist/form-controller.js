(() => {
  'use strict';
  window.QPCRForms = { create(ctx) {
  const { Q, state, $, IO, Colors, roleNames, esc, number, markStale, changed, renderCapacity, printOrientation, updateColorControls, renderChecklistEditor, updatePrintPageStyle, updateZoomControls, flash } = ctx;

  function resolveGenes(targets, refs) {
    const requested = [...targets.map(name => ({ name, type: 'target' })), ...refs.map(name => ({ name, type: 'reference' }))];
    const records = state.geneRecords.filter(g => requested.some(r => r.name === g.name && r.type === g.type));
    let color = Math.max(-1, ...state.geneRecords.map(g => g.colorIndex ?? 0)) + 1;
    for (const r of requested) if (!records.some(g => g.name === r.name && g.type === r.type)) {
      let id; do { id = 'assay-' + color++; } while (state.geneRecords.some(g => g.id === id));
      const g = { ...r, id, colorIndex: color - 1 }; records.push(g); state.geneRecords.push(g);
    }
    return requested.map(r => ({ ...records.find(g => g.name === r.name && g.type === r.type) }));
  }
  function renderSampleExtensions() {
    const samples = Q.parseNames($('samples').value), genes = resolveGenes(Q.parseNames($('targets').value), Q.parseNames($('references').value));
    $('sampleMetadataEditor').innerHTML = samples.length ? `<table class="data-table"><thead><tr><th>样本</th><th>组别</th><th>生物重复</th></tr></thead><tbody>${samples.map((s, i) => `<tr><td>${esc(s)}</td><td><input aria-label="${esc(s)} 组别" data-sample-index="${i}" data-field="group" value="${esc(state.sampleMetadata[s]?.group)}"></td><td><input aria-label="${esc(s)} 生物重复" data-sample-index="${i}" data-field="biologicalReplicate" value="${esc(state.sampleMetadata[s]?.biologicalReplicate)}"></td></tr>`).join('')}</tbody></table>` : '';
    $('sampleMetadataEditor').querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
      const s = samples[Number(input.dataset.sampleIndex)]; state.sampleMetadata[s] ||= { id: 'sample-' + samples.indexOf(s), colorIndex: samples.indexOf(s) };
      state.sampleMetadata[s][input.dataset.field] = input.value;
      if (state.project) state.project.sampleMetadata[s] = { ...state.sampleMetadata[s] }; changed();
    }));
    $('matrixEnabled').checked = state.assaySelection != null; $('matrixFields').hidden = state.assaySelection == null;
    if (state.assaySelection == null) { $('assayMatrix').replaceChildren(); return; }
    $('assayMatrix').innerHTML = `<table class="data-table"><thead><tr><th>样本 / assay</th>${genes.map(g => `<th>${esc(g.name)}</th>`).join('')}</tr></thead><tbody>${samples.map((s, i) => `<tr><th>${esc(s)}</th>${genes.map((g, j) => `<td><input type="checkbox" aria-label="${esc(s)} 检测 ${esc(g.name)}" data-s="${i}" data-g="${j}" ${state.assaySelection.some(p => p.sample === s && p.geneId === g.id) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('assayMatrix').querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      const sample = samples[Number(input.dataset.s)], geneId = genes[Number(input.dataset.g)].id;
      state.assaySelection = state.assaySelection.filter(p => p.sample !== sample || p.geneId !== geneId);
      if (input.checked) state.assaySelection.push({ sample, geneId }); markStale();
    }));
  }
  function renderLabChoices() {
    const refs = resolveGenes(Q.parseNames($('targets').value),Q.parseNames($('references').value)).filter(g=>g.type==='reference');
    const select=$('primaryReferenceGene'), previous=select.value || state.primaryReferenceGeneId || '';
    select.innerHTML = '<option value="">请选择主内参</option>' + refs.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
    select.value=refs.length===1 ? refs[0].id : refs.some(g=>g.id===previous) ? previous : '';
    select.disabled=refs.length<2; state.primaryReferenceGeneId=select.value;
    $('primaryReferenceInfo').textContent=refs.length===0 ? '未设置内参；全部 assay 按普通顺序排布，不预留内参行。' : refs.length===1 ? '唯一内参自动作为主内参。' : '必须选择主内参；其余内参按 assay 顺序作为普通行。';
    $('labLayoutFields').hidden=$('layoutMode').value!=='labPriorityHybrid';
    $('allocationMode').disabled=$('layoutMode').value==='labPriorityHybrid';
    $('allocationMode').title=$('layoutMode').value==='labPriorityHybrid' ? '实验室优先布局按标准区与剩余空间依次顺序填充。' : '';
  }
  function renderAssayChoices() {
    const prev = $('assayRecipeSelect').value, genes = resolveGenes(Q.parseNames($('targets').value), Q.parseNames($('references').value));
    $('assayRecipeSelect').innerHTML = genes.map(g => `<option value="${esc(g.id)}">${esc(g.name)}${state.assayRecipes[g.id] ? ' · 独立配方' : ''}</option>`).join('');
    if (genes.some(g => g.id === prev)) $('assayRecipeSelect').value = prev;
    loadOverride(); renderLabChoices();
  }
  function addOverrideRow(c = { name: '', role: 'other', volumePerReaction: 0 }) {
    const row = document.createElement('tr'); row.dataset.id = c.id || 'override-' + Date.now() + '-' + $('overrideBody').children.length;
    row.innerHTML = `<td><input aria-label="独立组分名称" class="component-name" value="${esc(c.name)}"></td><td><select aria-label="独立组分角色" class="component-role">${Object.entries(roleNames).map(([key, label]) => `<option value="${key}" ${c.role === key ? 'selected' : ''}>${label}</option>`).join('')}</select></td><td><input aria-label="独立组分体积" type="number" step="any" min="0" class="component-volume" value="${esc(c.volumePerReaction)}"></td><td><label class="inline-check"><input class="override-premix-component" aria-label="预混此独立组分" type="checkbox">预混</label><button type="button" class="icon-button" aria-label="删除独立组分">×</button></td>`;
    row.querySelector('button').addEventListener('click', () => row.remove()); const eligible = () => { const box = row.querySelector('.override-premix-component'); box.disabled = ['template','mastermix'].includes(row.querySelector('.component-role').value); if (box.disabled) box.checked = false; }; row.querySelector('.component-role').addEventListener('change',eligible); eligible(); $('overrideBody').append(row);
  }
  function loadOverride() {
    const override = state.assayRecipes[$('assayRecipeSelect').value], recipe = override?.recipe || recipeFromForm();
    $('overrideRecipeName').value = recipe.name || ''; $('overrideReactionVolume').value = override?.reactionVolume ?? number('reactionVolume');
    $('overrideBody').replaceChildren(); recipe.components.forEach(addOverrideRow); const premix = recipe.assayPremix || {}; $('overridePremixEnabled').checked = !!premix.enabled; $('overridePremixName').value = premix.name || 'Primer Mix'; $('overridePremixWaste').value = premix.wastePercent ?? ''; $('overridePremixExtra').value = premix.minimumExtraReactions ?? ''; [...$('overrideBody').children].forEach(row => { row.querySelector('.override-premix-component').checked = (premix.componentIds || []).includes(row.dataset.id); });
    $('overrideStatus').textContent = override ? '已启用独立配方。编辑后请点击应用；独立预混设置可在下方编辑。' : '使用通用配方；点击应用后此 assay 使用独立配方。';
  }
  function applyOverride() {
    const id = $('assayRecipeSelect').value; if (!id) return flash('请先输入 assay。', 'error');
    const override = { reactionVolume: number('overrideReactionVolume'), recipe: { name: $('overrideRecipeName').value.trim(), components: [...$('overrideBody').children].map(row => ({ id: row.dataset.id, name: row.querySelector('.component-name').value.trim(), role: row.querySelector('.component-role').value, volumePerReaction: Number(row.querySelector('.component-volume').value) })), assayPremix: { enabled: $('overridePremixEnabled').checked, name: $('overridePremixName').value.trim(), componentIds: [...$('overrideBody').children].filter(row => row.querySelector('.override-premix-component').checked).map(row => row.dataset.id), wastePercent: $('overridePremixWaste').value === '' ? null : number('overridePremixWaste'), minimumExtraReactions: $('overridePremixExtra').value === '' ? null : number('overridePremixExtra') } } };
    const p = readProject(); p.assayRecipes[id] = override; const checked = Q.validate(p);
    if (checked.errors.length) return flash(checked.errors.join('；'), 'error');
    state.assayRecipes[id] = override; markStale(); renderAssayChoices(); flash('已应用 assay 独立配方，请重新生成。', 'success');
  }
  function addRecipeRow(component = { name: '', role: 'other', volumePerReaction: 0 }) {
    const row = document.createElement('tr');
    let id = component.id;
    if (!id) do { id = 'component-' + state.componentCounter++; } while ([...$('recipeBody').querySelectorAll('tr')].some(existing => existing.dataset.componentId === id));
    row.dataset.componentId = id;
    row.innerHTML = `<td><input aria-label="组分名称" class="component-name" value="${esc(component.name)}"></td><td><select aria-label="组分角色" class="component-role">${Object.entries(roleNames).map(([key, label]) => `<option value="${key}" ${component.role === key ? 'selected' : ''}>${label}</option>`).join('')}</select></td><td><input aria-label="每反应体积，微升" class="component-volume" type="number" min="0" step="any" value="${esc(component.volumePerReaction)}"></td><td><button type="button" class="icon-button remove-component" aria-label="删除组分" title="删除组分">×</button></td>`;
    $('recipeBody').append(row);
    row.querySelector('.remove-component').addEventListener('click', () => { state.premixSelectedIds.delete(row.dataset.componentId); row.remove(); renderPremixOptions(); markStale(); renderRecipeSummary(); });
    row.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => { renderPremixOptions(); markStale(); renderRecipeSummary(); }));
  }
  function recipeFromForm() { return { name: $('recipeName').value.trim(), components: [...$('recipeBody').querySelectorAll('tr')].map(row => ({ id: row.dataset.componentId, name: row.querySelector('.component-name').value.trim(), role: row.querySelector('.component-role').value, volumePerReaction: Number(row.querySelector('.component-volume').value) })), assayPremix: { enabled: $('premixEnabled').checked, name: $('premixName').value.trim(), componentIds: [...state.premixSelectedIds], wastePercent: state.premixWaste, minimumExtraReactions: state.premixExtra } }; }
  function setRecipe(recipe) {
    $('recipeName').value = recipe.name || '';
    const premix = recipe.assayPremix || { enabled: false, name: 'Primer Mix', componentIds: [] };
    $('premixEnabled').checked = !!premix.enabled; $('premixName').value = premix.name || 'Primer Mix';
    state.premixSelectedIds = new Set(premix.componentIds || []); state.premixWaste = premix.wastePercent ?? null; state.premixExtra = premix.minimumExtraReactions ?? null;
    $('recipeBody').replaceChildren(); state.componentCounter = 0;
    for (const [index, c] of (recipe.components || []).entries()) addRecipeRow({ ...c, id: c.id || 'component-' + index });
    state.componentCounter = Math.max(state.componentCounter, (recipe.components || []).length);
    renderPremixOptions(); renderRecipeSummary();
  }
  function renderPremixOptions() {
    $('premixFields').hidden = !$('premixEnabled').checked;
    const rows = [...$('recipeBody').querySelectorAll('tr')];
    const eligible = rows.filter(row => !['template', 'mastermix'].includes(row.querySelector('.component-role').value));
    const eligibleIds = new Set(eligible.map(row => row.dataset.componentId));
    state.premixSelectedIds = new Set([...state.premixSelectedIds].filter(id => eligibleIds.has(id)));
    $('premixOptions').innerHTML = eligible.map(row => `<label><input type="checkbox" data-component-id="${esc(row.dataset.componentId)}" ${state.premixSelectedIds.has(row.dataset.componentId) ? 'checked' : ''}> ${esc(row.querySelector('.component-name').value || '未命名组分')} · ${Q.volume(Number(row.querySelector('.component-volume').value))} µL</label>`).join('') || '<span class="small">请先添加引物、探针、水或其他可预混组分。</span>';
    $('premixOptions').querySelectorAll('input').forEach(input => input.addEventListener('change', () => { if (input.checked) state.premixSelectedIds.add(input.dataset.componentId); else state.premixSelectedIds.delete(input.dataset.componentId); markStale(); renderRecipeSummary(); }));
  }
  function renderRecipeSummary() {
    const recipe = recipeFromForm(), totals = Q.recipeTotals(recipe);
    const target = Number($('reactionVolume').value);
    const valid = Math.abs(totals.total - target) < 0.00001;
    $('recipeSummary').innerHTML = `<span>Master Mix <strong>${Q.volume(totals.mix)} µL / 孔</strong></span><span>Template <strong>${Q.volume(totals.template)} µL / 孔</strong></span><span>总量 <strong>${Q.volume(totals.total)} / ${Q.volume(target)} µL</strong></span><span class="${valid ? 'ok-text' : 'error-text'}">${valid ? '✓ 体积一致' : '⚠ 体积不一致'}</span>`;
    const selected = recipe.components.filter(c => state.premixSelectedIds.has(c.id));
    const premixVolume = Q.round(selected.reduce((sum, c) => sum + c.volumePerReaction, 0));
    $('premixSummary').textContent = selected.length ? `独立 Mix ${Q.volume(premixVolume)} µL / 反应；最终 Master Mix 中以独立 Mix 替代所选组分，总反应体积仍为 ${Q.volume(totals.total)} µL。` : '请勾选至少一个现有组分；Template 和通用 Mix 不可进入独立 Mix。';
  }

  function updateSampleOptions() {
    const samples = Q.parseNames($('samples').value);
    const prev = [...$('noRTSamples').selectedOptions].map(x => x.value), prevCal = $('calibratorSample').value;
    $('noRTSamples').innerHTML = samples.map(s => `<option value="${esc(s)}" ${prev.includes(s) ? 'selected' : ''}>${esc(s)}</option>`).join('');
    $('calibratorSample').innerHTML = '<option value="">不添加</option>' + samples.map(s => `<option value="${esc(s)}" ${prevCal === s ? 'selected' : ''}>${esc(s)}</option>`).join('');
    renderSampleExtensions();
  }
  function setControlsVisibility() {
    $('qcFields').hidden=!$('qcControlsEnabled').checked;
    renderLabChoices();
    $('noRTSelectWrap').hidden = $('noRTMode').value !== 'selected';
    $('positiveNameWrap').hidden = !$('positiveEnabled').checked;
    $('noRTHint').hidden = $('noRTMode').value !== 'selected';
    $('ntcReplicates').disabled = !$('ntcEnabled').checked;
    $('ntcCustomWrap').hidden = !$('ntcEnabled').checked || $('ntcReplicates').value !== 'custom';
    $('ntcEffectiveHint').textContent = $('ntcEnabled').checked ? `每个 assay 实际 NTC：${$('ntcReplicates').value === 'same' ? number('replicates') : $('ntcReplicates').value === 'custom' ? number('ntcCustomReplicates') : number('ntcReplicates')} 孔${$('ntcReplicates').value === 'same' ? '（随技术重复自动变化）' : ''}` : '';
    $('pipette').querySelectorAll('option[value="16"],option[value="24"],option[value="robot"],option[value="other"]').forEach(x => { x.disabled = $('plateType').value === '96'; });
    if ($('plateType').value === '96' && ['16', '24', 'robot', 'other'].includes($('pipette').value)) $('pipette').value = 'single';
  }
  function readProject() {
    const targets = Q.parseNames($('targets').value), refs = Q.parseNames($('references').value);
    const ntcFollow = $('ntcReplicates').value === 'same';
    const ntcCustom = $('ntcReplicates').value === 'custom' ? number('ntcCustomReplicates') : ntcFollow ? number('ntcCustomReplicates') : number('ntcReplicates');
    const genes = resolveGenes(targets, refs), samples = Q.parseNames($('samples').value);
    let nextColor = Math.max(-1, ...Object.values(state.sampleMetadata).map(meta => Number(meta.colorIndex) || 0)) + 1;
    for (const sample of samples) if (!state.sampleMetadata[sample]) state.sampleMetadata[sample] = { id: 'sample-' + nextColor, group: '', biologicalReplicate: '', colorIndex: nextColor++ };
    return {
      version: Q.VERSION,
      metadata: { name: $('experimentName').value.trim(), operator: $('operator').value.trim(), date: $('experimentDate').value },
      plateType: number('plateType'), replicates: number('replicates'), reactionVolume: number('reactionVolume'),
      samples, genes,
      sampleMetadata: Object.fromEntries(samples.map(sample => [sample, { ...state.sampleMetadata[sample] }])),
      assaySelection: state.assaySelection == null ? null : state.assaySelection.filter(pair => samples.includes(pair.sample) && genes.some(g => g.id === pair.geneId)),
      assayRecipes: Object.fromEntries(Object.entries(state.assayRecipes).filter(([id]) => genes.some(g => g.id === id))),
      controls: { qcControlsEnabled: $('qcControlsEnabled').checked, ntc: $('ntcEnabled').checked, ntcReplicateMode: ntcFollow ? 'followTechnical' : 'custom', ntcCustomReplicates: ntcCustom, ntcReplicates: ntcFollow ? 'same' : ntcCustom, noRT: $('noRTMode').value, noRTSamples: [...$('noRTSamples').selectedOptions].map(x => x.value), positive: $('positiveEnabled').checked, positiveName: $('positiveName').value.trim(), calibratorSample: $('calibratorSample').value, scope: $('controlScope').value, noRTReplicates: number('noRTReplicates'), positiveReplicates: number('positiveReplicates') },
      recipe: recipeFromForm(),
      settings: { wastePercent: number('wastePercent'), minimumExtra: number('minimumExtra'), minPipetteVolume: number('minPipetteVolume'), pipette: $('pipette').value, pipettePitch: $('pipettePitch').value, layoutMode: $('layoutMode').value, referenceRowPreference: $('referenceRowPreference').value, primaryReferenceGeneId: $('primaryReferenceGene').value, allocationMode: $('allocationMode').value, printOrientation: printOrientation(), display: { plateZoom: state.plateZoom, colorBy: state.colorBy || 'target', paletteId: state.paletteId || Q.NEW_PROJECT_DEFAULTS.paletteId }, reserved: $('reservedWells').value, checklist: state.checklist.map(g => [...g]), disabledChecklist: [...state.disabledChecklist] }
    };
  }
  function setForm(project) {
    project = Q.normalizeProject(project);
    state.sampleMetadata = Object.assign(Object.create(null), JSON.parse(JSON.stringify(project.sampleMetadata)));
    project.samples.forEach((sample, i) => { state.sampleMetadata[sample] ||= { id: 'sample-' + i, colorIndex: i, group: '', biologicalReplicate: '' }; });
    state.geneRecords = project.genes.map((g, i) => ({ ...g, colorIndex: g.colorIndex ?? i }));
    state.assayRecipes = Object.assign(Object.create(null), JSON.parse(JSON.stringify(project.assayRecipes)));
    state.assaySelection = project.assaySelection == null ? null : project.assaySelection.map(pair => ({ ...pair }));
    window.QPCRTabletGuide?.close();
    state.selectedWells.clear(); state.previewWells.clear(); state.hoverWells.clear(); state.selectionAnchor = null; state.lastSelectedWell = null; state.editHistory = { undo: [], redo: [] }; state.reservedDirty = false; $('layoutStaleNotice').hidden = true;
    $('experimentName').value = project.metadata?.name || '';
    $('operator').value = project.metadata?.operator || '';
    $('experimentDate').value = project.metadata?.date || Q.localDate();
    $('plateType').value = project.plateType;
    $('replicates').value = project.replicates;
    $('reactionVolume').value = project.reactionVolume;
    $('samples').value = project.samples.join('\n');
    $('targets').value = project.genes.filter(g => g.type === 'target').map(g => g.name).join('\n');
    $('references').value = project.genes.filter(g => g.type === 'reference').map(g => g.name).join('\n');
    $('qcControlsEnabled').checked = Q.qcEnabled(project);
    $('ntcEnabled').checked = !!project.controls.ntc;
    const ntcMode = project.controls.ntcReplicateMode || (project.controls.ntcReplicates === 'same' ? 'followTechnical' : 'custom');
    const ntcCustom = Number(project.controls.ntcCustomReplicates ?? (project.controls.ntcReplicates === 'same' ? project.replicates : project.controls.ntcReplicates));
    $('ntcCustomReplicates').value = ntcCustom;
    $('ntcReplicates').value = ntcMode === 'followTechnical' ? 'same' : [1, 2, 3].includes(ntcCustom) ? String(ntcCustom) : 'custom';
    $('noRTMode').value = project.controls.noRT;
    $('controlScope').value = project.controls.scope; $('noRTReplicates').value = project.controls.noRTReplicates; $('positiveReplicates').value = project.controls.positiveReplicates;
    $('positiveEnabled').checked = !!project.controls.positive;
    $('positiveName').value = project.controls.positiveName || '';
    $('wastePercent').value = project.settings.wastePercent;
    $('minimumExtra').value = project.settings.minimumExtra;
    $('minPipetteVolume').value = project.settings.minPipetteVolume;
    $('pipette').value = project.settings.pipette;
    $('pipettePitch').value = project.settings.pipettePitch;
    $('layoutMode').value = project.settings.layoutMode;
    state.primaryReferenceGeneId=project.settings.primaryReferenceGeneId; $('primaryReferenceGene').replaceChildren();
    $('referenceRowPreference').value=project.settings.referenceRowPreference;
    $('allocationMode').value = project.settings.allocationMode;
    document.querySelector(`input[name="printOrientation"][value="${project.settings.printOrientation === 'portrait' ? 'portrait' : 'landscape'}"]`).checked = true;
    state.plateZoom = [1, 1.25, 1.5].includes(Number(project.settings.display?.plateZoom)) ? Number(project.settings.display.plateZoom) : 1;
    state.colorBy = project.settings.display?.colorBy === 'sample' ? 'sample' : 'target';
    state.paletteId = Colors.palette(project.settings.display?.paletteId).id;
    updateColorControls();
    $('reservedWells').value = Array.isArray(project.settings.reserved) ? project.settings.reserved.join(', ') : project.settings.reserved || '';
    state.checklist = Array.isArray(project.settings.checklist) ? project.settings.checklist : Q.DEFAULT_CHECKLIST.map(g => [...g]);
    state.disabledChecklist = new Set(project.settings.disabledChecklist || []);
    setRecipe(project.recipe); updateSampleOptions();
    for (const option of $('noRTSamples').options) option.selected = (project.controls.noRTSamples || []).includes(option.value);
    $('calibratorSample').value = project.controls.calibratorSample || '';
    renderSampleExtensions(); renderAssayChoices(); setControlsVisibility(); renderChecklistEditor(); renderCapacity(); updatePrintPageStyle(); updateZoomControls();
  }
  return { resolveGenes, renderSampleExtensions, renderAssayChoices, addOverrideRow, loadOverride, applyOverride, addRecipeRow, recipeFromForm, setRecipe, renderPremixOptions, renderRecipeSummary, updateSampleOptions, setControlsVisibility, readProject, setForm };
  } };
})();
