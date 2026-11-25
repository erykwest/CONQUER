'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {discover,runSuite}=require('../tools/run-regressions.cjs');
const files=['qa/first-regression.cjs','qa/second-regression.cjs','qa/third-regression.cjs','qa/fourth-regression.cjs'];
const seen=[],logs=[];
const report=runSuite('.',files,{log:x=>logs.push(x),run:file=>{
  seen.push(file);if(file===files[0])return{status:1};if(file===files[1])throw Error('could not launch');
  if(file===files[2])return{status:null,signal:'SIGTERM'};return{status:0};
}});
assert.deepEqual(seen,files,'run every consumer after failures, launch errors and timeout');
assert.equal(report.total,4);assert.equal(report.passed,1);assert.equal(report.failed,3);
assert.equal(report.results[1].exitCode,null);assert.equal(report.results[2].signal,'SIGTERM');
assert.equal(logs.filter(x=>x.startsWith('::error')).length,3);
assert.throws(()=>runSuite('.',['qa/../../outside-regression.cjs'],{run:()=>{throw Error('must not launch')}}),/Invalid regression path/);
const inventory=discover(path.resolve(__dirname,'..'));
assert.ok(inventory.length>200);assert.ok(inventory.includes('qa/regression-runner-regression.cjs'));
assert.deepEqual(inventory,[...inventory].sort());
console.log('PASS portable regression runner: discovery, all failures retained, no premature green');
