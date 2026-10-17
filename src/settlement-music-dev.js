'use strict';
(() => {
 const api=window.ConquerMusic,panel=document.getElementById('devSound');if(!api||!panel)return;
 const get=id=>panel.querySelector('#'+id);
 const labels={spring:'Primavera',summer:'Estate',autumn:'Autunno',winter:'Inverno'};
 const eqContainer=get('musicEq');
 for(const [band,label] of [['low','Bassi'],['mid','Medi'],['high','Alti']]){
  const holder=document.createElement('label');holder.className='sound-eq-band';
  const name=document.createElement('span');name.textContent=label;
  const range=document.createElement('input');range.type='range';range.min=-12;range.max=12;range.step=1;
  range.dataset.musicBand=band;range.setAttribute('aria-label','EQ musica: '+label);
  const output=document.createElement('output');output.textContent='0 dB';
  range.addEventListener('input',()=>{api.setEq(band,Number(range.value));output.textContent=(+range.value>0?'+':'')+range.value+' dB'});
  holder.append(name,range,output);eqContainer.append(holder);
 }
 get('musicEqReset').addEventListener('click',()=>{api.resetEq();update()});
 for(const clip of api.catalog){
  const option=document.createElement('option');option.value=clip.id;
  option.textContent=labels[clip.season]+' · '+clip.file;get('musicTrack').append(option);
 }
 function update(){
  const s=api.state();get('musicEnable').textContent=s.enabled?'♫ Musica ON':'♫ Musica OFF';
  get('musicVolume').value=Math.round(s.volume*100);get('musicVolumeValue').textContent=get('musicVolume').value+'%';
  get('musicAuto').checked=s.automatic;get('musicNormalize').checked=s.normalize;
  for(const input of eqContainer.querySelectorAll('[data-music-band]')){
   const db=s.eq[input.dataset.musicBand];input.value=db;
   input.nextElementSibling.textContent=(db>0?'+':'')+db+' dB';
  }
  get('musicReadout').textContent=s.error||('Stagione: '+s.season+' · Brano: '+(s.track||'nessuno'));
 }
 get('musicEnable').addEventListener('click',async()=>{await api.setEnabled(!api.state().enabled);update()});
 get('musicVolume').addEventListener('input',e=>{api.setVolume(+e.target.value/100);update()});
 get('musicAuto').addEventListener('change',e=>{api.setAutomatic(e.target.checked);update()});
 get('musicNormalize').addEventListener('change',e=>{api.setNormalize(e.target.checked);update()});
 get('musicListen').addEventListener('click',async()=>{
  if(!api.state().enabled)await api.setEnabled(true);
  api.setAutomatic(false);await api.select(get('musicTrack').value);update();
 });
 get('musicNext').addEventListener('click',async()=>{if(!api.state().enabled)await api.setEnabled(true);else await api.next();update()});
 get('musicStop').addEventListener('click',()=>{awaitOff();update()});
 function awaitOff(){void api.setEnabled(false)}
 window.setInterval(update,1200);update();
})();
