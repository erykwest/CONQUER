'use strict';
// L3 workshop cutaway (src/settlement-shop-cutaway.js): a selected L3 house with a workshop
// opens its ground floor. Checked for every trade and camera quarter-turn: nothing stands
// above the floor break (no upper floor, roof or slab), the walls facing the camera are cut to
// the sill, the furniture stays inside the room, the counter takes the half of the facade away
// from the door, walls shared by two bodies of the house are dropped, and the artisan is moved
// to his bench only from his own door, only while the house is open and the shop working.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');

const window={},State={structures:[],selectedId:null,view:{rotation:0},seed:1};
let turn=0;
const rot=p=>turn===1?{x:-p.y,y:p.x}:turn===2?{x:-p.x,y:-p.y}:turn===3?{x:p.y,y:-p.x}:{x:p.x,y:p.y};
const rectWorldPoints=(cx,cy,w,h,a=0)=>{const c=Math.cos(a),s=Math.sin(a);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:cx+x*c-y*s,y:cy+x*s+y*c}))};
const local=(s,x,y)=>{const c=Math.cos(s.angle||0),n=Math.sin(s.angle||0);return{x:s.x+x*c-y*n,y:s.y+x*n+y*c}};
const JETTY=.07;
const body=(s,cx,cy,w,h)=>{const q=local(s,cx,cy);return{kind:'body',center:q,w,h,bodyH:1.37,
  points:rectWorldPoints(q.x,q.y,w,h,s.angle||0),basePoints:rectWorldPoints(q.x,q.y,w,h-2*JETTY,s.angle||0)}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,String,JSON,Float32Array,
  houseLevel:s=>Number(s.houseLevel)||1,underConstruction:s=>!!s.building,terrainElevation:()=>0,
  houseBodyHeight:()=>1.37,houseFloorBreak:h=>h*.475,isPlanView:()=>false,
  viewDepthPoint:p=>{const q=rot(p);return q.x+q.y},rotateViewPoint:p=>rot(p),
  w2s:(p,z=0)=>{const q=rot(p);return{x:(q.x-q.y)*20,y:(q.x+q.y)*10-z*20}},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  pointInPolygon:(p,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c},
  // Main body and, for 'L' houses, an overlapping back wing (settlement-core.js houseFootprintParts).
  houseFootprintParts:s=>[body(s,0,0,1.5,1),...(s.plan==='L'?[body(s,.38*1.5,.56,.55*1.5,.95)]:[])],
  // Door on local -Y (doorSide -1), a quarter of the width off centre (houseDoorInfo).
  houseDoorInfo:s=>{const side=s.doorSide>=0?1:-1,c=Math.cos(s.angle||0),n=Math.sin(s.angle||0);
    const surface=local(s,1.5*.24*(s.doorLeft?-1:1),side*.5),normal={x:-n*side,y:c*side};
    return{surface,normal,tangent:{x:c,y:n},outside:{x:surface.x+normal.x*.28,y:surface.y+normal.y*.28}}}
});
for(const f of ['assets/furniture-model.js','assets/scatter-model.js','settlement-mesh3d.js','settlement-cutaway-furniture.js','settlement-shop-cutaway.js'])
  vm.runInContext(src(f),ctx,{filename:f});
const SC=window.ConquerShopCutaway;
const trades=Object.keys(SC.TRADES);
assert.deepEqual(trades.slice().sort(),Object.keys(SC.LAYOUTS).sort(),'a layout for every trade');
// Same 7 trades as the autonomous urban catalog.
const urban=src('settlement-urban-economy.js');
for(const t of trades)assert.ok(new RegExp('\\b'+t+'\\s*:').test(urban),t+' is an urban workshop trade');

