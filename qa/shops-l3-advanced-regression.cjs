'use strict';
// SHOP-L3-ADV (D-SHOP-L3-261119): a merchant L3 house runs an advanced workshop staffed by the
// second adult of the nearest L2 households. Two hands: 2.5x a home shop; one: 1x; none: shut.
// Takings pay the hands' wage first (L2 wallet), the rest is the L3 owner's margin (L3 wallet).
// The cutaway opens on the L3 house; the hired hands stand at the bench and at the street counter.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');

const window={},State={structures:[],selectedId:null,view:{rotation:0},seed:7,village:{founded:true,wellId:'well'},clock:{day:22}};
const rectWorldPoints=(cx,cy,w,h,a=0)=>{const c=Math.cos(a),s=Math.sin(a);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:cx+x*c-y*s,y:cy+x*s+y*c}))};
const local=(s,x,y)=>{const c=Math.cos(s.angle||0),n=Math.sin(s.angle||0);return{x:s.x+x*c-y*n,y:s.y+x*n+y*c}};
const body=(s,cx,cy,w,h)=>{const q=local(s,cx,cy);return{kind:'body',center:q,w,h,bodyH:1.37,
  points:rectWorldPoints(q.x,q.y,w,h,s.angle||0),basePoints:rectWorldPoints(q.x,q.y,w,h-.14,s.angle||0)}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,Float32Array,
  houseLevel:s=>Number(s.houseLevel)||1,underConstruction:s=>!!s.building,terrainElevation:()=>0,
  houseBodyHeight:()=>1.37,houseFloorBreak:h=>h*.475,isPlanView:()=>false,
  viewDepthPoint:p=>p.x+p.y,rotateViewPoint:p=>p,w2s:(p,z=0)=>({x:(p.x-p.y)*20,y:(p.x+p.y)*10-z*20}),
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  pointInPolygon:(p,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c},
  houseFootprintParts:s=>[body(s,0,0,1.5,1)],
  houseDoorInfo:s=>{const side=s.doorSide>=0?1:-1,c=Math.cos(s.angle||0),n=Math.sin(s.angle||0);
    const surface=local(s,1.5*.24,side*.5),normal={x:-n*side,y:c*side};
    return{surface,normal,tangent:{x:c,y:n},outside:{x:surface.x+normal.x*.28,y:surface.y+normal.y*.28}}}
});
for(const f of ['settlement-util.js','settlement-social-classes.js','settlement-urban-economy.js','settlement-market-economy.js','settlement-commerce.js',
  'assets/furniture-model.js','assets/scatter-model.js','settlement-mesh3d.js','settlement-cutaway-furniture.js','settlement-shop-cutaway.js'])
  vm.runInContext(src(f),ctx,{filename:f});
const C=window.ConquerCommerce,SC=window.ConquerShopCutaway;
let econ;
function world(structures){
  econ={wallet:{L1:500,L2:0,L3:0,L4:500},wage:{L1:1,L2:2,L3:3}};
  window.ConquerEconomy={state:()=>econ,population:()=>({L1:30,L2:30,L3:0,L4:10})};
  State.structures=structures;State.selectedId=null;SC.clear();
}
const house=(id,tier,x,y,o={})=>({id,type:'house',houseLevel:tier,socialTier:tier,x,y,angle:0,doorSide:-1,...o});
const shops=()=>econ.commerce.shops;
// Economy calendar: day 22 is a workday (dow 1), day 26 Saturday (dow 5), day 27 Sunday.

