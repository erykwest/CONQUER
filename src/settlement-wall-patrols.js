'use strict';
// CONQUER wall patrols (MIL-WALL-01, decision D-MIL-WALL-261115).
// A wall patrol belongs to a whole ring of walls (giro di mura), not to one wall segment:
//  - A ring is one connected piece of the wall-walk network (settlement-wallwalk.js): T2+ walls and
//    palisades joined end to end or through the towers and gates they are seated on.
//  - Each patrol is two soldiers of the Barracks reserve (ConquerSoldiers.PATROL_MEN), walking the
//    whole ring one behind the other; N patrols on a ring are spaced evenly along it. A closed ring is
//    walked round and round, an open stretch (or one with spurs) out and back.
//  - The player assigns them per ring (Control centre > Military > Patrols and garrisons, or the wall
//    inspector). A new ring starts with none. The reserve covers wall patrols after the White Zone
//    patrols; those it no longer covers go back to the Barracks.
//  - The assignment is saved with the reserve (State.siege.soldiers.wallPatrols) as the ids of the walls
//    of the ring, so it survives a breach (the other walls keep their ids) and two rings that are joined
//    add up. While a ring is not walkable (all of it under construction) its patrols wait in the Barracks
//    and do not hold soldiers.
(function(){
  const SPEED=10;          // U walked per visual day (one day = 48 s at speed 1): about 0.2 U/s
  const FILE_GAP=.34;      // the second man walks this far behind the first
  const MAX_PER_U=1/4;     // at most one patrol every 4U of ring (and at least one per ring)
  const WW=()=>window.ConquerWallWalk,M=()=>window.ConquerSoldiers,S=()=>window.ConquerSiege;
  const men=()=>M()?.PATROL_MEN||2;
  const n=v=>Math.max(0,Math.floor(Number(v)||0));
  const say=t=>{if(typeof status==='function')status(t)};

  // ---------- saved assignment
  function store(){
    const x=S()?.state?.()?.soldiers;if(!x)return null;
    if(!Array.isArray(x.wallPatrols))x.wallPatrols=[];
    return x.wallPatrols;
  }

  // ---------- rings (one per connected piece of the wall-walk network)
  let ringCache={graph:null,list:[]};
  function rings(){
    const g=WW()?.graph?.();if(!g)return[];
    if(ringCache.graph===g&&ringCache.edges===g.edges)return ringCache.list;
    const byComp=new Map();
    for(const e of g.edges){
      const c=e.A.comp;
      if(!byComp.has(c))byComp.set(c,{comp:c,edges:[]});
      byComp.get(c).edges.push(e);
    }
    const list=[...byComp.values()].map(r=>{
      const walls=r.edges.map(e=>String(e.wall.id)).sort();
      const nodes=g.nodes.filter(m=>m.comp===r.comp);
      const links=nodes.reduce((t,m)=>t+m.adj.length,0)/2;
      const length=r.edges.reduce((t,e)=>t+e.len,0);
      return{id:'ring:'+walls[0],comp:r.comp,walls,edges:r.edges,nodes,length,
        closed:links>=nodes.length,max:Math.max(1,Math.floor(length*MAX_PER_U))};
    }).sort((a,b)=>b.length-a.length||a.id.localeCompare(b.id));
    list.forEach((r,i)=>{r.index=i+1});
    ringCache={graph:g,edges:g.edges,list};
    return list;
  }
  const ringOf=id=>rings().find(r=>r.id===String(id))||null;
  const ringOfWall=wallId=>rings().find(r=>r.walls.includes(String(wallId)))||null;

  // Saved entries -> patrols wanted per live ring. An entry goes to the ring holding most of its walls;
  // entries of rings that are not walkable right now stay dormant.
  function wantedByRing(){
    const list=store(),out=new Map();if(!list)return out;
    const byWall=new Map();for(const r of rings())for(const w of r.walls)byWall.set(w,r);
    for(const entry of list){
      const votes=new Map();
      for(const w of entry?.walls||[]){const r=byWall.get(String(w));if(r)votes.set(r,(votes.get(r)||0)+1)}
      let best=null;for(const [r,v] of votes)if(!best||v>best[1])best=[r,v];
      if(best)out.set(best[0].id,(out.get(best[0].id)||0)+n(entry.n));
    }
    return out;
  }
  // Rewrite the saved list: one entry per live ring with patrols, with that ring's current walls.
  // Dormant entries are kept while any of their walls still stands.
  function write(byRing){
    const list=store();if(!list)return;
    const live=rings(),byWall=new Map();for(const r of live)for(const w of r.walls)byWall.set(w,r);
    const ids=new Set(State.structures.map(s=>String(s.id)));
    const dormant=list.filter(e=>n(e?.n)>0&&!(e.walls||[]).some(w=>byWall.has(String(w)))&&(e.walls||[]).some(w=>ids.has(String(w))));
    const next=[...live.filter(r=>n(byRing.get(r.id))>0).map(r=>({walls:r.walls.slice(),n:n(byRing.get(r.id))})),
      ...dormant.map(e=>({walls:e.walls.map(String),n:n(e.n)}))];
    list.splice(0,list.length,...next);
  }
  function wanted(){let t=0;for(const v of wantedByRing().values())t+=v;return t}
  const touch=()=>{
    M()?.invalidate?.();
    if(typeof markDirty==='function')markDirty(false,false,true);
    if(typeof renderFunctionPanel==='function')renderFunctionPanel();
    if(typeof draw==='function')draw();
  };

  // ---------- player commands
  function set(ringId,count){
    const r=ringOf(ringId);if(!r){say('No ring of walls to patrol here');return false}
    const by=wantedByRing(),cur=n(by.get(r.id));
    count=Math.min(r.max,n(count));
    if(count===cur)return false;
    if(count>cur){
      const free=M()?.free?.()??0,can=Math.floor(free/men());
      if(can<=0){say('A wall patrol takes '+men()+' free soldiers: enlist them in the Barracks');return false}
      count=Math.min(count,cur+can);
    }
    by.set(r.id,count);write(by);touch();
    say('Ring of walls '+r.index+' · '+count+' patrol'+(count===1?'':'s')+' ('+count*men()+' soldiers)');
    return true;
  }
  function adjust(ringId,delta){
    const r=ringOf(ringId);if(!r)return false;
    return set(r.id,n(wantedByRing().get(r.id))+Math.sign(Number(delta)||0));
  }
  // The reserve no longer covers k wall patrols: they come off the smallest rings first.
  function trim(k){
    k=n(k);if(!k)return 0;
    const by=wantedByRing(),order=rings().slice().reverse();let done=0;
    for(const r of order){
      while(done<k&&n(by.get(r.id))>0){by.set(r.id,n(by.get(r.id))-1);done++}
      if(done>=k)break;
    }
    if(done){write(by);M()?.invalidate?.();if(typeof renderFunctionPanel==='function')renderFunctionPanel()}
    return done;
  }
  // Keep the saved walls in step with breaches, joins and demolitions.
  function sync(){if(store()?.length)write(wantedByRing())}

  // ---------- the round each ring is walked on
  const linkKey=(a,l)=>l.edge?'e'+l.edge.id:'h'+Math.min(a.id,l.to.id)+'-'+Math.max(a.id,l.to.id);
  function steps(r){
    const ends=r.nodes.filter(m=>m.adj.length===1);
    const start=ends[0]||r.edges[0].A,out=[];
    if(r.nodes.every(m=>m.adj.length===2)){
      // A plain ring: once round.
      let at=start,from=null;
      for(let guard=0;guard<=r.nodes.length;guard++){
        const l=at.adj.find(x=>x.to!==from)||at.adj[0];
        out.push({from:at,to:l.to,edge:l.edge});from=at;at=l.to;
        if(at===start)break;
      }
      return out;
    }
    // Stretches, spurs, crossings: every link out and back (depth first).
    const used=new Set(),seen=new Set([start]);
    const visit=m=>{
      for(const l of m.adj){
        const k=linkKey(m,l);if(used.has(k))continue;used.add(k);
        out.push({from:m,to:l.to,edge:l.edge});
        if(!seen.has(l.to)){seen.add(l.to);visit(l.to)}
        out.push({from:l.to,to:m,edge:l.edge});
      }
    };
    visit(start);
    return out;
  }
  function hubRadius(h){
    if(h.type==='tower')return h.shape==='round'?(Number(h.r)||.75):(Number(h.size)||1.5)/2;
    if(h.type==='gate'&&typeof rectDims==='function'){const d=rectDims(h);return Math.max(d.w,d.h)/2}
    return typeof pointRadius==='function'?pointRadius(h):.75;
  }
  const circuitCache=new Map();
  function circuit(r){
    const g=WW()?.graph?.(),key=r.id;
    const hit=circuitCache.get(key);if(hit&&hit.graph===g&&hit.ring===r)return hit;
    const legs=[];let total=0;
    for(const s of steps(r)){
      const len=Math.hypot(s.to.x-s.from.x,s.to.y-s.from.y);if(len<1e-6)continue;
      const forward=s.edge?s.from===s.edge.A:true;
      legs.push({...s,forward,len,at:total});total+=len;
    }
    const hubs=r.nodes.filter(m=>m.key?.startsWith('hub:')).map(m=>{
      const h=State.structures.find(x=>'hub:'+x.id===m.key);return h?{x:h.x,y:h.y,r:hubRadius(h)+.04}:null;
    }).filter(Boolean);
    const c={graph:g,ring:r,legs,total,hubs};
    if(circuitCache.size>64)circuitCache.clear();
    circuitCache.set(key,c);return c;
  }
  // Where a man is at distance d along the round: {x,y,z} or null while he is inside a tower or gate.
  function pointAt(c,d){
    if(!c.total)return null;
    d=((d%c.total)+c.total)%c.total;
    let lo=0,hi=c.legs.length-1;
    while(lo<hi){const mid=(lo+hi+1)>>1;if(c.legs[mid].at<=d)lo=mid;else hi=mid-1}
    const leg=c.legs[lo],k=Math.max(0,Math.min(1,(d-leg.at)/leg.len));
    if(!leg.edge)return null;                                    // through a tower or gate: out of sight
    const t=leg.forward?k:1-k,p=WW().at({edge:leg.edge,t});
    if(!p||c.hubs.some(h=>Math.hypot(p.x-h.x,p.y-h.y)<h.r))return null;
    return p;
  }
  // Men on duty, for drawing and tests: [{x,y,z,id,phase,ringId}].
  function positions(day=typeof peasantVisualDay==='function'?peasantVisualDay():0){
    const out=[],covered=M()?.roster?.()?.wallPatrolsCovered;
    let left=Number.isFinite(covered)?covered:Infinity;
    const by=wantedByRing();
    for(const r of rings()){
      const k=Math.min(n(by.get(r.id)),left);left-=k;if(!k)continue;
      const c=circuit(r);if(!c.total)continue;
      const seed=((typeof peasantHash==='function'?peasantHash(r.id):0)%1000)/1000*c.total;
      for(let i=0;i<k;i++){
        const lead=day*SPEED+seed+i*c.total/k;
        for(let m=0;m<men();m++){
          const p=pointAt(c,lead-m*FILE_GAP);if(!p)continue;
          out.push({x:p.x,y:p.y,z:p.z,id:r.id+':patrol:'+i+':'+m,phase:day*1.44+i*.5+m*.27,ringId:r.id});
        }
      }
    }
    return out;
  }
  function draw(){
    if(typeof drawSoldierFigure!=='function')return;
    for(const p of positions()){
      if(typeof worldPointVisible==='function'&&!worldPointVisible(p,p.z,48))continue;
      drawSoldierFigure({x:p.x,y:p.y},p.z,'spearman',p.id,p.phase);
    }
  }

  // ---------- panels
  function summary(){
    const by=wantedByRing(),r=M()?.roster?.(),freeMen=M()?.free?.()??0;
    let left=Number.isFinite(r?.wallPatrolsCovered)?r.wallPatrolsCovered:Infinity;
    const list=rings().map(x=>{
      const patrols=n(by.get(x.id)),covered=Math.min(patrols,left);left-=covered;
      return{id:x.id,index:x.index,label:'Giro di mura '+x.index,walls:x.walls.length,length:x.length,
        closed:x.closed,patrols,covered,max:x.max};
    });
    const f=shortfall();
    return{rings:list,patrols:list.reduce((t,x)=>t+x.patrols,0),covered:list.reduce((t,x)=>t+x.covered,0),
      men:men(),free:freeMen,canAdd:Math.floor(freeMen/men())>0,
      shortfall:f?{...f,text:shortfallText(f)}:null};
  }
  // Inspector of a wall or palisade: its ring and a 0..max choice.
  function wallControl(wall){
    const r=wall&&ringOfWall(wall.id);if(!r)return null;
    const cur=n(wantedByRing().get(r.id)),can=Math.floor((M()?.free?.()??0)/men());
    const top=Math.min(r.max,6);
    return{ring:r,current:cur,
      options:Array.from({length:Math.max(top,cur)+1},(_,v)=>({value:v,label:String(v),disabled:v>cur+can})),
      fact:'Giro '+r.index+' · '+(r.closed?'chiuso':'aperto')+' · '+r.walls.length+' tratti · '+(Math.round(r.length*10)/10).toString().replace('.',',')+'U'};
  }

  // Soldiers missing for one more wall patrol, and what enlisting them costs (Barracks reserve).
  function shortfall(){
    const S=M();if(!S)return null;
    const free=S.free?.()??0,need=Math.max(0,men()-free);
    if(!need)return null;
    const room=Math.max(0,(S.posts?.()??0)-(S.enlisted?.()??0)),people=S.enlistable?.()??0;
    const cost=need*(S.RECRUIT_COST?.gold||15);
    let why='';
    if(!S.paid?.())why='i soldati non sono pagati: serve oro nel castello';
    else if(room<need)why='Caserma piena: assegna altre stanze Caserma';
    else if(people<need)why='nessun uomo L1 da arruolare';
    return{free,need,cost,why,can:!why};
  }
  // Enlist the soldiers one more wall patrol needs (15 gold each, like the Barracks button).
  function enlistForPatrol(){
    const f=shortfall();if(!f)return 0;
    if(!f.can){say('Wall patrol: '+f.why);return 0}
    let done=0;for(let i=0;i<f.need;i++)if(M().recruit())done++;else break;
    touch();return done;
  }
  const shortfallText=f=>f.can?'Servono '+men()+' soldati liberi in Caserma (liberi: '+f.free+').'
    :'Servono '+men()+' soldati liberi in Caserma (liberi: '+f.free+'): '+f.why+'.';
  // Legacy (UI v1) inspector block of a wall or palisade.
  function panelHtml(wall){
    if(!wall||!['wall','palisade'].includes(wall.type))return'';
    const c=wallControl(wall);
    if(!c)return'<div class="slot" data-wall-patrols><div class="slot-label">Pattuglie del giro · nessun camminamento</div>'+
      '<div class="legend">Servono mura T2+ o palizzate completate.</div></div>';
    const covered=summary().rings.find(r=>r.id===c.ring.id)?.covered??c.current,f=shortfall();
    const full=c.current>=c.ring.max;
    return'<div class="slot" data-wall-patrols><div class="slot-label">Pattuglie del giro · '+c.current+' / '+c.ring.max+
      ' ('+covered*men()+' soldati)</div>'+
      '<div class="grid"><button type="button" data-wall-patrol="-1"'+(c.current?'':' disabled')+'>− Pattuglia</button>'+
      '<button type="button" data-wall-patrol="1"'+(!f&&!full?'':' disabled')+'>+ Pattuglia · 2 soldati</button></div>'+
      (f&&!full?'<div class="legend">'+shortfallText(f)+'</div>'+
        (f.can?'<button type="button" data-wall-enlist>Arruola '+f.need+' soldat'+(f.need===1?'o':'i')+' · '+f.cost+' oro</button>':''):'')+
      '<div class="legend">'+c.fact+'. Le pattuglie percorrono tutto il giro, non il solo tratto.</div></div>';
  }
  function bindPanel(root,wall){
    if(!root||!wall)return;
    root.querySelectorAll('[data-wall-patrol]').forEach(b=>b.onclick=()=>{
      const r=ringOfWall(wall.id);if(r)adjust(r.id,Number(b.dataset.wallPatrol));
    });
    root.querySelectorAll('[data-wall-enlist]').forEach(b=>b.onclick=()=>enlistForPatrol());
  }

  window.ConquerWallPatrols=Object.freeze({SPEED,FILE_GAP,MAX_PER_U,rings,ringOf,ringOfWall,wanted,wantedByRing,
    set,adjust,trim,sync,circuit,pointAt,positions,draw,summary,wallControl,panelHtml,bindPanel,shortfall,enlistForPatrol,
    invalidate:()=>{ringCache={graph:null,list:[]};circuitCache.clear()}});
})();
