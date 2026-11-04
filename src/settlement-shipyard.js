'use strict';
// Cantiere navale: a shipyard is a coast-snapped harbour work like the pier (it is a pier
// with yard:1|2, so it shares placement, footprint, cost and construction hooks) whose
// slipway runs from a yard on land down into the sea. L1 builds the small craft, L2 also the
// large ships. One ship at a time: the lord orders a kind and a flag from the panel (paid at
// once), shipwrights (L1, settlement-economy.js) work it on working days, and on the slipway
// the hull grows in phases (frames, then planking rising to the deck, castles and rig). When
// it is done the ship is launched down the ways and joins the fleet at a free berth (or at
// anchor). Kit from Blender: tools/blender/build_shipyard.py -> src/assets/shipyard-models.js.
(() => {
  const K=()=>window.ConquerShipyardModels,SH=()=>window.ConquerShips,SM=()=>window.ConquerShipModels;
  const WORKERS=3,LAUNCH_TIME=5;
  const LEVELS=Object.freeze({
    1:{reach:7,half:1.1,land:5,shed:1,side:1.6,slip:'slipwayL1',days:12,cost:Object.freeze({gold:120,wood:220,stone:80}),label:'Cantiere navale L1'},
    2:{reach:10,half:2.4,land:12,shed:1.5,side:3.4,crane:true,slip:'slipwayL2',days:20,cost:Object.freeze({gold:260,wood:420,stone:180}),label:'Cantiere navale L2'}
  });
  const SHIPS=Object.freeze({
    barca:{days:6,cost:Object.freeze({gold:40,wood:60})},
    cargo:{days:9,cost:Object.freeze({gold:70,wood:110,metal:4})},
    caravella:{days:15,cost:Object.freeze({gold:160,wood:220,metal:18})},
    cocca:{days:24,cost:Object.freeze({gold:320,wood:420,metal:36})},
    nave:{days:30,cost:Object.freeze({gold:400,wood:520,metal:48})}
  });
  const is=s=>s?.type==='pier'&&!!LEVELS[s.yard];
  const level=s=>LEVELS[s.yard]||LEVELS[1];
  const make=(yard=1)=>({type:'pier',shape:'pier',yard,reach:LEVELS[yard].reach,w:LEVELS[yard].land+LEVELS[yard].reach,h:LEVELS[yard].half*2+4,functions:[]});
  const canBuild=(s,key)=>!!SHIPS[key]&&(s.yard>=2||SH()?.small?.includes(key));
  const toWorld=(s,x,y)=>{const a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);return{x:s.x+x*c-y*sn,y:s.y+x*sn+y*c}};
  const rect=(s,x0,x1,y0,y1)=>[toWorld(s,x0,y0),toWorld(s,x1,y0),toWorld(s,x1,y1),toWorld(s,x0,y1)];
  // The yard on land holds the shed (left of the slip) and a timber pile (right of it).
  const footprint=s=>{const L=level(s);return rect(s,-L.land,L.reach,-(L.half+L.side),L.half+2.6*L.shed)};
  const landing=s=>{const L=level(s);return rect(s,-L.land,0,-(L.half+L.side),L.half+2.6*L.shed)};
  const slipMeta=s=>K()?.models?.[level(s).slip]?.meta||{x0:-4.7,x1:level(s).reach,z0:.1,z1:-.74};

  // Ship on the ways: stern up the ramp, bow to the sea, keel on the blocks; t 0..1 slides it
  // down into the water (launch).
  function shipPose(s,key,g,t=0){
    const m=SM()?.ships?.[key];if(!m)return null;
    // The ramp: gentle on land down to the coastline (zc), steep under water.
    const M=slipMeta(s),zc=M.zc??(M.z0+M.z1)/2,zmin=Math.min(...m.p.filter((_,i)=>i%3===2));
    const zAt=x=>{x=Math.min(x,M.x1);return x<=0?M.z0+(x-M.x0)*(zc-M.z0)/-M.x0:zc+x*(M.z1-zc)/M.x1};
    const start=M.x0+m.L/2+.4,end=M.x1+m.L/2+1.2,cx=start+(end-start)*t*t;
    const zRamp=g+zAt(cx)+.2-zmin,tilt=Math.atan((zAt(cx-m.L/2)-zAt(cx+m.L/2))/m.L);
    // Afloat: the hull settles to the waterline and levels off as it leaves the ways.
    const k=Math.max(0,Math.min(1,(cx-M.x1+m.L/2)/m.L)),z=zRamp*(1-k),pitch=tilt*(1-k);
    const p=toWorld(s,cx,0);
    return{x:p.x,y:p.y,heading:s.angle||0,z,pitch};
  }
  // Hull growing on the ways: frames first, then the planking rising from the keel to the
  // deck and the castles; the rig last (sails furled to the yards).
  function hullMesh(key,pose,progress){
    const m=SM().ships[key],pos=[],col=[];
    const place=(x,y,z)=>{
      const h=pose.heading,c=Math.cos(h),sn=Math.sin(h),p=pose.pitch||0,cp=Math.cos(p),sp=Math.sin(p);
      const x2=x*cp-z*sp,z2=x*sp+z*cp;
      pos.push(pose.x+x2*c-y*sn,pose.y+x2*sn+y*c,(pose.z||0)+z2);
    };
    if(progress<.25){
      const f=K()?.models?.frames;if(!f)return null;
      const kx=m.L/(10/3.5)*.95,ky=m.B/(3.2/3.5)*.95,kz=Math.min(kx,1.2),zmin=Math.min(...m.p.filter((_,i)=>i%3===2));
      const share=.35+progress/.25*.65;
      for(const part of Object.values(f.parts)){
        const n=Math.ceil(part.c.length*share);
        for(let t=0;t<n;t++){for(let q=0;q<3;q++){const j=part.i[t*3+q]*3;place(part.p[j]*kx,part.p[j+1]*ky,zmin+part.p[j+2]*kz)}col.push(K().palette[part.c[t]])}
      }
      return{pos,col};
    }
    // The rig (masts, yards, ropes, iron) is stepped in the last phase, from the deck up.
    const P=SM().palette,keys=SM().paletteKeys||[],RIG=new Set(['mast','rope','iron'].map(k=>keys.indexOf(k)));
    let hz0=Infinity,hz1=-Infinity,rz1=-Infinity;
    for(let t=0;t<m.c.length;t++)for(let q=0;q<3;q++){const z=m.p[m.i[t*3+q]*3+2];if(RIG.has(m.c[t]))rz1=Math.max(rz1,z);else{hz0=Math.min(hz0,z);hz1=Math.max(hz1,z)}}
    const hullTo=hz0+(hz1-hz0)*Math.min(1,(progress-.25)/.5),rigTo=progress<.75?-Infinity:hz0+(rz1-hz0)*Math.min(1,(progress-.75)/.22);
    for(let t=0;t<m.c.length;t++){
      const a=m.i[t*3]*3,b=m.i[t*3+1]*3,c=m.i[t*3+2]*3;
      if(Math.min(m.p[a+2],m.p[b+2],m.p[c+2])>(RIG.has(m.c[t])?rigTo:hullTo))continue;
      for(const j of [a,b,c])place(m.p[j],m.p[j+1],m.p[j+2]);
      col.push(P[m.c[t]]);
    }
    return{pos,col};
  }

  // ---------- the yard
  const cache=new Map();
  function meshes(s,g){
    const kit=K();if(!kit?.models)return[];
    const L=level(s),key=[s.x,s.y,s.angle,g,s.yard].join('|');
    const hit=cache.get(s.id);if(hit&&hit.key===key)return hit.list;
    const pos=[],col=[];
    const put=(models,name,x,y,yaw,z=0,k=1)=>{
      const m=models?.models?.[name];if(!m)return;
      const a=(s.angle||0)+yaw,c=Math.cos(a)*k,sn=Math.sin(a)*k,o=toWorld(s,x,y);
      for(const part of Object.values(m.parts))for(let t=0;t<part.c.length;t++){
        for(let q=0;q<3;q++){const j=part.i[t*3+q]*3,px=part.p[j],py=part.p[j+1];pos.push(o.x+px*c-py*sn,o.y+px*sn+py*c,g+z+part.p[j+2]*k)}
        col.push(models.palette[part.c[t]]);
      }
    };
    put(kit,L.slip,0,0,0);
    // The shed and the timber stand by the ship on the ways (up the ramp); L2 has a treadwheel
    // crane on the other side, its jib over the hull.
    const M=slipMeta(s),mid=M.x0+3.6*L.shed;
    put(kit,'shed',mid,L.half+1.35*L.shed,0,0,L.shed);
    put(window.ConquerConstructionModels,'materialPile',mid+2.8*L.shed,L.half+.9,Math.PI/2);
    if(L.crane)put(window.ConquerConstructionModels,'treadwheelCrane',M.x0+4.2,-(L.half+.9),Math.PI/2,0,1.3);
    else put(window.ConquerConstructionModels,'hoist',mid,-(L.half+.7),0);
    const list=[{pos,col}];
    cache.set(s.id,{key,list});
    return list;
  }
  // The ship on the ways (or being launched): a dynamic mesh of the fleet pass.
  function dynamicMeshes(now){
    const out=[];
    for(const s of State.structures||[]){
      const o=s.shipOrder;if(!is(s)||!o||underConstruction(s))continue;
      const g=Number.isFinite(s.groundZ)?s.groundZ:0;
      if(o.launchAt!=null){
        const t=Math.min(1,(now-o.launchAt)/LAUNCH_TIME);
        if(t>=1){finishLaunch(s);continue}
        const pose=shipPose(s,o.key,g,t),mesh=pose&&SH().mesh(o.key,pose,1,null,o.livery);
        if(mesh)out.push(mesh);
        continue;
      }
      const pose=shipPose(s,o.key,g,0),mesh=pose&&hullMesh(o.key,pose,progress(s));
      if(mesh)out.push(mesh);
    }
    return out;
  }
  const progress=s=>{const o=s.shipOrder;return o?Math.min(1,o.worked/SHIPS[o.key].days):0};
  function order(s,key,allegiance='player'){
    if(!is(s)||underConstruction(s)||s.shipOrder||!canBuild(s,key))return false;
    const cost=SHIPS[key].cost;
    if(typeof canAfford==='function'&&!canAfford(cost))return false;
    if(typeof spendCost==='function'&&!spendCost(cost))return false;
    s.shipOrder={key,allegiance,realm:'player',worked:0,since:State.clock?.day||0,livery:SH()?.livery?.()||null,launchAt:null};
    State.dirty=true;return true;
  }
  // A working day at the yard: progress by the shipwrights on hand, launch when done.
  function daily(staffing={}){
    for(const s of State.structures||[]){
      const o=s.shipOrder;if(!is(s)||!o||o.launchAt!=null)continue;
      o.worked=Math.min(SHIPS[o.key].days,o.worked+(staffing[s.id]||0)/WORKERS);
      if(o.worked>=SHIPS[o.key].days)launch(s);
    }
  }
  const nowSec=()=>(typeof performance!=='undefined'?performance.now():Date.now())/1000;
  function launch(s){const o=s.shipOrder;if(!o||o.launchAt!=null)return false;o.worked=SHIPS[o.key].days;o.launchAt=nowSec();State.dirty=true;return true}
  function finishLaunch(s){
    const o=s.shipOrder;if(!o)return null;
    s.shipOrder=null;
    const ship=window.ConquerFleet?.spawn({key:o.key,allegiance:o.allegiance,realm:o.realm,livery:o.livery});
    State.dirty=true;if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    return ship;
  }
  const demand=()=>(State.structures||[]).filter(s=>is(s)&&s.shipOrder&&s.shipOrder.launchAt==null&&!underConstruction(s));

  const label=s=>level(s).label+' · '+(s.yard>=2?'tutte le navi':'navi piccole');
  const cost=s=>({...level(s).cost});
  const buildDays=s=>level(s).days;
  const shipLabel=k=>SM()?.ships?.[k]?.label||k;
  function panelHtml(s){
    if(underConstruction(s))return'<div class="legend">Lo scalo si apre quando il cantiere è finito.</div>';
    const o=s.shipOrder;
    if(o){
      const p=progress(s),phase=o.launchAt!=null?'Varo':p<.25?'Chiglia e ossatura':p<.5?'Fasciame':p<.75?'Ponte e castelli':'Alberi e sartiame';
      return'<div class="slot"><div class="slot-label">Sullo scalo</div><div class="kv"><span>'+shipLabel(o.key)+'</span><b>'+Math.round(p*100)+'%</b></div>'+
        '<div class="kv"><span>Fase</span><b>'+phase+'</b></div><div class="kv"><span>Giorni di lavoro</span><b>'+o.worked.toFixed(1)+' / '+SHIPS[o.key].days+'</b></div></div>'+
        '<div class="legend">Lavorano fino a '+WORKERS+' carpentieri (L1) nei giorni feriali. Al termine la nave viene varata e va al primo attracco libero.</div>';
    }
    const keys=Object.keys(SHIPS).filter(k=>canBuild(s,k));
    return'<div class="slot"><div class="slot-label">Ordina una nave</div>'+
      '<label class="small">Bandiera <select data-yard-flag><option value="player">Regno del giocatore</option><option value="merchant">Mercantile</option></select></label>'+
      keys.map(k=>'<button data-yard-ship="'+k+'"'+(typeof canAfford==='function'&&!canAfford(SHIPS[k].cost)?' disabled':'')+'>'+shipLabel(k)+'<br><span class="small">'+SHIPS[k].days+'d · '+(typeof costText==='function'?costText(SHIPS[k].cost):'')+'</span></button>').join('')+
      '</div><div class="legend">'+(s.yard>=2?'Scalo grande: tutte le navi.':'Scalo piccolo: barche e caravelle. Il cantiere L2 costruisce anche cocca e nave latina.')+'</div>';
  }
  function bindPanel(root,s){
    root.querySelectorAll('[data-yard-ship]').forEach(b=>b.onclick=()=>{
      const flag=root.querySelector('[data-yard-flag]')?.value||'player';
      if(order(s,b.dataset.yardShip,flag)){
        if(typeof renderFunctionPanel==='function')renderFunctionPanel();
        if(typeof saveLocal==='function')saveLocal();
        if(typeof draw==='function')draw();
      }
    });
  }
  window.ConquerShipyard=Object.freeze({LEVELS,SHIPS,WORKERS,LAUNCH_TIME,is,level,make,canBuild,footprint,landing,slipMeta,shipPose,hullMesh,
    meshes,dynamicMeshes,progress,order,daily,launch,finishLaunch,demand,label,cost,buildDays,panelHtml,bindPanel});
})();
