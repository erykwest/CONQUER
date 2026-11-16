'use strict';
// Urban heatmaps skeleton: isolated, deterministic, read-only relative to game State.
// Four conceptual maps: demand (L1-L4 channels), prestige, security and crime.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ConquerUrbanHeatmaps = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const TIERS = Object.freeze([1, 2, 3, 4]);
  const CHANNELS = Object.freeze(['demandL1', 'demandL2', 'demandL3', 'demandL4', 'prestige', 'security', 'crime']);
  const BASE = Object.freeze({demandL1: .04, demandL2: .04, demandL3: .04, demandL4: .04,
    prestige: .3, security: .2, crime: .05});
  // Illustrative coefficients only: balancing is NOT part of this skeleton.
  const LANDMARKS = Object.freeze({
    plaza:       {prestige: .65, demandL1: .16, demandL2: .23, demandL3: .30, demandL4: .18},
    market:      {prestige: .15, demandL1: .22, demandL2: .36, demandL3: .46, demandL4: .08},
    workplace:   {prestige: -.12, demandL1: .58, demandL2: .14, demandL3: .06},
    workshop:    {prestige: -.08, demandL1: .08, demandL2: .55, demandL3: .15},
    civic:       {prestige: .35, demandL2: .08, demandL3: .55, demandL4: .12},
    castle:      {prestige: .58, security: .42, demandL3: .08, demandL4: .45},
    garden:      {prestige: .5, demandL3: .12, demandL4: .32},
    industry:    {prestige: -.68, demandL1: .43, demandL2: .24, demandL3: -.12, demandL4: -.34},
    road:        {demandL1: .12, demandL2: .19, demandL3: .12, demandL4: .04},
    guard:       {security: .75},
    protected:   {security: .65}, // Optional polygon: use for real inside-the-walls regions.
    crimeEvent:  {crime: .85}
  });
  const clamp = v => Math.max(0, Math.min(1, v));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  function insidePolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > y) !== (b.y > y) &&
          x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function influence(source, x, y) {
    if (!source || !LANDMARKS[source.kind]) return 0;
    const strength = source.strength === undefined ? 1 : source.strength;
    if (!finite(strength) || strength < 0 || strength > 1) return 0;
    if (Array.isArray(source.polygon) && source.polygon.length >= 3) {
      if (!source.polygon.every(p => finite(p.x) && finite(p.y))) return 0;
      return insidePolygon(x, y, source.polygon) ? strength : 0;
    }
    const {x: sx, y: sy, radius} = source;
    if (!finite(sx) || !finite(sy) || !finite(radius) || radius <= 0) return 0;
    const distance = Math.hypot(x - sx, y - sy);
    const normalized = Math.max(0, 1 - distance / radius);
    return normalized * normalized * strength;
  }
  function at(x, y, sources = [], base = BASE) {
    if (!finite(x) || !finite(y)) throw new TypeError('finite sample coordinates required');
    if (!Array.isArray(sources)) throw new TypeError('sources must be an array');
    const raw = Object.fromEntries(CHANNELS.map(ch => [ch, finite(base[ch]) ? base[ch] : BASE[ch]]));
    for (const source of sources) {
      const profile = LANDMARKS[source?.kind];
      if (!profile) continue;
      const weight = influence(source, x, y);
      if (weight <= 0) continue;
      for (const [channel, delta] of Object.entries(profile)) raw[channel] += delta * weight;
    }
    // Security and crime stay distinct territorial channels; no circular update.
    const security = clamp(raw.security), crime = clamp(raw.crime);
    const prestige = clamp(raw.prestige - .18 * crime);
    const demand = TIERS.map((tier, i) => clamp(raw['demandL' + tier] +
      security * [.16, .18, .20, .26][i] -
      crime * [.25, .30, .39, .48][i] +
      prestige * [.03, .07, .18, .24][i]));
    return {demandL1: demand[0], demandL2: demand[1], demandL3: demand[2],
      demandL4: demand[3], prestige, security, crime};
  }
  function createGrid({originX = 0, originY = 0, cellSize = 4, width = 50, height = 50,
    sources = [], base = BASE} = {}) {
    if (![originX, originY, cellSize, width, height].every(finite) ||
        cellSize <= 0 || !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 || width * height > 65536) {
      throw new RangeError('invalid heatmap grid dimensions');
    }
    const values = Object.fromEntries(CHANNELS.map(channel =>
      [channel, new Float32Array(width * height)]));
    for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
      const sample = at(originX + (cx + .5) * cellSize,
        originY + (cy + .5) * cellSize, sources, base);
      for (const channel of CHANNELS) values[channel][cy * width + cx] = sample[channel];
    }
    return {originX, originY, cellSize, width, height, values};
  }
  function sample(grid, x, y) {
    if (!grid || !grid.values || !finite(x) || !finite(y)) return null;
    const px = Math.max(0, Math.min(grid.width - 1, (x - grid.originX) / grid.cellSize - .5));
    const py = Math.max(0, Math.min(grid.height - 1, (y - grid.originY) / grid.cellSize - .5));
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const x1 = Math.min(grid.width - 1, x0 + 1), y1 = Math.min(grid.height - 1, y0 + 1);
    const tx = px - x0, ty = py - y0;
    const out = {};
    for (const channel of CHANNELS) {
      const arr = grid.values[channel];
      if (!arr) return null;
      const a = arr[y0 * grid.width + x0] * (1 - tx) + arr[y0 * grid.width + x1] * tx;
      const b = arr[y1 * grid.width + x0] * (1 - tx) + arr[y1 * grid.width + x1] * tx;
      out[channel] = a * (1 - ty) + b * ty;
    }
    return out;
  }
  function sampleLot(grid, lot) {
    const points = lot?.points;
    if (!Array.isArray(points) || points.length < 3 ||
        !points.every(p => finite(p.x) && finite(p.y))) return null;
    const center = points.reduce((sum, p) => ({x: sum.x + p.x / points.length,
      y: sum.y + p.y / points.length}), {x: 0, y: 0});
    const samples = [center, ...points].map(p => sample(grid, p.x, p.y));
    if (samples.some(s => s === null)) return null;
    return Object.fromEntries(CHANNELS.map(ch =>
      [ch, samples.reduce((sum, s) => sum + s[ch], 0) / samples.length]));
  }
  // Read-only proposal. Population queues/available homes are external authoritative inputs.
  // Do not call this to mutate lots, buildings, owners or residents.
  function evaluateLot(grid, lot, {waiting = {}, available = {}} = {}) {
    const fields = sampleLot(grid, lot);
    if (!fields) return null;
    const effective = TIERS.map(tier => {
      const wanted = Math.max(0, finite(waiting[tier]) ? waiting[tier] : 0);
      const spare = Math.max(0, finite(available[tier]) ? available[tier] : 0);
      const shortage = Math.max(0, wanted - spare);
      return fields['demandL' + tier] * (shortage / (shortage + 2));
    });
    const peak = Math.max(...effective), index = effective.indexOf(peak);
    const desiredTier = peak > 0 ? TIERS[index] : null;
    const targetDensity = peak >= .65 ? 3 : peak >= .30 ? 2 : 1;
    return {fields, effectiveDemand: Object.fromEntries(TIERS.map((tier, i) =>
      [tier, effective[i]])), desiredTier, targetDensity, action: 'preview-only'};
  }
  return Object.freeze({VERSION: 1, TIERS, CHANNELS, LANDMARKS, BASE,
    at, createGrid, sample, sampleLot, evaluateLot});
});
