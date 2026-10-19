'use strict';
// CONQUER siege engines in 3D: ram, catapult (onager), trebuchet, siege tower and
// scaling ladder built in Blender (src/assets/siege-engines-model.js,
// tools/blender/build_siege_engines.py). Rigid parts turn about their pivots to
// play the action; wheels roll with the distance travelled. The trebuchet is a
// fixed engine that travels packed on wheels: `deploy` (0 packed .. 1 set up)
// unfolds it. Output is world-space triangles in the ConquerWagons3D mesh format
// (parts sort as units), plus crew anchors and the flying projectile for the
// caller's sprites. Classic script; poses are pure functions of time.
(function(){
  const M=()=>window.ConquerSiegeModel;
  const clamp01=v=>Math.max(0,Math.min(1,v)),ease=k=>k*k*(3-2*k),easeIn=k=>k*k*k;
  const ph=(u,a,b)=>ease(clamp01((u-a)/(b-a))),lerp=(a,b,s)=>a+(b-a)*s;
  // Action cycles (seconds) and the angles they sweep (radians; positive pitch =
  // the forward end of a part goes down about its pivot).
  const CYCLE={ram:1.8,catapult:4.2,trebuchet:6,tower:6,ladder:7,mantlet:4};
  // Trebuchet set-up loop for {mode:'setup'}: packed, unpack, set up, pack again.
  const SETUP=13;
  // Ram: drawn back on its ropes, then driven forward into the gate.
  function ramPose(k){
    if(k<.62)return{ram:.42*ease(k/.62)};
    if(k<.72)return{ram:.42-.62*easeIn((k-.62)/.1)};
    return{ram:-.2*(1-ease((k-.72)/.28))};
  }
  // Catapult: cocked arm lies back over the windlass; release snaps it up against
  // the padded bar; the crew winds it back down and reloads the stone.
  // The arm stops leaning forward against the padded bar (it does not stop upright).
  const CAT_COCKED=-1.35,CAT_STOP=.72;
  function catapultPose(k){
    if(k<.08)return{arm:CAT_COCKED,stone:1};
    if(k<.13){const s=easeIn((k-.08)/.05);return{arm:CAT_COCKED+(CAT_STOP-CAT_COCKED)*s,stone:s<.85?1:0}}
    if(k<.2)return{arm:CAT_STOP-Math.sin((k-.13)/.07*Math.PI)*.14,stone:0};
    const back=ease(clamp01((k-.2)/.7));
    return{arm:CAT_STOP+(CAT_COCKED-CAT_STOP)*back,stone:k>.9?1:0};
  }
  // Trebuchet shot: the beam rests with its long end down in the trough and the
  // sling laid forward along it; the falling counterweight swings the beam over,
  // the sling whips round and lets the stone go near the top; then it is hauled back.
  // The beam swings past vertical towards the target before the stone leaves.
  const TREB_COCKED=-.88,TREB_TOP=1.95;
  function trebuchetShot(k){
    if(k<.06)return{arm:TREB_COCKED,sling:-Math.PI/2,stone:1};
    if(k<.2){
      const s=easeIn((k-.06)/.14),arm=TREB_COCKED+(TREB_TOP-TREB_COCKED)*s;
      // The sling lags, then overtakes the beam (whip) and releases at ~85%.
      const sling=-Math.PI/2+(arm-TREB_COCKED)*(.55+1.9*s*s);
      return{arm,sling,stone:s<.85?1:0};
    }
    if(k<.3){const s=(k-.2)/.1;return{arm:TREB_TOP-.15*Math.sin(s*Math.PI),sling:TREB_TOP+Math.PI*.55*(1-s),stone:0}}
    const back=ease(clamp01((k-.3)/.62)),arm=TREB_TOP+(TREB_COCKED-TREB_TOP)*back;
    return{arm,sling:arm*(1-back)+(-Math.PI/2)*back,stone:k>.94?1:0};
  }
  // How far the trebuchet is set up: explicit state.deploy, packed while moving,
  // the lab's set-up loop, otherwise set up.
  function deployOf(state){
    if(Number.isFinite(state.deploy))return clamp01(state.deploy);
    if(state.mode==='move')return 0;
    if(state.mode==='setup'){
      const t=(state.t||0)%SETUP;
      return t<1?0:t<6?(t-1)/5:t<7?1:t<12?1-(t-7)/5:0;
    }
    return 1;
  }
  // Set-up order (u: 0 packed -> 1 ready; packing plays it backwards):
  //   .00-.15 frame lowered to the ground, wheels slid off their stubs (-.12)
  //   .12-.22 wheels laid flat beside the frame
  //   .22-.55 uprights raised, the rear props sliding along the frame
  //   .55-.65 front props swung up and pinned
  //   .62-.85 beam hoisted from the packed load onto the axle, long end into the trough
  //   .85-1   counterweight box slid forward between the uprights, hoisted and hooked
  function trebuchetPose(state){
    const u=deployOf(state),fire=state.mode==='fire'&&u>=1;
    const shot=fire?trebuchetShot(((state.t||0)%CYCLE.trebuchet)/CYCLE.trebuchet):{arm:TREB_COCKED,sling:-Math.PI/2,stone:u>=1?1:0};
    const rig=M().engines.trebuchet.rig;
    const hoist=ph(u,.62,.85);
    return{u,shot,lift:rig.lift*(1-ph(u,0,.15)),fold:Math.PI/2*(1-ph(u,.22,.55)),propF:1-ph(u,.55,.65),
      hoist,arm:lerp(rig.packedArmPitch,shot.arm,hoist),sling:hoist<1?-Math.PI/2+rig.packedArmPitch*(1-hoist):shot.sling,
      slide:ph(u,.85,.92),raise:ph(u,.92,1),hangers:u>.995,stone:shot.stone,
      wheelOut:ph(u,0,.12),wheelFlat:ph(u,.12,.22)};
  }
  // Tower and ladder are sized for the game's low (H1) wall: patrols walk on its
  // top, structureHeight = 1.15 U. High (H2) walls cannot be scaled, only battered.
  const WALL_WALK=1.15;
  // Siege tower: the bridge drops forward into a crenel and rests on the wall
  // walk, holds, and is hauled up. state.bridge (0 up .. 1 down) overrides.
  function bridgeDown(){
    const e=M().engines.tower;
    return Math.PI/2+Math.asin(clamp01((e.pivots.bridge[2]-WALL_WALK)/e.rig.bridgeLen));
  }
  function towerPose(state){
    const D=bridgeDown();
    if(Number.isFinite(state.bridge))return{bridge:D*ease(clamp01(state.bridge))};
    if(state.mode!=='fire')return{bridge:0};
    const k=((state.t||0)%CYCLE.tower)/CYCLE.tower;
    if(k<.25)return{bridge:D*easeIn(k/.25)};
    if(k<.75)return{bridge:D};
    return{bridge:D*(1-ease((k-.75)/.25))};
  }
  // Scaling ladder: carried flat on the shoulders; the foot is planted and the
  // ladder swung up to lean on the wall, held while the men climb, then lowered.
  // Raised it leans at LADDER_LEAN with its foot LADDER_FOOT ahead of the engine
  // origin. state.up (0 carried .. 1 raised) overrides the 'fire' loop.
  const LADDER_LEAN=.3,LADDER_FOOT=.6/3.5;
  function ladderPose(state){
    const fire=state.mode==='fire',k=fire?((state.t||0)%CYCLE.ladder)/CYCLE.ladder:0;
    const up=Number.isFinite(state.up)?ease(clamp01(state.up)):!fire?0:k<.08?0:k<.4?ease((k-.08)/.32):k<.82?1:1-ease((k-.82)/.18);
    const bob=state.mode==='move'?Math.sin((state.distance||0)*9)*.012:0,L=M().engines.ladder.rig.len;
    return{up,ladder:{x:lerp(-L/2,LADDER_FOOT,up),z:lerp(1.45/3.5,0,up)+bob*(1-up),a:lerp(Math.PI/2,LADDER_LEAN,up)}};
  }
  // Pose for {mode:'idle'|'move'|'fire'|'setup', t, distance, deploy}.
  function pose(engine,state={}){
    const fire=state.mode==='fire',k=fire?((state.t||0)%CYCLE[engine])/CYCLE[engine]:0;
    if(engine==='ram')return fire?ramPose(k):{ram:0};
    if(engine==='catapult')return catapultPose(k);
    if(engine==='tower')return towerPose(state);
    if(engine==='mantlet')return{};
    if(engine==='ladder')return ladderPose(state);
    return trebuchetPose(state);
  }
  function pitch(p,c,a){
    if(!a)return p;
    const dx=p[0]-c[0],dz=p[2]-c[2],ca=Math.cos(a),sa=Math.sin(a);
    return[c[0]+dx*ca+dz*sa,p[1],c[2]-dx*sa+dz*ca];
  }
  // Turn a part by angle a about its modelled pivot c, then carry the pivot to `to`.
  const place=(c,a,to)=>p=>{const q=pitch(p,c,a);return[q[0]-c[0]+to[0],q[1],q[2]-c[2]+to[2]]};
  const angleXZ=(x,z)=>Math.atan2(z,x);
  // Trebuchet parts for a pose: every part rides the frame's lift.
  function trebuchetParts(e,st){
    const pv=e.pivots,rig=e.rig,lift=st.lift,up=p=>[p[0],p[1],p[2]+lift];
    const hinge=pv.tower,axle=pitch(pv.arm,hinge,st.fold);
    const fns={base:up,tower:p=>up(pitch(p,hinge,st.fold))};
    // Rear props: top pinned to the uprights, foot sliding along the frame.
    {
      const F0=pv.propR,U0=rig.propTop,U=pitch(U0,hinge,st.fold),L=rig.propLen;
      const F=[U[0]-Math.sqrt(Math.max(0,L*L-(U[2]-F0[2])**2)),0,F0[2]];
      const a=angleXZ(U0[0]-F0[0],U0[2]-F0[2])-angleXZ(U[0]-F[0],U[2]-F[2]);
      fns.propR=p=>up(place(F0,a,F)(p));
    }
    // Front props: turned about their feet to lie back along the frame.
    {
      const F0=pv.propF,a0=angleXZ(rig.propTop[0]-F0[0],rig.propTop[2]-F0[2]);
      fns.propF=p=>up(pitch(p,F0,-(Math.PI-a0-.04)*st.propF));
    }
    // Beam: from its packed place to the axle.
    const P=rig.packedArm,arc=Math.sin(st.hoist*Math.PI)*1/3.5;
    const armTo=[lerp(P[0],axle[0],st.hoist),0,lerp(P[2],axle[2],st.hoist)+arc];
    const armFn=place(pv.arm,st.arm,armTo);
    fns.arm=p=>up(armFn(p));
    // Box: slid forward, then hoisted until it hangs level from its hinge.
    const H1=armFn(pv.weight),H0=rig.packedHinge;
    const hz=[lerp(H0[0],H1[0],st.slide),0,lerp(H0[2],H1[2],st.raise)];
    fns.weight=fns.hangers=p=>up([p[0]-pv.weight[0]+hz[0],p[1],p[2]-pv.weight[2]+hz[2]]);
    // Sling: pivot rides the beam tip; its own angle is absolute (it swings free).
    // Modelled hanging straight down: -PI/2 lays it forward in the trough,
    // ~PI points it up and over towards the target at the release.
    const tip=armFn(pv.sling);
    fns.sling=fns.slingStone=p=>up(place(pv.sling,st.sling,tip)(p));
    return fns;
  }
  // Each placed part: where it is and how its points move.
  function instances(engine,st,dist){
    const e=M().engines[engine],pv=e.pivots,out=[];
    const treb=engine==='trebuchet'?trebuchetParts(e,st):null;
    for(const name of Object.keys(e.parts)){
      if(name==='wheel')continue;
      if((name==='stone'||name==='slingStone')&&!st.stone)continue;
      if(name==='hangers'&&!st.hangers)continue;
      let fn=p=>p;
      if(treb)fn=treb[name]||fn;
      else if(engine==='ram'&&name==='ram')fn=p=>pitch(p,pv.ram,st.ram);
      else if(engine==='catapult'&&(name==='arm'||name==='stone'))fn=p=>pitch(p,pv.arm,st.arm);
      else if(engine==='tower'&&name==='bridge')fn=p=>pitch(p,pv.bridge,st.bridge);
      else if(engine==='ladder'&&name==='ladder'){const L=st.ladder;fn=place(pv.ladder,L.a,[L.x,0,L.z])}
      out.push({name,part:e.parts[name],fn});
    }
    // Wheels roll with the distance; the trebuchet's come off and lie flat when set up.
    const r=e.wheels.r,a=dist/(r||1),ca=Math.cos(a),sa=Math.sin(a);
    for(const at of e.wheels.at){
      const s=Math.sign(at[1])||1,rig=e.rig;
      const out1=treb?rig.wheelOut*st.wheelOut+r*.9*st.wheelFlat:0,tip=treb?st.wheelFlat*Math.PI/2:0;
      const cz=treb?lerp(at[2],rig.wheelFlatZ,st.wheelFlat):at[2],ct=Math.cos(tip),stp=Math.sin(tip);
      out.push({name:'wheel',part:e.parts.wheel,fn:q=>{
        const x=q[0]*ca+q[2]*sa,z=-q[0]*sa+q[2]*ca,y=q[1];
        return[x+at[0],y*ct+s*z*stp+at[1]+s*out1,-s*y*stp+z*ct+cz];
      }});
    }
    return out;
  }
  // World triangles for one engine. place: {x,y,z,heading,team}; state: {mode,t,distance,deploy}.
  // place.team (a CSS colour) replaces the model's player colour.
  function triangles(engine,placeAt,state={}){
    const m=M(),st=pose(engine,state),pos=[],col=[],gi=[],groups=[];
    const c=Math.cos(placeAt.heading||0),s=Math.sin(placeAt.heading||0),dist=state.distance||0;
    const teamIdx=m.paletteKeys.indexOf('team'),palette=m.palette.map((h,i)=>i===teamIdx&&placeAt.team?placeAt.team:h);
    for(const inst of instances(engine,st,dist)){
      const p=inst.part,g0=pos.length,group=groups.length;
      for(let t=0;t<p.c.length;t++){
        for(let k=0;k<3;k++){
          const q=inst.fn([p.v[t*9+k*3],p.v[t*9+k*3+1],p.v[t*9+k*3+2]]);
          pos.push((placeAt.x||0)+q[0]*c-q[1]*s,(placeAt.y||0)+q[0]*s+q[1]*c,(placeAt.z||0)+q[2]);
        }
        col.push(palette[p.c[t]]);gi.push(group);
      }
      let gx=0,gy=0,gz=0;const n=(pos.length-g0)/3;
      for(let i=g0;i<pos.length;i+=3){gx+=pos[i];gy+=pos[i+1];gz+=pos[i+2]}
      groups.push([gx/n,gy/n,gz/n]);
    }
    return{pos,col,gi,groups,bias:new Array(col.length).fill(0),outward:[]};
  }
  // Crew standing at the engine (world); the ladder men move to its foot when it goes up.
  const LADDER_CREW=[[-.2/3.5,.55/3.5],[-.2/3.5,-.55/3.5]];
  function crew(engine,placeAt,state={}){
    const c=Math.cos(placeAt.heading||0),s=Math.sin(placeAt.heading||0);
    const up=engine==='ladder'?ladderPose(state).up:0;
    return M().engines[engine].crew.map(([x,y,z],i)=>{
      if(up&&LADDER_CREW[i]){x=lerp(x,LADDER_CREW[i][0],up);y=lerp(y,LADDER_CREW[i][1],up)}
      return{x:(placeAt.x||0)+x*c-y*s,y:(placeAt.y||0)+x*s+y*c,z:(placeAt.z||0)+z};
    });
  }
  // The stone in flight while a shot is airborne: {x,y,z} along a ballistic arc
  // ahead of the engine, or null.
  const RANGE={catapult:16,trebuchet:28};    // U, a stylised long lob
  function projectile(engine,placeAt,state={}){
    if(state.mode!=='fire'||!RANGE[engine])return null;
    if(engine==='trebuchet'&&deployOf(state)<1)return null;
    const k=((state.t||0)%CYCLE[engine])/CYCLE[engine],start=engine==='catapult'?.12:.17,flight=engine==='catapult'?.35:.4;
    const f=(k-start)/flight;if(f<0||f>1)return null;
    const c=Math.cos(placeAt.heading||0),s=Math.sin(placeAt.heading||0),d=RANGE[engine]*f,h=RANGE[engine]*.35*4*f*(1-f)+(engine==='catapult'?.95:1.6);
    return{x:(placeAt.x||0)+d*c,y:(placeAt.y||0)+d*s,z:(placeAt.z||0)+h,f};
  }
  window.ConquerSiegeEngines3D={triangles,pose,crew,projectile,deploy:deployOf,CYCLE,SETUP,WALL_WALK,LADDER_LEAN,LADDER_FOOT};
})();
