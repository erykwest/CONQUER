'use strict';
// CONQUER siege assault choreography: how the men work each engine against the
// game's low (H1) stone wall, its gatehouse and a moat. Pure functions of time in a
// LOCAL frame, world units (U; 1 U = 3.5 m): attackers come from -x, the outer wall
// face is x = 0, y runs along the wall with the gate at y = 0.
//   ram      pushed over the filled moat to the gatehouse, swung by its crew
//   mantlet  pushed into bow range short of the moat; archers step out to shoot
//   ladder   carried to the wall, raised, climbed; the men step onto the wall top
//   tower    pushed to the wall, bridge lowered onto it, the party crosses
//   moat     men carry fascines and throw them in until the crossing is filled
// High (H2) walls cannot be scaled (no ladder or tower reaches them), only battered.
// The wall geometry G comes from the real structures (ConquerSiegePreview) or the
// defaults below, which copy the game's H1 wall, stone gate and water moat.
// scene(kind,t,G) -> {engine:{name,place,state}|null, soldiers, arrows, carried,
//   flying, fill:{span,progress}, impact}; meshes(scene) -> engine + carried loads.
(function(){
  const SE=()=>window.ConquerSiegeEngines3D,MODEL=()=>window.ConquerSiegeModel;
  const m=v=>v/3.5;
  const clamp01=v=>Math.max(0,Math.min(1,v)),ease=k=>k*k*(3-2*k),lerp=(a,b,s)=>a+(b-a)*s;
  const seg=(t,a,b)=>clamp01((t-a)/(b-a));
  // Game defaults: H1 wall (structureHeight 1.15, tier 2 width .5), stone gatehouse
  // 1.5 x 1.5 x 2.8 sticking out of the wall face, water moat 1.5 wide (crossings
  // WIDTHS.moat) 2.5 U out, depth .3, water at -.18. Heavy crossing widths as in
  // settlement-crossings HEAVY_WIDTHS.
  const DEFAULT={face:0,walk:1.15,thick:.5,half:4.5,gateHalf:.75,gateH:2.8,door:-.5,
    moat:[-4,-2.5],water:-.18,bottom:-.3,merlonH:.18};
  const HEAVY={ram:1.4,tower:2.4,mantlet:1,ladder:1.4};
  const CYCLE={ram:16,mantlet:14,ladder:18,tower:20,moat:17};
  const FASCINE_R=m(.35);

  const man=(p,type,id,extra={})=>({x:p.x,y:p.y,z:p.z||0,type,id,walk:false,carry:null,dir:1,aim:0,climb:0,...extra});
  const filledMoat=kind=>({span:HEAVY[kind],progress:1});

  function ram(t,G){
    const reach=m(3.81);                     // pivot -> iron head at the blow (Blender ram, pitch -.2)
    const X0=G.moat[0]-1.6,X1=G.door-reach,s=ease(seg(t,0,7)),x=lerp(X0,X1,s),place={x,y:0,heading:0};
    const STRIKES=4,P=SE().CYCLE.ram,bat=t>=7&&t<7+P*STRIKES;
    const state=bat?{mode:'fire',t:t-7,distance:x-X0}:{mode:t<7?'move':'idle',distance:x-X0};
    const a=bat?SE().pose('ram',state).ram:0;
    // The head meets the door at 72% of each swing.
    const impacts=[...Array(STRIKES).keys()].map(n=>7+P*(n+.72));
    let shake=0;
    for(const ti of impacts){const d=t-ti;if(d>=0&&d<.45)shake=Math.max(shake,(1-d/.45)*Math.abs(Math.cos(d*30)))}
    const open=ease(seg(t,impacts[STRIKES-1],impacts[STRIKES-1]+.8));
    // The crew haul on the log: they lean back with it and drive forward on the blow.
    const soldiers=SE().crew('ram',place,state).map((p,i)=>man({...p,x:p.x-a*m(.8)},'spearman','ram'+i,{walk:t<7}));
    return{engine:{name:'ram',place,state},soldiers,arrows:[],carried:[],flying:[],gate:{open,shake},fill:filledMoat('ram'),
      impact:impacts.some(ti=>t>=ti&&t<ti+.12)};
  }

  function mantlet(t,G){
    const X0=G.moat[0]-4.5,X1=G.moat[0]-.7,s=ease(seg(t,0,6)),x=lerp(X0,X1,s),place={x,y:0,heading:0};
    const state={mode:t<6?'move':'idle',distance:x-X0},soldiers=[],arrows=[];
    SE().crew('mantlet',place,state).forEach((p,i)=>{
      const archer=i>=2;let y=p.y,aim=0;
      if(archer&&t>=6){
        // Step out from behind the shield, loose, step back; the two take turns.
        const side=i===2?1:-1,q=t-6-(i-2)*1.2;
        if(q>=0){
          const ph=q%2.4,n=Math.floor(q/2.4);
          const out=ph<.4?ease(ph/.4):ph<1.6?1:ph<2?1-ease((ph-1.6)/.4):0;
          y+=side*out*m(1.2);aim=out;
          if(ph>=.9&&ph<1.6){
            const f=(ph-.9)/.7,ty=((n*5+i*3)%7-3)*.6;
            const at=g=>[lerp(p.x+m(.3),G.face-.02,g),lerp(y,ty,g),lerp(m(1.4),G.walk+.1,g)+Math.sin(Math.PI*g)*m(2.5)];
            arrows.push({at:at(f),to:at(Math.min(1,f+.04))});
          }
        }
      }
      soldiers.push(man({...p,y},archer?'archer':'spearman','mantlet'+i,{walk:t<6,aim}));
    });
    return{engine:{name:'mantlet',place,state},soldiers,arrows,carried:[],flying:[],gate:{open:0,shake:0},fill:null};
  }

  function ladder(t,G){
    const lean=SE().LADDER_LEAN,FOOT=G.face-G.walk*Math.tan(lean)-.02,X0=G.moat[0]-1.8,X1=FOOT-SE().LADDER_FOOT;
    const s=ease(seg(t,0,6)),x=lerp(X0,X1,s),place={x,y:G.ladderY??1.6,heading:0},Y=place.y;
    const state={mode:t<6?'move':'idle',distance:x-X0,up:seg(t,6,8)};
    const crew=SE().crew('ladder',place,state);
    // The two carriers and two men following them climb one after the other.
    const ground=[crew[0],crew[1],{x:x-m(3.4),y:Y+m(.5)},{x:x-m(3.9),y:Y-m(.5)}];
    const queue=i=>({x:FOOT-m(.8)-i*m(.5),y:Y+(i%2?-1:1)*m(.5)});
    const rise=G.walk/Math.cos(lean),sl=Math.sin(lean),cl=Math.cos(lean),off=m(.28);
    const onLadder=d=>({x:FOOT+d*sl-off*cl,y:Y,z:d*cl+off*sl});
    const posts=[-.9,.9,-1.8,1.8];
    const soldiers=ground.map((g,i)=>{
      const start=8.4+i*1.8,c=t-start;
      let p={x:g.x,y:g.y,z:0},walk=t<6,climb=0,dir=1;
      if(i>=2&&t>=6){const q=queue(i),k=ease(seg(t,6,7.2));p={x:lerp(g.x,q.x,k),y:lerp(g.y,q.y,k),z:0};walk=k>0&&k<1}
      if(c>=0){
        const top=onLadder(rise),onWall={x:G.face+G.thick/2,y:Y,z:G.walk},post={x:G.face+G.thick/2,y:Y+posts[i],z:G.walk};
        if(c<.35){const k=c/.35,b=onLadder(0);p={x:lerp(p.x,b.x,k),y:lerp(p.y,Y,k),z:0};walk=true}
        else if(c<2.6){p=onLadder(rise*(c-.35)/2.25);climb=1}
        else if(c<3.1){const k=ease((c-2.6)/.5);p={x:lerp(top.x,onWall.x,k),y:Y,z:lerp(top.z,onWall.z,k)+Math.sin(Math.PI*k)*m(.25)};walk=true}
        else if(c<4.4){const k=ease((c-3.1)/1.3);p={x:onWall.x,y:lerp(Y,post.y,k),z:G.walk};walk=true}
        else{p=post;dir=-1}
      }
      return man(p,'spearman','ladder'+i,{walk,climb,dir});
    });
    return{engine:{name:'ladder',place,state},soldiers,arrows:[],carried:[],flying:[],gate:{open:0,shake:0},fill:filledMoat('ladder'),fillY:Y};
  }

  function tower(t,G){
    const e=MODEL().engines.tower,pb=e.pivots.bridge,L=e.rig.bridgeLen;
    const drop=pb[2]-G.walk,reach=Math.sqrt(Math.max(0,L*L-drop*drop)),landing=G.face+Math.min(G.thick*.5,.2);
    const X0=G.moat[0]-2.2,X1=landing-pb[0]-reach,s=ease(seg(t,0,9)),x=lerp(X0,X1,s);
    const place={x,y:G.towerY??-1.8,heading:0},Y=place.y;
    const state={mode:t<9?'move':'idle',distance:x-X0,bridge:seg(t,9,11)};
    const soldiers=SE().crew('tower',place,state).map((p,i)=>man(p,'spearman','pusher'+i,{walk:t<9}));
    // The assault party climbs inside, comes up on the platform and crosses.
    const deck=pb[2]+m(.07),root={x:x+pb[0],z:deck},tip={x:landing,z:G.walk};
    const posts=[-.7,.7,-1.4,1.4,-2.1];
    for(let i=0;i<5;i++){
      const c=t-(11.2+i*.9);if(c<0)continue;
      const from={x:x-m(.5),y:Y+m(((i%3)-1)*.7),z:deck},post={x:G.face+G.thick/2,y:Y+posts[i],z:G.walk};
      let p,walk=true,dir=1;
      if(c<.4){const k=c/.4;p={x:lerp(from.x,root.x,k),y:lerp(from.y,Y,k),z:deck}}
      else if(c<1.4){const k=c-.4;p={x:lerp(root.x,tip.x,k),y:Y,z:lerp(root.z,tip.z,k)}}
      else if(c<1.8){const k=ease((c-1.4)/.4);p={x:lerp(tip.x,post.x,k),y:Y,z:G.walk}}
      else if(c<2.8){const k=ease((c-1.8));p={x:post.x,y:lerp(Y,post.y,k),z:G.walk}}
      else{p=post;walk=false;dir=-1}
      soldiers.push(man(p,'spearman','assault'+i,{walk,dir}));
    }
    return{engine:{name:'tower',place,state},soldiers,arrows:[],carried:[],flying:[],gate:{open:0,shake:0},fill:filledMoat('tower'),fillY:Y};
  }

  // Fascine carriers: two trips each; every bundle thrown advances the game's fill
  // patch (settlement-crossings: it creeps across the moat from the near bank).
  const FASCINE_Y=[-1.1,-.65,-.2,.25,.7,1.15];
  function moat(t,G){
    const S=G.moat[0]-3.2,E=G.moat[0]-.25,P=6.4,TRIPS=2,soldiers=[],carried=[],flying=[];
    const mid=(G.moat[0]+G.moat[1])/2;let landed=0;
    FASCINE_Y.forEach((y,i)=>{
      const o=i*.8,tau=t-o;
      for(let n=0;n<TRIPS;n++)if(tau>=n*P+3.2)landed++;
      let x=S,walk=false,carry=true,dir=1;
      if(tau>=TRIPS*P)carry=false;
      else if(tau>=0){
        const n=Math.floor(tau/P),ph=tau-n*P;
        if(ph<2.6){x=lerp(S,E,ph/2.6);walk=true}
        else if(ph<3.2){
          x=E;
          if(ph>=2.8){
            carry=false;const f=(ph-2.8)/.4;
            flying.push({x:lerp(E+m(.4),mid,f),y,z:lerp(m(1.6),G.bottom+FASCINE_R*(1+2*n),f)+Math.sin(Math.PI*f)*m(.8),spin:f*2});
          }
        }
        else if(ph<5.8){x=lerp(E,S,(ph-3.2)/2.6);walk=true;carry=false;dir=-1}
        else carry=ph>6.1;
      }
      const s=man({x,y:y+m(.35)},'spearman','fascine'+i,{walk,dir});
      soldiers.push(s);
      if(carry)carried.push({x:s.x,y:s.y,z:m(1.45)});
    });
    const total=FASCINE_Y.length*TRIPS;
    return{engine:null,soldiers,arrows:[],carried,flying,gate:{open:0,shake:0},
      fill:{span:HEAVY.tower,progress:landed/total},filled:landed/total};
  }

  const SCENES={ram,mantlet,ladder,tower,moat};
  function scene(kind,t,G=DEFAULT){
    const T=CYCLE[kind];return SCENES[kind](((t%T)+T)%T,{...DEFAULT,...G});
  }

  // ---------------------------------------------------------------- meshes
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function Mesh(){
    const me={pos:[],col:[],gi:[],groups:[],bias:[],outward:[]};
    me.group=c=>{me.groups.push(c);return me.groups.length-1};
    // Quad facing n (faces turned away from the camera are skipped by the painter).
    me.quad=(g,a,b,c,d,color,n)=>{
      if(dot(cross(sub(b,a),sub(c,a)),n)<0)[b,d]=[d,b];
      for(const tri of [[a,b,c],[a,c,d]]){
        for(const p of tri)me.pos.push(p[0],p[1],p[2]);
        me.col.push(color);me.gi.push(g);me.bias.push(0);me.outward.push(n);
      }
    };
    // Box [x0,x1]x[y0,y1]x[z0,z1] mapped through fn (rigid), one sorting group.
    me.box=(X,Y,Z,color,{fn=p=>p,top=color}={})=>{
      const c=[];for(const x of X)for(const y of Y)for(const z of Z)c.push(fn([x,y,z]));
      const mid=c.reduce((s,p)=>[s[0]+p[0]/8,s[1]+p[1]/8,s[2]+p[2]/8],[0,0,0]),g=me.group(mid);
      for(const [i,j,k,l,isTop] of [[0,2,6,4],[1,3,7,5,1],[0,1,5,4],[2,3,7,6],[0,1,3,2],[4,5,7,6]]){
        const fc=[c[i],c[j],c[k],c[l]].reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4,s[2]+p[2]/4],[0,0,0]);
        let n=cross(sub(c[j],c[i]),sub(c[l],c[i]));if(dot(n,sub(fc,mid))<0)n=n.map(v=>-v);
        me.quad(g,c[i],c[j],c[k],c[l],isTop?top:color,n);
      }
      return g;
    };
    return me;
  }
  // A brushwood bundle lying along a horizontal direction (angle a in the xy plane).
  function fascine(me,c,a=0,len=m(2),r=FASCINE_R){
    const ca=Math.cos(a),sa=Math.sin(a),N=6,g=me.group(c);
    const ring=s=>[...Array(N).keys()].map(k=>{const t=k/N*Math.PI*2,u=Math.cos(t)*r,w=Math.sin(t)*r;
      return[c[0]+ca*s-sa*u,c[1]+sa*s+ca*u,c[2]+w]});
    const A=ring(-len/2),B=ring(len/2);
    for(let k=0;k<N;k++){
      const k1=(k+1)%N,t=(k+.5)/N*Math.PI*2;
      me.quad(g,A[k],A[k1],B[k1],B[k],'#8a6a3a',[-sa*Math.cos(t),ca*Math.cos(t),Math.sin(t)]);
    }
    for(const [R,s] of [[A,-1],[B,1]])for(let k=1;k<N-1;k++)me.quad(g,R[0],R[k],R[k+1],R[k+1],'#6b4f2a',[ca*s,sa*s,0]);
  }
  // Fascines on shoulders and in flight, arrows: small meshes for any renderer.
  function propsMesh(sc){
    const me=Mesh();
    for(const c of sc.carried||[])fascine(me,[c.x,c.y,c.z],.35,m(1.6),m(.22));
    for(const f of sc.flying||[])fascine(me,[f.x,f.y,f.z],Math.PI/2+(f.spin||0)*.3);
    for(const a of sc.arrows||[]){
      const d=sub(a.to,a.at),L=Math.hypot(...d)||1,u=d.map(v=>v/L*m(.8)),b=[a.at[0]-u[0],a.at[1]-u[1],a.at[2]-u[2]];
      me.box([0,1],[-.004,.004],[-.004,.004],'#3b2a1a',{fn:([s,y,z])=>[b[0]+u[0]*s,b[1]+u[1]*s+y,b[2]+u[2]*s+z]});
    }
    return me;
  }
  // The scene's own meshes (local frame): the engine and what the men carry. The wall,
  // gate and moat are the game's structures (see settlement-siege-preview.js).
  function meshes(sc,team){
    const out=[propsMesh(sc)];
    if(sc.engine)out.push(SE().triangles(sc.engine.name,{...sc.engine.place,team},sc.engine.state));
    return out;
  }
  window.ConquerSiegeAssault={DEFAULT,HEAVY,CYCLE,KINDS:Object.keys(SCENES),scene,meshes,propsMesh};
})();
