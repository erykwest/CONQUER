'use strict';
/* Separate streamed soundtrack bus. The four-layer effects mixer remains independent. */
(() => {
 const tracks=window.ConquerMusicCatalog||[],lookup=new Map(tracks.map(x=>[x.id,x]));
 const storageKey='conquer.music.v1',clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
 let prefs={volume:.4,normalize:true,automatic:true,eq:{low:0,mid:0,high:0}};
 try{prefs={...prefs,...JSON.parse(localStorage.getItem(storageKey)||'{}')}}catch(_){}
 prefs.volume=clamp(prefs.volume);
 const bands=['low','mid','high'],eqClamp=x=>Math.max(-12,Math.min(12,Number(x)||0));
 prefs.eq=Object.fromEntries(bands.map(b=>[b,eqClamp(prefs.eq?.[b])]));

 let enabled=false,season='spring',ctx=null,master=null,eqNodes=null,front=null,back=null,fadeTimer=null,sequence=0,last=null,error='';
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(prefs))}catch(_){}};
 const state=()=>({enabled,volume:prefs.volume,normalize:prefs.normalize,automatic:prefs.automatic,season,
  eq:{...prefs.eq},track:back?.track.id||front?.track.id||null,error,tracks:tracks.length});
 function init(){
  if(ctx)return true;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC||!window.Audio){error='Audio musicale non supportato';return false}
  ctx=new AC();master=ctx.createGain();master.gain.value=prefs.volume;
  const compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-7;compressor.ratio.value=6;
  const low=ctx.createBiquadFilter(),mid=ctx.createBiquadFilter(),high=ctx.createBiquadFilter();
  low.type='lowshelf';low.frequency.value=120;
  mid.type='peaking';mid.frequency.value=950;mid.Q.value=.8;
  high.type='highshelf';high.frequency.value=4600;
  master.connect(low);low.connect(mid);mid.connect(high);high.connect(compressor);
  compressor.connect(ctx.destination);
  eqNodes={low,mid,high};
  for(const b of bands)eqNodes[b].gain.value=prefs.eq[b];
  return true;
 }
 function factor(track){return prefs.normalize?Math.pow(10,track.gainDb/20):1}
 function level(deck,v){if(deck)deck.gain.gain.value=Math.max(0,Math.min(1.5,v*factor(deck.track)))}
 function clear(deck){if(!deck)return;deck.audio.pause();deck.audio.removeAttribute('src');deck.audio.load();deck.gain.disconnect()}
 function cancelFade(){if(fadeTimer!==null){clearInterval(fadeTimer);fadeTimer=null}}
 function choose(){
  const available=tracks.filter(t=>t.season===season);
  const options=available.filter(t=>t.id!==last),pool=options.length?options:available;
  return pool[Math.floor(Math.random()*pool.length)]||null;
 }
 async function select(id,fadeSeconds=5){
  const track=lookup.get(id);if(!enabled||!track||!init())return false;
  const token=++sequence;cancelFade();clear(back);back=null;
  if(front?.track.id===id){level(front,1);return true}
  try{await ctx.resume()}catch(e){error=String(e);return false}
  if(token!==sequence||!enabled)return false;
  const audio=new window.Audio(track.url),source=ctx.createMediaElementSource(audio),gain=ctx.createGain();
  gain.gain.value=0;source.connect(gain);gain.connect(master);
  const deck={audio,gain,track};back=deck;
  audio.preload='auto';
  audio.onended=()=>{if(front===deck){clear(deck);front=null;if(enabled&&prefs.automatic)void next()}};
  audio.onerror=()=>{error='MP3 non disponibile: '+track.file;if(back===deck)back=null;if(front===deck)front=null;clear(deck)};
  try{await audio.play()}catch(e){error='Riproduzione fallita: '+String(e?.message||e);if(back===deck)back=null;clear(deck);return false}
  if(token!==sequence||!enabled){clear(deck);return false}
  error='';last=id;
  const old=front,duration=Math.max(0,fadeSeconds)*1000;
  if(!old||duration===0){level(deck,1);front=deck;back=null;clear(old);return true}
  const start=Date.now();
  fadeTimer=setInterval(()=>{
   if(token!==sequence){cancelFade();return}
   const t=Math.min(1,(Date.now()-start)/duration);
   level(deck,Math.sin(t*Math.PI/2));level(old,Math.cos(t*Math.PI/2));
   if(t>=1){cancelFade();front=deck;back=null;clear(old)}
  },80);
  return true;
 }
 function next(){const t=choose();return t?select(t.id):Promise.resolve(false)}
 function stop(){sequence++;cancelFade();clear(back);clear(front);back=null;front=null}
 async function setEnabled(v){enabled=!!v;if(!enabled){stop();return false}if(front||back)return true;return next()}
 function setVolume(v){prefs.volume=clamp(v);if(master)master.gain.value=prefs.volume;save()}
 function setAutomatic(v){prefs.automatic=!!v;save()}
 function setNormalize(v){prefs.normalize=!!v;level(front,1);if(back)level(back,1);save()}
 function setEq(band,db){
  if(!bands.includes(band))return false;
  prefs.eq[band]=eqClamp(db);
  if(eqNodes)eqNodes[band].gain.value=prefs.eq[band];
  save();return true;
 }
 function resetEq(){
  for(const b of bands){prefs.eq[b]=0;if(eqNodes)eqNodes[b].gain.value=0}
  save();return true;
 }
 function setSeason(v){if(!['spring','summer','autumn','winter'].includes(v)||v===season)return;season=v;
  if(enabled&&prefs.automatic&&front?.track.season!==season)void next()}
 window.ConquerMusic=Object.freeze({catalog:tracks,state,select,next,stop,setEnabled,setVolume,setAutomatic,setNormalize,setEq,resetEq,setSeason});
 window.addEventListener('pagehide',stop);
})();
