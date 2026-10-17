'use strict';
// Civil complex skeleton: owned annexes are separate persisted structures.
// This catalog is deliberately mechanical-only: no jobs, yields, beds or services.
const CIVIC_ANNEX_CATALOG=Object.freeze({
  church:Object.freeze({
    herbGarden:{label:'Herb garden',level:1,w:2,h:2,max:2,kind:'garden'},
    scriptorium:{label:'Scriptorium',level:2,w:2.5,h:2,max:1,kind:'stone'},
    monastery:{label:'Monastery',level:3,w:3,h:2.5,max:1,kind:'stone'},
    cloister:{label:'Cloister',level:3,w:2.5,h:2.5,max:1,kind:'yard'}
  }),
  tavern:Object.freeze({
    storage:{label:'Storehouse',level:1,w:1.5,h:1.5,max:2,kind:'timber'},
    courtyard:{label:'Service courtyard',level:1,w:2,h:2,max:1,kind:'yard'},
    stables:{label:'Stables',level:2,w:2.5,h:2,max:2,kind:'timber'},
    inn:{label:'Guest lodging',level:3,w:3,h:2.5,max:2,kind:'timber'}
  }),
  market:Object.freeze({
    stall:{label:'Market stall',level:1,w:1.25,h:1,max:8,kind:'stall'},
    loggia:{label:'Covered loggia',level:2,w:3,h:1.5,max:2,kind:'timber'},
    warehouse:{label:'Warehouse',level:3,w:2.5,h:2,max:2,kind:'timber'},
    shop:{label:'Shop',level:3,w:1.75,h:1.5,max:4,kind:'timber'}
  })
});
function isCivicAnnex(s){return !!s&&s.type==='civicAnnex'}
function civicAnnexDefinition(s,parent=State.structures.find(p=>p.id===s?.parentId)){
  return parent&&CIVIC_ANNEX_CATALOG[parent.type]?.[s?.annexType]||null;
}
function civicAnnexChildren(parentId){return State.structures.filter(s=>isCivicAnnex(s)&&s.parentId===parentId)}
function makeCivicAnnex(parent,annexType,x,y){
  const spec=CIVIC_ANNEX_CATALOG[parent?.type]?.[annexType];
  if(!spec)return null;
  return{id:uid(),type:'civicAnnex',parentId:parent.id,annexType,x,y,
    angle:parent.angle||0,w:spec.w,h:spec.h,annexVersion:1};
}
function normalizeCivicAnnex(s,parent){
  const spec=civicAnnexDefinition(s,parent);
  if(!spec)return false;
  s.w=spec.w;s.h=spec.h;s.annexVersion=1;
  s.angle=snapStructureAngle(s.angle||0);
  return true;
}
function civicAnnexFootprint(s){
  const spec=civicAnnexDefinition(s);
  return spec?rectWorldPoints(s.x,s.y,spec.w,spec.h,s.angle||0):[];
}
function civicAnnexPlacementCheck(s){
  if(!isCivicAnnex(s))return{ok:true};
  const parent=State.structures.find(p=>p.id===s.parentId);
  const spec=civicAnnexDefinition(s,parent);
  if(!spec||parent?.auto)return{ok:false,reason:'Missing or unsupported civic parent'};
  if(underConstruction(parent))return{ok:false,reason:'Finish the parent building first'};
  if(civicLevel(parent)<spec.level)return{ok:false,reason:'Requires parent L'+spec.level};
  const siblings=civicAnnexChildren(parent.id).filter(c=>c.id!==s.id&&c.annexType===s.annexType);
  if(siblings.length>=spec.max)return{ok:false,reason:'Maximum annex count reached'};
  const footprint=civicAnnexFootprint(s);
  if(footprint.length!==4)return{ok:false,reason:'Invalid annex footprint'};
  if(parent.type==='market'){
    // Public market pieces grow near the square, but never claim a private parcel.
    if(dist(s,parent)>9)return{ok:false,reason:'Market annex must remain within 9U of its square'};
    if(urbanLots().some(lot=>urbanPolygonsOverlap(footprint,lot.points)))
      return{ok:false,reason:'Public market expansion cannot occupy an owned Voronoi lot'};
  }else{
    const lot=urbanLots().find(l=>l.civicId===parent.id);
    if(!lot)return{ok:false,reason:'The parent needs a valid Voronoi lot'};
    if(!footprint.every(p=>urbanContains(lot.points,p,.10)))
      return{ok:false,reason:'Annex must fit entirely within the parent Voronoi lot'};
  }
  return{ok:true};
}
function startCivicAnnexPlacement(parent,annexType){
  const spec=CIVIC_ANNEX_CATALOG[parent?.type]?.[annexType];
  if(!spec)return false;
  if(civicLevel(parent)<spec.level){status('Requires parent L'+spec.level);return false}
  if(civicAnnexChildren(parent.id).filter(s=>s.annexType===annexType).length>=spec.max){
    status('Maximum annex count reached');return false
  }
  setTool({kind:'civicAnnex',parentId:parent.id,annexType,label:'Place '+spec.label+' inside the complex · click to build'});
  return true;
}
