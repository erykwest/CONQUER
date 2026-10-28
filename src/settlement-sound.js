'use strict';
// Independent four-bus Web Audio sound engine. No simulation/render dependencies.
(() => {
 const layers=Object.freeze(['environment','local','effects','notifications']);
 const storageKey='conquer.sound.mixer.v1';
 const bands=Object.freeze(['low','mid','high']);
 const flat=()=>({low:0,mid:0,high:0});
 const defaults={normalize:true,master:.75,volumes:{environment:.65,local:.75,effects:.8,notifications:.85},
  muted:{environment:false,local:false,effects:false,notifications:false},
  eq:Object.fromEntries(layers.map(layer=>[layer,flat()]))};
 const eqClamp=value=>Math.max(-12,Math.min(12,Number(value)||0));
 const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
 const getPrefs=()=>{
  try {
   const o=JSON.parse(localStorage.getItem(storageKey)||'{}');
   return {normalize:o.normalize!==false,master:clamp(o.master??defaults.master),
    volumes:Object.fromEntries(layers.map(k=>[k,clamp(o.volumes?.[k]??defaults.volumes[k])])),
    muted:Object.fromEntries(layers.map(k=>[k,!!(o.muted?.[k]??defaults.muted[k])])),
    eq:Object.fromEntries(layers.map(layer=>[layer,
     Object.fromEntries(bands.map(band=>[band,eqClamp(o.eq?.[layer]?.[band]??0)]))]))};
  }catch(_){return structuredClone(defaults)}
 };
 const prefs=getPrefs(),catalog=window.ConquerSoundCatalog||{},buffers=new Map(),failed=new Set();
 const desired=new Map(),active=new Map(),pending=new Set();
 let context=null,master=null,buses=null,eqNodes=null,enabled=false,error='',previewVoice=null,previewToken=0;
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(prefs))}catch(_){}};
 function smooth(param,value,seconds=.18){
  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(value,context.currentTime,Math.max(.01,seconds/3));
 }
 function mix(){
  if(!context)return;
  smooth(master.gain,prefs.master);
  for(const k of layers){
   smooth(buses[k].gain,prefs.muted[k]?0:prefs.volumes[k]);
   if(eqNodes)for(const band of bands)smooth(eqNodes[k][band].gain,prefs.eq[k][band],.12);
  }
 }
 function init(){
  if(context)return context;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){error='Web Audio non supportato';return null}
  context=new Context();master=context.createGain();
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-8;compressor.ratio.value=8;
  master.connect(compressor);compressor.connect(context.destination);
  buses={};eqNodes={};
  for(const layer of layers){
   const bus=context.createGain(),low=context.createBiquadFilter(),
    mid=context.createBiquadFilter(),high=context.createBiquadFilter();
   low.type='lowshelf';low.frequency.value=120;
   mid.type='peaking';mid.frequency.value=950;mid.Q.value=.8;
   high.type='highshelf';high.frequency.value=4600;
   bus.connect(low);low.connect(mid);mid.connect(high);high.connect(master);
   buses[layer]=bus;eqNodes[layer]={low,mid,high};
  }
  mix();return context;
 }
 async function buffer(id){
  if(!catalog[id]||failed.has(id))return null;
  if(!buffers.has(id))buffers.set(id,(async()=>{
   try{
    const response=await fetch(catalog[id].url);
    if(!response.ok)throw Error('HTTP '+response.status);
    return await context.decodeAudioData(await response.arrayBuffer());
   }catch(e){
    failed.add(id);error='Asset '+id+' non disponibile';
    console.warn('CONQUER audio asset:',id,e);return null;
   }
  })());
  return buffers.get(id);
 }
 function setTone(voice,tone){
  if(!voice.filter)return;
  const value=clamp(tone);
  smooth(voice.filter.frequency,900+13500*value*value,.25);
 }
 function createVoice(id,buf,layer,volume,loop,tone=1){
  const source=context.createBufferSource(),gain=context.createGain();
  const trim=prefs.normalize?10**((Number(catalog[id]?.gainDb)||0)/20):1;
  const filter=layer==='local'?context.createBiquadFilter():null;
  source.buffer=buf;source.loop=loop;gain.gain.value=0;
  if(filter){
   filter.type='lowpass';filter.Q.value=.707;
   source.connect(filter);filter.connect(gain);
  }else source.connect(gain);
  gain.connect(buses[layer]);source.start();
  smooth(gain.gain,clamp(volume)*trim,.27);
  const voice={source,gain,filter,trim,id};setTone(voice,tone);
  return voice;
 }
 function stopPreview(){
  previewToken++;
  if(!previewVoice)return;
  const voice=previewVoice;previewVoice=null;
  smooth(voice.gain.gain,0,.1);
  try{voice.source.stop(context.currentTime+.15)}catch(_){}
 }
 async function preview(id,layer='effects'){
  if(!enabled||!context||!layers.includes(layer)||!catalog[id])return false;
  stopPreview();
  const token=previewToken;
  const buf=await buffer(id);
  if(!buf||!enabled||token!==previewToken)return false;
  const voice=createVoice(id,buf,layer,.75,!!catalog[id].loop);
  previewVoice={...voice,id,layer};
  voice.source.onended=()=>{
   if(previewVoice?.source===voice.source)previewVoice=null;
   voice.gain.disconnect();
  };
  return true;
 }
 function stopLoop(key){
  const voice=active.get(key);if(!voice)return;
  active.delete(key);smooth(voice.gain.gain,0,.28);
  try{voice.source.stop(context.currentTime+.35)}catch(_){}
 }
 async function startLoop(key){
  if(pending.has(key)||active.has(key)||!enabled)return;
  pending.add(key);
  try{
   const [layer,id]=key.split(':');
   const buf=await buffer(id),cue=desired.get(key);
   if(!buf||!enabled||!cue||active.has(key))return;
   const voice=createVoice(id,buf,layer,cue.volume,true,cue.tone);
   active.set(key,voice);
   voice.source.onended=()=>{if(active.get(key)===voice)active.delete(key);voice.gain.disconnect()};
  }finally{pending.delete(key)}
 }
 function refresh(){
  if(!enabled||!context)return;
  for(const key of [...active.keys()])if(!desired.has(key))stopLoop(key);
  for(const [key,cue] of desired){
   const voice=active.get(key);
   if(voice){
    voice.trim=prefs.normalize?10**((Number(catalog[voice.id]?.gainDb)||0)/20):1;
    smooth(voice.gain.gain,cue.volume*voice.trim,.18);
    setTone(voice,cue.tone);
   }else void startLoop(key);
  }
 }
 function syncScene(scene={}){
  const next=new Map();
  for(const layer of ['environment','local'])for(const cue of scene[layer]||[]){
   if(!catalog[cue?.id]?.loop)continue;
   const volume=clamp(cue.volume??1);
   if(volume>0)next.set(layer+':'+cue.id,{volume,tone:clamp(cue.tone??1)});
  }
  desired.clear();for(const [key,value] of next)desired.set(key,value);
  refresh();
 }
 async function setEnabled(value){
  if(!value){enabled=false;stopPreview();for(const key of [...active.keys()])stopLoop(key);return false}
  const ctx=init();if(!ctx)return false;
  try{
   await ctx.resume();enabled=ctx.state==='running';
   if(!enabled){error='Audio sospeso dal browser';return false}
   error='';refresh();return true;
  }catch(e){error=String(e?.message||e);return false}
 }
 function setMaster(value){prefs.master=clamp(value);mix();persist()}
 function setVolume(layer,value){
  if(!layers.includes(layer))return false;
  prefs.volumes[layer]=clamp(value);mix();persist();return true;
 }
 function setMuted(layer,value){
  if(!layers.includes(layer))return false;
  prefs.muted[layer]=!!value;mix();persist();return true;
 }
 function setNormalization(value){
  prefs.normalize=!!value;persist();refresh();
  if(previewVoice){
   const trim=prefs.normalize?10**((Number(catalog[previewVoice.id]?.gainDb)||0)/20):1;
   previewVoice.trim=trim;smooth(previewVoice.gain.gain,.75*trim,.16);
  }
  return prefs.normalize;
 }
 function setEq(layer,band,db){
  if(!layers.includes(layer)||!bands.includes(band))return false;
  prefs.eq[layer][band]=eqClamp(db);mix();persist();return true;
 }
 function resetEq(layer){
  if(!layers.includes(layer))return false;
  prefs.eq[layer]=flat();mix();persist();return true;
 }
 async function play(id,layer='effects',volume=1){
  if(!enabled||!context||!layers.includes(layer)||!catalog[id])return false;
  const buf=await buffer(id);if(!buf||!enabled)return false;
  const voice=createVoice(id,buf,layer,volume,false);
  voice.source.onended=()=>voice.gain.disconnect();
  return true;
 }
 function testTone(layer='notifications'){
  if(!enabled||!context||!layers.includes(layer))return false;
  const osc=context.createOscillator(),gain=context.createGain(),t=context.currentTime;
  osc.type='sine';osc.frequency.setValueAtTime([180,300,440,660][layers.indexOf(layer)],t);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.13,t+.02);
  gain.gain.exponentialRampToValueAtTime(.001,t+.22);
  osc.connect(gain);gain.connect(buses[layer]);osc.start(t);osc.stop(t+.23);
  osc.onended=()=>gain.disconnect();return true;
 }
 function state(){
  return {enabled,available:!!(window.AudioContext||window.webkitAudioContext),layers:[...layers],
   normalize:prefs.normalize,master:prefs.master,volumes:{...prefs.volumes},muted:{...prefs.muted},
   eq:Object.fromEntries(layers.map(layer=>[layer,{...prefs.eq[layer]}])),
   active:[...active.keys()],preview:previewVoice?.id||null,missing:[...failed],error};
 }
 window.ConquerSound=Object.freeze({layers,setEnabled,setMaster,setVolume,setMuted,setEq,resetEq,setNormalization,
  syncScene,play,preview,stopPreview,testTone,notify:()=>testTone('notifications'),state});
 window.addEventListener('pagehide',()=>{stopPreview();for(const key of [...active.keys()])stopLoop(key)});
})();
