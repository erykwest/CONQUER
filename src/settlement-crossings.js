'use strict';
// Standalone terrain crossings: local moat slowdown, bridges and Gate drawbridges.
// Game rules deliberately do not depend on the appearance of the 2.5D renderer.
(function(){
  const WIDTHS={moat:1.5,bridge:1.2};
  const MAX_LENGTH=16;
  const MIN_LENGTH=1;
  const TYPES=['dry','water','wood','stone'];
  const DRAWBRIDGE_COST={gold:18,wood:28,metal:5};
  const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
  const xy=s=>s?.a&&s?.b&&Number.isFinite(s.a.x)&&Number.isFinite(s.a.y)&&Number.isFinite(s.b.x)&&Number.isFinite(s.b.y);
  const length=s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);
  // Point magnets are screen-distance based: reliably pick an endpoint at any
  // zoom and on raised terraces. Both ends of existing moats can be extended.
  const MOAT_MAGNET_PX=17;
  function snapMoatEndpoint(world,screen=null){
    if(!world||!Number.isFinite(world.x)||!Number.isFinite(world.y))return null;
    let nearest=null,best=Infinity;
    for(const s of State.structures){
      if(s.type!=='moat'||!xy(s))continue;
      for(const end of ['a','b']){
        const anchor=s[end];
        const distance=screen
          ?Math.hypot(w2s(anchor,Number(s.groundZ)||0).x-screen.x,
            w2s(anchor,Number(s.groundZ)||0).y-screen.y)
          :Math.hypot(world.x-anchor.x,world.y-anchor.y);
        if(distance>(screen?MOAT_MAGNET_PX:.55)||distance>=best)continue;
        nearest={point:{x:anchor.x,y:anchor.y},structureId:s.id,end,
          variant:s.variant,width:s.width,groundZ:Number(s.groundZ)||0,distance};
        best=distance;
      }
    }
    return nearest;
  }
  function drawMoatMagnets(){
    if(State.tool?.kind!=='crossing'||!['dry','water'].includes(State.tool.crossing))return;
    const highlighted=State.tool.moatHover;
    ctx.save();
    const shown=new Set();
    for(const s of State.structures){
      if(s.type!=='moat'||!xy(s))continue;
      for(const end of ['a','b']){
        const anchor=s[end],key=anchor.x.toFixed(3)+','+anchor.y.toFixed(3)+','+(Number(s.groundZ)||0);
        if(shown.has(key))continue;
        shown.add(key);
        const v=w2s(anchor,Number(s.groundZ)||0),
          active=highlighted&&Math.hypot(anchor.x-highlighted.point.x,anchor.y-highlighted.point.y)<.015,
          origin=State.draft?.a&&Math.hypot(anchor.x-State.draft.a.x,anchor.y-State.draft.a.y)<.015;
        ctx.beginPath();ctx.arc(v.x,v.y,active?7:origin?6:4,0,Math.PI*2);
        ctx.fillStyle=active?'#8dffbd':origin?'#ffe2a2':'#f3ce84';ctx.fill();
        ctx.lineWidth=active?2.5:1.5;ctx.strokeStyle='#314938';ctx.stroke();
      }
    }
    if(State.draft?.a){
      const z=Number(State.draft.aGroundZ)||terrainElevation(State.draft.a),
        p=w2s(State.draft.a,z);
      ctx.beginPath();ctx.arc(p.x,p.y,5.5,0,Math.PI*2);
      ctx.fillStyle='#ffdc8c';ctx.fill();ctx.lineWidth=1.8;ctx.strokeStyle='#533921';ctx.stroke();
    }
    ctx.restore();
  }
  function drawMoatJunctions(){
    const nodes=new Map();
    for(const s of State.structures){
      if(s.type!=='moat'||underConstruction(s)||!xy(s))continue;
      const z=Number(s.groundZ)||0;
      for(const end of ['a','b']){
        const a=s[end],key=Math.round(a.x*100)+':'+Math.round(a.y*100)+':'+Math.round(z*100)+':'+s.variant;
        if(!nodes.has(key))nodes.set(key,[]);
        nodes.get(key).push({p:a,s,z});
      }
    }
    const disk=(p,r,z)=>Array.from({length:18},(_,i)=>{
      const angle=i*2*Math.PI/18;
      return w2s({x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r},z);
    });
    for(const entries of nodes.values()){
      if(entries.length<2)continue;
      const {p,z,s}=entries[0],width=Math.max(...entries.map(e=>Number(e.s.width)||1.5)),
        water=s.variant==='water';
      // A rounded union closes the triangular gaps left by two rectangular
      // strips meeting at an angle, without changing the terrain heightmap.
      pathPolygon(disk(p,width*.50,z),'#7b6850','#514533',.6);
      pathPolygon(disk(p,width*.23,z-(water?.18:.32)),
        water?'#398aa5':'#5a4937',water?'#8bc6cf':'#473d32',.7);
    }
  }
  function frame(s){
    const L=length(s)||1,ux=(s.b.x-s.a.x)/L,uy=(s.b.y-s.a.y)/L;
    return{L,ux,uy,nx:-uy,ny:ux,width:Number(s.width)||WIDTHS[s.type]||1};
  }
  function location(s,p){
    if(!xy(s))return null;
    const f=frame(s),dx=p.x-s.a.x,dy=p.y-s.a.y;
    return{along:dx*f.ux+dy*f.uy,across:dx*f.nx+dy*f.ny,f};
  }
  function onStrip(s,p,pad=0){
    const l=location(s,p);
    return l&&l.along>=-pad&&l.along<=l.f.L+pad&&Math.abs(l.across)<=l.f.width/2+pad?l:null;
  }
  function point(s,along,across){
    const f=frame(s);
    return{x:s.a.x+f.ux*along+f.nx*across,y:s.a.y+f.uy*along+f.ny*across};
  }
  function corners(s,near=-.5,far=.5,from=0,to=null){
    const f=frame(s),end=to==null?f.L:to;
    return[point(s,from,near*f.width),point(s,end,near*f.width),
      point(s,end,far*f.width),point(s,from,far*f.width)];
  }
  function samples(s){
    const f=frame(s),out=[];
    for(let i=0;i<=Math.max(2,Math.ceil(f.L/.3));i++){
      const t=i/Math.max(2,Math.ceil(f.L/.3));
      for(const offset of [-.5,0,.5])out.push(point(s,f.L*t,offset*f.width));
    }
    return out;
  }
  function validate(s){
    if(!s||!['moat','bridge'].includes(s.type)||!xy(s))return'Invalid crossing geometry';
    if(!TYPES.includes(s.variant))return'Invalid crossing material';
    if(s.type==='moat'&&!['dry','water'].includes(s.variant))return'Invalid moat variant';
    if(s.type==='bridge'&&!['wood','stone'].includes(s.variant))return'Invalid bridge material';
    const f=frame(s);
    if(f.L<MIN_LENGTH-.001||f.L>MAX_LENGTH+.001)return'Length must be 1–16U';
    if(f.width<.6||f.width>4)return'Width must be between 0.6 and 4U';
    if(!inBuild(s.a)||!inBuild(s.b))return'Both endpoints must be inside the build area';
    if(s.type==='bridge'){
      // Crossing the gap may be over air or a cliff. Only BANKS must be flat,
      // accessible and at exactly the same elevation. No sloped bridges.
      if(terrainSlopeKind(s.a)||terrainSlopeKind(s.b))return'Bridge banks must be flat';
      const za=terrainPlateauElevation(s.a),zb=terrainPlateauElevation(s.b);
      if(za==null||zb==null||Math.abs(za-zb)>.01)return'Bridge endpoints must have the SAME elevation';
      s.groundZ=za;
    }else{
      // A moat follows a flat contour; an excavated trench is not a ramp.
      const levels=samples(s).map(p=>terrainSlopeKind(p)?null:terrainPlateauElevation(p));
      if(levels.some(z=>z==null)||levels.some(z=>Math.abs(z-levels[0])>.01))
        return'Moat must follow one flat terrace';
      if(s.variant==='water'&&levels.some(z=>Math.abs(z)>.01))
        return'Water-filled moats require ground level 0';
      s.groundZ=levels[0];
    }
    return null;
  }
  function normalise(s){
    if(!s||!['moat','bridge'].includes(s.type))return s;
    s.width=Math.max(.6,Math.min(4,Number(s.width)||WIDTHS[s.type]));
    s.variant=s.type==='moat'?(s.variant==='water'?'water':'dry'):(s.variant==='stone'?'stone':'wood');
    s.length=length(s);
    s.fills=Array.isArray(s.fills)?s.fills.filter(f=>Number.isFinite(f.at)&&Number.isFinite(f.span))
      .map(f=>({at:Math.max(0,Math.min(s.length,f.at)),span:Math.max(.5,Math.min(4,f.span)),
        progress:clamp01(f.progress)})).slice(-64):[];
    return s;
  }
  function add(s){
    normalise(s);
    const err=validate(s);
    if(err){status(err);return false}
    const cost=constructionCost(s);
    if(!canAfford(cost)){status('Insufficient resources: '+costText(cost));return false}
    s.id=s.id||uid();s.buildCost=cost;spendCost(cost);beginConstruction(s);
    State.structures.push(s);
    selectStructure(s);markDirty(true,['ground','base','castleBody']);
    status((s.type==='moat'?'Moat':'Bridge')+' placed · '+s.length.toFixed(1)+'U · level '+s.groundZ);
    draw();return true;
  }
  const HEAVY_WIDTHS={ram:1.4,siegeTower:2.4,mantlet:1};
  function heavyWidth(kind){return typeof kind==='string'?(HEAVY_WIDTHS[kind]||1.4):kind?1.4:0}
  function filled(s,l,width=0){
    return s.fills?.some(f=>f.progress>=1&&f.span+1e-5>=width
      &&Math.abs(l.along-f.at)<=Math.max(0,(f.span-width)/2))||false;
  }
  function onOpenBridge(p,forHeavy=false){
    const requirement=heavyWidth(forHeavy);
    for(const s of State.structures){
      if(s.type==='bridge'&&!underConstruction(s)&&s.width+1e-5>=requirement
        &&onStrip(s,p,requirement?-.03:0))return s;
      if(s.type==='gate'&&drawbridgePassage(s,p)
        &&deck(s).width+1e-5>=requirement)return s;
    }
    return null;
  }
  function moatAt(p){
    for(const s of State.structures){
      if(s.type!=='moat'||underConstruction(s))continue;
      const l=onStrip(s,p);
      if(l)return{moat:s,location:l,filled:filled(s,l)};
    }
    return null;
  }
  function movementMultiplier(p,heavy=false){
    if(onOpenBridge(p,heavy))return 1;
    const found=moatAt(p);
    if(!found||filled(found.moat,found.location,heavyWidth(heavy)))return 1;
    if(heavy)return 0;
    return found.moat.variant==='water'?.25:.5;
  }
  function routeMultiplier(path){
    if(!path||path.length<2)return 1;
    let normal=0,weighted=0;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],L=Math.hypot(b.x-a.x,b.y-a.y);
      const steps=Math.max(1,Math.ceil(L/.2));
      for(let j=0;j<steps;j++){
        const t=(j+.5)/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
        const m=Math.max(.1,movementMultiplier(p));
        normal+=L/steps;weighted+=L/steps/m;
      }
    }
    return normal>0?weighted/normal:1;
  }
  function onBridge(p){return !!onOpenBridge(p)}
  function segmentCanCrossCliff(a,b){
    const steps=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.12));
    for(let i=0;i<=steps;i++){
      const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      if(terrainSlopeKind(p)==='steep'&&!onOpenBridge(p))return false;
    }
    return true;
  }
  function progressFilling(id,position,span,effortDays=0){
    const s=State.structures.find(x=>x.id===id&&x.type==='moat'&&!underConstruction(x));
    if(!s)return{ok:false,reason:'No completed moat'};
    const l=location(s,position);
    if(!l||l.along<0||l.along>l.f.L||Math.abs(l.across)>l.f.width/2+.35)
      return{ok:false,reason:'Equipment not in contact with moat'};
    const width=Math.max(.5,Math.min(4,Number(span)||1.2));
    let patch=s.fills.find(f=>Math.abs(f.at-l.along)<Math.max(.25,width*.4));
    if(!patch){patch={at:l.along,span:width,progress:0};s.fills.push(patch)}
    patch.span=Math.max(patch.span,width);
    // Deliberately modest rate: operators fill the ditch, not the vehicle itself.
    const effort=Math.max(0,Number(effortDays)||0);
    const before=patch.progress;
    patch.progress=clamp01(patch.progress+effort/(s.variant==='water'?4:2.5)/s.width*1.5);
    markDirty(before<1&&patch.progress>=1,['ground','base']);
    return{ok:true,progress:patch.progress,complete:patch.progress>=1,moatId:s.id};
  }
  function heavyApproach(unit,days){
    if(!unit||!HEAVY_WIDTHS[unit.kind])return null;
    if(onOpenBridge(unit,unit.kind))return null;
    for(const s of State.structures){
      const l=s.type==='moat'&&!underConstruction(s)?onStrip(s,unit,.35):null;
      if(l&&!filled(s,l,HEAVY_WIDTHS[unit.kind]))
        return progressFilling(s.id,unit,HEAVY_WIDTHS[unit.kind],days);
    }
    return null;
  }
  function drawbridge(gate){
    return gate?.type==='gate'&&gate.drawbridge?.installed?gate.drawbridge:null;
  }
  function stateOfGate(gate){
    const d=drawbridge(gate);
    return !d?'none':d.progress>=.99?'raised':d.progress<=.01?'lowered':'moving';
  }
  function deck(gate){
    const d=rectDims(gate),a=Number(gate.angle)||0;
    const outward={x:Math.cos(a),y:Math.sin(a)};
    const tangent={x:-outward.y,y:outward.x};
    const hinge={x:gate.x+outward.x*d.w/2,y:gate.y+outward.y*d.w/2};
    const length=2.25,width=Math.min(1.2,d.h*.80);
    return{hinge,outward,tangent,length,width,z:placementGroundZ(gate)};
  }
  function drawbridgePassage(gate,p){
    const d=drawbridge(gate);
    if(!d||underConstruction(gate)||d.raised||d.progress>.02)return false;
    const g=deck(gate),dx=p.x-g.hinge.x,dy=p.y-g.hinge.y;
    const forward=dx*g.outward.x+dy*g.outward.y,lateral=dx*g.tangent.x+dy*g.tangent.y;
    return forward>=-.10&&forward<=g.length+.06&&Math.abs(lateral)<=g.width/2;
  }
  function drawbridgeBlocks(p,gate){
    const d=drawbridge(gate);
    if(!d||underConstruction(gate)||(!d.raised&&d.progress<=.02))return false;
    const g=deck(gate),dx=p.x-g.hinge.x,dy=p.y-g.hinge.y;
    const forward=dx*g.outward.x+dy*g.outward.y,lateral=dx*g.tangent.x+dy*g.tangent.y;
    return forward>=-.35&&forward<=.45&&Math.abs(lateral)<g.width/2+.12;
  }
  function toggleDrawbridge(gate){
    const d=drawbridge(gate);
    if(!d||underConstruction(gate))return false;
    d.raised=!d.raised;
    markDirty(true,false,true);
    renderFunctionPanel();draw();
    status(d.raised?'Raising drawbridge':'Lowering drawbridge');
    return true;
  }
  function installDrawbridge(gate){
    if(!gate||gate.type!=='gate'||underConstruction(gate)||drawbridge(gate))return false;
    if(!canAfford(DRAWBRIDGE_COST)){status('Insufficient resources · '+costText(DRAWBRIDGE_COST));return false}
    spendCost(DRAWBRIDGE_COST);
    gate.drawbridge={installed:true,raised:false,progress:0};
    markDirty(true,['ground','base']);renderFunctionPanel();draw();
    status('Drawbridge installed on the gate');
    return true;
  }
  function removeDrawbridge(gate){
    if(!drawbridge(gate))return false;
    delete gate.drawbridge;markDirty(true,['ground','base']);renderFunctionPanel();draw();
    status('Drawbridge removed (no materials refunded)');return true;
  }
  function drawMoat(s){
    const z=Number(s.groundZ)||0,water=s.variant==='water',width=frame(s).width;
    const outer=corners(s),inner=corners(s,-.23,.23);
    pathPolygon(outer.map(p=>w2s(p,z)),'#7b6850','#514533',.85);
    // Excavation: two sloping banks and a recessed floor (local ground layer).
    const near=[point(s,0,-width/2),point(s,length(s),-width/2)];
    const far=[point(s,0,width/2),point(s,length(s),width/2)];
    pathPolygon([w2s(near[0],z),w2s(near[1],z),
      w2s(inner[1],z-.30),w2s(inner[0],z-.30)],'#9a805c','#68513b',.75);
    pathPolygon([w2s(inner[3],z-.30),w2s(inner[2],z-.30),
      w2s(far[1],z),w2s(far[0],z)],'#7c6247','#675039',.75);
    pathPolygon(inner.map(p=>w2s(p,z-(water?.18:.32))),
      water?'#398aa5':'#5a4937',water?'#8bc6cf':'#473d32',.9);
    if(water){
      const f=frame(s);
      for(let i=1;i<Math.floor(f.L*1.3);i+=2){
        const a=point(s,i/f.L*f.L,-f.width*.10),b=point(s,Math.min(f.L,i+.35),f.width*.10);
        ctx.beginPath();const q=w2s(a,z-.15),r=w2s(b,z-.15);
        ctx.moveTo(q.x,q.y);ctx.lineTo(r.x,r.y);
        ctx.strokeStyle='rgba(187,236,234,.42)';ctx.lineWidth=.9;ctx.stroke();
      }
    }
    for(const patch of s.fills||[]){
      if(patch.progress<=0)continue;
      const half=Math.min(length(s),patch.span)/2,from=Math.max(0,patch.at-half),
        to=Math.min(length(s),patch.at+half);
      const acrossEnd=-.5+patch.progress;
      const p0=point(s,from,-width*.5),p1=point(s,to,-width*.5),
        p2=point(s,to,width*acrossEnd),p3=point(s,from,width*acrossEnd);
      pathPolygon([p0,p1,p2,p3].map(p=>w2s(p,z+.025)),
        '#c2a477','#806c4c',.8);
    }
  }
  function drawBridge(s){
    const z=(Number(s.groundZ)||0)+.09,f=frame(s),width=f.width;
    const poly=corners(s);
    pathPolygon(poly.map(p=>w2s(p,z)),s.variant==='stone'?'#9c9b92':'#986e42',
      s.variant==='stone'?'#5c5b53':'#50361e',1);
    const across=(-width/2);
    if(s.variant==='wood'){
      for(let v=.25;v<f.L;v+=.35){
        const a=w2s(point(s,v,-width*.49),z+.009),b=w2s(point(s,v,width*.49),z+.009);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='rgba(54,33,18,.58)';ctx.lineWidth=1;ctx.stroke();
      }
      for(const side of [-1,1]){
        const a=w2s(point(s,0,side*width/2),z+.23),b=w2s(point(s,f.L,side*width/2),z+.23);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='#735037';ctx.lineWidth=2.0;ctx.stroke();
      }
    }else{
      for(const side of [-1,1]){
        const a=w2s(point(s,0,side*width/2),z+.24),b=w2s(point(s,f.L,side*width/2),z+.24);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='#78766d';ctx.lineWidth=3.4;ctx.stroke();
      }
    }
  }
  function drawPreview(s){
    if(!s||!xy(s)||length(s)<.02)return;
    ctx.save();ctx.globalAlpha=.50;
    const candidate={...s,groundZ:Number(s.groundZ)||terrainElevation(s.a),fills:[]};
    if(s.type==='moat')drawMoat(candidate);else drawBridge(candidate);
    ctx.restore();
  }
  // Convert a group of snapped moat sections to uninterrupted polylines.
  // Nodes with degree 2 are internal corners; a degree 1 node is a free end;
  // at branching nodes each outgoing chain is handled independently.
  function moatChains(segments){
    const nodes=new Map(),edges=[];
    const key=p=>Math.round(p.x*10000)+':'+Math.round(p.y*10000);
    function vertex(p){
      const k=key(p);
      if(!nodes.has(k))nodes.set(k,{point:{x:p.x,y:p.y},links:[]});
      return k;
    }
    for(const s of segments){
      if(!xy(s)||length(s)<1e-5)continue;
      const a=vertex(s.a),b=vertex(s.b),index=edges.length;
      if(a===b)continue;
      edges.push({a,b,width:Number(s.width)||1.5,s});
      nodes.get(a).links.push(index);
      nodes.get(b).links.push(index);
    }
    const used=new Set(),chains=[];
    function trace(origin,first){
      let node=origin,edgeIndex=first;
      const points=[{...nodes.get(origin).point}],widths=[],parts=[];
      while(!used.has(edgeIndex)){
        used.add(edgeIndex);
        const edge=edges[edgeIndex],next=edge.a===node?edge.b:edge.a;
        points.push({...nodes.get(next).point});
        widths.push(edge.width);
        parts.push(edge.s);
        node=next;
        if(node===origin||nodes.get(node).links.length!==2)break;
        const following=nodes.get(node).links.find(i=>!used.has(i));
        if(following==null)break;
        edgeIndex=following;
      }
      if(widths.length)chains.push({points,widths,parts,closed:node===origin});
    }
    for(const [key,node] of nodes){
      if(node.links.length===2)continue;
      for(const i of node.links)if(!used.has(i))trace(key,i);
    }
    // Remaining edges form closed loops with no free endpoints.
    for(let i=0;i<edges.length;i++)if(!used.has(i))trace(edges[i].a,i);
    return chains;
  }
  function moatOffsetOutline(chain,fraction=1){
    const closed=chain.closed,points=closed?chain.points.slice(0,-1):chain.points;
    const count=points.length,widths=chain.widths;
    if(count<2)return[];
    const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
    const unit=d=>{const n=Math.hypot(d.x,d.y)||1;return{x:d.x/n,y:d.y/n}};
    const cross=(a,b)=>a.x*b.y-a.y*b.x;
    const sidePoints=sign=>{
      const result=[];
      for(let i=0;i<count;i++){
        const p=points[i];
        if(!closed&&(i===0||i===count-1)){
          const k=i===0?0:count-2;
          const d=unit(sub(points[k+1],points[k]));
          const h=widths[k]*fraction*.5*sign;
          result.push({x:p.x-d.y*h,y:p.y+d.x*h});
          continue;
        }
        const prev=(i-1+count)%count,next=(i+1)%count;
        const d0=unit(sub(p,points[prev])),d1=unit(sub(points[next],p));
        const h0=widths[(i-1+widths.length)%widths.length]*fraction*.5*sign;
        const h1=widths[i%widths.length]*fraction*.5*sign;
        const a={x:p.x-d0.y*h0,y:p.y+d0.x*h0};
        const b={x:p.x-d1.y*h1,y:p.y+d1.x*h1};
        const denom=cross(d0,d1);
        const dot=d0.x*d1.x+d0.y*d1.y;
        if(Math.abs(denom)<1e-6){
          if(dot>0)result.push({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
          else result.push(a,b);
          continue;
        }
        const delta=sub(b,a),t=cross(delta,d1)/denom;
        const meet={x:a.x+d0.x*t,y:a.y+d0.y*t};
        // Bevel acute U-turns rather than produce giant mitre spikes.
        const miterLimit=Math.max(Math.abs(h0),Math.abs(h1))*3;
        if(Math.hypot(meet.x-p.x,meet.y-p.y)<=miterLimit)
          result.push(meet);
        else result.push(a,b);
      }
      return result;
    };
    const left=sidePoints(1),right=sidePoints(-1);
    return closed?[left,right]:[left.concat(right.reverse())];
  }
  function drawMoatOutline(rings,z,fill){
    if(!rings?.length)return;
    ctx.save();ctx.beginPath();
    for(const ring of rings){
      if(ring.length<3)continue;
      const first=w2s(ring[0],z);ctx.moveTo(first.x,first.y);
      for(let i=1;i<ring.length;i++){
        const p=w2s(ring[i],z);
        ctx.lineTo(p.x,p.y);
      }
      ctx.closePath();
    }
    // Edges are only the outer outline of the whole chain. There are no
    // intermediate end caps, no strokes and no double-painted segment rims.
    ctx.fillStyle=fill;ctx.fill('evenodd');ctx.restore();
  }
  function drawMoatFills(s){
    const z=Number(s.groundZ)||0,width=frame(s).width;
    for(const patch of s.fills||[]){
      if(patch.progress<=0)continue;
      const half=Math.min(length(s),patch.span)/2,
        from=Math.max(0,patch.at-half),to=Math.min(length(s),patch.at+half);
      const y=-.5+patch.progress;
      const poly=[point(s,from,-width*.5),point(s,to,-width*.5),
        point(s,to,width*y),point(s,from,width*y)];
      pathPolygon(poly.map(p=>w2s(p,z+.025)),'#c2a477','#806c4c',.8);
    }
  }
  function drawUnifiedMoats(moats){
    // Independent of polygon-clipping/CDN availability. A native union of
    // contiguous centerline sections removes seams even in offline sessions.
    const groups=new Map();
    for(const s of moats){
      if(!xy(s))continue;
      const key=s.variant+':'+Math.round((Number(s.groundZ)||0)*1000);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(s);
    }
    for(const segments of groups.values()){
      const base=segments[0],water=base.variant==='water',z=Number(base.groundZ)||0;
      const chains=moatChains(segments);
      const layers=[
        {fraction:1,z,fill:'#7b6850'},
        {fraction:.74,z:z-.095,fill:'#987c58'},
        {fraction:.46,z:z-(water?.18:.32),fill:water?'#398aa5':'#5a4937'}
      ];
      // All outer banks first, then all slopes, then all floors. Crucial at
      // T junctions: one segment's outer bank never covers another's floor.
      for(const layer of layers){
        for(const chain of chains){
          drawMoatOutline(moatOffsetOutline(chain,layer.fraction),layer.z,layer.fill);
        }
      }
      for(const s of segments)drawMoatFills(s);
    }
    return true;
  }
  function drawGround(){
    // Pending + completed segments share ONE chain silhouette. Drawing pending
    // rectangles separately would bring back the exact overlaps at junctions.
    const moats=State.structures.filter(s=>s.type==='moat');
    drawUnifiedMoats(moats);
    for(const s of moats){
      if(!underConstruction(s))continue;
      const z=Number(s.groundZ)||0,a=w2s(s.a,z+.025),b=w2s(s.b,z+.025);
      // Lightweight construction hint on the centerline; no extra rim/cap.
      ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(237,203,141,.56)';
      ctx.lineWidth=1.6;ctx.stroke();ctx.restore();
    }
    // Bridges are always painted last, regardless of build order.
    for(const s of State.structures){
      if(s.type!=='bridge')continue;
      ctx.save();if(underConstruction(s))ctx.globalAlpha=.55;
      drawBridge(s);ctx.restore();
    }
  }
  let frameAt=0,rafPending=0;
  function drawDynamic(){
    const now=performance.now(),elapsed=frameAt?Math.min(.08,(now-frameAt)/1000):0;
    frameAt=now;let moving=false;
    for(const gate of State.structures){
      const d=drawbridge(gate);
      if(!d||underConstruction(gate))continue;
      const target=d.raised?1:0;
      if(Math.abs(d.progress-target)>.001){
        d.progress=Math.max(0,Math.min(1,d.progress+(d.raised?1:-1)*elapsed/1.6));
        if(Math.abs(d.progress-target)<.01)d.progress=target;
        moving=true;
      }
      const g=deck(gate),theta=d.progress*Math.PI/2;
      const far={x:g.hinge.x+g.outward.x*g.length*Math.cos(theta),
        y:g.hinge.y+g.outward.y*g.length*Math.cos(theta)};
      const side=g.tangent,w=g.width/2,baseZ=g.z+.08,tipZ=baseZ+g.length*Math.sin(theta);
      const a={x:g.hinge.x+side.x*w,y:g.hinge.y+side.y*w},
        b={x:g.hinge.x-side.x*w,y:g.hinge.y-side.y*w},
        c={x:far.x-side.x*w,y:far.y-side.y*w},
        e={x:far.x+side.x*w,y:far.y+side.y*w};
      withStructureGroundPlane(gate,()=>{
        pathPolygon([w2s(a,baseZ-g.z),w2s(b,baseZ-g.z),
          w2s(c,tipZ-g.z),w2s(e,tipZ-g.z)],
          '#9d7044','#412b1a',1.6);
        for(const shift of [-w*.78,w*.78]){
          const h={x:g.hinge.x+side.x*shift,y:g.hinge.y+side.y*shift},
            t={x:far.x+side.x*shift,y:far.y+side.y*shift};
          const p=w2s(h,2.0),q=w2s(t,tipZ-g.z);
          ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);
          ctx.strokeStyle='#b8a98b';ctx.lineWidth=1;ctx.stroke();
        }
      });
    }
    if(moving&&!rafPending){
      rafPending=requestAnimationFrame(()=>{rafPending=0;draw()});
    }
  }
  function panel(s){
    if(s.type==='moat'){
      const fills=(s.fills||[]).filter(f=>f.progress>=1).length;
      return '<div class="slot"><div class="slot-label">Moat · '+(s.variant==='water'?'Water':'Dry')+'</div>'+
        '<div class="legend">Depth .3U · infantry '+(s.variant==='water'?'25%':'50%')+
        ' speed · heavy equipment requires filling · crossings ready '+fills+'</div></div>';
    }
    if(s.type==='bridge')return '<div class="slot"><div class="slot-label">Bridge · '+s.variant+'</div>'+
      '<div class="legend">Flat deck at elevation '+s.groundZ+
      ' · length '+s.length.toFixed(1)+'U · width '+s.width.toFixed(1)+
      'U · no sloped bridges</div>'+
      (s.variant==='wood'?'<button data-crossing-demolish>⚒ Demolish wooden bridge</button><div class="legend">Irreversible, no refund.</div>':'')+'</div>';
    if(s.type==='gate'){
      const d=drawbridge(s);
      return '<div class="slot"><div class="slot-label">Drawbridge · Gate accessory</div>'+
      (d?'<div class="grid"><button data-drawbridge-toggle '+(underConstruction(s)?'disabled':'')+'>'+
        (d.raised?'⬇ Lower':'⬆ Raise')+'</button><button data-drawbridge-remove>Remove</button></div>'+
        '<div class="legend">Animated gate-side bridge. '+stateOfGate(s)+'. Access only when fully lowered.</div>':
        '<button data-drawbridge-install '+(underConstruction(s)?'disabled':'')+
        '>Install drawbridge · '+costText(DRAWBRIDGE_COST)+'</button>')+'</div>';
    }
    return '';
  }
  function bindPanel(slots){
    const s=selectedStructure();if(!s)return;
    slots.querySelector('[data-crossing-demolish]')?.addEventListener('click',()=>{
      if(confirm('Demolish the wooden bridge permanently?')){
        State.structures=State.structures.filter(x=>x.id!==s.id);
        State.selectedId=null;markDirty(true,['ground','base']);renderFunctionPanel();draw();
        status('Wooden bridge demolished — no materials returned');
      }
    });
    slots.querySelector('[data-drawbridge-install]')?.addEventListener('click',()=>installDrawbridge(s));
    slots.querySelector('[data-drawbridge-toggle]')?.addEventListener('click',()=>toggleDrawbridge(s));
    slots.querySelector('[data-drawbridge-remove]')?.addEventListener('click',()=>removeDrawbridge(s));
  }
  window.ConquerCrossings={validate,normalise,add,panel,bindPanel,drawGround,drawPreview,drawDynamic,
    snapMoatEndpoint,drawMoatMagnets,drawUnifiedMoats,moatChains,moatOffsetOutline,
    movementMultiplier,routeMultiplier,onBridge,segmentCanCrossCliff,moatAt,onOpenBridge,
    heavyApproach,progressFilling,installDrawbridge,toggleDrawbridge,removeDrawbridge,
    drawbridgeBlocks,drawbridgePassage,stateOfGate,DRAWBRIDGE_COST};
})();
