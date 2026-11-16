'use strict';
// Floor-by-floor cutaway: ▲ / ▼ over the selected building whose cutaway is open (a castle
// structure with its cutaway on, or a selected civic building), anchored on top of the floor in
// view like the courier's letter (settlement-diplomacy.js). The arrows run the same command as
// the inspector (StructureCommands.stepCutawayFloor); the floors above the one in view go.
(function(){
  let host=null,up=null,down=null,label=null,shownFor=null;
  function build(){
    const wrap=document.getElementById('wrap');if(!wrap)return false;
    host=document.createElement('div');host.id='cutawayFloorArrows';host.hidden=true;
    host.innerHTML='<button type="button" data-floor-step="1" aria-label="Piano di sopra">▲</button>'+
      '<span></span><button type="button" data-floor-step="-1" aria-label="Piano di sotto">▼</button>';
    [up,label,down]=host.children;
    host.addEventListener('pointerdown',e=>e.stopPropagation());
    host.addEventListener('click',e=>{
      const b=e.target.closest('[data-floor-step]');e.stopPropagation();
      if(b&&shownFor&&typeof StructureCommands!=='undefined')StructureCommands.stepCutawayFloor(shownFor,Number(b.dataset.floorStep));
    });
    wrap.appendChild(host);return true;
  }
  function target(){
    if(typeof State==='undefined'||!State.selectedId||typeof cutawayFloorCount!=='function')return null;
    const s=State.structures.find(o=>o.id===State.selectedId);
    if(!s||underConstruction(s)||!(structureCutaway(s)||civicFloorCutaway(s))||cutawayFloorCount(s)<2)return null;
    return s;
  }
  // Top of the floor in view: the cut of the castle cutaway, the ceiling of the civic storey.
  function anchor(s){
    const c={x:s.x??(s.a.x+s.b.x)/2,y:s.y??(s.a.y+s.b.y)/2};
    const ceiling=civicFloorCutaway(s)?window.ConquerCivic3D.floorSpan(s).ceiling:cutawayCeilingZ(s);
    const top=Math.min(structureHeight(s),ceiling);
    const g=typeof placementGroundZ==='function'&&Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(c);
    return w2s(c,g+top+.25);
  }
  function tick(){
    requestAnimationFrame(tick);
    if(!host&&!build())return;
    const s=target();
    if(!s){if(!host.hidden){host.hidden=true;shownFor=null}return}
    const f=cutawayVisibleFloor(s),n=cutawayFloorCount(s),p=anchor(s);
    shownFor=s.id;host.hidden=false;
    host.style.left=Math.round(p.x)+'px';host.style.top=Math.round(p.y)+'px';
    const text=(f===0?'PT':'P'+f)+' · '+(f+1)+'/'+n;
    if(label.textContent!==text)label.textContent=text;
    up.disabled=f>=n-1;down.disabled=f===0;
  }
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(tick);
})();
