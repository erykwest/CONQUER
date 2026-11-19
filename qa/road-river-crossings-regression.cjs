'use strict';
// Main roads and rivers: (1) one crossing = ONE deck, perpendicular to the banks,
// even when the wet span straddles two road segments; (2) main-road routing takes
// the fewest river crossings, preferring a longer dry detour to extra bridges.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
new Function('require','__dirname',harness+String.raw`
const base="State.structures=[];State.village={founded:false};State.seed=777;State.relief={hills:[]};clearReliefBandCache();";

// 1. A crossing split across two segments yields a single perpendicular deck.
run(base+"State.environment=[{id:'water',type:'river',width:3.2,points:[{x:100,y:20},{x:100,y:180}]}];invalidateNavigation();"+
 "globalThis.r1={id:'r1',type:'road',auto:true,roadClass:'arterial',routeId:'arterial-0',a:{x:80,y:90},b:{x:100.6,y:100},width:.62};"+
 "globalThis.r2={id:'r2',type:'road',auto:true,roadClass:'arterial',routeId:'arterial-0',a:{x:100.6,y:100},b:{x:120,y:110},width:.62};"+
 "State.structures.push(r1);autoPrimaryRoadBridges(r1);State.structures.push(r2);autoPrimaryRoadBridges(r2);");
const decks=run("State.structures.filter(s=>s.type==='bridge').map(s=>({a:s.a,b:s.b}))");
assert.equal(decks.length,1,'one crossing, one bridge: '+JSON.stringify(decks));
assert.ok(Math.abs(decks[0].a.y-decks[0].b.y)<1e-9,'the deck is perpendicular to the river');
console.log('PASS a crossing split over two road segments builds one perpendicular bridge');

// 1b. An oblique polyline whose vertex stands in the river is aligned onto one normal crossing.
const aligned=run("alignedRiverRoadPolyline([{x:80,y:90},{x:100.6,y:100},{x:120,y:110}])");
const spans=aligned.slice(1).map((p,i)=>[aligned[i],p]).filter(([p,q])=>(p.x-100)*(q.x-100)<0);
assert.equal(spans.length,1,'exactly one span crosses the river: '+JSON.stringify(aligned));
assert.ok(Math.abs(spans[0][0].y-spans[0][1].y)<1e-9,'the crossing span is on the river normal');
console.log('PASS the aligned main road crosses the river once, on the bank-to-bank normal');

// 2. A road running along a meandering river does not zig-zag over it.
run(base+"State.environment=[{id:'water',type:'river',width:3.2,points:Array.from({length:21},(_,i)=>({x:i*10,y:i%2?108:92}))}];invalidateNavigation();");
const straight=run("finishRoadWork(polylineRiverCrossingsWork([{x:40,y:93},{x:160,y:93}]))");
assert.ok(straight>=4,'the straight chord crosses the meanders: '+straight);
const leg=run("finishRoadWork(minimalCrossingRoadLeg({x:40,y:93},{x:160,y:93},.62,[],[[12,60000],[24,85000]]))");
assert.ok(leg&&leg.length>1,'a route is found');
assert.equal(run("finishRoadWork(polylineRiverCrossingsWork("+JSON.stringify(leg)+"))"),0,'the main road stays on its bank');
const clean=run("finishRoadWork(simplifyRoadRepairWork("+JSON.stringify(leg)+",.62,[],true))");
assert.equal(run("finishRoadWork(polylineRiverCrossingsWork("+JSON.stringify(clean)+"))"),0,'simplification never shortcuts across the river');
console.log('PASS a main road along a meandering river takes a dry detour instead of repeated bridges');
`)(require,__dirname);
