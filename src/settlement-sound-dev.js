'use strict';
// DEV mixer controls, fully decoupled from the engine.
(() => {
 const api=window.ConquerSound,panel=document.getElementById('devSound');
 if(!api||!panel)return;
 const enable=panel.querySelector('#soundEnable'),master=panel.querySelector('#soundMaster');
 const rows=[...panel.querySelectorAll('[data-sound-layer]')];
 function update(){
  const s=api.state();enable.textContent=s.enabled?'🔊 Audio ON':'🔇 Audio OFF';
  enable.classList.toggle('active',s.enabled);
  master.value=Math.round(s.master*100);
  panel.querySelector('#soundMasterValue').textContent=master.value+'%';
  for(const row of rows){
   const layer=row.dataset.soundLayer,slider=row.querySelector('input');
   const mute=row.querySelector('button');
   slider.value=Math.round(s.volumes[layer]*100);
   row.querySelector('output').textContent=slider.value+'%';
   mute.textContent=s.muted[layer]?'Muto':'On';
   mute.classList.toggle('active',s.muted[layer]);
   mute.setAttribute('aria-pressed',String(s.muted[layer]));
  }
  panel.querySelector('#soundReadout').textContent=!s.available?'Web Audio non supportato':
   !s.enabled?'Audio OFF · attivalo manualmente':
   s.error||('Loop: '+s.active.length+' · file mancanti: '+s.missing.length);
 }
 enable.addEventListener('click',async()=>{await api.setEnabled(!api.state().enabled);update()});
 master.addEventListener('input',e=>{api.setMaster(+e.target.value/100);update()});
 for(const row of rows){
  const layer=row.dataset.soundLayer;
  row.querySelector('input').addEventListener('input',e=>{api.setVolume(layer,+e.target.value/100);update()});
  row.querySelector('button').addEventListener('click',()=>{api.setMuted(layer,!api.state().muted[layer]);update()});
  row.querySelector('[data-sound-test]').addEventListener('click',async()=>{
   if(!api.state().enabled)await api.setEnabled(true);
   api.testTone(layer);update();
  });
 }
 window.setInterval(update,1200);update();
})();
