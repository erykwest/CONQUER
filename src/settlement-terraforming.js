'use strict';
// Player-authored terrain edits. The module owns validation and geometry while
// the existing terrainElevation/render/navigation contracts remain authoritative.
(() => {
  const SEGMENTS=24;
  const SHAPES=Object.freeze(['round','square']);
  const shapeOf=edit=>edit?.shape==='square'?'square':'round';
  const LIMITS=Object.freeze({minRadius:2,maxRadius:8,minZ:-3,maxZ:8});

  function edits(){
    if(!State.relief)return[];
    if(!Array.isArray(State.relief.terraforming))State.relief.terraforming=[];
    for(const edit of State.relief.terraforming){
      if(edit?.mode!=='walled'||!edit.center||!Number.isFinite(Number(edit.radius)))continue;
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
    const a=edit.top[index],b=edit.top[(index+1)%edit.top.length];
    const vx=b.x-a.x,vy=b.y-a.y,L=Math.hypot(vx,vy);
    if(L<1e-8)return[];
    const ux=vx/L,uy=vy/L,area=edit.top.reduce((sum,p,i)=>{
      const q=edit.top[(i+1)%edit.top.length];return sum+p.x*q.y-q.x*p.y;
    },0);
    const sign=area<0?-1:1;
    const others=edits().filter(other=>other!==edit&&other.id!==edit.id&&other.mode==='walled'&&
      Math.abs(other.targetZ-edit.targetZ)<1e-7&&Math.abs(other.baseZ-edit.baseZ)<1e-7);
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
          return wx*ux+wy*uy>0&&pointSegmentDistance(mid,c,d)<1e-6;
        });
        return false;
      });
      if(!sameLine)result.push({a:point(lo),b:point(hi)});
    }
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
  function boundaryContains(point,poly){
    return poly.some((a,i)=>dist(point,segmentProjection(point,a,poly[(i+1)%poly.length]))<1e-6);
  }
  function elevationAt(point,baseZ=0,{excludeWalled=false}={}){
    let z=Number(baseZ)||0;
    for(const edit of edits()){
      if(excludeWalled&&edit.mode==='walled')continue;
      if(pointInPolygon(point,edit.top)||boundaryContains(point,edit.top)){
        if(edit.mode==='walled')z=edit.targetZ;
        else z=edit.targetZ>=edit.baseZ?Math.max(z,edit.targetZ):Math.min(z,edit.targetZ);
        continue;
      }
      if(!pointInPolygon(point,edit.outer))continue;
      let distance;
      if(shapeOf(edit)==='square'){
        const angle=-(Number(edit.rotation)||0),ca=Math.cos(angle),sa=Math.sin(angle);
        const dx=point.x-edit.center.x,dy=point.y-edit.center.y;
        distance=Math.max(Math.abs(dx*ca-dy*sa),Math.abs(dx*sa+dy*ca));
      }else distance=dist(point,edit.center);
      const t=clamp((distance-edit.radius)/Math.max(.001,edit.edgeWidth),0,1);
      const candidate=edit.targetZ+(edit.baseZ-edit.targetZ)*t;
      // Adjacent or overlapping graded hills combine as a continuous surface
      // instead of the most recently authored edit punching a valley into it.
      z=edit.targetZ>=edit.baseZ?Math.max(z,candidate):Math.min(z,candidate);
    }
    return z;
  }
  function slopeAt(point){
    const ordered=edits().slice().reverse();
    // Shared faces are not cliffs. Flat tops take priority over another
    // adjoining hill's sloped apron, so merged plateaux stay buildable.
    for(const edit of ordered)if(edit.mode==='walled'&&edit.top.some((_,i)=>
      exposedWallSegments(edit,i).some(edge=>
        dist(point,segmentProjection(point,edge.a,edge.b))<=.12)))return 'steep';
    if(ordered.some(edit=>pointInPolygon(point,edit.top)))return null;
    for(const edit of ordered)
      if(pointInPolygon(point,edit.outer))return edit.mode==='walled'?'steep':'gentle';
    return null;
  }
  function snapWallAnchor(point,wallWidth=.5){
    let best=null;
    for(const edit of edits()){
      if(edit.mode!=='walled'||!edit.top?.length)continue;
      for(let i=0;i<edit.top.length;i++){
        const a=edit.top[i],b=edit.top[(i+1)%edit.top.length],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=edit.center.x-mid.x,ny=edit.center.y-mid.y,L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;
        for(const [vertex,endpoint] of [[a,'a'],[b,'b']]){
          const edgeScore=dist(point,vertex);
          if(edgeScore>.4)continue;
          const axis={x:vertex.x+nx*wallWidth/2,y:vertex.y+ny*wallWidth/2},score=dist(point,axis);
          if(!best||score<best.score)best={score,point:axis,edgePoint:{...vertex},structureId:'terraform:'+edit.id,magnet:true,terraceId:edit.id,edgeIndex:i,endpoint};
        }
      }
      if(best?.edgePoint)continue;
      for(let i=0;i<edit.top.length;i++){
        const a=edit.top[i],b=edit.top[(i+1)%edit.top.length],q=segmentProjection(point,a,b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=edit.center.x-mid.x,ny=edit.center.y-mid.y,L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;
        const axis={x:q.x+nx*wallWidth/2,y:q.y+ny*wallWidth/2},score=dist(point,axis);
        if(score<=.75&&(!best||score<best.score)){
          best={score,point:axis,edgePoint:{x:q.x,y:q.y},structureId:'terraform:'+edit.id,magnet:true,terraceId:edit.id,edgeIndex:i};
        }
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
    const mode=options.mode==='walled'?'walled':'terrain';
    const shape=shapeOf(options);
    const radius=clamp(Number(options.radius)||4,LIMITS.minRadius,LIMITS.maxRadius);
    const delta=Number(options.delta)<0?-1:1;
    const magnetic=mode==='walled'&&options.magnet!==false;
    const wallSnap=magnetic?wallMagnet(center,radius,shape):null;
    const terraceSnap=magnetic&&!wallSnap&&options.boolean!=='union'?terraceMagnet(center,radius,shape):null;
    const resolvedCenter=wallSnap?.center||terraceSnap?.center||center;
    const naturalZ=Number(terrainBaseElevation(resolvedCenter))||0;
    const pickedZ=Math.ceil(elevationAt(resolvedCenter,naturalZ)-1e-9);
    let baseZ=pickedZ===0?0:pickedZ; // avoid -0 from ceil(negative epsilon)
    let targetZ=clamp(baseZ+delta,LIMITS.minZ,LIMITS.maxZ);
    const edgeWidth=mode==='walled'?0:2;
    const rotation=wallSnap?.rotation??terraceSnap?.rotation??
      (Number.isFinite(Number(options.rotation))?Number(options.rotation):
        shape==='square'?0:-Math.PI/SEGMENTS);
    const top=polygon(resolvedCenter,radius,rotation,shape);
    const outer=polygon(resolvedCenter,radius+edgeWidth,rotation,shape);
    const overlapping=mode==='walled'?edits().filter(edit=>edit.mode==='walled'&&polygonsOverlapInterior(top,edit.top)):[];
    // Explicit Union reuses the existing level even if the picked point sits
    // on its plateau (where a normal Raise operation would mean +1 level).
    if(mode==='walled'&&options.boolean==='union'&&overlapping.length){
      const reference=overlapping[0];
      if(Math.sign(reference.targetZ-reference.baseZ)===delta){
        baseZ=reference.baseZ;targetZ=reference.targetZ;
      }
    }
    const ghost={
      id:null,previewOnly:true,mode,shape,boolean:options.boolean==='union'?'union':'normal',center:{x:resolvedCenter.x,y:resolvedCenter.y},radius,delta,
      baseZ,targetZ,edgeWidth,rotation,top,outer,wallSnap,terraceSnap,
      profile:mode==='walled'?'vertical':'graded',material:mode==='walled'?'stone':'terrain',
      ok:true,reason:''
    };
    if(!insideBuild(outer)){
      ghost.ok=false;
      ghost.reason='Terraforming must remain inside the build area';
    }else if(overlapping.length){
      const compatible=overlapping.every(edit=>
        Math.abs(edit.baseZ-baseZ)<1e-7&&Math.abs(edit.targetZ-targetZ)<1e-7);
      if(ghost.boolean!=='union'||!compatible){
        ghost.ok=false;
        ghost.reason=ghost.boolean==='union'
          ?'Boolean Union requires matching base and top elevation'
          :'Cannot overlap the interior of another walled terrace';
      }
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
    return true;
  }
  function clear(){
    const list=edits(),count=list.length;
    list.splice(0,list.length);
    if(typeof clearReliefBandCache==='function')clearReliefBandCache();
    if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
    if(typeof terrainMarkLayoutCache!=='undefined')terrainMarkLayoutCache=null;
    if(typeof springFlowerLayoutCache!=='undefined')springFlowerLayoutCache=null;
    return count;
  }
  function facePolygons(edit){
    const faces=[];
    for(let i=0;i<edit.top.length;i++){
      const segments=edit.mode==='walled'?exposedWallSegments(edit,i):
        [{a:edit.top[i],b:edit.top[(i+1)%edit.top.length]}];
      for(const edge of segments){
        // Graded shapes use the full outer ring; masonry edges have zero offset.
        const outerA=edit.mode==='walled'?edge.a:edit.outer[i];
        const outerB=edit.mode==='walled'?edge.b:edit.outer[(i+1)%edit.top.length];
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
    const top=projectClippedTerrain(edit.top.map(p=>({...p,z:edit.targetZ})));
    if(top.length>=3){
      const fill=ghost
        ?(valid?'rgba(78,224,149,.28)':'rgba(238,54,64,.34)')
        :(winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b'));
      pathPolygon(top,fill,ghost?(valid?'rgba(126,255,187,.98)':'rgba(255,86,94,.98)'):edit.mode==='walled'?null:'rgba(210,194,151,.28)',ghost?2.2:edit.mode==='walled'?0:1);
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
    if(ghost){
      const label=w2sRaw(edit.center,Math.max(edit.baseZ,edit.targetZ)+.16);
      ctx.setLineDash([6,4]);
      const outer=edit.outer.map(p=>w2sRaw(p,edit.baseZ));
      ctx.beginPath();outer.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.strokeStyle=valid?'rgba(126,255,187,.92)':'rgba(255,86,94,.98)';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=valid?'#d9ffe8':'#ffd7d9';ctx.font='700 12px system-ui';ctx.textAlign='center';
      ctx.fillText((edit.boolean==='union'?'UNION · ':edit.wallSnap?'MAGNET · ':'')+'H '+edit.targetZ.toFixed(1),label.x,label.y-13);
    }
    ctx.restore();
  }
  function drawCommitted(){for(const edit of edits().slice().sort((a,b)=>a.targetZ-b.targetZ))drawEdit(edit)}
  function drawGhost(ghost){drawEdit(ghost,{ghost:true})}
  function drawMagnets(){
    if(State.tool?.kind!=='linear'||State.tool.linear!=='wall'||typeof ctx==='undefined')return;
    ctx.save();ctx.fillStyle='rgba(119,236,178,.92)';ctx.strokeStyle='rgba(19,61,42,.95)';ctx.lineWidth=1.2;
    for(const edit of edits())if(edit.mode==='walled')for(const point of edit.top){
      const p=w2sRaw(point,edit.targetZ+.03);ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }

  window.ConquerTerraforming=Object.freeze({
    LIMITS,SHAPES,edits,preview,commit,clear,elevationAt,slopeAt,snapWallAnchor,wallGroundZ,
    exposedWallSegments,unionContours,polygonsOverlapInterior,
    drawCommitted,drawGhost,drawMagnets
  });
})();
