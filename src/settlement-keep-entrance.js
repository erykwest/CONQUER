'use strict';
// Raised entrance of the Mastio: the front door moves up to the first upper storey and an
// outer stair climbs to it. Three steps, each built on the previous one:
//   wood  — a timber flight square to the facade (burnable, cheap);
//   stone — a masonry flight along the facade, the climber shows his flank to the tower;
//   drawbridge — an accessory on either stair: the flight stops at a landing short of the
//                door, a leaf hinged at the sill spans the gap and, raised, shuts the doorway.
// The ground floor of the keep then has no door: civilians reach it only up the stair, and
// not at all while the leaf is up. State lives on the tower: tower.keepEntrance =
// {stair:'wood'|'stone'|'burnt',side:1|-1,drawbridge:{installed,raised,progress,auto,autoRaised,burnt}|null,
//  ladder:{down,autoUp}|null,auto}.
// A burnt wooden stair, or a burnt leaf over its gap, leaves the door out of reach: the
// occupants let a ladder down from the sill (and pull it in) until it is rebuilt. With `auto`
// (default on) the guard raises the leaf, or pulls the ladder in, when an enemy comes near
// and puts it back once they are gone. The Mastio has no wall-walk doors at all.
(function(){
  const STAIR_COST={gold:6,wood:24};
  const STONE_COST={gold:10,stone:30};
  const DRAWBRIDGE_COST={gold:18,wood:28,metal:5};
  const GAP=.9,LAND=.62,LAND_HALF=.46,FLIGHT_W=.66,SLOPE=1,STEP_RISE=.17;
  const BLOCKERS_SKIP=new Set(['road','field','moat','bridge','ruin']);
  const STAIRS=['wood','stone'];
  // Enemies this close to the stair foot or the landing make the guard raise the leaf; it
  // comes down once none is within the farther radius.
  const ALARM_NEAR=9,ALARM_CLEAR=13;

  function eligible(t){
    return !!t&&t.type==='tower'&&!underConstruction(t)&&!isWoodTower(t)&&!t.parentTowerId&&
      !(typeof isOrientedTower==='function'&&isOrientedTower(t))&&structureLevel(t)>=2;
  }
  function entrance(t){return eligible(t)&&[...STAIRS,'burnt'].includes(t.keepEntrance?.stair)?t.keepEntrance:null}
  // The working leaf. A burnt one (drawbridge.burnt) is gone but leaves its gap.
  function drawbridge(t){const e=entrance(t);return e?.drawbridge?.installed&&!e.drawbridge.burnt?e.drawbridge:null}
  // Stair burnt, or leaf burnt over its gap: the door is out of reach from the ground except
  // by the ladder the occupants let down (keepEntrance.ladder={down,autoUp}).
  function unreachable(t){const e=entrance(t);return !!e&&(e.stair==='burnt'||!!e.drawbridge?.burnt)}
  const guardOn=e=>e.auto!==false&&e.drawbridge?.auto!==false;
  function sill(t){return entrance(t)?sillFor(t):null}
  // The front face, as towerDoorSpecs places the ground door of an independent tower.
  function frontFrame(t){
    const a=t.angle||0;let contact;
    if(t.shape==='round')contact={x:t.x+Math.cos(a)*t.r,y:t.y+Math.sin(a)*t.r};
    else{const fp=footprintPoints(t);contact=fp.length>=4?{x:(fp[1].x+fp[2].x)/2,y:(fp[1].y+fp[2].y)/2}:boundaryPoint(t,{x:t.x+Math.cos(a),y:t.y+Math.sin(a)})}
    const rx=contact.x-t.x,ry=contact.y-t.y,L=Math.hypot(rx,ry)||1,outward={x:rx/L,y:ry/L};
    return{contact,outward,tangent:{x:-outward.y,y:outward.x}};
  }
  const ground=p=>typeof terrainElevation==='function'?terrainElevation(p):0;
  // Plan and heights of a stair spec ({stair,side,drawbridge}) on tower t. u runs out of the
  // door, v along the facade; z are absolute.
  function layout(t,spec=entrance(t)){
    if(!spec||!eligible(t)||!STAIRS.includes(spec.stair))return null;
    const f=frontFrame(t),g0=placementGroundZ(t)??ground(t),zTop=g0+(spec.sill??sillFor(t));
    const P=(u,v)=>({x:f.contact.x+f.outward.x*u+f.tangent.x*v,y:f.contact.y+f.outward.y*u+f.tangent.y*v});
    const gap=spec.drawbridge?.installed?GAP:0,stone=spec.stair==='stone',side=spec.side===-1?-1:1;
    // Run the flight down at 45°, then once more from where it really lands.
    let run=zTop-g0,end;
    for(let i=0;i<3;i++){
      end=stone?P(gap+LAND/2,side*(LAND_HALF+run)):P(gap+LAND+run,0);
      run=Math.max(.3,(zTop-ground(end))*SLOPE);
    }
    const zFoot=ground(end),rise=zTop-zFoot,steps=Math.max(2,Math.round(rise/STEP_RISE));
    const rect=(u0,u1,v0,v1)=>[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)];
    const landing={u0:gap,u1:gap+LAND,v0:-LAND_HALF,v1:LAND_HALF};
    const flight=stone?{u0:gap,u1:gap+LAND,v0:side*LAND_HALF,v1:side*(LAND_HALF+run),along:'v'}
      :{u0:gap+LAND,u1:gap+LAND+run,v0:-FLIGHT_W/2,v1:FLIGHT_W/2,along:'u'};
    const foot=stone?P(gap+LAND/2,side*(LAND_HALF+run+.35)):P(gap+LAND+run+.35,0);
    const plan=[rect(landing.u0,landing.u1,landing.v0,landing.v1),rect(flight.u0,flight.u1,Math.min(flight.v0,flight.v1),Math.max(flight.v0,flight.v1))];
    if(gap&&!spec.drawbridge?.burnt)plan.push(rect(0,gap,-LAND_HALF,LAND_HALF));   // with no leaf the pit is open ground
    return{frame:f,P,zTop,zFoot,g0,rise,run,steps,gap,stone,side,landing,flight,foot,plan};
  }
  // Floor of the first upper storey, above the tower's own ground.
  function sillFor(t){
    const floors=typeof cutawayFloorLevels==='function'?cutawayFloorLevels(t):[];
    const z=floors[1]?.z??structureHeight(t)/structureLevel(t);
    return Math.max(.6,Math.min(z,structureHeight(t)-1.1));
  }
  // Why a stair spec cannot stand in front of tower t, or null.
  function validate(t,spec){
    if(!eligible(t))return'serve una torre in muratura indipendente di almeno 2 piani';
    const L=layout(t,{...spec,sill:sillFor(t)});if(!L)return'geometria non valida';
    if(L.rise<.5)return'il terreno davanti alla porta è troppo alto';
    if(L.zFoot>L.zTop-.3)return'il terreno davanti alla porta è troppo alto';
    const pts=[];
    for(const poly of L.plan){
      pts.push(...poly);
      for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(let k=1;k<4;k++)pts.push({x:a.x+(b.x-a.x)*k/4,y:a.y+(b.y-a.y)*k/4})}
      pts.push({x:poly.reduce((s,p)=>s+p.x,0)/4,y:poly.reduce((s,p)=>s+p.y,0)/4});
    }
    for(const o of State.structures){
      if(o===t||BLOCKERS_SKIP.has(o.type)||o.auto)continue;
      let fp;try{fp=footprintPoints(o)}catch{continue}
      if(!fp||fp.length<3)continue;
      if(pts.some(p=>pointInPolygon(p,fp)))return'la scala urta '+(typeof structureLabel==='function'?structureLabel(o):o.type);
    }
    return null;
  }
  function refresh(t,redraw=true){
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    window.ConquerWallWalk?.invalidate?.();
    if(typeof invalidateStructureScene==='function')invalidateStructureScene(t);
    if(typeof invalidateSceneCache==='function')invalidateSceneCache();
    markDirty(true,['ground','base']);renderFunctionPanel();if(redraw)draw();
  }
  function pay(cost){
    if(!canAfford(cost)){status('Risorse insufficienti · '+costText(cost));return false}
    spendCost(cost);return true;
  }
  // A new wooden stair, or a burnt one rebuilt (the raised door is already in the wall).
  function buildStair(t){
    const rebuild=entrance(t)?.stair==='burnt';
    if(!rebuild&&!t?.isMastio){status('L\'ingresso rialzato si costruisce sul mastio');return false}
    if(!rebuild&&t.keepEntrance?.stair)return false;
    const spec={stair:'wood',side:1,drawbridge:null},error=validate(t,spec);
    if(error){status('Ingresso rialzato non disponibile: '+error);return false}
    if(!pay(STAIR_COST))return false;
    t.keepEntrance=spec;refresh(t);
    status(rebuild?'Scala di legno ricostruita':'Scala di legno costruita: la porta del mastio è ora al primo piano');return true;
  }
  // Masonry flight along the facade, on whichever side is free (the one already chosen first).
  function freeSide(t,spec){
    for(const side of [spec.side===-1?-1:1,spec.side===-1?1:-1]){
      if(!validate(t,{...spec,stair:'stone',side}))return side;
    }
    return null;
  }
  function upgradeStone(t){
    const e=entrance(t);if(!e||e.stair!=='wood')return false;
    const side=freeSide(t,e);
    if(side===null){status('Scala in pietra non disponibile: '+validate(t,{...e,stair:'stone',side:1}));return false}
    if(!pay(STONE_COST))return false;
    e.stair='stone';e.side=side;refresh(t);
    status('Scala in pietra costruita lungo la facciata');return true;
  }
  function installDrawbridge(t){
    const e=entrance(t);if(!e||!STAIRS.includes(e.stair)||drawbridge(t))return false;   // new, or replacing a burnt leaf
    const next={...e,drawbridge:{installed:true,raised:false,progress:0}};
    const error=e.stair==='stone'?(freeSide(t,next)===null?validate(t,next):null):validate(t,next);
    if(error){status('Levatoio non disponibile: '+error);return false}
    if(!pay(DRAWBRIDGE_COST))return false;
    if(e.stair==='stone')e.side=freeSide(t,next);
    e.drawbridge=next.drawbridge;e.ladder=null;refresh(t);
    status('Levatoio installato davanti alla porta del mastio');return true;
  }
  // By hand: the guard leaves it as set until the next time enemies come or go.
  function toggleDrawbridge(t){
    const d=drawbridge(t);if(!d)return false;
    d.raised=!d.raised;d.autoRaised=false;refresh(t);
    status(d.raised?'Levatoio del mastio alzato':'Levatoio del mastio abbassato');return true;
  }
  // The guard (leaf and ladder): on by default.
  function setAuto(t,on){
    const e=entrance(t);if(!e)return false;
    e.auto=!!on;if(e.drawbridge)e.drawbridge.auto=!!on;
    if(!on){if(e.drawbridge)e.drawbridge.autoRaised=false;if(e.ladder)e.ladder.autoUp=false}
    markDirty(false,false,true);renderFunctionPanel();return true;
  }
  // The occupants let the ladder down from the door, or pull it back in.
  function setLadder(t,down){
    const e=entrance(t);if(!e||!unreachable(t))return false;
    e.ladder={down:!!down,autoUp:false};refresh(t);
    status(down?'Scala a pioli calata dalla porta del mastio':'Scala a pioli ritirata nel mastio');return true;
  }
  // Living hostiles near the way in: stair foot and landing, or the ladder's foot.
  function enemyDistance(t){
    const list=window.ConquerCombat?.enemy?.()||[];if(!list.length)return Infinity;
    let spots;
    if(unreachable(t)){const g=ladderGeom(t);spots=g?[g.access]:[]}
    else{const L=layout(t);spots=L?[L.foot,L.P((L.landing.u0+L.landing.u1)/2,0)]:[]}
    let best=Infinity;
    for(const e of list){
      if(e.neutral||e.defeated||(e.stats&&!(e.stats.hp>0))||!Number.isFinite(e.x))continue;
      for(const p of spots)best=Math.min(best,Math.hypot(e.x-p.x,e.y-p.y));
    }
    return best;
  }
  // Siege tick (settlement-siege.js, next to the half-bridges' red-alarm demolition).
  function alarmTick(){
    for(const t of State.structures){
      const e=entrance(t);if(!e||!guardOn(e))continue;
      const l=unreachable(t)?e.ladder:null;
      if(l){
        const near=enemyDistance(t);
        if(near<=ALARM_NEAR&&l.down){l.down=false;l.autoUp=true;refresh(t,false);status('Nemici sotto il mastio: la scala a pioli viene ritirata')}
        else if(near>ALARM_CLEAR&&!l.down&&l.autoUp){l.down=true;l.autoUp=false;refresh(t,false);status('Nessun nemico vicino: la scala a pioli viene calata')}
        continue;
      }
      const d=drawbridge(t);if(!d)continue;
      const near=enemyDistance(t);
      if(near<=ALARM_NEAR&&!d.raised){
        d.raised=true;d.autoRaised=true;refresh(t,false);status('Nemici alla scala: il levatoio del mastio si alza');
      }else if(near>ALARM_CLEAR&&d.raised&&d.autoRaised){
        d.raised=false;d.autoRaised=false;refresh(t,false);status('Nessun nemico vicino: il levatoio del mastio si abbassa');
      }
    }
  }
  // Fire (settlement-fire.js): the wooden stair and the leaf are the keep's burnable parts.
  function fireParts(t){
    const e=entrance(t);if(!e)return[];
    const out=[];
    if(e.stair==='wood')out.push({part:'stair',flam:.8});
    if(drawbridge(t))out.push({part:'leaf',flam:.55});
    return out;
  }
  // Burnt out: the wooden stair takes the leaf down with it; a leaf alone falls and leaves
  // its gap between landing and door. Either way the ladder starts pulled in.
  function burnout(t,part){
    const e=entrance(t);if(!e)return false;
    if(part==='stair'){e.stair='burnt';e.drawbridge=null;e.ladder={down:false,autoUp:false}}
    else if(part==='leaf'){e.drawbridge={installed:true,burnt:true,raised:false,progress:0};e.ladder={down:false,autoUp:false}}
    else return false;
    refresh(t,false);return true;
  }
  // Where the flames sit: over the flight and landing (stair), or on the leaf.
  function fireSeats(t,part,rnd,n){
    const L=layout(t);if(!L)return[];
    const out=[];
    for(let i=0;i<n;i++){
      if(part==='leaf'){const u=rnd()*L.gap,v=(rnd()-.5)*.7;const p=L.P(u,v);out.push({x:p.x,y:p.y,z:L.zTop+.05+rnd()*.4});continue}
      const k=rnd(),fl=L.flight;
      const u=fl.along==='u'?fl.u0+L.run*k:fl.u0+(fl.u1-fl.u0)*rnd();
      const v=fl.along==='u'?(rnd()-.5)*FLIGHT_W:fl.v0+(fl.v1-fl.v0)*k;
      const p=L.P(u,v);out.push({x:p.x,y:p.y,z:L.zTop+(L.zFoot-L.zTop)*k+.1+rnd()*.35});
    }
    return out;
  }
  function removeDrawbridge(t){
    const e=entrance(t);if(!e?.drawbridge)return false;
    e.drawbridge=null;e.ladder=null;refresh(t);status('Levatoio rimosso (nessun rimborso)');return true;
  }
  function removeEntrance(t){
    if(!t?.keepEntrance)return false;
    delete t.keepEntrance;refresh(t);status('Ingresso rialzato demolito: la porta torna a terra');return true;
  }
  // Where a walker on the ground enters the keep: the foot of the stair; null while the leaf
  // is up (or moving); undefined when the tower has no raised entrance.
  function access(t){
    const e=entrance(t);if(!e)return undefined;
    if(unreachable(t))return e.ladder?.down?ladderGeom(t)?.access||null:null;
    const d=drawbridge(t);
    if(d&&(d.raised||d.progress>.02))return null;
    return layout(t)?.foot||null;
  }
  function footPoint(t){return !entrance(t)?null:unreachable(t)?ladderGeom(t)?.access||null:layout(t)?.foot||null}
  // The keep shut from outside: leaf up or moving, or the ladder pulled in.
  function closed(t){
    if(unreachable(t))return !t.keepEntrance.ladder?.down;
    const d=drawbridge(t);return !!d&&(d.raised||d.progress>.02);
  }
  // The ladder let down from the sill, leaning out to the ground below the door.
  const LADDER_OUT=.55;
  function ladderGeom(t){
    if(!entrance(t))return null;
    const f=frontFrame(t),g0=placementGroundZ(t)??ground(t),zTop=g0+sillFor(t);
    const P=(u,v)=>({x:f.contact.x+f.outward.x*u+f.tangent.x*v,y:f.contact.y+f.outward.y*u+f.tangent.y*v});
    const base=P(LADDER_OUT,0);
    return{frame:f,P,zTop,zBase:ground(base),top:P(.06,0),base,access:P(LADDER_OUT+.2,0)};
  }
  // Plan polygons that walkers go around (settlement-population-navigation.js), cached.
  const obstacleCache=new Map();
  function obstacles(t){
    if(!entrance(t))return null;
    const e=t.keepEntrance,key=[t.x,t.y,t.angle,t.r,t.size,t.level,e.stair,e.side,!!e.drawbridge?.installed,!!e.drawbridge?.burnt,State.relief?.seed].join('|');
    const hit=obstacleCache.get(t.id);if(hit&&hit.key===key)return hit.plan;
    const plan=layout(t)?.plan||[];obstacleCache.set(t.id,{key,plan});return plan;
  }
  // A civilian going up into the keep: from the foot along the flight, over the landing, to
  // the door. k 0..1 → {x,y,z} with z absolute.
  function climbPoint(t,k){
    const pts=[];
    if(unreachable(t)){
      // Up the ladder: to its foot, then up the rungs to the sill.
      const g=ladderGeom(t);if(!g)return null;
      pts.push([g.access,g.zBase],[g.base,g.zBase],[g.top,g.zTop],[g.P(.02,0),g.zTop]);
      return alongPath(pts,k);
    }
    const L=layout(t);if(!L)return null;
    const fl=L.flight;
    if(fl.along==='u'){
      pts.push([L.P(fl.u1+.35,0),L.zFoot],[L.P(fl.u1,0),L.zFoot],[L.P(fl.u0,0),L.zTop]);
    }else{
      const um=(fl.u0+fl.u1)/2;
      pts.push([L.P(um,fl.v1+Math.sign(fl.v1)*.35),L.zFoot],[L.P(um,fl.v1),L.zFoot],[L.P(um,fl.v0),L.zTop]);
    }
    pts.push([L.P((L.landing.u0+L.landing.u1)/2,0),L.zTop],[L.P(.05,0),L.zTop]);
    return alongPath(pts,k);
  }
  // A point k (0..1) of the way along [[{x,y},z],...], by 3D length.
  function alongPath(pts,k){
    let total=0;const seg=[];
    for(let i=1;i<pts.length;i++){const [a,za]=pts[i-1],[b,zb]=pts[i],len=Math.hypot(b.x-a.x,b.y-a.y,zb-za);seg.push(len);total+=len}
    let d=Math.max(0,Math.min(1,k))*total;
    for(let i=1;i<pts.length;i++){
      const [a,za]=pts[i-1],[b,zb]=pts[i];
      if(d<=seg[i-1]||i===pts.length-1){const f=Math.min(1,d/(seg[i-1]||1));return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,z:za+(zb-za)*f}}
      d-=seg[i-1];
    }
    return null;
  }
  // Time to climb, in ms, at the same pace as civilians walk (550 ms per unit).
  function climbDuration(t){
    if(unreachable(t)){const g=ladderGeom(t);return g?Math.max(600,(g.zTop-g.zBase)*1.6*550+.8*550):0}   // rungs are slower
    const L=layout(t);return L?Math.max(600,(L.run*1.41+L.gap+.9)*550):0;
  }

  // ---------- meshes (3D world; the 2.5D view paints the same triangles) ----------
  function builder(L){
    const pos=[],col=[];
    const at=(u,v,z)=>{const p=L.P(u,v);return[p.x,p.y,z]};
    // A box between u0..u1, v0..v1, with bottom and top heights that may slope along u
    // (z0a/z1a at u0, z0b/z1b at u1) or along v when byV is set.
    const box=(u0,u1,v0,v1,z0a,z1a,colr,z0b=z0a,z1b=z1a,byV=false)=>{
      const v=[];
      for(const [ui,u] of [u0,u1].entries())for(const [vi,w] of [v0,v1].entries())for(const zi of [0,1]){
        const k=byV?vi:ui;v.push(at(u,w,zi?(k?z1b:z1a):(k?z0b:z0a)));
      }
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(colr)}
    };
    return{pos,col,box};
  }
  const stairCache=new Map();
  function stairMesh(t){
    const L=layout(t);if(!L)return null;
    const key=[t.x,t.y,t.angle,t.r,t.size,t.level,L.zTop.toFixed(3),L.zFoot.toFixed(3),L.gap,L.stone,L.side].join('|');
    const hit=stairCache.get(t.id);if(hit&&hit.key===key)return hit.mesh;
    const B=builder(L),{box}=B,stone=L.stone;
    const deck=stone?'#a19d92':'#9a6e43',dark=stone?'#7d786e':'#6b4729',base=Math.min(L.g0,L.zFoot)-.06;
    const ld=L.landing;
    // Landing: a masonry block, or a plank deck on four posts.
    if(stone)box(ld.u0,ld.u1,ld.v0,ld.v1,base,L.zTop,deck);
    else{
      box(ld.u0,ld.u1,ld.v0,ld.v1,L.zTop-.07,L.zTop,deck);
      for(const u of [ld.u0+.06,ld.u1-.06])for(const v of [ld.v0+.06,ld.v1-.06])
        box(u-.045,u+.045,v-.045,v+.045,ground(L.P(u,v))-.04,L.zTop-.07,dark);
      for(const s of [-1,1])box(ld.u0,ld.u1,s*ld.v1-(s>0?.04:0),s*ld.v1+(s<0?.04:0),L.zTop,L.zTop+.34,dark);
    }
    // Flight: N treads from just under the landing down to the foot.
    const fl=L.flight,n=L.steps,dz=L.rise/(n+1);
    for(let i=0;i<n;i++){
      const top=L.zTop-(i+1)*dz;
      if(fl.along==='u'){
        const u0=fl.u0+L.run*i/n,u1=fl.u0+L.run*(i+1)/n;
        if(stone)box(u0,u1,fl.v0,fl.v1,base,top,i%2?deck:'#9a968b');
        else box(u0,u1,fl.v0,fl.v1,top-.05,top,deck);
      }else{
        const a=fl.v0+(fl.v1-fl.v0)*i/n,b=fl.v0+(fl.v1-fl.v0)*(i+1)/n;
        if(stone)box(fl.u0,fl.u1,Math.min(a,b),Math.max(a,b),base,top,i%2?deck:'#9a968b');
        else box(fl.u0,fl.u1,Math.min(a,b),Math.max(a,b),top-.05,top,deck);
      }
    }
    if(!stone){
      // Two sloping stringers, a hand rail on posts, a trestle at mid run.
      for(const s of [-1,1]){
        const v=s*(FLIGHT_W/2+.025);
        box(fl.u0,fl.u1,v-.03,v+.03,L.zTop-.2,L.zTop-.02,dark,L.zFoot-.04,L.zFoot+.12);
        box(fl.u0,fl.u1,v-.02,v+.02,L.zTop+.3,L.zTop+.34,dark,L.zFoot+.3,L.zFoot+.34);
        for(const k of [.33,.66]){
          const u=fl.u0+L.run*k,z=L.zTop+(L.zFoot-L.zTop)*k;
          box(u-.025,u+.025,v-.025,v+.025,z,z+.32,dark);
          if(k<.5)box(u-.04,u+.04,v-.04,v+.04,ground(L.P(u,v))-.04,z-.15,dark);
        }
      }
    }else{
      // Parapet on the open side of the flight and the landing.
      // Sloping along v from the landing (v0) down to the foot (v1).
      const out=fl.u1-.08;
      box(out,fl.u1,fl.v0,fl.v1,L.zTop,L.zTop+.28,dark,L.zFoot+.02,L.zFoot+.28,true);
      box(ld.u1-.08,ld.u1,ld.v0,ld.v1,L.zTop,L.zTop+.28,dark);
      if(fl.v0>0)box(ld.u0,ld.u1,ld.v0,ld.v0+.08,L.zTop,L.zTop+.28,dark);else box(ld.u0,ld.u1,ld.v1-.08,ld.v1,L.zTop,L.zTop+.28,dark);
      if(L.gap)box(ld.u0,ld.u0+.06,ld.v0,ld.v1,L.zTop,L.zTop+.06,dark);
    }
    const mesh={pos:B.pos,col:B.col,static:true};
    stairCache.set(t.id,{key,mesh});return mesh;
  }
  // The leaf hinged at the sill: flat over the gap when lowered, upright against the door
  // when raised; two chains from above the door to its tip.
  function leafMesh(t){
    const d=drawbridge(t),L=d&&layout(t);if(!L)return null;
    const th=Math.max(0,Math.min(1,d.progress))*Math.PI/2,c=Math.cos(th),s=Math.sin(th);
    const len=L.gap+.12,w=.36,T=.06,f=L.frame,z0=L.zTop;
    const P=(along,across,up)=>{const u=along*c-up*s;return[f.contact.x+f.outward.x*(u+.01)+f.tangent.x*across,f.contact.y+f.outward.y*(u+.01)+f.tangent.y*across,z0+along*s+up*c]};
    const pos=[],col=[];
    const box=(a0,a1,w0,w1,u0,u1,colr)=>{
      const v=[];for(const a of [a0,a1])for(const b of [w0,w1])for(const u of [u0,u1])v.push(P(a,b,u));
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(colr)}
    };
    box(0,len,-w,w,-T,0,'#9d7044');
    for(const a of [len*.3,len*.7])box(a-.04,a+.04,-w,w,0,.025,'#6f4a2b');
    for(const k of [-.8,.8]){
      const tip=P(len,w*k,0),top=[f.contact.x+f.tangent.x*w*k+f.outward.x*.02,f.contact.y+f.tangent.y*w*k+f.outward.y*.02,z0+1.05],e=.01;
      for(const [dx,dy] of [[e,0],[0,e]]){
        const a=[top[0]-dx,top[1]-dy,top[2]],b=[top[0]+dx,top[1]+dy,top[2]],cc=[tip[0]+dx,tip[1]+dy,tip[2]],dd=[tip[0]-dx,tip[1]-dy,tip[2]];
        pos.push(...a,...b,...cc,...a,...cc,...dd);col.push('#b8a98b','#b8a98b');
      }
    }
    return{pos,col};
  }
  // In the 2.5D view the meshes are painted over the castle: skip a stair on the far side.
  function facesCamera(t){
    if(window.ConquerWorld3D?.active?.()||typeof viewDepthPoint!=='function')return true;
    return viewDepthPoint(frontFrame(t).contact)>=viewDepthPoint({x:t.x,y:t.y})-.015;
  }
  // The ladder let down: two rails and rungs leaning from the sill to the ground.
  function ladderMesh(t){
    if(!unreachable(t)||!t.keepEntrance.ladder?.down)return null;
    const g=ladderGeom(t),pos=[],col=[],f=g.frame;
    const at=(u,v,z)=>{const p=g.P(u,v);return[p.x,p.y,z]};
    const rod=(a,b,w,colr)=>{   // a thin square bar between two 3D points, along a and b
      const n=[f.tangent.x*w,f.tangent.y*w],up=w;
      const q=[[...a],[...b]],v=[];
      for(const p of q)for(const [dx,dy,dz] of [[-n[0],-n[1],0],[n[0],n[1],0],[n[0],n[1],up],[-n[0],-n[1],up]])v.push([p[0]+dx,p[1]+dy,p[2]+dz]);
      for(const [i,j,k,l] of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])for(const tri of [[i,j,k],[i,k,l]]){for(const x of tri)pos.push(...v[x]);col.push(colr)}
    };
    const uTop=.06,uBot=LADDER_OUT,zT=g.zTop+.12,zB=g.zBase;
    for(const s of [-1,1])rod(at(uBot,s*.14,zB),at(uTop,s*.14,zT),.022,'#6b4729');
    const n=Math.max(4,Math.round((zT-zB)/.2));
    for(let i=1;i<n;i++){const k=i/n,u=uBot+(uTop-uBot)*k,z=zB+(zT-zB)*k;rod(at(u,-.14,z),at(u,.14,z),.018,'#8a6038')}
    return{pos,col};
  }
  function dynamicMeshes(){
    const out=[];
    for(const t of State.structures){
      if(!entrance(t)||!facesCamera(t))continue;
      const m=stairMesh(t);if(m)out.push(m);
      const leaf=leafMesh(t);if(leaf)out.push(leaf);
      const ladder=ladderMesh(t);if(ladder)out.push(ladder);
    }
    return out;
  }
  let frameAt=0,rafPending=0;
  function animate(){
    const now=performance.now(),elapsed=frameAt?Math.min(.08,(now-frameAt)/1000):0;
    frameAt=now;let moving=false;
    for(const t of State.structures){
      const d=drawbridge(t);if(!d)continue;
      const target=d.raised?1:0;
      if(Math.abs(d.progress-target)>.001){
        d.progress=Math.max(0,Math.min(1,d.progress+(d.raised?1:-1)*elapsed/1.6));
        if(Math.abs(d.progress-target)<.01)d.progress=target;
        moving=true;
      }
    }
    if(moving&&!rafPending)rafPending=requestAnimationFrame(()=>{rafPending=0;draw()});
  }
  // A saved leaf is shown where it was left.
  function normalise(t){
    const d=t?.keepEntrance?.drawbridge;
    if(d?.installed)d.progress=d.raised&&!d.burnt?1:0;
    if(t?.keepEntrance&&![...STAIRS,'burnt'].includes(t.keepEntrance.stair))delete t.keepEntrance;
    return t;
  }

  // ---------- panel ----------
  function describe(t){
    if(!t||t.type!=='tower'||isWoodTower(t)||t.parentTowerId||(typeof isOrientedTower==='function'&&isOrientedTower(t)))return null;
    const e=entrance(t),d=drawbridge(t),cut=unreachable(t);
    return{stair:e?.stair||null,mastio:!!t.isMastio,eligible:eligible(t),
      drawbridge:d?{raised:!!d.raised,moving:d.progress>.01&&d.progress<.99,auto:guardOn(e)}:null,
      leafBurnt:!!e?.drawbridge?.burnt,unreachable:cut,ladder:cut?{down:!!e.ladder?.down}:null,auto:e?guardOn(e):true,
      costs:{wood:STAIR_COST,stone:STONE_COST,drawbridge:DRAWBRIDGE_COST},
      reason:!eligible(t)?'Serve una torre in muratura di almeno 2 piani':!e&&!t.isMastio?'Solo sul mastio':null};
  }
  function panel(t){
    const D=describe(t);if(!D||(!D.stair&&!D.mastio))return'';
    let html='<div class="slot"><div class="slot-label">Ingresso rialzato · '+(D.stair==='stone'?'scala in pietra':D.stair==='wood'?'scala di legno':D.stair==='burnt'?'scala bruciata':'a terra')+'</div>';
    if(!D.stair)html+='<button data-keep-stair '+(D.eligible?'':'disabled')+'>Scala di legno al primo piano · '+costText(STAIR_COST)+'</button>';
    else if(D.stair==='burnt')html+='<button data-keep-stair>Ricostruisci la scala di legno · '+costText(STAIR_COST)+'</button>';
    else{
      if(D.stair==='wood')html+='<button data-keep-stone>Scala in pietra lungo la facciata · '+costText(STONE_COST)+'</button>';
      html+=D.drawbridge?'<div class="grid"><button data-keep-drawbridge-toggle>'+(D.drawbridge.raised?'⬇ Abbassa':'⬆ Alza')+' levatoio</button><button data-keep-drawbridge-remove>Rimuovi levatoio</button></div>'
        :'<button data-keep-drawbridge>'+(D.leafBurnt?'Ricostruisci il levatoio bruciato · ':'Levatoio · ')+costText(DRAWBRIDGE_COST)+'</button>';
    }
    // Stair or leaf burnt: the occupants let a ladder down from the door, or pull it in.
    if(D.ladder)html+='<button data-keep-ladder="'+(D.ladder.down?'0':'1')+'">'+(D.ladder.down?'⬆ Ritira la scala a pioli':'⬇ Cala la scala a pioli')+'</button>'+
      '<div class="legend">'+(D.stair==='burnt'?'Scala bruciata':'Levatoio bruciato, resta il vuoto')+': si entra solo dalla scala a pioli calata dalla porta.</div>';
    if(D.drawbridge||D.ladder)html+='<div class="grid"><button data-keep-auto="1" class="'+(D.auto?'active':'')+'">Automatico ON</button><button data-keep-auto="0" class="'+(D.auto?'':'active')+'">OFF</button></div>'+
      '<div class="legend">Automatico: con un nemico a '+ALARM_NEAR+'U la guardia alza il levatoio (o ritira la scala a pioli) e lo rimette quando se ne va.</div>';
    if(D.stair)html+='<button data-keep-remove>Demolisci ingresso rialzato</button>';
    html+='<div class="legend">'+(D.reason?D.reason+'. ':'')+'La porta sale al primo piano; il piano terra resta cieco. Con il levatoio alzato nessuno entra dal suolo.</div></div>';
    return html;
  }
  function bindPanel(slots){
    const t=typeof selectedStructure==='function'?selectedStructure():null;if(!t)return;
    slots.querySelector('[data-keep-stair]')?.addEventListener('click',()=>buildStair(t));
    slots.querySelector('[data-keep-stone]')?.addEventListener('click',()=>upgradeStone(t));
    slots.querySelector('[data-keep-drawbridge]')?.addEventListener('click',()=>installDrawbridge(t));
    slots.querySelector('[data-keep-drawbridge-toggle]')?.addEventListener('click',()=>toggleDrawbridge(t));
    slots.querySelector('[data-keep-drawbridge-remove]')?.addEventListener('click',()=>removeDrawbridge(t));
    slots.querySelector('[data-keep-ladder]')?.addEventListener('click',e=>setLadder(t,e.currentTarget.dataset.keepLadder==='1'));
    slots.querySelectorAll('[data-keep-auto]').forEach(b=>b.addEventListener('click',()=>setAuto(t,b.dataset.keepAuto==='1')));
    slots.querySelector('[data-keep-remove]')?.addEventListener('click',()=>{if(confirm('Demolire l\'ingresso rialzato del mastio?'))removeEntrance(t)});
  }

  window.ConquerKeepEntrance={eligible,entrance,drawbridge,sill,layout,validate,buildStair,upgradeStone,installDrawbridge,
    toggleDrawbridge,removeDrawbridge,removeEntrance,access,footPoint,closed,obstacles,climbPoint,climbDuration,
    setAuto,setLadder,unreachable,ladderGeom,ladderMesh,alarmTick,enemyDistance,fireParts,burnout,fireSeats,dynamicMeshes,stairMesh,leafMesh,animate,normalise,
    describe,panel,bindPanel,STAIR_COST,STONE_COST,DRAWBRIDGE_COST,ALARM_NEAR,ALARM_CLEAR};
})();
