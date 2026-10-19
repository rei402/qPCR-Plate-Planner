(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./lab-layout.js') : root.QPCRLabLayout, typeof module === 'object' && module.exports ? require('./single-channel.js') : root.QPCRSingleChannel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Lab, Single) {
  'use strict';

  const VERSION = 1;
  const APP_VERSION = '2.2.0';
  const LAYOUT_VERSION = 3;
  const NEW_PROJECT_DEFAULTS = Object.freeze({ layoutMode: Lab.MODE, printOrientation: 'portrait', paletteId: 'vividScience' });
  const ROWS = { 96: 8, 384: 16 };
  const COLS = { 96: 12, 384: 24 };
  const ROLES = ['mastermix', 'forward_primer', 'reverse_primer', 'probe', 'water', 'template', 'other'];
  const DEFAULT_CHECKLIST = [
    ['实验前', '已确认 Plate 类型', '已确认反应总体积', '已确认 Sample 顺序', '已确认 Primer / Assay', '已确认模板浓度或稀释', '试剂已充分解冻', '试剂已混匀并短暂离心'],
    ['Master Mix', '已核对 Master Mix 配方', '已加入余量', 'Master Mix 已混匀', 'Master Mix 已短暂离心', '已完成 Master Mix 分液'],
    ['Template', '已再次确认 Sample 排列', '已完成 Template 加样', 'NTC 已最后加入'],
    ['Plate', '已确认 A1 方向', '已确认孔板排布', '已封板', '已离心', '已检查气泡'],
    ['上机', '已确认 qPCR 程序', '已确认反应体积', '已确认 Dye / Channel', '已确认 Plate 类型', '已填写实验文件名']
  ];

  function demo() {
    return {
      version: VERSION,
      metadata: { name: 'GPR107 表达检测', operator: '', date: localDate() },
      plateType: 96, replicates: 3, reactionVolume: 10,
      samples: ['Control_1', 'Control_2', 'Control_3', 'KO_1', 'KO_2', 'KO_3'],
      genes: [
        { id: 'g1', name: 'GPR107', type: 'target' },
        { id: 'g2', name: 'ADCY3', type: 'target' },
        { id: 'g3', name: 'GAPDH', type: 'reference' }
      ],
      controls: { ntc: true, ntcReplicateMode: 'custom', ntcCustomReplicates: 3, ntcReplicates: 3, noRT: 'off', noRTSamples: [], positive: false, positiveName: '', calibratorSample: '' },
      recipe: { name: 'SYBR 10 µL（示例）', assayPremix: { enabled: false, name: 'Primer Mix', componentIds: [], wastePercent: null, minimumExtraReactions: null }, components: [
        { name: '2× SYBR Mix', volumePerReaction: 5, role: 'mastermix' },
        { name: 'Forward primer', volumePerReaction: 0.2, role: 'forward_primer' },
        { name: 'Reverse primer', volumePerReaction: 0.2, role: 'reverse_primer' },
        { name: 'Water', volumePerReaction: 2.6, role: 'water' },
        { name: 'Template', volumePerReaction: 2, role: 'template' }
      ] },
      settings: { wastePercent: 10, minimumExtra: 1, minPipetteVolume: 0.5, pipette: 'single', layoutMode: 'optimized', allocationMode: 'sequential', printOrientation: 'landscape', display: { plateZoom: 1, colorBy: 'target', paletteId: 'scientificSoft' }, reserved: [], checklist: DEFAULT_CHECKLIST.map(g => [g[0], ...g.slice(1)]) }
    };
  }

  function coordinates(type) {
    if (!ROWS[type]) throw new Error('孔板类型只能是 96 或 384 孔。');
    const out = [];
    for (let r = 0; r < ROWS[type]; r++) for (let c = 1; c <= COLS[type]; c++)
      out.push({ well: String.fromCharCode(65 + r) + c, row: String.fromCharCode(65 + r), column: c, r, c: c - 1 });
    return out;
  }

  function parseWell(text, type) {
    const m = /^([A-P])0*([1-9]\d?)$/i.exec(String(text).trim());
    if (!m) return null;
    const r = m[1].toUpperCase().charCodeAt(0) - 65;
    const c = Number(m[2]);
    return r < ROWS[type] && c <= COLS[type] ? String.fromCharCode(65 + r) + c : null;
  }

  function parseReserved(input, type) {
    const out = new Set();
    const tokens = Array.isArray(input) ? input : String(input || '').split(/[\s,，;；]+/);
    for (const raw of tokens) {
      if (!String(raw).trim()) continue;
      const pair = String(raw).trim().split(/[-–—]/);
      if (pair.length > 2) throw new Error('保留孔格式有误：' + raw + '。请使用 A1 或 H10-H12。');
      const a = parseWell(pair[0], type), b = pair[1] ? parseWell(pair[1], type) : a;
      if (!a || !b) throw new Error('保留孔超出当前孔板或格式不正确：' + raw + '。');
      const am = /^([A-P])(\d+)$/.exec(a), bm = /^([A-P])(\d+)$/.exec(b);
      let r1 = am[1].charCodeAt(0) - 65, r2 = bm[1].charCodeAt(0) - 65;
      let c1 = Number(am[2]), c2 = Number(bm[2]);
      if (r1 > r2) [r1, r2] = [r2, r1];
      if (c1 > c2) [c1, c2] = [c2, c1];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.add(String.fromCharCode(65 + r) + c);
    }
    return [...out].sort(wellCompare);
  }

  function wellCompare(a, b) {
    const am = /^([A-P])(\d+)$/.exec(a), bm = /^([A-P])(\d+)$/.exec(b);
    return am[1].localeCompare(bm[1]) || Number(am[2]) - Number(bm[2]);
  }

  function compressWells(wells) {
    const grouped = new Map();
    for (const well of [...new Set(wells)].sort(wellCompare)) {
      const m = /^([A-P])(\d+)$/.exec(well);
      if (!m) continue;
      if (!grouped.has(m[1])) grouped.set(m[1], []);
      grouped.get(m[1]).push(Number(m[2]));
    }
    const parts = [];
    for (const [row, cols] of grouped) {
      let start = cols[0], last = cols[0];
      function flush() { parts.push(row + start + (last > start ? '-' + row + last : '')); }
      for (let i = 1; i < cols.length; i++) {
        if (cols[i] === last + 1) last = cols[i];
        else { flush(); start = last = cols[i]; }
      }
      if (cols.length) flush();
    }
    return parts.join(', ');
  }

  function parseNames(text) {
    return String(text || '').split(/[\n\r\t]+/).map(x => x.trim()).filter(Boolean);
  }

  function duplicates(values) {
    const seen = new Set(), repeated = new Set();
    for (const value of values) {
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) repeated.add(value); else seen.add(key);
    }
    return [...repeated];
  }

  function round(value, places = 6) { return Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places; }
  function volume(value) {
    const v = round(value, 3);
    if (v < 1) return String(v);
    if (Number.isInteger(v)) return v.toFixed(1);
    const places = Math.abs(v * 10 - Math.round(v * 10)) < 1e-8 ? 1 : Math.abs(v * 100 - Math.round(v * 100)) < 1e-8 ? 2 : 3;
    return v.toFixed(places);
  }
  function recipeTotals(recipe) {
    const components = recipe.components || [];
    return {
      total: round(components.reduce((s, c) => s + Number(c.volumePerReaction), 0)),
      template: round(components.filter(c => c.role === 'template').reduce((s, c) => s + Number(c.volumePerReaction), 0)),
      mix: round(components.filter(c => c.role !== 'template').reduce((s, c) => s + Number(c.volumePerReaction), 0))
    };
  }

  function componentId(component, index) { return String(component.id || 'component-' + index); }
  function assayPremix(recipe) { return recipe?.assayPremix || { enabled: false, name: 'Primer Mix', componentIds: [] }; }
  function premixSelection(recipe) {
    const selected = new Set(assayPremix(recipe).componentIds || []);
    return recipe.components.map((component, index) => ({ component, id: componentId(component, index), index })).filter(x => selected.has(x.id));
  }
  function prepareCount(required, wastePercent, minimumExtra) {
    return Math.max(Math.ceil(required * (1 + Number(wastePercent) / 100) - 1e-10), required + Number(minimumExtra));
  }

  function ntcMode(controls) { return controls.ntcReplicateMode || (controls.ntcReplicates === 'same' ? 'followTechnical' : 'custom'); }
  function effectiveNtcReplicates(project) {
    const controls = project.controls || {};
    if (!controls.ntc || !qcEnabled(project)) return 0;
    return ntcMode(controls) === 'followTechnical' ? Number(project.replicates) : Number(controls.ntcCustomReplicates ?? controls.ntcReplicates);
  }

  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function qcEnabled(project) { const c = project.controls; return c.qcControlsEnabled ?? !!(c.ntc || c.positive || c.noRT && c.noRT !== 'off' || c.calibratorSample); }
  function effectiveDesign(project) { return qcEnabled(project) ? project : { ...project, controls: { ...project.controls, ntc: false, positive: false, noRT: 'off', calibratorSample: '' } }; }
  function newProject() { const p = demo(); p.controls = { ...p.controls, qcControlsEnabled: false, ntc: false, positive: false, noRT: 'off', calibratorSample: '' }; p.settings.layoutMode = NEW_PROJECT_DEFAULTS.layoutMode; p.settings.printOrientation = NEW_PROJECT_DEFAULTS.printOrientation; p.settings.display.paletteId = NEW_PROJECT_DEFAULTS.paletteId; p.settings.referenceRowPreference = 'top'; p.settings.primaryReferenceGeneId = 'g3'; return p; }
  function normalizeProject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('项目必须是对象。');
    const p = JSON.parse(JSON.stringify(input));
    if (!Array.isArray(p.samples) || p.samples.some(s => typeof s !== 'string') || !Array.isArray(p.genes) || p.genes.some(g => !g || typeof g !== 'object' || typeof g.id !== 'string' || typeof g.name !== 'string')) throw new Error('样本或 assay 数据格式错误。');
    if (p.samples.some(s => /[\r\n\t]/.test(s)) || p.genes.some(g => /[\r\n\t]/.test(g.name))) throw new Error('样本及 assay 名称不能包含换行或制表符。');
    if (p.genes.some(g => g.colorIndex !== undefined && (!Number.isInteger(g.colorIndex) || g.colorIndex < 0 || g.colorIndex > 10000))) throw new Error('assay 颜色标识无效。');
    for (const key of ['controls', 'recipe', 'settings']) if (!p[key] || typeof p[key] !== 'object' || Array.isArray(p[key])) throw new Error('项目缺少有效的 ' + key + '。');
    if (!Array.isArray(p.recipe.components) || p.recipe.components.some(c => !c || typeof c !== 'object' || typeof c.name !== 'string')) throw new Error('配方组分格式错误。');
    if (p.controls.noRTSamples !== undefined && (!Array.isArray(p.controls.noRTSamples) || p.controls.noRTSamples.some(s => typeof s !== 'string'))) throw new Error('No-RT 样本格式错误。');
    if (p.settings.checklist !== undefined && (!Array.isArray(p.settings.checklist) || p.settings.checklist.some(g => !Array.isArray(g) || !g.length || g.some(x => typeof x !== 'string')))) throw new Error('检查单格式错误。');
    p.metadata ||= {}; if (typeof p.metadata !== 'object' || Array.isArray(p.metadata)) throw new Error('实验信息格式错误。');
    p.settings.printOrientation ||= 'landscape';
    p.settings.display ||= {};
    if (typeof p.settings.display !== 'object' || Array.isArray(p.settings.display)) throw new Error('显示设置格式错误。');
    p.settings.display.plateZoom ??= 1; p.settings.display.colorBy ||= 'target'; p.settings.display.paletteId ||= 'scientificSoft';
    p.controls.ntcReplicateMode ||= ntcMode(p.controls);
    p.controls.ntcCustomReplicates ??= Number(p.controls.ntcReplicates === 'same' ? p.replicates : p.controls.ntcReplicates);
    p.controls.noRTSamples ||= []; p.controls.scope ||= 'project'; p.controls.noRTReplicates ??= 1; p.controls.positiveReplicates ??= 1;
    if (p.controls.qcControlsEnabled !== undefined && typeof p.controls.qcControlsEnabled !== 'boolean') throw new Error('QC / 对照开关必须是布尔值。');
    p.controls.qcControlsEnabled ??= qcEnabled(p);
    if (!p.controls.qcControlsEnabled) p.controls = effectiveDesign(p).controls;
    p.settings.referenceRowPreference ??= 'top';
    const references = p.genes.filter(g => g.type === 'reference');
    p.settings.primaryReferenceGeneId = references.length === 1 ? references[0].id : references.length ? p.settings.primaryReferenceGeneId || '' : '';
    p.settings.pipettePitch ||= 'adjacent';
    p.recipe.assayPremix ||= { enabled: false, name: 'Primer Mix', componentIds: [], wastePercent: null, minimumExtraReactions: null };
    function checkRecipe(recipe) {
      const mix = recipe.assayPremix;
      if (mix !== undefined && (!mix || typeof mix !== 'object' || Array.isArray(mix) || mix.componentIds !== undefined && (!Array.isArray(mix.componentIds) || mix.componentIds.some(id => typeof id !== 'string')))) throw new Error('独立 Mix 格式错误。');
      if (mix && (mix.enabled !== undefined && typeof mix.enabled !== 'boolean' || mix.name !== undefined && typeof mix.name !== 'string')) throw new Error('独立 Mix 开关或名称格式错误。');
    }
    checkRecipe(p.recipe);
    if (p.settings.disabledChecklist !== undefined && (!Array.isArray(p.settings.disabledChecklist) || p.settings.disabledChecklist.some(x => typeof x !== 'string'))) throw new Error('检查单开关格式错误。');
    if (p.settings.reserved !== undefined && typeof p.settings.reserved !== 'string' && (!Array.isArray(p.settings.reserved) || p.settings.reserved.some(x => typeof x !== 'string'))) throw new Error('保留孔格式错误。');
    for (const key of ['name','operator','date']) if (p.metadata[key] !== undefined && typeof p.metadata[key] !== 'string') throw new Error('实验信息字段必须是文字。');
    for (const key of ['ntc','positive']) if (typeof p.controls[key] !== 'boolean') throw new Error('对照开关必须是布尔值。');
    p.assayRecipes ||= {}; p.sampleMetadata ||= {};
    for (const key of ['assayRecipes', 'sampleMetadata']) if (typeof p[key] !== 'object' || Array.isArray(p[key])) throw new Error(key + ' 格式错误。');
    if (p.assaySelection != null && (!Array.isArray(p.assaySelection) || p.assaySelection.some(pair => !pair || typeof pair.sample !== 'string' || typeof pair.geneId !== 'string'))) throw new Error('检测矩阵格式错误。');
    for (const [id, override] of Object.entries(p.assayRecipes)) {
      if (!override || typeof override !== 'object' || !override.recipe || !Array.isArray(override.recipe.components) || override.recipe.components.some(c => !c || typeof c.name !== 'string')) throw new Error('assay ' + id + ' 的独立配方格式错误。');
      checkRecipe(override.recipe);
      override.recipe.assayPremix ||= { enabled: false, name: 'Primer Mix', componentIds: [], wastePercent: null, minimumExtraReactions: null };
    }
    for (const meta of Object.values(p.sampleMetadata)) {
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('样本信息格式错误。');
      for (const key of ['group','biologicalReplicate','id']) if (meta[key] !== undefined && typeof meta[key] !== 'string') throw new Error('样本信息字段必须是文字。');
      if (meta.colorIndex !== undefined && (!Number.isInteger(meta.colorIndex) || meta.colorIndex < 0 || meta.colorIndex > 10000)) throw new Error('样本颜色标识无效。');
    }
    return p;
  }
  function pairSelected(project, sample, geneId) { return project.assaySelection == null || project.assaySelection.some(pair => pair.sample === sample && pair.geneId === geneId); }
  function activeGenes(project) { if (project.assaySelection == null) return project.samples.length ? project.genes : []; const ids = new Set(project.assaySelection.map(p => p.geneId)); return project.genes.filter(g => ids.has(g.id)); }
  function assayProject(project, geneId) {
    const override = project.assayRecipes && Object.hasOwn(project.assayRecipes, geneId) ? project.assayRecipes[geneId] : null;
    return override ? { ...project, recipe: override.recipe, reactionVolume: Number(override.reactionVolume ?? project.reactionVolume), assayRecipes: {} } : project;
  }

  function validate(project, suppressTransferWarnings = false) {
    const errors = [], warnings = [];
    if (!project || typeof project !== 'object') return { errors: ['项目数据为空。'], warnings };
    try { project = normalizeProject(project); } catch (error) { return { errors: [error.message], warnings }; }
    const type = Number(project.plateType);
    if (!ROWS[type]) errors.push('请选择 96 孔或 384 孔板。');
    const samples = project.samples || [], genes = project.genes || [], settings = project.settings || {}, controls = project.controls || {};
    if (!Array.isArray(samples) || !samples.length) errors.push('请至少输入一个 Sample。');
    if (Array.isArray(samples)) {
      if (samples.some(x => !String(x).trim())) errors.push('Sample 名称不能为空。');
      const dup = duplicates(samples.map(String)); if (dup.length) errors.push('Sample 名称重复：' + dup.join('、') + '。请修改后再生成。');
    }
    if (!Array.isArray(genes) || !genes.some(g => g.type === 'target')) errors.push('请至少输入一个 Target gene；内参基因可以留空。');
    if (Array.isArray(genes)) {
      if (new Set(genes.map(g => g.id)).size !== genes.length || genes.some(g => !g.id.trim())) errors.push('assay ID 不能为空或重复。');
      if (genes.some(g => !g.name || !String(g.name).trim() || !['target', 'reference'].includes(g.type))) errors.push('基因名称或类型不完整。');
      const dup = duplicates(genes.map(g => String(g.name || ''))); if (dup.length) errors.push('基因名称重复：' + dup.join('、') + '。');
    }
    if (!Number.isInteger(Number(project.replicates)) || Number(project.replicates) < 1 || Number(project.replicates) > 24) errors.push('技术重复必须是 1–24 的整数。');
    if (!Number.isFinite(Number(project.reactionVolume)) || Number(project.reactionVolume) <= 0) errors.push('反应总体积必须大于 0 µL。');
    if (!project.recipe || !Array.isArray(project.recipe.components) || !project.recipe.components.length) errors.push('请设置至少一个反应体系组分。');
    else {
      const comps = project.recipe.components;
      if (comps.some(c => !String(c.name || '').trim() || !ROLES.includes(c.role) || !Number.isFinite(Number(c.volumePerReaction)) || Number(c.volumePerReaction) < 0)) errors.push('配方组分必须有名称、有效角色和非负体积。');
      if (!comps.some(c => c.role === 'template' && Number(c.volumePerReaction) > 0)) errors.push('配方中必须设置体积大于 0 的 Template。');
      if (comps.filter(c => c.role === 'template').length !== 1) errors.push('配方必须恰好有一个 Template 组分。');
      const totals = recipeTotals(project.recipe);
      if (Number.isFinite(totals.total) && Math.abs(totals.total - Number(project.reactionVolume)) > 0.00001) errors.push('反应体系各组分之和为 ' + volume(totals.total) + ' µL，但设置的总反应体积为 ' + volume(Number(project.reactionVolume)) + ' µL。请检查配方。');
      if (totals.mix <= 0) errors.push('Master Mix 分液体积必须大于 0 µL。');
      const threshold = Number(settings.minPipetteVolume);
      if (!Single.isMode(project) && !suppressTransferWarnings && Number.isFinite(threshold) && totals.template < threshold) warnings.push('逐孔 Template 加样 ' + volume(totals.template) + ' µL 低于可靠移液阈值 ' + volume(threshold) + ' µL。建议稀释工作液或调整体系。');
      const premix = assayPremix(project.recipe), selected = new Set(premix.enabled && Array.isArray(premix.componentIds) ? premix.componentIds : []);
      if (premix.enabled) {
        const ids = comps.map(componentId);
        if (new Set(ids).size !== ids.length) errors.push('配方组分标识重复，请重新载入配方。');
        if (!String(premix.name || '').trim()) errors.push('启用独立 Primer / Assay Mix 后请填写名称。');
        if (!Array.isArray(premix.componentIds) || !premix.componentIds.length) errors.push('请至少选择一个进入独立 Primer / Assay Mix 的组分。');
        else {
          if (selected.size !== premix.componentIds.length) errors.push('独立 Primer / Assay Mix 组分不能重复选择。');
          if (premix.componentIds.some(id => !ids.includes(id))) errors.push('独立 Primer / Assay Mix 包含不存在的配方组分，请重新选择。');
          if (premixSelection(project.recipe).some(x => ['template', 'mastermix'].includes(x.component.role))) errors.push('Template 和通用 Master Mix 不能加入独立 Primer / Assay Mix。');
          if (premixSelection(project.recipe).every(x => Number(x.component.volumePerReaction) === 0)) errors.push('独立 Primer / Assay Mix 的体积必须大于 0 µL。');
        }
        if (premix.wastePercent != null && (!Number.isFinite(Number(premix.wastePercent)) || Number(premix.wastePercent) < 0 || Number(premix.wastePercent) > 1000)) errors.push('独立 Mix 的损耗比例必须在 0–1000% 之间。');
        if (premix.minimumExtraReactions != null && (!Number.isInteger(Number(premix.minimumExtraReactions)) || Number(premix.minimumExtraReactions) < 0)) errors.push('独立 Mix 的额外反应数必须是非负整数。');
      }
      for (const [index, c] of comps.entries()) if (!Single.isMode(project) && !suppressTransferWarnings && c.role !== 'template' && !selected.has(componentId(c, index)) && Number(c.volumePerReaction) > 0 && Number(c.volumePerReaction) < threshold) warnings.push(c.name + ' 单反应体积 ' + volume(Number(c.volumePerReaction)) + ' µL 低于阈值 ' + volume(threshold) + ' µL；此组分进入批量 Master Mix，请核对配制总量，必要时使用 Primer Mix 或稀释工作液。');
    }
    if (!Number.isFinite(Number(settings.wastePercent)) || Number(settings.wastePercent) < 0 || Number(settings.wastePercent) > 1000) errors.push('损耗比例必须在 0–1000% 之间。');
    if (!Number.isInteger(Number(settings.minimumExtra)) || Number(settings.minimumExtra) < 0) errors.push('最少额外反应数必须是非负整数。');
    if (!Number.isFinite(Number(settings.minPipetteVolume)) || Number(settings.minPipetteVolume) <= 0) errors.push('最小可靠移液体积必须大于 0 µL。');
    if (!['optimized', 'gene', 'sample', Lab.MODE, Single.MODE].includes(settings.layoutMode)) errors.push('排板模式无效。');
    if (!['top','bottom'].includes(settings.referenceRowPreference)) errors.push('主内参固定位置必须是顶部或底部。');
    if ([Lab.MODE, Single.MODE].includes(settings.layoutMode)) {
      if (genes.filter(g => g.type === 'reference').length > 1 && !genes.some(g => g.type === 'reference' && g.id === settings.primaryReferenceGeneId)) errors.push('多个内参时，请明确选择主内参。');
      if (settings.layoutMode === Lab.MODE && Number(project.replicates) > 12) errors.push('实验室优先布局每个区域只有 12 列；技术重复超过 12 请使用其他布局。');
    }
    if (!['sequential', 'balanced'].includes(settings.allocationMode)) errors.push('分板模式无效。');
    if (settings.printOrientation !== undefined && !['landscape', 'portrait'].includes(settings.printOrientation)) errors.push('打印方向只能是 A4 横向或纵向。');
    if (settings.display?.plateZoom !== undefined && (![1, 1.25, 1.5].includes(Number(settings.display.plateZoom)))) errors.push('孔板缩放比例无效。');
    if (controls.ntc && !['followTechnical', 'custom'].includes(ntcMode(controls))) errors.push('NTC 重复模式无效。');
    if (controls.ntc && (!Number.isInteger(effectiveNtcReplicates(project)) || effectiveNtcReplicates(project) < 1 || effectiveNtcReplicates(project) > 24)) errors.push('NTC 重复数必须是 1–24 的整数。');
    if (controls.scope !== undefined && !['project', 'plate'].includes(controls.scope)) errors.push('对照范围无效。');
    for (const key of ['noRTReplicates', 'positiveReplicates']) if (controls[key] !== undefined && (!Number.isInteger(Number(controls[key])) || Number(controls[key]) < 1 || Number(controls[key]) > 24)) errors.push('对照重复数必须是 1–24 的整数。');
    if (settings.pipettePitch !== undefined && !['adjacent', 'alternate'].includes(settings.pipettePitch)) errors.push('多通道孔距模式无效。');
    if (project.assaySelection != null) {
      if (project.assaySelection.some(pair => !samples.includes(pair.sample) || !genes.some(g => g.id === pair.geneId))) errors.push('检测矩阵包含无效样本或 assay。');
      if (new Set(project.assaySelection.map(pair => JSON.stringify([pair.sample, pair.geneId]))).size !== project.assaySelection.length) errors.push('检测矩阵不能重复。');
      if (!activeGenes(project).some(g => g.type === 'target')) errors.push('检测矩阵至少选择一个 Target / Sample 组合。');
    }
    const baseCounts = expectedCounts(project);
    if (samples.length > 500 || genes.length > 100 || baseCounts.total > 20000) errors.push('设计超过冻结版上限：500 个样本、100 个 assay 或 20000 个反应（含对照）。请拆分项目。');
    for (const [id, override] of Object.entries(project.assayRecipes || {})) {
      if (!genes.some(g => g.id === id)) { errors.push('独立配方包含不存在的 assay。'); continue; }
      const checked = validate({ ...assayProject(project, id), assayRecipes: {}, ...(Single.isMode(project) ? { settings: { ...settings, layoutMode: 'gene' } } : {}) }, Single.isMode(project));
      errors.push(...checked.errors.map(e => genes.find(g => g.id === id).name + '：' + e));
      warnings.push(...checked.warnings.map(w => genes.find(g => g.id === id).name + '：' + w));
    }
    if (!['off', 'selected', 'all'].includes(controls.noRT)) errors.push('No-RT 设置无效。');
    if (controls.noRT === 'selected' && (!(controls.noRTSamples || []).length || controls.noRTSamples.some(s => !samples.includes(s)))) errors.push('请选择有效的 No-RT Sample。');
    if (controls.positive && !String(controls.positiveName || '').trim()) errors.push('启用 Positive control 后请填写名称。');
    if (controls.calibratorSample && !samples.includes(controls.calibratorSample)) errors.push('跨板校准样本必须是现有 Sample。');
    if (ROWS[type]) {
      try { if (parseReserved(settings.reserved || [], type).length === type) errors.push('所有孔均已保留，没有可用孔。'); }
      catch (e) { errors.push(e.message); }
    }
    if (!errors.length && Single.isMode(project)) { const single = Single.validate(project, singleAPI()); errors.push(...single.errors); warnings.push(...single.warnings); }
    return { errors, warnings };
  }

  function reactionGroups(project) {
    project = effectiveDesign(project);
    const selectedPairs = project.assaySelection == null ? null : new Set(project.assaySelection.map(p => JSON.stringify([p.sample,p.geneId])));
    const selected = (sample, geneId) => selectedPairs == null || selectedPairs.has(JSON.stringify([sample,geneId]));
    const groups = [], reps = Number(project.replicates), genes = activeGenes(project);
    const selectedNoRT = project.controls.noRT === 'all' ? project.samples : project.controls.noRT === 'selected' ? project.controls.noRTSamples : [];
    function add(type, sample, gene, count) {
      const reactions = [];
      for (let rep = 1; rep <= count; rep++) reactions.push({ id: [type, sample, gene.id, rep].join('|'), type, sample, geneId: gene.id, gene: gene.name, geneType: gene.type, replicate: rep, replicateTotal: count });
      groups.push({ type, sample, geneId: gene.id, reactions });
    }
    for (const gene of genes) {
      for (const sample of project.samples) if (selected(sample, gene.id)) add('sample', sample, gene, reps);
      for (const sample of selectedNoRT) if (selected(sample, gene.id)) add('noRT', sample, gene, Number(project.controls.noRTReplicates ?? 1));
      if (project.controls.positive) add('positive', String(project.controls.positiveName).trim(), gene, Number(project.controls.positiveReplicates ?? 1));
      if (project.controls.ntc) add('ntc', 'NTC', gene, effectiveNtcReplicates(project));
    }
    return groups;
  }

  function expectedCounts(project) {
    project = effectiveDesign(project);
    const genes = activeGenes(project), pairs = project.assaySelection;
    const selectedNoRT = project.controls.noRT === 'all' ? project.samples : project.controls.noRT === 'selected' ? project.controls.noRTSamples || [] : [];
    const noRTSet = new Set(selectedNoRT);
    const counts = { sample: (pairs == null ? project.samples.length * genes.length : pairs.length) * Number(project.replicates), ntc: project.controls.ntc ? genes.length * effectiveNtcReplicates(project) : 0, noRT: (pairs == null ? selectedNoRT.length * genes.length : pairs.filter(p => noRTSet.has(p.sample)).length) * Number(project.controls.noRTReplicates ?? 1), positive: project.controls.positive ? genes.length * Number(project.controls.positiveReplicates ?? 1) : 0, calibrator: 0 };
    counts.total = counts.sample + counts.ntc + counts.noRT + counts.positive; return counts;
  }
  function countReactions(reactions) {
    const counts = { sample: 0, ntc: 0, noRT: 0, positive: 0, calibrator: 0, total: reactions.length };
    for (const r of reactions) counts[r.type]++;
    return counts;
  }

  function groupOrder(groups, mode, genes, samples) {
    const geneIndex = new Map(genes.map((g, i) => [g.id, i]));
    const sampleIndex = new Map(samples.map((s, i) => [s, i]));
    const rank = { sample: 0, noRT: 1, positive: 2, calibrator: 3, ntc: 4 };
    return [...groups].sort((a, b) => {
      if (mode === 'sample') return rank[a.type] - rank[b.type] || (sampleIndex.get(a.sample) ?? 9999) - (sampleIndex.get(b.sample) ?? 9999) || geneIndex.get(a.geneId) - geneIndex.get(b.geneId);
      return rank[a.type] - rank[b.type] || geneIndex.get(a.geneId) - geneIndex.get(b.geneId) || (sampleIndex.get(a.sample) ?? 9999) - (sampleIndex.get(b.sample) ?? 9999);
    });
  }

  function slotOrders(type, reserved) {
    const all = coordinates(type), blocked = new Set(reserved);
    const horizontal = all.filter(x => !blocked.has(x.well));
    const vertical = [...horizontal].sort((a, b) => a.c - b.c || a.r - b.r);
    const serpentine = [...horizontal].sort((a, b) => a.r - b.r || (a.r % 2 ? b.c - a.c : a.c - b.c));
    const block = [...horizontal].sort((a, b) => Math.floor(a.r / 4) - Math.floor(b.r / 4) || Math.floor(a.c / 4) - Math.floor(b.c / 4) || a.r - b.r || a.c - b.c);
    return { horizontal, vertical, serpentine, block };
  }

  function allocate(groups, capacity, mode) {
    const result = [[]], sizes = [0];
    if (mode === 'balanced') {
      const total = groups.reduce((s, g) => s + g.reactions.length, 0);
      const count = Math.max(1, Math.ceil(total / capacity));
      while (result.length < count) { result.push([]); sizes.push(0); }
      for (const group of groups) {
        let remaining = [...group.reactions];
        while (remaining.length) {
          let best = -1;
          for (let p = 0; p < result.length; p++) if (sizes[p] + remaining.length <= capacity && (best < 0 || sizes[p] < sizes[best])) best = p;
          if (best < 0) for (let p = 0; p < result.length; p++) if (sizes[p] < capacity && (best < 0 || sizes[p] < sizes[best])) best = p;
          if (best < 0) { result.push([]); sizes.push(0); best = result.length - 1; }
          const chunk = remaining.splice(0, capacity - sizes[best]);
          result[best].push(...chunk); sizes[best] += chunk.length;
        }
      }
      return result;
    }
    for (const group of groups) {
      let remaining = [...group.reactions];
      while (remaining.length) {
        let p = result.length - 1;
        if (sizes[p] && group.reactions.length <= capacity && sizes[p] + remaining.length > capacity) { result.push([]); sizes.push(0); p++; }
        const chunk = remaining.splice(0, capacity - sizes[p]);
        result[p].push(...chunk); sizes[p] += chunk.length;
        if (remaining.length) { result.push([]); sizes.push(0); }
      }
    }
    return result;
  }

  function layoutScore(wells, pipette, mode, type = 96, pitch = 'adjacent') {
    const byGene = new Map(), bySample = new Map(), byRep = new Map();
    for (const item of wells) {
      if (!byGene.has(item.geneId)) byGene.set(item.geneId, []);
      byGene.get(item.geneId).push(item);
      const sKey = item.type + '|' + item.sample;
      if (!bySample.has(sKey)) bySample.set(sKey, []);
      bySample.get(sKey).push(item);
      const rKey = sKey + '|' + item.geneId;
      if (!byRep.has(rKey)) byRep.set(rKey, []);
      byRep.get(rKey).push(item);
    }
    function quality(items) {
      if (items.length < 2) return 0;
      let adjacent = 0, minR = 99, maxR = 0, minC = 99, maxC = 0;
      const set = new Set(items.map(x => x.r + ',' + x.c));
      for (const x of items) {
        minR = Math.min(minR, x.r); maxR = Math.max(maxR, x.r); minC = Math.min(minC, x.c); maxC = Math.max(maxC, x.c);
        if (set.has((x.r + 1) + ',' + x.c)) adjacent++;
        if (set.has(x.r + ',' + (x.c + 1))) adjacent++;
      }
      return adjacent * 2 - ((maxR - minR + 1) * (maxC - minC + 1) - items.length) * 0.13;
    }
    let score = 0;
    for (const items of byGene.values()) score += quality(items) * (mode === 'gene' ? 8 : mode === 'sample' ? 1 : 4);
    for (const items of bySample.values()) score += quality(items) * (mode === 'sample' ? 8 : mode === 'gene' ? 1 : 4);
    for (const items of byRep.values()) score += quality(items) * 12;
    const channels = Number(pipette);
    if ([8, 12, 16, 24].includes(channels)) {
      const byColumnGene = new Map(), byRowGene = new Map();
      for (const x of wells) {
        const a = x.c + '|' + x.geneId, b = x.r + '|' + x.geneId;
        byColumnGene.set(a, (byColumnGene.get(a) || 0) + 1);
        byRowGene.set(b, (byRowGene.get(b) || 0) + 1);
      }
      for (const items of byGene.values()) score += pipettingBatches(items.map(x => x.well), type, pipette, pitch).filter(b => b.multichannel).length * 5;
    }
    return round(score, 3);
  }

  function chooseLayout(reactions, type, reserved, settings, genes, samples) {
    const orders = slotOrders(type, reserved);
    const sequences = settings.layoutMode === 'optimized' ? ['gene', 'sample'] : [settings.layoutMode];
    const candidates = ['horizontal', 'vertical', 'serpentine', 'block'];
    let best = null;
    for (const sequence of sequences) {
      const sorted = groupOrder(reactions.map(r => ({ type: r.type, sample: r.sample, geneId: r.geneId, reactions: [r] })), sequence, genes, samples).flatMap(g => g.reactions);
      for (const name of candidates) {
        const placed = sorted.map((reaction, i) => ({ ...reaction, ...orders[name][i], well: orders[name][i].well }));
        const score = layoutScore(placed, settings.pipette, settings.layoutMode, type, settings.pipettePitch);
        if (!best || score > best.score) best = { name, sequence, score, wells: placed };
      }
    }
    return best;
  }

  function mixFor(reactions, project) {
    const byGene = new Map(project.genes.map(g => [g.id, { gene: g, required: 0, wells: [], components: [], prepare: 0 }]));
    for (const r of reactions) { const mix = byGene.get(r.geneId); mix.required++; mix.wells.push(r.well); }
    for (const mix of byGene.values()) {
      const configured = assayProject(project, mix.gene.id);
      mix.prepare = prepareCount(mix.required, project.settings.wastePercent, project.settings.minimumExtra);
      mix.totals = recipeTotals(configured.recipe); mix.reactionVolume = Number(configured.reactionVolume);
      const premix = assayPremix(configured.recipe), selected = new Set(premix.enabled ? premix.componentIds : []);
      const displayName = c => ['forward_primer', 'reverse_primer', 'probe'].includes(c.role) ? mix.gene.name + ' ' + c.name : c.name;
      mix.components = configured.recipe.components.flatMap((c, index) => c.role === 'template' || selected.has(componentId(c, index)) ? [] : [{ id: componentId(c, index), name: c.name, role: c.role, perReaction: Number(c.volumePerReaction), total: round(Number(c.volumePerReaction) * mix.prepare), displayName: displayName(c) }]);
      if (premix.enabled) {
        const selectedComponents = premixSelection(configured.recipe);
        const perReaction = round(selectedComponents.reduce((sum, x) => sum + Number(x.component.volumePerReaction), 0));
        const waste = premix.wastePercent == null ? project.settings.wastePercent : premix.wastePercent;
        const extra = premix.minimumExtraReactions == null ? project.settings.minimumExtra : premix.minimumExtraReactions;
        const prepare = prepareCount(mix.prepare, waste, extra);
        mix.premix = {
          name: premix.name, required: mix.prepare, prepare, perReaction,
          transferTotal: round(perReaction * mix.prepare),
          components: selectedComponents.map(x => ({ id: x.id, name: x.component.name, role: x.component.role, displayName: displayName(x.component), perReaction: Number(x.component.volumePerReaction), total: round(Number(x.component.volumePerReaction) * prepare) })),
          total: round(perReaction * prepare)
        };
        mix.components.push({ id: 'assay-premix', name: premix.name, role: 'assay_premix', displayName: mix.gene.name + ' ' + premix.name, perReaction, total: mix.premix.transferTotal });
      }
      mix.total = round(mix.components.reduce((s, c) => s + c.total, 0));
      mix.wellRange = compressWells(mix.wells);
    }
    return [...byGene.values()].filter(x => x.required > 0);
  }

  function assertInvariant(project, plates, expected) {
    const ids = new Set(), all = [], reserved = new Set(parseReserved(project.settings.reserved, Number(project.plateType)));
    for (const plate of plates) {
      const seen = new Set();
      for (const r of plate.wells) {
        if (!parseWell(r.well, project.plateType)) throw new Error('孔位超出孔板。');
        if (ids.has(r.id)) throw new Error('反应重复分配：' + r.id);
        if (seen.has(r.well)) throw new Error('孔位重复分配：Plate ' + plate.number + ' ' + r.well);
        if (reserved.has(r.well)) throw new Error('反应进入保留孔：Plate ' + plate.number + ' ' + r.well);
        ids.add(r.id); seen.add(r.well); all.push(r);
      }
      if (plate.wells.length > plate.capacity) throw new Error('孔板容量超出。');
      if (plate.mixes.reduce((s, m) => s + m.required, 0) !== plate.wells.length) throw new Error('Master Mix 与孔位数不一致。');
      for (const mix of plate.mixes) {
        const configured = assayProject(project, mix.gene.id);
        if (mix.required !== plate.wells.filter(r => r.geneId === mix.gene.id).length) throw new Error('基因 Master Mix 反应数不一致。');
        if (Math.abs(mix.total - recipeTotals(configured.recipe).mix * mix.prepare) > 0.00001) throw new Error('最终 Master Mix 总体积与原配方不一致。');
        const original = configured.recipe.components.filter(c => c.role !== 'template');
        const premix = assayPremix(configured.recipe);
        if (premix.enabled) {
          if (!mix.premix || mix.premix.required !== mix.prepare || mix.premix.prepare < mix.premix.required) throw new Error('独立 Mix 配制数不足。');
          const selected = new Set(premix.componentIds);
          const directIds = mix.components.filter(c => c.role !== 'assay_premix').map(c => c.id);
          if (directIds.some(id => selected.has(id))) throw new Error('组分重复进入最终 Mix。');
          const transfer = mix.components.filter(c => c.role === 'assay_premix');
          if (transfer.length !== 1 || Math.abs(transfer[0].perReaction - mix.premix.perReaction) > 0.00001 || Math.abs(transfer[0].total - mix.premix.transferTotal) > 0.00001) throw new Error('独立 Mix 转移项不一致。');
          for (const [index, c] of configured.recipe.components.entries()) {
            if (c.role === 'template') continue;
            const id = componentId(c, index), final = mix.components.find(x => x.id === id), inside = mix.premix.components.find(x => x.id === id);
            if (Number(!!final) + Number(!!inside) !== 1 || Math.abs((final || inside).perReaction - Number(c.volumePerReaction)) > 0.00001) throw new Error('配方组分守恒失败：' + c.name);
          }
          if (Math.abs(mix.premix.perReaction - mix.premix.components.reduce((sum, c) => sum + c.perReaction, 0)) > 0.00001) throw new Error('独立 Mix 每反应体积不一致。');
          if (Math.abs(mix.premix.transferTotal - mix.premix.perReaction * mix.prepare) > 0.00001) throw new Error('独立 Mix 转移体积不一致。');
          if (mix.premix.components.some(c => Math.abs(c.total - c.perReaction * mix.premix.prepare) > 0.00001)) throw new Error('独立 Mix 组分总量不一致。');
        } else if (mix.components.length !== original.length) throw new Error('直接 Master Mix 组分数不一致。');
      }
    }
    if (all.length !== expected.total) throw new Error('反应总数不一致：预期 ' + expected.total + '，实际 ' + all.length);
    for (const key of ['sample', 'ntc', 'noRT', 'positive', 'calibrator']) if (all.filter(r => r.type === key).length !== expected[key]) throw new Error(key + ' 对照数量不一致。');
    return true;
  }

  function plateAdditions(project, base, index) {
    const genes = activeGenes(project), calibrator = project.controls.calibratorSample, perPlate = project.controls.scope === 'plate';
      const out = [];
      if (calibrator && index > 0) for (const gene of genes) out.push({ id: ['calibrator', calibrator, gene.id, index + 1].join('|'), type: 'calibrator', sample: calibrator, geneId: gene.id, gene: gene.name, geneType: gene.type, replicate: 1, replicateTotal: 1 });
      if (!perPlate) return out;
      const local = new Set([...base, ...out].map(r => r.geneId));
      const selected = project.controls.noRT === 'all' ? project.samples : project.controls.noRT === 'selected' ? project.controls.noRTSamples : [];
      function add(type, sample, gene, count) { for (let rep = 1; rep <= count; rep++) out.push({ id: [type, sample, gene.id, rep, 'plate' + (index + 1)].join('|'), type, sample, geneId: gene.id, gene: gene.name, geneType: gene.type, replicate: rep, replicateTotal: count }); }
      for (const gene of genes.filter(g => local.has(g.id))) {
        if (project.controls.ntc) add('ntc', 'NTC', gene, effectiveNtcReplicates(project));
        if (project.controls.positive) add('positive', project.controls.positiveName, gene, Number(project.controls.positiveReplicates ?? 1));
        for (const sample of selected) if (base.some(r => r.type === 'sample' && r.sample === sample && r.geneId === gene.id)) add('noRT', sample, gene, Number(project.controls.noRTReplicates ?? 1));
      }
      return out;
    }
  function labPlan(project, reserved) {
    const groups = reactionGroups(project), sample = project.controls.calibratorSample;
    const firstCalibrationGroups = sample ? activeGenes(project).map(gene => groups.find(g => g.type === 'sample' && g.sample === sample && g.geneId === gene.id) || { type: 'calibrator', sample, geneId: gene.id, reactions: [{ id: ['calibrator',sample,gene.id,1].join('|'), type:'calibrator', sample, geneId:gene.id, gene:gene.name, geneType:gene.type, replicate:1, replicateTotal:1 }] }) : [];
    const packed = (Single.isMode(project) ? Single.generateLayout : Lab.generateLabPriorityLayout)(project, { groups, reserved, firstCalibrationGroups, controlsForPlate: (base,index) => plateAdditions(project,base,index) });
    if (packed.reduce((n,p)=>n+p.wells.length,0)>20000) throw new Error('逐板对照和校准使反应总数超过 20000，请拆分项目。');
    return packed;
  }
  function plannedAllocation(project, reserved) {
    const capacity = Number(project.plateType) - reserved.length;
    const allGroups = reactionGroups(project);
    const ordered = groupOrder(allGroups, project.settings.layoutMode === 'sample' ? 'sample' : 'gene', project.genes, project.samples);
    const genes = activeGenes(project), calibrator = project.controls.calibratorSample, perPlate = project.controls.scope === 'plate';
    if (!calibrator && !perPlate) return allocate(ordered, capacity, project.settings.allocationMode);
    const groups = ordered.filter(g => !perPlate || g.type === 'sample').map(g => ({ ...g, reactions: [...g.reactions] }));
    const pins = [];
    if (calibrator) for (const gene of genes) {
      const group = groups.find(g => g.type === 'sample' && g.sample === calibrator && g.geneId === gene.id);
      if (group?.reactions.length) pins.push(group.reactions.shift());
      else pins.push({ id: ['calibrator', calibrator, gene.id, 1].join('|'), type: 'calibrator', sample: calibrator, geneId: gene.id, gene: gene.name, geneType: gene.type, replicate: 1, replicateTotal: 1 });
    }
    const additions = (base, index) => plateAdditions(project, base, index);
    const fit = (base, index) => base.length + additions(base, index).length <= capacity;
    const plates = [pins];
    if (!fit(pins, 0)) throw new Error('首板校准及对照已超出可用孔容量。');
    for (const group of groups) {
      let remaining = group.reactions;
      while (remaining.length) {
        let index = plates.length - 1;
        if (project.settings.allocationMode === 'balanced') {
          const candidates = plates.map((base, i) => ({ base, i })).filter(x => fit([...x.base, ...remaining], x.i)).sort((a, b) => a.base.length - b.base.length);
          if (candidates.length) index = candidates[0].i;
        }
        if (!fit([...plates[index], ...remaining], index)) {
          const next = plates.length;
          if (fit(remaining, next)) { plates.push([]); index = next; }
        }
        let taken = 0;
        while (taken < remaining.length && fit([...plates[index], ...remaining.slice(0, taken + 1)], index)) taken++;
        if (!taken) {
          if (!fit([remaining[0]], plates.length)) throw new Error('一项反应及其逐板对照无法放入孔板，请减少保留孔或对照重复。');
          plates.push([]); continue;
        }
        plates[index].push(...remaining.slice(0, taken)); remaining = remaining.slice(taken);
      }
    }
    let assigned = plates.filter(p => p.length);
    if (project.settings.allocationMode === 'balanced' && assigned.length > 1) {
      const balanced = Array.from({ length: assigned.length }, (_, i) => i === 0 ? [...pins] : []);
      let possible = true;
      for (const group of groups) {
        let remaining = [...group.reactions];
        while (remaining.length) {
          const candidates = balanced.map((base, i) => ({ base, i, load: base.length + additions(base, i).length })).sort((a, b) => a.load - b.load);
          const whole = candidates.find(x => fit([...x.base, ...remaining], x.i));
          const dest = whole || candidates.find(x => fit([...x.base, remaining[0]], x.i));
          if (!dest) { possible = false; break; }
          let take = whole ? remaining.length : 1;
          if (!whole) while (take < remaining.length && fit([...dest.base, ...remaining.slice(0, take + 1)], dest.i)) take++;
          dest.base.push(...remaining.splice(0, take));
        }
        if (!possible) break;
      }
      if (possible && balanced.every(base => base.length)) assigned = balanced;
    }
    const result = assigned.map((base, index) => [...base, ...additions(base, index)]);
    if (result.reduce((sum, p) => sum + p.length, 0) > 20000) throw new Error('逐板对照和校准使反应总数超过 20000，请拆分项目。');
    return result;
  }
  function capacityPlan(project) {
    const checked = validate(project); if (checked.errors.length) return { ok: false, ...checked };
    project = normalizeProject(project);
    try {
      const reserved = parseReserved(project.settings.reserved || [], project.plateType);
      const packed = [Lab.MODE, Single.MODE].includes(project.settings.layoutMode) ? labPlan(project,reserved) : null;
      const allocation = packed ? packed.map(p => p.wells) : plannedAllocation(project,reserved);
      return { ok:true, expected:countReactions(allocation.flat()), plateCount:allocation.length, loads:allocation.map(p=>p.length), capacity:project.plateType-reserved.length, layoutMetadata:packed?.map(p=>p.layoutMetadata) };
    }
    catch (error) { return { ok: false, errors: [error.message], warnings: checked.warnings }; }
  }
  function generate(project) {
    const validation = validate(project);
    if (validation.errors.length) return { ok: false, ...validation };
    project = normalizeProject(project);
    const type = Number(project.plateType), reserved = parseReserved(project.settings.reserved, type), capacity = type - reserved.length;
    if (capacity < 1) return { ok: false, errors: ['保留孔已占满孔板。'], warnings: validation.warnings };
    let allocation, packed; try { packed = [Lab.MODE, Single.MODE].includes(project.settings.layoutMode) ? labPlan(project,reserved) : null; allocation = packed ? packed.map(p=>p.wells) : plannedAllocation(project, reserved); } catch (error) { return { ok: false, errors: [error.message], warnings: validation.warnings }; }
    const expected = countReactions(allocation.flat());
    if (expected.total > 20000) return { ok: false, errors: ['逐板对照和校准使反应总数超过 20000，请拆分项目。'], warnings: validation.warnings };
    if (!expected.total) return { ok: false, errors: ['当前设计没有任何反应。'], warnings: validation.warnings };
    const plates = allocation.map((reactions, i) => {
      const chosen = packed ? packed[i] : chooseLayout(reactions, type, reserved, project.settings, project.genes, project.samples);
      return { ...chosen, number: i + 1, capacity, wells: chosen.wells, layout: chosen.name || chosen.layout, sequence: chosen.sequence, score: chosen.score, mixes: mixFor(chosen.wells, project) };
    });
    try { assertInvariant(project, plates, expected); }
    catch (error) { console.error('qPCR invariant failure', error, { project, plates, expected }); return { ok: false, errors: ['内部一致性检查失败，请重新生成。'], warnings: validation.warnings }; }
    const warnings = [...validation.warnings], infos = [];
    for (const plate of plates) for (const mix of plate.mixes) if (!Single.isMode(project) && mix.premix) for (const c of mix.premix.components) {
      const threshold = Number(project.settings.minPipetteVolume);
      if (c.total > 0 && c.total < threshold) warnings.push('Plate ' + plate.number + ' 配制 ' + mix.gene.name + ' ' + mix.premix.name + ' 时，' + c.displayName + ' 总吸取体积仅 ' + volume(c.total) + ' µL，低于可靠移液阈值 ' + volume(threshold) + ' µL；建议调整工作液浓度或配制更大体积。');
      else if (c.perReaction > 0 && c.perReaction < threshold) infos.push('Plate ' + plate.number + ' · ' + mix.gene.name + ' ' + c.name + ' 已通过独立 Mix 批量配制，实际吸取 ' + volume(c.total) + ' µL。');
    }
    const result = { ok: true, plates, expected, capacity, reserved, warnings, infos, totals: recipeTotals(project.recipe) };
    if (Single.isMode(project)) {
      const plan = attachSingleChannel(project, plates); if (!plan.ok) return { ok: false, errors: plan.errors, warnings: [...warnings, ...plan.warnings] };
      result.singleChannelPlan = plan; result.warnings = [...new Set([...warnings, ...plan.warnings])];
    }
    return result;
  }

  function singleAPI() { return { activeGenes, assayProject, recipeTotals, premixSelection, prepareCount, compressWells, reactionGroups, plateAdditions, parseReserved, parseWell }; }
  function generateSingleChannelPipettingPlan(project, plates) { return Single.plan(normalizeProject(project), plates, singleAPI()); }
  function attachSingleChannel(project, plates) {
    const plan = generateSingleChannelPipettingPlan(project, plates);
    if (plan.ok) for (const plate of plates) { plate.singleChannelSteps = plan.steps.filter(s => s.plateId === plate.number).map((s, i) => ({ ...s, index: i + 1 })); plate.singleChannelDesignKey = Single.designKey(normalizeProject(project)); plate.singleChannelAssignmentKey = Single.assignmentKey(plate); plate.singleChannelFingerprint = plan.fingerprint; }
    return plan;
  }

  function pipettingBatches(wells, type, pipette, pitch = 'adjacent') {
    const channels = Number(pipette), vertical = [8, 16].includes(channels), horizontal = [12, 24].includes(channels);
    if (!vertical && !horizontal) return [{ wells: [...wells], channels: 1, multichannel: false }];
    const stride = Number(type) === 384 && pitch === 'alternate' && [8, 12].includes(channels) ? 2 : 1;
    const pending = new Set(wells), batches = [];
    for (const point of coordinates(type)) {
      const batch = Array.from({ length: channels }, (_, i) => ({ r: point.r + (vertical ? i * stride : 0), c: point.c + (horizontal ? i * stride : 0) }));
      if (batch.some(p => p.r >= ROWS[type] || p.c >= COLS[type])) continue;
      const ids = batch.map(p => String.fromCharCode(65 + p.r) + (p.c + 1));
      if (ids.every(id => pending.has(id))) { batches.push({ wells: ids, channels, multichannel: true }); ids.forEach(id => pending.delete(id)); }
    }
    if (pending.size) batches.push({ wells: [...pending], channels: 1, multichannel: false });
    return batches;
  }
  function stepsFor(plate, project) {
    if (Single.isMode(project)) {
      if (!plate.singleChannelSteps || plate.singleChannelDesignKey !== Single.designKey(normalizeProject(project)) || plate.singleChannelAssignmentKey !== Single.assignmentKey(plate)) throw Error('单通道操作清单已失效，请重新生成或恢复项目。');
      return plate.singleChannelSteps;
    }
    const totals = recipeTotals(project.recipe), steps = [];
    if (plate.mixes.some(m => m.premix)) {
      for (const mix of plate.mixes.filter(m => m.premix)) steps.push({ kind: 'prepare-premix', title: '配制 ' + mix.gene.name + ' ' + mix.premix.name, perWell: mix.premix.perReaction, wells: [], total: mix.premix.total, prepare: mix.premix.prepare, components: mix.premix.components, note: '独立配制该 assay 的引物、探针及所选组分；配制量已包含余量。' });
      for (const mix of plate.mixes) steps.push({ kind: 'prepare-final', title: '配制 ' + mix.gene.name + ' Final Master Mix', perWell: mix.totals?.mix ?? totals.mix, wells: [], total: mix.total, prepare: mix.prepare, components: mix.components, note: mix.premix ? '加入前一步的独立 Mix；不要再单独加入已预混的组分。' : '按该 assay 的配方配制。' });
    }
    function dispense(kind, title, wells, perWell, note) {
      const batches = pipettingBatches(wells, project.plateType, project.settings.pipette, project.settings.pipettePitch);
      for (const [i, batch] of batches.entries()) if (batch.wells.length) steps.push({ kind, title: title + (batches.length > 1 || batch.multichannel ? ` · 第 ${i + 1} 批（${batch.multichannel ? batch.channels + ' 通道' : '单通道补加'}）` : ''), perWell, wells: batch.wells, total: round(perWell * batch.wells.length), channels: batch.channels, note: note + (batch.multichannel ? ' 本批按已确认孔距操作；一次加样覆盖列出的孔位。' : '') });
    }
    for (const mix of plate.mixes) dispense('mix', '加入 ' + mix.gene.name + ' Master Mix', mix.wells, mix.totals?.mix ?? totals.mix, '先核对该基因对应的引物或探针。');
    function templateSteps(kind, title, reactions, note) {
      const volumes = new Map();
      for (const r of reactions) { const perWell = recipeTotals(assayProject(project, r.geneId).recipe).template; if (!volumes.has(perWell)) volumes.set(perWell, []); volumes.get(perWell).push(r.well); }
      for (const [perWell, wells] of volumes) dispense(kind, title + (volumes.size > 1 ? ' · ' + volume(perWell) + ' µL / 孔' : ''), wells, perWell, note);
    }
    for (const sample of project.samples) {
      const wells = plate.wells.filter(r => r.type === 'sample' && r.sample === sample).map(r => r.well);
      if (wells.length) templateSteps('sample', '加入 Sample：' + sample, plate.wells.filter(r => r.type === 'sample' && r.sample === sample), '逐孔核对样本编号。');
    }
    for (const sample of project.samples) {
      const wells = plate.wells.filter(r => r.type === 'noRT' && r.sample === sample).map(r => r.well);
      if (wells.length) templateSteps('noRT', '加入 No-RT：' + sample, plate.wells.filter(r => r.type === 'noRT' && r.sample === sample), '请确认对应 Sample 的 No-RT 对照材料。');
    }
    for (const [kind, title] of [['positive', '加入 Positive control'], ['calibrator', '加入跨板校准样本']]) {
      const wells = plate.wells.filter(r => r.type === kind).map(r => r.well);
      if (wells.length) templateSteps(kind, title, plate.wells.filter(r => r.type === kind), '按实验室 SOP 核对对照材料。');
    }
    const ntc = plate.wells.filter(r => r.type === 'ntc').map(r => r.well);
    if (ntc.length) templateSteps('ntc', '最后加入 NTC 无模板对照', plate.wells.filter(r => r.type === 'ntc'), '以无核酸酶水替代 Template。');
    for (const title of ['封板', '短暂离心', '检查气泡与孔位', '上机前复核程序和通道']) steps.push({ kind: 'check', title, perWell: 0, wells: [], total: 0, note: '请以本实验室 SOP 和所用试剂说明书为准。' });
    return steps.map((s, i) => ({ ...s, index: i + 1, range: compressWells(s.wells) }));
  }

  function csv(plates, project) {
    const header = ['Plate', 'Well', 'Row', 'Column', 'Sample', 'SampleCode', 'Target', 'TargetCode', 'GeneType', 'ReactionType', 'TechnicalReplicate', 'ReactionId', 'SampleId', 'AssayId', 'Group', 'BiologicalReplicate', 'ReactionVolume_uL'];
    const sampleCodes = new Map(project.samples.map((s, i) => [s, 'S' + String(i + 1).padStart(2, '0')]));
    const geneCodes = new Map(project.genes.map((g, i) => [g.id, 'T' + String(i + 1).padStart(2, '0')]));
    const q = v => {
      const raw = String(v ?? '');
      const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const rows = [header];
    for (const plate of plates) for (const r of [...plate.wells].sort((a, b) => wellCompare(a.well, b.well))) rows.push(['Plate' + plate.number, r.well, r.row, r.column, r.sample, sampleCodes.get(r.sample) || '', r.gene, geneCodes.get(r.geneId) || '', r.geneType, r.type, r.replicate, r.id, project.sampleMetadata?.[r.sample]?.id || '', r.geneId, project.sampleMetadata?.[r.sample]?.group || '', project.sampleMetadata?.[r.sample]?.biologicalReplicate || '', assayProject(project,r.geneId).reactionVolume]);
    return '\ufeff' + rows.map(row => row.map(q).join(',')).join('\r\n') + '\r\n';
  }

  function reagentSummary(plates, project) {
    if (Single.isMode(project)) { const plan = generateSingleChannelPipettingPlan(project, plates); if (!plan.ok) throw Error(plan.errors.join('；')); return Single.summary(plan); }
    const rows = new Map(), transfers = [];
    function add(c, required, gene) {
      const key = JSON.stringify([c.role, c.displayName, ['forward_primer', 'reverse_primer', 'probe'].includes(c.role) ? gene.id : '']);
      if (!rows.has(key)) rows.set(key, { name: c.displayName, role: c.role, prepared: 0, reactionUse: 0 });
      const row = rows.get(key); row.prepared = round(row.prepared + c.total); row.reactionUse = round(row.reactionUse + c.perReaction * required);
    }
    for (const plate of plates) for (const mix of plate.mixes) {
      for (const c of mix.components.filter(c => c.role !== 'assay_premix')) add(c, mix.required, mix.gene);
      if (mix.premix) {
        for (const c of mix.premix.components) add(c, mix.required, mix.gene);
        transfers.push({ plate: plate.number, assay: mix.gene.name, name: mix.premix.name, prepared: mix.premix.total, transfer: mix.premix.transferTotal });
      }
      for (const c of assayProject(project, mix.gene.id).recipe.components.filter(c => c.role === 'template')) {
        for (const type of ['sample', 'ntc', 'noRT', 'positive', 'calibrator']) {
          const required = plate.wells.filter(r => r.geneId === mix.gene.id && r.type === type).length;
          if (required) add({ role: 'template', displayName: type === 'ntc' ? 'NTC 水（替代模板）' : type === 'noRT' ? 'No-RT 材料' : type === 'positive' ? project.controls.positiveName || '阳性模板' : type === 'calibrator' ? '跨板校准模板' : c.name, perReaction: c.volumePerReaction, total: round(c.volumePerReaction * required) }, required, mix.gene);
        }
      }
    }
    return { ingredients: [...rows.values()].map(row => ({ ...row, extra: round(row.prepared - row.reactionUse) })), transfers };
  }
  function saveObject(project, result, execution = null) { return { version: VERSION, appVersion: APP_VERSION, layoutVersion: LAYOUT_VERSION, savedAt: new Date().toISOString(), project: JSON.parse(JSON.stringify(project)), execution: execution ? JSON.parse(JSON.stringify(execution)) : null, plateLayout: result && result.ok ? result.plates.map(p => ({ number: p.number, wells: p.wells.map(r => ({ well: r.well, reactionId: r.id, ...(r.placementKind ? {placementKind:r.placementKind} : {}) })) })) : [] }; }
  function loadObject(value) {
    if (!value || typeof value !== 'object' || value.version !== VERSION || !value.project || !Array.isArray(value.plateLayout)) throw new Error('项目文件格式或版本不受支持，请选择本工具导出的 v1 JSON。');
    const p = normalizeProject(value.project);
    const checked = validate(p); if (checked.errors.length) throw new Error(checked.errors.join(' '));
    return p;
  }
  function restoreObject(value) {
    const project = loadObject(value), generated = generate(project);
    if (!generated.ok) throw new Error(generated.errors.join(' '));
    if (!value.plateLayout.length) return { project, result: generated, execution: null, restored: false };
    const reactions = new Map(generated.plates.flatMap(p => p.wells).map(r => [r.id, r]));
    const coordinatesByWell = new Map(coordinates(project.plateType).map(c => [c.well,c]));
    const allIds = new Set();
    const plates = value.plateLayout.map((saved, index) => {
      if (!saved || saved.number !== index + 1 || !Array.isArray(saved.wells) || !saved.wells.length) throw new Error('保存的孔板结构错误。');
      const wells = saved.wells.map(entry => {
        if (!entry || !reactions.has(entry.reactionId) || allIds.has(entry.reactionId) || !parseWell(entry.well, project.plateType)) throw new Error('保存的孔位映射无效，请检查项目文件。');
        if ([Lab.MODE, Single.MODE].includes(project.settings.layoutMode) && entry.placementKind && !['standard','compact','strip','control'].includes(entry.placementKind)) throw new Error('保存的布局区域类型无效。');
        allIds.add(entry.reactionId); const coord = coordinatesByWell.get(parseWell(entry.well, project.plateType));
        return { ...reactions.get(entry.reactionId), ...coord, ...([Lab.MODE, Single.MODE].includes(project.settings.layoutMode) ? { placementKind: entry.placementKind || 'strip' } : {}) };
      });
      return { ...([Lab.MODE, Single.MODE].includes(project.settings.layoutMode) ? {layoutMetadata:(Single.isMode(project)?Single:Lab).metadata(project,wells)} : {}), number: saved.number, capacity: generated.capacity, layout: 'saved', sequence: project.settings.layoutMode === 'sample' ? 'sample' : 'gene', score: 0, wells, mixes: mixFor(wells, project) };
    });
    if (allIds.size !== reactions.size) throw new Error('保存的孔位映射缺少反应；不会自动替换为新排板。');
    assertInvariant(project, plates, generated.expected);
    if ([Lab.MODE, Single.MODE].includes(project.settings.layoutMode)) (Single.isMode(project)?Single:Lab).assertLayout(project,plates);
    if (project.controls.scope === 'plate') for (const plate of plates) {
      if (plate.wells.some(r => ['ntc','noRT','positive'].includes(r.type) && !r.id.endsWith('|plate' + plate.number))) throw new Error('逐板对照被移动到了另一块孔板。');
      for (const gene of activeGenes(project).filter(g => plate.wells.some(r => r.geneId === g.id))) {
        const count = type => plate.wells.filter(r => r.geneId === gene.id && r.type === type).length;
        if (project.controls.ntc && count('ntc') !== effectiveNtcReplicates(project) || project.controls.positive && count('positive') !== project.controls.positiveReplicates) throw new Error('逐板对照覆盖不完整。');
        const noRT = project.controls.noRT === 'all' ? project.samples : project.controls.noRT === 'selected' ? project.controls.noRTSamples : [];
        for (const sample of noRT) if (plate.wells.some(r => r.type === 'sample' && r.sample === sample && r.geneId === gene.id) && plate.wells.filter(r => r.type === 'noRT' && r.sample === sample && r.geneId === gene.id).length !== project.controls.noRTReplicates) throw new Error('逐板 No-RT 覆盖不完整。');
      }
    }
    if (project.controls.calibratorSample) for (const plate of plates) for (const gene of activeGenes(project)) if (!plate.wells.some(r => r.sample === project.controls.calibratorSample && r.geneId === gene.id && ['sample', 'calibrator'].includes(r.type))) throw new Error('旧排板的跨板校准覆盖不完整，请明确重新排板。');
    const singlePlan = Single.isMode(project) ? attachSingleChannel(project, plates) : null;
    if (singlePlan && !singlePlan.ok) throw Error(singlePlan.errors.join('；'));
    return { project, result: { ...generated, plates, ...(singlePlan ? { singleChannelPlan: singlePlan } : {}) }, execution: value.execution || null, restored: true };
  }

  return { VERSION, APP_VERSION, LAYOUT_VERSION, NEW_PROJECT_DEFAULTS, ROWS, COLS, DEFAULT_CHECKLIST, demo, newProject, qcEnabled, localDate, normalizeProject, pairSelected, activeGenes, assayProject, coordinates, parseWell, parseReserved, compressWells, parseNames, duplicates, round, volume, recipeTotals, prepareCount, premixSelection, generateSingleChannelPipettingPlan, validate, reactionGroups, expectedCounts, effectiveNtcReplicates, capacityPlan, generate, assertInvariant, stepsFor, pipettingBatches, reagentSummary, csv, saveObject, loadObject, restoreObject };
});
