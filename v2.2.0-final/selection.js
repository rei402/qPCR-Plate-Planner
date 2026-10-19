(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : root.QPCR);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRSelection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Q) {
  'use strict';
  const allWells = type => Q.coordinates(type).map(x => x.well);
  const coord = (well, type) => {
    const normalized = Q.parseWell(well, type);
    if (!normalized) throw new Error('孔位无效：' + well);
    const m = /^([A-P])(\d+)$/.exec(normalized);
    return { row: m[1].charCodeAt(0) - 65, col: Number(m[2]), well: normalized };
  };
  const getRowWells = (row, type) => { const r = String(row).toUpperCase().charCodeAt(0) - 65; if (r < 0 || r >= Q.ROWS[type]) throw new Error('行号无效'); return Array.from({ length: Q.COLS[type] }, (_, i) => String.fromCharCode(65 + r) + (i + 1)); };
  const getColumnWells = (col, type) => { const c = Number(col); if (!Number.isInteger(c) || c < 1 || c > Q.COLS[type]) throw new Error('列号无效'); return Array.from({ length: Q.ROWS[type] }, (_, i) => String.fromCharCode(65 + i) + c); };
  function getRectSelection(a, b, type) {
    const x = coord(a, type), y = coord(b, type), wells = [];
    for (let r = Math.min(x.row, y.row); r <= Math.max(x.row, y.row); r++) for (let c = Math.min(x.col, y.col); c <= Math.max(x.col, y.col); c++) wells.push(String.fromCharCode(65 + r) + c);
    return wells;
  }
  function getRowRangeSelection(a, b, type) { const start = String(a).toUpperCase().charCodeAt(0) - 65, end = String(b).toUpperCase().charCodeAt(0) - 65, out = []; if (start < 0 || end >= Q.ROWS[type] || end < 0 || start >= Q.ROWS[type]) throw new Error('行号无效'); for (let r = Math.min(start, end); r <= Math.max(start, end); r++) out.push(...getRowWells(String.fromCharCode(65 + r), type)); return out; }
  function getColumnRangeSelection(a, b, type) { const start = Number(a), end = Number(b), out = []; if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > Q.COLS[type] || end < 1 || start > Q.COLS[type]) throw new Error('列号无效'); for (let c = Math.min(start, end); c <= Math.max(start, end); c++) out.push(...getColumnWells(c, type)); return out; }
  const replaceSelection = wells => new Set(wells);
  const addSelection = (current, wells) => new Set([...current, ...wells]);
  function toggleSelection(current, wells) { const next = new Set(current); for (const well of wells) next.has(well) ? next.delete(well) : next.add(well); return next; }
  const invertSelection = (current, type) => new Set(allWells(type).filter(w => !current.has(w)));
  const selectionFor = (kind, value, type) => kind === 'well' ? [coord(value, type).well] : kind === 'row' ? getRowWells(value, type) : getColumnWells(value, type);
  const rangeFor = (kind, start, end, type) => kind === 'well' ? getRectSelection(start, end, type) : kind === 'row' ? getRowRangeSelection(start, end, type) : getColumnRangeSelection(start, end, type);
  function clickSelection(current, anchor, kind, value, modifiers, type) {
    const ctrl = !!(modifiers.ctrlKey || modifiers.metaKey), shift = !!modifiers.shiftKey;
    const sameAnchor = shift && anchor && anchor.type === kind;
    const wells = sameAnchor ? rangeFor(kind, anchor.value, value, type) : selectionFor(kind, value, type);
    const selected = sameAnchor ? (ctrl ? addSelection(current, wells) : replaceSelection(wells)) : ctrl ? (kind === 'well' ? toggleSelection(current, wells) : wells.every(w => current.has(w)) ? new Set([...current].filter(w => !wells.includes(w))) : addSelection(current, wells)) : replaceSelection(wells);
    const nextAnchor = sameAnchor ? anchor : ctrl && anchor ? anchor : { type: kind, value };
    return { selected, anchor: nextAnchor, lastSelectedWell: kind === 'well' ? coord(value, type).well : null };
  }
  function selectionSummary(selected, reserved) { let alreadyReserved = 0; for (const well of selected) if (reserved.has(well)) alreadyReserved++; return { total: selected.size, available: selected.size - alreadyReserved, reserved: alreadyReserved }; }
  function applyReserved(reserved, selected, action) { const next = new Set(reserved); for (const well of selected) action === 'reserve' ? next.add(well) : next.delete(well); return next; }
  function commitReserved(history, current, next) {
    if (current.size === next.size && [...current].every(w => next.has(w))) return { history, reserved: current, changed: false };
    return { history: { undo: [...history.undo, new Set(current)].slice(-50), redo: [] }, reserved: next, changed: true };
  }
  function undoReserved(history, current) { if (!history.undo.length) return { history, reserved: current, changed: false }; return { history: { undo: history.undo.slice(0, -1), redo: [...history.redo, new Set(current)].slice(-50) }, reserved: history.undo.at(-1), changed: true }; }
  function redoReserved(history, current) { if (!history.redo.length) return { history, reserved: current, changed: false }; return { history: { undo: [...history.undo, new Set(current)].slice(-50), redo: history.redo.slice(0, -1) }, reserved: history.redo.at(-1), changed: true }; }
  return { allWells, getRowWells, getColumnWells, getRectSelection, getRowRangeSelection, getColumnRangeSelection, replaceSelection, addSelection, toggleSelection, invertSelection, clickSelection, selectionSummary, applyReserved, commitReserved, undoReserved, redoReserved };
});
