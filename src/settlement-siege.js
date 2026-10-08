'use strict';
// CONQUER /assedio P0: siege domain (no rendering-driven combat rules).
(function(){
  const CAPACITY=Object.freeze({granary:{food:240},storage:{materials:240},armory:{equipment:80},
    stables:{horses:12},treasury:{gold:1200},kitchen:{meals:80},barracks:{soldiers:16},
    nobleRoom:{knights:2},quarters:{soldiers:8}});
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
  function sanitizeRooms(s){
    if(!s||!['tower','gate','built'].includes(s.type))return false;
    normalizeFunctions(s);let changed=false;
    s.functions.forEach((fn,i)=>{if(fn&&!allowed(s,i,fn)){s.functions[i]=null;changed=true}});
    return changed;
  }
  function normalizeMastio(){
    let chosen=false;
    for(const s of State.structures){
      if(!s.isMastio)continue;
      if(s.type==='tower'&&!s.destroyed&&!chosen){chosen=true;continue}
      s.isMastio=false;
    }
  }
  function assignMastio(id){
    const selected=State.structures.find(s=>s.id===id&&s.type==='tower'&&!s.destroyed&&!underConstruction(s));
    if(!selected)return false;
    const already=!!selected.isMastio;
    for(const s of State.structures)if(s.type==='tower')s.isMastio=false;
    if(!already)selected.isMastio=true;
    markDirty(false,['base','castleBody','castleFront']);
    renderFunctionPanel();draw();
    status(already?'Mastio designation removed':'Mastio designated — final defensive position');
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
      :towerRoofStyle(tower)==='battlement';
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
    for(let floor=top;floor>=1;floor--){
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
  function attackStructure(id,weapon,force=1,part='core'){
    const s=State.structures.find(x=>x.id===id);
    if(!s||underConstruction(s)||!BASE_HEALTH[s.type])return{ok:false,reason:'Invalid or unfinished fortification'};
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
  function drawOverlay(){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    for(const s of State.structures){
      if(s.type==='tower'&&s.isMastio&&!underConstruction(s)){
        const p=w2s(s,structureHeight(s)+.55),sz=Math.max(13,18*State.view.scale);
        ctx.font='bold '+sz+'px sans-serif';ctx.lineWidth=3.5;ctx.strokeStyle='#473011';
        ctx.strokeText('★',p.x,p.y);ctx.fillStyle='#ffdb63';ctx.fillText('★',p.x,p.y);
      }
      const hp=s.siegeIntegrity?.core;
      if(!hp||hp.hp>=hp.max||hp.hp<=0)continue;
      const origin=s.x!==undefined?s:{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
      const p=w2s(origin,structureHeight(s)*.55);
      ctx.strokeStyle='rgba(45,24,18,.9)';ctx.lineWidth=Math.max(1,State.view.scale*2);
      ctx.beginPath();ctx.moveTo(p.x-5,p.y-5);ctx.lineTo(p.x+2,p.y+1);
      ctx.lineTo(p.x-2,p.y+7);ctx.lineTo(p.x+6,p.y+12);ctx.stroke();
    }
    for(const r of state().ruins){
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
    slots.querySelectorAll('[data-siege-test]').forEach(btn=>btn.onclick=()=>{
      const s=selectedStructure();if(!s)return;
      const part=s.type==='gate'&&btn.dataset.siegeTest!=='trebuchet'?'door':'core';
      const out=attackStructure(s.id,btn.dataset.siegeTest,10,part);
      status(out.ok?(out.destroyed?'Defence breached · ':'Damage dealt · ')+out.damage.toFixed(1):out.reason);
      renderFunctionPanel();
    });
  }
  window.ConquerSiege={restore,state,initial,assignMastio,normalizeMastio,allowed,sanitizeRooms,
    capacity,used,transfer,civilians,dailyFoodDemand,tick,integrity,effectiveness,attackStructure,
    drawOverlay,summaryHtml,bindPanel,WEAPONS,healthMaximum,
    archerSlots,stationedArchers,occupiedArcherSlots,changeArchers};
})();
