'use strict';
// Heraldry geometry shared by the SVG editor (settlement-heraldry.js) and the 3D meshes
// that wear the arms (ship flags and sails): the field partitions as SVG path data on a
// 100x100 box, and a sampler that turns a heraldry {pattern,c1..c4,symbol} into a grid of
// colours over the 160x100 flag layout (field stretched 1.6:1, charge in the middle),
// synchronously, with Path2D hit tests: no image to wait for.
(() => {
  const DEFAULT=Object.freeze({pattern:'quarterly',c1:'#b32628',c2:'#eac15b',symbol:'lion',c3:'#111111',c4:'#f5e8c8'});
  // c1 fills the path; the rest of the field is c2 (plain2 is all c2).
  const PATTERNS=Object.freeze({
    plain1:'M0 0H100V100H0Z',plain2:'',
    perFess:'M0 0H100V50H0Z',
    pale:'M38 0H62V100H38Z',
    billet:'M43 18H57V49H43Z',
    cross:'M39 0H61V100H39ZM0 39H100V61H0Z',
    fess:'M0 39H100V61H0Z',
    pall:'M0 0L50 44 100 0 100 17 59 56 59 100 41 100 41 56 0 17Z',
    chevron:'M0 69L50 20 100 69 100 86 50 39 0 86Z',
    lozenge:'M50 14L85 50 50 86 15 50Z',
    pile:'M5 0H95L50 87Z',
    saltire:'M0 0H18L100 82V100H82L0 18ZM82 0H100V18L18 100H0V82Z',
    perPale:'M0 0H50V100H0Z',
    perBend:'M0 0H100V100Z',
    perSaltire:'M0 0L50 50 100 0ZM0 100L50 50 100 100Z',
    quarterly:'M0 0H50V50H0ZM50 50H100V100H50Z',
    bend:'M0 0H24L100 76V100H76L0 24Z',
    gyron:'M0 0H100L50 50ZM0 100L50 50 100 100Z',
    point:'M0 0H100V100L50 32 0 100Z',
    wavy:'M0 40Q12 28 25 40T50 40T75 40T100 40V62Q87 74 75 62T50 62T25 62T0 62Z'
  });
  let hit=null;
  const paths=new Map();
  function path2d(d){let p=paths.get(d);if(!p){p=new Path2D(d);paths.set(d,p)}return p}
  function hitContext(){
    if(hit)return hit;
    if(typeof document==='undefined'||typeof Path2D==='undefined')return null;
    hit=document.createElement('canvas').getContext('2d');
    return hit;
  }
  const cache=new Map();
  // colours[row][col] for a cols x rows grid over the flag (row 0 at the top, col 0 at the hoist).
  function sample(h,cols,rows){
    h={...DEFAULT,...(h||{})};
    const key=[h.pattern,h.c1,h.c2,h.symbol,h.c3,h.c4,cols,rows].join('|');
    if(cache.has(key))return cache.get(key);
    const g=hitContext(),field=PATTERNS[h.pattern]??PATTERNS.quarterly;
    const sym=(typeof window!=='undefined'&&window.CONQUER_HERALDRY_SYMBOLS||[]).find(s=>s.id===h.symbol);
    const src=sym&&window.CONQUER_HERALDRY_SOURCES?.[sym.source];
    // The charge sits in a 66x66 box at (47,17) of the 160x100 flag, viewBox fitted "meet".
    let toSym=null;
    if(src?.path&&Array.isArray(sym.viewBox)){
      const [bx,by,bw,bh]=sym.viewBox,s=Math.min(66/bw,66/bh),ox=47+(66-bw*s)/2,oy=17+(66-bh*s)/2;
      toSym=(x,y)=>{const u=(x-ox)/s+bx,v=(y-oy)/s+by;return u>=bx&&u<=bx+bw&&v>=by&&v<=by+bh?[u,v]:null};
    }
    const out=[];
    for(let r=0;r<rows;r++){
      const row=[];
      for(let c=0;c<cols;c++){
        const x=(c+.5)/cols*160,y=(r+.5)/rows*100;
        let col=h.c2;
        if(field&&(!g?fallback(h.pattern,x/1.6,y):g.isPointInPath(path2d(field),x/1.6,y)))col=h.c1;
        const q=g&&toSym&&toSym(x,y);
        if(q&&g.isPointInPath(path2d(src.path),q[0],q[1]))col=h.c3;
        row.push(col);
      }
      out.push(row);
    }
    cache.set(key,out);
    if(cache.size>64)cache.delete(cache.keys().next().value);
    return out;
  }
  // Without a canvas (tests, workers): a few partitions by geometry, the rest as plain c1/c2.
  function fallback(id,x,y){
    if(id==='plain1')return true;
    if(id==='perFess')return y<50;
    if(id==='perPale')return x<50;
    if(id==='quarterly')return(x<50)===(y<50);
    if(id==='cross')return Math.abs(x-50)<11||Math.abs(y-50)<11;
    return false;
  }
  window.ConquerHeraldryShapes=Object.freeze({DEFAULT,PATTERNS,sample});
})();