const SILL=.14,TOP=1.37*.475;
const house=o=>({id:'h',type:'house',houseLevel:3,x:50,y:40,angle:.3,doorSide:-1,shopKind:'blacksmith',...o});
const tris=mesh=>{const out=[];for(let t=0;t<mesh.col.length;t++){const o=t*9;out.push({g:mesh.gi[t],v:[0,3,6].map(k=>({x:mesh.pos[o+k],y:mesh.pos[o+k+1],z:mesh.pos[o+k+2]}))})}return out};

// Eligibility: L3, completed, with a workshop; open when selected (or forced by the Asset Lab).
State.structures=[house()];
assert.equal(SC.active(State.structures[0]),false,'not open until selected');
State.selectedId='h';SC.clear();
assert.equal(SC.active(State.structures[0]),true,'the selected L3 workshop opens');
assert.equal(SC.activeId(),'h');
assert.equal(SC.active(house({houseLevel:2})),false,'L2 houses have no workshop');
assert.equal(SC.active(house({shopKind:null})),false,'an L3 house without a workshop stays closed');
assert.equal(SC.active(house({building:true})),false,'not while under construction');
// Without the Lab stand-in the record comes from ConquerCommerce.
window.ConquerCommerce={state:()=>({shops:{h:{kind:'potter',artisanId:'h:m:0',state:'working'}}})};
assert.equal(SC.shopOf(house({shopKind:undefined})).kind,'potter','the commerce record names the trade');
delete window.ConquerCommerce;
console.log('PASS eligibility: L3 + workshop + selection');

