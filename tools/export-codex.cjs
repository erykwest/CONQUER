'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRuntime}=require('./codex-runtime.cjs');
function generate(){
  const {sandbox,sources}=createRuntime(),api=sandbox.window.ConquerGameCodex;
  const input=sources.map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8').replace(/\r\n/g,'\n')).join('\n');
  const catalog=JSON.parse(JSON.stringify(api.snapshot()));
  const descriptors={
    tower:{type:'tower',shape:'square',size:1.5,level:1},gate:{type:'gate',size:1.5,level:1},
    wall:{type:'wall',length:4,level:1},palisade:{type:'palisade',length:4},built:{type:'built',length:3,level:1},
    bridge:{type:'bridge',length:4,width:1.5,variant:'stone'},moat:{type:'moat',length:4,width:1.5,variant:'dry'},
    well:{type:'well'},pier:{type:'pier',reach:4},'shipyard.1':{type:'pier',yard:1},'shipyard.2':{type:'pier',yard:2},
    'clay-quarry':{type:'quarry',extractionMode:'clay'}
  };
  for(const key of ['market','tavern','church','training','plaza','townhall','guild','bargello','balivo','loggingCamp','quarry','mine','windmill','watermill'])descriptors[key]={type:key};
  const examples={};
  for(const [key,structure] of Object.entries(descriptors))examples['building:'+key]={structure,quote:api.quote('building:'+key,{structure})};
  return {schemaVersion:1,sourceDigest:crypto.createHash('sha256').update(input).digest('hex'),catalog,examples};
}
function serialize(){return JSON.stringify(generate(),null,2)+'\n'}
if(require.main===module){
  const file=path.join(__dirname,'../wiki/catalog.json'),result=serialize();
  if(process.argv.includes('--check')){
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==result){console.error('Wiki catalog is stale. Run node tools/export-codex.cjs');process.exitCode=1}
    else console.log('PASS generated Wiki catalog matches gameplay providers');
  }else{fs.writeFileSync(file,result);console.log('Generated wiki/catalog.json from gameplay providers')}
}
module.exports={generate,serialize};
