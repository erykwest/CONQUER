'use strict';
// Stone gate fittings: a real vaulted passage through the gatehouse (3D), two door leaves
// that swing inward when the gate opens or closes, an optional portcullis (an upgrade like
// the drawbridge) that drops in front of them, and on the outer facade two heraldic banners
// and two torches lit at night. Game rules: a lowered portcullis shuts the passage.
(function(){
  const PORTCULLIS_COST={gold:24,metal:16,wood:6};
  const DOOR_SECONDS=1.4,PORTCULLIS_SECONDS=2.2,DOOR_OPEN=88*Math.PI/180;
  const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
  const stoneGate=s=>s?.type==='gate'&&!isWoodGate(s);
  // Door leaves hang in every gate; the timber gate (settlement-wood3d.js) has a square-headed
  // mouth between its jambs instead of the pointed portal, and no portcullis, torches or banners.
  const doorGate=s=>s?.type==='gate';
  const WOOD_OPENING={half:.43,spring:1.18,apex:1.18,arc:[{c:.43,z:1.18},{c:0,z:1.18}]};   // up to the lintels
  // The portal decal (gate_portal.png, 256 px tile) and the opening carved behind it share one
  // outline: straight jambs at x 64..192 below y=122, then a pointed arch (two arcs centred on
  // the opposite springs) up to the apex at y=44.
  const PORTAL={width:1.2,height:1.5,base:-.06,centerZ:-.06+1.5/2};
  const PX={size:256,half:64,spring:122,apex:44};
  // The gatehouse front is 1.5U; a small gate (1U) gets a narrower, lower portal (at most .9 of
  // its front) and its torches and banners move in by the front's ratio (k).
  function portalOf(s){
    const W=s?rectDims(s).h:1.5,width=Math.min(PORTAL.width,W*.9),height=PORTAL.height*(1+width/PORTAL.width)/2;
    return{width,height,base:PORTAL.base,centerZ:PORTAL.base+height/2,k:W/1.5};
  }
  // The closed-door portal sprite (gate_portal.png): .90×1.35 on the gatehouse, scaled like the frame.
  function closedPortal(s){
    const r=portalOf(s).width/PORTAL.width,height=1.35*(1+r)/2;
    return{width:.9*r,height,centerZ:.03+height/2};
  }
  const openingCache=new Map();
  function opening(s){
    const P=portalOf(s),key=P.width.toFixed(3);
    if(openingCache.has(key))return openingCache.get(key);
    const sx=P.width/PX.size,sz=P.height/PX.size,rise=PX.spring-PX.apex;
    const e=(rise*rise-PX.half*PX.half)/(2*PX.half),r=PX.half+e,phiMax=Math.acos(e/r);
    const spring=P.base+(PX.size-PX.spring)*sz,arc=[];
    for(let i=0;i<=8;i++){const phi=phiMax*i/8;arc.push({c:(r*Math.cos(phi)-e)*sx,z:spring+r*Math.sin(phi)*sz})}
    arc[8].c=0;
    const o={half:PX.half*sx,spring,apex:arc[8].z,arc};openingCache.set(key,o);
    return o;
  }
  // Local gate frame: `along` follows the passage (+ is the outer front, the drawbridge side),
  // `across` spans the gate front.
  function frame(s){
    const d=rectDims(s),a=Number(s.angle)||0;
    return{x:s.x,y:s.y,L:d.w,W:d.h,ux:Math.cos(a),uy:Math.sin(a),vx:-Math.sin(a),vy:Math.cos(a)};
  }
  const at=(f,along,across)=>({x:f.x+f.ux*along+f.vx*across,y:f.y+f.uy*along+f.vy*across});
  const groundOf=s=>{const z=placementGroundZ(s);return Number.isFinite(z)?z:terrainElevation(s)};

  // ---------- castle body: piers, vault and paving instead of a solid block ----------
  // Called by settlement-castle3d bodyMesh inside the gate's ground plane; returns false when
  // the gate keeps the plain prism (wood gates, or a storey too short for the vault).
  function addGateBody(m,s,H,pal){
    if(!stoneGate(s))return false;
    const o=opening(s),f=frame(s),L2=f.L/2,W2=f.W/2,cap=o.apex;
    if(H<cap+.25||o.half>=W2-.1)return false;
    const P=(a,c)=>at(f,a,c);
    m.prism([P(-L2,-W2),P(L2,-W2),P(L2,W2),P(-L2,W2)],cap,H,pal);
    m.prism([P(-L2,o.half),P(L2,o.half),P(L2,W2),P(-L2,W2)],0,cap,pal);
    m.prism([P(-L2,-W2),P(L2,-W2),P(L2,-o.half),P(-L2,-o.half)],0,cap,pal);
    for(const side of [-1,1]){
      const arc=o.arc.map(q=>({c:q.c*side,z:q.z}));
      // Spandrels at both mouths: a fan from the jamb's top corner to the arch.
      for(const a of [-L2,L2]){
        const corner={p:P(a,o.half*side),z:cap};
        for(let i=0;i+1<arc.length;i++)m.face([corner,{p:P(a,arc[i].c),z:arc[i].z},{p:P(a,arc[i+1].c),z:arc[i+1].z}],pal);
      }
      for(let i=0;i+1<arc.length;i++)
        m.face([{p:P(-L2,arc[i].c),z:arc[i].z},{p:P(L2,arc[i].c),z:arc[i].z},{p:P(L2,arc[i+1].c),z:arc[i+1].z},{p:P(-L2,arc[i+1].c),z:arc[i+1].z}],pal);
    }
    m.face([{p:P(-L2,-o.half),z:.006},{p:P(L2,-o.half),z:.006},{p:P(L2,o.half),z:.006},{p:P(-L2,o.half),z:.006}],'#7c7166');
    return true;
  }

  // ---------- state ----------
  function portcullis(gate){return stoneGate(gate)&&gate.portcullis?.installed?gate.portcullis:null}
  function doorTarget(g){return window.ConquerSiege?.gateClosed?.(g)?0:1}
  // A lowered portcullis (fully or partly) shuts the passage, door or no door. It is a defence
  // layer of its own (settlement-siege 'portcullis' section): the ram must wreck it before it
  // can reach the door; wrecked, it hangs bent half-raised and bars nothing until repaired.
  const WRECKED_HANG=.25;
  const PORTCULLIS_REPAIR={gold:8,metal:10};
  function portcullisBlocks(gate){
    const p=portcullis(gate);
    return !!p&&!underConstruction(gate)&&!p.wrecked&&(p.lowered||p.progress>.02);
  }
  function stateOfPortcullis(gate){
    const p=portcullis(gate);
    return !p?'none':p.wrecked?'wrecked':p.progress>=.99?'lowered':p.progress<=.01?'raised':'moving';
  }
  function wreckPortcullis(gate){
    const p=portcullis(gate);if(!p||p.wrecked)return false;
    p.wrecked=true;p.lowered=false;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    markDirty(true,false,true);renderFunctionPanel();draw();
    status('The portcullis is wrecked: the door lies open to the ram');
    return true;
  }
  function repairPortcullis(gate){
    const p=portcullis(gate);if(!p?.wrecked||underConstruction(gate))return false;
    if(!canAfford(PORTCULLIS_REPAIR)){status('Insufficient resources · '+costText(PORTCULLIS_REPAIR));return false}
    spendCost(PORTCULLIS_REPAIR);
    p.wrecked=false;p.lowered=false;
    const hp=gate.siegeIntegrity?.portcullis;if(hp)hp.hp=hp.max;
    markDirty(true,false,true);renderFunctionPanel();draw();
    status('Portcullis repaired');
    return true;
  }
  function installPortcullis(gate){
    if(!stoneGate(gate)||underConstruction(gate)||portcullis(gate))return false;
    if(!canAfford(PORTCULLIS_COST)){status('Insufficient resources · '+costText(PORTCULLIS_COST));return false}
    spendCost(PORTCULLIS_COST);
    gate.portcullis={installed:true,lowered:false,progress:0};
    markDirty(false,false,true);renderFunctionPanel();draw();
    status('Portcullis installed in the gate');
    return true;
  }
  function togglePortcullis(gate){
    const p=portcullis(gate);if(!p||underConstruction(gate))return false;
    if(p.wrecked){status('The portcullis is wrecked: repair it first');return false}
    p.lowered=!p.lowered;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    markDirty(true,false,true);renderFunctionPanel();draw();
    status(p.lowered?'Lowering the portcullis: nobody passes':'Raising the portcullis');
    return true;
  }
  function removePortcullis(gate){
    if(!portcullis(gate))return false;
    delete gate.portcullis;delete gate.siegeIntegrity?.portcullis;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    markDirty(true,false,true);renderFunctionPanel();draw();
    status('Portcullis removed (no materials refunded)');return true;
  }
  // Doors and portcullis move in real time toward their state; a gate seen for the first time
  // (loaded save, new gate) starts settled.
  let lastTick=0,rafPending=0;
  function tick(){
    const now=performance.now(),dt=lastTick?Math.min(.08,(now-lastTick)/1000):0;lastTick=now;
    let moving=false;
    for(const g of State.structures){
      if(!doorGate(g)||underConstruction(g))continue;
      const target=doorTarget(g);
      if(!Number.isFinite(g.doorOpen))g.doorOpen=target;
      else if(Math.abs(g.doorOpen-target)>.001){
        const step=dt/DOOR_SECONDS,gap=target-g.doorOpen;
        g.doorOpen=Math.abs(gap)<=Math.max(step,.01)?target:clamp01(g.doorOpen+Math.sign(gap)*step);
        moving=true;
      }
      const p=portcullis(g);if(!p)continue;
      const down=p.wrecked?WRECKED_HANG:p.lowered?1:0;
      if(Math.abs(p.progress-down)>.001){
        const step=dt/PORTCULLIS_SECONDS,gap=down-p.progress;
        p.progress=Math.abs(gap)<=Math.max(step,.01)?down:clamp01(p.progress+Math.sign(gap)*step);
        moving=true;
      }
    }
    if(moving&&!rafPending)rafPending=requestAnimationFrame(()=>{rafPending=0;draw()});
    if(!moving)lastTick=0;
    return moving;
  }

  // ---------- 3D fittings: door leaves, portcullis, torch brackets ----------
  function meshBuilder(){
    const pos=[],col=[];
    const tri=(a,b,c,colr)=>{pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);col.push(colr)};
    // A flat outline (convex, in order) extruded between two offsets along a normal.
    const slab=(outline,toWorld,t0,t1,colr,edge=colr)=>{
      const a=outline.map(q=>toWorld(q,t0)),b=outline.map(q=>toWorld(q,t1)),n=outline.length;
      for(let i=1;i<n-1;i++){tri(a[0],a[i],a[i+1],colr);tri(b[0],b[i+1],b[i],colr)}
      for(let i=0;i<n;i++){const j=(i+1)%n;tri(a[i],a[j],b[j],edge);tri(a[i],b[j],b[i],edge)}
    };
    return{pos,col,tri,slab};
  }
  // Leaf hinged on the jamb at `side` (+1/-1 across), swung inward by theta. Outline coordinates:
  // u from the hinge toward the centre line, z up; t is the thickness, toward the outer front
  // when closed and toward the passage axis when open.
  function addLeaf(b,s,f,ground,side,theta,leafColor,bandColor,o=opening(s)){
    const hingeA=f.L/2-.22,T=.06,w=o.half-.012;
    const d={a:-Math.sin(theta),c:-side*Math.cos(theta)},n={a:Math.cos(theta),c:-side*Math.sin(theta)};
    const world=(u,z,t)=>{const p=at(f,hingeA+d.a*u+n.a*t,o.half*side+d.c*u+n.c*t);return[p.x,p.y,ground+z]};
    const top=o.arc.slice().reverse().map(q=>({u:Math.min(w,o.half-q.c),z:q.z-.015}));
    const outline=[{u:.008,z:.01},{u:w,z:.01},...top.filter(q=>q.u>.008)];
    outline.push({u:.008,z:o.spring-.015});
    b.slab(outline,(q,t)=>world(q.u,q.z,t),0,T,leafColor,'#5a3c25');
    for(const z of [.24,o.spring-.16]){
      const band=[{u:.02,z},{u:w-.03,z},{u:w-.03,z:z+.055},{u:.02,z:z+.055}];
      b.slab(band,(q,t)=>world(q.u,q.z,t),T,T+.014,bandColor);
    }
    // Ring handle near the meeting stiles.
    const ring=[{u:w-.09,z:.5},{u:w-.05,z:.5},{u:w-.05,z:.56},{u:w-.09,z:.56}];
    b.slab(ring,(q,t)=>world(q.u,q.z,t),T,T+.02,bandColor);
  }
  function addPortcullis(b,f,ground,progress,wrecked=false,o=opening()){
    const a0=f.L/2-.10,lift=(1-progress)*(o.apex+.04),iron=wrecked?'#2a2624':'#34302d';
    const bar=(c0,c1,z0,z1)=>{
      const pts=[at(f,a0-.014,c0),at(f,a0+.014,c0),at(f,a0+.014,c1),at(f,a0-.014,c1)];
      b.slab(pts,(p,t)=>[p.x,p.y,ground+t],z0,z1,iron);
    };
    const span=o.half*2,count=Math.max(4,Math.round(span/.085));
    for(let i=0;i<=count;i++){
      // Wrecked: some bars torn out, the others snapped off at uneven heights.
      if(wrecked&&i%3===1)continue;
      const c=-o.half+.02+(span-.04)*i/count,foot=wrecked?.08+((i*37)%5)*.06:-.03;
      bar(c-.013,c+.013,lift+foot,lift+o.apex);           // the spiked foot just below the rail
    }
    for(let z=wrecked?.29:.12;z<o.apex;z+=.17)bar(-o.half+.01,o.half-.01,lift+z,lift+z+.024);
  }
  // Torches on the outer facade, either side of the portal, below the banners.
  const TORCH={across:.565,z:.88};
  function addTorchBrackets(b,f,ground,k=1){
    for(const side of [-1,1]){
      const across=TORCH.across*k*side,wood='#5b4130',iron='#3b3532';
      // Wall plate, an angled haft and the iron cup the flame rises from.
      const box=(a0,a1,c0,c1,z0,z1,colr)=>{
        const pts=[at(f,a0,c0),at(f,a1,c0),at(f,a1,c1),at(f,a0,c1)];
        b.slab(pts,(p,t)=>[p.x,p.y,ground+t],z0,z1,colr);
      };
      box(f.L/2,f.L/2+.018,across-.03,across+.03,TORCH.z-.2,TORCH.z-.06,iron);
      for(let i=0;i<4;i++){const k=i/4;box(f.L/2+.01+k*.04,f.L/2+.03+k*.04,across-.016,across+.016,TORCH.z-.17+k*.15,TORCH.z-.13+k*.15,wood)}
      box(f.L/2+.03,f.L/2+.075,across-.024,across+.024,TORCH.z-.04,TORCH.z+.01,iron);
    }
  }
  const meshCache=new Map();
  function gateMesh(s){
    if(!doorGate(s)||underConstruction(s))return null;
    const wood=!stoneGate(s),p=portcullis(s),stage=window.ConquerSiege?.doorStage?.(s)||'intact';
    const door=Number.isFinite(s.doorOpen)?s.doorOpen:doorTarget(s),pc=p?p.progress:0;
    const pcRest=p?(p.wrecked?WRECKED_HANG:p.lowered?1:0):0;
    const settled=(door===0||door===1)&&pc===pcRest;
    const key=[s.x,s.y,s.angle,s.size,s.w,s.h,groundOf(s),stage,door.toFixed(3),p?pc.toFixed(3)+(p.wrecked?'w':''):'-'].join('|');
    const hit=meshCache.get(s.id);if(hit&&hit.key===key)return hit.mesh;
    const f=frame(s),ground=groundOf(s),b=meshBuilder();
    if(stage!=='broken'){
      const theta=door*DOOR_OPEN,leaf=stage==='damaged'?'#5f4129':'#7a5233';
      for(const side of [-1,1])addLeaf(b,s,f,ground,side,theta,leaf,'#2f2b29',wood?WOOD_OPENING:opening(s));
    }
    // Raised, it sits hidden in the masonry above the vault; it stands even with the door gone.
    if(p)addPortcullis(b,f,ground,pc,!!p.wrecked,opening(s));
    if(!wood)addTorchBrackets(b,f,ground,portalOf(s).k);
    const mesh={pos:b.pos,col:b.col,static:settled};
    meshCache.set(s.id,{key,mesh});
    return mesh;
  }
  function dynamicMeshes(){
    if(!window.ConquerWorld3D?.active?.())return[];
    const out=[];
    for(const s of State.structures){const m=gateMesh(s);if(m)out.push(m)}
    return out;
  }
  // Fire sources for the torch glow (settlement-world3d, camera independent) and the flames /
  // 2.5D brackets (settlement-castle-structures), which skip a facade turned away from the camera.
  function torchSources(visibleOnly=true){
    const out=[];
    for(const s of State.structures){
      if(!stoneGate(s)||underConstruction(s))continue;
      const f=frame(s);
      if(visibleOnly&&!(typeof isPlanView==='function'&&isPlanView())
        &&viewDepthPoint(at(f,f.L/2+.5,0))<viewDepthPoint({x:s.x,y:s.y}))continue;
      for(const side of [-1,1])
        out.push({kind:'torch',id:s.id+':gate-torch:'+side,p:at(f,f.L/2+.055,TORCH.across*portalOf(s).k*side),z:TORCH.z+.04,groundZ:groundOf(s)});
    }
    return out;
  }

  // ---------- facade sprites: the open portal frame and the heraldic banner ----------
  function portalFrameSprite(){
    const src=typeof architectureSprite==='function'?architectureSprite('gatePortal'):null;if(!src)return null;
    const c=document.createElement('canvas');c.width=src.width;c.height=src.height;
    const g=c.getContext('2d');g.drawImage(src,0,0,c.width,c.height);
    const k=c.width/PX.size,rise=PX.spring-PX.apex,e=(rise*rise-PX.half*PX.half)/(2*PX.half),r=PX.half+e,cx=c.width/2;
    g.globalCompositeOperation='destination-out';g.beginPath();
    g.moveTo((cx-PX.half*k),c.height);g.lineTo(cx-PX.half*k,PX.spring*k);
    const phiMax=Math.acos(e/r);
    for(let i=1;i<=12;i++){const phi=phiMax*i/12;g.lineTo(cx-(r*Math.cos(phi)-e)*k,(PX.spring-r*Math.sin(phi))*k)}
    for(let i=11;i>=0;i--){const phi=phiMax*i/12;g.lineTo(cx+(r*Math.cos(phi)-e)*k,(PX.spring-r*Math.sin(phi))*k)}
    g.lineTo(cx+PX.half*k,c.height);g.closePath();g.fill();
    return c;
  }
  function bannerSprite(){
    const W=64,H=256,c=document.createElement('canvas');c.width=W;c.height=H;
    const g=c.getContext('2d'),h=State.heraldry||{},c1=h.c1||'#8f2f2f',c2=h.c2||'#d9b54a';
    // Rod with finials, then the cloth ending in a swallowtail.
    g.fillStyle='#4a3424';g.fillRect(2,6,W-4,7);
    g.fillStyle='#c6a461';g.beginPath();g.arc(4,9.5,4,0,Math.PI*2);g.arc(W-4,9.5,4,0,Math.PI*2);g.fill();
    const cloth=new Path2D();
    cloth.moveTo(7,13);cloth.lineTo(W-7,13);cloth.lineTo(W-7,H-4);cloth.lineTo(W/2,H-42);cloth.lineTo(7,H-4);cloth.closePath();
    g.save();g.clip(cloth);
    g.fillStyle=c1;g.fillRect(0,0,W,H);
    g.fillStyle=c2;g.fillRect(7,13,W-14,10);g.fillRect(7,H-70,W-14,8);
    const art=document.createElement('canvas');art.width=320;art.height=200;
    const ok=window.__conquerHeraldryCanvas?.paint(art.getContext('2d'),0,0,320,200);
    if(ok)g.drawImage(art,60,0,200,200,10,48,W-20,W-20);
    else{g.fillStyle=c2;g.fillRect(W/2-3,40,6,100)}
    const shade=g.createLinearGradient(0,0,W,0);
    shade.addColorStop(0,'rgba(0,0,0,.28)');shade.addColorStop(.35,'rgba(0,0,0,0)');shade.addColorStop(.7,'rgba(255,255,255,.06)');shade.addColorStop(1,'rgba(0,0,0,.3)');
    g.fillStyle=shade;g.fillRect(0,0,W,H);
    g.restore();
    g.strokeStyle='rgba(30,20,14,.55)';g.lineWidth=1.5;g.stroke(cloth);
    return{canvas:c,ready:!!ok};
  }
  let spriteKey='';
  // Keeps architectureSprites.gatePortalFrame / gateBanner current; returns a key that changes
  // whenever they are redrawn (part of the 3D decal signature).
  function ensureSprites(){
    if(typeof architectureSprites==='undefined')return'';
    const h=State.heraldry||{},base=!!architectureSprite('gatePortal');
    const want=JSON.stringify([h.pattern,h.c1,h.c2,h.symbol,h.c3,h.c4])+'|'+base;
    if(want===spriteKey.split('#')[0]&&architectureSprites.gateBanner&&(!base||architectureSprites.gatePortalFrame))return spriteKey;
    if(base)architectureSprites.gatePortalFrame=portalFrameSprite();
    const banner=bannerSprite();architectureSprites.gateBanner=banner.canvas;
    // The coat of arms rasterises asynchronously: redraw once it is there.
    spriteKey=(banner.ready?want:'pending')+'#'+(banner.ready?'1':'0');
    return spriteKey;
  }
  const BANNER={across:.62,width:.235,top:2.06,height:.96};
  // Banners of one gate: moved in on a small gate, and kept below the crest of a low one.
  function bannerOf(s){
    const H=typeof structureHeight==='function'?structureHeight(s):Infinity;
    const k=portalOf(s).k,top=Math.min(BANNER.top,H-.15),height=Math.min(BANNER.height,top-1);
    return{across:BANNER.across*k,width:BANNER.width*k,top,height};
  }
  // 3D facade decals for one gate: portal frames on both mouths, banners on the outer front.
  function decalSpecs(s){
    if(!stoneGate(s)||underConstruction(s))return[];
    const f=frame(s),out=[];
    const front={a:at(f,f.L/2,-f.W/2),b:at(f,f.L/2,f.W/2),normal:{x:f.ux,y:f.uy}};
    const rear={a:at(f,-f.L/2,f.W/2),b:at(f,-f.L/2,-f.W/2),normal:{x:-f.ux,y:-f.uy}};
    const P=portalOf(s);
    for(const edge of [front,rear])out.push({edge,key:'gatePortalFrame',centerZ:P.centerZ,width:P.width,height:P.height,offset:0});
    const B=bannerOf(s);
    for(const side of [-1,1])out.push({edge:front,key:'gateBanner',centerZ:B.top-B.height/2,width:B.width,height:B.height,offset:B.across*side});
    return out;
  }

  // ---------- 2.5D fallback ----------
  // The Canvas renderer keeps its solid gatehouse: an open gate shows the dark passage inside the
  // frame, a lowered portcullis its grid, and the visible outer front its banners.
  function drawCanvasPortal(s,edge){
    const o=opening(s),P0=portalOf(s),stage=window.ConquerSiege?.doorStage?.(s)||'intact';
    const open=(Number.isFinite(s.doorOpen)?s.doorOpen:doorTarget(s))>.5||stage==='broken';
    const p=portcullis(s),pc=p?p.progress:0;
    if(!open&&!(pc>.01))return false;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
    const m={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},P=(c,z)=>w2s({x:m.x+ux*c,y:m.y+uy*c},z);
    const outline=[P(-o.half,0),...o.arc.map(q=>P(-q.c,q.z)),...o.arc.slice().reverse().map(q=>P(q.c,q.z)),P(o.half,0)];
    if(open){
      pathPolygon(outline,'#1b1714',null);
      drawArchitectureAssetOnEdge(edge,P0.centerZ,P0.width,P0.height,'gatePortalFrame');
    }else{const d=closedPortal(s);drawArchitectureAssetOnEdge(edge,d.centerZ,d.width,d.height,window.ConquerSiege?.doorAsset?.(s)||'gatePortal')}
    if(pc>.01&&edge.role==='front'){
      ctx.save();ctx.beginPath();outline.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.clip();
      const top=o.apex,lift=(1-pc)*(top+.04);
      // Lit iron over the dark passage (the 3D vault shows them against the masonry instead).
      ctx.beginPath();
      for(let c=-o.half+.02;c<=o.half;c+=.085){const a=P(c,lift+top),b=P(c,lift-.03);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}
      for(let z=.12;z<top;z+=.17){const a=P(-o.half,lift+z),b=P(o.half,lift+z);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}
      const w=Math.max(1,.026*U*State.view.scale);           // a .026 U iron bar
      ctx.strokeStyle='#1f1c1a';ctx.lineWidth=w+1.2;ctx.stroke();
      ctx.strokeStyle='#7a726a';ctx.lineWidth=w;ctx.stroke();ctx.restore();
    }
    return true;
  }
  function drawCanvasBanners(s,edge){
    if(edge.role!=='front')return;
    const B=bannerOf(s);
    for(const side of [-1,1])drawArchitectureAssetOnEdge(edge,B.top-B.height/2,B.width,B.height,'gateBanner',B.across*side);
  }
  window.addEventListener?.('DOMContentLoaded',()=>{
    if(typeof drawGatePortals!=='function')return;
    const previous=drawGatePortals;
    drawGatePortals=function(){
      ensureSprites();
      previous();
      for(const s of State.structures){
        if(!stoneGate(s)||underConstruction(s))continue;
        withStructureGroundPlane(s,()=>withStructureDetailOcclusion(s,BANNER.top,()=>{
          for(const edge of gateFacadeEdges(s)){
            if(edge.role==='front'||edge.role==='rear')drawCanvasPortal(s,edge);
            drawCanvasBanners(s,edge);
          }
        }));
      }
    };
  });

  // ---------- inspector ----------
  function panel(s){
    if(!stoneGate(s))return'';
    const p=portcullis(s),building=underConstruction(s);
    const hp=p&&!building?window.ConquerSiege?.integrity?.(s)?.portcullis:null;
    const label={none:'',raised:'alzata',lowered:'abbassata',moving:'in movimento',wrecked:'distrutta'}[stateOfPortcullis(s)];
    return'<div class="slot"><div class="slot-label">Grata (saracinesca) · '+(p?label+(hp?' · '+Math.ceil(hp.hp)+' / '+hp.max:''):'accessorio del portone in pietra')+'</div>'+
      (p?(p.wrecked
          ?'<div class="grid"><button data-portcullis-repair '+(building?'disabled':'')+'>Ripara · '+costText(PORTCULLIS_REPAIR)+'</button><button data-portcullis-remove>Rimuovi</button></div>'+
            '<div class="legend">Piegata e mezza alzata: non sbarra più nulla finché non è riparata.</div>'
          :'<div class="grid"><button data-portcullis-toggle '+(building?'disabled':'')+'>'+(p.lowered?'⬆ Alza':'⬇ Abbassa')+
            '</button><button data-portcullis-remove>Rimuovi</button></div>'+
            '<div class="legend">Strato difensivo davanti alle ante: abbassata chiude il passaggio a tutti, anche con il portone aperto o sfondato, e l\'ariete deve abbatterla prima di arrivare alla porta. Il fuoco la attraversa e raggiunge il legno.</div>')
      :'<button data-portcullis-install '+(building?'disabled':'')+'>Installa grata · '+costText(PORTCULLIS_COST)+'</button>'+
        '<div class="legend">Una saracinesca di ferro che scende davanti alle ante del portone.</div>')+'</div>';
  }
  function bindPanel(slots){
    const s=selectedStructure();if(!stoneGate(s))return;
    slots.querySelector('[data-portcullis-install]')?.addEventListener('click',()=>installPortcullis(s));
    slots.querySelector('[data-portcullis-toggle]')?.addEventListener('click',()=>togglePortcullis(s));
    slots.querySelector('[data-portcullis-remove]')?.addEventListener('click',()=>removePortcullis(s));
    slots.querySelector('[data-portcullis-repair]')?.addEventListener('click',()=>repairPortcullis(s));
  }

  window.ConquerGates={opening,portalOf,closedPortal,addGateBody,tick,dynamicMeshes,gateMesh,torchSources,ensureSprites,decalSpecs,
    portcullis,portcullisBlocks,stateOfPortcullis,installPortcullis,togglePortcullis,removePortcullis,
    wreckPortcullis,repairPortcullis,panel,bindPanel,PORTCULLIS_COST,PORTCULLIS_REPAIR,PORTAL,BANNER};
})();
