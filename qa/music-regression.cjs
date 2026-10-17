'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const window={addEventListener(){},Audio:null};
const ctx={state:'suspended',destination:{},currentTime:0,createGain(){return {gain:{value:0},connect(){},disconnect(){}}},
 createBiquadFilter(){return {type:'',Q:{value:0},gain:{value:0},frequency:{value:0},connect(){}}},
 createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},connect(){}}},
 createMediaElementSource(){return {connect(){}}},
 resume(){this.state='running';return Promise.resolve()}};
window.AudioContext=class{constructor(){return ctx}};
window.Audio=class{constructor(url){this.url=url;this.played=false}play(){this.played=true;return Promise.resolve()}pause(){this.played=false}removeAttribute(){}load(){}};
const store={getItem:()=>null,setItem(){}};
const sandbox={window,localStorage:store,console,setInterval(){return 1},clearInterval(){},Date,Math};
vm.runInNewContext(source('settlement-music-catalog.js'),sandbox);
const tracks=window.ConquerMusicCatalog;
assert.equal(tracks.length,9,'exactly nine distinct season scores');
assert.deepEqual([...new Set(tracks.map(x=>x.season))].sort(),['autumn','spring','summer','winter']);
const counts=tracks.reduce((a,x)=>(a[x.season]=(a[x.season]||0)+1,a),{});
assert.equal(JSON.stringify(counts),JSON.stringify({spring:3,summer:2,autumn:2,winter:2}));
const report=JSON.parse(fs.readFileSync(path.join(root,'docs/music-compression-report.json'),'utf8'));
assert.equal(report.assets.length,9);
for(const clip of tracks){
 assert.ok(Number.isFinite(clip.gainDb)&&Number.isFinite(clip.lufs)&&Number.isFinite(clip.truePeak));
 assert.ok(clip.truePeak+clip.gainDb<=-2.99,'peak-safe gain '+clip.id);
 const p=path.join(root,'src/assets/sounds/music',clip.file),bytes=fs.readFileSync(p);
 assert.ok(bytes.length>10000,'real decoded MP3 '+clip.id);
 assert.ok((bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0),'MP3 header '+clip.id);
 const entry=report.assets.find(x=>x.id===clip.id);
 assert.ok(entry&&entry.stored_bytes===bytes.length);
}
assert.ok(!fs.existsSync(path.join(root,'.music-staging')),'raw transfer chunks removed from deploy tree');
vm.runInNewContext(source('settlement-music.js'),sandbox);
const api=window.ConquerMusic;
async function main(){
 assert.equal(api.state().tracks,9);
 assert.equal(api.state().enabled,false);
 assert.equal(await api.setEnabled(true),true);
 assert.ok(api.state().track.startsWith('spring'));
 assert.equal(api.setEq('low',7),true);
 assert.equal(api.state().eq.low,7);
 assert.equal(api.setEq('high',99),true);
 assert.equal(api.state().eq.high,12);
 api.resetEq();assert.equal(api.state().eq.low,0);
 api.setVolume(.3);assert.equal(api.state().volume,.3);
 api.setAutomatic(false);
 assert.equal(await api.select('summer1',0),true);
 assert.equal(api.state().track,'summer1');
 api.setSeason('winter');
 assert.equal(api.state().season,'winter');
 assert.equal(await api.select('winter2',0),true);
 assert.equal(api.state().track,'winter2');
 assert.equal(await api.setEnabled(false),false);
 assert.equal(api.state().track,null);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('id="musicEnable"')&&html.includes('id="musicEq"'));
 assert.ok(html.includes('settlement-music-catalog.js')&&html.includes('settlement-music-dev.js'));
 assert.ok(source('settlement-sound-bridge.js').includes('ConquerMusic?.setSeason'));
 console.log('MUSIC regression OK: 9 MP3, 4 seasons, loudness, EQ, playlist, stop and UI');
}
main().catch(e=>{console.error(e);process.exitCode=1});
