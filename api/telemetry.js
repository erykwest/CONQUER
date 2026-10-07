const buffer=globalThis.__conquerTelemetryBuffer||(globalThis.__conquerTelemetryBuffer=[]);

export default async function handler(req,res){
  if(req.method==='GET'){
    res.setHeader('cache-control','no-store, max-age=0');
    return res.status(200).json({ok:true,count:buffer.length,samples:buffer.slice(-120)});
  }
  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  let body=req.body;
  if(typeof body==='string'){
    try{body=JSON.parse(body)}catch{return res.status(400).json({ok:false,error:'invalid_json'})}
  }
  if(!body||typeof body!=='object')return res.status(400).json({ok:false,error:'invalid_payload'});
  const sample=body.sample&&typeof body.sample==='object'?body.sample:{};
  const events=Array.isArray(body.events)?body.events.slice(-8):[];
  const safe={
    sessionId:String(body.sessionId||'').slice(0,80),
    receivedAt:new Date().toISOString(),
    sample:{
      atMs:Number(sample.atMs)||0,
      day:Number(sample.day)||0,
      speed:Number(sample.speed)||0,
      frame:sample.frame||null,
      draw:sample.draw||null,
      maintenance:sample.maintenance||null,
      save:sample.save||null,
      navigation:sample.navigation||null,
      cache:sample.cache||null,
      population:sample.population||null,
      scene:sample.scene||null
    },
    events:events.map(e=>({
      type:String(e?.type||'').slice(0,64),
      severity:String(e?.severity||'').slice(0,16),
      atMs:Number(e?.atMs)||0,
      data:e?.data&&typeof e.data==='object'?e.data:{}
    }))
  };
  buffer.push(safe);
  if(buffer.length>120)buffer.splice(0,buffer.length-120);
  console.log('CONQUER_TELEMETRY '+JSON.stringify(safe));
  return res.status(204).end();
}
