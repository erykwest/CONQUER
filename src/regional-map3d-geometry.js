'use strict';
// Visual-only tessellation and heightfield for the isolated regional map experiment.
// Never changes regional territory IDs, adjacency, pathfinding, rivers, or saves.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ConquerRegion3DGeometry = api;
})(typeof window === 'undefined' ? null : window, function() {
  const EPS = 1e-7;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function rng(seed) {
    let t = seed >>> 0;
    return function() {
      t += 0x6D2B79F5;
      let v = Math.imul(t ^ t >>> 15, 1 | t);
      v ^= v + Math.imul(v ^ v >>> 7, 61 | v);
      return ((v ^ v >>> 14) >>> 0) / 4294967296;
    };
  }
  function area(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) {
      const u = p[i], v = p[(i + 1) % p.length];
      a += u.x * v.y - v.x * u.y;
    }
    return Math.abs(a) * .5;
  }
  function centroid(p) {
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < p.length; i++) {
      const u = p[i], v = p[(i + 1) % p.length], cross = u.x * v.y - v.x * u.y;
      a += cross; x += (u.x + v.x) * cross; y += (u.y + v.y) * cross;
    }
    if (Math.abs(a) < EPS) return { x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length };
    return { x: x / (3 * a), y: y / (3 * a) };
  }
  function clip(p, a, b, c) {
    const result = [];
    for (let i = 0; i < p.length; i++) {
      const u = p[i], v = p[(i + 1) % p.length];
      const du = a * u.x + b * u.y - c, dv = a * v.x + b * v.y - c;
      const insideU = du <= EPS, insideV = dv <= EPS;
      if (insideU !== insideV) {
        const t = clamp(du / (du - dv), 0, 1);
        result.push({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });
      }
      if (insideV) result.push(v);
    }
    return result.filter((q, i) => {
      const prev = result[(i + result.length - 1) % result.length];
      return (q.x - prev.x) ** 2 + (q.y - prev.y) ** 2 > EPS * EPS;
    });
  }
  // Uniform sampling of a convex polygon by area-weighted triangle fans.
  function sample(p, random) {
    const triangles = [], anchor = p[0];
    let total = 0;
    for (let i = 1; i < p.length - 1; i++) {
      const b = p[i], c = p[i + 1];
      const size = Math.abs((b.x - anchor.x) * (c.y - anchor.y) - (b.y - anchor.y) * (c.x - anchor.x)) * .5;
      if (size > EPS) { total += size; triangles.push({ b, c, end: total }); }
    }
    if (!triangles.length) return centroid(p);
    const n = random() * total;
    const t = triangles.find(t => n <= t.end) || triangles[triangles.length - 1];
    const r = Math.sqrt(random()), s = random();
    return { x: (1 - r) * anchor.x + r * (1 - s) * t.b.x + r * s * t.c.x,
             y: (1 - r) * anchor.y + r * (1 - s) * t.b.y + r * s * t.c.y };
  }
  function cellsForSites(polygon, sites) {
    return sites.map((site, i) => {
      let poly = polygon;
      for (let j = 0; j < sites.length && poly.length >= 3; j++) {
        if (i === j) continue;
        const other = sites[j];
        poly = clip(poly, 2 * (other.x - site.x), 2 * (other.y - site.y),
          other.x * other.x + other.y * other.y - site.x * site.x - site.y * site.y);
      }
      return poly.length >= 3 && area(poly) > EPS ? poly : [];
    });
  }
  function subdivide(polygon, count, seed) {
    count = clamp(Math.trunc(Number(count)) || 1, 1, 40);
    if (count === 1) return [polygon];
    const random = rng(seed);
    let sites = Array.from({ length: count }, () => sample(polygon, random));
    // One Lloyd pass improves evenness without any cross-territory Voronoi comparisons.
    const first = cellsForSites(polygon, sites);
    sites = sites.map((site, i) => first[i].length ? centroid(first[i]) : site);
    return cellsForSites(polygon, sites).filter(p => p.length >= 3);
  }
  function edgeDistance(p, poly) {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
    }
    return best;
  }
  function elevation(p, polygon, type, seed) {
    if (type === 'sea' || type === 'lake') return -1.8;
    const t = clamp(edgeDistance(p, polygon) / 4.6, 0, 1);
    const fade = t * t * (3 - 2 * t);
    const wave = Math.sin(p.x * .082 + seed * .01) * Math.cos(p.y * .076 - seed * .017);
    const w2 = Math.sin(p.x * .15 + p.y * .092 + seed * .027);
    const base = type === 'hills' ? 4.9 : type === 'forest' ? 1.35 : type === 'swamp' ? .42 : .78;
    const range = type === 'hills' ? 3.8 : type === 'forest' ? .85 : .45;
    return Math.max(0, fade * (base + wave * range + w2 * range * .37));
  }
  const PALETTE = {
    plain: [185, 170, 119], forest: [64, 91, 59], hills: [128, 116, 99],
    swamp: [93, 109, 85], sea: [45, 88, 107], lake: [64, 111, 126],
    campaign: [192, 172, 118]
  };
  function buildScene(snapshot, detail) {
    if (!snapshot || !Array.isArray(snapshot.cells) || !snapshot.terrain) throw Error('Invalid world snapshot');
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const vertices = [], trees = [], peaks = [];
    let subcells = 0, triangles = 0, mountains = 0;
    function face(a, b, c, rgb, variation) {
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const nx = u.y * v.z - u.z * v.y, ny = u.z * v.x - u.x * v.z, nz = u.x * v.y - u.y * v.x;
      const norm = Math.hypot(nx, ny, nz) || 1;
      const light = clamp(.79 + (.34 * Math.abs(nz) + .23 * nx - .18 * ny) / norm + variation, .42, 1.23);
      const cr = clamp(rgb[0] * light / 255, 0, 1), cg = clamp(rgb[1] * light / 255, 0, 1), cb = clamp(rgb[2] * light / 255, 0, 1);
      for (const p of [a, b, c]) vertices.push(p.x, p.y, p.z, cr, cg, cb);
      triangles++;
    }
    for (const cell of snapshot.cells) {
      const poly = cell.polygon;
      if (!poly || poly.length < 3) continue;
      const terrain = snapshot.terrain[cell.macroId] || 'plain';
      const shade = PALETTE[terrain] || PALETTE.plain;
      const random = rng((snapshot.seed ^ Math.imul(cell.macroId + 1, 2654435761)) >>> 0);
      const parts = subdivide(poly, detail, (snapshot.seed ^ Math.imul(cell.id + 1, 2246822519)) >>> 0);
      subcells += parts.length;
      for (const p of parts) {
        const center = centroid(p);
        const cz = elevation(center, poly, terrain, snapshot.seed);
        const tone = (random() - .5) * .09;
        const middle = { ...center, z: cz };
        for (let i = 0; i < p.length; i++) {
          const a = p[i], b = p[(i + 1) % p.length];
          face(middle, { ...a, z: elevation(a, poly, terrain, snapshot.seed) },
            { ...b, z: elevation(b, poly, terrain, snapshot.seed) }, shade, tone);
        }
      }
      if (terrain === 'hills') {
        // Real low-poly cone meshes, separate from the fine relief tessellation.
        const count = area(poly) > 110 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          let center = centroid(poly);
          for (let attempt = 0; attempt < 12; attempt++) {
            const candidate = sample(poly, random);
            if (edgeDistance(candidate, poly) > 4) { center = candidate; break; }
          }
          const radius = Math.min(8, Math.max(2.5, edgeDistance(center, poly) * .76));
          const baseZ = elevation(center, poly, terrain, snapshot.seed);
          const height = 8 + random() * 15;
          const apex = { x: center.x + (random() - .5) * radius * .25,
                         y: center.y + (random() - .5) * radius * .25, z: baseZ + height };
          const sides = 9;
          const color = [130 + random() * 15, 124 + random() * 12, 113 + random() * 10];
          for (let i = 0; i < sides; i++) {
            const a = i * Math.PI * 2 / sides, b = (i + 1) * Math.PI * 2 / sides;
            face({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius, z: baseZ },
                 { x: center.x + Math.cos(b) * radius, y: center.y + Math.sin(b) * radius, z: baseZ },
                 apex, color, (random() - .5) * .17);
          }
          peaks.push({ ...apex, radius });
          mountains++;
        }
      } else if (terrain === 'forest' || terrain === 'swamp') {
        const count = terrain === 'forest' ? 3 + Math.floor(random() * 5) : 1 + Math.floor(random() * 3);
        for (let k = 0; k < count; k++) {
          const p = sample(poly, random);
          trees.push({ x: p.x, y: p.y, z: elevation(p, poly, terrain, snapshot.seed),
                       variant: Math.floor(random() * 7), size: 5.8 + random() * 4.3 });
        }
      }
    }
    // Follow the World Lab's real impassable ridge edges; avoid inventing new topology.
    const handPlaced = new Set(snapshot.mountainRanges || []);
    const generated = new Set(snapshot.automaticMountainEdges || []);
    for (const edge of snapshot.edges || []) {
      const ids = edge.macroIds || [];
      const pair = ids.length === 2 ? ids.slice().sort((a, b) => a - b).join('-') : '';
      const one = edge.start.x.toFixed(3) + ',' + edge.start.y.toFixed(3);
      const two = edge.end.x.toFixed(3) + ',' + edge.end.y.toFixed(3);
      const key = one < two ? one + '|' + two : two + '|' + one;
      if (!handPlaced.has(pair) && !generated.has(key)) continue;
      const dx = edge.end.x - edge.start.x, dy = edge.end.y - edge.start.y;
      const length = Math.hypot(dx, dy);
      const count = Math.max(1, Math.min(6, Math.round(length / 27)));
      const random = rng((snapshot.seed ^ Math.imul(ids[0] + 1, 12582917) ^ Math.round(length * 31)) >>> 0);
      for (let index = 0; index < count; index++) {
        const t = (index + .5 + (random() - .5) * .28) / count;
        const x = edge.start.x + dx * t, y = edge.start.y + dy * t;
        const r = 2.9 + random() * 3.2, top = 7 + random() * 9, sides = 7;
        const apex = { x: x + (random() - .5) * 2, y: y + (random() - .5) * 2, z: top };
        for (let k = 0; k < sides; k++) {
          const a = k * Math.PI * 2 / sides, b = (k + 1) * Math.PI * 2 / sides;
          face({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: 0 },
               { x: x + Math.cos(b) * r, y: y + Math.sin(b) * r, z: 0 },
               apex, [139, 132, 122], (random() - .5) * .14);
        }
        mountains++;
      }
    }
    return {
      vertices: new Float32Array(vertices), trees, peaks,
      stats: { territories: snapshot.cells.length, subcells, triangles, mountains,
               trees: trees.length, floats: vertices.length,
               generationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 }
    };
  }
  return { area, centroid, clip, subdivide, edgeDistance, elevation, buildScene };
});
