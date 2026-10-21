'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../src/settlement-world3d.js','utf8');
const start=source.indexOf('  function pollRendererError('),end=source.indexOf('  // ---------- small geometry helpers',start);
assert.ok(start>=0&&end>start,'use the actual nonblocking renderer error check');
let calls=0,deleted=0,status=1,error=0,lost=false,now=0;
const gl={TIMEOUT_EXPIRED:1,WAIT_FAILED:2,NO_ERROR:0,SYNC_GPU_COMMANDS_COMPLETE:3,
  isContextLost:()=>lost,clientWaitSync:(_f,flags,timeout)=>{assert.equal(flags,0);assert.equal(timeout,0);return status},
  getError:()=>{calls++;return error},deleteSync:()=>deleted++,fenceSync:()=>({}),flush(){}};
const S={errorFence:null},context=vm.createContext({S,Error,performance:{now:()=>now}});
vm.runInContext(source.slice(start,end),context);
context.deferRendererError(gl);assert.ok(S.errorFence);
context.pollRendererError(gl);assert.equal(calls,0,'GPU work in flight must not trigger a synchronous error query');
assert.equal(deleted,0);
now=1;context.deferRendererError(gl);assert.equal(deleted,1,'checkpoint covers the latest complete frame');
assert.equal(S.errorFenceAt,0,'replacing a checkpoint preserves its original age');
status=4;context.pollRendererError(gl);assert.equal(calls,1);assert.equal(deleted,2);assert.equal(S.errorFence,null);
for(now=10;now<1000;now+=10){context.deferRendererError(gl);context.pollRendererError(gl)}
assert.equal(calls,1,'continuous animation must not query synchronous GPU errors every frame');
assert.equal(S.errorFence,null,'do not allocate fences between health checks');
now=1001;
context.deferRendererError(gl);error=1281;assert.throws(()=>context.pollRendererError(gl),/WebGL2 renderer failure/);
error=0;status=1;now=2001;context.deferRendererError(gl);now=3001;
context.pollRendererError(gl);assert.equal(calls,3,'a permanently busy GPU cannot starve error detection');
assert.equal(S.errorFence,null);
now=3002;
lost=true;assert.throws(()=>context.pollRendererError(gl),/WebGL2 renderer failure/);
lost=false;now=5000;status=2;context.deferRendererError(gl);
assert.throws(()=>context.pollRendererError(gl),/WebGL2 renderer failure/,'failed GPU wait is never ignored');
gl.fenceSync=()=>null;
assert.throws(()=>context.deferRendererError(gl),/sync allocation failed/);
console.log('PASS WebGL2 error polling defers GPU waits and retains error/context-loss detection');
