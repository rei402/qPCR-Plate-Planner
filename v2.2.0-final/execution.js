(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : root.QPCR);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRExecution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Q) {
  'use strict';
  function fingerprint(project, result) {
    if(windowSafeSingle(project)) return JSON.stringify({design:result.plates[0]?.singleChannelDesignKey,plates:result.plates.map(p=>({plate:p.number,assignment:p.singleChannelAssignmentKey,steps:Q.stepsFor(p,project).map(stepKey)}))});
    return JSON.stringify(result.plates.map(p => ({ number: p.number, wells: p.wells.map(r => [r.id, r.well]).sort((a, b) => a[0].localeCompare(b[0])), steps: Q.stepsFor(p, project).map(s => [s.kind, s.title, s.perWell, s.total, s.wells]) })));
  }
  function windowSafeSingle(project) { return project.settings.layoutMode === 'singleChannelOptimized'; }
  function stepKey(step) { return JSON.stringify([step.kind, step.title, step.wells, step.perWell, step.total]); }
  function create(project, result, saved) {
    const layoutFingerprint = fingerprint(project, result), plates = {};
    for (const plate of result.plates) {
      const steps = Q.stepsFor(plate, project), valid = new Set(steps.map(stepKey));
      const old = saved?.layoutFingerprint === layoutFingerprint ? saved.plates?.[plate.number] : null;
      plates[plate.number] = { cursor: valid.has(old?.cursor) ? old.cursor : stepKey(steps[0]), completed: {} };
      for (const [key, timestamp] of Object.entries(old?.completed || {})) if (valid.has(key) && typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))) plates[plate.number].completed[key] = timestamp;
    }
    return { version: 1, layoutFingerprint, plates, updatedAt: saved?.layoutFingerprint === layoutFingerprint && saved.updatedAt || null };
  }
  function complete(execution, plate, step, date = new Date()) {
    const key = stepKey(step); execution.plates[plate].completed[key] ||= date.toISOString();
    execution.updatedAt = date.toISOString(); return execution;
  }
  function reopen(execution, plate, step) { delete execution.plates[plate].completed[stepKey(step)]; execution.updatedAt = new Date().toISOString(); }
  function cursor(execution, plate, step) { execution.plates[plate].cursor = stepKey(step); }
  function isComplete(execution, plate, step) { return !!execution?.plates?.[plate]?.completed?.[stepKey(step)]; }
  function resumeIndex(execution, plate, steps) { const index = steps.findIndex(s => !isComplete(execution, plate, s)); return index < 0 ? steps.length - 1 : index; }
  return { fingerprint, stepKey, create, complete, reopen, cursor, isComplete, resumeIndex };
});
