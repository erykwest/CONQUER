'use strict';
// BC-251105-12/13 · Rampe e scalinate sui dislivelli del terreno.
// Two clicks join a LOW plateau to a HIGH plateau (hill levels, terraces): the deck runs
// straight between the two real ground heights, built up as an embankment against the slope
// (the ground may never stand above the deck: no tunnels, no cuts hidden in the hill).
//   ramp      2U wide, grade at most 1:4 · walkers, horses and wagons (vehicle road graph)
//   stairway  1U wide, grade 1:4..1:1 · walkers only: wagons and heavy engines never use it
// Distinct from the wall-walk stairs (BC-251105-01/02, settlement-wallwalk.js).
// Geometry is a parametric piece, like the bridge deck or the quay: its length and rise come
// from the terrain, so it is built here and not as a fixed Blender model.
(() => {
  const SPEC=Object.freeze({
    ramp:Object.freeze({label:'Rampa',width:2,minGrade:0,maxGrade:.25,min:2,max:16,days:.5,
      costPerU:Object.freeze({gold:4,stone:10,wood:2}),speed:.85}),
    stairway:Object.freeze({label:'Scalinata',width:1,minGrade:.25,maxGrade:1,min:1,max:10,days:.6,
      costPerU:Object.freeze({gold:4,stone:12}),speed:.7})
  });
  const MIN_RISE=.4,SLACK=.08,STEP_RISE=.18;
  const is=s=>!!s&&(s.type==='ramp'||s.type==='stairway');
  const spec=s=>SPEC[s?.type]||SPEC.ramp;
  const make=(type,a,b)=>({type:SPEC[type]?type:'ramp',a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},width:(SPEC[type]||SPEC.ramp).width,length:dist(a,b)});
  const frame=s=>{const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;return{L,u:{x:dx/L,y:dy/L},n:{x:-dy/L,y:dx/L}}};
  const at=(s,along,across)=>{const f=frame(s);return{x:s.a.x+f.u.x*along+f.n.x*across,y:s.a.y+f.u.y*along+f.n.y*across}};
  const local=(s,p)=>{const f=frame(s),dx=p.x-s.a.x,dy=p.y-s.a.y;return{along:dx*f.u.x+dy*f.u.y,across:dx*f.n.x+dy*f.n.y,L:f.L}};
  const footprint=s=>{const {L}=frame(s),w=(Number(s.width)||spec(s).width)/2;return[at(s,0,w),at(s,L,w),at(s,L,-w),at(s,0,-w)]};
  // The terrain without any slopeway lift (terrainElevation adds the decks of finished ones).
  function ground(p){
    const base=typeof terrainBaseElevation==='function'?terrainBaseElevation(p):0;
    return window.ConquerTerraforming?.elevationAt?.(p,base)??base;
  }
  const wet=p=>(State.environment||[]).some(f=>['river','stream','pond','sea'].includes(f.type)&&typeof environmentContains==='function'&&environmentContains(f,p));
  // Deck height along the axis (a -> b), from the two plateau levels fixed at placement.
  function deckZ(s,along){
    const L=frame(s).L,t=Math.max(0,Math.min(1,along/L));
    return(Number(s.za)||0)+((Number(s.zb)||0)-(Number(s.za)||0))*t;
  }
  function validate(s){
    if(!is(s)||!s.a||!s.b)return{ok:false,reason:'Rampa/scalinata non valida'};
    const k=spec(s),L=dist(s.a,s.b),name=k.label;
    if(L<k.min-.001)return{ok:false,reason:name+' troppo corta (min '+k.min+'U)'};
    if(L>k.max+.001)return{ok:false,reason:name+' troppo lunga (max '+k.max+'U)'};
    if(typeof inBuild==='function'&&(!inBuild(s.a)||!inBuild(s.b)))return{ok:false,reason:'Entrambe le estremità devono stare nell’area costruibile'};
    const za=terrainPlateauElevation(s.a),zb=terrainPlateauElevation(s.b);
    if(za==null||zb==null)return{ok:false,reason:name+': entrambe le estremità devono poggiare su un pianoro piano e percorribile'};
    const rise=Math.abs(zb-za);
    if(rise<MIN_RISE)return{ok:false,reason:name+': le due estremità sono alla stessa quota (serve un dislivello di almeno '+MIN_RISE+'U)'};
    const grade=rise/L;
    if(grade>k.maxGrade+1e-6)return{ok:false,reason:s.type==='ramp'
      ?'Rampa troppo ripida: pendenza max 1:4 · per '+rise.toFixed(1)+'U di dislivello servono almeno '+(rise/k.maxGrade).toFixed(1)+'U'
      :'Scalinata troppo ripida: max 45° · servono almeno '+rise.toFixed(1)+'U di sviluppo'};
    if(grade<k.minGrade-1e-6)return{ok:false,reason:'Scalinata troppo dolce (oltre 1:4): costruisci una rampa'};
    const w=(Number(s.width)||k.width)/2,steps=Math.max(4,Math.ceil(L/.2)),probe={...s,za,zb};
    for(let i=0;i<=steps;i++){
      const along=L*i/steps,z=deckZ(probe,along);
      for(const c of [-w,0,w]){
        const p=at(s,along,c);
        if(ground(p)>z+SLACK)return{ok:false,reason:name+': il terreno sovrasta il piano di calpestio · sposta l’attacco basso più lontano dal pendio'};
        if(wet(p))return{ok:false,reason:name+': non si costruisce sull’acqua'};
      }
    }
    return{ok:true,za,zb,rise,grade,length:L};
  }
  function normalise(s){
    if(!is(s))return s;
    s.width=spec(s).width;s.length=dist(s.a,s.b);
    if(!Number.isFinite(Number(s.za))||!Number.isFinite(Number(s.zb))){
      const v=validate(s);if(v.ok){s.za=v.za;s.zb=v.zb}else{s.za=terrainElevation(s.a);s.zb=terrainElevation(s.b)}
    }
    s.groundZ=Math.min(Number(s.za)||0,Number(s.zb)||0);
    return s;
  }
  // ---------- navigation
  // Finished slopeways, cached by the structures array and its length (they cannot be moved).
  let cache=null;
  function active(){
    const list=State.structures||[];
    if(!cache||cache.list!==list||cache.n!==list.length){
      cache={list,n:list.length,items:list.filter(s=>is(s)&&s.a&&s.b).map(s=>{
        const fp=footprint(s),pad=.4;
        return{s,x0:Math.min(...fp.map(p=>p.x))-pad,x1:Math.max(...fp.map(p=>p.x))+pad,y0:Math.min(...fp.map(p=>p.y))-pad,y1:Math.max(...fp.map(p=>p.y))+pad};
      })};
    }
    return cache.items;
  }
  const built=s=>!(typeof underConstruction==='function'&&underConstruction(s))&&!s.destroyed;
  // The finished slopeway whose deck is under p. Heavy movers (wagons, engines) only on ramps.
  function at_(p,heavy=false){
    for(const e of active()){
      if(p.x<e.x0||p.x>e.x1||p.y<e.y0||p.y>e.y1||!built(e.s))continue;
      if(heavy&&e.s.type!=='ramp')continue;
      const l=local(e.s,p),w=(Number(e.s.width)||spec(e.s).width)/2;
      if(l.along>=-.05&&l.along<=l.L+.05&&Math.abs(l.across)<=w)return e.s;
    }
    return null;
  }
  // The raised sides of the embankment: walkers get on and off only at the two ends.
  function blocksPoint(p){
    for(const e of active()){
      if(p.x<e.x0||p.x>e.x1||p.y<e.y0||p.y>e.y1||!built(e.s))continue;
      const l=local(e.s,p),w=(Number(e.s.width)||spec(e.s).width)/2,side=Math.abs(l.across);
      if(side<=w||side>w+.2||l.along<.3||l.along>l.L-.3)continue;
      if(deckZ(e.s,l.along)-ground(p)>.3)return true;
    }
    return false;
  }
  function speed(p,heavy=false){const s=at_(p,heavy);return s?spec(s).speed:null}
  // terrainElevation hook: figures and markers stand on the deck, not on the ground below it.
  function lift(p,base){
    const list=active();if(!list.length)return base;
    const s=at_(p);if(!s)return base;
    return Math.max(base,deckZ(s,local(s,p).along));
  }
  // Ramps join the vehicle road graph (settlement-vehicles.js); stairways never do.
  const vehicleLinks=()=>active().map(e=>e.s).filter(s=>s.type==='ramp'&&built(s));
  // A road may end on either end of a slopeway (bridgeRoadEnd / roadMeetsBridgeEnd).
  const ends=()=>active().map(e=>e.s);

  // ---------- geometry (settlement-mesh3d.js format: absolute world z)
  const PAL={earth:'#8a7350',earthDark:'#6e5b3e',pave:'#a59f92',pave2:'#968f82',kerb:'#b8b1a2',wall:'#8d887d',wall2:'#7c776c',
    tread:'#b0aa9c',tread2:'#a19b8d',riser:'#7d786d',cheek:'#868176',post:'#6f4a2b'};
  const meshCache=new Map();
  function meshes(s,groundFn=ground){
    if(!is(s)||!s.a||!s.b)return[];
    const key=[s.type,s.a.x,s.a.y,s.b.x,s.b.y,s.za,s.zb,s.width].join('|');
    const hit=s.id&&groundFn===ground&&meshCache.get(s.id);if(hit&&hit.key===key)return hit.list;
    const {L}=frame(s),w=(Number(s.width)||spec(s).width)/2,pos=[],col=[];
    const P=(along,across,z)=>{const p=at(s,along,across);return[p.x,p.y,z]};
    const box=(a0,a1,c0,c1,z0,z1,c)=>{
      if(z1-z0<1e-4)return;
      const v=[];for(const a of [a0,a1])for(const k of [c0,c1])for(const z of [z0,z1])v.push(P(a,k,z));
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(c)}
    };
    // A slanted slab between along a0..a1 whose top follows the deck from z(a0) to z(a1).
    const slab=(a0,a1,c0,c1,t,c,lift=0)=>{
      const z0=deckZ(s,a0)+lift,z1=deckZ(s,a1)+lift,v=[];
      for(const [a,z] of [[a0,z0],[a1,z1]])for(const k of [c0,c1])for(const d of [-t,0])v.push(P(a,k,z+d));
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(c)}
    };
    const low=a=>Math.min(groundFn(at(s,a,-w)),groundFn(at(s,a,0)),groundFn(at(s,a,w)))-.06;
    if(s.type==='ramp'){
      // Embankment in courses of stone, sampled every ~.5U down to the real ground.
      const n=Math.max(2,Math.ceil(L/.5));
      for(let i=0;i<n;i++){
        const a0=L*i/n,a1=L*(i+1)/n,top=Math.min(deckZ(s,a0),deckZ(s,a1))-.06,bot=Math.min(low(a0),low(a1));
        box(a0,a1,-w,w,bot,top,i%2?PAL.wall:PAL.wall2);
      }
      // Rolled-earth deck with paved wheel strips and kerbs; low parapets where the bank stands high.
      slab(0,L,-w+.12,w-.12,.08,PAL.earth,.0);
      for(const c of [-.45,.45])slab(0,L,c-.18,c+.18,.02,PAL.pave,.012);
      const kn=Math.max(1,Math.ceil(L/1.1));
      for(let i=0;i<kn;i++){const a0=L*i/kn+.02,a1=L*(i+1)/kn-.02;
        for(const k of [-1,1])slab(a0,a1,k>0?w-.14:-w,k>0?w:-w+.14,.1,i%2?PAL.kerb:PAL.pave2,.06)}
      for(let i=0;i<kn;i++){const a0=L*i/kn+.02,a1=L*(i+1)/kn-.02,h=deckZ(s,(a0+a1)/2)-low((a0+a1)/2);if(h<.5)continue;
        for(const k of [-1,1])slab(a0,a1,k>0?w-.12:-w,k>0?w:-w+.12,.3,PAL.wall2,.3)}
    }else{
      // Steps: one tread every ~STEP_RISE of rise, each block standing on the real ground,
      // with stone cheeks on both sides, so the foot meets the low plateau and the top tread
      // is flush with the high one.
      const rise=Math.abs((Number(s.zb)||0)-(Number(s.za)||0)),n=Math.max(2,Math.round(rise/STEP_RISE));
      const up=(Number(s.zb)||0)>=(Number(s.za)||0),zLow=Math.min(Number(s.za)||0,Number(s.zb)||0),run=L/n;
      for(let i=0;i<n;i++){
        // Step i counted from the low end; along measured from a.
        const lo=up?i*run:L-(i+1)*run,hi=lo+run,top=zLow+rise*(i+1)/n,bot=Math.min(low(lo),low(hi));
        box(lo,hi,-w+.1,w-.1,bot,top-.04,PAL.riser);
        box(lo-.005,hi+.005,-w+.1,w-.1,top-.04,top,i%2?PAL.tread:PAL.tread2);
      }
      const cn=Math.max(2,Math.ceil(L/.5));
      for(let i=0;i<cn;i++){
        const a0=L*i/cn,a1=L*(i+1)/cn,bot=Math.min(low(a0),low(a1));
        for(const k of [-1,1]){
          const c0=k>0?w-.1:-w,c1=k>0?w:-w+.1;
          box(a0,a1,c0,c1,bot,Math.max(deckZ(s,a0),deckZ(s,a1))+.12,i%2?PAL.cheek:PAL.wall2);
        }
      }
    }
    const list=[{pos,col}];
    if(s.id&&groundFn===ground)meshCache.set(s.id,{key,list});
    return list;
  }
  function draw(s,preview=false){
    if(!is(s)||!window.ConquerMesh3D)return false;
    if(!Number.isFinite(Number(s.za))){const v=validate(s);if(!v.ok)return false;s={...s,za:v.za,zb:v.zb}}
    ctx.save();if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,meshes(s),window.ConquerMesh3D.gameView());
    ctx.restore();return true;
  }
  function addToBuilder(m,s){
    if(!is(s)||!window.ConquerMesh3D)return false;
    for(const mesh of meshes(s)){const p=mesh.pos;for(let t=0;t<mesh.col.length;t++){const o=t*9;
      m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t))}}
    return true;
  }
  const lengthOf=s=>s.length||dist(s.a,s.b);
  const cost=s=>Object.fromEntries(Object.entries(spec(s).costPerU).map(([k,v])=>[k,Math.round(v*lengthOf(s))]));
  const buildDays=s=>Math.max(1,Math.round(spec(s).days*lengthOf(s)*10)/10);
  const label=type=>{const k=SPEC[type]||SPEC.ramp;return k.label+' · '+k.width+'U · '+(type==='stairway'?'solo pedoni · pendenza 1:4–1:1':'pedoni e carri · pendenza max 1:4')};

  // ---------- Asset Lab: sample pieces against a model cliff (ConquerSlopewayModels).
  // Each scene is a ground slab and an H-high terrace with a steep face at x=0; the piece
  // climbs it from the low side, exactly as the game validates it.
  function labScene(type,rise,length){
    const pal=[],index=hex=>{let k=pal.indexOf(hex);if(k<0){k=pal.length;pal.push(hex)}return k};
    const g=p=>p.x>=0?rise:p.x>-.25?rise*(p.x+.25)/.25:0;
    const s={id:null,type,a:{x:-length,y:0},b:{x:0,y:0},width:SPEC[type].width,za:0,zb:rise};
    const p=[],c=[],push=(tri,hex)=>{for(const v of tri)p.push(...v);c.push(hex)};
    const quad=(a,b,cc,d,hex)=>{push([a,b,cc],hex);push([a,cc,d],hex)};
    const W=SPEC[type].width/2+1.2,X0=-length-1.5,X1=2.5;
    // Small tiles, so the painter's sort keeps the ground behind the piece standing on it.
    const tiles=(x0,x1,z,hex)=>{
      const nx=Math.max(1,Math.ceil((x1-x0)/.5)),ny=Math.max(1,Math.ceil(2*W/.5));
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
        const a=x0+(x1-x0)*i/nx,b=x0+(x1-x0)*(i+1)/nx,c=-W+2*W*j/ny,d=-W+2*W*(j+1)/ny;
        if(z===0&&Math.abs((a+b)/2+length/2)<length/2&&Math.abs((c+d)/2)<SPEC[type].width/2)continue;   // under the piece
        quad([a,c,z],[b,c,z],[b,d,z],[a,d,z],(i+j)%2?hex:'#7a8a56');
      }
    };
    tiles(X0,-.25,0,'#7f8f5a');tiles(0,X1,rise,'#8c9a62');
    for(let j=0;j<6;j++){const c=-W+2*W*j/6,d=-W+2*W*(j+1)/6;quad([-.25,c,0],[0,c,rise],[0,d,rise],[-.25,d,0],'#77705f')}
    for(const mesh of meshes(s,g)){const q=mesh.pos;for(let t=0;t<mesh.col.length;t++){const o=t*9;push([[q[o],q[o+1],q[o+2]],[q[o+3],q[o+4],q[o+5]],[q[o+6],q[o+7],q[o+8]]],mesh.col[t])}}
    // Mirrored (x -> -x): the Lab camera looks from +x, so the piece climbs towards it.
    for(let k=0;k<p.length;k+=3)p[k]=-p[k];
    const cIdx=c.map(index);
    return{model:{parts:{piece:{p,i:p.map((_,k)=>k).slice(0,p.length/3),c:cIdx}},meta:{type,rise,length}},pal};
  }
  const labModels=(()=>{
    const out={},pal=[];
    for(const [name,type,rise,len] of [['rampH1','ramp',1,4.5],['rampH2','ramp',2,8.5],['stairwayH1','stairway',1,1.6],['stairwayH2','stairway',2,2.8]]){
      const {model,pal:own}=labScene(type,rise,len);
      // Merge palettes into one registry palette.
      model.parts.piece.c=model.parts.piece.c.map(k=>{const hex=own[k];let j=pal.indexOf(hex);if(j<0){j=pal.length;pal.push(hex)}return j});
      out[name]=model;
    }
    return{palette:pal,paletteKeys:pal.map((_,k)=>'slopeway'+k),models:out};
  })();
  window.ConquerSlopewayModels=labModels;

  window.ConquerSlopeways=Object.freeze({SPEC,MIN_RISE,is,spec,make,footprint,validate,normalise,deckZ,ground,
    at:at_,blocksPoint,speed,lift,vehicleLinks,ends,meshes,draw,addToBuilder,cost,buildDays,label});
})();
