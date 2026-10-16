'use strict';
// DEV mixer controls, fully decoupled from the engine.
(() => {
 const api=window.ConquerSound,panel=document.getElementById('devSound');
 if(!api||!panel)return;
 const enable=panel.querySelector('#soundEnable'),master=panel.querySelector('#soundMaster');
 const rows=[...panel.querySelectorAll('[data-sound-layer]')];
 const previewClip=panel.querySelector('#soundPreviewClip');
 const previewPlay=panel.querySelector('#soundPreviewPlay');
 const previewStop=panel.querySelector('#soundPreviewStop');
 const previewLayers={spring:'environment',summer:'environment',wind:'environment',rain:'environment',
  thunder:'environment',market:'local',tavern:'local',choir:'local',bells:'local',
  chopping:'local',mining:'local',pickaxe:'effects',marching:'local',training:'local'};
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
   s.error||('Loop: '+s.active.length+' · Preview: '+(s.preview||'—')+' · file mancanti: '+s.missing.length);
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
 previewPlay.addEventListener('click',async()=>{
  if(!api.state().enabled)await api.setEnabled(true);
  const id=previewClip.value;
  if(window.ConquerSoundCatalog?.[id])await api.preview(id,previewLayers[id]||'effects');
  update();
 });
 previewStop.addEventListener('click',()=>{api.stopPreview();update()});
 window.setInterval(update,1200);update();
})();
