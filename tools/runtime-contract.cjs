'use strict';
// Explicit load-time dependencies for the classic-script runtime. This checks
// entry-point wiring, not inferred call graphs or optional runtime providers.
const fs=require('node:fs'),path=require('node:path');
const CONTRACTS=[
  ['settlement-builder-controls.js',['settlement-builder-commands.js']],
  ['settlement-app-input.js',['settlement-builder-commands.js','settlement-builder-controls.js']],
  ['settlement-app-persistence.js',['settlement-save-snapshot.js']],
  ['ui/game-api.js',['ui/save-status.js','settlement-builder-commands.js']],
  ['settlement-diplomacy.js',['settlement-path.js']],
  ['settlement-vehicles.js',['settlement-path.js']],
  ['settlement-road-sign-tests.js',['settlement-path.js']],
  ['settlement-civic3d.js',['settlement-util.js','settlement-mesh3d.js']],
  ['settlement-house3d.js',['settlement-mesh3d.js']],
  ['settlement-wood3d.js',['settlement-util.js','settlement-mesh3d.js']]
];
function scriptPaths(html){
  return [...html.matchAll(/<script\b[^>]*\bsrc=["'](?:\.\/)?src\/([^"'?]+)(?:\?[^"']*)?["'][^>]*>/g)].map(m=>m[1]);
}
function checkOrder(scripts,contracts=CONTRACTS){
  const errors=[];
  for(const file of new Set(scripts))if(scripts.filter(x=>x===file).length!==1)errors.push('Duplicate script: '+file);
  for(const [consumer,providers] of contracts){
    const index=scripts.indexOf(consumer);if(index<0)continue;
    for(const provider of providers){
      const before=scripts.indexOf(provider);
      if(before<0)errors.push(consumer+' requires missing '+provider);
      else if(before>=index)errors.push(provider+' must precede '+consumer);
    }
  }
  return errors;
}
function checkPages(root,pages=['index.html','camp/index.html']){
  return pages.map(page=>{
    const scripts=scriptPaths(fs.readFileSync(path.join(root,page),'utf8')),errors=checkOrder(scripts);
    for(const file of scripts){
      const target=path.resolve(root,'src',file),relative=path.relative(path.resolve(root,'src'),target);
      if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))errors.push('Script escapes src/: '+file);
      else if(!fs.existsSync(target))errors.push('Script file missing: '+file);
    }
    return{page,scripts:scripts.length,errors};
  });
}
if(require.main===module){
  try{
    const reports=checkPages(path.resolve(__dirname,'..'));
    for(const r of reports){console.log(r.page+': '+r.scripts+' scripts, '+r.errors.length+' errors');for(const error of r.errors)console.error(error)}
    process.exitCode=reports.some(r=>r.errors.length)?1:0;
  }catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={CONTRACTS,scriptPaths,checkOrder,checkPages};
