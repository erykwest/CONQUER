'use strict';
// CONQUER siege assault choreography: how the men work each engine against a low
// (H1) stone wall with a gate and a moat. Pure functions of time, in world units
// (U; 1 U = 3.5 m), attackers coming from -x towards the wall face at x = 0:
//   ram      pushed up the filled moat to the gate, swung by its crew until the
//            gate gives way
//   mantlet  pushed into bow range; the archers step out from behind it to shoot
//   ladder   carried to the wall, raised, climbed; the men step onto the wall walk
//   tower    pushed to the wall, bridge lowered into a crenel, the men cross onto
//            the walk
//   moat     men carry fascines and throw them in until the moat is filled
// High (H2) walls cannot be scaled (no ladder or tower reaches them), only battered.
// scene(kind,t) -> {engine:{name,place,state}|null, soldiers, arrows, gate, moat};
// meshes(scene) -> wall, moat and engine meshes for ConquerWagons3D.drawMeshes.
(function(){
  const SE=()=>window.ConquerSiegeEngines3D,MODEL=()=>window.ConquerSiegeModel;
  const m=v=>v/3.5;
  const clamp01=v=>Math.max(0,Math.min(1,v)),ease=k=>k*k*(3-2*k),lerp=(a,b,s)=>a+(b-a)*s;
  const seg=(t,a,b)=>clamp01((t-a)/(b-a));
  const WALL={face:0,inner:m(2.4),walk:m(3.4),top:m(4.2),half:m(7.2),gate:m(1.3),gateH:m(2.8),door:m(.3),
    merlons:[-6,-3.6,-1.2,1.2,3.6,6].map(m),merlonW:m(1.4),
    moat:[m(-4.2),m(-.8)],moatBottom:m(-1.4),water:m(-.5),fascineR:m(.35)};
  const CYCLE={ram:16,mantlet:14,ladder:18,tower:20,moat:17};
  const COLORS={stone:'#a8a194',walk:'#b9b2a4',merlon:'#9d968a',dark:'#2b2622',door:'#6f4a2b',band:'#55595d',
    water:'#3f6170',bank:'#5d4a33',fascine:'#8a6a3a',fascineEnd:'#6b4f2a'};

  // ---------------------------------------------------------------- choreography
  // Fascine slots: six across the causeway, two layers; filled = all twelve laid.
  const FASCINE_Y=[-2.5,-1.5,-.5,.5,1.5,2.5].map(m);
  const layerZ=n=>WALL.moatBottom+WALL.fascineR*(1+2*n);
  const fullMoat=()=>[0,1].flatMap(n=>FASCINE_Y.map(y=>({y,z:layerZ(n)})));
  const man=(p,type,id,extra={})=>({x:p.x,y:p.y,z:p.z||0,type,id,walk:false,carry:null,dir:1,aim:0,climb:0,...extra});

  function ram(t){
    const X0=m(-14),X1=m(-3.51),s=ease(seg(t,0,7)),x=lerp(X0,X1,s),place={x,y:0,heading:0};
    const STRIKES=4,P=SE().CYCLE.ram,bat=t>=7&&t<7+P*STRIKES;
    const state=bat?{mode:'fire',t:t-7,distance:x-X0}:{mode:t<7?'move':'idle',distance:x-X0};
    const a=bat?SE().pose('ram',state).ram:0;
    // The head meets the door at 72% of each swing; the last blow breaks it in.
    const impacts=[...Array(STRIKES).keys()].map(n=>7+P*(n+.72));
    let shake=0;
    for(const ti of impacts){const d=t-ti;if(d>=0&&d<.45)shake=Math.max(shake,(1-d/.45)*Math.abs(Math.cos(d*30)))}
    const open=ease(seg(t,impacts[STRIKES-1],impacts[STRIKES-1]+.8));
    // The crew haul on the log: they lean back with it and drive forward on the blow.
    const soldiers=SE().crew('ram',place,state).map((p,i)=>man({...p,x:p.x-a*m(.8)},'spearman','ram'+i,{walk:t<7}));
    return{engine:{name:'ram',place,state},soldiers,arrows:[],gate:{open,shake},moat:{fascines:fullMoat(),flying:[]},impact:impacts.some(ti=>t>=ti&&t<ti+.12)};
  }

  function mantlet(t){
    const X0=m(-16),X1=m(-8),s=ease(seg(t,0,6)),x=lerp(X0,X1,s),place={x,y:0,heading:0};
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
            const f=(ph-.9)/.7,ty=WALL.merlons[(n*5+i*2)%WALL.merlons.length]+m(.7);
            const at=g=>[lerp(p.x+m(.3),WALL.face+m(.05),g),lerp(y,ty,g),lerp(m(1.4),m(3.9),g)+Math.sin(Math.PI*g)*m(2)];
            const a=at(f),b=at(Math.min(1,f+.04));
            arrows.push({x:a[0],y:a[1],z:a[2],to:b});
          }
        }
      }
      soldiers.push(man({...p,y},archer?'archer':'spearman','mantlet'+i,{walk:t<6,aim}));
    });
    return{engine:{name:'mantlet',place,state},soldiers,arrows,gate:{open:0,shake:0},moat:{fascines:[],flying:[]}};
  }

  function ladder(t){
    const lean=SE().LADDER_LEAN,FOOT=m(-1.05),X0=m(-14),X1=FOOT-SE().LADDER_FOOT;
    const s=ease(seg(t,0,6)),x=lerp(X0,X1,s),place={x,y:0,heading:0};
    const state={mode:t<6?'move':'idle',distance:x-X0,up:seg(t,6,8)};
    const crew=SE().crew('ladder',place,state);
    // The two carriers and two men following them climb one after the other.
    const ground=[crew[0],crew[1],{x:x-m(3.4),y:m(.5)},{x:x-m(3.9),y:m(-.5)}];
    const queue=i=>({x:FOOT-m(.8)-i*m(.5),y:(i%2?-1:1)*m(.5)});
    const rise=WALL.walk/Math.cos(lean),sl=Math.sin(lean),cl=Math.cos(lean),off=m(.28);
    const onLadder=d=>({x:FOOT+d*sl-off*cl,y:0,z:d*cl+off*sl});
    const posts=[-2.4,2.4,-4.4,4.4].map(m);
    const soldiers=ground.map((g,i)=>{
      const start=8.4+i*1.8,c=t-start;
      let p={x:g.x,y:g.y,z:0},walk=t<6,climb=0,dir=1;
      if(i>=2&&t>=6){const q=queue(i),k=ease(seg(t,6,7.2));p={x:lerp(g.x,q.x,k),y:lerp(g.y,q.y,k),z:0};walk=k>0&&k<1}
      if(c>=0){
        const base=onLadder(0),top=onLadder(rise),onWalk={x:m(.9),y:0,z:WALL.walk},post={x:m(1.6),y:posts[i],z:WALL.walk};
        if(c<.35){const k=c/.35;p={x:lerp(p.x,base.x,k),y:lerp(p.y,0,k),z:0};walk=true}
        else if(c<2.6){p=onLadder(rise*(c-.35)/2.25);climb=1}
        else if(c<3.1){const k=ease((c-2.6)/.5);p={x:lerp(top.x,onWalk.x,k),y:0,z:lerp(top.z,onWalk.z,k)+Math.sin(Math.PI*k)*m(.25)};walk=true}
        else if(c<4.4){const k=ease((c-3.1)/1.3);p={x:lerp(onWalk.x,post.x,k),y:lerp(0,post.y,k),z:WALL.walk};walk=true}
        else{p=post;dir=-1}
      }
      return man(p,'spearman','ladder'+i,{walk,climb,dir});
    });
    return{engine:{name:'ladder',place,state},soldiers,arrows:[],gate:{open:0,shake:0},moat:{fascines:fullMoat(),flying:[]}};
  }

  function tower(t){
    const e=MODEL().engines.tower,pb=e.pivots.bridge,L=e.rig.bridgeLen;
    const drop=pb[2]-WALL.walk,reach=Math.sqrt(Math.max(0,L*L-drop*drop));
    const X0=m(-18),X1=m(.9)-pb[0]-reach,s=ease(seg(t,0,9)),x=lerp(X0,X1,s),place={x,y:0,heading:0};
    const state={mode:t<9?'move':'idle',distance:x-X0,bridge:seg(t,9,11)};
    const soldiers=SE().crew('tower',place,state).map((p,i)=>man(p,'spearman','pusher'+i,{walk:t<9}));
    // The assault party climbs inside, comes up on the platform and crosses.
    const deck=pb[2]+m(.07),root={x:x+pb[0],z:deck},tip={x:m(.9),z:WALL.walk};
    const posts=[-1.2,1.2,-2.6,2.6,-4].map(m);
    for(let i=0;i<5;i++){
      const c=t-(11.2+i*.9);if(c<0)continue;
      const from={x:x-m(.5),y:m(((i%3)-1)*.7),z:deck},post={x:m(1.6),y:posts[i],z:WALL.walk};
      let p,walk=true,dir=1;
      if(c<.4){const k=c/.4;p={x:lerp(from.x,root.x,k),y:lerp(from.y,0,k),z:deck}}
      else if(c<1.4){const k=(c-.4);p={x:lerp(root.x,tip.x,k),y:0,z:lerp(root.z,tip.z,k)}}
      else if(c<2.6){const k=ease((c-1.4)/1.2);p={x:lerp(tip.x,post.x,k),y:lerp(0,post.y,k),z:WALL.walk}}
      else{p=post;walk=false;dir=-1}
      soldiers.push(man(p,'spearman','assault'+i,{walk,dir}));
    }
    return{engine:{name:'tower',place,state},soldiers,arrows:[],gate:{open:0,shake:0},moat:{fascines:fullMoat(),flying:[]}};
  }

  // Fascine carriers: two trips each (bottom layer, then top layer flush with the
  // ground); a fascine is thrown from the bank and lands in its slot.
  function moat(t){
    const S=m(-13),E=m(-4.7),P=6.4,TRIPS=2,soldiers=[],fascines=[],flying=[];
    const mid=(WALL.moat[0]+WALL.moat[1])/2;
    FASCINE_Y.forEach((y,i)=>{
      const o=i*.8,tau=t-o;
      for(let n=0;n<TRIPS;n++)if(tau>=n*P+3.2)fascines.push({y,z:layerZ(n)});
      let x=S,walk=false,carry='fascine',dir=1;
      if(tau>=TRIPS*P){carry=null}
      else if(tau>=0){
        const n=Math.floor(tau/P),ph=tau-n*P;
        if(ph<2.6){x=lerp(S,E,ph/2.6);walk=true}
        else if(ph<3.2){
          x=E;
          if(ph>=2.8){
            carry=null;const f=(ph-2.8)/.4;
            flying.push({x:lerp(E+m(.4),mid,f),y,z:lerp(m(1.8),layerZ(n),f)+Math.sin(Math.PI*f)*m(.8)});
          }
        }
        else if(ph<5.8){x=lerp(E,S,(ph-3.2)/2.6);walk=true;carry=null;dir=-1}
        else carry=ph>6.1?'fascine':null;
      }
      soldiers.push(man({x,y:y+m(.35)},'spearman','fascine'+i,{walk,carry,dir}));
    });
    return{engine:null,soldiers,arrows:[],gate:{open:0,shake:0},moat:{fascines,flying},
      filled:fascines.length/(FASCINE_Y.length*TRIPS)};
  }

  const SCENES={ram,mantlet,ladder,tower,moat};
  function scene(kind,t){return SCENES[kind]((t%CYCLE[kind]+CYCLE[kind])%CYCLE[kind])}

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
  function wallMesh(gate={}){
    const W=WALL,me=Mesh(),X=[W.face,W.inner];
    // Body in 1.2 m bays (they sort locally against the men), the gate passage open.
    for(let y=-W.half;y<W.half-1e-6;y+=m(1.2)){
      const y1=Math.min(W.half,y+m(1.2));
      if(y1<=-W.gate||y>=W.gate)me.box(X,[y,y1],[0,W.walk],COLORS.stone,{top:COLORS.walk});
      else{
        if(y<-W.gate)me.box(X,[y,-W.gate],[0,W.walk],COLORS.stone,{top:COLORS.walk});
        if(y1>W.gate)me.box(X,[W.gate,y1],[0,W.walk],COLORS.stone,{top:COLORS.walk});
      }
    }
    me.box(X,[-W.gate,W.gate],[W.gateH,W.walk],COLORS.stone,{top:COLORS.walk});            // lintel
    me.box([W.inner-m(.05),W.inner],[-W.gate,W.gate],[0,W.gateH],COLORS.dark);               // dark passage
    for(const y of W.merlons)me.box([W.face,W.face+m(.5)],[y-W.merlonW/2,y+W.merlonW/2],[W.walk,W.top],COLORS.merlon);
    // Two door leaves hinged at the jambs: they shudder under the ram and swing in.
    const th=gate.open*1.45+gate.shake*.07,T=m(.15),cs=Math.cos(th),sn=Math.sin(th);
    for(const s of [-1,1]){
      const hinge=[W.door,-s*W.gate];
      const fn=([l,t,z])=>[hinge[0]+l*sn+t*cs,hinge[1]+s*l*cs-s*t*sn,z];
      me.box([0,W.gate-m(.02)],[0,T],[0,W.gateH-m(.02)],COLORS.door,{fn:([a,b,z])=>fn([a,b,z])});
      for(const z of [m(.6),m(2.1)])me.box([0,W.gate-m(.05)],[-m(.03),0],[z,z+m(.14)],COLORS.band,{fn:([a,b,c])=>fn([a,b,c])});
    }
    return me;
  }
  function prism(me,x0,x1,y,z,r,color,end){
    const g=me.group([(x0+x1)/2,y,z]),N=6,ring=x=>[...Array(N).keys()].map(k=>{const a=k/N*Math.PI*2;return[x,y+Math.cos(a)*r,z+Math.sin(a)*r]});
    const A=ring(x0),B=ring(x1);
    for(let k=0;k<N;k++){
      const k1=(k+1)%N,a=(k+.5)/N*Math.PI*2;
      me.quad(g,A[k],A[k1],B[k1],B[k],color,[0,Math.cos(a),Math.sin(a)]);
    }
    for(const [R,n] of [[A,[-1,0,0]],[B,[1,0,0]]])for(let k=1;k<N-1;k++){
      const a=R[0],b=R[k],c=R[k+1];
      const flip=dot(cross(sub(b,a),sub(c,a)),n)<0;
      me.pos.push(...a,...(flip?c:b),...(flip?b:c));me.col.push(end);me.gi.push(g);me.bias.push(0);me.outward.push(n);
    }
  }
  function moatMesh(moat={}){
    const W=WALL,me=Mesh(),[x0,x1]=W.moat,h=W.half,z=W.water;
    const g=me.group([(x0+x1)/2,0,W.moatBottom]);
    me.quad(g,[x0,-h,z],[x1,-h,z],[x1,h,z],[x0,h,z],COLORS.water,[0,0,1]);
    // Banks face into the moat: only those turned to the camera are drawn.
    me.quad(g,[x0,-h,z],[x0,h,z],[x0,h,0],[x0,-h,0],COLORS.bank,[1,0,0]);
    me.quad(g,[x1,-h,z],[x1,h,z],[x1,h,0],[x1,-h,0],COLORS.bank,[-1,0,0]);
    me.quad(g,[x0,-h,z],[x1,-h,z],[x1,-h,0],[x0,-h,0],COLORS.bank,[0,1,0]);
    me.quad(g,[x0,h,z],[x1,h,z],[x1,h,0],[x0,h,0],COLORS.bank,[0,-1,0]);
    const r=W.fascineR;
    for(const f of moat.fascines||[])prism(me,x0+m(.05),x1-m(.05),f.y,f.z,r,COLORS.fascine,COLORS.fascineEnd);
    for(const f of moat.flying||[])prism(me,f.x-m(1.5),f.x+m(1.5),f.y,f.z,r,COLORS.fascine,COLORS.fascineEnd);
    return me;
  }
  function meshes(sc,team){
    const out=[moatMesh(sc.moat),wallMesh(sc.gate)];
    if(sc.engine)out.push(SE().triangles(sc.engine.name,{...sc.engine.place,team},sc.engine.state));
    return out;
  }
  window.ConquerSiegeAssault={WALL,CYCLE,KINDS:Object.keys(SCENES),scene,meshes,wallMesh,moatMesh};
})();
