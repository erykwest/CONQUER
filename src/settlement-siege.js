'use strict';
// CONQUER /assedio P0: siege domain (no rendering-driven combat rules).
(function(){
  function redraw(){if(typeof requestSceneDraw==='function')requestSceneDraw();else if(typeof draw==='function')draw()}
  const CAPACITY=Object.freeze({granary:{food:240},storage:{materials:240},armory:{equipment:80},
    stables:{horses:12},treasury:{gold:1200},kitchen:{meals:80},barracks:{soldiers:16},
    nobleRoom:{knights:2},quarters:{soldiers:16}});
  const WEAPONS=Object.freeze({
    sword:{stone:0,wood:0,door:0},
    spear:{stone:0,wood:0,door:0,portcullis:0},
    axe:{stone:0,wood:.45,door:.65,portcullis:.1},
    ram:{stone:0,wood:2.5,door:6,portcullis:4},
    torch:{stone:0,wood:2,door:2.5,portcullis:0},
    catapult:{stone:3,wood:3.8,door:3.5,portcullis:2.5},
    trebuchet:{stone:7,wood:8,door:7,portcullis:6}
  });
  const PORTCULLIS_HEALTH=120;
  const BASE_HEALTH=Object.freeze({tower:260,gate:250,wall:130,built:170,palisade:75,
    house:90,market:70,tavern:140,church:240,windmill:110,watermill:120});
  const isMill=s=>['windmill','watermill'].includes(s?.type);
  const STOCK_KEYS=['food','wood','stone','metal','equipment','horses','gold'];
  const MATERIAL_KEYS=['wood','stone','metal'];
  const fmt=n=>Math.max(0,Math.round(Number(n)||0));
  function initial(){return{version:1,stock:Object.fromEntries(STOCK_KEYS.map(k=>[k,0])),
    lastDay:State.clock.day,starvationDays:0,ruins:[],earthworks:[]}}
  function state(){
    if(!State.siege||typeof State.siege!=='object')State.siege=initial();
    const x=State.siege;
    if(!x.stock||typeof x.stock!=='object')x.stock={};
    for(const k of STOCK_KEYS)x.stock[k]=Math.max(0,Number(x.stock[k])||0);
    if(!Array.isArray(x.ruins))x.ruins=[];
    if(!Array.isArray(x.earthworks))x.earthworks=[];
    if(!Number.isFinite(x.lastDay))x.lastDay=State.clock.day;
    if(!Number.isFinite(x.starvationDays))x.starvationDays=0;
    return x;
  }
  function restore(raw){
    const previous=Array.isArray(State.siege?.ruins)?State.siege.ruins:[],loaded=Array.isArray(raw?.ruins)?raw.ruins:[];
    for(const r of [...previous,...loaded])if(r?.id)window.ConquerCollapse?.forget(r.id);
    started.clear();heapCache.clear();rubbleCache.clear();stumpCache.clear();crownCache.clear();
    State.siege=raw&&typeof raw==='object'?{
      version:1,stock:{...(raw.stock||{})},lastDay:Number(raw.lastDay),
      starvationDays:Number(raw.starvationDays)||0,ruins:Array.isArray(raw.ruins)?raw.ruins.slice(-200):[],
      earthworks:Array.isArray(raw.earthworks)?raw.earthworks.slice(-100):[]
    }:initial();
    state();normalizeMastio();
    rubbleGrid=null;                                  // rubble of the loaded game
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
    renderFunctionPanel();redraw();
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
    gateNightWatch();bridgeAlarm();
    const x=state(),elapsed=Math.max(0,Number(after)-Math.max(Number(before)||0,x.lastDay));
    x.lastDay=after;
    if(elapsed)window.ConquerEarthworks?.tick(elapsed);
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
    renderFunctionPanel();redraw();
    status('Archers assigned: '+next+' / '+slots.length+' · '+(next?slots[Math.max(0,next-1)].kind:'empty'));
    return true;
  }
  function healthMaximum(s){
    const base=BASE_HEALTH[s.type]||0;
    const material=s.material==='wood'?.60:s.masonryMaterial==='brick'?.80:1;
    const scale=['wall','built','palisade'].includes(s.type)?Math.max(1,Number(s.length)||1)
      :s.type==='house'?1+(houseLevel(s)-1)*.4:1;
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
    // An installed portcullis is a defence layer of its own, in front of the door.
    const grate=s.type==='gate'&&window.ConquerGates?.portcullis?.(s);
    if(grate&&!s.siegeIntegrity.portcullis)s.siegeIntegrity.portcullis={hp:grate.wrecked?0:PORTCULLIS_HEALTH,max:PORTCULLIS_HEALTH};
    else if(!grate)delete s.siegeIntegrity.portcullis;
    return s.siegeIntegrity;
  }
  // The section a blow at a gate's way in lands on: a lowered portcullis shields the door
  // from everything but fire, which reaches the timber through the bars.
  function gateSection(s,part,weapon){
    if(part!=='door'||s.type!=='gate')return'core';
    return weapon!=='torch'&&window.ConquerGates?.portcullisBlocks?.(s)?'portcullis':'door';
  }
  // The way in is open once the door is broken and no portcullis bars it.
  function gateBreached(g){return doorStage(g)==='broken'&&!window.ConquerGates?.portcullisBlocks?.(g)}
  function targetMaterial(s,part='core'){
    if(part==='portcullis'&&s.type==='gate')return'portcullis';
    if(part==='door'&&s.type==='gate')return'door';
    // Houses, markets and taverns are timber-framed; the church is masonry.
    return s.type==='palisade'||s.material==='wood'||['house','market','tavern'].includes(s.type)||isMill(s)?'wood':'stone';
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
    // HP-only damage is painted by the dynamic cracks overlay. It changes no
    // footprint, road, parcel or static castle geometry.
    markDirty(false,false,true);redraw();
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
    // The bay comes down: its masonry (and merlons) falls into the gap.
    const hw=(Number(s.width)||.5)/2,nx=-uy*hw,ny=ux*hw,g=groundOf(s);
    startCollapse(s,g,g+structureHeight(s)+.18,{cause:'breach',a:p0,b:p1,
      parts:[[{x:p0.x+nx,y:p0.y+ny},{x:p1.x+nx,y:p1.y+ny},{x:p1.x-nx,y:p1.y-ny},{x:p0.x-nx,y:p0.y-ny}]]});
    // What overhangs the bay on the outer face comes down with it: the timber gallery of a
    // hoarding as beams and planks, a machicolation's corbels and parapet as stone.
    const skin=s.type==='wall'&&typeof wallSkin==='function'?wallSkin(s):'standard';
    if(skin==='hoarding'||skin==='machicolation'){
      const side=typeof wallExteriorSide==='function'?wallExteriorSide(s):1,ex=-uy*side,ey=ux*side,H=structureHeight(s);
      const [o0,o1,z0,z1]=skin==='hoarding'?[hw-.02,hw+.42,H-.05,H+.66]:[hw-.035,hw+.145,H-.23,H+.4];
      const strip=[{x:p0.x+ex*o0,y:p0.y+ey*o0},{x:p1.x+ex*o0,y:p1.y+ey*o0},{x:p1.x+ex*o1,y:p1.y+ey*o1},{x:p0.x+ex*o1,y:p0.y+ey*o1}];
      startCollapse(s,g+z0,g+z1,{cause:'breach-'+skin,parts:[strip],
        ...(skin==='hoarding'?{material:'wood',palette:{side:['#7a5534','#5e4128','#8a6a42','#6b4a2e'],top:['#6b4a2e','#7a5534']}}:{})});
    }
    const idx=State.structures.findIndex(t=>t.id===s.id);
    if(idx>=0)State.structures.splice(idx,1,...pieces);
    // Towers keep their links: the a end now belongs to the left stretch, the b end to the right.
    for(const t of State.structures)if(Array.isArray(t.wallConnections))
      t.wallConnections=t.wallConnections.flatMap(c=>c.wallId!==s.id?[c]:c.end==='a'?(left?[{...c,wallId:left.id}]:[]):(right?[{...c,wallId:right.id}]:[]));
    if(State.selectedId===s.id)State.selectedId=pieces[0]?.id||null;
    if(typeof invalidateCastleColliderGeometry==='function')invalidateCastleColliderGeometry(...pieces);
    window.ConquerWallWalk?.invalidate();                 // the breach cuts the wall walk
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateSceneCache();markDirty(true,true,true);
    renderFunctionPanel();redraw();
    return pieces.map(p=>p.id);
  }
  // Ladders and assault towers need somewhere to rest: not on thin (T1) walls, and
  // hoardings keep them off. Ladders only reach the low (H1) wall top; a tower
  // reaches walls up to its own level. Machicolations do not stop an assault.
  function assaultCheck(wall,engine,level=1){
    // The ram is set against a gate's door (stone walls shrug it off).
    if(engine==='ram'){
      if(wall?.type!=='gate'||underConstruction(wall))return{ok:false,reason:'The ram is set against a gate'};
      if(doorStage(wall)==='broken')return{ok:false,reason:'This gate is already broken in'};
      return{ok:true};
    }
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
  // ---------- collapses ----------
  // A collapse keeps its spec in the ruins list: the falling blocks while it plays (this
  // session only, real time), then the heap they settle in, rebuilt from the spec on load.
  const started=new Map(),now=()=>performance.now()/1000;
  const C=()=>window.ConquerCollapse;
  function groundOf(s){
    if(typeof placementGroundZ==='function')return Number(placementGroundZ(s))||0;
    const c=s.x!==undefined?s:{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
    return typeof terrainElevation==='function'?terrainElevation(c):0;
  }
  function collapseParts(s){
    if(s.type==='house'&&typeof houseFootprintParts==='function')return houseFootprintParts(s).map(p=>p.points);
    if(typeof isCivic==='function'&&isCivic(s)&&typeof civicParts==='function')return civicParts(s).map(p=>p.points);
    const fp=typeof footprintPoints==='function'?footprintPoints(s):[];
    return fp.length>=3?[fp]:[];
  }
  const STONE={side:['#635951','#514a44','#7d736b','#9a8e82'],top:['#9a8e82','#8a7f74']};
  // Wood breaks into beams and planks, timber-framed buildings into plaster and beams
  // under a roof of boards, masonry into blocks.
  function collapseMaterial(s){
    if(s.type==='palisade'||s.material==='wood'||(s.type==='bridge'&&s.variant!=='stone')||(s.type==='tower'&&isWoodTower(s))||(s.type==='gate'&&typeof isWoodGate==='function'&&isWoodGate(s)))return'wood';
    if(s.type==='house'||s.type==='tavern'||s.type==='market')return'timber';
    return'stone';
  }
  function collapsePalette(s){
    const m=collapseMaterial(s);
    if(m==='wood')return{side:['#7a5534','#5e4128','#8a6a42','#6b4a2e'],top:['#6b4a2e','#7a5534']};
    if(m==='timber')return{side:['#c9b896','#a8946f','#b7a582'],top:['#7a4a38','#5b3d30','#6b4a2e'],beam:['#4e392d','#5e4128']};
    return STONE;
  }
  function startCollapse(s,z0,z1,opts={}){
    const x=state(),parts=opts.parts||collapseParts(s);
    if(!parts.length||!(z1>z0))return null;
    // Rubble left on this structure's stump by an earlier storey falls with it.
    for(const r of x.ruins)if(r.spec?.stump&&r.id.startsWith(s.id+':storey:')){r.spec.stump=false;C()?.forget(r.id);heapCache.delete(r.id);rubbleGrid=null}
    const pts=parts.flat(),cx=pts.reduce((t,p)=>t+p.x,0)/pts.length,cy=pts.reduce((t,p)=>t+p.y,0)/pts.length;
    const id=s.id+':'+(opts.cause||'collapse')+':'+x.ruins.length+':'+State.clock.day+':'+Math.round(z1*100);
    const spec={id,parts:parts.map(p=>p.map(q=>({x:+q.x.toFixed(3),y:+q.y.toFixed(3)}))),z0,z1,ground:opts.ground??groundOf(s),
      ...(opts.delay?{delay:opts.delay}:{}),seed:id,palette:opts.palette||collapsePalette(s),material:opts.material||collapseMaterial(s),lean:opts.lean||null,stump:opts.cause==='storey'||opts.cause==='ruin',hollow:s.type==='house'||(typeof isCivic==='function'&&isCivic(s))};
    const ruin={id,type:'collapse',cause:opts.cause||'destroyed',structure:s.type,x:cx,y:cy,day:State.clock.day,spec};
    if(opts.a)Object.assign(ruin,{a:opts.a,b:opts.b,width:Number(s.width)||.5,height:structureHeight(s)});
    x.ruins.push(ruin);
    if(x.ruins.length>200)for(const old of x.ruins.splice(0,x.ruins.length-200)){
      started.delete(old.id);heapCache.delete(old.id);rubbleCache.delete(old.id);C()?.forget(old.id);
    }
    rubbleGrid=null;
    started.set(id,now());animate();
    return ruin;
  }
  let raf=0;
  function animate(){
    if(typeof requestSceneDraw==='function'){requestSceneDraw();return}
    if(raf||typeof requestAnimationFrame!=='function')return;
    const step=()=>{raf=0;if(playing().length){draw();raf=requestAnimationFrame(step)}else started.clear()};
    raf=requestAnimationFrame(step);
  }
  function playing(){
    if(!C())return[];
    return state().ruins.filter(r=>{
      if(!r.spec||!started.has(r.id))return false;
      if(C().finished(r.spec,now()-started.get(r.id))){started.delete(r.id);return false}
      return true;
    });
  }
  const heapCache=new Map();
  function ruinMesh(r){
    if(r.spec&&C()){
      if(started.has(r.id)){const t=now()-started.get(r.id);if(t<C().duration(r.spec))return C().mesh(r.spec,t)}
      if(r.spec.transient)return null;      // only the fall is shown: the ruin model has its own rubble
      let m=heapCache.get(r.id);if(!m){m=C().mesh(r.spec,Infinity);m.static=true;heapCache.set(r.id,m)}
      return m;
    }
    return r.type==='breach'&&r.a&&r.b?rubbleMesh(r):null;   // breaches saved before collapses
  }
  // ---------- ruined stumps ----------
  // A stone tower or gatehouse never falls whole: its top half to two thirds comes down
  // and a ruined stump stays, still a solid obstacle holding the walls that lean on it
  // (same id, so their links hold), with no rooms or posts. A fallen gatehouse thus
  // closes its passage instead of opening a way through the walls.
  function ruinStructure(s,from){
    const g=groundOf(s),H=structureHeight(s);
    let seed=0;for(const ch of String(s.id))seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    const keep=H*(.34+.16*((seed%1000)/1000));             // a third to a half stays standing
    startCollapse(s,g+keep,g+H+.35,{cause:'ruin',lean:from?{x:s.x-from.x,y:s.y-from.y}:null});
    const stump={id:s.id,type:'ruin',ruinOf:s.type,shape:s.shape,size:s.size,r:s.r,w:s.w,h:s.h,x:s.x,y:s.y,
      angle:s.angle||0,rotationStep:s.rotationStep,material:s.material,ruinHeight:+keep.toFixed(3),
      wallConnections:s.wallConnections,ruinDay:State.clock.day};
    for(const k of Object.keys(s))delete s[k];
    for(const [k,v] of Object.entries(stump))if(v!==undefined)s[k]=v;   // same object: selection and links hold
    window.ConquerCombat?.invalidateArchers?.();window.ConquerWallWalk?.invalidate();
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateSceneCache();markDirty(true,true,true);renderFunctionPanel();redraw();
  }
  const stumpCache=new Map();
  function stumpMesh(s){
    const key=s.id+':'+s.ruinHeight;let m=stumpCache.get(key);if(m)return m;
    const pos=[],col=[],g=groundOf(s),H=Number(s.ruinHeight)||.8,base=footprintPoints(s);
    let seed=0;for(const ch of key)seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
    // Edges split every ~0.25 U so the broken top can be ragged.
    const ring=[];
    for(let i=0;i<base.length;i++){
      const a=base[i],b=base[(i+1)%base.length],n=Math.max(1,Math.round(Math.hypot(b.x-a.x,b.y-a.y)/.25));
      for(let k=0;k<n;k++)ring.push({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n});
    }
    const tops=ring.map((_,i)=>H*(rnd()<.18?.55+rnd()*.2:.82+rnd()*.18));
    const cx=ring.reduce((t,p)=>t+p.x,0)/ring.length,cy=ring.reduce((t,p)=>t+p.y,0)/ring.length;
    const tri=(a,b,c,colr)=>{pos.push(...a,...b,...c);col.push(colr)};
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,a=ring[i],b=ring[j],ha=g+tops[i],hb=g+tops[j];
      const sideCol=i%3===0?'#6f665d':'#7d736b';
      tri([a.x,a.y,g],[b.x,b.y,g],[b.x,b.y,hb],sideCol);tri([a.x,a.y,g],[b.x,b.y,hb],[a.x,a.y,ha],sideCol);
      // Broken top: rubble-filled, sloping in from the ragged rim (faces up).
      const c=[cx,cy,g+H*.72],p=[a.x,a.y,ha],q=[b.x,b.y,hb];
      const up=(q[0]-c[0])*(p[1]-c[1])-(q[1]-c[1])*(p[0]-c[0]);
      if(up>0)tri(c,q,p,'#8a7f74');else tri(c,p,q,'#8a7f74');
    }
    m={pos,col,static:true};stumpCache.set(key,m);return m;
  }
  // ---------- rubble on the ground ----------
  // Where the pieces settled, on a 0.25 U grid: the heap height there. A high core (over
  // ~1 m) cannot be crossed on foot; elsewhere rubble halves infantry speed; heavy engines
  // cannot cross any of it. A breach is the exception: its heap is a way in, never a wall.
  const RUBBLE_CELL=.25,RUBBLE_WALL=.3;
  let rubbleGrid=null;
  function rubbleIndex(){
    if(rubbleGrid)return rubbleGrid;
    rubbleGrid=new Map();
    if(!C())return rubbleGrid;
    for(const r of state().ruins){
      if(!r.spec||r.spec.transient)continue;
      // A breach's heap (and the gallery that fell with it) is a way in, never a wall.
      const g=r.spec.ground||0,breach=String(r.cause||'').startsWith('breach');
      for(const b of C().blocks(r.spec)){
        const q=C().pose(b,Infinity),h=q.z-g+Math.min(...b.s),L=b.s[0],ca=Math.cos(b.yaw),sa=Math.sin(b.yaw);
        if(h<=.01)continue;
        for(let d=-L/2;d<=L/2+1e-9;d+=RUBBLE_CELL*.8){
          const k=Math.floor((q.x+ca*d)/RUBBLE_CELL)+','+Math.floor((q.y+sa*d)/RUBBLE_CELL),cur=rubbleGrid.get(k);
          if(!cur||h>cur.h)rubbleGrid.set(k,{h,breach:breach&&(!cur||cur.breach)});
          else if(!breach&&cur.breach)cur.breach=false;
        }
      }
    }
    return rubbleGrid;
  }
  function rubbleAt(p){return rubbleIndex().get(Math.floor(p.x/RUBBLE_CELL)+','+Math.floor(p.y/RUBBLE_CELL))||null}
  // Burning rubble blocks everyone while it burns, even in a breach (ConquerFire).
  function rubbleBlocks(p){if(window.ConquerFire?.blocks(p))return true;const r=rubbleAt(p);return !!r&&r.h>=RUBBLE_WALL&&!r.breach}
  function rubbleFactor(p,heavy=false){const r=rubbleAt(p);return !r?1:heavy?0:.5}
  // Extra meshes for the 3D world renderer: falling blocks, rubble heaps, ruined stumps.
  // Broken crown on a tower or gatehouse that lost its top storey: ragged masonry around
  // the rim, rubble filling the top (towerRoofStyle/gateRoofStyle report 'broken').
  const crownCache=new Map();
  function crownMesh(s){
    const g=groundOf(s),H=structureHeight(s),key=s.id+':'+H.toFixed(3)+':'+g.toFixed(3);
    let m=crownCache.get(key);if(m)return m;
    const pos=[],col=[],base=footprintPoints(s);
    let seed=0;for(const ch of key)seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
    const ring=[];
    for(let i=0;i<base.length;i++){
      const a=base[i],b=base[(i+1)%base.length],n=Math.max(1,Math.round(Math.hypot(b.x-a.x,b.y-a.y)/.2));
      for(let k=0;k<n;k++)ring.push({x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n});
    }
    // Stubs of the fallen storey: mostly low, a few teeth standing higher.
    const tops=ring.map(()=>rnd()<.22?.32+rnd()*.38:.04+rnd()*.16);
    const cx=ring.reduce((t,p)=>t+p.x,0)/ring.length,cy=ring.reduce((t,p)=>t+p.y,0)/ring.length;
    const tri=(a,b,c,colr)=>{pos.push(...a,...b,...c);col.push(colr)};
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,a=ring[i],b=ring[j],z0=g+H-.02,ha=g+H+tops[i],hb=g+H+tops[j];
      const sideCol=i%3===0?'#6f665d':'#7d736b';
      tri([a.x,a.y,z0],[b.x,b.y,z0],[b.x,b.y,hb],sideCol);tri([a.x,a.y,z0],[b.x,b.y,hb],[a.x,a.y,ha],sideCol);
      const c=[cx,cy,g+H+.1],p=[a.x,a.y,ha],q=[b.x,b.y,hb];
      const up=(q[0]-c[0])*(p[1]-c[1])-(q[1]-c[1])*(p[0]-c[0]);
      if(up>0)tri(c,q,p,'#8a7f74');else tri(c,p,q,'#8a7f74');
    }
    m={pos,col,static:true};crownCache.set(key,m);return m;
  }
  function dynamicMeshes(){
    const out=state().ruins.map(ruinMesh).filter(Boolean);
    for(const s of State.structures)if(s.type==='ruin')out.push(['windmill','watermill'].includes(s.ruinOf)&&window.ConquerIndustries3D?.has(s)
      ?window.ConquerIndustries3D.triangles(s,Number(s.groundZ)||groundOf(s)):stumpMesh(s));
    if(window.ConquerWorld3D?.active?.())for(const s of State.structures){
      const m=s.type==='gate'?window.ConquerCrossings?.drawbridgeMesh?.(s):s.type==='bridge'?window.ConquerCrossings?.bridgeMesh?.(s):null;
      if(m)out.push(m);
    }
    if(window.ConquerWorld3D?.active?.())out.push(...(window.ConquerEarthworks?.meshes?.()||[]));
    for(const s of State.structures)if(s.brokenTop&&['tower','gate'].includes(s.type)&&!underConstruction(s))out.push(crownMesh(s));
    return out;
  }
  // ---------- gates: leaves that close, a door that can be battered in ----------
  // A gate stands open unless it is closed from its panel (gate.closed). Closed and
  // whole it blocks the passage for everyone; the ram (or heavy shot) wears the door
  // down: 'damaged' below 2/3, 'broken' at zero, and the passage then stays open for
  // good. A raised drawbridge is the first shield: it takes the blows and goes with it.
  function doorStage(g){
    if(!g||g.type!=='gate')return null;
    const d=g.siegeIntegrity?.door;
    if(!d||d.hp>d.max*2/3)return'intact';
    return d.hp<=0?'broken':'damaged';
  }
  function gateClosed(g){return !!g&&g.type==='gate'&&!!g.closed&&!underConstruction(g)&&doorStage(g)!=='broken'}
  function setGateClosed(id,closed){
    const g=State.structures.find(s=>s.id===id&&s.type==='gate');
    if(!g||underConstruction(g))return false;
    if(closed&&doorStage(g)==='broken'){status('The door is broken in: the gate cannot be closed');return false}
    g.closed=!!closed;
    // A hand on the gate overrides the night watch until the next morning.
    if(isNight()){g.nightOverride=true;delete g.nightClosed}
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    markDirty(true,true,true);renderFunctionPanel();redraw();
    status(g.closed?'Gate closed: nobody passes':'Gate open');
    return true;
  }
  // Night watch: a gate set to close at night (the default) shuts at dusk and opens at
  // dawn, unless someone opened or closed it by hand that night; a gate closed by hand
  // in the day stays closed. Closed, its two guards go inside.
  function isNight(){try{return typeof nightFactor==='function'&&nightFactor()>.5}catch{return false}}
  let wasNight=null;
  function gateNightWatch(){
    const night=isNight();if(night===wasNight)return;wasNight=night;
    let changed=false;
    for(const g of State.structures){
      if(g.type!=='gate'||underConstruction(g))continue;
      if(!night){
        if(g.nightClosed&&!g.nightOverride){g.closed=false;changed=true}
        delete g.nightClosed;delete g.nightOverride;continue;
      }
      if(g.nightClose===false||g.nightOverride||g.closed||doorStage(g)==='broken')continue;
      g.closed=true;g.nightClosed=true;changed=true;
    }
    if(changed){
      if(typeof invalidateNavigation==='function')invalidateNavigation(true);
      markDirty(true,true,true);renderFunctionPanel();redraw();
      status(night?'Night: the gates are shut':'Morning: the gates open');
    }
  }
  // Red alarm: the defenders pull their wooden half-bridges down into the moat.
  function bridgeAlarm(){
    if(window.ConquerCombat?.alarmMode?.()!=='hall')return;
    for(const b of State.structures.filter(s=>s.type==='bridge'&&s.halfBridgeFor&&s.variant!=='stone'&&s.autoDemolish!==false&&!underConstruction(s)))
      window.ConquerCrossings?.demolishBridge(b);
  }
  // A wooden bridge pulled down: its planks and beams fall into the moat.
  function collapseBridge(b){
    // A cascade: the deck gives way span by span from one end, each piece falling from
    // deck height to whatever lies under it (a moat bed, a valley floor), and the trestles
    // or piers beneath fold up just after the span they carried.
    const deck=Number(b.groundZ)||groundOf(b),L=Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y)||1;
    const ux=(b.b.x-b.a.x)/L,uy=(b.b.y-b.a.y)/L,w=(Number(b.width)||1)/2,n=Math.max(1,Math.round(L/1.5));
    const at=(t,c)=>({x:b.a.x+ux*t*L-uy*c,y:b.a.y+uy*t*L+ux*c});
    const under=p=>typeof terrainElevation==='function'?terrainElevation(p):0;
    let first=null;
    for(let i=0;i<n;i++){
      const t0=i/n,t1=(i+1)/n,mid=at((t0+t1)/2,0),g=Math.min(deck,under(mid)),delay=i*.22;
      const lean={x:-uy*(Math.sin(i*2.3)*.6)+ux*.2,y:ux*(Math.sin(i*2.3)*.6)+uy*.2};
      const r=startCollapse(b,deck-.15,deck+.22,{cause:'demolished',parts:[[at(t0,-w),at(t1,-w),at(t1,w),at(t0,w)]],ground:g,delay,lean});
      first=first||r;
      if(deck-g>.5)startCollapse(b,g,deck-.15,{cause:'demolished',parts:[[at(t0,-w*.8),at(t1,-w*.8),at(t1,w*.8),at(t0,w*.8)]],ground:g,delay:delay+.35,lean});
    }
    return first;
  }
  function breakDoor(g){
    delete g.drawbridge;                       // a raised drawbridge is smashed with the door
    g.closed=false;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateStructureScene(g);invalidateSceneCache();markDirty(true,true,true);renderFunctionPanel();redraw();
    status('The gate is broken in');
  }
  // 2.5D portals follow the door's state. architecture's drawGatePortals is wrapped once
  // every script has run (its module is kept byte-identical by the refactor invariant).
  const DOOR_ASSETS={gatePortalDamaged:'./src/assets/architecture/gate_portal_damaged.png',
    gatePortalBroken:'./src/assets/architecture/gate_portal_broken.png'};
  function doorAsset(g){const st=doorStage(g);return st==='broken'?'gatePortalBroken':st==='damaged'?'gatePortalDamaged':'gatePortal'}
  function loadDoorAssets(){
    if(typeof Image!=='function'||typeof architectureSprites==='undefined')return;
    for(const [key,path] of Object.entries(DOOR_ASSETS)){
      const img=new Image();
      img.onload=()=>{
        try{architectureSprites[key]=typeof prepareArchitectureSprite==='function'?prepareArchitectureSprite(img):img}catch{architectureSprites[key]=img}
        invalidateSceneCache();redraw();
      };
      img.src=path;
    }
  }
  window.addEventListener?.('DOMContentLoaded',()=>{
    loadDoorAssets();
    if(typeof drawGatePortals!=='function')return;
    drawGatePortals=function(){
      for(const s of State.structures){
        if(s.type!=='gate'||isWoodGate(s)||underConstruction(s))continue;
        const key=doorAsset(s);
        withStructureGroundPlane(s,()=>withStructureDetailOcclusion(s,1.38,()=>{
          for(const edge of gateFacadeEdges(s)){
            if(edge.role!=='front'&&edge.role!=='rear')continue;
            if(key==='gatePortal'||!drawArchitectureAssetOnEdge(edge,.705,.90,1.35,key))drawGatePortalOnEdge(edge);
          }
        }));
      }
    };
  });
  function attackStructure(id,weapon,force=1,part='core'){
    const s=State.structures.find(x=>x.id===id);
    if(!s||underConstruction(s)||!BASE_HEALTH[s.type])return{ok:false,reason:'Invalid or unfinished fortification'};
    // Walls and palisades: part may name a bay (index) or the point of impact {x,y}.
    if(isLinear(s))return attackWall(s,weapon,force,part==='core'?null:part);
    const stats=integrity(s),section=gateSection(s,part,weapon),hp=stats[section];
    const factor=effectiveness(weapon,s,section);
    if(!factor)return{ok:false,damage:0,reason:'Weapon cannot damage this material'};
    if(!hp||hp.hp<=0)return{ok:false,damage:0,reason:'Section already destroyed'};
    const damage=Math.min(hp.hp,Math.max(0,Number(force)||0)*factor);
    if(!damage)return{ok:false,damage:0,reason:'No force applied'};
    const stageBefore=doorStage(s);
    hp.hp=Math.max(0,hp.hp-damage);
    const from=part&&Number.isFinite(part.x)?part:null;
    if(section==='portcullis'){
      if(hp.hp===0)window.ConquerGates?.wreckPortcullis?.(s);
      else{markDirty(false,false,true);redraw()}
    }
    else if(section==='door'&&hp.hp===0)breakDoor(s);
    else if(section==='door'&&doorStage(s)!==stageBefore){invalidateStructureScene(s);markDirty(false,false,true);redraw()}
    else if(section==='core'&&hp.hp===0)destroyStructure(s,from);
    else if(section==='core'&&storeyCollapse(s,from)){}
    else{
      markDirty(false,false,true);redraw();
    }
    return{ok:true,part:section,damage,remaining:hp.hp,max:hp.max,destroyed:hp.hp===0};
  }
  // Towers and gatehouses fail a storey at a time: at 2/3 and 1/3 of their health the
  // top storey comes down (the structure loses a level, its rooms and slots up there),
  // what is left is a sound lower tower with the health it still had.
  function storeyCollapse(s,from){
    if(!['tower','gate'].includes(s.type))return false;
    const hp=s.siegeIntegrity.core;let fell=false;
    for(let L=structureLevel(s);L>1&&hp.hp/hp.max<=(L-1)/L+1e-9;L=structureLevel(s)){
      const f=hp.hp/hp.max,g=groundOf(s),oldH=structureHeight(s);
      s.level=L-1;s.brokenTop=true;                 // the crown is gone: no roof, merlons or deck
      const newH=structureHeight(s),max=healthMaximum(s);
      hp.max=max;hp.hp=Math.min(max,max*f*L/(L-1));
      if(typeof normalizeFunctions==='function')normalizeFunctions(s);
      startCollapse(s,g+newH,g+oldH+.35,{cause:'storey',lean:from?{x:s.x-from.x,y:s.y-from.y}:null});
      fell=true;
    }
    if(!fell)return false;
    window.ConquerCombat?.invalidateArchers?.();
    window.ConquerWallWalk?.invalidate();
    invalidateStructureScene(s);invalidateSceneCache();markDirty(true,true,true);renderFunctionPanel();redraw();
    return true;
  }
  // A fallen mill stays where it stood as its own ruin model (ConquerIndustries3D):
  // the cap and sails, or the upper floor and roof, come down in a timber collapse.
  function ruinMill(s,from){
    // Heights in U (1 U = 3.5 m): the stump keeps ~2.5 m of tower or ~1.8 m of walls.
    const g=Number(s.groundZ)||groundOf(s),wind=s.type==='windmill';
    const fall=startCollapse(s,g+(wind?.7:.5),g+(wind?2.35:1.75),{cause:'ruin',palette:collapsePalette({type:'house'}),material:'timber',
      lean:from?{x:s.x-from.x,y:s.y-from.y}:null});
    if(fall){fall.spec.transient=true;fall.spec.stump=false}
    const stump={id:s.id,type:'ruin',ruinOf:s.type,w:s.w,h:s.h,x:s.x,y:s.y,angle:s.angle||0,rotationStep:s.rotationStep,
      groundZ:s.groundZ,ruinHeight:wind?.8:.55,ruinDay:State.clock.day};
    for(const k of Object.keys(s))delete s[k];
    for(const [k,v] of Object.entries(stump))if(v!==undefined)s[k]=v;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateSceneCache();markDirty(true,true,true);renderFunctionPanel();redraw();
  }
  function destroyStructure(s,from=null){
    if(isMill(s))return ruinMill(s,from);
    // Stone towers and gatehouses are left as ruined stumps (they keep closing the walls).
    if(['tower','gate'].includes(s.type)&&!(s.type==='tower'&&isWoodTower(s))&&!(typeof isWoodGate==='function'&&isWoodGate(s)))return ruinStructure(s,from);
    // Everything standing comes down; walls that leant on it stay as open ends.
    const g=groundOf(s),H=structureHeight(s)+(['tower','gate'].includes(s.type)?.35:0);
    if(!isLinear(s)&&H>.2)startCollapse(s,g,g+H,{lean:from?{x:(s.x??0)-from.x,y:(s.y??0)-from.y}:null});
    else{const x=state();x.ruins.push({id:s.id,type:s.type,x:s.x??(s.a.x+s.b.x)/2,y:s.y??(s.a.y+s.b.y)/2,day:State.clock.day})}
    for(const w of State.structures){
      if(w.aSnap===s.id)w.aSnap=null;
      if(w.bSnap===s.id)w.bSnap=null;
    }
    // Houses live in the urban geometry cache: drop it or the fallen house stays drawn.
    if(s.type==='house'&&typeof invalidateUrbanGeometry==='function')invalidateUrbanGeometry();
    if(s.type==='tower'&&typeof detachSubtowerChildren==='function')detachSubtowerChildren(s.id);
    State.structures=State.structures.filter(x=>x.id!==s.id);
    window.ConquerWallWalk?.invalidate();
    if(State.selectedId===s.id)State.selectedId=null;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    invalidateSceneCache();
    markDirty(true,true,true);
    renderFunctionPanel();redraw();
  }
  function crack(origin,z,k){
    const p=w2s(origin,z),s=.6+k;
    ctx.strokeStyle='rgba(45,24,18,.9)';ctx.lineWidth=Math.max(1,State.view.scale*2);
    ctx.beginPath();ctx.moveTo(p.x-5*s,p.y-5*s);ctx.lineTo(p.x+2*s,p.y+s);
    ctx.lineTo(p.x-2*s,p.y+7*s);ctx.lineTo(p.x+6*s,p.y+12*s);ctx.stroke();
  }
  // 2.5D: painter-sorted flat-shaded triangles. Cache the entire settled layer so
  // overlapping heaps retain the same painter order as the moving geometry.
  let rubbleBitmap=null,rubbleBitmapRevision=0;
  function drawRubble2D(meshes){
    const api=window.__conquerAssetCompiler;
    if(!meshes.length){rubbleBitmap=null;return}
    if(!api?.renderComposite||meshes.some(m=>!m.static)){drawMeshes2D(meshes);return}
    const projection=[State.view.scale,State.view.rotation||0,isPlanView(),staticCacheDpr()].join('|');
    if(!rubbleBitmap||rubbleBitmap.projection!==projection||meshes.length!==rubbleBitmap.meshes.length||meshes.some((m,i)=>m!==rubbleBitmap.meshes[i])){
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const m of meshes)for(let i=0;i<m.pos.length;i+=3){const p=w2sRaw({x:m.pos[i],y:m.pos[i+1]},m.pos[i+2]);minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
      rubbleBitmap={meshes:meshes.slice(),projection,key:'rubble|'+(++rubbleBitmapRevision),x:State.view.x,y:State.view.y,bounds:{minX:minX-2,minY:minY-2,maxX:maxX+2,maxY:maxY+2}};
    }
    const r=rubbleBitmap,dx=State.view.x-r.x,dy=State.view.y-r.y,b=r.bounds;
    const result=api.renderComposite('rubble',r.key,{minX:b.minX+dx,minY:b.minY+dy,maxX:b.maxX+dx,maxY:b.maxY+dy},()=>drawMeshes2D(meshes));
    if(!result.ok)drawMeshes2D(meshes);
  }
  function drawMeshes2D(meshes){
    const items=[],batch=meshes.every(m=>m.static);
    for(const m of meshes){
      const p=m.pos;
      for(let t=0;t<m.col.length;t++){
        const i=t*9,ux=p[i+3]-p[i],uy=p[i+4]-p[i+1],uz=p[i+5]-p[i+2],vx=p[i+6]-p[i],vy=p[i+7]-p[i+1],vz=p[i+8]-p[i+2];
        const nz=ux*vy-uy*vx,len=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,nz)||1;
        const c={x:(p[i]+p[i+3]+p[i+6])/3,y:(p[i+1]+p[i+4]+p[i+7])/3},q=rotateViewPoint(c);
        items.push({m,i,d:q.x+q.y+ISO_Z*(p[i+2]+p[i+5]+p[i+8])/3,f:nz/len>.5?1:nz/len<-.5?.5:.76,col:m.col[t]});
      }
    }
    items.sort((a,b)=>a.d-b.d);
    let color=null;
    const flush=()=>{if(color!==null){ctx.fill();ctx.stroke()}};
    ctx.lineWidth=.6;
    for(const it of items){
      const p=it.m.pos,i=it.i,a=w2sRaw({x:p[i],y:p[i+1]},p[i+2]);let b=w2sRaw({x:p[i+3],y:p[i+4]},p[i+5]),c=w2sRaw({x:p[i+6],y:p[i+7]},p[i+8]);
      const h=it.col.replace('#',''),r=parseInt(h.slice(0,2),16)*it.f|0,g=parseInt(h.slice(2,4),16)*it.f|0,bl=parseInt(h.slice(4,6),16)*it.f|0;
      const next='rgb('+r+','+g+','+bl+')';
      if(!batch){ctx.fillStyle=ctx.strokeStyle=next;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.fill();ctx.stroke();continue}
      // Same-colour static triangles can share one fill/stroke, in painter
      // order. Uniform winding prevents overlapping subpaths cancelling out.
      if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)[b,c]=[c,b];
      if(next!==color){flush();color=next;ctx.fillStyle=ctx.strokeStyle=color;ctx.beginPath()}
      ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();
    }
    flush();
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
    // Collapses: dust over the falling blocks (both renderers); in 2.5D the blocks and heaps too.
    if(C()){
      for(const r of playing()){
        for(const d of C().dust(r.spec,now()-started.get(r.id))){
          const p=w2sRaw(d,d.z),q=w2sRaw({x:d.x+d.r,y:d.y},d.z),rad=Math.max(2,Math.hypot(q.x-p.x,q.y-p.y));
          ctx.fillStyle='rgba(190,176,152,'+d.a.toFixed(3)+')';ctx.beginPath();ctx.ellipse(p.x,p.y,rad,rad*.72,0,0,Math.PI*2);ctx.fill();
        }
      }
      if(!world3d)drawRubble2D([...dynamicMeshes(),...(window.ConquerIndustries3D?.dynamicMeshes?.()||[])]);
    }
    for(const r of state().ruins){
      if(r.spec)continue;
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
    window.ConquerFire?.draw();                         // flames, smoke, burning shots
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
    slots.querySelectorAll('[data-gate-night]').forEach(btn=>btn.onclick=()=>{
      const s=selectedStructure();if(s?.type!=='gate')return;
      s.nightClose=btn.dataset.gateNight==='1';markDirty(false,false,true);renderFunctionPanel();
    });
    slots.querySelectorAll('[data-gate-closed]').forEach(btn=>btn.onclick=()=>{
      const s=selectedStructure();if(s?.type==='gate')setGateClosed(s.id,btn.dataset.gateClosed==='1');
    });
    slots.querySelectorAll('[data-siege-test]').forEach(btn=>btn.onclick=()=>{
      const s=selectedStructure();if(!s)return;
      const part=s.type==='gate'&&btn.dataset.siegeTest!=='trebuchet'?'door':'core';
      const out=attackStructure(s.id,btn.dataset.siegeTest,10,part);
      status(out.ok?(out.destroyed?(out.part==='portcullis'?'Portcullis wrecked · ':'Defence breached · '):(out.part==='portcullis'?'Portcullis hit · ':'Damage dealt · '))+out.damage.toFixed(1):out.reason);
      renderFunctionPanel();
    });
  }
  window.ConquerSiege={restore,state,initial,assignMastio,normalizeMastio,syncAutoMastio,ensureMastioHall,mastio,armories,allowed,sanitizeRooms,
    capacity,used,transfer,civilians,dailyFoodDemand,tick,integrity,effectiveness,attackStructure,
    drawOverlay,summaryHtml,bindPanel,WEAPONS,healthMaximum,
    bays,bayIndexAt,assaultCheck,dynamicMeshes,BAY_TARGET,doorStage,gateClosed,gateBreached,PORTCULLIS_HEALTH,setGateClosed,doorAsset,collapseBridge,isNight,gateNightWatch,startCollapse,rubbleAt,rubbleBlocks,rubbleFactor,collapsing:()=>playing().map(r=>r.id),needsAnimation:()=>playing().length>0,
    archerSlots,stationedArchers,occupiedArcherSlots,changeArchers};
})();
