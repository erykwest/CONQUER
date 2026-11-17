'use strict';
// Preview-only primitive markers for CONQUER's regional 3D map. No gameplay
// entities or save data are created here; the demo symbols are explicitly labeled.
(function(root){
  const COLOR=Object.freeze({village:'#ed922d',castle:'#959b9e',port:'#8c633b',ship:'#805333'});
  const HERALDRY_DEFAULT=Object.freeze(['#b32628','#eac15b']); // heraldry-shapes.js
  const hex=c=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c);
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function color(c,factor=1){
    if(!hex(c))c='#888888';
    return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(c.slice(i,i+2),16)*factor)))
      .toString(16).padStart(2,'0')).join('');
  }
  const point=o=>{
    if(!o)return null;
    const p=o.point||o.position||o;
    const x=Number(p.x),y=Number(p.y);
    return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
  };
  const centroid=poly=>{
    if(!poly?.length)return null;
    const sum=poly.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0});
    return {x:sum.x/poly.length,y:sum.y/poly.length};
  };
  function normalized(raw){
    if(!raw||typeof raw!=='object')return null;
    const kind=String(raw.kind||raw.type||'').toLowerCase();
    if(!['village','castle','port','ship','troops'].includes(kind))return null;
    // A palisade is not a stone castle, even if the source calls it a fortification.
    if(kind==='castle' && (raw.palisade===true||raw.isPalisade===true||
      /palisad/i.test(String(raw.material||raw.wallType||raw.fortificationType||''))))return null;
    const p=point(raw);
    if(!p)return null;
    const arms=raw.heraldry||{};
    const pair=Array.isArray(raw.colors)?raw.colors:[arms.c1,arms.c2];
    if(kind==='troops' && !(hex(pair[0])&&hex(pair[1])))return null;
    const route=(Array.isArray(raw.route)?raw.route:[]).map(point).filter(Boolean);
    return {
      kind,x:p.x,y:p.y,z:finite(raw.z)?raw.z:kind==='ship'?-1.25:2,
      id:String(raw.id??''),ownerId:raw.ownerId||null,
      colors:kind==='troops'?[pair[0],pair[1]]:null,
      heading:finite(raw.heading)?raw.heading:0,
      route,progress:finite(raw.progress)?Math.max(0,Math.min(1,raw.progress)):null,
      periodMs:finite(raw.periodMs)&&raw.periodMs>500?raw.periodMs:14000,
      demo:!!raw.demo
    };
  }
  function normalize(raw){
    const list=Array.isArray(raw)?raw:Array.isArray(raw?.markers)?raw.markers:[];
    return list.map(normalized).filter(Boolean);
  }
  function demo(snapshot,scene){
    const cells=snapshot?.cells||[],terrain=snapshot?.terrain||{};
    const land=cells.filter(c=>!['sea','lake'].includes(terrain[c.macroId]));
    const sea=cells.filter(c=>terrain[c.macroId]==='sea'||terrain[c.macroId]==='lake');
    const rank=items=>items.slice().sort((a,b)=>{
      const x=centroid(a.polygon),y=centroid(b.polygon);
      const dx=x.x-snapshot.width*.5,dy=x.y-snapshot.height*.5;
      const ex=y.x-snapshot.width*.5,ey=y.y-snapshot.height*.5;
      return dx*dx+dy*dy-ex*ex-ey*ey;
    });
    const near=rank(land),wet=rank(sea);
    const markers=[];
    const l0=near[0]&&centroid(near[0].polygon),l1=near[Math.min(4,near.length-1)]&&centroid(near[Math.min(4,near.length-1)].polygon);
    const l2=near[Math.min(9,near.length-1)]&&centroid(near[Math.min(9,near.length-1)].polygon);
    if(l0)markers.push({kind:'village',id:'example-village',...l0,demo:true});
    if(l1)markers.push({kind:'castle',id:'example-castle',...l1,demo:true});
    if(l2)markers.push({kind:'troops',id:'example-troops',...l2,colors:[...HERALDRY_DEFAULT],demo:true,ownerId:'PLAYER_001'});
    const shoreline=(scene?.coastlines||[]).find(e=>e.macroIds?.length===2&&e.macroIds.some(id=>!['sea','lake'].includes(terrain[id])));
    if(shoreline){
      markers.push({kind:'port',id:'example-port',
        x:(shoreline.start.x+shoreline.end.x)/2,y:(shoreline.start.y+shoreline.end.y)/2,
        heading:Math.atan2(shoreline.end.y-shoreline.start.y,shoreline.end.x-shoreline.start.x),
        demo:true});
    } else if(wet[0]){
      const p=centroid(wet[0].polygon);
      if(p)markers.push({kind:'port',id:'example-port',...p,demo:true});
    }
    if(wet.length){
      const a=centroid(wet[0].polygon);
      const b=centroid(wet[Math.min(5,wet.length-1)].polygon);
      const delta=b&&Math.hypot(a.x-b.x,a.y-b.y)>1?b:{x:a.x+Math.min(35,snapshot.width*.03),y:a.y};
      markers.push({kind:'ship',id:'example-ship',...a,route:[a,delta],periodMs:14000,demo:true});
    }
    return normalize(markers);
  }
  function positionAt(marker,ms){
    let p=marker.progress;
    if(marker.kind!=='ship'||!marker.route.length)
      return {x:marker.x,y:marker.y,heading:marker.heading};
    if(marker.demo){
      const elapsed=((ms%marker.periodMs)+marker.periodMs)%marker.periodMs;
      const phase=elapsed/marker.periodMs*2;
      p=phase<=1?phase:2-phase;
    }
    if(p===null)return {x:marker.x,y:marker.y,heading:marker.heading};
    const route=marker.route,segments=[],lengths=[];let total=0;
    for(let i=1;i<route.length;i++){
      const length=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);
      segments.push([route[i-1],route[i]]);lengths.push(length);total+=length;
    }
    if(total<=0)return {x:marker.x,y:marker.y,heading:marker.heading};
    let remaining=p*total;
    for(let i=0;i<segments.length;i++){
      const [a,b]=segments[i],length=lengths[i];
      if(remaining<=length||i===segments.length-1){
        const f=length>0?Math.max(0,Math.min(1,remaining/length)):0;
        const heading=Math.atan2(b.y-a.y,b.x-a.x)+(marker.demo&&(ms%marker.periodMs)/marker.periodMs>.5?Math.PI:0);
        return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,heading};
      }
      remaining-=length;
    }
    return {x:marker.x,y:marker.y,heading:marker.heading};
  }
  const polygon=(ctx,ps,fill,stroke)=>{
    if(!ps.length)return;
    ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);
    for(let i=1;i<ps.length;i++)ctx.lineTo(ps[i].x,ps[i].y);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}
  };
  function box(ctx,project,m,halfX,halfY,height,paint,angle=0){
    const local=[[-halfX,-halfY],[halfX,-halfY],[halfX,halfY],[-halfX,halfY]];
    const cos=Math.cos(angle),sin=Math.sin(angle);
    const vertex=(v,z)=>project({x:m.x+v[0]*cos-v[1]*sin,
      y:m.y+v[0]*sin+v[1]*cos,z});
    const z=m.z??2;
    const points=local.map(v=>vertex(v,z)).concat(local.map(v=>vertex(v,z+height)));
    const faces=[
      {ids:[0,1,5,4],factor:.77},{ids:[1,2,6,5],factor:.90},
      {ids:[2,3,7,6],factor:.69},{ids:[3,0,4,7],factor:.85},
      {ids:[4,5,6,7],factor:1.15}
    ].map(f=>({...f,depth:f.ids.reduce((a,i)=>a+points[i].depth,0)/f.ids.length}));
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces)polygon(ctx,f.ids.map(i=>points[i]),color(paint,f.factor),'rgba(24,22,17,.35)');
  }
  function cylinder(ctx,project,m,r,height,paint){
    const n=12,base=[],top=[];
    for(let i=0;i<n;i++){
      const theta=i*Math.PI*2/n;
      const x=m.x+Math.cos(theta)*r,y=m.y+Math.sin(theta)*r;
      base.push(project({x,y,z:m.z}));
      top.push(project({x,y,z:m.z+height}));
    }
    const faces=[];
    for(let i=0;i<n;i++){
      const j=(i+1)%n,ids=[base[i],base[j],top[j],top[i]];
      faces.push({ps:ids,depth:ids.reduce((a,p)=>a+p.depth,0)/4,
        fill:color(paint,.75+.22*Math.cos(i*Math.PI*2/n))});
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const f of faces)polygon(ctx,f.ps,f.fill,null);
    polygon(ctx,top,color(paint,1.12),'rgba(15,15,15,.35)');
  }
  function paint(ctx,markers,project,camera,ms){
    if(!ctx||!camera||!markers?.length)return;
    const scale=Math.max(.001,camera.scale);
    const drawn=[];
    for(const original of markers){
      const moved=positionAt(original,ms);
      const marker={...original,...moved};
      const projected=project({x:marker.x,y:marker.y,z:marker.z+6/scale});
      if(projected.x<-45||projected.y<-45||
         projected.x>camera.width+45||projected.y>camera.height+45)continue;
      drawn.push({marker,depth:projected.depth});
    }
    drawn.sort((a,b)=>a.depth-b.depth);
    for(const {marker:m}of drawn){
      const r=5/scale;
      if(m.kind==='village')box(ctx,project,m,r,r,r*1.8,COLOR.village);
      else if(m.kind==='castle')box(ctx,project,m,r*1.1,r*1.1,r*2,COLOR.castle);
      else if(m.kind==='port')box(ctx,project,m,r*2.3,r*.42,r*.32,COLOR.port,m.heading);
      else if(m.kind==='ship')box(ctx,project,m,r*2.1,r*.7,r*.42,COLOR.ship,m.heading);
      else if(m.kind==='troops'){
        cylinder(ctx,project,{...m,z:m.z},r*.92,r*1.6,m.colors[0]);
        cylinder(ctx,project,{...m,z:m.z+r*1.6},r*.92,r*1.6,m.colors[1]);
      }
    }
  }
  const counts=markers=>Object.fromEntries(['village','castle','port','ship','troops']
    .map(kind=>[kind,(markers||[]).filter(m=>m.kind===kind).length]));
  const api=Object.freeze({normalize,demo,positionAt,paint,counts,HERALDRY_DEFAULT});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerRegionalPlaceholders=api;
})(typeof window==='object'?window:{});
