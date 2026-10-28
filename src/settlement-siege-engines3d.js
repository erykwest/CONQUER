'use strict';
// CONQUER siege engines in 3D: ram, catapult (mangonel), trebuchet, siege towers,
// mantlet, scaling ladder and ballista built in Blender (src/assets/siege-engines-model.js,
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
  const CYCLE={ram:1.8,catapult:4.2,trebuchet:6,tower:6,tower2:6,ladder:7,mantlet:3.5,ballista:3.5};
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
  // Cocked: the long end down at the trough (rig.cocked, from the model).
  const TREB_TOP=1.95,trebCocked=()=>M().engines.trebuchet.rig.cocked;
  function trebuchetShot(k){
    const TREB_COCKED=trebCocked();
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
  //   .12-.22 wheels laid flat beside the frame, .22-.30 slid away under it
  //   .22-.64 A-frames raised part by part (rig.stow: king posts, front legs,
  //           rear legs, then the ties are pinned and the ladder set up)
  //   .62-.85 beam hoisted from the packed load onto the axle, long end into the trough
  //   .85-1   counterweight box slid forward between the uprights, hoisted and hooked
  function trebuchetPose(state){
    const u=deployOf(state),fire=state.mode==='fire'&&u>=1;
    const shot=fire?trebuchetShot(((state.t||0)%CYCLE.trebuchet)/CYCLE.trebuchet):{arm:trebCocked(),sling:-Math.PI/2,stone:u>=1?1:0};
    const rig=M().engines.trebuchet.rig;
    const hoist=ph(u,.62,.85),stowed={};
    for(const [name,s] of Object.entries(rig.stow))stowed[name]=1-ph(u,s.at[0],s.at[1]);
    return{u,shot,lift:rig.lift*(1-ph(u,0,.15)),stowed,ammo:state.ammo,
      hoist,arm:lerp(rig.packedArmPitch,shot.arm,hoist),sling:hoist<1?-Math.PI/2+rig.packedArmPitch*(1-hoist):shot.sling,
      slide:ph(u,.85,.92),raise:ph(u,.92,1),hangers:u>.995,stone:shot.stone,
      wheelOut:ph(u,0,.12),wheelFlat:ph(u,.12,.22),wheelIn:ph(u,.22,.3)};
  }
  // The ladder is sized for the game's low (H1) wall: patrols walk on its top,
  // structureHeight = 1.15 U. The assault tower comes in two levels: 'tower' for H1,
  // 'tower2' (upgrade) for the high H2 wall (2.10 U) with archers on a fighting top.
  const WALL_WALK=1.15;
  // Siege tower: the bridge drops forward into a crenel and rests on the wall
  // walk, holds, and is hauled up. state.bridge (0 up .. 1 down) overrides.
  function bridgeDown(engine='tower'){
    const e=M().engines[engine];
    // Each level lands on the wall it was built for (rig.walk: H1 or H2 wall top).
    return Math.PI/2+Math.asin(clamp01((e.pivots.bridge[2]-e.rig.walk)/e.rig.bridgeLen));
  }
  // Upgrades: state.hides shows the wet hides over the front and sides.
  function towerPose(state,engine='tower'){
    const D=bridgeDown(engine),hides=!!state.hides;
    if(Number.isFinite(state.bridge))return{bridge:D*ease(clamp01(state.bridge)),hides};
    if(state.mode!=='fire')return{bridge:0,hides};
    const k=((state.t||0)%CYCLE[engine])/CYCLE[engine];
    if(k<.25)return{bridge:D*easeIn(k/.25),hides};
    if(k<.75)return{bridge:D,hides};
    return{bridge:D*(1-ease((k-.75)/.25)),hides};
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
  // Ballista: loaded and drawn at rest; the claw lets go, the arms snap forward
  // (a little past rest) and the bolt leaves; the winch draws the string back and
  // a new bolt is laid in the trough. draw: 1 drawn .. 0 string straight.
  const BALLISTA_DRAW=.5;
  function ballistaPose(state){
    if(state.mode!=='fire')return{draw:1,bolt:1};
    const k=((state.t||0)%CYCLE.ballista)/CYCLE.ballista;
    if(k<.06)return{draw:1,bolt:1};
    if(k<.1){const s=easeIn((k-.06)/.04);return{draw:1-1.12*s,bolt:s<.3?1:0}}
    if(k<.18)return{draw:-.12*(1-ease((k-.1)/.08)),bolt:0};
    if(k<.85)return{draw:ease((k-.18)/.67),bolt:0};
    return{draw:1,bolt:k>.9?1:0};
  }
  // Pose for {mode:'idle'|'move'|'fire'|'setup', t, distance, deploy, ammo, ballista}.
  function pose(engine,state={}){
    const fire=state.mode==='fire',k=fire?((state.t||0)%CYCLE[engine])/CYCLE[engine]:0;
    if(engine==='ram')return fire?ramPose(k):{ram:0};
    if(engine==='catapult')return{...catapultPose(k),ammo:state.ammo,mounted:!!state.mounted};
    if(engine==='tower'||engine==='tower2')return towerPose(state,engine);
    if(engine==='mantlet')return state.ballista?{ballista:ballistaPose(state)}:{};
    if(engine==='ballista')return ballistaPose(state);
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
  // Turn about a vertical axis through c (positive: +x towards +y).
  function yaw(p,c,a){
    if(!a)return p;
    const dx=p[0]-c[0],dy=p[1]-c[1],ca=Math.cos(a),sa=Math.sin(a);
    return[c[0]+dx*ca-dy*sa,c[1]+dx*sa+dy*ca,p[2]];
  }
  // Trebuchet parts for a pose: every part rides the frame's lift. A-frame parts
  // lie as rig.stow says while packed (pitch about their pivot, or dropped by dz).
  function trebuchetParts(e,st){
    const pv=e.pivots,rig=e.rig,lift=st.lift,up=p=>[p[0],p[1],p[2]+lift];
    const fns={base:up};
    for(const [name,s] of Object.entries(rig.stow)){
      const k=st.stowed[name],a=(s.pitch||0)*k,dz=(s.dz||0)*k,c=pv[name];
      fns[name]=p=>{const q=pitch(p,c,a);return up([q[0],q[1],q[2]+dz])};
    }
    // Beam: from its packed place to the axle (the king posts are up by then).
    const P=rig.packedArm,axle=pv.arm,arc=Math.sin(st.hoist*Math.PI)*1/3.5;
    const armTo=[lerp(P[0],axle[0],st.hoist),0,lerp(P[2],axle[2],st.hoist)+arc];
    const armFn=place(pv.arm,st.arm,armTo);
    fns.arm=p=>up(armFn(p));
    // Box: slid forward, then hoisted until it hangs level from its hinge.
    const H1=armFn(pv.weight),H0=rig.packedHinge;
    const hz=[lerp(H0[0],H1[0],st.slide),0,lerp(H0[2],H1[2],st.raise)];
    fns.weight=fns.hangers=p=>up([p[0]-pv.weight[0]+hz[0],p[1],p[2]-pv.weight[2]+hz[2]]);
    // Sling: pivot rides the beam tip; its own angle is absolute (it swings free).
    // Modelled hanging straight down: -PI/2 lays it forward on the trough,
    // ~PI points it up and over towards the target at the release.
    const tip=armFn(pv.sling);
    fns.sling=fns.slingStone=p=>up(place(pv.sling,st.sling,tip)(p));
    return fns;
  }
  // Ballista: arms turn about their skeins, the slider carries the claw, the
  // string is a thin rope from each arm tip to the claw (built here, not modelled).
  function ballistaParts(e,st){
    const pv=e.pivots,rig=e.rig,a=BALLISTA_DRAW*st.draw;
    const tipRest=rig.tipL[0],claw=st.draw>=0?lerp(tipRest,rig.claw,st.draw):tipRest;
    const fns={armL:p=>yaw(p,pv.armL,a),armR:p=>yaw(p,pv.armR,-a),slider:p=>[p[0]+claw-rig.claw,p[1],p[2]]};
    const tipL=yaw(rig.tipL,pv.armL,a),tipR=yaw(rig.tipR,pv.armR,-a),nock=[claw,0,rig.boltZ-.005];
    return{fns,string:{v:[...rope(tipL,nock,.006),...rope(nock,tipR,.006)],key:'rope'}};
  }
  // A thin square rope (8 triangles) from a to b, half-thickness h.
  function rope(a,b,h){
    const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d)||1,n=d.map(v=>v/L);
    let s=[-n[1],n[0],0];const sl=Math.hypot(...s);s=sl>1e-6?s.map(v=>v/sl*h):[h,0,0];
    const tt=[n[1]*s[2]-n[2]*s[1],n[2]*s[0]-n[0]*s[2],n[0]*s[1]-n[1]*s[0]];   // n x s: length h
    const corner=(p,i)=>{const cs=[[1,1],[-1,1],[-1,-1],[1,-1]][i];return[p[0]+s[0]*cs[0]+tt[0]*cs[1],p[1]+s[1]*cs[0]+tt[1]*cs[1],p[2]+s[2]*cs[0]+tt[2]*cs[1]]};
    const out=[];
    for(let i=0;i<4;i++){
      const a0=corner(a,i),a1=corner(a,(i+1)%4),b0=corner(b,i),b1=corner(b,(i+1)%4);
      out.push(...a0,...a1,...b1,...a0,...b1,...b0);
    }
    return out;
  }
  // Loaded shots: the incendiary ball is pitch-black and burns (the caller draws
  // the flames on mesh.burning); the scatter shot is a heap of small stones.
  const PITCH_BALL='#2b1a10';
  // Each placed part: where it is and how its points move.
  function instances(engine,st,dist){
    const e=M().engines[engine],pv=e.pivots,out=[];
    const treb=engine==='trebuchet'?trebuchetParts(e,st):null;
    const bal=engine==='ballista'?ballistaParts(e,st):null;
    const scatter=engine==='catapult'&&st.ammo==='scatter',fire=st.ammo==='fire';
    for(const name of Object.keys(e.parts)){
      if(name==='wheel')continue;
      if((name==='stone'||name==='slingStone')&&(!st.stone||(name==='stone'&&scatter)))continue;
      if(name==='pebbles'&&(!scatter||!st.stone))continue;
      if(name==='hangers'&&!st.hangers)continue;
      if(name==='hides'&&!st.hides)continue;
      if(name==='bolt'&&!st.bolt)continue;
      if((name==='shutter'||name==='props')&&st.ballista)continue;
      let fn=p=>p,color=null,burning=false;
      if(treb)fn=treb[name]||fn;
      else if(bal)fn=bal.fns[name]||fn;
      else if(engine==='ram'&&name==='ram')fn=p=>pitch(p,pv.ram,st.ram);
      else if(engine==='catapult'&&(name==='arm'||name==='stone'||name==='pebbles'))fn=p=>pitch(p,pv.arm,st.arm);
      else if((engine==='tower'||engine==='tower2')&&name==='bridge')fn=p=>pitch(p,pv.bridge,st.bridge);
      else if(engine==='ladder'&&name==='ladder'){const L=st.ladder;fn=place(pv.ladder,L.a,[L.x,0,L.z])}
      if(fire&&(name==='stone'||name==='slingStone')){color=PITCH_BALL;burning=true}
      out.push({name,part:e.parts[name],fn,color,burning});
    }
    if(bal)out.push({name:'string',part:{v:bal.string.v,c:null},key:bal.string.key,fn:p=>p});
    // Wheels roll with the distance; the trebuchet's come off, are laid flat and
    // stowed under the frame: the engine stands set up without them.
    const r=e.wheels.r,a=dist/(r||1),ca=Math.cos(a),sa=Math.sin(a);
    for(const at of e.wheels.at){
      if((treb&&st.wheelIn>=1)||st.mounted)break;          // state.mounted: on a tower deck, no wheels
      const s=Math.sign(at[1])||1,rig=e.rig;
      const out1=treb?(rig.wheelOut*st.wheelOut+r*.9*st.wheelFlat)*(1-st.wheelIn)-Math.abs(at[1])*.6*st.wheelIn:0,tip=treb?st.wheelFlat*Math.PI/2:0;
      const cz=treb?lerp(at[2],rig.wheelFlatZ,st.wheelFlat):at[2],ct=Math.cos(tip),stp=Math.sin(tip);
      out.push({name:'wheel',part:e.parts.wheel,fn:q=>{
        const x=q[0]*ca+q[2]*sa,z=-q[0]*sa+q[2]*ca,y=q[1];
        return[x+at[0],y*ct+s*z*stp+at[1]+s*out1,-s*y*stp+z*ct+cz];
      }});
    }
    // Mantlet upgrade: the ballista stands behind the shield, its bolt through the embrasure.
    if(engine==='mantlet'&&st.ballista){
      const o=e.rig.ballista;
      for(const inst of instances('ballista',st.ballista,0)){
        const f=inst.fn;out.push({...inst,fn:p=>{const q=f(p);return[q[0]+o[0],q[1]+o[1],q[2]+o[2]]}});
      }
    }
    return out;
  }
  // World triangles for one engine. place: {x,y,z,heading,team,scale}; state: {mode,t,distance,
  // deploy,ammo,ballista}. place.team (a CSS colour) replaces the model's player colour.
  // mesh.burning lists the world points where an incendiary shot is burning.
  function triangles(engine,placeAt,state={}){
    const m=M(),st=pose(engine,state),pos=[],col=[],gi=[],groups=[],burning=[];
    const sc=placeAt.scale||1,c=Math.cos(placeAt.heading||0)*sc,s=Math.sin(placeAt.heading||0)*sc,dist=state.distance||0;
    const teamIdx=m.paletteKeys.indexOf('team'),palette=m.palette.map((h,i)=>i===teamIdx&&placeAt.team?placeAt.team:h);
    for(const inst of instances(engine,st,dist)){
      const p=inst.part,g0=pos.length,group=groups.length,n9=p.v.length/9;
      const own=inst.key?palette[m.paletteKeys.indexOf(inst.key)]:null;
      for(let t=0;t<n9;t++){
        for(let k=0;k<3;k++){
          const q=inst.fn([p.v[t*9+k*3],p.v[t*9+k*3+1],p.v[t*9+k*3+2]]);
          pos.push((placeAt.x||0)+q[0]*c-q[1]*s,(placeAt.y||0)+q[0]*s+q[1]*c,(placeAt.z||0)+q[2]*sc);
        }
        col.push(inst.color||own||palette[p.c[t]]);gi.push(group);
      }
      let gx=0,gy=0,gz=0;const n=(pos.length-g0)/3;
      for(let i=g0;i<pos.length;i+=3){gx+=pos[i];gy+=pos[i+1];gz+=pos[i+2]}
      groups.push([gx/n,gy/n,gz/n]);
      if(inst.burning)burning.push({x:gx/n,y:gy/n,z:gz/n});
    }
    return{pos,col,gi,groups,bias:new Array(col.length).fill(0),outward:[],burning};
  }
  // Crew standing at the engine (world); the ladder men move to its foot when it goes up;
  // with the ballista behind the mantlet, two men work it and two hold the shield.
  const LADDER_CREW=[[-.2/3.5,.55/3.5],[-.2/3.5,-.55/3.5]];
  function crew(engine,placeAt,state={}){
    const c=Math.cos(placeAt.heading||0),s=Math.sin(placeAt.heading||0);
    const up=engine==='ladder'?ladderPose(state).up:0,e=M().engines[engine];
    const spots=engine==='mantlet'&&state.ballista?[...e.rig.ballistaCrew,...e.crew.slice(2)]:e.crew;
    return spots.map(([x,y,z],i)=>{
      if(up&&LADDER_CREW[i]){x=lerp(x,LADDER_CREW[i][0],up);y=lerp(y,LADDER_CREW[i][1],up)}
      return{x:(placeAt.x||0)+x*c-y*s,y:(placeAt.y||0)+x*s+y*c,z:(placeAt.z||0)+z};
    });
  }
  // What is in flight: {x,y,z,f,ammo} along a ballistic arc ahead of the engine, or null.
  //   ammo 'stone' | 'fire' (trebuchet upgrade: burning ball) | 'scatter' (mangonel
  //   upgrade: pellets[] spreading as they fly) | 'bolt' (ballista: flat and fast,
  //   with heading). The mantlet with its ballista shoots bolts too.
  const RANGE={catapult:16,trebuchet:28,ballista:22};    // U, a stylised long lob / flat shot
  const PELLETS=[[0,0],[.5,-.3],[-.45,-.2],[.25,.45],[-.3,.4],[.7,.15],[-.65,.2]];
  function projectile(engine,placeAt,state={}){
    if(state.mode!=='fire')return null;
    let ox=0,oz=0;
    if(engine==='mantlet'){if(!state.ballista)return null;ox=M().engines.mantlet.rig.ballista[0];engine='ballista'}
    if(!RANGE[engine])return null;
    if(engine==='trebuchet'&&deployOf(state)<1)return null;
    const k=((state.t||0)%CYCLE[engine])/CYCLE[engine];
    const [start,flight]=engine==='catapult'?[.12,.35]:engine==='ballista'?[.085,.12]:[.17,.4];
    const f=(k-start)/flight;if(f<0||f>1)return null;
    const heading=placeAt.heading||0,c=Math.cos(heading),s=Math.sin(heading),d=RANGE[engine]*f+ox;
    const at=(dx,dy,z)=>({x:(placeAt.x||0)+dx*c-dy*s,y:(placeAt.y||0)+dx*s+dy*c,z:(placeAt.z||0)+z});
    if(engine==='ballista'){
      const rig=M().engines.ballista.rig;
      return{...at(d+rig.muzzle,0,rig.boltZ+oz+.6*4*f*(1-f)),f,ammo:'bolt',heading};
    }
    const h=RANGE[engine]*.35*4*f*(1-f)+(engine==='catapult'?.95:1.6);
    const ammo=engine==='catapult'?(state.ammo==='scatter'?'scatter':'stone'):(state.ammo==='fire'?'fire':'stone');
    const out={...at(d,0,h),f,ammo};
    // Scatter: the heap opens into a cone, shorter and lower than a single stone.
    if(ammo==='scatter')out.pellets=PELLETS.map(([a,b])=>at(d*(1+a*.12*f),b*2.2*f,h*(1+a*.15)));
    return out;
  }
  // Archers on a tower's fighting top (level 2), world positions.
  function archers(engine,placeAt){
    const c=Math.cos(placeAt.heading||0),s=Math.sin(placeAt.heading||0);
    return(M().engines[engine].rig?.archers||[]).map(([x,y,z])=>({x:(placeAt.x||0)+x*c-y*s,y:(placeAt.y||0)+x*s+y*c,z:(placeAt.z||0)+z}));
  }
  window.ConquerSiegeEngines3D={triangles,pose,crew,archers,projectile,deploy:deployOf,CYCLE,SETUP,RANGE,WALL_WALK,LADDER_LEAN,LADDER_FOOT};
})();
