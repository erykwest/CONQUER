'use strict';
// Local map outline inherited from the regional HEX Voronoi territory.
//
// The territory outline (regional coordinates; the union of its cells) is
// uniformly scaled, north up, so that its area is ALWAYS the local buildable
// area (200x200 = 40000 U² since 25/11/2026, D-LOCAL-AREA-261125; it was
// 100x100), whatever its regional shape: the scale factor is
// the "homogenization", checked once at generation and saved with the map.
// That polygon IS the buildable zone. The world border is the same polygon
// offset outwards by OFFSET (50U, rounded corners; a true offset, concave
// territories included) - never a square. The square canvas (WORLD) is sized
// to contain that border: at least 360U (HEX_WORLD), more for an elongated
// territory. Legacy square maps keep 200U. The 50U ring is split
// among the territory's PHYSICAL regional neighbours by intersecting it with
// their own Voronoi cells, carried into the same local frame: a vertex of the
// centre (where three cells meet) is split along the real Voronoi edge between
// the two neighbours. Neighbour counts follow the regional geometry (often 6,
// 5 or 7 after jitter), never a fixed 8-slot compass.
(function(root){
  const OFFSET=50,BOX=200,TARGET_AREA=BOX*BOX,MARGIN=1,LEGACY_WORLD=200,HEX_WORLD=360;
  const FEATHER=25,SECTOR_FEATHER=10,ARC_STEP=Math.PI/18,PERIMETER_SAMPLES=720;

  const finitePoint=p=>p&&Number.isFinite(+p.x)&&Number.isFinite(+p.y);
  const validRing=r=>Array.isArray(r)&&r.length>=3&&r.every(finitePoint);
  const signedArea=r=>{let s=0;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];s+=a.x*b.y-b.x*a.y}return s/2};
  const positive=r=>signedArea(r)<0?r.slice().reverse():r.slice();
  const clamp01=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const t=clamp01(v);return t*t*(3-2*t)};
  function contains(p,r){
    let yes=false;
    for(let i=0,j=r.length-1;i<r.length;j=i++){
      const a=r[i],b=r[j];
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
    }
    return yes;
  }
  function segmentDistance(p,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp01(((p.x-a.x)*dx+(p.y-a.y)*dy)/l):0;
    return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));
  }
  function ringDistance(p,r){let d=Infinity;for(let i=0;i<r.length;i++)d=Math.min(d,segmentDistance(p,r[i],r[(i+1)%r.length]));return d}
  // Positive outside, negative inside.
  const signedDistance=(p,r)=>contains(p,r)?-ringDistance(p,r):ringDistance(p,r);
  function bounds(r){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const p of r){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
    return{minX,minY,maxX,maxY};
  }
  function hull(points){
    const p=points.map(q=>({x:+q.x,y:+q.y})).sort((a,b)=>a.x-b.x||a.y-b.y);
    if(p.length<3)return p;
    const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lower=[],upper=[];
    for(const q of p){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],q)<=0)lower.pop();lower.push(q)}
    for(let i=p.length-1;i>=0;i--){const q=p[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],q)<=0)upper.pop();upper.push(q)}
    return positive(lower.slice(0,-1).concat(upper.slice(0,-1)));
  }
  // Minkowski offset of a convex, positively oriented ring: straight edges pushed
  // out by d and a circular arc around every vertex.
  function offsetConvex(r,d){
    const out=[],n=r.length;
    const normal=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return{x:dy/l,y:-dx/l}};
    for(let i=0;i<n;i++){
      const prev=r[(i+n-1)%n],v=r[i],next=r[(i+1)%n];
      const n0=normal(prev,v),n1=normal(v,next);
      let a0=Math.atan2(n0.y,n0.x),a1=Math.atan2(n1.y,n1.x);
      // Positive shoelace orientation turns the outward normal with increasing
      // atan2 angle at a convex vertex: walk from a0 up to a1.
      while(a1<a0)a1+=Math.PI*2;
      const steps=Math.max(1,Math.ceil((a1-a0)/ARC_STEP));
      for(let k=0;k<=steps;k++){const a=a0+(a1-a0)*k/steps;out.push({x:v.x+Math.cos(a)*d,y:v.y+Math.sin(a)*d})}
    }
    return out.filter((p,i)=>!i||Math.hypot(p.x-out[i-1].x,p.y-out[i-1].y)>1e-6);
  }
  function isConvex(r){
    let sign=0;
    for(let i=0;i<r.length;i++){
      const a=r[i],b=r[(i+1)%r.length],c=r[(i+2)%r.length];
      const z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
      if(Math.abs(z)<1e-9)continue;
      if(!sign)sign=Math.sign(z);else if(Math.sign(z)!==sign)return false;
    }
    return true;
  }
  // Offset of any simple ring by d: exact Minkowski for convex cells; for a
  // concave territory (several regional cells) the level set {distance = d}
  // traced along rays from the centroid, bisected to 1e-3 U.
  function offsetPolygon(r,d){
    if(isConvex(r))return offsetConvex(r,d);
    const c=r.reduce((a,p)=>({x:a.x+p.x/r.length,y:a.y+p.y/r.length}),{x:0,y:0});
    const reach=Math.max(...r.map(p=>Math.hypot(p.x-c.x,p.y-c.y)))+d+4,out=[],RAYS=360;
    for(let i=0;i<RAYS;i++){
      const a=i/RAYS*Math.PI*2,ux=Math.cos(a),uy=Math.sin(a),at=t=>({x:c.x+ux*t,y:c.y+uy*t});
      let hi=reach,lo=hi;
      while(lo>0&&signedDistance(at(lo),r)>d)lo-=1;
      lo=Math.max(0,lo);hi=Math.min(reach,lo+1);
      for(let k=0;k<12;k++){const m=(lo+hi)/2;if(signedDistance(at(m),r)>d)hi=m;else lo=m}
      out.push(at(lo));
    }
    return positive(out);
  }
  // Sutherland-Hodgman against a convex clip ring.
  function clipConvex(subject,clip){
    clip=positive(clip);let out=subject.slice();
    for(let i=0;i<clip.length&&out.length;i++){
      const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];
      const side=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
      for(let j=0;j<input.length;j++){
        const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q);
        if(sp>=0)out.push(p);
        if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}
      }
    }
    return out.length>=3?out:[];
  }
  function perimeterOf(r){
    const lengths=[0];
    for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];lengths.push(lengths[i]+Math.hypot(b.x-a.x,b.y-a.y))}
    const total=lengths[r.length];
    function at(s){
      s=((s%total)+total)%total;
      let lo=0,hi=r.length-1;
      while(lo<hi){const mid=(lo+hi+1)>>1;if(lengths[mid]<=s)lo=mid;else hi=mid-1}
      const a=r[lo],b=r[(lo+1)%r.length],l=lengths[lo+1]-lengths[lo]||1,t=(s-lengths[lo])/l;
      return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    }
    return{total,at};
  }

  // world: minimum canvas size; the canvas grows (in 2U steps) when the 50U
  // border of an elongated territory needs more room. The area never shrinks.
  function create(shape,{world=HEX_WORLD}={}){
    if(!shape||!validRing(shape.polygon))return null;
    const source=positive(shape.polygon.map(p=>({x:+p.x,y:+p.y}))),b=bounds(source);
    const area0=Math.abs(signedArea(source));
    if(!(area0>0))return null;
    // Homogenization: every territory gets exactly TARGET_AREA, whatever its regional size/shape.
    const scale=Math.sqrt(TARGET_AREA/area0),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
    const rel=p=>({x:(+p.x-cx)*scale,y:(+p.y-cy)*scale});
    const buildRel=source.map(rel),outerRel=offsetPolygon(buildRel,OFFSET),ob=bounds(outerRel);
    const half=Math.max(-ob.minX,ob.maxX,-ob.minY,ob.maxY)+MARGIN;
    const WORLD=Math.max(world,2*Math.ceil(half)),CENTER={x:WORLD/2,y:WORLD/2};
    const shift=p=>({x:p.x+CENTER.x,y:p.y+CENTER.y}),toLocal=p=>shift(rel(p));
    const build=buildRel.map(shift),outer=outerRel.map(shift);
    // Generation-time check of the homogenization (the only place it is verified).
    const buildArea=Math.abs(signedArea(build));
    if(Math.abs(buildArea-TARGET_AREA)>TARGET_AREA*1e-9)throw Error('Local hex area not homogenized: '+buildArea);
    const homogenization=Object.freeze({targetArea:TARGET_AREA,sourceArea:area0,scale,buildArea,world:WORLD,offset:OFFSET});
    const sectors=(Array.isArray(shape.neighbors)?shape.neighbors:[])
      .filter(n=>n&&validRing(n.polygon))
      .map(n=>({id:String(n.id),code:n.code??null,terrain:n.terrain??null,biome:n.biome??null,
        polygon:positive(n.polygon.map(toLocal))}));
    const per=perimeterOf(outer);
    // Owner of each perimeter sample: the neighbour cell a step inside the border.
    const samples=[];
    for(let i=0;i<PERIMETER_SAMPLES;i++){
      const s=(i+.5)/PERIMETER_SAMPLES*per.total,p=per.at(s);
      const dx=CENTER.x-p.x,dy=CENTER.y-p.y,l=Math.hypot(dx,dy)||1,q={x:p.x+dx/l*.75,y:p.y+dy/l*.75};
      samples.push({s,owner:sectorAt(q)?.id??null});
    }
    // Contiguous owner runs along the border (wrapping at the start).
    const runs=[];
    if(samples.length){
      let start=samples.findIndex((x,i)=>x.owner!==samples[(i+samples.length-1)%samples.length].owner);
      if(start<0)runs.push({sectorId:samples[0].owner,from:0,to:per.total,closed:true});
      else for(let k=0;k<samples.length;){
        const first=samples[(start+k)%samples.length];let m=k+1;
        while(m<samples.length&&samples[(start+m)%samples.length].owner===first.owner)m++;
        const step=per.total/samples.length,from=first.s-step/2;
        runs.push({sectorId:first.owner,from,to:from+(m-k)*step,closed:false});k=m;
      }
    }
    for(const r of runs)r.length=r.to-r.from;
    function sectorAt(p){
      let best=null,bestD=Infinity;
      for(const s of sectors){
        if(contains(p,s.polygon))return s;
        const d=ringDistance(p,s.polygon);if(d<bestD){bestD=d;best=s}
      }
      // Beyond every neighbour cell (finite regional map edge, or a second-ring
      // cell reached at a sharp corner): the nearest neighbour within a short
      // reach, otherwise the territory itself continues (as regional sampling does).
      return bestD<=SECTOR_FEATHER*2?best:null;
    }
    function biomeOf(s,centerKey){return s?.biome||centerKey}
    // Biome weights: the regional border IS the biome border, so the hand-over is
    // centred on the build outline (50/50 at d=0) across FEATHER U (−12.5..+12.5):
    // a sea neighbour's coastline runs along the build border and its bays reach
    // into the buildable zone, as on the regional map. Deep inside stays pure.
    // Neighbour sectors are feathered across SECTOR_FEATHER U at their mutual borders.
    function weights(p,centerKey){
      const out={},add=(k,w)=>{if(w>1e-9)out[k]=(out[k]||0)+w};
      const d=signedDistance(p,build);
      if(d<=-FEATHER/2){out[centerKey]=1;return out}
      const h=smooth(.5+d/FEATHER);
      add(centerKey,1-h);
      if(h<=0)return out;
      const raw=[];let sum=0;
      for(const s of sectors){
        const sd=-signedDistance(p,s.polygon),a=smooth(.5+sd/SECTOR_FEATHER);
        if(a>0){raw.push([s,a]);sum+=a}
      }
      if(!sum){add(biomeOf(sectorAt(p),centerKey),h);return out}
      for(const [s,a] of raw)add(biomeOf(s,centerKey),h*a/sum);
      return out;
    }
    // Rasterised world mask for hot path queries (1U cells over the 200U canvas).
    const mask=new Uint8Array(WORLD*WORLD);
    for(let y=0;y<WORLD;y++)for(let x=0;x<WORLD;x++)mask[y*WORLD+x]=contains({x:x+.5,y:y+.5},outer)?1:0;
    const inWorld=(p,margin=0)=>{
      if(!finitePoint(p))return false;
      if(margin)return signedDistance(p,outer)<=margin;
      const x=Math.floor(p.x),y=Math.floor(p.y);
      if(x<0||y<0||x>=WORLD||y>=WORLD)return false;
      return mask[y*WORLD+x]===1||signedDistance(p,outer)<=.75;
    };
    const inBuild=(p,eps=0)=>eps?signedDistance(p,build)<=eps:contains(p,build)||ringDistance(p,build)<=1e-6;
    const runsFor=id=>runs.filter(r=>r.sectorId===String(id)).sort((a,b)=>b.length-a.length);
    // Point at fraction t (0..1) of the longest border run of a neighbour sector.
    function runSample(id,t){
      const r=runsFor(id)[0];if(!r)return null;
      return per.at(r.from+clamp01(t)*r.length);
    }
    const signature=[build,...sectors.map(s=>s.id+':'+s.biome)].map(x=>Array.isArray(x)?x.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(';'):x).join('|');
    // Regional rivers run ON territory borders. borderPath(ids) is the longest stretch of
    // the build outline shared with those neighbour sectors, extended at both ends along
    // its tangent until it leaves the outer border: the local river follows it.
    function borderPath(ids,tol=3){
      const want=sectors.filter(s=>ids.map(String).includes(s.id));
      if(!want.length)return null;
      const dense=[];
      for(let i=0;i<build.length;i++){
        const a=build[i],b=build[(i+1)%build.length],k=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/1.5));
        for(let j=0;j<k;j++)dense.push({x:a.x+(b.x-a.x)*j/k,y:a.y+(b.y-a.y)*j/k});
      }
      const on=dense.map(p=>want.some(s=>contains(p,s.polygon)||ringDistance(p,s.polygon)<=tol));
      const n=dense.length;
      if(on.every(Boolean)||!on.some(Boolean))return null;
      let start=on.findIndex((v,i)=>!v&&on[(i+1)%n]),best=null;
      for(let k=1;k<=n;){
        const i=(start+k)%n;
        if(!on[i]){k++;continue}
        const run=[];while(k<=n&&on[(start+k)%n]){run.push(dense[(start+k)%n]);k++}
        if(!best||run.length>best.length)best=run;
      }
      if(!best||best.length<4)return null;
      // Samples taken only through the tolerance (just past a vertex, on the next edge) bend the
      // end tangent along the outline, and the extension then runs inside the ring instead of
      // leaving it: trim them so each end continues the shared edge itself.
      const onShared=p=>want.some(s=>ringDistance(p,s.polygon)<=.5);
      while(best.length>4&&!onShared(best[0]))best.shift();
      while(best.length>4&&!onShared(best[best.length-1]))best.pop();
      const extend=(end,prev)=>{
        const dx=end.x-prev.x,dy=end.y-prev.y,l=Math.hypot(dx,dy)||1,out=[];
        for(let s=2;s<=OFFSET*3;s+=2){const p={x:end.x+dx/l*s,y:end.y+dy/l*s};out.push(p);if(signedDistance(p,outer)>2)break}
        return out;
      };
      const head=extend(best[0],best[Math.min(3,best.length-1)]).reverse();
      const tail=extend(best[best.length-1],best[Math.max(0,best.length-4)]);
      return[...head,...best,...tail];
    }
    return Object.freeze({
      version:3,borderPath,world:WORLD,center:CENTER,offset:OFFSET,scale,homogenization,build,outer,sectors,runs,perimeter:per.total,signature,
      contains,inBuild,inWorld,sectorAt,weights,runsFor,runSample,pointAt:per.at,
      distanceOutsideBuild:p=>signedDistance(p,build),distanceOutsideWorld:p=>signedDistance(p,outer),
      buildArea,outerArea:Math.abs(signedArea(outer))
    });
  }

  let cached=null,cachedFor=null;
  function current(){
    const shape=root.__CONQUER_REGIONAL_DEMO__?.shape||null;
    if(shape!==cachedFor){cachedFor=shape;try{cached=create(shape,{world:HEX_WORLD})}catch(error){console.warn('CONQUER_LOCAL_SHAPE_INVALID',error);cached=null}}
    return cached;
  }
  // Canvas size of the local map: read once by settlement-core.js (WORLD).
  const worldSize=()=>current()?.world||LEGACY_WORLD;
  const api=Object.freeze({OFFSET,BOX,TARGET_AREA,LEGACY_WORLD,HEX_WORLD,create,current,worldSize,active:()=>!!current(),
    geometry:Object.freeze({contains,signedArea,signedDistance,ringDistance,offsetConvex,offsetPolygon,isConvex,clipConvex,hull,bounds})});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerLocalShape=api;
})(typeof window==='object'?window:globalThis);
