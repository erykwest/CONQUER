'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../src/settlement-world3d.js','utf8');
const start=source.indexOf('  function pollRendererError('),end=source.indexOf('  // ---------- small geometry helpers',start);
assert.ok(start>=0&&end>start,'use the actual nonblocking renderer error check');
let calls=0,deleted=0,status=1,error=0,lost=false;
const gl={TIMEOUT_EXPIRED:1,WAIT_FAILED:2,NO_ERROR:0,SYNC_GPU_COMMANDS_COMPLETE:3,
  isContextLost:()=>lost,clientWaitSync:(_f,flags,timeout)=>{assert.equal(flags,0);assert.equal(timeout,0);return status},
  getError:()=>{calls++;return error},deleteSync:()=>deleted++,fenceSync:()=>({}),flush(){}};
const S={errorFence:null},context=vm.createContext({S,Error});
vm.runInContext(source.slice(start,end),context);
context.deferRendererError(gl);assert.ok(S.errorFence);
context.pollRendererError(gl);assert.equal(calls,0,'GPU work in flight must not trigger a synchronous error query');
assert.equal(deleted,0);
context.deferRendererError(gl);assert.equal(deleted,1,'replace an obsolete fence when another frame submits uploads');
status=4;context.pollRendererError(gl);assert.equal(calls,1);assert.equal(deleted,2);assert.equal(S.errorFence,null);
context.deferRendererError(gl);error=1281;assert.throws(()=>context.pollRendererError(gl),/WebGL2 renderer failure/);
lost=true;assert.throws(()=>context.pollRendererError(gl),/WebGL2 renderer failure/);
console.log('PASS WebGL2 error polling defers GPU waits and retains error/context-loss detection');
