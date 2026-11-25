'use strict';
// One portable owner of discovery, failure aggregation and machine-readable QA evidence.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function discover(root){
  return fs.readdirSync(path.join(root,'qa')).filter(f=>f.endsWith('-regression.cjs')).sort().map(f=>'qa/'+f);
}
function runSuite(root,files,{run,log=console.log,timeout=0}={}){
  // Preserve the previous shell runner's job-level time budget. Callers may opt
  // into a per-suite timeout; slower local machines get no additional deadline.
  const invoke=run||((file)=>spawnSync(process.execPath,[file],{cwd:root,stdio:'inherit',timeout}));
  const results=[];
  for(const file of files){
    if(!/^qa\/[A-Za-z0-9_-]+-regression\.cjs$/.test(file))throw Error('Invalid regression path: '+file);
  }
  for(const file of files){
    log('::group::'+file);const start=Date.now();let result;
    try{result=invoke(file)||{error:Error('Runner returned no result')}}catch(error){result={error}}
    const ok=result.status===0&&!result.error&&!result.signal;
    const entry={file,ok,exitCode:result.status??null,signal:result.signal||null,durationMs:Date.now()-start};
    if(result.error)entry.error=String(result.error.message||result.error);
    results.push(entry);log('::endgroup::');
    if(!ok)log('::error file='+file+'::Regression failed'+(entry.error?': '+entry.error:''));
  }
  return{total:results.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
}
if(require.main===module){
  try{
    const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),files=discover(root);
    if(args.includes('--list'))console.log(files.join('\n'));
    else{
      const report=runSuite(root,files),i=args.indexOf('--report');
      if(i>=0){
        if(!args[i+1])throw Error('--report requires a path');
        const target=path.resolve(root,args[i+1]),relative=path.relative(root,target);
        if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Report must stay inside the workspace');
        fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
      }
      console.log(`${report.passed}/${report.total} deterministic regressions passed; ${report.failed} failed.`);
      process.exitCode=report.failed?1:0;
    }
  }catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={discover,runSuite};
