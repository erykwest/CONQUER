'use strict';
// Siege assault choreography against a low (H1) wall: the men push and swing the
// ram until the gate gives, archers shoot from behind the mantlet, ladders are
// raised and climbed onto the wall walk, the tower bridge lands in a crenel and
// the party crosses, fascines fill the moat. High (H2) walls are out of reach.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,Float32Array,String});
for(const f of ['assets/siege-engines-model.js','settlement-siege-engines3d.js','settlement-siege-assault.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const SA=window.ConquerSiegeAssault,SE=window.ConquerSiegeEngines3D,W=SA.WALL;
const H2=2.10,near=(a,b,eps,msg)=>assert.ok(Math.abs(a-b)<eps,msg+' ('+a.toFixed(3)+' vs '+b.toFixed(3)+')');

for(const kind of SA.KINDS)for(let t=0;t<SA.CYCLE[kind];t+=.25){
  const sc=SA.scene(kind,t);
  for(const s of sc.soldiers)assert.ok([s.x,s.y,s.z].every(Number.isFinite),kind+' soldier finite at '+t);
  for(const me of SA.meshes(sc)){
    assert.ok(Array.from(me.pos).every(Number.isFinite),kind+' mesh finite at '+t);
    assert.equal(me.pos.length,me.col.length*9);
  }
  // Nobody walks inside the wall: either in front of its face, or up on the walk  // (or stepping over the parapet onto it).
  for(const s of sc.soldiers)if(s.x>W.face+.02)assert.ok(s.z>W.walk-.02,kind+' man past the face is up on the walk at '+t);
}
console.log('PASS every scene finite; no one inside the wall');

assert.ok(W.walk<H2&&W.top<1.3,'the scene wall is the low (H1) wall');
assert.ok(W.top<H2,'high (H2) walls stand above it');

// Ram: the head meets the door on the blow; the gate is shut until the last blow.
const ramModel=window.ConquerSiegeModel.engines.ram,partRange=(e,part)=>{let s=0;for(const [n,p] of Object.entries(window.ConquerSiegeModel.engines[e].parts)){if(n===part)return[s,s+p.c.length*9];if(n!=='wheel')s+=p.c.length*9}};
const head=t=>{const sc=SA.scene('ram',t),m=SE.triangles('ram',sc.engine.place,sc.engine.state),r=partRange('ram','ram');let x=-1e9;for(let i=r[0];i<r[1];i+=3)x=Math.max(x,m.pos[i]);return x};
near(head(7+1.8*.72),W.door,.04,'the ram head meets the door');
assert.ok(head(7+1.8*.3)<W.door-.08,'drawn back it is clear of the door');
assert.equal(SA.scene('ram',9).gate.open,0,'the gate holds under the first blows');
assert.equal(SA.scene('ram',15.5).gate.open,1,'and gives way to the last');
console.log('PASS ram battered the gate in');

// Mantlet: archers shelter behind it, step out to shoot, arrows reach the wall.
const mt=SA.scene('mantlet',3),mt2=SA.scene('mantlet',7.3);
assert.ok(mt.soldiers.every(s=>s.x<mt.engine.place.x),'the men are behind the shield');
assert.ok(mt2.soldiers.some(s=>s.aim>0)&&mt2.arrows.length>0,'an archer steps out and looses');
console.log('PASS mantlet covers the archers');

// Ladder: leans on the wall edge, men climb it and end up on the walk.
const ld=SA.scene('ladder',17);
assert.equal(ld.soldiers.filter(s=>Math.abs(s.z-W.walk)<1e-6&&s.x>W.face).length,4,'four men on the wall walk');
const climbing=SA.scene('ladder',9.6).soldiers.find(s=>s.climb);
assert.ok(climbing&&climbing.z>.1&&climbing.z<W.walk,'a man is half way up the ladder');
console.log('PASS ladder raised and climbed onto the wall');

// Tower: the bridge tip rests on the wall walk inside the parapet; the party crosses.
const tw=SA.scene('tower',12),tm=SE.triangles('tower',tw.engine.place,tw.engine.state),br=partRange('tower','bridge');
let tip=-1e9,tipZ=0;for(let i=br[0];i<br[1];i+=3)if(tm.pos[i]>tip){tip=tm.pos[i];tipZ=tm.pos[i+2]}
assert.ok(tip>W.face+.15&&tip<W.inner,'the bridge reaches over the parapet onto the walk');
near(tipZ,W.walk,.08,'the bridge rests on the walk');
assert.ok(SA.scene('tower',19).soldiers.filter(s=>s.x>W.face).length===5,'five men cross onto the wall');
console.log('PASS tower bridge lands and the party crosses');

// Moat: empty at the start, filled flush with the ground at the end.
assert.equal(SA.scene('moat',.5).filled,0);
assert.equal(SA.scene('moat',16).filled,1);
const top=Math.max(...SA.scene('moat',16).moat.fascines.map(f=>f.z))+W.fascineR;
near(top,0,.02,'the top layer is flush with the ground');
console.log('PASS fascines fill the moat');