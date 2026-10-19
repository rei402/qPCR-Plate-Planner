(() => {
  'use strict';
  window.QPCRPrint = { create(ctx) {
  const { Q, View, state, $, esc, buildPlateSvg, selectedPlate, updatePrintPageStyle, printOrientation } = ctx;

  function printPage(plate) {
    if(state.project.settings.layoutMode==='singleChannelOptimized') return window.QPCRSingleChannelUI.current.printPages([plate],'layout',true);
    const project = state.project, spec = View.printLayout(project.plateType, printOrientation());
    const svg = buildPlateSvg(plate, true).outerHTML;
    const warnings = state.result.warnings.filter(w => !/^Plate \d+ /.test(w) || w.startsWith('Plate ' + plate.number + ' '));
    return `<article class="print-page ${spec.className} ${plate.mixes.some(m => m.premix) ? 'has-premix' : ''}"><header class="print-header"><h1>qPCR Plate Planner · v${Q.APP_VERSION}</h1><p>实验：${esc(project.metadata.name || '________________')}　日期：${esc(project.metadata.date || '__________')}　操作者：${esc(project.metadata.operator || '__________')}</p><p>Plate ${plate.number} / ${state.result.plates.length} · ${project.plateType} 孔　通用反应体积 ${Q.volume(project.reactionVolume)} µL（独立配方见各 assay）　技术重复 ${project.replicates}　▲ A1 左上　对照：${Q.qcEnabled(project) ? project.controls.scope === 'plate' ? '逐板' : '项目范围' : '关闭'}</p></header><div class="print-body"><section class="print-map"><h2>孔板排布 · Plate Map</h2>${svg}${window.QPCRLabLayout.summary(project,plate).map(line=>`<p class="print-key">${esc(line)}</p>`).join('')}<p class="print-key">R = 技术重复；NTC / NoRT / PC / CAL = 对照；× = 保留孔；△ = 内参。</p></section><section class="print-legend"><h2>Sample / Target Legend</h2><div class="print-legend-grid"><div class="print-samples"><strong>Samples</strong><div class="print-legend-items">${project.samples.map((s, i) => `<span><b>S${String(i + 1).padStart(2, '0')}</b> ${esc(s)}${project.sampleMetadata[s]?.group ? ' · ' + esc(project.sampleMetadata[s].group) : ''}${project.sampleMetadata[s]?.biologicalReplicate ? ' / 生物重复 ' + esc(project.sampleMetadata[s].biologicalReplicate) : ''}</span>`).join('')}</div></div><div class="print-targets"><strong>Targets / 内参</strong><div class="print-legend-items">${project.genes.map((g, i) => `<span><b>T${String(i + 1).padStart(2, '0')}</b> ${esc(g.name)}${g.type === 'reference' ? ' △' : ''}</span>`).join('')}</div></div></div></section>${plate.mixes.some(m => m.premix) ? `<section class="print-premixes"><h2>独立 Primer / Assay Mix</h2>${plate.mixes.filter(m => m.premix).map(m => `<div class="print-mix"><strong>${esc(m.gene.name)} ${esc(m.premix.name)}</strong>　${m.premix.prepare} rxns · ${Q.volume(m.premix.perReaction)} µL / rxn · 总量 ${Q.volume(m.premix.total)} µL<div>${m.premix.components.map(c => `${esc(c.displayName)} ${Q.volume(c.total)} µL`).join('　')}</div></div>`).join('')}</section>` : ''}<section class="print-mixes"><h2>${plate.mixes.some(m => m.premix) ? 'Final Master Mix' : 'Master Mix'} · 每个 assay 独立配制</h2>${plate.mixes.map(m => `<div class="print-mix"><strong>${esc(m.gene.name)}</strong>　${m.required} 孔 → ${m.prepare} rxns · 总量 ${Q.volume(m.reactionVolume)} µL / 孔 · Mix ${Q.volume(m.totals.mix)} µL / 孔 · Template ${Q.volume(m.totals.template)} µL / 孔<div>${m.components.map(c => `${esc(c.displayName)} ${Q.volume(c.total)} µL`).join('　')}</div></div>`).join('')}</section><section class="print-checks"><h2>操作检查</h2><div class="print-checklist">${state.checklist.map((g, gi) => `<div class="print-check-group"><strong>${esc(g[0])}</strong>${g.slice(1).filter((_, ii) => !state.disabledChecklist.has(gi + ':' + (ii + 1))).map(item => { const check = View.checklistItem(item, plate.wells); return `<span>${check.applicable ? '□' : '—'} ${esc(check.label)}</span>`; }).join('')}</div>`).join('')}</div></section><section class="print-notes"><h2>备注 / 提醒</h2>${warnings.map(w => `<p>⚠ ${esc(w)}</p>`).join('')}<p>本单用于辅助操作；请核对试剂说明书、仪器要求和实验室 SOP。软件结果不能替代实验人员最终检查。</p></section></div></article>`;
  }
  function scalePrintPreview() {
    const preview = $('printPreview'), page = preview.querySelector('.print-page'), holder = preview.querySelector('.preview-holder');
    if (!page || !holder) return;
    const width = page.offsetWidth, height = page.offsetHeight;
    if (!width || !height) return;
    const scale = Math.min(1, Math.max(0.1, (preview.clientWidth - 24) / width));
    page.style.transform = `scale(${scale})`;
    holder.style.height = Math.ceil(height * scale) + 'px';
    holder.style.width = Math.ceil(width * scale) + 'px';
  }
  function renderPrint(scope = 'current') {
    updatePrintPageStyle();
    if (!state.result) return;
    const plates = scope === 'all' ? state.result.plates : [selectedPlate()];
    $('printSheet').innerHTML = state.project.settings.layoutMode==='singleChannelOptimized' ? window.QPCRSingleChannelUI.current.printPages(plates,'all') : plates.map(printPage).join('');
    $('printPreview').innerHTML = `<div class="preview-holder">${printPage(selectedPlate())}</div>`;
    requestAnimationFrame(scalePrintPreview);
  }
  function renderReagentPrint() {
    updatePrintPageStyle();
    const r = Q.reagentSummary(state.result.plates, state.project);
    const chunk = 22, pages = [];
    for (let i = 0; i < r.ingredients.length; i += chunk) pages.push(`<article class="print-page reagent-page ${View.printLayout(state.project.plateType, printOrientation()).className}"><header class="print-header"><h1>qPCR Plate Planner · 全板试剂汇总</h1><p>${esc(state.project.metadata.name)} · ${esc(state.project.metadata.date)} · v${Q.APP_VERSION} · ${state.result.plates.length} 块板 · 第 ${pages.length + 1} 页</p></header>${reagentTable({ ingredients: r.ingredients.slice(i, i + chunk), transfers: [] })}</article>`);
    for (let i = 0; i < r.transfers.length; i += chunk) pages.push(`<article class="print-page reagent-page ${View.printLayout(state.project.plateType, printOrientation()).className}"><header class="print-header"><h1>独立 Mix 配制与转移</h1><p>${esc(state.project.metadata.name)} · v${Q.APP_VERSION} · 第 ${pages.length + 1} 页</p></header>${reagentTable({ ingredients: [], transfers: r.transfers.slice(i, i + chunk) })}</article>`);
    $('printSheet').innerHTML = pages.join('');
  }
  function reagentTable(summary) {
    return `<table class="data-table"><thead><tr><th>试剂</th><th>实际用量 µL</th><th>配制量 µL</th><th>余量 µL</th></tr></thead><tbody>${summary.ingredients.map(r => `<tr><td>${esc(r.name)}</td><td>${Q.volume(r.reactionUse)}</td><td>${Q.volume(r.prepared)}</td><td>${Q.volume(r.extra)}</td></tr>`).join('')}</tbody></table><p class="small">${state.project.settings.layoutMode==='singleChannelOptimized'?'按真实来源管计算，模板已进入各自 Sample Master Mix；每管余量和死体积各计一次。':'模板用量按实际孔数计算，不额外预配。预混组分只计一次；下列转移量用于操作复核。'}</p>${summary.transfers.map(r => `<p class="small">Plate ${r.plate} · ${esc(r.assay)} · ${esc(r.name)}：配制 ${Q.volume(r.prepared)} µL，转移 ${Q.volume(r.transfer)} µL</p>`).join('')}`;
  }
  return { printPage, scalePrintPreview, renderPrint, renderReagentPrint, reagentTable };
  } };
})();
