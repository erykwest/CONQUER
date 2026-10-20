'use strict';
// CONQUER wagons: a modular vehicle drawn in the same side view as the
// animals (art faces right, mirrored for facing -1) with a shallow 3/4 depth
// so the load reads. Modules: chassis (cart / wagon / noble carriage),
// team (0–2 horses from ConquerAnimals), driver (caller-drawn on the seat
// anchor) and cargo slots. Art units match animal art units, so a wagon and
// its horses share one size. Classic script; layout maths is pure.
(function(){
  // Far side of the vehicle appears up-right of the near side.
  const DEPTH={x:10,y:-16};
  // Wagon art is authored compact and drawn 1.6x the animal art unit, so a
  // bed is longer than the horse pulling it.
  const WAGON_SCALE=1.6;
  const CHASSIS={
    cart:{bed:[-70,70],floor:-80,boardTop:-110,wheels:[{x:0,r:52}],seat:null,hitchY:-84},
    wagon:{bed:[-105,105],floor:-80,boardTop:-110,wheels:[{x:-68,r:44},{x:68,r:36}],seat:{x:86,y:-128,driverY:-96},hitchY:-70},
    // Closed coach: the cabin replaces the bed, so it carries no cargo.
    carriage:{bed:[-62,42],floor:-74,boardTop:-74,wheels:[{x:-50,r:50},{x:74,r:36}],seat:{x:84,y:-132,driverY:-100},hitchY:-60,
      cabin:{x0:-58,x1:40,bottom:-70,top:-168}}
  };
  const CARGO={
    // w/h in art units; drawn with the base centred on the bed floor.
    sack:{w:40,h:54},crate:{w:46,h:44},barrel:{w:40,h:54},hay:{w:54,h:40},logs:{w:80,h:40},stone:{w:44,h:34}
  };
  const COLORS={wood:'#9a6a3f',woodDark:'#6f4a2b',woodLight:'#b98652',line:'#3e2a17',iron:'#55595d',ironLight:'#7c8186',
    leather:'#4a3020',lacquer:'#6a2430',lacquerDark:'#3e161d',trim:'#c9a24b',glass:'#2a333c',velvet:'#4f1a2a',
    sack:'#c9a46e',sackDark:'#a8834f',hay:'#e2c25a',hayDark:'#b99a3a',stone:'#9a9893',stoneDark:'#77756f',barrel:'#8a5a35',log:'#8b6a45',logEnd:'#c9a66f'};
  // The team stands this far ahead of the bed front (art units).
  const HITCH_GAP=40,HORSE_REAR=54,HORSE_CENTER=134;

  // Pure layout: where every module sits for a given spec, in art units with
  // the origin on the ground under the middle of the bed.
  function wagonLayout(spec={}){
    const chassis=CHASSIS[spec.chassis]||CHASSIS.wagon;
    const [bx0,bx1]=chassis.bed;
    const items=chassis.cabin?[]:(spec.cargo||[]).filter(k=>CARGO[k]).slice(0,6);
    // Back row fills first (it sits deeper), the front row takes the rest.
    const backCount=Math.min(items.length,Math.ceil(items.length/2)||0);
    const rows=[items.slice(0,backCount),items.slice(backCount)];
    const cargo=[];
    rows.forEach((row,r)=>{
      const span=bx1-bx0-24,depth=r===0?.7:.15;
      row.forEach((kind,i)=>cargo.push({kind,row:r,
        x:bx0+12+span*(i+.5)/row.length+DEPTH.x*depth,
        // Loads are heaped: they rest above the floor so they show over the sides.
        y:chassis.boardTop+18+DEPTH.y*depth}));
    });
    const teamCount=Math.max(0,Math.min(2,spec.team?.length??0));
    const horseX=bx1*WAGON_SCALE+HITCH_GAP+(HORSE_CENTER-HORSE_REAR);
    const horses=[];
    // Far horse first (drawn behind), near horse last.
    if(teamCount===2)horses.push({x:horseX+DEPTH.x*1.6,y:DEPTH.y*1.6,far:true,index:1});
    if(teamCount>=1)horses.push({x:horseX,y:0,far:false,index:0});
    return{chassis,bed:[bx0,bx1],cargo,horses,seat:chassis.seat};
  }
  // Wheel turn for a travelled distance (art units) — rolling without slip.
  const wheelAngle=(distance,r)=>distance/r;

  const lerp=(a,b,k)=>a+(b-a)*k;
  function poly(ctx,pts,fill,line,lw){
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();if(line){ctx.strokeStyle=line;ctx.lineWidth=lw;ctx.lineJoin='round';ctx.stroke()}
  }
  function drawWheel(ctx,cx,cy,r,angle,lw,far){
    const c=COLORS;
    ctx.save();ctx.translate(cx,cy);
    ctx.fillStyle=far?'#2f3133':c.iron;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=far?c.woodDark:c.wood;ctx.beginPath();ctx.arc(0,0,r*.86,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=far?'#4a3420':c.woodDark;ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=far?c.woodDark:c.woodLight;ctx.lineWidth=Math.max(lw*1.4,r*.09);ctx.lineCap='round';
    for(let i=0;i<10;i++){
      const a=angle+i*Math.PI/5;
      ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.18,Math.sin(a)*r*.18);ctx.lineTo(Math.cos(a)*r*.76,Math.sin(a)*r*.76);ctx.stroke();
    }
    ctx.fillStyle=far?'#2f3133':c.ironLight;ctx.beginPath();ctx.arc(0,0,r*.2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=c.line;ctx.lineWidth=lw;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,r*.2,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  function drawCargo(ctx,item,lw){
    const c=COLORS,{w,h}=CARGO[item.kind],x=item.x,y=item.y;
    switch(item.kind){
      case 'sack':
        ctx.beginPath();ctx.moveTo(x-w*.5,y);ctx.bezierCurveTo(x-w*.62,y-h*.6,x-w*.3,y-h*.9,x-w*.12,y-h*.86);
        ctx.lineTo(x-w*.2,y-h);ctx.lineTo(x+w*.2,y-h);ctx.lineTo(x+w*.12,y-h*.86);
        ctx.bezierCurveTo(x+w*.3,y-h*.9,x+w*.62,y-h*.6,x+w*.5,y);ctx.closePath();
        ctx.fillStyle=item.row?c.sack:c.sackDark;ctx.fill();ctx.strokeStyle=c.line;ctx.lineWidth=lw;ctx.stroke();
        ctx.beginPath();ctx.moveTo(x-w*.14,y-h*.86);ctx.lineTo(x+w*.14,y-h*.86);ctx.stroke();break;
      case 'crate':
        poly(ctx,[[x-w/2,y],[x-w/2,y-h],[x+w/2,y-h],[x+w/2,y]],item.row?c.woodLight:c.wood,c.line,lw);
        ctx.beginPath();ctx.moveTo(x-w/2,y-h/2);ctx.lineTo(x+w/2,y-h/2);ctx.moveTo(x-w/2,y);ctx.lineTo(x+w/2,y-h);ctx.stroke();break;
      case 'barrel':
        ctx.beginPath();ctx.moveTo(x-w*.42,y);ctx.quadraticCurveTo(x-w*.58,y-h/2,x-w*.42,y-h);ctx.lineTo(x+w*.42,y-h);
        ctx.quadraticCurveTo(x+w*.58,y-h/2,x+w*.42,y);ctx.closePath();
        ctx.fillStyle=c.barrel;ctx.fill();ctx.strokeStyle=c.line;ctx.lineWidth=lw;ctx.stroke();
        ctx.strokeStyle=c.iron;ctx.lineWidth=lw*1.6;
        for(const k of [.22,.78]){ctx.beginPath();ctx.moveTo(x-w*.5,y-h*k);ctx.lineTo(x+w*.5,y-h*k);ctx.stroke()}break;
      case 'hay':
        poly(ctx,[[x-w/2,y],[x-w/2,y-h],[x+w/2,y-h],[x+w/2,y]],item.row?c.hay:c.hayDark,c.line,lw);
        ctx.strokeStyle=c.hayDark;ctx.beginPath();
        for(let i=1;i<4;i++){ctx.moveTo(x-w/2+3,y-h*i/4);ctx.lineTo(x+w/2-3,y-h*i/4)}ctx.stroke();
        ctx.strokeStyle=c.leather;ctx.lineWidth=lw*1.3;ctx.beginPath();ctx.moveTo(x-w*.2,y);ctx.lineTo(x-w*.2,y-h);ctx.moveTo(x+w*.2,y);ctx.lineTo(x+w*.2,y-h);ctx.stroke();break;
      case 'logs':
        for(const [dx,dy] of [[-.25,0],[.25,0],[0,-1]]){
          const lx=x+dx*w*.5,ly=y-h*.25+dy*h*.48,rr=h*.27;
          poly(ctx,[[lx-w*.5,ly-rr],[lx+w*.5,ly-rr],[lx+w*.5,ly+rr],[lx-w*.5,ly+rr]],c.log,c.line,lw);
          ctx.fillStyle=c.logEnd;ctx.beginPath();ctx.ellipse(lx+w*.5,ly,rr*.5,rr,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=c.line;ctx.stroke();
        }break;
      case 'stone':
        poly(ctx,[[x-w*.5,y],[x-w*.42,y-h*.8],[x-w*.1,y-h],[x+w*.38,y-h*.86],[x+w*.5,y]],item.row?c.stone:c.stoneDark,c.line,lw);break;
    }
  }
  function drawBoard(ctx,x0,x1,top,bottom,fill,lw,dark){
    const c=COLORS;
    poly(ctx,[[x0,bottom],[x0,top],[x1,top],[x1,bottom]],fill,c.line,lw);
    ctx.strokeStyle=dark?'rgba(0,0,0,.25)':c.woodDark;ctx.lineWidth=lw;
    ctx.beginPath();for(let k=1;k<3;k++){const y=lerp(top,bottom,k/3);ctx.moveTo(x0,y);ctx.lineTo(x1,y)}ctx.stroke();
    ctx.fillStyle=dark?'rgba(0,0,0,.25)':c.woodDark;
    for(const px of [x0,(x0+x1)/2,x1])ctx.fillRect(px-3,top,6,bottom-top);
  }
  // Noble carriage cabin: far side and roof in depth, then the near side with its
  // gilt trim, two windows and the crest door.
  function drawCabin(ctx,cab,lw){
    const c=COLORS,{x0,x1,bottom,top}=cab,D=DEPTH;
    poly(ctx,[[x0,top],[x0+D.x,top+D.y],[x1+D.x,top+D.y],[x1,top]],c.lacquerDark,c.line,lw);         // roof
    poly(ctx,[[x1,bottom],[x1,top],[x1+D.x,top+D.y],[x1+D.x,bottom+D.y]],c.lacquerDark,c.line,lw);   // front
    poly(ctx,[[x0+6,bottom+10],[x0,bottom-14],[x0,top],[x1,top],[x1,bottom-14],[x1-6,bottom+10]],c.lacquer,c.line,lw);
    poly(ctx,[[x0-4,top+2],[x0-4,top-8],[x1+4,top-8],[x1+4,top+2]],c.lacquerDark,c.line,lw);         // roof cornice
    ctx.strokeStyle=c.trim;ctx.lineWidth=lw*1.6;
    ctx.beginPath();ctx.moveTo(x0,bottom-14);ctx.lineTo(x1,bottom-14);ctx.moveTo(x0,top+6);ctx.lineTo(x1,top+6);ctx.stroke();
    const mid=(x0+x1)/2,wy0=top+16,wy1=top+50;
    for(const [a,b] of [[x0+8,mid-20],[mid+20,x1-8]])poly(ctx,[[a,wy1],[a,wy0],[b,wy0],[b,wy1]],c.glass,c.trim,lw*1.2);
    poly(ctx,[[mid-16,bottom-16],[mid-16,top+12],[mid+16,top+12],[mid+16,bottom-16]],c.lacquerDark,c.trim,lw);   // door
    poly(ctx,[[mid-10,top+48],[mid-10,top+18],[mid+10,top+18],[mid+10,top+48]],c.glass,null,lw);
    poly(ctx,[[mid-7,bottom-36],[mid-7,bottom-52],[mid+7,bottom-52],[mid+7,bottom-36]],c.velvet,c.trim,lw);       // crest
    for(const fx of [x0,x1])poly(ctx,[[fx-4,top-8],[fx-4,top-16],[fx+4,top-16],[fx+4,top-8]],c.trim,c.line,lw);  // finials
  }

  // opts: facing ±1, t (s), distance (art units travelled), moving (bool),
  // chassis 'cart'|'wagon'|'carriage', team [{coat}], cargo [kinds],
  // driver(ctx, x, y, size) draws the figure at the seat anchor (screen space).
  function drawWagon(ctx,x,y,size,opts={}){
    const A=window.ConquerAnimals,c=COLORS;
    const horseScale=A?.SPECIES?.horse?.scale||1,u=size*horseScale/256,K=WAGON_SCALE;
    const facing=opts.facing>=0?1:-1,lay=wagonLayout(opts),ch=lay.chassis,[bx0,bx1]=lay.bed;
    const lw=Math.max(.55,size/90)/(u*K),distance=opts.distance||0,moving=!!opts.moving;
    const bob=moving?Math.sin(distance*.18)*1.2:0;
    const horseT=moving?(opts.t||0):0;
    const toScreen=(ax,ay)=>({x:x+facing*ax*u,y:y+ay*u});
    // Team ahead of the wagon, far horse behind everything else.
    const horses=lay.horses.map(h=>({...h,coat:opts.team?.[h.index]?.coat}));
    const drawHorse=h=>{
      const p=toScreen(h.x,h.y);
      A?.drawAnimal('horse',ctx,p.x,p.y,size,{t:horseT+h.index*.12,mode:'walk',facing,coat:h.coat,seed:h.index});
    };
    for(const h of horses)if(h.far)drawHorse(h);
    ctx.save();
    ctx.translate(x,y);ctx.scale(facing*u*K,u*K);
    // Far wheels.
    for(const w of ch.wheels)drawWheel(ctx,w.x+DEPTH.x,-w.r+DEPTH.y,w.r,wheelAngle(distance,w.r),lw,true);
    ctx.translate(0,bob);
    // Hitch: pole from the bed front to the team, traces to each collar.
    if(horses.length){
      const hx=lay.horses[lay.horses.length-1].x;
      ctx.strokeStyle=c.woodDark;ctx.lineWidth=7;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(bx1-6,ch.hitchY);ctx.lineTo((hx+52)/K,-112/K);ctx.stroke();
      ctx.strokeStyle=c.line;ctx.lineWidth=lw;ctx.stroke();
    }
    // Far board (inner face), cargo, seat + driver, near board — or the carriage cabin.
    if(ch.cabin){
      // Perch under the cabin, from the rear wheel to the coachman's box.
      poly(ctx,[[ch.wheels[0].x,-ch.wheels[0].r-4],[ch.wheels[1].x+8,-ch.wheels[1].r-6],[ch.wheels[1].x+8,-ch.wheels[1].r+2],[ch.wheels[0].x,-ch.wheels[0].r+4]],c.lacquerDark,c.line,lw);
      drawCabin(ctx,ch.cabin,lw);
    }else{
      ctx.save();ctx.translate(DEPTH.x,DEPTH.y);drawBoard(ctx,bx0,bx1,ch.boardTop,ch.floor,c.woodDark,lw,true);ctx.restore();
      poly(ctx,[[bx0,ch.floor],[bx0+DEPTH.x,ch.floor+DEPTH.y],[bx1+DEPTH.x,ch.floor+DEPTH.y],[bx1,ch.floor]],c.woodDark,c.line,lw);
      for(const item of lay.cargo)drawCargo(ctx,item,lw);
    }
    if(ch.seat){
      const s=ch.seat;
      poly(ctx,[[s.x-18,s.y],[s.x-18,s.y-6],[s.x+18+DEPTH.x*.6,s.y-6+DEPTH.y*.6],[s.x+18+DEPTH.x*.6,s.y+DEPTH.y*.6]],c.woodLight,c.line,lw);
      // Post from the seat down into the bed.
      ctx.fillStyle=c.woodDark;ctx.fillRect(s.x-3,s.y,6,ch.boardTop-s.y);
    }
    ctx.restore();
    if(lay.seat&&opts.driver){
      // Seated: the anchor sits below the board top, which hides the legs.
      const s=toScreen(lay.seat.x*K,(lay.seat.driverY+bob)*K);
      opts.driver(ctx,s.x,s.y,size);
    }
    ctx.save();
    ctx.translate(x,y);ctx.scale(facing*u*K,u*K);ctx.translate(0,bob);
    // End boards then the near board (an open bed only).
    if(!ch.cabin){
      for(const ex of [bx0,bx1])
        poly(ctx,[[ex,ch.floor],[ex,ch.boardTop],[ex+DEPTH.x,ch.boardTop+DEPTH.y],[ex+DEPTH.x,ch.floor+DEPTH.y]],c.wood,c.line,lw);
      drawBoard(ctx,bx0,bx1,ch.boardTop,ch.floor+8,c.wood,lw,false);
    }
    ctx.translate(0,-bob);
    // Near wheels.
    for(const w of ch.wheels)drawWheel(ctx,w.x,-w.r,w.r,wheelAngle(distance,w.r),lw,false);
    ctx.restore();
    // Near horse in front, with a leather collar band.
    for(const h of horses)if(!h.far){
      drawHorse(h);
      const a=toScreen(h.x+60,-150),b=toScreen(h.x+74,-100);
      ctx.strokeStyle=c.leather;ctx.lineWidth=Math.max(1,8*u);ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  }
  window.ConquerWagons={CHASSIS,CARGO,COLORS,DEPTH,WAGON_SCALE,wagonLayout,wheelAngle,drawWagon};
})();
