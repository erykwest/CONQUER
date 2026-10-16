'use strict';
// Independent four-bus Web Audio sound engine. No simulation/render dependencies.
(() => {
 const layers=Object.freeze(['environment','local','effects','notifications']);
 const storageKey='conquer.sound.mixer.v1';
 const defaults={master:.75,volumes:{environment:.65,local:.75,effects:.8,notifications:.85},
  muted:{environment:false,local:false,effects:false,notifications:false}};
 const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
 const getPrefs=()=>{
  try {
   const o=JSON.parse(localStorage.getItem(storageKey)||'{}');
   return {master:clamp(o.master??defaults.master),
    volumes:Object.fromEntries(layers.map(k=>[k,clamp(o.volumes?.[k]??defaults.volumes[k])])),
    muted:Object.fromEntries(layers.map(k=>[k,!!(o.muted?.[k]??defaults.muted[k])]))};
  }catch(_){return structuredClone(defaults)}
 };
 const prefs=getPrefs(),catalog=window.ConquerSoundCatalog||{},buffers=new Map(),failed=new Set();
 const desired=new Map(),active=new Map(),pending=new Set();
 let context=null,master=null,buses=null,enabled=false,error='',previewVoice=null,previewToken=0;
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(prefs))}catch(_){}};
 function smooth(param,value,seconds=.18){
  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(value,context.currentTime,Math.max(.01,seconds/3));
 }
 function mix(){
  if(!context)return;
  smooth(master.gain,prefs.master);
  for(const k of layers)smooth(buses[k].gain,prefs.muted[k]?0:prefs.volumes[k]);
 }
 function init(){
  if(context)return context;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context){error='Web Audio non supportato';return null}
  context=new Context();master=context.createGain();
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-8;compressor.ratio.value=8;
  master.connect(compressor);compressor.connect(context.destination);
  buses=Object.fromEntries(layers.map(k=>{const n=context.createGain();n.connect(master);return [k,n]}));
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
 function createVoice(buf,layer,volume,loop){
  const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buf;source.loop=loop;gain.gain.value=0;
  source.connect(gain);gain.connect(buses[layer]);source.start();
  smooth(gain.gain,clamp(volume),.27);
  return {source,gain};
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
  const voice=createVoice(buf,layer,.75,!!catalog[id].loop);
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
   const buf=await buffer(id),volume=desired.get(key);
   if(!buf||!enabled||volume==null||active.has(key))return;
   const voice=createVoice(buf,layer,volume,true);
   active.set(key,voice);
   voice.source.onended=()=>{if(active.get(key)===voice)active.delete(key);voice.gain.disconnect()};
  }finally{pending.delete(key)}
 }
 function refresh(){
  if(!enabled||!context)return;
  for(const key of [...active.keys()])if(!desired.has(key))stopLoop(key);
  for(const [key,value] of desired){
   const voice=active.get(key);
   if(voice)smooth(voice.gain.gain,value,.18);
   else void startLoop(key);
  }
 }
 function syncScene(scene={}){
  const next=new Map();
  for(const layer of ['environment','local'])for(const cue of scene[layer]||[]){
   if(!catalog[cue?.id]?.loop)continue;
   const volume=clamp(cue.volume??1);
   if(volume>0)next.set(layer+':'+cue.id,volume);
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
 async function play(id,layer='effects',volume=1){
  if(!enabled||!context||!layers.includes(layer)||!catalog[id])return false;
  const buf=await buffer(id);if(!buf||!enabled)return false;
  const voice=createVoice(buf,layer,volume,false);
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
   master:prefs.master,volumes:{...prefs.volumes},muted:{...prefs.muted},
   active:[...active.keys()],preview:previewVoice?.id||null,missing:[...failed],error};
 }
 window.ConquerSound=Object.freeze({layers,setEnabled,setMaster,setVolume,setMuted,
  syncScene,play,preview,stopPreview,testTone,notify:()=>testTone('notifications'),state});
 window.addEventListener('pagehide',()=>{stopPreview();for(const key of [...active.keys()])stopLoop(key)});
})();
