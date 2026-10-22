'use strict';
// CONQUER event venues in 3D (docs/events/README.md): the street performance spot,
// the stage and the 6 x 10 festival ground, with the temporary setups of scheduled
// events. Models come from the Blender-built catalog (src/assets/event-models.js,
// tools/blender/build_events.py); feast tables and stalls reuse the civic props
// (src/assets/civic-models.js). Models are in the venue's local axes (front at -y,
// +z up, U). Palette keys heraldA / heraldB / heraldTrim take the realm heraldry
// (stands, arena, stages); models with livery 'pair' (knights' tents, lance rack,
// armour) take a random pair of primary colours per instance instead.
//
// Venue contract (data only; placement and scheduling are later modules):
//   {type:'eventVenue', venue:'streetSpot'|'stage'|'festivalGround', x, y, angle,
//    dressing?:'players'|'herald', w?, h?, event?:{setup, phase, progress?}}
// The festival ground shows its setup only while the event is preparing (props
// appear with progress), active, or clearing (props leave with progress).
(function(){
  const DATA=()=>window.ConquerEventModels;
  const CIVIC=()=>window.ConquerCivicModels;
  const VENUES={
    streetSpot:{w:1.6,h:1.6},
    stage:{w:2.4,h:1.2,dressings:{players:'stagePlayers',herald:'stageHerald'},dressing:'players'},
    festivalGround:{w:6,h:10}
  };
  // Setups of the festival ground, local U, biggest items first (they arrive first).
  // {m: event model or 'civic:<key>', x, y, a: heading, s: scale}. min = smallest ground.
  // Wagons are built +x forward.
  const H=Math.PI/2;
  const SETUPS={
    circus:{min:{w:6,h:10},items:[
      {m:'circusTent',x:0,y:1.9,a:0},
      {m:'tentOctagon',x:-2.0,y:-1.6,a:H,s:.7},{m:'tentSquare',x:2.05,y:-1.6,a:-H,s:.7},
      {m:'wagonCaravan',x:-1.35,y:-3.55,a:0},{m:'wagonCage',x:1.35,y:-3.55,a:0},
      {m:'wagonCargo',x:-.2,y:-4.55,a:Math.PI},{m:'podiumStreet',x:0,y:-1.5,a:0}]},   // the barker before the entrance
    joust:{min:{w:6,h:10},items:[
      {m:'standCovered',x:2.3,y:-.1,a:-H},{m:'standOpen',x:-2.35,y:.1,a:H},
      {m:'propTilt',x:0,y:-1.74,a:H},{m:'propTilt',x:0,y:1.74,a:H},
      {m:'tentOctagon',x:-1.85,y:3.9,a:0,s:.75},{m:'tentSquare',x:1.85,y:-3.95,a:Math.PI,s:.75},
      {m:'propLanceRack',x:1.9,y:2.35,a:-H},{m:'propShieldRack',x:-1.95,y:-2.4,a:H},
      {m:'propWeaponRack',x:-.85,y:-4.4,a:0},{m:'propArmourStand',x:.85,y:4.45,a:Math.PI}]},
    camp:{min:{w:6,h:10},items:[
      {m:'tentOctagon',x:-1.55,y:-3.55,a:0},{m:'tentSquare',x:1.6,y:-3.6,a:0},
      {m:'tentSquare',x:-1.6,y:-.55,a:H},{m:'tentOctagon',x:1.55,y:-.5,a:-H},
      {m:'propWeaponRack',x:-2.2,y:1.75,a:0},{m:'propSpearRack',x:-.6,y:1.75,a:0},
      {m:'propShieldRack',x:1.1,y:1.75,a:0},{m:'propLanceRack',x:2.45,y:2.6,a:-H},
      {m:'propArmourPile',x:-2.0,y:3.35,a:.4},{m:'propArmourCrate',x:-.4,y:3.5,a:-.2},
      {m:'propArmourStand',x:.9,y:3.4,a:Math.PI},{m:'propArmourStand',x:1.6,y:4.3,a:Math.PI-.3}]},
    feast:{min:{w:6,h:10},items:[
      {m:'stagePlayers',x:-.26,y:4.1,a:0},
      {m:'civic:stall',x:-1.9,y:-3.9,a:H},{m:'civic:stall',x:1.9,y:-3.9,a:-H},
      {m:'civic:prop_tablePergola',x:0,y:-3.6,a:0,s:1.25},
      {m:'civic:prop_tableSet',x:-1.5,y:-1.2,a:0,s:1.3},{m:'civic:prop_tableSet',x:1.5,y:-1.2,a:0,s:1.3},
      {m:'civic:prop_tableSet',x:-1.5,y:1.0,a:0,s:1.3},{m:'civic:prop_tableSet',x:1.5,y:1.0,a:0,s:1.3},
      {m:'civic:prop_tableBarrel',x:0,y:-.1,a:.5,s:1.3},{m:'podiumStreet',x:-2.2,y:2.6,a:.4}]},
    theatre:{min:{w:6,h:10},items:[
      {m:'stageTheatre',x:0,y:3.95,a:0},{m:'standOpen',x:0,y:-4.1,a:Math.PI},
      {m:'civic:prop_tableBarrel',x:-2.3,y:-1.5,a:0,s:1.3},{m:'podiumStreet',x:2.2,y:-1.2,a:-.6}]},
    arena:{min:{w:8.4,h:9.2},items:[{m:'arenaU',x:0,y:.2,a:0}]}
  };
  const SHOWN_PHASES=new Set(['preparing','active','clearing']);
  const GROUND=['#7f9a55','#6c8648'];

  const is=s=>s?.type==='eventVenue'&&!!VENUES[s.venue];
  const sizeOf=s=>s.venue==='festivalGround'?{w:Number(s.w)||VENUES.festivalGround.w,h:Number(s.h)||VENUES.festivalGround.h}:{w:VENUES[s.venue].w,h:VENUES[s.venue].h};
  const fits=(setup,size)=>!!SETUPS[setup]&&size.w>=SETUPS[setup].min.w-1e-9&&size.h>=SETUPS[setup].min.h-1e-9;
  // Setups a festival ground of this size can host.
  function setupsFor(s){const size=sizeOf(s);return Object.keys(SETUPS).filter(k=>fits(k,size))}
  // Model of a venue itself: the podium, the dressed stage, or null (open ground).
  function venueModel(s){
    if(!is(s))return null;
    if(s.venue==='streetSpot')return 'podiumStreet';
    if(s.venue==='stage'){const v=VENUES.stage;return v.dressings[s.dressing]||v.dressings[v.dressing]}
    return null;
  }
  // Setup items visible now: all while active, a growing / shrinking share while
  // the event is preparing / clearing.
  function setupItems(s){
    if(!is(s)||s.venue!=='festivalGround'||!s.event)return[];
    const {setup,phase}=s.event;
    if(!SHOWN_PHASES.has(phase)||!fits(setup,sizeOf(s)))return[];
    const items=SETUPS[setup].items,p=Math.max(0,Math.min(1,Number(s.event.progress??1)));
    if(phase==='preparing')return items.slice(0,Math.ceil(p*items.length));
    if(phase==='clearing')return items.slice(0,items.length-Math.ceil(p*items.length));
    return items;
  }
  function catalog(ref){
    return ref.startsWith('civic:')?{data:CIVIC(),key:ref.slice(6),civic:true}:{data:DATA(),key:ref,civic:false};
  }
  const has=s=>{
    if(!is(s)||!DATA()?.models)return false;
    const k=venueModel(s);return k?!!DATA().models[k]:true;
  };

  // Indexed parts expanded once into flat triangle lists (per catalog).
  const expanded=new Map();
  function parts(ref){
    let out=expanded.get(ref);if(out)return out;
    const {data,key}=catalog(ref),model=data?.models?.[key];
    if(!model)return null;
    out=[];
    for(const [name,part] of Object.entries(model.parts)){
      const v=new Float32Array(part.i.length*3);
      for(let k=0;k<part.i.length;k++){const j=part.i[k]*3;v[k*3]=part.p[j];v[k*3+1]=part.p[j+1];v[k*3+2]=part.p[j+2]}
      out.push({name,v,c:part.c});
    }
    expanded.set(ref,out);return out;
  }
  // Primary colours for the knights' pairs: every ordered pair of two different ones.
  const PRIMARY=['#b8322c','#2f56a6','#d9b43a'];
  const PAIRS=PRIMARY.flatMap(a=>PRIMARY.filter(b=>b!==a).map(b=>[a,b]));
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  // Deterministic pair for an instance key (map seed + venue + item).
  const pairFor=key=>PAIRS[hash(((typeof State!=='undefined'&&State.seed)||1)+'|'+key)%PAIRS.length];
  const liveryOf=ref=>{const {data,key}=catalog(ref);return data?.models?.[key]?.livery||'realm'};
  // Palette of a catalog: the livery keys follow the realm heraldry (c1, c2 field,
  // c4 outline), or the instance's primary pair for 'pair' models.
  const palCache=new Map();
  function palette(ref,pair){
    const {data,civic}=catalog(ref),h=(typeof State!=='undefined'&&State.heraldry)||{};
    const valid=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
    const usePair=pair&&liveryOf(ref)==='pair';
    const tag=(civic?'civic|':'event|')+(usePair?'pair|'+pair.join('|'):[h.c1,h.c2,h.c4].join('|'));
    const hit=palCache.get(tag);if(hit&&hit.data===data)return hit.pal;
    const over=usePair?{heraldA:pair[0],heraldB:pair[1]}:{heraldA:h.c1,heraldB:h.c2,heraldTrim:h.c4};
    const pal=data.palette.map((hex,i)=>{const k=data.paletteKeys[i];return valid(over[k])?over[k]:hex});
    palCache.set(tag,{data,pal});return pal;
  }
  // World triangles of a model at place {x,y,angle,scale} (painter / builder format);
  // pair: [colourA, colourB] for 'pair' livery models (default: from place.key).
  function triangles(ref,place,ground,pair){
    const ps=parts(ref);if(!ps)return null;
    const pal=palette(ref,pair||(liveryOf(ref)==='pair'?pairFor(place.key||ref):null)),a=Number(place.angle)||0,c=Math.cos(a),sn=Math.sin(a),k=place.scale||1,z0=ground||0;
    const pos=[],col=[],gi=[],groups=[],groupBias=[];
    for(const part of ps){
      const g=groups.length,start=pos.length,v=part.v;
      for(let i=0;i<v.length;i+=3){
        const x=v[i]*k,y=v[i+1]*k;
        pos.push(place.x+x*c-y*sn,place.y+x*sn+y*c,z0+v[i+2]*k);
      }
      for(const ci of part.c){col.push(pal[ci]);gi.push(g)}
      let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
      for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
      groups.push([cx/n,cy/n,cz/n]);groupBias.push(part.name.startsWith('ground')?-1e6:0);
    }
    return{pos,col,gi,groups,groupBias};
  }
  // Local footprint (U) of a model at a heading and scale: axis-aligned bounds.
  const boundsCache=new Map();
  function modelBounds(ref){
    let b=boundsCache.get(ref);if(b)return b;
    const ps=parts(ref);if(!ps)return null;
    b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
    for(const p of ps)for(let i=0;i<p.v.length;i+=3){
      b.x0=Math.min(b.x0,p.v[i]);b.x1=Math.max(b.x1,p.v[i]);b.y0=Math.min(b.y0,p.v[i+1]);b.y1=Math.max(b.y1,p.v[i+1]);
    }
    boundsCache.set(ref,b);return b;
  }
  function itemRect(it){
    const b=modelBounds(it.m);if(!b)return null;
    const k=it.s||1,c=Math.cos(it.a||0),sn=Math.sin(it.a||0);
    const pts=[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]].map(([x,y])=>({x:it.x+(x*c-y*sn)*k,y:it.y+(x*sn+y*c)*k}));
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    return{x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
  }
  // Venue footprint as a world polygon (for placement and reservations).
  function footprint(s){
    const {w,h}=sizeOf(s),a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);
    return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:s.x+x*c-y*sn,y:s.y+x*sn+y*c}));
  }
  const toWorld=(s,x,y)=>{const a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);return{x:s.x+x*c-y*sn,y:s.y+x*sn+y*c}};
  // The idle festival ground: a green pad with a darker border, painted first.
  function groundMesh(s,z){
    const {w,h}=sizeOf(s),pos=[],col=[];
    const quad=(x0,y0,x1,y1,dz,colour)=>{
      const q=[toWorld(s,x0,y0),toWorld(s,x1,y0),toWorld(s,x1,y1),toWorld(s,x0,y1)];
      for(const t of [[0,1,2],[0,2,3]]){for(const i of t)pos.push(q[i].x,q[i].y,z+dz);col.push(colour)}
    };
    const e=.12;
    quad(-w/2,-h/2,w/2,h/2,.006,GROUND[1]);
    quad(-w/2+e,-h/2+e,w/2-e,h/2-e,.012,GROUND[0]);
    return{pos,col,gi:col.map(()=>0),groups:[[s.x,s.y,z]],groupBias:[-1e6]};
  }
  function groundZ(s){
    if(typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ))return structureProjectionGroundZ;
    if(Number.isFinite(s.groundZ))return s.groundZ;
    return typeof terrainElevation==='function'?terrainElevation(s):0;
  }
  // All meshes of a venue, cached per structure state.
  const meshCache=new Map();
  function meshes(s,ground){
    const h=(typeof State!=='undefined'&&State.heraldry)||{};
    const key=[s.venue,s.dressing,s.x,s.y,s.angle||0,s.w,s.h,ground,s.event?.setup,s.event?.phase,s.event?.progress,h.c1,h.c2,h.c4,State.seed].join('|');
    const hit=meshCache.get(s);if(hit&&hit.key===key)return hit.list;
    const list=[];
    const vm=venueModel(s);
    if(vm)list.push(triangles(vm,s,ground));
    else list.push(groundMesh(s,ground));
    const id=s.id??(s.x+','+s.y);
    setupItems(s).forEach((it,i)=>{
      const p=toWorld(s,it.x,it.y);
      const mesh=triangles(it.m,{x:p.x,y:p.y,angle:(s.angle||0)+(it.a||0),scale:it.s||1,key:id+':'+s.event.setup+':'+i},ground);
      if(mesh)list.push(mesh);
    });
    meshCache.set(s,{key,list:list.filter(Boolean)});
    return meshCache.get(s).list;
  }
  // 2.5D: paint into the current ctx.
  function draw(s,preview=false){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const list=meshes(s,groundZ(s));
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,list,window.ConquerMesh3D.gameView());
    ctx.restore();
    return true;
  }
  // WebGL: add to a world3d meshBuilder with fixed-light shaded colours.
  function addToBuilder(m,s,ground){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const g=Number.isFinite(ground)?ground:Number.isFinite(s.groundZ)?s.groundZ:(typeof terrainElevation==='function'?terrainElevation(s):0);
    for(const mesh of meshes(s,g)){
      const p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){
        const o=t*9;
        m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
      }
    }
    return true;
  }
  window.ConquerEvents3D={VENUES,SETUPS,PAIRS,is,has,sizeOf,setupsFor,venueModel,setupItems,pairFor,liveryOf,parts,triangles,itemRect,footprint,meshes,draw,addToBuilder};
})();
