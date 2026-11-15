'use strict';
// CONQUER shared pure helpers. No dependencies: every page loads this script first, so
// any module (and any QA harness running a single module in a vm context) can bind
// them at definition time, e.g. const hash=window.ConquerUtil.hash. Classic script.
(function(){
  // FNV-1a 32-bit over UTF-16 code units -> unsigned int.
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  // mulberry32: seeded generator of floats in [0,1).
  function rng(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  // Hermite smoothstep on k (not clamped: callers pass 0..1).
  const smoothstep=k=>k*k*(3-2*k);
  window.ConquerUtil=Object.freeze({hash,rng,smoothstep});
})();
