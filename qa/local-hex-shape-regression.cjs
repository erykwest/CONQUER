'use strict';
// Local map outline inherited from a regional hex Voronoi territory:
// buildable polygon, 50U offset world border, real-neighbour sectors, weights,
// border runs for road entries and sea exits.
const assert=require('assert');
const S=require('../src/regional-local-shape.js');
const G=S.geometry;

const hex=(cx,cy,r,jitter=0,seed=1)=>Array.from({length:6},(_,i)=>{
  const a=Math.PI/180*(60*i-90),j=1+jitter*Math.sin(seed*13.1+i*7.7);
  return{x:cx+r*j*Math.cos(a),y:cy+r*j*Math.sin(a)};
});
const R=10,W=Math.sqrt(3)*R;
const OFFS=[[W,0],[W/2,1.5*R],[-W/2,1.5*R],[-W,0],[-W/2,-1.5*R],[W/2,-1.5*R]];
const BIOMES=['forest','sea','hills','plains','swamp','sea'];
function lattice(jitter=0){
  return{
    polygon:hex(500,300,R,jitter,1),
    neighbors:OFFS.map(([dx,dy],i)=>({id:'n'+i,terrain:'t'+i,biome:BIOMES[i],polygon:hex(500+dx,300+dy,R,jitter,i+2)}))
  };
}

const s=S.create(lattice());
assert(s,'shape created');
const C=S.HEX_WORLD/2,WMAX=S.HEX_WORLD;
const bb=G.bounds(s.build),ob=G.bounds(s.outer);
// Product rule (25/11/2026, doubled side): buildable area 40000 U² (200x200), hex canvas 360U.
assert.strictEqual(S.TARGET_AREA,40000,'local buildable area is 40000 U²');
assert.strictEqual(S.BOX,200,'200U side');
assert.strictEqual(S.HEX_WORLD,360,'hex canvas floor 360U');
const AREA=S.TARGET_AREA;
assert.strictEqual(s.world,S.HEX_WORLD,'hex maps use the HEX_WORLD canvas');
// Buildable polygon keeps the target area, centred, north up.
assert(Math.abs(s.buildArea-AREA)<1,'build area '+AREA+', got '+s.buildArea);
assert(Math.abs((bb.minY+bb.maxY)/2-C)<1e-6&&Math.abs((bb.minX+bb.maxX)/2-C)<1e-6,'build centred');
assert(bb.maxY-bb.minY>bb.maxX-bb.minX,'pointy-top hex stays north-up');
// World border = 50U offset, inside the canvas.
assert(ob.minX>=0&&ob.minY>=0&&ob.maxX<=WMAX&&ob.maxY<=WMAX,'outer fits canvas '+JSON.stringify(ob));
for(let i=0;i<s.outer.length;i+=3){
  const d=G.ringDistance(s.outer[i],s.build);
  assert(Math.abs(d-50)<.05,'outer vertex at 50U from build, got '+d.toFixed(3));
}
// The ring is a true 50U offset at any build size (Steiner: A + P*50 + pi*50² for a convex
// cell; the rounded corners are polygonal, so a little less than the exact arcs).
{
  let P=0;for(let i=0;i<s.build.length;i++){const a=s.build[i],b=s.build[(i+1)%s.build.length];P+=Math.hypot(b.x-a.x,b.y-a.y)}
  const steiner=s.buildArea+P*50+Math.PI*2500;
  assert(Math.abs(s.outerArea-steiner)<steiner*.01,'outer area = 50U offset ring: '+s.outerArea.toFixed(0)+' vs '+steiner.toFixed(0));
}

// Six physical neighbours -> six sectors, each owning one contiguous border run.
assert.strictEqual(s.sectors.length,6);
const owners=new Set(s.runs.map(r=>r.sectorId));
assert.strictEqual(owners.size,6,'every neighbour reaches the world border: '+[...owners]);
assert(!owners.has(null),'no orphan border run on a full ring of neighbours');
const total=s.runs.reduce((a,r)=>a+r.length,0);
assert(Math.abs(total-s.perimeter)<1e-6,'runs cover the whole perimeter');
for(const id of owners)assert(s.runsFor(id)[0].length>s.perimeter/12,'sector '+id+' gets a fair share of the border');

// Weights: pure centre inside the buildable polygon, pure neighbour deep in its sector.
assert.deepStrictEqual(s.weights({x:C,y:C},'@c'),{'@c':1});
const east={x:ob.maxX-4,y:C};
assert.strictEqual(s.sectorAt(east).id,'n0');
assert(Math.abs((s.weights(east,'@c').forest||0)-1)<1e-6,'east sector is the east neighbour biome');
const sum=w=>Object.values(w).reduce((a,b)=>a+b,0);
for(let y=1;y<WMAX;y+=7)for(let x=1;x<WMAX;x+=7){
  const w=s.weights({x,y},'@c');
  assert(Math.abs(sum(w)-1)<1e-9,'weights normalised at '+x+','+y);
}
// Real Voronoi seam: at a centre vertex the two sectors split along their shared edge.
const north=s.build.reduce((a,p)=>p.y<a.y?p:a);
const probe={x:north.x,y:north.y-40},w=s.weights(probe,'@c');
assert(w.swamp>.3&&w.sea>.3,'north vertex blends the two neighbours meeting there: '+JSON.stringify(w));

