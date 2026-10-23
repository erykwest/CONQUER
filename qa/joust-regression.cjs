'use strict';
// Joust life (settlement-events-joust.js): at every pass the two knights cross at
// mid-lists and exactly one is unhorsed, lies in the sand, gets up and walks back to
// his horse; bouts alternate ends; spectators sit on the stands; squires keep out of
// the lanes while the knights charge; everything stays on the 14 x 10 ground.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const window={},State={seed:5,structures:[],clock:{speed:0}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,Float32Array,performance:{now:()=>0}});
for(const f of ['assets/scatter-model.js','assets/civic-models.js','assets/event-models.js','settlement-mesh3d.js','settlement-events3d.js','settlement-events-people.js','settlement-events-joust.js'])vm.runInContext(src(f),ctx);
const J=window.ConquerJoust,E=window.ConquerEvents3D;
const ground={id:'j1',type:'eventVenue',venue:'festivalGround',x:0,y:0,angle:0,event:{setup:'joust',phase:'active'}};
assert.ok(J.isJoust(ground)&&!J.isJoust({...ground,event:{setup:'circus',phase:'active'}})&&!J.isJoust({...ground,event:{setup:'joust',phase:'preparing'}}),
  'only an active joust comes alive');

const {w,h}=E.sizeOf(ground),inside=p=>Math.abs(p.x)<=w/2&&Math.abs(p.y)<=h/2;
const dt=.05;
for(let n=0;n<12;n++){
  const t0=n*J.BOUT,first=J.scene(ground,t0);
  const startA=first.knights.find(k=>k.who==='A').horse.x;
  let unhorsed=new Set(),crossed=false,minGap=Infinity,lay=false,back=null;
  for(let t=t0;t<t0+J.BOUT-1e-6;t+=dt){
    const sc=J.scene(ground,t),[A,B]=sc.knights;
    assert.equal(sc.bout,n);
    for(const k of sc.knights){
      assert.ok(inside(k.horse),'bout '+n+': horse on the ground');
      assert.ok(Math.abs(Math.abs(k.horse.y)-J.LANE)<1e-9,'horses keep to their lanes');
      if(k.fallen){unhorsed.add(k.who);assert.ok(inside(k.fallen),'the fallen knight stays on the ground');
        if(k.fallen.z===0&&!k.fallen.walking)assert.ok(Math.abs(k.fallen.y)>J.LANE+.5,'thrown away from the tilt');if(k.fallen.z===0&&k.fallen.rot!==0)lay=true}
      assert.ok(!(k.rider&&k.fallen),'a knight is either mounted or on foot');
    }
    if(Math.sign(A.horse.x)!==Math.sign(startA)&&A.horse.x!==0)crossed=true;
    minGap=Math.min(minGap,Math.abs(A.horse.x-B.horse.x));
    if(Math.abs(t-t0-J.IMPACT)<dt/2)assert.ok(Math.abs(A.horse.x)<.2&&Math.abs(B.horse.x)<.2,'they meet at mid-lists at the impact');
    // While the knights charge, squires and grooms keep out of the lanes.
    if(sc.t>1.2&&sc.t<4.2)for(const q of sc.squires)assert.ok(Math.abs(q.p.x)>J.END-.1||Math.abs(q.p.y)>J.LANE+.35,'squire '+q.id+' in the lists');
    for(const q of sc.squires)assert.ok(inside(q.p),'squires stay on the ground');
    back=sc.knights.find(k=>k.loser);
  }
  assert.equal(unhorsed.size,1,'bout '+n+': exactly one knight is unhorsed');
  assert.ok(crossed&&minGap<.05,'bout '+n+': the knights cross');
  assert.ok(lay,'bout '+n+': the loser lies in the sand');
  assert.ok(back.rider&&!back.fallen&&Math.abs(back.rider.x)===J.END,'bout '+n+': the loser is back in the saddle at his end');
  const next=J.scene(ground,(n+1)*J.BOUT).knights.find(k=>k.who==='A').horse.x;
  assert.equal(next,-startA,'bouts alternate ends');
}
{const winners=new Set();for(let n=0;n<12;n++)winners.add(J.scene(ground,n*J.BOUT+5).knights.find(k=>k.loser).who);
 assert.equal(winners.size,2,'both knights lose sometimes')}
console.log('PASS knights: cross at mid-lists, one unhorsed per pass, back in the saddle, bouts alternate (12 bouts)');

// Spectators sit on the stands' seats, raised above the ground, about two in three taken.
const sc=J.scene(ground,0),stands=E.placedItems(ground).filter(i=>i.m.startsWith('stand')).map(E.itemRect);
const seatsTotal=E.placedItems(ground).filter(i=>i.m.startsWith('stand')).reduce((n,i)=>n+window.ConquerEventModels.models[i.m].meta.seats.length+(window.ConquerEventModels.models[i.m].meta.standing||[]).length,0);
assert.ok(sc.spectators.length>seatsTotal*.5&&sc.spectators.length<seatsTotal*.8,'about two in three places taken ('+sc.spectators.length+'/'+seatsTotal+')');
assert.ok(sc.spectators.every(q=>q.z>.2&&q.provisional===true&&stands.some(r=>q.x>=r.x0&&q.x<=r.x1&&q.y>=r.y0&&q.y<=r.y1)),'spectators sit on the stands');
assert.deepEqual(JSON.stringify(J.scene(ground,0).spectators),JSON.stringify(sc.spectators),'the same seats every time');
{const peak=J.scene(ground,J.IMPACT).cheer,calm=J.scene(ground,.2).cheer;assert.ok(peak>.9&&calm<.05,'the crowd cheers at the clash')}
console.log('PASS spectators: '+sc.spectators.length+' on the stands, cheering at the clash');

// Squires and grooms: spare horses at both ends, lances carried between tents and lists.
{let lances=0;for(let t=0;t<40;t+=.5)lances+=J.scene(ground,t).squires.filter(q=>q.carry==='lance').length;
 const sq=J.scene(ground,0).squires;
 assert.equal(sq.filter(q=>q.kind==='horse').length,2,'two spare horses held at the ends');
 assert.ok(sq.filter(q=>q.kind==='squire').length>=4&&lances>20,'squires shuttle lances')}
{const A=J.liveryOf(ground,'A'),B=J.liveryOf(ground,'B');assert.notEqual(A.main+A.alt,B.main+B.alt,'the two knights wear different colours')}
console.log('PASS squires and grooms get the next bout ready');
