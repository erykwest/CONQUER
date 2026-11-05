'use strict';
// Same-origin modal reader. Reads the selected structure; never changes gameplay state.
(function(){
  let dialog,frame,originFocus;
  const copy=x=>JSON.parse(JSON.stringify(x));
  function idForStructure(s){
    if(!s)return null;
    let id;
    if(s.type==='quarry'&&s.extractionMode==='clay')id='building:clay-quarry';
    else if(s.type==='pier'&&s.yard)id='building:shipyard.'+s.yard;
    else if(s.type==='eventVenue')id='building:venue.'+s.venue;
    else if(s.type==='civicAnnex'){
      const parent=State.structures.find(p=>p.id===s.parentId);id=parent?'sub-building:'+parent.type+'.'+s.annexType:null;
    }else id='building:'+s.type;
    return id&&window.ConquerGameCodex.get(id)?id:null;
  }
  function toolId(){
    const t=State.tool||{};
    if(t.kind==='terraform')return'building:terraforming.'+(t.mode||'terrain');
    if(t.kind==='crossing')return'building:'+(['dry','water'].includes(t.crossing)?'moat':'bridge');
    if(t.kind==='event')return'building:venue.'+t.venue;
    if(t.kind==='industry')return idForStructure(t.placementSpec||{type:t.industry});
    if(t.kind==='linear')return'building:'+(['builtWide','longhouse','longhouseWide'].includes(t.linear)?'built':t.linear);
    return idForStructure(t.placementSpec||{type:t.kind});
  }
  function context(){
    const selected=typeof selectedStructure==='function'?selectedStructure():null;
    if(!selected)return{};
    const structure=copy(selected);
    const slots=functionCapacity(structure);
    return{structure:copy(structure),roomSlots:Array.from({length:slots},(_,index)=>({index,floor:functionSlotFloor(structure,index)}))};
  }
  function close(){if(dialog?.open)dialog.close()}
  function open(id='home'){
    originFocus=document.activeElement;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='codex-dialog';dialog.setAttribute('aria-label','CONQUER Codex');
      const header=document.createElement('div');header.className='codex-dialog-bar';
      const label=document.createElement('span');label.textContent='CONQUER · Codex';
      const button=document.createElement('button');button.type='button';button.textContent='Chiudi Codex';button.addEventListener('click',close);
      header.append(label,button);dialog.append(header);document.body.append(dialog);
      dialog.addEventListener('keydown',event=>event.stopPropagation());
      dialog.addEventListener('close',()=>{frame?.remove();frame=null;originFocus?.focus?.()});
    }
    frame?.remove();frame=document.createElement('iframe');frame.title='Enciclopedia CONQUER';
    frame.src='./wiki/?embedded=1#'+encodeURIComponent(id||'home');dialog.append(frame);
    if(!dialog.open)dialog.showModal();
  }
  function currentId(){return idForStructure(typeof selectedStructure==='function'?selectedStructure():null)||toolId()||'home'}
  window.ConquerWikiHost=Object.freeze({open,close,context,idForStructure,openSelection:()=>open(currentId()),openTool:()=>open(toolId()||'home'),href:()=> './wiki/#'+encodeURIComponent(currentId())});
  document.getElementById('codexBtn')?.addEventListener('click',()=>open());
  document.getElementById('profileCodexBtn')?.addEventListener('click',()=>open());
  const legacy=document.createElement('a');legacy.className='codex-legacy-link';legacy.textContent='Voce nel Codex';legacy.href='./wiki/';
  document.querySelector('#builder h2')?.after(legacy);
  legacy.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();open(currentId())});
  window.ConquerGame?.subscribe(()=>{legacy.href=window.ConquerWikiHost.href()});
})();
