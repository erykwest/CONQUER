// Private newsletter utilities for Vercel serverless routes.
// Service keys remain server-side. No client SDK or service role in public assets.
import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
const supabase = () => process.env.SUPABASE_URL || 'https://fwpmcyxggvdtsuatovzo.supabase.co';
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const validEmail = value => typeof value === 'string' && value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const normalizedEmail = value => value.trim().toLowerCase();
export const freshToken = () => randomBytes(32).toString('hex');
export const tokenDigest = token => createHash('sha256').update(String(token)).digest('hex');
export const unsubscribeCode = email => {
  if (!process.env.FOLLOW_SIGNING_SECRET) throw Error('Missing FOLLOW_SIGNING_SECRET');
  return createHmac('sha256', process.env.FOLLOW_SIGNING_SECRET).update('unsubscribe:v1:' + normalizedEmail(email)).digest('hex');
};
export const verifyUnsubscribe = (email, code) => {
  if (!validEmail(email) || !/^[0-9a-f]{64}$/i.test(String(code))) return false;
  const expected = Buffer.from(unsubscribeCode(email),'hex'), actual = Buffer.from(code,'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
export const page = (title,body) => '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+title+' · CONQUER</title><body style="background:#12191b;color:#efe7d6;font:17px/1.6 system-ui;max-width:680px;margin:12vh auto;padding:25px"><h1 style="font-family:Georgia,serif">'+title+'</h1>'+body+'<p><a href="/gamesite/" style="color:#dfc18a">Back to CONQUER</a></p></body></html>';
export const respondPage = (res,code,title,body) => res.status(code).setHeader('Content-Type','text/html; charset=utf-8').send(page(title,body));
export const respondJson = (res,code,body) => res.status(code).setHeader('Cache-Control','no-store').json(body);
export function publicSite() {
  const raw = process.env.PUBLIC_SITE_URL;
  if (!raw) throw Error('Missing PUBLIC_SITE_URL');
  const u = new URL(raw);
  if (u.protocol !== 'https:') throw Error('PUBLIC_SITE_URL must use HTTPS');
  return u.origin;
}
export async function db(path, options={}) {
  if (!secret()) throw Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  const url = new URL('/rest/v1/gamesite_followers'+path,supabase());
  const response = await fetch(url,{
    ...options,
    headers:{
      apikey:secret(),Authorization:'Bearer '+secret(),
      'Content-Type':'application/json',Accept:'application/json',
      ...(options.headers||{})
    }
  });
  const text = await response.text();
  if (!response.ok) throw Error('Newsletter store returned status '+response.status);
  return text ? JSON.parse(text) : null;
}
export async function sendEmail(email,subject,html){
  if (!process.env.RESEND_API_KEY || !process.env.FOLLOW_FROM) throw Error('Newsletter mailer is not configured');
  const response = await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.FOLLOW_FROM,to:[email],subject,html})
  });
  if (!response.ok) throw Error('Mailer returned status '+response.status);
}
export function noStore(res) {res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');}
