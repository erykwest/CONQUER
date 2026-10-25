'use strict';
// Non-physical artistic lighting: calculated from game time, season and weather.
// Rendered after the scene, before emissive windows and selection outlines.
// Nothing here mutates the game clock, weather or cached terrain/building art.
(()=>{
  const SEASON=Object.freeze({
    spring:{rgb:[153,183,167],alpha:.055},
    summer:{rgb:[241,191,113],alpha:.062},
    autumn:{rgb:[210,137,80],alpha:.095},
    winter:{rgb:[133,164,203],alpha:.10}
  });
  const WEATHER=Object.freeze({
    sun:{rgb:[254,220,165],alpha:.016},
    clear:{rgb:[254,220,165],alpha:.018},
    wind:{rgb:[141,158,170],alpha:.060},
    rain:{rgb:[81,100,120],alpha:.16},
    storm:{rgb:[33,47,71],alpha:.27},
    snow:{rgb:[164,188,213],alpha:.12},
    fog:{rgb:[184,194,195],alpha:.17}
  });
  const CHANNELS=['seasonR','seasonG','seasonB','seasonA','weatherR','weatherG','weatherB','weatherA','nightA','dawnA','duskA'];
  let displayed=null,target=null,lastMs=null;
  const bound=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const bell=(x,center,width)=>Math.exp(-Math.pow((x-center)/width,2));
  const rgba=(r,g,b,a)=>'rgba('+Math.round(r)+','+Math.round(g)+','+Math.round(b)+','+bound(a).toFixed(4)+')';

  function profileAt({fraction=0,night=0,season='summer',weather='clear',sunrise=6,sunset=18}={}){
    const part=((Number(fraction)||0)%1+1)%1;
    const nf=bound(Number(night)||0);
    const hour=part*24,daylight=Math.max(1,sunset-sunrise);
    const sunPhase=(hour-sunrise)/daylight;
    const daylightMask=hour>=sunrise&&hour<sunset?1:0;
    const condition=typeof weather==='string'?{kind:weather}:weather||{};
    const kind=Object.hasOwn(WEATHER,condition.kind)?condition.kind:'clear';
    const climate=SEASON[season]||SEASON.summer;
    const atmosphere=WEATHER[kind];
    const cloud=bound(Number(condition.clouds)||0);
    const directSun=1-.72*cloud;
    return{
      seasonR:climate.rgb[0],seasonG:climate.rgb[1],seasonB:climate.rgb[2],
      seasonA:climate.alpha*(1-.35*nf),
      weatherR:atmosphere.rgb[0],weatherG:atmosphere.rgb[1],weatherB:atmosphere.rgb[2],
      weatherA:atmosphere.alpha*(1-.23*nf),
      nightA:.52*nf,
      dawnA:daylightMask*.24*bell(sunPhase,.065,.115)*directSun,
      duskA:daylightMask*.27*bell(sunPhase,.955,.135)*directSun
    };
  }
  function blend(next,now){
    target=next;
    if(!displayed){displayed={...next};lastMs=now;return displayed}
    const elapsed=bound(Math.max(0,now-(lastMs??now)),0,200);
    lastMs=now;
    // Real-time easing also softens abrupt procedural weather/season changes.
    const mix=1-Math.exp(-elapsed/400);
    for(const name of CHANNELS)displayed[name]+=(target[name]-displayed[name])*mix;
    return displayed;
  }
  function isTransitioning(){
    return !!(displayed&&target&&CHANNELS.some(name=>
      Math.abs(displayed[name]-target[name])>(name.endsWith('A')?.003:.5)));
  }
  function draw(ctx,viewport,inputs,now=performance.now()){
    if(!ctx||!viewport?.width||!viewport?.height)return;
    const p=blend(profileAt(inputs),now),w=viewport.width,h=viewport.height;
    ctx.save();
    ctx.fillStyle=rgba(p.seasonR,p.seasonG,p.seasonB,p.seasonA);
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle=rgba(p.weatherR,p.weatherG,p.weatherB,p.weatherA);
    ctx.fillRect(0,0,w,h);

    if(p.dawnA>.001){
      const dawn=ctx.createLinearGradient(0,0,w*.88,h*.75);
      dawn.addColorStop(0,rgba(255,160,87,p.dawnA));
      dawn.addColorStop(.45,rgba(255,205,140,p.dawnA*.48));
      dawn.addColorStop(1,'rgba(255,218,174,0)');
      ctx.fillStyle=dawn;ctx.fillRect(0,0,w,h);
    }
    if(p.duskA>.001){
      const dusk=ctx.createLinearGradient(w,0,w*.12,h*.76);
      dusk.addColorStop(0,rgba(255,137,73,p.duskA));
      dusk.addColorStop(.48,rgba(247,177,111,p.duskA*.48));
      dusk.addColorStop(1,'rgba(247,198,144,0)');
      ctx.fillStyle=dusk;ctx.fillRect(0,0,w,h);
    }
    if(p.nightA>.001){
      const night=ctx.createLinearGradient(0,0,0,h);
      night.addColorStop(0,rgba(9,21,43,p.nightA));
      night.addColorStop(.55,rgba(12,19,37,p.nightA*.88));
      night.addColorStop(1,rgba(4,9,22,p.nightA));
      ctx.fillStyle=night;ctx.fillRect(0,0,w,h);
    }
    ctx.restore();
  }
  window.ConquerAmbientLight=Object.freeze({profileAt,draw,isTransitioning});
})();
