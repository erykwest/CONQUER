'use strict';
// CONQUER siege preview (dev): plays the assault choreography of settlement-siege-assault.js
// inside the real game, against real structures, in the 3D world renderer. The engines and
// what the men carry are queued as dynamic meshes (ConquerWorld3D.addMesh), the men are the
// game's own soldiers (drawSoldierFigure -> depth-tested billboards with colliders), and the
// moat is filled through the game's own fill patch (settlement-crossings fills).
//   ?siege=ram|mantlet|ladder|tower|moat[&level=2][&hides=1]   or   ConquerSiegePreview.start(kind,{level,hides})
// On an empty map it builds a test bay first: a stone wall (H1, or H2 with level=2), a stone
// gate and a water moat. On H2 the tower scene uses the level 2 tower (with archers on top).
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
  function buildBay(level=1){
    const c=flatSpot(),rs=structureRotationStep(Math.PI/2),width=wallWidthForTier(2),half=.75;
    const wall=(a,b)=>({id:uid(),type:'wall',width,level,tier:2,a,b,length:Math.hypot(b.x-a.x,b.y-a.y),rotationStep:rs,siegeTestBay:true});
    const gateId=uid();
    // Both stretches are seated on the gatehouse, which is also their stair.
    State.structures.push(
      {...wall({x:c.x,y:c.y-10},{x:c.x,y:c.y-half}),bSnap:gateId},{...wall({x:c.x,y:c.y+half},{x:c.x,y:c.y+10}),aSnap:gateId},
      {id:gateId,type:'gate',shape:'square',material:'stone',size:1.5,level,functions:[],x:c.x,y:c.y,angle:Math.PI,rotationStep:structureRotationStep(Math.PI),siegeTestBay:true},
      {id:uid(),type:'moat',variant:'water',a:{x:c.x-3.5,y:c.y-10},b:{x:c.x-3.5,y:c.y+10},width:1.5,length:20,groundZ:0,fills:[],siegeTestBay:true});
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
  const STOP_SHORT={ladder:4,tower:6};
  function time(){const t=run.frozen??(performance.now()/1000-run.t0);return run.blocked?Math.min(t,STOP_SHORT[run.kind]):t}
  // Called inside the game's frame, between the 3D back pass and the front pass.
  function drawFrame(){
    if(!run||!W()?.active?.())return;
    const t=time(),sc=SA().scene(run.kind,t,run.target.G,run.opts),F=run.target.F;
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
    const level=opts.level===2?2:1;
    let target=findTarget();
    if(!target){buildBay(level);target=findTarget()}
    if(!target)throw new Error('no completed stone gate in a wall');
    // The test bay follows the wall level asked for; a real settlement is never altered.
    if(target.wall.siegeTestBay&&opts.level&&target.wall.level!==level){
      for(const s of State.structures)if(s.siegeTestBay&&(s.type==='wall'||s.type==='gate'))s.level=level;
      invalidateSceneCache();target=findTarget();
    }
    if(run?.patch&&run.target.moat)run.target.moat.fills=run.target.moat.fills.filter(f=>f!==run.patch);
    run={kind,target,opts:{hides:!!opts.hides},t0:performance.now()/1000,frozen:null,livery:opts.livery||HOSTILE,team:opts.team||HOSTILE.alt,patch:null};
    // Ladders and towers cannot storm thin (T1) walls or walls with hoardings: the engine
    // closes in, stops short and the reason is shown.
    const check=['ladder','tower'].includes(kind)&&window.ConquerSiege?.assaultCheck
      ?ConquerSiege.assaultCheck(target.wall,kind,target.G.walk>1.6?2:1):{ok:true};
    run.blocked=check.ok?null:check.reason;
    if(run.blocked)status('Assalto impossibile: '+run.blocked);
    if(opts.camera!==false)frameCamera(target);
    if(!raf)raf=requestAnimationFrame(loop);
    return{kind,G:target.G};
  }
  // ---------- destruction gallery: every tower and gate, phase by phase ----------
  // One row per variant (the Builder's catalogue: stone square/round by level and roof,
  // wood towers, stone gates by level, the wood gate), one column per phase: intact,
  // damaged, door cracked / broken in (gates), a storey down for each level lost, and
  // destroyed. Damage goes through ConquerSiege, so the phases are the game's own
  // (storey collapses, ruined stumps, wood breaking up). Dev only: it clears the map.
  const sq=t=>typeof towerSizeForTier==='function'?towerSizeForTier('square',t):[1,1.5,2][t-1];
  const rd=t=>typeof towerSizeForTier==='function'?towerSizeForTier('round',t):[.5,.75,1][t-1];
  const GALLERY={
    towers:[
      ['Pietra quadrata L1',{type:'tower',shape:'square',material:'stone',level:1,tier:2,size:sq(2),roofStyle:'battlement'}],
      ['Pietra quadrata L2',{type:'tower',shape:'square',material:'stone',level:2,tier:2,size:sq(2),roofStyle:'battlement'}],
      ['Pietra quadrata L3',{type:'tower',shape:'square',material:'stone',level:3,tier:2,size:sq(2),roofStyle:'battlement'}],
      ['Pietra quadrata L3 tetto',{type:'tower',shape:'square',material:'stone',level:3,tier:3,size:sq(3),roofStyle:'pitched'}],
      ['Pietra rotonda L3 caditoie',{type:'tower',shape:'round',material:'stone',level:3,tier:2,r:rd(2),roofStyle:'machicolation'}],
      ['Grande quadrata L3 merli',{type:'tower',shape:'square',material:'stone',level:3,tier:3,size:sq(3),roofStyle:'battlement'}],
      ['Grande quadrata L3 caditoie',{type:'tower',shape:'square',material:'stone',level:3,tier:3,size:sq(3),roofStyle:'machicolation',baseStyle:'buttress'}],
      ['Grande rotonda L3 merli',{type:'tower',shape:'round',material:'stone',level:3,tier:3,r:rd(3),roofStyle:'battlement',baseStyle:'splayed'}],
      ['Grande rotonda L3 tetto',{type:'tower',shape:'round',material:'stone',level:3,tier:3,r:rd(3),roofStyle:'pitched'}],
      ['Legno vedetta',{type:'tower',shape:'square',material:'wood',woodStyle:'watchtower',woodRoof:'pitched',level:1,tier:1,size:1}],
      ['Legno media aperta',{type:'tower',shape:'square',material:'wood',woodStyle:'palisadeTower',woodRoof:'open',level:1,tier:2,size:1.5}],
      ['Legno media tetto',{type:'tower',shape:'square',material:'wood',woodStyle:'palisadeTower',woodRoof:'pitched',level:1,tier:2,size:1.5}]
    ],
    walls:[
      ['Muro sottile T1 H1',{type:'wall',tier:1,level:1,skin:'standard'}],
      ['Muro medio T2 H1',{type:'wall',tier:2,level:1,skin:'standard'}],
      ['Muro spesso T3 H1',{type:'wall',tier:3,level:1,skin:'standard'}],
      ['Muro medio T2 H2',{type:'wall',tier:2,level:2,skin:'standard'}],
      ['Muro spesso T3 H2',{type:'wall',tier:3,level:2,skin:'standard'}],
      ['T2 H2 caditoie',{type:'wall',tier:2,level:2,skin:'machicolation'}],
      ['T2 H2 hoardings',{type:'wall',tier:2,level:2,skin:'hoarding'}],
      ['T1 H1 hoardings',{type:'wall',tier:1,level:1,skin:'hoarding'}],
      ['Palizzata T1',{type:'palisade',tier:1,level:1}],
      ['Palizzata T2',{type:'palisade',tier:2,level:1}],
      ['Palizzata T3',{type:'palisade',tier:3,level:1}]
    ],
    gates:[
      ['Porta pietra L1',{type:'gate',shape:'square',material:'stone',size:1.5,level:1,roofStyle:'battlement'}],
      ['Porta pietra L2',{type:'gate',shape:'square',material:'stone',size:1.5,level:2,roofStyle:'battlement'}],
      ['Porta pietra L3',{type:'gate',shape:'square',material:'stone',size:1.5,level:3,roofStyle:'battlement'}],
      ['Porta pietra L3 tetto',{type:'gate',shape:'square',material:'stone',size:1.5,level:3,roofStyle:'pitched'}],
      ['Porta legno',{type:'gate',shape:'square',material:'wood',size:1.5,w:1,h:1.5,level:1,roofStyle:'flat'}]
    ]
  };
  function hpTo(s,f){
    const S=window.ConquerSiege,st=S.integrity(s);if(!st)return;
    const factor=S.effectiveness('trebuchet',s,'core')||1,damage=st.core.hp-st.core.max*f;
    if(damage>0)S.attackStructure(s.id,'trebuchet',damage/factor+1e-6,'core');
  }
  function doorTo(s,f){
    const S=window.ConquerSiege,st=S.integrity(s);if(!st?.door)return;
    const factor=S.effectiveness('ram',s,'door')||1,damage=st.door.hp-st.door.max*f;
    if(damage>0)S.attackStructure(s.id,'ram',damage/factor+1e-6,'door');
  }
  // Fixed columns, so a phase always sits under its heading (a L1 tower skips the storeys).
  const COLUMNS={towers:['intatta','danneggiata','crollo 1 piano','crollo 2 piani','distrutta'],
    gates:['intatta','danneggiata','portone incrinato','portone sfondato','crollo 1 piano','crollo 2 piani','distrutta'],
    walls:['intatto','campata danneggiata','breccia','due brecce','distrutto']};
  // Walls: 7.5 U, three bays; hits land at the bay centres of the original line, on
  // whatever stretch stands there after earlier breaches.
  const WALL_L=7.5,BAY_T=[1/6,1/2,5/6];
  function hitBay(s0,t,f){
    const S=window.ConquerSiege,p={x:s0.a.x+(s0.b.x-s0.a.x)*t,y:s0.a.y+(s0.b.y-s0.a.y)*t};
    const w=State.structures.find(x=>['wall','palisade'].includes(x.type)&&x.a&&x.b&&pointSegmentDistance(p,x.a,x.b)<.05);
    if(!w)return;
    const list=S.bays(w),i=S.bayIndexAt(w,p),bay=list[i],factor=S.effectiveness('trebuchet',w,'core')||1;
    const damage=bay.hp-bay.max*f;if(damage>0)S.attackStructure(w.id,'trebuchet',damage/factor+1e-6,i);
  }
  function wallPhases(){
    return[['intatto',()=>{}],['campata danneggiata',s=>hitBay(s,BAY_T[1],.4)],['breccia',s=>hitBay(s,BAY_T[1],0)],
      ['due brecce',s=>{hitBay(s,BAY_T[0],0);hitBay(s,BAY_T[2],0)}],['distrutto',s=>{for(const t of BAY_T)hitBay(s,t,0)}]];
  }
  function phases(spec){
    if(['wall','palisade'].includes(spec.type))return wallPhases();
    const L=spec.level||1,wood=spec.material==='wood',out=[['intatta',()=>{}],['danneggiata',s=>hpTo(s,.85)]];
    if(spec.type==='gate')out.push(['portone incrinato',s=>doorTo(s,.5)],['portone sfondato',s=>doorTo(s,0)]);
    // Only towers and gatehouses fail a storey at a time (settlement-siege.js storeyCollapse).
    if(!wood&&['tower','gate'].includes(spec.type))for(let k=1;k<L;k++)out.push(['crollo '+k+(k>1?' piani':' piano'),s=>{if(spec.type==='gate')doorTo(s,0);hpTo(s,(L-k)/L-.02)}]);
    out.push(['distrutta',s=>{if(spec.type==='gate')doorTo(s,0);hpTo(s,0)}]);
    return out;
  }
  // A complete structure for a gallery spec, centred on (x, y); walls run along +x.
  // The Asset Lab builds its fortification entries with this too.
  function galleryStructure(spec,x,y){
    return['wall','palisade','built'].includes(spec.type)
      ?{id:uid(),functions:[],flip:false,...spec,width:spec.type==='built'?builtWidth(spec):wallWidthForTier(spec.tier),a:{x:x-WALL_L/2,y},b:{x:x+WALL_L/2,y},length:WALL_L,rotationStep:0}
      :{id:uid(),functions:[],angle:0,rotationStep:0,...spec,x,y};
  }
  // Asset Lab (index.html?assetlab=1 in a hidden frame): world-space castle meshes of one gallery spec,
  // built alone on flat ground and removed again. null when the spec has no 3D volume (wood, palisades).
  let assetSpot=null;
  function assetMesh(spec){
    State.clock.speed=0;
    const c=assetSpot||(assetSpot=flatSpot()),s=galleryStructure(spec,c.x,c.y);
    if(!window.ConquerCastle3D?.castleVolume(s))return null;
    const keep=State.structures;
    State.structures=[s];invalidateSceneCache();
    try{return{origin:c,...window.ConquerCastle3D.worldMeshes()}}
    finally{State.structures=keep;invalidateSceneCache()}
  }
  let galleryLabels=null;
  function gallery(kind='towers'){
    const rows=GALLERY[kind];if(!rows)throw new Error('gallery: towers|gates');
    run=null;State.structures=[];if(State.siege)State.siege.ruins=[];
    const heads=COLUMNS[kind],cols=heads.length,DX=kind==='walls'?9.5:4.6,DY=kind==='walls'?3.4:5.2;
    let c=null;
    for(let x=40;x<=150&&!c;x+=5)for(let y=20;y<=150&&!c;y+=5){
      let ok=true;
      for(let i=0;i<cols&&ok;i++)for(let j=0;j<rows.length&&ok;j++)if(Math.abs(terrainElevation({x:x+i*DX,y:y+j*DY}))>.001)ok=false;
      if(ok)c={x,y};
    }
    c=c||{x:60,y:40};
    const made=[];
    rows.forEach(([label,spec],j)=>phases(spec).forEach(([phase,apply])=>{
      const i=heads.indexOf(phase);
      const s=galleryStructure(spec,c.x+i*DX,c.y+j*DY);
      State.structures.push(s);made.push({s,apply});
    }));
    invalidateSceneCache();window.ConquerWallWalk?.invalidate();
    // Every hit redraws the scene: hold the redraws while the phases are applied.
    const realDraw=draw;draw=()=>{};
    try{for(const {s,apply} of made){try{apply(s)}catch(e){console.error('gallery',e)}}}finally{draw=realDraw}
    galleryLabels={rows:rows.map(([label],j)=>({label,at:{x:c.x-2.6,y:c.y+j*DY}})),
      cols:heads.map((p,i)=>({label:p,at:{x:c.x+i*DX,y:c.y-2.8}}))};
    // Camera on the whole grid.
    State.view.rotation=0;
    const wrap=document.getElementById('wrap')||document.body,box=wrap.getBoundingClientRect();
    const rc=box.width>10?box:{width:1024,height:710};                 // hidden page: a nominal view
    const mid={x:c.x+(cols-1)*DX/2,y:c.y+(rows.length-1)*DY/2};
    State.view.scale=Math.min(rc.width/((cols+rows.length)*DX*12*.95),rc.height/((cols+rows.length)*DY*6*.95+40))*1.1;
    const p=w2s(mid,0);State.view.x+=rc.width/2-p.x;State.view.y+=rc.height*.55-p.y;
    invalidateSceneCache();draw();
    return{kind,rows:rows.length,cols,origin:c,rowLabels:rows.map(([l])=>l),columns:heads,DX,DY};
  }
  // Labels over the gallery (row names on the left, phases on top).
  function drawGalleryLabels(){
    if(!galleryLabels)return;
    ctx.save();ctx.font='600 12px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.fillStyle='#f3e6cf';
    for(const l of [...galleryLabels.rows,...galleryLabels.cols]){const p=w2s(l.at,0);ctx.strokeText(l.label,p.x,p.y);ctx.fillText(l.label,p.x,p.y)}
    ctx.restore();
  }
  if(typeof drawCastleSoldiers==='function'){
    const prior=drawCastleSoldiers;
    drawCastleSoldiers=function(){const r=prior.apply(this,arguments);try{drawGalleryLabels()}catch(e){}return r};
  }
  function at(t){if(!run)return;run.frozen=t;draw()}
  function play(){if(!run)return;run.t0=performance.now()/1000-(run.frozen||0);run.frozen=null;if(!raf)raf=requestAnimationFrame(loop)}
  function stop(){
    if(run?.patch&&run.target.moat){run.target.moat.fills=run.target.moat.fills.filter(f=>f!==run.patch);invalidateSceneCache(['ground','base'])}
    run=null;draw();
  }
  // Labels on/off (contact sheets capture each cell alone, without them).
  function setGalleryLabels(on){if(!on)galleryLabels=null}
  window.ConquerSiegePreview={start,stop,at,play,gallery,setGalleryLabels,GALLERY,galleryStructure,galleryPhases:phases,assetMesh,state:()=>run&&{kind:run.kind,t:time(),G:run.target.G,blocked:run.blocked}};
  const q=new URLSearchParams(location.search),wanted=q.get('siege');
  if(wanted)window.addEventListener('load',()=>setTimeout(()=>{
    try{
      if(wanted.startsWith('gallery'))gallery(wanted.split('-')[1]||'towers');
      else start(wanted,{level:Number(q.get('level'))||undefined,hides:q.get('hides')==='1'});
    }catch(e){console.error('siege preview',e)}
  },300));
})();
