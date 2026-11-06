'use strict';
// Coast: a headland (a coastline vertex jutting out to sea) is rocky, the bays are beach.
// Rocks block units, roads and buildings except a quay; beaches stay buildable. Boulders come
// from the waterside kit (Blender) and stay off the harbour works.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

// Sea to the south, coast at y=150 with a headland at x=100 reaching 6U out to sea.
const coast=[];for(let i=0;i<=14;i++){const x=i/14*200;coast.push({x,y:150+(i===7?6:0)})}
const sea={type:'sea',side:'south',coastline:coast,points:[...coast,{x:200,y:200},{x:0,y:200}]};
const window={},State={seed:3,structures:[],environment:[sea]};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,terrainElevation:()=>0});
// Match the real game: regenerating harbour meshes must reuse the same seeded
// scatter. Math.random() compared two different coasts and made this test flaky.
vm.runInContext(read('src/settlement-landscape.js').split(/\r?\n/).find(line=>line.startsWith('function seedRand(')),ctx);
for(const f of ['assets/waterside-models.js','settlement-coast.js'])vm.runInContext(read('src/'+f),ctx);
const C=window.ConquerCoast;
const kinds=C.stretches().map(s=>s.kind).join();
assert.equal(kinds,'beach,rocks,beach','beach, the rocky headland, beach');
assert.ok(C.rockAt({x:100,y:154}),'rocks on the headland, at the shore');
assert.ok(C.rockAt({x:100,y:155})&&!C.rockAt({x:100,y:152}),'the band runs along the coast, 2.6U on land and 1.2U into the sea');
assert.ok(!C.rockAt({x:30,y:149})&&C.kindAt({x:30,y:149})==='beach','a bay is beach');
assert.equal(C.kindAt({x:30,y:140}),null,'inland is neither');
const tris=C.meshes()[0].col.length;
assert.ok(tris>0,'boulders on the rocky stretch');
State.structures.push({id:'q',type:'quay',a:{x:96,y:154},b:{x:104,y:154}});
window.ConquerQuay={footprint:q=>[{x:q.a.x,y:q.a.y-1},{x:q.b.x,y:q.b.y-1},{x:q.b.x,y:q.b.y+1},{x:q.a.x,y:q.a.y+1}]};
assert.ok(C.meshes()[0].col.length<tris,'no boulders under a quay');
console.log('PASS coast: headland rocks, bay beaches, rock band, boulders off the quay');

const placement=read('src/settlement-placement.js'),nav=read('src/settlement-population-navigation.js'),world=read('src/settlement-world.js');
assert.match(placement,/ConquerCoast\.rockAt\(p\)\)\)return invalid\('Scogli: qui si può costruire solo la banchina'\)/,'placement refuses rocks but for quays');
assert.match(nav,/ConquerCoast\?\.rockAt\(p\)&&!quayAt\(p\)\)return true/,'units cannot cross the rocks, a quay over them is walkable');
assert.match(world,/\(mode==='road'\|\|mode==='settlement'\)&&window\.ConquerCoast\?\.rockAt\(p\)/,'no roads or auto houses on the rocks');
assert.match(read('src/settlement-world3d.js'),/window\.ConquerCoast\?\.addToBuilder\(m\)/,'boulders in the WebGL scene');
console.log('PASS coast hooks: placement, navigation, roads, renderers');

// Waves: graphics only, real time, painted before the ships in both renderers.
const drawn=[];ctx.ctx={canvas:{width:800,height:600},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){drawn.push('line')},arc(){},fill(){drawn.push('spray')}};
ctx.w2sRaw=(p,z=0)=>({x:(p.x-60)*8,y:(p.y-120)*8-z*20});ctx.currentWeather=()=>({kind:'storm'});ctx.nightFactor=()=>0;
let frames=0;ctx.requestSceneDraw=()=>frames++;
assert.ok(C.drawWaves(1.3)&&drawn.includes('line'),'foam lines on the beaches');
assert.ok(frames>0,'the waves keep frames coming while on screen');
assert.match(read('src/settlement-render.js'),/window\.ConquerCoast\?\.drawWaves\(performance\.now\(\)\/1000\);/,'drawn every frame before the ships');
console.log('PASS coast waves: beach foam, frames requested, render hook');

// Seagulls: flocks over the coast and gulls standing on rocks, beaches and pier heads;
// none in the air at night, frames requested while they are on screen.
State.structures.push({id:'p1',type:'pier',x:60,y:150,angle:Math.PI/2,reach:12});
Object.assign(ctx.ctx,{quadraticCurveTo(){drawn.push('wing')},ellipse(){drawn.push('bird')},fillRect(){}});
vm.runInContext(read('src/settlement-gulls.js'),ctx);
const G=window.ConquerGulls,Lg=G.layout();
assert.ok(Lg.flocks.length>=7&&Lg.perched.some(g=>g.z>.9),'flocks over the coast, a gull on the pier head');
drawn.length=0;frames=0;assert.ok(G.draw(2)&&drawn.includes('bird')&&frames>0,'gulls drawn, frames requested');
ctx.nightFactor=()=>1;drawn.length=0;G.draw(2);
const flying=drawn.filter(x=>x==='wing').length;
assert.equal(flying,0,'no gulls in the air at night');
assert.match(read('src/settlement-render.js'),/window\.ConquerGulls\?\.draw\(performance\.now\(\)\/1000\);/,'drawn above the ships');
console.log('PASS seagulls: flocks, perched on rocks, beaches and piers, none flying at night');
