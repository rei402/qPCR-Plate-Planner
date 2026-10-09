(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QPCRPlateColors = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const palettes = [
    { id: 'scientificSoft', name: '科研柔和', strength: 'soft', colors: ['#dceaf7', '#e6eaf7', '#e7f1ec', '#f1e9de', '#e8edf1', '#e9e6f0'], legacy: true },
    { id: 'natureSoft', name: 'Nature 柔和', strength: 'soft', colors: ['#719eb3', '#b38482', '#8baa88', '#b6a277', '#a594b5', '#78aaa3', '#c08eaa', '#8f9cac'] },
    { id: 'blueGreen', name: '蓝绿经典', strength: 'medium', colors: ['#1976a3', '#149287', '#4d87bd', '#39a877', '#326d93', '#69a6a1', '#567d79', '#52a7c2'] },
    { id: 'colorblind', name: '色觉友好', strength: 'medium', colors: ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#56b4e9', '#b59b00', '#774d90'] },
    { id: 'clearContrast', name: '清晰对比', strength: 'medium', colors: ['#2459a6', '#b34a58', '#26805c', '#a96a16', '#6c57a5', '#138a9f', '#9a4b83', '#637b26'] },
    { id: 'vividScience', name: '鲜明科研', strength: 'high', colors: ['#006dc7', '#df5d38', '#00a17b', '#a445b8', '#df9a00', '#d83e79', '#328bdf', '#639b19'] },
    { id: 'vividHigh', name: '高饱和实验', strength: 'high', colors: ['#005bd8', '#e44726', '#009f62', '#b92caa', '#dc8900', '#c92859', '#008cba', '#6c49c8'] }
  ];
  const controlStyles = {
    ntc: { primary: '#777f89', background: '#edf0f2', border: '#777f89', text: '#253446' },
    noRT: { primary: '#8c718d', background: '#f0ebf1', border: '#8c718d', text: '#253446' },
    positive: { primary: '#a96f40', background: '#f6eee6', border: '#a96f40', text: '#253446' },
    calibrator: { primary: '#697e72', background: '#eaf0eb', border: '#697e72', text: '#253446' }
  };
  const palette = id => palettes.find(p => p.id === id) || palettes[0];
  function tint(hex, whiteFraction) {
    const n = parseInt(hex.slice(1), 16);
    const channel = shift => Math.round(((n >> shift) & 255) * (1 - whiteFraction) + 255 * whiteFraction).toString(16).padStart(2, '0');
    return '#' + channel(16) + channel(8) + channel(0);
  }
  const identityCache = new Map();
  function variant(hex, round, slot = 0, attempt = 0) {
    if (!round) return hex;
    const n = parseInt(hex.slice(1), 16), rgb = [16, 8, 0].map(shift => ((n >> shift) & 255) / 255), max = Math.max(...rgb), min = Math.min(...rgb), d = max - min;
    let hue = d === 0 ? 0 : max === rgb[0] ? ((rgb[1] - rgb[2]) / d) % 6 : max === rgb[1] ? (rgb[2] - rgb[0]) / d + 2 : (rgb[0] - rgb[1]) / d + 4;
    hue = (hue * 60 + 360 + round * 29 + slot * round * 4.71 + attempt * 17.13) % 360;
    const saturation = 0.52 + (round % 3) * 0.08, light = 0.46 + (round % 4) * 0.055, chroma = (1 - Math.abs(2 * light - 1)) * saturation, x = chroma * (1 - Math.abs((hue / 60) % 2 - 1)), m = light - chroma / 2;
    const values = hue < 60 ? [chroma,x,0] : hue < 120 ? [x,chroma,0] : hue < 180 ? [0,chroma,x] : hue < 240 ? [0,x,chroma] : hue < 300 ? [x,0,chroma] : [chroma,0,x];
    return '#' + values.map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  function identityColor(index, paletteId, plateType) {
    const p = palette(paletteId), safe = Math.max(0, Math.floor(Number(index) || 0));
    if (!identityCache.has(p.id)) identityCache.set(p.id, [...p.colors]);
    const colors = identityCache.get(p.id);
    while (colors.length <= safe) {
      const i = colors.length, round = Math.floor(i / p.colors.length), slot = i % p.colors.length; let attempt = 0, color;
      do { color = variant(p.colors[slot], round, slot, attempt++); } while (colors.includes(color));
      colors.push(color);
    }
    const primary = colors[safe];
    if (p.legacy && safe < p.colors.length) return { primary, background: primary, border: '#87a3b8', text: '#183b63' };
    // On 384-well plates, a little more white limits the area of vivid color.
    const white = p.strength === 'high' ? (Number(plateType) === 384 ? 0.87 : 0.82) : p.strength === 'medium' ? 0.83 : 0.80;
    return { primary, background: tint(primary, white), border: primary, text: '#183b63', borderDash: ['', '3 2', '1 2', '5 2 1 2'][Math.floor(safe / p.colors.length) % 4] };
  }
  function wellColor(reaction, project) {
    if (reaction.type !== 'sample') return controlStyles[reaction.type] || controlStyles.ntc;
    const display = project.settings?.display || {}, by = display.colorBy === 'sample' ? 'sample' : 'target';
    const gene = project.genes.find(g => g.id === reaction.geneId);
    const index = by === 'sample' ? project.sampleMetadata?.[reaction.sample]?.colorIndex ?? project.samples.indexOf(reaction.sample) : gene?.colorIndex ?? project.genes.indexOf(gene);
    return identityColor(index, display.paletteId, project.plateType);
  }
  return { palettes, palette, identityColor, wellColor, controlStyles };
});
