'use strict';
// Room exterior elements: a room function that changes the outside of its building
// (contract D-ROOM-EXT-01 in docs/context/DECISIONS.md).
//
// ROOM_EXTERIOR[fn] declares the element; roomExteriorElements(s) places one per room that has
// such a function and roomExteriorTriangles(s) turns them into world triangles
// [{pts:[{p,z}x3], hex, key}], z above the ground under each vertex, as pointHoardingTriangles does
// for the tower hoarding. Every renderer reads those triangles:
//   2.5D        drawRoomExteriors (castle body, after the roofs) and the built cutaway
//   castle 3D / World 3D / Asset Lab meshes   bodyMesh() in settlement-castle3d.js
//   World 3D cutaway   the exterior shell of settlement-world3d.js
//   construction site  nothing: rooms are only assigned once the building is finished
//   collapse    roomExteriorCollapseParts(): the element falls with its building, or alone when broken
// Mounts: 'face' (corbelled out of the exterior face of a built section, at the floor of its room)
// is the one implemented; 'roof' and 'eave' are reserved for the dovecote and the cistern.
const ROOM_EXTERIOR=Object.freeze({
  // Garderobe: a stone box on corbels, the chute down the wall. One per room, upper floor only.
  latrine:Object.freeze({model:'garderobe',source:'ConquerGarderobeModels',mount:'face',breakable:Object.freeze({hp:40,material:'stone'})})
});
const ROOM_EXTERIOR_END_CLEAR=.3;          // U kept free at each end of the face (tower snaps, corners)
const ROOM_EXTERIOR_HOARDING_REACH=.5;      // how far a tower/gate hoarding or a wall gallery sticks out

