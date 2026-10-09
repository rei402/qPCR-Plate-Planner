(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PLATE_DISPLAY_CONFIG = Object.freeze({
    96: Object.freeze({ wellWidth: 44, wellHeight: 44, horizontalGap: 4, verticalGap: 4, primaryFontSize: 12, secondaryFontSize: 9.5, rowHeaderSize: 12, columnHeaderSize: 12, strokeWidth: 1.3, borderRadius: 7, textOffset: [18, 33], marginX: 53, marginY: 44, plateMinWidth: 640 }),
    384: Object.freeze({ wellWidth: 36, wellHeight: 33, horizontalGap: 4, verticalGap: 4, primaryFontSize: 11, secondaryFontSize: 9.5, rowHeaderSize: 11, columnHeaderSize: 10.5, strokeWidth: 1.1, borderRadius: 5, textOffset: [13, 27], marginX: 48, marginY: 43, plateMinWidth: 1020 })
  });
  function plateDimensions(type) {
    const cfg = PLATE_DISPLAY_CONFIG[type], rows = type === 384 ? 16 : 8, cols = type === 384 ? 24 : 12;
    if (!cfg) throw new Error('孔板类型无效。');
    return { width: cfg.marginX + cols * (cfg.wellWidth + cfg.horizontalGap) + 12, height: cfg.marginY + rows * (cfg.wellHeight + cfg.verticalGap) + 12 };
  }
  function wellGeometry(type, row, column) {
    const cfg = PLATE_DISPLAY_CONFIG[type];
    if (!cfg) throw new Error('孔板类型无效。');
    const x = cfg.marginX + column * (cfg.wellWidth + cfg.horizontalGap) + cfg.horizontalGap / 2;
    const y = cfg.marginY + row * (cfg.wellHeight + cfg.verticalGap) + cfg.verticalGap / 2;
    return { x, y, width: cfg.wellWidth, height: cfg.wellHeight, centerX: x + cfg.wellWidth / 2, primaryY: y + cfg.textOffset[0], secondaryY: y + cfg.textOffset[1] };
  }
  function printLayout(type, orientation = 'landscape') {
    if (![96, 384].includes(Number(type)) || !['landscape', 'portrait'].includes(orientation)) throw new Error('打印配置无效。');
    return {
      type: Number(type), orientation,
      pageSize: 'A4 ' + orientation,
      marginMm: orientation === 'portrait' && Number(type) === 384 ? 5 : 8,
      className: 'print-' + type + ' print-' + orientation,
      layout: orientation === 'portrait' ? 'stacked' : Number(type) === 384 ? 'wide-map' : 'side-map'
    };
  }
  function printPageRule(type, orientation) {
    const spec = printLayout(type, orientation);
    return '@page { size: ' + spec.pageSize + '; margin: ' + spec.marginMm + 'mm; }';
  }
  function checklistItem(item, wells) {
    const applicable = item !== 'NTC 已最后加入' || wells.some(well => well.type === 'ntc');
    return { applicable, label: applicable ? item : item + '（不适用：本板无 NTC）' };
  }
  return { PLATE_DISPLAY_CONFIG, plateDimensions, wellGeometry, printLayout, printPageRule, checklistItem };
});
