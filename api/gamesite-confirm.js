import {tokenDigest,validEmail,unsubscribeCode,publicSite,db,sendEmail,respondPage,noStore} from './_gamesite-follow-core.js';
export default async function handler(req,res){
  noStore(res);
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return respondPage(res,405,'Method not allowed','<p>Use the email link.</p>');}
  const token=req.method==='GET'?req.query?.token:req.body?.token;
  if(!/^[0-9a-f]{64}$/i.test(String(token||'')))return respondPage(res,400,'Invalid link','<p>This confirmation link is invalid.</p>');
  if(req.method==='GET')return respondPage(res,200,'Confirm your subscription','<p>Confirm your email address to receive selected CONQUER development updates.</p><form method="post"><input type="hidden" name="token" value="'+token+'"><button type="submit">Confirm email</button></form>');
  try{
    // Vercel parses application/x-www-form-urlencoded POST form bodies.
    const hash=tokenDigest(token);
    const matches=await db('?token_hash=eq.'+hash+'&status=eq.pending&select=email,token_expires_at&limit=1');
    const record=matches?.[0];
    if(!record||!validEmail(record.email)||Date.parse(record.token_expires_at)<Date.now())return respondPage(res,410,'Link expired','<p>Request a new confirmation email on the Follow page.</p>');
    await db('?token_hash=eq.'+hash+'&status=eq.pending',{
      method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'confirmed',confirmed_at:new Date().toISOString(),token_hash:null,token_expires_at:null})
    });
    const site=publicSite(),code=unsubscribeCode(record.email);
    const unSub=site+'/api/gamesite-unsubscribe?email='+encodeURIComponent(record.email)+'&code='+code;
    try{await sendEmail(record.email,'Welcome to CONQUER updates',
      '<p>Your subscription is confirmed.</p><p>You can stop receiving CONQUER updates at any time:</p><p><a href="'+unSub+'">Unsubscribe</a></p>');}
    catch(error){console.error('gamesite welcome email unavailable',error.message);}
    return respondPage(res,200,'Subscription confirmed','<p>You are now subscribed to CONQUER development updates. You can unsubscribe with the link in your emails.</p>');
  }catch(error){console.error('gamesite confirm failure',error.message);return respondPage(res,503,'Service unavailable','<p>Please try again later.</p>');}
}