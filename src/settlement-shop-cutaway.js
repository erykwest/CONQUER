'use strict';
// CONQUER L3 workshop cutaway: a selected L3 house that runs an autonomous workshop
// (ConquerCommerce) opens its ground floor, like the church and inn (settlement-civic3d.js).
// The timbered upper floor, roofs and chimneys go; walls whose outside faces the camera, or that
// stand in front of the section plane through the room centre, are cut down to a low sill; the
// far walls stay up to the floor break and are seen from inside.
// The room is furnished by trade (Blender furniture and scatter pieces through
// ConquerCutawayFurniture.pieceFaces, plus a few procedural boxes) with a street counter on the
// half of the facade away from the door. While the artisan's routine keeps him at his own
// door during working hours, he is drawn inside at his bench instead.
// Every closed L3 workshop also shows its street front: a shop window on the counter half of the
// facade (shutters let down as counter and awning by day, shut at night) and a medieval bracket
// sign beside the door, its board perpendicular to the facade with the trade's emblem.
// Nothing is saved: the state follows the selection, the clock and the shop's day. The Asset Lab
// stages a house with shopKind (stand-in for the commerce record), shopClosed and shopCutaway.
(function(){
  const SILL=.14,FLOOR_Z=.03,GAP=.02;
  const STONE=['#625e59','#4f4b47'],FLOOR='#9b7a52',WOOD='#7a5a3c',WOOD_DARK='#5a4030',WOOD_LIGHT='#a98559';
  // Per trade: the tool of the work animation (settlement-work-anim.js) and the goods on the counter.
  const TRADES=Object.freeze({
    blacksmith:{tool:'hammer',goods:['#6f7377','#8c9094','#5e6266']},
    carpenter:{tool:'hammer',goods:['#a7814f','#8d6a3f','#b9925c']},
    leatherworker:{tool:'hammer',goods:['#7c4f2e','#94603a','#6a4126']},
    potter:{tool:'clay',goods:['#a85f3a','#b8734a','#93522f']},
    weaver:{tool:'shuttle',goods:['#5d7393','#a8503f','#c9a64e']},
    tailor:{tool:'needle',goods:['#8a4d63','#4f6d5a','#c2b089']},
    goldsmith:{tool:'hammer',goods:['#d9b44a','#e8cf7a','#bfc4c7']}
  });
  const CF=()=>window.ConquerCutawayFurniture;
  // Read straight from the economy save (asked per facade edge): ConquerCommerce.state() migrates
  // on every call, its daily tick keeps the records current.
  function shopOf(house){
    if(house?.shopKind)return{kind:house.shopKind,artisanId:house.id+':m:0',state:house.shopClosed?'closed':'working'};
    return window.ConquerEconomy?.state?.()?.commerce?.shops?.[house?.id]||null;
  }
  function eligible(house){
    return !!house&&house.type==='house'&&houseLevel(house)===3&&
      !(typeof underConstruction==='function'&&underConstruction(house))&&!!TRADES[shopOf(house)?.kind];
  }
  function active(house){return eligible(house)&&(house.id===State.selectedId||!!house.shopCutaway)}
  // Asked per figure by the occlusion test: one scan per selection / structure list, kept 250 ms
  // (a workshop opens or closes once a day).
  let memo={list:null,len:-1,sel:undefined,at:-1e9,houses:[]};
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  function activeHouses(){
    const list=State.structures||[],t=now();
    if(memo.list===list&&memo.len===list.length&&memo.sel===State.selectedId&&t-memo.at<250)return memo.houses;
    const houses=list.filter(s=>s.type==='house'&&(s.id===State.selectedId||s.shopCutaway)&&active(s));
    memo={list,len:list.length,sel:State.selectedId,at:t,houses};
    return houses;
  }
  function activeId(){return activeHouses().map(s=>s.id).join(',')||null}

  // ---------- room frame: local a along the facade, b from the street (-) into the house (+)
  // The parts both renderers draw (townhouse rows have their own, urbanDenseParts).
  function bodiesOf(house){
    const entry=typeof urbanHouseGeometry==='function'?urbanHouseGeometry().find(e=>e.house.id===house.id):null;
    return(entry?.parts||houseFootprintParts(house)).filter(p=>p.kind==='body');
  }
  function room(house){
    const bodies=bodiesOf(house);if(!bodies.length)return null;
    const door=houseDoorInfo(house),T=door.tangent,N={x:-door.normal.x,y:-door.normal.y};
    const inner={x:door.surface.x+N.x*.2,y:door.surface.y+N.y*.2};
    const poly=p=>p.basePoints||p.points;
    const main=bodies.find(p=>pointInPolygon(inner,poly(p)))||
      bodies.slice().sort((p,q)=>dist(p.center,inner)-dist(q.center,inner))[0];
    const c=main.center,loc=q=>({a:(q.x-c.x)*T.x+(q.y-c.y)*T.y,b:(q.x-c.x)*N.x+(q.y-c.y)*N.y});
    const pts=poly(main).map(loc),ha=Math.max(...pts.map(p=>Math.abs(p.a))),hb=Math.max(...pts.map(p=>Math.abs(p.b)));
    const bodyH=main.bodyH??houseBodyHeight(house);
    return{house,bodies,main,c,T,N,ha,hb,ground:terrainElevation(c),top:houseFloorBreak(bodyH),
      doorA:loc(door.surface).a,toWorld:(a,b)=>({x:c.x+T.x*a+N.x*b,y:c.y+T.y*a+N.y*b})};
  }

  // ---------- faces: {pts:[[x,y,z]...], hex} collected in groups {faces,bias}
  function group(out,bias=0){const g={faces:[],bias};out.push(g);return g}
  function quad(g,pts,hex){g.faces.push({pts,hex})}
  // Box in room coordinates, heights above the floor.
  function box(R,g,a0,b0,a1,b1,z0,z1,top,side=top){
    const z=R.ground+FLOOR_Z,c=[[a0,b0],[a1,b0],[a1,b1],[a0,b1]].map(([a,b])=>R.toWorld(a,b));
    quad(g,c.map(p=>[p.x,p.y,z+z1]),top);
    for(let i=0;i<4;i++){const p=c[i],q=c[(i+1)%4];quad(g,[[p.x,p.y,z+z0],[q.x,q.y,z+z0],[q.x,q.y,z+z1],[p.x,p.y,z+z1]],side)}
  }
  // A furniture piece at (a,b), its front (+x) turned to the room direction (fa,fb).
  function piece(R,out,name,a,b,fa,fb,{scale=1,lift=0}={}){
    const pf=CF()?.pieceFaces(name);if(!pf)return false;
    const wx=R.T.x*fa+R.N.x*fb,wy=R.T.y*fa+R.N.y*fb,L=Math.hypot(wx,wy)||1,ca=wx/L,sa=wy/L;
    const c=R.toWorld(a,b),z=R.ground+FLOOR_Z+lift,g=group(out);
    for(const f of pf.faces)quad(g,f.pts.map(([x,y,zl])=>[c.x+(x*ca-y*sa)*scale,c.y+(x*sa+y*ca)*scale,z+zl*scale]),f.hex);
    return true;
  }
  // Back against a wall ('back', 'left', 'right') at t in [-1,1] along it, front to the room.
  function onWall(R,out,name,wall,t,o={}){
    const pf=CF()?.pieceFaces(name);if(!pf)return false;
    const s=o.scale||1,along=wall==='back'?R.ha:R.hb,reach=Math.max(0,along-pf.w*s/2-.03)*t;
    const inset=(wall==='back'?R.hb:R.ha)-GAP+pf.back*s;
    if(wall==='back')return piece(R,out,name,reach,inset,0,-1,o);
    const side=wall==='left'?-1:1;
    return piece(R,out,name,side*inset,reach,-side,0,o);
  }

  // Parameter intervals of wall a->b not covered by the other polygons (tested just outside the
  // wall, so a wall on another body's outline counts as shared).
  function outsideStretches(a,b,nx,ny,others){
    const ts=[0,1],dx=b.x-a.x,dy=b.y-a.y;
    for(const Q of others)for(let i=0;i<Q.length;i++){
      const p=Q[i],q=Q[(i+1)%Q.length],ex=q.x-p.x,ey=q.y-p.y,den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-12)continue;
      const t=((p.x-a.x)*ey-(p.y-a.y)*ex)/den,u=((p.x-a.x)*dy-(p.y-a.y)*dx)/den;
      if(t>1e-6&&t<1-1e-6&&u>=-1e-6&&u<=1+1e-6)ts.push(t);
    }
    ts.sort((x,y)=>x-y);
    const out=[];
    for(let i=0;i<ts.length-1;i++){
      const t0=ts[i],t1=ts[i+1];if(t1-t0<1e-4)continue;
      const tm=(t0+t1)/2,m={x:a.x+dx*tm+nx*.03,y:a.y+dy*tm+ny*.03};
      if(others.some(Q=>pointInPolygon(m,Q)))continue;
      if(out.length&&Math.abs(out[out.length-1][1]-t0)<1e-9)out[out.length-1][1]=t1;else out.push([t0,t1]);
    }
    return out;
  }
  // ---------- shell: floors, far walls to the floor break, near walls to the sill
  function shell(R,out){
    const floor=group(out,-1e5),polys=R.bodies.map(p=>p.basePoints||p.points);
    for(const P of polys)quad(floor,P.map(p=>[p.x,p.y,R.ground+FLOOR_Z]),FLOOR);
    const plan=typeof isPlanView==='function'&&isPlanView(),d0=viewDepthPoint(R.c);
    R.bodies.forEach((part,k)=>{
      const P=polys[k],c=part.center;
      for(let i=0;i<P.length;i++){
        const a=P[i],b=P[(i+1)%P.length],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=-(b.y-a.y),ny=b.x-a.x;const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;
        if(nx*(m.x-c.x)+ny*(m.y-c.y)<0){nx=-nx;ny=-ny}
        // A wall whose outside faces the camera is cut to the sill; the others are cut where they
        // cross the section plane through the room centre (inner walls of an L / T wing, side walls).
        const facing=!plan&&viewDepthPoint({x:m.x+nx*.1,y:m.y+ny*.1})>viewDepthPoint(m);
        const da=viewDepthPoint(a)-d0-.05,db=viewDepthPoint(b)-d0-.05,cross=!plan&&da*db<0?da/(da-db):null;
        // Stretches inside another body of the house are inside partitions: the ground floor is one room.
        for(const [s0,s1] of outsideStretches(a,b,nx,ny,polys.filter((_,j)=>j!==k))){
          const cuts=cross!=null&&cross>s0&&cross<s1?[[s0,cross],[cross,s1]]:[[s0,s1]];
          for(const [t0,t1] of cuts){
            const tm=(t0+t1)/2,near=facing||!plan&&da+(db-da)*tm>0,h=near?SILL:R.top,z0=R.ground;
            const p={x:a.x+(b.x-a.x)*t0,y:a.y+(b.y-a.y)*t0},q={x:a.x+(b.x-a.x)*t1,y:a.y+(b.y-a.y)*t1};
            const raw=STONE[i%2],hex=typeof masonryMaterial==='function'&&masonryMaterial(R.house)==='brick'?raw:(window.ConquerStoneColor?.shade(raw)||raw);
            quad(group(out,near?0:-5e4),[[p.x,p.y,z0],[q.x,q.y,z0],[q.x,q.y,z0+h],[p.x,p.y,z0+h]],hex);
          }
        }
      }
    });
  }
  // Street counter on the half of the facade away from the door, with the trade's goods on it.
  function counter(R,out,goods){
    const side=R.doorA>=0?-1:1,len=Math.min(.6,R.ha-.12),a0=side*(R.ha-.06),a1=a0-side*len;
    const b0=-R.hb+.05,b1=b0+.15,g=group(out);
    box(R,g,Math.min(a0,a1),b0,Math.max(a0,a1),b1,0,.2,WOOD_LIGHT,WOOD_DARK);
    const n=Math.max(2,Math.floor(len/.13));
    for(let i=0;i<n;i++){
      const a=a1+side*(.07+i*(len-.12)/(n-1)),h=.035+.02*(i%2);
      box(R,group(out),a-.035,b0+.04,a+.035,b1-.04,.2,.2+h,goods[i%goods.length]);
    }
  }
  // ---------- layouts per trade: the station the artisan works at, his spot in front of it
  const LAYOUTS={
    blacksmith(R,out,d,s){
      onWall(R,out,'forge','back',d*.55,{scale:s*.85});
      const a=d*R.ha*.12,b=R.hb*.05;piece(R,out,'anvil',a,b,1,0,{scale:s});
      onWall(R,out,'toolRack','back',-d*.45);
      piece(R,out,'s:buckets',-d*R.ha*.72,R.hb*.35,0,-1,{scale:s*.8});
      return{a:a-d*.17,b:b-.02,at:{a,b}};
    },
    carpenter(R,out,d,s){
      const bench={a:-d*R.ha*.3,b:R.hb-.15};piece(R,out,'s:workbench',bench.a,bench.b,1,0,{scale:s*.9});
      piece(R,out,'s:sawhorse',d*R.ha*.45,R.hb*.05,1,0,{scale:s*.8});
      onWall(R,out,'toolRack','back',d*.6);
      piece(R,out,'s:plankStack',d*(R.ha-.12),-R.hb*.2,0,1,{scale:s*.6});
      return{a:bench.a,b:bench.b-.24,at:bench};
    },
    leatherworker(R,out,d,s){
      // Hide stretched on a frame against the back wall.
      const a=d*R.ha*.45,b=R.hb-.06,g=group(out),w=.2*s,h=.5*s;
      for(const k of [-1,1])box(R,g,a+k*w-.015,b-.015,a+k*w+.015,b+.015,0,h,WOOD_DARK);
      box(R,g,a-w-.02,b-.015,a+w+.02,b+.015,h-.03,h,WOOD_DARK);
      box(R,group(out),a-w+.02,b-.035,a+w-.02,b-.02,.12,h-.05,'#e0b98a','#d9ac78');
      const t={a:-d*R.ha*.2,b:R.hb*.15};piece(R,out,'tableSmall',t.a,t.b,0,-1,{scale:s});
      piece(R,out,'s:barrelGroup',-d*(R.ha-.18),R.hb-.16,0,-1,{scale:s*.7});
      return{a:t.a+d*.05,b:t.b-.18,at:t};
    },
    potter(R,out,d,s){
      // Kiln in the back corner, mouth to the room; wheel in the middle.
      const k={a:d*(R.ha-.19),b:R.hb-.19},g=group(out);
      box(R,g,k.a-.16*s,k.b-.16*s,k.a+.16*s,k.b+.16*s,0,.38*s,'#8f7a66','#7a6553');
      box(R,g,k.a-.18*s,k.b-.18*s,k.a+.18*s,k.b+.18*s,.38*s,.42*s,'#9b8774','#857160');
      box(R,group(out),k.a-.07,k.b-.17*s,k.a+.07,k.b-.16*s,.04,.16,'#2a211c');
      const w={a:-d*R.ha*.15,b:R.hb*.1},gw=group(out);
      box(R,gw,w.a-.05,w.b-.05,w.a+.05,w.b+.05,0,.13,WOOD_DARK,WOOD);
      box(R,gw,w.a-.1,w.b-.1,w.a+.1,w.b+.1,.13,.15,'#a5653f','#8c5233');
      box(R,gw,w.a-.04,w.b-.04,w.a+.04,w.b+.04,.15,.21,'#b9764d','#a5653f');
      onWall(R,out,'shelf','back',-d*.7);
      return{a:w.a,b:w.b-.17,at:w};
    },
    weaver(R,out,d,s){
      // Treadle loom: four posts, beams, the warp sloping from the back beam to the breast beam.
      const l={a:d*R.ha*.2,b:R.hb-.2},hw=.24*s,hd=.14*s,h=.44*s,g=group(out);
      for(const ka of [-1,1])for(const kb of [-1,1])box(R,g,l.a+ka*hw-.015,l.b+kb*hd-.015,l.a+ka*hw+.015,l.b+kb*hd+.015,0,h,WOOD_DARK);
      for(const kb of [-1,1])box(R,g,l.a-hw,l.b+kb*hd-.015,l.a+hw,l.b+kb*hd+.015,h-.03,h,WOOD);
      const z=R.ground+FLOOR_Z,P=(a,b,zz)=>{const p=R.toWorld(a,b);return[p.x,p.y,z+zz]};
      quad(group(out),[P(l.a-hw+.03,l.b+hd,h*.8),P(l.a+hw-.03,l.b+hd,h*.8),P(l.a+hw-.03,l.b-hd,h*.55),P(l.a-hw+.03,l.b-hd,h*.55)],'#d8cfae');
      piece(R,out,'stool',l.a,l.b-hd-.12,0,1,{scale:s});
      piece(R,out,'s:sackPile',-d*(R.ha-.2),R.hb-.16,0,-1,{scale:s*.7});
      return{a:l.a,b:l.b-hd-.12,at:l};
    },
    tailor(R,out,d,s){
      const t={a:d*R.ha*.3,b:R.hb-.14};
      onWall(R,out,'tableLong','back',d*.3,{scale:s});
      box(R,group(out),t.a-.18,t.b-.06,t.a+.12,t.b+.05,.225*s,.235*s,'#4f6d8a','#3f5970');
      onWall(R,out,'shelf','back',-d*.75);
      piece(R,out,'chest',-d*(R.ha-.12),R.hb*.1,d,0,{scale:s});
      return{a:t.a,b:t.b-.22,at:t};
    },
    goldsmith(R,out,d,s){
      const t={a:d*R.ha*.35,b:R.hb-.1};
      onWall(R,out,'writingDesk','back',d*.35,{scale:s});
      onWall(R,out,'strongChest','back',-d*.6,{scale:s});
      onWall(R,out,'candleStand','left',d>0?.5:-.5,{scale:s});
      piece(R,out,'scales',-d*R.ha*.15,-R.hb*.15,0,-1,{scale:s*.8});
      return{a:t.a,b:t.b-.22,at:t};
    }
  };
  // Station on the door half of the room: the counter takes the other half.
  function layout(R,out,kind){
    const d=R.doorA>=0?1:-1,s=Math.max(.7,Math.min(1,R.hb/.5));
    counter(R,out,TRADES[kind].goods);
    return LAYOUTS[kind](R,out,d,s);
  }

  // ---------- mesh (settlement-civic3d.js layout {pos,col,gi,groups,groupBias})
  function emit(groups){
    const pos=[],col=[],gi=[],centres=[],bias=[];
    for(const g of groups){
      if(!g.faces.length)continue;
      const k=centres.length,start=pos.length;
      for(const f of g.faces)for(let i=1;i<f.pts.length-1;i++){pos.push(...f.pts[0],...f.pts[i],...f.pts[i+1]);col.push(f.hex);gi.push(k)}
      let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
      for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
      centres.push([cx/n,cy/n,cz/n]);bias.push(g.bias);
    }
    return{pos,col,gi,groups:centres,groupBias:bias};
  }
  const cache=new Map();
  function build(house){
    const shop=shopOf(house),plan=typeof isPlanView==='function'&&isPlanView();
    const urban=typeof urbanRevision!=='undefined'?urbanRevision:0;
    const key=[house.id,house.x,house.y,house.angle||0,house.doorSide,shop?.kind,urban,State.view?.rotation||0,plan?1:0,State.stonePaletteId,State.visualPalette,!!CF()].join('|');
    const hit=cache.get(house.id);if(hit&&hit.key===key)return hit.res;
    const R=room(house);if(!R)return null;
    const out=[];shell(R,out);
    const spot=layout(R,out,shop.kind);
    const res={mesh:emit(out),room:R,spot,kind:shop.kind};
    cache.set(house.id,{key,res});
    return res;
  }

  // ---------- street front of a closed house: shop window and bracket sign
  // The shop window opens on the counter half of the facade: by day the lower shutter is let down
  // as a counter with the goods on it and the upper one propped up as an awning; at night, on
  // Sunday or without the artisan both are shut flat on the wall. The trade sign hangs from an
  // iron bracket on the upper floor beside the door, its board perpendicular to the facade.
  const OPENING={z0:.13,z1:.45},SIGN={z:.86,reach:.34,b0:.08,b1:.32,top:.8,bottom:.6,th:.024};
  const IRON='#2e2b28',BOARD='#6b4a2f',FIELD='#d8c49a';
  // Emblems on the board: convex polygons in (u from the wall outwards, v up), both in [0,1].
  const EMBLEMS={
    blacksmith:[['#4a4d50',[[.15,.62],[.85,.62],[.78,.52],[.22,.52]]],['#4a4d50',[[.4,.52],[.6,.52],[.6,.4],[.4,.4]]],['#4a4d50',[[.3,.4],[.7,.4],[.75,.3],[.25,.3]]]],
    carpenter:[['#8d9094',[[.15,.5],[.78,.62],[.78,.38]]],['#7a5233',[[.78,.64],[.9,.64],[.9,.36],[.78,.36]]]],
    leatherworker:[['#6e4226',[[.35,.75],[.55,.75],[.55,.4],[.35,.4]]],['#6e4226',[[.35,.4],[.8,.4],[.8,.28],[.35,.28]]]],
    potter:[['#a85f3a',[[.3,.55],[.7,.55],[.78,.42],[.65,.28],[.35,.28],[.22,.42]]],['#a85f3a',[[.4,.55],[.6,.55],[.58,.68],[.42,.68]]],['#8c4b2c',[[.36,.68],[.64,.68],[.64,.72],[.36,.72]]]],
    weaver:[['#9c7449',[[.15,.5],[.35,.58],[.65,.58],[.85,.5],[.65,.42],[.35,.42]]],['#4f6d8a',[[.42,.6],[.58,.6],[.58,.4],[.42,.4]]]],
    tailor:[['#6d7073',[[.2,.7],[.28,.74],[.7,.38],[.62,.34]]],['#6d7073',[[.8,.7],[.72,.74],[.3,.38],[.38,.34]]],['#6d7073',[[.22,.3],[.34,.3],[.34,.2],[.22,.2]]],['#6d7073',[[.66,.3],[.78,.3],[.78,.2],[.66,.2]]]],
    goldsmith:[['#d4a93c',[[.3,.72],[.7,.72],[.6,.52],[.4,.52]]],['#d4a93c',[[.47,.52],[.53,.52],[.53,.34],[.47,.34]]],['#d4a93c',[[.36,.34],[.64,.34],[.64,.28],[.36,.28]]]]
  };
  const daytime=()=>typeof solarIsNight==='function'?!solarIsNight():true;
  function frontOpen(house){const st=shopOf(house)?.state;return daytime()&&(st==='working'||st==='selling')}
  // Shop window across the counter half of the facade: centre a and half width.
  function opening(R){
    const side=R.doorA>=0?-1:1,hw=Math.min(.28,(R.ha-.16)/2);
    return{a:side*Math.max(hw+.06,R.ha*.5),hw};
  }
  function front(R,out,kind,open){
    const {a:a0,hw}=opening(R),b=-R.hb,z=R.ground,P=(a,bb,zz)=>{const p=R.toWorld(a,bb);return[p.x,p.y,z+zz]};
    // box() measures heights from the floor slab: these are relative to the street.
    const {z0,z1}=OPENING,frame=group(out),lift=-FLOOR_Z;
    for(const k of [-1,1])box(R,frame,a0+k*hw-.025,b-.02,a0+k*hw+.025,b,z0-.03+lift,z1+.03+lift,WOOD_DARK);
    box(R,frame,a0-hw-.025,b-.02,a0+hw+.025,b,z1+lift,z1+.03+lift,WOOD_DARK);
    if(!open){
      for(const k of [-1,1])box(R,group(out),Math.min(a0,a0+k*hw)+(k<0?0:.003),b-.022,Math.max(a0,a0+k*hw)-(k<0?.003:0),b-.004,z0+lift,z1+lift,WOOD,WOOD_DARK);
      return;
    }
    quad(group(out),[P(a0-hw,b-.003,z0),P(a0+hw,b-.003,z0),P(a0+hw,b-.003,z1),P(a0-hw,b-.003,z1)],'#2a211c');
    // Lower shutter let down on two brackets as the counter, the trade's goods on it.
    const top=.2+lift;
    box(R,group(out),a0-hw,b-.15,a0+hw,b,top-.025,top,WOOD_LIGHT,WOOD);
    for(const k of [-1,1])box(R,group(out),a0+k*(hw-.04)-.012,b-.1,a0+k*(hw-.04)+.012,b,top-.11,top-.025,WOOD_DARK);
    const goods=TRADES[kind].goods,n=Math.max(2,Math.floor(hw*2/.11));
    for(let i=0;i<n;i++){const a=a0-hw+.06+i*(hw*2-.12)/(n-1),h=.03+.018*(i%2);box(R,group(out),a-.03,b-.11,a+.03,b-.04,top,top+h,goods[i%goods.length])}
    // Upper shutter propped up as an awning, sloping down away from the wall.
    const aw=group(out),hi=z1+.02,lo=z1-.06,reach=-.17;
    quad(aw,[P(a0-hw-.02,b,hi),P(a0+hw+.02,b,hi),P(a0+hw+.02,b+reach,lo),P(a0-hw-.02,b+reach,lo)],WOOD);
    quad(aw,[P(a0-hw-.02,b+reach,lo),P(a0+hw+.02,b+reach,lo),P(a0+hw+.02,b+reach,lo-.022),P(a0-hw-.02,b+reach,lo-.022)],WOOD_DARK);
  }
  // Bracket sign on the upper floor, on the outer side of the door (away from the shop window).
  function signPlace(R){
    const s=R.doorA>=0?1:-1,a=Math.max(-R.ha+.05,Math.min(R.ha-.05,R.doorA+s*.12));
    return{a,wall:-R.hb-(typeof houseJetty==='function'?houseJetty(R.house):.07)};
  }
  function sign(R,out,kind){
    const {a,wall}=signPlace(R),z=R.ground,S=SIGN,P=(aa,bb,zz)=>{const p=R.toWorld(aa,bb);return[p.x,p.y,z+zz]},lift=-FLOOR_Z;
    const iron=group(out);
    box(R,iron,a-.01,wall-S.reach,a+.01,wall,S.z+lift,S.z+.016+lift,IRON);
    // Diagonal stay from lower on the wall to two thirds of the arm.
    quad(iron,[P(a,wall,S.z-.16),P(a,wall,S.z-.13),P(a,wall-S.reach*.66,S.z),P(a,wall-S.reach*.66,S.z-.025)],IRON);
    box(R,iron,a-.02,wall-.012,a+.02,wall,S.z-.18+lift,S.z+.03+lift,IRON);
    for(const u of [S.b0+.02,S.b1-.02])box(R,iron,a-.004,wall-u-.004,a+.004,wall-u+.004,S.top+lift,S.z+lift,IRON);
    box(R,group(out),a-S.th/2,wall-S.b1,a+S.th/2,wall-S.b0,S.bottom+lift,S.top+lift,BOARD);
    // Painted field and emblem on both faces.
    for(const k of [-1,1]){
      const x=a+k*(S.th/2+.002),B=(u,v)=>P(x,wall-S.b0-u*(S.b1-S.b0),S.bottom+v*(S.top-S.bottom)),m=.06;
      quad(group(out),[B(m,m),B(1-m,m),B(1-m,1-m),B(m,1-m)],FIELD);
      const x2=a+k*(S.th/2+.004),E=(u,v)=>P(x2,wall-S.b0-u*(S.b1-S.b0),S.bottom+v*(S.top-S.bottom)),g=group(out);
      for(const [hex,pts] of EMBLEMS[kind])quad(g,pts.map(([u,v])=>E(u,v)),hex);
    }
  }
  const frontCache=new Map();
  function buildFront(house){
    const shop=shopOf(house);if(!eligible(house)||active(house))return null;
    const open=frontOpen(house),urban=typeof urbanRevision!=='undefined'?urbanRevision:0;
    const key=[house.id,house.x,house.y,house.angle||0,house.doorSide,shop.kind,open?1:0,urban].join('|');
    const hit=frontCache.get(house.id);if(hit&&hit.key===key)return hit.res;
    const R=room(house);if(!R)return null;
    const out=[];front(R,out,shop.kind,open);sign(R,out,shop.kind);
    const res={mesh:emit(out),room:R,open};
    frontCache.set(house.id,{key,res});
    return res;
  }
  // The street front is seen only when the street wall faces the camera (2.5D painter).
  function frontFacing(R){
    if(typeof isPlanView==='function'&&isPlanView())return true;
    const m=R.toWorld(0,-R.hb),o=R.toWorld(0,-R.hb-.1);
    return viewDepthPoint(o)>viewDepthPoint(m);
  }
  function drawFront2D(house){
    const r=buildFront(house);if(!r||!window.ConquerMesh3D||!frontFacing(r.room))return false;
    window.ConquerMesh3D.drawMeshes(ctx,[r.mesh],window.ConquerMesh3D.gameView());
    return true;
  }
  function addFront(m,house){
    const r=buildFront(house);if(!r)return false;
    const mesh=r.mesh,p=mesh.pos;
    for(let t=0;t<mesh.col.length;t++){
      const o=t*9;
      m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
    }
    return true;
  }
  // houseFacadePlan: the ground-floor window where the shop window opens is not painted.
  function facadeCut(house,part,edge,windows){
    if(!eligible(house)||active(house))return windows;
    const R=room(house);if(!R||part.center!==R.main.center&&dist(part.center,R.main.center)>1e-6)return windows;
    const L=dist(edge.a,edge.b)||1,ux=(edge.b.x-edge.a.x)/L,uy=(edge.b.y-edge.a.y)/L;
    if(Math.abs(ux*R.N.x+uy*R.N.y)>.2)return windows;
    const m={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},mb=(m.x-R.c.x)*R.N.x+(m.y-R.c.y)*R.N.y;
    if(mb>0)return windows;   // the back wall
    const {a:a0,hw}=opening(R),fb=R.top,ww=typeof HOUSE_WINDOW_HALF_W!=='undefined'?HOUSE_WINDOW_HALF_W:.0875;
    return windows.filter(w=>{
      if(w.z>=fb)return true;
      const p={x:m.x+ux*w.off,y:m.y+uy*w.off},a=(p.x-R.c.x)*R.T.x+(p.y-R.c.y)*R.T.y;
      return Math.abs(a-a0)>hw+ww+.03;
    });
  }
  // Which fronts are open: the scene caches rebuild when this changes (dawn, dusk, the shop's day).
  function frontSig(){
    const shops=window.ConquerEconomy?.state?.()?.commerce?.shops;
    const day=daytime();
    let sig=day?'d':'n';
    if(shops)for(const [id,s] of Object.entries(shops))sig+='|'+id+':'+(day&&(s.state==='working'||s.state==='selling')?1:0)+':'+s.kind;
    return sig;
  }

  // ---------- renderers
  // 2.5D: called by drawHouse in place of the house body parts.
  function draw2D(house){
    const r=build(house);if(!r||!window.ConquerMesh3D)return false;
    window.ConquerMesh3D.drawMeshes(ctx,[r.mesh],window.ConquerMesh3D.gameView());
    if(house.shopCutaway)drawStagedArtisan(house,r);
    return true;
  }
  // WebGL: the open house goes in the rotation-dependent cutaway buffer of world3d.
  function addToBuilder(m){
    for(const house of activeHouses()){
      const r=build(house);if(!r)continue;
      const mesh=r.mesh,p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){
        const o=t*9;
        m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
      }
    }
  }

  // ---------- the artisan
  // Screen facing (1 right, -1 left) from the artisan's spot towards his station.
  function facing(r){
    const a=r.room.toWorld(r.spot.a,r.spot.b),b=r.room.toWorld(r.spot.at.a,r.spot.at.b);
    return w2s(b,0).x>=w2s(a,0).x?1:-1;
  }
  function spotOf(house){
    const r=build(house);if(!r)return null;
    return{p:r.room.toWorld(r.spot.a,r.spot.b),tool:TRADES[r.kind].tool,facing:facing(r)};
  }
  // The shop's artisan waiting at his own door (artisanPosition: an L3 shop operates at home)
  // stands at his bench while the house is open. Elsewhere (market, leisure) he stays where he is.
  function artisanAt(house,resident,p){
    if(!p||!active(house))return null;
    const shop=shopOf(house);
    if(shop.artisanId!==resident.id||shop.state==='vacant'||shop.state==='closed')return null;
    if(dist(p,houseDoorInfo(house).outside)>.42)return null;
    return spotOf(house);
  }
  // Asset Lab only: the stage has no population pass, so the open house shows its artisan itself.
  function drawStagedArtisan(house,r){
    const p=r.room.toWorld(r.spot.a,r.spot.b),tool=TRADES[r.kind].tool;
    const dot={p,id:house.id+':m:0',kind:'artisan',sex:'male',age:'adult',hair:'brown',colors:['#7a6a4f','#5f6e7c']};
    const W=window.ConquerWorkAnim;
    if(tool&&W)W.drawWorkerUnmasked(dot,tool,0,facing(r));
    else if(typeof drawVillagerFigureUnmasked==='function')drawVillagerFigureUnmasked(dot);
  }
  window.ConquerShopCutaway=Object.freeze({TRADES,LAYOUTS,EMBLEMS,shopOf,eligible,active,activeId,room,build,draw2D,addToBuilder,artisanAt,spotOf,
    frontOpen,opening,signPlace,buildFront,drawFront2D,addFront,facadeCut,frontSig,
    clear:()=>{cache.clear();frontCache.clear()}});
})();