let furnished=0;
for(const plan of ['T','L'])for(const doorLeft of [false,true])for(const kind of trades)for(turn=0;turn<4;turn++){
  const h=house({shopKind:kind,plan,doorLeft});State.structures=[h];State.view.rotation=turn;SC.clear();
  const r=SC.build(h),R=r.room,label=kind+' '+plan+(doorLeft?' door-left':'')+' turn '+turn;
  const all=tris(r.mesh);
  // Nothing above the ground floor: upper floor, roof and chimneys are gone.
  const top=Math.max(...all.flatMap(t=>t.v.map(v=>v.z)));
  assert.ok(top<=TOP+1e-6,label+': nothing above the floor break ('+top.toFixed(3)+')');
  // Walls: vertical faces on the outline. Those whose outside faces the camera stop at the sill.
  const outline=R.bodies.flatMap(p=>{const P=p.basePoints;return P.map((a,i)=>({a,b:P[(i+1)%P.length],c:p.center}))});
  let near=0,far=0;
  for(const t of all){
    const [a,b,c]=t.v;
    const nz=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(nz)>1e-6)continue;
    const e=outline.find(e=>t.v.every(v=>Math.abs((e.b.x-e.a.x)*(v.y-e.a.y)-(e.b.y-e.a.y)*(v.x-e.a.x))<1e-6&&
      Math.min(e.a.x,e.b.x)-1e-6<=v.x&&v.x<=Math.max(e.a.x,e.b.x)+1e-6&&Math.min(e.a.y,e.b.y)-1e-6<=v.y&&v.y<=Math.max(e.a.y,e.b.y)+1e-6));
    if(!e)continue;
    const m={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};let nx=-(e.b.y-e.a.y),ny=e.b.x-e.a.x;
    if(nx*(m.x-e.c.x)+ny*(m.y-e.c.y)<0){nx=-nx;ny=-ny}
    const facing=ctx.viewDepthPoint({x:m.x+nx*.01,y:m.y+ny*.01})>ctx.viewDepthPoint(m);
    // Stretch centre in front of the section plane through the room centre.
    const tc={x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3},front=ctx.viewDepthPoint(tc)>ctx.viewDepthPoint(R.c)+.05;
    const h2=Math.max(...t.v.map(v=>v.z));
    if(facing||front){if(facing)near++;assert.ok(h2<=SILL+1e-6,label+': a wall facing the camera or in front of the section is cut to the sill')}
    else{far++;assert.ok(h2>SILL,label+': a far wall behind the section stays up')}
  }
  assert.ok(near>0&&far>0,label+': both near and far walls ('+near+'/'+far+')');
  // Walls shared by the main body and the wing are not drawn: one open ground floor.
  if(plan==='L'){
    const polys=R.bodies.map(p=>p.basePoints);
    const inside=all.filter(t=>Math.max(...t.v.map(v=>v.z))>SILL&&new Set(t.v.map(v=>v.z)).size>1).filter(t=>{
      const m={x:(t.v[0].x+t.v[1].x+t.v[2].x)/3,y:(t.v[0].y+t.v[1].y+t.v[2].y)/3};
      // A wall of one body whose centre lies strictly inside the other body.
      return polys.some((P,k)=>outline.some(e=>e.c===R.bodies[k].center&&
        Math.abs((e.b.x-e.a.x)*(m.y-e.a.y)-(e.b.y-e.a.y)*(m.x-e.a.x))<1e-6)&&polys.some((Q,j)=>j!==k&&ctx.pointInPolygon(m,Q)));
    });
    assert.equal(inside.length,0,label+': no wall of one body inside the other');
  }
  // Furniture (every group above the floor that is not a wall) stays inside the room.
  const loc=v=>({a:(v.x-R.c.x)*R.T.x+(v.y-R.c.y)*R.T.y,b:(v.x-R.c.x)*R.N.x+(v.y-R.c.y)*R.N.y});
  const groups=new Map();for(const t of all){if(!groups.has(t.g))groups.set(t.g,[]);groups.get(t.g).push(t)}
  let pieces=0;
  for(const [g,ts] of groups){
    if(r.mesh.groupBias[g]!==0)continue;   // floor (-1e5) and far walls (-5e4)
    if(ts.every(t=>outline.some(e=>t.v.every(v=>Math.abs((e.b.x-e.a.x)*(v.y-e.a.y)-(e.b.y-e.a.y)*(v.x-e.a.x))<1e-6))))continue;   // near walls
    pieces++;
    for(const t of ts)for(const v of t.v){
      const q=loc(v);
      assert.ok(Math.abs(q.a)<=R.ha+.03&&Math.abs(q.b)<=R.hb+.03,label+': furniture inside the room (a '+q.a.toFixed(2)+' b '+q.b.toFixed(2)+')');
    }
  }
  assert.ok(pieces>=4,label+': counter, goods and the trade\'s furniture ('+pieces+' pieces)');
  furnished++;
  // The artisan's spot is in the room, in front of his station.
  const s=r.spot;assert.ok(Math.abs(s.a)<R.ha&&Math.abs(s.b)<R.hb,label+': artisan spot inside the room');
}
console.log('PASS '+furnished+' rooms (7 trades x 2 plans x 2 door sides x 4 turns): open, cut to the sill, furnished inside');

// The counter takes the facade half away from the door.
for(const doorLeft of [false,true]){
  turn=0;const h=house({doorLeft});State.structures=[h];SC.clear();
  const r=SC.build(h),R=r.room;
  // Furnished groups standing against the street front: the counter and its goods.
  const edges=R.bodies.flatMap(p=>p.basePoints.map((a,i,P)=>[a,P[(i+1)%P.length]]));
  const onOutline=v=>edges.some(([a,b])=>Math.abs((b.x-a.x)*(v.y-a.y)-(b.y-a.y)*(v.x-a.x))<1e-6);
  const wall=new Set();
  for(let t=0;t<r.mesh.col.length;t++){const o=t*9;if([0,3,6].every(k=>onOutline({x:r.mesh.pos[o+k],y:r.mesh.pos[o+k+1]})))wall.add(r.mesh.gi[t])}
  const cs=new Map();for(let t=0;t<r.mesh.col.length;t++){const g=r.mesh.gi[t];if(r.mesh.groupBias[g]!==0||wall.has(g))continue;if(!cs.has(g))cs.set(g,r.mesh.groups[g])}
  const street=[...cs.values()].map(c=>({a:(c[0]-R.c.x)*R.T.x+(c[1]-R.c.y)*R.T.y,b:(c[0]-R.c.x)*R.N.x+(c[1]-R.c.y)*R.N.y,z:c[2]}))
    .filter(q=>q.b<-R.hb+.25&&q.z>.05);
  assert.ok(street.length&&street.every(q=>Math.sign(q.a)===-Math.sign(R.doorA)),'counter on the half away from the door ('+(doorLeft?'left':'right')+' door)');
}
console.log('PASS the counter leaves the door clear');

