'use strict';
// CONQUER event venues in 3D (docs/events/README.md): the street performance spot,
// the stage and the 14 x 10 festival ground, with the temporary setups of scheduled
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
    festivalGround:{w:14,h:10},
    // Permanent lot of the U arena with the participants' camp: its setup is always shown.
    arenaLot:{w:18,h:14,setup:'arenaLot'}
  };
  // Setups of the 14 x 10 festival ground (x along the long side, front at -y),
  // local U, biggest items first (they arrive first). {m: event model or
  // 'civic:<key>', x, y, a: heading, s: scale}. min = smallest ground that holds
  // the setup. Wagons are built +x forward; stands face their local -y.
  const H=Math.PI/2,PI=Math.PI,G={w:14,h:10};
  const SETUPS={
    joust:{min:G,items:[
      // Lists down the long axis: a three-segment tilt, two stands on each side.
      {m:'standCovered',x:-2.1,y:2.5,a:0},{m:'standCovered',x:2.1,y:2.5,a:0},
      {m:'standOpen',x:-2.1,y:-2.5,a:PI},{m:'standOpen',x:2.1,y:-2.5,a:PI},
      {m:'propTilt',x:-3.47,y:0,a:0},{m:'propTilt',x:0,y:0,a:0},{m:'propTilt',x:3.47,y:0,a:0},
      {m:'tentOctagon',x:-5.6,y:3.6,a:0},{m:'tentSquare',x:5.65,y:3.65,a:0},
      {m:'tentSquare',x:-5.65,y:-3.65,a:PI},{m:'tentOctagon',x:5.6,y:-3.6,a:PI},
      {m:'propLanceRack',x:6.5,y:1.6,a:-H},{m:'propLanceRack',x:-6.5,y:-1.6,a:H},
      {m:'propShieldRack',x:-6.5,y:1.6,a:H},{m:'propArmourStand',x:6.5,y:-1.7,a:H},
      {m:'propWeaponRack',x:-4.6,y:1.75,a:0},{m:'propArmourStand',x:4.6,y:-1.8,a:PI}]},
    circus:{min:G,items:[
      {m:'circusTent',x:0,y:.6,a:0},
      {m:'tentOctagon',x:-4.6,y:2.6,a:0},{m:'tentSquare',x:4.6,y:2.6,a:0},
      {m:'wagonCaravan',x:-5.6,y:-1.5,a:H},{m:'wagonCage',x:5.6,y:-1.5,a:H},
      {m:'wagonCaravan',x:3.4,y:-3.9,a:PI},{m:'wagonCargo',x:-3.6,y:-3.9,a:0},
      {m:'wagonCaravan',x:-6.4,y:2.7,a:H},{m:'wagonCargo',x:6.4,y:2.6,a:-H},
      {m:'podiumStreet',x:0,y:-3.0,a:0},   // the barker before the big top's entrance
      {m:'circusBooth',x:-1.4,y:-3.3,a:.2},{m:'circusBooth',x:1.4,y:-3.3,a:-.2},
      {m:'podiumStreet',x:-3.0,y:-1.2,a:.5},   // a juggler beside the big top
      {m:'propBunting',x:-2.5,y:-2.4,a:0},{m:'propBunting',x:2.5,y:-2.4,a:0},
      {m:'propBunting',x:-2.4,y:4.3,a:0},{m:'propBunting',x:0,y:4.3,a:0},{m:'propBunting',x:2.4,y:4.3,a:0},
      {m:'sc:haystack',x:6.4,y:-.3,a:0,s:1},{m:'sc:hayBales',x:5.7,y:.3,a:.3,s:1.3},
      {m:'sc:barrelGroup',x:-4.8,y:-3.0,a:0,s:1.3},{m:'sc:crateStack',x:4.9,y:-3.0,a:.4,s:1.3},
      {m:'sc:sackPile',x:-4.6,y:.2,a:0,s:1.3},{m:'sc:wheelStack',x:6.4,y:-3.4,a:0,s:1.3}]},
    feast:{min:G,items:[
      {m:'stagePlayers',x:-.26,y:4.1,a:0},
      {m:'civic:stall',x:-5.2,y:-4.2,a:0},{m:'civic:stall',x:-1.8,y:-4.2,a:0},
      {m:'civic:stall',x:1.8,y:-4.2,a:0},{m:'civic:stall',x:5.2,y:-4.2,a:0},
      {m:'civic:prop_tablePergola',x:-5.4,y:2.6,a:0,s:1.25},{m:'civic:prop_tablePergola',x:5.4,y:2.6,a:0,s:1.25},
      // Sixteen tables: two full rows of six and a row of four before the stage.
      ...[-2.6,-1.0].flatMap(y=>[-5.2,-3.5,-1.8,1.8,3.5,5.2].map(x=>({m:'civic:prop_tableSet',x,y,a:0,s:1.3}))),
      ...[-3.5,-1.8,1.8,3.5].map(x=>({m:'civic:prop_tableSet',x,y:.6,a:0,s:1.3})),
      {m:'civic:prop_tableBarrel',x:0,y:-.5,a:.5,s:1.3},{m:'civic:prop_tableBarrel',x:-6.2,y:-.5,a:0,s:1.3},
      {m:'civic:prop_tableBarrel',x:6.2,y:-.5,a:0,s:1.3},{m:'podiumStreet',x:-2.6,y:3.4,a:.4},
      {m:'podiumStreet',x:2.6,y:3.4,a:-.4},
      {m:'propBunting',x:0,y:-1.8,a:0},{m:'propBunting',x:0,y:1.6,a:0},
      {m:'sc:goodsMixed',x:-3.5,y:-4.3,a:0,s:1.3},{m:'sc:barrelGroup',x:0,y:-4.3,a:0,s:1.3},
      {m:'sc:sackPile',x:3.5,y:-4.3,a:0,s:1.3}]},
    tourney:{min:G,items:[
      // Melee in a fenced field: stands on both long sides, four knights' tents at the ends.
      {m:'standCovered',x:-2.1,y:3.2,a:0},{m:'standCovered',x:2.1,y:3.2,a:0},
      {m:'standOpen',x:-2.1,y:-3.8,a:PI},{m:'standOpen',x:2.1,y:-3.8,a:PI},
      ...[-3.5,-2.1,-.7,.7,2.1,3.5].flatMap(x=>[{m:'propFence',x,y:1.8,a:0},{m:'propFence',x,y:-2.4,a:0}]),
      ...[-4.2,4.2].flatMap(x=>[{m:'propFence',x,y:1.1,a:H},{m:'propFence',x,y:-1.7,a:H}]),   // gates in the middle of the ends
      {m:'tentOctagon',x:-5.65,y:2.6,a:0},{m:'tentSquare',x:5.7,y:2.65,a:0},
      {m:'tentSquare',x:-5.7,y:-2.65,a:PI},{m:'tentOctagon',x:5.65,y:-2.6,a:PI},
      {m:'propLanceRack',x:6.4,y:0,a:H},{m:'propShieldRack',x:-6.4,y:0,a:H},
      {m:'propWeaponRack',x:-5.2,y:0,a:H},{m:'propArmourStand',x:5.2,y:.3,a:-H},
      {m:'propArmourPile',x:5.4,y:-.6,a:.4}]},
    camp:{min:G,items:[
      ...[-4.6,0,4.6].flatMap((x,i)=>[{m:i%2?'tentSquare':'tentOctagon',x,y:-3.4,a:0},{m:i%2?'tentOctagon':'tentSquare',x,y:-.2,a:0}]),
      {m:'propWeaponRack',x:-5.5,y:2.3,a:0},{m:'propSpearRack',x:-3.6,y:2.3,a:0},
      {m:'propShieldRack',x:-1.6,y:2.3,a:0},{m:'propLanceRack',x:.4,y:2.6,a:H},
      {m:'propArmourPile',x:2.2,y:3.4,a:.4},{m:'propArmourCrate',x:4.0,y:3.4,a:-.2},
      {m:'propArmourStand',x:5.6,y:2.6,a:PI},{m:'propArmourStand',x:6.2,y:3.8,a:PI-.3},
      {m:'propLanceRack',x:-6.4,y:3.9,a:0}]},
    theatre:{min:G,items:[
      {m:'stageTheatre',x:0,y:3.95,a:0},
      {m:'standOpen',x:-2.1,y:-4.1,a:PI},{m:'standOpen',x:2.1,y:-4.1,a:PI},
      {m:'civic:prop_tableBarrel',x:-5.5,y:-1,a:0,s:1.3},{m:'civic:prop_tableBarrel',x:5.5,y:-1,a:0,s:1.3},
      {m:'podiumStreet',x:-5.2,y:3.4,a:.4},{m:'civic:stall',x:5.3,y:3.6,a:PI}]},
    arenaLot:{min:{w:18,h:14},fixed:true,items:[
      {m:'arenaU',x:0,y:.1,a:0},
      // Participants' camp: four tents down each side, pairs of primary colours.
      ...[-1,1].flatMap(sx=>[4.4,1.5,-1.4,-4.3].map((y,i)=>({m:(i+(sx>0))%2?'tentSquare':'tentOctagon',x:sx*6.6,y,a:-sx*H}))),
      {m:'propLanceRack',x:8.4,y:2.95,a:H},{m:'propShieldRack',x:-8.4,y:2.95,a:H},
      {m:'propWeaponRack',x:-8.4,y:0,a:H},{m:'propSpearRack',x:8.4,y:0,a:H},
      {m:'propArmourStand',x:8.4,y:-2.85,a:-H},{m:'propArmourPile',x:-8.4,y:-2.85,a:.4},
      {m:'propArmourCrate',x:-8.3,y:5.9,a:0},{m:'propArmourStand',x:8.4,y:5.9,a:-H},
      // Baggage behind the arc and goods by the gate.
      {m:'wagonCaravan',x:-3.6,y:6.3,a:0},{m:'wagonCargo',x:3.6,y:6.3,a:PI},
      {m:'sc:haystack',x:0,y:6.4,a:0,s:1},{m:'sc:hayBales',x:-1.4,y:6.5,a:.2,s:1.3},
      {m:'sc:sackPile',x:1.4,y:6.5,a:0,s:1.3},
      {m:'wagonCargo',x:-5.0,y:-6.4,a:0},{m:'sc:barrelGroup',x:-3.2,y:-6.4,a:0,s:1.3},
      {m:'sc:crateStack',x:3.2,y:-6.4,a:.3,s:1.3},{m:'sc:firewood',x:4.4,y:-6.3,a:0,s:1.3},
      {m:'sc:logPile',x:5.9,y:-6.4,a:0,s:1.3},{m:'circusBooth',x:-7.6,y:-6.2,a:PI},   // faces the lot: its queue forms inside
      {m:'propBunting',x:-6.0,y:6.6,a:0},{m:'propBunting',x:6.0,y:6.6,a:0}]}
  };
  const SHOWN_PHASES=new Set(['preparing','active','clearing']);
  const GROUND=['#7f9a55','#6c8648'];

  const is=s=>s?.type==='eventVenue'&&!!VENUES[s.venue];
  const sizeOf=s=>s.venue==='festivalGround'?{w:Number(s.w)||VENUES.festivalGround.w,h:Number(s.h)||VENUES.festivalGround.h}:{w:VENUES[s.venue].w,h:VENUES[s.venue].h};
  const fits=(setup,size)=>!!SETUPS[setup]&&size.w>=SETUPS[setup].min.w-1e-9&&size.h>=SETUPS[setup].min.h-1e-9;
  // Setups a festival ground of this size can host.
  function setupsFor(s){const size=sizeOf(s);return Object.keys(SETUPS).filter(k=>!SETUPS[k].fixed&&fits(k,size))}
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
    if(is(s)&&VENUES[s.venue].setup)return SETUPS[VENUES[s.venue].setup].items;   // permanent lot
    if(!is(s)||s.venue!=='festivalGround'||!s.event)return[];
    const {setup,phase}=s.event;
    if(!SHOWN_PHASES.has(phase)||!fits(setup,sizeOf(s)))return[];
    const items=SETUPS[setup].items,p=Math.max(0,Math.min(1,Number(s.event.progress??1)));
    if(phase==='preparing')return items.slice(0,Math.ceil(p*items.length));
    if(phase==='clearing')return items.slice(0,items.length-Math.ceil(p*items.length));
    return items;
  }
  // Scatter goods (src/assets/scatter-model.js) as a one-part model of the same shape.
  const SCATTER=()=>window.ConquerScatterModel;
  const scatterCache=new Map();
  function scatterData(){
    const m=SCATTER();if(!m?.assets)return null;
    let d=scatterCache.get(m);if(d)return d;
    const models={};
    for(const [k,a] of Object.entries(m.assets))models[k]={parts:{body:{p:a.v,i:a.i,c:a.c}},livery:'realm'};
    d={palette:m.palette,paletteKeys:m.paletteKeys||m.palette.map(()=>''),models};
    scatterCache.set(m,d);return d;
  }
  // 'civic:<key>' civic props, 'sc:<asset>' scatter goods, otherwise an event model.
  function catalog(ref){
    if(ref.startsWith('civic:'))return{data:CIVIC(),key:ref.slice(6),civic:true};
    if(ref.startsWith('sc:'))return{data:scatterData(),key:ref.slice(3),civic:true};
    return{data:DATA(),key:ref,civic:false};
  }
  const has=s=>{
    if(!is(s)||!DATA()?.models)return false;
    const k=venueModel(s);return k?!!DATA().models[k]:true;
  };

  // Indexed parts expanded once into flat triangle lists (per catalog). A part with
  // wind-blown cloth (part.f) is split: its fixed triangles, and the cloth triangles
  // with a flutter weight w (per vertex) and wave direction d (3 per vertex).
  const expanded=new Map();
  function parts(ref){
    let out=expanded.get(ref);if(out)return out;
    const {data,key}=catalog(ref),model=data?.models?.[key];
    if(!model)return null;
    out=[];
    for(const [name,part] of Object.entries(model.parts)){
      const fk=new Map();if(part.f)part.f.i.forEach((j,k)=>fk.set(j,k));
      const fixed=[],cloth=[];
      for(let t=0;t<part.c.length;t++)(fk.size&&[0,1,2].some(q=>fk.has(part.i[t*3+q]))?cloth:fixed).push(t);
      const build=(tris,isCloth)=>{
        const v=new Float32Array(tris.length*9),c=new Array(tris.length);
        const w=isCloth?new Float32Array(tris.length*3):null,d=isCloth?new Float32Array(tris.length*9):null;
        tris.forEach((t,n)=>{
          c[n]=part.c[t];
          for(let q=0;q<3;q++){
            const j=part.i[t*3+q],o=n*9+q*3;
            v[o]=part.p[j*3];v[o+1]=part.p[j*3+1];v[o+2]=part.p[j*3+2];
            if(isCloth&&fk.has(j)){const k=fk.get(j);w[n*3+q]=part.f.w[k];d[o]=part.f.d[k*3];d[o+1]=part.f.d[k*3+1];d[o+2]=part.f.d[k*3+2]}
          }
        });
        return{name,v,c,w,d,cloth:isCloth};
      };
      if(fixed.length)out.push(build(fixed,false));
      if(cloth.length)out.push(build(cloth,true));
    }
    expanded.set(ref,out);return out;
  }
  const hasCloth=ref=>!!parts(ref)?.some(p=>p.cloth);
  // Primary colours for the knights' pairs: every ordered pair of two different ones.
  // Red, blue, yellow plus green and white: 20 ordered pairs, so every tent and piece
  // of gear in one venue gets its own pair (see uniquePairs).
  const PRIMARY=['#b8322c','#2f56a6','#d9b43a','#3f7d3a','#ece6d6'];
  const PAIRS=PRIMARY.flatMap(a=>PRIMARY.filter(b=>b!==a).map(b=>[a,b]));
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  // Deterministic pair for an instance key (map seed + venue + item).
  const pairFor=key=>PAIRS[hash(((typeof State!=='undefined'&&State.seed)||1)+'|'+key)%PAIRS.length];
  // Pavilions add a scheme to their pair [A,B,scheme]: how the two colours fill walls,
  // roof gores and valance (A/B alternating per role), so one pair gives several tents.
  // gored: striped walls, countercoloured gores; solid: all A with a B valance;
  // roof: plain B walls under A/B gores; inverted: plain A walls, plain B roof.
  const SCHEMES={
    gored:(a,b)=>({wallA:a,wallB:b,roofA:b,roofB:a,valA:a,valB:b}),
    solid:(a,b)=>({wallA:a,wallB:a,roofA:a,roofB:a,valA:b,valB:b}),
    roof:(a,b)=>({wallA:b,wallB:b,roofA:a,roofB:b,valA:a,valB:a}),
    inverted:(a,b)=>({wallA:a,wallB:a,roofA:b,roofB:b,valA:a,valB:b})
  };
  const SCHEME_KEYS=Object.keys(SCHEMES);
  // Warm, cool or neutral: neighbouring tents never share a colour nor a warm lead colour.
  const WARMTH={'#b8322c':'w','#d9b43a':'w','#2f56a6':'c','#3f7d3a':'c','#ece6d6':'n'};
  const liveryOf=ref=>{const {data,key}=catalog(ref);return data?.models?.[key]?.livery||'realm'};
  // Palette of a catalog: the livery keys follow the realm heraldry (c1, c2 field,
  // c4 outline), or the instance's primary pair for 'pair' models.
  const palCache=new Map();
  function palette(ref,pair){
    const {data,civic}=catalog(ref),h=(typeof State!=='undefined'&&State.heraldry)||{};
    const valid=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
    const usePair=pair&&liveryOf(ref)==='pair';
    const tag=(civic?ref.slice(0,ref.indexOf(':')+1):'event|')+(usePair?'pair|'+pair.join('|'):[h.c1,h.c2,h.c4].join('|'));
    const hit=palCache.get(tag);if(hit&&hit.data===data)return hit.pal;
    const over=usePair?{heraldA:pair[0],heraldB:pair[1],...SCHEMES[pair[2]||'gored'](pair[0],pair[1])}:{heraldA:h.c1,heraldB:h.c2,heraldTrim:h.c4,...SCHEMES.gored(h.c1,h.c2)};
    const pal=data.palette.map((hex,i)=>{const k=data.paletteKeys[i];return valid(over[k])?over[k]:hex});
    palCache.set(tag,{data,pal});return pal;
  }
  // World triangles of a model at place {x,y,angle,scale} (painter / builder format);
  // pair: [colourA, colourB] for 'pair' livery models (default: from place.key).
  // opts.only: 'fixed' (static scene) or 'cloth' (dynamic layer); opts.wave: {t, amp}
  // bends the cloth along its wave direction, more towards its free end.
  function triangles(ref,place,ground,pair,opts={}){
    const ps=parts(ref);if(!ps)return null;
    const pal=palette(ref,pair||(liveryOf(ref)==='pair'?pairFor(place.key||ref):null)),a=Number(place.angle)||0,c=Math.cos(a),sn=Math.sin(a),k=place.scale||1,z0=ground||0;
    const pos=[],col=[],gi=[],groups=[],groupBias=[];
    const wave=opts.wave,ph=(place.x||0)*.7+(place.y||0)*1.3;
    for(const part of ps){
      if(opts.only==='fixed'&&part.cloth||opts.only==='cloth'&&!part.cloth)continue;
      const g=groups.length,start=pos.length,v=part.v,flap=wave&&part.cloth;
      for(let i=0;i<v.length;i+=3){
        let lx=v[i],ly=v[i+1],lz=v[i+2];
        if(flap){
          const w=part.w[i/3];
          if(w){
            // Travelling wave from the anchor to the free end, with a gentle sway.
            const off=wave.amp*w*(Math.sin(wave.t*3.2+ph-w*3.1)+.35*Math.sin(wave.t*1.3+ph*1.7));
            lx+=part.d[i]*off;ly+=part.d[i+1]*off;lz+=part.d[i+2]*off-wave.amp*.25*w*w;
          }
        }
        const x=lx*k,y=ly*k;
        pos.push(place.x+x*c-y*sn,place.y+x*sn+y*c,z0+lz*k);
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
    return{pos,col,gi:col.map(()=>0),groups:[[s.x,s.y,z]],groupBias:[-2e6]};   // under the models' own ground parts (arena sand)
  }
  function groundZ(s){
    if(typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ))return structureProjectionGroundZ;
    if(Number.isFinite(s.groundZ))return s.groundZ;
    return typeof terrainElevation==='function'?terrainElevation(s):0;
  }
  // Nothing loose is set out in rows: deterministic random turn and shift per instance.
  // Tents of the camp-like setups: ±40° and up to 75% of their size. Scatter goods,
  // racks and armour in every setup: any heading (±35° for gear) and up to 200%.
  const JITTER_SETUPS=new Set(['arenaLot','tourney','circus']);
  // Candidate positions of an item, from the full random turn and shift down to its
  // set place (always last).
  function jitterCandidates(s,it,key){
    const setup=s.event?.setup||VENUES[s.venue]?.setup;
    const tent=/^tent/.test(it.m)&&JITTER_SETUPS.has(setup),loose=/^(sc:|propArmour|propWeapon|propSpear|propShield|propLance)/.test(it.m);
    if(!tent&&!loose)return[it];
    const b=modelBounds(it.m),size=b?Math.max(b.x1-b.x0,b.y1-b.y0)*(it.s||1):0;
    const r=k=>hash(((typeof State!=='undefined'&&State.seed)||1)+'|jit|'+key+'|'+k)/4294967296*2-1;
    const turn=tent?40*Math.PI/180:/^sc:/.test(it.m)?Math.PI:35*Math.PI/180,shift=tent?.75:2;
    const out=[];
    for(const f of [1,.7,.45,.25,.1]){
      const dx=r('x'),dy=r('y'),da=r('a');
      out.push({...it,a:(it.a||0)+da*turn*Math.max(f,.5),x:it.x+dx*shift*size*f,y:it.y+dy*shift*size*f});
      // A second draw at the same scale tries another direction before shrinking.
      out.push({...it,a:(it.a||0)+r('b'+f)*turn*Math.max(f,.5),x:it.x+r('u'+f)*shift*size*f,y:it.y+r('v'+f)*shift*size*f});
    }
    out.push(it);
    return out;
  }
  // Final places of a venue's setup: each jittered item keeps clear of the items
  // already placed, of the set places of those still to come (so any of them can
  // fall back to its own) and of the venue's edge; otherwise it stays where it was set.
  function placedItems(s){
    const items=setupItems(s);if(!items.length)return items;
    const {w,h}=sizeOf(s),id=s.id??(s.x+','+s.y),M=.04;
    const base=items.map(itemRect),placed=[];
    const clear=(a,b)=>!a||!b||a.x1<=b.x0-M||b.x1<=a.x0-M||a.y1<=b.y0-M||b.y1<=a.y0-M;   // M: a small gap
    const inside=r=>!r||r.x0>=-w/2&&r.x1<=w/2&&r.y0>=-h/2&&r.y1<=h/2;
    return items.map((it,i)=>{
      const cands=jitterCandidates(s,it,id+':'+i);
      let pick=it,rect=base[i];
      for(const c of cands){
        const r=c===it?base[i]:itemRect(c);
        // The arena itself fills its lot: only the jitter has to stay inside.
        if(c!==it&&!inside(r))continue;
        if(c!==it&&(!placed.every(p=>clear(r,p))||!base.every((b,j)=>j<=i||clear(r,b))))continue;
        pick=c;rect=r;break;
      }
      placed.push(rect);
      return pick;
    });
  }
  // All fixed meshes of a venue, cached per structure state with the placed instances
  // (the dynamic layer re-poses their cloth every frame).
  const meshCache=new Map();
  function meshes(s,ground){
    const h=(typeof State!=='undefined'&&State.heraldry)||{};
    const key=[s.venue,s.dressing,s.x,s.y,s.angle||0,s.w,s.h,ground,s.event?.setup,s.event?.phase,s.event?.progress,h.c1,h.c2,h.c4,State.seed].join('|');
    const hit=meshCache.get(s);if(hit&&hit.key===key)return hit.list;
    const list=[],inst=[];
    const place=(ref,pl,pair)=>{inst.push({ref,place:pl,pair});return triangles(ref,pl,ground,pair,{only:'fixed'})};
    const vm=venueModel(s);
    if(vm)list.push(place(vm,s,null));
    else list.push(groundMesh(s,ground));
    const id=s.id??(s.x+','+s.y);
    // Distinct pairs within the venue: a seeded shuffle of PAIRS dealt in item order.
    // Tents draw from unordered pairs (red/blue and blue/red count as the same tent),
    // the other gear from the ordered ones.
    const seed=(typeof State!=='undefined'&&State.seed)||1;
    const shuffle=(list,tag)=>list.map((p,k)=>[hash(seed+'|'+tag+'|'+id+'|'+k),p]).sort((a,b)=>a[0]-b[0]).map(e=>e[1]);
    const tentDeck=shuffle(PAIRS.filter(([a,b])=>PRIMARY.indexOf(a)<PRIMARY.indexOf(b)),'tents')
      .map((p,k)=>hash(seed+'|flip|'+id+'|'+k)%2?[p[1],p[0]]:p);
    const deck=shuffle(PAIRS,'gear');
    let dealt=0;
    // Tents: the first pair left in the deck that shares no colour with the nearest tent
    // already pitched and does not put warm next to warm; then a scheme other than its.
    const pitched=[],left=[...tentDeck];
    const tentPair=(it,i)=>{
      const near=pitched.reduce((m,t)=>{const d=Math.hypot(t.x-it.x,t.y-it.y);return!m||d<m.d?{d,t}:m},null)?.t;
      const ok=p=>!near||!p.some(c=>near.pair.includes(c))&&!(WARMTH[p[0]]==='w'&&WARMTH[near.pair[0]]==='w');
      if(!left.length)left.push(...tentDeck);
      const k=Math.max(0,left.findIndex(ok)),p=left.splice(k,1)[0];
      let sc=SCHEME_KEYS[hash(seed+'|scheme|'+id+'|'+i)%SCHEME_KEYS.length];
      if(near&&sc===near.pair[2])sc=SCHEME_KEYS[(SCHEME_KEYS.indexOf(sc)+1)%SCHEME_KEYS.length];
      const pair=[p[0],p[1],sc];pitched.push({x:it.x,y:it.y,pair});return pair;
    };
    placedItems(s).forEach((it,i)=>{
      const p=toWorld(s,it.x,it.y);
      const pair=liveryOf(it.m)!=='pair'?null:/^tent/.test(it.m)?tentPair(it,i):deck[dealt++%deck.length];
      const mesh=place(it.m,{x:p.x,y:p.y,angle:(s.angle||0)+(it.a||0),scale:it.s||1,key:id+':'+(s.event?.setup||VENUES[s.venue].setup)+':'+i},pair);
      if(mesh)list.push(mesh);
    });
    meshCache.set(s,{key,list:list.filter(Boolean),inst,ground});
    return meshCache.get(s).list;
  }
  // ---------- wind: flags, pennons, bunting and banners wave on the dynamic layer
  // Like the mill sails, the wave runs on real time while the game runs, stronger
  // with the weather's wind.
  let windT=0,lastWind=0;
  function windStrength(){
    try{const w=typeof currentWeather==='function'?Number(currentWeather().wind):NaN;return Number.isFinite(w)?Math.max(0,Math.min(1,w)):.3}catch{return .3}
  }
  function dynamicMeshes(){
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    const dt=lastWind?Math.min(.25,(now-lastWind)/1000):0;lastWind=now;
    if(typeof State!=='undefined'&&State.clock?.speed>0)windT+=dt;
    const wave={t:windT,amp:.035+.075*windStrength()},out=[];
    for(const s of (typeof State!=='undefined'&&State.structures)||[]){
      if(!is(s)||!has(s))continue;
      const g=Number.isFinite(s.groundZ)?s.groundZ:(typeof terrainElevation==='function'?terrainElevation(s):0);
      meshes(s,g);
      for(const ins of meshCache.get(s).inst){
        if(!hasCloth(ins.ref))continue;
        const m=triangles(ins.ref,ins.place,g,ins.pair,{only:'cloth',wave});
        if(m&&m.col.length)out.push(m);
      }
    }
    return out;
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
  // ---------- Builder: venues as placeable structures
  // The festival ground is a reservation, not a building (docs/events): no materials, no
  // building site. Podium, stage and arena are timber works with a short building site.
  const BUILD={
    streetSpot:{name:'Pulpito',cost:{wood:6},days:.5},
    stage:{name:'Palco',cost:{wood:24,gold:10},days:2},
    festivalGround:{name:'Spiazzo eventi',cost:{},days:0},
    arenaLot:{name:'Arena',cost:{wood:160,gold:80},days:12}
  };
  const SETUP_NAMES={joust:'Giostra',tourney:'Torneo',circus:'Circo',feast:'Sagra',camp:'Accampamento',theatre:'Teatro'};
  const PHASE_NAMES={idle:'libero',preparing:'allestimento',active:'in corso',clearing:'smontaggio'};
  const PREPARE_DAYS=.25,CLEAR_DAYS=.15;          // game days to set up / clear a festival ground
  function make(venue,opts={}){
    const {w,h}=VENUES[venue];
    const s={type:'eventVenue',venue,w,h,shape:'rect',functions:[]};
    if(venue==='stage')s.dressing=opts.dressing==='herald'?'herald':'players';
    if(venue==='festivalGround')s.event={setup:'joust',phase:'idle',progress:0};
    return s;
  }
  function label(s){
    const b=BUILD[s.venue],{w,h}=sizeOf(s);let t=b.name+' · '+w+'×'+h+'U';
    if(s.venue==='stage')t+=' · '+(s.dressing==='herald'?'annunci':'artisti di strada');
    if(s.venue==='festivalGround'&&s.event)t+=' · '+SETUP_NAMES[s.event.setup]+' · '+PHASE_NAMES[s.event.phase];
    return t;
  }
  const cost=s=>({...(BUILD[s.venue]?.cost||{})});
  const buildDays=s=>BUILD[s.venue]?.days||0;
  // Lifecycle of the festival grounds on the game clock: preparing -> active, clearing -> idle;
  // the static scene is refreshed only when the number of props on the ground changes.
  function tickEvents(){
    if(typeof State==='undefined')return;
    const day=State.clock?.day||0;let changed=false;
    for(const s of State.structures||[]){
      if(!is(s)||s.venue!=='festivalGround'||!s.event)continue;
      const ev=s.event,before=setupItems(s).length;
      if(ev.phase==='preparing'){
        ev.progress=Math.min(1,(day-(ev.since??day))/PREPARE_DAYS);
        if(ev.progress>=1){ev.phase='active';ev.progress=1;ev.since=day}
      }else if(ev.phase==='clearing'){
        ev.progress=Math.min(1,(day-(ev.since??day))/CLEAR_DAYS);
        if(ev.progress>=1){ev.phase='idle';ev.progress=0;ev.since=day}
      }
      if(setupItems(s).length!==before)changed=true;
    }
    if(changed)refresh();
  }
  function refresh(){
    if(typeof invalidateSceneCache==='function')invalidateSceneCache();
    window.ConquerWorld3D?.invalidate?.();
  }
  function setEvent(s,patch){
    const ev=s.event||(s.event={setup:'joust',phase:'idle',progress:0});
    Object.assign(ev,patch);
    refresh();
  }
  // Inspector: stage dressing, festival-ground setup and start / stop, rotation.
  function panelHtml(s){
    let html='';
    if(s.venue==='stage'){
      html+='<div class="slot"><div class="slot-label">Allestimento del palco</div><div class="grid">'+
        [['players','Artisti di strada'],['herald','Annunci pubblici']].map(([k,l])=>'<button data-event-dressing="'+k+'" class="'+((s.dressing||'players')===k?'active':'')+'">'+l+'</button>').join('')+'</div></div>';
    }
    if(s.venue==='festivalGround'){
      const ev=s.event||{setup:'joust',phase:'idle'},busy=ev.phase!=='idle';
      html+='<div class="slot"><div class="slot-label">Evento · '+PHASE_NAMES[ev.phase]+(ev.phase==='preparing'||ev.phase==='clearing'?' '+Math.round((ev.progress||0)*100)+'%':'')+'</div><div class="grid">'+
        setupsFor(s).map(k=>'<button data-event-setup="'+k+'" class="'+(ev.setup===k?'active':'')+'" '+(busy?'disabled':'')+'>'+SETUP_NAMES[k]+'</button>').join('')+'</div>'+
        '<div class="grid"><button data-event-start '+(busy?'disabled':'')+'>Avvia evento</button><button data-event-stop '+(ev.phase==='active'||ev.phase==='preparing'?'':'disabled')+'>Chiudi evento</button></div>'+
        '<div class="legend">Spiazzo riservato: niente case, campi o edifici. Durante l\'evento gli allestimenti vengono montati e poi smontati.</div></div>';
    }
    const deg=Math.round((Number(s.angle)||0)*180/Math.PI+360)%360;
    html+='<div class="slot"><div class="slot-label">Rotazione · '+deg+'°</div><div class="grid3"><button data-point-rotate="-1">↺ 15°</button><button data-point-rotate="12">⇄ 180°</button><button data-point-rotate="1">↻ 15°</button></div></div>';
    return html;
  }
  function bindPanel(root,s){
    const done=()=>{if(typeof draw==='function')draw();if(typeof renderFunctionPanel==='function')renderFunctionPanel();if(typeof saveLocal==='function')saveLocal()};
    root.querySelectorAll('[data-event-dressing]').forEach(b=>b.onclick=()=>{s.dressing=b.dataset.eventDressing;refresh();done()});
    root.querySelectorAll('[data-event-setup]').forEach(b=>b.onclick=()=>{setEvent(s,{setup:b.dataset.eventSetup});done()});
    root.querySelector('[data-event-start]')?.addEventListener('click',()=>{setEvent(s,{phase:'preparing',progress:0,since:State.clock?.day||0});done()});
    root.querySelector('[data-event-stop]')?.addEventListener('click',()=>{setEvent(s,{phase:'clearing',progress:0,since:State.clock?.day||0});done()});
    root.querySelectorAll('[data-point-rotate]').forEach(b=>b.onclick=()=>{if(typeof rotatePointStructure==='function')rotatePointStructure(s,Number(b.dataset.pointRotate)||1);refresh();done()});
  }
  // ---------- Bivouac: a night field camp laid out like a real one (docs/events, camp).
  // Units camped close together share one camp. The leader's pavilion in the realm livery
  // stands at the centre, a little gear beside it; each squad pitches two plain ridge
  // tents (brown with an ochre ridge or khaki, one kind per squad) on wavy, staggered
  // arcs facing the centre, its fire between tents and pavilion. No grid, no repeats.
  // units: [{id,kind,x,y}] -> {camps:[{x,y,items:[{m,x,y,a,pair?}],fires:[{x,y,id}]}]}
  function bivouac(units,opts={}){
    const seed=opts.seed??((typeof State!=='undefined'&&State.seed)||1),h=opts.heraldry||(typeof State!=='undefined'&&State.heraldry)||{};
    const blocked=opts.blocked||(()=>false);
    const rnd=(key)=>hash(seed+'|biv|'+key)/4294967296;
    const groups=[];
    for(const u of units){
      const g=groups.find(g=>g.some(v=>Math.hypot(v.x-u.x,v.y-u.y)<3));
      g?g.push(u):groups.push([u]);
    }
    return{camps:groups.map(group=>{
      const key=group.map(u=>u.id).sort().join(',');
      const leader=group.find(u=>u.kind==='knight'||u.kind==='captain');
      const squads=group.filter(u=>u!==leader);
      const cx=leader?leader.x:group.reduce((s,u)=>s+u.x,0)/group.length;
      const cy=leader?leader.y:group.reduce((s,u)=>s+u.y,0)/group.length;
      const items=[],fires=[];
      const put=it=>{if(!blocked({x:it.x,y:it.y}))items.push(it)};
      if(leader){
        put({m:'tentOctagon',x:cx,y:cy,a:(rnd(key+'pa')-.5)*.6,pair:[h.c1||'#b8322c',h.c2||'#ece6d6',SCHEME_KEYS[hash(seed+'|'+key)%SCHEME_KEYS.length]]});
        const ga=rnd(key+'ga')*Math.PI*2;
        put({m:rnd(key+'gm')<.5?'propArmourCrate':'propWeaponRack',x:cx+Math.cos(ga)*1.15,y:cy+Math.sin(ga)*1.15,a:ga});
      }else fires.push({x:cx,y:cy,id:key+':fire'});
      // Arcs round the centre: ~0.8 U between tents, a gap left as the camp's way in.
      const r0=leader?2.1:1.5,start=rnd(key+'st')*Math.PI*2,gap=.7;
      let row=0,theta=0,pitched=0;
      // Every three squads share one big company tent, pitched on the outer ring.
      const companies=Math.floor(squads.length/3),loose=squads.slice(companies*3);
      const rows=Math.ceil(loose.length*2*1.1/(Math.PI*2*r0))||0,rc=r0+Math.max(0,rows-1)*1.3+1.6;
      for(let k=0;k<companies;k++){
        const th=start+gap/2+(k+.5)*(Math.PI*2-gap)/companies+(rnd(key+'ct'+k)-.5)*.3/companies;
        const rr=rc+(rnd(key+'cr'+k)-.5)*.3,x=cx+Math.cos(th)*rr,y=cy+Math.sin(th)*rr;
        put({m:'tentCompany',x,y,a:th-Math.PI/2+(rnd(key+'ca'+k)-.5)*.25});
        fires.push({x:cx+Math.cos(th)*(rr-1.25),y:cy+Math.sin(th)*(rr-1.25),id:squads[k*3].id+':fire'});
      }
      loose.forEach((sq,si)=>{
        const model=rnd(key+'kind'+si)<.55?'tentRidge':'tentRidgePlain';
        let fx=0,fy=0;
        for(let t=0;t<2;t++){
          if(theta+1/(r0+row*1.3)>Math.PI*2-gap){row++;theta=0}
          const r=r0+row*1.3;
          const wob=Math.sin(pitched*1.7+rnd(key+'w')*6)*.18+(rnd(key+'r'+pitched)-.5)*.16;
          const th=start+theta+(row%2)*.4/r,rr=r+wob;
          const x=cx+Math.cos(th)*rr,y=cy+Math.sin(th)*rr;
          put({m:model,x,y,a:th-Math.PI/2+(rnd(key+'a'+pitched)-.5)*.35});
          fx+=x;fy+=y;theta+=(1+rnd(key+'s'+pitched)*.22)/r;pitched++;
        }
        // The squad's fire sits inward of its two tents.
        fx/=2;fy/=2;const k=(Math.hypot(fx-cx,fy-cy)-.75)/Math.max(.01,Math.hypot(fx-cx,fy-cy));
        fires.push({x:cx+(fx-cx)*k,y:cy+(fy-cy)*k,id:sq.id+':fire'});
      });
      return{x:cx,y:cy,key,items,fires};
    })};
  }
  // Meshes of a bivouac for drawMeshes / the Lab (ground: number or function of a point).
  function bivouacMeshes(camps,ground=0){
    const z=typeof ground==='function'?ground:()=>ground,out=[];
    for(const c of camps)for(const it of c.items){
      const m=triangles(it.m,{x:it.x,y:it.y,angle:it.a,scale:1,key:c.key+':'+it.m+':'+it.x.toFixed(2)},z(it),it.pair||null);
      if(m)out.push(m);
    }
    return out;
  }
  // ---------- Encampment: a planned army camp laid out in quarters (docs/events, camp).
  // Local frame: the way in at -y. The noble quarter (all the leaders' pavilions round
  // a banner spot) lies at the back; each company has its own street on the front and
  // flanks (company tent at its head, ridge tents staggered along it, a fire per squad);
  // the train (wagons, crates, racks) fills the band between; a parade ground stays
  // open at the centre. The boundary is a soft hull of everything pitched, with a gap
  // at the front as the gate (the line a palisade will later follow).
  // army: {leaders:[{id,kind}], squads:[{id}]}; opts: {x,y,angle,seed,heraldry,blocked}
  // -> {items:[{m,x,y,a,pair?}], fires, perimeter:[{x,y}], gate:{x,y}, banner, paths:[[p,q]], quarters}
  const CAMP_RADIUS={tentOctagon:1.05,tentSquare:1.1,tentCompany:1.05,tentRidge:.62,tentRidgePlain:.62,wagonCargo:.8,
    propArmourCrate:.35,propWeaponRack:.45,propSpearRack:.45};
  function encampment(army,opts={}){
    const seed=opts.seed??((typeof State!=='undefined'&&State.seed)||1),h=opts.heraldry||(typeof State!=='undefined'&&State.heraldry)||{};
    const key=opts.key||'camp',rnd=k=>hash(seed+'|enc|'+key+'|'+k)/4294967296,jit=(k,s)=>(rnd(k)-.5)*s;
    const leaders=army.leaders||[],squads=army.squads||[],items=[],fires=[],paths=[];
    const free=(x,y,r)=>items.every(it=>Math.hypot(it.x-x,it.y-y)>=r+(CAMP_RADIUS[it.m]||.4));
    // Pitch near (x,y): a few seeded nudges before giving up on that piece.
    const pitch=(it,k)=>{
      const r=CAMP_RADIUS[it.m]||.4;
      for(let t=0;t<6;t++){
        const x=it.x+(t?jit(k+'x'+t,.5*t):0),y=it.y+(t?jit(k+'y'+t,.5*t):0);
        if(free(x,y,r)){const p={...it,x,y};items.push(p);return p}
      }
      return null;
    };
    // Noble quarter: pavilions on a loose arc round the banner, the commander's in the
    // realm livery at its middle, the others dealt distinct pairs, neighbours contrasting.
    const banner={x:0,y:1.6+leaders.length*.25};
    const deck=PAIRS.filter(([a,b])=>PRIMARY.indexOf(a)<PRIMARY.indexOf(b)).map((p,k)=>[hash(seed+'|nob|'+key+'|'+k),p]).sort((a,b)=>a[0]-b[0]).map(e=>e[1]);
    const order=leaders.map((l,i)=>i).sort((a,b)=>Math.abs(a-(leaders.length-1)/2)-Math.abs(b-(leaders.length-1)/2));
    const nobleR=leaders.length>1?1.9+leaders.length*.12:0,span=Math.min(2.6,.8*(leaders.length-1));
    const pavs=[];
    order.forEach((li,n)=>{
      const f=leaders.length>1?li/(leaders.length-1)-.5:0,th=Math.PI/2+f*span*2;
      const x=banner.x+Math.cos(th)*nobleR+jit('nx'+li,.35),y=banner.y+Math.sin(th)*nobleR+jit('ny'+li,.35);
      let pair;
      if(n===0)pair=[h.c1||'#b8322c',h.c2||'#ece6d6',SCHEME_KEYS[hash(seed+'|cmd|'+key)%SCHEME_KEYS.length]];
      else{
        const near=pavs.reduce((m,p)=>!m||Math.hypot(p.x-x,p.y-y)<Math.hypot(m.x-x,m.y-y)?p:m,null);
        const k=Math.max(0,deck.findIndex(p=>!near||!p.some(c=>near.pair.includes(c))));
        const p=deck.splice(k,1)[0]||PAIRS[n%PAIRS.length];
        let sc=SCHEME_KEYS[hash(seed+'|nsc|'+key+'|'+n)%SCHEME_KEYS.length];
        if(near&&sc===near.pair[2])sc=SCHEME_KEYS[(SCHEME_KEYS.indexOf(sc)+1)%SCHEME_KEYS.length];
        pair=[p[0],p[1],sc];
      }
      const it=pitch({m:li%2?'tentSquare':'tentOctagon',x,y,a:Math.atan2(banner.y-y,banner.x-x)+Math.PI/2+jit('na'+li,.4),pair},'n'+li);
      if(it)pavs.push(it);
    });
    // Companies of up to three squads, one street each, spread over front and flanks.
    const companies=[];for(let i=0;i<squads.length;i+=3)companies.push(squads.slice(i,i+3));
    const arc=3.9,rs=Math.max(3.4,companies.length*2.3/arc);
    companies.forEach((co,ci)=>{
      const f=companies.length>1?ci/(companies.length-1)-.5:0;
      // The front gap: streets keep clear of the gate axis.
      let phi=-Math.PI/2+f*arc+jit('cp'+ci,.18);
      if(Math.abs(phi+Math.PI/2)<.32)phi+=phi<-Math.PI/2?-.32:.32;
      const ux=Math.cos(phi),uy=Math.sin(phi),vx=-uy,vy=ux,head=rs+jit('cr'+ci,.4);
      const at=(d,s)=>({x:ux*d+vx*s,y:uy*d+vy*s});
      if(co.length===3){const p=at(head,0);pitch({m:'tentCompany',x:p.x,y:p.y,a:phi+Math.PI/2+jit('ca'+ci,.25)},'c'+ci)}
      const model=rnd('ck'+ci)<.55?'tentRidge':'tentRidgePlain',tents=co.length===3?2:co.length*2;
      let d=head+(co.length===3?1.55:0);
      for(let t=0;t<tents;t++){
        const side=t%2?1:-1,q=at(d+(t%2)*.5,side*(.78+jit('cs'+ci+t,.18))+Math.sin(d*1.3+ci)*.15);
        // Doors face the street axis.
        pitch({m:model,x:q.x,y:q.y,a:phi+(side>0?0:Math.PI)+jit('ta'+ci+t,.3)},'t'+ci+'.'+t);
        if(t%2)d+=1.15;
      }
      co.forEach((sq,si)=>{const p=at(head-.95+si*1.05+(co.length===3?.9:0),jit('fs'+ci+si,.2));fires.push({x:p.x,y:p.y,id:sq.id+':fire'})});
      paths.push([{x:0,y:0},at(head-1.1,0)]);
    });
    // Train: wagons either side of the parade ground towards the gate, crates and racks
    // piled beside them.
    const train=[];
    for(let k=0;k<Math.max(1,Math.round(companies.length/2));k++){
      const side=k%2?1:-1,row=Math.floor(k/2);
      train.push(pitch({m:'wagonCargo',x:side*(1.5+row*.35)+jit('wx'+k,.25),y:-1.1-row*1.0+jit('wy'+k,.25),a:Math.PI/2+side*.35+jit('wa'+k,.4)},'w'+k));
    }
    ['propArmourCrate','propSpearRack','propArmourCrate','propWeaponRack'].slice(0,1+Math.min(3,leaders.length)).forEach((m,k)=>{
      const side=k%2?-1:1;
      train.push(pitch({m,x:side*(2.45+jit('gx'+k,.3)),y:-.4-Math.floor(k/2)*.75+jit('gy'+k,.3),a:rnd('gr'+k)*Math.PI*2},'g'+k));
    });
    // Boundary: hull of the pitched pieces grown by a margin, rounded twice (Chaikin).
    const pts=[];
    for(const it of items){const r=(CAMP_RADIUS[it.m]||.4)+.9;for(let k=0;k<8;k++)pts.push({x:it.x+Math.cos(k*Math.PI/4)*r,y:it.y+Math.sin(k*Math.PI/4)*r})}
    if(!pts.length)pts.push({x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2});
    pts.sort((a,b)=>a.x-b.x||a.y-b.y);
    const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo=[],hi=[];
    for(const p of pts){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
    for(const p of [...pts].reverse()){while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p)}
    let hull=lo.slice(0,-1).concat(hi.slice(0,-1));
    for(let r=0;r<2;r++)hull=hull.flatMap((p,i)=>{const q=hull[(i+1)%hull.length];return[{x:p.x*.75+q.x*.25,y:p.y*.75+q.y*.25},{x:p.x*.25+q.x*.75,y:p.y*.25+q.y*.75}]});
    const front=hull.reduce((m,p)=>Math.abs(p.x)<1.2&&(!m||p.y<m.y)?p:m,null)||hull.reduce((m,p)=>p.y<m.y?p:m);
    const gate={x:front.x,y:front.y};
    paths.push([gate,{x:0,y:0}],[{x:0,y:0},banner]);
    // Local -> world.
    const a=opts.angle||0,c=Math.cos(a),sn=Math.sin(a),ox=opts.x||0,oy=opts.y||0;
    const W=p=>({...p,x:ox+p.x*c-p.y*sn,y:oy+p.x*sn+p.y*c});
    const blocked=opts.blocked||(()=>false);
    return{x:ox,y:oy,key,
      items:items.map(it=>({...W(it),a:(it.a||0)+a})).filter(it=>!blocked(it)),
      fires:fires.map(W),perimeter:hull.map(W),gate:W(gate),banner:W(banner),
      paths:paths.map(s=>s.map(W)),
      quarters:{nobles:pavs.length,companies:companies.length,train:train.filter(Boolean).length}};
  }
  // Boundary marked with fence segments (stage 0 of the fortification), gate left open.
  function encampmentFence(camp,step=1.4){
    const out=[],P=camp.perimeter;
    for(let i=0;i<P.length;i++){
      const p=P[i],q=P[(i+1)%P.length],L=Math.hypot(q.x-p.x,q.y-p.y),n=Math.max(1,Math.round(L/step));
      for(let k=0;k<n;k++){
        const x=p.x+(q.x-p.x)*(k+.5)/n,y=p.y+(q.y-p.y)*(k+.5)/n;
        if(Math.hypot(x-camp.gate.x,y-camp.gate.y)<1.3)continue;
        out.push({m:'propFence',x,y,a:Math.atan2(q.y-p.y,q.x-p.x),s:L/n/1.4});
      }
    }
    return out;
  }
  // A bivouac as one catalog model (event palette, origin at the camp centre) for the Lab.
  // pal: the scene registry palette, extended with each pavilion's livery colours.
  function bivouacModel(camp,pal){
    const p=[],c=[],index=hex=>{let k=pal.indexOf(hex);if(k<0){k=pal.length;pal.push(hex)}return k};
    for(const it of camp.items){
      const co=Math.cos(it.a||0),sn=Math.sin(it.a||0),s=it.s||1;
      for(const part of parts(it.m)||[]){
        for(let k=0;k<part.v.length;k+=3){const x=part.v[k]*s,y=part.v[k+1];p.push(it.x-camp.x+x*co-y*sn,it.y-camp.y+x*sn+y*co,part.v[k+2])}
        const own=palette(it.m,it.pair||(liveryOf(it.m)==='pair'?pairFor(it.m):null));
        for(const ci of part.c)c.push(index(own[ci]));
      }
    }
    return{parts:{camp:{p,i:p.map((_,k)=>k).slice(0,p.length/3),c}},meta:{},livery:'realm'};
  }
  window.ConquerEvents3D={VENUES,SETUPS,PAIRS,BUILD,SETUP_NAMES,is,has,sizeOf,setupsFor,venueModel,setupItems,placedItems,pairFor,liveryOf,parts,triangles,itemRect,footprint,meshes,draw,addToBuilder,dynamicMeshes,toWorld,
    make,label,cost,buildDays,tickEvents,setEvent,panelHtml,bindPanel,bivouac,bivouacMeshes,bivouacModel,encampment,encampmentFence};
  // Lab scenes: sample bivouacs in the Asset Lab catalog (ConquerCampScenes).
  if(window.ConquerEventModels){
    const M=window.ConquerEventModels,sq=(n,x=0)=>Array.from({length:n},(_,k)=>({id:'s'+k,kind:'squad',x:x+(k%3)*.4,y:Math.floor(k/3)*.4}));
    const pal=[...M.palette],scene=units=>bivouacModel(bivouac(units,{seed:7}).camps[0],pal);
    window.ConquerCampScenes={palette:pal,paletteKeys:pal.map((_,k)=>M.paletteKeys[k]||'livery'+k),models:{
      bivouacSquads:scene(sq(2)),
      bivouacCaptain:scene([{id:'cap',kind:'captain',x:0,y:0},...sq(5)]),
      bivouacKnightLarge:scene([{id:'kn',kind:'knight',x:0,y:0},...sq(9)]),
      ...Object.fromEntries([['encampmentSmall',2,7],['encampmentArmy',4,16]].map(([name,nl,ns])=>{
        const camp=encampment({leaders:Array.from({length:nl},(_,k)=>({id:'l'+k,kind:k?'knight':'captain'})),squads:sq(ns)},{seed:7,key:name});
        return[name,bivouacModel({x:0,y:0,items:camp.items.concat(encampmentFence(camp))},pal)];
      }))}};
    // Keys for the livery colours appended while building the scenes.
    window.ConquerCampScenes.paletteKeys=pal.map((_,k)=>M.paletteKeys[k]||'livery'+k);
  }
})();
