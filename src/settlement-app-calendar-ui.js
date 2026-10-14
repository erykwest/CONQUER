'use strict';
// Calendar UI, weather controls and new map lifecycle. Extracted verbatim from settlement-app.js.
const CALENDAR_MONTHS=[
  {name:'Gen',days:31},{name:'Feb',days:28},{name:'Mar',days:31},{name:'Apr',days:30},
  {name:'Mag',days:31},{name:'Giu',days:30},{name:'Lug',days:31},{name:'Ago',days:31},
  {name:'Set',days:30},{name:'Ott',days:31},{name:'Nov',days:30},{name:'Dic',days:31}
];
const CALENDAR_EPOCH_DAY_OF_YEAR=151; // Day 0 = 1 June, Year 1.
function calendarDateFromDay(day=State.clock.day){
  const absolute=Math.max(0,Math.floor(Number(day)||0))+CALENDAR_EPOCH_DAY_OF_YEAR;
  const year=Math.floor(absolute/365)+1;
  let dayOfYear=absolute%365,month=0;
  while(month<CALENDAR_MONTHS.length-1&&dayOfYear>=CALENDAR_MONTHS[month].days){
    dayOfYear-=CALENDAR_MONTHS[month].days;
    month++;
  }
  return{year,month,day:dayOfYear+1,name:CALENDAR_MONTHS[month].name};
}
function seasonForMonth(month){
  if(month===11||month<=1)return'winter';
  if(month<=4)return'spring';
  if(month<=7)return'summer';
  return'autumn';
}
function syncSeasonToCalendar(){
  const next=State.seasonOverride||seasonForMonth(calendarDateFromDay().month);
  if(State.season===next)return false;
  State.season=next;
  document.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('active',b.dataset.season===State.seasonOverride));
  invalidateSceneCache();
  return true;
}
function syncDevButtons(){
  document.querySelectorAll('[data-season]').forEach(b=>b.classList.toggle('active',b.dataset.season===State.seasonOverride));
  document.querySelectorAll('[data-light-override]').forEach(b=>b.classList.toggle('active',b.dataset.lightOverride===State.daylightOverride));
  document.querySelectorAll('[data-weather-override]').forEach(b=>b.classList.toggle('active',b.dataset.weatherOverride===State.weatherOverride));
  const cutawayAll=document.getElementById('devCutawayAll');
  if(cutawayAll){
    const eligible=State.structures.filter(cutawayEligible);
    const allOn=eligible.length>0&&eligible.every(structureCutaway);
    cutawayAll.classList.toggle('active',allOn);
    cutawayAll.textContent=allOn?'Cutaway ALL ✓':'Cutaway ALL';
    cutawayAll.disabled=!eligible.length;
  }
}
function renderUI(){syncSeasonToCalendar();const cal=calendarDateFromDay();document.getElementById('seedLabel').textContent=State.seed;document.getElementById('villageLabel').textContent=State.village.name||'—';document.getElementById('biomeLabel').textContent=BIOMES[State.biome]?.label||State.biome;document.getElementById('biomeSelect').value=State.biome;document.getElementById('dayLabel').textContent=`${['Lun','Mar','Mer','Gio','Ven','Sab · Mercato','Dom · Riposo'][window.ConquerEconomy?.weekday(State.clock.day)??0]} · ${cal.day} ${cal.name} · Y${cal.year} · Day ${State.clock.day.toFixed(1)}`;syncDevButtons();const icons={gold:'🪙',population:'👥',food:'🌾',wood:'🪵',stone:'🪨',metal:'⛓',equipment:'⚔'};document.getElementById('resources').innerHTML=Object.entries(State.resources).map(([k,v])=>`<span class="res">${icons[k]||''} ${k} <b>${v}</b></span>`).join('');window.ConquerEconomy?.render()}
function visibleCanvasCenter(){
  const r=canvas.getBoundingClientRect();
  return{x:r.width/2,y:r.height/2};
}
function rotateCamera(delta){
  const pivot=visibleCanvasCenter(),anchor=s2w(pivot.x,pivot.y);
  State.view.rotation=((State.view.rotation||0)+delta+4)%4;
  const after=w2s(anchor);
  State.view.x+=pivot.x-after.x;State.view.y+=pivot.y-after.y;
  State.draft=null;invalidateSceneCache();saveLocal();draw();status('View rotation: '+(State.view.rotation*90)+'°');
}
function panCamera(dx,dy){
  State.view.x+=dx;State.view.y+=dy;invalidateSceneCache();saveLocal();draw();
}
function setTimeSpeed(speed){
  speed=Number(speed)||0;
  const wasRunning=State.clock.speed>0;
  if(speed>0)State.clock.lastSpeed=speed;
  else if(State.clock.speed>0)State.clock.lastSpeed=State.clock.speed;
  State.clock.speed=speed;

  // Restart the discrete simulation clock from the exact current day when
  // leaving pause. Otherwise a stale logic cursor could rescan a large time span.
  if(speed>0&&!wasRunning){
    simLogicDay=State.clock.day;
    simLogicAt=performance.now();
    simDrawAt=0;
  }

  document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',Number(x.dataset.speed)===speed));
  status(speed===0?'Time paused':`Time ×${speed}`);
}
function togglePause(){
  if(State.clock.speed>0)setTimeSpeed(0);
  else setTimeSpeed(State.clock.lastSpeed||1);
}
function setLightOverride(mode){
  State.daylightOverride=State.daylightOverride===mode?null:mode;
  syncDevButtons();
  status(State.daylightOverride?('FORCE LIGHT: '+State.daylightOverride):'Luce: procedurale');
  draw();
}
function setWeatherOverride(kind){
  if(!['sun','rain','snow','storm','wind','fog'].includes(kind))return;
  State.weatherOverride=State.weatherOverride===kind?null:kind;
  weatherCacheKey='';weatherCacheValue=null;cloudLayerKey='';puddleCacheKey='';
  syncDevButtons();
  invalidateSceneCache('ground');
  draw();
  status(State.weatherOverride?('FORCE METEO: '+State.weatherOverride):'Meteo: procedurale');
  drawWeatherOverlay();
}
function toggleAllCutaways(){
  const eligible=State.structures.filter(cutawayEligible);
  if(!eligible.length){status('No cutaway-eligible structures');syncDevButtons();return}
  const enable=!eligible.every(structureCutaway);
  for(const s of eligible)s.cutaway=enable;
  markDirty(false,['castleBody','castleFront']);
  renderFunctionPanel();syncDevButtons();draw();
  status(enable?('CUTAWAY ALL: '+eligible.length+' structures'):'CUTAWAY ALL: off');
}
function setSeason(season){
  if(!['summer','autumn','winter','spring'].includes(season))return;
  const labels={summer:'Estate',autumn:'Autunno',winter:'Inverno',spring:'Primavera'};
  State.seasonOverride=State.seasonOverride===season?null:season;
  State.season=State.seasonOverride||seasonForMonth(calendarDateFromDay().month);
  syncDevButtons();
  weatherCacheKey='';weatherCacheValue=null;cloudLayerKey='';puddleCacheKey='';
  invalidateSceneCache();saveLocal();draw();
  drawWeatherOverlay();
  status(State.seasonOverride?'FORCE SEASON: '+labels[State.seasonOverride]+' — clicca di nuovo per tornare al calendario':'Stagione: calendario automatico');
}
function ensureDevControls(){
  document.querySelectorAll('[data-season]').forEach(b=>b.onclick=()=>setSeason(b.dataset.season));
  document.querySelectorAll('[data-light-override]').forEach(b=>b.onclick=()=>setLightOverride(b.dataset.lightOverride));
  document.querySelectorAll('[data-weather-override]').forEach(b=>b.onclick=()=>setWeatherOverride(b.dataset.weatherOverride));
  const cutawayAll=document.getElementById('devCutawayAll');
  if(cutawayAll)cutawayAll.onclick=toggleAllCutaways;
  const toggle=document.getElementById('devToggle'),panel=document.getElementById('devPanel');
  if(toggle&&panel)toggle.onclick=()=>{
    const open=panel.hidden;
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'DEV ▴':'DEV ▾';
  };
  syncDevButtons();
}
function freshLandscapeSeed(){
  if(window.crypto?.getRandomValues){
    const n=new Uint32Array(1);crypto.getRandomValues(n);
    return Math.max(1,n[0]&0x7fffffff);
  }
  return Math.max(1,Math.floor(Math.random()*2147483647));
}
function generateNewMap(){
  // New maps inherit the same visible DEV reference settings.
  State.seasonOverride='summer';State.season='summer';
  State.weatherOverride='sun';State.daylightOverride='day';
  weatherCacheKey='';weatherCacheValue=null;cloudLayerKey='';puddleCacheKey='';
  window.ConquerSnowTracks?.reset();
  State.clock.speed=0;
  State.clock.day=0;
  State.draft=null;State.selectedId=null;
  State.seed=freshLandscapeSeed();
  State.heraldry=null;
  window.__conquerHeraldry?.reset();
  localStorage.setItem('conquer.seed.0.0',String(State.seed));

  // True new-map reset: nothing from the previous settlement survives.
  State.relief=null;
  State.environment=[];
  State.structures=[];
  window.ConquerEconomy?.reset();
  window.ConquerSiege?.restore(null);
  State.combat=null;
  window.ConquerCombat?.restore(null);
  State.pendingWellId=null;
  State.selectedId=null;
  State.draft=null;
  State.village={
    name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,
    growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null
  };
  peasantPathCache.clear();
  peasantPathSignature='';
  fieldWorkAssignmentCache={key:null,map:new Map()};

  clearReliefBandCache();
  generateRelief();
  generateEnvironment();
  invalidateNavigation(false);
  invalidateSceneCache();
  saveLocal();
  markDirty();
  renderUI();
  renderFunctionPanel();
  draw();

  const stats=State.relief?.stats||reliefStats();
  const pct=n=>Math.round((Number(n)||0)*100);
  const steepLevels=[1,2,3,4,5]
    .filter(h=>stats.steepByLevel?.[h])
    .map(h=>`H${h} ${pct(stats.steepByLevel[h].ratio)}%`)
    .join(' · ');
  const l1Gap=stats.minL1Gap==null?'—':Number(stats.minL1Gap).toFixed(1)+'U';
  status(`Nuova mappa · seed ${State.seed} · colline ${pct(stats.coverage)}% · ${steepLevels} · multi ${pct(stats.multiRatio)}% · edge max ${Number(stats.maxEdge||0).toFixed(1)}U · L1 gap ${l1Gap}`);
}
document.getElementById('newMapBtn').onclick=generateNewMap;
document.getElementById('rotateLeft').onclick=()=>rotateCamera(-1);
document.getElementById('rotateRight').onclick=()=>rotateCamera(1);
document.getElementById('biomeSelect').onchange=e=>{
  State.biome=BIOMES[e.target.value]?e.target.value:'plains';State.environment=[];generateEnvironment();
  State.structures=State.structures.filter(s=>!s.auto);
  if(State.village.founded){State.village.growthStep=0;State.village.nextGrowthDay=State.clock.day+.75;State.village.roadPlan=null;State.village.baseRoadAngle=null}
  markDirty(true,'all');renderUI();status('Biome: '+BIOMES[State.biome].label+' — automatic settlement growth reset');draw();
};
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>setTimeSpeed(Number(b.dataset.speed)));
ensureDevControls();
document.getElementById('analyticsExportBtn')?.addEventListener('click',()=>window.__conquerAnalytics?.exportJson());
document.getElementById('analyticsClearBtn')?.addEventListener('click',()=>window.__conquerAnalytics?.clear());
let simLast=performance.now(),simPersistAt=performance.now(),simDrawAt=0,simMaintenanceAt=0,simUiAt=0,simLogicAt=0,simLogicDay=State.clock.day,weatherDrawAt=0,weatherLayerActive=false,lastWorldWeatherKey='',lastShadowPhaseKey=null;
