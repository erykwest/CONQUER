'use strict';
// DEV mixer controls, fully decoupled from the engine.
(() => {
 const api=window.ConquerSound,panel=document.getElementById('devSound');
 if(!api||!panel)return;
 const enable=panel.querySelector('#soundEnable'),master=panel.querySelector('#soundMaster');
 const rows=[...panel.querySelectorAll('[data-sound-layer]')];
 const bridge=window.ConquerSoundBridge;
 const zoomOn=panel.querySelector('#soundZoomOn'),zoomOff=panel.querySelector('#soundZoomOff');
 const normalize=panel.querySelector('#soundNormalize');
 const eqPanels=[...panel.querySelectorAll('[data-sound-eq]')];
 for(const details of eqPanels){
  const layer=details.dataset.soundEq;
  for(const [band,label] of [['low','Bassi'],['mid','Medi'],['high','Alti']]){
   const wrapper=document.createElement('label');
   wrapper.className='sound-eq-band';wrapper.textContent=label;
   const input=document.createElement('input');
   input.type='range';input.min='-12';input.max='12';input.step='1';input.value='0';
   input.dataset.band=band;input.setAttribute('aria-label',label+' '+layer);
   const output=document.createElement('output');output.textContent='0 dB';
   wrapper.append(input,output);details.append(wrapper);
   input.addEventListener('input',e=>{
    api.setEq(layer,band,Number(e.target.value));
    output.textContent=(Number(e.target.value)>0?'+':'')+e.target.value+' dB';
   });
  }
  const reset=document.createElement('button');reset.type='button';reset.className='sound-eq-reset';
  reset.textContent='EQ flat (0 dB)';
  reset.addEventListener('click',()=>{api.resetEq(layer);update()});
  details.append(reset);
 }
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
  normalize.checked=s.normalize;
  if(bridge){
   const thresholds=bridge.getZoom();
   zoomOn.value=Math.round(thresholds.on*100);zoomOff.value=Math.round(thresholds.off*100);
   panel.querySelector('#soundZoomOnValue').textContent=zoomOn.value+'%';
   panel.querySelector('#soundZoomOffValue').textContent=zoomOff.value+'%';
  }
  for(const details of eqPanels){
   for(const input of details.querySelectorAll('[data-band]')){
    const db=s.eq[details.dataset.soundEq][input.dataset.band];
    input.value=db;
    input.nextElementSibling.textContent=(db>0?'+':'')+db+' dB';
   }
  }
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
 normalize.addEventListener('change',e=>{api.setNormalization(e.target.checked);update()});
 if(bridge){
  zoomOn.addEventListener('input',e=>{
   const on=+e.target.value/100,off=Math.min(bridge.getZoom().off,on-.01);
   bridge.setZoom(on,off);update();
  });
  zoomOff.addEventListener('input',e=>{
   const off=Math.min(+e.target.value/100,bridge.getZoom().on-.01);
   bridge.setZoom(bridge.getZoom().on,off);update();
  });
 }
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
