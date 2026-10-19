'use strict';
// Siege engines: Blender-built ram, catapult and trebuchet with the right
// mechanics — the ram swings on its ropes, the catapult arm stops leaning on its
// padded bar, the trebuchet counterweight hangs from the SHORT end and falls while
// the long end with the sling goes over the top towards the target.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,Float32Array,String});
for(const f of ['assets/siege-engines-model.js','settlement-siege-engines3d.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const M=window.ConquerSiegeModel,SE=window.ConquerSiegeEngines3D;
for(const [name,e] of Object.entries(M.engines)){
  for(const [part,p] of Object.entries(e.parts)){
    assert.equal(p.v.length,p.c.length*9,name+' '+part+': nine coordinates per triangle');
    assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),name+' '+part+': palette colours');
  }
  assert.equal(e.wheels.at.length,name==='ladder'?0:4,name+(name==='ladder'?' is carried':' rolls on four wheels'));
  assert.ok(e.crew.length>=2,name+' has a crew');
  for(const mode of ['idle','move','fire','setup'])for(let t=0;t<13;t+=.37){
    const m=SE.triangles(name,{x:3,y:4,heading:t},{mode,t,distance:t});
    assert.ok(m.pos.every(Number.isFinite),name+' '+mode+' is finite');
  }
}
console.log('PASS five engines, well-formed parts, every pose finite');

// Helpers: z range of one part in a posed engine.
const partRange=(e,part)=>{let s=0;for(const [n,p] of Object.entries(M.engines[e].parts)){if(n===part)return[s,s+p.c.length*9];if(n!=='wheel')s+=p.c.length*9}};
const zMax=(m,r)=>{let z=-Infinity;for(let i=r[0]+2;i<r[1];i+=3)z=Math.max(z,m.pos[i]);return z};
const xMax=(m,r)=>{let x=-Infinity;for(let i=r[0];i<r[1];i+=3)x=Math.max(x,m.pos[i]);return x};

// Ram: drawn back, then driven forward past its rest position.
const ramAt=t=>xMax(SE.triangles('ram',{x:0,y:0},{mode:'fire',t}),partRange('ram','ram'));
const rest=xMax(SE.triangles('ram',{x:0,y:0},{mode:'idle'}),partRange('ram','ram'));
assert.ok(ramAt(1.0)<rest-.05,'the ram is drawn back');
assert.ok(ramAt(.725*1.8)>rest+.03,'then driven forward (impact)');
console.log('PASS ram swings on its ropes');

// Catapult: cocked arm lies back; at the stop it leans forward onto the bar.
const P=SE.pose;
assert.ok(P('catapult',{mode:'idle'}).arm<-1.2,'catapult rests cocked, arm laid back');
const stop=P('catapult',{mode:'fire',t:.13*4.2}).arm;
assert.ok(stop>.6&&stop<.8,'the arm stops leaning forward against the padded bar');
console.log('PASS catapult arm cocks back and stops on its bar');

// Trebuchet: counterweight on the short (+x) end, sling on the long (-x) end.
const tr=M.engines.trebuchet;
assert.ok(tr.pivots.weight[0]>0&&tr.pivots.sling[0]<0,'counterweight on the short end, sling on the long end');
assert.ok(Math.abs(tr.pivots.weight[0])<Math.abs(tr.pivots.sling[0])/2,'short end at most half the long end');
const cocked=SE.triangles('trebuchet',{x:0,y:0},{mode:'idle'}),shot=SE.triangles('trebuchet',{x:0,y:0},{mode:'fire',t:.19*6});
const w=partRange('trebuchet','weight');
assert.ok(zMax(shot,w)<zMax(cocked,w)-.3,'the counterweight falls during the shot');
assert.ok(P('trebuchet',{mode:'fire',t:.205*6}).arm>Math.PI/2,'the beam swings past vertical towards the target');
const box=(m,r)=>{let a=Infinity,b=-Infinity;for(let i=r[0];i<r[1];i+=3){a=Math.min(a,m.pos[i]);b=Math.max(b,m.pos[i])}return b-a};
assert.ok(Math.abs(box(shot,w)-box(cocked,w))<.02,'the box hangs level: it follows its hinge without turning');
console.log('PASS trebuchet counterweight falls and the beam goes over the top');

assert.equal(SE.projectile('trebuchet',{x:0,y:0},{mode:'idle'}),null,'nothing flies at rest');
const flying=SE.projectile('trebuchet',{x:0,y:0,heading:0},{mode:'fire',t:.3*6});
assert.ok(flying&&flying.x>0,'the stone flies towards the target (+x)');
console.log('PASS projectile');

// Trebuchet set-up: packed it rides on its wheels with the uprights folded;
// set up its frame sits on the ground and the uprights stand.
const zMin=(m,r)=>{let z=Infinity;for(let i=r[0]+2;i<r[1];i+=3)z=Math.min(z,m.pos[i]);return z};
const packed=SE.triangles('trebuchet',{x:0,y:0},{mode:'move'}),set=SE.triangles('trebuchet',{x:0,y:0},{mode:'idle'});
const base=partRange('trebuchet','base'),tower=partRange('trebuchet','tower');
assert.ok(zMin(packed,base)>zMin(set,base)+.08,'packed, the frame rides up on its wheels');
assert.ok(zMin(set,base)<.01,'set up, the frame sits on the ground');
assert.ok(zMax(packed,tower)<zMax(set,tower)/3,'packed, the uprights lie folded');
assert.equal(SE.deploy({mode:'move'}),0);assert.equal(SE.deploy({mode:'fire'}),1);
assert.equal(SE.projectile('trebuchet',{x:0,y:0},{mode:'fire',t:.3*6,deploy:.5}),null,'no shot before it is set up');
const wz=m=>{let z=-Infinity;for(let i=m.pos.length-1-tr.parts.wheel.c.length*9*4+3;i<m.pos.length;i+=3)z=Math.max(z,m.pos[i]);return z};
assert.ok(wz(set)<wz(packed)/2,'set up, the wheels lie flat on the ground');
console.log('PASS trebuchet packs on wheels and sets up on the ground');

// Siege tower lowers its bridge forward; the ladder is carried flat and raised.
const tw=SE.triangles('tower',{x:0,y:0},{mode:'idle'}),down=SE.triangles('tower',{x:0,y:0},{mode:'fire',t:.5*6});
const br=partRange('tower','bridge');
assert.ok(xMax(down,br)>xMax(tw,br)+.5,'the bridge drops forward');
assert.ok(SE.pose('ladder',{mode:'idle'}).up===0&&SE.pose('ladder',{mode:'fire',t:.6*7}).up===1,'the ladder goes up');
const lr=partRange('ladder','ladder');
assert.ok(zMax(SE.triangles('ladder',{x:0,y:0},{mode:'fire',t:.6*7}),lr)>2.1,'raised, it reaches over a stone wall');
console.log('PASS siege tower bridge and scaling ladder');