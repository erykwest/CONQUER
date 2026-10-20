'use strict';
// Cutaway occupants, garrisons and patrol rendering. Extracted verbatim from settlement-population.js.
function cutawayOccupantLayout(count){
  if(count<=1)return[[0,.08]];
  if(count===2)return[[-.34,.10],[.34,-.08]];
  if(count===3)return[[-.48,.12],[0,-.12],[.48,.08]];
  return[[-.52,.16],[-.18,-.14],[.18,.12],[.52,-.10]];
}
function drawCutawayOccupants(){
  const structures=State.structures.filter(s=>structureCutaway(s)&&!underConstruction(s)).slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  const t=performance.now()/1000;
  for(const s of structures){
    const render=()=>{
      for(const slot of cutawayRoomSlots(s)){
        let count=0,kind=null;
        if(slot.role==='barracks'||slot.role==='quarters'){
          count=3;kind='soldier';
          if(window.__CONQUER_CAMP_MODE__&&slot.role==='barracks'){
            // Camp roster is authoritative: no decorative soldiers in an empty room.
            const housed=window.ConquerCombat?.units()?.filter(u=>u.kind==='squad'
              &&u.barracksId===s.id+':'+slot.index&&u.campState==='barracks')||[];
            count=Math.min(4,housed.length*2);
          }
        }
        else if(slot.role==='nobleRoom'){count=slot.size==='large'?2:1;kind='noble'}
        if(!count)continue;
        const positions=cutawayOccupantLayout(count),items=[];
        for(let i=0;i<count;i++){
          const [nx,ny]=positions[i%positions.length],phase=(t*.42+i*.21+(peasantHash(s.id+'-'+slot.index+'-'+i)%100)/100)%1;
          const sway=Math.sin(phase*Math.PI*2)*.035;
          const p=cutawayRoomPoint(slot,nx+sway,ny);
          items.push({p,phase,i,depth:viewDepthPoint(p)});
        }
        items.sort((a,b)=>a.depth-b.depth);
        for(const item of items){
          const id=s.id+'-room-'+slot.index+'-'+item.i;
          if(kind==='soldier')drawSoldierFigure(item.p,slot.z+.09,'unarmed',id,item.phase);
          else drawNobleFigure(item.p,slot.z+.09,id,item.phase);
        }
      }
    };
    if(s.type==='tower')withStructureGroundPlane(s,render);else render();
  }
}
function wallPatrolPoint(wall,day,index=0,count=1){
  const pg=wall.type==='palisade'?palisadeLayout(wall):null;
  const a=pg?pg.a:wall.a,b=pg?pg.b:wall.b;
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.max(.001,Math.hypot(dx,dy));
  const seed=(peasantHash(wall.id+'-patrol')%1000)/1000,phase=count>1?index:0;
  let t=(day*1.44+seed+phase)%2;t=t<=1?t:2-t;

  // Normal patrol margin plus an explicit tower/gate safety zone on snapped
  // ends. Palisades are already visually trimmed, so this produces an
  // additional clearance from the actual junction.
  const normal=Math.min(.65,L*.18);
  const snapSafe=Math.min(.46,L*.30);
  const aBlocks=wall.type==='palisade'?!!palisadeSolidSnapTarget(wall.aSnap):!!wall.aSnap;
  const bBlocks=wall.type==='palisade'?!!palisadeSolidSnapTarget(wall.bSnap):!!wall.bSnap;
  let startPad=Math.max(normal,aBlocks?snapSafe:0);
  let endPad=Math.max(normal,bBlocks?snapSafe:0);
  const maxTotal=Math.max(0,L-.08);
  if(startPad+endPad>maxTotal){
    const scale=maxTotal/Math.max(.001,startPad+endPad);
    startPad*=scale;endPad*=scale;
  }
  const usable=Math.max(0,L-startPad-endPad),along=startPad+t*usable;
  const p={x:a.x+dx*(along/L),y:a.y+dy*(along/L)};

  if(wall.type==='palisade'){
    const surface=palisadePatrolSurface(wall);
    const lane=count>1?(index===0?-surface.spread:surface.spread):0;
    const off=(surface.offset+lane)*pg.side;
    p.x+=pg.nx*off;p.y+=pg.ny*off;
  }else if(count>1){
    const nx=-dy/L,ny=dx/L,lane=Math.min(.22,Math.max(.10,(Number(wall.width)||1)*.22));
    const side=index===0?-1:1;
    p.x+=nx*lane*side;p.y+=ny*lane*side;
  }
  return p;
}
function gateGuardPositions(gate){
  if(!gate||gate.type!=='gate')return[];
  const d=rectDims(gate),a=Number(gate.angle)||0;
  const ux=Math.cos(a),uy=Math.sin(a),vx=-uy,vy=ux;
  const halfLength=d.w/2;
  const passageHalf=Math.min(d.h*.40,.52);
  const lateral=Math.min(Math.max(.20,d.h/2-.08),passageHalf+.10);
  const outward=halfLength+.28;
  return[-1,1].map(side=>({
    x:gate.x+ux*outward+vx*lateral*side,
    y:gate.y+uy*outward+vy*lateral*side
  }));
}

