'use strict';
// Livestock for L1 Voronoi households. All animals are derived from the saved
// settlement seed, house ID and polygon area: no duplicate persisted entities.
(function(){
  const DEPART=.085,PASTURE_AT=.215,RETURN=.515,HOME_AT=.655;
  const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
  const planCache=new Map(),routeCache=new Map();
  let cacheSignature='';
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
  const hash=s=>peasantHash(String(s))>>>0;
  const rand=h=>{h=(Math.imul(h^h>>>16,0x7feb352d)>>>0);h=(Math.imul(h^h>>>15,0x846ca68b)>>>0);return ((h^h>>>16)>>>0)/4294967296};
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  function kindForHouse(house){
    if(!house||houseLevel(house)!==1)return null;
    const value=hash(State.seed+'|livestock-l1|'+house.id)/4294967296;
    return value<.5?'garden':value<.8?'goat':'shepherd';
  }
  function lotForHouse(house){
    return house&&urbanLots().find(lot=>lot.houseId===house.id)||null;
  }
  function healthyPlanCache(){
    const strokes=State.combat?.strokes||[],last=strokes.at(-1);
    const signature=State.seed+'|'+urbanRevision+'|'+(State.village.wellId||'')+
      '|'+(window.ConquerCombat?.areaState?1:0)+'|'+strokes.length+'|'+
      (last?last.x+','+last.y+','+last.r+','+last.mode:'');
    if(cacheSignature!==signature){
      cacheSignature=signature;planCache.clear();routeCache.clear();
    }
  }
  function isFreePenPoint(p,lot,house,accepted,clearance){
    return urbanContains(lot.points,p,.14)&&
      !houseFootprintParts(house).some(part=>urbanContains(part.points,p,-.18))&&
      accepted.every(q=>dist(p,q)>clearance);
  }
  function penPoints(lot,house,count){
    const poly=lot.points;
    const minX=Math.min(...poly.map(p=>p.x)),maxX=Math.max(...poly.map(p=>p.x));
    const minY=Math.min(...poly.map(p=>p.y)),maxY=Math.max(...poly.map(p=>p.y));
    const positions=[],seed=hash(State.seed+'|pen|'+house.id);
    // Bounded, deterministic rejection sampling; never spawn inside the house.
    for(let i=0;i<count;i++){
      let found=null;
      for(let step=0;step<120;step++){
        const k=i*127+step+1;
        const p={x:minX+(maxX-minX)*rand(seed^Math.imul(k,0x9e3779b1)),
          y:minY+(maxY-minY)*rand(seed^Math.imul(k,0x85ebca6b))};
        if(isFreePenPoint(p,lot,house,positions,step<40?.29:step<80?.17:.02)){
          found=p;break;
        }
      }
      // Very small plots might not fit the requested spacing; still count
      // every animal, but only at a valid walkable pen location.
      if(!found){
        found=positions[i%Math.max(1,positions.length)]||null;
        if(!found){
          const p=houseDoorInfo(house).outside;
          found=urbanContains(poly,p)?p:poly[0];
        }
      }
      positions.push(found);
    }
    return positions;
  }
  function plan(house,lot){
    healthyPlanCache();
    const cached=planCache.get(house.id);
    const kind=kindForHouse(house),area=Math.abs(urbanArea(lot.points));
    if(cached&&cached.area===area&&cached.kind===kind)return cached;
    const count=kind==='goat'?Math.round(area/2):kind==='shepherd'?Math.round(area):0;
    const result={house,lot,kind,area,count,pen:count?penPoints(lot,house,count):[]};
    planCache.set(house.id,result);
    return result;
  }
  function whiteZoneAt(p){
    const z=window.ConquerCombat?.areaState?.(p);
    return !!z?.allowed&&!z.yellow&&!z.green&&
      p.x>1&&p.y>1&&p.x<WORLD-1&&p.y<WORLD-1;
  }
  function whiteAt(p){
    return whiteZoneAt(p)&&!pointBlockedForPeasant(p,null);
  }
  function whitePatch(p,r){
    if(!whiteAt(p))return false;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      if(!whiteAt({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r}))return false;
    }
    return true;
  }
  function travelRoute(house,goal){
    const start=houseDoorInfo(house).outside;
    const allowed=p=>!!window.ConquerCombat?.areaState?.(p)?.allowed;
    const routeValid=route=>{
      if(!route?.length||dist(route.at(-1),goal)>.7)return false;
      for(let i=0;i<route.length;i++){
        if(!allowed(route[i]))return false;
        if(!i)continue;
        const a=route[i-1],b=route[i],steps=Math.ceil(dist(a,b)/.5);
        for(let j=1;j<steps;j++)if(!allowed(lerp(a,b,j/steps)))return false;
      }
      return true;
    };
    let path=villagerPathBetween(house,start,goal,'shepherd');
    if(routeValid(path))return path;
    if(dist(start,goal)<=32){
      path=findPeasantPath(start,goal,house.id,6,allowed);
      if(routeValid(path))return path;
    }
    return null;
  }
  function pastureFor(plan){
    healthyPlanCache();
    if(routeCache.has(plan.house.id))return routeCache.get(plan.house.id);
    const {house,count}=plan,home=houseDoorInfo(house).outside,seed=hash(house.id+'|pasture');
    const radius=Math.max(1.0,Math.sqrt(count/Math.PI)*.75);
    let selected=null;
    // Seek a contiguous patch of WHITE territory outside the urban yellow zone.
    // The starting angle is seeded, so adjacent households spread naturally.
    for(const factor of [1,.75,.5]){
      if(selected)break;
      const reach=radius*factor;
      for(let ring=5;ring<=42&&!selected;ring+=2.5){
        for(let a=0;a<20&&!selected;a++){
          const angle=2*Math.PI*(a/20+rand(seed)*.997);
          const candidate={x:home.x+ring*Math.cos(angle),y:home.y+ring*Math.sin(angle)};
          if(!whitePatch(candidate,reach))continue;
          const route=travelRoute(house,candidate);
          if(route)selected={center:candidate,path:route,radius:reach};
        }
      }
    }
    routeCache.set(house.id,selected);
    return selected;
  }
  function period(frac){
    return frac<DEPART?'home':frac<PASTURE_AT?'out':
      frac<RETURN?'graze':frac<HOME_AT?'back':'home';
  }
  function dayFraction(){
    // The scene light and the pastoral routine share the *visual* day.
    return visualCycleFrac();
  }
  function pasturePoint(plan,pasture,i,t){
    const h=hash(plan.house.id+'|sheep|'+i);
    const r=Math.sqrt((i+.45)/Math.max(1,plan.count))*pasture.radius*.91;
    const a=i*GOLDEN_ANGLE+rand(h)*.5+
      Math.sin(t*.6+rand(h^4234)*Math.PI*2)*.16;
    const p={x:pasture.center.x+Math.cos(a)*r,y:pasture.center.y+Math.sin(a)*r};
    // The patch was checked against obstacles when selected. Per-frame
    // grazing only needs the inexpensive zone mask test.
    return whiteZoneAt(p)?p:pasture.center;
  }
  function shepherdPosition(house){
    if(kindForHouse(house)!=='shepherd'||underConstruction(house))return null;
    const lot=lotForHouse(house);if(!lot)return null;
    const pasture=pastureFor(plan(house,lot));if(!pasture)return null;
    const frac=dayFraction(),phase=period(frac);
    if(phase==='home')return null;
    if(phase==='out')return pointAlongPath(pasture.path,smooth((frac-DEPART)/(PASTURE_AT-DEPART)));
    if(phase==='back')return pointAlongPath(pasture.path,1-smooth((frac-RETURN)/(HOME_AT-RETURN)));
    return residentIdlePoint(pasture.center,house.id+'-shepherd',visualCycleDay(),.18);
  }
  // Every animal alternates planted browsing with brief, bounded walking.
  // The behavior is deterministic per house/animal and needs no persisted state.
  function localGrazeTarget(anchor,seed,radius,accept){
    for(let step=0;step<10;step++){
      const angle=2*Math.PI*(rand(seed^Math.imul(step+1,0x9e3779b1))+step/10);
      const reach=radius*(.45+.4*rand(seed^Math.imul(step+1,0x85ebca6b)));
      const candidate={x:anchor.x+Math.cos(angle)*reach,y:anchor.y+Math.sin(angle)*reach};
      if(accept(candidate))return candidate;
    }
    return anchor;
  }
  function grazeLoop(anchor,target,time,seed){
    const cycle=5.5+rand(seed^0x68bc21eb)*2.5;
    const phase=((time+rand(seed^0x9e3779b9)*cycle)/cycle)%1;
    const towards={x:target.x-anchor.x,y:target.y-anchor.y};
    const back={x:-towards.x,y:-towards.y};
    if(phase<.52)return {p:anchor,mode:'browse',heading:back};
    if(phase<.66)return {p:lerp(anchor,target,smooth((phase-.52)/.14)),mode:'walk',heading:towards};
    if(phase<.88)return {p:target,mode:'browse',heading:towards};
    return {p:lerp(target,anchor,smooth((phase-.88)/.12)),mode:'walk',heading:back};
  }
  function grazingBehavior(plan,pasture,lot,house,i){
    const time=visualCycleDay()*34;
    const seed=hash(house.id+'|graze-loop|'+i);
    if(plan.kind==='shepherd'&&pasture){
      const anchor=pasturePoint(plan,pasture,i,visualCycleDay());
      const target=localGrazeTarget(anchor,seed,Math.max(.22,pasture.radius*.32),candidate=>
        whiteZoneAt(candidate)&&dist(candidate,pasture.center)<=pasture.radius*.98);
      return grazeLoop(anchor,target,time,seed);
    }
    const anchor=plan.pen[i];
    const target=localGrazeTarget(anchor,seed,Math.max(.14,Math.sqrt(Math.max(plan.area,1))*.08),candidate=>
      isFreePenPoint(candidate,lot,house,[],0));
    return grazeLoop(anchor,target,time,seed);
  }
  // Use the actual projected travel vector when selecting the mirrored sprite.
  // Graze movement uses a deterministic two-way heading; shepherd trips use
  // their current path tangent, including the reversed return journey.
  function movingAnimalPosition(plan,pasture,i,frac,phase,lot,house){
    const lag=i/Math.max(1,plan.count)*.18;
    const destination=grazingBehavior(plan,pasture,lot,house,i);
    const home=plan.pen[i],path=pasture.path;
    if(phase==='graze')return destination;
    if(phase==='home'||!pasture)return {p:home,mode:'browse',heading:destination.heading};
    if(phase==='out'){
      const q=clamp((frac-DEPART)/(PASTURE_AT-DEPART),0,1);
      const progress=smooth(clamp((q-lag)/(1-lag),0,1));
      const anchor=pointAlongPath(path,progress);
      const blend=smooth((progress-.83)/.17);
      const point=lerp(anchor,destination.p,blend);
      const next=pointAlongPath(path,Math.min(1,progress+.02));
      const heading=blend>.8?{x:destination.p.x-anchor.x,y:destination.p.y-anchor.y}:
        {x:next.x-anchor.x,y:next.y-anchor.y};
      return {p:point,mode:'walk',heading};
    }
    const q=clamp((frac-RETURN)/(HOME_AT-RETURN),0,1);
    const progress=smooth(clamp((q-lag)/(1-lag),0,1));
    const anchor=pointAlongPath(path,1-progress);
    const from=lerp(destination.p,anchor,smooth(progress/.12));
    const finish=smooth((progress-.88)/.12);
    const point=lerp(from,home,finish);
    const next=pointAlongPath(path,Math.max(0,1-progress-.02));
    const heading=finish>.3?{x:home.x-from.x,y:home.y-from.y}:
      {x:next.x-anchor.x,y:next.y-anchor.y};
    return {p:point,mode:'walk',heading};
  }
  function animalFacing(p,heading,seed){
    if(heading&&Math.hypot(heading.x,heading.y)>1e-5){
      const q=w2s(p,.07),next=w2s({x:p.x+heading.x,y:p.y+heading.y},.07);
      if(Math.abs(next.x-q.x)>.001)return next.x>q.x?1:-1;
    }
    return seed%2?1:-1;
  }
  function animals(){
    const out=[],frac=dayFraction();
    for(const lot of urbanLots()){
      const house=State.structures.find(s=>s.id===lot.houseId);
      if(!house||houseLevel(house)!==1||underConstruction(house))continue;
      const data=plan(house,lot);
      if(!data.count)continue;
      const pasture=data.kind==='shepherd'?pastureFor(data):null;
      const phase=pasture?period(frac):'home';
      for(let i=0;i<data.count;i++){
        let behavior={p:data.pen[i],mode:'browse',heading:null};
        if(data.kind==='shepherd'&&pasture)behavior=movingAnimalPosition(data,pasture,i,frac,phase,lot,house);
        else behavior=grazingBehavior(data,null,lot,house,i);
        const seed=hash(house.id+'|'+i);
        out.push({id:house.id+':'+i,species:data.kind==='goat'?'goat':'sheep',p:behavior.p,mode:behavior.mode,
          seed,heading:behavior.heading,facing:animalFacing(behavior.p,behavior.heading,seed)});
      }
    }
    return out;
  }
  function draw(){
    if(!window.ConquerAnimals?.drawAnimal)return;
    const t=visualCycleDay(),objects=animals(),stride=State.view.scale<.30?3:State.view.scale<.5?2:1;
    objects.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    let visible=0;
    for(const a of objects){
      if(stride>1&&a.seed%stride!==0||!worldPointVisible(a.p,.07,30))continue;
      const screen=w2s(a.p,.07);
      const size=Math.max(1.5,State.view.scale*5.75);
      withUrbanFigureOcclusion(a.p,.07,()=>window.ConquerAnimals.drawAnimal(
        a.species,ctx,screen.x,screen.y,size,{
          t:t*34,seed:a.seed%1000,facing:a.facing,
          mode:a.mode,blend:a.mode==='browse'?.86:0
        }));
      visible++;
    }
    if(window.__conquerPerf){window.__conquerPerf.livestock=objects.length;window.__conquerPerf.visibleLivestock=visible}
  }
  function occupancy(){
    return animals().map(a=>({x:a.p.x,y:a.p.y,r:.13}));
  }
  function summary(){
    const counts={garden:0,goat:0,shepherd:0,goats:0,sheep:0};
    for(const lot of urbanLots()){
      const house=State.structures.find(s=>s.id===lot.houseId);
      if(!house||underConstruction(house)||houseLevel(house)!==1)continue;
      const d=plan(house,lot);counts[d.kind]++;
      if(d.kind==='goat')counts.goats+=d.count;
      if(d.kind==='shepherd')counts.sheep+=d.count;
    }
    return counts;
  }
  window.ConquerLivestock={lotKindForHouse:kindForHouse,shepherdPosition,animals,draw,occupancy,summary};
})();