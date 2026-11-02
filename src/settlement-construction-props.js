'use strict';
// CONQUER construction-site props: the Blender-built kit (src/assets/construction-models.js,
// tools/blender/build_construction.py) placed around a structure while it is built and
// taken away phase by phase. Visual only: the props follow constructionProgress(s) and
// never change the site's state.
//   prep   (p < .12)   material pile and work bench(es) next to the footprint
//   raise  (.12–.90)   putlog scaffold rising with the work on the faces turned to the
//                      camera, ladders storey by storey, a hoist on the ground or a
//                      treadwheel crane riding on top of the rising masonry
//   finish (p >= .90)  only the scaffold (full height) is left; it goes with completion
// Sites are drawn on the dynamic Canvas layer by both renderers (settlement-render.js),
// so the props are painted there too, right after their site. Classic script.
(function(){
  const MODELS=()=>window.ConquerConstructionModels;
  const PHASE={prep:.12,finish:.9};
  const MAX_RUN=4;            // bays per face: longer faces get a run that moves with the work
  const MAX_BAY_STOREYS=64;   // scaffold modules per site (painter budget): runs shrink to fit
  const ALL_ROUND=new Set(['tower','gate']);   // scaffolded on every face
  const MIN_SCALE=.18;        // below this zoom the props are not drawn
  const SKIP=new Set(['road','field','moat','bridge','ruin','plaza','training']);
  const fn=name=>typeof globalThis[name]==='function'?globalThis[name]:null;
  const call=(name,...a)=>{const f=fn(name);try{return f?f(...a):undefined}catch{return undefined}};
  const clamp01=v=>Math.max(0,Math.min(1,v));

  // Lengths of the kit in U (meta is in metres).
  function units(){
    const d=MODELS(),k=d?.metersPerU||3.5,m=d?.models?.scaffoldBay?.meta||{};
    return{bay:(m.bay||2.4)/k,storey:(m.storey||2)/k,reach:(m.reach||1.3)/k};
  }
  function phaseOf(p){return p<PHASE.prep?'prep':p<PHASE.finish?'raise':'finish'}
  // Share of the height already standing: the scaffold climbs with it.
  function raised(p){return p>=PHASE.finish?1:clamp01((p-PHASE.prep)/(PHASE.finish-PHASE.prep))}

  // Height of the walls already standing: the assembly's site level when the building is
  // assembled piece by piece, otherwise the share of its height.
  function built(s,kind,p){
    const h=window.ConquerAssembly?.has?.(s)?window.ConquerAssembly.builtHeight(s,p):null;
    return Number.isFinite(h)?h:kind.H*raised(p);
  }
  // What a site needs, by type and material. null: no props (roads, fields, ...).
  function siteKind(s){
    // Village houses grow on their own (auto) but are real building sites too.
    if(!s||s.auto&&s.type!=='house'||SKIP.has(s.type)||window.ConquerIndustries?.is?.(s))return null;
    const H=Number(call('structureHeight',s))||0;
    const wood=s.type==='palisade'||s.type==='house'||s.type==='market'||!!call('isWoodTower',s)||!!call('isWoodGate',s)||!!call('isCivicAnnex',s)||s.type==='guild'&&call('civicLevel',s)<3||s.type==='townhall'&&call('civicLevel',s)===1;
    const masonry=!wood;
    return{H,masonry,brick:s.masonryMaterial==='brick',
      scaffold:H>=.9&&s.type!=='palisade'&&!call('isWoodGate',s),
      lift:masonry&&H>=3?'treadwheelCrane':(masonry&&H>=1.5)||call('isWoodTower',s)?'hoist':null,
      bench:masonry?'masonBench':'carpenterBench',
      secondBench:masonry&&H>=1.5};
  }

  // Footprint used for the scaffold: the largest polygon; circles become k-gons of bay width.
  function footprint(s){
    let polys=call('urbanBuildingPolygons',s)||[];
    if(!polys.length){const f=call('footprintPoints',s);if(f?.length)polys=[f]}
    if(!polys.length)return null;
    const area=pts=>{let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p.x*q.y-q.x*p.y}return Math.abs(a/2)};
    let pts=polys.reduce((best,p)=>area(p)>area(best)?p:best,polys[0]).filter(Boolean);
    if(pts.length<3)return null;
    const c={x:pts.reduce((a,p)=>a+p.x,0)/pts.length,y:pts.reduce((a,p)=>a+p.y,0)/pts.length};
    let r=0;for(const p of pts)r=Math.max(r,Math.hypot(p.x-c.x,p.y-c.y));
    if(pts.length>12){
      const {bay}=units(),k=Math.max(4,Math.round(2*Math.PI*r/bay)),a0=Number(s.angle)||0;
      pts=Array.from({length:k},(_,i)=>{const a=a0+i/k*Math.PI*2;return{x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r}});
    }
    return{pts,c,r};
  }
  // Ground-plane direction that points at the viewer (largest view depth gain).
  function towardsCamera(){
    let best=0,gain=-Infinity;
    for(let i=0;i<16;i++){
      const a=i/16*Math.PI*2,g=depth({x:Math.cos(a),y:Math.sin(a)})-depth({x:0,y:0});
      if(g>gain){gain=g;best=a}
    }
    return best;
  }
  function depth(p){return fn('viewDepthPoint')?viewDepthPoint(p):p.x+p.y}
  function groundAt(s,p){
    const g=call('placementGroundZ',s);
    if(Number.isFinite(g))return g;
    if(Number.isFinite(s.groundZ))return Number(s.groundZ);
    const t=call('terrainElevation',p);return Number.isFinite(t)?t:0;
  }

  // Free props must not stand on another structure.
  function blocked(s,p,r){
    for(const o of State.structures||[]){
      if(o===s||o.id===s.id||o.auto||o.type==='road'||o.type==='field')continue;
      if(o.a&&o.b){
        const dx=o.b.x-o.a.x,dy=o.b.y-o.a.y,L2=dx*dx+dy*dy||1,t=clamp01(((p.x-o.a.x)*dx+(p.y-o.a.y)*dy)/L2);
        if(Math.hypot(p.x-o.a.x-dx*t,p.y-o.a.y-dy*t)<(Number(o.width)||.5)/2+r*.7)return true;
      }else{
        const c=call('structureCenter',o)||{x:o.x,y:o.y},R=Number(call('pointRadius',o))||.5;
        if(Number.isFinite(c?.x)&&Math.hypot(p.x-c.x,p.y-c.y)<R+r*.7)return true;
      }
    }
    return false;
  }
  // Horizontal radius of a model (U), cached.
  const radii=new Map();
  function radius(name){
    if(radii.has(name))return radii.get(name);
    let r=0;for(const part of Object.values(MODELS()?.models?.[name]?.parts||{}))
      for(let i=0;i<part.p.length;i+=3)r=Math.max(r,Math.hypot(part.p[i],part.p[i+1]));
    radii.set(name,r);return r;
  }

  // The props for a site at progress p: [{model, parts, x, y, z, yaw}], pure of drawing.
  function plan(s,p=call('constructionProgress',s)??1){
    const kind=siteKind(s);if(!kind||!(p<1)||!MODELS())return[];
    const phase=phaseOf(p),fp=footprint(s);if(!fp)return[];
    const {bay,storey,reach}=units(),out=[];
    // Scaffold on the faces turned to the camera (figures and props are painted over the
    // site, so a scaffold behind it would show through the walls).
    if(kind.scaffold&&phase!=='prep'){
      const standing=built(s,kind,p),A=window.ConquerAssembly,runs=[];
      for(let i=0;i<fp.pts.length;i++){
        const a=fp.pts[i],b=fp.pts[(i+1)%fp.pts.length],L=Math.hypot(b.x-a.x,b.y-a.y);
        if(L<bay*.9)continue;                  // wall heads and short jogs get no bay
        const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let n={x:(b.y-a.y)/L,y:-(b.x-a.x)/L};
        if(n.x*(m.x-fp.c.x)+n.y*(m.y-fp.c.y)<0)n={x:-n.x,y:-n.y};
        // Towers and gates are scaffolded all round (the assembly paints the site as one
        // depth-sorted picture, so the far side stays behind the walls); other sites only
        // on the faces turned to the camera.
        if(!ALL_ROUND.has(s.type)&&depth({x:m.x+n.x,y:m.y+n.y})-depth(m)<.25)continue;
        // A gate keeps its passage free: no scaffold on the faces the road goes through.
        if(s.type==='gate'&&Math.abs(n.x*Math.cos(Number(s.angle)||0)+n.y*Math.sin(Number(s.angle)||0))>.7)continue;
        // Each run stops at its own wall top (a nave is lower than its bell tower).
        const local=A?.has?.(s)?A.heightNear(s,a,b):null,top=Math.min(standing,Number.isFinite(local)?local:kind.H);
        // Nearest storey: the top deck ends just under the eaves, where the roofers work.
        runs.push({m,n,nb:Math.max(1,Math.floor(L/bay+.25)),levels:Math.max(1,Math.round(top/storey))});
      }
      // Storeys always stand on the ground and stack as the work rises; the module
      // budget is met by shortening the runs, never by dropping lower storeys.
      const stacked=runs.reduce((a,r)=>a+r.levels,0)||1;
      const perRun=Math.max(1,Math.min(MAX_RUN,Math.floor(MAX_BAY_STOREYS/stacked)));
      // A wall built section by section keeps its scaffold on the section being built.
      const fr=A?.has?.(s)?A.front(s,p):null;
      for(const r of runs){
        r.run=Math.min(r.nb,perRun);
        if(r.nb<=r.run){r.start=0;continue}
        if(fr!=null&&s.a&&s.b){
          const P={x:s.a.x+(s.b.x-s.a.x)*fr,y:s.a.y+(s.b.y-s.a.y)*fr},along=(P.x-r.m.x)*-r.n.y+(P.y-r.m.y)*r.n.x;
          r.start=Math.max(0,Math.min(r.nb-r.run,Math.round(along/bay+(r.nb-1)/2-(r.run-1)/2)));
        }else r.start=Math.round(raised(p)*(r.nb-r.run));
      }
      const k0=0;
      let ladderRun=runs.reduce((best,r)=>!best||r.run>best.run?r:best,null);
      for(const r of runs){
        const yaw=Math.atan2(r.n.y,r.n.x),side={x:-Math.sin(yaw),y:Math.cos(yaw)},levels=r.levels;
        for(let j=0;j<r.run;j++){
          const i=r.start+j,off=(i-(r.nb-1)/2)*bay,o={x:r.m.x+side.x*off,y:r.m.y+side.y*off},z0=groundAt(s,o);
          const last=j===r.run-1;
          for(let k=k0;k<levels;k++){
            const parts=['frame','deck'];
            if(i%2===0)parts.push('brace');
            if(last)parts.push('end');
            if(k===levels-1){parts.push('rail');if(last)parts.push('endRail')}
            out.push({model:'scaffoldBay',parts,x:o.x,y:o.y,z:z0+k*storey,yaw});
          }
        }
        if(r!==ladderRun)continue;
        // One ladder per storey, alternating ends of the run, leaning on the scaffold front.
        for(let k=k0;k<levels;k++){
          const j=(k%2)?r.run-1:0,off=(r.start+j-(r.nb-1)/2)*bay+(k%2?-.2:.2)*bay;
          const o={x:r.m.x+side.x*off+r.n.x*(reach+.03),y:r.m.y+side.y*off+r.n.y*(reach+.03)};
          out.push({model:'ladderShort',parts:['ladder'],x:o.x,y:o.y,z:groundAt(s,o)+k*storey+(k?.02:0),yaw});
        }
      }
    }
    // Free-standing props on the camera side, turned around the footprint.
    const free=[];
    if(phase!=='finish'){
      free.push({model:'materialPile',at:.55,skip:kind.brick?['stone']:kind.masonry?['bricks']:['stone','bricks']});
      free.push({model:kind.bench,at:-.6});
      if(kind.secondBench)free.push({model:'carpenterBench',at:-1.25});
      if(phase==='raise'&&kind.lift==='hoist')free.push({model:'hoist',at:1.35,lift:true});
    }
    const front=towardsCamera(),gap=kind.scaffold?reach+.08:.15;
    // The great wheel rides on the masonry it builds: on its highest part (a church's bell
    // tower) at the working level, raised with it, the jib turned towards the material pile.
    if(phase==='raise'&&kind.lift==='treadwheelCrane'){
      const at=window.ConquerAssembly?.has?.(s)&&window.ConquerAssembly.crownCenter(s)||fp.c;
      out.push({model:'treadwheelCrane',parts:Object.keys(MODELS().models.treadwheelCrane.parts),
        x:at.x,y:at.y,z:groundAt(s,at)+built(s,kind,p),yaw:front+.55});
    }
    for(const f of free){
      const r=radius(f.model);
      let placed=null;
      for(const d of [0,.3,-.3,.6,-.6,.9,-.9]){
        const a=front+f.at+d,dist=fp.r+gap+(f.lift?.1:r*.85);
        const c={x:fp.c.x+Math.cos(a)*dist,y:fp.c.y+Math.sin(a)*dist};
        if(!blocked(s,c,r)){placed={c,a};break}
      }
      if(!placed)continue;
      const parts=Object.keys(MODELS().models[f.model].parts).filter(n=>!(f.skip||[]).includes(n));
      out.push({model:f.model,parts,x:placed.c.x,y:placed.c.y,z:groundAt(s,placed.c),yaw:placed.a});
    }
    return out;
  }

  // World triangles for a plan, as one painter mesh with a group per placed part.
  function meshOf(items){
    const data=MODELS(),pal=data.palette,pos=[],col=[],gi=[],groups=[],groupBias=[];
    for(const it of items){
      const model=data.models[it.model],c=Math.cos(it.yaw),sn=Math.sin(it.yaw);
      for(const name of it.parts){
        const part=model.parts[name];if(!part)continue;
        const g=groups.length,start=pos.length;
        for(let t=0;t<part.c.length;t++){
          for(let k=0;k<3;k++){
            const v=part.i[t*3+k]*3,x=part.p[v],y=part.p[v+1];
            pos.push(it.x+x*c-y*sn,it.y+x*sn+y*c,it.z+part.p[v+2]);
          }
          col.push(pal[part.c[t]]);gi.push(g);
        }
        let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
        for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
        groups.push([cx/n,cy/n,cz/n]);groupBias.push(name==='ground'?-1e6:0);
      }
    }
    return{pos,col,gi,groups,groupBias};
  }

  // Meshes are rebuilt only when what is shown changes (phase, storey, run, view turn, move).
  const cache=new Map();
  function stateKey(s,p){
    const {storey}=units(),k=siteKind(s);
    return[s.id,phaseOf(p),k?Math.round(built(s,k,p)/storey*8):0,Math.round(raised(p)*20),State.view?.rotation||0,
      s.x,s.y,s.angle,s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.w,s.h,s.size,s.r,s.groundZ,(State.structures||[]).length].join('|');
  }
  function siteMesh(s){
    const p=call('constructionProgress',s)??1;if(!(p<1)||!(State.view?.scale>=MIN_SCALE))return null;
    const key=stateKey(s,p),hit=cache.get(s.id);
    if(hit&&hit.key===key)return hit.mesh;
    const items=plan(s,p),mesh=items.length?meshOf(items):null;
    cache.set(s.id,{key,mesh});
    return mesh;
  }
  function prune(){
    if(cache.size<64)return;
    const live=new Set((State.structures||[]).filter(s=>call('underConstruction',s)).map(s=>s.id));
    for(const id of cache.keys())if(!live.has(id))cache.delete(id);
  }
  // Paint the props of one site (called right after the site itself).
  // Sites assembled piece by piece paint their props with the building (ConquerAssembly.draw),
  // depth-sorted together; the others (timber structures) paint them here, cached.
  let uid=0;
  function drawSite(s){
    if(!MODELS()||!window.ConquerMesh3D||!(State.view?.scale>=MIN_SCALE))return false;
    if(window.ConquerAssembly?.has?.(s))return false;
    const c=call('structureCenter',s);
    if(c&&fn('worldPointVisible')&&!worldPointVisible(c,0,260))return false;
    const mesh=siteMesh(s);if(!mesh)return false;
    if(!mesh._uid)mesh._uid=++uid;
    window.ConquerMesh3D.drawCached(ctx,'props:'+s.id,String(mesh._uid),()=>[mesh],{x:c.x,y:c.y,z:groundAt(s,c)});
    prune();
    return true;
  }
  window.ConquerConstructionProps={PHASE,MAX_RUN,MAX_BAY_STOREYS,phaseOf,raised,siteKind,plan,meshOf,siteMesh,drawSite,units,
    clear:()=>cache.clear()};
})();
