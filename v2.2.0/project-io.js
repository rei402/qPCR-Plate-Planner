(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRProjectIO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function parseTable(text) {
    const source = String(text).replace(/^\ufeff/, ''), delimiter = source.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < source.length; i++) {
      const c = source[i];
      if (c === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (!quoted && c === delimiter) { row.push(cell.trim()); cell = ''; }
      else if (!quoted && (c === '\n' || c === '\r')) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; if (c === '\r' && source[i + 1] === '\n') i++; }
      else cell += c;
    }
    if (quoted) throw new Error('表格引号未闭合。');
    row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
    if (!rows.length) throw new Error('表格为空。');
    const aliases = { sample: ['sample', 'sample name', '样本', '样品'], group: ['group', '组别', '分组'], biologicalReplicate: ['biologicalreplicate', 'biological replicate', '生物重复'] };
    const header = rows.shift().map(x => x.toLowerCase()), columns = {};
    for (const [key, names] of Object.entries(aliases)) columns[key] = header.findIndex(x => names.includes(x));
    if (columns.sample < 0) throw new Error('首行需要 Sample / 样本 列；可选 Group / 组别、BiologicalReplicate / 生物重复。');
    if (!rows.length) throw new Error('表格只有表头，没有样本数据。');
    const seen = new Set();
    return rows.map(cells => {
      const sample = cells[columns.sample] || ''; if (!sample || /[\r\n\t]/.test(sample)) throw new Error('样本名不能为空或包含换行、制表符。');
      if (seen.has(sample.toLowerCase())) throw new Error('表格样本重复：' + sample); seen.add(sample.toLowerCase());
      return { sample, group: columns.group < 0 ? '' : cells[columns.group] || '', biologicalReplicate: columns.biologicalReplicate < 0 ? '' : cells[columns.biologicalReplicate] || '' };
    });
  }
  function draftStore(storage, key = 'qpcr-draft-v2') {
    return {
      read() { try { const draft = JSON.parse(storage.getItem(key) || 'null'); return draft?.version === 1 && draft.project ? draft : null; } catch (_) { return null; } },
      write(value) { try { storage.setItem(key, JSON.stringify({ ...value, version: 1, savedAt: new Date().toISOString() })); return true; } catch (_) { return false; } },
      clear() { try { storage.removeItem(key); return true; } catch (_) { return false; } }
    };
  }
  function summaryCSV(summary) {
    const cell = value => { const raw = String(value ?? ''); return '"' + (/^\s*[=+@-]/.test(raw) ? "'" + raw : raw).replace(/"/g, '""') + '"'; };
    const rows = [['试剂','实际用量 µL','配制量 µL','余量 µL'], ...summary.ingredients.map(x => [x.name,x.reactionUse,x.prepared,x.extra]), [], ['Plate','assay','预混名称','配制 µL','转移 µL'], ...summary.transfers.map(x => [x.plate,x.assay,x.name,x.prepared,x.transfer])];
    return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  return { parseTable, draftStore, summaryCSV };
});
