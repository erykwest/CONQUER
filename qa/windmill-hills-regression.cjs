'use strict';
// "Il mulino non si costruisce sulle colline": hills are the windmill's natural site.
// Uses the REAL terrain survey (settlement-castle.js) on a REAL procedural hill
// (settlement-world.js makeProceduralHill): the windmill must be placeable on every
// flat hill terrace (H+1, H+2, H+3 summit), seated at that terrace height, and still
// refused on H0 lowland and on slopes. The watermill keeps its river-bank rule.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const lineFn=(text,name)=>{const m=text.match(new RegExp('^(?:function|const) '+name+'\\b.*$','m'));assert.ok(m,name+' found');return m[0]};
const fnSrc=(text,name)=>{const m=text.match(new RegExp('^function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}','m'));assert.ok(m,name+' found');return m[0]};

const world=src('settlement-world.js'),core=src('settlement-core.js'),landscape=src('settlement-landscape.js'),buildings=src('settlement-buildings.js');
const State={clock:{day:0},structures:[],environment:[],relief:{hills:[]},policies:{tax:10},village:{founded:false},biome:'hills'};
const window={};
const ctx=vm.createContext({State,window,console,Math,Number,Object,Array,JSON,Map,Set,WeakMap,String,isFinite,
  Image:function(){},document:{getElementById:()=>null,createElement:()=>({getContext:()=>null})},
  BUILD_MIN:50,BUILD_MAX:150,WORLD:200,
  // Neighbours of the industry survey that this test does not exercise.
  isOrientedTower:()=>false,isStoneTowerStructure:()=>false,environmentBlocksPoint:()=>false,structureRotationStep:a=>Math.round(a/(Math.PI/12)),
  roadTouchesPolygon:()=>false,wellPlazaPoints:()=>[],
  isCivic:()=>false,civicParts:()=>[],isCivicAnnex:()=>false,civicAnnexFootprint:()=>[],civicAnnexPlacementCheck:()=>({ok:true}),
  constructionCost:()=>({gold:10}),canAfford:()=>true,costText:()=>'10 gold',
  TYPES:{road:{min:1}},manualRoadConflict:()=>false,underConstruction:()=>false
});
window.window=window;
vm.runInContext([
  lineFn(core,'clamp'),lineFn(core,'dist'),lineFn(landscape,'seedRand'),lineFn(buildings,'structureCenter'),
  lineFn(world,'pointSegmentDistance'),lineFn(world,'segmentsIntersect'),
  fnSrc(world,'pointInPolygon'),fnSrc(world,'environmentContains'),
  fnSrc(world,'reliefShuffle'),lineFn(world,'RELIEF_MAX_EDGE'),fnSrc(world,'resampleClosedPolygonMaxEdge'),
  fnSrc(world,'makeProceduralHill')
].join('\n'),ctx,{filename:'world-extract.js'});
vm.runInContext(src('settlement-castle.js'),ctx,{filename:'settlement-castle.js'});
// The generic Builder preflight treats industries through their own survey.
ctx.isPlacementFoundationBuilding=()=>false;
vm.runInContext(src('settlement-industries.js'),ctx,{filename:'settlement-industries.js'});
vm.runInContext(src('settlement-placement.js'),ctx,{filename:'settlement-placement.js'});
const I=window.ConquerIndustries,P=window.ConquerPlacement;
assert.ok(I&&P,'industry and placement modules loaded');

function test(name,fn){fn();console.log('✓ '+name)}
const hillAt=(seed,maxHeight)=>{
  const hill=ctx.makeProceduralHill(ctx.seedRand(seed),0,{center:{x:100,y:100},rx:10,ry:7,maxHeight,angle:0});
  State.relief={hills:[hill]};ctx.clearReliefBandCache();
  return hill;
};
// Every 2×2 windmill spot on a 0.5U grid over the hill, with the terrace it stands on.
function survey(){
  const ok=[];
  for(let x=86;x<=114;x+=.5)for(let y=90;y<=110;y+=.5){
    const mill=I.make('windmill',{x,y}),v=I.validate(mill);
    if(v.ok)ok.push({x,y,ground:v.ground});
  }
  return ok;
}

test('windmill builds on the summit of a 3-level hill, seated at H+3',()=>{
  hillAt(0x51ed,3);
  const mill=I.make('windmill',{x:100,y:100});
  assert.equal(ctx.terrainElevation({x:100,y:100}),3,'hill centre is the H+3 summit');
  const v=I.validate(mill);
  assert.equal(v.ok,true,v.reason);
  assert.equal(v.ground,3,'model groundZ = summit terrace height');
  assert.equal(P.check(mill).ok,true,'Builder preflight accepts the hill windmill');
});
test('windmill builds on every hill level and is seated on its terrace',()=>{
  for(const seed of [0x51ed,0x1234,0xbeef,0x7a11]){
    for(const height of [2,3]){
      hillAt(seed,height);
      const spots=survey();
      const levels=new Set(spots.map(s=>s.ground));
      assert.ok(spots.length>0,'seed '+seed+' H'+height+': hill has windmill spots');
      assert.ok(levels.has(height),'seed '+seed+' H'+height+': summit terrace accepts a windmill');
      for(const s of spots){
        assert.ok(s.ground>=1,'never on H0 lowland');
        // groundZ matches the real terrain under all four corners (no floating/sunk model).
        for(const [dx,dy] of [[-1,-1],[1,-1],[1,1],[-1,1]])
          assert.ok(Math.abs(ctx.terrainElevation({x:s.x+dx*.99,y:s.y+dy*.99})-s.ground)<1e-6,'flat seat at '+s.x+','+s.y);
      }
    }
  }
});
test('windmill is still refused on H0 lowland and across slopes',()=>{
  hillAt(0x51ed,3);
  const low=I.validate(I.make('windmill',{x:60,y:60}));
  assert.equal(low.ok,false);assert.match(low.reason,/hill terrace/);
  // Walk outward from the summit: some spot straddles a slope band and is refused.
  let refusedOnSlope=false;
  for(let x=100;x<=114;x+=.25){
    const mill=I.make('windmill',{x,y:100});
    if(ctx.structureTerrainSamples(mill).some(p=>ctx.terrainSlopeKind(p))){
      assert.equal(I.validate(mill).ok,false,'slope at x='+x);refusedOnSlope=true;
    }
  }
  assert.ok(refusedOnSlope,'the hill flank was sampled');
});
test('watermill keeps its river-bank requirement on a hill top',()=>{
  hillAt(0x51ed,3);
  const v=I.validate(I.make('watermill',{x:100,y:100}));
  assert.equal(v.ok,false);assert.match(v.reason,/river or stream bank/);
});
console.log('PASS windmill builds on hills');
