'use strict';
// Lightweight navigation overlay. Uses the same plan-view world coordinates and
// quarter-turn projection as the main editor, without a second scene renderer.
window.ConquerMinimap=(()=>{
  const root=document.getElementById('conquerMinimap');
  const mini=document.getElementById('conquerMinimapCanvas');
  const toggle=document.getElementById('conquerMinimapToggle');
  if(!root||!mini||!toggle)return{requestDraw(){}};
  const g=mini.getContext('2d');
  if(!g)return{requestDraw(){}};
  const preferenceKey='conquer.minimap.collapsed.v1';
  let pending=false,lastPaint=0,dragging=false,dragPointer=null,dragFrame=0,drawSize=190;
  const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const toMap=p=>{
    const q=rotateViewPoint(p);
    return{x:q.x/WORLD*drawSize,y:q.y/WORLD*drawSize};
  };
  const poly=(points,close=true)=>{
    if(!Array.isArray(points)||points.length<2)return false;
    let begun=false;
    g.beginPath();
    for(const p of points){
      if(!valid(p))continue;
      const q=toMap(p);
      if(!begun){g.moveTo(q.x,q.y);begun=true}else g.lineTo(q.x,q.y);
    }
    if(begun&&close)g.closePath();
    return begun;
  };
  function fillPoly(points,color,edge=null){
    if(!poly(points))return;
    g.fillStyle=color;g.fill();
    if(edge){g.strokeStyle=edge;g.lineWidth=.65;g.stroke()}
  }
  function segment(a,b,color,width){
    if(!valid(a)||!valid(b))return;
    const p=toMap(a),q=toMap(b);
    g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);
    g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.stroke();
  }
  function dot(p,r,color,outline=null){
    if(!valid(p))return;
    const q=toMap(p);
    g.beginPath();g.arc(q.x,q.y,r,0,Math.PI*2);
    g.fillStyle=color;g.fill();
    if(outline){g.strokeStyle=outline;g.lineWidth=1;g.stroke()}
  }
  function oval(f){
    if(!Number.isFinite(f.x)||!Number.isFinite(f.y))return[];
    const rx=Number(f.rx)||Number(f.radius)||2,ry=Number(f.ry)||rx;
    const a=Number(f.angle)||0,c=Math.cos(a),s=Math.sin(a);
    return Array.from({length:24},(_,i)=>{
      const t=i*Math.PI/12,x=Math.cos(t)*rx,y=Math.sin(t)*ry;
      return{x:f.x+x*c-y*s,y:f.y+x*s+y*c};
    });
  }
  function resizeMap(){
    const cssSize=mini.getBoundingClientRect().width||190;
    const d=Math.min(window.devicePixelRatio||1,2);
    const pixels=Math.max(1,Math.round(cssSize*d));
    if(mini.width!==pixels||mini.height!==pixels){mini.width=pixels;mini.height=pixels}
    drawSize=cssSize;
    g.setTransform(pixels/cssSize,0,0,pixels/cssSize,0,0);
    return cssSize;
  }
  function drawReliefMap(){
    const layers=State.relief?.hills||[];
    for(const hill of layers){
      for(const level of hill.levels||[]){
        if(level.top?.length>2)fillPoly(level.top,State.season==='winter'?'#cbd5cb':'#707d53');
      }
    }
  }
  function drawEnvironmentMap(){
    for(const f of State.environment||[]){
      if(!f)continue;
      if(f.type==='stream'||f.type==='river'){
        const points=f.points||[];
        const width=Math.max(1.3,(Number(f.width)||1)*drawSize/WORLD);
        for(let i=1;i<points.length;i++)segment(points[i-1],points[i],'#6495a7',width);
      }else if(f.type==='sea'||f.type==='pond'){
        fillPoly(f.points?.length>2?f.points:oval(f),'#476b77','#8eafb2');
      }else if(f.type==='forest'){
        fillPoly(f.points?.length>2?f.points:oval(f),State.season==='winter'?'#8b9c89':'#355e39');
      }else if(f.type==='mountain'){
        fillPoly(f.points?.length>2?f.points:oval(f),State.season==='winter'?'#a8afa6':'#726d5d');
      }else if(f.type==='hill'||f.type==='rough'){
        fillPoly(f.points?.length>2?f.points:oval(f),'#75825c');
      }
    }
  }
  function block(s){
    const glyph=window.ConquerLOD?.buildingGlyph(s);
    if(!glyph)return;
    const p=toMap(glyph),pxPerU=drawSize/WORLD;
    const w=Math.max(2.6,glyph.w*pxPerU),h=Math.max(2.6,glyph.h*pxPerU);
    g.save();g.translate(p.x,p.y);
    g.rotate((Number(s.angle)||0)+(State.view.rotation||0)*Math.PI/2);
    g.fillStyle=glyph.fill;g.strokeStyle=glyph.stroke;g.lineWidth=.7;
    g.fillRect(-w/2,-h/2,w,h);g.strokeRect(-w/2,-h/2,w,h);
    g.restore();
  }
  function drawMilitaryMap(){
    const contacts=window.ConquerCombat?.mapContacts?.()||[];
    for(const unit of contacts){
      if(!valid(unit))continue;
      const isEnemy=unit.side==='enemy';
      const color=isEnemy?'#e85d54':
        unit.kind==='knight'?'#ffd27a':
        unit.kind==='patrol'?'#a7dadd':'#a8d3fc';
      const radius=unit.kind==='squad'?3.25:unit.kind==='knight'?3:2.45;
      if(unit.selected)dot(unit,radius+2.2,'#f8df93','#22251c');
      dot(unit,radius,color,isEnemy?'#4d211e':'#233947');
    }
  }
  function footprint(s){
    try{return footprintPoints(s)}catch(_){return[]}
  }
  function drawStructuresMap(){
    const structures=State.structures||[];
    // Agricultural land below roads and buildings.
    for(const s of structures)if(s.type==='field'){
      g.globalAlpha=underConstruction(s)?.48:1;
      fillPoly(footprint(s),State.season==='winter'?'#b6c29f':'#9c9955');
    }
    g.globalAlpha=1;
    for(const s of structures)if(s.type==='road'&&valid(s.a)&&valid(s.b)){
      segment(s.a,s.b,'#b5a383',Math.max(.8,(Number(s.width)||.65)*drawSize/WORLD));
    }
    for(const s of structures){
      if(s.type==='road'||s.type==='field')continue;
      const opacity=underConstruction(s)?.5:1;
      g.globalAlpha=opacity;
      if(['wall','palisade','built','moat','bridge'].includes(s.type)&&valid(s.a)&&valid(s.b)){
        const color=s.type==='moat'?'#557986':s.type==='bridge'?'#c7b38d':s.type==='palisade'?'#8e754d':'#ded1ae';
        segment(s.a,s.b,color,Math.max(1.3,(Number(s.width)||.55)*drawSize/WORLD));
      }else if(s.type==='well'){
        dot(s,3.5,'#efc16a','#2c3328');
      }else{
        // Map LOD: one tiny semantic footprint per building, without expensive
        // multi-part roof/facade construction or 3D shader work.
        block(s);
      }
    }
    g.globalAlpha=1;
    const selected=structures.find(s=>s.id===State.selectedId);
    if(selected){
      const p=valid(selected)?selected:valid(selected.a)&&valid(selected.b)?
        {x:(selected.a.x+selected.b.x)/2,y:(selected.a.y+selected.b.y)/2}:null;
      if(p)dot(p,4,'#f8d17b','#482f20');
    }
  }
  function drawViewport(){
    const r=wrap.getBoundingClientRect();
    if(r.width<=0||r.height<=0)return;
    const points=[
      s2wAtElevation(0,0,0),s2wAtElevation(r.width,0,0),
      s2wAtElevation(r.width,r.height,0),s2wAtElevation(0,r.height,0)
    ];
    g.save();
    if(poly(points)){
      g.fillStyle='rgba(247,194,100,.09)';g.fill();
      g.strokeStyle='#ffd187';g.lineWidth=1.7;g.setLineDash([5,3]);g.stroke();
    }
    g.restore();
    const center=toMap(s2wAtElevation(r.width/2,r.height/2,0));
    g.strokeStyle='#fff0c8';g.lineWidth=1.1;
    g.beginPath();g.moveTo(center.x-3,center.y);g.lineTo(center.x+3,center.y);
    g.moveTo(center.x,center.y-3);g.lineTo(center.x,center.y+3);g.stroke();
  }
  function paint(){
    if(root.classList.contains('collapsed'))return;
    resizeMap();
    g.clearRect(0,0,drawSize,drawSize);
    g.fillStyle=State.season==='winter'?'#dce2dc':
      ({forest:'#33482e',mountains:'#646550',sea:'#536f75',hills:'#6c7950',valley:'#58714a',river:'#59744f'}[State.biome]||'#607448');
    g.fillRect(0,0,drawSize,drawSize);
    g.save();
    g.beginPath();g.rect(0,0,drawSize,drawSize);g.clip();
    drawReliefMap();drawEnvironmentMap();
    const b=[{x:BUILD_MIN,y:BUILD_MIN},{x:BUILD_MAX,y:BUILD_MIN},
      {x:BUILD_MAX,y:BUILD_MAX},{x:BUILD_MIN,y:BUILD_MAX}];
    if(poly(b)){
      g.fillStyle='rgba(238,201,137,.05)';g.fill();
      g.strokeStyle='rgba(248,224,173,.65)';g.lineWidth=.9;g.setLineDash([3,3]);g.stroke();g.setLineDash([]);
    }
    drawStructuresMap();
    drawMilitaryMap();
    drawViewport();
    g.restore();
  }
  function requestDraw(){
    if(root.classList.contains('collapsed')||pending)return;
    pending=true;
    const delay=Math.max(0,145-(performance.now()-lastPaint));
    setTimeout(()=>{
      pending=false;
      requestAnimationFrame(()=>{
        if(root.classList.contains('collapsed'))return;
        try{paint()}catch(e){console.warn('Minimap rendering skipped',e)}
        lastPaint=performance.now();
      });
    },delay);
  }
  function jump(clientX,clientY){
    const bounds=mini.getBoundingClientRect();
    const x=limit((clientX-bounds.left)/Math.max(1,bounds.width),0,1)*WORLD;
    const y=limit((clientY-bounds.top)/Math.max(1,bounds.height),0,1)*WORLD;
    const target=unrotateViewPoint({x,y});
    const p=w2sRaw(target,0),r=wrap.getBoundingClientRect();
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    State.view.x+=r.width/2-p.x;
    State.view.y+=r.height/2-p.y;
    invalidateSceneCache();
    draw();
  }
  function queueJump(e){
    dragPointer={x:e.clientX,y:e.clientY};
    if(dragFrame)return;
    dragFrame=requestAnimationFrame(()=>{
      dragFrame=0;
      const p=dragPointer;
      if(p)jump(p.x,p.y);
    });
  }
  mini.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    dragging=true;
    mini.setPointerCapture(e.pointerId);
    queueJump(e);
  });
  mini.addEventListener('pointermove',e=>{if(dragging)queueJump(e)});
  function finishDrag(e){
    if(!dragging)return;
    dragging=false;
    if(dragFrame){cancelAnimationFrame(dragFrame);dragFrame=0}
    if(dragPointer)jump(dragPointer.x,dragPointer.y);
    dragPointer=null;
    try{if(mini.hasPointerCapture(e.pointerId))mini.releasePointerCapture(e.pointerId)}catch(_){}
    scheduleLocalSave(500);
  }
  mini.addEventListener('pointerup',finishDrag);
  mini.addEventListener('pointercancel',finishDrag);
  toggle.addEventListener('click',()=>{
    const collapsed=root.classList.toggle('collapsed');
    toggle.textContent=collapsed?'▣':'−';
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.title=collapsed?'Apri minimappa':'Riduci minimappa';
    try{localStorage.setItem(preferenceKey,collapsed?'1':'0')}catch(_){}
    if(!collapsed)requestDraw();
  });
  try{
    if(localStorage.getItem(preferenceKey)==='1'){
      root.classList.add('collapsed');toggle.textContent='▣';
      toggle.title='Apri minimappa';toggle.setAttribute('aria-expanded','false');
    }
  }catch(_){}
  window.addEventListener('resize',requestDraw);
  requestDraw();
  return{requestDraw};
})();
