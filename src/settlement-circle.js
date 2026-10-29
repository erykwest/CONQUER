'use strict';
// /circle integration adapter. Classic script has access to the existing shared
// settlement State/functions; only the topology algorithm is an ES module.
// This module never writes to painted civilian/alarm/safe zone systems.
(function() {
  let topology=null, controlEngine=null, logistics=null, snapshot=null, dirty=true, controlDirty=true;
  let timer=null, lastError=null, revision=0, controlRevision=0, lastControlAt=0;
  const pendingBreachIds=new Set();
  let breachSerial=0, captureHolds={},recaptureHolds={};
  const CAPTURE_DAYS=.5;
  const settings=Object.freeze({cellSize:.25,margin:2});
  const eligible=s=>!!s&&!underConstruction(s)&&!s.destroyed;
  const physicalTypes=new Set(['wall','palisade','built','tower','gate']);
  function fortifications() {
    const out=[];
    for(const s of State.structures) {
      if(!eligible(s))continue;
      // Stone tower/gate ruins remain solid navigation colliders after collapse.
      const standing=physicalTypes.has(s.type);
      const solidRuin=s.type==='ruin'&&['tower','gate'].includes(s.ruinOf);
      if(!standing&&!solidRuin)continue;
      const polygon=footprintPoints(s);
      if(polygon?.length>=3)out.push({id:s.id,polygon});
    }
    return out;
  }
  function invariantNatural() {
    const out=[];
    for(const feature of State.environment||[]) {
      // Rivers, ponds, forests, civic hedges and gentle slopes do not seal rings.
      if(!['sea','mountain'].includes(feature.type)||feature.points?.length<3)continue;
      out.push({id:feature.id,polygon:feature.points});
    }
    return out;
  }
  function naturalBarriers() {
    const out=[];
    for(const level of (State.relief?.hills||[]).flatMap(h=>h.levels||[])) {
      for(const band of reliefEdgeBands(level))if(band.kind==='steep'&&band.poly?.length>=3)
        out.push({id:band.levelId+'-'+band.index,polygon:band.poly});
    }
    return out;
  }
  function naturalCuts() {
    return (window.ConquerTerraforming?.edits?.()||[])
      .filter(edit=>edit.mode==='flat'&&edit.top?.length>=3)
      .map(edit=>({id:edit.id,polygon:edit.top}));
  }
  function terrainBarriers() {
    const out=[];
    const terrain=window.ConquerTerraforming;
    for(const edit of terrain?.edits?.()||[]) {
      const segments=edit.mode==='walled'
        ?(edit.top||[]).flatMap((_,i)=>terrain.exposedWallSegments(edit,i))
        :edit.mode==='flat'?terrain.flatWallSegments(edit):[];
      for(const [index,edge] of segments.entries()) {
        if(!edge?.a||!edge?.b)continue;
        // Thin steep ledges must not disappear between raster cell centres.
        const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy);
        if(L<.01)continue;
        const nx=-dy/L*.12,ny=dx/L*.12;
        out.push({id:edit.id+'-cliff-'+index,polygon:[
          {x:edge.a.x+nx,y:edge.a.y+ny},{x:edge.b.x+nx,y:edge.b.y+ny},
          {x:edge.b.x-nx,y:edge.b.y-ny},{x:edge.a.x-nx,y:edge.a.y-ny}
        ]});
      }
    }
    return out;
  }
  function crossings() {
    return State.structures.filter(s=>s.type==='bridge'&&eligible(s))
      .map(s=>({id:s.id,polygon:footprintPoints(s),open:true}))
      .filter(s=>s.polygon?.length>=3);
  }
  function gates() {
    return State.structures.filter(s=>s.type==='gate'&&eligible(s)).flatMap(g=>{
      const info=gatePassageInfo(g);
      if(!info)return[];
      const shut=window.ConquerSiege?.gateClosed?.(g)||
        window.ConquerGates?.portcullisBlocks?.(g)||
        window.ConquerCrossings?.drawbridgeBlocks?.(info.sideA,g)||
        window.ConquerCrossings?.drawbridgeBlocks?.(info.sideB,g);
      return[{id:g.id,sideA:info.sideA,sideB:info.sideB,open:!shut}];
    });
  }
  // A tower's primary door defines which compartment it serves; do NOT
  // assign by tower centre (inside its solid fortified footprint).
  function mastioEntrance() {
    const keep=State.structures.find(s=>s.type==='tower'&&s.isMastio&&eligible(s));
    if(!keep)return null;
    const front=typeof towerDoorSpecs==='function'
      ?towerDoorSpecs(keep).find(s=>s.kind==='front'):null;
    if(front?.contact&&front?.outward)return{
      x:front.contact.x+front.outward.x*.65,
      y:front.contact.y+front.outward.y*.65
    };
    const a=keep.angle||0,extent=keep.shape==='round'?(Number(keep.r)||.5):(Number(keep.size)||1)/2;
    return{x:keep.x+Math.cos(a)*(extent+.65),y:keep.y+Math.sin(a)*(extent+.65)};
  }
  function collect() {
    return{
      bounds:{minX:BUILD_MIN-settings.margin,minY:BUILD_MIN-settings.margin,
        maxX:BUILD_MAX+settings.margin,maxY:BUILD_MAX+settings.margin},
      cellSize:settings.cellSize,
      fortifications:fortifications(),natural:naturalBarriers(),
      invariantNatural:invariantNatural(),naturalCuts:naturalCuts(),
      terrainBarriers:terrainBarriers(),crossings:crossings(),gates:gates(),
      mastioPoint:mastioEntrance()
    };
  }
  // The same physical wall may border an outer and an inner sector. A hostile
  // on its walkway threatens both sides but occupies neither ground sector.
  function wallAdjacentSectors(unit,locate) {
    const ww=window.ConquerWallWalk;
    const loc=unit.wall||unit.legs?.find(l=>l.kind==='climb')?.toWall||
      (unit.climbing?ww?.locate?.(unit,1.5):null);
    if(!loc||!ww?.frame||!ww?.at)return[];
    const frame=ww.frame(loc),at=ww.at(loc);
    if(!frame||!at)return[];
    const found=new Set(),half=Number(frame.half)||.25;
    for(const side of [-1,1])for(const offset of [half+.45,half+.9,half+1.4]){
      const id=locate({x:at.x+frame.ex*side*offset,y:at.y+frame.ey*side*offset});
      if(id){found.add(id);break}
    }
    return [...found];
  }
  function controlBanner() {
    if(typeof document==='undefined')return;
    const el=document.getElementById('combatCircleStatus');
    if(!el)return;
    const totals=snapshot?.controlSummary;
    if(!snapshot?.compartments?.length)el.textContent='Compartimenti · nessun perimetro difensivo chiuso';
    else if(!totals)el.textContent='Compartimenti · controllo militare in attesa';
    else el.textContent='Compartimenti · '+totals.safe+' sicuri · '+
      totals.invaded+' invasi · '+totals.contested+' contesi · '+
      totals.infiltrated+' infiltrati · '+totals.threatened+' minacciati · '+
      totals.compromised+' compromessi · '+(totals.captured||0)+' conquistati';
    el.dataset.danger=totals?.occupied>0?'1':'0';
  }
  function insidePolygon(p,poly){
    if(!Array.isArray(poly)||poly.length<3)return false;
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a.y>p.y)!==(b.y>p.y)&&
         p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x)inside=!inside;
    }
    return inside;
  }
  function historicalSectorAt(p,sectors) {
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return null;
    for(const c of sectors) {
      const loops=c.boundaries?.length?c.boundaries:[c.polygon];
      if(loops.reduce((contained,loop)=>contained!==insidePolygon(p,loop),false))
        return c.id;
    }
    return null;
  }
  function retainSiegeBreaches(fresh,previous) {
    // Only wall bays lost to a documented SIEGE breach create lost sectors.
    // Player demolition or ordinary editing does not generate ghost territory.
    const ghosts=[];
    for(const old of previous?.compartments||[]) {
      if(!old.breached&&!pendingBreachIds.has(old.id))continue;
      const probes=old.anchors?.length?old.anchors:[old.centroid];
      // When the perimeter is rebuilt, all former interior probes belong to
      // a newly closed region, so the compromised region expires.
      if(old.captureRecordId&&probes.some(p=>p&&fresh.sectorAt(p)))continue;
      if(probes.every(p=>p&&fresh.sectorAt(p)))continue;
      ghosts.push({
        ...old,id:old.breached?old.id:'breached-'+(++breachSerial)+'-'+old.id,
        originId:old.originId||old.id,breached:true,state:'compromised',safe:false
      });
    }
    pendingBreachIds.clear();
    // A captured sector is persisted in the siege save. Restore its footprint
    // even after reload, when the original outer wall has been breached.
    for(const record of window.ConquerSiege?.circleCaptureRecords?.()||[]){
      if(!record?.id||!Array.isArray(record.polygon))continue;
      const probes=record.anchors?.length?record.anchors:[record.centroid];
      const mapped=probes.map(p=>p&&fresh.sectorAt(p));
      // If any successor sector is closed, assign this capture by the
      // majority of its old anchors, without adding an overlapping ghost.
      if(mapped.some(Boolean))continue;
      if(ghosts.some(g=>g.captureRecordId===record.id||
        g.originId===record.originId))continue;
      ghosts.push({
        id:record.id,originId:record.originId,captureRecordId:record.id,
        polygon:record.polygon,boundaries:record.boundaries||[record.polygon],
        anchors:record.anchors||[],depth:record.depth||1,
        breached:true,captured:true,state:'captured',safe:false
      });
    }
    if(!ghosts.length)return fresh;
    ghosts.sort((a,b)=>b.depth-a.depth);
    const locate=fresh.sectorAt;
    return{
      ...fresh,compartments:[...fresh.compartments,...ghosts],
      sectorAt:p=>locate(p)||historicalSectorAt(p,ghosts),
      stats:{...fresh.stats,breachedCompartments:ghosts.length}
    };
  }
  function markBreach(wall,from,to) {
    if(!wall||!from||!to)return;
    const current=getSnapshot();
    if(!current)return;
    const dx=to.x-from.x,dy=to.y-from.y,L=Math.hypot(dx,dy);
    if(L<=1e-6)return;
    const nx=-dy/L,ny=dx/L,half=(Number(wall.width)||.5)/2;
    for(const t of [.25,.5,.75])for(const sign of [-1,1]){
      const p={x:from.x+dx*t,y:from.y+dy*t};
      for(const offset of [half+.45,half+.95,half+1.45]) {
        const id=current.sectorAt({x:p.x+nx*sign*offset,y:p.y+ny*sign*offset});
        if(id){pendingBreachIds.add(id);break}
      }
    }
  }
  function recompute(){
    if(!topology)return null;
    try{
      const fresh=topology.detectDefensiveCompartments(collect());
      snapshot=retainSiegeBreaches(fresh,snapshot);
      lastError=null;dirty=false;controlDirty=true;
      controlBanner();
      // This notification is a read-only integration contract. No gameplay or
      // persistence code is called from detection.
      window.dispatchEvent(new CustomEvent('conquer-circle-updated',{
        detail:{revision,stats:snapshot.stats}
      }));
      return snapshot;
    }catch(error){
      lastError=error;console.warn('CONQUER_CIRCLE_TOPOLOGY_ERROR',error);
      return null;
    }
  }
  function assignCaptureRecords(sectors,locate,records){
    const assigned=new Map(),ids=new Set(sectors.map(c=>c.id));
    for(const record of records){
      let id=sectors.find(c=>c.captureRecordId===record.id)?.id||null;
      if(!id){
        // Old raster indices are not permanent ownership IDs. Vote by
        // multiple saved passable anchors; a newly split compartment must
        // NOT cause one old capture to conquer both successor sectors.
        const votes=new Map();
        for(const p of record.anchors||[]){
          if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
          const key=locate(p);
          if(ids.has(key))votes.set(key,(votes.get(key)||0)+1);
        }
        id=[...votes.entries()].sort((a,b)=>
          b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))[0]?.[0]||null;
      }
      if(!id)continue;
      if(!assigned.has(id))assigned.set(id,[]);
      assigned.get(id).push(record);
    }
    return assigned;
  }
  function updateControl(force=false) {
    if(!topology||!controlEngine)return snapshot;
    if(dirty||!snapshot)recompute();
    if(!snapshot)return null;
    const battle=window.ConquerCombat;
    if(!battle?.units||!battle?.enemy)return snapshot;
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    if(!force&&!controlDirty&&now-lastControlAt<250)return snapshot;
    const previous=new Map(snapshot.compartments.map(c=>[c.id,c.state]));
    try{
      const ui=battle.uiState?.();
      const assessed=controlEngine.assessDefensiveControl({
        compartments:snapshot.compartments,
        sectorAt:snapshot.sectorAt,
        hostiles:battle.enemy(),
        defenders:battle.units(),
        wallSectors:u=>wallAdjacentSectors(u,snapshot.sectorAt),
        alert:ui?.alarm!=='off'&&!!ui?.alarm||!!ui?.alert&&ui.alert!=='clear'
      });
      const captures=window.ConquerSiege?.circleCaptureRecords?.()||[];
      const assignments=assignCaptureRecords(assessed.compartments,
        snapshot.sectorAt,captures);
      const summary={...assessed.summary,captured:0};
      const marked=assessed.compartments.map(sector=>{
        const records=assignments.get(sector.id)||[];
        if(!records.length)return{...sector,captured:false,
          captureRecordId:null,captureRecordIds:[]};
        summary[sector.state]=Math.max(0,(summary[sector.state]||0)-1);
        summary.captured++;
        if(sector.safe){
          summary.safe=Math.max(0,summary.safe-1);
          summary.occupied++;
        }
        return{...sector,state:'captured',safe:false,captured:true,
          captureRecordId:records[0].id,captureRecordIds:records.map(r=>r.id)};
      });
      snapshot={...snapshot,compartments:marked,controlSummary:summary};
      lastControlAt=now;controlDirty=false;
      const transitions=marked.filter(c=>previous.get(c.id)!==c.state)
        .map(c=>({id:c.id,from:previous.get(c.id)||'unassessed',
          to:c.state,groundEnemies:c.control.groundEnemies}));
      controlBanner();
      if(transitions.length){
        controlRevision++;
        window.dispatchEvent(new CustomEvent('conquer-circle-control-updated',{
          detail:{revision:controlRevision,transitions,summary}
        }));
      }
    }catch(error){
      lastError=error;console.warn('CONQUER_CIRCLE_CONTROL_ERROR',error);
    }
    return snapshot;
  }
  function getSnapshot() {
    if(!topology)return null;
    if(dirty||!snapshot)recompute();
    if(controlDirty)updateControl(true);
    return snapshot;
  }
  function tickOccupation(day=State.clock.day) {
    if(!logistics||!window.ConquerSiege||!Number.isFinite(day))return null;
    const current=updateControl();
    if(!current)return null;
    // Called only from the advancing simulation: paused games do not capture.
    const advancing=logistics.advanceCircleOccupation(
      captureHolds,current.compartments,day,CAPTURE_DAYS);
    captureHolds=advancing.holds;
    const events=[];
    for(const id of advancing.confirmed) {
      const sector=current.compartments.find(c=>c.id===id);
      if(!sector)continue;
      const result=window.ConquerSiege.captureCircleSector?.(sector);
      if(result?.ok) {
        events.push({type:'captured',id,lost:result.lost});
        window.dispatchEvent(new CustomEvent('conquer-circle-captured',{
          detail:{id,day,lost:result.lost}
        }));
      }
    }
    if(events.length)updateControl(true);
    const latest=getSnapshot()||current;
    const reclaim=logistics.advanceCircleRecapture(
      recaptureHolds,latest.compartments,day,CAPTURE_DAYS);
    recaptureHolds=reclaim.holds;
    for(const id of reclaim.reclaimed){
      const sector=latest.compartments.find(c=>c.id===id);
      if(!sector?.captureRecordId)continue;
      const records=sector.captureRecordIds?.length?
        sector.captureRecordIds:[sector.captureRecordId];
      let reclaimed=0;
      for(const recordId of records) {
        const result=window.ConquerSiege.releaseCircleSector?.(recordId);
        if(result?.ok)reclaimed++;
      }
      if(reclaimed) {
        events.push({type:'reclaimed',id,records:reclaimed});
        window.dispatchEvent(new CustomEvent('conquer-circle-reclaimed',
          {detail:{id,day,records:reclaimed}}));
      }
    }
    if(events.some(e=>e.type==='reclaimed'))updateControl(true);
    return events;
  }
  function invalidate(reason='topology') {
    revision++;dirty=true;controlDirty=true;
    if(timer!==null)clearTimeout(timer);
    // A run of construction completions / wall fragments is one update.
    timer=setTimeout(()=>{timer=null;recompute()},120);
  }
  function invalidateControl(){controlDirty=true}
  function sectorAt(p){return getSnapshot()?.sectorAt(p)||null}
  function controlState(id){return getSnapshot()?.compartments.find(c=>c.id===id)||null}
  function sectorForStructure(s){
    if(!s)return null;
    if(s.type==='tower'&&s.isMastio)return sectorAt(mastioEntrance());
    if(s.type==='gate'){
      const info=gatePassageInfo(s);
      if(!info)return null;
      return sectorAt(info.sideA)||sectorAt(info.sideB);
    }
    // Depot rooms are in a fortified building: their entrance orientation,
    // not their solid footprint centre, assigns them to a sector.
    if(['tower','built'].includes(s.type)){
      if(s.type==='tower'&&typeof towerDoorSpecs==='function'){
        const spec=towerDoorSpecs(s).find(x=>x.kind==='front');
        if(spec?.contact&&spec?.outward)
          return sectorAt({x:spec.contact.x+spec.outward.x*.65,
            y:spec.contact.y+spec.outward.y*.65});
      }
      if(s.a&&s.b){
        const cx=(s.a.x+s.b.x)/2,cy=(s.a.y+s.b.y)/2;
        const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;
        // A built section has exterior arrow slits and an INTERIOR façade
        // (doors/portico). The flip selects its exterior, so supplies belong
        // to the opposite, accessible side of this fortification.
        const inside=-(typeof wallExteriorSide==='function'
          ?wallExteriorSide(s):(s.flip?-1:1));
        return sectorAt({x:cx-dy/L*inside*.9,
          y:cy+dx/L*inside*.9});
      }
    }
    return s.x!=null&&s.y!=null?sectorAt({x:s.x,y:s.y}):null;
  }
  function nextRefuge(fromId,stateFor=(id)=>{
    const sector=getSnapshot()?.compartments.find(c=>c.id===id);
    return sector?.state||'captured';
  }) {
    const data=getSnapshot();
    return data?topology.findNextCircleRefuge(fromId,data,stateFor):null;
  }
  window.ConquerCircle=Object.freeze({
    invalidate,invalidateControl,markBreach,recompute,updateControl,tickOccupation,getSnapshot,
    distributeStores:(stock,depots,blocked)=>logistics?.distributeCircleStores(stock,depots,blocked),
    captureStores:args=>logistics?.captureCircleStores(args),
    sectorAt,sectorForStructure,controlState,nextRefuge,
    getStatus:()=>({ready:!!topology&&!!controlEngine&&!!logistics,dirty,controlDirty,
      revision,controlRevision,summary:snapshot?.controlSummary||null,
      error:lastError&&String(lastError)})
  });
  Promise.all([
    import('./circle/defensive-topology.mjs?v=circle-2'),
    import('./circle/defensive-control.mjs?v=circle-2'),
    import('./circle/defensive-logistics.mjs?v=circle-2')
  ]).then(([top,control,stores])=>{
    topology=top;controlEngine=control;logistics=stores;
    invalidate('initial');updateControl(true);
  }).catch(err=>{lastError=err;console.error('CONQUER_CIRCLE_IMPORT_ERROR',err)});
})();