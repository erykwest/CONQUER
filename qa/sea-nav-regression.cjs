'use strict';
// Sea navigation: routes stay on water with room for the hull (around a headland and a pier,
// wider berth for a wider hull), and a ship under way waits when its hull would run into
// another ship ahead, then goes on when the way is clear.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// Sea to the south of y=100 with a long headland (land) from x=90 to 110 down to y=140.
const pts=[{x:0,y:100},{x:90,y:100},{x:90,y:140},{x:110,y:140},{x:110,y:100},{x:200,y:100},{x:200,y:200},{x:0,y:200}];
const sea={type:'sea',side:'south',points:pts,coastline:pts.slice(0,6)};
const pier={id:'p',type:'pier',x:60,y:100,angle:Math.PI/2,reach:12};
const window={},State={structures:[pier],environment:[sea]};
const pierPoly=[{x:59.25,y:98.5},{x:60.75,y:98.5},{x:60.75,y:112},{x:59.25,y:112}];
window.ConquerPier={footprint:()=>pierPoly};
const ships=[];
const hull=(key,p,pad=0)=>{const c=Math.cos(p.heading||0),s=Math.sin(p.heading||0),hl=3+pad,hb=1+pad;return[[hl,hb],[-hl,hb],[-hl,-hb],[hl,-hb]].map(([x,y])=>({x:p.x+x*c-y*s,y:p.y+x*s+y*c}))};
const overlap=(A,B)=>{for(const poly of [A,B])for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],nx=-(b.y-a.y),ny=b.x-a.x,pa=A.map(p=>p.x*nx+p.y*ny),pb=B.map(p=>p.x*nx+p.y*ny);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false}return true};
window.ConquerFleet={ships,hull,overlap};
window.ConquerShips={model:k=>k==='nave'?{L:7.4,B:2.3}:{L:6,B:2}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,WORLD:200,Uint8Array,Float32Array,Int32Array});
vm.runInContext(read('src/settlement-sea-nav.js'),ctx);
const N=window.ConquerSeaNav;
const inLand=p=>(p.y<100)||(p.x>90&&p.x<110&&p.y<140);

const r=N.route({x:70,y:110},{x:130,y:110},2);
assert.ok(r&&r.length>2,'a route around the headland');
for(let i=1;i<r.length;i++)for(let k=0;k<=20;k++){const t=k/20,p={x:r[i-1].x+(r[i].x-r[i-1].x)*t,y:r[i-1].y+(r[i].y-r[i-1].y)*t};assert.ok(!inLand(p),'never over land')}
assert.ok(r.some(p=>p.y>141),'it goes round the end of the headland');
const r2=N.route({x:50,y:105},{x:70,y:105},2);
assert.ok(r2.some(p=>p.y>112),'round the head of the pier, not through it');
assert.ok(N.clearAt({x:60,y:150})>N.clearAt({x:60,y:103}),'more room in open water than by the shore');
console.log('PASS sea routes: around headland and pier, on water only, clearance');

// Two ships on the same line: the follower waits behind the one ahead, then goes on.
const a={id:'ship-1',key:'cocca',pose:{x:40,y:160,heading:0},away:true,nav:null};
const b={id:'ship-2',key:'cocca',pose:{x:30,y:160,heading:0},away:true,nav:null};
ships.push(a,b);
let waited=false;
for(let k=0;k<40;k++){N.drive(b,{x:80,y:160},.1,ships);if(b.nav.wait>0)waited=true}
assert.ok(waited,'the ship behind waits for the one ahead');
for(let k=0;k<400;k++){N.drive(a,{x:150,y:160},.1,ships);N.drive(b,{x:80,y:160},.1,ships)}
assert.ok(Math.hypot(b.pose.x-80,b.pose.y-160)<.5,'then it goes on to its goal');
assert.equal(N.drive({id:'x',key:'cocca',pose:{x:100,y:120,heading:0}},{x:130,y:150},.1,ships),'stuck','no route from land');
console.log('PASS sea driving: give way, then go on; stuck on land');
