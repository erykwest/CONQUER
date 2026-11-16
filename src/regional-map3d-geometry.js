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

  // Visual map pipeline inspired by Mapgen4's dense-mesh-first approach.
  // 1. Global jittered triangular-site Voronoi mesh (nearby candidates only).
  // 2. Assign microcells to the canonical macro territories through a smooth warp.
  // 3. Render the resulting aggregates and derive their *actual* shared borders.
  // This does not mutate the authoritative World Lab topology or saves.
  function sourceColor(value) {
    const hex = /^#([0-9a-f]{6})$/i.exec(String(value || ''));
    if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16));
    const hsl = /^hsl\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*\)$/i.exec(String(value || ''));
    if (hsl) {
      const h = (Number(hsl[1]) % 360 + 360) % 360, sat = Number(hsl[2]) / 100, light = Number(hsl[3]) / 100;
      const chroma = (1 - Math.abs(2 * light - 1)) * sat;
      const x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = light - chroma / 2;
      const v = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] :
                h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] :
                h < 300 ? [x, 0, chroma] : [chroma, 0, x];
      return v.map(n => Math.round((n + m) * 255));
    }
    throw Error('Missing or unsupported authoritative 2D fill: ' + value);
  }

  function hashed(x, y, seed) {
    let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
  }
  function noise(x, y, seed) {
    const i = Math.floor(x), j = Math.floor(y);
    let u = x - i, v = y - j;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    const a = hashed(i, j, seed), b = hashed(i + 1, j, seed);
    const c = hashed(i, j + 1, seed), d = hashed(i + 1, j + 1, seed);
    return 2 * ((a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v) - 1;
  }
  function warpPoint(p, spacing, deformation, seed) {
    const power = clamp(deformation, 0, 1);
    if (!power) return p;
    const broad = spacing * 5.8, fine = spacing * 2.3;
    const amp = spacing * 3.1 * power;
    return {
      x: p.x + amp * (0.77 * noise(p.x / broad, p.y / broad, seed ^ 0x71e31)
                   + 0.23 * noise(p.x / fine, p.y / fine, seed ^ 0x91c42)),
      y: p.y + amp * (0.77 * noise(p.x / broad, p.y / broad, seed ^ 0x7cb19)
                   + 0.23 * noise(p.x / fine, p.y / fine, seed ^ 0x28ab3))
    };
  }
  function pointInPolygon(point, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > point.y) !== (b.y > point.y) &&
          point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function macroIndex(snapshot) {
    const bucketSize = 128, bins = new Map(), macros = [];
    for (const cell of snapshot.cells) {
      const poly = cell.polygon;
      if (!poly?.length) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of poly) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      const entry = {id:cell.macroId, polygon:poly, center:centroid(poly), box:[x0,y0,x1,y1]};
      macros.push(entry);
      for (let y=Math.floor(y0/bucketSize);y<=Math.floor(y1/bucketSize);y++) {
        for (let x=Math.floor(x0/bucketSize);x<=Math.floor(x1/bucketSize);x++) {
          const key=x+','+y;
          if (!bins.has(key)) bins.set(key, []);
          bins.get(key).push(entry);
        }
      }
    }
    function owner(p) {
      const candidates = bins.get(Math.floor(p.x/bucketSize)+','+Math.floor(p.y/bucketSize)) || [];
      for (const entry of candidates) {
        const [x0,y0,x1,y1] = entry.box;
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && pointInPolygon(p, entry.polygon))
          return entry.id;
      }
      // Outside the finite map or on a shared floating-point edge: choose nearest.
      // The nearest-centroid fallback stays deterministic.
      let best = null, bestD = Infinity;
      const pool = candidates.length ? candidates : macros;
      for (const entry of pool) {
        const d = (p.x-entry.center.x)**2 + (p.y-entry.center.y)**2;
        if (d < bestD) { best=entry; bestD=d; }
      }
      return best?.id ?? null;
    }
    return owner;
  }
  function globalMicrocells(snapshot, detail, deformation) {
    const width=snapshot.width, height=snapshot.height;
    const totalTarget = snapshot.cells.length * detail;
    // Triangular lattice, jittered for irregular Voronoi cells, not a square grid.
    const spacing = Math.sqrt(width * height / (totalTarget * Math.sqrt(3) / 2));
    const rowStep = spacing * Math.sqrt(3)/2, jitter = spacing * .19;
    const rows = Math.ceil(height / rowStep) + 5, cols = Math.ceil(width / spacing) + 5;
    const sites = new Map();
    const seed=snapshot.seed>>>0;
    const key=(row,col)=>row+','+col;
    for (let row=-2;row<rows;row++) for(let col=-2;col<cols;col++) {
      const rnd=rng((seed ^ Math.imul(row+5003, 2654435761) ^ Math.imul(col+4001, 2246822519))>>>0);
      sites.set(key(row,col),{
        x:(col+(row&1)*.5)*spacing+(rnd()-.5)*2*jitter,
        y:row*rowStep+(rnd()-.5)*2*jitter,
        row,col
      });
    }
    const locate = macroIndex(snapshot), parts=[], ownerParts=new Map();
    const parent = new Map(snapshot.cells.map(c=>[c.macroId,c.polygon]));
    const originalRect=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
    for (const site of sites.values()) {
      if (site.x < -spacing || site.y < -spacing ||
          site.x > width+spacing || site.y > height+spacing) continue;
      let poly=originalRect;
      // With <19% jitter and a triangular lattice the nearest possible site
      // is within a two-ring neighbourhood, keeping complexity O(microcells).
      for (let y=site.row-2; y<=site.row+2 && poly.length>=3; y++) {
        for (let x=site.col-2; x<=site.col+2 && poly.length>=3; x++) {
          if (site.row===y && site.col===x) continue;
          const other=sites.get(key(y,x));
          if (!other) continue;
          poly=clip(poly,2*(other.x-site.x),2*(other.y-site.y),
             other.x**2+other.y**2-site.x**2-site.y**2);
        }
      }
      if (poly.length<3 || area(poly)<EPS) continue;
      const warped=warpPoint(site,spacing,deformation,seed);
      let macroId=locate(warped);
      if (macroId===null) macroId=locate(site);
      if (!parent.has(macroId)) continue;
      const part={polygon:poly,macroId};
      parts.push(part);
      if (!ownerParts.has(macroId)) ownerParts.set(macroId, []);
      ownerParts.get(macroId).push(part);
    }
    return {parts,ownerParts,spacing};
  }
  function aggregateEdges(parts, terrain, originalCells) {
    const edges=new Map(), borders=[], coastlines=[];
    const round=p=>Math.round(p*100)/100;
    const pkey=p=>round(p.x)+','+round(p.y);
    for (const part of parts) {
      const poly=part.polygon;
      for (let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length];
        const aa=pkey(a),bb=pkey(b);
        if (aa===bb) continue;
        const key=aa<bb?aa+'|'+bb:bb+'|'+aa;
        if (edges.has(key)) {
          const prev=edges.get(key);edges.delete(key);
          if (prev.macroId===part.macroId) continue;
          const edge={start:a,end:b,macroIds:[prev.macroId,part.macroId]};
          borders.push(edge);
          const isWater=id=>terrain[id]==='sea'||terrain[id]==='lake';
          if (isWater(prev.macroId)!==isWater(part.macroId)) coastlines.push(edge);
        } else edges.set(key,{start:a,end:b,macroId:part.macroId});
      }
    }
    // Domain exterior is an outline. It isn't a coastline unless land meets water.
    for (const e of edges.values()) borders.push({...e,macroIds:[e.macroId]});
    return {borders,coastlines,unmatched:edges.size};
  }
  function weightedSample(parts, random) {
    let total=0;
    for(const part of parts) total+=part.weight??(part.weight=area(part.polygon));
    let n=random()*total;
    for (const part of parts) {
      n-=part.weight;
      if (n<=0) return sample(part.polygon,random);
    }
    return sample(parts[parts.length-1].polygon,random);
  }
  function buildScene(snapshot, detail, deformation=.65) {
    if (!snapshot || !Array.isArray(snapshot.cells) || !snapshot.terrain || !snapshot.fills)
      throw Error('Invalid 3D snapshot: authoritative 2D territory fills are required');
    const t0=typeof performance!=='undefined'?performance.now():Date.now();
    detail=clamp(Math.trunc(Number(detail))||20,1,40);
    deformation=clamp(Number(deformation)||0,0,1);
    const vertices=[],trees=[],reeds=[],peaks=[],pickRanges=[];
    let subcells=0,triangles=0,mountains=0;
    function face(a,b,c,rgb,variation=0,shaded=true) {
      const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
      const v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
      const nx=u.y*v.z-u.z*v.y,ny=u.z*v.x-u.x*v.z,nz=u.x*v.y-u.y*v.x;
      const norm=Math.hypot(nx,ny,nz)||1;
      const light=shaded?clamp(.79+(.34*Math.abs(nz)+.23*nx-.18*ny)/norm+variation,.42,1.23):1;
      const cr=clamp(rgb[0]*light/255,0,1),cg=clamp(rgb[1]*light/255,0,1),cb=clamp(rgb[2]*light/255,0,1);
      for(const p of [a,b,c])vertices.push(p.x,p.y,p.z,cr,cg,cb);
      triangles++;
    }
    const base = detail===1 ? {
      parts:snapshot.cells.map(c=>({macroId:c.macroId,polygon:c.polygon})),
      ownerParts:new Map(snapshot.cells.map(c=>[c.macroId,[{polygon:c.polygon,macroId:c.macroId}]])),
      spacing:Math.sqrt(snapshot.width*snapshot.height/snapshot.cells.length)
    } : globalMicrocells(snapshot,detail,deformation);
    const byMacro=new Map(snapshot.cells.map(c=>[c.macroId,c.polygon]));
    const rgbCache=new Map();
    for(const part of base.parts) {
      const poly=part.polygon;
      if(!poly||poly.length<3)continue;
      const terrain=snapshot.terrain[part.macroId]||'plain';
      if(!rgbCache.has(part.macroId))rgbCache.set(part.macroId,sourceColor(snapshot.fills[part.macroId]));
      const shade=rgbCache.get(part.macroId);
      const center=centroid(poly);
      const parent=byMacro.get(part.macroId)||poly;
      const centerZ=elevation(center,parent,terrain,snapshot.seed);
      const middle={...center,z:centerZ};
      const firstVertex=vertices.length/6;
      subcells++;
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        face(middle,{...a,z:elevation(a,parent,terrain,snapshot.seed)},
          {...b,z:elevation(b,parent,terrain,snapshot.seed)},shade,0,false);
      }
      // Terrain triangles only; subsequent mountains are deliberately not selectable.
      pickRanges.push({macroId:part.macroId,firstVertex,vertexCount:vertices.length/6-firstVertex});
    }
    for(const cell of snapshot.cells) {
      const poly=cell.polygon,terrain=snapshot.terrain[cell.macroId]||'plain';
      const owned=base.ownerParts.get(cell.macroId);
      if(!owned?.length)continue;
      const random=rng((snapshot.seed ^ Math.imul(cell.macroId+1,2654435761))>>>0);
      if(terrain==='forest') {
        // Original prototype: 3..7 tiny trees per territory, size 5.8..10.1.
        // Requested: >=10x population and 5x sprite size.
        const count=30+Math.floor(random()*41);
        for(let i=0;i<count;i++){
          const p=weightedSample(owned,random);
          trees.push({macroId:cell.macroId,x:p.x,y:p.y,z:elevation(p,poly,terrain,snapshot.seed),
                      variant:Math.floor(random()*7),size:5*(5.8+random()*4.3)});
        }
      } else if(terrain==='swamp'){
        // Use the actual Builder reedBed/reedClump meshes as projected billboards.
        const count=10+Math.floor(random()*21);
        for(let i=0;i<count;i++){
          const p=weightedSample(owned,random);
          reeds.push({macroId:cell.macroId,x:p.x,y:p.y,z:elevation(p,poly,terrain,snapshot.seed),
                      variant:Math.floor(random()*2),size:5*(5.8+random()*4.3)});
        }
      } else if(terrain==='hills'){
        const count=area(poly)>110?2:1;
        for(let k=0;k<count;k++){
          const center=weightedSample(owned,random);
          const radius=Math.min(8,Math.max(2.5,edgeDistance(center,poly)*.76));
          const baseZ=elevation(center,poly,terrain,snapshot.seed);
          const apex={x:center.x+(random()-.5)*radius*.25,
                      y:center.y+(random()-.5)*radius*.25,z:baseZ+8+random()*15};
          const shade=rgbCache.get(cell.macroId)||sourceColor(snapshot.fills[cell.macroId]);
          const sides=9;
          for(let i=0;i<sides;i++){
            const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;
            face({x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius,z:baseZ},
                 {x:center.x+Math.cos(b)*radius,y:center.y+Math.sin(b)*radius,z:baseZ},
                 apex,shade,(random()-.5)*.17);
          }
          peaks.push({...apex,radius});
          mountains++;
        }
      }
    }
    // Existing mountain barriers remain part of the authoritative gameplay layer.
    const handPlaced=new Set(snapshot.mountainRanges||[]);
    const generated=new Set(snapshot.automaticMountainEdges||[]);
    for(const edge of snapshot.edges||[]){
      const ids=edge.macroIds||[];
      const pair=ids.length===2?ids.slice().sort((a,b)=>a-b).join('-'):'';
      const one=edge.start.x.toFixed(3)+','+edge.start.y.toFixed(3);
      const two=edge.end.x.toFixed(3)+','+edge.end.y.toFixed(3);
      const key=one<two?one+'|'+two:two+'|'+one;
      if(!handPlaced.has(pair)&&!generated.has(key))continue;
      const dx=edge.end.x-edge.start.x,dy=edge.end.y-edge.start.y;
      const length=Math.hypot(dx,dy),count=Math.max(1,Math.min(6,Math.round(length/27)));
      const random=rng((snapshot.seed ^ Math.imul((ids[0]||0)+1,12582917) ^ Math.round(length*31))>>>0);
      for(let index=0;index<count;index++){
        const t=(index+.5+(random()-.5)*.28)/count;
        const x=edge.start.x+dx*t,y=edge.start.y+dy*t;
        const r=2.9+random()*3.2,top=7+random()*9,sides=7;
        const apex={x:x+(random()-.5)*2,y:y+(random()-.5)*2,z:top};
        for(let k=0;k<sides;k++){
          const a=k*Math.PI*2/sides,b=(k+1)*Math.PI*2/sides;
          face({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,z:0},
               {x:x+Math.cos(b)*r,y:y+Math.sin(b)*r,z:0},
               apex,[139,132,122],(random()-.5)*.14);
        }
        mountains++;
      }
    }
    const {borders,coastlines,unmatched}=aggregateEdges(base.parts,snapshot.terrain,snapshot.cells);
    return{
      vertices:new Float32Array(vertices),pickRanges,trees,reeds,peaks,borders,coastlines,
      stats:{territories:snapshot.cells.length,subcells,triangles,mountains,
             trees:trees.length,reeds:reeds.length,unmatchedEdges:unmatched,
             floats:vertices.length,generationMs:(typeof performance!=='undefined'?performance.now():Date.now())-t0}
    };
  }
  // Project the *same mesh triangles rendered by WebGL* and select the frontmost
  // matching canonical macro ID. Works with warped global microcells, any pan,
  // azimuth, zoom and the Builder's fixed isometric camera. Never selects by the
  // old 2D polygons, so the click follows the new visual boundary exactly.
  function pickTerritory(scene,camera,pixelX,pixelY) {
    if (!scene?.pickRanges?.length || !scene.vertices || !camera ||
        !Number.isFinite(pixelX) || !Number.isFinite(pixelY)) return null;
    const v=scene.vertices;
    const c=camera, xcos=c.cos, xsin=c.sin, scale=c.scale;
    const px=camera.width/2+(camera.panX||0);
    const py=camera.height/2+(camera.panY||0);
    const hitVertex=index=>{
      const off=index*6, dx=v[off]-c.cx, dy=v[off+1]-c.cy;
      const qx=dx*xcos-dy*xsin, qy=dx*xsin+dy*xcos, z=v[off+2];
      return {x:px+(qx-qy)*.8660254*scale,
              y:py+((qx+qy)*.5-z*.9)*scale,
              depth:qx+qy+z*.9};
    };
    const within=(a,b,c)=>{
      const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
      if(Math.abs(denominator)<1e-9)return null;
      const u=((b.y-c.y)*(pixelX-c.x)+(c.x-b.x)*(pixelY-c.y))/denominator;
      if(u < -1e-6 || u > 1+1e-6)return null;
      const w=((c.y-a.y)*(pixelX-c.x)+(a.x-c.x)*(pixelY-c.y))/denominator;
      if(w < -1e-6 || u+w > 1+1e-6)return null;
      return u*a.depth+w*b.depth+(1-u-w)*c.depth;
    };
    let best=-Infinity, selected=null;
    for(const range of scene.pickRanges){
      for(let i=range.firstVertex;i<range.firstVertex+range.vertexCount;i+=3){
        const a=hitVertex(i),b=hitVertex(i+1),c=hitVertex(i+2);
        if(pixelX<Math.min(a.x,b.x,c.x)-.001 || pixelX>Math.max(a.x,b.x,c.x)+.001 ||
           pixelY<Math.min(a.y,b.y,c.y)-.001 || pixelY>Math.max(a.y,b.y,c.y)+.001)continue;
        const depth=within(a,b,c);
        if(depth!==null && depth>best){best=depth;selected=range.macroId;}
      }
    }
    return selected;
  }
  return {area,centroid,clip,subdivide,edgeDistance,elevation,sourceColor,
          pickTerritory,
          globalMicrocells,aggregateEdges,buildScene};
});
