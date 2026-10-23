'use strict';
// CANS V0.1 skeleton: opt-in, pure logical state. No renderer, movement or economy side effects.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ConquerCANS=api;
})(typeof window!=='undefined'?window:null,function(){
  const SCHEMA_VERSION=1;
  const ROLES=new Set(['worker','guest']);
  const PHASES=['reserved','approaching','entering','traversing','active'];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const required=(value,label)=>{
    if(typeof value!=='string'||!value.trim())throw Error('CANS: invalid '+label);
    return value;
  };
  const number=(value,label)=>{
    if(!Number.isFinite(value))throw Error('CANS: invalid '+label);
    return value;
  };
  function normalizeDomain(raw){
    if(!raw||typeof raw!=='object')throw Error('CANS: invalid domain');
    const id=required(raw.id,'domain id'),type=required(raw.type,'domain type');
    const access=(raw.access||[]).map(a=>({
      id:required(a.id,'access id'),nodeId:required(a.nodeId,'access node')
    }));
    const slots=(raw.slots||[]).map(s=>({
      id:required(s.id,'slot id'),role:required(s.role,'role'),
      nodeId:required(s.nodeId,'slot node'),blocked:!!s.blocked,
      position:s.position==null?null:{x:number(s.position.x,'x'),y:number(s.position.y,'y')},
      itinerary:s.itinerary==null?null:copy(s.itinerary),
      actions:Array.isArray(s.actions)?copy(s.actions):[]
    }));
    if(slots.some(s=>!ROLES.has(s.role)))throw Error('CANS: unsupported slot role');
    const sequences=(raw.sequences||[]).map(seq=>({
      id:required(seq.id,'sequence id'),role:required(seq.role,'sequence role'),
      steps:(seq.steps||[]).map(step=>({
        id:required(step.id,'step id'),slotId:required(step.slotId,'step slot'),
        action:required(step.action,'step action'),
        duration:step.duration==null?null:number(step.duration,'step duration')
      }))
    }));
    if(new Set(sequences.map(seq=>seq.id)).size!==sequences.length||
      sequences.some(seq=>!ROLES.has(seq.role)||!seq.steps.length||
        new Set(seq.steps.map(step=>step.id)).size!==seq.steps.length||
        seq.steps.some(step=>step.duration!==null&&step.duration<0||
          !slots.some(slot=>slot.id===step.slotId&&slot.role===seq.role))))
      throw Error('CANS: invalid activity sequence');
    const nodes=(raw.graph?.nodes||[]).map(n=>({
      id:required(n.id,'node id'),x:number(n.x,'node x'),y:number(n.y,'node y')
    }));
    const edges=(raw.graph?.edges||[]).map(e=>({
      from:required(e.from,'edge from'),to:required(e.to,'edge to'),
      cost:e.cost==null?null:number(e.cost,'edge cost')
    }));
    for(const [name,list] of [['access',access],['slot',slots],['node',nodes]]){
      if(new Set(list.map(x=>x.id)).size!==list.length)throw Error('CANS: duplicate '+name+' id');
    }
    const ids=new Set(nodes.map(n=>n.id));
    if(access.some(a=>!ids.has(a.nodeId))||slots.some(s=>!ids.has(s.nodeId))||
      edges.some(e=>!ids.has(e.from)||!ids.has(e.to)||e.from===e.to||e.cost!==null&&e.cost<=0))
      throw Error('CANS: invalid graph references');
    const transform=raw.transform||{x:0,y:0,rotation:0};
    return{
      schemaVersion:SCHEMA_VERSION,id,type,
      parentId:raw.parentId==null?null:required(raw.parentId,'parent id'),
      carrierId:raw.carrierId==null?null:required(raw.carrierId,'carrier id'),
      layoutRevision:Number.isInteger(raw.layoutRevision)&&raw.layoutRevision>=0?raw.layoutRevision:0,
      transform:{x:number(transform.x,'transform x'),y:number(transform.y,'transform y'),
        rotation:number(transform.rotation,'rotation')},
      access,slots,sequences,graph:{nodes,edges}
    };
  }
  function localRoute(domain,slotId,externalCost){
    const slot=domain.slots.find(s=>s.id===slotId);
    if(!slot||slot.blocked)return null;
    const nodes=new Map(domain.graph.nodes.map(n=>[n.id,n]));
    const adj=new Map([...nodes.keys()].map(id=>[id,[]]));
    for(const edge of domain.graph.edges){
      const a=nodes.get(edge.from),b=nodes.get(edge.to);
      const cost=edge.cost??Math.hypot(a.x-b.x,a.y-b.y);
      if(cost<=0)continue;
      adj.get(a.id).push({id:b.id,cost});adj.get(b.id).push({id:a.id,cost});
    }
    let best=null;
    for(const access of domain.access){
      const extra=externalCost?externalCost(copy(access)):0;
      if(!Number.isFinite(extra)||extra<0)continue;
      const dist=new Map([[access.nodeId,0]]),prev=new Map(),visited=new Set();
      while(true){
        let node=null,min=Infinity;
        for(const [id,d] of dist)if(!visited.has(id)&&d<min){min=d;node=id}
        if(node===null||node===slot.nodeId)break;
        visited.add(node);
        for(const next of adj.get(node)||[]){
          const value=min+next.cost;
          if(value<(dist.get(next.id)??Infinity)){dist.set(next.id,value);prev.set(next.id,node)}
        }
      }
      if(!dist.has(slot.nodeId))continue;
      const path=[slot.nodeId];
      while(path[0]!==access.nodeId)path.unshift(prev.get(path[0]));
      const cost=dist.get(slot.nodeId)+extra;
      if(!best||cost<best.cost)best={accessId:access.id,slotId,path,cost};
    }
    return best;
  }
  function createEngine({clock=()=>Date.now()}={}){
    const domains=new Map(),assignments=new Map();
    let sequence=0;
    const now=()=>number(clock(),'clock');
    const getDomain=id=>domains.get(id);
    const requireDomain=id=>{const d=domains.get(id);if(!d)throw Error('CANS: missing domain '+id);return d};
    const entity=key=>required(key,'entity id');
    const snapshotAssignment=id=>assignments.has(id)?copy(assignments.get(id)):null;
    function isLocked(domainId,slotId,ignoreEntity=null){
      for(const [id,a] of assignments){
        if(id===ignoreEntity)continue;
        if(a.domainId===domainId&&a.slotId===slotId||
          a.pending?.domainId===domainId&&a.pending.slotId===slotId)return true;
      }
      return false;
    }
    function available(domainId,slotId,role,exclude=null){
      const d=domains.get(domainId),s=d?.slots.find(s=>s.id===slotId);
      return !!(s&&!s.blocked&&(!role||s.role===role)&&!isLocked(domainId,slotId,exclude)&&localRoute(d,slotId));
    }
    function choose(domainId,{role,externalCost}={}){
      const d=requireDomain(domainId);
      for(const s of d.slots){
        if(role&&s.role!==role||!available(domainId,s.id,role))continue;
        const route=localRoute(d,s.id,externalCost);
        if(route)return copy({...route,role:s.role});
      }
      return null;
    }
    function route(domainId,slotId,externalCost){
      return copy(localRoute(requireDomain(domainId),slotId,externalCost));
    }
    function addDomain(raw){
      const d=normalizeDomain(raw);
      if(domains.has(d.id))throw Error('CANS: domain already exists');
      domains.set(d.id,d);return copy(d);
    }
    function updateDomain(raw){
      const d=normalizeDomain(raw),old=requireDomain(d.id);
      d.layoutRevision=Math.max(old.layoutRevision+1,d.layoutRevision);
      domains.set(d.id,d);
      let released=0;
      for(const [id,a] of assignments){
        if(a.domainId===d.id&&!available(a.domainId,a.slotId,null,id)){
          assignments.delete(id);released++;continue;
        }
        if(a.domainId===d.id){
          const before=old.slots.find(s=>s.id===a.slotId),after=d.slots.find(s=>s.id===a.slotId);
          if(!before||!after||before.role!==after.role||
            before.nodeId!==after.nodeId||JSON.stringify(before.position)!==JSON.stringify(after.position)){
            assignments.delete(id);released++;continue
          }
          if(a.sequenceId){
            const seq=d.sequences.find(seq=>seq.id===a.sequenceId);
            const current=seq?.steps[a.stepIndex]?.slotId;
            if(!seq||current!==a.slotId&&current!==a.pending?.slotId){
              a.sequenceId=null;a.stepIndex=0;
            }
          }
        }
        if(a.pending?.domainId===d.id&&!available(d.id,a.pending.slotId,null,id))a.pending=null;
      }
      return {domain:copy(d),released};
    }
    function removeDomain(id){
      if(!domains.delete(id))return false;
      for(const [entityId,a] of assignments){
        if(a.domainId===id)assignments.delete(entityId);
        else if(a.pending?.domainId===id)a.pending=null;
      }
      return true;
    }
    function occupancy(domainId,slotId){
      const d=requireDomain(domainId),s=d.slots.find(s=>s.id===slotId);
      if(!s)throw Error('CANS: unknown slot');
      if(s.blocked)return{state:'suspended',entityId:null};
      for(const [entityId,a] of assignments){
        if(a.domainId===domainId&&a.slotId===slotId)
          return{state:a.phase==='active'?'occupied':'reserved',entityId};
        if(a.pending?.domainId===domainId&&a.pending.slotId===slotId)
          return{state:'reserved',entityId};
      }
      return{state:'available',entityId:null};
    }
    function reserve(entityId,domainId,slotId,{ttl=60000,externalCost,role}={}){
      entity(entityId);if(assignments.has(entityId))throw Error('CANS: entity already assigned');
      if(!available(domainId,slotId,role))throw Error('CANS: slot unavailable or unreachable');
      const path=localRoute(requireDomain(domainId),slotId,externalCost);
      if(!path)throw Error('CANS: no reachable access');
      if(!Number.isFinite(ttl)||ttl<=0)throw Error('CANS: invalid ttl');
      const token='cans:'+ ++sequence;
      const record={domainId,slotId,phase:'reserved',token,
        accessId:path.accessId,expiresAt:now()+ttl,pending:null,sequenceId:null,stepIndex:0};
      assignments.set(entityId,record);return{token,route:copy(path)};
    }
    function advance(entityId,token,phase){
      const a=assignments.get(entity(entityId));
      if(!a||a.token!==token)throw Error('CANS: invalid assignment token');
      const current=PHASES.indexOf(a.phase),next=PHASES.indexOf(phase);
      if(next!==current+1)throw Error('CANS: invalid phase transition');
      if(!available(a.domainId,a.slotId,null,entityId))throw Error('CANS: destination invalidated');
      a.phase=phase;
      if(phase==='active')a.expiresAt=null;
      return snapshotAssignment(entityId);
    }
    function startSequence(entityId,sequenceId){
      const a=assignments.get(entity(entityId));
      if(!a||a.phase!=='active'||a.sequenceId)throw Error('CANS: sequence requires idle active slot');
      const d=requireDomain(a.domainId),seq=d.sequences.find(s=>s.id===sequenceId);
      const slot=d.slots.find(s=>s.id===a.slotId);
      if(!seq||!slot||seq.role!==slot.role||seq.steps[0].slotId!==a.slotId)
        throw Error('CANS: sequence first slot mismatch');
      a.sequenceId=seq.id;a.stepIndex=0;
      return copy(seq.steps[0]);
    }
    function advanceSequence(entityId){
      const a=assignments.get(entity(entityId));
      if(!a||a.phase!=='active'||!a.sequenceId||a.pending)throw Error('CANS: no active sequence');
      const d=requireDomain(a.domainId),seq=d.sequences.find(s=>s.id===a.sequenceId);
      const step=seq?.steps[a.stepIndex];
      if(!step||step.slotId!==a.slotId)throw Error('CANS: next sequence step requires traversal');
      a.stepIndex++;
      if(a.stepIndex===seq.steps.length){
        a.sequenceId=null;a.stepIndex=0;
        return {completed:true,nextStep:null};
      }
      const next=seq.steps[a.stepIndex];
      return{completed:false,nextStep:copy(next),requiresTransfer:next.slotId!==a.slotId};
    }
    function startTransfer(entityId,domainId,slotId,{ttl=60000,externalCost}={}){
      const a=assignments.get(entity(entityId));
      if(!a||a.phase!=='active'||a.pending)throw Error('CANS: transfer requires an active assignment');
      if(!available(domainId,slotId))throw Error('CANS: target slot unavailable');
      const path=localRoute(requireDomain(domainId),slotId,externalCost);
      if(!path)throw Error('CANS: no reachable transfer');
      if(!Number.isFinite(ttl)||ttl<=0)throw Error('CANS: invalid ttl');
      const token='cans:'+ ++sequence;
      a.pending={domainId,slotId,phase:'reserved',token,accessId:path.accessId,expiresAt:now()+ttl};
      return{token,route:copy(path)};
    }
    function advanceTransfer(entityId,token,phase){
      const a=assignments.get(entity(entityId)),p=a?.pending;
      if(!p||p.token!==token||PHASES.indexOf(phase)!==PHASES.indexOf(p.phase)+1||
        phase==='active')throw Error('CANS: invalid transfer transition');
      if(!available(p.domainId,p.slotId,null,entityId))throw Error('CANS: transfer target invalid');
      p.phase=phase;return snapshotAssignment(entityId);
    }
    function completeTransfer(entityId,token){
      const a=assignments.get(entity(entityId)),p=a?.pending;
      if(!p||p.token!==token||p.phase!=='traversing')throw Error('CANS: transfer not traversed');
      if(!available(p.domainId,p.slotId,null,entityId))throw Error('CANS: transfer target invalid');
      Object.assign(a,{domainId:p.domainId,slotId:p.slotId,phase:'active',
        token:p.token,accessId:p.accessId,expiresAt:null,pending:null});
      return snapshotAssignment(entityId);
    }
    function cancel(entityId){return assignments.delete(entity(entityId))}
    function cancelTransfer(entityId){
      const a=assignments.get(entity(entityId));
      if(!a?.pending)return false;
      a.pending=null;return true;
    }
    function expire(at=now()){
      let count=0;
      for(const [id,a] of assignments){
        if(a.phase!=='active'&&a.expiresAt<=at){assignments.delete(id);count++;continue}
        if(a.pending&&a.pending.expiresAt<=at){a.pending=null;count++}
      }
      return count;
    }
    function serialize(){
      return copy({schemaVersion:SCHEMA_VERSION,sequence,
        domains:[...domains.values()],assignments:[...assignments].map(([entityId,a])=>({entityId,...a}))});
    }
    function restore(raw,{entityExists=()=>true,parentExists=()=>true}={}){
      if(raw==null)return{domains:0,assignments:0,discarded:0}; // legacy saves: opt-in
      if(raw.schemaVersion!==SCHEMA_VERSION)throw Error('CANS: unsupported schema version');
      const incoming=new Map(),records=new Map(),at=now();
      for(const item of raw.domains||[]){
        const d=normalizeDomain(item);
        if(incoming.has(d.id))throw Error('CANS: duplicate stored domain');
        if(d.parentId!==null&&!parentExists(d.parentId))continue;
        incoming.set(d.id,d);
      }
      let discarded=0;
      for(const item of raw.assignments||[]){
        const id=item.entityId;
        if(typeof id!=='string'||!id||records.has(id)||!entityExists(id)){discarded++;continue}
        const d=incoming.get(item.domainId),s=d?.slots.find(s=>s.id===item.slotId);
        const valid=d&&s&&!s.blocked&&PHASES.includes(item.phase)&&
          (item.phase==='active'||Number.isFinite(item.expiresAt)&&item.expiresAt>at)&&
          localRoute(d,s.id);
        if(!valid){discarded++;continue}
        const occupied=[...records.values()].some(a=>a.domainId===d.id&&a.slotId===s.id||
          a.pending?.domainId===d.id&&a.pending.slotId===s.id);
        if(occupied){discarded++;continue}
        const a={domainId:d.id,slotId:s.id,phase:item.phase,
          token:required(item.token,'restored token'),accessId:item.accessId,
          expiresAt:item.phase==='active'?null:item.expiresAt,pending:null,sequenceId:null,stepIndex:0};
        const seq=d.sequences.find(seq=>seq.id===item.sequenceId);
        if(item.phase==='active'&&seq&&Number.isInteger(item.stepIndex)&&
          item.stepIndex>=0&&item.stepIndex<seq.steps.length&&
          (seq.steps[item.stepIndex].slotId===item.slotId||item.pending?.slotId===seq.steps[item.stepIndex].slotId)){
          a.sequenceId=seq.id;a.stepIndex=item.stepIndex;
        }else if(item.sequenceId)discarded++;
        const p=item.pending,dp=incoming.get(p?.domainId),sp=dp?.slots.find(s=>s.id===p.slotId);
        if(p&&dp&&sp&&!sp.blocked&&PHASES.includes(p.phase)&&p.phase!=='active'&&
          Number.isFinite(p.expiresAt)&&p.expiresAt>at&&localRoute(dp,sp.id)&&
          !(dp.id===d.id&&sp.id===s.id)&&
          ![...records.values()].some(r=>r.domainId===dp.id&&r.slotId===sp.id||
            r.pending?.domainId===dp.id&&r.pending.slotId===sp.id)){
          a.pending={domainId:dp.id,slotId:sp.id,phase:p.phase,token:p.token,
            accessId:p.accessId,expiresAt:p.expiresAt};
        }else if(p)discarded++;
        if(a.sequenceId&&seq.steps[a.stepIndex].slotId!==a.slotId&&
          (!a.pending||a.pending.slotId!==seq.steps[a.stepIndex].slotId)){
          a.sequenceId=null;a.stepIndex=0;discarded++;
        }
        records.set(id,a);
      }
      domains.clear();for(const [id,d] of incoming)domains.set(id,d);
      assignments.clear();for(const [id,a] of records)assignments.set(id,a);
      sequence=Math.max(Number.isSafeInteger(raw.sequence)?raw.sequence:0,records.size);
      return{domains:domains.size,assignments:assignments.size,discarded};
    }
    function worldPoint(domainId,local){
      const t=requireDomain(domainId).transform;
      const c=Math.cos(t.rotation),s=Math.sin(t.rotation);
      return{x:t.x+local.x*c-local.y*s,y:t.y+local.x*s+local.y*c};
    }
    return Object.freeze({addDomain,updateDomain,removeDomain,getDomain:id=>getDomain(id)?copy(getDomain(id)):null,
      listDomains:()=>[...domains.keys()],route,choose,reserve,advance,occupancy,
      startSequence,advanceSequence,startTransfer,advanceTransfer,completeTransfer,cancel,cancelTransfer,expire,
      getAssignment:snapshotAssignment,serialize,restore,worldPoint});
  }
  return Object.freeze({SCHEMA_VERSION,normalizeDomain,createEngine});
});
