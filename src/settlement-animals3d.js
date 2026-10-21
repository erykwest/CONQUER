'use strict';
// CONQUER animals in 3D: rigid Blender-built parts (src/assets/animal-models.js,
// ASSETS/blender/build_animals.py) driven by the SAME gaits as the 2D animals
// (ConquerAnimals.gaitPose): legs turn about hips/shoulders, the neck about its
// base, the head about the throat, the tail about its root; special poses (a bear
// rearing or asleep, a howling wolf) turn the whole body. Any heading, every coat,
// real-world sizes. Output is world-space triangles in the ConquerWagons3D mesh
// format, so a team sorts together with its wagon. Classic script; maths is pure.
(function(){
  const MODELS=()=>window.ConquerAnimalModels;
  const lerp=(a,b,k)=>a+(b-a)*k,ease=k=>k*k*(3-2*k);
  // Head carriage and body pose per mode (radians; positive pitch = nose down).
  //   neck: about the neck base; head: about the throat, relative to the neck.
  //   body: pitch about the hip with the hind legs planted; drop: lower to the ground;
  //   legs: extra leg angles (positive = foot forward), order hind L/R, fore L/R.
  const BASE={walk:{neck:0,head:0},idle:{neck:0,head:0},run:{neck:.35,head:.1},
    alert:{neck:-.2,head:-.15},howl:{neck:-.85,head:-.75}};
  const SPECIAL={
    bear:{
      // Rearing: the body swings up about the hip, hind legs stay planted, the
      // fore paws hang in front of the chest, the head levels to look ahead.
      stand:{neck:1.0,head:.25,body:-1.3,legs:[0,0,-1.05,-.85],still:true},
      // Asleep: lowered onto the ground, legs folded forward, head on the paws.
      sleep:{neck:.75,head:.4,drop:true,legs:[1.25,1.25,1.45,1.45],still:true,breathe:true}
    }
  };
  const MODES={horse:['walk','browse','run']};
  function modesOf(species){
    return MODES[species]||window.ConquerAnimals.SPECIES[species].modes.map(m=>m[0]);
  }
  // Point helpers about a pivot c (arrays [x,y,z]).
  function pitch(p,c,a){
    if(!a)return p;
    const dx=p[0]-c[0],dz=p[2]-c[2],ca=Math.cos(a),sa=Math.sin(a);
    return[c[0]+dx*ca+dz*sa,p[1],c[2]-dx*sa+dz*ca];
  }
  function roll(p,c,a){
    if(!a)return p;
    const dy=p[1]-c[1],dz=p[2]-c[2],ca=Math.cos(a),sa=Math.sin(a);
    return[p[0],c[1]+dy*ca-dz*sa,c[2]+dy*sa+dz*ca];
  }
  // Grazing carriage solved per species so the rigid head reaches the grass:
  // the head swings towards vertical, the neck lowers until the muzzle touches.
  const grazeCache=new Map();
  function graze(species){
    let g=grazeCache.get(species);if(g)return g;
    const m=MODELS()[species],hp=m.pivots.head,np=m.pivots.neck,roles=MODELS().roles,hp0=m.parts.head;
    // The muzzle is the head itself: horns, antlers, ears and beards don't graze.
    const skip=new Set(['horn','antler','ear','beard','tusk','eye']),head=[];
    for(let t=0;t<hp0.c.length;t++)if(!skip.has(roles[hp0.c[t]]))for(let k=0;k<9;k++)head.push(hp0.v[t*9+k]);
    let tip=null,far=-1;
    for(let i=0;i<head.length;i+=3){const d=Math.hypot(head[i]-hp[0],head[i+2]-hp[2]);if(d>far){far=d;tip=[head[i],head[i+1],head[i+2]]}}
    const rest=Math.atan2(hp[2]-tip[2],tip[0]-hp[0]),net=.8*(Math.PI/2-rest);
    const lowest=n=>{let z=Infinity;for(let i=0;i<head.length;i+=3)
      z=Math.min(z,pitch(pitch([head[i],head[i+1],head[i+2]],hp,net-n),np,n)[2]);return z};
    // Search neck and head together: muzzle on the grass first, then a head close
    // to vertical, then the least bent neck. The neck never folds past 2.4 rad.
    const lowestNH=(n,h)=>{let z=Infinity;for(let i=0;i<head.length;i+=3)
      z=Math.min(z,pitch(pitch([head[i],head[i+1],head[i+2]],hp,h),np,n)[2]);return z};
    let best=0,bestH=net,cost=Infinity;
    for(let n=0;n<=2.4;n+=.02)for(let h=-2.6;h<=1;h+=.04){
      const c=Math.abs(lowestNH(n,h)-.012)*40+Math.abs(n+h-net)*.4+n*.05;
      if(c<cost){cost=c;best=n;bestH=h}
    }
    // Short-necked grazers would bury the head under the chest: reach the neck and
    // head forward until the muzzle clears the front of the body.
    let front=-Infinity,cx=0;
    const body=m.parts.body.v;for(let i=0;i<body.length;i+=3)front=Math.max(front,body[i]);
    for(let i=0;i<head.length;i+=3)cx+=pitch(pitch([head[i],head[i+1],head[i+2]],hp,bestH),np,best)[0];
    cx/=head.length/3;
    g={neck:best,head:bestH,reach:Math.max(0,front+.01-cx)};grazeCache.set(species,g);return g;
  }
  function modeState(species,mode,t,seed){
    const sp=SPECIAL[species]?.[mode];
    const gait=sp?.still?'still':['walk','browse','run'].includes(mode)?mode:'still';
    const g=window.ConquerAnimals.gaitPose(gait,t,seed);
    const c=sp||(mode==='browse'?graze(species):BASE[mode]||BASE.walk);
    const add=sp?.legs||[0,0,0,0];
    return{legs:g.legs.map((a,i)=>a+add[i]),lift:g.lift,bob:g.bob,tail:g.tail,nod:g.head,pitch:g.pitch||0,
      neck:c.neck,head:c.head,reach:c.reach||0,chew:gait==='browse'?g.chew:0,body:sp?.body||0,drop:sp?.drop?1:0,
      breathe:sp?.breathe?Math.sin(t*1.4+seed)*.5+.5:0};
  }
  // Pose for {mode, from, blend (0..1), t, seed}: every value travels continuously.
  function pose(species,anim){
    const t=anim.t||0,seed=anim.seed||0,to=anim.mode||'walk';
    const a=modeState(species,anim.from||to,t,seed),b=modeState(species,to,t,seed);
    const k=ease(Math.max(0,Math.min(1,anim.from?anim.blend??1:1))),out={};
    for(const key of Object.keys(a))out[key]=Array.isArray(a[key])?a[key].map((v,i)=>lerp(v,b[key][i],k)):lerp(a[key],b[key],k);
    return out;
  }
  // Model-space -> world transform of one animal for a pose: xf(partName, [x,y,z]).
  // Extra parts (horse gear, riders) reuse it with the name of the part they ride.
  function transformer(species,place,st){
    const model=MODELS()[species],H=model.height;
    const px=v=>v*H/230;                         // 2D art pixel -> U (2D art ~230 px tall)
    // place.scale enlarges the figure about its feet (legibility next to 2D figures).
    const k=place.scale||1,c=Math.cos(place.heading||0)*k,s=Math.sin(place.heading||0)*k;
    const center=model.center,hip=model.hip||center,bob=-px(st.bob);
    const neckP=model.pivots.neck,headP=model.pivots.head,tailP=model.pivots.tail;
    const drop=st.drop*(model.bodyBottom-.01),breathe=1+st.breathe*.025;
    return(name,p)=>{
      const li=model.legs.indexOf(name),planted=li===0||li===1;
      if(li>=0){
        // Positive gait angle = foot forward; lift raises the stepping leg.
        p=pitch(p,model.pivots[name],-st.legs[li]);p[2]+=px(st.lift[li]);
      }else if(name==='head'){
        p=pitch(p,headP,st.head+st.nod+st.chew*.06);p=pitch(p,neckP,st.neck);p[0]+=st.reach;
      }else if(name==='neck'){
        p=pitch(p,neckP,st.neck);p[0]+=st.reach;
      }else if(name==='tail'){
        p=roll(pitch(p,tailP,-st.tail*.5),tailP,st.tail*.4);
      }else if(name==='body'&&st.breathe){
        p=[p[0],center[1]+(p[1]-center[1])*breathe,center[2]+(p[2]-center[2])*breathe];
      }
      // Rearing turns everything about the hip but the planted hind legs.
      if(!(planted&&st.body))p=pitch(p,hip,st.body);
      if(li<0)p[2]+=bob;
      p=pitch(p,center,st.pitch);
      p[2]-=drop;
      return[(place.x||0)+p[0]*c-p[1]*s,(place.y||0)+p[0]*s+p[1]*c,(place.z||0)+p[2]*k];
    };
  }
  // World triangles for one animal. place: {x,y,z,heading}; anim: pose input;
  // colors: role -> hex (coatColors()). extras: [{bind, v (flat xyz), col (hex per
  // triangle), local?(p), over?}] ride the named part (gear, a rider); each is its own
  // group. 'over' (a small number) sorts the extra right after the part it covers
  // (cloth on the body) instead of by its own centre.
  function triangles(species,place,anim,colors,extras=[]){
    const model=MODELS()[species],roles=MODELS().roles,st=pose(species,anim),xf=transformer(species,place,st);
    const pos=[],col=[],gi=[],groups=[],groupBias=[],byName={};
    const emit=(name,v,colorOf,local,over)=>{
      const g0=pos.length,group=groups.length;
      for(let t=0;t<v.length/9;t++){
        for(let k=0;k<3;k++){
          let p=[v[t*9+k*3],v[t*9+k*3+1],v[t*9+k*3+2]];
          if(local)p=local(p);
          const w=xf(name,p);pos.push(w[0],w[1],w[2]);
        }
        col.push(colorOf(t));gi.push(group);
      }
      // Each rigid part sorts as a unit (by its centre), then triangle by triangle.
      let gx=0,gy=0,gz=0;const n=(pos.length-g0)/3||1;
      for(let i=g0;i<pos.length;i+=3){gx+=pos[i];gy+=pos[i+1];gz+=pos[i+2]}
      if(over&&byName[name]!==undefined){groups.push([...groups[byName[name]]]);groupBias.push(over)}
      else{groups.push([gx/n,gy/n,gz/n]);groupBias.push(0)}
      return group;
    };
    for(const [name,part] of Object.entries(model.parts))byName[name]=emit(name,part.v,t=>colors[roles[part.c[t]]]);
    const extraGroups=extras.map(e=>emit(e.bind,e.v,t=>e.col[t],e.local,e.over));
    return{pos,col,gi,groups,groupBias,extraGroups,xf,bias:new Array(col.length).fill(0),outward:[]};
  }
  // Role colours from the approved 2D palette (and coat) of the species.
  function coatColors(species,coat){
    const sp=window.ConquerAnimals.SPECIES[species],c=sp.coatColors?.[coat]||sp.colors;
    const leg=c.leg||c.body,legFar=c.legFar||leg;
    return{body:c.body,shade:c.shade||c.body,head:c.head||c.body,leg,legFar,
      mane:c.mane||legFar,hoof:c.hoof||c.legLine||legFar,eye:c.eye||'#1a1a1a',ear:c.ear||c.head||c.body,
      nose:c.nose||c.line||'#1a1a1a',muzzle:c.muzzle||legFar,horn:c.horn||'#4a2f1d',beard:c.beard||c.body,
      tusk:c.tusk||'#efe8d6',antler:c.antler||'#dcc9a3',tail:c.tail||c.body};
  }
  window.ConquerAnimals3D={triangles,transformer,coatColors,pose,graze,modesOf,SPECIAL,pitch,roll};
})();
