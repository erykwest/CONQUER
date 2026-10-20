'use strict';
// Player-authored terrain edits. The module owns validation and geometry while
// the existing terrainElevation/render/navigation contracts remain authoritative.
(() => {
  const SEGMENTS=24;
  const LIMITS=Object.freeze({minRadius:2,maxRadius:8,minZ:-3,maxZ:8});

  function edits(){
    if(!State.relief)return[];
    if(!Array.isArray(State.relief.terraforming))State.relief.terraforming=[];
    for(const edit of State.relief.terraforming){
      if(edit?.mode!=='walled'||!edit.center||!Number.isFinite(Number(edit.radius)))continue;
      if(edit.profile==='vertical'&&edit.material==='stone'&&edit.edgeWidth===0)continue;
      edit.profile='vertical';edit.material='stone';edit.edgeWidth=0;
      edit.top=polygon(edit.center,Number(edit.radius),Number(edit.rotation)||0);
      edit.outer=edit.top.map(p=>({...p}));
    }
    return State.relief.terraforming;
  }
  function polygon(center,radius,rotation=0){
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
  function wallMagnet(center,radius){
    const support=radius*Math.cos(Math.PI/SEGMENTS);
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
        rotation:Math.atan2(edgeNormal.y,edgeNormal.x)-Math.PI/SEGMENTS
      };
    }
    return best;
  }
  function overlapsWalledTerrace(candidate){
    if(candidate.mode!=='walled')return false;
    return edits().some(edit=>edit.mode==='walled'&&
      dist(candidate.center,edit.center)<candidate.radius+edit.radius+Math.max(candidate.edgeWidth||0,edit.edgeWidth||0)-1e-6);
  }
  function elevationAt(point,baseZ=0,{excludeWalled=false}={}){
    let z=Number(baseZ)||0;
    for(const edit of edits()){
      if(excludeWalled&&edit.mode==='walled')continue;
      if(pointInPolygon(point,edit.top)){
        z=edit.targetZ;
        continue;
      }
      if(!pointInPolygon(point,edit.outer))continue;
      const radial=dist(point,edit.center),t=clamp((radial-edit.radius)/Math.max(.001,edit.edgeWidth),0,1);
      z=edit.targetZ+(edit.baseZ-edit.targetZ)*t;
    }
    return z;
  }
  function slopeAt(point){
    for(const edit of edits().slice().reverse()){
      if(edit.mode==='walled'&&edit.top.some((a,i)=>dist(point,segmentProjection(point,a,edit.top[(i+1)%edit.top.length]))<=.12))return 'steep';
      if(pointInPolygon(point,edit.top))return null;
      if(pointInPolygon(point,edit.outer))return edit.mode==='walled'?'steep':'gentle';
    }
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
    const radius=clamp(Number(options.radius)||4,LIMITS.minRadius,LIMITS.maxRadius);
    const delta=Number(options.delta)<0?-1:1;
    const wallSnap=mode==='walled'&&options.magnet!==false?wallMagnet(center,radius):null;
    const resolvedCenter=wallSnap?.center||center;
    const naturalZ=Number(terrainBaseElevation(resolvedCenter))||0;
    const baseZ=elevationAt(resolvedCenter,naturalZ);
    const targetZ=clamp(Math.round((baseZ+delta)*2)/2,LIMITS.minZ,LIMITS.maxZ);
    const edgeWidth=mode==='walled'?0:2;
    const rotation=wallSnap?.rotation??(Number.isFinite(Number(options.rotation))?Number(options.rotation):-Math.PI/SEGMENTS);
    const top=polygon(resolvedCenter,radius,rotation),outer=polygon(resolvedCenter,radius+edgeWidth,rotation);
    const ghost={
      id:null,previewOnly:true,mode,center:{x:resolvedCenter.x,y:resolvedCenter.y},radius,delta,
      baseZ,targetZ,edgeWidth,rotation,top,outer,wallSnap,
      profile:mode==='walled'?'vertical':'graded',material:mode==='walled'?'stone':'terrain',
      ok:true,reason:''
    };
    if(!insideBuild(outer)){
      ghost.ok=false;
      ghost.reason='Terraforming must remain inside the build area';
    }else if(overlapsWalledTerrace(ghost)){
      ghost.ok=false;
      ghost.reason='Cannot place a walled terrace on another walled terrace';
    }
    return ghost;
  }
  function commit(ghost){
    if(!ghost?.ok)return false;
    const fresh=preview(ghost.center,ghost);
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
      const j=(i+1)%edit.top.length;
      const vertices=[
        {...edit.outer[i],z:edit.baseZ},{...edit.outer[j],z:edit.baseZ},
        {...edit.top[j],z:edit.targetZ},{...edit.top[i],z:edit.targetZ}
      ];
      const screen=projectClippedTerrain(vertices);
      if(screen.length>=3)faces.push({screen,depth:screen.reduce((sum,p)=>sum+p.y,0)/screen.length,index:i});
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
      pathPolygon(top,fill,ghost?(valid?'rgba(126,255,187,.98)':'rgba(255,86,94,.98)'):'rgba(210,194,151,.28)',ghost?2.2:1);
    }
    if(ghost){
      const label=w2sRaw(edit.center,Math.max(edit.baseZ,edit.targetZ)+.16);
      ctx.setLineDash([6,4]);
      const outer=edit.outer.map(p=>w2sRaw(p,edit.baseZ));
      ctx.beginPath();outer.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.strokeStyle=valid?'rgba(126,255,187,.92)':'rgba(255,86,94,.98)';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=valid?'#d9ffe8':'#ffd7d9';ctx.font='700 12px system-ui';ctx.textAlign='center';
      ctx.fillText((edit.wallSnap?'MAGNET · ':'')+'H '+edit.targetZ.toFixed(1),label.x,label.y-13);
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
    LIMITS,edits,preview,commit,clear,elevationAt,slopeAt,snapWallAnchor,wallGroundZ,
    drawCommitted,drawGhost,drawMagnets
  });
})();
