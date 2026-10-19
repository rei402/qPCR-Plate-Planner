(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRLabLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MODE = 'labPriorityHybrid';
  function regions(type) {
    return Number(type) === 384 ? [
      { id: 'Q1', name: '左上', row: 0, col: 0 }, { id: 'Q2', name: '右上', row: 0, col: 12 },
      { id: 'Q3', name: '左下', row: 8, col: 0 }, { id: 'Q4', name: '右下', row: 8, col: 12 }
    ] : [{ id: 'Q1', name: '整板', row: 0, col: 0 }];
  }
  function localToGlobalWell(region, row, col) { return String.fromCharCode(65 + region.row + row) + (region.col + col + 1); }
  function primaryReference(project) {
    const refs = project.genes.filter(g => g.type === 'reference');
    return refs.length === 1 ? refs[0] : refs.find(g => g.id === project.settings.primaryReferenceGeneId) || null;
  }
  function referenceLocalRow(project) { return project.settings.referenceRowPreference === 'bottom' ? 7 : 0; }
  function assayOrder(project) {
    const primary = primaryReference(project), others = project.genes.filter(g => g.id !== primary?.id);
    return primary ? project.settings.referenceRowPreference === 'bottom' ? [...others, primary] : [primary, ...others] : others;
  }
  function regularRows(project) {
    const primary = primaryReference(project), edge = referenceLocalRow(project), result = new Map();
    if (primary) result.set(primary.id, edge);
    const available = Array.from({ length: 8 }, (_, i) => i).filter(i => !primary || i !== edge);
    project.genes.filter(g => g.id !== primary?.id).slice(0, available.length).forEach((g, i) => result.set(g.id, available[i]));
    return result;
  }
  function free(board, region, row, col) { return !board.used.has(localToGlobalWell(region, row, col)); }
  function findFreeRectangle(board, region, height, width) {
    if (height > 8 || width > 12) return null;
    for (let row = 0; row <= 8 - height; row++) for (let col = 0; col <= 12 - width; col++) {
      let available = true;
      for (let r = row; r < row + height && available; r++) for (let c = col; c < col + width; c++) if (!free(board, region, r, c)) { available = false; break; }
      if (available) return { row, col };
    }
    return null;
  }
  function findHorizontalRun(board, region, width) { return findFreeRectangle(board, region, 1, width); }
  const cloneBoard = board => ({ ...board, used: new Set(board.used), wells: [...board.wells], slots: new Set(board.slots) });
  function put(board, group, region, row, col, kind) {
    const reactions = [...group.reactions].sort((a, b) => a.replicate - b.replicate);
    reactions.forEach((reaction, i) => {
      const well = localToGlobalWell(region, row, col + i);
      if (board.used.has(well)) throw new Error('实验室布局尝试使用已占用或保留孔。');
      board.used.add(well); board.wells.push({ ...reaction, well, r: region.row + row, c: region.col + col + i, row: String.fromCharCode(65 + region.row + row), column: region.col + col + i + 1, placementKind: kind });
    });
  }
  function groupKey(group) { return JSON.stringify([group.type, group.sample, group.geneId]); }
  function groupReactions(reactions) {
    const map = new Map();
    for (const r of reactions) { const key = groupKey(r); if (!map.has(key)) map.set(key, { type: r.type, sample: r.sample, geneId: r.geneId, reactions: [] }); map.get(key).reactions.push(r); }
    return [...map.values()];
  }
  function orderedGroups(project, groups) { const order = assayOrder(project).map(g => g.id); return [...groups].sort((a, b) => order.indexOf(a.geneId) - order.indexOf(b.geneId)); }
  function tile(board, project, groups, kind = 'compact') {
    if (!groups.length || new Set(groups.map(g => g.reactions.length)).size !== 1) return null;
    const sorted = orderedGroups(project, groups), width = sorted[0].reactions.length;
    for (const region of regions(project.plateType)) {
      const position = findFreeRectangle(board, region, sorted.length, width);
      if (position) { const next = cloneBoard(board); sorted.forEach((g, i) => put(next, g, region, position.row + i, position.col, kind)); return next; }
    }
    return null;
  }
  function strip(board, project, group, kind = 'strip') {
    if(project.settings.layoutMode==='singleChannelOptimized' && group.type!=='sample' && group.reactions.length>12){
      const reactions=[...group.reactions].sort((a,b)=>a.replicate-b.replicate), count=reactions.length;
      for(const region of regions(project.plateType))for(let start=0;start<=96-count;start++){
        if(!reactions.every((_,i)=>free(board,region,Math.floor((start+i)/12),(start+i)%12)))continue;
        const next=cloneBoard(board);
        for(let offset=0;offset<count;){const index=start+offset,length=Math.min(count-offset,12-index%12);put(next,{...group,reactions:reactions.slice(offset,offset+length)},region,Math.floor(index/12),index%12,kind);offset+=length;}
        return next;
      }
      return null;
    }
    for (const region of regions(project.plateType)) {
      const position = findHorizontalRun(board, region, group.reactions.length);
      if (position) { const next = cloneBoard(board); put(next, group, region, position.row, position.col, kind); return next; }
    }
    return null;
  }
  function controlBlock(board, project, groups) {
    const rows = regularRows(project), width = groups[0]?.reactions.length;
    if (!groups.length || groups.some(g => !rows.has(g.geneId) || g.reactions.length !== width)) return null;
    for (const region of regions(project.plateType)) for (let col = 0; col <= 12 - width; col += groups[0].type === 'sample' ? width : 1) {
      if (groups.every(g => Array.from({ length: width }, (_, i) => free(board, region, rows.get(g.geneId), col + i)).every(Boolean))) {
        const next = cloneBoard(board); groups.forEach(g => put(next, g, region, rows.get(g.geneId), col, g.type === 'sample' ? 'standard' : 'control')); return next;
      }
    }
    return null;
  }
  function placeRequired(board, project, groups) {
    let next = board;
    const byMaterial = new Map();
    for (const group of groups) { const key = JSON.stringify([group.type, group.sample]); if (!byMaterial.has(key)) byMaterial.set(key, []); byMaterial.get(key).push(group); }
    for (const batch of byMaterial.values()) {
      const whole = controlBlock(next, project, batch) || tile(next, project, batch, batch[0].type === 'sample' ? 'compact' : 'control');
      if (whole) { next = whole; continue; }
      for (const group of orderedGroups(project, batch)) { next = strip(next, project, group, group.type === 'sample' ? 'strip' : 'control'); if (!next) return null; }
    }
    return next;
  }
  function metadata(project, wells) {
    const primary = primaryReference(project), allRegions = regions(project.plateType);
    const samples = kind => project.samples.filter(s => wells.some(w => w.type === 'sample' && w.sample === s && (kind === 'standard' ? w.placementKind === kind : w.placementKind !== 'standard')));
    const standardSamples = samples('standard'), residualSamples = samples('residual');
    const standardBlocks = [];
    for (const region of allRegions) for (const sample of standardSamples) {
      const assigned = wells.filter(w => w.type === 'sample' && w.sample === sample && w.placementKind === 'standard' && w.r >= region.row && w.r < region.row + 8 && w.c >= region.col && w.c < region.col + 12);
      if (assigned.length) standardBlocks.push({ sample, region: region.id, firstColumn: Math.min(...assigned.map(w => w.column)), lastColumn: Math.max(...assigned.map(w => w.column)) });
    }
    return { mode: MODE, primaryReferenceGeneId: primary?.id || '', primaryReferenceName: primary?.name || '', referenceRowPreference: project.settings.referenceRowPreference || 'top', referenceRows: primary ? [...new Set(allRegions.map(r => String.fromCharCode(65 + r.row + referenceLocalRow(project))))] : [], standardSamples, residualSamples, standardBlocks, standardWells: wells.filter(w => w.type === 'sample' && w.placementKind === 'standard').length, residualWells: wells.filter(w => w.type === 'sample' && w.placementKind !== 'standard').length, controlWells: wells.filter(w => w.type !== 'sample').length, compactSamples: project.samples.filter(s => wells.some(w => w.sample === s && w.type === 'sample' && w.placementKind === 'compact')), stripSamples: project.samples.filter(s => wells.some(w => w.sample === s && w.type === 'sample' && w.placementKind === 'strip')), regions: allRegions };
  }
  function summary(project, plate) {
    const m=plate.layoutMetadata; if (!m) return [];
    if(m.longReplicates)return ['技术重复超过 12：同一逻辑 96 孔区内逐行连续换行，未使用单行标准列组。', m.primaryReferenceName?'主内参 '+m.primaryReferenceName+' 优先贴近'+(m.referenceRowPreference==='bottom'?'底部':'顶部')+'边缘；实际行 '+m.referenceRows.join('/'):'无主内参；不预留内参行', ...m.regions.map(q=>q.id+' '+q.name+' · '+localToGlobalWell(q,0,0)+'–'+localToGlobalWell(q,7,11))];
    const code=sample=>'S'+String(project.samples.indexOf(sample)+1).padStart(2,'0');
    return [
      m.primaryReferenceName ? `主内参 ${m.primaryReferenceName}：标准区 ${m.referenceRows.join('/')} 行；紧凑矩形${m.referenceRowPreference==='bottom'?'末':'首'}行` : '无主内参；不预留内参行',
      ...m.regions.map(q=>`${q.id} ${q.name} · ${localToGlobalWell(q,0,0)}–${localToGlobalWell(q,7,11)}：${m.standardBlocks.filter(b=>b.region===q.id).map(b=>`${code(b.sample)} [${b.firstColumn}–${b.lastColumn}列]`).join('；') || '无标准样品列组'}`),
      `剩余区：紧凑 ${m.compactSamples.map(code).join('、') || '无'}；水平条带 ${m.stripSamples.map(code).join('、') || '无'}；${m.residualWells} 孔。完整技术重复始终水平连续。`
    ];
  }
  function assertLayout(project, plates) {
    const rows = regularRows(project);
    for (const plate of plates) {
      for (const group of groupReactions(plate.wells)) {
        const assigned = [...group.reactions].sort((a, b) => a.replicate - b.replicate), first = assigned[0];
        if (group.type === 'sample' && new Set(assigned.map(w=>w.placementKind)).size !== 1) throw new Error('同一技术重复组的布局类型必须一致。');
        if (group.type === 'sample' && assigned.length !== Number(project.replicates)) throw new Error('实验室布局不能拆开技术重复组。');
        if(project.settings.layoutMode==='singleChannelOptimized' && group.type!=='sample' && assigned.length>12){
          const start=first.r%8*12+first.c%12;
          if(assigned.some((w,i)=>Math.floor(w.r/8)!==Math.floor(first.r/8)||Math.floor(w.c/12)!==Math.floor(first.c/12)||w.r%8*12+w.c%12!==start+i))throw new Error('长对照重复必须在同一区域内逐行连续。');
        }else if (assigned.some((w, i) => w.r !== first.r || w.c !== first.c + i || Number(project.plateType) === 384 && Math.floor(w.c / 12) !== Math.floor(first.c / 12))) throw new Error('实验室布局的技术重复必须水平连续且不跨区域。');
        for (const w of assigned.filter(w => w.placementKind === 'standard')) if (w.r % 8 !== rows.get(w.geneId)) throw new Error('标准布局的主内参或 assay 行不一致。');
      }
      for (const block of metadata(project, plate.wells).standardBlocks) if (block.lastColumn - block.firstColumn + 1 !== Number(project.replicates) || (block.firstColumn-1)%12%Number(project.replicates)!==0) throw new Error('标准样品未使用固定技术重复列组。');
      for (const sample of project.samples) {
        const compact = plate.wells.filter(w => w.type === 'sample' && w.sample === sample && w.placementKind === 'compact');
        if (compact.length) {
          if (new Set(compact.map(w => Math.floor(w.r / 8) + ':' + Math.floor(w.c / 12))).size !== 1) throw new Error('紧凑样品矩形不得跨越 384 分区。');
          const minR=Math.min(...compact.map(w=>w.r)), maxR=Math.max(...compact.map(w=>w.r)), minC=Math.min(...compact.map(w=>w.c)), maxC=Math.max(...compact.map(w=>w.c));
          if ((maxR-minR+1)*(maxC-minC+1)!==compact.length || maxC-minC+1!==Number(project.replicates)) throw new Error('紧凑样品必须保持完整矩形。');
          const primary=primaryReference(project), ref=compact.find(w=>w.geneId===primary?.id);
          if (ref && ref.r!==(project.settings.referenceRowPreference==='bottom'?maxR:minR)) throw new Error('紧凑矩形主内参行不一致。');
        }
      }
    }
  }
  function generateLabPriorityLayout(project, context) {
    const { groups, reserved, controlsForPlate, firstCalibrationGroups = [] } = context;
    const sampleGroups = groups.filter(g => g.type === 'sample'), projectControls = project.controls.scope === 'plate' ? [] : groups.filter(g => g.type !== 'sample');
    const pending = new Map(sampleGroups.map(g => [groupKey(g), g])), plates = [], rows = regularRows(project), width = Number(project.replicates);
    const blank = index => ({ number: index + 1, used: new Set(reserved), wells: [], slots: new Set() });
    function required(board) {
      const missing = board.number === 1 ? firstCalibrationGroups.filter(g => !board.wells.some(w => w.sample === g.sample && w.geneId === g.geneId && ['sample','calibrator'].includes(w.type))) : [];
      const withCal = placeRequired(board, project, missing); if (!withCal) return null;
      return placeRequired(withCal, project, groupReactions(controlsForPlate(withCal.wells, board.number - 1)));
    }
    const acceptable = candidate => candidate && required(candidate) ? candidate : null;
    function consume(board) { const ids = new Set(board.wells.map(w => w.id)); for (const [key, g] of pending) if (g.reactions.every(r => ids.has(r.id))) pending.delete(key); }
    while (pending.size) {
      const pendingBefore = pending.size;
      let board = blank(plates.length);
      // Exhaust every physical quadrant's standard slots before residual packing.
      for (const region of regions(project.plateType)) for (let col = 0; col <= 12 - width; col += width) {
        const sample = project.samples.find(s => [...pending.values()].some(g => g.sample === s && rows.has(g.geneId)));
        if (!sample) break;
        const mapped = [...pending.values()].filter(g => g.sample === sample && rows.has(g.geneId));
        if (!mapped.every(g => Array.from({ length: g.reactions.length }, (_, i) => free(board, region, rows.get(g.geneId), col + i)).every(Boolean))) continue;
        const candidate = cloneBoard(board); mapped.forEach(g => put(candidate, g, region, rows.get(g.geneId), col, 'standard'));
        if (acceptable(candidate)) { board = candidate; consume(board); }
      }
      for (const sample of project.samples) {
        const remaining = [...pending.values()].filter(g => g.sample === sample);
        if (!remaining.length) continue;
        const compact = acceptable(tile(board, project, remaining));
        if (compact) { board = compact; consume(board); continue; }
        for (const group of orderedGroups(project, remaining)) {
          const candidate = acceptable(strip(board, project, group));
          if (candidate) { board = candidate; consume(board); }
        }
      }
      const finished = required(board);
      if (!finished || !finished.wells.length) throw new Error('无法在一个 96 孔区域内连续容纳完整技术重复及逐板对照；请减少重复/保留孔或选择其他排板方式。');
      consume(finished);
      if (pending.size === pendingBefore) throw new Error('完整技术重复与必需逐板对照无法共同放入孔板。');
      plates.push(finished);
    }
    // Project controls use remaining space on existing plates before creating one.
    const controlsPending = new Map(projectControls.map(g => [groupKey(g),g]));
    function fillControls(board) {
      let next = board;
      const materialKeys = [...new Set([...controlsPending.values()].map(g => JSON.stringify([g.type,g.sample])))];
      for (const key of materialKeys) {
        const batch = [...controlsPending.values()].filter(g => JSON.stringify([g.type,g.sample]) === key);
        const whole = controlBlock(next, project, batch) || tile(next, project, batch, 'control');
        if (whole) { next = whole; batch.forEach(g => controlsPending.delete(groupKey(g))); }
        else for (const group of orderedGroups(project,batch)) { const candidate = strip(next,project,group,'control'); if (candidate) { next=candidate; controlsPending.delete(groupKey(group)); } }
      }
      return next;
    }
    for (let i=0;i<plates.length;i++) plates[i]=fillControls(plates[i]);
    while (controlsPending.size) {
      const board=required(blank(plates.length)); if (!board) throw new Error('逐板校准反应无法连续放入孔板。');
      const before=controlsPending.size, next=fillControls(board); if (controlsPending.size===before) throw new Error('对照技术重复无法在 12 列区域内连续放置。'); plates.push(next);
    }
    const all = plates.flatMap(p=>p.wells), ids = new Set(all.map(w=>w.id));
    if (ids.size !== all.length) throw new Error('实验室布局重复分配反应。');
    for (const group of [...sampleGroups,...projectControls]) for (const r of group.reactions) if (!ids.has(r.id)) throw new Error('实验室布局遗漏反应。');
    assertLayout(project,plates);
    return plates.map(p=>({ number:p.number,wells:p.wells,layout:MODE,sequence:'sample',score:0,layoutMetadata:metadata(project,p.wells) }));
  }
  return { MODE, regions, localToGlobalWell, primaryReference, referenceLocalRow, assayOrder, regularRows, findFreeRectangle, findHorizontalRun, metadata, summary, assertLayout, generateLabPriorityLayout };
});
