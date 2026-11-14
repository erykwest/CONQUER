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
const MACH=['machicolationCorbel','machicolationArch'];
const corbels=t=>run('towerBattlementPieces')(t).filter(p=>MACH.includes(p.kind));
// Depth of the corbel band below the corbel heads (deck + 0.015).
const span=(ps,t)=>run('structureHeight')(t)+.015-Math.min(...ps.map(p=>p.z0));

check('towers default to standard machicolations; italian is a valid aesthetic variant',()=>{
  assert.equal(tower('a').machicolationStyle,'standard');
  assert.equal(tower('b',{machicolationStyle:'italian'}).machicolationStyle,'italian');
  assert.equal(tower('c',{machicolationStyle:'gothic'}).machicolationStyle,'standard');
  assert.ok(run('towerItalianMachicolation')(tower('d',{machicolationStyle:'italian'})));
  assert.ok(!run('towerItalianMachicolation')(tower('e',{roofStyle:'battlement',machicolationStyle:'italian'})),'only on a machicolated top');
  assert.ok(run('hasMachicolation')(tower('f',{machicolationStyle:'italian'})),'still a machicolation for the rules');
});
check('corbels are four times as tall, close-set, with round arches between them, on square, round and D towers',()=>{
  for(const extra of [{},{shape:'round',r:.75},{shape:'dee',size:1.5,tier:3,level:3}]){
    const std=tower('s',extra),it=tower('i',{...extra,machicolationStyle:'italian'});setup([std,it]);
    const a=corbels(std),b=corbels(it);
    const arches=b.filter(p=>p.kind==='machicolationArch'&&p.faces.some(f=>f.tone==='archFace'));
    const heads=b.filter(p=>p.kind==='machicolationArch'&&p.faces.some(f=>f.tone==='front'));
    assert.ok(a.length>0&&heads.length>a.length,'more corbels than the standard ones ('+(extra.shape||'square')+')');
    assert.ok(heads.length>=arches.length,'one corbel per arch');
    for(const h of heads){
      const f=h.faces.find(x=>x.tone==='front').pts,top=f.filter(q=>q.z===h.z1),foot=f.filter(q=>q.z===h.z0);
      assert.equal(top.length,2);assert.equal(foot.length,2);
      const d=q=>Math.hypot(q.p.x-it.x,q.p.y-it.y);
      assert.ok((d(top[0])+d(top[1]))/2>(d(foot[0])+d(foot[1]))/2+.05,'one inclined stone: the head projects, the foot meets the wall');
    }
    assert.equal(b.filter(p=>p.kind==='machicolationCorbel').length,arches.length,'a flush band per bay, no stacked courses');
    assert.ok(arches.every(p=>p.faces.every(f=>f.tone==='archFace')&&p.faces.length>=8),'round arch, no dark fill under it');
    assert.ok(Math.abs(span(b,it)-4*span(a,std))<.02,'height x4: '+span(a,std).toFixed(3)+' -> '+span(b,it).toFixed(3));
    const merlons=t=>run('towerBattlementPieces')(t).filter(p=>!MACH.includes(p.kind)).length;
    assert.equal(merlons(it),merlons(std),'merlons and parapets unchanged');
  }
});
check('cutaway: no corbel, arch or band left on the opened side over the top floor',()=>{
  const t=tower('cw',{size:2,tier:3,level:3,machicolationStyle:'italian'});setup([t]);
  const all=corbels(t);assert.ok(all.length>0);
  t.cutaway=true;assert.ok(run('structureCutaway')(t),'tower opened in cutaway');
  const kept=corbels(t);
  assert.ok(kept.length<all.length&&kept.length>0,'only the far side stays: '+all.length+' -> '+kept.length);
  assert.ok(kept.every(p=>run('battlementPieceFacesAway')(p)),'every kept piece faces away from the camera');
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
