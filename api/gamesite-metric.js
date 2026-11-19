import {db,noStore,respondJson,publicSite} from './_gamesite-follow-core.js';
const whitelist=new Set(['home_view','game_view','play_view','play_click','follow_view','media_view','devlog_view']);
export default async function handler(req,res){
  noStore(res);
  if(req.method!=='POST'){res.setHeader('Allow','POST');return respondJson(res,405,{ok:false});}
  const body=req.body&&typeof req.body==='object'?req.body:{};
  if(!whitelist.has(body.event))return respondJson(res,400,{ok:false});
  try{
    const site=publicSite();
    if(req.headers.origin&&req.headers.origin!==site)return respondJson(res,403,{ok:false});
    if(Number(req.headers['content-length']||0)>1000)return respondJson(res,413,{ok:false});
    // Do not store IPs, cookies, user agents, referrers or raw URLs.
    const base=new URL('/rest/v1/rpc/gamesite_record_metric',process.env.SUPABASE_URL||'https://fwpmcyxggvdtsuatovzo.supabase.co');
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)throw Error('Metrics backend not configured');
    const response=await fetch(base,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_metric:body.event})});
    if(!response.ok)throw Error('metrics backend '+response.status);
    return respondJson(res,202,{ok:true});
  }catch(error){console.error('gamesite metrics',error.message);return respondJson(res,503,{ok:false});}
}