'use strict';
// Keyboard shortcuts and application bootstrap. Extracted verbatim from settlement-app.js.
window.addEventListener('keydown',e=>{
  const tag=e.target?.tagName?.toLowerCase(),typing=tag==='input'||tag==='select'||tag==='textarea'||e.target?.isContentEditable;
  if(typing)return;
  const k=e.key.toLowerCase();
  if(e.code==='Space'){e.preventDefault();togglePause();return}
  if(k==='q'){e.preventDefault();rotateCamera(-1);return}
  if(k==='e'){e.preventDefault();rotateCamera(1);return}
  const panStep=e.shiftKey?72:36;
  if(k==='w'){e.preventDefault();panCamera(0,panStep);return}
  if(k==='s'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();panCamera(0,-panStep);return}
  if(k==='a'){e.preventDefault();panCamera(panStep,0);return}
  if(k==='d'){e.preventDefault();panCamera(-panStep,0);return}
  if(e.key==='Escape'){if(document.getElementById('foundVillageModal').classList.contains('open')){document.getElementById('cancelVillageBtn').click();return}State.draft=null;State.selectedId=null;renderFunctionPanel();setTool({kind:'select',label:'Select'});draw();return}
  if(e.key==='Delete'&&State.selectedId){deleteStructure(State.selectedId);return}
  if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();saveCloud()}
});
window.addEventListener('polygon-clipping-ready',()=>{invalidateSceneCache(['ground','castleBody']);draw()});
window.addEventListener('resize',resize);loadLocal();window.ConquerEconomy?.bind();if(ensureStaticLandscape())saveLocal();ensureBorderEntrySelection();renderUI();resize();fit();initSupabase();

