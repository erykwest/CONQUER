'use strict';
// CONQUER animals in 3D: rigid Blender-built parts (src/assets/animal-models.js,
// ASSETS/blender/build_animals.py) driven by the SAME gaits as the 2D animals
// (ConquerAnimals.gaitPose): legs turn about hips/shoulders, the neck about its
// base, the head about the throat, the tail about its root. Any heading, every
// coat. Output is world-space triangles in the ConquerWagons3D mesh format, so a
// team sorts together with its wagon. Classic script; maths is pure.
(function(){
  const MODELS=()=>window.ConquerAnimalModels;
  const lerp=(a,b,k)=>a+(b-a)*k,ease=k=>k*k*(3-2*k);
  // Head carriage per mode (radians, positive = nose down): neck about its base,
  // head about the throat (relative to the neck).
  const CARRIAGE={
    horse:{walk:{neck:0,head:0},browse:{neck:2.2,head:-1.5},run:{neck:.45,head:.15},idle:{neck:0,head:0},alert:{neck:-.15,head:-.05}}
  };
  // 2D gait units -> 3D: bob/lift are art pixels of a 256 box ~ the animal's height.
  function modeState(species,mode,t,seed){
    const A=window.ConquerAnimals,gait=['walk','browse','run'].includes(mode)?mode:'still';
    const g=A.gaitPose(gait,t,seed),c=(CARRIAGE[species]||CARRIAGE.horse)[mode]||CARRIAGE.horse.walk;
    return{legs:g.legs,lift:g.lift,bob:g.bob,tail:g.tail,nod:g.head,pitch:g.pitch||0,neck:c.neck,head:c.head,chew:gait==='browse'?g.chew:0};
  }
  function pose(species,anim){
    const t=anim.t||0,seed=anim.seed||0,to=anim.mode||'walk';
    const a=modeState(species,anim.from||to,t,seed),b=modeState(species,to,t,seed),k=ease(Math.max(0,Math.min(1,anim.from?anim.blend??1:1)));
    const out={};
    for(const key of Object.keys(a))out[key]=Array.isArray(a[key])?a[key].map((v,i)=>lerp(v,b[key][i],k)):lerp(a[key],b[key],k);
    return out;
  }
  // Pitch (about the model y axis) of point p around pivot c: positive = forward end down.
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
  // World triangles for one animal. place: {x,y,z,heading}; anim: {mode,from,blend,t,seed};
  // colors: role -> hex (from the species' coat palette).
  function triangles(species,place,anim,colors){
    const model=MODELS()[species],roles=MODELS().roles,st=pose(species,anim),H=model.height;
    const px=v=>v*H/230;                         // 2D art pixel -> U (art horse ~230 px tall)
    const pos=[],col=[],c=Math.cos(place.heading||0),s=Math.sin(place.heading||0);
    const center=model.center,bob=px(st.bob)*-1;
    const neckP=model.pivots.neck,headP=model.pivots.head,tailP=model.pivots.tail;
    for(const [name,part] of Object.entries(model.parts)){
      const li=model.legs.indexOf(name);
      for(let t=0;t<part.c.length;t++){
        for(let k=0;k<3;k++){
          let p=[part.v[t*9+k*3],part.v[t*9+k*3+1],part.v[t*9+k*3+2]];
          if(li>=0){
            // Positive gait angle = foot forward; lift raises the stepping leg.
            p=pitch(p,model.pivots[name],-st.legs[li]);p[2]+=px(st.lift[li]);
          }else if(name==='head'){
            p=pitch(p,headP,st.head+st.nod+st.chew*.06);p=pitch(p,neckP,st.neck);
          }else if(name==='neck'){
            p=pitch(p,neckP,st.neck);
          }else if(name==='tail'){
            p=roll(pitch(p,tailP,-st.tail*.5),tailP,st.tail*.4);
          }
          if(li<0)p[2]+=bob;
          p=pitch(p,center,st.pitch);
          pos.push((place.x||0)+p[0]*c-p[1]*s,(place.y||0)+p[0]*s+p[1]*c,(place.z||0)+p[2]);
        }
        col.push(colors[roles[part.c[t]]]);
      }
    }
    return{pos,col,bias:new Array(col.length).fill(0),outward:[]};
  }
  // Coat roles from the 2D species palette (one source of truth for coats).
  function coatColors(species,coat){
    const sp=window.ConquerAnimals.SPECIES[species],c=sp.coatColors?.[coat]||sp.colors;
    return{coat:c.body,coatDark:c.legFar,mane:c.mane||c.legFar,hoof:c.hoof||c.legLine,eye:c.eye,muzzle:c.legFar};
  }
  window.ConquerAnimals3D={triangles,coatColors,pose,CARRIAGE};
})();