// The regional border is the biome border: 50/50 on the build outline, so a sea
// neighbour's coast follows it (and its bays can enter the buildable zone).
const eastMid=s.build.reduce((a,p)=>p.x>a.x?p:a);
const onBorder=s.weights({x:eastMid.x-.01,y:eastMid.y},'@c');
assert(Math.abs((onBorder['@c']||0)-.5)<.05,'50/50 hand-over on the build border: '+JSON.stringify(onBorder));
assert((s.weights({x:eastMid.x-6,y:eastMid.y},'@c')['@c']||0)<.85,'neighbour biome reaches into the buildable zone');
// Rivers run on the border shared with the neighbour across the regional river edge.
const bp=s.borderPath(['n0']);
assert(bp&&bp.length>10,'border path for the river neighbour');
const onShared=bp.filter(p=>Math.abs(G.ringDistance(p,s.build))<.01);
assert(onShared.length>5&&onShared.every(p=>G.ringDistance(p,s.sectors.find(x=>x.id==='n0').polygon)<=3.01),'path follows the shared border');
assert(!s.inWorld(bp[0],-1)||G.ringDistance(bp[0],s.outer)<3,'river enters from the outer border');
assert(!s.inWorld(bp[bp.length-1],-1)||G.ringDistance(bp[bp.length-1],s.outer)<3,'river leaves through the outer border');
assert.strictEqual(s.borderPath(['nope']),null);

// World mask.
assert(s.inWorld({x:C,y:C})&&s.inWorld({x:C,y:ob.minY+1}));
assert(!s.inWorld({x:1,y:1}),'canvas corner is off-map');
assert(s.inBuild({x:C,y:C})&&!s.inBuild({x:C,y:bb.minY-1}));

// Run samples sit on the border, inside their own sector.
for(const id of owners){
  const p=s.runSample(id,.5);
  assert(Math.abs(G.ringDistance(p,s.outer))<1e-6,'sample on border');
  const q={x:p.x+(C-p.x)*.01,y:p.y+(C-p.y)*.01};
  assert.strictEqual(s.sectorAt(q).id,id,'midpoint of run belongs to its sector');
}

// Jittered cells (5..7 neighbours in the real lattice) still give a closed partition.
for(const jitter of [.08,.15]){
  const j=S.create(lattice(jitter));
  const jb=G.bounds(j.outer);
  assert(jb.minX>=0&&jb.maxX<=WMAX&&jb.minY>=0&&jb.maxY<=WMAX);
  assert(Math.abs(j.runs.reduce((a,r)=>a+r.length,0)-j.perimeter)<1e-6);
}
// Territory on the finite regional edge: missing neighbours continue the territory itself.
const edge=lattice();edge.neighbors=edge.neighbors.filter(n=>n.id!=='n0');
const e=S.create(edge);
assert(e.weights({x:G.bounds(e.outer).maxX-3,y:C},'@c')['@c']>.99,'no neighbour beyond the regional edge -> own biome');

// Homogenization, verified at generation: ANY regional size or shape gets exactly
// TARGET_AREA; an elongated territory grows the canvas instead of shrinking.
const close=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps*Math.max(1,Math.abs(b));
for(const k of [.01,1,37]){
  const t=S.create({polygon:hex(0,0,R*k),neighbors:[]});
  assert(close(t.buildArea,AREA),'target area at regional scale '+k+': '+t.buildArea);
  assert(close(t.homogenization.scale,s.homogenization.scale/k),'scale saved and inversely proportional');
  assert.strictEqual(t.homogenization.targetArea,AREA);
}
assert(close(s.homogenization.sourceArea*s.homogenization.scale**2,AREA),'saved homogenization reproduces the area');
const long=S.create({polygon:[{x:0,y:0},{x:300,y:0},{x:300,y:40},{x:0,y:40}],neighbors:[]});
const lb=G.bounds(long.outer);
assert(close(long.buildArea,AREA),'elongated cell keeps the target area');
assert(long.world>S.HEX_WORLD&&long.world%2===0&&lb.minX>=0&&lb.maxX<=long.world&&lb.minY>=0&&lb.maxY<=long.world,'canvas grows to the border: '+long.world);
// Concave territory (two regional cells): true 50U offset, not a convex hull or a square.
const twin={polygon:[...hex(500,300,R).slice(0,1),...hex(500+W,300,R).slice(0,4),...hex(500,300,R).slice(2)],neighbors:[]};
const tw=S.create(twin);
assert(!G.isConvex(tw.build),'two-cell territory is concave');
assert(close(tw.buildArea,AREA));
for(let i=0;i<tw.outer.length;i+=7){const d=G.ringDistance(tw.outer[i],tw.build);assert(Math.abs(d-50)<.05,'concave offset at 50U, got '+d.toFixed(3))}
const corner={x:0,y:0},side=(tw.world);
for(const q of [{x:1,y:1},{x:side-1,y:1},{x:1,y:side-1},{x:side-1,y:side-1}])assert(!tw.inWorld(q),'no square border: canvas corners are off-map');
// Invalid payloads fall back to the legacy square map.
assert.strictEqual(S.create(null),null);
assert.strictEqual(S.create({polygon:[{x:0,y:0},{x:1,y:NaN},{x:2,y:0}]}),null);
console.log('local-hex-shape-regression OK',{
  scale:+s.scale.toFixed(3),buildArea:Math.round(s.buildArea),outerArea:Math.round(s.outerArea),
  runs:s.runs.map(r=>r.sectorId+':'+r.length.toFixed(1)).join(' ')
});
