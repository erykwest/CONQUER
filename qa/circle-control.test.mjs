import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  assessDefensiveControl, CIRCLE_CONTROL_STATES, CIRCLE_SAFE_STATES
} from '../src/circle/defensive-control.mjs';

const sector=(id)=>({id,polygon:[[0,0],[1,0],[1,1]],depth:1,state:'unassessed'});
const sectors=[sector('west'),sector('east')];
const at=p=>p.x>=0&&p.x<10?'west':p.x>=10&&p.x<20?'east':null;
const assess=(opts={})=>assessDefensiveControl({
  compartments:sectors,sectorAt:at,...opts
});
test('no intruders means independently secure compartments',()=>{
  const out=assess();
  assert.deepEqual(out.compartments.map(c=>c.state),['secure','secure']);
  assert.equal(out.summary.safe,2);
  assert.equal(out.summary.occupied,0);
});
test('a visible alarm leaves safe territory safe but in alert state',()=>{
  const out=assess({alert:true});
  assert.deepEqual(out.compartments.map(c=>c.state),['alert','alert']);
  assert.equal(out.summary.safe,2);
  assert.equal(CIRCLE_SAFE_STATES.includes('alert'),true);
});
test('a hostile outside closed sectors does not invade them',()=>{
  const out=assess({hostiles:[{id:'outside',x:25,y:3}]});
  assert.equal(out.summary.invaded,0);
  assert.equal(out.summary.safe,2);
});
test('ground intruder invades only his sector even without visible LOS',()=>{
  const out=assess({hostiles:[{id:'hidden',x:3,y:3,spotted:false}]});
  assert.deepEqual(out.compartments.map(c=>c.state),['invaded','secure']);
  assert.equal(out.compartments[0].control.groundEnemies,1);
  assert.equal(out.summary.occupied,1);
  assert.equal(out.summary.invaded,1);
});
test('living defender contests the occupied ground; an inactive garrison does not',()=>{
  const unit={id:'enemy',x:3,y:3};
  const contested=assess({hostiles:[unit],defenders:[{id:'guard',x:4,y:3}]});
  assert.equal(contested.compartments[0].state,'contested');
  assert.equal(contested.summary.contested,1);
  const barracks=assess({hostiles:[unit],defenders:[{id:'guard',x:4,y:3,campState:'barracks'}]});
  assert.equal(barracks.compartments[0].state,'invaded');
});
test('enemy on wall is infiltrated, not occupying interior ground',()=>{
  const wallUnit={x:10,y:1,wall:{wallId:'wall',t:.5}};
  const out=assess({hostiles:[wallUnit],wallSectors:()=>['west','east','west']});
  assert.deepEqual(out.compartments.map(c=>c.state),['infiltrated','infiltrated']);
  assert.equal(out.compartments[0].control.wallEnemies,1);
  assert.equal(out.summary.groundEnemies,0);
});
test('assault ladder climbing only threatens until wall entry',()=>{
  const climbing={x:10,y:1,climbing:true,legs:[{kind:'climb'}]};
  const out=assess({hostiles:[climbing],wallSectors:()=>['west']});
  assert.deepEqual(out.compartments.map(c=>c.state),['threatened','secure']);
});
test('ground invasion takes precedence over wall assault and yellow alert',()=>{
  const out=assess({alert:true,hostiles:[
    {x:3,y:3}, {x:10,y:1,wall:{wallId:'a',t:.4}}
  ],wallSectors:()=>['west']});
  assert.equal(out.compartments[0].state,'invaded');
  assert.equal(out.compartments[1].state,'alert');
});
test('defeated, neutral and wildlife never invade sectors',()=>{
  const out=assess({hostiles:[
    {x:3,y:3,defeated:true},
    {x:3,y:3,stats:{hp:0}},
    {x:3,y:3,neutral:true},
    {x:3,y:3,kind:'wolf'},
    {x:3,y:3,faction:'wildlife'}
  ]});
  assert.equal(out.summary.safe,2);
});
test('non-finite positions and dead defenders cannot contest',()=>{
  const out=assess({hostiles:[{x:3,y:3},{x:NaN,y:3}],
    defenders:[{x:3,y:3,stats:{hp:0}},{x:Infinity,y:3}]});
  assert.equal(out.compartments[0].state,'invaded');
});
test('assessment is pure and never sets captured or transfers ownership',()=>{
  const units=[{x:3,y:3}];
  const input=sectors.map(c=>({...c}));
  const result=assess({hostiles:units});
  assert.equal(result.summary.invaded,1);
  assert.equal(CIRCLE_CONTROL_STATES.CAPTURED,'captured');
  assert.equal(result.compartments.some(c=>c.state==='captured'),false);
  assert.deepEqual(sectors,input);
  assert.deepEqual(units,[{x:3,y:3}]);
  assert.equal(assess().summary.safe,2);
});
test('assess requires an actual topology locator',()=>{
  assert.throws(()=>assessDefensiveControl({compartments:[]}),TypeError);
});

test('both armies fighting on a wall contest its bordering defensive sectors',()=>{
  const out=assess({hostiles:[{x:10,y:1,wall:{wallId:'wall',t:.5}}],
    defenders:[{x:10,y:1,wall:{wallId:'wall',t:.6}}],
    wallSectors:()=>['west']});
  assert.equal(out.compartments[0].state,'contested');
  assert.equal(out.compartments[0].control.groundEnemies,0);
  assert.equal(out.compartments[0].control.wallDefenders,1);
  assert.equal(out.summary.wallDefenders,1);
});
test('a defending wall archer keeps a ground invasion contested',()=>{
  const out=assess({hostiles:[{x:3,y:3}],
    defenders:[{x:10,y:1,wall:{wallId:'wall',t:.3}}],
    wallSectors:()=>['west']});
  assert.equal(out.compartments[0].state,'contested');
});

test('a breached historical compartment remains compromised without enemies',()=>{
  const broken={...sector('west'),breached:true};
  const out=assess({compartments:[broken],alert:true});
  assert.equal(out.compartments[0].state,'compromised');
  assert.equal(out.compartments[0].safe,false);
  assert.equal(out.summary.compromised,1);
});
test('enemy entry turns compromised territory invaded, retreat alone never recertifies it safe',()=>{
  const broken={...sector('west'),breached:true};
  const enemy=assess({compartments:[broken],hostiles:[{x:4,y:4}]});
  assert.equal(enemy.compartments[0].state,'invaded');
  const gone=assess({compartments:[broken]});
  assert.equal(gone.compartments[0].state,'compromised');
});
