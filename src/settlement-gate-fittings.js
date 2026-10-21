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
  // The portal decal (gate_portal.png, 256 px tile) and the opening carved behind it share one
  // outline: straight jambs at x 64..192 below y=122, then a pointed arch (two arcs centred on
  // the opposite springs) up to the apex at y=44.
  const PORTAL={width:1.2,height:1.5,base:-.06,centerZ:-.06+1.5/2};
  const PX={size:256,half:64,spring:122,apex:44};
  let openingCache=null;
  function opening(){
    if(openingCache)return openingCache;
    const sx=PORTAL.width/PX.size,sz=PORTAL.height/PX.size,rise=PX.spring-PX.apex;
    const e=(rise*rise-PX.half*PX.half)/(2*PX.half),r=PX.half+e,phiMax=Math.acos(e/r);
    const spring=PORTAL.base+(PX.size-PX.spring)*sz,arc=[];
    for(let i=0;i<=8;i++){const phi=phiMax*i/8;arc.push({c:(r*Math.cos(phi)-e)*sx,z:spring+r*Math.sin(phi)*sz})}
    arc[8].c=0;
    openingCache={half:PX.half*sx,spring,apex:arc[8].z,arc};
    return openingCache;
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
    const o=opening(),f=frame(s),L2=f.L/2,W2=f.W/2,cap=o.apex;
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
  const broken=g=>window.ConquerSiege?.doorStage?.(g)==='broken';
  function doorTarget(g){return window.ConquerSiege?.gateClosed?.(g)?0:1}
  // A lowered portcullis (fully or partly) shuts the passage; the ram smashes it with the door.
  function portcullisBlocks(gate){
    const p=portcullis(gate);
    return !!p&&!underConstruction(gate)&&!broken(gate)&&(p.lowered||p.progress>.02);
  }
  function stateOfPortcullis(gate){
    const p=portcullis(gate);
    return !p?'none':p.progress>=.99?'lowered':p.progress<=.01?'raised':'moving';
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
    if(!p.lowered&&broken(gate)){status('The gate is broken in: the portcullis is wrecked');return false}
    p.lowered=!p.lowered;
    if(typeof invalidateNavigation==='function')invalidateNavigation(true);
    markDirty(true,false,true);renderFunctionPanel();draw();
    status(p.lowered?'Lowering the portcullis: nobody passes':'Raising the portcullis');
    return true;
  }
  function removePortcullis(gate){
    if(!portcullis(gate))return false;
    delete gate.portcullis;
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
      if(!stoneGate(g)||underConstruction(g))continue;
      const target=doorTarget(g);
      if(!Number.isFinite(g.doorOpen))g.doorOpen=target;
      else if(Math.abs(g.doorOpen-target)>.001){
        g.doorOpen=clamp01(g.doorOpen+Math.sign(target-g.doorOpen)*dt/DOOR_SECONDS);
        if(Math.abs(g.doorOpen-target)<.01)g.doorOpen=target;
        moving=true;
      }
      const p=portcullis(g);if(!p)continue;
      const down=p.lowered&&!broken(g)?1:0;
      if(Math.abs(p.progress-down)>.001){
        p.progress=clamp01(p.progress+Math.sign(down-p.progress)*dt/PORTCULLIS_SECONDS);
        if(Math.abs(p.progress-down)<.01)p.progress=down;
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
  function addLeaf(b,s,f,ground,side,theta,leafColor,bandColor){
    const o=opening(),hingeA=f.L/2-.22,T=.06,w=o.half-.012;
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
  function addPortcullis(b,f,ground,progress){
    const o=opening(),a0=f.L/2-.10,lift=(1-progress)*(o.apex+.04),iron='#34302d';
    const bar=(c0,c1,z0,z1)=>{
      const pts=[at(f,a0-.014,c0),at(f,a0+.014,c0),at(f,a0+.014,c1),at(f,a0-.014,c1)];
      b.slab(pts,(p,t)=>[p.x,p.y,ground+t],z0,z1,iron);
    };
    const span=o.half*2,count=Math.max(4,Math.round(span/.085));
    for(let i=0;i<=count;i++){
      const c=-o.half+.02+(span-.04)*i/count;
      bar(c-.013,c+.013,lift-.03,lift+o.apex);           // the spiked foot just below the rail
    }
    for(let z=.12;z<o.apex;z+=.17)bar(-o.half+.01,o.half-.01,lift+z,lift+z+.024);
  }
  // Torches on the outer facade, either side of the portal, below the banners.
  const TORCH={across:.565,z:.88};
  function addTorchBrackets(b,f,ground){
    for(const side of [-1,1]){
      const across=TORCH.across*side,wood='#5b4130',iron='#3b3532';
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
    if(!stoneGate(s)||underConstruction(s))return null;
    const p=portcullis(s),stage=window.ConquerSiege?.doorStage?.(s)||'intact';
    const door=Number.isFinite(s.doorOpen)?s.doorOpen:doorTarget(s),pc=p?p.progress:0;
    const settled=(door===0||door===1)&&(pc===0||pc===1);
    const key=[s.x,s.y,s.angle,s.size,s.w,s.h,groundOf(s),stage,door.toFixed(3),p?pc.toFixed(3):'-'].join('|');
    const hit=meshCache.get(s.id);if(hit&&hit.key===key)return hit.mesh;
    const f=frame(s),ground=groundOf(s),b=meshBuilder();
    if(stage!=='broken'){
      const theta=door*DOOR_OPEN,leaf=stage==='damaged'?'#5f4129':'#7a5233';
      for(const side of [-1,1])addLeaf(b,s,f,ground,side,theta,leaf,'#2f2b29');
      if(p)addPortcullis(b,f,ground,pc);     // raised, it sits hidden in the masonry above the vault
    }
    addTorchBrackets(b,f,ground);
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
        out.push({kind:'torch',id:s.id+':gate-torch:'+side,p:at(f,f.L/2+.055,TORCH.across*side),z:TORCH.z+.04,groundZ:groundOf(s)});
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
  // 3D facade decals for one gate: portal frames on both mouths, banners on the outer front.
  function decalSpecs(s){
    if(!stoneGate(s)||underConstruction(s))return[];
    const f=frame(s),out=[];
    const front={a:at(f,f.L/2,-f.W/2),b:at(f,f.L/2,f.W/2),normal:{x:f.ux,y:f.uy}};
    const rear={a:at(f,-f.L/2,f.W/2),b:at(f,-f.L/2,-f.W/2),normal:{x:-f.ux,y:-f.uy}};
    for(const edge of [front,rear])out.push({edge,key:'gatePortalFrame',centerZ:PORTAL.centerZ,width:PORTAL.width,height:PORTAL.height,offset:0});
    for(const side of [-1,1])out.push({edge:front,key:'gateBanner',centerZ:BANNER.top-BANNER.height/2,width:BANNER.width,height:BANNER.height,offset:BANNER.across*side});
    return out;
  }

  // ---------- 2.5D fallback ----------
  // The Canvas renderer keeps its solid gatehouse: an open gate shows the dark passage inside the
  // frame, a lowered portcullis its grid, and the visible outer front its banners.
  function drawCanvasPortal(s,edge){
    const o=opening(),stage=window.ConquerSiege?.doorStage?.(s)||'intact';
    const open=(Number.isFinite(s.doorOpen)?s.doorOpen:doorTarget(s))>.5||stage==='broken';
    const p=portcullis(s),pc=p?p.progress:0;
    if(!open&&!(pc>.01))return false;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
    const m={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},P=(c,z)=>w2s({x:m.x+ux*c,y:m.y+uy*c},z);
    const outline=[P(-o.half,0),...o.arc.map(q=>P(-q.c,q.z)),...o.arc.slice().reverse().map(q=>P(q.c,q.z)),P(o.half,0)];
    if(open){
      pathPolygon(outline,'#1b1714',null);
      drawArchitectureAssetOnEdge(edge,PORTAL.centerZ,PORTAL.width,PORTAL.height,'gatePortalFrame');
    }else drawArchitectureAssetOnEdge(edge,.705,.90,1.35,window.ConquerSiege?.doorAsset?.(s)||'gatePortal');
    if(pc>.01&&edge.role==='front'){
      ctx.save();ctx.beginPath();outline.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.clip();
      const top=o.apex,lift=(1-pc)*(top+.04);
      ctx.strokeStyle='#2e2a27';ctx.lineWidth=Math.max(1,1.6*State.view.scale);ctx.beginPath();
      for(let c=-o.half+.02;c<=o.half;c+=.085){const a=P(c,lift+top),b=P(c,lift-.03);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}
      for(let z=.12;z<top;z+=.17){const a=P(-o.half,lift+z),b=P(o.half,lift+z);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}
      ctx.stroke();ctx.restore();
    }
    return true;
  }
  function drawCanvasBanners(s,edge){
    if(edge.role!=='front')return;
    for(const side of [-1,1])drawArchitectureAssetOnEdge(edge,BANNER.top-BANNER.height/2,BANNER.width,BANNER.height,'gateBanner',BANNER.across*side);
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
    return'<div class="slot"><div class="slot-label">Grata (saracinesca) · accessorio del portone in pietra</div>'+
      (p?'<div class="grid"><button data-portcullis-toggle '+(building?'disabled':'')+'>'+(p.lowered?'⬆ Alza':'⬇ Abbassa')+
        '</button><button data-portcullis-remove>Rimuovi</button></div>'+
        '<div class="legend">Grata di ferro davanti alle ante · '+{none:'',raised:'alzata',lowered:'abbassata',moving:'in movimento'}[stateOfPortcullis(s)]+
        '. Abbassata chiude il passaggio a tutti, anche con il portone aperto.</div>'
      :'<button data-portcullis-install '+(building?'disabled':'')+'>Installa grata · '+costText(PORTCULLIS_COST)+'</button>'+
        '<div class="legend">Una saracinesca di ferro che scende davanti alle ante del portone.</div>')+'</div>';
  }
  function bindPanel(slots){
    const s=selectedStructure();if(!stoneGate(s))return;
    slots.querySelector('[data-portcullis-install]')?.addEventListener('click',()=>installPortcullis(s));
    slots.querySelector('[data-portcullis-toggle]')?.addEventListener('click',()=>togglePortcullis(s));
    slots.querySelector('[data-portcullis-remove]')?.addEventListener('click',()=>removePortcullis(s));
  }

  window.ConquerGates={opening,addGateBody,tick,dynamicMeshes,gateMesh,torchSources,ensureSprites,decalSpecs,
    portcullis,portcullisBlocks,stateOfPortcullis,installPortcullis,togglePortcullis,removePortcullis,
    panel,bindPanel,PORTCULLIS_COST,PORTAL,BANNER};
})();
