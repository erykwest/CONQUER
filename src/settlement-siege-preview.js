'use strict';
// CONQUER siege preview (dev): plays the assault choreography of settlement-siege-assault.js
// inside the real game, against real structures, in the 3D world renderer. The engines and
// what the men carry are queued as dynamic meshes (ConquerWorld3D.addMesh), the men are the
// game's own soldiers (drawSoldierFigure -> depth-tested billboards with colliders), and the
// moat is filled through the game's own fill patch (settlement-crossings fills).
//   ?siege=ram|mantlet|ladder|tower|moat   or   ConquerSiegePreview.start(kind)
// On an empty map it builds a test bay first: an H1 stone wall, a stone gate and a water moat.
(function(){
  const SA=()=>window.ConquerSiegeAssault,SE=()=>window.ConquerSiegeEngines3D,W=()=>window.ConquerWorld3D;
  const HOSTILE={main:'#171716',alt:'#e3bd31',mainDark:'#090909',altDark:'#95781a'};
  let run=null,raf=0;

  // Local frame of the assault: origin on the outer wall face in front of the gate,
  // +x towards the wall (against the gate's outward direction), +y along the wall.
  function frameOf(gate,wall){
    const a=Number(gate.angle)||0,out={x:Math.cos(a),y:Math.sin(a)},n={x:-out.x,y:-out.y},t={x:-n.y,y:n.x};
    const thick=Number(wall?.width)||.5,o={x:gate.x+out.x*thick/2,y:gate.y+out.y*thick/2};
    return{o,n,t,heading:Math.atan2(n.y,n.x),
      toWorld:(x,y)=>({x:o.x+n.x*x+t.x*y,y:o.y+n.y*x+t.y*y}),
      toLocal:p=>{const dx=p.x-o.x,dy=p.y-o.y;return{x:dx*n.x+dy*n.y,y:dx*t.x+dy*t.y}}};
  }
  function geometry(F,wall,gate,moat){
    const d=rectDims(gate),thick=Number(wall.width)||.5;
    const G={walk:structureHeight(wall),thick,gateHalf:d.h/2,gateH:structureHeight(gate),door:-(d.w/2-thick/2)};
    if(moat){
      const c=F.toLocal({x:(moat.a.x+moat.b.x)/2,y:(moat.a.y+moat.b.y)/2}),w=Number(moat.width)||1.5;
      G.moat=[c.x-w/2,c.x+w/2];
    }
    return G;
  }
  // Test bay on flat ground: H1 wall (tier 2) with a stone gate, a water moat 2.5 U out.
  function flatSpot(){
    for(let x=60;x<=150;x+=10)for(let y=40;y<=150;y+=10){
      let ok=true;
      for(let dx=-12;dx<=6&&ok;dx+=1.5)for(let dy=-12;dy<=12&&ok;dy+=1.5)if(Math.abs(terrainElevation({x:x+dx,y:y+dy}))>.001)ok=false;
      if(ok)return{x,y};
    }
    return{x:100,y:100};
  }
  function buildBay(){
    const c=flatSpot(),rs=structureRotationStep(Math.PI/2),width=wallWidthForTier(2),half=.75;
    const wall=(a,b)=>({id:uid(),type:'wall',width,level:1,tier:2,a,b,length:Math.hypot(b.x-a.x,b.y-a.y),rotationStep:rs});
    State.structures.push(
      wall({x:c.x,y:c.y-10},{x:c.x,y:c.y-half}),wall({x:c.x,y:c.y+half},{x:c.x,y:c.y+10}),
      {id:uid(),type:'gate',shape:'square',material:'stone',size:1.5,level:1,functions:[],x:c.x,y:c.y,angle:Math.PI,rotationStep:structureRotationStep(Math.PI)},
      {id:uid(),type:'moat',variant:'water',a:{x:c.x-3.5,y:c.y-10},b:{x:c.x-3.5,y:c.y+10},width:1.5,length:20,groundZ:0,fills:[]});
    invalidateSceneCache();
  }
  function findTarget(){
    const done=s=>!underConstruction(s);
    const gate=State.structures.find(s=>s.type==='gate'&&s.material!=='wood'&&done(s));
    if(!gate)return null;
    const walls=State.structures.filter(s=>s.type==='wall'&&done(s));
    const wall=walls.sort((a,b)=>segDist(gate,a)-segDist(gate,b))[0];
    if(!wall)return null;
    const F=frameOf(gate,wall);
    const moat=State.structures.filter(s=>s.type==='moat'&&done(s)).find(s=>{const l=F.toLocal(s.a),r=F.toLocal(s.b);return l.x<0&&r.x<0&&Math.abs(l.x)<8});
    return{gate,wall,moat,F,G:geometry(F,wall,gate,moat)};
  }
  function segDist(p,s){
    const ax=s.a.x,ay=s.a.y,dx=s.b.x-ax,dy=s.b.y-ay,L=dx*dx+dy*dy||1,k=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/L));
    return Math.hypot(p.x-ax-dx*k,p.y-ay-dy*k);
  }
  // Camera: attackers in front, scene centred.
  function frameCamera(target){
    const F=target.F,turn=v=>{const q=rotateViewPoint({x:F.o.x+v.x,y:F.o.y+v.y}),o=rotateViewPoint(F.o);return(q.x-o.x)+(q.y-o.y)};
    for(let r=0;r<4;r++){State.view.rotation=r;if(turn({x:-F.n.x,y:-F.n.y})>.5)break}
    State.view.scale=Math.max(State.view.scale,1.4);
    const wrap=document.getElementById('wrap')||document.body,rc=wrap.getBoundingClientRect(),c=F.toWorld(-2.2,0),p=w2s(c,0);
    State.view.x+=rc.width/2-p.x;State.view.y+=rc.height*.55-p.y;
    invalidateSceneCache();
  }
  // The game's fill patch for this crossing, kept in step with the choreography.
  function syncFill(sc){
    const moat=run.target.moat;if(!moat||!sc.fill)return;
    const F=run.target.F,c=F.toWorld((run.target.G.moat[0]+run.target.G.moat[1])/2,sc.fillY||0);
    const ux=moat.b.x-moat.a.x,uy=moat.b.y-moat.a.y,L=Math.hypot(ux,uy)||1,at=((c.x-moat.a.x)*ux+(c.y-moat.a.y)*uy)/L;
    if(!Array.isArray(moat.fills))moat.fills=[];
    let patch=run.patch;
    if(!patch||!moat.fills.includes(patch)){patch=run.patch={at,span:sc.fill.span,progress:0,preview:true};moat.fills.push(patch)}
    // Steps of 1/12: each step re-bakes the 3D ground.
    const p=Math.round(sc.fill.progress*12)/12;
    if(p!==patch.progress||Math.abs(patch.at-at)>1e-3||patch.span!==sc.fill.span){
      patch.at=at;patch.span=sc.fill.span;patch.progress=p;invalidateSceneCache(['ground','base']);
    }
  }
  function transformMesh(me,F){
    const pos=new Float32Array(me.pos.length);
    for(let i=0;i<me.pos.length;i+=3){const w=F.toWorld(me.pos[i],me.pos[i+1]);pos[i]=w.x;pos[i+1]=w.y;pos[i+2]=me.pos[i+2]}
    return{pos,col:me.col};
  }
  function time(){return run.frozen??(performance.now()/1000-run.t0)}
  // Called inside the game's frame, between the 3D back pass and the front pass.
  function drawFrame(){
    if(!run||!W()?.active?.())return;
    const t=time(),sc=SA().scene(run.kind,t,run.target.G),F=run.target.F;
    syncFill(sc);
    if(sc.engine){
      const p=sc.engine.place,w=F.toWorld(p.x,p.y);
      W().addMesh(SE().triangles(sc.engine.name,{x:w.x,y:w.y,z:0,heading:F.heading+(p.heading||0),team:run.team},sc.engine.state));
    }
    W().addMesh(transformMesh(SA().propsMesh(sc),F));
    sc.soldiers.forEach((s,i)=>{
      const w=F.toWorld(s.x,s.y);
      const bob=s.walk?Math.abs(Math.sin(t*9+i*1.3))*.02:s.climb?Math.abs(Math.sin(t*7+i))*.015:0;
      drawSoldierFigure(w,s.z+bob,s.type,'siege-'+s.id,0,run.livery);
    });
  }
  if(typeof drawCastleSoldiers==='function'){
    const original=drawCastleSoldiers;
    drawCastleSoldiers=function(){const r=original.apply(this,arguments);try{drawFrame()}catch(e){console.error('siege preview',e)}return r};
  }
  function loop(){raf=0;if(!run)return;draw();if(run.frozen==null)raf=requestAnimationFrame(loop)}
  function start(kind='ram',opts={}){
    if(!SA().KINDS.includes(kind))throw new Error('siege kind: '+SA().KINDS.join('|'));
    let target=findTarget();
    if(!target){buildBay();target=findTarget()}
    if(!target)throw new Error('no completed stone gate in a wall');
    if(run?.patch&&run.target.moat)run.target.moat.fills=run.target.moat.fills.filter(f=>f!==run.patch);
    run={kind,target,t0:performance.now()/1000,frozen:null,livery:opts.livery||HOSTILE,team:opts.team||HOSTILE.alt,patch:null};
    if(opts.camera!==false)frameCamera(target);
    if(!raf)raf=requestAnimationFrame(loop);
    return{kind,G:target.G};
  }
  function at(t){if(!run)return;run.frozen=t;draw()}
  function play(){if(!run)return;run.t0=performance.now()/1000-(run.frozen||0);run.frozen=null;if(!raf)raf=requestAnimationFrame(loop)}
  function stop(){
    if(run?.patch&&run.target.moat){run.target.moat.fills=run.target.moat.fills.filter(f=>f!==run.patch);invalidateSceneCache(['ground','base'])}
    run=null;draw();
  }
  window.ConquerSiegePreview={start,stop,at,play,state:()=>run&&{kind:run.kind,t:time(),G:run.target.G}};
  const wanted=new URLSearchParams(location.search).get('siege');
  if(wanted)window.addEventListener('load',()=>setTimeout(()=>{try{start(wanted)}catch(e){console.error('siege preview',e)}},300));
})();
