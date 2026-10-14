'use strict';
// Weather profiles and animated visual layers. Runtime semantics preserved from the monolith.
const WEATHER_PROFILES=Object.freeze({
  spring:[['clear',.16],['wind',.20],['rain',.35],['storm',.12],['fog',.17]],
  summer:[['clear',.42],['wind',.22],['rain',.14],['storm',.12],['fog',.10]],
  autumn:[['clear',.10],['wind',.30],['rain',.32],['storm',.12],['fog',.16]],
  winter:[['clear',.10],['wind',.22],['snow',.50],['storm',.05],['fog',.13]]
});
const WEATHER_STYLE=Object.freeze({
  sun:{wind:0,rain:0,snow:0,lightning:0,clouds:0,fog:0},
  clear:{wind:.10,rain:0,snow:0,lightning:0,clouds:.10,fog:0},
  wind:{wind:.90,rain:0,snow:0,lightning:0,clouds:.38,fog:0},
  rain:{wind:.38,rain:1,snow:0,lightning:0,clouds:.82,fog:0},
  storm:{wind:1,rain:1.18,snow:0,lightning:1,clouds:1,fog:0},
  snow:{wind:.30,rain:0,snow:1,lightning:0,clouds:.76,fog:0},
  fog:{wind:.08,rain:0,snow:0,lightning:0,clouds:.18,fog:1}
});
let weatherCacheKey='',weatherCacheValue=null;
function weatherHash01(value){
  let x=((value>>>0)+0x6D2B79F5)>>>0;
  x=Math.imul(x^(x>>>15),x|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return((x^(x>>>14))>>>0)/4294967296;
}
function currentWeather(){
  const day=Math.floor(State.clock.day);
  const season=WEATHER_PROFILES[State.season]?State.season:'summer';
  const forced=WEATHER_STYLE[State.weatherOverride]?State.weatherOverride:null;
  const key=State.seed+'|'+day+'|'+season+'|'+(forced||'procedural');
  if(weatherCacheKey===key&&weatherCacheValue)return weatherCacheValue;
  const salts={spring:0x13579bdf,summer:0x2468ace0,autumn:0x51f15e5d,winter:0x7f4a7c15};
  const seed=(State.seed^Math.imul(day+1,0x9e3779b1)^salts[season])>>>0;
  let kind=forced||'clear';
  if(!forced){
    let roll=weatherHash01(seed);
    for(const [candidate,weight] of WEATHER_PROFILES[season]){
      roll-=weight;
      if(roll<=0){kind=candidate;break}
    }
  }
  weatherCacheKey=key;
  weatherCacheValue={kind,seed,...WEATHER_STYLE[kind]};
  return weatherCacheValue;
}
function weatherNoise(seed,index){return weatherHash01(seed^Math.imul(index+1,0x85ebca6b))}
let cloudLayerKey='';
function clearWeatherCloudLayer(){
  if(!weatherCloudLayer)return;
  weatherCloudLayer.replaceChildren();
  weatherCloudLayer.style.opacity='0';
  cloudLayerKey='';
}
function clearWeatherOverlay(){
  if(weatherCtx&&weatherCanvas){
    const r=wrap.getBoundingClientRect();
    weatherCtx.clearRect(0,0,r.width,r.height);
  }
  clearWeatherCloudLayer();
}
function buildCloudLayer(weather,w,h){
  if(!weatherCloudLayer)return;
  weatherCloudLayer.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  const count=Math.round(2+10*weather.clouds);
  const stormy=weather.kind==='storm'||weather.kind==='rain';
  for(let i=0;i<count;i++){
    const group=document.createElementNS(ns,'g');
    const a=weatherNoise(weather.seed,1500+i*5),b=weatherNoise(weather.seed,1501+i*5),c=weatherNoise(weather.seed,1502+i*5),d=weatherNoise(weather.seed,1503+i*5),e=weatherNoise(weather.seed,1504+i*5);
    const scale=.58+c*.92;
    const opacity=(.10+.18*weather.clouds)*(.75+d*.5);
    const fill=stormy?'#aeb8bd':'#e1e5df';
    group.dataset.baseX=String(a*(w+240)-120);
    group.dataset.baseY=String(18+b*Math.max(40,h*.38));
    group.dataset.speed=String(6+20*d+weather.wind*18);
    group.dataset.scale=String(scale);
    group.setAttribute('opacity',opacity.toFixed(3));
    const ellipses=[[-30,4,32,15],[-5,-4,38,21],[27,4,31,16],[0,8,56,17]];
    for(const [cx,cy,rx,ry] of ellipses){
      const node=document.createElementNS(ns,'ellipse');
      node.setAttribute('cx',String(cx+(e-.5)*5));
      node.setAttribute('cy',String(cy));
      node.setAttribute('rx',String(rx));
      node.setAttribute('ry',String(ry));
      node.setAttribute('fill',fill);
      group.appendChild(node);
    }
    weatherCloudLayer.appendChild(group);
  }
  cloudLayerKey=weather.seed+'|'+weather.kind+'|'+Math.round(w)+'x'+Math.round(h);
}
function drawCloudLayer(weather,w,h,t){
  if(!weatherCloudLayer)return;
  const key=weather.seed+'|'+weather.kind+'|'+Math.round(w)+'x'+Math.round(h);
  if(cloudLayerKey!==key)buildCloudLayer(weather,w,h);
  for(const group of weatherCloudLayer.children){
    const baseX=Number(group.dataset.baseX)||0,baseY=Number(group.dataset.baseY)||0,speed=Number(group.dataset.speed)||8,scale=Number(group.dataset.scale)||1;
    const x=((baseX+t*speed+w+260)%(w+260))-130;
    group.setAttribute('transform','translate('+x.toFixed(1)+' '+baseY.toFixed(1)+') scale('+scale.toFixed(3)+')');
  }
}
function drawWindLayer(g,w,h,t,weather){
  if(weather.wind<=.15)return;
  const count=Math.round(24+32*weather.wind);
  g.save();g.lineCap='round';g.lineWidth=1.05;g.strokeStyle='rgba(232,235,231,.30)';
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,i*3),b=weatherNoise(weather.seed,i*3+1),c=weatherNoise(weather.seed,i*3+2);
    const speed=70+120*c;
    const x=((a*(w+220)+t*speed)%(w+220))-110;
    const y=18+b*Math.max(1,h-36);
    const len=26+72*c;
    g.globalAlpha=.18+.38*c;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+len,y);g.stroke();
  }
  g.restore();
}
function drawRainLayer(g,w,h,t,weather){
  if(!weather.rain)return;
  const count=Math.round(144*weather.rain);
  g.save();g.lineWidth=1;g.strokeStyle='rgba(190,218,232,.52)';g.beginPath();
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,400+i*3),b=weatherNoise(weather.seed,401+i*3),c=weatherNoise(weather.seed,402+i*3);
    const speed=260+210*c;
    const y=((b*(h+120)+t*speed)%(h+120))-60;
    const x=((a*(w+120)+t*speed*.20)%(w+120))-60;
    const len=11+18*c;
    g.moveTo(x,y);g.lineTo(x+len*.342,y+len*.94);
  }
  g.stroke();g.restore();
}
function drawSnowLayer(g,w,h,t,weather){
  if(!weather.snow)return;
  const count=156;
  g.save();g.fillStyle='rgba(245,248,244,.78)';
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,800+i*4),b=weatherNoise(weather.seed,801+i*4),c=weatherNoise(weather.seed,802+i*4),d=weatherNoise(weather.seed,803+i*4);
    const speed=22+38*c;
    const y=((b*(h+50)+t*speed)%(h+50))-25;
    const drift=Math.sin(t*(.45+.5*d)+i)*18*(.45+c);
    const x=(a*w+drift+w)%w;
    const r=1.5+1.0*d;
    g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  }
  g.restore();
}
function drawFogLayer(g,w,h,t,weather){
  if(!weather.fog)return;
  g.save();
  g.globalCompositeOperation='screen';
  const night=clamp(nightFactor(),0,1);
  const baseAlpha=.055+.045*(1-night);
  for(let i=0;i<8;i++){
    const a=weatherNoise(weather.seed,1700+i*4),b=weatherNoise(weather.seed,1701+i*4),c=weatherNoise(weather.seed,1702+i*4),d=weatherNoise(weather.seed,1703+i*4);
    const speed=6+10*c;
    const x=((a*(w+520)+t*speed)%(w+520))-260;
    const y=h*(.12+.76*b);
    const rx=160+220*c,ry=26+42*d;
    g.fillStyle='rgba(220,226,222,'+(baseAlpha*(.72+d*.55)).toFixed(3)+')';
    g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();
  }
  g.fillStyle='rgba(202,210,207,'+(.055+.035*(1-night))+')';
  g.fillRect(0,0,w,h);
  g.restore();
}
function drawBirdLayer(g,w,h,t,weather){
  if(weather.fog||weather.rain||weather.snow||weather.lightning)return;
  const seasonFactor={spring:1,summer:.82,autumn:.52,winter:.16}[State.season]||.5;
  const period=18+weatherNoise(weather.seed,1800)*18;
  const cycle=Math.floor(t/period),phase=t-cycle*period;
  if(phase>6.5||weatherNoise(weather.seed,1810+cycle)>.58*seasonFactor)return;
  const count=3+Math.floor(weatherNoise(weather.seed,1820+cycle)*4);
  const dir=weatherNoise(weather.seed,1830+cycle)<.5?1:-1;
  const baseY=h*(.14+.22*weatherNoise(weather.seed,1840+cycle));
  const speed=(w+180)/6.5;
  const lead=dir>0?-90+phase*speed:w+90-phase*speed;
  g.save();g.strokeStyle='rgba(34,39,37,.68)';g.lineWidth=1.35;g.lineCap='round';
  for(let i=0;i<count;i++){
    const row=i===0?0:Math.ceil(i/2),side=i===0?0:(i%2?1:-1);
    const x=lead-dir*row*23;
    const y=baseY+row*9+side*5;
    const flap=Math.sin(t*7+i*1.7)*2.2;
    g.beginPath();g.moveTo(x-6,y+flap);g.lineTo(x,y-2);g.lineTo(x+6,y-flap);g.stroke();
  }
  g.restore();
}
function drawLeafLayer(g,w,h,t,weather){
  if(State.season!=='autumn'||weather.snow||weather.fog)return;
  const intensity=weather.kind==='storm'?1.7:weather.kind==='wind'?1.35:weather.kind==='rain'?.9:.55;
  const count=Math.round(18*intensity);
  g.save();
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,1900+i*5),b=weatherNoise(weather.seed,1901+i*5),c=weatherNoise(weather.seed,1902+i*5),d=weatherNoise(weather.seed,1903+i*5),e=weatherNoise(weather.seed,1904+i*5);
    const speed=34+58*c;
    const y=((b*(h+60)+t*speed)%(h+60))-30;
    const drift=Math.sin(t*(.7+d)+i)*24+(weather.wind||0)*t*10;
    const x=(a*w+drift+w)%w;
    const size=2.2+2.4*e;
    g.save();g.translate(x,y);g.rotate(t*(1.5+d*2)+i);
    g.fillStyle=e>.66?'rgba(155,87,38,.74)':e>.33?'rgba(189,120,47,.72)':'rgba(111,78,39,.72)';
    g.beginPath();g.ellipse(0,0,size,size*.48,.45,0,Math.PI*2);g.fill();g.restore();
  }
  g.restore();
}
let puddleCacheKey='',puddleCache=[];
function puddlePoints(weather){
  const key=State.seed+'|'+weather.seed;
  if(puddleCacheKey===key)return puddleCache;
  const out=[];
  for(let i=0;i<64&&out.length<34;i++){
    const x=8+weatherNoise(weather.seed,2100+i*3)*(WORLD-16),y=8+weatherNoise(weather.seed,2101+i*3)*(WORLD-16);
    const p={x,y};
    if(environmentBlocksPoint(p,'road')||terrainSlopeKind(p)==='steep')continue;
    const blocked=State.structures.some(s=>{const c=structureCenter(s),r=s.type==='road'||s.type==='field'?0:2.2;return r>0&&Math.hypot(c.x-x,c.y-y)<r});
    if(blocked)continue;
    out.push({x,y,rx:.22+.35*weatherNoise(weather.seed,2200+i*2),ry:.10+.16*weatherNoise(weather.seed,2201+i*2),rot:weatherNoise(weather.seed,2250+i)*Math.PI});
  }
  puddleCacheKey=key;puddleCache=out;return out;
}
function drawPuddleLayer(){
  const weather=currentWeather();
  if(State.view.scale<=.80||!weather.rain)return;
  ctx.save();
  for(const p of puddlePoints(weather)){
    const z=terrainElevation(p)+.012,c=w2s(p,z);
    const rx=p.rx*U*State.view.scale,ry=p.ry*U*State.view.scale*.52;
    ctx.fillStyle='rgba(77,111,126,.34)';
    ctx.strokeStyle='rgba(178,205,212,.28)';
    ctx.lineWidth=.7;
    ctx.beginPath();ctx.ellipse(c.x,c.y,rx,ry,p.rot*.18,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(225,235,233,.24)';
    ctx.beginPath();ctx.arc(c.x-rx*.18,c.y-ry*.12,Math.max(1,rx*.28),Math.PI*1.05,Math.PI*1.75);ctx.stroke();
  }
  ctx.restore();
}
function drawLightningLayer(g,w,h,t,weather){
  if(!weather.lightning)return;
  const period=4.5+weatherNoise(weather.seed,1201)*4.5;
  const phase=(t+weatherNoise(weather.seed,1202)*period)%period;
  let flash=0;
  if(phase<.12)flash=1;
  else if(phase>=.18&&phase<.30)flash=.72;
  else if(phase>=.36&&phase<.46)flash=.48;
  if(!flash)return;

  g.save();
  const night=clamp(nightFactor(),0,1);
  const skyFlash=(.12+night*.55)*flash;
  g.globalCompositeOperation='screen';
  g.fillStyle='rgba(225,242,255,'+skyFlash.toFixed(3)+')';
  g.fillRect(0,0,w,h);
  g.globalCompositeOperation='source-over';

  const startX=w*(.18+.64*weatherNoise(weather.seed,1203));
  const endY=h*(.48+.32*weatherNoise(weather.seed,1204));
  g.strokeStyle='rgba(220,246,255,'+(.98*flash)+')';
  g.shadowColor='rgba(190,235,255,1)';
  g.shadowBlur=24;
  g.lineWidth=2.2;

  const trunk=[{x:startX,y:-10}];
  let x=startX,y=-10;
  for(let i=0;i<9;i++){
    y+=(endY+10)/9;
    x+=(weatherNoise(weather.seed,1210+i)-.5)*50;
    trunk.push({x,y});
  }

  g.beginPath();g.moveTo(trunk[0].x,trunk[0].y);
  for(let i=1;i<trunk.length;i++)g.lineTo(trunk[i].x,trunk[i].y);
  g.stroke();

  g.lineWidth=1.25;
  for(let i=2;i<trunk.length-1;i+=2){
    const p=trunk[i],dir=weatherNoise(weather.seed,1240+i)<.5?-1:1;
    const length=28+weatherNoise(weather.seed,1250+i)*42;
    const mid={x:p.x+dir*length*.54,y:p.y+length*.24};
    const end={x:p.x+dir*length,y:p.y+length*.58};
    g.beginPath();g.moveTo(p.x,p.y);g.lineTo(mid.x,mid.y);g.lineTo(end.x,end.y);g.stroke();

    if(weatherNoise(weather.seed,1270+i)>.48){
      const sub={x:mid.x-dir*length*.34,y:mid.y+length*.30};
      g.beginPath();g.moveTo(mid.x,mid.y);g.lineTo(sub.x,sub.y);g.stroke();
    }
  }
  g.restore();
}
function drawWeatherOverlay(now=performance.now()){
  if(!weatherCtx||!weatherCanvas)return;
  const r=wrap.getBoundingClientRect(),w=r.width,h=r.height;
  weatherCtx.clearRect(0,0,w,h);
  const weather=currentWeather(),t=now/1000;

  if(State.view.scale<WEATHER_ZOOM_THRESHOLD){
    const cloudFade=clamp((WEATHER_ZOOM_THRESHOLD-State.view.scale)/.10,0,1);
    drawCloudLayer(weather,w,h,t);
    if(weatherCloudLayer)weatherCloudLayer.style.opacity=String(.30+.70*cloudFade);
  }else{
    clearWeatherCloudLayer();
  }

  weatherCtx.save();
  weatherCtx.globalAlpha=1;
  drawFogLayer(weatherCtx,w,h,t,weather);
  drawWindLayer(weatherCtx,w,h,t,weather);
  drawRainLayer(weatherCtx,w,h,t,weather);
  drawSnowLayer(weatherCtx,w,h,t,weather);
  drawLeafLayer(weatherCtx,w,h,t,weather);
  drawBirdLayer(weatherCtx,w,h,t,weather);
  drawLightningLayer(weatherCtx,w,h,t,weather);
  weatherCtx.restore();
}

