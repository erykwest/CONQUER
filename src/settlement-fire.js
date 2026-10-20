'use strict';
// CONQUER fire: what burns, how a fire grows, eats its fuel, damages, spreads and dies,
// and how it looks. Timber burns whole (houses, taverns, markets, wooden towers, gates
// and palisades); stone structures burn only their wooden parts (a pitched roof, a
// hoarding gallery, the gate door); bare masonry does not burn. A timber structure
// that comes down while burning leaves burning rubble for a while: nobody crosses it
// (not even a breach) and it sets light to what stands next to it. Rain slows it all.
// Fires run on game time (ConquerFire.tick(dt*speed) from the simulation frame): they
// pause with the game and go faster with it. Damage goes through ConquerSiege with the
// 'torch' weapon (it harms wood and doors, never stone), applied once a second.
//   ignite(id,{part,z,x,y,heat}) -> fire or null    parts(s) -> [{part,flam}]
//   tick(dt)  draw()  blocks(p)  burning(id)  extinguish(id)
//   volley(s,'arrows'|'stone',from)  burning shots loosed at a structure from outside
//   drawTorch(g,p,scale,id)          the torch an attacker carries
(function(){
  const GROW=.22,EMBER_TIME=45,SPREAD_EVERY=1,DAMAGE_EVERY=1;
  // Seconds of full fire each fuel lasts.
  const BURN={whole:55,roof:30,hoarding:26,door:22};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function store(){
    if(!State.fire||typeof State.fire!=='object')State.fire={burning:[],embers:[]};
    if(!Array.isArray(State.fire.burning))State.fire.burning=[];
    if(!Array.isArray(State.fire.embers))State.fire.embers=[];
    if(!Array.isArray(State.fire.shots))State.fire.shots=[];
    if(!Array.isArray(State.fire.sparks))State.fire.sparks=[];
    return State.fire;
  }
  const isWood=s=>s.type==='palisade'||s.material==='wood'||(s.type==='tower'&&typeof isWoodTower==='function'&&isWoodTower(s))
    ||(typeof isWoodGate==='function'&&isWoodGate(s));
  // The parts of a structure that can burn, most exposed first, with how readily they catch.
  function parts(s){
    if(!s||s.type==='ruin'||(typeof underConstruction==='function'&&underConstruction(s)))return[];
    if(isWood(s))return[{part:'whole',flam:1}];
    if(s.type==='house'||s.type==='tavern')return[{part:'whole',flam:.9}];
    if(s.type==='market')return[{part:'whole',flam:.7}];
    // Mills: timber cap, sails, floors and wheel; once gutted nothing is left to burn.
    if(['windmill','watermill'].includes(s.type))return s.burnt?[]:[{part:'whole',flam:.85}];
    const out=[];
    if(s.type==='tower'&&typeof towerRoofStyle==='function'&&towerRoofStyle(s)==='pitched'&&!s.roofBurnt)out.push({part:'roof',flam:.6});
    if(s.type==='gate'&&typeof gateRoofStyle==='function'&&gateRoofStyle(s)==='pitched'&&!s.roofBurnt)out.push({part:'roof',flam:.6});
    if(s.type==='church'&&!s.roofBurnt)out.push({part:'roof',flam:.4});
    if(s.type==='wall'&&typeof wallSkin==='function'&&wallSkin(s)==='hoarding')out.push({part:'hoarding',flam:.8});
    // The door burns until it is burnt out or battered down (its own integrity at zero).
    if(s.type==='gate'&&!s.doorBurnt&&!(s.siegeIntegrity?.door?.hp<=0))out.push({part:'door',flam:.5});
    return out;
  }
  const find=id=>State.structures.find(s=>s.id===id);
  const fireOf=(id,part)=>store().burning.find(f=>f.id===id&&(!part||f.part===part));
  // Set a structure alight. opts.part picks the part; otherwise a low hit (a torch at the
  // foot of a gate) takes the door, a high one (arrows, a burning shot) the roof or gallery.
  function ignite(id,opts={}){
    const s=find(id),list=parts(s);if(!list.length)return null;
    let pick=opts.part?list.find(p=>p.part===opts.part):null;
    if(!pick&&Number.isFinite(opts.z)&&opts.z<.9)pick=list.find(p=>p.part==='door');
    pick=pick||list.find(p=>p.part!=='door')||list[0];
    let f=fireOf(id,pick.part);
    const at=Number.isFinite(opts.x)?{x:opts.x,y:opts.y}:null;
    if(f){f.heat=Math.max(f.heat,opts.heat??.25);if(at&&!f.at)f.at=at;return f}
    f={id,part:pick.part,flam:pick.flam,heat:opts.heat??.25,fuel:1,at,seed:Math.floor(Math.random()*1e9),dmg:0,clock:0,spread:0};
    store().burning.push(f);loop();
    return f;
  }
  function extinguish(id){const x=store();x.burning=x.burning.filter(f=>f.id!==id)}
  function burning(id){return store().burning.some(f=>f.id===id)}
  function wet(){try{return typeof weatherGroundWet==='function'?!!weatherGroundWet():!!State.weather?.wet}catch{return false}}
  function centre(s){return s.x!==undefined?{x:s.x,y:s.y}:{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2}}
  // Distance from a point to a structure's footprint edge (0 inside).
  function gap(p,s){
    if(s.a&&s.b){
      const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L2=dx*dx+dy*dy||1,k=clamp(((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/L2,0,1);
      return Math.max(0,Math.hypot(p.x-s.a.x-dx*k,p.y-s.a.y-dy*k)-(Number(s.width)||.3)/2);
    }
    const c=centre(s),fp=typeof footprintPoints==='function'?footprintPoints(s):[];
    const r=fp.length?Math.max(...fp.map(q=>Math.hypot(q.x-c.x,q.y-c.y))):.6;
    return Math.max(0,Math.hypot(p.x-c.x,p.y-c.y)-r);
  }
  function radius(s){
    const c=centre(s),fp=typeof footprintPoints==='function'?footprintPoints(s):[];
    return fp.length?Math.max(...fp.map(q=>Math.hypot(q.x-c.x,q.y-c.y))):.6;
  }
  // Where the fire is on a structure: the spot it caught, else its centre.
  function seat(s,f){return f.at||centre(s)}
  // From a burning seat p (r: how far the fire reaches out from it, e.g. the burning
  // building's own size) to anything flammable within reach of its edge.
  function spreadFrom(p,heat,flam,reach,dt,skipId,r=0){
    const rate=(wet()?.3:1)*heat*flam;
    for(const t of State.structures){
      if(t.id===skipId||burning(t.id))continue;
      const list=parts(t);if(!list.length)continue;
      const d=Math.max(0,gap(p,t)-r);if(d>reach)continue;
      const chance=dt*.09*rate*list[0].flam/(d+.45);
      if(Math.random()<chance)ignite(t.id,{part:list.find(x=>x.part!=='door')?.part||list[0].part,heat:.2,x:p.x,y:p.y});
    }
  }
  // A wooden part burnt out on a stone structure: the roof or gallery is gone, charred.
  function burnout(s,f){
    if(f.part==='roof'){
      s.roofBurnt=true;
      if(s.type==='tower'||s.type==='gate')s.roofStyle='battlement';
    }else if(f.part==='hoarding')s.skin='standard';
    else if(f.part==='door')s.doorBurnt=true;
    else if(f.part==='whole')s.burnt=true;      // a gutted mill: it stands, but grinds no more
    s.charred=true;
    if(typeof invalidateStructureScene==='function')invalidateStructureScene(s);
    if(typeof invalidateSceneCache==='function')invalidateSceneCache();
    if(typeof markDirty==='function')markDirty(true,true,true);
  }
  // The structure came down while burning: its rubble keeps burning for a while.
  function toEmbers(f){
    const ruins=State.siege?.ruins||[];
    const r=[...ruins].reverse().find(x=>x.spec&&String(x.id).startsWith(f.id+':'));
    if(r)store().embers.push({ruin:r.id,left:EMBER_TIME*(f.part==='whole'?1:.5),heat:1,spread:0});
  }
  // ---------- burning shots ----------
  // Fire arrows (a volley of eight, each may set the target alight) and a burning
  // trebuchet stone (it strikes like a stone and starts a fire where it lands), loosed
  // from 9 U outside, on the side away from the settlement centre.
  function groundAt(p){return typeof terrainElevation==='function'?terrainElevation(p):0}
  function aimPoint(s,rnd){
    const c=centre(s),H=typeof structureHeight==='function'?structureHeight(s):1,g=groundAt(c);
    if(s.a&&s.b){const k=rnd();return{x:s.a.x+(s.b.x-s.a.x)*k,y:s.a.y+(s.b.y-s.a.y)*k,z:g+H*(.6+rnd()*.4)}}
    const r=radius(s)*.6,a=rnd()*Math.PI*2;return{x:c.x+Math.cos(a)*r*rnd(),y:c.y+Math.sin(a)*r*rnd(),z:g+H*(.6+rnd()*.4)};
  }
  function volley(s,kind='arrows',origin=null){
    if(!s)return 0;
    const c=centre(s),rnd=Math.random;
    let dx=origin?c.x-origin.x:-1,dy=origin?c.y-origin.y:0;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
    const from={x:c.x+dx*9,y:c.y+dy*9};from.z=groundAt(from)+.6;
    const shots=store().shots;
    if(kind==='stone'){shots.push({kind,id:s.id,from,to:aimPoint(s,rnd),t:0,delay:0,dur:2.2});loop();return 1}
    for(let i=0;i<8;i++)shots.push({kind:'arrow',id:s.id,from:{x:from.x+(rnd()-.5)*1.5,y:from.y+(rnd()-.5)*1.5,z:from.z},to:aimPoint(s,rnd),t:0,delay:i*.12,dur:.9+rnd()*.2});
    loop();return 8;
  }
  function impact(shot){
    const s=find(shot.id),p=shot.to;
    store().sparks.push({x:p.x,y:p.y,z:p.z,age:0,big:shot.kind==='stone'});
    if(!s)return;
    if(shot.kind==='stone'){
      window.ConquerSiege?.attackStructure(s.id,'trebuchet',6,s.a?{x:p.x,y:p.y}:'core');
      if(find(shot.id))ignite(shot.id,{x:p.x,y:p.y,z:p.z-groundAt(p),heat:.5});
    }else{
      const list=parts(s).filter(q=>q.part!=='door');
      if(list.length&&Math.random()<.5*list[0].flam)ignite(s.id,{part:list[0].part,x:p.x,y:p.y,heat:.2});
    }
  }
  function shotAt(shot,u){
    const p=shot.from,q=shot.to,d=Math.hypot(q.x-p.x,q.y-p.y),arc=(shot.kind==='stone'?.38:.16)*d;
    return{x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u,z:p.z+(q.z-p.z)*u+Math.sin(Math.PI*u)*arc};
  }
  // ---------- bucket brigade ----------
  // The defenders fight fires: up to six women of the village run from the nearest well
  // to the fire, throw a bucket, run back. One bucket puts out a fire an arrow has just
  // started; a fire in full blaze grows back faster than a brigade from a distant well
  // can douse it, so many fires at once overwhelm it. Water stops fire, not blows. From
  // the ground a bucket does half as much to a tower's roof. Burning rubble can be doused.
  const BRIGADE={size:6,speed:1.05,fill:1.1,throwT:.55,douse:.24,embers:9};
  const WOMEN=[['#9a7b52','#6b5338'],['#8c6b3f','#5d4a32'],['#a0825a','#6e5639'],['#7f6a4e','#57452f']];
  function brigadeOn(){return store().brigadeOn!==false}
  function setBrigade(on){store().brigadeOn=!!on;if(!on)store().carriers=[]}
  function wells(){return State.structures.filter(s=>s.type==='well'&&!(typeof underConstruction==='function'&&underConstruction(s)))}
  // What can be fought: burning parts of standing structures and burning rubble.
  function blazes(){
    const x=store(),out=[];
    for(const f of x.burning){const s=find(f.id);if(s)out.push({key:f.id+':'+f.part,fire:f,s,at:seat(s,f),r:f.at?.3:radius(s),heat:f.heat})}
    for(const e of x.embers){const r=(State.siege?.ruins||[]).find(q=>q.id===e.ruin);if(r?.spec)out.push({key:'ember:'+e.ruin,ember:e,at:{x:r.x,y:r.y},r:emberRadius(r),heat:e.heat})}
    return out;
  }
  function route(a,b){
    const p=typeof findPeasantPath==='function'?findPeasantPath(a,b,null):null;
    return(p&&p.length?p:[a,b]).map(q=>({x:q.x,y:q.y}));
  }
  // Where a woman stands to throw: on the side of the well, each in her own place.
  function standBy(b,from,lane=0){
    const a=Math.atan2(from.y-b.at.y,from.x-b.at.x)+lane*.38,o=b.r+.35;
    return{x:b.at.x+Math.cos(a)*o,y:b.at.y+Math.sin(a)*o};
  }
  function walk(c,dt){
    let budget=dt*BRIGADE.speed;
    while(budget>0&&c.path?.length){
      const n=c.path[0],d=Math.hypot(n.x-c.x,n.y-c.y);
      if(d<.02){c.path.shift();continue}
      const s=Math.min(d,budget);c.x+=(n.x-c.x)*s/d;c.y+=(n.y-c.y)*s/d;budget-=s;
    }
    return !c.path?.length;
  }
  function douse(b,x){
    if(b.fire){
      // A bucket smothers a small fire; on a full blaze it barely tells.
      const f=b.fire,k=BRIGADE.douse*(1-f.heat*.75)*(f.part==='roof'?.5:1)/Math.max(.5,f.flam);
      f.heat-=k;if(f.heat<=.02)x.burning=x.burning.filter(g=>g!==f);
    }else if(b.ember){b.ember.left-=BRIGADE.embers;b.ember.heat=clamp(b.ember.left/EMBER_TIME,0,1)}
    x.splashes.push({x:b.at.x,y:b.at.y,z:groundAt(b.at)+(b.fire?.part==='roof'?1.2:.5),age:0});
  }
  function brigadeTick(dt){
    const x=store();
    if(!Array.isArray(x.carriers))x.carriers=[];
    if(!Array.isArray(x.splashes))x.splashes=[];
    for(const sp of [...x.splashes]){sp.age+=dt;if(sp.age>.9)x.splashes=x.splashes.filter(o=>o!==sp)}
    const ws=wells(),list=brigadeOn()&&ws.length?blazes():[];
    // Nothing to fight (or no well): the women go home.
    if(!list.length){
      if(!ws.length){x.carriers=[];return}
      for(const c of x.carriers)if(c.state!=='home'){c.state='home';c.full=false;c.path=route(c,{x:ws[0].x+.8,y:ws[0].y})}
      for(const c of [...x.carriers])if(walk(c,dt))x.carriers=x.carriers.filter(o=>o!==c);
      return;
    }
    while(x.carriers.length<BRIGADE.size){
      const w=ws[0],i=x.carriers.length;
      // They come out one after another and take turns at the well: a chain, not a crowd.
      const a=i*1.05;
      x.carriers.push({id:'bucket-'+i+'-'+Math.floor(Math.random()*1e6),x:w.x+Math.cos(a)*.8,y:w.y+Math.sin(a)*.8,state:'fill',t:-i*.7,
        lane:(i%2?1:-1)*Math.ceil(i/2),colors:WOMEN[i%WOMEN.length],path:null});
    }
    // The smallest fires first (they can still be saved); each woman sticks to hers until it is out.
    const byHeat=[...list].sort((a,b)=>a.heat-b.heat);
    x.carriers.forEach((c,i)=>{
      let b=list.find(q=>q.key===c.target);
      if(!b){b=byHeat[i%byHeat.length];c.target=b.key;if(c.state==='go'||c.state==='throw'){c.state='fill';c.t=0}}
      const well=ws.reduce((m,w)=>Math.hypot(w.x-b.at.x,w.y-b.at.y)<Math.hypot(m.x-b.at.x,m.y-b.at.y)?w:m,ws[0]);
      const atWell={x:well.x+(b.at.x-well.x)/(Math.hypot(b.at.x-well.x,b.at.y-well.y)||1)*.9,y:well.y+(b.at.y-well.y)/(Math.hypot(b.at.x-well.x,b.at.y-well.y)||1)*.9};
      if(c.state==='home'){c.state='fill';c.path=route(c,atWell)}
      if(c.state==='fill'){
        if(c.path?.length){walk(c,dt);return}
        if(Math.hypot(c.x-atWell.x,c.y-atWell.y)>.9){c.path=route(c,atWell);return}
        c.t+=dt;if(c.t>=BRIGADE.fill){c.t=0;c.full=true;c.state='go';c.path=route(c,standBy(b,well,c.lane||0))}
        return;
      }
      if(c.state==='go'){if(walk(c,dt)){c.state='throw';c.t=0}return}
      if(c.state==='throw'){
        c.t+=dt;if(c.t<BRIGADE.throwT)return;
        douse(b,x);c.full=false;c.state='fill';c.t=0;c.path=route(c,atWell);
      }
    });
  }
  function tick(dt){
    if(!(dt>0))return;
    const x=store(),rain=wet();
    brigadeTick(dt);
    for(const shot of [...x.shots]){shot.t+=dt;if(shot.t>=shot.delay+shot.dur){x.shots=x.shots.filter(o=>o!==shot);impact(shot)}}
    for(const sp of [...x.sparks]){sp.age+=dt;if(sp.age>(sp.big?1.2:.6))x.sparks=x.sparks.filter(o=>o!==sp)}
    for(const f of [...x.burning]){
      const s=find(f.id);
      if(!s||s.type==='ruin'){x.burning=x.burning.filter(g=>g!==f);if(f.heat>.3)toEmbers(f);continue}
      const cap=rain?.55:1;
      // A new fire smoulders before it takes hold: growth speeds up as it spreads.
      f.heat=Math.min(cap,f.heat+dt*GROW*f.flam*(.05+f.heat*f.heat)*(rain?.4:1));
      f.fuel-=dt*f.heat/BURN[f.part];
      f.clock+=dt;f.dmg+=dt*f.heat*f.flam;
      if(f.clock>=DAMAGE_EVERY){
        // Torches harm wood and doors only: a burning roof does not crack masonry.
        const force=f.dmg*1.6;f.clock=0;f.dmg=0;
        if(f.part==='whole')window.ConquerSiege?.attackStructure(s.id,'torch',force,s.a?seat(s,f):'core');
        else if(f.part==='door')window.ConquerSiege?.attackStructure(s.id,'torch',force,'door');
        // It came down under the flames: the rubble burns on at once.
        const now=find(f.id);
        if(!now||now.type==='ruin'){x.burning=x.burning.filter(g=>g!==f);toEmbers(f);continue}
      }
      f.spread+=dt;
      if(f.spread>=SPREAD_EVERY&&f.heat>.45){spreadFrom(seat(s,f),f.heat,f.flam,1.4,f.spread,s.id,f.part==='whole'&&!f.at?radius(s):.3);f.spread=0}
      // A mill shows gutted once most of it has burnt (ConquerIndustries3D.variant).
      if(!f.gutted&&f.fuel<.6&&['windmill','watermill'].includes(s.type)){
        f.gutted=true;
        if(typeof invalidateSceneCache==='function')invalidateSceneCache();
        if(typeof markDirty==='function')markDirty(true,true,true);
      }
      if(f.fuel<=0){x.burning=x.burning.filter(g=>g!==f);if(f.part!=='whole')burnout(s,f);else if(f.gutted)burnout(s,f)}
    }
    for(const e of [...x.embers]){
      e.left-=dt*(rain?2.5:1);e.heat=clamp(e.left/EMBER_TIME,0,1);
      e.spread+=dt;
      const r=(State.siege?.ruins||[]).find(q=>q.id===e.ruin);
      if(!r||e.left<=0){x.embers=x.embers.filter(g=>g!==e);continue}
      if(e.spread>=SPREAD_EVERY){spreadFrom(r,e.heat,.8,1.1,e.spread,null,emberRadius(r));e.spread=0}
    }
    if(x.burning.length||x.embers.length||x.shots.length||x.carriers?.length)loop();
  }
  function emberRadius(r){const pts=r.spec?.parts?.flat()||[];return pts.length?Math.max(...pts.map(q=>Math.hypot(q.x-r.x,q.y-r.y))):.5}
  // Burning rubble: nobody crosses it while the embers are hot, not even in a breach.
  function blocks(p){
    const x=State.fire;if(!x?.embers?.length)return false;
    for(const e of x.embers){
      if(e.heat<.15)continue;
      const r=(State.siege?.ruins||[]).find(q=>q.id===e.ruin);if(!r?.spec)continue;
      if(r.spec.parts.some(poly=>inPoly(p,poly)||poly.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<.35)))return true;
    }
    return false;
  }
  function inPoly(p,poly){
    let c=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}
    return c;
  }

  // ---------- drawing ----------
  // Flames are drawn after the 3D pass (they glow over what is in front of them, as fire
  // does at a distance), with smoke rising above and sparks. Seats are seeded per fire.
  function rng(seed){let s=seed>>>0||1;return()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296}
  function seats(s,f){
    const rnd=rng(f.seed),ground=typeof terrainElevation==='function'?terrainElevation(centre(s)):0;
    const H=typeof structureHeight==='function'?structureHeight(s):1,out=[];
    const n=Math.round(3+f.heat*7);
    if(f.part==='door'){
      const d=typeof rectDims==='function'?rectDims(s):{w:1.5},a=Number(s.angle)||0;
      for(let i=0;i<n;i++){const o=(rnd()-.5)*.6;out.push({x:s.x+Math.cos(a)*d.w/2-Math.sin(a)*o,y:s.y+Math.sin(a)*d.w/2+Math.cos(a)*o,z:ground+.1+rnd()*.5})}
      return out;
    }
    if(s.a&&s.b){
      const c=seat(s,f),L=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)||1,ux=(s.b.x-s.a.x)/L,uy=(s.b.y-s.a.y)/L;
      const spread=.6+f.heat*1.6;
      for(let i=0;i<n;i++){const o=(rnd()-.5)*2*spread;out.push({x:c.x+ux*o,y:c.y+uy*o,z:ground+H*(.55+rnd()*.5)})}
      return out;
    }
    const fp=typeof footprintPoints==='function'?footprintPoints(s):[],c=centre(s);
    for(let i=0;i<n;i++){
      const q=fp.length?fp[Math.floor(rnd()*fp.length)]:c,k=.35+rnd()*.6;
      out.push({x:c.x+(q.x-c.x)*k,y:c.y+(q.y-c.y)*k,z:ground+H*(f.part==='roof'?.85+rnd()*.15:.35+rnd()*.7)});
    }
    return out;
  }
  function emberSeats(r,e){
    const rnd=rng(String(r.id).length*7919+(r.day||0)),out=[],parts=r.spec.parts,n=Math.round(4+e.heat*8);
    const all=parts.flat(),xs=all.map(p=>p.x),ys=all.map(p=>p.y),g=r.spec.ground||0;
    for(let i=0;out.length<n&&i<n*6;i++){
      const p={x:Math.min(...xs)+rnd()*(Math.max(...xs)-Math.min(...xs)),y:Math.min(...ys)+rnd()*(Math.max(...ys)-Math.min(...ys))};
      if(parts.some(poly=>inPoly(p,poly)))out.push({x:p.x,y:p.y,z:g+.12+rnd()*.25});
    }
    return out;
  }
  function project(p){return typeof w2sRaw==='function'?w2sRaw({x:p.x,y:p.y},p.z):{x:p.x,y:p.y}}
  function flame(ctx,p,size,t,k){
    // A tongue of flame: a teardrop that sways, orange outside, yellow core.
    const sway=Math.sin(t*9+k*1.7)*size*.18,h=size*(1.6+.35*Math.sin(t*13+k));
    const grad=ctx.createLinearGradient(p.x,p.y,p.x,p.y-h);
    grad.addColorStop(0,'rgba(255,190,70,.95)');grad.addColorStop(.5,'rgba(240,110,30,.85)');grad.addColorStop(1,'rgba(200,50,20,0)');
    ctx.fillStyle=grad;ctx.beginPath();
    ctx.moveTo(p.x-size*.5,p.y);
    ctx.quadraticCurveTo(p.x-size*.55+sway*.5,p.y-h*.55,p.x+sway,p.y-h);
    ctx.quadraticCurveTo(p.x+size*.55+sway*.5,p.y-h*.55,p.x+size*.5,p.y);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,236,150,.8)';ctx.beginPath();
    ctx.ellipse(p.x+sway*.3,p.y-h*.22,size*.18,h*.22,0,0,Math.PI*2);ctx.fill();
  }
  function smoke(ctx,p,size,t,k,a){
    for(let i=0;i<3;i++){
      const age=((t*.35+k*.31+i/3)%1),r=size*(1+age*3);
      ctx.fillStyle='rgba(70,64,60,'+(a*(1-age)).toFixed(3)+')';
      ctx.beginPath();ctx.arc(p.x+Math.sin(age*5+k)*size*.6+age*size*1.5,p.y-size*2-age*size*9,r,0,Math.PI*2);ctx.fill();
    }
  }
  function draw(){
    const x=State.fire;if(!x||(!x.burning?.length&&!x.embers?.length&&!x.shots?.length&&!x.sparks?.length&&!x.carriers?.length&&!x.splashes?.length))return;
    const g=typeof ctx!=='undefined'?ctx:null;if(!g)return;
    const t=performance.now()/1000,scale=State.view?.scale||1,unit=Math.max(2.5,4.2*scale);
    const night=typeof nightFactor==='function'?nightFactor():0;
    g.save();
    const fires=[];
    for(const f of x.burning){const s=find(f.id);if(s)for(const p of seats(s,f))fires.push({p,heat:f.heat})}
    for(const e of x.embers){const r=(State.siege?.ruins||[]).find(q=>q.id===e.ruin);if(r?.spec)for(const p of emberSeats(r,e))fires.push({p,heat:e.heat*.6,ember:true})}
    const pts=fires.map((q,k)=>({...q,s:project(q.p),k}));
    // Smoke first (behind), then glow, flames and sparks.
    for(const q of pts)smoke(g,q.s,unit*(.6+q.heat*.6),t,q.k,.28*q.heat);
    g.globalCompositeOperation='lighter';
    for(const q of pts){
      const r=unit*(3+q.heat*4)*(1+night*.8),grd=g.createRadialGradient(q.s.x,q.s.y,0,q.s.x,q.s.y,r);
      grd.addColorStop(0,'rgba(255,140,40,'+(.18+.22*night)*q.heat+')');grd.addColorStop(1,'rgba(255,90,20,0)');
      g.fillStyle=grd;g.beginPath();g.arc(q.s.x,q.s.y,r,0,Math.PI*2);g.fill();
    }
    for(const q of pts)flame(g,q.s,unit*(q.ember?.45:.55+q.heat*.65),t,q.k);
    drawShots(g,x,t,unit);
    drawBrigade(g,x,t,unit);
    g.fillStyle='rgba(255,210,120,.9)';
    for(const q of pts){
      const age=(t*1.3+q.k*.37)%1;
      g.fillRect(q.s.x+Math.sin(q.k+t*3)*unit*1.2,q.s.y-unit*(1+age*6),Math.max(1,scale*.8),Math.max(1,scale*.8));
    }
    g.restore();
  }
  // Shots in flight: an arrow with a burning head and a spark trail, a stone in flames
  // trailing smoke; a burst of sparks where they strike.
  function drawShots(g,x,t,unit){
    for(const shot of x.shots||[]){
      const u=(shot.t-shot.delay)/shot.dur;if(u<0)continue;
      const p=project(shotAt(shot,u)),q=project(shotAt(shot,Math.max(0,u-.04)));
      if(shot.kind==='stone'){
        g.globalCompositeOperation='source-over';
        for(let i=1;i<6;i++){const o=project(shotAt(shot,Math.max(0,u-i*.03)));g.fillStyle='rgba(80,72,66,'+(.3-i*.05)+')';g.beginPath();g.arc(o.x,o.y,unit*(.5+i*.25),0,Math.PI*2);g.fill()}
        g.fillStyle='#4a423c';g.beginPath();g.arc(p.x,p.y,unit*.55,0,Math.PI*2);g.fill();
        g.globalCompositeOperation='lighter';flame(g,{x:p.x,y:p.y+unit*.3},unit*.9,t,shot.delay*10);
      }else{
        g.globalCompositeOperation='source-over';
        const dx=p.x-q.x,dy=p.y-q.y,l=Math.hypot(dx,dy)||1,L=unit*1.6;
        g.strokeStyle='#3b2a1a';g.lineWidth=Math.max(1,unit*.18);g.beginPath();g.moveTo(p.x-dx/l*L,p.y-dy/l*L);g.lineTo(p.x,p.y);g.stroke();
        g.globalCompositeOperation='lighter';
        g.fillStyle='rgba(255,170,60,.9)';g.beginPath();g.arc(p.x,p.y,unit*.35,0,Math.PI*2);g.fill();
        g.strokeStyle='rgba(255,140,40,.35)';g.lineWidth=Math.max(1,unit*.25);g.beginPath();g.moveTo(q.x,q.y);g.lineTo(p.x,p.y);g.stroke();
      }
    }
    g.globalCompositeOperation='lighter';
    for(const sp of x.sparks||[]){
      const life=sp.big?1.2:.6,k=sp.age/life,p=project(sp),n=sp.big?14:6;
      for(let i=0;i<n;i++){const a=i/n*Math.PI*2+sp.x,r=unit*(sp.big?4:2)*k;
        g.fillStyle='rgba(255,'+(160+i*6)+',70,'+(1-k).toFixed(3)+')';g.fillRect(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r*.6-r*.3,Math.max(1,unit*.25),Math.max(1,unit*.25))}
    }
  }
  // The women of the brigade with their buckets; the water and the steam where it lands.
  function drawBrigade(g,x,t,unit){
    g.globalCompositeOperation='source-over';
    for(const c of x.carriers||[]){
      const ground=groundAt(c),bob=c.state==='go'||(c.path?.length)?Math.abs(Math.sin(t*10+c.x))*unit*.35:0;
      if(typeof drawVillagerFigure==='function'){
        const keep=g===ctx;
        drawVillagerFigure({p:{x:c.x,y:c.y},kind:'peasant',sex:'female',age:'adult',colors:c.colors,id:c.id,hair:null});void keep;
      }
      const p=project({x:c.x,y:c.y,z:ground+.25});
      const bx=p.x+unit*1.1,by=p.y-unit*1.4-bob,w=unit*.9,h=unit*.8;
      g.fillStyle='#6b5a46';g.strokeStyle='#3d3125';g.lineWidth=1;
      g.beginPath();g.moveTo(bx-w/2,by);g.lineTo(bx+w/2,by);g.lineTo(bx+w*.38,by+h);g.lineTo(bx-w*.38,by+h);g.closePath();g.fill();g.stroke();
      if(c.full){g.fillStyle='#5f9fc4';g.fillRect(bx-w*.42,by,w*.84,Math.max(1,h*.2))}
      if(c.state==='throw'){
        // The throw: an arc of water from the bucket towards the flames.
        const k=c.t/BRIGADE.throwT;g.strokeStyle='rgba(120,180,220,'+(1-k).toFixed(3)+')';g.lineWidth=Math.max(1,unit*.35);
        g.beginPath();g.moveTo(bx,by);g.quadraticCurveTo(bx+unit*2,by-unit*3,bx+unit*4*k+unit,by-unit*k);g.stroke();
      }
    }
    for(const sp of x.splashes||[]){
      const p=project(sp),k=sp.age/.9;
      g.fillStyle='rgba(225,232,236,'+(.55*(1-k)).toFixed(3)+')';
      for(let i=0;i<3;i++){g.beginPath();g.arc(p.x+(i-1)*unit*1.2,p.y-unit*(1+k*5+i),unit*(1+k*2),0,Math.PI*2);g.fill()}
      g.fillStyle='rgba(110,170,215,'+(.8*(1-k)).toFixed(3)+')';
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.fillRect(p.x+Math.cos(a)*unit*2*k,p.y+Math.sin(a)*unit*k-unit*k*2,Math.max(1,unit*.3),Math.max(1,unit*.3))}
    }
  }
  // The torch an attacker carries: a stick over his shoulder with a live flame.
  function drawTorch(g,p,scale,id){
    const t=performance.now()/1000,u=Math.max(1.4,2.1*scale),k=String(id).length;
    const hand={x:p.x+u*2.2,y:p.y-u*4.5},tip={x:hand.x+u*1.2,y:hand.y-u*3.2};
    g.save();g.strokeStyle='#5a3b22';g.lineWidth=Math.max(1,u*.45);g.beginPath();g.moveTo(hand.x,hand.y);g.lineTo(tip.x,tip.y);g.stroke();
    g.globalCompositeOperation='lighter';
    const grd=g.createRadialGradient(tip.x,tip.y,0,tip.x,tip.y,u*5);grd.addColorStop(0,'rgba(255,150,50,.35)');grd.addColorStop(1,'rgba(255,90,20,0)');
    g.fillStyle=grd;g.beginPath();g.arc(tip.x,tip.y,u*5,0,Math.PI*2);g.fill();
    flame(g,tip,u*1.1,t,k);g.restore();
  }
  // Keep frames coming while something burns (the game may be paused: flames still flicker).
  let raf=0,lastDraw=0;
  function loop(){
    if(raf||typeof requestAnimationFrame!=='function')return;
    const step=now=>{
      raf=0;const x=State.fire;
      if(!x||(!x.burning.length&&!x.embers.length&&!x.shots.length&&!x.sparks.length&&!x.carriers?.length))return;
      if(now-lastDraw>45){lastDraw=now;if(typeof draw==='function')window.draw?.()}
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
  }
  window.ConquerFire={parts,ignite,extinguish,burning,tick,blocks,draw,drawTorch,volley,gap,radius,state:store,BURN,
    brigade:{on:brigadeOn,set:setBrigade,carriers:()=>store().carriers||[],BRIGADE}};
})();