// The artisan: only the shop's artisan, only from his door, only while open and working.
turn=0;State.view.rotation=0;
const h=house();State.structures=[h];State.selectedId='h';SC.clear();
const door=ctx.houseDoorInfo(h).outside,res=id=>({id});
const at=SC.artisanAt(h,res('h:m:0'),{x:door.x+.1,y:door.y});
assert.ok(at&&ctx.pointInPolygon(at.p,SC.build(h).room.main.basePoints),'the artisan at his door works inside the open shop');
assert.equal(at.tool,'hammer','the blacksmith hammers');
assert.equal(SC.artisanAt(h,res('h:m:1'),door),null,'other residents stay where their routine puts them');
assert.equal(SC.artisanAt(h,res('h:m:0'),{x:door.x+3,y:door.y}),null,'away from his door (market, leisure) he is not moved');
assert.equal(SC.artisanAt(h,res('h:m:0'),null),null,'at home out of hours: nobody');
State.selectedId=null;SC.clear();
assert.equal(SC.artisanAt(h,res('h:m:0'),door),null,'a closed house keeps the routine figure at the door');
State.selectedId='h';
window.ConquerCommerce={state:()=>({shops:{h:{kind:'weaver',artisanId:'h:m:0',state:'closed'}}})};
assert.equal(SC.artisanAt(house({shopKind:undefined}),res('h:m:0'),door),null,'a closed workshop (Sunday) is empty');
window.ConquerCommerce={state:()=>({shops:{h:{kind:'weaver',artisanId:'h:m:0',state:'working'}}})};
const weaver=SC.artisanAt(house({shopKind:undefined}),res('h:m:0'),door);
assert.ok(weaver&&weaver.tool===null,'a weaver works without a striking tool');
console.log('PASS the artisan works inside only when open and at work');

// Wiring: both renderers, facades, occlusion and the population pass use the module.
const has=(f,re,what)=>assert.ok(re.test(src(f)),f+': '+what);
has('settlement-buildings.js',/ConquerShopCutaway\.draw2D\(s\)/,'2.5D draws the section in place of the bodies');
has('settlement-buildings.js',/function drawHouseDoor\(house\)\{\s*if\(window\.ConquerShopCutaway\?\.active\(house\)\)return/,'no door on an open shop');
has('settlement-architecture.js',/ConquerShopCutaway\?\.active\(s\)\)return/,'no facade windows on an open shop');
has('settlement-world3d.js',/ConquerShopCutaway\.addToBuilder\(m\)/,'WebGL cutaway buffer');
has('settlement-world3d.js',/shopCut=window\.ConquerShopCutaway\?\.activeId/,'WebGL rebuilds on selection');
has('settlement-urban.js',/!openIds\.includes\(q\.houseId\)/,'figures are not masked by an open shop');
has('settlement-population-figures.js',/ConquerShopCutaway\?\.artisanAt\(house,resident,p\)/,'population pass');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.ok(html.indexOf('settlement-commerce.js')<html.indexOf('settlement-shop-cutaway.js')&&html.indexOf('settlement-shop-cutaway.js')<html.indexOf('settlement-asset-stage.js'),'script order');
has('settlement-asset-stage.js',/bottega-l3-/,'Asset Lab entries');
console.log('PASS renderer, population and Asset Lab wiring');
