'use strict';
// Adapter from settlement State to the independent audio mixer.
(() => {
 const cues={market:'market',tavern:'tavern',church:'choir',
  loggingCamp:'chopping',quarry:'mining',mine:'mining',training:'training'};
 const prefKey='conquer.sound.zoom.v1';
 let zoomOn=.30,zoomOff=.25,nearbyEnabled=false;
 try{
  const saved=JSON.parse(localStorage.getItem(prefKey)||'{}');
  const on=Number(saved.on),off=Number(saved.off);
  if(Number.isFinite(on)&&on>=.20&&on<=1)zoomOn=on;
  if(Number.isFinite(off)&&off>=.15&&off<zoomOn)zoomOff=off;
 }catch(_){}
 let lastTick=-Infinity,lastThunder=-Infinity;
 function getZoom(){return {on:zoomOn,off:zoomOff,nearbyEnabled}}
 function setZoom(on,off){
  const a=Number(on),b=Number(off);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<.20||a>1||b<.15||b>=a)return false;
  zoomOn=a;zoomOff=b;
  nearbyEnabled=false;
  try{localStorage.setItem(prefKey,JSON.stringify({on:a,off:b}))}catch(_){}
  return true;
 }
 function getPoint(s){
  if(Number.isFinite(s?.x)&&Number.isFinite(s?.y))return s;
  if(s?.a&&s?.b)return {x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
  return null;
 }
 function tick(now,weather){
  if(now-lastTick<350)return;
  lastTick=now;
  window.ConquerMusic?.setSeason(State.season);
  const audio=window.ConquerSound;if(!audio)return;
  const night=typeof nightFactor==='function'&&nightFactor()>.55,weatherNow=weather||currentWeather();
  const environment=[];
  if(State.season==='spring')environment.push({id:'spring',volume:night?.25:.75});
  else if(State.season==='summer'&&!night)environment.push({id:'summer',volume:.65*Math.max(0,1-Math.min(1,weatherNow.rain))});
  // Autumn/night have no unequivocal dedicated sample: do not invent a generic bed.
  if(weatherNow.rain>0)environment.push({id:'rain',volume:Math.min(1,weatherNow.rain*.85)});
  if(weatherNow.wind>.35||State.season==='winter')environment.push({id:'wind',volume:Math.min(.8,.2+weatherNow.wind*.6)});
  const local=[],selected=State.structures.find(s=>s.id===State.selectedId);
  if(selected&&cues[selected.type])local.push({id:cues[selected.type],volume:1,tone:1});
  const zoom=Number(State.view.scale)||0;
  if(!nearbyEnabled&&zoom>=zoomOn)nearbyEnabled=true;
  else if(nearbyEnabled&&zoom<=zoomOff)nearbyEnabled=false;
  if(nearbyEnabled){
   const centre=s2w(canvas.clientWidth/2,canvas.clientHeight/2);
   const radius=10/Math.max(zoom,zoomOn);
   const nearby=State.structures.filter(s=>cues[s.type]&&s.id!==selected?.id)
    .map(s=>({s,p:getPoint(s)})).filter(x=>x.p&&!x.s.construction)
    .map(x=>({...x,d:Math.hypot(x.p.x-centre.x,x.p.y-centre.y)}))
    .filter(x=>x.d<radius).sort((a,b)=>a.d-b.d);
   for(const x of nearby.slice(0,2)){
    const id=cues[x.s.type];
    if(!local.some(v=>v.id===id)){
     const closeness=Math.max(.08,1-x.d/radius);
     local.push({id,volume:Math.max(.1,closeness),tone:closeness});
    }
   }
  }
  audio.syncScene({environment,local});
  if(weatherNow.kind==='storm'&&audio.state().enabled&&now-lastThunder>65000){
   lastThunder=now;void audio.play('thunder','environment',.6);
  }
 }
 window.ConquerSoundBridge=Object.freeze({tick,getZoom,setZoom});
})();
