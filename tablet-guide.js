(() => {
  'use strict';
  const Q = window.QPCR, G = window.QPCRTabletCore;
  let activeGuide = null;
  const ns = 'http://www.w3.org/2000/svg';
  const dom = `
    <header class="tg-header"><div><strong>平板加样辅助</strong><span id="tgPlateTitle"></span><span class="tg-a1">▲ A1 在左上</span></div><div class="tg-header-actions"><label>当前孔板 <select id="tgPlateSelect"></select></label><button id="tgFullscreen" type="button">进入全屏</button><button id="tgExit" type="button">退出平板辅助</button></div></header>
    <div id="tgWarning" class="tg-warning" role="status" aria-live="polite"></div>
    <div class="tg-layout">
      <aside class="tg-info"><div id="tgOnboard" class="tg-onboard"><strong>首次使用</strong><p>① 将透明孔板放在屏幕上　② 对齐 A1 与四角　③ 检查中央孔位　④ 锁定并按步骤加样。</p><p>屏幕光仅用于孔位定位；对光敏感的试剂请遵循说明书控制曝光时间和亮度。</p><button id="tgDismissIntro" type="button">知道了，以后不再提示</button></div><div id="tgCalibrationInfo"><h2>校准孔板</h2><p>先进入全屏，确认实体孔板 A1 方向；拖动、双指缩放及轻微旋转，让四角和中央孔位重合。</p><p>96 孔约 9 mm、384 孔约 4.5 mm 的孔距仅用于初始估计。请以实物对齐为准。</p><p id="tgProfileNotice"></p><div class="tg-profile-actions"><button id="tgUseProfile" type="button">使用上次校准</button><button id="tgFreshCalibration" type="button">重新校准</button></div></div><div id="tgStepInfo" aria-live="polite" hidden><div class="tg-step-count" id="tgStepCount"></div><h2 id="tgStepTitle"></h2><p id="tgStepVolume"></p><p id="tgStepWells"></p><p id="tgStepRange" class="tg-step-range"></p><p id="tgStepNote"></p></div></aside>
      <div id="tgStage" class="tg-stage" aria-label="实体孔板校准和孔位投光区域"><div id="tgTransform" class="tg-transform"></div><span class="tg-stage-orientation">▲ A1</span></div>
      <aside class="tg-controls"><div id="tgCalibrationControls"><h2>校准控制</h2><label>显示孔位<select id="tgCalibrationDisplay"><option value="edges">四角与外框</option><option value="corners">仅四角</option><option value="all">全部孔</option></select></label><div class="tg-control-group"><span>缩放 <output id="tgScaleValue">100%</output></span><div><button type="button" data-tg-adjust="scaleDown" aria-label="缩小 0.5%">− 缩小</button><button type="button" data-tg-adjust="scaleUp" aria-label="放大 0.5%">＋ 放大</button></div></div><div class="tg-control-group"><span>位置微调（Shift：5 px）</span><div class="tg-direction"><button type="button" data-tg-adjust="left" aria-label="向左移动">←</button><button type="button" data-tg-adjust="up" aria-label="向上移动">↑</button><button type="button" data-tg-adjust="down" aria-label="向下移动">↓</button><button type="button" data-tg-adjust="right" aria-label="向右移动">→</button></div></div><div class="tg-control-group"><span>旋转 <output id="tgRotationValue">0.0°</output></span><div><button type="button" data-tg-adjust="rotateLeft" aria-label="逆时针旋转 0.1 度">↺ −0.1°</button><button type="button" data-tg-adjust="rotateRight" aria-label="顺时针旋转 0.1 度">↻ +0.1°</button></div></div><button id="tgReset" type="button">重置位置与尺寸</button><label class="tg-check"><input id="tgRemember" type="checkbox" checked> 记住此设备的校准</label><button id="tgLock" type="button" class="tg-primary">锁定位置并开始</button><p id="tgFitWarning" class="tg-fit-warning" hidden>孔板超出中央校准区域；请缩小或移回中央，保持控制按钮在孔板外。</p><p class="tg-control-note">锁定前请检查中央孔位；锁定后触碰孔板区域不会移动光点。</p></div><div id="tgRunControls" hidden><strong id="tgLockLabel">🔒 孔板位置已锁定</strong><div class="tg-nav"><button id="tgPrevious" type="button">← 上一步</button><button id="tgNext" type="button" class="tg-primary">完成本步并继续 →</button></div><div class="tg-run-actions"><button id="tgPause" type="button">暂停</button><button id="tgBlackout" type="button">熄灭孔板</button></div><label>亮起强度<select id="tgBrightness"><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.6">60%</option><option value="0.75">75%</option><option value="1">100%</option></select></label><label>高亮颜色<select id="tgColor"><option value="white">白色</option><option value="red">红色</option><option value="green">绿色</option><option value="blue">蓝色</option><option value="amber">琥珀色</option></select></label><button id="tgSaveProfile" type="button">保存为此设备校准</button><button id="tgRecalibrate" type="button">重新校准</button><p id="tgWakeStatus" class="tg-control-note"></p></div></aside>
    </div>
    <details class="tg-safety"><summary>使用提示</summary><p>确认实体孔板 A1 方向，并检查孔板实际外框不会遮住控制区；不同厂家的 skirt 和透明底位置可能不同。保持孔板外表面清洁、干燥，避免按压或划伤屏幕。如有需要，可使用洁净透明保护层。避免将已加反应液的孔板长时间置于发热屏幕表面；光敏试剂遵循厂家避光要求。本功能仅辅助定位，不能代替实验人员最终核对。</p></details>`;

  class TabletGuide {
    constructor(options) {
      this.project = options.project; this.result = options.result; this.plateIndex = options.plateIndex || 0; this.onPlateChange = options.onPlateChange || (() => {}); this.onStepChange = options.onStepChange || (() => {});
      this.onStepComplete = options.onStepComplete || (() => {}); this.isStepComplete = options.isStepComplete || (() => false); this.onStepReopen = options.onStepReopen || (() => {});
      this.type = Number(this.project.plateType); this.steps = this.validatedSteps(this.plateIndex);
      this.stepIndex = G.nextStepIndex(options.stepIndex || 0, 0, this.steps.length);
      this.phase = 'calibration'; this.locked = false; this.needsReview = false; this.paused = true; this.blackout = true;
      this.calibrationDisplay = 'edges'; this.transform = null; this.lockedViewport = null; this.pointers = new Map(); this.dragStart = null; this.gesture = null; this.frame = 0;
      this.wellElements = new Map(); this.lastNavigationAt = 0; this.wakeLock = null; this.wakeStatus = ''; this.active = false;
      this.abort = new AbortController(); this.display = { highlightColor: 'white', brightness: 0.6 };
      this.lastFocus = document.activeElement; this.previousOverflow = document.body.style.overflow;
      this.notice = ''; this.orientationLocked = false;
    }
    el(id) { return this.root.querySelector('#' + id); }
    validatedSteps(index) {
      const plate = this.result.plates[index], steps = Q.stepsFor(plate, this.project), assigned = new Set(plate.wells.map(w => w.well));
      for (const step of steps) for (const well of G.highlightWells(step, this.type)) if (!assigned.has(well)) throw new Error('加样步骤存在未分配孔位：' + well);
      return steps;
    }
    listen(target, type, handler, options = {}) { target.addEventListener(type, handler, { ...options, signal: this.abort.signal }); }
    readStorage(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
    writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
    stageSize() { return { width: this.stage.clientWidth, height: this.stage.clientHeight }; }
    viewport() { return G.viewport(this.stageSize(), this.root.clientWidth, this.root.clientHeight); }
    mount() {
      this.root = document.createElement('div'); this.root.id = 'tabletGuide'; this.root.className = 'tablet-guide'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true'); this.root.setAttribute('aria-label', '平板加样辅助'); this.root.innerHTML = dom;
      document.body.appendChild(this.root); document.body.style.overflow = 'hidden'; this.active = true; this.stage = this.el('tgStage');
      const savedDisplay = this.readStorage('qpcr-tablet-display-v1');
      if (savedDisplay) { if (G.COLORS[savedDisplay.highlightColor]) this.display.highlightColor = savedDisplay.highlightColor; if ([0.25, 0.5, 0.6, 0.75, 1].includes(savedDisplay.brightness)) this.display.brightness = savedDisplay.brightness; }
      this.transform = G.defaultTransform(this.type, this.stageSize());
      this.profile = this.readStorage(G.profileKey(this.type));
      this.el('tgPlateSelect').innerHTML = this.result.plates.map((p, i) => `<option value="${i}">Plate ${p.number} / ${this.result.plates.length}</option>`).join('');
      this.el('tgPlateSelect').value = String(this.plateIndex); this.el('tgBrightness').value = String(this.display.brightness); this.el('tgColor').value = this.display.highlightColor;
      this.onboardDismissed = !!this.readStorage('qpcr-tablet-onboarded-v1'); this.el('tgOnboard').hidden = this.onboardDismissed;
      this.buildPlate(); this.bind();
      if (typeof ResizeObserver !== 'undefined') { this.resizeObserver = new ResizeObserver(() => this.handleResize()); this.resizeObserver.observe(this.root); this.resizeObserver.observe(this.stage); }
      this.render(); this.el('tgFullscreen').focus();
    }
    buildPlate() {
      const g = G.geometry(this.type), svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', g.width); svg.setAttribute('height', g.height); svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`); svg.setAttribute('class', `tablet-guide-plate tg-plate-${this.type}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${this.type} 孔板投光图，A1 在左上`);
      svg.style.left = -g.width / 2 + 'px'; svg.style.top = -g.height / 2 + 'px'; this.wellElements.clear();
      for (const point of G.wells(this.type)) {
        const group = document.createElementNS(ns, 'g'); group.setAttribute('class', 'tg-well'); group.setAttribute('data-well', point.well);
        const circle = document.createElementNS(ns, 'circle'); circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', g.radius); circle.setAttribute('class', 'tg-well-core'); group.appendChild(circle);
        if (point.corner) { const ring = document.createElementNS(ns, 'circle'); ring.setAttribute('cx', point.x); ring.setAttribute('cy', point.y); ring.setAttribute('r', g.radius + g.pitch * 0.12); ring.setAttribute('class', 'tg-corner-ring'); group.appendChild(ring); }
        svg.appendChild(group); this.wellElements.set(point.well, { group, point });
      }
      const a1 = G.wells(this.type)[0], label = document.createElementNS(ns, 'text'); label.setAttribute('x', a1.x - g.radius); label.setAttribute('y', a1.y - g.radius - 9); label.setAttribute('class', 'tg-a1-label'); label.textContent = '▲ A1'; svg.appendChild(label);
      this.el('tgTransform').replaceChildren(svg);
    }
    bind() {
      const click = (id, fn) => this.listen(this.el(id), 'click', fn);
      click('tgExit', () => close()); click('tgFullscreen', () => this.toggleFullscreen());
      click('tgDismissIntro', () => { this.onboardDismissed = true; this.writeStorage('qpcr-tablet-onboarded-v1', true); this.el('tgOnboard').hidden = true; });
      click('tgUseProfile', () => this.useProfile()); click('tgFreshCalibration', () => this.reset());
      click('tgReset', () => this.reset()); click('tgLock', () => this.lock()); click('tgRecalibrate', () => this.recalibrate()); click('tgSaveProfile', () => this.saveProfile());
      click('tgPrevious', () => this.navigate(-1)); click('tgNext', () => this.navigate(1));
      const reopen = document.createElement('button'); reopen.id = 'tgReopen'; reopen.type = 'button'; reopen.textContent = '将当前步骤标为待执行'; this.el('tgRunControls').append(reopen);
      click('tgReopen', () => { if (this.phase === 'run' && !this.needsReview) { this.onStepReopen(this.steps[this.stepIndex], this.plateIndex); this.render(); } });
      click('tgPause', () => this.togglePause()); click('tgBlackout', () => this.toggleBlackout());
      this.listen(this.el('tgPlateSelect'), 'change', event => this.switchPlate(Number(event.target.value)));
      this.listen(this.el('tgCalibrationDisplay'), 'change', event => { this.calibrationDisplay = event.target.value; this.updateLights(); });
      this.listen(this.el('tgBrightness'), 'change', event => this.changeDisplay('brightness', Number(event.target.value)));
      this.listen(this.el('tgColor'), 'change', event => this.changeDisplay('highlightColor', event.target.value));
      this.listen(this.el('tgCalibrationControls'), 'click', event => { const button = event.target.closest('[data-tg-adjust]'); if (button) this.adjust(button.dataset.tgAdjust, event.shiftKey); });
      this.listen(this.stage, 'pointerdown', event => this.pointerDown(event)); this.listen(this.stage, 'pointermove', event => this.pointerMove(event));
      this.listen(this.stage, 'pointerup', event => this.pointerEnd(event)); this.listen(this.stage, 'pointercancel', event => this.pointerEnd(event));
      this.listen(this.stage, 'wheel', event => this.wheel(event), { passive: false });
      this.listen(window, 'resize', () => this.handleResize()); this.listen(window, 'orientationchange', () => this.markReview('屏幕方向已改变，需要重新确认孔板位置。'));
      this.listen(document, 'fullscreenchange', () => this.handleFullscreenChange());
      this.listen(document, 'visibilitychange', () => { if (document.hidden && this.phase === 'run') { this.paused = true; this.blackout = true; this.releaseWakeLock(); this.render(); } });
      this.listen(document, 'keydown', event => {
        if (event.key === 'Escape' && !document.fullscreenElement) { event.preventDefault(); close(); return; }
        if (event.key !== 'Tab') return;
        const focusable = [...this.root.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary')].filter(el => !el.closest('[hidden]') && el.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable.at(-1), current = document.activeElement;
        if (!this.root.contains(current) || event.shiftKey && current === first) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus(); }
      });
    }
    render() {
      if (!this.active) return;
      const plate = this.result.plates[this.plateIndex], calibration = this.phase === 'calibration';
      this.el('tgPlateTitle').textContent = `Plate ${plate.number} / ${this.result.plates.length} · ${this.type} 孔`;
      this.el('tgCalibrationInfo').hidden = !calibration; this.el('tgCalibrationControls').hidden = !calibration;
      this.el('tgStepInfo').hidden = calibration; this.el('tgRunControls').hidden = calibration;
      this.el('tgOnboard').hidden = !calibration || this.onboardDismissed;
      this.stage.classList.toggle('is-calibrating', calibration); this.stage.classList.toggle('is-running', !calibration);
      this.el('tgFullscreen').textContent = document.fullscreenElement === this.root ? '退出全屏' : '进入全屏';
      this.el('tgWarning').textContent = this.warningText();
      this.el('tgProfileNotice').textContent = this.profile ? G.profileStatus(this.profile, this.type, this.viewport()) === 'match' ? '找到此设备上次校准。使用后仍需核对实体孔位并锁定。' : '上次校准的屏幕尺寸或方向不同，请重新校准；如选择使用上次设置，仍需重新核对并锁定。' : '此孔板类型尚无设备校准记录。';
      this.el('tgUseProfile').hidden = !this.profile;
      this.renderTransform(); this.renderStep(); this.updateLights();
      this.el('tgWakeStatus').textContent = this.wakeStatus;
      this.el('tgLockLabel').textContent = this.needsReview ? '⚠ 校准需要重新确认' : this.paused ? '⏸ 加样辅助已暂停' : this.blackout ? '● 孔板已熄灭' : '🔒 孔板位置已锁定';
      this.el('tgPause').textContent = this.paused ? '继续' : '暂停'; this.el('tgBlackout').textContent = this.blackout ? '恢复点亮' : '熄灭孔板';
      const canNavigate = !calibration && !this.needsReview && !this.paused && !this.blackout;
      this.el('tgPrevious').disabled = !canNavigate || this.stepIndex === 0; this.el('tgNext').disabled = !canNavigate || this.stepIndex >= this.steps.length - 1 && this.isStepComplete(this.steps[this.stepIndex], this.plateIndex);
      this.el('tgNext').textContent = this.stepIndex === this.steps.length - 1 ? '确认完成本板' : '完成本步并继续 →';
      this.el('tgReopen').disabled = !canNavigate || !this.isStepComplete(this.steps[this.stepIndex], this.plateIndex);
      this.el('tgPause').disabled = this.needsReview; this.el('tgBlackout').disabled = this.needsReview;
      this.el('tgSaveProfile').disabled = calibration || this.needsReview;
    }
    renderTransform() {
      if (!this.active) return;
      const t = this.transform;
      this.el('tgTransform').style.transform = `translate(${t.translateX}px, ${t.translateY}px) rotate(${t.rotationDeg}deg) scale(${t.scale})`;
      this.el('tgScaleValue').textContent = (t.scale * 100).toFixed(1) + '%'; this.el('tgRotationValue').textContent = t.rotationDeg.toFixed(1) + '°';
      const fits = G.plateFits(this.type, this.stageSize(), t);
      this.el('tgLock').disabled = !fits;
      this.el('tgFitWarning').hidden = fits;
      this.stage.classList.toggle('plate-outside', !fits);
      this.el('tgLock').title = fits ? '确认四角及中央孔位后锁定' : '孔板超出中央校准区域，请缩小或移回中央';
    }
    renderStep() {
      const step = this.steps[this.stepIndex]; if (!step) return;
      this.el('tgStepCount').textContent = `步骤 ${this.stepIndex + 1} / ${this.steps.length}`;
      this.el('tgStepTitle').textContent = step.title;
      this.el('tgStepVolume').textContent = step.wells.length ? `每孔加入 ${Q.volume(step.perWell)} µL · 共 ${step.wells.length} 孔` : '此步骤无需在孔板上操作。';
      this.el('tgStepWells').textContent = step.wells.length ? `目标孔位：${step.range}` : '当前无点亮孔位';
      this.el('tgStepRange').textContent = step.wells.length ? `亮起 ${step.wells.length} 个孔` : '全部孔位熄灭';
      this.el('tgStepNote').textContent = step.note || '';
    }
    updateLights() {
      if (!this.active) return;
      const calibration = this.phase === 'calibration';
      const lit = !calibration && !this.needsReview && !this.paused && !this.blackout ? G.highlightWells(this.steps[this.stepIndex], this.type) : new Set();
      for (const { group, point } of this.wellElements.values()) {
        group.classList.toggle('is-lit', lit.has(point.well));
        group.classList.toggle('is-visible', calibration && (this.calibrationDisplay === 'all' || point.corner || this.calibrationDisplay === 'edges' && point.edge));
        group.classList.toggle('is-corner', point.corner);
      }
      this.root.style.setProperty('--tg-color', G.COLORS[this.display.highlightColor]); this.root.style.setProperty('--tg-brightness', String(this.display.brightness));
    }
    setTransform(transform) {
      const t = G.sanitizeTransform(transform), size = this.stageSize();
      t.translateX = Math.max(-size.width, Math.min(size.width, t.translateX)); t.translateY = Math.max(-size.height, Math.min(size.height, t.translateY));
      this.transform = t; this.renderTransform();
    }
    reset() { if (this.phase !== 'calibration') return; this.setTransform(G.resetTransform(this.type, this.stageSize())); this.el('tgCalibrationDisplay').value = 'edges'; this.calibrationDisplay = 'edges'; this.updateLights(); }
    adjust(action, coarse) {
      if (this.phase !== 'calibration') return;
      const px = coarse ? 5 : 1, step = this.type === 384 ? 0.0025 : 0.005; let t = this.transform;
      if (action === 'left') t = G.move(t, -px, 0); else if (action === 'right') t = G.move(t, px, 0); else if (action === 'up') t = G.move(t, 0, -px); else if (action === 'down') t = G.move(t, 0, px);
      else if (action === 'scaleDown') t = G.scaleAt(t, (t.scale - step) / t.scale, { x: 0, y: 0 }); else if (action === 'scaleUp') t = G.scaleAt(t, (t.scale + step) / t.scale, { x: 0, y: 0 });
      else if (action === 'rotateLeft') t = G.rotateAt(t, -0.1, { x: 0, y: 0 }); else if (action === 'rotateRight') t = G.rotateAt(t, 0.1, { x: 0, y: 0 });
      this.setTransform(t);
    }
    pointerPoint(event) { const rect = this.stage.getBoundingClientRect(); return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }; }
    pointerDown(event) {
      if (this.phase !== 'calibration' || this.locked || this.pointers.size >= 2 || event.button !== 0 && event.pointerType === 'mouse') return;
      if (this.pointers.size === 1) { if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; } this.updateFromPointers(); }
      event.preventDefault(); this.stage.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, this.pointerPoint(event));
      if (this.pointers.size === 1) this.dragStart = { point: this.pointers.values().next().value, transform: { ...this.transform } };
      else { const [a, b] = [...this.pointers.values()]; this.gesture = G.gestureStart(this.transform, a, b); this.dragStart = null; }
    }
    pointerMove(event) {
      if (!this.pointers.has(event.pointerId) || this.phase !== 'calibration') return;
      this.pointers.set(event.pointerId, this.pointerPoint(event));
      if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.updateFromPointers(); });
    }
    updateFromPointers() {
      if (this.phase !== 'calibration') return;
      if (this.pointers.size === 1 && this.dragStart) {
        const point = this.pointers.values().next().value;
        this.setTransform(G.move(this.dragStart.transform, point.x - this.dragStart.point.x, point.y - this.dragStart.point.y));
      } else if (this.pointers.size === 2 && this.gesture) {
        const [a, b] = [...this.pointers.values()]; this.setTransform(G.gestureUpdate(this.gesture, a, b));
      }
    }
    pointerEnd(event) {
      if (!this.pointers.has(event.pointerId)) return;
      if (event.type === 'pointerup') this.pointers.set(event.pointerId, this.pointerPoint(event));
      if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; } this.updateFromPointers();
      this.pointers.delete(event.pointerId); if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId);
      this.gesture = null; this.dragStart = this.pointers.size === 1 ? { point: this.pointers.values().next().value, transform: { ...this.transform } } : null;
    }
    clearPointers() {
      if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
      for (const id of this.pointers.keys()) if (this.stage.hasPointerCapture(id)) this.stage.releasePointerCapture(id);
      this.pointers.clear(); this.dragStart = null; this.gesture = null;
    }
    wheel(event) {
      if (this.phase !== 'calibration') return;
      event.preventDefault(); const point = this.pointerPoint(event), factor = Math.exp(-event.deltaY * 0.001);
      this.setTransform(G.scaleAt(this.transform, factor, point));
    }
    lock() {
      if (this.phase !== 'calibration' || !G.plateFits(this.type, this.stageSize(), this.transform)) return;
      this.clearPointers(); this.phase = 'run'; this.locked = true; this.needsReview = false; this.paused = false; this.blackout = false; this.lockedViewport = this.viewport();
      if (this.el('tgRemember').checked) this.saveProfile();
      this.requestWakeLock(); this.render();
    }
    recalibrate() { this.clearPointers(); this.phase = 'calibration'; this.locked = false; this.needsReview = false; this.paused = true; this.blackout = true; this.releaseWakeLock(); this.render(); }
    useProfile() {
      if (this.phase !== 'calibration' || !this.profile || this.profile.plateType !== this.type) return;
      this.setTransform(this.profile.transform); this.render();
      this.el('tgProfileNotice').textContent = '已载入上次位置；请与实体孔板重新核对四角和中央孔位，然后锁定。';
    }
    saveProfile() {
      if (this.phase !== 'run' || this.needsReview) return;
      const profile = G.createProfile(this.type, this.viewport(), this.transform, this.display);
      if (this.writeStorage(G.profileKey(this.type), profile)) { this.profile = profile; this.wakeStatus = '此设备校准已保存；更换屏幕方向或尺寸后需重校准。'; }
      else this.wakeStatus = '本浏览器未允许保存校准；本次仍可继续使用。';
      this.el('tgWakeStatus').textContent = this.wakeStatus;
    }
    switchPlate(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.result.plates.length || index === this.plateIndex) return;
      let steps; try { steps = this.validatedSteps(index); } catch (_) { this.notice = '此孔板加样步骤校验失败，不能点亮孔位。'; this.paused = true; this.blackout = true; this.releaseWakeLock(); this.el('tgPlateSelect').value = String(this.plateIndex); this.render(); return; }
      this.clearPointers(); this.releaseWakeLock(); this.plateIndex = index; this.steps = steps; this.stepIndex = 0;
      this.phase = 'calibration'; this.locked = false; this.needsReview = false; this.paused = true; this.blackout = true; this.notice = ''; this.transform = G.defaultTransform(this.type, this.stageSize());
      const resume = this.onPlateChange(index); if (Number.isInteger(resume)) this.stepIndex = G.nextStepIndex(resume, 0, this.steps.length); this.render();
    }
    navigate(delta) {
      if (this.phase !== 'run' || this.needsReview || this.paused || this.blackout || Date.now() - this.lastNavigationAt < 300) return;
      const next = G.nextStepIndex(this.stepIndex, delta, this.steps.length);
      if (delta > 0) this.onStepComplete(this.steps[this.stepIndex], this.plateIndex);
      this.lastNavigationAt = Date.now(); this.stepIndex = next; this.onStepChange(next, this.plateIndex); this.render();
    }
    togglePause() {
      if (this.phase !== 'run' || this.needsReview) return;
      this.paused = !this.paused; if (this.paused) this.releaseWakeLock(); else if (!this.blackout) this.requestWakeLock(); this.render();
    }
    toggleBlackout() {
      if (this.phase !== 'run' || this.needsReview) return;
      this.blackout = !this.blackout; if (this.blackout) this.releaseWakeLock(); else if (!this.paused) this.requestWakeLock(); this.render();
    }
    changeDisplay(key, value) {
      if (key === 'highlightColor' && G.COLORS[value]) this.display.highlightColor = value;
      if (key === 'brightness' && [0.25, 0.5, 0.6, 0.75, 1].includes(value)) this.display.brightness = value;
      this.writeStorage('qpcr-tablet-display-v1', this.display); this.updateLights();
    }
    markReview() {
      if (this.phase !== 'run' || this.needsReview) return;
      this.needsReview = true; this.paused = true; this.blackout = true; this.releaseWakeLock(); this.render();
    }
    warningText() {
      return this.needsReview ? '⚠ 屏幕显示区域已变化，所有孔已熄灭；请重新校准。' : this.viewport().orientation === 'portrait' ? '建议横屏校准，以获得更大的孔板区域。' : this.notice || (this.phase === 'calibration' && document.fullscreenElement !== this.root ? '建议先进入全屏，再校准孔板位置。' : '');
    }
    handleResize() {
      if (!this.active) return;
      if (this.phase === 'run' && G.viewportChanged(this.lockedViewport, this.viewport())) this.markReview();
      else if (this.phase === 'calibration') this.renderTransform();
      this.el('tgWarning').textContent = this.warningText();
    }
    handleFullscreenChange() { if (!this.active) return; if (document.fullscreenElement !== this.root && this.orientationLocked) { try { screen.orientation?.unlock?.(); } catch (_) { /* 不影响投光 */ } this.orientationLocked = false; } if (this.phase === 'run') this.markReview(); this.render(); }
    async toggleFullscreen() {
      try {
        if (document.fullscreenElement === this.root) await document.exitFullscreen();
        else if (this.root.requestFullscreen) { await this.root.requestFullscreen(); this.notice = ''; try { if (screen.orientation?.lock) { await screen.orientation.lock('landscape'); this.orientationLocked = true; } } catch (_) { /* 浏览器不支持方向锁定时继续校准 */ } }
        else this.notice = '当前浏览器不支持全屏；仍可继续校准。';
      } catch (_) { this.notice = '无法进入全屏；仍可继续校准。'; }
      this.render();
    }
    async requestWakeLock() {
      if (!this.active || this.phase !== 'run' || this.paused || this.blackout || this.needsReview) return;
      if (!navigator.wakeLock?.request) { this.wakeStatus = '当前浏览器无法自动保持屏幕常亮，请检查系统自动锁屏设置。'; this.el('tgWakeStatus').textContent = this.wakeStatus; return; }
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (!this.active || this.phase !== 'run' || this.paused || this.blackout || this.needsReview) { await lock.release(); return; }
        if (this.wakeLock && this.wakeLock !== lock) await this.wakeLock.release();
        this.wakeLock = lock; this.wakeStatus = '屏幕常亮已启用。'; this.el('tgWakeStatus').textContent = this.wakeStatus;
        lock.addEventListener('release', () => { if (this.wakeLock === lock) { this.wakeLock = null; if (this.active && this.phase === 'run') { this.wakeStatus = '屏幕常亮已停止；请检查自动锁屏设置。'; this.el('tgWakeStatus').textContent = this.wakeStatus; } } }, { once: true });
      } catch (_) { this.wakeStatus = '无法保持屏幕常亮，请检查系统自动锁屏设置。'; this.el('tgWakeStatus').textContent = this.wakeStatus; }
    }
    releaseWakeLock() { const lock = this.wakeLock; this.wakeLock = null; if (lock) lock.release().catch(() => {}); }
    async close() {
      if (!this.active) return;
      this.active = false; this.paused = true; this.blackout = true;
      for (const { group } of this.wellElements.values()) group.classList.remove('is-lit');
      this.clearPointers(); this.releaseWakeLock(); this.abort.abort(); if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.orientationLocked) { try { screen.orientation?.unlock?.(); } catch (_) { /* 不影响退出 */ } this.orientationLocked = false; }
      try { if (document.fullscreenElement === this.root) await document.exitFullscreen(); } catch (_) { /* 仍需退出辅助界面 */ }
      this.root.remove(); document.body.style.overflow = this.previousOverflow; this.lastFocus?.focus?.();
    }
  }
  function open(options) {
    if (!options?.result?.ok || !options.project) return false;
    if (activeGuide?.active) return true;
    try {
      Q.assertInvariant(options.project, options.result.plates, options.result.expected);
      const plate = options.result.plates[options.plateIndex || 0]; if (!plate) return false;
      const steps = Q.stepsFor(plate, options.project); if (!steps.some(step => step.wells.length)) return false;
      const assigned = new Set(plate.wells.map(w => w.well));
      for (const step of steps) for (const well of G.highlightWells(step, options.project.plateType)) if (!assigned.has(well)) throw new Error('加样步骤存在未分配孔位。');
      activeGuide = new TabletGuide(options); activeGuide.mount(); return true;
    } catch (error) { if (activeGuide) { const failed = activeGuide; activeGuide = null; failed.close().catch(() => {}); } console.error('平板加样辅助无法打开', error); return false; }
  }
  function close() { if (!activeGuide) return; const guide = activeGuide; activeGuide = null; return guide.close(); }
  window.QPCRTabletGuide = { open, close, isOpen: () => !!activeGuide?.active };
})();
