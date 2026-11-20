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
function bootConquer(selection=null){
  const guest=selection?.guest===true;
  if(guest){
    const id=String(selection.slot||'');
    if(!/^[a-z0-9-]{12,60}$/i.test(id))throw new Error('Invalid guest save slot');
    window.__CONQUER_GUEST_SLOT__=id;
    State.user=null;
    if(selection.mode==='resume')loadLocal();
    else if(selection.mode==='new'){
      const seed=Number(selection.seed);
      if(!Number.isInteger(seed)||seed<1||seed>2147483647)throw new Error('Invalid world seed');
      if(!['plains','hills','forest','swamp'].includes(selection.biome))throw new Error('Unsupported biome');
      State.loadFailed=false;
      State.seed=seed;
      State.biome=selection.biome;
      State.stonePaletteId=window.ConquerStoneColor?.randomForSeed(seed)||'gray';
      State.neighborBiomes={};
      State.heraldry=null;State.economy=null;State.diplomacy=null;State.combat=null;
      State.structures=[];State.environment=[];State.relief=null;
      State.village={...State.village,name:null,founded:false,wellId:null,growthStep:0,nextGrowthDay:null,roadPlan:null};
      State.resources={...PROVISIONAL_RESOURCES};
      State.clock.day=.5;State.clock.speed=0; // Start the public Builder in daylight (12:00) rather than midnight.
    }else throw new Error('Invalid guest start mode');
  }else loadLocal();
  window.ConquerEconomy?.bind();
  if(guest&&selection.mode==='resume'&&State.loadFailed)return false;
  const landscapeBuilt=ensureStaticLandscape();
  const persisted=landscapeBuilt||guest&&selection.mode==='new'?saveLocal():true;
  if(guest&&persisted===false)return false; // Do not dismiss the splash when browser storage is full.
  ensureBorderEntrySelection();renderUI();resize();fit();
  if(!guest)initSupabase(); // Guest is always local singleplayer, never cloud or multiplayer.
  if(window.ConquerGameEntry?.requested){
    let exit=document.getElementById('conquerExitToSite');
    if(!exit){
      exit=document.createElement('button');
      exit.type='button';
      exit.id='conquerExitToSite';
      exit.textContent='Back to website';
      exit.setAttribute('aria-label','Save progress and return to the CONQUER website');
      document.body.appendChild(exit);
    }
    exit.onclick=async()=>{
      if(saveLocal()===false){alert('Your world could not be saved. Check storage and try again before leaving.');return;}
      if(!guest&&State.user){
        try{await saveCloud()}catch(error){console.warn('Exit cloud save failed',error)}
        if(document.getElementById('saveState')?.textContent==='cloud error'){
          alert('Cloud save is unavailable. A local copy was saved, but please retry syncing before leaving.');
          return;
        }
      }
      location.assign('./gamesite/play.html');
    };
  }
  return true;
}
window.addEventListener('resize',resize);
if(window.ConquerGameEntry?.requested)window.ConquerGameEntry.mount(bootConquer);
else bootConquer();


