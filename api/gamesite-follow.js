import {validEmail,normalizedEmail,freshToken,tokenDigest,publicSite,requireFollowConfig,consumeFollowBudget,db,sendEmail,respondJson,noStore} from './_gamesite-follow-core.js';
export default async function handler(req,res){
  noStore(res);
  if(req.method!=='POST'){res.setHeader('Allow','POST');return respondJson(res,405,{ok:false,error:'method_not_allowed'});}
  const size=Number(req.headers['content-length']||'0');
  if(size>3000)return respondJson(res,413,{ok:false,error:'payload_too_large'});
  const body=req.body && typeof req.body==='object'?req.body:{};
  if(body.website)return respondJson(res,202,{ok:true});
  if(body.consent!==true||!validEmail(body.email))return respondJson(res,400,{ok:false,error:'invalid_request'});
  try {
    const site=publicSite();
    if(req.headers.origin && req.headers.origin!==site) return respondJson(res,403,{ok:false,error:'origin_forbidden'});
    requireFollowConfig();
    if(!(await consumeFollowBudget(req))){res.setHeader('Retry-After','900');return respondJson(res,429,{ok:false,error:'rate_limited'});}
    const email=normalizedEmail(body.email);
    const previous=await db('?email=eq.'+encodeURIComponent(email)+'&select=status,last_sent_at&limit=1');
    if(previous?.[0]?.status==='confirmed')return respondJson(res,202,{ok:true});
    const prior=previous?.[0]?.last_sent_at;
    if(prior && Date.now()-Date.parse(prior)<10*60*1000)return respondJson(res,202,{ok:true});
    const token=freshToken();
    await db('?on_conflict=email',{
      method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({email,status:'pending',token_hash:tokenDigest(token),
        token_expires_at:new Date(Date.now()+48*60*60*1000).toISOString(),last_sent_at:new Date().toISOString()})
    });
    const link=site+'/api/gamesite-confirm?token='+encodeURIComponent(token);
    try{
      await sendEmail(email,'Confirm your CONQUER development updates',
        '<p>You asked to follow CONQUER development.</p><p>To confirm your subscription, open this link and press Confirm:</p>'+
        '<p><a href="'+link+'">Confirm my email</a></p><p>The link expires after 48 hours. If you did not request this, ignore this message.</p>');
    }catch(deliveryError){
      // Do not cool down a subscription for ten minutes if no mail was sent.
      try{await db('?email=eq.'+encodeURIComponent(email)+'&token_hash=eq.'+tokenDigest(token),{
        method:'PATCH',headers:{Prefer:'return=minimal'},
        body:JSON.stringify({last_sent_at:null,token_hash:null,token_expires_at:null})
      });}catch(rollbackError){console.error('Follow send rollback failed',rollbackError.message);}
      throw deliveryError;
    }
    return respondJson(res,202,{ok:true});
  }catch(err){
    console.error('gamesite follow failure',err.message);
    return respondJson(res,503,{ok:false,error:'service_unavailable'});
  }
}