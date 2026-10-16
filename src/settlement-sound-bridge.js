'use strict';
// Adapter from settlement State to the independent audio mixer.
(() => {
 const cues={market:'market',tavern:'tavern',church:'choir',
  loggingCamp:'chopping',quarry:'mining',mine:'mining',training:'training'};
 let lastTick=-Infinity,lastThunder=-Infinity;
 function getPoint(s){
  if(Number.isFinite(s?.x)&&Number.isFinite(s?.y))return s;
  if(s?.a&&s?.b)return {x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
  return null;
 }
 function tick(now,weather){
  if(now-lastTick<350)return;
  lastTick=now;
  const audio=window.ConquerSound;if(!audio)return;
  const night=typeof nightFactor==='function'&&nightFactor()>.55,weatherNow=weather||currentWeather();
  const environment=[];
  if(State.season==='spring')environment.push({id:'spring',volume:night?.25:.75});
  else if(State.season==='summer'&&!night)environment.push({id:'summer',volume:.65*Math.max(0,1-Math.min(1,weatherNow.rain))});
  // Autumn/night have no unequivocal dedicated sample: do not invent a generic bed.
  if(weatherNow.rain>0)environment.push({id:'rain',volume:Math.min(1,weatherNow.rain*.85)});
  if(weatherNow.wind>.35||State.season==='winter')environment.push({id:'wind',volume:Math.min(.8,.2+weatherNow.wind*.6)});
  const local=[],selected=State.structures.find(s=>s.id===State.selectedId);
  if(selected&&cues[selected.type])local.push({id:cues[selected.type],volume:1});
  const zoom=Number(State.view.scale)||0;
  if(zoom>=.30){
   const centre=s2w(canvas.clientWidth/2,canvas.clientHeight/2);
   const radius=10/Math.max(zoom,.30);
   const nearby=State.structures.filter(s=>cues[s.type]&&s.id!==selected?.id)
    .map(s=>({s,p:getPoint(s)})).filter(x=>x.p&&!x.s.construction)
    .map(x=>({...x,d:Math.hypot(x.p.x-centre.x,x.p.y-centre.y)}))
    .filter(x=>x.d<radius).sort((a,b)=>a.d-b.d);
   for(const x of nearby.slice(0,2)){
    const id=cues[x.s.type];
    if(!local.some(v=>v.id===id))local.push({id,volume:Math.max(.1,1-x.d/radius)});
   }
  }
  audio.syncScene({environment,local});
  if(weatherNow.kind==='storm'&&audio.state().enabled&&now-lastThunder>65000){
   lastThunder=now;void audio.play('thunder','environment',.6);
  }
 }
 window.ConquerSoundBridge=Object.freeze({tick});
})();
