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
    owner.candidatesForBox=(minX,minY,maxX,maxY)=>{
      const found=new Map();
      for(let y=Math.floor(minY/bucketSize);y<=Math.floor(maxY/bucketSize);y++)
        for(let x=Math.floor(minX/bucketSize);x<=Math.floor(maxX/bucketSize);x++)
          for(const entry of bins.get(x+','+y)||[]){
            const box=entry.box;
            if(box[0]<=maxX&&box[2]>=minX&&box[1]<=maxY&&box[3]>=minY)
              found.set(entry.id,entry);
          }
      return [...found.values()];
    };
    return owner;
  }
  function globalMicrocells(snapshot, detail, deformation) {
    const width=snapshot.width, height=snapshot.height;
    const totalTarget = snapshot.cells.length * detail;
    // Weighted Voronoi (power diagram): the site count stays constant while
    // seeded jitter plus a small per-site power lets some microcells occupy
    // approximately twice the former area and others shrink to compensate.
    // This changes only visual polygons, never the authoritative macro grid.
    const spacing = Math.sqrt(width * height / (totalTarget * Math.sqrt(3) / 2));
    const rowStep = spacing * Math.sqrt(3)/2;
    const jitter = spacing * .30;
    const powerSpread = spacing * spacing * .35;
    const rows = Math.ceil(height / rowStep) + 5, cols = Math.ceil(width / spacing) + 5;
    const sites = new Map();
    const seed=snapshot.seed>>>0;
    const key=(row,col)=>row+','+col;
    for (let row=-2;row<rows;row++) for(let col=-2;col<cols;col++) {
      const rnd=rng((seed ^ Math.imul(row+5003, 2654435761) ^ Math.imul(col+4001, 2246822519))>>>0);
      sites.set(key(row,col),{
        x:(col+(row&1)*.5)*spacing+(rnd()-.5)*2*jitter,
        y:row*rowStep+(rnd()-.5)*2*jitter,
        power:(rnd()-.5)*powerSpread,
        row,col
      });
    }
    const locate=macroIndex(snapshot),fragments=[],ownerParts=new Map();
    const originalRect=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
    let siteCount=0;
    for(const site of sites.values()){
      if(site.x < -spacing||site.y < -spacing||
         site.x > width+spacing||site.y > height+spacing)continue;
      let poly=originalRect;
      for(let y=site.row-2;y<=site.row+2&&poly.length>=3;y++){
        for(let x=site.col-2;x<=site.col+2&&poly.length>=3;x++){
          if(site.row===y&&site.col===x)continue;
          const other=sites.get(key(y,x));
          if(!other)continue;
          poly=clip(poly,2*(other.x-site.x),2*(other.y-site.y),
            other.x**2+other.y**2-site.x**2-site.y**2+site.power-other.power);
        }
      }
      if(poly.length<3||area(poly)<EPS)continue;
      siteCount++;
      const x0=Math.min(...poly.map(p=>p.x)),x1=Math.max(...poly.map(p=>p.x));
      const y0=Math.min(...poly.map(p=>p.y)),y1=Math.max(...poly.map(p=>p.y));
      // Intersect each fine cell with the actual balanced canonical territory
      // polygons. A site near a macro border can produce several fragments;
      // their combined areas still add up to the unmodified cell's area.
      for(const macro of locate.candidatesForBox(x0,y0,x1,y1)){
        let intersection=poly;
        const boundary=macro.polygon;
        const signed=boundary.reduce((sum,p,i)=>{
          const q=boundary[(i+1)%boundary.length];
          return sum+p.x*q.y-q.x*p.y;
        },0);
        const sense=signed>=0?1:-1;
        for(let i=0;i<boundary.length&&intersection.length>=3;i++){
          const a=boundary[i],b=boundary[(i+1)%boundary.length];
          const dx=b.x-a.x,dy=b.y-a.y;
          intersection=clip(intersection,sense*dy,-sense*dx,
            sense*(dy*a.x-dx*a.y));
        }
        if(intersection.length<3||area(intersection)<EPS)continue;
        fragments.push({macroId:macro.id,polygon:intersection});
      }
    }
    // Warp every shared fragment vertex using the same deterministic field,
    // retaining organic borders. Back off displacement until the *visual*
    // areas of every macro also satisfy the strict ±10% requirement.
    const allowed=width*height/snapshot.cells.length;
    let parts=[],maxVisualDeviation=Infinity,appliedWarp=0;
    for(const multiplier of [1,.75,.5,.25,.125,0]){
      const amp=deformation*.22*multiplier;
      const cache=new Map();
      const deformPoint=p=>{
        if(!amp)return p;
        const key=p.x.toFixed(6)+','+p.y.toFixed(6);
        if(cache.has(key))return cache.get(key);
        const distance=Math.min(p.x,width-p.x,p.y,height-p.y);
        const fade=clamp(distance/(spacing*1.8),0,1);
        const q=warpPoint(p,spacing,amp,seed);
        const shifted={x:p.x+(q.x-p.x)*fade,y:p.y+(q.y-p.y)*fade};
        cache.set(key,shifted);
        return shifted;
      };
      parts=fragments.map(p=>({macroId:p.macroId,polygon:p.polygon.map(deformPoint)}));
      const actual=new Map();
      let valid=true;
      for(const p of parts){
        const value=area(p.polygon);
        if(!Number.isFinite(value)||value<EPS){valid=false;break;}
        actual.set(p.macroId,(actual.get(p.macroId)||0)+value);
      }
      maxVisualDeviation=Math.max(...snapshot.cells.map(c=>
        Math.abs((actual.get(c.macroId)||0)/allowed-1)));
      if(valid&&maxVisualDeviation<=.099){
        appliedWarp=amp;
        break;
      }
    }
    if(maxVisualDeviation>.10)
      throw Error('3D visual territory areas exceed ±10%');
    for(const part of parts){
      if(!ownerParts.has(part.macroId))ownerParts.set(part.macroId,[]);
      ownerParts.get(part.macroId).push(part);
    }
    return {parts,ownerParts,spacing,siteCount,visualAreaDeviation:maxVisualDeviation,appliedWarp};

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

  // Project authored and generated 2D rivers onto the same ORGANIC microcell
  // seams that are actually rendered as the 3D territory borders. Manual river
  // pairs occupy their whole new shared boundary; automatically generated river
  // segments trace only the matching subpath, avoiding accidental full-pair rivers.
  // No gameplay river edges or save identifiers are changed.
  function deriveRiverBorders(snapshot,borders) {
    const pairKey=ids=>ids.length===2?ids.slice().sort((a,b)=>a-b).join('-'):null;
    const pointKey=p=>p.x.toFixed(3)+','+p.y.toFixed(3);
    const edgeKey=e=>{
      const a=pointKey(e.start),b=pointKey(e.end);
      return a<b?a+'|'+b:b+'|'+a;
    };
    const endpointKey=p=>p.x.toFixed(2)+','+p.y.toFixed(2);
    const pointDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const distanceToSegment=(p,a,b)=>{
      const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy||1;
      const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/d,0,1);
      return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
    };
    const manualPairs=new Set(snapshot.rivers||[]);
    const generatedKeys=new Set(snapshot.generatedRiverEdges||[]);
    const visual=new Map(),chosen=new Set(),riverEdges=[];
    let mappedAutomatic=0,unmatchedAutomatic=0;
    for(let i=0;i<borders.length;i++){
      const edge=borders[i],pair=pairKey(edge.macroIds||[]);
      if(!pair)continue;
      if(!visual.has(pair))visual.set(pair,[]);
      visual.get(pair).push({edge,index:i});
      if(manualPairs.has(pair))chosen.add(i);
    }
    const graphCache=new Map();
    function borderGraph(pair) {
      if(graphCache.has(pair))return graphCache.get(pair);
      const nodes=new Map();
      const add=p=>{
        const key=endpointKey(p);
        if(!nodes.has(key))nodes.set(key,{key,x:p.x,y:p.y,links:[]});
        return nodes.get(key);
      };
      for(const {edge,index} of visual.get(pair)||[]){
        const a=add(edge.start),b=add(edge.end);
        const length=pointDistance(a,b);
        if(length<=1e-6)continue;
        a.links.push({to:b.key,index,length});
        b.links.push({to:a.key,index,length});
      }
      // Only paths within the SAME connected component can represent a
      // continuous section of the original river.
      const components=[],visited=new Set();
      for(const node of nodes.values()){
        if(visited.has(node.key))continue;
        const component=[],todo=[node];visited.add(node.key);
        while(todo.length){
          const current=todo.pop();component.push(current);
          for(const e of current.links)if(!visited.has(e.to)){
            visited.add(e.to);todo.push(nodes.get(e.to));
          }
        }
        components.push(component);
      }
      const graph={nodes,components};
      graphCache.set(pair,graph);
      return graph;
    }
    function traceSegment(pair,original){
      const {nodes,components}=borderGraph(pair);
      if(!nodes.size)return null;
      let start=null,end=null,score=Infinity;
      for(const component of components){
        let nearestStart=null,nearestEnd=null,ds=Infinity,de=Infinity;
        for(const node of component){
          const a=pointDistance(node,original.start),b=pointDistance(node,original.end);
          if(a<ds){ds=a;nearestStart=node;}
          if(b<de){de=b;nearestEnd=node;}
        }
        if(ds+de<score){score=ds+de;start=nearestStart;end=nearestEnd;}
      }
      if(!start||!end)return null;
      if(start.key===end.key){
        // Coarse visual detail: one microcell seam may represent the original
        // whole segment, so choose its closest edge instead of a zero path.
        let nearest=null,best=Infinity;
        const midpoint={x:(original.start.x+original.end.x)/2,
                        y:(original.start.y+original.end.y)/2};
        for(const candidate of visual.get(pair)||[]){
          const d=distanceToSegment(midpoint,candidate.edge.start,candidate.edge.end);
          if(d<best){best=d;nearest=candidate.index;}
        }
        return nearest===null?null:[nearest];
      }
      const distances=new Map([[start.key,0]]),previous=new Map();
      const queue=[{key:start.key,dist:0}];
      while(queue.length){
        queue.sort((a,b)=>b.dist-a.dist);
        const current=queue.pop();
        if(current.dist!==distances.get(current.key))continue;
        if(current.key===end.key)break;
        const node=nodes.get(current.key);
        for(const link of node.links){
          const edge=borders[link.index];
          const midpoint={x:(edge.start.x+edge.end.x)/2,
                          y:(edge.start.y+edge.end.y)/2};
          const away=distanceToSegment(midpoint,original.start,original.end);
          const cost=link.length*(1+Math.min(4,away/32));
          const total=current.dist+cost;
          if(total>= (distances.get(link.to)??Infinity))continue;
          distances.set(link.to,total);
          previous.set(link.to,{from:current.key,index:link.index});
          queue.push({key:link.to,dist:total});
        }
      }
      if(!previous.has(end.key))return null;
      const path=[];let cursor=end.key;
      while(cursor!==start.key){
        const step=previous.get(cursor);
        if(!step)return null;
        path.push(step.index);
        cursor=step.from;
      }
      return path;
    }
    for(const source of snapshot.edges||[]){
      if(!generatedKeys.has(edgeKey(source)))continue;
      const pair=pairKey(source.macroIds||[]);
      if(!pair||manualPairs.has(pair))continue;
      const segments=traceSegment(pair,source);
      if(!segments?.length){unmatchedAutomatic++;continue;}
      for(const index of segments)chosen.add(index);
      mappedAutomatic++;
    }
    for(const index of [...chosen].sort((a,b)=>a-b))riverEdges.push(borders[index]);
    return {riverEdges,riverStats:{
      manualPairs:manualPairs.size,
      unmatchedManual:[...manualPairs].filter(pair=>!(visual.get(pair)||[]).length).length,
      manualVisualEdges:[...chosen].filter(i=>manualPairs.has(pairKey(borders[i].macroIds||[]))).length,
      mappedAutomatic,unmatchedAutomatic,visualSegments:riverEdges.length
    }};
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
    const vertices=[],trees=[],reeds=[],peaks=[],mountainSummits=[],pickRanges=[];
    const pickBucketSize=64, pickBuckets=new Map();
    let pickMaxAbsZ=0;
    let subcells=0,visualFragments=0,triangles=0,mountains=0,hills=0;
    function face(a,b,c,rgb,variation=0,shaded=true) {
      const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
      const v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
      const nx=u.y*v.z-u.z*v.y,ny=u.z*v.x-u.x*v.z,nz=u.x*v.y-u.y*v.x;
      const norm=Math.hypot(nx,ny,nz)||1;
      const light=shaded?clamp(.79+(.34*Math.abs(nz)+.23*nx-.18*ny)/norm+variation,.42,1.23):clamp(1+variation,.75,1.25);
      const cr=clamp(rgb[0]*light/255,0,1),cg=clamp(rgb[1]*light/255,0,1),cb=clamp(rgb[2]*light/255,0,1);
      for(const p of [a,b,c])vertices.push(p.x,p.y,p.z,cr,cg,cb);
      triangles++;
    }
    const base = detail===1 ? {
      parts:snapshot.cells.map(c=>({macroId:c.macroId,polygon:c.polygon})),
      ownerParts:new Map(snapshot.cells.map(c=>[c.macroId,[{polygon:c.polygon,macroId:c.macroId}]])),
      spacing:Math.sqrt(snapshot.width*snapshot.height/snapshot.cells.length),
      siteCount:snapshot.cells.length,visualAreaDeviation:0,appliedWarp:0
    } : globalMicrocells(snapshot,detail,deformation);
    subcells=base.siteCount;
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
      // Keep the World Lab's exact palette as the base; restore low-frequency
      // chromatic relief only to sea/lake and hills, with a small per-microcell
      // modulation reminiscent of the original renderer's +-4.5% tone.
      const chromaticBiome=terrain==='sea'||terrain==='lake'||terrain==='hills';
      const macroNoise=chromaticBiome
        ? noise(center.x/105,center.y/105,(snapshot.seed>>>0)^0x65ad4)
        : 0;
      const microNoise=chromaticBiome
        ? noise(center.x/38,center.y/38,(snapshot.seed>>>0)^0x83d21)
        : 0;
      const microGrain=chromaticBiome
        ? hashed(Math.round(center.x*10),Math.round(center.y*10),(snapshot.seed>>>0)^0x19f4a)-.5
        : 0;
      const variation=chromaticBiome
        ? (.65*macroNoise+.35*microNoise)*(terrain==='hills'?.18:.13)+microGrain*.09
        : 0;
      const firstVertex=vertices.length/6;
      visualFragments++;
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        face(middle,{...a,z:elevation(a,parent,terrain,snapshot.seed)},
          {...b,z:elevation(b,parent,terrain,snapshot.seed)},shade,variation,false);
      }
      // Terrain triangles only; subsequent mountains are deliberately not selectable.
      const vertexCount=vertices.length/6-firstVertex;
      const index=pickRanges.length;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(let i=firstVertex*6;i<vertices.length;i+=6){
        minX=Math.min(minX,vertices[i]);maxX=Math.max(maxX,vertices[i]);
        minY=Math.min(minY,vertices[i+1]);maxY=Math.max(maxY,vertices[i+1]);
        pickMaxAbsZ=Math.max(pickMaxAbsZ,Math.abs(vertices[i+2]));
      }
      pickRanges.push({macroId:part.macroId,firstVertex,vertexCount,minX,minY,maxX,maxY});
      for(let gy=Math.floor(minY/pickBucketSize);gy<=Math.floor(maxY/pickBucketSize);gy++){
        for(let gx=Math.floor(minX/pickBucketSize);gx<=Math.floor(maxX/pickBucketSize);gx++){
          const key=gx+','+gy;
          if(!pickBuckets.has(key))pickBuckets.set(key,[]);
          pickBuckets.get(key).push(index);
        }
      }
    }
    for(const cell of snapshot.cells) {
      const poly=cell.polygon,terrain=snapshot.terrain[cell.macroId]||'plain';
      const owned=base.ownerParts.get(cell.macroId);
      if(!owned?.length)continue;
      const random=rng((snapshot.seed ^ Math.imul(cell.macroId+1,2654435761))>>>0);
      if(terrain==='forest') {
        // Original prototype: 3..7 tiny trees per territory, size 5.8..10.1.
        // Density stays >=10x original; tree sprite size is now 2.5x (half the prior 5x).
        const count=30+Math.floor(random()*41);
        for(let i=0;i<count;i++){
          const p=weightedSample(owned,random);
          trees.push({macroId:cell.macroId,x:p.x,y:p.y,z:elevation(p,poly,terrain,snapshot.seed),
                      variant:Math.floor(random()*7),size:2.5*(5.8+random()*4.3)});
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
        // 2–5 separate low, broad polygonal mesas per hill territory.
        // Each is 50% in XY and 20% in Z relative to the preceding single
        // 5x hill frustum. Keep the same 7–9-sided flat-top silhouette.
        const count=2+Math.floor(random()*4);
        const shade=rgbCache.get(cell.macroId)||sourceColor(snapshot.fills[cell.macroId]);
        const placed=[];
        for(let k=0;k<count;k++){
          // Favor separated positions instead of stacking the increased number
          // of hill props at the same centroid.
          let center=null,spacing=-Infinity;
          for(let attempt=0;attempt<14;attempt++){
            const candidate=weightedSample(owned,random);
            const distance=placed.length
              ? Math.min(...placed.map(p=>Math.hypot(candidate.x-p.x,candidate.y-p.y)))
              : Infinity;
            if(distance>spacing){center=candidate;spacing=distance;}
          }
          const originalRadius=Math.min(8,Math.max(2.5,edgeDistance(center,poly)*.76));
          const baseRadius=originalRadius*2.5;
          const topRadius=baseRadius*(.43+random()*.1);
          const baseZ=elevation(center,poly,terrain,snapshot.seed);
          const height=8+random()*15;
          const topZ=baseZ+height;
          const sides=7+Math.floor(random()*3),phase=random()*Math.PI*2;
          const lower=[],upper=[];
          for(let i=0;i<sides;i++){
            const theta=phase+i*Math.PI*2/sides;
            lower.push({x:center.x+Math.cos(theta)*baseRadius,
                        y:center.y+Math.sin(theta)*baseRadius,z:baseZ});
            upper.push({x:center.x+Math.cos(theta)*topRadius,
                        y:center.y+Math.sin(theta)*topRadius,z:topZ});
          }
          for(let i=0;i<sides;i++){
            const j=(i+1)%sides,variation=(random()-.5)*.12;
            face(lower[i],lower[j],upper[j],shade,variation);
            face(lower[i],upper[j],upper[i],shade,variation);
          }
          for(let i=0;i<sides;i++){
            face({x:center.x,y:center.y,z:topZ},upper[i],upper[(i+1)%sides],
                 shade,.10);
          }
          peaks.push({type:'hill',macroId:cell.macroId,x:center.x,y:center.y,
                      z:topZ,baseZ,height,radius:baseRadius,topRadius,sides});
          placed.push(center);
          hills++;
        }
      }
    }
    // The authoritative mountain barrier edges still determine ridge locations.
    // Their peaks now have 2x the previous base XY size (10x original)
    // and three times as many summits, with snow over the upper third.
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
      const length=Math.hypot(dx,dy);
      const previousCount=Math.max(1,Math.min(4,Math.round(length/120)));
      const count=previousCount*3; // At least 3x the prior per-edge summits.
      const normalX=length>0?-dy/length:0,normalY=length>0?dx/length:1;
      const random=rng((snapshot.seed ^ Math.imul((ids[0]||0)+1,12582917) ^ Math.round(length*31))>>>0);
      for(let index=0;index<count;index++){
        // Spread each triple of broad summits across the ridge (three staggered
        // strands), rather than dropping three large mountains on one point.
        const group=Math.floor(index/3),strand=index%3;
        const t=(group+.5+(strand-1)*.18+(random()-.5)*.12)/previousCount;
        const originalRadius=2.9+random()*3.2;
        const radius=originalRadius*10; // 200% of preceding 5x base XY.
        const offset=(strand-1)*radius*.75+(random()-.5)*radius*.12;
        const x=edge.start.x+dx*t+normalX*offset;
        const y=edge.start.y+dy*t+normalY*offset;
        const height=(7+random()*9)*4; // Half of the previous peak Z; XY remains unchanged.
        const baseZ=0,topZ=baseZ+height;
        const snowStart=baseZ+height*2/3;
        const sides=7+Math.floor(random()*3);
        const phase=random()*Math.PI*2;
        const base=[],snowline=[];
        const summit={x:x+(random()-.5)*radius*.13,
                      y:y+(random()-.5)*radius*.13,z:topZ};
        for(let i=0;i<sides;i++){
          const theta=phase+i*Math.PI*2/sides;
          const bx=x+Math.cos(theta)*radius,by=y+Math.sin(theta)*radius;
          base.push({x:bx,y:by,z:baseZ});
          const snowFraction=(snowStart-baseZ)/height;
          snowline.push({
            x:bx+(summit.x-bx)*snowFraction,
            y:by+(summit.y-by)*snowFraction,
            z:snowStart
          });
        }
        const stone=[139,132,122],snow=[233,238,236];
        for(let k=0;k<sides;k++){
          const next=(k+1)%sides;
          // Faceted rock lower two thirds.
          const shade=(random()-.5)*.18;
          face(base[k],base[next],snowline[next],stone,shade);
          face(base[k],snowline[next],snowline[k],stone,shade);
          // Clean snowy upper third, with a distinct light cap.
          face(snowline[k],snowline[next],summit,snow,(random()-.5)*.10);
        }
        mountainSummits.push({x,y,z:topZ,baseZ,height,radius,snowStart,
                              snowyHeight:topZ-snowStart,sides});
        mountains++;
      }
    }
    const {borders,coastlines,unmatched}=aggregateEdges(base.parts,snapshot.terrain,snapshot.cells);
    const {riverEdges,riverStats}=deriveRiverBorders(snapshot,borders);
    return{
      vertices:new Float32Array(vertices),pickRanges,pickIndex:{bucketSize:pickBucketSize,buckets:pickBuckets,maxAbsZ:pickMaxAbsZ},trees,reeds,peaks,mountainSummits,borders,coastlines,riverEdges,riverStats,
      stats:{territories:snapshot.cells.length,subcells,visualFragments,
             maxVisualAreaDeviation:base.visualAreaDeviation,appliedWarp:base.appliedWarp,
             triangles,mountains,hills,
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
    // Reverse the Builder's iso transform at ground elevation, then include the
    // maximum possible z displacement. This gives a tiny candidate window even
    // when zoomed, panned or yaw-rotated, without missing elevated hill triangles.
    const index=scene.pickIndex;
    let candidates=scene.pickRanges;
    if(index?.buckets){
      const difference=(pixelX-px)/(scale*.8660254);
      const sum=(pixelY-py)/(scale*.5);
      const qx=(difference+sum)/2,qy=(sum-difference)/2;
      const worldX=c.cx+qx*xcos+qy*xsin;
      const worldY=c.cy-qx*xsin+qy*xcos;
      const radius=2+Math.max(3,index.maxAbsZ)*1.5;
      const bucket=index.bucketSize, ids=new Set();
      for(let gy=Math.floor((worldY-radius)/bucket);gy<=Math.floor((worldY+radius)/bucket);gy++)
        for(let gx=Math.floor((worldX-radius)/bucket);gx<=Math.floor((worldX+radius)/bucket);gx++)
          for(const id of index.buckets.get(gx+','+gy)||[])ids.add(id);
      candidates=[...ids].map(id=>scene.pickRanges[id]).filter(r=>
        worldX+radius>=r.minX && worldX-radius<=r.maxX &&
        worldY+radius>=r.minY && worldY-radius<=r.maxY);
    }
    let best=-Infinity, selected=null;
    for(const range of candidates){
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
          globalMicrocells,aggregateEdges,deriveRiverBorders,buildScene};
});
