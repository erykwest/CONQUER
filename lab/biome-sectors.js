'use strict';
// Experimental cartographic fixture. No Builder state, persistence or cloud writes.
const RegionalBiomePreview=(()=>{
  const size=200,min=50,max=150;
  const biomes={plains:['Pianura',[145,153,92]],hills:['Colline',[128,139,81]],valley:['Vallata',[115,147,93]],river:['Fiume',[88,139,137]],forest:['Foresta',[51,91,58]],mountains:['Montagne',[135,130,115]],sea:['Mare',[55,109,131]]};
  // Deterministic, continuous value noise in world coordinates (shared by all sectors).
  function hash(x,y,seed){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
  function noise(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),sx=x-ix,sy=y-iy,u=sx*sx*(3-2*sx),v=sy*sy*(3-2*sy);const a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),c=hash(ix,iy+1,seed),d=hash(ix+1,iy+1,seed);return(a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v}
  function sector(x,y){if(x>=min&&x<=max&&y>=min&&y<=max)return'center';const vertical=y<min?'north':y>max?'south':'',horizontal=x<min?'west':x>max?'east':'';return vertical&&horizontal?vertical+'-'+horizontal:vertical||horizontal}
  function weights(x,y,config){
    // 25U pure neighbour + 25U transition on either side of the 100U centre.
    const ease=d=>{const t=Math.min(1,Math.max(0,d/25));return t*t*(3-2*t)};
    const h=ease(Math.max(min-x,x-max,0)),v=ease(Math.max(min-y,y-max,0)),out={};
    const add=(biome,w)=>{if(w>0)out[biome]=(out[biome]||0)+w};
    add(config.center,(1-h)*(1-v));
    const horizontal=x<min?'west':'east',vertical=y<min?'north':'south';
    // Tensor-product blend: the outer 25x25 corner belongs to its diagonal neighbour.
    add(config[horizontal],h*(1-v));
    add(config[vertical],v*(1-h));
    add(config[vertical+horizontal[0].toUpperCase()+horizontal.slice(1)],h*v);
    return out;
  }
  function color(b,x,y,seed){
    const n=noise(x/12,y/12,seed),detail=noise(x/2,y/2,seed+17),grain=hash(Math.floor(x*3),Math.floor(y*3),seed+9)-.5;
    let c=biomes[b][1],shade=(n-.5)*20+grain*8;
    if(b==='forest'){shade+=(detail>.49?-22:15);if(detail>.66)c=[35,69,45]}
    if(b==='hills'||b==='mountains'){
      const scale=b==='mountains'?8:17,h=noise(x/scale,y/scale,seed+3),hx=noise((x+.7)/scale,y/scale,seed+3),hy=noise(x/scale,(y+.7)/scale,seed+3);
      shade+=(h-hx+ h-hy)*360+(h-.5)*35;
      if(b==='mountains'&&h>.72)c=[193,191,175];
      if(Math.floor(h*14)!==Math.floor((h+.012)*14))shade-=12;
    }
    if(b==='sea'){shade+=(n-.5)*18;if(noise(x/15,y/4,seed+2)>.76)shade+=13}
    if(b==='river')c=[110,148,94]; // Floodplain surface; the channel is a separate border spline.
    return c.map(v=>Math.max(0,Math.min(255,v+shade)));
  }
  function borderSpline(route,kind,seed=0){
    if(!route||route==='none')return[];
    // Cubic Bezier segments in U; canonical west side, or north-to-east corner.
    // Broad river bends (wavelength ~80U); restrained, longer ridge deviations.
    const amplitude=kind==='river'?9:2,phase=hash(0,0,seed+(kind==='river'?0:83))>.5?1:-1;
    const points=[],cubic=(a,b,c,d,steps=60)=>{
      for(let i=points.length?1:0;i<=steps;i++){const t=i/steps,u=1-t;points.push({x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y})}
    };
    const bend=(start,end,axis,fixed)=>{
      const count=kind==='river'?3:2,step=(end-start)/count;
      for(let i=0;i<count;i++){
        const a=start+i*step,d=a+step,offset=amplitude*(i%2?-phase:phase);
        const p=(along,across)=>axis==='y'?{x:across,y:along}:{x:along,y:across};
        cubic(p(a,fixed),p(a+step/3,fixed+offset),p(d-step/3,fixed+offset),p(d,fixed));
      }
    };
    if(route.includes('-')){
      // Outside rounded NE corner: top y=38, east x=162, radius 12U.
      bend(0,150,'x',38);
      cubic({x:150,y:38},{x:156.6274,y:38},{x:162,y:43.3726},{x:162,y:50},30);
      bend(50,200,'y',162);
      const turns={'north-east':0,'east-south':1,'south-west':2,'west-north':3}[route];
      return points.map(p=>{for(let i=0;i<turns;i++)p={x:size-p.y,y:p.x};return p});
    }
    bend(0,200,'y',38);
    return points.map(p=>route==='east'?{x:size-p.x,y:p.y}:route==='north'?{x:p.y,y:p.x}:route==='south'?{x:p.y,y:size-p.x}:p);
  }
  function drawBorders(ctx,config,natural,scale){
    ctx.save();ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
    for(const kind of ['ridge','river']){
      const points=borderSpline(config[kind],kind,config.seed);if(!points.length)continue;
      const stroke=(color,width)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()};
      if(kind==='river'){stroke('#a4a581',5.5);stroke('#335d70',3.8);stroke('#74b2c0',1.4)}
      else{
        stroke(natural?'#5c5c4c':'#665e50',8);stroke('#a6a18b',4);stroke('#ded6b9',.7);
        if(natural)for(let i=12;i<points.length-5;i+=16){const p=points[i],q=points[i+1],length=Math.hypot(q.x-p.x,q.y-p.y)||1,nx=-(q.y-p.y)/length,ny=(q.x-p.x)/length;ctx.beginPath();ctx.moveTo(p.x+nx*4,p.y+ny*4);ctx.lineTo(p.x,p.y);ctx.lineTo(p.x-nx*3,p.y-ny*3);ctx.strokeStyle='#d0c8ac';ctx.lineWidth=.5;ctx.stroke()}
      }
    }
    ctx.restore();
  }
  function render(canvas,config,natural){
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(canvas.width,canvas.height),w=canvas.width,h=canvas.height;
    for(let py=0;py<h;py++)for(let px=0;px<w;px++){
      const x=(px+.5)*size/w,y=(py+.5)*size/h,ws=weights(x,y,config,natural),rgb=[0,0,0];
      for(const [biome,weight] of Object.entries(ws)){const c=natural?color(biome,x,y,config.seed):biomes[biome][1];for(let k=0;k<3;k++)rgb[k]+=c[k]*weight}
      const i=(py*w+px)*4;for(let k=0;k<3;k++)image.data[i+k]=rgb[k];image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    drawBorders(ctx,config,natural,w/size);
    if(!config.guides)return;
    const s=w/size;ctx.save();ctx.scale(s,s);ctx.strokeStyle='rgba(255,245,209,.8)';ctx.lineWidth=.5;ctx.setLineDash([2,2]);ctx.beginPath();
    for(const v of [25,min,max,175]){ctx.moveTo(v,0);ctx.lineTo(v,size);ctx.moveTo(0,v);ctx.lineTo(size,v)}ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=.8;ctx.strokeRect(min,min,max-min,max-min);
    ctx.font='4px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    const labels=[['center',100,100],['north',100,12.5],['east',187.5,100],['south',100,187.5],['west',12.5,100],['northWest',12.5,12.5],['northEast',187.5,12.5],['southWest',12.5,187.5],['southEast',187.5,187.5]];
    const directions={north:'N',east:'E',south:'S',west:'O',northWest:'NO',northEast:'NE',southWest:'SO',southEast:'SE'};
    for(const [side,x,y] of labels){const label=(side==='center'?'BUILDABLE ZONE · ':directions[side]+' · ')+biomes[config[side]][0];ctx.font=(side==='center'?'4':'2.8')+'px system-ui';const width=ctx.measureText(label).width+2;ctx.fillStyle='rgba(15,24,20,.78)';ctx.fillRect(x-width/2,y-4,width,8);ctx.fillStyle='#f6f0df';ctx.fillText(label,x,y)}ctx.restore();
  }
  return{biomes,sector,weights,borderSpline,render};
})();
if(typeof module!=='undefined')module.exports=RegionalBiomePreview;
if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id),defaults={center:'plains',north:'mountains',east:'forest',south:'sea',west:'hills',northWest:'hills',northEast:'forest',southWest:'sea',southEast:'sea'};
  for(const [side,value] of Object.entries(defaults)){for(const [key,[name]] of Object.entries(RegionalBiomePreview.biomes))$(side).add(new Option(name,key));$(side).value=value}
  function update(){
    if(!$('controls').reportValidity())return;
    const config={seed:Number($('seed').value)>>>0,guides:$('guides').checked,river:$('riverRoute').value,ridge:$('ridgeRoute').value};for(const side of Object.keys(defaults))config[side]=$(side).value;
    RegionalBiomePreview.render($('scheme'),config,false);RegionalBiomePreview.render($('terrain'),config,true);
    $('legend').replaceChildren();for(const b of new Set(Object.keys(defaults).map(side=>config[side]))){const [label,color]=RegionalBiomePreview.biomes[b],key=document.createElement('span'),swatch=document.createElement('i');key.className='key';swatch.style.background=`rgb(${color.join(',')})`;key.append(swatch,document.createTextNode(label));$('legend').append(key)}
    $('status').textContent=`Seed ${config.seed} · Fiume: ${$('riverRoute').selectedOptions[0].text} · Dorsale: ${$('ridgeRoute').selectedOptions[0].text} · Percorsi simulati, non confini regionali reali.`;
  }
  $('controls').addEventListener('submit',e=>{e.preventDefault();update()});$('guides').addEventListener('change',update);$('next').addEventListener('click',()=>{$('seed').value=(Number($('seed').value)+1)>>>0;update()});update();
}
