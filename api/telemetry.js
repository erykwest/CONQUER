export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
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
  console.log('CONQUER_TELEMETRY '+JSON.stringify(safe));
  return res.status(204).end();
}
