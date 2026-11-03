'use strict';
// CONQUER's presentation-only levels of detail. World coordinates, entity IDs,
// collision and simulation are deliberately unaffected by this module.
window.ConquerLOD=Object.freeze({
  militaryTier(scale=State.view.scale){
    // A soldier narrower than ~2px should not require a multi-part figure.
    return (Number(scale)||0)<.38?'dot':'figure';
  },
  buildingTier(context='world',scale=State.view.scale){
    return context==='minimap'||(Number(scale)||0)<.30?'block':'full';
  },
  militaryColor(type,liveryOverride=null){
    if(liveryOverride)return '#e56d61';
    if(type==='knight')return '#ffd37a';
    if(type==='archer')return '#9ec9dd';
    return '#cbd8e7';
  },
  // A semantic footprint for extremely distant views: one rectangle per
  // building, irrespective of facades, annexes, roof geometry or floors.
  buildingGlyph(s){
    if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.y))return null;
    const type=s.type;
    let w=Number(s.w),h=Number(s.h);
    if(!Number.isFinite(w)||w<=0)w=type==='house'?2.25:type==='market'?4:type==='church'?4:type==='tavern'?3:2;
    if(!Number.isFinite(h)||h<=0)h=type==='house'?1.75:type==='market'?3.5:type==='church'?5:type==='tavern'?3:2;
    let fill='#be936e',stroke='#503929';
    if(type==='house'){fill='#c6b08f';stroke='#5d4a39'}
    else if(type==='tower'||type==='gate'){fill='#e8dcc1';stroke='#726d62'}
    else if(type==='well'){fill='#d4b570';stroke='#655039';w=h=1.25}
    else if(type==='market'){fill='#d2a66a'}
    else if(type==='church'){fill='#d7cfb3'}
    else if(type==='training'){fill='#aa815a'}
    return {x:s.x,y:s.y,w:Math.min(12,w),h:Math.min(12,h),fill,stroke,kind:type};
  }
});