// ---------- staffing: the second adult of the nearest L2 households
world([house('m',3,50,50),house('far',2,70,50),house('near',2,52,50),house('mid',2,56,50)]);
assert.equal(C.registerShop('m','blacksmith'),false,'a home shop is L2 only');
assert.equal(C.registerAdvancedShop('near','blacksmith'),false,'an advanced workshop is L3 only');
assert.equal(C.registerAdvancedShop('m','blacksmith'),true,'a merchant L3 house opens an advanced workshop');
assert.equal(C.registerShop('far','blacksmith'),true,'a home blacksmith on another L2 house');
assert.deepEqual([...shops().m.workers],['near:m:1','mid:m:1'],'the two nearest L2 households lend their second adult');
assert.equal(shops().m.grade,'advanced');assert.equal(shops().m.ownerTier,3);
assert.equal(C.hireOf('near:m:1').structure.id,'m');assert.equal(C.hireOf('near:m:0'),null,'the first adult keeps his own shop');
console.log('PASS staffing: nearest L2 households, second adult only');

// ---------- output: 2.5x with two hands, wages owed per worker-day
C.daily(22);
assert.equal(shops().m.state,'working','the advanced workshop works on a workday');
assert.equal(shops().m.produced,2.5,'two hands make 2.5x a home shop');
for(const id of ['near','mid','far'])assert.equal(shops()[id]?.produced,1,id+': the home shops keep making 1x');
assert.equal(shops().m.wagesDue,.2,'two hands are owed the L2 monthly wage over 20 shifts each');
console.log('PASS output: 2.5x with two hands, home shops unchanged, wages accrue');

// ---------- Saturday: wages first, the rest is the L3 owner's margin; no coin created
for(const d of [23,24,25])C.daily(d);
const before={...econ.wallet};
C.daily(26);
const m=shops().m,gained=k=>Math.round((econ.wallet[k]-before[k])*1000)/1000;
assert.ok(m.revenue>0,'the advanced workshop sells');
assert.equal(m.wagesPaid,.8,'four days of wages for two hands are paid');
assert.equal(m.wagesDue,0);
// Coins taken by the advanced workshop (revenue also counts the market-day visitors index).
const share=m.margin+m.wagesPaid;assert.ok(m.margin>m.wagesPaid&&m.wagesPaid>0,'wages first, the rest is margin');
assert.ok(Math.abs(gained('L3')-m.margin)<.01,'the margin goes to the L3 wallet (no L3 buyers here)');
const spent=['L1','L2','L3','L4'].reduce((n,k)=>n+gained(k),0);
assert.ok(Math.abs(spent)<.02,'what households pay is what workshops take (no coin created)');
// The advanced workshop earns in proportion to its output among makers of the same good:
// both got the same visitors index, so the revenue gap is share x (1 - 1/2.5).
assert.ok(Math.abs((m.revenue-shops().far.revenue)-share*(1-1/2.5))<.02,'takings split by output: 2.5x a home shop');
C.daily(27);assert.equal(shops().m.state,'closed','Sunday rest');
console.log('PASS takings: wages to L2, margin to L3, split by output, no coin created');

// ---------- short of hands: 1x with one, shut with none
world([house('m',3,50,50),house('only',2,52,50)]);
C.registerAdvancedShop('m','weaver');
assert.deepEqual([...shops().m.workers],['only:m:1']);
assert.equal(C.outputFactor(shops().m),1,'one hand: 1x');
C.daily(22);assert.equal(shops().m.produced,1,'one hand makes 1x');
State.structures=State.structures.filter(s=>s.id!=='only');C.sync();
assert.deepEqual([...shops().m.workers],[],'a hand whose household is gone leaves');
C.daily(23);
assert.equal(shops().m.produced,1,'no hands: no production');
assert.equal(shops().m.state,'vacant','no hands: the workshop stands vacant');
State.structures.push(house('new',2,51,50));C.daily(24);
assert.deepEqual([...shops().m.workers],['new:m:1'],'a new L2 household is hired the next day');
console.log('PASS short of hands: 1x with one, vacant with none, refilled');

