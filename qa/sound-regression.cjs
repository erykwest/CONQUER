'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const file=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(){},
 setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
let oscillators=0;
class MockAudioContext{
 constructor(){this.currentTime=0;this.state='suspended';this.destination={}}
 createGain(){return {gain:param(),connect(){},disconnect(){}}}
 createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},connect(){}}}
 createBufferSource(){return {connect(){},start(){},stop(){},onended:null}}
 createOscillator(){return {frequency:param(),connect(){},start(){oscillators++},stop(){},onended:null}}
 resume(){this.state='running';return Promise.resolve()}
 decodeAudioData(){return Promise.resolve({})}
}
async function main(){
 for(const js of ['settlement-sound-catalog.js','settlement-sound.js','settlement-sound-bridge.js','settlement-sound-dev.js'])
  new vm.Script(file(js),{filename:js});
 const window={AudioContext:MockAudioContext,addEventListener(){}};
 const sandbox={window,localStorage:{getItem:()=>null,setItem(){}},
  fetch:async()=>({ok:false,status:404}),console:{warn(){}}};
 vm.runInNewContext(file('settlement-sound-catalog.js'),sandbox);
 vm.runInNewContext(file('settlement-sound.js'),sandbox);
 const audio=window.ConquerSound;
 assert.equal(audio.layers.join(','),'environment,local,effects,notifications');
 assert.equal(audio.state().enabled,false);
 assert.equal(await audio.play('bells'),false);
 assert.equal(audio.testTone('effects'),false);
 assert.equal(await audio.setEnabled(true),true);
 assert.equal(audio.state().enabled,true);
 assert.equal(audio.testTone('notifications'),true);
 assert.equal(oscillators,1);
 audio.setMaster(.4);assert.equal(audio.state().master,.4);
 audio.setVolume('effects',2);assert.equal(audio.state().volumes.effects,1);
 audio.setMuted('environment',true);assert.equal(audio.state().muted.environment,true);
 audio.syncScene({environment:[{id:'rain',volume:.7}],local:[{id:'market',volume:.3}]});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.ok(window.ConquerSoundCatalog.rain.url.endsWith('rain-sound-550289%20(1).mp3'));
 const clips=Object.values(window.ConquerSoundCatalog);
 assert.equal(clips.length,14,'only the approved 14 audio assets are referenced');
 for(const entry of clips){
  const assetPath=path.join(root,'src','assets','sounds',entry.file);
  const bytes=fs.readFileSync(assetPath);
  assert.ok(bytes.length>10000,'non-empty MP3 asset: '+entry.id);
  assert.ok((bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)||
   (bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0),'valid MP3 header: '+entry.id);
 }
 assert.equal(await audio.setEnabled(false),false);
 const captures=[],State={season:'spring',view:{scale:.29},selectedId:null,
  structures:[{id:'m1',type:'market',x:100,y:100}]};
 const world={ConquerSound:{syncScene:o=>captures.push(o),state:()=>({enabled:false})}};
 vm.runInNewContext(file('settlement-sound-bridge.js'),{
  window:world,State,nightFactor:()=>0,currentWeather:()=>({kind:'clear',rain:0,wind:0}),
  canvas:{clientWidth:500,clientHeight:300},s2w:()=>({x:100,y:100})
 });
 world.ConquerSoundBridge.tick(500,{kind:'clear',rain:0,wind:0});
 assert.equal(captures[0].local.length,0,'below threshold, no selected target');
 State.view.scale=.30;world.ConquerSoundBridge.tick(900,{kind:'clear',rain:0,wind:0});
 assert.equal(captures[1].local[0].id,'market','local audio at zoom 30%');
 State.view.scale=.2;State.selectedId='m1';
 world.ConquerSoundBridge.tick(1300,{kind:'clear',rain:0,wind:0});
 assert.equal(captures[2].local[0].id,'market','selection bypasses zoom threshold');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('id="devSound"')&&html.includes('data-sound-layer="notifications"'));
 assert.ok(html.includes('settlement-sound-dev.js'));
 assert.ok(html.includes('id="soundPreviewPlay"'));
 assert.ok(file('settlement-app-simulation.js').includes('ConquerSoundBridge?.tick'));
 console.log('SOUND regression OK — 4 buses, unlock, mixer, zoom, selection and DEV wiring');
}
main().catch(err=>{console.error(err);process.exitCode=1});
