'use strict';
// Feudal roof pitch: 30/45/60/75°, priced per pitched stone tower/gate roof, rise = tan(pitch) × half span.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:1,roofStyle:'pitched',x:100,y:100,angle:0,functions:[],...extra});
const P=run('State').policies;
check('pitch set includes 75° and unknown values fall back to 45°',()=>{
  assert.deepEqual([...run('ROOF_PITCHES')],[30,45,60,75]);
  P.roofPitch=75;assert.equal(run('roofPitch')(),75);
  P.roofPitch=80;assert.equal(run('roofPitch')(),45);
  delete P.roofPitch;
});
check('roofPitchQuote prices every pitched stone roof at the target rate',()=>{
  setup([tower('a'),tower('b',{x:110}),tower('c',{x:120,roofStyle:'battlement'})]);
  const q=run('roofPitchQuote')(75);
  assert.equal(q.roofs,2);
  assert.deepEqual({...q.cost},{gold:6,stone:2,wood:18});
  assert.deepEqual({...run('roofPitchQuote')(60).cost},{gold:4,wood:12});
  assert.deepEqual({...run('roofPitchQuote')(99).cost},{},'unknown pitch costs nothing');
  const c=run('ROOF_PITCH_COST');
  assert.ok(c[75].wood>c[60].wood&&c[75].gold>c[60].gold,'75° is the dearest');
});
check('75° rise is tan(75°) × half span',()=>{
  const [t]=setup([tower('a')]);
  P.roofPitch=75;const r75=run('towerRoofRise')(t);
  P.roofPitch=45;const r45=run('towerRoofRise')(t);
  assert.ok(Math.abs(r75/r45-Math.tan(75*Math.PI/180))<1e-9,r75+' vs '+r45);
  delete P.roofPitch;
});
console.log('roof pitch regression: '+passed+' checks');
`);
