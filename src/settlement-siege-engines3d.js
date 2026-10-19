'use strict';
// CONQUER siege engines in 3D: ram, catapult (onager) and trebuchet built in Blender
// (src/assets/siege-engines-model.js, ASSETS/blender/build_siege_engines.py).
// Rigid parts turn about their pivots to play the shot; wheels roll with the
// distance travelled. Output is world-space triangles in the ConquerWagons3D mesh
// format (parts sort as units), plus crew anchors and the flying projectile for
// the caller's sprites. Classic script; poses are pure functions of time.
(function(){
  const M=()=>window.ConquerSiegeModel;
  const clamp01=v=>Math.max(0,Math.min(1,v)),ease=k=>k*k*(3-2*k),easeIn=k=>k*k*k;
  // Shot cycles (seconds) and the angles they sweep (radians; positive pitch =
  // the forward end of a part goes down about its pivot).
  const CYCLE={ram:1.8,catapult:4.2,trebuchet:6};
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
  // Trebuchet: the beam rests with its long end down in the trough and the sling
  // laid forward along it; the falling counterweight swings the beam over, the sling
  // whips round and lets the stone go near the top; then the beam is hauled back.
  // The beam swings past vertical towards the target before the stone leaves.
  const TREB_COCKED=-.75,TREB_TOP=1.95;
  function trebuchetPose(k){
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
  // Pose for {mode:'idle'|'move'|'fire', t}: fire loops the shot, otherwise cocked.
  function pose(engine,state={}){
    const fire=state.mode==='fire',k=fire?((state.t||0)%CYCLE[engine])/CYCLE[engine]:0;
    if(engine==='ram')return fire?ramPose(k):{ram:0};
    if(engine==='catapult')return catapultPose(k);
    return trebuchetPose(k);
  }
  function pitch(p,c,a){
    if(!a)return p;
    const dx=p[0]-c[0],dz=p[2]-c[2],ca=Math.cos(a),sa=Math.sin(a);
    return[c[0]+dx*ca+dz*sa,p[1],c[2]-dx*sa+dz*ca];
  }
  // Each placed part: where it is and how its points move.
  function instances(engine,st){
    const e=M().engines[engine],pv=e.pivots,out=[];
    for(const name of Object.keys(e.parts)){
      if(name==='wheel')continue;
      if(name==='stone'&&!st.stone)continue;
      if(name==='slingStone'&&!st.stone)continue;
      let fn=p=>p;
      if(engine==='ram'&&name==='ram')fn=p=>pitch(p,pv.ram,st.ram);
      else if(engine==='catapult'&&(name==='arm'||name==='stone'))fn=p=>pitch(p,pv.arm,st.arm);
      else if(engine==='trebuchet'&&name==='arm')fn=p=>pitch(p,pv.arm,st.arm);
      else if(engine==='trebuchet'&&name==='weight'){
        // The box hangs from its hinge: it follows the hinge, it does not turn.
        const h=pitch(pv.weight,pv.arm,st.arm),dx=h[0]-pv.weight[0],dz=h[2]-pv.weight[2];
        fn=p=>[p[0]+dx,p[1],p[2]+dz];
      }else if(engine==='trebuchet'&&(name==='sling'||name==='slingStone')){
        // Pivot rides the beam tip; the sling's own angle is absolute (it swings free).
        const tip=pitch(pv.sling,pv.arm,st.arm),dx=tip[0]-pv.sling[0],dz=tip[2]-pv.sling[2];
        // Modelled hanging straight down: -PI/2 lays it forward in the trough,
        // ~PI points it up and over towards the target at the release.
        fn=p=>{const q=pitch(p,pv.sling,st.sling);return[q[0]+dx,q[1],q[2]+dz]};
      }
      out.push({name,part:e.parts[name],fn});
    }
    for(const at of e.wheels.at)out.push({name:'wheel',part:e.parts.wheel,at,r:e.wheels.r});
    return out;
  }
  // World triangles for one engine. place: {x,y,z,heading}; state: {mode,t,distance}.
  function triangles(engine,place,state={}){
    const m=M(),st=pose(engine,state),pos=[],col=[],gi=[],groups=[];
    const c=Math.cos(place.heading||0),s=Math.sin(place.heading||0),dist=state.distance||0;
    for(const inst of instances(engine,st)){
      const p=inst.part,g0=pos.length,group=groups.length;
      const a=inst.r?dist/inst.r:0,ca=Math.cos(a),sa=Math.sin(a);
      for(let t=0;t<p.c.length;t++){
        for(let k=0;k<3;k++){
          let q=[p.v[t*9+k*3],p.v[t*9+k*3+1],p.v[t*9+k*3+2]];
          if(inst.at){const x=q[0]*ca+q[2]*sa,z=-q[0]*sa+q[2]*ca;q=[x+inst.at[0],q[1]+inst.at[1],z+inst.at[2]]}
          else q=inst.fn(q);
          pos.push((place.x||0)+q[0]*c-q[1]*s,(place.y||0)+q[0]*s+q[1]*c,(place.z||0)+q[2]);
        }
        col.push(m.palette[p.c[t]]);gi.push(group);
      }
      let gx=0,gy=0,gz=0;const n=(pos.length-g0)/3;
      for(let i=g0;i<pos.length;i+=3){gx+=pos[i];gy+=pos[i+1];gz+=pos[i+2]}
      groups.push([gx/n,gy/n,gz/n]);
    }
    return{pos,col,gi,groups,bias:new Array(col.length).fill(0),outward:[]};
  }
  // Crew standing at the engine (world), and the stone in flight while a shot is
  // airborne: {x,y,z} along a ballistic arc ahead of the engine, or null.
  function crew(engine,place){
    const c=Math.cos(place.heading||0),s=Math.sin(place.heading||0);
    return M().engines[engine].crew.map(([x,y,z])=>({x:(place.x||0)+x*c-y*s,y:(place.y||0)+x*s+y*c,z:(place.z||0)+z}));
  }
  const RANGE={catapult:16,trebuchet:28};    // U, a stylised long lob
  function projectile(engine,place,state={}){
    if(state.mode!=='fire'||!RANGE[engine])return null;
    const k=((state.t||0)%CYCLE[engine])/CYCLE[engine],start=engine==='catapult'?.12:.17,flight=engine==='catapult'?.35:.4;
    const f=(k-start)/flight;if(f<0||f>1)return null;
    const c=Math.cos(place.heading||0),s=Math.sin(place.heading||0),d=RANGE[engine]*f,h=RANGE[engine]*.35*4*f*(1-f)+(engine==='catapult'?.95:1.6);
    return{x:(place.x||0)+d*c,y:(place.y||0)+d*s,z:(place.z||0)+h,f};
  }
  window.ConquerSiegeEngines3D={triangles,pose,crew,projectile,CYCLE};
})();
