'use strict';
// Geometry suites keep instant completion, using the real construction runtime and real debits.
const fs=require('node:fs'),vm=require('node:vm');
module.exports=function constructionFixture(ctx){
  const core=fs.readFileSync(__dirname+'/../src/settlement-core.js','utf8');
  ctx.State.clock=ctx.State.clock||{day:0};ctx.State.devBuild={fastBuild:true};
  ctx.CIVIC_LEVEL_TYPES=[];ctx.civicLevel=()=>1;ctx.buildDuration=()=>4;ctx.constructionCost=()=>({});
  ctx.clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  vm.runInContext(core.slice(core.indexOf('const CONSTRUCTION_MAX_WORKERS'),core.indexOf('function pointRadius(s)')),ctx);
  const actual=ctx.underConstruction;ctx.underConstruction=s=>!!s?.building||actual(s);
};
