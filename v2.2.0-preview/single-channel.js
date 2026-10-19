(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./lab-layout.js') : root.QPCRLabLayout);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRSingleChannel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Lab) {
  'use strict';
  const MODE = 'singleChannelOptimized';
  const round = n => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  const optional = n => n === '' || n == null ? null : Number(n);
  function config(project) {
    const input = project.settings.singleChannel || {};
    const instrument = x => ({ name: '', minVolume: null, maxVolume: null, dispenseLimit: null, maxWells: null, deadVolume: 0, tubeCapacity: null, rackRows: 8, rackColumns: 12, strategy: 'spatial', tipPolicy: 'unknown', ...x });
    return { includeWater: false, sybrStockFold: null, sybrFinalFold: null, sources: {}, ...input, primer: instrument(input.primer), sampleMix: instrument(input.sampleMix) };
  }
  function isMode(project) { return project?.settings?.layoutMode === MODE; }
  function designKey(project) { return JSON.stringify({ samples: project.samples, genes: project.genes.map(g => [g.id, g.name, g.type]), sampleIds: project.samples.map(s => project.sampleMetadata?.[s]?.id || s), recipe: project.recipe, overrides: project.assayRecipes, controls: project.controls, selection: project.assaySelection, plateType: project.plateType, replicates: project.replicates, reactionVolume: project.reactionVolume, layoutMode: project.settings.layoutMode, reference: project.settings.primaryReferenceGeneId, edge: project.settings.referenceRowPreference, reserved: project.settings.reserved, waste: project.settings.wastePercent, extra: project.settings.minimumExtra, singleChannel: config(project) }); }
  function assignmentKey(plate) { return JSON.stringify(plate.wells.map(w => [w.id, w.well, w.type, w.geneId, w.sample, w.replicate])); }
  function sourceKey(type, id) { return JSON.stringify([type, id]); }
  function chemistry(project, Q) {
    const cfg = config(project), result = [], errors = [], warnings = [];
    for (const gene of Q.activeGenes(project)) {
      const assay = Q.assayProject(project, gene.id), recipe = assay.recipe;
      const selected = recipe.assayPremix?.enabled ? Q.premixSelection(recipe).map(x => x.index) : recipe.components.flatMap((c, i) => ['forward_primer', 'reverse_primer'].includes(c.role) || cfg.includeWater && c.role === 'water' ? [i] : []);
      const primer = recipe.components.filter((_, i) => selected.includes(i)).map(c => ({ ...c, perReaction: Number(c.volumePerReaction) }));
      const sample = recipe.components.filter((_, i) => !selected.includes(i)).map(c => ({ ...c, perReaction: Number(c.volumePerReaction) }));
      const primerVolume = round(primer.reduce((n, c) => n + c.perReaction, 0)), sampleVolume = round(sample.reduce((n, c) => n + c.perReaction, 0));
      if (!primer.length || primerVolume <= 0) errors.push(gene.name + '：未配置引物工作液；请设置 F/R 体积或启用现有独立 Mix 并选择已配好的工作液组分。');
      if (primer.some(c => ['template', 'mastermix'].includes(c.role))) errors.push(gene.name + '：引物工作液不能含模板或 SYBR 通用 Mix。');
      if (sample.some(c => ['forward_primer', 'reverse_primer', 'probe'].includes(c.role) && c.perReaction > 0)) errors.push(gene.name + '：仍有 assay 特异组分留在样品混合液中，请将其全部纳入独立工作液。');
      if (!sample.some(c => c.role === 'mastermix' && c.perReaction > 0) || !sample.some(c => c.role === 'template' && c.perReaction > 0) || sampleVolume <= 0) errors.push(gene.name + '：Sample Master Mix 必须包含有效的模板和通用 Mix 体积。');
      if (Math.abs(primerVolume + sampleVolume - Number(assay.reactionVolume)) > 1e-5) errors.push(gene.name + '：两种液体的合计与总反应体积不一致。');
      const sampleTotals = new Map();
      for (const c of sample.filter(c => c.perReaction > 0)) { const key = JSON.stringify([c.role, c.role === 'water' ? '' : c.name]); sampleTotals.set(key, round((sampleTotals.get(key) || 0) + c.perReaction)); }
      const signature = JSON.stringify([...sampleTotals].sort((a, b) => a[0].localeCompare(b[0])));
      if (result.length && result[0].signature !== signature) errors.push(gene.name + '：样品侧配方与其他 assay 不一致，无法从同一 Sample Master Mix 管向全部 Target 分装。请统一样品侧配方或使用旧模式。');
      if (optional(cfg.sybrStockFold) != null && optional(cfg.sybrFinalFold) != null) {
        const mixVolume = sample.filter(c => c.role === 'mastermix').reduce((n, c) => n + c.perReaction, 0);
        const actual = Number(cfg.sybrStockFold) * mixVolume / Number(assay.reactionVolume);
        if (Math.abs(actual - Number(cfg.sybrFinalFold)) > 1e-5) warnings.push(gene.name + '：按输入体积，SYBR 最终为 ' + round(actual) + '×，与要求 ' + cfg.sybrFinalFold + '× 不一致；未自动修改配方。');
      }
      result.push({ gene, primer, sample, primerVolume, sampleVolume, signature, premix: recipe.assayPremix, reactionVolume: Number(assay.reactionVolume) });
    }
    return { assays: result, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }
  function validate(project, Q) {
    const cfg = config(project), errors = [], warnings = [];
    if (project.settings.singleChannel != null && (typeof project.settings.singleChannel !== 'object' || Array.isArray(project.settings.singleChannel))) return { errors: ['单通道设置格式错误。'], warnings };
    for (const phase of ['primer', 'sampleMix']) {
      const p = cfg[phase], label = phase === 'primer' ? '引物移液器' : '样品混合液移液器';
      const raw = project.settings.singleChannel?.[phase];
      if (raw != null && (typeof raw !== 'object' || Array.isArray(raw))) { errors.push(label + '设置格式错误。'); continue; }
      for (const key of ['minVolume', 'maxVolume', 'dispenseLimit', 'maxWells', 'tubeCapacity']) if (p[key] != null && p[key] !== '' && (!Number.isFinite(Number(p[key])) || Number(p[key]) <= 0)) errors.push(label + '的 ' + key + ' 必须大于 0。');
      for (const key of ['maxWells', 'rackRows', 'rackColumns']) if ((key !== 'maxWells' || optional(p[key]) != null) && (!Number.isInteger(Number(p[key])) || Number(p[key]) < 1)) errors.push(label + '的 ' + key + ' 必须为正整数。');
      if (Number(p.rackRows) > 26 || Number(p.rackColumns) > 100) errors.push(label + '管架最多 26 行 × 100 列。');
      if (!Number.isFinite(Number(p.deadVolume)) || Number(p.deadVolume) < 0) errors.push(label + '死体积不能为负数。');
      if (p.minVolume != null && p.maxVolume != null && Number(p.minVolume) > Number(p.maxVolume)) errors.push(label + '最小体积超过最大量程。');
      if (p.dispenseLimit != null && p.maxVolume != null && Number(p.dispenseLimit) > Number(p.maxVolume)) errors.push(label + '单次连续分液上限不能超过最大量程。');
      if (!['spatial', 'capacity'].includes(p.strategy) || !['unknown', 'perBatch', 'perWell'].includes(p.tipPolicy)) errors.push(label + '批次或吸头策略无效。');
    }
    if (!cfg.sources || typeof cfg.sources !== 'object' || Array.isArray(cfg.sources)) errors.push('来源管设置格式错误。');
    for (const [key, source] of Object.entries(cfg.sources || {})) {
      if (!source || typeof source !== 'object' || Array.isArray(source) || source.tubeId != null && typeof source.tubeId !== 'string' || source.rackPosition != null && typeof source.rackPosition !== 'string') errors.push('来源管标签或位置格式错误：' + key);
      if (source?.capacity != null && source.capacity !== '' && (!Number.isFinite(Number(source.capacity)) || Number(source.capacity) <= 0)) errors.push('来源管容量必须大于 0。');
    }
    for (const key of ['sybrStockFold', 'sybrFinalFold']) if (cfg[key] != null && cfg[key] !== '' && (!Number.isFinite(Number(cfg[key])) || Number(cfg[key]) <= 0)) errors.push('SYBR 浓度倍数必须大于 0。');
    if ((optional(cfg.sybrStockFold) == null) !== (optional(cfg.sybrFinalFold) == null)) warnings.push('SYBR 浓度校验需要同时填写原液与目标最终倍数，当前未计算最终浓度。');
    if (cfg.includeWater !== true && cfg.includeWater !== false) errors.push('工作液补水选项必须为布尔值。');
    const checked = chemistry(project, Q); errors.push(...checked.errors); warnings.push(...checked.warnings);
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }
  function coordinate(well) { const m = /^([A-P])(\d+)$/.exec(well); if (!m) throw Error('无效孔位：' + well); return { r: m[1].charCodeAt(0) - 65, c: Number(m[2]) - 1 }; }
  function region(well, type) { const p = coordinate(well); return Number(type) === 384 ? (p.r >= 8 ? 2 : 0) + (p.c >= 12 ? 1 : 0) : 0; }
  function metadata(project, wells) {
    const value = Lab.metadata(project, wells);
    return { ...value, mode: MODE, ...(Number(project.replicates) > 12 ? { longReplicates: true, referenceRows: [...new Set(wells.filter(w => w.geneId === Lab.primaryReference(project)?.id).map(w => w.row))] } : {}) };
  }
  function assertLayout(project, plates) {
    if (Number(project.replicates) <= 12) return Lab.assertLayout(project, plates);
    for (const plate of plates) {
      const groups = new Map();
      for (const w of plate.wells) { const key = JSON.stringify([w.type,w.sample,w.geneId]); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(w); }
      for (const group of groups.values()) {
        group.sort((a,b)=>a.replicate-b.replicate); const first = group[0], start = first.r % 8 * 12 + first.c % 12;
        if (first.type === 'sample' && group.length !== Number(project.replicates)) throw Error('不能拆分完整技术重复组。');
        if (group.some((w,i)=>region(w.well,project.plateType)!==region(first.well,project.plateType) || w.r%8*12+w.c%12!==start+i)) throw Error('长技术重复必须在同一 96 孔区域内逐行连续换行。');
      }
    }
  }
  function generateLayout(project, context) {
    if (Number(project.replicates) <= 12) return Lab.generateLabPriorityLayout(project, context);
    // More than twelve repeats cannot fit one quadrant row; use consecutive local row-major runs.
    const { groups, reserved, controlsForPlate, firstCalibrationGroups=[] } = context;
    const main = groups.filter(g=>g.type==='sample'), projectControls = project.controls.scope==='plate'?[]:groups.filter(g=>g.type!=='sample');
    const pending = new Map(main.map(g=>[JSON.stringify([g.type,g.sample,g.geneId]),g])), plates=[];
    const clone = b=>({number:b.number,wells:[...b.wells],used:new Set(b.used)}), blank=()=>({number:plates.length+1,wells:[],used:new Set(reserved)});
    const primary = Lab.primaryReference(project), order = Lab.assayOrder(project).map(g=>g.id);
    const sorted = gs=>[...gs].sort((a,b)=>(b.geneId===primary?.id)-(a.geneId===primary?.id)||order.indexOf(a.geneId)-order.indexOf(b.geneId));
    function place(board, group, onlyRegion) {
      if (!board) return null;
      const n=group.reactions.length;
      for (const q of onlyRegion?[onlyRegion]:Lab.regions(project.plateType)) {
        const starts=Array.from({length:97-n},(_,i)=>i);
        if(group.geneId===primary?.id&&project.settings.referenceRowPreference==='bottom')starts.reverse();
        for(const start of starts){const points=Array.from({length:n},(_,i)=>Lab.localToGlobalWell(q,Math.floor((start+i)/12),(start+i)%12));
          if(points.some(w=>board.used.has(w)))continue;
          const next=clone(board);[...group.reactions].sort((a,b)=>a.replicate-b.replicate).forEach((r,i)=>{const well=points[i],p=coordinate(well);next.used.add(well);next.wells.push({...r,well,...p,row:String.fromCharCode(65+p.r),column:p.c+1,placementKind:group.type==='sample'?'strip':'control'});});return next;
        }
      }return null;
    }
    function placeGroups(board, gs) {let next=board;for(const g of sorted(gs)){next=place(next,g);if(!next)return null;}return next;}
    function groupReactions(reactions){const map=new Map();for(const r of reactions){const key=JSON.stringify([r.type,r.sample,r.geneId]);if(!map.has(key))map.set(key,{...r,reactions:[]});map.get(key).reactions.push(r);}return [...map.values()];}
    function required(board){const missing=board.number===1?firstCalibrationGroups.filter(g=>!board.wells.some(w=>w.sample===g.sample&&w.geneId===g.geneId&&['sample','calibrator'].includes(w.type))):[];const cal=placeGroups(board,missing);return cal&&placeGroups(cal,groupReactions(controlsForPlate(cal.wells,board.number-1)));}
    const acceptable = b=>b&&required(b)?b:null;
    function consume(board){const ids=new Set(board.wells.map(w=>w.id));for(const [key,g]of pending)if(g.reactions.every(r=>ids.has(r.id)))pending.delete(key);}
    while(pending.size){let board=blank();const before=pending.size;
      for(const sample of project.samples){const gs=[...pending.values()].filter(g=>g.sample===sample);if(!gs.length)continue;
        let whole=null;for(const q of Lab.regions(project.plateType)){let candidate=board;for(const g of sorted(gs)){candidate=place(candidate,g,q);if(!candidate)break;}whole=acceptable(candidate);if(whole)break;}
        if(whole){board=whole;consume(board);}else for(const g of sorted(gs)){const candidate=acceptable(place(board,g));if(candidate){board=candidate;consume(board);}}
      }
      if(before===pending.size)throw Error('保留孔与必需对照使完整技术重复无法连续放置，请调整保留孔或设计。');
      board=required(board);consume(board);plates.push(board);
    }
    for(const g of sorted(projectControls)){let found=false;for(let i=0;i<plates.length;i++){const candidate=place(plates[i],g);if(candidate){plates[i]=candidate;found=true;break;}}if(!found){const candidate=place(required(blank()),g);if(!candidate)throw Error('对照无法在同一区域内连续放置。');plates.push(candidate);}}
    assertLayout(project,plates);
    return plates.map(b=>({number:b.number,wells:b.wells,layout:MODE,sequence:'sample',score:0,layoutMetadata:metadata(project,b.wells)}));
  }
  function orderWells(wells, type, phase) {
    const compare = axis => (a, b) => { const p = coordinate(a.well), q = coordinate(b.well); return region(a.well, type) - region(b.well, type) || (axis === 'row' ? p.r - q.r || p.c - q.c : p.c - q.c || p.r - q.r); };
    const row = [...wells].sort(compare('row')), column = [...wells].sort(compare('column'));
    if (phase === 'primer') return { wells: row, path: '按分区逐行', distance: distance(row) };
    return distance(column) < distance(row) ? { wells: column, path: '按分区逐列', distance: distance(column) } : { wells: row, path: '按分区逐行', distance: distance(row) };
  }
  function distance(wells) { return wells.reduce((n, w, i) => { if (!i) return n; const a = coordinate(wells[i - 1].well), b = coordinate(w.well); return n + Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }, 0); }
  function splitBatches(wells, perWell, device, type, phase) {
    if (!wells.length || !Number.isFinite(perWell) || perWell <= 0) throw Error('批次孔位或体积无效。');
    const maximum = optional(device.maxVolume), limit = optional(device.dispenseLimit), checked = maximum != null && limit != null;
    let capacity = checked ? Math.floor(Math.min(maximum, limit) / perWell + 1e-10) : null;
    if (checked && capacity < 1) throw Error('每孔体积超过移液器量程或单次连续分液上限。');
    if (capacity != null && optional(device.maxWells) != null) capacity = Math.min(capacity, Number(device.maxWells));
    if (capacity != null && device.tipPolicy === 'perWell') capacity = 1;
    const result = []; let current = [];
    for (const well of wells) {
      const previous = current.at(-1), a = previous && coordinate(previous.well), b = coordinate(well.well);
      const spatialBreak = previous && (region(previous.well, type) !== region(well.well, type) || device.strategy === 'spatial' && (phase === 'primer' ? a.r !== b.r || b.c !== a.c + 1 : Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1));
      if (current.length && (capacity != null && current.length >= capacity || spatialBreak)) { result.push(current); current = []; }
      current.push(well);
    }
    if (current.length) result.push(current);
    return result.map((group, i) => ({ aspirationBatchIndex: i + 1, aspirationBatchCount: checked ? result.length : null, navigationBatchIndex: i + 1, navigationBatchCount: result.length, capacityVerified: checked, aspirateVolume: checked ? round(perWell * group.length) : null, dispenseVolume: round(perWell * group.length), wells: group.map(w => w.well), reactionIds: group.map(w => w.id), region: 'Q' + (region(group[0].well, type) + 1), placementKinds: [...new Set(group.map(w => w.placementKind || 'strip'))] }));
  }
  function prepareSource(parts, required, project, device, Q, premix) {
    // Reuse the existing preparation rule once for each actual physical source.
    const waste = premix?.wastePercent == null ? project.settings.wastePercent : premix.wastePercent;
    const extra = premix?.minimumExtraReactions == null ? project.settings.minimumExtra : premix.minimumExtraReactions;
    const prepare = Q.prepareCount(required, waste, extra), perWell = round(parts.reduce((n, c) => n + c.perReaction, 0));
    const requiredVolume = round(required * perWell), total = round(prepare * perWell + Number(device.deadVolume));
    return { required, prepare, perWell, requiredVolume, total, extra: round(total - requiredVolume), deadVolume: Number(device.deadVolume), components: parts.map(c => ({ ...c, displayName: c.name, total: round(c.perReaction * total / perWell) })) };
  }
  function plan(project, plates, Q) {
    const checked = validate(project, Q), cfg = config(project), sources = [], tasks = [], steps = [], warnings = [...checked.warnings], errors = [...checked.errors];
    if (Number(project.replicates)>12) warnings.push('技术重复超过区域的 12 列：每组在同一逻辑 96 孔区内按列 1→12 逐行连续换行；主内参优先贴近所选边缘。此时不采用单行标准列组。');
    if (errors.length) return { ok: false, errors, warnings, sources, tasks, steps };
    try { validateAssignments(project, plates, Q); } catch (e) { return { ok: false, errors: [e.message], warnings, sources, tasks, steps }; }
    const chemistryById = new Map(chemistry(project, Q).assays.map(a => [a.gene.id, a]));
    const assigned = plates.flatMap(p => p.wells), rackIndex = { primer: 0, sampleMix: 0 };
    function addSource(phase, identity, label, parts, reactions, premix, info = {}) {
      if (!reactions.length) return;
      const key = sourceKey(phase, identity), i = rackIndex[phase]++, d = cfg[phase], custom = Object.hasOwn(cfg.sources, key) ? cfg.sources[key] : {};
      const code = phase === 'primer' ? 'P' + String(i + 1).padStart(2, '0') : 'S' + String(i + 1).padStart(2, '0');
      const prepared = prepareSource(parts, reactions.length, project, d, Q, premix);
      const position = custom.rackPosition || String.fromCharCode(65 + Math.floor(i / Number(d.rackColumns))) + (i % Number(d.rackColumns) + 1);
      const capacity = optional(custom.capacity) ?? optional(d.tubeCapacity);
      const source = { id: key, sourceId: key, phase, sourceType: phase === 'primer' ? 'targetPrimerMix' : info.controlType && info.controlType !== 'sample' ? 'controlMix' : 'sampleMasterMix', label, code, tubeId: custom.tubeId || code, rackPosition: position, capacity, ...prepared, ...info };
      if (i >= Number(d.rackRows) * Number(d.rackColumns)) errors.push((phase === 'primer' ? '引物' : '样品') + '管架容量不足。');
      const pos = /^([A-Z])(\d+)$/.exec(position);
      if (!pos || pos[1].charCodeAt(0) - 65 >= Number(d.rackRows) || Number(pos[2]) < 1 || Number(pos[2]) > Number(d.rackColumns)) errors.push(label + '：管架位置超出范围。');
      if (capacity != null && source.total > capacity + 1e-6) errors.push(label + '：配制量 ' + source.total + ' µL 超过来源管容量 ' + capacity + ' µL。');
      if (optional(d.minVolume) != null && source.perWell < Number(d.minVolume)) warnings.push(label + '：每孔 ' + source.perWell + ' µL 低于该移液器最小可靠体积 ' + d.minVolume + ' µL；请检查设备或工作液稀释，未改变配方。');
      if (optional(d.maxVolume) == null || optional(d.dispenseLimit) == null) warnings.push((phase === 'primer' ? '引物' : '样品混合液') + '移液器参数不完整：仅生成孔位导航与需求量，吸液批次数未经量程校验。');
      for (const c of source.components) if (optional(d.minVolume) != null && c.total > 0 && c.total < Number(d.minVolume)) warnings.push(label + ' 配制组分 ' + c.name + ' 总吸取量低于所配移液器可靠体积，请另选配制工具。');
      sources.push(source);
    }
    for (const gene of Q.activeGenes(project)) { const c = chemistryById.get(gene.id); addSource('primer', gene.id, gene.name + ' 引物工作液', c.primer, assigned.filter(w => w.geneId === gene.id), c.premix, { targetId: gene.id, targetName: gene.name, targetCode: 'T' + String(project.genes.findIndex(g => g.id === gene.id) + 1).padStart(2, '0') }); }
    const sampleParts = chemistryById.values().next().value?.sample || [];
    const materialList = project.samples.map(sample => ({ type: 'sample', sample })).concat(project.samples.map(sample => ({ type: 'noRT', sample })), [...new Set(assigned.filter(w => w.type === 'positive').map(w => w.sample))].map(sample => ({ type: 'positive', sample })), [{ type: 'ntc', sample: 'NTC' }]);
    function material(w) { return w.type === 'calibrator' ? { type: 'sample', sample: w.sample } : { type: w.type, sample: w.sample }; }
    for (const item of materialList) {
      const reactions = assigned.filter(w => { const m = material(w); return m.type === item.type && m.sample === item.sample; });
      const id = JSON.stringify([item.type, project.sampleMetadata?.[item.sample]?.id || item.sample]);
      const parts = sampleParts.map(c => c.role === 'template' && item.type !== 'sample' ? { ...c, name: item.type === 'ntc' ? 'NTC 无核酸酶水（替代模板）' : item.type === 'noRT' ? item.sample + ' No-RT 材料' : item.sample + ' 阳性模板' } : c);
      addSource('sampleMix', id, (item.type === 'sample' ? item.sample : item.type === 'ntc' ? 'NTC' : item.type === 'noRT' ? item.sample + ' No-RT' : item.sample + ' PC') + ' Sample Master Mix', parts, reactions, null, { sampleId: project.sampleMetadata?.[item.sample]?.id || item.sample, sample: item.sample, controlType: item.type });
    }
    for (const phase of ['primer', 'sampleMix']) {
      const list = sources.filter(s => s.phase === phase);
      if (new Set(list.map(s => s.rackPosition)).size !== list.length || new Set(list.map(s => s.tubeId)).size !== list.length) errors.push((phase === 'primer' ? '引物' : '样品') + '管架存在重复位置或重复管标签。');
    }
    for (const plate of plates) {
      for (const phase of ['primer', 'sampleMix']) for (const source of sources.filter(s => s.phase === phase)) {
        const wells = plate.wells.filter(w => phase === 'primer' ? w.geneId === source.targetId : material(w).type === source.controlType && w.sample === source.sample);
        if (!wells.length) continue;
        let ordered = orderWells(wells, project.plateType, phase); const device = cfg[phase];
        let batches;
        try {
          const candidates = [ordered];
          if (phase === 'sampleMix') for (const axis of ['row', 'column']) {
            const points = [...wells].sort((a, b) => { const p = coordinate(a.well), q = coordinate(b.well); return region(a.well, project.plateType) - region(b.well, project.plateType) || (axis === 'row' ? p.r - q.r || p.c - q.c : p.c - q.c || p.r - q.r); });
            candidates.push({ wells: points, path: axis === 'row' ? '按分区逐行' : '按分区逐列', distance: distance(points) });
          }
          for (const c of candidates) c.batches = splitBatches(c.wells, source.perWell, device, project.plateType, phase);
          candidates.sort((a, b) => a.batches.length - b.batches.length || a.distance - b.distance);
          ordered = candidates[0]; batches = ordered.batches;
        } catch (e) { errors.push(source.label + '：' + e.message); continue; }
        const task = { plateId: plate.number, phase, sourceId: source.id, sourceType: source.sourceType, sourceRackPosition: source.rackPosition, tubeId: source.tubeId, targetId: source.targetId, sampleId: source.sampleId, sample: source.sample, controlType: source.controlType, volumePerWell: source.perWell, totalWellCount: wells.length, wells: ordered.wells.map(w => w.well), segments: segments(ordered.wells, project.plateType), path: ordered.path, distance: ordered.distance, requiredVolume: round(wells.length * source.perWell), preparedVolume: source.total, aspirationBatchCount: batches.every(b => b.capacityVerified) ? batches.length : null, batches };
        tasks.push(task);
        for (const batch of batches) steps.push({ ...task, ...batch, kind: phase, title: (phase === 'primer' ? '阶段 1：' : '阶段 2：') + source.label + ' · ' + batch.navigationBatchIndex + '/' + batch.navigationBatchCount, sourceCode: source.code, sourceName: source.label, perWell: source.perWell, total: batch.dispenseVolume, range: Q.compressWells(batch.wells), note: source.controlType === 'ntc' ? '最后加入独立 NTC 混合液；以水替代模板。' : '确认来源管、阶段及 A1；禁止将接触孔内液体的吸头插回来源管或接触其他孔液体。疑似污染按实验室 SOP 换头。', completionState: 'pending' });
      }
      steps.push({ plateId: plate.number, phase: 'check', kind: 'check', title: '确认本板完成，封板、离心并复核孔位', perWell: 0, total: 0, wells: [], note: '复核本板两阶段和对照后再进入下一板；人工确认不代表检测到真实液体。' });
    }
    const valid = validateCoverage(project, plates, steps, chemistryById);
    errors.push(...valid);
    const liquids = steps.filter(s => s.wells.length), allChecked = liquids.every(s => s.capacityVerified);
    const changes = liquids.reduce((n, s, i) => n + (i && liquids[i - 1].sourceId !== s.sourceId ? 1 : 0), 0);
    const tips = liquids.every(s => cfg[s.phase].tipPolicy !== 'unknown') && allChecked ? liquids.reduce((n, s) => n + (cfg[s.phase].tipPolicy === 'perWell' ? s.wells.length : 1), 0) : null;
    return { ok: !errors.length, errors: [...new Set(errors)], warnings: [...new Set(warnings)], sources, tasks, steps: steps.map((s, i) => ({ ...s, index: i + 1 })), fingerprint: JSON.stringify({ version: 1, type: project.plateType, recipe: project.recipe, overrides: project.assayRecipes, config: cfg, assignments: plates.map(p => [p.number, p.wells.map(w => [w.id, w.well, w.type, w.geneId, w.sample, w.replicate])]) }), metrics: { wellDispenses: liquids.reduce((n, s) => n + s.wells.length, 0), aspirationBatches: allChecked ? liquids.length : null, navigationBatches: liquids.length, sourceSwitches: changes, distance: tasks.reduce((n, t) => n + t.distance, 0), tips, regionSwitches: liquids.reduce((n, s, i) => n + (i && liquids[i - 1].plateId === s.plateId && liquids[i - 1].region !== s.region ? 1 : 0), 0), method: '按板两阶段；引物逐分区按行，样品比较行/列路径，按量程与空间分段。确定性启发式，不保证数学绝对最优。' } };
  }
  function validateAssignments(project, plates, Q) {
    if (!Array.isArray(plates) || !plates.length) throw Error('缺少最终孔位分配。');
    const base = Q.reactionGroups(project).flatMap(g => g.reactions).filter(r => project.controls.scope !== 'plate' || r.type === 'sample');
    const expected = new Map(base.map(r => [r.id, r]));
    if (project.controls.calibratorSample) for (const gene of Q.activeGenes(project)) {
      if (!base.some(r => r.type === 'sample' && r.sample === project.controls.calibratorSample && r.geneId === gene.id)) {
        const r = { id: ['calibrator',project.controls.calibratorSample,gene.id,1].join('|'), type:'calibrator',sample:project.controls.calibratorSample,geneId:gene.id,replicate:1,replicateTotal:1 };
        expected.set(r.id, r);
      }
    }
    const seen = new Set(), plateNumbers = new Set(), reserved = new Set(Q.parseReserved(project.settings.reserved, project.plateType));
    for (let index = 0; index < plates.length; index++) {
      const plate = plates[index], occupied = new Set();
      if (plate.number !== index + 1 || plateNumbers.has(plate.number) || !Array.isArray(plate.wells)) throw Error('孔板编号或最终孔位格式无效。');
      plateNumbers.add(plate.number);
      for (const r of Q.plateAdditions(project, plate.wells, index)) expected.set(r.id, r);
      for (const w of plate.wells) {
        const id = Q.parseWell(w.well, project.plateType), coord = id && coordinate(id);
        if (!coord || id !== w.well || reserved.has(w.well) || occupied.has(w.well) || seen.has(w.id)) throw Error('最终孔位重复、越界或占用了保留孔。');
        if (w.r !== coord.r || w.c !== coord.c) throw Error('最终孔位坐标与 Well ID 不一致。');
        occupied.add(w.well); seen.add(w.id);
      }
    }
    for (const plate of plates) for (const w of plate.wells) {
      const r = expected.get(w.id);
      if (!r || ['type','sample','geneId','replicate','replicateTotal'].some(key => w[key] !== r[key])) throw Error('最终反应的 Sample、Target 或技术重复与实验设计不一致。');
      if (w.type !== 'sample' && project.controls.scope === 'plate' && ['ntc','positive','noRT'].includes(w.type) && !w.id.endsWith('plate' + plate.number)) throw Error('逐板对照位于错误孔板。');
    }
    if (seen.size !== expected.size || [...expected.keys()].some(id => !seen.has(id))) throw Error('最终孔位遗漏了预期反应。');
  }
  function segments(wells, type) {
    const list = []; for (const w of wells) { const last = list.at(-1), p = coordinate(w.well), q = last && coordinate(last.at(-1)); if (!last || region(last[0], type) !== region(w.well, type) || Math.abs(p.r - q.r) + Math.abs(p.c - q.c) !== 1) list.push([w.well]); else last.push(w.well); } return list;
  }
  function validateCoverage(project, plates, steps, chemistryById) {
    const errors = [], deliveriesByWell = new Map(), expected = new Set(plates.flatMap(p => p.wells.map(w => p.number + ':' + w.well)));
    for (const step of steps) for (const well of step.wells) { const key = step.plateId + ':' + well; if (!expected.has(key)) errors.push('批次引用未分配孔位。'); if (!deliveriesByWell.has(key)) deliveriesByWell.set(key, []); deliveriesByWell.get(key).push(step); }
    for (const plate of plates) for (const w of plate.wells) {
      const deliveries = deliveriesByWell.get(plate.number + ':' + w.well) || [];
      const primer = deliveries.filter(s => s.phase === 'primer'), sample = deliveries.filter(s => s.phase === 'sampleMix');
      if (primer.length !== 1 || sample.length !== 1 || primer[0]?.targetId !== w.geneId || sample[0]?.sample !== w.sample || sample[0]?.controlType !== (w.type === 'calibrator' ? 'sample' : w.type)) errors.push('Plate ' + plate.number + ' ' + w.well + ' 两阶段分液不守恒。');
      if (primer.length && sample.length && Math.abs(primer[0].perWell + sample[0].perWell - chemistryById.get(w.geneId).reactionVolume) > 1e-5) errors.push('孔内反应总体积不一致。');
    }
    return errors;
  }
  function primerCalculation(input) {
    const keys = ['forwardStock', 'reverseStock', 'forwardFinal', 'reverseFinal', 'reactionVolume', 'workingVolume'];
    if (keys.some(k => optional(input[k]) == null || !Number.isFinite(Number(input[k])) || Number(input[k]) <= 0)) throw Error('请完整填写正向/反向原液和最终浓度（统一 µM）、总反应体积及工作液每孔体积。');
    const forward = round(Number(input.forwardFinal) * Number(input.reactionVolume) / Number(input.forwardStock)), reverse = round(Number(input.reverseFinal) * Number(input.reactionVolume) / Number(input.reverseStock));
    const water = round(Number(input.workingVolume) - forward - reverse);
    if (water < 0) throw Error('所需 F/R 体积超过引物工作液每孔体积，无法补水。');
    return { forward, reverse, water, workingVolume: Number(input.workingVolume) };
  }
  function summary(plan) {
    const ingredients = new Map();
    for (const source of plan.sources) for (const c of source.components) {
      const name = source.phase === 'primer' || c.role === 'template' ? source.label + ' · ' + c.name : c.name, key = JSON.stringify([c.role, name]);
      if (!ingredients.has(key)) ingredients.set(key, { name, role: c.role, prepared: 0, reactionUse: 0 });
      const row = ingredients.get(key); row.prepared = round(row.prepared + c.total); row.reactionUse = round(row.reactionUse + c.perReaction * source.required);
    }
    return { ingredients: [...ingredients.values()].map(r => ({ ...r, extra: round(r.prepared - r.reactionUse) })), transfers: [] };
  }
  return { MODE, isMode, designKey, assignmentKey, config, sourceKey, validate, chemistry, plan, generateLayout, metadata, assertLayout, orderWells, splitBatches, distance, primerCalculation, summary, region };
});
