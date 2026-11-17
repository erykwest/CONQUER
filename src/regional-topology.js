'use strict';
// Constant-time eight-slot ROW/COLUMN index for gameplay. Geometry remains
// the independently generated, staggered HEXAGONAL Voronoi tessellation.
// Eight logical nearby slots must not be confused with eight shared edges.
(function(root){
  const directions=Object.freeze(['NW','N','NE','W','E','SW','S','SE']);
  const offsets=Object.freeze([
    [-1,-1],[-1,0],[-1,1],
    [0,-1],[0,1],
    [1,-1],[1,0],[1,1]
  ]);
  function neighbors8(centers){
    const indices=new Map(centers.map(c=>[
      c.macroRow+','+c.macroCol,c.macroId
    ]));
    return Object.fromEntries(centers.map(c=>[
      c.macroId,
      offsets.map(([dr,dc])=>
        indices.get((c.macroRow+dr)+','+(c.macroCol+dc))??null)
    ]));
  }
  function area(poly){
    if(!poly||poly.length<3)return 0;
    let twice=0;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      twice+=a.x*b.y-b.x*a.y;
    }
    return Math.abs(twice)*.5;
  }
  const api=Object.freeze({directions,neighbors8,area});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerRegionalTopology=api;
})(typeof window==='object'?window:{});
