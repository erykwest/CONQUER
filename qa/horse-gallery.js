'use strict';
// In-game horse gallery (DEV/QA): every place the game draws a horse, side by side on the real
// game canvas with the real painters and the in-game size (State.view.scale*5.75).
// Usage in the browser console of index.html?world3d=1:  await ConquerHorseGallery.show({scale:3})
// Rows: livestock (walk/browse/idle, four coats) · mounted knight (idle/walk/run, left/right) ·
// messenger (walk/idle) · vehicles (cart, wagon, coach; World3D card and 2D) · joust/feast horse.
(function(){
  const COATS=['brown','black','grey','white'];
  const ROWS=[
    {label:'Bestiame (scuderie L3/L4)',y:0,items:[
      ...COATS.map((coat,i)=>({kind:'animal',coat,mode:'walk',x:i*2.6})),
      {kind:'animal',coat:'brown',mode:'browse',x:4*2.6},{kind:'animal',coat:'grey',mode:'idle',x:5*2.6},
      {kind:'animal',coat:'black',mode:'walk',x:6*2.6,facing:-1}]},
    {label:'Cavalieri (combattimento)',y:3.6,items:[
      {kind:'knight',mode:'idle',x:0},{kind:'knight',mode:'walk',x:3},{kind:'knight',mode:'run',x:6},
      {kind:'knight',mode:'walk',x:9,facing:-1,coat:'white'},{kind:'knight',mode:'idle',x:12,coat:'black',ready:1}]},
    {label:'Messaggero / staffetta',y:7.2,items:[
      {kind:'messenger',mode:'walk',x:0},{kind:'messenger',mode:'idle',x:3,coat:'grey'},{kind:'messenger',mode:'walk',x:6,facing:-1,coat:'black'}]},
    {label:'Veicoli (carta World3D)',y:10.4,items:[
      {kind:'vehicle',vehicle:'cart',x:0},{kind:'vehicle',vehicle:'wagon',x:4},{kind:'vehicle',vehicle:'coach',x:8.5}]},
    {label:'Veicoli (2D)',y:13.4,items:[
      {kind:'vehicle',vehicle:'cart',x:0,flat:true},{kind:'vehicle',vehicle:'wagon',x:4,flat:true},{kind:'vehicle',vehicle:'coach',x:8.5,flat:true}]}
  ];
  let origin={x:100,y:100},clock=0,installed=false,on=false,frozen=null;
  const size=()=>Math.max(1.5,State.view.scale*5.75);
  // Rows run along the screen: a world direction that maps to +x on screen at rotation 0.
  const along=(x,y)=>{const a=s2w0(),r=a.right,d=a.down;return{x:origin.x+r.x*x+d.x*y,y:origin.y+r.y*x+d.y*y}};
  function s2w0(){
    // World vectors for one screen-unit right and one down, from the current projection.
    const o=w2sRaw(origin,0),px=w2sRaw({x:origin.x+1,y:origin.y},0),py=w2sRaw({x:origin.x,y:origin.y+1},0);
    const ax=px.x-o.x,ay=px.y-o.y,bx=py.x-o.x,by=py.y-o.y,det=ax*by-bx*ay||1,k=U*State.view.scale;
    // Solve [ax bx; ay by] [u v]^T = screen vector (k,0) and (0,k).
    return{right:{x:k*by/det,y:-k*ay/det},down:{x:-k*bx/det,y:k*ax/det}};
  }
  function drawItem(it){
    const p=along(it.x,it.y),t=frozen??clock,facing=it.facing||1,s=w2s(p,.1);
    if(it.kind==='animal'){
      ConquerAnimals.drawAnimal('horse',ctx,s.x,s.y,size(),{t:t*34*.12,seed:3,coat:it.coat,facing,mode:it.mode,blend:it.mode==='browse'?.86:0});
    }else if(it.kind==='knight'||it.kind==='messenger'){
      ConquerMounted2D.draw(ctx,s.x,s.y,size(),{kind:it.kind,facing,mode:it.mode,from:it.mode,blend:1,t,seed:3,
        coat:it.coat||'brown',pose:{ready:it.ready||0},livery:soldierLivery('gallery'),paint:null});
    }else if(it.kind==='vehicle'){
      const dir=along(it.x+6,it.y),pts=[p,dir];
      const c={id:'gallery-'+it.vehicle+(it.flat?'-2d':''),vehicle:it.vehicle,vehicles:1,guards:0,distance:.001+t*0,speed:3,good:'wood',qty:60,seed:1};
      const keep=window.ConquerWorld3D?._setFiguresForTest;
      if(it.flat&&keep)keep(false);
      try{ConquerVehicles.draw(c,pts)}finally{if(it.flat&&keep)keep(true)}
    }
  }
  function labels(){
    ctx.save();ctx.font='600 13px system-ui';ctx.fillStyle='#f2e6d3';ctx.strokeStyle='rgba(0,0,0,.7)';ctx.lineWidth=3;
    for(const row of ROWS){const p=w2s(along(-2.2,row.y-1.5),0);ctx.strokeText(row.label,p.x,p.y);ctx.fillText(row.label,p.x,p.y)}
    ctx.restore();
  }
  function install(){
    if(installed)return;installed=true;
    const front=ConquerWorld3D.drawFront;
    ConquerWorld3D.drawFront=function(r){if(on){for(const row of ROWS)for(const it of row.items)drawItem({...it,y:row.y})}const out=front.apply(this,arguments);if(on)labels();return out};
  }
  async function show({scale=3,at=null,time=null,rotation=0,center=[6,7]}={}){
    install();on=true;
    State.clock.speed=0;State.daylightOverride='day';State.weatherOverride='sun';State.seasonOverride='summer';
    State.view.rotation=rotation;State.view.scale=scale;if(at)origin=at;
    frozen=time;
    const mid=w2s(along(center[0],center[1]),0),rect=wrap.getBoundingClientRect();
    State.view.x+=rect.width/2-mid.x;State.view.y+=rect.height/2-mid.y;
    invalidateSceneCache();draw();
    return{scale,origin,rows:ROWS.map(r=>r.label)};
  }
  function animate(on_=true){
    if(!on_){cancelAnimationFrame(animate.raf);return}
    const step=ts=>{clock=ts/1000;draw();animate.raf=requestAnimationFrame(step)};animate.raf=requestAnimationFrame(step);
  }
  // Detail sheet: the same painters at a large size on an overlay canvas (inspection only).
  function sheet({size=150,t=.3}={}){
    let c=document.getElementById('horseSheet');
    if(!c){c=document.createElement('canvas');c.id='horseSheet';c.width=1400;c.height=860;
      Object.assign(c.style,{position:'fixed',left:'0',top:'0',zIndex:99999,background:'#3b4a2e'});document.body.appendChild(c)}
    const g=c.getContext('2d');g.fillStyle='#55673f';g.fillRect(0,0,c.width,c.height);
    const lab=(s,x,y)=>{g.fillStyle='#f4ead6';g.font='600 15px system-ui';g.fillText(s,x,y)};
    const W=size*1.9/256*256;   // horse box on screen
    const cells=[
      ['passo 0',x=>ConquerAnimals.drawAnimal('horse',g,x,0,size,{t:0,mode:'walk',coat:'brown'})],
      ['passo 1/4',x=>ConquerAnimals.drawAnimal('horse',g,x,0,size,{t:.156,mode:'walk',coat:'brown'})],
      ['pascola',x=>ConquerAnimals.drawAnimal('horse',g,x,0,size,{t,mode:'browse',blend:.86,coat:'grey'})],
      ['fermo',x=>ConquerAnimals.drawAnimal('horse',g,x,0,size,{t,mode:'idle',coat:'black'})],
      ['galoppo',x=>ConquerAnimals.drawAnimal('horse',g,x,0,size,{t:.1,mode:'run',coat:'white'})],
      ['cavaliere',x=>ConquerMounted2D.draw(g,x,0,size,{kind:'knight',mode:'idle',t,coat:'brown',livery:soldierLivery('gallery')})],
      ['carica',x=>ConquerMounted2D.draw(g,x,0,size,{kind:'knight',mode:'run',t:.1,coat:'grey',pose:{ready:1},livery:soldierLivery('gallery')})],
      ['messaggero',x=>ConquerMounted2D.draw(g,x,0,size,{kind:'messenger',mode:'walk',t,coat:'black',livery:soldierLivery('gallery')})],
      ['carro',x=>ConquerWagons.drawWagon(g,x-size*.9,0,size*.62,{chassis:'wagon',team:[{coat:'black'},{coat:'brown'}],cargo:['sack','crate','barrel'],facing:1,moving:true,t,distance:20})]
    ];
    cells.forEach(([name,fn],i)=>{
      const col=i%5,row=Math.floor(i/5),x=60+col*270+W*.45,y=row*420+360;
      g.save();g.translate(0,y);fn(x);g.restore();lab(name,x-W*.4,y+30);
    });
    return c;
  }
  window.ConquerHorseGallery={show,animate,sheet,hideSheet:()=>document.getElementById('horseSheet')?.remove(),hide:()=>{on=false;draw()},ROWS};
})();
