// Absolute sitemap generated from the deployment's verified public URL.
// Configure PUBLIC_SITE_URL before public release. No invented canonical domain.
export default function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
  let origin;
  try{origin=new URL(process.env.PUBLIC_SITE_URL).origin;if(!origin.startsWith('https://'))throw Error('HTTPS required');}
  catch{return res.status(503).send('Configure PUBLIC_SITE_URL before publishing the sitemap.');}
  const pages=['/gamesite/','/gamesite/game.html','/gamesite/media.html','/gamesite/devlog/index.html',
    '/gamesite/devlog/introducing-conquer.html','/gamesite/follow.html','/gamesite/about.html','/gamesite/privacy.html',
    '/gamesite/contact.html','/gamesite/play.html'];
  const body='<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
    pages.map(path=>'<url><loc>'+origin+path+'</loc></url>').join('')+'</urlset>';
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=3600');
  return res.status(200).send(body);
}