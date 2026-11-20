'use strict';
// Bug "watchtower deve avere slot, ora ne ha 0": the timber watchtower is a guard deck and
// takes archers. Its slots sit on the deck (1.46 U), inside the rail, and can be staffed.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const watchtower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'wood',woodStyle:'watchtower',woodRoof:'pitched',level:1,tier:1,size:1,x:100,y:100,angle:0,functions:[],...extra});
const S=()=>run('window.ConquerSiege');

check('the watchtower has archer slots (> 0), all on its deck',()=>{
  const t=watchtower('w');setup([t]);
  const slots=S().archerSlots(t);
  assert.ok(slots.length>0,'watchtower archer slots: '+slots.length);
  assert.equal(slots.length,2);
  assert.ok(slots.every(s=>s.kind==='roof'),'deck slots count as roof posts');
  assert.equal(new Set(slots.map(s=>s.id)).size,slots.length,'unique slot ids');
  for(const s of slots){
    assert.ok(Math.abs(s.z-1.46)<1e-9,'standing on the deck planks');
    assert.ok(Math.max(Math.abs(s.p.x-t.x),Math.abs(s.p.y-t.y))<.445,'inside the deck rail');
  }
});
check('slots follow the tower rotation',()=>{
  const t=watchtower('r',{angle:Math.PI/2});setup([t]);
  const p=S().archerSlots(t)[1].p;
  assert.ok(Math.abs(p.x-(100+.2))<1e-9&&Math.abs(p.y-(100+.2))<1e-9,JSON.stringify(p));
});
check('archers can be assigned up to the slot count and become posted shooters',()=>{
  const t=watchtower('a');setup([t]);
  assert.ok(S().changeArchers('a',1));
  assert.ok(S().changeArchers('a',1));
  assert.ok(!S().changeArchers('a',1),'no third archer');
  assert.equal(S().stationedArchers(t),2);
  assert.equal(S().occupiedArcherSlots(t).length,2);
});
check('no slots while the watchtower is a building site',()=>{
  const t=watchtower('c',{construction:{version:2,workDone:1,workRequired:5}});setup([t]);
  assert.equal(S().archerSlots(t).length,0);
});
check('other timber towers keep their slots (open palisade tower: one roof post)',()=>{
  const p=run('normalizeStructureVariants')({id:'p',type:'tower',shape:'square',material:'wood',woodStyle:'palisadeTower',woodRoof:'open',level:1,tier:2,size:1.5,x:110,y:100,angle:0,functions:[]});
  setup([p]);
  assert.equal(S().archerSlots(p).length,1);
});
console.log('watchtower slots regression: '+passed+' checks');
`);
