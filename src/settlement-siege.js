'use strict';
// CONQUER /assedio P0: siege domain (no rendering-driven combat rules).
(function(){
  const CAPACITY=Object.freeze({granary:{food:240},storage:{materials:240},armory:{equipment:80},
    stables:{horses:12},treasury:{gold:1200},kitchen:{meals:80},barracks:{soldiers:16},
    nobleRoom:{knights:2},quarters:{soldiers:16}});
  const WEAPONS=Object.freeze({
    sword:{stone:0,wood:0,door:0},
    spear:{stone:0,wood:0,door:0},
    axe:{stone:0,wood:.45,door:.65},
    ram:{stone:0,wood:2.5,door:6},
    torch:{stone:0,wood:2,door:2.5},
    catapult:{stone:3,wood:3.8,door:3.5},
    trebuchet:{stone:7,wood:8,door:7}
  });
  const BASE_HEALTH=Object.freeze({tower:260,gate:250,wall:130,built:170,palisade:75});
  const STOCK_KEYS=['food','wood','stone','metal','equipment','horses','gold'];
  const MATERIAL_KEYS=['wood','stone','metal'];
  const fmt=n=>Math.max(0,Math.round(Number(n)||0));
  function initial(){return{version:1,stock:Object.fromEntries(STOCK_KEYS.map(k=>[k,0])),
    lastDay:State.clock.day,starvationDays:0,ruins:[]}}
  function state(){
    if(!State.siege||typeof State.siege!=='object')State.siege=initial();
    const x=State.siege;
    if(!x.stock||typeof x.stock!=='object')x.stock={};
    for(const k of STOCK_KEYS)x.stock[k]=Math.max(0,Number(x.stock[k])||0);
    if(!Array.isArray(x.ruins))x.ruins=[];
    if(!Number.isFinite(x.lastDay))x.lastDay=State.clock.day;
    if(!Number.isFinite(x.starvationDays))x.starvationDays=0;
    return x;
  }
  function restore(raw){
    State.siege=raw&&typeof raw==='object'?{
      version:1,stock:{...(raw.stock||{})},lastDay:Number(raw.lastDay),
      starvationDays:Number(raw.starvationDays)||0,ruins:Array.isArray(raw.ruins)?raw.ruins.slice(-200):[]
    }:initial();
    state();normalizeMastio();
  }
  function eligibleRoom(s){return !!s&&['tower','gate','built'].includes(s.type)&&!underConstruction(s)}
  function floor(s,index){return index+1}
  function allowed(s,index,fn){
    if(!fn)return true;
    if(!eligibleRoom(s)||index<0||index>=functionCapacity(s))return false;
    const l=floor(s,index),top=structureLevel(s);
    if(['stables','workshop'].includes(fn))return l===1&&s.type!=='gate'&&!s.parentTowerId;
    if(['granary','storage','kitchen','commonHall'].includes(fn))
      return l===1||(l===2&&top>=3);
    return true;
  }
  function ensureMastioHall(tower,replace=false){
    if(!eligibleRoom(tower)||tower.type!=='tower'||!functionCapacity(tower))return false;
    normalizeFunctions(tower);
    if(tower.functions.some((fn,i)=>fn==='commonHall'&&allowed(tower,i,fn)))return true;
    let index=tower.functions.findIndex((fn,i)=>!fn&&allowed(tower,i,'commonHall'));
    // Repair legacy saves without silently replacing an occupied room on a new designation.
    if(index<0&&replace)index=tower.functions.findIndex((fn,i)=>allowed(tower,i,'commonHall'));
    if(index<0)return false;
    tower.functions[index]='commonHall';
    return true;
  }
  function mastio(){
    return State.structures.find(s=>s.type==='tower'&&s.isMastio&&!s.destroyed&&!underConstruction(s)
      &&s.functions?.includes('commonHall'))||null;
  }
  function armories(){
    return State.structures.filter(s=>eligibleRoom(s)&&!s.destroyed
      &&s.functions?.some((fn,i)=>fn==='armory'&&allowed(s,i,fn)));
  }
  function sanitizeRooms(s){
    if(!s||!['tower','gate','built'].includes(s.type))return false;
    normalizeFunctions(s);let changed=false;
    s.functions.forEach((fn,i)=>{if(fn&&!allowed(s,i,fn)){s.functions[i]=null;changed=true}});
    if(s.type==='tower'&&s.isMastio&&!ensureMastioHall(s,true)){
      s.isMastio=false;changed=true;
    }
    return changed;
  }
  function mastioEligible(s){
    return !!s&&s.type==='tower'&&!s.parentTowerId&&!s.destroyed
      &&(!isWoodTower(s)||woodTowerStyle(s)!=='watchtower');
  }
  function normalizeMastio(){
    let chosen=false;
    for(const s of State.structures){
      if(!s.isMastio)continue;
      if(mastioEligible(s)&&!chosen){
        if(underConstruction(s)||ensureMastioHall(s,true)){chosen=true;continue}
      }
      s.isMastio=false;
    }
  }
  function syncAutoMastio(){
    // The first independent finished tower is the keep, regardless of whether
    // it is wood, round stone or square stone. Gates/watchtowers are excluded.
    if(State.structures.some(s=>s.type==='tower'&&s.isMastio&&mastioEligible(s)))return false;
    const eligible=State.structures.filter(s=>mastioEligible(s)&&!underConstruction(s));
    if(!eligible.length)return false;
    eligible.sort((a,b)=>{
      const t=s=>Number.isFinite(s.construction?.completeDay)?s.construction.completeDay:0;
      return t(a)-t(b)||State.structures.indexOf(a)-State.structures.indexOf(b);
    });
    const first=eligible[0];
    first.isMastio=true;
    if(!ensureMastioHall(first,true)){first.isMastio=false;return false}
    markDirty(false,['base','castleBody','castleFront']);
    window.__conquerAnalytics?.event('MASTIO_AUTO_DESIGNATED',{
      towerId:first.id,material:isWoodTower(first)?'wood':'stone',
      shape:first.shape||'square',day:State.clock.day
    });
    return true;
  }
  function assignMastio(id){
    const selected=State.structures.find(s=>s.id===id&&mastioEligible(s)&&!underConstruction(s));
    if(!selected)return false;
    const already=!!selected.isMastio;
    if(!already){
      selected.isMastio=true;
      if(!ensureMastioHall(selected)){
        selected.isMastio=false;
        status('Mastio requires an available room for the Common Hall.');
        return false;
      }
    }
    for(const s of State.structures)if(s.type==='tower'&&s!==selected)s.isMastio=false;
    if(already)selected.isMastio=false;
    markDirty(false,['base','castleBody','castleFront']);
    renderFunctionPanel();draw();
    status(already?'Mastio designation removed':'Mastio designated — Common Hall secured');
    return true;
  }
  function capacity(){
    const out={food:0,materials:0,equipment:0,horses:0,gold:0,meals:0,soldiers:0,knights:0};
    for(const s of State.structures){
      if(!eligibleRoom(s)||s.destroyed)continue;
      normalizeFunctions(s);
      s.functions.forEach((fn,i)=>{
        const spec=CAPACITY[fn];if(!spec||!allowed(s,i,fn))return;
        const units=functionSlotUnits(s,i);
        for(const [k,v] of Object.entries(spec))out[k]+=v*units;
      });
    }
    return out;
  }
  function used(key){
    const stock=state().stock;
    return key==='materials'?MATERIAL_KEYS.reduce((sum,k)=>sum+stock[k],0):stock[key]||0;
  }
  function transfer(key,requested=50){
    if(!STOCK_KEYS.includes(key))return{accepted:0,reason:'Unsupported supply'};
    const max=capacity(),group=MATERIAL_KEYS.includes(key)?'materials':key;
    const from=Math.max(0,Number(State.resources[key])||0);
    const remaining=Math.max(0,(max[group]||0)-used(group));
    const accepted=Math.floor(Math.max(0,Math.min(Number(requested)||0,from,remaining)));
    if(accepted<=0)return{accepted:0,reason:remaining<=0?'No storage capacity':'No available settlement resource'};
    State.resources[key]-=accepted;state().stock[key]+=accepted;
    markDirty(false,false,true);renderUI();renderFunctionPanel();
    return{accepted};
  }
  function civilians(){
    return State.structures.reduce((sum,s)=>sum+(s.type==='house'&&!underConstruction(s)?housePopulationCapacity(s).total:0),0);
  }
  function dailyFoodDemand(){
    const cap=capacity(),civ=civilians();
    // Barracks and noble rooms represent stationed forces until unit accounting is linked.
    return +(civ*.12+cap.soldiers*.22+cap.knights*.35).toFixed(4);
  }
  function tick(before,after){
    const x=state(),elapsed=Math.max(0,Number(after)-Math.max(Number(before)||0,x.lastDay));
    x.lastDay=after;
    if(!elapsed)return;
    const demand=dailyFoodDemand()*elapsed;
    if(demand<=0)return;
    const consumed=Math.min(x.stock.food,demand);
    x.stock.food=Math.max(0,x.stock.food-consumed);
    if(consumed<demand)x.starvationDays+=elapsed*(demand-consumed)/demand;
    else x.starvationDays=Math.max(0,x.starvationDays-elapsed*.2);
    // No automatic surrender in P0: the actual siege/occupation loop is P2.
    if(Math.floor(before)!==Math.floor(after))scheduleLocalSave(500);
  }
  // The same ordered tower slots drive UI, visible soldiers and combat fire.
  // Priority: usable roof, then embrasures from highest to lowest floor.
  function archerSlots(tower){
    if(!tower||tower.type!=='tower'||underConstruction(tower)||tower.destroyed)return[];
    const result=[],center={x:tower.x,y:tower.y};
    const wood=isWoodTower(tower);
    const openDeck=wood?woodTowerStyle(tower)==='palisadeTower'&&woodTowerRoof(tower)==='open'
      :['battlement','machicolation'].includes(towerRoofStyle(tower));
    const top=wood?1:structureLevel(tower);
    const ground=placementGroundZ(tower);
    if(openDeck){
      const p=wood?woodTowerLocal(tower,0,.03):{...center};
      const z=wood?1.82:structureHeight(tower)+.08;
      result.push({id:tower.id+':roof',kind:'roof',floor:top,p,z,
        h:ground+top,visualZ:ground+z});
    }
    if(wood)return result; // Wooden towers have no stone arrow slits.
    const iv=structureInteriorVector(tower);
    let dirs=[];
    if(tower.shape==='round'){
      const base=Math.atan2(iv.y,iv.x);
      // Face zero opens toward the castle interior, never a firing slit.
      dirs=[1,2,3].map(i=>({face:i,nx:Math.cos(base+i*Math.PI/2),ny:Math.sin(base+i*Math.PI/2)}));
    }else{
      const fp=footprintPoints(tower),interior=interiorFacadeEdgeIndex(tower);
      for(let i=0;i<fp.length;i++){
        if(i===interior)continue;
        const a=fp[i],b=fp[(i+1)%fp.length];
        const nx=(a.x+b.x)/2-tower.x,ny=(a.y+b.y)/2-tower.y,L=Math.hypot(nx,ny)||1;
        dirs.push({face:i,nx:nx/L,ny:ny/L});
      }
    }
    const links=State.structures.filter(s=>!underConstruction(s)&&['wall','built','palisade'].includes(s.type)
      &&(s.aSnap===tower.id||s.bSnap===tower.id));
    const blocked=(dir,floor)=>{
      return links.some(wall=>{
        if(structureLevel(wall)<floor)return false;
        const contact=wall.aSnap===tower.id?wall.a:wall.b;
        if(!contact)return false;
        const dx=contact.x-tower.x,dy=contact.y-tower.y,L=Math.hypot(dx,dy)||1;
        // Corner junctions disable both adjacent wall faces.
        return (dir.nx*dx+dir.ny*dy)/L>=.65;
      });
    };
    const radius=tower.shape==='round'?Math.max(.13,tower.r-.17):Math.max(.13,(tower.size||1)/2-.17);
    for(let floor=top;floor>=2;floor--){ // P1 has no arrow slits
      const z=[1.34,2.48,3.62][floor-1];
      if(z>=structureHeight(tower)-.28)continue;
      for(const dir of dirs){
        if(blocked(dir,floor))continue;
        const p={x:tower.x+dir.nx*radius,y:tower.y+dir.ny*radius};
        result.push({id:tower.id+':slit:'+floor+':'+dir.face,kind:'slit',
          floor,face:dir.face,nx:dir.nx,ny:dir.ny,p,z,h:ground+floor,visualZ:ground+z});
      }
    }
    return result;
  }
  function stationedArchers(tower){
    const n=Number(tower?.archerCount);
    return Math.min(archerSlots(tower).length,Number.isFinite(n)?Math.max(0,Math.floor(n)):0);
  }
  function occupiedArcherSlots(tower){return archerSlots(tower).slice(0,stationedArchers(tower))}
  function changeArchers(id,delta){
    const tower=State.structures.find(s=>s.id===id&&s.type==='tower');
    if(!tower||underConstruction(tower))return false;
    const slots=archerSlots(tower),before=stationedArchers(tower);
    const next=Math.max(0,Math.min(slots.length,before+Math.sign(Number(delta)||0)));
    if(before===next)return false;
    tower.archerCount=next;
    window.ConquerCombat?.invalidateArchers?.();
    markDirty(false,false,true);
    renderFunctionPanel();draw();
    status('Archers assigned: '+next+' / '+slots.length+' · '+(next?slots[Math.max(0,next-1)].kind:'empty'));
    return true;
  }
  function healthMaximum(s){
    const base=BASE_HEALTH[s.type]||0;
    const material=s.material==='wood'?.60:1;
    const scale=['wall','built','palisade'].includes(s.type)?Math.max(1,Number(s.length)||1):1;
    const tier=s.type==='tower'?towerTier(s):['wall','palisade'].includes(s.type)?wallTier(s):2;
    return Math.round(base*material*scale*(.65+tier*.175)*(1+(structureLevel(s)-1)*.30));
  }
  function integrity(s){
    if(!s||!BASE_HEALTH[s.type])return null;
    const max=healthMaximum(s);
    const existing=s.siegeIntegrity&&typeof s.siegeIntegrity==='object'?s.siegeIntegrity:null;
    if(!existing)s.siegeIntegrity={core:{hp:max,max},door:s.type==='gate'?{hp:85,max:85}:null};
    else{
      if(!existing.core)existing.core={hp:max,max};
      // Keep existing absolute damage when a tier/height upgrade changes maximum health.
      const previous=Number(existing.core.max)||max,damage=Math.max(0,previous-(Number(existing.core.hp)||0));
      existing.core.max=max;existing.core.hp=Math.max(0,max-damage);
      if(s.type==='gate'&&!existing.door)existing.door={hp:85,max:85};
    }
    return s.siegeIntegrity;
  }
  function targetMaterial(s,part='core'){
    if(part==='door'&&s.type==='gate')return'door';
    return s.type==='palisade'||s.material==='wood'?'wood':'stone';
  }
  function effectiveness(weapon,s,part='core'){
    return Math.max(0,WEAPONS[weapon]?.[targetMaterial(s,part)]||0);
  }
  // ---------- wall bays and breaches ----------
  // Walls and palisades take damage bay by bay (~2.5 U each, laid out along a->b) so
  // a breach opens where the blows land. When a bay falls the wall is split there:
  // the standing stretches become separate walls (same ids for towers' links, own
  // bays and costs) and the gap holds rubble, so navigation, colliders and both
  // renderers see the opening with no special case.
  const BAY_TARGET=2.5;
  const isLinear=s=>!!s&&['wall','palisade'].includes(s.type);
  const lengthOf=s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);
  const sum=(list,key)=>list.reduce((t,b)=>t+b[key],0);
  function bays(s){
    if(!isLinear(s))return null;
    const stats=integrity(s);if(!stats)return null;
    const L=lengthOf(s),total=stats.core.max;
    let list=Array.isArray(stats.bays)&&stats.bays.length?stats.bays:null;
    if(!list){
      // First use (or a legacy save): even bays, damage already taken spread evenly.
      const n=Math.max(1,Math.round(L/BAY_TARGET)),damage=Math.max(0,total-stats.core.hp);
      list=[...Array(n).keys()].map(i=>({from:L*i/n,to:L*(i+1)/n,max:total/n,hp:Math.max(0,(total-damage)/n)}));
    }else if(Math.abs((list[list.length-1].to||L)-L)>1e-6||Math.abs(sum(list,'max')-total)>1e-6){
      // A tower re-snapping the end or an upgrade: rescale, keep each bay's absolute damage.
      const old=list[list.length-1].to||L;
      list=list.map(b=>{
        const max=total*(b.to-b.from)/old,damage=Math.max(0,(Number(b.max)||max)-(Number(b.hp)||0));
        return{from:b.from*L/old,to:b.to*L/old,max,hp:Math.max(0,max-damage)};
      });
    }
    stats.bays=list;stats.core.hp=sum(list,'hp');
    return list;
  }
  function bayIndexAt(s,p){
    const list=bays(s),L=lengthOf(s)||1;
    const along=((p.x-s.a.x)*(s.b.x-s.a.x)+(p.y-s.a.y)*(s.b.y-s.a.y))/L;
    const i=list.findIndex(b=>along<b.to);
    return i<0?list.length-1:i;
  }
  function attackWall(s,weapon,force,where){
    const list=bays(s),factor=effectiveness(weapon,s,'core');
    if(!factor)return{ok:false,damage:0,reason:'Weapon cannot damage this material'};
    let i=Number.isInteger(where)?where:where&&Number.isFinite(where.x)?bayIndexAt(s,where):Math.floor((list.length-1)/2);
    i=Math.max(0,Math.min(list.length-1,i));
    const bay=list[i];
    if(bay.hp<=0)return{ok:false,damage:0,reason:'Bay already breached'};
    const damage=Math.min(bay.hp,Math.max(0,Number(force)||0)*factor);
    if(!damage)return{ok:false,damage:0,reason:'No force applied'};
    bay.hp=Math.max(0,bay.hp-damage);s.siegeIntegrity.core.hp=sum(list,'hp');
    if(bay.hp===0){
      const pieces=breach(s,i);
      return{ok:true,part:'bay',bay:i,damage,remaining:0,max:bay.max,destroyed:true,breach:true,pieces};
    }
    invalidateStructureScene(s);markDirty(true,true,true);draw();
    return{ok:true,part:'bay',bay:i,damage,remaining:bay.hp,max:bay.max,destroyed:false};
  }
  function breach(s,i){
    const list=s.siegeIntegrity.bays,L=lengthOf(s),ux=(s.b.x-s.a.x)/L,uy=(s.b.y-s.a.y)/L;
    const at=d=>({x:s.a.x+ux*d,y:s.a.y+uy*d}),bay=list[i],p0=at(bay.from),p1=at(bay.to);
    const piece=(a,b,aSnap,bSnap,kept,offset)=>{
      const len=Math.hypot(b.x-a.x,b.y-a.y);
      if(!kept.length||len<(typeof WALL_BREAK_MIN==='number'?WALL_BREAK_MIN:.1))return null;
      const f=wallFragmentFrom(s,a,b,aSnap,bSnap,len/L),own=kept.map(k=>({from:k.from-offset,to:k.to-offset,max:k.max,hp:k.hp}));
      f.siegeIntegrity={core:{hp:sum(own,'hp'),max:sum(own,'max')},door:null,bays:own};
      return f;
    };
    const left=piece(s.a,p0,s.aSnap,null,list.slice(0,i),0),right=piece(p1,s.b,null,s.bSnap,list.slice(i+1),bay.to);
    const pieces=[left,right].filter(Boolean);
    const x=state();
    x.ruins.push({id:s.id+':breach:'+i+':'+State.clock.day,type:'breach',wall:s.type,a:p0,b:p1,
      x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2,width:Number(s.width)||.5,height:structureHeight(s),day:State.clock.day});
    if(x.ruins.length>200)x.ruins.splice(0,x.ruins.length-200);
    const idx=State.structures.findIndex(t=>t.id===s.id);
    if(idx>=0)State.structures.splice(idx,1,...pieces);
    // Towers keep their links: the a end now belongs to the left stretch, the b end to the right.
    for(const t of State.structures)if(Array.isArray(t.wallConnections))
      t.wallConnections=t.wallConnections.flatMap(c=>c.wallId!==s.id?[c]:c.end==='a'?(left?[{...c,wallId:left.id}]:[]):(right?[{...c,wallId:right.id}]:[]));
    if(State.selectedId===s.id)State.selectedId=pieces[0]?.id||null;
    if(typeof invalidateCastleColliderGeometry==='function')invalidateCastleColliderGeometry(...pieces);
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateSceneCache();markDirty(true,true,true);
    renderFunctionPanel();draw();
    return pieces.map(p=>p.id);
  }
  // Ladders and assault towers need somewhere to rest: not on thin (T1) walls, and
  // hoardings keep them off. Ladders only reach the low (H1) wall top; a tower
  // reaches walls up to its own level. Machicolations do not stop an assault.
  function assaultCheck(wall,engine,level=1){
    if(!isLinear(wall))return{ok:false,reason:'Only walls can be stormed'};
    if(wallTier(wall)<2)return{ok:false,reason:'Thin wall (T1): no ladder or bridge can rest on it'};
    if(wall.type==='wall'&&wallSkin(wall)==='hoarding')return{ok:false,reason:'Hoardings keep ladders and bridges off the wall'};
    const h=structureLevel(wall);
    if(engine==='ladder'&&h>1)return{ok:false,reason:'Ladders only reach low (H1) walls'};
    if(engine==='tower'&&(Number(level)||1)<h)return{ok:false,reason:'A level '+h+' assault tower is needed for this wall'};
    if(!['ladder','tower'].includes(engine))return{ok:false,reason:'Not an assault engine'};
    return{ok:true};
  }
  // Rubble in breaches: broken blocks spilled across the gap (static meshes, world units).
  const rubbleCache=new Map();
  function rubbleMesh(r){
    let m=rubbleCache.get(r.id);if(m)return m;
    const pos=[],col=[],COLORS=['#9a8e82','#8a7f74','#a89c8f','#7d7266'];
    let seed=0;for(const ch of String(r.id))seed=(seed*31+ch.charCodeAt(0))>>>0;
    const rnd=()=>(seed=(Math.imul(seed,1103515245)+12345)>>>0)/4294967296;
    const L=Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y)||1,ux=(r.b.x-r.a.x)/L,uy=(r.b.y-r.a.y)/L,nx=-uy,ny=ux;
    const spread=(r.width||.5)/2+.45,peak=(r.height||1.15)*.32,g=typeof terrainElevation==='function'?terrainElevation(r):0;
    const box=(cx,cy,z0,sx,sy,sz,yaw,c)=>{
      const ca=Math.cos(yaw),sa=Math.sin(yaw),P=[];
      for(const dx of [-sx,sx])for(const dy of [-sy,sy])for(const z of [z0,z0+2*sz])P.push([cx+dx*ca-dy*sa,cy+dx*sa+dy*ca,z]);
      for(const [a,b,c2,d] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[a,b,c2],[a,c2,d]]){for(const k of tri)pos.push(...P[k]);col.push(c)}
    };
    const n=Math.max(8,Math.round(L*14*(r.width||.5)+L*6));
    for(let k=0;k<n;k++){
      const t=(rnd()*.9+.05)*L,s=(rnd()*2-1)*spread,mound=peak*Math.max(0,1-Math.abs(s)/spread)*(.6+.4*Math.sin(Math.PI*t/L));
      const size=.05+rnd()*.09,z=g+Math.max(0,mound*rnd()-size*.5);
      box(r.a.x+ux*t+nx*s,r.a.y+uy*t+ny*s,z,size*(1+rnd()),size,size*(.6+rnd()*.5),rnd()*Math.PI,COLORS[Math.floor(rnd()*COLORS.length)]);
    }
    m={pos,col};rubbleCache.set(r.id,m);return m;
  }
  // Moving or static extra meshes for the 3D world renderer (rubble in breaches).
  function dynamicMeshes(){return state().ruins.filter(r=>r.type==='breach'&&r.a&&r.b).map(rubbleMesh)}
  function attackStructure(id,weapon,force=1,part='core'){
    const s=State.structures.find(x=>x.id===id);
    if(!s||underConstruction(s)||!BASE_HEALTH[s.type])return{ok:false,reason:'Invalid or unfinished fortification'};
    // Walls and palisades: part may name a bay (index) or the point of impact {x,y}.
    if(isLinear(s))return attackWall(s,weapon,force,part==='core'?null:part);
    const stats=integrity(s),section=part==='door'&&s.type==='gate'?'door':'core',hp=stats[section];
    const factor=effectiveness(weapon,s,section);
    if(!factor)return{ok:false,damage:0,reason:'Weapon cannot damage this material'};
    if(!hp||hp.hp<=0)return{ok:false,damage:0,reason:'Section already destroyed'};
    const damage=Math.min(hp.hp,Math.max(0,Number(force)||0)*factor);
    if(!damage)return{ok:false,damage:0,reason:'No force applied'};
    hp.hp=Math.max(0,hp.hp-damage);
    if(section==='core'&&hp.hp===0)destroyStructure(s);
    else{
      invalidateStructureScene(s);markDirty(true,true,true);draw();
    }
    return{ok:true,part:section,damage,remaining:hp.hp,max:hp.max,destroyed:hp.hp===0};
  }
  function destroyStructure(s){
    const x=state();
    x.ruins.push({id:s.id,type:s.type,x:s.x??(s.a.x+s.b.x)/2,
      y:s.y??(s.a.y+s.b.y)/2,day:State.clock.day});
    if(x.ruins.length>200)x.ruins.splice(0,x.ruins.length-200);
    if(s.type==='tower'&&typeof detachSubtowerChildren==='function')detachSubtowerChildren(s.id);
    State.structures=State.structures.filter(x=>x.id!==s.id);
    if(State.selectedId===s.id)State.selectedId=null;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateSceneCache();
    markDirty(true,true,true);
    renderFunctionPanel();draw();
  }
  function crack(origin,z,k){
    const p=w2s(origin,z),s=.6+k;
    ctx.strokeStyle='rgba(45,24,18,.9)';ctx.lineWidth=Math.max(1,State.view.scale*2);
    ctx.beginPath();ctx.moveTo(p.x-5*s,p.y-5*s);ctx.lineTo(p.x+2*s,p.y+s);
    ctx.lineTo(p.x-2*s,p.y+7*s);ctx.lineTo(p.x+6*s,p.y+12*s);ctx.stroke();
  }
  function drawOverlay(){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    for(const s of State.structures){
      const hp=s.siegeIntegrity?.core;
      if(!hp||hp.hp>=hp.max||hp.hp<=0)continue;
      // Walls crack bay by bay, where they were hit.
      if(isLinear(s)&&Array.isArray(s.siegeIntegrity.bays)){
        const L=lengthOf(s)||1;
        for(const b of s.siegeIntegrity.bays)if(b.hp<b.max){
          const m=(b.from+b.to)/2/L;crack({x:s.a.x+(s.b.x-s.a.x)*m,y:s.a.y+(s.b.y-s.a.y)*m},structureHeight(s)*.55,1-b.hp/b.max);
        }
        continue;
      }
      crack(s.x!==undefined?s:{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},structureHeight(s)*.55,.4);
    }
    const world3d=window.ConquerWorld3D?.active?.();
    for(const r of state().ruins){
      if(r.type==='breach'&&r.a&&r.b){
        if(world3d)continue;                  // drawn as 3D rubble (dynamicMeshes)
        const L=Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y)||1,nx=-(r.b.y-r.a.y)/L,ny=(r.b.x-r.a.x)/L,w=(r.width||.5)/2+.3;
        const q=[[r.a,w],[r.b,w],[r.b,-w],[r.a,-w]].map(([p,o])=>w2s({x:p.x+nx*o,y:p.y+ny*o},0));
        ctx.fillStyle='#857867';ctx.strokeStyle='#4f4337';ctx.lineWidth=1;
        ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.stroke();
        continue;
      }
      const p=w2s(r,0),z=State.view.scale;
      ctx.fillStyle='#796653';ctx.strokeStyle='#49372c';ctx.lineWidth=1;
      ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(3,8*z),Math.max(2,4*z),0,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
  function summaryHtml(){
    const c=capacity(),x=state(),f=x.stock.food,d=dailyFoodDemand();
    const days=d>0?Math.floor(f/d):null,material=used('materials');
    const fmtDays=days===null?'∞':days+' d';
    const buttons=['food','wood','stone','metal','equipment','gold','horses'].map(key=>{
      const group=MATERIAL_KEYS.includes(key)?'materials':key;
      const disabled=(c[group]||0)<=used(group)||(State.resources[key]||0)<=0;
      return '<button data-siege-transfer="'+key+'" '+(disabled?'disabled':'')+'>+'+key+'</button>';
    }).join('');
    return '<div class="slot"><div class="slot-label">Castle logistics · allocated stores</div>'+
      '<div class="legend">Food '+fmt(f)+'/'+fmt(c.food)+' · '+fmtDays+' autonomy · Daily '+d.toFixed(1)+
      '<br>Materials '+fmt(material)+'/'+fmt(c.materials)+' · Arms '+fmt(x.stock.equipment)+'/'+fmt(c.equipment)+
      '<br>Horses '+fmt(x.stock.horses)+'/'+fmt(c.horses)+' · Gold '+fmt(x.stock.gold)+'/'+fmt(c.gold)+
      '<br>Kitchen '+fmt(c.meals)+' meals/d · Barracks '+fmt(c.soldiers)+' · Knights '+fmt(c.knights)+
      (x.starvationDays>0?'<br>⚠ Supply shortfall '+x.starvationDays.toFixed(1)+' d':'')+'</div>'+
      '<div class="grid3">'+buttons+'</div><div class="legend">Transfer up to 50 from settlement resources per click. Supply capacity depends on rooms.</div></div>';
  }
  function bindPanel(slots){
    slots.querySelectorAll('[data-siege-archer]').forEach(btn=>btn.onclick=()=>{
      const tower=selectedStructure();
      if(tower?.type==='tower')changeArchers(tower.id,Number(btn.dataset.siegeArcher));
    });
    slots.querySelectorAll('[data-siege-transfer]').forEach(btn=>btn.onclick=()=>{
      const out=transfer(btn.dataset.siegeTransfer);
      if(!out.accepted)status(out.reason);
      else status('Stored '+out.accepted+' '+btn.dataset.siegeTransfer);
    });
    slots.querySelectorAll('[data-siege-mastio]').forEach(btn=>btn.onclick=()=>assignMastio(btn.dataset.siegeMastio));
    slots.querySelectorAll('[data-siege-bay]').forEach(btn=>btn.onclick=()=>{
      const s=selectedStructure();if(!isLinear(s))return;
      const out=attackStructure(s.id,'trebuchet',10,Number(btn.dataset.siegeBay));
      status(out.ok?(out.breach?'Breccia aperta nella campata '+(out.bay+1):'Campata '+(out.bay+1)+' colpita · '+out.damage.toFixed(1)):out.reason);
      renderFunctionPanel();
    });
    slots.querySelectorAll('[data-siege-test]').forEach(btn=>btn.onclick=()=>{
      const s=selectedStructure();if(!s)return;
      const part=s.type==='gate'&&btn.dataset.siegeTest!=='trebuchet'?'door':'core';
      const out=attackStructure(s.id,btn.dataset.siegeTest,10,part);
      status(out.ok?(out.destroyed?'Defence breached · ':'Damage dealt · ')+out.damage.toFixed(1):out.reason);
      renderFunctionPanel();
    });
  }
  window.ConquerSiege={restore,state,initial,assignMastio,normalizeMastio,syncAutoMastio,ensureMastioHall,mastio,armories,allowed,sanitizeRooms,
    capacity,used,transfer,civilians,dailyFoodDemand,tick,integrity,effectiveness,attackStructure,
    drawOverlay,summaryHtml,bindPanel,WEAPONS,healthMaximum,
    bays,bayIndexAt,assaultCheck,dynamicMeshes,BAY_TARGET,
    archerSlots,stationedArchers,occupiedArcherSlots,changeArchers};
})();
