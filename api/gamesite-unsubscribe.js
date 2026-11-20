import {verifyUnsubscribe,validEmail,normalizedEmail,db,respondPage,noStore} from './_gamesite-follow-core.js';
export default async function handler(req,res){
  noStore(res);
  if(!['GET','POST'].includes(req.method))return respondPage(res,405,'Method not allowed','<p>Use the link in your email.</p>');
  const email=req.method==='GET'?req.query?.email:req.body?.email;
  const code=req.method==='GET'?req.query?.code:req.body?.code;
  try{
    if(!verifyUnsubscribe(email,code))return respondPage(res,400,'Invalid link','<p>This unsubscribe link is invalid.</p>');
    if(req.method==='GET')return respondPage(res,200,'Unsubscribe','<p>Stop receiving development emails from CONQUER?</p><form method="post"><input type="hidden" name="email" value="'+normalizedEmail(email)+'"><input type="hidden" name="code" value="'+code+'"><button type="submit">Unsubscribe</button></form>');
    await db('?email=eq.'+encodeURIComponent(normalizedEmail(email)),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'unsubscribed',token_hash:null,token_expires_at:null})});
    return respondPage(res,200,'You are unsubscribed','<p>No more CONQUER development emails will be sent to this address unless you choose to subscribe again.</p>');
  }catch(err){console.error('gamesite unsubscribe failure',err.message);return respondPage(res,503,'Service unavailable','<p>Please try again later.</p>');}
}