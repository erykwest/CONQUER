'use strict';
// Real runtime harness shared with the urban regression suite.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
const check=new Function('require','__dirname',harness+`
let passed=0;
function test(label,body){body();passed++;console.log('PASS '+label)}
function setup(){
  run("State.seed=12345;State.biome='plains';State.structures=[{id:'well',type:'well',x:100,y:100}];State.village={founded:true,wellId:'well'};State.environment=[];State.relief=null;State.combat.strokes=[];State.tool={kind:'select'};generateRelief();invalidateNavigation()");
}
test('roads reject forests and route segments through them',()=>{
  setup();
  run("State.environment=[{id:'qa-woods',type:'forest',points:[{x:120,y:100},{x:126,y:100},{x:126,y:106},{x:120,y:106}]}];clearReliefBandCache()");
  assert.equal(run("environmentBlocksPoint({x:123,y:103},'road')"),true);
  assert.equal(run("roadRepairPointClear({x:123,y:103})"),false);
  assert.equal(run("roadRepairSegmentClear({x:119,y:103},{x:127,y:103})"),false);
});
test('roads reject gentle relief in addition to steep cliffs',()=>{
  setup();
  run("State.biome='hills';generateRelief();State.environment=[];globalThis.qaGentle=null;globalThis.qaSteep=null;for(let x=50;x<=150;x+=1.3)for(let y=50;y<=150;y+=1.3){const kind=terrainSlopeKind({x,y});if(kind==='gentle'&&!qaGentle)qaGentle={x,y};if(kind==='steep'&&!qaSteep)qaSteep={x,y}}");
  assert.ok(run("qaGentle"),'expected gentle relief');
  assert.equal(run("environmentBlocksPoint(qaGentle,'road')"),true);
  if(run("qaSteep"))assert.equal(run("environmentBlocksPoint(qaSteep,'road')"),true);
});
test('biome generation has no obsolete hill/rough ellipses',()=>{
  for(const biome of ['plains','hills','river','mountains','sea']){
    setup();
    run("State.biome='"+biome+"';generateRelief();generateEnvironment()");
    assert.equal(run("State.environment.some(f=>f.type==='hill'||f.type==='rough')"),false,'obsolete brown ovals in '+biome);
  }
});
test('saved map migration removes ellipses and retains genuine relief and forests',()=>{
  setup();
  run("State.environment=[{id:'qa-forest',type:'forest',points:[{x:120,y:100},{x:126,y:100},{x:126,y:106},{x:120,y:106}]},{id:'old-hill',type:'hill',x:110,y:110,rx:5,ry:3,angle:0},{id:'old-rough',type:'rough',x:130,y:120,rx:4,ry:3,angle:0}];globalThis.qaOriginalRelief=State.relief;globalThis.qaMigration=ensureStaticLandscape()");
  assert.equal(run('qaMigration'),true);
  assert.equal(run("State.environment.length"),1);
  assert.equal(run("State.environment[0].id"),'qa-forest');
  assert.equal(run("State.relief===qaOriginalRelief"),true);
  assert.equal(run("ensureStaticLandscape()"),false,'migration should be idempotent');
});
test('buildable outline appears only with placement tools',()=>{
  setup();
  run("globalThis.qaSavedPolygon=pathPolygon;globalThis.qaBuildOutlineCalls=0;pathPolygon=(...args)=>{qaBuildOutlineCalls++;return undefined};State.tool={kind:'select'};drawBuildArea()");
  try{
    assert.equal(run('qaBuildOutlineCalls'),0);
    for(const kind of ['well','tower','gate','civic','linear','industry','crossing']){
      run("State.tool={kind:'"+kind+"'};drawBuildArea()");
      assert.equal(run('qaBuildOutlineCalls')>0,true,'outline omitted for '+kind);
    }
    run("State.tool={kind:'select'};qaBuildOutlineCalls=0;drawBuildArea()");
    assert.equal(run('qaBuildOutlineCalls'),0);
  }finally{run('pathPolygon=qaSavedPolygon')}
});
test('buildable outline is dynamic instead of baked into terrain',()=>{
  const renderSource=fs.readFileSync(__dirname+'/../src/settlement-render.js','utf8');
  const cached=renderSource.slice(renderSource.indexOf('function drawLandscapeStaticScene(){'),renderSource.indexOf('function drawGroundStaticScene(){'));
  const dynamic=renderSource.slice(renderSource.indexOf('function draw(){'),renderSource.indexOf('function draw(){')+2000);
  // Keep assertions safe inside this twice-compiled regression harness.
  assert.equal(cached.includes('drawBuildArea('),false);
  assert.equal(dynamic.includes('drawBuildArea()'),true);
  assert.equal(renderSource.split('drawBuildArea();').length-1,1);
});
console.log(passed+' URBAN 2 landscape and routing checks passed.');
`);
check(require,__dirname);
