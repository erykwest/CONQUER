'use strict';
// /circle integration adapter. Classic script has access to the existing shared
// settlement State/functions; only the topology algorithm is an ES module.
// This module never writes to painted civilian/alarm/safe zone systems.
(function() {
  let topology=null, snapshot=null, dirty=true, timer=null, lastError=null, revision=0;
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
  function naturalBarriers() {
    const out=[];
    for(const feature of State.environment||[]) {
      // Rivers, ponds, forest, civilian hedges and gentle terrain do NOT seal
      // a defensive ring. Mountains/sea are already impassable in world nav.
      if(!['sea','mountain'].includes(feature.type)||feature.points?.length<3)continue;
      out.push({id:feature.id,polygon:feature.points});
    }
    for(const level of (State.relief?.hills||[]).flatMap(h=>h.levels||[])) {
      for(const band of reliefEdgeBands(level))if(band.kind==='steep'&&band.poly?.length>=3)
        out.push({id:band.levelId+'-'+band.index,polygon:band.poly});
    }
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
      crossings:crossings(),gates:gates(),mastioPoint:mastioEntrance()
    };
  }
  function recompute(){
    if(!topology)return null;
    try{
      snapshot=topology.detectDefensiveCompartments(collect());
      lastError=null;dirty=false;
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
  function getSnapshot() {
    if(!topology)return null;
    return dirty||!snapshot?recompute():snapshot;
  }
  function invalidate(reason='topology') {
    revision++;dirty=true;
    if(timer!==null)clearTimeout(timer);
    // A run of construction completions / wall fragments is one update.
    timer=setTimeout(()=>{timer=null;recompute()},120);
  }
  function sectorAt(p){return getSnapshot()?.sectorAt(p)||null}
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
        // Built sections lacking a known entrance have ambiguous membership;
        // don't silently attribute their supplies to an arbitrary side.
        const left=sectorAt({x:cx-dy/L*.9,y:cy+dx/L*.9});
        const right=sectorAt({x:cx+dy/L*.9,y:cy-dx/L*.9});
        return left&&left===right?left:null;
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
    invalidate,recompute,getSnapshot,sectorAt,sectorForStructure,nextRefuge,
    getStatus:()=>({ready:!!topology,dirty,revision,error:lastError&&String(lastError)})
  });
  import('./circle/defensive-topology.mjs?v=circle-1').then(mod=>{
    topology=mod;invalidate('initial');
  }).catch(err=>{lastError=err;console.error('CONQUER_CIRCLE_IMPORT_ERROR',err)});
})();