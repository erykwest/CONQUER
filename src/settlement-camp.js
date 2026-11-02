'use strict';
// CONQUER /camp — barracks roster, nocturnal recall and field encampments.
// Uses the Combat Engine's yellow-zone authority and navigable paths.
(function(){
  if(!window.__CONQUER_CAMP_MODE__)return;
  const SQUAD_SIZE=5, SOLDIERS_PER_SLOT=16;
  const units=()=>window.ConquerCombat?.units()||[];
  const locationOf=unit=>({x:unit.x,y:unit.y});
  const night=()=>solarIsNight();
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function barracks(){
    const result=[];
    for(const structure of State.structures){
      if(!['built','tower','gate'].includes(structure.type)||structure.destroyed||underConstruction(structure))continue;
      for(let i=0;i<(structure.functions?.length||0);i++){
        if(structure.functions[i]!=='barracks')continue;
        if(window.ConquerSiege?.allowed&&!window.ConquerSiege.allowed(structure,i,'barracks'))continue;
        const multiplier=typeof functionSlotUnits==='function'?Math.max(1,functionSlotUnits(structure,i)):1;
        result.push({id:structure.id+':'+i,structure,slot:i,
          capacity:Math.max(1,Math.floor(SOLDIERS_PER_SLOT*multiplier/SQUAD_SIZE))});
      }
    }
    return result;
  }
  function entryPoint(room){
    const s=room.structure;
    const center=s.type==='built'&&s.a&&s.b
      ?{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2}
      :{x:s.x,y:s.y};
    const a=s.type==='built'&&s.a&&s.b?Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x):(s.angle||0);
    const dx=-Math.sin(a),dy=Math.cos(a);
    const locations=[];
    for(const pad of [1.7,2.4,3.4,4.5])for(const side of [1,-1])
      locations.push({x:center.x+dx*pad*side,y:center.y+dy*pad*side});
    locations.push(center);
    return locations.find(p=>p.x>1&&p.y>1&&p.x<WORLD-1&&p.y<WORLD-1
      &&window.ConquerCombat.areaState(p).yellow&&!pointBlockedForPeasant(p))||center;
  }
  function getEntry(unit,rooms){
    return rooms.find(b=>b.id===unit.barracksId);
  }
  let focused=null,lastBar='',lastNight=null;
  function synchronize(){
    const tactical=window.ConquerCombat;if(!tactical)return;
    const nowNight=night(),rooms=barracks();let changed=false;
    for(const unit of units()){
      if(!['squad','patrol','knight','captain'].includes(unit.kind)||unit.defeated||unit.routing)continue;
      // White Zone patrols remain active day and night, even beyond Yellow.
      // Recover saved patrols that were incorrectly put into a field camp.
      if(unit.kind==='patrol'){
        if(unit.campState){
          unit.campState=null;unit.campHome=null;
          unit.target=null;unit.path=null;unit.pathIndex=1;unit.nextPatrolAt=0;
          changed=true;
        }
        continue;
      }
      const room=unit.barracksId?getEntry(unit,rooms):null;
      if(!nowNight){
        if(unit.campState){
          if(unit.campState==='returning'){unit.target=null;unit.path=null;unit.pathIndex=1}
          unit.campState=null;unit.campHome=null;changed=true;
        }
        continue;
      }
      if(['camped','barracks','stationed'].includes(unit.campState))continue;
      // A unit already outside the yellow city territory stays where it is.
      if(!tactical.areaState(locationOf(unit)).yellow){
        unit.campState='camped';unit.target=null;unit.path=null;unit.pathIndex=1;
        changed=true;continue;
      }
      // Unassigned squads and knights have no indoor barracks destination;
      // they remain on duty inside Yellow and camp outside it.
      if(!room){if(unit.campState){unit.campState=null;changed=true}continue}
      const home=entryPoint(room);
      if(distance(unit,home)<=.35){
        unit.campState='barracks';unit.campHome=home;unit.target=null;
        unit.path=null;unit.pathIndex=1;changed=true;continue;
      }
      if(unit.campState==='returning'&&unit.target)continue;
      if(tactical.recallCampUnit(unit,home)){
        unit.campState='returning';unit.campHome=home;changed=true;
      }else if(unit.campState!=='stationed'){
        // An obstructed return must never teleport a troop through walls.
        unit.campState='stationed';changed=true;
      }
    }
    if(changed){State.dirty=true;if(typeof scheduleLocalSave==='function')scheduleLocalSave()}
    if(lastNight!==nowNight){lastNight=nowNight;lastBar=''}
  }
  function addSquad(roomId){
    const room=barracks().find(b=>b.id===roomId);
    if(!room)return;
    const assigned=units().filter(u=>u.kind==='squad'&&u.barracksId===roomId&&!u.defeated).length;
    if(assigned>=room.capacity){status('Caserma piena');return}
    const home=entryPoint(room),tactical=window.ConquerCombat;
    if(!State.village.founded){status('Fondare prima un insediamento');return}
    const id='camp-armigeri-'+uid();
    const unit={id,kind:'squad',barracksId:roomId,x:home.x,y:home.y,target:null,experience:0};
    if(night())unit.campState='barracks';
    tactical.units().push(unit);
    tactical.changedCamp();
    lastBar='';updateBar();draw();
  }
  function removeSquad(roomId){
    const roster=units(),idx=roster.findLastIndex(u=>u.kind==='squad'&&u.barracksId===roomId&&!u.defeated);
    if(idx<0)return;
    roster.splice(idx,1);
    window.ConquerCombat.clearCampSelection();
    window.ConquerCombat.changedCamp();
    lastBar='';updateBar();draw();
  }
  const style=document.createElement('style');
  style.textContent='#campBarracksBar{position:fixed;z-index:70;left:50%;bottom:14px;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;max-width:calc(100vw - 32px);padding:6px 9px;border-radius:12px;background:rgba(28,25,21,.94);border:1px solid #a18a69;box-shadow:0 5px 25px #0008;color:#f2e3ca;font:12px system-ui}#campBarracksBar button{white-space:nowrap;min-width:100px;padding:7px 10px}#campBarracksBar button.active{background:#d8b46e;color:#24180f}#campBarracksBar .camp-caption{font-weight:700;letter-spacing:.4px}#campBarracksPanel{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);min-width:230px;padding:10px;background:#241f1a;border:1px solid #a18a69;border-radius:10px;box-shadow:0 5px 22px #0009;text-align:center}#campBarracksPanel[hidden]{display:none}#campBarracksPanel .camp-actions{display:flex;gap:6px;margin-top:9px}#campBarracksPanel .camp-actions button{flex:1;min-width:0}#campBarracksPanel small{display:block;margin-top:6px;color:#c3b39d}@media(max-width:700px){#campBarracksBar{bottom:67px;max-width:calc(100vw - 100px)}#campBarracksBar button{min-width:0}}';
  document.head.appendChild(style);
  const bar=document.createElement('nav');
  bar.id='campBarracksBar';bar.setAttribute('aria-label','Gestione caserme e armigeri');
  bar.innerHTML='<span class="camp-caption">⚔ ARMIGERI</span><div id="campBarracksPanel" hidden></div>';
  document.body.appendChild(bar);
  const panel=bar.querySelector('#campBarracksPanel');
  function updateBar(){
    const rooms=barracks(),roster=units().filter(u=>u.kind==='squad'&&!u.defeated);
    const rows=rooms.map((r,index)=>{
      const count=roster.filter(u=>u.barracksId===r.id).length;
      return {room:r,index,count};
    });
    const fieldCamps=units().filter(u=>u.campState==='camped'&&!u.defeated).length;
    const indoors=units().filter(u=>u.campState==='barracks'&&!u.defeated).length;
    const signature=JSON.stringify({rows:rows.map(r=>[r.room.id,r.room.capacity,r.index,r.count]),focused,night:night(),fieldCamps,indoors});
    if(signature===lastBar)return;
    lastBar=signature;
    for(const item of Array.from(bar.querySelectorAll('[data-camp-toggle],[data-camp-hint],[data-camp-status]')))item.remove();
    if(night()){
      const indicator=document.createElement('span');indicator.dataset.campStatus='';
      indicator.textContent='🏕 '+fieldCamps+' campi · '+indoors+' in caserma';
      bar.insertBefore(indicator,panel);
    }
    for(const row of rows){
      const button=document.createElement('button');
      button.type='button';button.dataset.campToggle=row.room.id;
      button.classList.toggle('active',focused===row.room.id);
      button.textContent='⚔ Armigeri '+(row.index+1)+' · '+row.count+'/'+row.room.capacity;
      button.title='Caserma '+(row.index+1)+' · '+row.count+' truppe di 5 armigeri';
      bar.insertBefore(button,panel);
    }
    if(!rows.some(r=>r.room.id===focused))focused=null;
    if(!rows.length){
      const hint=document.createElement('span');hint.dataset.campHint='';
      hint.textContent='Assegna una stanza Caserma nel castello';
      bar.insertBefore(hint,panel);
    }
    const current=rows.find(r=>r.room.id===focused);
    panel.hidden=!current;
    if(!current)return;
    panel.replaceChildren();
    const heading=document.createElement('strong');
    heading.textContent='Caserma '+(current.index+1)+' · Armigeri';
    const details=document.createElement('small');
    details.textContent=current.count+' / '+current.room.capacity+' truppe · 5 soldati per truppa';
    const actions=document.createElement('div');actions.className='camp-actions';
    const plus=document.createElement('button');plus.type='button';plus.dataset.campAdd=focused;plus.textContent='+ Truppa';plus.disabled=current.count>=current.room.capacity;
    const minus=document.createElement('button');minus.type='button';minus.dataset.campRemove=focused;minus.textContent='− Truppa';minus.disabled=current.count===0;
    actions.append(plus,minus);panel.append(heading,details,actions);
  }
  bar.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.dataset.campAdd){addSquad(button.dataset.campAdd);return}
    if(button.dataset.campRemove){removeSquad(button.dataset.campRemove);return}
    if(button.dataset.campToggle){focused=focused===button.dataset.campToggle?null:button.dataset.campToggle;lastBar='';updateBar()}
  });
  function polygon(g,points,fill,stroke){
    g.beginPath();for(let i=0;i<points.length;i++)i?g.lineTo(points[i].x,points[i].y):g.moveTo(points[i].x,points[i].y);
    g.closePath();g.fillStyle=fill;g.fill();
    if(stroke){g.strokeStyle=stroke;g.lineWidth=Math.max(.7,State.view.scale);g.stroke()}
  }
  function tent(g,u){
    const p={x:u.x-.48,y:u.y-.22},height=terrainElevation(p);
    const a={x:p.x-.55,y:p.y-.4},b={x:p.x+.55,y:p.y-.4};
    const c={x:p.x+.55,y:p.y+.4},d={x:p.x-.55,y:p.y+.4};
    const roofA={x:p.x-.55,y:p.y},roofB={x:p.x+.55,y:p.y};
    const point=(q,z)=>w2sRaw(q,height+z);
    const A=point(a,.02),B=point(b,.02),C=point(c,.02),D=point(d,.02);
    const R=point(roofA,.78),T=point(roofB,.78);
    polygon(g,[A,B,T,R],'#a99a76','#615743');
    polygon(g,[B,C,T],'#746a55','#514633');
    polygon(g,[D,C,T,R],'#c5b38b','#75674d');
    // Entrance seam / tie cord. Flat fill and pitched silhouette use the same camera projection as the castle.
    const mid=point({x:p.x+.55,y:p.y},.02);
    g.strokeStyle='#554637';g.lineWidth=Math.max(.7,State.view.scale);
    g.beginPath();g.moveTo(T.x,T.y);g.lineTo(mid.x,mid.y);g.stroke();
  }
  let bivouacCache={sig:null,camps:[],meshes:[]};
  function drawEncampments(g){
    const campers=units().filter(u=>u.campState==='camped'&&!u.defeated&&
      ['squad','knight','captain'].includes(u.kind));
    if(!campers.length)return;
    // Bivouac layout (ConquerEvents3D.bivouac): pavilion, ridge tents and fires per camp;
    // the old one-tent-per-unit sketch stays as the fallback without the 3D catalog.
    const E=window.ConquerEvents3D,M=window.ConquerMesh3D;
    let fires=campers.map(u=>({x:u.x+.68,y:u.y-.25,id:u.id}));
    const sig=campers.map(u=>u.id+'@'+u.x.toFixed(1)+','+u.y.toFixed(1)).join('|');
    if(E?.bivouac&&M){
      if(bivouacCache.sig!==sig){
        const camps=E.bivouac(campers,{blocked:p=>typeof pointBlockedForPeasant==='function'&&pointBlockedForPeasant(p)}).camps;
        bivouacCache={sig,camps,meshes:E.bivouacMeshes(camps,p=>terrainElevation(p))};
      }
      fires=bivouacCache.camps.flatMap(c=>c.fires);
    }
    withRenderContext(g,()=>{
      if(E?.bivouac&&M)M.drawMeshes(g,bivouacCache.meshes,M.gameView());
      else campers.forEach(u=>tent(g,u));
      for(const f of fires){
        const fire={kind:'brazier',id:f.id+':camp-brazier',
          p:{x:f.x,y:f.y},z:.14,groundZ:terrainElevation(f)};
        drawBrazierFixture(fire);
        const base=w2sRaw(fire.p,fire.groundZ+fire.z+.08);
        const scale=clamp(State.view.scale,.55,1.45);
        const radius=15*scale,gradient=g.createRadialGradient(base.x,base.y,0,base.x,base.y,radius);
        gradient.addColorStop(0,'rgba(255,198,88,.42)');
        gradient.addColorStop(.55,'rgba(242,145,48,.18)');
        gradient.addColorStop(1,'rgba(242,145,48,0)');
        g.save();g.globalCompositeOperation='screen';g.fillStyle=gradient;g.beginPath();g.arc(base.x,base.y,radius,0,Math.PI*2);g.fill();g.restore();
        drawScreenFlame(base,scale,fire.id,true);
      }
    });
  }
  const previousDraw=draw;
  draw=function(){synchronize();updateBar();previousDraw()};
  window.ConquerCamp={synchronize,barracks,addSquad,removeSquad,drawEncampments,updateBar,
    isNight:night};
  synchronize();updateBar();draw();
})();