function drawCastleSoldiers(){
  const day=peasantVisualDay();

  // Two stationary spearmen guard the exterior mouth of every completed gate.
  // Their ground Z deliberately follows terrain instead of the gate foundation
  // plane, so guards remain planted correctly on sloped approaches.
  for(const gate of State.structures){
    if(gate.type!=='gate'||underConstruction(gate))continue;
    if(window.ConquerSiege?.gateClosed?.(gate))continue;   // closed: the guards are inside
    const guards=window.ConquerCrossings?.drawbridgeGuards?.(gate)||gateGuardPositions(gate);   // on a lowered drawbridge: at its far end
    for(let i=0;i<guards.length;i++){
      const p=guards[i],z=p.z??.08;
      if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'spearman',gate.id+':gate-guard:'+i,day+i*.5);
    }
  }

  // Wall and palisade patrol density follows tier: T1=0, T2=1, T3=2.
  for(const wall of State.structures){
    if(!['wall','palisade'].includes(wall.type)||underConstruction(wall))continue;
    const tier=wallTier(wall),count=tier===1?0:tier===3?2:1;
    const z=wall.type==='palisade'?palisadePatrolSurface(wall).z:structureHeight(wall)+.10;
    for(let i=0;i<count;i++){
      const p=wallPatrolPoint(wall,day,i,count);
      if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'spearman',wall.id+':patrol:'+i,day+i*.5);
    }
  }

  // Only assigned garrison soldiers exist. Roof slot is visible; arrow-slit
  // soldiers are masked by masonry unless the tower is shown in cutaway.
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower))continue;
    const occupied=window.ConquerSiege?.occupiedArcherSlots(tower)||[];
    for(const slot of occupied){
      if(slot.kind==='slit'&&!structureCutaway(tower))continue;
      const p=slot.kind==='slit'
        ?{x:tower.x+(slot.p.x-tower.x)*.63,y:tower.y+(slot.p.y-tower.y)*.63}
        :slot.p;
      withStructureGroundPlane(tower,()=>{
        if(worldPointVisible(p,slot.z,48))
          drawSoldierFigure(p,slot.z,'archer',slot.id,day+(slot.floor||0)*.15);
      });
    }
  }
}
function drawTrainingSoldiers(){
  const day=peasantVisualDay(),dots=[];
  for(const yard of State.structures){
    if(yard.type!=='training'||underConstruction(yard))continue;
    const seed=(peasantHash(yard.id+'-training')%1000)/1000;
    const pulse=day*.80+seed;
    const spots=[
      {x:-1.15,y:-.62,pair:0},{x:1.15,y:-.62,pair:0},
      {x:-1.15,y:.72,pair:1},{x:1.15,y:.72,pair:1}
    ];
    for(let i=0;i<spots.length;i++){
      const s=spots[i],side=i%2===0?1:-1;
      const advance=Math.sin((pulse+s.pair*.37)*Math.PI*2)*.20*side;
      const local={x:s.x+advance,y:s.y};
      const p=houseLocalToWorld(yard,local.x,local.y);
      if(!worldPointVisible(p,.13,48))continue;
      dots.push({p,z:.13,id:yard.id+':knight:'+i,phase:pulse+i*.17});
    }
  }
  dots.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
  for(const d of dots)drawSoldierFigure(d.p,d.z,'knight',d.id,d.phase);
}

