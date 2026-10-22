'use strict';
// Construction assembly: a building under construction is cut by a rising site level.
// Whole courses below it, the course being laid block by block, the roof behind the
// walls (rafters, battens, tiles), and at the end exactly the finished building.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const State={structures:[],view:{rotation:0,scale:1},clock:{day:0},season:'summer'};
// A finished "building": a 2x2 box 2U high with a gable roof up to 3U, as tagged triangles.
function building(){
  const pos=[],col=[],tag=[];
  const quad=(a,b,c,d,colr,t)=>{for(const tri of [[a,b,c],[a,c,d]]){for(const p of tri)pos.push(...p);col.push(colr);tag.push(t)}};
  const P=(x,y,z)=>[10+x,10+y,z];
  quad(P(-1,-1,0),P(1,-1,0),P(1,-1,2),P(-1,-1,2),'#888888','body');
  quad(P(1,-1,0),P(1,1,0),P(1,1,2),P(1,-1,2),'#777777','body');
  quad(P(1,1,0),P(-1,1,0),P(-1,1,2),P(1,1,2),'#888888','body');
  quad(P(-1,1,0),P(-1,-1,0),P(-1,-1,2),P(-1,1,2),'#777777','body');
  quad(P(-1,-1,2),P(1,-1,2),P(1,0,3),P(-1,0,3),'#333333','roof');
  quad(P(1,1,2),P(-1,1,2),P(-1,0,3),P(1,0,3),'#3a3a3a','roof');
  return{pos,col,tag,flat:true,ground:0};
}
const env={window,Math,Object,Number,Array,Map,Set,String,State,constructionProgress:s=>s.progress??1};
env.globalThis=env;
const ctx=vm.createContext(env);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','settlement-construction-assembly.js'),'utf8'),ctx);
const A=window.ConquerAssembly,src=building();
const zMax=m=>{let z=-Infinity;for(let i=2;i<m.pos.length;i+=3)z=Math.max(z,m.pos[i]);return z};
const area=m=>{let a=0;for(let t=0;t<m.col.length;t++){const o=t*9,u=[m.pos[o+3]-m.pos[o],m.pos[o+4]-m.pos[o+1],m.pos[o+5]-m.pos[o+2]],
  v=[m.pos[o+6]-m.pos[o],m.pos[o+7]-m.pos[o+1],m.pos[o+8]-m.pos[o+2]];a+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2}return a};

// ---- the level sweep
assert.equal(A.levelAt(src,.05),0,'nothing is built during site preparation');
assert.ok(A.levelAt(src,.5)>0&&A.levelAt(src,.5)<A.levelAt(src,.8),'the site level climbs with progress');
assert.ok(A.levelAt(src,.95)>=3+A.TILE_LAG-1e-9,'by the finishing phase the level is past the ridge');
console.log('PASS site level: 0 at preparation, climbing, past the ridge at the finish');

// ---- masonry: whole courses below, blocks of the course being laid
const lvl=1.0+A.COURSE*.5,m=A.assemble(src,lvl,1);
assert.ok(zMax(m)<=Math.ceil(lvl/A.COURSE)*A.COURSE+1e-9,'nothing above the course being laid');
const base=Math.floor(lvl/A.COURSE)*A.COURSE;
const full=A.assemble(src,base,1),half=A.assemble(src,base+A.COURSE*.5,1),course=A.assemble(src,base+A.COURSE*.999,1);
assert.ok(area(full)<area(half)&&area(half)<area(course),'the course being laid fills block by block');
assert.ok(m.col.every(c=>c==='#888888'||c==='#777777'),'below the eaves only walls are shown');
assert.deepEqual(A.assemble(src,lvl,1),A.assemble(src,lvl,1),'the same level always gives the same blocks');
console.log('PASS masonry: courses, ragged top course, deterministic');

// ---- roof: rafters and battens before tiles, tiles from the eaves
const roofTimber=A.assemble(src,2.3,1);
assert.ok(roofTimber.col.includes('#4a3424')&&roofTimber.col.includes('#8a6a45'),'rafters and battens go up before the tiles');
assert.ok(!roofTimber.col.includes('#333333'),'no tiles yet just above the eaves');
const tiled=A.assemble(src,2.9,1);
assert.ok(tiled.col.includes('#333333'),'tiles follow behind the timber');
console.log('PASS roof: rafters and battens first, tiles behind them');

// ---- the end is exactly the finished building
const done=A.assemble(src,3+A.TILE_LAG+.01,1);
assert.ok(Math.abs(area(done)-area({pos:src.pos,col:src.col}))<1e-6,'at the end the whole surface is there');
assert.ok(!done.col.includes('#4a3424')&&!done.col.includes('#8a6a45'),'no timber left showing on the finished roof');
console.log('PASS completion: identical surface to the finished building');
