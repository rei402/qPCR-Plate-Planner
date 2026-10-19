(() => {
  'use strict';
  window.QPCRPlateRenderer = { create(ctx) {
  const { Q, View, Sel, Colors, state, $, esc, typeNames, selectedPlate, readProject, sampleCode, geneCode, selectEditorItem, updateSelectionVisuals, attachDragHandlers } = ctx;

  function buildPlateSvg(p = selectedPlate(), forPrint = false) {
    const project = state.project || readProject();
    p ||= { number: 1, wells: [] };
    const type = project.plateType, rows = Q.ROWS[type], cols = Q.COLS[type], cfg = View.PLATE_DISPLAY_CONFIG[type], editing = state.editorActive && !forPrint;
    const { width, height } = View.plateDimensions(type);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('class', `plate-svg plate-${type}${editing ? ' editing' : ''}`); svg.setAttribute('role', editing ? 'group' : 'img'); svg.setAttribute('aria-label', `Plate ${p.number}，${type} 孔孔板，左上角为 A1`);
    svg.style.setProperty('--primary-font-size', cfg.primaryFontSize + 'px');
    svg.style.setProperty('--secondary-font-size', cfg.secondaryFontSize + 'px');
    svg.style.setProperty('--row-header-size', cfg.rowHeaderSize + 'px');
    svg.style.setProperty('--column-header-size', cfg.columnHeaderSize + 'px');
    svg.style.setProperty('--well-stroke-width', String(cfg.strokeWidth));
    const make = (tag, attrs, parent = svg) => { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); parent.appendChild(el); return el; };
    function header(el, kind, value, label) {
      if (!editing) return;
      el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('class', el.getAttribute('class') + ' editor-header'); el.setAttribute('aria-label', label);
      el.dataset.headerKind = kind; el.dataset.headerValue = value;
      el.addEventListener('click', event => selectEditorItem(kind, value, event));
      el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEditorItem(kind, value, event); } });
      el.addEventListener('mouseenter', () => { state.hoverWells = new Set(kind === 'all' ? Sel.allWells(type) : kind === 'row' ? Sel.getRowWells(value, type) : Sel.getColumnWells(value, type)); updateSelectionVisuals(); });
      el.addEventListener('mouseleave', () => { state.hoverWells.clear(); updateSelectionVisuals(); });
    }
    const corner = make('text', { x: 8, y: 19, class: 'a1-marker' }); corner.textContent = '▲ A1'; header(corner, 'all', '', '选择全部孔位');
    for (let c = 1; c <= cols; c++) { const el = make('text', { x: cfg.marginX + (c - 0.5) * (cfg.wellWidth + cfg.horizontalGap), y: cfg.marginY - 13, class: 'axis-label col-label', 'text-anchor': 'middle' }); el.textContent = String(c); header(el, 'column', c, `选择第 ${c} 列`); }
    for (let r = 0; r < rows; r++) { const row = String.fromCharCode(65 + r), el = make('text', { x: cfg.marginX - 19, y: cfg.marginY + (r + 0.5) * (cfg.wellHeight + cfg.verticalGap) + 4, class: 'axis-label row-label', 'text-anchor': 'middle' }); el.textContent = row; header(el, 'row', row, `选择第 ${row} 行`); }
    const byWell = new Map(p.wells.map(r => [r.well, r])); let reserved;
    try { reserved = new Set(state.result?.reserved || Q.parseReserved(project.settings.reserved, type)); } catch (_) { reserved = new Set(); }
    const step = !forPrint && state.result && state.tab === 'steps' ? Q.stepsFor(p, project)[state.step] : null, highlighted = new Set(project.settings.layoutMode==='singleChannelOptimized'&&!window.QPCRSingleChannelUI?.current?.canOperate() ? [] : step?.wells || []);
    for (const coord of Q.coordinates(type)) {
      const r = byWell.get(coord.well), isReserved = reserved.has(coord.well), box = View.wellGeometry(type, coord.r, coord.c);
      const desc = r ? `${r.placementKind ? ({standard:'标准样品区',compact:'剩余区 · 紧凑矩形',strip:'剩余区 · 水平条带',control:'对照区'}[r.placementKind] || '') + '；' : ''}${typeNames[r.type]}；${r.type === 'ntc' ? '' : 'Sample：' + r.sample + '，编号 ' + sampleCode(r.sample) + '；'}Target：${r.gene}，编号 ${geneCode(r.geneId)}；技术重复 ${r.replicate} / ${r.replicateTotal}` : isReserved ? '保留孔' : '空孔';
      const g = make('g', { class: `well ${r ? 'occupied' : isReserved ? 'reserved' : 'empty'} ${highlighted.has(coord.well) ? 'highlighted' : ''} ${!forPrint && !editing && state.selectedWell === coord.well ? 'selected' : ''}${editing && state.selectedWells.has(coord.well) ? ' editor-selected' : ''}`, 'data-well': coord.well, 'data-row': coord.r, 'data-col': coord.c, tabindex: forPrint ? '-1' : '0', role: forPrint ? 'img' : 'button', 'aria-label': `${coord.well}，${isReserved ? '已保留' : r ? '已分配反应' : '可用'}${editing && state.selectedWells.has(coord.well) ? '，当前选中' : ''}；${desc}` });
      if (r) { const color = Colors.wellColor(r, project); g.style.setProperty('--well-fill', color.background); g.style.setProperty('--well-border', color.border); g.style.setProperty('--well-dash', color.borderDash || 'none'); }
      make('rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: cfg.borderRadius, class: 'well-bg' }, g);
      const title = make('title', {}, g); title.textContent = `${coord.well} · ${desc}`;
      if (r) {
        const label = r.type === 'sample' ? sampleCode(r.sample) : r.type === 'ntc' ? 'NTC' : r.type === 'noRT' ? 'NoRT' : r.type === 'positive' ? 'PC' : 'CAL';
        make('text', { x: box.centerX, y: box.primaryY, class: 'well-label', 'text-anchor': 'middle' }, g).textContent = label;
        make('text', { x: box.centerX, y: box.secondaryY, class: 'well-sub', 'text-anchor': 'middle' }, g).textContent = geneCode(r.geneId) + (type === 96 && r.type === 'sample' ? ' · R' + r.replicate : '');
        if (r.geneType === 'reference') make('path', { d: `M ${box.x + 3} ${box.y + 3} l 5 0 l -2.5 5 z`, class: 'reference-mark' }, g);
      } else if (isReserved) make('text', { x: box.centerX, y: box.y + box.height / 2 + 4, class: 'reserved-label', 'text-anchor': 'middle' }, g).textContent = '×';
      if (!forPrint) {
        if (!editing) g.addEventListener('click', () => wellClick(coord.well));
        g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editing ? selectEditorItem('well', coord.well, event) : wellClick(coord.well); } });
      }
    }
    if (p.layoutMetadata) {
      const cfgX=cfg.wellWidth+cfg.horizontalGap, cfgY=cfg.wellHeight+cfg.verticalGap;
      if (Number(type)===384) {
        make('line',{x1:cfg.marginX+12*cfgX,y1:cfg.marginY,x2:cfg.marginX+12*cfgX,y2:cfg.marginY+16*cfgY,stroke:'#8094a5','stroke-width':1,'stroke-dasharray':'3 3',class:'quadrant-divider'});
        make('line',{x1:cfg.marginX,y1:cfg.marginY+8*cfgY,x2:cfg.marginX+24*cfgX,y2:cfg.marginY+8*cfgY,stroke:'#8094a5','stroke-width':1,'stroke-dasharray':'3 3',class:'quadrant-divider'});
        p.layoutMetadata.regions.forEach(q=>make('text',{x:cfg.marginX+q.col*cfgX+3,y:q.row?height-2:12,fill:'#536879','font-size':9,class:'quadrant-label'}).textContent=q.id);
      }
      p.layoutMetadata.standardBlocks.forEach(b=>{
        const q=p.layoutMetadata.regions.find(q=>q.id===b.region), center=cfg.marginX+((b.firstColumn+b.lastColumn)/2-0.5)*cfgX;
        const label=make('text',{x:center,y:q.row?height-2:12,fill:'#314c62','font-size':10,'text-anchor':'middle',class:'sample-column-header'});
        label.textContent=sampleCode(b.sample); make('title',{},label).textContent=`${b.region} · ${b.sample} · ${b.firstColumn}–${b.lastColumn} 列`;
      });
    }
    if (editing) attachDragHandlers(svg, type);
    return svg;
  }
  function updateZoomControls() { $('plateZoomControls').hidden = Number($('plateType').value) !== 384; $('zoomValue').textContent = Math.round(state.plateZoom * 100) + '%'; $('zoomOut').disabled = state.plateZoom <= 1; $('zoomIn').disabled = state.plateZoom >= 1.5; }
  function renderPlate() {
    if (state.drag) { if (state.dragFrame) cancelAnimationFrame(state.dragFrame); state.dragFrame = 0; if (state.drag.svg.hasPointerCapture(state.drag.pointerId)) state.drag.svg.releasePointerCapture(state.drag.pointerId); state.drag = null; state.previewWells.clear(); }
    const svg = buildPlateSvg(), type = (state.project || readProject()).plateType;
    svg.style.width = type === 384 ? (state.plateZoom * 100) + '%' : '100%';
    svg.style.minWidth = (View.PLATE_DISPLAY_CONFIG[type].plateMinWidth * (type === 384 ? state.plateZoom : 1)) + 'px';
    $('plateView').replaceChildren(svg);
    const lines=window.QPCRLabLayout.summary(state.project || readProject(),selectedPlate() || {});
    if (lines.length) { const note=document.createElement('div'); note.className='lab-layout-summary'; note.innerHTML=lines.map(line=>`<p>${esc(line)}</p>`).join(''); $('plateView').prepend(note); }
    $('plateView').classList.toggle('plate-editing', state.editorActive);
    if (state.editorActive) updateSelectionVisuals();
    else if (!state.selectedWell) $('wellDetails').textContent = '点击孔位可查看完整信息；▲ 表示 A1 方向。';
  }
  function wellClick(well) {
    if (!state.result) return;
    state.selectedWell = well;
    const r = selectedPlate().wells.find(x => x.well === well);
    $('wellDetails').innerHTML = r ? `<strong>孔位：${esc(well)}</strong>　${r.type === 'ntc' ? '' : `Sample：${esc(r.sample)} (${esc(sampleCode(r.sample))})　`}Target：${esc(r.gene)} (${esc(geneCode(r.geneId))})　类型：${esc(typeNames[r.type])}${r.placementKind ? ' · ' + esc({standard:'标准区',compact:'剩余区 / 紧凑矩形',strip:'剩余区 / 水平条带',control:'对照'}[r.placementKind]) : ''}　技术重复：${r.replicate} / ${r.replicateTotal}` : `<strong>孔位：${esc(well)}</strong>　${state.result.reserved.includes(well) ? '保留 / 不使用' : '空孔'}`;
    renderPlate();
  }
  return { buildPlateSvg, updateZoomControls, renderPlate, wellClick };
  } };
})();