// ---------- autonomous spawn on merchant houses only; promotion of a home shop
world([house('m',3,50,50),house('a',2,52,50),house('b',2,54,50)]);
C.daily(22);
assert.equal(shops().m?.grade,'advanced','a merchant L3 house opens an advanced workshop on a workday');
assert.equal(shops().m.workers.length,2);
// With a town hall and no market the educated households are scribes, magistrates, administrators.
world([house('s',3,50,50),house('a',2,52,50),{id:'th',type:'townhall',x:40,y:40}]);
C.daily(22);
assert.equal(shops().s,undefined,'scribes and magistrates run no workshop');
assert.equal(C.registerAdvancedShop('s','potter'),false);
// A home shop whose house becomes a merchant L3 house grows into an advanced workshop.
world([house('a',2,50,50),house('b',2,52,50),house('c',2,54,50)]);
C.registerShop('a','potter');
State.structures[0].houseLevel=3;State.structures[0].socialTier=3;C.daily(22);
assert.equal(shops().a.grade,'advanced','promoted to L3: the home shop becomes an advanced workshop');
assert.equal(shops().a.kind,'potter','it keeps its trade');
assert.equal(shops().a.workers.length,2,'and hires two hands');
console.log('PASS spawn on merchant L3 houses only; a promoted home shop grows');

// ---------- cutaway: the L3 house opens, the hands stand at the bench and the counter
world([house('m',3,50,50),house('a',2,52,50),house('b',2,54,50)]);
C.registerAdvancedShop('m','blacksmith');C.daily(22);
const M=State.structures[0];
assert.equal(SC.eligible(M),true,'the advanced workshop is a cutaway workshop');
assert.equal(SC.eligible(house('x',3,0,0,{shopKind:undefined})),false,'an L3 house without one is not');
assert.ok(SC.buildFront(M)?.open,'its street front opens by day');
State.selectedId='m';SC.clear();
const door=ctx.houseDoorInfo(M).outside;
const [w0,w1]=shops().m.workers;
const bench=SC.artisanAt(State.structures[1],{id:w0},door),counter=SC.artisanAt(State.structures[2],{id:w1},door);
assert.ok(bench&&bench.tool==='hammer','the first hand works at the bench');
assert.ok(counter&&counter.tool===null,'the second serves at the street counter');
const R=SC.room(M),loc=p=>({a:(p.x-R.c.x)*R.T.x+(p.y-R.c.y)*R.T.y,b:(p.x-R.c.x)*R.N.x+(p.y-R.c.y)*R.N.y});
const q=loc(counter.p);
assert.ok(Math.abs(q.a)<R.ha&&q.b<0&&q.b>-R.hb,'the counter spot is inside, on the street half');
assert.ok(Math.sign(q.a)===-Math.sign(R.doorA),'on the counter side, away from the door');
assert.equal(SC.artisanAt(State.structures[1],{id:w0},{x:door.x+3,y:door.y}),null,'away from the workshop door: not moved');
assert.equal(SC.artisanAt(State.structures[1],{id:'a:m:0'},door),null,'other residents are not moved');
// Asset Lab stand-in: an L3 house with shopKind stages the advanced workshop.
assert.equal(SC.shopOf(house('lab',3,0,0,{shopKind:'tailor'})).grade,'advanced');
assert.equal(SC.eligible(house('lab',3,0,0,{shopKind:'tailor'})),true);
assert.equal(SC.eligible(house('lab',2,0,0,{shopKind:'tailor'})),true);
console.log('PASS cutaway: L3 advanced workshop opens, bench and counter hands');

// ---------- wiring: commute, inspector, Lab
const has=(f,re,what)=>assert.ok(re.test(src(f)),f+': '+what);
has('settlement-population-residents.js',/ConquerShopCutaway\?\.hireOf\?\.\(resident\.id\)/,'hired hands are looked up per resident');
has('settlement-population-routines.js',/function artisanPosition\(house,day,hiredAt=null\)/,'the commute goes to the hiring workshop');
has('settlement-app-rooms.js',/Bottega avanzata L3/,'inspector on the L3 house');
has('settlement-app-rooms.js',/data-hired-at/,'inspector on the lending L2 house');
has('settlement-asset-stage.js',/Botteghe avanzate L3/,'Asset Lab family');
console.log('PASS wiring: commute, inspector, Asset Lab');
