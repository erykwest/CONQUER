'use strict';
// Civil complex skeleton: owned annexes are separate persisted structures.
// This catalog is deliberately mechanical-only: no jobs, yields, beds or services.
const CIVIC_ANNEX_CATALOG=Object.freeze({
  church:Object.freeze({
    cemetery:{label:'Cemetery',level:1,w:2.2,h:2.2,max:1,kind:'cemetery',intrinsic:true},
    herbGarden:{label:'Herb garden',level:1,w:2,h:2,max:2,kind:'garden'},
    scriptorium:{label:'Scriptorium',level:2,w:2.5,h:2,max:1,kind:'stone'},
    monastery:{label:'Monastery',level:3,w:3,h:2.5,max:1,kind:'stone'},
    cloister:{label:'Cloister',level:3,w:2.5,h:2.5,max:1,kind:'yard'}
  }),
  tavern:Object.freeze({
    storage:{label:'Storehouse',level:1,w:1.5,h:1.5,max:2,kind:'timber'},
    courtyard:{label:'Service courtyard',level:1,w:2,h:2,max:1,kind:'yard'},
    stables:{label:'Stables',level:2,w:2.5,h:2,max:2,kind:'timber'},
    brewery:{label:'Brewery extension',level:2,w:2.5,h:2,max:1,kind:'timber'},
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
  if(!spec||spec.intrinsic)return null;
  return{id:uid(),type:'civicAnnex',parentId:parent.id,annexType,x,y,
    angle:parent.angle||0,w:spec.w,h:spec.h,annexVersion:1};
}
function normalizeCivicAnnex(s,parent){
  const spec=civicAnnexDefinition(s,parent);
  if(!spec||spec.intrinsic)return false;
  s.w=spec.w;s.h=spec.h;s.annexVersion=1;
  s.angle=snapStructureAngle(s.angle||0);
  return true;
}
function civicAnnexFootprint(s){
  const spec=civicAnnexDefinition(s);
  return spec?rectWorldPoints(s.x,s.y,spec.w,spec.h,s.angle||0):[];
}
// An L1 church owns an intrinsic cemetery. It is derived from the current
// Voronoi curtilage rather than saved as a removable or separately paid annex.
function civicCemeteryArea(church){
  if(church?.type!=='church'||civicLevel(church)<1)return null;
  const lot=urbanLots().find(l=>l.civicId===church.id);if(!lot)return null;
  const body=civicParts(church).map(p=>p.points),angle=church.angle||0;
  const probes=[[4.5,0],[-4.5,0],[4.5,2.5],[-4.5,2.5],[4.5,-2.5],[-4.5,-2.5],
    [0,5.2],[0,-5.2],[5.2,0],[-5.2,0]];
  // Small lots can fit a shorter burial yard without enlarging the property.
  for(const [w,h] of [[2.2,2.2],[1.65,1.65]]){
    for(const [dx,dy] of probes){
      const center=houseLocalToWorld(church,dx,dy);
      const points=rectWorldPoints(center.x,center.y,w,h,angle);
      if(!points.every(p=>urbanContains(lot.points,p,.09)))continue;
      if(body.some(poly=>urbanPolygonsOverlap(points,poly)))continue;
      return{center,points,w,h,angle,churchId:church.id};
    }
  }
  return null;
}
function civicCemeteryGraves(church){
  const area=civicCemeteryArea(church);if(!area)return[];
  const rows=area.w>2?[-.55,0,.55]:[-.36,.36],result=[];
  for(const x of rows)for(const y of [-.46,.46]){
    const center=houseLocalToWorld({x:area.center.x,y:area.center.y,angle:area.angle},x,y);
    result.push({center,points:rectWorldPoints(center.x,center.y,.30,.65,area.angle),angle:area.angle});
  }
  return result;
}
function civicAnnexPlacementCheck(s){
  if(!isCivicAnnex(s))return{ok:true};
  const parent=State.structures.find(p=>p.id===s.parentId);
  const spec=civicAnnexDefinition(s,parent);
  if(!spec||spec.intrinsic||parent?.auto)return{ok:false,reason:'Missing or unsupported civic parent'};
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
    if(parent.type==='church'){
      const cemetery=civicCemeteryArea(parent);
      if(cemetery&&urbanPolygonsOverlap(footprint,cemetery.points))
        return{ok:false,reason:'The L1 cemetery is reserved within the church lot'};
    }
    if(parent.type==='tavern'&&s.annexType==='brewery'){
      const near=civicParts(parent).some(part=>
        footprint.some(p=>part.points.some((a,i)=>pointSegmentDistance(p,a,part.points[(i+1)%part.points.length])<=.85))||
        part.points.some(p=>footprint.some((a,i)=>pointSegmentDistance(p,a,footprint[(i+1)%footprint.length])<=.85)));
      if(!near)return{ok:false,reason:'The brewery extension must adjoin the tavern'};
    }
  }
  return{ok:true};
}
function startCivicAnnexPlacement(parent,annexType){
  const spec=CIVIC_ANNEX_CATALOG[parent?.type]?.[annexType];
  if(!spec||spec.intrinsic)return false;
  if(civicLevel(parent)<spec.level){status('Requires parent L'+spec.level);return false}
  if(civicAnnexChildren(parent.id).filter(s=>s.annexType===annexType).length>=spec.max){
    status('Maximum annex count reached');return false
  }
  setTool({kind:'civicAnnex',parentId:parent.id,annexType,label:'Place '+spec.label+' inside the complex · click to build'});
  return true;
}
