// Remote telemetry is disabled until authenticated ingestion, payload schemas,
// persistent storage and rate limiting are implemented. Local diagnostics remain active.
export default async function handler(req,res){
  res.setHeader('cache-control','no-store, max-age=0');
  res.setHeader('Allow','POST');
  return res.status(404).json({ok:false,error:'telemetry_disabled'});
}
