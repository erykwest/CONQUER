'use strict';
// The village stockyard is a physical view and capacity for the existing lord ledger.
// Never store a second inventory on the structure: ConquerEconomy.state().castle is canonical.
(() => {
  const TYPE='storageYard',SIZES=[2,4,6],START_RADIUS=7;
  const GOODS=['food','wood','stone','clay','metal','equipment','luxury'];
  const yardRect=(x,y,w,h,angle=0)=>{
    if(typeof rectWorldPoints==='function')return rectWorldPoints(x,y,w,h,angle);
    const ca=Math.cos(angle),sa=Math.sin(angle);
    return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]
      .map(([dx,dy])=>({x:x+dx*ca-dy*sa,y:y+dx*sa+dy*ca}));
  };
  const COLORS={food:'#ba9a52',wood:'#795236',stone:'#96918a',clay:'#b36a48',metal:'#646972',equipment:'#72756b',luxury:'#b6a06a'};
  const number=v=>Number.isFinite(Number(v))?Number(v):0;
  const size=s=>SIZES.includes(Number(s?.yardSize))?Number(s.yardSize):2;
  const is=s=>s?.type===TYPE;
  const list=()=>State.structures.filter(s=>is(s));
  const active=()=>list().filter(s=>typeof underConstruction!=='function'||!underConstruction(s));
  const capacityOf=s=>600*Math.pow(size(s)/2,2);
  const capacity=()=>active().reduce((sum,s)=>sum+capacityOf(s),0);
  function stocks(){
    const source=window.ConquerEconomy?.state?.()?.castle||{};
    return Object.fromEntries(GOODS.map(g=>[g,Math.max(0,number(source[g]))]));
  }
  function used(){return Object.values(stocks()).reduce((a,b)=>a+b,0)}
  function free(){return Math.max(0,capacity()-used())}
  function make(x=0,y=0,options={}){
    const n=SIZES.includes(Number(options.size))?Number(options.size):2;
    return{...(options.id?{id:options.id}:{}),type:TYPE,shape:'square',x,y,w:n,h:n,yardSize:n,
      angle:0,economicOwner:'lord',...(options.founding?{foundingStockyard:true,foundingWellId:options.wellId||null,buildCost:{}}:{})};
  }
  // Candidate areas are validated by the same terrain, canopy, whitezone and
  // collision checks as player placements; no forced overlapping spawn.
  function findNear(well){
    if(!well)return null;
    const options=[];
    for(let radius=2.5;radius<=START_RADIUS;radius+=.5){
      for(let i=0;i<32;i++){
        const a=2*Math.PI*i/32;
        const x=Math.round((well.x+Math.cos(a)*radius)*2)/2;
        const y=Math.round((well.y+Math.sin(a)*radius)*2)/2;
        if(Math.hypot(x-well.x,y-well.y)>START_RADIUS+1e-7)continue;
        options.push(make(x,y,{founding:true,wellId:well.id}));
      }
    }
    for(const candidate of options){
      const verdict=window.ConquerPlacement?.check?.(candidate,{checkCost:false,includeAuto:true});
      if(verdict?.ok)return candidate;
    }
    return null;
  }
  function ensureForWell(well=State.structures.find(s=>s.id===State.village?.wellId&&s.type==='well')){
    if(!State.village?.founded||!well)return null;
    const existing=list().find(s=>s.foundingWellId===well.id)||list()[0];
    if(existing)return existing;
    const yard=findNear(well);
    if(!yard)return null;
    yard.id='stockyard:'+well.id;
    yard.groundZ=typeof terrainElevation==='function'?terrainElevation(yard):0;
    State.structures.push(yard);
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    if(typeof invalidateSceneCache==='function')invalidateSceneCache(['ground','base','shadow']);
    if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    return yard;
  }
  function expansionCost(oldSize,nextSize){
    if(!SIZES.includes(oldSize)||!SIZES.includes(nextSize)||nextSize<=oldSize)return null;
    return{gold:nextSize===4?20:40,wood:nextSize===4?10:20};
  }
  function grow(target,nextSize){
    if(!is(target)||!SIZES.includes(Number(nextSize)))return{ok:false,reason:'Invalid stockyard size'};
    const next=Number(nextSize),old=size(target);
    if(next<=old)return{ok:false,reason:'The stockyard can only expand'};
    if(next!==old+2)return{ok:false,reason:'Expand one level at a time'};
    if(typeof underConstruction==='function'&&underConstruction(target))
      return{ok:false,reason:'Finish the current construction first'};
    const candidate={...target,w:next,h:next,yardSize:next};
    const check=window.ConquerPlacement?.check?.(candidate,{ignoreId:target.id,includeAuto:true,checkCost:false});
    if(!check?.ok)return{ok:false,reason:check?.reason||'Expansion footprint blocked'};
    const cost=expansionCost(old,next);
    if(typeof canAfford==='function'&&!canAfford(cost))return{ok:false,reason:'Insufficient resources for expansion'};
    if(typeof spendCost==='function'&&!spendCost(cost))return{ok:false,reason:'Unable to pay expansion cost'};
    Object.assign(target,{w:next,h:next,yardSize:next,expandedAt:Number(State.clock?.day)||0});
    if(typeof markStructureDirty==='function')markStructureDirty(target);
    return{ok:true,cost,size:next};
  }
  function canRemove(target){
    // Don't orphan established lord inventories by deleting the final stockyard.
    return !is(target)||list().length>1||used()<.00001;
  }
  function piles(sample=null){
    const inv=sample||stocks();
    return GOODS.filter(g=>inv[g]>.001).map((good,i)=>({
      good,qty:inv[good],color:COLORS[good],
      tiers:Math.max(1,Math.min(3,Math.ceil(inv[good]/60))),
      index:i
    }));
  }
  function visualSignature(){return active().map(s=>s.id+':'+size(s)).join(',')+'|'+piles().map(p=>p.good+':'+p.tiers).join(',')}
  function spots(s){
    const stock=piles(s.labStocks||null);
    const n=Math.min(size(s)===2?4:9,stock.length);
    const cols=n<=4?2:3,rows=Math.ceil(n/cols),step=size(s)/(cols+1);
    return stock.slice(0,n).map((pile,i)=>({
      ...pile,x:s.x+(i%cols-(cols-1)/2)*step,
      y:s.y+(Math.floor(i/cols)-(rows-1)/2)*step
    }));
  }
  function addToBuilder(m,s){
    if(!is(s))return false;
    const g=Number.isFinite(Number(s.groundZ))?Number(s.groundZ):terrainElevation(s),n=size(s);
    m.prism(yardRect(s.x,s.y,n,n,s.angle||0),g,g+.075,'#8b795a','#6f5940','#6f5940');
    for(const k of [-1,1]){
      m.prism(yardRect(s.x+k*(n/2-.08),s.y,.12,n,s.angle||0),g+.075,g+.22,'#76543a','#4b3627','#76543a');
      m.prism(yardRect(s.x,s.y+k*(n/2-.08),n,.12,s.angle||0),g+.075,g+.22,'#76543a','#4b3627','#76543a');
    }
    for(const p of spots(s)){
      const h=.18+.13*p.tiers;
      m.prism(yardRect(p.x,p.y,.45,.43,s.angle||0),g+.075,g+.075+h,p.color,'#4e3b2d','#6c5741');
      if(p.good==='wood')for(const dx of [-.12,0,.12])
        m.prism(yardRect(p.x+dx,p.y,.07,.38,s.angle||0),g+.075+h,g+.1+h,'#ae8450','#805a34','#ae8450');
    }
    return true;
  }
  function draw(s){
    if(!is(s)||typeof ctx==='undefined')return;
    const g=Number.isFinite(Number(s.groundZ))?Number(s.groundZ):terrainElevation(s),n=size(s);
    ctx.save();
    pathPolygon(projectPath(yardRect(s.x,s.y,n,n,s.angle||0),g+.06),'#8b795a','#d1b78d',1.4);
    for(const p of spots(s)){
      const r=yardRect(p.x,p.y,.45,.43,s.angle||0);
      pathPolygon(projectPath(r,g+.1+.13*p.tiers),p.color,'#352b20',1);
    }
    ctx.restore();
  }
  // Asset Lab calls the SAME addToBuilder() geometry, translated to the
  // model registry format rather than offering a misleading schematic.
  function labModel(n){
    const pos=[],colors=[],centre=100;
    const vertex=(p,z)=>({x:p.x-centre,y:p.y-centre,z});
    const tri=(a,b,c,paint)=>{
      pos.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);colors.push(paint);
    };
    const m={prism(poly,z0,z1,top,side1,side2){
      const bottom=poly.map(p=>vertex(p,z0)),upper=poly.map(p=>vertex(p,z1));
      for(let i=1;i<upper.length-1;i++)tri(upper[0],upper[i],upper[i+1],top);
      for(let i=0;i<poly.length;i++){
        const j=(i+1)%poly.length,col=i%2?side1:side2;
        tri(bottom[i],bottom[j],upper[j],col);
        tri(bottom[i],upper[j],upper[i],col);
      }
    }};
    const sample={food:45,wood:200,stone:180,metal:16};
    addToBuilder(m,{...make(centre,centre,{size:n}),groundZ:0,labStocks:sample});
    return{parts:{stockyard:{p:pos,c:colors}}};
  }
  const models={stockyard2:labModel(2),stockyard4:labModel(4),stockyard6:labModel(6)};
  window.ConquerStorageYard=Object.freeze({models,TYPE,SIZES,START_RADIUS,is,list,active,size,stocks,used,free,capacity,capacityOf,make,
    findNear,ensureForWell,expansionCost,grow,canRemove,piles,visualSignature,addToBuilder,draw});
})();