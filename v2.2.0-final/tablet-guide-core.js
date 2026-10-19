(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./core.js') : root.QPCR);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRTabletCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Q) {
  'use strict';
  const VERSION = 1;
  const PHYSICAL_CONFIG = Object.freeze({
    96: Object.freeze({ rows: 8, cols: 12, nominalPitchMm: 9, basePitchPx: 38 }),
    384: Object.freeze({ rows: 16, cols: 24, nominalPitchMm: 4.5, basePitchPx: 19 })
  });
  const COLORS = Object.freeze({ white: '#f4fbff', red: '#ff6262', green: '#67ffae', blue: '#69baff', amber: '#ffd06a' });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const clampScale = value => clamp(Number(value) || 1, 0.5, 2.5);
  const clampRotation = value => clamp(Number(value) || 0, -10, 10);
  function geometry(type) {
    const cfg = PHYSICAL_CONFIG[type]; if (!cfg) throw new Error('仅支持 96 / 384 孔板。');
    // 外框留白仅用于安全区域估计；实体孔板的真实外框仍需人工检查。
    const pitch = cfg.basePitchPx, pad = pitch * (Number(type) === 96 ? 1.5 : 2.5);
    return { ...cfg, pitch, pad, width: (cfg.cols - 1) * pitch + pad * 2, height: (cfg.rows - 1) * pitch + pad * 2, radius: pitch * 0.34 };
  }
  function wells(type) {
    const g = geometry(type);
    return Q.coordinates(type).map(x => ({ well: x.well, row: x.r, col: x.c, x: g.pad + x.c * g.pitch, y: g.pad + x.r * g.pitch,
      corner: (x.r === 0 || x.r === g.rows - 1) && (x.c === 0 || x.c === g.cols - 1),
      edge: x.r === 0 || x.r === g.rows - 1 || x.c === 0 || x.c === g.cols - 1 }));
  }
  function defaultTransform(type, stage) {
    const g = geometry(type);
    const fit = Math.min((stage.width * 0.86) / g.width, (stage.height * 0.82) / g.height);
    return { translateX: 0, translateY: 0, scale: clampScale(Number.isFinite(fit) && fit > 0 ? fit : 1), rotationDeg: 0 };
  }
  const resetTransform = defaultTransform;
  function plateFits(type, stage, transform) {
    const g = geometry(type), rad = transform.rotationDeg * Math.PI / 180;
    const halfWidth = transform.scale * (Math.abs(g.width * Math.cos(rad)) + Math.abs(g.height * Math.sin(rad))) / 2;
    const halfHeight = transform.scale * (Math.abs(g.width * Math.sin(rad)) + Math.abs(g.height * Math.cos(rad))) / 2;
    return Math.abs(transform.translateX) + halfWidth <= stage.width / 2 && Math.abs(transform.translateY) + halfHeight <= stage.height / 2;
  }
  function sanitizeTransform(value) {
    const x = Number(value?.translateX), y = Number(value?.translateY);
    return { translateX: Number.isFinite(x) ? x : 0, translateY: Number.isFinite(y) ? y : 0, scale: clampScale(value?.scale), rotationDeg: clampRotation(value?.rotationDeg) };
  }
  function move(transform, dx, dy) { return { ...transform, translateX: transform.translateX + dx, translateY: transform.translateY + dy }; }
  function scaleAt(transform, factor, center) {
    const scale = clampScale(transform.scale * factor), ratio = scale / transform.scale;
    return { ...transform, scale, translateX: center.x - ratio * (center.x - transform.translateX), translateY: center.y - ratio * (center.y - transform.translateY) };
  }
  function rotateAt(transform, deltaDeg, center) {
    const rotationDeg = clampRotation(transform.rotationDeg + deltaDeg), delta = (rotationDeg - transform.rotationDeg) * Math.PI / 180;
    const dx = transform.translateX - center.x, dy = transform.translateY - center.y;
    return { ...transform, rotationDeg, translateX: center.x + dx * Math.cos(delta) - dy * Math.sin(delta), translateY: center.y + dx * Math.sin(delta) + dy * Math.cos(delta) };
  }
  function gestureStart(transform, a, b) {
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, angle = Math.atan2(b.y - a.y, b.x - a.x);
    const dx = center.x - transform.translateX, dy = center.y - transform.translateY, rad = -transform.rotationDeg * Math.PI / 180;
    return { initial: { ...transform }, distance: Math.hypot(b.x - a.x, b.y - a.y), angle, local: { x: (dx * Math.cos(rad) - dy * Math.sin(rad)) / transform.scale, y: (dx * Math.sin(rad) + dy * Math.cos(rad)) / transform.scale } };
  }
  function gestureUpdate(start, a, b) {
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance = Math.hypot(b.x - a.x, b.y - a.y), angle = Math.atan2(b.y - a.y, b.x - a.x);
    const scale = clampScale(start.initial.scale * (start.distance > 0 ? distance / start.distance : 1));
    let delta = angle - start.angle; while (delta > Math.PI) delta -= 2 * Math.PI; while (delta < -Math.PI) delta += 2 * Math.PI;
    const rotationDeg = clampRotation(start.initial.rotationDeg + delta * 180 / Math.PI), rad = rotationDeg * Math.PI / 180;
    return { scale, rotationDeg, translateX: center.x - scale * (start.local.x * Math.cos(rad) - start.local.y * Math.sin(rad)), translateY: center.y - scale * (start.local.x * Math.sin(rad) + start.local.y * Math.cos(rad)) };
  }
  function highlightWells(step, type) {
    const selected = new Set();
    for (const well of step?.wells || []) {
      const id = Q.parseWell(well, type);
      if (!id) throw new Error('加样步骤包含无效孔位：' + well);
      selected.add(id);
    }
    return selected;
  }
  const nextStepIndex = (current, delta, length) => clamp(current + delta, 0, Math.max(0, length - 1));
  const profileKey = type => `qpcr-tablet-calibration-v1-${Number(type)}`;
  function viewport(stage, guideWidth, guideHeight) { return { width: Math.round(guideWidth), height: Math.round(guideHeight), stageWidth: Math.round(stage.width), stageHeight: Math.round(stage.height), orientation: guideWidth >= guideHeight ? 'landscape' : 'portrait' }; }
  function createProfile(type, view, transform, display) { return { version: VERSION, plateType: Number(type), viewport: { ...view }, transform: sanitizeTransform(transform), display: { highlightColor: COLORS[display.highlightColor] ? display.highlightColor : 'white', brightness: clamp(Number(display.brightness) || 0.6, 0.25, 1) } }; }
  function profileStatus(profile, type, view) {
    if (!profile || profile.version !== VERSION) return 'missing';
    if (profile.plateType !== Number(type)) return 'wrong-type';
    const old = profile.viewport;
    if (!old || old.orientation !== view.orientation) return 'changed';
    for (const key of ['width', 'height', 'stageWidth', 'stageHeight']) if (!Number.isFinite(old[key]) || Math.abs(old[key] - view[key]) > Math.max(12, old[key] * 0.02)) return 'changed';
    return 'match';
  }
  function viewportChanged(before, now) { return !before || before.orientation !== now.orientation || ['width', 'height', 'stageWidth', 'stageHeight'].some(key => Math.abs(before[key] - now[key]) > 2); }
  return { VERSION, PHYSICAL_CONFIG, COLORS, geometry, wells, defaultTransform, resetTransform, plateFits, sanitizeTransform, clampScale, clampRotation, move, scaleAt, rotateAt, gestureStart, gestureUpdate, highlightWells, nextStepIndex, profileKey, viewport, createProfile, profileStatus, viewportChanged };
});
