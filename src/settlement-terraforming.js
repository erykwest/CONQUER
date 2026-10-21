'use strict';
// Player-authored terrain edits. The module owns validation and geometry while
// the existing terrainElevation/render/navigation contracts remain authoritative.
(() => {
  const SEGMENTS=24;
  const SHAPES=Object.freeze(['round','square']);
  const shapeOf=edit=>edit?.shape==='square'?'square':'round';
  const LIMITS=Object.freeze({minRadius:2,maxRadius:8,minZ:0,maxZ:8});

  function edits(){
    if(!State.relief)return[];
    if(!Array.isArray(State.relief.terraforming))State.relief.terraforming=[];
    for(const edit of State.relief.terraforming){
      if(!edit?.center||!Number.isFinite(Number(edit.radius)))continue;
      // Old excavations may contain negative H. H0 is the lower world bound.
      if(Number(edit.targetZ)<0){edit.mode='flat';edit.targetZ=0;edit.baseZ=0;}
      edit.baseZ=Math.max(0,Number(edit.baseZ)||0);
      if(edit.mode!=='walled')continue;
      if(edit.profile==='vertical'&&edit.material==='stone'&&edit.edgeWidth===0)continue;
      edit.profile='vertical';edit.material='stone';edit.edgeWidth=0;
      edit.shape=shapeOf(edit);
      edit.top=polygon(edit.center,Number(edit.radius),Number(edit.rotation)||0,edit.shape);
      edit.outer=edit.top.map(p=>({...p}));
    }
    return State.relief.terraforming;
  }
  function polygon(center,radius,rotation=0,shape='round'){
    if(shape==='square'){
      const ca=Math.cos(rotation),sa=Math.sin(rotation);
      return [[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]]
        .map(([x,y])=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca}));
    }
    return Array.from({length:SEGMENTS},(_,i)=>{
      const a=rotation+i/SEGMENTS*Math.PI*2;
      return{x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius};
    });
  }
  // Immutable edits can be queried tens of thousands of times during a terrain
  // rebuild. Reuse bounding boxes and derived boolean geometry until the authored
  // edit collection changes; do not persist derived meshes into saved games.
  let geometryRevision=null;
  function geometryCache(){
    const list=State.relief?.terraforming;
    if(!geometryRevision||geometryRevision.relief!==State.relief||
       geometryRevision.list!==list||geometryRevision.length!==list?.length||
       geometryRevision.first!==list?.[0]||geometryRevision.last!==list?.[list.length-1]){
      geometryRevision={relief:State.relief,list,length:list?.length,
        first:list?.[0],last:list?.[list?.length-1],
        bounds:new WeakMap(),edges:new WeakMap(),pieces:new WeakMap()};
    }
    return geometryRevision;
  }
  function editBounds(edit){
    const cache=geometryCache(),cached=cache.bounds.get(edit);
    if(cached&&cached.topRef===edit.top&&cached.outerRef===edit.outer)return cached;
    const box=poly=>{
      const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y);
      return{x0:Math.min(...xs),y0:Math.min(...ys),
        x1:Math.max(...xs),y1:Math.max(...ys)};
    };
    const entry={topRef:edit.top,outerRef:edit.outer,
      top:box(edit.top),outer:box(edit.outer||edit.top)};
    cache.bounds.set(edit,entry);
    return entry;
  }
  function boxContains(p,b){
    return p.x>=b.x0-1e-8&&p.x<=b.x1+1e-8&&
      p.y>=b.y0-1e-8&&p.y<=b.y1+1e-8;
  }
  function boxesIntersect(a,b){
    return a.x0<=b.x1+1e-8&&a.x1>=b.x0-1e-8&&
      a.y0<=b.y1+1e-8&&a.y1>=b.y0-1e-8;
  }
  const HEIGHT_BIN=8,NO_EDITS=Object.freeze([]);
  function nearbyHeightEdits(point){
    const cache=geometryCache();
    if(!cache.heightBins){
      const bins=new Map();
      for(const edit of edits()){
        if(!edit?.outer?.length||!edit?.top?.length)continue;
        const box=editBounds(edit).outer;
        for(let ix=Math.floor(box.x0/HEIGHT_BIN);ix<=Math.floor(box.x1/HEIGHT_BIN);ix++)
          for(let iy=Math.floor(box.y0/HEIGHT_BIN);iy<=Math.floor(box.y1/HEIGHT_BIN);iy++){
            const key=ix+','+iy;
            if(!bins.has(key))bins.set(key,[]);
            bins.get(key).push(edit);
          }
      }
      cache.heightBins=bins;
    }
    return cache.heightBins.get(Math.floor(point.x/HEIGHT_BIN)+','+
      Math.floor(point.y/HEIGHT_BIN))||NO_EDITS;
  }
  function insideBuild(points){
    return points.every(p=>p.x>=BUILD_MIN&&p.x<=BUILD_MAX&&p.y>=BUILD_MIN&&p.y<=BUILD_MAX);
  }
  function segmentProjection(p,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(length2||1),0,1);
    return{x:a.x+dx*t,y:a.y+dy*t,t};
  }
  function wallMagnet(center,radius,shape='round'){
    const support=shape==='square'?radius:radius*Math.cos(Math.PI/SEGMENTS);
    let best=null;
    for(const wall of State.structures||[]){
      if(wall.type!=='wall'||!wall.a||!wall.b)continue;
      if(typeof underConstruction==='function'&&underConstruction(wall))continue;
      const q=segmentProjection(center,wall.a,wall.b),dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,L=Math.hypot(dx,dy)||1;
      const nx=-dy/L,ny=dx/L,dot=(center.x-q.x)*nx+(center.y-q.y)*ny,side=dot>=0?1:-1;
      const half=(Number(wall.width)||.5)/2;
      const facePoint={x:q.x+nx*side*half,y:q.y+ny*side*half};
      const snappedCenter={x:facePoint.x+nx*side*support,y:facePoint.y+ny*side*support};
      const score=dist(center,snappedCenter);
      if(score>1.25||best&&score>=best.score)continue;
      const edgeNormal={x:-nx*side,y:-ny*side};
      best={
        structureId:wall.id,score,facePoint,side,
        center:snappedCenter,
        rotation:shape==='square'?Math.atan2(dy,dx):Math.atan2(edgeNormal.y,edgeNormal.x)-Math.PI/SEGMENTS
      };
    }
    return best;
  }
  function terraceMagnet(center,radius,shape){
    let best=null;
    for(const edit of edits()){
      if(edit.mode!=='walled')continue;
      for(let i=0;i<edit.top.length;i++){
        const a=edit.top[i],b=edit.top[(i+1)%edit.top.length],dx=b.x-a.x,dy=b.y-a.y;
        const len=Math.hypot(dx,dy)||1,nx=dy/len,ny=-dx/len;
        const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        const support=shape==='square'?radius:radius*Math.cos(Math.PI/SEGMENTS);
        const proposed={x:midpoint.x+nx*support,y:midpoint.y+ny*support};
        const score=dist(center,proposed);
        if(score>1.25||best&&score>=best.score)continue;
        const tangent=Math.atan2(dy,dx);
        // Equal shapes preserve the parent polygon phase. Mixed joins align
        // a side of the new regular polygon exactly with the existing edge.
        const rotation=shape===shapeOf(edit)?Number(edit.rotation)||0:
          shape==='square'?tangent+Math.PI:tangent+Math.PI/2-Math.PI/SEGMENTS;
        best={center:proposed,rotation,terraceId:edit.id,edgeIndex:i,score};
      }
    }
    return best;
  }
  // Convex polygons: touching edges/corners have zero intersection area and
  // must be valid. This replaces the old circular bounding-radius veto.
  function polygonsOverlapInterior(a,b){
    for(const poly of [a,b])for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],nx=q.y-p.y,ny=p.x-q.x;
      const va=a.map(v=>v.x*nx+v.y*ny),vb=b.map(v=>v.x*nx+v.y*ny);
      if(Math.min(Math.max(...va),Math.max(...vb))-
         Math.max(Math.min(...va),Math.min(...vb))<=1e-6)return false;
    }
    return true;
  }
  function overlapsWalledTerrace(candidate){
    if(candidate.mode!=='walled')return false;
    return edits().some(edit=>edit.mode==='walled'&&polygonsOverlapInterior(candidate.top,edit.top));
  }
  // Boolean union of overlapping convex terrace footprints. Saved edits remain
  // independent primitives; visible perimeter is their exact polygonal union.
  // Splitting at every boundary intersection handles crossing, partial overlaps,
  // containment, L-shaped outlines and rotated round/square junctions.
  function exposedWallSegments(edit,index){
    const cache=geometryCache(),stored=cache.edges.get(edit);
    if(stored?.has(index))return stored.get(index);
    const a=edit.top[index],b=edit.top[(index+1)%edit.top.length];
    const vx=b.x-a.x,vy=b.y-a.y,L=Math.hypot(vx,vy);
    if(L<1e-8)return[];
    const edgeBox={x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),
      x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)};
    const ux=vx/L,uy=vy/L,area=edit.top.reduce((sum,p,i)=>{
      const q=edit.top[(i+1)%edit.top.length];return sum+p.x*q.y-q.x*p.y;
    },0);
    const sign=area<0?-1:1;
    const all=edits(),editIndex=all.indexOf(edit);
    const others=all.filter(other=>other!==edit&&other.id!==edit.id&&other.mode===edit.mode&&
      Math.abs(other.targetZ-edit.targetZ)<1e-7&&Math.abs(other.baseZ-edit.baseZ)<1e-7&&
      boxesIntersect(edgeBox,editBounds(other).top));
    const cuts=[0,1],cross=(x,y,X,Y)=>x*Y-y*X;
    const add=t=>{if(t>1e-8&&t<1-1e-8)cuts.push(t)};
    for(const other of others)for(let j=0;j<other.top.length;j++){
      const c=other.top[j],d=other.top[(j+1)%other.top.length];
      const wx=d.x-c.x,wy=d.y-c.y,cx=c.x-a.x,cy=c.y-a.y;
      const denom=cross(vx,vy,wx,wy);
      if(Math.abs(denom)>1e-9){
        const t=cross(cx,cy,wx,wy)/denom,u=cross(cx,cy,vx,vy)/denom;
        if(t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8)add(t);
      }else if(Math.abs(cross(cx,cy,vx,vy))<1e-7*L){
        add((cx*ux+cy*uy)/L);
        add(((d.x-a.x)*ux+(d.y-a.y)*uy)/L);
      }
    }
    cuts.sort((x,y)=>x-y);
    const result=[],point=t=>({x:a.x+vx*t,y:a.y+vy*t});
    for(let i=1;i<cuts.length;i++){
      const lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-7)continue;
      const mid=point((lo+hi)/2);
      // Sample just outside this oriented polygon edge. If another terrace
      // occupies that side, this is an internal boolean seam, not a wall.
      const outside={x:mid.x+sign*uy*.0001,y:mid.y-sign*ux*.0001};
      if(others.some(other=>pointInPolygon(outside,other.top)))continue;
      // Identical outside boundaries should appear once, not be doubled.
      const sameLine=others.some(other=>{
        if(String(other.id)<String(edit.id))return other.top.some((c,j)=>{
          const d=other.top[(j+1)%other.top.length],wx=d.x-c.x,wy=d.y-c.y;
          return wx*ux+wy*uy>0&&dist(mid,segmentProjection(mid,c,d))<1e-6;
        });
        return false;
      });
      if(!sameLine){
        const laterFlat=all.slice(editIndex+1).some(other=>other.mode==='flat'&&
          boxContains(mid,editBounds(other).top)&&pointInPolygon(mid,other.top));
        if(!laterFlat)result.push({a:point(lo),b:point(hi)});
      }
    }
    let memo=cache.edges.get(edit);
    if(!memo){memo=new Map();cache.edges.set(edit,memo);}
    memo.set(index,result);
    return result;
  }
  function unionContours(){
    const groups=new Map(),key=pt=>Math.round(pt.x*1e6)+','+Math.round(pt.y*1e6);
    for(const edit of edits()){
      if(edit.mode!=='walled')continue;
      const level=edit.baseZ+':'+edit.targetZ;
      if(!groups.has(level))groups.set(level,{baseZ:edit.baseZ,targetZ:edit.targetZ,edges:[]});
      for(let i=0;i<edit.top.length;i++)groups.get(level).edges.push(...exposedWallSegments(edit,i));
    }
    const out=[];
    for(const group of groups.values()){
      const unused=new Map();
      for(const edge of group.edges){
        const k=key(edge.a);if(!unused.has(k))unused.set(k,[]);
        unused.get(k).push(edge);
      }
      for(const edge of group.edges){
        if(!unused.get(key(edge.a))?.includes(edge))continue;
        const loop=[];let cur=edge,guard=0;
        while(cur&&guard++<=group.edges.length+1){
          loop.push(cur.a);
          const bucket=unused.get(key(cur.a));bucket.splice(bucket.indexOf(cur),1);
          if(key(cur.b)===key(loop[0]))break;
          cur=unused.get(key(cur.b))?.[0];
        }
        if(loop.length>=3)out.push({baseZ:group.baseZ,targetZ:group.targetZ,points:loop});
      }
    }
    return out;
  }
  // Convex polygon subtraction. Flat cuts remain independent persisted edits,
  // rather than destructively modifying older terrace records.
  function polygonHalfPlane(poly,a,b,inside){
    if(!poly.length)return[];
    const result=[],side=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q);
      const pin=inside?dp>=-1e-9:dp<=1e-9,qin=inside?dq>=-1e-9:dq<=1e-9;
      if(pin)result.push(p);
      if(pin!==qin){
        const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
      }
    }
    return result;
  }
  function polygonArea(poly){
    return Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-q.x*p.y},0))/2;
  }
  function subtractPolygon(poly,clip){
    let inside=poly,result=[];
    for(let i=0;i<clip.length&&inside.length>=3;i++){
      const a=clip[i],b=clip[(i+1)%clip.length],outside=polygonHalfPlane(inside,a,b,false);
      if(outside.length>=3&&polygonArea(outside)>1e-8)result.push(outside);
      inside=polygonHalfPlane(inside,a,b,true);
    }
    return result;
  }
  function visibleTerracePieces(edit){
    const cache=geometryCache(),saved=cache.pieces.get(edit);
    if(saved)return saved;
    const all=edits(),index=all.indexOf(edit);
    let pieces=[edit.top];
    for(let i=0;i<all.length;i++){
      const other=all[i];if(other===edit||!other.top?.length)continue;
      if((other.mode==='flat'&&i>index||other.mode===edit.mode&&i<index&&
          Math.abs(other.baseZ-edit.baseZ)<1e-7&&Math.abs(other.targetZ-edit.targetZ)<1e-7)&&
         boxesIntersect(editBounds(edit).top,editBounds(other).top)){
        pieces=pieces.flatMap(poly=>subtractPolygon(poly,other.top));
        if(!pieces.length)break;
      }
    }
    cache.pieces.set(edit,pieces);
    return pieces;
  }
  // Recompute cut faces only when the authored geometry changes. This is also
  // called from terrainSlopeKind/pathfinding, so per-frame sampling is too costly.
  let flatWallsMemo=new WeakMap();
  let flatWallsRevision=null;
  function flatWallSegments(edit){
    if(edit.mode!=='flat')return[];
    const all=edits();
    if(!flatWallsRevision||flatWallsRevision.relief!==State.relief||
       flatWallsRevision.list!==all||flatWallsRevision.length!==all.length||
       flatWallsRevision.last!==all[all.length-1]){
      flatWallsRevision={relief:State.relief,list:all,length:all.length,last:all[all.length-1]};
      flatWallsMemo=new WeakMap();
    }
    if(flatWallsMemo.has(edit))return flatWallsMemo.get(edit);
    const result=[],EPS=.002,STEP=.25,HEIGHT_EPS=.0001;
    const sample=(p,nx,ny)=>{
      const inside={x:p.x-nx*EPS,y:p.y-ny*EPS};
      const outside={x:p.x+nx*EPS,y:p.y+ny*EPS};
      const h=q=>elevationAt(q,typeof terrainBaseElevation==='function'?terrainBaseElevation(q):0);
      return{inner:h(inside),outer:h(outside)};
    };
    const signedArea=edit.top.reduce((z,p,i)=>{
      const q=edit.top[(i+1)%edit.top.length];return z+p.x*q.y-q.x*p.y;
    },0);
    const sign=signedArea<0?-1:1;
    for(let i=0;i<edit.top.length;i++){
      const a=edit.top[i],b=edit.top[(i+1)%edit.top.length];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<1e-7)continue;
      const nx=sign*dy/len,ny=-sign*dx/len;
      const count=Math.max(1,Math.ceil(len/STEP));
      let active=null;
      for(let j=0;j<count;j++){
        const at=t=>({x:a.x+dx*t,y:a.y+dy*t});
        const p=at(j/count),q=at((j+1)/count);
        const hp=sample(p,nx,ny),hq=sample(q,nx,ny);
        const mid=sample(at((j+.5)/count),nx,ny);
        // Do not wall untouched H0 ground, or a cut fully hidden by a newer
        // Flat. Adjacent intervals with constant height merge into one quad.
        if(Math.max(Math.abs(hp.outer-hp.inner),Math.abs(hq.outer-hq.inner),
                    Math.abs(mid.outer-mid.inner))<HEIGHT_EPS){
          if(active){result.push(active);active=null;}
          continue;
        }
        const part={a:p,b:q,baseZ:hp.inner,baseZB:hq.inner,
          targetZ:hp.outer,targetZB:hq.outer};
        const flatHeight=Math.abs(hp.outer-hq.outer)<1e-5&&
          Math.abs(hp.inner-hq.inner)<1e-5;
        const merge=active&&flatHeight&&
          Math.abs(active.targetZ-part.targetZ)<1e-5&&
          Math.abs(active.baseZ-part.baseZ)<1e-5&&
          Math.abs(active.targetZB-part.targetZB)<1e-5&&
          Math.abs(active.baseZB-part.baseZB)<1e-5;
        if(merge)active.b=part.b;
        else{if(active)result.push(active);active=part;}
      }
      if(active)result.push(active);
    }
    flatWallsMemo.set(edit,result);
    return result;
  }
  function boundaryContains(point,poly){
    return poly.some((a,i)=>dist(point,segmentProjection(point,a,poly[(i+1)%poly.length]))<1e-6);
  }
  function insideEdit(point,edit){
    return boxContains(point,editBounds(edit).top)&&
      (pointInPolygon(point,edit.top)||boundaryContains(point,edit.top));
  }
  function elevationAt(point,baseZ=0,{excludeWalled=false}={}){
    // Spatially sorted in commit order; distant cells do no per-edit work.
    const all=nearbyHeightEdits(point);
    let z=Math.max(0,Number(baseZ)||0);
    // A Flat cut resets all older terrain and natural relief to H0; edits
    // committed afterwards can raise the area again.
    for(const edit of all){
      // Most ground-grid vertices never touch the authored edit. Bounding
      // rejection avoids expensive polygon tests over every polygon side.
      const box=editBounds(edit);
      if(!boxContains(point,box.outer))continue;
      if(edit.mode==='flat'){
        if(insideEdit(point,edit))z=0;
        continue;
      }
      if(excludeWalled&&edit.mode==='walled')continue;
      if(insideEdit(point,edit)){
        z=edit.targetZ<edit.baseZ?Math.min(z,edit.targetZ):Math.max(z,edit.targetZ);
        continue;
      }
      if(edit.mode==='walled'||!pointInPolygon(point,edit.outer))continue;
      let distance;
      if(shapeOf(edit)==='square'){
        const angle=-(Number(edit.rotation)||0),ca=Math.cos(angle),sa=Math.sin(angle);
        const dx=point.x-edit.center.x,dy=point.y-edit.center.y;
        distance=Math.max(Math.abs(dx*ca-dy*sa),Math.abs(dx*sa+dy*ca));
      }else distance=dist(point,edit.center);
      const t=clamp((distance-edit.radius)/Math.max(.001,edit.edgeWidth),0,1);
      const candidate=edit.targetZ+(edit.baseZ-edit.targetZ)*t;
      z=edit.targetZ<edit.baseZ?Math.min(z,candidate):Math.max(z,candidate);
    }
    return Math.max(0,z);
  }
  function isFlatAt(point){
    return edits().some(edit=>edit.mode==='flat'&&insideEdit(point,edit));
  }
  function slopeAt(point){
    const all=edits(),lastFlat=all.findLastIndex(edit=>edit.mode==='flat'&&insideEdit(point,edit));
    const active=all.slice(lastFlat+1).filter(edit=>edit.mode!=='flat').reverse();
    for(const edit of all)if(edit.mode==='flat'&&
      dist(point,edit.center)<edit.radius*(shapeOf(edit)==='square'?Math.SQRT2:1)+.2&&
      flatWallSegments(edit).some(edge=>
        dist(point,segmentProjection(point,edge.a,edge.b))<=.12))return 'steep';
    for(const edit of active)if(edit.mode==='walled'&&edit.top.some((_,i)=>
      exposedWallSegments(edit,i).some(edge=>
        dist(point,segmentProjection(point,edge.a,edge.b))<=.12)))return 'steep';
    if(active.some(edit=>insideEdit(point,edit)))return null;
    for(const edit of active)
      if(pointInPolygon(point,edit.outer))return edit.mode==='walled'?'steep':'gentle';
    return null;
  }
  function snapWallAnchor(point,wallWidth=.5){
    let best=null;
    for(const edit of edits()){
      if(edit.mode!=='walled'||!edit.top?.length)continue;
      for(let i=0;i<edit.top.length;i++)for(const {a,b} of exposedWallSegments(edit,i)){
        const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=edit.center.x-mid.x,ny=edit.center.y-mid.y,L=Math.hypot(nx,ny)||1;
        nx/=L;ny/=L;
        for(const [vertex,endpoint] of [[a,'a'],[b,'b']]){
          const edgeScore=dist(point,vertex);
          if(edgeScore>.4)continue;
          const axis={x:vertex.x+nx*wallWidth/2,y:vertex.y+ny*wallWidth/2},score=dist(point,axis);
          if(!best||score<best.score)best={score,point:axis,edgePoint:{...vertex},structureId:'terraform:'+edit.id,magnet:true,terraceId:edit.id,edgeIndex:i,endpoint};
        }
      }
      if(best?.edgePoint)continue;
      for(let i=0;i<edit.top.length;i++)for(const {a,b} of exposedWallSegments(edit,i)){
        const q=segmentProjection(point,a,b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=edit.center.x-mid.x,ny=edit.center.y-mid.y,L=Math.hypot(nx,ny)||1;
        nx/=L;ny/=L;
        const axis={x:q.x+nx*wallWidth/2,y:q.y+ny*wallWidth/2},score=dist(point,axis);
        if(score<=.75&&(!best||score<best.score))
          best={score,point:axis,edgePoint:{x:q.x,y:q.y},structureId:'terraform:'+edit.id,magnet:true,terraceId:edit.id,edgeIndex:i};
      }
    }
    return best;
  }
  function wallGroundZ(wall){
    if(wall?.type!=='wall')return null;
    const a=String(wall.aSnap||''),b=String(wall.bSnap||'');
    if(!a.startsWith('terraform:')||a!==b)return null;
    const edit=edits().find(item=>'terraform:'+item.id===a&&item.mode==='walled');
    return edit?edit.targetZ:null;
  }
  function preview(center,options={}){
    const mode=options.mode==='walled'?'walled':options.mode==='flat'?'flat':'terrain';
    const shape=shapeOf(options);
    const radius=clamp(Number(options.radius)||4,LIMITS.minRadius,LIMITS.maxRadius);
    const delta=Number(options.delta)<0?-1:1;
    const magnetic=mode==='walled'&&options.magnet!==false;
    const wallSnap=magnetic?wallMagnet(center,radius,shape):null;
    // Union is always active; snapping to another terrace would unnecessarily
    // prevent a freely overlapping boolean footprint.
    const resolvedCenter=wallSnap?.center||center;
    const naturalZ=Number(terrainBaseElevation(resolvedCenter))||0;
    const pickedZ=Math.ceil(elevationAt(resolvedCenter,naturalZ)-1e-9);
    let baseZ=Math.max(0,pickedZ===0?0:pickedZ);
    let targetZ=clamp(baseZ+delta,LIMITS.minZ,LIMITS.maxZ);
    const edgeWidth=mode==='terrain'?2:0;
    const rotation=wallSnap?.rotation??(Number.isFinite(Number(options.rotation))?
      Number(options.rotation):shape==='square'?0:-Math.PI/SEGMENTS);
    const top=polygon(resolvedCenter,radius,rotation,shape);
    const outer=polygon(resolvedCenter,radius+edgeWidth,rotation,shape);
    // Graded hills union as soon as their sloped aprons overlap, even if the
    // flat plateau polygons themselves are still separated.
    const overlapping=mode==='flat'?[]:edits().filter(edit=>edit.mode===mode&&
      (mode==='terrain'?polygonsOverlapInterior(outer,edit.outer):polygonsOverlapInterior(top,edit.top)));
    if(overlapping.length&&mode!=='flat'){
      const sameDirection=overlapping.filter(edit=>Math.sign(edit.targetZ-edit.baseZ)===delta);
      if(sameDirection.length){
        // When extending an existing feature, inherit its H instead of
        // accidentally stacking one level from a partially raised pick point.
        // Both walled terraces and graded/sloped hills use this union rule.
        baseZ=sameDirection[0].baseZ;targetZ=sameDirection[0].targetZ;
      }
    }
    if(mode==='flat'){baseZ=0;targetZ=0;}
    const ghost={
      id:null,previewOnly:true,mode,shape,center:{x:resolvedCenter.x,y:resolvedCenter.y},radius,delta,
      baseZ,targetZ,edgeWidth,rotation,top,outer,wallSnap,
      profile:mode==='walled'?'vertical':mode==='flat'?'flat':'graded',
      material:mode==='walled'?'stone':'terrain',ok:true,reason:''
    };
    if(!insideBuild(outer)){
      ghost.ok=false;ghost.reason='Terraforming must remain inside the build area';
    }else if(mode!=='flat'&&delta<0&&baseZ<=0){
      ghost.ok=false;ghost.reason='Minimum terrain height is H0';
    }else if(mode==='walled'&&overlapping.some(edit=>
      Math.abs(edit.baseZ-baseZ)>1e-7||Math.abs(edit.targetZ-targetZ)>1e-7)){
      ghost.ok=false;ghost.reason='Boolean Union requires matching base and top elevation';
    }
    return ghost;
  }
  function commit(ghost){
    if(!ghost?.ok)return false;
    const fresh=preview(ghost.center,{...ghost,magnet:false});
    if(!fresh.ok)return false;
    const used=new Set(edits().map(edit=>edit.id));
    let index=1;while(used.has('terraform-'+index))index++;
    edits().push({...fresh,id:'terraform-'+index,previewOnly:false,ok:true,reason:''});
    geometryRevision=null;
    flatWallsRevision=null;
    return true;
  }
  function clear(){
    const list=edits(),count=list.length;
    list.splice(0,list.length);
    geometryRevision=null;
    flatWallsRevision=null;
    flatWallsMemo=new WeakMap();
    if(typeof clearReliefBandCache==='function')clearReliefBandCache();
    if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
    if(typeof terrainMarkLayoutCache!=='undefined')terrainMarkLayoutCache=null;
    if(typeof springFlowerLayoutCache!=='undefined')springFlowerLayoutCache=null;
    return count;
  }
  function facePolygons(edit){
    const faces=[];
    if(edit.mode==='flat'){
      for(const edge of flatWallSegments(edit)){
        const screen=projectClippedTerrain([
          {...edge.a,z:edge.baseZ},{...edge.b,z:edge.baseZB},
          {...edge.b,z:edge.targetZB},{...edge.a,z:edge.targetZ}
        ]);
        if(screen.length>=3)faces.push({screen,index:0,depth:screen.reduce((sum,p)=>sum+p.y,0)/screen.length});
      }
      return faces;
    }
    for(let i=0;i<edit.top.length;i++){
      const segments=exposedWallSegments(edit,i);
      for(const edge of segments){
        // Graded shapes use the full outer ring; masonry edges have zero offset.
        const vertexA=edit.top[i],vertexB=edit.top[(i+1)%edit.top.length];
        const blend=t=>({
          x:edit.outer[i].x+(edit.outer[(i+1)%edit.top.length].x-edit.outer[i].x)*t,
          y:edit.outer[i].y+(edit.outer[(i+1)%edit.top.length].y-edit.outer[i].y)*t
        });
        const outerA=edit.mode==='walled'?edge.a:blend(segmentProjection(edge.a,vertexA,vertexB).t);
        const outerB=edit.mode==='walled'?edge.b:blend(segmentProjection(edge.b,vertexA,vertexB).t);
        const vertices=[
          {...outerA,z:edit.baseZ},{...outerB,z:edit.baseZ},
          {...edge.b,z:edit.targetZ},{...edge.a,z:edit.targetZ}
        ];
        const screen=projectClippedTerrain(vertices);
        if(screen.length>=3)faces.push({screen,depth:screen.reduce((sum,p)=>sum+p.y,0)/screen.length,index:i});
      }
    }
    return faces.sort((a,b)=>a.depth-b.depth);
  }
  function drawEdit(edit,{ghost=false}={}){
    if(!edit?.top?.length||typeof ctx==='undefined')return;
    const winter=State.season==='winter',valid=edit.ok!==false;
    const faces=facePolygons(edit);
    ctx.save();
    if(ghost)ctx.globalAlpha=.72;
    for(const face of faces){
      const fill=ghost
        ?(valid?'rgba(68,207,134,.46)':'rgba(236,61,70,.52)')
        :edit.mode==='walled'
          ?(face.index%2?'#49443f':'#686057')
          :(winter?'#d2d8d3':face.index%2?'#464630':'#514e37');
      pathPolygon(face.screen,fill,ghost?(valid?'rgba(111,255,175,.95)':'rgba(255,95,101,.98)'):null,ghost?1.6:0);
    }
    const tops=ghost||edit.mode==='flat'?[edit.top]:visibleTerracePieces(edit);
    for(const piece of tops){
    const top=projectClippedTerrain(piece.map(p=>({...p,z:edit.targetZ})));
    if(top.length>=3){
      const fill=ghost
        ?(valid?'rgba(78,224,149,.28)':'rgba(238,54,64,.34)')
        :(winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b'));
      pathPolygon(top,fill,ghost?(valid?'rgba(126,255,187,.98)':'rgba(255,86,94,.98)'):
        edit.mode==='walled'||edit.mode==='flat'?null:'rgba(210,194,151,.28)',
        ghost?2.2:edit.mode==='walled'||edit.mode==='flat'?0:1);
      if(!ghost&&edit.mode==='walled'){
        ctx.strokeStyle='rgba(210,194,151,.28)';ctx.lineWidth=1;
        ctx.beginPath();
        for(let i=0;i<edit.top.length;i++)for(const edge of exposedWallSegments(edit,i)){
          const a=w2sRaw(edge.a,edit.targetZ),b=w2sRaw(edge.b,edit.targetZ);
          ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        }
        ctx.stroke();
      }
    }
    }
    if(ghost){
      const label=w2sRaw(edit.center,Math.max(edit.baseZ,edit.targetZ)+.16);
      ctx.setLineDash([6,4]);
      const outer=edit.outer.map(p=>w2sRaw(p,edit.baseZ));
      ctx.beginPath();outer.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.strokeStyle=valid?'rgba(126,255,187,.92)':'rgba(255,86,94,.98)';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=valid?'#d9ffe8':'#ffd7d9';ctx.font='700 12px system-ui';ctx.textAlign='center';
      ctx.fillText((edit.mode==='flat'?'FLAT · ':edit.wallSnap?'MAGNET · ':'')+'H '+edit.targetZ.toFixed(1),label.x,label.y-13);
    }
    ctx.restore();
  }
  function drawCommitted(){for(const edit of edits())drawEdit(edit)}
  function drawGhost(ghost){drawEdit(ghost,{ghost:true})}
  function drawMagnets(){
    if(State.tool?.kind!=='linear'||State.tool.linear!=='wall'||typeof ctx==='undefined')return;
    ctx.save();ctx.fillStyle='rgba(119,236,178,.92)';ctx.strokeStyle='rgba(19,61,42,.95)';ctx.lineWidth=1.2;
    const seen=new Set();
    for(const edit of edits())if(edit.mode==='walled')for(let i=0;i<edit.top.length;i++)
      for(const edge of exposedWallSegments(edit,i))for(const point of [edge.a,edge.b]){
        const key=Math.round(point.x*1e5)+','+Math.round(point.y*1e5);
        if(seen.has(key))continue;
        seen.add(key);
        const p=w2sRaw(point,edit.targetZ+.03);ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    ctx.restore();
  }

  window.ConquerTerraforming=Object.freeze({
    LIMITS,SHAPES,edits,preview,commit,clear,elevationAt,slopeAt,isFlatAt,snapWallAnchor,wallGroundZ,
    exposedWallSegments,unionContours,polygonsOverlapInterior,visibleTerracePieces,flatWallSegments,
    drawCommitted,drawGhost,drawMagnets
  });
})();
