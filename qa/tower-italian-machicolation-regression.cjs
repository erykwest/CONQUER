'use strict';
// Italian machicolations on towers (aesthetic): machicolationStyle 'italian' draws tall corbels of four
// stepped courses (4x the standard corbel height) joined by small arches; the rules stay the machicolation's.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-tower-shapes.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-structure-commands.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:2,roofStyle:'machicolation',x:100,y:100,angle:0,functions:[],...extra});
const corbels=t=>run('towerBattlementPieces')(t).filter(p=>p.kind==='machicolationCorbel');
const span=ps=>{const z0=Math.min(...ps.map(p=>p.z0)),z1=Math.max(...ps.map(p=>p.z1));return z1-z0};

check('towers default to standard machicolations; italian is a valid aesthetic variant',()=>{
  assert.equal(tower('a').machicolationStyle,'standard');
  assert.equal(tower('b',{machicolationStyle:'italian'}).machicolationStyle,'italian');
  assert.equal(tower('c',{machicolationStyle:'gothic'}).machicolationStyle,'standard');
  assert.ok(run('towerItalianMachicolation')(tower('d',{machicolationStyle:'italian'})));
  assert.ok(!run('towerItalianMachicolation')(tower('e',{roofStyle:'battlement',machicolationStyle:'italian'})),'only on a machicolated top');
  assert.ok(run('hasMachicolation')(tower('f',{machicolationStyle:'italian'})),'still a machicolation for the rules');
});
check('corbels are four times as tall, and arches join them, on square, round and D towers',()=>{
  for(const extra of [{},{shape:'round',r:.75},{shape:'dee',size:1.5,tier:3,level:3}]){
    const std=tower('s',extra),it=tower('i',{...extra,machicolationStyle:'italian'});setup([std,it]);
    const a=corbels(std),b=corbels(it);
    assert.ok(a.length>0&&b.length>a.length*4,'stepped courses plus arch pieces ('+(extra.shape||'square')+')');
    assert.ok(Math.abs(span(b)-4*span(a))<.02,'height x4: '+span(a).toFixed(3)+' -> '+span(b).toFixed(3));
    const merlons=t=>run('towerBattlementPieces')(t).filter(p=>p.kind!=='machicolationCorbel').length;
    assert.equal(merlons(it),merlons(std),'merlons and parapets unchanged');
  }
});
check('the roof menu offers it as a fourth choice and the command sets both fields',()=>{
  const t=tower('m',{roofStyle:'battlement'});setup([t]);
  const C=run('StructureCommands');
  assert.ok(C.setTowerRoof('m','machicolationItalian'));
  assert.equal(t.roofStyle,'machicolation');assert.equal(t.machicolationStyle,'italian');
  assert.equal(run('towerRoofMenuValue')(t),'machicolationItalian');
  delete t.construction;   // the change opens a renovation site like any variant; finish it
  assert.ok(C.setTowerRoof('m','machicolation'));
  assert.equal(t.machicolationStyle,'standard');assert.equal(run('towerRoofMenuValue')(t),'machicolation');
  const src=fs.readFileSync(__dirname+'/../src/settlement-structure-commands.js','utf8');
  assert.ok(src.includes("{value:'machicolationItalian',word:'machicolationItalian'"),'option in the roof control');
  const it=fs.readFileSync(__dirname+'/../src/ui/i18n-it.js','utf8');
  assert.ok(it.includes("machicolationItalian: 'Caditoie all\\\\'italiana'"),'Italian label');
});
console.log('tower italian machicolation regression: '+passed+' checks');
`);