function roomExteriorSpec(fn){return ROOM_EXTERIOR[fn]||null}
function roomExteriorModel(spec){
  const data=spec&&window[spec.source],model=data?.models?.[spec.model];
  return model?{data,model}:null;
}
// Floor z (above the ground) of the room in slot index.
function roomExteriorFloorZ(s,index){
  const floors=typeof cutawayFloorLevels==='function'?cutawayFloorLevels(s):[];
  return floors[index+functionFloorOffset(s)]?.z??null;
}
// Plan footprint of an element: the box out of the face, with a small margin.
function roomExteriorRect(e,margin=.02){
  const h=e.width/2+margin,out=e.projection+margin*2,{anchor:a,tangent:t,normal:n}=e;
  return[
    {x:a.x-t.x*h,y:a.y-t.y*h},{x:a.x+t.x*h,y:a.y+t.y*h},
    {x:a.x+t.x*h+n.x*out,y:a.y+t.y*h+n.y*out},{x:a.x-t.x*h+n.x*out,y:a.y-t.y*h+n.y*out}
  ];
}
// What already takes the outside of a face: other buildings standing higher than the element,
// the hoarding of a tower or gate, the gallery or machicolation of a wall.
function roomExteriorObstacles(s,zBottom){
  const out=[];
  for(const o of State.structures){
    if(o===s||o.id===s.id)continue;
    const fp=footprintPoints(o);
    if(fp?.length>2&&structureHeight(o)>zBottom)out.push(fp);
    if(['tower','gate'].includes(o.type)&&typeof hasPointHoarding==='function'&&hasPointHoarding(o)){
      for(const b of pointHoardingBays(o)){
        const r=ROOM_EXTERIOR_HOARDING_REACH;
        out.push([b.p0,b.p1,{x:b.p1.x+b.n1.x*r,y:b.p1.y+b.n1.y*r},{x:b.p0.x+b.n0.x*r,y:b.p0.y+b.n0.y*r}]);
      }
    }
    if(o.type==='wall'&&['hoarding','machicolation'].includes(wallSkin(o))){
      const g=wallExteriorLayout(o),k=g.side,w0=g.width/2,w1=w0+ROOM_EXTERIOR_HOARDING_REACH;
      const off=(p,w)=>({x:p.x+g.nx*w*k,y:p.y+g.ny*w*k});
      out.push([off(o.a,w0),off(o.b,w0),off(o.b,w1),off(o.a,w1)]);
    }
  }
  return out;
}
function roomExteriorClear(e,obstacles){
  const r=roomExteriorRect(e),c={x:(r[0].x+r[2].x)/2,y:(r[0].y+r[2].y)/2};
  const samples=[...r,c,{x:(r[2].x+r[3].x)/2,y:(r[2].y+r[3].y)/2}];
  return !obstacles.some(poly=>samples.some(p=>pointInPolygon(p,poly)));
}
// Where the element of function fn would go in room index of s, or null when it does not fit.
// 'face': the exterior face of a built section (wallExteriorSide, the "Exterior side / windows"
// control), centred on one arrow-slit cell of that floor (the slit gives way to it), the cell
// nearest the middle first, clear of the face ends and of anything already outside.
function roomExteriorPlacement(s,index,fn){
  const spec=roomExteriorSpec(fn),m=roomExteriorModel(spec);
  if(!spec||!m||!s||underConstruction(s))return null;
  if(spec.mount!=='face'||s.type!=='built')return null;
  const z=roomExteriorFloorZ(s,index);if(!Number.isFinite(z))return null;
  const side=wallExteriorSide(s),edge=linearFacadeEdge(s,side),L=edge.length;
  let t={x:(edge.b.x-edge.a.x)/(L||1),y:(edge.b.y-edge.a.y)/(L||1)},n={x:-t.y*side,y:t.x*side};
  if(t.x*n.y-t.y*n.x<0)t={x:-t.x,y:-t.y};                 // model +x, +y out, +z up stay right-handed
  const mid={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
  const W=m.model.width,P=m.model.projection,lim=L/2-ROOM_EXTERIOR_END_CLEAR-W/2;
  if(lim<0)return null;
  const count=builtWindowCount(edge,.72,0,.23),cell=L/count;
  const offs=Array.from({length:count},(_,i)=>(i+.5)*cell-L/2).filter(o=>Math.abs(o)<=lim+1e-6);
  if(!offs.length)offs.push(0);
  offs.sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b);
  const obstacles=roomExteriorObstacles(s,z+m.model.bottom);
  // The face direction from the facade edge: off is measured along edge.a -> edge.b.
  const along={x:(edge.b.x-edge.a.x)/(L||1),y:(edge.b.y-edge.a.y)/(L||1)};
  for(const off of offs){
    const e={fn,index,spec,side,off,z,width:W,projection:P,tangent:t,normal:n,
      anchor:{x:mid.x+along.x*off,y:mid.y+along.y*off}};
    if(roomExteriorClear(e,obstacles))return e;
  }
  return null;
}
// Placed elements of a structure (rooms whose function has an exterior element and fits).
// Broken ones are left out unless asked for.
function roomExteriorElements(s,{broken=false}={}){
  if(!s||!Array.isArray(s.functions)||underConstruction(s))return[];
  const out=[];
  s.functions.forEach((fn,i)=>{
    if(!roomExteriorSpec(fn))return;
    const e=roomExteriorPlacement(s,i,fn);if(!e)return;
    e.broken=roomExteriorBroken(s,i);
    if(broken||!e.broken)out.push(e);
  });
  return out;
}
function roomExteriorBroken(s,index){return Number(s?.roomExteriorHp?.[index])<=0}
// World triangles of the intact elements of s. The chute (modelled 0..-1) is stretched from the
// slab down to the ground under the face.
function roomExteriorTriangles(s,elements=roomExteriorElements(s)){
  const out=[];
  for(const e of elements){
    const m=roomExteriorModel(e.spec);if(!m)continue;
    const {data,model}=m,pal=data.palette,keys=data.paletteKeys,top=e.z+model.chuteTop;
    const color=ci=>keys[ci].startsWith('roof')&&keys[ci]!=='roofUnder'?winterSnowColor(pal[ci],ci%2?WINTER_SNOW_A:WINTER_SNOW_B):pal[ci];
    const at=(x,y)=>({x:e.anchor.x+e.tangent.x*x+e.normal.x*y,y:e.anchor.y+e.tangent.y*x+e.normal.y*y});
    for(const [name,part] of Object.entries(model.parts)){
      const chute=name==='chute',p=part.p,ix=part.i;
      for(let k=0;k<part.c.length;k++){
        const pts=[0,1,2].map(j=>{const v=ix[k*3+j]*3;return{p:at(p[v],p[v+1]),z:chute?top+p[v+2]*top:e.z+p[v+2]}});
        out.push({pts,hex:color(part.c[k]),key:keys[part.c[k]],part:name});
      }
    }
  }
  return out;
}
// 2.5D: the same triangles, painted far to near, back faces skipped (as drawPointHoarding).
function drawRoomExterior(s){
  const elements=roomExteriorElements(s);if(!elements.length)return;
  const tris=roomExteriorTriangles(s,elements),top=Math.max(...elements.map(e=>e.z+.75));
  const depth=t=>t.pts.reduce((a,q)=>a+viewDepthPoint(q.p)+ISO_Z*q.z,0)/3;
  withStructureDetailOcclusion(s,top,()=>{
    for(const {t} of tris.map(t=>({t,d:depth(t)})).sort((a,b)=>a.d-b.d)){
      const [a,b,c]=t.pts.map(q=>w2s(q.p,q.z));
      // The stain is a flat decal on the wall: drawn whatever its winding.
      if(t.part!=='chute'&&(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)continue;
      pathPolygon([a,b,c],t.hex,t.hex,.6);
    }
  });
}
function drawRoomExteriors(){
  const items=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s)&&!structureCutaway(s)&&s.functions?.some(roomExteriorSpec))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of items)withStructureVisualMaterial(s,()=>drawRoomExterior(s));
}
// Facade rows ask this before drawing a window: the element takes the cell it is centred on.
function roomExteriorTakesWindow(s,side,z,off){
  if(!s?.functions?.some(roomExteriorSpec))return false;
  return roomExteriorElements(s,{broken:true}).some(e=>e.side===side&&Math.abs(e.off-off)<e.width/2+.05&&z>e.z-.2&&z<e.z+1.1);
}
// Element hit by an impact point (artillery), within reach of its box.
function roomExteriorAt(s,p,reach=.45){
  let best=null,bd=Infinity;
  for(const e of roomExteriorElements(s)){
    if(!e.spec.breakable)continue;
    const c={x:e.anchor.x+e.normal.x*e.projection/2,y:e.anchor.y+e.normal.y*e.projection/2},d=Math.hypot(p.x-c.x,p.y-c.y);
    if(d<=reach&&d<bd){bd=d;best=e}
  }
  return best;
}
function roomExteriorHp(s,e){
  const max=e.spec.breakable?.hp||0;if(!s.roomExteriorHp)s.roomExteriorHp={};
  if(!Number.isFinite(Number(s.roomExteriorHp[e.index])))s.roomExteriorHp[e.index]=max;
  return{hp:Number(s.roomExteriorHp[e.index]),max};
}
// Collapse footprint and heights of an element: [{parts:[poly], z0, z1, material}].
function roomExteriorCollapseParts(e){
  const m=roomExteriorModel(e.spec)?.model;if(!m)return null;
  return{parts:[roomExteriorRect(e,0)],z0:e.z+m.bottom,z1:e.z+.72,material:e.spec.breakable?.material||'stone'};
}
// The room is repaired with a new box: full health, drawn again.
function restoreRoomExterior(s,index){
  if(!s?.roomExteriorHp||!(index in s.roomExteriorHp))return false;
  delete s.roomExteriorHp[index];
  if(!Object.keys(s.roomExteriorHp).length)delete s.roomExteriorHp;
  return true;
}
window.ConquerRoomExterior={ROOM_EXTERIOR,spec:roomExteriorSpec,placement:roomExteriorPlacement,elements:roomExteriorElements,
  triangles:roomExteriorTriangles,draw:drawRoomExterior,drawAll:drawRoomExteriors,takesWindow:roomExteriorTakesWindow,
  at:roomExteriorAt,hp:roomExteriorHp,broken:roomExteriorBroken,collapseParts:roomExteriorCollapseParts,repair:restoreRoomExterior};
