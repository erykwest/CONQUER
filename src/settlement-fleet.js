'use strict';
// Ships in the game world (test fleet, DEV panel). A ship moors at the first free berth of a
// pier (settlement-pier.js), lying alongside with its bow to the sea, then at a free slot along
// a quay (settlement-quay.js), or, with no free berth, rides at anchor off the coast. Each ship has its arms (ConquerShips.arms) and a crew
// (settlement-ship-crew.js) that works the sails on orders. Ships are drawn every frame on
// the dynamic layer (both renderers) with their sailors as depth-sorted figures; the crews
// run on real time, so the sails can be tested with the game paused. Not saved yet.
(() => {
  const S=()=>window.ConquerShips,C=()=>window.ConquerShipCrew,M=()=>window.ConquerShipModels;
  const ships=[];let last=0,seq=0;
  const occupied=(pierId,side)=>ships.some(s=>s.berth?.pierId===pierId&&s.berth.side===side);
  // Pose alongside a berth: the hull touches the deck edge, amidships at the berth.
  function berthPose(pier,side,key){
    const b=window.ConquerPier.moorings(pier).find(m=>m.side===side),m=S().model(key);
    const off=m.B/2+.12;
    return{x:b.edge.x+b.out.x*off,y:b.edge.y+b.out.y*off,heading:pier.angle||0,z:0};
  }
  // Off the coast at anchor: in deep water, spread out so ships don't overlap.
  function anchorPose(key,n){
    const sea=(State.environment||[]).find(f=>f.type==='sea'&&f.coastline?.length>1);if(!sea)return null;
    const mid={x:100,y:100},hit=window.ConquerPier.coastHit(mid);if(!hit)return null;
    const t={x:-hit.normal.y,y:hit.normal.x},d=7+S().model(key).B,along=(n%5-2)*9;
    return{x:hit.point.x+hit.normal.x*d+t.x*along,y:hit.point.y+hit.normal.y*d+t.y*along,heading:Math.atan2(t.y,t.x),z:0};
  }
  // Along a quay (settlement-quay.js berths): alongside the face, bow along the quay.
  function quayBerthPose(b,key){
    const off=S().model(key).B/2+.12;
    return{x:b.edge.x+b.out.x*off,y:b.edge.y+b.out.y*off,heading:b.angle,z:0};
  }
  // A quay slot is free for a ship when its hull clears every quay (a slot by a corner would
  // put a long hull against the other arm), every pier and every other ship.
  function hull(key,pose,pad=.08){
    const m=S().model(key),c=Math.cos(pose.heading),sn=Math.sin(pose.heading),hl=m.L/2+pad,hb=m.B/2+pad;
    return[[hl,hb],[-hl,hb],[-hl,-hb],[hl,-hb]].map(([x,y])=>({x:pose.x+x*c-y*sn,y:pose.y+x*sn+y*c}));
  }
  function overlap(A,B){
    for(const poly of [A,B])for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],nx=-(b.y-a.y),ny=b.x-a.x;
      const pa=A.map(p=>p.x*nx+p.y*ny),pb=B.map(p=>p.x*nx+p.y*ny);
      if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false;
    }
    return true;
  }
  function quayFree(b,key){
    const h=hull(key,quayBerthPose(b,key));
    for(const o of State.structures||[]){
      if(o.type==='quay'&&overlap(h,window.ConquerQuay.footprint(o)))return false;
      if(o.type==='pier'&&overlap(h,window.ConquerPier.footprint(o)))return false;
    }
    return!ships.some(s=>overlap(h,hull(s.key,s.pose)));
  }
  // pier / quay: moor there only; anchor: true rides at anchor even with berths free.
  // Pier berths are filled first, then the slots along the quays.
  const militaryPier=p=>p?.use==='military';
  function spawn({key='cocca',allegiance='merchant',realm='player',pier=null,quay=null,anchor=false,livery=null,noAnchor=false,fisher=null,convoy=null}={}){
    if(!S()?.model?.(key))return null;
    let berth=null,pose=null;
    // Warships tie up at military piers, merchants and fishing boats at commercial piers and quays.
    const mil=allegiance==='player'&&!fisher&&!convoy;
    if(!anchor&&!quay)for(const p of (State.structures||[]).filter(s=>s.type==='pier'&&!s.yard&&(pier?s.id===pier:militaryPier(s)===mil)))
      for(const side of ['left','right'])if(!berth&&!occupied(p.id,side)){berth={pierId:p.id,side};pose=berthPose(p,side,key)}
    if(!berth&&!anchor&&!pier&&!mil)for(const q of (State.structures||[]).filter(s=>s.type==='quay'&&(!quay||s.id===quay)))
      for(const b of window.ConquerQuay?.berths(q)||[])if(!berth&&quayFree(b,key)){berth={quayId:q.id,side:b.side,along:b.along,key:b.key};pose=quayBerthPose(b,key)}
    if(!pose&&noAnchor)return null;
    pose||=anchorPose(key,ships.length);
    if(!pose)return null;
    // In port the sails are furled up to the yards; at anchor off the coast they stay set.
    const id='ship-'+(++seq),ship={id,key,allegiance,realm,berth,pose,livery:livery||S().livery?.(),fisher,convoy,crew:C().crewState(key,id,S().sailState(!!berth)),cache:null};
    ships.push(ship);if(!fisher&&!convoy)persist();requestDraw();
    return ship;
  }
  function order(what,id=null){for(const s of ships)if(!id||s.id===id)C().order(s.crew,what);requestDraw()}
  function clear(){ships.length=0;window.ConquerNavalBattle?.end();persist();requestDraw()}
  function remove(id){const i=ships.findIndex(s=>s.id===id);if(i>=0)ships.splice(i,1);persist();requestDraw()}
  // Saved with the village (State.village.fleet): kind, flag, livery and berth of each ship.
  // Fishing boats are not saved: they follow their households (settlement-fishers.js).
  let restoredFor=null;
  function persist(){
    if(typeof State==='undefined'||!State.village||restoredFor!==State.village)return;
    State.village.fleet=ships.filter(s=>!s.fisher&&!s.convoy).map(s=>({key:s.key,allegiance:s.allegiance,realm:s.realm,livery:s.livery||null,
      pier:s.berth?.pierId||null,quay:s.berth?.quayId||null,anchor:!s.berth,
      at:s.berth?null:{x:+s.pose.x.toFixed(2),y:+s.pose.y.toFixed(2),heading:+(s.pose.heading||0).toFixed(3)}}));
    State.dirty=true;
  }
  // A new or reloaded village brings its own fleet back.
  function restore(){
    if(typeof State==='undefined'||!State.village||restoredFor===State.village)return;
    ships.length=0;restoredFor=State.village;
    for(const r of Array.isArray(State.village.fleet)?State.village.fleet:[])
      {const s=spawn({key:r.key,allegiance:r.allegiance,realm:r.realm,livery:r.livery,pier:r.pier,quay:r.quay,anchor:!!r.anchor});
       // Ships left at anchor where they were sent come back to the same spot.
       if(s&&r.at&&!s.berth)s.pose={...s.pose,...r.at,z:0}}
    persist();
  }
  // Battle demo: a foreign ship of the same kind at anchor, and the chosen warship coming up
  // from astern, off its quarter, to grapple and board it (settlement-naval-battle.js).
  function battle({key='cocca',allegiance='player',realm='player'}={}){
    const NB=window.ConquerNavalBattle;if(!NB)return null;
    if(allegiance==='merchant')allegiance='player';
    const D=spawn({key,allegiance:'foreign',realm:realm==='player'?'azure':realm,anchor:true});if(!D)return null;
    const A=spawn({key,allegiance,realm:allegiance==='player'?'player':realm,anchor:true});
    const h=D.pose.heading,n={x:-Math.sin(h),y:Math.cos(h)},f={x:Math.cos(h),y:Math.sin(h)};
    A.pose={x:D.pose.x-f.x*16+n.x*6,y:D.pose.y-f.y*16+n.y*6,heading:h,z:0};
    return NB.start(A,D);
  }
  const requestDraw=()=>{if(typeof requestSceneDraw==='function')requestSceneDraw();else if(typeof draw==='function')draw()};
  // Keep the moored ships alongside if a pier moved or vanished; a quay slot that closed
  // (a pier or a wall built by it) sends its ship away.
  function sync(){
    for(let i=ships.length-1;i>=0;i--){
      const s=ships[i];if(!s.berth)continue;
      if(s.berth.quayId){
        const q=State.structures.find(o=>o.id===s.berth.quayId),b=q&&window.ConquerQuay?.berths(q).find(x=>x.key===s.berth.key);
        if(!b){ships.splice(i,1);persist();continue}
        s.pose=quayBerthPose(b,s.key);continue;
      }
      const pier=State.structures.find(p=>p.id===s.berth.pierId);
      if(!pier){ships.splice(i,1);persist();continue}
      s.pose=berthPose(pier,s.berth.side,s.key);
    }
  }
  // With the 3D renderer the hulls, sails, flags and plank are WebGL meshes of the frame's
  // front pass (depth-tested against piers, quays and the sea surface); the figures, flames
  // and arrows are painted after that pass so the hulls do not cover them.
  // Roll and pitch on the swell: small boats more than large ships, more under way than moored;
  // stepped 12 times a second so a ship's mesh is not rebuilt on every frame.
  const SWELL={boat:[.07,.035],small:[.045,.025],large:[.025,.014]};
  function seaMotion(s,now){
    const m=S().model(s.key),[r,p]=SWELL[m?.size]||SWELL.small,k=s.away?1.6:1,t=Math.floor(now*12)/12;
    let h=0;for(const c of String(s.id))h=(h*31+c.charCodeAt(0))>>>0;
    const ph=(h%628)/100;
    return{...s.pose,roll:(s.pose.roll||0)+Math.sin(t*1.1+ph)*r*k,pitch:(s.pose.pitch||0)+Math.sin(t*.8+ph*1.7)*p*k};
  }
  // ---------- unit commands for the player's warships (hooked into settlement-combat.js orders):
  // select with a click or a box, then click the sea to sail there (in line when several are
  // selected), a foreign ship to attack it (naval battle), or a pier to tie up at a free berth.
  const selected=new Set();
  const military=s=>s.allegiance==='player'&&!s.fisher&&!s.convoy&&!s.sunk;
  const selectedShips=()=>ships.filter(s=>selected.has(s.id)&&military(s));
  function pick(p){
    return ships.filter(s=>overlap(hull(s.key,s.pose,.25),[{x:p.x-.05,y:p.y-.05},{x:p.x+.05,y:p.y-.05},{x:p.x+.05,y:p.y+.05},{x:p.x-.05,y:p.y+.05}]))
      .sort((a,b)=>Math.hypot(a.pose.x-p.x,a.pose.y-p.y)-Math.hypot(b.pose.x-p.x,b.pose.y-p.y))[0]||null;
  }
  // A click on a warship selects it; returns true when it was one.
  function selectAt(p,additive=false){
    const s=pick(p);if(!s||!military(s))return false;
    if(!additive)selected.clear();
    if(additive&&selected.has(s.id))selected.delete(s.id);else selected.add(s.id);
    requestDraw();return true;
  }
  function selectInBox(x0,y0,x1,y1,additive=false){
    if(!additive)selected.clear();
    let n=0;
    for(const s of ships){if(!military(s))continue;const q=w2s(s.pose,.2);if(q.x>=x0&&q.x<=x1&&q.y>=y0&&q.y<=y1){selected.add(s.id);n++}}
    requestDraw();return n;
  }
  const clearSelection=()=>{selected.clear();requestDraw()};
  const onSea=p=>(State.environment||[]).some(f=>f.type==='sea'&&environmentContains(f,p));
  // Order the selection at point p: attack, tie up or sail. Returns a short status or null.
  function orderAt(p){
    const list=selectedShips();if(!list.length)return null;
    const target=pick(p);
    if(target&&target.allegiance==='foreign'){
      for(const s of list)setCommand(s,{kind:'attack',target:target.id});
      return list.length+(list.length>1?' navi attaccano ':' nave attacca ')+S().model(target.key).label;
    }
    const pier=(State.structures||[]).find(o=>o.type==='pier'&&!o.yard&&window.ConquerPier.footprint(o)&&pip(p,window.ConquerPier.footprint(o)));
    if(pier){
      if(!militaryPier(pier))return'Molo commerciale: le navi militari attraccano ai moli militari';
      let n=0;for(const s of list){const side=freeSide(pier,s);if(!side)break;setCommand(s,{kind:'moor',pier:pier.id,side});n++}
      return n?n+(n>1?' navi vanno':' nave va')+' a ormeggiare al molo':'Attracchi del molo occupati';
    }
    if(!onSea(p))return'Le navi vanno solo per mare';
    // In line abreast across the course, centred on the point clicked.
    const c=list.reduce((a,s)=>({x:a.x+s.pose.x/list.length,y:a.y+s.pose.y/list.length}),{x:0,y:0});
    const h=Math.atan2(p.y-c.y,p.x-c.x),nx=-Math.sin(h),ny=Math.cos(h);
    list.forEach((s,i)=>{const k=(i-(list.length-1)/2)*(S().model(s.key).B+3);setCommand(s,{kind:'move',goal:{x:p.x+nx*k,y:p.y+ny*k}})});
    return list.length+(list.length>1?' navi salpano':' nave salpa');
  }
  const freeSide=(pier,s)=>['left','right'].find(sd=>!ships.some(o=>o!==s&&o.berth?.pierId===pier.id&&o.berth.side===sd&&o.cmd?.kind!=='moor')&&!ships.some(o=>o!==s&&o.cmd?.kind==='moor'&&o.cmd.pier===pier.id&&o.cmd.side===sd));
  // "Attracca": each selected warship goes to the nearest military pier with a free berth.
  function moorSelected(){
    const list=selectedShips();if(!list.length)return'Seleziona una nave militare';
    const piers=(State.structures||[]).filter(o=>o.type==='pier'&&!o.yard&&militaryPier(o)&&!(typeof underConstruction==='function'&&underConstruction(o)));
    if(!piers.length)return'Nessun molo militare: impostane uno dal pannello del molo';
    let n=0;
    for(const s of list){
      if(s.berth)continue;
      const opts=piers.map(p=>({p,side:freeSide(p,s)})).filter(o=>o.side).sort((a,b)=>Math.hypot(a.p.x-s.pose.x,a.p.y-s.pose.y)-Math.hypot(b.p.x-s.pose.x,b.p.y-s.pose.y));
      if(!opts.length)break;setCommand(s,{kind:'moor',pier:opts[0].p.id,side:opts[0].side});n++;
    }
    return n?n+(n>1?' navi vanno':' nave va')+' ad attraccare':'Attracchi militari occupati';
  }
  function setCommand(s,cmd){
    s.cmd=cmd;s.nav=null;s.cmdPose={...s.pose};
    // Casting off frees the berth; the ship is under way.
    s.berth=null;s.away=true;persist();requestDraw();
  }
  const pip=(p,poly)=>{let k=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)k=!k}return k};
  const ATTACK_RANGE=16;
  function commands(dt){
    const N=window.ConquerSeaNav,NB=window.ConquerNavalBattle;if(!N)return;
    for(const s of ships){
      const c=s.cmd;if(!c)continue;
      if(s.cmdPose)s.pose=s.cmdPose;
      let r='arrived';
      if(c.kind==='move')r=N.drive(s,c.goal,dt,ships);
      else if(c.kind==='moor'){
        const pier=State.structures.find(o=>o.id===c.pier);
        if(!pier){s.cmd=null;continue}
        const goal=berthPose(pier,c.side,s.key);
        r=N.drive(s,goal,dt,ships);
        if(r==='arrived'){s.berth={pierId:pier.id,side:c.side};s.pose=goal;s.cmd=null;s.cmdPose=null;s.away=false;S().raise(s.crew.sail);persist();continue}
      }else if(c.kind==='attack'){
        const t=ships.find(o=>o.id===c.target);
        if(!t||t.sunk){s.cmd=null;continue}
        const d=Math.hypot(t.pose.x-s.pose.x,t.pose.y-s.pose.y);
        if(d<=ATTACK_RANGE&&NB&&!NB.active()){s.cmd=null;s.cmdPose=null;NB.start(s,t);continue}
        r=d<=ATTACK_RANGE?'waiting':N.drive(s,{x:t.pose.x,y:t.pose.y},dt,ships.filter(o=>o!==t));
      }
      if(r==='moving'||r==='waiting')S().lower(s.crew.sail);
      if(r==='arrived'||r==='stuck'){if(c.kind==='move'){s.cmd=null;S().raise(s.crew.sail);persist()}}
      s.cmdPose=s.pose;
    }
  }
  // Selection rings under the selected warships (screen-space sprites of the fleet pass).
  function selectionSprites(){
    return selectedShips().map(s=>({x:s.pose.x,y:s.pose.y,z:0,draw:()=>{
      const pts=hull(s.key,s.pose,.35).map(q=>w2sRaw(q,0));
      ctx.save();ctx.strokeStyle='#f4d35e';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.stroke();
      if(s.cmd?.goal){const g=w2sRaw(s.cmd.goal,0);ctx.setLineDash([]);ctx.beginPath();ctx.arc(g.x,g.y,5,0,Math.PI*2);ctx.stroke()}
      ctx.restore();
    }}));
  }
  let frame3d=null;
  const world3d=()=>!!window.ConquerWorld3D?.active?.();
  function drawAll(){
    frame3d=null;
    restore();
    window.ConquerFishers?.syncBoats();
    window.ConquerSeaConvoys?.step();
    const now=(typeof performance!=='undefined'?performance.now():Date.now())/1000;
    // Ships on the slipways of the shipyards (settlement-shipyard.js), and their launch.
    const yards=window.ConquerShipyard?.dynamicMeshes(now)||[];
    if((!ships.length&&!yards.length)||!window.ConquerMesh3D)return;
    const dt=last?Math.min(.1,now-last):0;last=now;
    sync();
    window.ConquerFishers?.step(now);
    window.ConquerSeaConvoys?.step();   // merchant ships of the convoys (settlement-sea-convoys.js)
    commands(dt);                        // the player's warships under orders
    const M3=window.ConquerMesh3D,view=M3.gameView(),meshes=[],sprites=[],NB=window.ConquerNavalBattle,gl=world3d();
    for(const s of ships)C().step(s.crew,dt);
    const fighting=!!NB?.active();
    if(fighting)NB.step(dt);
    // 2.5D only: with every sail at rest the ships (and their piers) are painted once into a
    // cached bitmap and only the flags and sailors are drawn live.
    const still=!gl&&!fighting&&!yards.length&&ships.length&&!ships.some(s=>s.crew.sail.t!==s.crew.sail.target);
    // 2.5D only: ships are painted over the scene, so the piers they lie at are painted again
    // in the same depth sort and a pier in front of a hull still covers it.
    if(!gl)for(const id of new Set(ships.filter(s=>s.berth).map(s=>s.berth.pierId))){
      const pier=State.structures.find(p=>p.id===id);if(pier)meshes.push(...window.ConquerPier.meshes(pier));
    }
    meshes.push(...(window.ConquerFishers?.lotMeshes()||[]),...(window.ConquerFishers?.netMeshes(now)||[]),...yards);
    for(const s of ships){
      const view=seaMotion(s,now),row=s.row==null?null:+s.row.toFixed(2);
      const arms=S().arms(s),key=[view.x,view.y,view.heading,view.z||0,view.roll||0,view.pitch||0,row,s.crew.sail.furl.toFixed(3),JSON.stringify(arms)].join('|');
      if(s.cache?.key!==key)s.cache={key,mesh:S().mesh(s.key,view,s.crew.sail.furl,{sail:arms.sail,flag:null},s.livery,row)};
      // A battle chars, burns and sinks the hull (settlement-naval-battle.js).
      meshes.push(fighting?NB.dress(s,s.cache.mesh):s.cache.mesh);
      s.flags=S().flagMesh(s.key,view,arms.flag,now);
      if(State.view.scale<.3)continue;
      if(fighting)sprites.push(...NB.sprites(s,now));
      for(const sl of C().sailors(s.crew)){
        const w=C().toWorld(view,sl.local),a=C().toWorld(view,sl.local.map((v,i)=>v+(sl.dir[i]||0)));
        if(w.z<-.05)continue;
        sprites.push({...w,draw:()=>{
          const p=w2sRaw(w,w.z),q=w2sRaw(a,a.z);
          withProjectionGroundZ(w.z-.1,()=>C().drawSailor(C().dot(sl.id,{x:w.x,y:w.y}),sl.mode,now,q.x>=p.x?1:-1));
        }});
      }
    }
    sprites.push(...selectionSprites());
    const flags=ships.map(s=>s.flags).filter(Boolean),plank=fighting&&NB.plankMesh();
    if(plank)flags.push(plank);
    if(gl){
      frame3d={meshes:[...meshes,...flags],sprites,view,now,fighting};
      requestDraw();return;
    }
    if(still){
      M3.drawCached(ctx,'fleet',ships.map(s=>s.cache.key).join(';'),()=>meshes,ships[0].pose);
      M3.drawMeshes(ctx,flags,view,sprites);
    }else M3.drawMeshes(ctx,[...meshes,...flags],view,sprites);
    if(fighting)NB.drawOverlay(now);
    // Sailors are always about (and flags wave): with ships afloat, keep frames coming even
    // when the game is paused.
    requestDraw();
  }
  // The frame's ship meshes for the WebGL front pass (settlement-world3d.js drawFront).
  const dynamicMeshes=()=>frame3d?.meshes||[];
  // After the 3D front pass: sailors, soldiers and flames depth-sorted among themselves, then
  // arrows and the foam of a sinking hull.
  function drawFigures(){
    const f=frame3d;if(!f)return;
    f.sprites.sort((a,b)=>f.view.depth(a.x,a.y,a.z)-f.view.depth(b.x,b.y,b.z)).forEach(s=>s.draw());
    if(f.fighting)window.ConquerNavalBattle.drawOverlay(f.now);
  }
  // DEV panel (index.html #devShips).
  function bindDev(){
    const $=id=>document.getElementById(id);if(!$('devShipSpawn'))return;
    const readout=msg=>{$('devShipReadout').textContent=msg||(ships.length?ships.length+' navi · '+ships.map(s=>S().model(s.key).label+(s.berth?' (ormeggiata)':' (alla fonda)')).join(', '):'Nessuna nave')};
    $('devShipSpawn').onclick=()=>{
      const [allegiance,realm]=$('devShipFlag').value.split('|'),s=spawn({key:$('devShipKind').value,allegiance,realm});
      readout(s?null:'Nessun mare su questa mappa: scegli il bioma Mare');
    };
    $('devShipClear').onclick=()=>{clear();readout()};
    $('devShipRaise').onclick=()=>{order('raise');readout()};
    $('devShipLower').onclick=()=>{order('lower');readout()};
    $('devShipBattle').onclick=()=>{
      const [allegiance,realm]=$('devShipFlag').value.split('|'),b=battle({key:$('devShipKind').value,allegiance,realm});
      readout(b?'Battaglia: '+S().model(b.A.key).label+' attacca una nave straniera dello stesso tipo, alla fonda':'Nessun mare su questa mappa: scegli il bioma Mare');
    };
  }
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindDev);else bindDev()}
  // DEV only (to be removed): in the panel of a selected pier, bring a ship to that pier.
  const KINDS=[['barca','Barca da pesca'],['cargo','Barca da carico'],['caravella','Caravella'],['cocca','Cocca'],['nave','Nave latina']];
  const FLAGS=[['merchant|player','Mercantile · nostro regno'],['player|player','Regno del giocatore'],['foreign|azure','Regno d’Azzurro'],['foreign|vert','Regno di Verde'],['foreign|sable','Regno di Nero']];
  function devPierHtml(p){
    const here=ships.filter(s=>s.berth?.pierId===p.id).length;
    return'<div class="slot"><div class="slot-label">DEV · Navi a questo molo</div>'+
      '<select data-dev-pier-kind>'+KINDS.map(([k,l])=>'<option value="'+k+'"'+(k==='cocca'?' selected':'')+'>'+l+'</option>').join('')+'</select>'+
      '<select data-dev-pier-flag>'+FLAGS.map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select>'+
      '<button data-dev-pier-spawn>⚓ Fai arrivare qui</button><button data-dev-pier-clear>Togli da questo molo</button>'+
      '<div class="legend" data-dev-pier-readout>'+here+' / 2 attracchi occupati</div></div>';
  }
  function bindDevPier(root,p){
    const out=root.querySelector('[data-dev-pier-readout]'),count=()=>ships.filter(s=>s.berth?.pierId===p.id).length+' / 2 attracchi occupati';
    root.querySelector('[data-dev-pier-spawn]')?.addEventListener('click',()=>{
      const [allegiance,realm]=root.querySelector('[data-dev-pier-flag]').value.split('|');
      const s=spawn({key:root.querySelector('[data-dev-pier-kind]').value,allegiance,realm,pier:p.id,noAnchor:true});
      if(out)out.textContent=s?count():'Attracchi del molo occupati';
    });
    root.querySelector('[data-dev-pier-clear]')?.addEventListener('click',()=>{
      for(const s of ships.slice())if(s.berth?.pierId===p.id&&!s.fisher)remove(s.id);
      if(out)out.textContent=count();
    });
  }
  window.ConquerFleet=Object.freeze({ships,spawn,hull,overlap,order,clear,remove,persist,restore,battle,selectAt,selectInBox,clearSelection,selectedShips,orderAt,moorSelected,militaryPier,setCommand,commandStep:commands,draw:drawAll,dynamicMeshes,drawFigures,berthPose,anchorPose,devPierHtml,bindDevPier});
})();
